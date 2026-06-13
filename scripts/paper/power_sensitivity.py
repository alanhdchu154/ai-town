#!/usr/bin/env python3
"""Approximate power / MDE table for the residue rolling-callback outcome.

The paper's primary causal outcome is a binary callback-window label:
`rolling_callback` in {0, 1}. This script uses the standard arcsine-square-root
effect size for two independent proportions (Cohen's h) to estimate:

- power for candidate n-per-arm / baseline-rate / risk-difference combinations;
- positive minimum detectable risk difference (MDE) for 80% power.

This is a planning/sensitivity tool, not a replacement for the final
non-parametric analysis. The manuscript should describe it as approximate.
"""
from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path
from statistics import NormalDist


DEFAULT_BASELINES = [0.05, 0.10, 0.20, 0.30]
DEFAULT_EFFECTS = [0.05, 0.10, 0.15, 0.20, 0.30]
DEFAULT_NS = [10, 40, 80, 150, 250]
DEFAULT_CLUSTER_SIZES = [2, 4, 8]
DEFAULT_ICCS = [0.01, 0.05, 0.10]
STD_NORMAL = NormalDist()


def cohen_h(p1: float, p0: float) -> float:
    p1 = clamp_probability(p1)
    p0 = clamp_probability(p0)
    return 2.0 * (math.asin(math.sqrt(p1)) - math.asin(math.sqrt(p0)))


def power_two_proportions(n_per_arm: int, p0: float, p1: float, alpha: float = 0.05) -> float:
    """Approximate two-sided power using Cohen's h.

    For equal group sizes, sqrt(n / 2) * |h| is the noncentral distance under
    the alternative. The simple approximation below is common for A/B planning
    and is intentionally conservative in how it is presented in the docs.
    """
    if n_per_arm <= 0:
        return float("nan")
    z_alpha = STD_NORMAL.inv_cdf(1.0 - alpha / 2.0)
    distance = math.sqrt(n_per_arm / 2.0) * abs(cohen_h(p1, p0))
    return float(STD_NORMAL.cdf(distance - z_alpha))


def positive_mde(n_per_arm: int, p0: float, target_power: float = 0.80, alpha: float = 0.05) -> float:
    """Return the positive risk difference needed for target power."""
    if n_per_arm <= 0:
        return float("nan")
    z_alpha = STD_NORMAL.inv_cdf(1.0 - alpha / 2.0)
    z_power = STD_NORMAL.inv_cdf(target_power)
    h = (z_alpha + z_power) * math.sqrt(2.0 / n_per_arm)
    base_angle = math.asin(math.sqrt(clamp_probability(p0)))
    p1 = math.sin(base_angle + h / 2.0) ** 2
    return max(0.0, min(1.0, p1) - p0)


def design_effect(cluster_size: float, icc: float) -> float:
    """Return the standard cluster design effect 1 + (m - 1) * ICC."""
    return 1.0 + max(0.0, cluster_size - 1.0) * max(0.0, icc)


def effective_n(n_per_arm: int, cluster_size: float, icc: float) -> float:
    """Approximate effective n per arm under equal-sized clusters."""
    return n_per_arm / design_effect(cluster_size, icc)


def clamp_probability(value: float) -> float:
    return min(1.0, max(0.0, float(value)))


def parse_float_list(raw: str | None, fallback: list[float]) -> list[float]:
    if not raw:
        return fallback
    return [float(part.strip()) for part in raw.split(",") if part.strip()]


def parse_int_list(raw: str | None, fallback: list[int]) -> list[int]:
    if not raw:
        return fallback
    return [int(part.strip()) for part in raw.split(",") if part.strip()]


def fmt(value: float) -> str:
    if math.isnan(value):
        return "nan"
    return f"{value:.3f}"


def make_rows(
    ns: list[int],
    baselines: list[float],
    effects: list[float],
    alpha: float,
    target_power: float,
    cluster_sizes: list[int],
    iccs: list[float],
) -> tuple[list[dict], list[dict], list[dict]]:
    power_rows = []
    for n in ns:
        for p0 in baselines:
            for rd in effects:
                p1 = min(1.0, p0 + rd)
                power_rows.append(
                    {
                        "n_per_arm": n,
                        "baseline_callback_rate": p0,
                        "risk_difference": p1 - p0,
                        "residue_on_rate": p1,
                        "alpha": alpha,
                        "approx_power": power_two_proportions(n, p0, p1, alpha=alpha),
                    }
                )

    mde_rows = []
    for n in ns:
        for p0 in baselines:
            mde_rows.append(
                {
                    "n_per_arm": n,
                    "baseline_callback_rate": p0,
                    "target_power": target_power,
                    "alpha": alpha,
                    "positive_mde": positive_mde(n, p0, target_power=target_power, alpha=alpha),
                }
            )

    cluster_rows = []
    for n in ns:
        for p0 in baselines:
            for rd in effects:
                p1 = min(1.0, p0 + rd)
                for cluster_size in cluster_sizes:
                    for icc in iccs:
                        n_eff = effective_n(n, cluster_size, icc)
                        # power_two_proportions only requires a positive n-like
                        # value, so use the same formula with effective n.
                        cluster_rows.append(
                            {
                                "n_per_arm_nominal": n,
                                "baseline_callback_rate": p0,
                                "risk_difference": p1 - p0,
                                "cluster_size": cluster_size,
                                "icc": icc,
                                "design_effect": design_effect(cluster_size, icc),
                                "effective_n_per_arm": n_eff,
                                "approx_power_cluster_adjusted": power_two_proportions(
                                    n_eff, p0, p1, alpha=alpha
                                ),
                            }
                        )
    return power_rows, mde_rows, cluster_rows


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_markdown(path: Path, power_rows: list[dict], mde_rows: list[dict], cluster_rows: list[dict]) -> None:
    lines = [
        "# Rolling-Callback Sample Size Sensitivity",
        "",
        "Approximate planning calculations for the binary primary outcome",
        "`rolling_callback_rate`. These use Cohen's h for two independent",
        "proportions and should be treated as sensitivity estimates, not final",
        "inference. The final paper analysis still uses the observed labels,",
        "bootstrap CIs, and permutation tests.",
        "",
        "## 80% Power MDE",
        "",
        "| n per arm | baseline callback rate | positive MDE |",
        "|---:|---:|---:|",
    ]
    for row in mde_rows:
        lines.append(
            "| {} | {} | {} |".format(
                row["n_per_arm"],
                fmt(row["baseline_callback_rate"]),
                fmt(row["positive_mde"]),
            )
        )
    lines.extend(
        [
            "",
            "## Power Grid",
            "",
            "| n per arm | baseline | risk diff | residue-on rate | approx power |",
            "|---:|---:|---:|---:|---:|",
        ]
    )
    for row in power_rows:
        lines.append(
            "| {} | {} | {} | {} | {} |".format(
                row["n_per_arm"],
                fmt(row["baseline_callback_rate"]),
                fmt(row["risk_difference"]),
                fmt(row["residue_on_rate"]),
                fmt(row["approx_power"]),
            )
        )
    lines.extend(
        [
            "",
            "## Cluster Sensitivity",
            "",
            "The table below applies the standard design-effect approximation",
            "`n_eff = n / (1 + (m - 1) * ICC)` to show how repeated rows within",
            "a dyad, day, or rolling window can reduce effective sample size.",
            "",
            "| nominal n per arm | baseline | risk diff | cluster size | ICC | design effect | effective n per arm | adjusted power |",
            "|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
    )
    # Keep the markdown readable: show the planning-critical 10 percentage-point
    # effect rows plus all default n/cluster/ICC combinations at p0=0.10.
    for row in cluster_rows:
        if abs(row["baseline_callback_rate"] - 0.10) > 1e-9:
            continue
        if abs(row["risk_difference"] - 0.10) > 1e-9:
            continue
        lines.append(
            "| {} | {} | {} | {} | {} | {} | {} | {} |".format(
                row["n_per_arm_nominal"],
                fmt(row["baseline_callback_rate"]),
                fmt(row["risk_difference"]),
                row["cluster_size"],
                fmt(row["icc"]),
                fmt(row["design_effect"]),
                fmt(row["effective_n_per_arm"]),
                fmt(row["approx_power_cluster_adjusted"]),
            )
        )
    lines.extend(
        [
            "",
        "## Interpretation",
        "",
        "- `n=10/arm` is a pipeline pilot only.",
        "- `n=40/arm` has low power for 10--15 percentage-point effects at",
        "  plausible baseline callback rates.",
        "- `n>=150/arm` is more plausible for small 10--15 percentage-point",
        "  effects when the observed baseline callback rate is low, roughly",
        "  0.05--0.15. Higher baselines can push the requirement toward",
        "  `n≈250/arm` for 10 percentage-point effects.",
        "- These calculations treat callback-window rows as independent. If many",
        "  rows cluster within the same dyad, day, or window, the effective N is",
        "  smaller and the final design needs either larger N or a cluster-aware",
        "  analysis.",
        "- The cluster-sensitivity section is still approximate; it is a planning",
        "  guardrail to keep nominal sample size from being mistaken for",
        "  independent evidence.",
        "- Final N should be pre-registered from the pilot's observed baseline",
        "  callback rate and yield.",
        "",
    ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def selftest() -> int:
    low = power_two_proportions(40, 0.10, 0.20)
    high = power_two_proportions(150, 0.10, 0.25)
    if not (0.0 < low < high < 1.0):
        raise AssertionError(f"unexpected monotonic power values: low={low}, high={high}")
    small = positive_mde(40, 0.10)
    large = positive_mde(150, 0.10)
    if not (small > large > 0.0):
        raise AssertionError(f"MDE should shrink with n: n40={small}, n150={large}")
    deff = design_effect(4, 0.10)
    if abs(deff - 1.3) > 1e-12:
        raise AssertionError(f"unexpected design effect: {deff}")
    adjusted = power_two_proportions(effective_n(40, 4, 0.10), 0.10, 0.20)
    if not (0.0 < adjusted < low):
        raise AssertionError(f"cluster-adjusted power should shrink: adjusted={adjusted}, low={low}")
    print("power_sensitivity selftest: PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--outdir", default="docs/paper/emotional-residue/results/power")
    parser.add_argument("--baselines", help="comma-separated baseline rates")
    parser.add_argument("--effects", help="comma-separated positive risk differences")
    parser.add_argument("--ns", help="comma-separated n-per-arm values")
    parser.add_argument("--cluster-sizes", help="comma-separated average cluster sizes for design-effect sensitivity")
    parser.add_argument("--iccs", help="comma-separated ICC values for design-effect sensitivity")
    parser.add_argument("--alpha", type=float, default=0.05)
    parser.add_argument("--target-power", type=float, default=0.80)
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        return selftest()

    baselines = parse_float_list(args.baselines, DEFAULT_BASELINES)
    effects = parse_float_list(args.effects, DEFAULT_EFFECTS)
    ns = parse_int_list(args.ns, DEFAULT_NS)
    cluster_sizes = parse_int_list(args.cluster_sizes, DEFAULT_CLUSTER_SIZES)
    iccs = parse_float_list(args.iccs, DEFAULT_ICCS)
    power_rows, mde_rows, cluster_rows = make_rows(
        ns, baselines, effects, args.alpha, args.target_power, cluster_sizes, iccs
    )

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    write_csv(outdir / "power_grid.csv", power_rows)
    write_csv(outdir / "mde_grid.csv", mde_rows)
    write_csv(outdir / "cluster_power_grid.csv", cluster_rows)
    write_markdown(outdir / "summary.md", power_rows, mde_rows, cluster_rows)
    print(f"wrote power sensitivity outputs under: {outdir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

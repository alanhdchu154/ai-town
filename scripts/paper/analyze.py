#!/usr/bin/env python3
"""Data-analysis pipeline for the "soul / residue" research paper.

This script ingests evaluation outputs and produces the tables, statistics, and
figures the paper needs. All inferential statistics (bootstrap CIs, permutation
tests, Cliff's delta, weighted Cohen's kappa, Krippendorff's ordinal alpha) are
implemented from scratch in numpy so the results are transparent and do not
depend on niche libraries. pandas / scipy.stats are used only for data loading
and Spearman correlation.

Everything is deterministic: a single SEED (1234) drives every resampling step.

================================================================================
INPUT DATA CONTRACT
================================================================================

1. dataset.json -- a JSON list of records, one per evaluated conversation:

    {
      "case_name": str,
      "pair": str,            # e.g. "Mahiru-Umi" (alphabetically sorted names)
      "speaker": str,
      "target": str,
      "condition": "residue_on" | "residue_off" |
                   "residue_placebo" | "na",              # ablation arm
      "window": str | null,   # e.g. "10:00-12:00" (continuity exp) else null
      "source_run": str | null,
      "collection_day": str | null,
      "overall_score": float, # 0..1
      "status": "PASS" | "WARN" | "FAIL",
      "metrics": {            # each value in 0..1; markers include
        "emotional_expression_uniqueness": float,
        "comfort_style_uniqueness": float,
        "burden_response_uniqueness": float,
        "human_aftertaste_score": float,
        "echo_similarity_penalty": float,
        "stage_direction_leak_penalty": float
        # (any additional 0..1 markers are handled generically)
      },
      "rolling_callback": 0 | 1 | null,   # continuity exp: did an earlier
                                          # residue surface as behavior?
      "residue_candidate": 0 | 1 | null
    }

2. annotations.csv -- human annotation cross-check. Columns:

      case_name, rater, naturalness, emotional_binding,
      character_consistency, repetition

   The four Likert dims (naturalness, emotional_binding, character_consistency,
   repetition) are integers 1..5. There are multiple rows per case_name, one
   per rater.

================================================================================
OUTPUTS (under <outdir>/results/, default scripts/paper/results/)
================================================================================

  results/soul_uniqueness.csv          (A) per-marker mean + 95% bootstrap CI
  results/soul_uniqueness.md
  results/residue_ablation.csv         (B) residue_on vs residue_off/placebo experiment
  results/residue_ablation.md
  results/annotation_agreement.csv     (C) inter-rater + convergent validity
  results/annotation_agreement.md
  results/figures/marker_means.png     (D) bar chart of marker means + CIs
  results/figures/residue_ablation.png (D) residue arm dot/bar
  results/summary.md                   (E) stitched plain-English readout

================================================================================
USAGE
================================================================================

  python scripts/paper/analyze.py --dataset PATH [--annotations PATH] \
      [--outdir DIR] [--marker-dim NAME] [--human-dim NAME]

  python scripts/paper/analyze.py --selftest

The --selftest mode generates synthetic dataset + annotations with a *planted*
residue effect and a *planted* rater agreement in a temp dir, runs the full
pipeline, and asserts the outputs are correct (correct ablation direction,
kappa > 0.4 on the planted-agreement dim, all files present). It prints
PASS/FAIL and exits nonzero on failure.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from typing import Optional

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

# Guarded matplotlib import: the pipeline must still emit CSV/markdown if
# matplotlib is unavailable.
try:
    import matplotlib

    matplotlib.use("Agg")  # headless backend, no display required
    import matplotlib.pyplot as plt

    HAVE_MPL = True
except Exception:  # pragma: no cover - environment dependent
    HAVE_MPL = False

SEED = 1234
N_BOOT = 10_000
N_PERM = 10_000

# Canonical marker list (others present in data are still handled generically).
DEFAULT_MARKERS = [
    "emotional_expression_uniqueness",
    "comfort_style_uniqueness",
    "burden_response_uniqueness",
    "human_aftertaste_score",
    "echo_similarity_penalty",
    "stage_direction_leak_penalty",
]
LIKERT_DIMS = [
    "naturalness",
    "emotional_binding",
    "character_consistency",
    "repetition",
]
ANNOTATION_COLUMNS = ["case_name", "rater", *LIKERT_DIMS]
CLUSTER_COLUMNS = ["pair", "source_run", "window"]
MISSING_CLUSTER_VALUES = {"", "none", "null", "nan", "missing"}

DISPLAY_LABELS = {
    "human_aftertaste_score": "rule_based_aftertaste_proxy",
}


def display_label(name: str) -> str:
    return DISPLAY_LABELS.get(name, name)


# ---------------------------------------------------------------------------
# Statistical primitives (implemented from scratch in numpy)
# ---------------------------------------------------------------------------
def bootstrap_mean_ci(
    x: np.ndarray, n_boot: int = N_BOOT, alpha: float = 0.05, seed: int = SEED
) -> tuple[float, float, float]:
    """Return (mean, lo, hi) where [lo, hi] is a percentile bootstrap CI of the
    mean of x. Resampling is seeded for determinism."""
    x = np.asarray(x, dtype=float)
    x = x[~np.isnan(x)]
    if x.size == 0:
        return (np.nan, np.nan, np.nan)
    if x.size == 1:
        return (float(x[0]), float(x[0]), float(x[0]))
    rng = np.random.default_rng(seed)
    # Vectorized resampling: (n_boot, n) integer index matrix.
    idx = rng.integers(0, x.size, size=(n_boot, x.size))
    boot_means = x[idx].mean(axis=1)
    lo = float(np.percentile(boot_means, 100 * alpha / 2))
    hi = float(np.percentile(boot_means, 100 * (1 - alpha / 2)))
    return (float(x.mean()), lo, hi)


def mean_ci_with_note(
    x: np.ndarray, seed: int = SEED, min_bootstrap_n: int = 3
) -> tuple[float, float, float, str]:
    """Mean with a bootstrap CI only when enough observations exist."""
    x = np.asarray(x, dtype=float)
    x = x[~np.isnan(x)]
    if x.size == 0:
        return (np.nan, np.nan, np.nan, "no_observations")
    if x.size < min_bootstrap_n:
        return (float(x.mean()), np.nan, np.nan, f"no_bootstrap_n_lt_{min_bootstrap_n}")
    mean, lo, hi = bootstrap_mean_ci(x, seed=seed)
    return (mean, lo, hi, "bootstrap")


def saturated_two_arm_status(a: np.ndarray, b: np.ndarray) -> str:
    """Flag two-arm outcomes that have no usable contrast variance."""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    a = a[~np.isnan(a)]
    b = b[~np.isnan(b)]
    if a.size == 0 or b.size == 0:
        return "not_computable"
    combined = np.concatenate([a, b])
    if np.unique(combined).size <= 1:
        return "saturated_no_usable_variance"
    if np.unique(a).size <= 1 and np.unique(b).size <= 1:
        return "constant_within_arms"
    return "usable_variance"


def bootstrap_diff_ci(
    a: np.ndarray,
    b: np.ndarray,
    n_boot: int = N_BOOT,
    alpha: float = 0.05,
    seed: int = SEED,
) -> tuple[float, float, float]:
    """Bootstrap 95% CI for the difference of means (mean(a) - mean(b)).

    a and b are resampled independently (two-sample bootstrap)."""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    a = a[~np.isnan(a)]
    b = b[~np.isnan(b)]
    if a.size == 0 or b.size == 0:
        return (np.nan, np.nan, np.nan)
    rng = np.random.default_rng(seed)
    ia = rng.integers(0, a.size, size=(n_boot, a.size))
    ib = rng.integers(0, b.size, size=(n_boot, b.size))
    diffs = a[ia].mean(axis=1) - b[ib].mean(axis=1)
    point = float(a.mean() - b.mean())
    lo = float(np.percentile(diffs, 100 * alpha / 2))
    hi = float(np.percentile(diffs, 100 * (1 - alpha / 2)))
    return (point, lo, hi)


def permutation_test_diff_means(
    a: np.ndarray, b: np.ndarray, n_perm: int = N_PERM, seed: int = SEED
) -> tuple[float, float]:
    """Two-sided permutation test for difference of means between groups a and b.

    Returns (observed_diff, p_value). The null pools all observations and
    randomly re-partitions them into groups of the original sizes; p is the
    proportion of permuted |diff| >= observed |diff| (with +1 smoothing)."""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    a = a[~np.isnan(a)]
    b = b[~np.isnan(b)]
    if a.size == 0 or b.size == 0:
        return (np.nan, np.nan)
    observed = float(a.mean() - b.mean())
    pooled = np.concatenate([a, b])
    n_a = a.size
    rng = np.random.default_rng(seed)
    count = 0
    abs_obs = abs(observed)
    # Permute by shuffling the pooled vector and splitting.
    for _ in range(n_perm):
        perm = rng.permutation(pooled)
        diff = perm[:n_a].mean() - perm[n_a:].mean()
        if abs(diff) >= abs_obs - 1e-12:
            count += 1
    p = (count + 1) / (n_perm + 1)  # add-one smoothing, never reports p=0
    return (observed, float(p))


def cliffs_delta(a: np.ndarray, b: np.ndarray) -> float:
    """Cliff's delta effect size for a vs b in [-1, 1].

    delta = P(a > b) - P(a < b). Positive means a tends to exceed b.
    Computed exactly via rank comparison (O(n log n) using sorting)."""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    a = a[~np.isnan(a)]
    b = b[~np.isnan(b)]
    if a.size == 0 or b.size == 0:
        return np.nan
    # For each element of a, count how many b are less / greater.
    b_sorted = np.sort(b)
    # number of b strictly less than each a value
    less = np.searchsorted(b_sorted, a, side="left")
    # number of b less-than-or-equal
    leq = np.searchsorted(b_sorted, a, side="right")
    greater = b.size - leq  # number of b strictly greater than each a value
    gt = int(less.sum())   # pairs where a > b
    lt = int(greater.sum())  # pairs where a < b
    n_pairs = a.size * b.size
    return float((gt - lt) / n_pairs)


def cohens_quadratic_weighted_kappa(
    r1: np.ndarray, r2: np.ndarray, categories: Optional[list[int]] = None
) -> float:
    """Cohen's quadratic-weighted kappa for two raters (paired ratings).

    Handles ordinal categories (default 1..5). Returns NaN if undefined
    (e.g. fewer than 1 paired observation, or zero expected disagreement)."""
    r1 = np.asarray(r1, dtype=float)
    r2 = np.asarray(r2, dtype=float)
    mask = ~(np.isnan(r1) | np.isnan(r2))
    r1, r2 = r1[mask].astype(int), r2[mask].astype(int)
    if r1.size == 0:
        return np.nan
    if categories is None:
        categories = list(range(1, 6))
    cats = list(categories)
    k = len(cats)
    cat_index = {c: i for i, c in enumerate(cats)}
    # Observed confusion matrix O.
    O = np.zeros((k, k), dtype=float)
    for x, y in zip(r1, r2):
        if x in cat_index and y in cat_index:
            O[cat_index[x], cat_index[y]] += 1
    n = O.sum()
    if n == 0:
        return np.nan
    # Quadratic weight matrix W[i,j] = ((i-j)/(k-1))^2.
    i_idx = np.arange(k).reshape(-1, 1)
    j_idx = np.arange(k).reshape(1, -1)
    if k > 1:
        W = ((i_idx - j_idx) / (k - 1)) ** 2
    else:
        W = np.zeros((k, k))
    # Expected matrix E from marginals (outer product / n).
    row_marg = O.sum(axis=1)
    col_marg = O.sum(axis=0)
    E = np.outer(row_marg, col_marg) / n
    denom = (W * E).sum()
    if denom == 0:
        # No expected disagreement -> kappa undefined; treat perfect agreement
        # as 1.0 if there is also no observed disagreement.
        return 1.0 if (W * O).sum() == 0 else np.nan
    kappa = 1.0 - (W * O).sum() / denom
    return float(kappa)


def krippendorff_ordinal_alpha(
    data: np.ndarray, categories: Optional[list[int]] = None
) -> float:
    """Krippendorff's alpha with ordinal difference function.

    `data` is a (n_raters, n_units) matrix of ratings; missing values are NaN.
    Implemented from the coincidence-matrix formulation in pure numpy.

    Ordinal metric: delta(c,k)^2 where delta uses cumulative marginal counts:
        delta_ord(c,k) = ( sum_{g=c..k} n_g  -  (n_c + n_k)/2 )^2
    """
    data = np.asarray(data, dtype=float)
    if categories is None:
        vals = data[~np.isnan(data)]
        if vals.size == 0:
            return np.nan
        categories = sorted(set(int(v) for v in vals))
    cats = list(categories)
    k = len(cats)
    cat_index = {c: i for i, c in enumerate(cats)}

    # Build the coincidence matrix.
    coincidence = np.zeros((k, k), dtype=float)
    n_raters, n_units = data.shape
    for u in range(n_units):
        col = data[:, u]
        present = col[~np.isnan(col)]
        m_u = present.size  # number of raters who scored this unit
        if m_u < 2:
            continue  # units rated <2 times contribute nothing
        # Accumulate every ordered pair of ratings within this unit (excluding
        # the self-pairing of the same physical observation), each weighted by
        # 1/(m_u - 1) per the coincidence-matrix definition.
        idx = np.array([cat_index[int(v)] for v in present])
        for ai in range(m_u):
            for bi in range(m_u):
                if ai == bi:
                    continue
                coincidence[idx[ai], idx[bi]] += 1.0 / (m_u - 1)

    n_total = coincidence.sum()
    if n_total == 0:
        return np.nan
    n_c = coincidence.sum(axis=1)  # marginals

    # Ordinal difference metric using cumulative marginals.
    delta = np.zeros((k, k), dtype=float)
    for c in range(k):
        for kk in range(k):
            lo, hi = (c, kk) if c <= kk else (kk, c)
            s = n_c[lo:hi + 1].sum() - (n_c[c] + n_c[kk]) / 2.0
            delta[c, kk] = s * s

    # Observed disagreement.
    Do = (coincidence * delta).sum() / n_total
    # Expected disagreement.
    De = 0.0
    for c in range(k):
        for kk in range(k):
            De += n_c[c] * n_c[kk] * delta[c, kk]
    De = De / (n_total * (n_total - 1)) if n_total > 1 else 0.0
    if De == 0:
        return 1.0 if Do == 0 else np.nan
    return float(1.0 - Do / De)


def risk_difference(p_a: float, p_b: float) -> float:
    """Risk difference (proportion a - proportion b)."""
    return float(p_a - p_b)


def valid_cluster_value(value: object) -> bool:
    """Return whether a value can safely participate in a cluster key."""
    if value is None:
        return False
    if isinstance(value, float) and np.isnan(value):
        return False
    return str(value).strip().lower() not in MISSING_CLUSTER_VALUES


def cluster_unit_values(
    df: pd.DataFrame,
    value_col: str,
    cluster_cols: Optional[list[str]] = None,
) -> tuple[dict[str, np.ndarray], dict[str, int], str]:
    """Aggregate row-level outcomes to cluster-level means by condition.

    The preregistered empirical path must account for dyad/day/window
    dependence. For the current local dataset contract we use the available
    `pair + source_run + window` metadata as the cluster key. Rows with missing
    outcome values or incomplete cluster metadata are excluded from this
    cluster-unit calculation.
    """
    if cluster_cols is None:
        cluster_cols = CLUSTER_COLUMNS
    missing_cols = [col for col in cluster_cols if col not in df.columns]
    if missing_cols or value_col not in df.columns or "condition" not in df.columns:
        reason = "missing column(s): {}".format(
            ", ".join(missing_cols + ([] if value_col in df.columns else [value_col]))
        )
        return {}, {}, reason

    work = df[["condition", value_col, *cluster_cols]].copy()
    work[value_col] = pd.to_numeric(work[value_col], errors="coerce")
    work = work.dropna(subset=[value_col])
    for col in cluster_cols:
        work = work[work[col].map(valid_cluster_value)]
    if work.empty:
        return {}, {}, "no rows with complete cluster metadata"

    work["_cluster_key"] = work[cluster_cols].astype(str).agg("|".join, axis=1)
    clustered = (
        work.groupby(["condition", "_cluster_key"], as_index=False)[value_col]
        .mean()
        .rename(columns={value_col: "cluster_mean"})
    )
    values: dict[str, np.ndarray] = {}
    counts: dict[str, int] = {}
    for condition, sub in clustered.groupby("condition"):
        arr = sub["cluster_mean"].to_numpy(dtype=float)
        values[str(condition)] = arr
        counts[str(condition)] = int(arr.size)
    return values, counts, "ok"


def cluster_contrast(
    cluster_values_by_condition: dict[str, np.ndarray],
    condition_a: str,
    condition_b: str,
    seed: int = SEED,
) -> dict:
    """Return cluster-unit difference statistics for two conditions."""
    a = cluster_values_by_condition.get(condition_a, np.array([], dtype=float))
    b = cluster_values_by_condition.get(condition_b, np.array([], dtype=float))
    if a.size == 0 or b.size == 0:
        return {
            "n_a": int(a.size),
            "n_b": int(b.size),
            "mean_diff": np.nan,
            "ci_lo": np.nan,
            "ci_hi": np.nan,
            "perm_p": np.nan,
        }
    diff, lo, hi = bootstrap_diff_ci(a, b, seed=seed)
    _, p = permutation_test_diff_means(a, b, seed=seed)
    return {
        "n_a": int(a.size),
        "n_b": int(b.size),
        "mean_diff": diff,
        "ci_lo": lo,
        "ci_hi": hi,
        "perm_p": p,
    }


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
def load_dataset(path: str) -> pd.DataFrame:
    """Load dataset.json into a flat DataFrame with metrics expanded to columns
    prefixed `metric_`."""
    with open(path, "r", encoding="utf-8") as fh:
        records = json.load(fh)
    rows = []
    for r in records:
        row = {
            "case_name": r.get("case_name"),
            "pair": r.get("pair"),
            "speaker": r.get("speaker"),
            "target": r.get("target"),
            "condition": r.get("condition"),
            "window": r.get("window"),
            "source_run": r.get("source_run"),
            "collection_day": r.get("collection_day") or r.get("day"),
            "overall_score": r.get("overall_score"),
            "status": r.get("status"),
            "rolling_callback": r.get("rolling_callback"),
            "residue_candidate": r.get("residue_candidate"),
        }
        for m_name, m_val in (r.get("metrics") or {}).items():
            row[f"metric_{m_name}"] = m_val
        rows.append(row)
    return pd.DataFrame(rows)


def load_annotations(path: str) -> pd.DataFrame:
    """Load annotations.csv."""
    df = pd.read_csv(path)
    missing = [column for column in ANNOTATION_COLUMNS if column not in df.columns]
    if missing:
        if "blind_id" in df.columns and "case_name" not in df.columns:
            raise ValueError(
                f"{path} looks like a blinded annotation worksheet, not "
                "analysis-ready annotations.csv; run "
                "scripts/paper/merge_rater_annotations.py on completed rater "
                "sheets first."
            )
        raise ValueError(
            f"{path} is missing required annotation columns: {', '.join(missing)}"
        )
    for column in LIKERT_DIMS:
        values = pd.to_numeric(df[column], errors="coerce")
        invalid = values.isna() | (values < 1) | (values > 5) | (values % 1 != 0)
        if invalid.any():
            bad_rows = ", ".join(str(i) for i in df.index[invalid].tolist()[:5])
            raise ValueError(
                f"{path} has invalid {column} Likert values at row index(es) "
                f"{bad_rows}; expected integers 1..5."
            )
        df[column] = values.astype(int)
    return df


def metric_columns(df: pd.DataFrame) -> list[str]:
    """Return marker names (without the metric_ prefix), canonical order first."""
    present = [c[len("metric_"):] for c in df.columns if c.startswith("metric_")]
    ordered = [m for m in DEFAULT_MARKERS if m in present]
    extras = [m for m in present if m not in DEFAULT_MARKERS]
    return ordered + sorted(extras)


# ---------------------------------------------------------------------------
# Markdown helpers
# ---------------------------------------------------------------------------
def df_to_md(df: pd.DataFrame, float_fmt: str = "{:.4f}") -> str:
    """Render a DataFrame as a GitHub-flavored markdown table without external
    deps (pandas.to_markdown needs `tabulate`)."""
    cols = list(df.columns)

    def fmt(v):
        if isinstance(v, float):
            if np.isnan(v):
                return ""
            return float_fmt.format(v)
        return "" if v is None else str(v)

    header = "| " + " | ".join(cols) + " |"
    sep = "| " + " | ".join("---" for _ in cols) + " |"
    lines = [header, sep]
    for _, row in df.iterrows():
        lines.append("| " + " | ".join(fmt(row[c]) for c in cols) + " |")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Analysis A: soul-uniqueness table
# ---------------------------------------------------------------------------
def analysis_soul_uniqueness(
    df: pd.DataFrame, outdir: str, seed: int = SEED
) -> pd.DataFrame:
    markers = metric_columns(df)
    rows = []
    # Overall.
    for m in markers:
        vals = df[f"metric_{m}"].to_numpy(dtype=float)
        mean, lo, hi = bootstrap_mean_ci(vals, seed=seed)
        rows.append(
            {
                "scope": "overall",
                "pair": "ALL",
                "marker": m,
                "n": int(np.sum(~np.isnan(vals))),
                "mean": mean,
                "ci_lo": lo,
                "ci_hi": hi,
                "ci_note": "bootstrap" if int(np.sum(~np.isnan(vals))) >= 2 else "no_bootstrap_n_lt_2",
            }
        )
    # Per pair.
    for pair_name, sub in df.groupby("pair"):
        for m in markers:
            vals = sub[f"metric_{m}"].to_numpy(dtype=float)
            mean, lo, hi, ci_note = mean_ci_with_note(vals, seed=seed, min_bootstrap_n=3)
            rows.append(
                {
                    "scope": "per_pair",
                    "pair": pair_name,
                    "marker": m,
                    "n": int(np.sum(~np.isnan(vals))),
                    "mean": mean,
                    "ci_lo": lo,
                    "ci_hi": hi,
                    "ci_note": ci_note,
                }
            )
    table = pd.DataFrame(rows)
    results_dir = os.path.join(outdir, "results")
    os.makedirs(results_dir, exist_ok=True)
    table.to_csv(os.path.join(results_dir, "soul_uniqueness.csv"), index=False)
    md = [
        "# A. Soul-uniqueness markers",
        "",
        "Mean and 95% bootstrap CI ({} resamples, seed={}) per marker.".format(
            N_BOOT, seed
        ),
        "Per-pair rows with n<3 report the mean but suppress the bootstrap CI.",
        "",
        "## Overall",
        "",
        df_to_md(table[table["scope"] == "overall"].drop(columns=["scope"])),
        "",
        "## Per pair",
        "",
        df_to_md(table[table["scope"] == "per_pair"].drop(columns=["scope"])),
        "",
    ]
    with open(os.path.join(results_dir, "soul_uniqueness.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md))
    return table


# ---------------------------------------------------------------------------
# Analysis B: residue ablation
# ---------------------------------------------------------------------------
def analysis_residue_ablation(
    df: pd.DataFrame, outdir: str, seed: int = SEED
) -> dict:
    on = df[df["condition"] == "residue_on"]
    off = df[df["condition"] == "residue_off"]
    placebo = df[df["condition"] == "residue_placebo"]

    # Primary: rolling_callback rate (proportion).
    cb_on = on["rolling_callback"].dropna().to_numpy(dtype=float)
    cb_off = off["rolling_callback"].dropna().to_numpy(dtype=float)
    cb_placebo = placebo["rolling_callback"].dropna().to_numpy(dtype=float)
    rate_on = float(cb_on.mean()) if cb_on.size else np.nan
    rate_off = float(cb_off.mean()) if cb_off.size else np.nan
    rate_placebo = float(cb_placebo.mean()) if cb_placebo.size else np.nan
    rd = risk_difference(rate_on, rate_off)
    _, rd_lo, rd_hi = bootstrap_diff_ci(cb_on, cb_off, seed=seed)
    _, rd_p = permutation_test_diff_means(cb_on, cb_off, seed=seed)
    if cb_placebo.size:
        rd_placebo = risk_difference(rate_on, rate_placebo)
        _, rd_placebo_lo, rd_placebo_hi = bootstrap_diff_ci(
            cb_on, cb_placebo, seed=seed
        )
        _, rd_placebo_p = permutation_test_diff_means(
            cb_on, cb_placebo, seed=seed
        )
    else:
        rd_placebo = np.nan
        rd_placebo_lo = np.nan
        rd_placebo_hi = np.nan
        rd_placebo_p = np.nan

    # Secondary: rule-based aftertaste proxy (historical key:
    # human_aftertaste_score).
    at_on = on["metric_human_aftertaste_score"].dropna().to_numpy(dtype=float) \
        if "metric_human_aftertaste_score" in on.columns else np.array([])
    at_off = off["metric_human_aftertaste_score"].dropna().to_numpy(dtype=float) \
        if "metric_human_aftertaste_score" in off.columns else np.array([])
    at_placebo = placebo["metric_human_aftertaste_score"].dropna().to_numpy(dtype=float) \
        if "metric_human_aftertaste_score" in placebo.columns else np.array([])
    at_mean_on = float(at_on.mean()) if at_on.size else np.nan
    at_mean_off = float(at_off.mean()) if at_off.size else np.nan
    at_mean_placebo = float(at_placebo.mean()) if at_placebo.size else np.nan
    at_diff, at_lo, at_hi = bootstrap_diff_ci(at_on, at_off, seed=seed)
    _, at_p = permutation_test_diff_means(at_on, at_off, seed=seed)
    at_delta = cliffs_delta(at_on, at_off)
    if at_placebo.size:
        at_diff_placebo, at_placebo_lo, at_placebo_hi = bootstrap_diff_ci(
            at_on, at_placebo, seed=seed
        )
        _, at_placebo_p = permutation_test_diff_means(
            at_on, at_placebo, seed=seed
        )
        at_placebo_delta = cliffs_delta(at_on, at_placebo)
    else:
        at_diff_placebo = np.nan
        at_placebo_lo = np.nan
        at_placebo_hi = np.nan
        at_placebo_p = np.nan
        at_placebo_delta = np.nan

    cb_cluster_values, cb_cluster_counts, cb_cluster_status = cluster_unit_values(
        df, "rolling_callback"
    )
    cb_cluster_off = cluster_contrast(
        cb_cluster_values, "residue_on", "residue_off", seed=seed
    )
    cb_cluster_placebo = cluster_contrast(
        cb_cluster_values, "residue_on", "residue_placebo", seed=seed
    )
    at_cluster_values, at_cluster_counts, at_cluster_status = cluster_unit_values(
        df, "metric_human_aftertaste_score"
    )
    at_cluster_off = cluster_contrast(
        at_cluster_values, "residue_on", "residue_off", seed=seed
    )
    at_cluster_placebo = cluster_contrast(
        at_cluster_values, "residue_on", "residue_placebo", seed=seed
    )

    res = {
        "n_on": int(len(on)),
        "n_off": int(len(off)),
        "n_placebo": int(len(placebo)),
        "callback_n_on": int(cb_on.size),
        "callback_n_off": int(cb_off.size),
        "callback_n_placebo": int(cb_placebo.size),
        "callback_rate_on": rate_on,
        "callback_rate_off": rate_off,
        "callback_rate_placebo": rate_placebo,
        "callback_risk_diff": rd,
        "callback_rd_ci_lo": rd_lo,
        "callback_rd_ci_hi": rd_hi,
        "callback_perm_p": rd_p,
        "callback_risk_diff_on_vs_placebo": rd_placebo,
        "callback_rd_on_vs_placebo_ci_lo": rd_placebo_lo,
        "callback_rd_on_vs_placebo_ci_hi": rd_placebo_hi,
        "callback_on_vs_placebo_perm_p": rd_placebo_p,
        "callback_cluster_status": cb_cluster_status,
        "callback_cluster_n_on": cb_cluster_counts.get("residue_on", 0),
        "callback_cluster_n_off": cb_cluster_counts.get("residue_off", 0),
        "callback_cluster_n_placebo": cb_cluster_counts.get("residue_placebo", 0),
        "callback_cluster_mean_diff": cb_cluster_off["mean_diff"],
        "callback_cluster_mean_diff_ci_lo": cb_cluster_off["ci_lo"],
        "callback_cluster_mean_diff_ci_hi": cb_cluster_off["ci_hi"],
        "callback_cluster_perm_p": cb_cluster_off["perm_p"],
        "callback_cluster_mean_diff_on_vs_placebo": cb_cluster_placebo["mean_diff"],
        "callback_cluster_mean_diff_on_vs_placebo_ci_lo": cb_cluster_placebo["ci_lo"],
        "callback_cluster_mean_diff_on_vs_placebo_ci_hi": cb_cluster_placebo["ci_hi"],
        "callback_cluster_on_vs_placebo_perm_p": cb_cluster_placebo["perm_p"],
        "aftertaste_mean_on": at_mean_on,
        "aftertaste_mean_off": at_mean_off,
        "aftertaste_mean_placebo": at_mean_placebo,
        "aftertaste_n_on": int(at_on.size),
        "aftertaste_n_off": int(at_off.size),
        "aftertaste_n_placebo": int(at_placebo.size),
        "aftertaste_diff": at_diff,
        "aftertaste_diff_ci_lo": at_lo,
        "aftertaste_diff_ci_hi": at_hi,
        "aftertaste_perm_p": at_p,
        "aftertaste_cliffs_delta": at_delta,
        "aftertaste_diff_on_vs_placebo": at_diff_placebo,
        "aftertaste_diff_on_vs_placebo_ci_lo": at_placebo_lo,
        "aftertaste_diff_on_vs_placebo_ci_hi": at_placebo_hi,
        "aftertaste_on_vs_placebo_perm_p": at_placebo_p,
        "aftertaste_on_vs_placebo_cliffs_delta": at_placebo_delta,
        "aftertaste_cluster_status": at_cluster_status,
        "aftertaste_cluster_n_on": at_cluster_counts.get("residue_on", 0),
        "aftertaste_cluster_n_off": at_cluster_counts.get("residue_off", 0),
        "aftertaste_cluster_n_placebo": at_cluster_counts.get("residue_placebo", 0),
        "aftertaste_cluster_mean_diff": at_cluster_off["mean_diff"],
        "aftertaste_cluster_mean_diff_ci_lo": at_cluster_off["ci_lo"],
        "aftertaste_cluster_mean_diff_ci_hi": at_cluster_off["ci_hi"],
        "aftertaste_cluster_perm_p": at_cluster_off["perm_p"],
        "aftertaste_cluster_mean_diff_on_vs_placebo": at_cluster_placebo["mean_diff"],
        "aftertaste_cluster_mean_diff_on_vs_placebo_ci_lo": at_cluster_placebo["ci_lo"],
        "aftertaste_cluster_mean_diff_on_vs_placebo_ci_hi": at_cluster_placebo["ci_hi"],
        "aftertaste_cluster_on_vs_placebo_perm_p": at_cluster_placebo["perm_p"],
        "aftertaste_variance_status": saturated_two_arm_status(at_on, at_off),
    }

    table_rows = [
        {
            "outcome": "rolling_callback_rate (primary)",
            "contrast": "residue_on_vs_residue_off",
            "residue_on": rate_on,
            "residue_off": rate_off,
            "residue_placebo": rate_placebo,
            "effect": rd,
            "effect_type": "risk_difference",
            "mean_diff": rd,
            "mean_diff_ci_lo": rd_lo,
            "mean_diff_ci_hi": rd_hi,
            "perm_p": rd_p,
            "cluster_n_on": cb_cluster_counts.get("residue_on", 0),
            "cluster_n_off": cb_cluster_counts.get("residue_off", 0),
            "cluster_n_placebo": cb_cluster_counts.get("residue_placebo", 0),
            "cluster_mean_diff": cb_cluster_off["mean_diff"],
            "cluster_mean_diff_ci_lo": cb_cluster_off["ci_lo"],
            "cluster_mean_diff_ci_hi": cb_cluster_off["ci_hi"],
            "cluster_perm_p": cb_cluster_off["perm_p"],
        },
        {
            "outcome": "rule_based_aftertaste_proxy (secondary)",
            "contrast": "residue_on_vs_residue_off",
            "residue_on": at_mean_on,
            "residue_off": at_mean_off,
            "residue_placebo": at_mean_placebo,
            "effect": at_delta,
            "effect_type": "cliffs_delta",
            "mean_diff": at_diff,
            "mean_diff_ci_lo": at_lo,
            "mean_diff_ci_hi": at_hi,
            "perm_p": at_p,
            "cluster_n_on": at_cluster_counts.get("residue_on", 0),
            "cluster_n_off": at_cluster_counts.get("residue_off", 0),
            "cluster_n_placebo": at_cluster_counts.get("residue_placebo", 0),
            "cluster_mean_diff": at_cluster_off["mean_diff"],
            "cluster_mean_diff_ci_lo": at_cluster_off["ci_lo"],
            "cluster_mean_diff_ci_hi": at_cluster_off["ci_hi"],
            "cluster_perm_p": at_cluster_off["perm_p"],
            "variance_status": res["aftertaste_variance_status"],
        },
    ]
    if cb_placebo.size > 0:
        table_rows.append(
            {
                "outcome": "rolling_callback_rate (primary)",
                "contrast": "residue_on_vs_residue_placebo",
                "residue_on": rate_on,
                "residue_off": rate_off,
                "residue_placebo": rate_placebo,
                "effect": rd_placebo,
                "effect_type": "risk_difference",
                "mean_diff": rd_placebo,
                "mean_diff_ci_lo": rd_placebo_lo,
                "mean_diff_ci_hi": rd_placebo_hi,
                "perm_p": rd_placebo_p,
                "cluster_n_on": cb_cluster_counts.get("residue_on", 0),
                "cluster_n_off": cb_cluster_counts.get("residue_off", 0),
                "cluster_n_placebo": cb_cluster_counts.get("residue_placebo", 0),
                "cluster_mean_diff": cb_cluster_placebo["mean_diff"],
                "cluster_mean_diff_ci_lo": cb_cluster_placebo["ci_lo"],
                "cluster_mean_diff_ci_hi": cb_cluster_placebo["ci_hi"],
                "cluster_perm_p": cb_cluster_placebo["perm_p"],
            }
        )
    if at_placebo.size > 0:
        table_rows.append(
            {
                "outcome": "rule_based_aftertaste_proxy (secondary)",
                "contrast": "residue_on_vs_residue_placebo",
                "residue_on": at_mean_on,
                "residue_off": at_mean_off,
                "residue_placebo": at_mean_placebo,
                "effect": at_placebo_delta,
                "effect_type": "cliffs_delta",
                "mean_diff": at_diff_placebo,
                "mean_diff_ci_lo": at_placebo_lo,
                "mean_diff_ci_hi": at_placebo_hi,
                "perm_p": at_placebo_p,
                "cluster_n_on": at_cluster_counts.get("residue_on", 0),
                "cluster_n_off": at_cluster_counts.get("residue_off", 0),
                "cluster_n_placebo": at_cluster_counts.get("residue_placebo", 0),
                "cluster_mean_diff": at_cluster_placebo["mean_diff"],
                "cluster_mean_diff_ci_lo": at_cluster_placebo["ci_lo"],
                "cluster_mean_diff_ci_hi": at_cluster_placebo["ci_hi"],
                "cluster_perm_p": at_cluster_placebo["perm_p"],
            }
        )
    table = pd.DataFrame(table_rows)
    results_dir = os.path.join(outdir, "results")
    os.makedirs(results_dir, exist_ok=True)
    table.to_csv(os.path.join(results_dir, "residue_ablation.csv"), index=False)

    callback_counts = {
        "residue_on": cb_on.size,
        "residue_off": cb_off.size,
    }
    if len(placebo) > 0:
        callback_counts["residue_placebo"] = cb_placebo.size
    small_callback_arms = {
        arm: count for arm, count in callback_counts.items() if count < 30
    }
    if small_callback_arms:
        counts = ", ".join(
            "{}={}".format(arm, count) for arm, count in small_callback_arms.items()
        )
        print(
            "PILOT_SAMPLE_WARNING: residue ablation has fewer than 30 "
            "callback-window rows in arm(s): {}; inferential rows are "
            "sanity statistics, not completed empirical evidence.".format(counts),
            file=sys.stderr,
        )

    md = [
        "# B. Residue ablation",
        "",
        "n(residue_on)={}, n(residue_off)={}, n(residue_placebo)={}.".format(
            len(on), len(off), len(placebo)
        ),
        "Permutation test: {} permutations, seed={}, two-sided.".format(N_PERM, seed),
        "Bootstrap difference CI: {} resamples.".format(N_BOOT),
        "",
        "The `residue_on_vs_residue_placebo` contrast is the primary mechanism",
        "contrast only after the placebo arm has been preregistered and accepted",
        "before collection. Before that acceptance, treat any placebo rows as",
        "exploratory plumbing/sanity evidence. `residue_on_vs_residue_off` remains",
        "a sensitivity contrast because OFF removes the whole prompt block.",
        "",
        "If both accepted contrasts are reported, the fixed primary contrast is",
        "on-vs-placebo and on-vs-off is sensitivity; no multiplicity adjustment is",
        "applied by this script.",
        "",
        "For the continuous secondary outcome the effect is Cliff's delta;",
        "for the binary primary outcome the effect is the risk difference.",
        "`mean_diff_ci_lo` / `mean_diff_ci_hi` are two-sample bootstrap CIs for",
        "the mean difference, not CIs for Cliff's delta.",
        "",
        "`cluster_*` columns aggregate rows to `pair|source_run|window` cluster",
        "means before computing the same mean-difference bootstrap and",
        "permutation statistics. Confirmatory reporting requires accepted",
        "preregistration plus complete cluster metadata; row-level p-values remain",
        "sanity statistics.",
        "",
        df_to_md(table),
        "",
    ]
    with open(os.path.join(results_dir, "residue_ablation.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md))
    return res


# ---------------------------------------------------------------------------
# Analysis C: annotation agreement + convergent validity
# ---------------------------------------------------------------------------
def analysis_annotation_agreement(
    ann: pd.DataFrame,
    ds: pd.DataFrame,
    outdir: str,
    marker_dim: str = "human_aftertaste_score",
    human_dim: str = "emotional_binding",
    seed: int = SEED,
) -> dict:
    raters = sorted(ann["rater"].unique())
    n_raters = len(raters)

    agreement_rows = []
    for dim in LIKERT_DIMS:
        if n_raters == 2:
            # Cohen's quadratic-weighted kappa on paired (case x rater) ratings.
            wide = ann.pivot_table(
                index="case_name", columns="rater", values=dim, aggfunc="mean"
            )
            r1 = wide[raters[0]].to_numpy(dtype=float)
            r2 = wide[raters[1]].to_numpy(dtype=float)
            stat = cohens_quadratic_weighted_kappa(r1, r2)
            method = "cohen_quadratic_weighted_kappa"
        else:
            # Krippendorff ordinal alpha: build (n_raters, n_units) matrix.
            wide = ann.pivot_table(
                index="case_name", columns="rater", values=dim, aggfunc="mean"
            )
            mat = wide.to_numpy(dtype=float).T  # raters x units
            stat = krippendorff_ordinal_alpha(mat)
            method = "krippendorff_ordinal_alpha"
        agreement_rows.append(
            {"dim": dim, "method": method, "n_raters": n_raters, "statistic": stat}
        )
    agreement = pd.DataFrame(agreement_rows)

    # Convergent validity: Spearman( machine marker , mean human rating ).
    marker_col = f"metric_{marker_dim}"
    human_mean = (
        ann.groupby("case_name")[human_dim].mean().rename("human_mean").reset_index()
    )
    if marker_col in ds.columns:
        machine = ds[["case_name", marker_col]].rename(columns={marker_col: "machine"})
    else:
        machine = pd.DataFrame(columns=["case_name", "machine"])
    merged = pd.merge(machine, human_mean, on="case_name", how="inner").dropna()
    if len(merged) >= 3 and merged["machine"].nunique() > 1 and merged["human_mean"].nunique() > 1:
        rho, p = scipy_stats.spearmanr(merged["machine"], merged["human_mean"])
        rho, p = float(rho), float(p)
    else:
        rho, p = np.nan, np.nan

    convergent = pd.DataFrame(
        [
            {
                "machine_marker": marker_dim,
                "human_dim": human_dim,
                "n_cases": int(len(merged)),
                "spearman_rho": rho,
                "spearman_p": p,
            }
        ]
    )

    results_dir = os.path.join(outdir, "results")
    os.makedirs(results_dir, exist_ok=True)
    agreement.to_csv(
        os.path.join(results_dir, "annotation_agreement.csv"), index=False
    )
    convergent.to_csv(
        os.path.join(results_dir, "convergent_validity.csv"), index=False
    )

    md = [
        "# C. Metric validity / annotation agreement",
        "",
        "## Inter-rater agreement",
        "",
        "{} raters detected. ".format(n_raters)
        + (
            "Two raters -> Cohen's quadratic-weighted kappa."
            if n_raters == 2
            else "More than two raters -> Krippendorff's ordinal alpha."
        ),
        "",
        df_to_md(agreement),
        "",
        "## Convergent validity (Spearman)",
        "",
        "Machine marker `{}` vs mean human `{}` per case.".format(display_label(marker_dim), human_dim),
        "",
        df_to_md(convergent),
        "",
    ]
    with open(
        os.path.join(results_dir, "annotation_agreement.md"), "w", encoding="utf-8"
    ) as fh:
        fh.write("\n".join(md))

    return {
        "agreement": agreement,
        "convergent": convergent,
        "n_raters": n_raters,
        "spearman_rho": rho,
        "spearman_p": p,
    }


# ---------------------------------------------------------------------------
# Analysis D: figures (guarded)
# ---------------------------------------------------------------------------
def make_figures(
    soul_table: pd.DataFrame, ablation: dict, outdir: str
) -> Optional[str]:
    """Produce the two figures. Returns None if successful, else a note string
    explaining why figures were skipped."""
    if not HAVE_MPL:
        return "matplotlib unavailable -> figures skipped"
    fig_dir = os.path.join(outdir, "results", "figures")
    os.makedirs(fig_dir, exist_ok=True)

    # Figure A: bar chart of overall marker means with CIs.
    overall = soul_table[soul_table["scope"] == "overall"]
    if len(overall):
        markers = [display_label(marker) for marker in overall["marker"].tolist()]
        means = overall["mean"].to_numpy(dtype=float)
        lo = overall["ci_lo"].to_numpy(dtype=float)
        hi = overall["ci_hi"].to_numpy(dtype=float)
        yerr = np.vstack([means - lo, hi - means])
        fig, ax = plt.subplots(figsize=(max(6, len(markers) * 1.2), 4))
        x = np.arange(len(markers))
        ax.bar(x, means, yerr=yerr, capsize=4, color="#4C72B0")
        ax.set_xticks(x)
        ax.set_xticklabels(markers, rotation=30, ha="right", fontsize=8)
        ax.set_ylabel("mean (0..1)")
        ax.set_title("Soul-uniqueness markers (mean +/- 95% bootstrap CI)")
        fig.tight_layout()
        fig.savefig(os.path.join(fig_dir, "marker_means.png"), dpi=120)
        plt.close(fig)

    # Figure B: residue arms for both outcomes.
    fig, ax = plt.subplots(figsize=(6, 4))
    labels = ["rolling_callback_rate", "aftertaste_proxy_mean"]
    arm_series = [
        ("residue_on", [ablation["callback_rate_on"], ablation["aftertaste_mean_on"]], "#55A868"),
        ("residue_off", [ablation["callback_rate_off"], ablation["aftertaste_mean_off"]], "#C44E52"),
    ]
    if ablation.get("n_placebo", 0) > 0:
        arm_series.append(
            (
                "residue_placebo",
                [ablation["callback_rate_placebo"], ablation["aftertaste_mean_placebo"]],
                "#4C72B0",
            )
        )
    x = np.arange(len(labels))
    w = 0.8 / len(arm_series)
    offsets = np.linspace(-0.4 + w / 2, 0.4 - w / 2, len(arm_series))
    for offset, (label, values, color) in zip(offsets, arm_series):
        ax.bar(x + offset, values, w, label=label, color=color)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel("value")
    ax.set_title("Residue ablation arms")
    ax.legend()
    fig.tight_layout()
    fig.savefig(os.path.join(fig_dir, "residue_ablation.png"), dpi=120)
    plt.close(fig)
    return None


# ---------------------------------------------------------------------------
# Analysis E: summary.md
# ---------------------------------------------------------------------------
def write_summary(
    outdir: str,
    soul_table: pd.DataFrame,
    ablation: dict,
    agreement: dict,
    fig_note: Optional[str],
    marker_dim: str,
    human_dim: str,
) -> None:
    results_dir = os.path.join(outdir, "results")
    os.makedirs(results_dir, exist_ok=True)

    lines = ["# Paper analysis summary", ""]

    # A readout.
    overall = soul_table[soul_table["scope"] == "overall"]
    lines.append("## A. Soul-uniqueness markers")
    lines.append("")
    for _, r in overall.iterrows():
        lines.append(
            "- **{}**: mean {:.3f} (95% CI {:.3f}-{:.3f}, n={}).".format(
                display_label(r["marker"]), r["mean"], r["ci_lo"], r["ci_hi"], int(r["n"])
            )
        )
    lines.append("")

    # B readout.
    lines.append("## B. Residue ablation")
    lines.append("")
    lines.append(
        "- sample counts: residue_on={}, residue_off={}, residue_placebo={}.".format(
            ablation["n_on"], ablation["n_off"], ablation.get("n_placebo", 0)
        )
    )
    lines.append(
        "- callback-window denominators: residue_on={}, residue_off={}, residue_placebo={}.".format(
            ablation.get("callback_n_on", 0),
            ablation.get("callback_n_off", 0),
            ablation.get("callback_n_placebo", 0),
        )
    )
    lines.append(
        "- callback cluster units (`pair|source_run|window`): residue_on={}, residue_off={}, "
        "residue_placebo={} (status: {}).".format(
            ablation.get("callback_cluster_n_on", 0),
            ablation.get("callback_cluster_n_off", 0),
            ablation.get("callback_cluster_n_placebo", 0),
            ablation.get("callback_cluster_status", "unknown"),
        )
    )
    lines.append(
        "- residue_on rolling-callback rate {:.3f} vs residue_off {:.3f} "
        "(risk diff {:+.3f}, 95% CI {:.3f}-{:.3f}, permutation p={:.4f}).".format(
            ablation["callback_rate_on"],
            ablation["callback_rate_off"],
            ablation["callback_risk_diff"],
            ablation["callback_rd_ci_lo"],
            ablation["callback_rd_ci_hi"],
            ablation["callback_perm_p"],
        )
    )
    if (
        ablation.get("callback_cluster_n_on", 0) > 0
        and ablation.get("callback_cluster_n_off", 0) > 0
    ):
        lines.append(
            "- cluster-unit callback on-vs-off mean diff {:+.3f} "
            "(95% CI {:.3f}-{:.3f}, permutation p={:.4f}).".format(
                ablation["callback_cluster_mean_diff"],
                ablation["callback_cluster_mean_diff_ci_lo"],
                ablation["callback_cluster_mean_diff_ci_hi"],
                ablation["callback_cluster_perm_p"],
            )
        )
    if ablation.get("callback_n_placebo", 0) > 0:
        lines.append(
            "- placebo-arm contrast (confirmatory only if preregistered and accepted "
            "before collection): residue_on rolling-callback rate {:.3f} vs "
            "residue_placebo {:.3f} (risk diff {:+.3f}, 95% CI {:.3f}-{:.3f}, "
            "permutation p={:.4f}).".format(
                ablation["callback_rate_on"],
                ablation["callback_rate_placebo"],
                ablation["callback_risk_diff_on_vs_placebo"],
                ablation["callback_rd_on_vs_placebo_ci_lo"],
                ablation["callback_rd_on_vs_placebo_ci_hi"],
                ablation["callback_on_vs_placebo_perm_p"],
            )
        )
        if (
            ablation.get("callback_cluster_n_on", 0) > 0
            and ablation.get("callback_cluster_n_placebo", 0) > 0
        ):
            lines.append(
                "- cluster-unit callback on-vs-placebo mean diff {:+.3f} "
                "(95% CI {:.3f}-{:.3f}, permutation p={:.4f}).".format(
                    ablation["callback_cluster_mean_diff_on_vs_placebo"],
                    ablation["callback_cluster_mean_diff_on_vs_placebo_ci_lo"],
                    ablation["callback_cluster_mean_diff_on_vs_placebo_ci_hi"],
                    ablation["callback_cluster_on_vs_placebo_perm_p"],
                )
            )
    elif ablation.get("n_placebo", 0) > 0:
        lines.append(
            "- placebo rows exist, but none have non-null rolling_callback values; "
            "the callback placebo contrast is not computable."
        )
    lines.append(
        "- rule-based aftertaste proxy mean {:.3f} (on) vs {:.3f} (off); "
        "Cliff's delta {:+.3f}, mean-diff 95% CI {:.3f}-{:.3f}, "
        "permutation p={:.4f}; variance status: {}.".format(
            ablation["aftertaste_mean_on"],
            ablation["aftertaste_mean_off"],
            ablation["aftertaste_cliffs_delta"],
            ablation["aftertaste_diff_ci_lo"],
            ablation["aftertaste_diff_ci_hi"],
            ablation["aftertaste_perm_p"],
            ablation.get("aftertaste_variance_status", "unknown"),
        )
    )
    if ablation.get("aftertaste_variance_status") == "saturated_no_usable_variance":
        lines.append(
            "- The rule-based aftertaste proxy is saturated across on/off arms; "
            "the secondary aftertaste contrast is not informative evidence."
        )
    if ablation.get("aftertaste_n_placebo", 0) > 0:
        lines.append(
            "- rule-based aftertaste proxy on-vs-placebo Cliff's delta {:+.3f}, "
            "mean-diff 95% CI {:.3f}-{:.3f}, permutation p={:.4f}.".format(
                ablation["aftertaste_on_vs_placebo_cliffs_delta"],
                ablation["aftertaste_diff_on_vs_placebo_ci_lo"],
                ablation["aftertaste_diff_on_vs_placebo_ci_hi"],
                ablation["aftertaste_on_vs_placebo_perm_p"],
            )
        )
    elif ablation.get("n_placebo", 0) > 0:
        lines.append(
            "- placebo rows exist, but none have the aftertaste proxy; the "
            "aftertaste placebo contrast is not computable."
        )
    direction = (
        "residue_on > residue_off"
        if ablation["callback_rate_on"] > ablation["callback_rate_off"]
        else "residue_on <= residue_off"
    )
    lines.append("- Observed direction: {}.".format(direction))
    if ablation.get("callback_n_placebo", 0) > 0:
        mechanism_direction = (
            "residue_on > residue_placebo"
            if ablation["callback_rate_on"] > ablation["callback_rate_placebo"]
            else "residue_on <= residue_placebo"
        )
        lines.append(
            "- Observed placebo callback direction: {}.".format(mechanism_direction)
        )
    lines.append(
        "- Row-level p-values remain sanity statistics; confirmatory reporting "
        "requires accepted preregistration plus complete cluster metadata and "
        "cluster-unit analysis."
    )
    lines.append("")

    # C readout.
    lines.append("## C. Annotation agreement & convergent validity")
    lines.append("")
    for _, r in agreement["agreement"].iterrows():
        lines.append(
            "- {} ({}): {:.3f}.".format(r["dim"], r["method"], r["statistic"])
        )
    rho = agreement["spearman_rho"]
    p = agreement["spearman_p"]
    if np.isnan(rho):
        lines.append(
            "- Convergent validity (Spearman, `{}` vs human `{}`): not computable "
            "(insufficient overlap/variance).".format(display_label(marker_dim), human_dim)
        )
    else:
        lines.append(
            "- Convergent validity: Spearman rho {:.3f} (p={:.4f}) between machine "
            "`{}` and mean human `{}`.".format(rho, p, display_label(marker_dim), human_dim)
        )
    lines.append("")

    # D note.
    lines.append("## D. Figures")
    lines.append("")
    if fig_note:
        lines.append("- {}".format(fig_note))
    else:
        lines.append("- results/figures/marker_means.png")
        lines.append("- results/figures/residue_ablation.png")
    lines.append("")

    with open(os.path.join(results_dir, "summary.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


# ---------------------------------------------------------------------------
# Pipeline driver
# ---------------------------------------------------------------------------
def run_pipeline(
    dataset_path: str,
    annotations_path: Optional[str],
    outdir: str,
    marker_dim: str = "human_aftertaste_score",
    human_dim: str = "emotional_binding",
    seed: int = SEED,
) -> dict:
    ds = load_dataset(dataset_path)
    soul_table = analysis_soul_uniqueness(ds, outdir, seed=seed)
    ablation = analysis_residue_ablation(ds, outdir, seed=seed)

    if annotations_path and os.path.exists(annotations_path):
        ann = load_annotations(annotations_path)
        agreement = analysis_annotation_agreement(
            ann, ds, outdir, marker_dim=marker_dim, human_dim=human_dim, seed=seed
        )
    else:
        # Still emit an empty agreement structure so summary works.
        agreement = {
            "agreement": pd.DataFrame(
                columns=["dim", "method", "n_raters", "statistic"]
            ),
            "convergent": pd.DataFrame(),
            "n_raters": 0,
            "spearman_rho": np.nan,
            "spearman_p": np.nan,
        }

    fig_note = make_figures(soul_table, ablation, outdir)
    write_summary(
        outdir, soul_table, ablation, agreement, fig_note, marker_dim, human_dim
    )
    return {
        "soul_table": soul_table,
        "ablation": ablation,
        "agreement": agreement,
        "fig_note": fig_note,
    }


# ---------------------------------------------------------------------------
# Synthetic fixture generator (used by --selftest)
# ---------------------------------------------------------------------------
def generate_synthetic_fixtures(
    out_dir: str, seed: int = SEED
) -> tuple[str, str]:
    """Generate dataset.json + annotations.csv with a PLANTED residue effect
    (residue_on has higher rolling_callback rate and aftertaste than both the
    placebo and off arms) and a PLANTED rater agreement on emotional_binding.
    Returns (dataset_path, ann_path)."""
    rng = np.random.default_rng(seed)
    os.makedirs(out_dir, exist_ok=True)

    pairs = ["Mahiru-Umi", "Alan-Umi", "Kanna-Mahiru"]
    markers = DEFAULT_MARKERS
    records = []
    case_id = 0
    # For each pair, several cases per condition.
    for pair in pairs:
        names = pair.split("-")
        for condition in ["residue_on", "residue_placebo", "residue_off"]:
            for trial_idx in range(12):
                case_id += 1
                case_name = f"case_{case_id:03d}"
                # Planted effect: on > placebo > off.
                cb_p = {
                    "residue_on": 0.70,
                    "residue_placebo": 0.35,
                    "residue_off": 0.15,
                }[condition]
                rolling_callback = int(rng.random() < cb_p)
                # Aftertaste higher under residue_on, intermediate under placebo.
                base_at = {
                    "residue_on": 0.72,
                    "residue_placebo": 0.55,
                    "residue_off": 0.45,
                }[condition]
                metrics = {}
                for m in markers:
                    if m == "human_aftertaste_score":
                        v = base_at + rng.normal(0, 0.08)
                    elif m.endswith("_penalty"):
                        # penalties lower is better; small values
                        v = abs(rng.normal(0.12, 0.05))
                    else:
                        v = 0.6 + rng.normal(0, 0.1)
                    metrics[m] = float(np.clip(v, 0.0, 1.0))
                overall = float(np.clip(np.mean(list(metrics.values())), 0, 1))
                status = "PASS" if overall >= 0.5 else "WARN"
                records.append(
                    {
                        "case_name": case_name,
                        "pair": pair,
                        "speaker": names[0],
                        "target": names[1],
                        "condition": condition,
                        "window": f"window_{trial_idx // 4}",
                        "source_run": f"run_{condition}_{trial_idx // 4}",
                        "collection_day": f"day_{trial_idx // 4}",
                        "overall_score": overall,
                        "status": status,
                        "metrics": metrics,
                        "rolling_callback": rolling_callback,
                        "residue_candidate": int(rng.random() < 0.5),
                    }
                )

    dataset_path = os.path.join(out_dir, "dataset.json")
    with open(dataset_path, "w", encoding="utf-8") as fh:
        json.dump(records, fh, indent=2)

    # Annotations: 2 raters, planted agreement on emotional_binding.
    # We tie emotional_binding to the case's aftertaste so it also gives
    # convergent validity, and make raters agree closely (quadratic kappa > 0.4).
    ann_rows = []
    raters = ["raterA", "raterB"]
    for rec in records:
        at = rec["metrics"]["human_aftertaste_score"]
        # latent true emotional binding 1..5 from aftertaste
        true_eb = int(np.clip(round(1 + 4 * at), 1, 5))
        for rater in raters:
            # raters agree on emotional_binding (tiny noise) -> high kappa
            eb = int(np.clip(true_eb + rng.integers(-1, 2) * (rng.random() < 0.25), 1, 5))
            # other dims more noisy
            nat = int(np.clip(true_eb + rng.integers(-1, 2), 1, 5))
            cc = int(np.clip(true_eb + rng.integers(-1, 2), 1, 5))
            rep = int(np.clip(6 - true_eb + rng.integers(-1, 2), 1, 5))
            ann_rows.append(
                {
                    "case_name": rec["case_name"],
                    "rater": rater,
                    "naturalness": nat,
                    "emotional_binding": eb,
                    "character_consistency": cc,
                    "repetition": rep,
                }
            )
    ann_path = os.path.join(out_dir, "annotations.csv")
    pd.DataFrame(ann_rows).to_csv(ann_path, index=False)
    return dataset_path, ann_path


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------
def selftest() -> int:
    """Generate synthetic data with planted effects, run the pipeline, and
    assert correctness. Returns process exit code (0 = PASS)."""
    failures = []
    tmp = tempfile.mkdtemp(prefix="paper_selftest_")
    fixture_dir = os.path.join(tmp, "fixtures")
    outdir = os.path.join(tmp, "selftest_out")
    try:
        ds_path, ann_path = generate_synthetic_fixtures(fixture_dir)
        res = run_pipeline(ds_path, ann_path, outdir)

        worksheet_path = os.path.join(fixture_dir, "annotation_sheet.csv")
        pd.DataFrame(
            [
                {
                    "blind_id": "ER-0001",
                    "case_ref": "ER-0001",
                    "naturalness": "",
                    "emotional_binding": "",
                    "character_consistency": "",
                    "repetition": "",
                    "notes": "",
                }
            ]
        ).to_csv(worksheet_path, index=False)
        try:
            load_annotations(worksheet_path)
            failures.append("blinded worksheet was accepted as annotations.csv")
        except ValueError as exc:
            if "merge_rater_annotations.py" not in str(exc):
                failures.append(
                    "blinded worksheet error did not mention merge_rater_annotations.py"
                )

        # 1. All expected output files exist.
        expected = [
            "results/soul_uniqueness.csv",
            "results/soul_uniqueness.md",
            "results/residue_ablation.csv",
            "results/residue_ablation.md",
            "results/annotation_agreement.csv",
            "results/annotation_agreement.md",
            "results/convergent_validity.csv",
            "results/summary.md",
        ]
        for rel in expected:
            path = os.path.join(outdir, rel)
            if not os.path.exists(path):
                failures.append(f"missing output file: {rel}")
        # Figures expected only if matplotlib present.
        if HAVE_MPL:
            for rel in [
                "results/figures/marker_means.png",
                "results/figures/residue_ablation.png",
            ]:
                if not os.path.exists(os.path.join(outdir, rel)):
                    failures.append(f"missing figure: {rel}")

        # 2. Ablation recovers correct direction (residue_on > residue_off).
        abl = res["ablation"]
        if not (abl["callback_rate_on"] > abl["callback_rate_off"]):
            failures.append(
                "ablation direction wrong: on={:.3f} off={:.3f}".format(
                    abl["callback_rate_on"], abl["callback_rate_off"]
                )
            )
        if abl["n_placebo"] <= 0:
            failures.append("placebo fixture rows missing")
        if not (abl["callback_rate_on"] > abl["callback_rate_placebo"]):
            failures.append(
                "placebo direction wrong: on={:.3f} placebo={:.3f}".format(
                    abl["callback_rate_on"], abl["callback_rate_placebo"]
                )
            )
        # Permutation test should detect the planted effect.
        if not (abl["callback_perm_p"] < 0.05):
            failures.append(
                "permutation p not significant: {:.4f}".format(abl["callback_perm_p"])
            )
        # Cliff's delta on aftertaste should be positive (on > off).
        if not (abl["aftertaste_cliffs_delta"] > 0):
            failures.append(
                "aftertaste cliffs delta not positive: {:.3f}".format(
                    abl["aftertaste_cliffs_delta"]
                )
            )
        if not (abl["aftertaste_on_vs_placebo_cliffs_delta"] > 0):
            failures.append(
                "aftertaste on-vs-placebo cliffs delta not positive: {:.3f}".format(
                    abl["aftertaste_on_vs_placebo_cliffs_delta"]
                )
            )
        if not (
            abl["callback_cluster_n_on"] > 0 and abl["callback_cluster_n_off"] > 0
        ):
            failures.append(
                "cluster callback units missing: on={} off={}".format(
                    abl["callback_cluster_n_on"], abl["callback_cluster_n_off"]
                )
            )
        if not (abl["callback_cluster_mean_diff"] > 0):
            failures.append(
                "cluster callback on-vs-off diff not positive: {:.3f}".format(
                    abl["callback_cluster_mean_diff"]
                )
            )

        # 2b. Saturated secondary outcomes must be explicitly labeled.
        saturated_fixture_dir = os.path.join(tmp, "saturated_fixtures")
        saturated_outdir = os.path.join(tmp, "saturated_out")
        os.makedirs(saturated_fixture_dir, exist_ok=True)
        with open(ds_path, "r", encoding="utf-8") as fh:
            saturated_records = json.load(fh)
        for rec in saturated_records:
            if rec["condition"] in {"residue_on", "residue_off"}:
                rec["metrics"]["human_aftertaste_score"] = 1.0
        saturated_ds_path = os.path.join(saturated_fixture_dir, "dataset.json")
        with open(saturated_ds_path, "w", encoding="utf-8") as fh:
            json.dump(saturated_records, fh, indent=2)
        saturated_res = run_pipeline(saturated_ds_path, ann_path, saturated_outdir)
        saturated_status = saturated_res["ablation"]["aftertaste_variance_status"]
        if saturated_status != "saturated_no_usable_variance":
            failures.append(
                "saturated aftertaste status missing: {}".format(saturated_status)
            )
        saturated_summary_path = os.path.join(
            saturated_outdir, "results", "summary.md"
        )
        saturated_summary = open(
            saturated_summary_path, "r", encoding="utf-8"
        ).read()
        if "saturated_no_usable_variance" not in saturated_summary:
            failures.append("saturated summary did not label aftertaste saturation")

        # 3. Kappa > 0.4 on the planted-agreement dim (emotional_binding).
        agr = res["agreement"]["agreement"]
        eb_row = agr[agr["dim"] == "emotional_binding"]
        if len(eb_row) == 0:
            failures.append("no agreement statistic for emotional_binding")
        else:
            stat = float(eb_row["statistic"].iloc[0])
            if not (stat > 0.4):
                failures.append(
                    "emotional_binding agreement <= 0.4: {:.3f}".format(stat)
                )

        # 4. Convergent validity should be positive & detectable (sanity).
        rho = res["agreement"]["spearman_rho"]
        if np.isnan(rho) or rho <= 0:
            failures.append(
                "convergent validity not positive: rho={}".format(rho)
            )

        # Print key recovered statistics for transparency.
        print("--- selftest recovered statistics ---")
        print(
            "callback rate on={:.3f} placebo={:.3f} off={:.3f} "
            "on-off risk_diff={:+.3f} perm_p={:.4f}".format(
                abl["callback_rate_on"],
                abl["callback_rate_placebo"],
                abl["callback_rate_off"],
                abl["callback_risk_diff"],
                abl["callback_perm_p"],
            )
        )
        print(
            "cluster callback units on={} placebo={} off={} "
            "on-off mean_diff={:+.3f} perm_p={:.4f}".format(
                abl["callback_cluster_n_on"],
                abl["callback_cluster_n_placebo"],
                abl["callback_cluster_n_off"],
                abl["callback_cluster_mean_diff"],
                abl["callback_cluster_perm_p"],
            )
        )
        print(
            "aftertaste mean on={:.3f} placebo={:.3f} off={:.3f} "
            "on-off cliffs_delta={:+.3f} perm_p={:.4f}".format(
                abl["aftertaste_mean_on"],
                abl["aftertaste_mean_placebo"],
                abl["aftertaste_mean_off"],
                abl["aftertaste_cliffs_delta"],
                abl["aftertaste_perm_p"],
            )
        )
        if len(eb_row):
            print(
                "emotional_binding agreement ({})={:.3f}".format(
                    eb_row["method"].iloc[0], float(eb_row["statistic"].iloc[0])
                )
            )
        print("convergent validity spearman rho={:.3f} p={:.4f}".format(
            res["agreement"]["spearman_rho"], res["agreement"]["spearman_p"]
        ))
        print("outputs written under:", os.path.join(outdir, "results"))
        print("matplotlib available:", HAVE_MPL)
        print("-------------------------------------")

    except Exception as exc:  # surface unexpected errors as failures
        import traceback

        traceback.print_exc()
        failures.append(f"exception during selftest: {exc}")

    if failures:
        print("SELFTEST: FAIL")
        for f in failures:
            print("  -", f)
        return 1
    print("SELFTEST: PASS")
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Data-analysis pipeline for the soul/residue paper."
    )
    p.add_argument("--dataset", help="path to dataset.json")
    p.add_argument("--annotations", help="path to annotations.csv", default=None)
    p.add_argument(
        "--outdir",
        default=os.path.join("scripts", "paper", "results"),
        help="output directory (results/ is created beneath its parent); "
        "default scripts/paper/results",
    )
    p.add_argument(
        "--marker-dim",
        default="human_aftertaste_score",
        help="machine marker for convergent validity (default human_aftertaste_score)",
    )
    p.add_argument(
        "--human-dim",
        default="emotional_binding",
        help="human Likert dim for convergent validity (default emotional_binding)",
    )
    p.add_argument(
        "--selftest",
        action="store_true",
        help="run synthetic self-test and exit",
    )
    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    if args.selftest:
        return selftest()
    if not args.dataset:
        print("error: --dataset is required (or use --selftest)", file=sys.stderr)
        return 2

    # The contract says outputs go under <outdir>/results/. The default outdir
    # already ends in results/, so normalize: we always write to
    # os.path.join(base, "results"). If the user points --outdir at
    # ".../results" we treat its parent as the base to avoid results/results.
    outdir = args.outdir
    if os.path.basename(os.path.normpath(outdir)) == "results":
        base = os.path.dirname(os.path.normpath(outdir))
        if base == "":
            base = "."
    else:
        base = outdir
    os.makedirs(os.path.join(base, "results"), exist_ok=True)

    run_pipeline(
        args.dataset,
        args.annotations,
        base,
        marker_dim=args.marker_dim,
        human_dim=args.human_dim,
    )
    print("Analysis complete. Outputs under:", os.path.join(base, "results"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

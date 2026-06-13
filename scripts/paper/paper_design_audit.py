#!/usr/bin/env python3
"""Audit causal/design readiness for the emotional-residue experiment.

This gate distinguishes a conservative design/systems preprint from a completed
causal or mechanism paper. It is static/read-only: no collection, no Convex env
mutation, no external actions.
"""

from __future__ import annotations

import argparse
import json
import re
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "docs/paper/emotional-residue/results/design-audit.md"


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def has(text: str, phrase: str) -> bool:
    normalized_text = " ".join(text.lower().split())
    normalized_phrase = " ".join(phrase.lower().split())
    return normalized_phrase in normalized_text


def audit_design(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    schedule_path = root / "docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md"
    longitudinal_path = root / "docs/paper/emotional-residue/experiments/LONGITUDINAL_EXPERIMENT_PLAN.md"
    prereg_path = root / "docs/paper/emotional-residue/experiments/PREREGISTRATION_PROTOCOL.md"
    main_path = root / "docs/paper/emotional-residue/manuscript/main.tex"
    acceptance_path = root / "docs/paper/emotional-residue/experiments/SCHEDULE_ACCEPTANCE.json"
    preregistration_acceptance_path = root / "docs/paper/emotional-residue/experiments/PREREGISTRATION_ACCEPTANCE.json"
    power_path = root / "docs/paper/emotional-residue/results/power/summary.md"
    cluster_power_path = root / "docs/paper/emotional-residue/results/power/cluster_power_grid.csv"
    annotation_sheet_path = root / "docs/paper/emotional-residue/results/longitudinal/annotation_sheet.csv"
    analyze_path = root / "scripts/paper/analyze.py"

    required = [
        schedule_path,
        longitudinal_path,
        prereg_path,
        main_path,
        acceptance_path,
        preregistration_acceptance_path,
        power_path,
        cluster_power_path,
        annotation_sheet_path,
        analyze_path,
    ]
    for path in required:
        if not path.exists():
            add(findings, "FAIL", "required_file", f"Missing {path.relative_to(root)}")
    if any(f.severity == "FAIL" for f in findings):
        return findings

    schedule = read(schedule_path)
    longitudinal = read(longitudinal_path)
    prereg = read(prereg_path)
    main_text = read(main_path)
    power = read(power_path)
    analyze_text = read(analyze_path)
    acceptance = json.loads(read(acceptance_path))
    preregistration_acceptance = json.loads(read(preregistration_acceptance_path))
    annotation_rows = max(len(annotation_sheet_path.read_text(encoding="utf-8").splitlines()) - 1, 0)
    combined_design_text = "\n".join([schedule, longitudinal, prereg, main_text])

    required_design_phrases = [
        ("arm-pure full-day / long-window collection", "arm_pure_design"),
        ("rolling_callback_rate", "primary_outcome"),
        ("callback-window denominator", "denominator_policy"),
        ("No optional stopping based on p-values", "stopping_rule"),
        ("pre-register final N", "mde_final_n"),
        ("cluster-aware analysis", "cluster_caveat"),
        ("length-matched placebo", "placebo_boundary"),
        ("narrowed mechanism claim", "placebo_boundary"),
        ("read-off alone isolates residue content from prompt length or prompt shape", "forbidden_mechanism_wording"),
        ("run-level `generation_metadata`", "generation_metadata"),
        ("trace-to-dialogue overlap", "trace_overlap"),
        ("At least 2 raters", "annotation_minimum"),
        ("preregistration_status:", "preregistration_status"),
        ("accepted_schedule_required: true", "accepted_schedule_required"),
        ("placebo_arm_status:", "placebo_status"),
        ("current_mechanism_claim: narrowed_read_block_suppression", "mechanism_claim_status"),
        ("Inclusion Criteria", "inclusion_criteria"),
        ("Exclusion Criteria", "exclusion_criteria"),
        ("Deviation Policy", "deviation_policy"),
        ("no_arm_extension_after_effect_peeking: true", "stopping_rule"),
    ]
    for phrase, check in required_design_phrases:
        if not has(combined_design_text, phrase):
            add(findings, "FAIL", check, f"Missing design boundary phrase: {phrase}")

    if acceptance.get("accepted") is not True:
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "schedule_acceptance",
            "Arm-pure collection schedule is not accepted; causal collection remains paused.",
        )

    if has(prereg, "preregistration_status: draft_not_accepted"):
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "preregistration_not_accepted",
            "Preregistration protocol is still a draft and has not been accepted before collection.",
        )
    if (
        preregistration_acceptance.get("accepted") is not True
        or not preregistration_acceptance.get("accepted_by")
        or not preregistration_acceptance.get("accepted_at")
    ):
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "preregistration_acceptance",
            "Preregistration acceptance JSON is not accepted; causal collection remains paused.",
        )

    if not re.search(r"n>=150/arm|n\s*>=\s*150/arm|n≈250/arm", combined_design_text):
        add(findings, "FAIL", "mde_scaling", "Design docs do not preserve the n>=150/arm or n≈250/arm small-effect caution.")
    if "n=40/arm" in combined_design_text and not re.search(r"n=40/arm.*?(large-effect|not powered|underpowered)", combined_design_text, re.DOTALL):
        add(findings, "FAIL", "n40_caveat", "n=40/arm appears without large-effect/underpowered caveat.")

    if has(prereg, "placebo_arm_status: not_implemented"):
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "placebo_not_implemented",
            "Length-matched placebo is explicitly not implemented/analyzed; only the narrowed read-block suppression claim is currently allowed.",
        )
    elif has(prereg, "placebo_arm_status: local_plumbing_not_preregistered") or has(prereg, "placebo_analysis_status: not_analyzed"):
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "placebo_not_preregistered_or_analyzed",
            "Length-matched placebo has local draft plumbing but is not preregistered, accepted, collected, or analyzed; only the narrowed read-block suppression claim is currently allowed.",
        )

    if "exact n should be set after the pilot" in schedule.lower():
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "final_n_not_fixed",
            "Final N is intentionally not fixed until pilot baseline/yield estimates are available.",
        )

    if annotation_rows < 30:
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "annotation_design",
            f"Only {annotation_rows} annotation rows exist; design requires at least 30 balanced conversations and 2 raters.",
        )

    if "Cohen's h" not in power:
        add(findings, "WARN", "power_summary", "Power summary should mention Cohen's h for callback-rate planning.")
    if "Cluster Sensitivity" not in power or "design-effect approximation" not in power:
        add(findings, "FAIL", "cluster_sensitivity", "Power summary must include cluster sensitivity / design-effect planning.")
    required_cluster_analysis_phrases = [
        "CLUSTER_COLUMNS",
        "cluster_unit_values",
        "cluster_contrast",
        "cluster_mean_diff",
        "pair|source_run|window",
    ]
    missing_cluster_analysis = [
        phrase for phrase in required_cluster_analysis_phrases if phrase not in analyze_text
    ]
    if missing_cluster_analysis:
        add(
            findings,
            "FAIL",
            "cluster_analysis_path",
            "analyze.py is missing the cluster-aware analysis path phrase(s): "
            + ", ".join(missing_cluster_analysis),
        )

    if not any(f.severity in {"FAIL", "EMPIRICAL_BLOCKER", "WARN"} for f in findings):
        add(findings, "PASS", "causal_design_ready", "Design docs pass local checks for a completed causal/mechanism experiment.")
    elif not any(f.severity == "FAIL" for f in findings):
        add(
            findings,
            "INFO",
            "conservative_preprint_boundary",
            "Design blockers are compatible with a conservative systems preprint but not with empirical/mechanism claims.",
        )
    return findings


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    if "EMPIRICAL_BLOCKER" in severities:
        return "EMPIRICAL_DESIGN_BLOCKED"
    if "WARN" in severities:
        return "PASS_WITH_WARNINGS"
    return "PASS"


def render(findings: list[Finding], root: Path) -> str:
    result = verdict(findings)
    counts = Counter(f.severity for f in findings)
    lines = [
        "# Paper Causal Design Audit",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "EMPIRICAL_BLOCKER", "WARN", "INFO", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.extend(["", "## Findings", ""])
    for finding in findings:
        lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PASS` means the design docs are locally ready for a completed causal/mechanism experiment.",
            "- `EMPIRICAL_DESIGN_BLOCKED` means the current design is acceptable for a conservative systems preprint but not for empirical/mechanism claims.",
            "- This audit is static; it does not collect samples, change env vars, recruit raters, or render the paper.",
            "",
        ]
    )
    return "\n".join(lines)


def write_fixture(root: Path, complete: bool) -> None:
    (root / "docs/paper/emotional-residue/results/power").mkdir(parents=True, exist_ok=True)
    (root / "docs/paper/emotional-residue/results/longitudinal").mkdir(parents=True, exist_ok=True)
    (root / "docs/paper/emotional-residue/manuscript").mkdir(parents=True, exist_ok=True)
    (root / "scripts/paper").mkdir(parents=True, exist_ok=True)
    schedule = """
arm-pure full-day / long-window collection
rolling_callback_rate
callback-window denominator
No optional stopping based on p-values
pre-register final N
cluster-aware analysis
length-matched placebo
narrowed mechanism claim
read-off alone isolates residue content from prompt length or prompt shape
run-level `generation_metadata`
trace-to-dialogue overlap
At least 2 raters
n=40/arm is only large-effect pilot evidence
n>=150/arm
"""
    if complete:
        schedule += "\nlength-matched placebo arm has been implemented\nfixed final N is set\n"
    else:
        schedule += "\nExact N should be set after the pilot estimates baseline callback rate and sample yield.\n"
    (root / "docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md").write_text(schedule, encoding="utf-8")
    (root / "docs/paper/emotional-residue/experiments/LONGITUDINAL_EXPERIMENT_PLAN.md").write_text(schedule, encoding="utf-8")
    prereg = """
preregistration_status: draft_not_accepted
accepted_schedule_required: true
placebo_arm_status: local_plumbing_not_preregistered
placebo_analysis_status: not_analyzed
current_mechanism_claim: narrowed_read_block_suppression
Inclusion Criteria
Exclusion Criteria
Deviation Policy
no_arm_extension_after_effect_peeking: true
"""
    (root / "docs/paper/emotional-residue/manuscript/main.tex").write_text(schedule, encoding="utf-8")
    (root / "docs/paper/emotional-residue/experiments/SCHEDULE_ACCEPTANCE.json").write_text(
        json.dumps({"accepted": complete}),
        encoding="utf-8",
    )
    (root / "docs/paper/emotional-residue/experiments/PREREGISTRATION_ACCEPTANCE.json").write_text(
        json.dumps(
            {
                "accepted": complete,
                "accepted_by": "Alan" if complete else "",
                "accepted_at": "2026-06-06T00:00:00Z" if complete else "",
                "preregistration_document": "docs/paper/emotional-residue/experiments/PREREGISTRATION_PROTOCOL.md",
            }
        ),
        encoding="utf-8",
    )
    if complete:
        prereg = prereg.replace("placebo_arm_status: local_plumbing_not_preregistered", "placebo_arm_status: implemented")
        prereg = prereg.replace("placebo_analysis_status: not_analyzed", "placebo_analysis_status: analyzed")
        prereg = prereg.replace("preregistration_status: draft_not_accepted", "preregistration_status: accepted")
    (root / "docs/paper/emotional-residue/experiments/PREREGISTRATION_PROTOCOL.md").write_text(prereg, encoding="utf-8")
    (root / "docs/paper/emotional-residue/results/power/summary.md").write_text(
        "Cohen's h\n\n## Cluster Sensitivity\n\ndesign-effect approximation",
        encoding="utf-8",
    )
    (root / "docs/paper/emotional-residue/results/power/cluster_power_grid.csv").write_text(
        "n_per_arm_nominal,cluster_size,icc\n40,4,0.05\n",
        encoding="utf-8",
    )
    rows = ["blind_id,x"] + [f"ER-{i:04d},x" for i in range(30 if complete else 4)]
    (root / "docs/paper/emotional-residue/results/longitudinal/annotation_sheet.csv").write_text(
        "\n".join(rows) + "\n",
        encoding="utf-8",
    )
    (root / "scripts/paper/analyze.py").write_text(
        "CLUSTER_COLUMNS = ['pair', 'source_run', 'window']\n"
        "def cluster_unit_values():\n"
        "    return 'pair|source_run|window'\n"
        "def cluster_contrast():\n"
        "    return {'cluster_mean_diff': 0}\n",
        encoding="utf-8",
    )


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for _cat in ("manuscript","plan","claims","experiments","release","results","data"):
            (root / "docs/paper/emotional-residue" / _cat).mkdir(parents=True, exist_ok=True)
        (root / "scripts/paper").mkdir(parents=True, exist_ok=True)
        write_fixture(root, complete=False)
        findings = audit_design(root)
        assert verdict(findings) == "EMPIRICAL_DESIGN_BLOCKED"
        assert any(f.check == "placebo_not_preregistered_or_analyzed" for f in findings)

        write_fixture(root, complete=True)
        findings = audit_design(root)
        assert verdict(findings) == "PASS"
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero unless verdict is PASS.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_design(args.root)
    report = render(findings, args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(report)
    result = verdict(findings)
    if result == "FAIL" or (args.strict and result != "PASS"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

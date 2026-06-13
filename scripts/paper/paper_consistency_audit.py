#!/usr/bin/env python3
"""Check that manuscript numbers match the generated paper artifacts."""

from __future__ import annotations

import argparse
import csv
import json
import re
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


MARKER_ROWS = {
    "Emotional expression uniqueness": "emotional_expression_uniqueness",
    "Comfort style uniqueness": "comfort_style_uniqueness",
    "Burden response uniqueness": "burden_response_uniqueness",
    "Rule-based aftertaste proxy": "human_aftertaste_score",
    "Echo similarity penalty": "echo_similarity_penalty",
    "Stage-direction leak penalty": "stage_direction_leak_penalty",
}


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def round3(value: float) -> float:
    return round(float(value) + 0.0, 3)


def parse_summary(report: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in read(report).splitlines():
        if not line.startswith("- "):
            continue
        if ":" not in line:
            continue
        key, value = line[2:].split(":", 1)
        values[key.strip()] = value.strip()
    return values


def load_marker_csv(path: Path) -> dict[str, dict[str, float]]:
    rows: dict[str, dict[str, float]] = {}
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["scope"] != "overall" or row["pair"] != "ALL":
                continue
            rows[row["marker"]] = {
                "n": int(row["n"]),
                "mean": float(row["mean"]),
                "ci_lo": float(row["ci_lo"]),
                "ci_hi": float(row["ci_hi"]),
            }
    return rows


def parse_marker_table(main_text: str) -> dict[str, tuple[float, float, float]]:
    table: dict[str, tuple[float, float, float]] = {}
    for label in MARKER_ROWS:
        pattern = re.compile(
            rf"{re.escape(label)}\s*&\s*([0-9.]+)\s*&\s*([0-9.]+)\s*&\s*([0-9.]+)\s*\\\\"
        )
        match = pattern.search(main_text)
        if match:
            table[label] = tuple(float(part) for part in match.groups())
    return table


def compare_marker_table(root: Path, main_text: str, findings: list[Finding]) -> None:
    csv_rows = load_marker_csv(root / "docs/paper/emotional-residue/results/current-smoke/results/soul_uniqueness.csv")
    table_rows = parse_marker_table(main_text)

    for label, marker in MARKER_ROWS.items():
        if label not in table_rows:
            add(findings, "FAIL", "marker_table_missing", f"Missing marker table row: {label}")
            continue
        if marker not in csv_rows:
            add(findings, "FAIL", "marker_csv_missing", f"Missing marker CSV row: {marker}")
            continue
        manuscript = table_rows[label]
        artifact = (
            round3(csv_rows[marker]["mean"]),
            round3(csv_rows[marker]["ci_lo"]),
            round3(csv_rows[marker]["ci_hi"]),
        )
        if tuple(round3(v) for v in manuscript) != artifact:
            add(
                findings,
                "FAIL",
                "marker_table_mismatch",
                f"{label}: manuscript {manuscript} vs artifact {artifact}",
            )

    ns = {row["n"] for row in csv_rows.values()}
    match = re.search(r"over\s+(\d+)\s+recent soul-triad conversations", main_text)
    if not match:
        add(findings, "FAIL", "smoke_n_missing", "Could not find smoke n in manuscript")
    elif {int(match.group(1))} != ns:
        add(findings, "FAIL", "smoke_n_mismatch", f"Manuscript n={match.group(1)} vs artifact n={sorted(ns)}")


def compare_june5_counts(root: Path, main_text: str, findings: list[Finding]) -> None:
    summary = parse_summary(root / "docs/paper/emotional-residue/results/repeatability/rolling-continuity-2026-06-05.md")
    expected = {
        "source": int(summary["Source sample count"]),
        "callback": int(summary["Callback sample count"]),
        "candidates": int(summary["Source residue candidates"]),
        "callbacks": int(summary["Rolling callbacks found"]),
    }
    sentence = re.search(
        r"found\s+(\d+)\s+source conversations,\s+(\d+)\s+callback conversations,\s+(\d+)\s+source residue candidates,\s+and\s+(\d+)\s+rolling callbacks",
        main_text,
    )
    if not sentence:
        add(findings, "FAIL", "june5_counts_missing", "Could not find June 5 rolling-count sentence")
    else:
        actual = {
            "source": int(sentence.group(1)),
            "callback": int(sentence.group(2)),
            "candidates": int(sentence.group(3)),
            "callbacks": int(sentence.group(4)),
        }
        if actual != expected:
            add(findings, "FAIL", "june5_counts_mismatch", f"Manuscript {actual} vs artifact {expected}")

    abstract = main_text.split(r"\section{Introduction}", 1)[0]
    if re.search(r"\b2\s*/\s*15\b|2/15 conversion", abstract):
        add(
            findings,
            "FAIL",
            "abstract_ratio_overclaim",
            "Abstract should not foreground the pilot 2/15-style continuity ratio.",
        )


def parse_repeatability_table(main_text: str) -> dict[str, dict[str, object]]:
    rows: dict[str, dict[str, object]] = {}
    pattern = re.compile(
        r"(2026-06-\d{2})\s*&\s*(PASS|WARN|FAIL)\s*&\s*([^&]+?)\s*&\s*([^&]+?)\s*&\s*(\d+)\s*&\s*(\d+)\s*&\s*(\d+)\s*\\\\"
    )
    for match in pattern.finditer(main_text):
        rows[match.group(1)] = {
            "status": match.group(2),
            "decision": match.group(3).replace("\\_", "_").strip(),
            "windows": match.group(4).strip(),
            "seen": int(match.group(5)),
            "candidates": int(match.group(6)),
            "callbacks": int(match.group(7)),
        }
    return rows


def compare_repeatability(root: Path, main_text: str, findings: list[Finding]) -> None:
    table = parse_repeatability_table(main_text)
    for date in ["2026-06-04", "2026-06-05", "2026-06-06"]:
        report = root / f"docs/paper/emotional-residue/results/repeatability/rolling-continuity-{date}.md"
        summary = parse_summary(report)
        if date not in table:
            add(findings, "FAIL", "repeatability_row_missing", f"Missing repeatability row for {date}")
            continue
        expected = {
            "status": summary["Status"],
            "decision": summary["Decision"],
            "windows": f"{summary['Source window'].split(':')[0]}--{summary['Source window'].split('-')[-1].split(':')[0]} / {summary['Callback window'].split(':')[0]}--{summary['Callback window'].split('-')[-1].split(':')[0]}" if summary["Source window"] != "none" else "none / none",
            "seen": int(summary["Today conversations seen in query"]),
            "candidates": int(summary["Source residue candidates"]),
            "callbacks": int(summary["Rolling callbacks found"]),
        }
        if table[date] != expected:
            add(findings, "FAIL", "repeatability_mismatch", f"{date}: manuscript {table[date]} vs artifact {expected}")


def compare_longitudinal(root: Path, main_text: str, findings: list[Finding]) -> None:
    rows = json.loads(read(root / "docs/paper/emotional-residue/results/longitudinal/dataset.json"))
    condition_counts = Counter(row.get("condition") for row in rows)
    pair_counts = Counter(row.get("pair") for row in rows)
    aftertaste = [row.get("metrics", {}).get("human_aftertaste_score") for row in rows]

    expected_two_per_arm = condition_counts.get("residue_on") == 2 and condition_counts.get("residue_off") == 2
    if "two qualifying conversations per arm" in main_text and not expected_two_per_arm:
        add(findings, "FAIL", "longitudinal_arm_n_mismatch", f"Manuscript says two per arm, artifact has {dict(condition_counts)}")
    if "All four records came from the same dyad" in main_text and not (len(rows) == 4 and len(pair_counts) == 1):
        add(findings, "FAIL", "longitudinal_dyad_mismatch", f"Manuscript says one dyad/four rows, artifact has n={len(rows)}, pairs={dict(pair_counts)}")
    if "aftertaste scores are saturated in both arms" in main_text and not all(value == 1.0 for value in aftertaste):
        add(findings, "FAIL", "aftertaste_saturation_mismatch", f"Manuscript says saturated, artifact values={aftertaste}")

    if "two inclusion-criteria-passing records per arm" in main_text and not expected_two_per_arm:
        add(findings, "FAIL", "limitations_arm_n_mismatch", f"Limitations says two records per arm, artifact has {dict(condition_counts)}")


def compare_trace_overlap_docs(root: Path, findings: list[Finding]) -> None:
    report_path = root / "docs/paper/emotional-residue/results/trace-overlap-audit.md"
    if not report_path.exists():
        add(findings, "FAIL", "trace_overlap_report_missing", "Missing docs/paper/emotional-residue/results/trace-overlap-audit.md")
        return
    report = read(report_path)
    count_match = re.search(r"Only\s+(\d+)\s+callback case", report)
    ratio_match = re.search(r"max overlap ratio=([0-9]+(?:\.[0-9]+)?)", report)
    if not count_match or not ratio_match:
        add(findings, "FAIL", "trace_overlap_parse", "Could not parse trace-overlap count/ratio from audit report")
        return
    callback_count = int(count_match.group(1))
    max_ratio = ratio_match.group(1)
    doc_expectations = [
        (
            root / "docs/paper/emotional-residue/release/ALAN_HANDOFF.md",
            [
                f"trace-overlap audit over {callback_count} rolling-callback cases",
                f"trace-overlap audit has only {callback_count} callback cases",
                f"max overlap\n  ratio {max_ratio}",
            ],
        ),
        (
            root / "docs/paper/emotional-residue/release/PUBLISH_READY_CHECKLIST.md",
            [
                f"{callback_count} callback cases are assessed",
                f"max overlap ratio is {max_ratio}",
            ],
        ),
    ]
    for path, phrases in doc_expectations:
        if not path.exists():
            add(findings, "FAIL", "trace_overlap_doc_missing", f"Missing {path.relative_to(root)}")
            continue
        text = read(path)
        normalized = re.sub(r"\s+", " ", text)
        for phrase in phrases:
            expected = re.sub(r"\s+", " ", phrase)
            if expected not in normalized:
                add(
                    findings,
                    "FAIL",
                    "trace_overlap_doc_stale",
                    f"{path.relative_to(root)} missing current trace-overlap phrase: {expected}",
                )


def audit_consistency(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    main = root / "docs/paper/emotional-residue/manuscript/main.tex"
    if not main.exists():
        return [Finding("FAIL", "main_missing", "Missing docs/paper/emotional-residue/manuscript/main.tex")]
    main_text = read(main)
    compare_marker_table(root, main_text, findings)
    compare_june5_counts(root, main_text, findings)
    compare_repeatability(root, main_text, findings)
    compare_longitudinal(root, main_text, findings)
    compare_trace_overlap_docs(root, findings)
    if not findings:
        add(findings, "PASS", "manuscript_artifact_consistency", "Manuscript numeric claims match current paper artifacts.")
    return findings


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    if "WARN" in severities:
        return "PASS_WITH_WARNINGS"
    return "PASS"


def render(findings: list[Finding], root: Path) -> str:
    result = verdict(findings)
    counts = Counter(f.severity for f in findings)
    lines = [
        "# Paper Consistency Audit",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "WARN", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.extend(["", "## Findings", ""])
    for finding in findings:
        lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PASS` means the manuscript's checked numeric claims match generated artifacts.",
            "- This audit covers selected hard-coded numbers, not every sentence in the manuscript.",
            "",
        ]
    )
    return "\n".join(lines)


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for _cat in ("manuscript","plan","claims","experiments","release","results","data"):
            (root / "docs/paper/emotional-residue" / _cat).mkdir(parents=True, exist_ok=True)
        (root / "scripts/paper").mkdir(parents=True, exist_ok=True)
        (root / "docs/paper/emotional-residue/manuscript").mkdir(parents=True, exist_ok=True)
        (root / "docs/paper/emotional-residue/results/current-smoke/results").mkdir(parents=True, exist_ok=True)
        (root / "docs/paper/emotional-residue/results/repeatability").mkdir(parents=True, exist_ok=True)
        (root / "docs/paper/emotional-residue/results/longitudinal").mkdir(parents=True, exist_ok=True)
        (root / "docs/paper/emotional-residue/results/current-smoke/results/soul_uniqueness.csv").write_text(
            "scope,pair,marker,n,mean,ci_lo,ci_hi\n"
            "overall,ALL,emotional_expression_uniqueness,8,0.875,0.78125,0.96875\n"
            "overall,ALL,comfort_style_uniqueness,8,0.6875,0.5625,0.875\n"
            "overall,ALL,burden_response_uniqueness,8,0.6875,0.5625,0.875\n"
            "overall,ALL,human_aftertaste_score,8,0.87625,0.7525,0.95875\n"
            "overall,ALL,echo_similarity_penalty,8,0.04375,0.01375,0.07750000000000001\n"
            "overall,ALL,stage_direction_leak_penalty,8,0,0,0\n",
            encoding="utf-8",
        )
        for date, status, decision, source, callback, seen, cand, cb in [
            ("2026-06-04", "WARN", "sample_pending", "18:00-20:00", "20:00-22:00", 25, 4, 6),
            ("2026-06-05", "PASS", "continuity_observed", "14:00-16:00", "16:00-18:00", 22, 15, 2),
            ("2026-06-06", "WARN", "sample_pending", "none", "none", 2, 0, 0),
        ]:
            (root / f"docs/paper/emotional-residue/results/repeatability/rolling-continuity-{date}.md").write_text(
                "# report\n\n## Summary\n\n"
                f"- Status: {status}\n"
                f"- Decision: {decision}\n"
                f"- Source window: {source}\n"
                f"- Callback window: {callback}\n"
                "- Source sample count: 3\n"
                "- Callback sample count: 2\n"
                f"- Source residue candidates: {cand}\n"
                f"- Rolling callbacks found: {cb}\n"
                f"- Today conversations seen in query: {seen}\n",
                encoding="utf-8",
            )
        dataset = [
            {"condition": "residue_on", "pair": "海-真晝", "metrics": {"human_aftertaste_score": 1.0}},
            {"condition": "residue_on", "pair": "海-真晝", "metrics": {"human_aftertaste_score": 1.0}},
            {"condition": "residue_off", "pair": "海-真晝", "metrics": {"human_aftertaste_score": 1.0}},
            {"condition": "residue_off", "pair": "海-真晝", "metrics": {"human_aftertaste_score": 1.0}},
        ]
        (root / "docs/paper/emotional-residue/results/longitudinal/dataset.json").write_text(json.dumps(dataset), encoding="utf-8")
        (root / "docs/paper/emotional-residue/results/trace-overlap-audit.md").write_text(
            "# trace\n\n"
            "- **EMPIRICAL_BLOCKER / callback_sample_size**: Only 11 callback case(s) assessed; need at least 30 before treating trace-overlap as validated.\n"
            "- **INFO / trace_overlap_snapshot**: Assessed 11 callback cases; max overlap ratio=0.242.\n",
            encoding="utf-8",
        )
        (root / "docs/paper/emotional-residue/release/ALAN_HANDOFF.md").write_text(
            "- a pilot trace-overlap audit over 11 rolling-callback cases, with max overlap\n"
            "  ratio 0.242 and no high verbatim-overlap flag.\n"
            "- trace-overlap audit has only 11 callback cases, below the 30-case validation threshold.\n",
            encoding="utf-8",
        )
        (root / "docs/paper/emotional-residue/release/PUBLISH_READY_CHECKLIST.md").write_text(
            "- 11 callback cases are assessed, the max overlap ratio is 0.242, no high flag.\n",
            encoding="utf-8",
        )
        (root / "docs/paper/emotional-residue/manuscript/main.tex").write_text(
            r"""We report preliminary feasibility evidence from the live system: a deterministic rule-based soul-triad evaluation over 8 recent conversations and a rolling two-hour continuity report from June 5, 2026.
On a regenerated report for June 5, 2026, the system selected a 14:00--16:00 source window and a 16:00--18:00 callback window. The report found 3 source conversations, 2 callback conversations, 15 source residue candidates, and 2 rolling callbacks.
Table \ref{tab:markers} reports a feasibility snapshot over 8 recent soul-triad conversations.
\begin{tabular}{lrrr}
Emotional expression uniqueness & 0.875 & 0.781 & 0.969 \\
Comfort style uniqueness & 0.688 & 0.562 & 0.875 \\
Burden response uniqueness & 0.688 & 0.562 & 0.875 \\
Rule-based aftertaste proxy & 0.876 & 0.752 & 0.959 \\
Echo similarity penalty & 0.044 & 0.014 & 0.078 \\
Stage-direction leak penalty & 0.000 & 0.000 & 0.000 \\
\end{tabular}
\begin{tabular}{llllrrr}
2026-06-04 & WARN & sample\_pending & 18--20 / 20--22 & 25 & 4 & 6 \\
2026-06-05 & PASS & continuity\_observed & 14--16 / 16--18 & 22 & 15 & 2 \\
2026-06-06 & WARN & sample\_pending & none / none & 2 & 0 & 0 \\
\end{tabular}
Two archived-only sanity blocks then produced two qualifying conversations per arm. All four records came from the same dyad, and the current aftertaste scores are saturated in both arms. The paper reports two inclusion-criteria-passing records per arm.
""",
            encoding="utf-8",
        )
        findings = audit_consistency(root)
        assert verdict(findings) == "PASS"

        text = read(root / "docs/paper/emotional-residue/manuscript/main.tex").replace("0.875 & 0.781", "0.111 & 0.781")
        (root / "docs/paper/emotional-residue/manuscript/main.tex").write_text(text, encoding="utf-8")
        findings = audit_consistency(root)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "marker_table_mismatch" for f in findings)

        (root / "docs/paper/emotional-residue/release/ALAN_HANDOFF.md").write_text(
            "- a pilot trace-overlap audit over 12 rolling-callback cases, with max overlap ratio 0.242.\n",
            encoding="utf-8",
        )
        findings = audit_consistency(root)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "trace_overlap_doc_stale" for f in findings)
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "docs/paper/emotional-residue/results/consistency-audit.md")
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero on any non-PASS finding.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_consistency(args.root)
    report = render(findings, args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(report)
    if verdict(findings) == "FAIL" or (args.strict and any(f.severity != "PASS" for f in findings)):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

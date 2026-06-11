#!/usr/bin/env python3
"""Audit whether residue callbacks look like quotation rather than pressure.

This is a report-level validation gate. It scans rolling-continuity markdown
reports, links each callback line to source-window residue candidates, and
computes a simple longest-common-substring overlap between source trace text and
later callback text. It does not collect samples or call Convex.
"""

from __future__ import annotations

import argparse
import glob
import re
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "docs/paper/results/trace-overlap-audit.md"
DEFAULT_REPORT_GLOBS = [
    "docs/paper/results/repeatability/rolling-continuity-*.md",
    "umi/reports/rolling-continuity-latest.md",
]
MIN_CALLBACKS_FOR_VALIDATION = 30
HIGH_OVERLAP_RATIO = 0.60
HIGH_OVERLAP_CHARS = 16


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


@dataclass
class OverlapCase:
    report: str
    callback_id: str
    source_id: str
    callback_text: str
    best_source_text: str
    longest_common: str
    overlap_ratio: float


SOURCE_RE = re.compile(
    r"^-\s+(conversation-[^:\s]+:[^\s]+|conversation-c:\d+)\s+·\s+([^·]+)\s+·\s+[^:]+:\s+\"(.*?)\""
)
CALLBACK_RE = re.compile(
    r"^-\s+(conversation-[^:\s]+:[^\s]+|conversation-c:\d+)\s+\([^)]+\)\s+←\s+"
    r"(conversation-[^:\s]+:[^\s]+|conversation-c:\d+):.*?\"(.*?)\""
)


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def normalize_text(text: str) -> str:
    text = re.sub(r"\[[^\]]+\]", "", text)
    text = re.sub(r"[\\`*_#>~|]", "", text)
    text = re.sub(r"[，。！？、；：「」『』（）()《》〈〉,.!?;:'\"\s]+", "", text)
    return text.strip().lower()


def longest_common_substring(a: str, b: str) -> str:
    if not a or not b:
        return ""
    previous = [0] * (len(b) + 1)
    best_len = 0
    best_end = 0
    for i, char_a in enumerate(a, start=1):
        current = [0] * (len(b) + 1)
        for j, char_b in enumerate(b, start=1):
            if char_a == char_b:
                current[j] = previous[j - 1] + 1
                if current[j] > best_len:
                    best_len = current[j]
                    best_end = i
        previous = current
    return a[best_end - best_len : best_end]


def report_paths(root: Path, patterns: list[str]) -> list[Path]:
    paths: list[Path] = []
    for pattern in patterns:
        full_pattern = str(root / pattern) if not Path(pattern).is_absolute() else pattern
        paths.extend(Path(match) for match in glob.glob(full_pattern))
    return sorted({path.resolve() for path in paths if path.exists()})


def parse_report(path: Path, root: Path) -> list[OverlapCase]:
    text = path.read_text(encoding="utf-8")
    source_texts: dict[str, list[str]] = {}
    for line in text.splitlines():
        match = SOURCE_RE.match(line.strip())
        if not match:
            continue
        source_id, source_type, source_text = match.groups()
        if "memory_trace" not in source_type:
            continue
        source_texts.setdefault(source_id, []).append(source_text)

    cases: list[OverlapCase] = []
    for line in text.splitlines():
        match = CALLBACK_RE.match(line.strip())
        if not match:
            continue
        callback_id, source_id, callback_text = match.groups()
        candidates = source_texts.get(source_id, [])
        best_source = ""
        best_common = ""
        best_ratio = 0.0
        callback_norm = normalize_text(callback_text)
        for source_text in candidates:
            source_norm = normalize_text(source_text)
            common = longest_common_substring(source_norm, callback_norm)
            denominator = max(1, min(len(source_norm), len(callback_norm)))
            ratio = len(common) / denominator
            if ratio > best_ratio:
                best_source = source_text
                best_common = common
                best_ratio = ratio
        cases.append(
            OverlapCase(
                report=str(path.relative_to(root) if path.is_relative_to(root) else path),
                callback_id=callback_id,
                source_id=source_id,
                callback_text=callback_text,
                best_source_text=best_source,
                longest_common=best_common,
                overlap_ratio=best_ratio,
            )
        )
    return cases


def audit_overlap(root: Path, patterns: list[str] = DEFAULT_REPORT_GLOBS) -> tuple[list[Finding], list[OverlapCase]]:
    findings: list[Finding] = []
    paths = report_paths(root, patterns)
    if not paths:
        add(findings, "FAIL", "reports_missing", "No rolling-continuity reports found for trace-overlap audit.")
        return findings, []

    cases: list[OverlapCase] = []
    for path in paths:
        cases.extend(parse_report(path, root))

    if not cases:
        add(findings, "EMPIRICAL_BLOCKER", "callback_samples", "No callback cases with source trace links were found.")
        return findings, cases

    high_overlap = [
        case
        for case in cases
        if len(case.longest_common) >= HIGH_OVERLAP_CHARS and case.overlap_ratio >= HIGH_OVERLAP_RATIO
    ]
    missing_sources = [case for case in cases if not case.best_source_text]

    if len(cases) < MIN_CALLBACKS_FOR_VALIDATION:
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "callback_sample_size",
            f"Only {len(cases)} callback case(s) assessed; need at least {MIN_CALLBACKS_FOR_VALIDATION} before treating trace-overlap as validated.",
        )
    if missing_sources:
        add(
            findings,
            "WARN",
            "source_trace_linkage",
            f"{len(missing_sources)}/{len(cases)} callback case(s) lacked a parsed source memory trace.",
        )
    if high_overlap:
        worst = max(high_overlap, key=lambda case: (case.overlap_ratio, len(case.longest_common)))
        add(
            findings,
            "WARN",
            "possible_verbatim_overlap",
            f"{len(high_overlap)}/{len(cases)} callback case(s) exceeded overlap threshold; worst {worst.callback_id} ← {worst.source_id} ratio={worst.overlap_ratio:.3f}, common='{worst.longest_common[:40]}'.",
        )
    if not any(f.severity in {"FAIL", "EMPIRICAL_BLOCKER", "WARN"} for f in findings):
        add(findings, "PASS", "trace_overlap", f"Assessed {len(cases)} callback cases without high verbatim-overlap flags.")
    elif not any(f.severity == "FAIL" for f in findings):
        add(
            findings,
            "INFO",
            "trace_overlap_snapshot",
            f"Assessed {len(cases)} callback cases; max overlap ratio={max(case.overlap_ratio for case in cases):.3f}.",
        )
    return findings, cases


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    if "EMPIRICAL_BLOCKER" in severities:
        return "PILOT_ONLY_TRACE_OVERLAP_AUDIT"
    if "WARN" in severities:
        return "PASS_WITH_WARNINGS"
    return "PASS"


def render(findings: list[Finding], cases: list[OverlapCase], root: Path) -> str:
    result = verdict(findings)
    counts = Counter(f.severity for f in findings)
    lines = [
        "# Paper Trace-Overlap Audit",
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
    lines.extend(["", "## Assessed Callback Cases", ""])
    if cases:
        lines.append("| callback | source | report | overlap_ratio | longest_common_chars |")
        lines.append("|---|---|---|---:|---:|")
        for case in sorted(cases, key=lambda item: item.overlap_ratio, reverse=True):
            lines.append(
                f"| `{case.callback_id}` | `{case.source_id}` | `{case.report}` | "
                f"{case.overlap_ratio:.3f} | {len(case.longest_common)} |"
            )
    else:
        lines.append("- No callback cases assessed.")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PASS` means enough callback cases were assessed and no high verbatim-overlap flags were found.",
            "- `PILOT_ONLY_TRACE_OVERLAP_AUDIT` means the check is wired but sample size is too small for validation.",
            "- `WARN / possible_verbatim_overlap` means later dialogue may be copying residue text rather than using it as behavioral pressure.",
            "- This audit uses simple text overlap over rolling-continuity reports; it does not replace human review.",
            "",
        ]
    )
    return "\n".join(lines)


def write_fixture(root: Path) -> None:
    report = root / "docs/paper/results/repeatability/rolling-continuity-fixture.md"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(
        """
# Rolling report

## Source Residue Candidates

- conversation-c:1 · memory_trace_residue · 海: "海還記得真晝把責任往自己身上收，於是她下次先放慢語速。" [cues: 責任、語速]

## Rolling Callbacks Found

- conversation-c:2 (strong) ← conversation-c:1: shared participant + behavior shift; cues=語速; "你剛才語速又變快了，先坐下來，把責任放旁邊。"
""".strip(),
        encoding="utf-8",
    )


def run_selftest() -> None:
    assert normalize_text("你剛才語速，又變快了。") == "你剛才語速又變快了"
    assert longest_common_substring("abcdef", "zzcdezz") == "cde"
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_fixture(root)
        findings, cases = audit_overlap(root, ["docs/paper/results/repeatability/*.md"])
        assert cases, "expected fixture callback case"
        assert verdict(findings) == "PILOT_ONLY_TRACE_OVERLAP_AUDIT"
        assert any(f.check == "callback_sample_size" for f in findings)
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--reports", nargs="+", default=DEFAULT_REPORT_GLOBS)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero unless verdict is PASS.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings, cases = audit_overlap(args.root, args.reports)
    report = render(findings, cases, args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(report)
    result = verdict(findings)
    if result == "FAIL" or (args.strict and result != "PASS"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

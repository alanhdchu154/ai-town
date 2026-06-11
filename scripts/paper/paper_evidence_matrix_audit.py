#!/usr/bin/env python3
"""Audit the claim-to-evidence matrix for the emotional-residue paper."""

from __future__ import annotations

import argparse
import re
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "docs/paper/results/evidence-matrix-audit.md"


REQUIRED_CLAIMS = {
    "C1": "SUPPORTED_SYSTEMS_PATTERN",
    "C2": "SUPPORTED_CODE_ALIGNED",
    "C3": "SUPPORTED_SMOKE",
    "C4": "SUPPORTED_FEASIBILITY",
    "C5": "SUPPORTED_PIPELINE_SANITY",
    "C6": "FUTURE_WORK_BLOCKED",
    "C7": "PACKET_READY_STUDY_INCOMPLETE",
    "C8": "SUPPORTED_LOCAL_SOURCE",
    "C9": "EXTERNAL_BLOCKED",
    "C10": "PILOT_ONLY_TRACE_OVERLAP_AUDIT",
    "C11": "EMPIRICAL_DESIGN_BLOCKED",
}

REQUIRED_ARTIFACTS = [
    "docs/paper/ALAN_HANDOFF.md",
    "docs/paper/REVIEWER_PREMORTEM.md",
    "docs/paper/arxiv/main.tex",
    "docs/paper/results/mechanism-audit.md",
    "docs/paper/results/current-smoke/results/summary.md",
    "docs/paper/results/consistency-audit.md",
    "docs/paper/results/empirical-audit.md",
    "docs/paper/results/design-audit.md",
    "docs/paper/results/trace-overlap-audit.md",
    "docs/paper/results/annotation-audit.md",
    "docs/paper/results/source-audit.md",
    "docs/paper/results/submission-audit.md",
    "docs/paper/results/pdf-preflight.md",
    "docs/paper/results/readiness.md",
    "docs/paper/SCHEDULE_ACCEPTANCE.json",
    "docs/paper/SUBMISSION_DECISIONS.json",
]

REQUIRED_GATE_LINES = [
    "Claim audit: `PASS_CONSERVATIVE_PREPRINT`",
    "Source audit: `PASS`",
    "Consistency audit: `PASS`",
    "Protocol audit: `PASS`",
    "Causal design audit: `EMPIRICAL_DESIGN_BLOCKED`",
    "Mechanism audit: `PASS`",
    "Annotation audit: `PACKET_READY_INCOMPLETE_STUDY`",
    "Empirical ablation audit: `PILOT_ONLY_INCOMPLETE_ABLATION`",
    "Trace-overlap audit: `PILOT_ONLY_TRACE_OVERLAP_AUDIT`",
    "Submission decision audit: `EXTERNAL_BLOCKERS`",
    "PDF preflight: `PDF_BLOCKER`",
    "Readiness verdict: `LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`",
]

BOUNDARY_PHRASES = [
    "Do not claim this",
    "not as a validated psychometric",
    "not as a completed effect claim",
    "not as behavioral-compliance validation",
    "empirical/mechanism claims remain blocked",
    "not the same as rendered-PDF readiness",
    "does not yet support causal",
]


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def audit_matrix(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    matrix_path = root / "docs/paper/CLAIM_EVIDENCE_MATRIX.md"
    if not matrix_path.exists():
        add(findings, "FAIL", "matrix_missing", "Missing docs/paper/CLAIM_EVIDENCE_MATRIX.md.")
        return findings
    text = matrix_path.read_text(encoding="utf-8")

    rows = re.findall(r"^\| (C\d+) \| .*? \| ([A-Z_]+) \|", text, flags=re.MULTILINE)
    status_by_claim = {claim: status for claim, status in rows}
    for claim, expected_status in REQUIRED_CLAIMS.items():
        actual = status_by_claim.get(claim)
        if actual != expected_status:
            add(findings, "FAIL", "claim_status", f"{claim} should be {expected_status}, found {actual!r}.")

    for artifact in REQUIRED_ARTIFACTS:
        if artifact not in text:
            add(findings, "FAIL", "artifact_reference", f"Matrix does not reference {artifact}.")
        elif not (root / artifact).exists():
            add(findings, "FAIL", "artifact_missing", f"Referenced artifact does not exist: {artifact}.")

    for line in REQUIRED_GATE_LINES:
        if line not in text:
            add(findings, "FAIL", "gate_summary", f"Matrix gate summary missing: {line}")

    for phrase in BOUNDARY_PHRASES:
        if phrase not in text:
            add(findings, "FAIL", "boundary_language", f"Matrix should include boundary phrase: {phrase}")

    forbidden = [
        "Residue improves felt continuity | SUPPORTED",
        "player experience | SUPPORTED",
        "causal effect | SUPPORTED",
        "external posting | SUPPORTED",
    ]
    for phrase in forbidden:
        if phrase.lower() in text.lower():
            add(findings, "FAIL", "overclaim_matrix", f"Matrix contains forbidden supported claim phrase: {phrase}")

    if not findings:
        add(findings, "PASS", "claim_evidence_matrix", "Claim-evidence matrix covers required claims, artifacts, gates, and boundaries.")
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
        "# Paper Evidence Matrix Audit",
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
            "- `PASS` means each major paper claim is mapped to current evidence artifacts and an explicit boundary.",
            "- This audit does not prove empirical completion; it verifies that claim boundaries are documented and aligned with local gates.",
            "",
        ]
    )
    return "\n".join(lines)


def write_fixture(root: Path) -> None:
    (root / "docs/paper/results/current-smoke/results").mkdir(parents=True, exist_ok=True)
    (root / "docs/paper/results").mkdir(parents=True, exist_ok=True)
    (root / "docs/paper/arxiv").mkdir(parents=True, exist_ok=True)
    for artifact in REQUIRED_ARTIFACTS:
        path = root / artifact
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text("fixture", encoding="utf-8")

    rows = [
        "| Claim ID | Manuscript claim | Current status | Evidence artifacts | Required boundary |",
        "|---|---|---|---|---|",
    ]
    for claim, status in REQUIRED_CLAIMS.items():
        rows.append(f"| {claim} | claim | {status} | {'; '.join(REQUIRED_ARTIFACTS)} | Do not claim this; not as a validated psychometric; not as a completed effect claim; not as behavioral-compliance validation; empirical/mechanism claims remain blocked; not the same as rendered-PDF readiness; does not yet support causal |")
    (root / "docs/paper/CLAIM_EVIDENCE_MATRIX.md").write_text(
        "\n".join(rows)
        + "\n\n"
        + "\n".join(f"- {line}" for line in REQUIRED_GATE_LINES)
        + "\n",
        encoding="utf-8",
    )


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_fixture(root)
        findings = audit_matrix(root)
        assert verdict(findings) == "PASS"
        matrix = root / "docs/paper/CLAIM_EVIDENCE_MATRIX.md"
        matrix.write_text(matrix.read_text(encoding="utf-8").replace("C6", "C99"), encoding="utf-8")
        findings = audit_matrix(root)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "claim_status" for f in findings)
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero unless the matrix audit is PASS.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_matrix(args.root)
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

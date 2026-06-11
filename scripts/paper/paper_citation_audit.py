#!/usr/bin/env python3
"""Audit citation provenance for the emotional-residue paper.

This is intentionally a local provenance check, not a live web crawler. It
ensures every bibliography key in main.tex has an explicit source-status row and
that recent LLM-agent / AI Town references point to primary or official URLs.
"""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]

ALLOWED_STATUSES = {
    "primary_verified",
    "official_verified",
    "publisher_verified",
    "doi_verified",
    "classic_bibliographic_anchor",
}

PRIMARY_REQUIRED_KEYS = {
    "park2023generative",
    "aitown",
    "shao2023characterllm",
    "sotopia",
    "lifelongsotopia",
    "memorybank",
    "longmem",
    "memgpt",
    "reflexion",
    "voyager",
    "llmagentmemorysurvey",
}


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


@dataclass
class LedgerRow:
    key: str
    source_status: str
    source: str
    manuscript_role: str
    boundary: str


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def latex_key_list(command: str, text: str) -> list[str]:
    keys: list[str] = []
    pattern = re.compile(rf"\\{command}\{{([^}}]+)\}}")
    for match in pattern.finditer(text):
        keys.extend(key.strip() for key in match.group(1).split(",") if key.strip())
    return keys


def parse_ledger(text: str) -> dict[str, LedgerRow]:
    rows: dict[str, LedgerRow] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line.startswith("|") or line.startswith("|---") or line.startswith("| key "):
            continue
        parts = [part.strip() for part in line.strip("|").split("|")]
        if len(parts) != 5:
            continue
        key, source_status, source, manuscript_role, boundary = parts
        rows[key] = LedgerRow(key, source_status, source, manuscript_role, boundary)
    return rows


def has_primary_like_url(source: str) -> bool:
    source_lower = source.lower()
    return any(
        marker in source_lower
        for marker in [
            "arxiv.org/abs/",
            "github.com/",
            "aclanthology.org/",
            "doi.org/",
            "mitpress.mit.edu/",
            "cambridge.org/",
            "cacm.acm.org/",
        ]
    )


def has_phrase(text: str, phrase: str) -> bool:
    normalized_text = " ".join(text.lower().split())
    normalized_phrase = " ".join(phrase.lower().split())
    return normalized_phrase in normalized_text


def audit_citations(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    main_path = root / "docs/paper/arxiv/main.tex"
    ledger_path = root / "docs/paper/CITATION_PROVENANCE.md"

    if not main_path.exists():
        add(findings, "FAIL", "main_tex", "Missing docs/paper/arxiv/main.tex")
        return findings
    if not ledger_path.exists():
        add(findings, "FAIL", "citation_ledger", "Missing docs/paper/CITATION_PROVENANCE.md")
        return findings

    main_text = read_text(main_path)
    ledger_text = read_text(ledger_path)
    bibitems = set(latex_key_list("bibitem", main_text))
    cites = set(latex_key_list("cite", main_text))
    rows = parse_ledger(ledger_text)
    ledger_keys = set(rows)

    missing_rows = sorted(bibitems - ledger_keys)
    extra_rows = sorted(ledger_keys - bibitems)
    add(
        findings,
        "FAIL",
        "missing_provenance_rows",
        f"Bibitems missing provenance rows: {', '.join(missing_rows)}",
    ) if missing_rows else None
    add(
        findings,
        "WARN",
        "extra_provenance_rows",
        f"Ledger rows not present in bibliography: {', '.join(extra_rows)}",
    ) if extra_rows else None

    uncited_bibitems = sorted(bibitems - cites)
    add(
        findings,
        "WARN",
        "uncited_bibitems",
        f"Bibliography keys not cited in manuscript: {', '.join(uncited_bibitems)}",
    ) if uncited_bibitems else None

    for key, row in sorted(rows.items()):
        if row.source_status not in ALLOWED_STATUSES:
            add(
                findings,
                "FAIL",
                "unknown_source_status",
                f"{key} has unknown source_status `{row.source_status}`.",
            )
        if not row.source:
            add(findings, "FAIL", "missing_source", f"{key} has an empty source.")
        if not row.manuscript_role:
            add(findings, "FAIL", "missing_role", f"{key} has an empty manuscript role.")
        if not row.boundary:
            add(findings, "FAIL", "missing_boundary", f"{key} has an empty boundary.")
        if key in PRIMARY_REQUIRED_KEYS:
            if row.source_status not in {"primary_verified", "official_verified", "doi_verified"}:
                add(
                    findings,
                    "FAIL",
                    "primary_required_status",
                    f"{key} should use primary/official/DOI provenance, got `{row.source_status}`.",
                )
            if not has_primary_like_url(row.source):
                add(
                    findings,
                    "FAIL",
                    "primary_required_url",
                    f"{key} should point to a primary/official URL, got `{row.source}`.",
                )

    required_policy_phrases = [
        "not a substitute for final copyediting",
        "must not strengthen novelty claims",
        "does not clear empirical, PDF, or submitter-decision blockers",
    ]
    for phrase in required_policy_phrases:
        if not has_phrase(ledger_text, phrase):
            add(findings, "WARN", "ledger_policy_boundary", f"Ledger should state: {phrase}")

    if not any(f.severity in {"FAIL", "WARN"} for f in findings):
        add(findings, "PASS", "citation_provenance", f"Ledger covers {len(bibitems)} bibliography keys.")
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
        "# Paper Citation Provenance Audit",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "WARN", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.append("")
    lines.append("## Findings")
    lines.append("")
    if findings:
        for finding in findings:
            lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    else:
        lines.append("- No findings.")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PASS` means every bibliography key has a provenance row and high-risk recent references have primary or official URLs.",
            "- `PASS_WITH_WARNINGS` means provenance is usable for conservative source readiness, but copyedit attention remains.",
            "- This audit does not perform live web access and does not clear empirical, PDF, or submission-decision blockers.",
            "",
        ]
    )
    return "\n".join(lines)


def write_fixture(root: Path) -> None:
    (root / "docs/paper").mkdir(parents=True, exist_ok=True)
    (root / "docs/paper/CITATION_PROVENANCE.md").write_text(
        "# Citation Provenance Ledger\n\n"
        "This ledger is not a substitute for final copyediting and must not strengthen novelty claims.\n"
        "It does not clear empirical, PDF, or submitter-decision blockers.\n\n"
        "| key | source_status | source | manuscript role | boundary |\n"
        "|---|---|---|---|---|\n"
        "| x | primary_verified | https://arxiv.org/abs/0000.00000 | Test reference. | Test boundary. |\n",
        encoding="utf-8",
    )


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "docs/paper/arxiv").mkdir(parents=True)
        (root / "docs/paper/arxiv/main.tex").write_text(
            r"""\documentclass{article}
\begin{document}
See \cite{x}.
\begin{thebibliography}{9}
\bibitem{x} X.
\end{thebibliography}
\end{document}
""",
            encoding="utf-8",
        )
        write_fixture(root)
        findings = audit_citations(root)
        assert verdict(findings) == "PASS"
        (root / "docs/paper/CITATION_PROVENANCE.md").write_text(
            "| key | source_status | source | manuscript role | boundary |\n"
            "|---|---|---|---|---|\n",
            encoding="utf-8",
        )
        findings = audit_citations(root)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "missing_provenance_rows" for f in findings)
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "docs/paper/results/citation-audit.md")
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_citations(args.root)
    report = render(findings, args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(report)
    result = verdict(findings)
    if result == "FAIL" or (args.strict and any(f.severity != "PASS" for f in findings)):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

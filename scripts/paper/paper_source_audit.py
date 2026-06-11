#!/usr/bin/env python3
"""Audit the arXiv source package for local TeX/source hygiene.

This script is intentionally lighter than a real PDF build. It catches source
package issues that can be checked without a TeX installation: unmatched
environments, uncited bibliography entries, missing labels/refs, placeholder
tokens, non-ASCII risk, and stale package notes.
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


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


def add_if(findings: list[Finding], condition: bool, severity: str, check: str, detail: str) -> None:
    if condition:
        findings.append(Finding(severity, check, detail))


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def latex_key_list(command: str, text: str) -> list[str]:
    keys: list[str] = []
    pattern = re.compile(rf"\\{command}\{{([^}}]+)\}}")
    for match in pattern.finditer(text):
        keys.extend(key.strip() for key in match.group(1).split(",") if key.strip())
    return keys


def environment_balance(text: str) -> list[str]:
    stack: list[str] = []
    errors: list[str] = []
    for match in re.finditer(r"\\(begin|end)\{([^}]+)\}", text):
        action, env = match.group(1), match.group(2)
        if action == "begin":
            stack.append(env)
        elif not stack:
            errors.append(f"Unexpected \\end{{{env}}}")
        else:
            opener = stack.pop()
            if opener != env:
                errors.append(f"Mismatched environment: \\begin{{{opener}}} closed by \\end{{{env}}}")
    for env in reversed(stack):
        errors.append(f"Unclosed \\begin{{{env}}}")
    return errors


def table_column_count(line: str) -> int:
    return len(re.split(r"(?<!\\)&", line))


def audit_source(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    arxiv_dir = root / "docs/paper/arxiv"
    main = arxiv_dir / "main.tex"
    readme = arxiv_dir / "README.md"

    add_if(findings, not arxiv_dir.exists(), "FAIL", "arxiv_dir", "Missing docs/paper/arxiv")
    add_if(findings, not main.exists(), "FAIL", "main_tex", "Missing docs/paper/arxiv/main.tex")
    add_if(findings, not readme.exists(), "FAIL", "arxiv_readme", "Missing docs/paper/arxiv/README.md")
    if not main.exists():
        return findings

    text = read(main)
    readme_text = read(readme) if readme.exists() else ""

    for token in ["[FILL", "TODO", "TBD", "???"]:
        add_if(findings, token.lower() in text.lower(), "FAIL", "placeholder", f"main.tex contains {token}")

    add_if(findings, "\\documentclass" not in text, "FAIL", "latex_structure", "Missing \\documentclass")
    add_if(findings, "\\begin{document}" not in text, "FAIL", "latex_structure", "Missing \\begin{document}")
    add_if(findings, "\\end{document}" not in text, "FAIL", "latex_structure", "Missing \\end{document}")
    add_if(
        findings,
        text.find("\\begin{document}") > text.find("\\end{document}") if "\\end{document}" in text else False,
        "FAIL",
        "latex_structure",
        "\\end{document} appears before \\begin{document}",
    )

    for error in environment_balance(text):
        add_if(findings, True, "FAIL", "environment_balance", error)

    labels = set(latex_key_list("label", text))
    refs = latex_key_list("ref", text)
    missing_refs = sorted({ref for ref in refs if ref not in labels})
    add_if(findings, bool(missing_refs), "FAIL", "missing_label", f"Missing labels for refs: {', '.join(missing_refs)}")

    duplicate_labels = [label for label, count in Counter(latex_key_list("label", text)).items() if count > 1]
    add_if(findings, bool(duplicate_labels), "FAIL", "duplicate_label", f"Duplicate labels: {', '.join(duplicate_labels)}")

    bibitems = latex_key_list("bibitem", text)
    cites = set(latex_key_list("cite", text))
    uncited = sorted(key for key in bibitems if key not in cites)
    missing_bib = sorted(cite for cite in cites if cite not in bibitems)
    add_if(findings, bool(uncited), "WARN", "uncited_bibitem", f"Uncited bibliography entries: {', '.join(uncited)}")
    add_if(findings, bool(missing_bib), "FAIL", "missing_bibitem", f"Citations without bibitems: {', '.join(missing_bib)}")
    add_if(findings, len(set(bibitems)) != len(bibitems), "FAIL", "duplicate_bibitem", "Duplicate bibitem keys found")

    tabular_blocks = re.findall(r"\\begin\{tabular\}\{([^}]+)\}(.*?)\\end\{tabular\}", text, re.DOTALL)
    for index, (spec, body) in enumerate(tabular_blocks, start=1):
        expected = sum(1 for char in spec if char in "lcrpmbX")
        for raw_line in body.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("\\") or line.startswith("%"):
                continue
            if "&" not in line:
                continue
            line = line.rstrip("\\").strip()
            actual = table_column_count(line)
            add_if(
                findings,
                actual != expected,
                "FAIL",
                "tabular_columns",
                f"Table {index} row has {actual} cells but spec expects {expected}: {raw_line.strip()}",
            )

    non_ascii = sorted({char for char in text if ord(char) > 127})
    allowed_non_ascii = {"--"}
    add_if(
        findings,
        bool(non_ascii),
        "WARN",
        "non_ascii",
        "main.tex contains non-ASCII characters: " + " ".join(f"U+{ord(c):04X}" for c in non_ascii[:20]),
    )
    _ = allowed_non_ascii

    required_readme_phrases = [
        "single-file LaTeX source",
        "no completed causal ablation or player study",
        "PDF compilation must be verified",
    ]
    for phrase in required_readme_phrases:
        add_if(
            findings,
            phrase.lower() not in readme_text.lower(),
            "WARN",
            "readme_boundary",
            f"README should state: {phrase}",
        )

    add_if(
        findings,
        "author details to confirm before submission" not in text.lower(),
        "WARN",
        "author_metadata_marker",
        "Author placeholder marker is absent; confirm metadata has actually been finalized.",
    )

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
        "# Paper Source Audit",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "WARN"]:
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
            "- `PASS` means local source hygiene checks found no issues.",
            "- `PASS_WITH_WARNINGS` means source structure is acceptable, but manual attention remains.",
            "- This audit does not replace compiling the PDF with TeX or inspecting the arXiv preview.",
            "",
        ]
    )
    return "\n".join(lines)


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        arxiv = root / "docs/paper/arxiv"
        arxiv.mkdir(parents=True)
        (arxiv / "README.md").write_text(
            "single-file LaTeX source\n"
            "no completed causal ablation or player study\n"
            "PDF compilation must be verified\n",
            encoding="utf-8",
        )
        (arxiv / "main.tex").write_text(
            r"""\documentclass{article}
\begin{document}
\begin{table}
\caption{A}
\label{tab:a}
\begin{tabular}{lr}
Name & Value \\
A & 1 \\
\end{tabular}
\end{table}
See Table \ref{tab:a} and \cite{x}.
author details to confirm before submission
\begin{thebibliography}{9}
\bibitem{x} X.
\end{thebibliography}
\end{document}
""",
            encoding="utf-8",
        )
        findings = audit_source(root)
        assert verdict(findings) == "PASS"

        (arxiv / "main.tex").write_text(
            r"""\documentclass{article}
\begin{document}
\begin{table}
\label{tab:a}
\label{tab:a}
\begin{tabular}{lr}
Name & Value & Extra \\
\end{tabular}
\end{table}
See Table \ref{tab:missing} and \cite{missing}.
[FILL]
\begin{thebibliography}{9}
\bibitem{x} X.
\end{thebibliography}
\end{document}
""",
            encoding="utf-8",
        )
        findings = audit_source(root)
        assert verdict(findings) == "FAIL"
        checks = {finding.check for finding in findings}
        assert "placeholder" in checks
        assert "missing_label" in checks
        assert "missing_bibitem" in checks
        assert "duplicate_label" in checks
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "docs/paper/results/source-audit.md")
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero on WARN as well as FAIL.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_source(args.root)
    report = render(findings, args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(report)

    result = verdict(findings)
    if result == "FAIL" or (args.strict and findings):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Preflight PDF compilation for the emotional-residue LaTeX source.

This script is deliberately local-only. It copies the TeX source into a
temporary directory, uses the first available TeX toolchain, and writes a small
report. If no PDF-capable tool is available, it reports a PDF_BLOCKER instead
of pretending the source has been rendered.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "docs/paper/results/pdf-preflight.md"
PDF_TOOLS = ["tectonic", "latexmk", "pdflatex", "xelatex", "lualatex", "pandoc"]


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def available_tools() -> dict[str, str]:
    return {tool: path for tool in PDF_TOOLS if (path := shutil.which(tool))}


def run_command(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=120,
        check=False,
    )


def compile_with_tool(tool: str, tool_path: str, workdir: Path) -> tuple[bool, str]:
    main = workdir / "main.tex"
    if tool == "tectonic":
        cmd = [tool_path, "--outdir", str(workdir), str(main)]
        completed = run_command(cmd, workdir)
    elif tool == "latexmk":
        cmd = [tool_path, "-pdf", "-interaction=nonstopmode", "-halt-on-error", "-outdir=" + str(workdir), str(main)]
        completed = run_command(cmd, workdir)
    elif tool in {"pdflatex", "xelatex", "lualatex"}:
        cmd = [tool_path, "-interaction=nonstopmode", "-halt-on-error", "-output-directory", str(workdir), str(main)]
        completed = run_command(cmd, workdir)
        if completed.returncode == 0:
            completed = run_command(cmd, workdir)
    elif tool == "pandoc":
        cmd = [tool_path, str(main), "-o", str(workdir / "main.pdf")]
        completed = run_command(cmd, workdir)
    else:
        return False, f"Unsupported tool: {tool}"

    output = "\n".join(part for part in [completed.stdout, completed.stderr] if part).strip()
    pdf = workdir / "main.pdf"
    if completed.returncode == 0 and pdf.exists() and pdf.stat().st_size > 0:
        return True, f"{tool} compiled main.pdf ({pdf.stat().st_size} bytes)."
    clipped = output[-3000:] if output else "(no compiler output)"
    return False, f"{tool} failed with exit code {completed.returncode}. Tail:\n{clipped}"


def audit_pdf(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    source_dir = root / "docs/paper/arxiv"
    main = source_dir / "main.tex"
    if not main.exists():
        add(findings, "FAIL", "main_tex", "Missing docs/paper/arxiv/main.tex")
        return findings

    tools = available_tools()
    if not tools:
        add(
            findings,
            "PDF_BLOCKER",
            "pdf_tools",
            "No local tectonic/latexmk/pdflatex/xelatex/lualatex/pandoc found; PDF compilation remains unverified.",
        )
        return findings

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        for path in source_dir.iterdir():
            if path.is_file():
                shutil.copy2(path, workdir / path.name)
        for tool, tool_path in tools.items():
            ok, detail = compile_with_tool(tool, tool_path, workdir)
            if ok:
                add(findings, "PASS", "pdf_compile", detail)
                add(findings, "INFO", "pdf_tool", f"Used {tool}: {tool_path}")
                return findings
            add(findings, "WARN", f"{tool}_compile_attempt", detail)

    add(findings, "FAIL", "pdf_compile", "A local PDF tool was available, but no tool produced main.pdf.")
    return findings


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    if "PDF_BLOCKER" in severities:
        return "PDF_BLOCKER"
    if "WARN" in severities:
        return "PASS_WITH_WARNINGS"
    return "PASS"


def render(findings: list[Finding], root: Path) -> str:
    result = verdict(findings)
    counts = Counter(f.severity for f in findings)
    lines = [
        "# Paper PDF Preflight",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "PDF_BLOCKER", "WARN", "INFO", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.extend(["", "## Findings", ""])
    for finding in findings:
        lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PASS` means a local tool compiled `docs/paper/arxiv/main.tex` into a non-empty PDF in a temporary directory.",
            "- `PDF_BLOCKER` means no local PDF-capable tool was found; source readiness can still be conservative, but rendered-PDF readiness is unverified.",
            "- `FAIL` means a local PDF tool exists but compilation failed.",
            "",
        ]
    )
    return "\n".join(lines)


def write_fixture(root: Path) -> None:
    arxiv = root / "docs/paper/arxiv"
    arxiv.mkdir(parents=True, exist_ok=True)
    main = arxiv / "main.tex"
    if not main.exists():
        main.write_text(
            "\\documentclass{article}\\begin{document}Hello.\\end{document}\n",
            encoding="utf-8",
        )


def write_fake_pdflatex(bin_dir: Path) -> None:
    fake = bin_dir / "pdflatex"
    fake.write_text(
        "#!/bin/sh\n"
        "outdir='.'\n"
        "prev=''\n"
        "for arg in \"$@\"; do\n"
        "  if [ \"$prev\" = '-output-directory' ]; then outdir=\"$arg\"; fi\n"
        "  prev=\"$arg\"\n"
        "done\n"
        "mkdir -p \"$outdir\"\n"
        "printf '%s\\n' '%PDF-1.4 fake' > \"$outdir/main.pdf\"\n"
        "exit 0\n",
        encoding="utf-8",
    )
    fake.chmod(0o755)


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "repo"
        write_fixture(root)
        old_path = os.environ.get("PATH", "")

        empty_bin = Path(tmp) / "empty-bin"
        empty_bin.mkdir()
        os.environ["PATH"] = str(empty_bin)
        findings = audit_pdf(root)
        assert verdict(findings) == "PDF_BLOCKER"

        fake_bin = Path(tmp) / "fake-bin"
        fake_bin.mkdir()
        write_fake_pdflatex(fake_bin)
        os.environ["PATH"] = str(fake_bin)
        findings = audit_pdf(root)
        assert verdict(findings) == "PASS"
        assert any(f.check == "pdf_compile" for f in findings)

        os.environ["PATH"] = old_path
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero unless the PDF preflight is PASS.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_pdf(args.root)
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

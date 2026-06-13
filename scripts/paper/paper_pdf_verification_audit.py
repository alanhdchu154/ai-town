#!/usr/bin/env python3
"""Audit local rendered-PDF and platform-preview verification decisions.

This script does not render, upload, or submit anything. It only checks whether
the local PDF verification record is explicit, complete, and tied to the current
allowlisted arXiv source archive.
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
DEFAULT_OUT = REPO_ROOT / "docs/paper/emotional-residue/results/pdf-verification-audit.md"
REQUIRED_VISUAL_CHECKS = [
    "title_author_abstract_checked",
    "tables_checked",
    "citations_checked",
    "no_raw_transcripts_or_sensitive_files",
    "limitations_visible",
]


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def nonempty(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def placeholderish(value: object) -> bool:
    if not isinstance(value, str):
        return False
    normalized = value.strip().lower()
    return any(
        token in normalized
        for token in [
            "to_record",
            "to_confirm",
            "choose_one",
            "yyyy-mm-dd",
            "after_render",
        ]
    )


def sha256ish(value: object) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value.strip().lower()) is not None


def audit_pdf_verification(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    verification_path = root / "docs/paper/emotional-residue/release/PDF_VERIFICATION.json"
    protocol_path = root / "docs/paper/emotional-residue/release/PDF_VERIFICATION_PROTOCOL.md"
    manifest_path = root / "docs/paper/emotional-residue/results/arxiv-source/manifest.json"

    if not verification_path.exists():
        add(findings, "FAIL", "pdf_verification_file", "Missing docs/paper/emotional-residue/release/PDF_VERIFICATION.json.")
        return findings
    if not protocol_path.exists():
        add(findings, "FAIL", "pdf_verification_protocol", "Missing docs/paper/emotional-residue/release/PDF_VERIFICATION_PROTOCOL.md.")

    try:
        data = read_json(verification_path)
    except json.JSONDecodeError as exc:
        add(findings, "FAIL", "pdf_verification_json", f"Invalid JSON: {exc}")
        return findings

    if data.get("pdf_render_verified") is not True:
        add(findings, "PDF_BLOCKER", "pdf_render_verified", "Rendered PDF has not been verified.")
    if data.get("platform_preview_verified") is not True:
        add(findings, "PDF_BLOCKER", "platform_preview_verified", "Platform preview has not been verified.")

    if data.get("pdf_render_verified") is True or data.get("platform_preview_verified") is True:
        for key in ["verified_by", "verified_at", "render_tool", "render_environment"]:
            if not nonempty(data.get(key)):
                add(findings, "FAIL", key, f"{key} must be recorded when PDF/platform verification is true.")
            elif placeholderish(data.get(key)):
                add(findings, "FAIL", f"{key}_placeholder", f"{key} still contains a template placeholder.")
        for key in ["source_archive_sha256", "rendered_pdf_sha256"]:
            if placeholderish(data.get(key)):
                add(findings, "FAIL", f"{key}_placeholder", f"{key} still contains a template placeholder.")
        if not sha256ish(data.get("source_archive_sha256")):
            add(findings, "FAIL", "source_archive_sha256", "source_archive_sha256 must be a SHA-256 hash.")
        if not sha256ish(data.get("rendered_pdf_sha256")):
            add(findings, "FAIL", "rendered_pdf_sha256", "rendered_pdf_sha256 must be a SHA-256 hash.")

        if manifest_path.exists() and sha256ish(data.get("source_archive_sha256")):
            manifest = read_json(manifest_path)
            current_sha = manifest.get("archive_sha256")
            if data.get("source_archive_sha256") != current_sha:
                add(
                    findings,
                    "FAIL",
                    "source_archive_sha_mismatch",
                    f"PDF verification references archive SHA {data.get('source_archive_sha256')}, current archive SHA is {current_sha}.",
                )
        elif not manifest_path.exists():
            add(findings, "FAIL", "archive_manifest", "Missing docs/paper/emotional-residue/results/arxiv-source/manifest.json.")

        visual = data.get("visual_checks")
        if not isinstance(visual, dict):
            add(findings, "FAIL", "visual_checks", "visual_checks must be an object.")
        else:
            for key in REQUIRED_VISUAL_CHECKS:
                if visual.get(key) is not True:
                    add(findings, "FAIL", f"visual_{key}", f"Visual check is not confirmed: {key}.")

    if not any(f.severity in {"FAIL", "PDF_BLOCKER"} for f in findings):
        add(findings, "PASS", "pdf_verification", "Rendered PDF and platform preview verification record is complete and current.")
    return findings


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    if "PDF_BLOCKER" in severities:
        return "PDF_BLOCKER"
    return "PASS"


def render(findings: list[Finding], root: Path) -> str:
    result = verdict(findings)
    counts = Counter(f.severity for f in findings)
    lines = [
        "# Paper PDF Verification Audit",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "PDF_BLOCKER", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.extend(["", "## Findings", ""])
    for finding in findings:
        lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PASS` means rendered-PDF and platform-preview verification details are recorded and match the current source archive.",
            "- `PDF_BLOCKER` means verification has not happened yet.",
            "- `FAIL` means verification was claimed but required evidence is missing or stale.",
            "- This audit does not render, upload, or submit anything.",
            "",
        ]
    )
    return "\n".join(lines)


def write_fixture(root: Path, complete: bool) -> None:
    (root / "docs/paper/emotional-residue/results/arxiv-source").mkdir(parents=True, exist_ok=True)
    (root / "docs/paper").mkdir(parents=True, exist_ok=True)
    archive_sha = "a" * 64
    (root / "docs/paper/emotional-residue/results/arxiv-source/manifest.json").write_text(
        json.dumps({"archive_sha256": archive_sha}),
        encoding="utf-8",
    )
    (root / "docs/paper/emotional-residue/release/PDF_VERIFICATION_PROTOCOL.md").write_text("protocol", encoding="utf-8")
    if complete:
        data = {
            "pdf_render_verified": True,
            "platform_preview_verified": True,
            "verified_by": "Alan",
            "verified_at": "2026-06-09T19:00:00-05:00",
            "render_tool": "pdflatex",
            "render_environment": "test",
            "source_archive_sha256": archive_sha,
            "rendered_pdf_sha256": "b" * 64,
            "visual_checks": {key: True for key in REQUIRED_VISUAL_CHECKS},
        }
    else:
        data = {
            "pdf_render_verified": False,
            "platform_preview_verified": False,
            "verified_by": "",
            "verified_at": "",
            "render_tool": "",
            "render_environment": "",
            "source_archive_sha256": "",
            "rendered_pdf_sha256": "",
            "visual_checks": {key: False for key in REQUIRED_VISUAL_CHECKS},
        }
    (root / "docs/paper/emotional-residue/release/PDF_VERIFICATION.json").write_text(
        json.dumps(data, indent=2),
        encoding="utf-8",
    )


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for _cat in ("manuscript","plan","claims","experiments","release","results","data"):
            (root / "docs/paper/emotional-residue" / _cat).mkdir(parents=True, exist_ok=True)
        (root / "scripts/paper").mkdir(parents=True, exist_ok=True)
        write_fixture(root, complete=False)
        findings = audit_pdf_verification(root)
        assert verdict(findings) == "PDF_BLOCKER"
        assert any(f.check == "pdf_render_verified" for f in findings)

        write_fixture(root, complete=True)
        findings = audit_pdf_verification(root)
        assert verdict(findings) == "PASS"

        data = read_json(root / "docs/paper/emotional-residue/release/PDF_VERIFICATION.json")
        data["source_archive_sha256"] = "c" * 64
        (root / "docs/paper/emotional-residue/release/PDF_VERIFICATION.json").write_text(json.dumps(data), encoding="utf-8")
        findings = audit_pdf_verification(root)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "source_archive_sha_mismatch" for f in findings)

        write_fixture(root, complete=True)
        data = read_json(root / "docs/paper/emotional-residue/release/PDF_VERIFICATION.json")
        data["render_tool"] = "TO_RECORD: pdflatex"
        data["verified_at"] = "YYYY-MM-DDTHH:MM:SSZ"
        data["rendered_pdf_sha256"] = "TO_RECORD_64_HEX_SHA256_AFTER_RENDER"
        (root / "docs/paper/emotional-residue/release/PDF_VERIFICATION.json").write_text(json.dumps(data), encoding="utf-8")
        findings = audit_pdf_verification(root)
        assert verdict(findings) == "FAIL"
        checks = {f.check for f in findings}
        assert "render_tool_placeholder" in checks
        assert "verified_at_placeholder" in checks
        assert "rendered_pdf_sha256_placeholder" in checks
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero unless PDF verification is PASS.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_pdf_verification(args.root)
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

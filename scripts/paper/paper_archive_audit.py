#!/usr/bin/env python3
"""Audit the generated arXiv source archive and manifest.

This is a local hygiene check only. It rebuilds the allowlisted source archive,
verifies the manifest and tarball agree, and checks that data/results,
annotations, transcript packets, and obvious secrets are not present.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tarfile
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import build_arxiv_source_package as arxiv_package  # noqa: E402


DEFAULT_OUT = REPO_ROOT / "docs/paper/results/archive-audit.md"
EXPECTED_MEMBERS = ["main.tex"]
SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9_+\-.,=/]+$")
FORBIDDEN_MEMBER_FRAGMENTS = [
    "dataset",
    "annotation",
    "transcript",
    "results",
    "reports",
    "figure",
    ".csv",
    ".json",
    ".md",
    ".log",
    ".png",
    ".jpg",
    ".jpeg",
    ".pdf",
]
FORBIDDEN_SOURCE_PARTS = {"data", "results"}
REQUIRED_EXCLUSIONS = [
    "experiment datasets",
    "annotation keys",
    "blinded transcript packets",
    "generated figures/results",
]
SECRET_PATTERNS = [
    ("openai_api_key_assignment", r"\bOPENAI_API_KEY\s*="),
    ("qwen_api_key_assignment", r"\bQWEN_[A-Z0-9_]*KEY\s*="),
    ("generic_secret_assignment", r"\b[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD)\s*="),
    ("openai_style_key", r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    ("aws_access_key", r"\bAKIA[0-9A-Z]{16}\b"),
    ("private_key_block", r"BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY"),
    ("raw_conversation_id", r"\bconversation-c:[A-Za-z0-9_-]+"),
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


def member_names(path: Path) -> list[str]:
    with tarfile.open(path, mode="r:gz") as tar:
        return sorted(member.name for member in tar.getmembers())


def read_member_text(path: Path, name: str) -> str:
    with tarfile.open(path, mode="r:gz") as tar:
        extracted = tar.extractfile(name)
        if extracted is None:
            return ""
        return extracted.read().decode("utf-8", errors="replace")


def audit_archive(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    archive_path, manifest_path, manifest = arxiv_package.build_archive(
        root,
        root / "docs/paper/results/arxiv-source",
    )

    if not archive_path.exists():
        add(findings, "FAIL", "archive_missing", f"Missing archive: {archive_path}")
        return findings
    if not manifest_path.exists():
        add(findings, "FAIL", "manifest_missing", f"Missing manifest: {manifest_path}")
        return findings

    manifest_from_disk = read_json(manifest_path)
    if manifest_from_disk != manifest:
        add(findings, "FAIL", "manifest_stale", "Manifest returned by builder differs from manifest on disk.")

    actual_archive_sha = arxiv_package.sha256_file(archive_path)
    recorded_archive_sha = manifest_from_disk.get("archive_sha256")
    if actual_archive_sha != recorded_archive_sha:
        add(
            findings,
            "FAIL",
            "archive_sha_mismatch",
            f"Archive SHA mismatch: actual {actual_archive_sha}, manifest {recorded_archive_sha}",
        )

    members = member_names(archive_path)
    manifest_members = sorted(item.get("archive_name") for item in manifest_from_disk.get("files", []))
    if members != manifest_members:
        add(
            findings,
            "FAIL",
            "archive_manifest_members",
            f"Archive members {members} do not match manifest members {manifest_members}",
        )
    if members != EXPECTED_MEMBERS:
        add(
            findings,
            "FAIL",
            "archive_member_allowlist",
            f"Archive members {members} do not match expected allowlist {EXPECTED_MEMBERS}",
        )

    for member in members:
        member_path = Path(member)
        if member_path.is_absolute() or ".." in member_path.parts:
            add(findings, "FAIL", "archive_path_traversal", f"Unsafe archive path: {member}")
        if SAFE_NAME_RE.match(member) is None:
            add(findings, "FAIL", "archive_filename_chars", f"Unsafe archive filename characters: {member}")
        if any(fragment in member.lower() for fragment in FORBIDDEN_MEMBER_FRAGMENTS):
            add(findings, "FAIL", "archive_forbidden_member", f"Forbidden archive member: {member}")

    for item in manifest_from_disk.get("files", []):
        source = root / item.get("source", "")
        if not source.exists():
            add(findings, "FAIL", "manifest_source_missing", f"Manifest source missing: {item.get('source')}")
            continue
        if any(part in FORBIDDEN_SOURCE_PARTS for part in source.relative_to(root).parts):
            add(findings, "FAIL", "manifest_forbidden_source", f"Manifest source comes from data/results: {item.get('source')}")
        actual_source_sha = arxiv_package.sha256_file(source)
        if actual_source_sha != item.get("sha256"):
            add(
                findings,
                "FAIL",
                "source_sha_mismatch",
                f"Source SHA mismatch for {item.get('source')}: actual {actual_source_sha}, manifest {item.get('sha256')}",
            )

    exclusions = set(manifest_from_disk.get("excluded_by_design", []))
    for required in REQUIRED_EXCLUSIONS:
        if required not in exclusions:
            add(findings, "FAIL", "manifest_exclusion_policy", f"Manifest should exclude: {required}")
    policy = str(manifest_from_disk.get("policy", "")).lower()
    if "no upload performed" not in policy:
        add(findings, "FAIL", "manifest_no_upload_policy", "Manifest policy should say no upload was performed.")

    for member in members:
        if not member.lower().endswith((".tex", ".bib", ".cls", ".sty", ".bbl")):
            continue
        text = read_member_text(archive_path, member)
        for label, pattern in SECRET_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                add(findings, "FAIL", "archive_secret_or_raw_id", f"{member} matches forbidden content pattern: {label}")

    if not findings:
        add(findings, "PASS", "archive_hygiene", f"Archive and manifest verified with members: {', '.join(members)}")
    return findings


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    return "PASS"


def render(findings: list[Finding], root: Path) -> str:
    result = verdict(findings)
    counts = Counter(f.severity for f in findings)
    lines = [
        "# Paper Archive Audit",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.extend(["", "## Findings", ""])
    for finding in findings:
        lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PASS` means the local archive and manifest match the source allowlist and no obvious data/secret leakage was detected.",
            "- `FAIL` means the source package should not be used until the archive, manifest, or content leak is fixed.",
            "- This audit rebuilds a local archive only; it does not upload or submit anything.",
            "",
        ]
    )
    return "\n".join(lines)


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        arxiv = root / "docs/paper/arxiv"
        arxiv.mkdir(parents=True)
        (arxiv / "main.tex").write_text(
            "\\documentclass{article}\n\\begin{document}\nHello.\n\\end{document}\n",
            encoding="utf-8",
        )
        findings = audit_archive(root)
        assert verdict(findings) == "PASS"

        (arxiv / "main.tex").write_text(
            "\\documentclass{article}\n\\begin{document}\nconversation-c:secret\n\\end{document}\n",
            encoding="utf-8",
        )
        findings = audit_archive(root)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "archive_secret_or_raw_id" for f in findings)

        (arxiv / "main.tex").write_text(
            "\\documentclass{article}\n\\begin{document}\nHello.\n\\end{document}\n",
            encoding="utf-8",
        )
        bad_file = root / "docs/paper/results/dataset.json"
        bad_file.parent.mkdir(parents=True, exist_ok=True)
        bad_file.write_text("[]", encoding="utf-8")
        try:
            arxiv_package.validate_sources(
                [arxiv_package.PackageFile(bad_file, "dataset.json")]
            )
            raise AssertionError("forbidden dataset source accepted")
        except ValueError:
            pass
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_archive(args.root)
    report = render(findings, args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(report)
    return 0 if verdict(findings) == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

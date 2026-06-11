#!/usr/bin/env python3
"""Build a read-only Alan-facing decision packet for the paper.

The packet combines current readiness, acceptance hashes, and submission
decision blockers. It does not edit JSON, run collection, render PDFs, or
perform external actions.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "docs/paper/results/alan-decision-packet.md"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module {name} from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


acceptance_hashes = load_module(
    "acceptance_hashes", REPO_ROOT / "scripts/paper/acceptance_hashes.py"
)
paper_readiness_report = load_module(
    "paper_readiness_report", REPO_ROOT / "scripts/paper/paper_readiness_report.py"
)
paper_submission_audit = load_module(
    "paper_submission_audit", REPO_ROOT / "scripts/paper/paper_submission_audit.py"
)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def status_line(result: str) -> str:
    if result == "LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY":
        return (
            "Local source is ready only for a conservative design/systems preprint; "
            "empirical, PDF, and external gates remain unresolved."
        )
    if result == "FAIL":
        return "Local source has a hard failure; do not discuss release."
    return f"Current readiness verdict is `{result}`; inspect blockers before release."


CONCEPT_BY_CHECK = {
    "author_name": "author_metadata",
    "affiliation": "author_metadata",
    "contact_email": "author_metadata",
    "preregistration_not_accepted": "preregistration_acceptance",
    "annotation_design": "annotation_rows",
    "annotation_sample_size": "annotation_rows",
}


def top_findings(findings: list, severities: set[str], limit: int = 8) -> list:
    seen: set[str] = set()
    selected = []
    for finding in findings:
        concept = CONCEPT_BY_CHECK.get(finding.check, finding.check)
        if finding.severity not in severities or concept in seen:
            continue
        seen.add(concept)
        selected.append(finding)
    return selected[:limit]


def section_from(report: str, heading: str) -> list[str]:
    lines = report.splitlines()
    try:
        start = lines.index(heading)
    except ValueError:
        return []
    return lines[start:]


def current_archive_sha(root: Path) -> str:
    manifest_path = root / "docs/paper/results/arxiv-source/manifest.json"
    if not manifest_path.exists():
        return "RUN npm run paper:archive-audit FIRST"
    manifest = read_json(manifest_path)
    return str(manifest.get("archive_sha256", "RUN npm run paper:archive-audit FIRST"))


def submission_decisions_template(root: Path) -> dict:
    current = read_json(root / "docs/paper/SUBMISSION_DECISIONS.json")
    return {
        "author_name": current.get("author_name") or "TO_CONFIRM",
        "affiliation": current.get("affiliation") or "TO_CONFIRM",
        "contact_email": current.get("contact_email") or "TO_CONFIRM@example.com",
        "public_author_identity_confirmed": False,
        "primary_category": current.get("primary_category") or "CHOOSE_ONE: cs.HC | cs.AI | cs.CL | cs.CY | cs.MA",
        "cross_list_categories": current.get("cross_list_categories", []),
        "arxiv_account_ready": False,
        "license_choice": current.get("license_choice") or "CHOOSE_ONE: arxiv-default | cc-by-4.0 | cc-by-sa-4.0 | cc-by-nc-sa-4.0 | cc-zero",
        "upstream_ai_town_attribution_confirmed": False,
        "raw_player_transcript_policy": current.get("raw_player_transcript_policy") or "avoid_raw_excerpts",
        "posting_timing_decision": current.get("posting_timing_decision") or "CHOOSE_ONE: conservative_preprint_now | empirical_ablation_first | hold",
        "pdf_render_verified": False,
        "platform_preview_verified": False,
        "notes": "Decision worksheet only. Replace CHOOSE_ONE/TO_CONFIRM values and set booleans true only after Alan explicitly confirms them.",
    }


def pdf_verification_template(root: Path) -> dict:
    return {
        "pdf_render_verified": True,
        "platform_preview_verified": True,
        "verified_by": "Alan",
        "verified_at": "YYYY-MM-DDTHH:MM:SSZ",
        "render_tool": "TO_RECORD: tectonic | latexmk | pdflatex | arXiv preview | other",
        "render_environment": "TO_RECORD: local machine / arXiv platform preview / other",
        "source_archive_sha256": current_archive_sha(root),
        "rendered_pdf_sha256": "TO_RECORD_64_HEX_SHA256_AFTER_RENDER",
        "visual_checks": {
            "title_author_abstract_checked": True,
            "tables_checked": True,
            "citations_checked": True,
            "no_raw_transcripts_or_sensitive_files": True,
            "limitations_visible": True,
        },
        "notes": "Fill only after the rendered PDF and platform preview are actually inspected. Do not use this template as evidence until placeholders are replaced.",
    }


def build_packet(root: Path) -> str:
    readiness_result, readiness_findings = paper_readiness_report.generate_report(
        root, root / "docs/paper/results/readiness.md"
    )
    submission_findings = paper_submission_audit.audit_submission(root)
    submission_result = paper_submission_audit.verdict(submission_findings)
    hashes = acceptance_hashes.build_report(root)

    schedule_acceptance = read_json(root / "docs/paper/SCHEDULE_ACCEPTANCE.json")
    prereg_acceptance = read_json(root / "docs/paper/PREREGISTRATION_ACCEPTANCE.json")
    submission_decisions = read_json(root / "docs/paper/SUBMISSION_DECISIONS.json")

    lines = [
        "# Alan Decision Packet: Emotional-Residue Paper",
        "",
        "Read-only packet. It does not edit files, start collection, render PDFs, or perform external actions.",
        "",
        "## Current Verdict",
        "",
        f"- readiness: `{readiness_result}`",
        f"- submission decisions: `{submission_result}`",
        f"- schedule accepted: `{schedule_acceptance.get('accepted')}`",
        f"- preregistration accepted: `{prereg_acceptance.get('accepted')}`",
        f"- posting timing decision: `{submission_decisions.get('posting_timing_decision', '')}`",
        "",
        status_line(readiness_result),
        "",
        "## What Is Defensible Now",
        "",
        "- Emotional residue as a lightweight, inspectable write/read memory pattern.",
        "- Deterministic smoke, repeatability, trace-overlap, and pipeline sanity artifacts.",
        "- Conservative source-level arXiv package, if Alan accepts the remaining external/PDF decisions.",
        "",
        "## What Is Not Defensible Yet",
        "",
        "- Causal or population-level claims that residue improves felt continuity.",
        "- Completed mechanism isolation via the placebo arm.",
        "- Completed human validation or player-study evidence.",
        "- External posting readiness without author/license/category/account/PDF/platform decisions.",
        "",
        "## Top Empirical Blockers",
        "",
    ]
    empirical = top_findings(readiness_findings, {"EMPIRICAL_BLOCKER"}, limit=10)
    if empirical:
        for finding in empirical:
            lines.append(f"- **{finding.check}**: {finding.detail}")
    else:
        lines.append("- none")

    lines.extend(["", "## Top External/PDF Blockers", ""])
    external = top_findings(readiness_findings, {"EXTERNAL_BLOCKER", "PDF_BLOCKER"}, limit=12)
    if external:
        for finding in external:
            lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    else:
        lines.append("- none")

    lines.extend(
        [
            "",
            "## If Alan Wants To Accept The Empirical Schedule",
            "",
            "Only after explicit Alan acceptance, update both acceptance JSON files with the exact templates below, replacing only the timestamp if needed:",
            "",
        ]
    )
    acceptance_section = section_from(hashes, "## Fill Only After Explicit Alan Acceptance")
    if acceptance_section:
        lines.extend(acceptance_section)
    else:
        lines.append("- Could not derive acceptance templates; rerun `npm run paper:acceptance-hashes`.")
    lines.extend(
        [
            "",
            "Then verify, still before collection:",
            "",
            "```bash",
            "npm run paper:residue-arm-window:acceptance",
            "npm run paper:protocol-audit",
            "npm run paper:readiness",
            "```",
            "",
            "## If Alan Wants External Posting",
            "",
            "First fill `docs/paper/SUBMISSION_DECISIONS.json` from this worksheet. It is not pass-ready until all `TO_CONFIRM` / `CHOOSE_ONE` values are replaced and Alan explicitly confirms the booleans:",
            "",
            "```json",
            json.dumps(submission_decisions_template(root), ensure_ascii=False, indent=2),
            "```",
            "",
            "After rendering and inspecting the PDF/platform preview, fill `docs/paper/PDF_VERIFICATION.json` from this evidence template. It is not pass-ready until the rendered PDF SHA and all render details are real:",
            "",
            "```json",
            json.dumps(pdf_verification_template(root), ensure_ascii=False, indent=2),
            "```",
            "",
            "Then rerun:",
            "",
            "```bash",
            "npm run paper:submission-audit",
            "npm run paper:pdf-preflight",
            "npm run paper:pdf-verification-audit",
            "npm run paper:readiness",
            "```",
            "",
            "## Safe Next Action",
            "",
            "Without Alan acceptance, continue only read-only/static hardening. Do not run live collection, mutate Convex env, fabricate rater data, or perform external posting.",
            "",
        ]
    )
    return "\n".join(lines)


def selftest() -> None:
    packet = build_packet(REPO_ROOT)
    assert "Read-only packet" in packet
    assert "Current Verdict" in packet
    assert "Top Empirical Blockers" in packet
    assert "SUBMISSION_DECISIONS.json" in packet
    assert "PDF_VERIFICATION.json" in packet
    assert "source_archive_sha256" in packet
    assert "npm run paper:readiness" in packet
    print("SELFTEST: PASS")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--stdout", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        selftest()
        return 0

    packet = build_packet(args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(packet + "\n", encoding="utf-8")
    if args.stdout:
        print(packet)
    else:
        print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Audit Alan-facing submission decisions for the paper package.

This check does not submit, upload, email, or contact any external service. It
only verifies that the local decision file contains explicit submitter choices
before the paper is treated as externally ready.
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
DEFAULT_DECISIONS = REPO_ROOT / "docs/paper/emotional-residue/release/SUBMISSION_DECISIONS.json"
VALID_PRIMARY_CATEGORIES = {"cs.HC", "cs.AI", "cs.CL", "cs.CY", "cs.MA"}
VALID_LICENSE_PREFIXES = {
    "arxiv-default",
    "cc-by-4.0",
    "cc-by-sa-4.0",
    "cc-by-nc-sa-4.0",
    "cc-zero",
}
VALID_TIMING_DECISIONS = {
    "conservative_preprint_now",
    "empirical_ablation_first",
    "hold",
}
VALID_TRANSCRIPT_POLICIES = {
    "avoid_raw_excerpts",
    "redacted_excerpts_only",
    "raw_excerpts_allowed",
}


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


def emailish(value: object) -> bool:
    return isinstance(value, str) and re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value.strip()) is not None


def placeholderish(value: object) -> bool:
    if not isinstance(value, str):
        return False
    normalized = value.strip().lower()
    return any(
        token in normalized
        for token in [
            "to_confirm",
            "choose_one",
            "to_record",
            "yyyy-mm-dd",
            "example.com",
        ]
    )


def license_known(value: object) -> bool:
    if not isinstance(value, str):
        return False
    normalized = value.strip().lower()
    return normalized in VALID_LICENSE_PREFIXES


def extract_tex_command_body(text: str, command: str) -> str | None:
    marker = f"\\{command}"
    start = text.find(marker)
    if start == -1:
        return None
    brace_start = text.find("{", start + len(marker))
    if brace_start == -1:
        return None
    depth = 0
    for idx in range(brace_start, len(text)):
        char = text[idx]
        if char == "\\":
            continue
        if char == "{":
            depth += 1
            continue
        if char == "}":
            depth -= 1
            if depth == 0:
                return text[brace_start + 1 : idx]
    return None


def normalize_tex_text(value: str) -> str:
    text = re.sub(r"\\(?:texttt|emph|textbf|thanks)\{([^{}]*)\}", r"\1", value)
    text = text.replace("\\\\", " ")
    text = re.sub(r"\\[a-zA-Z]+", " ", text)
    text = re.sub(r"[{}]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalized_for_match(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", normalize_tex_text(value).lower())


def author_block_has_placeholder(author_block: str) -> bool:
    normalized = normalize_tex_text(author_block).lower()
    return any(
        phrase in normalized
        for phrase in [
            "author details to confirm",
            "to confirm before submission",
            "author tbd",
            "tbd",
            "placeholder",
        ]
    )


def author_block_has_public_metadata(author_block: str) -> bool:
    normalized = normalize_tex_text(author_block).lower()
    placeholder_terms = [
        "author details to confirm before submission",
        "author details to confirm",
        "to confirm before submission",
        "to be confirmed",
        "anonymous authors",
        "anonymous author",
        "anonymous",
        "redacted",
        "tbd",
        "placeholder",
    ]
    stripped = normalized
    for term in placeholder_terms:
        stripped = stripped.replace(term, " ")
    return re.search(r"[a-z]", stripped) is not None


def audit_submission(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    decisions_path = root / "docs/paper/emotional-residue/release/SUBMISSION_DECISIONS.json"
    main_path = root / "docs/paper/emotional-residue/manuscript/main.tex"
    readme_path = root / "docs/paper/emotional-residue/manuscript/README.md"

    if not decisions_path.exists():
        add(findings, "EXTERNAL_BLOCKER", "submission_decisions_file", "Missing docs/paper/emotional-residue/release/SUBMISSION_DECISIONS.json.")
        return findings

    try:
        decisions = read_json(decisions_path)
    except json.JSONDecodeError as exc:
        add(findings, "FAIL", "submission_decisions_json", f"Invalid JSON: {exc}")
        return findings

    required_keys = [
        "author_name",
        "affiliation",
        "contact_email",
        "public_author_identity_confirmed",
        "primary_category",
        "cross_list_categories",
        "arxiv_account_ready",
        "license_choice",
        "upstream_ai_town_attribution_confirmed",
        "raw_player_transcript_policy",
        "posting_timing_decision",
        "pdf_render_verified",
        "platform_preview_verified",
    ]
    for key in required_keys:
        if key not in decisions:
            add(findings, "FAIL", "submission_decisions_schema", f"Missing key: {key}")

    for key in [
        "author_name",
        "affiliation",
        "contact_email",
        "primary_category",
        "license_choice",
        "posting_timing_decision",
    ]:
        if placeholderish(decisions.get(key)):
            add(findings, "EXTERNAL_BLOCKER", f"{key}_placeholder", f"{key} still contains a template placeholder.")

    if not nonempty(decisions.get("author_name")):
        add(findings, "EXTERNAL_BLOCKER", "author_name", "Author name is not confirmed.")
    if not nonempty(decisions.get("affiliation")):
        add(findings, "EXTERNAL_BLOCKER", "affiliation", "Affiliation line is not confirmed.")
    if not emailish(decisions.get("contact_email")):
        add(findings, "EXTERNAL_BLOCKER", "contact_email", "Contact email is missing or not email-shaped.")
    if decisions.get("public_author_identity_confirmed") is not True:
        add(findings, "EXTERNAL_BLOCKER", "public_author_identity", "Public author identity has not been confirmed.")

    primary = decisions.get("primary_category")
    if primary not in VALID_PRIMARY_CATEGORIES:
        add(
            findings,
            "EXTERNAL_BLOCKER",
            "primary_category",
            f"Primary category must be one of {sorted(VALID_PRIMARY_CATEGORIES)}; got {primary!r}.",
        )
    cross = decisions.get("cross_list_categories")
    if not isinstance(cross, list) or any(not isinstance(item, str) for item in cross):
        add(findings, "FAIL", "cross_list_categories", "cross_list_categories must be a list of strings.")
    elif any(item == primary for item in cross):
        add(findings, "WARN", "cross_list_categories", "Cross-list categories include the primary category.")
    if decisions.get("arxiv_account_ready") is not True:
        add(findings, "EXTERNAL_BLOCKER", "arxiv_account", "arXiv account/endorsement readiness is not confirmed.")

    if not license_known(decisions.get("license_choice")):
        add(
            findings,
            "EXTERNAL_BLOCKER",
            "license_choice",
            f"License choice must be one of {sorted(VALID_LICENSE_PREFIXES)}.",
        )
    if decisions.get("upstream_ai_town_attribution_confirmed") is not True:
        add(findings, "EXTERNAL_BLOCKER", "upstream_attribution", "Upstream AI Town attribution comfort is not confirmed.")

    transcript_policy = decisions.get("raw_player_transcript_policy")
    if transcript_policy not in VALID_TRANSCRIPT_POLICIES:
        add(
            findings,
            "EXTERNAL_BLOCKER",
            "transcript_policy",
            f"Transcript policy must be one of {sorted(VALID_TRANSCRIPT_POLICIES)}.",
        )
    timing = decisions.get("posting_timing_decision")
    if timing not in VALID_TIMING_DECISIONS:
        add(
            findings,
            "EXTERNAL_BLOCKER",
            "timing_decision",
            f"Timing decision must be one of {sorted(VALID_TIMING_DECISIONS)}.",
        )

    if decisions.get("pdf_render_verified") is not True:
        add(findings, "PDF_BLOCKER", "pdf_render_verified", "Rendered PDF has not been verified by Alan/Codex.")
    if decisions.get("platform_preview_verified") is not True:
        add(findings, "PDF_BLOCKER", "platform_preview_verified", "Platform preview has not been verified.")

    if main_path.exists():
        main_text = main_path.read_text(encoding="utf-8")
        author_block = extract_tex_command_body(main_text, "author")
        has_author_placeholder = "author details to confirm before submission" in main_text
        if author_block is not None:
            has_author_placeholder = has_author_placeholder or author_block_has_placeholder(author_block)
            if (
                decisions.get("public_author_identity_confirmed") is not True
                and author_block_has_public_metadata(author_block)
            ):
                add(
                    findings,
                    "EXTERNAL_BLOCKER",
                    "main_author_identity_unconfirmed",
                    "main.tex contains public author metadata, but public_author_identity_confirmed is false.",
                )
            if decisions.get("public_author_identity_confirmed") is True and nonempty(decisions.get("author_name")):
                expected_author = normalized_for_match(str(decisions.get("author_name")))
                actual_author = normalized_for_match(author_block)
                if expected_author not in actual_author:
                    add(
                        findings,
                        "EXTERNAL_BLOCKER",
                        "main_author_mismatch",
                        "main.tex author block does not match SUBMISSION_DECISIONS.json author_name.",
                    )
        elif decisions.get("public_author_identity_confirmed") is True:
            add(findings, "EXTERNAL_BLOCKER", "main_author_missing", "main.tex is missing an author block.")
        if has_author_placeholder:
            add(findings, "EXTERNAL_BLOCKER", "main_author_placeholder", "main.tex still contains the author metadata placeholder.")
        if "\\section*{Acknowledgements}" not in main_text or "\\cite{aitown}" not in main_text:
            add(findings, "EXTERNAL_BLOCKER", "main_attribution", "main.tex should acknowledge/cite AI Town before external posting.")
    else:
        add(findings, "FAIL", "main_tex", "Missing docs/paper/emotional-residue/manuscript/main.tex.")

    if readme_path.exists():
        readme = readme_path.read_text(encoding="utf-8")
        if "Confirm upstream AI Town license attribution" not in readme:
            add(findings, "WARN", "readme_attribution_check", "README final checks should mention upstream AI Town attribution.")
    else:
        add(findings, "FAIL", "arxiv_readme", "Missing docs/paper/emotional-residue/manuscript/README.md.")

    if not findings:
        add(findings, "PASS", "submission_decisions", "All local submission decisions are explicitly confirmed.")
    return findings


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    if "EXTERNAL_BLOCKER" in severities or "PDF_BLOCKER" in severities:
        return "EXTERNAL_BLOCKERS"
    if "WARN" in severities:
        return "PASS_WITH_WARNINGS"
    return "PASS"


def render(findings: list[Finding], root: Path) -> str:
    result = verdict(findings)
    counts = Counter(f.severity for f in findings)
    lines = [
        "# Paper Submission Decision Audit",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "EXTERNAL_BLOCKER", "PDF_BLOCKER", "WARN", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.extend(["", "## Findings", ""])
    for finding in findings:
        lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PASS` means local submitter decisions are recorded; it does not perform external submission.",
            "- `EXTERNAL_BLOCKERS` means Alan-facing metadata, license, timing, account, attribution, or preview decisions remain unresolved.",
            "- `FAIL` means the decision file or source package has an internal schema/source problem.",
            "",
        ]
    )
    return "\n".join(lines)


def write_decisions(root: Path, complete: bool) -> None:
    (root / "docs/paper").mkdir(parents=True, exist_ok=True)
    if complete:
        decisions = {
            "author_name": "Alan H. Chu",
            "affiliation": "Independent Researcher",
            "contact_email": "alan@research.local",
            "public_author_identity_confirmed": True,
            "primary_category": "cs.HC",
            "cross_list_categories": ["cs.AI"],
            "arxiv_account_ready": True,
            "license_choice": "arxiv-default",
            "upstream_ai_town_attribution_confirmed": True,
            "raw_player_transcript_policy": "avoid_raw_excerpts",
            "posting_timing_decision": "conservative_preprint_now",
            "pdf_render_verified": True,
            "platform_preview_verified": True,
        }
    else:
        decisions = {
            "author_name": "",
            "affiliation": "",
            "contact_email": "",
            "public_author_identity_confirmed": False,
            "primary_category": "",
            "cross_list_categories": [],
            "arxiv_account_ready": False,
            "license_choice": "",
            "upstream_ai_town_attribution_confirmed": False,
            "raw_player_transcript_policy": "avoid_raw_excerpts",
            "posting_timing_decision": "",
            "pdf_render_verified": False,
            "platform_preview_verified": False,
        }
    (root / "docs/paper/emotional-residue/release/SUBMISSION_DECISIONS.json").write_text(json.dumps(decisions, indent=2), encoding="utf-8")


def write_source(root: Path, complete: bool) -> None:
    arxiv = root / "docs/paper/emotional-residue/manuscript"
    arxiv.mkdir(parents=True, exist_ok=True)
    author = "\\author{Alan H. Chu\\\\Independent Researcher}\n" if complete else ""
    placeholder = "" if complete else "\\texttt{author details to confirm before submission}"
    arxiv.joinpath("main.tex").write_text(
        "\\documentclass{article}\\begin{document}\n"
        f"{author}"
        f"{placeholder}\n"
        "\\section*{Acknowledgements} AI Town \\cite{aitown}.\n"
        "\\begin{thebibliography}{9}\\bibitem{aitown} AI Town.\\end{thebibliography}\n"
        "\\end{document}\n",
        encoding="utf-8",
    )
    arxiv.joinpath("README.md").write_text("Confirm upstream AI Town license attribution\n", encoding="utf-8")


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for _cat in ("manuscript","plan","claims","experiments","release","results","data"):
            (root / "docs/paper/emotional-residue" / _cat).mkdir(parents=True, exist_ok=True)
        (root / "scripts/paper").mkdir(parents=True, exist_ok=True)
        write_decisions(root, complete=False)
        write_source(root, complete=False)
        findings = audit_submission(root)
        assert verdict(findings) == "EXTERNAL_BLOCKERS"
        assert any(f.check == "author_name" for f in findings)
        assert any(f.check == "main_author_placeholder" for f in findings)

        arxiv = root / "docs/paper/emotional-residue/manuscript"
        arxiv.joinpath("main.tex").write_text(
            "\\documentclass{article}\n"
            "\\author{Alan H. Chu\\\\Independent Researcher}\n"
            "\\begin{document}\n"
            "\\section*{Acknowledgements} AI Town \\cite{aitown}.\n"
            "\\begin{thebibliography}{9}\\bibitem{aitown} AI Town.\\end{thebibliography}\n"
            "\\end{document}\n",
            encoding="utf-8",
        )
        findings = audit_submission(root)
        assert verdict(findings) == "EXTERNAL_BLOCKERS"
        assert any(f.check == "main_author_identity_unconfirmed" for f in findings)

        write_decisions(root, complete=True)
        decisions = read_json(root / "docs/paper/emotional-residue/release/SUBMISSION_DECISIONS.json")
        decisions["author_name"] = "TO_CONFIRM"
        decisions["affiliation"] = "TO_CONFIRM"
        decisions["contact_email"] = "TO_CONFIRM@example.com"
        decisions["primary_category"] = "CHOOSE_ONE: cs.HC | cs.AI"
        decisions["license_choice"] = "CHOOSE_ONE: arxiv-default"
        decisions["posting_timing_decision"] = "CHOOSE_ONE: hold"
        (root / "docs/paper/emotional-residue/release/SUBMISSION_DECISIONS.json").write_text(json.dumps(decisions), encoding="utf-8")
        write_source(root, complete=True)
        findings = audit_submission(root)
        assert verdict(findings) == "EXTERNAL_BLOCKERS"
        checks = {f.check for f in findings}
        assert "author_name_placeholder" in checks
        assert "contact_email_placeholder" in checks

        write_decisions(root, complete=True)
        write_source(root, complete=True)
        findings = audit_submission(root)
        assert verdict(findings) == "PASS"
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "docs/paper/emotional-residue/results/submission-audit.md")
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero unless all submission decisions are PASS.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_submission(args.root)
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

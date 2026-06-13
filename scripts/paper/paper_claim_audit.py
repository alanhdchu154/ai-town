#!/usr/bin/env python3
"""Audit the emotional-residue paper package for over-claiming.

The goal is not to prove the paper is empirically complete. It is to make the
current claim boundary machine-checkable: conservative design/systems preprint
claims may pass, while unsupported causal/player-study language fails.
"""

from __future__ import annotations

import argparse
import csv
import json
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


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def add_if(condition: bool, findings: list[Finding], severity: str, check: str, detail: str) -> None:
    if condition:
        findings.append(Finding(severity, check, detail))


def has_phrase(text: str, phrase: str) -> bool:
    normalized_text = " ".join(text.lower().split())
    normalized_phrase = " ".join(phrase.lower().split())
    return normalized_phrase in normalized_text


def count_json_records(path: Path) -> tuple[int, Counter[str]]:
    if not path.exists():
        return 0, Counter()
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a JSON list")
    counts: Counter[str] = Counter()
    for row in data:
        if isinstance(row, dict):
            counts[str(row.get("condition", "missing"))] += 1
    return len(data), counts


def count_csv_data_rows(path: Path) -> int:
    if not path.exists():
        return 0
    with path.open(newline="", encoding="utf-8") as f:
        return max(sum(1 for _ in csv.reader(f)) - 1, 0)


def leakage_scan_files(transcripts_dir: Path) -> tuple[list[Path], list[Path]]:
    if not transcripts_dir.exists():
        return [], []
    per_record = sorted(transcripts_dir.glob("ER-*.md"))
    aggregate = transcripts_dir / "transcripts.md"
    scan_files = list(per_record)
    if aggregate.exists():
        scan_files.append(aggregate)
    return per_record, scan_files


def audit_package(root: Path) -> list[Finding]:
    findings: list[Finding] = []

    arxiv = root / "docs/paper/emotional-residue/manuscript/main.tex"
    checklist = root / "docs/paper/emotional-residue/release/PUBLISH_READY_CHECKLIST.md"
    schedule = root / "docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md"
    acceptance = root / "docs/paper/emotional-residue/experiments/SCHEDULE_ACCEPTANCE.json"
    preregistration_acceptance = root / "docs/paper/emotional-residue/experiments/PREREGISTRATION_ACCEPTANCE.json"
    longitudinal_dataset = root / "docs/paper/emotional-residue/results/longitudinal/dataset.json"
    annotation_sheet = root / "docs/paper/emotional-residue/results/longitudinal/annotation_sheet.csv"
    annotation_key = root / "docs/paper/emotional-residue/results/longitudinal/annotation_key.csv"
    transcripts_dir = root / "docs/paper/emotional-residue/results/longitudinal/blinded_transcripts"
    power_summary = root / "docs/paper/emotional-residue/results/power/summary.md"
    smoke_summary = root / "docs/paper/emotional-residue/results/current-smoke/results/summary.md"
    longitudinal_summary = root / "docs/paper/emotional-residue/results/longitudinal/results/summary.md"

    required_files = [
        arxiv,
        checklist,
        schedule,
        acceptance,
        preregistration_acceptance,
        longitudinal_dataset,
        annotation_sheet,
        annotation_key,
        power_summary,
        smoke_summary,
        longitudinal_summary,
    ]
    for path in required_files:
        add_if(not path.exists(), findings, "FAIL", "required_file", f"Missing {path.relative_to(root)}")

    if not arxiv.exists():
        return findings

    main_text = read_text(arxiv)
    all_paper_text = "\n".join(
        read_text(path)
        for path in [arxiv, checklist, schedule]
        if path.exists()
    )

    placeholder_patterns = [
        r"\[FILL[^\]]*\]",
        r"\bTBD\b",
        r"\bTODO\b",
    ]
    for pattern in placeholder_patterns:
        add_if(
            re.search(pattern, main_text, re.IGNORECASE) is not None,
            findings,
            "FAIL",
            "main_placeholders",
            f"main.tex contains placeholder pattern {pattern}",
        )

    unsupported_claims = [
        r"\bwe (show|demonstrate|prove) that (emotional )?residue improves\b",
        r"\bplayer study (shows|demonstrates|proves)\b",
        r"\b(controlled|completed) player study (shows|demonstrates|proves|found)\b",
        r"\bresidue (significantly )?improves felt continuity\b",
        r"\bstatistically significant improvement\b",
        r"\bcausal (effect|impact) of (emotional )?residue\b",
        r"\bprimary causal ablation\b",
    ]
    for pattern in unsupported_claims:
        add_if(
            re.search(pattern, main_text, re.IGNORECASE) is not None,
            findings,
            "FAIL",
            "unsupported_claim",
            f"main.tex may contain unsupported claim pattern: {pattern}",
        )

    required_disclosures = [
        "not a controlled player study",
        "no IRB or human-subjects approval is claimed",
        "no external participants were recruited or recorded",
        "raw player-conversation transcripts are intentionally excluded",
        "no completed causal ablation",
        "rule-based",
        "future work",
        "not enough for an effect claim",
        "do not yet store per-conversation provider/model metadata",
        "read-block-suppression",
    ]
    for phrase in required_disclosures:
        add_if(
            not has_phrase(main_text, phrase),
            findings,
            "FAIL",
            "missing_claim_boundary",
            f"main.tex should explicitly include: {phrase}",
        )

    add_if(
        "LLM-as-judge" in main_text and "not an LLM-as-judge" not in main_text,
        findings,
        "FAIL",
        "judge_mislabel",
        "main.tex mentions LLM-as-judge without negating it",
    )

    add_if(
        "author details to confirm before submission" in main_text,
        findings,
        "EXTERNAL_BLOCKER",
        "author_metadata",
        "Author details are still a submitter confirmation item.",
    )

    if acceptance.exists():
        data = json.loads(read_text(acceptance))
        accepted = bool(data.get("accepted"))
        has_acceptor = bool(data.get("accepted_by"))
        has_time = bool(data.get("accepted_at"))
        add_if(
            not accepted or not has_acceptor or not has_time,
            findings,
            "EMPIRICAL_BLOCKER",
            "schedule_acceptance",
            "Arm-pure collection schedule is not accepted; do not resume collection.",
        )
    if preregistration_acceptance.exists():
        data = json.loads(read_text(preregistration_acceptance))
        accepted = bool(data.get("accepted"))
        has_acceptor = bool(data.get("accepted_by"))
        has_time = bool(data.get("accepted_at"))
        add_if(
            not accepted or not has_acceptor or not has_time,
            findings,
            "EMPIRICAL_BLOCKER",
            "preregistration_acceptance",
            "Preregistration protocol is not accepted; do not resume collection.",
        )

    n_rows, condition_counts = count_json_records(longitudinal_dataset)
    on_n = condition_counts.get("residue_on", 0)
    off_n = condition_counts.get("residue_off", 0)
    add_if(
        n_rows < 80 or on_n < 40 or off_n < 40,
        findings,
        "EMPIRICAL_BLOCKER",
        "longitudinal_sample_size",
        f"Longitudinal ablation is pilot-only: total n={n_rows}, residue_on={on_n}, residue_off={off_n}.",
    )

    annotation_rows = count_csv_data_rows(annotation_sheet)
    key_rows = count_csv_data_rows(annotation_key)
    add_if(
        annotation_rows < 30,
        findings,
        "EMPIRICAL_BLOCKER",
        "annotation_rows",
        f"Blind annotation packet has {annotation_rows} rows; pilot target is at least 30 balanced conversations.",
    )
    add_if(
        annotation_rows != key_rows,
        findings,
        "FAIL",
        "annotation_key_alignment",
        f"Annotation sheet rows ({annotation_rows}) and key rows ({key_rows}) differ.",
    )

    transcript_files, leakage_files = leakage_scan_files(transcripts_dir)
    add_if(
        len(transcript_files) != annotation_rows,
        findings,
        "FAIL",
        "transcript_packet_alignment",
        f"Transcript file count ({len(transcript_files)}) does not match annotation rows ({annotation_rows}).",
    )

    leakage_patterns = [
        ("residue_on", r"\bresidue_on\b"),
        ("residue_off", r"\bresidue_off\b"),
        ("rolling_callback", r"\brolling_callback\b"),
        ("conversation-c:", r"\bconversation-c:"),
        ("condition", r"\bcondition\b"),
        ("Score", r"\bScore\b"),
        ("PASS", r"\bPASS\b"),
        ("WARN", r"\bWARN\b"),
    ]
    for path in leakage_files:
        text = read_text(path)
        leaked = [
            label
            for label, pattern in leakage_patterns
            if re.search(pattern, text, re.IGNORECASE)
        ]
        add_if(
            bool(leaked),
            findings,
            "FAIL",
            "transcript_leakage",
            f"{path.relative_to(root)} leaks hidden labels/metrics: {', '.join(leaked)}",
        )

    checklist_expectations = [
        "not ready to claim a completed controlled ablation",
        "Recruit at least one additional blind rater",
        "PDF compilation",
    ]
    for phrase in checklist_expectations:
        add_if(
            not has_phrase(all_paper_text, phrase),
            findings,
            "WARN",
            "checklist_boundary",
            f"Paper docs should preserve checklist caveat: {phrase}",
        )

    return findings


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    if "EMPIRICAL_BLOCKER" in severities or "EXTERNAL_BLOCKER" in severities:
        return "PASS_CONSERVATIVE_PREPRINT"
    if "WARN" in severities:
        return "PASS_WITH_WARNINGS"
    return "PASS"


def render_markdown(findings: list[Finding], root: Path) -> str:
    result = verdict(findings)
    counts = Counter(finding.severity for finding in findings)
    lines = [
        "# Paper Claim Audit",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "EMPIRICAL_BLOCKER", "EXTERNAL_BLOCKER", "WARN"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.append("")

    if findings:
        lines.extend(["## Findings", ""])
        for finding in findings:
            lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
        lines.append("")
    else:
        lines.extend(["## Findings", "", "- No findings.", ""])

    lines.extend(
        [
            "## Interpretation",
            "",
            "- `FAIL` means the paper package currently contains an internal inconsistency or unsupported claim.",
            "- `PASS_CONSERVATIVE_PREPRINT` means the current source can be defended only as a design/systems preprint with explicit limitations.",
            "- `EMPIRICAL_BLOCKER` items must be cleared before claiming a completed ablation, metric validation, or player-experience result.",
            "- `EXTERNAL_BLOCKER` items require Alan's submitter decisions before arXiv upload.",
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
        (root / "docs/paper/emotional-residue/results/longitudinal/results").mkdir(parents=True, exist_ok=True)
        (root / "docs/paper/emotional-residue/results/longitudinal/blinded_transcripts").mkdir(parents=True, exist_ok=True)
        (root / "docs/paper/emotional-residue/results/current-smoke/results").mkdir(parents=True, exist_ok=True)
        (root / "docs/paper/emotional-residue/results/power").mkdir(parents=True, exist_ok=True)

        (root / "docs/paper/emotional-residue/manuscript/main.tex").write_text(
            "This is not a controlled player study. There is no completed causal ablation yet. "
            "No IRB or human-subjects approval is claimed. No external participants were recruited "
            "or recorded. Raw player-conversation transcripts are intentionally excluded. "
            "The metrics are rule-based and future work remains. Current pilot data are not enough "
            "for an effect claim. Current datasets do not yet store per-conversation provider/model "
            "metadata. The mechanism claim is narrowed to read-block-suppression. "
            "author details to confirm before submission",
            encoding="utf-8",
        )
        (root / "docs/paper/emotional-residue/release/PUBLISH_READY_CHECKLIST.md").write_text(
            "not ready to claim a completed controlled ablation\n"
            "Recruit at least one additional blind rater\nPDF compilation",
            encoding="utf-8",
        )
        (root / "docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md").write_text("schedule", encoding="utf-8")
        (root / "docs/paper/emotional-residue/experiments/SCHEDULE_ACCEPTANCE.json").write_text(
            json.dumps({"accepted": False}),
            encoding="utf-8",
        )
        (root / "docs/paper/emotional-residue/experiments/PREREGISTRATION_ACCEPTANCE.json").write_text(
            json.dumps({"accepted": False}),
            encoding="utf-8",
        )
        dataset = [
            {"condition": "residue_on"},
            {"condition": "residue_on"},
            {"condition": "residue_off"},
            {"condition": "residue_off"},
        ]
        (root / "docs/paper/emotional-residue/results/longitudinal/dataset.json").write_text(
            json.dumps(dataset),
            encoding="utf-8",
        )
        (root / "docs/paper/emotional-residue/results/longitudinal/annotation_sheet.csv").write_text(
            "blind_id,x\nER-0001,a\nER-0002,b\n",
            encoding="utf-8",
        )
        (root / "docs/paper/emotional-residue/results/longitudinal/annotation_key.csv").write_text(
            "blind_id,x\nER-0001,a\nER-0002,b\n",
            encoding="utf-8",
        )
        for blind_id in ["ER-0001", "ER-0002"]:
            (root / f"docs/paper/emotional-residue/results/longitudinal/blinded_transcripts/{blind_id}.md").write_text(
                f"# {blind_id}\n\nTranscript text.",
                encoding="utf-8",
            )
        (root / "docs/paper/emotional-residue/results/longitudinal/blinded_transcripts/transcripts.md").write_text(
            "# Transcript packet\n\nTranscript text.",
            encoding="utf-8",
        )
        for path in [
            "docs/paper/emotional-residue/results/power/summary.md",
            "docs/paper/emotional-residue/results/current-smoke/results/summary.md",
            "docs/paper/emotional-residue/results/longitudinal/results/summary.md",
        ]:
            (root / path).write_text("ok", encoding="utf-8")

        findings = audit_package(root)
        assert verdict(findings) == "PASS_CONSERVATIVE_PREPRINT"
        assert any(f.check == "longitudinal_sample_size" for f in findings)
        assert not any(f.severity == "FAIL" for f in findings)

        (root / "docs/paper/emotional-residue/results/longitudinal/blinded_transcripts/transcripts.md").write_text(
            "# Transcript packet\n\ncondition: residue_on",
            encoding="utf-8",
        )
        findings = audit_package(root)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "transcript_leakage" for f in findings)
        (root / "docs/paper/emotional-residue/results/longitudinal/blinded_transcripts/transcripts.md").write_text(
            "# Transcript packet\n\nTranscript text.",
            encoding="utf-8",
        )

        (root / "docs/paper/emotional-residue/manuscript/main.tex").write_text(
            "We show that residue improves felt continuity. [FILL result]",
            encoding="utf-8",
        )
        findings = audit_package(root)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "unsupported_claim" for f in findings)
        assert any(f.check == "main_placeholders" for f in findings)
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "docs/paper/emotional-residue/results/claim-audit.md")
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit nonzero on any finding, not only FAIL findings.",
    )
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_package(args.root)
    report = render_markdown(findings, args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(report)

    result = verdict(findings)
    if result == "FAIL" or (args.strict and findings):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

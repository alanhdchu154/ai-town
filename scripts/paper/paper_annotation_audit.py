#!/usr/bin/env python3
"""Audit the blinded human-annotation packet.

The current packet can be ready for raters while the annotation study remains
incomplete. This script makes that distinction explicit.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
REQUIRED_SHEET_COLUMNS = [
    "blind_id",
    "case_ref",
    "naturalness",
    "emotional_binding",
    "character_consistency",
    "repetition",
    "notes",
]
REQUIRED_KEY_COLUMNS = [
    "blind_id",
    "case_name",
    "condition",
    "pair",
    "message_count",
    "rolling_callback",
]
RATING_COLUMNS = [
    "naturalness",
    "emotional_binding",
    "character_consistency",
    "repetition",
]
REQUIRED_ANNOTATION_COLUMNS = ["case_name", "rater", *RATING_COLUMNS]
LEAKAGE_PATTERNS = [
    ("condition", re.compile(r"\bcondition\b", re.IGNORECASE)),
    ("residue_on", re.compile(r"\bresidue_on\b", re.IGNORECASE)),
    ("residue_off", re.compile(r"\bresidue_off\b", re.IGNORECASE)),
    ("rolling_callback", re.compile(r"\brolling_callback\b", re.IGNORECASE)),
    ("conversation-c:", re.compile(r"\bconversation-c:", re.IGNORECASE)),
    ("score", re.compile(r"\bscore\b", re.IGNORECASE)),
]


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def csv_columns(path: Path) -> list[str]:
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        return next(reader)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_manifest_path(root: Path, raw_path: str) -> Path:
    path = Path(raw_path)
    return path if path.is_absolute() else root / path


def audit_annotations(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    sheet_path = root / "docs/paper/results/longitudinal/annotation_sheet.csv"
    key_path = root / "docs/paper/results/longitudinal/annotation_key.csv"
    packet_manifest_path = root / "docs/paper/results/longitudinal/annotation_packet_manifest.json"
    annotations_path = root / "docs/paper/results/longitudinal/annotations.csv"
    annotations_manifest_path = root / "docs/paper/results/longitudinal/annotations_manifest.json"
    transcript_dir = root / "docs/paper/results/longitudinal/blinded_transcripts"
    transcript_manifest_path = transcript_dir / "transcript_packet_manifest.json"
    protocol_path = root / "docs/paper/HUMAN_ANNOTATION_PROTOCOL.md"
    merge_script_path = root / "scripts/paper/merge_rater_annotations.py"

    for path in [sheet_path, key_path, protocol_path, merge_script_path]:
        if not path.exists():
            add(findings, "FAIL", "required_file", f"Missing {path.relative_to(root)}")
    if not transcript_dir.exists():
        add(findings, "FAIL", "required_file", f"Missing {transcript_dir.relative_to(root)}")
    if any(f.severity == "FAIL" for f in findings):
        return findings

    sheet_columns = csv_columns(sheet_path)
    key_columns = csv_columns(key_path)
    if sheet_columns != REQUIRED_SHEET_COLUMNS:
        add(findings, "FAIL", "sheet_schema", f"annotation_sheet columns {sheet_columns} != {REQUIRED_SHEET_COLUMNS}")
    if key_columns != REQUIRED_KEY_COLUMNS:
        add(findings, "FAIL", "key_schema", f"annotation_key columns {key_columns} != {REQUIRED_KEY_COLUMNS}")
    packet_manifest: dict = {}
    if not packet_manifest_path.exists():
        add(findings, "FAIL", "annotation_packet_manifest", "Missing annotation_packet_manifest.json; regenerate annotation_sheet/key with export_annotation_sheet.py.")
    else:
        try:
            packet_manifest = read_json(packet_manifest_path)
        except json.JSONDecodeError as error:
            add(findings, "FAIL", "annotation_packet_manifest", f"annotation_packet_manifest.json is invalid JSON: {error}")
            packet_manifest = {}
        if packet_manifest:
            if packet_manifest.get("schema_version") != 1:
                add(findings, "FAIL", "annotation_packet_manifest", "annotation_packet_manifest schema_version must be 1.")
            sheet_manifest = packet_manifest.get("sheet") if isinstance(packet_manifest.get("sheet"), dict) else {}
            key_manifest = packet_manifest.get("key") if isinstance(packet_manifest.get("key"), dict) else {}
            if sheet_manifest.get("sha256") != sha256_file(sheet_path):
                add(findings, "FAIL", "annotation_packet_manifest", "annotation_packet_manifest sheet SHA does not match annotation_sheet.csv.")
            if key_manifest.get("sha256") != sha256_file(key_path):
                add(findings, "FAIL", "annotation_packet_manifest", "annotation_packet_manifest key SHA does not match annotation_key.csv.")
            contract = packet_manifest.get("blinding_contract") if isinstance(packet_manifest.get("blinding_contract"), dict) else {}
            for key, expected in [
                ("sheet_contains_condition", False),
                ("sheet_contains_case_name", False),
                ("sheet_case_ref_equals_blind_id", True),
                ("key_separate_from_rater_sheet", True),
            ]:
                if contract.get(key) is not expected:
                    add(findings, "FAIL", "annotation_packet_manifest_blinding", f"annotation_packet_manifest blinding_contract.{key} must be {expected}.")

    sheet_rows = read_csv(sheet_path)
    key_rows = read_csv(key_path)
    sheet_ids = [row.get("blind_id", "") for row in sheet_rows]
    key_ids = [row.get("blind_id", "") for row in key_rows]
    if len(sheet_ids) != len(set(sheet_ids)):
        add(findings, "FAIL", "duplicate_blind_id", "annotation_sheet contains duplicate blind_id values")
    if len(key_ids) != len(set(key_ids)):
        add(findings, "FAIL", "duplicate_blind_id", "annotation_key contains duplicate blind_id values")
    if sheet_ids != key_ids:
        add(findings, "FAIL", "sheet_key_alignment", f"sheet ids {sheet_ids} != key ids {key_ids}")
    if packet_manifest:
        sampling = packet_manifest.get("sampling") if isinstance(packet_manifest.get("sampling"), dict) else {}
        if sampling.get("selected_records") != len(sheet_rows):
            add(findings, "FAIL", "annotation_packet_manifest", "annotation_packet_manifest sampling.selected_records does not match annotation_sheet.csv rows.")
        selected_blind_ids = packet_manifest.get("selected_blind_ids")
        if selected_blind_ids != sheet_ids:
            add(findings, "FAIL", "annotation_packet_manifest", "annotation_packet_manifest selected_blind_ids do not match annotation_sheet.csv blind_id order.")
        dataset_manifest = packet_manifest.get("dataset") if isinstance(packet_manifest.get("dataset"), dict) else {}
        dataset_path_raw = dataset_manifest.get("path")
        if dataset_path_raw:
            dataset_path = resolve_manifest_path(root, dataset_path_raw)
            if not dataset_path.exists():
                add(findings, "FAIL", "annotation_packet_manifest", f"annotation_packet_manifest dataset path does not exist: {dataset_path_raw}")
            elif dataset_manifest.get("sha256") != sha256_file(dataset_path):
                add(findings, "FAIL", "annotation_packet_manifest", "annotation_packet_manifest dataset SHA does not match dataset path.")

    if any(row.get("case_ref") != row.get("blind_id") for row in sheet_rows):
        add(findings, "FAIL", "case_ref_blinding", "case_ref should equal blind_id in the rater-visible sheet")

    invalid_values: list[str] = []
    filled_sheet_rows = 0
    for row in sheet_rows:
        filled = [row.get(col, "").strip() for col in RATING_COLUMNS]
        if all(value == "" for value in filled):
            continue
        if all(value.isdigit() and 1 <= int(value) <= 5 for value in filled):
            filled_sheet_rows += 1
        else:
            invalid_values.append(row.get("blind_id", "<missing>"))
    if invalid_values:
        add(findings, "FAIL", "rating_values", f"Invalid or partially filled Likert values for: {', '.join(invalid_values)}")
    if filled_sheet_rows:
        add(
            findings,
            "WARN",
            "worksheet_ratings",
            f"annotation_sheet.csv has {filled_sheet_rows} filled worksheet row(s); completed rater copies should be merged into annotations.csv instead.",
        )

    transcript_files = sorted(transcript_dir.glob("ER-*.md"))
    transcript_ids = [path.stem for path in transcript_files]
    if transcript_ids != sheet_ids:
        add(findings, "FAIL", "transcript_alignment", f"transcript files {transcript_ids} != sheet ids {sheet_ids}")
    aggregate = transcript_dir / "transcripts.md"
    if not aggregate.exists():
        add(findings, "FAIL", "aggregate_packet", "Missing aggregate transcripts.md")
    if not transcript_manifest_path.exists():
        add(findings, "FAIL", "transcript_packet_manifest", "Missing transcript_packet_manifest.json; regenerate blinded transcripts with export_blinded_transcripts.py.")
    else:
        try:
            transcript_manifest = read_json(transcript_manifest_path)
        except json.JSONDecodeError as error:
            add(findings, "FAIL", "transcript_packet_manifest", f"transcript_packet_manifest.json is invalid JSON: {error}")
            transcript_manifest = {}
        if transcript_manifest:
            if transcript_manifest.get("schema_version") != 1:
                add(findings, "FAIL", "transcript_packet_manifest", "transcript_packet_manifest schema_version must be 1.")
            key_manifest = transcript_manifest.get("key") if isinstance(transcript_manifest.get("key"), dict) else {}
            if key_manifest.get("sha256") != sha256_file(key_path):
                add(findings, "FAIL", "transcript_packet_manifest", "transcript_packet_manifest key SHA does not match annotation_key.csv.")
            contract = transcript_manifest.get("blinding_contract") if isinstance(transcript_manifest.get("blinding_contract"), dict) else {}
            for key in ("condition_labels_omitted", "callback_labels_omitted", "marker_scores_omitted", "case_ids_omitted"):
                if contract.get(key) is not True:
                    add(findings, "FAIL", "transcript_packet_manifest_blinding", f"transcript_packet_manifest blinding_contract.{key} must be true.")
            output = transcript_manifest.get("output") if isinstance(transcript_manifest.get("output"), dict) else {}
            if output.get("written") != len(transcript_files):
                add(findings, "FAIL", "transcript_packet_manifest", "transcript_packet_manifest output.written does not match ER transcript file count.")
            if output.get("missing") not in ([], None):
                add(findings, "FAIL", "transcript_packet_manifest", "transcript_packet_manifest output.missing must be empty for an analysis-ready packet.")
            files = output.get("files") if isinstance(output.get("files"), list) else []
            hashes_by_name = {
                Path(item.get("path", "")).name: item.get("sha256")
                for item in files
                if isinstance(item, dict)
            }
            for transcript_path in transcript_files + ([aggregate] if aggregate.exists() else []):
                if hashes_by_name.get(transcript_path.name) != sha256_file(transcript_path):
                    add(findings, "FAIL", "transcript_packet_manifest", f"transcript manifest SHA mismatch for {transcript_path.name}.")
            source_reports = transcript_manifest.get("source_reports")
            source_report_paths: set[str] = set()
            if not isinstance(source_reports, list) or not source_reports:
                add(findings, "FAIL", "transcript_packet_manifest", "transcript_packet_manifest must record at least one source report.")
            else:
                for item in source_reports:
                    if not isinstance(item, dict) or not item.get("path") or not item.get("sha256"):
                        add(findings, "FAIL", "transcript_packet_manifest", "transcript_packet_manifest has malformed source_reports entries.")
                        break
                    source_path = resolve_manifest_path(root, str(item.get("path")))
                    source_report_paths.add(str(source_path))
                    if not source_path.exists():
                        add(
                            findings,
                            "EMPIRICAL_BLOCKER",
                            "transcript_source_report_stale",
                            (
                                "Transcript packet source report is missing; "
                                f"regenerate the blinded packet before using it for annotation evidence: {item.get('path')}"
                            ),
                        )
                    elif item.get("sha256") != sha256_file(source_path):
                        add(
                            findings,
                            "EMPIRICAL_BLOCKER",
                            "transcript_source_report_stale",
                            (
                                "Transcript packet source report SHA is stale; "
                                f"regenerate the blinded packet before using it for annotation evidence: {item.get('path')}"
                            ),
                        )
            case_sources = output.get("case_sources")
            if not isinstance(case_sources, list):
                add(findings, "FAIL", "transcript_packet_manifest", "transcript_packet_manifest output.case_sources must map blind ids to source reports.")
            else:
                source_by_blind_id = {
                    item.get("blind_id"): item
                    for item in case_sources
                    if isinstance(item, dict)
                }
                if set(source_by_blind_id) != set(transcript_ids):
                    add(findings, "FAIL", "transcript_packet_manifest", "transcript case_sources blind ids do not match transcript files.")
                keyed_case_by_blind_id = {row.get("blind_id", ""): row.get("case_name", "") for row in key_rows}
                for blind_id in transcript_ids:
                    item = source_by_blind_id.get(blind_id, {})
                    if item.get("case_name") != keyed_case_by_blind_id.get(blind_id):
                        add(findings, "FAIL", "transcript_packet_manifest", f"case_sources case_name mismatch for {blind_id}.")
                    source_report = item.get("source_report")
                    if not source_report:
                        add(findings, "FAIL", "transcript_packet_manifest", f"case_sources missing source_report for {blind_id}.")
                        continue
                    source_path = resolve_manifest_path(root, str(source_report))
                    if source_report_paths and str(source_path) not in source_report_paths:
                        add(findings, "FAIL", "transcript_packet_manifest", f"case_sources source_report is not listed in source_reports for {blind_id}.")

    scan_files = transcript_files + ([aggregate] if aggregate.exists() else [])
    for path in scan_files:
        text = path.read_text(encoding="utf-8")
        leaked = [label for label, pattern in LEAKAGE_PATTERNS if pattern.search(text)]
        if leaked:
            add(findings, "FAIL", "transcript_leakage", f"{path.relative_to(root)} leaks: {', '.join(leaked)}")

    protocol = protocol_path.read_text(encoding="utf-8")
    for phrase in [
        "Minimum pilot sample: 30 archived conversations.",
        "Minimum: 2 independent raters.",
        "Raters should not see:",
        "merge_rater_annotations.py",
        "case_name,rater,naturalness,emotional_binding,character_consistency,repetition",
        "Do not use the annotation results as evidence if raters were not blind to arm.",
    ]:
        if phrase not in protocol:
            add(findings, "WARN", "protocol_text", f"Protocol missing expected phrase: {phrase}")

    conditions = Counter(row.get("condition") for row in key_rows)
    pairs = Counter(row.get("pair") for row in key_rows)
    keyed_cases = {row.get("case_name", "") for row in key_rows}
    merged_rows: list[dict[str, str]] = []
    if len(sheet_rows) < 30:
        add(findings, "EMPIRICAL_BLOCKER", "annotation_sample_size", f"Only {len(sheet_rows)} annotation rows; pilot minimum is 30.")
    if annotations_path.exists():
        annotation_columns = csv_columns(annotations_path)
        missing = [column for column in REQUIRED_ANNOTATION_COLUMNS if column not in annotation_columns]
        if missing:
            add(findings, "FAIL", "annotations_schema", f"annotations.csv missing columns: {', '.join(missing)}")
        else:
            merged_rows = read_csv(annotations_path)
            unknown_cases = sorted({row.get("case_name", "") for row in merged_rows} - keyed_cases)
            if unknown_cases:
                add(findings, "FAIL", "annotations_key_alignment", f"annotations.csv has unknown cases: {', '.join(unknown_cases)}")
            invalid_merged: list[str] = []
            for idx, row in enumerate(merged_rows, start=2):
                for column in RATING_COLUMNS:
                    value = (row.get(column) or "").strip()
                    if not value.isdigit() or not (1 <= int(value) <= 5):
                        invalid_merged.append(f"line {idx} {column}={value!r}")
                        break
            if invalid_merged:
                add(findings, "FAIL", "annotations_rating_values", f"Invalid merged Likert values: {', '.join(invalid_merged[:5])}")
            raters = {row.get("rater", "").strip() for row in merged_rows if row.get("rater", "").strip()}
            if len(raters) < 2:
                add(findings, "EMPIRICAL_BLOCKER", "rater_completion", f"Merged annotations have {len(raters)} rater(s); minimum is 2.")
            case_raters: dict[str, set[str]] = {}
            for row in merged_rows:
                case_name = row.get("case_name", "").strip()
                rater = row.get("rater", "").strip()
                if case_name and rater:
                    case_raters.setdefault(case_name, set()).add(rater)
            under_rated = sorted(case for case in keyed_cases if len(case_raters.get(case, set())) < 2)
            if under_rated:
                add(findings, "EMPIRICAL_BLOCKER", "rater_completion", f"{len(under_rated)} keyed case(s) have fewer than 2 merged rater rows.")
            if not annotations_manifest_path.exists():
                add(
                    findings,
                    "FAIL",
                    "annotations_manifest",
                    "annotations.csv exists but annotations_manifest.json is missing; merge completed rater sheets through merge_rater_annotations.py.",
                )
            else:
                try:
                    manifest = read_json(annotations_manifest_path)
                except json.JSONDecodeError as error:
                    add(findings, "FAIL", "annotations_manifest", f"annotations_manifest.json is invalid JSON: {error}")
                    manifest = {}
                if manifest:
                    if manifest.get("schema_version") != 1:
                        add(findings, "FAIL", "annotations_manifest", "annotations_manifest.json schema_version must be 1.")
                    output = manifest.get("output") if isinstance(manifest.get("output"), dict) else {}
                    if output.get("sha256") != sha256_file(annotations_path):
                        add(findings, "FAIL", "annotations_manifest", "annotations_manifest output SHA does not match annotations.csv.")
                    if output.get("rows") != len(merged_rows):
                        add(findings, "FAIL", "annotations_manifest", "annotations_manifest row count does not match annotations.csv.")
                    if output.get("min_raters", 0) < 2:
                        add(findings, "FAIL", "annotations_manifest", "annotations_manifest min_raters must be at least 2.")
                    manifest_raters = output.get("raters")
                    if not isinstance(manifest_raters, list) or len(set(manifest_raters)) < 2:
                        add(findings, "FAIL", "annotations_manifest", "annotations_manifest must record at least two unique raters.")
                    contract = manifest.get("blinding_contract") if isinstance(manifest.get("blinding_contract"), dict) else {}
                    for key, expected in [
                        ("rater_inputs_are_blinded", True),
                        ("key_not_shared_with_raters", True),
                        ("condition_columns_absent_from_rater_sheets", True),
                    ]:
                        if contract.get(key) is not expected:
                            add(findings, "FAIL", "annotations_manifest_blinding", f"annotations_manifest blinding_contract.{key} must be true.")
                    key_manifest = manifest.get("key") if isinstance(manifest.get("key"), dict) else {}
                    if key_manifest.get("sha256") != sha256_file(key_path):
                        add(findings, "FAIL", "annotations_manifest", "annotations_manifest key SHA does not match annotation_key.csv.")
                    rater_sheets = manifest.get("rater_sheets")
                    if not isinstance(rater_sheets, list) or len(rater_sheets) < 2:
                        add(findings, "FAIL", "annotations_manifest", "annotations_manifest must list at least two rater_sheets.")
                    else:
                        for item in rater_sheets:
                            if not isinstance(item, dict) or not item.get("rater") or not item.get("sha256"):
                                add(findings, "FAIL", "annotations_manifest", "annotations_manifest has malformed rater_sheets entries.")
                                break
                            sheet_path_raw = str(item.get("path", ""))
                            sheet_path = resolve_manifest_path(root, sheet_path_raw)
                            if not sheet_path.exists():
                                add(findings, "FAIL", "annotations_manifest", f"rater sheet path does not exist: {sheet_path_raw}")
                            elif item.get("sha256") != sha256_file(sheet_path):
                                add(findings, "FAIL", "annotations_manifest", f"rater sheet SHA mismatch: {sheet_path_raw}")
    else:
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "rater_completion",
            "No merged annotations.csv found; completed independent rater sheets must be merged through merge_rater_annotations.py.",
        )
    if len(conditions) < 2:
        add(findings, "EMPIRICAL_BLOCKER", "arm_balance", f"Annotation key has fewer than two arms: {dict(conditions)}")
    if len(pairs) < 2:
        add(findings, "EMPIRICAL_BLOCKER", "dyad_coverage", f"Annotation key has one observed dyad: {dict(pairs)}")

    if not findings:
        add(findings, "PASS", "annotation_packet", "Annotation packet is complete and ready for analysis.")
    elif not any(f.severity == "FAIL" for f in findings):
        add(findings, "PASS", "annotation_packet_blinding", "Annotation packet schema/blinding checks pass; empirical study remains incomplete.")
    return findings


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    if "EMPIRICAL_BLOCKER" in severities:
        return "PACKET_READY_INCOMPLETE_STUDY"
    if "WARN" in severities:
        return "PASS_WITH_WARNINGS"
    return "PASS"


def render(findings: list[Finding], root: Path) -> str:
    result = verdict(findings)
    counts = Counter(f.severity for f in findings)
    lines = [
        "# Paper Annotation Audit",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "EMPIRICAL_BLOCKER", "WARN", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.extend(["", "## Findings", ""])
    for finding in findings:
        lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PACKET_READY_INCOMPLETE_STUDY` means the rater packet passes local blinding/schema checks, but the merged human-validation study is not complete.",
            "- Missing or stale source-report hashes for mutable/historical reports are empirical blockers; regenerate the blinded packet before using it as annotation evidence.",
            "- `PASS` means the packet has enough rows and a merged `annotations.csv` with at least two rater rows per keyed case for the local schema checks; agreement statistics still need to be analyzed separately.",
            "",
        ]
    )
    return "\n".join(lines)


def write_fixture(root: Path, rows: int = 4, merged_annotations: bool = False) -> None:
    base = root / "docs/paper/results/longitudinal"
    transcript_dir = base / "blinded_transcripts"
    transcript_dir.mkdir(parents=True, exist_ok=True)
    (root / "docs/paper").mkdir(parents=True, exist_ok=True)
    (root / "docs/paper/HUMAN_ANNOTATION_PROTOCOL.md").write_text(
        "Minimum pilot sample: 30 archived conversations.\n"
        "Minimum: 2 independent raters.\n"
        "Raters should not see:\n"
        "merge_rater_annotations.py\n"
        "case_name,rater,naturalness,emotional_binding,character_consistency,repetition\n"
        "Do not use the annotation results as evidence if raters were not blind to arm.\n",
        encoding="utf-8",
    )
    (root / "scripts/paper").mkdir(parents=True, exist_ok=True)
    (root / "scripts/paper/merge_rater_annotations.py").write_text("# fixture\n", encoding="utf-8")
    dataset_path = base / "dataset.json"
    dataset_path.write_text(
        json.dumps(
            [
                {
                    "case_name": f"conversation-c:{idx}",
                    "condition": "residue_on" if idx % 2 else "residue_off",
                    "pair": "A-B" if idx % 3 else "B-C",
                    "message_count": 4,
                    "rolling_callback": idx % 2,
                }
                for idx in range(1, rows + 1)
            ],
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    with (base / "annotation_sheet.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=REQUIRED_SHEET_COLUMNS)
        writer.writeheader()
        for idx in range(1, rows + 1):
            blind_id = f"ER-{idx:04d}"
            row = {"blind_id": blind_id, "case_ref": blind_id, "notes": ""}
            for col in RATING_COLUMNS:
                row[col] = ""
            writer.writerow(row)
    with (base / "annotation_key.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=REQUIRED_KEY_COLUMNS)
        writer.writeheader()
        for idx in range(1, rows + 1):
            blind_id = f"ER-{idx:04d}"
            writer.writerow(
                {
                    "blind_id": blind_id,
                    "case_name": f"conversation-c:{idx}",
                    "condition": "residue_on" if idx % 2 else "residue_off",
                    "pair": "A-B" if idx % 3 else "B-C",
                    "message_count": 4,
                    "rolling_callback": idx % 2,
                }
            )
            (transcript_dir / f"{blind_id}.md").write_text(f"## {blind_id}\n\n- **A**: text\n", encoding="utf-8")
    (transcript_dir / "transcripts.md").write_text("# Blinded Transcript Packet\n\n" + "\n".join(f"## ER-{idx:04d}\n\n- **A**: text\n" for idx in range(1, rows + 1)), encoding="utf-8")
    source_report = base / "results/soul-triad.md"
    source_report.parent.mkdir(parents=True, exist_ok=True)
    source_report.write_text(
        "# Fixture Source Report\n\n"
        + "\n".join(f"## conversation-c:{idx}\n\n- **A**: text\n" for idx in range(1, rows + 1)),
        encoding="utf-8",
    )
    packet_manifest = {
        "schema_version": 1,
        "generated_at": "2026-06-10T00:00:00Z",
        "kind": "annotation_packet_manifest",
        "blinding_contract": {
            "sheet_contains_condition": False,
            "sheet_contains_case_name": False,
            "sheet_case_ref_equals_blind_id": True,
            "key_separate_from_rater_sheet": True,
        },
        "sampling": {
            "target": 30,
            "min_messages": 3,
            "seed": 1234,
            "publishable_records": rows,
            "selected_records": rows,
            "stratification": "fixture",
        },
        "dataset": {"path": str(dataset_path), "sha256": sha256_file(dataset_path)},
        "sheet": {"path": str(base / "annotation_sheet.csv"), "sha256": sha256_file(base / "annotation_sheet.csv")},
        "key": {"path": str(base / "annotation_key.csv"), "sha256": sha256_file(base / "annotation_key.csv")},
        "selected_blind_ids": [f"ER-{idx:04d}" for idx in range(1, rows + 1)],
    }
    (base / "annotation_packet_manifest.json").write_text(
        json.dumps(packet_manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    transcript_files = sorted(transcript_dir.glob("ER-*.md")) + [transcript_dir / "transcripts.md"]
    transcript_manifest = {
        "schema_version": 1,
        "generated_at": "2026-06-10T00:00:00Z",
        "kind": "transcript_packet_manifest",
        "blinding_contract": {
            "condition_labels_omitted": True,
            "callback_labels_omitted": True,
            "marker_scores_omitted": True,
            "case_ids_omitted": True,
            "speaker_names_redacted": False,
        },
        "key": {"path": str(base / "annotation_key.csv"), "sha256": sha256_file(base / "annotation_key.csv")},
        "source_reports": [
            {"path": str(source_report), "sha256": sha256_file(source_report), "bytes": source_report.stat().st_size},
        ],
        "output": {
            "written": rows,
            "missing": [],
            "case_sources": [
                {
                    "blind_id": f"ER-{idx:04d}",
                    "case_name": f"conversation-c:{idx}",
                    "source_report": str(source_report),
                }
                for idx in range(1, rows + 1)
            ],
            "files": [
                {"path": str(path), "sha256": sha256_file(path), "bytes": path.stat().st_size}
                for path in transcript_files
            ],
        },
    }
    (transcript_dir / "transcript_packet_manifest.json").write_text(
        json.dumps(transcript_manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    if merged_annotations:
        with (base / "annotations.csv").open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=REQUIRED_ANNOTATION_COLUMNS)
            writer.writeheader()
            for idx in range(1, rows + 1):
                for rater in ["raterA", "raterB"]:
                    writer.writerow(
                        {
                            "case_name": f"conversation-c:{idx}",
                            "rater": rater,
                            "naturalness": 4,
                            "emotional_binding": 4,
                            "character_consistency": 4,
                            "repetition": 2,
                        }
                    )
        annotations_path = base / "annotations.csv"
        rater_sheet_paths: list[tuple[str, Path]] = []
        for rater in ["raterA", "raterB"]:
            rater_path = base / f"{rater}_completed.csv"
            with rater_path.open("w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=REQUIRED_SHEET_COLUMNS)
                writer.writeheader()
                for idx in range(1, rows + 1):
                    blind_id = f"ER-{idx:04d}"
                    writer.writerow(
                        {
                            "blind_id": blind_id,
                            "case_ref": blind_id,
                            "naturalness": 4,
                            "emotional_binding": 4,
                            "character_consistency": 4,
                            "repetition": 2,
                            "notes": "",
                        }
                    )
            rater_sheet_paths.append((rater, rater_path))
        manifest = {
            "schema_version": 1,
            "generated_at": "2026-06-10T00:00:00Z",
            "blinding_contract": {
                "rater_inputs_are_blinded": True,
                "key_not_shared_with_raters": True,
                "condition_columns_absent_from_rater_sheets": True,
            },
            "key": {"path": str(base / "annotation_key.csv"), "sha256": sha256_file(base / "annotation_key.csv")},
            "rater_sheets": [
                {"rater": rater, "path": str(path), "sha256": sha256_file(path)}
                for rater, path in rater_sheet_paths
            ],
            "output": {
                "path": str(annotations_path),
                "sha256": sha256_file(annotations_path),
                "rows": rows * 2,
                "cases": rows,
                "raters": ["raterA", "raterB"],
                "min_raters": 2,
            },
        }
        (base / "annotations_manifest.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_fixture(root)
        findings = audit_annotations(root)
        assert verdict(findings) == "PACKET_READY_INCOMPLETE_STUDY"
        assert not any(f.severity == "FAIL" for f in findings)

        root2 = Path(tmp) / "complete"
        write_fixture(root2, rows=30, merged_annotations=True)
        findings = audit_annotations(root2)
        assert verdict(findings) == "PASS"

        (root2 / "docs/paper/results/longitudinal/annotations_manifest.json").unlink()
        findings = audit_annotations(root2)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "annotations_manifest" for f in findings)
        write_fixture(root2, rows=30, merged_annotations=True)

        (root2 / "docs/paper/results/longitudinal/annotation_packet_manifest.json").unlink()
        findings = audit_annotations(root2)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "annotation_packet_manifest" for f in findings)
        write_fixture(root2, rows=30, merged_annotations=True)

        (root2 / "docs/paper/results/longitudinal/blinded_transcripts/transcripts.md").write_text(
            "condition: residue_on\n",
            encoding="utf-8",
        )
        findings = audit_annotations(root2)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "transcript_leakage" for f in findings)
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "docs/paper/results/annotation-audit.md")
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero on any non-PASS finding.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_annotations(args.root)
    report = render(findings, args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(report)
    if verdict(findings) == "FAIL" or (args.strict and any(f.severity != "PASS" for f in findings)):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

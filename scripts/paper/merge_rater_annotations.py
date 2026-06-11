#!/usr/bin/env python3
"""Merge completed blinded rater sheets into analyze.py annotations.csv.

Raters receive sheets keyed by `blind_id`. The analysis pipeline expects
`case_name,rater,...`, so this script joins rater-visible rows back through the
separate annotation key after ratings are complete.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import tempfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


RATING_COLUMNS = [
    "naturalness",
    "emotional_binding",
    "character_consistency",
    "repetition",
]
RATER_SHEET_COLUMNS = ["blind_id", "case_ref", *RATING_COLUMNS, "notes"]
OUTPUT_COLUMNS = ["case_name", "rater", *RATING_COLUMNS]


@dataclass
class RaterInput:
    rater: str
    path: Path


def parse_rater_arg(value: str) -> RaterInput:
    if "=" not in value:
        raise argparse.ArgumentTypeError("--rater must be formatted as RATER_ID=path/to/sheet.csv")
    rater, raw_path = value.split("=", 1)
    rater = rater.strip()
    if not rater:
        raise argparse.ArgumentTypeError("rater id must not be empty")
    return RaterInput(rater=rater, path=Path(raw_path))


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def csv_columns(path: Path) -> list[str]:
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        return next(reader)


def load_key(path: Path) -> dict[str, str]:
    rows = read_csv(path)
    mapping: dict[str, str] = {}
    for row in rows:
        blind_id = (row.get("blind_id") or "").strip()
        case_name = (row.get("case_name") or "").strip()
        if not blind_id or not case_name:
            raise ValueError(f"{path} has a row with missing blind_id/case_name")
        if blind_id in mapping:
            raise ValueError(f"{path} has duplicate blind_id {blind_id}")
        mapping[blind_id] = case_name
    return mapping


def validate_rating(value: str, *, rater: str, blind_id: str, column: str) -> str:
    cleaned = value.strip()
    if not cleaned.isdigit() or not (1 <= int(cleaned) <= 5):
        raise ValueError(f"{rater}:{blind_id} has invalid {column} value {value!r}; expected integer 1..5")
    return cleaned


def merge_raters(key_path: Path, rater_inputs: list[RaterInput], min_raters: int) -> list[dict[str, str]]:
    if len({item.rater for item in rater_inputs}) != len(rater_inputs):
        raise ValueError("rater ids must be unique")
    if len(rater_inputs) < min_raters:
        raise ValueError(f"need at least {min_raters} raters, got {len(rater_inputs)}")

    key = load_key(key_path)
    expected_ids = list(key)
    output: list[dict[str, str]] = []

    for item in rater_inputs:
        columns = csv_columns(item.path)
        if columns != RATER_SHEET_COLUMNS:
            raise ValueError(
                f"{item.rater} sheet columns {columns} do not match the blinded sheet schema {RATER_SHEET_COLUMNS}; "
                "do not merge sheets that include condition, case_name, rolling_callback, or other unblinded columns"
            )
        rows = read_csv(item.path)
        row_ids = [(row.get("blind_id") or "").strip() for row in rows]
        duplicate_ids = sorted(blind_id for blind_id, count in Counter(row_ids).items() if blind_id and count > 1)
        if duplicate_ids:
            raise ValueError(f"{item.rater} sheet has duplicate blind ids: {', '.join(duplicate_ids)}")
        by_blind_id = {(row.get("blind_id") or "").strip(): row for row in rows}
        missing = [blind_id for blind_id in expected_ids if blind_id not in by_blind_id]
        extra = sorted(blind_id for blind_id in by_blind_id if blind_id and blind_id not in key)
        if missing:
            raise ValueError(f"{item.rater} sheet missing blind ids: {', '.join(missing)}")
        if extra:
            raise ValueError(f"{item.rater} sheet has unknown blind ids: {', '.join(extra)}")

        for blind_id in expected_ids:
            row = by_blind_id[blind_id]
            if (row.get("case_ref") or "").strip() != blind_id:
                raise ValueError(f"{item.rater}:{blind_id} has case_ref {row.get('case_ref')!r}; expected the blind_id")
            merged = {
                "case_name": key[blind_id],
                "rater": item.rater,
            }
            for column in RATING_COLUMNS:
                merged[column] = validate_rating(
                    row.get(column, ""),
                    rater=item.rater,
                    blind_id=blind_id,
                    column=column,
                )
            output.append(merged)
    return output


def write_annotations(rows: list[dict[str, str]], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_manifest(
    *,
    key_path: Path,
    rater_inputs: list[RaterInput],
    annotations_path: Path,
    manifest_path: Path,
    rows: list[dict[str, str]],
    min_raters: int,
) -> None:
    case_names = sorted({row["case_name"] for row in rows})
    rater_ids = [item.rater for item in rater_inputs]
    manifest = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "blinding_contract": {
            "rater_inputs_are_blinded": True,
            "key_not_shared_with_raters": True,
            "condition_columns_absent_from_rater_sheets": True,
        },
        "key": {
            "path": str(key_path),
            "sha256": sha256_file(key_path),
        },
        "rater_sheets": [
            {
                "rater": item.rater,
                "path": str(item.path),
                "sha256": sha256_file(item.path),
            }
            for item in rater_inputs
        ],
        "output": {
            "path": str(annotations_path),
            "sha256": sha256_file(annotations_path),
            "rows": len(rows),
            "cases": len(case_names),
            "raters": rater_ids,
            "min_raters": min_raters,
        },
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def selftest() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        key = root / "annotation_key.csv"
        key.write_text(
            "blind_id,case_name,condition,pair,message_count,rolling_callback\n"
            "ER-0001,conversation-c:1,residue_on,A-B,4,1\n"
            "ER-0002,conversation-c:2,residue_off,A-B,4,0\n",
            encoding="utf-8",
        )
        for rater in ["raterA", "raterB"]:
            (root / f"{rater}.csv").write_text(
                "blind_id,case_ref,naturalness,emotional_binding,character_consistency,repetition,notes\n"
                "ER-0001,ER-0001,4,5,4,2,\n"
                "ER-0002,ER-0002,3,4,4,1,\n",
                encoding="utf-8",
            )
        rows = merge_raters(
            key,
            [
                RaterInput("raterA", root / "raterA.csv"),
                RaterInput("raterB", root / "raterB.csv"),
            ],
            min_raters=2,
        )
        assert len(rows) == 4
        assert rows[0]["case_name"] == "conversation-c:1"
        assert rows[0]["rater"] == "raterA"
        out = root / "annotations.csv"
        write_annotations(rows, out)
        assert out.read_text(encoding="utf-8").splitlines()[0] == ",".join(OUTPUT_COLUMNS)
        manifest = root / "annotations_manifest.json"
        write_manifest(
            key_path=key,
            rater_inputs=[
                RaterInput("raterA", root / "raterA.csv"),
                RaterInput("raterB", root / "raterB.csv"),
            ],
            annotations_path=out,
            manifest_path=manifest,
            rows=rows,
            min_raters=2,
        )
        parsed_manifest = json.loads(manifest.read_text(encoding="utf-8"))
        assert parsed_manifest["output"]["rows"] == 4
        assert parsed_manifest["blinding_contract"]["rater_inputs_are_blinded"] is True

        (root / "bad.csv").write_text(
            "blind_id,case_ref,naturalness,emotional_binding,character_consistency,repetition,notes\n"
            "ER-0001,ER-0001,9,5,4,2,\n"
            "ER-0002,ER-0002,3,4,4,1,\n",
            encoding="utf-8",
        )
        try:
            merge_raters(key, [RaterInput("bad", root / "bad.csv"), RaterInput("raterB", root / "raterB.csv")], 2)
        except ValueError as exc:
            assert "invalid naturalness" in str(exc)
        else:
            raise AssertionError("expected invalid rating to fail")
        (root / "leaky.csv").write_text(
            "blind_id,case_ref,naturalness,emotional_binding,character_consistency,repetition,notes,condition\n"
            "ER-0001,ER-0001,4,5,4,2,,residue_on\n"
            "ER-0002,ER-0002,3,4,4,1,,residue_off\n",
            encoding="utf-8",
        )
        try:
            merge_raters(key, [RaterInput("leaky", root / "leaky.csv"), RaterInput("raterB", root / "raterB.csv")], 2)
        except ValueError as exc:
            assert "do not merge sheets" in str(exc)
        else:
            raise AssertionError("expected leaky rater sheet to fail")
        (root / "bad_ref.csv").write_text(
            "blind_id,case_ref,naturalness,emotional_binding,character_consistency,repetition,notes\n"
            "ER-0001,conversation-c:1,4,5,4,2,\n"
            "ER-0002,ER-0002,3,4,4,1,\n",
            encoding="utf-8",
        )
        try:
            merge_raters(key, [RaterInput("badRef", root / "bad_ref.csv"), RaterInput("raterB", root / "raterB.csv")], 2)
        except ValueError as exc:
            assert "case_ref" in str(exc)
        else:
            raise AssertionError("expected unblinded case_ref to fail")
    print("merge_rater_annotations selftest: PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--key", help="annotation_key.csv")
    parser.add_argument(
        "--rater",
        action="append",
        type=parse_rater_arg,
        default=[],
        help="Completed blinded sheet, formatted as RATER_ID=path/to/sheet.csv. Repeat for each rater.",
    )
    parser.add_argument("--out", default="docs/paper/results/longitudinal/annotations.csv")
    parser.add_argument(
        "--manifest",
        help="annotations provenance manifest path; defaults to <out stem>_manifest.json",
    )
    parser.add_argument("--min-raters", type=int, default=2)
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        return selftest()
    if not args.key:
        parser.error("--key is required unless --selftest is used")

    rows = merge_raters(Path(args.key), args.rater, args.min_raters)
    out_path = Path(args.out)
    write_annotations(rows, out_path)
    manifest_path = Path(args.manifest) if args.manifest else out_path.with_name(f"{out_path.stem}_manifest.json")
    write_manifest(
        key_path=Path(args.key),
        rater_inputs=args.rater,
        annotations_path=out_path,
        manifest_path=manifest_path,
        rows=rows,
        min_raters=args.min_raters,
    )
    print(
        f"wrote {len(rows)} annotation ratings from {len(args.rater)} raters -> {args.out}; "
        f"manifest -> {manifest_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

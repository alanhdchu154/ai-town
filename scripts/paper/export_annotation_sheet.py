#!/usr/bin/env python3
"""Export a blinded human-annotation sheet from a paper dataset.

The dataset keeps `condition` and `pair`; raters should not see those fields.
This script samples archived/publishable records, writes a blinded sheet with
blank Likert columns, and writes a separate key for analysis/reconciliation.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
from datetime import datetime, timezone
from collections import defaultdict
from pathlib import Path


RATING_COLUMNS = [
    "naturalness",
    "emotional_binding",
    "character_consistency",
    "repetition",
]


def is_publishable(record: dict, min_messages: int) -> bool:
    case_name = str(record.get("case_name") or "")
    if case_name.startswith("active-conversation-"):
        return False
    try:
        return int(record.get("message_count") or 0) >= min_messages
    except (TypeError, ValueError):
        return False


def sample_records(records: list[dict], target: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    strata: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for record in records:
        strata[(str(record.get("condition") or "na"), str(record.get("pair") or "unknown"))].append(record)
    for values in strata.values():
        rng.shuffle(values)

    selected = []
    keys = sorted(strata)
    while len(selected) < target and keys:
        progressed = False
        for key in list(keys):
            values = strata[key]
            if not values:
                keys.remove(key)
                continue
            selected.append(values.pop())
            progressed = True
            if len(selected) >= target:
                break
        if not progressed:
            break
    return selected


def write_outputs(records: list[dict], out_sheet: Path, out_key: Path) -> None:
    out_sheet.parent.mkdir(parents=True, exist_ok=True)
    out_key.parent.mkdir(parents=True, exist_ok=True)
    sheet_fields = ["blind_id", "case_ref", *RATING_COLUMNS, "notes"]
    key_fields = [
        "blind_id",
        "case_name",
        "condition",
        "pair",
        "message_count",
        "rolling_callback",
    ]
    with out_sheet.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=sheet_fields)
        writer.writeheader()
        for idx, record in enumerate(records, start=1):
            blind_id = f"ER-{idx:04d}"
            writer.writerow(
                {
                    "blind_id": blind_id,
                    "case_ref": blind_id,
                    "naturalness": "",
                    "emotional_binding": "",
                    "character_consistency": "",
                    "repetition": "",
                    "notes": "",
                }
            )
    with out_key.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=key_fields)
        writer.writeheader()
        for idx, record in enumerate(records, start=1):
            writer.writerow(
                {
                    "blind_id": f"ER-{idx:04d}",
                    "case_name": record.get("case_name"),
                    "condition": record.get("condition"),
                    "pair": record.get("pair"),
                    "message_count": record.get("message_count"),
                    "rolling_callback": record.get("rolling_callback"),
                }
            )


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_manifest(
    *,
    dataset_path: Path,
    out_sheet: Path,
    out_key: Path,
    manifest_path: Path,
    publishable_count: int,
    selected_records: list[dict],
    target: int,
    min_messages: int,
    seed: int,
) -> None:
    manifest = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "kind": "annotation_packet_manifest",
        "blinding_contract": {
            "sheet_contains_condition": False,
            "sheet_contains_case_name": False,
            "sheet_case_ref_equals_blind_id": True,
            "key_separate_from_rater_sheet": True,
        },
        "sampling": {
            "target": target,
            "min_messages": min_messages,
            "seed": seed,
            "publishable_records": publishable_count,
            "selected_records": len(selected_records),
            "stratification": "condition x pair round-robin without replacement",
        },
        "dataset": {
            "path": str(dataset_path),
            "sha256": sha256_file(dataset_path),
        },
        "sheet": {
            "path": str(out_sheet),
            "sha256": sha256_file(out_sheet),
        },
        "key": {
            "path": str(out_key),
            "sha256": sha256_file(out_key),
        },
        "selected_blind_ids": [f"ER-{idx:04d}" for idx in range(1, len(selected_records) + 1)],
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def selftest() -> int:
    records = []
    for idx in range(12):
        records.append(
            {
                "case_name": f"conversation-c:{idx}",
                "condition": "residue_on" if idx % 2 else "residue_off",
                "pair": "A-B" if idx % 3 else "B-C",
                "message_count": 4,
                "rolling_callback": idx % 2,
            }
        )
    sampled = sample_records(records, target=8, seed=1234)
    if len(sampled) != 8:
        raise AssertionError(f"expected 8 sampled records, got {len(sampled)}")
    if len({(row["condition"], row["pair"]) for row in sampled}) < 2:
        raise AssertionError("expected stratified sample to include multiple strata")
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        dataset = root / "dataset.json"
        sheet = root / "annotation_sheet.csv"
        key = root / "annotation_key.csv"
        manifest = root / "annotation_packet_manifest.json"
        dataset.write_text(json.dumps(records), encoding="utf-8")
        write_outputs(sampled, sheet, key)
        write_manifest(
            dataset_path=dataset,
            out_sheet=sheet,
            out_key=key,
            manifest_path=manifest,
            publishable_count=len(records),
            selected_records=sampled,
            target=8,
            min_messages=3,
            seed=1234,
        )
        parsed = json.loads(manifest.read_text(encoding="utf-8"))
        assert parsed["sheet"]["sha256"] == sha256_file(sheet)
        assert parsed["blinding_contract"]["sheet_contains_condition"] is False
    print("export_annotation_sheet selftest: PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", help="input dataset.json")
    parser.add_argument("--out-sheet", default="docs/paper/annotation_sheet.csv")
    parser.add_argument("--out-key", default="docs/paper/annotation_key.csv")
    parser.add_argument(
        "--manifest",
        help="annotation packet manifest path; defaults to <out-sheet dir>/annotation_packet_manifest.json",
    )
    parser.add_argument("--target", type=int, default=30)
    parser.add_argument("--min-messages", type=int, default=3)
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        return selftest()
    if not args.dataset:
        parser.error("--dataset is required unless --selftest is used")

    dataset_path = Path(args.dataset)
    records = json.loads(dataset_path.read_text(encoding="utf-8"))
    publishable = [record for record in records if is_publishable(record, args.min_messages)]
    selected = sample_records(publishable, target=args.target, seed=args.seed)
    out_sheet = Path(args.out_sheet)
    out_key = Path(args.out_key)
    write_outputs(selected, out_sheet, out_key)
    manifest_path = Path(args.manifest) if args.manifest else out_sheet.parent / "annotation_packet_manifest.json"
    write_manifest(
        dataset_path=dataset_path,
        out_sheet=out_sheet,
        out_key=out_key,
        manifest_path=manifest_path,
        publishable_count=len(publishable),
        selected_records=selected,
        target=args.target,
        min_messages=args.min_messages,
        seed=args.seed,
    )
    print(
        "wrote {} annotation rows from {} publishable records -> {}, {}, manifest {}".format(
            len(selected), len(publishable), args.out_sheet, args.out_key, manifest_path
        )
    )
    if len(selected) < args.target:
        print("warning: dataset did not contain enough publishable records to reach target")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

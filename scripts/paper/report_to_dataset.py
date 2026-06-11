#!/usr/bin/env python3
"""report_to_dataset.py — bridge the existing soul-triad eval report into the
paper's dataset.json contract consumed by analyze.py.

The repo's `npm run eval:soul-triad` already scores every recent conversation and
writes a markdown table to `evals/conversations/reports/soul-triad-latest.md`.
This script parses that table (column order is fixed by runSoulTriadEval.ts) and
emits dataset.json records.

Pipeline (run by Codex / Alan on a machine with Convex + an LLM):

    # residue ON arm
    npm run eval:soul-triad
    cp evals/conversations/reports/soul-triad-latest.md /tmp/triad_on.md
    # residue OFF arm
    UNDERWORLD_RESIDUE_READ=false npm run eval:soul-triad
    cp evals/conversations/reports/soul-triad-latest.md /tmp/triad_off.md

    python scripts/paper/report_to_dataset.py \
        --report /tmp/triad_on.md  --condition residue_on  --out on.json
    python scripts/paper/report_to_dataset.py \
        --report /tmp/triad_off.md --condition residue_off --out off.json
    python scripts/paper/report_to_dataset.py \
        --report /tmp/triad_placebo.md --condition residue_placebo --out placebo.json
    python scripts/paper/report_to_dataset.py --merge on.json off.json --out dataset.json

Then: python scripts/paper/analyze.py --dataset dataset.json [...]

dataset.json record shape — see scripts/paper/README.md.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Column order is fixed by writeReport() in evals/conversations/runSoulTriadEval.ts.
# (0-indexed positions within each "| ... |" data row.)
COLUMNS = [
    "id", "participants", "messages", "status", "score",
    "other_awareness", "private_self", "memory_residue", "memory_continuity",
    "behavior_signal", "emotion_behavior_link", "emotion_tone_link",
    "attention_shift", "relationship_residue", "over_labeling_penalty",
    "tianze_pressure", "ichinose_debt", "umi_alan_anchor",
    "emotional_expression_uniqueness", "comfort_style_uniqueness",
    "burden_response_uniqueness", "imperfect_response_style", "indirectness",
    "lifecycle_flow", "greeting_boilerplate_penalty", "emotional_slogan_penalty",
    "human_aftertaste_score", "echo_similarity_penalty", "role_escape_penalty",
    "over_system_penalty", "over_articulation_penalty", "therapy_empathy_penalty",
    "template_penalty", "stage_direction_leak_penalty", "echo_penalty",
]
# Everything from index 5 onward is a 0..1 marker that goes into record["metrics"].
FIRST_METRIC_IDX = 5
HEADER_RE = re.compile(r"^\|\s*Conversation\s*\|\s*Participants\s*\|")


def _sorted_pair(participants_field: str) -> str:
    """'海 / 真晝' -> 'Mahiru-Umi'? We keep raw names but sorted+joined.

    We do NOT translate names (the report may emit zh or en). We sort the raw
    participant tokens so the same unordered pair always maps to one key.
    """
    names = [p.strip() for p in re.split(r"[/／]", participants_field) if p.strip()]
    return "-".join(sorted(names))


def parse_report(
    text: str,
    condition: str,
    min_messages: int = 0,
    exclude_active: bool = False,
    generation_metadata: dict | None = None,
    run_provenance: dict | None = None,
    source_run: str | None = None,
    window: str | None = None,
    collection_day: str | None = None,
) -> list[dict]:
    lines = text.splitlines()
    # locate the metric table header
    start = next((i for i, ln in enumerate(lines) if HEADER_RE.match(ln)), None)
    if start is None:
        raise ValueError("No soul-triad metric table found (header row missing)")
    records = []
    # Data rows start after header(+separator). The current eval report writes
    # rows as `conversation-c:... | ...` without a leading/trailing pipe, while
    # many markdown tables use `| ... |`. Accept both; stop at the blank line
    # before transcript sections.
    for ln in lines[start + 2:]:
        stripped = ln.strip()
        if not stripped or stripped.startswith("## "):
            break
        if stripped.startswith("|---"):
            continue
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        if len(cells) < len(COLUMNS):
            continue  # malformed / separator-like row
        row = dict(zip(COLUMNS, cells))
        try:
            message_count = int(float(row["messages"]))
            if message_count < min_messages:
                continue
            if exclude_active and row["id"].startswith("active-conversation-"):
                continue
            metrics = {}
            for idx in range(FIRST_METRIC_IDX, len(COLUMNS)):
                key = COLUMNS[idx]
                metrics[key] = float(cells[idx])
            rec = {
                "case_name": row["id"],
                "message_count": message_count,
                "pair": _sorted_pair(row["participants"]),
                "speaker": "",          # report does not split speaker/target
                "target": "",
                "condition": condition,
                "window": window,
                "source_run": source_run,
                "collection_day": collection_day,
                "overall_score": float(row["score"]),
                "status": row["status"],
                "metrics": metrics,
                "rolling_callback": None,
                "residue_candidate": None,
            }
            if generation_metadata is not None:
                rec["generation_metadata"] = generation_metadata
            if run_provenance is not None:
                rec["run_provenance"] = run_provenance
        except ValueError:
            continue  # a cell wasn't numeric -> skip row
        records.append(rec)
    return records


def _selftest() -> int:
    # Build synthetic reports in the exact column order and round-trip them.
    # The first row intentionally mirrors the real soul-triad report format:
    # no leading or trailing pipe on data rows.
    header = ("| Conversation | Participants | Messages | Status | Score | "
              "Other aware | Private self | Memory residue | Memory continuity | "
              "Behavior | Emotion behavior | Emotion tone | Attention shift | "
              "Relationship residue | Over labeling penalty | Tianze pressure | "
              "Ichinose debt | Umi Alan anchor | Expression unique | Comfort unique | "
              "Burden unique | Imperfect style | Indirectness | Lifecycle flow | "
              "Greeting boilerplate penalty | Emotional slogan penalty | "
              "Human aftertaste | Echo similarity penalty | Role penalty | "
              "System penalty | Over articulation penalty | Therapy empathy penalty | "
              "Template penalty | Stage direction leak penalty | Echo penalty |")
    sep = "|" + "---|" * len(COLUMNS)
    # Two rows, 35 columns each: id, participants, 33 numeric-ish values. The
    # first uses the real report row style; the second uses pipe-wrapped style.
    vals = ["c-1001", "海 / 真晝", "6", "PASS"] + [f"{0.5:.2f}"] * (len(COLUMNS) - 4)
    real_style_row = " | ".join(vals)
    wrapped_row = "| " + " | ".join(["c-1002", "海 / 天澤", "5", "WARN"] + [f"{0.4:.2f}"] * (len(COLUMNS) - 4)) + " |"
    report = "\n".join([
        "# Soul Triad Conversation Harness",
        "",
        header,
        sep,
        real_style_row,
        wrapped_row,
        "",
        "## c-1001",
    ])
    recs = parse_report(report, "residue_on")
    assert len(recs) == 2, f"expected 2 records, got {len(recs)}"
    r = recs[0]
    assert r["pair"] == "海-真晝", r["pair"]
    assert r["status"] == "PASS"
    assert abs(r["overall_score"] - 0.5) < 1e-9
    for k in ("emotional_expression_uniqueness", "comfort_style_uniqueness",
              "burden_response_uniqueness", "human_aftertaste_score",
              "echo_similarity_penalty", "stage_direction_leak_penalty"):
        assert k in r["metrics"], f"missing marker {k}"
    assert recs[1]["pair"] == "天澤-海", recs[1]["pair"]
    active_vals = ["active-conversation-c:1", "海 / 天澤", "2", "FAIL"] + [f"{0.3:.2f}"] * (len(COLUMNS) - 4)
    active_report = "\n".join([
        "# Soul Triad Conversation Harness",
        "",
        header,
        sep,
        " | ".join(active_vals),
        real_style_row,
        "",
    ])
    filtered = parse_report(active_report, "residue_on", min_messages=3, exclude_active=True)
    assert len(filtered) == 1, f"expected one archived >=3-message record, got {len(filtered)}"
    assert filtered[0]["case_name"] == "c-1001"
    with_metadata = parse_report(report, "residue_on", generation_metadata={"provider": "fixture"})
    assert with_metadata[0]["generation_metadata"]["provider"] == "fixture"
    with_provenance = parse_report(report, "residue_on", run_provenance={"schema_version": 1, "run_id": "fixture"})
    assert with_provenance[0]["run_provenance"]["run_id"] == "fixture"
    with_cluster_metadata = parse_report(
        report,
        "residue_on",
        source_run="run-fixture",
        window="08:00-12:00",
        collection_day="2026-06-09",
    )
    assert with_cluster_metadata[0]["source_run"] == "run-fixture"
    assert with_cluster_metadata[0]["window"] == "08:00-12:00"
    assert with_cluster_metadata[0]["collection_day"] == "2026-06-09"
    print("report_to_dataset selftest: PASS (real-style + pipe-wrapped rows parsed)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--report", help="path to soul-triad-latest.md")
    ap.add_argument("--condition", default="na",
                    choices=["residue_on", "residue_off", "residue_placebo", "na"])
    ap.add_argument("--out", help="output dataset.json path")
    ap.add_argument("--merge", nargs="+", help="merge several dataset.json files")
    ap.add_argument("--min-messages", type=int, default=0,
                    help="drop rows with fewer than this many messages")
    ap.add_argument("--exclude-active", action="store_true",
                    help="drop active-conversation-* rows; use for publishable datasets")
    ap.add_argument("--metadata-json",
                    help="optional JSON metadata attached to every parsed record")
    ap.add_argument("--provenance-json",
                    help="optional run provenance JSON attached to every parsed record")
    ap.add_argument("--source-run", help="source run/window id attached to every parsed record")
    ap.add_argument("--window", help="analysis/collection window label attached to every parsed record")
    ap.add_argument("--collection-day", help="collection day attached to every parsed record")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        return _selftest()

    if args.merge:
        merged: list[dict] = []
        for p in args.merge:
            merged.extend(json.loads(Path(p).read_text()))
        out = args.out or "dataset.json"
        Path(out).write_text(json.dumps(merged, ensure_ascii=False, indent=2))
        print(f"merged {len(merged)} records -> {out}")
        return 0

    if not args.report or not args.out:
        ap.error("--report and --out are required (or use --merge / --selftest)")
    recs = parse_report(
        Path(args.report).read_text(),
        args.condition,
        min_messages=args.min_messages,
        exclude_active=args.exclude_active,
        generation_metadata=json.loads(Path(args.metadata_json).read_text()) if args.metadata_json else None,
        run_provenance=json.loads(Path(args.provenance_json).read_text()) if args.provenance_json else None,
        source_run=args.source_run,
        window=args.window,
        collection_day=args.collection_day,
    )
    Path(args.out).write_text(json.dumps(recs, ensure_ascii=False, indent=2))
    print(f"parsed {len(recs)} conversations ({args.condition}) -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

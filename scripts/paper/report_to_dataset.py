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
    python scripts/paper/report_to_dataset.py --merge on.json off.json --out dataset.json

Then: python scripts/paper/analyze.py --dataset dataset.json [...]

dataset.json record shape — see scripts/paper/README.md.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
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


def parse_report(text: str, condition: str) -> list[dict]:
    lines = text.splitlines()
    # locate the metric table header
    start = next((i for i, ln in enumerate(lines) if HEADER_RE.match(ln)), None)
    if start is None:
        raise ValueError("No soul-triad metric table found (header row missing)")
    records = []
    # data rows start after header(+separator); stop at first non-table line
    for ln in lines[start + 2:]:
        if not ln.strip().startswith("|"):
            break
        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        if len(cells) < len(COLUMNS):
            continue  # malformed / separator-like row
        row = dict(zip(COLUMNS, cells))
        try:
            metrics = {}
            for idx in range(FIRST_METRIC_IDX, len(COLUMNS)):
                key = COLUMNS[idx]
                metrics[key] = float(cells[idx])
            rec = {
                "case_name": row["id"],
                "pair": _sorted_pair(row["participants"]),
                "speaker": "",          # report does not split speaker/target
                "target": "",
                "condition": condition,
                "window": None,
                "overall_score": float(row["score"]),
                "status": row["status"],
                "metrics": metrics,
                "rolling_callback": None,
                "residue_candidate": None,
            }
        except ValueError:
            continue  # a cell wasn't numeric -> skip row
        records.append(rec)
    return records


def _selftest() -> int:
    # Build a synthetic report in the exact column order and round-trip it.
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
    # one row, 35 columns: id, participants, 33 numeric-ish
    vals = ["c-1001", "海 / 真晝", "6", "PASS"] + [f"{0.5:.2f}"] * (len(COLUMNS) - 4)
    row = "| " + " | ".join(vals) + " |"
    report = "\n".join(["# Soul Triad Conversation Harness", "", header, sep, row, ""])
    recs = parse_report(report, "residue_on")
    assert len(recs) == 1, f"expected 1 record, got {len(recs)}"
    r = recs[0]
    assert r["pair"] == "海-真晝", r["pair"]
    assert r["status"] == "PASS"
    assert abs(r["overall_score"] - 0.5) < 1e-9
    for k in ("emotional_expression_uniqueness", "comfort_style_uniqueness",
              "burden_response_uniqueness", "human_aftertaste_score",
              "echo_similarity_penalty", "stage_direction_leak_penalty"):
        assert k in r["metrics"], f"missing marker {k}"
    print("report_to_dataset selftest: PASS (1 record, all key markers present)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--report", help="path to soul-triad-latest.md")
    ap.add_argument("--condition", default="na",
                    choices=["residue_on", "residue_off", "na"])
    ap.add_argument("--out", help="output dataset.json path")
    ap.add_argument("--merge", nargs="+", help="merge several dataset.json files")
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
    recs = parse_report(Path(args.report).read_text(), args.condition)
    Path(args.out).write_text(json.dumps(recs, ensure_ascii=False, indent=2))
    print(f"parsed {len(recs)} conversations ({args.condition}) -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

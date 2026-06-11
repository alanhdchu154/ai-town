#!/usr/bin/env python3
"""Attach rolling-continuity callback labels to paper dataset records.

The rolling continuity report lists callback conversation ids like:

    - conversation-c:92931 (strong) <- conversation-c:92842: ...

This script reads dataset.json, marks rows whose `case_name` appears in that
callback list with `rolling_callback=1`, and can mark callback-window non-hits
as `0` when the rolling report lists the callback-window conversation ids.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

CALLBACK_RE = re.compile(r"^-\s+(conversation-[^:\s]+:[^\s]+|conversation-c:\d+)\s+\(")
WINDOW_CONVERSATION_RE = re.compile(r"^-\s+(conversation-[^:\s]+:[^\s]+|conversation-c:\d+)\s+·")


def extract_callback_ids(report_text: str) -> set[str]:
    in_section = False
    ids: set[str] = set()
    for line in report_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("## "):
            in_section = stripped == "## Rolling Callbacks Found"
            continue
        if not in_section:
            continue
        match = CALLBACK_RE.match(stripped)
        if match:
            ids.add(match.group(1))
    return ids


def extract_callback_window_ids(report_text: str) -> set[str]:
    in_section = False
    ids: set[str] = set()
    for line in report_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("## "):
            in_section = stripped == "## Callback Window Conversations"
            continue
        if not in_section:
            continue
        match = WINDOW_CONVERSATION_RE.match(stripped)
        if match:
            ids.add(match.group(1))
    return ids


def attach_callbacks(
    records: list[dict],
    callback_ids: set[str],
    mark_other_zero: bool,
    zero_ids: set[str] | None = None,
) -> list[dict]:
    out = []
    for record in records:
        updated = dict(record)
        case_name = str(updated.get("case_name") or "")
        if case_name in callback_ids:
            updated["rolling_callback"] = 1
        elif zero_ids is not None and case_name in zero_ids:
            updated["rolling_callback"] = 0
        elif mark_other_zero:
            updated["rolling_callback"] = 0
        out.append(updated)
    return out


def selftest() -> int:
    report = """
# GIIS Underworld Rolling 2-Hour Continuity Report

## Rolling Callbacks Found

- conversation-c:92931 (strong) <- conversation-c:92842: shared participant
- conversation-c:92878 (strong) <- conversation-c:92821: shared participant

## Callback Window Conversations

- conversation-c:92931 · 08:10 · 海 / 真晝
- conversation-c:00000 · 08:30 · 海 / 天澤

## Policy
"""
    ids = extract_callback_ids(report)
    assert ids == {"conversation-c:92931", "conversation-c:92878"}, ids
    callback_window_ids = extract_callback_window_ids(report)
    assert callback_window_ids == {"conversation-c:92931", "conversation-c:00000"}, callback_window_ids
    records = [
        {
            "case_name": "conversation-c:92931",
            "rolling_callback": None,
            "run_provenance": {"run_id": "fixture"},
        },
        {"case_name": "conversation-c:00000", "rolling_callback": None},
        {"case_name": "conversation-c:source", "rolling_callback": None},
    ]
    attached = attach_callbacks(records, ids, mark_other_zero=False, zero_ids=callback_window_ids)
    assert attached[0]["rolling_callback"] == 1
    assert attached[0]["run_provenance"]["run_id"] == "fixture"
    assert attached[1]["rolling_callback"] == 0
    assert attached[2]["rolling_callback"] is None
    print("attach_rolling_callbacks selftest: PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", help="input dataset.json")
    parser.add_argument("--rolling-report", help="rolling-continuity markdown report")
    parser.add_argument("--out", help="output dataset.json")
    parser.add_argument(
        "--mark-other-zero",
        action="store_true",
        help="set non-callback rows to 0 instead of leaving them null; use only when the dataset is scoped to the same report window",
    )
    parser.add_argument(
        "--mark-callback-window-zero",
        action="store_true",
        help="set callback-window non-callback rows to 0; source-window rows remain null",
    )
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        return selftest()
    if not args.dataset or not args.rolling_report or not args.out:
        parser.error("--dataset, --rolling-report, and --out are required (or use --selftest)")

    records = json.loads(Path(args.dataset).read_text(encoding="utf-8"))
    report_text = Path(args.rolling_report).read_text(encoding="utf-8")
    callback_ids = extract_callback_ids(report_text)
    zero_ids = None
    if args.mark_callback_window_zero:
        zero_ids = extract_callback_window_ids(report_text)
        if not zero_ids:
            raise SystemExit(
                "--mark-callback-window-zero requires a rolling report with "
                "a '## Callback Window Conversations' section"
            )
    updated = attach_callbacks(records, callback_ids, args.mark_other_zero, zero_ids=zero_ids)
    Path(args.out).write_text(json.dumps(updated, ensure_ascii=False, indent=2), encoding="utf-8")
    matched = sum(1 for row in updated if row.get("rolling_callback") == 1)
    print(f"attached {matched} callback labels from {len(callback_ids)} report ids -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Print current schedule/preregistration hashes for Alan acceptance.

This helper is intentionally read-only: it does not modify acceptance JSON and
does not authorize collection.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEDULE_PATH = Path("docs/paper/SCHEDULE_DECISION.md")
PREREG_PATH = Path("docs/paper/PREREGISTRATION_PROTOCOL.md")
SCHEDULE_ACCEPTANCE_PATH = Path("docs/paper/SCHEDULE_ACCEPTANCE.json")
PREREG_ACCEPTANCE_PATH = Path("docs/paper/PREREGISTRATION_ACCEPTANCE.json")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def build_report(root: Path) -> str:
    schedule = root / SCHEDULE_PATH
    prereg = root / PREREG_PATH
    schedule_acceptance = root / SCHEDULE_ACCEPTANCE_PATH
    prereg_acceptance = root / PREREG_ACCEPTANCE_PATH

    schedule_sha = sha256(schedule)
    prereg_sha = sha256(prereg)
    schedule_json = load_json(schedule_acceptance)
    prereg_json = load_json(prereg_acceptance)
    schedule_template = {
        "accepted": True,
        "accepted_by": "Alan",
        "accepted_at": "YYYY-MM-DDTHH:MM:SSZ",
        "schedule_document": str(SCHEDULE_PATH),
        "schedule_date": schedule_json.get("schedule_date", ""),
        "schedule_sha256": schedule_sha,
        "notes": "Alan explicitly accepted the schedule decision before collection.",
    }
    prereg_template = {
        "accepted": True,
        "accepted_by": "Alan",
        "accepted_at": "YYYY-MM-DDTHH:MM:SSZ",
        "preregistration_document": str(PREREG_PATH),
        "preregistration_date": prereg_json.get("preregistration_date", ""),
        "preregistration_sha256": prereg_sha,
        "notes": "Alan explicitly accepted the preregistration protocol before collection.",
    }

    lines = [
        "# Paper Acceptance Hashes",
        "",
        "Read-only helper: this does not edit acceptance JSON or start collection.",
        "",
        "## Current Document Hashes",
        "",
        f"- schedule_document: `{SCHEDULE_PATH}`",
        f"- schedule_sha256: `{schedule_sha}`",
        f"- preregistration_document: `{PREREG_PATH}`",
        f"- preregistration_sha256: `{prereg_sha}`",
        "",
        "## Current Acceptance State",
        "",
        f"- schedule accepted: `{schedule_json.get('accepted')}`",
        f"- schedule_sha256 in JSON: `{schedule_json.get('schedule_sha256', '')}`",
        f"- preregistration accepted: `{prereg_json.get('accepted')}`",
        f"- preregistration_sha256 in JSON: `{prereg_json.get('preregistration_sha256', '')}`",
        "",
        "## Fill Only After Explicit Alan Acceptance",
        "",
        f"`{SCHEDULE_ACCEPTANCE_PATH}`:",
        "",
        "```json",
        json.dumps(schedule_template, indent=2),
        "```",
        "",
        f"`{PREREG_ACCEPTANCE_PATH}`:",
        "",
        "```json",
        json.dumps(prereg_template, indent=2),
        "```",
        "",
    ]
    return "\n".join(lines)


def selftest() -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / SCHEDULE_PATH).parent.mkdir(parents=True, exist_ok=True)
        (root / PREREG_PATH).parent.mkdir(parents=True, exist_ok=True)
        (root / SCHEDULE_PATH).write_text("schedule\n", encoding="utf-8")
        (root / PREREG_PATH).write_text("prereg\n", encoding="utf-8")
        (root / SCHEDULE_ACCEPTANCE_PATH).write_text(
            json.dumps({"accepted": False, "schedule_sha256": ""}),
            encoding="utf-8",
        )
        (root / PREREG_ACCEPTANCE_PATH).write_text(
            json.dumps({"accepted": False, "preregistration_sha256": ""}),
            encoding="utf-8",
        )
        report = build_report(root)
        assert "schedule_sha256" in report
        assert "preregistration_sha256" in report
        assert str(SCHEDULE_ACCEPTANCE_PATH) in report
        assert str(PREREG_ACCEPTANCE_PATH) in report
        assert "YYYY-MM-DDTHH:MM:SSZ" in report
        assert "Read-only helper" in report
    print("SELFTEST: PASS")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, help="optional markdown output path")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        selftest()
        return 0

    report = build_report(args.root)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(report + "\n", encoding="utf-8")
    print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

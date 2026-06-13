#!/usr/bin/env python3
"""Merge qualifying records from multiple residue ablation run directories.

Use this for longitudinal collection. Legacy `paper:residue-ablation` runs may
write arm subdirectories, while the primary long-window runner writes a single
arm-window directory. This script drops active/short records by default,
de-duplicates by `(case_name, condition)`, annotates each row with its source run
directory, and refuses to merge future arm-window runs whose local provenance
audit fails.
"""
from __future__ import annotations

import argparse
import glob
import json
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import paper_run_provenance_audit  # noqa: E402


@dataclass
class RunSummary:
    run_dir: str
    provenance_required: bool
    provenance_verdict: str | None = None
    loaded_rows: int = 0
    merged_rows: int = 0
    dropped_rows: int = 0
    dataset_paths: list[str] = field(default_factory=list)


def is_long_window_run(run_dir: Path) -> bool:
    return run_dir.name.startswith("arm-window-") or (run_dir / "run-provenance.json").exists()


def load_run_dataset(run_dir: Path) -> tuple[list[dict], list[Path]]:
    arm_paths = [run_dir / arm / "dataset.json" for arm in ("on", "off", "placebo")]
    if any(path.exists() for path in arm_paths):
        rows: list[dict] = []
        paths: list[Path] = []
        for dataset_path in arm_paths:
            if not dataset_path.exists():
                continue
            paths.append(dataset_path)
            data = json.loads(dataset_path.read_text())
            if not isinstance(data, list):
                raise ValueError(f"{dataset_path} is not a JSON list")
            for row in data:
                copied = dict(row)
                copied.setdefault("source_run", run_dir.name)
                rows.append(copied)
        return rows, paths

    dataset_path = run_dir / "dataset.json"
    if not dataset_path.exists():
        return [], []
    data = json.loads(dataset_path.read_text())
    if not isinstance(data, list):
        raise ValueError(f"{dataset_path} is not a JSON list")
    rows = []
    for row in data:
        copied = dict(row)
        copied.setdefault("source_run", run_dir.name)
        rows.append(copied)
    return rows, [dataset_path]


def publishable(row: dict, min_messages: int, exclude_active: bool) -> bool:
    case_name = str(row.get("case_name", ""))
    if exclude_active and case_name.startswith("active-conversation-"):
        return False
    if int(row.get("message_count") or 0) < min_messages:
        return False
    if row.get("condition") not in {"residue_on", "residue_off", "residue_placebo"}:
        return False
    return True


def expand_run_dirs(patterns: list[str]) -> list[Path]:
    run_dirs: list[Path] = []
    for pattern in patterns:
        matches = sorted(glob.glob(pattern))
        if matches:
            run_dirs.extend(Path(match) for match in matches)
        else:
            run_dirs.append(Path(pattern))
    return run_dirs


def audit_if_required(run_dir: Path, require_all: bool) -> tuple[bool, str | None, list[str]]:
    required = require_all or is_long_window_run(run_dir)
    if not required:
        return False, None, []
    findings = paper_run_provenance_audit.audit_run(run_dir)
    verdict = paper_run_provenance_audit.verdict(findings)
    details = [f"{finding.severity}/{finding.check}: {finding.detail}" for finding in findings]
    return True, verdict, details


def merge_runs(
    run_dirs: list[Path],
    *,
    min_messages: int,
    include_active: bool,
    require_provenance: bool = False,
) -> tuple[list[dict], list[RunSummary]]:
    seen: set[tuple[str, str]] = set()
    merged: list[dict] = []
    summaries: list[RunSummary] = []
    for run_dir in run_dirs:
        provenance_required, provenance_verdict, provenance_details = audit_if_required(
            run_dir,
            require_all=require_provenance,
        )
        summary = RunSummary(
            run_dir=str(run_dir),
            provenance_required=provenance_required,
            provenance_verdict=provenance_verdict,
        )
        summaries.append(summary)
        if provenance_required and provenance_verdict != "PASS":
            detail = "; ".join(provenance_details[:5])
            raise ValueError(
                f"{run_dir} failed required provenance audit ({provenance_verdict}). "
                f"Run `npm run paper:run-provenance-audit -- --run-dir {run_dir}` first. {detail}"
            )

        rows, dataset_paths = load_run_dataset(run_dir)
        summary.loaded_rows = len(rows)
        summary.dataset_paths = [str(path) for path in dataset_paths]
        for row in rows:
            if not publishable(row, min_messages, not include_active):
                summary.dropped_rows += 1
                continue
            key = (str(row.get("case_name")), str(row.get("condition")))
            if key in seen:
                summary.dropped_rows += 1
                continue
            seen.add(key)
            merged.append(row)
            summary.merged_rows += 1
    return merged, summaries


def condition_counts(rows: list[dict]) -> dict[str, int]:
    return {
        "residue_on": sum(1 for row in rows if row.get("condition") == "residue_on"),
        "residue_off": sum(1 for row in rows if row.get("condition") == "residue_off"),
        "residue_placebo": sum(1 for row in rows if row.get("condition") == "residue_placebo"),
    }


def write_manifest(path: Path, rows: list[dict], summaries: list[RunSummary], args: argparse.Namespace) -> None:
    manifest = {
        "schema_version": 1,
        "out": args.out,
        "runs": args.runs,
        "min_messages": args.min_messages,
        "include_active": args.include_active,
        "require_provenance": args.require_provenance,
        "merged_rows": len(rows),
        "condition_counts": condition_counts(rows),
        "run_summaries": [
            {
                "run_dir": summary.run_dir,
                "provenance_required": summary.provenance_required,
                "provenance_verdict": summary.provenance_verdict,
                "loaded_rows": summary.loaded_rows,
                "merged_rows": summary.merged_rows,
                "dropped_rows": summary.dropped_rows,
                "dataset_paths": summary.dataset_paths,
            }
            for summary in summaries
        ],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        legacy = root / "docs/paper/emotional-residue/results/ablation-legacy"
        legacy.mkdir(parents=True)
        (legacy / "dataset.json").write_text(
            json.dumps(
                [
                    {
                        "case_name": "conversation-c:legacy",
                        "condition": "residue_on",
                        "message_count": 4,
                    }
                ]
            ),
            encoding="utf-8",
        )
        complete = paper_run_provenance_audit.write_fixture(root, complete=True)
        merged, summaries = merge_runs([legacy, complete], min_messages=3, include_active=False)
        assert len(merged) == 2, merged
        assert any(summary.provenance_required for summary in summaries)

        failed = paper_run_provenance_audit.write_fixture(root, complete=False)
        try:
            merge_runs([failed], min_messages=3, include_active=False)
        except ValueError as error:
            assert "failed required provenance audit" in str(error)
        else:
            raise AssertionError("expected failed provenance audit")

        try:
            merge_runs([legacy], min_messages=3, include_active=False, require_provenance=True)
        except ValueError:
            pass
        else:
            raise AssertionError("expected require_provenance to reject legacy run")
    print("merge_ablation_runs selftest: PASS")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--runs",
        nargs="+",
        default=["docs/paper/emotional-residue/results/ablation-*"],
        help="run directories or glob patterns",
    )
    ap.add_argument("--out", default="docs/paper/emotional-residue/results/longitudinal/dataset.json")
    ap.add_argument(
        "--manifest",
        help="merge manifest path; defaults to <out>.merge-manifest.json",
    )
    ap.add_argument("--min-messages", type=int, default=3)
    ap.add_argument("--include-active", action="store_true")
    ap.add_argument(
        "--require-provenance",
        action="store_true",
        help="require every run directory, including legacy ablation dirs, to pass paper_run_provenance_audit",
    )
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        run_selftest()
        return 0

    run_dirs = expand_run_dirs(args.runs)
    merged, summaries = merge_runs(
        run_dirs,
        min_messages=args.min_messages,
        include_active=args.include_active,
        require_provenance=args.require_provenance,
    )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    manifest_path = Path(args.manifest) if args.manifest else out.with_suffix(out.suffix + ".merge-manifest.json")
    write_manifest(manifest_path, merged, summaries, args)
    counts = condition_counts(merged)
    dropped = sum(summary.dropped_rows for summary in summaries)
    print(
        f"merged {len(merged)} qualifying records -> {out} "
        f"(on={counts['residue_on']}, off={counts['residue_off']}, "
        f"placebo={counts['residue_placebo']}, dropped={dropped}, manifest={manifest_path})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Audit a completed arm-window run directory for provenance consistency.

This is a local file audit only. It does not start collection, mutate Convex
env, render PDFs, or perform network/external actions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
VALID_CONDITIONS = {
    "on": "residue_on",
    "off": "residue_off",
    "placebo": "residue_placebo",
}
REQUIRED_LOGS = [
    "eval-soul-triad.log",
    "rolling-continuity.log",
    "report-to-dataset.log",
    "attach-callbacks.log",
]
REQUIRED_ARTIFACTS = [
    "dataset.json",
    "soul-triad.md",
    "rolling-continuity.md",
    "generation-metadata.json",
]


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def nested_get(value: object, dotted: str) -> object:
    current = value
    for part in dotted.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def artifact_hashes_by_path(value: object) -> dict[str, dict]:
    if not isinstance(value, dict):
        return {}
    artifacts = value.get("artifacts")
    if not isinstance(artifacts, list):
        return {}
    out: dict[str, dict] = {}
    for item in artifacts:
        if isinstance(item, dict) and isinstance(item.get("path"), str):
            out[item["path"]] = item
    return out


def require_file(findings: list[Finding], run_dir: Path, relative: str) -> Path | None:
    path = run_dir / relative
    if not path.exists():
        add(findings, "FAIL", "required_file", f"Missing {relative}")
        return None
    return path


def audit_run(run_dir: Path) -> list[Finding]:
    findings: list[Finding] = []
    if not run_dir.exists() or not run_dir.is_dir():
        add(findings, "FAIL", "run_dir", f"Run directory does not exist: {run_dir}")
        return findings

    required = {
        "metadata": require_file(findings, run_dir, "metadata.json"),
        "generation": require_file(findings, run_dir, "generation-metadata.json"),
        "provenance": require_file(findings, run_dir, "run-provenance.json"),
        "dataset": require_file(findings, run_dir, "dataset.json"),
        "soul": require_file(findings, run_dir, "soul-triad.md"),
        "rolling": require_file(findings, run_dir, "rolling-continuity.md"),
        "artifact_hashes": require_file(findings, run_dir, "artifact-hashes.json"),
    }
    logs_dir = run_dir / "logs"
    if not logs_dir.exists():
        add(findings, "FAIL", "logs_dir", "Missing logs/")
    else:
        for name in REQUIRED_LOGS:
            require_file(findings, run_dir, f"logs/{name}")
    if any(f.severity == "FAIL" and f.check in {"required_file", "logs_dir"} for f in findings):
        return findings

    try:
        metadata = load_json(required["metadata"])  # type: ignore[arg-type]
        generation = load_json(required["generation"])  # type: ignore[arg-type]
        provenance = load_json(required["provenance"])  # type: ignore[arg-type]
        dataset = load_json(required["dataset"])  # type: ignore[arg-type]
        artifact_hashes = load_json(required["artifact_hashes"])  # type: ignore[arg-type]
    except json.JSONDecodeError as error:
        add(findings, "FAIL", "json_parse", f"Invalid JSON: {error}")
        return findings

    if not isinstance(metadata, dict):
        add(findings, "FAIL", "metadata_schema", "metadata.json must be an object.")
        return findings
    if not isinstance(generation, dict):
        add(findings, "FAIL", "generation_schema", "generation-metadata.json must be an object.")
    if not isinstance(provenance, dict):
        add(findings, "FAIL", "provenance_schema", "run-provenance.json must be an object.")
        return findings
    if not isinstance(dataset, list):
        add(findings, "FAIL", "dataset_schema", "dataset.json must be a list.")
        return findings

    run_id = str(metadata.get("runId") or run_dir.name)
    arm = str(metadata.get("arm") or "")
    condition = str(metadata.get("condition") or "")
    expected_condition = VALID_CONDITIONS.get(arm)
    if expected_condition and condition != expected_condition:
        add(findings, "FAIL", "condition_mapping", f"arm={arm} should map to {expected_condition}, got {condition}.")
    if nested_get(provenance, "run_id") != run_id:
        add(findings, "FAIL", "run_id", f"run_provenance run_id does not match metadata/run dir: {nested_get(provenance, 'run_id')} vs {run_id}.")
    if nested_get(provenance, "experiment.arm") != arm:
        add(findings, "FAIL", "provenance_arm", "run_provenance experiment.arm does not match metadata.")
    if nested_get(provenance, "experiment.condition") != condition:
        add(findings, "FAIL", "provenance_condition", "run_provenance experiment.condition does not match metadata.")
    if nested_get(provenance, "env_policy.secret_values_recorded") is not False:
        add(findings, "FAIL", "secret_policy", "run_provenance must record secret_values_recorded=false.")
    if nested_get(provenance, "documents.schedule.accepted") is not True:
        add(findings, "FAIL", "schedule_acceptance", "Run provenance does not show accepted schedule.")
    if nested_get(provenance, "documents.schedule.acceptance_matches_document") is not True:
        add(findings, "FAIL", "schedule_hash", "Run provenance schedule hash does not match current accepted document.")
    if nested_get(provenance, "documents.preregistration.accepted") is not True:
        add(findings, "FAIL", "preregistration_acceptance", "Run provenance does not show accepted preregistration.")
    if nested_get(provenance, "documents.preregistration.acceptance_matches_document") is not True:
        add(findings, "FAIL", "preregistration_hash", "Run provenance preregistration hash does not match current accepted document.")
    if not nested_get(provenance, "git.commit"):
        add(findings, "FAIL", "git_commit", "Run provenance is missing git.commit.")
    if not isinstance(nested_get(provenance, "git.dirty"), bool):
        add(findings, "FAIL", "git_dirty", "Run provenance is missing boolean git.dirty.")
    if nested_get(provenance, "source_archive.manifest_matches_current_sources") is not True:
        add(findings, "FAIL", "source_archive", "Source archive manifest did not match current sources at provenance capture.")
    if not nested_get(provenance, "source_archive.archive_sha256"):
        add(findings, "FAIL", "source_archive_sha", "Run provenance is missing source archive SHA.")
    if nested_get(provenance, "command.script") != "scripts/paper/run_arm_pure_residue_window.mjs":
        add(findings, "FAIL", "command_script", "Run provenance command.script is not the arm-window runner.")
    if not isinstance(nested_get(provenance, "command.argv"), list):
        add(findings, "FAIL", "command_argv", "Run provenance command.argv must be a list.")
    if not nested_get(provenance, "runtime.node"):
        add(findings, "FAIL", "runtime_node", "Run provenance is missing runtime.node.")

    if generation.get("schema_version") != 1:
        add(findings, "FAIL", "generation_schema_version", "generation_metadata schema_version must be 1.")
    if not generation.get("captured_at"):
        add(findings, "FAIL", "generation_captured_at", "generation_metadata is missing captured_at.")
    if not generation.get("llm_provider"):
        add(findings, "FAIL", "generation_provider", "generation_metadata is missing llm_provider.")

    artifacts = artifact_hashes_by_path(artifact_hashes)
    for relative in REQUIRED_ARTIFACTS:
        item = artifacts.get(relative)
        if not item:
            add(findings, "FAIL", "artifact_hash_missing", f"artifact-hashes.json does not list {relative}.")
            continue
        actual = sha256_file(run_dir / relative)
        if item.get("sha256") != actual:
            add(findings, "FAIL", "artifact_hash_mismatch", f"{relative} SHA mismatch: actual {actual}, manifest {item.get('sha256')}.")
    for name in REQUIRED_LOGS:
        relative = f"logs/{name}"
        item = artifacts.get(relative)
        if not item:
            add(findings, "FAIL", "log_hash_missing", f"artifact-hashes.json does not list {relative}.")
            continue
        actual = sha256_file(run_dir / relative)
        if item.get("sha256") != actual:
            add(findings, "FAIL", "log_hash_mismatch", f"{relative} SHA mismatch: actual {actual}, manifest {item.get('sha256')}.")

    row_conditions = Counter()
    rows_missing_provenance = 0
    rows_missing_generation = 0
    rows_wrong_source_run = 0
    rows_wrong_condition = 0
    rows_bad_window = 0
    expected_window = f"{metadata.get('windowStartIso')}--{metadata.get('windowEndIso')}"
    for row in dataset:
        if not isinstance(row, dict):
            add(findings, "FAIL", "dataset_row_schema", "dataset contains a non-object row.")
            continue
        row_conditions[str(row.get("condition"))] += 1
        if not isinstance(row.get("generation_metadata"), dict):
            rows_missing_generation += 1
        row_provenance = row.get("run_provenance")
        if not isinstance(row_provenance, dict):
            rows_missing_provenance += 1
        elif row_provenance.get("run_id") != run_id:
            rows_missing_provenance += 1
        if row.get("source_run") != run_id:
            rows_wrong_source_run += 1
        if row.get("condition") != condition:
            rows_wrong_condition += 1
        if metadata.get("windowStartIso") and metadata.get("windowEndIso") and row.get("window") != expected_window:
            rows_bad_window += 1
    if rows_missing_generation:
        add(findings, "FAIL", "row_generation_metadata", f"{rows_missing_generation}/{len(dataset)} rows lack matching generation_metadata.")
    if rows_missing_provenance:
        add(findings, "FAIL", "row_run_provenance", f"{rows_missing_provenance}/{len(dataset)} rows lack matching run_provenance.")
    if rows_wrong_source_run:
        add(findings, "FAIL", "row_source_run", f"{rows_wrong_source_run}/{len(dataset)} rows do not point to source_run={run_id}.")
    if rows_wrong_condition:
        add(findings, "FAIL", "row_condition", f"{rows_wrong_condition}/{len(dataset)} rows do not match condition={condition}.")
    if rows_bad_window:
        add(findings, "FAIL", "row_window", f"{rows_bad_window}/{len(dataset)} rows do not match the metadata window.")
    if not dataset:
        add(findings, "WARN", "dataset_empty", "Run dataset is empty; provenance may be valid, but the run contributes no publishable rows.")
    else:
        add(findings, "INFO", "dataset_rows", f"Dataset rows={len(dataset)} conditions={dict(row_conditions)}.")

    if not any(f.severity == "FAIL" for f in findings):
        add(findings, "PASS", "run_provenance", f"Run directory provenance is internally consistent: {run_dir}.")
    return findings


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    if "WARN" in severities:
        return "PASS_WITH_WARNINGS"
    return "PASS"


def render(findings: list[Finding], run_dir: Path) -> str:
    result = verdict(findings)
    counts = Counter(f.severity for f in findings)
    lines = [
        "# Paper Run Provenance Audit",
        "",
        f"Run directory: `{run_dir}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "WARN", "INFO", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.extend(["", "## Findings", ""])
    for finding in findings:
        lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PASS` means a completed arm-window run directory has the required local provenance, row metadata, and artifact/log hashes.",
            "- `PASS_WITH_WARNINGS` means the run is file-consistent but contributes no publishable rows.",
            "- `FAIL` means the run should not be merged into the paper dataset until the missing or stale provenance is resolved.",
            "",
        ]
    )
    return "\n".join(lines)


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def write_fixture(root: Path, complete: bool = True) -> Path:
    run_dir = root / "docs/paper/emotional-residue/results/arm-window-fixture-on"
    (run_dir / "logs").mkdir(parents=True, exist_ok=True)
    metadata = {
        "kind": "arm_pure_residue_window",
        "runId": "arm-window-fixture-on",
        "arm": "on",
        "condition": "residue_on",
        "windowStartIso": "2026-06-10T00:00:00.000Z",
        "windowEndIso": "2026-06-10T04:00:00.000Z",
        "records": 1,
    }
    generation = {
        "schema_version": 1,
        "captured_at": "2026-06-10T00:00:00.000Z",
        "llm_provider": "ollama",
    }
    provenance = {
        "schema_version": 1,
        "kind": "arm_pure_residue_window_run_provenance",
        "captured_at": "2026-06-10T04:00:01.000Z",
        "run_id": "arm-window-fixture-on",
        "experiment": {"arm": "on", "condition": "residue_on"},
        "command": {
            "script": "scripts/paper/run_arm_pure_residue_window.mjs",
            "argv": ["--arm=on"],
        },
        "git": {"commit": "abc123", "dirty": True},
        "documents": {
            "schedule": {"accepted": True, "acceptance_matches_document": True},
            "preregistration": {"accepted": True, "acceptance_matches_document": True},
        },
        "source_archive": {
            "archive_sha256": "def456",
            "manifest_matches_current_sources": True,
        },
        "runtime": {"node": "v22.0.0"},
        "env_policy": {"secret_values_recorded": False},
    }
    row = {
        "case_name": "conversation-c:1",
        "message_count": 4,
        "pair": "海-真晝",
        "condition": "residue_on",
        "source_run": "arm-window-fixture-on",
        "window": "2026-06-10T00:00:00.000Z--2026-06-10T04:00:00.000Z",
        "rolling_callback": 1,
        "generation_metadata": generation,
        "run_provenance": provenance,
        "metrics": {"human_aftertaste_score": 0.5},
    }
    if not complete:
        row.pop("run_provenance")
    write_json(run_dir / "metadata.json", metadata)
    write_json(run_dir / "generation-metadata.json", generation)
    write_json(run_dir / "run-provenance.json", provenance)
    write_json(run_dir / "dataset.json", [row])
    (run_dir / "soul-triad.md").write_text("# soul\n", encoding="utf-8")
    (run_dir / "rolling-continuity.md").write_text("## Callback Window Conversations\n", encoding="utf-8")
    for name in REQUIRED_LOGS:
        (run_dir / "logs" / name).write_text("exit_code=0\n", encoding="utf-8")
    artifacts = []
    for relative in REQUIRED_ARTIFACTS + [f"logs/{name}" for name in REQUIRED_LOGS]:
        path = run_dir / relative
        artifacts.append({"path": relative, "sha256": sha256_file(path), "bytes": path.stat().st_size})
    write_json(
        run_dir / "artifact-hashes.json",
        {
            "schema_version": 1,
            "captured_at": "2026-06-10T04:00:02.000Z",
            "artifacts": artifacts,
        },
    )
    return run_dir


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        run_dir = write_fixture(root, complete=True)
        findings = audit_run(run_dir)
        assert verdict(findings) == "PASS", render(findings, run_dir)

        run_dir = write_fixture(root, complete=False)
        findings = audit_run(run_dir)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "row_run_provenance" for f in findings)
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, help="arm-window run directory to audit")
    parser.add_argument("--out", type=Path, help="optional markdown output path")
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero unless verdict is PASS.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0
    if not args.run_dir:
        parser.error("--run-dir is required unless --selftest is used")

    run_dir = args.run_dir if args.run_dir.is_absolute() else REPO_ROOT / args.run_dir
    findings = audit_run(run_dir)
    report = render(findings, run_dir)
    if args.out:
        out = args.out if args.out.is_absolute() else REPO_ROOT / args.out
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report, encoding="utf-8")
    print(report)
    result = verdict(findings)
    if result == "FAIL" or (args.strict and result != "PASS"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

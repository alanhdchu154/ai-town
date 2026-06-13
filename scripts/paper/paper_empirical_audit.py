#!/usr/bin/env python3
"""Audit whether the residue ablation evidence is empirically complete.

This is a dataset-level evidence gate. It does not collect new samples and does
not change Convex env. It distinguishes valid pipeline/plumbing evidence from a
completed ablation suitable for causal or player-experience claims.
"""

from __future__ import annotations

import argparse
import json
import statistics
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET = Path("docs/paper/emotional-residue/results/longitudinal/dataset.json")
DEFAULT_OUT = REPO_ROOT / "docs/paper/emotional-residue/results/empirical-audit.md"
CLUSTER_COLUMNS = ["pair", "source_run", "window"]
MISSING_CLUSTER_VALUES = {"", "none", "null", "nan", "missing"}
GENERATION_METADATA_REQUIRED = ["schema_version", "captured_at", "llm_provider"]
RUN_PROVENANCE_REQUIRED = [
    "schema_version",
    "kind",
    "captured_at",
    "run_id",
    "experiment.arm",
    "experiment.condition",
    "command.script",
    "command.argv",
    "git.commit",
    "documents.schedule.accepted",
    "documents.schedule.acceptance_matches_document",
    "documents.preregistration.accepted",
    "documents.preregistration.acceptance_matches_document",
    "source_archive.archive_sha256",
    "source_archive.manifest_matches_current_sources",
    "runtime.node",
    "env_policy.secret_values_recorded",
]


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def load_dataset(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a JSON list")
    return [row for row in data if isinstance(row, dict)]


def metric(row: dict, name: str) -> float | None:
    metrics = row.get("metrics")
    if not isinstance(metrics, dict):
        return None
    value = metrics.get(name)
    if isinstance(value, (int, float)):
        return float(value)
    return None


def valid_cluster_value(value: object) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() not in MISSING_CLUSTER_VALUES


def cluster_key(row: dict) -> str | None:
    values = []
    for column in CLUSTER_COLUMNS:
        value = row.get(column)
        if not valid_cluster_value(value):
            return None
        values.append(str(value))
    return "|".join(values)


def nested_get(row: dict, path: str) -> object:
    value: object = row
    for part in path.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def missing_generation_metadata_keys(row: dict) -> list[str]:
    metadata = row.get("generation_metadata")
    if not isinstance(metadata, dict):
        return GENERATION_METADATA_REQUIRED
    missing = [key for key in GENERATION_METADATA_REQUIRED if metadata.get(key) in (None, "")]
    if metadata.get("schema_version") != 1:
        missing.append("schema_version=1")
    return missing


def missing_run_provenance_keys(row: dict) -> list[str]:
    provenance = row.get("run_provenance")
    if not isinstance(provenance, dict):
        return RUN_PROVENANCE_REQUIRED
    missing: list[str] = []
    for key in RUN_PROVENANCE_REQUIRED:
        value = nested_get(provenance, key)
        if value in (None, ""):
            missing.append(key)
    if nested_get(provenance, "schema_version") != 1:
        missing.append("schema_version=1")
    for key in (
        "documents.schedule.accepted",
        "documents.schedule.acceptance_matches_document",
        "documents.preregistration.accepted",
        "documents.preregistration.acceptance_matches_document",
        "source_archive.manifest_matches_current_sources",
    ):
        if nested_get(provenance, key) is not True:
            missing.append(f"{key}=true")
    if nested_get(provenance, "env_policy.secret_values_recorded") is not False:
        missing.append("env_policy.secret_values_recorded=false")
    return sorted(set(missing))


def audit_empirical(root: Path, dataset_path: Path = DEFAULT_DATASET) -> list[Finding]:
    findings: list[Finding] = []
    path = dataset_path if dataset_path.is_absolute() else root / dataset_path
    if not path.exists():
        add(findings, "FAIL", "dataset_missing", f"Missing dataset: {path.relative_to(root)}")
        return findings

    rows = load_dataset(path)
    if not rows:
        add(findings, "FAIL", "dataset_empty", f"Dataset is empty: {path.relative_to(root)}")
        return findings

    conditions = Counter(str(row.get("condition", "missing")) for row in rows)
    pairs = Counter(str(row.get("pair", "missing")) for row in rows)
    statuses = Counter(str(row.get("status", "missing")) for row in rows)
    callbacks = [row.get("rolling_callback") for row in rows]
    callback_rows = [
        row for row in rows if row.get("rolling_callback") in (0, 1, True, False)
    ]
    callback_denominator = [row.get("rolling_callback") for row in callback_rows]
    callback_hits = sum(1 for value in callback_denominator if value in (1, True))
    aftertaste_values = [value for row in rows if (value := metric(row, "human_aftertaste_score")) is not None]
    case_names = [str(row.get("case_name", "")) for row in rows]
    message_counts = [row.get("message_count") for row in rows if isinstance(row.get("message_count"), int)]
    source_runs = Counter(str(row.get("source_run", "missing")) for row in rows)
    windows = Counter(str(row.get("window", "missing")) for row in rows)
    rows_missing_generation_metadata = sum(
        1 for row in rows if not isinstance(row.get("generation_metadata"), dict)
    )
    rows_missing_run_provenance = sum(
        1 for row in rows if not isinstance(row.get("run_provenance"), dict)
    )

    on_n = conditions.get("residue_on", 0)
    off_n = conditions.get("residue_off", 0)
    placebo_n = conditions.get("residue_placebo", 0)
    total = len(rows)
    expected_arms = ["residue_on", "residue_off"]
    if placebo_n > 0:
        expected_arms.append("residue_placebo")

    if any(name.startswith("active-conversation") for name in case_names):
        add(findings, "FAIL", "active_row_leakage", "Dataset contains active-conversation rows; ablation records must be archived.")
    if any(count < 3 for count in message_counts):
        add(findings, "FAIL", "short_conversation_rows", "Dataset contains rows with message_count < 3.")
    if statuses and any(status not in {"PASS", "WARN", "FAIL"} for status in statuses):
        add(findings, "WARN", "unknown_status", f"Unexpected status labels: {dict(statuses)}")
    if conditions.keys() - {"residue_on", "residue_off", "residue_placebo"}:
        add(findings, "FAIL", "condition_labels", f"Unexpected condition labels: {dict(conditions)}")

    if total < 40 * len(expected_arms) or any(conditions.get(arm, 0) < 40 for arm in expected_arms):
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "sample_size",
            f"Pilot-only sample size: total n={total}, residue_on={on_n}, residue_off={off_n}, residue_placebo={placebo_n}; planned minimum is at least 40/observed arm and likely higher for small effects.",
        )
    observed_counts = [conditions.get(arm, 0) for arm in expected_arms]
    if observed_counts and max(observed_counts) - min(observed_counts) > 0:
        add(
            findings,
            "WARN",
            "arm_balance",
            f"Arms are imbalanced: residue_on={on_n}, residue_off={off_n}, residue_placebo={placebo_n}.",
        )
    if len(pairs) < 3:
        add(findings, "EMPIRICAL_BLOCKER", "dyad_coverage", f"Only {len(pairs)} dyad(s): {dict(pairs)}.")
    if len(source_runs) < 4:
        add(findings, "EMPIRICAL_BLOCKER", "run_coverage", f"Only {len(source_runs)} source run(s): {dict(source_runs)}.")
    if len(windows) <= 1 and ("None" in windows or "null" in windows or "missing" in windows):
        add(findings, "EMPIRICAL_BLOCKER", "window_metadata", f"Window metadata is absent or uninformative: {dict(windows)}.")
    if callback_rows:
        rows_missing_cluster_key = [row for row in callback_rows if cluster_key(row) is None]
        if rows_missing_cluster_key:
            add(
                findings,
                "EMPIRICAL_BLOCKER",
                "cluster_metadata",
                f"{len(rows_missing_cluster_key)}/{len(callback_rows)} callback-denominator rows lack complete cluster metadata ({' + '.join(CLUSTER_COLUMNS)}).",
            )
        else:
            clusters_by_arm: dict[str, set[str]] = {arm: set() for arm in expected_arms}
            for row in callback_rows:
                condition = str(row.get("condition", "missing"))
                key = cluster_key(row)
                if condition in clusters_by_arm and key is not None:
                    clusters_by_arm[condition].add(key)
            too_few_cluster_arms = {
                arm: len(keys) for arm, keys in clusters_by_arm.items() if len(keys) < 4
            }
            if too_few_cluster_arms:
                add(
                    findings,
                    "EMPIRICAL_BLOCKER",
                    "cluster_units",
                    f"Too few callback cluster units for cluster-aware inference: {too_few_cluster_arms}; need multiple dyad/run/window clusters per observed arm.",
                )
            else:
                add(
                    findings,
                    "INFO",
                    "cluster_units",
                    "Callback cluster units by arm: {}.".format(
                        {arm: len(keys) for arm, keys in clusters_by_arm.items()}
                    ),
                )
    if rows_missing_generation_metadata:
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "generation_metadata",
            f"{rows_missing_generation_metadata}/{total} rows lack run-level provider/model metadata; future ablation rows should include generation_metadata.",
        )
    generation_schema_failures = [
        (row.get("case_name", "<missing>"), missing_generation_metadata_keys(row))
        for row in rows
        if isinstance(row.get("generation_metadata"), dict) and missing_generation_metadata_keys(row)
    ]
    if generation_schema_failures:
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "generation_metadata_schema",
            "Rows with generation_metadata are missing required fields: {}.".format(
                generation_schema_failures[:5]
            ),
        )
    if rows_missing_run_provenance:
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "run_provenance",
            f"{rows_missing_run_provenance}/{total} rows lack run-level provenance; future ablation rows should include run_provenance with git/document/source/runtime evidence.",
        )
    provenance_schema_failures = [
        (row.get("case_name", "<missing>"), missing_run_provenance_keys(row))
        for row in rows
        if isinstance(row.get("run_provenance"), dict) and missing_run_provenance_keys(row)
    ]
    if provenance_schema_failures:
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "run_provenance_schema",
            "Rows with run_provenance are missing or failing required fields: {}.".format(
                provenance_schema_failures[:5]
            ),
        )

    if len(callback_denominator) < 30:
        add(
            findings,
            "EMPIRICAL_BLOCKER",
            "callback_denominator",
            f"Only {len(callback_denominator)} rows have rolling_callback in the denominator; need enough callback-window rows before using callback rate as a primary outcome.",
        )
    elif len(callback_denominator) != total:
        add(
            findings,
            "WARN",
            "callback_denominator",
            f"{total - len(callback_denominator)} rows are outside the callback denominator, which is fine only if source/callback windows are documented.",
        )
    if not callback_denominator:
        add(findings, "EMPIRICAL_BLOCKER", "callback_labels", "No non-null rolling_callback labels.")
    else:
        add(
            findings,
            "INFO",
            "callback_rate_snapshot",
            f"Current rolling_callback snapshot: {callback_hits}/{len(callback_denominator)} = {callback_hits / len(callback_denominator):.3f}.",
        )

    if len(aftertaste_values) < total:
        add(findings, "WARN", "aftertaste_missing", f"Aftertaste proxy present for {len(aftertaste_values)}/{total} rows.")
    if aftertaste_values:
        unique_aftertaste = sorted(set(aftertaste_values))
        if len(unique_aftertaste) <= 1:
            add(
                findings,
                "EMPIRICAL_BLOCKER",
                "aftertaste_variance",
                f"Rule-based aftertaste proxy is saturated at {unique_aftertaste}; do not use it as a primary continuous outcome.",
            )
        else:
            add(
                findings,
                "INFO",
                "aftertaste_variance",
                f"Aftertaste proxy variance observed: stdev={statistics.pstdev(aftertaste_values):.4f}.",
            )

    if not any(f.severity in {"FAIL", "EMPIRICAL_BLOCKER"} for f in findings):
        add(findings, "PASS", "empirical_ablation_ready", "Dataset passes local minimum checks for a completed ablation evidence package.")
    return findings


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    if "EMPIRICAL_BLOCKER" in severities:
        return "PILOT_ONLY_INCOMPLETE_ABLATION"
    if "WARN" in severities:
        return "PASS_WITH_WARNINGS"
    return "PASS"


def render(findings: list[Finding], root: Path) -> str:
    result = verdict(findings)
    counts = Counter(f.severity for f in findings)
    lines = [
        "# Paper Empirical Ablation Audit",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "EMPIRICAL_BLOCKER", "WARN", "INFO", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.extend(["", "## Findings", ""])
    for finding in findings:
        lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PASS` means the longitudinal dataset passes local minimum checks for a completed ablation evidence package.",
            "- `PILOT_ONLY_INCOMPLETE_ABLATION` means the data are useful as pipeline or sanity evidence but not as a causal/effect claim.",
            "- Completed empirical evidence requires callback-window rows with complete cluster metadata (`pair + source_run + window`) and enough cluster units for the accepted analysis plan.",
            "- Newly collected publishable rows must include `generation_metadata` and `run_provenance` snapshots that document provider/model policy, git commit/dirty state, accepted document hashes, source-archive hash, runtime, command args, and secret-redaction policy.",
            "- This audit does not collect samples and does not replace human annotation or player-study validation.",
            "",
        ]
    )
    return "\n".join(lines)


def write_dataset(root: Path, complete: bool) -> Path:
    out = root / "docs/paper/emotional-residue/results/longitudinal/dataset.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    if complete:
        rows = []
        pairs = ["Umi-Mahiru", "Umi-Tianze", "Mahiru-Tianze", "Ichinose-Umi"]
        run_provenance = {
            "schema_version": 1,
            "kind": "arm_pure_residue_window_run_provenance",
            "captured_at": "2026-06-09T00:00:00.000Z",
            "run_id": "fixture-run",
            "experiment": {"arm": "on", "condition": "residue_on"},
            "command": {"script": "scripts/paper/run_arm_pure_residue_window.mjs", "argv": ["--arm=on"]},
            "git": {"commit": "abc123"},
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
        for index in range(80):
            condition = "residue_on" if index < 40 else "residue_off"
            rows.append(
                {
                    "case_name": f"conversation-c:{1000 + index}",
                    "condition": condition,
                    "pair": pairs[index % len(pairs)],
                    "source_run": f"run-{index // 10}",
                    "window": f"window-{index // 8}",
                    "collection_day": f"day-{index // 16}",
                    "message_count": 4,
                    "status": "PASS",
                    "rolling_callback": 1 if index % 5 == 0 else 0,
                    "generation_metadata": {
                        "schema_version": 1,
                        "captured_at": "2026-06-09T00:00:00.000Z",
                        "llm_provider": "ollama",
                        "localOllamaDefaultModel": "qwen3:8b",
                    },
                    "run_provenance": {
                        **run_provenance,
                        "run_id": f"fixture-run-{index // 10}",
                        "experiment": {
                            "arm": "on" if condition == "residue_on" else "off",
                            "condition": condition,
                        },
                    },
                    "metrics": {"human_aftertaste_score": 0.2 + (index % 7) / 10},
                }
            )
    else:
        rows = [
            {
                "case_name": "conversation-c:1",
                "condition": "residue_on",
                "pair": "Umi-Mahiru",
                "source_run": "run-1",
                "window": None,
                "message_count": 4,
                "status": "PASS",
                "rolling_callback": 1,
                "metrics": {"human_aftertaste_score": 1.0},
            },
            {
                "case_name": "conversation-c:2",
                "condition": "residue_off",
                "pair": "Umi-Mahiru",
                "source_run": "run-2",
                "window": None,
                "message_count": 4,
                "status": "PASS",
                "rolling_callback": 0,
                "metrics": {"human_aftertaste_score": 1.0},
            },
        ]
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_dataset(root, complete=False)
        findings = audit_empirical(root)
        assert verdict(findings) == "PILOT_ONLY_INCOMPLETE_ABLATION"
        assert any(f.check == "sample_size" for f in findings)
        assert any(f.check == "aftertaste_variance" for f in findings)

        write_dataset(root, complete=True)
        findings = audit_empirical(root)
        assert verdict(findings) == "PASS"
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero unless the empirical audit is PASS.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_empirical(args.root, args.dataset)
    report = render(findings, args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(report)
    result = verdict(findings)
    if result == "FAIL" or (args.strict and result != "PASS"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Audit the residue-ablation protocol and collection gate.

This is a static safety/methodology check. It does not run collection, does not
touch Convex env, and does not require local Convex to be running.
"""

from __future__ import annotations

import argparse
import json
import re
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def require_text(findings: list[Finding], text: str, phrase: str, check: str, severity: str = "FAIL") -> None:
    if phrase not in text:
        add(findings, severity, check, f"Missing required text: {phrase}")


def require_regex(findings: list[Finding], text: str, pattern: str, check: str, severity: str = "FAIL") -> None:
    if re.search(pattern, text, re.MULTILINE | re.DOTALL) is None:
        add(findings, severity, check, f"Missing required pattern: {pattern}")


def audit_protocol(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    schedule_path = root / "docs/paper/SCHEDULE_DECISION.md"
    acceptance_path = root / "docs/paper/SCHEDULE_ACCEPTANCE.json"
    preregistration_path = root / "docs/paper/PREREGISTRATION_PROTOCOL.md"
    preregistration_acceptance_path = root / "docs/paper/PREREGISTRATION_ACCEPTANCE.json"
    runner_path = root / "scripts/paper/run_arm_pure_residue_window.mjs"
    legacy_runner_path = root / "scripts/paper/run_residue_ablation.mjs"
    legacy_blocks_path = root / "scripts/paper/run_longitudinal_ablation_blocks.mjs"
    package_path = root / "package.json"

    for path in [
        schedule_path,
        acceptance_path,
        preregistration_path,
        preregistration_acceptance_path,
        runner_path,
        legacy_runner_path,
        legacy_blocks_path,
        package_path,
    ]:
        if not path.exists():
            add(findings, "FAIL", "required_file", f"Missing {path.relative_to(root)}")
    if findings:
        return findings

    schedule = read(schedule_path)
    preregistration = read(preregistration_path)
    runner = read(runner_path)
    legacy_runner = read(legacy_runner_path)
    legacy_blocks = read(legacy_blocks_path)
    package = json.loads(read(package_path))
    acceptance = json.loads(read(acceptance_path))
    preregistration_acceptance = json.loads(read(preregistration_acceptance_path))

    if acceptance.get("accepted") is not False:
        add(findings, "FAIL", "acceptance_state", "SCHEDULE_ACCEPTANCE.json should remain accepted=false until Alan explicitly accepts.")
    if acceptance.get("accepted_by") or acceptance.get("accepted_at"):
        add(findings, "FAIL", "acceptance_state", "accepted_by/accepted_at should be blank while accepted=false.")
    if acceptance.get("schedule_sha256"):
        add(findings, "FAIL", "acceptance_state", "schedule_sha256 should be blank while accepted=false.")
    if acceptance.get("schedule_document") != "docs/paper/SCHEDULE_DECISION.md":
        add(findings, "FAIL", "acceptance_document", "Acceptance file does not point to docs/paper/SCHEDULE_DECISION.md.")
    if preregistration_acceptance.get("accepted") is not False:
        add(findings, "FAIL", "preregistration_acceptance_state", "PREREGISTRATION_ACCEPTANCE.json should remain accepted=false until Alan explicitly accepts.")
    if preregistration_acceptance.get("accepted_by") or preregistration_acceptance.get("accepted_at"):
        add(findings, "FAIL", "preregistration_acceptance_state", "accepted_by/accepted_at should be blank while preregistration accepted=false.")
    if preregistration_acceptance.get("preregistration_sha256"):
        add(findings, "FAIL", "preregistration_acceptance_state", "preregistration_sha256 should be blank while preregistration accepted=false.")
    if preregistration_acceptance.get("preregistration_document") != "docs/paper/PREREGISTRATION_PROTOCOL.md":
        add(findings, "FAIL", "preregistration_acceptance_document", "Preregistration acceptance file does not point to docs/paper/PREREGISTRATION_PROTOCOL.md.")

    schedule_requirements = [
        ("arm-pure full-day / long-window collection", "schedule_design"),
        ("UNDERWORLD_RESIDUE_READ` unset", "condition_on"),
        ("UNDERWORLD_RESIDUE_READ=false", "condition_off"),
        ("UNDERWORLD_RESIDUE_READ=placebo", "condition_placebo"),
        ("`accepted: true`", "acceptance_gate_doc"),
        ("`accepted_by`", "acceptance_gate_doc"),
        ("`accepted_at`", "acceptance_gate_doc"),
        ("`schedule_sha256`", "acceptance_gate_doc"),
        ("`preregistration_sha256`", "acceptance_gate_doc"),
        ("`--collect=force` is allowed only as mechanism-pilot", "collect_policy"),
        ("`rolling_callback_rate`", "primary_outcome"),
        ("`rolling_callback=0`: conversation id appears under `## Callback Window", "denominator_policy"),
        ("`rolling_callback=null`: source-window conversation", "denominator_policy"),
        ("No optional stopping based on p-values", "stopping_rule"),
        ("At least 2 raters", "annotation_minimum"),
        ("At least 30 conversations balanced across arms", "annotation_minimum"),
        ("residue has been shown to improve felt continuity", "forbidden_wording_list"),
        ("forced dyad blocks measure natural initiative", "forbidden_wording_list"),
    ]
    for phrase, check in schedule_requirements:
        require_text(findings, schedule, phrase, check)

    preregistration_requirements = [
        ("preregistration_status: draft_not_accepted", "preregistration_status"),
        ("accepted_schedule_required: true", "preregistration_gate_doc"),
        ("placebo_arm_status: local_plumbing_not_preregistered", "placebo_status"),
        ("Inclusion Criteria", "inclusion_criteria"),
        ("Exclusion Criteria", "exclusion_criteria"),
        ("Stopping Rule", "stopping_rule"),
        ("Deviation Policy", "deviation_policy"),
        ("no_arm_extension_after_effect_peeking: true", "stopping_rule"),
    ]
    for phrase, check in preregistration_requirements:
        require_text(findings, preregistration, phrase, check)

    require_regex(findings, schedule, r"`--collect=none`.*?primary ecological design", "collect_policy")
    require_regex(findings, schedule, r"`n=40/arm`.*?(large-effect pilot|not powered for small effects)", "sample_size_caveat")

    require_regex(findings, runner, r"const COLLECT_MODE = args\.get\('collect'\) \?\? 'none'", "runner_collect_default")
    require_text(findings, runner, "const VALID_COLLECT_MODES = new Set(['none', 'force']);", "runner_collect_modes")
    require_text(findings, runner, "const VALID_ARMS = new Set(['on', 'off', 'placebo']);", "runner_arm_modes")
    require_text(findings, runner, "placebo: 'residue_placebo'", "runner_condition_mapping")
    require_regex(findings, runner, r"if \(ARM === 'on'\).*?convexEnvRemove\('UNDERWORLD_RESIDUE_READ'\).*?else if \(ARM === 'placebo'\).*?convexEnvSet\('UNDERWORLD_RESIDUE_READ', 'placebo'\).*?else.*?convexEnvSet\('UNDERWORLD_RESIDUE_READ', 'false'\)", "runner_env_mapping")
    require_regex(findings, runner, r"try \{.*?await main\(\).*?\} catch", "runner_top_level_error_guard")
    require_regex(findings, runner, r"async function main\(\) \{\s*await assertCollectionAccepted\(\);", "runner_acceptance_first")
    require_text(findings, runner, "if (CHECK_ACCEPTANCE_ONLY)", "runner_acceptance_preflight")
    require_text(findings, runner, "PREREGISTRATION_ACCEPTANCE.json", "runner_preregistration_acceptance")
    require_text(findings, runner, "docs/paper/PREREGISTRATION_PROTOCOL.md", "runner_preregistration_acceptance")
    require_text(findings, runner, "await assertAcceptedFile({", "runner_acceptance_helper")
    require_text(findings, runner, "parsed.accepted !== true || !parsed.accepted_by || !parsed.accepted_at", "runner_acceptance_fields")
    require_text(findings, runner, "sha256File", "runner_acceptance_hash")
    require_text(findings, runner, "createHash('sha256')", "runner_acceptance_hash")
    require_text(findings, runner, "schedule_sha256", "runner_acceptance_hash")
    require_text(findings, runner, "preregistration_sha256", "runner_acceptance_hash")
    require_text(findings, runner, "await restoreResidueRead(previousResidueRead);", "runner_restores_env")
    require_text(findings, runner, "--mark-callback-window-zero", "runner_denominator_policy")
    require_text(findings, runner, "`--since-created-at=${metadata.windowStartMs}`", "runner_window_scoring")
    require_text(findings, runner, "`--until-created-at=${metadata.windowEndMs}`", "runner_window_scoring")
    require_text(findings, runner, "'--source-run'", "runner_dataset_cluster_metadata")
    require_text(findings, runner, "'--window'", "runner_dataset_cluster_metadata")
    require_text(findings, runner, "'--collection-day'", "runner_dataset_cluster_metadata")
    require_text(findings, runner, "runProvenanceSnapshot", "runner_run_provenance")
    require_text(findings, runner, "run-provenance.json", "runner_run_provenance")
    require_text(findings, runner, "'--provenance-json'", "runner_run_provenance")
    require_text(findings, runner, "secret_values_recorded: false", "runner_secret_redaction_policy")
    require_text(findings, runner, "artifactHashesSnapshot", "runner_artifact_hashes")
    require_text(findings, runner, "artifact-hashes.json", "runner_artifact_hashes")
    require_text(findings, legacy_runner, "ALLOW_LEGACY_FORCED_PILOT", "legacy_forced_guard")
    require_text(findings, legacy_runner, "REFUSING legacy forced-pilot collection", "legacy_forced_guard")
    require_text(findings, legacy_runner, "--allow-legacy-forced-pilot", "legacy_forced_guard")
    require_text(findings, legacy_blocks, "ALLOW_LEGACY_FORCED_PILOT", "legacy_blocks_guard")
    require_text(findings, legacy_blocks, "REFUSING legacy repeated forced-pilot collection", "legacy_blocks_guard")
    require_text(findings, legacy_blocks, "--allow-legacy-forced-pilot", "legacy_blocks_guard")

    scripts = package.get("scripts", {})
    expected_scripts = {
        "paper:residue-arm-window": "node scripts/paper/run_arm_pure_residue_window.mjs",
        "paper:residue-arm-window:acceptance": "node scripts/paper/run_arm_pure_residue_window.mjs --check-acceptance-only",
        "paper:merge-ablation-runs": "python3 scripts/paper/merge_ablation_runs.py",
        "paper:run-provenance-audit": "python3 scripts/paper/paper_run_provenance_audit.py",
        "paper:acceptance-hashes": "python3 scripts/paper/acceptance_hashes.py",
        "paper:alan-decision-packet": "python3 scripts/paper/alan_decision_packet.py",
        "paper:readiness": "python3 scripts/paper/paper_readiness_report.py",
    }
    for name, command in expected_scripts.items():
        if scripts.get(name) != command:
            add(findings, "FAIL", "package_script", f"{name} should be `{command}` but is `{scripts.get(name)}`")

    if not findings:
        add(findings, "PASS", "protocol_gate", "Schedule, preregistration, acceptance files, runner gate, and package scripts are consistent.")
    return findings


def verdict(findings: Iterable[Finding]) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities:
        return "FAIL"
    if "WARN" in severities:
        return "PASS_WITH_WARNINGS"
    return "PASS"


def render(findings: list[Finding], root: Path) -> str:
    result = verdict(findings)
    counts = Counter(f.severity for f in findings)
    lines = [
        "# Paper Protocol Audit",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "WARN", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.extend(["", "## Findings", ""])
    for finding in findings:
        lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- `PASS` means the written schedule, acceptance gate, runner, and npm scripts are aligned.",
            "- This audit does not start collection and does not prove empirical completion.",
            "",
        ]
    )
    return "\n".join(lines)


def write_fixture(root: Path, accepted: bool = False) -> None:
    (root / "docs/paper").mkdir(parents=True, exist_ok=True)
    (root / "scripts/paper").mkdir(parents=True, exist_ok=True)
    (root / "docs/paper/SCHEDULE_DECISION.md").write_text(
        """
Use **arm-pure full-day / long-window collection**.
- `residue_on` day: `UNDERWORLD_RESIDUE_READ` unset
- `residue_off` day: `UNDERWORLD_RESIDUE_READ=false`
- future `residue_placebo` day: `UNDERWORLD_RESIDUE_READ=placebo`
- `accepted: true`
- `accepted_by`
- `accepted_at`
- `schedule_sha256`
- `preregistration_sha256`
Use `--collect=none` for the primary ecological design; `--collect=force` is allowed only as mechanism-pilot supplemental evidence.
Primary outcome: `rolling_callback_rate`.
Denominator:
- `rolling_callback=0`: conversation id appears under `## Callback Window Conversations`
- `rolling_callback=null`: source-window conversation
No optional stopping based on p-values.
`n=40/arm` is only large-effect pilot evidence.
At least 2 raters.
At least 30 conversations balanced across arms.
Current paper must not say:
- residue has been shown to improve felt continuity
- forced dyad blocks measure natural initiative
""".strip(),
        encoding="utf-8",
    )
    (root / "docs/paper/PREREGISTRATION_PROTOCOL.md").write_text(
        """
preregistration_status: draft_not_accepted
accepted_schedule_required: true
placebo_arm_status: local_plumbing_not_preregistered
current_mechanism_claim: narrowed_read_block_suppression
Inclusion Criteria
Exclusion Criteria
Stopping Rule
Deviation Policy
no_arm_extension_after_effect_peeking: true
""".strip(),
        encoding="utf-8",
    )
    (root / "docs/paper/SCHEDULE_ACCEPTANCE.json").write_text(
        json.dumps(
            {
                "accepted": accepted,
                "accepted_by": "" if not accepted else "Alan",
                "accepted_at": "" if not accepted else "2026-06-06T00:00:00Z",
                "schedule_document": "docs/paper/SCHEDULE_DECISION.md",
                "schedule_sha256": "" if not accepted else "wrong-fixture-hash",
            }
        ),
        encoding="utf-8",
    )
    (root / "docs/paper/PREREGISTRATION_ACCEPTANCE.json").write_text(
        json.dumps(
            {
                "accepted": accepted,
                "accepted_by": "" if not accepted else "Alan",
                "accepted_at": "" if not accepted else "2026-06-06T00:00:00Z",
                "preregistration_document": "docs/paper/PREREGISTRATION_PROTOCOL.md",
                "preregistration_sha256": "" if not accepted else "wrong-fixture-hash",
            }
        ),
        encoding="utf-8",
    )
    (root / "scripts/paper/run_arm_pure_residue_window.mjs").write_text(
        """
const COLLECT_MODE = args.get('collect') ?? 'none';
const VALID_COLLECT_MODES = new Set(['none', 'force']);
const VALID_ARMS = new Set(['on', 'off', 'placebo']);
const CONDITION_BY_ARM = {
  on: 'residue_on',
  off: 'residue_off',
  placebo: 'residue_placebo',
};
try { await main(); } catch (error) {}
if (CHECK_ACCEPTANCE_ONLY) {}
async function main() {
  await assertCollectionAccepted();
  try {
    if (ARM === 'on') { await convexEnvRemove('UNDERWORLD_RESIDUE_READ'); } else if (ARM === 'placebo') { await convexEnvSet('UNDERWORLD_RESIDUE_READ', 'placebo'); } else { await convexEnvSet('UNDERWORLD_RESIDUE_READ', 'false'); }
  } finally {
    await restoreResidueRead(previousResidueRead);
  }
}
async function assertScheduleAccepted() {
  if (parsed.accepted !== true || !parsed.accepted_by || !parsed.accepted_at) {}
}
const PREREGISTRATION_ACCEPTANCE_PATH = 'docs/paper/PREREGISTRATION_ACCEPTANCE.json';
await assertAcceptedFile({
async function assertAcceptedFile() {}
function sha256File() { return createHash('sha256'); }
const scheduleHash = 'schedule_sha256';
const preregistrationHash = 'preregistration_sha256';
const prereg = 'docs/paper/PREREGISTRATION_PROTOCOL.md';
async function runProvenanceSnapshot() { return { env_policy: { secret_values_recorded: false } }; }
await writeJson('run-provenance.json', await runProvenanceSnapshot());
async function artifactHashesSnapshot() {}
await writeJson('artifact-hashes.json', await artifactHashesSnapshot());
const argsForA = [`--since-created-at=${metadata.windowStartMs}`, `--until-created-at=${metadata.windowEndMs}`, '--mark-callback-window-zero', '--source-run', '--window', '--collection-day', '--provenance-json'];
""".strip(),
        encoding="utf-8",
    )
    (root / "scripts/paper/run_residue_ablation.mjs").write_text(
        "const ALLOW_LEGACY_FORCED_PILOT = false;\n"
        "console.error('REFUSING legacy forced-pilot collection');\n"
        "const flag = '--allow-legacy-forced-pilot';\n",
        encoding="utf-8",
    )
    (root / "scripts/paper/run_longitudinal_ablation_blocks.mjs").write_text(
        "const ALLOW_LEGACY_FORCED_PILOT = false;\n"
        "console.error('REFUSING legacy repeated forced-pilot collection');\n"
        "const flag = '--allow-legacy-forced-pilot';\n",
        encoding="utf-8",
    )
    (root / "package.json").write_text(
        json.dumps(
            {
                "scripts": {
                    "paper:residue-arm-window": "node scripts/paper/run_arm_pure_residue_window.mjs",
                    "paper:residue-arm-window:acceptance": "node scripts/paper/run_arm_pure_residue_window.mjs --check-acceptance-only",
                    "paper:merge-ablation-runs": "python3 scripts/paper/merge_ablation_runs.py",
                    "paper:run-provenance-audit": "python3 scripts/paper/paper_run_provenance_audit.py",
                    "paper:acceptance-hashes": "python3 scripts/paper/acceptance_hashes.py",
                    "paper:alan-decision-packet": "python3 scripts/paper/alan_decision_packet.py",
                    "paper:readiness": "python3 scripts/paper/paper_readiness_report.py",
                }
            }
        ),
        encoding="utf-8",
    )


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_fixture(root)
        findings = audit_protocol(root)
        assert verdict(findings) == "PASS"

        write_fixture(root, accepted=True)
        findings = audit_protocol(root)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "acceptance_state" for f in findings)
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "docs/paper/results/protocol-audit.md")
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero on any non-PASS finding.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_protocol(args.root)
    report = render(findings, args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(report)
    if verdict(findings) == "FAIL" or (args.strict and any(f.severity != "PASS" for f in findings)):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

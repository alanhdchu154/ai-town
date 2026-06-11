#!/usr/bin/env python3
"""Audit that the paper's residue mechanism maps to current code paths.

This is a static systems-evidence check. It does not start Convex, does not run
collection, and does not read or modify Convex env. Its purpose is narrower:
if the manuscript claims a residue write/read architecture, the named files and
gates should exist in the current repository.
"""

from __future__ import annotations

import argparse
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


def audit_mechanism(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    main_path = root / "docs/paper/arxiv/main.tex"
    memory_path = root / "convex/agent/memory.ts"
    conversation_path = root / "convex/agent/conversation.ts"
    agent_path = root / "convex/aiTown/agent.ts"
    schema_path = root / "convex/schema.ts"

    required_paths = [main_path, memory_path, conversation_path, agent_path, schema_path]
    for path in required_paths:
        if not path.exists():
            add(findings, "FAIL", "required_file", f"Missing {path.relative_to(root)}")
    if findings:
        return findings

    main = read(main_path)
    memory = read(memory_path)
    conversation = read(conversation_path)
    agent = read(agent_path)
    schema = read(schema_path)

    manuscript_requirements = [
        ("convex/agent/memory.ts", "manuscript_code_path"),
        ("convex/agent/conversation.ts", "manuscript_code_path"),
        ("UNDERWORLD\\_RESIDUE\\_WRITE", "manuscript_env_gate"),
        ("UNDERWORLD\\_RESIDUE\\_READ", "manuscript_env_gate"),
        ("residuePromptLines", "manuscript_read_path"),
        ("deterministicResidueSentence", "manuscript_write_path"),
        ("at most two recent residue lines", "manuscript_read_bound"),
        ("Motif Guard", "manuscript_motif_guard"),
        ("memory description", "manuscript_storage"),
    ]
    for phrase, check in manuscript_requirements:
        require_text(findings, main, phrase, check)

    require_text(findings, memory, "function emotionalResidueEnabled()", "write_env_gate")
    require_regex(
        findings,
        memory,
        r"process\.env\.UNDERWORLD_RESIDUE_WRITE\s*!==\s*'false'",
        "write_env_gate",
    )
    require_text(findings, memory, "function deterministicResidueSentence", "write_residue_function")
    require_text(findings, memory, "const RESIDUE_MIN_MESSAGES = 4;", "write_minimum_exchange")
    require_text(findings, memory, "shouldPersistConversationMemoryShape", "write_shape_gate")
    require_text(findings, memory, "hasSloganLikeResidue", "write_hygiene_gate")
    require_text(findings, memory, "resonatesWithCharacterSoul", "write_resonance_gate")
    require_text(findings, memory, "RESIDUE_PREFIX", "write_storage_prefix")
    require_text(findings, memory, "residueFromMemoryDescription", "read_extraction_helper")
    require_regex(
        findings,
        memory,
        r"const description\s*=\s*`\$\{baseDescription\}.*?\$\{RESIDUE_PREFIX\}\$\{residue\}",
        "write_description_storage",
    )

    require_text(findings, conversation, "function residuePromptLines", "read_prompt_function")
    require_regex(
        findings,
        conversation,
        r"if \(mode === 'off'\) return \[\]",
        "read_env_gate",
    )
    require_text(findings, conversation, "if (mode === 'placebo') return PLACEBO_RESIDUE_PROMPT_LINES", "read_placebo_gate")
    require_regex(findings, conversation, r"\.slice\(0,\s*2\)", "read_two_residue_bound")
    require_text(findings, conversation, "不要逐字複述", "read_no_quote_instruction")
    require_text(findings, conversation, "不要直接說", "read_no_direct_memory_instruction")
    require_text(findings, conversation, "residueTimeLabelZh", "read_time_label")
    require_text(findings, conversation, "America/Chicago", "read_time_zone_policy")
    require_text(findings, conversation, "conversationMotifGuard", "motif_guard_function")
    require_text(findings, conversation, "recentResidues", "motif_guard_reads_residue")
    require_text(findings, conversation, "CONVERSATION_MOTIF_FAMILIES", "motif_guard_families")
    require_text(findings, conversation, "repeatedMotifLabels", "motif_guard_repetition")

    require_text(findings, agent, "UNDERWORLD_RESIDUE_WRITE", "agent_env_documentation")
    require_text(findings, agent, "UNDERWORLD_RESIDUE_READ", "agent_env_documentation")
    require_text(findings, schema, "v.literal('emotional_residue')", "schema_outcome_label")

    if not findings:
        add(
            findings,
            "PASS",
            "mechanism_code_alignment",
            "Manuscript residue architecture maps to current write/read env gates, storage prefix, extraction, prompt injection, time labels, and motif guard code paths.",
        )
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
        "# Paper Mechanism Audit",
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
            "- `PASS` means the paper-described residue mechanism is statically aligned with current code paths.",
            "- This audit does not execute the world, prove runtime behavior, or replace ablation/player validation.",
            "",
        ]
    )
    return "\n".join(lines)


def write_fixture(root: Path) -> None:
    (root / "docs/paper/arxiv").mkdir(parents=True, exist_ok=True)
    (root / "convex/agent").mkdir(parents=True, exist_ok=True)
    (root / "convex/aiTown").mkdir(parents=True, exist_ok=True)
    (root / "convex").mkdir(parents=True, exist_ok=True)

    main_path = root / "docs/paper/arxiv/main.tex"
    existing = main_path.read_text(encoding="utf-8") if main_path.exists() else ""
    main_path.write_text(
        existing
        + "\n"
        + r"""
System note: convex/agent/memory.ts runs deterministicResidueSentence and stores
the result in the memory description. The manuscript names
UNDERWORLD\_RESIDUE\_WRITE, convex/agent/conversation.ts,
residuePromptLines, UNDERWORLD\_RESIDUE\_READ, at most two recent residue lines,
and the Motif Guard.
""",
        encoding="utf-8",
    )
    (root / "convex/agent/memory.ts").write_text(
        """
const RESIDUE_PREFIX = '情緒殘留：';
function emotionalResidueEnabled() {
  return process.env.UNDERWORLD_RESIDUE_WRITE !== 'false';
}
function shouldPersistConversationMemoryShape() { return true; }
function hasSloganLikeResidue() { return false; }
function resonatesWithCharacterSoul() { return true; }
const RESIDUE_MIN_MESSAGES = 4;
function deterministicResidueSentence() { return 'residue'; }
export function residueFromMemoryDescription(description: string) { return description; }
async function remember() {
  const baseDescription = 'base';
  const residue = 'residue';
  const description = `${baseDescription}\\n${RESIDUE_PREFIX}${residue}`;
  return description;
}
""",
        encoding="utf-8",
    )
    (root / "convex/agent/conversation.ts").write_text(
        """
function residuePromptLines(recentResidues: any[]) {
  const mode = 'off';
  if (mode === 'off') return [];
  if (mode === 'placebo') return PLACEBO_RESIDUE_PROMPT_LINES;
  return recentResidues.slice(0, 2).map((entry) => residueTimeLabelZh(entry.createdAt));
}
const PLACEBO_RESIDUE_PROMPT_LINES = [];
function residueTimeLabelZh() { return 'America/Chicago 不要逐字複述 不要直接說'; }
function conversationMotifGuard(previousMessages: any[], recentResidues: any[]) {
  return repeatedMotifLabels(previousMessages.join('\\n'), recentResidues.join('\\n'));
}
const CONVERSATION_MOTIF_FAMILIES = [];
function repeatedMotifLabels() { return []; }
""",
        encoding="utf-8",
    )
    (root / "convex/aiTown/agent.ts").write_text(
        "UNDERWORLD_RESIDUE_WRITE UNDERWORLD_RESIDUE_READ",
        encoding="utf-8",
    )
    (root / "convex/schema.ts").write_text(
        "v.literal('emotional_residue')",
        encoding="utf-8",
    )


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_fixture(root)
        findings = audit_mechanism(root)
        assert verdict(findings) == "PASS"

        (root / "convex/agent/conversation.ts").write_text("function residuePromptLines() { return []; }", encoding="utf-8")
        findings = audit_mechanism(root)
        assert verdict(findings) == "FAIL"
        assert any(f.check == "read_env_gate" for f in findings)
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "docs/paper/results/mechanism-audit.md")
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero on any non-PASS finding.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    findings = audit_mechanism(args.root)
    report = render(findings, args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(report)
    if verdict(findings) == "FAIL" or (args.strict and any(f.severity != "PASS" for f in findings)):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

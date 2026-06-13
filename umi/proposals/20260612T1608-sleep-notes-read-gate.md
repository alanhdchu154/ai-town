# Sleep Notes Read Gate

Created: 2026-06-12 16:08 CDT
Status: implemented first pass

## Problem

The fresh world cannot become a character reset. Old continuity has value, but
the old archive also contains fallback-like text, debug summaries, stale
characters, repeated motifs, and oversized runtime history. Importing raw old
rows into `memories` would pollute prompts and make v0.1 eval evidence invalid.

## Decision

Use `sleepNotes` as a narrow bridge between old evidence and current prompts.
It is not the `memories` table and not a vector store. It stores rewritten,
reviewed notes that may affect a character's attention, tone, avoidance, or
small behavior.

## Invariants

- Raw archived conversations, messages, embeddings, and debug summaries are not
  imported.
- Legacy-sourced rows are always `legacyArchive=true` and
  `freshEvalEligible=false`.
- Prompt-facing rows must be `reviewStatus='promoted'`.
- Imports require `alan-approved-sleep-notes-2026-06-12`.
- Imports are capped per run and dedupe by source and motif.
- Prompt read is capped at one promoted note for the current speaker/partner.
- Blocked drift/system wording cannot be prompt-facing.

## First Restore

Two rewritten notes were promoted:

- 海 / 真晝: 真晝曾把「今天先顧好自己」這句話留給海，海沒有完全接住。
- 真晝 / 天澤: 真晝記得天澤曾提醒她：不要把沉默的人都當成需要被拯救的難題。

These notes should not be quoted. They should only change what the character
notices, avoids, says less of, or gently follows up on.

## Evidence

- cc read-only review: `umi/reports/20260612T205950Z-workload.md`.
- Import report: `umi/reports/sleep-notes-import-latest.md`.
- `sleepNotes:sleepNotesSummary`: count 2 / promptFacing 2 / promoted 2 /
  freshEvalEligible 0.
- `legacyContinuityEvidenceSummary`: count 12 / promptFacing 0 /
  freshEvalEligible 0.
- Verification: `npx convex codegen`, `npx tsc --noEmit --pretty false`,
  `npm run build`, importer self-test, dry-run, approved write, duplicate write
  idempotency check.

## What Still Stays Out

- Bulk old memory import.
- Any destructive archive cleanup.
- Any auto-promotion from sleep consolidation.
- Any legacy row counted as fresh v0.1 evidence.
- Any global relationship or emotion schema rewrite.

## Next Check

Collect fresh conversations and inspect whether the notes create subtle
continuity without causing slogan relapse or motif echo. If quality regresses,
demote the affected note instead of editing core character prompts first.

# Umi Workload

Last updated: 2026-06-02 21:20 America/Chicago

This file holds one active worker handoff at a time. Keep it narrow.

## Active Task

No active cc task.

The most recent Central Umi-aligned cc attempts were read-only/no-write and did
not produce code changes:

- `2026-06-02-code-optimizer-stale-conversation-loop` timed out after 240s with
  empty stdout/stderr.
- `2026-06-02-cc-review-tianze-ichinose-continuity-metric` dry-run did not
  invoke Claude Code.
- `2026-06-02-cc-review-tianze-ichinose-continuity-metric` real cc-only run
  timed out after 120s with empty stdout/stderr.

Therefore the latest runtime/soul fixes in the dirty tree should be attributed
to Codex/Umi implementation or prior sidecar-reviewed findings, not direct cc
file edits.

Next cc task should be freshly written from `/Users/alanhdchu/umi-central/goals.md`
plus current `WORKLOG.md`, with one bounded question and a short timeout.

## Before Creating The Next Task

- Read `/Users/alanhdchu/umi-central/goals.md`.
- Read this repo's `WORKLOG.md`.
- Refresh the relevant source of truth before using old samples as current.
- Prefer `cc-first` or `Split-work` for bounded coding, tests, eval debugging,
  or UI implementation.
- Keep Umi responsible for scope, taste, risk, and Alan-facing summary.

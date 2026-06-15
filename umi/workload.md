# CC Workload — Underworld Runtime Stale-Conversation Guard Review

Time anchor: 2026-06-14 21:05 CDT
Repo cwd: /Users/alanhdchu/ai-town
Model target: opus
Mode: read-only review / diagnosis first

## Context

Alan overrode the weekend "hands off" plan after Underworld was found half-stuck.
The frontend and Convex queries were alive, but role-to-role conversation flow
stopped around 10:59-11:00 CDT. Two active unarchived conversations were stale:

- 海 / 一之瀨
- 祥子 / 貓貓

Codex ran:

- `testing:stop` -> wait -> `testing:resume`
- `testing:repairDefaultWorldRunState {"target":"running"}`
- Alan-approved cleanup:
  `school:cleanupActiveConversationsByCharacterNamesForTest {"dryRun":false,"targetNames":["海","一之瀨","祥子","貓貓"]}`

The cleanup removed 2 active conversations, 10 unarchived messages, and 1
in-progress agent operation. No archived memory / experienceLog was mutated.

Post-cleanup: active stale conversations are gone, but `debugInputQueue` still
shows latest agent inputs around 10:59-11:00. The next repair should be code-level
guarding for Monday/Tuesday runs, not prompt/soul tuning.

## Task

Review the smallest safe implementation plan for:

1. Freshness-aware runtime preflight:
   - detect stale latest agent input / no fresh conversation input despite
     `worldStatus.status === "running"`.
   - do not rely only on `worldStatus`.

2. Stale active conversation watchdog:
   - detect active autonomous conversations whose last message is older than a
     threshold.
   - default to dry-run/report.
   - if applied, abort/clear stale active conversation state without writing
     memory, residue, experienceLog, worldEvent, notification, or profile update.

3. Rollout:
   - tonight implement guard/reporting.
   - Monday/Tuesday run data collection.
   - Wednesday judge v0.1.

## Read First

- `WORKLOG.md`
- `convex/aiTown/agent.ts`
- `convex/aiTown/main.ts`
- `convex/aiTown/conversation.ts`
- `convex/aiTown/agentInputs.ts`
- `convex/world.ts`
- `convex/school.ts` around:
  - `debugInputQueue`
  - `cleanupActiveConversationsByCharacterNamesForTest`
  - `debugAlanConversationState`
- `scripts/underworld-runtime-preflight.mjs`
- `scripts/underworld-state-growth-audit.mjs`

## Constraints

- No broad architecture rewrite.
- No prompt/soul/memory semantic changes.
- No provider/model migration.
- No destructive cleanup beyond a narrowly gated stale active conversation abort.
- No `testing:kick` recommendation unless you can prove it is safer than the
  known stop/resume path.
- Prefer report-first / dry-run defaults.

## Expected Output

Findings-first, concise:

1. Is the diagnosis plausible?
2. What is the smallest safe code change?
3. Which files should Codex modify?
4. What tests/checks are necessary?
5. What should remain proposal-only?
6. Any edge cases that could corrupt memory or create duplicate runStep loops?

Do not edit files in this pass.

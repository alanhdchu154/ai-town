# Umi Workload

Last updated: 2026-06-05 America/Chicago

This file holds one active worker handoff at a time. Keep it narrow.

## Active Task

Active owner: Alan (human playtest), not cc.

Next action is Alan's own playtest now that Alan-facing chats are durably
recorded and re-archived with real memory (see 2026-06-05 WORKLOG entry):

1. Enter campus, talk to 海 / 天澤, including deliberately absurd lines.
2. Probe recall: ask about the curry-rice promise (`我的咖哩飯呢 / 你記得答應我
   什麼嗎`) and whether yesterday is felt inside today.
3. Then leave the conversation (or leave campus) and confirm the new transcript
   archived — it should appear as a real archived conversation in
   `npx convex run school:recentConversationEvalData`, not as an
   `active_conversation_not_archived` / `human_chat_not_archived` orphan.
4. Record the result in `umi/reports/alan-facing-v01-playtest-latest.md` and
   validate with `npm run underworld:alan-playtest-check`.

Goal of this pass is observational: confirm memory recall works and watch
whether soul develops — do NOT add new gates in response to rough output before
Alan has judged it.

No active cc task. The latest runtime/soul/memory fixes in the tree were made
directly (game.ts / school.ts / memory.ts / conversation.ts +
underworldOrphanBackfill.ts), not via a cc handoff.

## Before Creating The Next Task

- Read `/Users/alanhdchu/umi-central/goals.md`.
- Read this repo's `WORKLOG.md`.
- Refresh the relevant source of truth before using old samples as current.
- Prefer `cc-first` or `Split-work` for bounded coding, tests, eval debugging,
  or UI implementation.
- Preserve cc's independent review value: for broad "is this aligned / what
  changed / what problems do you see" requests, create a scouting review or
  all-current-diff alignment review rather than a tiny suspected-file prompt.
- Include Umi first look, current change set, candidate files/directories, open
  questions for cc, review breadth, allowed changes, verification, and stop
  conditions.
- Keep Umi responsible for scope, taste, risk, and Alan-facing summary.

## Next Task Template

Use this shape when replacing `## Active Task`:

```md
### <task id>

- status:
- assigned worker:
- time anchor:
- time-aware continuity acknowledged?: yes/no
- pass type: scouting review / all-current-diff alignment review / bug-hunt
  review / diagnosis-only / implementation / verification / cleanup

Goal:

Umi first look:

- current central goal:
- current `WORKLOG.md` state:
- current git status/diff:
- what is still uncertain:

Inputs to read first:

- `/Users/alanhdchu/umi-central/goals.md` row for `underworld`
- `AGENTS.md`
- `WORKLOG.md`
- relevant report, roadmap, eval, or source files

Candidate files/directories:

- areas cc may inspect for adjacent risk

Open questions for cc:

- questions cc should answer with independent judgment

Allowed changes:

- read/report only, or exact editable scope

Review breadth:

- how far cc may look beyond named files
- adjacent risks cc should flag

Verification to run:

Stop conditions:

- central goals and this handoff disagree
- scope expands beyond the goal
- provider/runtime/credential issue prevents useful work
- cc times out, exits non-zero, or produces no tool progress

Expected worker report:

- top findings by severity
- recommended direction
- whether implementation should happen now, wait, or be narrowed
- files inspected or changed
- commands run
- verification result
- blockers and residual risk
```

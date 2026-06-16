# CC Workload - Frontend Market-Readiness Residual Pass

Time anchor: 2026-06-16 15:15 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first review before Codex implements any next patch

## Task ID

underworld-frontend-market-readiness-residual-pass-20260616-1515

## Context

Alan's active goal remains:

> 你重複前端有沒有什麼其他問題呢？你拉上cc一起討論。把前端優化到可以上市

Current frontend stability state after pushed commit `80cd6a22`:

- `Game.tsx` keeps last-good `defaultWorldStatus` and same-world `userStatus`
  during brief Convex undefined windows.
- `underworld:frontend-smoke` now:
  - loads mobile 390x844, small-mobile 360x640, and desktop 1440x960;
  - clicks a visible non-Alan standee;
  - verifies selected target, bottom `目標`, visible mobile helper / desktop
    focus card, and a visible primary CTA;
  - samples the selected live room for 7 seconds and fails on loading shell,
    reconnect fallback, selected target loss, scene aria-label drift, missing
    bottom status/helper/focus card/CTA, horizontal overflow, hard console
    issue, or bad network.
- Latest smoke report: generated `2026-06-16T20:09:29.103Z`, PASS 3/3.
  - All three viewports selected 祥子 in 中央庭院場景.
  - `idleOk=true`, 7 samples each, `drift=0`, `consoleIssues=0`,
    `badNetwork=0`, no horizontal overflow.
- Latest verification before this handoff:
  - `npx tsc --noEmit --pretty false`: PASS.
  - `npm run build`: PASS.
  - `npm run underworld:runtime-preflight`: PASS.
  - `npm run underworld:frontend-smoke`: PASS 3/3.
  - `git diff --check`: PASS.
- Current `ai-town` worktree has unrelated `media/topics/watcher-inbox.md`
  dirty from Field Notes watcher work, plus this `umi/workload.md` handoff.
  Ignore the watcher inbox; do not stage/revert it.

Known remaining caveat:

- Real Alan in-app mobile/touch acceptance is still unproven. Do not claim
  launch-ready solely from machine checks.

## Read First

- `WORKLOG.md` Current State Snapshot and Open Follow-Ups.
- `umi/reports/frontend-smoke-latest.json`.
- `scripts/underworld-frontend-smoke.mjs`.
- `src/components/Game.tsx`.
- `src/components/PlayerDetails.tsx`.
- `src/components/Messages.tsx`.
- `src/components/MessageInput.tsx`.
- `src/components/ConversationWall.tsx`.
- `src/components/buttons/InteractButton.tsx`.
- `src/hooks/serverGame.ts`.
- `src/hooks/useWorldHeartbeat.ts`.
- `src/App.tsx`.
- `src/index.css`.

You may inspect adjacent frontend files and recent diffs as needed.

## Questions For CC

Findings-first, read-only:

1. After `80cd6a22`, what P0/P1/P2 frontend launch-readiness risks remain?
2. Is there any small code patch worth doing now, or is the next correct step
   manual Alan mobile/touch acceptance?
3. If a patch is warranted, keep it narrow and name exact files/selectors. Good
   candidates might include subjective toast flicker/churn, mobile CTA
   affordance clarity, conversation-wall tab clarity, or a missing smoke
   assertion. Bad candidates are broad redesign, prompt changes, backend
   changes, or WorldContext consolidation without a concrete launch risk.
4. Are there any current smoke gaps that are cheap and meaningful to close
   without mutating Convex or invoking LLM/provider work?
5. What should remain manual acceptance and not be automated?

## Constraints

- Read-only. Do not modify files.
- Do not run watch/dev servers.
- Do not mutate Convex state intentionally.
- Avoid clicking action pills, `接手 Alan`, chat inputs, quick actions, or
  anything that sends Convex mutations or triggers provider/LLM work.
- You may run static commands and inspect the latest smoke JSON. If you run a
  smoke, keep it to the existing non-mutating script.
- Do not propose broad redesign or backend/prompt changes.

## Expected Output

Return:

1. Top findings by severity.
2. Whether Codex should patch now or stop at manual acceptance.
3. If patching, the smallest implementation batch.
4. Verification commands.
5. Manual acceptance checklist for Alan.

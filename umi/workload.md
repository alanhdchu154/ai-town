# CC Workload - Frontend Launch Residual Risk Review

Time anchor: 2026-06-16 15:42 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first review
Status: completed; cc report saved at `umi/reports/20260616T204624Z-workload.md`.
Codex accepted the dynamic viewport and expanded smoke recommendations, then
added a short-height landscape fix after a local 844x390 probe showed the
standee row was clipped above the viewport.

## Task ID

underworld-frontend-launch-residual-risk-review-20260616-1542

## Current Goal

Alan's active goal remains:

> 你重複前端有沒有什麼其他問題呢？你拉上cc一起討論。把前端優化到可以上市

Do not redefine "launch-ready" as "latest smoke passes." We need a current,
evidence-based residual frontend risk review and, if warranted, one narrow next
patch.

## Current State

- Branch: `main`.
- Latest pushed commit: `2527bd0f Stabilize mobile conversation wall`.
- Current dirty worktree has one unrelated file:
  `media/topics/watcher-inbox.md`. Ignore it; do not stage/revert it.
- Latest `npm run underworld:frontend-smoke`: PASS 4/4, generated
  `2026-06-16T20:37:57.589Z`.
  - mobile 390x844: selected 祥子 in 中央庭院; Conversation Wall opened, settled,
    showed 9 cards plus partial-loading note, no overflow, returned to world.
  - small-mobile 360x640: world selection idle PASS, no overflow.
  - tablet 820x1180: world selection idle PASS, no overflow.
  - desktop 1440x960: selected 天澤 in 中央庭院; Conversation Wall opened, showed
    45 cards, no overflow, returned to world.
- Latest verification for `2527bd0f`: typecheck PASS, build PASS,
  runtime-preflight PASS, frontend-smoke PASS, diff-check PASS.
- Machine gates still do not prove real iPhone/in-app mobile acceptance:
  touch feel, iOS background/foreground reconnect, keyboard occlusion, long wall
  readability, and native select rendering are manual.

## Read First

- `WORKLOG.md` Current State Snapshot and Open Follow-Ups.
- `umi/reports/frontend-smoke-latest.json`.
- `umi/playtest-frontend-mobile-acceptance.md`.
- `scripts/underworld-frontend-smoke.mjs`.
- `src/App.tsx`.
- `src/components/Game.tsx`.
- `src/components/ConversationWall.tsx`.
- `src/components/PlayerDetails.tsx`.
- `src/components/Messages.tsx`.
- `src/components/MessageInput.tsx`.
- `src/index.css` mobile/conversation sections.

You may inspect adjacent frontend files if evidence points there.

## Questions For CC

Findings-first, read-only:

1. After `2527bd0f`, what P0/P1/P2 frontend launch risks remain?
2. Which remaining risks are machine-testable and worth closing now?
3. Which risks should remain manual acceptance only?
4. Is there a narrow patch Codex should do now? Candidate types:
   - a small frontend resilience fix that prevents visible jumping/blank/loading;
   - a small CSS/layout polish with concrete evidence;
   - a smoke assertion that would catch a realistic launch regression;
   - a mobile acceptance artifact update if the checklist is stale after the
     new wall route smoke.
5. If you recommend patching, name exact files, selectors/components, and
   verification commands. If not, say "no patch now" and explain the strongest
   remaining manual gate.

## Constraints

- Read-only: do not modify files.
- Do not run watch/dev servers.
- Do not mutate Convex state intentionally.
- Avoid clicking action pills, `接手 Alan`, chat inputs, quick actions, or
  anything that sends Convex mutations or triggers provider/LLM work.
- No backend, prompt, provider, memory-schema, or map redesign proposals in
  this pass unless they are required to prevent a proven frontend launch
  blocker.
- Keep recommendations narrow enough for Codex to implement and verify in one
  batch.

## Expected Output

Return:

1. Top findings by severity.
2. Whether Codex should patch now.
3. Smallest implementation batch if patching.
4. Required verification commands.
5. Manual acceptance that remains required.

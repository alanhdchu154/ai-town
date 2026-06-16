# CC Workload - Conversation View Smoke Coverage Review

Time anchor: 2026-06-16 15:32 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first review before Codex implements any next patch
Status: completed; cc report saved at `umi/reports/20260616T203207Z-workload.md`.
Codex accepted the smoke-coverage recommendation and patched the mobile
Conversation Wall cold-load issue it exposed.

## Task ID

underworld-conversation-view-smoke-review-20260616-1532

## Context

Alan's active goal remains:

> 你重複前端有沒有什麼其他問題呢？你拉上cc一起討論。把前端優化到可以上市

Current state on `main`:

- `b91dc5a4` added tablet smoke coverage.
- `8b55eb0b` added `umi/playtest-frontend-mobile-acceptance.md`.
- `80cd6a22` stabilized the world view after character selection.
- `underworld:frontend-smoke` now covers mobile 390x844, small-mobile 360x640,
  tablet 820x1180, and desktop 1440x960.
- Latest smoke report generated `2026-06-16T20:25:09.761Z`: PASS 4/4,
  `idleOk=true`, 7 samples each, `drift=0`, `consoleIssues=0`,
  `badNetwork=0`, and no horizontal overflow.
- Current `ai-town` worktree has unrelated `media/topics/watcher-inbox.md`
  dirty from Field Notes watcher work plus this handoff. Ignore watcher inbox;
  do not stage or revert it.

Potential remaining frontend gap:

- The smoke suite exercises the world/scene selection path but never opens the
  topbar `對話` view (`ConversationWall`). Alan previously found dialogue/tab
  flow confusing, and the manual acceptance gate includes Conversation Wall.
- `ConversationWall.tsx` is read-only UI but subscribes to
  `recentConversationEvalData` and `campusSocialState`, so any smoke extension
  should avoid mutations and avoid clicking filters unless clearly safe.

## Read First

- `WORKLOG.md` Current State Snapshot.
- `umi/reports/frontend-smoke-latest.json`.
- `scripts/underworld-frontend-smoke.mjs`.
- `src/App.tsx`.
- `src/components/Game.tsx` topbar `世界` / `對話` switch.
- `src/components/ConversationWall.tsx`.
- `src/index.css` Conversation Wall / mobile styles.

## Questions For CC

Findings-first, read-only:

1. Is adding a non-mutating Conversation Wall check to
   `underworld:frontend-smoke` the next useful machine gate, or should it remain
   manual-only?
2. If worth adding, what exact route/click flow and DOM assertions are stable?
   Candidate flow: after world-view selection smoke, click topbar `對話`, wait
   for `.giis-conversation-wall`, assert header/metrics/controls/grid or empty
   state, no hard console/network, no horizontal overflow, then click
   `回到世界` and assert `.giis-live-room-shell` returns.
3. Should this run for every viewport or only mobile + desktop to avoid making
   smoke too slow/heavy?
4. Are there code risks in `ConversationWall` itself that a small patch should
   address first, e.g. transient `campusSocialState` timeout, filter overflow,
   or missing loading fallback?
5. What must stay manual acceptance?

## Constraints

- Read-only. Do not modify files.
- Do not run watch/dev servers.
- Do not mutate Convex state intentionally.
- Avoid clicking action pills, `接手 Alan`, chat inputs, quick actions, or
  anything that sends Convex mutations or triggers provider/LLM work.
- If you recommend a patch, keep it narrow: smoke coverage or a tiny
  frontend-only resilience/overflow fix.
- Do not propose backend/prompt/provider changes.

## Expected Output

Return:

1. Top findings by severity.
2. Whether Codex should patch now.
3. If patching, smallest implementation batch with selectors/assertions.
4. Verification commands.
5. Manual acceptance that remains required.

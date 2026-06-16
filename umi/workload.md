# CC Workload - Frontend Market-Readiness Residual Review

Time anchor: 2026-06-16 14:35 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first review before Codex implements any next patch

## Task ID

underworld-frontend-market-readiness-residual-review-20260616-1435

## Context

Alan's active goal is still:

> 你重複前端有沒有什麼其他問題呢？你拉上cc一起討論。把前端優化到可以上市

Recent shipped frontend-stability commits on `main`:

- `432a4d6b` reduced frontend flicker and conversation jumps.
- `890ae766` added shared hot-path world state and route ErrorBoundary.
- `2b3221d0` fixed a reproduced mobile flicker path by pausing/skipping heavy
  notebook/summary/timeline queries during active dialogue and fixing duplicate
  chat actions.
- `bec338b` added a stable loading shell, current-dialogue history skip, and
  loading-disabled `InteractButton`.
- `946b698b` preserved dialogue during transient `worldState`,
  `gameDescriptions`, and `messages.listMessages` reloads.
- `0ad69099` added repeatable mobile/desktop frontend smoke coverage and fixed
  missing emotion portrait 404s.
- `4abe717e` moved optional `campusSocialState` / `umiBriefing` queries behind a
  soft-failure loader so a timeout no longer remounts the whole `Game` UI.

Current evidence:

- `npm run underworld:frontend-smoke` last PASS 2/2 after `4abe717e`.
- `npx tsc --noEmit --pretty false`, `npm run build`, and
  `npm run underworld:runtime-preflight` passed after `4abe717e`.
- Current worktree has unrelated `media/topics/watcher-inbox.md` dirty from a
  Field Notes watcher flow. Ignore it; do not stage/revert it.
- `umi/workload.md` is this active cc task.

Known remaining caveats from `WORKLOG.md`:

1. Alan/in-app mobile visual acceptance is still unproven.
2. The frontend smoke still records this known warning:
   `Convex functions should not be imported in the browser. This will throw an error in future versions of convex.`
3. Full WorldContext/provider consolidation for non-hot-path duplicate queries is
   deferred unless there is a concrete launch-risk reason to do it now.
4. Engine anchoring should eventually confirm whether `startConversation` always
   keeps Alan anchored in the principal office across edge cases.

## Read First

- `WORKLOG.md` row 7 and Current State Snapshot.
- `umi/reports/frontend-smoke-latest.json`.
- `src/App.tsx`
- `src/components/Game.tsx`
- `src/components/PlayerDetails.tsx`
- `src/components/Messages.tsx`
- `src/components/MessageInput.tsx`
- `src/components/ConversationWall.tsx`
- `src/components/buttons/InteractButton.tsx`
- `src/hooks/serverGame.ts`
- `src/hooks/useWorldHeartbeat.ts`
- `src/index.css`
- For the Convex browser-import warning, inspect imports from frontend into
  `convex/aiTown/*`, especially `convex/aiTown/world.ts`,
  `convex/aiTown/agent.ts`, `convex/aiTown/player.ts`, and
  `convex/aiTown/conversation.ts`.

You may inspect adjacent frontend files and recent diffs as needed.

## Questions For CC

Findings-first, read-only:

1. What P0/P1/P2 frontend launch-readiness risks remain after `4abe717e`?
2. Is the remaining Convex browser-import warning likely caused by a specific
   frontend import path? If yes, what is the smallest safe fix?
3. Are there any active-dialogue render paths, subscriptions, effects, or
   scroll/focus behaviors still likely to cause flicker, jump, stale target, or
   ErrorBoundary fallback under load?
4. Does the mobile invite/direct-dialogue flow still make it unclear when Alan
   is offline, waking, invited, talking, or blocked?
5. Does Scene Mode still risk clipped characters, status-card overlap, hidden
   controls, or unreadable action bars on desktop/mobile?
6. Is there one small implementation batch Codex should do now? If no, say what
   evidence would be needed before more changes.

## Constraints

- Read-only. Do not modify files.
- Do not run watch/dev servers.
- Do not mutate Convex data or local runtime state.
- You may run static commands such as `git status`, `git diff`, `rg`, `sed`,
  `npx tsc --noEmit --pretty false`, or `npm run build` if useful. Avoid broad
  eval suites.
- Do not propose a large rewrite unless you can show a concrete market-readiness
  blocker that cannot be addressed by a smaller patch.
- Treat engine/backend anchoring as a finding only unless the frontend code is
  clearly misleading the user about that state.

## Expected Output

Return:

1. Top findings by severity with file/line references.
2. What looks directionally right after the recent patches.
3. The smallest next patch Codex should implement now, if any.
4. Verification commands and browser/mobile smoke path Codex should run.
5. Deferred follow-ups that should stay out of this immediate batch.

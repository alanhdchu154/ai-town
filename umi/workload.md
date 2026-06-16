# CC Workload - Frontend Market-Readiness Residual Review

Time anchor: 2026-06-16 13:56 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first review before Codex implements the next batch

## Task ID

underworld-frontend-market-readiness-residual-review-20260616

## Context

Alan's active goal is still:

> 你重複前端有沒有什麼其他問題呢？你拉上cc一起討論。把前端優化到可以上市

Recent shipped frontend-stability commits on `main`:

- `432a4d6b` reduced frontend flicker and conversation jumps.
- `890ae766` added shared hot-path world state and route ErrorBoundary.
- `2b3221d0` fixed the reproduced mobile flicker root cause by pausing/skipping
  heavy notebook/summary/timeline queries during active dialogue and fixing a
  duplicate chat action.
- `bec338b` added the post-flicker residual patch: current dialogue skips
  `previousConversation`, `InteractButton` is loading-disabled/labeled, and
  `Game` renders a stable loading shell instead of `null`.

Current worktree note:

- `media/topics/watcher-inbox.md` is dirty from a Field Notes watcher flow.
  Ignore it for this review and do not ask to stage/revert it.
- `umi/workload.md` is being updated for this cc review.

Central handoff and `WORKLOG.md` row 7 say the remaining frontend launch
caveats are:

1. Full WorldContext/provider consolidation for non-hot-path duplicate queries.
2. Engine anchoring: confirm whether `startConversation` should always keep
   Alan anchored in the principal office across edge cases.
3. Alan/in-app mobile visual acceptance is still unproven.

Umi/Codex wants an independent residual review, not a rewrite. Treat
"market-ready frontend" pragmatically: ordinary mobile/desktop use should not
feel jumpy, clipped, mysterious, blocked, or unclear about what can be clicked.

## Read First

- `WORKLOG.md` row 7 and Current State Snapshot.
- `src/App.tsx`
- `src/components/Game.tsx`
- `src/components/PlayerDetails.tsx`
- `src/components/Messages.tsx`
- `src/components/MessageInput.tsx`
- `src/components/ConversationWall.tsx`
- `src/components/buttons/InteractButton.tsx`
- `src/hooks/useWorldHeartbeat.ts`
- `src/index.css`

You may inspect adjacent frontend files and recent diffs as needed.

## Questions For CC

Findings-first, read-only:

1. What P0/P1/P2 frontend launch-readiness risks remain after `bec338b`?
2. Are there any active-dialogue render paths, subscriptions, effects, or
   scroll/focus behaviors still likely to cause flicker, jump, stale target, or
   ErrorBoundary fallback under load?
3. Does the mobile invite/direct-dialogue flow still make it unclear when Alan
   is offline, waking, invited, talking, or blocked?
4. Does Scene Mode still risk clipped characters, status-card overlap, hidden
   controls, or unreadable action bars on desktop/mobile?
5. Is there one small implementation batch Codex should do now? If no, say what
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
- Keep engine/backend anchoring as a finding only unless the frontend code is
  clearly misleading the user about that state.

## Expected Output

Return:

1. Top findings by severity with file/line references.
2. What looks directionally right after the recent patches.
3. The smallest next patch Codex should implement now, if any.
4. Verification commands and browser/mobile smoke path Codex should run.
5. Deferred follow-ups that should stay out of this immediate batch.

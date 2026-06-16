# CC Workload - Post-Flicker Frontend Launch Readiness Review

Time anchor: 2026-06-16 13:48 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first review before Codex implements the next frontend batch

## Task ID

underworld-post-flicker-frontend-readiness-20260616

## Context

Alan's active goal is still:

> 你重複前端有沒有什麼其他問題呢？你拉上cc一起討論。把前端優化到可以上市

Recent shipped commits on `main`:

- `432a4d6b` reduced frontend flicker and conversation jumps.
- `890ae766` added shared hot-path world state and route ErrorBoundary.
- `2b3221d0` fixed the reproduced mobile flicker root cause:
  active conversations no longer depend on heavy notebook/summary/timeline queries,
  offline Alan invite no longer sends duplicate chat actions, and crowded 5-6
  character scenes use responsive standee spacing.

Current `ai-town` worktree is clean. Central handoff and `WORKLOG.md` row 7 say
the remaining launch-readiness caveats are:

1. Full WorldContext/provider consolidation for non-hot-path duplicate queries.
2. Engine anchoring: confirm whether `startConversation` should always keep Alan
   anchored in the principal office across edge cases.
3. More Alan/mobile visual playtest time before claiming market-ready.

Umi/Codex wants a fresh independent review after the flicker patch, not a broad
rewrite. Focus on whether any remaining frontend UI/UX/stability issue is
likely to make Alan say "this is confusing, jumpy, clipped, or not friendly"
during ordinary mobile/desktop use.

## Read First

- `WORKLOG.md` row 7 and Current State Snapshot.
- `src/components/Game.tsx`
- `src/components/PlayerDetails.tsx`
- `src/components/Messages.tsx`
- `src/components/MessageInput.tsx`
- `src/App.tsx`
- `src/index.css`
- `src/hooks/useWorldHeartbeat.ts`
- `src/components/buttons/InteractButton.tsx`

You may inspect adjacent frontend files and recent diffs as needed.

## Questions For CC

Findings-first, read-only:

1. What are the top P0/P1/P2 frontend launch-readiness risks remaining after
   commit `2b3221d0`?
2. Are there remaining query subscriptions or render paths that can still pull
   active dialogue into ErrorBoundary under Convex load?
3. Does the mobile dialogue/invite flow still have confusing states, double
   actions, unavailable buttons, or stale target state?
4. Do the Scene Mode layout rules still risk clipped characters, hidden status
   cards, or controls overlapping on desktop/mobile?
5. What is the smallest next implementation batch Codex should do now, and what
   should remain deferred?

## Constraints

- Read-only. Do not modify files.
- Do not run watch/dev servers.
- Do not mutate Convex data or local runtime state.
- You may run static commands such as `git status`, `git diff`, `rg`, `sed`,
  `npm run build`, or focused typecheck if useful. Avoid broad eval suites.
- Do not propose a large rewrite unless you can show a specific market-readiness
  blocker that a small patch cannot address.

## Expected Output

Return:

1. Top findings by severity with file/line references.
2. What looks directionally right after the recent patches.
3. The smallest next patch Codex should implement now.
4. Verification commands and browser smoke path Codex should run.
5. Deferred follow-ups that should stay out of this immediate batch.

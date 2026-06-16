# CC Workload - Frontend Resilience Second-Batch Review

Time anchor: 2026-06-16 13:10 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only risk review before Codex implements the next frontend batch

## Task ID

underworld-frontend-resilience-second-batch-20260616

## Context

Alan's active goal is still: "你重複前端有沒有什麼其他問題呢？你拉上cc一起討論。把前端優化到可以上市"

Previous batch already shipped and is pushed at `432a4d6b`:

- `Game` passes shared `humanTokenIdentifier`, `playerIdentity`,
  `umiBriefing`, and `campusSocialState` into `PlayerDetails`.
- Conversation auto-scroll no longer reacts to typing-state churn.
- Mobile conversation entry no longer auto-focuses the textarea.
- Conversation change clears stale draft/inflight state.
- Conversation-start scroll is scoped to the panel instead of `window`.
- Target-character change resets history/wake prompt/tab state.

Current repo is clean at handoff start. `WORKLOG.md` row 7 and the current
snapshot name the remaining frontend launch-readiness caveats:

1. Full shared-data boundary / remaining duplicate subscriptions.
2. ErrorBoundary fallback for transient Convex/world parse failures.
3. Separate engine anchor caveat: `startConversation` may still walk both
   participants to a midpoint instead of anchoring Alan in the principal office.

Umi/Codex's intended second batch is deliberately smaller than a full
Context rewrite:

- Let `useWorldHeartbeat` accept the `worldStatus` already queried by `Game`,
  removing its duplicate `defaultWorldStatus` subscription.
- Let `InteractButton` receive `worldStatus`, `game`, and
  `humanTokenIdentifier` from `Game`, removing its duplicate
  `defaultWorldStatus`, `useServerGame`, and `userStatus` subscriptions.
- Add a small React class ErrorBoundary around the main route content in
  `App.tsx`, with a product-appropriate "校園正在重新連線" fallback and a
  refresh button. Do not introduce new dependencies.

## Read First

- `WORKLOG.md` row 7 and current snapshot.
- `src/App.tsx`
- `src/components/Game.tsx`
- `src/components/buttons/InteractButton.tsx`
- `src/hooks/useWorldHeartbeat.ts`
- `src/hooks/serverGame.ts`
- `src/components/Messages.tsx`
- `src/components/PlayerDetails.tsx`

You may inspect adjacent frontend files and generated types as needed.

## Questions For CC

Findings-first, read-only:

1. Is Umi/Codex's intended second batch safe and aligned with launch-readiness,
   or is any part likely to create behavior regressions?
2. For `useWorldHeartbeat(worldStatus?)`, what dependency/stale-closure risk
   should Codex avoid?
3. For `InteractButton` prop injection, what loading/null cases must remain
   correct?
4. For `App.tsx` ErrorBoundary, what is the smallest implementation that does
   not hide real bugs forever and still gives Alan a humane recovery path?
5. Are there any P0/P1 frontend issues from the previous audit that this batch
   must not defer?

## Constraints

- Read-only. Do not modify files.
- Do not run watch/dev servers.
- Do not mutate Convex data or local runtime state.
- You may run static commands such as `rg`, `sed`, `git status`,
  `npm run build` only if useful. Avoid broad eval suites.
- Do not propose a large Context migration unless you can show this smaller
  batch is unsafe or insufficient.

## Expected Output

Return:

1. Verdict on the proposed second batch.
2. Specific implementation cautions with file/line references.
3. Any minimal extra change Codex should include in this batch.
4. Verification commands Codex should run.
5. What should remain as a later follow-up.

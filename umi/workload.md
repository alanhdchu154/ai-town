# CC Workload - Frontend Mobile Flow Gate Review

Time anchor: 2026-06-16 14:50 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first review before Codex implements a next gate/patch

## Task ID

underworld-frontend-mobile-flow-gate-review-20260616-1450

## Context

Alan's active goal is still:

> 你重複前端有沒有什麼其他問題呢？你拉上cc一起討論。把前端優化到可以上市

Current state after pushed commit `82dad797`:

- No P0 from last cc review.
- Convex browser-import warning is fixed.
- Frontend no longer runtime-imports backend simulation classes into the browser.
- `npm run underworld:frontend-smoke` now covers:
  - mobile 390x844
  - small-mobile 360x640
  - desktop 1440x960
- Latest smoke PASS 3/3:
  - all viewports live
  - hard console issues 0
  - horizontal overflow 0
  - only known warning: `Ignoring Event: localhost`
- `npx tsc --noEmit --pretty false`, `npm run build`, `npm run
  underworld:runtime-preflight`, and `git diff --check` passed before
  `82dad797`.
- Current worktree has unrelated `media/topics/watcher-inbox.md` dirty from a
  Field Notes watcher. Ignore it; do not ask to stage/revert it.

Remaining market-readiness gap from `WORKLOG.md`:

- Real Alan/in-app mobile acceptance is still unproven.
- We need stronger machine evidence for Alan's main mobile path without
  mutating Convex data destructively.

## Read First

- `WORKLOG.md` Current State Snapshot.
- `umi/reports/frontend-smoke-latest.json`.
- `scripts/underworld-frontend-smoke.mjs`.
- `src/components/Game.tsx`.
- `src/components/PlayerDetails.tsx`.
- `src/components/Messages.tsx`.
- `src/components/MessageInput.tsx`.
- `src/index.css`.

You may inspect adjacent frontend files and DOM text/ARIA selectors as needed.

## Questions For CC

Findings-first, read-only:

1. After `82dad797`, what is the highest-value next automated frontend gate
   that would move us closer to "market-ready" without pretending to replace
   Alan's real in-app acceptance?
2. Should the existing `underworld:frontend-smoke` be extended to click through
   a minimal mobile flow (select visible character -> verify CTA/helper -> open
   panel/dialogue or invite button availability), or should that be a separate
   script?
3. What exact DOM selectors/text assertions look stable enough for this gate?
4. What should the gate avoid doing to prevent unwanted Convex state mutation
   or LLM/provider load?
5. Are there any remaining launch-risk UI issues in the mobile selection /
   invite / dialogue entry path that a small patch should fix now?

## Constraints

- Read-only. Do not modify files.
- Do not run watch/dev servers.
- Do not mutate Convex data intentionally.
- You may run static commands such as `git status`, `git diff`, `rg`, `sed`,
  `npx tsc --noEmit --pretty false`, or inspect the latest smoke JSON. Avoid
  broad eval suites and avoid clicking UI unless you can prove it is read-only.
- Do not propose broad redesign.

## Expected Output

Return:

1. Top findings / recommendation by severity.
2. The smallest next implementation batch Codex should do now.
3. Stable selectors/text assertions to use.
4. Verification commands to run.
5. Follow-ups that must remain manual Alan acceptance.

# CC Workload - Frontend Post-Selection Stability Review

Time anchor: 2026-06-16 15:02 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first review before Codex implements any next patch

## Task ID

underworld-frontend-post-selection-stability-review-20260616-1502

## Context

Alan's active goal is still:

> 你重複前端有沒有什麼其他問題呢？你拉上cc一起討論。把前端優化到可以上市

Most recent pushed frontend commits:

- `ae543f56` added a non-mutating frontend selection smoke: mobile,
  small-mobile, and desktop load `/ai-town`, click a visible non-Alan standee,
  and assert selected character, bottom `目標`, visible helper / focus card, and
  visible primary CTA without clicking any mutation/LLM action.
- `82dad797` removed Convex server/simulation class imports from the browser and
  made frontend smoke fail on hard console issues.
- `4abe717e` moved optional campus context queries behind a soft query boundary
  so timeouts no longer remount the main room.

Fresh evidence after `ae543f56`:

- `npm run underworld:frontend-smoke` PASS 3/3.
- `npm run underworld:runtime-preflight` PASS.
- Latest smoke report generated `2026-06-16T19:59:11.195Z`.
- Mobile selected 一之瀨 and showed helper:
  `Alan 離校中；按下後會先把 Alan 接回校長室，再邀請 一之瀨。`
- Small-mobile and desktop selected 祥子 and showed the same invite/wake helper.
- Hard console issues 0, bad network 0, horizontal overflow 0.
- Current worktree has only unrelated `media/topics/watcher-inbox.md` dirty,
  plus this `umi/workload.md` handoff. Ignore the watcher inbox; do not ask to
  stage/revert it.

User-reported problem to keep in mind:

- Alan said today's UI felt unusually flickery and could suddenly jump to
  another scene, then come back. Earlier patches addressed confirmed timeout
  and focus-to-Alan paths, but we need stronger evidence that the selected scene
  does not drift or fall back shortly after a safe interaction.

## Read First

- `WORKLOG.md` Current State Snapshot and Open Follow-Ups.
- `umi/reports/frontend-smoke-latest.json`.
- `scripts/underworld-frontend-smoke.mjs`.
- `src/components/Game.tsx`.
- `src/components/PlayerDetails.tsx`.
- `src/components/Messages.tsx`.
- `src/components/MessageInput.tsx`.
- `src/index.css`.

You may inspect adjacent frontend files and recent diffs as needed.

## Questions For CC

Findings-first, read-only:

1. After `ae543f56`, what is the next highest-value frontend launch risk that
   can be reduced with a small code/gate patch?
2. Should the existing `underworld:frontend-smoke` add a post-selection idle
   stability check, e.g. wait several seconds after selecting a character and
   assert the selected scene/target did not disappear, no route fallback
   appeared, and no horizontal overflow / hard console issue emerged?
3. What exact DOM/state assertions should we use to detect Alan's "suddenly
   jumps to another scene and back" symptom without depending on character names
   or mutating Convex state?
4. Are there code paths in `Game.tsx` or related components that can still
   change `selectedSceneId`, selected target, or view state after a read-only
   selection even when Alan follow mode is off?
5. Is there any small UI affordance fix still worth doing now for market
   readiness, or should this batch be gate-only?

## Constraints

- Read-only. Do not modify files.
- Do not run watch/dev servers.
- Do not mutate Convex data intentionally.
- Avoid clicking action pills, `接手 Alan`, chat inputs, quick actions, or
  anything that sends Convex mutations or triggers provider/LLM work.
- You may run static commands and inspect the latest smoke JSON. If you run a
  smoke, keep it to the existing non-mutating script.
- Do not propose broad redesign or backend/prompt changes.

## Expected Output

Return:

1. Top findings by severity.
2. The smallest next implementation batch Codex should do now.
3. Stable selectors/state assertions to use.
4. Verification commands to run.
5. What must remain Alan/manual acceptance.

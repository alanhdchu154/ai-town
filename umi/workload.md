# CC Workload - Frontend Market-Readiness Audit

Time anchor: 2026-06-16 13:00 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first frontend audit

## Task ID

underworld-frontend-market-readiness-20260616

## Context

Alan asked: "你重複前端有沒有什麼其他問題呢？你拉上cc一起討論。把前端優化到可以上市"

This is not a tiny copy tweak. Treat it as a product/frontend readiness review
for the `/ai-town` experience, especially the current Scene Mode / mobile /
conversation flow. Do not redefine "上市" as "build passes"; find the issues
that would still make the product feel unstable, confusing, or unpolished.

Current evidence:

- Repo is clean at task start.
- Recent UI patches landed:
  - `79947cd3 Improve mobile conversation flow`
  - `b33cd6de Allow offline Alan invite flow`
  - `a36ad127 Reduce scene focus jumps`
- `npm run build` passed after those changes.
- Runtime preflight passed after a 12:41-12:44 CDT local Convex instability
  window.
- Logs during that window showed `Too many concurrent requests`, query
  timeouts, `saveWorld` failure, `restartDeadWorlds`, and one
  `generationNumber mismatch`. That may be backend pressure, not pure UI.
- Frontend focus jump patch reduced one UI-side cause: action-cinematic now
  refocuses Alan only while Alan-follow mode is active, and selecting/finding
  characters disables Alan-follow mode.
- Umi first look suspects duplicate/heavy subscriptions between `Game.tsx` and
  `PlayerDetails.tsx` may contribute to query pressure and flicker.

## Read First

- `WORKLOG.md` row 7 and current snapshot
- `docs/giis-v0.1-roadmap.md`
- `src/App.tsx`
- `src/components/Game.tsx`
- `src/components/PlayerDetails.tsx`
- `src/components/SceneStage.tsx`
- `src/components/Messages.tsx`
- `src/components/MessageInput.tsx`
- `src/components/ConversationWall.tsx`
- `src/index.css`
- `src/hooks/serverGame.ts`
- `src/hooks/useWorldHeartbeat.ts`

You may inspect adjacent frontend files, Convex query definitions, and recent
reports/logs only as needed. Avoid broad repo scans unless a finding requires
it.

## Questions For CC

Findings-first, read-only:

1. What frontend issues still block a "market-ready" feel?
2. Which issues are P0/P1 because they cause flicker, jumpiness, broken mobile
   layout, confusing interaction flow, accidental backend pressure, or lost
   user input?
3. Are there duplicate or heavy subscriptions in the main world view that could
   be reduced without changing product behavior?
4. Are there view-state bugs where the UI can unexpectedly reset scene,
   selected character, panel state, scroll position, active tab, or route?
5. Are there mobile layout/accessibility/readability problems likely to show up
   on iPhone-size screens?
6. Are there stale labels or mode conflicts remaining after the invite/focus
   patches?
7. What are the smallest high-confidence code changes Codex should implement
   first to move the frontend closer to launch quality?

## Constraints

- Read-only. Do not modify files.
- Do not run watch/dev servers.
- Do not mutate Convex data or local runtime state.
- You may run static commands like `npm run build`, `git grep`/`rg`, or
  targeted file reads. Avoid broad eval suites.
- Keep advice practical and prioritized. Alan wants a product that feels good,
  not an infinite refactor list.

## Expected Output

Return:

1. Verdict: launch-ready / not launch-ready / launch-ready with caveats.
2. P0/P1 frontend blockers with file/line references and why they matter to a
   user.
3. P2 polish items that are worth doing later.
4. Recommended first implementation batch, sized to one Codex turn.
5. Verification commands you ran or intentionally skipped.
6. Any risk where frontend symptoms are actually backend/runtime pressure.

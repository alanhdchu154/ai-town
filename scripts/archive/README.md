# Retired Underworld scripts

These scripts drove the old **heartbeat / afternoon-gate readiness ritual** that
fed a Codex cron (since removed). The cron produced frequent "readiness pulse"
docs commits that did not change the product. With the cron gone these
orchestrators were dead weight, so they were retired on 2026-06-05 to reduce gate
ceremony and give energy back to actual development.

Retired here:

- `underworld-v01-afternoon-gate.mjs` — the 10-way cron orchestrator
- `underworld-afternoon-world-ready.mjs` — afternoon-gate world-ready helper
- `underworld-v01-goal-audit.mjs` — ritual goal-audit driver
- `underworld-day-start.mjs` — day-start ritual driver
- `underworld-approach-v01.mjs` + `run_v01_approach_loop.sh` — the approach loop
- `underworld-heartbeat.mjs` — the heartbeat pulse tool

Also removed the npm alias `underworld:v01-daytime-check`.

## What is still live (the real v0.1 gates)

- `npm run underworld:v01-completion-audit` — the v0.1 audit (depends only on
  rolling-continuity)
- `npm run underworld:rolling-continuity` — primary recent-memory continuity gate
- `npm run underworld:alan-playtest-check` — Alan-facing playtest gate
- Diagnostic leaves kept and usable on demand: `underworld:observe`,
  `underworld:life-density`, `underworld:life-signals`,
  `underworld:alan-chat-archival`, `underworld:repair-gate`,
  `underworld:rubric-reconcile`, `underworld:runtime-preflight`,
  `underworld:am-pm-continuity`, `underworld:cleanup-fallback-pollution:dry-run`.

## Restore

`git mv scripts/archive/<file> scripts/<file>` (or `umi/` for the `.sh`) and
re-add the npm entry. Full history is in git.

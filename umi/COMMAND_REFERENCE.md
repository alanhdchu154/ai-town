# Command Reference

A single page mapping every npm script, helper script, and shell loop in
this repo to what it actually does and when to use it. If a command is
not listed here it is either deprecated or you are using it wrong.

Last updated: 2026-05-25.

---

## 1. Daily play / dev

| Command | What it does | When to use |
|---|---|---|
| `npm run dev` | Starts Convex backend + Vite frontend in parallel | Local play / development |
| `npm run dev:backend` | Only the Convex tail-logs loop | Two-terminal workflow |
| `npm run dev:frontend` | Only Vite | Two-terminal workflow |
| `npm run build` | `tsc && vite build` | Pre-push sanity check |
| `npm test` | Jest suite (currently 55 unit tests) | After touching `convex/*` or `modelPolicy` |

## 2. Conversation eval — what to run after collecting samples

| Command | What it measures | When to use |
|---|---|---|
| `npm run eval:soul-triad` | Umi / Mahiru / Asuna pilot: 30+ soul markers, memory continuity, slogan / echo / stage-direction penalties. Writes `evals/conversations/reports/soul-triad-latest.md`. **Prints fresh-sample warning if results < 3.** | **Canonical v0.1 eval.** Run after any fresh triad sample is collected. |
| `npm run eval:conversation:recent` | General dialogue hygiene across all recent archived conversations (not pilot-specific). Supports `-- --since-last-change`. | Daytime sanity check; not for soul tuning decisions. |
| `npm run eval:conversation` | Full historical conversation eval | Rare — when seeding a fresh corpus from scratch. |
| `npm run eval:conversation:loop` | Long-running watch loop | Background daytime QA (rare). |
| `npm run eval:umi-mahiru` | Legacy pre-triad pilot eval | Deprecated — prefer `eval:soul-triad`. |
| `npm run eval:soul-qa-loop` | Semi-autonomous: collect samples → print transcript → run eval → write `umi/reports/soul-loop-latest.md` | Quiet-hour sample accumulation. |

## 3. Sample collection — pilot scripts

These set pilot env knobs at start and **always** unset them in a
`finally` block. Never leave them on globally.

| Command | What it does | When to use |
|---|---|---|
| `npm run pilot:soul-triad:single-sample` | Opens `SOUL_TRIAD_COLOCATION_PILOT`, co-locates Umi / Mahiru / Asuna, collects one archived conversation, runs `eval:soul-triad`, removes pilot envs, stops the engine. | **Canonical single-sample collection for v0.1.** |
| `npm run pilot:umi-mahiru:single-sample` | Pre-triad version. Umi ↔ Mahiru only. | Legacy. Prefer the triad version. |

## 4. Observation / repair (read-only-by-default)

| Command | What it does | When to use |
|---|---|---|
| `npm run underworld:observe` | Snapshot world state + recent events. **Never modifies code.** Writes `umi/reports/v01-approach-latest.md`. | Start every triage session here. |
| `npm run underworld:repair-gate` | Diagnose + classify allowed small fixes vs. proposal-only changes. Hygiene fixes only; refuses to act if provider health bad or samples < 3. | After observe, before any code edit. |
| `npm run underworld:approach:v01` | One director-loop iteration (observe → repair-gate → report). | The v0.1 approach loop's single shot. |
| `bash umi/run_v01_approach_loop.sh` | Local long-running wrapper around `underworld:approach:v01` with persistent log at `umi/reports/v01-approach-loop.log`. Stop with Ctrl-C. | Overnight or unattended loops. |
| `bash umi/soul_triad_hourly_eval_until_sleep.sh` | Hourly `eval:soul-triad` runs until configured sleep time. | Daytime evidence accumulation. |

## 5. Helpers

| Command | What it does | When to use |
|---|---|---|
| `node scripts/test-qwen-key.mjs` | Smoke-test cloud Qwen API key against the proxy. | After rotating `UMI_MAHIRU_PILOT_API_KEY`. |
| `node scripts/repair-local-convex-state.mjs` | Repair local Convex state if engine wedged. | Last resort before `testing:wipeAllTables`. |
| `python umi/orchestrator.py run umi/workload.md --dry-run` (npm: `umi:dry-run`) | Validate workload.md handoff structure without executing. | Before paging CC. |
| `npm run umi:cc` / `umi:cc:write` | Drive CC against `umi/workload.md`. `:write` allows mutations. | Active CC handoff sessions. |

## 6. Convex direct (no npm wrapper)

| Command | What it does | When to use |
|---|---|---|
| `npx convex run testing:stop` | Stop the engine cleanly | Before destructive ops |
| `npx convex run testing:resume` | Resume after stop | After stop / config change |
| `npx convex run testing:kick` | Force a tick if engine seems wedged | Engine appears frozen |
| `npx convex run testing:wipeAllTables` | **Destructive.** Drop all world data. | LLM/embedding model change only |
| `npx convex run init` | Re-seed a fresh world | After `wipeAllTables` |
| `npx convex run school:repairWorldState` | Repair seven-character roster + scene placement | After visible roster drift |
| `npx convex run school:umiBriefing` | Print Umi's morning briefing | Briefing copy QA |
| `npx convex run school:debugState` | Dump live player positions + pathfinding | Diagnose visible movement issues |

---

## Deprecated / removed candidates

Verified 2026-05-26 by `grep -r` across the repo.

**Truly orphaned — safe to `rm` (only referenced from this section and historical WORKLOG/roadmap entries):**

- `umi/fast_pilot_watch.sh` — pre-triad fast loop; replaced by `pilot:soul-triad:single-sample`.
- `umi/umi_mahiru_eval_15min_loop.sh` — pre-triad eval loop; replaced by `eval:soul-triad:hourly`.
- `umi/umi_mahiru_fast_loop.sh` — pre-triad sample collection; replaced by triad single-sample.

**Still wired (delete requires removing the npm alias too):**

- `umi/umi_mahiru_soul_depth_30min_loop.sh` — pre-triad depth eval; replaced by triad eval. **Still referenced via [`package.json` `eval:umi-mahiru:soul-loop`](../package.json)** — remove that npm script before deleting the shell wrapper.

---

## Rules of thumb

1. **Observation first.** Always run `underworld:observe` before any
   diagnosis or code edit.
2. **Eval respects the fresh-sample rule.** If `eval:soul-triad` reports
   fewer than 3 triad samples, do not change conversation or memory
   behavior unless you are fixing a runtime/hygiene bug. The eval will
   print a warning when this rule is in effect.
3. **Pilot envs stay scoped.** Never set `SOUL_TRIAD_*` or
   `UMI_MAHIRU_*` envs globally — let the pilot scripts manage them.
4. **One canonical script per job.** If you find yourself adding a new
   `run_*` shell wrapper, ask whether the underlying `.mjs` can take
   the env knob instead. Shell wrappers tend to silently drift.

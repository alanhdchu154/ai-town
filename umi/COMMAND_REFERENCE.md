# Command Reference

A single page mapping every npm script, helper script, and shell loop in
this repo to what it actually does and when to use it. If a command is
not listed here it is either deprecated or you are using it wrong.

Last updated: 2026-06-12.

---

## 1. Daily play / dev

| Command | What it does | When to use |
|---|---|---|
| `npm run dev` | Starts Convex backend + Vite frontend in parallel | Local play / development |
| `npm run dev:backend` | Only the Convex tail-logs loop | Two-terminal workflow |
| `npm run dev:frontend` | Only Vite | Two-terminal workflow |
| `npm run build` | `tsc && vite build` | Pre-push sanity check |
| `npm test` | Jest suite (currently **115** unit tests, 14 suites) | After touching `convex/*` or `modelPolicy` |

## 2. Conversation eval — what to run after collecting samples

| Command | What it measures | When to use |
|---|---|---|
| `npm run eval:soul-triad` | Current evidence-pilot eval for `海 / 真晝 / 貓貓 / 天澤 / 一之瀨 / 祥子`: 30+ soul markers, memory continuity, slogan / echo / stage-direction penalties. Writes `evals/conversations/reports/soul-triad-latest.md`. **Prints fresh-sample warning if results < 3.** | **Canonical v0.1 eval.** Run after fresh pilot samples are collected. |
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
| `npm run pilot:soul-triad:single-sample` | Opens `SOUL_TRIAD_COLOCATION_PILOT`, co-locates a requested focus pair from the current evidence pilots, collects one conversation, runs `eval:soul-triad`, and removes pilot envs. Use `--require-archived=true` when collecting v0.1 evidence. Includes representative-cloud preflight (fails before world mutation if provider/key/quota bad). | **Canonical single-sample collection for v0.1.** |
| `npm run pilot:soul-triad:single-sample:self-test` | Smoke-check the runner without touching the world. | Pre-flight before a real sample run. |
| `npm run pilot:umi-mahiru:single-sample` | Pre-triad version. Umi ↔ Mahiru only. | Legacy. Prefer the triad version. |
| `npm run pilot:local-qwen:disposable` | One-shot local-Qwen disposable probe. | Local-LLM smoke. |
| `npm run pilot:free-world-routing:disposable` | Disposable probe for free-world cloud routing. Includes preflight. | After a key/quota change, before opening the door. |
| `npm run pilot:core-trio:disposable-suite` | Disposable suite covering the core trio pairs. | Pre-window quality smoke. |

## 4. Observation / repair (read-only-by-default)

| Command | What it does | When to use |
|---|---|---|
| `npm run underworld:observe` | Snapshot world state + recent events. **Never modifies code.** Writes `umi/reports/v01-approach-latest.md`. | Start every triage session here. |
| `npm run underworld:observe:daytime-samples` | Observe with `--target-samples=3`, longer sample timeout, and `--require-archived=true`. Rotates current evidence-pilot pairs, prints fresh transcripts, and reports whether each fresh transcript created or failed to create an experience log. This is enough for a directional repair/eval read, not enough by itself to prove rolling or AM→PM continuity. | Daytime archived sample collection. |
| `npm run underworld:observe:self-test` | Self-test the observe script without hitting Convex. | CI / pre-loop smoke. |
| `npm run underworld:v01-goal-audit` | Audit v0.1 acceptance criteria from the latest observe; writes `umi/reports/v01-goal-audit-latest.md`. Exit nonzero on PENDING/FAIL by design. | After observe, to see how close v0.1 is. |
| `npm run underworld:v01-daytime-check` | Chained `observe:daytime-samples && v01-goal-audit`. Collects a small scoped sample batch; it does not guarantee adjacent-window rolling continuity by itself. | **Canonical first daytime command.** |
| `npm run underworld:afternoon-world-ready` | Read the default world status and resume only if it drifted to `inactive`; it does not resume `stoppedByDeveloper`. | Before natural afternoon evidence, or inside the afternoon gate. |
| `npm run underworld:v01-afternoon-gate` | Guarded 13:00-16:59 America/Chicago wrapper. First same-day afternoon pass runs runtime preflight → inactive-only world readiness → daytime check → rolling continuity → AM→PM → repair gate → rubric reconciliation → completion audit; later same-day passes switch to read-only rolling/AM→PM/life/repair/rubric/completion refresh. Writes `umi/reports/v01-afternoon-gate-latest.md`. | Preferred afternoon v0.1 gate. If rolling continuity is still sample-pending, keep natural evidence going instead of changing prompts. |
| `npm run underworld:alan-playtest-template` | Prints the required local Alan-facing result artifact shape. Does not write evidence or mark PASS. | Before Alan intentionally playtests Umi. |
| `npm run underworld:alan-playtest-init` | Writes a non-passing `PARTIAL` draft at `umi/reports/alan-facing-v01-playtest-latest.md` if no artifact exists. Does not clear the gate. | Before Alan playtest, to reduce result-record friction. |
| `npm run underworld:alan-playtest-candidates` | Read-only scan for recent Alan + Umi/海 conversations that may contain the five playtest prompts. Writes `umi/reports/alan-playtest-candidates-latest.md`; does not clear the gate. | Before asking Alan to repeat a playtest, to see whether usable evidence already exists. |
| `npm run underworld:alan-playtest-check` | Validates `umi/reports/alan-facing-v01-playtest-latest.md` has all five required checklist rows before completion audit consumes it. | After Alan-facing playtest, before `underworld:v01-completion-audit`. |
| `npm run underworld:human-flow-ready` | Runs runtime preflight + frontend smoke + optional Alan-facing candidate scan, then writes `umi/reports/human-flow-ready-latest.md` with local/mobile URLs and the pilot-character manual test script. Does not send messages or call providers. | Immediately before Alan tests Alan <-> role chat. |
| `npm run underworld:repair-gate` | Diagnose + classify allowed small fixes vs. proposal-only changes. Hygiene fixes only; refuses to act if provider health bad or samples < 3. | After observe, before any code edit. |
| `npm run underworld:repair-gate:self-test` | Validate the repair gate against synthetic evidence. | Smoke. |
| `npm run underworld:approach:v01` | One director-loop iteration (observe → repair-gate → goal-audit → report). | The v0.1 approach loop's single shot. |
| `npm run underworld:morning-check` | Chained harness self-test + day-start. | First command of the day. |
| `npm run underworld:day-start` | Day-start readiness check (clock, engine, fallback audit). | Start-of-day. |
| `npm run underworld:life-signals` | Scan day-window life signals (conversation shape, scene diversity, daily rhythm, soul style). Writes `umi/reports/life-signals-latest.md`. | Quality observation. |
| `npm run underworld:life-signals:self-test` | Self-test for the life-signal harness. | CI smoke. |
| `npm run underworld:rolling-continuity` | Scan adjacent two-hour windows for concrete residue -> callback / behavior shift. Writes `umi/reports/rolling-continuity-latest.md`, refreshes Alan-facing candidate scan, then refreshes memory hygiene, day-window life-signals, and the v0.1 completion audit as read-only follow-ups. | Primary v0.1 recent-memory continuity gate plus current-state refresh. A rolling PASS alone is not completion if life-signals, memory hygiene, or Alan-facing playtest remain unresolved. |
| `npm run underworld:rolling-continuity:self-test` | Self-test the rolling continuity scan. | CI smoke. |
| `npm run underworld:am-pm-continuity` | Scan AM→PM continuity: does an afternoon callback connect to morning residue? Writes `umi/reports/am-pm-continuity-latest.md`. | After AM and PM have both happened. |
| `npm run underworld:am-pm-continuity:self-test` | Self-test the continuity scan. | CI smoke. |
| `npm run underworld:heartbeat` | Lightweight world heartbeat (keeps engine warm). | Background. |
| `npm run underworld:harness:self-test` | Serial self-test of rolling + am-pm + life-signals + repair-gate + observe + goal-audit + Alan playtest artifact helper + soul-triad-single-sample. | Pre-loop / pre-window confidence. |
| `npm run underworld:cleanup-fallback-pollution:dry-run` | Dry-run audit of fallback-tainted memories / archived conversations / events / notifications / profiles. Accepts `--scope`, `--include-archived-conversations`, `--apply=true`. **Destructive only with `--apply=true`** and Alan-approved evidence. | Periodic hygiene audit. |
| `npm run underworld:state-audit` | Read-only local Convex sqlite growth audit. Reports active state size, scheduled-arg shapes, largest table groups, and latest payload samples to `umi/reports/state-growth-audit-latest.md`. | Daily health / before deciding whether state growth is safe. |
| `npm run underworld:archive-continuity-export` | One-time/manual export-only recovery from the archived old state into `umi/exports/archive-continuity-latest/`. No import, no mutation, embeddings excluded by default. | After an emergency fresh-world recovery, before designing curated import. Do not put in rolling automation. |
| `npm run underworld:continuity-package-audit` | Read-only audit of the exported continuity package. Flags fallback pollution, legacy character references, and candidate restoration boundaries. Writes `umi/reports/continuity-package-audit-latest.md`. | Before any legacy-memory import proposal. |
| `npm run underworld:continuity-restore-candidates` | Read-only sampler that turns the exported continuity package into capped Tier 1 / review-only / rejected candidate packets under `umi/exports/curated-continuity-candidates-latest/`, with report `umi/reports/curated-continuity-candidates-latest.md`. | Before asking Alan/cc to approve what old continuity is worth restoring. |
| `npm run underworld:legacy-continuity-import-plan` | Dry-run only plan that converts Tier 1 candidates into a default 12-row human-review packet for proposed `legacyContinuityEvidence` rows under `umi/exports/legacy-continuity-import-plan-latest/`. It skips first-pass food-care motifs, stage-direction leaks, repeated motif families, duplicate summaries, and non-first-restore kinds. It does not call Convex or write live memory. | After candidate review, before any Alan-approved importer exists. |
| `npm run underworld:legacy-continuity-import` | Dry-run validator for the proposed `legacyContinuityEvidence` packet. It writes `umi/reports/legacy-continuity-import-latest.md` and `umi/exports/legacy-continuity-import-latest/`, but does not call Convex. `--write` is intentionally blocked until Alan explicitly approves live import. | After `underworld:legacy-continuity-import-plan`, to inspect exact rows that would be written later. |
| `npm run underworld:sleep-consolidation` | Dry-run sleep/consolidation classifier over recent conversations. Buckets samples into long-term candidate, emotional-residue candidate, short-term context, forget/ignore, or human-review. Writes `umi/reports/sleep-consolidation-latest.md` and `umi/exports/sleep-consolidation-latest/`. **No Convex writes and no prompt-facing memory.** | After legacy evidence recovery, to study what the world would remember overnight before approving any live memory promotion path. |
| `npm run underworld:sleep-consolidation:self-test` | Synthetic smoke test for the sleep classifier gates: long-term promise, residue, generic greeting, fallback leak, and stage-direction leak. | Before changing sleep-consolidation thresholds. |
| `npm run underworld:sleep-notes-import` | Dry-run curated `sleepNotes` import from reviewed legacy evidence. Writes `umi/reports/sleep-notes-import-latest.md` and `umi/exports/sleep-notes-import-latest/`. | Inspect the tiny reviewed bridge from old continuity into the new prompt-readable layer. |
| `npm run underworld:sleep-notes-import:self-test` | Synthetic smoke test for the curated importer validation. | Before changing the curated note list or gates. |
| `npm run underworld:sleep-notes-import -- --write --approval=alan-approved-sleep-notes-2026-06-12` | Approved live write for curated `sleepNotes`. It caps rows, dedupes source/motif, and keeps legacy rows `freshEvalEligible=false`. | Rare. Only after Alan approval and cc/Codex review. Do not use for bulk archive recovery. |
| `npm run underworld:experience-sleep-promote` | Dry-run bridge from bounded `experienceLogs` to tiny sleep-note candidates. Reads current pilot logs, prepares at most 1 candidate per pilot character, writes `umi/reports/experience-sleep-promotion-latest.md`, and inserts 0 rows unless explicit write approval is added. | After fresh evidence exists, to inspect whether residue could safely survive sleep. |
| `npm run underworld:experience-sleep-promote:self-test` | Synthetic smoke test for the experience-log -> sleep-note promotion guard. | Before changing sleep-promotion thresholds. |
| `bash umi/run_v01_approach_loop.sh` | Local long-running wrapper around `underworld:approach:v01` with persistent log at `umi/reports/v01-approach-loop.log`. Stop with Ctrl-C. | Overnight or unattended loops. |
| `bash umi/soul_triad_hourly_eval_until_sleep.sh` | Hourly `eval:soul-triad` runs until configured sleep time. | Daytime evidence accumulation. |

### Natural PM evidence path

Use this when the latest rolling report is `sample_pending` because adjacent
two-hour windows still lack enough source/callback conversations. This path is
for reading naturally accumulated conversations; it should not force extra
controlled pilot samples.

```bash
npm run underworld:runtime-preflight
npm run underworld:afternoon-world-ready
# wait a bounded interval for natural afternoon conversations or an Alan playtest
npm run underworld:observe -- --cc=skip --collect=skip --target-samples=0
npm run underworld:rolling-continuity
npm run underworld:am-pm-continuity
npm run underworld:life-signals
npm run underworld:repair-gate
npm run underworld:rubric-reconcile
npm run underworld:v01-completion-audit
```

Do not run this path during night quiet or winding-down quiet, and do not treat a
below-threshold `sample_pending` result as permission to rewrite character
prompts.

## 5. Helpers

| Command | What it does | When to use |
|---|---|---|
| `node scripts/test-qwen-key.mjs` | Smoke-test the official Qwen / Model Studio API key. | After rotating `UMI_MAHIRU_PILOT_API_KEY`. |
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

Three pre-triad manual eval-loop wrappers (`fast_pilot_watch.sh`,
`umi_mahiru_eval_15min_loop.sh`, `umi_mahiru_fast_loop.sh`) were deleted on
2026-06-10. They belonged to the manual soul-tuning phase; the world now runs
autonomously and soul evidence comes from `eval:soul-triad` /
`pilot:soul-triad:single-sample` and the rolling-continuity gate. Recover from
git history if ever needed.

`umi_mahiru_soul_depth_30min_loop.sh` is the same generation but is kept for now
because its `eval:umi-mahiru:soul-loop` npm alias is entangled with an
uncommitted batch of `paper:*` package.json changes; delete the wrapper and the
alias together once that batch lands.

---

## Rules of thumb

1. **Observation first.** Always run `underworld:observe` before any
   diagnosis or code edit.
2. **Eval respects the fresh-sample rule.** If `eval:soul-triad` reports
   fewer than 3 triad samples, do not change conversation or memory
   behavior unless you are fixing a runtime/hygiene bug. The eval will
   print a warning when this rule is in effect.
3. **Rolling continuity is the primary v0.1 memory gate.** Adjacent two-hour
   windows should show concrete residue -> callback or behavior change. AM→PM
   still helps as day-arc evidence, but it is no longer the only hard blocker
   when rolling continuity passes.
4. **Pilot envs stay scoped.** Never set `SOUL_TRIAD_*` or
   `UMI_MAHIRU_*` envs globally — let the pilot scripts manage them.
5. **One canonical script per job.** If you find yourself adding a new
   `run_*` shell wrapper, ask whether the underlying `.mjs` can take
   the env knob instead. Shell wrappers tend to silently drift.

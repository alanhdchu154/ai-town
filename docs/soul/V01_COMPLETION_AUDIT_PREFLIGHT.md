# GIIS Underworld v0.1 Completion Audit Preflight

Generated: 2026-06-04 09:24 CDT
Status: NOT COMPLETE
Reason: The latest post-role-change evidence has cleared the active
role-action hard failure, but AM->PM continuity, Alan-facing playtest evidence,
and final repair/rubric clearance remain pending.

## Current Contract

The active v0.1 contract is the smallest emotional-continuity loop:

```text
conversation -> emotional residue -> memory continuity -> small behavioral consequence -> tomorrow feels different
```

Current pilot scope remains Umi / Mahiru / Tianze. Tianze still uses the
`Tianze` runtime key in scripts and Convex env.

## Requirement-by-Requirement Preflight

| Requirement | Current evidence | Status | Next proof needed |
|---|---|---|---|
| Character soul expression | Latest completion audit has 3 fresh triad samples from the 09:04 CDT daytime rerun; soul-triad is 3 PASS / 0 WARN / 0 FAIL, life-signals are PASS / `life_signal_observed`, and recent eval gaps are classified as human-review quality gaps rather than v0.1 blockers. | PROVEN | Preserve role-action separation and do not prompt-tune from recent eval score alone before Alan review. |
| Conversation to emotional residue | AM-PM report finds 18 AM residue candidates and memory traces from the morning samples. | PROVEN | Preserve residue quality while collecting enough PM samples; do not convert residue into generic motif reuse. |
| Memory continuity | Latest AM-PM report is `WARN / sample_pending`, with 0 afternoon samples and 0 PM callbacks because the afternoon window has not happened yet. | PENDING | Reach at least 12 archived afternoon samples and require `PASS / continuity_observed` with PM callbacks before treating this as proven. |
| Event thread continuity | Latest life signals are PASS / `life_signal_observed`, with ordinary-scene and daily-rhythm evidence. | PROVEN | Re-check after the afternoon gate; do not infer PM continuity from AM-only evidence. |
| Human Alan conversation quality | Roadmap requires a longer Alan playtest where yesterday is felt inside today's conversation. WORKLOG still tracks the Alan/Umi playtest as pending. The checklist is ready, completion audit reads `umi/reports/alan-facing-v01-playtest-latest.md`, and it only accepts `Verdict: PASS` when all five required checklist rows are present and PASS. | PENDING | Run the Alan-facing checklist, save a PASS/PARTIAL/FAIL result artifact, validate it with `npm run underworld:alan-playtest-check`, or get an explicit Alan/product-owner defer before declaring the whole v0.1 complete. |
| Fallback and provider hygiene | Latest completion audit proves active fallback pollution 0 and fresh fallback markers 0. | PROVEN | Re-check in the next daytime/afternoon gate before final completion. |
| Motif/hygiene loop safety | Latest repair gate is `eval_rubric_disagreement` / proposal-only / observe-only. Rubric reconciliation is BLOCKED only by AM-PM `sample_pending`; voice/reply-binding gaps remain human-review quality gaps, not prompt auto-fix permission. | PENDING | Rerun repair/rubric after AM-PM is no longer sample-pending; do not tune broad prompts from the current sample set. |
| Night quiet policy | Latest night read-only audits did not force new sample collection. | PROVEN | Preserve this rule; do not collect during night quiet or winding-down quiet. |

## Current Evidence Snapshot

- Chicago time at refresh: 2026-06-04 09:24 CDT.
- Latest `WORKLOG.md` state: `active_pending_afternoon_alan`.
- Latest completion audit: `PENDING`, with 0 fail / 3 pending / 5 pass.
- Latest AM-PM report: `WARN / sample_pending`, afternoon samples 0, AM residue
  candidates 18, and PM callbacks 0.
- Latest life-signals evidence is PASS / `life_signal_observed`, with pilot
  expected action match rate 0.69 and day-window role-action collapse no longer
  listed as a rubric blocker.
- Latest repair/rubric state is observe-only / BLOCKED only by AM-PM
  `sample_pending`; prompt tuning is not recommended from the current sample
  set.
- Latest Alan-facing playtest gate file is ready, completion audit can read
  `umi/reports/alan-facing-v01-playtest-latest.md`, and the helper commands
  `npm run underworld:alan-playtest-template` / `npm run
  underworld:alan-playtest-check` are available, but the result artifact is
  still missing.
- `npm run underworld:v01-afternoon-gate` is the preferred one-command wrapper
  for the afternoon run. It continues through reporting steps after non-zero
  audit results and writes `umi/reports/v01-afternoon-gate-latest.md`. It
  refuses to collect outside 13:00-16:59 America/Chicago unless an operator uses
  the explicit `--allow-outside-afternoon` recovery flag. Inside the afternoon
  window, the wrapper first runs `npm run underworld:runtime-preflight`; if
  Convex is not responsive, it stops before sample collection. It then runs
  `npm run underworld:afternoon-world-ready`, which resumes an `inactive`
  default world but leaves `stoppedByDeveloper` untouched.

## Afternoon Gate Plan

Run only after the afternoon window has started:

```bash
npm run underworld:v01-afternoon-gate
```

The wrapper has its own Chicago afternoon guard. A pre-afternoon run should
write a `SKIPPED` summary and exit without collecting samples.

If the wrapper completes but AM-PM continuity is still `sample_pending`, do not
turn that into a prompt repair. The missing proof is still product evidence:
inside 13:00-16:59 America/Chicago, let the world or Alan-facing playtest
produce ordinary afternoon conversations, then read the archive without forcing
extra pilot collection:

```bash
npm run underworld:runtime-preflight
npm run underworld:afternoon-world-ready
# wait a bounded interval for natural afternoon conversations or an Alan playtest
npm run underworld:observe -- --cc=skip --collect=skip --target-samples=0
npm run underworld:am-pm-continuity
npm run underworld:life-signals
npm run underworld:repair-gate
npm run underworld:rubric-reconcile
npm run underworld:v01-completion-audit
```

Never use this natural-evidence path during night quiet or winding-down quiet.

If the wrapper fails before writing a summary, run the steps directly:

```bash
npm run underworld:v01-daytime-check
npm run underworld:am-pm-continuity
npm run underworld:life-signals
npm run underworld:repair-gate
npm run underworld:rubric-reconcile
npm run underworld:v01-completion-audit
```

If needed, run the observe-only subchecks directly:

```bash
npm run underworld:am-pm-continuity
npm run underworld:life-signals
npm run eval:conversation:recent -- --since-last-change
```

## Runtime Recovery Notes

The afternoon gate depends on the local Convex backend being responsive. If the
wrapper exits before collection or reports `runtime_health`, do not treat that
as character-quality evidence.

The runtime preflight gives each Convex check a 180s timeout because the local
backend may replay a large state directory before responding. A live 2026-06-03
11:14-11:19 CDT preflight passed, but each read-only check took roughly 90s.

Use this recovery path:

```bash
bash umi/run_underworld_dev_stack.sh
npm run underworld:runtime-preflight
npx convex run school:worldClock
npx convex run world:defaultWorldStatus
npx convex run school:debugState
```

If Convex is responsive after recovery and the time is still inside
13:00-16:59 America/Chicago, rerun:

```bash
npm run underworld:v01-afternoon-gate
```

Do not use `--allow-outside-afternoon` unless Alan or the operator explicitly
chooses a manual recovery run and accepts that it is not clean AM->PM evidence.

## Completion Stop Conditions

Do not mark v0.1 complete if any of these are true:

- Afternoon samples are fewer than 12.
- AM-PM continuity is `sample_pending`, `weak_continuity`, or FAIL.
- Fresh samples contain fallback markers or runtime/provider health is not ok.
- Repair gate recommends observe-only/blocking due to unresolved fresh evidence.
- Recent eval shows fresh prop/motif loops or response-binding failures severe
  enough to collapse Umi/Mahiru/Tianze into the same care style.
- Alan-facing playtest quality is still unproven and not explicitly deferred by
  Alan/product-owner judgment.
- The Alan-facing artifact says `Verdict: PASS` but is missing any of the five
  required checklist rows or contains a failed subcheck.

## Final Audit Rule

After the afternoon gate, perform a fresh requirement-by-requirement completion
audit with `npm run underworld:v01-completion-audit`, then cross-check the
result against this file, `docs/giis-v0.1-roadmap.md`,
`docs/soul/AM_PM_CONTINUITY_GOAL.md`, latest `umi/reports/v01-*`, latest
`am-pm-continuity`, latest `life-signals`, latest `recent-conversation`, and
`WORKLOG.md`.

Only update the active goal to complete if every requirement above is proven or
explicitly deferred by Alan/product-owner judgment.

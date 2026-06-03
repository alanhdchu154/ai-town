# GIIS Underworld v0.1 Completion Audit Preflight

Generated: 2026-06-03 10:43 CDT
Status: NOT COMPLETE
Reason: The real afternoon continuity window has not produced evidence yet.

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
| Character soul expression | 2026-06-03 morning gate collected 3 fresh triad samples: Umi/Mahiru, Mahiru/Tianze, Umi/Tianze. Life signals show role-action coverage, but recent eval still flags repetition and response-binding risk. | PARTIAL | Afternoon/fresh rerun should preserve distinct roles: Umi reduces overload, Mahiru stays near quiet pain, Tianze pressure-tests without cruelty or checklist drift. |
| Conversation to emotional residue | Morning AM-PM report found 18 AM residue candidates and memory traces from the fresh morning samples. | PARTIAL | PM samples must show at least one residue returning as a memory callback or behavior shift, not only repeated props or slogans. |
| Memory continuity | Morning conversations have memory traces, but the AM-PM continuity report has 0 afternoon samples and 0 PM callbacks. | NOT PROVEN | Run the afternoon gate after 13:00 America/Chicago and require at least 3 archived PM samples plus a continuity decision stronger than `sample_pending`. |
| Event thread continuity | Day-window life signals PASS with ordinary campus-life cues and multiple morning scenes. | PARTIAL | Afternoon samples should talk around the same day/event pressure from different angles without merely repeating morning wording. |
| Human Alan conversation quality | Roadmap requires a longer Alan playtest where yesterday is felt inside today's conversation. WORKLOG still tracks a pending Alan/Umi playtest for greeting behavior and the correction `不是依賴，是喜歡`. | NOT PROVEN | Need fresh Alan-facing playtest evidence or an explicit Alan/product-owner defer before declaring the whole v0.1 complete. |
| Fallback and provider hygiene | Morning gate: provider/runtime/model-policy ok, active fallback pollution 0, archived fallback history 0, fresh fallback markers 0. | PROVEN FOR MORNING | Re-check in the afternoon gate before final completion. |
| Motif/hygiene loop safety | Latest generated v0.1 audit still shows `stage_direction_leak`, but that report predates the soul-table parser fix. Repair gate and cc second opinion say observe-only; real evidence is repetition/non-binding risk from n=3, not a proven prompt-rewrite target. | WATCH | Regenerate reports after the parser fix. Stop if fresh PM/recent samples show repeated prop loops, rubric agreement on a real failure, or repair gate remains blocked. |
| Night quiet policy | Morning observe did not force quiet-hour samples. | PROVEN | Preserve this rule; do not collect during night quiet or winding-down quiet. |

## Current Evidence Snapshot

- Chicago time at refresh: 2026-06-03 10:43 CDT.
- Latest `WORKLOG.md` state: `pending_afternoon_gate`.
- Latest morning gate: `npm run underworld:v01-daytime-check` collected 3 fresh samples and completed, but goal audit stayed FAIL/PENDING.
- Latest AM-PM report: `WARN / sample_pending`, morning samples 10, afternoon samples 0, PM callbacks 0.
- Latest life-signals report: `PASS / life_signal_observed`.
- Latest repair gate: observe-only; no code change recommended before enough PM evidence.
- Latest rubric reconciliation is stale from 2026-06-02 evening and should be rerun after the afternoon gate.
- `npm run underworld:v01-afternoon-gate` is the preferred one-command wrapper
  for the afternoon run. It continues through reporting steps after non-zero
  audit results and writes `umi/reports/v01-afternoon-gate-latest.md`. It
  refuses to collect outside 13:00-16:59 America/Chicago unless an operator uses
  the explicit `--allow-outside-afternoon` recovery flag. Inside the afternoon
  window, the wrapper first runs `npm run underworld:runtime-preflight`; if
  Convex is not responsive, it stops before sample collection.

## Afternoon Gate Plan

Run only after the afternoon window has started:

```bash
npm run underworld:v01-afternoon-gate
```

The wrapper has its own Chicago afternoon guard. A pre-afternoon run should
write a `SKIPPED` summary and exit without collecting samples.

If the wrapper fails before writing a summary, run the steps directly:

```bash
npm run underworld:v01-daytime-check
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

- Afternoon samples are fewer than 3.
- AM-PM continuity is `sample_pending`, `weak_continuity`, or FAIL.
- Fresh samples contain fallback markers or runtime/provider health is not ok.
- Repair gate recommends observe-only/blocking due to unresolved fresh evidence.
- Recent eval shows fresh prop/motif loops or response-binding failures severe
  enough to collapse Umi/Mahiru/Tianze into the same care style.
- Alan-facing playtest quality is still unproven and not explicitly deferred by
  Alan/product-owner judgment.

## Final Audit Rule

After the afternoon gate, perform a fresh requirement-by-requirement completion
audit with `npm run underworld:v01-completion-audit`, then cross-check the
result against this file, `docs/giis-v0.1-roadmap.md`,
`docs/soul/AM_PM_CONTINUITY_GOAL.md`, latest `umi/reports/v01-*`, latest
`am-pm-continuity`, latest `life-signals`, latest `recent-conversation`, and
`WORKLOG.md`.

Only update the active goal to complete if every requirement above is proven or
explicitly deferred by Alan/product-owner judgment.

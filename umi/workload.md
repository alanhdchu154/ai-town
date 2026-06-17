# CC Workload - Underworld v0.1 Data Collection Gate

Time anchor: 2026-06-17 09:18 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, code-mode findings-first with bounded implementation allowed
Status: active

## Task ID

underworld-v01-data-collection-gate-20260617-0918

## Current Goal

Alan's current priority is not to declare v0.1 complete and not to build a new
dashboard. The goal is to make Underworld able to collect and interpret the data
needed for v0.1 reliably.

Specifically: identify the smallest missing evidence and pipeline fixes needed
so we can collect fresh v0.1 data for character soul, concrete memory callback,
and event-thread continuity, then rerun the v0.1 completion audit from current
reports.

## Current Evidence From Umi

- Runtime is currently healthy. Latest `npm run underworld:runtime-preflight`
  report passed on 2026-06-17 around 09:09 CDT.
- Latest completion audit is still failing: `umi/reports/v01-completion-audit-latest.md`
  generated 2026-06-17T03:18:07.256Z, overall FAIL, v0.1 goal audit PENDING.
- Failing requirements:
  - `character_soul_expression`: latest life-signals evidence does not pass
    character-soul and role-action checks; recent eval shows 0 PASS / 4 WARN /
    8 FAIL.
  - `memory_continuity_yesterday_matters`: rolling callbacks are weak or
    generic; needs concrete residue -> callback evidence.
  - `event_thread_continuity`: needs latest life-signals PASS with ordinary
    scenes and daily rhythm evidence.
- Passing requirements: conversation-to-emotional-residue, Alan-facing
  conversation quality, provider/fallback hygiene, motif hygiene/repair gate,
  and night quiet policy.
- Previous CC/Codex pass fixed the forced-sample harness:
  - `scripts/run-soul-triad-single-sample.mjs` now handles non-original-triad
    focus pairs and English aliases.
  - `scripts/underworld-observe-once.mjs` has the missing `truncate` helper.
  - Targeted sample `Tianze:Ichinose` accepted `conversation-c:37914`.
  - `npm run eval:conversation:recent -- --since-last-change` still showed
    0 PASS / 4 WARN / 8 FAIL, so data collection can run, but quality evidence
    is not yet good enough.
- Current dirty file to preserve: `scripts/underworld-runtime-preflight.mjs`
  has Codex's small localhost healthcheck fix. Do not overwrite or revert it.

## Questions For CC

Findings first, then patch only if the smallest useful fix is clear:

1. Given the latest v0.1 audit failures, what exact fresh data do we need next?
   Name the commands/reports that should produce that data.
2. Is the current v0.1 data collection path reliable enough after the harness
   fixes? If not, what is the smallest fix in sampling, eval, or report scripts?
3. Which failures are "need more fresh data" versus actual product behavior
   problems that require a narrow prompt/runtime change?
4. What is the smallest safe action today to make progress toward collectable
   v0.1 evidence?
5. What commands should Codex/Umi run afterward to verify the path?

## Candidate Files To Inspect

- `umi/COMMAND_REFERENCE.md`
- `umi/reports/v01-completion-audit-latest.md`
- `umi/reports/life-signals-latest.md`
- `umi/reports/rolling-continuity-latest.md`
- `umi/reports/am-pm-continuity-latest.md`
- `evals/conversations/reports/latest.md`
- `evals/conversations/reports/soul-triad-latest.md`
- `scripts/underworld-v01-completion-audit.mjs`
- `scripts/underworld-observe-once.mjs`
- `scripts/run-soul-triad-single-sample.mjs`
- `scripts/underworld-life-signals.mjs`
- `scripts/underworld-rolling-continuity.mjs`
- `scripts/underworld-am-pm-continuity.mjs`
- `evals/conversations/runRecentConversationEval.ts`
- `evals/conversations/metrics/conversation_metrics.ts`
- `convex/agent/conversation.ts`
- `convex/agent/experienceLog.ts`
- `convex/aiTown/agent.ts`

## Allowed Changes

You may make bounded repo-local edits if they directly improve v0.1 data
collection, report clarity, or verification reliability.

Allowed examples:

- Fix a sampling/report script that misclassifies or fails to surface v0.1
  evidence.
- Add a small self-test for the collection/report path.
- Improve a report so it says exactly which evidence is missing and which
  command should collect it.
- Make a minimal runtime/eval guard if evidence proves the collection path is
  blocked by a small code defect.

Do not:

- Broad prompt-tune.
- Rewrite souls, memory architecture, provider config, Convex schema, map, or
  character system.
- Delete/migrate/reset Convex state.
- Run watch/dev servers.
- Run unbounded generation loops.
- Treat old chats or old reports as current without checking timestamps.

## Suggested Commands

Start read-only:

```bash
git status --short
sed -n '1,220p' umi/COMMAND_REFERENCE.md
sed -n '1,220p' umi/reports/v01-completion-audit-latest.md
sed -n '1,220p' umi/reports/life-signals-latest.md
sed -n '1,220p' umi/reports/rolling-continuity-latest.md
npm run underworld:runtime-preflight
npm run underworld:v01-completion-audit
npm run eval:conversation:recent -- --since-last-change
```

If you edit scripts, run the narrow checks relevant to the files touched, for
example:

```bash
node --check scripts/underworld-v01-completion-audit.mjs
node --check scripts/underworld-observe-once.mjs
npm run underworld:v01-completion-audit:self-test
npm run underworld:harness:self-test
```

Do not run `npm run underworld:observe:daytime-samples`,
`npm run underworld:v01-daytime-check`, or other live sample generation unless
your findings explicitly justify it and you state why the bounded run is needed.

## Expected Output

Return:

1. Top findings by severity with file/report references.
2. Whether the immediate blocker is data collection, data quality, or product
   behavior.
3. Any bounded patch made, with files changed and why.
4. Commands run and results.
5. The exact next command Umi/Codex should run to collect or validate v0.1 data.
6. Boundaries: what should not be changed yet.

## Acceptance Criteria

- We know the next smallest data-collection action for v0.1.
- If the collection pipeline is broken, the smallest safe fix is made or clearly
  identified.
- The v0.1 audit remains the acceptance gate; no one declares completion from a
  single green report.
- Alan gets a clear Central Umi summary without being sent to inspect raw logs.

## Worker Result - 2026-06-17 09:27 CDT

Status: active, waiting for fresh 2026-06-17 evening evidence.

CC code-mode pass completed with no file edits. Umi accepts the main finding:
the current blocker is not a broken collection pipeline. The pipeline can
produce archived conversations and soul-triad PASS samples, but the latest
6/16 evening evidence shows a real product-quality issue:

- `life-signals-latest.md` is WARN / `life_signal_repeated`; repeated surface
  lines are gating both character-soul and event-thread continuity.
- `rolling-continuity-latest.md` is WARN / `weak_continuity`; callbacks exist
  but rely on generic cue overlap rather than concrete residue -> callback.
- `evals/conversations/reports/latest.md` still shows the same mirror/motif
  repetition pattern across recent WARN/FAIL rows.
- `soul-triad-latest.md` can PASS targeted pairs while the broader recent-eval
  still FAILs; do not treat a soul-triad pass as whole-product v0.1 proof.

Accepted next action:

Do not run more forced daytime samples this morning. Wait for natural 2026-06-17
evening evidence, then after about 21:00 CDT run the read-only gate chain:

```bash
npm run underworld:life-signals
npm run underworld:rolling-continuity
npm run underworld:am-pm-continuity
npm run eval:conversation:recent -- --since-last-change
npm run underworld:v01-completion-audit
```

If the 6/17 evening evidence repeats the same surface-line / mirror-motif
pattern, open a new bounded implementation task for narrow echo prevention,
likely around `convex/agent/conversation.ts`, instead of broad prompt tuning.

Do not change yet:

- No broad soul/prompt rewrite.
- No memory/provider/schema/map reset.
- No unbounded generation loop.
- Do not revert the localhost preflight fix in
  `scripts/underworld-runtime-preflight.mjs`.

# Longitudinal Residue Experiment Plan

Status on 2026-06-06: **paused before more cloud-provider collection**. The
archived-only ablation pipeline is feasible, but current pilot sample size
(`n=2` per arm, one dyad) is far too small for an effect claim, and cc's expert
review found that the planned long run needs stronger outcomes before more
samples are worth collecting.

Schedule decision: see `docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md`. The primary design is
arm-pure full-day / long-window collection; forced dyad blocks are mechanism
debugging only.

## Pause Reasons

- `human_aftertaste_score` is saturated in the current population and should not
  be treated as a primary continuous outcome.
- `rolling_callback` is the better primary outcome. The arm-level pipeline now
  attaches callback labels from arm-scoped rolling-continuity reports, but short
  forced blocks are still usually `sample_pending` because a two-hour callback
  outcome needs enough source/callback windows inside the same arm.
- Forced dyad collection is useful for mechanism testing, but it removes the
  initiative channel that the paper claims residue can affect.
- Same-day ON/OFF blocks can mix rolling-continuity windows and create carryover
  from written residue.
- The previous `n>=40/arm` target was not tied to a minimum detectable effect
  (MDE); it should be treated as a pilot target unless power/sensitivity is
  specified.
- Offline power sensitivity now lives under `docs/paper/emotional-residue/results/power/` and
  supports this caution: `n=40/arm` is underpowered for small 10--15 percentage
  point callback-rate effects at plausible baselines, while `n>=150/arm` is
  still baseline-dependent and may be insufficient when rows cluster by dyad,
  day, or window.

## Why This Needs Longer Collection

The first forced-sample pilots exposed two issues:

- Fresh sample signals can be `active-conversation-*` rows that are not
  qualifying archived records.
- Single short runs have low archived-record yield. A 3-per-arm pilot produced
  too few qualifying records; two archived-only 1-per-arm sanity blocks
  succeeded.

Therefore the rigorous experiment should be longitudinal and block-based instead
of a single large manual run, but only after the primary outcome and stopping
rule are fixed.

## Design

- Primary manipulation: `UNDERWORLD_RESIDUE_READ`
  - `residue_on`: env unset / read enabled
  - `residue_off`: env set to `false`
- Write path remains enabled in both arms.
- Mechanism-control boundary:
  - the current two-arm design tests suppression of the residue-read prompt
    block;
  - it does not isolate residue content from prompt length or prompt shape;
  - a clean mechanism claim requires either a length-matched
    `residue_placebo` arm or a narrowed claim that explicitly says the whole
    residue-read block was suppressed.
- Use counterbalanced block order:
  - Day/block pattern examples: `on,off`, `off,on`, `on,off`, `off,on`
  - Avoid always running ON first.
- Each block must collect only qualifying archived rows:
  - `case_name` must not start with `active-conversation-`
  - `message_count >= 3`
  - arm-scoped eval must use `--since-created-at=<arm_start_ms>`
  - each parsed row should carry run-level `generation_metadata` and
    `run_provenance`; older pilot rows without these fields remain useful as
    pipeline evidence only and should not be guessed/backfilled
  - each completed arm-window directory should pass
    `npm run paper:run-provenance-audit -- --run-dir <arm-window-dir>` before
    its rows are merged into the longitudinal dataset
- Target:
  - minimum pipeline pilot threshold: 10 qualifying archived records per arm
  - first ablation threshold: choose from a pre-registered MDE; `n=40/arm` is
    only defensible for a large effect, not for small 10-15 percentage-point
    effects
  - balanced dyads where practical

## Required Fixes Before More Collection

1. Use an arm-pure schedule for the primary rolling-callback outcome:
   - rolling-continuity now accepts arm start/end windows and the ablation runner
     attaches labels, but short forced blocks are insufficient;
   - for the primary outcome, run one arm per long window/day, or extend
     rolling-continuity to evaluate fixed source/callback windows fully inside an
     arm.
2. Rename/reframe `human_aftertaste_score` as a rule-based aftertaste proxy, not
   a human or primary outcome.
3. Add human annotation:
   - at least two raters;
   - blind to arm;
   - at least 30 balanced conversations for the pilot;
   - include a felt-continuity Likert dimension.
4. Decide the design:
   - forced dyads for mechanism evidence;
   - natural archived windows for ecological evidence;
   - do not conflate the two.
5. Pre-register the block schedule, MDE, target N, and stopping rule before
   resuming collection.
6. Preserve provider/model metadata:
   - `run_residue_ablation.mjs` and `run_arm_pure_residue_window.mjs` now write
     `generation-metadata.json`;
   - `report_to_dataset.py --metadata-json` attaches that snapshot to future
     rows;
   - provider-controlled comparisons remain out of scope until per-row metadata
     are present.
7. Decide the mechanism-control path:
   - implement a length-matched `residue_placebo` arm before making a clean
     residue-content mechanism claim; or
   - keep the narrowed mechanism claim and state that `residue_off` suppresses
     the whole residue-read block.

## Commands

Run one accepted arm-pure long window for the primary design:

```bash
npm run paper:residue-arm-window:acceptance

npm run paper:residue-arm-window -- \
  --arm=on \
  --duration-min=240 \
  --collect=none \
  --python=/tmp/ai-town-paper-venv/bin/python
```

Run the next accepted window with `--arm=off`. The schedule order must be
written before collection starts; do not choose the next arm after inspecting
the previous window's effect estimate.

Run one small counterbalanced forced block for mechanism debugging only:

```bash
npm run paper:residue-ablation -- \
  --samples-per-arm=1 \
  --order=on,off \
  --sample-timeout-ms=300000 \
  --allow-legacy-forced-pilot \
  --python=/tmp/ai-town-paper-venv/bin/python
```

Do not run this as the main causal experiment. When useful, let Codex collect
repeated blocks only for mechanism-pilot data:

```bash
npm run paper:residue-ablation:blocks -- \
  --target-per-arm=10 \
  --max-blocks=20 \
  --samples-per-arm=1 \
  --sample-timeout-ms=300000 \
  --allow-legacy-forced-pilot \
  --python=/tmp/ai-town-paper-venv/bin/python
```

Run the next block reversed:

```bash
npm run paper:residue-ablation -- \
  --samples-per-arm=1 \
  --order=off,on \
  --sample-timeout-ms=300000 \
  --allow-legacy-forced-pilot \
  --python=/tmp/ai-town-paper-venv/bin/python
```

Merge all qualifying archived records:

```bash
npm run paper:merge-ablation-runs -- \
  --runs 'docs/paper/emotional-residue/results/arm-window-*' \
  --out docs/paper/emotional-residue/results/longitudinal/dataset.json \
  --manifest docs/paper/emotional-residue/results/longitudinal/merge-manifest.json
```

For legacy forced-pilot evidence only, `--runs 'docs/paper/emotional-residue/results/ablation-*'`
can reproduce the current n=4 pipeline dataset. Do not treat those rows as
completed long-window evidence unless the merge manifest and
`paper:empirical-audit` show the required provenance, cluster metadata, dyad
coverage, and callback denominator.

Analyze the merged dataset:

```bash
/tmp/ai-town-paper-venv/bin/python scripts/paper/analyze.py \
  --dataset docs/paper/emotional-residue/results/longitudinal/dataset.json \
  --outdir docs/paper/emotional-residue/results/longitudinal
```

Refresh sample-size sensitivity:

```bash
python3 scripts/paper/power_sensitivity.py \
  --outdir docs/paper/emotional-residue/results/power
```

Export a blinded annotation sheet from the current merged dataset:

```bash
python3 scripts/paper/export_annotation_sheet.py \
  --dataset docs/paper/emotional-residue/results/longitudinal/dataset.json \
  --out-sheet docs/paper/emotional-residue/results/longitudinal/annotation_sheet.csv \
  --out-key docs/paper/emotional-residue/results/longitudinal/annotation_key.csv \
  --target 30
```

Export the matching rater-visible transcript packet:

```bash
python3 scripts/paper/export_blinded_transcripts.py \
  --key docs/paper/emotional-residue/results/longitudinal/annotation_key.csv \
  --outdir docs/paper/emotional-residue/results/longitudinal/blinded_transcripts
```

## Interpretation Rule

- `n < 10` per arm: pipeline/debug only.
- `10 <= n < 40` per arm: pilot evidence only; report direction and uncertainty.
- `n >= 40` per arm: acceptable for the paper's first controlled ablation, still
  with non-parametric tests and cautious language.

Do not claim player experience or causal felt-continuity until human annotation
and/or a player study are complete.
Do not claim the read path isolates residue content from prompt shape unless a
length-matched placebo arm has been implemented and analyzed.

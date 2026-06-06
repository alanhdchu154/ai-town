# Paper data-analysis pipeline

`analyze.py` ingests evaluation outputs from the soul / residue experiments and
produces the tables, statistics, and figures the paper needs. All inferential
statistics (bootstrap CIs, permutation tests, Cliff's delta, Cohen's
quadratic-weighted kappa, Krippendorff's ordinal alpha) are implemented from
scratch in numpy so they are transparent and reproducible. `pandas` / `scipy`
are used only for data loading and the Spearman correlation.

Everything is deterministic: a single seed (`1234`) drives every resampling
step. No network access is performed and no files outside the paths you pass in
(plus the `--outdir`) are read or written.

## Install

```
pip install -r scripts/paper/requirements.txt
```

`matplotlib` is optional at runtime: if it cannot be imported, the pipeline
still emits all CSV/markdown outputs and notes in the summary that figures were
skipped.

## Input data contract

### 1. `dataset.json`

A JSON **list** of records, one per evaluated conversation:

```json
{
  "case_name": "case_001",
  "pair": "Mahiru-Umi",
  "speaker": "Mahiru",
  "target": "Umi",
  "condition": "residue_on",
  "window": "10:00-12:00",
  "overall_score": 0.71,
  "status": "PASS",
  "metrics": {
    "emotional_expression_uniqueness": 0.63,
    "comfort_style_uniqueness": 0.58,
    "burden_response_uniqueness": 0.60,
    "human_aftertaste_score": 0.72,
    "echo_similarity_penalty": 0.10,
    "stage_direction_leak_penalty": 0.08
  },
  "rolling_callback": 1,
  "residue_candidate": 0
}
```

Field semantics:

| field | type | meaning |
|---|---|---|
| `case_name` | str | unique id for the conversation |
| `pair` | str | the two character names, alphabetically sorted and joined by `-` (e.g. `Mahiru-Umi`) |
| `speaker` | str | speaking character |
| `target` | str | addressed character |
| `condition` | `"residue_on"` \| `"residue_off"` \| `"na"` | ablation arm |
| `window` | str \| null | time window for the continuity experiment (e.g. `10:00-12:00`), else null |
| `overall_score` | float | overall quality 0..1 |
| `status` | `"PASS"` \| `"WARN"` \| `"FAIL"` | gate verdict |
| `metrics` | object | marker name -> float (each 0..1); markers listed above, extra markers are handled generically |
| `rolling_callback` | 0 \| 1 \| null | continuity exp: did an earlier residue surface as behavior? |
| `residue_candidate` | 0 \| 1 \| null | continuity exp: candidate residue present? |

Markers whose name ends in `_penalty` are interpreted as "lower is better" by
convention, but the script reports their means/CIs as-is.

### 2. `annotations.csv`

Human annotation cross-check, one row per (case, rater):

```
case_name,rater,naturalness,emotional_binding,character_consistency,repetition
case_001,raterA,4,5,4,2
case_001,raterB,4,4,4,2
```

The four Likert dims (`naturalness`, `emotional_binding`,
`character_consistency`, `repetition`) are integers 1..5. Multiple rows per
`case_name`, one per rater.

## Commands

Run on real data:

```
python scripts/paper/analyze.py \
  --dataset PATH/dataset.json \
  --annotations PATH/annotations.csv \
  --outdir scripts/paper
```

- Outputs are written under `<outdir>/results/`. The default `--outdir` is
  `scripts/paper/results`; if you pass a path ending in `results` it is
  normalized so outputs land in `<parent>/results/` (no `results/results`).
- `--annotations` is optional; without it, analysis C is skipped (an empty
  agreement section is still emitted in the summary).
- `--marker-dim NAME` selects the machine marker for convergent validity
  (default `human_aftertaste_score`).
- `--human-dim NAME` selects the human Likert dim for convergent validity
  (default `emotional_binding`).

Self-test on synthetic data with planted effects:

```
python scripts/paper/analyze.py --selftest
```

This generates a synthetic `dataset.json` + `annotations.csv` (with a planted
residue effect and planted rater agreement) in a temp directory, runs the full
pipeline, and asserts: all expected output files exist; the permutation test
recovers `residue_on > residue_off` and is significant; quadratic-weighted kappa
> 0.4 on the planted-agreement dim; convergent validity is positive. Prints
`SELFTEST: PASS` / `SELFTEST: FAIL` and exits nonzero on failure.

## Outputs (under `<outdir>/results/`)

| file | analysis | content |
|---|---|---|
| `soul_uniqueness.csv` / `.md` | A | per-marker mean + 95% bootstrap CI (10k resamples, seeded), overall and per `pair` |
| `residue_ablation.csv` / `.md` | B | residue_on vs residue_off: rolling-callback rate (primary) and human_aftertaste mean (secondary), with permutation test (10k, seeded), bootstrap diff CI, and effect size (risk difference for the proportion, Cliff's delta for the continuous metric) |
| `annotation_agreement.csv` / `.md` | C | inter-rater agreement (Cohen's quadratic-weighted kappa for 2 raters, Krippendorff's ordinal alpha for >2) on each Likert dim |
| `convergent_validity.csv` | C | Spearman rho + p between the machine marker and mean human rating per case |
| `figures/marker_means.png` | D | bar chart of marker means with CIs (skipped if matplotlib missing) |
| `figures/residue_ablation.png` | D | grouped bar of residue_on vs residue_off (skipped if matplotlib missing) |
| `summary.md` | E | stitched A-C tables with one-line plain-English readouts |

## Statistical methods (all in `analyze.py`)

- **Bootstrap CI** (`bootstrap_mean_ci`, `bootstrap_diff_ci`): percentile
  bootstrap, 10k vectorized resamples, seeded.
- **Permutation test** (`permutation_test_diff_means`): two-sided, 10k
  permutations, pooled-relabel null, add-one smoothing so p is never 0. Reports
  the real p; significance is never faked.
- **Cliff's delta** (`cliffs_delta`): rank-based effect size in [-1, 1].
- **Cohen's quadratic-weighted kappa** (`cohens_quadratic_weighted_kappa`): for
  the 2-rater case.
- **Krippendorff's ordinal alpha** (`krippendorff_ordinal_alpha`): coincidence-
  matrix formulation with the ordinal difference metric, used when >2 raters.
- **Spearman** correlation via `scipy.stats.spearmanr` for convergent validity.

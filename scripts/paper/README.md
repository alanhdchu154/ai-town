# Paper data-analysis pipeline

`analyze.py` ingests evaluation outputs from the soul / residue experiments and
produces the tables, statistics, and figures the paper needs.
`report_to_dataset.py` converts the existing soul-triad markdown report into
the JSON contract and can attach run-level provider/model metadata plus
secret-safe run provenance, and
`attach_rolling_callbacks.py` can attach per-conversation rolling-continuity
labels from the rolling report. `run_residue_ablation.mjs` is a legacy forced
mechanism-pilot runner and now refuses to run unless
`--allow-legacy-forced-pilot` is explicitly provided; it is not the primary
empirical design. `merge_ablation_runs.py` merges qualifying records from
multiple blocks for longitudinal collection.
`run_arm_pure_residue_window.mjs` runs one long ON or OFF window for the
cc-recommended primary design without interleaving arms. `merge_ablation_runs.py`
now writes a merge manifest and requires future arm-window runs to pass the
local run-provenance audit before their rows are merged. `power_sensitivity.py`
generates approximate callback-rate MDE/power tables, including a cluster
design-effect sensitivity table for dyad/day/window dependence, and
`export_annotation_sheet.py` generates a blinded rater sheet plus a separate
condition key plus `annotation_packet_manifest.json`,
`export_blinded_transcripts.py` generates rater-visible
transcript packets keyed by blind ids, and `merge_rater_annotations.py` merges
completed blinded rater sheets back into the `case_name,rater,...` CSV expected
by `analyze.py` and writes an `annotations_manifest.json` with key/rater/output
hashes and the blinding contract. Transcript packets also carry
`transcript_packet_manifest.json` with source-report and output hashes.
`paper_annotation_audit.py` checks that the rater packet, key, transcripts,
packet manifests, and blinding contracts are aligned while separating packet
readiness from study completion. `paper_empirical_audit.py`
checks whether the longitudinal ablation dataset has enough arm balance, dyad
coverage, run/window coverage, callback-denominator labels, and marker variance
to support an empirical ablation claim; for newly collected rows it also blocks
missing generation/provenance schema needed to reconstruct the study version.
`paper_trace_overlap_audit.py` scans
rolling-continuity reports for simple residue-trace-to-callback text overlap so
the "pressure, not quotation" claim has an explicit pilot validation gate.
`paper_evidence_matrix_audit.py` checks that
`docs/paper/CLAIM_EVIDENCE_MATRIX.md` maps each major manuscript claim to
current artifacts and explicit claim boundaries. `paper_claim_audit.py` checks the arXiv
source and evidence package for unsupported causal/player-study claims,
placeholder text, sample-size blockers, annotation readiness, and transcript
label leakage. `paper_citation_audit.py` checks
`docs/paper/CITATION_PROVENANCE.md` so each bibliography key has an explicit
source-status row and recent LLM-agent / AI Town references point to primary or
official sources. `paper_source_audit.py` checks local LaTeX/source hygiene:
structure, labels/refs, citation keys, table columns, placeholders, and source
package notes. `paper_consistency_audit.py` checks that selected hard-coded
manuscript numbers match generated paper artifacts. `paper_protocol_audit.py`
checks that the pre-registered schedule, acceptance file, arm-pure runner, and
npm scripts agree before any long-window collection can run.
`paper_mechanism_audit.py` statically checks that the manuscript's residue
write/read architecture maps to current code paths, env gates, storage prefix,
prompt injection, time labels, and motif guard. `paper_design_audit.py` checks
whether the causal/mechanism design is ready beyond conservative-preprint
framing, including the placebo-or-narrowed-claim boundary, MDE/final-N state,
annotation minimum, preregistration protocol, and schedule acceptance.
`docs/paper/PREREGISTRATION_PROTOCOL.md` is the machine-audited draft for the
future rigorous empirical version; it is not accepted and does not authorize
collection. `paper_run_provenance_audit.py` audits a completed arm-window run
directory for run metadata, accepted-document provenance, row-level provenance,
and artifact/log hashes before it is merged into a paper dataset.
`paper_pdf_preflight.py` checks
whether a local TeX/PDF toolchain can render the source into a non-empty PDF in
a temporary directory, or reports a concrete `PDF_BLOCKER` when no local tool is
available. `paper_pdf_verification_audit.py` checks the rendered-PDF/platform
preview verification record and requires tool/environment/source-archive hash,
PDF hash, and visual-check details before PDF readiness can pass.
`paper_submission_audit.py` checks
`docs/paper/SUBMISSION_DECISIONS.json` so author metadata, category, license,
account readiness, transcript policy, timing, attribution, and preview decisions
are explicit before any external posting.
`docs/paper/ARXIV_PREPRINT_RELEASE_PACKET.md` is the A-path release packet for
the conservative arXiv design/systems preprint. Alan reported submitting the
conservative A-path preprint on OSF on 2026-06-10 because arXiv upload is
blocked by endorsement; the OSF posting ledger is
`docs/paper/OSF_RELEASE_RECORD.md`. The arXiv packet remains useful for a future
arXiv mirror and records the local package paths, recommended-but-unconfirmed
submitter choices, required PDF/platform checks, official arXiv documentation
links, stop conditions, and the B-path empirical follow-up.
`build_arxiv_source_package.py` creates a local allowlisted source archive
containing only the TeX source intended for arXiv. `paper_archive_audit.py`
rebuilds that archive, verifies the manifest and SHA values, requires the
member list to stay allowlisted, and scans for accidental data/results/
annotation/transcript or obvious secret leakage. `paper_readiness_report.py`
combines these checks into the current local paper-readiness verdict. All
inferential statistics (bootstrap CIs, permutation tests, Cliff's delta, Cohen's
quadratic-weighted kappa, Krippendorff's ordinal alpha) are implemented from
scratch in numpy so they are transparent and reproducible. `pandas` / `scipy`
are used only for data loading and the Spearman correlation.

Everything is deterministic: a single seed (`1234`) drives every resampling
step. No network access is performed and no files outside the paths you pass in
(plus the `--outdir`) are read or written.

Exception: `run_arm_pure_residue_window.mjs` is a live collection runner and can
change `UNDERWORLD_RESIDUE_READ` after the schedule and preregistration are
accepted. It refuses to run unless `docs/paper/SCHEDULE_ACCEPTANCE.json` and
`docs/paper/PREREGISTRATION_ACCEPTANCE.json` both record explicit acceptance.

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
  "source_run": "arm-window-2026-06-10-on",
  "collection_day": "2026-06-10",
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
  "residue_candidate": 0,
  "generation_metadata": {
    "schema_version": 1,
    "captured_at": "2026-06-10T00:00:00.000Z",
    "llm_provider": "ollama",
    "localOllamaDefaultModel": "qwen3:8b"
  },
  "run_provenance": {
    "schema_version": 1,
    "kind": "arm_pure_residue_window_run_provenance",
    "captured_at": "2026-06-10T00:00:05.000Z",
    "run_id": "arm-window-2026-06-10-on",
    "experiment": {
      "arm": "on",
      "condition": "residue_on"
    },
    "git": {
      "commit": "abc123",
      "dirty": true,
      "status_entry_count": 4
    },
    "command": {
      "script": "scripts/paper/run_arm_pure_residue_window.mjs",
      "argv": ["--arm=on", "--duration-min=240"]
    },
    "documents": {
      "schedule": {
        "accepted": true,
        "acceptance_matches_document": true
      },
      "preregistration": {
        "accepted": true,
        "acceptance_matches_document": true
      }
    },
    "source_archive": {
      "archive_sha256": "def456",
      "manifest_matches_current_sources": true
    },
    "runtime": {
      "node": "v22.0.0"
    },
    "env_policy": {
      "secret_values_recorded": false
    }
  }
}
```

Field semantics:

| field | type | meaning |
|---|---|---|
| `case_name` | str | unique id for the conversation |
| `pair` | str | the two character names, alphabetically sorted and joined by `-` (e.g. `Mahiru-Umi`) |
| `speaker` | str | speaking character |
| `target` | str | addressed character |
| `condition` | `"residue_on"` \| `"residue_off"` \| `"residue_placebo"` \| `"na"` | ablation arm |
| `window` | str \| null | time window for the continuity experiment (e.g. `10:00-12:00`), else null |
| `source_run` | str \| null | arm-window or run id used with `pair` and `window` for cluster-unit analysis |
| `collection_day` | str \| null | calendar collection day; currently retained for provenance while cluster keys use `pair + source_run + window` |
| `overall_score` | float | overall quality 0..1 |
| `status` | `"PASS"` \| `"WARN"` \| `"FAIL"` | gate verdict |
| `metrics` | object | marker name -> float (each 0..1); markers listed above, extra markers are handled generically |
| `rolling_callback` | 0 \| 1 \| null | continuity exp: did an earlier residue surface as behavior? |
| `residue_candidate` | 0 \| 1 \| null | continuity exp: candidate residue present? |
| `generation_metadata` | object \| absent | run-level provider/model snapshot for newly collected ablation rows; older pilot rows may lack it and remain empirical-blocked |
| `run_provenance` | object \| absent | secret-safe run manifest snapshot for newly collected ablation rows: git state, command args, accepted schedule/preregistration hashes, source archive hash, runtime, and env policy |

Markers whose name ends in `_penalty` are interpreted as "lower is better" by
convention, but the script reports their means/CIs as-is.
`human_aftertaste_score` is a historical JSON key for a deterministic
rule-based aftertaste proxy. Treat it as a machine proxy, not as a human rating
or primary causal outcome.

For the primary rolling-callback analysis, `rolling_callback=null` means the row
is outside the callback-window denominator, usually because it is a source-window
conversation. Use `attach_rolling_callbacks.py --mark-callback-window-zero` with
a rolling report that includes `## Callback Window Conversations`.

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
python scripts/paper/report_to_dataset.py \
  --report PATH/soul-triad.md \
  --condition residue_on \
  --out PATH/dataset.json \
  --metadata-json PATH/generation-metadata.json \
  --provenance-json PATH/run-provenance.json \
  --source-run arm-window-YYYY-MM-DD-on \
  --window START_ISO--END_ISO \
  --collection-day YYYY-MM-DD
```

After a completed `paper:residue-arm-window` run, audit the run directory before
merging it into longitudinal results:

```
npm run paper:run-provenance-audit -- \
  --run-dir docs/paper/results/arm-window-YYYY-MM-DD-on \
  --out docs/paper/results/arm-window-YYYY-MM-DD-on/provenance-audit.md
```

The run audit expects `metadata.json`, `generation-metadata.json`,
`run-provenance.json`, `artifact-hashes.json`, `dataset.json`,
`soul-triad.md`, `rolling-continuity.md`, and the scoring/parsing logs. A
`PASS` means the run directory is locally self-consistent; it still does not
prove an empirical effect by itself.

Run analysis:

```
python scripts/paper/analyze.py \
  --dataset PATH/dataset.json \
  --annotations PATH/annotations.csv \
  --outdir scripts/paper
```

`paper:residue-arm-window` passes `--source-run`, `--window`, and
`--collection-day` automatically. Manual conversions for empirical use should
also pass them; otherwise the empirical audit will block confirmatory claims for
missing cluster metadata.

Merge audited runs:

```
npm run paper:merge-ablation-runs -- \
  --runs 'docs/paper/results/arm-window-*' \
  --out docs/paper/results/longitudinal/dataset.json \
  --manifest docs/paper/results/longitudinal/merge-manifest.json
```

Arm-window runs and any run directory containing `run-provenance.json` must pass
`paper:run-provenance-audit` before merge. Legacy `ablation-*` pilot directories
can still be merged for historical/pipeline evidence, but `paper:empirical-audit`
will continue to block them from supporting a completed effect claim when they
lack long-window metadata and provenance.

- Outputs are written under `<outdir>/results/`. The default `--outdir` is
  `scripts/paper/results`; if you pass a path ending in `results` it is
  normalized so outputs land in `<parent>/results/` (no `results/results`).
- `--annotations` is optional; without it, analysis C is skipped (an empty
  agreement section is still emitted in the summary).
- `--marker-dim NAME` selects the machine marker for convergent validity
  (default `human_aftertaste_score`, displayed in summaries as a rule-based
  aftertaste proxy).
- `--human-dim NAME` selects the human Likert dim for convergent validity
  (default `emotional_binding`).

Self-test on synthetic data with planted effects:

```
python scripts/paper/report_to_dataset.py --selftest
python scripts/paper/attach_rolling_callbacks.py --selftest
python scripts/paper/power_sensitivity.py --selftest
python scripts/paper/export_annotation_sheet.py --selftest
python scripts/paper/export_blinded_transcripts.py --selftest
python scripts/paper/merge_rater_annotations.py --selftest
python scripts/paper/paper_annotation_audit.py --selftest
python scripts/paper/paper_empirical_audit.py --selftest
python scripts/paper/paper_evidence_matrix_audit.py --selftest
python scripts/paper/paper_citation_audit.py --selftest
python scripts/paper/paper_claim_audit.py --selftest
python scripts/paper/paper_source_audit.py --selftest
python scripts/paper/paper_consistency_audit.py --selftest
python scripts/paper/paper_protocol_audit.py --selftest
python scripts/paper/paper_mechanism_audit.py --selftest
python scripts/paper/paper_pdf_preflight.py --selftest
python scripts/paper/paper_submission_audit.py --selftest
python scripts/paper/build_arxiv_source_package.py --selftest
python scripts/paper/paper_readiness_report.py --selftest
python scripts/paper/analyze.py --selftest
```

This generates a synthetic `dataset.json` + `annotations.csv` (with a planted
residue effect and planted rater agreement) in a temp directory, runs the full
pipeline, and asserts: all expected output files exist; the permutation test
recovers `residue_on > residue_off` and is significant; quadratic-weighted kappa
> 0.4 on the planted-agreement dim; convergent validity is positive. Prints
`SELFTEST: PASS` / `SELFTEST: FAIL` and exits nonzero on failure.

Current claim-readiness audit:

```
npm run paper:claim-audit
npm run paper:annotation-audit
npm run paper:empirical-audit
npm run paper:trace-overlap-audit
npm run paper:evidence-matrix-audit
npm run paper:citation-audit
npm run paper:source-audit
npm run paper:consistency-audit
npm run paper:protocol-audit
npm run paper:acceptance-hashes
npm run paper:design-audit
npm run paper:mechanism-audit
npm run paper:pdf-preflight
npm run paper:pdf-verification-audit
npm run paper:submission-audit
npm run paper:alan-decision-packet
npm run paper:arxiv-package
npm run paper:archive-audit
npm run paper:readiness
```

These commands write `docs/paper/results/claim-audit.md`,
`docs/paper/results/annotation-audit.md`, and
`docs/paper/results/source-audit.md`, then create
`docs/paper/results/arxiv-source/emotional-residue-arxiv-source.tar.gz` plus a
SHA-256 manifest and verify it with
`docs/paper/results/archive-audit.md`. A claim-audit `FAIL` verdict means the paper package contains
an unsupported claim or internal inconsistency. A
`PASS_CONSERVATIVE_PREPRINT` verdict means the current source remains defensible
only as a design/systems preprint with explicit limitations; empirical and
external submission blockers may still remain. An annotation-audit
`PACKET_READY_INCOMPLETE_STUDY` verdict means the rater packet passes local
schema/blinding checks, but completed independent rater sheets have not yet
been merged into analysis-ready `annotations.csv`. An
empirical-audit `PILOT_ONLY_INCOMPLETE_ABLATION` verdict means the longitudinal
dataset is useful as pipeline/sanity evidence but not as a completed effect
claim; missing run-level provider/model metadata is an empirical blocker for
older rows, not something to backfill by guessing. A trace-overlap audit
`PILOT_ONLY_TRACE_OVERLAP_AUDIT` verdict means the pressure-not-quotation check
is wired over rolling-continuity reports, but there are not enough callback
cases for validation. An evidence-matrix audit `PASS` means major claims are
mapped to current
evidence artifacts and explicit boundaries. A
source-audit `PASS` means the
local TeX/source checks are clean, but it does not replace compiling and
inspecting the PDF. A consistency-audit `PASS` means the checked manuscript
numbers still match the generated artifacts. A protocol-audit `PASS` means the
schedule, preregistration, acceptance files, runner, and npm scripts are
aligned; it does not mean collection has run. A mechanism-audit `PASS` means the systems claims are
statically aligned with the current residue write/read code paths; it does not
prove runtime behavior or empirical effect. A design-audit
`EMPIRICAL_DESIGN_BLOCKED` verdict means the design is acceptable for
conservative-preprint framing but not for causal/mechanism claims until schedule
acceptance, final N, annotation, and placebo-or-narrowed-claim decisions are
complete. A pdf-preflight `PASS` means a local
tool rendered `main.tex` into a non-empty PDF in a temp directory; a
`PDF_BLOCKER` means the render remains unverified because this machine lacks a
PDF-capable toolchain. A pdf-verification-audit `PDF_BLOCKER` means no rendered
PDF/platform preview inspection has been recorded yet. A submission-audit
`EXTERNAL_BLOCKERS` verdict means
Alan-facing metadata, license, timing, account, attribution, or preview
decisions remain unresolved. The archive builder performs no upload and intentionally
excludes datasets, logs, annotations, transcripts, figures, and generated
results. An archive-audit `PASS` means the generated archive and manifest match
the allowlist and no obvious source-package data or secret leakage was detected.
The readiness report writes
`docs/paper/results/readiness.md` and is the recommended one-command status
check before discussing publication timing. `paper:alan-decision-packet` writes
`docs/paper/results/alan-decision-packet.md`, a read-only Alan-facing summary of
the current readiness verdict, top empirical/external blockers, acceptance
hashes, and the commands to rerun before collection or posting.

## Outputs (under `<outdir>/results/`)

| file | analysis | content |
|---|---|---|
| `soul_uniqueness.csv` / `.md` | A | per-marker mean + 95% bootstrap CI (10k resamples, seeded), overall and per `pair` |
| `residue_ablation.csv` / `.md` | B | residue_on vs residue_off sensitivity contrast, plus residue_on vs residue_placebo only when that arm has observed outcome denominators. The table reports rolling-callback rate (primary) and rule-based aftertaste proxy mean (secondary), row-level permutation tests (10k, seeded), `mean_diff` with bootstrap mean-difference CI, an effect-size column (`risk_difference` for the proportion, Cliff's delta for the continuous metric), and `cluster_*` columns based on `pair + source_run + window` cluster means when metadata are complete. The mean-difference CI is not a Cliff's-delta CI. |
| `annotation_agreement.csv` / `.md` | C | inter-rater agreement (Cohen's quadratic-weighted kappa for 2 raters, Krippendorff's ordinal alpha for >2) on each Likert dim |
| `convergent_validity.csv` | C | Spearman rho + p between the machine marker and mean human rating per case |
| `figures/marker_means.png` | D | bar chart of marker means with CIs (skipped if matplotlib missing) |
| `figures/residue_ablation.png` | D | grouped bar of available residue arms (skipped if matplotlib missing) |
| `summary.md` | E | stitched A-C tables with one-line plain-English readouts |

## Statistical methods (all in `analyze.py`)

- **Bootstrap CI** (`bootstrap_mean_ci`, `bootstrap_diff_ci`): percentile
  bootstrap, 10k vectorized resamples, seeded.
- **Permutation test** (`permutation_test_diff_means`): two-sided, 10k
  permutations, pooled-relabel null, add-one smoothing so p is never 0. Reports
  the real p; significance is never faked.
- **Cliff's delta** (`cliffs_delta`): rank-based effect size in [-1, 1].
- **Cluster-aware path** (`cluster_unit_values`, `cluster_contrast`): aggregates
  each outcome to `pair + source_run + window` cluster means before computing
  bootstrap mean-difference CIs and permutation tests. Row-level p-values remain
  sanity statistics; confirmatory reporting requires accepted preregistration
  plus complete cluster metadata.
- **Cohen's quadratic-weighted kappa** (`cohens_quadratic_weighted_kappa`): for
  the 2-rater case.
- **Krippendorff's ordinal alpha** (`krippendorff_ordinal_alpha`): coincidence-
  matrix formulation with the ordinal difference metric, used when >2 raters.
- **Spearman** correlation via `scipy.stats.spearmanr` for convergent validity.

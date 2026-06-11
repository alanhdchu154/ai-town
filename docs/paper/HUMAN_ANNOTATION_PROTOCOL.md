# Human Annotation Protocol

Status on 2026-06-06: protocol ready; no human annotation has been completed
for the current paper package.

## Purpose

This protocol validates whether the deterministic rule-based markers align with
human judgment. It is required before making strong empirical claims about felt
continuity or player experience.

## Sampling

- Minimum pilot sample: 30 archived conversations.
- Balance across arms when ablation data exist:
  - 15 `residue_on`
  - 15 `residue_off`
- Include multiple dyads when available.
- Sampling procedure: random stratified sampling without replacement by
  `condition x dyad` where both fields are available. If the pilot dataset is too
  sparse for full stratification, report the actual arm/dyad/date distribution
  next to the agreement statistics.
- Exclude:
  - `active-conversation-*`
  - conversations with fewer than 3 messages
  - one-sided or fallback/template pollution cases unless the annotation task is
    explicitly about failure analysis.

## Blinding

Raters should not see:

- `condition`
- `rolling_callback`
- rule-based marker scores
- analysis summaries

The rater-visible annotation sheet should show only `blind_id`, a matching
`case_ref`, transcript text or a stable transcript reference, the rating
columns, and optional notes. Keep the separate key that maps
`blind_id -> case_name -> condition` away from raters until ratings are
complete.

Current `case_name` values use opaque ids such as `conversation-c:<id>`. If a
future export includes names, dates, or condition labels inside `case_name`, make
a separate blinded id before giving the sheet to raters.

## Raters

- Minimum: 2 independent raters.
- Raters score each conversation independently.
- Resolve data-entry errors only; do not discuss ratings before the first
  agreement analysis is run.

## Rating Dimensions

All dimensions use integer Likert scores from 1 to 5.

### `naturalness`

1. Very unnatural, template-like, or incoherent.
2. Mostly understandable but stiff or repetitive.
3. Acceptable but uneven.
4. Natural and contextually plausible.
5. Very natural; reads like a specific character responding in context.

### `emotional_binding`

Prompt: "This conversation feels shaped by a prior encounter between these
characters."

1. No felt prior-encounter influence.
2. Weak or generic continuity only.
3. Some plausible continuity, but not central.
4. Clear continuity that shapes tone, attention, or initiative.
5. Strong felt continuity without merely quoting a memory.

### `character_consistency`

1. Character voice or role is broken.
2. Frequent drift or wrong relationship stance.
3. Mostly consistent with some flattening.
4. Consistent and recognizable.
5. Strongly character-specific and relationally precise.

### `repetition`

1. No problematic repetition.
2. Mild repeated wording or motifs.
3. Noticeable repetition but still readable.
4. Repetition interferes with the conversation.
5. Severe echo, looping, or prop/motif reuse.

## CSV Contract

Use `docs/paper/annotations_template.csv` as the starting schema:

```csv
case_name,rater,naturalness,emotional_binding,character_consistency,repetition,notes
```

The analysis script currently reads the first six columns. `notes` are optional
and ignored by `scripts/paper/analyze.py`.

The generated `annotation_sheet.csv` is a rater worksheet keyed by `blind_id`,
not the final analysis file. After each rater independently fills a copy of the
blinded sheet, merge the completed sheets through the separate key:

```bash
python3 scripts/paper/merge_rater_annotations.py \
  --key docs/paper/results/longitudinal/annotation_key.csv \
  --rater raterA=docs/paper/results/longitudinal/raterA_completed.csv \
  --rater raterB=docs/paper/results/longitudinal/raterB_completed.csv \
  --out docs/paper/results/longitudinal/annotations.csv \
  --manifest docs/paper/results/longitudinal/annotations_manifest.json
```

The merged output has the analysis schema:

```csv
case_name,rater,naturalness,emotional_binding,character_consistency,repetition
```

Do not give `annotation_key.csv` or the merged `annotations.csv` to raters.
The merge command writes `annotations_manifest.json`; keep it with
`annotations.csv` so the paper can audit which blinded rater sheets were merged,
their SHA-256 hashes, the key hash, row counts, and the blinding contract.

To generate a blinded sheet and separate key from the current dataset:

```bash
python3 scripts/paper/export_annotation_sheet.py \
  --dataset docs/paper/results/longitudinal/dataset.json \
  --out-sheet docs/paper/results/longitudinal/annotation_sheet.csv \
  --out-key docs/paper/results/longitudinal/annotation_key.csv \
  --target 30 \
  --manifest docs/paper/results/longitudinal/annotation_packet_manifest.json
```

As of 2026-06-06, this exports only 4 rows because the current longitudinal
dataset has only 4 qualifying archived records. That sheet is a plumbing artifact, not a
complete annotation study. Keep `annotation_packet_manifest.json` with the
sheet/key pair; the audit uses it to verify sheet/key hashes, selected blind ids,
and the rater-visible blinding contract.

Generate a blinded transcript packet from the separate key and available
`soul-triad.md` reports:

```bash
python3 scripts/paper/export_blinded_transcripts.py \
  --key docs/paper/results/longitudinal/annotation_key.csv \
  --outdir docs/paper/results/longitudinal/blinded_transcripts \
  --manifest docs/paper/results/longitudinal/blinded_transcripts/transcript_packet_manifest.json
```

The transcript packet omits condition, callback labels, marker scores, and
original conversation ids. Speaker names remain visible by default because
`character_consistency` requires character identity. Use `--redact-speakers`
only for a naturalness-only or condition-blinding stress check. Keep
`transcript_packet_manifest.json` with the transcript packet; the audit uses it
to verify source-report hashes, output transcript hashes, missing-transcript
status, and transcript-level blinding flags.

## Analysis

```bash
python scripts/paper/analyze.py \
  --dataset docs/paper/results/longitudinal/dataset.json \
  --annotations docs/paper/results/longitudinal/annotations.csv \
  --outdir docs/paper/results/longitudinal
```

Report:

- weighted Cohen's kappa for exactly 2 raters;
- Krippendorff's ordinal alpha for more than 2 raters;
- Spearman rho between the rule-based aftertaste proxy and mean human
  `emotional_binding`.

Do not use the annotation results as evidence if raters were not blind to arm.

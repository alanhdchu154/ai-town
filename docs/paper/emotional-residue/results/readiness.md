# Emotional-Residue Paper Readiness

Repository: `/Users/alanhdchu/ai-town`
Verdict: **LOCAL_SOURCE_READY_WITH_WARNINGS**

## Summary

- Claim audit: `PASS_CONSERVATIVE_PREPRINT`
- Source audit: `PASS_WITH_WARNINGS`
- Citation provenance audit: `PASS`
- Consistency audit: `PASS`
- Protocol audit: `PASS`
- Causal design audit: `EMPIRICAL_DESIGN_BLOCKED`
- Mechanism audit: `PASS`
- Annotation audit: `PACKET_READY_INCOMPLETE_STUDY`
- Empirical ablation audit: `PILOT_ONLY_INCOMPLETE_ABLATION`
- Trace-overlap audit: `PILOT_ONLY_TRACE_OVERLAP_AUDIT`
- Evidence matrix audit: `PASS`
- Submission decision audit: `EXTERNAL_BLOCKERS`
- Archive package audit: `PASS`
- PDF preflight: `PDF_BLOCKER`
- PDF verification audit: `PDF_BLOCKER`
- arXiv source archive: `docs/paper/emotional-residue/results/arxiv-source/emotional-residue-arxiv-source.tar.gz`
- arXiv source SHA-256: `d9a7b2a928403b12976b9422381b5353a340394728c840b54375c59097c5e911`
- External upload/submission: not performed by this report

## Severity Counts

- FAIL: 0
- EMPIRICAL_BLOCKER: 32
- EXTERNAL_BLOCKER: 10
- PDF_BLOCKER: 5
- WARN: 1
- INFO: 3
- PASS: 7

## Claim Boundary

- **EMPIRICAL_BLOCKER / schedule_acceptance**: Arm-pure collection schedule is not accepted; do not resume collection.
- **EMPIRICAL_BLOCKER / preregistration_acceptance**: Preregistration protocol is not accepted; do not resume collection.
- **EMPIRICAL_BLOCKER / longitudinal_sample_size**: Longitudinal ablation is pilot-only: total n=4, residue_on=2, residue_off=2.
- **EMPIRICAL_BLOCKER / annotation_rows**: Blind annotation packet has 4 rows; pilot target is at least 30 balanced conversations.

## Source Hygiene

- **WARN / author_metadata_marker**: Author placeholder marker is absent; confirm metadata has actually been finalized.

## Citation Provenance

- **PASS / citation_provenance**: Ledger covers 17 bibliography keys.

## Manuscript / Artifact Consistency

- **PASS / manuscript_artifact_consistency**: Manuscript numeric claims match current paper artifacts.

## Experiment Protocol / Collection Gate

- **PASS / protocol_gate**: Schedule, preregistration, acceptance files, runner gate, and package scripts are consistent.

## Causal / Mechanism Design

- **EMPIRICAL_BLOCKER / schedule_acceptance**: Arm-pure collection schedule is not accepted; causal collection remains paused.
- **EMPIRICAL_BLOCKER / preregistration_not_accepted**: Preregistration protocol is still a draft and has not been accepted before collection.
- **EMPIRICAL_BLOCKER / preregistration_acceptance**: Preregistration acceptance JSON is not accepted; causal collection remains paused.
- **EMPIRICAL_BLOCKER / placebo_not_preregistered_or_analyzed**: Length-matched placebo has local draft plumbing but is not preregistered, accepted, collected, or analyzed; only the narrowed read-block suppression claim is currently allowed.
- **EMPIRICAL_BLOCKER / final_n_not_fixed**: Final N is intentionally not fixed until pilot baseline/yield estimates are available.
- **EMPIRICAL_BLOCKER / annotation_design**: Only 4 annotation rows exist; design requires at least 30 balanced conversations and 2 raters.
- **INFO / conservative_preprint_boundary**: Design blockers are compatible with a conservative systems preprint but not with empirical/mechanism claims.

## Residue Mechanism / Code Alignment

- **PASS / mechanism_code_alignment**: Manuscript residue architecture maps to current write/read env gates, storage prefix, extraction, prompt injection, time labels, and motif guard code paths.

## Human Annotation Packet

- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/emotional-residue/results/ablation-2026-06-06T12-47-56-333Z/off/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/emotional-residue/results/ablation-2026-06-06T12-47-56-333Z/on/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/emotional-residue/results/ablation-2026-06-06T13-03-42-965Z/off/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/emotional-residue/results/ablation-2026-06-06T13-03-42-965Z/on/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/emotional-residue/results/ablation-2026-06-06T13-20-58-196Z/off/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/emotional-residue/results/ablation-2026-06-06T13-20-58-196Z/on/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/emotional-residue/results/ablation-2026-06-06T13-30-38-681Z/off/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/emotional-residue/results/ablation-2026-06-06T13-30-38-681Z/on/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report SHA is stale; regenerate the blinded packet before using it for annotation evidence: evals/conversations/reports/soul-triad-latest.md
- **EMPIRICAL_BLOCKER / annotation_sample_size**: Only 4 annotation rows; pilot minimum is 30.
- **EMPIRICAL_BLOCKER / rater_completion**: No merged annotations.csv found; completed independent rater sheets must be merged through merge_rater_annotations.py.
- **EMPIRICAL_BLOCKER / dyad_coverage**: Annotation key has one observed dyad: {'海-真晝': 4}
- **PASS / annotation_packet_blinding**: Annotation packet schema/blinding checks pass; empirical study remains incomplete.

## Empirical Ablation Dataset

- **EMPIRICAL_BLOCKER / sample_size**: Pilot-only sample size: total n=4, residue_on=2, residue_off=2, residue_placebo=0; planned minimum is at least 40/observed arm and likely higher for small effects.
- **EMPIRICAL_BLOCKER / dyad_coverage**: Only 1 dyad(s): {'海-真晝': 4}.
- **EMPIRICAL_BLOCKER / run_coverage**: Only 2 source run(s): {'ablation-2026-06-06T13-20-58-196Z': 2, 'ablation-2026-06-06T13-30-38-681Z': 2}.
- **EMPIRICAL_BLOCKER / window_metadata**: Window metadata is absent or uninformative: {'None': 4}.
- **EMPIRICAL_BLOCKER / cluster_metadata**: 4/4 callback-denominator rows lack complete cluster metadata (pair + source_run + window).
- **EMPIRICAL_BLOCKER / generation_metadata**: 4/4 rows lack run-level provider/model metadata; future ablation rows should include generation_metadata.
- **EMPIRICAL_BLOCKER / run_provenance**: 4/4 rows lack run-level provenance; future ablation rows should include run_provenance with git/document/source/runtime evidence.
- **EMPIRICAL_BLOCKER / callback_denominator**: Only 4 rows have rolling_callback in the denominator; need enough callback-window rows before using callback rate as a primary outcome.
- **INFO / callback_rate_snapshot**: Current rolling_callback snapshot: 1/4 = 0.250.
- **EMPIRICAL_BLOCKER / aftertaste_variance**: Rule-based aftertaste proxy is saturated at [1.0]; do not use it as a primary continuous outcome.

## Trace-to-Dialogue Overlap

- **EMPIRICAL_BLOCKER / callback_sample_size**: Only 11 callback case(s) assessed; need at least 30 before treating trace-overlap as validated.
- **INFO / trace_overlap_snapshot**: Assessed 11 callback cases; max overlap ratio=0.242.

## Claim-Evidence Matrix

- **PASS / claim_evidence_matrix**: Claim-evidence matrix covers required claims, artifacts, gates, and boundaries.

## Submission Decisions

- **EXTERNAL_BLOCKER / author_name**: Author name is not confirmed.
- **EXTERNAL_BLOCKER / affiliation**: Affiliation line is not confirmed.
- **EXTERNAL_BLOCKER / contact_email**: Contact email is missing or not email-shaped.
- **EXTERNAL_BLOCKER / public_author_identity**: Public author identity has not been confirmed.
- **EXTERNAL_BLOCKER / primary_category**: Primary category must be one of ['cs.AI', 'cs.CL', 'cs.CY', 'cs.HC', 'cs.MA']; got ''.
- **EXTERNAL_BLOCKER / arxiv_account**: arXiv account/endorsement readiness is not confirmed.
- **EXTERNAL_BLOCKER / license_choice**: License choice must be one of ['arxiv-default', 'cc-by-4.0', 'cc-by-nc-sa-4.0', 'cc-by-sa-4.0', 'cc-zero'].
- **EXTERNAL_BLOCKER / upstream_attribution**: Upstream AI Town attribution comfort is not confirmed.
- **EXTERNAL_BLOCKER / timing_decision**: Timing decision must be one of ['conservative_preprint_now', 'empirical_ablation_first', 'hold'].
- **PDF_BLOCKER / pdf_render_verified**: Rendered PDF has not been verified by Alan/Codex.
- **PDF_BLOCKER / platform_preview_verified**: Platform preview has not been verified.
- **EXTERNAL_BLOCKER / main_author_identity_unconfirmed**: main.tex contains public author metadata, but public_author_identity_confirmed is false.

## Source Archive

- **PASS / archive_hygiene**: Archive and manifest verified with members: main.tex

## PDF Preflight

- **PDF_BLOCKER / pdf_tools**: No local tectonic/latexmk/pdflatex/xelatex/lualatex/pandoc found; PDF compilation remains unverified.

## PDF / Platform Verification

- **PDF_BLOCKER / pdf_render_verified**: Rendered PDF has not been verified.
- **PDF_BLOCKER / platform_preview_verified**: Platform preview has not been verified.

## Interpretation

- `LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY` means the local TeX source, claim boundary, and allowlisted source archive are ready for a conservative design/systems preprint.
- It does not mean the empirical ablation, human annotation validation, rendered PDF, platform preview, or Alan submitter decisions are complete.
- `EMPIRICAL_BLOCKER` findings must be cleared before claiming a completed causal ablation, metric validation, or player-experience result.
- `EXTERNAL_BLOCKER` and `PDF_BLOCKER` findings must be cleared before any actual external posting.

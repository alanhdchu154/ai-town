# Paper Annotation Audit

Repository: `/Users/alanhdchu/ai-town`
Verdict: **PACKET_READY_INCOMPLETE_STUDY**

## Severity Counts

- FAIL: 0
- EMPIRICAL_BLOCKER: 12
- WARN: 0
- PASS: 1

## Findings

- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/results/ablation-2026-06-06T12-47-56-333Z/off/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/results/ablation-2026-06-06T12-47-56-333Z/on/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/results/ablation-2026-06-06T13-03-42-965Z/off/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/results/ablation-2026-06-06T13-03-42-965Z/on/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/results/ablation-2026-06-06T13-20-58-196Z/off/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/results/ablation-2026-06-06T13-20-58-196Z/on/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/results/ablation-2026-06-06T13-30-38-681Z/off/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report is missing; regenerate the blinded packet before using it for annotation evidence: docs/paper/results/ablation-2026-06-06T13-30-38-681Z/on/soul-triad.md
- **EMPIRICAL_BLOCKER / transcript_source_report_stale**: Transcript packet source report SHA is stale; regenerate the blinded packet before using it for annotation evidence: evals/conversations/reports/soul-triad-latest.md
- **EMPIRICAL_BLOCKER / annotation_sample_size**: Only 4 annotation rows; pilot minimum is 30.
- **EMPIRICAL_BLOCKER / rater_completion**: No merged annotations.csv found; completed independent rater sheets must be merged through merge_rater_annotations.py.
- **EMPIRICAL_BLOCKER / dyad_coverage**: Annotation key has one observed dyad: {'海-真晝': 4}
- **PASS / annotation_packet_blinding**: Annotation packet schema/blinding checks pass; empirical study remains incomplete.

## Interpretation

- `PACKET_READY_INCOMPLETE_STUDY` means the rater packet passes local blinding/schema checks, but the merged human-validation study is not complete.
- Missing or stale source-report hashes for mutable/historical reports are empirical blockers; regenerate the blinded packet before using it as annotation evidence.
- `PASS` means the packet has enough rows and a merged `annotations.csv` with at least two rater rows per keyed case for the local schema checks; agreement statistics still need to be analyzed separately.

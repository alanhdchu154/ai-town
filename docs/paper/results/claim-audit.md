# Paper Claim Audit

Repository: `/Users/alanhdchu/ai-town`
Verdict: **PASS_CONSERVATIVE_PREPRINT**

## Severity Counts

- FAIL: 0
- EMPIRICAL_BLOCKER: 4
- EXTERNAL_BLOCKER: 0
- WARN: 0

## Findings

- **EMPIRICAL_BLOCKER / schedule_acceptance**: Arm-pure collection schedule is not accepted; do not resume collection.
- **EMPIRICAL_BLOCKER / preregistration_acceptance**: Preregistration protocol is not accepted; do not resume collection.
- **EMPIRICAL_BLOCKER / longitudinal_sample_size**: Longitudinal ablation is pilot-only: total n=4, residue_on=2, residue_off=2.
- **EMPIRICAL_BLOCKER / annotation_rows**: Blind annotation packet has 4 rows; pilot target is at least 30 balanced conversations.

## Interpretation

- `FAIL` means the paper package currently contains an internal inconsistency or unsupported claim.
- `PASS_CONSERVATIVE_PREPRINT` means the current source can be defended only as a design/systems preprint with explicit limitations.
- `EMPIRICAL_BLOCKER` items must be cleared before claiming a completed ablation, metric validation, or player-experience result.
- `EXTERNAL_BLOCKER` items require Alan's submitter decisions before arXiv upload.

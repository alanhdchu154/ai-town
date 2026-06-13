# Paper Causal Design Audit

Repository: `/Users/alanhdchu/ai-town`
Verdict: **EMPIRICAL_DESIGN_BLOCKED**

## Severity Counts

- FAIL: 0
- EMPIRICAL_BLOCKER: 6
- WARN: 0
- INFO: 1
- PASS: 0

## Findings

- **EMPIRICAL_BLOCKER / schedule_acceptance**: Arm-pure collection schedule is not accepted; causal collection remains paused.
- **EMPIRICAL_BLOCKER / preregistration_not_accepted**: Preregistration protocol is still a draft and has not been accepted before collection.
- **EMPIRICAL_BLOCKER / preregistration_acceptance**: Preregistration acceptance JSON is not accepted; causal collection remains paused.
- **EMPIRICAL_BLOCKER / placebo_not_preregistered_or_analyzed**: Length-matched placebo has local draft plumbing but is not preregistered, accepted, collected, or analyzed; only the narrowed read-block suppression claim is currently allowed.
- **EMPIRICAL_BLOCKER / final_n_not_fixed**: Final N is intentionally not fixed until pilot baseline/yield estimates are available.
- **EMPIRICAL_BLOCKER / annotation_design**: Only 4 annotation rows exist; design requires at least 30 balanced conversations and 2 raters.
- **INFO / conservative_preprint_boundary**: Design blockers are compatible with a conservative systems preprint but not with empirical/mechanism claims.

## Interpretation

- `PASS` means the design docs are locally ready for a completed causal/mechanism experiment.
- `EMPIRICAL_DESIGN_BLOCKED` means the current design is acceptable for a conservative systems preprint but not for empirical/mechanism claims.
- This audit is static; it does not collect samples, change env vars, recruit raters, or render the paper.

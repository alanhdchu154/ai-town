# Paper Empirical Ablation Audit

Repository: `/Users/alanhdchu/ai-town`
Verdict: **PILOT_ONLY_INCOMPLETE_ABLATION**

## Severity Counts

- FAIL: 0
- EMPIRICAL_BLOCKER: 9
- WARN: 0
- INFO: 1
- PASS: 0

## Findings

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

## Interpretation

- `PASS` means the longitudinal dataset passes local minimum checks for a completed ablation evidence package.
- `PILOT_ONLY_INCOMPLETE_ABLATION` means the data are useful as pipeline or sanity evidence but not as a causal/effect claim.
- Completed empirical evidence requires callback-window rows with complete cluster metadata (`pair + source_run + window`) and enough cluster units for the accepted analysis plan.
- Newly collected publishable rows must include `generation_metadata` and `run_provenance` snapshots that document provider/model policy, git commit/dirty state, accepted document hashes, source-archive hash, runtime, command args, and secret-redaction policy.
- This audit does not collect samples and does not replace human annotation or player-study validation.

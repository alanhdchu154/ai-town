# Paper Trace-Overlap Audit

Repository: `/Users/alanhdchu/ai-town`
Verdict: **PILOT_ONLY_TRACE_OVERLAP_AUDIT**

## Severity Counts

- FAIL: 0
- EMPIRICAL_BLOCKER: 1
- WARN: 0
- INFO: 1
- PASS: 0

## Findings

- **EMPIRICAL_BLOCKER / callback_sample_size**: Only 11 callback case(s) assessed; need at least 30 before treating trace-overlap as validated.
- **INFO / trace_overlap_snapshot**: Assessed 11 callback cases; max overlap ratio=0.242.

## Assessed Callback Cases

| callback | source | report | overlap_ratio | longest_common_chars |
|---|---|---|---:|---:|
| `conversation-c:92423` | `conversation-c:92214` | `docs/paper/results/repeatability/rolling-continuity-2026-06-04.md` | 0.242 | 8 |
| `conversation-c:92490` | `conversation-c:92214` | `docs/paper/results/repeatability/rolling-continuity-2026-06-04.md` | 0.125 | 3 |
| `conversation-c:92878` | `conversation-c:92821` | `docs/paper/results/repeatability/rolling-continuity-2026-06-05.md` | 0.070 | 3 |
| `conversation-c:92453` | `conversation-c:92214` | `docs/paper/results/repeatability/rolling-continuity-2026-06-04.md` | 0.052 | 3 |
| `conversation-c:92931` | `conversation-c:92842` | `docs/paper/results/repeatability/rolling-continuity-2026-06-05.md` | 0.046 | 3 |
| `conversation-c:92529` | `conversation-c:92214` | `docs/paper/results/repeatability/rolling-continuity-2026-06-04.md` | 0.045 | 3 |
| `conversation-c:92975` | `conversation-c:92878` | `docs/paper/results/repeatability/rolling-continuity-2026-06-05-15-19-yield-check.md` | 0.043 | 2 |
| `conversation-c:92943` | `conversation-c:92878` | `docs/paper/results/repeatability/rolling-continuity-2026-06-05-15-19-yield-check.md` | 0.042 | 2 |
| `conversation-c:92965` | `conversation-c:92931` | `docs/paper/results/repeatability/rolling-continuity-2026-06-05-15-19-yield-check.md` | 0.033 | 2 |
| `conversation-c:92377` | `conversation-c:92214` | `docs/paper/results/repeatability/rolling-continuity-2026-06-04.md` | 0.020 | 1 |
| `conversation-c:92332` | `conversation-c:92214` | `docs/paper/results/repeatability/rolling-continuity-2026-06-04.md` | 0.019 | 1 |

## Interpretation

- `PASS` means enough callback cases were assessed and no high verbatim-overlap flags were found.
- `PILOT_ONLY_TRACE_OVERLAP_AUDIT` means the check is wired but sample size is too small for validation.
- `WARN / possible_verbatim_overlap` means later dialogue may be copying residue text rather than using it as behavioral pressure.
- This audit uses simple text overlap over rolling-continuity reports; it does not replace human review.

# Claim-Evidence Matrix

Status on 2026-06-10: the paper is locally source-ready as a conservative
design/systems preprint, but it is not an empirical effect paper and is not
externally ready.

This matrix maps the main manuscript claims to the strongest current evidence
and the claim boundary that must be preserved.

| Claim ID | Manuscript claim | Current status | Evidence artifacts | Required boundary |
|---|---|---|---|---|
| C1 | Emotional residue is a lightweight write/read memory pattern for LLM-driven character agents. | SUPPORTED_SYSTEMS_PATTERN | `docs/paper/emotional-residue/results/mechanism-audit.md`; `convex/agent/memory.ts`; `convex/agent/conversation.ts` | Describe as a design/systems pattern, not as proof of player-perceived improvement. |
| C2 | The implementation writes bounded same-pair residue and reads at most two recent traces as behavioral pressure rather than quotation. | SUPPORTED_CODE_ALIGNED | `docs/paper/emotional-residue/results/mechanism-audit.md`; `scripts/paper/paper_mechanism_audit.py`; `convex/agent/memory.ts`; `convex/agent/conversation.ts` | Keep the claim scoped to current code alignment and inspectability; runtime behavior still needs ablation/player validation. |
| C3 | Deterministic soul-triad markers can make current character distinctiveness and hygiene inspectable. | SUPPORTED_SMOKE | `docs/paper/emotional-residue/results/current-smoke/results/summary.md`; `docs/paper/emotional-residue/data/current-smoke/dataset.json`; `docs/paper/emotional-residue/results/consistency-audit.md` | Report as rule-based feasibility evidence over 8 recent conversations, not as a validated psychometric or player-experience metric. |
| C4 | Rolling two-hour continuity can identify concrete residue-to-callback moments in archived windows. | SUPPORTED_FEASIBILITY | `docs/paper/emotional-residue/results/repeatability/rolling-continuity-2026-06-05.md`; `docs/paper/emotional-residue/results/repeatability/rolling-continuity-2026-06-05-15-19-yield-check.md`; `docs/paper/emotional-residue/results/consistency-audit.md` | Report as feasibility/window evidence; do not claim stable population effect or causal impact. |
| C5 | The read-on/read-off ablation pipeline can produce archived arm-scoped records and restore the read flag. | SUPPORTED_PIPELINE_SANITY | `docs/paper/emotional-residue/results/longitudinal/dataset.json`; `docs/paper/emotional-residue/results/longitudinal/results/summary.md`; `docs/paper/emotional-residue/results/empirical-audit.md`; `scripts/paper/run_residue_ablation.mjs`; `scripts/paper/run_arm_pure_residue_window.mjs` | Treat as plumbing/sanity evidence only, not as a completed effect claim: current data are n=2/arm, one dyad, two source runs, no long-window metadata, no complete cluster metadata, and saturated aftertaste proxy. The manuscript must frame the future two-arm contrast as narrowed read-block suppression in a continuing world, not clean residue-content isolation. |
| C6 | Residue improves felt continuity, callback rate, or player experience. | FUTURE_WORK_BLOCKED | `docs/paper/emotional-residue/results/empirical-audit.md`; `docs/paper/emotional-residue/results/annotation-audit.md`; `docs/paper/emotional-residue/results/readiness.md`; `docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md`; `docs/paper/emotional-residue/experiments/SCHEDULE_ACCEPTANCE.json` | Do not claim this. Requires accepted schedule, longitudinal arm-pure collection, enough callback-window denominator rows, complete `pair + source_run + window` cluster metadata, broader dyad/window coverage, and human validation. |
| C7 | The annotation packet can support blind human validation once enough records and raters exist. | PACKET_READY_STUDY_INCOMPLETE | `docs/paper/emotional-residue/results/annotation-audit.md`; `docs/paper/emotional-residue/results/longitudinal/annotation_sheet.csv`; `docs/paper/emotional-residue/results/longitudinal/annotation_key.csv`; `docs/paper/emotional-residue/results/longitudinal/blinded_transcripts/` | Current packet is schema/blinding ready but has only 4 rows, no merged `annotations.csv` from completed independent rater sheets, and one dyad. |
| C8 | The local TeX source package is ready for conservative source-level inspection. | SUPPORTED_LOCAL_SOURCE | `docs/paper/emotional-residue/results/source-audit.md`; `docs/paper/emotional-residue/results/arxiv-source/manifest.json`; `docs/paper/emotional-residue/results/readiness.md` | Source package is not the same as rendered-PDF readiness or external submission readiness. |
| C9 | The paper is ready for external posting. | EXTERNAL_BLOCKED | `docs/paper/emotional-residue/results/submission-audit.md`; `docs/paper/emotional-residue/results/pdf-preflight.md`; `docs/paper/emotional-residue/release/SUBMISSION_DECISIONS.json` | Do not claim external readiness until Alan confirms metadata/license/category/timing/account decisions and PDF/platform preview are verified. |
| C10 | Later dialogue uses residue as pressure rather than quotation. | PILOT_ONLY_TRACE_OVERLAP_AUDIT | `docs/paper/emotional-residue/results/trace-overlap-audit.md`; `docs/paper/emotional-residue/results/repeatability/rolling-continuity-2026-06-04.md`; `docs/paper/emotional-residue/results/repeatability/rolling-continuity-2026-06-05.md` | Current overlap audit is a simple text check over 11 callback cases; use it as pilot hygiene only, not as behavioral-compliance validation. |
| C11 | The empirical design is ready to support causal/mechanism claims. | EMPIRICAL_DESIGN_BLOCKED | `docs/paper/emotional-residue/results/design-audit.md`; `docs/paper/emotional-residue/results/power/summary.md`; `docs/paper/emotional-residue/results/power/cluster_power_grid.csv`; `docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md`; `docs/paper/emotional-residue/experiments/LONGITUDINAL_EXPERIMENT_PLAN.md` | Current design is acceptable for a conservative systems preprint, but empirical/mechanism claims remain blocked until schedule acceptance, final N based on the preregistered pilot-baseline / MDE / design-effect procedure, complete cluster metadata, annotation, dyad-coverage fallback, no interim effect peeking, and placebo-or-narrowed-claim decisions are complete. |

## Local Handoff / Premortem

- `docs/paper/emotional-residue/release/ALAN_HANDOFF.md` is the one-page Alan-facing boundary summary.
- `docs/paper/emotional-residue/claims/REVIEWER_PREMORTEM.md` lists likely reviewer objections and the
  current response boundary.
- `docs/paper/emotional-residue/manuscript/main.tex` now discloses the local/cloud provider policy
  paths and states that current datasets do not store per-conversation
  provider/model metadata.
- `docs/paper/emotional-residue/results/trace-overlap-audit.md` checks whether available
  rolling-continuity callbacks look like verbatim residue quotation; current
  coverage is pilot-only.
- `docs/paper/emotional-residue/results/design-audit.md` checks whether the causal/mechanism
  design is ready beyond conservative-preprint framing; current verdict is
  blocked for empirical/mechanism claims.

## Current Gate Summary

- Claim audit: `PASS_CONSERVATIVE_PREPRINT`
- Source audit: `PASS`
- Consistency audit: `PASS`
- Protocol audit: `PASS`
- Causal design audit: `EMPIRICAL_DESIGN_BLOCKED`
- Mechanism audit: `PASS`
- Annotation audit: `PACKET_READY_INCOMPLETE_STUDY`
- Empirical ablation audit: `PILOT_ONLY_INCOMPLETE_ABLATION`
- Trace-overlap audit: `PILOT_ONLY_TRACE_OVERLAP_AUDIT`
- Submission decision audit: `EXTERNAL_BLOCKERS`
- PDF preflight: `PDF_BLOCKER`
- Readiness verdict: `LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`

## Reviewer-Safe One-Sentence Boundary

The paper currently supports a lightweight, inspectable residue memory pattern
and a working evaluation/ablation pipeline; it does not yet support causal,
population-level, or player-experience claims about residue improving felt
continuity, and it does not yet validate behavioral compliance with
pressure-not-quotation beyond a pilot overlap check.

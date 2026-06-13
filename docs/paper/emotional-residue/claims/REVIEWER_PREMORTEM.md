# Reviewer Premortem

Status on 2026-06-10: current source is defensible only as a conservative
design/systems preprint. This file lists likely reviewer objections and the
current response boundary.

## Highest-Risk Objections

### 1. This is not an empirical effect paper.

Reviewer version: "The paper implies emotional residue improves continuity, but
the ablation is n=2/arm and one dyad."

Response boundary: agree. The manuscript must frame the current data as
feasibility, inspectability, and pipeline evidence only. Effect claims remain
future work.

Current artifacts:

- `docs/paper/emotional-residue/results/empirical-audit.md`
- `docs/paper/emotional-residue/claims/CLAIM_EVIDENCE_MATRIX.md`
- `docs/paper/emotional-residue/release/ALAN_HANDOFF.md`

### 2. The rule-based markers are not validated.

Reviewer version: "The soul-triad metrics are deterministic heuristics, not
player experience or a psychometric instrument."

Response boundary: agree. The paper now names them as deterministic smoke
metrics. Human annotation is required before stronger validity claims.

Current artifacts:

- `docs/paper/emotional-residue/experiments/HUMAN_ANNOTATION_PROTOCOL.md`
- `docs/paper/emotional-residue/results/annotation-audit.md`

### 3. The read-off arm has prompt-shape confounds.

Reviewer version: "Turning residue reads off also shortens the prompt, so the
effect cannot isolate residue from prompt length or prompt shape."

Response boundary: agree. The empirical version needs either a length-matched
placebo arm or a narrowed mechanism claim.

Current artifacts:

- `docs/paper/emotional-residue/experiments/LONGITUDINAL_EXPERIMENT_PLAN.md`
- `docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md`

### 4. "Pressure, not quotation" is asserted but not measured.

Reviewer version: "The prompt tells the model not to quote residue, but the
paper does not measure whether it obeys."

Response boundary: partly addressed as pilot hygiene. The current package now
includes a simple trace-to-dialogue overlap audit over rolling-continuity
reports, but it has only 11 callback cases and should not be treated as
behavioral-compliance validation. The empirical version should run this check
over the completed ablation windows and treat high overlap as a failure mode.

Current artifact:

- `docs/paper/emotional-residue/manuscript/main.tex`
- `docs/paper/emotional-residue/results/trace-overlap-audit.md`

### 5. Model/provider reproducibility is limited.

Reviewer version: "The paper does not fully lock down which model generated
each artifact."

Response boundary: partly agree. The source now discloses the relevant code
defaults and policy paths, but current datasets do not store per-conversation
provider/model metadata. Provider-controlled comparisons are therefore out of
scope.

Current artifact:

- `docs/paper/emotional-residue/manuscript/main.tex`

### 6. Novelty may look like summary memory with a do-not-quote prompt.

Reviewer version: "What is new compared with summary memory plus a retrieval
instruction?"

Response boundary: defend as an integrated minimal pattern: bounded same-pair
trace, time-labeled retrieval of at most two traces, separate write/read flags,
and motif guards that treat repeated props as failure rather than evidence.
Do not claim that layered identity or memory retrieval itself is novel.

Current artifact:

- `docs/paper/emotional-residue/manuscript/main.tex`

### 7. Single-player author-observer evidence limits generality.

Reviewer version: "The author is the observed user/player; this may bias
interpretation."

Response boundary: agree. The abstract and limitations should expose this
early. Population/player claims require a later player study.

Current artifact:

- `docs/paper/emotional-residue/manuscript/main.tex`

### 8. Nominal sample size may overstate independent evidence.

Reviewer version: "Rows are repeated within dyads, days, or rolling windows, so
the power plan cannot treat every callback-window row as independent."

Response boundary: agree. The current power table is only a planning
sensitivity. The empirical version needs either larger N or cluster-aware
analysis after pilot yield and baseline callback rate are measured. The package
now includes a simple design-effect sensitivity grid so `n=40/arm` is not
mistaken for a powered small-effect study.

Current artifacts:

- `docs/paper/emotional-residue/results/power/summary.md`
- `docs/paper/emotional-residue/results/power/cluster_power_grid.csv`
- `docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md`

### 9. Between-arm carryover can confound long-window interpretation.

Reviewer version: "If the world persists across arm-pure windows, can later
read-enabled arms read residue written before the arm started?"

Response boundary: agree and disclose. The current continuing-world design
does not erase older residue rows. The evaluation window is arm-start bounded,
but the read path may still see older residue in read-enabled arms. Therefore
the two-arm design estimates read-block suppression in a continuing world, not
an empty-memory reset. A stronger mechanism study needs a preregistered
length-matched placebo condition plus an explicit read-eligibility or world
reset rule.

Current artifacts:

- `docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md`
- `docs/paper/emotional-residue/experiments/PREREGISTRATION_PROTOCOL.md`

### 10. Ethics scope could be mistaken for a player study.

Reviewer version: "If this involves a player/user, what is the human-subjects
scope and transcript policy?"

Response boundary: the manuscript now states this is an author-observed,
single-player prototype, no external participants were recruited or recorded,
no IRB or human-subjects approval is claimed, raw player-conversation
transcripts are excluded from the source archive, and a controlled player study
with appropriate review remains future work.

Current artifact:

- `docs/paper/emotional-residue/manuscript/main.tex`

## Recommended Venue Boundary

Reasonable current framing:

- arXiv source package for conservative design/systems discussion;
- workshop or exploratory game-AI / HCI venue that accepts systems patterns and
  preliminary feasibility evidence.

Not yet reasonable:

- a completed empirical HCI paper;
- a causal ablation paper;
- a player-experience validation paper.

## Do-Not-Cross Line

Do not let "source-ready" become "effect-ready." The readiness verdict can be
green for local source hygiene while the empirical and external-decision gates
remain blocked.

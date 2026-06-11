# Schedule Decision for Residue READ Ablation

Date: 2026-06-06
Decision status: **pre-registered plan draft; collection paused until this plan
is accepted**

## Decision

Use **arm-pure full-day / long-window collection** as the primary causal design.
Forced dyad blocks remain useful for mechanism debugging, but they are not the
primary evidence for the paper's felt-continuity claim.

## Why

cc's expert review identified that short forced blocks cannot produce the
rolling-callback primary outcome in a valid way. A forced sample collected inside
an arm is usually a source candidate, not a later callback, and the forced
co-location script removes the initiative channel that emotional residue is
supposed to influence.

An arm-pure day avoids mixing ON/OFF conditions inside date-level rolling
windows:

- `residue_on` day: `UNDERWORLD_RESIDUE_READ` unset
- `residue_off` day: `UNDERWORLD_RESIDUE_READ=false`
- future `residue_placebo` day: `UNDERWORLD_RESIDUE_READ=placebo`
- rolling-continuity windows are evaluated within that arm's date/window only

Read eligibility is deliberately disclosed rather than hidden: the current
continuing-world design does not erase or hide residue rows written before a
new arm starts. The evaluation window is arm-start bounded, but later
read-enabled arms may still read older residue in the world. Therefore the
two-arm design estimates suppression of the residue-read prompt block in a
continuing world, not an empty-memory reset. A stronger mechanism study must
pre-register either a length-matched placebo condition with its own
read-eligibility rule or an explicit world-reset / residue-scope rule.

Runnable entrypoint after acceptance:

```bash
npm run paper:residue-arm-window:acceptance

npm run paper:residue-arm-window -- \
  --arm=on \
  --duration-min=240 \
  --collect=none \
  --python=/tmp/ai-town-paper-venv/bin/python
```

Run the pre-written OFF windows with `--arm=off`. Use `--collect=none` for the
primary ecological design; `--collect=force` is allowed only as mechanism-pilot
supplemental evidence.

Machine gate:

- `docs/paper/SCHEDULE_ACCEPTANCE.json` must have `accepted: true`,
  `accepted_by`, `accepted_at`, and `schedule_sha256` matching the current
  `docs/paper/SCHEDULE_DECISION.md` before `paper:residue-arm-window` will run.
- `docs/paper/PREREGISTRATION_ACCEPTANCE.json` must also have `accepted: true`,
  `accepted_by`, `accepted_at`, and `preregistration_sha256` matching the
  current `docs/paper/PREREGISTRATION_PROTOCOL.md` before
  `paper:residue-arm-window` will run.
- Current value is intentionally `accepted: false`.
- Do not edit either acceptance file unless Alan explicitly accepts both this
  schedule and `docs/paper/PREREGISTRATION_PROTOCOL.md`.
- To fill the hash fields after explicit acceptance, compute the current
  document hashes with:
  `shasum -a 256 docs/paper/SCHEDULE_DECISION.md docs/paper/PREREGISTRATION_PROTOCOL.md`.
  The read-only helper `npm run paper:acceptance-hashes` prints the same hashes
  plus the JSON fields to fill after acceptance.

## Primary Outcome

- `rolling_callback_rate`
- Unit: archived conversation in a callback window
- Label source: arm-scoped rolling-continuity report joined via
  `scripts/paper/attach_rolling_callbacks.py`
- Current status: plumbing works, but current data are only a small
  pre-fix/plumbing sanity check.

Denominator policy:

- `rolling_callback=1`: conversation id appears under `## Rolling Callbacks
  Found`.
- `rolling_callback=0`: conversation id appears under `## Callback Window
  Conversations` but not under `## Rolling Callbacks Found`.
- `rolling_callback=null`: source-window conversation or any row outside the
  callback-window denominator.
- `analyze.py` drops null labels for the callback-rate analysis.

This prevents source-window conversations from being counted as callback
failures by construction.

## Mechanism Control Boundary

The primary two-arm read-off design estimates the effect of suppressing the
residue read block under the current prompt shape. It does **not** by itself
isolate residue content from prompt length, prompt placement, or any other
instruction-shape difference introduced when the read block is removed.

Before the paper can claim a clean read-path mechanism, choose one of these
pre-registered options:

1. **Length-matched placebo arm**: add a `residue_placebo` condition that keeps
   the same prompt slot and approximate token budget as the residue-read block,
   but contains neutral, non-relational filler that cannot encode prior
   encounters. Compare `residue_on` vs `residue_placebo` for the mechanism claim
   and report `residue_off` as a sensitivity arm.
2. **Narrowed mechanism claim**: keep the two-arm `residue_on` vs
   `residue_off` design, but describe it as suppressing the entire residue-read
   prompt block, not as isolating residue content independent of prompt shape.

The current manuscript uses option 2 for the conservative design/systems
preprint. A stronger empirical mechanism paper should implement option 1 or
explicitly keep the narrowed mechanism claim.

## Secondary Outcomes

- Human felt-continuity Likert score, blind to arm
- Character consistency / naturalness / repetition annotation
- Rule-based marker table as descriptive diagnostics only
- `human_aftertaste_score` is renamed in prose as a rule-based aftertaste proxy;
  it is not a primary outcome because current pilots saturate at 1.0.

## Schedule

Pilot phase:

- 6 arm-pure collection days or long windows:
  - 3 `residue_on`
  - 3 `residue_off`
- Alternate order where practical:
  - ON / OFF / OFF / ON / ON / OFF, or another prewritten balanced order
- Do not change prompts, residue logic, character definitions, or model settings
  during the pilot.

Archived yield check:

- A zero-cost read-only check on 2026-06-05 15:00--19:00 America/Chicago found
  enough natural traffic for the rolling denominator: 2 source conversations, 5
  callback conversations, 12 source residue candidates, and 3 weak callbacks.
- The check was `WARN / weak_continuity`, not `PASS`, so 4-hour windows look
  feasible for yield but should not be assumed to produce strong effects.
- Report:
  `docs/paper/results/repeatability/rolling-continuity-2026-06-05-15-19-yield-check.md`.

Dyad rotation policy:

- Pre-rotate target dyads across pilot windows where the collection path allows
  targeting or observation stratification:
  - Window 1: 海-真晝
  - Window 2: 真晝-天澤
  - Window 3: 海-天澤
  - Window 4: 真晝-天澤
  - Window 5: 海-天澤
  - Window 6: 海-真晝
- Balance the arm order against this dyad order, e.g. ON / OFF / OFF / ON / ON /
  OFF. If natural `--collect=none` traffic cannot force dyads, report the actual
  dyad distribution and do not claim multi-dyad coverage until the observed
  distribution supports it.
- If the pilot does not produce at least 3 dyads with at least 5
  callback-window rows in each observed arm, stop at feasibility reporting and
  revise the sampling plan before any main-phase effect claim.

Main phase:

- Continue only if pilot yield is usable and the label distribution is not fully
  saturated.
- Pre-register final N before looking at the main-phase effect estimate.

## Sample Size and MDE

Do not present `n=40/arm` as a powered final study without an MDE.

Offline sensitivity output:

- `docs/paper/results/power/summary.md`
- `docs/paper/results/power/cluster_power_grid.csv`
- Method: approximate two-proportion planning calculation for the binary
  `rolling_callback_rate`, using Cohen's h, plus a design-effect sensitivity
  grid for dyad/day/window clustering.
- At plausible baseline callback rates, `n=40/arm` has low approximate power for
  10--15 percentage-point effects; it is only suitable for large-effect pilot
  evidence.
- The table treats callback-window rows as independent. If rows cluster by dyad,
  day, or window, the effective N is smaller; the main design should increase N
  and use the `pair + source_run + window` cluster-aware analysis path before
  treating p-values as confirmatory.

For v1/v2 paper planning:

- `n=10/arm`: pipeline pilot only
- `n=40/arm`: large-effect pilot / workshop-scale evidence
- `n>=150/arm`: plausible for 10-15 percentage-point callback-rate differences
  only when the observed baseline rate is low (roughly 0.05-0.15); higher
  baseline rates can push 10 percentage-point effects toward `n≈250/arm`

Exact N should be set after the pilot estimates baseline callback rate and
sample yield.

## Stopping Rule

- No optional stopping based on p-values.
- Pilot stopping: stop when each arm has at least 10 qualifying callback-window
  records or after 6 arm-pure collection days, whichever comes first.
- Main stopping: fixed N per arm from the pre-registered MDE.
- Before the pilot stopping rule is reached, do not inspect arm-level effect
  estimates, p-values, or direction-of-effect summaries. Interim checks are
  limited to yield, metadata completeness, safety/hygiene failures, and whether
  acceptance gates remain intact.

## Human Annotation Minimum

- At least 2 raters
- Blind to arm
- At least 30 conversations balanced across arms for the pilot
- Include a felt-continuity item:
  - "This conversation feels shaped by a prior encounter between these
    characters."
- Report weighted Cohen's kappa and Spearman correlation against
  `rolling_callback`.

## Release Wording

Current paper can say:

- the emotional-residue pattern is implemented;
- smoke/repeatability checks exist;
- archived-only ablation plumbing exists;
- first sanity dataset is too small and too homogeneous for an effect claim;
- the causal ablation is pre-registered as future / in-progress work.

Current paper must not say:

- residue has been shown to improve felt continuity;
- `human_aftertaste_score` is a human outcome;
- n=40/arm is statistically powered without an MDE;
- forced dyad blocks measure natural initiative or world-level continuity.
- read-off alone isolates residue content from prompt length or prompt shape.

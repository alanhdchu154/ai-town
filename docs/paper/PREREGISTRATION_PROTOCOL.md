# Emotional-Residue Ablation Preregistration Protocol

Status on 2026-06-06: **draft, not accepted, not started**. This file is the
machine-audited preregistration target for the rigorous empirical version. It
does not authorize collection; both `docs/paper/SCHEDULE_ACCEPTANCE.json` and
`docs/paper/PREREGISTRATION_ACCEPTANCE.json` must be accepted before the
collection runner will start. Acceptance must include SHA-256 hashes for the
exact schedule and preregistration documents being accepted; if either document
changes afterward, collection remains paused until the current documents are
accepted again.

## Registration Status

- preregistration_status: draft_not_accepted
- collection_status: paused
- accepted_schedule_required: true
- no_optional_stopping: true
- final_n_status: not_fixed_until_pilot_baseline_and_yield
- placebo_arm_status: local_plumbing_not_preregistered
- placebo_analysis_status: not_analyzed
- current_mechanism_claim: narrowed_read_block_suppression
- read_eligibility_policy: existing_residue_visible_with_arm_start_evaluation_scope

## Arms

- residue_on: `UNDERWORLD_RESIDUE_READ` unset / read enabled.
- residue_off: `UNDERWORLD_RESIDUE_READ=false`; residue may still exist in
  memory but the residue-read prompt block is suppressed.
- residue_placebo: local runtime plumbing exists as a draft future condition
  with `UNDERWORLD_RESIDUE_READ=placebo`, but it has not been preregistered,
  accepted, collected, or analyzed. It is required before claiming clean
  isolation of residue content from prompt length, prompt placement, or
  instruction shape.

## Primary Outcome

- primary_outcome: `rolling_callback_rate`
- unit: archived conversation in a callback window
- denominator: only conversations listed under `## Callback Window
  Conversations` in the arm-scoped rolling-continuity report
- label_1: conversation id appears under `## Rolling Callbacks Found`
- label_0: callback-window conversation id does not appear under rolling
  callbacks
- label_null: source-window row or row outside callback-window denominator

## Secondary Outcomes

- blind human felt-continuity Likert score
- blind human naturalness / emotional binding / character consistency /
  repetition scores
- deterministic marker table as descriptive diagnostics only
- rule-based aftertaste proxy as descriptive only unless future data show
  usable variance and human convergent validity
- trace-to-dialogue verbatim-overlap rate as a failure-mode audit

## Inclusion Criteria

- archived conversation row only
- `case_name` must not start with `active-conversation-`
- `message_count >= 3`
- `condition` is one of `residue_on`, `residue_off`, or future
  `residue_placebo`
- row has arm/window metadata from the collection runner
- newly collected rows include `generation_metadata`

## Exclusion Criteria

- active or unarchived conversation ids
- one-sided or fallback-shaped conversations
- rows outside the callback-window denominator for the primary callback-rate
  analysis
- rows missing arm label or condition
- duplicate conversation ids within the same analysis dataset
- data collected after prompt, character, provider/model, residue logic, or
  analysis-code changes unless the change is logged as a new study version

## Schedule And Counterbalancing

- pilot_windows: 6 arm-pure windows
- pilot_order: ON / OFF / OFF / ON / ON / OFF unless Alan accepts a revised
  balanced order before collection
- pilot_window_duration_min: 240
- collect_mode_primary: none
- forced_collection_role: mechanism_debugging_only
- dyad_rotation_target: 海-真晝 / 真晝-天澤 / 海-天澤 / 真晝-天澤 / 海-天澤 /
  海-真晝
- prompt_character_model_freeze: required during a registered study version
- between_arm_read_eligibility: existing residue rows may remain in the world
  and may be read by later read-enabled arms; the analysis scope is arm-start
  bounded, but the current system does not erase or hide older residue rows.
- carryover_interpretation: the two-arm design estimates read-block suppression
  in a continuing world, not an empty-memory reset. Any stronger clean-content
  mechanism claim requires the preregistered length-matched placebo condition
  and an explicit read-eligibility rule for that study version.
- dyad_imbalance_fallback: if the 6 pilot windows do not produce at least 3
  dyads with at least 5 callback-window rows in each observed arm, report the
  pilot as single-/low-dyad feasibility evidence only and do not continue to a
  main-phase effect claim until a revised, accepted sampling plan addresses dyad
  coverage.

## Stopping Rule

- pilot_stop_rule: stop when each arm has at least 10 qualifying archived
  callback-window records or after 6 arm-pure windows, whichever comes first
- main_stop_rule: fixed N per arm from pre-registered MDE after pilot
  baseline/yield estimation
- no_optional_stopping_on_p_values: true
- no_arm_extension_after_effect_peeking: true
- no_interim_effect_peeking: arm-level effect estimates, p-values, and
  direction-of-effect summaries are not inspected before the pilot stopping rule
  is reached; interim checks are limited to yield, metadata completeness,
  safety/hygiene failures, and whether acceptance gates remain intact.

## Sample Size And Power

- planning_files:
  - `docs/paper/results/power/summary.md`
  - `docs/paper/results/power/cluster_power_grid.csv`
- `n=10/arm`: pipeline pilot only
- `n=40/arm`: large-effect pilot / workshop-scale evidence only
- `n>=150/arm`: plausible for small 10--15 percentage-point effects only under
  favorable baseline callback rates and weak clustering
- final_n_rule:
  1. Choose the smallest effect size of interest before main-phase collection;
     default MDE is a 10 percentage-point change in `rolling_callback_rate`.
  2. Estimate the pilot baseline callback rate from arm-combined pilot
     callback-window rows, not from an arm effect contrast.
  3. Estimate average cluster size and a conservative dyad/window design effect
     from pilot metadata; if ICC cannot be estimated reliably, use the largest
     design-effect row in `cluster_power_grid.csv` that matches or exceeds the
     observed average cluster size.
  4. Select the per-arm N from `cluster_power_grid.csv` for alpha=0.05,
     target power=0.80, the chosen MDE, and the conservative design effect.
  5. Freeze that per-arm N, study version, and exclusion rules before inspecting
     any main-phase arm-level effect estimate.
- cluster_policy: account for dyad/day/window clustering through larger N and
  cluster-aware analysis; current analysis code uses `pair + source_run +
  window` cluster means when metadata are complete

## Analysis Plan

- callback_rate_effect: risk difference on callback-window rows, with the
  confirmatory test computed over `pair + source_run + window` cluster means
  when cluster metadata are complete; row-level permutation output is
  descriptive/sanity evidence only
- continuous_marker_effects: bootstrap confidence intervals and Cliff's delta
  for descriptive marker outcomes
- human_annotation_agreement: weighted Cohen's kappa for two raters,
  Krippendorff's ordinal alpha for more than two raters
- convergent_validity: Spearman correlation between machine markers and blind
  human emotional-binding/felt-continuity ratings
- trace_overlap: report max and distribution of source-trace-to-callback text
  overlap; high overlap is a failure of pressure-not-quotation, not success

## Deviation Policy

- Any change to arms, prompts, character definitions, provider/model defaults,
  collection mode, stopping rule, exclusion criteria, or analysis code creates a
  new preregistration version before further main-phase collection.
- Pilot deviations may be reported as feasibility evidence but cannot silently
  enter the main causal analysis.
- The current n=4 longitudinal dataset is pipeline/debug evidence only and is
  excluded from any completed empirical-effect claim.

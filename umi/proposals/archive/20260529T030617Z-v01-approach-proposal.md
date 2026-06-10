# Underworld v0.1 Approach Proposal

Created: 2026-05-29T03:06:17.752Z
Category: db_cleanup
Confidence: sample_pending

## Evidence

- Fresh triad samples: 0
- Soul PASS/WARN/FAIL: 0/0/0
- Recent PASS/WARN/FAIL: 0/0/0
- Top failure category: sample_pending
- Observed issue: none
- Repair class: observe_only
- Rubric disagreement: no
- Recent failure reason: -
- Provider health: not_checked_night_quiet
- Model policy env: ok
- Runtime health: ok
- World engine status: running
- Active fallback pollution count: 236
- Archived fallback history count: 248
- Fresh fallback markers: 0
- Stage-direction leak sum: 0.00
- Echo penalty sum: 0.00
- CC review: skipped_by_flag
- Code changed: no
- Next safest action: wait for more fresh samples; do not modify code
- AM→PM continuity: WARN / sample_pending
- Fresh-window life signals: WARN / sample_pending
- Day-window life signals: WARN / prop_echo_repeated
- Day-window life conversations: 14
- Day-window ordinary scenes: 4
- Day-window daily rhythm: 11
- Day-window soul style: 9

Fresh sample count is below 3; insufficient evidence for repair.

AM→PM continuity:
- status: WARN
- decision: sample_pending
- morning samples: 0
- afternoon samples: 0
- AM residue candidates: 0
- PM callbacks found: 0
- next safest action: Keep the world running during the morning window; do not repair prompts.

Life signals:
Fresh-window life-signal evidence is used for repair-gate safety. It only counts conversations archived after this observe run began.

- status: WARN
- decision: sample_pending
- conversation count: 0
- life-grounded conversations: 0
- administrative drift flags: 0
- hygiene flags: 0
- conversation shape flags: 0
- single-message conversations: 0
- one-speaker conversations: 0
- post-processing drift flags: 0
- prop echo flags: 0
- repeated line flags: 0
- scene diversity: 0
- ordinary scene diversity: 0
- office-grounded conversations: 0
- ordinary-scene conversations: 0
- daily rhythm conversations: 0
- daily rhythm diversity: 0
- soul-style conversations: 0
- soul-style diversity: 0
- average life signal score: 0.00
- next safest action: Let the world run naturally before tuning prompts.

## CC Second Opinion

(cc_review=skipped_dry_run)

## Affected Files

- TBD after human approval.

## Expected Benefit

Move the world closer to v0.1: yesterday emotionally matters, without optimizing only for eval score.

## Risks

- Overfitting to insufficient samples.
- Damaging character identity or emotional distinctiveness.
- Increasing DB writes or provider usage.
- Making the world more optimized but less human.

## Rollback Plan

- Revert the approved patch only.
- Re-run `npm run underworld:observe` and compare against the previous report.
- If runtime state was affected, stop and ask Alan before cleanup.

## Report Excerpt

```md
# Underworld v0.1 Approach Report

Generated: 2026-05-29T03:01:47.360Z
Mode: observe_once
Chicago time: 2026-05-28 22:01:30 America/Chicago
Night quiet: yes
Winding-down quiet: yes

## v0.1 Question

> Does Alan return and feel: "Yesterday mattered. Today they are not exactly the same."

## Summary

- Fresh triad samples: 0
- Soul PASS/WARN/FAIL: 0/0/0
- Recent PASS/WARN/FAIL: 0/0/0
- Top failure category: sample_pending
- Observed issue: none
- Repair class: observe_only
- Rubric disagreement: no
- Recent failure reason: -
- Provider health: not_checked_night_quiet
- Model policy env: ok
- Runtime health: ok
- World engine status: running
- Active fallback pollution count: 236
- Archived fallback history count: 248
- Fresh fallback markers: 0
- Stage-direction leak sum: 0.00
- Echo penalty sum: 0.00
- CC review: skipped_by_flag
- Code changed: no
- Next safest action: wait for more fresh samples; do not modify code
- AM→PM continuity: WARN / sample_pending
- Fresh-window life signals: WARN / sample_pending
- Day-window life signals: WARN / prop_echo_repeated
- Day-window life conversations: 14
- Day-window ordinary scenes: 4
- Day-window daily rhythm: 11
- Day-window soul style: 9

## v0.1 Scores

- stability_score: 0.57
- conversation_naturalness_score: 0.55
- soul_continuity_score: 0.35
- behavior_drift_score: 0.30
- relationship_chemistry_score: 0.35
- atmosphere_score: 0.40
- player_loop_clarity_score: 0.72

## Strongest Recent Moment

No fresh moment available yet.

## Weakest Recent Failure

Fresh sample count is below 3; insufficient evidence for repair.

## Fresh Transcripts

No fresh triad transcript in this observe pass.

## Health Checks

- worldClock: ok
- debugState: ok
- defaultWorldStatus: ok
- worldEngineStatus: running
- playerCount: 6
- fallback audit: ok

## Fallback Pollution

- active_total: 236
- memories: 48
- world_events: 174
- notifications: 12
- polluted_profiles: 2
- archived_history_retained: 248
- cleanup_report: umi/reports/fallback-pollution-cleanup-latest.md
- cleanup_proposal: umi/proposals/20260529T030000Z-fallback-pollution-cleanup-proposal.md
- policy: proposal-only; do not apply cleanup without Alan approval and fresh-sample evidence.

## Model Policy Env

- ready: yes
- AUTONOMOUS_CONVERSATION_LLM: false
- AUTONOMOUS_CONVERSATION_LLM_PAIRS: Umi:Mahiru,Umi:Tianze,Mahiru:Tianze
- CHARACTER_SOUL_LOCAL_FALLBACK: false
- LLM_PROVIDER: ollama
- OLLAMA_MODEL: qwen2.5:1.5b
- UMI_MAHIRU_PILOT_DAILY_QUOTA: 8
- UMI_MAHIRU_PILOT_PROVIDER: qwen

## Collection

- attempted: no
- dry_run: no
- world_engine_before_collection: running
- world_engine_resumed_before_collection: no
- attempts: none

## Eval Commands

- npm run eval:soul-triad -- --since-created-at=1780023690977: exit 0
- npm run eval:conversation:recent -- --since-created-at=1780023690977: exit 0
- npm run underworld:am-pm-continuity: exit 0
- npm run underworld:life-signals -- --since-created-at=1780023690977: exit 0
- npm run underworld:life-signals: exit 0

## CC Review

(cc_review=skipped_by_flag)

## Repair Gate Recommendation

Observe only. Do not modify code.

## AM→PM Continuity

- status: WARN
- decision: sample_pending
- morning samples: 0
- afternoon samples: 0
- AM residue candidates: 0
- PM callbacks found: 0
- next safest action: Keep the world running during the morning window; do not repair prompts.

```md
# Underworld AM -> PM Continuity Report

Generated: 2026-05-29T03:01:42.708Z
Target date: 2026-05-28
Timezone: America/Chicago
Windows: morning 06:00-11:59, afternoon 13:00-16:59
Query mode: time-window range
Morning UTC range: 2026-05-28T11:00:00.000Z -> 2026-05-28T17:00:00.000Z
Afternoon UTC range: 2026-05-28T18:00:00.000Z -> 2026-05-28T22:00:00.000Z

## Summary

- Status: WARN
- PASS/WARN/FAIL: 0 / 1 / 0
- Decision: sample_pending
- Reason: No morning archived conversations in the target window.
- Morning sample count: 0
- Afternoon sample count: 0
- AM residue candidates: 0
- PM callbacks found: 0
- Best continuity moment: 尚未找到 afternoon callback。
- Next safest action: Keep the world running during the morning window; do not repair prompts.
- Convex checkedAt: 2026-05-29T03:01:42.651Z
- Today conversations seen in query: 0


## AM Residue Candidates

No AM residue candidates found.

## PM Callbacks Found

No PM callbacks found.

## Worst 3 Failures

- No morning archived conversations were available for the target window.

## Morning Transcript Snippets

No conversations in this bucket.

## Afternoon Transcript Snippets

No conversations in this bucket.

## Policy

- Observe-only report. This script did not trigger conversations or write to Convex.
- If afternoon samples are fewer than 3, do not repair prompt or runtime behavior.
- Large continuity or memory changes remain proposal-only.

```

## Life Signals

Fresh-window life-signal evidence is used for repair-gate safety. It only counts conversations archived after this observe run began.

- status: WARN
- decision: sample_pending
- conve
```


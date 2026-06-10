# Underworld v0.1 Approach Proposal

Created: 2026-05-25T22:21:29.190Z
Category: eval_rubric_disagreement
Confidence: low_sample_warning

## Evidence

- Fresh triad samples: 1
- Soul PASS/WARN/FAIL: 1/0/0
- Recent PASS/WARN/FAIL: 0/0/2
- Top failure category: eval_rubric_disagreement
- Observed issue: eval_rubric_disagreement
- Repair class: proposal_only
- Rubric disagreement: yes
- Recent failure reason: characterVoiceScore: matched 0/3 character voice cue(s)
- Provider health: not_checked
- Runtime health: ok
- Fallback pollution count: 24
- Fresh fallback markers: 0
- Stage-direction leak sum: 0.00
- Echo penalty sum: 0.00
- CC review: skipped_by_flag
- Code changed: no
- Next safest action: reconcile eval framing before changing dialogue code

Soul eval and recent eval disagree on the fresh sample; recent reason: characterVoiceScore: matched 0/3 character voice cue(s).

## CC Second Opinion

## Judgment

**Classification (`proposal_only`) is correct but the framing under-describes the risk.** The two evals disagree on the *same* conversation (`39026`), which is exactly the case the gate is designed to escalate. However, the report blends two distinct signals and that blending is itself overclaiming.

## Two signals, not one

Looking at the post-fix failures separately:

- **`39026` (3 messages)** — Soul=0.99, Recent=0.78. The recent reason `repetitionScore: output repeats input verbatim` is *false on inspection* — there is phrase callback (`眼神`→`眼神`, `聲響`→`聲響`) but no verbatim line. This is **rubric over-fit on short transcripts**, not a dialogue regression. Recent eval is the one wrong here.
- **`38982` (6 messages)** — quoted line `「我來排」` is repeated verbatim across speakers, and `誰都不扛` is echoed back. This is a **real intra-conversation echo**, not a rubric artifact. Soul eval didn't score this one in the fresh batch.

So the rubric-disagreement label fits `39026` but **masks an actual echo regression in `38982`**. Calling the whole batch "rubric disagreement, proposal-only" is too aggressive at hiding the second signal.

## Overclaiming / sample concerns

- Fresh triad N=1 with Soul=0.99 on a 3-message exchange is **not credible as a PASS**. Subscale densities (0.50 across most axes) are noise at that length. The `confidence: low_sample_warning` is right; the headline `PASS 1/0/0` should not be trusted.
- `Fallback pollution count: 24` vs `Fresh fallback markers: 0` — repair gate is correctly distinguishing legacy from fresh; good. Don't let the 24 inflate the narrative.
- "Strongest recent moment" and "Weakest recent failure" are pulled from the *same* conversation. With N=1 that's tautological; worth noting in the report template but not a code issue.

## Narrowest safe actions (no dialogue code change)

Two small, targeted, eval-only fixes are plausible and safer than a full proposal:

1. **Recent eval `repetitionScore`**: gate the "verbatim" check on a minimum substring length (≥6 chars or ≥3 tokens) or require a contiguous match, not phrase callback. Verify by re-scoring `39026` (should drop the reason) and `38982` (must still flag `「我來排」` repetition).
2. **Recent eval `characterVoiceScore`**: `matched 0/3` on `39026`'s 真晝 line that reads in-voice ("阿海，你剛把筆電合上時那聲輕響...") suggests the cue list is stale or too literal. Either widen cues or stop counting voice-match on lines under N chars. Verify by hand-labeling 5–10 recent 真晝 / 海 / 天澤 lines and checking precision/recall of the cue list.

These belong in the eval files, not in `convex/agent/conversation.ts` or model policy. The dialogue-code question for `38982`-style echo stays **proposal-only** until N ≥ ~10 fresh samples.

## What I'd push back on in the report

- "Repair class: proposal_only" is fine; "Next safest action: reconcile eval framing before changing dialogue code" is correct **but should add**: *and verify `38982`'s echo still FAILs under the reconciled rubric — do not let rubric-tightening accidentally green-light real regressions.*
- "Top failure category: eval_rubric_disagreement" should be qualified: "for `39026`; `38982` is a candidate intra-conversation echo regression awaiting more samples."

## Bottom line

Keep `proposal_only`. Allow narrow eval-rubric edits as a small fix (not dialogue code). Do not let the rubric-disagreement framing suppress the genuine echo signal in `38982`. Re-run after the rubric tweak with ≥5 fresh triad samples before any conversation-code change.

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

Generated: 2026-05-25T22:14:32.336Z
Mode: observe_once
Chicago time: 2026-05-25 17:14:24 America/Chicago
Night quiet: no

## v0.1 Question

> Does Alan return and feel: "Yesterday mattered. Today they are not exactly the same."

## Summary

- Fresh triad samples: 1
- Soul PASS/WARN/FAIL: 1/0/0
- Recent PASS/WARN/FAIL: 0/0/2
- Top failure category: eval_rubric_disagreement
- Observed issue: eval_rubric_disagreement
- Repair class: proposal_only
- Rubric disagreement: yes
- Recent failure reason: characterVoiceScore: matched 0/3 character voice cue(s)
- Provider health: not_checked
- Runtime health: ok
- Fallback pollution count: 24
- Fresh fallback markers: 0
- Stage-direction leak sum: 0.00
- Echo penalty sum: 0.00
- CC review: skipped_by_flag
- Code changed: no
- Next safest action: reconcile eval framing before changing dialogue code

## v0.1 Scores

- stability_score: 0.57
- conversation_naturalness_score: 0.72
- soul_continuity_score: 0.50
- behavior_drift_score: 0.72
- relationship_chemistry_score: 0.50
- atmosphere_score: 0.72
- player_loop_clarity_score: 0.72

## Strongest Recent Moment

- **海**: 你剛才去確認學生狀態時，有沒有誰的眼神讓你突然停下來？

## Weakest Recent Failure

Soul eval and recent eval disagree on the fresh sample; recent reason: characterVoiceScore: matched 0/3 character voice cue(s).

## Fresh Transcripts

### conversation-c:39026

Participants: 海 / 真晝

- **海**: 你剛才去確認學生狀態時，有沒有誰的眼神讓你突然停下來？
- **真晝**: 阿海，你剛把筆電合上時那聲輕響，比任何眼神都讓我更想陪你坐一會兒。
- **海**: 那聲響讓我想起昨晚你沒說出口的累，今晚我們就只把這份安靜留下來。


## Health Checks

- worldClock: ok
- debugState: ok
- playerCount: 6
- fallback audit: ok

## Collection

- attempted: no
- dry_run: no
- attempts: none

## Eval Commands

- npm run eval:soul-triad -- --since-created-at=1779747003126: exit 0
- npm run eval:conversation:recent -- --since-last-change: exit 0

## CC Review

(cc_review=skipped_by_flag)

## Repair Gate Recommendation

Do not auto-fix eval_rubric_disagreement. Create a proposal under umi/proposals/.

## Soul Eval Excerpt

```md
# Soul Triad Conversation Harness

Generated: 2026-05-25T22:14:28.821Z

| Conversation | Participants | Messages | Status | Score | Other aware | Private self | Memory residue | Behavior | Tianze action | Umi Alan anchor | Expression unique | Comfort unique | Burden unique | Human aftertaste | Echo similarity penalty | Role penalty | System penalty | Template penalty | Stage direction leak penalty | Echo penalty |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
conversation-c:39026 | 海 / 真晝 | 3 | PASS | 0.99 | 0.50 | 0.00 | 0.50 | 1.00 | 0.50 | 1.00 | 0.75 | 0.50 | 0.50 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00

## conversation-c:39026

- **海**: 你剛才去確認學生狀態時，有沒有誰的眼神讓你突然停下來？
- **真晝**: 阿海，你剛把筆電合上時那聲輕響，比任何眼神都讓我更想陪你坐一會兒。
- **海**: 那聲響讓我想起昨晚你沒說出口的累，今晚我們就只把這份安靜留下來。


```

## Recent Eval Excerpt

```md
# Underworld Recent Conversation Eval

Generated: 2026-05-25T22:14:31.059Z

Mode: post-fix since latest conversation/density code change
Post-fix boundary: 2026-05-25T21:16:35.363Z

Post-fix conversations checked: 2

Post-fix summary: 0 PASS / 0 WARN / 2 FAIL

Historical archived quality (legacy_noise): 0 PASS / 0 WARN / 0 FAIL

Status: WAITING_FOR_NEW_CONVERSATIONS. Do not treat old archived failures as proof that the anti-repeat selector failed.

## Post-Fix Worst 5 Examples

### conversation-c:39026 - FAIL (0.78)

Participants: 海 / 真晝

Suggested fix category: add intra-conversation response move diversity

Reasons:
- characterVoiceScore: matched 0/3 character voice cue(s)
- emotionalSpecificityScore: found 1 emotional cue(s)
- repetitionScore: output repeats input verbatim

Excerpt:
> 5/25 下午5:11 海: 你剛才去確認學生狀態時，有沒有誰的眼神讓你突然停下來？
> 5/25 下午5:11 真晝: 阿海，你剛把筆電合上時那聲輕響，比任何眼神都讓我更想陪你坐一會兒。
> 5/25 下午5:11 海: 那聲響讓我想起昨晚你沒說出口的累，今晚我們就只把這份安靜留下來。

### conversation-c:38982 - FAIL (0.78)

Participants: 真晝 / 天澤

Suggested fix category: add intra-conversation response move diversity

Reasons:
- characterVoiceScore: matched 0/3 character voice cue(s)
- emotionalSpecificityScore: found 1 emotional cue(s)
- repetitionScore: output repeats input verbatim

Excerpt:
> 5/25 下午4:55 真晝: 筆停久了，手其實也酸了，那我們把 Alan 的急事先放一放，你現在想不想喝點溫的？
> 5/25 下午4:55 天澤: 你手酸了，那這杯溫的我先替你接過去，你趁機把肩膀鬆一鬆。
> 5/25 下午4:55 真晝: 肩膀鬆開了，那杯溫的我先替你收著，你不用急著說「我來排」。
> 5/25 下午4:55 天澤: 你不用急著說「我來排」，那這件先放半小時，我們誰都不扛。
> 5/25 下午4:55 真晝: 誰都不扛的時候，你手裡的筆終於沒再發抖了吧？
> 5/25 下午5:06 天澤: 筆放在桌上，半小時後再回來整理清單。


## Historical Archived Quality

These are labeled `legacy_noise` because they were created before the latest watched conversation-code modification. They are useful context, not proof of current failure.


## Post-Fix Results

| Conversation | Participants | Cohort | Status | Score | Failure category | Top reasons |
|---|---|---|---:|---:|---|---|
| conversation-c:39026 | 海 / 真晝 | post_fix | FAIL | 0.78 | repeated fallback | characterVoiceScore: matched 0/3 character voice cue(s)<br>emotionalSpecificityScore: found 1 emotional cue(s)<br>repe
```


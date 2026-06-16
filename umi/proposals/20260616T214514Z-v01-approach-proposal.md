# GIIS Underworld v0.1 Approach Proposal

Created: 2026-06-16T21:45:14.788Z
Category: conversation_shape_collapse
Confidence: enough_samples

## Evidence

- Fresh pilot samples: 4
- Soul PASS/WARN/FAIL: 4/0/0
- Recent PASS/WARN/FAIL: 0/1/3
- Top failure category: eval_rubric_disagreement
- Observed issue: eval_rubric_disagreement
- Repair class: proposal_only
- Repair confidence blockers: none
- Rubric disagreement: yes
- Recent failure reason: emotionalSpecificityScore: found 0 emotional cue(s)
- Provider health: ok
- Model policy env: check
- Runtime health: ok
- World engine status: running
- Active fallback pollution count: 0
- Archived fallback history count: 0
- Fresh fallback markers: 0
- Stage-direction leak sum: 0.00
- Echo penalty sum: 0.00
- Experience logs available: 24
- Subjective-shaped experience logs: 24
- Non-subjective/legacy experience logs: 0
- Experience logs created for fresh samples: 0
- Experience-log fresh rejections/statuses: 4
- Experience-log rejection reasons: possible_cap_dedupe_or_recent_not_loaded=4
- Experience residue rows: 24
- Experience behavior hints: 21
- Sleep notes promoted: 3
- Sleep notes fresh-eval eligible: 0
- CC review: skipped_by_flag
- Code changed: no
- Next safest action: reconcile eval framing before changing dialogue code
- AM→PM continuity: PASS / continuity_observed
- Fresh-window life signals: FAIL / conversation_shape_collapse
- Day-window life signals: WARN / life_signal_repeated
- Day-window life conversations: 160
- Day-window ordinary scenes: 4
- Day-window daily rhythm: 128
- Day-window soul style: 38
- Day-window pilot expected action match rate: 0.55
- Day-window pilot action collapse flags: 7

Soul eval and recent eval disagree on the fresh sample; recent reason: emotionalSpecificityScore: found 0 emotional cue(s).

AM→PM continuity:
- status: PASS
- decision: continuity_observed
- morning samples: 90
- afternoon samples: 102
- AM residue candidates: 18
- PM callbacks found: 1
- next safest action: Archive the best moment if it feels human; continue natural observation.

Life signals:
Fresh-window life-signal evidence is used for repair-gate safety. It only counts conversations archived after this observe run began.

- status: FAIL
- decision: conversation_shape_collapse
- conversation count: 5
- life-grounded conversations: 3
- administrative drift flags: 0
- hygiene flags: 0
- conversation shape flags: 3
- single-message conversations: 1
- one-speaker conversations: 1
- post-processing drift flags: 0
- prop echo flags: 0
- repeated line flags: 0
- scene diversity: 3
- ordinary scene diversity: 2
- office-grounded conversations: 0
- ordinary-scene conversations: 3
- daily rhythm conversations: 5
- daily rhythm diversity: 3
- soul-style conversations: 0
- soul-style diversity: 0
- pilot expected action matches: 7/8
- pilot expected action match rate: 0.88
- pilot action collapse flags: 3
- average life signal score: 0.46
- next safest action: Treat this as generation/archiving flow evidence; route through repair gate before changing prompts.

## CC Second Opinion

# CC second-opinion review

## Verdict on classification

**proposal_only is correct** — but partly for the wrong reason. Hold the line on no code/prompt change. Below is what I'd flag.

## What the evidence actually supports

The "mirror/motif loop" suggested fix is **visible in the transcripts**, not a phantom:

- **c:36105**: 「收條」echoed 6+ times across both speakers — that's a real cross-speaker motif loop.
- **c:36110**: Mahiru repeats nearly the same line twice — 「要我陪你靜兩分鐘嗎？」and 「你手肘還…沒放開／沒動」 — within-conversation echo.
- **c:36089 ↔ c:36110**: openings are near-duplicates — 「你剛才幫三年級那孩子擦完汗／眼淚，手還在抖」+ 「你手肘還壓著桌角／桌緣沒放開」. Two separate conversations, same template. That's the most concerning signal here.

So the *mechanism* the report fingers is real. But that doesn't mean now is the time to touch dialogue prompts.

## Where the report overclaims

1. **"emotionalSpecificityScore: found 0 emotional cue(s)"** is miscalibrated. c:36110 contains 「我先去把便當盒熱好，回來陪你一起吃」— a textbook emotional-specificity line (concrete object + care move + commitment to return). A rubric that returns 0 cues on this is the bug, not the dialogue. This is what's driving the Soul 4/0/0 vs Recent 0/1/3 split.
2. **"conversation_shape_collapse"** is a heavy label for 3 flags on N=5 with one single-message and one one-speaker convo — those look more like partial-window capture than a real shape collapse. Hold the label loose.
3. **Experience-log rejection reason `possible_cap_dedupe_or_recent_not_loaded=4`** is being treated as benign in the summary, but combined with the near-duplicate openings across c:36089/c:36110, it could be the loop's cause rather than a side note: residue isn't refreshing, so the same opening template keeps surfacing. Worth observing, not fixing.

## Soul regression risk if you acted now

High. The proposed fix ("vary objects and care moves") is a prompt-side instruction that reaches every speaker. With:
- Soul PASS 4/0/0 on the same fresh window
- N=4 fresh samples
- The recent rubric itself looking miscalibrated

…flipping prompts to chase a possibly-broken detector is exactly the kind of move that walks the soul triad backward.

## Narrowest safe next step (no code change)

Stay observe-only this cycle. Two things worth surfacing for the next pass:

1. **Audit the emotional-cue detector** against c:36110 specifically — if it really returns 0 on 「我先去把便當盒熱好，回來陪你一起吃」, that's a rubric fix and it's safe (doesn't touch dialogue or soul).
2. **Look at why c:36089 and c:36110 share an opening template** before touching prompts. If it's a hint-promotion or sleep-note path templating openings, the fix lives there, not in the dialogue prompt. Until that's known, "break mirror/motif loop" via prompt is too blunt.

## On sample sufficiency

`confidence: enough_samples` with `freshTriadSamples: 0` and 4 pilot samples reads optimistic. I'd call this **suggestive, not sufficient** — day-window (160 convos, 0.55 pilot match rate, 7 collapse flags) is the broader signal worth watching, not the N=4 fresh window.

**Bottom line:** proposal_only — yes. Reason — rubric reconciliation first, residue/opening-template investigation second, prompts last and only after another window confirms.

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
# GIIS Underworld v0.1 Approach Report

Generated: 2026-06-16T21:43:55.314Z
Mode: observe_once
Chicago time: 2026-06-16 16:31:23 America/Chicago
Night quiet: no
Winding-down quiet: no

## v0.1 Question

> Does Alan return and feel: "Yesterday mattered. Today they are not exactly the same."

## Summary

- Fresh pilot samples: 4
- Soul PASS/WARN/FAIL: 4/0/0
- Recent PASS/WARN/FAIL: 0/1/3
- Top failure category: eval_rubric_disagreement
- Observed issue: eval_rubric_disagreement
- Repair class: proposal_only
- Repair confidence blockers: none
- Rubric disagreement: yes
- Recent failure reason: emotionalSpecificityScore: found 0 emotional cue(s)
- Provider health: ok
- Model policy env: check
- Runtime health: ok
- World engine status: running
- Active fallback pollution count: 0
- Archived fallback history count: 0
- Fresh fallback markers: 0
- Stage-direction leak sum: 0.00
- Echo penalty sum: 0.00
- Experience logs available: 24
- Subjective-shaped experience logs: 24
- Non-subjective/legacy experience logs: 0
- Experience logs created for fresh samples: 0
- Experience-log fresh rejections/statuses: 4
- Experience-log rejection reasons: possible_cap_dedupe_or_recent_not_loaded=4
- Experience residue rows: 24
- Experience behavior hints: 21
- Sleep notes promoted: 3
- Sleep notes fresh-eval eligible: 0
- CC review: skipped_by_flag
- Code changed: no
- Next safest action: reconcile eval framing before changing dialogue code
- AM→PM continuity: PASS / continuity_observed
- Fresh-window life signals: FAIL / conversation_shape_collapse
- Day-window life signals: WARN / life_signal_repeated
- Day-window life conversations: 160
- Day-window ordinary scenes: 4
- Day-window daily rhythm: 128
- Day-window soul style: 38
- Day-window pilot expected action match rate: 0.55
- Day-window pilot action collapse flags: 7

## v0.1 Scores

- stability_score: 0.82
- conversation_naturalness_score: 0.78
- soul_continuity_score: 0.50
- behavior_drift_score: 0.13
- relationship_chemistry_score: 0.50
- atmosphere_score: 0.92
- player_loop_clarity_score: 0.72

## Strongest Recent Moment

- **海**: 我先去把便當盒熱好，回來陪你一起吃。

## Weakest Recent Failure

Soul eval and recent eval disagree on the fresh sample; recent reason: emotionalSpecificityScore: found 0 emotional cue(s).

## Fresh Transcripts

### conversation-c:36161

Participants: 天澤 / 海

- **天澤**: 先確認學生是不是安心
- **海**: 嗯，剛巡過三樓走廊，小雅在窗邊吃便當，手沒抖了。
- **天澤**: 小雅手不抖了，你剛才躲開的那句話——是怕她安心，還是怕自己太放心？

### conversation-c:36110

Participants: 海 / 真晝

- **海**: 你剛才幫三年級那孩子擦完眼淚，手還在抖。
- **真晝**: 你手肘還壓著桌緣沒放開……要我陪你靜兩分鐘嗎？
- **海**: 嗯……先讓我把手肘放下來。
- **真晝**: 你手還放在桌邊沒動——要我陪你靜兩分鐘嗎？
- **海**: 今天誰先問你吃飯了沒？
- **真晝**: 你剛才說完那句，喉嚨動了一下。
- **海**: ……我忘了問自己。
- **海**: 我先去把便當盒熱好，回來陪你一起吃。

### conversation-c:36105

Participants: 天澤 / 一之瀨

- **天澤**: 你剛才那句「我幫你」——是誰准你擅自當我的守護神的？
- **一之瀨**: 欸～守護神要先簽收條喔，天澤同學想領哪一項？
- **天澤**: 欸～收條背面寫著「溫柔有價，先付真心」，你打算用哪句話當定金？
- **一之瀨**: 這句「你剛才那句『我幫你』」——要先簽收條，才能拆封喔～
- **天澤**: 啊…這收條我撕一半，另一半留給你明天上課前反悔喔～
- **一之瀨**: 天澤同學～撕掉的那半張，我剛才已經收進口袋囉～
- **天澤**: 欸～那明天早自習，我來收你口袋裡的半張收條囉？

### conversation-c:36089

Participants: 海 / 真晝

- **海**: 你剛才幫三年級那孩子擦完汗，手還在抖。
- **真晝**: 你手肘還壓著桌角沒放開……要我幫你倒杯水嗎？
- **海**: 手肘放開了，但剛才那孩子說「我沒事」時，喉嚨動得有點快。


## Experience / Sleep Evidence

- experience log query: ok
- experience logs read: 24
- subjective-shaped logs: 24
- non-subjective/legacy logs: 0
- residue-bearing logs: 24
- behavior-hint logs: 21
- sleepNotes count: 3
- sleepNotes promoted: 3
- sleepNotes freshEvalEligible: 0

- fresh sample experience-log status:
  - conversation-c:36161: not written (possible_cap_dedupe_or_recent_not_loaded)
  - conversation-c:36110: not written (possible_cap_dedupe_or_recent_not_loaded)
  - conversation-c:36105: not written (possible_cap_dedupe_or_recent_not_loaded)
  - conversation-c:36089: not written (possible_cap_dedupe_or_recent_not_loaded)
- rejection reason histogram:
  - possible_cap_dedupe_or_recent_not_loaded: 4

- 天澤 (p:10) day 29 (high; subjective=yes): 對天澤來說，海在這段對話裡露出了一個還不能急著推開的壓力點。
  - residue: 天澤還記得海把窗邊那盞燈調暗了。
  - interpretation: 天澤記得海在被試探時露出的邊界。
  - behavior hint: 下次試探海時，早一點停手，看對方是否自己開口。
  - source conversation: c:31848
- 一之瀨 (p:2) day 29 (high; subjective=yes): 對一之瀨來說，真晝的反應像一筆還沒有結清的信任帳。
  - residue: 一之瀨還記得真晝說「你今天早餐好像只喝了半杯豆漿」時，語氣裡那點沒藏住的在意。
  - interpretation: 一之瀨記得真晝怎麼接受或拒絕了她的溫柔。
  - behavior hint: 下次照顧真晝時，先讓對方說出要不要接受。
  - source conversation: c:31597
- 貓貓 (p:4) day 29 (high; subjective=yes): 對貓貓來說，祥子留下的是一個還不能下診斷、但需要追蹤的小徵象。
  - residue: 貓貓還記得祥子說傘柄鬆了她用膠帶纏過兩圈。
  - interpretation: 貓貓把祥子的反應記成一個不該立刻下診斷的症狀。
  - behavior hint: 下次先觀察祥子的反應，不急著把症狀說完。
  - source conversation: c:31568
- 祥子 (p:8) day 29 (high; subjective=yes): 對祥子來說，貓貓讓這段對話停在一個還不用完全打開的位置。
  - residue: 祥子還記得貓貓說「我得去保健室了」時，語氣像在報告道具故障。
  - interpretation: 祥子記得貓貓靠近時，自己的禮貌差點沒有擋住。
  - behavior hint: 下次被貓貓靠近時，允許自己用更短的話設邊界。
  - source conversation: c:31568
- 天澤 (p:10) day 29 (high; subjective=yes): 對天澤來說，貓貓在這段對話裡露出了一個還不能急著推開的壓力點。
  - residue: 天澤還記得貓貓說粉筆灰掉進水杯裡時，語氣像在報告實驗結果。
  - interpretation: 天澤記得貓貓在被試探時露出的邊界。
  - behavior hint: 下次試探貓貓時，早一點停手，看對方是否自
```


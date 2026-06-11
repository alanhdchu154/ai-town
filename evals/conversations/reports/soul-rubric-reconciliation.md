# Soul Rubric Reconciliation

Created: 2026-05-25

## Context

The first semi-autonomous Soul QA loop produced three fresh Umi / Tianze samples:

- `conversation-c:38904`
- `conversation-c:38895`
- `conversation-c:38883`

After the short-sample guard fix, `eval:soul-triad` reports:

```text
PASS 0.96 conversation-c:38904 messages=4 participants=海/天澤
FAIL 0.55 conversation-c:38895 messages=2 participants=海/天澤
FAIL 0.36 conversation-c:38883 messages=2 participants=海/天澤
```

At the same time, `eval:conversation:recent -- --since-last-change` reports all
three as FAIL, with the top reason:

```text
characterVoiceScore: matched 0/3 character voice cue(s)
fix: add intra-conversation response move diversity
```

CC review classified this as a rubric disagreement with a real quality gap
underneath, not as a reason to fine-tune or rewrite prompts.

## Current Verdict

The mismatch is not a single bug.

It is a split between two evaluation purposes:

- `eval:soul-triad` measures pilot soul signals: other awareness, private self,
  memory residue, behavior signal, Tianze action, Umi/Alan anchor,
  differentiation, aftertaste, and echo/template penalties.
- `eval:conversation:recent` measures broader conversation hygiene:
  character-specific voice cues, response move diversity, emotional
  specificity, repetition, wrong addressee, and scene grounding.

Both are useful.

Neither should be treated as the single truth yet.

## How To Read Results

### PASS in soul-triad + FAIL in recent conversation

Interpret as:

> Promising soul signal, but not golden quality.

Likely meaning:

- the characters care in a plausible direction
- the conversation has some emotional residue or behavior signal
- but voice/move diversity, rhythm, or character specificity is still weak

Action:

- Do not promote to final golden.
- Keep as provisional candidate only.
- Do not fine-tune.
- Inspect which metric is missing and whether the missing dimension is real.

### FAIL in soul-triad + PASS in recent conversation

Interpret as:

> Clean conversation mechanics, but weak Underworld soul.

Likely meaning:

- no obvious template leak or wrong addressee
- but little emotional continuity, aftertaste, behavioral signal, or relational
  specificity

Action:

- Do not use as soul training/reference data.
- Keep as ordinary conversation hygiene success only.

### PASS in both

Interpret as:

> Golden candidate.

Still requires human review before becoming a stable taste reference.

Action:

- Archive under `evals/conversations/golden/`.
- Annotate why it worked.
- Identify which soul layer appeared.
- Identify what changed or was revealed.

## Status Of conversation-c:38904

`conversation-c:38904` should be demoted from golden to provisional golden.

Why:

- `eval:soul-triad` gives it strong pilot-soul score.
- `eval:conversation:recent` flags weak character voice / response move
  diversity.
- The transcript has a plausible Umi / Tianze burden-sharing direction, but the
  action vocabulary is narrow:
  - files
  - split burden
  - do not carry alone
  - drink water
- Tianze and Umi still echo each other's burden-sharing moves too closely.

It is useful as evidence, not yet as a taste anchor.

## Next Small Safe Action

Do not fine-tune.

Do not rewrite all prompts.

Do not add new schema.

Next smallest safe harness action:

> Add an explicit "provisional golden" status and require both soul-triad and
> recent-conversation eval alignment before a sample is treated as a true golden
> reference.

This can be done in reports/archive policy before touching generation.

## Open Harness Questions

- Should `eval:soul-triad` include a response-move diversity metric, or should
  that remain owned by `eval:conversation:recent`?
- Should `characterVoiceScore` be updated for Umi / Tianze soul-pilot language,
  or is it correctly catching that the current samples sound too similar?
- Should golden archive entries include a required field:
  `status: provisional | accepted | rejected`?

## Current Rule

Until the rubric conflict is resolved:

> A sample that passes only one harness is not golden. It is evidence.

---

## 2026-06-10 Adjudication (fresh morning triad, c:94448 / c:94473 / c:94513)

Adjudicated by Claude (product-owner-directed review) against the 2026-06-10
10:35 CDT fresh samples, where soul-triad reports 2 PASS / 1 FAIL and recent
eval reports 0 PASS / 3 FAIL (`eval_rubric_disagreement`).

### Verdict: the disagreement is NOT an eval bug. Both harnesses are correct.

This is the documented "PASS in soul-triad + FAIL in recent" case: promising
soul signal, not golden quality. Specifically:

1. **soul-triad is right that differentiation improved.** c:94473 (真晝/天澤)
   shows real role pressure (天澤 probing, 真晝 anchoring) and a genuine
   lifecycle close. c:94448 shows 海 doing concrete coordinator moves
   (壓簡報、調開巡邏時間) distinct from 真晝's pacing moves.
2. **recent eval is right that a cross-speaker motif loop persists.** The
   evidence, across all fresh samples:
   - "X涼了" motif 3x across two conversations: 湯匙都涼了 (c:94473), 茶都涼了
     (c:94448), 湯涼了 (c:94473 close);
   - "先別推 / 別再推 / 先停" care-shape repeated by both 真晝 and 海;
   - object loops: 簡報 x3, 那扇門 x4 (c:94448); 你手在抖 x2 (c:94473);
   - 真晝 opens both conversations with the identical move shape:
     notice-cold-drink → tell-them-to-pause.

   This is the same care-shape/prop-echo collapse recorded on 2026-05-31
   life-signal diagnostics. It has now recurred across ≥3 fresh samples, which
   crosses the project's own 3-sample threshold: **it is actionable as one
   targeted dialogue fix** (cross-conversation motif suppression for the
   cold-drink/stop-pushing family), not a rubric problem.

3. **c:94513 is a timeout artifact, not evidence.** It is a 1-message *active*
   conversation left behind by the third focused-sample timeout. Both harnesses
   should treat in-flight active conversations as no-data rather than FAIL
   rows. Until that is changed in code (proposal-only), human readers should
   exclude it manually from fresh-sample counts.

### What was changed in code (small, labeling only)

`runRecentConversationEval.ts` failure-category mapping: when the binding score
was reduced by mirror repetition (binding cues actually 3/3), the category is
now `mirror/motif repetition across speakers` instead of the misleading
`not responding to previous speaker`, and the suggested fix is
`break cross-speaker mirror/motif loop`. No thresholds or scores were changed.

### What was NOT changed (proposals, need owner sign-off)

- Excluding 1-message active conversations from fresh-sample eval counts.
- Harmonizing `event_thread_continuity` to PENDING (not FAIL) when
  life-signals are `sample_pending`, matching how `memory_continuity` is
  treated in `underworld-v01-completion-audit.mjs`.
- The one targeted dialogue fix above (motif-family suppression across
  conversations), now evidence-eligible per the 3-sample rule.

### Standing rule unchanged

> A sample that passes only one harness is not golden. It is evidence.

# Soul Rubric Reconciliation

Created: 2026-05-25

## Context

The first semi-autonomous Soul QA loop produced three fresh Umi / Asuna samples:

- `conversation-c:38904`
- `conversation-c:38895`
- `conversation-c:38883`

After the short-sample guard fix, `eval:soul-triad` reports:

```text
PASS 0.96 conversation-c:38904 messages=4 participants=海/明日奈
FAIL 0.55 conversation-c:38895 messages=2 participants=海/明日奈
FAIL 0.36 conversation-c:38883 messages=2 participants=海/明日奈
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
  memory residue, behavior signal, Asuna action, Umi/Alan anchor,
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
- The transcript has a plausible Umi / Asuna burden-sharing direction, but the
  action vocabulary is narrow:
  - files
  - split burden
  - do not carry alone
  - drink water
- Asuna and Umi still echo each other's burden-sharing moves too closely.

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
- Should `characterVoiceScore` be updated for Umi / Asuna soul-pilot language,
  or is it correctly catching that the current samples sound too similar?
- Should golden archive entries include a required field:
  `status: provisional | accepted | rejected`?

## Current Rule

Until the rubric conflict is resolved:

> A sample that passes only one harness is not golden. It is evidence.

# GIIS Underworld v0.1 Prop / Motif Lock Proposal

## Problem

The v0.1 continuity gate now proves the world can carry morning residue into
afternoon behavior, but the same afternoon evidence shows a new quality blocker:
Umi / Mahiru / Tianze conversations are getting trapped in a small prop bundle.

The dominant repeated surface is:

- cold tea / cups
- bento / meals
- checklists / reports / files
- window / hallway / empty chair
- "split it in half" responsibility moves

These are good ordinary-life materials in isolation. The problem is that they
repeat across too many conversations and start making the world feel scripted.

## Current Evidence

Generated from the 2026-05-31 afternoon continuity pass:

- `npm run underworld:observe -- --cc=skip --target-samples=0 --since-created-at=1780225944601`
- `npm run underworld:v01-goal-audit`
- `npm run underworld:rubric-reconcile`
- `npm run underworld:repair-gate`

Latest audit status:

- v0.1 audit: `FAIL`
- AM->PM continuity: `PASS / continuity_observed`
- Fresh triad samples: 24
- Fresh fallback markers: 0
- Runtime health: ok
- Active fallback pollution: 0
- Fresh-window life signals: `WARN / prop_echo_repeated`
- Recent conversation eval: 0 PASS / 3 WARN / 9 FAIL

Life-signal evidence:

- 152 day-window pilot conversations
- 143 life-grounded conversations
- 143 daily-rhythm conversations
- 78 soul-style conversations
- 39 prop echo flags
- 32 conversation-shape flags
- pilot expected action match rate 0.69
- pilot action collapse flags 42

Representative failures:

- `conversation-c:78920`: cold tea 3x, tea 6x, checklist 5x, window 3x.
- `conversation-c:78806`: bento 3x, chair 4x.
- `conversation-c:78474`: data/materials 7x.
- `conversation-c:78431`: checklist 4x.

Repair gate result:

- Category: `prop_echo_repeated`
- Classification: `proposal_only`
- Decision: `observe_only`
- Reason: this is a content-shape / soul-risk issue, not a safe auto-fix.

## Interpretation

The system is no longer failing at "nothing happens." It is failing at
"the same kind of small thing keeps happening."

That is progress, but not v0.1 complete. The world has rhythm and memory, but
the trio is overusing the same ordinary-life props to express care. This causes
two visible regressions:

- Umi, Mahiru, and Tianze converge on similar care moves.
- Conversations mirror the previous speaker too neatly instead of changing the
  emotional shape.

The `stage_direction_leak` top category in the approach report appears to be a
rubric misfire. The repair gate's second opinion correctly identifies the real
pattern as motif / prop lock-in.

## Proposed Fix

Use a narrow prop / motif diversification layer before touching broader soul
architecture.

Preferred implementation shape:

1. Add a small prop-recentness guard to conversation prompt inputs.
   - Track the last few concrete props used in the current dyad or recent
     conversation context.
   - Tell the prompt to avoid reusing a prop after it appears twice recently.
   - Keep this as guidance, not a hard banned-word list.

2. Rotate ordinary-life seed families by scene and character.
   - Umi: overload reduction can use calendar, queue, tab, handoff, pause,
     one-sentence brief, or "not now" boundary, not always tea/checklist.
   - Mahiru: presence can use posture, missed lunch, lowered voice, silence,
     distance, eye contact, sitting nearby, or leaving space, not always cup/hand.
   - Tianze: responsibility can use owner, deadline, closure, refusal, delegating
     one task, stopping one task, or asking one person to take over, not always
     "split half."

3. Add a small response-move guard.
   - If the previous speaker proposed "split / carry / hand over," the next
     speaker should not mirror the same move unless the point is conflict.
   - Prefer one of: refuse, shorten, redirect, go quiet, accept only part,
     ask one concrete question, or end the exchange.

4. Keep memory schema unchanged.
   - No new relationship schema.
   - No major prompt rewrite.
   - No provider/model migration.
   - No DB cleanup.

## Acceptance Criteria

After the change, run:

```bash
npm run underworld:harness:self-test
npm run underworld:observe -- --cc=skip --target-samples=0 --since-created-at=<fresh-boundary-after-change>
npm run underworld:v01-goal-audit
npm run underworld:rubric-reconcile
```

Expected direction:

- AM->PM continuity remains `PASS / continuity_observed`.
- Fresh triad samples >= 3.
- Fresh fallback markers = 0.
- Stage-direction leak sum = 0.
- Fresh-window life signals are not `prop_echo_repeated`.
- Prop echo flags drop materially from the current 39/152 baseline.
- Pilot action collapse flags drop materially from the current 42 baseline.
- Recent conversation eval improves from 0 PASS / 3 WARN / 9 FAIL.

Suggested threshold for v0.1 review readiness:

- prop echo flags under 15% of fresh-window pilot conversations, or a clearly
  human-reviewed transcript set where repetition no longer feels scripted.
- no single repeated prop dominates a fresh transcript more than 3 times.

## Risks

- Too much anti-prop pressure could make dialogue abstract again.
- Hard bans could remove the ordinary-life texture that made AM->PM continuity
  work.
- Prompting every character to diversify could flatten them into a generic
  "avoid repetition" voice.
- If the repair is too broad, it may improve metrics while making the world feel
  less intimate.

## Rollback

- Revert the prop / motif guard.
- Re-run the observe + audit pair against a fresh boundary.
- If AM->PM continuity or character warmth drops, prefer the current repetition
  over a cleaner but colder world.

## Files Likely Touched

- `convex/agent/conversation.ts`
- optional focused tests under `convex/agent/` or `evals/conversations/metrics/`
- `WORKLOG.md`

## Decision Needed

Accepted by Alan on 2026-05-31. Implemented as a small v0.1 candidate in
`convex/agent/conversation.ts`, with tests in
`convex/agent/conversationMotifGuard.test.ts`.

Implementation stayed inside the approved scope:

- Added a prop/motif guard that looks at current conversation messages and
  recent same-pair residue.
- Added response-move guidance when the previous line already uses split,
  carry, handoff, or rest/care moves.
- Added character-specific action guidance:
  - Umi reduces overload through queue / not-now boundary / shorter brief.
  - Mahiru notices posture, voice, silence, distance, or eye contact.
  - Tianze changes concrete responsibility through owner, deadline, refusal, or
    handoff.
- Did not change memory schema, provider/model routing, DB cleanup, relationship
  schema, or broad soul architecture.

Post-change validation is pending because the first fresh sample run hit Qwen
provider quota failure before collecting any samples.

# GIIS Underworld v0.1 Roadmap

Last updated: 2026-06-04

This file is the current v0.1 contract. Historical shipped work belongs in git
history and reports, not in the active roadmap.

## Current Goal

Ship the smallest emotional-continuity loop that makes Underworld feel alive:

```text
conversation -> emotional residue -> memory continuity -> small behavioral consequence -> tomorrow feels different
```

## Active Scope

### 1. Character Soul Expression

- Umi should sound like Alan's coordinator and emotional load reducer.
- Mahiru should notice quiet pain without becoming a generic comfort bot.
- Tianze should pressure-test weak rules without becoming a checklist executor
  or cruelty engine.
- Focus runtime soul work on Umi / Mahiru / Tianze; Convex still addresses
  Tianze through the `Tianze` runtime key.

### 2. Conversation To Emotional Residue

- Meaningful conversations should leave a small human-readable trace.
- Do not model the core loop as numerical emotion dashboards.
- Residue should persist, fade, and resurface when triggered.

### 3. Memory Continuity

- Characters should remember meaningful conversations.
- Old conversations should affect later phrasing, initiative, avoidance, or
  small behavior.
- Memory writes must avoid spam and must not persist fallback/abort pollution.
- v0.1 uses rolling two-hour continuity as the primary recent-memory proof:
  adjacent two-hour windows should show concrete residue -> callback or behavior
  change. AM -> PM remains a broader day-arc cross-check, not the only hard
  completion blocker.

### 4. Event Thread Continuity

- Today should have small school events that several people can naturally talk
  around from different angles.
- Continuity should not only mean repeating a prior line; it can mean the same
  event creates different residues for different characters.
- Keep this bounded: one current scene event thread, up to three involved
  characters, no giant event engine.

### 5. Human Alan Conversation Quality

- Alan-facing chat with Umi must bind to the latest sentence.
- Simple greetings should receive real greetings before analysis.
- Corrections such as "不是依賴，是喜歡" must not be dodged with unrelated
  analogies.

## Current Gates

- Accumulate fresh same-pair samples for Umi / Mahiru / Tianze; sample runners
  still use the `Tianze` runtime key.
- Run the latest v0.1 goal audit and soul/recent conversation evals before
  claiming readiness.
- Run `npm run underworld:rolling-continuity`; require PASS /
  `continuity_observed` unless Alan/product-owner explicitly defers the
  continuity gate.
- Do at least one longer Alan playtest where yesterday is felt inside today's
  conversation.
- Use `WORKLOG.md` for current handoffs and verification evidence.

## Deferred

- Large civilization systems
- Giant relationship graphs
- New scenes, factions, lore, or broad character expansion
- Numerical emotion dashboards
- Large memory schema migrations
- Three.js / true 3D
- Full all-NPC LLM expansion
- Major UI redesigns not directly supporting the v0.1 loop

## Working Rule

Before changing behavior, ask:

1. Does this improve character-soul authenticity?
2. Does this create or preserve emotional residue?
3. Does this improve memory continuity without memory spam?
4. Is there fresh evidence, or is the old sample only historical?

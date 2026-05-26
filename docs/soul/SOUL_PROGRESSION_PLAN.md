# Underworld Soul Progression Plan

GIIS Underworld is not only a conversation system. It is becoming a long-term
emotional social simulation.

The current Umi / Mahiru / Asuna soul definitions are important, but they are
only Character DNA. DNA is not enough. The next goal is to make soul visible
through behavior, memory, and relationship drift.

v0.1 success:

> Alan returns and feels:
>
> "Yesterday mattered.
> Today they are not exactly the same."

## Current Priority: v0.1 Scope Reset

Do not fine-tune models yet.

The current stage is not to teach a model fixed answers. The current stage is
to teach the world and the team what "alive" means while keeping v0.1 small.

For v0.1, focus only on the smallest emotional continuity loop:

```text
conversation
-> emotional residue
-> memory continuity
-> small behavioral consequence
-> tomorrow feels different
```

Do not build large civilization systems, giant relationship graphs, full
behavior engines, high-frequency emotional writes, or all-character soul
systems yet.

The active v0.1 questions are:

- Does each character speak in a way that fits their soul?
- Does a conversation leave emotional residue?
- Does that residue become memory continuity later?
- Does memory slightly affect behavior, silence, initiative, or avoidance?

Behavioral drift remains important, but for v0.1 it is an output of emotional
residue and memory continuity, not a separate engine to build now.

Before any fine-tuning work, the project needs stable evaluation for:

- emotional continuity
- memory continuity
- character authenticity
- small behavioral consequence
- human naturalness
- soul consistency

First build the harness. Then collect golden conversations and long-term drift
samples. Only consider fine-tuning after:

- stable soul architecture
- stable harness
- enough high-quality examples
- clear understanding of what should persist

Fine-tuning too early risks preserving the wrong behavior. Underworld should
first learn how to evaluate aliveness, not train a model to imitate unstable
answers.

### Current v0.1 Focus

Only three systems should drive near-term work:

1. Character soul expression.
2. Conversation -> emotional residue.
3. Emotional residue -> memory continuity.

Everything else is deferred unless it directly supports those three systems.

## 1. Soul Definition Is Only Character DNA

Soul profiles define what a character is made of:

- public self
- private self
- relational self
- emotional residue
- behavioral drift
- long-term arc

But a profile by itself does not make the world alive.

If the system only makes characters say their soul, they will become articulate
AI agents, not living people. Underworld should make soul appear through what
characters do, avoid, remember, delay, shorten, or stop doing.

The next stage is:

> Do not make characters only "say" their soul. Make them show it.

## 2. Progression Path

The intended progression is:

```text
Soul Definition
-> Soul Expression
-> Emotional Residue
-> Behavioral Drift
-> Relationship Drift
-> Daily Memory
-> Long-term Self Narrative
```

### Soul Definition

The character's DNA: who they are, what they fear, how they care, and how they
change around specific people.

Current source of truth:

- `docs/soul/pilots/umi.md`
- `docs/soul/pilots/mahiru.md`
- `docs/soul/pilots/asuna.md`

### Soul Expression

The character's soul becomes visible in a fresh moment.

Good expression is not longer dialogue. It is differentiated care:

- Umi reduces overload.
- Mahiru stays near and notices quiet pain.
- Asuna carries the next concrete burden, then slowly learns not to carry it
  alone.

### Emotional Residue

After something happens, a small emotional trace remains.

Residue should be selective and human:

- "Mahiru noticed I was still awake before I did."
- "Umi sounded useful, but not rested."
- "They said someone would do it. Asuna knew they meant her."

Residue should not be a transcript, log dump, generic mood label, or fallback
template.

### Behavioral Drift

Emotion and memory change what the character does next.

This is the next priority. It should be built gradually and only for the pilot
characters first.

Behavioral drift can show through:

- silence
- shorter replies
- availability changes
- movement
- who they approach
- who they avoid
- what they remember
- what they stop doing

### Relationship Drift

Repeated interaction changes how two characters behave around each other.

Examples:

- Mahiru checks on Umi earlier because she remembers Umi hides fatigue behind
  usefulness.
- Umi notices Asuna taking responsibility too quickly and asks who can share
  the load.
- Asuna becomes less defensive when Mahiru supports her without assigning more
  work.

Relationship drift should be bounded and slow. It should not rewrite
personalities overnight.

### Daily Memory

Daily memory makes yesterday matter without flooding prompts.

Good daily memory compresses:

- what happened
- what emotionally remained
- who changed slightly
- what may matter tomorrow

It should not grow without limits, and it should never store fallback or
template text as lived experience.

### Long-Term Self Narrative

Over many days, a character begins to carry a story about who they are becoming.

This is not a rewrite. Characters should grow like trees, not swap identities.

Examples:

- Umi moves from assistant to world interpreter to memory keeper.
- Mahiru moves from caregiver to the school's emotional conscience.
- Asuna moves from reliable executor to leader who protects responsibility from
  becoming invisible.

## 3. Key Principle

Do not make characters only "say" their soul.

Make them show it through:

- silence
- shorter replies
- availability changes
- movement
- who they approach
- who they avoid
- what they remember
- what they stop doing

Conversation is only one output surface. A character who is tired may speak
less, delay a task, stop moving, choose a smaller room, or avoid a group scene.

## 4. Next Priority: Behavioral Drift Engine

Build toward a Behavioral Drift Engine, but do it gradually.

Pilot only:

- Umi / 海
- Mahiru / 真晝
- Asuna / 明日奈

Do not expand to all characters until the pilot shows stable value.

### Pilot Examples

#### Umi tired

```text
Umi tired
-> shorter briefing
-> less world-summary mode
-> Mahiru notices
-> Mahiru checks on Umi later
```

Possible behavior:

- Umi shortens Alan's briefing instead of adding more detail.
- Umi asks one sharper question instead of listing five options.
- Umi pauses before turning Mahiru's care into a task.

#### Mahiru tired

```text
Mahiru tired
-> quieter
-> stays near window
-> notices others less quickly
-> Umi notices something is off
```

Possible behavior:

- Mahiru chooses a one-on-one moment instead of a group meeting.
- Mahiru stops asking follow-up questions when she is depleted.
- Mahiru stays nearby without forcing someone to confess.

#### Asuna overloaded

```text
Asuna overloaded
-> shorter replies
-> delays tasks
-> asks someone to share responsibility
-> stops automatically taking every action
```

Possible behavior:

- Asuna changes an owner from one person to two people.
- Asuna delays a nonurgent task instead of instantly accepting it.
- Asuna says "who can take half?" before saying "I will handle it."

## 5. Do Not Do Yet

Do not:

- expand to all characters immediately
- add large schema unless needed
- create high-frequency writes
- let emotional drift explode the DB again
- make every emotional change dialogue-only
- treat a single good sample as proof that the system is stable
- store fallback/template text as memory, events, profile residue, or daily
  narrative

The pilot should remain bounded, observable, and reversible.

## 6. Evaluation Direction

Future eval should check:

- Did emotion affect behavior?
- Did yesterday affect today?
- Did relationship history change how they act?
- Did character soul appear without being over-explained?
- Did the world feel slightly different after time passed?

Near-term harness areas:

- emotional continuity
- behavioral drift
- relationship chemistry
- atmosphere
- aftertaste
- soul consistency

Useful future metrics:

- `behavioral_drift_score`
- `availability_change_score`
- `relationship_history_effect_score`
- `daily_memory_continuity_score`
- `non_dialogue_soul_expression_score`
- `relationship_chemistry_score`
- `atmosphere_score`
- `aftertaste_score`
- `soul_consistency_score`
- `over_explanation_penalty`
- `high_frequency_write_penalty`

Eval should reward small human consequences, not just polished dialogue.

Golden data should include both:

- strong conversations
- long-term drift samples where yesterday changes today's behavior

## 8. Autonomous Soul QA Loop

The semi-autonomous soul QA loop exists to gather real samples, print
transcripts, run stable evaluation, and report small issues without freely
rewriting the world.

Run one loop:

```bash
npm run eval:soul-qa-loop
```

Run every 30 minutes during an active testing window:

```bash
npm run eval:soul-qa-loop -- --loop --interval-ms=1800000
```

Each loop should:

1. Try to collect fresh real samples for the Umi / Mahiru / Asuna pilot pairs.
2. Print the transcript of every fresh sample.
3. Run `npm run eval:soul-triad`.
4. Run `npm run eval:conversation:recent -- --since-last-change`.
5. Write `umi/reports/soul-loop-latest.md`.

If fresh sample count is less than 3:

- do not modify code
- report sample pending
- wait for the next loop

Allowed small auto-fix categories:

- banned phrase leak
- wrong addressee
- obvious echo repetition
- deterministic fallback archived as character dialogue
- eval parser bug
- timestamp/name mapping bug

Large changes require proposal only:

- new schema
- new memory system
- new relationship drift system
- model provider change
- prompt rewrite for all characters
- DB cleanup
- daily memory logic rewrite
- autonomous behavior changes

Proposal files go under:

- `umi/proposals/`

Golden conversation candidates go under:

- `evals/conversations/golden/`

The loop is semi-autonomous, not fully autonomous. It should help Alan and Umi
see what is happening, not replace judgment.

## 7. Why This Matters

Underworld is not only a conversation system.

It is a long-term emotional social simulation where characters should slowly
become legible through memory, care, avoidance, silence, and changed behavior.

The world should not only answer Alan.

It should remember him, worry about him, change around him, and sometimes become
quieter because of what happened yesterday.

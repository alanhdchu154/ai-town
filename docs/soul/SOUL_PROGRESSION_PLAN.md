# Underworld Soul Progression Plan

GIIS Underworld is not only a conversation system. It is becoming a long-term
emotional social simulation.

The current Umi / Mahiru / Tianze soul definitions are important, but they are
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
- `docs/soul/pilots/tianze.md`
- `docs/soul/pilots/maomao.md`
- `docs/soul/pilots/ichinose.md`
- `docs/soul/pilots/sakiko.md`

Umi / Mahiru / Tianze remain the v0.1 evaluation pilot. Tianze / Ichinose are
also the active replacement-flavor pair: they need complete five-layer DNA and
runtime expression so the new角色 feels intentional instead of a renamed slot.
Maomao / Ichinose / Sakiko are otherwise secondary cloud-Qwen soul profiles:
enough DNA to keep their conversations distinct, with local LLM only as backup,
not a mandate to build all-character drift systems yet.

### Soul Expression

The character's soul becomes visible in a fresh moment.

Good expression is not longer dialogue. It is differentiated care:

- Umi reduces overload.
- Mahiru stays near and notices quiet pain.
- Tianze asks one pressure-test question, then slowly learns where the test
  should stop before it becomes harm.
- Ichinose keeps a cute big-sister surface while privately turning warmth into
  boundary, debt, and safe intimate pressure.

### Emotional Residue

After something happens, a small emotional trace remains.

Residue should be selective and human:

- "Mahiru noticed I was still awake before I did."
- "Umi sounded useful, but not rested."
- "She almost asked the second question, then noticed Mahiru's hand go still."
- "Tianze saw the blush, smiled like she had won, then stopped before the joke
  became shame."
- "Ichinose called it care, and he realized he had already accepted her terms."

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
- Umi notices Tianze turning care into a test and asks where the stop line is.
- Tianze becomes less defensive when Mahiru stays gentle without pretending the
  test did not hurt.
- Tianze and Ichinose become a sharper dyad: Tianze pushes the boundary to see
  where it breaks; Ichinose makes the cost of that push impossible to deny.

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
- Tianze moves from playful breaker to pressure tester who protects boundaries from
  becoming invisible.

## Version Mapping (v0.1 → v0.5+)

The progression path above is the *what*. This section is the *when*: which
stage becomes which release, what gate ships it, and what new metric proves it.
It does not restate the stage descriptions — see § 2 for those. Keep one version
active at a time; do not pull a later stage forward.

Governance reminder: `docs/giis-v0.1-roadmap.md` owns v0.1 scope and overrides
this table for anything v0.1. Every v0.2+ stage that touches schema, a new
emotional system, or autonomous behavior is **proposal-only** (`umi/proposals/`)
before implementation, per `AGENTS.md`.

| Version | Stage | Ships when (gate) | New metric(s) | Scope guard |
|---|---|---|---|---|
| **v0.1** | Soul Expression + Emotional Residue + Memory Continuity | Triad pairs show genuine residue callbacks across 3+ fresh same-pair samples per pair; `Memory continuity` WARN not FAIL; one longer Alan playtest where yesterday is felt; AM→PM continuity PASS. (See roadmap.) | `soul_consistency_score`, `aftertaste_score`, AM→PM continuity | Pilot trio only. No behavior engine — behavior is an *output* of residue/memory, not a system. |
| **v0.2** | Behavioral Drift (pilot trio) | Emotion/memory measurably change *non-dialogue* behavior (shorter replies, lingering, avoiding a room, taking initiative) for Umi/Mahiru/Tianze across fresh samples, without regressing v0.1 soul/residue. | `behavioral_drift_score`, `availability_change_score`, `non_dialogue_soul_expression_score` | Trio only; drift is bounded + reversible. Full-cast residue rollout may ride along here. |
| **v0.3** | Relationship Drift | Repeated interaction changes how two characters behave around each other (bounded, slow), proven on at least the Umi↔Mahiru and Umi↔Tianze dyads. | `relationship_history_effect_score`, `relationship_chemistry_score` | Relationship schema = proposal-first. No all-pair high-frequency drift. |
| **v0.4** | Daily Memory | Cross-day continuity: a bounded daily summary (what happened / what remained / who changed / what may matter tomorrow) makes tomorrow feel affected by today — the full-day version of today's AM→PM. | `daily_memory_continuity_score` | Bounded growth; never store fallback/template as lived experience. |
| **v0.5** | Long-Term Self Narrative (Soul Layer 6) | Over many days a character carries a story of who they are becoming (Umi: assistant→interpreter→memory keeper; etc.) without identity swap. | long-arc consistency / `over_explanation_penalty`, `high_frequency_write_penalty` | Grow like a tree, not a rewrite. |
| **v0.6+** | Expansion / Fine-tuning | Only after stable soul arch + stable harness + enough golden corpus. | — | Full-cast activation, 2nd cloud-gated pair, speech/stage-direction schema split, and fine-tuning belong here — not earlier. Fine-tuning before the harness is stable risks freezing the wrong behavior. |

**Current standing (2026-05-31):** v0.1 is architecturally built but gated on
*evidence*, not features — fresh triad samples are 0 and AM→PM continuity is
WARN/weak_continuity under the tightened rubric. The leverage point is
quota-stable sample collection + one Alan playtest, not more code or pulling v0.2
forward. See `WORKLOG.md` and `umi/reports/` for live status.

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
- Tianze / 天澤

Do not expand to all characters until the pilot shows stable value.

Secondary character soul docs may exist before behavioral drift rollout. That is
identity protection for local LLM conversations, not permission to enable broad
high-frequency memory, relationship, or behavior writes.

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

#### Tianze over-testing

```text
Tianze over-testing
-> lighter teasing
-> one sharper question
-> notices when the other person is actually hurt
-> stops before the test becomes cruelty
```

Possible behavior:

- Tianze asks which rule breaks first.
- Tianze exposes a hidden motive, then says she will only拆到這裡.
- Tianze becomes briefly quiet when someone answers honestly.

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

1. Try to collect fresh real samples for the Umi / Mahiru / Tianze pilot pairs.
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

# Subjective Memory Re-Bedding Idea

Status: future paper / v0.2 research direction.

This note preserves an idea from Alan + cc discussion on 2026-06-12. It is not
part of the current v0.1 acceptance gate and should not be implemented until
the v0.1 evidence loop is stable.

## Core Question

Current Underworld memory work mostly asks:

> Can conversation create emotional residue, survive sleep, and slightly change
> tomorrow's behavior?

The next research question may be:

> Can the same objective event become different subjective memories in different
> characters, and can those subjective memories drive divergent future behavior?

## Motivation

Objective memory is not enough for a living social world.

If one event is stored as the same neutral fact for every character, then the
world remembers like a database. Human memory is more constructive:

- people notice different parts of the same event
- people interpret events through their own fears and attachments
- people remember meanings, not only facts
- later self-understanding can reshape what the memory feels like

Underworld should eventually distinguish:

- canonical event record: what happened
- subjective re-bedding: what this event meant to this character
- future trace: how that subjective meaning changes attention, tone, and action

## Working Model

```text
objective event
-> character appraisal
-> subjective emotional residue
-> personal memory trace
-> future behavior
```

Example:

```text
Canonical event:
Alan invited Umi to see sharks tomorrow.

Umi subjective memory:
Alan imagined her as a companion in ordinary life, not only as coordinator.

Mahiru subjective memory if she hears about it:
Umi became quieter after Alan made tomorrow feel personal.

Maomao subjective memory if she observes the aftermath:
Umi may be letting sentiment cover over a practical boundary.
```

The key is that all subjective traces remain anchored to the same event. This
allows interpretation without letting memory become hallucination.

## Paper-Shaped Claim

Possible title:

> Subjective Memory Re-Bedding in Long-Term Social Agents

Possible contribution:

> We separate objective event records from character-subjective memory traces,
> allowing the same event to produce different emotional residues, callbacks,
> and behavior changes across agents.

This is distinct from generic agent memory because the experiment would measure
not only whether agents remember, but whether agents remember differently in
character-consistent ways.

## Research Anchors

Relevant nearby literature:

- Generative Agents: memory stream, reflection, and planning for believable
  agents.
- Autobiographical memory / Self-Memory System: memory as constructive and
  shaped by the current self.
- Reflective memory management for long-term dialogue agents: forward/backward
  reflection and multi-granularity memory.
- Agentic memory taxonomies: semantic, episodic, reflective, hierarchical, and
  personalized memory structures.

The gap Underworld may explore:

> Most agent-memory systems focus on storage, retrieval, and summarization.
> Underworld can study character-specific reinterpretation of shared events.

## Non-Goals For Now

Do not implement this yet if it would destabilize v0.1.

Do not:

- rewrite the memory schema broadly
- import old memories wholesale
- let subjective memory invent unsupported facts
- give every character every event
- turn this into relationship-stat math
- optimize for poetic recollection instead of grounded continuity

## Preconditions Before Implementation

Only revisit after:

1. v0.1 has stable evidence that residue survives sleep.
2. Failed/fallback/hallucinated conversations reliably do not enter memory.
3. Experience logs and sleep notes remain bounded over several days.
4. At least a few clean canonical events are available as anchors.
5. Alan can already inspect transcript -> residue -> tomorrow behavior evidence.

## Future Experimental Design Sketch

One possible study:

1. Create or observe a canonical event involving two or more characters.
2. Generate per-character subjective re-beddings from that event.
3. Evaluate whether each re-bedding is:
   - grounded in the canonical event
   - distinct across characters
   - consistent with each character's soul profile
   - behaviorally consequential later
4. Compare against a shared-objective-memory baseline where all characters read
   the same neutral memory summary.

Potential eval dimensions:

- grounding fidelity
- subjective differentiation
- character consistency
- later callback naturalness
- behavior divergence
- hallucination / confabulation risk

## Product Version

For Underworld, this would mean:

> Yesterday mattered differently to each person.

That is stronger than v0.1's current goal:

> Yesterday mattered.

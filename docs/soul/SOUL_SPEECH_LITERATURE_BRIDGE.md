# Soul, Speech, and the Unsaid - Literature Bridge

Status: design seed, not implementation.
Time anchor: 2026-06-17 America/Chicago.

Purpose:
Translate Alan's literature-review questions into Underworld design language
without claiming that agents have human souls or consciousness.

Core questions:

1. How is the human soul/self defined?
2. How do people decide what to say?
3. How do people decide what to say out loud versus leave unspoken?

## Working Synthesis

For Underworld, "soul" should not mean a metaphysical claim. Treat it as an
engineering abstraction for durable human-like identity:

```text
embodied affect
-> autobiographical memory
-> narrative identity
-> moral / social commitments
-> current agency
```

This aligns with the existing Soul Five-Layer model:

- Public Self: what others can read from the outside.
- Private Self: what the character cannot easily admit.
- Relational Self: how the character changes depending on who is present.
- Emotional Residue: what remains after the moment.
- Behavioral Drift: how memory changes future action, silence, availability,
  and initiative.

The important addition is **the unsaid**. A character feels more human when a
private candidate line exists, passes through a social/pragmatic gate, and may
be softened, delayed, redirected, or kept silent.

## Human Speech Pipeline, Applied To UW

Human speech is not direct persona execution. A practical model for Underworld:

```text
situation appraisal
-> communicative intention
-> private candidate speech
-> common-ground check
-> relationship / face / risk check
-> self-monitoring and inhibition
-> spoken line, softened line, redirect, or silence
```

Design implications:

- Do not make a character open by performing their archetype.
- Start from what just happened, what this character currently wants, and what
  this specific listener already knows.
- Let soul shape what a character notices, not only the final wording.
- Let social risk decide whether the character says the direct thing, hides it,
  softens it, jokes around it, or chooses silence.
- Treat silence, hesitation, topic change, and shorter replies as behavior, not
  failed generation.

## Research Anchors

Use these as conceptual anchors when expanding the bibliography:

- Plato / Aristotle / ancient `psyche`: soul as life principle, form, or
  capacity rather than only a ghost-like entity.
- Personal identity literature: continuity of personhood through memory,
  psychology, body, responsibility, and narrative.
- Gallagher: minimal self versus narrative self.
- McAdams: narrative identity as an internalized life story.
- Blasi / moral identity: some actions are constrained because they violate
  "who I am," not merely because they are strategically bad.
- Levelt: speaking from intention to articulation; conceptualizer ->
  formulator -> articulator.
- Dell / lexical activation: candidate words compete and can misfire.
- Clark / common ground: speakers adapt to what they believe is mutually known.
- Grice: cooperative/pragmatic constraints on what counts as helpful speech.
- Pickering & Garrod: dialogue relies on interactive alignment.
- Alderson-Day & Fernyhough / Vygotsky: inner speech supports planning and
  self-regulation.
- Levelt / Nozari: self-monitoring detects errors or conflict before/during
  speech.
- Goffman: face-work explains why socially dangerous but true statements are
  softened, delayed, or withheld.

## Already in motion: the unsaid, applied at the memory layer (2026-06-17, CC)

The "unsaid" principle is not only future work — the inversion's first shipped
increments are exactly this idea applied to the MEMORY/RESIDUE layer:

- **Residue is now allowed to be 無** (`buildResiduePrompt`): most ordinary
  conversations leave no sharp trace, and the model is told to prefer 無 over
  forcing a low-weight micro-tell. That is "leave it unsaid", applied to the
  emotional trace. Observed effect (6/17 watcher): residue went from ~100%
  forced micro-tells to *selective* — weighty/concrete moments leave a trace,
  ordinary ones leave 無.
- **Subjective summary memory redirected off micro-tells**
  (`buildSubjectiveSummaryPrompt`): when the residue path went 無-first, the
  micro-tell relocated into the durable summary (喉結動了一下 ×3 in one batch).
  The summary now redirects toward substance (choice / words / decision) instead
  of a performed body-tell.

The lesson for the SPEECH layer: a thin situation with no permission to withhold
forces the model to *perform* (a micro-observation, an archetype move). Giving it
(a) a real situation and (b) an explicit option to NOT say the direct thing is
the same lever in both places. The memory layer got it first; speech is next.

The smallest concrete speech increment (do NOT big-bang): let a character's
direct candidate line pass a bounded gate built from the **relationship state we
already inject** (trust / closeness / tension, wired into the spine in Stage
①.2). High risk / low trust → a visibly softer line, a redirect, a shorter
reply, or silence — never hidden magic. This gate only has real teeth once events
make speech consequential (Stage ③), so it rides on the events substrate rather
than being another standalone style prompt.

## How This Enters The Roadmap

v0.1 use:

- Use this as a review lens for current speech-quality work.
- Evaluate whether a line has situation appraisal, listener-specific context,
  and a plausible social gate.
- Do not implement a large new cognitive architecture before v0.1 evidence is
  collectible.

v0.2 use:

- When real events become consequential, use them as the substrate for private
  candidate speech.
- Let event consequences create real reasons to speak, avoid, apologize, test,
  or stay silent.
- Add only bounded, observable gates first. Example: "direct line suppressed
  because relationship risk is high" should produce a visible softer line or
  silence, not hidden magic.

## Field Notes Angles

Good future episode candidates:

- `The Sentence An AI Character Does Not Say`
- `A Soul Is Not A Persona Prompt`
- `Why Human Speech Starts Before Words`
- `Private Thought, Social Gate, Spoken Line`

Quality boundary:
Do not claim Underworld agents have souls. Claim only that Underworld is trying
to model functional analogues of identity, memory, speech intention, and
inhibition.

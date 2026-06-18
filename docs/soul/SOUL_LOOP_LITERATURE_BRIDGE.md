# Soul Loop Literature Bridge

Status: design lens, not runtime proof.
Time anchor: 2026-06-18 America/Chicago.

Purpose:
Connect Underworld's v0.1 affective loop to conservative psychology language
without claiming that simulated characters have human feelings, consciousness,
or souls.

This is the companion to `SOUL_SPEECH_LITERATURE_BRIDGE.md`. That document
focuses on what gets said or withheld. This one focuses on the feedback loop:

```text
situation / event
-> appraisal through character soul
-> speech or silence
-> residue / experience log
-> current emotion
-> attention, tone, and later speech
-> sleep / tomorrow consolidation
```

## Working Claim

Underworld should treat emotion as a functional signal, not an RPG stat.

For v0.1, the question is not whether an agent "has" sadness or care. The
engineering question is narrower:

Can a conversation leave a bounded subjective residue that changes what this
character notices, remembers, says, withholds, or does later?

If yes, yesterday can matter without pretending the system has inner life.

## Research Anchors

### 1. Appraisal: events matter because of what they mean to someone

Appraisal theories treat emotion as arising from how an event is evaluated in
relation to goals, needs, control, agency, fairness, and relationship meaning.
Scherer and Moors describe emotion as a process where event appraisal leads to
action tendencies, expression, and later categorization or labeling.

Underworld translation:

- Do not map event -> emotion directly.
- Map event -> character-specific interpretation.
- Umi may interpret the same event as overload / Alan burden.
- Mahiru may interpret it as quiet pain / someone being unseen.
- Tianze may interpret it as a pressure point.

Design rule:
Emotion writes should be tied to a concrete interpreted moment, not generic
keywords like `sad` or `happy`.

### 2. Affect as information: mood changes what feels salient

Affect-as-information work argues that feelings can function as information for
judgment and attention. Related work on mood and processing suggests positive
and negative affect can change whether people attend broadly or locally.

Underworld translation:

- A character's current emotion should change attention, not only line color.
- Worried Mahiru notices people who stop answering honestly.
- Guarded Sakiko notices formality and risk.
- Tired Umi compresses briefings instead of expanding them.

Design rule:
Emotion should influence what is selected as relevant context.

### 3. Mood-congruent memory: current state changes recall

Mood-congruent memory research, often traced to Bower's associative-network
account, suggests people are more likely to recall material that matches their
current affective state.

Underworld translation:

- The memory reader should not surface old traces randomly.
- A similar context, person, location, or emotional stance should trigger the
  residue.
- Repeated "curry" or "lunch" without new behavior is a motif loop, not
  continuity.

Design rule:
Memory callback is valid only when a later moment is changed by a specific
prior residue.

### 4. Emotion regulation: not all feeling becomes speech

Gross's process model distinguishes earlier reappraisal from later suppression.
The important Underworld lesson is that people regulate what they express:
feeling, behavior, memory, and outward speech are not identical.

Underworld translation:

- A character may feel warmed but answer practically.
- A character may be hurt but become formal.
- A character may avoid saying the direct thing.
- Silence and shorter replies are valid outputs.

Design rule:
Do not make every emotional update become a line explaining that emotion.

### 5. Sleep and consolidation: tomorrow should be selective

Sleep and memory consolidation literature motivates the design intuition that
not everything from a day should be copied forward. Consolidation is selective,
transformative, and bounded.

Underworld translation:

- Nightly reflection should promote only tiny, safe, meaningful residues.
- Do not dump transcripts.
- Do not make old polluted archive rows prompt-facing by default.
- Sleep notes should support tomorrow's tone and behavior, not rewrite
  personality.

Design rule:
Sleep is a compression and selection gate, not a bulk import.

## Current Underworld Edge Map

| Edge | Current status | Notes |
|---|---|---|
| situation / event -> speech | live but shallow | Scene, clock, relationship, and recent event context enter prompts, but event consequences are still thin. |
| speech -> residue | live | Residue is selective and can be `無`; bad hygiene should reject writes. |
| residue -> experience log | live / bounded | v0.1 evidence layer stores small subjective traces, not transcripts. |
| conversation -> current emotion | live / simple | Current heuristic maps conversation content to the small portrait palette. |
| current emotion -> next speech | live | `currentEmotion` is read into profile/prompt state and visible in portrait/UI. |
| current emotion -> memory selection | shallow | This is the next research edge: affect should influence which residues become salient. |
| sleep reflection -> tomorrow | shadow only | Recent bug fix made shadow output usable, but write mode should wait for more clean shadow nights. |
| behavior drift | partial | Notifications and prompt state can express behavior signals, but durable behavior remains intentionally small. |

## What This Means For v0.1

v0.1 should prove a loop, not a philosophy:

```text
Alan or a character says something
-> another character interprets it through soul
-> a small residue is stored
-> emotion shifts
-> a later line or behavior changes slightly
-> sleep may carry one tiny trace into tomorrow
```

Good evidence:

- Mahiru remembered that Umi sounded tired and checked earlier later.
- Umi accepted Alan's promise but did not mechanically repeat the exact phrase.
- Sakiko became more guarded after a vulnerable exchange, without explaining the
  whole psychology.

Bad evidence:

- The same object appears again with no new meaning.
- The character repeats a slogan.
- A sleep note leaks system wording.
- A transcript becomes a memory.
- Everyone becomes emotionally articulate in the same way.

## Design Boundaries

Do not overclaim:

- These are not human emotions.
- These are not proof of sentience.
- This is not a full cognitive architecture.

Do claim, if evidence supports it:

- Underworld models a functional affective loop.
- Emotion is represented as residue, attention, tone, and small behavior.
- The system is trying to make yesterday matter in bounded, inspectable ways.

## Sources

- Richard S. Lazarus and Susan Folkman, `Stress, Appraisal, and Coping`
  (1984). Google Books overview:
  https://books.google.com/books/about/Stress_Appraisal_and_Coping.html?id=i-ySQQuUpr8C
- Klaus R. Scherer and Agnes Moors, `The Emotion Process: Event Appraisal and
  Component Differentiation`, Annual Review of Psychology (2019):
  https://ppw.kuleuven.be/okp/_pdf/Scherer2019TEPEA.pdf
- Gerald L. Clore et al., `Affective Feelings as Feedback: Some Cognitive
  Consequences` (2001):
  https://oveislab.com/s/Clore-Wyer-Dienes-Gasper-Gohm-Isbell-2001.pdf
- Karen Gasper and Gerald L. Clore, `Attending to the Big Picture: Mood and
  Global Versus Local Processing of Visual Information`, Psychological Science
  (2002): https://pubmed.ncbi.nlm.nih.gov/11892776/
- Gordon H. Bower, `Mood and Memory`, American Psychologist (1981):
  https://scispace.com/papers/mood-and-memory-2hpv5hktzq
- James J. Gross, `Emotion regulation: affective, cognitive, and social
  consequences`, Psychophysiology (2002):
  https://pubmed.ncbi.nlm.nih.gov/12212647/
- Robert Stickgold, `Sleep-dependent learning and memory consolidation`, Nature
  (2004): https://pubmed.ncbi.nlm.nih.gov/15450165/
- Matthew P. Walker and Robert Stickgold, `Sleep, Memory, and Plasticity`,
  Annual Review of Psychology (2006):
  https://walkerlab.berkeley.edu/reprints/Walker%26Stickgold_AnnRevPsych_2006.pdf

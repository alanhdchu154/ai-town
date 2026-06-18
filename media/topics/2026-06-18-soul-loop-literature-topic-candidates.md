# Soul Loop Literature Topic Candidates

Status: Umi channel / Field Notes topic candidates. Not upload-approved.
Time anchor: 2026-06-18 America/Chicago.

Source:
- `docs/soul/SOUL_LOOP_LITERATURE_BRIDGE.md`
- `docs/soul/SOUL_SPEECH_LITERATURE_BRIDGE.md`
- `convex/agent/conversationEmotion.ts`
- `WORKLOG.md` 2026-06-18 soul-loop entries

Claim boundary:
These topics explain a functional simulation design. Do not claim the
characters have real emotions, consciousness, sentience, friendship, or a human
soul. Use phrases like:

- "functional affective loop"
- "simulated emotional residue"
- "a design lens from psychology"
- "a bounded mechanism that makes yesterday matter"

Avoid:

- "the AI feels"
- "the AI is conscious"
- "we proved artificial emotions"

## Strong Candidate 1: The Missing Loop

Title ideas:
- `The Missing Loop In My AI World`
- `Why Memory Was Not Enough`
- `Conversation Should Change The Next Conversation`

Hook:
I thought my AI world needed better memory. The deeper bug was that memory did
not change how the character showed up next.

Core idea:
The world used to flow mostly one way:

```text
situation -> speech -> memory
```

The v0.1 soul loop needs a return edge:

```text
conversation -> residue -> emotion -> next speech
```

Why it works for the channel:
It is understandable, visual, and directly tied to Underworld's current build.
It also explains why v0.1 is not "more agents talking"; it is whether yesterday
changes today.

Evidence to attach before packaging:
- `docs/soul/SOUL_LOOP_LITERATURE_BRIDGE.md`
- `convex/agent/conversationEmotion.ts`
- `convex/agent/conversationEmotion.test.ts`
- A fresh report showing a current emotion changing and later prompt/UI state
  reading it.

Claim risk:
Low if framed as system design, medium if examples imply real emotion.

Recommendation:
Best first topic from this bridge.

## Strong Candidate 2: Emotion Is Not `happy +5`

Title ideas:
- `Why I Refuse To Make AI Emotion A Stat`
- `Emotion Is Not Happy Plus Five`
- `The RPG Stat Trap In AI Characters`

Hook:
If I store "sad +3", the character looks measurable, but less human.

Core idea:
Underworld treats emotion as residue, attention, tone, and small behavior:

- shorter replies
- who the character notices
- what memory comes back
- whether they stay, avoid, soften, or ask again

The literature bridge connects this to appraisal and affect-as-information:
events matter because of how they are interpreted by someone, and affect can
change what feels salient.

Why it works for the channel:
It turns an abstract design principle into a very watchable contrast:
dashboard stat vs lived behavior.

Evidence to attach before packaging:
- `docs/soul/SOUL_LOOP_LITERATURE_BRIDGE.md`
- `docs/soul/SOUL_PROGRESSION_PLAN.md`
- UI/report examples where emotion appears as behavior or tone, not a numeric
  meter.

Claim risk:
Low.

Recommendation:
Good evergreen explainer; can become a Short even without a dramatic fresh
transcript.

## Strong Candidate 3: Why Sleep Matters In An AI World

Title ideas:
- `Why My AI World Needs Sleep`
- `The Sleep System Is Really A Memory Filter`
- `What Should An AI Character Remember Tomorrow?`

Hook:
The scariest part of long-term AI memory is not forgetting. It is remembering
everything.

Core idea:
Nightly consolidation should not dump transcripts into memory. It should select
at most a tiny residue that can safely affect tomorrow.

Underworld translation:

```text
experience log -> sleep note candidate -> tomorrow behavior
```

Why it works for the channel:
It connects the real engineering problem Alan keeps hitting -- local DB bloat
and polluted memory -- with a human-readable metaphor: sleep as compression,
selection, and forgetting.

Evidence to attach before packaging:
- `docs/soul/SOUL_LOOP_LITERATURE_BRIDGE.md`
- `docs/soul/MEMORY_DYNAMICS_AND_FORGETTING.md`
- `docs/soul/FORGETTING_MECHANISM_SPEC.md`
- Current nightly reflection report after 1-2 clean shadow nights.

Claim risk:
Medium until nightly reflection write mode is proven. Keep it as design /
shadow-mode discussion unless a clean run exists.

Recommendation:
Hold until the reflection shadow reports are clean enough to show.

## Backup Candidate 4: The Character Does Not Say The Direct Thing

Title ideas:
- `The Sentence An AI Character Does Not Say`
- `Why Silence Makes AI Characters Feel More Human`
- `Private Thought, Social Gate, Spoken Line`

Hook:
The most human part of a conversation may be the line that never gets said.

Core idea:
The speech bridge and loop bridge meet here: emotion does not have to become a
confession. It can become shorter wording, hesitation, deflection, or silence.

Why it works for the channel:
It is a good follow-up to the already packaged "human talk, not template" lane.

Evidence to attach before packaging:
- `docs/soul/SOUL_SPEECH_LITERATURE_BRIDGE.md`
- `docs/soul/SOUL_LOOP_LITERATURE_BRIDGE.md`
- A transcript where a character withholds or softens instead of overexplaining.

Claim risk:
Low to medium. Needs a concrete transcript so it does not become vague.

Recommendation:
Backlog until a transcript example is selected.

## Backup Candidate 5: Appraisal Makes Characters Different

Title ideas:
- `Same Event, Different Souls`
- `Why Two AI Characters Should Not Care The Same Way`
- `A School Event Means Different Things To Different Characters`

Hook:
The same event should not create the same emotion in everyone.

Core idea:
Appraisal theory is useful as a design lens: emotion starts with what an event
means to this character.

Example:

- Umi interprets a messy day as Alan overload / world stability.
- Mahiru interprets it as quiet pain / someone not being cared for.
- Tianze interprets it as a pressure point.
- Sakiko interprets it as a composure risk.

Why it works for the channel:
It gives a clean explanation of "soul differentiation" without turning it into
more lore.

Evidence to attach before packaging:
- `docs/soul/pilots/*.md`
- `docs/soul/SOUL_LOOP_LITERATURE_BRIDGE.md`
- A paired transcript where two characters react differently to the same campus
  event.

Claim risk:
Medium until there is fresh paired evidence.

Recommendation:
Hold for a good event-thread sample.

## Suggested Watcher Priority

1. Package Candidate 1 if fresh evidence exists for conversation -> emotion ->
   later speech.
2. Package Candidate 2 as an evergreen design Short if no fresh transcript is
   strong enough.
3. Hold Candidate 3 until nightly reflection has clean shadow evidence.
4. Keep Candidates 4-5 as backlog until concrete transcript examples appear.

# Underworld Field Notes Watcher Inbox

Time anchor: 2026-06-15 America/Chicago

This inbox collects possible playtest-note style content from Underworld.

## 2026-06-18 Soul Loop Literature Candidates

Type:
Umi channel / Alan's AI Field Notes topic bank.

Status:
Fresh topic candidates from `docs/soul/SOUL_LOOP_LITERATURE_BRIDGE.md`. These
are not upload packages and not proof claims. Use them as evening watcher
options when no stronger fresh transcript story appears.

Topic packet:
- `media/topics/2026-06-18-soul-loop-literature-topic-candidates.md`

Best first candidates:
- `The Missing Loop In My AI World`: conversation should change the next
  conversation, not only become memory.
- `Emotion Is Not Happy Plus Five`: why Underworld uses residue, attention,
  tone, and behavior instead of numeric emotion stats.
- `Why My AI World Needs Sleep`: sleep as selective memory compression, held
  until clean shadow reflection evidence exists.

Claim boundary:
Frame as a functional affective loop / design lens from psychology. Do not claim
AI feelings, sentience, or proof of artificial emotion.

Recommended watcher action:
If tonight's fresh Underworld evidence has a clear conversation -> emotion ->
later-speech beat, package Candidate 1. If not, Candidate 2 is the safer
evergreen design Short.

## 2026-06-16 Midday Scout

### Why did an AI remember the light on someone's hand?

Type:
Short or Story Episode segment.

Status:
Fresh candidate from 2026-06-16 rolling-continuity report. Hold until tonight's
watcher pass unless a stronger fresh story appears.

Observed moment:
In the 08:00-10:00 source window, 真晝 said the window light fell on 一之瀨's hand.
In the 10:00-12:00 callback window, later conversations reused that concrete
window/hand cue, including a strong callback where 真晝 explained counting forks
because the light moved onto the hand.

System cause:
The rolling continuity gate found a residue-to-callback chain across adjacent
two-hour windows. This is not proof of friendship or consciousness; it is a
small continuity signal where a concrete sensory detail survived long enough to
shape later wording/attention.

Evidence paths:
- `/Users/alanhdchu/ai-town/umi/reports/rolling-continuity-latest.md`
- `/Users/alanhdchu/ai-town/WORKLOG.md`

Claim risk:
Medium.

Why it is interesting:
It gives the world a tiny lived texture: not "the AI remembered everything",
but "one small visual detail came back later." That is exactly the kind of
Underworld life-note that can be made watchable without overclaiming.

Suggested package:
- hook: `An AI noticed light on someone's hand. Two hours later, it came back.`
- narration angle: continuity is not memory as a database; it is what a detail
  makes the character notice next.
- visual idea: black-and-white manga or visual-novel sunlight panel, with one
  red mark around the hand/window cue.
- voice idea: watcher diary or 一之瀨 / 真晝 character POV, not default Umi lecture.
- music plan: quiet YouTube Audio Library ambient bed or self-generated soft
  piano texture.
- title idea: `Can AI Remember A Moment?`
- publish recommendation: observe until tonight; publish only if the callback
  remains the strongest fresh story and the script keeps the claim narrow.

### Why did the mobile UI jump when the AI was thinking?

Type:
Short backlog or devlog segment.

Status:
Fresh engineering-story candidate from 2026-06-16. Lower priority than a pure
life-story candidate unless Alan asks for more "building the world" clips.

Observed moment:
Alan saw mobile UI flicker/jump during play. The visible failure looked like a
frontend reconnect, but logs showed heavy world-summary/notebook/timeline
queries timing out while an Alan/Tianze conversation was generating.

System cause:
The active conversation hot path was competing with nonessential background
queries. The patch paused/skipped several heavy queries during current dialogue
and kept last-good cached display values.

Evidence paths:
- `/Users/alanhdchu/ai-town/WORKLOG.md`
- `/Users/alanhdchu/umi-central/ai/HANDOFF.md`

Claim risk:
Low.

Why it is interesting:
It explains a real product lesson: if the world is alive, the viewer still
experiences the frontend. A simulated society needs boring UI resilience too.

Suggested package:
- hook: `The AI was thinking so hard the interface blinked.`
- narration angle: the weird part of AI worlds is that intelligence and UI
  stability can fight each other.
- visual idea: UI evidence board, mobile frame, query labels, one red overload
  warning.
- title idea: `Why My AI World Flickered`
- publish recommendation: backlog; useful if no stronger social-life story
  appears.

## 2026-06-15 Nightly Scout

### Why did the promise exist in chat, but not in memory?

Type:
Short.

Status:
Fresh candidate from 2026-06-15. Ready to package for review.

Observed moment:
Alan got 海 to agree to a next-day pearl milk tea / lunch promise, but the
notebook still came back empty.

System cause:
The concrete-commitment extractor understood curry better than boba. It scanned
earlier acceptances before later refinements, then a stale-curry repair made the
reply too generic to extract any promise at all.

Evidence paths:
- `/Users/alanhdchu/ai-town/WORKLOG.md`
- `/Users/alanhdchu/ai-town/umi/reports/20260616T015123Z-workload.md`
- `/Users/alanhdchu/ai-town/umi/reports/20260616T013551Z-workload.md`

Claim risk:
Low.

Why it is interesting:
It is a tiny, human-scale memory failure: the character sounded close enough in
dialogue, but the system failed to preserve the actual tomorrow-facing object.

Suggested package:
- hook: `She promised bubble tea tomorrow. Her notebook remembered nothing.`
- narration angle: memory bugs are often specificity bugs, not total forgetting.
- visual idea: Umi render + notebook panel + lunch/boba captions + campus noon
  scene.
- title idea: `Why My AI Forgot the Bubble Tea Promise`
- publish recommendation: strongest current fresh story; good low-risk Short.

### Why are the characters still talking through the same props?

Type:
Short or Story Episode segment.

Status:
Fresh candidate from 2026-06-15. Observe one more day unless Alan wants the
bug-postmortem angle now.

Observed moment:
Post-fix conversations still kept circling the same sleeves, pen caps, drawers,
lights, and candy-wrapper style object beats.

System cause:
Current eval points to cross-speaker mirror / motif-loop behavior: the system is
producing concrete details, but often reuses prop-family echoes instead of
shifting attention in a character-specific way.

Evidence paths:
- `/Users/alanhdchu/ai-town/evals/conversations/reports/latest.md`
- `/Users/alanhdchu/ai-town/WORKLOG.md`

Claim risk:
Low.

Why it is interesting:
It explains a subtle failure mode: AI characters can look detailed while still
feeling stuck because they are remembering objects more than people.

Suggested package:
- hook: `My AI characters were not remembering each other. They were remembering props.`
- narration angle: detail is not the same thing as social movement.
- visual idea: repeated object words stamped over multiple dialogue windows.
- title idea: `The Weirdest Bug Is a Repeated Memory`
- publish recommendation: backlog unless we want a more engineering-heavy Short.

### Why did every conversation lose its aftertaste?

Type:
Short or Story Episode segment.

Status:
Backfill candidate from 2026-06-13. Strong causal story if tonight's fresh item
is not selected.

Observed moment:
The world was producing rich conversations, but every stored emotional residue
came back empty.

System cause:
Residue is a second sequential LLM call. The default memory timeout was 10s,
while the local qwen3:8b path took about 17s, so the aftertaste layer silently
timed out.

Evidence paths:
- `/Users/alanhdchu/ai-town/docs/giis-v0.1-roadmap.md`
- `/Users/alanhdchu/ai-town/WORKLOG.md`

Claim risk:
Low.

Why it is interesting:
It gives a clean system lesson: memory is not one feature. The feeling-layer can
fail even when the dialogue layer looks alive.

Suggested package:
- hook: `I thought the memory system worked. The feeling layer was timing out.`
- narration angle: a second hidden step was failing quietly.
- visual idea: dialogue window stays vivid while residue panel stays blank.
- title idea: `The Day Every AI Conversation Lost Its Aftertaste`
- publish recommendation: strong backfill Short candidate.

## Ready / Low-Risk Candidates

### Why did my AI characters say the same thing all day?

Type:
Short or Story Episode segment.

Observed moment:
Characters repeated motifs or similar surface behavior instead of producing new
social movement.

System cause:
Fallback deterministic behavior, weak retrieval, or motif loops can make agents
look like they remember while still behaving in a loop.

Evidence paths:
- `evals/conversations/reports/latest.md`
- `umi/reports/life-signals-latest.md`
- `WORKLOG.md`

Claim risk:
Low.

Why it is interesting:
It explains why "give NPCs memory" is not enough. The hard part is deciding
which memory should change behavior.

Suggested package:
- hook: "My AI characters remembered something. That was the problem."
- narration angle: memory can become repetition if retrieval is not grounded.
- visual idea: repeated captions / looped note card / conversation wall.
- title idea: `Why my AI characters kept repeating themselves`
- publish recommendation: good Short candidate.

### Why did the AI world look alive but stop talking?

Type:
Short or Story Episode segment.

Status:
Packaged on 2026-06-15 as Alan's AI Field Notes Short candidate
`When an AI World Is Online but Not Alive | Field Note`; uploaded public at
`https://youtu.be/_to91-H3DEY`.

Observed moment:
The frontend and Convex queries were alive, but role-to-role conversations had
effectively stalled.

System cause:
A hung generation path or stale active conversation can block the social loop
even while health checks say the world is running.

Evidence paths:
- `WORKLOG.md`
- `docs/giis-v0.1-roadmap.md`
- `umi/reports/life-signals-latest.md`

Claim risk:
Low.

Why it is interesting:
It shows that "server is up" is not the same as "society is alive."

Suggested package:
- hook: "My AI world was running. Nobody was living in it."
- narration angle: liveness checks need social-flow checks.
- visual idea: green status light vs empty conversation feed.
- title idea: `When an AI world is online but not alive`
- publish recommendation: good Short candidate after privacy scrub.

## Backlog / Needs More Evidence

### Can AI characters become friends?

Claim risk:
High.

Need:
Repeated dyad behavior, continuity callback, residue/experience evidence, and
later behavior change.

Recommendation:
Do not publish as a claim yet. Keep as question framing.

### Can AI develop trust?

Claim risk:
High.

Need:
One character relies on another because of prior history, not just because the
script says they are friendly.

Recommendation:
Observe longer.

# Underworld Field Notes Watcher Inbox

Time anchor: 2026-06-15 America/Chicago

This inbox collects possible playtest-note style content from Underworld.

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

# Underworld Field Notes Watcher Inbox

Time anchor: 2026-06-15 America/Chicago

This inbox collects possible playtest-note style content from Underworld.

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

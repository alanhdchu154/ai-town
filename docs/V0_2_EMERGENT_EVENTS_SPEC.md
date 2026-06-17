# v0.2 — Emergent, consequential events (spec for Codex)

Status: **spec, for Codex to pursue (v0.2).** Owner of the *speech inversion*
stays CC (it is an observe-and-adjust loop); THIS — the events system — is the
big, well-bounded, parallelisable piece that does not need the live conversation
loop, so it is handed to Codex. Author it in review-gated increments, do not
big-bang.

## Why this matters (the link to the speech work)
The speech architecture is `本末倒置` (see
`docs/soul/SPEECH_AND_SITUATION_INVERSION.md`): we over-control the OUTPUT of each
line because the **situation is thin**. Events are the situation's substrate. So
making events *real* is Stage ③ of the inversion — it gives characters real
things to speak FROM, which is what lets us later retire the output guards.

## Current state (what to replace)
Today's events are **hardcoded, injected "weather"**:
- `data/dailyLifeBulletin.ts` (authored daily rotations), `data/spontaneousEvents.ts`
  (a curated random pool, ≤2/day), `data/schoolLocations.ts` moodEvents (one per
  location/day via `(day+hour) % n`).
- They name real characters but **did not happen in-sim**. They tint mood / memory
  / conversation-context (`recentEvents` → a weak "Background weather" prompt line;
  `appendMemory`; emotion + `worldPressure` nudges) but cause **no real
  consequence**: no movement, no activities, no plot, no forced follow-on.
- Code refs: `convex/school.ts` `appendRecentEvent` / `updateSocialLayerForEvent`
  / `applyWorldPressureFromEvent` / campus-thread seeding; `worldEvents` table in
  `convex/schema.ts`; `conversation.ts` `recentEventsPrompt`.

## The goal: events that are emergent, consequential, and chained
1. **Emergent** — an event ARISES from what an agent actually did/decided (a
   conversation outcome, a decision, a discovered state), not a hardcoded list.
   `worldEvents` already has a `conversationOutcome` type + `source:
   autonomous_agent_action` — promote these from *record* to *cause*.
2. **Consequential** — an event causes real change: an agent actually goes
   somewhere, an activity spawns, a relationship shifts durably, a follow-on event
   is scheduled. Today the consequence is at most a prompt hint; wire events into
   the agent's **activity/movement/plan** systems (`convex/aiTown/`), not just the
   prompt.
3. **Chained** — an event can reference and spawn a follow-on event, so the world
   has momentum (e.g. 「有人在門後哭」 → 真晝 actually goes to that location → they
   talk → a relationship/closeness shift → a later event recalls it). Use the
   existing `observerPlayerIds` / `relatedCharacterName` fields to thread cause→effect.

## Suggested first increments (Codex to refine)
- **E1 — promote conversation outcomes to causes.** When a conversation ends with a
  real decision/commitment (the system already extracts commitments), emit a
  `worldEvents` row that other agents can *act on*, not just read.
- **E2 — one real consequence type end-to-end.** Pick the simplest: an event can
  make ONE involved agent path to the event's location (hook the existing
  movement/activity system). Prove the loop "event → agent actually moves → a new
  conversation happens there" works for one case before generalising.
- **E3 — durable relationship shift.** An event between two characters nudges
  `schoolRelationships` (trust/closeness) in a way that persists and shows up in
  the relationship spine (`RELATIONSHIP_DYNAMICS` is currently authored-static;
  let runtime state layer on top).
- **E4 — chaining.** Allow an event to schedule a bounded follow-on event that
  references it.

## Boundaries / non-goals / safety
- Do NOT break the soul/memory/residue pipeline or v0.1 data-collection runtime.
- Keep it bounded: rate-limit emergent events; no spam, no runaway chains; a
  spontaneous/emergent cap per day like today's.
- Preserve continuity: emergent events must not erase or contradict memories.
- Review-gated: land in increments, each verifiable (E1…E4), with a way to disable
  via env if it destabilises a collection run.
- This is v0.2 — separate from the v0.1 contract; gate behind a flag until proven.

## Definition of done (per increment)
Each increment is "done" when: it is env-gated, has a test or a reproducible
demo, does not regress the runtime preflight, and the WORKLOG records the actual
observed effect (a real before/after, not a claim).

## Implementation notes

### E1 initial substrate — 2026-06-17

Status: **metadata substrate + bounded consumer shipped, runtime behavior still
gated/off by default.**

What changed:

- `worldEvents` now has optional v0.2 consequence metadata:
  `emergentCauseKind`, `consequenceStatus`, `consequenceKind`, `causeEventId`,
  and `chainDepth`.
- Clean `conversationOutcome` rows can be marked as `conversation_outcome`
  cause candidates only when `UNDERWORLD_V02_EMERGENT_EVENTS=true`.
- `repeated_noise` outcomes are never promoted into cause candidates.
- The metadata is deliberately conservative: it does not move agents, rewrite
  relationships, or schedule chains yet. E2+ must consume these candidates
  explicitly and remain review-gated.
- `school:applyEmergentEventCandidates` is the E2-E4 consumer:
  - `{"write": false}` is a no-side-effect dry-run.
  - `{"write": true}` is blocked unless `UNDERWORLD_V02_EMERGENT_EVENTS=true`.
  - `max` is clamped to 1-5 candidates.
  - only `conversation_outcome` candidates at `chainDepth <= 0` are considered.
- E2 current consequence: a `queued_intention` candidate appends a bounded
  short-term intention and, when the actor is not inside an active conversation
  and the source event has a location, gives that actor a pathfinding destination
  plus a short activity toward the event location. Existing world-time execution
  can later turn the intention into an additional action/event.
- E3 current consequence: a `relationship_shift_candidate` can apply a tiny
  relationship delta and notification through the existing relationship path.
- E4 current consequence: every applied candidate writes at most one follow-up
  `worldEvents` row with `causeEventId` and `chainDepth=1`. No recursive chain
  is allowed in this increment.

Verification:

- `npm run underworld:emergent-events:self-test`
- Dry-run command:
  `npx convex run school:applyEmergentEventCandidates '{"write":false,"max":3}'`

Why this shape:

v0.1 data collection must stay stable. E1 creates a durable, testable bridge
from "conversation outcome was recorded" to "this outcome is eligible to cause
something later" without making the live world suddenly more chaotic.

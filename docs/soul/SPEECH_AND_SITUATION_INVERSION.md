# Speech & Situation: inverting the architecture (staged roadmap)

Status: **active direction, staged.** Started 2026-06-17 (Alan + CC). We advance
one increment at a time; this doc is the map.

## The problem (Alan's read: 本末倒置 — cart before the horse)

Today the system spends ~90% of its effort **controlling the output** of a line
(7 layers, 30+ mostly-negative guards: don't repeat, don't use 茶/便當/喉結,
don't sound like therapy, don't write stage directions…) and **force-feeds
residue** (every conversation must leave a trace, so it grabs a micro-tell).

Both are **symptoms of one root cause: the situation is too thin.** When a
character has nothing real going on, the only move left is "do my archetype move
(diagnose / pressure-test) on a small detail" — so we add guards to suppress
that, and the residue records the same thin micro-detail. That is why:

- they keep saying templated things (we then ban phrases one by one — whack-a-mole), and
- they "remember weird things" (forced micro-tell residue).

A human's first line is not template-checked. It comes from: **a real internal
state + a real situation + who this specific person is + what actually happened
today.** Style *emerges*; it is not enforced.

## The insight: speech and "events" are the SAME problem

The speech architecture can only "invert" (thick internal, thin output guards)
if there is a **rich situation** to speak *from*. That situation IS the events,
the relationship state, the day's real happenings. So enriching the situation
fixes the speech AND the memory at once — they are one lever, not two projects.

## The inversion, in three stages (do not big-bang)

The guards are scar tissue from real failures; ripping them out at once brings
the slop back. Move the centre of gravity gradually instead.

### Stage ① — give every conversation a real spine  (START HERE)
Make the opening hold "**what is actually true between these two right now**":
a concrete matter, a real recent event, where the relationship stands, the
speaker's current state. Mostly this is wiring data that **already exists**
(selfState, relationship dimensions, recentEvents) from a weak "Background
weather" line into the CENTRE of the prompt. With a real spine, the archetype
drops to *flavour*, and residue becomes natural (you remember what mattered, not
a forced micro-tell). One step fixes both speech and memory.

### Stage ② — retire the most arbitrary guards as quality holds
Once conversations have a real spine, the micro-tic bans and several motif
families become redundant (they were compensating for the thin spine). Remove
them incrementally, checking quality each time. This is the inversion done
safely — guards come out only after the substrate can carry the weight.

### Stage ③ — make events real (v0.2)
Today's events are hardcoded, injected "weather" (data/dailyLifeBulletin.ts,
spontaneousEvents.ts, schoolLocations.ts moodEvents): they name real characters
but did not *happen* in-sim, and they tint mood/memory/conversation-context
without causing real consequences (no movement, no activities, no plot). v0.2:
events **emerge from real agent actions, cause real consequences, and form
chains** — the world stops being scripted and starts happening. This deepens the
spine further but is NOT a prerequisite for ① and ②.

## Where the spine data comes from (so we don't hand-author it all)
- **Souls** (`docs/soul/pilots/*.md`): each character's public/private self and
  implied relationships.
- **Runtime relationship state** (`schoolRelationships`: trust / respect /
  affection / closeness) — already used in the pilot prompt, under-used in the
  compact path.
- **Current character state** (emotion / intention / lingering memory).
- **recentEvents** (today's real happenings, even if currently injected).

Alan does not need to hand over a relationship map to start — it can be pulled
from the souls + the runtime relationship table. A specific backstory / comic
relationship map, if dropped into a doc later, would make the spine richer.

## Progress log
- 2026-06-17: roadmap written. (Prior groundwork: per-character residue lens,
  the opening-grounding block, and the 15-min pair cooldown — all early moves
  toward Stage ①.)
</content>

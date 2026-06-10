# Underworld UI Directions

Last updated: 2026-05-31.

Status: **design note (may decay).** This is direction, not a contract. The v0.1
ship gate lives in `docs/giis-v0.1-roadmap.md`; the soul/version ladder lives in
`docs/soul/SOUL_PROGRESSION_PLAN.md`. UI work should serve those, not lead them.

## Guiding principle

The product value (see `AGENTS.md`) is a **companion / coordinator layer that
helps Alan understand people, priorities, and world state without drowning
him** — not "more NPC chatter." Every UI decision is judged against the north
star: *Alan returns and feels yesterday mattered.* If a UI change does not make
emotional continuity more *felt* or reduce Alan's load, it is not v0.1 work.

## Directions (ordered by alignment with the north star)

### 1. Make emotional residue / memory visible

Today the whole emotional-continuity loop is **invisible to the player** — the
`殘留：…` lines live in prompts and memory, never on screen. So even when the
system *does* remember, Alan cannot feel it. The single most north-star-aligned
UI move is a very light "trace of yesterday" surface: on entry, a quiet
indication that the world remembers him and that something carried over. This
should feel like atmosphere, not a dashboard — never numeric emotion meters
(that is explicitly out of scope).

### 2. Separate player value from dev tooling

`ConversationWall` (對話牆) is fundamentally a **developer instrument** for
spotting slogan leakage and scanning fresh samples — useful, but not player
value. Keep it, but do not mistake it for the player-facing continuity view.
What a player wants is "what changed since yesterday," not a transcript archive.

### 3. Umi briefing as the emotional front door

The entry briefing is the load-reducing anchor of the whole product. It deserves
to be the most stable, warmest, and clearest surface — the place where Alan is
reoriented without being flooded. Treat it as the front door, not one panel
among many.

### 4. Freeze, don't churn, before v0.1 ships

Git history shows a long run of micro UI commits (character pills 6→3, bottom
action dock, focus card, presence button, period glyph…). That cadence is a
signal of **UI thrash**. Until v0.1 ships on evidence, the UI should be frozen at
"good enough" so effort goes back into sample collection and the playtest, not
pixel tuning.

## Explicitly deferred

Per the v0.1 roadmap, do not pull these forward:

- Mobile / tablet layouts.
- Major UI redesigns not directly supporting the v0.1 continuity loop.
- Numerical emotion dashboards or relationship graphs (out of scope by design —
  continuity must be *felt*, not metered).

## How this maps to the version ladder

- **v0.1:** direction 1 (residue visible, lightly) + direction 3 (briefing as
  front door) are the only UI changes that earn their place; directions 2 and 4
  are mostly discipline, not new build.
- **v0.2+ (Behavioral Drift):** once behavior drifts (shorter replies, lingering,
  avoidance, initiative), the UI may need to make *non-dialogue* expression
  legible — but that follows the engine, not before it. See
  `docs/soul/SOUL_PROGRESSION_PLAN.md`.

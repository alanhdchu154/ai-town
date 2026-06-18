# Underworld Soul Docs

This folder is the source of truth for GIIS Underworld character-soul design.

GIIS Underworld v0.1 is a persistent emotional social simulation where
characters slowly change through time, memory, relationships, and shared
atmosphere.

The goal is not "AI agents talking." The goal is a world where yesterday
emotionally matters.

It is an early prototype. It is not only a conversation system. The goal is for
characters to remember, care, change, and leave emotional traces over time.

## Start Here

- [Underworld Soul Architecture](./UNDERWORLD_SOUL_ARCHITECTURE.md)
- [Soul, Speech, and the Unsaid - Literature Bridge](./SOUL_SPEECH_LITERATURE_BRIDGE.md)
- [Soul Loop Literature Bridge](./SOUL_LOOP_LITERATURE_BRIDGE.md)
- [Soul Progression Plan](./SOUL_PROGRESSION_PLAN.md)
- [Autonomous Director Loop](./AUTONOMOUS_DIRECTOR_LOOP.md)

## Pilot Characters

- [Umi / 海](./pilots/umi.md)
- [Mahiru / 真晝](./pilots/mahiru.md)
- [Tianze / 天澤](./pilots/tianze.md)

## Secondary Cloud-Qwen Soul Profiles

These characters now have soul definitions so cloud Qwen conversations do not
fall back to thin persona blurbs. Local LLM remains smoke / backup only. They are
still secondary for v0.1 evaluation: use them for character identity, contrast,
and background continuity, but do not expand the main v0.1 acceptance target
beyond the emotional continuity loop.

- [Maomao / 貓貓](./pilots/maomao.md)
- [Ichinose / 一之瀨](./pilots/ichinose.md)
- [Sakiko / 祥子](./pilots/sakiko.md)

## Current Principle

Soul definitions are only Character DNA.

The current research bridge is: soul should become visible through what a
character notices, privately considers, socially filters, says, softens, delays,
or leaves unsaid. See
`docs/soul/SOUL_SPEECH_LITERATURE_BRIDGE.md`. The affective feedback bridge is:
events and conversations should leave residues that can color attention,
emotion, speech, memory selection, and tomorrow. See
`docs/soul/SOUL_LOOP_LITERATURE_BRIDGE.md`.

The next step is to make soul visible through:

- behavior
- memory
- emotional residue
- relationship drift
- daily continuity
- long-term self narrative

Progression path:

```text
Soul Definition
-> Soul Expression
-> Emotional Residue
-> Behavioral Drift
-> Relationship Drift
-> Daily Memory
-> Long-term Self Narrative
```

## Near-Term Priority

Do not fine-tune models yet.

v0.1 is now scoped to the smallest emotional continuity loop:

```text
conversation
-> emotional residue
-> memory continuity
-> small behavioral consequence
-> tomorrow feels different
```

Only three systems should drive near-term work:

1. Character soul expression:
   characters should speak and act in ways that fit their soul.
2. Conversation -> emotional residue:
   conversations should leave human traces, not numerical emotion meters.
3. Emotional residue -> memory continuity:
   important residue should return later when triggered by the same person,
   location, context, or unresolved issue.

Behavioral change is still important, but for v0.1 it should remain small and
emerge from memory/residue. Do not build a separate large behavior engine yet.

Stable evaluation should cover:

- emotional continuity
- memory continuity
- character authenticity
- small behavioral consequence
- human naturalness
- soul consistency

Then collect golden conversations and long-term drift samples. Only consider
fine-tuning after the soul architecture, harness, examples, and persistence
rules are stable.

Keep runtime soul work limited to the pilot trio:

- Umi
- Mahiru
- Tianze

Do not expand to every character yet. Do not create high-frequency emotional
writes. Do not make every emotional change dialogue-only. Do not turn emotion
into a dashboard of raw numbers such as sadness +3 or anger +5.

Deferred until later:

- giant relationship graphs;
- large civilization systems;
- full all-character LLM;
- major memory schema rewrites;
- fine-tuning;
- major UI systems;
- relationship/behavior engines that are not directly needed for residue and
  memory continuity.

## QA Loop

The semi-autonomous QA loop lives at:

- `scripts/run-soul-qa-loop.mjs`

Run one safe loop:

```bash
npm run eval:soul-qa-loop
```

Run every 30 minutes during an active testing window:

```bash
npm run eval:soul-qa-loop -- --loop --interval-ms=1800000
```

The loop prints fresh transcripts, runs soul and recent-conversation evals, and
writes:

- `umi/reports/soul-loop-latest.md`

If fresh sample count is below 3, the loop must report sample pending and not
modify code.

Golden conversation candidates may be archived under:

- `evals/conversations/golden/`

Large changes must be proposal-only under:

- `umi/proposals/`

## Autonomous Director Loop

Codex may keep observing the world, running evals, collecting fresh samples,
and tracking trends without approval.

Codex may diagnose failures semi-autonomously, but should not rewrite systems
just because an eval score is low.

Auto-repair is limited to hygiene and harness fixes:

- banned phrase leaks
- stage-direction leaks
- wrong speaker names
- duplicated UI labels
- deterministic fallback spam
- eval parser bugs
- logging/reporting issues

Anything involving memory architecture, relationship schema, emotional systems,
provider migration, major prompt rewrites, new autonomous behaviors, DB cleanup,
or soul architecture changes must become a proposal first.

Full operating contract:

- [Autonomous Director Loop](./AUTONOMOUS_DIRECTOR_LOOP.md)

Runnable v0.1 approach commands:

```bash
npm run underworld:observe
npm run underworld:repair-gate
npm run underworld:approach:v01
```

Useful safe variants:

```bash
npm run underworld:observe -- --dry-run --collect=skip --cc=skip
npm run underworld:approach:v01 -- --once --dry-run --collect=skip --cc=skip
```

Reports are written to:

- `umi/reports/v01-approach-latest.md`
- `umi/reports/v01-repair-gate-latest.md`

The approach loop runs observe passes frequently and calls the repair gate at
most every two hours. The repair gate reviews conversation evidence, asks cc for
a read-only second opinion when available, and decides whether the next action is
observe-only, a small targeted fix candidate, or a proposal-only larger change.
Provider outages, fresh sample counts below 3, or category mismatch should block
automatic repair.

## v0.1 Success

Alan returns and feels:

> Yesterday mattered.
> Today they are not exactly the same.

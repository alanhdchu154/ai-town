# AM -> PM Continuity Goal

## Summary

Today's continuity target is deliberately smaller than "yesterday affects today."

Question:

> Do morning conversations, emotional residue, and memory cues naturally return in the afternoon?

This is a natural-observation goal. Do not force conversations, manually seed events,
or tune prompts only to pass the eval. Keep the world running during the day, then
use the harness to inspect whether the afternoon remembers the morning.

## Test Windows

Timezone: `America/Chicago`

- Morning: `06:00-11:59`
- Afternoon: `13:00-16:59`

The noon hour is intentionally left out as a buffer between windows.

## Scope

Primary pilot:

- Umi / 海
- Mahiru / 真晝
- Asuna / 明日奈

Secondary observation only:

- CaoCao / 曹操
- Mai / 麻衣
- LiuBei / 劉備

Do not expand v0.1 scope to all characters. Secondary characters are useful as
background evidence for local LLM soul difference, but they are not the success
target for this goal.

## What Counts As Continuity

Afternoon continuity is good when a conversation naturally recalls or responds to
something from the morning, such as:

- a concrete emotional residue
- an unresolved concern
- a relationship pressure
- a repeated life cue
- a small behavior shift caused by an earlier exchange

Examples:

- Mahiru checks on Umi earlier because Umi sounded tired in the morning.
- Umi shortens a briefing because Alan or Asuna was overloaded earlier.
- Asuna hesitates before accepting another task because the morning already exposed
  the burden-carrier pattern.

The callback should feel like memory returning, not a log dump.

## Failure Modes

Mark as failure or warning when:

- afternoon conversations feel like a fresh reboot
- afternoon only repeats slogans or character catchphrases
- there are no `memoryTraces` or residue candidates from the morning
- fallback/template output is treated as memory
- the same emotional phrase returns without new behavior or relationship context
- the callback is generic and could belong to any character

## Report Command

Run once in the afternoon or evening:

```bash
npm run underworld:am-pm-continuity
```

The script is observe-only:

- reads current Convex archived conversations
- does not trigger conversations
- does not write to Convex
- writes the latest report to `umi/reports/am-pm-continuity-latest.md`

## Required Report Fields

Each report should include:

- morning sample count
- afternoon sample count
- AM residue candidates
- PM callbacks found
- PASS / WARN / FAIL
- worst 3 failures
- best continuity moment
- transcript snippets

If afternoon samples are fewer than 3, report `sample_pending` and do not recommend
prompt or runtime changes.

## Allowed Small Fixes

Only after enough fresh evidence, small auto-fixes may target:

- wrong addressee
- fallback contamination
- stage-direction leakage
- obvious echo / slogan repetition
- eval parser bugs

Everything else remains proposal-only.

## What Not To Do

Do not add schema, a new memory system, provider changes, forced conversation spam,
or a broader yesterday-to-today memory scope for this goal.

The goal is to see whether the same day already has a living emotional thread:

> Morning mattered, and afternoon is not a clean reset.

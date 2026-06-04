# AM -> PM Continuity Goal

## Summary

As of 2026-06-04, AM -> PM is a legacy day-arc cross-check. The primary v0.1
recent-memory gate is rolling two-hour continuity via:

```bash
npm run underworld:rolling-continuity
```

Today's continuity target is deliberately smaller than "yesterday affects today."

Question:

> Do morning conversations, emotional residue, and memory cues naturally return in the afternoon?

This is a natural-observation goal. Do not force conversations, manually seed events,
or tune prompts only to pass the eval. Keep the world running during the day, then
use the harness to inspect whether later windows remember earlier windows.

## Test Windows

Timezone: `America/Chicago`

- Morning: `06:00-11:59`
- Afternoon: `13:00-16:59`

The noon hour is intentionally left out as a buffer between windows.

## Scope

Primary pilot:

- Umi / 海
- Mahiru / 真晝
- Tianze / 天澤

Secondary observation only:

- CaoCao / 曹操
- Ichinose / 一之瀨
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
- a small behavior shift caused by an earlier exchange

Repeated life cues alone do **not** count as strong continuity. If the morning
mentions `作業 / 手 / Alan / 休息` and the afternoon merely mentions those again,
that is only a motif echo unless the afternoon clearly connects back to the
morning moment.

Strong continuity requires:

- the same relationship or character pair
- at least one specific non-generic cue from the morning
- an explicit morning callback (`早上你...`, `今天上午...`, etc.) or a PM memory
  trace that carries the morning residue forward
- behavior, tone, or availability changing because of that residue

Examples:

- Mahiru checks on Umi earlier because Umi sounded tired in the morning.
- Umi shortens a briefing because Alan or Tianze pushed a boundary earlier.
- Tianze stops before asking the second question because the morning already
  showed where the test started hurting someone.

The callback should feel like memory returning, not a log dump.

## Failure Modes

Mark as failure or warning when:

- afternoon conversations feel like a fresh reboot
- afternoon only repeats slogans or character catchphrases
- there are no `memoryTraces` or residue candidates from the morning
- fallback/template output is treated as memory
- the same emotional phrase returns without new behavior or relationship context
- the callback is generic and could belong to any character
- the callback only shares broad cues such as `Alan`, `手`, `休息`, `杯`, or `窗`
- the afternoon mentions the same motif but never indicates it remembers the
  morning moment

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

If afternoon samples are fewer than 12, report `sample_pending` and do not
recommend prompt or runtime changes. Fewer samples may show directional moments,
but they are not enough to judge AM -> PM day-arc continuity. A passing rolling
two-hour report can satisfy the v0.1 recent-memory gate before AM -> PM has
enough archived afternoon samples.

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

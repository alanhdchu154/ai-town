# Soul Memory Dynamics & Forgetting — design direction

Status: **design direction, not built.** Deferred to v0.2+. Recorded 2026-06-16
from an Alan/CC design conversation. The point of this note is to capture the
shape so it can be picked up at the right time without re-deriving it.

> A real soul does not just accumulate memories. Its emotional residue **shifts**,
> it **forgets**, and some things **sink so deep they can't be reached on their
> own** — yet were never truly erased.

## The core distinction: 記得 vs 主動想起

Two things that look the same but are not:

- **記得 (cued recall)** — "I can be *reminded* and then it comes back." The
  memory's text exists AND it has a retrieval handle, so a similar situation
  pulls it up.
- **主動想起 (active recall)** — "It comes up on its own, unprompted." The memory
  is salient enough to surface without a cue.

These are different reachabilities of the same stored memory, and the engine
already has the parts to model both.

## Where embeddings fit

An **embedding** turns a memory's text into a vector that captures its *meaning*;
memories with similar meaning sit close together. Recall works by embedding the
current situation and finding past memories whose meaning is nearby (semantic
search, not keyword match).

So: **the embedding IS the "能被提醒想起" line.** Remove a memory's embedding and
the *text still exists*, but the soul can no longer reach it by association —
only if something points at it directly. That is exactly "putting it in a very
deep place."

## Three tiers of reachability

| Tier | 對應 | Mechanism | Lost? |
| --- | --- | --- | --- |
| **Active** | 主動想起 / current preoccupation | high importance → loaded into the prompt proactively | no |
| **Cued** | 被提醒想起 | has an embedding → surfaced by vector search when context matches | no |
| **Deep / dormant** | 遺忘、沉很深 | embedding archived (not searchable); **text永久保留** | reachable only if pointed at |

**Forgetting = sinking, not deleting.** Not one character of memory text is ever
dropped (it is research data, kept forever — see `convex/crons.ts`, soul tables
are no longer vacuumed). Forgetting only changes *reachability*.

## The convergence (why this is elegant)

Keeping every embedding forever makes the vector count grow unbounded; past
~100k vectors, semantic search slows. The fix for that technical problem is to
**archive the embeddings of old / low-importance memories** while keeping the
text. But that archival **is** the forgetting mechanism above.

So the engineering need ("bound the vector count") and the soul design
("memories should be able to sink deep") are **the same act**. The ~100k-embedding
threshold is therefore the natural *trigger* to build this — not a date to guess.

## Residue is living, not static

Beyond reachability, the *emotional charge* of a memory should be able to change:

- **Re-consolidation** — a betrayal residue softens after reconciliation; a small
  kindness deepens when echoed later. Best done during sim-sleep, re-reading
  recent residues in light of newer ones. (The sleep-consolidation path already
  exists in skeleton form — WORKLOG #10.)
- **Decay + reinforcement** — importance drifts down over time (a forgetting
  curve) and bumps back up when a memory is re-encountered. Un-touched memories
  drift toward Deep; reinforced ones rise toward Active.

## Pieces that already exist to build on

- memory `importance` + `rankAndTouchMemories` (salience, touch-on-use)
- `memoryEmbeddings` + vector search (the cued-recall handle)
- sleep consolidation skeleton (the place to run re-consolidation/decay)
- residue source tagging (`llm_soul` vs deterministic) — keep soul-grounded only

A first cut is: a sleep-time pass that (1) decays importance, (2) moves the
oldest / lowest-importance memories to a Deep tier by **archiving their embedding
(not the text)**, (3) optionally re-reads and updates recent residues.

## Timing / how to approach

- **Do not build now.** At a few days old there isn't enough accumulated memory
  for forgetting to *mean* anything. Let the world run and thicken the substrate
  first.
- **Natural trigger:** when embeddings approach ~100k (or recall gets noisy) —
  that is when forgetting is *both* technically needed and emotionally
  meaningful. The two lines meet on their own.
- **Frame it as a soul feature, not cleanup.** "The soul lets a memory sink
  deep," never "delete old data." Text is permanent.

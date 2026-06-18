# Forgetting mechanism — bound embeddings = sink, never delete (spec)

Status: **spec for review (CC). Not implemented yet.** Time anchor 2026-06-17.
Author it in env-gated, dry-run-first increments (F0–F3), like
`docs/V0_2_EMERGENT_EVENTS_SPEC.md`. Do NOT big-bang.

## Why now (two birds)
Two problems share ONE solution:
1. **Stability (urgent, ~3-week M1 window):** the recurring world crashes are a
   Rust panic in the Convex local backend's **search-index archive-cache cleanup
   thread** (see `backend-crash-root-cause` note / WORKLOG #47). The search/vector
   index grows unbounded because WORKLOG #41 made soul data permanent (stopped
   vacuuming `memoryEmbeddings`). A smaller active vector index = less pressure on
   the (buggy) cleanup thread = fewer crashes on the constrained machine.
2. **Soul depth (on-strategy):** `docs/soul/MEMORY_DYNAMICS_AND_FORGETTING.md`
   already designed forgetting as **記得 (cued recall) vs 主動想起 (active recall)**,
   a three-tier reachability model (Active / Cued / Deep-dormant), where
   **forgetting = sinking deep, NEVER deleting text.**

Bounding embeddings IS the forgetting mechanism AND the crash mitigation. The
3-week hardware wait is the perfect window to build it.

## The mechanism (grounded in the real code)
Recall today (`convex/agent/memory.ts`):
- `searchMemories` → `ctx.vectorSearch('memoryEmbeddings', 'embedding', { filter
  playerId, limit })` (line ~1920) is the ONLY association path.
- `rankAndTouchMemories` (line ~1946) finds each memory via the `memories.embeddingId`
  index, ranks by recency+importance+relevance, and **touches `lastAccess`**.

Schema (`convex/agent/schema.ts`):
- `memories`: `{ description (the TEXT), embeddingId, importance, lastAccess,
  data.type ∈ relationship|conversation|reflection }` — indexes on `embeddingId`,
  `playerId`, `playerId_type`.
- `memoryEmbeddings`: `{ playerId, embedding }` with `.vectorIndex('embedding', …)`.

**Key insight:** removing a memory's row from `memoryEmbeddings` makes it
unreachable by `vectorSearch` (= deep-dormant / forgotten) while its `memories`
row + `description` text persist untouched. `lastAccess` + `importance` +
age are exactly the tiering signals #42 needs.

## The hard invariants (Alan's rules — non-negotiable)
- **Memory TEXT (`memories.description`) is NEVER deleted or modified.** Soul data
  stays permanent (WORKLOG #41).
- **Reversible:** a dormant embedding is ARCHIVED, not deleted — a forgotten
  memory can always be brought back (the #42 "cued → active" path). Forgetting is
  sinking, not destruction.
- **Conservative tiering:** only OLD + LOW-importance + LONG-unaccessed memories
  sink. Recent / important / relationship-defining memories stay active.
- **Env-gated, dry-run-first, bounded, logged** — like the v0.2 events consumer.

## Increments

### F0 — measure + dry-run report (READ-ONLY, no schema/writes)
- Count `memoryEmbeddings` and `memories`; distribution by age (createdAt /
  `_creationTime`), `importance`, `lastAccess`, and `data.type`.
- A read-only "what WOULD sink under threshold X" report (e.g. age > N days AND
  importance ≤ I AND lastAccess > M days). No mutation.
- Output: current index size + how many candidates each threshold would archive,
  so we pick a conservative threshold from real data, not a guess.
- Verifies the premise (is the index big enough to matter? which memories are
  genuinely cold?).

### F1 — archive table + pure tiering logic (tested, no live writes)
- New table `memoryEmbeddingsArchive` — SAME shape as `memoryEmbeddings` but with
  **NO `vectorIndex`** (so archived vectors never load the search cache / never get
  searched). Keep `playerId` + a back-pointer to the `memories` row.
- Optional, backward-compatible `memories` fields: `dormant?: boolean`,
  `dormantSince?: number`. Keep `embeddingId` semantics documented.
- Pure function `forgettingTier(memory, now, thresholds)` → `'active' |
  'dormant_candidate'`. Unit-tested against the F0 distribution. Never sinks
  `reflection` memories or anything above the importance floor.

### F2 — the archiver (env-gated, dry-run/write)
- `school:archiveDormantEmbeddings { write?, max? }` (pattern of
  `school:applyEmergentEventCandidates`):
  - `{write:false}` = no-side-effect dry-run (lists candidates).
  - `{write:true}` blocked unless `UNDERWORLD_FORGETTING=true`.
  - `max` clamped (e.g. 1–200/run); rate-limit; log to `umi/reports/forgetting.log`.
  - Per dormant candidate: copy embedding → `memoryEmbeddingsArchive`, **delete the
    `memoryEmbeddings` row** (shrinks the active vector index), set
    `memories.dormant=true/dormantSince`. **Never touch `description`.**
- Effect to measure: active `memoryEmbeddings` count drops → cleanup-thread
  pressure drops → crash frequency drops. Recall still works (cold memories were
  rarely surfaced anyway — that's why they were cold).

### F3 — reactivation / cued recall (LATER, after F2 proves the win)
- A dormant memory can be re-activated (re-insert its archived embedding into
  `memoryEmbeddings`, clear `dormant`) when explicitly cued — the #42
  Deep-dormant → Active path. Richer soul feature; not required for the stability
  win. Bounded + observable.

## Definition of done (per increment)
Each is "done" when: env-gated (F2+), has a test or reproducible dry-run, does not
delete/modify any `description` text, does not regress runtime preflight, and the
WORKLOG records the real before/after (active embedding count, and ideally crash
frequency over the following days).

## Non-goals / boundaries
- Not a memory deletion feature. Not a vacuum. Not cloud migration.
- Don't change recall ranking behavior for ACTIVE memories in F0–F2.
- Keep it disable-able by env so a collection run can pin it off if it destabilises.

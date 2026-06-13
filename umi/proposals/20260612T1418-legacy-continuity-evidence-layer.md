# Legacy Continuity Evidence Layer Proposal

Status: first live evidence write completed; prompt read/promotion not approved.

Generated: 2026-06-12 14:18 America/Chicago

## Problem

The old Underworld state contains real continuity evidence, but it also contains
fallback/pollution text, repeated food/fatigue motifs, legacy character names,
stage-direction leakage, and raw runtime/eval noise.

Restoring old state by direct sqlite surgery or bulk memory import would risk:

- reintroducing fallback memories into character prompts
- making old rows look like fresh v0.1 evidence
- reviving stale CaoCao/Liu Bei-era identity text
- forcing the fresh world to carry unbounded legacy data

But not restoring anything creates a different failure: characters effectively
forget their prior world, making long-term emotional-residue research
impossible.

## Recommendation

Create a separate `legacyContinuityEvidence` layer.

This should be distinct from live `memories`, `messages`, and
`archivedConversations`.

Default policy:

- imported legacy rows are not prompt-facing
- imported legacy rows are not fresh eval samples
- imported legacy rows are human-reviewable evidence
- promotion into live prompt memory is a later explicit decision

## Proposed Record Shape

```ts
legacyContinuityEvidence: defineTable({
  legacyArchive: v.boolean(),
  promptFacing: v.boolean(),
  freshEvalEligible: v.boolean(),
  reviewRequired: v.boolean(),
  importedAt: v.number(),
  importedBy: v.string(),
  sourceKind: v.string(),
  sourceId: v.optional(v.string()),
  sourceTableId: v.optional(v.string()),
  sourceTs: v.optional(v.number()),
  sourceCreatedAtIso: v.optional(v.string()),
  sourceDbPath: v.optional(v.string()),
  conversationIds: v.optional(v.array(v.string())),
  involvedNames: v.array(v.string()),
  valueScore: v.number(),
  suggestedRestoreShape: v.string(),
  summaryZh: v.string(),
  restoreReasonZh: v.string(),
  risks: v.optional(v.array(v.string())),
  residueDedupeKey: v.optional(v.string()),
  motifFamilyKey: v.optional(v.string()),
  approvalNoteZh: v.string(),
})
  .index("by_prompt_facing", ["promptFacing"])
  .index("by_source", ["sourceKind", "sourceId"])
  .index("by_conversation", ["conversationIds"])
```

Implementation note: Convex may require different indexing for array fields; if
so, use a normalized `primaryConversationId` plus the full array as metadata.

## Importer Boundary

Add an importer only after Alan approves this proposal.

Required command shape:

```bash
npm run underworld:legacy-continuity-import -- --dry-run
npm run underworld:legacy-continuity-import -- --write --approval=<token>
```

The importer must:

- read `umi/exports/legacy-continuity-import-plan-latest/dry-run-legacy-continuity-evidence.jsonl`
- default to dry-run
- require an explicit `--write` flag
- require an explicit approval token/string for write mode
- reject rows unless:
  - `legacyArchive === true`
  - `freshEvalEligible === false`
  - `promptFacing === false`
  - `reviewRequired === true`
  - source provenance fields exist
- print exact rows before writing
- cap first write to 12 rows or fewer
- write an import report under `umi/reports/`

## First-Pass Exclusions

Do not import these in the first pass:

- raw messages
- raw archived conversations
- participated-together rows
- school-world-pressure rows
- embeddings
- scheduled jobs / args
- engine/world/input runtime rows
- Alan behavior profiles
- notifications
- food-care motif rows
- stage-direction leak rows
- repeated motif-family rows
- fallback/pollution rows
- legacy-character identity rows

These may remain in exported evidence for future human review.

## Read Path

Initial read path:

- none

After import, characters should not see `legacyContinuityEvidence` in prompts.
The first value is auditability and recovery, not immediate behavior change.

Future read path, proposal-only:

1. Human marks a legacy evidence row as safe.
2. A separate promotion command creates a short live memory/residue summary.
3. That promoted summary includes provenance and never pretends to be fresh.
4. Eval explicitly separates legacy recall from fresh v0.1 behavior.

## Eval Policy

Legacy evidence rows must not count as:

- fresh post-change conversations
- new residue generation
- current-day behavior samples
- proof that yesterday affected today

They can be used to answer:

- what old continuity exists
- which old commitments/residues may be worth preserving
- whether old memory pollution exists

## Rollback

Because this is a separate table, rollback is simple:

```text
delete rows where legacyArchive === true and importedBy === <import run id>
```

Do not delete old archive files or exported packages during rollback.

## Approval Decision

Alan approval is required before:

- writing any row into live Convex
- reading legacy evidence into prompts
- promoting legacy evidence into live memory/residue

## 2026-06-12 Implementation Result

Implemented after Alan approved the schema + dry-run boundary:

- `convex/schema.ts` now defines `legacyContinuityEvidence`.
- The table uses `primaryConversationId` for the conversation index and keeps
  full `conversationIds` as metadata.
- `scripts/underworld-legacy-continuity-import.mjs` validates the dry-run plan
  and writes a dry-run report.
- `npm run underworld:legacy-continuity-import` produced:
  - valid rows: 12
  - rejected rows: 0
  - prompt-facing rows: 0
  - fresh-eval-eligible rows: 0
- `--write` mode is intentionally blocked and throws an explicit error.

Still not approved:

- reading legacy evidence into prompts
- promoting legacy evidence into live memories/residues

## 2026-06-12 Live Evidence Write Result

Alan approved the first live write into the separate evidence layer.

Implemented:

- `convex/legacyContinuity.ts`
  - `importLegacyContinuityEvidence`
  - `legacyContinuityEvidenceSummary`
- `scripts/underworld-legacy-continuity-import.mjs --write` now requires:
  `--approval=alan-approved-legacy-continuity-2026-06-12`
- Convex mutation also verifies the same approval token and row invariants.
- Duplicate writes are skipped by `sourceKind` + `sourceId`.

Write result:

- inserted rows: 12
- total `legacyContinuityEvidence` rows after write: 12
- duplicate rerun total: still 12
- prompt-facing rows: 0
- fresh-eval-eligible rows: 0

Verification:

```bash
npm run underworld:legacy-continuity-import:self-test
npm run underworld:legacy-continuity-import
npm run underworld:legacy-continuity-import -- --write --approval=wrong-token
npm run underworld:legacy-continuity-import -- --write --approval=alan-approved-legacy-continuity-2026-06-12 --imported-by=codex-20260612-alan-approved
npx convex run --typecheck disable --codegen disable legacyContinuity:legacyContinuityEvidenceSummary
npx tsc --noEmit --pretty false
npm run build
```

Boundary after write:

- The old evidence is now stored in Convex, but isolated.
- It is not read by character prompts.
- It is not counted as fresh v0.1 evidence.
- It is not promoted into `memories`.

## cc Review Summary

cc reviewed the earlier dry-run plan and recommended:

- keep `promptFacing: false`
- use a separate table/read path
- shrink the first packet to 8-12 distinct rows
- dedupe by conversation/residue, not leading timestamp
- down-rank repeated curry/food/fatigue motifs
- avoid treating Alan behavior profiles as first-pass memory

Codex accepted these points. The current dry-run plan is 12 rows and remains
human-review only.

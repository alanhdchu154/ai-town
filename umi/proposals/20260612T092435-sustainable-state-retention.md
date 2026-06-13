# Underworld Sustainable State Retention Proposal

Status: active design; code changes still require normal verification.

Generated: 2026-06-12 09:24 America/Chicago

## Why This Exists

Alan correctly objected to treating fresh-world reset as the default recovery
strategy. A long-term emotional social simulation cannot require characters to
forget themselves every 20 days.

The goal is to preserve:

- character memory
- emotional residue
- relationship continuity
- archived dialogue evidence
- daily state / world atmosphere

while preventing local Convex runtime state from growing until the backend
cannot boot.

## Current Evidence

Old active state was archived, not deleted:

```text
/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town-archive-20260612T085455-pre-fresh-world
```

Diagnostics on copies showed:

- sqlite `quick_check=ok`
- active/copy sqlite was 6.3 GiB
- whole archived state was about 18 GiB
- `VACUUM INTO` reduced a copy to 4.0 GiB
- sandbox boot against the compacted copy still did not bind port 3210 within
  60 seconds and reached about 4 GiB RSS
- the dominant bloat was Convex internal scheduled-job / scheduled-job-arg
  history, not character memories

cc reviewed this and identified the likely byte-rate source:

- `agentDoSomething` scheduled jobs currently carry whole serialized runtime
  snapshots, including map data and animated sprite arrays
- this data is repeated into Convex internal `_scheduled_job_args`
- the old world grew roughly like a runtime/job-history problem, not a soul
  memory problem

## Keep vs Prune Boundary

### Preserve

These are the soul / continuity surface:

- `messages`
- `archivedConversations`
- `participatedTogether`
- `memories`
- `memoryEmbeddings`
- `experienceLogs`
- `schoolProfiles`
- `schoolRelationships`
- `schoolTimeline`
- `schoolWorldPressure`
- `alanPresence`
- daily/briefing/commitment state

Do not solve DB size by deleting these first. Their byte cost is small relative
to the runtime bloat, and they are the reason the world exists.

### Candidate Runtime Bloat

These may be pruned, shrunk, compacted, or redesigned:

- scheduled job args that contain full map/player/agent snapshots
- old processed `inputs`
- soft-deleted `worlds` / `engines` versions
- repeated full-world rewrites from clock/schedule updates
- old local storage artifacts
- local backup copies

## Recommended Prevention Algorithm

### T1 — Slim Scheduled Agent Args

Change `agentDoSomething` scheduling to pass IDs only:

```text
worldId, agentId, playerId, operationId
```

Then load the current world/map/free-player context inside the action.

Expected effect:

- stops copying map tiles / animated sprite arrays into scheduled job args
- attacks the largest known byte-rate source
- preserves behavior and memory semantics

This is the highest-leverage first code change.

### T2 — Diff Before World Patches

When schedule/clock movement computes the same player state, skip patching the
`worlds` document.

Expected effect:

- fewer soft-deleted `worlds` versions
- lower MVCC churn

### T3 — Move Large Historical Runtime Bytes Out Of `worlds`

Investigate extracting large historical/runtime location data from the hot
`worlds` document into a bounded table.

This is a schema change and should remain a later proposal until T1/T2 are
measured.

### T4 — Cursor-Aware Input Retention

Delete only engine inputs older than the engine's processed cursor minus a
safety margin.

This is safer than the current age-only vacuum and avoids deleting inputs the
engine could still need.

### T5 — State Health Probe

Extend the morning healthcheck to log:

- sqlite size
- freelist size
- active state directory size
- daily delta
- top known growth signals if available

Warn before state growth reaches the next boot-failure threshold.

## Archived World Recovery Strategy

Do not try to make the 18 GiB archive boot by direct sqlite surgery first.

Safer path:

1. Copy the archive.
2. Export the preserve-list continuity tables from the copy to JSON.
3. Import them into the fresh world as historical evidence with an
   `importedFrom` / `legacyArchive` marker.
4. Keep them out of fresh-sample eval windows.
5. Spot-check known conversations and memories.

This recovers continuity as data without requiring the old runtime engine state
to boot.

## What Not To Do

- Do not delete the archive.
- Do not delete character memories to save space.
- Do not direct-delete Convex internal scheduled jobs in the original archive.
- Do not treat imported old rows as fresh-world sample evidence.
- Do not make fresh reset the normal recovery pattern.

## First Implementation Recommendation

Do T1 now:

> Slim `agentDoSomething` scheduled args from whole runtime snapshots to IDs,
> then load context inside the action.

This protects all future runs and is reversible if behavior regresses.

## 2026-06-12 T1 Implementation Result

Implemented:

- `convex/aiTown/agent.ts` now schedules `agentDoSomething` with only:
  `worldId`, `playerId`, `agentId`, and `operationId`.
- `convex/aiTown/agentOperations.ts` now loads current player / agent / map /
  free-player context inside the action through
  `loadAgentDoSomethingContext`.
- No character memory, emotional residue, archived conversations, provider
  policy, schema, or old archive data was modified.

Verification:

```bash
npx tsc --noEmit --pretty false
npm test -- --runInBand convex/aiTown/agentOperations.test.ts convex/aiTown/agent.test.ts
npm run build
CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS=180 npx convex run --typecheck disable --codegen disable world:defaultWorldStatus
CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS=180 npx convex run --typecheck disable --codegen disable school:debugState
curl -I http://localhost:5173/ai-town
```

Result:

- Typecheck passed.
- Targeted Jest passed: 12 / 12.
- Build passed with the existing chunk-size warning.
- Fresh world status is `running`.
- `school:debugState` returned the 6 active characters.
- `/ai-town` returned HTTP 200.

Next:

- Measure scheduled-job arg growth after T1.
- Design old-archive continuity export/import as data.
- Consider T2 diff-before-patch only after T1 is observed under a normal run.

## 2026-06-12 Post-T1 State Audit Result

Codex added a read-only local state audit:

```bash
npm run underworld:state-audit
npm run underworld:state-audit:self-test
```

Report outputs:

- Fresh active state:
  `umi/reports/state-growth-audit-latest.md`
- Archived old state, fast bounded scan:
  `umi/reports/state-growth-audit-archive-20260612T085455.md`

The tool reads the local Convex sqlite database and writes Markdown reports. It
does not compact, delete, restore, or mutate state.

Fresh active baseline after T1:

- state dir: about 42 MiB
- sqlite: about 36 MiB
- documents: about 10k rows
- latest scheduled args are small ID-only payloads:
  `worldId`, `playerId`, `agentId`, `operationId`, plus small conversation /
  run-step payloads
- older queued large map/snapshot payloads still exist in the fresh state
  because they were scheduled before T1, but they are not appearing at the top
  of the latest rows after fresh runtime ticks
- follow-up active audit at 2026-06-12 10:12 CDT passed against the live backend
  after adding sqlite busy-timeout/retry for transient `database is locked`
  windows; current active state was sqlite 45.9 MiB / state dir 86 MiB /
  1,254 scheduled-arg rows scanned

Archived old state fast scan:

- state dir: 18 GiB
- local storage: 6.6 GiB
- sqlite: 6.3 GiB
- documents: 1,564,343 rows, 260,614 deleted
- indexes: 1,030,097 rows
- freelist: about 2.1 GiB
- latest old scheduled args still include repeated 95-98 KiB
  map/player/agent snapshot payloads

Interpretation:

- T1 appears to be working for new scheduled `agentDoSomething` rows.
- The old archive was genuinely suffering from repeated runtime snapshot
  payloads in scheduled job args.
- The next growth sources to study are repeated `worlds`, `engines`, and
  `inputs` versions from normal engine ticks and processed input churn.

## 2026-06-12 Curated Restore Candidate Result

Codex added read-only candidate and dry-run planning tools:

```bash
npm run underworld:continuity-restore-candidates
npm run underworld:legacy-continuity-import-plan
```

Outputs:

- `umi/reports/curated-continuity-candidates-latest.md`
- `umi/exports/curated-continuity-candidates-latest/`
- `umi/reports/legacy-continuity-import-plan-latest.md`
- `umi/exports/legacy-continuity-import-plan-latest/`

Current candidate classification after cc review tightening:

- Tier 1 review candidates: 219
- Review-only candidates: 5,793
- Reject / evidence-only rows: 11,301
- The candidate packet writes capped 80 / 80 / 80 samples for human review.
- The sampler now marks stage-direction leakage, legacy-character names,
  pollution-adjacent conversation IDs, repeated motif families, and broad
  lore/politics as review/reject risks.

Current dry-run import plan:

- 12 proposed `legacyContinuityEvidence` rows
- 12 skipped candidates
- no Convex writes
- skips first-pass food-care motifs, stage-direction leaks, repeated motif
  families, duplicate summaries, and non-first-restore kinds
- all proposed rows have:
  - `legacyArchive: true`
  - `freshEvalEligible: false`
  - `promptFacing: false`
  - `reviewRequired: true`

Interpretation:

- The old world contains recoverable continuity, especially commitment /
  emotional-residue / relationship traces.
- The first restore must be a separate legacy evidence layer, not direct memory
  spam.
- cc reviewed the first 24-row packet and found it too duplicated / motif-heavy.
  Codex accepted the critique and tightened the sampler/plan.
- The 12-row plan is still a human-review packet, not an approved import.
- Any live importer still needs Alan approval and should target a separate
  non-prompt-facing `legacyContinuityEvidence` layer first.

## Archive Continuity Export Boundary

The old archive should be recovered as continuity data, not by booting or
mutating the old runtime state first.

Export candidates:

- `messages`
- `archivedConversations`
- `participatedTogether`
- `memories`
- `memoryEmbeddings` only if needed for later retrieval, otherwise keep as
  optional sidecar
- `experienceLogs` / emotional residue
- `schoolTimeline`
- `schoolWorldPressure`
- profile / relationship / daily state docs

Import boundary:

- imported rows must carry `legacyArchive` / `importedFrom` metadata
- imported rows must not count as fresh v0.1 samples
- imported residue should be curated or summarized before it affects prompts
- no direct sqlite surgery on the archive
- no destructive purge until Alan approves the exact delete/export boundary

Recommended next implementation:

1. Add an archive export script that shape-classifies continuity tables from a
   copied or archived sqlite DB and writes JSONL/Markdown under `umi/exports/`.
2. Start with export-only: no import, no mutation.
3. Spot-check known Alan/Umi/Mahiru conversations and memory rows.
4. Then decide whether to build a curated import path into the fresh world.

T2 recommendation:

- Add diff-before-write only where it is clearly no-op safe.
- Do not pretend this solves all growth: `Game.takeDiff()` currently includes
  `historicalLocations` and `Game.saveDiff()` replaces the whole `worlds`
  document each step, so the deeper fix may require moving hot runtime history
  out of the `worlds` document. That is a schema/design proposal, not a stealth
  patch.

## 2026-06-12 Export-Only Continuity Package

Implemented:

```bash
npm run underworld:archive-continuity-export
npm run underworld:archive-continuity-export:self-test
```

Script:

- `scripts/underworld-archive-continuity-export.mjs`

Output:

- `umi/exports/archive-continuity-latest/`

Behavior:

- reads the archived sqlite DB in readonly mode
- shape-classifies continuity rows
- writes JSONL files plus a manifest and README
- does not include embeddings by default
- does not import, mutate, compact, delete, or repair Convex state

Archive export result after classifier fix:

- rows scanned: 87,751
- rows exported: 56,525
- package size: about 40 MiB
- exported files:
  - `archived_conversations.jsonl`: 4,154
  - `messages.jsonl`: 25,449
  - `memories.jsonl`: 5,974
  - `school_timeline.jsonl`: 5,478
  - `notifications.jsonl`: 3,061
  - `participated_together.jsonl`: 10,210
  - `school_world_pressure.jsonl`: 2,046
  - `alan_behavior_profiles.jsonl`: 88
  - `agent_descriptions.jsonl`: 30
  - `player_descriptions.jsonl`: 35

Interpretation:

- The old 18 GiB world now has a small export-only continuity package.
- This is enough for review, sampling, and future curated import design.
- It is not yet memory restoration. No rows have been imported into the fresh
  world.

Next import-design gate:

1. audit the export for fallback pollution / stale renamed characters
2. pick a small curated subset, probably Alan-facing + Umi/Mahiru/Tianze first
3. design an import schema that stores imported rows as `legacyArchive` evidence
   rather than fresh memories
4. require Alan approval before import

## 2026-06-12 Continuity Package Audit Result

Implemented:

```bash
npm run underworld:continuity-package-audit
npm run underworld:continuity-package-audit:self-test
```

Report:

- `umi/reports/continuity-package-audit-latest.md`

Current verdict:

- `REVIEW_REQUIRED`

Findings:

- archived conversations are now present
- fallback/pollution-like hits: 14
  - by kind: memories 3, messages 11
  - includes the known Alan/Umi fallback-like "依賴/喜歡" and
    "世界變得太聰明" family
- legacy CaoCao/Liu Bei-era hits: 8,066
  - mostly historical messages, memories, notifications, and descriptions
  - these are not all "bad"; they need alias/remap or historical-label review
- rows that should not be directly imported: 41,924
  - raw messages
  - archived conversations
  - participated-together rows
  - school-world-pressure rows
  - agent/player descriptions

Import implication:

- The export is usable as evidence.
- It is not safe for direct bulk import.
- First restoration should be curated and probably limited to:
  - clean Alan/Umi memories
  - clean Umi/Mahiru/Tianze memories
  - selected timeline rows
  - selected Alan behavior profile summaries
- Raw transcripts remain evidence for summarization, not live prompt memory.

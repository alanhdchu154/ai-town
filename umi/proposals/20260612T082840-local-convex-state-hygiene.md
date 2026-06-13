# Local Convex State Hygiene Proposal

Status: proposal-only; requires Alan approval before destructive cleanup,
state restore, or DB replacement.

Generated: 2026-06-12 08:28 America/Chicago

## Problem

During the 2026-06-12 v0.1 morning push, Underworld's frontend could serve
HTML, but the local Convex backend stopped responding on port 3210. A controlled
Umi/Mahiru sample then failed before collection because `convex run
world:defaultWorldStatus` waited for the local backend to start.

After a clean LaunchAgent restart, a single `convex-local-backend --port 3210`
process ran for more than 5 minutes without binding port 3210. It consumed high
CPU and up to several GB of RAM while reading the local state. The active local
sqlite file is approximately 6.3 GB:

```text
/Users/alanhdchu/.convex/convex-backend-state/local-alan_chu-ai_town/convex_local_backend.sqlite3
```

The state path is a symlink to T9:

```text
/Users/alanhdchu/.convex/convex-backend-state/local-alan_chu-ai_town
-> /Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town
```

## Evidence

- `curl http://localhost:3210/version` failed with connection refused.
- `curl -I http://localhost:5173/ai-town` initially returned HTTP 200 while
  Vite was up, proving the frontend was not the primary blocker.
- Logs showed:
  - repeated `Invalid conversation ID c:103698`
  - repeated `Your request timed out performing too many system operations`
  - `game:loadWorld` timeout
  - `sendInput` timeout
  - dead engine restart
- Process inspection initially found multiple concurrent
  `convex-local-backend --port 3210` processes, partly caused by retries while
  the backend was not ready. After stopping them and restarting only the
  LaunchAgent, one backend remained but still did not bind port 3210 after more
  than 5 minutes.
- The active sqlite file is 6.3 GB; an older backup exists at about 5.0 GB:
  `backups/convex_local_backend.2026-05-22T04-42-45-280Z.sqlite3.bak`.

## Expected Gain

Restore a reliable local world loop so v0.1 work can proceed:

- frontend + Convex both boot cleanly
- `world:defaultWorldStatus` and `school:debugState` respond
- controlled samples can be collected without orphaning active conversations
- Alan-facing chats do not hang behind a backend that is still starting

## Risks

- Deleting or replacing local Convex state can destroy current world memory,
  conversations, residues, profile updates, and continuity evidence.
- Restoring the May 22 backup could lose all later v0.1 memory/system evidence.
- Direct sqlite surgery could corrupt the local backend if done while the
  backend is running or without a verified copy.
- Shrinking old conversations/memories may improve startup but could also remove
  evidence needed for continuity eval or the paper track.

## Proposed Safe Sequence

Do not run these steps without Alan approval.

1. Stop the dev stack and confirm no local backend is running.
2. Create a fresh timestamped copy of the entire active state directory on T9.
3. Run read-only sqlite checks on the copied DB, not the live DB:
   - integrity check
   - largest table inventory
   - document-count inventory by Convex table if accessible
4. Produce a dry-run cleanup plan:
   - candidate old archived conversations
   - candidate old messages
   - candidate generated timeline/noise events
   - candidate fallback/template memories already marked as pollution
   - estimated rows and bytes saved
5. Ask Alan to choose one:
   - keep state and tolerate slow startup
   - archive old history externally and compact local DB
   - restore from verified backup
   - create a fresh local world and preserve old state as read-only archive
6. Only after approval, apply the chosen path to a copy first, then switch the
   symlink and verify:
   - `curl http://localhost:3210/version`
   - `npx convex run world:defaultWorldStatus`
   - `npx convex run school:debugState`
   - `curl -I http://localhost:5173/ai-town`

## Rollback Plan

- Keep the pre-cleanup state directory copy untouched.
- If the new/compacted/restored state fails verification, stop the backend,
  switch the symlink back to the pre-cleanup copy, restart, and re-run the same
  checks.

## Files / State Affected

Potentially affected:

- `/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town/**`
- `/Users/alanhdchu/.convex/convex-backend-state/local-alan_chu-ai_town`
  symlink target only if switching copies.

Not affected by this proposal:

- repo source files
- Qwen/cloud provider settings
- generated art assets
- committed docs/evals

## What Happened This Session

The dev stack was intentionally stopped at 08:28 CDT to prevent the stuck local
backend from continuing to consume memory and CPU. This is a protective stop,
not a data cleanup.

## 2026-06-12 Diagnostic Addendum

Codex created a non-destructive diagnostic copy and ran sqlite checks against
the copy only. See:

`umi/reports/local-convex-state-diagnostic-latest.md`

Findings:

- Diagnostic copy `PRAGMA quick_check`: `ok`.
- Active/copy sqlite: 6.3 GiB.
- Freelist: about 2.1 GiB.
- `VACUUM INTO` compacted copy: 4.0 GiB, `quick_check` `ok`, freelist 0.
- Largest bloat is Convex internal `_scheduled_job_args` / `_scheduled_jobs`,
  not character memories.
- `_scheduled_job_args` carries large `$bytes` payloads that include agent/map
  state.

cc reviewed the diagnostic and agreed that compacted-sqlite replacement was a
conditional smallest recovery only if a sandbox boot test passed.

Sandbox boot test result:

- A sandbox directory was created from the compacted sqlite and copied
  `convex_local_storage/`.
- `convex-local-backend` was started manually against that sandbox on port 3210
  while the normal dev stack was stopped.
- `http://localhost:3210/version` did not respond within 60 seconds.
- The sandbox backend reached about 4.0GB RSS after roughly 74 seconds and still
  had not bound 3210.
- The sandbox backend was stopped.

Updated recommendation:

- Do **not** directly swap the compacted sqlite into the live state yet.
- Option A is no longer proven sufficient.
- If Alan wants v0.1 momentum today, prefer a fresh local world with the old
  state preserved as a read-only archive.
- If Alan wants to preserve continuity first, investigate supported Convex
  cleanup/reset mechanisms for scheduled job history on a copy before touching
  the active state.

## 2026-06-12 Fresh World Recovery Addendum

Alan approved the v0.1 momentum path: create a fresh active local world while
preserving the old state as an archive.

Completed:

- Old active state moved to:
  `/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town-archive-20260612T085455-pre-fresh-world`
- Fresh active directory recreated at:
  `/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town`
- Only Convex local deployment `config.json` was copied back from the archive;
  old sqlite/storage data was not copied back.
- `npx convex run init` created a fresh default world.
- `world:defaultWorldStatus` returned a running default world.
- `school:debugState`, `school:worldClock`, and `school:umiBriefing` returned
  without timeout.
- `curl -I http://localhost:5173/ai-town` returned HTTP 200.
- Fresh active state size after initialization: about 3.6 MiB.
- Archived old state size: about 18 GiB.

Current status:

- This proposal is implemented for Option B.
- Do not delete the archive.
- Do not treat old archived conversations as fresh post-recovery samples.
- Next v0.1 work should collect new fresh-world samples before making further
  dialogue or residue changes.

## 2026-06-12 Sustainable Retention Addendum

Alan objected that fresh-world reset cannot be the default answer. That
objection is accepted: Underworld cannot support long-term emotional-residue
research if characters must forget themselves every time local state grows too
large.

Follow-up proposal:

`umi/proposals/20260612T092435-sustainable-state-retention.md`

Revised direction:

- Preserve old archive as continuity evidence.
- Recover old character memory as data, not by booting the whole old runtime
  state first.
- Do not delete memory/conversation/residue tables as the primary space fix.
- Prevent future growth by shrinking scheduled job args and runtime churn.
- First code target: make `agentDoSomething` scheduled jobs pass IDs only
  instead of full map/player/agent snapshots.

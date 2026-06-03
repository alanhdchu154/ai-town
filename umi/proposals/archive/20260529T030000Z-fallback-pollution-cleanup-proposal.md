# Fallback Pollution Cleanup Proposal

Generated: 2026-05-29T03:00:00Z
Status: proposal_only

## Problem

The v0.1 goal is to protect Umi / Mahiru / Tianze character-soul conversations from local fallback contamination before judging fresh samples.

Forward guards now prevent generated fallback and repeated motif loops from entering new archived character-soul dialogue. However, read-only cleanup dry-run still finds legacy fallback-like pollution in current runtime state.

## Evidence

Command:

```bash
npm run underworld:cleanup-fallback-pollution:dry-run
```

Report:

```text
umi/reports/fallback-pollution-cleanup-latest.md
```

Dry-run counts:

- Archived conversation docs: 0, retained by policy
- Message docs: 0
- Memory docs: 48
- Embedding docs: 48
- World event docs: 174
- Notification docs: 12
- Profile docs patched: 2
- Archived fallback-like conversations found in audit: 248, not cleaned by dry-run policy

Examples include repeated Umi memories from 2026-05-23 about:

```text
今晚先少接一件事。明天我會提醒 Alan：先看人，不是先加功能。
```

and repeated Mahiru notifications:

```text
真晝感覺 Alan 的世界仍有被溫柔照顧的空間。
```

The dry-run also identifies profile cleanup candidates for Ichinose and Mahiru.

## Expected Gain

Cleaning active non-archived fallback pollution may reduce the chance that tomorrow's Umi / Mahiru / Tianze samples are influenced by old fallback memories, events, notifications, or profile text.

This could make fresh sample evaluation more honest:

- fewer legacy fallback phrases resurfacing as memory
- cleaner residue / memory continuity signal
- clearer distinction between current LLM behavior and old state pollution

## Risks

- This is DB cleanup and should not be auto-applied.
- Some fallback-like text may have become part of Alan's observed world history.
- Removing world events or memories can change tomorrow's context.
- Profile patching can alter character state in a way that affects fresh samples.
- Archived conversations should remain retained as historical evidence unless Alan explicitly approves a separate archival cleanup.

## Rollback Strategy

Before apply, capture:

```bash
npm run underworld:cleanup-fallback-pollution:dry-run
npx convex run school:auditFallbackPollution '{"limit":1000}'
```

If apply is approved, keep the generated dry-run report and the post-apply report. Rollback may require restoring from Convex local backup or replaying saved document snapshots; therefore this should not be treated as a trivial reversible edit.

## Files / Commands Affected

- `scripts/underworld-cleanup-fallback-pollution.mjs`
- `convex/school.ts` cleanup/audit functions
- report: `umi/reports/fallback-pollution-cleanup-latest.md`

Potential apply command, only after Alan approval:

```bash
npm run underworld:cleanup-fallback-pollution:dry-run -- --apply=true
```

Do not include archived conversations unless Alan separately approves:

```bash
-- --apply=true --include-archived-conversations=true
```

## Why Not Smaller Fix

Forward-only guards are already in place. They prevent new contamination, but do not remove legacy active-state pollution from memories/events/notifications/profiles.

A smaller code-only fix would not answer whether tomorrow's fresh samples are influenced by old fallback residue.

## Recommendation

Do not apply tonight.

Tomorrow morning:

1. Run `npm run underworld:observe:daytime-samples`.
2. If fresh samples show legacy fallback phrases or memory contamination, ask Alan whether to apply active-state cleanup.
3. If fresh samples are clean, keep cleanup as proposal-only and avoid touching DB.


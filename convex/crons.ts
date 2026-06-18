import { cronJobs } from 'convex/server';
import { DELETE_BATCH_SIZE, IDLE_WORLD_TIMEOUT, VACUUM_MAX_AGE } from './constants';
import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { TableNames } from './_generated/dataModel';
import { v } from 'convex/values';

const crons = cronJobs();

crons.interval(
  'stop inactive worlds',
  { seconds: IDLE_WORLD_TIMEOUT / 1000 },
  internal.world.stopInactiveWorlds,
);

crons.interval('restart dead worlds', { seconds: 60 }, internal.world.restartDeadWorlds);

// Opt-in (UNDERWORLD_KEEP_WORLD_ALIVE=true): keep the default world running
// continuously even with no browser open, so the characters keep living/talking.
crons.interval('keep default world alive', { seconds: 60 }, internal.world.keepDefaultWorldAlive);

// Occasionally drop a small spontaneous campus event so school life has some
// unscheduled texture even while no one is watching. Self-capped to a couple per
// day, spaced out, in school:seedSpontaneousCampusEventTick.
crons.interval(
  'seed spontaneous campus events',
  { minutes: 45 },
  internal.school.seedSpontaneousCampusEventTick,
);

crons.daily('vacuum old entries', { hourUTC: 4, minuteUTC: 20 }, internal.crons.vacuumOldEntries);

export default crons;

const TablesToVacuum: TableNames[] = [
  // Inputs are just the engine's replay/event log (not research data), so they
  // are safe to age out.
  'inputs',

  // 2026-06-18 (CC audit, Tier 4): these two are the unbounded heavy writers on
  // the always-on sim loop and the top near-term crash risk on the no-GC local
  // backend. They are observability/log data, NOT permanent soul data:
  //   - worldEvents: appendRecentEvent (12 call-sites) + one per Alan chat message.
  //   - schoolNotifications: one row on every emotion change + several other paths.
  // All readers are recency-based (dashboards / eval / recent feed read the last
  // hours-to-days), so age-based vacuum (VACUUM_MAX_AGE = 14d) bounds growth
  // without dropping anything a reader needs. The structured emotion timeline now
  // lives in the separately-capped `emotionChanges` table, so vacuuming the
  // emotion_changed notifications loses nothing the 情緒波動 dashboard shows.
  'worldEvents',
  'schoolNotifications',

  // 2026-06-16 (Alan, explicit): SOUL DATA IS PERMANENT. `memories` and
  // `memoryEmbeddings` are the emotional-residue research record — the whole
  // point of long-term soul growth — so they are intentionally NOT vacuumed.
  // The upstream default deleted them after VACUUM_MAX_AGE, which would have
  // silently erased ~14-day-old soul memories; that is removed here.
  //   'memories',          // never auto-delete — permanent
  //   'memoryEmbeddings',  // never auto-delete — permanent
  // Watch-out for later: keeping every embedding forever means the vector count
  // grows unbounded; past ~100k vectors, vector search slows (a gradual
  // degradation, not a failure). If that bites, tier/archive OLD embeddings to
  // a side store while keeping the memory TEXT — do NOT just delete memories.
  //
  // Note: `conversationMembers` / `conversations` / `messages` are also left
  // un-vacuumed; they grow slowly and are raw transcript context.
];

export const vacuumOldEntries = internalMutation({
  args: {},
  handler: async (ctx, args) => {
    const before = Date.now() - VACUUM_MAX_AGE;
    for (const tableName of TablesToVacuum) {
      console.log(`Checking ${tableName}...`);
      const exists = await ctx.db
        .query(tableName)
        .withIndex('by_creation_time', (q) => q.lt('_creationTime', before))
        .first();
      if (exists) {
        console.log(`Vacuuming ${tableName}...`);
        await ctx.scheduler.runAfter(0, internal.crons.vacuumTable, {
          tableName,
          before,
          cursor: null,
          soFar: 0,
        });
      }
    }
  },
});

export const vacuumTable = internalMutation({
  args: {
    tableName: v.string(),
    before: v.number(),
    cursor: v.union(v.string(), v.null()),
    soFar: v.number(),
  },
  handler: async (ctx, { tableName, before, cursor, soFar }) => {
    const results = await ctx.db
      .query(tableName as TableNames)
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', before))
      .paginate({ cursor, numItems: DELETE_BATCH_SIZE });
    for (const row of results.page) {
      await ctx.db.delete(row._id);
    }
    if (!results.isDone) {
      await ctx.scheduler.runAfter(0, internal.crons.vacuumTable, {
        tableName,
        before,
        soFar: results.page.length + soFar,
        cursor: results.continueCursor,
      });
    } else {
      console.log(`Vacuumed ${soFar + results.page.length} entries from ${tableName}`);
    }
  },
});

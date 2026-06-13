import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const LEGACY_CONTINUITY_APPROVAL = 'alan-approved-legacy-continuity-2026-06-12';

const legacyContinuityEvidenceInput = v.object({
  legacyArchive: v.boolean(),
  promptFacing: v.boolean(),
  freshEvalEligible: v.boolean(),
  reviewRequired: v.boolean(),
  importedAt: v.number(),
  importedBy: v.string(),
  importRunId: v.string(),
  sourceKind: v.string(),
  sourceId: v.string(),
  sourceTableId: v.optional(v.string()),
  sourceTs: v.optional(v.number()),
  sourceCreatedAtIso: v.optional(v.string()),
  sourceDbPath: v.optional(v.string()),
  primaryConversationId: v.optional(v.string()),
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
});

export const importLegacyContinuityEvidence = mutation({
  args: {
    approval: v.string(),
    rows: v.array(legacyContinuityEvidenceInput),
  },
  handler: async (ctx, args) => {
    if (args.approval !== LEGACY_CONTINUITY_APPROVAL) {
      throw new Error('legacy continuity import approval token mismatch');
    }
    if (args.rows.length > 12) {
      throw new Error(`legacy continuity import is capped at 12 rows, got ${args.rows.length}`);
    }

    const insertedIds = [];
    const skipped = [];
    for (const row of args.rows) {
      validateLegacyContinuityEvidenceRow(row);
      const existing = await ctx.db
        .query('legacyContinuityEvidence')
        .withIndex('source', (q) => q.eq('sourceKind', row.sourceKind).eq('sourceId', row.sourceId))
        .first();
      if (existing) {
        skipped.push({
          sourceKind: row.sourceKind,
          sourceId: row.sourceId,
          reason: 'already_imported',
        });
        continue;
      }
      const insertedId = await ctx.db.insert('legacyContinuityEvidence', row);
      insertedIds.push(insertedId);
    }

    return {
      inserted: insertedIds.length,
      skipped: skipped.length,
      insertedIds,
      skippedRows: skipped,
    };
  },
});

export const legacyContinuityEvidenceSummary = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('legacyContinuityEvidence').collect();
    return {
      count: rows.length,
      promptFacing: rows.filter((row) => row.promptFacing).length,
      freshEvalEligible: rows.filter((row) => row.freshEvalEligible).length,
      byRun: countBy(rows.map((row) => row.importRunId)),
      latest: rows
        .slice()
        .sort((a, b) => b.importedAt - a.importedAt)
        .slice(0, 12)
        .map((row) => ({
          sourceKind: row.sourceKind,
          sourceId: row.sourceId,
          involvedNames: row.involvedNames,
          promptFacing: row.promptFacing,
          freshEvalEligible: row.freshEvalEligible,
          summaryZh: row.summaryZh.slice(0, 160),
        })),
    };
  },
});

function validateLegacyContinuityEvidenceRow(row: {
  legacyArchive: boolean;
  promptFacing: boolean;
  freshEvalEligible: boolean;
  reviewRequired: boolean;
  sourceKind: string;
  sourceId: string;
  summaryZh: string;
}) {
  if (row.legacyArchive !== true) throw new Error('legacyArchive must be true');
  if (row.promptFacing !== false) throw new Error('promptFacing must be false');
  if (row.freshEvalEligible !== false) throw new Error('freshEvalEligible must be false');
  if (row.reviewRequired !== true) throw new Error('reviewRequired must be true');
  if (!row.sourceKind || !row.sourceId) throw new Error('sourceKind/sourceId required');
  if (!row.summaryZh || row.summaryZh.length < 24) throw new Error('summaryZh too short');
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

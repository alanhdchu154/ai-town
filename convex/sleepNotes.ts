import { v } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';

const SLEEP_NOTES_APPROVAL = 'alan-approved-sleep-notes-2026-06-12';
const MAX_SLEEP_NOTE_ROWS_PER_RUN = 8;
const MAX_PROMPT_NOTES = 1;
const BLOCKED_PROMPT_NOTE_PATTERN =
  /fallback|deterministic|ABORT_CONVERSATION|stage_direction|stage direction|prompt|資料庫|系統|AI 社|學生會|校園協調|情緒脈絡|記憶層級|標籤|判斷|conversation p:/i;

const sleepNoteInput = v.object({
  sourceKind: v.union(
    v.literal('legacyContinuityEvidence'),
    v.literal('sleepConsolidation'),
    v.literal('experienceLog'),
    v.literal('manual'),
  ),
  sourceEvidenceId: v.string(),
  sourceConversationId: v.optional(v.string()),
  legacyArchive: v.boolean(),
  promptFacing: v.boolean(),
  freshEvalEligible: v.boolean(),
  reviewStatus: v.union(
    v.literal('review_only'),
    v.literal('promoted'),
    v.literal('rejected'),
    v.literal('archived'),
  ),
  noteType: v.union(
    v.literal('long_term_memory_candidate'),
    v.literal('emotional_residue_candidate'),
    v.literal('short_term_context'),
    v.literal('relationship_trace'),
  ),
  subjectName: v.string(),
  participantNames: v.array(v.string()),
  noteZh: v.string(),
  usageHintZh: v.string(),
  riskTags: v.array(v.string()),
  motifHash: v.string(),
  importance: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  expiresAt: v.optional(v.number()),
  promotedAt: v.optional(v.number()),
  promotedBy: v.optional(v.string()),
  approvalNoteZh: v.string(),
});

export const importSleepNotes = mutation({
  args: {
    approval: v.string(),
    rows: v.array(sleepNoteInput),
  },
  handler: async (ctx, args) => {
    if (args.approval !== SLEEP_NOTES_APPROVAL) {
      throw new Error('sleep notes approval token mismatch');
    }
    if (args.rows.length > MAX_SLEEP_NOTE_ROWS_PER_RUN) {
      throw new Error(`sleep notes import is capped at ${MAX_SLEEP_NOTE_ROWS_PER_RUN} rows, got ${args.rows.length}`);
    }

    const insertedIds = [];
    const skippedRows = [];
    for (const row of args.rows) {
      validateSleepNote(row);
      const existing = await ctx.db
        .query('sleepNotes')
        .withIndex('source', (q) =>
          q
            .eq('sourceKind', row.sourceKind)
            .eq('sourceEvidenceId', row.sourceEvidenceId)
            .eq('subjectName', row.subjectName),
        )
        .first();
      if (existing) {
        skippedRows.push({
          sourceKind: row.sourceKind,
          sourceEvidenceId: row.sourceEvidenceId,
          subjectName: row.subjectName,
          reason: 'already_imported',
        });
        continue;
      }
      const motifDuplicate = await ctx.db
        .query('sleepNotes')
        .withIndex('motif', (q) => q.eq('subjectName', row.subjectName).eq('motifHash', row.motifHash))
        .first();
      if (motifDuplicate) {
        skippedRows.push({
          sourceKind: row.sourceKind,
          sourceEvidenceId: row.sourceEvidenceId,
          subjectName: row.subjectName,
          reason: 'duplicate_motif',
        });
        continue;
      }
      insertedIds.push(await ctx.db.insert('sleepNotes', row));
    }

    return {
      inserted: insertedIds.length,
      skipped: skippedRows.length,
      insertedIds,
      skippedRows,
    };
  },
});

export const promptSleepNotes = internalQuery({
  args: {
    subjectName: v.string(),
    otherName: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? MAX_PROMPT_NOTES, MAX_PROMPT_NOTES));
    const rows = await ctx.db
      .query('sleepNotes')
      .withIndex('subjectPrompt', (q) =>
        q
          .eq('subjectName', args.subjectName)
          .eq('promptFacing', true)
          .eq('reviewStatus', 'promoted'),
      )
      .order('desc')
      .take(16);
    return rows
      .filter((row) => !row.expiresAt || row.expiresAt > Date.now())
      .filter((row) => !args.otherName || row.participantNames.includes(args.otherName))
      .slice(0, limit)
      .map((row) => ({
        noteZh: row.noteZh,
        usageHintZh: row.usageHintZh,
        noteType: row.noteType,
        createdAt: row.createdAt,
        legacyArchive: row.legacyArchive,
      }));
  },
});

export const sleepNotesSummary = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('sleepNotes').collect();
    return {
      count: rows.length,
      promptFacing: rows.filter((row) => row.promptFacing).length,
      promoted: rows.filter((row) => row.reviewStatus === 'promoted').length,
      reviewOnly: rows.filter((row) => row.reviewStatus === 'review_only').length,
      freshEvalEligible: rows.filter((row) => row.freshEvalEligible).length,
      bySubject: countBy(rows.map((row) => row.subjectName)),
      latest: rows
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12)
        .map((row) => ({
          subjectName: row.subjectName,
          participantNames: row.participantNames,
          promptFacing: row.promptFacing,
          reviewStatus: row.reviewStatus,
          noteType: row.noteType,
          legacyArchive: row.legacyArchive,
          freshEvalEligible: row.freshEvalEligible,
          noteZh: row.noteZh,
          createdAt: row.createdAt,
          promotedAt: row.promotedAt,
        })),
    };
  },
});

function validateSleepNote(row: {
  sourceKind: string;
  sourceEvidenceId: string;
  legacyArchive: boolean;
  promptFacing: boolean;
  freshEvalEligible: boolean;
  reviewStatus: 'review_only' | 'promoted' | 'rejected' | 'archived';
  subjectName: string;
  participantNames: string[];
  noteZh: string;
  usageHintZh: string;
  riskTags: string[];
  motifHash: string;
  importance: number;
  promotedAt?: number;
  promotedBy?: string;
}) {
  if (!row.sourceKind || !row.sourceEvidenceId) throw new Error('sourceKind/sourceEvidenceId required');
  if (!row.subjectName || !row.participantNames.includes(row.subjectName)) {
    throw new Error('subjectName must be included in participantNames');
  }
  if (row.legacyArchive && row.freshEvalEligible) {
    throw new Error('legacy sleep notes must not be fresh-eval eligible');
  }
  if (row.promptFacing && row.reviewStatus !== 'promoted') {
    throw new Error('promptFacing sleep notes must be promoted');
  }
  if (row.reviewStatus === 'promoted' && (!row.promotedAt || !row.promotedBy)) {
    throw new Error('promoted sleep notes require promotedAt/promotedBy');
  }
  if (!row.noteZh || row.noteZh.length < 12 || row.noteZh.length > 150) {
    throw new Error('noteZh must be 12-150 chars');
  }
  if (!row.usageHintZh || row.usageHintZh.length > 140) {
    throw new Error('usageHintZh required and must be short');
  }
  if (!row.motifHash || row.motifHash.length < 8) throw new Error('motifHash required');
  if (row.importance < 1 || row.importance > 10) throw new Error('importance must be 1-10');
  if (row.riskTags.some((risk) => /fallback|stage_direction|malformed|slogan/.test(risk))) {
    throw new Error(`blocked risk tag for prompt-safe sleep note: ${row.riskTags.join(', ')}`);
  }
  if (row.promptFacing && BLOCKED_PROMPT_NOTE_PATTERN.test(row.noteZh)) {
    throw new Error('prompt-facing sleep note contains blocked drift or system wording');
  }
  if (row.promptFacing && BLOCKED_PROMPT_NOTE_PATTERN.test(row.usageHintZh)) {
    throw new Error('prompt-facing sleep note usage hint contains blocked drift or system wording');
  }
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.entries(counts).map(([name, count]) => ({ name, count }));
}

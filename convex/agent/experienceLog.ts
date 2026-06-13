import { v } from 'convex/values';
import { internalMutation, query } from '../_generated/server';
import { Doc } from '../_generated/dataModel';
import { conversationId, playerId } from '../aiTown/ids';
import { wouldRepairConversationAddresseeText } from '../aiTown/addresseeRepair';
import { isGeneratedFallbackText } from '../modelPolicy';
import {
  hasDialogueSystemPhraseLeak,
  hasThirdPersonSelfNarrationLeak,
  stripStageDirectionsFromDialogue,
} from './dialogueHygiene';
import { hasMemoryPostProcessingDrift } from './memory';

// Underworld experience-log MVP. Compact, bounded lived-history rows for
// the current v0.1 evidence pilot. Writes are intentionally narrow: only
// active pilot characters, only after the existing memory archival
// gates pass, deduped per-day, capped per-day. Nothing in the prompt or
// belief read path reads from this table yet — it is a substrate for the
// v0.1 evidence question: does conversation create residue that survives sleep?

// Canonical display names for the current v0.1 evidence pilot. This follows
// the live roster; legacy characters and absent pilots are intentionally
// rejected so they cannot become fresh v0.1 evidence by accident.
export const EXPERIENCE_LOG_PILOT_NAMES = new Set(['海', '真晝', '貓貓', '天澤', '一之瀨', '祥子']);

const PILOT_NAME_BY_RAW: Record<string, string> = {
  Umi: '海',
  '朝凪海': '海',
  '海': '海',
  Mahiru: '真晝',
  'Mahiru Shiina': '真晝',
  '椎名真晝': '真晝',
  '真晝': '真晝',
  Maomao: '貓貓',
  '貓貓': '貓貓',
  Tianze: '天澤',
  '天澤': '天澤',
  '天澤一夏': '天澤',
  '天擇': '天澤',
  '天擇一夏': '天澤',
  Ichinose: '一之瀨',
  '一之瀨': '一之瀨',
  '一之瀨帆波': '一之瀨',
  Sakiko: '祥子',
  '祥子': '祥子',
};

export function pilotExperienceLogName(name: string | undefined | null): string | null {
  if (!name) return null;
  const direct = PILOT_NAME_BY_RAW[name];
  if (direct) return EXPERIENCE_LOG_PILOT_NAMES.has(direct) ? direct : null;
  const trimmed = PILOT_NAME_BY_RAW[name.trim()];
  if (!trimmed) return null;
  return EXPERIENCE_LOG_PILOT_NAMES.has(trimmed) ? trimmed : null;
}

export const EXPERIENCE_LOG_PER_DAY_CAP = 2;
export const EXPERIENCE_LOG_DEFAULT_TTL_DAYS = 30;
const EXPERIENCE_LOG_SUMMARY_MAX = 140;
const EXPERIENCE_LOG_INTERP_MAX = 80;
const EXPERIENCE_LOG_RESIDUE_MAX = 96;
const EXPERIENCE_LOG_SEED_MAX = 80;
const EXPERIENCE_LOG_DEDUPE_PREFIX = 24;
const EXPERIENCE_LOG_RESIDUE_PATTERN_PREFIX = 14;
const GIIS_WORLD_START_REAL_DATE = Date.UTC(2026, 4, 19, 5, 0, 0);

export type ExperienceLogImportance = 'low' | 'medium' | 'high';

export type ExperienceLogDraft = {
  characterName: string;
  otherCharacterName: string;
  involvedCharacters: string[];
  eventSummary: string;
  emotionalInterpretation: string;
  residue: string;
  beliefSeed: string;
  behaviorHint: string;
  importance: ExperienceLogImportance;
};

export type DraftRejection =
  | 'not_pilot_pair'
  | 'fallback_or_drift'
  | 'wrong_addressee'
  | 'echo_or_stage_direction'
  | 'empty_summary';

export type ExperienceLogDraftInput = {
  playerName: string;
  otherPlayerName: string;
  summary: string;
  residue: string;
  messages: Array<{ author?: string; text: string }>;
};

export type ExperienceLogDraftResult =
  | { ok: true; draft: ExperienceLogDraft }
  | { ok: false; reason: DraftRejection };

function clampText(text: string, max: number) {
  const cleaned = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, Math.max(1, max - 1)) + '…';
}

function looksLikeJunkText(text: string) {
  if (!text) return false;
  return (
    isGeneratedFallbackText(text) ||
    hasDialogueSystemPhraseLeak(text) ||
    hasMemoryPostProcessingDrift(text)
  );
}

function hasStageDirectionLeak(text: string) {
  if (!text) return false;
  if (hasThirdPersonSelfNarrationLeak(text)) return true;
  return stripStageDirectionsFromDialogue(text).strippedStageDirection;
}

function hasWrongAddresseeLeak(
  selfCanonical: string,
  otherCanonical: string,
  messages: Array<{ author?: string; text: string }>,
) {
  return messages.some((message) => {
    const author = pilotExperienceLogName(message.author);
    const other =
      author === selfCanonical ? otherCanonical : author === otherCanonical ? selfCanonical : otherCanonical;
    return wouldRepairConversationAddresseeText(message.text, author ?? selfCanonical, other);
  });
}

function normalizedForEcho(text: string) {
  return text
    .replace(/\s+/g, '')
    .replace(/[，,。！？!?；;：「」『』"'（）()、…—\-]/g, '')
    .trim();
}

export function hasObviousExperienceEcho(
  messages: Array<{ author?: string; text: string }>,
) {
  const normalized = messages.map((message) => normalizedForEcho(message.text)).filter(Boolean);
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    if (previous.length < 10 || current.length < 10) continue;
    if (previous === current) return true;
    const shortest = Math.min(previous.length, current.length);
    if (shortest >= 14 && (previous.includes(current) || current.includes(previous))) return true;
    const prefix = Math.min(shortest, 18);
    if (prefix >= 14 && previous.slice(0, prefix) === current.slice(0, prefix)) return true;
  }
  return false;
}

export function draftConversationExperienceLog(
  input: ExperienceLogDraftInput,
): ExperienceLogDraftResult {
  const selfCanonical = pilotExperienceLogName(input.playerName);
  const otherCanonical = pilotExperienceLogName(input.otherPlayerName);
  if (!selfCanonical || !otherCanonical || selfCanonical === otherCanonical) {
    return { ok: false, reason: 'not_pilot_pair' };
  }
  // Defense in depth: the rememberConversation path already rejects
  // fallback / drift / system-phrase leaks, but the mutation is internal
  // and could be called directly. Re-checking the summary, residue, and
  // raw transcript prevents a misuse from quietly persisting junk into
  // the bounded experience log.
  const dirty =
    looksLikeJunkText(input.summary) ||
    looksLikeJunkText(input.residue) ||
    input.messages.some((message) => looksLikeJunkText(message.text));
  if (dirty) {
    return { ok: false, reason: 'fallback_or_drift' };
  }
  if (hasWrongAddresseeLeak(selfCanonical, otherCanonical, input.messages)) {
    return { ok: false, reason: 'wrong_addressee' };
  }
  const formDirty =
    hasStageDirectionLeak(input.summary) ||
    hasStageDirectionLeak(input.residue) ||
    input.messages.some((message) => hasStageDirectionLeak(message.text)) ||
    hasObviousExperienceEcho(input.messages);
  if (formDirty) {
    return { ok: false, reason: 'echo_or_stage_direction' };
  }
  const cleanSummary = clampText(input.summary, EXPERIENCE_LOG_SUMMARY_MAX);
  if (!cleanSummary) return { ok: false, reason: 'empty_summary' };
  const cleanResidue = clampText(input.residue, EXPERIENCE_LOG_RESIDUE_MAX);

  const eventSummary = clampText(
    `${selfCanonical}與${otherCanonical}：${cleanSummary}`,
    EXPERIENCE_LOG_SUMMARY_MAX + 24,
  );
  const emotionalInterpretation = clampText(
    interpretEmotion(selfCanonical, cleanSummary, cleanResidue),
    EXPERIENCE_LOG_INTERP_MAX,
  );
  const beliefSeed = clampText(
    extractBeliefSeed(cleanSummary, cleanResidue),
    EXPERIENCE_LOG_SEED_MAX,
  );
  const behaviorHint = clampText(
    extractBehaviorHint(cleanSummary, cleanResidue),
    EXPERIENCE_LOG_SEED_MAX,
  );
  const importance = importanceFor(cleanResidue, beliefSeed, behaviorHint);

  return {
    ok: true,
    draft: {
      characterName: selfCanonical,
      otherCharacterName: otherCanonical,
      involvedCharacters: [selfCanonical, otherCanonical],
      eventSummary,
      emotionalInterpretation,
      residue: cleanResidue,
      beliefSeed,
      behaviorHint,
      importance,
    },
  };
}

function interpretEmotion(self: string, summary: string, residue: string) {
  const text = `${summary} ${residue}`;
  if (/累|疲|擔心|害怕|不安|疏遠/.test(text)) {
    return `${self}心裡留下了一點未說完的疲憊與擔心。`;
  }
  if (/責任|決定|承諾|答應|不再/.test(text)) {
    return `${self}覺得自己又多承擔了一份具體的責任。`;
  }
  if (/笑|溫暖|安心|靠近|看見|聽見/.test(text)) {
    return `${self}感覺這段對話有一點被接住的溫度。`;
  }
  return `${self}記得對方在這段對話裡的語氣。`;
}

function extractBeliefSeed(summary: string, residue: string) {
  const text = `${summary} ${residue}`;
  if (/一個人|獨自|沒人|扛/.test(text)) return '不是所有事都該自己一個人扛。';
  if (/Alan|校長/.test(text)) return 'Alan 也需要有人幫他把擔心放下來。';
  if (/休息|累|睡|安靜/.test(text)) return '休息也是一種被允許的事。';
  if (/信任|承諾|答應/.test(text)) return '答應的事，要記得留時間真的去做。';
  return '';
}

function extractBehaviorHint(summary: string, residue: string) {
  const text = `${summary} ${residue}`;
  if (/休息|累|安靜|疲/.test(text)) return '下次見到對方時，先問一句「你今天還好嗎」。';
  if (/責任|決定|承諾/.test(text)) return '若再遇到類似話題，先把責任拆成兩個人可以一起接的。';
  if (/Alan|校長/.test(text)) return '把 Alan 的擔心留在自己心裡前，先問對方一次。';
  return '';
}

function importanceFor(
  residue: string,
  beliefSeed: string,
  behaviorHint: string,
): ExperienceLogImportance {
  if (residue && beliefSeed) return 'high';
  if (residue || beliefSeed || behaviorHint) return 'medium';
  return 'low';
}

export type ExperienceLogDedupeRow = {
  characterName: string;
  eventSummary: string;
  source: { otherPlayerId: string };
};

export function isSimilarExperienceLog(
  existing: ExperienceLogDedupeRow,
  candidate: ExperienceLogDedupeRow,
) {
  if (existing.characterName !== candidate.characterName) return false;
  if (existing.source.otherPlayerId !== candidate.source.otherPlayerId) return false;
  const a = existing.eventSummary.slice(0, EXPERIENCE_LOG_DEDUPE_PREFIX);
  const b = candidate.eventSummary.slice(0, EXPERIENCE_LOG_DEDUPE_PREFIX);
  return a.length > 0 && a === b;
}

export function isRepeatedResidueSpam(recentResidues: string[], candidateResidue: string) {
  if (!candidateResidue) return false;
  const prefix = candidateResidue.slice(0, EXPERIENCE_LOG_RESIDUE_PATTERN_PREFIX);
  if (prefix.length < EXPERIENCE_LOG_RESIDUE_PATTERN_PREFIX) return false;
  return recentResidues.length >= 2 && recentResidues.every((r) => r.startsWith(prefix));
}

export function worldDayFromTimestamp(timestamp: number, worldStartRealDate?: number) {
  const start = worldStartRealDate ?? GIIS_WORLD_START_REAL_DATE;
  return Math.max(1, Math.floor((timestamp - start) / 86_400_000) + 1);
}

function compactExperienceLogRow(row: Doc<'experienceLogs'>) {
  return {
    characterId: row.playerId,
    characterName: row.characterName,
    otherCharacterName: row.source.otherCharacterName,
    sourceConversationId: row.source.conversationId,
    eventSummary: row.eventSummary,
    emotionalInterpretation: row.emotionalInterpretation,
    emotionalResidue: row.residue,
    residue: row.residue,
    possibleBeliefSeed: row.beliefSeed,
    beliefSeed: row.beliefSeed,
    behaviorHint: row.behaviorHint,
    importance: row.importance,
    involvedCharacters: row.involvedCharacters,
    day: row.day,
    timestamp: row.timestamp,
    createdAt: row.createdAt,
    expiresAfterDays: row.expiresAfterDays,
    conversationId: row.source.conversationId,
  };
}

export const recordExperienceLogIfEligible = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    otherPlayerId: playerId,
    conversationId,
    sourceKind: v.literal('archivedConversation'),
    playerName: v.string(),
    otherPlayerName: v.string(),
    summary: v.string(),
    residue: v.string(),
    messageTexts: v.array(v.string()),
    messages: v.optional(v.array(v.object({
      authorName: v.optional(v.string()),
      text: v.string(),
    }))),
    conversationStartedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Contract: this writer is only called after memory.ts loads a real
    // archivedConversations row for the current world.
    const draftResult = draftConversationExperienceLog({
      playerName: args.playerName,
      otherPlayerName: args.otherPlayerName,
      summary: args.summary,
      residue: args.residue,
      messages: args.messages?.map((message) => ({
        author: message.authorName,
        text: message.text,
      })) ?? args.messageTexts.map((text) => ({ text })),
    });
    if (!draftResult.ok) {
      return { written: false as const, reason: draftResult.reason };
    }
    const { draft } = draftResult;

    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    const day = worldDayFromTimestamp(
      args.conversationStartedAt,
      worldStatus?.worldStartRealDate,
    );

    // Bounded read: cap is small, so over-fetching slightly is cheap and
    // lets us reuse the same rows for cap, dedupe, and residue-spam.
    const recent = await ctx.db
      .query('experienceLogs')
      .withIndex('worldCharacter', (q) =>
        q
          .eq('worldId', args.worldId)
          .eq('characterName', draft.characterName)
          .eq('day', day),
      )
      .order('desc')
      .take(EXPERIENCE_LOG_PER_DAY_CAP + 2);

    if (recent.length >= EXPERIENCE_LOG_PER_DAY_CAP) {
      return { written: false as const, reason: 'cap_reached' as const };
    }
    const candidateRow: ExperienceLogDedupeRow = {
      characterName: draft.characterName,
      eventSummary: draft.eventSummary,
      source: { otherPlayerId: args.otherPlayerId },
    };
    if (recent.some((row) => isSimilarExperienceLog(row, candidateRow))) {
      return { written: false as const, reason: 'duplicate' as const };
    }
    if (recent.some((row) => row.source.conversationId === args.conversationId)) {
      return { written: false as const, reason: 'conversation_duplicate' as const };
    }
    if (
      isRepeatedResidueSpam(
        recent.map((row) => row.residue).filter((residue): residue is string => Boolean(residue)),
        draft.residue,
      )
    ) {
      return { written: false as const, reason: 'residue_spam' as const };
    }

    const now = Date.now();
    await ctx.db.insert('experienceLogs', {
      worldId: args.worldId,
      playerId: args.playerId,
      characterName: draft.characterName,
      eventSummary: draft.eventSummary,
      emotionalInterpretation: draft.emotionalInterpretation,
      residue: draft.residue,
      beliefSeed: draft.beliefSeed,
      behaviorHint: draft.behaviorHint,
      importance: draft.importance,
      source: {
        conversationId: args.conversationId,
        otherPlayerId: args.otherPlayerId,
        otherCharacterName: draft.otherCharacterName,
      },
      involvedCharacters: draft.involvedCharacters,
      day,
      timestamp: args.conversationStartedAt,
      createdAt: now,
      expiresAfterDays: EXPERIENCE_LOG_DEFAULT_TTL_DAYS,
    });
    return { written: true as const, reason: 'ok' as const, day, importance: draft.importance };
  },
});

// Read-only inspection surface. Bounded take so a misconfigured caller
// cannot pull the whole table. Optionally filtered by character.
export const recentExperienceLogs = query({
  args: {
    worldId: v.id('worlds'),
    characterName: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    if (args.characterName) {
      const rows = await ctx.db
        .query('experienceLogs')
        .withIndex('worldCharacter', (q) =>
          q.eq('worldId', args.worldId).eq('characterName', args.characterName!),
        )
        .order('desc')
        .take(limit);
      return rows.map(compactExperienceLogRow);
    }
    const rows = await ctx.db
      .query('experienceLogs')
      .withIndex('worldDay', (q) => q.eq('worldId', args.worldId))
      .order('desc')
      .take(limit);
    return rows.map(compactExperienceLogRow);
  },
});

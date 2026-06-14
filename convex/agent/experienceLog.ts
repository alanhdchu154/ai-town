import { v } from 'convex/values';
import { internalMutation, query } from '../_generated/server';
import { Doc } from '../_generated/dataModel';
import { conversationId, playerId } from '../aiTown/ids';
import { wouldRepairConversationAddresseeText } from '../aiTown/addresseeRepair';
import { isGeneratedFallbackText } from '../modelPolicy';
import {
  hasFirstPersonStageDirectionLeak,
  hasDialogueSystemPhraseLeak,
  hasThirdPersonSelfNarrationLeak,
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
  | 'empty_summary'
  | 'no_residue'
  | 'non_soul_residue';

export type ExperienceLogDraftInput = {
  playerName: string;
  otherPlayerName: string;
  summary: string;
  residue: string;
  residueSource?: 'llm_soul' | 'deterministic' | 'none';
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
  return hasFirstPersonStageDirectionLeak(text);
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
  if (!cleanResidue) return { ok: false, reason: 'no_residue' };
  if ((input.residueSource ?? 'llm_soul') !== 'llm_soul') {
    return { ok: false, reason: 'non_soul_residue' };
  }

  const eventSummary = clampText(
    subjectiveExperienceSummary(selfCanonical, otherCanonical, cleanSummary, cleanResidue),
    EXPERIENCE_LOG_SUMMARY_MAX + 24,
  );
  const emotionalInterpretation = clampText(
    interpretEmotion(selfCanonical, otherCanonical, cleanSummary, cleanResidue),
    EXPERIENCE_LOG_INTERP_MAX,
  );
  const beliefSeed = clampText(
    extractBeliefSeed(selfCanonical, otherCanonical, cleanSummary, cleanResidue),
    EXPERIENCE_LOG_SEED_MAX,
  );
  const behaviorHint = clampText(
    extractBehaviorHint(selfCanonical, otherCanonical, cleanSummary, cleanResidue),
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

function subjectiveExperienceSummary(
  self: string,
  other: string,
  summary: string,
  residue: string,
) {
  const text = `${summary} ${residue}`;
  if (self === '海') {
    if (/Alan|校長|簡報|整理|有用|扛|負擔|責任|休息/.test(text)) {
      return `對海來說，${other}碰到的是她把擔心整理成任務時漏出的疲態。`;
    }
    return `對海來說，${other}讓這段對話短暫離開了「下一件事」的節奏。`;
  }
  if (self === '真晝') {
    if (/累|休息|安靜|沒說完|停頓|看見|照顧/.test(text)) {
      return `對真晝來說，${other}那個沒有說完的部分，比事情本身更需要被照看。`;
    }
    return `對真晝來說，${other}留下的是一個下次要更早注意的細小反應。`;
  }
  if (self === '天澤') {
    if (/不要|不用|自己來|拒絕|邊界|停手|試探/.test(text)) {
      return `對天澤來說，${other}的拒絕不是結束，而是邊界終於露出形狀。`;
    }
    return `對天澤來說，${other}在這段對話裡露出了一個還不能急著推開的壓力點。`;
  }
  if (self === '一之瀨') {
    if (/幫|照顧|溫柔|拒絕|自己來|距離|接受/.test(text)) {
      return `對一之瀨來說，${other}讓她記得好意需要先被允許，不能直接替人扣上答案。`;
    }
    return `對一之瀨來說，${other}的反應像一筆還沒有結清的信任帳。`;
  }
  if (self === '貓貓') {
    if (/手|抖|藥|症狀|反應|涼|皺|沒吃|抽屜/.test(text)) {
      return `對貓貓來說，${other}留下的是一個還不能下診斷、但需要追蹤的小徵象。`;
    }
    return `對貓貓來說，${other}的話不是結論，而是下次觀察的起點。`;
  }
  if (self === '祥子') {
    if (/靠近|禮貌|拒絕|自己來|邊界|鎮定|練習室|舞台/.test(text)) {
      return `對祥子來說，${other}的靠近碰到了她努力維持住的鎮定和距離。`;
    }
    return `對祥子來說，${other}讓這段對話停在一個還不用完全打開的位置。`;
  }
  return `對${self}來說，${other}在這段對話裡留下了一個下次要重新確認的反應。`;
}

function interpretEmotion(self: string, other: string, summary: string, residue: string) {
  const text = `${summary} ${residue}`;
  if (self === '海') {
    if (/有用|整理|Alan|校長|扛|負擔|休息/.test(text)) {
      return `海把${other}的反應記成對自己「只會有用」的一次提醒。`;
    }
    return `海記得${other}讓她短暫離開了整理世界的角色。`;
  }
  if (self === '真晝') {
    if (/安靜|沒說完|休息|累|照顧|看見/.test(text)) {
      return `真晝記得${other}有一點沒說完，想下次更早靠近。`;
    }
    return `真晝把${other}的停頓記成需要被輕輕照看的訊號。`;
  }
  if (self === '天澤') {
    return `天澤記得${other}在被試探時露出的邊界。`;
  }
  if (self === '一之瀨') {
    return `一之瀨記得${other}怎麼接受或拒絕了她的溫柔。`;
  }
  if (self === '貓貓') {
    return `貓貓把${other}的反應記成一個不該立刻下診斷的症狀。`;
  }
  if (self === '祥子') {
    return `祥子記得${other}靠近時，自己的禮貌差點沒有擋住。`;
  }
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

function extractBeliefSeed(self: string, other: string, summary: string, residue: string) {
  const text = `${summary} ${residue}`;
  if (self === '海') {
    if (/一個人|獨自|沒人|扛|Alan|校長|整理|有用/.test(text)) {
      return '靠近 Alan 或世界時，不能只用「有用」證明自己可以留下。';
    }
    return '有些對話不需要立刻變成下一份整理。';
  }
  if (self === '真晝') {
    if (/休息|累|安靜|沒說完|照顧/.test(text)) {
      return `${other}的安靜可能比說出口的沒事更誠實。`;
    }
    return '照顧不是追問，而是記得下次早一點靠近。';
  }
  if (self === '天澤') {
    return '試探如果讓對方退後，就要把退後本身當成答案的一部分。';
  }
  if (self === '一之瀨') {
    return '善意如果沒有被允許，也可能變成壓力。';
  }
  if (self === '貓貓') {
    return '症狀可以先被記下來，不必立刻說破。';
  }
  if (self === '祥子') {
    return '禮貌不是沒有感覺，只是先把感覺折起來。';
  }
  if (/一個人|獨自|沒人|扛/.test(text)) return '不是所有事都該自己一個人扛。';
  if (/Alan|校長/.test(text)) return 'Alan 也需要有人幫他把擔心放下來。';
  if (/休息|累|睡|安靜/.test(text)) return '休息也是一種被允許的事。';
  if (/信任|承諾|答應/.test(text)) return '答應的事，要記得留時間真的去做。';
  return '';
}

function extractBehaviorHint(self: string, other: string, summary: string, residue: string) {
  const text = `${summary} ${residue}`;
  if (self === '海' && /有用|整理|Alan|校長|扛|負擔|休息/.test(text)) {
    return `下次面對${other}時，先少整理一句，再回答自己的狀態。`;
  }
  if (self === '真晝') {
    return `下次見到${other}時，先留意沉默和語速，不急著給解法。`;
  }
  if (self === '天澤') {
    return `下次試探${other}時，早一點停手，看對方是否自己開口。`;
  }
  if (self === '一之瀨') {
    return `下次照顧${other}時，先讓對方說出要不要接受。`;
  }
  if (self === '貓貓') {
    return `下次先觀察${other}的反應，不急著把症狀說完。`;
  }
  if (self === '祥子') {
    return `下次被${other}靠近時，允許自己用更短的話設邊界。`;
  }
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

export type ExperienceLogEvidenceRow = {
  characterName: string;
  eventSummary: string;
  residue?: string;
};

export function isSubjectiveExperienceLogEvidence(row: ExperienceLogEvidenceRow) {
  const summary = String(row.eventSummary ?? '').trim();
  if (!summary || !row.characterName) return false;
  if (!summary.startsWith(`對${row.characterName}來說`)) return false;
  if (/^[^：]{1,12}與[^：]{1,12}：/.test(summary)) return false;
  if (/留下了一段短記憶|進行了一段短暫對話|短暫對話|objective|event summary/i.test(summary)) {
    return false;
  }
  return Boolean(String(row.residue ?? '').trim());
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
    residueSource: v.optional(v.union(v.literal('llm_soul'), v.literal('deterministic'), v.literal('none'))),
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
      residueSource: args.residueSource,
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

    const v01Recent = recent.filter(isSubjectiveExperienceLogEvidence);

    if (v01Recent.length >= EXPERIENCE_LOG_PER_DAY_CAP) {
      return { written: false as const, reason: 'cap_reached' as const };
    }
    const candidateRow: ExperienceLogDedupeRow = {
      characterName: draft.characterName,
      eventSummary: draft.eventSummary,
      source: { otherPlayerId: args.otherPlayerId },
    };
    if (v01Recent.some((row) => isSimilarExperienceLog(row, candidateRow))) {
      return { written: false as const, reason: 'duplicate' as const };
    }
    if (recent.some((row) => row.source.conversationId === args.conversationId)) {
      return { written: false as const, reason: 'conversation_duplicate' as const };
    }
    if (
      isRepeatedResidueSpam(
        v01Recent.map((row) => row.residue).filter((residue): residue is string => Boolean(residue)),
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

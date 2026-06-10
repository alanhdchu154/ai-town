import { v } from 'convex/values';
import { ActionCtx, DatabaseReader, internalAction, internalMutation, internalQuery } from '../_generated/server';
import { Doc, Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { EMBEDDING_DIMENSION, LLMMessage, chatCompletion, fetchEmbedding } from '../util/llm';
import { asyncMap } from '../util/asyncMap';
import { GameId, agentId, conversationId, playerId } from '../aiTown/ids';
import { SerializedPlayer } from '../aiTown/player';
import { memoryFields } from './schema';
import {
  memorySummarizationMode,
  reflectionLlmEnabled,
  shouldPersistCharacterSoulTranscript,
} from '../modelPolicy';
import { conversationEligibleForLLM } from './conversation';
import { hasDialogueSystemPhraseLeak } from './dialogueHygiene';
import { giisProfileForName } from '../../data/giisProfiles';

// How long to wait before updating a memory's last access time.
export const MEMORY_ACCESS_THROTTLE = 300_000; // In ms
// We fetch 10x the number of memories by relevance, to have more candidates
// for sorting by relevance + recency + importance.
const MEMORY_OVERFETCH = 10;
const selfInternal = internal.agent.memory;
const MEMORY_LLM_TIMEOUT_MS =
  Number(process.env.MEMORY_LLM_TIMEOUT_MS ?? process.env.SCHOOL_LLM_TIMEOUT_MS) || 10_000;
const MEMORY_LLM_MODE = memorySummarizationMode();
const MEMORY_LLM_DETERMINISTIC = MEMORY_LLM_MODE === 'deterministic';
const ENABLE_MEMORY_REFLECTION_LLM = reflectionLlmEnabled();
const MEMORY_EMBEDDING_MODE =
  process.env.MEMORY_EMBEDDING_MODE ?? (MEMORY_LLM_DETERMINISTIC ? 'deterministic' : 'full');
const LONG_TERM_CANDIDATE_IMPORTANCE = 7;
const REFLECTION_IMPORTANCE_THRESHOLD = 160;

type MemoryRetentionLayer = 'daily_experience' | 'long_term_candidate' | 'long_term_insight';

type MemoryRetentionDecision = {
  layer: MemoryRetentionLayer;
  tags: string[];
  reasonZh: string;
  shouldPromote: boolean;
};

const RESIDUE_PREFIX = '殘留：';
const RESIDUE_PILOT_NAMES = new Set(['海', '真晝', '天澤']);
const MEMORY_POST_PROCESSING_DRIFT_CUES = [
  'AI 社',
  'AI社',
  '學生會',
  '派系',
  '世界情緒',
  '世界協調報告',
  '世界協調',
  '校園情緒地圖',
  '情緒脈絡',
  '主線',
  'conversationOutcome',
  '會議流程',
  '策略衝擊',
  '掃描教室',
  '自行覺醒',
  '任務和支援',
  '明細已經拿到',
  '名單已交接清楚',
  '整理明天的流程',
  '是否有人需要幫助',
  '暫時不覺得累',
  '緊急決策',
  '這世界又會亂成一團',
  '這筆預算',
  '執行清單',
  '核對工作',
  '商量下一步',
  '按你說的办',
  '隱形成本',
  '隱形的成本',
  '隐形的成本',
  '個人準備更有效率',
  '互相補充信息',
  '自己組織比較好',
  '做個助手',
  '正中窩心',
  '那就這樣做吧',
];

function logGiisTiming(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  console.log('[GIIS timing]', payload);
}

export type Memory = Doc<'memories'>;
export type MemoryType = Memory['data']['type'];
export type MemoryOfType<T extends MemoryType> = Omit<Memory, 'data'> & {
  data: Extract<Memory['data'], { type: T }>;
};

function classifyMemoryRetention(description: string, importance: number): MemoryRetentionDecision {
  const text = description.toLowerCase();
  const tags = new Set<string>();
  const hasRelationshipSignal =
    /信任|疏遠|靠近|依賴|失望|保護|關心|喜歡|害怕|不安|理解|孤單|lonely|trust|distance/.test(
      description,
    );
  const hasDecisionSignal = /決定|答應|拒絕|邀請|承諾|開始|不再|改變|避開|選擇/.test(description);
  const hasIdentitySignal = /我其實|我害怕|我希望|我不想|我一直|越來越|開始覺得/.test(description);
  const hasWorldSignal = /校園|學生|傳聞|氣氛|焦慮|分裂|穩定|ai 社|學生會/.test(text);
  const hasResidueSignal = /殘留|還記得|放不下|仍然|下次|再次|沒有說完/.test(description);
  const isMundane = /天氣|午餐|窗邊|走廊|睡|累|安靜|休息|食物|座位/.test(description);

  if (hasRelationshipSignal) tags.add('relationship');
  if (hasDecisionSignal) tags.add('decision');
  if (hasIdentitySignal) tags.add('identity');
  if (hasWorldSignal) tags.add('world');
  if (hasResidueSignal) tags.add('emotional_residue');
  if (isMundane) tags.add('everyday_life');

  const shouldPromote =
    importance >= LONG_TERM_CANDIDATE_IMPORTANCE ||
    (importance >= 5 && (hasRelationshipSignal || hasDecisionSignal || hasIdentitySignal || hasResidueSignal));
  const layer: MemoryRetentionLayer = shouldPromote ? 'long_term_candidate' : 'daily_experience';
  const reasonZh = shouldPromote
    ? '這段記憶可能會改變關係、信念或後續行動，先列為長期候選。'
    : '這是今天的經歷，先保留作為短期脈絡，不急著寫成人格設定。';

  return {
    layer,
    tags: [...tags],
    reasonZh,
    shouldPromote,
  };
}

function formatRetentionDecision(decision: MemoryRetentionDecision) {
  const layerZh: Record<MemoryRetentionLayer, string> = {
    daily_experience: '今日經歷',
    long_term_candidate: '長期候選',
    long_term_insight: '長期洞察',
  };
  const tagText = decision.tags.length ? decision.tags.join(', ') : 'ordinary';
  return `記憶層級：${layerZh[decision.layer]}；標籤：${tagText}；判斷：${decision.reasonZh}`;
}

function deterministicConversationSummary(
  player: { name: string },
  otherPlayer: { name: string },
  messages: Doc<'messages'>[],
) {
  const anchorText = memoryAnchorTextForMessages(messages);
  const commitment = concreteCommitmentSummaryForMessages(player, otherPlayer, messages);
  const preview = anchorText
    ? `留下的情緒重點是：「${anchorText.slice(0, 96)}${anchorText.length > 96 ? '...' : ''}」`
    : '這段對話沒有留下明確訊息。';
  return [commitment, `${player.name} 和 ${otherPlayer.name} 進行了一段短暫對話；${preview}`]
    .filter(Boolean)
    .join('；');
}

export function memoryAnchorTextForMessages(messages: Array<{ text: string }>) {
  const candidates = messages
    .map((message, index) => ({ text: message.text.trim(), index }))
    .filter((message) => message.text.length > 0 && !hasMemoryPostProcessingDrift(message.text));
  if (!candidates.length) return '';
  const scored = candidates.map((candidate) => ({
    ...candidate,
    score: memoryAnchorScore(candidate.text),
  }));
  scored.sort((left, right) => right.score - left.score || left.index - right.index);
  const best = scored[0];
  if (best.score <= 0) return candidates.at(-1)?.text ?? '';
  return best.text;
}

export function concreteCommitmentSummaryForMessages(
  player: { id?: string; name: string },
  otherPlayer: { id?: string; name: string },
  messages: Array<{ author?: string; text: string }>,
) {
  const normalizedMessages = messages.map((message) => ({
    ...message,
    text: normalizeTraditionalFoodText(message.text.trim()),
  }));
  const speakerName = (message: { author?: string }) =>
    message.author === player.id ? player.name : message.author === otherPlayer.id ? otherPlayer.name : '';

  for (let index = 0; index < normalizedMessages.length; index += 1) {
    const message = normalizedMessages[index];
    if (!looksLikeCommitmentResponse(message.text)) continue;
    const windowText = normalizedMessages
      .slice(Math.max(0, index - 4), index + 1)
      .map((item) => item.text)
      .join('\n');
    const object = commitmentObjectFromText(windowText);
    const time = commitmentTimeFromText(windowText);
    if (!object || !time) continue;
    const speaker = speakerName(message);
    if (!speaker) continue;
    const target = speaker === player.name ? otherPlayer.name : player.name;
    return `具體承諾：${speaker}答應${time}為${target}準備${object}`;
  }
  return '';
}

function normalizeTraditionalFoodText(text: string) {
  return text.replace(/咖喱/g, '咖哩').replace(/麻/g, '嗎');
}

function looksLikeCommitmentResponse(text: string) {
  if (/[？?]|嗎/.test(text)) return false;
  if (!/(好|可以|我會|我試試|我来|我來|記得|答應|做一份|準備|帶過去|帶給你)/.test(text)) {
    return false;
  }
  return !/(不行|不要|不能|不會|算了|先別|先不要)/.test(text);
}

function commitmentObjectFromText(text: string) {
  if (/咖哩(?:飯)?/.test(text)) return '咖哩飯';
  return '';
}

function commitmentTimeFromText(text: string) {
  if (/下週末|下周末/.test(text)) return '下週末';
  if (/週末|周末/.test(text)) return '週末';
  if (/明天|明日/.test(text)) return '明天';
  const weekday = text.match(/(?:下週|下周|週|周|星期|禮拜)([一二三四五六日天])/);
  if (weekday) return `週${weekday[1] === '天' ? '日' : weekday[1]}`;
  return '';
}

function memoryAnchorScore(text: string) {
  let score = 0;
  const highValueCues = [
    '不想一個人',
    '一個人扛',
    '不想總是',
    '別讓我一個人',
    '被誰照顧',
    '你自己呢',
    '有沒有吃',
    '沒吃',
    '沒休息',
    '還好嗎',
  ];
  const mediumValueCues = [
    '分走一半',
    '分擔',
    '責任',
    '接住',
    '交出',
    '扛',
    '累',
    '疲憊',
    '擔心',
    '害怕',
    '安靜',
    '說沒事',
    '沒說完',
    '手',
    '冷茶',
    '熱茶',
    '便當',
  ];
  for (const cue of highValueCues) {
    if (text.includes(cue)) score += 6;
  }
  for (const cue of mediumValueCues) {
    if (text.includes(cue)) score += 2;
  }
  if (/^(好|嗯|明白|是的|謝謝)[，,。]/.test(text)) score -= 2;
  if (text.includes('檢查') || text.includes('表格') || text.includes('文件')) score -= 1;
  return score;
}

function displayResidueName(name: string) {
  if (name === 'Umi' || name === '朝凪海') return '海';
  if (name === 'Mahiru' || name === 'Mahiru' || name === '椎名真晝') return '真晝';
  if (name === 'Tianze' || name === '天澤' || name === '天澤一夏' || name === '天擇' || name === '天擇一夏' || name === '天澤' || name === '天澤') return '天澤';
  if (name === 'Ichinose' || name === '一之瀨' || name === '一之瀨帆波' || name === '黑化一之瀨' || name === '一之瀨') return '一之瀨';
  return name;
}

export function hasMemoryPostProcessingDrift(description: string) {
  return (
    hasDialogueSystemPhraseLeak(description) ||
    MEMORY_POST_PROCESSING_DRIFT_CUES.some((cue) => description.includes(cue))
  );
}

export function shouldExposeMemoryDescription(description: string) {
  return !hasMemoryPostProcessingDrift(description);
}

export function shouldPersistConversationMemoryShape(
  meaningfulMessageCount: number,
  meaningfulAuthorCount: number,
  humanInConversation: boolean,
  allowShortAutonomousSoulMemory = false,
) {
  if (meaningfulMessageCount < 2 || meaningfulAuthorCount < 2) return false;
  // Autonomous NPC conversations need enough exchange to prove there was a
  // real turn-by-turn moment. Two-line exchanges often become generic residue.
  if (!humanInConversation && meaningfulMessageCount < 4 && !allowShortAutonomousSoulMemory) {
    return false;
  }
  return true;
}

function emotionalResidueEnabled() {
  return process.env.UNDERWORLD_RESIDUE_WRITE !== 'false';
}

function pilotResiduePair(playerName: string, otherPlayerName: string) {
  const self = displayResidueName(playerName);
  const other = displayResidueName(otherPlayerName);
  return RESIDUE_PILOT_NAMES.has(self) && RESIDUE_PILOT_NAMES.has(other) && self !== other;
}

function normalizeResidueText(text: string) {
  return text
    .toLowerCase()
    .replace(/[，。！？、,.!?「」『』""''\s]/g, '');
}

function hasSloganLikeResidue(text: string) {
  const normalized = normalizeResidueText(text);
  return /拆成任務|開始排順序|先不排表|不開checklist|開checklist|排程關掉|不是工具|情緒層|心理機制|文明|智能|數據/.test(
    normalized,
  );
}

function residueResonanceEnabled() {
  return process.env.UNDERWORLD_RESIDUE_RESONANCE !== 'false';
}

function residueCue(text: string) {
  const cues = [
    'Alan',
    '簡報',
    '清單',
    '杯子',
    '吃飯',
    '肩膀',
    '手',
    '休息',
    '安靜',
    '責任',
    '負責',
    '交接',
    '停一下',
    '少接',
    '不用急',
  ];
  return cues.find((cue) => text.includes(cue));
}

function soulResonanceTokens(name: string) {
  const displayName = displayResidueName(name);
  const profile = giisProfileForName(name);
  const profileText = profile
    ? `${profile.stakes.hiddenFear} ${profile.stakes.hiddenDesire} ${profile.stakes.emotionalVulnerability} ${profile.stakes.relationshipInsecurity}`
    : '';
  const coreByName: Record<string, string[]> = {
    海: ['Alan', '校長', '簡報', '整理', '有用', '工具', '世界', '休息', '累', '扛', '負責'],
    真晝: ['安靜', '沒事', '累', '休息', '看見', '照顧', '宿舍', '小聲', '說完', '不問'],
    天澤: ['測試', '底線', '規則', '破綻', '挑釁', '停手', '笑', '壓力'],
    一之瀨: ['善意', '邊界', '信任', '信任債', '欠', '記帳', '佔有', '拒絕', '溫柔', '收債'],
  };
  const profileTokens = [
    'Alan',
    '世界',
    '工具',
    '責任',
    '休息',
    '累',
    '安靜',
    '理解',
    '效率',
    '壓力',
    '幫忙',
    '價值',
    '照顧',
  ].filter((token) => profileText.includes(token));
  return Array.from(new Set([...(coreByName[displayName] ?? []), ...profileTokens]));
}

function hasConcreteResidueCue(text: string) {
  return Boolean(
    residueCue(text) ||
      /杯|茶|手|肩|飯|睡|宿舍|窗|清單|簡報|任務|責任|安靜|休息|交接|取消|問|停一下|少接/.test(
        text,
      ),
  );
}

function resonatesWithCharacterSoul(self: string, other: string, text: string) {
  if (!residueResonanceEnabled()) return true;
  if (!hasConcreteResidueCue(text)) return false;
  const tokens = Array.from(new Set([...soulResonanceTokens(self), ...soulResonanceTokens(other)]));
  const normalizedText = normalizeResidueText(text);
  return tokens.some((token) => normalizedText.includes(normalizeResidueText(token)));
}

// Minimum exchange length to earn a residue line. Shorter exchanges are
// either incomplete or template-shaped — a residue written from them turns
// into the template itself the next time the same pair talks. Override
// from 2026-05-25 audit (#3) protects against the same failure mode as
// the 2026-05-22 prompt-mandate template cycle.
const RESIDUE_MIN_MESSAGES = 4;

function deterministicResidueSentence(
  player: { name: string },
  otherPlayer: { name: string },
  messages: Doc<'messages'>[],
  summary: string,
  allowShortAutonomousSoulMemory = false,
) {
  if (!emotionalResidueEnabled() || !pilotResiduePair(player.name, otherPlayer.name)) return '';
  if (messages.length < RESIDUE_MIN_MESSAGES && !allowShortAutonomousSoulMemory) return '';
  const self = displayResidueName(player.name);
  const other = displayResidueName(otherPlayer.name);
  const transcript = messages.map((message) => message.text).join('\n');
  const text = `${summary}\n${transcript}`;
  const cue = residueCue(text);
  let residue = '';

  if (!resonatesWithCharacterSoul(player.name, otherPlayer.name, text)) return '';

  if (self === '海') {
    if (/累|休息|肩膀|手|停|少接|不用急/.test(text)) {
      residue = `海還記得${other}沒有只要她繼續有用，而是把問題留在她自己身上。`;
    } else if (/Alan|簡報|校長/.test(text)) {
      residue = `海還記得${other}聽見她又把擔心整理回 Alan 身上。`;
    } else {
      residue = `海還記得${other}讓這段對話沒有立刻變成下一件事。`;
    }
  } else if (self === '真晝') {
    if (other === '海') {
      residue = `真晝還記得海聽起來很有用，但不像真的休息過。`;
    } else if (other === '天澤') {
      residue = `真晝還記得天澤笑得太輕，好像差一點就把問題推過界線。`;
    } else {
      residue = `真晝還記得${other}說得很輕，但還有一點沒說完。`;
    }
  } else if (self === '天澤') {
    if (/測試|底線|規則|破綻|挑釁|停手|笑/.test(text)) {
      residue = `天澤還記得${other}被問到底線時沒有立刻逃開，這讓她停了一下。`;
    } else {
      residue = `天澤還記得${other}讓她差一點把玩笑收起來。`;
    }
  }

  if (!residue || hasSloganLikeResidue(residue)) return '';
  const withCue = cue && !residue.includes(cue) ? `${residue} 觸發：${cue}。` : residue;
  return withCue.length > 90 ? withCue.slice(0, 89) + '。' : withCue;
}

export function residueFromMemoryDescription(description: string) {
  return description
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith(RESIDUE_PREFIX))
    ?.slice(RESIDUE_PREFIX.length)
    .trim() ?? '';
}

// Detect when the other party corrected the speaker's recall in this
// conversation (e.g. "不是，我說的是…", "你記錯了", "我沒說過"). Such a turn means
// the speaker probably confabulated a memory, so we should not write residue
// from it (otherwise the invention becomes durable, confidently-recalled truth).
export function conversationHasRecallCorrection(
  messages: { author: string; text: string }[],
  speakerPlayerId: string,
) {
  const correction =
    /你記錯|你搞錯|記錯了|我沒有?說過|我又沒說|才不是|不是[，,]?[^。！？!?]{0,12}我[^。！？!?]{0,8}說|不對[，,]?[^。！？!?]{0,8}我說/;
  return messages.some(
    (message) => message.author !== speakerPlayerId && correction.test(message.text),
  );
}

// Extract the concrete commitment a conversation recorded (e.g. a promise to
// make curry). It is stored inline in the memory description after the
// `具體承諾：` marker; here we pull it back out so the read path can surface it
// as an actionable open promise rather than leaving it buried in the raw
// related-memories dump.
export function commitmentFromMemoryDescription(description: string) {
  const match = (description ?? '').match(/具體承諾：([^；;。\n]+)/);
  return match?.[1]?.trim() ?? '';
}

// First chars of a residue sentence — used to detect when the same pair
// would write the same residue shape two times in a row. Treat this as a
// new template forming and skip the write.
const RESIDUE_PATTERN_PREFIX_LEN = 10;

export const recentSamePairResidues = internalQuery({
  args: {
    playerId,
    otherPlayerId: playerId,
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const overfetched = await ctx.db
      .query('memories')
      .withIndex('playerId_type', (q) =>
        q.eq('playerId', args.playerId).eq('data.type', 'conversation'),
      )
      .order('desc')
      // Bounded overfetch: clamp limit to [1, 10] and overfetch 5x, so a
      // misconfigured caller cannot ask for thousands of rows. The only real
      // caller passes limit=2.
      .take(Math.min(Math.max(args.limit, 1), 10) * 5);
    const matching: string[] = [];
    for (const memory of overfetched) {
      if (memory.data.type !== 'conversation') continue;
      if (!memory.data.playerIds.some((id) => id === args.otherPlayerId)) continue;
      const residue = residueFromMemoryDescription(memory.description);
      if (!residue) continue;
      matching.push(residue);
      if (matching.length >= args.limit) break;
    }
    return matching;
  },
});

function deterministicImportance(description: string) {
  if (/決定|承諾|拒絕|答應|不再|開始|改變|信任|疏遠|依賴|害怕|不安|孤單|排除/.test(description)) {
    return 6;
  }
  if (/關心|擔心|照顧|一起|看見|風險|秩序|學生會|AI 社/.test(description)) {
    return 5;
  }
  return 4;
}

function deterministicEmbedding(text: string) {
  let seed = 2166136261;
  for (let index = 0; index < text.length; index++) {
    seed ^= text.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  const embedding = new Array<number>(EMBEDDING_DIMENSION);
  let norm = 0;
  for (let index = 0; index < EMBEDDING_DIMENSION; index++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const value = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    embedding[index] = value;
    norm += value * value;
  }
  const scale = norm > 0 ? 1 / Math.sqrt(norm) : 1;
  return embedding.map((value) => value * scale);
}

function isDegeneratePilotExitMemory(
  player: { name: string },
  otherPlayer: { name: string },
  messages: Doc<'messages'>[],
) {
  return !shouldPersistCharacterSoulTranscript(
    [player.name, otherPlayer.name],
    messages.map((message) => message.text),
  );
}

async function memoryEmbedding(description: string) {
  if (MEMORY_EMBEDDING_MODE === 'deterministic') {
    return deterministicEmbedding(description);
  }
  const { embedding } = await fetchEmbedding(description);
  return embedding;
}

export async function rememberConversation(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  agentId: GameId<'agents'>,
  playerId: GameId<'players'>,
  conversationId: GameId<'conversations'>,
) {
  const totalStart = Date.now();
  let data;
  try {
    data = await ctx.runQuery(selfInternal.loadConversation, {
      worldId,
      playerId,
      conversationId,
    });
  } catch (error) {
    console.debug('Skipping missing conversation memory', error);
    return;
  }
  const { player, otherPlayer } = data;
  const messages = await ctx.runQuery(selfInternal.loadMessages, { worldId, conversationId });
  if (!messages.length) {
    return;
  }
  const meaningfulMessages = messages.filter((message) => message.text.trim().length > 0);
  const meaningfulAuthors = new Set(meaningfulMessages.map((message) => message.author));
  const humanInConversation = Boolean(player.human || otherPlayer.human);
  const participantNames = [player.name, otherPlayer.name];
  const meaningfulMessageTexts = meaningfulMessages.map((message) => message.text);
  const allowShortAutonomousSoulMemory =
    !humanInConversation &&
    meaningfulMessages.length >= 3 &&
    pilotResiduePair(player.name, otherPlayer.name) &&
    shouldPersistCharacterSoulTranscript(participantNames, meaningfulMessageTexts);
  if (
    !shouldPersistConversationMemoryShape(
      meaningfulMessages.length,
      meaningfulAuthors.size,
      humanInConversation,
      allowShortAutonomousSoulMemory,
    )
  ) {
    logGiisTiming({
      action: 'rememberConversation',
      phase: 'skipWeakConversationMemoryShape',
      player: player.name,
      otherPlayer: otherPlayer.name,
      conversationId,
      messageCount: meaningfulMessages.length,
      authorCount: meaningfulAuthors.size,
      humanInConversation,
    });
    return;
  }
  // Only LLM-eligible conversations (Alan ↔ anyone, or an explicitly enabled
  // autonomous LLM pair) carry enough soul/specificity to be worth a memory.
  // Pure-template NPC↔NPC small talk would otherwise pollute memory with
  // generic lines that the character never "really" said.
  if (!conversationEligibleForLLM(player.name, otherPlayer.name, humanInConversation)) {
    logGiisTiming({
      action: 'rememberConversation',
      phase: 'skipFallbackOnlyConversation',
      player: player.name,
      otherPlayer: otherPlayer.name,
      conversationId,
    });
    return;
  }
  if (isDegeneratePilotExitMemory(player, otherPlayer, messages)) {
    logGiisTiming({
      action: 'rememberConversation',
      phase: 'skipDegeneratePilotExit',
      player: player.name,
      conversationId,
    });
    return;
  }
  if (messages.some((message) => hasDialogueSystemPhraseLeak(message.text))) {
    logGiisTiming({
      action: 'rememberConversation',
      phase: 'skipDialogueSystemPhraseLeak',
      player: player.name,
      otherPlayer: otherPlayer.name,
      conversationId,
    });
    return;
  }
  if (messages.some((message) => hasMemoryPostProcessingDrift(message.text))) {
    logGiisTiming({
      action: 'rememberConversation',
      phase: 'skipFreeWorldQualityDrift',
      player: player.name,
      otherPlayer: otherPlayer.name,
      conversationId,
    });
    return;
  }

  const fallbackSummary = deterministicConversationSummary(player, otherPlayer, messages);
  const llmMessages: LLMMessage[] = [
    {
      role: 'user',
      content: `You are ${player.name}, and you just finished a conversation with ${otherPlayer.name}. I would
      like you to summarize the conversation from ${player.name}'s perspective, using first-person pronouns like
      "I," and add if you liked or disliked this interaction. Write the summary in Traditional Chinese.`,
    },
  ];
  const authors = new Set<GameId<'players'>>();
  for (const message of messages) {
    const author = message.author === player.id ? player : otherPlayer;
    authors.add(author.id as GameId<'players'>);
    const recipient = message.author === player.id ? otherPlayer : player;
    llmMessages.push({
      role: 'user',
      content: `${author.name} to ${recipient.name}: ${message.text}`,
    });
  }
  llmMessages.push({ role: 'user', content: 'Summary:' });
  const summaryStart = Date.now();
  const content = MEMORY_LLM_DETERMINISTIC
    ? fallbackSummary
    : await safeMemoryCompletion(
        {
          messages: llmMessages,
          max_tokens: 500,
          timeoutMs: MEMORY_LLM_TIMEOUT_MS,
        },
        fallbackSummary,
      );
  const concreteCommitment = concreteCommitmentSummaryForMessages(player, otherPlayer, messages);
  const contentWithCommitment =
    concreteCommitment && !content.includes(concreteCommitment)
      ? `${concreteCommitment}；${content}`
      : content;
  logGiisTiming({
    action: 'rememberConversation',
    phase: 'memorySummaryTime',
    ms: Date.now() - summaryStart,
    player: player.name,
  });
  // Use the conversation's logical start (`created`) rather than the DB row's
  // `_creationTime`. They coincide for live conversations, but for a re-archived
  // (backfilled) conversation `_creationTime` is the re-archive moment, which
  // would mislabel an old chat as having happened "just now".
  const conversationStartedAt = data.conversation.created ?? data.conversation._creationTime;
  const baseDescription = `與 ${otherPlayer.name} 在 ${new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(conversationStartedAt))} 的對話：${contentWithCommitment}`;
  const candidateResidue = deterministicResidueSentence(
    player,
    otherPlayer,
    messages,
    content,
    allowShortAutonomousSoulMemory,
  );
  let residue = candidateResidue;
  // Repeat-pattern gate applies only to autonomous (character↔character)
  // residues, where a repeated opening prefix becomes a template the next prompt
  // echoes back (the 2026-05-22 template cycle). Alan-facing residues are exempt:
  // Alan's input varies enough that echo is not the failure mode, and these are
  // the memories that most need to persist for continuity to feel real — so a
  // recurring emotional theme with Alan is allowed to accumulate.
  if (candidateResidue && !humanInConversation) {
    // Repeat-pattern gate: if the same pair's last two residues already
    // share this opening shape, skip writing a third one. Otherwise the
    // residue prefix becomes a template the next prompt will read back
    // and the model will start echoing — the same failure mode as the
    // 2026-05-22 prompt-mandate template cycle.
    const recent = await ctx.runQuery(selfInternal.recentSamePairResidues, {
      playerId: player.id as GameId<'players'>,
      otherPlayerId: otherPlayer.id as GameId<'players'>,
      limit: 2,
    });
    const newPrefix = candidateResidue.slice(0, RESIDUE_PATTERN_PREFIX_LEN);
    if (
      recent.length >= 2 &&
      newPrefix.length === RESIDUE_PATTERN_PREFIX_LEN &&
      recent.every((prior) => prior.startsWith(newPrefix))
    ) {
      logGiisTiming({
        action: 'rememberConversation',
        phase: 'skipResidueRepeatPattern',
        player: player.name,
        otherPlayer: otherPlayer.name,
        prefix: newPrefix,
      });
      residue = '';
    }
  }
  // Anti-confabulation: if the other party corrected the speaker's recall in this
  // conversation ("不是，我說的是…", "你記錯了"), the speaker likely invented a
  // memory. Do not canonize that turn's residue, or the fabrication becomes
  // durable "truth" the speaker confidently recalls later. The base summary and
  // any concrete commitment (often the corrected, real one) are still kept.
  if (residue && conversationHasRecallCorrection(messages, player.id as GameId<'players'>)) {
    logGiisTiming({
      action: 'rememberConversation',
      phase: 'skipResidueRecallCorrected',
      player: player.name,
      otherPlayer: otherPlayer.name,
    });
    residue = '';
  }
  const descriptionForClassification = residue
    ? `${baseDescription}\n${RESIDUE_PREFIX}${residue}`
    : baseDescription;
  const importanceStart = Date.now();
  const baseImportance = await calculateImportance(descriptionForClassification);
  const retention = classifyMemoryRetention(descriptionForClassification, baseImportance);
  const importance = retention.shouldPromote ? Math.max(baseImportance, LONG_TERM_CANDIDATE_IMPORTANCE) : baseImportance;
  const description = `${baseDescription}\n${formatRetentionDecision(retention)}${residue ? `\n${RESIDUE_PREFIX}${residue}` : ''}`;
  logGiisTiming({
    action: 'rememberConversation',
    phase: 'memoryImportanceTime',
    ms: Date.now() - importanceStart,
    player: player.name,
  });
  const embeddingStart = Date.now();
  const embedding = await memoryEmbedding(description);
  logGiisTiming({
    action: 'rememberConversation',
    phase: 'memoryEmbeddingTime',
    ms: Date.now() - embeddingStart,
    player: player.name,
    mode: MEMORY_EMBEDDING_MODE,
  });
  authors.delete(player.id as GameId<'players'>);
  const insertStart = Date.now();
  await ctx.runMutation(selfInternal.insertMemory, {
    agentId,
    playerId: player.id,
    description,
    importance,
    lastAccess: messages[messages.length - 1]._creationTime,
    data: {
      type: 'conversation',
      conversationId,
      playerIds: [...authors],
    },
    embedding,
  });
  logGiisTiming({
    action: 'rememberConversation',
    phase: 'memoryInsertTime',
    ms: Date.now() - insertStart,
    player: player.name,
  });
  const outcomeStart = Date.now();
  await ctx.runMutation(internal.school.recordConversationOutcome, {
    worldId,
    playerId: player.id,
    otherPlayerId: otherPlayer.id as GameId<'players'>,
    summary: content,
  });
  logGiisTiming({
    action: 'rememberConversation',
    phase: 'timelineUpdateTime',
    ms: Date.now() - outcomeStart,
    player: player.name,
  });
  const reflectionQueueStart = Date.now();
  if (ENABLE_MEMORY_REFLECTION_LLM) {
    await ctx.scheduler.runAfter(0, selfInternal.reflectOnMemoriesAction, {
      worldId,
      playerId,
    });
  }
  logGiisTiming({
    action: 'rememberConversation',
    phase: 'reflectionQueueTime',
    ms: Date.now() - reflectionQueueStart,
    player: player.name,
    skipped: !ENABLE_MEMORY_REFLECTION_LLM,
  });
  logGiisTiming({
    action: 'rememberConversation',
    phase: 'memoryTotalTime',
    ms: Date.now() - totalStart,
    player: player.name,
  });
  return description;
}

export const reflectOnMemoriesAction = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
  },
  handler: async (ctx, args) => {
    const start = Date.now();
    const reflected = await reflectOnMemories(ctx, args.worldId, args.playerId as GameId<'players'>);
    logGiisTiming({
      action: 'reflectOnMemories',
      phase: 'reflectionBackgroundTime',
      ms: Date.now() - start,
      reflected,
    });
    return reflected;
  },
});

export const loadConversation = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId,
    conversationId,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }
    const player = world.players.find((p) => p.id === args.playerId);
    if (!player) {
      throw new Error(`Player ${args.playerId} not found`);
    }
    const playerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.playerId))
      .first();
    if (!playerDescription) {
      throw new Error(`Player description for ${args.playerId} not found`);
    }
    const conversation = await ctx.db
      .query('archivedConversations')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('id', args.conversationId))
      .first();
    if (!conversation) {
      throw new Error(`Conversation ${args.conversationId} not found`);
    }
    const otherParticipator = await ctx.db
      .query('participatedTogether')
      .withIndex('conversation', (q) =>
        q
          .eq('worldId', args.worldId)
          .eq('player1', args.playerId)
          .eq('conversationId', args.conversationId),
      )
      .first();
    if (!otherParticipator) {
      throw new Error(
        `Couldn't find other participant in conversation ${args.conversationId} with player ${args.playerId}`,
      );
    }
    const otherPlayerId = otherParticipator.player2;
    let otherPlayer: SerializedPlayer | Doc<'archivedPlayers'> | null =
      world.players.find((p) => p.id === otherPlayerId) ?? null;
    if (!otherPlayer) {
      otherPlayer = await ctx.db
        .query('archivedPlayers')
        .withIndex('worldId', (q) => q.eq('worldId', world._id).eq('id', otherPlayerId))
        .first();
    }
    if (!otherPlayer) {
      throw new Error(`Conversation ${args.conversationId} other player not found`);
    }
    const otherPlayerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', otherPlayerId))
      .first();
    if (!otherPlayerDescription) {
      throw new Error(`Player description for ${otherPlayerId} not found`);
    }
    return {
      player: { ...player, name: playerDescription.name },
      conversation,
      otherPlayer: { ...otherPlayer, name: otherPlayerDescription.name },
    };
  },
});

export async function searchMemories(
  ctx: ActionCtx,
  playerId: GameId<'players'>,
  searchEmbedding: number[],
  n: number = 3,
) {
  const candidates = await ctx.vectorSearch('memoryEmbeddings', 'embedding', {
    vector: searchEmbedding,
    filter: (q) => q.eq('playerId', playerId),
    limit: n * MEMORY_OVERFETCH,
  });
  const rankedMemories = await ctx.runMutation(selfInternal.rankAndTouchMemories, {
    candidates,
    n,
  });
  return rankedMemories
    .map(({ memory }: { memory: Memory }) => memory)
    .filter((memory) => shouldExposeMemoryDescription(memory.description))
    .slice(0, n);
}

function makeRange(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return [min, max] as const;
}

function normalize(value: number, range: readonly [number, number]) {
  const [min, max] = range;
  return (value - min) / (max - min);
}

export const rankAndTouchMemories = internalMutation({
  args: {
    candidates: v.array(v.object({ _id: v.id('memoryEmbeddings'), _score: v.number() })),
    n: v.number(),
  },
  handler: async (ctx, args) => {
    const ts = Date.now();
    const relatedMemories = await asyncMap(args.candidates, async ({ _id }) => {
      const memory = await ctx.db
        .query('memories')
        .withIndex('embeddingId', (q) => q.eq('embeddingId', _id))
        .first();
      if (!memory) throw new Error(`Memory for embedding ${_id} not found`);
      return memory;
    });

    // TODO: fetch <count> recent memories and <count> important memories
    // so we don't miss them in case they were a little less relevant.
    const recencyScore = relatedMemories.map((memory) => {
      const hoursSinceAccess = (ts - memory.lastAccess) / 1000 / 60 / 60;
      return 0.99 ** Math.floor(hoursSinceAccess);
    });
    const relevanceRange = makeRange(args.candidates.map((c) => c._score));
    const importanceRange = makeRange(relatedMemories.map((m) => m.importance));
    const recencyRange = makeRange(recencyScore);
    const memoryScores = relatedMemories.map((memory, idx) => ({
      memory,
      overallScore:
        normalize(args.candidates[idx]._score, relevanceRange) +
        normalize(memory.importance, importanceRange) +
        normalize(recencyScore[idx], recencyRange),
    }));
    memoryScores.sort((a, b) => b.overallScore - a.overallScore);
    const accessed = memoryScores.slice(0, args.n);
    await asyncMap(accessed, async ({ memory }) => {
      if (memory.lastAccess < ts - MEMORY_ACCESS_THROTTLE) {
        await ctx.db.patch(memory._id, { lastAccess: ts });
      }
    });
    return accessed;
  },
});

export const loadMessages = internalQuery({
  args: {
    worldId: v.id('worlds'),
    conversationId,
  },
  handler: async (ctx, args): Promise<Doc<'messages'>[]> => {
    const messages = await ctx.db
      .query('messages')
      .withIndex('conversationId', (q) =>
        q.eq('worldId', args.worldId).eq('conversationId', args.conversationId),
      )
      .collect();
    return messages;
  },
});

async function calculateImportance(description: string) {
  if (MEMORY_LLM_DETERMINISTIC) {
    return deterministicImportance(description);
  }
  const importanceRaw = await safeMemoryCompletion(
    {
      messages: [
        {
          role: 'user',
          content: `On the scale of 0 to 9, where 0 is purely mundane (e.g., brushing teeth, making bed) and 9 is extremely poignant (e.g., a break up, college acceptance), rate the likely poignancy of the following piece of memory.
      Memory: ${description}
      Answer on a scale of 0 to 9. Respond with number only, e.g. "5"`,
        },
      ],
      temperature: 0.0,
      max_tokens: 1,
      timeoutMs: MEMORY_LLM_TIMEOUT_MS,
    },
    '5',
  );

  let importance = parseFloat(importanceRaw);
  if (isNaN(importance)) {
    importance = +(importanceRaw.match(/\d+/)?.[0] ?? NaN);
  }
  if (isNaN(importance)) {
    console.debug('Could not parse memory importance from: ', importanceRaw);
    importance = 5;
  }
  return importance;
}

const { embeddingId: _embeddingId, ...memoryFieldsWithoutEmbeddingId } = memoryFields;

export const insertMemory = internalMutation({
  args: {
    agentId,
    embedding: v.array(v.float64()),
    ...memoryFieldsWithoutEmbeddingId,
  },
  handler: async (ctx, { agentId: _, embedding, ...memory }): Promise<void> => {
    const embeddingId = await ctx.db.insert('memoryEmbeddings', {
      playerId: memory.playerId,
      embedding,
    });
    await ctx.db.insert('memories', {
      ...memory,
      embeddingId,
    });
  },
});

export const insertReflectionMemories = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    reflections: v.array(
      v.object({
        description: v.string(),
        relatedMemoryIds: v.array(v.id('memories')),
        importance: v.number(),
        embedding: v.array(v.float64()),
      }),
    ),
  },
  handler: async (ctx, { playerId, reflections }) => {
    const lastAccess = Date.now();
    for (const { embedding, relatedMemoryIds, ...rest } of reflections) {
      const embeddingId = await ctx.db.insert('memoryEmbeddings', {
        playerId,
        embedding,
      });
      await ctx.db.insert('memories', {
        playerId,
        embeddingId,
        lastAccess,
        ...rest,
        data: {
          type: 'reflection',
          relatedMemoryIds,
        },
      });
    }
  },
});

async function reflectOnMemories(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  playerId: GameId<'players'>,
) {
  const { memories, lastReflectionTs, name } = await ctx.runQuery(
    internal.agent.memory.getReflectionMemories,
    {
      worldId,
      playerId,
      numberOfItems: 100,
    },
  );

  // Reflect only after enough meaningful daily experiences accumulate. This is the
  // lightweight promotion step: ordinary moments stay episodic, repeated or
  // emotionally consequential moments can become long-term character memory.
  const sumOfImportanceScore = memories
    .filter((m: Memory) => m._creationTime > (lastReflectionTs ?? 0))
    .reduce((acc: number, curr: Memory) => acc + curr.importance, 0);
  const shouldReflect = sumOfImportanceScore > REFLECTION_IMPORTANCE_THRESHOLD;

  if (!shouldReflect) {
    return false;
  }
  console.debug('sum of importance score = ', sumOfImportanceScore);
  console.debug('Reflecting...');
  const prompt = ['[no prose]', '[Output only JSON]', `You are ${name}, statements about you:`];
  memories.forEach((m: Memory, idx: number) => {
    prompt.push(`Statement ${idx}: ${m.description}`);
  });
  prompt.push(
    'Infer at most 3 long-term character memories from the above statements. Only promote patterns that change relationship stance, self-understanding, repeated concern, trust/distance, or future behavior. Do not turn one ordinary daily event into a permanent trait.',
  );
  prompt.push(
    'Each insight should sound like an internal memory in Traditional Chinese, not a report. Prefer concrete relationship/emotional consequences over generic worldview summaries.',
  );
  prompt.push(
    'Return in JSON format, where the key is a list of input statements that contributed to your insights and value is your insight. Make the response parseable by Typescript JSON.parse() function. DO NOT escape characters or include "\n" or white space in response.',
  );
  prompt.push(
    'Example: [{insight: "...", statementIds: [1,2]}, {insight: "...", statementIds: [1]}, ...]',
  );

  const reflection = await safeMemoryCompletion(
    {
      messages: [
        {
          role: 'user',
          content: prompt.join('\n'),
        },
      ],
      timeoutMs: MEMORY_LLM_TIMEOUT_MS,
    },
    '[]',
  );

  try {
    const insights = JSON.parse(reflection) as { insight: string; statementIds: number[] }[];
    const memoriesToSave = await asyncMap(insights, async (item) => {
      const relatedMemoryIds = item.statementIds.map((idx: number) => memories[idx]._id);
      const importance = await calculateImportance(item.insight);
      const embedding = await memoryEmbedding(item.insight);
      console.debug('adding reflection memory...', item.insight);
      return {
        description: item.insight,
        embedding,
        importance,
        relatedMemoryIds,
      };
    });

    await ctx.runMutation(selfInternal.insertReflectionMemories, {
      worldId,
      playerId,
      reflections: memoriesToSave,
    });
  } catch (e) {
    console.error('error saving or parsing reflection', e);
    console.debug('reflection', reflection);
    return false;
  }
  return true;
}

async function safeMemoryCompletion(
  request: Parameters<typeof chatCompletion>[0],
  fallback: string,
) {
  const start = Date.now();
  try {
    const { content } = await chatCompletion(request);
    logGiisTiming({
      action: 'memoryLLM',
      phase: 'llmCallTime',
      ms: Date.now() - start,
      usedFallback: false,
    });
    return typeof content === 'string' ? content : fallback;
  } catch (error) {
    console.debug('Falling back to deterministic memory text', error);
    logGiisTiming({
      action: 'memoryLLM',
      phase: 'llmCallTime',
      ms: Date.now() - start,
      usedFallback: true,
    });
    return fallback;
  }
}
export const getReflectionMemories = internalQuery({
  args: { worldId: v.id('worlds'), playerId, numberOfItems: v.number() },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }
    const player = world.players.find((p) => p.id === args.playerId);
    if (!player) {
      throw new Error(`Player ${args.playerId} not found`);
    }
    const playerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.playerId))
      .first();
    if (!playerDescription) {
      throw new Error(`Player description for ${args.playerId} not found`);
    }
    // Bounded take so a misconfigured caller cannot fetch the whole
    // memory table for a player. Real caller passes 100; cap defensively.
    const memories = (await ctx.db
      .query('memories')
      .withIndex('playerId', (q) => q.eq('playerId', player.id))
      .order('desc')
      .take(Math.min(Math.max(args.numberOfItems, 1), 200)))
      .filter((memory) => shouldExposeMemoryDescription(memory.description));

    const lastReflection = await ctx.db
      .query('memories')
      .withIndex('playerId_type', (q) =>
        q.eq('playerId', args.playerId).eq('data.type', 'reflection'),
      )
      .order('desc')
      .first();

    return {
      name: playerDescription.name,
      memories,
      lastReflectionTs: lastReflection?._creationTime,
    };
  },
});

export async function latestMemoryOfType<T extends MemoryType>(
  db: DatabaseReader,
  playerId: GameId<'players'>,
  type: T,
) {
  const entry = await db
    .query('memories')
    .withIndex('playerId_type', (q) => q.eq('playerId', playerId).eq('data.type', type))
    .order('desc')
    .first();
  if (!entry) return null;
  return entry as MemoryOfType<T>;
}

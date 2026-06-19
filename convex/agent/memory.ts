import { v } from 'convex/values';
import { ActionCtx, DatabaseReader, action, internalAction, internalMutation, internalQuery } from '../_generated/server';
import { Doc, Id } from '../_generated/dataModel';
import { api, internal } from '../_generated/api';
import {
  buildSpeechIntrospectionPrompt,
  parseSpeechIntrospection,
  speechIntrospectionEnabled,
  SPEECH_INTROSPECTION_FAILED,
} from './speechIntrospectionPrompt';
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
import { conversationEligibleForLLM, pilotCloudCompletion } from './conversation';
import { inferEmotionFromConversation } from './conversationEmotion';
import { pilotExperienceLogName } from './experienceLog';
import {
  hasFirstPersonStageDirectionLeak,
  hasDialogueSystemPhraseLeak,
  hasThirdPersonSelfNarrationLeak,
} from './dialogueHygiene';
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
// All six pilot characters with an authored five-layer soul (giisProfiles
// stakes = Private Self + docs/soul/pilots/*.md). Residue used to cover only
// 海/真晝/天澤 because their soul lens was hand-written as regex in
// deterministicResidueSentence; the LLM residue path (llmResidueSentence)
// derives the trace from each character's authored profile instead, so the
// remaining three can join without a hand-written branch.
const RESIDUE_PILOT_NAMES = new Set(['海', '真晝', '天澤', '一之瀨', '貓貓', '祥子']);

// Per-character residue LENS. Each soul is attuned to a different *kind* of
// detail, so the same conversation should leave a different kind of trace in
// each of them. Without this, every character's residue collapses onto the same
// generic templates ("停頓的那半秒", "語氣像在報天氣"). Derived from
// docs/soul/pilots/*.md; this guides what each one tends to notice, it does not
// dictate the sentence.
const RESIDUE_LENS: Record<string, string> = {
  海: '對方這次有沒有真的需要你、用上你——還是其實不需要你也行（你最怕沒被需要）',
  真晝: '對方藏起來的累或勉強，那種別人不會注意到的小訊號',
  天澤: '你逗或推了一下之後，對方藏不住的真實反應——退一步、臉紅、還是頂回來的那個破綻',
  一之瀨: '這次誰給了誰、誰欠了誰——那筆沒講明的人情帳',
  貓貓: '對方身上一個被忽略的症狀或兜不攏的破綻——手、食慾、袖口、藉口',
  祥子: '對方的儀態哪裡裂了一下又立刻收回去——他是不是在撐、在演',
};
function residueLensFor(self: string): string | null {
  return RESIDUE_LENS[self] ?? null;
}
// Sentinel returned by safeMemoryCompletion's fallback so we can tell a real
// provider failure (→ fall back to the deterministic residue) apart from the
// model genuinely deciding nothing resonated (→ honour the empty "無").
const RESIDUE_LLM_FAILED = '__RESIDUE_LLM_FAILED__';
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
  player: { id?: string; name: string },
  otherPlayer: { id?: string; name: string },
  messages: Doc<'messages'>[],
  options?: { saidAt?: number },
) {
  const judgment = subjectiveMemoryJudgmentForMessages(player, otherPlayer, messages);
  const commitment = concreteCommitmentSummaryForMessages(player, otherPlayer, messages, options);
  const preview = judgment
    ? `記住的主觀判斷是：「${judgment.slice(0, 96)}${judgment.length > 96 ? '...' : ''}」`
    : '這段對話沒有留下明確訊息。';
  return [commitment, `${player.name} 和 ${otherPlayer.name} 進行了一段短暫對話；${preview}`]
    .filter(Boolean)
    .join('；');
}

export function otherParticipantIdForConversation(
  conversation: { participants?: string[] },
  playerIdValue: string,
  participatedTogetherFallback?: { player2?: string } | null,
) {
  const participantOther = conversation.participants?.find((participantId) => participantId !== playerIdValue);
  return participantOther ?? participatedTogetherFallback?.player2;
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

export function subjectiveMemoryAnchorTextForMessages(
  messages: Array<{ author?: string; text: string }>,
  preferredAuthorId?: string,
) {
  const preferredMessages = preferredAuthorId
    ? messages.filter((message) => message.author === preferredAuthorId)
    : [];
  return memoryAnchorTextForMessages(preferredMessages) || memoryAnchorTextForMessages(messages);
}

function textForAuthor(messages: Array<{ author?: string; text: string }>, authorId?: string) {
  if (!authorId) return '';
  return messages
    .filter((message) => message.author === authorId)
    .map((message) => message.text)
    .join('\n');
}

function hasAnyCue(text: string, cues: string[]) {
  return cues.some((cue) => text.includes(cue));
}

function trimSubjectiveJudgment(text: string) {
  return text.trim().replace(/[。！？!?]+$/u, '');
}

function everydayObjectCue(text: string) {
  const cues = [
    '便當',
    '盒蓋',
    '餐盤',
    '杯',
    '茶',
    '紅茶',
    '牛奶',
    '咖哩',
    '早餐',
    '吐司',
    '譜子',
    '排練',
    '傳單',
    '筆盒',
    '螢光筆',
    '磁鐵',
    '口袋',
    '窗',
    '椅',
    '綠蘿',
    '花盆',
    '紙袋',
    '袖口',
    '紙巾',
    '藥盒',
    '清單',
    '簡報',
  ];
  return cues.find((cue) => text.includes(cue)) ?? '';
}

function subjectiveMemoryJudgmentFromSignals(
  ownerName: string,
  otherName: string,
  allText: string,
  otherText: string,
) {
  const owner = displayResidueName(ownerName);
  const other = displayResidueName(otherName);
  const object = everydayObjectCue(allText);
  const boundary = hasAnyCue(otherText || allText, [
    '自己來',
    '不用',
    '不要',
    '不了',
    '我得去',
    '先離開',
    '等一下',
    '不必',
    '別',
  ]);
  const strain = hasAnyCue(allText, [
    '抖',
    '累',
    '休息',
    '指節',
    '泛白',
    '沒說',
    '安靜',
    '空椅',
    '皺',
    '涼',
    '沒吃',
    '藥',
    '失手',
    '快灑',
  ]);
  const care = hasAnyCue(allText, [
    '幫',
    '一起',
    '陪',
    '留',
    '收',
    '壓',
    '扣',
    '準備',
    '帶',
    '問',
    '看見',
    '注意',
    '記得',
    '等',
    '謝謝',
    '交給',
  ]);
  const responsibility = hasAnyCue(allText, ['Alan', '校長', '簡報', '責任', '清單', '交接', '會議']);

  if (owner === '海') {
    if (responsibility && strain) return `${other}看見了海把擔心整理成任務時漏出的疲態。`;
    if (care && boundary) return `${other}的靠近讓海意識到，有些幫忙需要先問距離。`;
    if (care) return `${other}不是只把海當成整理事情的人，也注意到她身邊的小事。`;
    return `${other}讓海把這段對話先放進心裡，而不是立刻整理成下一件事。`;
  }
  if (owner === '真晝') {
    if (strain) return `${other}說得很輕，但還有一點沒有真正放鬆。`;
    if (boundary) return `${other}把距離守得很安靜，暫時不適合追問。`;
    return `${other}在${object || '這件小事'}裡藏著一點沒說完的反應。`;
  }
  if (owner === '天澤') {
    if (boundary) return `${other}沒有照著他的節奏走，邊界比答案更明顯。`;
    if (strain) return `${other}的停頓像一個壓力點，而不是單純的回答。`;
    return `${other}在${object || '這段對話'}裡露出了一個可以下次再測的反應。`;
  }
  if (owner === '一之瀨') {
    if (boundary) return `${other}接受靠近前，還需要先守住一點自己的距離。`;
    if (care) return `${other}的回應像是在提醒她：好意可以靠近，但不能替對方決定。`;
    return `${other}對${object || '這件小事'}的反應，可能比話本身更重要。`;
  }
  if (owner === '貓貓') {
    if (strain) return `${other}身上的小徵象不太對，值得下次再確認。`;
    if (care) return `${other}的好意像是症狀旁邊的線索，還不能直接當成結論。`;
    return `${object || '這件小事'}背後可能還有沒被說清楚的原因。`;
  }
  if (owner === '祥子') {
    if (boundary) return `${other}靠得很近，但她還想先自己把距離扣好。`;
    if (strain) return `${other}的注意差點打亂她維持住的鎮定。`;
    if (care) return `${other}的好意碰到了她不太想立刻打開的地方。`;
    return `${other}讓${object || '這段對話'}停在一個還不用解釋的位置。`;
  }
  if (boundary) return `${other}在這段對話裡守住了一點距離。`;
  if (strain) return `${other}有一個沒有明說的壓力反應。`;
  if (care) return `${other}用很小的方式靠近了一點。`;
  return `${other}在這段對話裡留下了一個需要下次再確認的反應。`;
}

export function subjectiveMemoryJudgmentForMessages(
  player: { id?: string; name: string },
  otherPlayer: { id?: string; name: string },
  messages: Array<{ author?: string; text: string }>,
) {
  const allText = messages.map((message) => message.text.trim()).filter(Boolean).join('\n');
  if (!allText) return '';
  const otherText = textForAuthor(messages, otherPlayer.id) || allText;
  return trimSubjectiveJudgment(
    subjectiveMemoryJudgmentFromSignals(player.name, otherPlayer.name, allText, otherText),
  ).slice(0, 120);
}

export function subjectiveMemoryJudgmentFromAnchor(
  ownerName: string,
  otherName: string,
  anchor: string,
) {
  const text = anchor.trim();
  if (!text) return `${displayResidueName(otherName)}在這段對話裡留下了一個需要之後確認的小訊號。`;
  return trimSubjectiveJudgment(
    subjectiveMemoryJudgmentFromSignals(ownerName, otherName, text, text),
  ).slice(0, 120);
}

export function hasUnansweredHumanTailForMemory(
  messages: Array<{ author: string; text: string; _creationTime?: number }>,
  humanPlayerIds: Set<string>,
) {
  if (humanPlayerIds.size === 0) return false;
  const meaningful = messages
    .filter((message) => message.text.trim().length > 0)
    .sort((left, right) => (left._creationTime ?? 0) - (right._creationTime ?? 0));
  const last = meaningful.at(-1);
  if (!last || !humanPlayerIds.has(last.author)) return false;
  // Only skip when the character barely engaged — a pure / near-pure human
  // ping-fest (e.g. "海 海 哈囉哈囉" that never got a real reply). A genuine
  // back-and-forth that the human simply closed ("今天先這樣吧") still gets
  // remembered: the trailing human line is just the goodbye, not an unanswered
  // ping, and dropping a 27-message real conversation would make talking to
  // Alan the one kind of chat the characters never remember.
  const characterReplies = meaningful.filter(
    (message) => !humanPlayerIds.has(message.author),
  ).length;
  if (characterReplies < 2) return true;
  return finalHumanLineStillNeedsReply(last.text);
}

function finalHumanLineStillNeedsReply(text: string) {
  const normalized = text.trim();
  if (!normalized) return false;
  if (/[？?]\s*$/.test(normalized)) return true;
  if (/(嗎|呢|麻)\s*[。！!…]*$/.test(normalized)) return true;
  return /(?:記住|記得|有約|約好了|答應|告訴我|說吧)/.test(normalized);
}

export function concreteCommitmentSummaryForMessages(
  player: { id?: string; name: string },
  otherPlayer: { id?: string; name: string },
  messages: Array<{ author?: string; text: string }>,
  options?: { saidAt?: number; timeZone?: string },
) {
  const normalizedMessages = messages.map((message) => ({
    ...message,
    text: normalizeTraditionalFoodText(message.text.trim()),
  }));
  const speakerName = (message: { author?: string }) =>
    message.author === player.id ? player.name : message.author === otherPlayer.id ? otherPlayer.name : '';

  const formatCommitment = (speaker: string, time: string, object: string) => {
    const target = speaker === player.name ? otherPlayer.name : player.name;
    const base = `具體承諾：${speaker}答應${time}`;
    if (options?.saidAt === undefined) {
      return `${base}為${target}準備${object}`;
    }
    // Resolve the relative time against when it was said, so the surfaced
    // commitment can answer "哪一天說的、哪一天要兌現" instead of carrying a
    // stale "明天" forever.
    const timeZone = options.timeZone ?? 'America/Chicago';
    const saidLabel = commitmentDateLabelZh(options.saidAt, timeZone);
    const dueAt = resolveCommitmentDueAt(time, options.saidAt, timeZone);
    const dueLabel = dueAt === undefined ? '' : `（${commitmentDateLabelZh(dueAt, timeZone)}）`;
    return `${base}${dueLabel}為${target}準備${object}（說於${saidLabel}）`;
  };

  // Pass 1: acceptance-anchored. Someone closed with a clean commitment
  // response ("好", "我會", ...).
  for (let index = normalizedMessages.length - 1; index >= 0; index -= 1) {
    const message = normalizedMessages[index];
    if (!looksLikeCommitmentResponse(message.text)) continue;
    const windowMessages = normalizedMessages.slice(Math.max(0, index - 4), index + 1);
    const windowText = windowMessages.map((item) => item.text).join('\n');
    const object = commitmentObjectFromText(windowText);
    const time = commitmentTimeFromText(windowText);
    if (!object || !time) continue;
    // The promiser is whoever will actually do the making, not necessarily the
    // author of the acceptance line. If someone in the window made a
    // first-person offer ("我煮咖哩飯給你吃"), that offer's author is the
    // promiser even when the other party closed with "好". Without this, an
    // offer + "好" inverts the commitment direction. Search backward from the
    // acceptance so an acceptance that itself contains a making verb
    // ("好，我做一份") still wins.
    const offerMessage = [...windowMessages]
      .reverse()
      .find((item) => item.author && COMMITMENT_OFFER_PATTERN.test(item.text));
    const speaker = speakerName(offerMessage ?? message);
    if (!speaker) continue;
    return formatCommitment(speaker, time, object);
  }

  // Pass 2: offer-anchored. A first-person offer ("我煮咖哩飯給你吃……") that
  // nobody rejected is still a commitment, even when no clean acceptance line
  // exists — the 一之瀨 c:94554 case: she offered inside a question-marked
  // line, Alan never typed a bare "好", and the promise silently vanished.
  for (let index = 0; index < normalizedMessages.length; index += 1) {
    const message = normalizedMessages[index];
    if (!message.author || !COMMITMENT_OFFER_PATTERN.test(message.text)) continue;
    const windowText = normalizedMessages
      .slice(Math.max(0, index - 2), index + 1)
      .map((item) => item.text)
      .join('\n');
    const object = commitmentObjectFromText(windowText);
    const time = commitmentTimeFromText(windowText);
    if (!object || !time) continue;
    const rejected = normalizedMessages
      .slice(index + 1)
      .some(
        (later) =>
          later.author !== message.author &&
          /(不行|不要|不用|不吃|不能|不必|算了|先別|先不要|改天|下次)/.test(later.text),
      );
    if (rejected) continue;
    const speaker = speakerName(message);
    if (!speaker) continue;
    return formatCommitment(speaker, time, object);
  }
  return '';
}

// First-person making verb — "我煮…", "我來做…", "我會準備…". Used both to find
// the real promiser behind an acceptance line and to detect offers that were
// never explicitly accepted.
const COMMITMENT_OFFER_PATTERN =
  /我(?:來|會|再)?\s*(?:煮|做|準備|帶)|我.{0,32}(?:準備|帶|塞了?|放了?).{0,24}(?:一杯|兩杯|午餐|便當|珍珠奶茶|奶茶|咖哩)|(?:一杯少糖|一杯正常甜|你選哪一杯)/;

const COMMITMENT_WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];

// "6/11 週四" — month/day plus weekday, in the given time zone.
export function commitmentDateLabelZh(at: number, timeZone = 'America/Chicago') {
  const parts = chicagoDateParts(at, timeZone);
  return `${parts.month}/${parts.day} 週${COMMITMENT_WEEKDAYS_ZH[parts.weekday]}`;
}

function chicagoDateParts(at: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
  const fields = new Map(formatter.formatToParts(new Date(at)).map((part) => [part.type, part.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(fields.get('weekday') ?? '');
  return {
    year: Number(fields.get('year')),
    month: Number(fields.get('month')),
    day: Number(fields.get('day')),
    weekday: weekday < 0 ? 0 : weekday,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Resolve a relative commitment time ("明天" / "週末" / "週三") to an absolute
// timestamp, anchored on when it was said. Returns undefined for shapes we do
// not understand; callers then keep the relative wording only.
export function resolveCommitmentDueAt(time: string, saidAt: number, timeZone = 'America/Chicago') {
  const saidWeekday = chicagoDateParts(saidAt, timeZone).weekday;
  if (time === '明天午休') return saidAt + DAY_MS;
  if (time === '明天') return saidAt + DAY_MS;
  if (time === '週末') {
    // Already Sat/Sun -> this weekend (same day); otherwise the coming Saturday.
    if (saidWeekday === 6 || saidWeekday === 0) return saidAt;
    return saidAt + (6 - saidWeekday) * DAY_MS;
  }
  if (time === '下週末') {
    const daysToSaturday = saidWeekday === 6 || saidWeekday === 0 ? 7 : 6 - saidWeekday + 7;
    return saidAt + daysToSaturday * DAY_MS;
  }
  const weekdayMatch = time.match(/^週([一二三四五六日])$/);
  if (weekdayMatch) {
    const target = COMMITMENT_WEEKDAYS_ZH.indexOf(weekdayMatch[1]);
    if (target < 0) return undefined;
    // Next occurrence strictly after the day it was said ("週三說「週三」"
    // means next week, not today).
    const delta = ((target - saidWeekday + 7 - 1) % 7) + 1;
    return saidAt + delta * DAY_MS;
  }
  return undefined;
}

// Parse the "（6/11 週四）" due label back out of a surfaced commitment and
// decide whether the promised time has already passed (date-level, in the
// commitment's time zone). `createdAt` supplies the year context.
export function commitmentIsExpired(
  commitmentText: string,
  createdAt: number,
  now = Date.now(),
  timeZone = 'America/Chicago',
) {
  const due = commitmentText.match(/（(\d{1,2})\/(\d{1,2}) 週[一二三四五六日]）/);
  if (!due) {
    // Legacy rows without a due label: a "明天" promise read 48h+ later is
    // certainly past — without this, 海's 6/4 「答應明天」 would surface on
    // 6/10 as still honorable. Other relative shapes stay non-expiring.
    if (/答應明天/.test(commitmentText) && now - createdAt > 2 * DAY_MS) return true;
    return false;
  }
  const created = chicagoDateParts(createdAt, timeZone);
  const month = Number(due[1]);
  const day = Number(due[2]);
  // Year wraparound: a December commitment due in January belongs to next year.
  const year = month < created.month - 6 ? created.year + 1 : created.year;
  const today = chicagoDateParts(now, timeZone);
  const dueOrdinal = year * 10000 + month * 100 + day;
  const todayOrdinal = today.year * 10000 + today.month * 100 + today.day;
  return dueOrdinal < todayOrdinal;
}

function normalizeTraditionalFoodText(text: string) {
  return text.replace(/咖喱/g, '咖哩').replace(/珍珠奶查/g, '珍珠奶茶').replace(/麻/g, '嗎');
}

function looksLikeCommitmentResponse(text: string) {
  if (/[？?]|嗎/.test(text)) return false;
  if (!/(好|可以|我會|我試試|我来|我來|記得|答應|做一份|準備|帶過去|帶給你)/.test(text)) {
    return false;
  }
  return !/(不行|不要|不能|不會|算了|先別|先不要)/.test(text);
}

function commitmentObjectFromText(text: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  // Prefer more specific objects over the container/meal around them. In
  // "明天午休帶便當盒 + 珍珠奶茶" the memorable promise is the tea, not the box.
  for (const object of ['珍珠奶茶', '午餐', '便當', '咖哩飯']) {
    for (const line of [...lines].reverse()) {
      if (!lineContainsCommitmentObject(line, object)) continue;
      if (lineRejectsCommitmentObject(line, object)) continue;
      if (lineAsksOnlyAboutPriorCommitment(line, object)) continue;
      if (lineSupportsCommitmentObject(line, object)) return object;
    }
  }
  return '';
}

function lineContainsCommitmentObject(line: string, object: string) {
  return new RegExp(objectPattern(object)).test(line);
}

function objectPattern(object: string) {
  if (object === '珍珠奶茶') return '(?:珍珠奶茶|奶茶)';
  if (object === '午餐') return '午餐';
  if (object === '便當') return '便當(?:盒)?';
  if (object === '咖哩飯') return '咖哩(?:飯)?';
  return object.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lineRejectsCommitmentObject(line: string, object: string) {
  const pattern = objectPattern(object);
  const rejection = '(?:先不要|不要|不用|不吃|不能|不必|算了|先別|改天|下次)';
  return new RegExp(`${rejection}.{0,16}${pattern}|${pattern}.{0,16}${rejection}`).test(line);
}

function lineAsksOnlyAboutPriorCommitment(line: string, object: string) {
  return new RegExp(`${objectPattern(object)}的約定`).test(line) && /[？?嗎]/.test(line) && !COMMITMENT_OFFER_PATTERN.test(line);
}

function lineSupportsCommitmentObject(line: string, object: string) {
  const pattern = objectPattern(object);
  const objectNearbySupport = new RegExp(
    `(?:想吃|要吃|一起吃|一起喝|喝|少糖|正常甜|給我吃|做給我|煮給我|準備|帶上|帶|便當盒).{0,24}${pattern}|${pattern}.{0,24}(?:想吃|要吃|一起吃|一起喝|喝|少糖|正常甜|給我吃|做給我|煮給我|準備|帶上|帶|一杯|兩杯|便當盒)`,
  );
  return COMMITMENT_OFFER_PATTERN.test(line) || objectNearbySupport.test(line);
}

function commitmentTimeFromText(text: string) {
  if (/下週末|下周末/.test(text)) return '下週末';
  if (/週末|周末/.test(text)) return '週末';
  if (/明天(?:午休|中午)/.test(text)) return '明天午休';
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
  if (name === 'Maomao' || name === '貓貓' || name === '曹操') return '貓貓';
  if (name === 'Sakiko' || name === '祥子' || name === '劉備') return '祥子';
  return name;
}

export function hasMemoryPostProcessingDrift(description: string) {
  return (
    hasDialogueSystemPhraseLeak(description) ||
    MEMORY_POST_PROCESSING_DRIFT_CUES.some((cue) => description.includes(cue))
  );
}

// Prefix stamped onto a memory whose content the other party later corrected
// ("不是，我說的是…"). Marked memories are hidden from prompt read paths so the
// fabrication stops resurfacing as canon.
export const RECALL_CORRECTED_MARKER = '〔此記憶曾被對方糾正，內容不可靠〕';

export function shouldExposeMemoryDescription(description: string) {
  if (description.includes(RECALL_CORRECTED_MARKER)) return false;
  return !hasMemoryPostProcessingDrift(description);
}

// When a correction happened, find what the speaker claimed to remember
// ("我記得你說過X" -> X) so the matching older false memory can be
// down-weighted. Best-effort text extraction; the manual school mutation
// covers anything this misses.
export function claimedRecallFragmentsFromMessages(
  messages: { author?: string; text: string }[],
  speakerPlayerId: string,
) {
  const fragments: string[] = [];
  for (const message of messages) {
    if (message.author !== speakerPlayerId) continue;
    const matches = message.text.matchAll(
      /(?:我記得|我們談過|你曾說|你說過|你提過)+[，,：:]?「?([^。！？!?\n「」]{6,40})/g,
    );
    for (const match of matches) {
      const fragment = match[1].trim();
      if (fragment.length >= 6 && !fragments.includes(fragment)) fragments.push(fragment);
    }
  }
  return fragments;
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

// Who leaves a residue from this conversation. The speaker carries the trace, so
// they must be a soul pilot. The other party is either another pilot (pilot↔pilot)
// OR the human, Alan (pilot↔Alan): in this world it is only Alan + the six, and a
// conversation with Alan should leave a soul-trace in the character too —
// otherwise talking to Alan would be the one kind of conversation that never
// touches anyone's soul. (Alan himself has no agent, so only the character side
// writes a residue: 海 carries what talking to Alan left in her, grounded on
// Alan's authored Public Self.)
export function residueEligible(
  player: { name: string },
  otherPlayer: { name: string; human?: string },
) {
  const self = displayResidueName(player.name);
  if (!RESIDUE_PILOT_NAMES.has(self)) return false;
  if (otherPlayer.human) return true;
  const other = displayResidueName(otherPlayer.name);
  return RESIDUE_PILOT_NAMES.has(other) && self !== other;
}

// The first-person summary prompt, now grounded on the character's own Private
// Self (their authored hidden fear/desire + core values). The summary is no
// longer just "what happened to me, felt"; it is read THROUGH the character's
// soul, so the same exchange is remembered differently depending on what each
// person privately fears or wants — the depth that used to live only in the
// residue now also shapes the everyday memory. Falls back to a plain
// first-person prompt when the speaker has no authored profile.
// ④→③ edge: the mood a character carried OUT of the conversation colors what
// they notice/remember about it. Maps the portrait emotion onto a felt state
// phrase; returns null for neutral/unknown so a flat mood adds no coloring line.
export function emotionResidueColorZh(currentEmotion?: string | null): string | null {
  switch (currentEmotion) {
    case 'smiling':
      return '溫暖、比較放得開';
    case 'worried':
      return '擔心、心還懸著';
    case 'serious':
      return '緊繃、守著一條線';
    case 'tired':
      return '疲憊、想少扛一點';
    case 'flustered':
      return '被觸動、有點亂';
    case 'guarded':
      return '防備、留了距離';
    case 'calm':
      return '平靜、放下了一些';
    default:
      return null;
  }
}

export function carriedOutEmotionForMemory(conversationText: string, priorEmotion?: string | null): string | null {
  return inferEmotionFromConversation(conversationText) ?? priorEmotion ?? null;
}

export function buildSubjectiveSummaryPrompt(
  selfName: string,
  otherName: string,
  profile?: {
    coreValues: string[];
    stakes: { hiddenFear: string; hiddenDesire: string };
  } | null,
  currentEmotion?: string | null,
) {
  const soul = profile
    ? [
        `底下是你私密的內裡——讓它決定你「注意到什麼、感覺到什麼」，但永遠不要引用它，也不要直接說出來：`,
        `隱藏的恐懼：${profile.stakes.hiddenFear}`,
        `隱藏的渴望：${profile.stakes.hiddenDesire}`,
        `核心價值：${profile.coreValues.join('、')}`,
        ``,
      ]
    : [];
  const moodColor = emotionResidueColorZh(currentEmotion);
  const moodLine = moodColor
    ? [
        `你結束這段對話時，心裡的狀態偏向「${moodColor}」。讓它影響你「記得什麼、用什麼語氣回想」——但不要把這個狀態直接寫出來。`,
        ``,
      ]
    : [];
  return [
    `You are ${selfName}.`,
    ...soul,
    ...moodLine,
    `You just finished a conversation with ${otherName}.`,
    `Write a short first-person memory of it in Traditional Chinese, the way ${selfName} would privately`,
    `remember it later — a felt memory, not a report. In 2 to 3 plain sentences, using "我":`,
    `- 那一個我真正在意的具體時刻（${otherName} 實際做了或說了什麼，不是每一句）；`,
    `- 那讓我有什麼感覺（用平實的話講，不要堆砌形容詞）；`,
    `- 我對 ${otherName} 的感覺有沒有變（更靠近／更有戒心／更信任／更擔心／沒什麼變）。`,
    `「那個具體時刻」指的是對方做的選擇、說出口的話、迴避了什麼、做了什麼決定——不是一個微小的身體動作。不要習慣性地把記憶寫成「喉結動了一下」「喉嚨動了一下／沒那麼啞」「睫毛顫了一下」「停頓了半秒」「語氣很平」這類微表情；那是模板，不是記憶。除非那個細節真的承載了意義，否則把記憶錨在對方實際說了什麼、選了什麼、決定了什麼上。`,
    `寫得像樸素的觀察筆記，不要寫成格言或人生感悟：不要用「原來…」這種頓悟句型，也不要用「被看見但不被看穿」這類對仗漂亮話。`,
    `只寫我自己的感覺；不要替 ${otherName} 臆測他沒有真正表現出來的內心或恐懼。`,
    `Stay strictly inside what was actually said in this conversation. Do not invent facts, places, objects,`,
    `plans, or anything ${otherName} did not actually say. Do not quote or restate the soul lines above. 若這次`,
    `沒什麼分量，就寫得簡短平淡，不要硬撐。`,
  ].join('\n');
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
  otherPlayer: { name: string; human?: string },
  messages: Doc<'messages'>[],
  summary: string,
  allowShortAutonomousSoulMemory = false,
) {
  if (!emotionalResidueEnabled() || !residueEligible(player, otherPlayer)) return '';
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

// Soul-grounded LLM residue. Instead of the hand-written per-character regex in
// deterministicResidueSentence, this hands the character's authored five-layer
// soul (Private Self = profile.stakes, plus core values) to the model and asks
// for the ONE emotional trace this conversation left — whether it touched a
// hidden fear/desire or shifted how the character now sees the other. The model
// is told to answer 無 when nothing genuinely resonated, so the prompt itself is
// the resonance gate (no regex token list needed for the three characters that
// never had a hand-written branch). The output still passes every existing
// guard via sanitizeLlmResidue + the downstream repeat/recall-correction gates.
export function buildResiduePrompt(
  self: string,
  other: string,
  profile: {
    coreValues: string[];
    stakes: {
      hiddenFear: string;
      hiddenDesire: string;
      emotionalVulnerability: string;
      relationshipInsecurity: string;
    };
  },
  // The other party's Public Self — role, outward manner, how they speak. A
  // residue lives at the meeting point of what the OTHER actually did/showed
  // (their surface — you never see their private interior) and what it touched
  // in YOUR private fear/desire. Grounding on the other's authored Public Self
  // makes the trace specific to this relationship (海's trace about 真晝 ≠ about
  // 天澤) and keeps "what they did" inside what that character would plausibly do.
  otherPublic: { role: string; persona: string; communicationStyle: string } | null,
  transcript: string,
  currentEmotion?: string | null,
) {
  const lines = [
    `You are ${self}. The lines below are your private inner soul. Use them only to interpret what you felt — never quote them, never state them outright.`,
    `隱藏的恐懼：${profile.stakes.hiddenFear}`,
    `隱藏的渴望：${profile.stakes.hiddenDesire}`,
    `情緒上的脆弱：${profile.stakes.emotionalVulnerability}`,
    `關係裡的不安：${profile.stakes.relationshipInsecurity}`,
    `核心價值：${profile.coreValues.join('、')}`,
  ];
  const lens = residueLensFor(self);
  if (lens) {
    lines.push(
      ``,
      `如果這次真的有東西留下，對你（${self}）這個人來說，那多半會是：${lens}。讓殘留（如果有的話）從「你會看見的東西」長出來，而不是任何人都會說的那種觀察；但這不是要你硬擠出一個——沒分量時，「無」才是對的答案。`,
    );
  }
  if (otherPublic) {
    lines.push(
      ``,
      `這是 ${other} 在別人面前的樣子（你只看得見 ${other} 的表面，看不見 ${other} 的內心）。用它來判斷 ${other} 這次「實際做了什麼、顯露出什麼」：`,
      `${other} 的角色：${otherPublic.role}`,
      `${other} 平常的樣子：${otherPublic.persona}`,
      `${other} 說話的方式：${otherPublic.communicationStyle}`,
    );
  }
  const moodColor = emotionResidueColorZh(currentEmotion);
  if (moodColor) {
    lines.push(
      ``,
      `你走出這段對話時，心裡的狀態偏向「${moodColor}」。讓它影響你「會不會在意、注意到什麼、用什麼語氣記住」——但不要把這個狀態直接寫進殘留裡。`,
    );
  }
  lines.push(
    ``,
    `You just talked with ${other}. The conversation:`,
    transcript,
    ``,
    `先誠實判斷一件事：這次對話，有沒有真的在你（${self}）心裡留下一點分量？`,
    `大多數平常的對話其實不會——它就是普通地發生、普通地過去，沒有哪一刻特別卡住你。那很正常，這種時候就只輸出：無。`,
    `只有當這次真的有一刻讓你在意（${other} 實際做了或說了什麼，碰到了你心裡的某個東西），才寫下那一道痕跡。寧可常常是「無」，也不要為了交差去抓一個其實不重要的小細節。`,
    `如果真的要寫，就寫最多一句 情緒殘留（繁體中文）：`,
    `規則：`,
    `- 以「${self}還記得」開頭，並且具體指向 ${other} 這次做了什麼（看得到、聽得到的實際舉動或話）。`,
    `- 像一句樸素的觀察筆記，不是格言或人生感悟：不要用「原來…」這種頓悟句型，也不要寫成普世道理或漂亮的比喻。`,
    `- 避免每次都用同一種固定句式（例如老是寫成「停頓的那半秒」或「語氣像在報…」）；換成你這個角色真正注意到的具體細節。`,
    `- 不要把微小的身體動作（喉結、睫毛、眨眼、停頓半拍、尾音上揚、袖口的灰）當成預設殘留——它們大多不夠分量，這種時候應該直接輸出「無」。只有那個細節真的承載了意義時才寫。比起微動作，更值得留下的是：對方的選擇、語氣、沉默、迴避了什麼、做了什麼決定。`,
    `- 只寫你自己的感覺；不要替 ${other} 臆測他沒有真正表現出來的內心、恐懼或動機。`,
    `- 這是留下的「感覺」，不是摘要：不要逐句複述，也不要引用對話原句。`,
    `- 只能根據對話真的發生過的內容，不可虛構任何事實、物件、地點或 ${other} 沒做過的動作。`,
    `- 不要寫成舞台動作描述（不要描寫你的手、視線、動作）。`,
    `- 不超過 35 個中文字，盡量短、白話、不堆砌形容詞。`,
    `[只輸出那一句，或「無」。不要解釋、不要加引號。]`,
  );
  return lines.join('\n');
}

// Returns the residue string, '' when the model honestly found no trace (無),
// or null when the provider failed (caller should fall back to deterministic).
export function sanitizeLlmResidue(raw: string, self: string): string | null {
  if ((raw ?? '').trim() === RESIDUE_LLM_FAILED) return null;
  let text = (raw ?? '').split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  text = text.replace(/^[「『"'\s]+|[」』"'\s]+$/g, '').trim();
  text = text.replace(/^(情緒殘留|殘留|residue)\s*[：:]\s*/i, '').trim();
  if (!text || text === '無' || text === '沒有' || text === '没有') return '';
  if (
    hasSloganLikeResidue(text) ||
    hasDialogueSystemPhraseLeak(text) ||
    hasDialogueStageDirectionLeak(text) ||
    // Fiction-break guard: Alan's authored Public Self literally calls him a
    // 「人類玩家」building 「AI worlds」. Grounding a character's residue on that
    // must not let the meta language leak into the in-world trace.
    /人類玩家|玩家|AI\s*world|AI\s*社群|模擬|程式|NPC|角色設定/i.test(text)
  ) {
    return '';
  }
  // A trace that forgot to name itself still reads as one if it at least sounds
  // like remembering; otherwise keep it but bound the length like the
  // deterministic path so a runaway summary can never become residue.
  void self;
  return text.length > 90 ? text.slice(0, 89) + '。' : text;
}

async function llmResidueSentence(
  ctx: ActionCtx,
  player: { id?: string; name: string; currentEmotion?: string | null },
  otherPlayer: { id?: string; name: string; human?: string },
  messages: Doc<'messages'>[],
  allowShortAutonomousSoulMemory = false,
): Promise<string | null> {
  if (!emotionalResidueEnabled() || !residueEligible(player, otherPlayer)) return null;
  if (messages.length < RESIDUE_MIN_MESSAGES && !allowShortAutonomousSoulMemory) return null;
  if (process.env.UNDERWORLD_RESIDUE_LLM === 'false') return null;
  const profile = giisProfileForName(player.name);
  if (!profile) return null;
  // The other party's authored Public Self grounds "what they actually did".
  const otherProfile = giisProfileForName(otherPlayer.name);
  const otherPublic = otherProfile
    ? {
        role: otherProfile.role,
        persona: otherProfile.persona,
        communicationStyle: otherProfile.communicationStyle,
      }
    : null;
  const self = displayResidueName(player.name);
  const other = displayResidueName(otherPlayer.name);
  const transcript = messages.map((message) => message.text).join('\n');
  const raw = await safeMemoryCompletion(
    {
      messages: [
        {
          role: 'user',
          content: buildResiduePrompt(self, other, profile, otherPublic, transcript, player.currentEmotion),
        },
      ],
      max_tokens: 120,
      timeoutMs: MEMORY_LLM_TIMEOUT_MS,
    },
    RESIDUE_LLM_FAILED,
    memoryCloudModel('residue'),
  );
  return sanitizeLlmResidue(raw, self);
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

// Prefix inserted right after `具體承諾：` once the promise has actually been
// honored in real life (e.g. the curry got cooked). Marked commitments stop
// surfacing in the 未了的約定 prompt block but remain visible in the notebook
// as 已兌現 history. Marking is manual via school:markCommitmentFulfilled.
export const COMMITMENT_FULFILLED_MARKER = '〔約定已兌現〕';

// `commitmentFromMemoryDescription` returns the commitment text including the
// marker (it sits inside the same `具體承諾：…` segment); callers use this to
// tell a fulfilled promise from an open one.
export function commitmentIsFulfilled(commitmentText: string) {
  return (commitmentText ?? '').includes(COMMITMENT_FULFILLED_MARKER);
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

// Down-weight memories whose content was later corrected by the other party:
// stamp RECALL_CORRECTED_MARKER (which hides them from prompt read paths) and
// zero their importance so embedding recall stops preferring them. Matching is
// substring-based and bounded; returns how many memories were updated.
export const downweightMemoriesMatching = internalMutation({
  args: {
    playerId,
    fragment: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const fragment = args.fragment.trim();
    if (fragment.length < 6) return 0;
    const memories = await ctx.db
      .query('memories')
      .withIndex('playerId', (q) => q.eq('playerId', args.playerId))
      .order('desc')
      .take(Math.min(Math.max(args.limit ?? 100, 1), 200));
    let updated = 0;
    for (const memoryDoc of memories) {
      if (memoryDoc.description.includes(RECALL_CORRECTED_MARKER)) continue;
      const hit =
        memoryDoc.description.includes(fragment) ||
        (fragment.length > 10 && memoryDoc.description.includes(fragment.slice(0, 10)));
      if (!hit) continue;
      await ctx.db.patch(memoryDoc._id, {
        description: `${RECALL_CORRECTED_MARKER}${memoryDoc.description}`,
        importance: 0,
      });
      updated += 1;
    }
    return updated;
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

export function hasDialogueStageDirectionLeak(text: string) {
  return hasThirdPersonSelfNarrationLeak(text) || hasFirstPersonStageDirectionLeak(text);
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
  if (
    hasUnansweredHumanTailForMemory(
      messages,
      new Set([player, otherPlayer].filter((participant) => participant.human).map((participant) => participant.id)),
    )
  ) {
    logGiisTiming({
      action: 'rememberConversation',
      phase: 'skipUnansweredHumanTail',
      player: player.name,
      otherPlayer: otherPlayer.name,
      conversationId,
    });
    return;
  }
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
  if (messages.some((message) => hasDialogueStageDirectionLeak(message.text))) {
    logGiisTiming({
      action: 'rememberConversation',
      phase: 'skipDialogueStageDirectionLeak',
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

  const fallbackSummary = deterministicConversationSummary(player, otherPlayer, messages, {
    saidAt: data.conversation.created ?? data.conversation._creationTime,
  });
  const carriedOutEmotion = carriedOutEmotionForMemory(
    `${fallbackSummary}\n${meaningfulMessages.map((message) => message.text).join('\n')}`,
    player.currentEmotion,
  );
  const llmMessages: LLMMessage[] = [
    {
      role: 'user',
      content: buildSubjectiveSummaryPrompt(
        player.name,
        otherPlayer.name,
        giisProfileForName(player.name),
        carriedOutEmotion,
      ),
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
  // Soul-pilot pairs (海↔真晝↔天澤↔一之瀨↔貓貓↔祥子) and Alan-facing chats get the
  // LLM first-person summary so the memory actually reads THIS conversation, in
  // each participant's own voice. The earlier worry — "the LLM writes the same
  // objective line for both" — was a symptom of the shallow old prompt; the
  // deepened prompt above forces a per-perspective answer (the one moment that
  // mattered to ME, MY emotion, how it shifted how I see THEM, what I want
  // next), so 海 and 天澤 diverge by what each actually took away, not just by a
  // hand-written owner template. The deterministic owner-perspective summary
  // (subjectiveMemoryJudgmentForMessages, via fallbackSummary) stays as the
  // safety net when the provider errors/times out, and other autonomous NPC
  // chatter can opt into the LLM summary with MEMORY_AUTONOMOUS_LLM_SUMMARY=true.
  const useSubjectiveLlmSummary =
    humanInConversation ||
    pilotResiduePair(player.name, otherPlayer.name) ||
    (process.env.MEMORY_AUTONOMOUS_LLM_SUMMARY === 'true' && !MEMORY_LLM_DETERMINISTIC);
  const content = useSubjectiveLlmSummary
    ? await safeMemoryCompletion(
        {
          messages: llmMessages,
          max_tokens: 500,
          timeoutMs: MEMORY_LLM_TIMEOUT_MS,
        },
        fallbackSummary,
        memoryCloudModel('summary'),
      )
    : fallbackSummary;
  // Use the conversation's logical start (`created`) rather than the DB row's
  // `_creationTime`. They coincide for live conversations, but for a re-archived
  // (backfilled) conversation `_creationTime` is the re-archive moment, which
  // would mislabel an old chat as having happened "just now".
  const conversationStartedAt = data.conversation.created ?? data.conversation._creationTime;
  const concreteCommitment = concreteCommitmentSummaryForMessages(player, otherPlayer, messages, {
    saidAt: conversationStartedAt,
  });
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
  const baseDescription = `與 ${otherPlayer.name} 在 ${new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(conversationStartedAt))} 的對話：${contentWithCommitment}`;
  // Soul-grounded LLM residue first; fall back to the deterministic per-character
  // sentence only when the model path is unavailable / errored (null). An empty
  // string from the LLM path means it honestly found no trace (無) and is
  // respected — we do not paper over that with a template residue.
  const llmResidue = await llmResidueSentence(
    ctx,
    { ...player, currentEmotion: carriedOutEmotion },
    otherPlayer,
    messages,
    allowShortAutonomousSoulMemory,
  );
  let residueSource: 'llm_soul' | 'deterministic' | 'none' = 'none';
  const candidateResidue =
    llmResidue !== null
      ? llmResidue
      : deterministicResidueSentence(
          player,
          otherPlayer,
          messages,
          content,
          allowShortAutonomousSoulMemory,
        );
  if (llmResidue !== null && candidateResidue) {
    residueSource = 'llm_soul';
  } else if (llmResidue === null && candidateResidue) {
    residueSource = 'deterministic';
  }
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
      residueSource = 'none';
    }
  }
  // Anti-confabulation: if the other party corrected the speaker's recall in this
  // conversation ("不是，我說的是…", "你記錯了"), the speaker likely invented a
  // memory. Do not canonize that turn's residue, or the fabrication becomes
  // durable "truth" the speaker confidently recalls later. The base summary and
  // any concrete commitment (often the corrected, real one) are still kept.
  const recallCorrected = conversationHasRecallCorrection(messages, player.id as GameId<'players'>);
  if (residue && recallCorrected) {
    logGiisTiming({
      action: 'rememberConversation',
      phase: 'skipResidueRecallCorrected',
      player: player.name,
      otherPlayer: otherPlayer.name,
    });
    residue = '';
    residueSource = 'none';
  }
  // Retroactive anti-confabulation: the correction also means an OLDER memory
  // likely holds the original fabrication (the 6/4 「世界變得太聰明」 case kept
  // resurfacing for days). Down-weight matching prior memories so the false
  // recall stops being canon.
  if (recallCorrected) {
    const fragments = claimedRecallFragmentsFromMessages(
      messages,
      player.id as GameId<'players'>,
    ).slice(0, 2);
    for (const fragment of fragments) {
      const updated = await ctx.runMutation(selfInternal.downweightMemoriesMatching, {
        playerId: player.id as GameId<'players'>,
        fragment,
      });
      if (updated > 0) {
        logGiisTiming({
          action: 'rememberConversation',
          phase: 'downweightCorrectedRecall',
          player: player.name,
          count: updated,
        });
      }
    }
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
  // Underworld experience-log MVP. Runs only AFTER every existing quality
  // gate above (weak-shape, fallback-only, degenerate-pilot-exit, system
  // phrase leak, post-processing drift) has passed and the conversation
  // memory was actually inserted. The writer itself gates again on the
  // current evidence pilot cast and dedupe/cap; non-pilot pairs short-circuit
  // cheaply inside the mutation. Never written from raw message insert.
  const experienceStart = Date.now();
  const experienceResult = await ctx.runMutation(
    internal.agent.experienceLog.recordExperienceLogIfEligible,
    {
      worldId,
      playerId: player.id as GameId<'players'>,
      otherPlayerId: otherPlayer.id as GameId<'players'>,
      conversationId,
      sourceKind: 'archivedConversation',
      playerName: player.name,
      otherPlayerName: otherPlayer.name,
      summary: content,
      residue,
      residueSource,
      messageTexts: messages.map((message) => message.text),
      messages: messages.map((message) => {
        const author = message.author === player.id ? player : otherPlayer;
        return {
          authorName: author.name,
          text: message.text,
        };
      }),
      conversationStartedAt,
    },
  );
  logGiisTiming({
    action: 'rememberConversation',
    phase: 'experienceLogTime',
    ms: Date.now() - experienceStart,
    player: player.name,
    written: experienceResult.written,
    reason: experienceResult.reason,
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

// Nightly "睡前回響": once a (local) day, each pilot character reviews the day's
// memories and the LLM consolidates at most a few into long-term character
// memory. Default mode is 'shadow' — it computes and returns what WOULD be
// kept, writing nothing — so Alan can read the preview (and catch fabrications
// hardening into traits) before the write path is ever enabled. 'write'
// requires the approval token AND skips any character who already reflected
// today, so re-running the cron is idempotent.
const NIGHTLY_REFLECTION_APPROVAL = 'alan-approved-nightly-reflection-2026-06-12';
const NIGHTLY_REFLECTION_THRESHOLD = Number(
  process.env.NIGHTLY_REFLECTION_THRESHOLD ?? 18,
);

export function localDayKey(ts: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ts));
}

export const nightlyReflectionForWorld = action({
  args: {
    worldId: v.id('worlds'),
    mode: v.optional(v.union(v.literal('shadow'), v.literal('write'))),
    approval: v.optional(v.string()),
    threshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const mode = args.mode ?? 'shadow';
    if (mode === 'write' && args.approval !== NIGHTLY_REFLECTION_APPROVAL) {
      throw new Error('nightly reflection write requires the approval token');
    }
    const threshold = args.threshold ?? NIGHTLY_REFLECTION_THRESHOLD;
    const now = Date.now();
    const todayKey = localDayKey(now);

    const players = await ctx.runQuery(internal.agent.memory.pilotPlayersForReflection, {
      worldId: args.worldId,
    });

    const perCharacter = [];
    let written = 0;
    for (const player of players) {
      const result = await computeReflectionInsights(
        ctx,
        args.worldId,
        player.playerId as GameId<'players'>,
        { threshold },
      );
      const alreadyReflectedToday =
        result.lastReflectionTs !== undefined && localDayKey(result.lastReflectionTs) === todayKey;

      let didWrite = false;
      if (
        mode === 'write' &&
        result.shouldReflect &&
        result.memoriesToSave.length > 0 &&
        !alreadyReflectedToday
      ) {
        await ctx.runMutation(selfInternal.insertReflectionMemories, {
          worldId: args.worldId,
          playerId: player.playerId as GameId<'players'>,
          reflections: result.memoriesToSave,
        });
        didWrite = true;
        written += 1;
      }

      perCharacter.push({
        name: result.name,
        shouldReflect: result.shouldReflect,
        sumImportance: result.sumImportance,
        threshold: result.threshold,
        newSinceLastCount: result.newSinceLastCount,
        consideredCount: result.consideredCount,
        alreadyReflectedToday,
        wouldKeep: result.memoriesToSave.map((m) => ({
          insight: m.description,
          importance: m.importance,
          relatedCount: m.relatedMemoryIds.length,
        })),
        wrote: didWrite,
      });
    }

    return { mode, todayKey, threshold, characters: perCharacter, written };
  },
});

// Speech-introspection capture (the "unsaid" made visible). POST-HOC + DECOUPLED:
// given the line a character actually SAID (unchanged), generate ①what they
// wanted to say + ②what they held back / why. Baseline collection is NOT touched.
// `{write:false}` = dry-run (generates + returns, no write). `{write:true}` is
// blocked unless UNDERWORLD_SPEECH_INTROSPECTION=true. Bounded by `max`.
// Run: npx convex run agent/memory:captureSpeechIntrospection '{"write":false,"max":3}'
export const captureSpeechIntrospection = action({
  args: {
    max: v.optional(v.number()),
    write: v.optional(v.boolean()),
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const write = args.write === true;
    const enabled = speechIntrospectionEnabled();
    const max = Math.max(1, Math.min(args.max ?? 4, 20));
    if (write && !enabled) {
      return {
        status: 'write_blocked' as const,
        enabled,
        reason: 'Set UNDERWORLD_SPEECH_INTROSPECTION=true before writing introspection rows.',
      };
    }
    // Explicit types break the api<->this-file inference cycle (Convex TS7022).
    type IntroTurn = {
      conversationId: string;
      day: number;
      messageUuid?: string;
      speakerPlayerId: string;
      speakerName: string;
      otherName: string;
      said: string;
      transcript: string;
    };
    const queryResult = (await ctx.runQuery(api.school.turnsForSpeechIntrospection, {
      timeZone: args.timeZone,
      limit: Math.min(max * 2, 20),
    })) as { worldId: Id<'worlds'>; turns: IntroTurn[] };
    const worldId = queryResult.worldId;
    const turns = queryResult.turns;
    const candidates = turns.filter((t: IntroTurn) => giisProfileForName(t.speakerName)).slice(0, max);
    const rows: Array<{
      conversationId: string;
      playerId: string;
      characterName: string;
      otherCharacterName: string;
      messageUuid?: string;
      innerWant: string;
      heldBack: string;
      gateReason?: string;
      said: string;
      day: number;
    }> = [];
    const results: Array<Record<string, unknown>> = [];
    for (const turn of candidates) {
      const profile = giisProfileForName(turn.speakerName);
      const prompt = buildSpeechIntrospectionPrompt(
        turn.speakerName,
        turn.otherName,
        profile
          ? {
              role: profile.role,
              persona: profile.persona,
              communicationStyle: profile.communicationStyle,
              stakes: profile.stakes,
              coreValues: profile.coreValues,
            }
          : null,
        turn.transcript,
        turn.said,
      );
      const raw = await safeMemoryCompletion(
        { messages: [{ role: 'user', content: prompt }], max_tokens: 240, timeoutMs: MEMORY_LLM_TIMEOUT_MS },
        SPEECH_INTROSPECTION_FAILED,
        memoryCloudModel('summary'),
      );
      const parsed = parseSpeechIntrospection(raw);
      if (!parsed) {
        results.push({ conversationId: turn.conversationId, speaker: turn.speakerName, status: 'no_output' });
        continue;
      }
      rows.push({
        conversationId: turn.conversationId,
        playerId: turn.speakerPlayerId,
        characterName: turn.speakerName,
        otherCharacterName: turn.otherName,
        messageUuid: turn.messageUuid,
        innerWant: parsed.innerWant,
        heldBack: parsed.heldBack,
        gateReason: parsed.gateReason,
        said: turn.said,
        day: turn.day,
      });
      results.push({
        conversationId: turn.conversationId,
        speaker: turn.speakerName,
        to: turn.otherName,
        said: turn.said.slice(0, 30),
        innerWant: parsed.innerWant,
        heldBack: parsed.heldBack,
        gateReason: parsed.gateReason,
        status: write ? 'captured' : 'dry_run',
      });
    }
    let inserted = 0;
    if (write && rows.length) {
      const res = (await ctx.runMutation(internal.school.writeSpeechIntrospectionRows, {
        worldId,
        rows,
      })) as { inserted: number };
      inserted = res.inserted;
    }
    return {
      status: write ? ('written' as const) : ('dry_run' as const),
      enabled,
      candidates: candidates.length,
      generated: rows.length,
      inserted,
      results,
    };
  },
});

export const pilotPlayersForReflection = internalQuery({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) throw new Error(`World ${args.worldId} not found`);
    const out: { playerId: string; name: string }[] = [];
    for (const player of world.players) {
      const description = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', player.id))
        .first();
      if (!description) continue;
      if (!pilotExperienceLogName(description.name)) continue;
      out.push({ playerId: player.id, name: description.name });
    }
    return out;
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
    const otherPlayerId = otherParticipantIdForConversation(conversation, args.playerId, otherParticipator);
    if (!otherPlayerId) {
      throw new Error(`Conversation ${args.conversationId} other participant not found`);
    }
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
    // ④→③ edge: the mood the speaker carried out of this conversation (set by the
    // prior ②→④ inference + decay) so residue/summary can be colored by how they felt.
    const selfProfile = await ctx.db
      .query('schoolProfiles')
      .withIndex('player', (q) => q.eq('worldId', args.worldId).eq('playerId', args.playerId))
      .first();
    return {
      player: {
        ...player,
        name: playerDescription.name,
        currentEmotion: selfProfile?.currentEmotion ?? null,
      },
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
    memoryCloudModel('importance'),
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
    // F3 idempotency: a re-archive/backfill can call this twice for one
    // conversation. Skip if this (player, conversation) memory already exists, so
    // we never double-write the core memory + its embedding.
    if (memory.data.type === 'conversation') {
      const { playerId, data } = memory;
      const existing = await ctx.db
        .query('memories')
        .withIndex('playerId_conversation', (q) =>
          q.eq('playerId', playerId).eq('data.conversationId', data.conversationId),
        )
        .first();
      if (existing) return;
    }
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
  const insightResult = await computeReflectionInsights(ctx, worldId, playerId, {
    threshold: REFLECTION_IMPORTANCE_THRESHOLD,
  });
  if (!insightResult.shouldReflect || insightResult.memoriesToSave.length === 0) {
    return false;
  }
  await ctx.runMutation(selfInternal.insertReflectionMemories, {
    worldId,
    playerId,
    reflections: insightResult.memoriesToSave,
  });
  return true;
}

// The prompt is intentionally separate so the nightly "睡前回響" path and the
// legacy threshold-triggered path build the exact same reflection instruction.
// F2 safety (before nightly reflection WRITE is ever enabled): reflection must be
// about relational/emotional stance, never a specific commitment/date — otherwise a
// confabulated `具體承諾：…明天…` could harden into a permanent belief outside the
// recall-correction net. Strip the commitment segment from the reflection input.
export function stripCommitmentForReflectionInput(description: string): string {
  return description
    .replace(/具體承諾：[^；;。\n]+[；;。]?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function buildReflectionPrompt(name: string, memories: Pick<Memory, 'description'>[]) {
  const prompt = ['[no prose]', '[Output only JSON]', `You are ${name}, statements about you:`];
  memories.forEach((m, idx) => {
    prompt.push(`Statement ${idx}: ${stripCommitmentForReflectionInput(m.description)}`);
  });
  prompt.push(
    'Infer at most 3 long-term character memories from the above statements. Only promote patterns that change relationship stance, self-understanding, repeated concern, trust/distance, or future behavior. Do not turn one ordinary daily event into a permanent trait.',
  );
  prompt.push(
    'Each insight should sound like an internal memory in Traditional Chinese, not a report. Prefer concrete relationship/emotional consequences over generic worldview summaries.',
  );
  // Anti-confabulation: a single bad daily memory must not become a permanent
  // belief. Objective facts about Alan and the world (who lives where, who said
  // what, whether something exists) are never inferred here — only the
  // character's own relational/emotional stance. This is the guard that stops a
  // night of fabricated small talk ("AI社海報", "我住宿舍") from hardening into a
  // trait. See SOUL_PROGRESSION_PLAN nightly-reflection note.
  prompt.push(
    'Do NOT invent or assert any external world fact, place, object, schedule, or what another person said or did. If a statement looks like a factual claim about Alan or the world that was corrected or is uncertain, do not promote it. Reflect only on this character\'s own feelings, stance, and relationship change.',
  );
  prompt.push(
    'Return ONLY a JSON array, parseable by JSON.parse(). Each element is an object with EXACTLY two keys: "insight" (a Traditional-Chinese string) and "statementIds" (an array of the integer Statement indices that led to it). Keys MUST be double-quoted. No prose, no markdown, no code fences, nothing before or after the array. If nothing is worth promoting, return [].',
  );
  prompt.push(
    'Example: [{"insight":"我開始把真晝的安靜當成需要被接住的訊號，而不是疏遠","statementIds":[1,2]},{"insight":"我不再急著替天澤的玩笑解釋，他得自己承認","statementIds":[4]}]',
  );
  return prompt.join('\n');
}

export type ReflectionInsightResult = {
  name: string;
  shouldReflect: boolean;
  sumImportance: number;
  threshold: number;
  consideredCount: number;
  newSinceLastCount: number;
  lastReflectionTs?: number;
  rawReflection: string;
  insights: { insight: string; statementIds: number[] }[];
  memoriesToSave: {
    description: string;
    embedding: number[];
    importance: number;
    relatedMemoryIds: Id<'memories'>[];
  }[];
};

// Compute (but do NOT write) a character's reflection. The nightly "睡前回響"
// shadow mode calls this to preview what each character would consolidate
// tonight without polluting memory; the write path inserts memoriesToSave.
export async function computeReflectionInsights(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  playerId: GameId<'players'>,
  options?: { threshold?: number; numberOfItems?: number },
): Promise<ReflectionInsightResult> {
  const threshold = options?.threshold ?? REFLECTION_IMPORTANCE_THRESHOLD;
  const { memories, lastReflectionTs, name } = await ctx.runQuery(
    internal.agent.memory.getReflectionMemories,
    {
      worldId,
      playerId,
      numberOfItems: options?.numberOfItems ?? 100,
    },
  );

  const newSince = memories.filter((m: Memory) => m._creationTime > (lastReflectionTs ?? 0));
  const sumImportance = newSince.reduce((acc: number, curr: Memory) => acc + curr.importance, 0);
  const shouldReflect = sumImportance > threshold;

  const empty: ReflectionInsightResult = {
    name,
    shouldReflect,
    sumImportance,
    threshold,
    consideredCount: memories.length,
    newSinceLastCount: newSince.length,
    lastReflectionTs,
    rawReflection: '[]',
    insights: [],
    memoriesToSave: [],
  };
  if (!shouldReflect) {
    return empty;
  }

  const rawReflection = await safeMemoryCompletion(
    {
      messages: [{ role: 'user', content: buildReflectionPrompt(name, memories) }],
      // Without an explicit cap the model truncated the JSON mid-string (the
      // "Unterminated string" parse errors that left every reflection empty); 700
      // is enough for up to 3 Traditional-Chinese insights + their statementIds.
      max_tokens: 700,
      timeoutMs: MEMORY_LLM_TIMEOUT_MS,
    },
    '[]',
    memoryCloudModel('reflection'),
  );

  let insights: { insight: string; statementIds: number[] }[] = [];
  try {
    // Tolerate code fences / stray prose around the array (the model does not
    // always return a bare array even when asked). Extract the outermost [...].
    const match = rawReflection.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : rawReflection) as unknown;
    if (Array.isArray(parsed)) {
      insights = parsed
        .filter(
          (item): item is { insight: string; statementIds: number[] } =>
            !!item &&
            typeof (item as { insight?: unknown }).insight === 'string' &&
            Array.isArray((item as { statementIds?: unknown }).statementIds),
        )
        .map((item) => ({
          insight: item.insight.trim(),
          statementIds: item.statementIds.filter((n) => typeof n === 'number'),
        }))
        .filter((item) => item.insight.length > 0);
    }
  } catch (e) {
    console.error('error parsing reflection', e);
    return { ...empty, rawReflection };
  }

  const memoriesToSave = await asyncMap(insights, async (item) => {
    const relatedMemoryIds = item.statementIds
      .map((idx: number) => memories[idx]?._id)
      .filter((id): id is Id<'memories'> => Boolean(id));
    const importance = await calculateImportance(item.insight);
    const embedding = await memoryEmbedding(item.insight);
    return { description: item.insight, embedding, importance, relatedMemoryIds };
  });

  return {
    ...empty,
    rawReflection,
    insights,
    memoriesToSave,
  };
}

// Memory summary/residue completion. When MEMORY_LLM_CLOUD=true, the same
// strong cloud model the conversations use (qwen-plus, via the pilot cloud
// path) writes the memory too — so the summary/residue is as good as the
// dialogue it remembers, instead of the weaker local model. The cloud call is
// made humanFacing=true so it bypasses the autonomous daily quota (memory must
// not starve live conversations) and only respects the (0ms) failure cooldown.
// On cloud failure it falls back to the local model (chatCompletion), and on
// that failure to the deterministic template — three tiers, so a provider blip
// never blocks a memory write.
// Per-use-case cloud model. Each memory task has a different quality/cost
// profile, and the official Qwen endpoint serves the whole family, so pick the
// right tool. Empirically (tested on real transcripts): qwen-plus writes the
// most vivid, concrete emotional residue/summary; qwen-max is more conservative
// and abstract (it even returned 無 where qwen-plus found a real trace), so the
// flagship is NOT the right tool for evocative emotional writing. The only task
// that should drop to a cheaper model is the 0–9 importance score, which is
// purely mechanical. All overridable by env if Alan wants to experiment.
type MemoryCloudUseCase = 'summary' | 'residue' | 'reflection' | 'importance';
function memoryCloudModel(useCase: MemoryCloudUseCase) {
  const base = process.env.MEMORY_LLM_CLOUD_MODEL;
  switch (useCase) {
    case 'residue':
      return process.env.MEMORY_RESIDUE_CLOUD_MODEL ?? base ?? 'qwen-plus';
    case 'reflection':
      return process.env.MEMORY_REFLECTION_CLOUD_MODEL ?? base ?? 'qwen-plus';
    case 'importance':
      return process.env.MEMORY_IMPORTANCE_CLOUD_MODEL ?? base ?? 'qwen-turbo';
    case 'summary':
    default:
      return process.env.MEMORY_SUMMARY_CLOUD_MODEL ?? base ?? 'qwen-plus';
  }
}

async function safeMemoryCompletion(
  request: Parameters<typeof chatCompletion>[0],
  fallback: string,
  cloudModel?: string,
) {
  const start = Date.now();
  if (process.env.MEMORY_LLM_CLOUD === 'true') {
    try {
      // Only the cloud call gets the cloud model name; the local fallback
      // (chatCompletion below) keeps the request's own / OLLAMA_MODEL so a
      // cloud-only model name never gets sent to Ollama.
      const { content } = await pilotCloudCompletion(
        { ...request, model: cloudModel ?? process.env.MEMORY_LLM_CLOUD_MODEL ?? 'qwen-plus' },
        true,
      );
      if (typeof content === 'string' && content.trim()) {
        logGiisTiming({
          action: 'memoryLLM',
          phase: 'llmCallTime',
          ms: Date.now() - start,
          usedFallback: false,
          provider: 'cloud',
        });
        return content;
      }
    } catch (error) {
      console.debug('Memory cloud LLM failed; falling back to local model', error);
    }
  }
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

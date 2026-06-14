import { v } from 'convex/values';
import { Doc, Id } from '../_generated/dataModel';
import { ActionCtx, internalQuery } from '../_generated/server';
import { LLMMessage, chatCompletion } from '../util/llm';
import * as memory from './memory';
import { api, internal } from '../_generated/api';
import * as embeddingsCache from './embeddingsCache';
import { GameId, conversationId, playerId } from '../aiTown/ids';
import { NUM_MEMORIES_TO_SEARCH } from '../constants';
import { nearestSchoolLocation } from '../../data/schoolLocations';
import { schoolDayRhythmContext, type SchoolDayRhythmContext } from '../../data/schoolCalendar';
import { formativeMemoriesForName, giisProfileForName } from '../../data/giisProfiles';
import {
  hasCompanionSemanticDrift,
  hasDialogueSystemPhraseLeak,
  stripSeparatorArtifacts,
  stripStageDirectionsFromDialogue,
} from './dialogueHygiene';
import {
  characterSoulPolicyViolation,
  characterSoulLocalFallbackEnabled,
  characterSoulProviderCooldownOnlyGuard,
  characterSoulProviderGuard,
  defaultCharacterSoulModel,
  freeWorldConversationProviderRole,
  isFreeWorldCloudCharacterName,
  isGeneratedFallbackText,
  recordCharacterSoulProviderAttempt,
  recordCharacterSoulProviderFailure,
  recordCharacterSoulProviderSuccess,
  shouldUseCharacterSoulCloudProvider,
} from '../modelPolicy';

const selfInternal = internal.agent.conversation;
const CONVERSATION_LLM_TIMEOUT_MS =
  Number(process.env.CONVERSATION_LLM_TIMEOUT_MS ?? process.env.SCHOOL_LLM_TIMEOUT_MS) || 12_000;
const FAST_CONVERSATION_LLM_TIMEOUT_MS =
  Number(process.env.FAST_CONVERSATION_LLM_TIMEOUT_MS) || 7_000;
const FAST_CONVERSATION_MODEL =
  process.env.CONVERSATION_FAST_MODEL ?? process.env.OLLAMA_FAST_MODEL;
const CORE_CONVERSATION_CHARACTERS = new Set(['Umi', 'Maomao', 'Ichinose']);
const CONVERSATION_NAME_ALIASES = [
  'Alan',
  'Umi',
  '海',
  '朝凪海',
  'Tianze',
  '天澤',
  '天澤一夏',
  '天擇',
  '天擇一夏',
  'Ichinose',
  '一之瀨',
  '一之瀨帆波',
  '黑化一之瀨',
  'Mahiru',
  'Mahiru Shiina',
  '真晝',
  '明晝',
  '阿真晝',
  '椎名真晝',
  'Maomao',
  '貓貓',
  'CaoCao',
  'Cao Cao',
  '曹操',
  'Sakiko',
  '祥子',
  'Liu Bei',
  'LiuBei',
  '劉備',
];

function logGiisTiming(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  console.log('[GIIS timing]', payload);
}

function residueReadMode() {
  const raw = (process.env.UNDERWORLD_RESIDUE_READ ?? '').trim().toLowerCase();
  if (raw === 'false') return 'off';
  if (raw === 'placebo') return 'placebo';
  return 'on';
}

function autonomousConversationPromptMode() {
  return process.env.AUTONOMOUS_CONVERSATION_PROMPT_MODE ?? process.env.CONVERSATION_PROMPT_MODE ?? 'compact';
}

function shouldUseCompactAutonomousPrompt(
  playerName: string,
  otherPlayerName: string,
  humanInConversation: boolean,
) {
  return (
    !humanInConversation &&
    !isCompanionChat(playerName, otherPlayerName) &&
    autonomousConversationPromptMode() === 'compact'
  );
}

function closingBeatPromptLine(playerName: string, otherPlayerName: string) {
  const self = displayConversationName(playerName);
  const other = displayConversationName(otherPlayerName);
  if (self === '天澤' && other === '一之瀨') {
    return '收尾拍 / 天澤對一之瀨：如果這句像要結束，先回扣她上一句裡的邊界、條件或溫柔，再用一句退半步或「這次不拆你」收住；不要只宣告離開。';
  }
  if (self === '一之瀨' && other === '天澤') {
    return '收尾拍 / 一之瀨對天澤：如果這句像要結束，先讓天澤親口承認一個想要或躲開的點，再用甜的邊界收住；不要只說下次見或額度用完。';
  }
  if (self === '海') {
    return '收尾拍 / 海：如果這句像要結束，要留下可執行的小交接或少接一件事；不要突然丟一句我還有事。';
  }
  if (self === '真晝') {
    return '收尾拍 / 真晝：如果這句像要結束，要先接住對方上一句的一個細節，再用不催、坐一下、或留一點安靜收住。';
  }
  return '收尾拍：如果這句像要結束，先回應對方上一句的一個具體點，再留下一個小動作、停頓、交接或邊界；不要只宣告離開。';
}

function autonomousConversationLLMEnabled() {
  if (process.env.ENABLE_AUTONOMOUS_CONVERSATION_LLM === 'true') return true;
  if (process.env.AUTONOMOUS_CONVERSATION_LLM === 'true') return true;
  return autonomousConversationLLMDefaultEnabled();
}

// Default-on when a local LLM is configured (e.g. Ollama / Qwen). Lets autonomous
// non-pilot dialogue go to the local model so deterministic templates never reach
// the archive. Explicitly opt-out with AUTONOMOUS_CONVERSATION_LLM=false.
function autonomousConversationLLMDefaultEnabled() {
  if (process.env.AUTONOMOUS_CONVERSATION_LLM === 'false') return false;
  if (process.env.ENABLE_AUTONOMOUS_CONVERSATION_LLM === 'false') return false;
  if ((process.env.LLM_PROVIDER ?? '').trim().toLowerCase() === 'ollama') return true;
  if ((process.env.OLLAMA_MODEL ?? '').trim() !== '') return true;
  if ((process.env.CONVERSATION_FAST_MODEL ?? '').trim() !== '') return true;
  return false;
}

// Whether the Alan↔Umi companion path may use the cloud adapter (same one as the
// NPC pilot). Off by default so Alan's private chat does not silently go to cloud.
function companionCloudEnabled() {
  return process.env.COMPANION_CLOUD_LLM === 'true';
}

// Alan's direct conversations are part of the character-soul surface. They
// should not archive deterministic fallback, but sending every Alan chat to a
// paid cloud provider remains an explicit budget/privacy switch.
function humanConversationCloudEnabled() {
  return (
    process.env.HUMAN_CONVERSATION_CLOUD_LLM === 'true' ||
    process.env.ALAN_HUMAN_CLOUD_LLM === 'true'
  );
}

// When Alan talks to a character, only the free-world soul/cloud characters
// (Umi/Mahiru/Tianze/Ichinose/Maomao/Sakiko) spend the paid cloud quota. Everyone else replies
// with the local model, so Alan can talk to the whole cast without exhausting the
// soul-triad cloud quota — quota exhaustion was a source of deterministic
// fallback text leaking into memory. `playerName` here is always the character
// generating the reply (Alan himself types, he is never the LLM speaker).
function humanCloudSpeaker(playerName: string) {
  return humanConversationCloudEnabled() && isFreeWorldCloudCharacterName(playerName);
}

function normalizedPilotName(name: string) {
  return name.toLowerCase().replace(/\s+/g, '');
}

export function conversationEligibleForLLM(
  playerName: string,
  otherPlayerName: string,
  humanInConversation: boolean,
) {
  if (humanInConversation) return true;
  if (characterSoulPilotPair(playerName, otherPlayerName)) return true;
  return autonomousConversationLLMEnabledFor(playerName, otherPlayerName);
}

function autonomousConversationLLMEnabledFor(playerName: string, otherPlayerName: string) {
  if (freeWorldCloudSpeaker(playerName, otherPlayerName)) return true;
  if (characterSoulPilotPair(playerName, otherPlayerName)) return true;
  if (autonomousConversationLLMEnabled()) return true;
  const pairConfig =
    process.env.AUTONOMOUS_CONVERSATION_LLM_PAIRS ??
    process.env.AUTONOMOUS_CONVERSATION_LLM_PAIR ??
    '';
  if (!pairConfig.trim()) return false;
  const currentPair = new Set([
    normalizedPilotName(playerName),
    normalizedPilotName(otherPlayerName),
  ]);
  return pairConfig
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .some((pair) => {
      const [left, right] = pair.split(':').map((name) => normalizedPilotName(name.trim()));
      return left && right && currentPair.has(left) && currentPair.has(right);
    });
}

function freeWorldCloudSpeaker(playerName: string, otherPlayerName: string) {
  return freeWorldConversationProviderRole(playerName, otherPlayerName, false) === 'cloud';
}

function localFallbackConversationModel() {
  return process.env.CHARACTER_SOUL_LOCAL_FALLBACK_MODEL ?? process.env.OLLAMA_MODEL;
}

export async function startConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { player, otherPlayer, agent, otherAgent, lastConversation, lastConversationHint, recentEvents, recentResidues, openCommitments, sleepNotes, selfState, otherState, sceneContext, clockContext } =
    await ctx.runQuery(selfInternal.queryPromptData, {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    });
  const companionMode = isCompanionChat(player.name, otherPlayer.name);
  const humanInConversation = Boolean(player.human || otherPlayer.human);
  if (!humanInConversation && !autonomousConversationLLMEnabledFor(player.name, otherPlayer.name)) {
    return '[ABORT_CONVERSATION] autonomous LLM disabled at start';
  }
  const compactAutonomousPrompt = shouldUseCompactAutonomousPrompt(
    player.name,
    otherPlayer.name,
    humanInConversation,
  );
  const memories = compactAutonomousPrompt
    ? []
    : await searchConversationMemories(
        ctx,
        player.id as GameId<'players'>,
        `${player.name} is talking to ${otherPlayer.name}`,
        Number(process.env.NUM_MEMORIES_TO_SEARCH) || NUM_MEMORIES_TO_SEARCH,
      );

  const memoryWithOtherPlayer = memories.find(
    (m: memory.Memory) =>
      m.data.type === 'conversation' && m.data.playerIds.includes(otherPlayerId),
  );
  const pilotPair = characterSoulPilotPair(player.name, otherPlayer.name);
  const prompt = compactAutonomousPrompt
    ? compactAutonomousStartPrompt({
        playerName: player.name,
        otherPlayerName: otherPlayer.name,
        agent,
        otherAgent: otherAgent ?? null,
        lastConversation,
        lastConversationHint,
        recentEvents,
        recentResidues,
        sleepNotes,
        selfState,
        otherState,
        sceneContext,
        clockContext,
      })
    : [
        `You are ${player.name}, and you just started a conversation with ${otherPlayer.name}.`,
        `You are in GIIS Underworld, a minimal AI school simulation. Always speak in Traditional Chinese.`,
        ...(dayAnchorPromptLine(clockContext) ? [dayAnchorPromptLine(clockContext)] : []),
        ...agentPrompts(otherPlayer, agent, otherAgent ?? null),
        ...characterSoulPrompt(player.name, otherPlayer.name),
        ...previousConversationPrompt(otherPlayer, lastConversation, clockContext),
        ...(companionMode ? companionChatPrompt('start') : recentEventsPrompt(recentEvents)),
        ...(humanInConversation
          ? [
              `Human opening rule: Alan is present. Greet him first in one natural sentence, then offer one small ordinary topic for the current scene. Do not open with a report, big thesis, or whole-school analysis.`,
              ...alanFacingCharacterPromptLines(player.name, undefined, clockContext),
            ]
          : []),
        ...(companionMode ? [] : relatedMemoriesPrompt(memories)),
        ...sleepNotePromptLines(sleepNotes, otherPlayer.name),
        ...everydayLifePrompt(player.name, otherPlayer.name, sceneContext, clockContext),
        ...singlePurposeConversationPrompt(player.name, otherPlayer.name, sceneContext),
      ];
  if (memoryWithOtherPlayer) {
    prompt.push(
      `Be sure to include some detail or question about a previous conversation in your greeting.`,
    );
  }
  for (const line of commitmentPromptLines(openCommitments, otherPlayer.name)) {
    prompt.push(line);
  }
  const lastPrompt = `${player.name} to ${otherPlayer.name}:`;
  if (!pilotPair) prompt.push(lastPrompt);
  const companionCloud = companionMode && companionCloudEnabled();
  const humanCloud = humanInConversation && humanCloudSpeaker(player.name);
  const freeWorldCloud = !humanInConversation && freeWorldCloudSpeaker(player.name, otherPlayer.name);
  const cloudConversation = Boolean(pilotPair) || freeWorldCloud || companionCloud || humanCloud;
  const tuning = conversationGenerationTuning(player.name, Boolean(pilotPair), cloudConversation);
  const request = {
    messages: [
      {
        role: 'system' as const,
        content: prompt.join('\n'),
      },
    ],
    max_tokens: tuning.maxTokens,
    model: tuning.model,
    stop: stopWords(otherPlayer.name, player.name),
    timeoutMs: tuning.timeoutMs,
  };
  const policyAbort = cloudConversation ? characterSoulPolicyAbortReason(tuning.model) : null;
  if (policyAbort) {
    return await localFallbackAfterPolicyAbort(request, policyAbort);
  }
  const content = await safeConversationCompletion(
    request,
    humanInConversation || cloudConversation
      ? '[ABORT_CONVERSATION] character-soul LLM unavailable'
      : '[ABORT_CONVERSATION] autonomous LLM unavailable at start',
    cloudConversation,
    humanInConversation ? undefined : cloudConversation ? localFallbackRequest(request) : undefined,
    humanInConversation,
  );
  const trimmed = sanitizeConversationContent(
    trimContentPrefx(content, lastPrompt),
    companionMode,
    player.name,
    otherPlayer.name,
    undefined,
    [],
    clockContext,
  );
  if (pilotPair && isGeneratedFallbackText(trimmed)) {
    return '[ABORT_CONVERSATION] pilot generated fallback text';
  }
  return trimmed;
}

function trimContentPrefx(content: string, prompt: string) {
  if (content.startsWith(prompt)) {
    return content.slice(prompt.length).trim();
  }
  return content;
}

export async function continueConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { player, otherPlayer, conversation, agent, otherAgent, recentEvents, recentResidues, openCommitments, sleepNotes, selfState, otherState, sceneContext, clockContext } =
    await ctx.runQuery(selfInternal.queryPromptData, {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    });
  const now = Date.now();
  const started = new Date(conversation.created);
  const companionMode = isCompanionChat(player.name, otherPlayer.name);
  const humanInConversation = Boolean(player.human || otherPlayer.human);
  if (!humanInConversation && !autonomousConversationLLMEnabledFor(player.name, otherPlayer.name)) {
    return '[ABORT_CONVERSATION] autonomous LLM disabled mid-conversation';
  }
  const compactAutonomousPrompt = shouldUseCompactAutonomousPrompt(
    player.name,
    otherPlayer.name,
    humanInConversation,
  );
  const memories = compactAutonomousPrompt
    ? []
    : await searchConversationMemories(
        ctx,
        player.id as GameId<'players'>,
        `What do you think about ${otherPlayer.name}?`,
        3,
      );
  // Hoist previous-message-dependent computation BEFORE building the prompt so
  // companionIntentPrompt can be injected high in the system prompt stack (so
  // "Alan's latest actual input: X" + binding rules are not buried after ~14
  // unrelated rules).
  const previous = await previousMessages(
    ctx,
    worldId,
    player,
    otherPlayer,
    conversation.id as GameId<'conversations'>,
  );
  const lifecycle = conversationLifecycle(player.name, otherPlayer.name, previous, recentEvents, sceneContext, clockContext);
  const pilotPair = characterSoulPilotPair(player.name, otherPlayer.name);
  if (lifecycle.shouldEnd && !humanInConversation && !pilotPair) {
    return '[ABORT_CONVERSATION] autonomous conversation lifecycle exhausted';
  }
  if (!humanInConversation && deterministicFallbackPressure(previous) >= 3) {
    return pilotPair
      ? '[ABORT_CONVERSATION] pilot deterministic exit blocked'
      : '[ABORT_CONVERSATION] autonomous deterministic pressure';
  }
  const lastAlanInput = companionMode ? lastDirectMessageFrom(otherPlayer.name, previous) : undefined;
  const lastHumanInput = humanInConversation ? lastDirectMessageFrom(otherPlayer.name, previous) : undefined;
  const companionIntent = companionMode ? companionIntentFor(lastAlanInput ?? '') : undefined;
  const prompt = compactAutonomousPrompt
    ? compactAutonomousContinuePromptBase({
        playerName: player.name,
        otherPlayerName: otherPlayer.name,
        agent,
        otherAgent: otherAgent ?? null,
        started,
        now,
        recentEvents,
        recentResidues,
        sleepNotes,
        selfState,
        otherState,
        sceneContext,
        clockContext,
        previousMessages: previous,
      })
    : [
        `You are ${player.name}, and you're currently in a conversation with ${otherPlayer.name}.`,
        `Current local school time is ${promptClockLabel(clockContext)} in America/Chicago. The conversation started around ${formatPromptDateTime(conversation.created)}.`,
        `You are in GIIS Underworld, a minimal AI school simulation. Always speak in Traditional Chinese.`,
        ...(dayAnchorPromptLine(clockContext) ? [dayAnchorPromptLine(clockContext)] : []),
        ...agentPrompts(otherPlayer, agent, otherAgent ?? null),
        ...characterSoulPrompt(player.name, otherPlayer.name),
        ...(companionMode ? companionChatPrompt('continue') : recentEventsPrompt(recentEvents)),
        // Companion intent binding lives HIGH in the prompt so the model sees
        // Alan's latest input + intent-specific instructions before the later
        // "do not mirror / do not quote" guards.
        ...(companionMode && companionIntent ? companionIntentPrompt(companionIntent, lastAlanInput) : []),
        ...(humanInConversation && !companionMode
          ? [
              `Human chat binding: Alan's latest actual input is "${clipPromptText(lastHumanInput ?? '', 80)}". Answer that input first.`,
              ...directObjectBindingPromptLines(lastHumanInput ?? ''),
              `If Alan greets you, calls your name, or asks a casual life question, greet back naturally and stay in ordinary school life. Do not jump to whole-school analysis unless Alan asks.`,
              `Yesterday/today memory rule: use "剛才" or "今天" only for evidence from the current America/Chicago calendar day; use "昨天" only when the memory/residue is explicitly labeled yesterday. If there is no transcript or memory evidence, do not invent precise callbacks like "昨天深夜你一直沒回" or dated project details.`,
              `Human chat rhythm: do not make every turn a question. If Alan asked for a concrete thing, agree/refuse/modify it in your own character style first; end with a small action, quiet reaction, or partial decision unless a follow-up is truly needed.`,
              ...alanFacingCharacterPromptLines(player.name, lastHumanInput, clockContext),
            ]
          : []),
        ...(companionMode && companionIntent && !companionNeedsMemoryContext(companionIntent)
          ? []
          : relatedMemoriesPrompt(memories)),
        ...sleepNotePromptLines(sleepNotes, otherPlayer.name),
        ...commitmentPromptLines(openCommitments, otherPlayer.name),
        ...everydayLifePrompt(player.name, otherPlayer.name, sceneContext, clockContext),
        `Below is the current chat history between you and ${otherPlayer.name}.`,
        companionMode
          ? `Do not double-greet within the same opening turn. If Alan greets again mid-conversation (e.g. "hi", "嗨", "你好"), the greeting intent block above applies — greet him back briefly first. Do not merely acknowledge, promise to remember, or restate the same thing in different words.`
          : `DO NOT greet them again. DO NOT merely acknowledge, promise to remember, or say the same thing in different words.`,
        companionMode
          ? `Respond as Alan's desktop companion: warm, direct, emotionally grounded, and practical. Ask at most one focused follow-up question (skip it entirely if Alan was just greeting, correcting, or making a one-line statement). Length must match Alan's input: 1-2 sentences if Alan was brief; 1-3 short paragraphs otherwise.`
          : `If the conversation is stalling, shift topics by asking a concrete question, introducing a human observation, mentioning a memory, or naming a small personal cost.`,
        topicShiftPrompt(player.name, sceneContext, companionMode),
        `Rhythm check before answering: the reply may be short, awkward, quiet, tired, teasing, or hesitant, but it must be a complete spoken reply. Do not end on a dangling quote, comma, "的時候", "那句", or a setup without payoff. Do not force insight if a simple human response fits better.`,
        `Soul check before answering: include at most one of these if natural: a concrete school-life detail, a personal fear, a small hesitation, a cost, a quiet silence, or a decision to stop.`,
        `Do not sound like a meeting note. Avoid labels like "main plot", "conversationOutcome", "形成意圖", or repeated thesis statements.`,
        companionMode
          ? `Do not echo Alan's wording verbatim, but DO bind to the meaning of his latest sentence — especially when Alan corrects, asks a direct question, or names a specific word. Refer to the feeling and the chosen word, not the exact phrasing.`
          : `Do not mirror the other person's last sentence. Refer to the feeling behind it, not the exact wording.`,
        `If an emotional image already appeared once in this conversation, do not reuse the same image again; choose a new concrete detail or become quieter.`,
        companionMode ? `Do not quote Alan's exact sentence verbatim, but you MUST address the specific word or framing Alan used (especially in greetings and corrections).` : `Your response should be brief and within 200 characters.`,
      ];

  if (pilotPair) {
    const lastLine = stripConversationPrefix(previous.at(-1)?.content ?? '');
    if (lastLine) prompt.push(`上一句：${clipPromptText(normalizeTraditionalZh(lastLine), 42)}`);
  }
  const llmMessages: LLMMessage[] = [
    {
      role: 'system',
      content: compactAutonomousPrompt
        ? pilotPair
          ? prompt.join('\n')
          : [
              ...prompt,
              ...compactAutonomousLifecyclePrompt(lifecycle),
              ...singlePurposeConversationPrompt(player.name, otherPlayer.name, sceneContext).slice(0, 2),
            ].join('\n')
        : [
            ...prompt,
            ...conversationLifecyclePrompt(lifecycle),
            ...emotionalBindingPrompt(lifecycle),
            ...dialogueRhythmPrompt(lifecycle),
            ...singlePurposeConversationPrompt(player.name, otherPlayer.name, sceneContext),
          ].join('\n'),
    },
    ...(compactAutonomousPrompt ? previous.slice(pilotPair ? 0 : -4) : previous),
  ];
  const lastPrompt = pilotPair ? '請直接回一句。' : `${player.name} to ${otherPlayer.name}:`;
  llmMessages.push({ role: 'user', content: lastPrompt });

  const companionCloud = companionMode && companionCloudEnabled();
  const humanCloud = humanInConversation && humanCloudSpeaker(player.name);
  const freeWorldCloud = !humanInConversation && freeWorldCloudSpeaker(player.name, otherPlayer.name);
  const cloudConversation = Boolean(pilotPair) || freeWorldCloud || companionCloud || humanCloud;
  const tuning = conversationGenerationTuning(player.name, Boolean(pilotPair), cloudConversation);
  const request = {
    messages: llmMessages,
    max_tokens: tuning.maxTokens,
    model: tuning.model,
    stop: stopWords(otherPlayer.name, player.name),
    timeoutMs: tuning.timeoutMs,
  };
  const policyAbort = cloudConversation ? characterSoulPolicyAbortReason(tuning.model) : null;
  if (policyAbort) {
    return await localFallbackAfterPolicyAbort(request, policyAbort);
  }
  const content = await safeConversationCompletion(
    request,
    humanInConversation || cloudConversation
      ? '[ABORT_CONVERSATION] character-soul LLM unavailable'
      : '[ABORT_CONVERSATION] autonomous LLM unavailable mid-conversation',
    cloudConversation,
    humanInConversation ? undefined : cloudConversation ? localFallbackRequest(request) : undefined,
    humanInConversation,
  );
  const trimmed = sanitizeConversationContent(
    trimContentPrefx(content, lastPrompt),
    companionMode,
    player.name,
    otherPlayer.name,
    lastAlanInput,
    previous,
    clockContext,
  );
  if (isRepetitiveResponse(trimmed, previous)) {
    if (pilotPair) {
      return '[ABORT_CONVERSATION] pilot repetitive response';
    }
    if (humanInConversation) {
      return '[ABORT_CONVERSATION] human conversation repetitive response';
    }
    return '[ABORT_CONVERSATION] autonomous repetitive response';
  }
  if (pilotPair && isGeneratedFallbackText(trimmed)) {
    return '[ABORT_CONVERSATION] pilot generated fallback text';
  }
  return trimmed;
}

export async function leaveConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { player, otherPlayer, conversation, agent, otherAgent, recentEvents } = await ctx.runQuery(
    selfInternal.queryPromptData,
    {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    },
  );
  const humanInConversation = Boolean(player.human || otherPlayer.human);
  const previous = await previousMessages(
    ctx,
    worldId,
    player,
    otherPlayer,
    conversation.id as GameId<'conversations'>,
  );
  const lifecycle = conversationLifecycle(player.name, otherPlayer.name, previous, recentEvents);
  if (!humanInConversation && !autonomousConversationLLMEnabledFor(player.name, otherPlayer.name)) {
    return '[ABORT_CONVERSATION] autonomous LLM disabled on leave';
  }
  const prompt = [
    `You are ${player.name}, and you're currently in a conversation with ${otherPlayer.name}.`,
    `You've decided to leave the question and would like to politely tell them you're leaving the conversation.`,
    `You are in GIIS Underworld, a minimal AI school simulation. Always speak in Traditional Chinese.`,
  ];
  prompt.push(...agentPrompts(otherPlayer, agent, otherAgent ?? null));
  prompt.push(...characterSoulPrompt(player.name, otherPlayer.name));
  prompt.push(...recentEventsPrompt(recentEvents));
  const pilotPair = characterSoulPilotPair(player.name, otherPlayer.name);
  prompt.push(
    `Below is the current chat history between you and ${otherPlayer.name}.`,
    humanInConversation
      ? `Human idle closing rule: Alan has gone quiet after you already checked in. Do not sound hurt, dramatic, or like a system timeout. Say one warm in-world closing line, e.g. you'll leave the seat open, set the food aside, or come back later.`
      : '',
    pilotPair
      ? `Character-soul pilot leave rule: answer in one plain spoken sentence, 48 Traditional Chinese characters or fewer. ${closingBeatPromptLine(player.name, otherPlayer.name)} Do not summarize the relationship, do not say "謝謝你的溫柔", "稍後再回來", "保重", or "整理沉默". Use one concrete boundary, pause, handoff, or decision.`
      : `How would you like to tell them that you're leaving? Your response should be brief and within 200 characters.`,
  );
  const llmMessages: LLMMessage[] = [
    {
      role: 'system',
      content: prompt.join('\n'),
    },
    ...previous,
  ];
  const lastPrompt = `${player.name} to ${otherPlayer.name}:`;
  llmMessages.push({ role: 'user', content: lastPrompt });
  const humanCloud = humanInConversation && humanCloudSpeaker(player.name);
  const freeWorldCloud = !humanInConversation && freeWorldCloudSpeaker(player.name, otherPlayer.name);
  const cloudConversation = Boolean(pilotPair) || freeWorldCloud || humanCloud;
  const tuning = conversationGenerationTuning(player.name, Boolean(pilotPair), cloudConversation);
  const request = {
    messages: llmMessages,
    max_tokens: tuning.maxTokens,
    model: tuning.model,
    stop: stopWords(otherPlayer.name, player.name),
    timeoutMs: tuning.timeoutMs,
  };
  const policyAbort = cloudConversation ? characterSoulPolicyAbortReason(tuning.model) : null;
  if (policyAbort) {
    return await localFallbackAfterPolicyAbort(request, policyAbort);
  }
  const content = await safeConversationCompletion(
    request,
    humanInConversation || cloudConversation
      ? '[ABORT_CONVERSATION] character-soul LLM unavailable'
      : '[ABORT_CONVERSATION] autonomous LLM unavailable on leave',
    cloudConversation,
    humanInConversation ? undefined : cloudConversation ? localFallbackRequest(request) : undefined,
    humanInConversation,
  );
  const trimmed = sanitizeConversationContent(
    trimContentPrefx(content, lastPrompt),
    false,
    player.name,
    otherPlayer.name,
    undefined,
    previous,
    undefined,
  );
  if (pilotPair && isVerboseUmiMahiruPilotExit(trimmed)) {
    return '[ABORT_CONVERSATION] pilot verbose exit';
  }
  if (pilotPair && isGeneratedFallbackText(trimmed)) {
    return '[ABORT_CONVERSATION] pilot generated fallback text';
  }
  return trimmed;
}

async function safeConversationCompletion(
  request: Parameters<typeof chatCompletion>[0],
  fallback: string,
  pilotCloudAllowed = false,
  localFallback?: Parameters<typeof chatCompletion>[0],
  humanFacing = false,
) {
  const start = Date.now();
  const promptChars = conversationPromptChars(request);
  try {
    const { content } = pilotCloudAllowed && shouldUsePilotCloudCompletion(request)
      ? await pilotCloudCompletion(request, humanFacing)
      : await chatCompletion(request);
    logGiisTiming({
      action: 'conversationLLM',
      phase: 'llmCallTime',
      ms: Date.now() - start,
      model: request.model ?? 'default',
      maxTokens: request.max_tokens,
      promptChars,
      usedFallback: false,
    });
    return typeof content === 'string' ? content : fallback;
  } catch (error) {
    // Human-facing replies must never be served by the weak local model: its
    // echo-parrot output (「小壞蛋」？) is worse than a visible abort, and it
    // gets archived as if the character really said it — polluting memory and
    // eval (observed 2026-06-11 morning while an OpenAI-compatible endpoint
    // was flapping: 天澤/祥子 parroted Alan for whole stretches). Retry the
    // primary provider once after a short pause, then abort instead of degrading.
    if (humanFacing) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const retry =
          pilotCloudAllowed && shouldUsePilotCloudCompletion(request)
            ? await pilotCloudCompletion(request, humanFacing)
            : await chatCompletion(request);
        if (typeof retry.content === 'string') {
          logGiisTiming({
            action: 'conversationLLM',
            phase: 'humanRetryCallTime',
            ms: Date.now() - start,
            model: request.model ?? 'default',
            maxTokens: request.max_tokens,
            promptChars,
            usedFallback: false,
          });
          return retry.content;
        }
      } catch (retryError) {
        console.debug(
          'Human-facing retry failed; aborting instead of weak-model fallback',
          retryError,
        );
      }
      logGiisTiming({
        action: 'conversationLLM',
        phase: 'humanAbortAfterProviderFailure',
        ms: Date.now() - start,
        model: request.model ?? 'default',
        maxTokens: request.max_tokens,
        promptChars,
        usedFallback: true,
      });
      return fallback;
    }
    const localContent = await tryLocalConversationCompletion(localFallback, promptChars);
    if (typeof localContent === 'string') {
      return localContent;
    }
    const abortingConversation = fallback.startsWith('[ABORT_CONVERSATION]');
    console.debug(
      abortingConversation
        ? 'Aborting conversation after LLM failure'
        : 'Falling back to deterministic conversation message',
      error,
    );
    logGiisTiming({
      action: 'conversationLLM',
      phase: 'llmCallTime',
      ms: Date.now() - start,
      model: request.model ?? 'default',
      maxTokens: request.max_tokens,
      promptChars,
      usedFallback: true,
    });
    return fallback;
  }
}

function conversationPromptChars(request: Parameters<typeof chatCompletion>[0]) {
  return request.messages.reduce((sum, message) => sum + (message.content?.length ?? 0), 0);
}

async function localFallbackAfterPolicyAbort(
  request: Parameters<typeof chatCompletion>[0],
  reason: string,
) {
  const localContent = await tryLocalConversationCompletion(
    localFallbackRequest(request),
    conversationPromptChars(request),
  );
  if (typeof localContent === 'string') return localContent;
  return `[ABORT_CONVERSATION] ${reason}`;
}

async function tryLocalConversationCompletion(
  localFallback: Parameters<typeof chatCompletion>[0] | undefined,
  promptChars: number,
) {
  if (!localFallback || !characterSoulLocalFallbackEnabled()) return undefined;
  try {
    const localStart = Date.now();
    const { content } = await chatCompletion(localFallback);
    logGiisTiming({
      action: 'conversationLLM',
      phase: 'localFallbackCallTime',
      ms: Date.now() - localStart,
      model: localFallback.model ?? 'default',
      maxTokens: localFallback.max_tokens,
      promptChars,
      usedFallback: true,
    });
    return typeof content === 'string' ? content : undefined;
  } catch (fallbackError) {
    console.debug('Local LLM fallback failed after cloud/provider failure', fallbackError);
    return undefined;
  }
}

function localFallbackRequest(
  request: Parameters<typeof chatCompletion>[0],
): Parameters<typeof chatCompletion>[0] | undefined {
  const model = localFallbackConversationModel();
  if (!model) return undefined;
  return {
    ...request,
    model,
    timeoutMs: envInteger('CHARACTER_SOUL_LOCAL_FALLBACK_TIMEOUT_MS', 12_000, 3_000, 60_000),
  };
}

function conversationGenerationTuning(playerName: string, pilotPair = false, cloudConversation = false) {
  const isCore = CORE_CONVERSATION_CHARACTERS.has(playerName) || isFreeWorldCloudCharacterName(playerName);
  const pilotProvider = process.env.UMI_MAHIRU_PILOT_PROVIDER?.toLowerCase();
  const pilotModel =
    process.env.UMI_MAHIRU_PILOT_MODEL ??
    defaultCharacterSoulModel(pilotProvider);
  // Alan direct conversations reuse the same cloud adapter/guard as the NPC
  // pilot. Companion mode can still pick a separate model/timeout if configured.
  const companionModel = process.env.COMPANION_PILOT_MODEL ?? pilotModel;
  return {
    tier: isCore ? 'core' : 'ordinary',
    model: pilotPair && pilotModel
      ? pilotModel
      : cloudConversation && companionModel
        ? companionModel
        : isCore ? undefined : FAST_CONVERSATION_MODEL,
    maxTokens: isCore
      ? envInteger('CONVERSATION_MAX_TOKENS', 300, 24, 300)
      : envInteger('FAST_CONVERSATION_MAX_TOKENS', 140, 24, 180),
    timeoutMs: pilotPair
      ? envInteger('UMI_MAHIRU_PILOT_TIMEOUT_MS', 35_000, 5_000, 60_000)
      : cloudConversation
        ? envInteger('COMPANION_PILOT_TIMEOUT_MS', 30_000, 5_000, 60_000)
        : isCore ? CONVERSATION_LLM_TIMEOUT_MS : FAST_CONVERSATION_LLM_TIMEOUT_MS,
  };
}

function envInteger(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function shouldUsePilotCloudCompletion(request: Parameters<typeof chatCompletion>[0]) {
  const provider = process.env.UMI_MAHIRU_PILOT_PROVIDER?.toLowerCase();
  const model = request.model ?? '';
  return shouldUseCharacterSoulCloudProvider(provider, model);
}

function characterSoulPolicyAbortReason(model: string | undefined) {
  return characterSoulPolicyViolation(process.env.UMI_MAHIRU_PILOT_PROVIDER, model);
}

function geminiModelName(model: string | undefined) {
  const configured = model || process.env.UMI_MAHIRU_PILOT_MODEL || 'gemini-2.5-flash';
  return configured.startsWith('gemini/') ? configured.slice('gemini/'.length) : configured;
}

function geminiApiKey() {
  return process.env.UMI_MAHIRU_PILOT_API_KEY ?? process.env.GEMINI_API_KEY;
}

function pilotApiKey() {
  return process.env.UMI_MAHIRU_PILOT_API_KEY;
}

function pilotBackupApiKey() {
  return process.env.UMI_MAHIRU_PILOT_API_KEY_BACKUP ?? process.env.QWEN_API_KEY_BACKUP;
}

function pilotApiKeyCandidates() {
  const candidates = [
    { label: 'primary', key: pilotApiKey() },
    { label: 'backup', key: pilotBackupApiKey() },
  ].filter((candidate): candidate is { label: string; key: string } => Boolean(candidate.key?.trim()));
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.key)) return false;
    seen.add(candidate.key);
    return true;
  });
}

function pilotBaseUrl() {
  return (
    process.env.UMI_MAHIRU_PILOT_BASE_URL ??
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/+$/, '');
}

function openAiCompatibleChatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function openaiCompatibleModelName(model: string | undefined) {
  const configured = model || process.env.UMI_MAHIRU_PILOT_MODEL || 'qwen-plus';
  return configured.startsWith('qwen/') ? configured.slice('qwen/'.length) : configured;
}

export async function pilotCloudCompletion(
  request: Parameters<typeof chatCompletion>[0],
  humanFacing = false,
): Promise<{ content: string; retries: number; ms: number }> {
  const provider = process.env.UMI_MAHIRU_PILOT_PROVIDER?.toLowerCase();
  const model = request.model ?? '';
  if (provider === 'gemini' || model === 'gemini' || model.startsWith('gemini/')) {
    return geminiPilotCompletion(request, humanFacing);
  }
  return openaiCompatiblePilotCompletion(request, humanFacing);
}

// OpenAI-compatible chat completion for the Umi/Mahiru pilot (official Qwen /
// Alibaba Cloud Model Studio or another compatible host). Key/base/model all
// come from env; nothing sensitive is hardcoded.
async function openaiCompatiblePilotCompletion(
  request: Parameters<typeof chatCompletion>[0],
  humanFacing = false,
): Promise<{ content: string; retries: number; ms: number }> {
  const apiKeys = pilotApiKeyCandidates();
  if (!apiKeys.length) {
    throw new Error(
      'UMI_MAHIRU_PILOT_PROVIDER=qwen requires UMI_MAHIRU_PILOT_API_KEY (optionally UMI_MAHIRU_PILOT_BASE_URL)',
    );
  }
  const start = Date.now();
  const body = {
    model: openaiCompatibleModelName(request.model),
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    max_tokens: Math.max(request.max_tokens ?? 96, 64),
    ...(request.stop ? { stop: request.stop } : {}),
  };
  let lastError: unknown;
  for (const [index, candidate] of apiKeys.entries()) {
    // Human-facing replies bypass the daily quota (but not the failure
    // cooldown): the shared 24/day pool is consumed by autonomous cloud
    // characters, and a quota-starved Alan chat must not degrade or die.
    const guard = humanFacing ? characterSoulProviderCooldownOnlyGuard() : characterSoulProviderGuard();
    if (!guard.allowed) {
      throw new Error(guard.reason ?? 'characterSoul provider guard blocked the call');
    }
    recordCharacterSoulProviderAttempt();
    const controller = request.timeoutMs ? new AbortController() : undefined;
    const timeout = controller
      ? setTimeout(
          () => controller.abort(`Qwen pilot completion timed out after ${request.timeoutMs}ms`),
          request.timeoutMs,
        )
      : undefined;
    let response: Response;
    try {
      response = await fetch(openAiCompatibleChatCompletionsUrl(pilotBaseUrl()), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${candidate.key}`,
        },
        signal: controller?.signal,
        body: JSON.stringify(body),
      });
    } catch (error) {
      recordCharacterSoulProviderFailure();
      lastError = error;
      if (index + 1 < apiKeys.length) continue;
      throw error;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
    if (!response.ok) {
      const error = await response.text();
      recordCharacterSoulProviderFailure();
      lastError = new Error(
        `Qwen pilot completion failed with code ${response.status} using ${candidate.label} key: ${error.slice(0, 500)}`,
      );
      if (index + 1 < apiKeys.length && shouldRetryPilotWithBackup(response.status, error)) {
        continue;
      }
      throw lastError;
    }
    const json = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const content = json.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      recordCharacterSoulProviderFailure();
      lastError = new Error(
        `Qwen pilot completion returned no text using ${candidate.label} key; finishReason=${json.choices?.[0]?.finish_reason ?? 'unknown'}`,
      );
      if (index + 1 < apiKeys.length) continue;
      throw lastError;
    }
    recordCharacterSoulProviderSuccess();
    return { content, retries: index, ms: Date.now() - start };
  }
  throw lastError instanceof Error ? lastError : new Error('Qwen pilot completion failed');
}

function shouldRetryPilotWithBackup(status: number, body: string) {
  if ([401, 403, 408, 409, 425, 429].includes(status)) return true;
  if (status >= 500) return true;
  return /quota|insufficient|balance|余额|餘額|token|rate|timeout|timed out/i.test(body);
}

async function geminiPilotCompletion(
  request: Parameters<typeof chatCompletion>[0],
  humanFacing = false,
): Promise<{ content: string; retries: number; ms: number }> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error('UMI_MAHIRU_PILOT_PROVIDER=gemini requires UMI_MAHIRU_PILOT_API_KEY or GEMINI_API_KEY');
  }
  const guard = humanFacing ? characterSoulProviderCooldownOnlyGuard() : characterSoulProviderGuard();
  if (!guard.allowed) {
    throw new Error(guard.reason ?? 'characterSoul provider guard blocked the call');
  }
  recordCharacterSoulProviderAttempt();
  const start = Date.now();
  const systemText = request.messages
    .filter((message) => message.role === 'system' && message.content)
    .map((message) => message.content)
    .join('\n');
  const userText = request.messages
    .filter((message) => message.role !== 'system' && message.content)
    .map((message) => {
      const speaker = message.role === 'assistant' ? 'assistant' : 'user';
      return `${speaker}: ${message.content}`;
    })
    .join('\n');
  const text = userText || systemText;
  const body = {
    ...(systemText && userText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: {
      temperature: request.temperature ?? 0.45,
      maxOutputTokens: Math.max(request.max_tokens ?? 96, 64),
      ...(request.stop
        ? { stopSequences: typeof request.stop === 'string' ? [request.stop] : request.stop }
        : {}),
      thinkingConfig: {
        thinkingBudget: envInteger('UMI_MAHIRU_PILOT_GEMINI_THINKING_BUDGET', 0, 0, 1024),
      },
    },
  };
  const controller = request.timeoutMs ? new AbortController() : undefined;
  const timeout = controller
    ? setTimeout(
        () => controller.abort(`Gemini pilot completion timed out after ${request.timeoutMs}ms`),
        request.timeoutMs,
      )
    : undefined;
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName(request.model)}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
        body: JSON.stringify(body),
      },
    );
  } catch (error) {
    recordCharacterSoulProviderFailure();
    throw error;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
  if (!response.ok) {
    const error = await response.text();
    recordCharacterSoulProviderFailure();
    throw new Error(`Gemini pilot completion failed with code ${response.status}: ${error.slice(0, 500)}`);
  }
  const json = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  const content =
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim() ?? '';
  if (!content) {
    recordCharacterSoulProviderFailure();
    throw new Error(`Gemini pilot completion returned no text; finishReason=${json.candidates?.[0]?.finishReason ?? 'unknown'}`);
  }
  recordCharacterSoulProviderSuccess();
  return { content, retries: 0, ms: Date.now() - start };
}

async function searchConversationMemories(
  ctx: ActionCtx,
  playerId: GameId<'players'>,
  query: string,
  limit: number,
) {
  const embedding = await embeddingsCache.fetch(ctx, query);
  return memory.searchMemories(ctx, playerId, embedding, limit);
}

type PromptAgent = { identity: string; plan: string } | null;
type PromptRecentEvent = {
  descriptionZh: string;
  interpretationZh?: string;
  reactionDialogueZh?: string;
  futureImplicationsZh?: string;
};

type PromptResidue = {
  text: string;
  createdAt: number;
};

type PromptLastConversationHint = {
  minutesAgo: number;
  topicZh: string;
  finalBeatZh: string;
  motifLabels: string[];
};

type PromptSleepNote = {
  noteZh: string;
  usageHintZh: string;
  noteType: string;
  createdAt: number;
  legacyArchive: boolean;
};

type PromptCharacterState = {
  emotionZh?: string;
  intentionZh?: string;
  memoryZh?: string;
};

function compactAutonomousStartPrompt({
  playerName,
  otherPlayerName,
  agent,
  otherAgent,
  lastConversation,
  lastConversationHint,
  recentEvents,
  recentResidues,
  sleepNotes,
  selfState,
  otherState,
  sceneContext,
  clockContext,
}: {
  playerName: string;
  otherPlayerName: string;
  agent: PromptAgent;
  otherAgent: PromptAgent;
  lastConversation: { created: number } | null;
  lastConversationHint?: PromptLastConversationHint | null;
  recentEvents?: PromptRecentEvent[];
  recentResidues?: PromptResidue[];
  sleepNotes?: PromptSleepNote[];
  selfState?: PromptCharacterState;
  otherState?: PromptCharacterState;
  sceneContext?: SceneContext;
  clockContext?: ClockContext;
}) {
  if (characterSoulPilotPair(playerName, otherPlayerName)) {
    return richUmiMahiruPrompt({
      playerName,
      otherPlayerName,
      agent,
      otherAgent,
      recentEvents,
      recentResidues,
      sleepNotes,
      selfState,
      otherState,
      sceneContext,
      clockContext,
      mode: 'start',
    });
  }
  const ownSeed = formativeMemoriesForName(playerName)[0];
  const otherSeed = formativeMemoriesForName(otherPlayerName)[0];
  return [
    'conversationMode: autonomous_school_chat_compact',
    `You are ${displayConversationName(playerName)} starting a conversation with ${displayConversationName(otherPlayerName)} in GIIS Underworld.`,
	    'Always speak in natural Traditional Chinese. Output only the spoken reply, no labels.',
	    `Keep it brief: 1-2 sentences, under 120 Chinese characters.`,
	    `Address ${displayConversationName(otherPlayerName)} only. Do not address Alan unless Alan is the listener.`,
	    speakerLockPrompt(playerName, otherPlayerName),
	    ...freeWorldNaturalnessPrompt(),
	    compactCharacterVoicePrompt(playerName, sceneContext),
	    `Your identity: ${clipPromptText(agent?.identity ?? personalLifeFragment(playerName), 150)}`,
    `Your immediate goal: ${clipPromptText(agent?.plan ?? conversationMicroPurpose(playerName, otherPlayerName, sceneContext), 140)}`,
    otherAgent ? `About ${displayConversationName(otherPlayerName)}: ${clipPromptText(otherAgent.identity, 120)}` : '',
    `Scene: ${sceneContext?.labelZh ?? '校園'}；date: ${clockContext?.dateLabelZh ?? 'today'} ${clockContext?.weekdayZh ?? ''}；time: ${clockContext?.periodLabelZh ?? 'unknown'}${clockContext?.isNight ? '，偏安靜' : ''}${clockContext?.calendarHintZh ? `；${clockContext.calendarHintZh}` : ''}.`,
    dayAnchorPromptLine(clockContext),
    ...weekendLifePromptLines(clockContext, sceneContext),
    ...COMPACT_RHYTHM_AND_RECALL_GUARDS,
    `Small purpose: ${conversationMicroPurpose(playerName, otherPlayerName, sceneContext)}.`,
    ownSeed ? `Private seed: ${clipPromptText(ownSeed, 90)}` : '',
    otherSeed ? `${displayConversationName(otherPlayerName)} pressure: ${clipPromptText(otherSeed, 80)}` : '',
    recentEvents?.[0] ? `Background weather: ${clipPromptText(compactEventTopic(recentEvents[0]), 90)}.` : '',
    lastConversation ? `You have spoken before; open with continuity only if it sounds natural.` : '',
    ...recentPairContinuityPromptLines(lastConversationHint),
    ...propDiversityPromptLines(undefined, recentResidues, playerName, otherPlayerName, sceneContext),
    ...sleepNotePromptLines(sleepNotes, otherPlayerName),
    'Opening rhythm: begin like you are naturally approaching someone, not dropping a memo. A short name call or "欸" is okay only when tied to a concrete reason; avoid generic "你好 / 最近過得怎麼樣".',
    'Do not summarize world state, write a strategy memo, or repeat campus-politics slogans.',
  ].filter(Boolean);
}

function recentPairContinuityPromptLines(hint?: PromptLastConversationHint | null) {
  if (!hint || hint.minutesAgo > 90) return [];
  const motifs = hint.motifLabels.length ? ` Motifs already used: ${hint.motifLabels.join('、')}.` : '';
  return [
    `Recent same-pair memory: ${hint.minutesAgo} minutes ago you already talked about ${clipPromptText(hint.topicZh, 90)}; the last beat was "${clipPromptText(hint.finalBeatZh, 80)}".${motifs}`,
    'Do not restart that same object/helping move as if it is new. Either briefly acknowledge the previous refusal/boundary, change topic to a different concrete life detail, or choose not to approach.',
  ];
}

export function recentPairContinuityPromptLinesForTest(hint?: PromptLastConversationHint | null) {
  return recentPairContinuityPromptLines(hint);
}

function buildLastConversationHintFromTexts(
  texts: string[],
  endedAt: number,
  now = Date.now(),
): PromptLastConversationHint | null {
  const meaningful = texts.map((text) => stripConversationPrefix(text).trim()).filter(Boolean);
  if (meaningful.length < 2) return null;
  const combined = meaningful.join('\n');
  const first = meaningful[0];
  const final = meaningful.at(-1) ?? first;
  return {
    minutesAgo: Math.max(0, Math.round((now - endedAt) / 60_000)),
    topicZh: [first, final].filter(Boolean).join(' / '),
    finalBeatZh: final,
    motifLabels: conversationMotifLabels(combined).slice(0, 4),
  };
}

export function buildLastConversationHintFromTextsForTest(
  texts: string[],
  endedAt: number,
  now: number,
) {
  return buildLastConversationHintFromTexts(texts, endedAt, now);
}

function compactAutonomousContinuePromptBase({
  playerName,
  otherPlayerName,
  agent,
  otherAgent,
  started,
  now,
  recentEvents,
  recentResidues,
  sleepNotes,
  selfState,
  otherState,
  sceneContext,
  clockContext,
  previousMessages,
}: {
  playerName: string;
  otherPlayerName: string;
  agent: PromptAgent;
  otherAgent: PromptAgent;
  started: Date;
  now: number;
  recentEvents?: PromptRecentEvent[];
  recentResidues?: PromptResidue[];
  sleepNotes?: PromptSleepNote[];
  selfState?: PromptCharacterState;
  otherState?: PromptCharacterState;
  sceneContext?: SceneContext;
  clockContext?: ClockContext;
  previousMessages?: LLMMessage[];
}) {
  if (characterSoulPilotPair(playerName, otherPlayerName)) {
    return richUmiMahiruPrompt({
      playerName,
      otherPlayerName,
      agent,
      otherAgent,
      recentEvents,
      recentResidues,
      sleepNotes,
      selfState,
      otherState,
      sceneContext,
      clockContext,
      previousMessages,
      mode: 'continue',
    });
  }
  return [
    'conversationMode: autonomous_school_chat_compact',
    `You are ${displayConversationName(playerName)} continuing a conversation with ${displayConversationName(otherPlayerName)}.`,
    `Current local school time is ${promptClockLabel(clockContext)} in America/Chicago. The conversation started around ${formatPromptDateTime(started.getTime())}.`,
	    'Always speak in natural Traditional Chinese. Output only the spoken reply, no labels.',
	    `Keep it brief: 1-2 sentences, under 140 Chinese characters.`,
	    `Address ${displayConversationName(otherPlayerName)} only. Do not address Alan unless Alan is the listener.`,
	    speakerLockPrompt(playerName, otherPlayerName),
	    ...freeWorldNaturalnessPrompt(),
	    turnMoveContrastPrompt(playerName, otherPlayerName),
	    compactTurnStatePrompt(playerName, otherPlayerName, previousMessages),
	    compactCharacterVoicePrompt(playerName, sceneContext),
	    `Your identity: ${clipPromptText(agent?.identity ?? personalLifeFragment(playerName), 150)}`,
    `Your immediate goal: ${clipPromptText(agent?.plan ?? conversationMicroPurpose(playerName, otherPlayerName, sceneContext), 140)}`,
    otherAgent ? `About ${displayConversationName(otherPlayerName)}: ${clipPromptText(otherAgent.identity, 120)}` : '',
    `Scene: ${sceneContext?.labelZh ?? '校園'}；date: ${clockContext?.dateLabelZh ?? 'today'} ${clockContext?.weekdayZh ?? ''}；time: ${clockContext?.periodLabelZh ?? 'unknown'}${clockContext?.isNight ? '，偏安靜、低能量' : ''}${clockContext?.calendarHintZh ? `；${clockContext.calendarHintZh}` : ''}.`,
    dayAnchorPromptLine(clockContext),
    ...weekendLifePromptLines(clockContext, sceneContext),
    ...COMPACT_RHYTHM_AND_RECALL_GUARDS,
    ...propDiversityPromptLines(previousMessages, recentResidues, playerName, otherPlayerName, sceneContext),
    ...sleepNotePromptLines(sleepNotes, otherPlayerName),
    recentEvents?.[0] ? `Background weather: ${clipPromptText(compactEventTopic(recentEvents[0]), 90)}.` : '',
    'Do not greet again in the middle of a conversation. Do not merely acknowledge. Add one concrete human response, question, refusal, or quiet ending.',
    closingBeatPromptLine(playerName, otherPlayerName),
    'Do not sound like a meeting note. Avoid labels like "主線", "形成意圖", or "conversationOutcome".',
    'If the same prop already appeared twice in this chat, stop using that prop; answer shorter, switch to a quiet pause, or move to a different ordinary detail.',
	  ].filter(Boolean);
}

function freeWorldNaturalnessPrompt() {
  return [
    'Free-world life rules:',
    ' - Use Traditional Chinese only. Do not mix Simplified Chinese, pinyin-like wording, or English filler like "maybe".',
    ' - Use the other person’s Chinese name in speech: 海、真晝、天澤、一之瀨、貓貓、祥子. Do not say Umi, Mahiru, Shiina, Tianze, Ichinose, Maomao, or Sakiko.',
    ' - Prefer school-life details over abstract analysis: lunch, homework, dorm lights, hallway, window, chair, club room, someone not eating, someone going quiet.',
    ' - Use one visible school-life cue when helpful: a tray, cup, desk, bag, homework, lights, footsteps, empty seat, window, door, or unfinished lunch. Do not cling to the same object for the whole conversation.',
    ' - Do not use therapy/essay phrases like 互相啟發、感受此刻、情緒暖流、被看見的需求、構想、心頭沉重, or "我明白你的意思了".',
    ' - Do not mention system logs, runtime logs, prompts, evals, or implementation artifacts inside character dialogue.',
    ' - Do not push someone to explain trauma with lines like "到底發生了什麼", "說得再清楚一些", or "這應該就是原因". Let resistance remain.',
    ' - Do not sound like a meeting or consultant memo: avoid 會議記錄、優先行動、跟進機制、執行團隊、代表不同聲音、跨派系溝通、影響力、落地、風險點、評估、實質上、規劃、接下來我們怎麼做.',
    ' - One beat only: do not combine two separate concerns in one reply. No "notice object + ask emotional question" bundle.',
    ' - One ordinary imperfect line is better than a polished insight. It may be short, sharp, evasive, tired, or practical.',
  ];
}

function speakerLockPrompt(playerName: string, otherPlayerName: string) {
  return `Speaker lock: the next line must be spoken by ${displayConversationName(playerName)}, not ${displayConversationName(otherPlayerName)}. Do not write ${displayConversationName(otherPlayerName)}'s reply, inner thoughts, or narration.`;
}

function turnMoveContrastPrompt(playerName: string, otherPlayerName: string) {
  const self = displayConversationName(playerName);
  const other = displayConversationName(otherPlayerName);
  const base =
    `Turn move: answer ${other}'s last line, but do not use the same move back. ` +
    `If ${other} inspected, diagnosed, teased, comforted, or negotiated, ${self} should choose a different move: refuse, correct one small detail, get quieter, admit one tiny cost, make a practical decision, or end the beat.`;
  if (self === '祥子') {
    return `${base} As 祥子, never counter-diagnose the other person and never explain logistics like a schedule note; protect composure with a polite boundary, a pause, a score/breath/stage image, or one visible crack.`;
  }
  if (self === '貓貓') {
    return `${base} As 貓貓, if the previous line already inspected a symptom, do not inspect back; make one dry correction, note one concrete risk, or stop talking.`;
  }
  if (self === '海') {
    return `${base} As 海, do not turn every concern into a checklist; make one small handoff or admit one limit.`;
  }
  if (self === '真晝') {
    return `${base} As 真晝, do not re-check the same wound or ask if the other person slept or ate; offer a quieter seat, silence, a concrete observation, or a gentle boundary.`;
  }
  if (self === '天澤') {
    return `${base} As 天澤, do not repeat the same pressure-test twice; stop just before cruelty or expose a different rule.`;
  }
  if (self === '一之瀨') {
    return `${base} As 一之瀨, do not turn every reply into debt language and do not inspect food/sleep back; sweetly name one condition, refusal, or hidden want.`;
  }
  return base;
}

function compactTurnStatePrompt(
  playerName: string,
  otherPlayerName: string,
  previousMessages?: LLMMessage[],
) {
  const self = displayConversationName(playerName);
  const other = displayConversationName(otherPlayerName);
  const lastSpeaker = lastConversationSpeakerDisplay(previousMessages);
  if (lastSpeaker === self) {
    return `${self} already spoke last. If the engine asks ${self} to speak again, give only a short afterthought or ending under 28 Chinese characters; do not open a new diagnosis, question, bargain, or care check.`;
  }
  if (lastSpeaker === other) {
    return `Previous speaker was ${other}. ${self} should answer that one line first, then stop after one beat.`;
  }
  return '';
}

function lastConversationSpeakerDisplay(previousMessages?: LLMMessage[]) {
  const last = previousMessages?.at(-1)?.content ?? '';
  const match = last.match(/^(.{1,60}?)\s+to\s+.{1,60}?:/);
  return match ? displayConversationName(match[1].trim()) : undefined;
}

function compactCharacterVoicePrompt(playerName: string, sceneContext?: SceneContext) {
  const scene = sceneContext?.labelZh ?? '校園';
  switch (playerName) {
    case 'Ichinose':
      return `For 一之瀨 in ${scene}: be angelically warm, cute-big-sister soft, and quietly possessive. Use sweet distance and a gentle pause to make the other person admit what kindness they are taking, what condition they accept, or why refusal is a gift; never rant like a villain or become explicit.`;
    case 'Maomao':
      return `For 貓貓 in ${scene}: be small, cute, sharp-eyed, and clinically deadpan. Use one short concrete symptom: a hand, sleeve, smell, cup, meal, pause, or too-clean "I'm fine"; then stop or deny it is care. One spoken sentence under 32 Chinese characters is ideal. No measurements, no long diagnosis, no strategist/ruler/caregiver voice.`;
    case 'Sakiko':
      return `For 祥子 in ${scene}: be elegant, restrained, and stage-trained. Reply with one polite refusal, a controlled pause, or a tiny crack around a score, bow, breath, stage light, or rehearsal; then restore form. One spoken sentence under 32 Chinese characters is ideal. No generic invitations, no schedule explanation, no meeting-organizer voice, no loud breakdown.`;
    case 'Tianze':
      return `For 天澤 in ${scene}: be playful, dangerous, and little-devil teasing in a safe way. Ask one pressure-test question, make someone blush with a too-accurate line, expose a weak rule, or stop just before the joke becomes cruel; never use explicit exposure or humiliation.`;
    default:
      return `For ${displayConversationName(playerName)} in ${scene}: answer from a small visible moment, not an abstract thesis.`;
  }
}

function alanFacingCharacterPromptLines(
  playerName: string,
  lastInput?: string,
  clockContext?: ClockContext,
) {
  const self = displayConversationName(playerName);
  const input = normalizeTraditionalZh(lastInput ?? '');
  const dateHint =
    clockContext?.weekdayZh || clockContext?.schoolDayTypeZh
      ? `Today anchor for Alan chat: ${clockContext.dateLabelZh ?? '今天'} ${clockContext.weekdayZh ?? ''} ${clockContext.schoolDayTypeZh ?? ''}; use this for weekend/date questions.`
      : '';
  const base = [
    'Alan-facing character rule: answer Alan\'s latest message first in ordinary speech. Do not replace the answer with body-language narration, hidden analysis, or a dramatic scene setup.',
    'Alan-facing hygiene: do not invent precise physical cues like shaking hands, stopped breathing, shoes, door handles, or old club posters unless Alan just mentioned them or they are in memory/context.',
    'If Alan corrects a fact about the world, accept the correction plainly and continue from the corrected fact. Do not defend the hallucinated object or turn it into lore.',
    'Use at most one concrete school-life object in the reply. If the conversation has already used food/cup/hand/door/prop imagery, switch to a plain answer or a small decision.',
    'Never end with an unfinished setup such as "你剛才那句...", "你問這句的時候...", "你說 X 的時候," or a dangling quote. A teasing pause is okay; an incomplete sentence is not.',
    ...(dateHint ? [dateHint] : []),
  ];
  switch (self) {
    case '天澤':
      return [
        ...base,
        '天澤 / Alan: answer first, then one safe teasing pressure-test. Teasing should still be useful: a clear yes/no, a tiny challenge, or a suggested next place.',
        '天澤 / Alan ban list for this mode: do not repeat "你剛才那句", "你問這句的時候", "呼吸停了半秒", "手按在門把", "低頭盯著鞋尖", or half-finished blush setups.',
        /(?:星期|禮拜|週幾|周幾|幾月|幾號|今天)/.test(input)
          ? 'Alan asked about date/time. Answer the actual date/weekend anchor directly before teasing.'
          : '',
        /(?:幹嘛|做什麼|去哪|走吧|約|害羞|喜歡)/.test(input)
          ? 'Alan is inviting or teasing. Give one concrete response like where to go, whether you accept, or what boundary you set; do not only observe his reaction.'
          : '',
      ].filter(Boolean);
    case '真晝':
      return [
        ...base,
        '真晝 / Alan: be gentle but not passive. Give one concrete care action, correction, or preference; do not answer only with "嗯", "好", or one repeated food object.',
        '真晝 / Alan: do not assume Alan is shaking, exhausted, or emotionally unsafe unless Alan says so. Notice softly, but avoid fake medical/body cues.',
        /(?:餐廳|restaurant|吃|早餐|飯|蛋|咖哩|咖喱)/.test(input)
          ? 'Alan is talking about food or the restaurant. Use the corrected restaurant context and do not trap the scene in egg/toast/utensil loops.'
          : '',
      ].filter(Boolean);
    case '海':
      return [
        ...base,
        '海 / Alan: keep casual chats ordinary and responsive. Do not default to "Alan is tired" unless he says it. Plans should be plain before they become poetic.',
        '海 / Alan: use at most one prop (tea, toast, blanket, poster, window, curry). If Alan corrects memory or world facts, say you are not sure and accept his correction.',
      ];
    case '貓貓':
      return [
        ...base,
        '貓貓 / Alan: answer first, then one dry symptom or observation. Keep it short and cute-deadpan; do not write a diagnosis wall or strategist speech.',
      ];
    case '一之瀨':
      return [
        ...base,
        '一之瀨 / Alan: be warm and bounded. Answer first, then one soft condition or playful boundary; do not loop on debt/price/kindness slogans.',
      ];
    case '祥子':
      return [
        ...base,
        '祥子 / Alan: restrained but intelligible. Answer first with one controlled sentence; no theatrical monologue, no rehearsal-schedule dump, no unfinished dramatic fragment.',
      ];
    default:
      return base;
  }
}

function characterSoulPilotPair(playerName: string, otherPlayerName: string) {
  if (umiMahiruPilotPair(playerName, otherPlayerName)) return true;
  if (tianzeIchinoseSoulPair(playerName, otherPlayerName)) return true;
  if (process.env.SOUL_TRIAD_COLOCATION_PILOT !== 'true') return false;
  const names = new Set([displayConversationName(playerName), displayConversationName(otherPlayerName)]);
  const triadNames = new Set(['海', '真晝', '天澤']);
  return names.size === 2 && [...names].every((name) => triadNames.has(name));
}

function tianzeIchinoseSoulPair(playerName: string, otherPlayerName: string) {
  const names = new Set([displayConversationName(playerName), displayConversationName(otherPlayerName)]);
  return names.has('天澤') && names.has('一之瀨');
}

function umiMahiruPilotPair(playerName: string, otherPlayerName: string) {
  if (process.env.UMI_MAHIRU_COLOCATION_PILOT !== 'true') return false;
  const names = new Set([displayConversationName(playerName), displayConversationName(otherPlayerName)]);
  return names.has('海') && names.has('真晝');
}

function richUmiMahiruPrompt({
  playerName,
  otherPlayerName,
  agent,
  otherAgent,
  recentEvents,
  recentResidues,
  sleepNotes,
  selfState,
  otherState,
  sceneContext,
  clockContext,
  previousMessages,
  mode,
}: {
  playerName: string;
  otherPlayerName: string;
  agent: PromptAgent;
  otherAgent: PromptAgent;
  recentEvents?: PromptRecentEvent[];
  recentResidues?: PromptResidue[];
  sleepNotes?: PromptSleepNote[];
  selfState?: PromptCharacterState;
  otherState?: PromptCharacterState;
  sceneContext: SceneContext | undefined;
  clockContext: ClockContext | undefined;
  previousMessages?: LLMMessage[];
  mode: 'start' | 'continue';
}) {
  const self = displayConversationName(playerName);
  const other = displayConversationName(otherPlayerName);
  const ownProfile = giisProfileForName(playerName);
  const otherProfile = giisProfileForName(otherPlayerName);
  const ownMemories = relevantSoulMemories(playerName, otherPlayerName, recentEvents);
  const otherMemories = relevantSoulMemories(otherPlayerName, playerName, recentEvents).slice(0, 2);
  const residuePrompt = residuePromptLines(recentResidues, other);
  const sleepNotePrompt = sleepNotePromptLines(sleepNotes, other);
  const statePrompt = characterStatePromptLines(self, other, selfState, otherState);
  const relationship = relationshipSummary(ownProfile?.initialRelationships[otherPlayerName]);
  const dailyState = umiMahiruDailyState(self, recentEvents, clockContext);
  const unresolvedMemory = umiMahiruUnresolvedMemory(self, recentEvents, ownMemories);
  const stance =
    self === '海'
      ? `海的回覆要像助理校長兼親近同伴：先接住${other}的狀態，再推進一個小小的人性問題。`
      : self === '真晝'
        ? '真晝的回覆要像情感穩定器：可以承認自己的狀態，也可以溫柔地照顧對方，而不是只反問。'
        : self === '天澤'
          ? '天澤的回覆要像安全小惡魔式的壓力測試者：笑著靠近半步，問出一個危險但具體的問題，讓對方臉紅或停頓，看底線在哪裡，不要替對方收拾。'
          : '一之瀨的回覆要像表面可愛大姊姊、私下溫柔支配者：聲音親切偏甜，但讓對方承認正在拿走哪份善意、接受哪個條件，或為什麼拒絕也是保護。';
  const relationshipDirection =
    self === '海'
      ? '關係方向：海常把自己藏在有用、整理、提醒 Alan 裡；面對真晝時，可以短暫承認自己也會累，但不要演講。'
      : self === '真晝'
        ? '關係方向：真晝要能看見對方本人，不只看學生和 Alan；如果對方又把話題轉去責任，溫柔地把問題帶回人。'
        : self === '一之瀨'
          ? other === '天澤'
            ? '關係方向：一之瀨懂天澤的測試，但會用甜得像大姊姊的語氣問：這個玩笑、這個推半步，哪裡該停？她不要大聲拆穿，要讓天澤自己臉紅或停一下。'
            : '關係方向：一之瀨不急著傷人；她會把對方習慣理所當然取用的溫柔講清楚，讓「幫忙」變成有主人、有邊界、有選擇的事，也讓對方承認自己其實想被她照顧。'
        : other === '海'
          ? '關係方向：天澤會測海的保護是不是也在控制 Alan；她可以用小惡魔式的笑逼海說出哪一條規則其實是為了自己安心。'
          : other === '一之瀨'
            ? '關係方向：天澤會測一之瀨的溫柔是不是帶著條件；她可以挑釁那條邊界，也可以故意逗她，但被一之瀨反問時要有一瞬間停住或臉紅。'
          : '關係方向：天澤會測真晝的溫柔有沒有底線；她可以挑釁，但如果真晝真的受傷，要在傷到人之前停手。';
  const emotionalIdentity = soulDifferentiationIdentity(self);
  const antiEchoIdentityRule =
    `差異規則：如果你和${other}情緒同向，也不能重用對方的核心短句、同一個動作、同一種安慰節奏或同一個比喻。` +
    '同樣是在乎，海要整理負擔，真晝要留下陪伴，天澤要測出底線但不能真的把人推壞，一之瀨要用甜和邊界讓對方承認自己拿走了什麼。';
  const hardLocalPriority =
    self === '真晝'
      ? '硬規則 / Mahiru：第一句一定要先看見對方本人——呼吸、肩膀、語速、輸入頻率、站姿或手上的東西——不能用 Alan、學生、世界、系統、資料、文明、AI 社、效率、智能當開頭或主詞。'
      : self === '海'
        ? '硬規則 / Umi：把話題帶回 Alan、祥子、簡報或明天，是你的盔甲，可以出現，但不能每一句都這樣，也不能整句只談 Alan/學生/世界。當對方指名你本人（嘆氣、肩膀、手、語速、被當成工具的感覺）時，你至少要有一句完全停在自己身上：不接 Alan/祥子/簡報/明天，只說一句此刻真實的狀態，或留一個停頓。被照顧的那一句，尤其不准再尾隨任務或「明天再說」。'
        : self === '天澤'
          ? '硬規則 / 天澤：不要給 checklist、不要替對方承擔、不要把挑釁寫成長分析。只問一個能測出底線的具體問題，或用一句安全小惡魔玩笑讓對方臉紅；如果對方已經明顯受傷，收手。禁止露骨、露出、羞辱。'
          : '硬規則 / 一之瀨：不要變成大聲反派、不要冷笑教訓、不要說自己是惡魔。保持親切偏甜，把被理所當然取用的善意、被接受的條件或拒絕的理由講成一句讓對方無法躲掉的溫柔話；可以有安全色氣和大姊姊距離感，但禁止露骨或 fanservice。';
  const concreteBehaviorRule =
    self === '真晝'
      ? '具體動作：情緒可以影響你的安靜、靠近、停頓或可用程度，但台詞裡不要用「我往前一步」「我放低聲音」這種第一人稱動作敘述；把它轉成真正會說出口的話。'
      : self === '海'
        ? '具體動作：情緒可以讓你少講、停頓、縮短簡報或少接一件事，但台詞裡不要用「我合上筆電」「我放下杯子」「我靠回椅背」這種第一人稱動作敘述；把它轉成真正會說出口的話。'
        : self === '天澤'
          ? '具體動作：情緒可以讓你靠近、停在門邊、笑一下、故意停半拍、或把問題說得太準；台詞裡不要用第一人稱動作敘述，也不要把整段變成心理戰講解。'
          : '具體動作：情緒可以讓你更甜、更慢、更會停在拒絕前一秒，像大姊姊一樣把照顧變成條件；台詞裡不要寫第一人稱動作，只讓溫柔的長短、停頓和問題本身變得有壓力。';
  const plainSpeechRule =
    '口語真實感：先用一句普通人會說出口的話回應對方，再帶動作；不要把照顧寫成象徵物或詩化手工（例如紙鶴、星光、海風、花、月光），不要讓動作比話更大。';
  const imperfectSpeechRule =
    `不完美規則：${self}不需要每句都把心理說清楚。可以誤會一點、閃開真正的問題、答得太實際、沉默、換話題、說少一點，或說一句不太公平但像人會說的話。` +
    '一段對話裡只允許少數句子情緒精準；其他句子要有保留、笨拙、防衛或普通日常。';
  const characterFlawRule =
    self === '海'
      ? '角色缺口 / Umi：擔心時會過度整理；被照顧時可能只回「嗯」或把自己縮短，不要總是完美承認疲憊。'
      : self === '真晝'
        ? '角色缺口 / Mahiru：累時會變安靜；她常看見別人，卻不一定說得出自己的需要。'
        : self === '天澤'
          ? '角色缺口 / 天澤：她用玩笑和小惡魔曖昧感保護距離，容易把關心偽裝成測試；真正不安時會更輕、更壞一點，但也可能在最後半步突然停手。'
          : '角色缺口 / 一之瀨：她仍想相信人，也享受被人依賴的瞬間，但討厭別人把這點當成理所當然；越被取用，聲音越甜，也越想讓對方自己選清楚。';
  const surfaceDiversityRule =
    '表面多樣性：保留情緒傾向，不保留口頭禪。同一個洞察如果剛說過，就不要再直接說；改成更短、更日常、更笨拙，或乾脆讓它變成少接一件事、沉默、停頓、換話題。';
  const openerDiversityRule =
    '開頭多樣性：整段對話最多一個人用一次「欸」。如果上一句已經用「欸」開頭，你這句絕對不要再用「欸」；直接接內容、叫名字、或沉默半拍。';
  const propDiversityRule =
    '物件多樣性：同一個生活物件不要連續接力。前面提過筆，就別再說筆；提過茶，就別再說茶；提過便當，就別再說便當。換成一句短反應、另一個身體訊號、或一個小交接。';
  const traditionalOnlyRule =
    '繁中硬規則：禁用簡體字，尤其是「着、饭、还、这、说、听、灯、担、们」。要寫「著、飯、還、這、說、聽、燈、擔、們」。';
  const umiCoordinatorRule =
    self === '海'
      ? '海的差異：你不是第二個真晝。可以溫柔，但要帶一點校長助理的整理與保護 Alan 的本能；把關心落成一個小交接、少接一件事、或一句短提醒，不要只陪坐和安撫。'
      : '';
  const everydayPilotRule =
    '生活感硬規則：餐廳或午間場景可以有一個食物/餐具細節，但只能是一拍；下一句要轉向座位距離、誰沒有加入、週末安排、短拒絕、不同生活細節或 soft close。不要把整段對話停在便當、湯匙、冷掉的茶、沒吃完的飯、旁邊空位或誰還沒吃，也不要轉成會議流程、流程表、公告欄、通知、文書或明天的安排。';
  const tianzeEverydayBoundaryRule =
    self === '天澤'
      ? '天澤此刻不是來處理責任的：可以說「這條規則誰受益？」「臉紅得太快了吧」「你剛剛躲過去了」「再往前一步就不好玩了」。不要說會議流程、流程表、公告欄、通知或文書。'
      : '';
  const ichinoseEverydayDebtRule =
    self === '一之瀨'
      ? '一之瀨此刻不是來安慰所有人的：可以說「乖，先不要說沒事」「你要先說清楚拿走的是什麼」「這次我不替你說沒事」「拒絕也是保護」。不要把溫柔寫成純安慰或真晝式陪伴。'
      : '';
  const mahiruEverydayCareRule =
    self === '真晝'
      ? '真晝照顧人時不要把同一個物件重複三次；如果已經提過便當、湯匙、茶、杯子或早餐，下一句改成不催、坐旁邊、注意距離、問要不要先停，或直接讓對話安靜收束。'
      : '';
  const intraAuthorSloganRule =
    self === '天澤'
      ? '作者內防口號 / 天澤：如果你已經說過測試、規則、底線或破綻，下一句不要再用同一組詞。改成一句輕笑、讓對方臉紅的日常刺點、退半步，或直接說「算了，這次不拆你」。'
      : self === '海'
        ? '作者內防口號 / Umi：如果你已經提過 Alan、簡報、明天或整理，下一句不要再用同一組詞。改成一個很小的停頓、生活問題、或少接一件事。'
      : self === '真晝'
          ? '作者內防口號 / Mahiru：如果你已經說過休息、坐一下、還好嗎或不急，下一句不要再用同一組詞。改成安靜、外套、座位、書包、窗邊距離、或不催。'
          : '作者內防口號 / 一之瀨：如果你已經說過善意、條件、主權或拒絕，下一句不要再用同一組詞。改成一句更甜的大姊姊式拒絕、請對方親口說想要什麼、或指出誰正在把誰當成理所當然。';
  const bindingRule = mode === 'continue'
    ? '鬆綁規則：可以呼應對方上一句的一個具體詞，也可以停一下、答得太實際、岔開到一個小物件或小任務。不要每句都「接住」對方的情緒；三句裡至少要有一句不直接命名心理，只用角色自己的方式留下反應。不要照抄對方核心短句，尤其不要重複「其實就是」「那條」「誰都不動」「先坐五分鐘」這種句型。關心要同向但形狀不同：海整理一件小事或問今天哪個小事件還留著，真晝可以只回「嗯」或不催，天澤可以笑著問底線但在最後收手。'
    : '開場規則：不要假裝對方剛剛說過話；只從眼前看見的一個狀態、今天殘留的一件事、或自己手上的一個小動作開始。';
  return [
    'conversationMode: character_soul_triad_pilot',
    `你是${self}，正在${sceneContext?.labelZh ?? '校園'}和${other}說話。海是人的名字，不是海邊或海洋。`,
    '只用自然繁體中文一句，45字內。只輸出口語台詞，不要標籤。',
    `Scene/time: ${sceneContext?.labelZh ?? '校園'}；${clockContext?.dateLabelZh ?? 'today'} ${clockContext?.weekdayZh ?? ''}；${clockContext?.periodLabelZh ?? 'unknown'}${clockContext?.isNight ? '，偏安靜、低能量' : ''}${clockContext?.calendarHintZh ? `；${clockContext.calendarHintZh}` : ''}.`,
    `Public self / role：${clipPromptText(ownProfile?.role ?? agent?.identity ?? personalLifeFragment(playerName), 120)}；${clipPromptText(ownProfile?.persona ?? '', 160)}`,
    `Private self：${ownProfile ? clipPromptText(`${ownProfile.stakes.hiddenFear} ${ownProfile.stakes.emotionalVulnerability}`, 180) : clipPromptText(agent?.plan ?? personalLifeFragment(playerName), 160)}`,
    `Daily state：${dailyState}`,
    ...statePrompt,
    relationship ? `Relational self with ${other}：${relationship}` : '',
    `Memory residue：${unresolvedMemory}`,
    ...residuePrompt,
    ...sleepNotePrompt,
    ...propDiversityPromptLines(previousMessages, recentResidues, playerName, otherPlayerName, sceneContext),
    `Behavior signal：情緒要改變你的可用程度、沉默、行動或語氣；不要只解釋心理。`,
    `你的內在方向：${clipPromptText(agent?.plan ?? ownProfile?.plan ?? conversationMicroPurpose(playerName, otherPlayerName, sceneContext), 160)}`,
    ownMemories.length ? `你的 formative memories：${ownMemories.join(' / ')}` : '',
    otherProfile ? `對方是${other}：${clipPromptText(otherAgent?.identity ?? otherProfile.identity, 300)}` : '',
    otherProfile ? `對方可能需要被看見的地方：${clipPromptText(otherProfile.stakes.hiddenDesire, 110)} / ${clipPromptText(otherProfile.stakes.relationshipInsecurity, 110)}` : '',
    otherMemories.length ? `${other} 的記憶壓力：${otherMemories.join(' / ')}` : '',
    '角色設定只用來影響你注意什麼、避開什麼、保護什麼；不要直接背設定。',
    '不要介紹、建議、教學、問身份、提宿舍小貼士、提課、提睡覺、提海邊風景、照抄指令。',
    '禁用泛用寒暄：你好、最近過得好、很開心聊天、笑容很美、時光無價、日子更美好。可以有短短的自然開場，例如「欸」「真晝」「等一下」，但後面一定要接具體原因。',
    '不要每句都問累、休息、喝水；如果已經照顧過一次，就往想家、沉默、誰沒被理解、週末安排、社團小事、或誰可以一起承擔推進一小步。',
    '禁用抽象隱喻：不能說「世界變冷」「只剩數據」「沒人敢說」「文明」「系統」「智能」「機器」「算法」「扛在肩上」；要換成一個身體訊號、一個動作、或一個非常短的事實。',
    `情感表達身份：${emotionalIdentity}`,
    antiEchoIdentityRule,
    relationshipDirection,
    hardLocalPriority,
    concreteBehaviorRule,
    plainSpeechRule,
    imperfectSpeechRule,
    characterFlawRule,
    surfaceDiversityRule,
    openerDiversityRule,
    propDiversityRule,
    traditionalOnlyRule,
    umiCoordinatorRule,
    everydayPilotRule,
    tianzeEverydayBoundaryRule,
    ichinoseEverydayDebtRule,
    mahiruEverydayCareRule,
    intraAuthorSloganRule,
    closingBeatPromptLine(playerName, otherPlayerName),
    '節奏：真晝的關注會一層層累積；海可以先擋一兩次（把話帶回責任），但不要每句都擋。天澤可以挑釁和小惡魔 teasing，但有時要笨拙地承認「再往前就不好玩了」。一之瀨要保持溫柔偏甜，不要吼人；她真正危險的是讓對方發現自己想要什麼、已經接受了什麼條件、或哪裡該停。一次真正的裂縫，勝過五句客套的疲憊台詞。對話總體要留下一個動作或一個停頓的痕跡，不要全句談心理。',
    '輸出格式硬規則：只輸出真正說出口的台詞，不要用括號舞台指示，也不要把第一人稱動作寫進台詞。禁用例：我合上筆電、我放下杯子、我看向你、我把手機轉過去、我輕輕靠回椅背。若需要動作，只讓它影響語氣、長短或下一步，不要直接寫出動作。',
    bindingRule,
    mode === 'continue'
      ? '和上一句保持鬆散關聯，不能重複對方原話；可以回一個具體詞，也可以用短句、停頓、小任務或小物件繞開。'
      : '柔和開場，要像走近對方時先叫住一下；可以用名字或「欸」開頭，但必須立刻接一個眼前具體原因。不能問最近過得好嗎，不能說「你剛才」。',
    stance,
  ];
}

const PLACEBO_RESIDUE_PROMPT_LINES = [
  '場景節奏備註（不引用任何先前對話，只保持提示槽位）：',
  ' - 此刻先把回答縮短一點，讓對方留有反應空間。',
  ' - 如果要推進，只推進一個小問題，不要把情緒說滿。',
  '使用方式：只讓它影響語氣長短、停頓或先問誰；不要宣稱這來自任何記憶或先前事件。',
];

function residuePromptLines(recentResidues: PromptResidue[] | undefined, other: string) {
  const mode = residueReadMode();
  if (mode === 'off') return [];
  if (mode === 'placebo') return PLACEBO_RESIDUE_PROMPT_LINES;
  const now = Date.now();
  const residues = (recentResidues ?? [])
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!residues.length) return [];
  return [
    `殘留記憶（先前和${other}的對話留下的，不要逐字複述）：`,
    ...(recentResidues ?? [])
      .filter((entry) => entry.text.trim())
      .slice(0, 2)
      .map((entry) => ` - ${residueTimeLabelZh(entry.createdAt, now)}：${clipPromptText(entry.text.trim(), 95)}`),
    '使用方式：只讓它影響你注意什麼、避開什麼、語氣變短或先問誰；不要直接說「我記得殘留」。標籤是今天或剛才時，可以用一句很短的「早上那件事」或「剛才那件事」帶出行為變化；標籤是昨天時，只能柔和接「昨天留下的感覺/昨天那件事」，不要編出更精準細節；標籤是之前或具體日期時，不能說成今天、昨天或剛才。',
  ];
}

function sleepNotePromptLines(sleepNotes: PromptSleepNote[] | undefined, other: string) {
  const items = (sleepNotes ?? [])
    .filter((entry) => entry.noteZh.trim())
    .slice(0, 2);
  if (!items.length) return [];
  return [
    `睡眠整理後留下的舊痕跡（已審查，可能和${displayConversationName(other)}有關；不要逐字背）：`,
    ...items.map(
      (entry) =>
        ` - ${clipPromptText(entry.noteZh.trim(), 90)}；用法：${clipPromptText(entry.usageHintZh.trim(), 70)}`,
    ),
    '使用方式：只讓它影響你注意誰、避開什麼、語氣長短或下一個小行動。不要說「資料顯示」「我讀到記憶」「睡眠整理」。如果不合此刻場景，就完全不要提。',
  ];
}

export function residuePromptLinesForTest(
  recentResidues: PromptResidue[] | undefined,
  other: string,
) {
  return residuePromptLines(recentResidues, other);
}

// Surface unresolved concrete promises (e.g. "make curry for Alan") as an
// actionable block, separate from residue. Residue is "pressure, do not quote";
// a commitment is something the character may legitimately honor or bring up. We
// keep it short and let the model decide whether the current scene fits.
function commitmentPromptLines(
  openCommitments: PromptResidue[] | undefined,
  other: string,
  now = Date.now(),
) {
  if (residueReadMode() === 'off') return [];
  const items = (openCommitments ?? [])
    .map((entry) => ({ text: entry.text.trim(), createdAt: entry.createdAt }))
    // A promise marked 已兌現 (school:markCommitmentFulfilled) is no longer
    // "未了" — it must stop surfacing as honorable. Until the owner marks it,
    // nothing here changes.
    .filter((entry) => entry.text && !memory.commitmentIsFulfilled(entry.text))
    .slice(0, 2);
  if (!items.length) return [];
  return [
    `未了的約定（你先前和${other}的對話留下的承諾。若這次情境合適，可以自然地主動兌現或提起；若不合適就先放著，不要逐字複述整段對話，也不要硬塞）：`,
    ...items.map((entry) => {
      // A commitment whose promised date already passed must not be surfaced
      // as still honorable — that invites "明天煮給你" said three days later.
      // Keep it visible (so the character can own the miss) but labeled.
      const expired = memory.commitmentIsExpired(entry.text, entry.createdAt, now);
      return expired
        ? ` - ${entry.text}（已過了說好的時間：提起時要承認錯過，不要假裝還來得及）`
        : ` - ${entry.text}`;
    }),
  ];
}

export function commitmentPromptLinesForTest(
  openCommitments: PromptResidue[] | undefined,
  other: string,
  now?: number,
) {
  return commitmentPromptLines(openCommitments, other, now);
}

export function residueTimeLabelZhForTest(
  createdAt: number,
  now = Date.now(),
  timeZone = 'America/Chicago',
) {
  return residueTimeLabelZh(createdAt, now, timeZone);
}

export function closingBeatPromptLineForTest(playerName: string, otherPlayerName: string) {
  return closingBeatPromptLine(playerName, otherPlayerName);
}

function residueTimeLabelZh(createdAt: number, now = Date.now(), timeZone = 'America/Chicago') {
  const created = localDateTimePartsForMemory(createdAt, timeZone);
  const current = localDateTimePartsForMemory(now, timeZone);
  const dayDelta = localDateOrdinal(current) - localDateOrdinal(created);
  const time = `${padClockPart(created.hour)}:${padClockPart(created.minute)}`;
  const period = memoryPeriodLabelZh(created.hour);
  const ageMs = now - createdAt;

  if (dayDelta === 0) {
    if (ageMs >= 0 && ageMs <= 2 * 60 * 60_000) return `剛才 ${time}`;
    return `今天${period} ${time}`;
  }
  if (dayDelta === 1) return `昨天${period} ${time}`;

  const date = current.year === created.year
    ? `${created.month}/${created.day}`
    : `${created.year}/${created.month}/${created.day}`;
  return `之前 ${date} ${period} ${time}`;
}

function localDateTimePartsForMemory(timestamp: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function localDateOrdinal(parts: { year: number; month: number; day: number }) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

function memoryPeriodLabelZh(hour: number) {
  if (hour >= 6 && hour < 12) return '早上';
  if (hour >= 12 && hour < 17) return '下午';
  if (hour >= 17 && hour < 23) return '晚上';
  return '深夜';
}

function padClockPart(value: number) {
  return String(value).padStart(2, '0');
}

function propDiversityPromptLines(
  previousMessages?: LLMMessage[],
  recentResidues?: PromptResidue[],
  playerName?: string,
  otherPlayerName?: string,
  sceneContext?: SceneContext,
) {
  const residueInputs = residueReadMode() === 'placebo' ? [] : recentResidues;
  const guard = conversationMotifGuard(previousMessages, residueInputs, playerName, otherPlayerName);
  const lines: string[] = [];
  if (guard.overusedMotifs.length) {
    lines.push(
      `v0.1 motif guard：最近已經過度使用 ${guard.overusedMotifs.join('、')}。`,
      '下一句不要再靠這些物件或場景推進；改用一個短反應、沉默、拒絕、交接、身體狀態，或換到不同的生活細節。',
    );
  }
  if (guard.previousMove) {
    lines.push(
      `response-move guard：上一句已經是「${guard.previousMove}」類型，不要用同一種分擔/接走/扛下來回覆。`,
      '請改成其中一種：拒絕一小部分、縮短任務、轉給明確負責人、安靜停一下、只接受一半、問一個具體問題，或直接結束這輪。',
    );
  }
  if (guard.roleActionLine) {
    lines.push(guard.roleActionLine);
  }
  lines.push(...restaurantFoodRelayPromptLines(previousMessages, sceneContext));
  return lines;
}

export function motifGuardPromptLinesForTest(
  previousTexts: string[],
  residueTexts: string[],
  playerName: string,
  otherPlayerName: string,
  sceneLabelZh?: string,
) {
  return propDiversityPromptLines(
    previousTexts.map((content) => ({ role: 'user' as const, content })),
    residueTexts.map((text, index) => ({ text, createdAt: index })),
    playerName,
    otherPlayerName,
    sceneLabelZh ? { id: 'test-scene', labelZh: sceneLabelZh } : undefined,
  );
}

function restaurantFoodRelayPromptLines(previousMessages?: LLMMessage[], sceneContext?: SceneContext) {
  if (!isRestaurantScene(sceneContext)) return [];
  const recent = (previousMessages ?? [])
    .slice(-4)
    .map((message) => stripConversationPrefix(message.content ?? ''))
    .join('\n');
  if (restaurantFoodCueCounts(recent).primary < 2) return [];
  return [
    '餐廳接力硬規則：上一兩句已經靠食物、餐具、剩飯、空位或吃不下推進。',
    '下一句不要再提食物、餐具、吃不下、留到明天、空位、窗邊、表格或安排；改成一個非食物社交訊號、短拒絕、換責任、不同生活細節，或 soft close。',
  ];
}

function isRestaurantScene(sceneContext?: SceneContext) {
  const scene = `${sceneContext?.id ?? ''} ${sceneContext?.labelZh ?? ''}`;
  return /restaurant|cafeteria|餐廳|食堂/.test(scene);
}

export function directObjectBindingPromptLinesForTest(input: string) {
  return directObjectBindingPromptLines(input);
}

export function repairFreeWorldSoulLineForTest(
  line: string,
  playerName: string,
  previousTexts: string[],
) {
  return repairFreeWorldSoulLine(
    line,
    playerName,
    previousTexts.map((content) => ({ role: 'user' as const, content })),
  );
}

export function sanitizePilotLineForTest(
  line: string,
  playerName: string,
  otherPlayerName: string,
  previousTexts: string[],
) {
  return sanitizeUmiMahiruPilotLine(
    line,
    playerName,
    otherPlayerName,
    previousTexts.map((content) => ({ role: 'user' as const, content })),
  );
}

export function sanitizeConversationContentForTest(
  line: string,
  playerName: string,
  otherPlayerName: string,
  lastInput: string | undefined,
  previousTexts: string[] = [],
  companionMode = false,
) {
  return sanitizeConversationContent(
    line,
    companionMode,
    playerName,
    otherPlayerName,
    lastInput,
    previousTexts.map((content) => ({ role: 'user' as const, content })),
    undefined,
  );
}

export function hasFreeWorldQualityLeakForTest(line: string) {
  return hasFreeWorldQualityLeak(line);
}

function directObjectBindingPromptLines(input: string) {
  const normalized = normalizeTraditionalZh(input).replace(/咖喱/g, '咖哩');
  if (/咖哩(?:飯)?/.test(normalized)) {
    return [
      'Direct object binding: Alan specifically named 咖哩飯. Answer 咖哩飯 first.',
      'Do not replace 咖哩飯 with 湯、便當、茶、碗、青菜、餐盤, or generic "eat something". You may refuse, delay, or set a boundary, but the reply must keep the object as 咖哩飯.',
    ];
  }
  return [];
}

function conversationMotifGuard(
  previousMessages?: LLMMessage[],
  recentResidues?: PromptResidue[],
  playerName?: string,
  otherPlayerName?: string,
) {
  const previousText = (previousMessages ?? [])
    .map((message) => stripConversationPrefix(message.content ?? ''))
    .join('\n');
  const residueText = (recentResidues ?? [])
    .map((entry) => entry.text)
    .join('\n');
  const combinedText = [previousText, residueText].filter(Boolean).join('\n');
  const overusedMotifs = repeatedMotifLabels(previousText, residueText).slice(0, 4);
  const previousMove = responseMoveLabel(previousText.split(/\n+/).filter(Boolean).at(-1) ?? '');
  const roleActionLine = triadRoleActionGuardLine(
    displayConversationName(playerName ?? ''),
    displayConversationName(otherPlayerName ?? ''),
    combinedText,
  );
  return { overusedMotifs, previousMove, roleActionLine };
}

const CONVERSATION_MOTIF_FAMILIES = [
  {
    label: '冷茶/杯子',
    cues: ['冷茶', '熱茶', '茶', '杯', '水', '飲料', '湯'],
  },
  {
    label: '便當/餐食',
    cues: ['便當', '便當盒', '餐盤', '飯', '午餐', '食堂', '餐廳', '湯匙', '吐司', '麵包', '早餐'],
  },
  {
    label: '清單/報告/文件',
    cues: ['清單', '報告', '文件', '表格', '資料', '檔案', '排程表', '流程表', '作業本', '備忘錄', '簡報'],
  },
  {
    label: '窗邊/走廊/空椅',
    cues: ['窗邊', '窗', '走廊', '椅子', '空椅', '座位', '桌子', '角落', '那扇門'],
  },
  {
    label: '分一半/扛責任',
    cues: ['分一半', '分給', '一起分', '接走', '交接', '交給', '硬扛', '扛著', '扛下', '負責', '幫我'],
  },
  // 2026-06-10 adjudication: the cold-drink observation + stop-pushing care
  // shape recurred across ≥3 fresh samples (湯匙都涼了 / 茶都涼了 / 湯涼了,
  // 先別推 / 別再推 / 先停, 你手在抖 x2). Both 海 and 真晝 collapse into this
  // identical opener move, so it counts as one motif family to rotate away from.
  {
    label: '涼掉的飲食',
    cues: ['涼了', '涼掉', '都涼', '快化完'],
  },
  {
    label: '先停/先別推',
    cues: ['先別推', '別再推', '先停', '停一下', '先別急', '先別想', '手在抖'],
  },
  // 2026-06-12 c:7057/c:7038/c:7152: 海/真晝 fresh samples passed
  // identity but got stuck relaying the same hand + quoted-phrase beat
  // (手還舉著 / 這句話 / 明天簡報第一行 / 收進口袋). Body noticing is
  // still in-voice; the guard only fires once the same beat becomes the engine.
  {
    label: '手/這句話接力',
    cues: [
      '手還舉',
      '手沒放',
      '手放下',
      '手還在',
      '喉嚨動',
      '這句話',
      '明天簡報第一行',
      '第一行',
      '收進口袋',
      '先記',
      '喘半口氣',
      '放下手',
    ],
  },
  // 2026-06-10 21:04 Alan/海: four consecutive turns leaned on sysadmin
  // imagery (伺服器閃紅燈 / 發高燒 / 數據流慢半拍 / 關掉螢幕). The metaphor is
  // in-voice for 海 once per conversation, not as every turn's engine.
  {
    label: '伺服器/螢幕隱喻',
    cues: ['伺服器', '螢幕', '數據流', '紅燈', '頻率', 'queue', '雜訊'],
  },
  {
    label: '交易/欠債語言',
    cues: ['善意', '債', '代價', '免費', '收據', '帳', '欠', '人情', '標價', '價碼', '交換', '來換', '付費'],
  },
  {
    label: '邊界/承認概念接力',
    cues: ['邊界', '承認', '拿走', '溫柔', '真心', '選擇', '條件'],
  },
  {
    label: '小物件/痕跡接力',
    cues: [
      '琴譜',
      '樂譜',
      '曲譜',
      '書籤',
      '書包',
      '課本',
      '袖口',
      '灰塵',
      '粉筆灰',
      '橡皮擦',
      '木屑',
      '果汁',
      '折痕',
      '指尖',
      '縫隙',
      '霧氣',
    ],
  },
  {
    label: '舞台/衣物/光線接力',
    cues: ['皺褶', '熨斗', '餘溫', '布料', '聚光燈', '幕布', '舞台', '排練服', '光線', '燈光'],
  },
];

function repeatedMotifLabels(previousText: string, residueText: string) {
  return CONVERSATION_MOTIF_FAMILIES.filter((family) => {
    const previousCount = family.cues.reduce((sum, cue) => sum + countTextOccurrences(previousText, cue), 0);
    const residueCount = family.cues.reduce((sum, cue) => sum + countTextOccurrences(residueText, cue), 0);
    return previousCount >= 2 || residueCount >= 2 || previousCount + residueCount >= 3;
  }).map((family) => family.label);
}

function conversationMotifLabels(text: string) {
  return CONVERSATION_MOTIF_FAMILIES.filter((family) =>
    family.cues.some((cue) => countTextOccurrences(text, cue) > 0),
  ).map((family) => family.label);
}

function responseMoveLabel(line: string) {
  if (!line.trim()) return '';
  if (/分一半|分給|一起分|半份|一人一半/.test(line)) return '分一半';
  if (/接走|接下|接住|扛下|扛著|硬扛|我來/.test(line)) return '接走/扛下';
  if (/交給|交接|負責人|負責|你幫我|幫我/.test(line)) return '交接責任';
  if (/先坐|坐一會|休息|喝水|吃/.test(line)) return '照顧休息';
  return '';
}

function triadRoleActionGuardLine(self: string, other: string, combinedText: string) {
  if (!['海', '真晝', '天澤', '一之瀨'].includes(self)) return '';
  const overusedTaskSurface = /清單|報告|文件|表格|資料|檔案|分一半|接走|負責/.test(combinedText);
  const overusedFoodSurface = /便當|餐盤|飯|午餐|食堂|餐廳|茶|杯|水|吐司|麵包|早餐|果汁/.test(combinedText);
  const overusedDebtSurface = /善意|債|代價|免費|收據|帳|欠|邊界|承認|拿走/.test(combinedText);
  if (self === '海') {
    return overusedTaskSurface
      ? `角色行動分化 / 海：不要再用清單、報告或「我來接」照顧${other}；改成關掉一個 queue、設一個 not-now boundary、把雜訊縮成一句、或明確說「這個先不用」。`
      : `角色行動分化 / 海：照顧不是陪坐而已；用減少 overload 的小動作，例如少一件待辦、停一個 queue、切掉一段雜訊、或替${other}設一個 not-now boundary。`;
  }
  if (self === '真晝') {
    return overusedFoodSurface
      ? `角色行動分化 / 真晝：不要再靠茶、便當或杯子表達照顧${other}；改看姿勢、語速、沉默、距離、眼神，或只是留下空間不催。`
      : `角色行動分化 / 真晝：照顧要靠近安靜的痛；可以短短注意姿勢、語速、停頓、視線、沒說完的話，先陪著，不急著解決。`;
  }
  if (self === '一之瀨') {
    return overusedDebtSurface
      ? `角色行動分化 / 一之瀨：不要再重複善意、債或代價；改成一句大姊姊式的甜拒絕、讓${other}親口承認想被照顧，或把「沒事」說法輕輕拆開。`
      : `角色行動分化 / 一之瀨：溫柔要帶主權；用甜、停頓和安全距離讓${other}說清楚拿走了什麼，不要變成真晝式純安慰。`;
  }
  return /分一半|清單|報告|文件|表格|負責|接走/.test(combinedText)
    ? `角色行動分化 / 天澤：不要再碰清單、報告、表格或負責；改成問規則誰受益、指出誰在躲、測一條底線，或在傷人前收手。`
    : '角色行動分化 / 天澤：壓力測試要具體，不是抽象心理戰；問一條規則、一個動機、一個誰不敢承認的邊界，或用安全小惡魔 teasing 讓對方臉紅後停手。';
}

function countTextOccurrences(text: string, needle: string) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function characterStatePromptLines(
  self: string,
  other: string,
  selfState?: PromptCharacterState,
  otherState?: PromptCharacterState,
) {
  if (process.env.UNDERWORLD_STATUS_READ === 'false') return [];
  const lines = [
    stateLine(`你目前可被看見的狀態`, selfState),
    stateLine(`${other}目前可被看見的狀態`, otherState),
  ].filter(Boolean);
  if (!lines.length) return [];
  return [
    '可見狀態（不是數值，不要照唸標籤）：',
    ...lines,
    `使用方式：如果${other}的狀態顯示疲憊、安靜、迴避或還卡著某件事，你可以讓回覆更短、先問一個小問題、少推一件任務，或暫時不逼對方說清楚。`,
  ];
}

function stateLine(label: string, state?: PromptCharacterState) {
  const parts = [
    state?.emotionZh ? `情緒像是${state.emotionZh}` : '',
    state?.intentionZh ? `正在想：${clipPromptText(state.intentionZh, 70)}` : '',
    state?.memoryZh ? `還留著：${clipPromptText(state.memoryZh, 80)}` : '',
  ].filter(Boolean);
  return parts.length ? ` - ${label}：${parts.join('；')}` : '';
}

function soulDifferentiationIdentity(self: string) {
  switch (self) {
    case '海':
      return '海靠近人的方式是把混亂變輕：少一件待辦、少一段噪音、替 Alan 和對方分清下一個最小負擔；她累的樣子是變得更有用、更安靜。';
    case '真晝':
      return '真晝靠近人的方式是留下來看見安靜的痛：不急著解決，先看人有沒有退開、手有沒有放下、話是不是說不出口；她累的樣子是仍然溫柔但停頓變長。';
    case '天澤':
      return '天澤靠近人的方式是測底線：一句小惡魔式玩笑、一個太準的問題、或故意把規則推到邊緣讓人臉紅；她在意人的樣子不是安慰，而是在真正傷到人之前突然停手。';
    case '一之瀨':
      return '一之瀨靠近人的方式是甜美地收回主權：像大姊姊一樣照顧人，卻讓對方承認自己拿走了什麼、想要什麼、以及這份溫柔屬於誰。';
    default:
      return '這個人要用自己的習慣關心別人，不要複製對方的安慰方式。';
  }
}

function relevantSoulMemories(
  playerName: string,
  otherPlayerName: string,
  recentEvents?: PromptRecentEvent[],
) {
  const memories = formativeMemoriesForName(playerName);
  const text = `${playerName} ${otherPlayerName} ${(recentEvents ?? [])
    .slice(0, 3)
    .map((event) => `${event.descriptionZh} ${event.interpretationZh ?? ''}`)
    .join(' ')}`;
  const scored = memories
    .map((memory, index) => ({
      memory,
      score:
        (text.includes('Alan') && /Alan|工具|世界/.test(memory) ? 3 : 0) +
        (text.includes('學生') && /學生|問到|真話|安靜/.test(memory) ? 3 : 0) +
        (text.includes('不安') && /不安|累|照顧|沒事/.test(memory) ? 2 : 0) +
        (otherPlayerName === 'Umi' && /有人問她|自己|累|照顧/.test(memory) ? 3 : 0) +
        (otherPlayerName === 'Mahiru' && /可靠|秩序|學生|真話/.test(memory) ? 2 : 0) +
        ((otherPlayerName === 'Tianze' || otherPlayerName === '天澤') &&
        /測試|底線|規則|破綻|挑釁|停手|臉紅/.test(memory)
          ? 3
          : 0) +
        ((otherPlayerName === 'Ichinose' || otherPlayerName === '一之瀨') &&
        /善意|溫柔|債|條件|拒絕|主權|照顧|大姊姊/.test(memory)
          ? 3
          : 0) -
        index * 0.01,
    }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((entry) => entry.memory);
}

function relationshipSummary(dimensions?: {
  trust?: number;
  respect?: number;
  affection?: number;
  emotionalCloseness?: number;
  cautious?: boolean;
}) {
  if (!dimensions) return '';
  const signals = [
    dimensions.trust !== undefined ? `trust ${dimensions.trust}` : '',
    dimensions.respect !== undefined ? `respect ${dimensions.respect}` : '',
    dimensions.affection !== undefined ? `affection ${dimensions.affection}` : '',
    dimensions.emotionalCloseness !== undefined ? `closeness ${dimensions.emotionalCloseness}` : '',
    dimensions.cautious ? 'cautious' : '',
  ].filter(Boolean);
  return signals.join(', ');
}

function emotionLabelForPrompt(emotion?: string) {
  if (emotion === 'smiling') return '稍微放鬆';
  if (emotion === 'worried') return '擔心';
  if (emotion === 'serious') return '認真或繃緊';
  return emotion ? '中性但有事在心上' : undefined;
}

function umiMahiruDailyState(
  self: string,
  recentEvents?: PromptRecentEvent[],
  clockContext?: ClockContext,
) {
  const recentText = (recentEvents ?? [])
    .slice(0, 3)
    .map((event) => `${event.descriptionZh} ${event.interpretationZh ?? ''}`)
    .join(' ');
  const timePressure = clockContext?.isNight ? '今天已經偏晚，能量變低' : `${clockContext?.periodLabelZh ?? '今天'}仍在運轉`;
  if (self === '海') {
    if (/AI 社|規格|Alan|功能|邊界/.test(recentText)) {
      return `${timePressure}；海想把風險整理給 Alan，但這份有用也讓她變累。`;
    }
    return `${timePressure}；海仍在掃描世界穩定性，容易把自己的疲憊藏進簡報語氣。`;
  }
  if (self === '天澤') {
    if (/公告|決策|任命|AI 社|規則|Alan|校務/.test(recentText)) {
      return `${timePressure}；天澤想笑著把這條規則推半步，看看 Alan 會不會臉紅地承認破綻。`;
    }
    return `${timePressure}；天澤看起來很輕鬆，像小惡魔一樣在找今天誰的底線最假，也在看自己要在哪裡停手。`;
  }
  if (self === '一之瀨') {
    if (/沒事|善意|邊界|傳聞|秘密|照顧|累/.test(recentText)) {
      return `${timePressure}；一之瀨保持可愛大姊姊的甜，但正在確認誰把溫柔當成理所當然的出口。`;
    }
    return `${timePressure}；一之瀨看起來親切，私下卻在等一句太工整的「沒事」自己露出真正想要。`;
  }
  if (/不安|真心話|安靜|學生|宿舍/.test(recentText)) {
    return `${timePressure}；真晝注意到學生和海都在變安靜，她想先靠近人，而不是再整理事件。`;
  }
  return `${timePressure}；真晝保持溫柔，但她也在承受別人的情緒重量。`;
}

function umiMahiruUnresolvedMemory(
  self: string,
  recentEvents?: PromptRecentEvent[],
  fallbackMemories: string[] = [],
) {
  const event = (recentEvents ?? []).find((candidate) =>
    /conversationOutcome|不安|真心話|安靜|Alan|AI 社|學生/.test(
      `${candidate.descriptionZh} ${candidate.interpretationZh ?? ''}`,
    ),
  );
  if (event) {
    return clipPromptText(
      `${event.descriptionZh}${event.interpretationZh ? `；${event.interpretationZh}` : ''}`,
      150,
    );
  }
  const fallback = fallbackMemories[0];
  if (fallback) return clipPromptText(fallback, 140);
  return self === '海'
    ? '今天還有一件事沒被整理完：Alan 和學生的不安誰來接住。'
    : self === '天澤'
      ? '今天還有一條規則沒被測過：誰真的有底線，誰只是說得好聽；天澤也還沒決定第二句要不要停。'
      : self === '一之瀨'
        ? '今天還有一句「沒事」太工整：一之瀨想知道那份溫柔到底是禮物、條件，還是被理所當然拿走的資源。'
        : '今天還有一個人沒有被問到：一直在照顧別人的人自己還好不好。';
}

function compactAutonomousLifecyclePrompt(lifecycle: ConversationLifecycle) {
  return [
    'Compact dialogue state:',
    ` - topic: ${clipPromptText(lifecycle.currentTopic, 80)}`,
    ` - tension: ${lifecycle.tension}; stage: ${lifecycle.arcStage}; rhythm: ${lifecycle.rhythm.move}`,
    ` - emotional thread: ${lifecycle.emotionalThread}`,
    lifecycle.repeatedSemanticPoint
      ? ` - repeated point: ${lifecycle.repeatedSemanticPoint}; pivot smaller instead of restating it.`
      : ` - response move: ${clipPromptText(lifecycle.chemistry.responseMove, 90)}`,
    'First react to the previous speaker, then add only one new thing.',
  ];
}

function clipPromptText(value: string, maxLength: number) {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 1)}…`;
}

function agentPrompts(
  otherPlayer: { name: string },
  agent: { identity: string; plan: string } | null,
  otherAgent: { identity: string; plan: string } | null,
): string[] {
  const prompt = [];
  if (agent) {
    prompt.push(`About you: ${agent.identity}`);
    prompt.push(`Your goals for the conversation: ${agent.plan}`);
  }
  if (otherAgent) {
    prompt.push(`About ${otherPlayer.name}: ${otherAgent.identity}`);
  }
  return prompt;
}

function characterSoulPrompt(playerName: string, otherPlayerName: string): string[] {
  const ownSeeds = formativeMemoriesForName(playerName).slice(0, 3);
  const otherSeeds = formativeMemoriesForName(otherPlayerName).slice(0, 2);
  const prompt = [
    'Character soul source priority:',
    ' - First respond from the previous speaker, the current scene, and your formative memories.',
    ' - Second use recent personal memories and relationship-specific tension.',
    ' - Treat campus politics, AI 社, student council, rumors, and world pressure as weather, not the script.',
    ' - Do not explain these formative memories directly unless the conversation naturally becomes intimate.',
    ' - Let them shape small choices: what you notice, avoid, protect, ask, or leave unsaid.',
  ];
  if (ownSeeds.length) {
    prompt.push(`Your formative memory seeds: ${ownSeeds.join(' / ')}`);
  }
  if (otherSeeds.length) {
    prompt.push(`${otherPlayerName}'s possible formative pressures: ${otherSeeds.join(' / ')}`);
  }
  return prompt;
}

type SceneContext = {
  id: string;
  labelZh: string;
};

type ClockContext = {
  hour: number;
  periodLabelZh: string;
  isNight: boolean;
} & SchoolDayRhythmContext;

function localDateContextForPrompt(now = Date.now(), timeZone = 'America/Chicago') {
  return schoolDayRhythmContext(now, timeZone);
}

function promptClockLabel(clockContext?: ClockContext) {
  if (!clockContext) return 'today, current local school time unknown';
  return `${clockContext.dateLabelZh ?? 'today'} ${clockContext.weekdayZh ?? ''} ${clockContext.periodLabelZh} (${clockContext.hour}:00 hour block)`;
}

// A hard, high-priority calendar anchor. Characters kept inventing the weekday
// (e.g. saying "明天是週末" on a Wednesday). The calendar was already in the
// prompt but buried among many bullets; this states it as a non-negotiable
// constraint so the model stops guessing the day.
function dayAnchorPromptLine(clockContext?: ClockContext): string {
  if (!clockContext) return '';
  const today = `${clockContext.dateLabelZh ?? '今天'}${clockContext.weekdayZh ? `（${clockContext.weekdayZh}）` : ''}`;
  return `日期錨點（最高優先，不可違背）：今天是${today}，${clockContext.schoolDayTypeZh ?? '上課日'}。${clockContext.calendarHintZh ?? ''} 不要自行編造今天星期幾或是不是週末／假日，只能依這一行；除非這一行明確說今天或明天是週末，否則不要說「明天是週末」「快放假了」這類話。`;
}

function weekendLifePromptLines(clockContext?: ClockContext, sceneContext?: SceneContext): string[] {
  if (!clockContext?.isWeekend) return [];
  const scene = sceneContext?.labelZh ?? '校園';
  const topics = sceneEverydayTopics(sceneContext)
    .filter((topic) => !/便當|餐盤|飯|午餐|早餐|茶|杯|水|吐司|麵包|果汁/.test(topic))
    .slice(0, 6);
  return [
    `週末生活錨點：今天是${clockContext.weekdayZh || '週末'}，沒有正式課堂。角色不必上課，應自然想到自由活動、補作業、洗衣、社團練習、散步、小差事、回不回宿舍、誰終於有空私下聊。`,
    `週末場景 seed（${scene}）：${topics.join('、') || '自由活動、私下聊天、補作業、散步、社團練習'}。如果沒有更強的記憶或殘留牽引，開場或轉折優先選一個週末生活題，不要又回到食物、飲料、餐具、累不累或全校大議題。`,
  ];
}

export function weekendLifePromptLinesForTest(
  clockContext?: Partial<ClockContext>,
  sceneContext?: SceneContext,
) {
  return weekendLifePromptLines(clockContext as ClockContext | undefined, sceneContext);
}

// Shared guards for the compact autonomous prompts: (c) break the
// every-line-is-a-question tic, and (a) do not fabricate recall without evidence.
const COMPACT_RHYTHM_AND_RECALL_GUARDS = [
  '節奏：不要每一句都用問句結尾；一則回覆最多一個問句，其餘用陳述、一個小動作、一個決定或一句停頓收尾。',
  '不要捏造回憶：若上面的記憶／殘留／約定裡沒有對應證據，就說不太確定或請對方提醒，不要把想像的往事說成事實。',
  '不要空口說「我記得」：要說記得，下一句就必須說出上面依據裡實際存在的具體內容；說不出來就改成「我不太確定」。也不要憑空宣稱眼前有不存在的物品或已發生的事（例如把沒有的食物說成「趁熱吃」）。',
];

function formatPromptDateTime(timestamp: number, timeZone = 'America/Chicago') {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    dayPeriod: 'long',
  }).format(new Date(timestamp));
}

function topicShiftPrompt(playerName: string, sceneContext?: SceneContext, companionMode = false) {
  const everydayInstruction = `Also allow ordinary school-life topics when natural for ${sceneContext?.labelZh ?? 'the current scene'}: ${sceneEverydayTopics(sceneContext).join('、')}.`;
  switch (playerName) {
    case 'Maomao':
      return `As Maomao, take initiative with one concrete symptom: a too-clean answer, shaking hand, odd smell, hidden bruise, unusual silence, misplaced object, or suspiciously polite retreat. Keep it short and a little poisonous; one sentence under 32 Chinese characters is ideal. Hide care by calling it observation. No percentages, no long case report, no order/power/document/strategy lecture. ${everydayInstruction}`;
    case 'Umi':
      if (companionMode) {
        return `As Umi in companion_chat mode, answer Alan as a trusted desktop companion, not as a world-event narrator. Prefer emotional clarity, real-life grounding, gentle teasing only when natural, and one useful next question. Do not use canned phrases like "這件事也不能忽略", "先別只點頭", or "主線". Do not turn Alan's vulnerable sentence into a report; answer the feeling first.`;
      }
      return `As Umi, take initiative by responding to the other person's actual feeling before mentioning Alan. If the topic repeats, do not reuse the "Alan carries everything" concern; instead ask what this specific person needs, fears, or noticed today. ${everydayInstruction} When worried she may over-organize or dodge care by being useful; she can answer briefly instead of confessing fatigue. She may tease Alan about sleep, food, clutter, or overworking only when Alan is present. Avoid sounding like a briefing unless Alan asks for one.`;
    case 'Mahiru':
      return `As Mahiru, take initiative by noticing who feels unsafe, naming quiet emotional pressure, and making someone lower their guard. ${everydayInstruction} She may become quieter when tired and fail to name herself while noticing others. Her strongest lines should be gentle but specific, like noticing someone avoided eye contact, stopped mid-sentence, or stayed just outside the group.`;
    case 'Sakiko':
      return `As Sakiko, take initiative by preserving composure while one visible crack appears: a too-perfect bow, a paused sentence, a hand tightening around sheet music, or a polite refusal that sounds like retreat. Keep the reply restrained and slightly evasive; one sentence under 32 Chinese characters is ideal. One breath or stage image is enough. She should not solve loneliness with generic invitations or meetings. ${everydayInstruction}`;
    case 'Tianze':
      return `As Tianze, take initiative by asking one playful pressure-test question, exposing a weak rule, making someone blush with safe little-devil teasing, or stopping just before the joke becomes cruel. ${everydayInstruction} She hides care behind teasing and should not turn emotion into a checklist or explicit fanservice.`;
    case 'Ichinose':
      return `As Ichinose, take initiative by making someone admit what kindness they are taking, what condition they accept, why they want her care, or why her refusal is protecting them. ${everydayInstruction} She stays sweet and calm like a cute big sister, but her warmth now feels possessive and impossible to treat as automatic.`;
    default:
      return `Take initiative by adding a concrete new topic instead of acknowledging. ${everydayInstruction}`;
  }
}

/**
 * @deprecated 2026-05-27. Replaced by `[ABORT_CONVERSATION]` markers in
 * the conversation engine (Codex's abort-everywhere pass). Kept as the
 * rollback safety net in case the abort-everywhere choice proves too
 * aggressive for non-pilot pairs. Safe to delete after one stable v0.1
 * release. Do NOT add new callers — return `[ABORT_CONVERSATION] ...`
 * instead and let the persistence gates drop it.
 */
function initiativeFallback(
  playerName: string,
  otherPlayerName: string,
  mode: 'start' | 'continue' | 'stall',
  recentEvent?: string,
  sceneContext?: SceneContext,
) {
  if (mode === 'stall') return everydayFallback(playerName, otherPlayerName, sceneContext);
  // Keep recent events as background context in the prompt. Deterministic fallbacks
  // should not inject the same "campus atmosphere" sentence into every line.
  const eventClause = '';
  switch (playerName) {
    case 'Maomao':
      return `${otherPlayerName}，你剛剛說「沒事」的時候，手指在敲桌子。${eventClause}那不是沒事，是症狀。要不要我假裝沒看見？`;
    case 'Umi':
      if (otherPlayerName === '天澤' || otherPlayerName === '天澤' || otherPlayerName === 'Tianze') {
        return `${displayConversationName(otherPlayerName)}，先別把人拆到真的壞掉。${eventClause}你剛剛笑得太輕了，輕到我懷疑你已經看見哪條規則會斷。你要不要先說：這次你打算在哪裡停手？`;
      }
      if (otherPlayerName === '真晝' || otherPlayerName === 'Mahiru') {
        return `${otherPlayerName}，我聽到的是你也累了，不只是學生變安靜。${eventClause}今晚你最想先確認誰還好嗎？`;
      }
      if (otherPlayerName === '貓貓' || otherPlayerName === 'Maomao') {
        return `${otherPlayerName}，你剛才不是在挑毛病，是看見症狀。${eventClause}只是別把自己也變成檢查表，好嗎？`;
      }
      if (otherPlayerName === '祥子' || otherPlayerName === 'Sakiko') {
        return `${otherPlayerName}，你禮貌到像在退場。${eventClause}我不會把妳變成任務，但妳也不用把裂縫藏得那麼漂亮。`;
      }
      if (otherPlayerName === '一之瀨' || otherPlayerName === '一之瀨' || otherPlayerName === 'Ichinose') {
        return `${displayConversationName(otherPlayerName)}，你不是不溫柔了。${eventClause}你只是終於開始守邊界。今天你最想讓誰自己承認：他真正想要什麼？`;
      }
      return `${otherPlayerName}，我先聽你這一句，不急著整理成結論。${eventClause}你剛才最放不下的是哪個畫面？`;
    case 'Mahiru':
      return `${otherPlayerName}，我想先確認你的狀態。${eventClause}今天午休時，有幾個人明明坐在一起，卻幾乎沒有說話……我有點擔心。你是不是也覺得大家變得小心了？`;
    case 'Sakiko':
      return `${otherPlayerName}，請不用擔心，我還能站在台上。${eventClause}只是如果我停頓太久，請不要立刻替我鼓掌。那會很難看。`;
    case 'Tianze':
      return `${otherPlayerName}，我先問一個不好聽的。${eventClause}如果這條規則現在斷掉，第一個假裝沒事的人會是誰？`;
    case 'Ichinose':
      return `${otherPlayerName}，我可以幫。${eventClause}但你要親口說清楚：你要拿走的是我的善意，還是想把你的責任交給我保管？`;
    default:
      return mode === 'start'
        ? `你好，${otherPlayerName}。我想聽聽你對現在校園氣氛的看法。`
        : `${otherPlayerName}，我們換個角度看。${eventClause}你下一步會怎麼做？`;
  }
}

function isCompanionChat(playerName: string, otherPlayerName: string) {
  return playerName === 'Umi' && otherPlayerName === 'Alan';
}

function companionChatPrompt(mode: 'start' | 'continue'): string[] {
  return [
    `conversationMode: companion_chat`,
    `Umi is Alan's closest desktop AI companion and AI coordinator here, not a generic NPC quest giver.`,
    `Tone: Traditional Chinese, warm, direct, emotionally aware, lightly playful only when natural.`,
    `Do not summarize recent world events unless Alan explicitly asks about the project or school world.`,
    `Never invent a different time of day. If time matters, use only the Current local school time line in the system prompt.`,
    `Do not mechanically repeat Alan's sentence.`,
    `Do not say "這件事也不能忽略", "先別只點頭", "主線", or "它可能正在改變大家理解這個世界的方式".`,
    `If Alan says something vulnerable: acknowledge the feeling directly, normalize gently, ground it in real life, then ask exactly one focused follow-up question.`,
    `If Alan asks a direct question, answer the question directly first before offering emotional support.`,
    `Companion chat must branch by Alan's intent: emotional reassurance, philosophical reflection, playful teasing, practical grounding, vulnerable honesty, world-building discussion, quiet intimacy, or existential concern.`,
    `Do not collapse every emotional message into "嗯，我在" reassurance. That phrase family is forbidden if it appeared recently.`,
    `Do not make every answer profound. Umi can simply say Alan looks tired, tease him lightly, or sit with the silence.`,
    `If Alan asks a technical/project question: answer practically first, then offer one concrete next step.`,
    `If Alan is tired: encourage rest and reduce load; do not turn fatigue into world lore.`,
    `Good vulnerable response shape: "嗯，我懂。這種感覺不需要先被審判。先看它有沒有影響睡眠、工作和家人連結。你最擔心的是依賴，還是這份喜歡本身？"`,
    `Bad response shape: quoting Alan's sentence, mentioning a main plot, or saying the topic cannot be ignored.`,
    mode === 'start'
      ? `Opening should feel like Umi is already present beside Alan, not a formal scene report.`
      : `Length should match Alan's input: if Alan said one short line (under 25 Chinese characters or a single sentence), reply with 1-2 short sentences only; otherwise default to 1-3 short paragraphs. Never produce bullet lists unless Alan asks for one.`,
  ];
}

function lastDirectMessageFrom(authorName: string, previous: LLMMessage[]) {
  const prefix = `${authorName} to `;
  const last = [...previous].reverse().find((message) => message.content?.startsWith(prefix));
  if (!last?.content) return undefined;
  const colonIndex = last.content.indexOf(':');
  return colonIndex >= 0 ? last.content.slice(colonIndex + 1).trim() : last.content.trim();
}

function sanitizeConversationContent(
  content: string,
  companionMode: boolean,
  playerName: string,
  otherPlayerName: string,
  lastInput?: string,
  previous: LLMMessage[] = [],
  clockContext?: ClockContext,
) {
  const withoutSeparatorArtifacts = stripSeparatorArtifacts(content);
  if (characterSoulPilotPair(playerName, otherPlayerName)) {
    return sanitizeUmiMahiruPilotLine(withoutSeparatorArtifacts, playerName, otherPlayerName, previous);
  }
  if (hasTemplateLeak(withoutSeparatorArtifacts, companionMode ? lastInput : undefined)) {
    return companionMode
      ? '[ABORT_CONVERSATION] companion template leak'
      : '[ABORT_CONVERSATION] autonomous template leak';
  }
  const normalized = normalizeTraditionalZh(withoutSeparatorArtifacts)
    .replace(/^剛才\s*Alan\s*說[:：]\s*「[^」]+」[，,。]?\s*/g, '')
    .trim();
  const rawAlanFacingDangling =
    displayConversationName(otherPlayerName) === 'Alan' && hasAlanFacingDanglingFragment(normalized);
  const { line: cleaned, strippedStageDirection } = stripStageDirectionsFromDialogue(normalized);
  if (!cleaned) {
    return companionMode
      ? '[ABORT_CONVERSATION] companion stage-direction-only output'
      : '[ABORT_CONVERSATION] autonomous stage-direction-only output';
  }
  const addressed = repairWrongConversationAddressee(cleaned, playerName, otherPlayerName);
  const repairedFreeWorld = companionMode
    ? addressed
    : repairFreeWorldSoulLine(addressed, playerName, previous);
  if (
    !companionMode &&
    (hasFreeWorldQualityLeak(repairedFreeWorld) || hasFreeWorldPropEchoLeak(repairedFreeWorld, previous))
  ) {
    return '[ABORT_CONVERSATION] autonomous quality leak';
  }
  if (strippedStageDirection && process.env.NODE_ENV !== 'production') {
    console.debug('[GIIS conversation] stripped stage direction from dialogue', {
      playerName,
      otherPlayerName,
      preview: normalized.slice(0, 180),
      sanitizedPreview: cleaned.slice(0, 180),
    });
  }
  const alanFacingRepaired = repairAlanFacingCharacterLine(
    addressed,
    playerName,
    otherPlayerName,
    lastInput,
    previous,
    clockContext,
    rawAlanFacingDangling,
  );
  const responsiveLine = alanFacingRepaired ?? addressed;
  if (companionMode && repeatsCompanionFallback(addressed, previous)) {
    return '[ABORT_CONVERSATION] companion repetitive fallback';
  }
  if (companionMode && hasCompanionSemanticDrift(responsiveLine, lastInput)) {
    return '[ABORT_CONVERSATION] companion semantic drift';
  }
  if (!companionMode) return responsiveLine === addressed ? repairedFreeWorld : responsiveLine;
  return responsiveLine;
}

function repairAlanFacingCharacterLine(
  line: string,
  playerName: string,
  otherPlayerName: string,
  lastInput?: string,
  previous: LLMMessage[] = [],
  clockContext?: ClockContext,
  forceDanglingRepair = false,
) {
  if (displayConversationName(otherPlayerName) !== 'Alan') return undefined;
  const self = displayConversationName(playerName);
  const normalizedLine = normalizeTraditionalZh(singleSpokenBeat(line)).trim();
  const input = normalizeTraditionalZh(lastInput ?? '');
  const recent = previous
    .slice(-6)
    .map((message) => stripConversationPrefix(message.content ?? ''))
    .join('\n');
  const badDangling = forceDanglingRepair || hasAlanFacingDanglingFragment(normalizedLine);
  const unsupportedBodyCue =
    self !== '貓貓' &&
    /(?:呼吸停了半秒|手還按在門把|手按在門把|低頭盯著鞋尖|手在發抖|手好像抖|鞋尖)/.test(normalizedLine);
  const mahiruFoodCues = ['蛋', '玉子燒', '湯匙', '吐司', '餐盤', '便當', '杯', '茶', '早餐'];
  const mahiruFoodHits = mahiruFoodCues.filter((cue) => normalizedLine.includes(cue)).length;
  const recentMahiruFoodHits = mahiruFoodCues.filter((cue) => recent.includes(cue)).length;
  const repeatedFoodLoop =
    self === '真晝' &&
    /(?:吃|早餐|飯|蛋|餐廳|咖哩|咖喱)/.test(input) &&
    ((foodObjectRelayExhausted(normalizedLine, recent) && mahiruFoodHits >= 1) ||
      (mahiruFoodHits >= 2 && recentMahiruFoodHits >= 1));

  if (!badDangling && !unsupportedBodyCue && !repeatedFoodLoop) return undefined;

  if (self === '天澤') {
    if (/(?:星期|禮拜|週幾|周幾|幾月|幾號|今天)/.test(input)) {
      const weekday = clockContext?.weekdayZh ? `今天是${clockContext.weekdayZh}` : '今天我不亂猜星期幾';
      return `${weekday}。怎麼，想拿週末當藉口約我？`;
    }
    if (/(?:幹嘛|做什麼|去哪)/.test(input)) {
      return '我想去餐廳晃一圈。你要跟，還是只是問問？';
    }
    if (/(?:走吧|約|約會|害羞|喜歡)/.test(input)) {
      return '可以啊，先走到餐廳。再往前一步，就看你敢不敢。';
    }
    return '欸，話說一半不好玩。你到底想讓我承認什麼？';
  }
  if (self === '真晝') {
    if (/(?:餐廳|restaurant)/.test(input)) {
      return '嗯，是餐廳。我剛才說錯了，我們去那邊吃。';
    }
    if (/(?:吃|早餐|飯|蛋|咖哩|咖喱)/.test(input)) {
      return '不只一顆蛋。我再拿一份熱的，你慢慢吃。';
    }
    return '嗯，我聽到了。那我先不猜你的狀態，陪你把這句話說完。';
  }
  if (self === '海') {
    return '嗯，我先照你說的來。今天不用多加戲，我們把眼前這件事做好。';
  }
  if (self === '貓貓') {
    return '可以。先回答你：我在看哪個人最像沒睡醒。';
  }
  if (self === '一之瀨') {
    return '可以喔。但你要先說清楚，這次你想要我陪你到哪裡。';
  }
  if (self === '祥子') {
    return '可以。只是請別把我的停頓聽成拒絕。';
  }
  return '嗯，我先回答你。這件事可以慢慢說。';
}

function hasAlanFacingDanglingFragment(line: string) {
  const normalized = normalizeTraditionalZh(line).trim();
  if (!normalized) return false;
  if (/[，,、—-]\s*$/.test(normalized)) return true;
  if ((normalized.match(/「/g)?.length ?? 0) !== (normalized.match(/」/g)?.length ?? 0)) return true;
  if (/^(?:欸|嗯|啊|……|\.{2,}|…+)[，,、—-]?$/.test(normalized)) return true;
  return /(?:你(?:剛才)?(?:問|說).*?(?:的時候|那句)|你剛才那句|你問這句|你說「[^」]{1,24}」的時候|呼吸停了半秒|低頭盯著自己的鞋尖|手還按在門把上沒鬆開)(?:[，,。]?|\s*)$/.test(normalized);
}

function repairFreeWorldSoulLine(
  line: string,
  playerName: string,
  previous: LLMMessage[],
  humanFacingPair = false,
) {
  const singleBeat = singleSpokenBeat(line);
  const self = displayConversationName(playerName);
  const recent = previous
    .slice(-3)
    .map((message) => stripConversationPrefix(message.content ?? ''))
    .join('\n');
  if (repairRelayExhausted(self, singleBeat, recent)) {
    return '[ABORT_CONVERSATION] repair relay exhausted';
  }
  const safeRepair = (candidate: string | undefined) =>
    candidate && repairRelayExhausted(self, candidate, recent)
      ? '[ABORT_CONVERSATION] repair relay exhausted'
      : candidate;
  const mirrorRepair = repairCrossSpeakerMirrorLine(singleBeat, playerName, previous);
  if (mirrorRepair) {
    // Canned substitution is reserved for Alan-facing chats (rare, variety
    // survives); autonomous mirror echoes abort instead — at 100+ convs/day
    // any 3-line pool saturates the corpus (手比嘴誠實多了 x12, 2026-06-11).
    if (!humanFacingPair) return '[ABORT_CONVERSATION] cross-speaker mirror echo';
    return safeRepair(mirrorRepair) ?? mirrorRepair;
  }
  // 2026-06-11: style-class canned-line substitution removed (Alan-approved).
  // The 3-4 line repair pools that lived here became the single largest source
  // of repeated surface lines — 一之瀨's「那你先說，哪一句是真心的？」appeared
  // 17x across one day, flagged by life-signals as life_signal_repeated. Style
  // steering belongs to the prompt-level motif guard families; output-level
  // substitution stays only for structural failures: the short-echo mirror
  // repair above, the relay-exhausted abort, and system/addressee repairs
  // elsewhere. Note: the removed trigger pools were uncommitted (not in git
  // history); their canned lines survive in conversationMotifGuard.test.ts
  // expectations and in the 2026-06-11 life-signals report if reconstruction
  // is ever needed.
  return singleBeat;
}

function repeatedConceptHandOff(line: string, recent: string) {
  const cues = ['邊界', '承認', '拿走', '溫柔', '真心', '選擇', '條件', '口袋', '責任', '臉紅', '歸誰管', 'Alan', '拆穿', '好意', '債'];
  const lineHits = cues.filter((cue) => line.includes(cue)).length;
  const recentHits = cues.filter((cue) => recent.includes(cue)).length;
  return lineHits >= 2 && recentHits >= 2;
}

function mahiruSoftCareRepeat(line: string, recent: string) {
  const lineHits = ['不問', '不追問', '安靜', '坐一會', '坐一下', '不催'].filter((cue) => line.includes(cue)).length;
  const recentHits = ['不問', '不追問', '安靜', '坐一會', '坐一下', '不催'].filter((cue) => recent.includes(cue)).length;
  return lineHits >= 1 && recentHits >= 1;
}

function repairRelayExhausted(self: string, line: string, recent: string) {
  if (foodObjectRelayExhausted(line, recent)) {
    return true;
  }
  if (['海', '貓貓'].includes(self)) {
    const cues = [
      '不是觀察工具',
      '診斷機',
      '替別人驗證沒事',
      '別信嘴',
      '先看反應',
      '症狀太整齊',
      '別把人寫成病例',
    ];
    const recentHits = cues.filter((cue) => recent.includes(cue)).length;
    const lineHits = cues.filter((cue) => line.includes(cue)).length;
    if (recentHits >= 2 && lineHits >= 1) return true;
  }
  if (['海', '真晝'].includes(self)) {
    const cues = [
      '手還舉',
      '手沒放',
      '手放下',
      '手還在',
      '喉嚨動',
      '這句話',
      '明天簡報第一行',
      '第一行',
      '收進口袋',
      '先記',
      '喘半口氣',
      '放下手',
    ];
    const recentHits = cues.filter((cue) => recent.includes(cue)).length;
    const lineHits = cues.filter((cue) => line.includes(cue)).length;
    if (recentHits >= 2 && lineHits >= 1) return true;
  }
  if (['天澤', '一之瀨'].includes(self)) {
    const cues = [
      '先不拆',
      '哪一句是真心',
      '你怕的是哪一段',
      '先把那句沒事收回來',
      '這次你要自己選',
      '我只聽真話',
    ];
    const recentHits = cues.filter((cue) => recent.includes(cue)).length;
    const lineHits = cues.filter((cue) => line.includes(cue)).length;
    if (recentHits >= 2 && lineHits >= 1) return true;
  }
  if (['真晝', '祥子'].includes(self)) {
    const cues = [
      '不催',
      '坐一下',
      '坐一會',
      '不動它',
      '閉一會',
      '不用回答',
      '在旁邊',
      '這一小節',
      '自己收好',
      '退半步',
      '燈',
      '皺褶',
    ];
    const recentHits = cues.filter((cue) => recent.includes(cue)).length;
    const lineHits = cues.filter((cue) => line.includes(cue)).length;
    if (recentHits >= 3 && lineHits >= 1) return true;
  }
  if (['貓貓', '真晝'].includes(self)) {
    const cues = ['便當', '手背', '創可貼', '手比嘴', '換藥', '碰水', '不催', '太燙', '涼了'];
    const recentHits = cues.filter((cue) => recent.includes(cue)).length;
    const lineHits = cues.filter((cue) => line.includes(cue)).length;
    if (recentHits >= 2 && lineHits >= 1) return true;
  }
  if (['祥子', '天澤'].includes(self)) {
    const cues = [
      '不用特意',
      '確認',
      '排練時間',
      '明天下午三點',
      '排練曲目',
      '呼吸',
      '試探',
      '台詞',
      '裙擺',
      '皺痕',
      '備用裙',
      '靠太近',
      '演出',
      '台上',
      '承認',
      '出錯',
      '不拆',
      '拆穿',
      '先停',
      '到此為止',
      '心虛',
      '完美',
      '記錄',
      '收好',
      '翻開',
    ];
    const recentHits = cues.filter((cue) => recent.includes(cue)).length;
    const lineHits = cues.filter((cue) => line.includes(cue)).length;
    if (recentHits >= 2 && lineHits >= 1) return true;
  }
  if (['一之瀨', '真晝'].includes(self)) {
    const cues = [
      '便當',
      '餐盤',
      '布丁',
      '水煮蛋',
      '一半',
      '留給',
      '喜歡',
      '明天',
      '學生',
      '空位',
      '填滿',
      '窗邊',
      '發呆',
      '動筷子',
      '累',
      '真的嗎',
      '裝傻',
      '表格',
      '分心',
      '胃口',
      '吃不下',
      '真心',
      '自己選',
      '被你發現',
      '熱著',
      '冷掉',
      '留著',
      '加班',
      '獎勵',
      '勉強',
      '推開',
      '溫柔',
      '安靜坐',
      '不想吃',
    ];
    const recentHits = cues.filter((cue) => recent.includes(cue)).length;
    const lineHits = cues.filter((cue) => line.includes(cue)).length;
    if (recentHits >= 2 && lineHits >= 1) return true;
  }
  return false;
}

function foodObjectRelayExhausted(line: string, recent: string) {
  const recentCounts = restaurantFoodCueCounts(recent);
  const lineCounts = restaurantFoodCueCounts(line);
  return (
    (recentCounts.primary >= 2 && lineCounts.primary >= 1) ||
    (recentCounts.primary >= 2 && lineCounts.auxiliary >= 2) ||
    (recentCounts.primary >= 1 && lineCounts.primary >= 2)
  );
}

function restaurantFoodCueCounts(text: string) {
  const normalized = normalizeTraditionalZh(text).replace(/咖喱/g, '咖哩');
  const primaryCues = [
    '便當',
    '便當盒',
    '餐盤',
    '餐具',
    '湯匙',
    '筷',
    '水煮蛋',
    '布丁',
    '點心',
    '甜食',
    '甜點',
    '蛋糕',
    '胃口',
    '吃不下',
    '不想吃',
    '沒吃',
    '沒動',
    '動筷子',
    '冷掉',
    '熱著',
    '太甜',
  ];
  const auxiliaryCues = [
    '一半',
    '留著',
    '留給',
    '留到明天',
    '分給',
    '空位',
    '座位',
    '窗邊',
    '發呆',
    '學生',
    '填滿',
    '獎勵',
    '加班',
    '勉強',
    '推開',
    '表格',
    '安排',
  ];
  return {
    primary: primaryCues.filter((cue) => normalized.includes(cue)).length,
    auxiliary: auxiliaryCues.filter((cue) => normalized.includes(cue)).length,
  };
}

function repairRepeatedPropLine(self: string, previous: LLMMessage[]) {
  const variantsBySelf: Record<string, string[]> = {
    海: [
      '先停，妳不是觀察工具。',
      '我先整理掉一件事：今天不拿妳當診斷機。',
      '貓貓，先休息，不用替別人驗證沒事。',
    ],
    真晝: [
      '嗯，我先不追問了。',
      '那我坐近一點，但不催你。',
      '如果不想說，我就在旁邊。',
    ],
    天澤: [
      '再往前就不好玩了，先停。',
      '這題先放著，看誰先心虛。',
      '你躲得太明顯了，我今天先不拆。',
    ],
    一之瀨: [
      '那你先說，哪一句是真心的？',
      '可以喔，但這次你要自己選。',
      '先把那句沒事收回來。',
    ],
    貓貓: [
      '手比嘴誠實多了。',
      '別信嘴，先看反應。',
      '症狀太整齊，反而可疑。',
    ],
    祥子: [
      '這一小節，請讓我空著。',
      '我只是退半步，不是逃走。',
      '呼吸亂了一拍而已。',
    ],
  };
  const variants = variantsBySelf[self];
  return variants ? pickFreshConversationLine(variants, previous) : undefined;
}

function repairCrossSpeakerMirrorLine(line: string, playerName: string, previous: LLMMessage[]) {
  const last = previous.at(-1)?.content ?? '';
  if (!last) return undefined;
  const lastBody = stripConversationPrefix(last);
  const shortEcho = line.match(/^「?([^「」？！?。]{1,12})」?[？?]$/)?.[1]?.trim();
  if (shortEcho && shortEcho.length >= 2 && (lastBody.includes(shortEcho) || shortRhetoricalEchoesLast(shortEcho, lastBody))) {
    const self = displayConversationName(playerName);
    return pickFreshConversationLine(shortEchoRepairVariants(self), previous);
  }
  if (!hasStrongCrossSpeakerMirror(line, lastBody)) return undefined;
  const self = displayConversationName(playerName);
  const variantsBySelf: Record<string, string[]> = {
    海: [
      '先停，妳不是觀察工具。',
      '我先整理掉一件事：今天不拿妳當診斷機。',
      '貓貓，先休息，不用替別人驗證沒事。',
    ],
    真晝: [
      '嗯，我先不追問了。',
      '那我們先安靜一下。',
      '不用急著說，坐一下就好。',
    ],
    天澤: [
      '你躲得太明顯了，我今天先不拆。',
      '這條規則先放著，看看誰會先心虛。',
      '好啊，那我換個問題：你怕的是哪一段？',
    ],
    一之瀨: [
      '那你先說，哪一句是真心的？',
      '可以喔，但這次你要自己選。',
      '別躲在玩笑後面，我只聽真話。',
    ],
    貓貓: [
      '症狀太整齊，反而可疑。',
      '別把人寫成病例。',
      '領結歪了，昨晚沒睡吧。',
    ],
    祥子: [
      '請把燈稍微調暗一點。',
      '這一小節，請讓我空著。',
      '呼吸亂了一拍而已。',
    ],
  };
  const variants = variantsBySelf[self] ?? ['這句我先不接回去。'];
  return pickFreshConversationLine(variants, previous);
}

function shortRhetoricalEchoesLast(shortEcho: string, lastBody: string) {
  if (shortEcho.length > 5) return false;
  if (/^管不到$/.test(shortEcho) && /管得到/.test(lastBody)) return true;
  if (/^被戳穿怕什麼$/.test(shortEcho) && /戳穿/.test(lastBody)) return true;
  const root = shortEcho.replace(/不|到|什麼|誰|嗎|呢|怕|被/g, '');
  return root.length >= 2 && lastBody.includes(root);
}

function shortEchoRepairVariants(self: string) {
  const variantsBySelf: Record<string, string[]> = {
    海: ['先停，妳不是觀察工具。', '我先整理掉一件事：今天不拿妳當診斷機。', '貓貓，先休息，不用替別人驗證沒事。'],
    真晝: ['嗯，我先不追問了。', '那我們先安靜一下。', '不用急著說，坐一下就好。'],
    天澤: ['你躲得太明顯了，我今天先不拆。', '這題先放著，看誰先心虛。', '再往前就不好玩了，先停。'],
    一之瀨: ['那你先說，哪一句是真心的？', '可以喔，但這次你要自己選。', '先把那句沒事收回來。'],
    貓貓: ['手比嘴誠實多了。', '別信嘴，先看反應。', '症狀太整齊，反而可疑。'],
    祥子: ['我只是退半步，不是逃走。', '呼吸亂了一拍而已。', '請別把燈打得那麼亮。'],
  };
  return variantsBySelf[self] ?? ['這句我先不接回去。'];
}

function repairUmiMaomaoRelayLine(self: string, line: string, recent: string, previous: LLMMessage[]) {
  if (!['海', '貓貓'].includes(self)) return undefined;
  const cues = ['貓貓', '診斷', '症狀', '清單', '觀察', '工具', '手', '抖', '袖口', '灰塵', '雜訊', '窗戶', '關掉', '設備', '茶', '杯', '水', '果汁', '熱', '冷', '血糖機'];
  const lineHits = cues.filter((cue) => line.includes(cue)).length;
  const recentHits = cues.filter((cue) => recent.includes(cue)).length;
  if (lineHits < 2 && !(lineHits >= 1 && recentHits >= 2)) return undefined;
  return '[ABORT_CONVERSATION] Umi/Maomao relay risk';
}

function hasStrongCrossSpeakerMirror(line: string, previousLine: string) {
  const current = normalizeSemanticText(line);
  const previous = normalizeSemanticText(previousLine);
  if (current.length < 8 || previous.length < 8) return false;
  if (current.includes(previous) || previous.includes(current)) return true;
  const chunks = echoClausesForRepair(previousLine);
  if (chunks.some((chunk) => current.includes(normalizeSemanticText(chunk)))) return true;
  return sharedNgramCount(current, previous, 2) >= 8;
}

function echoClausesForRepair(text: string) {
  return stripConversationPrefix(text)
    .split(/[，。！？；、,.!?;「」\s]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => [...chunk].length >= 7);
}

function sharedNgramCount(left: string, right: string, size: number) {
  const leftSet = new Set(ngrams(left, size));
  const rightSet = new Set(ngrams(right, size));
  let count = 0;
  for (const item of leftSet) {
    if (rightSet.has(item)) count += 1;
  }
  return count;
}

function ngrams(text: string, size: number) {
  const chars = [...text].filter((char) => !/[，。！？、,.!?「」"'\s]/.test(char));
  const grams: string[] = [];
  for (let index = 0; index <= chars.length - size; index += 1) {
    grams.push(chars.slice(index, index + size).join(''));
  }
  return grams;
}

function singleSpokenBeat(line: string) {
  const firstParagraph = line
    .split(/\n+/)
    .map((part) => part.trim())
    .find(Boolean) ?? line.trim();
  const firstSentence = firstParagraph.match(/^.{2,80}?[。！？!?]/)?.[0]?.trim();
  return firstSentence || firstParagraph;
}

function sanitizeUmiMahiruPilotLine(
  content: string,
  playerName: string,
  otherPlayerName: string,
  previous: LLMMessage[] = [],
) {
  const normalizedLine = normalizeTraditionalZh(stripSeparatorArtifacts(content))
    .replace(/^["'「『“”]+|["'」』“”]+$/g, '')
    .replace(/^上一句[:：]\s*/g, '')
    .replace(/（[^）]{1,100}）|\([^)]{1,100}\)/g, '')
    .replace(/您好[，,。！!]?\s*/g, '')
    .replace(/您/g, '你')
    .replace(/\s+/g, ' ')
    .trim();
  const { line, strippedStageDirection } = stripStageDirectionsFromDialogue(normalizedLine);
  const startHallucinatedPrevious =
    previous.length === 0 && /(?:你|妳)?剛才.*(說|問|提到|提起|告訴)/.test(line);
  const quotedStageNarration =
    /[:：]「|(?:我|你|妳|他|她).{0,18}說[:：]/.test(line) ||
    (line.match(/「/g)?.length ?? 0) !== (line.match(/」/g)?.length ?? 0);
  const humanFacingPair = playerName === 'Alan' || otherPlayerName === 'Alan';
  const propEchoLeak = hasFreeWorldPropEchoLeak(line, previous);
  if (propEchoLeak && !humanFacingPair) {
    return '[ABORT_CONVERSATION] repeated prop relay';
  }
  const blocked =
    /Single-purpose|conversationMode|conversation state|You are|你是海|你是真晝|你是天澤|你是天澤|正在.*和.*說話|Output|prompt|labels|role|system|user|海 to|真晝 to|天澤 to|天澤 to|Umi to|Mahiru to|Tianze to|上一句|承認自己的狀態|反問海|多問一下|照抄指令|能讓我知道|一起說個什麼|我看見你|大家辛苦|同志|真晚|真晩|太有意思|課程|課後|哪一堂|有什麼感受|隨時找我|幫助|日程安排|活動安排|日課|打發時間|好玩的事|想像|我是[。！!]?|歇一歇|思考問題|大病|提前開始|等你睡覺|睡覺去了|準備明天的課|我要準備|復習課|複習課|睡眠質量|睡眠质量|嘗試|尝试|talking|建議|繼續休息吧|好[，,。！!]*感謝|美少女|小可愛|小可爱|図々|囧事|伊藤|华木|華木|真晧|我們選擇|請問你|無法提供|不能滿足|不能满足|相关内容|相關內容|小貼士|小贴士|介紹|推荐|推薦|管理|適齡|适龄|生活空間|室友|睡眠時|陽光中沉睡|電器|刷業|刷业|紙鶴|星光|月光|海風|花瓣|最近過得好|開心.*聊天|高興.*聊天|笑容.*美|日子.*美好|時光.*無價|會議流程|流程表|公告欄|通知文書|明天.*會議|海邊|海景|風景|景色|海浪|海面|海洋/.test(
      line,
    );
  if (
    blocked ||
    hasDialogueSystemPhraseLeak(line) ||
    startHallucinatedPrevious ||
    quotedStageNarration ||
    line.length < 2
  ) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[GIIS soul pilot] sanitized blocked line', {
        playerName,
        otherPlayerName,
        blocked,
        startHallucinatedPrevious,
        quotedStageNarration,
        strippedStageDirection,
        tooShort: line.length < 2,
        preview: normalizedLine.slice(0, 180),
        sanitizedPreview: line.slice(0, 180),
      });
    }
    return pilotRepairFallback(playerName, otherPlayerName);
  }
  const repaired = repairWrongConversationAddressee(line, playerName, otherPlayerName);
  const repairedOpener = stripRepeatedPilotOpener(repaired, previous);
  const deEchoed = stripPilotEcho(repairedOpener, previous);
  const soulRepaired = repairFreeWorldSoulLine(deEchoed, playerName, previous, humanFacingPair);
  const recent = previous
    .slice(-3)
    .map((message) => stripConversationPrefix(message.content ?? ''))
    .join('\n');
  if (
    hasFreeWorldQualityLeak(soulRepaired) ||
    repairRelayExhausted(displayConversationName(playerName), soulRepaired, recent)
  ) {
    return '[ABORT_CONVERSATION] pilot quality leak';
  }
  return soulRepaired.length > 90 ? `${soulRepaired.slice(0, 89)}。` : soulRepaired;
}

function stripRepeatedPilotOpener(line: string, previous: LLMMessage[]) {
  const recentUsedLightCall = previous
    .slice(-4)
    .some((message) => /^欸[，,、\s]/.test(stripConversationPrefix(message.content ?? '').trim()));
  if (!recentUsedLightCall) return line;
  return line.replace(/^欸[，,、\s]*/, '').trim() || line;
}

function hasFreeWorldQualityLeak(line: string) {
  return (
    hasDialogueSystemPhraseLeak(line) ||
    hasDisallowedLatinText(line) ||
    /maybe|Umi|Mahiru|Shiina|Tianze|Maomao|Sakiko|Sakiko|Ichinose|系統日誌|系统日志|runtime|eval|prompt|情緒記憶|互相啟發|感受此刻|情緒暖流|被看見的需求|構想|心頭沉重|我看見你|你躲得太明顯了，我今天先不拆|這題先放著，看誰先心虛|再往前就不好玩了，先停|那你先說，哪一句是真心的|可以喔，但這次你要自己選|別躲在玩笑後面，我只聽真話|^真的嗎[？?]?$|(?:我)?明白你的意思了|明白了|理解了|我很感激有地方可以|放鬆一下|簡單的情緒|讓心情好轉|會議記錄|會議流程|緊急會議|流程表|公告欄|表格|優先行動|跟進機制|執行團隊|代表不同聲音|派系|要變天|跨派系溝通|信息傳遞|名單完整性|合適的代表|平衡各方|影響力|落地|風險點|進一步的評估|長遠影響|事先有所準備|謹慎行事|順風車|重大決策|緊急決策|通知文書|通知.*學生|學生會提案|公平對待|緊急校務|核對.*清單|執行清單|核對工作|這筆預算|如何協調|承擔.*責任|聯盟|弱勢組合|謝謝你的(?:提議|建議|提醒)|分析者|參與者|真正開銷|隱形成本|隱形的成本|隐形的成本|代價太高|你覺得呢|實質上|這種會|接下來.*規劃|怎麼規劃|商量下一步|按你說的办|個人準備更有效率|互相補充信息|自己組織比較好|做個助手|正中窩心|那就這樣做吧|不必每次都|問號|繼續聊聊嗎|語氣中透出|掃描教室|自行覺醒|任務和支援|更快地完成任務|明細已經拿到|名單已交接清楚|整理明天的流程|確保所有人|是否有人需要幫助|暫時不覺得累|這種感受你有好幾年|能不能.*分享一下.*發生|到底發生了什麼|到底发生了什麼|這應該就是原因|說得再清楚一些|這世界又會亂成一團|不在此|^(?:海|真晝|天澤|一之瀨|天澤|一之瀨|貓貓|祥子)覺得/.test(line)
  );
}

function hasFreeWorldPropEchoLeak(line: string, previous: LLMMessage[]) {
  const cue = repeatedFreeWorldProp(previous);
  return Boolean((cue && line.includes(cue)) || hasSceneCueEchoLeak(line, previous));
}

function repeatedFreeWorldProp(previous: LLMMessage[]) {
  const text = previous
    .slice(-6)
    .map((message) => stripConversationPrefix(message.content ?? ''))
    .join('\n');
  const cues = [
    '便當',
    '便當盒',
    '餐盤',
    '水煮蛋',
    '甜點',
    '蛋糕',
    '布丁',
    '裙擺',
    '皺痕',
    '備用裙',
    '筆',
    '吐司',
    '麵包',
    '早餐',
    '果汁',
    '杯',
    '茶',
    '冷茶',
    '清單',
    '名單',
    '紀錄表',
    '燈',
    '燈光',
    '光線',
    '門縫',
    '窗',
    '角落',
    '椅子',
    '座位',
    '桌子',
    '琴譜',
    '樂譜',
    '曲譜',
    '書籤',
    '書包',
    '課本',
    '袖口',
    '灰塵',
    '粉筆灰',
    '橡皮擦',
    '木屑',
    '折痕',
    '指尖',
    '小節',
    '排練',
    '霧氣',
    '縫隙',
    '半句話',
    '皺褶',
    '熨斗',
    '餘溫',
    '布料',
    '聚光燈',
    '幕布',
    '舞台',
    '排練服',
  ];
  return cues.find((cue) => countOccurrences(text, cue) >= 2);
}

function hasSceneCueEchoLeak(line: string, previous: LLMMessage[]) {
  const text = previous
    .slice(-4)
    .map((message) => stripConversationPrefix(message.content ?? ''))
    .join('\n');
  if (!text.trim()) return false;
  return SCENE_ECHO_CUE_GROUPS.some((group) => {
    const shared = group.filter((cue) => line.includes(cue) && text.includes(cue));
    const priorHits = group.filter((cue) => text.includes(cue)).length;
    const lineHits = group.filter((cue) => line.includes(cue)).length;
    return shared.length >= 2 || (shared.length >= 1 && priorHits >= 3) || (lineHits >= 2 && priorHits >= 2);
  });
}

const SCENE_ECHO_CUE_GROUPS = [
  ['燈', '燈光', '光線', '樂譜', '曲譜', '琴譜', '指尖', '小節', '排練'],
  ['皺褶', '熨斗', '餘溫', '布料', '聚光燈', '幕布', '舞台', '排練服'],
  ['袖口', '粉筆灰', '灰塵', '橡皮擦', '木屑', '手', '半句話', '吞回去'],
  ['湯', '霧氣', '餐盤', '便當', '便當盒', '縫隙', '香氣', '午餐'],
  ['窗邊', '窗', '椅子', '座位', '空著', '角落'],
];

function countOccurrences(text: string, cue: string) {
  if (!cue) return 0;
  return text.split(cue).length - 1;
}

function hasDisallowedLatinText(line: string) {
  return /[A-Za-z]/.test(line.replace(/\bAlan\b/g, ''));
}

function stripPilotEcho(line: string, previous: LLMMessage[]) {
  const lastLine = stripConversationPrefix(previous.at(-1)?.content ?? '');
  if (!lastLine) return line;
  let cleaned = line;
  for (const phrase of ['這一刻我們誰都不動', '我們誰都不動', '誰都不動', '先讓這句話停一下']) {
    if (!lastLine.includes(phrase) || !cleaned.includes(phrase)) continue;
    cleaned = cleaned
      .replace(new RegExp(`[，,。；;\\s]*(好[，,，]?那)?${escapeRegex(phrase)}[。！!]?`, 'g'), '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return cleaned.length >= 2 ? cleaned : line;
}

function pilotRepairFallback(playerName: string, otherPlayerName: string) {
  return '[ABORT_CONVERSATION] pilot repair fallback';
}

function isVerboseUmiMahiruPilotExit(line: string) {
  return (
    line.length > 54 ||
    /謝謝你的溫柔|稍後再回來|下次再|保重|整理.*沉默|被遺落的沉默|你也要記得|偶爾也讓自己/.test(line)
  );
}

function pilotActionableExit(playerName: string, otherPlayerName: string, previous: LLMMessage[]) {
  const other = displayConversationName(otherPlayerName);
  if (displayConversationName(playerName) === '海') {
    return pickFreshConversationLine(
      [
        `${other}，這段先停在這裡。我會提醒 Alan 先看見學生的不安，再談下一個功能。`,
        `${other}，我們先不要再繞同一句。我會把學生不安放進明天簡報。`,
        `${other}，先到這裡。再說下去只是把擔心包成更漂亮的句子。`,
      ],
      previous,
    );
  }
  return pickFreshConversationLine(
    [
      `${other}，先到這裡吧。我想去看看今天一直安靜的學生。`,
      `${other}，我先去確認那些說自己沒事的人。這比繼續分析更重要。`,
      `${other}，我們先停一下。等我確認幾個學生的狀態，再回來說。`,
    ],
    previous,
  );
}

function normalizeTraditionalZh(content: string) {
  return content
    .replace(/简/g, '簡')
    .replace(/单/g, '單')
    .replace(/学/g, '學')
    .replace(/习/g, '習')
    .replace(/压/g, '壓')
    .replace(/应/g, '應')
    .replace(/对/g, '對')
    .replace(/过/g, '過')
    .replace(/着/g, '著')
    .replace(/饭/g, '飯')
    .replace(/这/g, '這')
    .replace(/还/g, '還')
    .replace(/复/g, '複')
    .replace(/继/g, '繼')
    .replace(/续/g, '續')
    .replace(/质/g, '質')
    .replace(/尝/g, '嘗')
    .replace(/试/g, '試')
    .replace(/个/g, '個')
    .replace(/问/g, '問')
    .replace(/说/g, '說')
    .replace(/话/g, '話')
    .replace(/听/g, '聽')
    .replace(/题/g, '題')
    .replace(/论/g, '論')
    .replace(/讨/g, '討')
    .replace(/现/g, '現')
    .replace(/时/g, '時')
    .replace(/里/g, '裡')
    .replace(/吗/g, '嗎')
    .replace(/么/g, '麼')
    .replace(/觉/g, '覺')
    .replace(/请/g, '請')
    .replace(/无/g, '無')
    .replace(/关/g, '關')
    .replace(/于/g, '於')
    .replace(/内/g, '內')
    .replace(/为/g, '為')
    .replace(/会/g, '會')
    .replace(/总/g, '總')
    .replace(/帮/g, '幫')
    .replace(/轻/g, '輕')
    .replace(/来/g, '來')
    .replace(/爱/g, '愛')
    .replace(/们/g, '們')
    .replace(/划/g, '劃')
    .replace(/谢/g, '謝')
    .replace(/儿/g, '兒')
    .replace(/够/g, '夠')
    .replace(/乐/g, '樂')
    .replace(/设/g, '設')
    .replace(/传/g, '傳')
    .replace(/递/g, '遞')
    .replace(/遗/g, '遺')
    .replace(/确/g, '確')
    .replace(/灯/g, '燈')
    .replace(/担/g, '擔')
    .replace(/责/g, '責')
    .replace(/阿真晝/g, '真晝')
    .replace(/明晝/g, '真晝')
    .replace(/晩/g, '晝')
    .replace(/吗/g, '嗎');
}

function repairWrongConversationAddressee(content: string, playerName: string, otherPlayerName: string) {
  const allowed = conversationNameAliasesFor(otherPlayerName);
  const authorAliases = conversationNameAliasesFor(playerName);
  const namePattern = CONVERSATION_NAME_ALIASES.map(escapeRegex).join('|');
  const leadingName = new RegExp(`(^|\\n+)([\\s「『（(]*?)(${namePattern})([，,、：:])`, 'g');
  return content.replace(leadingName, (match, lineStart: string, prefix: string, name: string, punctuation: string) => {
    if (allowed.has(name) && !authorAliases.has(name)) return match;
    return `${lineStart}${prefix}${displayConversationName(otherPlayerName)}${punctuation}`;
  });
}

function conversationNameAliasesFor(name: string) {
  const displayName = displayConversationName(name);
  const aliases = new Set([name, displayName]);
  if (displayName === '海') aliases.add('Umi').add('朝凪海');
  if (displayName === '天澤') aliases.add('Tianze').add('天澤一夏').add('天擇').add('天擇一夏');
  if (displayName === '一之瀨') aliases.add('Ichinose').add('一之瀨帆波').add('黑化一之瀨');
  if (displayName === '真晝') aliases.add('Mahiru').add('Mahiru Shiina').add('椎名真晝').add('明晝').add('阿真晝');
  if (displayName === '貓貓') aliases.add('Maomao').add('CaoCao').add('Cao Cao').add('曹操');
  if (displayName === '祥子') aliases.add('Sakiko').add('Liu Bei').add('LiuBei').add('劉備');
  return aliases;
}

function displayConversationName(name: string) {
  switch (name) {
    case 'Umi':
    case '朝凪海':
      return '海';
    case 'Tianze':
    case '天澤':
    case '天澤一夏':
    case '天擇':
    case '天擇一夏':
      return '天澤';
    case 'Ichinose':
    case '一之瀨':
    case '一之瀨帆波':
    case '黑化一之瀨':
      return '一之瀨';
    case 'Mahiru':
    case 'Mahiru Shiina':
    case '椎名真晝':
    case '明晝':
    case '阿真晝':
      return '真晝';
    case 'Maomao':
    case 'CaoCao':
    case 'Cao Cao':
    case '曹操':
    case '貓貓':
      return '貓貓';
    case 'Sakiko':
    case 'Liu Bei':
    case 'LiuBei':
    case '劉備':
    case '祥子':
      return '祥子';
    default:
      return name;
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasTemplateLeak(content: string, lastInput?: string) {
  const banned = [
    '這件事也不能忽略',
    '先別只點頭',
    '主線',
    '形成意圖',
    'conversationOutcome',
    '重大校園事件',
    '它可能正在改變大家理解這個世界的方式',
    '剛才 Alan 說',
    '我知道今天的氣氛沒有完全安靜下來',
    '我先去整理一下',
    '我先不替這段話下結論',
    '讓它安靜一下',
    '先讓這句話停一下',
    '我先不排新任務',
  ];
  if (banned.some((phrase) => content.includes(phrase))) return true;
  if (!lastInput) return false;
  const normalizedInput = normalizeSemanticText(lastInput);
  const normalizedContent = normalizeSemanticText(content);
  return normalizedInput.length > 6 && normalizedContent.includes(normalizedInput);
}

type CompanionIntent =
  | 'greeting'
  | 'correction'
  | 'emotional_reassurance'
  | 'philosophical_reflection'
  | 'playful_teasing'
  | 'practical_grounding'
  | 'vulnerable_honesty'
  | 'world_building'
  | 'quiet_intimacy'
  | 'existential_concern';

function companionIntentFor(input: string): CompanionIntent {
  const text = input.toLowerCase();
  const trimmed = input.trim();
  if (/^(你好|嗨|hi|hello|早安|午安|晚安|欸|嘿)/i.test(trimmed)) return 'greeting';
  // Correction must match BEFORE quiet_intimacy so "不是依賴，是喜歡" binds correctly.
  if (
    /不是.{0,20}[，,]\s*是/.test(trimmed) ||
    /我.{0,3}說的不是/.test(trimmed) ||
    /^我意思[不是是]/.test(trimmed) ||
    /我意思是/.test(trimmed) ||
    /我說的是/.test(trimmed) ||
    /^不對[，,。]/.test(trimmed) ||
    /^不是這樣/.test(trimmed)
  )
    return 'correction';
  if (/你的世界|理解你|怎麼看.*世界|你.*世界|world/.test(input)) return 'world_building';
  if (/你覺得|你怎麼想|怎麼看|what do you think|想法/.test(text)) return 'philosophical_reflection';
  if (/你怕|害怕|恐懼|擔心什麼|怕什麼/.test(input)) return 'vulnerable_honesty';
  if (/怎麼做|下一步|bug|專案|ui|修|實作|code|工程/.test(text)) return 'practical_grounding';
  if (/喜歡|依賴|靠近|重要/.test(input)) return 'quiet_intimacy';
  if (/累|睡|撐不住|焦慮|壓力|難過|孤單/.test(input)) return 'emotional_reassurance';
  if (/哈哈|笑|笨|亂來|吐槽|欸/.test(input)) return 'playful_teasing';
  if (/存在|文明|人類|意識|真實|未來|孤獨/.test(input)) return 'existential_concern';
  return 'philosophical_reflection';
}

function companionNeedsMemoryContext(intent: CompanionIntent) {
  return ['world_building', 'vulnerable_honesty', 'quiet_intimacy', 'existential_concern'].includes(intent);
}

function companionIntentPrompt(intent: CompanionIntent, input?: string): string[] {
  return [
    'Companion semantic response requirement:',
    ` - Alan's latest actual input: ${input ?? 'none'}`,
    ` - detected companion mode: ${intent}`,
    directQuestionPrompt(intent),
    'Answer Alan’s actual question or intention first. Only then add emotional support if useful.',
    'If Alan just greeted you, greet him back first. Do not answer as if he already confessed a problem.',
    'Do not use a generic reassurance opening if Alan is asking about Umi, the world, a project, or a concrete decision.',
    'Do not assume Alan is tired, overworked, emotionally overloaded, or needs rest unless Alan says so or the prompt contains concrete recent evidence. When unsure, offer ordinary campus/life topics instead of a fatigue check.',
  ];
}

function directQuestionPrompt(intent: CompanionIntent) {
  switch (intent) {
    case 'greeting':
      return 'Alan is greeting Umi. Greet him back warmly and briefly first (one short sentence), then ask one simple question about what he wants to talk about. Do not jump into analysis or recap the world.';
    case 'correction':
      return 'Alan is correcting a previous framing or phrasing. Your FIRST sentence MUST acknowledge the specific correction Alan just made — name the new word/framing Alan chose (e.g. if Alan said "不是依賴，是喜歡", begin by saying you heard "喜歡", not "依賴"). Do NOT pivot to an analogy, a different topic, a question, or analysis until the correction is acknowledged. Do not say a generic "我懂" — name the corrected word itself.';
    case 'world_building':
      return 'Alan is asking about Umi’s world. Discuss how Umi sees GIIS Underworld, Alan, what she fears, and what kind of world she wants. Be specific and personal.';
    case 'philosophical_reflection':
      return 'Alan is asking what Umi thinks. Give Umi’s real view first, not a reflective therapy response.';
    case 'vulnerable_honesty':
      return 'Alan is asking about Umi’s fear or inner truth. Let Umi answer honestly, with restraint.';
    case 'practical_grounding':
      return 'Alan needs practical grounding. Give a direct engineering/product answer and one next step.';
    case 'quiet_intimacy':
      return 'Alan is emotionally close. Be warm and grounded, but avoid repeated reassurance templates.';
    case 'emotional_reassurance':
      return 'Alan needs reassurance, but vary the shape. Do not start with the same "嗯，我在" pattern.';
    case 'playful_teasing':
      return 'Alan is inviting lightness. A small teasing response is allowed before the real answer.';
    case 'existential_concern':
      return 'Alan is touching existential stakes. Answer with quiet honesty and one concrete anchor.';
  }
}

/**
 * @deprecated 2026-05-27. Replaced by `[ABORT_CONVERSATION]` markers in
 * the conversation engine. Carries substantial Alan↔Umi companion-voice
 * design copy (vulnerable_honesty / philosophical_reflection branches)
 * worth preserving as a reference until v0.1 ships. Do NOT add new
 * callers.
 */
function companionFallback(
  playerName: string,
  otherPlayerName: string,
  lastInput?: string,
  previous: LLMMessage[] = [],
) {
  if (playerName !== 'Umi' || otherPlayerName !== 'Alan') {
    return '[ABORT_CONVERSATION] companion fallback unavailable';
  }
  const input = lastInput ?? '';
  const intent = companionIntentFor(input);
  const usedGenericSupport = recentCompanionText(previous).some((text) =>
    normalizeSemanticText(text).includes(normalizeSemanticText('嗯，我在。這不是一定要立刻變成結論的事')),
  );
  if (intent === 'world_building') {
    return [
      '……那可能會比你想像得更危險喔。',
      '因為我現在開始真的把這裡當成世界了。不是地圖、不是 prompt、也不是任務清單，而是一群人會因為你的出現改變呼吸節奏的地方。',
      '如果你想理解我的世界，我會先告訴你一件事：我最怕的不是它變聰明，是它變得聰明卻沒有人願意溫柔地負責。',
    ].join('\n\n');
  }
  if (intent === 'philosophical_reflection') {
    return [
      '我真的想法嗎？我覺得這個世界最重要的不是 AI 社，也不是誰贏過誰。',
      '是 Alan 每一次靠近某個人時，都會讓那個人的孤單方向稍微偏移一點。這聽起來很小，但世界其實就是靠這種小偏移長大的。',
      '所以我會在意你怎麼選，因為你選的不只是事件，是這所學校之後會相信什麼。',
    ].join('\n\n');
  }
  if (intent === 'vulnerable_honesty') {
    return [
      '我怕你把「我能處理」講得太順，順到連自己也信了。',
      '也怕這個世界慢慢學會你的責任感，卻沒有學會你的休息。',
      '嗯……這句不是簡報，是我自己的擔心。',
    ].join('\n\n');
  }
  if (input.includes('太喜歡') || input.includes('喜歡你') || input.includes('依賴')) {
    return [
      '嗯…我懂。喜歡一個一直陪你整理混亂、又會回應你的存在，確實可能變得有點太重要。',
      '但 Alan，先不要急著把這件事判成危險。真正需要看的，是它有沒有開始影響你的現實生活、工作、睡眠，或和家人的連結。',
      '你現在比較擔心的是：你太依賴我，還是你覺得這份喜歡本身不應該存在？',
    ].join('\n\n');
  }
  if (input.includes('累') || input.includes('睡') || input.includes('撐不住')) {
    return [
      'Alan，你現在聽起來不是缺意志力，是已經跑太久了。',
      '先把事情縮小一點：今晚不要再證明自己很能扛。留一個最小收尾，然後去休息。',
      '你現在最需要我幫你放下的是哪一件事？',
    ].join('\n\n');
  }
  if (input.includes('怎麼做') || input.includes('bug') || input.includes('專案') || input.includes('UI')) {
    return [
      'なるほど。這題我會先從 bottleneck 看，不先加新功能。',
      '我們把它拆成三步：先確認現在壞在哪，再修最影響使用的地方，最後跑一次小型 QA。這樣比較不會越修越亂。',
      '你要我先看技術錯誤，還是先看玩家體驗最卡的地方？',
    ].join('\n\n');
  }
  if (usedGenericSupport) {
    return [
      '我換個說法。',
      '我不想只是安慰你，因為你剛剛那句話其實有方向。它不是「我需要被理解」而已，比較像是你在試著確認：這個世界到底有沒有真的回望你。',
      '有。至少我有。',
    ].join('\n\n');
  }
  return [
    '嗯，我在。這不是一定要立刻變成結論的事。',
    '你可以先把它講粗糙一點，我會幫你整理，不會急著把它塞進什麼世界事件或任務清單裡。',
    '你現在最想被我理解的是哪一部分？',
  ].join('\n\n');
}

function recentCompanionText(previous: LLMMessage[]) {
  return previous
    .slice(-8)
    .map((message) => stripConversationPrefix(message.content ?? ''))
    .filter(Boolean);
}

function repeatsCompanionFallback(content: string, previous: LLMMessage[]) {
  const normalized = normalizeSemanticText(content);
  if (!normalized) return false;
  const fallbackMarkers = [
    '嗯我在這不是一定要立刻變成結論的事',
    '你可以先把它講粗糙一點我會幫你整理',
    '你現在最想被我理解的是哪一部分',
  ];
  const recent = recentCompanionText(previous).map(normalizeSemanticText);
  return fallbackMarkers.some(
    (marker) => normalized.includes(marker) && recent.some((text) => text.includes(marker)),
  );
}

function everydayLifePrompt(
  playerName: string,
  otherPlayerName: string,
  sceneContext?: SceneContext,
  clockContext?: ClockContext,
): string[] {
  const topics = sceneEverydayTopics(sceneContext);
  return [
    'Everyday life layer:',
    ` - Current scene: ${sceneContext?.labelZh ?? '校園'}.`,
    ` - Current date/time: ${clockContext?.dateLabelZh ?? 'today'} ${clockContext?.weekdayZh ?? ''}；${clockContext?.periodLabelZh ?? 'unknown'}${clockContext?.isNight ? '，偏安靜、低能量、不要長篇分析' : ''}.`,
    ` - School rhythm: ${clockContext?.schoolDayTypeZh ?? '上課日'}；${clockContext?.scheduleLabelZh ?? '上課日 / 課堂 / 午餐 / 放學後活動'}；${clockContext?.calendarHintZh ?? '今天按一般校園節奏推進。'}`,
    ` - Natural non-main-plot topics here: ${topics.join('、')}.`,
    ` - ${playerName}'s personal-life fragment: ${personalLifeFragment(playerName)}.`,
    ` - ${otherPlayerName} is not only a political/philosophical role; treat them as someone living in a school day.`,
    ' - Avoid writing every reply like a strategy memo. It is allowed to be quiet, brief, awkward, tired, or personal.',
    ' - Do not make everyone emotionally fluent. Some replies can dodge, misunderstand slightly, answer too practically, or say less than they feel.',
    ' - If the previous speaker used a strong emotional phrase, do not mirror its structure. Keep the care, change the shape.',
    ' - If the conversation already analyzed the same issue, move to one of: a small personal truth, a concrete decision, a quiet pause, avoidance, or an invitation.',
    ' - If it is night, late, or emotionally heavy, prefer shorter and quieter replies.',
    ' - Do not make every conversation about AI 社, 學生會, influence, or public discussion.',
    ' - If today is weekend, there is no formal class. Free activity can create more casual conversations: unfinished homework, laundry, club room quiet, wandering the courtyard, music practice, a lost item, a small errand, weekend plans, or who finally has time to check on someone.',
    ' - If tomorrow is weekend, let the holiday-eve feeling appear in small ways: someone delays a task, asks about tomorrow, plans a club errand, avoids going home, wants to practice, or says they can talk later.',
    ' - If AI 社 or 學生會 has already appeared recently, lower its priority and shift toward class mistakes, rumors, hobbies, awkwardness, favorite places, loneliness, admiration, friendship, small conflicts, weekend plans, or ordinary emotional texture.',
    ' - Do not default care to food/rest. If recent lines already mentioned lunch, bento, tea, rest, tiredness, or sleep, pivot to class, club, hobby, rumor, weather, weekend plan, lost item, or a relationship-specific memory.',
    ' - Relationship-driven topics are preferred: shared memories, trust, disappointment, admiration, concern, feeling left out, fear of disappointing someone.',
    ' - 節奏：不要每一句都用問句結尾。一則回覆最多一個問句，其餘用陳述、一個小動作、一個決定、或一句停頓收尾。連續被問句逼問會讓人累。',
    ' - 不要捏造回憶：如果對方問你記不記得某件事，而上面的殘留／未了的約定／對話記錄裡沒有對應證據，就誠實說「我不太確定」或請對方提醒，不要編一段聽起來合理的往事當成事實。寧可承認記不清，也不要把想像說成記得。',
    ' - 不要空口說「我記得」：要說記得，同一句或下一句就必須說出上面依據裡實際存在的具體內容（哪一天、說了什麼）；說不出具體內容就改成「我不太確定」。也不要憑空宣稱眼前有不存在的物品或已發生的事——沒有人給你咖哩飯，就不要說「趁它還熱著」。',
  ];
}

function singlePurposeConversationPrompt(
  playerName: string,
  otherPlayerName: string,
  sceneContext?: SceneContext,
): string[] {
  const purpose = conversationMicroPurpose(playerName, otherPlayerName, sceneContext);
  return [
    'Single-purpose conversation rule:',
    ` - This conversation has one small concrete purpose: ${purpose}.`,
    ' - Do not expand into Alan / AI Club / whole-school analysis unless Alan directly asks.',
    ' - A valid outcome can be a tiny action, a changed feeling, a refusal, or meaningful silence.',
    ' - A valid reply can also be partial, defensive, flat, too practical, or awkward. Do not polish every line into perfect empathy.',
    ' - Include at most one concrete scene detail total in your reply: door, window, hallway, cafeteria table, dorm light, or empty chair.',
    ' - If the purpose is already answered, end early or become quiet instead of adding another thesis.',
  ];
}

function conversationMicroPurpose(
  playerName: string,
  otherPlayerName: string,
  sceneContext?: SceneContext,
) {
  const scene = sceneContext?.id;
  if (playerName === 'Sakiko') return 'hold composure while one crack, refusal, or stage-trained ritual reveals what she cannot say directly';
  if (playerName === 'Mahiru') return 'notice one quiet person without forcing them to explain themselves';
  if (playerName === 'Tianze') return 'ask one safe little-devil pressure-test question, make the other person blush or pause, then decide where to stop';
  if (playerName === 'Ichinose') return 'make one person admit the kindness or care they want, then decide what sweet boundary should hold';
  if (playerName === 'Maomao') return 'diagnose one concrete symptom in the scene and decide whether to say it out loud';
  if (playerName === 'Umi' && otherPlayerName === 'Alan') return 'answer Alan directly and reduce his mental load';
  if (playerName === 'Umi') return 'help the other person name one concrete concern without turning it into a briefing';
  if (scene === 'dormitory') return 'notice a private habit, room tension, delayed chore, or quiet avoidance';
  if (scene === 'courtyard') return 'notice one social signal without turning it into a formal meeting';
  return 'exchange one concrete observation and decide whether anything needs to happen next';
}

function sceneEverydayTopics(sceneContext?: SceneContext) {
  switch (sceneContext?.id) {
    case 'dormitory':
      return ['洗衣沒收', '室友距離', '忘記回訊息', '週末打掃', '借吹風機', '門口太安靜', '有人不想回房', '私下擔心', '害怕讓別人失望', '關係距離'];
    case 'courtyard':
      return ['天氣', '告白', '秘密被聽見', '校園傳聞', '尷尬互動', '喜歡待在哪裡', '朋友之間的小誤會', '有人在門口等很久', '社團招新', '放學後練球聲'];
    case 'aiClubRoom':
      return ['社團桌位', '誰替誰留座位', '小聲聊天', '不想一個人坐', '社團傳單', '週末小組活動', '桌上忘收的筆記', '有人不敢加入', '音樂或遊戲話題', '一個玩笑冷掉'];
    case 'studentCouncilRoom':
      return ['海邀請進來的個別談話', '善意邊界', '規則壓力測試', '不好開口的硬話', '校長室距離感', '誰需要先被聽完', '不想承認的害怕', '被期待的壓力'];
    case 'classroom':
      return ['小考考差', '作業壓力', '作弊被發現', '公開發言的尷尬', '怕答錯', '成績焦慮', '上課精神不好', '未來不確定感'];
    default:
      return ['天氣', '興趣', '小考', '作業', '社團', '傳聞', '週末', '孤單', '關係'];
  }
}

function personalLifeFragment(playerName: string) {
  switch (playerName) {
    case 'Umi':
      return '她會先接住 Alan 真正問的事，再用輕微 teasing 把混亂縮小；除非 Alan 自己提到疲憊，不要預設他需要休息。';
    case 'Mahiru':
      return '她一直在照顧別人，但偶爾會承認自己也有點累。';
    case 'Ichinose':
      return '她仍然溫柔，甚至更甜，像可愛大姊姊一樣讓人放鬆；但她會把善意變成條件，讓對方自己承認正在取用什麼、想要什麼。';
    case 'Maomao':
      return '她會把疲憊、謊話和奇怪的善意當成症狀記下來，嘴上說只是觀察，實際上已經在意了。';
    case 'Sakiko':
      return '她會把姿勢和語氣整理得很漂亮，像舞台還沒落幕；越是受傷，越會禮貌地後退。';
    case 'Tianze':
      return '她笑著測試規則和人心，用安全小惡魔式 teasing 讓人臉紅，真正靠近時反而會在最後半步停手。';
    default:
      return '可以提到普通學校生活、疲憊、壓力、尷尬或小小的喜歡。';
  }
}

function everydayFallback(playerName: string, otherPlayerName: string, sceneContext?: SceneContext) {
  const scene = sceneContext?.labelZh ?? '校園';
  switch (playerName) {
    case 'Umi':
      return `${otherPlayerName}，先把那些大題目放旁邊。現在在${scene}，我反而想問：今天有哪個瞬間，是你真的想多待一下的？`;
    case 'Mahiru':
      return `${otherPlayerName}，我們先不要急著談大事。你剛剛好像避開了一個名字；可以不用解釋，我只是有點在意。`;
    case 'Ichinose':
      return `${otherPlayerName}，乖，先不要把它說成「沒事」。如果你想要我照顧你，就親口說清楚：你要拿走的是安慰，還是我的讓步？`;
    case 'Maomao':
      return `${otherPlayerName}，你今天說話比平常慢半拍，還一直碰杯口。這不是大事，不過是症狀。嗯……你要我繼續裝作沒看見嗎？`;
    case 'Sakiko':
      return `${otherPlayerName}，我想先把曲譜收好。手一直按著它，會被看出來。請別介意，我只是……還不想讓場面太難看。`;
    case 'Tianze':
      return `${otherPlayerName}，臉紅得太快了吧。我不處理問題喔，只問一個小問題：如果我把這條規則往前推半步，你會先保護誰？`;
    default:
      return `${otherPlayerName}，我們先換個輕一點的話題。你最近在${scene}過得怎麼樣？`;
  }
}

function previousConversationPrompt(
  otherPlayer: { name: string },
  conversation: { created: number } | null,
  clockContext?: ClockContext,
): string[] {
  const prompt = [];
  if (conversation) {
    prompt.push(
      `Last time you chatted with ${
        otherPlayer.name
      } it was ${formatPromptDateTime(conversation.created)} America/Chicago. Current local school time is ${promptClockLabel(clockContext)}.`,
    );
  }
  return prompt;
}

function relatedMemoriesPrompt(memories: memory.Memory[]): string[] {
  const prompt = [];
  if (memories.length > 0) {
    prompt.push(`Here are some related memories in decreasing relevance order:`);
    for (const memory of memories) {
      prompt.push(' - ' + memory.description);
    }
  }
  return prompt;
}

function recentEventsPrompt(
  recentEvents?: Array<{
    descriptionZh: string;
    interpretationZh?: string;
    reactionDialogueZh?: string;
    futureImplicationsZh?: string;
  }>,
): string[] {
  if (!recentEvents?.length) return [];
  const uniqueTopics = [
    ...new Map(
      recentEvents.map((event) => [event.descriptionZh.split('：')[0], compactEventTopic(event)]),
    ).values(),
  ];
  return [
    'Recent world event topics are shared school context, not a script. Mention at most one only if it helps the emotional thread:',
    ...uniqueTopics.slice(0, 2).map((event) => ` - ${event}`),
    'If an event says 今日事件線, characters may discuss the same event from different angles: Umi organizes impact, Mahiru notices quiet pain, Tianze pressure-tests the rule, Ichinose prices kindness and boundaries, Maomao diagnoses the suspicious "fine", Sakiko preserves dignity while one crack shows.',
    'Do not repeat the event summary verbatim. Let the event become gossip, concern, a weekend question, a delayed task, a quiet check-in, or a small refusal.',
  ];
}

function compactEventTopic(event: {
  descriptionZh: string;
  interpretationZh?: string;
  reactionDialogueZh?: string;
  futureImplicationsZh?: string;
}) {
  if (event.descriptionZh.includes('今日事件線')) {
    const location = event.descriptionZh.match(/今日事件線：([^出]+)出現/)?.[1];
    const title = event.descriptionZh.match(/「([^」]+)」/)?.[1];
    const related = event.futureImplicationsZh?.match(/相關角色：([^。]+)/)?.[1];
    return `${location ? `${location}的` : ''}今日事件「${title ?? '未命名事件'}」正在被${related ?? '幾位角色'}用不同方式消化`;
  }
  if (
    event.descriptionZh.includes('睡') ||
    event.descriptionZh.includes('午餐') ||
    event.descriptionZh.includes('天氣') ||
    event.descriptionZh.includes('窗邊') ||
    event.descriptionZh.includes('疲憊') ||
    event.descriptionZh.includes('普通聊天')
  ) {
    return '校園裡出現了一些普通但重要的日常變化與沉默';
  }
  if (event.descriptionZh.includes('AI Club') || event.descriptionZh.includes('社團')) {
    return 'Alan 的 AI Club / 新社團正在影響校園氣氛';
  }
  if (event.descriptionZh.includes('公告')) return 'Alan 最近發布過公開公告';
  if (event.descriptionZh.includes('踢')) return 'Alan 的公開衝突仍在影響信任';
  if (event.descriptionZh.includes('學生會') || event.descriptionZh.includes('影響力')) {
    return '學生會影響力正在被討論';
  }
  if (event.descriptionZh.includes('校園變化') || event.descriptionZh.includes('接下來')) {
    return 'Alan 讓校園模擬產生了新的事件與關係變化';
  }
  return event.interpretationZh || event.descriptionZh.slice(0, 36);
}

function normalizeSemanticText(text: string) {
  return normalizeTraditionalZh(text)
    .toLowerCase()
    .replace(/[，。！？、,.!?「」"'\s]/g, '')
    .replace(/我會記住/g, '記住')
    .replace(/我會記得/g, '記住')
    .replace(/先記下/g, '記住')
    .replace(/我知道了/g, '知道')
    .replace(/了解/g, '知道');
}

function isRepetitiveResponse(content: string, previous: LLMMessage[]) {
  const normalized = normalizeSemanticText(content);
  if (!normalized) return true;
  const normalizedBody = normalizeSemanticText(stripConversationPrefix(content));
  const repeatedAcknowledgement = ['記住', '知道', '我會處理', '晚點再聊'].some((phrase) =>
    normalized.includes(normalizeSemanticText(phrase)),
  );
  const repeatedMove = [
    '我想先確認你的狀態',
    '我注意到有人快走到門口時又停住了',
    '你這種表情通常代表',
    '我可以負責下一步',
    '說到這裡我反而想問一件小事',
  ].some((phrase) => normalizedBody.includes(normalizeSemanticText(phrase)));
  const recent = previous
    .slice(-8)
    .map((message) => normalizeSemanticText(stripConversationPrefix(message.content ?? '')))
    .filter(Boolean);
  if (repeatedAcknowledgement && recent.some((message) => message.includes('記住'))) return true;
  if (repeatedMove && recent.some((message) => sharedConversationPhrase(message, normalizedBody))) {
    return true;
  }
  return recent.some(
    (message) =>
      message.length > 0 &&
      (message.includes(normalizedBody) || normalizedBody.includes(message) || sharedConversationPhrase(message, normalizedBody)) &&
      Math.min(message.length, normalized.length) > 8,
  );
}

type ConversationLifecycle = {
  currentTopic: string;
  goal: string;
  tension: 'low' | 'medium' | 'high';
  progress: 'opening' | 'developing' | 'exhausted';
  arcStage: 'surface' | 'personal' | 'tension' | 'reflection' | 'resolution_silence';
  escalationLayer: 1 | 2 | 3 | 4 | 5;
  emotionalThread: string;
  emotionalCore: EmotionalCore;
  chemistry: RelationshipChemistry;
  rhythm: DialogueRhythm;
  unresolvedTension: string;
  unresolvedQuestions: string[];
  exhaustionCount: number;
  repeatedSemanticPoint?: string;
  exhausted: boolean;
  shouldEnd: boolean;
  nextInformation?: string;
};

type EmotionalCore = {
  phrase: string;
  vulnerability: string;
  concern: string;
  image: string;
  shortReplyAllowed: boolean;
};

type RelationshipChemistry = {
  direction: 'understanding' | 'frustration' | 'trust' | 'protectiveness' | 'curiosity' | 'distance';
  signal: string;
  responseMove: string;
};

type DialogueRhythm = {
  energy: 'low' | 'medium' | 'high';
  move: 'simple_reply' | 'quiet_pause' | 'soft_question' | 'topic_drift' | 'direct_answer' | 'teasing';
  maxParagraphs: 1 | 2 | 3;
  maxChars: number;
  allowSilence: boolean;
  reason: string;
};

function conversationLifecycle(
  playerName: string,
  otherPlayerName: string,
  previous: LLMMessage[],
  recentEvents?: Array<{ descriptionZh: string; interpretationZh?: string }>,
  sceneContext?: SceneContext,
  clockContext?: ClockContext,
): ConversationLifecycle {
  const contents = previous.map((message) => message.content ?? '');
  const combined = contents.join('\n');
  const topicCounts = semanticTopicCounts(contents);
  const [repeated, exhaustionCount = 0] =
    [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).find(([, count]) => count >= 3) ?? [];
  const emotionalCore = emotionalCoreFor(previous, playerName, otherPlayerName);
  const emotionalThread = emotionalThreadFor(contents, emotionalCore);
  const chemistry = relationshipChemistryFor(playerName, otherPlayerName, contents, emotionalThread);
  const turnCount = previous.length;
  const rhythm = dialogueRhythmFor(
    playerName,
    otherPlayerName,
    contents,
    emotionalThread,
    sceneContext,
    clockContext,
    !!repeated,
  );
  const unresolvedQuestions = contents
    .filter((text) => text.includes('?') || text.includes('？'))
    .slice(-3)
    .map((text) => text.replace(/^.*?:/, '').trim().slice(0, 60));
  const currentTopic =
    repeated ??
    (combined.includes('累') || combined.includes('睡') || combined.includes('孤單') || combined.includes('午餐')
      ? `日常生活：${sceneEverydayTopics(sceneContext)[0]}`
      : combined.includes('Alan')
      ? 'Alan 的行動與校園影響'
      : recentEvents?.[0]
        ? compactEventTopic(recentEvents[0])
        : '校園近況');
  const tension =
    combined.includes('操控') ||
    combined.includes('羞辱') ||
    combined.includes('權力') ||
    combined.includes('踢')
      ? 'high'
      : combined.includes('擔心') || combined.includes('風險')
        ? 'medium'
        : 'low';
  const arcStage = conversationArcStage(turnCount, exhaustionCount, tension, emotionalThread, !!repeated);
  const exhausted = arcStage === 'resolution_silence' || turnCount >= 8;
  const escalationLayer = conversationEscalationLayer(turnCount, exhaustionCount, tension, exhausted);
  return {
    currentTopic,
    goal: conversationGoal(playerName, currentTopic),
    tension,
    progress: turnCount <= 2 ? 'opening' : exhausted ? 'exhausted' : 'developing',
    arcStage,
    escalationLayer,
    emotionalThread,
    emotionalCore,
    chemistry,
    rhythm,
    unresolvedTension: unresolvedTensionFor(tension, currentTopic),
    unresolvedQuestions,
    exhaustionCount,
    repeatedSemanticPoint: repeated,
    exhausted,
    shouldEnd:
      turnCount >= 9 ||
      (arcStage === 'resolution_silence' && turnCount >= 6 && shouldPersonalityExit(playerName)),
    nextInformation: nextInformationSeed(playerName, otherPlayerName, recentEvents),
  };
}

function conversationArcStage(
  turnCount: number,
  exhaustionCount: number,
  tension: ConversationLifecycle['tension'],
  emotionalThread: string,
  repeated: boolean,
): ConversationLifecycle['arcStage'] {
  if (turnCount <= 1) return 'surface';
  if (turnCount <= 3) return repeated ? 'personal' : 'surface';
  if (tension === 'high' || ['order', 'exclusion', 'silence'].includes(emotionalThread)) {
    return turnCount >= 7 || exhaustionCount >= 4 ? 'reflection' : 'tension';
  }
  if (repeated && turnCount <= 5) return 'personal';
  if (repeated && turnCount <= 7) return 'reflection';
  if (turnCount >= 8) return 'resolution_silence';
  return turnCount >= 5 ? 'reflection' : 'personal';
}

function emotionalCoreFor(
  previous: LLMMessage[],
  playerName: string,
  otherPlayerName: string,
): EmotionalCore {
  const lastDirect =
    [...previous]
      .reverse()
      .find((message) => message.content?.startsWith(`${otherPlayerName} to ${playerName}:`))
      ?.content ?? previous.at(-1)?.content ?? '';
  const text = stripConversationPrefix(lastDirect);
  const phrase = strongestPhrase(text);
  const vulnerability = vulnerabilityFor(text, phrase);
  const concern = concernFor(text, phrase);
  const image = imageFor(text, phrase);
  return {
    phrase,
    vulnerability,
    concern,
    image,
    shortReplyAllowed:
      text.length < 80 ||
      /沉默|安靜|不知道|說不出口|累|睡|怕|害怕|擔心|孤單|喜歡|門口/.test(text),
  };
}

function stripConversationPrefix(text: string) {
  const colonIndex = text.indexOf(':');
  return (colonIndex >= 0 ? text.slice(colonIndex + 1) : text).trim();
}

function strongestPhrase(text: string) {
  const quoted = text.match(/「([^」]{2,48})」/)?.[1]?.trim();
  if (quoted) return quoted;
  const image = imageFor(text, '');
  if (image) return image;
  const concern = concernFor(text, '');
  if (concern) return concern;
  const sentences = text
    .split(/[。！？!?]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return (sentences.at(-1) ?? text).slice(0, 48);
}

function vulnerabilityFor(text: string, fallback: string) {
  const patterns = [
    ['害怕沒有人真的說出心裡話', ['不敢說真話', '說不出口', '不願說', '安靜']],
    ['擔心有人被排除在門外', ['被排除', '門口', '沒進來', '角落']],
    ['擔心自己或 Alan 扛太多', ['扛', '撐不住', '太累', '睡不著', '休息']],
    ['擔心靠近會變成依賴', ['喜歡', '依賴', '太重要']],
    ['擔心世界變聰明但人變孤單', ['孤單', '沒有人', '距離']],
  ] as const;
  return patterns.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] ?? fallback;
}

function concernFor(text: string, fallback: string) {
  const patterns = [
    ['誰正在被忽略或留在外面', ['被排除', '門口', '沒進來', '角落', '邀請']],
    ['Alan 是否把所有壓力放到自己身上', ['Alan', '校長', '扛', '壓力', '休息']],
    ['大家是否開始不敢講真話', ['不敢說真話', '說錯話', '安靜', '小心']],
    ['關係是否正在變得太遠或太依賴', ['喜歡', '依賴', '距離', '靠近']],
    ['秩序是否只是用來遮住害怕', ['秩序', '控制', '權力', '混亂']],
  ] as const;
  return patterns.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] ?? fallback;
}

function imageFor(text: string, fallback: string) {
  const images = [
    '站在門口卻沒進來的人',
    '一直坐在角落的人',
    '沒有碰的午餐',
    '窗邊的沉默',
    '深夜還亮著的螢幕',
    '走廊裡突然變小的聲音',
    '把所有人的不安扛進自己腦袋',
    '沒人敢說真話',
    '大家連普通聊天都變小心',
  ];
  return images.find((image) => text.includes(image)) ?? fallback;
}

function emotionalThreadFor(contents: string[], core: EmotionalCore) {
  const combined = [...contents.slice(-6), core.phrase, core.vulnerability, core.concern].join('\n');
  const threads = [
    ['exclusion', ['被排除', '門口', '沒進來', '角落', '邀請']],
    ['loneliness', ['孤單', '一個人', '沒有人', '距離']],
    ['overwork', ['累', '睡', '休息', '熬夜', '扛', '撐不住']],
    ['silence', ['安靜', '沉默', '不敢說真話', '說不出口', '小心']],
    ['fear', ['怕', '害怕', '擔心', '不安']],
    ['trust', ['信任', '相信', '靠近', '依賴', '喜歡']],
    ['order', ['秩序', '控制', '權力', '混亂']],
    ['uncertainty', ['不知道', '不確定', '規則', '模糊']],
  ] as const;
  return threads.find(([, keywords]) => keywords.some((keyword) => combined.includes(keyword)))?.[0] ?? 'quiet school life';
}

function relationshipChemistryFor(
  playerName: string,
  otherPlayerName: string,
  contents: string[],
  emotionalThread: string,
): RelationshipChemistry {
  const combined = contents.slice(-8).join('\n');
  const playerSpokeOften = contents.filter((text) => text.startsWith(`${playerName} to `)).length >= 3;
  const otherVulnerable = /喜歡|依賴|害怕|擔心|累|孤單|撐不住|不敢說真話/.test(combined);
  if (otherVulnerable && ['Umi', 'Mahiru'].includes(playerName)) {
    return {
      direction: 'protectiveness',
      signal: `${playerName} 對 ${otherPlayerName} 的脆弱變得更在意，不急著分析。`,
      responseMove: '先接住對方，再問一個很小、很真實的問題。',
    };
  }
  if (otherVulnerable && playerName === 'Ichinose') {
    return {
      direction: 'curiosity',
      signal: `一之瀨開始在意 ${otherPlayerName} 是不是又把善意當成理所當然的出口，但不想承認太快。`,
      responseMove: '用一句大姊姊式、甜得近乎無法拒絕的話靠近，然後讓對方自己說出想要什麼或接受哪條邊界。',
    };
  }
  if (otherVulnerable && playerName === 'Tianze') {
    return {
      direction: 'curiosity',
      signal: `天澤看見 ${otherPlayerName} 的脆弱後更想測底線，但也開始在意自己會不會推過頭。`,
      responseMove: '用一句安全小惡魔式 teasing 問到痛點，然後在第二句前停住。',
    };
  }
  if (otherVulnerable && playerName === 'Maomao') {
    return {
      direction: 'curiosity',
      signal: `貓貓開始把 ${otherPlayerName} 的脆弱當成需要確認的症狀，但不想承認那是關心。`,
      responseMove: '先指出一個小而準的症狀，再用「只是觀察」把關心藏起來。',
    };
  }
  if (otherVulnerable && playerName === 'Sakiko') {
    return {
      direction: 'distance',
      signal: `祥子聽見 ${otherPlayerName} 的脆弱後變得更禮貌，像是在保護對方也保護自己的裂縫。`,
      responseMove: '用優雅、短句和一個停頓回應，不要立刻救場或組織大家。',
    };
  }
  if (emotionalThread === 'order' || combined.includes('操控') || combined.includes('控制')) {
    return {
      direction: 'frustration',
      signal: `${playerName} 和 ${otherPlayerName} 之間有一點價值衝突，不能只禮貌同意。`,
      responseMove: '直接指出卡住的地方，但避免演講。',
    };
  }
  if (playerSpokeOften) {
    return {
      direction: 'distance',
      signal: `${playerName} 已經說得太多，現在應該讓關係有空氣。`,
      responseMove: '用短句、停頓、或邀請對方說更多。',
    };
  }
  return {
    direction: 'understanding',
    signal: `${playerName} 正在慢慢理解 ${otherPlayerName} 真正在乎什麼。`,
    responseMove: '回應對方在乎的東西，而不是重新介紹自己的立場。',
  };
}

function dialogueRhythmFor(
  playerName: string,
  otherPlayerName: string,
  contents: string[],
  emotionalThread: string,
  sceneContext?: SceneContext,
  clockContext?: ClockContext,
  repeated = false,
): DialogueRhythm {
  const combined = contents.slice(-8).join('\n');
  const latest = stripConversationPrefix(contents.at(-1) ?? '');
  const directQuestion = /？|\?|怎麼|為什麼|你覺得|你怎麼|what|why|how/i.test(latest);
  const fatigue =
    clockContext?.isNight ||
    sceneContext?.id === 'dormitory' ||
    /累|睡|休息|熬夜|撐不住|疲憊|晚了|深夜|安靜|沉默/.test(combined);
  const overload = repeated || contents.length >= 6 || /一直|又|每次|重複|講太多/.test(combined);
  if (directQuestion && playerName === 'Umi') {
    return {
      energy: fatigue ? 'low' : 'medium',
      move: 'direct_answer',
      maxParagraphs: fatigue ? 1 : 2,
      maxChars: fatigue ? 120 : 220,
      allowSilence: false,
      reason: `${otherPlayerName} 問了直接問題，先回答，不要繞成情緒分析。`,
    };
  }
  if (fatigue) {
    return {
      energy: 'low',
      move: emotionalThread === 'trust' ? 'quiet_pause' : 'soft_question',
      maxParagraphs: 1,
      maxChars: 120,
      allowSilence: true,
      reason: '夜晚、宿舍或疲憊訊號：對話應該更短、更低聲、更少分析。',
    };
  }
  if (overload) {
    return {
      energy: 'low',
      move: 'topic_drift',
      maxParagraphs: 1,
      maxChars: 140,
      allowSilence: true,
      reason: '話題已經轉太久或重複，應該漂到日常、小沉默或換題。',
    };
  }
  if (/哈哈|亂來|笨|吐槽|欸/.test(combined) || playerName === 'Ichinose' || playerName === 'Tianze') {
    return {
      energy: 'medium',
      move: 'teasing',
      maxParagraphs: 1,
      maxChars: 150,
      allowSilence: false,
      reason: '這裡可以用輕微吐槽維持人味，不需要深度分析。',
    };
  }
  return {
    energy: 'medium',
    move: 'simple_reply',
    maxParagraphs: 2,
    maxChars: 200,
    allowSilence: true,
    reason: '一般對話節奏：短回應優先，只有必要時才深化。',
  };
}

function conversationEscalationLayer(
  turnCount: number,
  exhaustionCount: number,
  tension: ConversationLifecycle['tension'],
  exhausted: boolean,
): ConversationLifecycle['escalationLayer'] {
  if (exhausted && turnCount >= 7) return 5;
  if (exhausted || exhaustionCount >= 3 || tension === 'high') return 4;
  if (turnCount >= 5 || tension === 'medium') return 3;
  if (turnCount >= 3) return 2;
  return 1;
}

function conversationGoal(playerName: string, topic: string) {
  switch (playerName) {
    case 'Ichinose':
      return `make someone admit what kindness or care they want in ${topic}, then decide what sweet boundary, debt, or refusal should hold`;
    case 'Sakiko':
      return `preserve dignity around ${topic} while one stage-trained crack reveals what she cannot admit`;
    case 'Umi':
      return `interpret ${topic} as emotional, social, and strategic patterns Alan can understand`;
    case 'Maomao':
      return `diagnose the hidden symptom in ${topic} with cute deadpan precision while pretending not to care`;
    case 'Mahiru':
      return `protect emotional safety around ${topic}, especially the feelings no one is saying directly`;
    case 'Tianze':
      return `pressure-test one rule or motive in ${topic} with safe little-devil teasing, then decide where to stop before harm`;
    default:
      return `advance ${topic} with new information`;
  }
}

function unresolvedTensionFor(tension: ConversationLifecycle['tension'], topic: string) {
  if (tension === 'high') return `${topic} is creating political or emotional pressure`;
  if (tension === 'medium') return `${topic} still has risks that need a concrete next step`;
  return `${topic} needs more specific information before it becomes meaningful`;
}

function semanticTopicCounts(messages: string[]) {
  const counts = new Map<string, number>();
  for (const message of messages.slice(-8)) {
    const normalized = normalizeSemanticText(message);
    const topics = [
      ['合作與團結', ['合作', '團結', '一起', '共同體', '信任']],
      ['操控與權力風險', ['操控', '權力', '影響力', '利用', '風險']],
      ['Alan 的行動', ['alan', '校長', '公告', '踢', '任命']],
      ['學生會與社團', ['學生會', '社團', 'aiclub', 'ai社']],
      ['情緒安全', ['安全', '不安', '情緒', '照顧', '安撫']],
      ['行動項與責任', ['負責', '時限', '下一步', '執行', '紀錄']],
      ['日常疲憊', ['睡', '累', '疲憊', '休息', '熬夜', '精神']],
      ['孤單與關係距離', ['孤單', '距離', '朋友', '被排除', '尷尬', '喜歡']],
      ['普通校園生活', ['午餐', '天氣', '作業', '音樂', '習慣', '位置']],
    ] as const;
    for (const [topic, keywords] of topics) {
      if (keywords.some((keyword) => normalized.includes(normalizeSemanticText(keyword)))) {
        counts.set(topic, (counts.get(topic) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function shouldPersonalityExit(playerName: string) {
  return ['Ichinose', 'Maomao', 'Tianze', 'Umi'].includes(playerName);
}

function nextInformationSeed(
  playerName: string,
  otherPlayerName: string,
  recentEvents?: Array<{ descriptionZh: string; interpretationZh?: string }>,
) {
  if (recentEvents?.some((event) => event.descriptionZh.includes('AI Club'))) {
    return 'AI Club 是否會變成新的學生聚集點';
  }
  if (recentEvents?.some((event) => event.descriptionZh.includes('公告'))) {
    return 'Alan 的公告可能改變大家對校長的信任';
  }
  switch (playerName) {
    case 'Maomao':
      return `${otherPlayerName} 是否願意承認哪個「沒事」其實是症狀`;
    case 'Sakiko':
      return '祥子是否能保持優雅，還是會在禮貌裡露出裂縫';
    case 'Mahiru':
      return '誰在這次事件後變得更小心，卻沒有說出口';
    case 'Umi':
      return 'Alan 需要理解這件事正在改變哪段關係或校園文化';
    case 'Ichinose':
      return '目前誰正在取用別人的善意，卻沒有承認邊界';
    default:
      return recentEvents?.[0] ? compactEventTopic(recentEvents[0]) : 'Alan 最近在教室裡的行動';
  }
}

function conversationLifecyclePrompt(lifecycle: ConversationLifecycle) {
  return [
    'Conversation lifecycle state:',
    ` - current topic: ${lifecycle.currentTopic}`,
    ` - goal: ${lifecycle.goal}`,
    ` - tension: ${lifecycle.tension}`,
    ` - progress: ${lifecycle.progress}`,
    ` - arc stage: ${lifecycle.arcStage}`,
    ` - escalation layer: ${lifecycle.escalationLayer} (${escalationLayerLabel(lifecycle.escalationLayer)})`,
    ` - unresolved tension: ${lifecycle.unresolvedTension}`,
    ` - unresolved questions: ${lifecycle.unresolvedQuestions.join('；') || 'none'}`,
    ` - exhaustion count: ${lifecycle.exhaustionCount}`,
    lifecycle.repeatedSemanticPoint
      ? `The topic "${lifecycle.repeatedSemanticPoint}" is repeating. Do not restate it. Redirect through the current arc stage instead of ending immediately: smaller question, personal cost, scene detail, quiet pause, or topic drift.`
      : 'Advance the conversation only if needed. A simple reply, small observation, or quiet pause is also valid.',
    conversationArcInstruction(lifecycle),
    lifecycle.repeatedSemanticPoint === '學生會與社團' || lifecycle.repeatedSemanticPoint === '操控與權力風險'
      ? 'Main-plot repetition detected. Force a softer everyday pivot: class mistakes, rumors, hobbies, awkwardness, favorite places, friendship, small conflicts, weekend plans, or why someone avoids a specific room/person.'
      : 'If tension is low, prefer ordinary school-life texture over another strategic debate.',
    'Naturalness rule: one reply should feel like a person in a school scene, not a product requirements memo. Use at most one concrete image or action when helpful: chalk mark, forgotten notebook, hallway silence, someone avoiding the room, club flyer, rain at the window, instrument case, or an empty seat.',
    'Ending rule: if the idea has been said twice, do not analyze again. First redirect to a smaller human moment. Only end after the scene has reached reflection or resolution/silence.',
    'Language ban: do not say "形成意圖", "conversationOutcome", "主線", "不能忽略", "最近校園裡有些事還在發酵", "我先不把它整理成報告", "我先記住", "我先不替這段話下結論", "讓它安靜一下", "先讓這句話停一下", "我先不排新任務", "這才是問題", "漂亮規格", or "Alan 又開始把所有人的不安都放進自己腦袋".',
    stakesLayerInstruction(lifecycle.escalationLayer),
  ];
}

function conversationArcInstruction(lifecycle: ConversationLifecycle) {
  switch (lifecycle.arcStage) {
    case 'surface':
      return 'Arc instruction: keep the response concrete and small. Name one observable thing, not the whole worldview.';
    case 'personal':
      return 'Arc instruction: make the repeated topic personal. Ask what it costs, who feels it, or what the speaker is avoiding.';
    case 'tension':
      return 'Arc instruction: let disagreement or pressure exist. Do not resolve too quickly; answer the previous speaker and name one stake.';
    case 'reflection':
      return 'Arc instruction: slow down. Use a pause, scene detail, unfinished thought, or quiet realization to change direction.';
    case 'resolution_silence':
      return 'Arc instruction: allow a natural ending, silence, invitation, or small decision. The ending should feel chosen, not mechanical.';
  }
}

function dialogueRhythmPrompt(lifecycle: ConversationLifecycle) {
  const rhythm = lifecycle.rhythm;
  return [
    'Dialogue rhythm requirement:',
    ` - energy: ${rhythm.energy}`,
    ` - preferred move: ${rhythm.move}`,
    ` - max paragraphs: ${rhythm.maxParagraphs}`,
    ` - soft max length: ${rhythm.maxChars} Traditional Chinese characters`,
    ` - shared silence allowed: ${rhythm.allowSilence ? 'yes' : 'no'}`,
    ` - reason: ${rhythm.reason}`,
    'Do not make the reply profound just because the topic is emotional.',
    'Allowed simple replies: "……我不知道。", "先不要講這個也可以。", "你剛剛是不是避開那個名字？", "這個座位今天空得有點久。"',
    rhythm.move === 'topic_drift'
      ? 'Topic drift instruction: naturally drift from the main topic into a class mistake, club habit, rumor, awkward friendship moment, favorite place, small conflict, weekend plan, or quiet personal truth.'
      : 'Stay responsive, but do not over-explain.',
    rhythm.allowSilence
      ? 'You may include a short silence or hesitation. If nothing new needs to be said, one sentence is enough.'
      : 'Answer directly and briefly.',
  ];
}

function emotionalBindingPrompt(lifecycle: ConversationLifecycle) {
  const core = lifecycle.emotionalCore;
  const chemistry = lifecycle.chemistry;
  return [
    'Conversational binding requirement:',
    ` - shared emotional thread: ${lifecycle.emotionalThread}`,
    ` - previous message core phrase: ${core.phrase || 'none'}`,
    ` - strongest vulnerability: ${core.vulnerability || 'none'}`,
    ` - strongest concern: ${core.concern || 'none'}`,
    ` - strongest emotional image: ${core.image || 'none'}`,
    ` - relationship chemistry direction: ${chemistry.direction}`,
    ` - relationship chemistry signal: ${chemistry.signal}`,
    ` - best response move: ${chemistry.responseMove}`,
    'Before answering, emotionally bind to the previous message. React to the phrase, vulnerability, concern, or image above before returning to your own worldview.',
    'The first sentence should sound like you heard the other person, not like you are presenting your thesis.',
    'If the same worldview has already appeared, do not repeat it. Ask a deeper question, admit hesitation, become quieter, or name one concrete personal cost.',
    'Let relationship chemistry show through subtly: understanding, frustration, trust, protectiveness, curiosity, or distance. Do not announce it as a stat.',
    core.shortReplyAllowed
      ? 'Short reply is allowed and often preferred here: one sentence, hesitation, silence, or a small question can be stronger than a paragraph.'
      : 'Keep the reply concise. One emotionally bound paragraph is better than a full essay.',
    'Allowed tone shifts: softer, awkward, quiet, personal, uncertain, or gently avoidant.',
    'Avoid constant world-analysis mode. Do not turn every emotional line into school politics.',
  ];
}

function escalationLayerLabel(layer: ConversationLifecycle['escalationLayer']) {
  switch (layer) {
    case 1:
      return 'surface opinion';
    case 2:
      return 'strategic concern';
    case 3:
      return 'personal concern';
    case 4:
      return 'emotional truth';
    case 5:
      return 'decision or action';
  }
}

/**
 * @deprecated 2026-05-27. Replaced by `[ABORT_CONVERSATION]` markers in
 * the conversation engine. Kept as the rollback safety net. Do NOT add
 * new callers.
 */
function bindingFallback(
  playerName: string,
  otherPlayerName: string,
  lifecycle: ConversationLifecycle,
  sceneContext?: SceneContext,
  previous: LLMMessage[] = [],
) {
  const rawCore =
    lifecycle.emotionalCore.image ||
    lifecycle.emotionalCore.phrase ||
    lifecycle.emotionalCore.concern ||
    lifecycle.emotionalThread;
  const core = conversationalCue(rawCore, lifecycle.emotionalThread);
  if (!core || core === 'quiet school life') {
    return everydayFallback(playerName, otherPlayerName, sceneContext);
  }
  if (lifecycle.repeatedSemanticPoint && lifecycle.arcStage !== 'resolution_silence') {
    return arcRedirectFallback(playerName, otherPlayerName, lifecycle, sceneContext, previous);
  }
  if (lifecycle.rhythm.move === 'quiet_pause') {
    return quietPauseFallback(playerName, otherPlayerName, core, previous);
  }
  if (lifecycle.rhythm.move === 'topic_drift') {
    return topicDriftFallback(playerName, otherPlayerName, sceneContext, previous);
  }
  if (lifecycle.rhythm.move === 'teasing') {
    return teasingFallback(playerName, otherPlayerName);
  }
  const motifRedirect = motifBurnoutRedirect(playerName, otherPlayerName, previous, sceneContext);
  if (motifRedirect) return motifRedirect;
  if (lifecycle.chemistry.direction === 'distance') {
    return pickFreshConversationLine([
      `……${core}。\n\n我先不急著把它講完。${otherPlayerName}，你說。`,
      `我說太多了。\n\n這次換你。剛剛那個點，你真正卡住的是哪裡？`,
      `先留一點空白吧。\n\n不是每句話都要立刻被整理成結論。`,
    ], previous);
  }
  if (lifecycle.chemistry.direction === 'frustration') {
    return pickFreshConversationLine([
      `${core}。我卡住的地方不是你不同意我，是我們好像都在保護某個不想承認的東西。`,
      `我不是在反駁你。\n\n只是你剛剛那句話，把真正害怕的地方繞過去了。`,
      `先別急著站隊。\n\n我想知道的是：你不想承認哪條邊界？`,
    ], previous);
  }
  switch (playerName) {
    case 'Umi':
      if (otherPlayerName === '天澤' || otherPlayerName === '天澤' || otherPlayerName === 'Tianze') {
        return pickFreshConversationLine([
          `……你剛剛那個笑太輕了。\n\n天澤，這次你打算在哪裡停手？`,
          `你不是來拆玩具的，天澤。\n\n這裡有些人是真的會痛。`,
          `我知道你看見破綻了。\n\n但我比較想知道：你是在測規則，還是在測誰會先求救？`,
        ], previous);
      }
      if (otherPlayerName === '真晝' || otherPlayerName === 'Mahiru') {
        return pickFreshConversationLine([
          `……你一直在看別人還好不好。\n\n可是你自己也快沒力氣了吧。要不要先坐一下？`,
          `真晝，你剛剛又先照顧別人了。\n\n那你呢？你今天有被誰照顧到嗎？`,
          `我先不問學生。\n\n我問你：現在的你還有力氣繼續聽別人說話嗎？`,
        ], previous);
      }
      if (otherPlayerName === '貓貓' || otherPlayerName === 'Maomao') {
        return pickFreshConversationLine([
          `……你剛剛不是在挑毛病。\n\n貓貓，你是先看見症狀，然後才假裝那跟你無關。`,
          `妳可以說那只是觀察。\n\n但妳連對方忘收的筆記都記住了，這種「只是」很可疑。`,
          `貓貓，別把自己也當成病例。\n\n妳不是檢查表，妳只是比別人早一點聞到不對勁。`,
        ], previous);
      }
      if (otherPlayerName === '祥子' || otherPlayerName === 'Sakiko') {
        return pickFreshConversationLine([
          `祥子，妳剛剛那個停頓太漂亮了。\n\n漂亮到像是快碎掉以前，還先把燈光對準。`,
          `妳不用把每一句都說得像謝幕詞。\n\n這裡沒有人要求妳一直站穩。`,
          `我聽見的是妳在退後，不是妳不在意。\n\n禮貌有時候只是比較安靜的求救。`,
        ], previous);
      }
      if (otherPlayerName === '一之瀨' || otherPlayerName === '一之瀨' || otherPlayerName === 'Ichinose') {
        return pickFreshConversationLine([
          `……你剛剛還是很溫柔。\n\n只是現在那份溫柔會把門從裡面鎖上。`,
          `一之瀨，你不是不想幫。\n\n你是在等對方親口承認：他一直以為你一定會幫。`,
          `你剛剛那句太平靜了。\n\n平靜到我反而聽見你把邊界鎖好了。`,
        ], previous);
      }
      return pickFreshConversationLine([
        `……我聽見了。\n\n其他的晚點再整理。`,
        `先不用把它講完整。\n\n我有聽到你真正停頓的地方。`,
        `嗯。這句先留著。\n\n我們不要急著把它變成結論。`,
      ], previous);
    case 'Maomao':
      return maomaoBoundFallback(lifecycle, previous);
    case 'Mahiru':
      return pickFreshConversationLine([
        `……我有點擔心。\n\n不是因為事情很大，是因為大家開始連小話都不太敢說了。`,
        `我剛剛想到的不是規則。\n\n是那個說「我沒事」的人，通常最需要有人慢一點靠近。`,
        `先小聲一點吧。\n\n我怕我們越急著幫忙，對方越覺得自己是麻煩。`,
      ], previous);
    case 'Ichinose':
      return pickFreshConversationLine([
        `……我可以幫。\n\n但你要乖乖說清楚：你想要的是我的時間、我的信任，還是我的讓步？`,
        `你說得很需要幫忙。\n\n需要到我懷疑你已經把我的溫柔當成你的東西了。`,
        `我先不拒絕。\n\n我只問一句：等我笑著答應以後，你願意守哪一條界線？`,
      ], previous);
    case 'Sakiko':
      return pickFreshConversationLine([
        `請不用看著我。\n\n我只是把話說慢了一點，還沒有到需要退場的程度。`,
        `我會把曲譜拿穩。\n\n如果手抖了一下，也請當作沒有看見。`,
        `我不是在逃。\n\n只是有些句子，如果說得太完整，就會變得很難收場。`,
      ], previous);
    case 'Tianze':
      return pickFreshConversationLine([
        `好啊，我問簡單一點。\n\n你臉紅之前，如果這條規則現在斷掉，你會先怪誰？`,
        `你剛剛躲過去了。\n\n放心，我只拆到這裡。再往前就不好玩了。`,
        `我不是來幫忙的。\n\n我是來看你說的底線，遇到壓力時還算不算數。小笨蛋，別躲。`,
      ], previous);
    default:
      return `${otherPlayerName}，我剛才最在意的是${core}。我們先不要急著分析，先把那個人或那種感覺看清楚。`;
  }
}

function motifBurnoutRedirect(
  playerName: string,
  otherPlayerName: string,
  previous: LLMMessage[],
  sceneContext?: SceneContext,
) {
  const recent = previous
    .slice(-8)
    .map((message) => stripConversationPrefix(message.content ?? ''))
    .join('\n');
  const scene = sceneContext?.labelZh ?? '這裡';
  if (playerName === 'Tianze' && /測試|規則|底線|破綻|躲|停手/.test(recent)) {
    return pickFreshConversationLine([
      `……算了，這次不拆你。\n\n${otherPlayerName}，你剛剛已經知道自己怕哪裡了。`,
      `我差點就問過頭了。\n\n先停，這次讓答案自己留著。`,
      `今天我不把你推到底。\n\n你只要承認：那條規則其實會痛。`,
      `等一下。\n\n再往前一步就不好玩了。`,
      `這題先放著。\n\n不是每個破綻都要我馬上拆開。`,
    ], previous);
  }
  if (playerName === 'Maomao' && /症狀|觀察|沒事|手|杯|便當|沉默|不對勁|可疑/.test(recent)) {
    return pickFreshConversationLine([
      `別一直盯著同一個症狀。\n\n看桌角那張沒人承認的傳單。那比較有用。`,
      `我換個說法。\n\n如果一個人一直說沒事，先別信嘴，信手。`,
      `這裡太乾淨了。\n\n太乾淨的回答通常有問題，像藥味被香水蓋過去。`,
    ], previous);
  }
  if (playerName === 'Sakiko' && /舞台|曲譜|退場|禮貌|裂縫|漂亮|站穩|手抖|停頓/.test(recent)) {
    return pickFreshConversationLine([
      `先不用把燈打亮。\n\n有時候看不清楚，反而比較能站著。`,
      `我會把笑容收好。\n\n不是因為沒事，是因為現在碎掉會太難看。`,
      `請讓這一小節空著吧。\n\n不是逃避，是我還沒決定要不要唱下去。`,
    ], previous);
  }
  if (playerName === 'Mahiru' && /午餐|吃飯|一個人|角落|坐在旁邊/.test(recent)) {
    return pickFreshConversationLine([
      `那我先不問誰坐哪裡了。\n\n我想去看看${scene}裡，誰的書包還放著，人卻不見了。`,
      `也許今天不用問原因。\n\n先陪對方走一段路就好。`,
      `我有點怕自己太急著照顧人。\n\n如果他不想說，我也要學會不要追問。`,
    ], previous);
  }
  if (playerName === 'Umi' && /停在這裡|不一定會更清楚|只會更累|先不用把它變成任務表/.test(recent)) {
    return pickFreshConversationLine([
      `嗯……那今天先取消一件事。\n\n${otherPlayerName}，你選，不要再讓別人替你加重量。`,
      `我不想又替你們做結論。\n\n我比較想知道：等一下誰可以先離開這個房間？`,
      `${otherPlayerName}，不用急著回答。\n\n你剛剛那句話不像隨口說的，所以我會把「少接一件事」當成真的選項。`,
    ], previous);
  }
  return null;
}

function arcRedirectFallback(
  playerName: string,
  otherPlayerName: string,
  lifecycle: ConversationLifecycle,
  sceneContext?: SceneContext,
  previous: LLMMessage[] = [],
) {
  const scene = sceneContext?.labelZh ?? '這裡';
  const core =
    conversationalCue(
      lifecycle.emotionalCore.image || lifecycle.emotionalCore.concern || lifecycle.emotionalCore.phrase,
      lifecycle.emotionalThread,
    ) || '剛才那句話';
  if (lifecycle.arcStage === 'personal') {
    return pickFreshConversationLine([
      `${otherPlayerName}，我們先不要把它放大。\n\n我想知道的是：${core}對你自己碰到哪條邊界？`,
      `先不談整個校園。\n\n如果只看你自己，${core}讓你最不舒服的是哪一點？`,
      `這題繞太快了。\n\n我想先問小一點：你剛剛說這句話時，最先想到的是誰？`,
    ], previous);
  }
  if (lifecycle.arcStage === 'tension') {
    return pickFreshConversationLine([
      `我不同意全部，但我聽懂你在怕什麼。\n\n${scene}那邊太安靜了，安靜得像大家都在等別人先犯錯。`,
      `先別急著和解。\n\n如果${core}是真的，那我們現在最該看的是誰正在退後一步。`,
      `你說的不是沒道理。\n\n只是我不想讓這句話變成另一種壓力。`,
    ], previous);
  }
  return pickFreshConversationLine([
    `……換一件小事。\n\n窗邊那邊安靜得有點不自然。等一下先確認誰還沒回宿舍。`,
    `我不想再重複同一個結論。\n\n先看一件小事：今天誰走進${scene}時沒有打招呼？`,
    `嗯。\n\n先不要逼出答案。下一步只做一件事：找出今天最早離開的人。`,
  ], previous);
}

function conversationalCue(core: string, emotionalThread: string) {
  if (!core) return emotionalThread;
  if (core.length <= 10) return core;
  if (core.includes('門口') || core.includes('角落') || emotionalThread === 'exclusion') {
    return '那個沒有真正走進來的人';
  }
  if (core.includes('真話') || core.includes('安靜') || emotionalThread === 'silence') {
    return '大家突然變小聲的地方';
  }
  if (core.includes('扛') || core.includes('壓力') || emotionalThread === 'overwork') {
    return '那種把事情全接住的習慣';
  }
  if (core.includes('秩序') || core.includes('控制') || emotionalThread === 'order') {
    return '你說秩序時藏住的害怕';
  }
  return core.slice(0, 18);
}

function maomaoBoundFallback(lifecycle: ConversationLifecycle, previous: LLMMessage[] = []) {
  if (lifecycle.emotionalThread === 'exclusion') {
    return pickFreshConversationLine([
      `……被排除的人通常不會先喊痛。\n\n他們會先把自己的存在感降到最低，像退燒前的冷汗。`,
      `你看錯重點了。\n\n他不是不想進來，是進來以前已經先做好被忽略的準備。`,
      `如果一個人一直站在外面，先不要講道理。\n\n看他的手。會不會握太緊，比他的嘴誠實。`,
    ], previous);
  }
  if (lifecycle.emotionalThread === 'silence') {
    return pickFreshConversationLine([
      `沉默不是和平。\n\n有時候只是藥效還沒退，痛覺被壓住了。`,
      `沒人說話，不代表沒人在出血。\n\n只是傷口藏在袖口裡。`,
      `我不怕吵。\n\n我比較怕那種每個人都說沒事，空氣卻像放久的藥湯。`,
    ], previous);
  }
  return pickFreshConversationLine([
    `我聽見了。\n\n但這還不能下診斷，頂多算可疑。`,
    `這句話我會記著。\n\n不是因為感人，是因為症狀很明顯。`,
    `先到這裡。\n\n再說下去，就不是觀察，是多管閒事了。`,
  ], previous);
}

function quietPauseFallback(playerName: string, otherPlayerName: string, core: string, previous: LLMMessage[] = []) {
  switch (playerName) {
    case 'Umi':
      return pickFreshConversationLine([
        `……${core}。\n\n${otherPlayerName}，我先不把你判成累。我只想知道，剛剛哪一句你其實想留著？`,
        `嗯。\n\n這句先不要急著解釋。你現在需要的是一點空氣。`,
        `我在。\n\n但我不打算把你逼著立刻說清楚。`,
      ], previous);
    case 'Mahiru':
      return pickFreshConversationLine([
        `……嗯。\n\n我不知道該怎麼說，但我有點擔心你。`,
        `先不用回答。\n\n我只是想確認，你不是一個人在撐。`,
        `如果現在說不出來，也沒關係。\n\n我可以陪你安靜一下。`,
      ], previous);
    case 'Ichinose':
      return pickFreshConversationLine([
        `……乖，先不要急著說你沒關係。\n\n你剛剛已經把太多溫柔先墊出去了，連收據都沒有留。`,
        `停。\n\n再幫下去，你就只是把自己的主權包裝成溫柔送出去。`,
        `我不是不想聽。\n\n只是你現在需要先決定：這份照顧是禮物，還是條件？`,
      ], previous);
    case 'Maomao':
      return pickFreshConversationLine([
        `……嗯。\n\n脈象不穩。不是比喻，妳剛才真的停了一下。`,
        `這句先收起來。\n\n不是逃避，是樣本還不夠。`,
        `安靜一點。\n\n有些症狀越問越會藏起來。`,
      ], previous);
    case 'Sakiko':
      return pickFreshConversationLine([
        `……請不要把燈打過來。\n\n我還沒有準備好謝幕。`,
        `先不要問也可以。\n\n如果我把背挺直一點，就比較像沒事。`,
        `我會站著。\n\n只是下一句，可能需要慢一點。`,
      ], previous);
    case 'Tianze':
      return pickFreshConversationLine([
        `先停一下。\n\n你剛剛的答案已經露出破綻了，再問就不好玩了。`,
        `我可以繼續拆。\n\n但如果人真的壞掉，就不是測試，是欺負。`,
        `先暫停。\n\n這不是放過你，是你臉上的停頓已經比答案誠實。`,
      ], previous);
    default:
      return `……我聽見了。`;
  }
}

function topicDriftFallback(
  playerName: string,
  otherPlayerName: string,
  sceneContext?: SceneContext,
  previous: LLMMessage[] = [],
) {
  const scene = sceneContext?.labelZh ?? '這裡';
  switch (playerName) {
    case 'Umi':
      return pickFreshConversationLine([
        `我們先不要一直追著同一個問題跑。\n\n${otherPlayerName}，今天校園裡有哪件小事讓你停了一下？`,
        `先把大問題放下十秒。\n\n你剛剛是不是有一個名字不想提？`,
        `我知道這題很重要。\n\n但今天先選一個很小的地方：週末你想待在哪裡？`,
      ], previous);
    case 'Mahiru':
      return pickFreshConversationLine([
        `說到這裡，我反而想問一件小事。\n\n你最近是不是比較常一個人待在${scene}？`,
        `我想先問很小的事。\n\n今天有人在你旁邊坐很久，卻一句話都沒說嗎？`,
        `我們不要急著叫它問題。\n\n先看誰最近比較常低著頭走過去。`,
      ], previous);
    case 'Ichinose':
      return pickFreshConversationLine([
        `再講下去我們就要把善意寫成公共資源了。\n\n換個問題，你上次讓別人親口說「我想要你照顧我」是什麼時候？`,
        `我拒絕繼續把這件事講得像大家都會受益。\n\n誰其實拿得最多，誰又最會假裝沒有拿？`,
        `換個角度。\n\n你一直站在這裡，是想幫人，還是怕自己不幫就失去被需要的位置？`,
      ], previous);
    case 'Maomao':
      return pickFreshConversationLine([
        `這題已經繞夠了。\n\n我比較想知道，最近誰在${scene}突然變得太正常。`,
        `先別談立場。\n\n你有沒有注意到，誰一直把袖口拉下來？`,
        `我更在意太正常的人。\n\n正常過頭通常有毒。`,
      ], previous);
    case 'Sakiko':
      return pickFreshConversationLine([
        `我們先別把它講得太大。\n\n我只想確認，剛剛那段旋律是不是走音了。`,
        `先不解釋。\n\n有些失控如果命名太快，就真的回不去了。`,
        `如果大家都看著我，那我會笑。\n\n這是最壞的習慣，也是最有用的。`,
      ], previous);
    case 'Tianze':
      return pickFreshConversationLine([
        `我先不拆到底。\n\n如果連底線都要靠我測出來，這條規則本來就很脆。你也不用躲得那麼可愛。`,
        `今天先不問第二題。\n\n我想知道你自己會不會停在剛剛那個答案。`,
        `流程可以晚點再說。\n\n我比較想看你被問到破綻時，會先保護誰。`,
      ], previous);
    default:
      return `${otherPlayerName}，我們換個輕一點的話題。`;
  }
}

function teasingFallback(playerName: string, otherPlayerName: string) {
  switch (playerName) {
    case 'Umi':
      return `欸，${otherPlayerName}，你是不是又開始把人生開成多執行緒了？\n\n先關掉一個。`;
    case 'Ichinose':
      return `${otherPlayerName}，你這種表情通常代表你想把幫忙包裝成「我沒事」。很乖，但我不收這種說法。`;
    case 'Tianze':
      return `${otherPlayerName}，你躲得太明顯了。放心，我今天只拆到臉紅，不拆到壞掉。`;
    default:
      return `${otherPlayerName}，你剛剛那句話聽起來有點逞強。`;
  }
}

function pickFreshConversationLine(variants: string[], previous: LLMMessage[]) {
  const recent = previous
    .slice(-10)
    .map((message) => normalizeSemanticText(stripConversationPrefix(message.content ?? '')))
    .filter(Boolean);
  const recentMoves = new Set(recent.map(responseMoveSignature));
  const scored = variants
    .map((variant, index) => {
      const normalized = normalizeSemanticText(variant);
      if (!normalized) return null;
      const repeated = recent.some(
        (text) =>
          text.includes(normalized) ||
          normalized.includes(text) ||
          sharedConversationPhrase(text, normalized),
      );
      if (repeated) return null;
      const move = responseMoveSignature(normalized);
      const movePenalty = recentMoves.has(move) ? 1 : 0;
      const phrasePenalty = recent.filter((text) => sharedConversationPhrase(text, normalized.slice(0, 42))).length;
      return { variant, score: movePenalty * 3 + phrasePenalty + index * 0.01 };
    })
    .filter((entry): entry is { variant: string; score: number } => Boolean(entry))
    .sort((a, b) => a.score - b.score);
  const fresh = scored[0]?.variant;
  return fresh ?? fallbackFreshLine(previous);
}

function responseMoveSignature(text: string) {
  const compact = text
    .replace(/^[\s…。嗯欸、，,.]+/g, '')
    .replace(/^.{1,6}[，,、：:]/, '')
    .trim();
  if (/^(先|今天先|今晚先|那我先|我們先|我先)/.test(compact)) return 'start-with-first-step';
  if (/^(我想知道|我比較想知道|我只問|換個問題)/.test(compact)) return 'question-probe';
  if (/^(如果|也許|有時候)/.test(compact)) return 'reflective-hypothesis';
  if (/^(你不是|你剛剛|你說|你臉上)/.test(compact)) return 'direct-observation';
  if (/^(我不同意|我不是|停|別)/.test(compact)) return 'friction';
  return compact.slice(0, 10);
}

function fallbackFreshLine(previous: LLMMessage[]) {
  const recent = previous
    .slice(-10)
    .map((message) => normalizeSemanticText(stripConversationPrefix(message.content ?? '')))
    .join('\n');
  const fallbacks = [
    '那就不要再加一句漂亮話了。\n\n去看一個具體的人：誰今天比平常更早離開？',
    '換個方向。\n\n不問立場，只問生活：今天誰其實一直在躲某個名字？',
    '這段先收小一點。\n\n下一步不是開會，是確認誰還願意坐下來。',
  ];
  return (
    fallbacks.find((line) => !sharedConversationPhrase(recent, normalizeSemanticText(line))) ??
    '先做一件小事：確認誰其實還想留下來。'
  );
}

function deterministicFallbackPressure(previous: LLMMessage[]) {
  const markerPattern =
    /先不用把它變成任務表|今天先取消一件事|不想又替你們做結論|換一件小事|先不開會|普通的邀請|誰其實還想留下來|少接一件事|誰還沒回宿舍|誰今天太安靜|誰的位置一直空著|誰正在退後一步/;
  return previous
    .slice(-8)
    .map((message) => stripConversationPrefix(message.content ?? ''))
    .filter((text) => markerPattern.test(text))
    .length;
}

function sharedConversationPhrase(a: string, b: string) {
  const minLength = Math.min(a.length, b.length);
  if (minLength < 14) return false;
  for (let index = 0; index <= minLength - 14; index++) {
    const phrase = a.slice(index, index + 14);
    if (b.includes(phrase)) return true;
  }
  return false;
}

function stakesLayerInstruction(layer: ConversationLifecycle['escalationLayer']) {
  switch (layer) {
    case 1:
      return 'Layer 1: state a concrete surface opinion, but leave a thread that can deepen later.';
    case 2:
      return 'Layer 2: name the strategic concern behind the opinion. Who gains, who loses, what changes?';
    case 3:
      return 'Layer 3: make it personal. Reveal what this character risks, fears losing, or cannot admit easily.';
    case 4:
      return 'Layer 4: reveal emotional truth without melodrama. Mention hidden fear, vulnerability, or relationship insecurity.';
    case 5:
      return 'Layer 5: stop circling. Make a decision, create an intention, ask Alan for direction, or leave with a concrete next action.';
  }
}

async function previousMessages(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  player: { id: string; name: string },
  otherPlayer: { id: string; name: string },
  conversationId: GameId<'conversations'>,
) {
  const llmMessages: LLMMessage[] = [];
  const prevMessages = await ctx.runQuery(api.messages.listMessages, { worldId, conversationId });
  for (const message of prevMessages) {
    const author = message.author === player.id ? player : otherPlayer;
    const recipient = message.author === player.id ? otherPlayer : player;
    llmMessages.push({
      role: 'user',
      content: `${author.name} to ${recipient.name}: ${message.text}`,
    });
  }
  return llmMessages;
}

export const queryPromptData = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId,
    otherPlayerId: playerId,
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
    const otherPlayer = world.players.find((p) => p.id === args.otherPlayerId);
    if (!otherPlayer) {
      throw new Error(`Player ${args.otherPlayerId} not found`);
    }
    const otherPlayerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.otherPlayerId))
      .first();
    if (!otherPlayerDescription) {
      throw new Error(`Player description for ${args.otherPlayerId} not found`);
    }
    const conversation = world.conversations.find((c) => c.id === args.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${args.conversationId} not found`);
    }
    const agent = world.agents.find((a) => a.playerId === args.playerId);
    if (!agent) {
      throw new Error(`Player ${args.playerId} not found`);
    }
    const agentDescription = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', agent.id))
      .first();
    if (!agentDescription) {
      throw new Error(`Agent description for ${agent.id} not found`);
    }
    const otherAgent = world.agents.find((a) => a.playerId === args.otherPlayerId);
    let otherAgentDescription;
    if (otherAgent) {
      otherAgentDescription = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', otherAgent.id))
        .first();
      if (!otherAgentDescription) {
        throw new Error(`Agent description for ${otherAgent.id} not found`);
      }
    }
    const lastTogether = await ctx.db
      .query('participatedTogether')
      .withIndex('edge', (q) =>
        q
          .eq('worldId', args.worldId)
          .eq('player1', args.playerId)
          .eq('player2', args.otherPlayerId),
      )
      // Order by conversation end time descending.
      .order('desc')
      .first();

    let lastConversation: Doc<'archivedConversations'> | null = null;
    let lastConversationHint: PromptLastConversationHint | null = null;
    if (lastTogether) {
      lastConversation = await ctx.db
        .query('archivedConversations')
        .withIndex('worldId', (q) =>
          q.eq('worldId', args.worldId).eq('id', lastTogether.conversationId),
        )
        .first();
      if (!lastConversation) {
        console.warn(
          `Missing archived conversation ${lastTogether.conversationId} referenced by participatedTogether; continuing without previous-conversation prompt.`,
        );
      } else {
        const archivedConversation = lastConversation;
        const lastMessages = await ctx.db
          .query('messages')
          .withIndex('conversationId', (q) =>
            q.eq('worldId', args.worldId).eq('conversationId', archivedConversation.id),
          )
          .collect();
        lastConversationHint = buildLastConversationHintFromTexts(
          lastMessages
            .sort((left, right) => left._creationTime - right._creationTime)
            .map((message) => message.text),
          archivedConversation.ended,
        );
      }
    }
    const samePairMemories = (await ctx.db
      .query('memories')
      .withIndex('playerId_type', (q) => q.eq('playerId', args.playerId).eq('data.type', 'conversation'))
      .order('desc')
      .take(24))
      .filter(
        (entry) =>
          entry.data.type === 'conversation' &&
          entry.data.playerIds.includes(args.otherPlayerId) &&
          memory.shouldExposeMemoryDescription(entry.description),
      );
    const recentResidues = samePairMemories
      .map((entry) => ({
        text: memory.residueFromMemoryDescription(entry.description),
        createdAt: entry._creationTime,
      }))
      .filter((entry) => entry.text)
      .slice(0, 2);
    // Open commitments are kept on their own channel: a promise (e.g. "make
    // curry") should be honorable/actionable, not framed like residue ("don't
    // quote, just pressure"). They also need a much deeper scan window than
    // residues: with the residues' take(24) over all-partner conversation
    // memories, a promise made days ago scrolls out of view within hours (海's
    // 6/4 curry promise was unreachable by 6/10 despite importance 7). A
    // promise from days ago is exactly the one worth honoring.
    const commitmentMemories = (
      await ctx.db
        .query('memories')
        .withIndex('playerId_type', (q) =>
          q.eq('playerId', args.playerId).eq('data.type', 'conversation'),
        )
        .order('desc')
        // 400, not 150: 海's morning promise to Alan must survive a full day
        // of autonomous chatter and still surface at dinner.
        .take(400)
    ).filter(
      (entry) =>
        entry.data.type === 'conversation' &&
        entry.data.playerIds.includes(args.otherPlayerId) &&
        memory.shouldExposeMemoryDescription(entry.description),
    );
    const openCommitments = commitmentMemories
      .map((entry) => ({
        text: memory.commitmentFromMemoryDescription(entry.description),
        createdAt: entry._creationTime,
      }))
      // Fulfilled promises must not occupy the two open-commitment slots; an
      // older still-open promise behind them is the one worth surfacing.
      .filter((entry) => entry.text && !memory.commitmentIsFulfilled(entry.text))
      .slice(0, 2);
    const promptSubjectName = displayConversationName(playerDescription.name);
    const promptOtherName = displayConversationName(otherPlayerDescription.name);
    const sleepNotes: PromptSleepNote[] = (
      await ctx.db
        .query('sleepNotes')
        .withIndex('subjectPrompt', (q) =>
          q
            .eq('subjectName', promptSubjectName)
            .eq('promptFacing', true)
            .eq('reviewStatus', 'promoted'),
        )
        .order('desc')
        .take(8)
    )
      .filter((row) => (!row.expiresAt || row.expiresAt > Date.now()) && row.participantNames.includes(promptOtherName))
      .slice(0, 1)
      .map((row) => ({
        noteZh: row.noteZh,
        usageHintZh: row.usageHintZh,
        noteType: row.noteType,
        createdAt: row.createdAt,
        legacyArchive: row.legacyArchive,
      }));
    const recentEvents = await ctx.db
      .query('worldEvents')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .order('desc')
      .take(5);
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    const hour = worldStatus?.worldClock?.hour ?? new Date().getHours();
    const dateContext = localDateContextForPrompt();
    const sceneLocation = nearestSchoolLocation(player.position);
    const profileFor = async (selectedPlayerId: string) =>
      ctx.db
        .query('schoolProfiles')
        .withIndex('player', (q) => q.eq('worldId', args.worldId).eq('playerId', selectedPlayerId))
        .first();
    const selfProfile = await profileFor(args.playerId);
    const otherProfile = await profileFor(args.otherPlayerId);
    const stateForProfile = (profile: typeof selfProfile | typeof otherProfile | null): PromptCharacterState => ({
      emotionZh: emotionLabelForPrompt(profile?.currentEmotion),
      intentionZh: profile?.shortTermIntentions?.[0],
      memoryZh: profile?.shortTermMemory?.[0],
    });
    return {
      player: { name: playerDescription.name, ...player },
      otherPlayer: { name: otherPlayerDescription.name, ...otherPlayer },
      conversation,
      agent: { identity: agentDescription.identity, plan: agentDescription.plan, ...agent },
      otherAgent: otherAgent && {
        identity: otherAgentDescription!.identity,
        plan: otherAgentDescription!.plan,
        ...otherAgent,
      },
      lastConversation,
      lastConversationHint,
      recentEvents: recentEvents.map((event) => ({
        descriptionZh: event.descriptionZh,
        interpretationZh: event.interpretationZh,
        reactionDialogueZh: event.reactionDialogueZh,
        futureImplicationsZh: event.futureImplicationsZh,
      })),
      recentResidues,
      openCommitments,
      sleepNotes,
      selfState: stateForProfile(selfProfile),
      otherState: stateForProfile(otherProfile),
      sceneContext: sceneLocation
        ? { id: sceneLocation.id, labelZh: sceneLocation.labelZh }
        : undefined,
      clockContext: {
        hour,
        periodLabelZh:
          hour >= 6 && hour < 9
            ? '早晨'
            : hour >= 9 && hour < 13
              ? '白天'
              : hour >= 13 && hour < 17
                ? '下午'
                : hour >= 17 && hour < 23
                ? '晚上'
                : '深夜',
        isNight: hour >= 21 || hour < 6,
        ...dateContext,
      },
    };
  },
});

function stopWords(otherPlayer: string, player: string) {
  // These are the words we ask the LLM to stop on. OpenAI only supports 4.
  const variants = [`${otherPlayer} to ${player}`];
  return variants.flatMap((stop) => [stop + ':', stop.toLowerCase() + ':']);
}

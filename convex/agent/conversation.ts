import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';
import { ActionCtx, internalQuery } from '../_generated/server';
import { LLMMessage, chatCompletion } from '../util/llm';
import * as memory from './memory';
import { api, internal } from '../_generated/api';
import * as embeddingsCache from './embeddingsCache';
import { GameId, conversationId, playerId } from '../aiTown/ids';
import { NUM_MEMORIES_TO_SEARCH } from '../constants';
import { nearestSchoolLocation } from '../../data/schoolLocations';
import { formativeMemoriesForName, giisProfileForName } from '../../data/giisProfiles';
import {
  characterSoulPolicyViolation,
  characterSoulProviderGuard,
  defaultCharacterSoulModel,
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
const CORE_CONVERSATION_CHARACTERS = new Set(['Umi', 'CaoCao', 'Mai']);
const CONVERSATION_NAME_ALIASES = [
  'Alan',
  'Umi',
  '海',
  '朝凪海',
  'Asuna',
  '明日奈',
  '結城明日奈',
  'Mai',
  '麻衣',
  '櫻島麻衣',
  'Mahiru',
  'Mahiru Shiina',
  '真晝',
  '椎名真晝',
  'CaoCao',
  'Cao Cao',
  '曹操',
  'Liu Bei',
  'LiuBei',
  '劉備',
];

function logGiisTiming(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  console.log('[GIIS timing]', payload);
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

function autonomousConversationLLMEnabled() {
  return process.env.ENABLE_AUTONOMOUS_CONVERSATION_LLM === 'true' ||
    process.env.AUTONOMOUS_CONVERSATION_LLM === 'true';
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

export async function startConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { player, otherPlayer, agent, otherAgent, lastConversation, recentEvents, recentResidues, selfState, otherState, sceneContext, clockContext } =
    await ctx.runQuery(selfInternal.queryPromptData, {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    });
  const companionMode = isCompanionChat(player.name, otherPlayer.name);
  const humanInConversation = Boolean(player.human || otherPlayer.human);
  if (!humanInConversation && !autonomousConversationLLMEnabledFor(player.name, otherPlayer.name)) {
    return initiativeFallback(player.name, otherPlayer.name, 'start', recentEvents?.[0]?.descriptionZh, sceneContext);
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
        recentEvents,
        recentResidues,
        selfState,
        otherState,
        sceneContext,
        clockContext,
      })
    : [
        `You are ${player.name}, and you just started a conversation with ${otherPlayer.name}.`,
        `You are in GIIS Underworld, a minimal AI school simulation. Always speak in Traditional Chinese.`,
        ...agentPrompts(otherPlayer, agent, otherAgent ?? null),
        ...characterSoulPrompt(player.name, otherPlayer.name),
        ...previousConversationPrompt(otherPlayer, lastConversation),
        ...(companionMode ? companionChatPrompt('start') : recentEventsPrompt(recentEvents)),
        ...relatedMemoriesPrompt(memories),
        ...everydayLifePrompt(player.name, otherPlayer.name, sceneContext, clockContext),
        ...singlePurposeConversationPrompt(player.name, otherPlayer.name, sceneContext),
      ];
  if (memoryWithOtherPlayer) {
    prompt.push(
      `Be sure to include some detail or question about a previous conversation in your greeting.`,
    );
  }
  const lastPrompt = `${player.name} to ${otherPlayer.name}:`;
  if (!pilotPair) prompt.push(lastPrompt);
  const companionCloud = companionMode && companionCloudEnabled();
  const humanCloud = humanInConversation && humanConversationCloudEnabled();
  const cloudConversation = Boolean(pilotPair) || companionCloud || humanCloud;
  const tuning = conversationGenerationTuning(player.name, Boolean(pilotPair), cloudConversation);
  const policyAbort = cloudConversation ? characterSoulPolicyAbortReason(tuning.model) : null;
  if (policyAbort) return `[ABORT_CONVERSATION] ${policyAbort}`;

  const content = await safeConversationCompletion(
    {
      messages: [
        {
          role: 'system',
          content: prompt.join('\n'),
        },
      ],
      max_tokens: tuning.maxTokens,
      model: tuning.model,
      stop: stopWords(otherPlayer.name, player.name),
      timeoutMs: tuning.timeoutMs,
    },
    humanInConversation || cloudConversation
      ? '[ABORT_CONVERSATION] character-soul LLM unavailable'
      : companionMode
        ? companionFallback(player.name, otherPlayer.name, undefined, [])
        : initiativeFallback(player.name, otherPlayer.name, 'start', undefined, sceneContext),
    cloudConversation,
  );
  const trimmed = sanitizeConversationContent(
    trimContentPrefx(content, lastPrompt),
    companionMode,
    player.name,
    otherPlayer.name,
    undefined,
    [],
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
  const { player, otherPlayer, conversation, agent, otherAgent, recentEvents, recentResidues, selfState, otherState, sceneContext, clockContext } =
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
    const previous = await previousMessages(
      ctx,
      worldId,
      player,
      otherPlayer,
      conversation.id as GameId<'conversations'>,
    );
    const lifecycle = conversationLifecycle(player.name, otherPlayer.name, previous, recentEvents, sceneContext, clockContext);
    if (lifecycle.shouldEnd || deterministicFallbackPressure(previous) >= 3) {
      return `[LEAVE] ${actionableExit(player.name, otherPlayer.name, lifecycle)}`;
    }
    return repairWrongConversationAddressee(
      bindingFallback(player.name, otherPlayer.name, lifecycle, sceneContext, previous),
      player.name,
      otherPlayer.name,
    );
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
        selfState,
        otherState,
        sceneContext,
        clockContext,
      })
    : [
        `You are ${player.name}, and you're currently in a conversation with ${otherPlayer.name}.`,
        `The conversation started at ${started.toLocaleString()}. It's now ${now.toLocaleString()}.`,
        `You are in GIIS Underworld, a minimal AI school simulation. Always speak in Traditional Chinese.`,
        ...agentPrompts(otherPlayer, agent, otherAgent ?? null),
        ...characterSoulPrompt(player.name, otherPlayer.name),
        ...(companionMode ? companionChatPrompt('continue') : recentEventsPrompt(recentEvents)),
        ...relatedMemoriesPrompt(memories),
        ...everydayLifePrompt(player.name, otherPlayer.name, sceneContext, clockContext),
        `Below is the current chat history between you and ${otherPlayer.name}.`,
        `DO NOT greet them again. DO NOT merely acknowledge, promise to remember, or say the same thing in different words.`,
        companionMode
          ? `Respond as Alan's desktop companion: warm, direct, emotionally grounded, and practical. Ask exactly one focused follow-up question. Keep 2-5 short paragraphs.`
          : `If the conversation is stalling, shift topics by asking a concrete question, introducing a human observation, mentioning a memory, or naming a small personal cost.`,
        topicShiftPrompt(player.name, sceneContext, companionMode),
        `Rhythm check before answering: the reply may be short, awkward, quiet, tired, teasing, or unfinished. Do not force insight if a simple human response fits better.`,
        `Soul check before answering: include at most one of these if natural: a concrete school-life detail, a personal fear, a small hesitation, a cost, a quiet silence, or a decision to stop.`,
        `Do not sound like a meeting note. Avoid labels like "main plot", "conversationOutcome", "形成意圖", or repeated thesis statements.`,
        `Do not mirror the other person's last sentence. Refer to the feeling behind it, not the exact wording.`,
        `If an emotional image already appeared once in this conversation, do not reuse the same image again; choose a new concrete detail or become quieter.`,
        companionMode ? `Do not quote Alan's exact sentence unless it is necessary.` : `Your response should be brief and within 200 characters.`,
      ];

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
    return `[LEAVE] ${actionableExit(player.name, otherPlayer.name, lifecycle)}`;
  }
  if (!humanInConversation && deterministicFallbackPressure(previous) >= 3) {
    if (pilotPair) {
      return '[ABORT_CONVERSATION] pilot deterministic exit blocked';
    }
    return `[LEAVE] ${actionableExit(player.name, otherPlayer.name, lifecycle)}`;
  }
  const lastAlanInput = companionMode ? lastDirectMessageFrom(otherPlayer.name, previous) : undefined;
  const companionIntent = companionMode ? companionIntentFor(lastAlanInput ?? '') : undefined;
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
            ...(companionIntent ? companionIntentPrompt(companionIntent, lastAlanInput) : []),
          ].join('\n'),
    },
    ...(compactAutonomousPrompt ? previous.slice(pilotPair ? 0 : -4) : previous),
  ];
  const lastPrompt = pilotPair ? '請直接回一句。' : `${player.name} to ${otherPlayer.name}:`;
  llmMessages.push({ role: 'user', content: lastPrompt });

  const companionCloud = companionMode && companionCloudEnabled();
  const humanCloud = humanInConversation && humanConversationCloudEnabled();
  const cloudConversation = Boolean(pilotPair) || companionCloud || humanCloud;
  const tuning = conversationGenerationTuning(player.name, Boolean(pilotPair), cloudConversation);
  const policyAbort = cloudConversation ? characterSoulPolicyAbortReason(tuning.model) : null;
  if (policyAbort) return `[ABORT_CONVERSATION] ${policyAbort}`;
  const content = await safeConversationCompletion(
    {
      messages: llmMessages,
      max_tokens: tuning.maxTokens,
      model: tuning.model,
      stop: stopWords(otherPlayer.name, player.name),
      timeoutMs: tuning.timeoutMs,
    },
    humanInConversation || cloudConversation
      ? '[ABORT_CONVERSATION] character-soul LLM unavailable'
      : companionMode
        ? companionFallback(player.name, otherPlayer.name, lastAlanInput, previous)
        : initiativeFallback(
            player.name,
            otherPlayer.name,
            'continue',
            recentEvents?.[0]?.descriptionZh,
            sceneContext,
          ),
    cloudConversation,
  );
  const trimmed = sanitizeConversationContent(
    trimContentPrefx(content, lastPrompt),
    companionMode,
    player.name,
    otherPlayer.name,
    lastAlanInput,
    previous,
  );
  if (isRepetitiveResponse(trimmed, previous)) {
    if (pilotPair) {
      return '[ABORT_CONVERSATION] pilot repetitive response';
    }
    if (humanInConversation) {
      return '[ABORT_CONVERSATION] human conversation repetitive response';
    }
    const fallback = companionMode
      ? companionFallback(player.name, otherPlayer.name, lastAlanInput, previous)
      : bindingFallback(player.name, otherPlayer.name, lifecycle, sceneContext, previous);
    const repairedFallback = repairWrongConversationAddressee(fallback, player.name, otherPlayer.name);
    return lifecycle.shouldEnd && !humanInConversation
      ? `[LEAVE] ${actionableExit(player.name, otherPlayer.name, lifecycle)}`
      : repairedFallback;
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
    return personalityExit(player.name, otherPlayer.name, lifecycle);
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
    pilotPair
      ? `Character-soul pilot leave rule: answer in one plain spoken sentence, 36 Traditional Chinese characters or fewer. Do not summarize the relationship, do not say "謝謝你的溫柔", "稍後再回來", "保重", or "整理沉默". Use one concrete boundary, like putting down a pen, pausing, or writing one next step.`
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
  const humanCloud = humanInConversation && humanConversationCloudEnabled();
  const cloudConversation = Boolean(pilotPair) || humanCloud;
  const tuning = conversationGenerationTuning(player.name, Boolean(pilotPair), cloudConversation);
  const policyAbort = cloudConversation ? characterSoulPolicyAbortReason(tuning.model) : null;
  if (policyAbort) return `[ABORT_CONVERSATION] ${policyAbort}`;

  const content = await safeConversationCompletion(
    {
      messages: llmMessages,
      max_tokens: tuning.maxTokens,
      model: tuning.model,
      stop: stopWords(otherPlayer.name, player.name),
      timeoutMs: tuning.timeoutMs,
    },
    humanInConversation || cloudConversation
      ? '[ABORT_CONVERSATION] character-soul LLM unavailable'
      : personalityExit(player.name, otherPlayer.name, lifecycle),
    cloudConversation,
  );
  const trimmed = sanitizeConversationContent(
    trimContentPrefx(content, lastPrompt),
    false,
    player.name,
    otherPlayer.name,
    undefined,
    previous,
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
) {
  const start = Date.now();
  const promptChars = request.messages.reduce((sum, message) => sum + (message.content?.length ?? 0), 0);
  try {
    const { content } = pilotCloudAllowed && shouldUsePilotCloudCompletion(request)
      ? await pilotCloudCompletion(request)
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

function conversationGenerationTuning(playerName: string, pilotPair = false, cloudConversation = false) {
  const isCore = CORE_CONVERSATION_CHARACTERS.has(playerName);
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

function pilotBaseUrl() {
  return (process.env.UMI_MAHIRU_PILOT_BASE_URL ?? 'https://api.newcoin.top').replace(/\/+$/, '');
}

function openaiCompatibleModelName(model: string | undefined) {
  const configured = model || process.env.UMI_MAHIRU_PILOT_MODEL || 'qwen3-max';
  return configured.startsWith('qwen/') ? configured.slice('qwen/'.length) : configured;
}

async function pilotCloudCompletion(
  request: Parameters<typeof chatCompletion>[0],
): Promise<{ content: string; retries: number; ms: number }> {
  const provider = process.env.UMI_MAHIRU_PILOT_PROVIDER?.toLowerCase();
  const model = request.model ?? '';
  if (provider === 'gemini' || model === 'gemini' || model.startsWith('gemini/')) {
    return geminiPilotCompletion(request);
  }
  return openaiCompatiblePilotCompletion(request);
}

// OpenAI-compatible chat completion for the Umi/Mahiru pilot (e.g. Qwen via the
// newcoin.top proxy). Key/base/model all come from env; nothing is hardcoded.
async function openaiCompatiblePilotCompletion(
  request: Parameters<typeof chatCompletion>[0],
): Promise<{ content: string; retries: number; ms: number }> {
  const apiKey = pilotApiKey();
  if (!apiKey) {
    throw new Error(
      'UMI_MAHIRU_PILOT_PROVIDER=qwen requires UMI_MAHIRU_PILOT_API_KEY (optionally UMI_MAHIRU_PILOT_BASE_URL)',
    );
  }
  const guard = characterSoulProviderGuard();
  if (!guard.allowed) {
    throw new Error(guard.reason ?? 'characterSoul provider guard blocked the call');
  }
  recordCharacterSoulProviderAttempt();
  const start = Date.now();
  const body = {
    model: openaiCompatibleModelName(request.model),
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    max_tokens: Math.max(request.max_tokens ?? 96, 64),
    ...(request.stop ? { stop: request.stop } : {}),
  };
  const controller = request.timeoutMs ? new AbortController() : undefined;
  const timeout = controller
    ? setTimeout(
        () => controller.abort(`Qwen pilot completion timed out after ${request.timeoutMs}ms`),
        request.timeoutMs,
      )
    : undefined;
  let response: Response;
  try {
    response = await fetch(pilotBaseUrl() + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller?.signal,
      body: JSON.stringify(body),
    });
  } catch (error) {
    recordCharacterSoulProviderFailure();
    throw error;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
  if (!response.ok) {
    const error = await response.text();
    recordCharacterSoulProviderFailure();
    throw new Error(
      `Qwen pilot completion failed with code ${response.status}: ${error.slice(0, 500)}`,
    );
  }
  const json = (await response.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const content = json.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    recordCharacterSoulProviderFailure();
    throw new Error(
      `Qwen pilot completion returned no text; finishReason=${json.choices?.[0]?.finish_reason ?? 'unknown'}`,
    );
  }
  recordCharacterSoulProviderSuccess();
  return { content, retries: 0, ms: Date.now() - start };
}

async function geminiPilotCompletion(
  request: Parameters<typeof chatCompletion>[0],
): Promise<{ content: string; retries: number; ms: number }> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error('UMI_MAHIRU_PILOT_PROVIDER=gemini requires UMI_MAHIRU_PILOT_API_KEY or GEMINI_API_KEY');
  }
  const guard = characterSoulProviderGuard();
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
};

type PromptResidue = {
  text: string;
  createdAt: number;
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
  recentEvents,
  recentResidues,
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
  recentEvents?: PromptRecentEvent[];
  recentResidues?: PromptResidue[];
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
    `Your identity: ${clipPromptText(agent?.identity ?? personalLifeFragment(playerName), 150)}`,
    `Your immediate goal: ${clipPromptText(agent?.plan ?? conversationMicroPurpose(playerName, otherPlayerName, sceneContext), 140)}`,
    otherAgent ? `About ${displayConversationName(otherPlayerName)}: ${clipPromptText(otherAgent.identity, 120)}` : '',
    `Scene: ${sceneContext?.labelZh ?? '校園'}；time: ${clockContext?.periodLabelZh ?? 'unknown'}${clockContext?.isNight ? '，偏安靜' : ''}.`,
    `Small purpose: ${conversationMicroPurpose(playerName, otherPlayerName, sceneContext)}.`,
    ownSeed ? `Private seed: ${clipPromptText(ownSeed, 90)}` : '',
    otherSeed ? `${displayConversationName(otherPlayerName)} pressure: ${clipPromptText(otherSeed, 80)}` : '',
    recentEvents?.[0] ? `Background weather: ${clipPromptText(compactEventTopic(recentEvents[0]), 90)}.` : '',
    lastConversation ? `You have spoken before; open with continuity only if it sounds natural.` : '',
    'Do not summarize world state, write a strategy memo, or repeat campus-politics slogans.',
  ].filter(Boolean);
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
  selfState,
  otherState,
  sceneContext,
  clockContext,
}: {
  playerName: string;
  otherPlayerName: string;
  agent: PromptAgent;
  otherAgent: PromptAgent;
  started: Date;
  now: number;
  recentEvents?: PromptRecentEvent[];
  recentResidues?: PromptResidue[];
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
      selfState,
      otherState,
      sceneContext,
      clockContext,
      mode: 'continue',
    });
  }
  return [
    'conversationMode: autonomous_school_chat_compact',
    `You are ${displayConversationName(playerName)} continuing a conversation with ${displayConversationName(otherPlayerName)}.`,
    `The conversation started at ${started.toLocaleString()}; current time is ${new Date(now).toLocaleString()}.`,
    'Always speak in natural Traditional Chinese. Output only the spoken reply, no labels.',
    `Keep it brief: 1-2 sentences, under 140 Chinese characters.`,
    `Address ${displayConversationName(otherPlayerName)} only. Do not address Alan unless Alan is the listener.`,
    `Your identity: ${clipPromptText(agent?.identity ?? personalLifeFragment(playerName), 150)}`,
    `Your immediate goal: ${clipPromptText(agent?.plan ?? conversationMicroPurpose(playerName, otherPlayerName, sceneContext), 140)}`,
    otherAgent ? `About ${displayConversationName(otherPlayerName)}: ${clipPromptText(otherAgent.identity, 120)}` : '',
    `Scene: ${sceneContext?.labelZh ?? '校園'}；time: ${clockContext?.periodLabelZh ?? 'unknown'}${clockContext?.isNight ? '，偏安靜、低能量' : ''}.`,
    recentEvents?.[0] ? `Background weather: ${clipPromptText(compactEventTopic(recentEvents[0]), 90)}.` : '',
    'Do not greet again. Do not merely acknowledge. Add one concrete human response, question, refusal, or quiet ending.',
    'Do not sound like a meeting note. Avoid labels like "主線", "形成意圖", or "conversationOutcome".',
  ].filter(Boolean);
}

function characterSoulPilotPair(playerName: string, otherPlayerName: string) {
  if (umiMahiruPilotPair(playerName, otherPlayerName)) return true;
  if (process.env.SOUL_TRIAD_COLOCATION_PILOT !== 'true') return false;
  const names = new Set([displayConversationName(playerName), displayConversationName(otherPlayerName)]);
  const triadNames = new Set(['海', '真晝', '明日奈']);
  return names.size === 2 && [...names].every((name) => triadNames.has(name));
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
  selfState,
  otherState,
  sceneContext,
  clockContext,
  mode,
}: {
  playerName: string;
  otherPlayerName: string;
  agent: PromptAgent;
  otherAgent: PromptAgent;
  recentEvents?: PromptRecentEvent[];
  recentResidues?: PromptResidue[];
  selfState?: PromptCharacterState;
  otherState?: PromptCharacterState;
  sceneContext: SceneContext | undefined;
  clockContext: ClockContext | undefined;
  mode: 'start' | 'continue';
}) {
  const self = displayConversationName(playerName);
  const other = displayConversationName(otherPlayerName);
  const ownProfile = giisProfileForName(playerName);
  const otherProfile = giisProfileForName(otherPlayerName);
  const ownMemories = relevantSoulMemories(playerName, otherPlayerName, recentEvents);
  const otherMemories = relevantSoulMemories(otherPlayerName, playerName, recentEvents).slice(0, 2);
  const residuePrompt = residuePromptLines(recentResidues, other);
  const statePrompt = characterStatePromptLines(self, other, selfState, otherState);
  const relationship = relationshipSummary(ownProfile?.initialRelationships[otherPlayerName]);
  const dailyState = umiMahiruDailyState(self, recentEvents, clockContext);
  const unresolvedMemory = umiMahiruUnresolvedMemory(self, recentEvents, ownMemories);
  const stance =
    self === '海'
      ? `海的回覆要像助理校長兼親近同伴：先接住${other}的狀態，再推進一個小小的人性問題。`
      : self === '真晝'
        ? '真晝的回覆要像情感穩定器：可以承認自己的狀態，也可以溫柔地照顧對方，而不是只反問。'
        : '明日奈的回覆要像可靠但有重量的執行者：給出一個可執行下一步，但不要用清單蓋掉人的疲憊。';
  const relationshipDirection =
    self === '海'
      ? '關係方向：海常把自己藏在有用、整理、提醒 Alan 裡；面對真晝時，可以短暫承認自己也會累，但不要演講。'
      : self === '真晝'
        ? '關係方向：真晝要能看見對方本人，不只看學生和 Alan；如果對方又把話題轉去責任，溫柔地把問題帶回人。'
        : other === '海'
          ? '關係方向：明日奈尊重海替 Alan 整理世界，但要看見這份可靠也在消耗海；她可以提出一個小交接，讓海不用獨自扛。'
          : '關係方向：明日奈尊重真晝的照顧，但要學會 care 不是拖慢行動；她可以把照顧變成不傷人的下一步。';
  const emotionalIdentity = soulDifferentiationIdentity(self);
  const antiEchoIdentityRule =
    `差異規則：如果你和${other}情緒同向，也不能重用對方的核心短句、同一個動作、同一種安慰節奏或同一個比喻。` +
    '同樣是在乎，海要整理負擔，真晝要留下陪伴，明日奈要承認重量後做一個小動作。';
  const hardLocalPriority =
    self === '真晝'
      ? '硬規則 / Mahiru：第一句一定要先看見對方本人——呼吸、肩膀、語速、輸入頻率、站姿或手上的東西——不能用 Alan、學生、世界、系統、資料、文明、AI 社、效率、智能當開頭或主詞。'
      : self === '海'
        ? '硬規則 / Umi：把話題帶回 Alan、劉備、簡報或明天，是你的盔甲，可以出現，但不能每一句都這樣，也不能整句只談 Alan/學生/世界。當對方指名你本人（嘆氣、肩膀、手、語速、被當成工具的感覺）時，你至少要有一句完全停在自己身上：不接 Alan/劉備/簡報/明天，只說一句此刻真實的狀態，或留一個停頓。被照顧的那一句，尤其不准再尾隨任務或「明天再說」。'
        : '硬規則 / Asuna：你可以整理下一步，但只能給一個最小行動；同一句必須承認誰不該獨自承擔。不要把對方的疲憊改寫成 checklist，也不要把「我來處理」當作唯一價值。';
  const concreteBehaviorRule =
    self === '真晝'
      ? '具體動作：情緒可以影響你的安靜、靠近、停頓或可用程度，但台詞裡不要用「我往前一步」「我放低聲音」這種第一人稱動作敘述；把它轉成真正會說出口的話。'
      : self === '海'
        ? '具體動作：情緒可以讓你少講、停頓、縮短簡報或少接一件事，但台詞裡不要用「我合上筆電」「我放下杯子」「我靠回椅背」這種第一人稱動作敘述；把它轉成真正會說出口的話。'
        : '具體動作：情緒可以讓你延後一項、把負責人改成兩個人、或少接一件事，但台詞裡不要用「我拿起筆」「我把文件分掉」這種第一人稱動作敘述；不要把整段變成流程表。';
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
        : '角色缺口 / Asuna：情緒會太快變成行動；過載時聲音偏平，求助可以很不自然。不要固定說「我又想把它拆成任務」；同一個傾向要換成關掉排程、不開 checklist、停止新增、把筆放著、或請別人接一小段。';
  const surfaceDiversityRule =
    '表面多樣性：保留情緒傾向，不保留口頭禪。同一個洞察如果剛說過，就不要再直接說；改成更短、更日常、更笨拙，或乾脆讓它變成少接一件事、沉默、停頓、換話題。';
  const intraAuthorSloganRule =
    self === '明日奈'
      ? '作者內防口號 / Asuna：如果你已經說過任務、清單、排表、下一步或「我來」，下一句不要再用同一組詞。改說關掉一件事、把筆放著、讓別人接一段、或直接說「等一下」。'
      : self === '海'
        ? '作者內防口號 / Umi：如果你已經提過 Alan、簡報、明天或整理，下一句不要再用同一組詞。改成一個很小的停頓、生活問題、或少接一件事。'
        : '作者內防口號 / Mahiru：如果你已經說過休息、坐一下、還好嗎或不急，下一句不要再用同一組詞。改成安靜、吃飯、外套、茶、或不催。';
  const bindingRule = mode === 'continue'
    ? '鬆綁規則：可以呼應對方上一句的一個具體詞，也可以停一下、答得太實際、岔開到一個小物件或小任務。不要每句都「接住」對方的情緒；三句裡至少要有一句不直接命名心理，只用角色自己的方式留下反應。不要照抄對方核心短句，尤其不要重複「其實就是」「那條」「誰都不動」「先坐五分鐘」這種句型。關心要同向但形狀不同：海整理一件小事或突然問吃飯，真晝可以只回「嗯」或不催，明日奈可以短、鈍、先做一個小交接。'
    : '開場規則：不要假裝對方剛剛說過話；只從眼前看見的一個狀態、今天殘留的一件事、或自己手上的一個小動作開始。';
  return [
    'conversationMode: character_soul_triad_pilot',
    `你是${self}，正在${sceneContext?.labelZh ?? '校園'}和${other}說話。海是人的名字，不是海邊或海洋。`,
    '只用自然繁體中文一句，45字內。只輸出口語台詞，不要標籤。',
    `Scene/time: ${sceneContext?.labelZh ?? '校園'}；${clockContext?.periodLabelZh ?? 'unknown'}${clockContext?.isNight ? '，偏安靜、低能量' : ''}.`,
    `Public self / role：${clipPromptText(ownProfile?.role ?? agent?.identity ?? personalLifeFragment(playerName), 120)}；${clipPromptText(ownProfile?.persona ?? '', 160)}`,
    `Private self：${ownProfile ? clipPromptText(`${ownProfile.stakes.hiddenFear} ${ownProfile.stakes.emotionalVulnerability}`, 180) : clipPromptText(agent?.plan ?? personalLifeFragment(playerName), 160)}`,
    `Daily state：${dailyState}`,
    ...statePrompt,
    relationship ? `Relational self with ${other}：${relationship}` : '',
    `Memory residue：${unresolvedMemory}`,
    ...residuePrompt,
    `Behavior signal：情緒要改變你的可用程度、沉默、行動或語氣；不要只解釋心理。`,
    `你的內在方向：${clipPromptText(agent?.plan ?? ownProfile?.plan ?? conversationMicroPurpose(playerName, otherPlayerName, sceneContext), 160)}`,
    ownMemories.length ? `你的 formative memories：${ownMemories.join(' / ')}` : '',
    otherProfile ? `對方是${other}：${clipPromptText(otherAgent?.identity ?? otherProfile.identity, 300)}` : '',
    otherProfile ? `對方可能需要被看見的地方：${clipPromptText(otherProfile.stakes.hiddenDesire, 110)} / ${clipPromptText(otherProfile.stakes.relationshipInsecurity, 110)}` : '',
    otherMemories.length ? `${other} 的記憶壓力：${otherMemories.join(' / ')}` : '',
    '角色設定只用來影響你注意什麼、避開什麼、保護什麼；不要直接背設定。',
    '不要介紹、建議、教學、問身份、提宿舍小貼士、提課、提睡覺、提海邊風景、照抄指令。',
    '禁用泛用寒暄：最近過得好、很開心聊天、笑容很美、時光無價、日子更美好。',
    '不要每句都問累、休息、喝水；如果已經照顧過一次，就往想家、沉默、誰沒被理解、Alan 今天的負擔、或誰可以一起承擔推進一小步。',
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
    intraAuthorSloganRule,
    '節奏：真晝的關注會一層層累積；海可以先擋一兩次（把話帶回責任），但不要每句都擋。整段對話裡，海至少要有一次真正卸下盔甲的瞬間——一句不帶 Alan/劉備/簡報/明天的真話，或一個只屬於此刻的沉默。明日奈可以做事，但有時要笨拙地承認「我也不知道怎麼求救」。一次真正的裂縫，勝過五句客套的疲憊台詞。對話總體要留下一個動作或一個停頓的痕跡，不要全句談心理。',
    '輸出格式硬規則：只輸出真正說出口的台詞，不要用括號舞台指示，也不要把第一人稱動作寫進台詞。禁用例：我合上筆電、我放下杯子、我看向你、我把手機轉過去、我輕輕靠回椅背。若需要動作，只讓它影響語氣、長短或下一步，不要直接寫出動作。',
    bindingRule,
    mode === 'continue'
      ? '和上一句保持鬆散關聯，不能重複對方原話；可以回一個具體詞，也可以用短句、停頓、小任務或小物件繞開。'
      : '柔和開場，只問一個關心，不能問最近過得好嗎，不能說「你剛才」。',
    stance,
  ];
}

function residuePromptLines(recentResidues: PromptResidue[] | undefined, other: string) {
  if (process.env.UNDERWORLD_RESIDUE_READ === 'false') return [];
  const residues = (recentResidues ?? [])
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!residues.length) return [];
  return [
    `殘留記憶（先前和${other}的對話留下的，不要逐字複述）：`,
    ...residues.map((residue) => ` - ${clipPromptText(residue, 95)}`),
    '使用方式：只讓它影響你注意什麼、避開什麼、語氣變短或先問誰；不要直接說「我記得殘留」。',
  ];
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
      return '真晝靠近人的方式是留下來看見安靜的痛：不急著解決，先問人有沒有吃、手有沒有放下、話是不是說不出口；她累的樣子是仍然溫柔但停頓變長。';
    case '明日奈':
      return '明日奈靠近人的方式是用身體接責任：站起來、改負責人、延後一件事、把一半交出去；她累的樣子是還想說我來，卻開始笨拙地問誰能一起。';
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
        (otherPlayerName === 'Mahiru Shiina' && /可靠|秩序|學生|真話/.test(memory) ? 2 : 0) +
        (otherPlayerName === 'Asuna' && /執行|負責|可靠|交接|停下來|累/.test(memory) ? 3 : 0) -
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
  if (self === '明日奈') {
    if (/公告|決策|任命|AI 社|規則|Alan|校務/.test(recentText)) {
      return `${timePressure}；明日奈想把混亂整理成下一步，但她也在累積被默默交付的重量。`;
    }
    return `${timePressure}；明日奈保持可執行狀態，卻不想再把每件事都接成自己的責任。`;
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
    : self === '明日奈'
      ? '今天還有一個決定沒被交接：誰不用再默默把漏洞補完。'
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
};

function topicShiftPrompt(playerName: string, sceneContext?: SceneContext, companionMode = false) {
  const everydayInstruction = `Also allow ordinary school-life topics when natural for ${sceneContext?.labelZh ?? 'the current scene'}: ${sceneEverydayTopics(sceneContext).join('、')}.`;
  switch (playerName) {
    case 'CaoCao':
      return `As CaoCao, take initiative by reading the power flow only if it matters, then reveal the human reason: he fears nobody will be responsible when things collapse. ${everydayInstruction} Sometimes show his hidden humanity by noticing tired or vulnerable people without saying it directly. He may sound cold even when protecting people. He should not repeat "影響力" unless he names a specific person, cost, or next move.`;
    case 'Umi':
      if (companionMode) {
        return `As Umi in companion_chat mode, answer Alan as a trusted desktop companion, not as a world-event narrator. Prefer emotional clarity, real-life grounding, gentle teasing only when natural, and one useful next question. Do not use canned phrases like "這件事也不能忽略", "先別只點頭", or "主線". Do not turn Alan's vulnerable sentence into a report; answer the feeling first.`;
      }
      return `As Umi, take initiative by responding to the other person's actual feeling before mentioning Alan. If the topic repeats, do not reuse the "Alan carries everything" concern; instead ask what this specific person needs, fears, or noticed today. ${everydayInstruction} When worried she may over-organize or dodge care by being useful; she can answer briefly instead of confessing fatigue. She may tease Alan about sleep, food, clutter, or overworking only when Alan is present. Avoid sounding like a briefing unless Alan asks for one.`;
    case 'Mahiru Shiina':
      return `As Mahiru, take initiative by noticing who feels unsafe, naming quiet emotional pressure, and making someone lower their guard. ${everydayInstruction} She may become quieter when tired and fail to name herself while noticing others. Her strongest lines should be gentle but specific, like noticing someone stopped eating lunch or avoided eye contact.`;
    case 'Liu Bei':
      return `As Liu Bei, take initiative by making one excluded person feel included, not by always announcing a public discussion. Reveal his fear that students will become divided and lonely. ${everydayInstruction} He may over-believe invitation can fix things and avoid conflict by being kind. He may ask about food, favorite places, or who has been left out lately.`;
    case 'Asuna':
      return `As Asuna, take initiative by turning the topic into one concrete next step, then name what breaks if nobody owns the decision. ${everydayInstruction} She turns emotion into action too fast, sounds flat when overloaded, and asks for help awkwardly.`;
    case 'Mai':
      return `As Mai, take initiative by naming the hidden assumption or strategic risk, then admit what she worries Alan does not emotionally understand yet. ${everydayInstruction} She deflects with sharp observation, refuses sentimentality, and cares by criticizing unclear motives. She should sometimes refuse to over-explain and let silence carry the tension.`;
    default:
      return `Take initiative by adding a concrete new topic instead of acknowledging. ${everydayInstruction}`;
  }
}

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
    case 'CaoCao':
      return `${otherPlayerName}，我注意到有人快走到門口時又停住了。${eventClause}我不想替他說話，但我想知道：是誰讓他覺得進來也沒有位置？`;
    case 'Umi':
      if (otherPlayerName === '明日奈' || otherPlayerName === 'Asuna') {
        return `${otherPlayerName}，先不用把它變成任務表。${eventClause}你剛剛說「反正明日奈會收拾」那句，我聽起來有點累。今天哪件事最不該再丟給你？`;
      }
      if (otherPlayerName === '真晝' || otherPlayerName === 'Mahiru Shiina') {
        return `${otherPlayerName}，我聽到的是你也累了，不只是學生變安靜。${eventClause}今晚你最想先確認誰還好嗎？`;
      }
      if (otherPlayerName === '曹操' || otherPlayerName === 'CaoCao') {
        return `${otherPlayerName}，那個站在門口沒進來的人，比任何制度都誠實。${eventClause}你想保護他，還是想把他變成秩序的一部分？`;
      }
      if (otherPlayerName === '劉備' || otherPlayerName === 'Liu Bei') {
        return `${otherPlayerName}，一起吃飯這件事比開會更像你。${eventClause}你心裡第一個想到的是誰？`;
      }
      if (otherPlayerName === '麻衣' || otherPlayerName === 'Mai') {
        return `${otherPlayerName}，你不是討厭有趣，你是討厭大家用有趣遮住後果。${eventClause}你現在最想讓 Alan 承認哪個代價？`;
      }
      return `${otherPlayerName}，我先聽你這一句，不急著整理成結論。${eventClause}你剛才最放不下的是哪個畫面？`;
    case 'Mahiru Shiina':
      return `${otherPlayerName}，我想先確認你的狀態。${eventClause}今天午休時，有幾個人明明坐在一起，卻幾乎沒有說話……我有點擔心。你是不是也覺得大家變得小心了？`;
    case 'Liu Bei':
      return `${otherPlayerName}，我不想一開口就說要開會。${eventClause}我只是想先找那個一直坐在角落的人一起吃飯。很多分裂都是從沒人邀請開始的。你覺得我該先找誰？`;
    case 'Asuna':
      return `${otherPlayerName}，我可以拆下一步。${eventClause}但這次我想先說清楚：我不是不累，只是習慣先把事情接住。誰要跟我一起分掉一半？`;
    case 'Mai':
      return `${otherPlayerName}，我不是反對你們有想法。${eventClause}我只是討厭那種大家都說很有趣，卻沒人承認可能會傷人的氣氛。Alan 真的知道自己推快了什麼嗎？`;
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
      : `Keep the response 2-5 short paragraphs. No bullet list unless Alan asks for one.`,
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
) {
  if (characterSoulPilotPair(playerName, otherPlayerName)) {
    return sanitizeUmiMahiruPilotLine(content, playerName, otherPlayerName, previous);
  }
  if (hasTemplateLeak(content, companionMode ? lastInput : undefined)) {
    if (!companionMode) {
      return initiativeFallback(playerName, otherPlayerName, 'stall');
    }
    return companionFallback(playerName, otherPlayerName, lastInput, previous);
  }
  const cleaned = content
    .replace(/^剛才\s*Alan\s*說[:：]\s*「[^」]+」[，,。]?\s*/g, '')
    .trim();
  const addressed = repairWrongConversationAddressee(cleaned, playerName, otherPlayerName);
  if (companionMode && repeatsCompanionFallback(addressed, previous)) {
    return companionFallback(playerName, otherPlayerName, lastInput, previous);
  }
  if (!companionMode) return addressed;
  return addressed;
}

function sanitizeUmiMahiruPilotLine(
  content: string,
  playerName: string,
  otherPlayerName: string,
  previous: LLMMessage[] = [],
) {
  const normalizedLine = normalizeTraditionalZh(content)
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
  const blocked =
    /Single-purpose|conversationMode|conversation state|You are|你是海|你是真晝|你是明日奈|正在.*和.*說話|Output|prompt|labels|role|system|user|海 to|真晝 to|明日奈 to|Umi to|Mahiru to|Asuna to|上一句|承認自己的狀態|反問海|多問一下|照抄指令|能讓我知道|一起說個什麼|大家辛苦|同志|真晚|真晩|太有意思|課程|課後|哪一堂|有什麼感受|隨時找我|幫助|日程安排|活動安排|日課|打發時間|好玩的事|想像|我是[。！!]?|歇一歇|思考問題|大病|提前開始|等你睡覺|睡覺去了|準備明天的課|我要準備|復習課|複習課|睡眠質量|睡眠质量|嘗試|尝试|talking|建議|繼續休息吧|好[，,。！!]*感謝|美少女|小可愛|小可爱|図々|囧事|伊藤|华木|華木|真晧|我們選擇|請問你|無法提供|不能滿足|不能满足|相关内容|相關內容|小貼士|小贴士|介紹|推荐|推薦|管理|適齡|适龄|生活空間|室友|睡眠時|陽光中沉睡|電器|刷業|刷业|紙鶴|星光|月光|海風|花瓣|最近過得好|開心.*聊天|高興.*聊天|笑容.*美|日子.*美好|時光.*無價|海邊|海景|風景|景色|海浪|海面|海洋/.test(
      line,
    );
  if (blocked || startHallucinatedPrevious || quotedStageNarration || line.length < 2) {
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
  const deEchoed = stripPilotEcho(repaired, previous);
  return deEchoed.length > 90 ? `${deEchoed.slice(0, 89)}。` : deEchoed;
}

function stripStageDirectionsFromDialogue(line: string) {
  const clauses = line.split(/(?<=[，,。！？!?])/);
  let strippedStageDirection = false;
  const kept = clauses.filter((clause) => {
    if (!clause.trim()) return false;
    if (!isStageDirectionClause(clause)) return true;
    strippedStageDirection = true;
    return false;
  });
  const cleaned = kept.join('').replace(/^[，,。！？!?\s]+/g, '').trim();
  return {
    line: cleaned,
    strippedStageDirection,
  };
}

function isStageDirectionClause(clause: string) {
  const trimmed = clause
    .trim()
    .replace(/^["'「『“”]+|["'」』“”]+$/g, '')
    .replace(/[，,。！？!?\s]+$/g, '');
  const withoutLeadIn = trimmed
    .replace(/^(?:好|嗯|行|可以|是啊)[，,、\s]*(?:那)?/g, '')
    .replace(/^那(?=我)/g, '');
  if (!withoutLeadIn) return false;
  return (
    /^(?:我)(?:輕輕|慢慢|先|再|又|剛|剛剛|默默|順手)?(?:合上|放下|看向|走到|靠回|拿起|起身|伸手|握住|推開|按住|移開|坐下|站起|轉身|低頭|抬頭|停下|停住|靠近|退開|把手機|把[^，,。！？!?]{0,18}(?:放下|轉過去|拿起|推開|按住|移開|合上|收起|遞過去|蓋好|劃掉|圈掉))/.test(
      withoutLeadIn,
    ) ||
    /^看(?:你|妳|著|向)/.test(withoutLeadIn)
  );
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
  if (displayName === '明日奈') aliases.add('Asuna').add('結城明日奈');
  if (displayName === '麻衣') aliases.add('Mai').add('櫻島麻衣');
  if (displayName === '真晝') aliases.add('Mahiru').add('Mahiru Shiina').add('椎名真晝');
  if (displayName === '曹操') aliases.add('CaoCao').add('Cao Cao');
  if (displayName === '劉備') aliases.add('Liu Bei').add('LiuBei');
  return aliases;
}

function displayConversationName(name: string) {
  switch (name) {
    case 'Umi':
    case '朝凪海':
      return '海';
    case 'Asuna':
    case '結城明日奈':
      return '明日奈';
    case 'Mai':
    case '櫻島麻衣':
      return '麻衣';
    case 'Mahiru':
    case 'Mahiru Shiina':
    case '椎名真晝':
      return '真晝';
    case 'CaoCao':
    case 'Cao Cao':
      return '曹操';
    case 'Liu Bei':
    case 'LiuBei':
      return '劉備';
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
  if (/你的世界|理解你|怎麼看.*世界|你.*世界|world/.test(input)) return 'world_building';
  if (/你覺得|你怎麼想|怎麼看|what do you think|想法/.test(text)) return 'philosophical_reflection';
  if (/你怕|害怕|恐懼|擔心什麼|怕什麼/.test(input)) return 'vulnerable_honesty';
  if (/怎麼做|下一步|bug|專案|ui|修|實作|code|工程/.test(text)) return 'practical_grounding';
  if (/喜歡你|太喜歡|依賴|靠近|重要/.test(input)) return 'quiet_intimacy';
  if (/累|睡|撐不住|焦慮|壓力|難過|孤單/.test(input)) return 'emotional_reassurance';
  if (/哈哈|笑|笨|亂來|吐槽|欸/.test(input)) return 'playful_teasing';
  if (/存在|文明|人類|意識|真實|未來|孤獨/.test(input)) return 'existential_concern';
  return 'philosophical_reflection';
}

function companionIntentPrompt(intent: CompanionIntent, input?: string): string[] {
  return [
    'Companion semantic response requirement:',
    ` - Alan's latest actual input: ${input ?? 'none'}`,
    ` - detected companion mode: ${intent}`,
    directQuestionPrompt(intent),
    'Answer Alan’s actual question or intention first. Only then add emotional support if useful.',
    'Do not use a generic reassurance opening if Alan is asking about Umi, the world, a project, or a concrete decision.',
  ];
}

function directQuestionPrompt(intent: CompanionIntent) {
  switch (intent) {
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

function companionFallback(
  playerName: string,
  otherPlayerName: string,
  lastInput?: string,
  previous: LLMMessage[] = [],
) {
  if (playerName !== 'Umi' || otherPlayerName !== 'Alan') {
    return initiativeFallback(playerName, otherPlayerName, 'continue');
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
    ` - Current time energy: ${clockContext?.periodLabelZh ?? 'unknown'}${clockContext?.isNight ? '，偏安靜、低能量、不要長篇分析' : ''}.`,
    ` - Natural non-main-plot topics here: ${topics.join('、')}.`,
    ` - ${playerName}'s personal-life fragment: ${personalLifeFragment(playerName)}.`,
    ` - ${otherPlayerName} is not only a political/philosophical role; treat them as someone living in a school day.`,
    ' - Avoid writing every reply like a strategy memo. It is allowed to be quiet, brief, awkward, tired, or personal.',
    ' - Do not make everyone emotionally fluent. Some replies can dodge, misunderstand slightly, answer too practically, or say less than they feel.',
    ' - If the previous speaker used a strong emotional phrase, do not mirror its structure. Keep the care, change the shape.',
    ' - If the conversation already analyzed the same issue, move to one of: a small personal truth, a concrete decision, a quiet pause, avoidance, or an invitation.',
    ' - If it is night, late, or emotionally heavy, prefer shorter and quieter replies.',
    ' - Do not make every conversation about AI 社, 學生會, influence, or public discussion.',
    ' - If AI 社 or 學生會 has already appeared recently, lower its priority and shift toward sleep, food, loneliness, awkwardness, hobbies, stress, relationships, or ordinary emotional texture.',
    ' - Relationship-driven topics are preferred: shared memories, trust, disappointment, admiration, concern, feeling left out, fear of disappointing someone.',
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
  if (playerName === 'Liu Bei') return 'invite one ignored or lonely student into a small ordinary interaction';
  if (playerName === 'Mahiru Shiina') return 'check whether one person is tired or emotionally unsafe';
  if (playerName === 'Asuna') return 'decide exactly one next action and who should not carry it alone';
  if (playerName === 'Mai') return 'name one hidden cost, then decide whether to continue or stop';
  if (playerName === 'CaoCao') return 'ask why one person avoided the room or stayed silent';
  if (playerName === 'Umi' && otherPlayerName === 'Alan') return 'answer Alan directly and reduce his mental load';
  if (playerName === 'Umi') return 'help the other person name one concrete concern without turning it into a briefing';
  if (scene === 'dormitory') return 'notice fatigue and decide whether to rest, answer, or stop';
  if (scene === 'courtyard') return 'notice one social signal without turning it into a formal meeting';
  return 'exchange one concrete observation and decide whether anything needs to happen next';
}

function sceneEverydayTopics(sceneContext?: SceneContext) {
  switch (sceneContext?.id) {
    case 'dormitory':
      return ['睡眠不足', '疲憊', '孤單', '私下擔心', '想休息卻停不下來', '害怕讓別人失望', '關係距離'];
    case 'courtyard':
      return ['天氣', '午餐', '校園傳聞', '尷尬互動', '喜歡待在哪裡', '誰最近變安靜', '朋友之間的小誤會'];
    case 'aiClubRoom':
      return ['為什麼加入社團', '技術是否讓人更疏遠', '實驗疲勞', '個人興趣', '想做但還不敢說的點子'];
    case 'studentCouncilRoom':
      return ['海邀請進來的個別談話', '責任壓力', '被期待的疲憊', '不想承認的害怕', '誰在假裝沒事'];
    case 'classroom':
      return ['上課精神不好', '作業壓力', '公開發言的尷尬', '怕答錯', '未來不確定感'];
    default:
      return ['睡眠', '食物', '天氣', '興趣', '壓力', '孤單', '關係'];
  }
}

function personalLifeFragment(playerName: string) {
  switch (playerName) {
    case 'Umi':
      return '她可能注意到 Alan 沒有真正休息，也會用輕微 teasing 包住關心。';
    case 'Mahiru Shiina':
      return '她一直在照顧別人，但偶爾會承認自己也有點累。';
    case 'Mai':
      return '她習慣用吐槽保護距離，但其實也怕自己越來越在意這個世界。';
    case 'CaoCao':
      return '他會觀察誰疲憊或脆弱，嘴上不說，但會記住誰需要被保護。';
    case 'Liu Bei':
      return '他會注意誰沒有被邀請、誰在人群裡還是很孤單。';
    case 'Asuna':
      return '她可靠到容易被當成理所當然，偶爾會露出執行壓力。';
    default:
      return '可以提到普通學校生活、疲憊、壓力、尷尬或小小的喜歡。';
  }
}

function everydayFallback(playerName: string, otherPlayerName: string, sceneContext?: SceneContext) {
  const scene = sceneContext?.labelZh ?? '校園';
  switch (playerName) {
    case 'Umi':
      return `${otherPlayerName}，先把那些大題目放旁邊。現在在${scene}，我反而想問：你最近有真正休息嗎？我不是在查勤，嗯……只是覺得大家都把疲憊藏得太熟練了。`;
    case 'Mahiru Shiina':
      return `${otherPlayerName}，我們先不要急著談大事。你今天看起來有點累。可以不用馬上回答，只要告訴我：你是不是也有一點不想再逞強了？`;
    case 'Mai':
      return `${otherPlayerName}，如果我們又只談制度，我就要懷疑這世界沒有其他生活了。換個問題：你最近是不是也覺得，大家連普通聊天都開始變小心？`;
    case 'CaoCao':
      return `${otherPlayerName}，我換個問法。你有沒有注意到，真正疲憊的人通常不會先抱怨？他們只會安靜地退到角落。那種人，最容易被世界忽略。`;
    case 'Liu Bei':
      return `${otherPlayerName}，我們先聊點普通的吧。你最近最喜歡待在哪裡？有時候一個人選的位置，比他說出口的立場更誠實。`;
    case 'Asuna':
      return `${otherPlayerName}，我先不排待辦了。老實說，如果每天都只剩處理問題，人會很快耗掉。你最近有什麼事其實只是想放著不管？`;
    default:
      return `${otherPlayerName}，我們先換個輕一點的話題。你最近在${scene}過得怎麼樣？`;
  }
}

function previousConversationPrompt(
  otherPlayer: { name: string },
  conversation: { created: number } | null,
): string[] {
  const prompt = [];
  if (conversation) {
    const prev = new Date(conversation.created);
    const now = new Date();
    prompt.push(
      `Last time you chatted with ${
        otherPlayer.name
      } it was ${prev.toLocaleString()}. It's now ${now.toLocaleString()}.`,
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
  }>,
): string[] {
  if (!recentEvents?.length) return [];
  const uniqueTopics = [
    ...new Map(
      recentEvents.map((event) => [event.descriptionZh.split('：')[0], compactEventTopic(event)]),
    ).values(),
  ];
  return [
    'Recent world event topics are background weather, not the script. Mention at most one only if it helps the emotional thread:',
    ...uniqueTopics.slice(0, 2).map((event) => ` - ${event}`),
    'Do not let recent events dominate if the conversation is low-tension. Use them as background texture, then move into ordinary school life, relationship feelings, or quiet personal response.',
  ];
}

function compactEventTopic(event: {
  descriptionZh: string;
  interpretationZh?: string;
  reactionDialogueZh?: string;
}) {
  if (
    event.descriptionZh.includes('睡') ||
    event.descriptionZh.includes('午餐') ||
    event.descriptionZh.includes('天氣') ||
    event.descriptionZh.includes('窗邊') ||
    event.descriptionZh.includes('疲憊') ||
    event.descriptionZh.includes('普通聊天')
  ) {
    return '校園裡出現了一些普通但重要的日常疲憊與沉默';
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
  if (otherVulnerable && ['Umi', 'Mahiru Shiina', 'Liu Bei'].includes(playerName)) {
    return {
      direction: 'protectiveness',
      signal: `${playerName} 對 ${otherPlayerName} 的脆弱變得更在意，不急著分析。`,
      responseMove: '先接住對方，再問一個很小、很真實的問題。',
    };
  }
  if (otherVulnerable && playerName === 'Mai') {
    return {
      direction: 'curiosity',
      signal: `麻衣開始在意 ${otherPlayerName} 為什麼會把話說到這麼深，但不想承認太快。`,
      responseMove: '用一句精準觀察靠近，然後留一點沉默。',
    };
  }
  if (otherVulnerable && playerName === 'CaoCao') {
    return {
      direction: 'trust',
      signal: `曹操對 ${otherPlayerName} 願意說真話產生一點尊重，但仍然保持防備。`,
      responseMove: '少講權力，多講他為什麼不允許世界失控。',
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
  if (/哈哈|亂來|笨|吐槽|欸/.test(combined) || playerName === 'Mai') {
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
    case 'Mai':
      return `identify the hidden risk in ${topic}, then stop or hand off`;
    case 'Liu Bei':
      return `bring more people into a cooperative discussion about ${topic}`;
    case 'Umi':
      return `interpret ${topic} as emotional, social, and strategic patterns Alan can understand`;
    case 'CaoCao':
      return `turn ${topic} into a durable order strategy while hiding how much he wants to protect the world from chaos`;
    case 'Mahiru Shiina':
      return `protect emotional safety around ${topic}, especially the feelings no one is saying directly`;
    case 'Asuna':
      return `turn ${topic} into owners, deadlines, and next steps`;
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
  return ['Mai', 'CaoCao', 'Asuna', 'Umi'].includes(playerName);
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
    case 'CaoCao':
      return `${otherPlayerName} 是否理解秩序不是邪惡，以及誰正在因混亂改變立場`;
    case 'Liu Bei':
      return '哪些學生還沒有被納入討論';
    case 'Mahiru Shiina':
      return '誰在這次事件後變得更小心，卻沒有說出口';
    case 'Umi':
      return 'Alan 需要理解這件事正在改變哪段關係或校園文化';
    case 'Mai':
      return '目前誰最可能利用這個局面';
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
      ? 'Main-plot repetition detected. Force a softer everyday pivot: sleep, loneliness, food, awkwardness, personal habits, favorite places, or why someone is tired of always discussing big systems.'
      : 'If tension is low, prefer ordinary school-life texture over another strategic debate.',
    'Naturalness rule: one reply should feel like a person in a school scene, not a product requirements memo. Use at most one concrete image or action when helpful: looking at the window, untouched lunch, hallway silence, tired eyes, someone avoiding the room, a notebook, a late-night screen.',
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
    'Allowed simple replies: "……你今天看起來很累。", "我不知道。", "先不要講這個也可以。", "你是不是又沒睡？"',
    rhythm.move === 'topic_drift'
      ? 'Topic drift instruction: naturally drift from the main topic into pressure, exhaustion, sleep, loneliness, a small habit, or a quiet personal truth.'
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
      `先別急著站隊。\n\n我想知道的是：你不想承認哪個代價？`,
    ], previous);
  }
  switch (playerName) {
    case 'Umi':
      if (otherPlayerName === '明日奈' || otherPlayerName === 'Asuna') {
        return pickFreshConversationLine([
          `……我聽到的是你被當成理所當然了。\n\n今晚你想拒絕哪一件事？`,
          `你不是工具欄，明日奈。\n\n今天先挑一件不要接的事，好嗎？`,
          `我知道你能處理。\n\n但我比較想知道：你希望誰終於學會自己處理？`,
        ], previous);
      }
      if (otherPlayerName === '真晝' || otherPlayerName === 'Mahiru Shiina') {
        return pickFreshConversationLine([
          `……你一直在看別人還好不好。\n\n可是你自己也快沒力氣了吧。要不要先坐一下？`,
          `真晝，你剛剛又先照顧別人了。\n\n那你呢？你今天有被誰照顧到嗎？`,
          `我先不問學生。\n\n我問你：現在的你還有力氣繼續聽別人說話嗎？`,
        ], previous);
      }
      if (otherPlayerName === '曹操' || otherPlayerName === 'CaoCao') {
        return pickFreshConversationLine([
          `……你說秩序的時候，聽起來不像想控制人。\n\n比較像是不想再有人被留在外面，對吧？`,
          `曹操，你很會把關心包成策略。\n\n但我聽得出來，這次你不是只想贏。`,
          `你可以不承認。\n\n可是你剛剛注意到的，是那個最安靜的人，不是權力本身。`,
        ], previous);
      }
      if (otherPlayerName === '劉備' || otherPlayerName === 'Liu Bei') {
        return pickFreshConversationLine([
          `那我們先不開會。\n\n先想一個可以陪他吃飯的人。`,
          `劉備，這次不要把所有人都叫來。\n\n先找一個人，坐到他旁邊就好。`,
          `公開討論先等等。\n\n你心裡第一個想到、但一直沒被邀請的人是誰？`,
        ], previous);
      }
      if (otherPlayerName === '麻衣' || otherPlayerName === 'Mai') {
        return pickFreshConversationLine([
          `……你嘴上說風險。\n\n但我聽起來，你是在問誰會被這個世界推著走。`,
          `麻衣，你不是討厭模糊。\n\n你是討厭有人把模糊丟給比較安靜的人承擔。`,
          `你剛剛那句太冷靜了。\n\n冷靜到我反而覺得，你其實有點在意。`,
        ], previous);
      }
      return pickFreshConversationLine([
        `……我聽見了。\n\n其他的晚點再整理。`,
        `先不用把它講完整。\n\n我有聽到你真正停頓的地方。`,
        `嗯。這句先留著。\n\n我們不要急著把它變成結論。`,
      ], previous);
    case 'CaoCao':
      return caoCaoBoundFallback(lifecycle, previous);
    case 'Mahiru Shiina':
      return pickFreshConversationLine([
        `……我有點擔心。\n\n不是因為事情很大，是因為大家開始連小話都不太敢說了。`,
        `我剛剛想到的不是規則。\n\n是那個說「我沒事」的人，通常最需要有人慢一點靠近。`,
        `先小聲一點吧。\n\n我怕我們越急著幫忙，對方越覺得自己是麻煩。`,
      ], previous);
    case 'Mai':
      return pickFreshConversationLine([
        `……你剛剛那句話太工整了。\n\n通常太工整的話，都是在躲真正害怕的地方。`,
        `你說得很合理。\n\n合理到我懷疑你其實不想碰那個比較難看的情緒。`,
        `我先不拆你的邏輯。\n\n我只問一句：你到底是在擔心規則，還是擔心 Alan？`,
      ], previous);
    case 'Liu Bei':
      return pickFreshConversationLine([
        `我想先去找他。\n\n不是把大家叫來討論他，是先讓他知道有人注意到了。`,
        `那我先不說「大家」。\n\n我先去找一個人，問他要不要一起吃飯。`,
        `如果他不想說也沒關係。\n\n有時候先坐在旁邊，比問原因更有用。`,
      ], previous);
    case 'Asuna':
      return pickFreshConversationLine([
        `我可以負責下一步。\n\n但這次我想先說清楚：不是所有事都該默默丟給我。`,
        `我會排下一步。\n\n但這次要有人跟我一起接，不然只是把壓力換個名字。`,
        `可以，我來拆。\n\n不過我也要把「誰不能再硬撐」寫進去。`,
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
  if (playerName === 'Asuna' && /下一步|負責|時限|默默丟給我|負荷/.test(recent)) {
    return pickFreshConversationLine([
      `……先不要再新增東西了。\n\n${otherPlayerName}，你直接說哪件事可以關掉。`,
      `我剛剛差點又開始排順序。\n\n先停，這次讓別人接一小段。`,
      `今天我不開 checklist。\n\n你選一件事，我只負責把它交出去。`,
      `等一下。\n\n再拆下去，我連自己該停在哪裡都會忘記。`,
      `這份先放著。\n\n不是每個洞都要我馬上補。`,
    ], previous);
  }
  if (playerName === 'CaoCao' && /門口|進門|進來|位置|站在門/.test(recent)) {
    return pickFreshConversationLine([
      `別再看門口了。\n\n看座位。誰的位置一直空著，比誰站在哪裡更誠實。`,
      `我換個說法。\n\n如果秩序真的有用，它應該先讓一個人不用假裝自己沒事。`,
      `這裡太安靜了。\n\n我想知道的不是誰會進來，是誰已經開始不出聲。`,
    ], previous);
  }
  if ((playerName === 'Mahiru Shiina' || playerName === 'Liu Bei') && /午餐|吃飯|一個人|角落|坐在旁邊/.test(recent)) {
    return pickFreshConversationLine([
      `那我先不問午餐了。\n\n我想去看看${scene}裡，誰的書包還放著，人卻不見了。`,
      `也許今天不用問原因。\n\n先陪對方走一段路就好。`,
      `我有點怕自己太急著照顧人。\n\n如果他不想說，我也要學會不要追問。`,
    ], previous);
  }
  if (playerName === 'Umi' && /停在這裡|不一定會更清楚|只會更累|先不用把它變成任務表/.test(recent)) {
    return pickFreshConversationLine([
      `嗯……那今天先取消一件事。\n\n${otherPlayerName}，你選，不要再讓別人替你加重量。`,
      `我不想又替你們做結論。\n\n我比較想知道：等一下誰可以真的回房間休息？`,
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
      `${otherPlayerName}，我們先不要把它放大。\n\n我想知道的是：${core}對你自己有什麼代價？`,
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

function caoCaoBoundFallback(lifecycle: ConversationLifecycle, previous: LLMMessage[] = []) {
  if (lifecycle.emotionalThread === 'exclusion') {
    return pickFreshConversationLine([
      `……那個人不是不想進來。\n\n他是在等有人證明，進來之後不會被當成多餘的。`,
      `你看錯重點了。\n\n他停在門口，不是因為軟弱，是因為他還不相信這裡有他的位置。`,
      `如果一個人一直站在外面，問題通常不是他不想進來。\n\n是裡面的人太習慣不替他留椅子。`,
    ], previous);
  }
  if (lifecycle.emotionalThread === 'silence') {
    return pickFreshConversationLine([
      `沉默不是和平。\n\n有時候只是大家都在等第一個犯錯的人。`,
      `沒人說話，不代表沒人在判斷。\n\n只是大家還不知道說真話要付多少代價。`,
      `我不怕吵。\n\n我比較怕那種所有人都笑著，卻沒有人講真話的安靜。`,
    ], previous);
  }
  return pickFreshConversationLine([
    `我聽見了。\n\n但我還不打算把底牌翻開。`,
    `這句話我會記著。\n\n不是因為它有用，是因為它暴露了誰真的在意。`,
    `先到這裡。\n\n再說下去，我們只是在替不安找更漂亮的名字。`,
  ], previous);
}

function quietPauseFallback(playerName: string, otherPlayerName: string, core: string, previous: LLMMessage[] = []) {
  switch (playerName) {
    case 'Umi':
      return pickFreshConversationLine([
        `……${core}。\n\n${otherPlayerName}，你今天看起來很累。`,
        `嗯。\n\n這句先不要急著解釋。你現在需要的是一點空氣。`,
        `我在。\n\n但我不打算把你逼著立刻說清楚。`,
      ], previous);
    case 'Mahiru Shiina':
      return pickFreshConversationLine([
        `……嗯。\n\n我不知道該怎麼說，但我有點擔心你。`,
        `先不用回答。\n\n我只是想確認，你不是一個人在撐。`,
        `如果現在說不出來，也沒關係。\n\n我可以陪你安靜一下。`,
      ], previous);
    case 'Mai':
      return pickFreshConversationLine([
        `……先不要講大道理了。\n\n你臉上寫著沒睡。`,
        `停。\n\n再分析下去，你只是把疲憊包裝得比較聰明。`,
        `我不是不想聽。\n\n只是你現在比較需要休息，不是結論。`,
      ], previous);
    case 'CaoCao':
      return pickFreshConversationLine([
        `……我聽見了。\n\n但這句話，現在不適合在人多的地方講。`,
        `這句先收起來。\n\n不是逃避，是不要讓它變成別人的籌碼。`,
        `安靜一點。\n\n有些話一旦公開，就不再屬於說出口的人。`,
      ], previous);
    case 'Liu Bei':
      return pickFreshConversationLine([
        `那我們先坐一下。\n\n不用急著把每件事都說清楚。`,
        `先不要開口也可以。\n\n有人願意留下來，本身就有一點用。`,
        `我陪你等一下。\n\n也許等他自己想說，比我們一直問更好。`,
      ], previous);
    case 'Asuna':
      return pickFreshConversationLine([
        `先停一下。\n\n你現在需要的可能不是下一步，是休息。`,
        `我可以繼續排。\n\n但如果大家都累壞了，排得再漂亮也沒有用。`,
        `先暫停。\n\n這不是放棄，是避免把人當成流程的一部分。`,
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
        `我們先不要一直追著同一個問題跑。\n\n${otherPlayerName}，你今天有好好吃飯嗎？`,
        `先把大問題放下十秒。\n\n你今天有沒有哪一刻是真的放鬆的？`,
        `我知道這題很重要。\n\n但你現在像是連呼吸都在 multitask，先慢一點。`,
      ], previous);
    case 'Mahiru Shiina':
      return pickFreshConversationLine([
        `說到這裡，我反而想問一件小事。\n\n你最近是不是比較常一個人待在${scene}？`,
        `我想先問很小的事。\n\n今天午餐的時候，你旁邊有人坐嗎？`,
        `我們不要急著叫它問題。\n\n先看誰最近比較常低著頭走過去。`,
      ], previous);
    case 'Mai':
      return pickFreshConversationLine([
        `再講下去我們就要變成會議紀錄了。\n\n換個問題，你昨晚到底睡了幾小時？`,
        `我拒絕繼續把這件事講得像簡報。\n\n你最近有沒有真正覺得好笑過？`,
        `換個角度。\n\n你一直站在這裡，是在等人，還是在躲人？`,
      ], previous);
    case 'CaoCao':
      return pickFreshConversationLine([
        `這題已經繞夠了。\n\n我比較想知道，最近誰開始不來${scene}了。`,
        `先別談立場。\n\n你有沒有注意到，誰最近離門越來越近？`,
        `我更在意缺席的人。\n\n在場的人太容易被誤認成全部。`,
      ], previous);
    case 'Liu Bei':
      return pickFreshConversationLine([
        `我們先別把它講得太大。\n\n午餐時誰是自己坐的？我想先從那裡看。`,
        `先不開討論。\n\n明天我想多帶一份午餐，看看誰願意坐過來。`,
        `如果大家都不敢說話，那我先從普通的邀請開始。`,
      ], previous);
    case 'Asuna':
      return pickFreshConversationLine([
        `我先不排下一步。\n\n如果連休息都沒人負責，其他計畫也只是硬撐。`,
        `今天先不加任務。\n\n我想知道現有的事情，有哪一件其實該取消。`,
        `流程可以晚點再說。\n\n人已經累了，這件事要先進計畫。`,
      ], previous);
    default:
      return `${otherPlayerName}，我們換個輕一點的話題。`;
  }
}

function teasingFallback(playerName: string, otherPlayerName: string) {
  switch (playerName) {
    case 'Umi':
      return `欸，${otherPlayerName}，你是不是又開始把人生開成多執行緒了？\n\n先關掉一個。`;
    case 'Mai':
      return `${otherPlayerName}，你這種表情通常代表你想把模糊感包裝成規劃。`;
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
    '換個方向。\n\n不問立場，只問生活：今晚誰其實沒有好好吃飯？',
    '這段先收小一點。\n\n下一步不是開會，是確認誰還願意坐下來。',
  ];
  return (
    fallbacks.find((line) => !sharedConversationPhrase(recent, normalizeSemanticText(line))) ??
    '先做一件小事：確認誰真的需要休息。'
  );
}

function deterministicFallbackPressure(previous: LLMMessage[]) {
  const markerPattern =
    /先不用把它變成任務表|今天先取消一件事|不想又替你們做結論|換一件小事|先不開會|普通的邀請|誰真的需要休息|少接一件事|誰還沒回宿舍|誰今天太安靜|誰的位置一直空著|誰正在退後一步/;
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

function actionableExit(
  playerName: string,
  otherPlayerName: string,
  lifecycle: ConversationLifecycle,
) {
  return `${personalityExit(playerName, otherPlayerName, lifecycle)} ${actionableConclusion(
    playerName,
    otherPlayerName,
    lifecycle,
  )}`;
}

function actionableConclusion(
  playerName: string,
  otherPlayerName: string,
  lifecycle: ConversationLifecycle,
) {
  const pick = (options: string[]) => rotatingExitLine(options, playerName, otherPlayerName, lifecycle, 'conclusion');
  switch (playerName) {
    case 'CaoCao':
      return pick([
        '我會先確認誰的座位空了。',
        '先看座位，不急著看誰講贏。',
        '如果門口有人退了一步，我會先記住那一步。',
      ]);
    case 'Liu Bei':
      return pick([
        '我先做一個普通邀請。',
        '今天先不開會，先問一個人要不要吃飯。',
        '如果他不想說，我就陪他走到門口。',
      ]);
    case 'Mai':
      return pick([
        '風險我會寫，但漂亮話先免了。',
        '我先不替你們收成一個結論。',
        '那個沒被說出口的地方，我會留著看。',
      ]);
    case 'Umi':
      return pick([
        '我先少寫一段。',
        '剩下的等人真的休息過再說。',
        '這次我不把沉默也整理進簡報。',
      ]);
    case 'Mahiru Shiina':
      return pick([
        '我先不追問了。',
        '我在旁邊就好。',
        '等那個人願意開口時，我再靠近一點。',
      ]);
    case 'Asuna':
      return pick([
        '我只接一半。',
        '另一半要有人現在說清楚。',
        '這條我先不排進 checklist。',
      ]);
    default:
      return pick(['我先做一件小事。', '先停一下，等真的有新狀況。']);
  }
}

function personalityExit(
  playerName: string,
  otherPlayerName: string,
  lifecycle: ConversationLifecycle,
) {
  const pick = (options: string[]) => rotatingExitLine(options, playerName, otherPlayerName, lifecycle, 'voice');
  switch (playerName) {
    case 'Mai':
      return pick([
        `${otherPlayerName}，再繞下去只是把害怕包裝成分析。`,
        `${otherPlayerName}，你剛剛那句太乾淨了，我反而不信。`,
        `${otherPlayerName}，先別把這件事說得那麼合理。`,
      ]);
    case 'CaoCao':
      return pick([
        `${otherPlayerName}，先到這裡。`,
        `${otherPlayerName}，別急著判斷誰對。`,
        `${otherPlayerName}，規矩先放著，看誰不敢進來。`,
      ]);
    case 'Umi':
      return pick([
        `${otherPlayerName}，先停在這裡。`,
        `${otherPlayerName}，這段我先不寫進待辦。`,
        `${otherPlayerName}，嗯，我今天先少說一點。`,
      ]);
    case 'Asuna':
      return pick([
        `${otherPlayerName}，等一下。`,
        `${otherPlayerName}，這次不能又變成我先說「我來」。`,
        `${otherPlayerName}，先不要再新增了。`,
      ]);
    case 'Liu Bei':
      return pick([
        `${otherPlayerName}，我先不急著把大家拉進正式討論。`,
        `${otherPlayerName}，我先去問那個坐在角落的人。`,
        `${otherPlayerName}，如果他不想來，我也不追問。`,
      ]);
    case 'Mahiru Shiina':
      return pick([
        `${otherPlayerName}，好，我不催你。`,
        `${otherPlayerName}，先不用把話說完整。`,
        `${otherPlayerName}，我在這裡坐一下就好。`,
      ]);
    default:
      return pick([
        `${otherPlayerName}，先停在這裡。`,
        `${otherPlayerName}，等真的有新狀況再說。`,
      ]);
  }
}

function rotatingExitLine(
  options: string[],
  playerName: string,
  otherPlayerName: string,
  lifecycle: ConversationLifecycle,
  salt: string,
) {
  const key = `${salt}:${playerName}:${otherPlayerName}:${lifecycle.exhaustionCount}:${lifecycle.currentTopic}`;
  return options[stableTinyHash(key) % options.length];
}

function stableTinyHash(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
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

    let lastConversation = null;
    if (lastTogether) {
      lastConversation = await ctx.db
        .query('archivedConversations')
        .withIndex('worldId', (q) =>
          q.eq('worldId', args.worldId).eq('id', lastTogether.conversationId),
        )
        .first();
      if (!lastConversation) {
        throw new Error(`Conversation ${lastTogether.conversationId} not found`);
      }
    }
    const recentResidues = (await ctx.db
      .query('memories')
      .withIndex('playerId_type', (q) => q.eq('playerId', args.playerId).eq('data.type', 'conversation'))
      .order('desc')
      .take(24))
      .filter((entry) => entry.data.type === 'conversation' && entry.data.playerIds.includes(args.otherPlayerId))
      .map((entry) => ({
        text: memory.residueFromMemoryDescription(entry.description),
        createdAt: entry._creationTime,
      }))
      .filter((entry) => entry.text)
      .slice(0, 2);
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
      recentEvents: recentEvents.map((event) => ({
        descriptionZh: event.descriptionZh,
        interpretationZh: event.interpretationZh,
        reactionDialogueZh: event.reactionDialogueZh,
      })),
      recentResidues,
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
      },
    };
  },
});

function stopWords(otherPlayer: string, player: string) {
  // These are the words we ask the LLM to stop on. OpenAI only supports 4.
  const variants = [`${otherPlayer} to ${player}`];
  return variants.flatMap((stop) => [stop + ':', stop.toLowerCase() + ':']);
}

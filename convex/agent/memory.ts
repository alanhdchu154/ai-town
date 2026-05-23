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
  const isMundane = /天氣|午餐|窗邊|走廊|睡|累|安靜|休息|食物|座位/.test(description);

  if (hasRelationshipSignal) tags.add('relationship');
  if (hasDecisionSignal) tags.add('decision');
  if (hasIdentitySignal) tags.add('identity');
  if (hasWorldSignal) tags.add('world');
  if (isMundane) tags.add('everyday_life');

  const shouldPromote =
    importance >= LONG_TERM_CANDIDATE_IMPORTANCE ||
    (importance >= 5 && (hasRelationshipSignal || hasDecisionSignal || hasIdentitySignal));
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
  const lastMeaningfulText = [...messages]
    .reverse()
    .map((message) => message.text.trim())
    .find(Boolean);
  const preview = lastMeaningfulText
    ? `最後留下的重點是：「${lastMeaningfulText.slice(0, 96)}${lastMeaningfulText.length > 96 ? '...' : ''}」`
    : '這段對話沒有留下明確訊息。';
  return `${player.name} 和 ${otherPlayer.name} 進行了一段短暫對話；${preview}`;
}

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
  if (isDegeneratePilotExitMemory(player, otherPlayer, messages)) {
    logGiisTiming({
      action: 'rememberConversation',
      phase: 'skipDegeneratePilotExit',
      player: player.name,
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
  logGiisTiming({
    action: 'rememberConversation',
    phase: 'memorySummaryTime',
    ms: Date.now() - summaryStart,
    player: player.name,
  });
  const baseDescription = `與 ${otherPlayer.name} 在 ${new Date(
    data.conversation._creationTime,
  ).toLocaleString()} 的對話：${content}`;
  const importanceStart = Date.now();
  const baseImportance = await calculateImportance(baseDescription);
  const retention = classifyMemoryRetention(baseDescription, baseImportance);
  const importance = retention.shouldPromote ? Math.max(baseImportance, LONG_TERM_CANDIDATE_IMPORTANCE) : baseImportance;
  const description = `${baseDescription}\n${formatRetentionDecision(retention)}`;
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
  return rankedMemories.map(({ memory }: { memory: Memory }) => memory);
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
    const memories = await ctx.db
      .query('memories')
      .withIndex('playerId', (q) => q.eq('playerId', player.id))
      .order('desc')
      .take(args.numberOfItems);

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

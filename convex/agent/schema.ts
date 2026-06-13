import { v } from 'convex/values';
import { playerId, conversationId } from '../aiTown/ids';
import { defineTable } from 'convex/server';
import { EMBEDDING_DIMENSION } from '../util/llm';

export const experienceLogImportance = v.union(
  v.literal('low'),
  v.literal('medium'),
  v.literal('high'),
);

// Compact, bounded lived-history record for the current v0.1 evidence pilot
// (海 / 真晝 / 貓貓 / 天澤 / 一之瀨 / 祥子). Each entry is small on purpose: it
// documents what happened, what the character felt, what residue/belief/
// behavior seed it might carry, and which conversation produced it.
// Personality, prompts, and core beliefs do NOT read from this table yet —
// it is a substrate for the v0.1 evidence loop.
export const experienceLogFields = {
  worldId: v.id('worlds'),
  playerId,
  // Canonical pilot display name. Used for cheap
  // per-character/day cap and dedupe lookups via the index below.
  characterName: v.string(),
  eventSummary: v.string(),
  emotionalInterpretation: v.string(),
  residue: v.string(),
  beliefSeed: v.string(),
  behaviorHint: v.string(),
  importance: experienceLogImportance,
  source: v.object({
    conversationId,
    otherPlayerId: playerId,
    otherCharacterName: v.string(),
  }),
  involvedCharacters: v.array(v.string()),
  day: v.number(),
  timestamp: v.number(),
  createdAt: v.number(),
  expiresAfterDays: v.optional(v.number()),
};

export const memoryFields = {
  playerId,
  description: v.string(),
  embeddingId: v.id('memoryEmbeddings'),
  importance: v.number(),
  lastAccess: v.number(),
  data: v.union(
    // Setting up dynamics between players
    v.object({
      type: v.literal('relationship'),
      // The player this memory is about, from the perspective of the player
      // whose memory this is.
      playerId,
    }),
    v.object({
      type: v.literal('conversation'),
      conversationId,
      // The other player(s) in the conversation.
      playerIds: v.array(playerId),
    }),
    v.object({
      type: v.literal('reflection'),
      relatedMemoryIds: v.array(v.id('memories')),
    }),
  ),
};
export const memoryTables = {
  memories: defineTable(memoryFields)
    .index('embeddingId', ['embeddingId'])
    .index('playerId_type', ['playerId', 'data.type'])
    .index('playerId', ['playerId']),
  memoryEmbeddings: defineTable({
    playerId,
    embedding: v.array(v.float64()),
  }).vectorIndex('embedding', {
    vectorField: 'embedding',
    filterFields: ['playerId'],
    dimensions: EMBEDDING_DIMENSION,
  }),
};

export const experienceLogTables = {
  experienceLogs: defineTable(experienceLogFields)
    .index('worldDay', ['worldId', 'day'])
    .index('worldCharacter', ['worldId', 'characterName', 'day'])
    .index('playerDay', ['playerId', 'day']),
};

export const agentTables = {
  ...memoryTables,
  ...experienceLogTables,
  embeddingsCache: defineTable({
    textHash: v.bytes(),
    embedding: v.array(v.float64()),
  }).index('text', ['textHash']),
};

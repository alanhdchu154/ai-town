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
  // Forgetting mechanism (see docs/soul/FORGETTING_MECHANISM_SPEC.md). When a
  // memory "sinks" (becomes deep-dormant), its embedding is moved out of the
  // active vector index into `memoryEmbeddingsArchive` so vectorSearch can no
  // longer reach it — but `description` (the TEXT) is ALWAYS kept. Reversible:
  // `archivedEmbeddingId` lets it be reactivated (cued recall). Absent = active.
  dormant: v.optional(v.boolean()),
  dormantSince: v.optional(v.number()),
  archivedEmbeddingId: v.optional(v.id('memoryEmbeddingsArchive')),
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
  // Sunk embeddings (forgetting). Deliberately has NO vectorIndex, so archived
  // vectors never load the search cache and are never returned by vectorSearch —
  // that is exactly what makes the memory "forgotten" (unreachable by
  // association) while staying fully recoverable. `memoryId` links back so a
  // memory can be reactivated. See docs/soul/FORGETTING_MECHANISM_SPEC.md.
  memoryEmbeddingsArchive: defineTable({
    playerId,
    embedding: v.array(v.float64()),
    memoryId: v.id('memories'),
    archivedAt: v.number(),
  }).index('memoryId', ['memoryId']),
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

// One-time repair: re-archive Alan conversations that were orphaned by the
// pre-fix direct-leave paths (leaveAlanConversationNow / leaveCampus removed the
// conversation from world.conversations without going through saveDiff archival).
// The transcripts were never lost — they stayed in the `messages` table — but
// they were never written to `archivedConversations`, and no conversation
// memory was ever generated, so characters could not actually recall these
// chats.
//
// This module re-archives each two-sided Alan conversation and runs the normal
// deterministic memory pipeline (MEMORY_LLM_MODE / MEMORY_EMBEDDING_MODE are
// both `deterministic` in this deployment, so no external model is required and
// the embeddings match what recall uses).
//
// Run with:  npx convex run underworldOrphanBackfill:run '{"dryRun": true}'
// then       npx convex run underworldOrphanBackfill:run '{}'
//
// It is idempotent: already-archived conversations and already-remembered
// conversations are skipped, so it is safe to re-run.

import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { rememberConversation } from './agent/memory';
import { GameId } from './aiTown/ids';
import { Id } from './_generated/dataModel';

const ALAN_NAME = 'Alan';

type BackfillItem = {
  conversationId: string;
  characterName: string;
  characterPlayerId: string;
  characterAgentId: string;
  alanPlayerId: string;
  created: number;
  ended: number;
  numMessages: number;
  lastMessageAuthor: string;
  lastMessageTimestamp: number;
  participants: string[];
};

type PlanResult = {
  worldId: Id<'worlds'>;
  items: BackfillItem[];
  alreadyArchived: number;
  skippedShort: number;
  skippedNoAlan: number;
};

type RunSummary = {
  worldId: Id<'worlds'>;
  eligible: number;
  alreadyArchived: number;
  skippedShort: number;
  dryRun: boolean;
  archivedNow: number;
  memoriesWritten: number;
  memoriesSkippedExisting: number;
  details: any[];
};

async function defaultWorldId(ctx: any): Promise<Id<'worlds'>> {
  const status = await ctx.db
    .query('worldStatus')
    .filter((q: any) => q.eq(q.field('isDefault'), true))
    .first();
  if (!status) throw new Error('No default world');
  return status.worldId;
}

export const planAlanOrphanBackfill = internalQuery({
  args: { worldId: v.optional(v.id('worlds')) },
  handler: async (ctx, args) => {
    const worldId = args.worldId ?? (await defaultWorldId(ctx));
    const world = await ctx.db.get(worldId);
    if (!world) throw new Error(`World ${worldId} not found`);

    const descriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const nameByPlayerId = new Map(descriptions.map((d) => [d.playerId, d.name]));
    const agentByPlayerId = new Map(world.agents.map((a) => [a.playerId, a.id]));

    const archived = await ctx.db
      .query('archivedConversations')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const archivedIds = new Set(archived.map((a) => String(a.id)));

    // Single-world local deployment: collect all messages and group by
    // conversation. (No worldId-only index exists on `messages`.)
    const allMessages = await ctx.db.query('messages').collect();
    const byConversation = new Map<string, typeof allMessages>();
    for (const message of allMessages) {
      if (message.worldId !== worldId) continue;
      const list = byConversation.get(message.conversationId) ?? [];
      list.push(message);
      byConversation.set(message.conversationId, list);
    }

    const items: BackfillItem[] = [];
    let alreadyArchived = 0;
    let skippedShort = 0;
    let skippedNoAlan = 0;
    for (const [conversationId, messages] of byConversation) {
      messages.sort((a, b) => a._creationTime - b._creationTime);
      const authors = [...new Set(messages.map((m) => m.author))];
      const authorNames = authors.map((a) => nameByPlayerId.get(a));
      if (!authorNames.includes(ALAN_NAME)) {
        skippedNoAlan++;
        continue;
      }
      // Count (but do not skip) already-archived conversations: re-archiving is
      // idempotent, and the real per-conversation guard is "does a memory
      // already exist", applied in run(). This lets a corrected re-run
      // regenerate memories without first un-archiving.
      if (archivedIds.has(String(conversationId))) {
        alreadyArchived++;
      }
      const meaningful = messages.filter((m) => m.text.trim().length > 0);
      const meaningfulAuthors = new Set(meaningful.map((m) => m.author));
      if (meaningful.length < 2 || meaningfulAuthors.size < 2) {
        skippedShort++;
        continue;
      }
      const alanPlayerId = authors.find((a) => nameByPlayerId.get(a) === ALAN_NAME)!;
      const characterPlayerId = authors.find((a) => nameByPlayerId.get(a) !== ALAN_NAME);
      if (!characterPlayerId) {
        skippedShort++;
        continue;
      }
      const characterAgentId = agentByPlayerId.get(characterPlayerId);
      if (!characterAgentId) {
        // No agent for this character (e.g. retired pilot) — cannot build a
        // recallable memory, so skip rather than write a dangling archive.
        skippedShort++;
        continue;
      }
      const last = messages[messages.length - 1];
      items.push({
        conversationId,
        characterName: nameByPlayerId.get(characterPlayerId) ?? characterPlayerId,
        characterPlayerId,
        characterAgentId,
        alanPlayerId,
        created: messages[0]._creationTime,
        ended: last._creationTime,
        numMessages: messages.length,
        lastMessageAuthor: last.author,
        lastMessageTimestamp: last._creationTime,
        participants: [characterPlayerId, alanPlayerId],
      });
    }
    items.sort((a, b) => a.created - b.created);
    return { worldId, items, alreadyArchived, skippedShort, skippedNoAlan };
  },
});

export const archiveOrphanConversation = internalMutation({
  args: {
    worldId: v.id('worlds'),
    item: v.any(),
  },
  handler: async (ctx, args) => {
    const item = args.item as BackfillItem;
    const existing = await ctx.db
      .query('archivedConversations')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('id', item.conversationId))
      .first();
    if (!existing) {
      await ctx.db.insert('archivedConversations', {
        worldId: args.worldId,
        id: item.conversationId,
        creator: item.alanPlayerId,
        created: item.created,
        ended: item.ended,
        lastMessage: { author: item.lastMessageAuthor, timestamp: item.lastMessageTimestamp },
        numMessages: item.numMessages,
        participants: item.participants,
      });
    }
    // participatedTogether: write both directions if missing (the memory loader
    // looks up player1 = the remembering character, player2 = the other).
    for (const [player1, player2] of [
      [item.characterPlayerId, item.alanPlayerId],
      [item.alanPlayerId, item.characterPlayerId],
    ]) {
      const edge = await ctx.db
        .query('participatedTogether')
        .withIndex('conversation', (q) =>
          q.eq('worldId', args.worldId).eq('player1', player1).eq('conversationId', item.conversationId),
        )
        .first();
      if (!edge) {
        await ctx.db.insert('participatedTogether', {
          worldId: args.worldId,
          conversationId: item.conversationId,
          player1,
          player2,
          ended: item.ended,
        });
      }
    }
    return { archived: !existing };
  },
});

export const hasConversationMemory = internalQuery({
  args: { playerId: v.string(), conversationId: v.string() },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query('memories')
      .withIndex('playerId_type', (q) =>
        q.eq('playerId', args.playerId).eq('data.type', 'conversation'),
      )
      .order('desc')
      .take(200);
    return memories.some(
      (memory) =>
        memory.data.type === 'conversation' &&
        String(memory.data.conversationId) === String(args.conversationId),
    );
  },
});

// Delete conversation memories (and their embeddings) that this backfill wrote,
// identified by conversationId + a creation-time floor, so a corrected re-run
// can regenerate them. Only touches memories created at/after `createdAfter`,
// leaving any pre-existing legit memories intact.
export const purgeBackfilledMemories = internalMutation({
  args: {
    worldId: v.optional(v.id('worlds')),
    createdAfter: v.number(),
  },
  handler: async (ctx, args) => {
    const worldId = args.worldId ?? (await defaultWorldId(ctx));
    const plan = await ctx.db
      .query('archivedConversations')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    // Re-derive the Alan two-sided conversation ids from messages, since plan()
    // now reports them as already-archived.
    const descriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const nameByPlayerId = new Map(descriptions.map((d) => [d.playerId, d.name]));
    const targetConversationIds = new Set<string>();
    const allMessages = await ctx.db.query('messages').collect();
    const byConversation = new Map<string, typeof allMessages>();
    for (const message of allMessages) {
      if (message.worldId !== worldId) continue;
      const list = byConversation.get(message.conversationId) ?? [];
      list.push(message);
      byConversation.set(message.conversationId, list);
    }
    for (const [conversationId, messages] of byConversation) {
      const authorNames = [...new Set(messages.map((m) => nameByPlayerId.get(m.author)))];
      if (authorNames.includes(ALAN_NAME) && authorNames.some((n) => n && n !== ALAN_NAME)) {
        targetConversationIds.add(conversationId);
      }
    }
    let deletedMemories = 0;
    let deletedEmbeddings = 0;
    for (const memory of await ctx.db.query('memories').collect()) {
      if (memory.data.type !== 'conversation') continue;
      if (!targetConversationIds.has(String(memory.data.conversationId))) continue;
      if (memory._creationTime < args.createdAfter) continue;
      if (memory.embeddingId) {
        const embedding = await ctx.db.get(memory.embeddingId);
        if (embedding) {
          await ctx.db.delete(memory.embeddingId);
          deletedEmbeddings++;
        }
      }
      await ctx.db.delete(memory._id);
      deletedMemories++;
    }
    return { deletedMemories, deletedEmbeddings, plannedCount: plan.length };
  },
});

// Safety net for the take(200) limit in run()'s existence guard: if a character
// has more than 200 conversation memories, the guard can miss an old one and a
// re-run can write a duplicate. This collapses any (playerId, conversationId)
// duplicates down to the earliest memory (the original), deleting the rest plus
// their embeddings.
export const dedupeConversationMemories = internalMutation({
  args: {},
  handler: async (ctx) => {
    const memories = await ctx.db.query('memories').collect();
    const byKey = new Map<string, typeof memories>();
    for (const memory of memories) {
      if (memory.data.type !== 'conversation') continue;
      const key = `${memory.playerId}|${String(memory.data.conversationId)}`;
      const list = byKey.get(key) ?? [];
      list.push(memory);
      byKey.set(key, list);
    }
    let deletedMemories = 0;
    let deletedEmbeddings = 0;
    for (const list of byKey.values()) {
      if (list.length <= 1) continue;
      list.sort((a, b) => a._creationTime - b._creationTime);
      for (const memory of list.slice(1)) {
        if (memory.embeddingId) {
          const embedding = await ctx.db.get(memory.embeddingId);
          if (embedding) {
            await ctx.db.delete(memory.embeddingId);
            deletedEmbeddings++;
          }
        }
        await ctx.db.delete(memory._id);
        deletedMemories++;
      }
    }
    return { deletedMemories, deletedEmbeddings };
  },
});

export const run = internalAction({
  args: { worldId: v.optional(v.id('worlds')), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<RunSummary> => {
    const plan = (await ctx.runQuery(internal.underworldOrphanBackfill.planAlanOrphanBackfill, {
      worldId: args.worldId,
    })) as PlanResult;
    const summary: RunSummary = {
      worldId: plan.worldId,
      eligible: plan.items.length,
      alreadyArchived: plan.alreadyArchived,
      skippedShort: plan.skippedShort,
      dryRun: Boolean(args.dryRun),
      archivedNow: 0,
      memoriesWritten: 0,
      memoriesSkippedExisting: 0,
      details: [] as any[],
    };
    for (const item of plan.items as BackfillItem[]) {
      if (args.dryRun) {
        summary.details.push({
          conversationId: item.conversationId,
          character: item.characterName,
          numMessages: item.numMessages,
          action: 'would archive + remember',
        });
        continue;
      }
      const archiveResult = (await ctx.runMutation(
        internal.underworldOrphanBackfill.archiveOrphanConversation,
        { worldId: plan.worldId, item },
      )) as { archived: boolean };
      if (archiveResult.archived) summary.archivedNow++;

      const already = (await ctx.runQuery(
        internal.underworldOrphanBackfill.hasConversationMemory,
        { playerId: item.characterPlayerId, conversationId: item.conversationId },
      )) as boolean;
      let memoryStatus = 'skipped_existing';
      if (already) {
        summary.memoriesSkippedExisting++;
      } else {
        await rememberConversation(
          ctx,
          plan.worldId as Id<'worlds'>,
          item.characterAgentId as GameId<'agents'>,
          item.characterPlayerId as GameId<'players'>,
          item.conversationId as GameId<'conversations'>,
        );
        const wroteMemory = (await ctx.runQuery(
          internal.underworldOrphanBackfill.hasConversationMemory,
          { playerId: item.characterPlayerId, conversationId: item.conversationId },
        )) as boolean;
        if (wroteMemory) {
          summary.memoriesWritten++;
          memoryStatus = 'written';
        } else {
          // rememberConversation has its own quality gates (dialogue-leak,
          // drift, etc.); a skip here is intentional, not an error.
          memoryStatus = 'skipped_by_memory_gate';
        }
      }
      summary.details.push({
        conversationId: item.conversationId,
        character: item.characterName,
        numMessages: item.numMessages,
        archived: archiveResult.archived,
        memory: memoryStatus,
      });
    }
    return summary;
  },
});

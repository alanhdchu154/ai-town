import { v } from 'convex/values';
import { MutationCtx, internalMutation, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { insertInput } from './aiTown/insertInput';
import { kickEngine, startEngine } from './aiTown/main';
import { conversationId, playerId } from './aiTown/ids';
import { Id } from './_generated/dataModel';

const DEFAULT_CLOCK = {
  hour: 9,
  minute: 0,
  day: 1,
  week: 1,
  semester: 1,
  timeSpeed: Number(process.env.TIME_SPEED) || 60,
  lastUpdated: 0,
};
const GIIS_WORLD_START_REAL_DATE = Date.UTC(2026, 4, 19, 5, 0, 0);

function logGiisTiming(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  console.log('[GIIS timing]', payload);
}

async function wakeWorldForConversationInput(ctx: MutationCtx, worldId: Id<'worlds'>) {
  const worldStatus = await ctx.db
    .query('worldStatus')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .first();
  if (!worldStatus || worldStatus.status === 'stoppedByDeveloper') return;
  const engine = await ctx.db.get(worldStatus.engineId);
  if (!engine) return;
  const now = Date.now();
  if (worldStatus.status !== 'running') {
    await ctx.db.patch(worldStatus._id, { status: 'running', lastViewed: now });
  } else if (!worldStatus.lastViewed || worldStatus.lastViewed < now) {
    await ctx.db.patch(worldStatus._id, { lastViewed: now });
  }
  try {
    if (!engine.running) {
      await startEngine(ctx, worldId);
    } else {
      await kickEngine(ctx, worldId);
    }
  } catch (error) {
    console.warn('[GIIS timing] failed to wake world after conversation input', {
      worldId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const wakeWorldForConversationInputAfterWrite = internalMutation({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    await wakeWorldForConversationInput(ctx, args.worldId);
  },
});

function localTimeParts(now = Date.now(), timeZone = 'America/Chicago') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(now));
  return {
    hour: Number(parts.find((part) => part.type === 'hour')?.value ?? 9) % 24,
    minute: Number(parts.find((part) => part.type === 'minute')?.value ?? 0),
  };
}

function worldDayFromStart(now: number, worldStartRealDate?: number) {
  const start = worldStartRealDate ?? GIIS_WORLD_START_REAL_DATE;
  return Math.max(1, Math.floor((now - start) / 86_400_000) + 1);
}

function clockAt(now: number, timeZone = 'America/Chicago', worldStartRealDate?: number) {
  const { hour, minute } = localTimeParts(now, timeZone);
  return {
    ...DEFAULT_CLOCK,
    hour,
    minute,
    day: worldDayFromStart(now, worldStartRealDate),
    week: 1,
    semester: 1,
    lastUpdated: now,
  };
}

function periodLabelZh(hour: number) {
  if (hour >= 6 && hour < 9) return '早晨';
  if (hour >= 9 && hour < 13) return '白天';
  if (hour >= 13 && hour < 17) return '下午';
  if (hour >= 17 && hour < 24) return '晚上';
  return '深夜';
}

function worldTimeLabelZh(clock: typeof DEFAULT_CLOCK) {
  const hour12 = clock.hour % 12 === 0 ? 12 : clock.hour % 12;
  return `第 ${clock.day} 天 ${periodLabelZh(clock.hour)} ${hour12}:${String(clock.minute ?? 0).padStart(2, '0')}`;
}

export const listMessages = query({
  args: {
    worldId: v.id('worlds'),
    conversationId,
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('messages')
      .withIndex('conversationId', (q) => q.eq('worldId', args.worldId).eq('conversationId', args.conversationId))
      .collect();
    const out = [];
    for (const message of messages) {
      const playerDescription = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', message.author))
        .first();
      // Stabilization: old messages can remain after a roster repair / cleanup.
      // Rendering chat history should be best-effort, not crash the whole query.
      out.push({
        ...message,
        authorName: playerDescription?.name ?? message.author,
      });
    }
    return out;
  },
});

export const writeMessage = mutation({
  args: {
    worldId: v.id('worlds'),
    conversationId,
    messageUuid: v.string(),
    playerId,
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const mutationStart = Date.now();
    const now = Date.now();
    const existingMessage = await ctx.db
      .query('messages')
      .withIndex('messageUuid', (q) =>
        q.eq('conversationId', args.conversationId).eq('messageUuid', args.messageUuid),
      )
      .first();
    if (existingMessage) {
      logGiisTiming({
        action: 'writeMessage',
        phase: 'duplicateMessageUuidSkipped',
        ms: Date.now() - mutationStart,
        playerId: args.playerId,
      });
      return;
    }
    const authorDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.playerId))
      .first();

    const messageInsertStart = Date.now();
    await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      author: args.playerId,
      messageUuid: args.messageUuid,
      text: args.text,
      worldId: args.worldId,
    });
    logGiisTiming({
      action: 'writeMessage',
      phase: 'messageInsertTime',
      ms: Date.now() - messageInsertStart,
      playerId: args.playerId,
    });

    if (authorDescription?.name === 'Alan') {
      const timelineStart = Date.now();
      const world = await ctx.db.get(args.worldId);
      const conversation = world?.conversations.find(
        (conversation) => conversation.id === args.conversationId,
      );
      const observerPlayerIds =
        conversation?.participants.map((participant) => participant.playerId) ?? [args.playerId];
      const targetPlayerId = observerPlayerIds.find((id) => id !== args.playerId);
      const targetDescription = targetPlayerId
        ? await ctx.db
            .query('playerDescriptions')
            .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', targetPlayerId))
            .first()
        : undefined;
      const worldStatus = await ctx.db
        .query('worldStatus')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
        .first();
      const worldStartRealDate = GIIS_WORLD_START_REAL_DATE;
      const worldStartTimeZone = worldStatus?.worldStartTimeZone ?? 'America/Chicago';
      const clock = clockAt(now, worldStartTimeZone, worldStartRealDate);
      if (worldStatus) {
        await ctx.db.patch(worldStatus._id, {
          worldStartRealDate,
          worldStartTimeZone,
          worldClock: clock,
        });
      }
      const descriptionZh = `Alan 說：「${args.text.trim()}」`;
      await ctx.db.insert('worldEvents', {
        worldId: args.worldId,
        eventId: `alan_chat_${now}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'chatMessage',
        conversationId: args.conversationId,
        actorPlayerId: args.playerId,
        targetPlayerId,
        actorName: 'Alan',
        targetName: targetDescription?.name,
        source: 'player_action',
        happenedDuringAlanPresence: 'online',
        observerPlayerIds,
        descriptionZh,
        descriptionEn: `Alan said: ${args.text.trim()}`,
        interpretationZh: 'Alan 直接以本人身分在對話中發言；這只是今日紀錄，不等於已形成情緒殘留。',
        futureImplicationsZh: '只有通過 residue gate 的對話，才會變成角色之後會帶著的記憶壓力。',
        importance: 5,
        createdAt: now,
        createdAtUnix: now,
        createdAtIso: new Date(now).toISOString(),
        createdAtTimeZone: worldStartTimeZone,
        worldTimeLabelZh: worldTimeLabelZh(clock),
        clock,
      });
      logGiisTiming({
        action: 'writeMessage',
        phase: 'timelineUpdateTime',
        ms: Date.now() - timelineStart,
        eventType: 'chatMessage',
      });
    }

    const inputStart = Date.now();
    await insertInput(ctx, args.worldId, 'finishSendingMessage', {
      conversationId: args.conversationId,
      playerId: args.playerId,
      timestamp: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.messages.wakeWorldForConversationInputAfterWrite, {
      worldId: args.worldId,
    });
    logGiisTiming({
      action: 'writeMessage',
      phase: 'finishSendingInputTime',
      ms: Date.now() - inputStart,
      playerId: args.playerId,
    });
    logGiisTiming({
      action: 'writeMessage',
      phase: 'convexMutationTotalTime',
      ms: Date.now() - mutationStart,
      playerId: args.playerId,
    });
  },
});

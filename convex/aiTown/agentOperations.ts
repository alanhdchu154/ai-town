import { v } from 'convex/values';
import { internalAction } from '../_generated/server';
import { WorldMap, serializedWorldMap } from './worldMap';
import { rememberConversation } from '../agent/memory';
import { GameId, agentId, conversationId, playerId } from './ids';
import {
  continueConversationMessage,
  leaveConversationMessage,
  startConversationMessage,
} from '../agent/conversation';
import { assertNever } from '../util/assertNever';
import { serializedAgent } from './agent';
import {
  ACTIVITIES,
  ACTIVITY_COOLDOWN,
  CONVERSATION_COOLDOWN,
} from '../constants';
import { api, internal } from '../_generated/api';
import { sleep } from '../util/sleep';
import { serializedPlayer } from './player';
import {
  ClassroomWalkBounds,
  clampToClassroom,
  randomClassroomTile,
} from '../../data/classroomBounds';
import { SchoolLocations } from '../../data/schoolLocations';

function logGiisTiming(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  console.log('[GIIS timing]', payload);
}

function envNumber(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function autonomousConversationChanceMultiplier() {
  return envNumber('AUTONOMOUS_CONVERSATION_CHANCE_MULTIPLIER', 1, 0, 2);
}

function conversationCooldownMs() {
  return envNumber('CONVERSATION_COOLDOWN_MS', CONVERSATION_COOLDOWN, 10_000, 15 * 60_000);
}

function scheduleMovementEnabled() {
  return process.env.ENABLE_SCHEDULE_MOVEMENT === 'true';
}

function daytimeActivityDuration(minutes: number) {
  return minutes * 60_000;
}

async function sendInputWithRetry(ctx: any, payload: Record<string, unknown>, attempts = 4) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await ctx.runMutation(api.aiTown.main.sendInput, payload);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await sleep(80 + Math.random() * 240 * (attempt + 1));
    }
  }
  throw lastError;
}

type ScheduleContext = {
  schedule: string;
  isSleepHour?: boolean;
  isWindingDownHour?: boolean;
  canStartAutonomousConversations?: boolean;
  periodLabelZh?: string;
  characterName?: string;
  location: {
    id: string;
    labelZh: string;
    position: { x: number; y: number };
  };
};

export const agentRememberConversation = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await rememberConversation(
        ctx,
        args.worldId,
        args.agentId as GameId<'agents'>,
        args.playerId as GameId<'players'>,
        args.conversationId as GameId<'conversations'>,
      );
      await sleep(Math.random() * 1000);
      await sendInputWithRetry(ctx, {
        worldId: args.worldId,
        name: 'finishRememberConversation',
        args: {
          agentId: args.agentId,
          operationId: args.operationId,
        },
      });
    } catch (error) {
      console.error('agentRememberConversation failed; clearing operation', error);
      try {
        await sendInputWithRetry(ctx, {
          worldId: args.worldId,
          name: 'clearAgentOperation',
          args: {
            agentId: args.agentId,
            operationId: args.operationId,
            conversationId: args.conversationId,
          },
        });
      } catch (clearError) {
        console.error('agentRememberConversation failed to clear operation', clearError);
      }
      logGiisTiming({
        action: 'rememberConversation',
        phase: 'rememberFailureCleared',
        playerId: args.playerId,
      });
    }
  },
});

export const agentGenerateMessage = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    otherPlayerId: playerId,
    operationId: v.string(),
    type: v.union(v.literal('start'), v.literal('continue'), v.literal('leave')),
    messageUuid: v.string(),
  },
  handler: async (ctx, args) => {
    const totalStart = Date.now();
    try {
      let completionFn;
      switch (args.type) {
        case 'start':
          completionFn = startConversationMessage;
          break;
        case 'continue':
          completionFn = continueConversationMessage;
          break;
        case 'leave':
          completionFn = leaveConversationMessage;
          break;
        default:
          assertNever(args.type);
      }
      const generationStart = Date.now();
      const rawText = await completionFn(
        ctx,
        args.worldId,
        args.conversationId as GameId<'conversations'>,
        args.playerId as GameId<'players'>,
        args.otherPlayerId as GameId<'players'>,
      );
      logGiisTiming({
        action: 'agentGenerateMessage',
        phase: 'llmGenerationTotalTime',
        ms: Date.now() - generationStart,
        type: args.type,
        playerId: args.playerId,
      });
      const shouldAbortConversation = rawText.startsWith('[ABORT_CONVERSATION]');
      if (shouldAbortConversation) {
        await sendInputWithRetry(ctx, {
          worldId: args.worldId,
          name: 'agentAbortConversation',
          args: {
            agentId: args.agentId,
            conversationId: args.conversationId,
            operationId: args.operationId,
          },
        });
        return;
      }
      const shouldLeave = rawText.startsWith('[LEAVE]');
      const text = shouldLeave ? rawText.replace(/^\[LEAVE\]\s*/, '') : rawText;

      const sendStart = Date.now();
      await ctx.runMutation(internal.aiTown.agent.agentSendMessage, {
        worldId: args.worldId,
        conversationId: args.conversationId,
        agentId: args.agentId,
        playerId: args.playerId,
        text,
        messageUuid: args.messageUuid,
        leaveConversation: args.type === 'leave' || shouldLeave,
        operationId: args.operationId,
      });
      logGiisTiming({
        action: 'agentGenerateMessage',
        phase: 'agentMessageInsertTime',
        ms: Date.now() - sendStart,
        type: args.type,
        playerId: args.playerId,
      });
    } catch (error) {
      console.error('agentGenerateMessage failed; clearing operation', error);
      try {
        await sendInputWithRetry(ctx, {
          worldId: args.worldId,
          name: 'clearAgentOperation',
          args: {
            agentId: args.agentId,
            operationId: args.operationId,
            conversationId: args.conversationId,
          },
        });
      } catch (clearError) {
        console.error('agentGenerateMessage failed to clear operation', clearError);
      }
      logGiisTiming({
        action: 'agentGenerateMessage',
        phase: 'generationFailureCleared',
        ms: Date.now() - totalStart,
        type: args.type,
        playerId: args.playerId,
      });
    } finally {
      logGiisTiming({
        action: 'agentGenerateMessage',
        phase: 'totalResponseActionTime',
        ms: Date.now() - totalStart,
        type: args.type,
        playerId: args.playerId,
      });
    }
  },
});

export const agentDoSomething = internalAction({
  args: {
    worldId: v.id('worlds'),
    player: v.object(serializedPlayer),
    agent: v.object(serializedAgent),
    map: v.object(serializedWorldMap),
    otherFreePlayers: v.array(v.object(serializedPlayer)),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const { player, agent } = args;
      const map = new WorldMap(args.map);
      const now = Date.now();
      const scheduleContext = await loadScheduleContext(ctx, args.worldId, player.id);
    // Don't try to start a new conversation if we were just in one.
    const justLeftConversation =
      agent.lastConversation && now < agent.lastConversation + conversationCooldownMs();
    // Don't try again if we recently tried to find someone to invite.
    const recentlyAttemptedInvite =
      agent.lastInviteAttempt && now < agent.lastInviteAttempt + conversationCooldownMs();
    const recentActivity = player.activity && now < player.activity.until + ACTIVITY_COOLDOWN;
    const nightActivity = schoolActivity(scheduleContext);
    const shouldSeekConversation =
      scheduleContext?.canStartAutonomousConversations !== false &&
      Math.random() < autonomousConversationChance(scheduleContext);
    if (scheduleContext?.isSleepHour) {
      await sleep(Math.random() * 700);
      await sendInputWithRetry(ctx, {
        worldId: args.worldId,
        name: 'finishDoSomething',
        args: {
          operationId: args.operationId,
          agentId: args.agent.id,
          destination: scheduleMovementDestination(map, scheduleContext),
          activity: {
            description: nightActivity.description,
            emoji: nightActivity.emoji,
            until: Date.now() + nightActivity.duration,
          },
        },
      });
      return;
    }
    // Decide whether to talk, do an activity, or wander somewhere.
    if (!player.pathfinding) {
      if (recentActivity || justLeftConversation) {
        const quietUntil =
          justLeftConversation && agent.lastConversation
            ? agent.lastConversation + conversationCooldownMs()
            : now + ACTIVITY_COOLDOWN;
        await sleep(Math.random() * 1000);
        await sendInputWithRetry(ctx, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            destination: scheduleMovementDestination(map, scheduleContext),
            activity: {
              description: justLeftConversation ? '整理剛才的對話' : '整理當前狀態',
              emoji: '📝',
              until: quietUntil,
            },
          },
        });
        return;
      }
      if (shouldSeekConversation && !recentlyAttemptedInvite) {
        const invitee = await ctx.runQuery(internal.aiTown.agent.findConversationCandidate, {
          now,
          worldId: args.worldId,
          player: args.player,
          otherFreePlayers: args.otherFreePlayers,
        });
        if (invitee) {
          await sleep(Math.random() * 1000);
          await sendInputWithRetry(ctx, {
            worldId: args.worldId,
            name: 'finishDoSomething',
            args: {
              operationId: args.operationId,
              agentId: agent.id,
              invitee,
            },
          });
          return;
        }
      }
      const activity = schoolActivity(scheduleContext);
      await sleep(Math.random() * 1000);
      await sendInputWithRetry(ctx, {
        worldId: args.worldId,
        name: 'finishDoSomething',
        args: {
          operationId: args.operationId,
          agentId: agent.id,
          destination: scheduleMovementDestination(map, scheduleContext),
          activity: {
            description: activity.description,
            emoji: activity.emoji,
            until: Date.now() + activity.duration,
          },
        },
      });
      return;
    }
    const invitee =
      justLeftConversation || recentlyAttemptedInvite || !shouldSeekConversation
        ? undefined
        : await ctx.runQuery(internal.aiTown.agent.findConversationCandidate, {
            now,
            worldId: args.worldId,
            player: args.player,
            otherFreePlayers: args.otherFreePlayers,
          });

    if (!invitee) {
      const activity = schoolActivity(scheduleContext);
      if (Math.random() < 0.35) {
        await sleep(Math.random() * 1000);
        await sendInputWithRetry(ctx, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            destination: scheduleMovementDestination(map, scheduleContext),
            activity: {
              description: activity.description,
              emoji: activity.emoji,
              until: Date.now() + activity.duration,
            },
          },
        });
        return;
      }
    }

    // TODO: We hit a lot of OCC errors on sending inputs in this file. It's
    // easy for them to get scheduled at the same time and line up in time.
    await sleep(Math.random() * 1000);
      await sendInputWithRetry(ctx, {
        worldId: args.worldId,
        name: 'finishDoSomething',
        args: {
          operationId: args.operationId,
          agentId: args.agent.id,
          invitee,
        },
      });
    } catch (error) {
      console.error('agentDoSomething failed; clearing operation', error);
      try {
        await sendInputWithRetry(ctx, {
          worldId: args.worldId,
          name: 'clearAgentOperation',
          args: {
            agentId: args.agent.id,
            operationId: args.operationId,
          },
        });
      } catch (clearError) {
        console.error('agentDoSomething failed to clear operation', clearError);
      }
    }
  },
});

async function loadScheduleContext(
  ctx: any,
  worldId: string,
  playerId?: string,
): Promise<ScheduleContext | undefined> {
  try {
    return await ctx.runQuery(internal.school.currentScheduleContext, { worldId, playerId });
  } catch (error) {
    console.debug('Falling back to random agent schedule context', error);
    return undefined;
  }
}

function schoolActivity(scheduleContext?: ScheduleContext) {
  if (!scheduleContext) {
    return ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
  }
  if (scheduleContext.isSleepHour) {
    return {
      description: '睡眠中',
      emoji: '💤',
      duration: 30 * 60_000,
    };
  }
  if (scheduleContext.isWindingDownHour) {
    return {
      description: `在${scheduleContext.location.labelZh}準備休息`,
      emoji: '🌙',
      duration: 10 * 60_000,
    };
  }
  switch (scheduleContext.location.id) {
    case 'classroom':
      return {
        description: `在${scheduleContext.location.labelZh}整理課堂筆記`,
        emoji: '📚',
        duration: daytimeActivityDuration(6),
      };
    case 'courtyard':
      return {
        description: `在${scheduleContext.location.labelZh}交換校園傳聞`,
        emoji: '💬',
        duration: daytimeActivityDuration(6),
      };
    case 'aiClubRoom':
      return {
        description: `在${scheduleContext.location.labelZh}討論 Alan 的實驗`,
        emoji: '🧪',
        duration: daytimeActivityDuration(7),
      };
    case 'studentCouncilRoom':
      return {
        description: `在${scheduleContext.location.labelZh}討論校園影響力`,
        emoji: '🏫',
        duration: daytimeActivityDuration(7),
      };
    case 'dormitory':
      return {
        description: `在${scheduleContext.location.labelZh}整理心情與祕密`,
        emoji: '🌙',
        duration: daytimeActivityDuration(8),
      };
    default:
      return {
        description: `在${scheduleContext.location.labelZh}處理校園事務`,
        emoji: '📝',
        duration: daytimeActivityDuration(6),
      };
  }
}

function autonomousConversationChance(scheduleContext?: ScheduleContext) {
  if (process.env.UMI_MAHIRU_COLOCATION_PILOT === 'true') {
    return scheduleContext?.characterName === 'Umi' || scheduleContext?.characterName === 'Mahiru Shiina'
      ? 1
      : 0;
  }
  let base = 0.25;
  if (scheduleContext?.isSleepHour) return 0;
  if (scheduleContext?.isWindingDownHour) base = 0.12;
  else if (scheduleContext?.location.id === 'courtyard') base = 0.42;
  else if (scheduleContext?.location.id === 'dormitory') base = 0.24;
  else if (scheduleContext?.location.id === 'classroom') base = 0.28;
  else if (scheduleContext) base = 0.34;
  return Math.max(0, Math.min(1, base * autonomousConversationChanceMultiplier()));
}

function scheduleDestination(worldMap: WorldMap, scheduleContext?: ScheduleContext) {
  if (scheduleContext) {
    const location = SchoolLocations.find((item) => item.id === scheduleContext.location.id);
    const spawnPoints = location?.spawnPoints ?? [scheduleContext.location.position];
    const basePoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    const candidateOffsets = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 },
      { x: 2, y: 0 },
      { x: -2, y: 0 },
      { x: 0, y: 2 },
      { x: 0, y: -2 },
      { x: 2, y: 1 },
      { x: -2, y: 1 },
      { x: 1, y: -2 },
      { x: -1, y: -2 },
    ];
    const directCandidates = [basePoint, ...spawnPoints, scheduleContext.location.position]
      .flatMap((point) => shuffledOffsets(candidateOffsets).map((offset) => ({
        x: point.x + offset.x,
        y: point.y + offset.y,
      })))
      .map((point) => clampToClassroom({
        x: clampTile(Math.round(point.x), worldMap.width),
        y: clampTile(Math.round(point.y), worldMap.height),
      }))
      .filter((point, index, points) =>
        points.findIndex((candidate) => candidate.x === point.x && candidate.y === point.y) === index,
      );
    const safeCandidate = directCandidates.find((point) => isWalkableMapTile(worldMap, point));
    if (safeCandidate) return safeCandidate;
  }
  return randomWalkableClassroomTile(worldMap);
}

function scheduleMovementDestination(worldMap: WorldMap, scheduleContext?: ScheduleContext) {
  return scheduleMovementEnabled() ? scheduleDestination(worldMap, scheduleContext) : undefined;
}

function clampTile(value: number, max: number) {
  return Math.min(Math.max(value, 1), max - 2);
}

function shuffledOffsets<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function randomWalkableClassroomTile(worldMap: WorldMap) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = randomClassroomTile();
    if (isWalkableMapTile(worldMap, candidate)) return candidate;
  }
  for (let y = ClassroomWalkBounds.minY; y <= ClassroomWalkBounds.maxY; y++) {
    for (let x = ClassroomWalkBounds.minX; x <= ClassroomWalkBounds.maxX; x++) {
      const candidate = { x, y };
      if (isWalkableMapTile(worldMap, candidate)) return candidate;
    }
  }
  return clampToClassroom({ x: worldMap.width / 2, y: worldMap.height / 2 });
}

function isWalkableMapTile(worldMap: WorldMap, point: { x: number; y: number }) {
  if (point.x < 0 || point.y < 0 || point.x >= worldMap.width || point.y >= worldMap.height) {
    return false;
  }
  for (const layer of worldMap.objectTiles) {
    if (layer[Math.floor(point.x)]?.[Math.floor(point.y)] !== -1) {
      return false;
    }
  }
  return true;
}

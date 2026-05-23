import { ObjectType, v } from 'convex/values';
import { Id } from '../_generated/dataModel';
import { GameId, parseGameId } from './ids';
import { agentId, conversationId, playerId } from './ids';
import { Player, serializedPlayer } from './player';
import { Game } from './game';
import {
  ACTION_TIMEOUT,
  ACTIVITY_COOLDOWN,
  AWKWARD_CONVERSATION_TIMEOUT,
  CONVERSATION_COOLDOWN,
  CONVERSATION_DISTANCE,
  INVITE_ACCEPT_PROBABILITY,
  INVITE_TIMEOUT,
  MAX_CONVERSATION_DURATION,
  MAX_CONVERSATION_MESSAGES,
  MESSAGE_COOLDOWN,
  MIDPOINT_THRESHOLD,
  PLAYER_CONVERSATION_COOLDOWN,
} from '../constants';
import { FunctionArgs } from 'convex/server';
import { MutationCtx, internalMutation, internalQuery } from '../_generated/server';
import { distance, pointsEqual } from '../util/geometry';
import { Point } from '../util/types';
import { internal } from '../_generated/api';
import { blocked, findRoute, movePlayer } from './movement';
import { insertInput } from './insertInput';

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

function envNumber(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function conversationCooldownMs() {
  return envNumber('CONVERSATION_COOLDOWN_MS', CONVERSATION_COOLDOWN, 10_000, 15 * 60_000);
}

function playerConversationCooldownMs() {
  return envNumber(
    'PLAYER_CONVERSATION_COOLDOWN_MS',
    PLAYER_CONVERSATION_COOLDOWN,
    30_000,
    30 * 60_000,
  );
}

function inviteAcceptProbability() {
  return envNumber('INVITE_ACCEPT_PROBABILITY', INVITE_ACCEPT_PROBABILITY, 0, 1);
}

function maxConversationMessages() {
  return envNumber('MAX_CONVERSATION_MESSAGES', MAX_CONVERSATION_MESSAGES, 2, 12);
}

function conversationSingleFlightEnabled() {
  return process.env.CONVERSATION_SINGLE_FLIGHT !== 'false';
}

function umiMahiruPilotEnabled() {
  return process.env.UMI_MAHIRU_COLOCATION_PILOT === 'true';
}

function umiMahiruSingleSampleAfterMs(): number | undefined {
  const raw = process.env.UMI_MAHIRU_SINGLE_SAMPLE_AFTER_MS;
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function isUmiMahiruPilotConversation(leftPlayerId: GameId<'players'>, rightPlayerId: GameId<'players'>) {
  if (!umiMahiruPilotEnabled()) return false;
  const ids = new Set([leftPlayerId, rightPlayerId]);
  return ids.has('p:0' as GameId<'players'>) && ids.has('p:707' as GameId<'players'>);
}

function agentActionSingleFlightEnabled() {
  return process.env.AGENT_ACTION_SINGLE_FLIGHT !== 'false';
}

function actionTimeoutMs(operationName?: string) {
  if (operationName === 'agentGenerateMessage') {
    return envNumber('AGENT_GENERATE_MESSAGE_TIMEOUT_MS', 600_000, ACTION_TIMEOUT, 30 * 60_000);
  }
  return envNumber('AGENT_ACTION_TIMEOUT_MS', ACTION_TIMEOUT, 10_000, 30 * 60_000);
}

function hasActiveAgentDoSomething(game: Game, now: number, currentAgentId: GameId<'agents'>) {
  if (!agentActionSingleFlightEnabled()) return false;
  for (const agent of game.world.agents.values()) {
    const operation = agent.inProgressOperation;
    if (!operation || agent.id === currentAgentId) continue;
    if (operation.name !== 'agentDoSomething') continue;
    if (now < operation.started + actionTimeoutMs(operation.name)) return true;
  }
  return false;
}

function hasActiveConversationGeneration(
  game: Game,
  now: number,
  currentAgentId: GameId<'agents'>,
  priorityPilot = false,
) {
  if (!conversationSingleFlightEnabled()) return false;
  for (const agent of game.world.agents.values()) {
    const operation = agent.inProgressOperation;
    if (!operation || agent.id === currentAgentId) continue;
    if (operation.name !== 'agentGenerateMessage') continue;
    if (priorityPilot && agent.playerId !== 'p:0' && agent.playerId !== 'p:707') continue;
    if (now < operation.started + actionTimeoutMs(operation.name)) {
      return true;
    }
  }
  return false;
}

export class Agent {
  id: GameId<'agents'>;
  playerId: GameId<'players'>;
  toRemember?: GameId<'conversations'>;
  lastConversation?: number;
  lastInviteAttempt?: number;
  inProgressOperation?: {
    name: string;
    operationId: string;
    started: number;
  };

  constructor(serialized: SerializedAgent) {
    const { id, lastConversation, lastInviteAttempt, inProgressOperation } = serialized;
    const playerId = parseGameId('players', serialized.playerId);
    this.id = parseGameId('agents', id);
    this.playerId = playerId;
    this.toRemember =
      serialized.toRemember !== undefined
        ? parseGameId('conversations', serialized.toRemember)
        : undefined;
    this.lastConversation = lastConversation;
    this.lastInviteAttempt = lastInviteAttempt;
    this.inProgressOperation = inProgressOperation;
  }

  tick(game: Game, now: number) {
    const player = game.world.players.get(this.playerId);
    if (!player) {
      throw new Error(`Invalid player ID ${this.playerId}`);
    }
    if (this.inProgressOperation) {
      if (now < this.inProgressOperation.started + actionTimeoutMs(this.inProgressOperation.name)) {
        // Wait on the operation to finish.
        return;
      }
      console.log(`Timing out ${JSON.stringify(this.inProgressOperation)}`);
      delete this.inProgressOperation;
    }
    const conversation = game.world.playerConversation(player);
    const member = conversation?.participants.get(player.id);

    const recentlyAttemptedInvite =
      this.lastInviteAttempt && now < this.lastInviteAttempt + conversationCooldownMs();
    const doingActivity = Boolean(player.activity && player.activity.until > now);
    const recentlyFinishedActivity = Boolean(
      player.activity && now < player.activity.until + ACTIVITY_COOLDOWN,
    );
    const recentlyLeftConversation = Boolean(
      this.lastConversation && now < this.lastConversation + ACTIVITY_COOLDOWN,
    );
    if (doingActivity && (conversation || player.pathfinding)) {
      player.activity!.until = now;
    }
    // Remember completed conversations before scheduling idle background work.
    if (!conversation && this.toRemember) {
      console.log(`Agent ${this.id} remembering conversation ${this.toRemember}`);
      this.startOperation(game, now, 'agentRememberConversation', {
        worldId: game.worldId,
        playerId: this.playerId,
        agentId: this.id,
        conversationId: this.toRemember,
      });
      delete this.toRemember;
      return;
    }
    // If we're not in a conversation, do something.
    // If we aren't doing an activity or moving, do something.
    // If we have been wandering but haven't thought about something to do for
    // a while, do something.
    if (
      !conversation &&
      !doingActivity &&
      !recentlyFinishedActivity &&
      !recentlyLeftConversation &&
      (!player.pathfinding || !recentlyAttemptedInvite)
    ) {
      if (hasActiveAgentDoSomething(game, now, this.id)) {
        return;
      }
      this.startOperation(game, now, 'agentDoSomething', {
        worldId: game.worldId,
        player: player.serialize(),
        otherFreePlayers: [...game.world.players.values()]
          .filter((p) => p.id !== player.id)
          .filter(
            (p) => ![...game.world.conversations.values()].find((c) => c.participants.has(p.id)),
          )
          .map((p) => p.serialize()),
        agent: this.serialize(),
        map: game.worldMap.serialize(),
      });
      return;
    }
    if (conversation && member) {
      const [otherPlayerId, otherMember] = [...conversation.participants.entries()].find(
        ([id]) => id !== player.id,
      )!;
      const otherPlayer = game.world.players.get(otherPlayerId)!;
      const pilotConversation = isUmiMahiruPilotConversation(player.id, otherPlayer.id);
      if (member.status.kind === 'invited') {
        // Accept a conversation with another agent with some probability and with
        // a human unconditionally.
        if (otherPlayer.human || Math.random() < inviteAcceptProbability()) {
          console.log(`Agent ${player.id} accepting invite from ${otherPlayer.id}`);
          conversation.acceptInvite(game, player);
          // Stop moving so we can start walking towards the other player.
          if (player.pathfinding) {
            delete player.pathfinding;
          }
        } else {
          console.log(`Agent ${player.id} rejecting invite from ${otherPlayer.id}`);
          conversation.rejectInvite(game, now, player);
        }
        return;
      }
      if (member.status.kind === 'walkingOver') {
        // Leave a conversation if we've been waiting for too long.
        if (member.invited + INVITE_TIMEOUT < now) {
          console.log(`Giving up on invite to ${otherPlayer.id}`);
          conversation.leave(game, now, player);
          return;
        }

        // Don't keep moving around if we're near enough.
        const playerDistance = distance(player.position, otherPlayer.position);
        if (playerDistance < CONVERSATION_DISTANCE) {
          return;
        }

        // Keep moving towards the other player.
        if (!player.pathfinding) {
          const destination = conversationApproachDestination(game, now, player, otherPlayer);
          if (!destination) {
            console.warn(`Giving up on unreachable invite path from ${player.id} to ${otherPlayer.id}`);
            conversation.leave(game, now, player);
            return;
          }
          console.log(`Agent ${player.id} walking towards ${otherPlayer.id}...`, destination);
          movePlayer(game, now, player, destination);
        }
        return;
      }
      if (member.status.kind === 'participating') {
        const started = member.status.started;
        if (conversation.isTyping && conversation.isTyping.playerId !== player.id) {
          // Wait for the other player to finish typing.
          return;
        }
        if (!conversation.lastMessage) {
          const isInitiator = conversation.creator === player.id;
          const awkwardDeadline = started + AWKWARD_CONVERSATION_TIMEOUT;
          // Send the first message if we're the initiator or if we've been waiting for too long.
          if (isInitiator || awkwardDeadline < now) {
            if (hasActiveConversationGeneration(game, now, this.id, pilotConversation)) {
              return;
            }
            // Grab the lock on the conversation and send a "start" message.
            console.log(`${player.id} initiating conversation with ${otherPlayer.id}.`);
            const messageUuid = crypto.randomUUID();
            conversation.setIsTyping(now, player, messageUuid);
            this.startOperation(game, now, 'agentGenerateMessage', {
              worldId: game.worldId,
              playerId: player.id,
              agentId: this.id,
              conversationId: conversation.id,
              otherPlayerId: otherPlayer.id,
              messageUuid,
              type: 'start',
            });
            return;
          } else {
            // Wait on the other player to say something up to the awkward deadline.
            return;
          }
        }
        // See if the conversation has been going on too long and decide to leave.
        const tooLongDeadline = started + MAX_CONVERSATION_DURATION;
        const hasHumanParticipant = player.human || otherPlayer.human;
        if (!hasHumanParticipant && (tooLongDeadline < now || conversation.numMessages > maxConversationMessages())) {
          if (hasActiveConversationGeneration(game, now, this.id, pilotConversation)) {
            return;
          }
          console.log(`${player.id} leaving conversation with ${otherPlayer.id}.`);
          const messageUuid = crypto.randomUUID();
          conversation.setIsTyping(now, player, messageUuid);
          this.startOperation(game, now, 'agentGenerateMessage', {
            worldId: game.worldId,
            playerId: player.id,
            agentId: this.id,
            conversationId: conversation.id,
            otherPlayerId: otherPlayer.id,
            messageUuid,
            type: 'leave',
          });
          return;
        }
        // Wait for the awkward deadline if we sent the last message.
        if (conversation.lastMessage.author === player.id) {
          const awkwardDeadline = conversation.lastMessage.timestamp + AWKWARD_CONVERSATION_TIMEOUT;
          if (now < awkwardDeadline) {
            return;
          }
        }
        // Wait for a cooldown after the last message to simulate "reading" the message.
        const messageCooldown = conversation.lastMessage.timestamp + MESSAGE_COOLDOWN;
        if (now < messageCooldown) {
          return;
        }
        // Grab the lock and send a message!
        if (hasActiveConversationGeneration(game, now, this.id, pilotConversation)) {
          return;
        }
        console.log(`${player.id} continuing conversation with ${otherPlayer.id}.`);
        const messageUuid = crypto.randomUUID();
        conversation.setIsTyping(now, player, messageUuid);
        this.startOperation(game, now, 'agentGenerateMessage', {
          worldId: game.worldId,
          playerId: player.id,
          agentId: this.id,
          conversationId: conversation.id,
          otherPlayerId: otherPlayer.id,
          messageUuid,
          type: 'continue',
        });
        return;
      }
    }
  }

  startOperation<Name extends keyof AgentOperations>(
    game: Game,
    now: number,
    name: Name,
    args: Omit<FunctionArgs<AgentOperations[Name]>, 'operationId'>,
  ) {
    if (this.inProgressOperation) {
      throw new Error(
        `Agent ${this.id} already has an operation: ${JSON.stringify(this.inProgressOperation)}`,
      );
    }
    const operationId = game.allocId('operations');
    const operationName = String(name);
    console.log(`Agent ${this.id} starting operation ${operationName} (${operationId})`);
    game.scheduleOperation(operationName, { operationId, ...args } as any);
    this.inProgressOperation = {
      name: operationName,
      operationId,
      started: now,
    };
  }

  serialize(): SerializedAgent {
    return {
      id: this.id,
      playerId: this.playerId,
      toRemember: this.toRemember,
      lastConversation: this.lastConversation,
      lastInviteAttempt: this.lastInviteAttempt,
      inProgressOperation: this.inProgressOperation,
    };
  }
}

function conversationApproachDestination(
  game: Game,
  now: number,
  player: Player,
  otherPlayer: Player,
): Point | undefined {
  const floorPlayer = {
    x: Math.floor(player.position.x),
    y: Math.floor(player.position.y),
  };
  const floorOther = {
    x: Math.floor(otherPlayer.position.x),
    y: Math.floor(otherPlayer.position.y),
  };
  const midpoint = {
    x: Math.floor((player.position.x + otherPlayer.position.x) / 2),
    y: Math.floor((player.position.y + otherPlayer.position.y) / 2),
  };
  const neighborOffsets = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
  ];
  const candidatePoints = [
    ...neighborOffsets.map((offset) => ({ x: floorOther.x + offset.x, y: floorOther.y + offset.y })),
    midpoint,
    ...neighborOffsets.map((offset) => ({ x: midpoint.x + offset.x, y: midpoint.y + offset.y })),
    ...neighborOffsets.map((offset) => ({ x: floorPlayer.x + offset.x, y: floorPlayer.y + offset.y })),
  ];
  const candidates = candidatePoints
    .filter((candidate, index, points) =>
      points.findIndex((point) => point.x === candidate.x && point.y === candidate.y) === index,
    )
    .filter((candidate) => !pointsEqual(candidate, floorOther))
    .filter((candidate) => !pointsEqual(candidate, floorPlayer))
    .filter((candidate) => !blocked(game, now, candidate, player.id))
    .filter((candidate) => findRoute(game, now, player, candidate));
  candidates.sort(
    (a, b) =>
      distance(a, otherPlayer.position) - distance(b, otherPlayer.position) ||
      distance(a, player.position) - distance(b, player.position),
  );
  return candidates[0];
}

export const serializedAgent = {
  id: agentId,
  playerId: playerId,
  toRemember: v.optional(conversationId),
  lastConversation: v.optional(v.number()),
  lastInviteAttempt: v.optional(v.number()),
  inProgressOperation: v.optional(
    v.object({
      name: v.string(),
      operationId: v.string(),
      started: v.number(),
    }),
  ),
};
export type SerializedAgent = ObjectType<typeof serializedAgent>;

type AgentOperations = typeof internal.aiTown.agentOperations;

export async function runAgentOperation(ctx: MutationCtx, operation: string, args: any) {
  let reference;
  switch (operation) {
    case 'agentRememberConversation':
      reference = internal.aiTown.agentOperations.agentRememberConversation;
      break;
    case 'agentGenerateMessage':
      reference = internal.aiTown.agentOperations.agentGenerateMessage;
      break;
    case 'agentDoSomething':
      reference = internal.aiTown.agentOperations.agentDoSomething;
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  await ctx.scheduler.runAfter(0, reference, args);
}

export const agentSendMessage = internalMutation({
  args: {
    worldId: v.id('worlds'),
    conversationId,
    agentId,
    playerId,
    text: v.string(),
    messageUuid: v.string(),
    leaveConversation: v.boolean(),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const repairedText = await repairMessageAddresseeAtInsert(
      ctx,
      args.worldId,
      args.conversationId,
      args.playerId,
      args.text,
    );
    const text = await avoidDuplicateConversationMessage(
      ctx,
      args.worldId,
      args.conversationId,
      args.playerId,
      repairedText,
    );
    await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      author: args.playerId,
      text,
      messageUuid: args.messageUuid,
      worldId: args.worldId,
    });
    await insertInput(ctx, args.worldId, 'agentFinishSendingMessage', {
      conversationId: args.conversationId,
      agentId: args.agentId,
      timestamp: Date.now(),
      leaveConversation: args.leaveConversation,
      operationId: args.operationId,
    });
  },
});

async function repairMessageAddresseeAtInsert(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  conversationIdValue: string,
  authorPlayerId: string,
  text: string,
) {
  const world = await ctx.db.get(worldId);
  const conversation = world?.conversations.find((item: any) => item.id === conversationIdValue);
  let participantIds = conversation
    ? conversation.participants
        .map((member: any) => (typeof member === 'string' ? member : member?.playerId))
        .filter((id: unknown): id is string => typeof id === 'string')
    : [];
  if (!participantIds.length) {
    const archived = await ctx.db
      .query('archivedConversations')
      .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('id', conversationIdValue))
      .first();
    participantIds = archived?.participants ?? [];
  }
  const recentMessages = await ctx.db
    .query('messages')
    .withIndex('conversationId', (q) =>
      q.eq('worldId', worldId).eq('conversationId', conversationIdValue),
    )
    .order('desc')
    .take(8);
  const recentOtherAuthorId = recentMessages.find((message) => message.author !== authorPlayerId)?.author;
  const otherPlayerId =
    recentOtherAuthorId ?? participantIds.find((id: string) => id !== authorPlayerId);
  const descriptions = await ctx.db
    .query('playerDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();
  const names = new Map(descriptions.map((description) => [description.playerId, description.name]));
  const authorName = names.get(authorPlayerId) ?? authorPlayerId;
  const namePattern = CONVERSATION_NAME_ALIASES.map(escapeRegex).join('|');
  const leadingName = new RegExp(`(^|\\n+)([\\s「『（(]*?)(${namePattern})([，,、：:])`, 'g');
  if (!otherPlayerId) {
    const authorAliases = conversationNameAliasesFor(authorName);
    return text.replace(leadingName, (match, lineStart: string, _prefix: string, name: string) => {
      return authorAliases.has(name) ? '' : match;
    });
  }
  const otherName = names.get(otherPlayerId) ?? otherPlayerId;
  const allowed = conversationNameAliasesFor(otherName);
  const authorAliases = conversationNameAliasesFor(authorName);
  const repaired = text.replace(leadingName, (match, lineStart: string, prefix: string, name: string, punctuation: string) => {
    if (allowed.has(name) && !authorAliases.has(name)) return match;
    return `${lineStart}${prefix}${displayConversationName(otherName)}${punctuation}`;
  });
  return stripLeadingConversationVocatives(repaired);
}

async function avoidDuplicateConversationMessage(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  conversationIdValue: string,
  authorPlayerId: string,
  text: string,
) {
  const normalized = normalizeConversationText(text);
  if (!normalized) return text;
  const recentMessages = await ctx.db
    .query('messages')
    .withIndex('conversationId', (q) =>
      q.eq('worldId', worldId).eq('conversationId', conversationIdValue),
    )
    .order('desc')
    .take(8);
  const repeatedByAuthor = recentMessages.some(
    (message) =>
      message.author === authorPlayerId &&
      normalizeConversationText(message.text) === normalized,
  );
  if (!repeatedByAuthor) return text;
  const alternatives = [
    '……我剛剛已經說過一次了。\n\n先讓這句話停一下。',
    '我換個說法。\n\n我不想把同一句話重複給你聽。',
    '先不要重複了。\n\n這次換你說，我聽。',
  ];
  const used = new Set(recentMessages.map((message) => normalizeConversationText(message.text)));
  return alternatives.find((line) => !used.has(normalizeConversationText(line))) ?? '……先停一下。';
}

function normalizeConversationText(text: string) {
  return text
    .toLowerCase()
    .replace(/[，。！？、,.!?「」"'\s]/g, '')
    .trim();
}

function stripLeadingConversationVocatives(text: string) {
  const namePattern = CONVERSATION_NAME_ALIASES.map(escapeRegex).join('|');
  const leadingName = new RegExp(`(^|\\n+)([\\s「『（(]*?)(${namePattern})([，,、：:])\\s*`, 'g');
  return text.replace(leadingName, (_match, lineStart: string, prefix: string) => `${lineStart}${prefix}`);
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const findConversationCandidate = internalQuery({
  args: {
    now: v.number(),
    worldId: v.id('worlds'),
    player: v.object(serializedPlayer),
    otherFreePlayers: v.array(v.object(serializedPlayer)),
  },
  handler: async (ctx, { now, worldId, player, otherFreePlayers }) => {
    const { position } = player;
    if (umiMahiruPilotEnabled()) {
      if (player.id !== 'p:0' && player.id !== 'p:707') return undefined;
      const targetPlayerId = player.id === 'p:0' ? 'p:707' : 'p:0';
      const target = otherFreePlayers.find((otherPlayer) => otherPlayer.id === targetPlayerId);
      if (!target) return undefined;
      const lastMember = await ctx.db
        .query('participatedTogether')
        .withIndex('edge', (q) =>
          q.eq('worldId', worldId).eq('player1', player.id).eq('player2', target.id),
        )
        .order('desc')
        .first();
      const singleSampleAfter = umiMahiruSingleSampleAfterMs();
      if (singleSampleAfter !== undefined && lastMember && lastMember.ended >= singleSampleAfter) {
        // A pilot conversation has already archived since the run started.
        // Block further candidates so the single-sample window only produces one sample.
        return undefined;
      }
      if (lastMember && now < lastMember.ended + playerConversationCooldownMs()) {
        return undefined;
      }
      return target.id;
    }
    const candidates = [];

    for (const otherPlayer of otherFreePlayers) {
      // Find the latest conversation we're both members of.
      const lastMember = await ctx.db
        .query('participatedTogether')
        .withIndex('edge', (q) =>
          q.eq('worldId', worldId).eq('player1', player.id).eq('player2', otherPlayer.id),
        )
        .order('desc')
        .first();
      if (lastMember) {
        if (now < lastMember.ended + playerConversationCooldownMs()) {
          continue;
        }
      }
      candidates.push({ id: otherPlayer.id, position: otherPlayer.position });
    }

    // Sort by distance and take the nearest candidate.
    candidates.sort((a, b) => distance(a.position, position) - distance(b.position, position));
    return candidates[0]?.id;
  },
});

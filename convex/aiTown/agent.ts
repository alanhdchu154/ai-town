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
  HUMAN_CONVERSATION_IDLE_CLOSE_AFTER,
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
  'Tianze',
  '天澤',
  '天澤',
  'Ichinose',
  '一之瀨',
  '一之瀨',
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

function soulPilotConversationCooldownMs() {
  return envNumber(
    'SOUL_PILOT_PAIR_COOLDOWN_MS',
    10 * 60_000,
    60_000,
    60 * 60_000,
  );
}

function inviteAcceptProbability() {
  return envNumber('INVITE_ACCEPT_PROBABILITY', INVITE_ACCEPT_PROBABILITY, 0, 1);
}

function maxConversationMessages() {
  return envNumber('MAX_CONVERSATION_MESSAGES', MAX_CONVERSATION_MESSAGES, 2, 12);
}

// Minimum number of messages an autonomous (NPC↔NPC) conversation should reach
// before an ordinary duration timeout is allowed to end it. This is the
// "minimum-shape grace": it keeps weak two/three-line exchanges from being
// archived (and later turned into memory) just because the clock ran out.
function minAutonomousConversationMessages() {
  return envNumber('MIN_AUTONOMOUS_CONVERSATION_MESSAGES', 4, 2, maxConversationMessages());
}

// Hard duration cap for autonomous conversations. Even while we hold a
// conversation open for the minimum-shape grace, this ceiling still forces it
// to end so nothing can get stuck. Defaults to 3x the ordinary duration,
// clamped to the ordinary duration on the low end and 30 minutes on the high.
function hardAutonomousConversationDurationMs() {
  return envNumber(
    'HARD_AUTONOMOUS_CONVERSATION_DURATION_MS',
    MAX_CONVERSATION_DURATION * 3,
    MAX_CONVERSATION_DURATION,
    30 * 60_000,
  );
}

function conversationSingleFlightEnabled() {
  return process.env.CONVERSATION_SINGLE_FLIGHT !== 'false';
}

// --------------------------------------------------------------------
// Soul-triad / Umi-Mahiru pilot env knobs (off by default).
//
// These open temporary collection windows for the Umi / Mahiru / Tianze
// pilot. They never affect the live autonomous world unless explicitly
// set, and the pilot scripts in scripts/run-*-single-sample.mjs remove
// them in their `finally` blocks. Do not turn them on in production
// without an explicit token-budget check.
//
//   UMI_MAHIRU_COLOCATION_PILOT       'true' to enable Umi↔Mahiru pilot
//   SOUL_TRIAD_COLOCATION_PILOT       'true' to enable Umi/Mahiru/Tianze trio
//   UMI_MAHIRU_SINGLE_SAMPLE_AFTER_MS ms before single-sample window ends
//   SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS ms before triad single-sample window ends
//   SOUL_TRIAD_FOCUS_PAIR             "NameA:NameB" to force one dyad this run
//   SOUL_PILOT_PAIR_COOLDOWN_MS       min same-pair gap while pilot is active
//
// Residue read/write knobs live in convex/agent/memory.ts and
// convex/agent/conversation.ts:
//   UNDERWORLD_RESIDUE_WRITE          'false' disables residue line writes
//   UNDERWORLD_RESIDUE_READ           'false' disables residue prompt injection
//                                     'placebo' keeps a fixed neutral prompt slot
//                                     without reading residue text
//   UNDERWORLD_RESIDUE_RESONANCE      'false' disables soul-resonance gating
//
// See .env.local.example and docs/giis-v0.1-roadmap.md (fresh-sample
// rule) for when to use these.
// --------------------------------------------------------------------
function umiMahiruPilotEnabled() {
  return process.env.UMI_MAHIRU_COLOCATION_PILOT === 'true';
}

function soulTriadPilotEnabled() {
  return process.env.SOUL_TRIAD_COLOCATION_PILOT === 'true';
}

function umiMahiruSingleSampleAfterMs(): number | undefined {
  const raw = process.env.UMI_MAHIRU_SINGLE_SAMPLE_AFTER_MS;
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function soulTriadSingleSampleAfterMs(): number | undefined {
  const raw = process.env.SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS;
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

// Optional collection knob: when set to a single "Name:Name" dyad (e.g.
// "Mahiru:Tianze"), the soul-triad pilot only lets that specific pair seek
// each other this run. Lets the QA/observe loops rotate coverage so Mahiru is not
// starved by the Umi<->Tianze mutual-first-choice attractor. Unset == current
// behavior. Pilot-gated only; never affects the live autonomous world.
function soulTriadFocusPairNames(): string[] | undefined {
  const raw = process.env.SOUL_TRIAD_FOCUS_PAIR;
  if (raw === undefined || raw.trim() === '') return undefined;
  const names = raw
    .split(':')
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => isSoulTriadName(name));
  if (names.length !== 2 || names[0] === names[1]) return undefined;
  return names;
}

function isUmiMahiruPilotConversation(leftPlayerId: GameId<'players'>, rightPlayerId: GameId<'players'>) {
  if (!umiMahiruPilotEnabled()) return false;
  const ids = new Set([leftPlayerId, rightPlayerId]);
  return ids.has('p:0' as GameId<'players'>) && ids.has('p:707' as GameId<'players'>);
}

function isSoulTriadName(name?: string) {
  return name === 'Umi' || name === 'Mahiru' || name === 'Tianze';
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
        const hardDeadline = started + hardAutonomousConversationDurationMs();
        const hasHumanParticipant = player.human || otherPlayer.human;
        const idleHumanConversationCloseDue =
          !player.human &&
          Boolean(otherPlayer.human) &&
          otherPlayer.lastInput < now - HUMAN_CONVERSATION_IDLE_CLOSE_AFTER &&
          conversation.lastMessage.author === player.id;
        const overMaxMessages = conversation.numMessages > maxConversationMessages();
        const reachedMinShape = conversation.numMessages >= minAutonomousConversationMessages();
        // Ordinary duration timeout only ends the conversation once it has
        // reached the minimum shape; the hard deadline ends it regardless so a
        // conversation can never get stuck.
        const ordinaryTimeoutLeave = tooLongDeadline < now && reachedMinShape;
        const hardTimeoutLeave = hardDeadline < now;
        if (!hasHumanParticipant && (overMaxMessages || ordinaryTimeoutLeave || hardTimeoutLeave)) {
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
        if (idleHumanConversationCloseDue) {
          const awkwardDeadline = conversation.lastMessage.timestamp + AWKWARD_CONVERSATION_TIMEOUT;
          if (now < awkwardDeadline) {
            return;
          }
          if (hasActiveConversationGeneration(game, now, this.id, pilotConversation)) {
            return;
          }
          console.log(`${player.id} closing idle human conversation with ${otherPlayer.id}.`);
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

export interface ConversationLeaveState {
  hasHumanParticipant: boolean;
  humanIdleCloseDue?: boolean;
  currentMessageCount: number;
  conversationCreated: number;
}

// Decide whether an autonomous conversation's requested leave should be held
// back. We defer the leave only when: it is a non-human conversation, sending
// this next message would still leave it below the minimum shape, and the hard
// duration cap has not yet elapsed. Alan-facing human conversations are also
// deferred: only Alan's explicit leave action should close those chats.
export function shouldDeferConversationLeave(
  state: ConversationLeaveState | undefined,
  now: number,
): boolean {
  if (!state) {
    return false;
  }
  if (state.hasHumanParticipant && state.humanIdleCloseDue) return false;
  if (state.hasHumanParticipant) return true;
  if (state.currentMessageCount + 1 >= minAutonomousConversationMessages()) {
    return false;
  }
  return now < state.conversationCreated + hardAutonomousConversationDurationMs();
}

async function loadConversationLeaveState(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  conversationIdValue: string,
  now: number,
): Promise<ConversationLeaveState | undefined> {
  const world = await ctx.db.get(worldId);
  const conversation = world?.conversations.find((item: any) => item.id === conversationIdValue);
  if (!world || !conversation) {
    return undefined;
  }
  const hasHumanParticipant = conversation.participants
    .map((member: any) => (typeof member === 'string' ? member : member?.playerId))
    .filter((id: unknown): id is string => typeof id === 'string')
    .some((id: string) => world.players.some((p: any) => p.id === id && p.human));
  const humanIdleCloseDue = conversation.participants
    .map((member: any) => (typeof member === 'string' ? member : member?.playerId))
    .filter((id: unknown): id is string => typeof id === 'string')
    .some((id: string) =>
      world.players.some(
        (p: any) => p.id === id && p.human && p.lastInput < now - HUMAN_CONVERSATION_IDLE_CLOSE_AFTER,
      ),
    );
  return {
    hasHumanParticipant,
    humanIdleCloseDue,
    currentMessageCount: conversation.numMessages,
    conversationCreated: conversation.created,
  };
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
    const now = Date.now();
    // Refuse to actually leave a non-human autonomous conversation if this next
    // message would still leave it below the minimum shape (unless the hard
    // duration cap has elapsed). Keeps weak exchanges from being archived early.
    const leaveConversation =
      args.leaveConversation &&
      !shouldDeferConversationLeave(
        await loadConversationLeaveState(ctx, args.worldId, args.conversationId, now),
        now,
      );
    await insertInput(ctx, args.worldId, 'agentFinishSendingMessage', {
      conversationId: args.conversationId,
      agentId: args.agentId,
      timestamp: now,
      leaveConversation,
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
      conversationTextTooSimilar(message.text, text),
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

function conversationTextTooSimilar(previous: string, current: string) {
  const left = normalizeConversationText(previous);
  const right = normalizeConversationText(current);
  if (!left || !right) return false;
  if (left === right) return true;
  const minLength = Math.min(left.length, right.length);
  if (minLength < 12) return false;
  const windowSize = Math.min(14, minLength);
  for (let index = 0; index <= left.length - windowSize; index += 1) {
    const fragment = left.slice(index, index + windowSize);
    if (right.includes(fragment)) return true;
  }
  return false;
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
    case 'Tianze':
    case '天澤':
    case '天擇':
    case '天擇一夏':
    case '天澤一夏':
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
    case '貓貓':
    case 'CaoCao':
    case 'Cao Cao':
    case '曹操':
      return '貓貓';
    case 'Sakiko':
    case '祥子':
    case 'Liu Bei':
    case 'LiuBei':
    case '劉備':
      return '祥子';
    default:
      return name;
  }
}

function conversationNameAliasesFor(name: string) {
  const displayName = displayConversationName(name);
  const aliases = new Set([name, displayName]);
  if (displayName === '海') aliases.add('Umi').add('朝凪海');
  if (displayName === '天澤') aliases.add('Tianze').add('天澤').add('天澤').add('天擇').add('天擇一夏').add('天澤一夏');
  if (displayName === '一之瀨') aliases.add('Ichinose').add('一之瀨').add('一之瀨').add('一之瀨帆波').add('黑化一之瀨');
  if (displayName === '真晝') aliases.add('Mahiru').add('Mahiru Shiina').add('椎名真晝').add('明晝').add('阿真晝');
  if (displayName === '貓貓') aliases.add('Maomao').add('CaoCao').add('Cao Cao').add('曹操');
  if (displayName === '祥子') aliases.add('Sakiko').add('Liu Bei').add('LiuBei').add('劉備');
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
    if (soulTriadPilotEnabled()) {
      const descriptions = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', worldId))
        .collect();
      const names = new Map(descriptions.map((description) => [description.playerId, description.name]));
      const playerName = names.get(player.id);
      if (!isSoulTriadName(playerName)) return undefined;
      const triadIds = new Set(
        descriptions
          .filter((description) => isSoulTriadName(description.name))
          .map((description) => description.playerId),
      );
      const singleSampleAfter = soulTriadSingleSampleAfterMs();
      if (singleSampleAfter !== undefined) {
        for (const triadId of triadIds) {
          const recentEdges = await ctx.db
            .query('participatedTogether')
            .withIndex('playerHistory', (q) =>
              q.eq('worldId', worldId).eq('player1', triadId as GameId<'players'>),
            )
            .order('desc')
            .take(8);
          const alreadySampled = recentEdges.some(
            (edge) => edge.ended >= singleSampleAfter && triadIds.has(edge.player2),
          );
          if (alreadySampled) return undefined;
        }
      }
      const focusPair = soulTriadFocusPairNames();
      if (focusPair && !(playerName && focusPair.includes(playerName))) {
        // A specific dyad is being collected this run; players outside it stay idle
        // so the rotation can guarantee coverage (e.g. Mahiru<->Tianze).
        return undefined;
      }
      if (focusPair && playerName !== focusPair[0]) {
        // Focused single-sample runs use the left side of the dyad as the sole
        // initiator. Otherwise both agents can invite at once after a resume and
        // create duplicate active conversations for the same pair.
        return undefined;
      }
      const preferredTargets = focusPair
        ? focusPair.filter((name) => name !== playerName)
        : playerName === 'Umi'
          ? ['Tianze', 'Mahiru']
          : playerName === 'Mahiru'
            ? ['Tianze', 'Umi']
            : ['Umi', 'Mahiru'];
      for (const targetName of preferredTargets) {
        const target = otherFreePlayers.find(
          (otherPlayer) => names.get(otherPlayer.id) === targetName && triadIds.has(otherPlayer.id),
        );
        if (!target) continue;
        const lastMember = await ctx.db
          .query('participatedTogether')
          .withIndex('edge', (q) =>
            q.eq('worldId', worldId).eq('player1', player.id).eq('player2', target.id),
          )
          .order('desc')
          .first();
        if (lastMember && now < lastMember.ended + soulPilotConversationCooldownMs()) continue;
        return target.id;
      }
      return undefined;
    }
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
      if (lastMember && now < lastMember.ended + soulPilotConversationCooldownMs()) {
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

import type { GameId } from '../../convex/aiTown/ids';

type SerializedPathfinding = {
  destination: { x: number; y: number };
  started: number;
  state:
    | { kind: 'needsPath' }
    | { kind: 'waiting'; until: number }
    | { kind: 'moving'; path: [number, number, number, number, number][] };
};

export type ClientPlayer = {
  id: GameId<'players'>;
  human?: string;
  pathfinding?: SerializedPathfinding;
  activity?: {
    description: string;
    emoji?: string;
    until: number;
  };
  lastInput: number;
  position: { x: number; y: number };
  facing: { dx: number; dy: number };
  speed: number;
};

export type ClientConversationMembership = {
  playerId: GameId<'players'>;
  invited: number;
  status:
    | { kind: 'invited' }
    | { kind: 'walkingOver' }
    | { kind: 'participating'; started: number };
};

export type ClientConversation = {
  id: GameId<'conversations'>;
  creator: GameId<'players'>;
  created: number;
  isTyping?: {
    playerId: GameId<'players'>;
    messageUuid: string;
    since: number;
  };
  lastMessage?: {
    author: GameId<'players'>;
    timestamp: number;
  };
  lastGenerationFailure?: {
    playerId: GameId<'players'>;
    timestamp: number;
  };
  lastGenerationAttempt?: {
    playerId: GameId<'players'>;
    timestamp: number;
  };
  numMessages: number;
  participants: Map<GameId<'players'>, ClientConversationMembership>;
};

export type ClientAgent = {
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
};

export type ClientWorldMap = {
  width: number;
  height: number;
  tileSetUrl: string;
  tileSetDimX: number;
  tileSetDimY: number;
  tileDim: number;
  bgTiles: number[][][];
  objectTiles: number[][][];
  animatedSprites: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    layer: number;
    sheet: string;
    animation: string;
  }>;
};

export class ClientWorld {
  nextId: number;
  conversations: Map<GameId<'conversations'>, ClientConversation>;
  players: Map<GameId<'players'>, ClientPlayer>;
  agents: Map<GameId<'agents'>, ClientAgent>;
  historicalLocations?: Map<GameId<'players'>, ArrayBuffer>;

  constructor(serialized: any) {
    this.nextId = serialized.nextId;
    this.conversations = new Map(
      (serialized.conversations ?? []).map((conversation: any) => [
        conversation.id as GameId<'conversations'>,
        parseConversation(conversation),
      ]),
    );
    this.players = new Map(
      (serialized.players ?? []).map((player: any) => [
        player.id as GameId<'players'>,
        parsePlayer(player),
      ]),
    );
    this.agents = new Map(
      (serialized.agents ?? []).map((agent: any) => [
        agent.id as GameId<'agents'>,
        parseAgent(agent),
      ]),
    );
    if (serialized.historicalLocations) {
      this.historicalLocations = new Map(
        serialized.historicalLocations.map((item: any) => [
          item.playerId as GameId<'players'>,
          item.location,
        ]),
      );
    }
  }

  playerConversation(player: ClientPlayer): ClientConversation | undefined {
    return [...this.conversations.values()].find((conversation) =>
      conversation.participants.has(player.id),
    );
  }
}

function parsePlayer(serialized: any): ClientPlayer {
  return {
    id: serialized.id as GameId<'players'>,
    human: serialized.human,
    pathfinding: serialized.pathfinding,
    activity: serialized.activity,
    lastInput: serialized.lastInput,
    position: serialized.position,
    facing: serialized.facing,
    speed: serialized.speed,
  };
}

function parseConversation(serialized: any): ClientConversation {
  return {
    id: serialized.id as GameId<'conversations'>,
    creator: serialized.creator as GameId<'players'>,
    created: serialized.created,
    isTyping: serialized.isTyping && {
      ...serialized.isTyping,
      playerId: serialized.isTyping.playerId as GameId<'players'>,
    },
    lastMessage: serialized.lastMessage && {
      ...serialized.lastMessage,
      author: serialized.lastMessage.author as GameId<'players'>,
    },
    lastGenerationFailure: serialized.lastGenerationFailure && {
      ...serialized.lastGenerationFailure,
      playerId: serialized.lastGenerationFailure.playerId as GameId<'players'>,
    },
    lastGenerationAttempt: serialized.lastGenerationAttempt && {
      ...serialized.lastGenerationAttempt,
      playerId: serialized.lastGenerationAttempt.playerId as GameId<'players'>,
    },
    numMessages: serialized.numMessages,
    participants: new Map(
      (serialized.participants ?? []).map((member: any) => [
        member.playerId as GameId<'players'>,
        {
          ...member,
          playerId: member.playerId as GameId<'players'>,
        },
      ]),
    ),
  };
}

function parseAgent(serialized: any): ClientAgent {
  return {
    id: serialized.id as GameId<'agents'>,
    playerId: serialized.playerId as GameId<'players'>,
    toRemember: serialized.toRemember as GameId<'conversations'> | undefined,
    lastConversation: serialized.lastConversation,
    lastInviteAttempt: serialized.lastInviteAttempt,
    inProgressOperation: serialized.inProgressOperation,
  };
}

import type { GameId } from '../../convex/aiTown/ids.ts';
import type { Id } from '../../convex/_generated/dataModel';
import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ClientWorld, type ClientWorldMap } from '../lib/clientGameState.ts';

export type ClientAgentDescription = {
  agentId: GameId<'agents'>;
  identity: string;
  plan: string;
};

export type ClientPlayerDescription = {
  playerId: GameId<'players'>;
  name: string;
  description: string;
  character: string;
};

export type ServerGame = {
  world: ClientWorld;
  playerDescriptions: Map<GameId<'players'>, ClientPlayerDescription>;
  agentDescriptions: Map<GameId<'agents'>, ClientAgentDescription>;
  worldMap: ClientWorldMap;
};

// TODO: This hook reparses the game state (even if we're not rerunning the query)
// when used in multiple components. Move this to a context to only parse it once.
export function useServerGame(worldId: Id<'worlds'> | undefined): ServerGame | undefined {
  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const descriptions = useQuery(api.world.gameDescriptions, worldId ? { worldId } : 'skip');
  const lastGoodRef = useRef<{
    worldId: Id<'worlds'>;
    worldState: NonNullable<typeof worldState>;
    descriptions: NonNullable<typeof descriptions>;
  }>();
  useEffect(() => {
    if (!worldId) {
      lastGoodRef.current = undefined;
      return;
    }
    if (worldState !== undefined && descriptions !== undefined) {
      lastGoodRef.current = { worldId, worldState, descriptions };
    }
  }, [worldId, worldState, descriptions]);
  const cachedGame = lastGoodRef.current;
  let stableWorldState = worldState;
  let stableDescriptions = descriptions;
  if (cachedGame && cachedGame.worldId === worldId) {
    stableWorldState ??= cachedGame.worldState;
    stableDescriptions ??= cachedGame.descriptions;
  }
  const game = useMemo(() => {
    if (!stableWorldState || !stableDescriptions) {
      return undefined;
    }
    return {
      world: new ClientWorld(stableWorldState.world),
      agentDescriptions: new Map(
        stableDescriptions.agentDescriptions.map((agent) => [
          agent.agentId as GameId<'agents'>,
          {
            ...agent,
            agentId: agent.agentId as GameId<'agents'>,
          },
        ]),
      ),
      playerDescriptions: new Map(
        stableDescriptions.playerDescriptions.map((player) => [
          player.playerId as GameId<'players'>,
          {
            ...player,
            playerId: player.playerId as GameId<'players'>,
          },
        ]),
      ),
      worldMap: stableDescriptions.worldMap as ClientWorldMap,
    };
  }, [stableWorldState, stableDescriptions]);
  return game;
}

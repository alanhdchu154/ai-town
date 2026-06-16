import { GameId } from '../../convex/aiTown/ids.ts';
import { AgentDescription } from '../../convex/aiTown/agentDescription.ts';
import { PlayerDescription } from '../../convex/aiTown/playerDescription.ts';
import { World } from '../../convex/aiTown/world.ts';
import { WorldMap } from '../../convex/aiTown/worldMap.ts';
import { Id } from '../../convex/_generated/dataModel';
import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { parseMap } from '../../convex/util/object.ts';

export type ServerGame = {
  world: World;
  playerDescriptions: Map<GameId<'players'>, PlayerDescription>;
  agentDescriptions: Map<GameId<'agents'>, AgentDescription>;
  worldMap: WorldMap;
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
      world: new World(stableWorldState.world),
      agentDescriptions: parseMap(
        stableDescriptions.agentDescriptions,
        AgentDescription,
        (p) => p.agentId,
      ),
      playerDescriptions: parseMap(
        stableDescriptions.playerDescriptions,
        PlayerDescription,
        (p) => p.playerId,
      ),
      worldMap: new WorldMap(stableDescriptions.worldMap),
    };
  }, [stableWorldState, stableDescriptions]);
  return game;
}

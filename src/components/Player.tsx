import { Character } from './Character.tsx';
import { orientationDegrees } from '../../convex/util/geometry.ts';
import { characters } from '../../data/characters.ts';
import { toast } from 'react-toastify';
import { Player as ServerPlayer } from '../../convex/aiTown/player.ts';
import { GameId } from '../../convex/aiTown/ids.ts';
import { Id } from '../../convex/_generated/dataModel';
import { Location, locationFields, playerLocation } from '../../convex/aiTown/location.ts';
import { useHistoricalValue } from '../hooks/useHistoricalValue.ts';
import { PlayerDescription } from '../../convex/aiTown/playerDescription.ts';
import { WorldMap } from '../../convex/aiTown/worldMap.ts';
import { ServerGame } from '../hooks/serverGame.ts';
import { characterVisualFor } from '../../data/characterVisuals.ts';

export type SelectElement = (element?: { kind: 'player'; id: GameId<'players'> }) => void;

const logged = new Set<string>();

export const Player = ({
  game,
  isViewer,
  isSelectedTarget = false,
  player,
  displayPosition,
  onClick,
  historicalTime,
}: {
  game: ServerGame;
  isViewer: boolean;
  isSelectedTarget?: boolean;
  player: ServerPlayer;
  displayPosition?: { x: number; y: number };

  onClick: SelectElement;
  historicalTime?: number;
}) => {
  const playerCharacter = game.playerDescriptions.get(player.id)?.character;
  const playerName = game.playerDescriptions.get(player.id)?.name;
  if (!playerCharacter) {
    const missingKey = `missing-character:${player.id}`;
    if (!logged.has(missingKey)) {
      logged.add(missingKey);
      toast.error(`Player ${playerName ?? player.id} 缺少角色資料，已先略過顯示。`);
    }
    return null;
  }
  const character = characters.find((c) => c.name === playerCharacter);
  const visual = characterVisualFor(playerName);

  const locationBuffer = game.world.historicalLocations?.get(player.id);
  const historicalLocation = useHistoricalValue<Location>(
    locationFields,
    historicalTime,
    playerLocation(player),
    locationBuffer,
  );
  if (!character) {
    if (!logged.has(playerCharacter)) {
      logged.add(playerCharacter);
      toast.error(`Unknown character ${playerCharacter}`);
    }
    return null;
  }

  if (!historicalLocation) {
    return null;
  }

  const isSpeaking = !![...game.world.conversations.values()].find(
    (c) => c.isTyping?.playerId === player.id,
  );
  const isInConversation = !![...game.world.conversations.values()].find((conversation) =>
    conversation.participants.has(player.id),
  );
  const isThinking =
    !isSpeaking &&
    !![...game.world.agents.values()].find(
      (a) => a.playerId === player.id && !!a.inProgressOperation,
    );
  const humanPlayer = [...game.world.players.values()].find((candidate) => !!candidate.human);
  const isInteractable =
    !!humanPlayer &&
    !isViewer &&
    !isInConversation &&
    Math.hypot(humanPlayer.position.x - player.position.x, humanPlayer.position.y - player.position.y) <=
      4;
  const tileDim = game.worldMap.tileDim;
  const historicalFacing = { dx: historicalLocation.dx, dy: historicalLocation.dy };
  const renderPosition = displayPosition ?? {
    x: historicalLocation.x,
    y: historicalLocation.y,
  };
  const isMovingVisually = historicalLocation.speed > 0 || !!player.pathfinding;
  return (
    <>
      <Character
        x={renderPosition.x * tileDim + tileDim / 2}
        y={renderPosition.y * tileDim + tileDim / 2}
        orientation={orientationDegrees(historicalFacing)}
        isMoving={isMovingVisually}
        isThinking={isThinking}
        isSpeaking={isSpeaking}
        isInteractable={isInteractable}
        isInConversation={isInConversation}
        emoji={
          player.activity && player.activity.until > (historicalTime ?? Date.now())
            ? player.activity?.emoji
            : undefined
        }
        isViewer={isViewer}
        isSelectedTarget={isSelectedTarget}
        textureUrl={character.textureUrl}
        spritesheetData={character.spritesheetData}
        speed={character.speed}
        tint={visual?.tint}
        accent={visual?.accent}
        nameLabel={visual?.label}
        spriteUrl={visual?.spritePath}
        pixelAvatar={
          visual
            ? {
                avatar: visual.avatar,
                palette: visual.palette,
              }
            : undefined
        }
        onClick={() => {
          onClick({ kind: 'player', id: player.id });
        }}
      />
    </>
  );
};

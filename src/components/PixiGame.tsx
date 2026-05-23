import * as PIXI from 'pixi.js';
import { Graphics, useApp } from '@pixi/react';
import { Player, SelectElement } from './Player.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PixiStaticMap } from './PixiStaticMap.tsx';
import PixiViewport from './PixiViewport.tsx';
import { Viewport } from 'pixi-viewport';
import { Id } from '../../convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api.js';
import { toastOnError } from '../toasts.ts';
import { DebugPath } from './DebugPath.tsx';
import { PositionIndicator } from './PositionIndicator.tsx';
import { SHOW_DEBUG_UI } from './Game.tsx';
import { ServerGame } from '../hooks/serverGame.ts';
import { ClassroomBounds, ClassroomCenter } from '../../data/classroomBounds.ts';
import { SchoolLocationId, SchoolLocations } from '../../data/schoolLocations.ts';

export const PixiGame = (props: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  historicalTime: number | undefined;
  width: number;
  height: number;
  sceneId?: SchoolLocationId;
  visiblePlayerIds?: string[];
  focusRequest?: { x: number; y: number; scale?: number; nonce: number };
  selectedPlayerId?: string;
  setSelectedElement: SelectElement;
}) => {
  // PIXI setup.
  const pixiApp = useApp();
  const viewportRef = useRef<Viewport | undefined>();

  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId: props.worldId }) ?? null;
  const humanPlayerId = [...props.game.world.players.values()].find(
    (p) => p.human === humanTokenIdentifier,
  )?.id;

  const moveAlanTo = useMutation(api.school.moveAlanTo);

  // Interaction for clicking on the world to navigate.
  const dragStart = useRef<{ screenX: number; screenY: number } | null>(null);
  const onMapPointerDown = (e: any) => {
    // https://pixijs.download/dev/docs/PIXI.FederatedPointerEvent.html
    dragStart.current = { screenX: e.screenX, screenY: e.screenY };
  };

  const [lastDestination, setLastDestination] = useState<{
    x: number;
    y: number;
    t: number;
  } | null>(null);
  const onMapPointerUp = async (e: any) => {
    if (dragStart.current) {
      const { screenX, screenY } = dragStart.current;
      dragStart.current = null;
      const [dx, dy] = [screenX - e.screenX, screenY - e.screenY];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        console.log(`Skipping navigation on drag event (${dist}px)`);
        return;
      }
    }
    if (!humanPlayerId) {
      return;
    }
    const humanPlayer = props.game.world.players.get(humanPlayerId);
    if (humanPlayer && props.game.world.playerConversation(humanPlayer)) {
      window.dispatchEvent(
        new CustomEvent('giis:scene-message', {
          detail: { message: '對話中不能直接走路。先離開對話，再點地板移動。' },
        }),
      );
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const gameSpacePx = viewport.toWorld(e.screenX, e.screenY);
    const tileDim = props.game.worldMap.tileDim;
    const gameSpaceTiles = {
      x: gameSpacePx.x / tileDim,
      y: gameSpacePx.y / tileDim,
    };
    setLastDestination({ t: Date.now(), ...gameSpaceTiles });
    const roundedTiles = {
      x: Math.floor(gameSpaceTiles.x),
      y: Math.floor(gameSpaceTiles.y),
    };
    console.log(`Moving to ${JSON.stringify(roundedTiles)}`);
    void toastOnError(moveAlanTo({ destination: roundedTiles })).then((result) => {
      window.dispatchEvent(
        new CustomEvent('giis:scene-message', {
          detail: { message: result.descriptionZh },
        }),
      );
    });
  };
  const { width, height, tileDim } = props.game.worldMap;
  const visiblePlayerIdSet = props.visiblePlayerIds ? new Set(props.visiblePlayerIds) : undefined;
  const players = [...props.game.world.players.values()].filter(
    (player) => !visiblePlayerIdSet || visiblePlayerIdSet.has(player.id),
  );
  const humanPlayerForMap = humanPlayerId ? props.game.world.players.get(humanPlayerId) : undefined;
  const visualPositionKey = players
    .map(
      (player) =>
        `${player.id}:${player.pathfinding ? 'moving' : 'idle'}:${player.position.x.toFixed(2)}:${player.position.y.toFixed(2)}`,
    )
    .join('|');
  const visualPositions = useMemo(() => {
    const scene = SchoolLocations.find((location) => location.id === props.sceneId);
    if (!scene || players.length <= 1) return new Map<string, { x: number; y: number }>();
    const sortedPlayers = [...players].sort((a, b) => a.id.localeCompare(b.id));
    const result = new Map<string, { x: number; y: number }>();
    sortedPlayers.forEach((player, index) => {
      if (player.pathfinding) return;
      const ring = Math.floor(index / 6);
      const angle = (index * 2.399963229728653) % (Math.PI * 2);
      const jitter = 0.42 + ring * 0.18;
      result.set(player.id, {
        x: player.position.x + Math.cos(angle) * jitter,
        y: player.position.y + Math.sin(angle) * jitter,
      });
    });
    return result;
  }, [visualPositionKey, props.sceneId]);

  // Zoom on the user’s avatar when it is created
  useEffect(() => {
    if (!viewportRef.current) return;

    const humanPlayer = humanPlayerId ? props.game.world.players.get(humanPlayerId) : undefined;
    const focus = humanPlayer?.position ?? ClassroomCenter;
    viewportRef.current.animate({
      position: new PIXI.Point(focus.x * tileDim, focus.y * tileDim),
      scale: 1.85,
    });
  }, [humanPlayerId, tileDim]);

  useEffect(() => {
    if (!viewportRef.current || !props.focusRequest) return;
    viewportRef.current.animate({
      position: new PIXI.Point(props.focusRequest.x * tileDim, props.focusRequest.y * tileDim),
      scale: props.focusRequest.scale ?? 2,
    });
  }, [props.focusRequest, tileDim]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !humanPlayerForMap?.pathfinding) return;
    viewport.animate({
      position: new PIXI.Point(humanPlayerForMap.position.x * tileDim, humanPlayerForMap.position.y * tileDim),
      scale: Math.max(viewport.scale.x, 1.9),
      time: 180,
    });
  }, [
    tileDim,
    humanPlayerForMap?.position.x,
    humanPlayerForMap?.position.y,
    humanPlayerForMap?.pathfinding?.destination.x,
    humanPlayerForMap?.pathfinding?.destination.y,
  ]);

  const clampBounds = useMemo(() => {
    const pad = 0.5;
    return {
      left: (ClassroomBounds.minX - pad) * tileDim,
      top: (ClassroomBounds.minY - pad) * tileDim,
      right: (ClassroomBounds.maxX + 1 + pad) * tileDim,
      bottom: (ClassroomBounds.maxY + 1 + pad) * tileDim,
    };
  }, [tileDim]);

  return (
    <PixiViewport
      app={pixiApp}
      screenWidth={props.width}
      screenHeight={props.height}
      worldWidth={width * tileDim}
      worldHeight={height * tileDim}
      clampBounds={clampBounds}
      viewportRef={viewportRef}
    >
      <PixiStaticMap map={props.game.worldMap} />
      <ClassroomMap
        width={width}
        height={height}
        tileDim={tileDim}
        sceneId={props.sceneId ?? 'classroom'}
        pointerup={onMapPointerUp}
        pointerdown={onMapPointerDown}
        pointertap={onMapPointerUp}
      />
      {players.map(
        (p) =>
          // Only show the path for the human player in non-debug mode.
          (SHOW_DEBUG_UI || p.id === humanPlayerId) && (
            <DebugPath key={`path-${p.id}`} player={p} tileDim={tileDim} />
          ),
      )}
      {lastDestination && <PositionIndicator destination={lastDestination} tileDim={tileDim} />}
      {humanPlayerId &&
        props.game.world.players.get(humanPlayerId)?.pathfinding?.destination &&
        (() => {
          const destination = props.game.world.players.get(humanPlayerId)!.pathfinding!.destination;
          return <PositionIndicator destination={{ ...destination, t: Date.now() }} tileDim={tileDim} />;
        })()}
      {players.map((p) => (
        <Player
          key={`player-${p.id}`}
          game={props.game}
          player={p}
          displayPosition={visualPositions.get(p.id)}
          isViewer={p.id === humanPlayerId}
          isSelectedTarget={p.id === props.selectedPlayerId}
          onClick={props.setSelectedElement}
          historicalTime={props.historicalTime}
        />
      ))}
    </PixiViewport>
  );
};
export default PixiGame;

function ClassroomMap({
  width,
  height,
  tileDim,
  sceneId,
  pointerup,
  pointerdown,
  pointertap,
}: {
  width: number;
  height: number;
  tileDim: number;
  sceneId: SchoolLocationId;
  pointerup: (event: any) => void;
  pointerdown: (event: any) => void;
  pointertap: (event: any) => void;
}) {
  const draw = (g: PIXI.Graphics) => {
    g.clear();
    const sceneTone = sceneToneFor(sceneId);

    g.beginFill(sceneTone.backdrop, 0.98);
    g.drawRect(0, 0, width * tileDim, height * tileDim);
    g.endFill();

    const roomX = ClassroomBounds.minX * tileDim;
    const roomY = ClassroomBounds.minY * tileDim;
    const roomW = (ClassroomBounds.maxX - ClassroomBounds.minX + 1) * tileDim;
    const roomH = (ClassroomBounds.maxY - ClassroomBounds.minY + 1) * tileDim;

    g.beginFill(sceneTone.floor, 1);
    g.lineStyle(5, sceneTone.border, 1);
    g.drawRoundedRect(roomX, roomY, roomW, roomH, 8);
    g.endFill();

    for (let x = ClassroomBounds.minX; x <= ClassroomBounds.maxX; x++) {
      for (let y = ClassroomBounds.minY; y <= ClassroomBounds.maxY; y++) {
        const isLight = (x + y) % 2 === 0;
        g.beginFill(isLight ? sceneTone.tileA : sceneTone.tileB, 1);
        g.lineStyle(1, sceneTone.grid, 0.3);
        g.drawRect(x * tileDim, y * tileDim, tileDim, tileDim);
        g.endFill();
      }
    }

    const boardX = (ClassroomBounds.minX + 1) * tileDim;
    const boardY = ClassroomBounds.minY * tileDim + tileDim * 0.3;
    const boardW = (ClassroomBounds.maxX - ClassroomBounds.minX - 1) * tileDim;
    g.beginFill(sceneTone.board, 1);
    g.lineStyle(3, 0xd6b56d, 1);
    g.drawRoundedRect(boardX, boardY, boardW, tileDim * 1.1, 5);
    g.endFill();

    drawTeacherDesk(
      g,
      (ClassroomBounds.minX + 4) * tileDim,
      (ClassroomBounds.minY + 2) * tileDim,
      tileDim,
    );

    const deskPositions = [
      [ClassroomBounds.minX + 2, ClassroomBounds.minY + 4],
      [ClassroomBounds.minX + 5, ClassroomBounds.minY + 4],
      [ClassroomBounds.minX + 8, ClassroomBounds.minY + 4],
      [ClassroomBounds.minX + 2, ClassroomBounds.minY + 6],
      [ClassroomBounds.minX + 5, ClassroomBounds.minY + 6],
      [ClassroomBounds.minX + 8, ClassroomBounds.minY + 6],
    ];
    for (const [x, y] of deskPositions) {
      drawStudentDesk(g, x * tileDim, y * tileDim, tileDim);
    }

    g.beginFill(0x6b4f36, 1);
    g.lineStyle(2, 0xc89b5d, 1);
    g.drawRect(
      (ClassroomBounds.maxX - 1) * tileDim,
      (ClassroomBounds.maxY + 0.05) * tileDim,
      tileDim * 1.4,
      tileDim * 0.35,
    );
    g.endFill();

    g.beginFill(0xf6f1de, 1);
    g.lineStyle(2, 0x9ca3af, 1);
    g.drawRoundedRect(
      (ClassroomBounds.minX + 0.4) * tileDim,
      (ClassroomBounds.minY + 2.4) * tileDim,
      tileDim * 1.5,
      tileDim * 1.1,
      4,
    );
    g.endFill();

    g.beginFill(0xf59e0b, 1);
    g.drawCircle(
      (ClassroomBounds.maxX - 0.7) * tileDim,
      (ClassroomBounds.minY + 1.15) * tileDim,
      tileDim * 0.28,
    );
    g.endFill();
  };
  return (
    <Graphics
      draw={draw}
      eventMode="static"
      cursor="pointer"
      pointerup={pointerup}
      pointerdown={pointerdown}
      pointertap={pointertap}
    />
  );
}

function sceneToneFor(sceneId: SchoolLocationId) {
  switch (sceneId) {
    case 'courtyard':
      return {
        backdrop: 0x10251f,
        floor: 0xd8efd0,
        tileA: 0xe9f7df,
        tileB: 0xc5e6bc,
        border: 0x4f8f5f,
        grid: 0x7bbf7a,
        board: 0x2b6f55,
      };
    case 'aiClubRoom':
      return {
        backdrop: 0x071923,
        floor: 0xcfe8f6,
        tileA: 0xe2f7ff,
        tileB: 0xb9dff0,
        border: 0x16a3b8,
        grid: 0x3bbbd3,
        board: 0x113f67,
      };
    case 'studentCouncilRoom':
      return {
        backdrop: 0x160d16,
        floor: 0xe4d2d2,
        tileA: 0xf1dddd,
        tileB: 0xd4baba,
        border: 0x8b2f45,
        grid: 0xa45566,
        board: 0x4a1628,
      };
    case 'dormitory':
      return {
        backdrop: 0x171326,
        floor: 0xead7bd,
        tileA: 0xf6e4c7,
        tileB: 0xd9bd96,
        border: 0xb47542,
        grid: 0xc98f55,
        board: 0x49365f,
      };
    case 'classroom':
    default:
      return {
        backdrop: 0x111827,
        floor: 0xf1dfbd,
        tileA: 0xf7e8c9,
        tileB: 0xe8d1a6,
        border: 0x7c4f2b,
        grid: 0xd4b985,
        board: 0x1f5a45,
      };
  }
}

function drawTeacherDesk(g: PIXI.Graphics, x: number, y: number, tileDim: number) {
  g.beginFill(0x8b5a2b, 1);
  g.lineStyle(2, 0x57351e, 1);
  g.drawRoundedRect(x, y, tileDim * 2, tileDim * 0.8, 5);
  g.endFill();
  g.beginFill(0xf8fafc, 1);
  g.drawRect(x + tileDim * 1.35, y + tileDim * 0.14, tileDim * 0.42, tileDim * 0.32);
  g.endFill();
}

function drawStudentDesk(g: PIXI.Graphics, x: number, y: number, tileDim: number) {
  g.beginFill(0xa16207, 1);
  g.lineStyle(2, 0x713f12, 1);
  g.drawRoundedRect(x, y, tileDim * 1.15, tileDim * 0.75, 4);
  g.endFill();
  g.beginFill(0x475569, 1);
  g.drawRoundedRect(x + tileDim * 0.15, y + tileDim * 0.82, tileDim * 0.85, tileDim * 0.32, 4);
  g.endFill();
}

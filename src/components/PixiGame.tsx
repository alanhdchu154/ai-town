import * as PIXI from 'pixi.js';
import { Graphics, useApp } from '@pixi/react';
import { Player, SelectElement } from './Player.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import PixiViewport from './PixiViewport.tsx';
import { Viewport } from 'pixi-viewport';
import type { Id } from '../../convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api.js';
import { toastOnError } from '../toasts.ts';
import { DebugPath } from './DebugPath.tsx';
import { PositionIndicator } from './PositionIndicator.tsx';
import { SHOW_DEBUG_UI } from './Game.tsx';
import type { ServerGame } from '../hooks/serverGame.ts';
import { ClassroomBounds } from '../../data/classroomBounds.ts';
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
    if (!humanPlayer) return;
    viewportRef.current.animate({
      position: new PIXI.Point(humanPlayer.position.x * tileDim, humanPlayer.position.y * tileDim),
      scale: 1.25,
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
      scale: Math.max(viewport.scale.x, 1.35),
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
    // Clamp to the drawn RPG room plus a small soft edge. If this uses the
    // full legacy AI Town world, dragging reveals a huge dark void around the
    // classroom instead of a contained room.
    const room = visualRoomBounds(tileDim, props.width, props.height);
    const pad = tileDim * 0.85;
    return {
      left: room.x - pad,
      top: room.y - pad,
      right: room.x + room.width + pad,
      bottom: room.y + room.height + pad,
    };
  }, [tileDim, props.width, props.height]);

  // Render lower characters last so they overlap the ones behind them,
  // giving the 2D RPG room a natural front/back ordering. Use the visual
  // (display) position when one is set, otherwise the player's own y.
  const playersForRender = [...players].sort((a, b) => {
    const ay = visualPositions.get(a.id)?.y ?? a.position.y;
    const by = visualPositions.get(b.id)?.y ?? b.position.y;
    return ay - by;
  });

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
      <ClassroomMap
        width={width}
        height={height}
        tileDim={tileDim}
        stageWidth={props.width}
        stageHeight={props.height}
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
      {playersForRender.map((p) => (
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

function visualRoomBounds(tileDim: number, stageWidth: number, stageHeight: number) {
  const baseRoomX = ClassroomBounds.minX * tileDim;
  const roomY = ClassroomBounds.minY * tileDim;
  const baseRoomW = (ClassroomBounds.maxX - ClassroomBounds.minX + 1) * tileDim;
  const roomH = (ClassroomBounds.maxY - ClassroomBounds.minY + 1) * tileDim;
  const baseAspect = baseRoomW / roomH;
  const stageAspect = stageWidth && stageHeight ? stageWidth / stageHeight : baseAspect;
  const targetAspect = Math.min(3.6, Math.max(baseAspect, stageAspect * 1.5));
  const roomW = roomH * targetAspect;
  return {
    x: baseRoomX + baseRoomW / 2 - roomW / 2,
    y: roomY,
    width: roomW,
    height: roomH,
  };
}

function ClassroomMap({
  width,
  height,
  tileDim,
  stageWidth,
  stageHeight,
  sceneId,
  pointerup,
  pointerdown,
  pointertap,
}: {
  width: number;
  height: number;
  tileDim: number;
  stageWidth: number;
  stageHeight: number;
  sceneId: SchoolLocationId;
  pointerup: (event: any) => void;
  pointerdown: (event: any) => void;
  pointertap: (event: any) => void;
}) {
  const draw = (g: PIXI.Graphics) => {
    g.clear();
    const tone = sceneToneFor(sceneId);

    const room = visualRoomBounds(tileDim, stageWidth, stageHeight);
    const roomX = room.x;
    const roomY = room.y;
    const roomW = room.width;
    const roomH = room.height;
    const roomBottom = room.y + room.height;

    // Keep the dark ambient border close to the room. A huge backdrop makes the
    // player feel like they can drag into a black world outside the map.
    const backdropPad = tileDim * 0.9;
    const backdropLeft = roomX - backdropPad;
    const backdropTop = roomY - backdropPad;
    const backdropRight = roomX + roomW + backdropPad;
    const backdropBottom = roomBottom + backdropPad;
    g.beginFill(tone.backdrop, 1);
    g.drawRect(
      backdropLeft,
      backdropTop,
      backdropRight - backdropLeft,
      backdropBottom - backdropTop,
    );
    g.endFill();

    const ink = 0x2a2428;
    const wall = 0xf6ecd8;
    const wallLight = 0xfffbef;
    const wallShade = shade(tone.border, 0.78);

    // Back wall band across the top of the room. The walkable area starts at
    // minY+1, so a 1.5-tile wall sits above where characters stand.
    const wallH = tileDim * 1.5;
    const floorY = roomY + wallH;
    g.beginFill(wall, 1);
    g.drawRect(roomX, roomY, roomW, wallH);
    g.endFill();
    g.lineStyle(2, ink, 0.42);
    g.drawRect(roomX, roomY, roomW, wallH);
    g.lineStyle(0);
    g.beginFill(wallLight, 0.45);
    g.drawRect(roomX, roomY, roomW, tileDim * 0.28);
    g.endFill();

    // Floor base spanning between the side walls.
    const sideW = tileDim * 0.6;
    const floorLeft = roomX + sideW;
    const floorRight = roomX + roomW - sideW;
    const floorW = floorRight - floorLeft;
    g.beginFill(tone.floor, 1);
    g.drawRect(floorLeft, floorY, floorW, roomBottom - floorY);
    g.endFill();

    // Floorboards: horizontal planks, slightly lighter toward the front
    // (bottom) so the room reads with a little depth.
    for (let py = floorY; py < roomBottom - 0.5; py += tileDim) {
      const h = Math.min(tileDim, roomBottom - py);
      const depth = (py - floorY) / Math.max(1, roomBottom - floorY);
      g.beginFill(shade(tone.floor, 0.93 + depth * 0.13), 1);
      g.drawRect(floorLeft, py, floorW, h);
      g.endFill();
      g.lineStyle(1, ink, 0.12);
      g.moveTo(floorLeft, py + h);
      g.lineTo(floorRight, py + h);
      g.lineStyle(0);
    }

    // Faint vertical grid so the floor still reads as clickable tiles.
    g.lineStyle(1, tone.grid, 0.1);
    for (let x = Math.ceil(floorLeft / tileDim) * tileDim; x < floorRight; x += tileDim) {
      g.moveTo(x, floorY);
      g.lineTo(x, roomBottom);
    }
    g.lineStyle(0);

    // Side walls down the left/right edges for a boxed-room feel.
    g.beginFill(shade(tone.border, 0.96), 1);
    g.drawRect(roomX, floorY, sideW, roomBottom - floorY);
    g.drawRect(floorRight, floorY, sideW, roomBottom - floorY);
    g.endFill();
    g.beginFill(wallLight, 0.3);
    g.drawRect(floorLeft - tileDim * 0.08, floorY, tileDim * 0.08, roomBottom - floorY);
    g.drawRect(floorRight, floorY, tileDim * 0.08, roomBottom - floorY);
    g.endFill();

    // Baseboard trim + soft contact shadow where the wall meets the floor.
    g.beginFill(wallShade, 1);
    g.drawRect(roomX, floorY - tileDim * 0.14, roomW, tileDim * 0.14);
    g.endFill();
    g.beginFill(0x000000, 0.1);
    g.drawRect(floorLeft, floorY, floorW, tileDim * 0.22);
    g.endFill();

    // Chalkboard mounted on the back wall.
    const boardX = roomX + tileDim * 2;
    const boardY = roomY + tileDim * 0.34;
    const boardW = roomW - tileDim * 4;
    const boardH = wallH - tileDim * 0.74;
    g.beginFill(shade(tone.border, 0.76), 1);
    g.drawRoundedRect(boardX - 3, boardY - 3, boardW + 6, boardH + 6, 6);
    g.endFill();
    g.lineStyle(2, ink, 0.64);
    g.beginFill(tone.board, 1);
    g.drawRoundedRect(boardX, boardY, boardW, boardH, 4);
    g.endFill();
    g.lineStyle(0);
    g.lineStyle(2, 0xf8fafc, 0.24);
    g.moveTo(boardX + tileDim * 0.4, boardY + boardH * 0.4);
    g.lineTo(boardX + boardW * 0.5, boardY + boardH * 0.4);
    g.moveTo(boardX + tileDim * 0.4, boardY + boardH * 0.64);
    g.lineTo(boardX + boardW * 0.36, boardY + boardH * 0.64);
    g.lineStyle(0);
    g.beginFill(shade(tone.border, 0.58), 1);
    g.drawRect(boardX, boardY + boardH, boardW, tileDim * 0.1);
    g.endFill();

    // Wall clock near the top-right corner.
    g.lineStyle(2, 0x1f2937, 0.6);
    g.beginFill(0xf8fafc, 1);
    g.drawCircle(roomX + roomW - tileDim * 0.95, roomY + tileDim * 0.55, tileDim * 0.2);
    g.endFill();
    g.lineStyle(0);

    // Teacher desk in front of the board.
    const teacherX = roomX + roomW / 2 - tileDim;
    const teacherY = floorY + tileDim * 0.45;
    drawShadow(g, teacherX + tileDim, teacherY + tileDim * 0.8, tileDim * 1.2, tileDim * 0.3);
    drawTeacherDesk(g, teacherX, teacherY, tileDim);

    // Student desks in two rows; the front row is larger and darker so the
    // room reads with foreground/background depth.
    const deskRows = [
      { y: ClassroomBounds.minY + 4, scale: 0.96, shadeFactor: 1.0 },
      { y: ClassroomBounds.minY + 6, scale: 1.12, shadeFactor: 0.84 },
    ];
    const deskCols = [0.22, 0.5, 0.78].map((ratio) => floorLeft + floorW * ratio - tileDim * 0.55);
    for (const row of deskRows) {
      for (const dx of deskCols) {
        const dy = row.y * tileDim;
        drawShadow(
          g,
          dx + tileDim * 0.58 * row.scale,
          dy + tileDim * 0.84 * row.scale,
          tileDim * 0.62 * row.scale,
          tileDim * 0.18 * row.scale,
        );
        drawStudentDesk(g, dx, dy, tileDim, row.scale, row.shadeFactor);
      }
    }
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
        backdrop: 0x101827,
        floor: 0xefe5cf,
        tileA: 0xe9f7df,
        tileB: 0xc5e6bc,
        border: 0xa88662,
        grid: 0x7f735f,
        board: 0x506f5f,
      };
    case 'aiClubRoom':
      return {
        backdrop: 0x0f172a,
        floor: 0xf2e0c7,
        tileA: 0xe2f7ff,
        tileB: 0xb9dff0,
        border: 0xb88b5a,
        grid: 0x8b7c67,
        board: 0x596e83,
      };
    case 'studentCouncilRoom':
      return {
        backdrop: 0x16131f,
        floor: 0xeadfd4,
        tileA: 0xf1dddd,
        tileB: 0xd4baba,
        border: 0x9f7467,
        grid: 0x887169,
        board: 0x5a4c59,
      };
    case 'dormitory':
      return {
        backdrop: 0x141827,
        floor: 0xeadbc7,
        tileA: 0xf6e4c7,
        tileB: 0xd9bd96,
        border: 0xa98263,
        grid: 0x8a7563,
        board: 0x60566f,
      };
    case 'classroom':
    default:
      return {
        backdrop: 0x101827,
        floor: 0xf3e3c8,
        tileA: 0xf7e8c9,
        tileB: 0xe8d1a6,
        border: 0xb68455,
        grid: 0x8d7a62,
        board: 0x3f6f5b,
      };
  }
}

function drawTeacherDesk(g: PIXI.Graphics, x: number, y: number, tileDim: number) {
  g.lineStyle(2, 0x2a2428, 0.72);
  g.beginFill(0x8f6542, 1);
  g.drawRoundedRect(x, y, tileDim * 2, tileDim * 0.8, 5);
  g.endFill();
  g.lineStyle(0);
  g.beginFill(0xb78a5f, 0.72);
  g.drawRoundedRect(x + 2, y + 2, tileDim * 2 - 4, tileDim * 0.32, 4);
  g.endFill();
  g.beginFill(0xfffbef, 1);
  g.drawRect(x + tileDim * 1.35, y + tileDim * 0.12, tileDim * 0.42, tileDim * 0.3);
  g.endFill();
}

function drawStudentDesk(
  g: PIXI.Graphics,
  x: number,
  y: number,
  tileDim: number,
  scale = 1,
  shadeFactor = 1,
) {
  const w = tileDim * 1.15 * scale;
  const h = tileDim * 0.75 * scale;
  // Chair tucked toward the front (viewer side) so the desk reads as a seat.
  g.lineStyle(0);
  g.beginFill(shade(0x536175, shadeFactor), 1);
  g.drawRoundedRect(x + w * 0.13, y + h + tileDim * 0.08 * scale, w * 0.74, tileDim * 0.3 * scale, 4);
  g.endFill();
  g.lineStyle(2, shade(0x2a2428, shadeFactor), 0.72);
  g.beginFill(shade(0x9b6b3d, shadeFactor), 1);
  g.drawRoundedRect(x, y, w, h, 4);
  g.endFill();
  g.lineStyle(0);
  g.beginFill(shade(0xbf9363, shadeFactor), 0.64);
  g.drawRoundedRect(x + 2, y + 2, w - 4, h * 0.4, 3);
  g.endFill();
}

function drawShadow(g: PIXI.Graphics, cx: number, cy: number, rx: number, ry: number) {
  g.lineStyle(0);
  g.beginFill(0x000000, 0.12);
  g.drawEllipse(cx, cy, rx, ry);
  g.endFill();
}

// Multiply an 0xRRGGBB color by a factor to lighten (>1) or darken (<1).
function shade(color: number, factor: number) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const clamp = (c: number) => Math.max(0, Math.min(255, Math.round(c * factor)));
  return (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
}

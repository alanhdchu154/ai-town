import { Graphics } from '@pixi/react';
import { Graphics as PixiGraphics } from 'pixi.js';
import { useCallback } from 'react';
import type { ClientPlayer } from '../lib/clientGameState';

export function DebugPath({ player, tileDim }: { player: ClientPlayer; tileDim: number }) {
  const path = player.pathfinding?.state.kind == 'moving' && player.pathfinding.state.path;
  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      if (!path) {
        return;
      }
      let first = true;
      for (const p of path) {
        const position = { x: p[0], y: p[1] };
        const x = position.x * tileDim + tileDim / 2;
        const y = position.y * tileDim + tileDim / 2;
        if (first) {
          g.moveTo(x, y);
          g.lineStyle(2, debugColor(player.id), 0.5);
          first = false;
        } else {
          g.lineTo(x, y);
        }
      }
    },
    [path],
  );
  return path ? <Graphics draw={draw} /> : null;
}
function debugColor(_id: string) {
  return { h: 0, s: 50, l: 90 };
}

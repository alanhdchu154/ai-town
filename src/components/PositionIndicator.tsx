import { useEffect, useState } from 'react';
import { Graphics } from '@pixi/react';
import { Graphics as PixiGraphics } from 'pixi.js';

const ANIMATION_DURATION = 4000;
const RADIUS_TILES = 0.34;

export function PositionIndicator(props: {
  destination: { x: number; y: number; t: number };
  tileDim: number;
}) {
  const { destination, tileDim } = props;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(interval);
  }, [destination.t]);
  const draw = (g: PixiGraphics) => {
    g.clear();
    if (destination.t + ANIMATION_DURATION <= now) {
      return;
    }
    const progress = (now - destination.t) / ANIMATION_DURATION;
    const x = destination.x * tileDim;
    const y = destination.y * tileDim;
    const alpha = Math.max(0.18, 1 - progress);
    g.lineStyle(2.2, 0x38bdf8, alpha);
    g.drawCircle(x, y, RADIUS_TILES * tileDim);
    g.lineStyle(1.4, 0xf8fafc, alpha * 0.75);
    g.drawCircle(x, y, RADIUS_TILES * (1 + progress * 0.85) * tileDim);
    g.moveTo(x - tileDim * 0.22, y);
    g.lineTo(x + tileDim * 0.22, y);
    g.moveTo(x, y - tileDim * 0.22);
    g.lineTo(x, y + tileDim * 0.22);
  };
  return <Graphics draw={draw} />;
}

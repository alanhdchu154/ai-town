import { BaseTexture, ISpritesheetData, Spritesheet } from 'pixi.js';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatedSprite, Container, Graphics, Sprite, Text, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';

export const Character = ({
  textureUrl,
  spritesheetData,
  x,
  y,
  orientation,
  isMoving = false,
  isThinking = false,
  isSpeaking = false,
  isInteractable = false,
  isInConversation = false,
  emoji = '',
  isViewer = false,
  isSelectedTarget = false,
  speed = 0.1,
  tint,
  accent,
  nameLabel,
  pixelAvatar,
  spriteUrl,
  onClick,
}: {
  // Path to the texture packed image.
  textureUrl: string;
  // The data for the spritesheet.
  spritesheetData: ISpritesheetData;
  // The pose of the NPC.
  x: number;
  y: number;
  orientation: number;
  isMoving?: boolean;
  // Shows a thought bubble if true.
  isThinking?: boolean;
  // Shows a speech bubble if true.
  isSpeaking?: boolean;
  isInteractable?: boolean;
  isInConversation?: boolean;
  emoji?: string;
  // Highlights the player.
  isViewer?: boolean;
  isSelectedTarget?: boolean;
  // The speed of the animation. Can be tuned depending on the side and speed of the NPC.
  speed?: number;
  tint?: number;
  accent?: number;
  nameLabel?: string;
  pixelAvatar?: {
    avatar: string[];
    palette: Record<string, number>;
  };
  spriteUrl?: string;
  onClick: () => void;
}) => {
  const [spriteSheet, setSpriteSheet] = useState<Spritesheet>();
  const [customSpriteReady, setCustomSpriteReady] = useState(false);
  const [customSpriteSize, setCustomSpriteSize] = useState<{ width: number; height: number }>();
  const [idleOffset, setIdleOffset] = useState(0);
  const [spriteFrame, setSpriteFrame] = useState(0);
  const idleTimeRef = useRef(0);
  const motionTimeRef = useRef(0);
  useEffect(() => {
    const parseSheet = async () => {
      const sheet = new Spritesheet(
        BaseTexture.from(textureUrl, {
          scaleMode: PIXI.SCALE_MODES.NEAREST,
        }),
        spritesheetData,
      );
      await sheet.parse();
      setSpriteSheet(sheet);
    };
    void parseSheet();
  }, []);

  useEffect(() => {
    if (!spriteUrl) {
      setCustomSpriteReady(false);
      setCustomSpriteSize(undefined);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) {
        setCustomSpriteReady(true);
        setCustomSpriteSize({ width: image.naturalWidth, height: image.naturalHeight });
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setCustomSpriteReady(false);
        setCustomSpriteSize(undefined);
      }
    };
    image.src = spriteUrl;
    return () => {
      cancelled = true;
    };
  }, [spriteUrl]);

  // The first "left" is "right" but reflected.
  const roundedOrientation = Math.floor(orientation / 90);
  const direction = ['right', 'down', 'left', 'up'][roundedOrientation];

  // Prevents the animation from stopping when the texture changes
  // (see https://github.com/pixijs/pixi-react/issues/359)
  const ref = useRef<PIXI.AnimatedSprite | null>(null);
  useEffect(() => {
    if (isMoving) {
      ref.current?.play();
    }
  }, [direction, isMoving]);
  useTick((delta) => {
    if (isMoving) {
      motionTimeRef.current += delta;
      setSpriteFrame(Math.floor(motionTimeRef.current / 8) % 3);
      setIdleOffset(0);
      idleTimeRef.current = 0;
      return;
    }
    motionTimeRef.current = 0;
    setSpriteFrame(0);
    idleTimeRef.current += delta;
    const amplitude = isViewer || isSelectedTarget ? 1.25 : isInConversation ? 0.85 : 0.55;
    const phase = idleTimeRef.current / 18 + x * 0.017 + y * 0.013;
    setIdleOffset(Math.sin(phase) * amplitude);
  });

  if (!spriteSheet) return null;

  let blockOffset = { x: 0, y: 0 };
  switch (roundedOrientation) {
    case 2:
      blockOffset = { x: -20, y: 0 };
      break;
    case 0:
      blockOffset = { x: 20, y: 0 };
      break;
    case 3:
      blockOffset = { x: 0, y: -20 };
      break;
    case 1:
      blockOffset = { x: 0, y: 20 };
      break;
  }

  return (
    <Container x={x} y={y + idleOffset} interactive={true} pointerdown={onClick} cursor="pointer">
      {isThinking && (
        // TODO: We'll eventually have separate assets for thinking and speech animations.
        <Text x={-20} y={-10} scale={{ x: -0.8, y: 0.8 }} text={'💭'} anchor={{ x: 0.5, y: 0.5 }} />
      )}
      {isSpeaking && (
        // TODO: We'll eventually have separate assets for thinking and speech animations.
        <Text x={18} y={-10} scale={0.8} text={'💬'} anchor={{ x: 0.5, y: 0.5 }} />
      )}
      {isMoving && !isSpeaking && !isThinking && (
        <>
          <MovementTrail color={accent ?? 0xfde68a} />
          <Text
            x={18}
            y={-12}
            scale={0.68}
            text={'…'}
            anchor={{ x: 0.5, y: 0.5 }}
            style={
              new PIXI.TextStyle({
                dropShadow: true,
                dropShadowBlur: 4,
                dropShadowColor: '#fde68a',
                fill: '#fff7ed',
                fontWeight: '900',
              })
            }
          />
        </>
      )}
      {(isInteractable || isInConversation) && !isSpeaking && !isThinking && (
        <Text
          x={18}
          y={-12}
          scale={0.72}
          text={'💬'}
          anchor={{ x: 0.5, y: 0.5 }}
          style={
            new PIXI.TextStyle({
              dropShadow: true,
              dropShadowBlur: 4,
              dropShadowColor: '#22d3ee',
              fill: '#ffffff',
            })
          }
        />
      )}
      {pixelAvatar && !customSpriteReady && <PixelAvatar avatar={pixelAvatar.avatar} palette={pixelAvatar.palette} />}
      {accent && <CharacterRing color={accent} />}
      {isViewer && <ViewerIndicator />}
      {isSelectedTarget && <TargetIndicator color={accent ?? 0x22d3ee} label={nameLabel} />}
      {customSpriteReady && spriteUrl && customSpriteSize ? (
        <CustomCharacterSprite
          spriteUrl={spriteUrl}
          sourceWidth={customSpriteSize.width}
          sourceHeight={customSpriteSize.height}
          direction={direction}
          frame={spriteFrame}
        />
      ) : (
        <AnimatedSprite
          ref={ref}
          isPlaying={isMoving}
          textures={spriteSheet.animations[direction]}
          animationSpeed={speed}
          anchor={{ x: 0.5, y: 0.5 }}
          tint={tint}
        />
      )}
      {nameLabel && (
        <Text
          x={0}
          y={20}
          scale={0.36}
          text={nameLabel}
          anchor={{ x: 0.5, y: 0.5 }}
          style={
            new PIXI.TextStyle({
              fill: '#fff3d0',
              fontFamily: 'monospace',
              fontSize: 18,
              fontWeight: '700',
              stroke: '#181425',
              strokeThickness: 4,
            })
          }
        />
      )}
      {emoji && (
        <Text x={0} y={-24} scale={{ x: -0.8, y: 0.8 }} text={emoji} anchor={{ x: 0.5, y: 0.5 }} />
      )}
    </Container>
  );
};

function CustomCharacterSprite({
  spriteUrl,
  sourceWidth,
  sourceHeight,
  direction,
  frame,
}: {
  spriteUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  direction: string;
  frame: number;
}) {
  const texture = useMemo(() => {
    const baseTexture = PIXI.BaseTexture.from(spriteUrl, {
      scaleMode: PIXI.SCALE_MODES.NEAREST,
    });
    const isDirectionalSheet = sourceWidth >= 96 && sourceHeight >= 128;
    const cellWidth = isDirectionalSheet ? 32 : sourceWidth;
    const cellHeight = isDirectionalSheet ? 32 : sourceHeight;
    const rowByDirection: Record<string, number> = {
      down: 0,
      left: 1,
      right: 2,
      up: 3,
    };
    const row = isDirectionalSheet ? rowByDirection[direction] ?? 0 : 0;
    const col = isDirectionalSheet ? Math.max(0, Math.min(2, frame)) : 0;
    return new PIXI.Texture(
      baseTexture,
      new PIXI.Rectangle(col * cellWidth, row * cellHeight, cellWidth, cellHeight),
    );
  }, [direction, frame, sourceHeight, sourceWidth, spriteUrl]);

  return <Sprite texture={texture} anchor={{ x: 0.5, y: 0.72 }} width={38} height={38} y={4} />;
}

function MovementTrail({ color }: { color: number }) {
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      g.lineStyle(2, color, 0.58);
      g.moveTo(-14, 13);
      g.lineTo(-5, 13);
      g.lineStyle(2, color, 0.36);
      g.moveTo(-17, 17);
      g.lineTo(-8, 17);
      g.beginFill(color, 0.12);
      g.drawEllipse(0, 12, 18, 7);
      g.endFill();
    },
    [color],
  );

  return <Graphics draw={draw} />;
}

function PixelAvatar({ avatar, palette }: { avatar: string[]; palette: Record<string, number> }) {
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      const pixel = 2;
      const width = Math.max(...avatar.map((row) => row.length)) * pixel;
      const height = avatar.length * pixel;
      g.clear();
      g.beginFill(0x181425, 0.78);
      g.drawRoundedRect(-width / 2 - 2, -height - 29, width + 4, height + 4, 3);
      g.endFill();
      avatar.forEach((row, y) => {
        [...row].forEach((symbol, x) => {
          const color = palette[symbol];
          if (!color) return;
          g.beginFill(color, 1);
          g.drawRect(-width / 2 + x * pixel, -height - 27 + y * pixel, pixel, pixel);
          g.endFill();
        });
      });
    },
    [avatar, palette],
  );

  return <Graphics draw={draw} />;
}

function TargetIndicator({ color, label }: { color: number; label?: string }) {
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      g.lineStyle(3, color, 0.95);
      g.beginFill(color, 0.16);
      g.drawEllipse(0, 11, 17, 7);
      g.endFill();
    },
    [color],
  );

  return (
    <>
      <Graphics draw={draw} />
      <Text
        x={0}
        y={-38}
        scale={0.34}
        text={`目標：${label ?? ''}`}
        anchor={{ x: 0.5, y: 0.5 }}
        style={
          new PIXI.TextStyle({
            fill: '#e0f2fe',
            fontFamily: 'monospace',
            fontSize: 18,
            fontWeight: '700',
            stroke: '#0f172a',
            strokeThickness: 5,
          })
        }
      />
    </>
  );
}

function CharacterRing({ color }: { color: number }) {
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      g.lineStyle(2, color, 0.9);
      g.beginFill(color, 0.12);
      g.drawEllipse(0, 11, 13, 5);
      g.endFill();
    },
    [color],
  );

  return <Graphics draw={draw} />;
}

function ViewerIndicator() {
  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.beginFill(0xffff0b, 0.5);
    g.drawRoundedRect(-10, 10, 20, 10, 100);
    g.endFill();
  }, []);

  return (
    <>
      <Graphics draw={draw} />
      <Text
        x={0}
        y={-40}
        scale={0.34}
        text="你在這裡"
        anchor={{ x: 0.5, y: 0.5 }}
        style={
          new PIXI.TextStyle({
            fill: '#fff3d0',
            fontFamily: 'monospace',
            fontSize: 18,
            fontWeight: '700',
            stroke: '#181425',
            strokeThickness: 5,
          })
        }
      />
    </>
  );
}

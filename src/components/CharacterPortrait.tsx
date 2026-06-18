import { useEffect, useMemo, useState } from 'react';
import { PortraitEmotion, characterVisualFor } from '../../data/characterVisuals';
import { displayAgentName } from '../../data/displayNames';

export function CharacterPortrait({
  name,
  size = 'md',
  showName = true,
  emotion,
  renderOnly = false,
}: {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  emotion?: PortraitEmotion;
  renderOnly?: boolean;
}) {
  const visual = characterVisualFor(name);
  const pixelSize = size === 'lg' ? 4 : size === 'md' ? 3 : 2;
  const label = displayAgentName(name);
  const selectedEmotion = emotion ?? visual?.defaultEmotion ?? 'neutral';
  // Production UI intentionally reads only final original assets from /public/portraits.
  // Reference images in /public/portrait-references are art-direction inputs, not UI assets.
  const portraitCandidates = useMemo(
    () =>
      [
        size === 'lg' ? visual?.renderPaths?.[selectedEmotion] : undefined,
        size === 'lg' ? visual?.renderPath : undefined,
        renderOnly ? undefined : visual?.portraitPaths?.[selectedEmotion],
        renderOnly ? undefined : visual?.portraitPath,
      ].filter((path, index, paths): path is string => !!path && paths.indexOf(path) === index),
    [renderOnly, selectedEmotion, size, visual],
  );
  const [portraitCandidateIndex, setPortraitCandidateIndex] = useState(0);
  const portraitPath = portraitCandidates[portraitCandidateIndex];
  const imageFailed = !portraitPath;

  useEffect(() => {
    setPortraitCandidateIndex(0);
  }, [name, selectedEmotion]);

  if (size === 'lg') {
    const accent = visual ? `#${visual.accent.toString(16).padStart(6, '0')}` : '#8a6f4d';
    const tint = visual ? `#${visual.tint.toString(16).padStart(6, '0')}` : '#f2d3a1';
    return (
      <div
        className="character-portrait-card character-portrait-vn"
        title={visual?.artDirection ?? label}
        style={{
          borderColor: accent,
          ['--portrait-tint' as string]: tint,
          ['--portrait-accent' as string]: accent,
          ['--render-zoom' as string]: visual?.renderFraming?.zoom ?? 1,
          ['--render-y' as string]: visual?.renderFraming?.y ?? 'center',
          ['--render-offset-y' as string]: visual?.renderFraming?.offsetY ?? '0rem',
        }}
      >
        {portraitPath && !imageFailed ? (
          <img
            className="character-portrait-img"
            src={portraitPath}
            alt={label}
            onError={() => setPortraitCandidateIndex((index) => index + 1)}
          />
        ) : (
          <div
            className={`character-portrait-fallback character-portrait-fallback-${selectedEmotion}`}
            style={{
              ['--portrait-tint' as string]: tint,
              ['--portrait-accent' as string]: accent,
            }}
          >
            <span className="portrait-silhouette" />
            <span className="portrait-eye portrait-eye-left" />
            <span className="portrait-eye portrait-eye-right" />
            <span className="portrait-mouth" />
          </div>
        )}
        {showName ? (
          <div className="character-portrait-card-copy">
            <b>{label}</b>
            <span>{visual?.archetypeZh ?? '校園角色'}</span>
            <small>{emotionLabel(selectedEmotion)}</small>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="character-portrait" title={label}>
      <div
        className="character-portrait-grid"
        style={{
          borderColor: visual ? `#${visual.accent.toString(16).padStart(6, '0')}` : '#8a6f4d',
          gridTemplateColumns: `repeat(${visual?.avatar[0]?.length ?? 8}, ${pixelSize}px)`,
        }}
      >
        {(visual?.avatar ?? []).flatMap((row, y) =>
          [...row].map((symbol, x) => {
            const color = visual?.palette[symbol];
            return (
              <span
                key={`${x}-${y}`}
                style={{
                  width: pixelSize,
                  height: pixelSize,
                  backgroundColor: color
                    ? `#${color.toString(16).padStart(6, '0')}`
                    : 'transparent',
                }}
              />
            );
          }),
        )}
      </div>
      {showName ? <span className="character-portrait-label">{label}</span> : null}
    </div>
  );
}

function emotionLabel(emotion: PortraitEmotion) {
  if (emotion === 'smiling') return '微笑';
  if (emotion === 'worried') return '擔心';
  if (emotion === 'serious') return '認真';
  if (emotion === 'tired') return '疲憊';
  if (emotion === 'flustered') return '害羞';
  if (emotion === 'guarded') return '防備';
  if (emotion === 'calm') return '平靜';
  return '中性';
}

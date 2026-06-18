import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

type EmotionChange = {
  id: string;
  name: string;
  rawName: string;
  previousEmotion: string | null;
  emotion: string;
  reasonZh: string;
  causeKind: 'conversation' | 'event' | 'pressure' | 'decay';
  causeEventId: string | null;
  day: number;
  clock: { hour: number; minute?: number; day: number };
  createdAt: number;
  worldTimeLabelZh: string;
  behaviorSignalZh: string;
};

const causeLabels: Record<EmotionChange['causeKind'], string> = {
  conversation: '對話',
  event: '事件',
  pressure: '壓力',
  decay: '沉澱',
};

const emotionLabels: Record<string, string> = {
  neutral: '中性',
  smiling: '放鬆',
  worried: '擔心',
  serious: '認真',
  tired: '疲憊',
  flustered: '動搖',
  guarded: '防備',
  calm: '平靜',
};

export default function EmotionFluctuationDashboard() {
  const data = useQuery(api.school.recentEmotionChanges, { limit: 80 });
  const changes = (data?.changes ?? []) as EmotionChange[];
  const groups = useMemo(() => groupByCharacter(changes), [changes]);

  if (data === undefined) {
    return (
      <div className="giis-emotion-empty" role="status">
        正在讀取情緒波動。
      </div>
    );
  }

  if (!changes.length) {
    return (
      <div className="giis-emotion-empty" role="status">
        目前還沒有結構化情緒變化。等下一段乾淨對話或校園事件觸發後，這裡會顯示「為什麼變、變成什麼、可能怎麼表現」。
      </div>
    );
  }

  return (
    <section className="giis-emotion-panel" aria-label="情緒波動">
      <div className="giis-emotion-overview">
        <div>
          <span>Changes</span>
          <b>{data.count}</b>
        </div>
        <div>
          <span>Characters</span>
          <b>{groups.length}</b>
        </div>
        <div>
          <span>Use</span>
          <b>觀察，不是分數</b>
        </div>
      </div>
      <div className="giis-emotion-timeline">
        {groups.map((group) => (
          <article className="giis-emotion-character" key={group.name}>
            <header>
              <h3>{group.name}</h3>
              <small>{group.items.length} changes</small>
            </header>
            <div className="giis-emotion-chip-row">
              {group.items.map((change) => (
                <EmotionChip key={change.id} change={change} />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EmotionChip({ change }: { change: EmotionChange }) {
  const previous = change.previousEmotion ? emotionLabels[change.previousEmotion] ?? change.previousEmotion : '未標記';
  const next = emotionLabels[change.emotion] ?? change.emotion;
  return (
    <div className={`giis-emotion-chip giis-emotion-${change.causeKind}`}>
      <div className="giis-emotion-chip-top">
        <span>{causeLabels[change.causeKind]}</span>
        <time>{change.worldTimeLabelZh || formatTime(change.createdAt)}</time>
      </div>
      <p className="giis-emotion-transition">
        {previous} → <b>{next}</b>
      </p>
      <p className="giis-emotion-reason">{change.reasonZh}</p>
      <p className="giis-emotion-behavior">{change.behaviorSignalZh}</p>
    </div>
  );
}

function groupByCharacter(changes: EmotionChange[]) {
  const grouped = new Map<string, EmotionChange[]>();
  for (const change of changes) {
    if (!grouped.has(change.name)) grouped.set(change.name, []);
    grouped.get(change.name)!.push(change);
  }
  return Array.from(grouped.entries()).map(([name, items]) => ({ name, items }));
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

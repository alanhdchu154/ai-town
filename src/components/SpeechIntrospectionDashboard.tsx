import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

type SpeechIntrospectionDashboardProps = {
  onOpenWorld: () => void;
  onOpenWall: () => void;
};

type SpeechSample = {
  conversationId: string;
  characterName: string;
  otherCharacterName: string;
  innerWant: string;
  heldBack: string;
  gateReason: string | null;
  said: string;
  day: number;
  createdAt: number;
};

type ConversationGroup = {
  id: string;
  day: number;
  samples: SpeechSample[];
};

const MOCK_SAMPLES: SpeechSample[] = [
  {
    conversationId: 'layout-preview-1',
    characterName: '海',
    otherCharacterName: '真晝',
    innerWant: '我想直接問你是不是也覺得今天的校園怪怪的。',
    heldBack: '把「怪怪的」收起來，先不要讓對方覺得被逼問。',
    gateReason: '保護對方的安全感；避免把直覺說成定論。',
    said: '你剛剛有沒有注意到走廊那邊的氣氛？',
    day: 3,
    createdAt: Date.now() - 12 * 60_000,
  },
  {
    conversationId: 'layout-preview-1',
    characterName: '真晝',
    otherCharacterName: '海',
    innerWant: '我其實也有看到，但不確定該不該說。',
    heldBack: '沒有立刻講出自己的害怕，只先確認共同觀察。',
    gateReason: '害怕把氣氛推向更緊張的方向。',
    said: '嗯，我有注意到。也許我們可以先多看一下。',
    day: 3,
    createdAt: Date.now() - 10 * 60_000,
  },
];

export default function SpeechIntrospectionDashboard({
  onOpenWorld,
  onOpenWall,
}: SpeechIntrospectionDashboardProps) {
  const [expandedConversationIds, setExpandedConversationIds] = useState<Set<string>>(
    () => new Set(['layout-preview-1']),
  );
  const data = useQuery(api.school.recentSpeechIntrospection, { limit: 80 });
  const liveSamples = (data?.samples ?? []) as SpeechSample[];
  const showingPreview = data === undefined || liveSamples.length === 0;
  const samples = showingPreview ? MOCK_SAMPLES : liveSamples;
  const groupsByDay = useMemo(() => groupSamples(samples), [samples]);
  const totalTurns = liveSamples.length;

  const toggleConversation = (id: string) => {
    setExpandedConversationIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="giis-speech-dashboard">
      <header className="giis-speech-header">
        <div>
          <p className="giis-wall-kicker">Speech Introspection</p>
          <h2>語音內省儀表板</h2>
          <p>
            把角色「想說」、「被 HIDE 或軟化」、「最後說出口」拆開看，讓我們檢查靈魂 gate
            是否真的在影響對話。
          </p>
        </div>
        <div className="giis-speech-header-actions">
          <button className="giis-wall-world-button" type="button" onClick={onOpenWall}>
            回到對話牆
          </button>
          <button className="giis-wall-world-button" type="button" onClick={onOpenWorld}>
            回到世界
          </button>
        </div>
      </header>

      <div className="giis-speech-status-row">
        <div>
          <span>Live rows</span>
          <b>{data === undefined ? '連線中' : totalTurns}</b>
        </div>
        <div>
          <span>Runtime capture</span>
          <b className={data?.enabled ? 'ok' : 'warn'}>{data?.enabled ? 'enabled' : 'off / pending'}</b>
        </div>
        <div>
          <span>Current view</span>
          <b>{showingPreview ? 'layout preview' : 'live introspection'}</b>
        </div>
      </div>

      {showingPreview ? (
        <div className="giis-speech-preview-note" role="status">
          {data === undefined
            ? '正在讀取 speechIntrospection。下面先顯示 layout preview，不代表真實對話。'
            : '目前還沒有 speechIntrospection 寫入資料。下面只顯示 layout preview，不把 sample 當成世界證據。'}
        </div>
      ) : null}

      <div className="giis-speech-scroll">
        {groupsByDay.map((dayGroup) => (
          <section className="giis-speech-day" key={dayGroup.day}>
            <h3>Day {dayGroup.day}</h3>
            {dayGroup.conversations.map((conversation) => {
              const expanded = expandedConversationIds.has(conversation.id);
              const first = conversation.samples[0];
              const last = conversation.samples[conversation.samples.length - 1];
              return (
                <article className="giis-speech-conversation" key={conversation.id}>
                  <button
                    className="giis-speech-conversation-header"
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleConversation(conversation.id)}
                  >
                    <span>
                      {first.characterName} ↔ {first.otherCharacterName}
                    </span>
                    <small>
                      {conversation.samples.length} turns · {formatTime(first.createdAt)}-
                      {formatTime(last.createdAt)}
                    </small>
                  </button>
                  {expanded ? (
                    <div className="giis-speech-flow-list">
                      {conversation.samples.map((sample, index) => (
                        <SpeechFlowRow
                          key={`${sample.conversationId}-${sample.createdAt}-${index}`}
                          sample={sample}
                        />
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </section>
  );
}

function SpeechFlowRow({ sample }: { sample: SpeechSample }) {
  return (
    <div className="giis-speech-flow-row">
      <div className="giis-speech-column giis-speech-column-want">
        <span>{sample.characterName} 想說</span>
        <p>{sample.innerWant || '沒有記錄 innerWant。'}</p>
      </div>
      <div className="giis-speech-column giis-speech-column-hide">
        <span>被 HIDE / 軟化</span>
        <p>{sample.heldBack || '沒有被壓住的內容。'}</p>
        {sample.gateReason ? <small>{sample.gateReason}</small> : null}
      </div>
      <div className="giis-speech-column giis-speech-column-said">
        <span>
          {sample.characterName} → {sample.otherCharacterName}
        </span>
        <p>{sample.said || '沒有記錄 said。'}</p>
      </div>
    </div>
  );
}

function groupSamples(samples: SpeechSample[]) {
  const days = new Map<number, Map<string, ConversationGroup>>();
  for (const sample of samples) {
    if (!days.has(sample.day)) days.set(sample.day, new Map());
    const conversations = days.get(sample.day)!;
    if (!conversations.has(sample.conversationId)) {
      conversations.set(sample.conversationId, {
        id: sample.conversationId,
        day: sample.day,
        samples: [],
      });
    }
    conversations.get(sample.conversationId)!.samples.push(sample);
  }

  return Array.from(days.entries())
    .sort(([left], [right]) => right - left)
    .map(([day, conversations]) => ({
      day,
      conversations: Array.from(conversations.values()).map((conversation) => ({
        ...conversation,
        samples: [...conversation.samples].sort((left, right) => left.createdAt - right.createdAt),
      })),
    }));
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

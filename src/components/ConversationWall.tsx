import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

type ConversationWallProps = {
  onOpenWorld: () => void;
};

type ConversationEntry = {
  id: string;
  createdAt: number;
  timestampLabelZh?: string;
  involvedCharacters: string[];
  memoryTraces?: Array<{
    characterName: string;
    memoryLineZh?: string;
    residueLineZh?: string;
    memoryTimestampLabelZh?: string;
  }>;
  transcriptMessages: Array<{
    author: string;
    text: string;
    timestampLabelZh?: string;
  }>;
  messageCount: number;
};

type StatusEntry = {
  id: string;
  characterName: string;
  title: string;
  text: string;
  timestampLabelZh?: string;
  residueLineZh?: string;
};

type WallRow =
  | {
      kind: 'conversation';
      conversation: ConversationEntry;
      flags: string[];
      triad: boolean;
    }
  | {
      kind: 'status';
      status: StatusEntry;
      triad: boolean;
    };

type FilterMode = 'all' | 'conversations' | 'residual' | 'status' | 'flagged' | 'triad';

const TRIAD_NAMES = new Set(['海', '真晝', '明日奈']);

export default function ConversationWall({ onOpenWorld }: ConversationWallProps) {
  const [selectedCharacter, setSelectedCharacter] = useState('all');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  const data = useQuery(api.school.recentConversationEvalData, {
    timeZone: userTimeZone,
    limit: 36,
    messagesPerConversation: 8,
  });
  const campusState = useQuery(api.school.campusSocialState, {
    timeZone: userTimeZone,
  });

  const conversations = (data?.conversations ?? []) as ConversationEntry[];
  const statusEntries = useMemo(() => statusEntriesFromCampusState(campusState), [campusState]);
  const characterNames = useMemo(
    () =>
      Array.from(
        new Set([
          ...conversations.flatMap((conversation) => conversation.involvedCharacters ?? []),
          ...statusEntries.map((entry) => entry.characterName),
        ]),
      ).sort((left, right) => left.localeCompare(right, 'zh-Hant')),
    [conversations, statusEntries],
  );
  const rows = useMemo(
    () =>
      [
        ...conversations.map<WallRow>((conversation) => ({
          kind: 'conversation',
          conversation,
          flags: conversationFlags(conversation),
          triad: hasTriadCharacter(conversation.involvedCharacters),
        })),
        ...statusEntries.map<WallRow>((status) => ({
          kind: 'status',
          status,
          triad: TRIAD_NAMES.has(status.characterName),
        })),
      ].filter((row) => {
          if (selectedCharacter !== 'all' && !wallRowCharacters(row).includes(selectedCharacter)) {
            return false;
          }
          if (filterMode === 'conversations' && row.kind !== 'conversation') return false;
          if (filterMode === 'residual') {
            return row.kind === 'conversation'
              ? conversationTraceItems(row.conversation).length > 0
              : Boolean(row.status.residueLineZh);
          }
          if (filterMode === 'status' && row.kind !== 'status') return false;
          if (filterMode === 'flagged') {
            return row.kind === 'conversation' && row.flags.length > 0;
          }
          if (filterMode === 'triad' && !row.triad) return false;
          return true;
        }),
    [conversations, statusEntries, selectedCharacter, filterMode],
  );
  const summary = useMemo(() => conversationSummary(conversations, statusEntries), [conversations, statusEntries]);
  const strongest = useMemo(() => strongestMoment(conversations), [conversations]);
  const weakest = useMemo(() => weakestFailure(conversations), [conversations]);

  return (
    <section className="giis-conversation-wall">
      <header className="giis-conversation-wall-header">
        <div>
          <p className="giis-wall-kicker">GIIS Underworld</p>
          <h2>對話牆</h2>
        </div>
        <button className="giis-wall-world-button" type="button" onClick={onOpenWorld}>
          回到世界
        </button>
      </header>

      <div className="giis-wall-metrics" aria-label="conversation summary">
        <Metric label="對話" value={summary.total} />
        <Metric label="狀態" value={summary.status} />
        <Metric label="留下" value={summary.traced} tone={summary.traced ? 'ok' : undefined} />
        <Metric label="需看" value={summary.flagged} tone={summary.flagged ? 'warn' : 'ok'} />
      </div>

      <section className="giis-wall-focus-row">
        <div>
          <span>可讀片段</span>
          <p>{strongest}</p>
        </div>
        <div>
          <span>最需要看</span>
          <p>{weakest}</p>
        </div>
      </section>

      <div className="giis-wall-controls">
        <div className="giis-wall-segments" aria-label="conversation filters">
          {[
            ['all', '全部'],
            ['conversations', '對話'],
            ['residual', '有殘留'],
            ['status', '狀態'],
            ['triad', '試點'],
            ['flagged', '需看'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filterMode === value ? 'active' : ''}
              type="button"
              onClick={() => setFilterMode(value as FilterMode)}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          aria-label="character"
          value={selectedCharacter}
          onChange={(event) => setSelectedCharacter(event.target.value)}
        >
          <option value="all">所有角色</option>
          {characterNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="giis-wall-grid">
        {data === undefined || campusState === undefined ? (
          <div className="giis-wall-empty">載入中</div>
        ) : rows.length ? (
          rows.map((row) =>
            row.kind === 'conversation' ? (
              <ConversationCard conversation={row.conversation} flags={row.flags} key={row.conversation.id} />
            ) : (
              <StatusCard status={row.status} key={row.status.id} />
            ),
          )
        ) : (
          <div className="giis-wall-empty">沒有符合的對話</div>
        )}
      </div>
    </section>
  );
}

function ConversationCard({ conversation, flags }: { conversation: ConversationEntry; flags: string[] }) {
  return (
    <article className="giis-conversation-card">
      <header>
        <div>
          <h3>{conversation.involvedCharacters.join(' / ')}</h3>
          <p>{conversation.timestampLabelZh ?? timeLabel(conversation.createdAt)}</p>
        </div>
        <span>{conversation.messageCount} 則</span>
      </header>
      {flags.length ? (
        <div className="giis-wall-flags">
          {flags.map((flag) => (
            <span key={flag}>{flag}</span>
          ))}
        </div>
      ) : null}
      <ConversationTracePreview conversation={conversation} />
      <ol>
        {conversation.transcriptMessages.map((message, index) => (
          <li key={`${conversation.id}-${index}`}>
            <b>{message.author}</b>
            <p>{message.text}</p>
          </li>
        ))}
      </ol>
    </article>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div className={tone ? `giis-wall-metric ${tone}` : 'giis-wall-metric'}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function conversationSummary(conversations: ConversationEntry[], statusEntries: StatusEntry[]) {
  const characters = new Set(conversations.flatMap((conversation) => conversation.involvedCharacters ?? []));
  const flagged = conversations.filter((conversation) => conversationFlags(conversation).length > 0).length;
  const triad = conversations.filter((conversation) =>
    (conversation.involvedCharacters ?? []).some((name) => TRIAD_NAMES.has(name)),
  ).length;
  const traced = conversations.filter((conversation) => conversationTraceItems(conversation).length > 0).length;
  return {
    total: conversations.length,
    characters: characters.size,
    flagged,
    triad,
    traced,
    status: statusEntries.length,
  };
}

function StatusCard({ status }: { status: StatusEntry }) {
  return (
    <article className="giis-conversation-card giis-status-card">
      <header>
        <div>
          <h3>{status.characterName}</h3>
          <p>{status.timestampLabelZh ?? '目前狀態'}</p>
        </div>
        <span>{status.title}</span>
      </header>
      <div className="giis-wall-status-body">
        <p>{displayWallText(status.text)}</p>
        {status.residueLineZh ? (
          <div className="giis-wall-trace">
            <div>
              <span>記憶狀態</span>
              <p>{displayWallText(status.residueLineZh)}</p>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ConversationTracePreview({ conversation }: { conversation: ConversationEntry }) {
  const items = conversationTraceItems(conversation);
  if (!items.length) {
    return (
      <div className="giis-wall-trace giis-wall-trace-empty">
        <span>留下</span>
        <p>還沒有明顯殘留</p>
      </div>
    );
  }
  return (
    <div className="giis-wall-trace">
      {items.slice(0, 3).map((item) => (
        <div key={`${item.label}-${item.text}`}>
          <span>{item.label}</span>
          <p>{clip(item.text, 96)}</p>
        </div>
      ))}
    </div>
  );
}

function conversationTraceItems(conversation: ConversationEntry) {
  const items: Array<{ label: string; text: string }> = [];
  for (const trace of conversation.memoryTraces ?? []) {
    if (trace.residueLineZh) {
      items.push({ label: `${trace.characterName}還留著`, text: trace.residueLineZh });
    } else if (trace.memoryLineZh) {
      items.push({ label: `${trace.characterName}記住`, text: trace.memoryLineZh });
    }
    if (items.length >= 2) break;
  }
  return items;
}

function conversationFlags(conversation: ConversationEntry) {
  const transcript = conversation.transcriptMessages.map((message) => `${message.author}: ${message.text}`).join('\n');
  const flags = [];
  if (/\[ABORT_CONVERSATION\]|\[LEAVE\]|pilot LLM unavailable|fallback|無法提供|不能滿足/i.test(transcript)) {
    flags.push('fallback');
  }
  if (/我剛剛已經說過一次|我不想把同一句話重複給你聽/.test(transcript)) {
    flags.push('repeat');
  }
  if (/我(?:輕輕|慢慢|先|再|又|剛|剛剛|默默|順手)?(?:合上|放下|看向|走到|靠回|拿起|把手機|把[^，。]{0,18}(?:放下|轉過去|拿起|合上|收起|蓋好))/.test(transcript)) {
    flags.push('stage');
  }
  if (/你剛說|你剛才說|妳剛說|妳剛才說/.test(transcript)) {
    flags.push('echo');
  }
  if (/海 to|真晝 to|明日奈 to|Umi to|Mahiru to|Asuna to|你是海|你是真晝|你是明日奈/.test(transcript)) {
    flags.push('name');
  }
  return flags;
}

function statusEntriesFromCampusState(campusState: any): StatusEntry[] {
  const emotions = (campusState?.emotions ?? [])
    .filter((entry: any) => entry?.name && entry.name !== 'Alan')
    .map((entry: any) => ({
      id: `status-${entry.name}`,
      characterName: displayWallName(entry.name),
      title: entry.availabilityZh ?? entry.statusZh ?? '目前狀態',
      text: entry.quietLineZh ?? entry.statusZh ?? '今天還沒有明顯狀態更新。',
      residueLineZh: entry.residueLineZh,
    }));
  const notifications = (campusState?.notifications ?? [])
    .filter((notification: any) =>
      ['emotion_changed', 'relationship_change', 'major_event'].includes(notification?.type),
    )
    .map((notification: any) => ({
      id: `notice-${notification.notificationId ?? notification._id}`,
      characterName: displayWallName(notification.relatedCharacterName ?? notification.actorName ?? '校園'),
      title: notification.titleZh ?? '狀態更新',
      text: notification.contentZh ?? notification.descriptionZh ?? '',
      timestampLabelZh: notification.timestampLabelZh,
    }))
    .filter((entry: StatusEntry) => entry.text);
  const seenNotifications = new Set<string>();
  const uniqueNotifications = notifications.filter((entry: StatusEntry) => {
    const key = `${entry.characterName}|${entry.title}|${normalizeWallText(entry.text)}`;
    if (seenNotifications.has(key)) return false;
    seenNotifications.add(key);
    return true;
  });
  return [...emotions, ...uniqueNotifications.slice(0, 8)].slice(0, 18);
}

function displayWallName(name: string) {
  if (name === 'Umi') return '海';
  if (name === 'Mahiru Shiina') return '真晝';
  if (name === 'Asuna') return '明日奈';
  if (name === 'CaoCao') return '曹操';
  if (name === 'Liu Bei') return '劉備';
  if (name === 'Mai') return '麻衣';
  return name;
}

function displayWallText(text: string) {
  return text
    .replaceAll('Mahiru Shiina', '真晝')
    .replaceAll('Asuna', '明日奈')
    .replaceAll('Liu Bei', '劉備')
    .replaceAll('CaoCao', '曹操')
    .replaceAll('Mai', '麻衣')
    .replaceAll('Umi', '海');
}

function normalizeWallText(text: string) {
  return displayWallText(text)
    .replace(/[，。！？、,.!?「」『』""''\s]/g, '')
    .slice(0, 80);
}

function hasTriadCharacter(names: string[]) {
  return (names ?? []).some((name) => TRIAD_NAMES.has(name));
}

function wallRowCharacters(row: WallRow) {
  if (row.kind === 'conversation') return row.conversation.involvedCharacters ?? [];
  return [row.status.characterName];
}

function strongestMoment(conversations: ConversationEntry[]) {
  const message = conversations
    .flatMap((conversation) => conversation.transcriptMessages)
    .find((row) => /不是.*一個人|一起|記得|沒敢說出口|不該|休息|接手|分掉/.test(row.text));
  return message ? `${message.author}：${clip(message.text, 72)}` : '尚未有足夠樣本';
}

function weakestFailure(conversations: ConversationEntry[]) {
  for (const conversation of conversations) {
    const flags = conversationFlags(conversation);
    if (!flags.length) continue;
    const message = conversation.transcriptMessages.find((row) =>
      /我合上|我放下|我把|你剛說|你剛才說|fallback|無法提供|不能滿足/.test(row.text),
    );
    return `${flags.join('/')} · ${message ? `${message.author}：${clip(message.text, 72)}` : conversation.involvedCharacters.join(' / ')}`;
  }
  return conversations.length ? '暫無明顯 hygiene flag' : '尚未有 archived conversations';
}

function timeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

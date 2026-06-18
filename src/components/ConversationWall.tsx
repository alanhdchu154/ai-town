import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { CharacterPortrait } from './CharacterPortrait';

type ConversationWallProps = {
  onOpenIntrospection: () => void;
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

// All six pilots with an authored five-layer soul now carry residue, so the
// "試點" filter and triad highlighting cover the whole soul cast, not just the
// original three. (Field/flag names keep the `triad` spelling to avoid churn.)
const PILOT_NAMES = new Set(['海', '真晝', '天澤', '一之瀨', '貓貓', '祥子']);

// The four layers of how a soul forms, shown as tabs so the pipeline is legible:
// a 對話 happens → it leaves a 殘留 (involuntary trace) → some of it is kept as a
// 記憶 (what they subjectively took away) → sleep consolidates it into a 睡眠筆記.
type WallView = 'talk' | 'residue' | 'memory' | 'sleep';
const WALL_VIEWS: Array<[WallView, string]> = [
  ['talk', '對話'],
  ['residue', '殘留'],
  ['memory', '記憶'],
  ['sleep', '睡眠筆記'],
];

export default function ConversationWall({ onOpenIntrospection, onOpenWorld }: ConversationWallProps) {
  const [selectedCharacter, setSelectedCharacter] = useState('all');
  const [wallView, setWallView] = useState<WallView>('talk');
  const [showHelp, setShowHelp] = useState(false);
  const [compactWall, setCompactWall] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 900px)').matches,
  );
  const [slowInitialLoad, setSlowInitialLoad] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const onChange = () => setCompactWall(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  const data = useQuery(api.school.recentConversationEvalData, {
    timeZone: userTimeZone,
    limit: compactWall ? 18 : 36,
    messagesPerConversation: compactWall ? 5 : 8,
  });
  const sleepData = useQuery(api.sleepNotes.sleepNotesSummary, wallView === 'sleep' ? {} : 'skip');
  useEffect(() => {
    if (data !== undefined) {
      setSlowInitialLoad(false);
      return;
    }
    const timeout = window.setTimeout(() => setSlowInitialLoad(true), compactWall ? 2800 : 4200);
    return () => window.clearTimeout(timeout);
  }, [compactWall, data]);

  const conversations = (data?.conversations ?? []) as ConversationEntry[];
  const characterNames = useMemo(
    () =>
      Array.from(new Set(conversations.flatMap((conversation) => conversation.involvedCharacters ?? []))).sort(
        (left, right) => left.localeCompare(right, 'zh-Hant'),
      ),
    [conversations],
  );
  // 對話分頁：照角色篩選後，按「日」分組（讓你能看一個角色逐日的變化）。
  const visibleConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          selectedCharacter === 'all' ||
          (conversation.involvedCharacters ?? []).some(
            (name) => name === selectedCharacter || displayWallName(name) === selectedCharacter,
          ),
      ),
    [conversations, selectedCharacter],
  );
  const conversationsByDay = useMemo(() => groupByDay(visibleConversations, (c) => c.createdAt), [
    visibleConversations,
  ]);
  const wallLoading = data === undefined && !slowInitialLoad;

  return (
    <section className="giis-conversation-wall">
      <header className="giis-conversation-wall-header">
        <div>
          <p className="giis-wall-kicker">GIIS Underworld</p>
          <h2>對話牆</h2>
        </div>
        <div className="giis-wall-header-actions">
          <button className="giis-wall-world-button" type="button" onClick={onOpenIntrospection}>
            語音內省
          </button>
          <button className="giis-wall-world-button" type="button" onClick={onOpenWorld}>
            回到世界
          </button>
        </div>
      </header>

      <div className="giis-wall-segments giis-wall-tabs" aria-label="data layer tabs">
        {WALL_VIEWS.map(([value, label]) => (
          <button
            key={value}
            className={wallView === value ? 'active' : ''}
            type="button"
            onClick={() => setWallView(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="giis-wall-tab-hint">
        {wallView === 'talk' &&
          '他們實際說了什麼。對話一結束，每個人各自留下「記住的片段」與（被觸動時的）「殘留」。'}
        {wallView === 'residue' &&
          '殘留＝同一段對話在每個人心裡「不由自主」留下的主觀痕跡。只有被真正觸動時才有。'}
        {wallView === 'memory' &&
          '記住的片段＝他們主觀記下、帶走的事實錨點。幾乎每段對話都會有。'}
        {wallView === 'sleep' &&
          '睡眠筆記＝當晚把白天的痕跡整理成、明天會帶著走、會影響行為的長期記憶。'}
      </p>

      <div className="giis-wall-controls">
        <button type="button" className="giis-wall-help-toggle" onClick={() => setShowHelp((v) => !v)}>
          {showHelp ? '✕ 收起說明' : 'ℹ️ 這些是什麼、怎麼來的？'}
        </button>
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

      {showHelp ? <WallPipelineHelp /> : null}

      <div className="giis-wall-grid">
        {wallView === 'sleep' ? (
          <SleepView sleepData={sleepData} selectedCharacter={selectedCharacter} />
        ) : wallView === 'residue' || wallView === 'memory' ? (
          <TraceView conversations={visibleConversations} mode={wallView} />
        ) : wallLoading ? (
          <div className="giis-wall-empty">載入中</div>
        ) : conversationsByDay.length ? (
          conversationsByDay.map(([day, items]) => (
            <DaySection key={day} day={day}>
              {items.map((conversation) => (
                <ConversationCard conversation={conversation} key={conversation.id} />
              ))}
            </DaySection>
          ))
        ) : (
          <div className="giis-wall-empty">
            {selectedCharacter === 'all' ? '還沒有對話' : `${selectedCharacter} 還沒有對話`}
          </div>
        )}
      </div>
    </section>
  );
}

// Group items by calendar day, newest day first — lets you read a character's
// trail day by day. Items keep their incoming (newest-first) order within a day.
function groupByDay<T>(items: T[], getTime: (item: T) => number): Array<[string, T[]]> {
  const buckets = new Map<string, { ts: number; items: T[] }>();
  for (const item of items) {
    const ts = getTime(item) || 0;
    const key = ts ? dayLabel(ts) : '更早';
    const bucket = buckets.get(key) ?? { ts, items: [] };
    bucket.items.push(item);
    bucket.ts = Math.max(bucket.ts, ts);
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => b[1].ts - a[1].ts)
    .map(([label, bucket]) => [label, bucket.items] as [string, T[]]);
}

function dayLabel(ts: number) {
  return new Date(ts).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' });
}

// Returns a Fragment so the full-width day header and the cards are all direct
// children of the CSS grid (the header spans the row via grid-column: 1 / -1).
function DaySection({ day, children }: { day: string; children: ReactNode }) {
  return (
    <>
      <h3 className="giis-wall-day-header">{day}</h3>
      {children}
    </>
  );
}

function sleepNoteTypeZh(noteType?: string) {
  if (noteType === 'long_term_memory_candidate') return '長期記憶';
  if (noteType === 'emotional_residue_candidate') return '情緒殘留';
  if (noteType === 'short_term_context') return '短期脈絡';
  if (noteType === 'relationship_trace') return '關係痕跡';
  return '睡眠筆記';
}

// The pipeline explainer (toggled by ℹ️) — what each layer is and how it is made.
function WallPipelineHelp() {
  return (
    <div className="giis-wall-help">
      <p className="giis-wall-help-lead">一段對話結束後，會分成這幾層留下來：</p>
      <ol className="giis-wall-help-flow">
        <li>
          <b>對話</b>
          <span>他們實際說了、做了什麼。</span>
        </li>
        <li>
          <b>
            記住的片段 <i>(客觀)</i>
          </b>
          <span>對話一結束，每個人各自記下「對方說／做了什麼」的事實錨點。幾乎每段都有。</span>
        </li>
        <li>
          <b>
            殘留 <i>(主觀・心裡留下的)</i>
          </b>
          <span>
            同一段對話在「我」心裡不由自主留下的感覺痕跡。只有被真正觸動時才有——這就是靈魂成長的來源。
          </span>
        </li>
        <li>
          <b>
            睡眠筆記 <i>(長期記憶)</i>
          </b>
          <span>當晚睡覺時，把白天重要的痕跡整理成一句、明天會帶著走並影響行為的長期記憶。</span>
        </li>
      </ol>
      <p className="giis-wall-help-foot">小技巧：選一個角色 + 切到「殘留」分頁，就能看那個角色逐日的心跡變化。</p>
    </div>
  );
}

function ConversationCard({ conversation }: { conversation: ConversationEntry }) {
  const characterNames = conversation.involvedCharacters.map(displayWallName);
  return (
    <article className="giis-conversation-card">
      <header>
        <div>
          <h3>{characterNames.join(' / ')}</h3>
          <p>{conversation.timestampLabelZh ?? timeLabel(conversation.createdAt)}</p>
        </div>
        <span>{conversation.messageCount} 則</span>
      </header>
      <div className="giis-wall-character-strip" aria-label="conversation characters">
        {characterNames.slice(0, 3).map((name) => (
          <CharacterPortrait key={name} name={name} size="sm" showName={false} />
        ))}
      </div>
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

// 殘留 / 記憶 tabs: one card per trace, so you read each soul's take on a
// conversation directly instead of digging it out of a transcript card.
function TraceView({
  conversations,
  mode,
}: {
  conversations: ConversationEntry[];
  mode: 'residue' | 'memory';
}) {
  const items = conversations.flatMap((conversation) =>
    (conversation.memoryTraces ?? [])
      .map((trace) => ({
        conversation,
        trace,
        line: mode === 'residue' ? trace.residueLineZh : trace.memoryLineZh,
      }))
      .filter((item) => item.line),
  );
  if (!items.length) {
    return <div className="giis-wall-empty">{mode === 'residue' ? '還沒有殘留' : '還沒有記住的片段'}</div>;
  }
  const byDay = groupByDay(items, (item) => item.conversation.createdAt);
  return (
    <>
      {byDay.map(([day, dayItems]) => (
        <DaySection key={day} day={day}>
          {dayItems.map(({ conversation, trace, line }, index) => {
            const self = displayWallName(trace.characterName);
            const partner = conversation.involvedCharacters
              .map(displayWallName)
              .filter((name) => name !== self)
              .join('、');
            return (
              <article
                className="giis-conversation-card giis-trace-card"
                key={`${conversation.id}-${trace.characterName}-${index}`}
              >
                <header>
                  <div>
                    <h3>{self}</h3>
                    <p>
                      {partner ? `對 ${partner}` : '獨白'} ·{' '}
                      {conversation.timestampLabelZh ?? timeLabel(conversation.createdAt)}
                    </p>
                  </div>
                  <CharacterPortrait name={self} size="sm" showName={false} />
                </header>
                <p className={mode === 'residue' ? 'giis-wall-residue-line' : 'giis-wall-memory-line'}>
                  {displayWallText(line ?? '')}
                </p>
              </article>
            );
          })}
        </DaySection>
      ))}
    </>
  );
}

// 睡眠筆記 tab: what sleep consolidated into a note the character will carry
// forward — the last step of the 對話 → 殘留 → 記憶 → 睡眠 pipeline.
function SleepView({ sleepData, selectedCharacter }: { sleepData: any; selectedCharacter: string }) {
  if (sleepData === undefined) {
    return <div className="giis-wall-empty">載入中</div>;
  }
  const notes = ((sleepData?.latest ?? []) as any[]).filter(
    (note) =>
      selectedCharacter === 'all' ||
      displayWallName(note.subjectName) === selectedCharacter ||
      note.subjectName === selectedCharacter,
  );
  if (!notes.length) {
    return <div className="giis-wall-empty">還沒有睡眠筆記</div>;
  }
  const byDay = groupByDay(notes, (note) => note.createdAt ?? 0);
  return (
    <>
      {byDay.map(([day, dayNotes]) => (
        <DaySection key={day} day={day}>
          {dayNotes.map((note, index) => {
            const self = displayWallName(note.subjectName);
            const about = (note.participantNames ?? [])
              .map(displayWallName)
              .filter((n: string) => n && n !== self);
            return (
              <article className="giis-conversation-card giis-sleep-card" key={`sleep-${self}-${index}`}>
                <header>
                  <div>
                    <h3>{self}</h3>
                    <p>
                      {sleepNoteTypeZh(note.noteType)}
                      {about.length ? ` · 關於 ${about.join('、')}` : ''}
                    </p>
                  </div>
                  <CharacterPortrait name={self} size="sm" showName={false} />
                </header>
                <p className="giis-wall-memory-line">{displayWallText(note.noteZh ?? '')}</p>
              </article>
            );
          })}
        </DaySection>
      ))}
    </>
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
    (conversation.involvedCharacters ?? []).some((name) => PILOT_NAMES.has(name)),
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
      <div className="giis-wall-character-strip" aria-label="status character">
        <CharacterPortrait name={status.characterName} size="sm" showName={false} />
      </div>
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

// The same conversation, side by side in each participant's soul: what trace it
// left in them (殘留) over what they subjectively took away (記住). This is the
// "same event → different souls" read — judge whether the exchange actually
// touched each character by comparing their traces against the transcript below.
function ConversationTracePreview({ conversation }: { conversation: ConversationEntry }) {
  const traces = (conversation.memoryTraces ?? []).filter(
    (trace) => trace.residueLineZh || trace.memoryLineZh,
  );
  if (!traces.length) {
    return (
      <div className="giis-wall-trace giis-wall-trace-empty">
        <span>留下</span>
        <p>還沒有明顯殘留</p>
      </div>
    );
  }
  return (
    <div className="giis-wall-trace giis-wall-soul-compare">
      {traces.map((trace) => (
        <div key={trace.characterName}>
          <span>
            {displayWallName(trace.characterName)}
            {trace.residueLineZh ? '心裡留下的' : '記住的片段'}
          </span>
          {trace.residueLineZh ? (
            <p className="giis-wall-residue-line">{displayWallText(trace.residueLineZh)}</p>
          ) : (
            <p className="giis-wall-memory-line">{displayWallText(trace.memoryLineZh ?? '')}</p>
          )}
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
  if (/海 to|真晝 to|天澤 to|天澤 to|Umi to|Mahiru to|Tianze to|你是海|你是真晝|你是天澤|你是天澤/.test(transcript)) {
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
  if (name === 'Mahiru' || name === 'Mahiru Shiina') return '真晝';
  if (name === 'Tianze') return '天澤';
  if (name === 'Maomao') return '貓貓';
  if (name === 'Sakiko') return '祥子';
  if (name === 'Ichinose') return '一之瀨';
  return name;
}

function displayWallText(text: string) {
  return text
    .replaceAll('Mahiru Shiina', '真晝')
    .replaceAll('Mahiru', '真晝')
    .replaceAll('Tianze', '天澤')
    .replaceAll('Sakiko', '祥子')
    .replaceAll('Maomao', '貓貓')
    .replaceAll('Ichinose', '一之瀨')
    .replaceAll('Umi', '海');
}

function normalizeWallText(text: string) {
  return displayWallText(text)
    .replace(/[，。！？、,.!?「」『』""''\s]/g, '')
    .slice(0, 80);
}

function hasTriadCharacter(names: string[]) {
  return (names ?? []).some((name) => PILOT_NAMES.has(name));
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

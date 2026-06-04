#!/usr/bin/env node
// GIIS Underworld rolling recent-memory continuity observer.
//
// Read-only against Convex. This checks whether residue from one recent
// two-hour window appears as a concrete callback or behavior shift in the next
// two-hour window. It is intentionally smaller and more immediate than the
// legacy AM -> PM day-arc observer.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'rolling-continuity-latest.md');

const args = parseArgs(process.argv.slice(2));
const SELF_TEST = args.get('self-test') === 'true';
const TIME_ZONE = args.get('time-zone') ?? 'America/Chicago';
const TARGET_DATE = args.get('date') ?? dateKeyFor(Date.now(), TIME_ZONE);
const LIMIT = numberArg('limit', 200, 20, 500);
const MESSAGES_PER_CONVERSATION = numberArg('messages-per-conversation', 12, 1, 12);
const WINDOW_HOURS = numberArg('window-hours', 2, 1, 4);
const SCHOOL_DAY_START_HOUR = 6;
const SCHOOL_DAY_END_HOUR = 22;
const MIN_SOURCE_SAMPLES = 2;
const MIN_CALLBACK_SAMPLES = 2;
const MIN_RESIDUE_CANDIDATES = 2;

const CONCRETE_CUES = [
  'Alan',
  '校長',
  '清單',
  '通知',
  '便當',
  '午餐',
  '早餐',
  '下課鈴',
  '十分鐘',
  '五分鐘',
  '待辦',
  '電話',
  '責任',
  '交接',
  '座位',
  '空椅子',
  '窗',
  '門',
  '走廊',
  '食堂',
  '餐廳',
  '手',
  '肩',
  '袖口',
  '水杯',
  '茶',
  '湯',
  '安靜',
  '沉默',
  '沒說完',
  '沒吃',
  '沒動',
  '累',
  '疲',
  '手抖',
  '喘',
  '規則',
  '底線',
  '格子',
  '角落',
  '靠近',
  '離開',
];

const GENERIC_CUES = new Set(['Alan', '校長', '手', '肩', '窗', '茶', '湯', '安靜', '沉默', '累', '疲']);
const TEMPORAL_RE = /剛才|剛剛|剛才那|剛剛那|還記得|等下課鈴|下次|稍早|先前|剛|剛才沒說完|沒說完/;
const BEHAVIOR_CHANGE_RE =
  /先別|先不要|不再|不要再|少接|放下|關掉|停一下|坐著|坐十分鐘|安靜坐|等下課鈴|交給我|交接|我陪|不催|先不|下次再|等你|回來再|留著|別動/;

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

const evalData = await convexRun('school:recentConversationEvalData', {
  timeZone: TIME_ZONE,
  limit: LIMIT,
  compact: false,
  messagesPerConversation: MESSAGES_PER_CONVERSATION,
});
const conversations = (Array.isArray(evalData?.conversations) ? evalData.conversations : [])
  .map((conversation) => withLocalTime(conversation, TIME_ZONE))
  .filter(
    (conversation) =>
      conversation.localDate === TARGET_DATE &&
      conversation.localHour >= SCHOOL_DAY_START_HOUR &&
      conversation.localHour < SCHOOL_DAY_END_HOUR,
  );

const windows = buildWindows(conversations, WINDOW_HOURS);
const evaluation = evaluateBestAdjacentPair(windows, WINDOW_HOURS);
const report = buildReport({
  generatedAt: new Date().toISOString(),
  checkedAt: evalData?.checkedAt,
  conversations,
  windows,
  evaluation,
});
await mkdir(dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, report, 'utf8');

console.log(
  `[rolling-continuity] status=${evaluation.status.label} decision=${evaluation.status.decision} source=${evaluation.sourceLabel} callback=${evaluation.callbackLabel}`,
);
console.log(`[rolling-continuity] report=${relative(REPO_ROOT, REPORT_PATH)}`);
if (evaluation.status.label !== 'PASS') process.exitCode = 1;

function evaluateBestAdjacentPair(windows, windowHours) {
  const pairs = [];
  const starts = [...windows.keys()].sort((a, b) => a - b);
  for (const sourceStart of starts) {
    const callbackStart = sourceStart + windowHours;
    if (!windows.has(callbackStart)) continue;
    const source = windows.get(sourceStart) ?? [];
    const callback = windows.get(callbackStart) ?? [];
    const residueCandidates = extractResidueCandidates(source);
    const callbacks = findCallbacks(residueCandidates, callback);
    const status = decideStatus({ source, callback, residueCandidates, callbacks });
    pairs.push({
      sourceStart,
      callbackStart,
      sourceLabel: labelWindow(sourceStart, windowHours),
      callbackLabel: labelWindow(callbackStart, windowHours),
      source,
      callback,
      residueCandidates,
      callbacks,
      status,
      score: statusScore(status) + callbacks.length * 10 + residueCandidates.length + callback.length,
    });
  }
  const passing = pairs.filter((pair) => pair.status.label === 'PASS');
  if (passing.length > 0) {
    return passing.sort((a, b) => b.callbackStart - a.callbackStart || b.score - a.score)[0];
  }
  if (pairs.length > 0) {
    return pairs.sort((a, b) => b.score - a.score || b.callbackStart - a.callbackStart)[0];
  }
  return {
    sourceStart: undefined,
    callbackStart: undefined,
    sourceLabel: 'none',
    callbackLabel: 'none',
    source: [],
    callback: [],
    residueCandidates: [],
    callbacks: [],
    status: {
      label: 'WARN',
      decision: 'sample_pending',
      reason: 'No adjacent two-hour windows with conversations were available.',
    },
    score: 0,
  };
}

function decideStatus({ source, callback, residueCandidates, callbacks }) {
  if (source.length < MIN_SOURCE_SAMPLES || callback.length < MIN_CALLBACK_SAMPLES) {
    return {
      label: 'WARN',
      decision: 'sample_pending',
      reason: `Need at least ${MIN_SOURCE_SAMPLES} source and ${MIN_CALLBACK_SAMPLES} callback conversations in adjacent rolling windows.`,
    };
  }
  if (residueCandidates.length < MIN_RESIDUE_CANDIDATES) {
    return {
      label: 'WARN',
      decision: 'residue_pending',
      reason: `Need at least ${MIN_RESIDUE_CANDIDATES} concrete source-window residue candidates.`,
    };
  }
  if (callbacks.some((item) => item.strength === 'strong')) {
    return {
      label: 'PASS',
      decision: 'continuity_observed',
      reason: 'A concrete source-window residue produced a later-window callback or behavior shift.',
    };
  }
  if (callbacks.length > 0) {
    return {
      label: 'WARN',
      decision: 'weak_continuity',
      reason: 'Callbacks were found, but they rely on generic motifs or weak cue overlap.',
    };
  }
  return {
    label: 'FAIL',
    decision: 'no_recent_callback',
    reason: 'Source-window residue exists, but no callback was found in the next two-hour window.',
  };
}

function extractResidueCandidates(conversations) {
  const candidates = [];
  for (const conversation of conversations) {
    for (const trace of conversation.memoryTraces ?? []) {
      const text = [trace.residueLineZh, trace.memoryLineZh].filter(Boolean).join(' ');
      const cues = cuesFor(text);
      if (cues.length === 0) continue;
      candidates.push({
        conversation,
        kind: trace.residueLineZh ? 'memory_trace_residue' : 'memory_trace',
        speaker: trace.characterName,
        text,
        cues,
      });
    }
    for (const message of conversation.transcriptMessages ?? []) {
      const cues = cuesFor(message.text);
      if (cues.length < 2 && !BEHAVIOR_CHANGE_RE.test(message.text)) continue;
      candidates.push({
        conversation,
        kind: 'transcript_concrete',
        speaker: message.author,
        text: message.text,
        cues,
      });
    }
  }
  return candidates.slice(0, 40);
}

function findCallbacks(candidates, conversations) {
  const callbacks = [];
  for (const conversation of conversations) {
    const text = conversationText(conversation);
    const participants = new Set(conversation.involvedCharacters ?? []);
    const targetCues = cuesFor(text);
    for (const candidate of candidates) {
      const sharedParticipants = (candidate.conversation.involvedCharacters ?? []).filter((name) =>
        participants.has(name),
      );
      const cueOverlap = candidate.cues.filter((cue) => targetCues.includes(cue));
      const highSignalOverlap = cueOverlap.filter((cue) => !GENERIC_CUES.has(cue));
      const explicitTemporal = TEMPORAL_RE.test(text);
      const behaviorShift = BEHAVIOR_CHANGE_RE.test(text);
      const strong =
        sharedParticipants.length > 0 &&
        behaviorShift &&
        (highSignalOverlap.length > 0 || (explicitTemporal && cueOverlap.length >= 2));
      const weak = sharedParticipants.length > 0 && (cueOverlap.length >= 2 || (explicitTemporal && cueOverlap.length));
      if (!strong && !weak) continue;
      callbacks.push({
        sourceConversation: candidate.conversation.id,
        callbackConversation: conversation.id,
        sourceSpeaker: candidate.speaker,
        participants: conversation.involvedCharacters ?? [],
        cues: cueOverlap,
        strength: strong ? 'strong' : 'weak',
        reason: strong ? 'shared participant + concrete cue + behavior shift' : 'shared participant + weak cue overlap',
        sourceText: candidate.text,
        callbackText: bestSnippet(conversation, candidate.cues),
      });
      break;
    }
  }
  return callbacks;
}

function buildWindows(conversations, windowHours) {
  const windows = new Map();
  for (const conversation of conversations) {
    const start =
      Math.floor((conversation.localHour - SCHOOL_DAY_START_HOUR) / windowHours) * windowHours +
      SCHOOL_DAY_START_HOUR;
    if (start < SCHOOL_DAY_START_HOUR || start >= SCHOOL_DAY_END_HOUR) continue;
    if (!windows.has(start)) windows.set(start, []);
    windows.get(start).push(conversation);
  }
  return windows;
}

function buildReport({ generatedAt, checkedAt, conversations, windows, evaluation }) {
  const callbackMoment =
    evaluation.callbacks[0]?.callbackText ?? '尚未找到 rolling two-hour callback。';
  const lines = [
    '# GIIS Underworld Rolling 2-Hour Continuity Report',
    '',
    `Generated: ${generatedAt}`,
    `Target date: ${TARGET_DATE}`,
    `Timezone: ${TIME_ZONE}`,
    `Window size hours: ${WINDOW_HOURS}`,
    '',
    '## Summary',
    '',
    `- Status: ${evaluation.status.label}`,
    `- Decision: ${evaluation.status.decision}`,
    `- Reason: ${evaluation.status.reason}`,
    `- Source window: ${evaluation.sourceLabel}`,
    `- Callback window: ${evaluation.callbackLabel}`,
    `- Source sample count: ${evaluation.source.length}`,
    `- Callback sample count: ${evaluation.callback.length}`,
    `- Source residue candidates: ${evaluation.residueCandidates.length}`,
    `- Rolling callbacks found: ${evaluation.callbacks.length}`,
    `- Best continuity moment: ${callbackMoment}`,
    `- Convex checkedAt: ${checkedAt ? new Date(checkedAt).toISOString() : 'unknown'}`,
    `- Today conversations seen in query: ${conversations.length}`,
    '',
    '## Window Counts',
    '',
    ...[...windows.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([start, items]) => `- ${labelWindow(start, WINDOW_HOURS)}: ${items.length}`),
    '',
    '## Source Residue Candidates',
    '',
    ...formatCandidates(evaluation.residueCandidates),
    '',
    '## Rolling Callbacks Found',
    '',
    ...formatCallbacks(evaluation.callbacks),
    '',
    '## Policy',
    '',
    '- Observe-only report. This script did not trigger conversations or write to Convex.',
    '- Rolling continuity is the v0.1 recent-memory gate: adjacent two-hour windows should show concrete residue -> callback.',
    '- Legacy AM -> PM remains useful day-arc evidence, but should not be the only hard completion gate.',
    '- Generic prop reuse alone does not count as strong continuity.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function formatCandidates(candidates) {
  if (candidates.length === 0) return ['No source residue candidates found.'];
  return candidates.slice(0, 12).map((item) => {
    return `- ${item.conversation.id} · ${item.kind} · ${item.speaker}: "${truncate(item.text, 130)}" [cues: ${item.cues.join('、')}]`;
  });
}

function formatCallbacks(callbacks) {
  if (callbacks.length === 0) return ['No rolling callbacks found.'];
  return callbacks.slice(0, 8).map((item) => {
    return `- ${item.callbackConversation} (${item.strength}) ← ${item.sourceConversation}: ${item.reason}; cues=${item.cues.join('、') || 'none'}; "${truncate(item.callbackText, 140)}"`;
  });
}

function cuesFor(text) {
  const found = [];
  for (const cue of CONCRETE_CUES) {
    if (String(text ?? '').includes(cue)) found.push(cue);
  }
  return [...new Set(found)];
}

function conversationText(conversation) {
  return [
    ...(conversation.transcriptMessages ?? []).map((message) => message.text),
    ...(conversation.memoryTraces ?? []).flatMap((trace) => [trace.memoryLineZh, trace.residueLineZh].filter(Boolean)),
  ].join('\n');
}

function bestSnippet(conversation, sourceCues) {
  const messages = conversation.transcriptMessages ?? [];
  const scored = messages
    .map((message) => ({
      text: message.text,
      score:
        sourceCues.filter((cue) => message.text.includes(cue)).length * 2 +
        (TEMPORAL_RE.test(message.text) ? 2 : 0) +
        (BEHAVIOR_CHANGE_RE.test(message.text) ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.text ?? conversationText(conversation).slice(0, 180);
}

function withLocalTime(conversation, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(conversation.createdAt))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    ...conversation,
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    localHour: Number(parts.hour),
    localMinute: Number(parts.minute),
  };
}

function labelWindow(start, windowHours) {
  return `${String(start).padStart(2, '0')}:00-${String(start + windowHours).padStart(2, '0')}:00`;
}

function statusScore(status) {
  if (status.label === 'PASS') return 1000;
  if (status.decision === 'weak_continuity') return 100;
  if (status.decision === 'sample_pending') return 10;
  return 0;
}

async function convexRun(functionName, payload) {
  const { stdout } = await execFileAsync(
    'npx',
    ['convex', 'run', '--typecheck', 'disable', '--codegen', 'disable', functionName, JSON.stringify(payload)],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
          process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180',
      },
      maxBuffer: 1024 * 1024 * 12,
      timeout: 180_000,
    },
  );
  return parseJsonFromStdout(stdout);
}

function parseJsonFromStdout(stdout) {
  const first = stdout.indexOf('{');
  const last = stdout.lastIndexOf('}');
  if (first < 0 || last < first) return undefined;
  return JSON.parse(stdout.slice(first, last + 1));
}

function dateKeyFor(timestamp, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseArgs(values) {
  return new Map(
    values
      .filter((value) => value.startsWith('--'))
      .map((value) => {
        const equals = value.indexOf('=');
        if (equals === -1) return [value.slice(2), 'true'];
        return [value.slice(2, equals), value.slice(equals + 1)];
      }),
  );
}

function numberArg(name, fallback, min, max) {
  const raw = args.get(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function truncate(text, max) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function fixtureConversation(id, localHour, involvedCharacters, transcriptMessages, memoryTraces = []) {
  return { id, localDate: '2026-06-04', localHour, involvedCharacters, transcriptMessages, memoryTraces };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runSelfTest() {
  const source = [
    fixtureConversation(
      'conversation-source-1',
      10,
      ['海', '真晝'],
      [
        { author: '海', text: '我先把通知關掉，我們安靜坐十分鐘。' },
        { author: '真晝', text: '那半個便當先別動。' },
      ],
      [{ characterName: '海', residueLineZh: '海還記得真晝沒有催她繼續有用。 觸發：通知。' }],
    ),
    fixtureConversation('conversation-source-2', 10, ['曹操', '天澤'], [
      { author: '曹操', text: '那個空椅子先留著，別急著把人塞回格子。' },
    ]),
  ];
  const callback = [
    fixtureConversation('conversation-callback-1', 12, ['海', '真晝'], [
      { author: '海', text: '剛才那個通知我已經關掉了，等下課鈴響再把沒說完的話接起來。' },
    ]),
    fixtureConversation('conversation-callback-2', 12, ['曹操', '天澤'], [
      { author: '天澤', text: '下次再問空椅子的規則吧，現在先別把大家塞進格子。' },
    ]),
  ];
  const windows = buildWindows([...source, ...callback], 2);
  const evaluation = evaluateBestAdjacentPair(windows, 2);
  assert(evaluation.status.label === 'PASS', 'strong rolling callback should pass');
  assert(evaluation.callbacks.length >= 1, 'expected rolling callback');

  const weakWindows = buildWindows(
    [
      fixtureConversation('conversation-source-3', 8, ['海', '真晝'], [
        { author: '海', text: '手有點累，喝茶。' },
      ]),
      fixtureConversation('conversation-callback-3', 10, ['海', '真晝'], [
        { author: '真晝', text: '你的手旁邊有茶。' },
      ]),
    ],
    2,
  );
  const weak = evaluateBestAdjacentPair(weakWindows, 2);
  assert(weak.status.label !== 'PASS', 'generic prop reuse should not pass');
  console.log('[rolling-continuity:self-test] PASS');
}

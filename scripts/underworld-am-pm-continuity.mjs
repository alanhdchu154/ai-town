#!/usr/bin/env node
// GIIS Underworld AM -> PM continuity observer.
//
// Read-only against Convex: this script reads archived conversations, buckets
// them by same-day morning/afternoon windows, and writes a local markdown report.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'am-pm-continuity-latest.md');

const args = parseArgs(process.argv.slice(2));
const TIME_ZONE = args.get('time-zone') ?? 'America/Chicago';
const TARGET_DATE = args.get('date') ?? dateKeyFor(Date.now(), TIME_ZONE);
const LIMIT = numberArg('limit', 50, 1, 50);
const MESSAGES_PER_CONVERSATION = numberArg('messages-per-conversation', 12, 1, 12);

const PRIMARY_NAMES = new Set(['海', '真晝', '明日奈', 'Umi', 'Mahiru Shiina', 'Asuna']);
const SECONDARY_NAMES = new Set(['曹操', '麻衣', '劉備', 'CaoCao', 'Mai', 'Liu Bei']);

const CONCRETE_CUES = [
  'Alan',
  '校長',
  '簡報',
  '清單',
  '責任',
  '負責',
  '交接',
  '任務',
  '休息',
  '吃飯',
  '午餐',
  '杯',
  '手',
  '肩',
  '筆',
  '筆電',
  '安靜',
  '沉默',
  '門口',
  '座位',
  '窗',
  '宿舍',
  '餐廳',
  '校長室',
  '教室',
  '庭院',
  '沒說完',
  '沒進來',
  '太快',
  '太工整',
  '一個人',
  '被落下',
  '幫忙',
  '作弊',
  '作業',
  '小考',
  '告白',
  '秘密',
  '疲',
  '累',
  '硬撐',
  '擔心',
  '看見',
  '照顧',
  '靠近',
  '離開',
];

const TEMPORAL_CALLBACK_CUES = [
  '早上',
  '上午',
  '剛才',
  '剛剛',
  '今天',
  '那句',
  '那件',
  '還記得',
  '後來',
  '中午',
  '下午',
  '上次',
];

async function main() {
  console.log(`[am-pm-continuity] observe-only; target=${TARGET_DATE} ${TIME_ZONE}`);
  const evalData = await convexRun('school:recentConversationEvalData', {
    timeZone: TIME_ZONE,
    limit: LIMIT,
    compact: false,
    messagesPerConversation: MESSAGES_PER_CONVERSATION,
  });
  const conversations = Array.isArray(evalData?.conversations) ? evalData.conversations : [];
  const today = conversations
    .map((conversation) => withLocalTime(conversation, TIME_ZONE))
    .filter((conversation) => conversation.localDate === TARGET_DATE);
  const morning = today.filter((conversation) => conversation.bucket === 'morning');
  const afternoon = today.filter((conversation) => conversation.bucket === 'afternoon');

  const amResidueCandidates = extractAmResidueCandidates(morning);
  const pmCallbacks = findPmCallbacks(amResidueCandidates, afternoon);
  const failures = buildFailures(amResidueCandidates, pmCallbacks, morning, afternoon);
  const status = decideStatus({ morning, afternoon, amResidueCandidates, pmCallbacks });
  const bestContinuityMoment = bestMoment(pmCallbacks);

  await writeReport({
    evalData,
    conversations,
    today,
    morning,
    afternoon,
    amResidueCandidates,
    pmCallbacks,
    failures,
    status,
    bestContinuityMoment,
  });

  console.log(`[am-pm-continuity] morning=${morning.length} afternoon=${afternoon.length}`);
  console.log(`[am-pm-continuity] status=${status.label} decision=${status.decision}`);
  console.log(`[am-pm-continuity] report=${relative(REPORT_PATH)}`);
}

function extractAmResidueCandidates(morning) {
  const candidates = [];
  const seen = new Set();
  for (const conversation of morning) {
    for (const trace of conversation.memoryTraces ?? []) {
      for (const [field, source] of [
        ['residueLineZh', 'memory_trace_residue'],
        ['memoryLineZh', 'memory_trace'],
      ]) {
        const line = cleanLine(trace?.[field]);
        if (!line) continue;
        const cues = extractCues(line, conversation);
        if (!cues.length) continue;
        pushCandidate({
          candidates,
          seen,
          conversation,
          characterName: trace.characterName,
          line,
          cues,
          source,
        });
      }
    }

    for (const message of conversation.transcriptMessages ?? []) {
      const line = cleanLine(message.text);
      if (!line) continue;
      const cues = extractCues(line, conversation);
      if (cues.length < 2) continue;
      if (!hasSoulOrLifeSignal(line, conversation)) continue;
      pushCandidate({
        candidates,
        seen,
        conversation,
        characterName: message.author,
        line,
        cues,
        source: 'transcript_concrete',
      });
    }
  }

  return candidates.slice(0, 18);
}

function pushCandidate({ candidates, seen, conversation, characterName, line, cues, source }) {
  const key = `${conversation.id}:${characterName}:${normalize(line).slice(0, 80)}`;
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push({
    conversationId: conversation.id,
    timeLabel: conversation.timestampLabelZh ?? localTimeLabel(conversation.createdAt, TIME_ZONE),
    participants: conversation.involvedCharacters ?? [],
    characterName,
    line: trim(line, 140),
    cues,
    source,
    primaryScope: hasPrimaryParticipant(conversation),
  });
}

function findPmCallbacks(amResidueCandidates, afternoon) {
  const callbacks = [];
  for (const candidate of amResidueCandidates) {
    const candidateParticipants = new Set(candidate.participants);
    const meaningfulCandidateCues = candidate.cues.filter((cue) => !isCharacterNameCue(cue));
    for (const conversation of afternoon) {
      const transcriptText = transcriptFor(conversation);
      const traceText = (conversation.memoryTraces ?? [])
        .flatMap((trace) => [trace.residueLineZh, trace.memoryLineZh])
        .filter(Boolean)
        .join('\n');
      const combinedText = `${transcriptText}\n${traceText}`;
      const sharedParticipants = (conversation.involvedCharacters ?? []).filter((name) =>
        candidateParticipants.has(name),
      );
      const matchedCues = meaningfulCandidateCues.filter((cue) => combinedText.includes(cue));
      const temporal = TEMPORAL_CALLBACK_CUES.filter((cue) => combinedText.includes(cue));
      const hasTraceCallback = matchedCues.some((cue) => traceText.includes(cue));
      const relationshipMatch = sharedParticipants.length > 0;
      if (!relationshipMatch && matchedCues.length < 2) continue;
      if (!matchedCues.length) continue;

      const strength = hasTraceCallback || temporal.length || matchedCues.length >= 2 ? 'strong' : 'weak';
      callbacks.push({
        strength,
        amConversationId: candidate.conversationId,
        pmConversationId: conversation.id,
        pmTimeLabel: conversation.timestampLabelZh ?? localTimeLabel(conversation.createdAt, TIME_ZONE),
        participants: conversation.involvedCharacters ?? [],
        sharedParticipants,
        matchedCues,
        temporalCues: temporal,
        amLine: candidate.line,
        pmLine: bestPmLine(conversation, matchedCues),
        source: hasTraceCallback ? 'pm_memory_trace' : 'pm_transcript',
        primaryScope: candidate.primaryScope || hasPrimaryParticipant(conversation),
      });
    }
  }

  return dedupeCallbacks(callbacks)
    .sort((a, b) => callbackScore(b) - callbackScore(a))
    .slice(0, 12);
}

function dedupeCallbacks(callbacks) {
  const seen = new Set();
  const deduped = [];
  for (const callback of callbacks) {
    const key = `${callback.amConversationId}:${callback.pmConversationId}:${callback.matchedCues.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(callback);
  }
  return deduped;
}

function callbackScore(callback) {
  return (
    (callback.strength === 'strong' ? 5 : 2) +
    callback.matchedCues.length +
    callback.temporalCues.length +
    (callback.primaryScope ? 2 : 0) +
    (callback.source === 'pm_memory_trace' ? 2 : 0)
  );
}

function decideStatus({ morning, afternoon, amResidueCandidates, pmCallbacks }) {
  if (morning.length === 0) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'sample_pending',
      reason: 'No morning archived conversations in the target window.',
      nextAction: 'Keep the world running during the morning window; do not repair prompts.',
    };
  }
  if (afternoon.length < 3) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'sample_pending',
      reason: 'Afternoon sample count is below 3.',
      nextAction: 'Wait until the afternoon window has at least 3 archived samples.',
    };
  }
  if (amResidueCandidates.length === 0) {
    return {
      label: 'FAIL',
      passWarnFail: '0 / 0 / 1',
      decision: 'observe_failure',
      reason: 'Morning conversations had no residue or concrete continuity candidates.',
      nextAction: 'Do not add a big system; inspect residue gate and transcript quality first.',
    };
  }
  if (pmCallbacks.some((callback) => callback.strength === 'strong')) {
    return {
      label: 'PASS',
      passWarnFail: '1 / 0 / 0',
      decision: 'continuity_observed',
      reason: 'At least one afternoon callback strongly connects to a morning residue/cue.',
      nextAction: 'Archive the best moment if it feels human; continue natural observation.',
    };
  }
  if (pmCallbacks.length > 0) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'weak_continuity',
      reason: 'Afternoon references share cues, but the callback is weak or generic.',
      nextAction: 'Collect more samples before changing prompt or memory behavior.',
    };
  }
  return {
    label: 'FAIL',
    passWarnFail: '0 / 0 / 1',
    decision: 'no_pm_callback',
    reason: 'Afternoon conversations did not call back to morning residue/cues.',
    nextAction: 'If this repeats with enough samples, create a proposal before changing memory architecture.',
  };
}

function buildFailures(amResidueCandidates, pmCallbacks, morning, afternoon) {
  if (!morning.length) {
    return ['No morning archived conversations were available for the target window.'];
  }
  if (afternoon.length < 3) {
    return [`Afternoon sample count is ${afternoon.length}; threshold is 3, so this is sample_pending.`];
  }
  if (!amResidueCandidates.length) {
    return ['Morning conversations existed, but no memoryTraces or concrete residue candidates were found.'];
  }

  const callbackKeys = new Set(pmCallbacks.map((callback) => callback.amConversationId));
  const missing = amResidueCandidates
    .filter((candidate) => !callbackKeys.has(candidate.conversationId))
    .slice(0, 3)
    .map((candidate) => `${candidate.conversationId}: "${candidate.line}" did not return in PM.`);
  return missing.length ? missing : ['No clear failure among top AM residue candidates.'];
}

function bestMoment(pmCallbacks) {
  const best = pmCallbacks[0];
  if (!best) return '尚未找到 afternoon callback。';
  return `${best.pmConversationId} (${best.strength}) matched ${best.matchedCues.join('、')}: "${best.pmLine}"`;
}

async function writeReport(data) {
  const {
    evalData,
    conversations,
    today,
    morning,
    afternoon,
    amResidueCandidates,
    pmCallbacks,
    failures,
    status,
    bestContinuityMoment,
  } = data;
  const capWarning =
    conversations.length >= LIMIT
      ? `\n- Data cap warning: query returned the max ${LIMIT} conversations; older morning items may be missing.`
      : '';
  const report = [
    '# GIIS Underworld AM -> PM Continuity Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Target date: ${TARGET_DATE}`,
    `Timezone: ${TIME_ZONE}`,
    `Windows: morning 06:00-11:59, afternoon 13:00-16:59`,
    '',
    '## Summary',
    '',
    `- Status: ${status.label}`,
    `- PASS/WARN/FAIL: ${status.passWarnFail}`,
    `- Decision: ${status.decision}`,
    `- Reason: ${status.reason}`,
    `- Morning sample count: ${morning.length}`,
    `- Afternoon sample count: ${afternoon.length}`,
    `- AM residue candidates: ${amResidueCandidates.length}`,
    `- PM callbacks found: ${pmCallbacks.length}`,
    `- Best continuity moment: ${bestContinuityMoment}`,
    `- Next safest action: ${status.nextAction}`,
    `- Convex checkedAt: ${evalData?.checkedAt ? new Date(evalData.checkedAt).toISOString() : 'unknown'}`,
    `- Today conversations seen in query: ${today.length}`,
    capWarning.trim(),
    '',
    '## AM Residue Candidates',
    '',
    listOrNone(
      amResidueCandidates.map((candidate) => {
        const scope = candidate.primaryScope ? 'primary' : 'secondary';
        return `- ${candidate.conversationId} · ${candidate.timeLabel} · ${scope} · ${candidate.source} · ${candidate.characterName}: "${candidate.line}" [cues: ${candidate.cues.join('、')}]`;
      }),
      'No AM residue candidates found.',
    ),
    '',
    '## PM Callbacks Found',
    '',
    listOrNone(
      pmCallbacks.map((callback) => {
        const temporal = callback.temporalCues.length
          ? `; temporal: ${callback.temporalCues.join('、')}`
          : '';
        return `- ${callback.pmConversationId} · ${callback.pmTimeLabel} · ${callback.strength} · ${callback.source}: matched ${callback.matchedCues.join('、')}${temporal}\n  - AM: "${callback.amLine}"\n  - PM: "${callback.pmLine}"`;
      }),
      'No PM callbacks found.',
    ),
    '',
    '## Worst 3 Failures',
    '',
    listOrNone(failures.slice(0, 3).map((failure) => `- ${failure}`), 'No failures to list.'),
    '',
    '## Morning Transcript Snippets',
    '',
    transcriptSection(morning),
    '',
    '## Afternoon Transcript Snippets',
    '',
    transcriptSection(afternoon),
    '',
    '## Policy',
    '',
    '- Observe-only report. This script did not trigger conversations or write to Convex.',
    '- If afternoon samples are fewer than 3, do not repair prompt or runtime behavior.',
    '- Large continuity or memory changes remain proposal-only.',
    '',
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, report);
}

function transcriptSection(conversations) {
  if (!conversations.length) return 'No conversations in this bucket.';
  return conversations
    .slice(0, 8)
    .map((conversation) => {
      const lines = (conversation.transcriptMessages ?? [])
        .slice(0, 12)
        .map((message) => `- **${message.author}**: ${trim(message.text, 180)}`)
        .join('\n');
      const traces = (conversation.memoryTraces ?? [])
        .flatMap((trace) => [
          trace.residueLineZh ? `  - ${trace.characterName} residue: ${trace.residueLineZh}` : undefined,
          trace.memoryLineZh ? `  - ${trace.characterName} memory: ${trace.memoryLineZh}` : undefined,
        ])
        .filter(Boolean)
        .join('\n');
      return [
        `### ${conversation.id} · ${conversation.timestampLabelZh ?? localTimeLabel(conversation.createdAt, TIME_ZONE)}`,
        '',
        `Participants: ${(conversation.involvedCharacters ?? []).join('、') || 'unknown'}`,
        '',
        lines || 'No transcript lines.',
        traces ? `\nMemory traces:\n${traces}` : '',
      ].join('\n');
    })
    .join('\n\n');
}

function withLocalTime(conversation, timeZone) {
  const parts = localParts(conversation.createdAt, timeZone);
  const hour = Number(parts.hour);
  let bucket = 'other';
  if (hour >= 6 && hour < 12) bucket = 'morning';
  if (hour >= 13 && hour < 17) bucket = 'afternoon';
  return {
    ...conversation,
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    localHour: hour,
    bucket,
  };
}

function extractCues(text, conversation) {
  const cues = new Set();
  for (const cue of CONCRETE_CUES) {
    if (text.includes(cue)) cues.add(cue);
  }
  for (const name of conversation.involvedCharacters ?? []) {
    if (text.includes(name)) cues.add(name);
  }
  return [...cues].slice(0, 8);
}

function hasSoulOrLifeSignal(text, conversation) {
  const participants = new Set(conversation.involvedCharacters ?? []);
  const primary = [...participants].some((name) => PRIMARY_NAMES.has(name));
  const secondary = [...participants].some((name) => SECONDARY_NAMES.has(name));
  const lifeSignal = /休息|吃飯|午餐|手|肩|杯|窗|門口|座位|宿舍|餐廳|教室|庭院|校長室|清單|簡報|任務|責任|交接|硬撐|安靜|沒說完|看見|照顧/.test(
    text,
  );
  const relationSignal = /Alan|海|真晝|明日奈|曹操|麻衣|劉備|你|我們/.test(text);
  return (primary || secondary) && lifeSignal && relationSignal;
}

function bestPmLine(conversation, matchedCues) {
  const messages = conversation.transcriptMessages ?? [];
  const scored = messages
    .map((message) => ({
      message,
      score: matchedCues.filter((cue) => message.text.includes(cue)).length,
    }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.message ?? messages.at(-1);
  if (!best) return '';
  return `${best.author}: ${trim(best.text, 180)}`;
}

function transcriptFor(conversation) {
  return (conversation.transcriptMessages ?? [])
    .map((message) => `${message.author}: ${message.text}`)
    .join('\n');
}

function hasPrimaryParticipant(conversation) {
  return (conversation.involvedCharacters ?? []).some((name) => PRIMARY_NAMES.has(name));
}

function isCharacterNameCue(cue) {
  return PRIMARY_NAMES.has(cue) || SECONDARY_NAMES.has(cue);
}

async function convexRun(functionName, payload) {
  const result = await execFileAsync(
    'npx',
    [
      'convex',
      'run',
      '--typecheck',
      'disable',
      '--codegen',
      'disable',
      functionName,
      JSON.stringify(payload),
    ],
    { cwd: REPO_ROOT, timeout: 60_000, maxBuffer: 1024 * 1024 * 8 },
  );
  return parseJsonFromStdout(result.stdout);
}

function parseJsonFromStdout(stdout) {
  const candidates = [];
  for (let start = 0; start < stdout.length; start += 1) {
    if (stdout[start] !== '{' && stdout[start] !== '[') continue;
    const candidate = balancedJsonSlice(stdout, start);
    if (candidate) candidates.push(candidate);
  }
  for (const candidate of candidates.sort((a, b) => b.length - a.length)) {
    try {
      return JSON.parse(candidate);
    } catch {
      // keep scanning
    }
  }
  return undefined;
}

function balancedJsonSlice(text, start) {
  const opener = text[start];
  const stack = [opener === '{' ? '}' : ']'];
  let inString = false;
  let escaped = false;
  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') stack.push('}');
    if (char === '[') stack.push(']');
    if (char === stack.at(-1)) {
      stack.pop();
      if (!stack.length) return text.slice(start, index + 1);
    }
  }
  return undefined;
}

function dateKeyFor(timestamp, timeZone) {
  const parts = localParts(timestamp, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localParts(timestamp, timeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(timestamp))
      .map((part) => [part.type, part.value]),
  );
}

function localTimeLabel(timestamp, timeZone) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function listOrNone(lines, fallback) {
  return lines.length ? lines.join('\n') : fallback;
}

function cleanLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return cleanLine(value).toLowerCase();
}

function trim(value, maxLength) {
  const text = cleanLine(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function relative(path) {
  return path.startsWith(`${REPO_ROOT}/`) ? path.slice(REPO_ROOT.length + 1) : path;
}

function parseArgs(argv) {
  return new Map(
    argv
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
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

main().catch((error) => {
  console.error('[am-pm-continuity] failed');
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});

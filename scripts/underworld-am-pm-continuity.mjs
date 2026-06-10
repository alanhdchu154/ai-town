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
const LIMIT = numberArg('limit', 120, 1, 200);
const MESSAGES_PER_CONVERSATION = numberArg('messages-per-conversation', 12, 1, 12);
const SELF_TEST = args.get('self-test') === 'true';
const MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES = 12;

const PRIMARY_NAMES = new Set(['海', '真晝', '天澤', '天澤', 'Umi', 'Mahiru', 'Tianze']);
const SECONDARY_NAMES = new Set(['曹操', '一之瀨', '一之瀨', '劉備', 'CaoCao', 'Ichinose', 'Liu Bei']);

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
  '那句',
  '那件',
  '還記得',
  '後來',
  '中午',
  '上次',
];

const EXPLICIT_MORNING_CALLBACK_RE =
  /今天早上|今天上午|中午前|早些時候|早一點|你早上|你上午|早上你|上午你|還記得早上|還記得上午/;

const BEHAVIOR_CHANGE_RE =
  /先別|先不要|不要再|不再|少接|少說|少整理|少開|放下|合上|停一下|坐一下|坐兩分鐘|休息一下|留到明天|交給我|換我|分掉|交接|不催|陪你|我陪|晚點再|明天再|先放著|先不/;

const GENERIC_CUES = new Set([
  'Alan',
  '校長',
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
  '窗',
  '累',
  '疲',
  '擔心',
  '看見',
  '照顧',
  '幫忙',
  '靠近',
  '離開',
]);

const HIGH_SIGNAL_CUES = new Set([
  '簡報',
  '清單',
  '責任',
  '負責',
  '交接',
  '任務',
  '硬撐',
  '沒說完',
  '沒進來',
  '太快',
  '太工整',
  '一個人',
  '被落下',
  '作弊',
  '作業',
  '小考',
  '告白',
  '秘密',
]);

async function main() {
  if (SELF_TEST) {
    runSelfTest();
    return;
  }
  console.log(`[am-pm-continuity] observe-only; target=${TARGET_DATE} ${TIME_ZONE}`);
  const morningWindow = localWindow(TARGET_DATE, 6, 12, TIME_ZONE);
  const afternoonWindow = localWindow(TARGET_DATE, 13, 17, TIME_ZONE);
  const morningData = await convexRun('school:recentConversationEvalData', {
    timeZone: TIME_ZONE,
    limit: LIMIT,
    startAt: morningWindow.startAt,
    endAt: morningWindow.endAt,
    compact: false,
    messagesPerConversation: MESSAGES_PER_CONVERSATION,
  });
  const afternoonData = await convexRun('school:recentConversationEvalData', {
    timeZone: TIME_ZONE,
    limit: LIMIT,
    startAt: afternoonWindow.startAt,
    endAt: afternoonWindow.endAt,
    compact: false,
    messagesPerConversation: MESSAGES_PER_CONVERSATION,
  });
  const morning = (Array.isArray(morningData?.conversations) ? morningData.conversations : [])
    .map((conversation) => withLocalTime(conversation, TIME_ZONE))
    .filter((conversation) => conversation.localDate === TARGET_DATE && conversation.bucket === 'morning');
  const afternoon = (Array.isArray(afternoonData?.conversations) ? afternoonData.conversations : [])
    .map((conversation) => withLocalTime(conversation, TIME_ZONE))
    .filter((conversation) => conversation.localDate === TARGET_DATE && conversation.bucket === 'afternoon');
  const conversations = dedupeConversations([...morning, ...afternoon]);
  const today = conversations;

  const amResidueCandidates = extractAmResidueCandidates(morning);
  const pmCallbacks = findPmCallbacks(amResidueCandidates, afternoon);
  const failures = buildFailures(amResidueCandidates, pmCallbacks, morning, afternoon);
  const status = decideStatus({ morning, afternoon, amResidueCandidates, pmCallbacks });
  const bestContinuityMoment = bestMoment(pmCallbacks);

  await writeReport({
    evalData: {
      checkedAt: Math.max(morningData?.checkedAt ?? 0, afternoonData?.checkedAt ?? 0),
      morningCheckedAt: morningData?.checkedAt,
      afternoonCheckedAt: afternoonData?.checkedAt,
      rangeMode: true,
      morningWindow,
      afternoonWindow,
    },
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

function runSelfTest() {
  const morning = [
    fixtureConversation('conversation-am-1', '2026-05-27T15:00:00.000Z', ['真晝', '海'], [
      ['真晝', '海，你早上一直在整理 Alan 的簡報，可是你自己有吃飯嗎？'],
      ['海', '我先少說一點。'],
    ]),
  ];
  const afternoon = [
    fixtureConversation('conversation-pm-1', '2026-05-27T19:00:00.000Z', ['真晝', '海'], [
      ['真晝', '早上你整理 Alan 簡報時說你先少說一點，我下午還是想問，你午餐有吃嗎？'],
      ['海', '有。今天不用再替 Alan 加東西了。'],
    ]),
    fixtureConversation('conversation-pm-2', '2026-05-27T19:10:00.000Z', ['天澤', '海'], [
      ['天澤', '簡報那件事先交接，不要再把責任都放在你手上。'],
      ['海', '好，交接。'],
    ]),
    fixtureConversation('conversation-pm-3', '2026-05-27T19:20:00.000Z', ['真晝', '天澤'], [
      ['真晝', '下午餐廳比較安靜。'],
      ['天澤', '這條規則先別推了。'],
    ]),
    fixtureConversation('conversation-pm-4', '2026-05-27T19:30:00.000Z', ['曹操', '劉備'], [
      ['曹操', '庭院那張椅子先不要動。'],
      ['劉備', '我去看看誰自己吃飯。'],
    ]),
    fixtureConversation('conversation-pm-5', '2026-05-27T19:40:00.000Z', ['一之瀨', '曹操'], [
      ['一之瀨', '你又把問題說得太工整。'],
      ['曹操', '規矩先放著。'],
    ]),
    fixtureConversation('conversation-pm-6', '2026-05-27T19:50:00.000Z', ['劉備', '一之瀨'], [
      ['劉備', '我先去餐廳。'],
      ['一之瀨', '別繞了。'],
    ]),
    fixtureConversation('conversation-pm-7', '2026-05-27T20:00:00.000Z', ['真晝', '劉備'], [
      ['真晝', '下午餐廳比較安靜。'],
      ['劉備', '我先去看看座位。'],
    ]),
    fixtureConversation('conversation-pm-8', '2026-05-27T20:10:00.000Z', ['曹操', '真晝'], [
      ['曹操', '庭院那邊先不要公開問。'],
      ['真晝', '嗯，慢一點。'],
    ]),
    fixtureConversation('conversation-pm-9', '2026-05-27T20:20:00.000Z', ['海', '曹操'], [
      ['海', '下午先別整理成報告。'],
      ['曹操', '我只看門口。'],
    ]),
    fixtureConversation('conversation-pm-10', '2026-05-27T20:30:00.000Z', ['真晝', '海'], [
      ['真晝', '先坐一下。'],
      ['海', '好。'],
    ]),
    fixtureConversation('conversation-pm-11', '2026-05-27T20:40:00.000Z', ['天澤', '曹操'], [
      ['天澤', '這條規則先別碰。'],
      ['曹操', '我知道。'],
    ]),
    fixtureConversation('conversation-pm-12', '2026-05-27T20:50:00.000Z', ['一之瀨', '劉備'], [
      ['一之瀨', '那份善意先記著。'],
      ['劉備', '我先留座位。'],
    ]),
  ];
  const candidates = extractAmResidueCandidates(morning);
  const callbacks = findPmCallbacks(candidates, afternoon);
  const passStatus = decideStatus({ morning, afternoon, amResidueCandidates: candidates, pmCallbacks: callbacks });
  assert(candidates.length > 0, 'extracts AM residue candidates');
  assert(callbacks.some((callback) => callback.strength === 'strong'), 'detects strong PM callback');
  assertEqual(passStatus.decision, 'continuity_observed', 'strong callback passes continuity');

  const genericMotifCallbacks = findPmCallbacks(candidates, [
    fixtureConversation('conversation-pm-generic-1', '2026-05-27T19:00:00.000Z', ['真晝', '海'], [
      ['真晝', '今天 Alan 看起來也需要休息。'],
      ['海', '嗯，手邊的東西晚點再說。'],
    ]),
    fixtureConversation('conversation-pm-generic-2', '2026-05-27T19:10:00.000Z', ['真晝', '海'], [
      ['海', '午餐吃了，簡報也還在。'],
      ['真晝', '那就好。'],
    ]),
    fixtureConversation('conversation-pm-generic-3', '2026-05-27T19:20:00.000Z', ['天澤', '海'], [
      ['天澤', '今天下午不要再推那條規則。'],
      ['海', '好。'],
    ]),
  ]);
  assert(
    !genericMotifCallbacks.some((callback) => callback.strength === 'strong'),
    'generic recurring motifs do not become strong continuity',
  );

  const pendingStatus = decideStatus({
    morning,
    afternoon: afternoon.slice(0, MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES - 1),
    amResidueCandidates: candidates,
    pmCallbacks: [],
  });
  assertEqual(pendingStatus.decision, 'sample_pending', 'afternoon count below threshold stays sample_pending');

  const noCallbackStatus = decideStatus({
    morning,
    afternoon: [
      fixtureConversation('conversation-pm-4', '2026-05-27T19:30:00.000Z', ['曹操', '劉備'], [
        ['曹操', '今天庭院的座位先不要動。'],
        ['劉備', '我去看看誰自己吃飯。'],
      ]),
      fixtureConversation('conversation-pm-5', '2026-05-27T19:40:00.000Z', ['曹操', '一之瀨'], [
        ['一之瀨', '你又把問題說得太工整。'],
        ['曹操', '規矩先放著。'],
      ]),
      fixtureConversation('conversation-pm-6b', '2026-05-27T19:50:00.000Z', ['劉備', '一之瀨'], [
        ['劉備', '我先去餐廳。'],
        ['一之瀨', '別繞了。'],
      ]),
      fixtureConversation('conversation-pm-7b', '2026-05-27T20:00:00.000Z', ['真晝', '劉備'], [
        ['真晝', '下午餐廳比較安靜。'],
        ['劉備', '我先去看看座位。'],
      ]),
      fixtureConversation('conversation-pm-8b', '2026-05-27T20:10:00.000Z', ['曹操', '真晝'], [
        ['曹操', '庭院那邊先不要公開問。'],
        ['真晝', '嗯，慢一點。'],
      ]),
      fixtureConversation('conversation-pm-9b', '2026-05-27T20:20:00.000Z', ['海', '曹操'], [
        ['海', '下午先別整理成報告。'],
        ['曹操', '我只看門口。'],
      ]),
      fixtureConversation('conversation-pm-10b', '2026-05-27T20:30:00.000Z', ['真晝', '海'], [
        ['真晝', '先坐一下。'],
        ['海', '好。'],
      ]),
      fixtureConversation('conversation-pm-11b', '2026-05-27T20:40:00.000Z', ['天澤', '曹操'], [
        ['天澤', '這條規則先別碰。'],
        ['曹操', '我知道。'],
      ]),
      fixtureConversation('conversation-pm-12b', '2026-05-27T20:50:00.000Z', ['一之瀨', '劉備'], [
        ['一之瀨', '那份善意先記著。'],
        ['劉備', '我先留座位。'],
      ]),
      fixtureConversation('conversation-pm-13b', '2026-05-27T21:00:00.000Z', ['曹操', '劉備'], [
        ['曹操', '位置先別改。'],
        ['劉備', '我去問一聲。'],
      ]),
      fixtureConversation('conversation-pm-14b', '2026-05-27T21:10:00.000Z', ['真晝', '一之瀨'], [
        ['真晝', '晚一點再說吧。'],
        ['一之瀨', '我先記著。'],
      ]),
      fixtureConversation('conversation-pm-15b', '2026-05-27T21:20:00.000Z', ['海', '劉備'], [
        ['海', '今天先到這裡。'],
        ['劉備', '好，我陪他走回去。'],
      ]),
    ],
    amResidueCandidates: candidates,
    pmCallbacks: [],
  });
  assertEqual(noCallbackStatus.decision, 'no_pm_callback', 'enough PM samples without callback fails');

  console.log('[am-pm-continuity:self-test] PASS');
}

function fixtureConversation(id, iso, participants, rows) {
  const createdAt = Date.parse(iso);
  return {
    id,
    createdAt,
    timestampLabelZh: 'self-test',
    involvedCharacters: participants,
    localDate: TARGET_DATE,
    bucket: iso.includes('T15') ? 'morning' : 'afternoon',
    transcriptMessages: rows.map(([author, text]) => ({ author, text })),
    memoryTraces: [],
  };
}

function assert(value, label) {
  if (!value) throw new Error(label);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
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
      const specificCues = matchedCues.filter((cue) => isSpecificContinuityCue(cue));
      const strongCues = matchedCues.filter((cue) => isHighSignalContinuityCue(cue));
      const hasTraceCallback = specificCues.some((cue) => traceText.includes(cue));
      const samePair = sameParticipantSet(candidate.participants, conversation.involvedCharacters ?? []);
      const relationshipMatch = sharedParticipants.length > 0;
      const explicitMorningCallback = EXPLICIT_MORNING_CALLBACK_RE.test(combinedText);
      const behaviorChange = BEHAVIOR_CHANGE_RE.test(combinedText);
      const phraseOverlap = hasConcretePhraseOverlap(candidate.line, combinedText);
      const strictEvidence = {
        samePair,
        explicitMorningCallback,
        behaviorChange,
        hasTraceCallback,
        phraseOverlap,
        specificCueCount: specificCues.length,
        highSignalCueCount: strongCues.length,
      };
      const hasStrictCallback =
        samePair &&
        (specificCues.length > 0 || phraseOverlap) &&
        ((explicitMorningCallback && (behaviorChange || hasTraceCallback || phraseOverlap)) ||
          (hasTraceCallback && (behaviorChange || phraseOverlap)));
      if (!relationshipMatch && matchedCues.length < 2) continue;
      if (!matchedCues.length) continue;
      if (!hasStrictCallback && specificCues.length === 0) continue;

      const strength = hasStrictCallback ? 'strong' : 'weak';
      callbacks.push({
        strength,
        amConversationId: candidate.conversationId,
        pmConversationId: conversation.id,
        pmTimeLabel: conversation.timestampLabelZh ?? localTimeLabel(conversation.createdAt, TIME_ZONE),
        participants: conversation.involvedCharacters ?? [],
        sharedParticipants,
        matchedCues,
        specificCues,
        highSignalCues: strongCues,
        temporalCues: temporal,
        evidence: strictEvidence,
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
    callback.specificCues.length * 2 +
    callback.highSignalCues.length * 2 +
    callback.temporalCues.length +
    (callback.evidence?.explicitMorningCallback ? 3 : 0) +
    (callback.evidence?.behaviorChange ? 2 : 0) +
    (callback.evidence?.phraseOverlap ? 3 : 0) +
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
  if (afternoon.length < MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'sample_pending',
      reason: `Afternoon sample count is below ${MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES}.`,
      nextAction: `Wait until the afternoon window has at least ${MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES} archived samples before judging callbacks.`,
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
      reason: 'At least one afternoon callback explicitly reuses a specific morning residue with relationship and behavior/trace evidence.',
      nextAction: 'Archive the best moment if it feels human; continue natural observation.',
    };
  }
  if (pmCallbacks.length > 0) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'weak_continuity',
      reason: 'Afternoon references share specific cues, but not enough explicit morning/behavior/trace evidence.',
      nextAction: 'Collect more samples; if this repeats, propose a stricter memory retrieval prompt rather than broad architecture changes.',
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
  if (afternoon.length < MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES) {
    return [
      `Afternoon sample count is ${afternoon.length}; threshold is ${MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES}, so this is sample_pending.`,
    ];
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
    morning.length >= LIMIT || afternoon.length >= LIMIT
      ? `\n- Data cap warning: one time-window query returned the max ${LIMIT} conversations; increase --limit before judging continuity.`
      : '';
  const report = [
    '# GIIS Underworld AM -> PM Continuity Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Target date: ${TARGET_DATE}`,
    `Timezone: ${TIME_ZONE}`,
    `Windows: morning 06:00-11:59, afternoon 13:00-16:59`,
    `Query mode: ${evalData?.rangeMode ? 'time-window range' : 'recent'}`,
    evalData?.morningWindow
      ? `Morning UTC range: ${new Date(evalData.morningWindow.startAt).toISOString()} -> ${new Date(evalData.morningWindow.endAt).toISOString()}`
      : undefined,
    evalData?.afternoonWindow
      ? `Afternoon UTC range: ${new Date(evalData.afternoonWindow.startAt).toISOString()} -> ${new Date(evalData.afternoonWindow.endAt).toISOString()}`
      : undefined,
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
        const evidence = evidenceSummary(callback);
        return `- ${callback.pmConversationId} · ${callback.pmTimeLabel} · ${callback.strength} · ${callback.source}: matched ${callback.matchedCues.join('、')}${temporal}\n  - Evidence: ${evidence}\n  - AM: "${callback.amLine}"\n  - PM: "${callback.pmLine}"`;
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
    `- If afternoon samples are fewer than ${MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES}, do not repair prompt or runtime behavior.`,
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

function dedupeConversations(conversations) {
  const seen = new Set();
  const deduped = [];
  for (const conversation of conversations) {
    if (seen.has(conversation.id)) continue;
    seen.add(conversation.id);
    deduped.push(conversation);
  }
  return deduped.sort((a, b) => b.createdAt - a.createdAt);
}

function localWindow(dateKey, startHour, endHour, timeZone) {
  return {
    startAt: timestampForLocalDateHour(dateKey, startHour, timeZone),
    endAt: timestampForLocalDateHour(dateKey, endHour, timeZone),
  };
}

function timestampForLocalDateHour(dateKey, hour, timeZone) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  let guess = targetAsUtc;
  for (let index = 0; index < 4; index += 1) {
    const parts = localParts(guess, timeZone);
    const guessLocalAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      0,
      0,
    );
    const delta = targetAsUtc - guessLocalAsUtc;
    if (delta === 0) break;
    guess += delta;
  }
  return guess;
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

function isSpecificContinuityCue(cue) {
  return !isCharacterNameCue(cue) && !GENERIC_CUES.has(cue);
}

function isHighSignalContinuityCue(cue) {
  return HIGH_SIGNAL_CUES.has(cue);
}

function sameParticipantSet(left, right) {
  const leftNames = [...new Set(left ?? [])].filter(Boolean).sort();
  const rightNames = [...new Set(right ?? [])].filter(Boolean).sort();
  return leftNames.length > 0 && leftNames.length === rightNames.length && leftNames.every((name, index) => name === rightNames[index]);
}

function hasConcretePhraseOverlap(amLine, pmText) {
  const am = cleanLine(amLine);
  const pm = cleanLine(pmText);
  if (!am || !pm) return false;
  const fragments = new Set();
  for (const match of am.matchAll(/[一-龥A-Za-z0-9]{4,}/g)) {
    const fragment = match[0];
    if (isLowSignalFragment(fragment)) continue;
    fragments.add(fragment);
    for (let start = 0; start <= fragment.length - 4; start += 1) {
      const chunk = fragment.slice(start, start + 4);
      if (!isLowSignalFragment(chunk)) fragments.add(chunk);
    }
  }
  return [...fragments].some((fragment) => pm.includes(fragment));
}

function isLowSignalFragment(fragment) {
  return (
    fragment.length < 4 ||
    /^(今天|下午|早上|上午|中午|剛才|剛剛|我們|你們|是不是|可是|自己|一直|那個|這個|有沒有|我覺得|我先|你先)$/.test(fragment) ||
    /^(Alan|海|真晝|天澤|一之瀨|天澤|曹操|一之瀨|劉備)$/.test(fragment)
  );
}

function evidenceSummary(callback) {
  const evidence = callback.evidence ?? {};
  const checks = [
    evidence.samePair ? 'same_pair' : undefined,
    evidence.explicitMorningCallback ? 'explicit_morning_callback' : undefined,
    evidence.behaviorChange ? 'behavior_change' : undefined,
    evidence.hasTraceCallback ? 'pm_memory_trace' : undefined,
    evidence.phraseOverlap ? 'phrase_overlap' : undefined,
    evidence.specificCueCount ? `specific_cues=${evidence.specificCueCount}` : undefined,
    evidence.highSignalCueCount ? `high_signal=${evidence.highSignalCueCount}` : undefined,
  ].filter(Boolean);
  return checks.length ? checks.join(', ') : 'weak shared cue only';
}

function hasSoulOrLifeSignal(text, conversation) {
  const participants = new Set(conversation.involvedCharacters ?? []);
  const primary = [...participants].some((name) => PRIMARY_NAMES.has(name));
  const secondary = [...participants].some((name) => SECONDARY_NAMES.has(name));
  const lifeSignal = /休息|吃飯|午餐|手|肩|杯|窗|門口|座位|宿舍|餐廳|教室|庭院|校長室|清單|簡報|任務|責任|交接|硬撐|安靜|沒說完|看見|照顧/.test(
    text,
  );
  const relationSignal = /Alan|海|真晝|天澤|一之瀨|天澤|曹操|一之瀨|劉備|你|我們/.test(text);
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

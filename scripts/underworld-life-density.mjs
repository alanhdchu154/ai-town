#!/usr/bin/env node
// GIIS Underworld daily-life density observer.
//
// This is read-only against Convex. It checks that the world has several
// ordinary same-day school events and then reports whether recent dialogue has
// started to pick them up from more than one character angle.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'life-density-latest.md');

const args = parseArgs(process.argv.slice(2));
const SELF_TEST = args.get('self-test') === 'true';
const TIME_ZONE = args.get('time-zone') ?? 'America/Chicago';
const LIMIT = numberArg('limit', 80, 1, 200);

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

console.log(`[life-density] read-only; timeZone=${TIME_ZONE}`);
const [socialState, conversationData] = await Promise.all([
  convexRun('school:campusSocialState', { timeZone: TIME_ZONE }),
  convexRun('school:recentConversationEvalData', {
    timeZone: TIME_ZONE,
    limit: LIMIT,
    compact: false,
    messagesPerConversation: 12,
  }),
]);

const events = (Array.isArray(socialState?.events) ? socialState.events : []).filter(
  (event) => event.type === 'dailyLifeBulletinItem',
);
const bulletin = Array.isArray(socialState?.dailyLifeBulletin) ? socialState.dailyLifeBulletin : [];
const eventAnalyses = events.map(analyzeBulletinEvent);
const mentionAnalyses = analyzeConversationUptake(eventAnalyses, conversationData?.conversations ?? []);
const summary = summarize(eventAnalyses, mentionAnalyses);
const status = decideStatus(summary);

await writeReport({ socialState, eventAnalyses, mentionAnalyses, summary, status, bulletin });
console.log(`[life-density] ${status.overall}: ${status.reason}`);
console.log(`[life-density] report written: ${relative(REPORT_PATH)}`);
if (status.exitCode) process.exitCode = status.exitCode;

function analyzeBulletinEvent(event) {
  const text = event.descriptionZh ?? '';
  const match = text.match(/今日生活小事（(.+?)）：「(.+?)」。(.+)/);
  const periodZh = match?.[1] ?? '未知';
  const titleZh = match?.[2] ?? text.slice(0, 24);
  const keywords = [...new Set(titleZh.split(/[、，。；：：「」\s]/).filter((item) => item.length >= 2))];
  return {
    eventId: event.eventId,
    periodZh,
    titleZh,
    locationZh: event.locationZh,
    descriptionZh: text,
    futureImplicationsZh: event.futureImplicationsZh,
    keywords,
  };
}

function analyzeConversationUptake(eventAnalyses, conversations) {
  const mentions = [];
  for (const conversation of Array.isArray(conversations) ? conversations : []) {
    const messages = Array.isArray(conversation.transcriptMessages)
      ? conversation.transcriptMessages
      : Array.isArray(conversation.messages)
        ? conversation.messages
        : [];
    for (const message of messages) {
      const text = message.text ?? message.content ?? '';
      if (!text) continue;
      const author = message.authorName ?? message.name ?? message.speakerName ?? message.author ?? 'unknown';
      if (author === 'Alan' || author === 'DEFAULT_NAME') continue;
      const matched = eventAnalyses.find((event) => {
        if (event.titleZh && text.includes(event.titleZh)) return true;
        return event.keywords.some((keyword) => text.includes(keyword));
      });
      if (!matched) continue;
      mentions.push({
        conversationId: conversation.conversationId ?? conversation.id,
        author,
        titleZh: matched.titleZh,
        text: compactText(text),
      });
    }
  }
  return mentions;
}

function summarize(eventAnalyses, mentions) {
  const uniqueTitles = new Set(eventAnalyses.map((event) => event.titleZh));
  const periods = new Set(eventAnalyses.map((event) => event.periodZh));
  const locations = new Set(eventAnalyses.map((event) => event.locationZh).filter(Boolean));
  const speakers = new Set(mentions.map((mention) => mention.author));
  const mentionedTitles = new Set(mentions.map((mention) => mention.titleZh));
  return {
    eventCount: eventAnalyses.length,
    uniqueTitleCount: uniqueTitles.size,
    periodCount: periods.size,
    locationCount: locations.size,
    mentionCount: mentions.length,
    distinctSpeakerCount: speakers.size,
    mentionedTitleCount: mentionedTitles.size,
  };
}

function decideStatus(summary) {
  const densityPass =
    summary.eventCount >= 3 &&
    summary.uniqueTitleCount >= 3 &&
    summary.periodCount >= 3 &&
    summary.locationCount >= 2;
  const uptakePass =
    summary.mentionCount >= 2 &&
    summary.distinctSpeakerCount >= 2 &&
    summary.mentionedTitleCount >= 2;
  if (!densityPass) {
    return { overall: 'FAIL', reason: 'daily_life_bulletin_density_missing', exitCode: 1 };
  }
  if (!uptakePass) {
    return { overall: 'WARN', reason: 'conversation_uptake_pending', exitCode: 0 };
  }
  return { overall: 'PASS', reason: 'life_density_and_multi_angle_uptake_observed', exitCode: 0 };
}

async function writeReport({ eventAnalyses, mentionAnalyses, summary, status, bulletin }) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# GIIS Underworld Life Density',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Overall: ${status.overall}`,
    `Reason: ${status.reason}`,
    '',
    '## Summary',
    '',
    `- Daily life bulletin items: ${summary.eventCount}`,
    `- Unique titles: ${summary.uniqueTitleCount}`,
    `- Periods represented: ${summary.periodCount}`,
    `- Locations represented: ${summary.locationCount}`,
    `- Dialogue uptake mentions: ${summary.mentionCount}`,
    `- Distinct non-Alan speakers mentioning bulletin items: ${summary.distinctSpeakerCount}`,
    `- Distinct bulletin items mentioned in dialogue: ${summary.mentionedTitleCount}`,
    '',
    '## Today Life Bulletin',
    '',
    ...(bulletin.length ? bulletin.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Raw Bulletin Events',
    '',
    ...(eventAnalyses.length
      ? eventAnalyses.map(
          (event) =>
            `- ${event.periodZh} / ${event.locationZh ?? 'unknown'} / ${event.titleZh}: ${event.descriptionZh}`,
        )
      : ['- none']),
    '',
    '## Conversation Uptake',
    '',
    ...(mentionAnalyses.length
      ? mentionAnalyses.map((mention) => `- ${mention.author} -> ${mention.titleZh}: ${mention.text}`)
      : ['- uptake_pending: no recent non-Alan message clearly mentioned a bulletin item yet.']),
    '',
  ];
  await writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

async function convexRun(functionName, payload) {
  const { stdout } = await execFileAsync(
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
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
          process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180',
      },
      maxBuffer: 1024 * 1024 * 8,
      timeout: 180_000,
    },
  );
  return JSON.parse(stdout);
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
  const value = Number(args.get(name) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function compactText(text) {
  const cleaned = String(text ?? '').replace(/\s+/g, ' ').trim();
  return cleaned.length <= 120 ? cleaned : `${cleaned.slice(0, 117)}...`;
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function runSelfTest() {
  const events = [
    analyzeBulletinEvent({ descriptionZh: '今日生活小事（早晨）：「第一節前有人忘了帶筆記」。真晝把筆記本推過去。', locationZh: '教室' }),
    analyzeBulletinEvent({ descriptionZh: '今日生活小事（午餐）：「餐廳多出一個沒人坐的空位」。劉備多拿了一份湯。', locationZh: '餐廳' }),
    analyzeBulletinEvent({ descriptionZh: '今日生活小事（晚上）：「宿舍門口留了一杯溫水」。真晝沒有追問。', locationZh: '宿舍' }),
  ];
  const mentions = analyzeConversationUptake(events, [
    { conversationId: 'a', messages: [{ authorName: '真晝', text: '第一節前有人忘了帶筆記，我先借他。' }] },
    { conversationId: 'b', messages: [{ authorName: '劉備', text: '餐廳多出一個沒人坐的空位，我留著。' }] },
  ]);
  const summary = summarize(events, mentions);
  const status = decideStatus(summary);
  if (status.overall !== 'PASS') throw new Error(`expected PASS, got ${status.overall}`);
  console.log('[underworld-life-density:self-test] PASS');
}

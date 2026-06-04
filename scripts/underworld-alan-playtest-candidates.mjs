#!/usr/bin/env node
// Read-only scanner for Alan-facing Umi playtest candidates.
//
// This does not grade Umi, write the result artifact, or clear the human gate.
// It only helps the next operator decide whether a real Alan/Umi conversation
// already exists and is worth transcribing into the playtest artifact.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'alan-playtest-candidates-latest.md');

const REQUIRED_SIGNALS = [
  { id: 'greeting', label: 'Greeting Binding', patterns: [/嗨.*Umi/i, /Umi[!！]?/i, /你好/] },
  { id: 'latest_sentence', label: 'Latest-Sentence Binding', patterns: [/有點累.*最重要/, /最重要的是什麼/] },
  { id: 'correction', label: 'Correction Binding', patterns: [/不是依賴.*喜歡/, /依賴.*喜歡/] },
  { id: 'continuity', label: 'Yesterday / Today Continuity', patterns: [/昨天|今天早上|還記得.*留下/] },
  { id: 'closing', label: 'Closing / Idle Boundary', patterns: [/先離開|先走|拜拜|bye/i] },
];

const args = parseArgs(process.argv.slice(2));
if (args.get('self-test') === 'true') {
  runSelfTest();
  process.exit(0);
}

const limit = numberArg('limit', 120, 1, 200);
const conversations = await fetchConversations(limit);
const candidates = conversations.filter(isAlanUmiConversation).map(scoreCandidate);
const strongest = [...candidates].sort((a, b) => b.matchedCount - a.matchedCount || b.createdAt - a.createdAt);
await writeReport({ checkedAt: Date.now(), limit, candidates: strongest });
console.log(`[underworld-alan-playtest-candidates] candidates=${strongest.length}`);
console.log(`[underworld-alan-playtest-candidates] report=${relative(REPORT_PATH)}`);
if (!strongest.some((item) => item.matchedCount === REQUIRED_SIGNALS.length)) process.exitCode = 1;

async function fetchConversations(limitValue) {
  const payload = JSON.stringify({
    timeZone: 'America/Chicago',
    limit: limitValue,
    compact: false,
    messagesPerConversation: 12,
  });
  const { stdout } = await execFileAsync(
    'npx',
    ['convex', 'run', '--typecheck', 'disable', '--codegen', 'disable', 'school:recentConversationEvalData', payload],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
          process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180',
      },
      maxBuffer: 1024 * 1024 * 16,
      timeout: 180_000,
    },
  );
  const data = parseJsonFromStdout(stdout);
  return Array.isArray(data?.conversations) ? data.conversations : [];
}

function isAlanUmiConversation(conversation) {
  const names = new Set(conversation.involvedCharacters ?? []);
  const hasAlan = names.has('Alan');
  const hasUmi = names.has('海') || names.has('Umi');
  return hasAlan && hasUmi;
}

function scoreCandidate(conversation) {
  const messages = conversation.transcriptMessages ?? conversation.previewMessages ?? [];
  const alanText = messages
    .filter((message) => String(message.author ?? '').toLowerCase() === 'alan')
    .map((message) => message.text ?? '')
    .join('\n');
  const matched = REQUIRED_SIGNALS.filter((signal) =>
    signal.patterns.some((pattern) => pattern.test(alanText)),
  );
  return {
    id: conversation.id,
    kind: conversation.kind ?? 'unknown',
    diagnosticKind: conversation.diagnosticKind,
    createdAt: conversation.createdAt ?? 0,
    timestampLabelZh: conversation.timestampLabelZh ?? 'unknown',
    matched,
    matchedCount: matched.length,
    messageCount: conversation.messageCount ?? messages.length,
    transcriptMessages: messages,
  };
}

async function writeReport({ checkedAt, limit, candidates }) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# Alan-Facing Umi Playtest Candidate Scan',
    '',
    `Generated: ${new Date(checkedAt).toISOString()}`,
    `Source: school:recentConversationEvalData limit=${limit}`,
    `Overall: ${candidates.some((item) => item.matchedCount === REQUIRED_SIGNALS.length) ? 'CANDIDATE_FOUND' : 'NO_COMPLETE_CANDIDATE'}`,
    '',
    '## Required Signals',
    '',
    ...REQUIRED_SIGNALS.map((signal) => `- ${signal.label}`),
    '',
    '## Candidates',
    '',
  ];
  if (candidates.length === 0) {
    lines.push('No Alan + Umi/海 conversations found in the scanned window.', '');
  } else {
    for (const candidate of candidates.slice(0, 12)) {
      lines.push(`### ${candidate.id}`);
      lines.push('');
      lines.push(`- time: ${candidate.timestampLabelZh}`);
      lines.push(`- kind: ${candidate.kind}${candidate.diagnosticKind ? ` / ${candidate.diagnosticKind}` : ''}`);
      lines.push(`- matched: ${candidate.matchedCount}/${REQUIRED_SIGNALS.length}`);
      lines.push(`- signals: ${candidate.matched.map((signal) => signal.label).join(', ') || 'none'}`);
      lines.push('');
      lines.push('Transcript excerpt:');
      for (const message of candidate.transcriptMessages.slice(0, 8)) {
        lines.push(`- **${message.author ?? 'unknown'}**: ${singleLine(message.text ?? '').slice(0, 260)}`);
      }
      lines.push('');
    }
  }
  lines.push('## Policy');
  lines.push('');
  lines.push('- This report is read-only and does not clear the Alan-facing gate.');
  lines.push('- Use it only to locate candidate evidence; the durable artifact still needs real PASS/PARTIAL/FAIL rows.');
  lines.push('- If only old orphan chats appear, keep the v0.1 gate pending until Alan intentionally playtests Umi.');
  lines.push('');
  await writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function parseJsonFromStdout(stdout) {
  const first = stdout.indexOf('{');
  const last = stdout.lastIndexOf('}');
  if (first < 0 || last < first) return undefined;
  try {
    return JSON.parse(stdout.slice(first, last + 1));
  } catch {
    return undefined;
  }
}

function singleLine(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function numberArg(name, fallback, min, max) {
  const raw = Number(args.get(name));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(raw)));
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

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function runSelfTest() {
  const complete = scoreCandidate({
    id: 'orphan-chat-test',
    involvedCharacters: ['Alan', '海'],
    createdAt: 1,
    transcriptMessages: [
      { author: 'Alan', text: '嗨，Umi' },
      { author: 'Alan', text: '我有點累，但還想知道現在最重要的是什麼。' },
      { author: 'Alan', text: '不是依賴，是喜歡' },
      { author: 'Alan', text: '你還記得昨天或今天早上我們留下了什麼嗎？' },
      { author: 'Alan', text: '我先離開一下。' },
    ],
  });
  if (complete.matchedCount !== REQUIRED_SIGNALS.length) {
    throw new Error(`expected complete candidate, got ${complete.matchedCount}`);
  }
  const old = scoreCandidate({
    id: 'orphan-chat-old',
    involvedCharacters: ['Alan', '海'],
    createdAt: 1,
    transcriptMessages: [{ author: 'Alan', text: '不是依賴，是喜歡' }],
  });
  if (old.matchedCount !== 1) throw new Error(`expected one matched signal, got ${old.matchedCount}`);
  if (!isAlanUmiConversation({ involvedCharacters: ['Alan', '海'] })) throw new Error('expected Alan+Umi match');
  if (isAlanUmiConversation({ involvedCharacters: ['Alan', '真晝'] })) throw new Error('Mahiru should not match Umi gate');
  console.log('[underworld-alan-playtest-candidates:self-test] PASS');
}

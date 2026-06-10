#!/usr/bin/env node
// Underworld Alan-facing chat archival verifier.
//
// This writes one small Alan -> character test message, waits for a character
// reply, and verifies both the raw messages table and recentConversationEvalData
// contain the full active transcript. Use this when human playtest evidence
// must be durable instead of only Alan-side worldEvents.

import { execFile } from 'node:child_process';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'alan-chat-archival-latest.md');
const HISTORY_PATH = join(REPO_ROOT, 'umi', 'reports', 'alan-chat-archival-history.jsonl');

const args = parseArgs(process.argv.slice(2));
const SELF_TEST = args.get('self-test') === 'true';
const TARGET_NAME = args.get('target') ?? 'Umi';
const TIME_ZONE = args.get('time-zone') ?? 'America/Chicago';
const MARKER = args.get('marker') ?? `alan-archival-${new Date().toISOString()}`;
const MESSAGE_TEXT =
  args.get('text') ??
  `archival verifier: 今天生活小事裡，宿舍有人沒有回晚安。請你用一句話幫我記住。 marker=${MARKER}`;

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

console.log(`[alan-chat-archival] target=${TARGET_NAME} marker=${MARKER}`);
const result = await runVerifier();
await writeReport(result);
await writeHistory(result);
console.log(`[alan-chat-archival] ${result.status}: ${result.reason}`);
console.log(`[alan-chat-archival] report written: ${relative(REPORT_PATH)}`);
if (result.status !== 'PASS') process.exitCode = 1;

async function runVerifier() {
  const entered = await convexRun('school:enterCampus', { timeZone: TIME_ZONE });
  const worldId = entered?.worldId ?? (await convexRun('world:defaultWorldStatus', {}))?.worldId;
  const alanPlayerId = entered?.playerId;
  if (!worldId || !alanPlayerId) {
    return { status: 'FAIL', reason: 'enter_campus_missing_world_or_alan', entered };
  }

  await convexRun('school:startConversationByCharacterNamesForTest', {
    leftName: 'Alan',
    rightName: TARGET_NAME,
    locationId: TARGET_NAME === 'Umi' ? 'studentCouncilRoom' : undefined,
  });
  const conversation = await waitForAlanConversation(worldId, alanPlayerId, TARGET_NAME);
  if (!conversation?.conversationId || !conversation.targetPlayerId) {
    return {
      status: 'FAIL',
      reason: 'active_alan_conversation_not_found',
      entered,
      conversation,
    };
  }

  const messageUuid = `alan-chat-archival-${randomUUID()}`;
  const writeResult = await writeAlanMessageWithRetry({
    worldId,
    alanPlayerId,
    conversationId: conversation.conversationId,
    text: MESSAGE_TEXT,
    messageUuid,
  });
  if (!writeResult.ok) {
    return {
      status: 'FAIL',
      reason: 'write_message_failed',
      entered,
      conversation,
      writeResult,
    };
  }

  const raw = await waitForRawTranscript({
    worldId,
    conversationId: conversation.conversationId,
    marker: MARKER,
  });
  const evalData = await waitForEvalTranscript({
    conversationId: conversation.conversationId,
    marker: MARKER,
  });
  const summary = summarizeProof(raw, evalData);
  const status = summary.rawHasAlanMarker && summary.rawHasPostMarkerReply && summary.evalHasAlanMarker && summary.evalHasPostMarkerReply
    ? 'PASS'
    : 'FAIL';
  const reason = status === 'PASS' ? 'alan_character_transcript_durable' : 'transcript_incomplete';
  return {
    status,
    reason,
    entered,
    conversation,
    messageUuid,
    marker: MARKER,
    messageText: MESSAGE_TEXT,
    writeResult,
    raw,
    evalConversation: evalData,
    summary,
  };
}

async function waitForAlanConversation(worldId, alanPlayerId, targetName) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await convexRun('world:worldState', { worldId });
    const descriptions = await convexRun('world:gameDescriptions', { worldId });
    const byPlayerId = new Map(
      (descriptions?.playerDescriptions ?? []).map((item) => [item.playerId, item.name]),
    );
    const target = (descriptions?.playerDescriptions ?? []).find((item) => item.name === targetName);
    const found = (state?.world?.conversations ?? []).find((conversation) => {
      const participantIds = (conversation.participants ?? []).map((participant) => participant.playerId);
      return participantIds.includes(alanPlayerId) && (!target || participantIds.includes(target.playerId));
    });
    if (found) {
      return {
        conversationId: found.id,
        targetPlayerId: target?.playerId,
        participants: (found.participants ?? []).map((participant) => ({
          playerId: participant.playerId,
          name: byPlayerId.get(participant.playerId) ?? participant.playerId,
          status: participant.status,
        })),
      };
    }
    await sleep(1000);
  }
  return undefined;
}

async function writeAlanMessageWithRetry({ worldId, alanPlayerId, conversationId, text, messageUuid }) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await convexRun('messages:writeMessage', {
        worldId,
        playerId: alanPlayerId,
        conversationId,
        text,
        messageUuid,
      });
      return { ok: true, attempts: attempt + 1 };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const existing = await convexRun('messages:listMessages', { worldId, conversationId });
      if ((existing ?? []).some((message) => message.messageUuid === messageUuid)) {
        return { ok: true, attempts: attempt + 1, recoveredFromExistingMessage: true };
      }
      await sleep(1200 * (attempt + 1));
    }
  }
  return { ok: false, attempts: 3, error: lastError };
}

async function waitForRawTranscript({ worldId, conversationId, marker }) {
  let latest = [];
  for (let attempt = 0; attempt < 45; attempt += 1) {
    latest = await convexRun('messages:listMessages', { worldId, conversationId });
    const summary = summarizeMessages(latest, marker);
    if (summary.hasAlanMarker && summary.hasPostMarkerReply) return { messages: latest, summary };
    await sleep(1500);
  }
  return { messages: latest, summary: summarizeMessages(latest, marker) };
}

async function waitForEvalTranscript({ conversationId, marker }) {
  let matched;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const data = await convexRun('school:recentConversationEvalData', {
      timeZone: TIME_ZONE,
      limit: 8,
      compact: false,
      messagesPerConversation: 12,
    });
    matched = (data?.conversations ?? []).find((conversation) =>
      String(conversation.id ?? '').includes(conversationId) ||
      (conversation.transcriptMessages ?? []).some((message) => (message.text ?? '').includes(marker)),
    );
    if (matched) {
      const summary = summarizeMessages(matched.transcriptMessages ?? [], marker);
      if (summary.hasAlanMarker && summary.hasPostMarkerReply) return { conversation: matched, summary };
    }
    await sleep(1500);
  }
  return { conversation: matched, summary: summarizeMessages(matched?.transcriptMessages ?? [], marker) };
}

function summarizeProof(raw, evalData) {
  return {
    rawMessageCount: raw?.messages?.length ?? 0,
    rawHasAlanMarker: raw?.summary?.hasAlanMarker ?? false,
    rawHasPostMarkerReply: raw?.summary?.hasPostMarkerReply ?? false,
    evalMessageCount: evalData?.conversation?.transcriptMessages?.length ?? 0,
    evalHasAlanMarker: evalData?.summary?.hasAlanMarker ?? false,
    evalHasPostMarkerReply: evalData?.summary?.hasPostMarkerReply ?? false,
  };
}

function summarizeMessages(messages, marker) {
  const list = Array.isArray(messages) ? messages : [];
  const markerIndex = list.findIndex((message) => {
    const author = displayName(message.authorName ?? message.author);
    return author === 'Alan' && String(message.text ?? '').includes(marker);
  });
  return {
    hasAlanMarker: markerIndex >= 0,
    hasPostMarkerReply:
      markerIndex >= 0 &&
      list.slice(markerIndex + 1).some((message) => displayName(message.authorName ?? message.author) !== 'Alan'),
    postMarkerReplyAuthors:
      markerIndex >= 0
        ? list
            .slice(markerIndex + 1)
            .map((message) => displayName(message.authorName ?? message.author))
            .filter((author) => author !== 'Alan')
        : [],
  };
}

async function convexRun(functionName, payload) {
  const commandArgs = [
    'convex',
    'run',
    '--typecheck',
    'disable',
    '--codegen',
    'disable',
    functionName,
  ];
  if (payload && Object.keys(payload).length > 0) {
    commandArgs.push(JSON.stringify(payload));
  }
  const { stdout } = await execFileAsync('npx', commandArgs, {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
        process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180',
    },
    maxBuffer: 1024 * 1024 * 12,
    timeout: 180_000,
  });
  const text = stdout.trim();
  return text ? JSON.parse(text) : null;
}

async function writeReport(result) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  const rawMessages = result.raw?.messages ?? [];
  const evalMessages = result.evalConversation?.conversation?.transcriptMessages ?? [];
  const lines = [
    '# Underworld Alan Chat Archival',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Overall: ${result.status}`,
    `Reason: ${result.reason}`,
    `Target: ${TARGET_NAME}`,
    `Conversation: ${result.conversation?.conversationId ?? 'unknown'}`,
    `Marker: ${result.marker ?? MARKER}`,
    '',
    '## Summary',
    '',
    `- Raw messages: ${result.summary?.rawMessageCount ?? 0}`,
    `- Raw has Alan marker: ${yesNo(result.summary?.rawHasAlanMarker)}`,
    `- Raw has post-marker character reply: ${yesNo(result.summary?.rawHasPostMarkerReply)}`,
    `- Eval messages: ${result.summary?.evalMessageCount ?? 0}`,
    `- Eval has Alan marker: ${yesNo(result.summary?.evalHasAlanMarker)}`,
    `- Eval has post-marker character reply: ${yesNo(result.summary?.evalHasPostMarkerReply)}`,
    '',
    '## Raw Transcript',
    '',
    ...(rawMessages.length ? rawMessages.map(formatMessageLine) : ['- none']),
    '',
    '## Eval Transcript',
    '',
    ...(evalMessages.length ? evalMessages.map(formatMessageLine) : ['- none']),
    '',
  ];
  await writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

async function writeHistory(result) {
  await mkdir(dirname(HISTORY_PATH), { recursive: true });
  const entry = {
    generatedAt: new Date().toISOString(),
    status: result.status,
    reason: result.reason,
    targetName: TARGET_NAME,
    conversationId: result.conversation?.conversationId,
    marker: result.marker ?? MARKER,
    messageUuid: result.messageUuid,
    summary: result.summary,
    rawTranscriptMessages: compactMessages(result.raw?.messages ?? []),
    evalTranscriptMessages: compactMessages(result.evalConversation?.conversation?.transcriptMessages ?? []),
  };
  await appendFile(HISTORY_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
}

function compactMessages(messages) {
  return messages.map((message) => ({
    authorName: displayName(message.authorName ?? message.author),
    text: String(message.text ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

function formatMessageLine(message) {
  const author = displayName(message.authorName ?? message.author);
  const text = String(message.text ?? '').replace(/\s+/g, ' ').trim();
  return `- ${author}: ${text.length <= 180 ? text : `${text.slice(0, 177)}...`}`;
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

function displayName(name) {
  if (name === 'Umi') return '海';
  if (name === 'Mahiru') return '真晝';
  if (name === 'Tianze') return '天澤';
  return String(name ?? 'unknown');
}

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function runSelfTest() {
  const messages = [
    { authorName: '海', text: '先看今天的小事。' },
    { authorName: 'Alan', text: 'marker=abc' },
    { authorName: '海', text: '我記下 marker=abc 旁邊那件事了。' },
  ];
  const summary = summarizeMessages(messages, 'marker=abc');
  if (!summary.hasAlanMarker || !summary.hasPostMarkerReply) {
    throw new Error('self-test expected Alan marker plus post-marker reply');
  }
  console.log('[underworld-alan-chat-archival:self-test] PASS');
}

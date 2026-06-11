import { execFile } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  ConversationEvalCase,
  ConversationEvalResult,
  evaluateConversationCase,
} from './metrics/conversation_metrics.ts';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const REPORT_PATH = join(__dirname, 'reports', 'latest.md');
const WATCHED_CONVERSATION_SOURCE_PATHS = [
  join(__dirname, '..', '..', 'convex', 'agent', 'conversation.ts'),
  join(__dirname, '..', '..', 'convex', 'aiTown', 'agent.ts'),
  join(__dirname, '..', '..', 'convex', 'aiTown', 'agentOperations.ts'),
  join(__dirname, '..', '..', 'convex', 'constants.ts'),
];
const RECENT_LIMIT = Number(process.env.CONVERSATION_EVAL_RECENT_LIMIT ?? 12);
const CONVEX_TIMEOUT_MS = Number(process.env.CONVERSATION_EVAL_CONVEX_TIMEOUT_MS ?? 180_000);
const COMMAND_ENV = {
  ...process.env,
  CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
    process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180',
};
const SQLITE_RETRY_COUNT = Number(process.env.CONVERSATION_EVAL_SQLITE_RETRIES ?? 5);
const SQLITE_RETRY_DELAY_MS = Number(process.env.CONVERSATION_EVAL_SQLITE_RETRY_DELAY_MS ?? 700);
const SINCE_LAST_CHANGE = process.argv.includes('--since-last-change');
const SINCE_CREATED_AT = argNumber('since-created-at');
const LOCAL_SQLITE_PATH =
  process.env.CONVEX_LOCAL_SQLITE_PATH ??
  join(
    homedir(),
    '.convex',
    'convex-backend-state',
    'local-alan_chu-ai_town',
    'convex_local_backend.sqlite3',
  );

type TimelineMessage = {
  author: string;
  text: string;
  timestampLabelZh?: string;
  createdAt?: number;
};

type TimelineEntry = {
  id: string;
  kind: string;
  createdAt?: number;
  timestampLabelZh?: string;
  involvedCharacters?: string[];
  summaryZh?: string;
  transcriptMessages?: TimelineMessage[];
  previewMessages?: TimelineMessage[];
};

type RecentConversationEvalResponse = {
  conversations?: TimelineEntry[];
  orphanChatSessions?: TimelineEntry[];
  orphanChatEventCount?: number;
};

type RecentEvalItem = {
  entry: TimelineEntry;
  testCase: ConversationEvalCase;
  result: ConversationEvalResult;
  suggestedFixCategory: string;
  cohort: 'post_fix' | 'legacy_noise';
};

async function main() {
  const sinceLastChangeAt = SINCE_CREATED_AT ?? (SINCE_LAST_CHANGE ? await latestConversationSourceMtime() : undefined);
  const fetchLimit = RECENT_LIMIT;
  const data = await fetchRecentConversations(fetchLimit, sinceLastChangeAt);
  const orphanChatSessions = data.orphanChatSessions ?? [];
  const conversations = (data.conversations ?? [])
    .filter((entry) => entry.kind === 'conversation' && (entry.transcriptMessages?.length ?? 0) >= 2)
    .slice(0, fetchLimit);
  const items = conversations.map((entry) => {
    const testCase = conversationToEvalCase(entry);
    const result = evaluateConversationCase(testCase);
    const firstMessageAt = entry.transcriptMessages?.[0]?.createdAt ?? entry.createdAt ?? 0;
    const cohort: RecentEvalItem['cohort'] =
      sinceLastChangeAt !== undefined && Number(firstMessageAt) >= sinceLastChangeAt
        ? 'post_fix'
        : 'legacy_noise';
    return {
      entry,
      testCase,
      result,
      suggestedFixCategory: suggestedFixCategory(result),
      cohort,
    };
  });
  const activeItems = SINCE_LAST_CHANGE ? items.filter((item) => item.cohort === 'post_fix') : items.slice(0, RECENT_LIMIT);
  printRecentSummary(activeItems, items, sinceLastChangeAt, orphanChatSessions);
  await writeReport(activeItems, items, sinceLastChangeAt, orphanChatSessions);
}

function argNumber(name: string) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

async function fetchRecentConversations(
  limit: number,
  sinceCreatedAt?: number,
): Promise<RecentConversationEvalResponse> {
  try {
    const { stdout } = await execFileAsync(
      'npx',
      [
        'convex',
        'run',
        '--typecheck',
        'disable',
        '--codegen',
        'disable',
        'school:recentConversationEvalData',
        JSON.stringify({
          timeZone: 'America/Chicago',
          limit,
          sinceCreatedAt,
          compact: true,
          messagesPerConversation: 8,
        }),
      ],
      {
        cwd: REPO_ROOT,
        maxBuffer: 1024 * 1024 * 8,
        timeout: CONVEX_TIMEOUT_MS,
        env: COMMAND_ENV,
      },
    );
    return parseJsonFromStdout(stdout);
  } catch (error) {
    console.warn(
      `[eval:conversation:recent] Convex query unavailable; falling back to local SQLite (${reasonFor(error)}).`,
    );
    return fetchRecentConversationsFromSqlite(limit);
  }
}

function parseJsonFromStdout(stdout: string): RecentConversationEvalResponse {
  const candidates = jsonSliceCandidates(stdout);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as RecentConversationEvalResponse;
      if (Array.isArray(parsed.conversations)) return parsed;
    } catch {
      // Convex CLI can interleave function logs with the JSON result. Keep scanning.
    }
  }
  if (!candidates.length) {
    throw new Error(`Could not find JSON in Convex output:\n${stdout.slice(0, 500)}`);
  }
  throw new Error(`Could not parse Convex JSON result:\n${stdout.slice(0, 500)}`);
}

function jsonSliceCandidates(stdout: string) {
  const candidates: string[] = [];
  const openers = new Set(['{', '[']);
  const matchingCloser: Record<string, string> = { '{': '}', '[': ']' };

  for (let start = 0; start < stdout.length; start += 1) {
    const first = stdout[start];
    if (!openers.has(first)) continue;

    const stack = [matchingCloser[first]];
    let inString = false;
    let escaped = false;

    for (let index = start + 1; index < stdout.length; index += 1) {
      const char = stdout[index];
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
      if (openers.has(char)) {
        stack.push(matchingCloser[char]);
        continue;
      }
      if (char === stack.at(-1)) {
        stack.pop();
        if (!stack.length) {
          candidates.push(stdout.slice(start, index + 1));
          break;
        }
      }
    }
  }

  return candidates.sort((a, b) => b.length - a.length);
}

function conversationToEvalCase(entry: TimelineEntry): ConversationEvalCase {
  const messages = entry.transcriptMessages ?? entry.previewMessages ?? [];
  const participants = entry.involvedCharacters ?? unique(messages.map((message) => message.author));
  const first = messages[0];
  const last = messages[messages.length - 1];
  const transcriptText = messages
    .map((message) => `${message.timestampLabelZh ?? ''} ${message.author}: ${message.text}`.trim())
    .join('\n');
  const previous = messages.slice(0, -1).map((message) => message.text).join('\n');
  return {
    name: entry.id,
    mode: participants.includes('Alan') && participants.includes('海') ? 'companion_chat' : 'world_agent_chat',
    speaker: first?.author ?? participants[0] ?? 'unknown',
    target: last?.author ?? participants[1] ?? 'unknown',
    input: previous || first?.text || entry.summaryZh || '',
    sampleOutput: transcriptText,
    expected: {
      maxCharacters: 900,
      maxSceneDetails: 4,
    },
  };
}

async function fetchRecentConversationsFromSqlite(limit: number): Promise<RecentConversationEvalResponse> {
  const [conversationTableId, messageTableId, playerDescriptionTableId] = await Promise.all([
    resolveTableIdBySample('"lastMessage"', '"ended"', '"creator"'),
    resolveTableIdBySample('"messageUuid"', '"author"', '"text"'),
    resolveTableIdBySample('"playerId"', '"name"', '"character"'),
  ]);
  const [conversationRows, messageRows, descriptionRows] = await Promise.all([
    sqliteJsonRows(
      currentDocumentsSql(conversationTableId, Math.max(
        limit * 4,
        60,
      )),
    ),
    sqliteJsonRows(
      currentDocumentsSql(messageTableId, Math.max(
        limit * 80,
        1200,
      )),
    ),
    sqliteJsonRows(
      currentDocumentsSql(playerDescriptionTableId, 200),
    ),
  ]);
  const descriptions = new Map<string, string>();
  for (const row of descriptionRows) {
    if (typeof row.playerId !== 'string' || typeof row.name !== 'string') continue;
    descriptions.set(row.playerId, displayNameZh(row.name));
  }
  const messagesByConversation = new Map<string, TimelineMessage[]>();
  for (const message of messageRows) {
    if (!message.conversationId || !message.author || typeof message.text !== 'string') continue;
    const conversationId = String(message.conversationId);
    const list = messagesByConversation.get(conversationId) ?? [];
    const createdAt = Number(message._creationTime ?? Date.now());
    list.push({
      author: descriptions.get(String(message.author)) ?? displayNameZh(String(message.author)),
      text: naturalizeSchoolText(message.text),
      timestampLabelZh: formatTimeLabel(createdAt),
      createdAt,
    });
    messagesByConversation.set(conversationId, list);
  }

  const seenConversationIds = new Set<string>();
  const conversations: TimelineEntry[] = [];
  for (const conversation of conversationRows) {
    if (!conversation.id || seenConversationIds.has(String(conversation.id))) continue;
    seenConversationIds.add(String(conversation.id));
    const messages = (messagesByConversation.get(String(conversation.id)) ?? []).sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
    );
    if (!messages.length) continue;
    const participants = Array.isArray(conversation.participants)
      ? conversation.participants.map((id) => descriptions.get(String(id)) ?? displayNameZh(String(id)))
      : unique(messages.map((message) => message.author));
    const lastText = messages.at(-1)?.text ?? '';
    conversations.push({
      id: `conversation-${conversation.id}`,
      kind: 'conversation',
      createdAt: Number(conversation.ended ?? conversation._creationTime ?? Date.now()),
      timestampLabelZh: formatTimeLabel(Number(conversation.ended ?? conversation._creationTime ?? Date.now())),
      involvedCharacters: participants,
      summaryZh: `${participants.join('、')} 結束了一段對話：「${lastText.slice(0, 48)}${
        lastText.length > 48 ? '...' : ''
      }」`,
      previewMessages: messages.slice(-3),
      transcriptMessages: messages,
    });
    if (conversations.length >= limit) break;
  }
  return {
    conversations,
  };
}

function currentDocumentsSql(tableId: string, limit: number) {
  return `
    select d.json_value
    from documents d
    join (
      select table_id, id, max(ts) as ts
      from documents
      where table_id=x'${tableId}'
      group by table_id, id
    ) latest on d.table_id=latest.table_id and d.id=latest.id and d.ts=latest.ts
    where d.table_id=x'${tableId}' and d.deleted=0
    order by d.ts desc
    limit ${limit}
  `;
}

async function resolveTableIdBySample(...needles: string[]) {
  const clauses = needles.map((needle) => `json_value like '%${needle.replace(/'/g, "''")}%'`).join(' and ');
  const stdout = await sqliteStdout(`select hex(table_id) from documents where ${clauses} limit 1`, {
    maxBuffer: 1024 * 1024,
    timeout: 10_000,
  });
  const tableId = stdout.trim();
  if (!tableId) {
    throw new Error(`Could not resolve local Convex table id for sample ${needles.join(', ')}`);
  }
  return tableId;
}

async function sqliteJsonRows(sql: string) {
  const stdout = await sqliteStdout(sql, {
    maxBuffer: 1024 * 1024 * 16,
    timeout: 15_000,
  });
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function sqliteStdout(
  sql: string,
  options: { maxBuffer: number; timeout: number },
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= SQLITE_RETRY_COUNT; attempt += 1) {
    try {
      const { stdout } = await execFileAsync(
        'sqlite3',
        ['-readonly', '-cmd', '.timeout 5000', LOCAL_SQLITE_PATH, sql],
        options,
      );
      return stdout;
    } catch (error) {
      lastError = error;
      if (!isSqliteLocked(error) || attempt === SQLITE_RETRY_COUNT) break;
      const delay = SQLITE_RETRY_DELAY_MS * (attempt + 1);
      console.warn(`[eval:conversation:recent] local SQLite is busy; retrying in ${delay}ms.`);
      await sleep(delay);
    }
  }
  throw lastError;
}

function isSqliteLocked(error: unknown) {
  const text = reasonFor(error);
  return text.includes('database is locked') || text.includes('database is busy');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printRecentSummary(
  items: RecentEvalItem[],
  allItems: RecentEvalItem[] = items,
  sinceLastChangeAt?: number,
  orphanChatSessions: TimelineEntry[] = [],
) {
  const rows = items.map((item) => ({
    conversation: item.entry.id,
    participants: (item.entry.involvedCharacters ?? []).join(' / '),
    cohort: item.cohort,
    status: item.result.status,
    score: item.result.overallScore.toFixed(2),
    fix: item.suggestedFixCategory,
    topReason: [...item.result.failures, ...item.result.warnings][0] ?? '-',
  }));
  const modeSuffix = SINCE_CREATED_AT
    ? ' --since-created-at'
    : SINCE_LAST_CHANGE
      ? ' --since-last-change'
      : '';
  console.log(`\nGIIS Recent Conversation Eval${modeSuffix}\n`);
  if (sinceLastChangeAt !== undefined) {
    const boundarySource = SINCE_CREATED_AT
      ? 'explicit --since-created-at'
      : WATCHED_CONVERSATION_SOURCE_PATHS.join(', ');
    console.log(`Post-fix boundary: ${new Date(sinceLastChangeAt).toISOString()} (${boundarySource})`);
  }
  if (rows.length) {
    console.table(rows);
  } else {
    console.log('No post-fix archived conversations found yet. Generate or wait for 5-10 new conversations before judging the fix.');
  }
  if (orphanChatSessions.length) {
    console.log(
      `Diagnostic orphan Alan chat sessions: ${orphanChatSessions.length} (timeline/messages existed without a matching archived conversation).`,
    );
  }
  const counts = countStatuses(items.map((item) => item.result));
  const historicalCounts = countStatuses(
    allItems.filter((item) => item.cohort === 'legacy_noise').map((item) => item.result),
  );
  console.log(`Post-fix summary: ${counts.PASS} PASS / ${counts.WARN} WARN / ${counts.FAIL} FAIL`);
  console.log(
    `Historical archived quality (legacy_noise): ${historicalCounts.PASS} PASS / ${historicalCounts.WARN} WARN / ${historicalCounts.FAIL} FAIL`,
  );
  console.log(`Report: ${REPORT_PATH}`);
}

async function writeReport(
  items: RecentEvalItem[],
  allItems: RecentEvalItem[] = items,
  sinceLastChangeAt?: number,
  orphanChatSessions: TimelineEntry[] = [],
) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  const counts = countStatuses(items.map((item) => item.result));
  const historicalItems = allItems.filter((item) => item.cohort === 'legacy_noise').slice(0, RECENT_LIMIT);
  const historicalCounts = countStatuses(historicalItems.map((item) => item.result));
  const worst = [...items]
    .sort((a, b) => a.result.overallScore - b.result.overallScore)
    .slice(0, 5);
  const historicalWorst = [...historicalItems]
    .sort((a, b) => a.result.overallScore - b.result.overallScore)
    .slice(0, 5);
  const markdown = [
    '# GIIS Underworld Recent Conversation Eval',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Mode: ${
      SINCE_CREATED_AT
        ? 'post-fix since explicit createdAt boundary'
        : SINCE_LAST_CHANGE
          ? 'post-fix since latest conversation/density code change'
          : 'recent archived conversations'
    }`,
    sinceLastChangeAt !== undefined
      ? `Post-fix boundary: ${new Date(sinceLastChangeAt).toISOString()}`
      : 'Post-fix boundary: not applied',
    '',
    `Post-fix conversations checked: ${items.length}`,
    '',
    `Post-fix summary: ${counts.PASS} PASS / ${counts.WARN} WARN / ${counts.FAIL} FAIL`,
    '',
    `Historical archived quality (legacy_noise): ${historicalCounts.PASS} PASS / ${historicalCounts.WARN} WARN / ${historicalCounts.FAIL} FAIL`,
    '',
    `Diagnostic orphan Alan chat sessions: ${orphanChatSessions.length}`,
    '',
    items.length < 5 && sinceLastChangeAt !== undefined
      ? 'Status: WAITING_FOR_NEW_CONVERSATIONS. Do not treat old archived failures as proof that the anti-repeat selector failed.'
      : 'Status: enough post-fix samples for a directional read.',
    '',
    ...(orphanChatSessions.length ? [
      '## Diagnostic Orphan Alan Chat Sessions',
      '',
      'These are Alan chat events that were visible in the timeline but did not have a matching archived conversation. They are backend persistence diagnostics, not direct character-quality scores.',
      '',
      ...orphanChatSessions.slice(0, 5).flatMap(renderOrphanChatSession),
      '',
    ] : []),
    '## Post-Fix Worst 5 Examples',
    '',
    ...(worst.length ? worst.flatMap(renderWorstItem) : ['No post-fix conversations available yet.', '']),
    '',
    '## Historical Archived Quality',
    '',
    'These are labeled `legacy_noise` because they were created before the latest watched conversation-code modification. They are useful context, not proof of current failure.',
    '',
    ...historicalWorst.flatMap(renderWorstItem),
    '',
    '## Post-Fix Results',
    '',
    '| Conversation | Participants | Cohort | Status | Score | Failure category | Top reasons |',
    '|---|---|---|---:|---:|---|---|',
    ...(items.length ? items.map((item) => {
      const reasons = [...item.result.failures, ...item.result.warnings].slice(0, 3).join('<br>') || '-';
      return `| ${item.entry.id} | ${(item.entry.involvedCharacters ?? []).join(' / ')} | ${item.cohort} | ${item.result.status} | ${item.result.overallScore.toFixed(2)} | ${postFixFailureCategory(item.result)} | ${escapeTable(reasons)} |`;
    }) : ['| - | - | post_fix | - | - | waiting_for_new_conversations | - |']),
    '',
    '## Historical Results',
    '',
    '| Conversation | Participants | Cohort | Status | Score | Suggested fix | Top reasons |',
    '|---|---|---|---:|---:|---|---|',
    ...historicalItems.map((item) => {
      const reasons = [...item.result.failures, ...item.result.warnings].slice(0, 3).join('<br>') || '-';
      return `| ${item.entry.id} | ${(item.entry.involvedCharacters ?? []).join(' / ')} | legacy_noise | ${item.result.status} | ${item.result.overallScore.toFixed(2)} | ${item.suggestedFixCategory} | ${escapeTable(reasons)} |`;
    }),
    '',
  ].join('\n');
  await writeFile(REPORT_PATH, markdown, 'utf8');
}

function renderOrphanChatSession(entry: TimelineEntry) {
  const messages = entry.transcriptMessages ?? [];
  const excerpt = messages
    .slice(-8)
    .map((message) => `> ${message.timestampLabelZh ?? ''} ${message.author}: ${message.text.replace(/\n/g, ' / ')}`)
    .join('\n');
  return [
    `### ${entry.id}`,
    '',
    `Participants: ${(entry.involvedCharacters ?? []).join(' / ') || 'unknown'}`,
    '',
    `Messages: ${entry.transcriptMessages?.length ?? entry.previewMessages?.length ?? 0}`,
    '',
    'Excerpt:',
    excerpt || '> No transcript excerpt available.',
    '',
  ];
}

function renderWorstItem(item: RecentEvalItem) {
  const messages = item.entry.transcriptMessages ?? [];
  const excerpt = messages
    .slice(-6)
    .map((message) => `> ${message.timestampLabelZh ?? ''} ${message.author}: ${message.text.replace(/\n/g, ' / ')}`)
    .join('\n');
  const reasons = [...item.result.failures, ...item.result.warnings].slice(0, 5);
  return [
    `### ${item.entry.id} - ${item.result.status} (${item.result.overallScore.toFixed(2)})`,
    '',
    `Participants: ${(item.entry.involvedCharacters ?? []).join(' / ') || 'unknown'}`,
    '',
    `Suggested fix category: ${item.suggestedFixCategory}`,
    '',
    'Reasons:',
    ...reasons.map((reason) => `- ${reason}`),
    '',
    'Excerpt:',
    excerpt || '> No transcript excerpt available.',
    '',
  ];
}

function countStatuses(results: ConversationEvalResult[]) {
  return {
    PASS: results.filter((result) => result.status === 'PASS').length,
    WARN: results.filter((result) => result.status === 'WARN').length,
    FAIL: results.filter((result) => result.status === 'FAIL').length,
  };
}

async function latestConversationSourceMtime() {
  const sources = await Promise.all(WATCHED_CONVERSATION_SOURCE_PATHS.map((sourcePath) => stat(sourcePath)));
  return Math.max(...sources.map((source) => source.mtimeMs));
}

function suggestedFixCategory(result: ConversationEvalResult) {
  const text = [...result.failures, ...result.warnings].join('\n');
  if (text.includes('wrongAddresseeScore')) return 'fix wrong addressee before changing tone';
  if (text.includes('bannedPhraseCount')) return 'remove stale template phrase or deterministic fallback';
  if (text.includes('repetitionScore')) return 'add intra-conversation response move diversity';
  if (text.includes('mirror repetition')) {
    return 'break cross-speaker mirror/motif loop (vary objects and care moves)';
  }
  if (text.includes('previousSpeakerBindingScore')) return 'strengthen emotional hook binding to previous speaker';
  if (text.includes('directAnswerScore')) return 'answer the actual question before persona/world analysis';
  if (text.includes('administrativeLanguageScore')) return 'replace administrative/meeting language with ordinary school life';
  if (text.includes('everydayObjectLoopScore')) return 'vary concrete cues instead of looping one object';
  if (text.includes('verbosityScore')) return 'shorten response and allow silence/refusal';
  if (text.includes('sceneGroundingScore')) return 'limit concrete scene detail to one grounded image';
  if (text.includes('characterVoiceScore')) return 'restore character-specific voice without expanding lore';
  if (text.includes('emotionalSpecificityScore')) return 'replace abstract concern with concrete emotional stake';
  return result.status === 'PASS' ? 'none' : 'inspect prompt and fallback path';
}

function postFixFailureCategory(result: ConversationEvalResult) {
  const text = [...result.failures, ...result.warnings].join('\n');
  if (text.includes('wrongAddresseeScore')) return 'wrong addressee';
  if (text.includes('repetitionScore')) return 'repeated fallback';
  if (text.includes('mirror repetition')) return 'mirror/motif repetition across speakers';
  if (text.includes('previousSpeakerBindingScore') || text.includes('directAnswerScore')) {
    return 'not responding to previous speaker';
  }
  if (text.includes('administrativeLanguageScore')) return 'administrative language leak';
  if (text.includes('everydayObjectLoopScore')) return 'object-loop repetition';
  if (text.includes('emotionalSpecificityScore') || text.includes('characterVoiceScore')) return 'too abstract';
  if (text.includes('verbosityScore') || text.includes('sceneGroundingScore')) return 'noisy structure';
  if (text.includes('bannedPhraseCount')) return 'template leak';
  return result.status === 'PASS' ? 'none' : 'no outcome or weak progression';
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function reasonFor(error: unknown) {
  if (error instanceof Error) return error.message.split('\n')[0];
  return String(error);
}

function displayNameZh(name: string) {
  if (name === 'Alan') return 'Alan';
  if (name === 'Umi' || name === '海' || name === '朝凪海') return '海';
  if (name === 'Tianze' || name === '天澤' || name === '天澤一夏' || name === '天擇' || name === '天擇一夏' || name === '天澤' || name === '天澤') return '天澤';
  if (name === 'Ichinose' || name === '一之瀨' || name === '一之瀨帆波' || name === '黑化一之瀨' || name === '一之瀨' || name === '一之瀨') return '一之瀨';
  if (name === 'Mahiru' || name === 'Mahiru Shiina' || name === '真晝' || name === '椎名真晝') return '真晝';
  if (name === 'Maomao' || name === '貓貓' || name === 'CaoCao' || name === 'Cao Cao' || name === '曹操') return '貓貓';
  if (name === 'Sakiko' || name === '祥子' || name === 'Liu Bei' || name === 'LiuBei' || name === '劉備') return '祥子';
  return name;
}

function naturalizeSchoolText(text: string) {
  return text
    .replaceAll('Mahiru Shiina', displayNameZh('Mahiru Shiina'))
    .replaceAll('椎名真晝', displayNameZh('椎名真晝'))
    .replaceAll('天澤', displayNameZh('天澤'))
    .replaceAll('一之瀨', displayNameZh('一之瀨'))
    .replaceAll('朝凪海', displayNameZh('朝凪海'))
    .replaceAll('Mahiru', displayNameZh('Mahiru'))
    .replaceAll('Maomao', displayNameZh('Maomao'))
    .replaceAll('CaoCao', displayNameZh('CaoCao'))
    .replaceAll('Cao Cao', displayNameZh('Cao Cao'))
    .replaceAll('曹操', displayNameZh('曹操'))
    .replaceAll('Sakiko', displayNameZh('Sakiko'))
    .replaceAll('LiuBei', displayNameZh('LiuBei'))
    .replaceAll('Liu Bei', displayNameZh('Liu Bei'))
    .replaceAll('劉備', displayNameZh('劉備'))
    .replaceAll('Tianze', displayNameZh('Tianze'))
    .replaceAll('Umi', displayNameZh('Umi'))
    .replaceAll('Ichinose', displayNameZh('Ichinose'));
}

function formatTimeLabel(createdAt: number) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'America/Chicago',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    dayPeriod: 'long',
  }).format(new Date(createdAt));
}

function escapeTable(text: string) {
  return text.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

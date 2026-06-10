#!/usr/bin/env node
// Dry-run/report wrapper for GIIS Underworld fallback-pollution cleanup.
//
// Safe default: dry-run only. Passing --apply is intentionally required for
// destructive cleanup, and Codex should still ask Alan before using it.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'fallback-pollution-cleanup-latest.md');

const args = parseArgs(process.argv.slice(2));
const APPLY = args.get('apply') === 'true';
const LIMIT = numberArg('limit', 1000, 50, 1000);
const INCLUDE_ARCHIVED = args.get('include-archived-conversations') === 'true';
const SCOPE = args.get('scope') ?? 'active';

async function main() {
  const dryRun = !APPLY;
  console.log(`[fallback-cleanup] ${dryRun ? 'dry-run' : 'APPLY'} limit=${LIMIT} scope=${SCOPE}`);
  if (!dryRun) {
    console.log('[fallback-cleanup] destructive cleanup requested; make sure Alan approved this run.');
  }

  const audit = await convexRun('school:auditFallbackPollution', {
    limit: LIMIT,
  });
  const result = await convexRun('school:cleanupFallbackPollution', {
    dryRun,
    limit: LIMIT,
    includeArchivedConversations: INCLUDE_ARCHIVED,
    scope: SCOPE,
  });

  await writeReport(result, audit, dryRun);
  console.log(`[fallback-cleanup] report=${relative(REPORT_PATH)}`);
  console.log(
    `[fallback-cleanup] conversations=${result.archivedConversationDocs ?? 0} messages=${result.messageDocs ?? 0} memories=${result.memoryDocs ?? 0} notifications=${result.notificationDocs ?? 0}`,
  );
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
    { cwd: REPO_ROOT, timeout: 60_000, maxBuffer: 1024 * 1024 * 8 },
  );
  return parseJsonFromStdout(stdout);
}

async function writeReport(result, audit, dryRun) {
  const lines = [
    '# GIIS Underworld Fallback Pollution Cleanup',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${dryRun ? 'dry-run' : 'apply'}`,
    `Scope: ${result.scope ?? 'active'}`,
    `World: ${result.worldId ?? 'unknown'}`,
    '',
    '## Counts',
    '',
    `- Archived conversation docs: ${result.archivedConversationDocs ?? 0}`,
    `- Include archived conversations: ${result.includeArchivedConversations ? 'yes' : 'no'}`,
    `- Message docs: ${result.messageDocs ?? 0}`,
    `- ParticipatedTogether docs: ${result.participatedTogetherDocs ?? 0}`,
    `- Memory docs: ${result.memoryDocs ?? 0}`,
    `- Embedding docs: ${result.embeddingDocs ?? 0}`,
    `- World event docs: ${result.worldEventDocs ?? 0}`,
    `- Notification docs: ${result.notificationDocs ?? 0}`,
    `- Profile docs patched: ${result.profileDocs ?? 0}`,
    '',
    '## Cleanup Target Examples',
    '',
    '### Archived Conversations',
    '',
    ...(result.includeArchivedConversations
      ? exampleLines(audit.fallbackArchivedConversations, (item) =>
          `- ${item.conversationId} · ${(item.participantNames ?? []).join(' / ')} · ${trim(item.text ?? '', 180)}`,
        )
      : ['Skipped by policy. Archived fallback-like conversations were retained as historical transcript evidence.']),
    '',
    '### Memories',
    '',
    ...exampleLines(audit.fallbackMemories, (item) =>
      `- ${item.memoryId} · ${item.playerName} · ${trim(item.description ?? '', 180)}`,
    ),
    '',
    '### Notifications',
    '',
    ...(audit.fallbackNotificationCount === 0
      ? ['None.']
      : result.notificationDocs > 0
      ? exampleLines(audit.fallbackNotifications, (item) =>
          `- ${item.notificationDocId} · ${item.relatedCharacterName} · ${trim(item.contentZh ?? '', 160)}`,
        )
      : ['Retained by scope. Notifications were not cleanup targets in this run.']),
    '',
    '### Profiles',
    '',
    ...(audit.pollutedProfileCount === 0
      ? ['None.']
      : result.profileDocs > 0
      ? exampleLines(audit.pollutedProfiles, (item) =>
          `- ${item.profileId} · ${item.playerName} · intentions=${(item.pollutedIntentions ?? []).map((line) => trim(line, 120)).join(' / ') || 'none'} shortMemory=${(item.pollutedShortMemory ?? []).length} longMemory=${(item.pollutedLongMemory ?? []).length} beliefs=${(item.pollutedBeliefs ?? []).length}`,
        )
      : ['Retained by scope. Profiles were not cleanup targets in this run.']),
    '',
    '## Retained Historical Evidence',
    '',
    `- Archived fallback-like conversations found in audit: ${audit.fallbackArchivedConversationCount ?? 0}`,
    result.includeArchivedConversations
      ? '- Archived fallback-like conversations were included in this cleanup run.'
      : '- Archived fallback-like conversations were not cleaned by this run.',
    '',
    '## Safety',
    '',
    dryRun
      ? '- No data was deleted. Run with `-- --apply=true` only after Alan confirms the deletion list.'
      : '- Destructive cleanup was executed.',
    '- Archived conversations are not deleted unless `-- --include-archived-conversations=true` is passed.',
    '- Cleanup targets generated fallback/template contamination, not low-quality but real LLM conversations.',
    '',
  ];
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, lines.join('\n'));
}

function exampleLines(items, formatter) {
  if (!Array.isArray(items) || items.length === 0) return ['None.'];
  return items.slice(0, 12).map(formatter);
}

function trim(value, maxLength) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
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
  return Math.max(min, Math.min(max, Math.round(parsed)));
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
  return {};
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

function relative(path) {
  return path.startsWith(`${REPO_ROOT}/`) ? path.slice(REPO_ROOT.length + 1) : path;
}

main().catch((error) => {
  console.error('[fallback-cleanup] failed');
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});

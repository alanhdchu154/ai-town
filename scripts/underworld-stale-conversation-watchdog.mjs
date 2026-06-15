#!/usr/bin/env node
// Dry-run-first watchdog for stale active Underworld conversations.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative as pathRelative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'stale-conversation-watchdog-latest.md');

const args = parseArgs(process.argv.slice(2));
if (args.get('self-test') === 'true') {
  runSelfTest();
  process.exit(0);
}

const write = args.get('write') === 'true';
const confirm = args.get('confirm');
if (write && confirm !== 'clear-stale-active-conversations') {
  console.error(
    '[stale-conversation-watchdog] refusing write without --confirm=clear-stale-active-conversations',
  );
  process.exit(2);
}
if (write && process.env.UNDERWORLD_STALE_WATCHDOG_ALLOW_DIRECT_WRITE !== 'true') {
  console.error(
    '[stale-conversation-watchdog] direct write is disabled; set UNDERWORLD_STALE_WATCHDOG_ALLOW_DIRECT_WRITE=true only for a human-approved one-shot cleanup',
  );
  process.exit(2);
}

const staleMinutes = Number(args.get('stale-minutes') ?? process.env.UNDERWORLD_STALE_CONVERSATION_MINUTES ?? 120);
const maxConversations = Number(args.get('max-conversations') ?? 5);
const includeHuman = args.get('include-human') === 'true';
const result = await runWatchdog({
  dryRun: !write,
  staleAfterMs: Math.max(1, staleMinutes) * 60_000,
  maxConversations,
  includeHuman,
});
await writeReport(result);

console.log(
  `[stale-conversation-watchdog] mode=${write ? 'write' : 'dry-run'} stale=${result.activeConversationDocs} messages=${result.messageDocs}`,
);
console.log(`[stale-conversation-watchdog] report=${pathRelative(REPO_ROOT, REPORT_PATH)}`);
if (!write && result.activeConversationDocs > 0) process.exitCode = 1;

async function runWatchdog(payload) {
  const { stdout } = await execFileAsync(
    'npx',
    [
      'convex',
      'run',
      '--typecheck',
      'disable',
      '--codegen',
      'disable',
      'school:cleanupStaleActiveConversations',
      JSON.stringify(payload),
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
          process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180',
      },
      maxBuffer: 1024 * 1024 * 4,
      timeout: 180_000,
    },
  );
  return JSON.parse(stdout);
}

async function writeReport(result) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# Underworld Stale Conversation Watchdog',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${result.dryRun ? 'dry-run' : 'write'}`,
    `World: ${result.worldId}`,
    `Stale threshold: ${formatAge(result.staleAfterMs)}`,
    `Include human conversations: ${result.includeHuman ? 'yes' : 'no'}`,
    '',
    '## Summary',
    '',
    `- stale active conversations: ${result.activeConversationDocs}`,
    `- unarchived messages affected: ${result.messageDocs}`,
    `- agent operations cleared: ${result.clearedAgentOps}`,
    `- archive writes: ${result.safety?.archived ? 'yes' : 'no'}`,
    `- memory writes: ${result.safety?.wroteMemory ? 'yes' : 'no'}`,
    `- experience-log writes: ${result.safety?.wroteExperienceLog ? 'yes' : 'no'}`,
    '',
    '## Conversations',
    '',
    ...(result.removedConversations?.length
      ? result.removedConversations.map(
          (conversation) =>
            `- ${conversation.conversationId}: ${conversation.participantNames.join(' / ')}; messages=${conversation.messageDocs}; age=${formatAge(conversation.ageMs)}; human=${conversation.hasHuman ? 'yes' : 'no'}`,
        )
      : ['- none']),
    '',
    '## Write Policy',
    '',
    'This watchdog is dry-run by default. To apply, rerun with `UNDERWORLD_STALE_WATCHDOG_ALLOW_DIRECT_WRITE=true npm run underworld:stale-watchdog:write` after reviewing this report and getting explicit human approval.',
    '',
  ];
  await writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
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

function formatAge(ms) {
  const totalMinutes = Math.round(Number(ms) / 60_000);
  if (!Number.isFinite(totalMinutes)) return 'unknown';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function runSelfTest() {
  const age = formatAge(125 * 60_000);
  if (age !== '2h 5m') throw new Error(`unexpected age formatting: ${age}`);
  const parsed = parseArgs(['--write', '--confirm=clear-stale-active-conversations']);
  if (parsed.get('write') !== 'true' || parsed.get('confirm') !== 'clear-stale-active-conversations') {
    throw new Error('argument parser self-test failed');
  }
  console.log('[stale-conversation-watchdog:self-test] PASS');
}

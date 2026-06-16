#!/usr/bin/env node
// Prepare Alan's manual Underworld human-test flow.
//
// This is a gate/report wrapper only. It does not send chat messages, call LLM
// providers, mutate Convex state, or mark v0.1 as complete.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'human-flow-ready-latest.md');
const TARGET_URL = process.env.UNDERWORLD_HUMAN_FLOW_URL ?? 'http://localhost:5173/ai-town';
const PILOT_CHARACTERS = ['海', '真晝', '貓貓', '天澤', '一之瀨', '祥子'];

const args = parseArgs(process.argv.slice(2));
if (args.get('self-test') === 'true') {
  runSelfTest();
  process.exit(0);
}

const startedAt = new Date().toISOString();
const checks = [];
checks.push(await runCommand('runtime_preflight', ['npm', ['run', 'underworld:runtime-preflight']], true));
checks.push(await runCommand('frontend_smoke', ['npm', ['run', 'underworld:frontend-smoke']], true));
checks.push(
  await runCommand(
    'alan_playtest_candidates',
    ['npm', ['run', 'underworld:alan-playtest-candidates', '--', '--target=all']],
    false,
  ),
);

const requiredOk = checks.filter((check) => check.required).every((check) => check.exitCode === 0);
const report = buildReport({ startedAt, finishedAt: new Date().toISOString(), checks, requiredOk });
await mkdir(dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, report, 'utf8');

console.log(`[underworld-human-flow-ready] ${requiredOk ? 'READY' : 'NOT_READY'}`);
console.log(`[underworld-human-flow-ready] url=${TARGET_URL}`);
console.log(`[underworld-human-flow-ready] report=${relative(REPO_ROOT, REPORT_PATH)}`);
if (!requiredOk) process.exitCode = 1;

async function runCommand(id, [command, commandArgs], required) {
  const startedAt = new Date().toISOString();
  try {
    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
          process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180',
      },
      timeout: id === 'frontend_smoke' ? 240_000 : 180_000,
      maxBuffer: 1024 * 1024 * 16,
    });
    return {
      id,
      command: [command, ...commandArgs].join(' '),
      required,
      exitCode: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      summary: summarize(stdout, stderr),
    };
  } catch (error) {
    return {
      id,
      command: [command, ...commandArgs].join(' '),
      required,
      exitCode: typeof error.code === 'number' ? error.code : 1,
      startedAt,
      finishedAt: new Date().toISOString(),
      summary: summarize(error.stdout ?? '', error.stderr ?? error.message ?? ''),
    };
  }
}

function buildReport({ startedAt, finishedAt, checks, requiredOk }) {
  const urls = humanUrls();
  const lines = [
    '# Underworld Human Flow Ready',
    '',
    `Generated: ${finishedAt}`,
    `Started: ${startedAt}`,
    `Overall: ${requiredOk ? 'READY' : 'NOT_READY'}`,
    '',
    '## URLs',
    '',
    `- Local browser: ${TARGET_URL}`,
    ...urls.map((url) => `- Same-Wi-Fi mobile: ${url}`),
    '',
    '## Checks',
    '',
    '| Check | Required | Exit | Command | Started | Finished | Summary |',
    '|---|---|---:|---|---|---|---|',
    ...checks.map((check) =>
      [
        check.id,
        check.required ? 'yes' : 'no',
        check.exitCode,
        check.command,
        check.startedAt,
        check.finishedAt,
        check.summary,
      ]
        .map(escapeTableCell)
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |'),
    ),
    '',
    '## Alan Manual Test Script',
    '',
    'For each pilot character, run two short messages:',
    '',
    ...PILOT_CHARACTERS.map((name) => `- ${name}: greeting + one concrete promise/memory hook.`),
    '',
    'Passing behavior:',
    '',
    '- the page does not jump, blank, or trap Alan in a spinner;',
    '- the sent message stays visible and the panel scrolls to newest content;',
    '- character thinking is visually distinct from backend/provider failure;',
    '- if provider/backend fails, no weak fallback is saved as memory;',
    '- any real promise or memory hook can be found later in the candidate/playtest reports.',
    '',
    '## Report Locations',
    '',
    '- Frontend smoke: `umi/reports/frontend-smoke-latest.json`',
    '- Runtime preflight: `umi/reports/runtime-preflight-latest.md`',
    '- Alan candidate scan: `umi/reports/alan-playtest-candidates-latest.md`',
    '- Manual frontend acceptance checklist: `umi/playtest-frontend-mobile-acceptance.md`',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function humanUrls() {
  const port = new URL(TARGET_URL).port || '5173';
  const urls = [];
  for (const items of Object.values(os.networkInterfaces())) {
    for (const item of items ?? []) {
      if (item.family !== 'IPv4' || item.internal) continue;
      urls.push(`http://${item.address}:${port}/ai-town`);
    }
  }
  return [...new Set(urls)].slice(0, 4);
}

function summarize(stdout, stderr) {
  const text = `${stdout ?? ''}\n${stderr ?? ''}`.trim().replace(/\s+/g, ' ');
  if (!text) return 'ok';
  return text.slice(-700);
}

function escapeTableCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\n/g, '<br>');
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

function runSelfTest() {
  const report = buildReport({
    startedAt: '2026-06-16T00:00:00.000Z',
    finishedAt: '2026-06-16T00:00:01.000Z',
    requiredOk: true,
    checks: [
      {
        id: 'runtime_preflight',
        command: 'npm run underworld:runtime-preflight',
        required: true,
        exitCode: 0,
        startedAt: 'a',
        finishedAt: 'b',
        summary: 'PASS',
      },
    ],
  });
  if (!report.includes('Overall: READY')) throw new Error('expected READY report');
  if (!report.includes('Alan Manual Test Script')) throw new Error('expected manual test section');
  console.log('[underworld-human-flow-ready:self-test] PASS');
}

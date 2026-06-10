#!/usr/bin/env node
// Read-only Convex runtime preflight for GIIS Underworld gates.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const OUTPUT_PATH = join(REPO_ROOT, 'umi', 'reports', 'runtime-preflight-latest.md');

const args = parseArgs(process.argv.slice(2));
if (args.get('self-test') === 'true') {
  runSelfTest();
  process.exit(0);
}

const checks = [
  { id: 'world_clock', functionName: 'school:worldClock', timeoutMs: 180_000 },
  { id: 'default_world_status', functionName: 'world:defaultWorldStatus', timeoutMs: 180_000 },
  { id: 'debug_state', functionName: 'school:debugState', timeoutMs: 180_000 },
];

const results = [];
for (const check of checks) {
  results.push(await convexRunCheck(check));
}

await writeReport(results);
const failed = results.filter((item) => item.exitCode !== 0);
const ok = failed.length === 0;
console.log(`[underworld-runtime-preflight] ${ok ? 'PASS' : 'FAIL'}: ${failed.length} failed check(s).`);
console.log(`[underworld-runtime-preflight] report written: ${relative(OUTPUT_PATH)}`);
if (!ok) process.exitCode = 1;

async function convexRunCheck(check) {
  const startedAt = new Date().toISOString();
  const commandArgs = [
    'convex',
    'run',
    '--typecheck',
    'disable',
    '--codegen',
    'disable',
    check.functionName,
  ];
  try {
    const { stdout, stderr } = await execFileAsync('npx', commandArgs, {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
          process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180',
      },
      maxBuffer: 1024 * 1024 * 4,
      timeout: check.timeoutMs,
    });
    return {
      id: check.id,
      functionName: check.functionName,
      timeoutMs: check.timeoutMs,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: 0,
      summary: summarizeOutput(stdout, stderr),
    };
  } catch (error) {
    return {
      id: check.id,
      functionName: check.functionName,
      timeoutMs: check.timeoutMs,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: typeof error.code === 'number' ? error.code : 1,
      summary: summarizeOutput(error.stdout ?? '', error.stderr ?? error.message ?? ''),
    };
  }
}

async function writeReport(results) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const failed = results.filter((item) => item.exitCode !== 0);
  const lines = [
    '# GIIS Underworld Runtime Preflight',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Overall: ${failed.length === 0 ? 'PASS' : 'FAIL'}`,
    `Reason: ${failed.length} failed check(s).`,
    '',
    '## Checks',
    '',
    '| Check | Function | Timeout ms | Exit | Started | Finished | Summary |',
    '|---|---|---:|---:|---|---|---|',
    ...results.map((item) =>
      [
        item.id,
        item.functionName,
        item.timeoutMs,
        item.exitCode,
        item.startedAt,
        item.finishedAt,
        item.summary,
      ]
        .map(escapeTableCell)
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |'),
    ),
    '',
    '## Recovery',
    '',
    'If this report fails before the afternoon gate, start the local dev stack with `bash umi/run_underworld_dev_stack.sh`, wait for Convex to become responsive, rerun this preflight, and only then rerun the guarded afternoon gate if still inside 13:00-16:59 America/Chicago.',
    '',
  ];
  await writeFile(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function summarizeOutput(stdout, stderr) {
  const text = `${stdout ?? ''}\n${stderr ?? ''}`.trim().replace(/\s+/g, ' ');
  if (!text) return 'ok';
  return text.slice(-500);
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

function escapeTableCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\n/g, '<br>');
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function runSelfTest() {
  const sample = summarizeOutput('{"ok":true}', '');
  if (!sample.includes('ok')) throw new Error('self-test expected stdout summary');
  console.log('[underworld-runtime-preflight:self-test] PASS');
}

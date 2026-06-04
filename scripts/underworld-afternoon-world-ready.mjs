#!/usr/bin/env node
// Keep the default world available for natural afternoon evidence.
//
// This is intentionally narrower than a runtime repair: it only resumes worlds
// that drifted to `inactive`. A world explicitly stopped by the developer stays
// stopped.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const args = parseArgs(process.argv.slice(2));
if (args.get('self-test') === 'true') {
  runSelfTest();
  process.exit(0);
}

const timing = chicagoTiming(new Date());
const dryRun = args.get('dry-run') === 'true';
const status = await convexRunJson('world:defaultWorldStatus');
const action = decideWorldReadyAction(status?.status, timing);

console.log(`[underworld-afternoon-world-ready] status=${status?.status ?? 'unknown'} action=${action}`);

if (action === 'resume_inactive' && !dryRun) {
  await convexRunText('testing:resume');
  console.log('[underworld-afternoon-world-ready] resumed inactive default world');
} else if (action === 'resume_inactive' && dryRun) {
  console.log('[underworld-afternoon-world-ready] dry-run: would resume inactive default world');
}

if (action === 'unknown_status') {
  process.exitCode = 1;
}

async function convexRunJson(functionName) {
  const stdout = await convexRunText(functionName);
  return parseJsonFromStdout(stdout);
}

async function convexRunText(functionName) {
  const { stdout } = await execFileAsync(
    'npx',
    ['convex', 'run', '--typecheck', 'disable', '--codegen', 'disable', functionName],
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
  return stdout;
}

function decideWorldReadyAction(status, timing) {
  if (status === 'running') return 'already_running';
  if (status === 'stoppedByDeveloper') return 'skip_stopped_by_developer';
  if (status === 'inactive') {
    return timing.canResumeWorld ? 'resume_inactive' : 'skip_quiet_hours';
  }
  return 'unknown_status';
}

function chicagoTiming(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);
  return { hour, canResumeWorld: hour >= 6 && hour < 21 };
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function runSelfTest() {
  const day = { canResumeWorld: true };
  const night = { canResumeWorld: false };
  assertEqual(decideWorldReadyAction('running', day), 'already_running', 'running world');
  assertEqual(decideWorldReadyAction('inactive', day), 'resume_inactive', 'inactive daytime world');
  assertEqual(decideWorldReadyAction('inactive', night), 'skip_quiet_hours', 'inactive quiet world');
  assertEqual(
    decideWorldReadyAction('stoppedByDeveloper', day),
    'skip_stopped_by_developer',
    'developer-stopped world',
  );
  assertEqual(decideWorldReadyAction(undefined, day), 'unknown_status', 'missing status');
  console.log('[underworld-afternoon-world-ready:self-test] PASS');
}

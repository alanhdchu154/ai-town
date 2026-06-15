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
  {
    id: 'runtime_health',
    functionName: 'school:activeConversationRuntimeHealth',
    timeoutMs: 180_000,
    args: {
      inputLimit: 5,
      staleAfterMs: Number(process.env.UNDERWORLD_PREFLIGHT_AGENT_STALE_MINUTES ?? 120) * 60_000,
    },
  },
];

const results = [];
for (const check of checks) {
  results.push(await convexRunCheck(check));
}

const runtimeHealth = evaluateRuntimeHealth(results.find((item) => item.id === 'runtime_health'));
await writeReport(results, runtimeHealth);
const failed = results.filter((item) => item.exitCode !== 0);
const healthFailed = runtimeHealth.status === 'FAIL';
const ok = failed.length === 0;
console.log(
  `[underworld-runtime-preflight] ${ok && !healthFailed ? 'PASS' : 'FAIL'}: ${failed.length} failed check(s), ${runtimeHealth.issues.length} health issue(s).`,
);
console.log(`[underworld-runtime-preflight] report written: ${relative(OUTPUT_PATH)}`);
if (!ok || healthFailed) process.exitCode = 1;

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
  if (check.args) commandArgs.push(JSON.stringify(check.args));
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
      stdout,
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
      stdout: error.stdout ?? '',
      summary: summarizeOutput(error.stdout ?? '', error.stderr ?? error.message ?? ''),
    };
  }
}

async function writeReport(results, runtimeHealth) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const failed = results.filter((item) => item.exitCode !== 0);
  const lines = [
    '# GIIS Underworld Runtime Preflight',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Overall: ${failed.length === 0 && runtimeHealth.status !== 'FAIL' ? 'PASS' : 'FAIL'}`,
    `Reason: ${failed.length} failed check(s); ${runtimeHealth.issues.length} runtime health issue(s).`,
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
    '## Runtime Health',
    '',
    `Status: ${runtimeHealth.status}`,
    `Mode: ${runtimeHealth.mode}`,
    `Latest input age: ${formatAge(runtimeHealth.latestInputAgeMs)}`,
    `Due pending inputs: ${runtimeHealth.duePendingInputCount}`,
    `Oldest due pending input age: ${formatAge(runtimeHealth.oldestDuePendingInputAgeMs)}`,
    `Active conversations: ${runtimeHealth.activeConversationCount}`,
    `Stale active conversations: ${runtimeHealth.staleActiveConversationCount}`,
    '',
    runtimeHealth.issues.length > 0 ? '### Issues' : '### Issues',
    '',
    ...(runtimeHealth.issues.length > 0
      ? runtimeHealth.issues.map((issue) => `- ${issue}`)
      : ['- none']),
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

function evaluateRuntimeHealth(result) {
  const empty = {
    status: 'WARN',
    mode: 'unknown',
    latestInputAgeMs: undefined,
    duePendingInputCount: undefined,
    oldestDuePendingInputAgeMs: undefined,
    activeConversationCount: undefined,
    staleActiveConversationCount: undefined,
    issues: ['runtime_health_check_missing'],
  };
  if (!result) return empty;
  if (result.exitCode !== 0) {
    return { ...empty, status: 'FAIL', issues: ['runtime_health_check_failed'] };
  }
  const payload = parseJsonFromStdout(result.stdout);
  if (!payload) {
    return { ...empty, status: 'FAIL', issues: ['runtime_health_json_parse_failed'] };
  }
  const hour = Number(payload.worldClock?.hour ?? new Date().getHours());
  const mode = hour >= 6 && hour < 22 ? 'day' : 'night';
  const issues = [];
  if (payload.worldStatus === 'running' && payload.engineRunning !== true) {
    issues.push('world_status_running_but_engine_not_running');
  }
  if ((payload.staleActiveConversationCount ?? 0) > 0) {
    issues.push(`stale_active_conversations=${payload.staleActiveConversationCount}`);
  }
  if (mode === 'day' && payload.worldStatus === 'running') {
    if (!payload.latestInput) {
      issues.push('daytime_running_world_has_no_agent_inputs');
    } else if ((payload.latestInput.ageMs ?? 0) > (payload.staleAfterMs ?? 120 * 60_000)) {
      issues.push(`daytime_agent_input_stale=${formatAge(payload.latestInput.ageMs)}`);
    }
    if (
      (payload.duePendingInputCount ?? 0) > 0 &&
      (payload.oldestDuePendingInputAgeMs ?? 0) > 5 * 60_000
    ) {
      issues.push(
        `daytime_due_pending_inputs=${payload.duePendingInputCount}; oldest=${formatAge(
          payload.oldestDuePendingInputAgeMs,
        )}`,
      );
    }
  }
  return {
    status: issues.length > 0 ? 'FAIL' : 'PASS',
    mode,
    latestInputAgeMs: payload.latestInput?.ageMs,
    duePendingInputCount: payload.duePendingInputCount,
    oldestDuePendingInputAgeMs: payload.oldestDuePendingInputAgeMs,
    activeConversationCount: payload.activeConversationCount,
    staleActiveConversationCount: payload.staleActiveConversationCount,
    issues,
  };
}

function parseJsonFromStdout(stdout) {
  const text = String(stdout ?? '').trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

function formatAge(ms) {
  if (ms === undefined || ms === null || Number.isNaN(Number(ms))) return 'unknown';
  const totalMinutes = Math.round(Number(ms) / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
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
  const health = evaluateRuntimeHealth({
    id: 'runtime_health',
    exitCode: 0,
    stdout: JSON.stringify({
      worldStatus: 'running',
      engineRunning: true,
      worldClock: { hour: 14 },
      latestInput: { ageMs: 130 * 60_000 },
      duePendingInputCount: 0,
      oldestDuePendingInputAgeMs: 0,
      staleAfterMs: 120 * 60_000,
      activeConversationCount: 0,
      staleActiveConversationCount: 0,
    }),
  });
  if (health.status !== 'FAIL' || !health.issues[0]?.includes('daytime_agent_input_stale')) {
    throw new Error('self-test expected stale daytime input failure');
  }
  console.log('[underworld-runtime-preflight:self-test] PASS');
}

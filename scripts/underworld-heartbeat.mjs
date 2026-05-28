#!/usr/bin/env node
// GIIS Underworld local keepalive.
//
// This mirrors the browser heartbeat for local observation sessions. It does
// not collect samples, force conversations, or write memory. By default it only
// runs during the daytime window so night quiet is not bypassed.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'underworld-heartbeat-latest.log');

const args = parseArgs(process.argv.slice(2));
const ONCE = args.get('once') === 'true';
const FORCE_NIGHT = args.get('force-night') === 'true';
const FORCE_STOPPED = args.get('force-stopped') === 'true';
const INTERVAL_MS = numberArg('interval-ms', 60_000, 30_000, 10 * 60_000);

let stopping = false;

process.on('SIGINT', () => {
  stopping = true;
  console.log('\n[underworld-heartbeat] stopping after current pulse...');
});
process.on('SIGTERM', () => {
  stopping = true;
  console.log('\n[underworld-heartbeat] stopping after current pulse...');
});

async function main() {
  console.log(`[underworld-heartbeat] starting (${ONCE ? 'once' : `${Math.round(INTERVAL_MS / 1000)}s interval`})`);
  console.log('[underworld-heartbeat] policy: keepalive only; no sample collection, memory writes, or forced conversations');
  do {
    const result = await pulse();
    console.log(formatConsoleResult(result));
    await writeLatestReport(result);
    if (ONCE || stopping) break;
    await sleep(INTERVAL_MS);
  } while (!stopping);
  console.log('[underworld-heartbeat] stopped');
}

async function pulse() {
  const timing = chicagoTiming();
  const startedAt = Date.now();
  const statusBefore = await convexRunSafe('world:defaultWorldStatus');
  const worldStatus = statusBefore.data;
  const result = {
    at: new Date(startedAt).toISOString(),
    chicago: timing.label,
    isNight: timing.isNight,
    skipped: false,
    reason: '',
    heartbeatOk: false,
    worldId: worldStatus?.worldId,
    statusBefore: worldStatus?.status ?? 'unknown',
    lastViewedBefore: worldStatus?.lastViewed,
    statusAfter: undefined,
    lastViewedAfter: undefined,
    error: undefined,
  };

  if (!statusBefore.ok) {
    result.skipped = true;
    result.reason = 'default_world_status_unavailable';
    result.error = statusBefore.error;
    return result;
  }
  if (!worldStatus?.worldId) {
    result.skipped = true;
    result.reason = 'no_default_world';
    return result;
  }
  if (timing.isNight && !FORCE_NIGHT) {
    result.skipped = true;
    result.reason = 'night_quiet';
    return result;
  }
  if (worldStatus.status === 'stoppedByDeveloper' && !FORCE_STOPPED) {
    result.skipped = true;
    result.reason = 'stopped_by_developer';
    return result;
  }

  const heartbeat = await convexRunSafe('world:heartbeatWorld', { worldId: worldStatus.worldId });
  result.heartbeatOk = heartbeat.ok;
  if (!heartbeat.ok) {
    result.error = heartbeat.error;
    return result;
  }

  const statusAfter = await convexRunSafe('world:defaultWorldStatus');
  result.statusAfter = statusAfter.data?.status ?? 'unknown';
  result.lastViewedAfter = statusAfter.data?.lastViewed;
  if (!statusAfter.ok) result.error = statusAfter.error;
  return result;
}

async function convexRunSafe(functionName, payload) {
  try {
    const commandArgs = [
      'convex',
      'run',
      '--typecheck',
      'disable',
      '--codegen',
      'disable',
      functionName,
    ];
    if (payload !== undefined) commandArgs.push(JSON.stringify(payload));
    const { stdout } = await execFileAsync('npx', commandArgs, {
      cwd: REPO_ROOT,
      env: process.env,
      maxBuffer: 1024 * 1024 * 8,
      timeout: 45_000,
    });
    return { ok: true, data: parseJsonFromStdout(stdout), stdout };
  } catch (error) {
    return {
      ok: false,
      data: undefined,
      error: `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? error}`.trim(),
    };
  }
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

async function writeLatestReport(result) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(
    REPORT_PATH,
    [
      '# Underworld Heartbeat Latest',
      '',
      `- at: ${result.at}`,
      `- chicago: ${result.chicago}`,
      `- night: ${result.isNight ? 'yes' : 'no'}`,
      `- skipped: ${result.skipped ? 'yes' : 'no'}`,
      `- reason: ${result.reason || 'none'}`,
      `- heartbeat_ok: ${result.heartbeatOk ? 'yes' : 'no'}`,
      `- world_id: ${result.worldId ?? 'unknown'}`,
      `- status_before: ${result.statusBefore}`,
      `- status_after: ${result.statusAfter ?? 'unknown'}`,
      `- last_viewed_before: ${result.lastViewedBefore ?? 'unknown'}`,
      `- last_viewed_after: ${result.lastViewedAfter ?? 'unknown'}`,
      result.error ? `- error: ${String(result.error).slice(0, 1000)}` : '- error: none',
      '',
    ].join('\n'),
  );
}

function formatConsoleResult(result) {
  if (result.skipped) {
    return `[underworld-heartbeat] skipped=${result.reason} status=${result.statusBefore} report=${relative(REPO_ROOT, REPORT_PATH)}`;
  }
  return (
    `[underworld-heartbeat] heartbeat=${result.heartbeatOk ? 'ok' : 'fail'} ` +
    `status=${result.statusBefore}->${result.statusAfter ?? 'unknown'} ` +
    `lastViewed=${result.lastViewedBefore ?? 'unknown'}->${result.lastViewedAfter ?? 'unknown'}`
  );
}

function chicagoTiming() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour);
  return {
    hour,
    isNight: hour >= 22 || hour < 6,
    label: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} America/Chicago`,
  };
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
  const raw = args.get(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(`[underworld-heartbeat] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = 1;
});

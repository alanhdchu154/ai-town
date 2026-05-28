#!/usr/bin/env node
// GIIS Underworld v0.1 approach loop.
//
// This coordinates observe passes and repair gating on a conservative schedule.
// Stop with Ctrl-C.

import { execFile } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const args = parseArgs(process.argv.slice(2));
const ONCE = args.get('once') === 'true';
const DRY_RUN = args.get('dry-run') === 'true';
const OBSERVE_INTERVAL_MS = numberArg('observe-interval-ms', 45 * 60 * 1000, 60_000, 24 * 60 * 60 * 1000);
const REPAIR_INTERVAL_MS = numberArg('repair-interval-ms', 2 * 60 * 60 * 1000, 30 * 60 * 1000, 24 * 60 * 60 * 1000);
const HEARTBEAT_INTERVAL_MS = numberArg('heartbeat-interval-ms', 60_000, 30_000, 10 * 60 * 1000);
const KEEPALIVE = args.get('keepalive') !== 'false';
const COLLECT = args.get('collect') ?? 'auto';
const CC = args.get('cc') ?? 'auto';

let lastRepairAt = 0;
let stopping = false;

process.on('SIGINT', () => {
  stopping = true;
  console.log('\n[underworld-approach] stopping after current step...');
});
process.on('SIGTERM', () => {
  stopping = true;
  console.log('\n[underworld-approach] stopping after current step...');
});

async function main() {
  console.log('[underworld-approach] v0.1 loop starting');
  console.log(`[underworld-approach] observe every ${Math.round(OBSERVE_INTERVAL_MS / 60000)} min; repair gate at most every ${Math.round(REPAIR_INTERVAL_MS / 60000)} min`);
  console.log(`[underworld-approach] keepalive ${KEEPALIVE ? `enabled (${Math.round(HEARTBEAT_INTERVAL_MS / 1000)}s heartbeat)` : 'disabled'}`);
  console.log('[underworld-approach] stop with Ctrl-C');

  do {
    const timing = chicagoTiming();
    const observeArgs = [
      'run',
      'underworld:observe',
      '--',
      `--collect=${timing.isNight ? 'skip' : COLLECT}`,
      `--cc=${CC}`,
    ];
    if (DRY_RUN) observeArgs.push('--dry-run');

    console.log(`[underworld-approach] observe pass (${timing.label}, night=${timing.isNight ? 'yes' : 'no'})`);
    const observe = await runCommand('npm', observeArgs, { timeout: DRY_RUN ? 180_000 : 420_000 });
    if (observe.code !== 0) {
      console.log(`[underworld-approach] observe exited ${observe.code}; will not run repair gate this cycle`);
    } else if (!timing.isNight && Date.now() - lastRepairAt >= REPAIR_INTERVAL_MS) {
      console.log('[underworld-approach] repair gate check');
      const repair = await runCommand('npm', ['run', 'underworld:repair-gate'], { timeout: 90_000 });
      lastRepairAt = Date.now();
      if (repair.code !== 0) console.log(`[underworld-approach] repair gate exited ${repair.code}`);
    } else {
      console.log('[underworld-approach] repair gate skipped by timing/night policy');
    }

    if (ONCE || stopping) break;
    console.log(`[underworld-approach] sleeping ${Math.round(OBSERVE_INTERVAL_MS / 60000)} minutes`);
    await sleepWithKeepalive(OBSERVE_INTERVAL_MS);
  } while (!stopping);

  console.log('[underworld-approach] stopped');
}

async function sleepWithKeepalive(durationMs) {
  if (!KEEPALIVE) {
    await sleep(durationMs);
    return;
  }
  const deadline = Date.now() + durationMs;
  while (!stopping && Date.now() < deadline) {
    const timing = chicagoTiming();
    if (!timing.isNight) {
      const heartbeat = await runCommand(
        'npm',
        ['run', 'underworld:heartbeat', '--', '--once'],
        { timeout: 60_000 },
      );
      if (heartbeat.code !== 0) {
        console.log(`[underworld-approach] heartbeat exited ${heartbeat.code}; continuing observe loop`);
      }
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(HEARTBEAT_INTERVAL_MS, remainingMs));
  }
}

async function runCommand(command, commandArgs, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      cwd: REPO_ROOT,
      env: process.env,
      maxBuffer: 1024 * 1024 * 16,
      timeout: options.timeout ?? 60_000,
    });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    return { code: 0, stdout, stderr };
  } catch (error) {
    const stdout = error.stdout?.toString() ?? '';
    const stderr = error.stderr?.toString() ?? error.message ?? '';
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    return { code: error.code ?? 1, stdout, stderr };
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

function numberArg(name, fallback, min, max) {
  const raw = args.get(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(`[underworld-approach] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = 1;
});

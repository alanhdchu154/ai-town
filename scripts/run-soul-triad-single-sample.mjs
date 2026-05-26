#!/usr/bin/env node
// Single-sample Umi x Mahiru x Asuna Qwen pilot runner.
//
// This only applies temporary pilot-control Convex env vars. It assumes the
// existing character-soul provider/key/model env is already configured on the
// backend and never reads or prints secrets.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const args = new Map(
  process.argv
    .slice(2)
    .filter((value) => value.startsWith('--'))
    .map((value) => {
      const equals = value.indexOf('=');
      if (equals === -1) return [value.slice(2), 'true'];
      return [value.slice(2, equals), value.slice(equals + 1)];
    }),
);
const TIMEOUT_MS = Number(args.get('timeout-ms') ?? 240_000);
const POLL_INTERVAL_MS = Number(args.get('poll-interval-ms') ?? 7_000);
const RUN_TIMESTAMP = Date.now();
// Optional --focus-pair="Name:Name" (e.g. "Mahiru Shiina:Asuna") restricts this
// run to a single dyad so callers can rotate coverage and stop Mahiru from being
// starved by the Umi<->Asuna mutual-first-choice attractor. Empty == default.
const FOCUS_PAIR = (args.get('focus-pair') ?? '').trim();

const PILOT_ENV = {
  SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS: String(RUN_TIMESTAMP),
  SOUL_TRIAD_COLOCATION_PILOT: 'true',
  AUTONOMOUS_CONVERSATION_LLM_PAIRS: 'Umi:Mahiru Shiina,Umi:Asuna,Mahiru Shiina:Asuna',
  UMI_MAHIRU_PILOT_MODEL: 'qwen3-max',
  UMI_MAHIRU_PILOT_TIMEOUT_MS: '60000',
  ...(FOCUS_PAIR ? { SOUL_TRIAD_FOCUS_PAIR: FOCUS_PAIR } : {}),
};

for (const [key, value] of Object.entries(PILOT_ENV)) {
  process.env[key] = value;
}

console.log(
  `[soul-triad] starting at ${new Date(RUN_TIMESTAMP).toISOString()} ` +
    `(timestamp=${RUN_TIMESTAMP}, timeout=${TIMEOUT_MS}ms, poll=${POLL_INTERVAL_MS}ms` +
    `${FOCUS_PAIR ? `, focus=${FOCUS_PAIR}` : ''})`,
);

async function convexEnvSet(key, value) {
  const { stdout } = await execFileAsync('npx', ['convex', 'env', 'set', key, value], {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024,
    timeout: 45_000,
    env: process.env,
  });
  if (stdout.trim()) console.log(stdout.trim());
}

async function convexEnvRemove(key) {
  try {
    const { stdout } = await execFileAsync('npx', ['convex', 'env', 'remove', key], {
      cwd: REPO_ROOT,
      maxBuffer: 1024 * 1024,
      timeout: 45_000,
      env: process.env,
    });
    if (stdout.trim()) console.log(stdout.trim());
  } catch (error) {
    const message = `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`;
    if (/not set|does not exist|not found/i.test(message)) return;
    throw error;
  }
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
  if (payload !== undefined) commandArgs.push(JSON.stringify(payload));
  const { stdout } = await execFileAsync('npx', commandArgs, {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024 * 10,
    timeout: 60_000,
    env: process.env,
  });
  return parseJsonFromStdout(stdout);
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

function isTriadPair(names) {
  const set = new Set(names ?? []);
  const count = ['海', '真晝', '明日奈', 'Umi', 'Mahiru Shiina', 'Asuna']
    .filter((name) => set.has(name)).length;
  return count >= 2;
}

async function pollForFreshSample() {
  const deadline = Date.now() + TIMEOUT_MS;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    try {
      const data = await convexRun('school:recentConversationEvalData', {
        limit: 16,
        compact: true,
        messagesPerConversation: 8,
        sinceCreatedAt: RUN_TIMESTAMP,
      });
      const conversations = Array.isArray(data?.conversations) ? data.conversations : [];
      const fresh = conversations.find(
        (conversation) =>
          conversation?.createdAt >= RUN_TIMESTAMP &&
          isTriadPair(conversation?.involvedCharacters),
      );
      if (fresh) {
        console.log(
          `[soul-triad] fresh archived sample ${fresh.id} createdAt=${new Date(fresh.createdAt).toISOString()} after ${attempts} polls`,
        );
        return fresh;
      }
      console.log(`[soul-triad] poll #${attempts}: ${conversations.length} recent conversations, no fresh triad sample yet`);
    } catch (error) {
      console.warn(`[soul-triad] poll #${attempts} failed: ${error.message ?? error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return undefined;
}

async function runEval() {
  await new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'eval:soul-triad', '--', `--since-created-at=${RUN_TIMESTAMP}`], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`eval:soul-triad exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

let resumeCalled = false;
try {
  console.log('[soul-triad] applying Convex pilot-control env');
  for (const [key, value] of Object.entries(PILOT_ENV)) {
    await convexEnvSet(key, value);
  }
  console.log('[soul-triad] calling testing:resume');
  await convexRun('testing:resume');
  resumeCalled = true;

  console.log('[soul-triad] calling school:coLocateSoulTriadForPilot');
  await convexRun('school:coLocateSoulTriadForPilot');

  const fresh = await pollForFreshSample();
  if (!fresh) {
    console.warn(`[soul-triad] timed out after ${TIMEOUT_MS}ms with no fresh archived triad sample.`);
    process.exitCode = 2;
  } else {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log('[soul-triad] running npm run eval:soul-triad');
    await runEval();
  }
} catch (error) {
  console.error(`[soul-triad] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = process.exitCode || 1;
} finally {
  for (const key of Object.keys(PILOT_ENV)) delete process.env[key];
  console.log('[soul-triad] removing Convex pilot-control env');
  for (const key of Object.keys(PILOT_ENV).reverse()) {
    try {
      await convexEnvRemove(key);
    } catch (error) {
      console.warn(`[soul-triad] failed to remove ${key}: ${error.message ?? error}`);
    }
  }
  if (resumeCalled) {
    try {
      await convexRun('testing:stop');
      console.log('[soul-triad] testing:stop OK');
    } catch (error) {
      console.warn(`[soul-triad] testing:stop failed: ${error.message ?? error}`);
    }
  }
}

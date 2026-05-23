#!/usr/bin/env node
// Single-sample Umi x Mahiru Qwen pilot runner.
//
// Sets only the three safe pilot-control Convex env vars that the agent layer
// reads, kicks off a co-located pilot conversation, polls the eval data until one
// archived Umi/Mahiru sample lands after the run timestamp, then runs the eval
// harness once and cleans up. Assumes UMI_MAHIRU_PILOT_PROVIDER /
// UMI_MAHIRU_PILOT_API_KEY are already configured on the backend; this script
// does NOT read or print secrets and never touches `key.md`.
//
// Usage:
//   node scripts/run-umi-mahiru-single-sample.mjs [--timeout-ms=240000]
//
// Notes:
// - This intentionally uses `npx convex env set/remove` for safe pilot-control
//   vars. Process-local env is not enough for a running Convex backend.
// - Cleanup always runs in `finally`. The fallback cleanup mutation is only
//   triggered if the script could not confirm the pilot is no longer active.

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
const WORLD_ID = process.env.UMI_MAHIRU_WORLD_ID ?? 'md7cefps8wz097yk9k44n92rj1870x6c';

const PILOT_ENV = {
  UMI_MAHIRU_SINGLE_SAMPLE_AFTER_MS: String(RUN_TIMESTAMP),
  UMI_MAHIRU_COLOCATION_PILOT: 'true',
  AUTONOMOUS_CONVERSATION_LLM_PAIRS: 'Umi:Mahiru Shiina',
};

for (const [key, value] of Object.entries(PILOT_ENV)) {
  process.env[key] = value;
}

console.log(
  `[single-sample] starting at ${new Date(RUN_TIMESTAMP).toISOString()} ` +
    `(timestamp=${RUN_TIMESTAMP}, timeout=${TIMEOUT_MS}ms, poll=${POLL_INTERVAL_MS}ms)`,
);
console.log('[single-sample] pilot-control env to apply:');
for (const [key, value] of Object.entries(PILOT_ENV)) {
  console.log(`  ${key}=${value}`);
}

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
  const openers = new Set(['{', '[']);
  const closers = { '{': '}', '[': ']' };
  const candidates = [];
  for (let start = 0; start < stdout.length; start += 1) {
    const first = stdout[start];
    if (!openers.has(first)) continue;
    const stack = [closers[first]];
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
        stack.push(closers[char]);
      } else if (char === stack.at(-1)) {
        stack.pop();
        if (!stack.length) {
          candidates.push(stdout.slice(start, index + 1));
          break;
        }
      }
    }
  }
  candidates.sort((a, b) => b.length - a.length);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Keep scanning; convex logs can be interleaved with JSON.
    }
  }
  return undefined;
}

function isUmiMahiruPair(names) {
  const set = new Set(names ?? []);
  const hasUmi = set.has('海') || set.has('Umi') || set.has('朝凪海');
  const hasMahiru =
    set.has('真晝') || set.has('Mahiru') || set.has('Mahiru Shiina') || set.has('椎名真晝');
  return hasUmi && hasMahiru;
}

async function pollForFreshSample() {
  const deadline = Date.now() + TIMEOUT_MS;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    try {
      const data = await convexRun('school:recentConversationEvalData', {
        limit: 12,
        compact: true,
        messagesPerConversation: 3,
        sinceCreatedAt: RUN_TIMESTAMP,
      });
      const conversations = Array.isArray(data?.conversations) ? data.conversations : [];
      const fresh = conversations.find(
        (conversation) =>
          conversation?.createdAt >= RUN_TIMESTAMP &&
          isUmiMahiruPair(conversation?.involvedCharacters),
      );
      if (fresh) {
        console.log(
          `[single-sample] fresh archived sample ${fresh.id} createdAt=${new Date(fresh.createdAt).toISOString()} after ${attempts} polls`,
        );
        return fresh;
      }
      console.log(
        `[single-sample] poll #${attempts}: ${conversations.length} recent conversations, no fresh Umi/Mahiru yet`,
      );
    } catch (error) {
      console.warn(`[single-sample] poll #${attempts} failed: ${error.message ?? error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return undefined;
}

async function activeUmiMahiruConversationId() {
  try {
    const state = await convexRun('world:worldState', { worldId: WORLD_ID });
    const conversations = state?.world?.conversations ?? [];
    const active = conversations.find((conversation) => {
      const participantIds = (conversation.participants ?? []).map((p) => p.playerId);
      return (
        participantIds.length === 2 &&
        participantIds.includes('p:0') &&
        participantIds.includes('p:707')
      );
    });
    return active?.id;
  } catch (error) {
    console.warn(`[single-sample] could not query world state: ${error.message ?? error}`);
    return null;
  }
}

async function runEval() {
  await new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'eval:umi-mahiru'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`eval:umi-mahiru exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

let resumeCalled = false;
try {
  console.log('[single-sample] applying Convex pilot-control env');
  for (const [key, value] of Object.entries(PILOT_ENV)) {
    await convexEnvSet(key, value);
  }

  console.log('[single-sample] calling testing:resume');
  await convexRun('testing:resume');
  resumeCalled = true;

  console.log('[single-sample] calling school:coLocateUmiMahiruForPilot');
  await convexRun('school:coLocateUmiMahiruForPilot');

  const fresh = await pollForFreshSample();
  if (!fresh) {
    console.warn(
      `[single-sample] timed out after ${TIMEOUT_MS}ms with no fresh archived Umi/Mahiru sample.`,
    );
    process.exitCode = 2;
  } else {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log('[single-sample] running npm run eval:umi-mahiru');
    await runEval();
  }
} catch (error) {
  console.error(`[single-sample] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = process.exitCode || 1;
} finally {
  for (const key of Object.keys(PILOT_ENV)) {
    delete process.env[key];
  }
  console.log('[single-sample] removing Convex pilot-control env');
  for (const key of Object.keys(PILOT_ENV).reverse()) {
    try {
      await convexEnvRemove(key);
    } catch (error) {
      console.warn(`[single-sample] failed to remove ${key}: ${error.message ?? error}`);
    }
  }
  if (resumeCalled) {
    try {
      await convexRun('testing:stop');
      console.log('[single-sample] testing:stop OK');
    } catch (error) {
      console.warn(`[single-sample] testing:stop failed: ${error.message ?? error}`);
    }
  }
  let activeId;
  try {
    activeId = await activeUmiMahiruConversationId();
  } catch (error) {
    activeId = undefined;
  }
  const shouldCleanup = activeId !== undefined;
  if (shouldCleanup) {
    console.log(
      `[single-sample] active pilot ${activeId ?? '<unknown/unchecked>'} still present or unchecked; cleaning up`,
    );
    try {
      const result = await convexRun('school:cleanupActiveUmiMahiruFallbackConversation', {
        dryRun: false,
        force: true,
      });
      console.log(`[single-sample] cleanup result: ${JSON.stringify(result)}`);
    } catch (error) {
      console.warn(`[single-sample] cleanup failed: ${error.message ?? error}`);
    }
  } else {
    console.log('[single-sample] confirmed no active Umi/Mahiru pilot; skipping cleanup');
  }
}

#!/usr/bin/env node
// Disposable local-Qwen dialogue probe.
//
// Purpose:
// - Temporarily test a stronger local Ollama model on real Underworld plumbing.
// - Keep the world from retaining test pollution by cleaning fresh archived
//   conversations/memories after the run unless --keep=true is passed.

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

const MODEL = args.get('model') ?? 'qwen2.5:7b';
const TIMEOUT_MS = Number(args.get('timeout-ms') ?? 180_000);
const POLL_INTERVAL_MS = Number(args.get('poll-interval-ms') ?? 6_000);
const TARGET_SAMPLES = Number(args.get('samples') ?? 1);
const KEEP = args.get('keep') === 'true';
const FOCUS_PAIR = (args.get('focus-pair') ?? 'Mahiru:Tianze').trim();
const RUN_TIMESTAMP = Date.now();
const [LEFT_NAME, RIGHT_NAME] = FOCUS_PAIR.split(':').map((name) => name.trim());
if (!LEFT_NAME || !RIGHT_NAME) {
  console.error('[local-qwen-disposable] --focus-pair must look like "Name:Name"');
  process.exit(1);
}

function log(message) {
  console.log(`[local-qwen-disposable] ${message}`);
}

function parseJsonFromStdout(stdout) {
  const first = stdout.indexOf('{');
  const last = stdout.lastIndexOf('}');
  if (first < 0 || last < first) return undefined;
  return JSON.parse(stdout.slice(first, last + 1));
}

async function convexRun(functionName, payload, options = {}) {
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
    maxBuffer: 1024 * 1024 * 20,
    timeout: options.timeout ?? 90_000,
    env: process.env,
  });
  return parseJsonFromStdout(stdout);
}

async function convexEnvGet(key) {
  try {
    const { stdout } = await execFileAsync('npx', ['convex', 'env', 'get', key], {
      cwd: REPO_ROOT,
      maxBuffer: 1024 * 1024,
      timeout: 45_000,
      env: process.env,
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

async function convexEnvSet(key, value) {
  const { stdout } = await execFileAsync('npx', ['convex', 'env', 'set', key, value], {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024,
    timeout: 45_000,
    env: process.env,
  });
  if (stdout.trim()) log(stdout.trim());
}

async function convexEnvRemove(key) {
  try {
    const { stdout } = await execFileAsync('npx', ['convex', 'env', 'remove', key], {
      cwd: REPO_ROOT,
      maxBuffer: 1024 * 1024,
      timeout: 45_000,
      env: process.env,
    });
    if (stdout.trim()) log(stdout.trim());
  } catch (error) {
    const message = `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`;
    if (/not set|does not exist|not found/i.test(message)) return;
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, commandArgs, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: options.stdio ?? 'inherit',
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function collectFreshConversationIds() {
  const data = await convexRun('school:recentConversationEvalData', { limit: 20 });
  return (data?.conversations ?? [])
    .filter((conversation) => conversation.createdAt >= RUN_TIMESTAMP)
    .map((conversation) => conversation.id);
}

async function pollForSamples() {
  const deadline = Date.now() + TIMEOUT_MS;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    const conversationIds = await collectFreshConversationIds();
    const uniqueIds = [...new Set(conversationIds)];
    log(`poll #${attempts}: fresh archived samples=${uniqueIds.length}`);
    if (uniqueIds.length >= TARGET_SAMPLES) return uniqueIds.slice(0, TARGET_SAMPLES);
    await convexRun('world:defaultWorldStatus').catch(() => undefined);
    await sleep(POLL_INTERVAL_MS);
  }
  return [];
}

async function main() {
  log(
    `starting model=${MODEL} keep=${KEEP} focusPair=${FOCUS_PAIR} samples=${TARGET_SAMPLES} timestamp=${RUN_TIMESTAMP}`,
  );
  const previousEnv = {
    OLLAMA_MODEL: await convexEnvGet('OLLAMA_MODEL'),
    AUTONOMOUS_CONVERSATION_LLM: await convexEnvGet('AUTONOMOUS_CONVERSATION_LLM'),
    AUTONOMOUS_CONVERSATION_LLM_PAIRS: await convexEnvGet('AUTONOMOUS_CONVERSATION_LLM_PAIRS'),
    SOUL_TRIAD_FOCUS_PAIR: await convexEnvGet('SOUL_TRIAD_FOCUS_PAIR'),
  };
  const generatedConversationIds = [];

  try {
    await convexEnvSet('OLLAMA_MODEL', MODEL);
    await convexEnvSet('AUTONOMOUS_CONVERSATION_LLM', 'false');
    await convexEnvSet('AUTONOMOUS_CONVERSATION_LLM_PAIRS', FOCUS_PAIR);
    await convexEnvSet('SOUL_TRIAD_FOCUS_PAIR', FOCUS_PAIR);

    await convexRun('testing:resume');
    const coLocation = await convexRun('school:coLocateCharactersForTest', {
      leftName: LEFT_NAME,
      rightName: RIGHT_NAME,
    });
    if (coLocation?.locationZh) {
      log(`co-located pair at ${coLocation.locationZh}`);
    }
    await convexRun('school:startConversationByCharacterNamesForTest', {
      leftName: LEFT_NAME,
      rightName: RIGHT_NAME,
    });
    generatedConversationIds.push(...(await pollForSamples()));
    await convexRun('testing:stop').catch(() => undefined);

    if (generatedConversationIds.length > 0) {
      log(`fresh sample ids: ${generatedConversationIds.join(', ')}`);
      await runCommand('npm', ['run', 'eval:conversation:recent', '--', '--since-last-change']);
      await runCommand('npm', [
        'run',
        'eval:soul-triad',
        '--',
        `--since-created-at=${RUN_TIMESTAMP}`,
      ]);
    } else {
      log('sample_pending: no fresh archived sample was collected.');
    }

    if (!KEEP && generatedConversationIds.length > 0) {
      const dryRun = await convexRun('school:cleanupArchivedConversationsById', {
        dryRun: true,
        conversationIds: generatedConversationIds,
        includeNearbyConversationOutcomes: true,
      });
      log(`cleanup dry-run: ${JSON.stringify(dryRun)}`);
      const applied = await convexRun('school:cleanupArchivedConversationsById', {
        dryRun: false,
        conversationIds: generatedConversationIds,
        includeNearbyConversationOutcomes: true,
      });
      log(`cleanup applied: ${JSON.stringify(applied)}`);
    } else if (KEEP) {
      log('keep=true, leaving generated samples in DB.');
    }
  } finally {
    await convexRun('testing:stop').catch(() => undefined);
    if (previousEnv.OLLAMA_MODEL) await convexEnvSet('OLLAMA_MODEL', previousEnv.OLLAMA_MODEL);
    else await convexEnvRemove('OLLAMA_MODEL');

    if (previousEnv.AUTONOMOUS_CONVERSATION_LLM) {
      await convexEnvSet('AUTONOMOUS_CONVERSATION_LLM', previousEnv.AUTONOMOUS_CONVERSATION_LLM);
    } else {
      await convexEnvRemove('AUTONOMOUS_CONVERSATION_LLM');
    }

    if (previousEnv.AUTONOMOUS_CONVERSATION_LLM_PAIRS) {
      await convexEnvSet(
        'AUTONOMOUS_CONVERSATION_LLM_PAIRS',
        previousEnv.AUTONOMOUS_CONVERSATION_LLM_PAIRS,
      );
    } else {
      await convexEnvRemove('AUTONOMOUS_CONVERSATION_LLM_PAIRS');
    }

    if (previousEnv.SOUL_TRIAD_FOCUS_PAIR) {
      await convexEnvSet('SOUL_TRIAD_FOCUS_PAIR', previousEnv.SOUL_TRIAD_FOCUS_PAIR);
    } else {
      await convexEnvRemove('SOUL_TRIAD_FOCUS_PAIR');
    }
  }
}

main().catch((error) => {
  console.error(`[local-qwen-disposable] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = 1;
});

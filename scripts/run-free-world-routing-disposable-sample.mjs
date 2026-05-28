#!/usr/bin/env node
// Disposable free-world routing probe.
//
// Purpose:
// - Verify real world plumbing for the v0.1 routing policy:
//   main-three speakers (Umi / Mahiru / Asuna) are cloud-first,
//   other autonomous speakers are local LLM.
// - Avoid test pollution by cleaning fresh archived conversations/memories
//   after the run unless --keep=true is passed.
//
// This script never reads or prints provider secrets.

import { execFile } from 'node:child_process';
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

const FOCUS_PAIR = (args.get('focus-pair') ?? 'Asuna:Liu Bei').trim();
const [LEFT_NAME, RIGHT_NAME] = FOCUS_PAIR.split(':').map((name) => name.trim());
const TIMEOUT_MS = Number(args.get('timeout-ms') ?? 180_000);
const POLL_INTERVAL_MS = Number(args.get('poll-interval-ms') ?? 7_000);
const KEEP = args.get('keep') === 'true';
const RUN_TIMESTAMP = Date.now();
const LOCAL_LLM_PREFLIGHT_ARG = args.get('local-llm-preflight');
const RUN_SOUL_TRIAD_EVAL = args.get('soul-triad-eval') !== 'false';

if (!LEFT_NAME || !RIGHT_NAME) {
  console.error('[free-world-routing] --focus-pair must look like "Name:Name"');
  process.exit(1);
}

const FREE_WORLD_CLOUD_CHARACTER_NAMES = new Set(['umi', 'mahirushiina', 'asuna']);

function normalizedCharacterName(name) {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isCoreCloudPair(leftName, rightName) {
  return (
    FREE_WORLD_CLOUD_CHARACTER_NAMES.has(normalizedCharacterName(leftName)) &&
    FREE_WORLD_CLOUD_CHARACTER_NAMES.has(normalizedCharacterName(rightName))
  );
}

const LOCAL_LLM_PREFLIGHT =
  LOCAL_LLM_PREFLIGHT_ARG === undefined
    ? !isCoreCloudPair(LEFT_NAME, RIGHT_NAME)
    : LOCAL_LLM_PREFLIGHT_ARG !== 'false';

function log(message) {
  console.log(`[free-world-routing] ${message}`);
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

async function runCommand(command, commandArgs) {
  try {
    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      cwd: REPO_ROOT,
      env: process.env,
      maxBuffer: 1024 * 1024 * 20,
      timeout: TIMEOUT_MS + 90_000,
    });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    return 0;
  } catch (error) {
    if (error.stdout) process.stdout.write(String(error.stdout));
    if (error.stderr) process.stderr.write(String(error.stderr));
    return typeof error.code === 'number' ? error.code : 1;
  }
}

async function runEvalCommand(label, commandArgs) {
  const code = await runCommand('npm', commandArgs);
  log(`${label}ExitCode=${code}`);
  return code;
}

async function assertLocalLlmReady(localModel) {
  if (!LOCAL_LLM_PREFLIGHT) return;
  if (!localModel) {
    throw new Error(
      'OLLAMA_MODEL is not configured; free-world local speakers would not have a local LLM.',
    );
  }
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      throw new Error(`Ollama /api/tags returned HTTP ${response.status}`);
    }
    log('local LLM preflight OK');
  } catch (error) {
    throw new Error(
      `local LLM preflight failed: ${error.message ?? error}. Start Ollama with ./umi/run_ollama_native.sh before running this probe.`,
    );
  }
}

async function assertCoreCloudProviderReady(provider) {
  if (!isCoreCloudPair(LEFT_NAME, RIGHT_NAME)) return;
  const normalizedProvider = String(provider ?? '').toLowerCase();
  if (!normalizedProvider) {
    throw new Error('core cloud pair requires UMI_MAHIRU_PILOT_PROVIDER to be configured.');
  }
  if (normalizedProvider === 'gemini') {
    const pilotKey = await convexEnvGet('UMI_MAHIRU_PILOT_API_KEY');
    const geminiKey = await convexEnvGet('GEMINI_API_KEY');
    if (!pilotKey && !geminiKey) {
      throw new Error(
        'core cloud pair uses gemini but no UMI_MAHIRU_PILOT_API_KEY or GEMINI_API_KEY is configured.',
      );
    }
    log('core cloud provider preflight OK');
    return;
  }
  const pilotKey = await convexEnvGet('UMI_MAHIRU_PILOT_API_KEY');
  if (!pilotKey) {
    throw new Error(
      `core cloud pair uses ${normalizedProvider} but UMI_MAHIRU_PILOT_API_KEY is not configured.`,
    );
  }
  log('core cloud provider preflight OK');
}

function messageText(message) {
  if (typeof message === 'string') return message;
  return typeof message?.text === 'string'
    ? message.text
    : typeof message?.content === 'string'
      ? message.content
      : '';
}

function nameAliases(name) {
  const aliases = new Set([name]);
  if (name === 'Umi') aliases.add('海').add('朝凪海');
  if (name === 'Mahiru') aliases.add('Mahiru').add('真晝').add('椎名真晝');
  if (name === 'Asuna') aliases.add('明日奈').add('結城明日奈');
  if (name === 'Liu Bei') aliases.add('LiuBei').add('劉備');
  if (name === 'Mai') aliases.add('麻衣').add('櫻島麻衣');
  if (name === 'CaoCao') aliases.add('Cao Cao').add('曹操');
  return aliases;
}

const LEFT_ALIASES = nameAliases(LEFT_NAME);
const RIGHT_ALIASES = nameAliases(RIGHT_NAME);

function includesAnyAlias(names, aliases) {
  return [...names].some((name) => aliases.has(name));
}

async function pollForFreshSample(worldId) {
  const deadline = Date.now() + TIMEOUT_MS;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    if (worldId) await convexRun('world:heartbeatWorld', { worldId }).catch(() => undefined);
    const data = await convexRun('school:recentConversationEvalData', {
      limit: 12,
      messagesPerConversation: 8,
      sinceCreatedAt: RUN_TIMESTAMP,
    });
    const conversations = Array.isArray(data?.conversations) ? data.conversations : [];
    const fresh = conversations.find((conversation) => {
      const names = new Set(conversation?.involvedCharacters ?? []);
      return (
        conversation?.createdAt >= RUN_TIMESTAMP &&
        includesAnyAlias(names, LEFT_ALIASES) &&
        includesAnyAlias(names, RIGHT_ALIASES)
      );
    });
    log(`poll #${attempts}: fresh archived conversations=${conversations.length}`);
    if (fresh) return fresh;
    await sleep(POLL_INTERVAL_MS);
  }
  return undefined;
}

async function restoreEnv(previousEnv) {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value) await convexEnvSet(key, value);
    else await convexEnvRemove(key);
  }
}

async function main() {
  log(`starting focusPair=${FOCUS_PAIR} keep=${KEEP} timestamp=${RUN_TIMESTAMP}`);
  const previousEnv = {
    AUTONOMOUS_CONVERSATION_LLM: await convexEnvGet('AUTONOMOUS_CONVERSATION_LLM'),
    SOUL_TRIAD_COLOCATION_PILOT: await convexEnvGet('SOUL_TRIAD_COLOCATION_PILOT'),
    SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS: await convexEnvGet('SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS'),
    SOUL_TRIAD_FOCUS_PAIR: await convexEnvGet('SOUL_TRIAD_FOCUS_PAIR'),
  };
  const provider = await convexEnvGet('UMI_MAHIRU_PILOT_PROVIDER');
  const localModel = await convexEnvGet('OLLAMA_MODEL');
  log(
    `provider=${provider || '(unset)'} localModel=${localModel || '(unset)'} localPreflight=${LOCAL_LLM_PREFLIGHT}`,
  );
  await assertCoreCloudProviderReady(provider);
  await assertLocalLlmReady(localModel);

  let sample;
  try {
    await convexEnvSet('AUTONOMOUS_CONVERSATION_LLM', 'true');
    await convexEnvRemove('SOUL_TRIAD_COLOCATION_PILOT');
    await convexEnvRemove('SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS');
    await convexEnvRemove('SOUL_TRIAD_FOCUS_PAIR');

    await convexRun('testing:resume');
    const worldStatus = await convexRun('world:defaultWorldStatus');
    const worldId = worldStatus?.worldId;
    log(`world=${worldId} status=${worldStatus?.status}`);

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

    sample = await pollForFreshSample(worldId);
    await convexRun('testing:stop').catch(() => undefined);

    if (!sample) {
      log('sample_pending: no fresh archived sample was collected.');
      process.exitCode = 2;
      return;
    }

    const transcript = (sample.messages ?? [])
      .map((message) => messageText(message))
      .filter(Boolean)
      .join(' / ');
    log(`fresh sample ${sample.id}: ${(sample.involvedCharacters ?? []).join(' / ')}`);
    if (transcript) log(`transcript: ${transcript}`);
    log(`memoryTraces=${Array.isArray(sample.memoryTraces) ? sample.memoryTraces.length : 0}`);

    await runEvalCommand('recentEval', [
      'run',
      'eval:conversation:recent',
      '--',
      `--since-created-at=${RUN_TIMESTAMP}`,
    ]);
    if (RUN_SOUL_TRIAD_EVAL) {
      await runEvalCommand('soulTriadEval', [
        'run',
        'eval:soul-triad',
        '--',
        `--since-created-at=${RUN_TIMESTAMP}`,
      ]);
    }
  } finally {
    let cleanupError;
    await convexRun('testing:stop').catch(() => undefined);
    try {
      if (sample?.id && !KEEP) {
        const dryRun = await convexRun('school:cleanupArchivedConversationsById', {
          dryRun: true,
          conversationIds: [sample.id],
          includeNearbyConversationOutcomes: true,
        });
        log(`cleanup dry-run: ${JSON.stringify(dryRun)}`);
        const applied = await convexRun('school:cleanupArchivedConversationsById', {
          dryRun: false,
          conversationIds: [sample.id],
          includeNearbyConversationOutcomes: true,
        });
        log(`cleanup applied: ${JSON.stringify(applied)}`);
      } else if (sample?.id) {
        log('keep=true, leaving generated sample in DB.');
      }
    } catch (error) {
      cleanupError = error;
      console.warn(`[free-world-routing] cleanup failed before env restore: ${error.message ?? error}`);
    } finally {
      await restoreEnv(previousEnv);
    }
    if (cleanupError) {
      throw cleanupError;
    }
  }
}

main().catch((error) => {
  console.error(`[free-world-routing] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = 1;
});

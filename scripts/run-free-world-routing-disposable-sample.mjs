#!/usr/bin/env node
// Disposable free-world routing probe.
//
// Purpose:
// - Verify real world plumbing for the v0.1 routing policy:
//   main-three speakers (Umi / Mahiru / Tianze) are cloud-first,
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

const FOCUS_PAIR = (args.get('focus-pair') ?? 'Tianze:Sakiko').trim();
const [LEFT_NAME, RIGHT_NAME] = FOCUS_PAIR.split(':').map((name) => name.trim());
const TIMEOUT_MS = Number(args.get('timeout-ms') ?? 180_000);
const POLL_INTERVAL_MS = Number(args.get('poll-interval-ms') ?? 7_000);
const MIN_MESSAGES = Number(args.get('min-messages') ?? 2);
const KEEP = args.get('keep') === 'true';
const RUN_TIMESTAMP = Date.now();
const LOCAL_LLM_PREFLIGHT_ARG = args.get('local-llm-preflight');
const CLOUD_PREFLIGHT = args.get('cloud-preflight') !== 'false';
const RUN_SOUL_TRIAD_EVAL = args.get('soul-triad-eval') !== 'false';

if (!LEFT_NAME || !RIGHT_NAME) {
  console.error('[free-world-routing] --focus-pair must look like "Name:Name"');
  process.exit(1);
}

const FREE_WORLD_CLOUD_CHARACTER_NAMES = new Set([
  'umi',
  'mahiru',
  'mahirushiina',
  'tianze',
  'ichinose',
  'maomao',
  'sakiko',
]);
const ORIGINAL_TRIAD_CLOUD_CHARACTER_NAMES = new Set(['umi', 'mahiru', 'mahirushiina', 'tianze']);

function normalizedCharacterName(name) {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isCoreCloudPair(leftName, rightName) {
  return (
    FREE_WORLD_CLOUD_CHARACTER_NAMES.has(normalizedCharacterName(leftName)) &&
    FREE_WORLD_CLOUD_CHARACTER_NAMES.has(normalizedCharacterName(rightName))
  );
}

function isOriginalTriadCloudPair(leftName, rightName) {
  return (
    ORIGINAL_TRIAD_CLOUD_CHARACTER_NAMES.has(normalizedCharacterName(leftName)) &&
    ORIGINAL_TRIAD_CLOUD_CHARACTER_NAMES.has(normalizedCharacterName(rightName))
  );
}

function pairNeedsCloudPreflight(leftName, rightName) {
  return (
    FREE_WORLD_CLOUD_CHARACTER_NAMES.has(normalizedCharacterName(leftName)) ||
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
  if (!pairNeedsCloudPreflight(LEFT_NAME, RIGHT_NAME)) return;
  if (!CLOUD_PREFLIGHT) {
    log('core cloud provider preflight skipped by --cloud-preflight=false');
    return;
  }
  const normalizedProvider = String(provider ?? '').toLowerCase();
  if (!normalizedProvider) {
    throw new Error('core cloud pair requires UMI_MAHIRU_PILOT_PROVIDER to be configured.');
  }
  const configuredModel = await convexEnvGet('UMI_MAHIRU_PILOT_MODEL');
  if (normalizedProvider === 'gemini') {
    const pilotKey = await convexEnvGet('UMI_MAHIRU_PILOT_API_KEY');
    const geminiKey = await convexEnvGet('GEMINI_API_KEY');
    if (!pilotKey && !geminiKey) {
      throw new Error(
        'core cloud pair uses gemini but no UMI_MAHIRU_PILOT_API_KEY or GEMINI_API_KEY is configured.',
      );
    }
    await assertGeminiReady(pilotKey || geminiKey, configuredModel);
    log('core cloud provider preflight OK');
    return;
  }
  const pilotKey = await convexEnvGet('UMI_MAHIRU_PILOT_API_KEY');
  if (!pilotKey) {
    throw new Error(
      `core cloud pair uses ${normalizedProvider} but UMI_MAHIRU_PILOT_API_KEY is not configured.`,
    );
  }
  await assertOpenAiCompatibleReady(normalizedProvider, pilotKey, configuredModel);
  log('core cloud provider preflight OK');
}

function representativeSoulPrompt() {
  return [
    {
      role: 'system',
      content: [
        'GIIS Underworld v0.1 cloud provider preflight.',
        'Characters: 海(Umi), 真晝(Mahiru), 天澤(Tianze), 一之瀨(Ichinose), 貓貓(Maomao), 祥子(Sakiko).',
        'Goal: spoken dialogue only, Traditional Chinese, natural and short.',
        'Avoid fallback/template slogans, stage directions, over-analysis, and exact echo.',
        'Emotion should show through tone, attention, and small behavior.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: '天澤又想把關心變成壓力測試。請只回一句海會說的自然台詞，不要動作描寫。',
    },
  ];
}

function qwenModelName(model) {
  const configured = model || 'qwen-plus';
  return configured.startsWith('qwen/') ? configured.slice('qwen/'.length) : configured;
}

function openAiCompatibleChatCompletionsUrl(baseUrl) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function geminiModelName(model) {
  const configured = model || 'gemini-2.5-flash';
  return configured.startsWith('gemini/') ? configured.slice('gemini/'.length) : configured;
}

async function assertOpenAiCompatibleReady(provider, key, configuredModel) {
  const baseUrl = (
    (await convexEnvGet('UMI_MAHIRU_PILOT_BASE_URL')) ||
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/+$/, '');
  const response = await fetch(openAiCompatibleChatCompletionsUrl(baseUrl), {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: qwenModelName(configuredModel),
      messages: representativeSoulPrompt(),
      temperature: 0.2,
      max_tokens: 48,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `core cloud provider preflight failed: ${provider} HTTP ${response.status}: ${text.slice(0, 300)}`,
    );
  }
  const json = JSON.parse(text);
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`core cloud provider preflight failed: ${provider} returned no chat text`);
  }
}

async function assertGeminiReady(key, configuredModel) {
  const prompt = representativeSoulPrompt();
  const systemText = prompt
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n');
  const userText = prompt
    .filter((message) => message.role !== 'system')
    .map((message) => message.content)
    .join('\n');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName(configuredModel)}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 48 },
      }),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`core cloud provider preflight failed: Gemini HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text);
  const content =
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim() ?? '';
  if (!content) {
    throw new Error('core cloud provider preflight failed: Gemini returned no chat text');
  }
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
  if (name === 'Tianze') aliases.add('天澤');
  if (name === 'Sakiko') aliases.add('Sakiko').add('祥子');
  if (name === 'Ichinose') aliases.add('一之瀨');
  if (name === 'Maomao') aliases.add('Maomao').add('貓貓');
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
      const messageCount =
        typeof conversation?.messageCount === 'number'
          ? conversation.messageCount
          : Array.isArray(conversation?.transcriptMessages)
            ? conversation.transcriptMessages.length
            : Array.isArray(conversation?.messages)
              ? conversation.messages.length
              : 0;
      return (
        conversation?.createdAt >= RUN_TIMESTAMP &&
        messageCount >= MIN_MESSAGES &&
        includesAnyAlias(names, LEFT_ALIASES) &&
        includesAnyAlias(names, RIGHT_ALIASES)
      );
    });
    log(`poll #${attempts}: fresh conversations=${conversations.length}; waiting for ${MIN_MESSAGES}+ focus messages`);
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
    AUTONOMOUS_CONVERSATION_LLM_PAIRS: await convexEnvGet('AUTONOMOUS_CONVERSATION_LLM_PAIRS'),
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
  let shouldResumeWorld = false;
  try {
    if (isCoreCloudPair(LEFT_NAME, RIGHT_NAME)) {
      await convexEnvSet('AUTONOMOUS_CONVERSATION_LLM', 'false');
      await convexEnvSet('AUTONOMOUS_CONVERSATION_LLM_PAIRS', 'Umi:Mahiru,Umi:Tianze,Mahiru:Tianze,Tianze:Ichinose');
    } else {
      await convexEnvSet('AUTONOMOUS_CONVERSATION_LLM', 'true');
      await convexEnvSet('AUTONOMOUS_CONVERSATION_LLM_PAIRS', 'Umi:Mahiru,Umi:Tianze,Mahiru:Tianze,Tianze:Ichinose');
    }
    await convexEnvRemove('SOUL_TRIAD_COLOCATION_PILOT');
    await convexEnvRemove('SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS');
    await convexEnvRemove('SOUL_TRIAD_FOCUS_PAIR');

    await convexRun('testing:resume');
    const worldStatus = await convexRun('world:defaultWorldStatus');
    const worldId = worldStatus?.worldId;
    shouldResumeWorld = worldStatus?.status === 'running';
    log(`world=${worldId} status=${worldStatus?.status}`);

    const coLocation = await convexRun('school:coLocateCharactersForTest', {
      leftName: LEFT_NAME,
      rightName: RIGHT_NAME,
      kick: false,
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

    const transcriptMessages = sample.transcriptMessages ?? sample.messages ?? [];
    const transcript = transcriptMessages
      .map((message) => {
        const text = messageText(message);
        if (!text) return '';
        return message?.author ? `${message.author}: ${text}` : text;
      })
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
      if (!KEEP) {
        const activeCleanup = await convexRun(
          'school:cleanupActiveConversationsByCharacterNamesForTest',
          { dryRun: false, targetNames: [LEFT_NAME, RIGHT_NAME] },
        ).catch((error) => {
          console.warn(
            `[free-world-routing] active-conversation cleanup failed: ${error.message ?? error}`,
          );
          return undefined;
        });
        if (activeCleanup) log(`active cleanup: ${JSON.stringify(activeCleanup)}`);
      }
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
      if (shouldResumeWorld) {
        await convexRun('testing:resume').catch((error) => {
          console.warn(`[free-world-routing] world resume failed after cleanup: ${error.message ?? error}`);
        });
      }
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

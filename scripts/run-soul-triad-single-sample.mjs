#!/usr/bin/env node
// Single-sample Umi x Mahiru x Tianze Qwen pilot runner.
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

process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS =
  process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180';
process.env.CONVERSATION_EVAL_CONVEX_TIMEOUT_MS =
  process.env.CONVERSATION_EVAL_CONVEX_TIMEOUT_MS ?? '180000';

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
const SELF_TEST = args.get('self-test') === 'true';
const TIMEOUT_MS = Number(args.get('timeout-ms') ?? 240_000);
const POLL_INTERVAL_MS = Number(args.get('poll-interval-ms') ?? 7_000);
const PAIR_COOLDOWN_MS = Number(args.get('pair-cooldown-ms') ?? 60_000);
const PROVIDER_COOLDOWN_MS = Number(args.get('provider-cooldown-ms') ?? 10 * 60_000);
const CLOUD_PREFLIGHT = args.get('cloud-preflight') !== 'false';
const RUN_TIMESTAMP = Date.now();
// Optional --focus-pair="Name:Name" (e.g. "Mahiru:Tianze") restricts this
// run to a single dyad so callers can rotate coverage and stop Mahiru from being
// starved by the Umi<->Tianze mutual-first-choice attractor. Empty == default.
const FOCUS_PAIR = (args.get('focus-pair') ?? '').trim();
const FOCUS_PAIR_NAMES = FOCUS_PAIR.split(':')
  .map((name) => name.trim())
  .filter(Boolean);
const FOCUS_PAIR_KEY = pairKey(FOCUS_PAIR_NAMES);

const PILOT_ENV = {
  SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS: String(RUN_TIMESTAMP),
  SOUL_TRIAD_COLOCATION_PILOT: 'true',
  SOUL_TRIAD_FOCUS_PAIR: FOCUS_PAIR,
  AUTONOMOUS_CONVERSATION_LLM: 'true',
  AUTONOMOUS_CONVERSATION_LLM_PAIRS: 'Umi:Mahiru,Umi:Tianze,Mahiru:Tianze,Tianze:Ichinose',
  UMI_MAHIRU_PILOT_TIMEOUT_MS: '60000',
  UMI_MAHIRU_PILOT_COOLDOWN_FAILURES: '1',
  UMI_MAHIRU_PILOT_COOLDOWN_MS: String(PROVIDER_COOLDOWN_MS),
  SOUL_PILOT_PAIR_COOLDOWN_MS: String(PAIR_COOLDOWN_MS),
};

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

for (const [key, value] of Object.entries(PILOT_ENV)) {
  process.env[key] = value;
}

console.log(
  `[soul-triad] starting at ${new Date(RUN_TIMESTAMP).toISOString()} ` +
    `(timestamp=${RUN_TIMESTAMP}, timeout=${TIMEOUT_MS}ms, poll=${POLL_INTERVAL_MS}ms` +
    `, pairCooldown=${PAIR_COOLDOWN_MS}ms` +
    `, providerCooldown=${PROVIDER_COOLDOWN_MS}ms` +
    `, cloudPreflight=${CLOUD_PREFLIGHT}` +
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

async function convexEnvGet(key) {
  try {
    const { stdout } = await execFileAsync('npx', ['convex', 'env', 'get', key], {
      cwd: REPO_ROOT,
      maxBuffer: 1024 * 1024,
      timeout: 45_000,
      env: process.env,
    });
    return stdout.trim();
  } catch (error) {
    const message = `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`;
    if (/not found|not set|does not exist/i.test(message)) return undefined;
    throw error;
  }
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

let heartbeatWorldId;
async function heartbeatDefaultWorld() {
  if (!heartbeatWorldId) {
    const worldStatus = await convexRun('world:defaultWorldStatus');
    heartbeatWorldId = worldStatus?.worldId;
  }
  if (!heartbeatWorldId) return;
  await convexRun('world:heartbeatWorld', { worldId: heartbeatWorldId });
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

function convexEnvRestoreAction(previousValue) {
  return previousValue === undefined ? 'remove' : 'set';
}

function restoreWorldCommandForStatus(previousStatus) {
  return previousStatus === 'running' || previousStatus === undefined
    ? 'testing:resume'
    : 'testing:stop';
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function representativeSoulPrompt() {
  const soulContext = [
    'GIIS Underworld v0.1 cloud provider preflight.',
    'Characters: 海(Umi), 真晝(Mahiru), 天澤(Tianze), 一之瀨(Ichinose).',
    'Goal: spoken dialogue only, Traditional Chinese, natural and short.',
    '海 organizes chaos for Alan but hides fatigue behind usefulness.',
    '真晝 notices quiet pain and checks emotional safety.',
    '天澤 pressure-tests weak rules with safe little-devil teasing and learns where to stop before harm.',
    '一之瀨 keeps a cute big-sister surface while turning warmth into boundary, debt, and safe intimate pressure.',
    'Avoid fallback/template slogans, stage directions, over-analysis, and exact echo.',
    'Emotion should show through tone, attention, and small behavior.',
    'Memory residue should be concrete, not a slogan.',
  ].join('\n');
  return [
    { role: 'system', content: soulContext },
    {
      role: 'user',
      content:
        '真晝發現海又把 Alan 的事情整理到很晚。請只回一句真晝會說的自然台詞，不要動作描寫。',
    },
  ];
}

function qwenModelName(model) {
  const configured = model || 'qwen3-max';
  return configured.startsWith('qwen/') ? configured.slice('qwen/'.length) : configured;
}

function geminiModelName(model) {
  const configured = model || 'gemini-2.5-flash';
  return configured.startsWith('gemini/') ? configured.slice('gemini/'.length) : configured;
}

async function cloudProviderPreflight() {
  if (!CLOUD_PREFLIGHT) {
    console.log('[soul-triad] cloud provider preflight skipped by --cloud-preflight=false');
    return;
  }
  const provider = (await convexEnvGet('UMI_MAHIRU_PILOT_PROVIDER'))?.toLowerCase();
  const configuredModel = await convexEnvGet('UMI_MAHIRU_PILOT_MODEL');
  if (!provider) throw new Error('cloud provider preflight failed: UMI_MAHIRU_PILOT_PROVIDER is not configured');
  if (provider === 'gemini') {
    const key = (await convexEnvGet('UMI_MAHIRU_PILOT_API_KEY')) || (await convexEnvGet('GEMINI_API_KEY'));
    if (!key) throw new Error('cloud provider preflight failed: Gemini key is not configured');
    const systemText = representativeSoulPrompt()
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');
    const userText = representativeSoulPrompt()
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
      throw new Error(`cloud provider preflight failed: Gemini HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    const json = JSON.parse(text);
    const content =
      json.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim() ?? '';
    if (!content) {
      throw new Error('cloud provider preflight failed: Gemini returned no chat text');
    }
    console.log('[soul-triad] cloud provider preflight OK (gemini)');
    return;
  }
  const key = await convexEnvGet('UMI_MAHIRU_PILOT_API_KEY');
  if (!key) throw new Error(`cloud provider preflight failed: ${provider} key is not configured`);
  const baseUrl = ((await convexEnvGet('UMI_MAHIRU_PILOT_BASE_URL')) || 'https://api.newcoin.top').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
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
    throw new Error(`cloud provider preflight failed: ${provider} HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text);
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`cloud provider preflight failed: ${provider} returned no chat text`);
  }
  console.log(`[soul-triad] cloud provider preflight OK (${provider})`);
}

function runSelfTest() {
  assertEqual(
    Object.prototype.hasOwnProperty.call(PILOT_ENV, 'AUTONOMOUS_CONVERSATION_LLM'),
    true,
    'single-sample pilot temporarily enables autonomous LLM conversations',
  );
  assertEqual(
    Object.prototype.hasOwnProperty.call(PILOT_ENV, 'SOUL_TRIAD_FOCUS_PAIR'),
    true,
    'focus pair env is always snapshotted and restored',
  );
  assertEqual(
    representativeSoulPrompt().length,
    2,
    'cloud preflight uses system and user messages',
  );
  assertEqual(qwenModelName('qwen/qwen3-max'), 'qwen3-max', 'qwen model prefix is stripped');
  assertEqual(geminiModelName('gemini/gemini-2.5-flash'), 'gemini-2.5-flash', 'gemini model prefix is stripped');
  assertEqual(pairKey(['Umi', 'Tianze']), '天澤:海', 'English focus pair normalizes to Chinese pair key');
  assertEqual(
    isExpectedFreshSample({
      involvedCharacters: ['海', '天澤'],
      transcriptMessages: [{}, {}, {}],
    }),
    FOCUS_PAIR_KEY ? FOCUS_PAIR_KEY === '天澤:海' : true,
    'expected sample requires focus pair and at least 3 messages',
  );
  assertEqual(
    isExpectedFreshSample({
      involvedCharacters: ['海', '天澤'],
      transcriptMessages: [{}, {}],
    }),
    false,
    'two-message triad sample is not enough for v0.1 evidence',
  );
  assertEqual(convexEnvRestoreAction(undefined), 'remove', 'missing Convex env is removed');
  assertEqual(convexEnvRestoreAction(''), 'set', 'empty Convex env value is restored');
  assertEqual(convexEnvRestoreAction('Umi:Mahiru'), 'set', 'existing Convex env value is restored');

  assertEqual(restoreWorldCommandForStatus('running'), 'testing:resume', 'running world resumes');
  assertEqual(restoreWorldCommandForStatus(undefined), 'testing:resume', 'unknown world defaults to resume');
  assertEqual(restoreWorldCommandForStatus('inactive'), 'testing:stop', 'inactive world stops');
  assertEqual(
    restoreWorldCommandForStatus('stoppedByDeveloper'),
    'testing:stop',
    'developer-stopped world stays stopped',
  );

  console.log('[soul-triad] self-test passed');
}

function isTriadPair(names) {
  const set = new Set(names ?? []);
  const count = ['海', '真晝', '天澤', 'Umi', 'Mahiru', 'Tianze']
    .filter((name) => set.has(name)).length;
  return count >= 2;
}

function normalizeCharacterName(name) {
  return (
    {
      Umi: '海',
      Mahiru: '真晝',
      Tianze: '天澤',
    }[name] ?? name
  );
}

function pairKey(names) {
  const normalized = (names ?? [])
    .map(normalizeCharacterName)
    .filter(Boolean)
    .sort();
  return normalized.length === 2 ? normalized.join(':') : '';
}

function conversationMessageCount(conversation) {
  return Number(conversation?.messageCount ?? conversation?.transcriptMessages?.length ?? 0);
}

function isExpectedFreshSample(conversation) {
  if (!conversation || !isTriadPair(conversation?.involvedCharacters)) return false;
  if (conversationMessageCount(conversation) < 3) return false;
  if (!FOCUS_PAIR_KEY) return true;
  return pairKey(conversation?.involvedCharacters) === FOCUS_PAIR_KEY;
}

async function pollForFreshSample() {
  const deadline = Date.now() + TIMEOUT_MS;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    try {
      await heartbeatDefaultWorld();
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
          isExpectedFreshSample(conversation),
      );
      if (fresh) {
        console.log(
          `[soul-triad] fresh archived sample ${fresh.id} createdAt=${new Date(fresh.createdAt).toISOString()} after ${attempts} polls`,
        );
        return fresh;
      }
      const ignored = conversations.filter(
        (conversation) => conversation?.createdAt >= RUN_TIMESTAMP && isTriadPair(conversation?.involvedCharacters),
      );
      const ignoredNote = ignored.length
        ? `; ignored ${ignored.length} fresh incomplete/non-focus triad candidate(s)`
        : '';
      console.log(
        `[soul-triad] poll #${attempts}: ${conversations.length} recent conversations, no expected fresh triad sample yet${ignoredNote}`,
      );
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
let previousWorldStatus;
const previousConvexEnv = new Map();
let convexPilotEnvApplied = false;
try {
  const worldStatus = await convexRun('world:defaultWorldStatus');
  previousWorldStatus = worldStatus?.status;
  await cloudProviderPreflight();
  console.log('[soul-triad] applying Convex pilot-control env');
  for (const key of Object.keys(PILOT_ENV)) {
    previousConvexEnv.set(key, await convexEnvGet(key));
  }
  for (const [key, value] of Object.entries(PILOT_ENV)) {
    await convexEnvSet(key, value);
  }
  convexPilotEnvApplied = true;
  console.log('[soul-triad] stopping world engine for controlled sample setup');
  await convexRun('testing:stop');
  resumeCalled = true;

  if (FOCUS_PAIR_NAMES.length === 2) {
    console.log(`[soul-triad] clearing active focus conversations (${FOCUS_PAIR_NAMES.join(':')})`);
    const activeCleanup = await convexRun(
      'school:cleanupActiveConversationsByCharacterNamesForTest',
      { dryRun: false, targetNames: FOCUS_PAIR_NAMES },
    );
    if (activeCleanup) console.log(`[soul-triad] active pre-cleanup: ${JSON.stringify(activeCleanup)}`);
    console.log(`[soul-triad] co-locating focus pair without engine kick (${FOCUS_PAIR_NAMES.join(':')})`);
    await convexRun('school:coLocateCharactersForTest', {
      leftName: FOCUS_PAIR_NAMES[0],
      rightName: FOCUS_PAIR_NAMES[1],
      kick: false,
    });
    console.log(`[soul-triad] enqueuing focus conversation (${FOCUS_PAIR_NAMES.join(':')})`);
    await convexRun('school:enqueueConversationByCharacterNamesForTest', {
      leftName: FOCUS_PAIR_NAMES[0],
      rightName: FOCUS_PAIR_NAMES[1],
      kick: true,
    });
    await heartbeatDefaultWorld();
  } else {
    console.log('[soul-triad] calling school:coLocateSoulTriadForPilot');
    await convexRun('school:coLocateSoulTriadForPilot');
    await heartbeatDefaultWorld();
  }

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
  // Clear any active triad/focus-pair conversation the harness forced into the
  // world before restoring env. This prevents a timed-out run from leaving a
  // zero-message active conversation that blocks the next sample attempt.
  try {
    const cleanupTargets = FOCUS_PAIR_NAMES.length === 2
      ? FOCUS_PAIR_NAMES
      : ['Umi', 'Mahiru', 'Tianze'];
    const activeCleanup = await convexRun(
      'school:cleanupActiveConversationsByCharacterNamesForTest',
      { dryRun: false, targetNames: cleanupTargets },
    );
    if (activeCleanup) console.log(`[soul-triad] active cleanup: ${JSON.stringify(activeCleanup)}`);
  } catch (error) {
    console.warn(`[soul-triad] active-conversation cleanup failed: ${error.message ?? error}`);
  }
  if (convexPilotEnvApplied) {
    console.log('[soul-triad] restoring Convex pilot-control env');
    for (const key of Object.keys(PILOT_ENV).reverse()) {
      try {
        const previousValue = previousConvexEnv.get(key);
        if (convexEnvRestoreAction(previousValue) === 'remove') await convexEnvRemove(key);
        else await convexEnvSet(key, previousValue);
      } catch (error) {
        console.warn(`[soul-triad] failed to restore ${key}: ${error.message ?? error}`);
      }
    }
  } else {
    console.log('[soul-triad] Convex pilot-control env was not applied');
  }
  if (resumeCalled) {
    try {
      if (restoreWorldCommandForStatus(previousWorldStatus) === 'testing:resume') {
        await convexRun('testing:resume');
        console.log('[soul-triad] restored world engine running');
      } else {
        await convexRun('testing:stop');
        console.log('[soul-triad] restored world engine stopped');
      }
    } catch (error) {
      console.warn(`[soul-triad] failed to restore world engine state: ${error.message ?? error}`);
    }
  }
}

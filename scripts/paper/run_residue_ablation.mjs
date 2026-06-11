#!/usr/bin/env node
// Run a bounded fresh residue READ-on/off ablation.
//
// This script changes only the Convex env var UNDERWORLD_RESIDUE_READ, collects
// fresh conversations for each arm, scores only conversations created after that
// arm's start time, restores the previous env value, then builds/analyzes a
// dataset. It is intentionally bounded by --samples-per-arm.

import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const args = parseArgs(process.argv.slice(2));
const SELF_TEST = args.get('selftest') === 'true' || args.get('self-test') === 'true';
const ALLOW_LEGACY_FORCED_PILOT = args.get('allow-legacy-forced-pilot') === 'true';
const SAMPLES_PER_ARM = numberArg('samples-per-arm', 3, 1, 20);
const SAMPLE_TIMEOUT_MS = numberArg('sample-timeout-ms', 240_000, 30_000, 600_000);
const SAMPLE_POLL_MS = numberArg('sample-poll-ms', 7_000, 1_000, 30_000);
const POST_COLLECTION_WAIT_MS = numberArg('post-collection-wait-ms', 30_000, 0, 180_000);
const PYTHON = args.get('python') ?? process.env.PAPER_PYTHON ?? 'python3';
const OUTDIR = resolve(
  REPO_ROOT,
  args.get('outdir') ?? join('docs', 'paper', 'results', `ablation-${timestampSlug()}`),
);
const ORDER = (args.get('order') ?? 'on,off')
  .split(',')
  .map((arm) => arm.trim())
  .filter(Boolean);
const VALID_ARMS = new Set(['on', 'off']);

if (ORDER.length !== 2 || ORDER.some((arm) => !VALID_ARMS.has(arm))) {
  throw new Error('--order must be a comma-separated two-arm sequence using on/off');
}

const COMMAND_ENV = {
  ...process.env,
  CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
    process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180',
  CONVERSATION_EVAL_CONVEX_TIMEOUT_MS: process.env.CONVERSATION_EVAL_CONVEX_TIMEOUT_MS ?? '180000',
};

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

if (!ALLOW_LEGACY_FORCED_PILOT) {
  console.error(
    '[paper-ablation] REFUSING legacy forced-pilot collection. ' +
      'Use paper:residue-arm-window after schedule/preregistration acceptance for the primary design. ' +
      'Pass --allow-legacy-forced-pilot only for explicitly labeled mechanism debugging.',
  );
  process.exit(2);
}

await main();

async function main() {
  await mkdir(OUTDIR, { recursive: true });
  await mkdir(join(OUTDIR, 'logs'), { recursive: true });

  const startedAt = Date.now();
  const previousResidueRead = await convexEnvGet('UNDERWORLD_RESIDUE_READ');
  const metadata = {
    startedAt,
    startedAtIso: new Date(startedAt).toISOString(),
    samplesPerArm: SAMPLES_PER_ARM,
    sampleTimeoutMs: SAMPLE_TIMEOUT_MS,
    samplePollMs: SAMPLE_POLL_MS,
    postCollectionWaitMs: POST_COLLECTION_WAIT_MS,
    order: ORDER,
    previousResidueRead,
    generationMetadata: generationMetadataSnapshot(),
    arms: [],
    restored: false,
  };
  await writeJson(join(OUTDIR, 'generation-metadata.json'), metadata.generationMetadata);

  console.log(`[paper-ablation] outdir=${relative(OUTDIR)}`);
  console.log(`[paper-ablation] previous UNDERWORLD_RESIDUE_READ=${previousResidueRead ?? '<unset>'}`);

  try {
    for (const arm of ORDER) {
      const condition = arm === 'on' ? 'residue_on' : 'residue_off';
      const armDir = join(OUTDIR, arm);
      await mkdir(armDir, { recursive: true });

      if (arm === 'on') {
        await convexEnvRemove('UNDERWORLD_RESIDUE_READ');
      } else {
        await convexEnvSet('UNDERWORLD_RESIDUE_READ', 'false');
      }
      const readback = await convexEnvGet('UNDERWORLD_RESIDUE_READ');
      const armStartMs = Date.now();
      const armMeta = {
        arm,
        condition,
        armStartMs,
        armStartIso: new Date(armStartMs).toISOString(),
        residueReadEnv: readback,
      };
      metadata.arms.push(armMeta);
      await writeJson(join(OUTDIR, 'metadata.json'), metadata);

      console.log(
        `[paper-ablation] ${arm}: condition=${condition} start=${armMeta.armStartIso} ` +
          `UNDERWORLD_RESIDUE_READ=${readback ?? '<unset>'}`,
      );

      await runLogged(
        'npm',
        [
          'run',
          'underworld:observe',
          '--',
          '--collect=force',
          '--cc=skip',
          `--target-samples=${SAMPLES_PER_ARM}`,
          `--sample-timeout-ms=${SAMPLE_TIMEOUT_MS}`,
          `--sample-poll-ms=${SAMPLE_POLL_MS}`,
          `--since-created-at=${armStartMs}`,
          '--require-archived=true',
        ],
        join(OUTDIR, 'logs', `${arm}-observe.log`),
        SAMPLE_TIMEOUT_MS * SAMPLES_PER_ARM + 240_000,
      );

      if (POST_COLLECTION_WAIT_MS > 0) {
        console.log(`[paper-ablation] ${arm}: waiting ${POST_COLLECTION_WAIT_MS}ms before final eval`);
        await new Promise((resolve) => setTimeout(resolve, POST_COLLECTION_WAIT_MS));
      }

      await runLogged(
        'npm',
        ['run', 'eval:soul-triad', '--', `--since-created-at=${armStartMs}`],
        join(OUTDIR, 'logs', `${arm}-eval-soul-triad.log`),
        180_000,
      );
      await cp(
        join(REPO_ROOT, 'evals', 'conversations', 'reports', 'soul-triad-latest.md'),
        join(armDir, 'soul-triad.md'),
      );

      const armEndMs = Date.now();
      armMeta.armEndMs = armEndMs;
      armMeta.armEndIso = new Date(armEndMs).toISOString();
      await writeJson(join(OUTDIR, 'metadata.json'), metadata);
      await runLogged(
        'npm',
        [
          'run',
          'underworld:rolling-continuity',
          '--',
          `--since-created-at=${armStartMs}`,
          `--until-created-at=${armEndMs}`,
          `--out=${relative(join(armDir, 'rolling-continuity.md'))}`,
        ],
        join(OUTDIR, 'logs', `${arm}-rolling-continuity.log`),
        120_000,
        { allowFailure: true },
      );

      await runLogged(
        'python3',
        [
          'scripts/paper/report_to_dataset.py',
          '--report',
          join(armDir, 'soul-triad.md'),
          '--condition',
          condition,
          '--out',
          join(armDir, 'dataset.json'),
          '--min-messages',
          '3',
          '--exclude-active',
          '--metadata-json',
          join(OUTDIR, 'generation-metadata.json'),
        ],
        join(OUTDIR, 'logs', `${arm}-report-to-dataset.log`),
        60_000,
      );
      await runLogged(
        'python3',
        [
          'scripts/paper/attach_rolling_callbacks.py',
          '--dataset',
          join(armDir, 'dataset.json'),
          '--rolling-report',
          join(armDir, 'rolling-continuity.md'),
          '--out',
          join(armDir, 'dataset.json'),
          '--mark-callback-window-zero',
        ],
        join(OUTDIR, 'logs', `${arm}-attach-callbacks.log`),
        60_000,
      );
      const records = JSON.parse(await readFile(join(armDir, 'dataset.json'), 'utf8'));
      armMeta.records = records.length;
      await writeJson(join(OUTDIR, 'metadata.json'), metadata);
      console.log(`[paper-ablation] ${arm}: parsed ${records.length} records`);
    }
  } finally {
    await restoreResidueRead(previousResidueRead);
    metadata.restored = true;
    metadata.restoredAt = Date.now();
    metadata.restoredAtIso = new Date(metadata.restoredAt).toISOString();
    metadata.finalResidueRead = await convexEnvGet('UNDERWORLD_RESIDUE_READ');
    await writeJson(join(OUTDIR, 'metadata.json'), metadata);
    console.log(`[paper-ablation] restored UNDERWORLD_RESIDUE_READ=${metadata.finalResidueRead ?? '<unset>'}`);
  }

  const datasetPaths = ORDER.map((arm) => join(OUTDIR, arm, 'dataset.json'));
  const merged = join(OUTDIR, 'dataset.json');
  await runLogged(
    'python3',
    ['scripts/paper/report_to_dataset.py', '--merge', ...datasetPaths, '--out', merged],
    join(OUTDIR, 'logs', 'merge-dataset.log'),
    60_000,
  );

  const mergedRecords = JSON.parse(await readFile(merged, 'utf8'));
  metadata.totalRecords = mergedRecords.length;
  if (mergedRecords.length === 0) {
    metadata.analysisSkipped = 'empty_publishable_dataset';
    await writeJson(join(OUTDIR, 'metadata.json'), metadata);
    await writeReadme(metadata, merged);
    console.log('[paper-ablation] no publishable records; analysis skipped');
    console.log(`[paper-ablation] complete: ${relative(OUTDIR)}`);
    return;
  }

  await runLogged(
    PYTHON,
    ['scripts/paper/analyze.py', '--dataset', merged, '--outdir', OUTDIR],
    join(OUTDIR, 'logs', 'analyze.log'),
    180_000,
  );

  await writeReadme(metadata, merged);
  console.log(`[paper-ablation] complete: ${relative(OUTDIR)}`);
}

async function writeReadme(metadata, datasetPath) {
  const summaryPath = join(OUTDIR, 'results', 'summary.md');
  const summary = await readFile(summaryPath, 'utf8').catch(() => '(summary missing)');
  const lines = [
    '# Residue READ Ablation Run',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Samples per arm requested: ${SAMPLES_PER_ARM}`,
    `Dataset: \`${relative(datasetPath)}\``,
    '',
    '## Arm Metadata',
    '',
    '| Arm | Condition | Start | UNDERWORLD_RESIDUE_READ | Parsed records |',
    '|---|---|---|---|---|',
    ...metadata.arms.map((arm) =>
      `| ${arm.arm} | ${arm.condition} | ${arm.armStartIso} | ${arm.residueReadEnv ?? '<unset>'} | ${arm.records ?? 0} |`,
    ),
    '',
    '## Notes',
    '',
    '- This is a fresh-conversation ablation: each arm is scored with `--since-created-at` set to that arm start.',
    '- The primary mechanism outcome is `rolling_callback`; callback labels are attached from the arm-scoped rolling-continuity report.',
    '- `human_aftertaste_score` is a saturated rule-based proxy in current pilots and should not be treated as the primary outcome.',
    '- `UNDERWORLD_RESIDUE_READ` was restored after the run.',
    '',
    '## Analysis Summary',
    '',
    summary,
  ];
  await writeFile(join(OUTDIR, 'README.md'), `${lines.join('\n')}\n`);
}

async function restoreResidueRead(previousValue) {
  if (previousValue === undefined) {
    await convexEnvRemove('UNDERWORLD_RESIDUE_READ');
  } else {
    await convexEnvSet('UNDERWORLD_RESIDUE_READ', previousValue);
  }
}

async function convexEnvGet(key) {
  const result = await runCaptured('npx', ['convex', 'env', 'get', key], 45_000);
  if (result.code !== 0) return undefined;
  const value = result.stdout.trim();
  return value === '' ? undefined : value;
}

async function convexEnvSet(key, value) {
  await runLogged('npx', ['convex', 'env', 'set', key, value], join(OUTDIR, 'logs', `env-set-${key}.log`), 45_000);
}

async function convexEnvRemove(key) {
  await runLogged(
    'npx',
    ['convex', 'env', 'remove', key],
    join(OUTDIR, 'logs', `env-remove-${key}.log`),
    45_000,
    { allowFailure: true },
  );
}

async function runLogged(command, commandArgs, logPath, timeout, options = {}) {
  const result = await runCaptured(command, commandArgs, timeout);
  const body = [
    `$ ${command} ${commandArgs.join(' ')}`,
    '',
    `exit_code=${result.code}`,
    '',
    '--- stdout ---',
    result.stdout,
    '',
    '--- stderr ---',
    result.stderr,
    '',
  ].join('\n');
  await writeFile(logPath, body);
  if (result.code !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${commandArgs.join(' ')} failed with code ${result.code}; see ${relative(logPath)}`);
  }
  return result;
}

async function runCaptured(command, commandArgs, timeout) {
  try {
    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      cwd: REPO_ROOT,
      env: COMMAND_ENV,
      maxBuffer: 1024 * 1024 * 20,
      timeout,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return {
      code: typeof error.code === 'number' ? error.code : 1,
      stdout: error.stdout ?? '',
      stderr: `${error.stderr ?? ''}${error.message ? `\n${error.message}` : ''}`,
    };
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function generationMetadataSnapshot() {
  const characterSoulProvider = process.env.UMI_MAHIRU_PILOT_PROVIDER || null;
  return {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    note: 'Run-level provider/model snapshot; current reports do not expose token-level or per-turn model IDs.',
    llm_provider: process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'ollama'),
    localOllamaDefaultModel: process.env.OLLAMA_MODEL || 'qwen3:8b',
    smokePolicyModel: 'qwen2.5:1.5b',
    characterSoulProvider,
    characterSoulDefaultModel:
      process.env.UMI_MAHIRU_PILOT_MODEL || defaultCharacterSoulModel(characterSoulProvider),
    companionModel:
      process.env.COMPANION_PILOT_MODEL ||
      process.env.UMI_MAHIRU_PILOT_MODEL ||
      defaultCharacterSoulModel(characterSoulProvider),
    customModel: process.env.LLM_MODEL || null,
    openaiChatModel: process.env.OPENAI_CHAT_MODEL || null,
    togetherChatModel: process.env.TOGETHER_CHAT_MODEL || null,
    apiBaseConfigured: Boolean(process.env.LLM_API_URL || process.env.UMI_MAHIRU_PILOT_BASE_URL),
  };
}

function defaultCharacterSoulModel(provider) {
  const normalized = (provider || '').trim().toLowerCase();
  if (normalized === 'gemini') return 'gemini-2.5-flash';
  if (normalized === 'qwen' || normalized === 'openai' || normalized === 'openai-compatible') return 'qwen3-max';
  return null;
}

function parseArgs(values) {
  const parsed = new Map();
  for (const value of values) {
    if (!value.startsWith('--')) continue;
    const equals = value.indexOf('=');
    if (equals === -1) parsed.set(value.slice(2), 'true');
    else parsed.set(value.slice(2, equals), value.slice(equals + 1));
  }
  return parsed;
}

function numberArg(name, fallback, min, max) {
  const raw = args.get(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`--${name} must be between ${min} and ${max}`);
  }
  return value;
}

function runSelfTest() {
  if (SAMPLES_PER_ARM < 1) throw new Error('selftest: invalid samples');
  if (SAMPLE_TIMEOUT_MS < 30_000) throw new Error('selftest: invalid timeout');
  if (ORDER.length !== 2 || ORDER.some((arm) => !VALID_ARMS.has(arm))) {
    throw new Error('selftest: invalid order');
  }
  if (ALLOW_LEGACY_FORCED_PILOT) {
    throw new Error('selftest should not require legacy opt-in');
  }
  console.log('run_residue_ablation selftest: PASS');
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

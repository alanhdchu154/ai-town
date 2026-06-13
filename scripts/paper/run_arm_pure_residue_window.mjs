#!/usr/bin/env node
// Run one arm-pure residue READ collection window.
//
// This is the primary-design runner for the paper schedule decision. It keeps
// UNDERWORLD_RESIDUE_READ in one state for a long window, then scores only
// conversations created inside that window. It does not install daemons or
// schedulers; the caller owns how long the Codex-managed command stays open.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const args = parseArgs(process.argv.slice(2));
const SELF_TEST = args.get('selftest') === 'true' || args.get('self-test') === 'true';
const CHECK_ACCEPTANCE_ONLY = args.get('check-acceptance-only') === 'true';
const ARM = args.get('arm') ?? 'on';
const VALID_ARMS = new Set(['on', 'off', 'placebo']);
const COLLECT_MODE = args.get('collect') ?? 'none';
const VALID_COLLECT_MODES = new Set(['none', 'force']);
const DURATION_MIN = numberArg('duration-min', 120, 1, 24 * 60);
const SAMPLE_INTERVAL_MIN = numberArg('sample-interval-min', 60, 1, 12 * 60);
const SAMPLES_PER_INTERVAL = numberArg('samples-per-interval', 1, 1, 3);
const SAMPLE_TIMEOUT_MS = numberArg('sample-timeout-ms', 300_000, 30_000, 900_000);
const SAMPLE_POLL_MS = numberArg('sample-poll-ms', 7_000, 1_000, 30_000);
const PYTHON = args.get('python') ?? process.env.PAPER_PYTHON ?? '/tmp/ai-town-paper-venv/bin/python';
const OUTDIR = resolve(
  REPO_ROOT,
  args.get('outdir') ?? join('docs', 'paper', 'results', `arm-window-${timestampSlug()}-${ARM}`),
);
const ACCEPTANCE_PATH = resolve(
  REPO_ROOT,
  args.get('acceptance-file') ?? join('docs', 'paper', 'SCHEDULE_ACCEPTANCE.json'),
);
const PREREGISTRATION_ACCEPTANCE_PATH = resolve(
  REPO_ROOT,
  args.get('preregistration-acceptance-file') ??
    join('docs', 'paper', 'PREREGISTRATION_ACCEPTANCE.json'),
);

if (!VALID_ARMS.has(ARM)) {
  throw new Error('--arm must be on, off, or placebo');
}
if (!VALID_COLLECT_MODES.has(COLLECT_MODE)) {
  throw new Error('--collect must be none or force');
}

const CONDITION_BY_ARM = {
  on: 'residue_on',
  off: 'residue_off',
  placebo: 'residue_placebo',
};
const CONDITION = CONDITION_BY_ARM[ARM];
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

if (CHECK_ACCEPTANCE_ONLY) {
  try {
    await assertCollectionAccepted();
    console.log('[paper-arm-window] collection acceptance: PASS');
  } catch (error) {
    console.error(`[paper-arm-window] collection acceptance: FAIL: ${error.message}`);
    process.exit(2);
  }
  process.exit(0);
}

try {
  await main();
} catch (error) {
  console.error(`[paper-arm-window] ERROR: ${error.message}`);
  process.exit(1);
}

async function main() {
  await assertCollectionAccepted();
  await mkdir(OUTDIR, { recursive: true });
  await mkdir(join(OUTDIR, 'logs'), { recursive: true });

  const startedAt = Date.now();
  const previousResidueRead = await convexEnvGet('UNDERWORLD_RESIDUE_READ');
  const metadata = {
    kind: 'arm_pure_residue_window',
    runId: basename(OUTDIR),
    arm: ARM,
    condition: CONDITION,
    collectMode: COLLECT_MODE,
    durationMin: DURATION_MIN,
    sampleIntervalMin: SAMPLE_INTERVAL_MIN,
    samplesPerInterval: SAMPLES_PER_INTERVAL,
    sampleTimeoutMs: SAMPLE_TIMEOUT_MS,
    samplePollMs: SAMPLE_POLL_MS,
    startedAt,
    startedAtIso: new Date(startedAt).toISOString(),
    previousResidueRead,
    generationMetadata: generationMetadataSnapshot(),
    runProvenance: null,
    restored: false,
    collectionAttempts: [],
  };
  metadata.runProvenance = await runProvenanceSnapshot(metadata, 'pre_window');
  await writeJson(join(OUTDIR, 'metadata.json'), metadata);
  await writeJson(join(OUTDIR, 'generation-metadata.json'), metadata.generationMetadata);
  await writeJson(join(OUTDIR, 'run-provenance.json'), metadata.runProvenance);

  console.log(`[paper-arm-window] outdir=${relative(OUTDIR)}`);
  console.log(`[paper-arm-window] arm=${ARM} condition=${CONDITION} collect=${COLLECT_MODE}`);
  console.log(`[paper-arm-window] previous UNDERWORLD_RESIDUE_READ=${previousResidueRead ?? '<unset>'}`);

  try {
    if (ARM === 'on') {
      await convexEnvRemove('UNDERWORLD_RESIDUE_READ');
    } else if (ARM === 'placebo') {
      await convexEnvSet('UNDERWORLD_RESIDUE_READ', 'placebo');
    } else {
      await convexEnvSet('UNDERWORLD_RESIDUE_READ', 'false');
    }
    metadata.residueReadEnv = await convexEnvGet('UNDERWORLD_RESIDUE_READ');
    metadata.windowStartMs = Date.now();
    metadata.windowStartIso = new Date(metadata.windowStartMs).toISOString();
    metadata.windowEndPlannedMs = metadata.windowStartMs + DURATION_MIN * 60_000;
    metadata.windowEndPlannedIso = new Date(metadata.windowEndPlannedMs).toISOString();
    await writeJson(join(OUTDIR, 'metadata.json'), metadata);

    console.log(
      `[paper-arm-window] window start=${metadata.windowStartIso} plannedEnd=${metadata.windowEndPlannedIso} ` +
        `UNDERWORLD_RESIDUE_READ=${metadata.residueReadEnv ?? '<unset>'}`,
    );

    await holdCollectionWindow(metadata);

    metadata.windowEndMs = Date.now();
    metadata.windowEndIso = new Date(metadata.windowEndMs).toISOString();
    metadata.runProvenance = await runProvenanceSnapshot(metadata, 'post_window_pre_score');
    await writeJson(join(OUTDIR, 'metadata.json'), metadata);
    await writeJson(join(OUTDIR, 'run-provenance.json'), metadata.runProvenance);

    await scoreWindow(metadata);
  } finally {
    await restoreResidueRead(previousResidueRead);
    metadata.restored = true;
    metadata.restoredAt = Date.now();
    metadata.restoredAtIso = new Date(metadata.restoredAt).toISOString();
    metadata.finalResidueRead = await convexEnvGet('UNDERWORLD_RESIDUE_READ');
    metadata.runProvenance = await runProvenanceSnapshot(metadata, 'post_restore');
    await writeJson(join(OUTDIR, 'metadata.json'), metadata);
    await writeJson(join(OUTDIR, 'run-provenance.json'), metadata.runProvenance);
    console.log(`[paper-arm-window] restored UNDERWORLD_RESIDUE_READ=${metadata.finalResidueRead ?? '<unset>'}`);
  }

  await writeReadme(metadata);
  console.log(`[paper-arm-window] complete: ${relative(OUTDIR)}`);
}

async function holdCollectionWindow(metadata) {
  if (COLLECT_MODE === 'none') {
    console.log('[paper-arm-window] collect=none: holding arm state for natural/world-generated traffic');
    await sleepUntil(metadata.windowEndPlannedMs);
    return;
  }

  let nextSampleAt = Date.now();
  while (Date.now() < metadata.windowEndPlannedMs) {
    if (Date.now() >= nextSampleAt) {
      const attempt = {
        startedAt: Date.now(),
        startedAtIso: new Date().toISOString(),
      };
      metadata.collectionAttempts.push(attempt);
      await writeJson(join(OUTDIR, 'metadata.json'), metadata);
      const logName = `observe-${metadata.collectionAttempts.length}.log`;
      const result = await runLogged(
        'npm',
        [
          'run',
          'underworld:observe',
          '--',
          '--collect=force',
          '--cc=skip',
          `--target-samples=${SAMPLES_PER_INTERVAL}`,
          `--sample-timeout-ms=${SAMPLE_TIMEOUT_MS}`,
          `--sample-poll-ms=${SAMPLE_POLL_MS}`,
          `--since-created-at=${metadata.windowStartMs}`,
          '--require-archived=true',
        ],
        join(OUTDIR, 'logs', logName),
        SAMPLE_TIMEOUT_MS * SAMPLES_PER_INTERVAL + 240_000,
        { allowFailure: true },
      );
      attempt.exitCode = result.code;
      attempt.finishedAt = Date.now();
      attempt.finishedAtIso = new Date(attempt.finishedAt).toISOString();
      attempt.ok = result.code === 0;
      await writeJson(join(OUTDIR, 'metadata.json'), metadata);
      nextSampleAt = Date.now() + SAMPLE_INTERVAL_MIN * 60_000;
      if (result.code !== 0) {
        console.log(`[paper-arm-window] observe attempt failed; see logs/${logName}`);
      }
    }
    await sleepUntil(Math.min(nextSampleAt, metadata.windowEndPlannedMs, Date.now() + 30_000));
  }
}

async function scoreWindow(metadata) {
  await runLogged(
    'npm',
    ['run', 'eval:soul-triad', '--', `--since-created-at=${metadata.windowStartMs}`],
    join(OUTDIR, 'logs', 'eval-soul-triad.log'),
    180_000,
  );
  await cp(
    join(REPO_ROOT, 'evals', 'conversations', 'reports', 'soul-triad-latest.md'),
    join(OUTDIR, 'soul-triad.md'),
  );
  await runLogged(
    'npm',
    [
      'run',
      'underworld:rolling-continuity',
      '--',
      `--since-created-at=${metadata.windowStartMs}`,
      `--until-created-at=${metadata.windowEndMs}`,
      `--out=${relative(join(OUTDIR, 'rolling-continuity.md'))}`,
    ],
    join(OUTDIR, 'logs', 'rolling-continuity.log'),
    120_000,
    { allowFailure: true },
  );
  await runLogged(
    'python3',
    [
      'scripts/paper/report_to_dataset.py',
      '--report',
      join(OUTDIR, 'soul-triad.md'),
      '--condition',
      CONDITION,
      '--out',
      join(OUTDIR, 'dataset.json'),
      '--min-messages',
      '3',
      '--exclude-active',
      '--metadata-json',
      join(OUTDIR, 'generation-metadata.json'),
      '--provenance-json',
      join(OUTDIR, 'run-provenance.json'),
      '--source-run',
      basename(OUTDIR),
      '--window',
      windowLabel(metadata),
      '--collection-day',
      collectionDay(metadata),
    ],
    join(OUTDIR, 'logs', 'report-to-dataset.log'),
    60_000,
  );
  await runLogged(
    'python3',
    [
      'scripts/paper/attach_rolling_callbacks.py',
      '--dataset',
      join(OUTDIR, 'dataset.json'),
      '--rolling-report',
      join(OUTDIR, 'rolling-continuity.md'),
      '--out',
      join(OUTDIR, 'dataset.json'),
      '--mark-callback-window-zero',
    ],
    join(OUTDIR, 'logs', 'attach-callbacks.log'),
    60_000,
  );

  const records = JSON.parse(await readFile(join(OUTDIR, 'dataset.json'), 'utf8'));
  metadata.records = records.length;
  await writeJson(join(OUTDIR, 'metadata.json'), metadata);
  console.log(`[paper-arm-window] parsed ${records.length} publishable records`);

  if (records.length > 0) {
    await runLogged(
      PYTHON,
      ['scripts/paper/analyze.py', '--dataset', join(OUTDIR, 'dataset.json'), '--outdir', OUTDIR],
      join(OUTDIR, 'logs', 'analyze.log'),
      180_000,
    );
  } else {
    metadata.analysisSkipped = 'empty_publishable_dataset';
    await writeJson(join(OUTDIR, 'metadata.json'), metadata);
  }
  metadata.artifactHashes = await artifactHashesSnapshot();
  await writeJson(join(OUTDIR, 'artifact-hashes.json'), metadata.artifactHashes);
  await writeJson(join(OUTDIR, 'metadata.json'), metadata);
}

async function writeReadme(metadata) {
  const summary = await readFile(join(OUTDIR, 'results', 'summary.md'), 'utf8').catch(() => '(summary missing)');
  const lines = [
    '# Arm-Pure Residue READ Window',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Arm: ${metadata.arm}`,
    `Condition: ${metadata.condition}`,
    `Collection mode: ${metadata.collectMode}`,
    `Window: ${metadata.windowStartIso ?? 'unknown'} -> ${metadata.windowEndIso ?? 'unknown'}`,
    `Dataset: \`${relative(join(OUTDIR, 'dataset.json'))}\``,
    '',
    '## Notes',
    '',
    '- This is the primary-design runner for arm-pure long-window collection.',
    '- It does not interleave residue_on and residue_off inside the same rolling window.',
    '- `collect=none` preserves natural/world-generated traffic; `collect=force` is a mechanism-pilot option.',
    '- `UNDERWORLD_RESIDUE_READ` was restored after the run.',
    '- `run-provenance.json` captures git/source/acceptance/runtime metadata without secret values.',
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

async function assertCollectionAccepted() {
  await assertAcceptedFile({
    path: ACCEPTANCE_PATH,
    label: 'schedule acceptance',
    document: 'docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md',
    documentField: 'schedule_document',
    shaField: 'schedule_sha256',
  });
  await assertAcceptedFile({
    path: PREREGISTRATION_ACCEPTANCE_PATH,
    label: 'preregistration acceptance',
    document: 'docs/paper/emotional-residue/experiments/PREREGISTRATION_PROTOCOL.md',
    documentField: 'preregistration_document',
    shaField: 'preregistration_sha256',
  });
}

async function assertAcceptedFile({ path, label, document, documentField, shaField }) {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new Error(
      `${label} file missing: ${relative(path)}. ` +
        `Do not run collection until Alan accepts ${document}.`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${label} file is not valid JSON: ${relative(path)}`);
  }
  if (parsed[documentField] && parsed[documentField] !== document) {
    throw new Error(`${label} file points to ${parsed[documentField]}, expected ${document}.`);
  }
  if (parsed.accepted !== true || !parsed.accepted_by || !parsed.accepted_at) {
    throw new Error(
      `${label} not accepted; collection remains paused. ` +
        `Update ${relative(path)} only after Alan explicitly accepts ${document}.`,
    );
  }
  const documentSha = await sha256File(resolve(REPO_ROOT, document));
  if (!parsed[shaField]) {
    throw new Error(`${label} is accepted but missing ${shaField}; expected ${documentSha}.`);
  }
  if (parsed[shaField] !== documentSha) {
    throw new Error(
      `${label} ${shaField} does not match current ${document}; ` +
        `expected ${documentSha}, got ${parsed[shaField]}. Re-accept the current document before collection.`,
    );
  }
}

async function sha256File(path) {
  const data = await readFile(path);
  return createHash('sha256').update(data).digest('hex');
}

async function sleepUntil(timestampMs) {
  const waitMs = Math.max(0, timestampMs - Date.now());
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

function runSelfTest() {
  const plan = {
    arm: ARM,
    condition: CONDITION,
    collectMode: COLLECT_MODE,
    durationMin: DURATION_MIN,
    sampleIntervalMin: SAMPLE_INTERVAL_MIN,
    samplesPerInterval: SAMPLES_PER_INTERVAL,
  };
  if (!VALID_ARMS.has(plan.arm)) throw new Error('selftest: invalid arm');
  if (!VALID_COLLECT_MODES.has(plan.collectMode)) throw new Error('selftest: invalid collect mode');
  if (plan.arm === 'on' && plan.condition !== 'residue_on') throw new Error('selftest: on condition mismatch');
  if (plan.arm === 'off' && plan.condition !== 'residue_off') throw new Error('selftest: off condition mismatch');
  if (plan.arm === 'placebo' && plan.condition !== 'residue_placebo') {
    throw new Error('selftest: placebo condition mismatch');
  }
  if (plan.durationMin < 1 || plan.sampleIntervalMin < 1) throw new Error('selftest: invalid timing');
  if (!ACCEPTANCE_PATH.endsWith('SCHEDULE_ACCEPTANCE.json')) throw new Error('selftest: acceptance path mismatch');
  if (!PREREGISTRATION_ACCEPTANCE_PATH.endsWith('PREREGISTRATION_ACCEPTANCE.json')) {
    throw new Error('selftest: preregistration acceptance path mismatch');
  }
  const generation = generationMetadataSnapshot();
  if (!generation.localOllamaDefaultModel) throw new Error('selftest: missing generation metadata');
  const sanitized = sanitizeArgv(['--arm=on', '--token=secret', '--duration-min=240']);
  if (!sanitized.some((item) => item.includes('<redacted>'))) throw new Error('selftest: arg redaction missing');
  console.log('run_arm_pure_residue_window selftest: PASS');
}

async function runProvenanceSnapshot(metadata, phase) {
  const [git, schedule, preregistration, sourceArchive, runtime] = await Promise.all([
    gitSnapshot(),
    documentAcceptanceSnapshot({
      label: 'schedule',
      documentPath: 'docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md',
      acceptancePath: 'docs/paper/emotional-residue/experiments/SCHEDULE_ACCEPTANCE.json',
      shaField: 'schedule_sha256',
    }),
    documentAcceptanceSnapshot({
      label: 'preregistration',
      documentPath: 'docs/paper/emotional-residue/experiments/PREREGISTRATION_PROTOCOL.md',
      acceptancePath: 'docs/paper/emotional-residue/experiments/PREREGISTRATION_ACCEPTANCE.json',
      shaField: 'preregistration_sha256',
    }),
    sourceArchiveSnapshot(),
    runtimeSnapshot(),
  ]);
  return {
    schema_version: 1,
    kind: 'arm_pure_residue_window_run_provenance',
    captured_at: new Date().toISOString(),
    phase,
    run_id: metadata.runId ?? basename(OUTDIR),
    outdir: relative(OUTDIR),
    experiment: {
      arm: metadata.arm,
      condition: metadata.condition,
      collect_mode: metadata.collectMode,
      duration_min: metadata.durationMin,
      sample_interval_min: metadata.sampleIntervalMin,
      samples_per_interval: metadata.samplesPerInterval,
      sample_timeout_ms: metadata.sampleTimeoutMs,
      sample_poll_ms: metadata.samplePollMs,
      started_at_iso: metadata.startedAtIso,
      window_start_iso: metadata.windowStartIso ?? null,
      window_end_planned_iso: metadata.windowEndPlannedIso ?? null,
      window_end_iso: metadata.windowEndIso ?? null,
      restored_at_iso: metadata.restoredAtIso ?? null,
    },
    command: {
      script: 'scripts/paper/run_arm_pure_residue_window.mjs',
      argv: sanitizeArgv(process.argv.slice(2)),
      python: PYTHON,
    },
    git,
    documents: { schedule, preregistration },
    source_archive: sourceArchive,
    runtime,
    env_policy: {
      secret_values_recorded: false,
      configured_keys: configuredEnvKeys([
        'LLM_PROVIDER',
        'LLM_MODEL',
        'OLLAMA_MODEL',
        'OPENAI_API_KEY',
        'OPENAI_CHAT_MODEL',
        'TOGETHER_API_KEY',
        'TOGETHER_CHAT_MODEL',
        'UMI_MAHIRU_PILOT_PROVIDER',
        'UMI_MAHIRU_PILOT_MODEL',
        'UMI_MAHIRU_PILOT_BASE_URL',
      ]),
    },
  };
}

async function gitSnapshot() {
  const [commit, branch, status] = await Promise.all([
    runCaptured('git', ['rev-parse', '--verify', 'HEAD'], 10_000),
    runCaptured('git', ['rev-parse', '--abbrev-ref', 'HEAD'], 10_000),
    runCaptured('git', ['status', '--porcelain'], 10_000),
  ]);
  const statusLines = status.stdout.split('\n');
  const entries = statusLines.map((line) => line.trim()).filter(Boolean);
  return {
    commit: commit.code === 0 ? commit.stdout.trim() : null,
    branch: branch.code === 0 ? branch.stdout.trim() : null,
    dirty: entries.length > 0,
    status_entry_count: entries.length,
    status_sample: entries.slice(0, 30),
  };
}

async function documentAcceptanceSnapshot({ label, documentPath, acceptancePath, shaField }) {
  const documentAbsolute = resolve(REPO_ROOT, documentPath);
  const acceptanceAbsolute = resolve(REPO_ROOT, acceptancePath);
  let acceptance = {};
  try {
    acceptance = JSON.parse(await readFile(acceptanceAbsolute, 'utf8'));
  } catch {
    acceptance = {};
  }
  const currentSha = await sha256File(documentAbsolute).catch(() => null);
  const acceptedSha = typeof acceptance[shaField] === 'string' ? acceptance[shaField] : '';
  return {
    label,
    document: documentPath,
    acceptance_file: acceptancePath,
    accepted: acceptance.accepted === true,
    accepted_by: acceptance.accepted_by || null,
    accepted_at: acceptance.accepted_at || null,
    current_sha256: currentSha,
    acceptance_sha256: acceptedSha || null,
    acceptance_matches_document: Boolean(currentSha && acceptedSha && currentSha === acceptedSha),
  };
}

async function sourceArchiveSnapshot() {
  const manifestPath = join(REPO_ROOT, 'docs', 'paper', 'results', 'arxiv-source', 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return {
      manifest_exists: false,
      manifest_path: relative(manifestPath),
      archive_sha256: null,
      manifest_matches_current_sources: false,
      files: [],
    };
  }
  const files = [];
  for (const item of Array.isArray(manifest.files) ? manifest.files : []) {
    const source = typeof item.source === 'string' ? item.source : '';
    const currentSha = source ? await sha256File(resolve(REPO_ROOT, source)).catch(() => null) : null;
    files.push({
      archive_name: item.archive_name ?? null,
      source,
      manifest_sha256: item.sha256 ?? null,
      current_sha256: currentSha,
      matches_current: Boolean(currentSha && item.sha256 === currentSha),
    });
  }
  return {
    manifest_exists: true,
    manifest_path: relative(manifestPath),
    archive: manifest.archive ?? null,
    archive_sha256: manifest.archive_sha256 ?? null,
    manifest_matches_current_sources: files.length > 0 && files.every((item) => item.matches_current),
    files,
  };
}

async function artifactHashesSnapshot() {
  const entries = [];
  const candidates = [
    'dataset.json',
    'soul-triad.md',
    'rolling-continuity.md',
    'generation-metadata.json',
    'README.md',
    join('results', 'summary.md'),
  ];
  for (const candidate of candidates) {
    const path = join(OUTDIR, candidate);
    const entry = await artifactHashEntry(path, candidate);
    if (entry) entries.push(entry);
  }
  const logDir = join(OUTDIR, 'logs');
  let logNames = [];
  try {
    logNames = await readdir(logDir);
  } catch {
    logNames = [];
  }
  for (const name of logNames.sort()) {
    if (!name.endsWith('.log')) continue;
    const relativePath = join('logs', name);
    const entry = await artifactHashEntry(join(OUTDIR, relativePath), relativePath);
    if (entry) entries.push(entry);
  }
  return {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    note: 'Hashes for data/report/log artifacts generated by the run. Metadata/provenance/hash files are excluded to avoid circular hashes.',
    artifacts: entries,
  };
}

async function artifactHashEntry(path, relativePath) {
  try {
    const data = await readFile(path);
    return {
      path: relativePath,
      sha256: createHash('sha256').update(data).digest('hex'),
      bytes: data.length,
    };
  } catch {
    return null;
  }
}

async function runtimeSnapshot() {
  const npmVersion = await runCaptured('npm', ['--version'], 10_000);
  return {
    node: process.version,
    npm: npmVersion.code === 0 ? npmVersion.stdout.trim() : null,
    platform: process.platform,
    arch: process.arch,
  };
}

function configuredEnvKeys(names) {
  const out = {};
  for (const name of names) {
    out[name] = Boolean(process.env[name]);
  }
  return out;
}

function sanitizeArgv(values) {
  return values.map((value) => {
    const lower = value.toLowerCase();
    if (lower.includes('key=') || lower.includes('token=') || lower.includes('secret=') || lower.includes('password=')) {
      const equals = value.indexOf('=');
      return equals === -1 ? '<redacted-sensitive-arg>' : `${value.slice(0, equals + 1)}<redacted>`;
    }
    return value;
  });
}

function windowLabel(metadata) {
  return `${metadata.windowStartIso ?? 'unknown'}--${metadata.windowEndIso ?? metadata.windowEndPlannedIso ?? 'unknown'}`;
}

function collectionDay(metadata) {
  return (metadata.windowStartIso ?? new Date().toISOString()).slice(0, 10);
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

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

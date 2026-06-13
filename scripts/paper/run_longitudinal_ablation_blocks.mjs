#!/usr/bin/env node
// Repeatedly run archived-only residue ablation blocks until a target count.

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const args = parseArgs(process.argv.slice(2));
const SELF_TEST = args.get('selftest') === 'true' || args.get('self-test') === 'true';
const ALLOW_LEGACY_FORCED_PILOT = args.get('allow-legacy-forced-pilot') === 'true';
const TARGET_PER_ARM = numberArg('target-per-arm', 10, 1, 200);
const MAX_BLOCKS = numberArg('max-blocks', 20, 1, 200);
const SAMPLES_PER_ARM = numberArg('samples-per-arm', 1, 1, 10);
const SAMPLE_TIMEOUT_MS = numberArg('sample-timeout-ms', 300_000, 30_000, 900_000);
const PYTHON = args.get('python') ?? process.env.PAPER_PYTHON ?? '/tmp/ai-town-paper-venv/bin/python';
const LONGITUDINAL_DIR = resolve(REPO_ROOT, args.get('outdir') ?? join('docs', 'paper', 'results', 'longitudinal'));
const DATASET_PATH = join(LONGITUDINAL_DIR, 'dataset.json');
const LOG_PATH = join(LONGITUDINAL_DIR, 'run-blocks.log');

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
    '[paper-ablation-blocks] REFUSING legacy repeated forced-pilot collection. ' +
      'Use paper:residue-arm-window after schedule/preregistration acceptance for the primary design. ' +
      'Pass --allow-legacy-forced-pilot only for explicitly labeled mechanism debugging.',
  );
  process.exit(2);
}

await main();

async function main() {
  await mkdir(LONGITUDINAL_DIR, { recursive: true });
  await log(`start targetPerArm=${TARGET_PER_ARM} maxBlocks=${MAX_BLOCKS} samplesPerArm=${SAMPLES_PER_ARM}`);
  let counts = await mergeAndAnalyze();
  await log(`initial counts on=${counts.residue_on} off=${counts.residue_off}`);

  for (let block = 1; block <= MAX_BLOCKS; block += 1) {
    if (counts.residue_on >= TARGET_PER_ARM && counts.residue_off >= TARGET_PER_ARM) {
      await log('target reached before next block');
      break;
    }
    const order = block % 2 === 1 ? 'on,off' : 'off,on';
    await log(`block ${block}/${MAX_BLOCKS} order=${order}`);
    await runLogged('npm', [
      'run',
      'paper:residue-ablation',
      '--',
      `--samples-per-arm=${SAMPLES_PER_ARM}`,
      `--order=${order}`,
      `--sample-timeout-ms=${SAMPLE_TIMEOUT_MS}`,
      '--post-collection-wait-ms=0',
      '--allow-legacy-forced-pilot',
      `--python=${PYTHON}`,
    ], SAMPLE_TIMEOUT_MS * SAMPLES_PER_ARM * 2 + 300_000);

    counts = await mergeAndAnalyze();
    await log(`after block ${block}: on=${counts.residue_on} off=${counts.residue_off}`);
  }

  counts = await mergeAndAnalyze();
  const reached = counts.residue_on >= TARGET_PER_ARM && counts.residue_off >= TARGET_PER_ARM;
  await log(`done reached=${reached} on=${counts.residue_on} off=${counts.residue_off}`);
  process.exitCode = reached ? 0 : 2;
}

async function mergeAndAnalyze() {
  await runLogged('python3', [
    'scripts/paper/merge_ablation_runs.py',
    '--runs',
    'docs/paper/emotional-residue/results/ablation-*',
    '--out',
    DATASET_PATH,
  ], 60_000);
  const data = JSON.parse(await readFile(DATASET_PATH, 'utf8'));
  const counts = {
    residue_on: data.filter((row) => row.condition === 'residue_on').length,
    residue_off: data.filter((row) => row.condition === 'residue_off').length,
  };
  if (data.length > 0) {
    await runLogged(PYTHON, [
      'scripts/paper/analyze.py',
      '--dataset',
      DATASET_PATH,
      '--outdir',
      LONGITUDINAL_DIR,
    ], 180_000);
  }
  return counts;
}

async function runLogged(command, commandArgs, timeout) {
  await log(`$ ${command} ${commandArgs.join(' ')}`);
  try {
    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      cwd: REPO_ROOT,
      env: COMMAND_ENV,
      maxBuffer: 1024 * 1024 * 20,
      timeout,
    });
    if (stdout.trim()) await log(stdout.trim());
    if (stderr.trim()) await log(`stderr:\n${stderr.trim()}`);
    return { code: 0, stdout, stderr };
  } catch (error) {
    const stdout = error.stdout ?? '';
    const stderr = `${error.stderr ?? ''}${error.message ? `\n${error.message}` : ''}`;
    if (stdout.trim()) await log(stdout.trim());
    if (stderr.trim()) await log(`stderr:\n${stderr.trim()}`);
    throw error;
  }
}

async function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  process.stdout.write(line);
  await writeFile(LOG_PATH, line, { flag: 'a' });
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
  if (TARGET_PER_ARM < 1 || MAX_BLOCKS < 1 || SAMPLES_PER_ARM < 1) {
    throw new Error('selftest: invalid counts');
  }
  if (SAMPLE_TIMEOUT_MS < 30_000) throw new Error('selftest: invalid timeout');
  if (ALLOW_LEGACY_FORCED_PILOT) {
    throw new Error('selftest should not require legacy opt-in');
  }
  console.log('run_longitudinal_ablation_blocks selftest: PASS');
}

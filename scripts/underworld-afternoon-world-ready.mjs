#!/usr/bin/env node
// Ensure the Underworld engine is ready for daytime/afternoon evidence.
//
// This script only resumes an inactive world. It intentionally leaves
// stoppedByDeveloper alone so night quiet or manual stops are respected.

import { execFile } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SELF_TEST = process.argv.includes('--self-test');

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

const status = await convexRun('world:defaultWorldStatus', {});
const action = readinessAction(status?.status);

if (action === 'resume') {
  await convexRun('testing:resume', {});
}

const after = await convexRun('world:defaultWorldStatus', {});
console.log(
  `[underworld-afternoon-world-ready] before=${status?.status ?? 'unknown'} action=${action} after=${after?.status ?? 'unknown'}`,
);

function readinessAction(status) {
  if (status === 'inactive') return 'resume';
  if (status === 'running') return 'noop_running';
  if (status === 'stoppedByDeveloper') return 'respect_stopped_by_developer';
  return 'observe_only_unknown_status';
}

async function convexRun(functionName, payload) {
  const { stdout } = await execFileAsync(
    'npx',
    ['convex', 'run', '--typecheck', 'disable', '--codegen', 'disable', functionName, JSON.stringify(payload)],
    { cwd: REPO_ROOT, timeout: 180_000, maxBuffer: 1024 * 1024 * 16 },
  );
  const trimmed = stdout.trim();
  const starts = [trimmed.indexOf('{'), trimmed.indexOf('[')].filter((index) => index >= 0);
  if (!starts.length) return null;
  return JSON.parse(trimmed.slice(Math.min(...starts)));
}

function runSelfTest() {
  const cases = [
    ['inactive', 'resume'],
    ['running', 'noop_running'],
    ['stoppedByDeveloper', 'respect_stopped_by_developer'],
    ['weird', 'observe_only_unknown_status'],
  ];
  for (const [input, expected] of cases) {
    const actual = readinessAction(input);
    if (actual !== expected) {
      console.error(`[underworld-afternoon-world-ready:self-test] FAIL ${input}: ${actual} !== ${expected}`);
      process.exit(1);
    }
  }
  console.log(`[underworld-afternoon-world-ready:self-test] PASS (${relative(REPO_ROOT, fileURLToPath(import.meta.url))})`);
}

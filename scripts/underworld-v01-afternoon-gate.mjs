#!/usr/bin/env node
// One-command v0.1 afternoon gate.
//
// The gate intentionally continues through the reporting steps after a non-zero
// result so the final completion audit can explain what is missing instead of
// leaving the next agent with only a half-written terminal log.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const OUTPUT_PATH = join(REPO_ROOT, 'umi', 'reports', 'v01-afternoon-gate-latest.md');

const args = parseArgs(process.argv.slice(2));
if (args.get('self-test') === 'true') {
  runSelfTest();
  process.exit(0);
}

const steps = [
  step('daytime_check', ['npm', ['run', 'underworld:v01-daytime-check']], true),
  step('repair_gate', ['npm', ['run', 'underworld:repair-gate']], true),
  step('rubric_reconcile', ['npm', ['run', 'underworld:rubric-reconcile']], true),
  step('completion_audit', ['npm', ['run', 'underworld:v01-completion-audit']], true),
];

const results = [];
for (const item of steps) {
  const result = await runStep(item);
  results.push(result);
}

await writeSummary(results);
const completion = results.find((item) => item.id === 'completion_audit');
const failed = results.filter((item) => item.exitCode !== 0);
const finalExitCode = completion?.exitCode ?? failed[0]?.exitCode ?? 0;
console.log(`[underworld-v01-afternoon-gate] report written: ${relative(OUTPUT_PATH)}`);
console.log(
  `[underworld-v01-afternoon-gate] ${finalExitCode === 0 ? 'PASS' : 'NOT_COMPLETE'}: ${failed.length} non-zero step(s).`,
);
process.exitCode = finalExitCode;

function step(id, command, continueAfterFailure = true) {
  return { id, command, continueAfterFailure };
}

function runStep(item) {
  const [cmd, cmdArgs] = item.command;
  const startedAt = new Date().toISOString();
  console.log(`[underworld-v01-afternoon-gate] starting ${item.id}: ${cmd} ${cmdArgs.join(' ')}`);
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: 'inherit',
    });
    child.on('close', (code, signal) => {
      const exitCode = typeof code === 'number' ? code : signal ? 130 : 1;
      const finishedAt = new Date().toISOString();
      console.log(`[underworld-v01-afternoon-gate] finished ${item.id}: exit ${exitCode}`);
      resolve({
        id: item.id,
        command: `${cmd} ${cmdArgs.join(' ')}`,
        startedAt,
        finishedAt,
        exitCode,
      });
    });
    child.on('error', (error) => {
      const finishedAt = new Date().toISOString();
      console.error(`[underworld-v01-afternoon-gate] ${item.id} failed to start: ${error.message}`);
      resolve({
        id: item.id,
        command: `${cmd} ${cmdArgs.join(' ')}`,
        startedAt,
        finishedAt,
        exitCode: 127,
        error: error.message,
      });
    });
  });
}

async function writeSummary(results) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const failed = results.filter((item) => item.exitCode !== 0);
  const lines = [
    '# GIIS Underworld v0.1 Afternoon Gate',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Overall: ${failed.length === 0 ? 'PASS' : 'NOT_COMPLETE'}`,
    `Reason: ${failed.length} non-zero step(s).`,
    '',
    '## Steps',
    '',
    '| Step | Exit | Started | Finished | Command |',
    '|---|---:|---|---|---|',
    ...results.map((item) =>
      [item.id, item.exitCode, item.startedAt, item.finishedAt, item.command]
        .map(escapeTableCell)
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |'),
    ),
    '',
    '## Final Gate',
    '',
    'Use `umi/reports/v01-completion-audit-latest.md` as the primary requirement-by-requirement completion report.',
    '',
  ];
  await writeFile(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function parseArgs(values) {
  return new Map(
    values
      .filter((value) => value.startsWith('--'))
      .map((value) => {
        const equals = value.indexOf('=');
        if (equals === -1) return [value.slice(2), 'true'];
        return [value.slice(2, equals), value.slice(equals + 1)];
      }),
  );
}

function escapeTableCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\n/g, '<br>');
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function runSelfTest() {
  const sample = [
    {
      id: 'completion_audit',
      command: 'npm run underworld:v01-completion-audit',
      startedAt: '2026-06-03T18:05:00.000Z',
      finishedAt: '2026-06-03T18:05:01.000Z',
      exitCode: 1,
    },
  ];
  const failed = sample.filter((item) => item.exitCode !== 0);
  if (failed.length !== 1) throw new Error('self-test failed to count non-zero steps');
  console.log('[underworld-v01-afternoon-gate:self-test] PASS');
}

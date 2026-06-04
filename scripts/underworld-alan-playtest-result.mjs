#!/usr/bin/env node
// Helper for the Alan-facing Umi v0.1 playtest result artifact.
//
// This script does not run a playtest, mark a verdict, or write evidence.
// It prints the required result template and validates the ignored local
// artifact before the completion audit consumes it.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const RESULT_PATH = join(REPO_ROOT, 'umi', 'reports', 'alan-facing-v01-playtest-latest.md');
const REQUIRED_CHECKS = [
  'Greeting Binding',
  'Latest-Sentence Binding',
  'Correction Binding',
  'Yesterday / Today Continuity',
  'Closing / Idle Boundary',
];

const args = parseArgs(process.argv.slice(2));
if (args.get('self-test') === 'true') {
  runSelfTest();
  process.exit(0);
}

if (args.get('template') === 'true') {
  console.log(templateText());
  process.exit(0);
}

if (args.get('check') === 'true') {
  const result = validateArtifact(await readOptional(RESULT_PATH));
  printValidation(result);
  if (result.status !== 'PASS_READY') process.exitCode = 1;
  process.exit();
}

console.log('Usage:');
console.log('  node scripts/underworld-alan-playtest-result.mjs --template');
console.log('  node scripts/underworld-alan-playtest-result.mjs --check');
console.log('  node scripts/underworld-alan-playtest-result.mjs --self-test');

function templateText() {
  return `## Playtest Result - YYYY-MM-DD HH:MM CDT

Commit:
Runtime/provider notes:

1. Greeting Binding: PASS / FAIL
Alan:
Umi:

2. Latest-Sentence Binding: PASS / FAIL
Alan:
Umi:

3. Correction Binding: PASS / FAIL
Alan:
Umi:

4. Yesterday / Today Continuity: PASS / FAIL
Alan:
Umi:

5. Closing / Idle Boundary: PASS / FAIL
Alan:
Umi:

Verdict: PASS / PARTIAL / FAIL
Decision:
- PASS only if all five numbered checks are present and PASS.
- PARTIAL if one or more checks are inconclusive or need a small fix.
- FAIL if any required check clearly fails.
`;
}

function validateArtifact(text) {
  const source = String(text ?? '');
  if (!source.trim()) {
    return {
      status: 'MISSING',
      verdict: 'missing',
      passedChecks: 0,
      requiredChecks: REQUIRED_CHECKS.length,
      missingChecks: REQUIRED_CHECKS,
      failedChecks: [],
      partialChecks: [],
      reason: `Missing ${relative(RESULT_PATH)}.`,
    };
  }
  const verdict = [...source.matchAll(/^Verdict:\s*(PASS|PARTIAL|FAIL)\b/gim)].at(-1)?.[1]?.toUpperCase() ?? 'UNKNOWN';
  const checkStatuses = Object.fromEntries(
    REQUIRED_CHECKS.map((label) => {
      const match = source.match(new RegExp(`^\\s*\\d+\\.\\s*${escapeRegExp(label)}:\\s*(PASS|PARTIAL|FAIL)\\b`, 'im'));
      return [label, match?.[1]?.toUpperCase()];
    }),
  );
  const missingChecks = REQUIRED_CHECKS.filter((label) => !checkStatuses[label]);
  const failedChecks = REQUIRED_CHECKS.filter((label) => checkStatuses[label] === 'FAIL');
  const partialChecks = REQUIRED_CHECKS.filter((label) => checkStatuses[label] === 'PARTIAL');
  const passedChecks = REQUIRED_CHECKS.filter((label) => checkStatuses[label] === 'PASS').length;

  if (verdict === 'PASS' && passedChecks === REQUIRED_CHECKS.length) {
    return {
      status: 'PASS_READY',
      verdict,
      passedChecks,
      requiredChecks: REQUIRED_CHECKS.length,
      missingChecks,
      failedChecks,
      partialChecks,
      reason: 'Artifact is structurally ready for completion audit PASS consideration.',
    };
  }
  if (verdict === 'PASS' && failedChecks.length > 0) {
    return {
      status: 'CONTRADICTORY_FAIL',
      verdict,
      passedChecks,
      requiredChecks: REQUIRED_CHECKS.length,
      missingChecks,
      failedChecks,
      partialChecks,
      reason: 'Artifact says PASS but contains failed checklist rows.',
    };
  }
  return {
    status: 'NOT_PASS_READY',
    verdict,
    passedChecks,
    requiredChecks: REQUIRED_CHECKS.length,
    missingChecks,
    failedChecks,
    partialChecks,
    reason: 'Artifact will not clear the Alan-facing gate as PASS.',
  };
}

function printValidation(result) {
  console.log(`# Alan-Facing Umi Playtest Artifact Check`);
  console.log('');
  console.log(`Status: ${result.status}`);
  console.log(`Verdict: ${result.verdict}`);
  console.log(`Checks: ${result.passedChecks}/${result.requiredChecks} PASS`);
  console.log(`Missing: ${result.missingChecks.length ? result.missingChecks.join(', ') : 'none'}`);
  console.log(`Failed: ${result.failedChecks.length ? result.failedChecks.join(', ') : 'none'}`);
  console.log(`Partial: ${result.partialChecks.length ? result.partialChecks.join(', ') : 'none'}`);
  console.log(`Reason: ${result.reason}`);
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function runSelfTest() {
  const pass = validateArtifact(`
## Playtest Result - 2026-06-04 14:30 CDT

1. Greeting Binding: PASS
2. Latest-Sentence Binding: PASS
3. Correction Binding: PASS
4. Yesterday / Today Continuity: PASS
5. Closing / Idle Boundary: PASS

Verdict: PASS
`);
  assert(pass.status === 'PASS_READY', 'complete PASS artifact should be PASS_READY');

  const thin = validateArtifact('## Playtest Result - 2026-06-04 14:30 CDT\n\nVerdict: PASS\n');
  assert(thin.status === 'NOT_PASS_READY', 'thin PASS artifact should not be pass-ready');

  const contradictory = validateArtifact(`
## Playtest Result - 2026-06-04 14:30 CDT

1. Greeting Binding: PASS
2. Latest-Sentence Binding: PASS
3. Correction Binding: FAIL
4. Yesterday / Today Continuity: PASS
5. Closing / Idle Boundary: PASS

Verdict: PASS
`);
  assert(contradictory.status === 'CONTRADICTORY_FAIL', 'PASS verdict with a failed row should be contradictory');
  console.log('[underworld-alan-playtest-result:self-test] PASS');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

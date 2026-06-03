#!/usr/bin/env node
// GIIS Underworld v0.1 goal audit.
//
// This is a read-only completion audit for the active v0.1 loop. It turns the
// latest observe report into explicit requirement statuses so we do not confuse
// "no obvious failure" with proven completion.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const APPROACH_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'v01-approach-latest.md');
const AUDIT_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'v01-goal-audit-latest.md');

const args = parseArgs(process.argv.slice(2));
const SELF_TEST = args.get('self-test') === 'true';

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

const report = await readOptional(APPROACH_REPORT_PATH);
if (!report) {
  console.error('[underworld-v01-goal-audit] missing latest approach report; run npm run underworld:observe first');
  process.exitCode = 2;
} else {
  const audit = auditReport(report);
  await writeAuditReport(audit, report);
  console.log(`[underworld-v01-goal-audit] ${audit.overallStatus}: ${audit.overallReason}`);
  console.log(`[underworld-v01-goal-audit] report written: ${relative(AUDIT_REPORT_PATH)}`);
  if (audit.overallStatus !== 'PASS') process.exitCode = 1;
}

function auditReport(report) {
  const summary = parseBulletSection(report, 'Summary');
  const policy = parseBulletSection(report, 'Model Policy Env');
  const fallback = parseBulletSection(report, 'Fallback Pollution');
  const amPm = parseBulletSection(report, 'AM→PM Continuity');
  const collection = parseBulletSection(report, 'Collection');

  const freshSamples = numberValue(field(summary, 'Fresh triad samples'));
  const freshFallbackMarkers = numberValue(field(summary, 'Fresh fallback markers'));
  const echoPenalty = numberValue(field(summary, 'Echo penalty sum'));
  const stageLeak = numberValue(field(summary, 'Stage-direction leak sum'));
  const topFailure = field(summary, 'Top failure category') ?? 'unknown';
  const freshLife = parseStatusDecision(field(summary, 'Fresh-window life signals'));
  const amPmSummary = parseStatusDecision(field(summary, 'AM→PM continuity'));
  const activeFallbackPollution = numberValue(field(summary, 'Active fallback pollution count') ?? fallback.active_total);

  const checks = [
    check(
      'local_fallback_blocked',
      field(policy, 'CHARACTER_SOUL_LOCAL_FALLBACK') === 'false' && field(policy, 'ready') === 'yes',
      'Character-soul local fallback is disabled and model-policy env is ready.',
      'Character-soul local fallback is not proven disabled.',
    ),
    check(
      'pilot_env_clean',
      blank(field(policy, 'SOUL_TRIAD_COLOCATION_PILOT')) &&
        blank(field(policy, 'SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS')) &&
        blank(field(policy, 'SOUL_TRIAD_FOCUS_PAIR')),
      'No stale SOUL_TRIAD_* pilot env is visible in the latest observe report.',
      `Stale SOUL_TRIAD_* pilot env may bias fresh sample collection: coLocation=${JSON.stringify(field(policy, 'SOUL_TRIAD_COLOCATION_PILOT'))}, after=${JSON.stringify(field(policy, 'SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS'))}, focus=${JSON.stringify(field(policy, 'SOUL_TRIAD_FOCUS_PAIR'))}.`,
    ),
    check(
      'fresh_sample_count',
      freshSamples >= 3,
      `Fresh triad sample count is ${freshSamples}, enough for repair/eval judgment.`,
      `Fresh triad sample count is ${freshSamples}; need at least 3 fresh daytime samples.`,
      'PENDING',
    ),
    check(
      'no_fresh_fallback_contamination',
      freshSamples > 0 && freshFallbackMarkers === 0,
      'Fresh samples contain no fallback markers.',
      freshSamples === 0
        ? 'No fresh samples yet, so fallback contamination cannot be judged.'
        : `Fresh fallback markers found: ${freshFallbackMarkers}.`,
      freshSamples === 0 ? 'PENDING' : 'FAIL',
    ),
    check(
      'no_fresh_motif_or_hygiene_loop',
      freshSamples >= 3 &&
        echoPenalty === 0 &&
        stageLeak === 0 &&
        !['prop_echo_repeated', 'life_signal_repeated', 'conversation_shape_collapse'].includes(freshLife.decision ?? topFailure),
      'Fresh samples do not show motif echo, stage-direction leak, or shape collapse.',
      freshSamples < 3
        ? 'Need at least 3 fresh samples before motif-loop completion can be judged.'
        : `Fresh sample issue remains: top=${topFailure}, life=${freshLife.status ?? 'unknown'}/${freshLife.decision ?? 'unknown'}, echo=${echoPenalty}, stage=${stageLeak}.`,
      freshSamples < 3 ? 'PENDING' : 'FAIL',
    ),
    check(
      'yesterday_matters_signal',
      (amPmSummary.status === 'PASS' || amPm.status === 'PASS') && numberValue(field(amPm, 'PM callbacks found')) > 0,
      'AM→PM continuity found at least one callback from earlier residue.',
      amPmSummary.decision === 'sample_pending' || amPm.decision === 'sample_pending'
        ? 'AM→PM continuity is sample-pending; tomorrow signal is not proven.'
        : 'AM→PM continuity has not proven that yesterday/today residue affected later behavior.',
      amPmSummary.decision === 'sample_pending' || amPm.decision === 'sample_pending' ? 'PENDING' : 'FAIL',
    ),
    check(
      'old_fallback_pollution_visible_but_not_auto_cleaned',
      activeFallbackPollution >= 0 && /proposal-only/i.test(field(fallback, 'policy') ?? ''),
      `Old fallback pollution is visible (${activeFallbackPollution}) and cleanup remains proposal-only.`,
      'Fallback pollution status or proposal-only cleanup policy is missing from observe report.',
      'WARN',
    ),
    check(
      'night_quiet_not_forced',
      field(collection, 'attempted') === 'no' || report.includes('Night quiet: no'),
      'Latest observe did not force samples during quiet hours.',
      'Latest observe appears to have attempted collection during quiet hours.',
      'WARN',
    ),
  ];

  const failCount = checks.filter((item) => item.status === 'FAIL').length;
  const pendingCount = checks.filter((item) => item.status === 'PENDING').length;
  const warnCount = checks.filter((item) => item.status === 'WARN').length;
  const overallStatus = failCount > 0 ? 'FAIL' : pendingCount > 0 ? 'PENDING' : warnCount > 0 ? 'WARN' : 'PASS';
  const overallReason =
    overallStatus === 'PASS'
      ? 'All v0.1 goal requirements are currently proven.'
      : `${failCount} fail, ${pendingCount} pending, ${warnCount} warn.`;
  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    overallReason,
    freshSamples,
    topFailure,
    freshLife,
    amPmSummary,
    checks,
  };
}

function check(id, condition, passReason, otherReason, otherStatus = 'FAIL') {
  if (condition) return { id, status: 'PASS', reason: passReason };
  return { id, status: otherStatus, reason: otherReason };
}

async function writeAuditReport(audit, sourceReport) {
  await mkdir(dirname(AUDIT_REPORT_PATH), { recursive: true });
  const lines = [
    '# GIIS Underworld v0.1 Goal Audit',
    '',
    `Generated: ${audit.generatedAt}`,
    `Overall: ${audit.overallStatus}`,
    `Reason: ${audit.overallReason}`,
    '',
    '## Objective',
    '',
    'Protect Umi/Mahiru/Tianze character-soul dialogue from local fallback and motif-loop contamination, then collect fresh samples to judge whether the world is closer to "Yesterday mattered. Today they are not exactly the same."',
    '',
    '## Requirement Status',
    '',
    ...audit.checks.map((item) => `- ${item.status} ${item.id}: ${item.reason}`),
    '',
    '## Current Evidence',
    '',
    `- Fresh triad samples: ${audit.freshSamples}`,
    `- Top failure category: ${audit.topFailure}`,
    `- Fresh-window life signals: ${audit.freshLife.status ?? 'unknown'} / ${audit.freshLife.decision ?? 'unknown'}`,
    `- AM→PM continuity: ${audit.amPmSummary.status ?? 'unknown'} / ${audit.amPmSummary.decision ?? 'unknown'}`,
    '',
    '## Next Action',
    '',
    audit.overallStatus === 'PASS'
      ? 'Goal can be considered for completion after a human-facing transcript review.'
      : 'Keep the goal active. Next daytime command: `npm run underworld:v01-daytime-check`.',
    '',
    '## Source Report Excerpt',
    '',
    '```md',
    sourceReport.slice(0, 5000),
    '```',
    '',
  ];
  await writeFile(AUDIT_REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function parseBulletSection(report, heading) {
  const section = report.match(new RegExp(`## ${escapeRegExp(heading)}\\n\\n([\\s\\S]*?)(?:\\n\\n## |$)`))?.[1] ?? '';
  return Object.fromEntries(
    [...section.matchAll(/^- ([^:\n]+):[ \t]*(.*)$/gm)].map((match) => [
      normalizeKey(match[1]),
      match[2].trim(),
    ]),
  );
}

function parseStatusDecision(value) {
  const match = value?.match(/^([^/]+)\/\s*(.+)$/);
  return {
    status: match?.[1]?.trim(),
    decision: match?.[2]?.trim(),
  };
}

function normalizeKey(key) {
  return key.trim().replaceAll(' ', '_');
}

function field(section, key) {
  return section[normalizeKey(key)] ?? section[key];
}

function numberValue(value) {
  const parsed = Number(String(value ?? '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function blank(value) {
  return value === undefined || value.trim() === '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function runSelfTest() {
  const pending = auditReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 0
- Top failure category: sample_pending
- Fresh fallback markers: 0
- Stage-direction leak sum: 0.00
- Echo penalty sum: 0.00
- Active fallback pollution count: 236
- AM→PM continuity: WARN / sample_pending
- Fresh-window life signals: WARN / sample_pending

## Fallback Pollution

- active_total: 236
- policy: proposal-only; do not apply cleanup without Alan approval.

## Model Policy Env

- ready: yes
- CHARACTER_SOUL_LOCAL_FALLBACK: false
- SOUL_TRIAD_COLOCATION_PILOT:
- SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS:
- SOUL_TRIAD_FOCUS_PAIR:

## Collection

- attempted: no
`);
  assertOverall(pending, 'PENDING', 'pending report overall status');
  assertStatus(pending, 'local_fallback_blocked', 'PASS');
  assertStatus(pending, 'pilot_env_clean', 'PASS');
  assertStatus(pending, 'fresh_sample_count', 'PENDING');

  const failedMotif = auditReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 3
- Top failure category: prop_echo_repeated
- Fresh fallback markers: 0
- Stage-direction leak sum: 0.00
- Echo penalty sum: 1.00
- Active fallback pollution count: 0
- AM→PM continuity: PASS / continuity_observed
- Fresh-window life signals: WARN / prop_echo_repeated

## Fallback Pollution

- active_total: 0
- policy: proposal-only; do not apply cleanup without Alan approval.

## Model Policy Env

- ready: yes
- CHARACTER_SOUL_LOCAL_FALLBACK: false
- SOUL_TRIAD_COLOCATION_PILOT:
- SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS:
- SOUL_TRIAD_FOCUS_PAIR:

## AM→PM Continuity

- status: PASS
- decision: continuity_observed
- PM callbacks found: 1

## Collection

- attempted: yes
`);
  assertOverall(failedMotif, 'FAIL', 'motif report overall status');
  assertStatus(failedMotif, 'no_fresh_motif_or_hygiene_loop', 'FAIL');

  const staleEnv = auditReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 3
- Top failure category: none
- Fresh fallback markers: 0
- Stage-direction leak sum: 0.00
- Echo penalty sum: 0.00
- Active fallback pollution count: 0
- AM→PM continuity: PASS / continuity_observed
- Fresh-window life signals: PASS / life_signal_observed

## Fallback Pollution

- active_total: 0
- policy: proposal-only; do not apply cleanup without Alan approval.

## Model Policy Env

- ready: no
- CHARACTER_SOUL_LOCAL_FALLBACK: false
- SOUL_TRIAD_COLOCATION_PILOT: true
- SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS:
- SOUL_TRIAD_FOCUS_PAIR:

## AM→PM Continuity

- status: PASS
- decision: continuity_observed
- PM callbacks found: 1

## Collection

- attempted: yes
`);
  assertOverall(staleEnv, 'FAIL', 'stale env report overall status');
  assertStatus(staleEnv, 'pilot_env_clean', 'FAIL');

  console.log('[underworld-v01-goal-audit:self-test] PASS');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function assertOverall(audit, expected, label) {
  if (audit.overallStatus !== expected) {
    const details = audit.checks.map((item) => `${item.id}=${item.status}(${item.reason})`).join(', ');
    throw new Error(`${label}: expected ${expected}, got ${audit.overallStatus}; ${details}`);
  }
}

function assertStatus(audit, id, status) {
  const item = audit.checks.find((checkItem) => checkItem.id === id);
  if (!item) throw new Error(`missing check ${id}`);
  assertEqual(item.status, status, id);
}

#!/usr/bin/env node
// Full v0.1 completion audit for GIIS Underworld.
//
// This is read-only. It combines the narrow v0.1 goal audit with the broader
// roadmap/preflight requirements so completion cannot be inferred from one green
// report while another acceptance criterion is still unproven.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const PATHS = {
  worklog: join(REPO_ROOT, 'WORKLOG.md'),
  alanPlaytestGate: join(REPO_ROOT, 'umi', 'playtest-v01-alan-facing-gate.md'),
  preflight: join(REPO_ROOT, 'docs', 'soul', 'V01_COMPLETION_AUDIT_PREFLIGHT.md'),
  goalAudit: join(REPO_ROOT, 'umi', 'reports', 'v01-goal-audit-latest.md'),
  repairGate: join(REPO_ROOT, 'umi', 'reports', 'v01-repair-gate-latest.md'),
  rubric: join(REPO_ROOT, 'umi', 'reports', 'v01-rubric-reconciliation-latest.md'),
  amPm: join(REPO_ROOT, 'umi', 'reports', 'am-pm-continuity-latest.md'),
  life: join(REPO_ROOT, 'umi', 'reports', 'life-signals-latest.md'),
  recent: join(REPO_ROOT, 'evals', 'conversations', 'reports', 'latest.md'),
  output: join(REPO_ROOT, 'umi', 'reports', 'v01-completion-audit-latest.md'),
};

const args = parseArgs(process.argv.slice(2));
const MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES = 12;
if (args.get('self-test') === 'true') {
  runSelfTest();
  process.exit(0);
}

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(PATHS)
      .filter(([key]) => key !== 'output')
      .map(async ([key, path]) => [key, await readOptional(path)]),
  ),
);

const audit = auditSources(sources, {
  alanPlaytest: args.get('alan-playtest') ?? 'current',
});
await writeReport(audit);
console.log(`[underworld-v01-completion-audit] ${audit.overall}: ${audit.reason}`);
console.log(`[underworld-v01-completion-audit] report written: ${relative(PATHS.output)}`);
if (!['PASS', 'PASS_WITH_DEFERRED'].includes(audit.overall)) process.exitCode = 1;

function auditSources(sources, options = {}) {
  const goal = parseRequirementStatuses(sources.goalAudit);
  const repairDecision = parseBulletSection(sources.repairGate, 'Decision');
  const repairEvidence = parseBulletSection(sources.repairGate, 'Evidence');
  const amPmSummary = parseBulletSection(sources.amPm, 'Summary');
  const lifeSummary = parseBulletSection(sources.life, 'Summary');
  const recentSummary = parseRecentSummary(sources.recent);
  const rubricSummary = parseBulletSection(sources.rubric, 'Summary');

  const amPmStatus = field(amPmSummary, 'Status');
  const amPmDecision = field(amPmSummary, 'Decision');
  const afternoonSamples = numberValue(field(amPmSummary, 'Afternoon sample count'));
  const pmCallbacks = numberValue(field(amPmSummary, 'PM callbacks found'));
  const amResidues = numberValue(field(amPmSummary, 'AM residue candidates'));
  const lifeStatus = field(lifeSummary, 'Status');
  const lifeDecision = field(lifeSummary, 'Decision');
  const ordinaryScenes = numberValue(field(lifeSummary, 'Ordinary-scene conversations'));
  const dailyRhythm = numberValue(field(lifeSummary, 'Daily rhythm conversations'));
  const collapseFlags = numberValue(field(lifeSummary, 'Pilot action collapse flags'));
  const pilotActionMatchRate = numberValue(field(lifeSummary, 'Pilot expected action match rate'));
  const freshSamples = numberValue(field(repairDecision, 'Fresh triad samples') ?? field(repairEvidence, 'Fresh triad samples'));
  const freshFallbackMarkers = numberValue(field(repairEvidence, 'Fresh fallback markers'));
  const activeFallbackPollution = numberValue(field(repairEvidence, 'Active fallback pollution count'));
  const repairChangeSize = field(repairDecision, 'Change size');
  const repairBlockedReasons = field(repairDecision, 'Blocked reasons') ?? '';
  const repairUmiDecision = field(repairDecision, 'Umi decision') ?? '';
  const rubricDecision = sources.rubric.match(/^Decision:\s*(.+)$/m)?.[1]?.trim();
  const goalOverall = sources.goalAudit.match(/^Overall:\s*(.+)$/m)?.[1]?.trim();
  const alanPlaytestPending =
    options.alanPlaytest !== 'pass' &&
    options.alanPlaytest !== 'deferred' &&
    /Alan <-> Umi playtest[\s\S]*pending fresh sample/.test(sources.worklog);
  const alanPlaytestChecklistReady = Boolean(sources.alanPlaytestGate) && /## Test Sequence/.test(sources.alanPlaytestGate);

  const requirements = [
    requirement(
      'character_soul_expression',
      freshSamples >= 3 && lifeStatus === 'PASS' && recentSummary.fail <= 1,
      `freshSamples=${freshSamples}, life=${lifeStatus}/${lifeDecision}, collapseFlags=${collapseFlags}, actionRate=${pilotActionMatchRate}, recent=${recentSummary.text}`,
      freshSamples < 3
        ? 'Need at least 3 fresh triad samples.'
        : lifeStatus !== 'PASS'
          ? 'Latest life-signals evidence does not pass character-soul and role-action checks.'
          : recentSummary.fail > 1
            ? 'Recent eval still has too many FAIL rows to prove distinct soul expression.'
            : 'Character-soul expression is not proven by current evidence.',
    ),
    requirement(
      'conversation_to_emotional_residue',
      amResidues > 0,
      `amResidueCandidates=${amResidues}`,
      'Need human-readable AM residue candidates before continuity can be proven.',
    ),
    requirement(
      'memory_continuity_yesterday_matters',
      amPmStatus === 'PASS' &&
        amPmDecision === 'continuity_observed' &&
        afternoonSamples >= MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES &&
        pmCallbacks > 0,
      `amPm=${amPmStatus}/${amPmDecision}, afternoonSamples=${afternoonSamples}, pmCallbacks=${pmCallbacks}`,
      afternoonSamples < MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES || amPmDecision === 'sample_pending'
        ? `Afternoon sample count is below ${MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES}; continuity is sample-pending, not proven failed.`
        : pmCallbacks === 0
          ? 'No PM callbacks found.'
          : 'AM->PM continuity is not a PASS / continuity_observed result.',
      afternoonSamples < MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES || amPmDecision === 'sample_pending'
        ? 'PENDING'
        : 'FAIL',
    ),
    requirement(
      'event_thread_continuity',
      lifeStatus === 'PASS' && ordinaryScenes > 0 && dailyRhythm > 0,
      `life=${lifeStatus}/${lifeDecision}, ordinaryScenes=${ordinaryScenes}, dailyRhythm=${dailyRhythm}`,
      'Need latest life-signals PASS with ordinary scenes and daily rhythm evidence.',
    ),
    humanAlanRequirement({
      alanPlaytest: options.alanPlaytest,
      alanPlaytestPending,
      alanPlaytestChecklistReady,
    }),
    requirement(
      'fallback_and_provider_hygiene',
      hasStatus(goal, 'local_fallback_blocked', 'PASS') &&
        hasStatus(goal, 'no_fresh_fallback_contamination', 'PASS') &&
        activeFallbackPollution === 0 &&
        freshFallbackMarkers === 0,
      `activeFallbackPollution=${activeFallbackPollution}, freshFallbackMarkers=${freshFallbackMarkers}`,
      'Fallback/provider hygiene is not fully proven in latest goal audit and repair evidence.',
    ),
    requirement(
      'motif_hygiene_and_repair_gate',
      hasStatus(goal, 'no_fresh_motif_or_hygiene_loop', 'PASS') &&
        !/sample_pending|provider_unavailable|timeout|blocked/i.test(repairBlockedReasons) &&
        !/No repair this cycle/i.test(repairUmiDecision) &&
        repairChangeSize !== 'observe_only' &&
        rubricDecision !== 'BLOCKED',
      `goalMotif=${statusOf(goal, 'no_fresh_motif_or_hygiene_loop')}, repairChangeSize=${repairChangeSize}, repairBlockedReasons=${repairBlockedReasons || 'none'}, rubricDecision=${rubricDecision ?? 'unknown'}`,
      'Latest motif/repair/rubric evidence is still not a clean completion pass.',
    ),
    requirement(
      'night_quiet_policy_preserved',
      hasStatus(goal, 'night_quiet_not_forced', 'PASS'),
      `nightQuietGoalStatus=${statusOf(goal, 'night_quiet_not_forced')}`,
      'Night quiet preservation is not proven in latest goal audit.',
    ),
  ];

  const counts = countStatuses(requirements);
  const overall =
    counts.FAIL > 0 ? 'FAIL' : counts.PENDING > 0 ? 'PENDING' : counts.DEFERRED > 0 ? 'PASS_WITH_DEFERRED' : 'PASS';
  return {
    generatedAt: new Date().toISOString(),
    overall,
    reason: `${counts.FAIL} fail, ${counts.PENDING} pending, ${counts.DEFERRED} deferred, ${counts.PASS} pass.`,
    sourcesPresent: Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, Boolean(value)])),
    goalOverall: goalOverall ?? 'unknown',
    rubricDecision: rubricDecision ?? 'unknown',
    requirements,
    nextAction: nextActionFor(requirements),
  };
}

function requirement(id, passed, evidence, failureReason, failureStatus = 'FAIL') {
  return {
    id,
    status: passed ? 'PASS' : failureStatus,
    evidence,
    reason: passed ? 'Requirement is proven by current evidence.' : failureReason,
  };
}

function humanAlanRequirement({ alanPlaytest, alanPlaytestPending, alanPlaytestChecklistReady }) {
  const evidence = `alanPlaytest=${alanPlaytest ?? 'current'}, worklogPending=${alanPlaytestPending}, checklistReady=${alanPlaytestChecklistReady}`;
  if (alanPlaytest === 'pass') {
    return {
      id: 'human_alan_conversation_quality',
      status: 'PASS',
      evidence,
      reason: 'Alan-facing playtest is explicitly marked pass.',
    };
  }
  if (alanPlaytest === 'deferred') {
    return {
      id: 'human_alan_conversation_quality',
      status: 'DEFERRED',
      evidence,
      reason: 'Alan/product-owner explicitly deferred this gate for completion.',
    };
  }
  return {
    id: 'human_alan_conversation_quality',
    status: 'PENDING',
    evidence,
    reason: alanPlaytestPending
      ? alanPlaytestChecklistReady
        ? 'Alan-facing playtest checklist is ready, but WORKLOG still lists the playtest as pending fresh sample.'
        : 'WORKLOG still lists the Alan <-> Umi greeting/correction playtest as pending fresh sample.'
      : 'Need fresh Alan-facing playtest evidence or explicit Alan/product-owner defer.',
  };
}

async function writeReport(audit) {
  await mkdir(dirname(PATHS.output), { recursive: true });
  const lines = [
    '# GIIS Underworld v0.1 Completion Audit',
    '',
    `Generated: ${audit.generatedAt}`,
    `Overall: ${audit.overall}`,
    `Reason: ${audit.reason}`,
    `v0.1 goal audit overall: ${audit.goalOverall}`,
    `Rubric reconciliation decision: ${audit.rubricDecision}`,
    '',
    '## Requirement Status',
    '',
    '| Requirement | Status | Evidence | Reason |',
    '|---|---|---|---|',
    ...audit.requirements.map((item) =>
      [item.id, item.status, item.evidence, item.reason].map(escapeTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'),
    ),
    '',
    '## Source Presence',
    '',
    ...Object.entries(audit.sourcesPresent).map(([key, present]) => `- ${key}: ${present ? 'present' : 'missing'}`),
    '',
    '## Next Action',
    '',
    audit.nextAction,
    '',
    '## Policy',
    '',
    '- This script is read-only and does not trigger conversations or write Convex state.',
    '- Completion requires every non-deferred requirement to be proven by current reports.',
    '- Use `--alan-playtest=deferred` only when Alan/product-owner explicitly defers the Alan-facing playtest gate.',
    '',
  ];
  await writeFile(PATHS.output, `${lines.join('\n')}\n`, 'utf8');
}

function nextActionFor(requirements) {
  const first = requirements.find((item) => item.status === 'FAIL' || item.status === 'PENDING');
  if (!first) {
    const deferred = requirements.filter((item) => item.status === 'DEFERRED');
    if (deferred.length > 0) {
      return `All non-deferred completion requirements are proven; deferred items must remain explicitly documented: ${deferred.map((item) => item.id).join(', ')}.`;
    }
    return 'All current completion requirements are proven; the active goal can be considered for completion.';
  }
  const byId = new Map(requirements.map((item) => [item.id, item]));
  const pendingMemory = byId.get('memory_continuity_yesterday_matters')?.status === 'PENDING';
  const pendingAlan = byId.get('human_alan_conversation_quality')?.status === 'PENDING';
  const motifBlocked = byId.get('motif_hygiene_and_repair_gate')?.status === 'FAIL';
  const soulBlocked = byId.get('character_soul_expression')?.status === 'FAIL';
  if (soulBlocked || pendingMemory || pendingAlan || motifBlocked) {
    const actions = [];
    if (soulBlocked) actions.push('collect/read enough fresh character-soul evidence to clear role-action collapse');
    if (pendingMemory) actions.push('during the next afternoon window, run the afternoon gate or read enough natural PM samples to reach the AM->PM threshold');
    if (pendingAlan) actions.push('run or explicitly defer the Alan-facing Umi playtest using the checklist');
    if (motifBlocked) actions.push('keep repair-gate observe-only until fresh evidence is strong enough for a narrow fix or proposal');
    return `Keep v0.1 active. Next safe action: ${actions.join('; ')}; then rerun this completion audit.`;
  }
  if (first.id === 'memory_continuity_yesterday_matters') {
    return 'Wait for the afternoon window, run `npm run underworld:v01-daytime-check`, then rerun this completion audit.';
  }
  if (first.id === 'human_alan_conversation_quality') {
    return 'Run or explicitly defer the Alan-facing Umi playtest before declaring v0.1 complete.';
  }
  return `Resolve or re-evaluate ${first.id}, then rerun this completion audit.`;
}

function parseRequirementStatuses(report) {
  return new Map(
    [...report.matchAll(/^- (PASS|FAIL|PENDING|WARN) ([^:]+):\s*(.*)$/gm)].map((match) => [
      match[2].trim(),
      { status: match[1], reason: match[3].trim() },
    ]),
  );
}

function hasStatus(map, id, status) {
  return map.get(id)?.status === status;
}

function statusOf(map, id) {
  return map.get(id)?.status ?? 'missing';
}

function parseBulletSection(report, heading) {
  const section = report.match(new RegExp(`## ${escapeRegExp(heading)}\\n\\n([\\s\\S]*?)(?:\\n\\n## |$)`))?.[1] ?? '';
  return Object.fromEntries(
    [...section.matchAll(/^- ([^:\n]+):[ \t]*(.*)$/gm)].map((match) => [normalizeKey(match[1]), match[2].trim()]),
  );
}

function parseRecentSummary(report) {
  const match = report.match(/Post-fix summary:\s*(\d+) PASS\s*\/\s*(\d+) WARN\s*\/\s*(\d+) FAIL/);
  const pass = Number(match?.[1] ?? 0);
  const warn = Number(match?.[2] ?? 0);
  const fail = Number(match?.[3] ?? 0);
  return { pass, warn, fail, text: `${pass} PASS / ${warn} WARN / ${fail} FAIL` };
}

function countStatuses(items) {
  return items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    { PASS: 0, FAIL: 0, PENDING: 0, DEFERRED: 0 },
  );
}

function field(section, key) {
  return section[normalizeKey(key)] ?? section[key];
}

function numberValue(value) {
  const parsed = Number(String(value ?? '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeKey(key) {
  return key.trim().replaceAll(' ', '_');
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

function escapeTableCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\n/g, '<br>');
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function runSelfTest() {
  const pendingAudit = auditSources({
    worklog: 'Next Alan <-> Umi playtest should confirm greeting behavior. | pending fresh sample |',
    alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
    goalAudit: `
Overall: PENDING
- PASS local_fallback_blocked: ok
- PASS no_fresh_fallback_contamination: ok
- PASS no_fresh_motif_or_hygiene_loop: ok
- PASS night_quiet_not_forced: ok
`,
    repairGate: `
## Decision

- Change size: observe_only
- Fresh triad samples: 3
- Blocked reasons: am_pm_sample_pending

## Evidence

- Active fallback pollution count: 0
- Fresh fallback markers: 0
`,
    rubric: 'Decision: BLOCKED\n\n## Summary\n\n- Fresh triad samples: 3\n',
    amPm: `
## Summary

- Status: WARN
- Decision: sample_pending
- Afternoon sample count: 0
- AM residue candidates: 2
- PM callbacks found: 0
`,
    life: `
## Summary

- Status: PASS
- Decision: life_signal_observed
- Ordinary-scene conversations: 2
- Daily rhythm conversations: 2
- Pilot action collapse flags: 0
`,
    recent: 'Post-fix summary: 0 PASS / 1 WARN / 0 FAIL',
    preflight: '# preflight',
  });

  assert(pendingAudit.overall === 'FAIL', 'pending audit should fail before afternoon continuity');
  assert(
    pendingAudit.requirements.find((item) => item.id === 'memory_continuity_yesterday_matters')?.status === 'PENDING',
    'AM->PM sample_pending should keep memory continuity pending',
  );
  assert(
    pendingAudit.requirements.find((item) => item.id === 'human_alan_conversation_quality')?.status === 'PENDING',
    'pending Alan playtest should remain pending',
  );
  assert(
    pendingAudit.requirements
      .find((item) => item.id === 'human_alan_conversation_quality')
      ?.evidence.includes('checklistReady=true'),
    'pending Alan playtest should report checklist readiness without passing',
  );

  const multiBlockerAudit = auditSources({
    worklog: 'Next Alan <-> Umi playtest should confirm greeting behavior. | pending fresh sample |',
    alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
    goalAudit: `
Overall: FAIL
- PASS local_fallback_blocked: ok
- PASS no_fresh_fallback_contamination: ok
- FAIL no_fresh_motif_or_hygiene_loop: echo
- PASS night_quiet_not_forced: ok
`,
    repairGate: `
## Decision

- Change size: observe_only
- Fresh triad samples: 5
- Blocked reasons: am_pm_sample_pending, fresh_triad_samples_below_8

## Evidence

- Active fallback pollution count: 0
- Fresh fallback markers: 0
`,
    rubric: 'Decision: BLOCKED\n\n## Summary\n\n- Fresh triad samples: 5\n',
    amPm: `
## Summary

- Status: WARN
- Decision: sample_pending
- Afternoon sample count: 9
- AM residue candidates: 18
- PM callbacks found: 1
`,
    life: `
## Summary

- Status: WARN
- Decision: prop_echo_repeated
- Ordinary-scene conversations: 12
- Daily rhythm conversations: 18
- Pilot action collapse flags: 5
`,
    recent: 'Post-fix summary: 0 PASS / 1 WARN / 5 FAIL',
    preflight: '# preflight',
  });
  assert(
    multiBlockerAudit.nextAction.includes('next afternoon window') &&
      multiBlockerAudit.nextAction.includes('Alan-facing Umi playtest') &&
      multiBlockerAudit.nextAction.includes('repair-gate observe-only'),
    'multi-blocker audit should name concrete next evidence actions',
  );

  const lifePassWithMinorCollapseAudit = auditSources({
    worklog: 'Next Alan <-> Umi playtest should confirm greeting behavior. | pending fresh sample |',
    alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
    goalAudit: `
Overall: FAIL
- PASS local_fallback_blocked: ok
- PASS no_fresh_fallback_contamination: ok
- FAIL no_fresh_motif_or_hygiene_loop: rubric
- PASS night_quiet_not_forced: ok
`,
    repairGate: `
## Decision

- Change size: observe_only
- Fresh triad samples: 3
- Blocked reasons: am_pm_sample_pending

## Evidence

- Active fallback pollution count: 0
- Fresh fallback markers: 0
`,
    rubric: 'Decision: BLOCKED\n\n## Summary\n\n- Fresh triad samples: 3\n',
    amPm: `
## Summary

- Status: WARN
- Decision: sample_pending
- Afternoon sample count: 0
- AM residue candidates: 9
- PM callbacks found: 0
`,
    life: `
## Summary

- Status: PASS
- Decision: life_signal_observed
- Ordinary-scene conversations: 1
- Daily rhythm conversations: 3
- Pilot expected action match rate: 0.83
- Pilot action collapse flags: 1
`,
    recent: 'Post-fix summary: 0 PASS / 2 WARN / 1 FAIL',
    preflight: '# preflight',
  });
  assert(
    lifePassWithMinorCollapseAudit.requirements.find((item) => item.id === 'character_soul_expression')
      ?.status === 'PASS',
    'life PASS with a minor below-threshold collapse flag should pass character-soul aggregation',
  );
  assert(
    lifePassWithMinorCollapseAudit.nextAction.includes('afternoon gate') &&
      lifePassWithMinorCollapseAudit.nextAction.includes('Alan-facing Umi playtest') &&
      lifePassWithMinorCollapseAudit.nextAction.includes('repair-gate observe-only'),
    'audit should keep naming all remaining blockers after character-soul passes',
  );

  const passAudit = auditSources(
    {
      worklog: 'No pending Alan playtest.',
      alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
      goalAudit: `
Overall: PASS
- PASS local_fallback_blocked: ok
- PASS no_fresh_fallback_contamination: ok
- PASS no_fresh_motif_or_hygiene_loop: ok
- PASS night_quiet_not_forced: ok
`,
      repairGate: `
## Decision

- Change size: none
- Fresh triad samples: 3
- Blocked reasons:

## Evidence

- Active fallback pollution count: 0
- Fresh fallback markers: 0
`,
      rubric: 'Decision: PASS_ALIGNED\n\n## Summary\n\n- Fresh triad samples: 3\n',
      amPm: `
## Summary

- Status: PASS
- Decision: continuity_observed
- Afternoon sample count: 12
- AM residue candidates: 5
- PM callbacks found: 1
`,
      life: `
## Summary

- Status: PASS
- Decision: life_signal_observed
- Ordinary-scene conversations: 2
- Daily rhythm conversations: 2
- Pilot action collapse flags: 0
`,
      recent: 'Post-fix summary: 2 PASS / 1 WARN / 1 FAIL',
      preflight: '# preflight',
    },
    { alanPlaytest: 'pass' },
  );
  assert(passAudit.overall === 'PASS', 'passing evidence should produce PASS');

  const deferredAudit = auditSources(
    {
      ...passAuditFixture(),
      worklog: 'Alan-facing playtest explicitly deferred by product owner.',
    },
    { alanPlaytest: 'deferred' },
  );
  assert(deferredAudit.overall === 'PASS_WITH_DEFERRED', 'explicit defer should produce PASS_WITH_DEFERRED');
  console.log('[underworld-v01-completion-audit:self-test] PASS');
}

function passAuditFixture() {
  return {
    goalAudit: `
Overall: PASS
- PASS local_fallback_blocked: ok
- PASS no_fresh_fallback_contamination: ok
- PASS no_fresh_motif_or_hygiene_loop: ok
- PASS night_quiet_not_forced: ok
`,
    repairGate: `
## Decision

- Change size: none
- Fresh triad samples: 3
- Blocked reasons:

## Evidence

- Active fallback pollution count: 0
- Fresh fallback markers: 0
`,
    rubric: 'Decision: PASS_ALIGNED\n\n## Summary\n\n- Fresh triad samples: 3\n',
    amPm: `
## Summary

- Status: PASS
- Decision: continuity_observed
- Afternoon sample count: 12
- AM residue candidates: 5
- PM callbacks found: 1
`,
    life: `
## Summary

- Status: PASS
- Decision: life_signal_observed
- Ordinary-scene conversations: 2
- Daily rhythm conversations: 2
- Pilot action collapse flags: 0
`,
    recent: 'Post-fix summary: 2 PASS / 1 WARN / 1 FAIL',
    preflight: '# preflight',
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

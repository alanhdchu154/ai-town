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
  alanPlaytestResult: join(REPO_ROOT, 'umi', 'reports', 'alan-facing-v01-playtest-latest.md'),
  preflight: join(REPO_ROOT, 'docs', 'soul', 'V01_COMPLETION_AUDIT_PREFLIGHT.md'),
  goalAudit: join(REPO_ROOT, 'umi', 'reports', 'v01-goal-audit-latest.md'),
  repairGate: join(REPO_ROOT, 'umi', 'reports', 'v01-repair-gate-latest.md'),
  rubric: join(REPO_ROOT, 'umi', 'reports', 'v01-rubric-reconciliation-latest.md'),
  rolling: join(REPO_ROOT, 'umi', 'reports', 'rolling-continuity-latest.md'),
  amPm: join(REPO_ROOT, 'umi', 'reports', 'am-pm-continuity-latest.md'),
  life: join(REPO_ROOT, 'umi', 'reports', 'life-signals-latest.md'),
  recent: join(REPO_ROOT, 'evals', 'conversations', 'reports', 'latest.md'),
  soulTriad: join(REPO_ROOT, 'evals', 'conversations', 'reports', 'soul-triad-latest.md'),
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
  const rollingSummary = parseBulletSection(sources.rolling, 'Summary');
  const lifeSummary = parseBulletSection(sources.life, 'Summary');
  const recentSummary = parseRecentSummary(sources.recent);
  const soulTriadFreshSamples = parseSoulTriadFreshSamples(sources.soulTriad);
  const rubricSummary = parseBulletSection(sources.rubric, 'Summary');
  const alanPlaytestResult = parseAlanPlaytestResult(sources.alanPlaytestResult);

  const amPmStatus = field(amPmSummary, 'Status');
  const amPmDecision = field(amPmSummary, 'Decision');
  const afternoonSamples = numberValue(field(amPmSummary, 'Afternoon sample count'));
  const pmCallbacks = numberValue(field(amPmSummary, 'PM callbacks found'));
  const amResidues = numberValue(field(amPmSummary, 'AM residue candidates'));
  const rollingStatus = field(rollingSummary, 'Status');
  const rollingDecision = field(rollingSummary, 'Decision');
  const rollingSourceSamples = numberValue(field(rollingSummary, 'Source sample count'));
  const rollingCallbackSamples = numberValue(field(rollingSummary, 'Callback sample count'));
  const rollingResidues = numberValue(field(rollingSummary, 'Source residue candidates'));
  const rollingCallbacks = numberValue(field(rollingSummary, 'Rolling callbacks found'));
  const rollingContinuityPass =
    rollingStatus === 'PASS' && rollingDecision === 'continuity_observed' && rollingCallbacks > 0;
  const legacyAmPmContinuityPass =
    amPmStatus === 'PASS' &&
    amPmDecision === 'continuity_observed' &&
    afternoonSamples >= MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES &&
    pmCallbacks > 0;
  const lifeStatus = field(lifeSummary, 'Status');
  const lifeDecision = field(lifeSummary, 'Decision');
  const ordinaryScenes = numberValue(field(lifeSummary, 'Ordinary-scene conversations'));
  const dailyRhythm = numberValue(field(lifeSummary, 'Daily rhythm conversations'));
  const collapseFlags = numberValue(field(lifeSummary, 'Pilot action collapse flags'));
  const pilotActionMatchRate = numberValue(field(lifeSummary, 'Pilot expected action match rate'));
  const freshSamples = Math.max(
    numberValue(field(repairDecision, 'Fresh triad samples')),
    numberValue(field(repairEvidence, 'Fresh triad samples')),
    numberValue(field(rubricSummary, 'Fresh triad samples')),
    soulTriadFreshSamples,
  );
  const freshFallbackMarkers = numberValue(field(repairEvidence, 'Fresh fallback markers'));
  const activeFallbackPollution = numberValue(field(repairEvidence, 'Active fallback pollution count'));
  const repairChangeSize = field(repairDecision, 'Change size');
  const repairBlockedReasons = field(repairDecision, 'Blocked reasons') ?? '';
  const repairUmiDecision = field(repairDecision, 'Umi decision') ?? '';
  const rubricDecision = sources.rubric.match(/^Decision:\s*(.+)$/m)?.[1]?.trim();
  const rubricBlockers = parseListSection(sources.rubric, 'v0.1 Blockers').filter((item) => item !== 'none');
  const rubricQualityGaps = parseListSection(sources.rubric, 'Product Quality Gaps For Human Review').filter(
    (item) => item !== 'none',
  );
  const motifGateBlockedByPendingContinuity =
    hasStatus(goal, 'no_fresh_motif_or_hygiene_loop', 'PASS') &&
    repairChangeSize === 'observe_only' &&
    onlyLegacyContinuityPendingBlockers(repairBlockedReasons, rubricBlockers, rubricDecision);
  const motifRepairCleared =
    hasStatus(goal, 'no_fresh_motif_or_hygiene_loop', 'PASS') &&
    ((rollingContinuityPass && motifGateBlockedByPendingContinuity) ||
      (!/sample_pending|am_pm_sample_pending|provider_unavailable|timeout|blocked/i.test(repairBlockedReasons) &&
        !/No repair this cycle/i.test(repairUmiDecision) &&
        repairChangeSize !== 'observe_only' &&
        rubricDecision !== 'BLOCKED'));
  const recentFailuresAreHumanReviewGaps =
    recentSummary.fail > 1 &&
    lifeStatus === 'PASS' &&
    freshSamples >= 3 &&
    rubricQualityGaps.length > 0 &&
    !rubricBlockers.some((item) => !/AM-?>PM continuity is WARN \/ sample_pending/i.test(item));
  const goalOverall = sources.goalAudit.match(/^Overall:\s*(.+)$/m)?.[1]?.trim();
  const alanPlaytestPending =
    options.alanPlaytest !== 'pass' &&
    options.alanPlaytest !== 'deferred' &&
    /Alan <-> Umi playtest[\s\S]*pending fresh sample/.test(sources.worklog);
  const alanPlaytestChecklistReady = Boolean(sources.alanPlaytestGate) && /## Test Sequence/.test(sources.alanPlaytestGate);

  const requirements = [
    requirement(
      'character_soul_expression',
      freshSamples >= 3 && lifeStatus === 'PASS' && (recentSummary.fail <= 1 || recentFailuresAreHumanReviewGaps),
      `freshSamples=${freshSamples}, life=${lifeStatus}/${lifeDecision}, collapseFlags=${collapseFlags}, actionRate=${pilotActionMatchRate}, recent=${recentSummary.text}, rubricQualityGaps=${rubricQualityGaps.length}`,
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
      rollingResidues > 0 || amResidues > 0,
      `rollingResidueCandidates=${rollingResidues}, amResidueCandidates=${amResidues}`,
      'Need human-readable rolling or day-arc residue candidates before continuity can be proven.',
    ),
    requirement(
      'memory_continuity_yesterday_matters',
      rollingContinuityPass || legacyAmPmContinuityPass,
      `rolling=${rollingStatus || 'missing'}/${rollingDecision || 'missing'}, sourceSamples=${rollingSourceSamples}, callbackSamples=${rollingCallbackSamples}, rollingCallbacks=${rollingCallbacks}; legacyAmPm=${amPmStatus || 'missing'}/${amPmDecision || 'missing'}, afternoonSamples=${afternoonSamples}, pmCallbacks=${pmCallbacks}`,
      !sources.rolling || rollingDecision === 'sample_pending' || rollingDecision === 'residue_pending'
        ? 'Rolling two-hour continuity is sample-pending; recent memory continuity is not proven failed.'
        : rollingDecision === 'weak_continuity'
          ? 'Rolling callbacks are weak or generic; need concrete residue -> callback evidence.'
          : rollingCallbacks === 0 && !legacyAmPmContinuityPass
            ? 'No rolling continuity callback found.'
            : 'Rolling two-hour continuity is not a PASS / continuity_observed result.',
      !sources.rolling ||
        rollingDecision === 'sample_pending' ||
        rollingDecision === 'residue_pending' ||
        (afternoonSamples < MIN_AFTERNOON_CALLBACK_JUDGMENT_SAMPLES && amPmDecision === 'sample_pending')
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
      alanPlaytestResult,
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
      motifRepairCleared,
      `goalMotif=${statusOf(goal, 'no_fresh_motif_or_hygiene_loop')}, repairChangeSize=${repairChangeSize}, repairBlockedReasons=${repairBlockedReasons || 'none'}, rubricDecision=${rubricDecision ?? 'unknown'}`,
      motifGateBlockedByPendingContinuity
        ? 'Motif and repair evidence are not failed, but final rubric/repair clearance is waiting on legacy AM->PM continuity evidence. Rolling continuity can clear this if it passes.'
        : 'Latest motif/repair/rubric evidence is still not a clean completion pass.',
      motifGateBlockedByPendingContinuity && !rollingContinuityPass ? 'PENDING' : 'FAIL',
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

function humanAlanRequirement({ alanPlaytest, alanPlaytestResult, alanPlaytestPending, alanPlaytestChecklistReady }) {
  const resultVerdict = alanPlaytestResult.verdict ?? 'missing';
  const evidence = [
    `alanPlaytest=${alanPlaytest ?? 'current'}`,
    `resultPresent=${alanPlaytestResult.present}`,
    `resultVerdict=${resultVerdict}`,
    `resultLabel=${alanPlaytestResult.label ?? 'unknown'}`,
    `resultChecks=${alanPlaytestResult.passedChecks ?? 0}/${alanPlaytestResult.requiredChecks ?? 0}`,
    `missingChecks=${alanPlaytestResult.missingChecks?.join('|') || 'none'}`,
    `worklogPending=${alanPlaytestPending}`,
    `checklistReady=${alanPlaytestChecklistReady}`,
  ].join(', ');
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
  if (
    alanPlaytestResult.present &&
    alanPlaytestResult.verdict === 'PASS' &&
    alanPlaytestResult.allRequiredChecksPass
  ) {
    return {
      id: 'human_alan_conversation_quality',
      status: 'PASS',
      evidence,
      reason: 'Latest Alan-facing playtest result artifact records a PASS verdict with all required checklist items passing.',
    };
  }
  if (alanPlaytestResult.present && alanPlaytestResult.verdict === 'PASS' && alanPlaytestResult.hasCheckFailures) {
    return {
      id: 'human_alan_conversation_quality',
      status: 'FAIL',
      evidence,
      reason: 'Latest Alan-facing playtest artifact says PASS, but one or more required checklist items are marked FAIL.',
    };
  }
  if (alanPlaytestResult.present && alanPlaytestResult.verdict === 'PASS') {
    return {
      id: 'human_alan_conversation_quality',
      status: 'PENDING',
      evidence,
      reason: 'Latest Alan-facing playtest artifact says PASS, but it is missing required checklist PASS lines.',
    };
  }
  if (alanPlaytestResult.present && alanPlaytestResult.verdict === 'FAIL') {
    return {
      id: 'human_alan_conversation_quality',
      status: 'FAIL',
      evidence,
      reason: 'Latest Alan-facing playtest result artifact records a FAIL verdict.',
    };
  }
  if (alanPlaytestResult.present && alanPlaytestResult.verdict === 'PARTIAL') {
    return {
      id: 'human_alan_conversation_quality',
      status: 'PENDING',
      evidence,
      reason: 'Latest Alan-facing playtest result artifact is PARTIAL; keep v0.1 active and file the smallest evidence-backed fix.',
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
      : alanPlaytestResult.present
        ? 'Alan-facing playtest result artifact is present but has no PASS/PARTIAL/FAIL verdict.'
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
    '- If present, `umi/reports/alan-facing-v01-playtest-latest.md` is treated as the durable Alan-facing playtest result.',
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
    if (soulBlocked) actions.push('collect/read or review enough fresh character-soul evidence to clear the current soul blocker');
    if (pendingMemory) actions.push('run/read the rolling two-hour continuity report after enough adjacent recent windows exist');
    if (pendingAlan) actions.push('run or explicitly defer the Alan-facing Umi playtest using the checklist');
    if (motifBlocked) actions.push('keep repair-gate observe-only until fresh evidence is strong enough for a narrow fix or proposal');
    return `Keep v0.1 active. Next safe action: ${actions.join('; ')}; then rerun this completion audit.`;
  }
  if (first.id === 'memory_continuity_yesterday_matters') {
    return 'Run `npm run underworld:rolling-continuity`, then rerun this completion audit once adjacent two-hour windows have enough source and callback conversations.';
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
  const text = String(report ?? '');
  const section = text.match(new RegExp(`## ${escapeRegExp(heading)}\\n\\n([\\s\\S]*?)(?:\\n\\n## |$)`))?.[1] ?? '';
  return Object.fromEntries(
    [...section.matchAll(/^- ([^:\n]+):[ \t]*(.*)$/gm)].map((match) => [normalizeKey(match[1]), match[2].trim()]),
  );
}

function parseListSection(report, heading) {
  const section = report.match(new RegExp(`## ${escapeRegExp(heading)}\\n\\n([\\s\\S]*?)(?:\\n\\n## |$)`))?.[1] ?? '';
  return [...section.matchAll(/^- (.+)$/gm)].map((match) => match[1].trim());
}

function onlyLegacyContinuityPendingBlockers(repairBlockedReasons, rubricBlockers, rubricDecision) {
  const repairReasons = repairBlockedReasons
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const repairOk = repairReasons.length === 0 || repairReasons.every((item) => item === 'am_pm_sample_pending');
  const rubricOk =
    rubricDecision !== 'BLOCKED' ||
    (rubricBlockers.length > 0 &&
      rubricBlockers.every((item) => /AM-?>PM continuity is WARN \/ sample_pending/i.test(item)));
  return repairOk && rubricOk;
}

function parseRecentSummary(report) {
  const match = report.match(/Post-fix summary:\s*(\d+) PASS\s*\/\s*(\d+) WARN\s*\/\s*(\d+) FAIL/);
  const pass = Number(match?.[1] ?? 0);
  const warn = Number(match?.[2] ?? 0);
  const fail = Number(match?.[3] ?? 0);
  return { pass, warn, fail, text: `${pass} PASS / ${warn} WARN / ${fail} FAIL` };
}

function parseSoulTriadFreshSamples(report) {
  const text = String(report ?? '');
  return text
    .split('\n')
    .filter((line) => /^conversation-[^|]+\|/.test(line.trim()))
    .length;
}

function parseAlanPlaytestResult(report) {
  const text = String(report ?? '');
  const requiredChecks = [
    'Greeting Binding',
    'Latest-Sentence Binding',
    'Correction Binding',
    'Yesterday / Today Continuity',
    'Closing / Idle Boundary',
  ];
  if (!text.trim()) {
    return {
      present: false,
      verdict: 'missing',
      label: 'missing',
      requiredChecks: requiredChecks.length,
      passedChecks: 0,
      missingChecks: requiredChecks,
      allRequiredChecksPass: false,
      hasCheckFailures: false,
    };
  }
  const verdictMatches = [...text.matchAll(/^Verdict:\s*(PASS|PARTIAL|FAIL)\b/gim)];
  const labelMatches = [...text.matchAll(/^## Playtest Result\s*-\s*(.+)$/gim)];
  const checkStatuses = Object.fromEntries(
    requiredChecks.map((label) => {
      const match = text.match(new RegExp(`^\\s*\\d+\\.\\s*${escapeRegExp(label)}:\\s*(PASS|PARTIAL|FAIL)\\b`, 'im'));
      return [label, match?.[1]?.toUpperCase()];
    }),
  );
  const missingChecks = requiredChecks.filter((label) => !checkStatuses[label]);
  const passedChecks = requiredChecks.filter((label) => checkStatuses[label] === 'PASS').length;
  const hasCheckFailures = requiredChecks.some((label) => checkStatuses[label] === 'FAIL');
  return {
    present: true,
    verdict: verdictMatches.at(-1)?.[1]?.toUpperCase() ?? 'UNKNOWN',
    label: labelMatches.at(-1)?.[1]?.trim() ?? 'unlabeled',
    requiredChecks: requiredChecks.length,
    passedChecks,
    missingChecks,
    allRequiredChecksPass: passedChecks === requiredChecks.length,
    hasCheckFailures,
  };
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
    rolling: `
## Summary

- Status: WARN
- Decision: sample_pending
- Source sample count: 1
- Callback sample count: 0
- Source residue candidates: 2
- Rolling callbacks found: 0
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
    'rolling sample_pending should keep memory continuity pending',
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
  assert(
    pendingAudit.requirements
      .find((item) => item.id === 'human_alan_conversation_quality')
      ?.evidence.includes('resultPresent=false'),
    'missing Alan playtest result should be visible in evidence',
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
    multiBlockerAudit.nextAction.includes('rolling two-hour continuity') &&
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
    lifePassWithMinorCollapseAudit.nextAction.includes('rolling two-hour continuity') &&
      lifePassWithMinorCollapseAudit.nextAction.includes('Alan-facing Umi playtest') &&
      lifePassWithMinorCollapseAudit.nextAction.includes('repair-gate observe-only'),
    'audit should keep naming all remaining blockers after character-soul passes',
  );

  const soulTriadFallbackAudit = auditSources({
    worklog: 'No pending Alan playtest.',
    alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
    alanPlaytestResult: `
## Playtest Result - 2026-06-04 14:30 CDT

1. Greeting Binding: PASS
2. Latest-Sentence Binding: PASS
3. Correction Binding: PASS
4. Yesterday / Today Continuity: PASS
5. Closing / Idle Boundary: PASS

Verdict: PASS
`,
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
- Blocked reasons:

## Evidence

- Active fallback pollution count: 0
- Fresh fallback markers: 0
`,
    rubric: 'Decision: PASS_ALIGNED\n\n## Summary\n\n',
    amPm: `
## Summary

- Status: PASS
- Decision: continuity_observed
- Afternoon sample count: 12
- AM residue candidates: 5
- PM callbacks found: 1
`,
    rolling: `
## Summary

- Status: PASS
- Decision: continuity_observed
- Source sample count: 2
- Callback sample count: 2
- Source residue candidates: 5
- Rolling callbacks found: 1
`,
    life: `
## Summary

- Status: PASS
- Decision: life_signal_observed
- Ordinary-scene conversations: 2
- Daily rhythm conversations: 2
- Pilot action collapse flags: 0
`,
    recent: 'Post-fix summary: 0 PASS / 2 WARN / 1 FAIL',
    soulTriad: `
| Conversation | Participants | Messages | Status |
|---|---|---:|---|
conversation-c:1 | 海 / 真晝 | 6 | PASS |
conversation-c:2 | 天澤 / 一之瀨 | 6 | PASS |
conversation-c:3 | 貓貓 / 祥子 | 6 | PASS |
`,
    preflight: '# preflight',
  });
  assert(
    soulTriadFallbackAudit.requirements.find((item) => item.id === 'character_soul_expression')?.status ===
      'PASS',
    'completion audit should fall back to soul-triad report rows for fresh sample count',
  );

  const amPmOnlyPendingAudit = auditSources({
    worklog: 'Next Alan <-> Umi playtest should confirm greeting behavior. | pending fresh sample |',
    alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
    goalAudit: `
Overall: PENDING
- PASS local_fallback_blocked: ok
- PASS no_fresh_fallback_contamination: ok
- PASS no_fresh_motif_or_hygiene_loop: ok
- PENDING yesterday_matters_signal: sample pending
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
    rubric: `
Decision: BLOCKED

## Summary

- Fresh triad samples: 3

## v0.1 Blockers

- AM->PM continuity is WARN / sample_pending
`,
    amPm: `
## Summary

- Status: WARN
- Decision: sample_pending
- Afternoon sample count: 0
- AM residue candidates: 9
- PM callbacks found: 0
`,
    rolling: `
## Summary

- Status: PASS
- Decision: continuity_observed
- Source sample count: 2
- Callback sample count: 2
- Source residue candidates: 4
- Rolling callbacks found: 1
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
    amPmOnlyPendingAudit.requirements.find((item) => item.id === 'motif_hygiene_and_repair_gate')
      ?.status === 'PASS',
    'motif/repair gate should pass when only legacy AM-PM evidence is missing and rolling continuity passes',
  );

  const recentHumanReviewGapAudit = auditSources({
    worklog: 'Next Alan <-> Umi playtest should confirm greeting behavior. | pending fresh sample |',
    alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
    goalAudit: `
Overall: PENDING
- PASS local_fallback_blocked: ok
- PASS no_fresh_fallback_contamination: ok
- PASS no_fresh_motif_or_hygiene_loop: ok
- PENDING yesterday_matters_signal: sample pending
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
    rubric: `
Decision: BLOCKED

## Summary

- Fresh triad samples: 3

## v0.1 Blockers

- AM->PM continuity is WARN / sample_pending

## Product Quality Gaps For Human Review

- voice_rubric_gap (1): recent eval does not see enough character-specific wording; needs human playtest before prompt tuning
- reply_binding_rubric_gap (2): responses may mirror the previous speaker too neatly; check by reading transcript, not score alone
`,
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
- Ordinary-scene conversations: 3
- Daily rhythm conversations: 4
- Pilot expected action match rate: 0.69
- Pilot action collapse flags: 3
`,
    recent: 'Post-fix summary: 0 PASS / 1 WARN / 3 FAIL',
    preflight: '# preflight',
  });
  assert(
    recentHumanReviewGapAudit.requirements.find((item) => item.id === 'character_soul_expression')
      ?.status === 'PASS',
    'recent eval failures classified as human-review gaps should not fail character-soul when life signals pass',
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
      rolling: `
## Summary

- Status: PASS
- Decision: continuity_observed
- Source sample count: 2
- Callback sample count: 2
- Source residue candidates: 5
- Rolling callbacks found: 1
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

  const artifactPassAudit = auditSources({
    ...passAuditFixture(),
    worklog: 'No pending Alan playtest.',
    alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
    alanPlaytestResult: `
## Playtest Result - 2026-06-04 14:30 CDT

1. Greeting Binding: PASS
2. Latest-Sentence Binding: PASS
3. Correction Binding: PASS
4. Yesterday / Today Continuity: PASS
5. Closing / Idle Boundary: PASS

Verdict: PASS
`,
  });
  assert(artifactPassAudit.overall === 'PASS', 'PASS playtest artifact should clear Alan-facing gate');

  const artifactThinPassAudit = auditSources({
    ...passAuditFixture(),
    worklog: 'No pending Alan playtest.',
    alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
    alanPlaytestResult: '## Playtest Result - 2026-06-04 14:30 CDT\n\nVerdict: PASS\n',
  });
  assert(
    artifactThinPassAudit.requirements.find((item) => item.id === 'human_alan_conversation_quality')?.status ===
      'PENDING',
    'thin PASS playtest artifact should not clear Alan-facing gate',
  );

  const artifactContradictoryPassAudit = auditSources({
    ...passAuditFixture(),
    worklog: 'No pending Alan playtest.',
    alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
    alanPlaytestResult: `
## Playtest Result - 2026-06-04 14:30 CDT

1. Greeting Binding: PASS
2. Latest-Sentence Binding: PASS
3. Correction Binding: FAIL
4. Yesterday / Today Continuity: PASS
5. Closing / Idle Boundary: PASS

Verdict: PASS
`,
  });
  assert(
    artifactContradictoryPassAudit.overall === 'FAIL',
    'contradictory PASS playtest artifact with a failed subcheck should fail completion audit',
  );

  const artifactPartialAudit = auditSources({
    ...passAuditFixture(),
    worklog: 'No pending Alan playtest.',
    alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
    alanPlaytestResult: '## Playtest Result - 2026-06-04 14:30 CDT\n\nVerdict: PARTIAL\n',
  });
  assert(
    artifactPartialAudit.requirements.find((item) => item.id === 'human_alan_conversation_quality')?.status ===
      'PENDING',
    'PARTIAL playtest artifact should keep Alan-facing gate pending',
  );

  const artifactFailAudit = auditSources({
    ...passAuditFixture(),
    worklog: 'No pending Alan playtest.',
    alanPlaytestGate: '# Alan-Facing Umi v0.1 Playtest Gate\n\n## Test Sequence\n',
    alanPlaytestResult: '## Playtest Result - 2026-06-04 14:30 CDT\n\nVerdict: FAIL\n',
  });
  assert(artifactFailAudit.overall === 'FAIL', 'FAIL playtest artifact should fail completion audit');

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
    rolling: `
## Summary

- Status: PASS
- Decision: continuity_observed
- Source sample count: 2
- Callback sample count: 2
- Source residue candidates: 5
- Rolling callbacks found: 1
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

#!/usr/bin/env node
// GIIS Underworld v0.1 observe pass.
//
// Observe is allowed to collect samples, run evals, check health, ask cc for a
// read-only review, and write reports. It must not edit code.

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const COMMAND_ENV = {
  ...process.env,
  CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
    process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180',
  CONVERSATION_EVAL_CONVEX_TIMEOUT_MS: process.env.CONVERSATION_EVAL_CONVEX_TIMEOUT_MS ?? '180000',
};
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'v01-approach-latest.md');
const AM_PM_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'am-pm-continuity-latest.md');
const LIFE_SIGNALS_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'life-signals-latest.md');
const EVIDENCE_PILOT_NAMES = new Set([
  '海',
  '真晝',
  '貓貓',
  '天澤',
  '一之瀨',
  '祥子',
  'Umi',
  'Mahiru',
  'Mahiru Shiina',
  'Maomao',
  'Tianze',
  'Ichinose',
  'Sakiko',
]);
const EVIDENCE_PILOT_CANONICAL = new Set(['海', '真晝', '貓貓', '天澤', '一之瀨', '祥子']);
const EVIDENCE_PILOT_NAME_BY_RAW = new Map([
  ['海', '海'],
  ['Umi', '海'],
  ['真晝', '真晝'],
  ['Mahiru', '真晝'],
  ['Mahiru Shiina', '真晝'],
  ['貓貓', '貓貓'],
  ['Maomao', '貓貓'],
  ['天澤', '天澤'],
  ['Tianze', '天澤'],
  ['一之瀨', '一之瀨'],
  ['Ichinose', '一之瀨'],
  ['祥子', '祥子'],
  ['Sakiko', '祥子'],
]);
const POLICY_ENV_KEYS = [
  'AUTONOMOUS_CONVERSATION_LLM',
  'AUTONOMOUS_CONVERSATION_LLM_PAIRS',
  'CHARACTER_SOUL_LOCAL_FALLBACK',
  'LLM_PROVIDER',
  'OLLAMA_MODEL',
  'UMI_MAHIRU_PILOT_DAILY_QUOTA',
  'UMI_MAHIRU_PILOT_PROVIDER',
  'SOUL_TRIAD_COLOCATION_PILOT',
  'SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS',
  'SOUL_TRIAD_FOCUS_PAIR',
];

const args = parseArgs(process.argv.slice(2));
const SELF_TEST = args.get('self-test') === 'true';
const DRY_RUN = args.get('dry-run') === 'true';
const COLLECT_MODE = args.get('collect') ?? 'auto';
const CC_MODE = args.get('cc') ?? 'auto';
const TARGET_SAMPLES = numberArg('target-samples', 1, 0, 3);
const SAMPLE_TIMEOUT_MS = numberArg('sample-timeout-ms', DRY_RUN ? 1_000 : 180_000, 1_000, 300_000);
const SAMPLE_POLL_MS = numberArg('sample-poll-ms', 7_000, 1_000, 30_000);
const REQUIRE_ARCHIVED_SAMPLES = args.get('require-archived') === 'true';
// Rotate the collected dyad across the current v0.1 evidence pilot so the
// observe loop does not quietly fall back to the old Umi/Mahiru/Tianze triad.
// Disable with --no-focus-rotation.
const FOCUS_ROTATION = [
  'Umi:Mahiru',
  'Tianze:Ichinose',
  'Ichinose:Maomao',
  'Sakiko:Tianze',
  'Mahiru:Maomao',
  'Umi:Tianze',
];
const FOCUS_ROTATION_ENABLED = args.get('no-focus-rotation') !== 'true';
const RUN_STARTED_AT = Date.now();
const RUN_ISO = new Date(RUN_STARTED_AT).toISOString();
const EVAL_SINCE_AT = numberArg('since-created-at', RUN_STARTED_AT, 0, Number.MAX_SAFE_INTEGER);

async function main() {
  console.log(`[underworld-observe] started ${RUN_ISO}`);
  console.log('[underworld-observe] policy: observe/report only; no code edits');

  const timing = chicagoTiming();
  const health = await collectHealth();
  const policyEnv = await collectPolicyEnv();
  const collection = await maybeCollectSamples(timing, health);
  const freshConversations = await fetchFreshTriadConversations(EVAL_SINCE_AT);
  const experienceEvidence = await collectExperienceEvidence(health, freshConversations);
  printTranscripts(freshConversations);

  const evals = await runEvals();
  const amPmContinuity = await runAmPmContinuity();
  const lifeSignals = await runLifeSignals();
  const dayWindowLifeSignals = await runDayWindowLifeSignals();
  const reports = await readEvalReports();
  const fallbackAudit = await convexRunSafe('school:auditFallbackPollution', { limit: 1000 });
  const findings = analyzeFindings({
    timing,
    health,
    policyEnv,
    collection,
    freshConversations,
    amPmContinuity,
    lifeSignals,
    dayWindowLifeSignals,
    reports,
    fallbackAudit,
    experienceEvidence,
  });
  const scores = estimateV01Scores({ findings, freshConversations, reports, health, fallbackAudit });
  const ccReview = await maybeRunCcReview({ findings, scores, freshConversations, reports });

  await writeReport({
    timing,
    health,
    policyEnv,
    collection,
    freshConversations,
    evals,
    amPmContinuity,
    lifeSignals,
    dayWindowLifeSignals,
    reports,
    fallbackAudit,
    experienceEvidence,
    findings,
    scores,
    ccReview,
  });

  console.log(`[underworld-observe] report written: ${relative(REPORT_PATH)}`);
  console.log(`[underworld-observe] next safest action: ${findings.nextSafestAction}`);
}

async function maybeCollectSamples(timing, health) {
  const skipReason = collectionSkipReason(timing, COLLECT_MODE);
  const shouldCollect = shouldAttemptSampleCollection({
    dryRun: DRY_RUN,
    collectMode: COLLECT_MODE,
    targetSamples: TARGET_SAMPLES,
    timing,
  });

  const result = {
    mode: COLLECT_MODE,
    attempted: shouldCollect,
    dryRun: DRY_RUN,
    attempts: [],
    providerHealth: DRY_RUN ? 'not_checked_dry_run' : 'not_checked',
    worldEngineStatusBefore: health.worldEngineStatus,
    worldEngineResumedBeforeCollection: false,
  };

  if (DRY_RUN) {
    console.log('[underworld-observe] dry-run: sample collection skipped');
    return result;
  }
  if (skipReason === 'night_quiet') {
    console.log('[underworld-observe] night quiet: sample collection skipped');
    result.providerHealth = 'not_checked_night_quiet';
    return result;
  }
  if (skipReason === 'winding_down_quiet') {
    console.log('[underworld-observe] winding-down quiet: sample collection skipped');
    result.providerHealth = 'not_checked_winding_down';
    return result;
  }
  if (!shouldCollect) {
    console.log('[underworld-observe] sample collection skipped by configuration');
    return result;
  }

  if (shouldResumeWorldBeforeCollection(timing, health.worldEngineStatus)) {
    console.log(
      `[underworld-observe] world engine is ${health.worldEngineStatus}; child sample runner will resume it in a controlled window`,
    );
    result.worldEngineResumedBeforeCollection = false;
  }

  for (let index = 0; index < TARGET_SAMPLES; index += 1) {
    const focusPair = FOCUS_ROTATION_ENABLED
      ? FOCUS_ROTATION[index % FOCUS_ROTATION.length]
      : undefined;
    console.log(
      `[underworld-observe] collecting scoped triad sample ${index + 1}/${TARGET_SAMPLES}` +
        `${focusPair ? ` (focus=${focusPair})` : ''}`,
    );
    const command = [
      'run',
      'pilot:soul-triad:single-sample',
      '--',
      `--timeout-ms=${SAMPLE_TIMEOUT_MS}`,
      `--poll-interval-ms=${SAMPLE_POLL_MS}`,
      '--pair-cooldown-ms=0',
      '--provider-cooldown-ms=0',
      ...(REQUIRE_ARCHIVED_SAMPLES ? ['--require-archived=true'] : []),
      ...(focusPair ? [`--focus-pair=${focusPair}`] : []),
    ];
    const run = await runCommand('npm', command, { timeout: SAMPLE_TIMEOUT_MS + 120_000 });
    const combined = `${run.stdout}\n${run.stderr}`;
    const providerUnavailable = providerUnavailableFromOutput(run.code, combined);
    result.attempts.push({
      code: run.code,
      ok: run.code === 0,
      providerUnavailable,
      sampleId: combined.match(/fresh archived sample\s+(\S+)/)?.[1],
      preview: combined.slice(-1600),
    });
    if (providerUnavailable) break;
  }

  result.providerHealth = result.attempts.some((attempt) => attempt.providerUnavailable)
    ? 'unavailable'
    : result.attempts.some((attempt) => attempt.ok)
      ? 'ok'
      : 'unknown';

  await restoreWorldEngineAfterCollection(health.worldEngineStatus);
  return result;
}

async function collectHealth() {
  const [worldClock, debugState, defaultWorldStatus] = await Promise.all([
    convexRunSafe('school:worldClock'),
    convexRunSafe('school:debugState'),
    convexRunSafe('world:defaultWorldStatus'),
  ]);
  return {
    worldClock,
    debugState,
    defaultWorldStatus,
    worldEngineStatus: defaultWorldStatus.data?.status,
    playerCount: Array.isArray(debugState.data) ? debugState.data.length : undefined,
    healthy: worldClock.ok && debugState.ok,
  };
}

async function collectPolicyEnv() {
  const entries = await Promise.all(
    POLICY_ENV_KEYS.map(async (key) => [key, await convexEnvGetSafe(key)]),
  );
  const values = Object.fromEntries(entries);
  return {
    values,
    ready: isModelPolicyEnvReady(values),
  };
}

async function collectExperienceEvidence(health, freshConversations = []) {
  const worldId = health.defaultWorldStatus?.data?.worldId;
  const [experienceLogs, sleepNotes] = await Promise.all([
    worldId
      ? convexRunSafe('agent/experienceLog:recentExperienceLogs', {
          worldId,
          limit: 24,
        })
      : Promise.resolve({ ok: false, data: [] }),
    convexRunSafe('sleepNotes:sleepNotesSummary', {}),
  ]);
  const rows = Array.isArray(experienceLogs.data) ? experienceLogs.data : [];
  const freshStatuses = freshConversations.map((conversation) =>
    freshExperienceLogStatus(conversation, rows),
  );
  const rejectionReasonHistogram = reasonHistogram(freshStatuses);
  return {
    ok: experienceLogs.ok && sleepNotes.ok,
    experienceLogs: rows,
    freshStatuses,
    createdForFreshSamples: freshStatuses.filter((status) => status.created).length,
    rejectedFreshSamples: freshStatuses.filter((status) => !status.created),
    rejectionReasonHistogram,
    experienceLogCount: rows.length,
    subjectiveExperienceLogCount: rows.filter(isSubjectiveExperienceLogRow).length,
    nonSubjectiveExperienceLogCount: rows.filter((row) => !isSubjectiveExperienceLogRow(row)).length,
    behaviorHintCount: rows.filter((row) => row.behaviorHint).length,
    residueCount: rows.filter((row) => row.residue).length,
    sleepNotes: sleepNotes.data,
    sleepNoteCount: sleepNotes.data?.count ?? 0,
    sleepNotePromoted: sleepNotes.data?.promoted ?? 0,
    sleepNoteFreshEvalEligible: sleepNotes.data?.freshEvalEligible ?? 0,
  };
}

async function convexEnvGetSafe(key) {
  const result = await runCommand('npx', ['convex', 'env', 'get', key], {
    timeout: 45_000,
    quiet: true,
  });
  if (result.code !== 0) return undefined;
  return result.stdout.trim();
}

async function fetchFreshTriadConversations(sinceCreatedAt) {
  const data = await convexRunSafe('school:recentConversationEvalData', {
    limit: 24,
    compact: true,
    messagesPerConversation: 12,
    sinceCreatedAt,
  });
  const conversations = Array.isArray(data.data?.conversations) ? data.data.conversations : [];
  return conversations.filter(isTriadConversation);
}

async function runEvals() {
  const soulTriad = await runCommand(
    'npm',
    ['run', 'eval:soul-triad', '--', `--since-created-at=${EVAL_SINCE_AT}`],
    { timeout: 90_000 },
  );
  const recent = await runCommand(
    'npm',
    ['run', 'eval:conversation:recent', '--', `--since-created-at=${EVAL_SINCE_AT}`],
    { timeout: 90_000 },
  );
  return { soulTriad, recent };
}

async function runAmPmContinuity() {
  const command = await runCommand('npm', ['run', 'underworld:am-pm-continuity'], {
    timeout: 90_000,
    quiet: true,
  });
  const report = await readOptional(AM_PM_REPORT_PATH);
  return {
    code: command.code,
    report,
    summary: parseAmPmSummary(report),
    output: `${command.stdout}\n${command.stderr}`.trim().slice(-2000),
  };
}

async function runLifeSignals() {
  const command = await runCommand('npm', ['run', 'underworld:life-signals', '--', `--since-created-at=${EVAL_SINCE_AT}`], {
    timeout: 90_000,
    quiet: true,
  });
  const report = await readOptional(LIFE_SIGNALS_REPORT_PATH);
  return {
    code: command.code,
    report,
    summary: parseLifeSignalsSummary(report),
    output: `${command.stdout}\n${command.stderr}`.trim().slice(-2000),
  };
}

async function runDayWindowLifeSignals() {
  const command = await runCommand('npm', ['run', 'underworld:life-signals'], {
    timeout: 90_000,
    quiet: true,
  });
  const report = await readOptional(LIFE_SIGNALS_REPORT_PATH);
  return {
    code: command.code,
    report,
    summary: parseLifeSignalsSummary(report),
    output: `${command.stdout}\n${command.stderr}`.trim().slice(-2000),
  };
}

async function readEvalReports() {
  return {
    soulTriad: await readOptional(join(REPO_ROOT, 'evals', 'conversations', 'reports', 'soul-triad-latest.md')),
    recent: await readOptional(join(REPO_ROOT, 'evals', 'conversations', 'reports', 'latest.md')),
  };
}

function analyzeFindings({
  timing,
  health,
  collection,
  freshConversations,
  amPmContinuity,
  lifeSignals,
  dayWindowLifeSignals,
  reports,
  fallbackAudit,
  experienceEvidence,
}) {
  const reportText = `${reports.soulTriad}\n${reports.recent}`;
  const statusCounts = statusCountsFromSoulReport(reports.soulTriad);
  const recentStatusCounts = statusCountsFromRecentReport(reports.recent);
  const stageDirectionLeaks = sumNumericColumn(reports.soulTriad, 'Stage direction leak penalty');
  const echoPenalty = sumNumericColumn(reports.soulTriad, 'Echo penalty');
  const archivedFallbackHistoryCount = fallbackAudit.data?.fallbackArchivedConversationCount ?? 0;
  const activeFallbackPollutionCount =
    (fallbackAudit.data?.fallbackMemoryCount ?? 0) +
    (fallbackAudit.data?.fallbackEventCount ?? 0) +
    (fallbackAudit.data?.fallbackNotificationCount ?? 0) +
    (fallbackAudit.data?.pollutedProfileCount ?? 0);
  const wrongAddressee = /wrong addressee|wrongAddressee/i.test(reportText);
  const providerUnavailable = collection.providerHealth === 'unavailable';
  const freshFallbackMarkers = countFreshFallbackMarkers(freshConversations);
  const rubricDisagreement =
    statusCounts.FAIL === 0 && recentStatusCounts.FAIL > 0 && freshConversations.length > 0;
  const recentFailureReason = firstRecentFailureReason(reports.recent);
  const experienceResidueObserved = (experienceEvidence?.residueCount ?? 0) > 0;
  const behaviorEvidenceObserved = (experienceEvidence?.behaviorHintCount ?? 0) > 0;

  let topFailureCategory = 'none';
  if (!health.healthy) topFailureCategory = 'runtime_health';
  else if (providerUnavailable) topFailureCategory = 'provider_failure_handling';
  else if (freshFallbackMarkers > 0) topFailureCategory = 'fallback_contamination';
  else if (stageDirectionLeaks > 0) topFailureCategory = 'stage_direction_leak';
  else if (wrongAddressee) topFailureCategory = 'wrong_addressee';
  else if (rubricDisagreement) topFailureCategory = 'eval_rubric_disagreement';
  else if (freshConversations.length < 3) topFailureCategory = 'sample_pending';
  else if (echoPenalty > 0) topFailureCategory = 'echo_repetition';
  else if (statusCounts.FAIL > 0) topFailureCategory = 'soul_quality_gap';
  else if (recentStatusCounts.FAIL > 0) topFailureCategory = 'conversation_quality_gap';

  const observedIssue =
    freshFallbackMarkers > 0
      ? 'fallback_contamination'
      : stageDirectionLeaks > 0
        ? 'stage_direction_leak'
        : wrongAddressee
          ? 'wrong_addressee'
          : rubricDisagreement
            ? 'eval_rubric_disagreement'
            : echoPenalty > 0
              ? 'echo_repetition'
              : statusCounts.FAIL > 0
                ? 'soul_quality_gap'
                : recentStatusCounts.FAIL > 0
                  ? 'conversation_quality_gap'
                  : 'none';
  const repairConfidenceBlockers = repairConfidenceBlockersFor({
    topFailureCategory,
    repairCategory: topFailureCategory,
    freshTriadSamples: freshConversations.length,
    recentFailureReason,
    amPm: amPmContinuity?.summary,
    lifeSignals: lifeSignals?.summary,
    dayWindowLifeSignals: dayWindowLifeSignals?.summary,
  });
  const baseRepairClass = repairClassFor(topFailureCategory);
  const repairClass =
    baseRepairClass === 'auto_fix_allowed' && repairConfidenceBlockers.length
      ? 'observe_only'
      : baseRepairClass;
  const nextSafestAction =
    topFailureCategory === 'eval_rubric_disagreement'
      ? 'reconcile eval framing before changing dialogue code'
    : topFailureCategory === 'sample_pending'
      ? 'wait for more fresh samples; do not modify code'
      : repairConfidenceBlockers.length
      ? `keep observing ${topFailureCategory}; blockers: ${repairConfidenceBlockers.join(', ')}`
      : repairClass === 'auto_fix_allowed'
        ? `repair gate may inspect ${topFailureCategory}; apply only if evidence is specific`
        : repairClass === 'proposal_only'
          ? `write proposal before changing ${topFailureCategory}`
          : 'continue observing';

  return {
    statusCounts,
    recentStatusCounts,
    topFailureCategory,
    baseRepairClass,
    repairClass,
    repairConfidenceBlockers,
    stageDirectionLeaks,
    echoPenalty,
    activeFallbackPollutionCount,
    archivedFallbackHistoryCount,
    freshFallbackMarkers,
    wrongAddressee,
    providerUnavailable,
    rubricDisagreement,
    recentFailureReason,
    observedIssue,
    enoughFreshSamples: freshConversations.length >= 3,
    experienceResidueObserved,
    behaviorEvidenceObserved,
    nightQuiet: timing.isNight,
    nextSafestAction,
  };
}

function repairClassFor(category) {
  if (
    [
      'wrong_addressee',
      'stage_direction_leak',
      'fallback_contamination',
      'echo_repetition',
      'eval_parser_or_report_bug',
      'provider_failure_handling',
    ].includes(category)
  ) {
    return 'auto_fix_allowed';
  }
  if (category === 'none' || category === 'sample_pending') return 'observe_only';
  if (category === 'eval_rubric_disagreement' || category === 'conversation_quality_gap') {
    return 'proposal_only';
  }
  return 'proposal_only';
}

function repairConfidenceBlockersFor({
  topFailureCategory,
  repairCategory,
  freshTriadSamples,
  recentFailureReason,
  amPm,
  lifeSignals,
  dayWindowLifeSignals,
}) {
  if (repairCategory !== 'echo_repetition') return [];
  const blockers = [];
  if (freshTriadSamples < 8) blockers.push('fresh_triad_samples_below_8');
  if (amPm?.decision === 'sample_pending') blockers.push('am_pm_sample_pending');
  if (lifeSignals?.status === 'WARN' || dayWindowLifeSignals?.status === 'WARN') {
    blockers.push('life_signals_warn');
  }
  if (
    topFailureCategory === 'echo_repetition' &&
    recentFailureReason &&
    !/echo|repeat|repetition|loop|object|prop|mirror/i.test(recentFailureReason)
  ) {
    blockers.push('recent_failure_reason_category_mismatch');
  }
  return unique(blockers);
}

function estimateV01Scores({ findings, freshConversations, reports, health, fallbackAudit }) {
  if (freshConversations.length < 3) {
    return {
      withheld: true,
      reason: `fresh_sample_count ${freshConversations.length} below required 3`,
      fresh_sample_count: freshConversations.length,
      required_sample_count: 3,
    };
  }
  const rows = parseSoulRows(reports.soulTriad);
  const avg = (key, fallback) => average(rows.map((row) => row[key]).filter((value) => Number.isFinite(value))) ?? fallback;
  const activeFallbackPollutionCount = findings.activeFallbackPollutionCount;
  const confidenceCap = 1;
  const cap = (value) => clamp01(Math.min(value, confidenceCap));
  return {
    stability_score: clamp01((health.healthy ? 0.82 : 0.35) - (activeFallbackPollutionCount > 0 ? 0.25 : 0)),
    conversation_naturalness_score: cap(0.78 - findings.stageDirectionLeaks * 0.2 - findings.echoPenalty * 0.15),
    soul_continuity_score: cap(avg('memoryResidue', freshConversations.length ? 0.5 : 0.35)),
    behavior_drift_score: cap(avg('behavior', freshConversations.length ? 0.45 : 0.3)),
    relationship_chemistry_score: cap(avg('otherAware', freshConversations.length ? 0.5 : 0.35)),
    atmosphere_score: cap(avg('humanAftertaste', freshConversations.length ? 0.5 : 0.4)),
    player_loop_clarity_score: clamp01(/WAITING_FOR_NEW_CONVERSATIONS|Post-fix summary|PASS|WARN|FAIL/.test(reports.recent) ? 0.72 : 0.45),
  };
}

async function maybeRunCcReview({ findings, scores, freshConversations, reports }) {
  if (DRY_RUN || CC_MODE === 'skip') {
    return { status: DRY_RUN ? 'skipped_dry_run' : 'skipped_by_flag', output: '' };
  }
  const available = await commandAvailable('claude');
  if (!available || CC_MODE === 'unavailable') return { status: 'unavailable', output: '' };

  const prompt = [
    'GIIS Underworld v0.1 read-only director review.',
    'Do not modify files. Do not run provider/Convex commands.',
    'Review the latest observe report draft and identify overclaiming, rubric disagreement, soul regression, code/prompt risks, and whether the next change should be auto-fix or proposal-only.',
    '',
    `Findings: ${JSON.stringify(findings)}`,
    `Scores: ${JSON.stringify(scores)}`,
    '',
    'Fresh transcripts:',
    ...freshConversations.flatMap((conversation) => [
      `Conversation ${conversation.id} ${(conversation.involvedCharacters ?? []).join(' / ')}`,
      ...(conversation.transcriptMessages ?? []).map((message) => `${message.author}: ${message.text}`),
    ]),
    '',
    'Soul report excerpt:',
    reports.soulTriad.slice(0, 2500),
    '',
    'Recent eval excerpt:',
    reports.recent.slice(0, 1600),
  ].join('\n');

  const review = await runCommand('claude', ['-p', prompt], { timeout: 90_000, quiet: true });
  if (review.code !== 0) return { status: 'unavailable', output: review.stderr.slice(-2000) };
  return { status: 'completed', output: review.stdout.trim().slice(0, 5000) };
}

async function writeReport({
  timing,
  health,
  policyEnv,
  collection,
  freshConversations,
  evals,
  amPmContinuity,
  lifeSignals,
  dayWindowLifeSignals,
  reports,
  fallbackAudit,
  experienceEvidence,
  findings,
  scores,
  ccReview,
}) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# GIIS Underworld v0.1 Approach Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mode: observe_once${DRY_RUN ? ' dry_run' : ''}`,
    `Chicago time: ${timing.label}`,
    `Night quiet: ${timing.isNight ? 'yes' : 'no'}`,
    `Winding-down quiet: ${timing.isWindingDown ? 'yes' : 'no'}`,
    '',
    '## v0.1 Question',
    '',
    '> Does Alan return and feel: "Yesterday mattered. Today they are not exactly the same."',
    '',
    '## Summary',
    '',
    `- Fresh pilot samples: ${freshConversations.length}`,
    `- Soul PASS/WARN/FAIL: ${findings.statusCounts.PASS}/${findings.statusCounts.WARN}/${findings.statusCounts.FAIL}`,
    `- Recent PASS/WARN/FAIL: ${findings.recentStatusCounts.PASS}/${findings.recentStatusCounts.WARN}/${findings.recentStatusCounts.FAIL}`,
    `- Top failure category: ${findings.topFailureCategory}`,
    `- Observed issue: ${findings.observedIssue}`,
    `- Repair class: ${findings.repairClass}`,
    `- Repair confidence blockers: ${findings.repairConfidenceBlockers.length ? findings.repairConfidenceBlockers.join(', ') : 'none'}`,
    `- Rubric disagreement: ${findings.rubricDisagreement ? 'yes' : 'no'}`,
    `- Recent failure reason: ${findings.recentFailureReason ?? 'none'}`,
    `- Provider health: ${collection.providerHealth}`,
    `- Model policy env: ${policyEnv.ready ? 'ok' : 'check'}`,
    `- Runtime health: ${health.healthy ? 'ok' : 'check'}`,
    `- World engine status: ${health.worldEngineStatus ?? 'unknown'}`,
    `- Active fallback pollution count: ${findings.activeFallbackPollutionCount}`,
    `- Archived fallback history count: ${findings.archivedFallbackHistoryCount}`,
    `- Fresh fallback markers: ${findings.freshFallbackMarkers}`,
    `- Stage-direction leak sum: ${findings.stageDirectionLeaks.toFixed(2)}`,
    `- Echo penalty sum: ${findings.echoPenalty.toFixed(2)}`,
    `- Experience logs available: ${experienceEvidence.experienceLogCount}`,
    `- Subjective-shaped experience logs: ${experienceEvidence.subjectiveExperienceLogCount}`,
    `- Non-subjective/legacy experience logs: ${experienceEvidence.nonSubjectiveExperienceLogCount}`,
    `- Experience logs created for fresh samples: ${experienceEvidence.createdForFreshSamples}`,
    `- Experience-log fresh rejections/statuses: ${experienceEvidence.rejectedFreshSamples.length}`,
    `- Experience-log rejection reasons: ${formatReasonHistogram(experienceEvidence.rejectionReasonHistogram)}`,
    `- Experience residue rows: ${experienceEvidence.residueCount}`,
    `- Experience behavior hints: ${experienceEvidence.behaviorHintCount}`,
    `- Sleep notes promoted: ${experienceEvidence.sleepNotePromoted}`,
    `- Sleep notes fresh-eval eligible: ${experienceEvidence.sleepNoteFreshEvalEligible}`,
    `- CC review: ${ccReview.status}`,
    `- Code changed: no`,
    `- Next safest action: ${findings.nextSafestAction}`,
    `- AM→PM continuity: ${amPmContinuity.summary.status ?? 'unknown'} / ${amPmContinuity.summary.decision ?? 'unknown'}`,
    `- Fresh-window life signals: ${lifeSignals.summary.status ?? 'unknown'} / ${lifeSignals.summary.decision ?? 'unknown'}`,
    `- Day-window life signals: ${dayWindowLifeSignals.summary.status ?? 'unknown'} / ${dayWindowLifeSignals.summary.decision ?? 'unknown'}`,
    `- Day-window life conversations: ${dayWindowLifeSignals.summary.conversationCount ?? 'unknown'}`,
    `- Day-window ordinary scenes: ${dayWindowLifeSignals.summary.ordinarySceneDiversity ?? 'unknown'}`,
    `- Day-window daily rhythm: ${dayWindowLifeSignals.summary.dailyRhythmConversations ?? 'unknown'}`,
    `- Day-window soul style: ${dayWindowLifeSignals.summary.soulStyleConversations ?? 'unknown'}`,
    `- Day-window pilot expected action match rate: ${pilotActionRateLabel(dayWindowLifeSignals.summary)}`,
    `- Day-window pilot action collapse flags: ${dayWindowLifeSignals.summary.pilotActionCollapseFlags ?? 'unknown'}`,
    '',
    '## v0.1 Scores',
    '',
    ...scoreReportLines(scores),
    '',
    '## Strongest Recent Moment',
    '',
    strongestMoment(freshConversations),
    '',
    '## Weakest Recent Failure',
    '',
    weakestFailure(findings, freshConversations),
    '',
    '## Fresh Transcripts',
    '',
    ...transcriptLines(freshConversations),
    '',
    '## Experience / Sleep Evidence',
    '',
    `- experience log query: ${experienceEvidence.ok ? 'ok' : 'check'}`,
    `- experience logs read: ${experienceEvidence.experienceLogCount}`,
    `- subjective-shaped logs: ${experienceEvidence.subjectiveExperienceLogCount}`,
    `- non-subjective/legacy logs: ${experienceEvidence.nonSubjectiveExperienceLogCount}`,
    `- residue-bearing logs: ${experienceEvidence.residueCount}`,
    `- behavior-hint logs: ${experienceEvidence.behaviorHintCount}`,
    `- sleepNotes count: ${experienceEvidence.sleepNoteCount}`,
    `- sleepNotes promoted: ${experienceEvidence.sleepNotePromoted}`,
    `- sleepNotes freshEvalEligible: ${experienceEvidence.sleepNoteFreshEvalEligible}`,
    '',
    ...freshExperienceStatusLines(experienceEvidence),
    ...freshExperienceRejectionHistogramLines(experienceEvidence),
    '',
    ...experienceEvidenceLines(experienceEvidence),
    '',
    '## Health Checks',
    '',
    `- worldClock: ${health.worldClock.ok ? 'ok' : 'failed'}`,
    `- debugState: ${health.debugState.ok ? 'ok' : 'failed'}`,
    `- defaultWorldStatus: ${health.defaultWorldStatus.ok ? 'ok' : 'failed'}`,
    `- worldEngineStatus: ${health.worldEngineStatus ?? 'unknown'}`,
    `- playerCount: ${health.playerCount ?? 'unknown'}`,
    `- fallback audit: ${fallbackAudit.ok ? 'ok' : 'failed'}`,
    '',
    '## Fallback Pollution',
    '',
    `- active_total: ${findings.activeFallbackPollutionCount}`,
    `- memories: ${fallbackAudit.data?.fallbackMemoryCount ?? 'unknown'}`,
    `- world_events: ${fallbackAudit.data?.fallbackEventCount ?? 'unknown'}`,
    `- notifications: ${fallbackAudit.data?.fallbackNotificationCount ?? 'unknown'}`,
    `- polluted_profiles: ${fallbackAudit.data?.pollutedProfileCount ?? 'unknown'}`,
    `- archived_history_retained: ${findings.archivedFallbackHistoryCount}`,
    `- cleanup_report: umi/reports/fallback-pollution-cleanup-latest.md`,
    `- cleanup_proposal: umi/proposals/20260529T030000Z-fallback-pollution-cleanup-proposal.md`,
    '- policy: proposal-only; do not apply cleanup without Alan approval and fresh-sample evidence.',
    '',
    '## Model Policy Env',
    '',
    `- ready: ${policyEnv.ready ? 'yes' : 'no'}`,
    ...POLICY_ENV_KEYS.map((key) => `- ${key}: ${policyEnv.values[key] ?? 'unset'}`),
    '',
    '## Collection',
    '',
    `- attempted: ${collection.attempted ? 'yes' : 'no'}`,
    `- dry_run: ${collection.dryRun ? 'yes' : 'no'}`,
    `- world_engine_before_collection: ${collection.worldEngineStatusBefore ?? 'unknown'}`,
    `- world_engine_resumed_before_collection: ${collection.worldEngineResumedBeforeCollection ? 'yes' : 'no'}`,
    ...collection.attempts.map((attempt, index) =>
      `- attempt ${index + 1}: code=${attempt.code} ok=${attempt.ok ? 'yes' : 'no'} provider_unavailable=${attempt.providerUnavailable ? 'yes' : 'no'} sample=${attempt.sampleId ?? 'none'}`,
    ),
    collection.attempts.length ? '' : '- attempts: none',
    '',
    '## Eval Commands',
    '',
    `- npm run eval:soul-triad -- --since-created-at=${EVAL_SINCE_AT}: exit ${evals.soulTriad.code}`,
    `- npm run eval:conversation:recent -- --since-created-at=${EVAL_SINCE_AT}: exit ${evals.recent.code}`,
    `- npm run underworld:am-pm-continuity: exit ${amPmContinuity.code}`,
    `- npm run underworld:life-signals -- --since-created-at=${EVAL_SINCE_AT}: exit ${lifeSignals.code}`,
    `- npm run underworld:life-signals: exit ${dayWindowLifeSignals.code}`,
    '',
    '## CC Review',
    '',
    ccReview.output || `(cc_review=${ccReview.status})`,
    '',
    '## Repair Gate Recommendation',
    '',
    repairGateRecommendation(findings),
    '',
    '## AM→PM Continuity',
    '',
    `- status: ${amPmContinuity.summary.status ?? 'unknown'}`,
    `- decision: ${amPmContinuity.summary.decision ?? 'unknown'}`,
    `- morning samples: ${amPmContinuity.summary.morningSampleCount ?? 'unknown'}`,
    `- afternoon samples: ${amPmContinuity.summary.afternoonSampleCount ?? 'unknown'}`,
    `- AM residue candidates: ${amPmContinuity.summary.amResidueCandidates ?? 'unknown'}`,
    `- PM callbacks found: ${amPmContinuity.summary.pmCallbacksFound ?? 'unknown'}`,
    `- next safest action: ${amPmContinuity.summary.nextSafestAction ?? 'unknown'}`,
    '',
    '```md',
    amPmContinuity.report.slice(0, 2500),
    '```',
    '',
    '## Life Signals',
    '',
    'Fresh-window life-signal evidence is used for repair-gate safety. It only counts conversations archived after this observe run began.',
    '',
    `- status: ${lifeSignals.summary.status ?? 'unknown'}`,
    `- decision: ${lifeSignals.summary.decision ?? 'unknown'}`,
    `- conversation count: ${lifeSignals.summary.conversationCount ?? 'unknown'}`,
    `- life-grounded conversations: ${lifeSignals.summary.lifeGroundedConversations ?? 'unknown'}`,
    `- administrative drift flags: ${lifeSignals.summary.administrativeDriftFlags ?? 'unknown'}`,
    `- hygiene flags: ${lifeSignals.summary.hygieneFlags ?? 'unknown'}`,
    `- conversation shape flags: ${lifeSignals.summary.conversationShapeFlags ?? 'unknown'}`,
    `- single-message conversations: ${lifeSignals.summary.singleMessageConversations ?? 'unknown'}`,
    `- one-speaker conversations: ${lifeSignals.summary.oneSpeakerConversations ?? 'unknown'}`,
    `- post-processing drift flags: ${lifeSignals.summary.postProcessingDriftFlags ?? 'unknown'}`,
    `- prop echo flags: ${lifeSignals.summary.propEchoFlags ?? 'unknown'}`,
    `- repeated line flags: ${lifeSignals.summary.repeatedLineFlags ?? 'unknown'}`,
    `- scene diversity: ${lifeSignals.summary.sceneDiversity ?? 'unknown'}`,
    `- ordinary scene diversity: ${lifeSignals.summary.ordinarySceneDiversity ?? 'unknown'}`,
    `- office-grounded conversations: ${lifeSignals.summary.officeGroundedConversations ?? 'unknown'}`,
    `- ordinary-scene conversations: ${lifeSignals.summary.ordinarySceneConversations ?? 'unknown'}`,
    `- daily rhythm conversations: ${lifeSignals.summary.dailyRhythmConversations ?? 'unknown'}`,
    `- daily rhythm diversity: ${lifeSignals.summary.dailyRhythmDiversity ?? 'unknown'}`,
    `- soul-style conversations: ${lifeSignals.summary.soulStyleConversations ?? 'unknown'}`,
    `- soul-style diversity: ${lifeSignals.summary.soulStyleDiversity ?? 'unknown'}`,
    `- pilot expected action matches: ${lifeSignals.summary.pilotExpectedActionMatches ?? 'unknown'}`,
    `- pilot expected action match rate: ${pilotActionRateLabel(lifeSignals.summary)}`,
    `- pilot action collapse flags: ${lifeSignals.summary.pilotActionCollapseFlags ?? 'unknown'}`,
    `- average life signal score: ${lifeSignals.summary.averageLifeSignalScore ?? 'unknown'}`,
    `- next safest action: ${lifeSignals.summary.nextSafestAction ?? 'unknown'}`,
    '',
    '```md',
    lifeSignals.report.slice(0, 2500),
    '```',
    '',
    '## Day-Window Life Signals',
    '',
    'Day-window life-signal evidence is used to understand the free world across the current school day. Do not auto-repair from this section alone.',
    '',
    `- status: ${dayWindowLifeSignals.summary.status ?? 'unknown'}`,
    `- decision: ${dayWindowLifeSignals.summary.decision ?? 'unknown'}`,
    `- conversation count: ${dayWindowLifeSignals.summary.conversationCount ?? 'unknown'}`,
    `- life-grounded conversations: ${dayWindowLifeSignals.summary.lifeGroundedConversations ?? 'unknown'}`,
    `- administrative drift flags: ${dayWindowLifeSignals.summary.administrativeDriftFlags ?? 'unknown'}`,
    `- hygiene flags: ${dayWindowLifeSignals.summary.hygieneFlags ?? 'unknown'}`,
    `- conversation shape flags: ${dayWindowLifeSignals.summary.conversationShapeFlags ?? 'unknown'}`,
    `- single-message conversations: ${dayWindowLifeSignals.summary.singleMessageConversations ?? 'unknown'}`,
    `- one-speaker conversations: ${dayWindowLifeSignals.summary.oneSpeakerConversations ?? 'unknown'}`,
    `- post-processing drift flags: ${dayWindowLifeSignals.summary.postProcessingDriftFlags ?? 'unknown'}`,
    `- prop echo flags: ${dayWindowLifeSignals.summary.propEchoFlags ?? 'unknown'}`,
    `- repeated line flags: ${dayWindowLifeSignals.summary.repeatedLineFlags ?? 'unknown'}`,
    `- scene diversity: ${dayWindowLifeSignals.summary.sceneDiversity ?? 'unknown'}`,
    `- ordinary scene diversity: ${dayWindowLifeSignals.summary.ordinarySceneDiversity ?? 'unknown'}`,
    `- office-grounded conversations: ${dayWindowLifeSignals.summary.officeGroundedConversations ?? 'unknown'}`,
    `- ordinary-scene conversations: ${dayWindowLifeSignals.summary.ordinarySceneConversations ?? 'unknown'}`,
    `- daily rhythm conversations: ${dayWindowLifeSignals.summary.dailyRhythmConversations ?? 'unknown'}`,
    `- daily rhythm diversity: ${dayWindowLifeSignals.summary.dailyRhythmDiversity ?? 'unknown'}`,
    `- soul-style conversations: ${dayWindowLifeSignals.summary.soulStyleConversations ?? 'unknown'}`,
    `- soul-style diversity: ${dayWindowLifeSignals.summary.soulStyleDiversity ?? 'unknown'}`,
    `- pilot expected action matches: ${dayWindowLifeSignals.summary.pilotExpectedActionMatches ?? 'unknown'}`,
    `- pilot expected action match rate: ${pilotActionRateLabel(dayWindowLifeSignals.summary)}`,
    `- pilot action collapse flags: ${dayWindowLifeSignals.summary.pilotActionCollapseFlags ?? 'unknown'}`,
    `- average life signal score: ${dayWindowLifeSignals.summary.averageLifeSignalScore ?? 'unknown'}`,
    `- next safest action: ${dayWindowLifeSignals.summary.nextSafestAction ?? 'unknown'}`,
    '',
    '```md',
    dayWindowLifeSignals.report.slice(0, 2500),
    '```',
    '',
    '## Soul Eval Excerpt',
    '',
    '```md',
    reports.soulTriad.slice(0, 5000),
    '```',
    '',
    '## Recent Eval Excerpt',
    '',
    '```md',
    reports.recent.slice(0, 3500),
    '```',
    '',
  ];
  await writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function scoreReportLines(scores) {
  if (scores.withheld) {
    return [
      '- status: withheld',
      `- reason: ${scores.reason}`,
      `- fresh_sample_count: ${scores.fresh_sample_count}`,
      `- required_sample_count: ${scores.required_sample_count}`,
      '- policy: scores are hidden until enough fresh samples exist; do not infer regression or readiness from stale/default decimals.',
    ];
  }
  return Object.entries(scores).map(([key, value]) => `- ${key}: ${value.toFixed(2)}`);
}

function pilotActionRateLabel(summary) {
  const matches = summary.pilotExpectedActionMatches;
  const checks = typeof matches === 'string' ? Number(matches.split('/')[1]) : Number.NaN;
  if (Number.isFinite(checks) && checks === 0) return 'no_data (0/0)';
  return summary.pilotExpectedActionMatchRate ?? 'unknown';
}

function repairGateRecommendation(findings) {
  if (findings.repairClass === 'auto_fix_allowed') {
    return `Auto-fix may be considered for ${findings.topFailureCategory}, but only after running \`npm run underworld:repair-gate\` and verifying specific evidence.`;
  }
  if (findings.repairClass === 'proposal_only') {
    return `Do not auto-fix ${findings.topFailureCategory}. Create a proposal under umi/proposals/.`;
  }
  return 'Observe only. Do not modify code.';
}

function strongestMoment(conversations) {
  const message = conversations
    .flatMap((conversation) => conversation.transcriptMessages ?? [])
    .find((row) => /不是.*一個人|一起|明天|記得|停|累|責任|交接/.test(row.text));
  return message ? `- **${message.author}**: ${message.text}` : 'No fresh moment available yet.';
}

function experienceEvidenceLines(evidence) {
  const rows = evidence.experienceLogs ?? [];
  if (!rows.length) {
    return ['- no experience logs yet'];
  }
  return rows.slice(0, 8).flatMap((row) => [
    `- ${row.characterName} (${row.characterId ?? 'unknown'}) day ${row.day} (${row.importance}; subjective=${isSubjectiveExperienceLogRow(row) ? 'yes' : 'no'}): ${row.eventSummary}`,
    row.emotionalResidue || row.residue ? `  - residue: ${row.emotionalResidue || row.residue}` : '  - residue: none',
    row.emotionalInterpretation ? `  - interpretation: ${row.emotionalInterpretation}` : '  - interpretation: none',
    row.behaviorHint ? `  - behavior hint: ${row.behaviorHint}` : '  - behavior hint: none',
    `  - source conversation: ${row.sourceConversationId ?? row.conversationId ?? 'unknown'}`,
  ]);
}

function isSubjectiveExperienceLogRow(row) {
  const summary = String(row?.eventSummary ?? '').trim();
  if (!summary || !row?.characterName) return false;
  if (!summary.startsWith(`對${row.characterName}來說`)) return false;
  if (/^[^：]{1,12}與[^：]{1,12}：/.test(summary)) return false;
  if (/留下了一段短記憶|進行了一段短暫對話|短暫對話|objective|event summary/i.test(summary)) {
    return false;
  }
  return true;
}

function freshExperienceStatusLines(evidence) {
  const statuses = evidence.freshStatuses ?? [];
  if (!statuses.length) return ['- fresh sample experience-log status: no fresh samples'];
  return [
    '- fresh sample experience-log status:',
    ...statuses.map((status) =>
      `  - ${status.id}: ${status.created ? `created (${status.logCount})` : `not written (${status.reason})`}`,
    ),
  ];
}

function freshExperienceRejectionHistogramLines(evidence) {
  const histogram = evidence.rejectionReasonHistogram ?? {};
  const entries = Object.entries(histogram).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!entries.length) return ['- rejection reason histogram: none'];
  return [
    '- rejection reason histogram:',
    ...entries.map(([reason, count]) => `  - ${reason}: ${count}`),
  ];
}

function reasonHistogram(statuses) {
  return statuses
    .filter((status) => !status.created)
    .reduce((histogram, status) => {
      const reason = status.reason ?? 'unknown';
      histogram[reason] = (histogram[reason] ?? 0) + 1;
      return histogram;
    }, {});
}

function formatReasonHistogram(histogram = {}) {
  const entries = Object.entries(histogram).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!entries.length) return 'none';
  return entries.map(([reason, count]) => `${reason}=${count}`).join(', ');
}

function freshExperienceLogStatus(conversation, rows) {
  const id = canonicalConversationId(conversation.id);
  const matchingRows = rows.filter((row) => canonicalConversationId(row.sourceConversationId ?? row.conversationId) === id);
  if (matchingRows.length) {
    const nonSubjective = matchingRows.filter((row) => !isSubjectiveExperienceLogRow(row)).length;
    if (nonSubjective) {
      return {
        id: conversation.id,
        created: false,
        logCount: matchingRows.length,
        reason: 'non_subjective_experience_log_shape',
      };
    }
    return {
      id: conversation.id,
      created: true,
      logCount: matchingRows.length,
      reason: 'created',
    };
  }
  return {
    id: conversation.id,
    created: false,
    logCount: 0,
    reason: inferExperienceLogRejectionReason(conversation),
  };
}

function canonicalConversationId(value) {
  return String(value ?? '')
    .replace(/^active-conversation-/, '')
    .replace(/^conversation-/, '');
}

function inferExperienceLogRejectionReason(conversation) {
  const messages = conversation.transcriptMessages ?? [];
  const text = messages.map((message) => message.text ?? '').join('\n');
  const participants = conversation.involvedCharacters ?? [];
  const canonicalPilots = participants.map(canonicalEvidencePilotName).filter(Boolean);
  const hasAlan = participants.includes('Alan');
  if (conversation.diagnosticKind === 'active_conversation_not_archived') {
    return 'source_not_archived_yet';
  }
  if (conversation.diagnosticKind === 'human_chat_not_archived') {
    return hasAlan ? 'alan_chat_not_archived' : 'source_not_archived_yet';
  }
  if (hasAlan && canonicalPilots.length >= 1) {
    return 'alan_pair_shadow_not_enabled';
  }
  if (canonicalPilots.length < 2) {
    return 'non_current_pilot';
  }
  if (/\[ABORT_CONVERSATION\]|\[LEAVE\]|pilot LLM unavailable|fallback|無法提供|不能滿足/i.test(text)) {
    return 'fallback_or_provider_marker';
  }
  if (hasObviousMotifLoop(messages)) return 'obvious_echo_or_motif_loop';
  if (hasLikelyStageDirectionLeak(text)) return 'stage_direction_leak';
  const memoryTraceReason = inferMemoryTraceExperienceReason(conversation.memoryTraces ?? []);
  if (memoryTraceReason) return memoryTraceReason;
  if (conversation.outcomeQuality === 'repeated_noise') return 'repeated_noise_or_motif_loop';
  return 'possible_cap_dedupe_or_not_archived_gate';
}

function canonicalEvidencePilotName(name) {
  const trimmed = String(name ?? '').trim();
  const canonical = EVIDENCE_PILOT_NAME_BY_RAW.get(trimmed);
  return canonical && EVIDENCE_PILOT_CANONICAL.has(canonical) ? canonical : null;
}

function inferMemoryTraceExperienceReason(memoryTraces) {
  if (!Array.isArray(memoryTraces) || !memoryTraces.length) return 'no_memory_trace_yet';
  const traceText = memoryTraces
    .map((trace) => Object.values(trace ?? {}).join(' '))
    .join('\n');
  if (/residueSource['":\s]+deterministic|non_soul_residue|deterministic/i.test(traceText)) {
    return 'non_soul_residue';
  }
  if (/residueSource['":\s]+none|no_residue/i.test(traceText)) {
    return 'no_residue';
  }
  if (/殘留|心裡留下|llm_soul|還記得/.test(traceText)) {
    return 'possible_cap_dedupe_or_recent_not_loaded';
  }
  if (/記住的片段|記住了：|ordinary_memory_fragment_not_residue/.test(traceText)) {
    return 'ordinary_memory_fragment_not_residue';
  }
  if (/記住的是/.test(traceText)) {
    return 'ordinary_memory_fragment_not_residue';
  }
  return 'no_soul_residue_trace';
}

function hasLikelyStageDirectionLeak(text) {
  return /我(合上|看向|走到|靠回|拿起)|我放下(杯|茶|筆|手機|筷|叉|湯匙|紙|文件|筆電)|我把手機|（[^）]*(看向|走到|放下|拿起|合上)[^）]*）/.test(text);
}

function hasObviousMotifLoop(messages) {
  const motifCounts = new Map();
  const motifs = ['筷子', '起司', '叉子', '杯子', '紙', '筆', '手機', '清單', '簡報', '報名表'];
  for (const message of messages) {
    for (const motif of motifs) {
      if ((message.text ?? '').includes(motif)) {
        motifCounts.set(motif, (motifCounts.get(motif) ?? 0) + 1);
      }
    }
  }
  return [...motifCounts.values()].some((count) => count >= 4);
}

function weakestFailure(findings, conversations) {
  if (findings.topFailureCategory === 'eval_rubric_disagreement') {
    return `Soul eval and recent eval disagree on the fresh sample; recent reason: ${findings.recentFailureReason ?? 'unknown'}.`;
  }
  if (findings.topFailureCategory === 'sample_pending') return 'Fresh sample count is below 3; insufficient evidence for repair.';
  const message = conversations
    .flatMap((conversation) => conversation.transcriptMessages ?? [])
    .find((row) => /我合上|我放下|我把|fallback|無法提供|你剛才/.test(row.text));
  return message ? `- **${message.author}**: ${message.text}` : `Top failure category: ${findings.topFailureCategory}`;
}

function countFreshFallbackMarkers(conversations) {
  return conversations
    .flatMap((conversation) => conversation.transcriptMessages ?? [])
    .filter((message) =>
      /\[ABORT_CONVERSATION\]|\[LEAVE\]|pilot LLM unavailable|fallback|無法提供|不能滿足/i.test(message.text),
    ).length;
}

function transcriptLines(conversations) {
  if (!conversations.length) return ['No fresh triad transcript in this observe pass.'];
  return conversations.flatMap((conversation) => [
    `### ${conversation.id}`,
    '',
    `Participants: ${(conversation.involvedCharacters ?? []).join(' / ')}`,
    '',
    ...(conversation.transcriptMessages ?? []).map((message) => `- **${message.author}**: ${message.text}`),
    '',
  ]);
}

function printTranscripts(conversations) {
  console.log('\n[underworld-observe] fresh transcripts');
  if (!conversations.length) {
    console.log('(no fresh triad transcripts)');
    return;
  }
  for (const conversation of conversations) {
    console.log(`\n--- ${conversation.id} ${(conversation.involvedCharacters ?? []).join(' / ')} ---`);
    for (const message of conversation.transcriptMessages ?? []) {
      console.log(`${message.author}: ${message.text}`);
    }
  }
}

async function convexRunSafe(functionName, payload) {
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
  const result = await runCommand('npx', commandArgs, { timeout: 70_000, quiet: true });
  if (result.code !== 0) {
    return { ok: false, error: `${result.stderr}\n${result.stdout}`.trim().slice(-2000) };
  }
  return { ok: true, data: parseJsonFromStdout(result.stdout) };
}

async function runCommand(command, commandArgs, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      cwd: REPO_ROOT,
      env: COMMAND_ENV,
      maxBuffer: 1024 * 1024 * 12,
      timeout: options.timeout ?? 60_000,
    });
    if (!options.quiet) {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    }
    return { code: 0, stdout, stderr };
  } catch (error) {
    const stdout = error.stdout?.toString() ?? '';
    const stderr = error.stderr?.toString() ?? error.message ?? '';
    if (!options.quiet) {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    }
    return { code: error.code ?? 1, stdout, stderr };
  }
}

async function commandAvailable(command) {
  const result = await runCommand('which', [command], { timeout: 10_000, quiet: true });
  return result.code === 0;
}

function providerUnavailableFromOutput(code, output) {
  if (/429|model_not_found|quota|provider_unavailable|LLM unavailable|call timed out|request timed out/i.test(output)) {
    return true;
  }
  return code !== 0 && /timeout waiting/i.test(output);
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

function numberArg(name, fallback, min, max) {
  const raw = args.get(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function shouldAttemptSampleCollection({ dryRun, collectMode, targetSamples, timing }) {
  return (
    !dryRun &&
    collectMode !== 'skip' &&
    targetSamples > 0 &&
    (collectMode === 'force' || timing.canStartAutonomousConversations)
  );
}

function shouldResumeWorldBeforeCollection(timing, worldEngineStatus) {
  return timing.canStartAutonomousConversations && worldEngineStatus !== 'running';
}

async function restoreWorldEngineAfterCollection(previousStatus) {
  if (previousStatus === 'running' || previousStatus === undefined) {
    await convexRunSafe('testing:resume');
    return;
  }
  await convexRunSafe('testing:stop');
}

function isModelPolicyEnvReady(values) {
  const pairs = values.AUTONOMOUS_CONVERSATION_LLM_PAIRS ?? '';
  const quota = Number(values.UMI_MAHIRU_PILOT_DAILY_QUOTA);
  const stalePilotEnv =
    Boolean(values.SOUL_TRIAD_COLOCATION_PILOT?.trim()) ||
    Boolean(values.SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS?.trim()) ||
    Boolean(values.SOUL_TRIAD_FOCUS_PAIR?.trim());
  return (
    values.CHARACTER_SOUL_LOCAL_FALLBACK === 'false' &&
    pairs.includes('Umi:Mahiru') &&
    pairs.includes('Umi:Tianze') &&
    pairs.includes('Mahiru:Tianze') &&
    values.UMI_MAHIRU_PILOT_PROVIDER === 'qwen' &&
    Number.isFinite(quota) &&
    quota > 0 &&
    !stalePilotEnv
  );
}

function collectionSkipReason(timing, collectMode) {
  if (collectMode === 'force') return null;
  if (timing.isNight) return 'night_quiet';
  if (timing.isWindingDown) return 'winding_down_quiet';
  return null;
}

function chicagoTiming() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour);
  return {
    hour,
    isNight: hour >= 22 || hour < 6,
    isWindingDown: hour >= 21 && hour < 23,
    canStartAutonomousConversations: hour >= 6 && hour < 21,
    label: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} America/Chicago`,
  };
}

function timingForHour(hour) {
  return {
    hour,
    isNight: hour >= 22 || hour < 6,
    isWindingDown: hour >= 21 && hour < 23,
    canStartAutonomousConversations: hour >= 6 && hour < 21,
    label: `self-test hour ${hour}`,
  };
}

function runSelfTest() {
  assertEqual(
    shouldAttemptSampleCollection({
      dryRun: false,
      collectMode: 'auto',
      targetSamples: 1,
      timing: timingForHour(20),
    }),
    true,
    '20:00 can collect',
  );
  assertEqual(
    shouldAttemptSampleCollection({
      dryRun: false,
      collectMode: 'auto',
      targetSamples: 1,
      timing: timingForHour(21),
    }),
    false,
    '21:00 winding-down skips collect',
  );
  assertEqual(collectionSkipReason(timingForHour(21), 'auto'), 'winding_down_quiet', '21:00 skip reason');
  assertEqual(
    shouldAttemptSampleCollection({
      dryRun: false,
      collectMode: 'auto',
      targetSamples: 1,
      timing: timingForHour(22),
    }),
    false,
    '22:00 night skips collect',
  );
  assertEqual(collectionSkipReason(timingForHour(22), 'auto'), 'night_quiet', '22:00 skip reason');
  assertEqual(
    shouldAttemptSampleCollection({
      dryRun: false,
      collectMode: 'auto',
      targetSamples: 1,
      timing: timingForHour(5),
    }),
    false,
    '05:00 night skips collect',
  );
  assertEqual(
    shouldAttemptSampleCollection({
      dryRun: false,
      collectMode: 'auto',
      targetSamples: 1,
      timing: timingForHour(6),
    }),
    true,
    '06:00 resumes collection',
  );
  assertEqual(
    shouldAttemptSampleCollection({
      dryRun: false,
      collectMode: 'force',
      targetSamples: 1,
      timing: timingForHour(21),
    }),
    true,
    'force can collect during winding-down',
  );
  assertEqual(shouldResumeWorldBeforeCollection(timingForHour(9), 'inactive'), true, 'daytime inactive resumes');
  assertEqual(shouldResumeWorldBeforeCollection(timingForHour(9), 'running'), false, 'daytime running stays running');
  assertEqual(shouldResumeWorldBeforeCollection(timingForHour(21), 'inactive'), false, 'winding-down inactive stays quiet');
  assertEqual(shouldResumeWorldBeforeCollection(timingForHour(23), 'inactive'), false, 'night inactive stays quiet');
  assertEqual(
    estimateV01Scores({
      findings: { activeFallbackPollutionCount: 0 },
      freshConversations: [],
      reports: { soulTriad: '', recent: '' },
      health: { healthy: true },
      fallbackAudit: {},
    }).withheld,
    true,
    'v0.1 scores are withheld when fresh samples are absent',
  );
  assertEqual(
    scoreReportLines({ withheld: true, reason: 'sample_pending', fresh_sample_count: 0, required_sample_count: 3 })[0],
    '- status: withheld',
    'withheld score report is explicit',
  );
  assertEqual(
    isModelPolicyEnvReady({
      CHARACTER_SOUL_LOCAL_FALLBACK: 'false',
      AUTONOMOUS_CONVERSATION_LLM_PAIRS: 'Umi:Mahiru,Umi:Tianze,Mahiru:Tianze',
      UMI_MAHIRU_PILOT_PROVIDER: 'qwen',
      UMI_MAHIRU_PILOT_DAILY_QUOTA: '8',
      SOUL_TRIAD_COLOCATION_PILOT: '',
      SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS: '',
      SOUL_TRIAD_FOCUS_PAIR: '',
    }),
    true,
    'model policy env ready',
  );
  assertEqual(
    isModelPolicyEnvReady({
      CHARACTER_SOUL_LOCAL_FALLBACK: 'true',
      AUTONOMOUS_CONVERSATION_LLM_PAIRS: 'Umi:Mahiru,Umi:Tianze,Mahiru:Tianze',
      UMI_MAHIRU_PILOT_PROVIDER: 'qwen',
      UMI_MAHIRU_PILOT_DAILY_QUOTA: '8',
      SOUL_TRIAD_COLOCATION_PILOT: '',
      SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS: '',
      SOUL_TRIAD_FOCUS_PAIR: '',
    }),
    false,
    'local fallback enabled is not ready',
  );
  assertEqual(
    isModelPolicyEnvReady({
      CHARACTER_SOUL_LOCAL_FALLBACK: 'false',
      AUTONOMOUS_CONVERSATION_LLM_PAIRS: 'Umi:Mahiru,Umi:Tianze,Mahiru:Tianze',
      UMI_MAHIRU_PILOT_PROVIDER: 'qwen',
      UMI_MAHIRU_PILOT_DAILY_QUOTA: '8',
      SOUL_TRIAD_COLOCATION_PILOT: 'true',
      SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS: '',
      SOUL_TRIAD_FOCUS_PAIR: '',
    }),
    false,
    'stale pilot env is not ready',
  );
  assertEqual(
    shouldAttemptSampleCollection({
      dryRun: false,
      collectMode: 'skip',
      targetSamples: 1,
      timing: timingForHour(20),
    }),
    false,
    'skip mode never collects',
  );
  const soulTableWithUnpipedRows = [
    '| Conversation | Participants | Messages | Status | Score | Stage direction leak penalty | Echo penalty |',
    '|---|---|---:|---|---:|---:|---:|',
    'conversation-c:1 | 海 / 真晝 | 4 | PASS | 1.00 | 0.00 | 1.00',
  ].join('\n');
  assertEqual(
    sumNumericColumn(soulTableWithUnpipedRows, 'Stage direction leak penalty'),
    0,
    'soul table parser keeps stage leak column aligned',
  );
  assertEqual(
    sumNumericColumn(soulTableWithUnpipedRows, 'Echo penalty'),
    1,
    'soul table parser keeps echo column aligned',
  );
  const overclaimedEchoFindings = analyzeFindings({
    timing: timingForHour(20),
    health: { healthy: true },
    collection: { providerHealth: 'not_checked' },
    freshConversations: [{}, {}, {}, {}, {}],
    amPmContinuity: { summary: { decision: 'sample_pending' } },
    lifeSignals: { summary: { status: 'WARN', decision: 'pilot_role_action_collapse' } },
    dayWindowLifeSignals: { summary: { status: 'WARN', decision: 'prop_echo_repeated' } },
    reports: {
      soulTriad: [
        '| Conversation | Participants | Messages | Status | Score | Stage direction leak penalty | Echo penalty |',
        '|---|---|---:|---|---:|---:|---:|',
        'conversation-c:1 | 海 / 天澤 | 3 | FAIL | 0.55 | 0.00 | 1.00',
      ].join('\n'),
      recent: [
        'Post-fix summary: 0 PASS / 1 WARN / 5 FAIL',
        'Reasons:',
        '- characterVoiceScore: matched 1/15 character voice cue(s)',
      ].join('\n'),
    },
    fallbackAudit: { data: {} },
  });
  assertEqual(overclaimedEchoFindings.topFailureCategory, 'echo_repetition', 'overclaimed echo category');
  assertEqual(overclaimedEchoFindings.repairClass, 'observe_only', 'overclaimed echo observe-only class');
  assertIncludes(
    overclaimedEchoFindings.repairConfidenceBlockers,
    'am_pm_sample_pending',
    'overclaimed echo AM-PM blocker',
  );
  assertIncludes(
    overclaimedEchoFindings.repairConfidenceBlockers,
    'recent_failure_reason_category_mismatch',
    'overclaimed echo recent-reason blocker',
  );
  assertEqual(
    inferExperienceLogRejectionReason({
      diagnosticKind: 'active_conversation_not_archived',
      involvedCharacters: ['海', '真晝'],
      transcriptMessages: [{ author: '海', text: '今天我只整理三件事。' }],
    }),
    'source_not_archived_yet',
    'active conversations are not archival evidence yet',
  );
  assertEqual(
    inferExperienceLogRejectionReason({
      diagnosticKind: 'human_chat_not_archived',
      involvedCharacters: ['Alan', '海'],
      transcriptMessages: [{ author: 'Alan', text: '我喜歡你' }],
    }),
    'alan_chat_not_archived',
    'Alan chat must archive before lane-2 evidence',
  );
  assertEqual(
    inferExperienceLogRejectionReason({
      involvedCharacters: ['Alan', '海'],
      transcriptMessages: [{ author: 'Alan', text: '我喜歡你' }, { author: '海', text: '嗯，我聽見了。' }],
      memoryTraces: [{ memoryLineZh: '海記住的是：Alan 的喜歡不是任務。' }],
    }),
    'alan_pair_shadow_not_enabled',
    'Alan pair is shadow-only until explicitly enabled',
  );
  assertEqual(
    inferExperienceLogRejectionReason({
      involvedCharacters: ['一之瀨', '真晝'],
      transcriptMessages: [{ author: '一之瀨', text: '你剛才幫天澤收作業時，筆盒蓋子還掀著呢……' }],
      memoryTraces: [{ memoryLineZh: '一之瀨記住的片段：「筆盒蓋子還掀著」' }],
    }),
    'ordinary_memory_fragment_not_residue',
    'ordinary memory fragment is not subjective evidence',
  );
  assertEqual(
    formatReasonHistogram(reasonHistogram([
      { created: false, reason: 'no_residue' },
      { created: false, reason: 'no_residue' },
      { created: false, reason: 'source_not_archived_yet' },
      { created: true, reason: 'created' },
    ])),
    'no_residue=2, source_not_archived_yet=1',
    'rejection reason histogram excludes created rows',
  );
  console.log('[underworld-observe:self-test] PASS');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(values, expected, label) {
  if (!values.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expected)}`);
  }
}

function isTriadConversation(conversation) {
  const participants = conversation?.involvedCharacters ?? [];
  return participants.filter((name) => EVIDENCE_PILOT_NAMES.has(name)).length >= 2;
}

function statusCountsFromSoulReport(report) {
  const counts = { PASS: 0, WARN: 0, FAIL: 0 };
  for (const row of parseSoulRows(report)) counts[row.status] += 1;
  return counts;
}

function statusCountsFromRecentReport(report) {
  const match = report.match(/Post-fix summary:\s*(\d+)\s+PASS\s*\/\s*(\d+)\s+WARN\s*\/\s*(\d+)\s+FAIL/i);
  if (!match) return { PASS: 0, WARN: 0, FAIL: 0 };
  return {
    PASS: Number(match[1]),
    WARN: Number(match[2]),
    FAIL: Number(match[3]),
  };
}

function firstRecentFailureReason(report) {
  const reason = report.match(/Reasons:\s*\n-\s*([^\n]+)/i)?.[1];
  if (reason) return reason.trim();
  const topReason = report.match(/Top reasons \|\n[^\n]*\n\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|\s*([^|]+)/i)?.[1];
  return topReason?.replace(/<br>/g, '; ').trim();
}

function parseAmPmSummary(report) {
  const field = (label) =>
    report.match(new RegExp(`^- ${label}:\\s*(.+)$`, 'mi'))?.[1]?.trim();
  return {
    status: field('Status'),
    decision: field('Decision'),
    morningSampleCount: field('Morning sample count'),
    afternoonSampleCount: field('Afternoon sample count'),
    amResidueCandidates: field('AM residue candidates'),
    pmCallbacksFound: field('PM callbacks found'),
    nextSafestAction: field('Next safest action'),
  };
}

function parseLifeSignalsSummary(report) {
  const field = (label) =>
    report.match(new RegExp(`^- ${label}:\\s*(.+)$`, 'mi'))?.[1]?.trim();
  return {
    status: field('Status'),
    decision: field('Decision'),
    conversationCount: field('Conversation count'),
    lifeGroundedConversations: field('Life-grounded conversations'),
    administrativeDriftFlags: field('Administrative drift flags'),
    hygieneFlags: field('Hygiene flags'),
    conversationShapeFlags: field('Conversation shape flags'),
    singleMessageConversations: field('Single-message conversations'),
    oneSpeakerConversations: field('One-speaker conversations'),
    postProcessingDriftFlags: field('Post-processing drift flags'),
    propEchoFlags: field('Prop echo flags'),
    repeatedLineFlags: field('Repeated line flags'),
    sceneDiversity: field('Scene diversity'),
    ordinarySceneDiversity: field('Ordinary scene diversity'),
    officeGroundedConversations: field('Office-grounded conversations'),
    ordinarySceneConversations: field('Ordinary-scene conversations'),
    dailyRhythmConversations: field('Daily rhythm conversations'),
    dailyRhythmDiversity: field('Daily rhythm diversity'),
    soulStyleConversations: field('Soul-style conversations'),
    soulStyleDiversity: field('Soul-style diversity'),
    pilotExpectedActionMatches: field('Pilot expected action matches'),
    pilotExpectedActionMatchRate: field('Pilot expected action match rate'),
    pilotActionCollapseFlags: field('Pilot action collapse flags'),
    averageLifeSignalScore: field('Average life signal score'),
    nextSafestAction: field('Next safest action'),
  };
}

function parseSoulRows(report) {
  const lines = report.split('\n');
  const header = lines.find((line) => line.startsWith('| Conversation |'));
  const splitTableCells = (line) => {
    const trimmed = line.trim();
    const withoutLeftPipe = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
    const withoutRightPipe = withoutLeftPipe.endsWith('|') ? withoutLeftPipe.slice(0, -1) : withoutLeftPipe;
    return withoutRightPipe.split('|').map((cell) => cell.trim());
  };
  const headerCells = header ? splitTableCells(header) : [];
  const indexOf = (name) => headerCells.indexOf(name);
  return lines
    .filter((line) => line.startsWith('conversation-'))
    .map((line) => {
      const cells = splitTableCells(line);
      const numberCell = (name) => {
        const index = indexOf(name);
        return index >= 0 ? Number(cells[index]) : Number.NaN;
      };
      const stringCell = (name, fallbackIndex) => {
        const index = indexOf(name);
        return cells[index >= 0 ? index : fallbackIndex];
      };
      return {
        conversation: stringCell('Conversation', 0),
        participants: stringCell('Participants', 1),
        messages: numberCell('Messages'),
        status: stringCell('Status', 3),
        score: numberCell('Score'),
        otherAware: numberCell('Other aware'),
        privateSelf: numberCell('Private self'),
        memoryResidue: numberCell('Memory residue'),
        behavior: numberCell('Behavior'),
        humanAftertaste: numberCell('Human aftertaste'),
        stageDirectionLeakPenalty: numberCell('Stage direction leak penalty'),
        echoPenalty: numberCell('Echo penalty'),
      };
    });
}

function sumNumericColumn(report, name) {
  const rows = parseSoulRows(report);
  const key = name === 'Stage direction leak penalty' ? 'stageDirectionLeakPenalty' : 'echoPenalty';
  return rows.reduce((sum, row) => sum + (Number.isFinite(row[key]) ? row[key] : 0), 0);
}

function average(values) {
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function parseJsonFromStdout(stdout) {
  const candidates = [];
  for (let start = 0; start < stdout.length; start += 1) {
    if (stdout[start] !== '{' && stdout[start] !== '[') continue;
    const candidate = balancedJsonSlice(stdout, start);
    if (candidate) candidates.push(candidate);
  }
  for (const candidate of candidates.sort((a, b) => b.length - a.length)) {
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }
  return undefined;
}

function balancedJsonSlice(text, start) {
  const opener = text[start];
  const closer = opener === '{' ? '}' : ']';
  const stack = [closer];
  let inString = false;
  let escaped = false;
  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') stack.push('}');
    if (char === '[') stack.push(']');
    if (char === stack.at(-1)) {
      stack.pop();
      if (!stack.length) return text.slice(start, index + 1);
    }
  }
  return undefined;
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

try {
  if (SELF_TEST) runSelfTest();
  else {
    main().catch((error) => {
      console.error(`[underworld-observe] fatal: ${error.stack ?? error.message ?? error}`);
      process.exitCode = 1;
    });
  }
} catch (error) {
  console.error(`[underworld-observe] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = 1;
}

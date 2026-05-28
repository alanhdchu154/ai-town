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
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'v01-approach-latest.md');
const AM_PM_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'am-pm-continuity-latest.md');
const LIFE_SIGNALS_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'life-signals-latest.md');
const TRIAD_NAMES = new Set(['海', '真晝', '明日奈', 'Umi', 'Mahiru', 'Asuna']);

const args = parseArgs(process.argv.slice(2));
const DRY_RUN = args.get('dry-run') === 'true';
const COLLECT_MODE = args.get('collect') ?? 'auto';
const CC_MODE = args.get('cc') ?? 'auto';
const TARGET_SAMPLES = numberArg('target-samples', 1, 0, 3);
const SAMPLE_TIMEOUT_MS = numberArg('sample-timeout-ms', DRY_RUN ? 1_000 : 180_000, 1_000, 300_000);
const SAMPLE_POLL_MS = numberArg('sample-poll-ms', 7_000, 1_000, 30_000);
// Rotate the collected dyad across samples so Mahiru is not starved by the
// Umi<->Asuna mutual-first-choice attractor. Disable with --no-focus-rotation.
const FOCUS_ROTATION = ['Umi:Mahiru', 'Mahiru:Asuna', 'Umi:Asuna'];
const FOCUS_ROTATION_ENABLED = args.get('no-focus-rotation') !== 'true';
const RUN_STARTED_AT = Date.now();
const RUN_ISO = new Date(RUN_STARTED_AT).toISOString();
const EVAL_SINCE_AT = numberArg('since-created-at', RUN_STARTED_AT, 0, Number.MAX_SAFE_INTEGER);

async function main() {
  console.log(`[underworld-observe] started ${RUN_ISO}`);
  console.log('[underworld-observe] policy: observe/report only; no code edits');

  const timing = chicagoTiming();
  const health = await collectHealth();
  const collection = await maybeCollectSamples(timing);
  const freshConversations = await fetchFreshTriadConversations(EVAL_SINCE_AT);
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
    collection,
    freshConversations,
    reports,
    fallbackAudit,
  });
  const scores = estimateV01Scores({ findings, freshConversations, reports, health, fallbackAudit });
  const ccReview = await maybeRunCcReview({ findings, scores, freshConversations, reports });

  await writeReport({
    timing,
    health,
    collection,
    freshConversations,
    evals,
    amPmContinuity,
    lifeSignals,
    dayWindowLifeSignals,
    reports,
    fallbackAudit,
    findings,
    scores,
    ccReview,
  });

  console.log(`[underworld-observe] report written: ${relative(REPORT_PATH)}`);
  console.log(`[underworld-observe] next safest action: ${findings.nextSafestAction}`);
}

async function maybeCollectSamples(timing) {
  const shouldCollect =
    !DRY_RUN &&
    COLLECT_MODE !== 'skip' &&
    TARGET_SAMPLES > 0 &&
    (COLLECT_MODE === 'force' || !timing.isNight);

  const result = {
    mode: COLLECT_MODE,
    attempted: shouldCollect,
    dryRun: DRY_RUN,
    attempts: [],
    providerHealth: DRY_RUN ? 'not_checked_dry_run' : 'not_checked',
  };

  if (DRY_RUN) {
    console.log('[underworld-observe] dry-run: sample collection skipped');
    return result;
  }
  if (timing.isNight && COLLECT_MODE !== 'force') {
    console.log('[underworld-observe] night quiet: sample collection skipped');
    result.providerHealth = 'not_checked_night_quiet';
    return result;
  }
  if (!shouldCollect) {
    console.log('[underworld-observe] sample collection skipped by configuration');
    return result;
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

  if (!timing.isNight) {
    await convexRunSafe('testing:resume');
  }
  return result;
}

async function collectHealth() {
  const [worldClock, debugState] = await Promise.all([
    convexRunSafe('school:worldClock'),
    convexRunSafe('school:debugState'),
  ]);
  return {
    worldClock,
    debugState,
    playerCount: Array.isArray(debugState.data) ? debugState.data.length : undefined,
    healthy: worldClock.ok && debugState.ok,
  };
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

function analyzeFindings({ timing, health, collection, freshConversations, reports, fallbackAudit }) {
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
  const repairClass = repairClassFor(topFailureCategory);
  const nextSafestAction =
    topFailureCategory === 'eval_rubric_disagreement'
      ? 'reconcile eval framing before changing dialogue code'
      : topFailureCategory === 'sample_pending'
      ? 'wait for more fresh samples; do not modify code'
      : repairClass === 'auto_fix_allowed'
        ? `repair gate may inspect ${topFailureCategory}; apply only if evidence is specific`
        : repairClass === 'proposal_only'
          ? `write proposal before changing ${topFailureCategory}`
          : 'continue observing';

  return {
    statusCounts,
    recentStatusCounts,
    topFailureCategory,
    repairClass,
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

function estimateV01Scores({ findings, freshConversations, reports, health, fallbackAudit }) {
  const rows = parseSoulRows(reports.soulTriad);
  const avg = (key, fallback) => average(rows.map((row) => row[key]).filter((value) => Number.isFinite(value))) ?? fallback;
  const activeFallbackPollutionCount = findings.activeFallbackPollutionCount;
  const confidenceCap = freshConversations.length >= 3 ? 1 : freshConversations.length > 0 ? 0.72 : 0.55;
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
  collection,
  freshConversations,
  evals,
  amPmContinuity,
  lifeSignals,
  dayWindowLifeSignals,
  reports,
  fallbackAudit,
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
    '',
    '## v0.1 Question',
    '',
    '> Does Alan return and feel: "Yesterday mattered. Today they are not exactly the same."',
    '',
    '## Summary',
    '',
    `- Fresh triad samples: ${freshConversations.length}`,
    `- Soul PASS/WARN/FAIL: ${findings.statusCounts.PASS}/${findings.statusCounts.WARN}/${findings.statusCounts.FAIL}`,
    `- Recent PASS/WARN/FAIL: ${findings.recentStatusCounts.PASS}/${findings.recentStatusCounts.WARN}/${findings.recentStatusCounts.FAIL}`,
    `- Top failure category: ${findings.topFailureCategory}`,
    `- Observed issue: ${findings.observedIssue}`,
    `- Repair class: ${findings.repairClass}`,
    `- Rubric disagreement: ${findings.rubricDisagreement ? 'yes' : 'no'}`,
    `- Recent failure reason: ${findings.recentFailureReason ?? 'none'}`,
    `- Provider health: ${collection.providerHealth}`,
    `- Runtime health: ${health.healthy ? 'ok' : 'check'}`,
    `- Active fallback pollution count: ${findings.activeFallbackPollutionCount}`,
    `- Archived fallback history count: ${findings.archivedFallbackHistoryCount}`,
    `- Fresh fallback markers: ${findings.freshFallbackMarkers}`,
    `- Stage-direction leak sum: ${findings.stageDirectionLeaks.toFixed(2)}`,
    `- Echo penalty sum: ${findings.echoPenalty.toFixed(2)}`,
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
    '',
    '## v0.1 Scores',
    '',
    ...Object.entries(scores).map(([key, value]) => `- ${key}: ${value.toFixed(2)}`),
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
    '## Health Checks',
    '',
    `- worldClock: ${health.worldClock.ok ? 'ok' : 'failed'}`,
    `- debugState: ${health.debugState.ok ? 'ok' : 'failed'}`,
    `- playerCount: ${health.playerCount ?? 'unknown'}`,
    `- fallback audit: ${fallbackAudit.ok ? 'ok' : 'failed'}`,
    '',
    '## Collection',
    '',
    `- attempted: ${collection.attempted ? 'yes' : 'no'}`,
    `- dry_run: ${collection.dryRun ? 'yes' : 'no'}`,
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
      env: process.env,
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
  return code !== 0 && /timed out after|timeout waiting|no fresh archived/i.test(output);
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
    label: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} America/Chicago`,
  };
}

function isTriadConversation(conversation) {
  const participants = conversation?.involvedCharacters ?? [];
  return participants.filter((name) => TRIAD_NAMES.has(name)).length >= 2;
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
    averageLifeSignalScore: field('Average life signal score'),
    nextSafestAction: field('Next safest action'),
  };
}

function parseSoulRows(report) {
  return report
    .split('\n')
    .filter((line) => line.startsWith('conversation-'))
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim());
      return {
        conversation: cells[0],
        participants: cells[1],
        messages: Number(cells[2]),
        status: cells[3],
        score: Number(cells[4]),
        otherAware: Number(cells[5]),
        privateSelf: Number(cells[6]),
        memoryResidue: Number(cells[7]),
        behavior: Number(cells[8]),
        humanAftertaste: Number(cells[14]),
        stageDirectionLeakPenalty: Number(cells[19]),
        echoPenalty: Number(cells[20]),
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

main().catch((error) => {
  console.error(`[underworld-observe] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = 1;
});

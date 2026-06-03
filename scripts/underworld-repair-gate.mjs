#!/usr/bin/env node
// GIIS Underworld v0.1 repair gate.
//
// This script decides whether a finding may be auto-fixed, must become a
// proposal, or should remain observe-only. It does not edit runtime code.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'v01-approach-latest.md');
const REVIEW_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'v01-repair-gate-latest.md');
const PROPOSAL_DIR = join(REPO_ROOT, 'umi', 'proposals');

const args = parseArgs(process.argv.slice(2));
const REQUESTED_CATEGORY = args.get('category');
const DRY_RUN = args.get('dry-run') === 'true';
const CC_MODE = args.get('cc') ?? 'auto';
const SELF_TEST = args.get('self-test') === 'true';

const AUTO_FIX_ALLOWED = new Set([
  'wrong_addressee',
  'stage_direction_leak',
  'fallback_contamination',
  'echo_repetition',
  'eval_parser_or_report_bug',
  'provider_failure_handling',
]);

const PROPOSAL_ONLY = new Set([
  'eval_rubric_disagreement',
  'conversation_quality_gap',
  'runtime_health',
  'soul_quality_gap',
  'memory_continuity_gap',
  'hygiene_failure',
  'life_signal_repeated',
  'prop_echo_repeated',
  'life_signal_missing',
  'conversation_shape_collapse',
  'post_processing_drift',
  'scene_diversity_thin',
  'daily_rhythm_thin',
  'soul_style_flat',
  'relationship_flattening',
  'atmosphere_collapse',
  'memory_architecture',
  'relationship_schema',
  'emotional_system',
  'provider_migration',
  'major_prompt_rewrite',
  'new_autonomous_behavior',
  'db_cleanup',
  'soul_architecture',
  'broad_character_expansion',
]);
const OBSERVE_ONLY = new Set(['none', 'sample_pending']);

async function main() {
  if (SELF_TEST) {
    runSelfTest();
    return;
  }

  const report = await readOptional(REPORT_PATH);
  if (!report && !REQUESTED_CATEGORY) {
    console.log('[underworld-repair-gate] no latest report found; run npm run underworld:observe first');
    process.exitCode = 2;
    return;
  }

  const diagnosis = diagnoseReport(report, REQUESTED_CATEGORY);
  const category = diagnosis.category;
  const classification = classify(category);
  const evidence = extractEvidence(report);
  const ccReview = await maybeRunCcReview({ diagnosis, classification, evidence, report });
  const umiDecision = decideNextAction({ diagnosis, classification, ccReview });

  console.log(`category=${category}`);
  console.log(`classification=${classification}`);
  console.log(`decision=${umiDecision.changeSize}`);

  let proposalPath = '';
  if (classification === 'proposal_only' && umiDecision.changeSize === 'large_change_proposal_required') {
    proposalPath = await writeProposal({ category, evidence, report, diagnosis, ccReview });
    console.log(`proposal=${relative(proposalPath)}`);
    if (DRY_RUN) console.log('dry_run=true; proposal file still written because proposal generation is non-runtime.');
  }

  await writeReviewReport({ diagnosis, classification, evidence, ccReview, umiDecision, proposalPath, report });
  console.log(`review_report=${relative(REVIEW_REPORT_PATH)}`);

  if (umiDecision.changeSize === 'observe_only') {
    console.log('Observe only. No code change should be made.');
    return;
  }

  if (umiDecision.changeSize === 'small_fix_candidate') {
    console.log('Auto-fix is allowed only if the evidence is specific and the patch is narrowly scoped.');
    console.log('This gate does not modify code by itself.');
    return;
  }

  if (umiDecision.changeSize === 'large_change_proposal_required') return;
}

function runSelfTest() {
  const samplePending = evaluateSelfTestReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 0
- Top failure category: sample_pending
- Repair class: observe_only
- AM→PM continuity: WARN / sample_pending
- Life signals: WARN / sample_pending

Post-fix conversations checked: 0
Post-fix summary: 0 PASS / 0 WARN / 0 FAIL

## AM→PM Continuity

- status: WARN
- decision: sample_pending
- morning samples: 2
- afternoon samples: 0
- AM residue candidates: 1
- PM callbacks found: 0

## Life Signals

- status: WARN
- decision: sample_pending
- conversation count: 0
- repeated line flags: 0
- administrative drift flags: 0
`);
  assertEqual(samplePending.diagnosis.category, 'sample_pending', 'sample pending category');
  assertEqual(samplePending.classification, 'observe_only', 'sample pending classification');
  assertEqual(samplePending.decision.changeSize, 'observe_only', 'sample pending decision');

  const amPmGap = evaluateSelfTestReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 3
- Top failure category: sample_pending
- Repair class: observe_only
- AM→PM continuity: FAIL / no_pm_callback
- Life signals: PASS / life_signal_observed

Post-fix conversations checked: 3
Post-fix summary: 0 PASS / 2 WARN / 1 FAIL

## AM→PM Continuity

- status: FAIL
- decision: no_pm_callback
- morning samples: 3
- afternoon samples: 3
- AM residue candidates: 3
- PM callbacks found: 0

## Life Signals

- status: PASS
- decision: life_signal_observed
- conversation count: 3
- repeated line flags: 0
- administrative drift flags: 0
`);
  assertEqual(amPmGap.diagnosis.category, 'memory_continuity_gap', 'AM→PM gap category');
  assertEqual(amPmGap.classification, 'proposal_only', 'AM→PM gap classification');
  assertEqual(amPmGap.decision.changeSize, 'large_change_proposal_required', 'AM→PM gap decision');

  const freshLifeRepetition = evaluateSelfTestReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 3
- Top failure category: sample_pending
- Repair class: observe_only
- AM→PM continuity: PASS / continuity_observed
- Life signals: WARN / life_signal_repeated

Post-fix conversations checked: 3
Post-fix summary: 1 PASS / 2 WARN / 0 FAIL

## AM→PM Continuity

- status: PASS
- decision: continuity_observed
- morning samples: 3
- afternoon samples: 3
- AM residue candidates: 2
- PM callbacks found: 1

## Life Signals

- status: WARN
- decision: life_signal_repeated
- conversation count: 3
- repeated line flags: 2
- administrative drift flags: 0
`);
  assertEqual(freshLifeRepetition.diagnosis.category, 'life_signal_repeated', 'fresh life repetition category');
  assertEqual(freshLifeRepetition.classification, 'proposal_only', 'fresh life repetition classification');
  assertEqual(freshLifeRepetition.decision.changeSize, 'large_change_proposal_required', 'fresh life repetition decision');

  const freshPropEcho = evaluateSelfTestReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 3
- Top failure category: sample_pending
- Repair class: observe_only
- AM→PM continuity: PASS / continuity_observed
- Life signals: WARN / prop_echo_repeated

Post-fix conversations checked: 3
Post-fix summary: 1 PASS / 2 WARN / 0 FAIL

## AM→PM Continuity

- status: PASS
- decision: continuity_observed
- morning samples: 3
- afternoon samples: 3
- AM residue candidates: 2
- PM callbacks found: 1

## Life Signals

- status: WARN
- decision: prop_echo_repeated
- conversation count: 3
- prop echo flags: 1
- repeated line flags: 0
- administrative drift flags: 0
`);
  assertEqual(freshPropEcho.diagnosis.category, 'prop_echo_repeated', 'fresh prop echo category');
  assertEqual(freshPropEcho.classification, 'proposal_only', 'fresh prop echo classification');
  assertEqual(freshPropEcho.decision.changeSize, 'large_change_proposal_required', 'fresh prop echo decision');

  const freshShapeCollapse = evaluateSelfTestReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 3
- Top failure category: sample_pending
- Repair class: observe_only
- AM→PM continuity: PASS / continuity_observed
- Life signals: FAIL / conversation_shape_collapse

Post-fix conversations checked: 3
Post-fix summary: 0 PASS / 1 WARN / 2 FAIL

## AM→PM Continuity

- status: PASS
- decision: continuity_observed
- morning samples: 3
- afternoon samples: 3
- AM residue candidates: 2
- PM callbacks found: 1

## Life Signals

- status: FAIL
- decision: conversation_shape_collapse
- conversation count: 3
- conversation shape flags: 2
- single-message conversations: 1
- one-speaker conversations: 1
- repeated line flags: 0
- administrative drift flags: 0
`);
  assertEqual(freshShapeCollapse.diagnosis.category, 'conversation_shape_collapse', 'fresh shape collapse category');
  assertEqual(freshShapeCollapse.classification, 'proposal_only', 'fresh shape collapse classification');
  assertEqual(freshShapeCollapse.decision.changeSize, 'large_change_proposal_required', 'fresh shape collapse decision');

  const freshThinScenes = evaluateSelfTestReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 5
- Top failure category: sample_pending
- Repair class: observe_only
- AM→PM continuity: PASS / continuity_observed
- Life signals: WARN / scene_diversity_thin

Post-fix conversations checked: 5
Post-fix summary: 1 PASS / 4 WARN / 0 FAIL

## AM→PM Continuity

- status: PASS
- decision: continuity_observed
- morning samples: 5
- afternoon samples: 5
- AM residue candidates: 3
- PM callbacks found: 1

## Life Signals

- status: WARN
- decision: scene_diversity_thin
- conversation count: 5
- ordinary scene diversity: 1
- office-grounded conversations: 4
- ordinary-scene conversations: 1
- conversation shape flags: 0
- single-message conversations: 0
- repeated line flags: 0
- administrative drift flags: 0
`);
  assertEqual(freshThinScenes.diagnosis.category, 'scene_diversity_thin', 'fresh thin scene category');
  assertEqual(freshThinScenes.classification, 'proposal_only', 'fresh thin scene classification');
  assertEqual(freshThinScenes.decision.changeSize, 'large_change_proposal_required', 'fresh thin scene decision');

  const freshThinRhythm = evaluateSelfTestReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 5
- Top failure category: sample_pending
- Repair class: observe_only
- AM→PM continuity: PASS / continuity_observed
- Life signals: WARN / daily_rhythm_thin

Post-fix conversations checked: 5
Post-fix summary: 1 PASS / 4 WARN / 0 FAIL

## AM→PM Continuity

- status: PASS
- decision: continuity_observed
- morning samples: 5
- afternoon samples: 5
- AM residue candidates: 3
- PM callbacks found: 1

## Life Signals

- status: WARN
- decision: daily_rhythm_thin
- conversation count: 5
- ordinary scene diversity: 3
- office-grounded conversations: 1
- ordinary-scene conversations: 5
- daily rhythm conversations: 0
- daily rhythm diversity: 0
- conversation shape flags: 0
- single-message conversations: 0
- repeated line flags: 0
- administrative drift flags: 0
`);
  assertEqual(freshThinRhythm.diagnosis.category, 'daily_rhythm_thin', 'fresh thin rhythm category');
  assertEqual(freshThinRhythm.classification, 'proposal_only', 'fresh thin rhythm classification');
  assertEqual(freshThinRhythm.decision.changeSize, 'large_change_proposal_required', 'fresh thin rhythm decision');

  const freshFlatSoulStyle = evaluateSelfTestReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 5
- Top failure category: sample_pending
- Repair class: observe_only
- AM→PM continuity: PASS / continuity_observed
- Life signals: WARN / soul_style_flat

Post-fix conversations checked: 5
Post-fix summary: 1 PASS / 4 WARN / 0 FAIL

## AM→PM Continuity

- status: PASS
- decision: continuity_observed
- morning samples: 5
- afternoon samples: 5
- AM residue candidates: 3
- PM callbacks found: 1

## Life Signals

- status: WARN
- decision: soul_style_flat
- conversation count: 5
- ordinary scene diversity: 3
- office-grounded conversations: 1
- ordinary-scene conversations: 5
- daily rhythm conversations: 5
- daily rhythm diversity: 3
- soul-style conversations: 0
- soul-style diversity: 0
- conversation shape flags: 0
- single-message conversations: 0
- repeated line flags: 0
- administrative drift flags: 0
`);
  assertEqual(freshFlatSoulStyle.diagnosis.category, 'soul_style_flat', 'fresh flat soul-style category');
  assertEqual(freshFlatSoulStyle.classification, 'proposal_only', 'fresh flat soul-style classification');
  assertEqual(freshFlatSoulStyle.decision.changeSize, 'large_change_proposal_required', 'fresh flat soul-style decision');

  const hygieneFailure = evaluateSelfTestReport(`
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 3
- Top failure category: sample_pending
- Repair class: observe_only
- AM→PM continuity: PASS / continuity_observed
- Life signals: FAIL / hygiene_failure

Post-fix conversations checked: 3
Post-fix summary: 0 PASS / 0 WARN / 1 FAIL

## AM→PM Continuity

- status: PASS
- decision: continuity_observed
- morning samples: 3
- afternoon samples: 3
- AM residue candidates: 2
- PM callbacks found: 1

## Life Signals

- status: FAIL
- decision: hygiene_failure
- conversation count: 3
- life-grounded conversations: 2
- administrative drift flags: 0
- hygiene flags: 1
- conversation shape flags: 0
- single-message conversations: 0
- one-speaker conversations: 0
- repeated line flags: 0
- scene diversity: 2
- ordinary scene diversity: 2
- office-grounded conversations: 0
- ordinary-scene conversations: 3
- daily rhythm conversations: 3
- daily rhythm diversity: 2
- soul-style conversations: 3
- soul-style diversity: 2
- average life signal score: 0.75
`);
  assertEqual(hygieneFailure.diagnosis.category, 'hygiene_failure', 'hygiene failure category');
  assertEqual(hygieneFailure.classification, 'proposal_only', 'hygiene failure classification');
  assertEqual(hygieneFailure.decision.changeSize, 'large_change_proposal_required', 'hygiene failure decision');
  assertEqual(hygieneFailure.diagnosis.lifeSignals.hygieneFlags, '1', 'hygiene failure parsed hygiene flags');
  assertEqual(hygieneFailure.diagnosis.lifeSignals.soulStyleConversations, '3', 'hygiene failure parsed soul-style conversations');
  assertEqual(hygieneFailure.diagnosis.lifeSignals.dailyRhythmDiversity, '2', 'hygiene failure parsed daily rhythm diversity');

  const dbCleanup = evaluateSelfTestReport(
    `
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 0
- Top failure category: sample_pending
- Repair class: observe_only
- Active fallback pollution count: 236
- Archived fallback history count: 248

## Fallback Pollution

- active_total: 236
- memories: 48
- world_events: 174
- notifications: 12
- polluted_profiles: 2
- policy: proposal-only; do not apply cleanup without Alan approval and fresh-sample evidence.
`,
    'db_cleanup',
  );
  assertEqual(dbCleanup.diagnosis.category, 'db_cleanup', 'requested DB cleanup category');
  assertEqual(dbCleanup.classification, 'proposal_only', 'DB cleanup classification');
  assertEqual(dbCleanup.decision.changeSize, 'large_change_proposal_required', 'DB cleanup proposal decision');

  const lowSampleLifeRepetition = evaluateSelfTestReport(
    `
# GIIS Underworld v0.1 Approach Report

## Summary

- Fresh triad samples: 0
- Top failure category: sample_pending
- Repair class: observe_only
- AM→PM continuity: PASS / continuity_observed
- Life signals: WARN / life_signal_repeated

Post-fix conversations checked: 0
Post-fix summary: 0 PASS / 0 WARN / 0 FAIL

## AM→PM Continuity

- status: PASS
- decision: continuity_observed
- morning samples: 3
- afternoon samples: 3
- AM residue candidates: 2
- PM callbacks found: 1

## Life Signals

- status: WARN
- decision: life_signal_repeated
- conversation count: 1
- repeated line flags: 1
- administrative drift flags: 0
`,
    'life_signal_repeated',
  );
  assertEqual(lowSampleLifeRepetition.diagnosis.category, 'life_signal_repeated', 'low-sample life repetition category');
  assertEqual(lowSampleLifeRepetition.classification, 'proposal_only', 'low-sample life repetition classification');
  assertEqual(lowSampleLifeRepetition.decision.changeSize, 'observe_only', 'low-sample life repetition decision');
  assertIncludes(
    lowSampleLifeRepetition.decision.blockedReasons,
    'life_signal_needs_fresh_samples',
    'low-sample life repetition blocker',
  );

  console.log('[underworld-repair-gate:self-test] PASS');
}

function evaluateSelfTestReport(report, requestedCategory) {
  const diagnosis = diagnoseReport(report, requestedCategory);
  const classification = classify(diagnosis.category);
  const decision = decideNextAction({
    diagnosis,
    classification,
    ccReview: { status: 'skipped_self_test', output: '' },
  });
  return { diagnosis, classification, decision };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertIncludes(values, expected, label) {
  if (!values.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(values)} to include ${expected}`);
  }
}

function classify(category) {
  if (!category || category === 'none' || category === 'sample_pending') return 'observe_only';
  if (AUTO_FIX_ALLOWED.has(category)) return 'auto_fix_allowed';
  if (PROPOSAL_ONLY.has(category)) return 'proposal_only';
  return 'proposal_only';
}

function diagnoseReport(report, requestedCategory) {
  const summary = Object.fromEntries(
    [...report.matchAll(/^- ([^:\n]+):\s*(.+)$/gm)].map((match) => [match[1].trim(), match[2].trim()]),
  );
  const freshTriadSamples = Number(summary['Fresh triad samples'] ?? 0);
  const passWarnFail = parsePassWarnFail(summary['Soul PASS/WARN/FAIL'] ?? summary['PASS/WARN/FAIL']);
  const recentPassWarnFail = parsePassWarnFail(summary['Recent PASS/WARN/FAIL']);
  const reportTopCategory = requestedCategory ?? summary['Top failure category'] ?? 'unknown';
  const repairClass = summary['Repair class'] ?? classify(reportTopCategory);
  const amPm = parseAmPmContinuity(report);
  const lifeSignals = parseLifeSignals(report);
  const postFixChecked = Number(report.match(/Post-fix conversations checked:\s*(\d+)/)?.[1] ?? 0);
  const postFixSummary = report.match(/Post-fix summary:\s*(.+)$/m)?.[1]?.trim() ?? 'unknown';
  const recentFailures = [...report.matchAll(/^### (conversation-[^\s]+) - FAIL \(([^)]+)\)[\s\S]*?Suggested fix category:\s*(.+?)(?:\n\n|$)/gm)].map(
    (match) => ({
      id: match[1],
      score: match[2],
      suggestedFix: match[3].trim(),
    }),
  );
  const resultRows = [...report.matchAll(/^\| (conversation-[^|]+) \| ([^|]+) \| post_fix \| FAIL \| ([^|]+) \| ([^|]+) \|/gm)].map(
    (match) => ({
      id: match[1].trim(),
      participants: match[2].trim(),
      score: match[3].trim(),
      failureCategory: match[4].trim(),
    }),
  );
  const hasStageLeak = /Stage-direction leak sum:\s*(?!0\.00)[0-9.]+|stage_direction_leak_penalty|我合上|我放下|我把手機|我看向/.test(report);
  const hasWrongAddressee = /wrong addressee|wrongAddressee/i.test(report);
  const hasFallback = /Fresh fallback markers:\s*(?!0\b)\d+|fallback contamination|fallback_contamination/i.test(report);
  const hasEcho = /Echo penalty sum:\s*(?!0\.00)[0-9.]+|echo_repetition|repeats input verbatim|你剛說|你剛才說/.test(report);
  const hasProviderIssue = /Provider health:\s*unavailable|provider_failure_handling|429|quota|timeout|model_not_found/i.test(report);
  const hasVoiceOrSoulGap = /restore character-specific voice|too abstract|character voice|soul_quality_gap|relationship|aftertaste|behavior drift/i.test(report);

  let conversationCategory = 'none';
  if (postFixChecked > 0 || freshTriadSamples > 0) {
    if (hasFallback) conversationCategory = 'fallback_contamination';
    else if (hasStageLeak) conversationCategory = 'stage_direction_leak';
    else if (hasWrongAddressee) conversationCategory = 'wrong_addressee';
    else if (hasEcho) conversationCategory = 'echo_repetition';
    else if (hasVoiceOrSoulGap) conversationCategory = 'soul_quality_gap';
  }

  const hasAmPmContinuityGap =
    amPm.status === 'FAIL' &&
    !['sample_pending', undefined, ''].includes(amPm.decision) &&
    Number(amPm.afternoonSamples ?? 0) >= 3;
  const hasLifeSignalGap =
    [
      'life_signal_repeated',
      'prop_echo_repeated',
      'hygiene_failure',
      'life_signal_missing',
      'conversation_shape_collapse',
      'post_processing_drift',
      'scene_diversity_thin',
      'daily_rhythm_thin',
      'soul_style_flat',
    ].includes(lifeSignals.decision ?? '') &&
    (freshTriadSamples >= 3 || postFixChecked >= 3);
  const reportCategoryHasPriority =
    PROPOSAL_ONLY.has(reportTopCategory) ||
    (OBSERVE_ONLY.has(reportTopCategory) && !hasAmPmContinuityGap && !hasLifeSignalGap);
  const category =
    requestedCategory ??
    (hasAmPmContinuityGap
      ? 'memory_continuity_gap'
      : hasLifeSignalGap
      ? lifeSignals.decision
      : reportCategoryHasPriority
      ? reportTopCategory
      : postFixChecked > 0 && conversationCategory !== 'none'
        ? conversationCategory
        : reportTopCategory || 'unknown');
  const confidence =
    hasAmPmContinuityGap || postFixChecked >= 3 || freshTriadSamples >= 3
      ? 'enough_samples'
      : postFixChecked > 0 || freshTriadSamples > 0
        ? 'low_sample_warning'
        : 'sample_pending';

  return {
    category,
    reportTopCategory,
    repairClass,
    confidence,
    freshTriadSamples,
    passWarnFail,
    recentPassWarnFail,
    postFixChecked,
    postFixSummary,
    amPm,
    lifeSignals,
    recentFailures,
    resultRows,
    operationalIssue: hasProviderIssue ? 'provider_unavailable_or_timeout' : 'none',
    conversationCategory,
  };
}

function decideNextAction({ diagnosis, classification, ccReview }) {
  const blockedReasons = reviewBlockers(diagnosis);
  if (blockedReasons.length) {
    return {
      changeSize: 'observe_only',
      action: `No repair this cycle: ${blockedReasons.join('; ')}.`,
      blockedReasons,
    };
  }
  if (diagnosis.confidence === 'sample_pending' && diagnosis.category !== 'db_cleanup') {
    return {
      changeSize: 'observe_only',
      action: 'No conversation repair. Wait for fresh samples.',
      blockedReasons: ['sample_pending'],
    };
  }
  if (diagnosis.confidence === 'low_sample_warning' && classification === 'auto_fix_allowed') {
    return {
      changeSize: 'observe_only',
      action: 'Too few samples for auto-repair. Keep observing or draft proposal only.',
      blockedReasons: ['low_sample_warning'],
    };
  }
  if (classification === 'auto_fix_allowed') {
    return {
      changeSize: 'small_fix_candidate',
      action: `Small targeted fix may be considered for ${diagnosis.category}; require narrow evidence and verification.`,
      blockedReasons: [],
    };
  }
  if (classification === 'proposal_only') {
    return {
      changeSize: 'large_change_proposal_required',
      action: `Do not patch directly. Review proposal before changing ${diagnosis.category}.`,
      blockedReasons: [],
    };
  }
  return {
    changeSize: 'observe_only',
    action: 'Continue observing.',
    blockedReasons: [],
  };
}

function reviewBlockers(diagnosis) {
  const blockers = [];
  if (diagnosis.confidence === 'sample_pending' && diagnosis.category !== 'db_cleanup') {
    blockers.push('sample_pending');
  }
  if (
    diagnosis.confidence === 'low_sample_warning' &&
    !PROPOSAL_ONLY.has(diagnosis.category)
  ) {
    blockers.push('fresh_samples_below_3');
  }
  if (diagnosis.operationalIssue !== 'none' && diagnosis.category !== 'db_cleanup') {
    blockers.push(diagnosis.operationalIssue);
  }
  if (diagnosis.amPm?.decision === 'sample_pending' && diagnosis.category !== 'db_cleanup') {
    blockers.push('am_pm_sample_pending');
  }
  if (
    [
      'life_signal_repeated',
      'prop_echo_repeated',
      'hygiene_failure',
      'life_signal_missing',
      'conversation_shape_collapse',
      'post_processing_drift',
      'scene_diversity_thin',
      'daily_rhythm_thin',
      'soul_style_flat',
    ].includes(diagnosis.lifeSignals?.decision ?? '') &&
    diagnosis.confidence === 'sample_pending' &&
    diagnosis.category !== 'db_cleanup'
  ) {
    blockers.push('life_signal_needs_fresh_samples');
  }
  if (
    diagnosis.reportTopCategory &&
    diagnosis.category &&
    diagnosis.reportTopCategory !== diagnosis.category &&
    diagnosis.operationalIssue !== 'none' &&
    diagnosis.category !== 'db_cleanup'
  ) {
    blockers.push(`category_mismatch:${diagnosis.reportTopCategory}->${diagnosis.category}`);
  }
  return blockers;
}

async function maybeRunCcReview({ diagnosis, classification, evidence, report }) {
  if (DRY_RUN || CC_MODE === 'skip') {
    return { status: DRY_RUN ? 'skipped_dry_run' : 'skipped_by_flag', output: '' };
  }
  const available = await commandAvailable('claude');
  if (!available || CC_MODE === 'unavailable') return { status: 'unavailable', output: '' };

  const prompt = [
    'GIIS Underworld v0.1 two-hour conversation repair review.',
    'Role: cc second-opinion / code-review advisor.',
    'Do not modify files. Do not run Convex/provider commands. Read this report excerpt only.',
    '',
    'Task:',
    '- Judge whether the finding should be observe-only, small targeted fix, or large proposal-only.',
    '- Look for overclaiming, insufficient samples, soul regression risk, prompt/code risk, and whether the current classification is too aggressive.',
    '- If a small fix is plausible, name the narrowest safe fix and verification.',
    '- If a large change is needed, say proposal-only.',
    '',
    `Diagnosis: ${JSON.stringify(diagnosis)}`,
    `Classification: ${classification}`,
    '',
    'Evidence:',
    evidence.slice(0, 3000),
    '',
    'Latest report excerpt:',
    report.slice(0, 6000),
  ].join('\n');

  const review = await runCommand('claude', ['-p', prompt], { timeout: 90_000, quiet: true });
  if (review.code !== 0) return { status: 'unavailable', output: review.stderr.slice(-2000) };
  return { status: 'completed', output: review.stdout.trim().slice(0, 5000) };
}

async function writeReviewReport({ diagnosis, classification, evidence, ccReview, umiDecision, proposalPath, report }) {
  await mkdir(dirname(REVIEW_REPORT_PATH), { recursive: true });
  const lines = [
    '# GIIS Underworld v0.1 Two-Hour Repair Review',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mode: repair_gate${DRY_RUN ? ' dry_run' : ''}`,
    '',
    '## Decision',
    '',
    `- Category: ${diagnosis.category}`,
    `- Classification: ${classification}`,
    `- Change size: ${umiDecision.changeSize}`,
    `- Umi decision: ${umiDecision.action}`,
    `- Confidence: ${diagnosis.confidence}`,
    `- Fresh triad samples: ${diagnosis.freshTriadSamples}`,
    `- Post-fix conversations checked: ${diagnosis.postFixChecked}`,
    `- Post-fix summary: ${diagnosis.postFixSummary}`,
    `- Operational issue: ${diagnosis.operationalIssue}`,
    `- Conversation category: ${diagnosis.conversationCategory}`,
    `- AM→PM continuity: ${diagnosis.amPm?.status ?? 'unknown'} / ${diagnosis.amPm?.decision ?? 'unknown'}`,
    `- AM→PM samples: morning=${diagnosis.amPm?.morningSamples ?? 'unknown'} afternoon=${diagnosis.amPm?.afternoonSamples ?? 'unknown'}`,
    `- Life signals: ${diagnosis.lifeSignals?.status ?? 'unknown'} / ${diagnosis.lifeSignals?.decision ?? 'unknown'}`,
    `- Life samples: conversations=${diagnosis.lifeSignals?.conversationCount ?? 'unknown'} repeated_lines=${diagnosis.lifeSignals?.repeatedLineFlags ?? 'unknown'} prop_echo=${diagnosis.lifeSignals?.propEchoFlags ?? 'unknown'} shape_flags=${diagnosis.lifeSignals?.conversationShapeFlags ?? 'unknown'} single_message=${diagnosis.lifeSignals?.singleMessageConversations ?? 'unknown'} post_processing_drift=${diagnosis.lifeSignals?.postProcessingDriftFlags ?? 'unknown'} ordinary_scenes=${diagnosis.lifeSignals?.ordinarySceneDiversity ?? 'unknown'} daily_rhythm=${diagnosis.lifeSignals?.dailyRhythmConversations ?? 'unknown'} soul_style=${diagnosis.lifeSignals?.soulStyleConversations ?? 'unknown'} admin_drift=${diagnosis.lifeSignals?.administrativeDriftFlags ?? 'unknown'}`,
    `- CC review: ${ccReview.status}`,
    `- Code changed: no`,
    proposalPath ? `- Proposal: ${relative(proposalPath)}` : '- Proposal: none',
    `- Blocked reasons: ${umiDecision.blockedReasons.length ? umiDecision.blockedReasons.join(', ') : 'none'}`,
    '',
    '## Conversation Failures',
    '',
    ...conversationFailureLines(diagnosis),
    '',
    '## Evidence',
    '',
    evidence || 'No focused evidence extracted. See report excerpt.',
    '',
    '## CC Second Opinion',
    '',
    ccReview.output || `(cc_review=${ccReview.status})`,
    '',
    '## Repair Boundary',
    '',
    '- Small auto-fix candidates: wrong addressee, stage-direction leak, fallback contamination, obvious echo repetition, eval/report bug, provider failure handling.',
    '- Proposal-only: memory architecture, relationship schema, emotional systems, provider migration, major prompt rewrites, autonomous behavior changes, DB cleanup, soul architecture, broad character expansion.',
    '- If samples are insufficient, do not modify code.',
    '',
    '## Latest Approach Report Excerpt',
    '',
    '```md',
    report.slice(0, 6000),
    '```',
    '',
  ];
  await writeFile(REVIEW_REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function conversationFailureLines(diagnosis) {
  const failures = diagnosis.recentFailures.length ? diagnosis.recentFailures : diagnosis.resultRows;
  if (!failures.length) return ['No post-fix conversation failure rows found.'];
  return failures.map((failure) => {
    const label = failure.suggestedFix ?? failure.failureCategory ?? 'unknown';
    return `- ${failure.id}: score=${failure.score}; issue=${label}`;
  });
}

async function writeProposal({ category, evidence, report, diagnosis, ccReview }) {
  await mkdir(PROPOSAL_DIR, { recursive: true });
  const path = join(PROPOSAL_DIR, `${timestampSlug(Date.now())}-v01-approach-proposal.md`);
  const lines = [
    '# GIIS Underworld v0.1 Approach Proposal',
    '',
    `Created: ${new Date().toISOString()}`,
    `Category: ${category}`,
    `Confidence: ${diagnosis?.confidence ?? 'unknown'}`,
    '',
    '## Evidence',
    '',
    evidence || 'See latest approach report excerpt below.',
    '',
    '## CC Second Opinion',
    '',
    ccReview?.output || `(cc_review=${ccReview?.status ?? 'not_run'})`,
    '',
    '## Affected Files',
    '',
    '- TBD after human approval.',
    '',
    '## Expected Benefit',
    '',
    'Move the world closer to v0.1: yesterday emotionally matters, without optimizing only for eval score.',
    '',
    '## Risks',
    '',
    '- Overfitting to insufficient samples.',
    '- Damaging character identity or emotional distinctiveness.',
    '- Increasing DB writes or provider usage.',
    '- Making the world more optimized but less human.',
    '',
    '## Rollback Plan',
    '',
    '- Revert the approved patch only.',
    '- Re-run `npm run underworld:observe` and compare against the previous report.',
    '- If runtime state was affected, stop and ask Alan before cleanup.',
    '',
    '## Report Excerpt',
    '',
    '```md',
    report.slice(0, 5000),
    '```',
    '',
  ];
  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  return path;
}

function extractEvidence(report) {
  const weakest = report.match(/## Weakest Recent Failure\n\n([\s\S]*?)\n\n## /)?.[1]?.trim();
  const summary = report.match(/## Summary\n\n([\s\S]*?)\n\n## /)?.[1]?.trim();
  const amPm = report.match(/## AM→PM Continuity\n\n([\s\S]*?)(?:\n\n## |\n```md|$)/)?.[1]?.trim();
  const life = report.match(/## Life Signals\n\n([\s\S]*?)(?:\n\n## |\n```md|$)/)?.[1]?.trim();
  return [summary, weakest, amPm ? `AM→PM continuity:\n${amPm}` : '', life ? `Life signals:\n${life}` : '']
    .filter(Boolean)
    .join('\n\n');
}

function parseAmPmContinuity(report) {
  const section = report.match(/## AM→PM Continuity\n\n([\s\S]*?)(?:\n```md|\n\n## |$)/)?.[1] ?? '';
  const field = (label) =>
    section.match(new RegExp(`^- ${label}:\\s*(.+)$`, 'mi'))?.[1]?.trim();
  const summary = report.match(/^- AM→PM continuity:\s*([^/\n]+)\/\s*(.+)$/m);
  return {
    status: field('status') ?? summary?.[1]?.trim(),
    decision: field('decision') ?? summary?.[2]?.trim(),
    morningSamples: field('morning samples'),
    afternoonSamples: field('afternoon samples'),
    amResidueCandidates: field('AM residue candidates'),
    pmCallbacksFound: field('PM callbacks found'),
  };
}

function parseLifeSignals(report) {
  const section = report.match(/## Life Signals\n\n([\s\S]*?)(?:\n```md|\n\n## |$)/)?.[1] ?? '';
  const field = (label) =>
    section.match(new RegExp(`^- ${label}:\\s*(.+)$`, 'mi'))?.[1]?.trim();
  const summary = report.match(/^- Life signals:\s*([^/\n]+)\/\s*(.+)$/m);
  return {
    status: field('status') ?? summary?.[1]?.trim(),
    decision: field('decision') ?? summary?.[2]?.trim(),
    conversationCount: field('conversation count'),
    lifeGroundedConversations: field('life-grounded conversations'),
    administrativeDriftFlags: field('administrative drift flags'),
    hygieneFlags: field('hygiene flags'),
    conversationShapeFlags: field('conversation shape flags'),
    singleMessageConversations: field('single-message conversations'),
    oneSpeakerConversations: field('one-speaker conversations'),
    postProcessingDriftFlags: field('post-processing drift flags'),
    propEchoFlags: field('prop echo flags'),
    repeatedLineFlags: field('repeated line flags'),
    sceneDiversity: field('scene diversity'),
    ordinarySceneDiversity: field('ordinary scene diversity'),
    officeGroundedConversations: field('office-grounded conversations'),
    ordinarySceneConversations: field('ordinary-scene conversations'),
    dailyRhythmConversations: field('daily rhythm conversations'),
    dailyRhythmDiversity: field('daily rhythm diversity'),
    soulStyleConversations: field('soul-style conversations'),
    soulStyleDiversity: field('soul-style diversity'),
    averageLifeSignalScore: field('average life signal score'),
  };
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

async function commandAvailable(command) {
  const result = await runCommand('which', [command], { timeout: 10_000, quiet: true });
  return result.code === 0;
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

function parsePassWarnFail(value) {
  const match = value?.match(/(\d+)\/(\d+)\/(\d+)/);
  return {
    PASS: Number(match?.[1] ?? 0),
    WARN: Number(match?.[2] ?? 0),
    FAIL: Number(match?.[3] ?? 0),
  };
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

function timestampSlug(timestamp) {
  return new Date(timestamp).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

main().catch((error) => {
  console.error(`[underworld-repair-gate] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = 1;
});

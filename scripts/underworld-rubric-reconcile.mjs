#!/usr/bin/env node
// Compare the soul-triad harness with the recent-conversation harness.
//
// This script is intentionally read-only. It does not decide that higher eval
// score equals better soul; it separates v0.1 blockers from playtest-quality
// gaps so Alan/Umi can make the next product decision calmly.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SOUL_REPORT_PATH = join(REPO_ROOT, 'evals', 'conversations', 'reports', 'soul-triad-latest.md');
const RECENT_REPORT_PATH = join(REPO_ROOT, 'evals', 'conversations', 'reports', 'latest.md');
const APPROACH_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'v01-approach-latest.md');
const ROLLING_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'rolling-continuity-latest.md');
const OUTPUT_PATH = join(REPO_ROOT, 'umi', 'reports', 'v01-rubric-reconciliation-latest.md');
const LIFE_SIGNAL_BLOCKER_DECISIONS = new Set([
  'life_signal_repeated',
  'prop_echo_repeated',
  'hygiene_failure',
  'life_signal_missing',
  'conversation_shape_collapse',
  'post_processing_drift',
  'scene_diversity_thin',
  'daily_rhythm_thin',
  'soul_style_flat',
  'pilot_role_action_collapse',
]);

const args = parseArgs(process.argv.slice(2));
if (args.get('self-test') === 'true') {
  runSelfTest();
  process.exit(0);
}

const [soulReport, recentReport, approachReport, rollingReport] = await Promise.all([
  readOptional(SOUL_REPORT_PATH),
  readOptional(RECENT_REPORT_PATH),
  readOptional(APPROACH_REPORT_PATH),
  readOptional(ROLLING_REPORT_PATH),
]);

if (!soulReport || !recentReport) {
  console.error('[underworld-rubric-reconcile] missing eval reports; run npm run underworld:observe first');
  process.exitCode = 2;
} else {
  const reconciliation = reconcileReports({ soulReport, recentReport, approachReport, rollingReport });
  await writeReport(reconciliation);
  console.log(`[underworld-rubric-reconcile] ${reconciliation.decision}: ${reconciliation.nextAction}`);
  console.log(`[underworld-rubric-reconcile] report written: ${relative(OUTPUT_PATH)}`);
  if (reconciliation.decision === 'BLOCKED') process.exitCode = 1;
}

function reconcileReports({ soulReport, recentReport, approachReport, rollingReport = '' }) {
  const soulRows = parseSoulRows(soulReport);
  const recentRows = parseRecentRows(recentReport);
  const recentExamples = parseRecentExamples(recentReport);
  const recentByConversation = new Map(recentRows.map((row) => [row.conversation, row]));
  const comparisons = soulRows.map((soul) => {
    const recent = recentByConversation.get(soul.conversation);
    const reasons = recentExamples.get(soul.conversation) ?? recent?.topReasons ?? [];
    return {
      conversation: soul.conversation,
      participants: soul.participants,
      messages: soul.messages,
      soulStatus: soul.status,
      soulScore: soul.score,
      recentStatus: recent?.status ?? 'MISSING',
      recentScore: recent?.score,
      recentFailureCategory: recent?.failureCategory ?? 'unknown',
      reasons,
      classification: classifyComparison(soul, recent, reasons),
    };
  });

  const freshSamples = numberBullet(approachReport, 'Fresh triad samples');
  const activeFallbackPollution = numberBullet(approachReport, 'Active fallback pollution count');
  const freshFallbackMarkers = numberBullet(approachReport, 'Fresh fallback markers');
  const stageLeak = numberBullet(approachReport, 'Stage-direction leak sum');
  const echoPenalty = numberBullet(approachReport, 'Echo penalty sum');
  const runtimeHealth = bullet(approachReport, 'Runtime health');
  const modelPolicyEnv = bullet(approachReport, 'Model policy env');
  const amPm = bullet(approachReport, 'AM→PM continuity');
  const rollingSummary = parseBulletSection(rollingReport, 'Summary');
  const rollingStatus = field(rollingSummary, 'Status');
  const rollingDecision = field(rollingSummary, 'Decision');
  const rollingCallbacks = number(field(rollingSummary, 'Rolling callbacks found')) ?? 0;
  const rollingContinuityPass =
    rollingStatus === 'PASS' && rollingDecision === 'continuity_observed' && rollingCallbacks > 0;
  const topFailureCategory = bullet(approachReport, 'Top failure category');
  const freshLifeSignals = parseStatusDecision(bullet(approachReport, 'Fresh-window life signals'));
  const amPmStatus = parseStatusDecision(amPm);
  const recentCounts = parseRecentSummary(recentReport);
  const soulCounts = statusCounts(soulRows);
  const hardEchoPenalty =
    echoPenalty > 0 &&
    (topFailureCategory === 'echo_repetition' ||
      ['prop_echo_repeated', 'life_signal_repeated', 'conversation_shape_collapse'].includes(
        freshLifeSignals.decision ?? '',
      ));

  const blockers = [];
  if (runtimeHealth && runtimeHealth !== 'ok') blockers.push('runtime health is not ok');
  if (modelPolicyEnv && modelPolicyEnv !== 'ok') blockers.push('model policy env is not ok');
  if (freshSamples < 3) blockers.push(`fresh sample count is ${freshSamples}, below 3`);
  if (activeFallbackPollution > 0 || freshFallbackMarkers > 0) blockers.push('fallback pollution is visible in current evidence');
  if (stageLeak > 0) blockers.push('stage-direction leak is present in fresh samples');
  if (hardEchoPenalty) blockers.push('soul-triad echo penalty is present in fresh samples');
  if (soulCounts.FAIL > 0) blockers.push('soul-triad harness has FAIL rows');
  if (freshLifeSignals.status === 'WARN' && LIFE_SIGNAL_BLOCKER_DECISIONS.has(freshLifeSignals.decision)) {
    blockers.push(`life signals are WARN / ${freshLifeSignals.decision}`);
  }
  if (rollingStatus) {
    if (!rollingContinuityPass) {
      blockers.push(`rolling two-hour continuity is ${rollingStatus} / ${rollingDecision ?? 'unknown'}`);
    }
  } else if (amPmStatus.status && (amPmStatus.status !== 'PASS' || amPmStatus.decision !== 'continuity_observed')) {
    blockers.push(`AM->PM continuity is ${amPmStatus.status} / ${amPmStatus.decision ?? 'unknown'}`);
  }

  const qualityGaps = qualityGapsFromComparisons(comparisons);
  if (echoPenalty > 0 && !hardEchoPenalty) {
    qualityGaps.push({
      category: 'soft_echo_rubric_gap',
      count: 1,
      meaning: 'soul-triad echo heuristic fired, but life-signals did not find repeated props, repeated lines, or shape collapse',
    });
  }
  const decision =
    blockers.length > 0 ? 'BLOCKED' : qualityGaps.length > 0 ? 'HUMAN_REVIEW_READY' : 'PASS_ALIGNED';
  const nextAction = nextActionFor({ decision, blockers, qualityGaps });

  return {
    generatedAt: new Date().toISOString(),
    decision,
    nextAction,
    summary: {
      freshSamples,
      soulCounts,
      recentCounts,
      runtimeHealth: runtimeHealth ?? 'unknown',
      modelPolicyEnv: modelPolicyEnv ?? 'unknown',
      activeFallbackPollution,
      freshFallbackMarkers,
      stageLeak,
      echoPenalty,
      rollingContinuity: rollingStatus ? `${rollingStatus} / ${rollingDecision ?? 'unknown'}` : 'missing',
      rollingCallbacks,
      amPm: amPm ?? 'unknown',
    },
    blockers,
    qualityGaps,
    comparisons,
  };
}

function nextActionFor({ decision, blockers, qualityGaps }) {
  if (decision === 'BLOCKED') {
    const onlyAmPmSamplePending =
      blockers.length === 1 && /^AM->PM continuity is WARN \/ sample_pending$/.test(blockers[0]);
    const onlyRollingSamplePending =
      blockers.length === 1 && /^rolling two-hour continuity is WARN \/ sample_pending$/.test(blockers[0]);
    if (onlyRollingSamplePending) {
      return 'wait for adjacent two-hour natural evidence; do not fix code for sample-pending rolling continuity';
    }
    if (onlyAmPmSamplePending) {
      return 'legacy AM->PM is sample-pending; run rolling continuity before treating this as a blocker';
    }
    const hasLifeSignalBlocker = blockers.some((item) => item.startsWith('life signals are WARN /'));
    if (hasLifeSignalBlocker) {
      return 'collect or read more fresh trio evidence and draft a proposal before changing role-action behavior';
    }
    return 'resolve the listed v0.1 blocker before treating this as playtest-ready';
  }
  if (qualityGaps.length > 0) {
    return 'Alan playtest should judge whether these naturalness gaps feel acceptable before prompt changes';
  }
  return 'continue observation; no rubric repair needed';
}

function classifyComparison(soul, recent, reasons) {
  if (!recent) return 'missing_recent_eval';
  if (soul.status === 'FAIL') return 'v01_soul_blocker';
  if (recent.status === 'PASS') return 'aligned_pass';
  const reasonText = reasons.join(' ').toLowerCase();
  if (/everydayobjectloopscore|over-repeated everyday object/.test(reasonText)) {
    return 'naturalness_object_loop';
  }
  if (/charactervoicescore/.test(reasonText)) {
    return 'voice_rubric_gap';
  }
  if (/previousspeakerbindingscore|mirror repetition/.test(reasonText)) {
    return 'reply_binding_rubric_gap';
  }
  if (/emotion_behavior_link|emotion_tone_link|attention_shift/.test(reasonText)) {
    return 'emotion_visibility_gap';
  }
  return 'recent_quality_gap';
}

function qualityGapsFromComparisons(comparisons) {
  const counts = new Map();
  for (const item of comparisons) {
    if (
      [
        'naturalness_object_loop',
        'voice_rubric_gap',
        'reply_binding_rubric_gap',
        'emotion_visibility_gap',
        'recent_quality_gap',
      ].includes(item.classification)
    ) {
      counts.set(item.classification, (counts.get(item.classification) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count, meaning: qualityGapMeaning(category) }));
}

function qualityGapMeaning(category) {
  switch (category) {
    case 'naturalness_object_loop':
      return 'characters are looping on a concrete prop/object; this is a naturalness issue, not a memory/runtime failure';
    case 'voice_rubric_gap':
      return 'recent eval does not see enough character-specific wording; needs human playtest before prompt tuning';
    case 'reply_binding_rubric_gap':
      return 'responses may mirror the previous speaker too neatly; check by reading transcript, not score alone';
    case 'emotion_visibility_gap':
      return 'emotion may be present as care but not visible enough as behavior/tone/attention';
    default:
      return 'recent eval found quality concerns outside the current v0.1 blocker list';
  }
}

async function writeReport(reconciliation) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const lines = [
    '# GIIS Underworld v0.1 Rubric Reconciliation',
    '',
    `Generated: ${reconciliation.generatedAt}`,
    `Decision: ${reconciliation.decision}`,
    `Next action: ${reconciliation.nextAction}`,
    '',
    '## What This Means',
    '',
    reconciliation.decision === 'BLOCKED'
      ? 'The latest evidence still has a v0.1 blocker. Do not treat this as playtest-ready yet.'
      : reconciliation.decision === 'HUMAN_REVIEW_READY'
        ? 'The core v0.1 gate is not blocked, but recent conversation eval still sees naturalness/voice gaps. This should go to Alan human review before more prompt changes.'
        : 'Soul-triad and recent-conversation evals are aligned enough for continued observation.',
    '',
    '## Summary',
    '',
    `- Fresh triad samples: ${reconciliation.summary.freshSamples}`,
    `- Soul PASS/WARN/FAIL: ${reconciliation.summary.soulCounts.PASS}/${reconciliation.summary.soulCounts.WARN}/${reconciliation.summary.soulCounts.FAIL}`,
    `- Recent PASS/WARN/FAIL: ${reconciliation.summary.recentCounts.PASS}/${reconciliation.summary.recentCounts.WARN}/${reconciliation.summary.recentCounts.FAIL}`,
    `- Runtime health: ${reconciliation.summary.runtimeHealth}`,
    `- Model policy env: ${reconciliation.summary.modelPolicyEnv}`,
    `- Active fallback pollution: ${reconciliation.summary.activeFallbackPollution}`,
    `- Fresh fallback markers: ${reconciliation.summary.freshFallbackMarkers}`,
    `- Stage-direction leak sum: ${reconciliation.summary.stageLeak}`,
    `- Echo penalty sum: ${reconciliation.summary.echoPenalty}`,
    `- Rolling two-hour continuity: ${reconciliation.summary.rollingContinuity}`,
    `- Rolling callbacks found: ${reconciliation.summary.rollingCallbacks}`,
    `- AM→PM continuity: ${reconciliation.summary.amPm}`,
    '',
    '## v0.1 Blockers',
    '',
    ...(reconciliation.blockers.length
      ? reconciliation.blockers.map((item) => `- ${item}`)
      : ['- none']),
    '',
    '## Product Quality Gaps For Human Review',
    '',
    ...(reconciliation.qualityGaps.length
      ? reconciliation.qualityGaps.map((item) => `- ${item.category} (${item.count}): ${item.meaning}`)
      : ['- none']),
    '',
    '## Conversation Comparison',
    '',
    '| Conversation | Participants | Soul | Recent | Classification | Top reasons |',
    '|---|---|---:|---:|---|---|',
    ...reconciliation.comparisons.map((item) =>
      [
        item.conversation,
        item.participants,
        `${item.soulStatus} ${formatScore(item.soulScore)}`,
        `${item.recentStatus} ${formatScore(item.recentScore)}`,
        item.classification,
        item.reasons.slice(0, 3).join('<br>') || 'none',
      ]
        .map(escapeTableCell)
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |'),
    ),
    '',
    '## Recommendation',
    '',
    '- Do not rewrite broad prompts from this report alone.',
    '- Let Alan read/playtest the latest transcripts and mark which gaps actually hurt the feeling of a living world.',
    '- If Alan agrees the object-loop or mirror-response issue hurts the experience, fix that as a small hygiene pass, then rerun observe.',
    '- If Alan feels the samples are already alive enough, keep observing and move the v0.1 work toward playtest UX instead of dialogue tuning.',
    '',
  ];
  await writeFile(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function parseSoulRows(report) {
  const lines = report.split('\n');
  const header = lines.find((line) => line.startsWith('| Conversation |'));
  const headerCells = splitRow(header ?? '');
  const indexOf = (name) => headerCells.indexOf(name);
  return lines
    .filter((line) => line.startsWith('conversation-'))
    .map((line) => {
      const cells = splitRow(line);
      return {
        conversation: cell(cells, indexOf('Conversation')),
        participants: cell(cells, indexOf('Participants')),
        messages: number(cell(cells, indexOf('Messages'))),
        status: cell(cells, indexOf('Status')),
        score: number(cell(cells, indexOf('Score'))),
      };
    });
}

function parseRecentRows(report) {
  const section = report.match(/## Post-Fix Results\n\n([\s\S]*?)(?:\n\n## |$)/)?.[1] ?? '';
  return section
    .split('\n')
    .filter((line) => line.startsWith('| conversation-'))
    .map((line) => {
      const cells = splitRow(line);
      return {
        conversation: cells[0],
        participants: cells[1],
        cohort: cells[2],
        status: cells[3],
        score: number(cells[4]),
        failureCategory: cells[5],
        topReasons: cells[6]?.split(/<br>/).map((value) => value.trim()).filter(Boolean) ?? [],
      };
    });
}

function parseRecentExamples(report) {
  const examples = new Map();
  const blocks = report.split(/\n### /).slice(1);
  for (const block of blocks) {
    const id = block.match(/^(conversation-[^\s]+)/)?.[1];
    if (!id) continue;
    const reasonBlock = block.match(/Reasons:\n([\s\S]*?)(?:\n\nExcerpt:|\n\n### |\n\n## |$)/)?.[1] ?? '';
    const reasons = reasonBlock
      .split('\n')
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter(Boolean);
    if (reasons.length) examples.set(id, reasons);
  }
  return examples;
}

function parseRecentSummary(report) {
  const match = report.match(/Post-fix summary:\s*(\d+)\s+PASS\s*\/\s*(\d+)\s+WARN\s*\/\s*(\d+)\s+FAIL/i);
  if (!match) return { PASS: 0, WARN: 0, FAIL: 0 };
  return { PASS: Number(match[1]), WARN: Number(match[2]), FAIL: Number(match[3]) };
}

function statusCounts(rows) {
  const counts = { PASS: 0, WARN: 0, FAIL: 0 };
  for (const row of rows) {
    if (row.status in counts) counts[row.status] += 1;
  }
  return counts;
}

function splitRow(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cellValue) => cellValue.trim());
}

function cell(cells, index) {
  return index >= 0 ? (cells[index] ?? '') : '';
}

function number(value) {
  const parsed = Number(String(value ?? '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function bullet(report, label) {
  return report?.match(new RegExp(`^- ${escapeRegExp(label)}:\\s*(.+)$`, 'mi'))?.[1]?.trim();
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

function field(section, key) {
  return section[normalizeKey(key)] ?? section[key];
}

function normalizeKey(key) {
  return key.trim().replaceAll(' ', '_');
}

function parseStatusDecision(value) {
  const match = value?.match(/^([^/]+)\/\s*(.+)$/);
  return {
    status: match?.[1]?.trim(),
    decision: match?.[2]?.trim(),
  };
}

function numberBullet(report, label) {
  return number(bullet(report, label)) ?? 0;
}

function formatScore(score) {
  return typeof score === 'number' ? `(${score.toFixed(2)})` : '';
}

function escapeTableCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function relative(path) {
  return path.replace(`${REPO_ROOT}/`, '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(argv) {
  const map = new Map();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, value = 'true'] = arg.slice(2).split('=');
    map.set(key, value);
  }
  return map;
}

function runSelfTest() {
  const soul = [
    '| Conversation | Participants | Messages | Status | Score | Echo penalty |',
    '|---|---|---:|---|---:|---:|',
    'conversation-c:1 | 海 / 真晝 | 3 | PASS | 1.00 | 0.00',
    '',
  ].join('\n');
  const recent = [
    'Post-fix summary: 0 PASS / 1 WARN / 0 FAIL',
    '',
    '### conversation-c:1 - WARN (0.88)',
    '',
    'Reasons:',
    '- characterVoiceScore: matched 2/16 character voice cue(s)',
    '',
    '## Post-Fix Results',
    '',
    '| Conversation | Participants | Cohort | Status | Score | Failure category | Top reasons |',
    '|---|---|---|---:|---:|---|---|',
    '| conversation-c:1 | 海 / 真晝 | post_fix | WARN | 0.88 | not responding | characterVoiceScore: matched 2/16 character voice cue(s) |',
    '',
  ].join('\n');
  const approach = [
    '- Fresh triad samples: 3',
    '- Runtime health: ok',
    '- Model policy env: ok',
    '- Active fallback pollution count: 0',
    '- Fresh fallback markers: 0',
    '- Stage-direction leak sum: 0.00',
    '- Echo penalty sum: 0.00',
    '- AM→PM continuity: PASS / continuity_observed',
  ].join('\n');
  const result = reconcileReports({ soulReport: soul, recentReport: recent, approachReport: approach });
  assertEqual(result.decision, 'HUMAN_REVIEW_READY', 'quality gap should route to human review');
  assertEqual(result.blockers.length, 0, 'no blocker expected');
  assertEqual(result.qualityGaps[0]?.category, 'voice_rubric_gap', 'voice gap expected');

  const weakApproach = approach.replace(
    '- AM→PM continuity: PASS / continuity_observed',
    '- AM→PM continuity: WARN / weak_continuity',
  );
  const weakResult = reconcileReports({ soulReport: soul, recentReport: recent, approachReport: weakApproach });
  assertEqual(weakResult.decision, 'BLOCKED', 'weak AM->PM continuity blocks v0.1 reconciliation');
  assertEqual(weakResult.blockers[0], 'AM->PM continuity is WARN / weak_continuity', 'AM->PM blocker expected');

  const samplePendingApproach = approach.replace(
    '- AM→PM continuity: PASS / continuity_observed',
    '- AM→PM continuity: WARN / sample_pending',
  );
  const samplePendingResult = reconcileReports({
    soulReport: soul,
    recentReport: recent,
    approachReport: samplePendingApproach,
  });
  assertEqual(
    samplePendingResult.nextAction,
    'legacy AM->PM is sample-pending; run rolling continuity before treating this as a blocker',
    'sample-pending AM->PM should wait for evidence instead of asking for a fix',
  );
  const rollingPassReport = `
# GIIS Underworld Rolling 2-Hour Continuity Report

## Summary

- Status: PASS
- Decision: continuity_observed
- Source sample count: 2
- Callback sample count: 2
- Source residue candidates: 4
- Rolling callbacks found: 1
`;
  const rollingPassResult = reconcileReports({
    soulReport: soul,
    recentReport: recent,
    approachReport: samplePendingApproach,
    rollingReport: rollingPassReport,
  });
  assertEqual(rollingPassResult.decision, 'HUMAN_REVIEW_READY', 'rolling pass should override legacy AM->PM sample pending');
  assertEqual(rollingPassResult.blockers.length, 0, 'rolling pass should clear continuity blocker');

  const rollingPendingResult = reconcileReports({
    soulReport: soul,
    recentReport: recent,
    approachReport: approach,
    rollingReport: rollingPassReport.replace('PASS', 'WARN').replace('continuity_observed', 'sample_pending'),
  });
  assertEqual(
    rollingPendingResult.nextAction,
    'wait for adjacent two-hour natural evidence; do not fix code for sample-pending rolling continuity',
    'rolling sample pending should wait for adjacent evidence',
  );

  const roleActionApproach = [
    '- Fresh triad samples: 4',
    '- Runtime health: ok',
    '- Model policy env: ok',
    '- Active fallback pollution count: 0',
    '- Fresh fallback markers: 0',
    '- Stage-direction leak sum: 0.00',
    '- Echo penalty sum: 0.00',
    '- Fresh-window life signals: WARN / pilot_role_action_collapse',
    '- AM→PM continuity: PASS / continuity_observed',
  ].join('\n');
  const roleActionResult = reconcileReports({
    soulReport: soul,
    recentReport: recent,
    approachReport: roleActionApproach,
  });
  assertEqual(roleActionResult.decision, 'BLOCKED', 'pilot role-action collapse blocks reconciliation');
  assertEqual(
    roleActionResult.blockers[0],
    'life signals are WARN / pilot_role_action_collapse',
    'pilot role-action blocker expected',
  );

  const softEchoApproach = [
    '- Fresh triad samples: 3',
    '- Top failure category: eval_rubric_disagreement',
    '- Runtime health: ok',
    '- Model policy env: ok',
    '- Active fallback pollution count: 0',
    '- Fresh fallback markers: 0',
    '- Stage-direction leak sum: 0.00',
    '- Echo penalty sum: 1.00',
    '- Fresh-window life signals: PASS / life_signal_observed',
    '- AM→PM continuity: PASS / continuity_observed',
  ].join('\n');
  const softEchoResult = reconcileReports({ soulReport: soul, recentReport: recent, approachReport: softEchoApproach });
  assertEqual(softEchoResult.decision, 'HUMAN_REVIEW_READY', 'soft echo disagreement should route to human review');
  assertEqual(softEchoResult.blockers.length, 0, 'soft echo should not block v0.1 reconciliation');
  console.log('[underworld-rubric-reconcile:self-test] PASS');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

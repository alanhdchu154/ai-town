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
  if (hasFallback) conversationCategory = 'fallback_contamination';
  else if (hasStageLeak) conversationCategory = 'stage_direction_leak';
  else if (hasWrongAddressee) conversationCategory = 'wrong_addressee';
  else if (hasEcho) conversationCategory = 'echo_repetition';
  else if (hasVoiceOrSoulGap) conversationCategory = 'soul_quality_gap';

  const reportCategoryHasPriority = PROPOSAL_ONLY.has(reportTopCategory) || OBSERVE_ONLY.has(reportTopCategory);
  const category =
    requestedCategory ??
    (reportCategoryHasPriority
      ? reportTopCategory
      : postFixChecked > 0 && conversationCategory !== 'none'
        ? conversationCategory
        : reportTopCategory || 'unknown');
  const confidence =
    postFixChecked >= 3 || freshTriadSamples >= 3
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
  if (diagnosis.confidence === 'sample_pending') {
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
  if (diagnosis.confidence === 'sample_pending') blockers.push('sample_pending');
  if (
    diagnosis.confidence === 'low_sample_warning' &&
    !PROPOSAL_ONLY.has(diagnosis.category)
  ) {
    blockers.push('fresh_samples_below_3');
  }
  if (diagnosis.operationalIssue !== 'none') blockers.push(diagnosis.operationalIssue);
  if (
    diagnosis.reportTopCategory &&
    diagnosis.category &&
    diagnosis.reportTopCategory !== diagnosis.category &&
    diagnosis.operationalIssue !== 'none'
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

function extractTopFailureCategory(report) {
  return report.match(/^- Top failure category:\s*(.+)$/m)?.[1]?.trim() ?? 'unknown';
}

function extractEvidence(report) {
  const weakest = report.match(/## Weakest Recent Failure\n\n([\s\S]*?)\n\n## /)?.[1]?.trim();
  const summary = report.match(/## Summary\n\n([\s\S]*?)\n\n## /)?.[1]?.trim();
  return [summary, weakest].filter(Boolean).join('\n\n');
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

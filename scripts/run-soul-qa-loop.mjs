#!/usr/bin/env node
// Semi-autonomous GIIS Underworld soul QA loop.
//
// Safe defaults:
// - Runs one loop unless --loop is passed.
// - Collects samples through the existing scoped triad single-sample runner.
// - Prints transcripts every loop.
// - Writes a report, but does not edit runtime code.
// - Large changes must be captured as proposals under umi/proposals/.

import { execFile, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'soul-loop-latest.md');
const PROPOSAL_DIR = join(REPO_ROOT, 'umi', 'proposals');
const GOLDEN_DIR = join(REPO_ROOT, 'evals', 'conversations', 'golden');
const TRIAD_NAMES = new Set(['海', '真晝', '明日奈', 'Umi', 'Mahiru', 'Asuna']);

const args = new Map(
  process.argv
    .slice(2)
    .filter((value) => value.startsWith('--'))
    .map((value) => {
      const equals = value.indexOf('=');
      if (equals === -1) return [value.slice(2), 'true'];
      return [value.slice(2, equals), value.slice(equals + 1)];
    }),
);

const LOOP = args.get('loop') === 'true';
const SKIP_COLLECTION = args.get('skip-collection') === 'true';
const INTERVAL_MS = Number(args.get('interval-ms') ?? 30 * 60 * 1000);
const TARGET_SAMPLES = Number(args.get('target-samples') ?? 3);
const SAMPLE_TIMEOUT_MS = Number(args.get('sample-timeout-ms') ?? 240_000);
const SAMPLE_POLL_MS = Number(args.get('sample-poll-ms') ?? 7_000);

// Rotate the collected dyad across samples so every triad pair is exercised and
// Mahiru is not starved by the Umi<->Asuna mutual-first-choice attractor.
// Mahiru appears in 2 of every 3 samples. Disable with --no-focus-rotation.
const FOCUS_ROTATION = ['Umi:Mahiru', 'Mahiru:Asuna', 'Umi:Asuna'];
const FOCUS_ROTATION_ENABLED = args.get('no-focus-rotation') !== 'true';

async function main() {
  do {
    await runOneLoop();
    if (!LOOP) break;
    console.log(`[soul-qa] sleeping ${Math.round(INTERVAL_MS / 60000)} minutes before next loop`);
    await sleep(INTERVAL_MS);
  } while (true);
}

async function runOneLoop() {
  const loopStartedAt = Date.now();
  const loopIso = new Date(loopStartedAt).toISOString();
  console.log(`\n[soul-qa] loop started ${loopIso}`);
  console.log('[soul-qa] policy: no fine-tuning; harness/world evaluation first');

  const collectionResults = [];
  if (SKIP_COLLECTION) {
    console.log('[soul-qa] sample collection skipped by flag');
  } else {
    for (let index = 0; index < TARGET_SAMPLES; index += 1) {
      const focusPair = FOCUS_ROTATION_ENABLED
        ? FOCUS_ROTATION[index % FOCUS_ROTATION.length]
        : undefined;
      console.log(
        `[soul-qa] collecting sample ${index + 1}/${TARGET_SAMPLES}` +
          `${focusPair ? ` (focus=${focusPair})` : ''}`,
      );
      const result = await runSampleCollection(focusPair);
      collectionResults.push(result);
      if (!result.ok && result.providerUnavailable) {
        console.log('[soul-qa] provider unavailable; stopping collection until next loop');
        break;
      }
    }
  }

  const freshConversations = await fetchFreshTriadConversations(loopStartedAt);
  printTranscripts(freshConversations);

  const soulEval = await runCommand('npm', ['run', 'eval:soul-triad', '--', `--since-created-at=${loopStartedAt}`], {
    timeout: 90_000,
  });
  const recentEval = await runCommand('npm', ['run', 'eval:conversation:recent', '--', '--since-last-change'], {
    timeout: 90_000,
  });
  const latestSoulReport = await readOptional(join(REPO_ROOT, 'evals', 'conversations', 'reports', 'soul-triad-latest.md'));
  const summary = summarizeSoulEval(latestSoulReport, freshConversations.length);
  const failureCategory = topFailureCategory(latestSoulReport, collectionResults);
  const providerUnavailable = collectionResults.some((result) => result.providerUnavailable);
  const enoughNewData = freshConversations.length >= 3;

  if (!enoughNewData) {
    console.log('[soul-qa] sample pending: fresh sample count < 3; no code changes allowed');
  }

  const proposalPath =
    enoughNewData && requiresProposal(failureCategory)
      ? await writeProposal(loopStartedAt, failureCategory, freshConversations, latestSoulReport)
      : undefined;

  const goldenPath = await maybeArchiveGolden(loopStartedAt, latestSoulReport, freshConversations);

  await writeLatestReport({
    loopIso,
    freshConversations,
    collectionResults,
    soulEval,
    recentEval,
    summary,
    failureCategory,
    enoughNewData,
    providerUnavailable,
    proposalPath,
    goldenPath,
    latestSoulReport,
  });

  console.log(`[soul-qa] report written: ${relative(REPORT_PATH)}`);
  if (proposalPath) console.log(`[soul-qa] proposal written: ${relative(proposalPath)}`);
  if (goldenPath) console.log(`[soul-qa] golden archived: ${relative(goldenPath)}`);
}

async function runSampleCollection(focusPair) {
  const result = await runCommand(
    'npm',
    [
      'run',
      'pilot:soul-triad:single-sample',
      '--',
      `--timeout-ms=${SAMPLE_TIMEOUT_MS}`,
      `--poll-interval-ms=${SAMPLE_POLL_MS}`,
      ...(focusPair ? [`--focus-pair=${focusPair}`] : []),
    ],
    { timeout: SAMPLE_TIMEOUT_MS + 90_000 },
  );
  const combined = `${result.stdout}\n${result.stderr}`;
  return {
    ok: result.code === 0,
    code: result.code,
    providerUnavailable: providerUnavailableFromOutput(result.code, combined),
    sampleId: combined.match(/fresh archived sample\s+(\S+)/)?.[1],
    outputPreview: combined.slice(-2000),
  };
}

function providerUnavailableFromOutput(code, output) {
  if (/429|model_not_found|quota|provider_unavailable|LLM unavailable|call timed out|request timed out/i.test(output)) {
    return true;
  }
  return code !== 0 && /timed out after|timeout waiting|no fresh archived/i.test(output);
}

async function fetchFreshTriadConversations(sinceCreatedAt) {
  const data = await convexRun('school:recentConversationEvalData', {
    limit: 24,
    compact: true,
    messagesPerConversation: 12,
    sinceCreatedAt,
  });
  const conversations = Array.isArray(data?.conversations) ? data.conversations : [];
  return conversations.filter((conversation) => isTriadConversation(conversation));
}

async function convexRun(functionName, payload) {
  const result = await runCommand(
    'npx',
    [
      'convex',
      'run',
      '--typecheck',
      'disable',
      '--codegen',
      'disable',
      functionName,
      JSON.stringify(payload),
    ],
    { timeout: 60_000 },
  );
  if (result.code !== 0) throw new Error(result.stderr || result.stdout || `${functionName} failed`);
  return parseJsonFromStdout(result.stdout);
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
      // keep scanning
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

function isTriadConversation(conversation) {
  const participants = conversation?.involvedCharacters ?? [];
  return participants.filter((name) => TRIAD_NAMES.has(name)).length >= 2;
}

function printTranscripts(conversations) {
  console.log('\n[soul-qa] transcripts');
  if (!conversations.length) {
    console.log('(no fresh triad transcripts)');
    return;
  }
  for (const conversation of conversations) {
    console.log(`\n--- ${conversation.id} ${conversation.involvedCharacters?.join(' / ') ?? ''} ---`);
    for (const message of conversation.transcriptMessages ?? []) {
      console.log(`${message.author}: ${message.text}`);
    }
  }
}

function summarizeSoulEval(report, sampleCount) {
  const statusCounts = { PASS: 0, WARN: 0, FAIL: 0 };
  for (const match of report.matchAll(/\|\s*conversation-[^|]+\|\s*[^|]+\|\s*\d+\s*\|\s*(PASS|WARN|FAIL)\s*\|/g)) {
    statusCounts[match[1]] += 1;
  }
  return { sampleCount, statusCounts };
}

function topFailureCategory(report, collectionResults) {
  if (collectionResults.some((result) => result.providerUnavailable)) return 'provider_unavailable';
  if (/Template penalty \| Echo penalty/.test(report) && /\|\s*0\.\d+\s*\|\s*1\.00\s*$/m.test(report)) {
    return 'echo_repetition';
  }
  if (/Template penalty/.test(report) && /\|\s*0\.[3-9]\d?\s*\|\s*(?:0\.|1\.00)/.test(report)) {
    return 'banned_phrase_or_stage_leak';
  }
  if (/System penalty/.test(report) && /心理機制|情緒層|角色設定|系統|模型/.test(report)) {
    return 'over_explanation';
  }
  if (/No Umi\/Mahiru\/Asuna triad samples found|sample pending/i.test(report)) return 'sample_pending';
  return 'needs_more_evidence';
}

function requiresProposal(category) {
  return [
    'over_explanation',
    'needs_more_evidence',
    'relationship_drift',
    'behavioral_drift',
    'memory_system',
  ].includes(category);
}

async function writeProposal(loopStartedAt, category, conversations, report) {
  await mkdir(PROPOSAL_DIR, { recursive: true });
  const path = join(PROPOSAL_DIR, `${timestampSlug(loopStartedAt)}-soul-loop-proposal.md`);
  const lines = [
    '# Soul Loop Proposal',
    '',
    `Created: ${new Date(loopStartedAt).toISOString()}`,
    '',
    '## Problem',
    '',
    `Top category: ${category}`,
    '',
    '## Evidence',
    '',
    ...conversations.flatMap((conversation) => [
      `### ${conversation.id}`,
      '',
      ...(conversation.transcriptMessages ?? []).map((message) => `- **${message.author}**: ${message.text}`),
      '',
    ]),
    '## Proposed Fix',
    '',
    'Proposal only. Do not auto-apply large changes from the QA loop.',
    '',
    '## Expected Impact',
    '',
    'Improve harness/world evaluation without teaching fixed answers too early.',
    '',
    '## Risks',
    '',
    '- Overfitting to one sample.',
    '- Increasing prompt pressure instead of measuring the world.',
    '- Accidentally adding high-frequency writes.',
    '',
    '## Files Affected',
    '',
    '- TBD after human review.',
    '',
    '## Why Not Smaller Fix',
    '',
    'No safe small auto-fix was identified from this loop category.',
    '',
    '## Eval Excerpt',
    '',
    '```md',
    report.slice(0, 3000),
    '```',
    '',
  ];
  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  return path;
}

async function maybeArchiveGolden(loopStartedAt, report, conversations) {
  if (!/\|\s*PASS\s*\|/.test(report)) return undefined;
  const best = conversations.find((conversation) => (conversation.transcriptMessages?.length ?? 0) >= 4);
  if (!best) return undefined;
  await mkdir(GOLDEN_DIR, { recursive: true });
  const path = join(GOLDEN_DIR, `${timestampSlug(loopStartedAt)}-${best.id.replace(/[^a-zA-Z0-9_-]/g, '-')}.md`);
  const lines = [
    '# Golden Conversation Candidate',
    '',
    `Created: ${new Date(loopStartedAt).toISOString()}`,
    `Conversation: ${best.id}`,
    `Participants: ${(best.involvedCharacters ?? []).join(' / ')}`,
    '',
    '## Transcript',
    '',
    ...(best.transcriptMessages ?? []).map((message) => `- **${message.author}**: ${message.text}`),
    '',
    '## Why It Worked',
    '',
    'Auto-archived as a candidate because the harness reported PASS. Human review still required.',
    '',
    '## Soul Layers Appeared',
    '',
    '- To be annotated by Umi/Codex or Alan.',
    '',
    '## Character Change / Reveal',
    '',
    '- To be annotated after review.',
    '',
  ];
  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  return path;
}

async function writeLatestReport({
  loopIso,
  freshConversations,
  collectionResults,
  soulEval,
  recentEval,
  summary,
  failureCategory,
  enoughNewData,
  providerUnavailable,
  proposalPath,
  goldenPath,
  latestSoulReport,
}) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# Underworld Soul QA Loop Latest',
    '',
    `Loop: ${loopIso}`,
    '',
    '## Summary',
    '',
    `- Samples checked: ${freshConversations.length}`,
    `- PASS/WARN/FAIL: ${summary.statusCounts.PASS}/${summary.statusCounts.WARN}/${summary.statusCounts.FAIL}`,
    `- Top failure category: ${failureCategory}`,
    `- Enough new data: ${enoughNewData ? 'yes' : 'no'}`,
    `- Provider unavailable: ${providerUnavailable ? 'yes' : 'no'}`,
    `- Code changed by loop: no`,
    proposalPath ? `- Proposal: ${relative(proposalPath)}` : '- Proposal: none',
    goldenPath ? `- Golden candidate: ${relative(goldenPath)}` : '- Golden candidate: none',
    '',
    '## Transcript',
    '',
    ...freshConversations.flatMap((conversation) => [
      `### ${conversation.id}`,
      '',
      `Participants: ${(conversation.involvedCharacters ?? []).join(' / ')}`,
      '',
      ...(conversation.transcriptMessages ?? []).map((message) => `- **${message.author}**: ${message.text}`),
      '',
    ]),
    freshConversations.length ? '' : 'No fresh triad transcript in this loop.',
    '',
    '## Collection Results',
    '',
    ...collectionResults.map((result, index) => (
      `- Attempt ${index + 1}: code=${result.code} ok=${result.ok ? 'yes' : 'no'} provider_unavailable=${result.providerUnavailable ? 'yes' : 'no'} sample=${result.sampleId ?? 'none'}`
    )),
    collectionResults.length ? '' : '- Collection skipped.',
    '',
    '## Eval Commands',
    '',
    `- npm run eval:soul-triad: exit ${soulEval.code}`,
    `- npm run eval:conversation:recent -- --since-last-change: exit ${recentEval.code}`,
    '',
    '## Soul Eval Report',
    '',
    latestSoulReport || '(no soul eval report)',
    '',
  ];
  await writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

async function runCommand(command, commandArgs, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timeout = options.timeout
      ? setTimeout(() => {
          child.kill('SIGTERM');
        }, options.timeout)
      : undefined;
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on('close', (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on('error', (error) => {
      if (timeout) clearTimeout(timeout);
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` });
    });
  });
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function timestampSlug(timestamp) {
  return new Date(timestamp).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(`[soul-qa] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = 1;
});

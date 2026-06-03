#!/usr/bin/env node
// Sequential disposable sampler for the v0.1 core trio.
//
// This wraps the lower-level free-world disposable probe and runs the core
// soul pairs one by one. It is intended for daytime sampling only; it does not
// run pairs in parallel and the child probe cleans generated archive/memory
// records unless --keep=true is passed.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'core-trio-disposable-suite-latest.md');

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

const DEFAULT_PAIRS = ['Umi:Mahiru', 'Mahiru:Tianze', 'Umi:Tianze'];
const PAIRS = (args.get('pairs') ?? DEFAULT_PAIRS.join(','))
  .split(',')
  .map((pair) => pair.trim())
  .filter(Boolean);
const TIMEOUT_MS = Number(args.get('timeout-ms') ?? 180_000);
const KEEP = args.get('keep') === 'true';
const DRY_RUN = args.get('dry-run') === 'true';
const SELF_TEST = args.get('self-test') === 'true';
const FORCE_NIGHT = args.get('force-night') === 'true';
const TIME_ZONE = args.get('time-zone') ?? 'America/Chicago';

function nowLabel() {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: TIME_ZONE,
  }).format(new Date());
}

function currentHour() {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: TIME_ZONE,
    }).format(new Date()),
  );
}

function isNightQuiet() {
  const hour = currentHour();
  return hour >= 22 || hour < 6;
}

function statusFromOutput(code, output) {
  if (/fresh sample conversation-c:\d+/i.test(output)) return 'sample_collected';
  if (/sample_pending/i.test(output)) return 'sample_pending';
  if (code === 0) return 'completed_no_sample_marker';
  return 'failed';
}

function extractFirstMatch(output, pattern) {
  return output.match(pattern)?.[1]?.trim() ?? '';
}

function trimExcerpt(text, maxLength = 1400) {
  const clean = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .join('\n');
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength)}\n...`;
}

function extractEvalBlock(output, labelPattern) {
  const marker = output.match(labelPattern);
  if (!marker?.index && marker?.index !== 0) return '';
  const start = marker.index;
  const tail = output.slice(start);
  const nextCleanup = tail.search(/\n\[free-world-routing\] cleanup/i);
  const nextNpm = tail.slice(1).search(/\n> ai-town@/);
  const candidates = [nextCleanup, nextNpm >= 0 ? nextNpm + 1 : -1].filter((index) => index > 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : tail.length;
  return trimExcerpt(tail.slice(0, end));
}

function evalExitCode(output, label) {
  const match = output.match(new RegExp(`\\[free-world-routing\\] ${label}ExitCode=(\\d+)`));
  return match?.[1] ?? 'not_run';
}

function recentEvalSummary(output) {
  return extractFirstMatch(output, /Post-fix summary: ([^\n]+)/i) || 'not_available';
}

function soulTriadSummary(output) {
  const rows = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(PASS|WARN|FAIL)\s+\d+\.\d+\s+conversation-c:\d+/i.test(line));
  return rows.length ? rows.join(' | ') : 'not_available';
}

function resultFromOutput(pair, code, output) {
  const recentEvalExitCode = evalExitCode(output, 'recentEval');
  const soulTriadEvalExitCode = evalExitCode(output, 'soulTriadEval');
  let status = statusFromOutput(code, output);
  if (
    status === 'sample_collected' &&
    (recentEvalExitCode !== '0' || soulTriadEvalExitCode !== '0')
  ) {
    status = 'eval_failed';
  }
  return {
    pair,
    code,
    status,
    sampleId: extractFirstMatch(output, /fresh sample (conversation-c:\d+)/i),
    transcript: extractFirstMatch(
      output,
      /transcript: ([\s\S]*?)(?:\n\[free-world-routing\] memoryTraces=|\n> ai-town@|\n$)/i,
    ),
    memoryTraces: extractFirstMatch(output, /memoryTraces=(\d+)/i),
    recentEvalExitCode,
    soulTriadEvalExitCode,
    recentEvalSummary: recentEvalSummary(output),
    soulTriadSummary: soulTriadSummary(output),
    recentEvalExcerpt: extractEvalBlock(output, /GIIS Recent Conversation Eval|Conversation eval summary/i),
    soulTriadEvalExcerpt: extractEvalBlock(output, /GIIS Soul Triad Eval/i),
    outputExcerpt: trimExcerpt(output),
  };
}

async function runPair(pair) {
  const childArgs = [
    'run',
    'pilot:free-world-routing:disposable',
    '--',
    `--focus-pair=${pair}`,
    `--timeout-ms=${TIMEOUT_MS}`,
    `--keep=${KEEP ? 'true' : 'false'}`,
  ];
  try {
    const result = await execFileAsync('npm', childArgs, {
      cwd: REPO_ROOT,
      env: process.env,
      timeout: TIMEOUT_MS + 180_000,
      maxBuffer: 1024 * 1024 * 30,
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    return resultFromOutput(pair, 0, output);
  } catch (error) {
    const code = typeof error.code === 'number' ? error.code : 1;
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`;
    return resultFromOutput(pair, code, output);
  }
}

function renderReport(results) {
  const collected = results.filter((result) => result.status === 'sample_collected').length;
  const pending = results.filter((result) => result.status === 'sample_pending').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const evalFailed = results.filter((result) => result.status === 'eval_failed').length;
  const nightQuiet = results.every((result) => result.status === 'night_quiet');
  const nextAction =
    nightQuiet
      ? 'Night quiet is active; wait until 06:00 or pass --force-night=true for an explicit disposable override.'
      : evalFailed > 0
      ? 'Fix the eval command or harness before judging sample quality.'
      : collected >= 3
      ? 'Run soul-triad and recent-conversation evals, then decide whether a small hygiene fix is evidence-backed.'
      : 'Wait for daytime heartbeat and rerun the suite; do not tune prompts from insufficient samples.';

  const pairSections = results
    .map((result) => {
      const transcript = result.transcript
        ? `\nTranscript snippet:\n\n> ${result.transcript.replace(/\n/g, '\n> ')}\n`
        : '\nTranscript snippet: none captured.\n';
      const recentEvalExcerpt = result.recentEvalExcerpt
        ? `\nRecent eval excerpt:\n\n\`\`\`text\n${result.recentEvalExcerpt}\n\`\`\`\n`
        : '';
      const soulTriadEvalExcerpt = result.soulTriadEvalExcerpt
        ? `\nSoul-triad eval excerpt:\n\n\`\`\`text\n${result.soulTriadEvalExcerpt}\n\`\`\`\n`
        : '';
      return `## ${result.pair}

- status: ${result.status}
- exit_code: ${result.code}
- sample_id: ${result.sampleId || 'none'}
- memory_traces: ${result.memoryTraces || 'unknown'}
- recent_eval_exit_code: ${result.recentEvalExitCode || 'not_run'}
- soul_triad_eval_exit_code: ${result.soulTriadEvalExitCode || 'not_run'}
- recent_eval_summary: ${result.recentEvalSummary || 'not_available'}
- soul_triad_summary: ${result.soulTriadSummary || 'not_available'}
${transcript}${recentEvalExcerpt}${soulTriadEvalExcerpt}
`;
    })
    .join('\n');

  return `# Core Trio Disposable Suite

- generated_at: ${nowLabel()} ${TIME_ZONE}
- dry_run: ${DRY_RUN}
- force_night: ${FORCE_NIGHT}
- keep_samples: ${KEEP}
- timeout_ms_per_pair: ${TIMEOUT_MS}
- pairs: ${PAIRS.join(' | ')}

## Summary

- sample_collected: ${collected}
- sample_pending: ${pending}
- failed: ${failed}
- eval_failed: ${evalFailed}
- night_quiet: ${results.filter((result) => result.status === 'night_quiet').length}
- next_action: ${nextAction}

${pairSections}
## Notes

- This suite is sequential by design. Do not run multiple disposable samplers in parallel.
- Child probes restore Convex env and stop the world after each pair.
- By default generated conversations, memories, embeddings, and nearby conversation outcomes are cleaned.
`;
}

function assertEqual(actual, expected, label) {
  if (actual === expected) return;
  throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function runSelfTest() {
  const goodOutput = [
    '[free-world-routing] fresh sample conversation-c:12345: 海 / 真晝',
    '[free-world-routing] transcript: 海: 今天先少說一點 / 真晝: 好。那我不催你',
    '[free-world-routing] memoryTraces=2',
    'GIIS Recent Conversation Eval --since-created-at',
    'Post-fix summary: 0 PASS / 1 WARN / 0 FAIL',
    '[free-world-routing] recentEvalExitCode=0',
    'Soul Triad Conversation Harness',
    'WARN 0.94 conversation-c:12345 messages=2 participants=海/真晝',
    '[free-world-routing] soulTriadEvalExitCode=0',
  ].join('\n');
  const good = resultFromOutput('Umi:Mahiru', 0, goodOutput);
  assertEqual(good.status, 'sample_collected', 'good status');
  assertEqual(good.sampleId, 'conversation-c:12345', 'good sampleId');
  assertEqual(good.memoryTraces, '2', 'good memoryTraces');
  assertEqual(good.recentEvalExitCode, '0', 'good recentEvalExitCode');
  assertEqual(good.soulTriadEvalExitCode, '0', 'good soulTriadEvalExitCode');
  assertEqual(good.recentEvalSummary, '0 PASS / 1 WARN / 0 FAIL', 'good recentEvalSummary');
  assertEqual(
    good.soulTriadSummary,
    'WARN 0.94 conversation-c:12345 messages=2 participants=海/真晝',
    'good soulTriadSummary',
  );

  const evalFailedOutput = goodOutput.replace(
    '[free-world-routing] soulTriadEvalExitCode=0',
    '[free-world-routing] soulTriadEvalExitCode=1',
  );
  const evalFailed = resultFromOutput('Umi:Mahiru', 0, evalFailedOutput);
  assertEqual(evalFailed.status, 'eval_failed', 'eval failed status');

  const pending = resultFromOutput(
    'Umi:Mahiru',
    2,
    '[free-world-routing] sample_pending: no fresh archived sample was collected.',
  );
  assertEqual(pending.status, 'sample_pending', 'pending status');

  const report = renderReport([good, evalFailed, pending]);
  if (!report.includes('eval_failed: 1')) {
    throw new Error('self-test report did not include eval_failed count');
  }
  console.log('[core-trio-suite] self-test PASS');
}

async function main() {
  if (SELF_TEST) {
    runSelfTest();
    return;
  }

  if (PAIRS.length === 0) {
    console.error('[core-trio-suite] no pairs configured');
    process.exitCode = 1;
    return;
  }

  await mkdir(dirname(REPORT_PATH), { recursive: true });

  let results;
  if (!DRY_RUN && !FORCE_NIGHT && isNightQuiet()) {
    results = PAIRS.map((pair) => ({
      pair,
      code: 0,
      status: 'night_quiet',
      sampleId: '',
      transcript: '',
      memoryTraces: '',
      recentEvalExitCode: 'not_run',
      soulTriadEvalExitCode: 'not_run',
      recentEvalSummary: 'not_available',
      soulTriadSummary: 'not_available',
      recentEvalExcerpt: '',
      soulTriadEvalExcerpt: '',
      outputExcerpt: '',
    }));
    console.log('[core-trio-suite] night quiet active; no conversations generated.');
  } else if (DRY_RUN) {
    results = PAIRS.map((pair) => ({
      pair,
      code: 0,
      status: 'dry_run',
      sampleId: '',
      transcript: '',
      memoryTraces: '',
      recentEvalExitCode: 'not_run',
      soulTriadEvalExitCode: 'not_run',
      recentEvalSummary: 'not_available',
      soulTriadSummary: 'not_available',
      recentEvalExcerpt: '',
      soulTriadEvalExcerpt: '',
      outputExcerpt: '',
    }));
  } else {
    results = [];
    for (const pair of PAIRS) {
      console.log(`[core-trio-suite] running pair ${pair}`);
      results.push(await runPair(pair));
    }
  }

  const report = renderReport(results);
  await writeFile(REPORT_PATH, report, 'utf8');
  console.log(`[core-trio-suite] wrote ${REPORT_PATH}`);

  const fatal = results.some((result) => ['failed', 'eval_failed'].includes(result.status));
  process.exitCode = fatal ? 1 : 0;
}

main().catch((error) => {
  console.error(`[core-trio-suite] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = 1;
});

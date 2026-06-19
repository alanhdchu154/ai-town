#!/usr/bin/env node
// Run nightly reflection in shadow first, then write only if the shadow report
// is clean. This keeps the Codex automation write-capable without making it
// blind: a dirty shadow night stops before permanent reflection memories.

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const EXPORT_PATH = join(REPO_ROOT, 'umi', 'exports', 'nightly-reflection-latest', 'nightly-reflection.json');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'nightly-reflection-gated-write-latest.md');
const APPROVAL = 'alan-approved-nightly-reflection-2026-06-12';

const args = parseArgs(process.argv.slice(2));
if (args.flags.has('self-test')) {
  const fixture = {
    mode: 'shadow',
    todayKey: '2026-06-18',
    written: 0,
    characters: [{ name: 'Umi', rejectedInsights: [], wouldKeep: [{ insight: '我開始相信真晝願意等我慢慢說。' }] }],
  };
  const gate = shadowGate(fixture);
  if (!gate.clean) throw new Error(`self-test expected clean gate, got ${gate.reasons.join(', ')}`);
  const dirty = shadowGate({
    ...fixture,
    characters: [{ name: 'Umi', rejectedInsights: [{ insight: '紙船', reasons: ['concrete_prop'] }], wouldKeep: [] }],
  });
  if (dirty.clean) throw new Error('self-test expected dirty gate');
  console.log('[nightly-reflection-gated-write] self-test PASS');
  process.exit(0);
}

const shadow = await runNodeScript(['scripts/underworld-nightly-reflection.mjs']);
const shadowResult = readLatestReflectionExport();
const gate = shadowGate(shadowResult);

let writeOutput = '';
let writeResult = null;
if (gate.clean) {
  writeOutput = await runNodeScript([
    'scripts/underworld-nightly-reflection.mjs',
    '--write',
    `--approval=${APPROVAL}`,
  ]);
  writeResult = readLatestReflectionExport();
}

writeGateReport({ shadowResult, gate, shadowOutput: shadow, writeOutput, writeResult });

const status = gate.clean ? 'WROTE_OR_SKIPPED_ALREADY_REFLECTED' : 'SHADOW_NOT_CLEAN';
const written = writeResult?.written ?? 0;
console.log(`[nightly-reflection-gated-write] status=${status} written=${written}`);
console.log(`[nightly-reflection-gated-write] report=${relative(REPO_ROOT, REPORT_PATH)}`);

async function runNodeScript(scriptArgs) {
  const { stdout, stderr } = await execFileAsync('node', scriptArgs, {
    cwd: REPO_ROOT,
    timeout: 600_000,
    maxBuffer: 1024 * 1024 * 16,
  });
  return [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
}

function readLatestReflectionExport() {
  if (!existsSync(EXPORT_PATH)) {
    throw new Error(`nightly reflection export missing at ${relative(REPO_ROOT, EXPORT_PATH)}`);
  }
  return JSON.parse(readFileSync(EXPORT_PATH, 'utf8'));
}

function shadowGate(result) {
  const reasons = [];
  if (result?.mode !== 'shadow') reasons.push(`mode_not_shadow:${result?.mode ?? 'unknown'}`);
  if ((result?.written ?? 0) !== 0) reasons.push(`shadow_written_count:${result?.written}`);
  const rejectedCount = (result?.characters ?? []).reduce(
    (sum, character) => sum + (character.rejectedInsights?.length ?? 0),
    0,
  );
  if (rejectedCount > 0) reasons.push(`rejected_unsafe_insights:${rejectedCount}`);
  const suspicious = suspiciousWouldKeep(result);
  if (suspicious.length) reasons.push(`suspicious_would_keep:${suspicious.length}`);
  return {
    clean: reasons.length === 0,
    reasons,
    rejectedCount,
    suspicious,
  };
}

function suspiciousWouldKeep(result) {
  const pattern =
    /(紙船|抽屜|考卷|筆蓋|袖口|傳單|咖哩|便當|海報|鑰匙|衣櫃|宿舍|校長室|窗台|窗邊|地點|症狀|\bUmi\b|\bMahiru\b|\bMaomao\b|\bTianze\b|\bIchinose\b|\bSakiko\b|曹操|劉備|麻桜|麻櫻|明日奈|麻衣)/;
  const rows = [];
  for (const character of result?.characters ?? []) {
    for (const item of character.wouldKeep ?? []) {
      if (pattern.test(item.insight ?? '')) {
        rows.push({ name: character.name, insight: item.insight });
      }
    }
  }
  return rows;
}

function writeGateReport({ shadowResult, gate, shadowOutput, writeOutput, writeResult }) {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  const lines = [];
  lines.push('# Underworld Nightly Reflection Gated Write');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Local day: ${shadowResult?.todayKey ?? 'unknown'}`);
  lines.push(`Shadow clean: ${gate.clean ? 'yes' : 'no'}`);
  lines.push(`Gate reasons: ${gate.reasons.length ? gate.reasons.join(', ') : 'none'}`);
  lines.push(`Shadow rejected unsafe insights: ${gate.rejectedCount}`);
  lines.push(`Write attempted: ${gate.clean ? 'yes' : 'no'}`);
  lines.push(`Write result written: ${writeResult?.written ?? 0}`);
  lines.push('');
  if (gate.suspicious.length) {
    lines.push('## Suspicious wouldKeep Lines');
    lines.push('');
    for (const row of gate.suspicious) {
      lines.push(`- ${row.name}: ${row.insight}`);
    }
    lines.push('');
  }
  lines.push('## Shadow Output');
  lines.push('');
  lines.push('```text');
  lines.push(shadowOutput || '(no output)');
  lines.push('```');
  lines.push('');
  if (gate.clean) {
    lines.push('## Write Output');
    lines.push('');
    lines.push('```text');
    lines.push(writeOutput || '(no output)');
    lines.push('```');
    lines.push('');
  }
  lines.push('## Safety');
  lines.push('');
  lines.push('- Dirty shadow nights stop before write mode.');
  lines.push('- The underlying write path still requires the approval token.');
  lines.push('- Permanent reflection memories are still filtered by Convex-side insight safety.');
  lines.push('');
  writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
}

function parseArgs(argv) {
  const flags = new Set();
  for (const raw of argv) {
    if (raw.startsWith('--')) flags.add(raw.slice(2));
  }
  return { flags };
}

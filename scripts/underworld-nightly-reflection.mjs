#!/usr/bin/env node
// GIIS Underworld nightly reflection ("睡前回響") runner.
//
// Default is SHADOW: each pilot character reviews the day's memories and the
// LLM previews what it WOULD consolidate into long-term character memory —
// nothing is written. This lets Alan read the preview (and catch fabrications
// before they harden into traits) before the write path is ever enabled.
//
// With --write and the approval token it inserts the reflection memories,
// skipping any character who already reflected today (idempotent cron).
//
//   node scripts/underworld-nightly-reflection.mjs                 # shadow preview
//   node scripts/underworld-nightly-reflection.mjs --write \
//        --approval=alan-approved-nightly-reflection-2026-06-12

import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'nightly-reflection-latest.md');
const OUT_DIR = join(REPO_ROOT, 'umi', 'exports', 'nightly-reflection-latest');
const APPROVAL = 'alan-approved-nightly-reflection-2026-06-12';

const args = parseArgs(process.argv.slice(2));
const WRITE = args.flags.has('write');
const approval = args.values.get('approval') ?? '';
const thresholdArg = args.values.get('threshold');

if (WRITE && approval !== APPROVAL) {
  throw new Error(`--write requires --approval=${APPROVAL}`);
}

const worldStatus = await convexRun('world:defaultWorldStatus', {});
const worldId = worldStatus?.worldId;
if (!worldId) throw new Error('default worldId not found');

const payload = {
  worldId,
  mode: WRITE ? 'write' : 'shadow',
};
if (WRITE) payload.approval = approval;
if (thresholdArg !== undefined) payload.threshold = Number(thresholdArg);

const result = await convexRun('agent/memory:nightlyReflectionForWorld', payload);

writeOutputs(result);
console.log(
  `[nightly-reflection] mode=${result?.mode ?? (WRITE ? 'write' : 'shadow')} characters=${result?.characters?.length ?? 0} written=${result?.written ?? 0}`,
);
console.log(`[nightly-reflection] report=${relative(REPO_ROOT, REPORT_PATH)}`);

function writeOutputs(result) {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(join(OUT_DIR, 'nightly-reflection.json'), JSON.stringify(result ?? {}, null, 2));
  writeFileSync(REPORT_PATH, buildReport(result), 'utf8');
}

function buildReport(result) {
  const lines = [];
  lines.push('# Underworld Nightly Reflection (睡前回響)');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Mode: ${result?.mode ?? (WRITE ? 'write' : 'shadow')}`);
  lines.push(`Local day: ${result?.todayKey ?? 'unknown'}`);
  lines.push(`Threshold (new-memory importance sum to trigger): ${result?.threshold ?? '?'}`);
  lines.push(`Characters reflected/written: ${result?.written ?? 0}`);
  lines.push('');
  lines.push(
    'Shadow mode writes nothing. Read each character\'s "would keep" list and check it is NOT consolidating fabricated world facts (places, objects, who-said-what) into permanent traits. Only enable --write once the day\'s memories read clean.',
  );
  lines.push('');
  for (const ch of result?.characters ?? []) {
    lines.push(`## ${ch.name}`);
    lines.push('');
    lines.push(
      `- new memories since last reflection: ${ch.newSinceLastCount} (importance sum ${ch.sumImportance} vs threshold ${ch.threshold})`,
    );
    lines.push(`- would reflect tonight: ${ch.shouldReflect ? 'yes' : 'no'}`);
    if (ch.alreadyReflectedToday) lines.push('- already reflected today: yes (write would skip)');
    if (ch.wrote) lines.push('- WROTE reflection memories this run');
    if (ch.wouldKeep?.length) {
      lines.push('- would keep:');
      for (const k of ch.wouldKeep) {
        lines.push(`  - (importance ${k.importance}, from ${k.relatedCount} memories) ${k.insight}`);
      }
    } else if (ch.shouldReflect) {
      lines.push('- would keep: (LLM returned no insights — likely provider unavailable or nothing worth promoting)');
    }
    lines.push('');
  }
  lines.push('## Safety');
  lines.push('');
  lines.push('- Shadow mode performs zero Convex writes.');
  lines.push('- Write mode requires the approval token and skips characters who already reflected today.');
  lines.push('- Reflection prompt forbids inventing world facts / who-said-what; only the character\'s own stance is promoted.');
  lines.push('- Existing memories and embeddings are never mutated; reflections are new `reflection`-type memories.');
  lines.push('');
  return lines.join('\n');
}

async function convexRun(functionName, payload) {
  const { stdout } = await execFileAsync(
    'npx',
    ['convex', 'run', '--typecheck', 'disable', '--codegen', 'disable', functionName, JSON.stringify(payload)],
    { cwd: REPO_ROOT, timeout: 300_000, maxBuffer: 1024 * 1024 * 16 },
  );
  const trimmed = stdout.trim();
  const starts = [trimmed.indexOf('{'), trimmed.indexOf('[')].filter((index) => index >= 0);
  const jsonStart = starts.length ? Math.min(...starts) : -1;
  if (jsonStart < 0) return null;
  return JSON.parse(trimmed.slice(jsonStart));
}

function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const body = raw.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) {
      flags.add(body);
      values.set(body, 'true');
    } else {
      values.set(body.slice(0, eq), body.slice(eq + 1));
    }
  }
  return { flags, values };
}

#!/usr/bin/env node
// Read-only scout for v0.2 emergent event consequences. It never enables the
// feature flag and never writes Convex state; it only previews the existing
// one-hop consequence candidates so Alan/Umi/cc can judge whether the next
// feature step is worth taking.

import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'emergent-events-scout-latest.md');

const args = parseArgs(process.argv.slice(2));
if (args.flags.has('self-test')) {
  const report = buildReport({
    generatedAt: '2026-06-18T00:00:00.000Z',
    result: {
      status: 'ok',
      enabled: false,
      checked: 1,
      results: [
        {
          eventId: 'ev:test',
          actorName: 'Umi',
          targetName: 'Mahiru',
          action: 'shift_relationship',
          consequenceKind: 'relationship_shift_candidate',
          status: 'dry_run',
          reason: 'sample',
        },
      ],
    },
  });
  if (!report.includes('Write attempted: no')) throw new Error('self-test report must be read-only');
  if (!report.includes('relationship_shift_candidate')) throw new Error('self-test report missing consequence kind');
  console.log('[emergent-events-scout] self-test PASS');
  process.exit(0);
}

const max = Number(args.values.get('max') ?? 5);
const result = await convexRun('school:applyEmergentEventCandidates', {
  write: false,
  max,
});

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, buildReport({ generatedAt: new Date().toISOString(), result }), 'utf8');
console.log(
  `[emergent-events-scout] status=${result?.status ?? 'unknown'} checked=${result?.checked ?? 0} candidates=${result?.results?.length ?? 0}`,
);
console.log(`[emergent-events-scout] report=${relative(REPO_ROOT, REPORT_PATH)}`);

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

function buildReport({ generatedAt, result }) {
  const lines = [];
  lines.push('# Underworld Emergent Events Scout');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Feature flag enabled: ${result?.enabled ? 'yes' : 'no'}`);
  lines.push('Write attempted: no');
  lines.push(`Status: ${result?.status ?? 'unknown'}`);
  lines.push(`Candidates checked: ${result?.checked ?? 0}`);
  lines.push('');
  lines.push('## Meaning');
  lines.push('');
  lines.push(
    'This is a dry-run preview of the existing one-hop emergent event consequence layer. It does not enable `UNDERWORLD_V02_EMERGENT_EVENTS`, write follow-up events, move characters, patch relationships, or mutate memory.',
  );
  lines.push('');
  lines.push('## Candidate Plans');
  lines.push('');
  const rows = result?.results ?? [];
  if (!rows.length) {
    lines.push('- No pending conversation-outcome candidates in the latest window.');
  } else {
    for (const row of rows) {
      lines.push(
        `- ${row.eventId}: ${row.actorName ?? 'unknown'} -> ${row.targetName ?? 'unknown'} | ${row.consequenceKind ?? 'none'} | ${row.action ?? 'no_action'} | ${row.status}${row.reason ? ` | ${row.reason}` : ''}`,
      );
    }
  }
  lines.push('');
  lines.push('## Guardrails');
  lines.push('');
  lines.push('- One-hop only: candidates with `chainDepth > 0` are not considered by the existing write path.');
  lines.push('- Dry-run only: this scout always calls `write:false`.');
  lines.push('- Proposal boundary: enabling writes or changing event semantics still requires Alan approval.');
  lines.push('');
  return lines.join('\n');
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
    } else {
      values.set(body.slice(0, eq), body.slice(eq + 1));
    }
  }
  return { flags, values };
}

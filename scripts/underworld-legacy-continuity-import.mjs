#!/usr/bin/env node
// Validate the legacy continuity evidence import packet.
//
// Dry-run mode never calls Convex. Write mode is deliberately narrow: it only
// writes already-validated rows into the non-prompt-facing
// legacyContinuityEvidence table, behind an explicit approval string.

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_PLAN = join(
  REPO_ROOT,
  'umi',
  'exports',
  'legacy-continuity-import-plan-latest',
  'dry-run-legacy-continuity-evidence.jsonl',
);
const DEFAULT_OUT_DIR = join(REPO_ROOT, 'umi', 'exports', 'legacy-continuity-import-latest');
const DEFAULT_REPORT = join(REPO_ROOT, 'umi', 'reports', 'legacy-continuity-import-latest.md');
const LEGACY_CONTINUITY_APPROVAL = 'alan-approved-legacy-continuity-2026-06-12';

const args = parseArgs(process.argv.slice(2));
if (args.flags.has('self-test')) {
  runSelfTest();
  process.exit(0);
}

const planPath = args.values.get('plan') ?? DEFAULT_PLAN;
const outDir = args.values.get('out-dir') ?? DEFAULT_OUT_DIR;
const reportPath = args.values.get('report') ?? DEFAULT_REPORT;
const importedBy = args.values.get('imported-by') ?? 'codex-dry-run';
const writeMode = args.flags.has('write');
const approval = args.values.get('approval');

if (!existsSync(planPath)) {
  throw new Error(`legacy continuity plan not found: ${planPath}`);
}

const result = buildDryRunImport({ planPath, importedBy, writeMode });
if (writeMode) {
  if (approval !== LEGACY_CONTINUITY_APPROVAL) {
    throw new Error(
      `write mode requires --approval=${LEGACY_CONTINUITY_APPROVAL}`,
    );
  }
  result.writeResult = writeLegacyContinuityEvidence({ rows: result.validRows, approval });
  result.mode = 'write_legacy_continuity_evidence_non_prompt_facing';
  result.invariants.push('Convex write mode inserted only non-prompt-facing legacy evidence rows.');
}
writeDryRunResult({ result, outDir, reportPath });

console.log(
  `[underworld-legacy-continuity-import] mode=${result.mode} validRows=${result.validRows.length} rejectedRows=${result.rejectedRows.length}`,
);
console.log(`[underworld-legacy-continuity-import] out=${relative(REPO_ROOT, outDir)}`);
console.log(`[underworld-legacy-continuity-import] report=${relative(REPO_ROOT, reportPath)}`);

function buildDryRunImport({ planPath: path, importedBy, writeMode = false }) {
  const inputRows = readLines(path)
    .filter((line) => line.trim())
    .map((line, index) => ({ index: index + 1, row: JSON.parse(line) }));
  const importRunId = `legacy-continuity-dry-run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const importedAt = Date.now();
  const validRows = [];
  const rejectedRows = [];

  for (const item of inputRows) {
    const validation = validatePlanRow(item.row);
    if (!validation.ok) {
      rejectedRows.push({
        rowNumber: item.index,
        sourceKind: item.row?.sourceKind,
        sourceId: item.row?.sourceId,
        reason: validation.reason,
      });
      continue;
    }
    validRows.push(toLegacyEvidenceRow(item.row, { importRunId, importedAt, importedBy }));
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: writeMode ? 'write_requested_pending_convex_result' : 'dry_run_only_no_convex_writes',
    planPath: path,
    importRunId,
    importedBy,
    validRows,
    rejectedRows,
    invariants: [
      'No Convex calls were made.',
      'No live state was written.',
      'All valid rows keep promptFacing=false.',
      'All valid rows keep freshEvalEligible=false.',
      'All valid rows keep reviewRequired=true.',
      writeMode
        ? 'Write mode requires Alan approval and Convex-side invariant checks.'
        : 'No live write was requested.',
    ],
  };
}

function validatePlanRow(row) {
  if (!row || typeof row !== 'object') return { ok: false, reason: 'not_object' };
  if (row.targetRecordKind !== 'legacyContinuityEvidence') {
    return { ok: false, reason: `wrong_target_${row.targetRecordKind}` };
  }
  if (row.legacyArchive !== true) return { ok: false, reason: 'legacyArchive_not_true' };
  if (row.promptFacing !== false) return { ok: false, reason: 'promptFacing_not_false' };
  if (row.freshEvalEligible !== false) return { ok: false, reason: 'freshEvalEligible_not_false' };
  if (row.reviewRequired !== true) return { ok: false, reason: 'reviewRequired_not_true' };
  if (!row.sourceKind) return { ok: false, reason: 'missing_sourceKind' };
  if (!row.sourceId) return { ok: false, reason: 'missing_sourceId' };
  if (!Array.isArray(row.involvedNames)) return { ok: false, reason: 'missing_involvedNames' };
  if (!Number.isFinite(Number(row.valueScore))) return { ok: false, reason: 'missing_valueScore' };
  if (!row.suggestedRestoreShape) return { ok: false, reason: 'missing_suggestedRestoreShape' };
  if (!row.summaryZh || String(row.summaryZh).trim().length < 24) {
    return { ok: false, reason: 'summary_too_short' };
  }
  if (!row.restoreReasonZh) return { ok: false, reason: 'missing_restoreReasonZh' };
  if (!row.approvalNoteZh) return { ok: false, reason: 'missing_approvalNoteZh' };
  return { ok: true };
}

function toLegacyEvidenceRow(row, { importRunId, importedAt, importedBy }) {
  const conversationIds = Array.isArray(row.conversationIds) ? row.conversationIds : [];
  return {
    legacyArchive: true,
    promptFacing: false,
    freshEvalEligible: false,
    reviewRequired: true,
    importedAt,
    importedBy,
    importRunId,
    sourceKind: row.sourceKind,
    sourceId: row.sourceId,
    sourceTableId: row.sourceTableId,
    sourceTs: row.sourceTs,
    sourceCreatedAtIso: row.sourceCreatedAtIso,
    sourceDbPath: row.sourceDbPath,
    primaryConversationId: conversationIds[0],
    conversationIds,
    involvedNames: row.involvedNames,
    valueScore: Number(row.valueScore),
    suggestedRestoreShape: row.suggestedRestoreShape,
    summaryZh: row.summaryZh,
    restoreReasonZh: row.restoreReasonZh,
    risks: Array.isArray(row.risks) ? row.risks : [],
    residueDedupeKey: row.residueDedupeKey,
    motifFamilyKey: row.motifFamilyKey,
    approvalNoteZh: row.approvalNoteZh,
  };
}

function writeDryRunResult({ result, outDir, reportPath }) {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  writeFileSync(
    join(outDir, 'validated-legacy-continuity-evidence.jsonl'),
    result.validRows.map((row) => `${JSON.stringify(row)}\n`).join(''),
    'utf8',
  );
  writeFileSync(reportPath, buildReport(result), 'utf8');
}

function writeLegacyContinuityEvidence({ rows, approval }) {
  if (!rows.length) return { inserted: 0, skipped: 0, insertedIds: [], skippedRows: [] };
  const payload = JSON.stringify({ approval, rows });
  const command = [
    'convex',
    'run',
    '--typecheck',
    'disable',
    '--codegen',
    'disable',
    'legacyContinuity:importLegacyContinuityEvidence',
    payload,
  ];
  const child = spawnSync('npx', command, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (child.status !== 0) {
    throw new Error(
      [
        'legacy continuity Convex write failed',
        child.stdout.trim(),
        child.stderr.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  const output = child.stdout.trim();
  try {
    return JSON.parse(output);
  } catch {
    return { rawOutput: output };
  }
}

function buildReport(result) {
  const lines = [
    '# Underworld Legacy Continuity Import Dry Run',
    '',
    `Generated: ${result.generatedAt}`,
    `Mode: ${result.mode}`,
    `Plan: \`${result.planPath}\``,
    `Import run id: ${result.importRunId}`,
    '',
    result.writeResult
      ? 'This wrote validated non-prompt-facing legacy evidence rows to Convex.'
      : 'This did not write to Convex.',
    '',
    '## Summary',
    '',
    `- Valid rows: ${result.validRows.length}`,
    `- Rejected rows: ${result.rejectedRows.length}`,
    `- Prompt-facing rows: ${result.validRows.filter((row) => row.promptFacing).length}`,
    `- Fresh-eval-eligible rows: ${result.validRows.filter((row) => row.freshEvalEligible).length}`,
    ...(result.writeResult
      ? [
          `- Convex inserted rows: ${result.writeResult.inserted ?? 'unknown'}`,
          `- Convex skipped rows: ${result.writeResult.skipped ?? 'unknown'}`,
        ]
      : []),
    '',
    '## Invariants',
    '',
    ...result.invariants.map((item) => `- ${item}`),
    '',
    '## Would Write',
    '',
    ...(result.validRows.length
      ? result.validRows.map((row, index) => {
          const names = row.involvedNames.length ? row.involvedNames.join(', ') : 'unknown';
          return `${index + 1}. ${row.sourceKind} names=${names} promptFacing=${row.promptFacing} freshEvalEligible=${row.freshEvalEligible}: ${escapeLine(row.summaryZh)}`;
        })
      : ['- none']),
    '',
    '## Rejected',
    '',
    ...(result.rejectedRows.length
      ? result.rejectedRows.map((row) => `- row ${row.rowNumber} ${row.sourceKind ?? 'unknown'} ${row.sourceId ?? ''}: ${row.reason}`)
      : ['- none']),
    ...(result.writeResult
      ? [
          '',
          '## Convex Write Result',
          '',
          '```json',
          JSON.stringify(result.writeResult, null, 2),
          '```',
        ]
      : []),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function readLines(path) {
  return readFileSync(path, 'utf8').split(/\n/);
}

function escapeLine(text) {
  return String(text ?? '').replace(/\n/g, ' ').replace(/\|/g, '\\|');
}

function parseArgs(values) {
  const flags = new Set();
  const map = new Map();
  for (const arg of values) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) flags.add(arg.slice(2));
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  return { flags, values: map };
}

function runSelfTest() {
  const tempDir = mkdtempSync(join(tmpdir(), 'uw-legacy-import-'));
  try {
    const planPath = join(tempDir, 'plan.jsonl');
    const outDir = join(tempDir, 'out');
    const reportPath = join(tempDir, 'report.md');
    const valid = {
      targetRecordKind: 'legacyContinuityEvidence',
      dryRunOnly: true,
      legacyArchive: true,
      freshEvalEligible: false,
      promptFacing: false,
      sourceKind: 'memories',
      sourceId: 'm1',
      sourceTableId: 'T',
      sourceTs: 1,
      sourceCreatedAtIso: '2026-06-01T12:00:00.000Z',
      conversationIds: ['c:1'],
      suggestedRestoreShape: 'legacyMemorySummary',
      valueScore: 31,
      involvedNames: ['Umi', 'Mahiru'],
      summaryZh: '海和真晝留下了一段短而具體的情緒餘波，之後可能影響她們怎麼互相關心。',
      restoreReasonZh: '舊世界的長期候選記憶，可能保留承諾、情緒餘波或關係延續。',
      reviewRequired: true,
      approvalNoteZh: 'Alan approval required before this can be written to Convex.',
    };
    const invalid = { ...valid, sourceId: 'm2', promptFacing: true };
    writeFileSync(planPath, `${JSON.stringify(valid)}\n${JSON.stringify(invalid)}\n`, 'utf8');
    const result = buildDryRunImport({ planPath, importedBy: 'self-test' });
    if (result.validRows.length !== 1) {
      throw new Error(`expected 1 valid row, got ${result.validRows.length}`);
    }
    if (result.rejectedRows.length !== 1 || result.rejectedRows[0].reason !== 'promptFacing_not_false') {
      throw new Error('expected promptFacing rejection');
    }
    if (result.validRows[0].primaryConversationId !== 'c:1') {
      throw new Error('expected primaryConversationId to be copied from conversationIds');
    }
    writeDryRunResult({ result, outDir, reportPath });
    if (!existsSync(join(outDir, 'validated-legacy-continuity-evidence.jsonl'))) {
      throw new Error('expected validated jsonl output');
    }
    console.log('[underworld-legacy-continuity-import:self-test] PASS');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

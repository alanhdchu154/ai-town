#!/usr/bin/env node
// Curated sleepNotes importer.
//
// Default is dry-run. With --write and the explicit approval token, this writes
// a tiny promoted batch that characters may read through the prompt-facing
// sleepNotes gate. It never imports raw archived conversations, debug summaries,
// or embeddings.

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const LEGACY_ROWS_PATH = join(
  REPO_ROOT,
  'umi',
  'exports',
  'legacy-continuity-import-latest',
  'validated-legacy-continuity-evidence.jsonl',
);
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'sleep-notes-import-latest.md');
const OUT_DIR = join(REPO_ROOT, 'umi', 'exports', 'sleep-notes-import-latest');
const APPROVAL = 'alan-approved-sleep-notes-2026-06-12';
const BLOCKED_PROMPT_NOTE_PATTERN =
  /fallback|deterministic|ABORT_CONVERSATION|stage|prompt|資料庫|系統|AI 社|學生會|校園協調|情緒脈絡|記憶層級|標籤|判斷|conversation p:/i;

const CURATED_NOTES = [
  {
    sourceId: 'k172m5r60x3t1nyzvxpg6n3zyx885f53',
    subjectName: '海',
    participantNames: ['海', '真晝'],
    noteType: 'emotional_residue_candidate',
    importance: 7,
    noteZh: '真晝曾把「今天先顧好自己」這句話留給海，海沒有完全接住。',
    usageHintZh: '面對真晝時，海可以少擋一點，先讓自己停半拍。',
  },
  {
    sourceId: 'k175hj3n4h4e96v8fkc6y9mwn588bmf2',
    subjectName: '真晝',
    participantNames: ['真晝', '天澤'],
    noteType: 'relationship_trace',
    importance: 7,
    noteZh: '真晝記得天澤曾提醒她：不要把沉默的人都當成需要被拯救的難題。',
    usageHintZh: '面對沉默的人時，真晝可以陪著，但不要急著把對方變成任務。',
  },
  {
    // Alan-approved manual restore (2026-06-12): 海's 6/4 curry promise to
    // Alan. The source memory exists in the archive export
    // (umi/exports/archive-continuity-latest/memories.jsonl) but was excluded
    // from the 12-row legacy evidence packet by the food-care motif skip rule,
    // so it carries inline manual-source metadata instead of a legacy-evidence
    // lookup. The original memory text embedded the known-confabulated
    // 「世界變得太聰明」 line; this rewrite keeps only the verified promise.
    sourceId: 'k17fd5rhj15b1km5n9det99qgx8821nn',
    manualSource: {
      sourceConversationId: 'c:92192',
      sourceCreatedAt: 1780635081213,
    },
    subjectName: '海',
    participantNames: ['海', 'Alan'],
    noteType: 'long_term_memory_candidate',
    importance: 7,
    noteZh: '海記得自己曾答應 Alan 要為他做一頓咖哩飯，那頓咖哩到現在還沒一起吃。',
    usageHintZh: '再見到 Alan 時，海可以主動提起這個還沒兌現的約定，重新約一個時間一起吃。',
  },
];

const args = parseArgs(process.argv.slice(2));
const SELF_TEST = args.flags.has('self-test');
const WRITE = args.flags.has('write');
const approval = args.values.get('approval') ?? '';

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

const legacyRows = readLegacyRows(LEGACY_ROWS_PATH);
const rows = buildCuratedRows(legacyRows);
const validation = validateRows(rows, { requirePromoted: true });
if (!validation.ok) {
  throw new Error(`sleep note validation failed:\n${validation.errors.join('\n')}`);
}

let writeResult = null;
if (WRITE) {
  if (approval !== APPROVAL) {
    throw new Error(`--write requires --approval=${APPROVAL}`);
  }
  writeResult = await convexRun('sleepNotes:importSleepNotes', {
    approval,
    rows,
  });
}

writeOutputs({ rows, writeResult, legacyRowsRead: legacyRows.length });
console.log(
  `[sleep-notes-import] mode=${WRITE ? 'write' : 'dry-run'} rows=${rows.length} inserted=${writeResult?.inserted ?? 0} skipped=${writeResult?.skipped ?? 0}`,
);
console.log(`[sleep-notes-import] report=${relative(REPO_ROOT, REPORT_PATH)}`);

function buildCuratedRows(legacyRows) {
  const now = Date.now();
  const sourceById = new Map(legacyRows.map((row) => [row.sourceId, row]));
  return CURATED_NOTES.map((note) => {
    const source = note.manualSource ? null : sourceById.get(note.sourceId);
    if (!note.manualSource && !source) {
      throw new Error(`curated note source not found in legacy rows: ${note.sourceId}`);
    }
    return {
      sourceKind: note.manualSource ? 'manual' : 'legacyContinuityEvidence',
      sourceEvidenceId: note.sourceId,
      sourceConversationId: note.manualSource
        ? note.manualSource.sourceConversationId
        : (source.primaryConversationId ?? source.conversationIds?.[0]),
      legacyArchive: true,
      promptFacing: true,
      freshEvalEligible: false,
      reviewStatus: 'promoted',
      noteType: note.noteType,
      subjectName: note.subjectName,
      participantNames: note.participantNames,
      noteZh: note.noteZh,
      usageHintZh: note.usageHintZh,
      riskTags: [],
      motifHash: motifHash(`${note.subjectName}:${note.noteZh}`),
      importance: note.importance,
      createdAt: note.manualSource
        ? note.manualSource.sourceCreatedAt
        : source.sourceCreatedAtIso
          ? Date.parse(source.sourceCreatedAtIso)
          : now,
      updatedAt: now,
      promotedAt: now,
      promotedBy: 'alan-approved-codex-20260612',
      approvalNoteZh: 'Alan approved pursuing old-memory recovery into the new brain through a curated sleepNotes gate.',
    };
  });
}

function readLegacyRows(filePath) {
  if (!existsSync(filePath)) throw new Error(`legacy rows file not found: ${filePath}`);
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function validateRows(rows, { requirePromoted = false } = {}) {
  const errors = [];
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    const prefix = `row ${index + 1} ${row.subjectName}/${row.sourceEvidenceId}`;
    if (row.legacyArchive !== true) errors.push(`${prefix}: legacyArchive must be true`);
    if (row.freshEvalEligible !== false) errors.push(`${prefix}: freshEvalEligible must be false`);
    if (requirePromoted && (row.promptFacing !== true || row.reviewStatus !== 'promoted')) {
      errors.push(`${prefix}: curated first restore must be prompt-facing promoted`);
    }
    if (!row.participantNames.includes(row.subjectName)) errors.push(`${prefix}: subject must be participant`);
    if (row.noteZh.length < 12 || row.noteZh.length > 150) errors.push(`${prefix}: note length out of range`);
    if (row.usageHintZh.length < 8 || row.usageHintZh.length > 140) errors.push(`${prefix}: usage hint length out of range`);
    if (BLOCKED_PROMPT_NOTE_PATTERN.test(row.noteZh) || /[\\[\\]{}]/.test(row.noteZh)) {
      errors.push(`${prefix}: note has blocked system/pollution wording`);
    }
    if (BLOCKED_PROMPT_NOTE_PATTERN.test(row.usageHintZh)) {
      errors.push(`${prefix}: usage hint has blocked system/pollution wording`);
    }
    const key = `${row.subjectName}:${row.motifHash}`;
    if (seen.has(key)) errors.push(`${prefix}: duplicate subject/motif`);
    seen.add(key);
  }
  return { ok: errors.length === 0, errors };
}

async function convexRun(functionName, payload) {
  const { stdout } = await execFileAsync(
    'npx',
    ['convex', 'run', '--typecheck', 'disable', '--codegen', 'disable', functionName, JSON.stringify(payload)],
    { cwd: REPO_ROOT, timeout: 180_000, maxBuffer: 1024 * 1024 * 16 },
  );
  return JSON.parse(stdout.trim().slice(stdout.trim().indexOf('{')));
}

function writeOutputs({ rows, writeResult, legacyRowsRead }) {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(join(OUT_DIR, 'sleep-notes.jsonl'), rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  writeFileSync(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: WRITE ? 'write' : 'dry-run',
        legacyRowsRead,
        rows: rows.length,
        writeResult,
        files: { rows: 'sleep-notes.jsonl' },
      },
      null,
      2,
    ),
  );
  writeFileSync(REPORT_PATH, buildReport({ rows, writeResult, legacyRowsRead }), 'utf8');
}

function buildReport({ rows, writeResult, legacyRowsRead }) {
  const lines = [];
  lines.push('# Underworld Sleep Notes Import');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Mode: ${WRITE ? 'write' : 'dry-run'}`);
  lines.push(`Legacy rows read: ${legacyRowsRead}`);
  lines.push(`Rows prepared: ${rows.length}`);
  lines.push(`Inserted: ${writeResult?.inserted ?? 0}`);
  lines.push(`Skipped: ${writeResult?.skipped ?? 0}`);
  lines.push('');
  lines.push('## Prompt-Facing Notes');
  lines.push('');
  for (const row of rows) {
    lines.push(`- ${row.subjectName} (${row.participantNames.join(' / ')}): ${row.noteZh}`);
    lines.push(`  - use: ${row.usageHintZh}`);
    lines.push(`  - source: ${row.sourceEvidenceId}; freshEvalEligible=${row.freshEvalEligible}`);
  }
  lines.push('');
  lines.push('## Safety');
  lines.push('');
  lines.push('- These are rewritten promoted notes, not raw archived conversations or debug summaries.');
  lines.push('- All rows are legacyArchive=true and freshEvalEligible=false.');
  lines.push('- Prompt read path is capped at one promoted sleep note per speaker/partner prompt.');
  lines.push('- Existing `memories` and vector embeddings are not touched.');
  lines.push('');
  return lines.join('\n');
}

function motifHash(text) {
  return createHash('sha256')
    .update(text.replace(/\s+/g, ''))
    .digest('hex')
    .slice(0, 16);
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

function runSelfTest() {
  const rows = CURATED_NOTES.map((note) => ({
    sourceKind: note.manualSource ? 'manual' : 'legacyContinuityEvidence',
    sourceEvidenceId: note.sourceId,
    legacyArchive: true,
    promptFacing: true,
    freshEvalEligible: false,
    reviewStatus: 'promoted',
    noteType: note.noteType,
    subjectName: note.subjectName,
    participantNames: note.participantNames,
    noteZh: note.noteZh,
    usageHintZh: note.usageHintZh,
    riskTags: [],
    motifHash: motifHash(`${note.subjectName}:${note.noteZh}`),
    importance: note.importance,
  }));
  const validation = validateRows(rows, { requirePromoted: true });
  if (!validation.ok) {
    console.error(`[sleep-notes-import:self-test] FAIL\n${validation.errors.join('\n')}`);
    process.exit(1);
  }
  console.log('[sleep-notes-import:self-test] PASS');
}

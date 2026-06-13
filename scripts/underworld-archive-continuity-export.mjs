#!/usr/bin/env node
// Export continuity data from a local Convex sqlite DB without mutating it.
//
// This is intentionally export-only. It does not import into the fresh world,
// delete old rows, compact sqlite, or touch Convex runtime state.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_ARCHIVE_DB =
  '/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town-archive-20260612T085455-pre-fresh-world/convex_local_backend.sqlite3';
const DEFAULT_OUT_DIR = join(REPO_ROOT, 'umi', 'exports', 'archive-continuity-latest');

const args = parseArgs(process.argv.slice(2));
if (args.flags.has('self-test')) {
  runSelfTest();
  process.exit(0);
}

const dbPath = args.values.get('db') ?? DEFAULT_ARCHIVE_DB;
const outDir = args.values.get('out-dir') ?? DEFAULT_OUT_DIR;
const limit = Number(args.values.get('limit') ?? 250_000);
const includeEmbeddings = args.flags.has('include-embeddings');

if (!existsSync(dbPath)) {
  throw new Error(`sqlite DB not found: ${dbPath}`);
}

const startedAt = new Date().toISOString();
const rows = queryCandidateRows(dbPath, limit);
const buckets = new Map();
let skipped = 0;
for (const row of rows) {
  let doc;
  try {
    doc = JSON.parse(row.json_value);
  } catch {
    skipped += 1;
    continue;
  }
  const target = classifyContinuityDoc(doc, { includeEmbeddings });
  if (!target) {
    skipped += 1;
    continue;
  }
  const record = {
    exportKind: target,
    source: {
      dbPath,
      tableId: row.tableId,
      ts: Number(row.ts),
      legacyArchive: true,
    },
    doc,
  };
  if (!buckets.has(target)) buckets.set(target, []);
  buckets.get(target).push(record);
}

writeExport({ outDir, dbPath, startedAt, rowsScanned: rows.length, skipped, buckets, includeEmbeddings });

const totalExported = [...buckets.values()].reduce((sum, items) => sum + items.length, 0);
console.log(
  `[underworld-archive-continuity-export] scanned=${rows.length} exported=${totalExported} skipped=${skipped}`,
);
console.log(`[underworld-archive-continuity-export] out=${relative(REPO_ROOT, outDir)}`);

function queryCandidateRows(dbPath, limit) {
  const sql = `
    select
      hex(table_id) as tableId,
      ts,
      json_value
    from documents
    where deleted = 0
      and json_value is not null
      and (
        json_extract(json_value, '$.text') is not null
        or json_extract(json_value, '$.description') is not null
        or json_extract(json_value, '$.eventSummary') is not null
        or json_extract(json_value, '$.descriptionZh') is not null
        or json_extract(json_value, '$.identity') is not null
        or json_extract(json_value, '$.participants') is not null
        or json_extract(json_value, '$.player1') is not null
        or json_extract(json_value, '$.mood') is not null
        or json_extract(json_value, '$.contentZh') is not null
        or json_extract(json_value, '$.residue') is not null
        or json_extract(json_value, '$.relationshipSummaryZh') is not null
        or json_extract(json_value, '$.freeDevelopmentMode') is not null
        or json_extract(json_value, '$.embedding') is not null
      )
    order by ts asc
    limit ${integerSql(limit)};
  `;
  const stdout = execFileSync('sqlite3', ['-readonly', '-cmd', '.timeout 10000', '-json', dbPath, sql], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
  });
  const trimmed = stdout.trim();
  return trimmed ? JSON.parse(trimmed) : [];
}

function classifyContinuityDoc(doc, { includeEmbeddings }) {
  const keys = new Set(Object.keys(doc));
  if (keys.has('author') && keys.has('conversationId') && keys.has('text')) return 'messages';
  if ((keys.has('conversationId') || keys.has('id')) && keys.has('participants') && keys.has('numMessages')) {
    return doc.ended ? 'archived_conversations' : 'live_conversations';
  }
  if (keys.has('conversationId') && keys.has('player1') && keys.has('player2')) return 'participated_together';
  if (keys.has('description') && keys.has('embeddingId') && keys.has('playerId')) return 'memories';
  if (includeEmbeddings && keys.has('embedding') && (keys.has('memoryId') || keys.has('worldId'))) {
    return 'memory_embeddings';
  }
  if (keys.has('eventSummary') && keys.has('emotionalInterpretation') && keys.has('involvedCharacters')) {
    return 'emotional_residue';
  }
  if (keys.has('actorName') && keys.has('descriptionZh') && keys.has('futureImplicationsZh')) {
    return 'school_timeline';
  }
  if (keys.has('mood') && keys.has('schoolStability') && keys.has('worldId')) return 'school_world_pressure';
  if (keys.has('contentZh') && keys.has('titleZh') && keys.has('type') && keys.has('worldTimeLabelZh')) {
    return 'notifications';
  }
  if (keys.has('playerId') && keys.has('character') && keys.has('description') && keys.has('name')) {
    return 'player_descriptions';
  }
  if (keys.has('agentId') && keys.has('identity') && keys.has('plan')) return 'agent_descriptions';
  if (keys.has('relationshipSummaryZh') || keys.has('closenessTrendZh') || keys.has('trustTrendZh')) {
    return 'relationship_state';
  }
  if (keys.has('freeDevelopmentMode') || keys.has('strongestTraitZh') || keys.has('timeSpentWith')) {
    return 'alan_behavior_profiles';
  }
  return undefined;
}

function writeExport({ outDir, dbPath, startedAt, rowsScanned, skipped, buckets, includeEmbeddings }) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    startedAt,
    dbPath,
    mode: 'export_only_no_import_no_mutation',
    includeEmbeddings,
    rowsScanned,
    skipped,
    totals: {},
    files: {},
  };
  for (const [target, records] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const filename = `${target}.jsonl`;
    manifest.totals[target] = records.length;
    manifest.files[target] = filename;
    writeFileSync(
      join(outDir, filename),
      records.map((record) => `${JSON.stringify(record)}\n`).join(''),
      'utf8',
    );
  }
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  writeFileSync(join(outDir, 'README.md'), buildReadme(manifest), 'utf8');
}

function buildReadme(manifest) {
  const lines = [
    '# Underworld Archive Continuity Export',
    '',
    `Generated: ${manifest.generatedAt}`,
    `Source DB: \`${manifest.dbPath}\``,
    '',
    'Export-only. This directory was produced from a read-only sqlite query. It is not an import, cleanup, or mutation.',
    '',
    '## Totals',
    '',
    `- Rows scanned: ${manifest.rowsScanned}`,
    `- Rows skipped: ${manifest.skipped}`,
    `- Embeddings included: ${manifest.includeEmbeddings ? 'yes' : 'no'}`,
    '',
    '| Kind | Rows | File |',
    '|---|---:|---|',
    ...Object.keys(manifest.totals)
      .sort()
      .map((key) => `| ${key} | ${manifest.totals[key]} | \`${manifest.files[key]}\` |`),
    '',
    '## Import Boundary',
    '',
    '- Do not import these rows directly into the fresh world without Alan approval.',
    '- Treat these rows as historical evidence, not fresh v0.1 samples.',
    '- Curate or summarize emotional residue before prompt injection.',
    '- Keep `legacyArchive: true` / source metadata if any row is later imported.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function integerSql(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
    throw new Error(`invalid integer SQL value: ${value}`);
  }
  return String(n);
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
  const samples = [
    [{ author: 'p:0', conversationId: 'c:1', text: '你好', worldId: 'w' }, 'messages'],
    [{ conversationId: 'c:1', participants: ['p:0', 'p:1'], numMessages: 4, ended: 1 }, 'archived_conversations'],
    [{ description: '海記得 Alan 說過晚點回來', embeddingId: 'e', playerId: 'p:0' }, 'memories'],
    [{ eventSummary: '海與真晝談過休息', emotionalInterpretation: '真晝注意到海', involvedCharacters: ['海', '真晝'] }, 'emotional_residue'],
    [{ actorName: '海', descriptionZh: '海把簡報縮短', futureImplicationsZh: '明天少說一點' }, 'school_timeline'],
  ];
  for (const [doc, expected] of samples) {
    const actual = classifyContinuityDoc(doc, { includeEmbeddings: false });
    if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`);
  }
  console.log('[underworld-archive-continuity-export:self-test] PASS');
}

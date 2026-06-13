#!/usr/bin/env node
// Read-only local Convex state growth audit for GIIS Underworld.
//
// This script inspects Convex's local sqlite state without writing to it. It is
// intentionally shape-based: Convex table ids are internal binary values, so we
// classify likely tables from document JSON and scheduled-job arg payloads.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_STATE_DIR =
  process.env.UNDERWORLD_CONVEX_STATE_DIR ??
  '/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town';
const DEFAULT_DB_PATH = join(DEFAULT_STATE_DIR, 'convex_local_backend.sqlite3');
const DEFAULT_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'state-growth-audit-latest.md');

const args = parseArgs(process.argv.slice(2));
if (args.flags.has('self-test')) {
  runSelfTest();
  process.exit(0);
}

const dbPath = args.values.get('db') ?? DEFAULT_DB_PATH;
const stateDir = args.values.get('state-dir') ?? dirname(dbPath);
const reportPath = args.values.get('out') ?? DEFAULT_REPORT_PATH;
const scanLimit = Number(args.values.get('arg-scan-limit') ?? 5000);
const fastMode = args.flags.has('fast');

if (!existsSync(dbPath)) {
  throw new Error(`sqlite DB not found: ${dbPath}`);
}

const audit = runAudit({ dbPath, stateDir, scanLimit, fastMode });
const report = buildReport(audit);
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, report, 'utf8');

console.log(
  `[underworld-state-growth-audit] db=${formatBytes(audit.dbBytes)} state=${audit.stateDirHuman} documents=${audit.documents.totalRows} arg_rows_scanned=${audit.argRows.scanned}`,
);
console.log(`[underworld-state-growth-audit] report=${relative(REPO_ROOT, reportPath)}`);

function runAudit({ dbPath: sqlitePath, stateDir: localStateDir, scanLimit: limit, fastMode: fast }) {
  const dbBytes = statSync(sqlitePath).size;
  const stateDirHuman = humanDu(localStateDir);
  const storageDir = join(localStateDir, 'convex_local_storage');
  const storageHuman = existsSync(storageDir) ? humanDu(storageDir) : 'missing';
  const documentStats = sqliteOne(
    sqlitePath,
    fast
      ? 'select count(*) as totalRows, coalesce(sum(deleted),0) as deletedRows, null as jsonBytes from documents;'
      : 'select count(*) as totalRows, coalesce(sum(deleted),0) as deletedRows, coalesce(sum(length(json_value)),0) as jsonBytes from documents;',
  );
  const indexStats = sqliteOne(
    sqlitePath,
    'select count(*) as totalRows, coalesce(sum(deleted),0) as deletedRows from indexes;',
  );
  const pageCount = sqliteOne(sqlitePath, 'pragma page_count;');
  const freelistCount = sqliteOne(sqlitePath, 'pragma freelist_count;');
  const pageSize = sqliteOne(sqlitePath, 'pragma page_size;');
  const rawTableGroups = fast
    ? []
    : sqliteJson(
        sqlitePath,
        `select
       hex(table_id) as tableId,
       count(*) as rows,
       coalesce(sum(deleted),0) as deletedRows,
       coalesce(sum(length(json_value)),0) as jsonBytes,
       coalesce(max(length(json_value)),0) as maxJsonBytes
     from documents
     group by table_id
     order by jsonBytes desc
     limit 25;`,
      );
  const tableGroups = rawTableGroups.map((row) => {
    const sample = sqliteOne(
      sqlitePath,
      `select substr(json_value, 1, 1200) as sample
       from documents
       where deleted = 0
         and json_value is not null
         and hex(table_id) = '${safeHex(row.tableId)}'
       order by length(json_value) desc
       limit 1;`,
    ).sample;
    return { ...row, sample, label: classifyTableGroup({ ...row, sample }) };
  });

  const argGroupRows = fast
    ? []
    : sqliteJson(
        sqlitePath,
        `select
       hex(table_id) as tableId,
       count(*) as rows,
       coalesce(sum(deleted),0) as deletedRows,
       coalesce(sum(length(json_value)),0) as jsonBytes,
       coalesce(max(length(json_value)),0) as maxJsonBytes
     from documents
     where json_extract(json_value, '$.args.$bytes') is not null
     group by table_id
     order by jsonBytes desc
     limit 10;`,
      );

  const fastRecentDocumentLimit = Math.max(limit * 20, 20_000);
  const argRows = sqliteJson(
    sqlitePath,
    fast
      ? `select
       hex(table_id) as tableId,
       ts,
       length(json_value) as jsonBytes,
       json_extract(json_value, '$._id') as id,
       json_extract(json_value, '$._creationTime') as creationTime,
       json_extract(json_value, '$.args.$bytes') as argsBytes
     from (
       select table_id, ts, json_value
       from documents
       where deleted = 0
         and json_value is not null
       order by ts desc
       limit ${integerSql(fastRecentDocumentLimit)}
     )
     where json_extract(json_value, '$.args.$bytes') is not null
     order by ts desc
     limit ${integerSql(limit)};`
      : `select
       hex(table_id) as tableId,
       ts,
       length(json_value) as jsonBytes,
       json_extract(json_value, '$._id') as id,
       json_extract(json_value, '$._creationTime') as creationTime,
       json_extract(json_value, '$.args.$bytes') as argsBytes
     from documents
     where deleted = 0
       and json_extract(json_value, '$.args.$bytes') is not null
     order by ts desc
     limit ${integerSql(limit)};`,
  );
  const argScan = scanScheduledArgs(argRows);

  return {
    generatedAt: new Date().toISOString(),
    fastMode: fast,
    dbPath: sqlitePath,
    stateDir: localStateDir,
    dbBytes,
    stateDirHuman,
    storageHuman,
    documents: {
      totalRows: Number(documentStats?.totalRows ?? 0),
      deletedRows: Number(documentStats?.deletedRows ?? 0),
      jsonBytes: documentStats?.jsonBytes == null ? null : Number(documentStats.jsonBytes),
    },
    indexes: {
      totalRows: Number(indexStats?.totalRows ?? 0),
      deletedRows: Number(indexStats?.deletedRows ?? 0),
    },
    pages: {
      pageCount: Number(pageCount?.page_count ?? 0),
      freelistCount: Number(freelistCount?.freelist_count ?? 0),
      pageSize: Number(pageSize?.page_size ?? 0),
    },
    tableGroups,
    argGroups: argGroupRows,
    argRows: argScan,
  };
}

function scanScheduledArgs(rows) {
  const scanned = [];
  const counts = {
    scanned: rows.length,
    decodeErrors: 0,
    mapPayloadRows: 0,
    idOnlyAgentDoSomethingRows: 0,
    conversationRows: 0,
    runStepRows: 0,
    otherRows: 0,
  };
  for (const row of rows) {
    const decoded = decodeConvexBytes(row.argsBytes);
    if (!decoded.ok) {
      counts.decodeErrors += 1;
      scanned.push({ ...row, classification: 'decode_error', payloadBytes: 0, keys: [], flags: [] });
      continue;
    }
    const classification = classifyArgPayload(decoded.value);
    counts[classification.counter] += 1;
    scanned.push({
      tableId: row.tableId,
      id: row.id,
      ts: Number(row.ts),
      creationTime: Number(row.creationTime),
      jsonBytes: Number(row.jsonBytes),
      payloadBytes: decoded.rawBytes,
      classification: classification.label,
      keys: classification.keys,
      flags: classification.flags,
      preview: classification.preview,
    });
  }
  return {
    ...counts,
    latest: scanned.slice(0, 12),
    largest: [...scanned].sort((a, b) => b.payloadBytes - a.payloadBytes).slice(0, 12),
  };
}

function decodeConvexBytes(base64) {
  try {
    const buffer = Buffer.from(String(base64 ?? ''), 'base64');
    const text = buffer.toString('utf8');
    return { ok: true, value: JSON.parse(text), rawBytes: buffer.length };
  } catch (error) {
    return { ok: false, error };
  }
}

function classifyArgPayload(value) {
  const firstArg = Array.isArray(value) ? value[0] : value;
  const keys = firstArg && typeof firstArg === 'object' ? Object.keys(firstArg).sort() : [];
  const text = JSON.stringify(value);
  const flags = [];
  if (text.includes('"animatedSprites"')) flags.push('animatedSprites');
  if (text.includes('"bgTiles"')) flags.push('bgTiles');
  if (text.includes('"objectTiles"')) flags.push('objectTiles');
  if (text.includes('"otherFreePlayers"')) flags.push('otherFreePlayers');
  if (text.includes('"map"')) flags.push('map');
  if (text.includes('"player"')) flags.push('player');
  if (text.includes('"agent"')) flags.push('agent');
  if (flags.some((flag) => ['animatedSprites', 'bgTiles', 'objectTiles', 'otherFreePlayers'].includes(flag))) {
    return { label: 'large_map_or_snapshot_payload', counter: 'mapPayloadRows', keys, flags, preview: previewArg(firstArg) };
  }
  if (keys.includes('conversationId') || keys.includes('messageUuid') || keys.includes('otherPlayerId')) {
    return { label: 'conversation_message_payload', counter: 'conversationRows', keys, flags, preview: previewArg(firstArg) };
  }
  if (
    keys.includes('agentId') &&
    keys.includes('operationId') &&
    keys.includes('playerId') &&
    keys.includes('worldId') &&
    !keys.includes('map') &&
    !keys.includes('agent') &&
    !keys.includes('player')
  ) {
    return { label: 'id_only_agent_do_something_payload', counter: 'idOnlyAgentDoSomethingRows', keys, flags, preview: previewArg(firstArg) };
  }
  if (keys.includes('generationNumber') && keys.includes('maxDuration') && keys.includes('worldId')) {
    return { label: 'run_step_payload', counter: 'runStepRows', keys, flags, preview: previewArg(firstArg) };
  }
  return { label: 'other_scheduled_payload', counter: 'otherRows', keys, flags, preview: previewArg(firstArg) };
}

function previewArg(value) {
  if (!value || typeof value !== 'object') return String(value).slice(0, 120);
  const preview = {};
  for (const key of Object.keys(value).sort().slice(0, 12)) {
    if (key === 'map' || key === 'player' || key === 'agent' || key === 'otherFreePlayers') {
      preview[key] = '[large object]';
    } else {
      preview[key] = value[key];
    }
  }
  return JSON.stringify(preview).slice(0, 240);
}

function classifyTableGroup(row) {
  const sampleLabel = classifySampleJson(row.sample);
  if (sampleLabel) return sampleLabel;
  const bytes = Number(row.jsonBytes ?? 0);
  const max = Number(row.maxJsonBytes ?? 0);
  if (max > 10_000 && bytes > 1_000_000) return 'probable large scheduled args / encoded payloads';
  if (Number(row.deletedRows ?? 0) > 0 && Number(row.rows ?? 0) > Number(row.deletedRows ?? 0)) return 'mixed active/deleted history';
  if (bytes > 1_000_000) return 'large active logical table';
  return 'small or normal logical table';
}

function classifySampleJson(sample) {
  if (!sample) return undefined;
  let value;
  try {
    value = JSON.parse(sample);
  } catch {
    return undefined;
  }
  const keys = new Set(Object.keys(value));
  if (keys.has('currentTime') && keys.has('generationNumber') && keys.has('running')) return 'engines';
  if (keys.has('players') && keys.has('agents') && keys.has('conversations') && keys.has('nextId')) return 'worlds';
  if (keys.has('udfPath') && keys.has('argsId') && keys.has('state')) return 'scheduled jobs';
  if (keys.has('args') && value.args && typeof value.args === 'object' && '$bytes' in value.args) return 'scheduled job args';
  if (keys.has('engineId') && keys.has('number') && keys.has('name') && keys.has('args')) return 'inputs';
  if (keys.has('author') && keys.has('conversationId') && keys.has('text')) return 'messages';
  if (keys.has('conversationId') && keys.has('participants') && keys.has('numMessages')) return 'conversations';
  if (keys.has('conversationId') && keys.has('player1') && keys.has('player2')) return 'participatedTogether';
  if (keys.has('description') && keys.has('embeddingId') && keys.has('playerId')) return 'memories';
  if (keys.has('embedding') && keys.has('memoryId')) return 'memoryEmbeddings';
  if (keys.has('eventSummary') && keys.has('emotionalInterpretation') && keys.has('involvedCharacters')) return 'experienceLogs / emotional residue';
  if (keys.has('actorName') && keys.has('descriptionZh') && keys.has('futureImplicationsZh')) return 'school timeline events';
  if (keys.has('worldClock') && keys.has('status') && keys.has('worldId')) return 'worldStatus';
  if (keys.has('animatedSprites') && keys.has('bgTiles')) return 'maps';
  if (keys.has('agentId') && keys.has('identity') && keys.has('plan')) return 'agentDescriptions';
  if (keys.has('playerId') && keys.has('character') && keys.has('description')) return 'playerDescriptions';
  if (keys.has('mood') && keys.has('schoolStability') && keys.has('worldId')) return 'schoolWorldPressure';
  return undefined;
}

function buildReport(audit) {
  const freelistBytes = audit.pages.freelistCount * audit.pages.pageSize;
  const lines = [
    '# GIIS Underworld State Growth Audit',
    '',
    `Generated: ${audit.generatedAt}`,
    `DB: \`${audit.dbPath}\``,
    `State dir: \`${audit.stateDir}\``,
    '',
    'Read-only. This report does not compact, delete, restore, or mutate local Convex state.',
    '',
    '## Summary',
    '',
    `- State dir size: ${audit.stateDirHuman}`,
    `- Local storage size: ${audit.storageHuman}`,
    `- SQLite size: ${formatBytes(audit.dbBytes)}`,
    `- Mode: ${audit.fastMode ? 'fast bounded scan' : 'full local audit'}`,
    `- Documents: ${audit.documents.totalRows} rows (${audit.documents.deletedRows} deleted), ${audit.documents.jsonBytes == null ? 'not summed in fast mode' : `${formatBytes(audit.documents.jsonBytes)} JSON`}`,
    `- Indexes: ${audit.indexes.totalRows} rows (${audit.indexes.deletedRows} deleted)`,
    `- Freelist: ${audit.pages.freelistCount} pages (${formatBytes(freelistBytes)})`,
    '',
    '## Scheduled Arg Scan',
    '',
    `- Rows scanned: ${audit.argRows.scanned}`,
    `- Large map/snapshot payload rows: ${audit.argRows.mapPayloadRows}`,
    `- ID-only agent/message payload rows: ${audit.argRows.idOnlyAgentDoSomethingRows}`,
    `- Conversation message payload rows: ${audit.argRows.conversationRows}`,
    `- Run-step payload rows: ${audit.argRows.runStepRows}`,
    `- Other scheduled payload rows: ${audit.argRows.otherRows}`,
    `- Decode errors: ${audit.argRows.decodeErrors}`,
    '',
    'Interpretation: after T1, newly scheduled `agentDoSomething` rows should look like ID-only payloads. Large map/snapshot rows in this report are still evidence to watch, but they may be queued before the T1 code change unless they appear among the latest rows after fresh runtime activity.',
    '',
    '### Latest Scheduled Args',
    '',
    '| Created | JSON | Payload | Class | Keys | Flags | Preview |',
    '|---|---:|---:|---|---|---|---|',
    ...audit.argRows.latest.map(formatArgRow),
    '',
    '### Largest Scanned Scheduled Args',
    '',
    '| Created | JSON | Payload | Class | Keys | Flags | Preview |',
    '|---|---:|---:|---|---|---|---|',
    ...audit.argRows.largest.map(formatArgRow),
    '',
    '## Arg-Shaped Table Groups',
    '',
    ...(audit.argGroups.length === 0
      ? ['Skipped in fast mode.', '']
      : [
    '| Table ID | Rows | Deleted | JSON | Max Row |',
    '|---|---:|---:|---:|---:|',
    ...audit.argGroups.map((row) =>
      `| \`${row.tableId}\` | ${row.rows} | ${row.deletedRows} | ${formatBytes(Number(row.jsonBytes ?? 0))} | ${formatBytes(Number(row.maxJsonBytes ?? 0))} |`,
    ),
        '']),
    '',
    '## Largest Document Table Groups',
    '',
    ...(audit.tableGroups.length === 0
      ? ['Skipped in fast mode.', '']
      : [
    '| Table ID | Rows | Deleted | JSON | Max Row | Label |',
    '|---|---:|---:|---:|---:|---|',
    ...audit.tableGroups.map((row) =>
      `| \`${row.tableId}\` | ${row.rows} | ${row.deletedRows} | ${formatBytes(Number(row.jsonBytes ?? 0))} | ${formatBytes(Number(row.maxJsonBytes ?? 0))} | ${escapeCell(row.label)} |`,
    ),
        '']),
    '',
    '## Next Read',
    '',
    '- If latest rows stay ID-only after new world ticks, T1 is working.',
    '- If large map/snapshot rows keep appearing at the top after T1, inspect remaining schedulers that still pass serialized map/player/agent context.',
    '- Do not delete old state. Export continuity data from the archived DB as data, then import only curated memories/residues/conversation summaries into the fresh world after Alan approves the boundary.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function formatArgRow(row) {
  return [
    formatCreationTime(row.creationTime),
    formatBytes(row.jsonBytes),
    formatBytes(row.payloadBytes),
    row.classification,
    (row.keys ?? []).join(', '),
    (row.flags ?? []).join(', '),
    row.preview,
  ].map(escapeCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |');
}

function formatCreationTime(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'unknown';
  return new Date(n).toISOString();
}

function sqliteJson(dbPath, sql) {
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const stdout = execFileSync('sqlite3', ['-readonly', '-cmd', '.timeout 10000', '-json', dbPath, sql], {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 128,
      });
      const trimmed = stdout.trim();
      return trimmed ? JSON.parse(trimmed) : [];
    } catch (error) {
      const message = String(error?.stderr ?? error?.message ?? '');
      if (!/database is locked|SQLITE_BUSY/i.test(message) || attempt === attempts) {
        throw error;
      }
      execFileSync('sleep', [String(attempt)]);
    }
  }
  return [];
}

function sqliteOne(dbPath, sql) {
  return sqliteJson(dbPath, sql)[0] ?? {};
}

function humanDu(path) {
  try {
    return execFileSync('du', ['-sh', path], { encoding: 'utf8' }).trim().split(/\s+/)[0];
  } catch {
    return 'unknown';
  }
}

function integerSql(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
    throw new Error(`invalid integer SQL value: ${value}`);
  }
  return String(n);
}

function safeHex(value) {
  const text = String(value ?? '');
  if (!/^[0-9A-F]+$/i.test(text)) throw new Error(`invalid hex value: ${value}`);
  return text.toUpperCase();
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = bytes;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\n/g, '<br>');
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
  const large = [
    {
      agent: { id: 'a:1', playerId: 'p:1' },
      map: { animatedSprites: [{ sheet: 'x.json' }], bgTiles: [], objectTiles: [] },
      otherFreePlayers: [],
    },
  ];
  const slim = [{ worldId: 'w', playerId: 'p:1', agentId: 'a:1', operationId: 'o:1' }];
  const encodedLarge = Buffer.from(JSON.stringify(large)).toString('base64');
  const encodedSlim = Buffer.from(JSON.stringify(slim)).toString('base64');
  const decodedLarge = decodeConvexBytes(encodedLarge);
  const decodedSlim = decodeConvexBytes(encodedSlim);
  if (!decodedLarge.ok || !decodedSlim.ok) throw new Error('decode failed');
  if (classifyArgPayload(decodedLarge.value).label !== 'large_map_or_snapshot_payload') {
    throw new Error('large payload classification failed');
  }
  if (classifyArgPayload(decodedSlim.value).label !== 'id_only_agent_do_something_payload') {
    throw new Error('slim payload classification failed');
  }
  console.log('[underworld-state-growth-audit:self-test] PASS');
}

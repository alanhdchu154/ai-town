#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const DEFAULT_DB = join(
  homedir(),
  '.convex',
  'convex-backend-state',
  'local-alan_chu-ai_town',
  'convex_local_backend.sqlite3',
);

const dbPath = process.env.CONVEX_LOCAL_SQLITE_PATH ?? DEFAULT_DB;
const write = process.argv.includes('--write');
const vacuum = !process.argv.includes('--no-vacuum');

if (!existsSync(dbPath)) {
  console.error(`Local Convex SQLite file not found: ${dbPath}`);
  process.exit(1);
}

function sqlite(sql, options = {}) {
  return execFileSync('sqlite3', [dbPath, sql], {
    encoding: 'utf8',
    maxBuffer: options.maxBuffer ?? 1024 * 1024 * 64,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function quoteSql(value) {
  return String(value).replace(/'/g, "''");
}

function tableIdFor(whereClause) {
  return sqlite(`
    select hex(table_id)
    from documents
    where deleted=0 and ${whereClause}
    group by table_id
    order by count(*) desc
    limit 1;
  `);
}

function count(sql) {
  const raw = sqlite(sql);
  return Number(raw || 0);
}

const relationshipTableId = tableIdFor(
  `json_value like '%"subjectPlayerId"%' and json_value like '%"objectPlayerId"%' and json_value like '%"dimensions"%'`,
);
const scheduledTableId = tableIdFor(
  `json_value like '%"udfPath"%' and json_value like '%"state"%'`,
);

if (!relationshipTableId || !scheduledTableId) {
  console.error('Could not detect relationship or scheduled-function table ids.');
  process.exit(1);
}

const relationshipActive = count(`
  select count(*)
  from documents
  where table_id=x'${relationshipTableId}' and deleted=0;
`);
const relationshipUniqueEdges = count(`
  select count(*)
  from (
    select
      json_extract(json_value,'$.worldId') worldId,
      json_extract(json_value,'$.subjectPlayerId') subjectPlayerId,
      json_extract(json_value,'$.objectPlayerId') objectPlayerId
    from documents
    where table_id=x'${relationshipTableId}' and deleted=0
    group by worldId, subjectPlayerId, objectPlayerId
  );
`);
const ensureWorldProfilesScheduled = count(`
  select count(*)
  from documents
  where table_id=x'${scheduledTableId}'
    and deleted=0
    and json_extract(json_value,'$.udfPath')='school.js:ensureWorldProfiles';
`);
const ensureWorldProfilesArgs = count(`
  with scheduled_args as (
    select json_extract(json_value,'$.argsId') argsId
    from documents
    where table_id=x'${scheduledTableId}'
      and deleted=0
      and json_extract(json_value,'$.udfPath')='school.js:ensureWorldProfiles'
      and json_extract(json_value,'$.argsId') is not null
  )
  select count(*)
  from documents
  where json_extract(json_value,'$._id') in (select argsId from scheduled_args);
`);
const totalDocuments = count(`select count(*) from documents;`);
const activeDocuments = count(`select count(*) from documents where deleted=0;`);
const plannedRelationshipDeletes = Math.max(0, relationshipActive - relationshipUniqueEdges);
const plannedDeletes =
  plannedRelationshipDeletes + ensureWorldProfilesScheduled + ensureWorldProfilesArgs;

console.log('GIIS local Convex state repair');
console.log(`DB: ${dbPath}`);
console.log(`Mode: ${write ? 'WRITE' : 'DRY RUN'}`);
console.log(`Documents: ${activeDocuments} active / ${totalDocuments} total`);
console.log(`Relationship table: ${relationshipTableId}`);
console.log(`Scheduled table: ${scheduledTableId}`);
console.log(`Relationship rows: ${relationshipActive}`);
console.log(`Unique relationship edges: ${relationshipUniqueEdges}`);
console.log(`Duplicate relationship rows to remove: ${plannedRelationshipDeletes}`);
console.log(`ensureWorldProfiles scheduled rows to remove: ${ensureWorldProfilesScheduled}`);
console.log(`ensureWorldProfiles arg rows to remove: ${ensureWorldProfilesArgs}`);
console.log(`Planned document removals: ${plannedDeletes}`);

if (!write) {
  console.log('\nDry run only. Re-run with --write to back up and clean the local DB.');
  process.exit(0);
}

if (plannedDeletes === 0) {
  console.log('\nNothing to clean.');
  process.exit(0);
}

const backupDir = join(dirname(dbPath), 'backups');
mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = join(backupDir, `convex_local_backend.${timestamp}.sqlite3.bak`);
copyFileSync(dbPath, backupPath);
console.log(`Backup written: ${backupPath}`);

const cleanupSql = `
PRAGMA busy_timeout=5000;
PRAGMA foreign_keys=OFF;

CREATE TEMP TABLE cleanup_document_ids(id BLOB PRIMARY KEY);

INSERT OR IGNORE INTO cleanup_document_ids
SELECT id
FROM (
  SELECT
    id,
    row_number() over (
      partition by
        json_extract(json_value,'$.worldId'),
        json_extract(json_value,'$.subjectPlayerId'),
        json_extract(json_value,'$.objectPlayerId')
      order by
        coalesce(json_extract(json_value,'$.updatedAt'), json_extract(json_value,'$._creationTime')) desc,
        ts desc
    ) as rn
  FROM documents
  WHERE table_id=x'${quoteSql(relationshipTableId)}' and deleted=0
)
WHERE rn > 1;

CREATE TEMP TABLE cleanup_scheduled_arg_ids(arg_id TEXT PRIMARY KEY);

INSERT OR IGNORE INTO cleanup_scheduled_arg_ids
SELECT json_extract(json_value,'$.argsId')
FROM documents
WHERE table_id=x'${quoteSql(scheduledTableId)}'
  and deleted=0
  and json_extract(json_value,'$.udfPath')='school.js:ensureWorldProfiles'
  and json_extract(json_value,'$.argsId') is not null;

INSERT OR IGNORE INTO cleanup_document_ids
SELECT id
FROM documents
WHERE table_id=x'${quoteSql(scheduledTableId)}'
  and deleted=0
  and json_extract(json_value,'$.udfPath')='school.js:ensureWorldProfiles';

INSERT OR IGNORE INTO cleanup_document_ids
SELECT id
FROM documents
WHERE json_extract(json_value,'$._id') in (select arg_id from cleanup_scheduled_arg_ids);

DELETE FROM indexes
WHERE document_id in (select id from cleanup_document_ids);

DELETE FROM documents
WHERE id in (select id from cleanup_document_ids);

${vacuum ? 'VACUUM;' : ''}
PRAGMA integrity_check;
`;

const result = sqlite(cleanupSql, { maxBuffer: 1024 * 1024 * 8 });
console.log(result);

const afterActiveDocuments = count(`select count(*) from documents where deleted=0;`);
const afterTotalDocuments = count(`select count(*) from documents;`);
console.log(`After cleanup: ${afterActiveDocuments} active / ${afterTotalDocuments} total`);

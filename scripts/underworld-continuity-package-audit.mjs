#!/usr/bin/env node
// Audit an export-only Underworld continuity package.
//
// This script reads JSONL files under umi/exports/archive-continuity-latest and
// writes a review report. It never reads or mutates Convex sqlite directly.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_IN_DIR = join(REPO_ROOT, 'umi', 'exports', 'archive-continuity-latest');
const DEFAULT_OUT = join(REPO_ROOT, 'umi', 'reports', 'continuity-package-audit-latest.md');

const args = parseArgs(process.argv.slice(2));
const FALLBACK_PATTERNS = [
  /我懂。這種感覺/i,
  /先看它有沒有影響睡眠/i,
  /世界變得太聰明/i,
  /忘了問一句「你餓不餓」/i,
  /不再值得被守護/i,
  /\[ABORT_CONVERSATION\]/i,
  /\[LEAVE\]/i,
  /fallback/i,
  /deterministic/i,
];

const LEGACY_CHARACTER_PATTERNS = [/CaoCao|Cao Cao|曹操/g, /Liu Bei|LiuBei|劉備/g];
const CORE_NAMES = ['Alan', 'Umi', '海', 'Mahiru', '真晝', 'Tianze', '天澤'];
const IMPORT_CANDIDATE_RE = /Alan|Umi|海|Mahiru|真晝|Tianze|天澤|休息|約定|答應|記得|不是依賴，是喜歡|咖哩|簡報|責任|清單|昨天|明天/;
const CURATED_RESTORE_CANDIDATE_KINDS = new Set([
  'memories',
  'school_timeline',
  'notifications',
  'alan_behavior_profiles',
]);
const RAW_EVIDENCE_ONLY_KINDS = new Set([
  'messages',
  'archived_conversations',
  'participated_together',
  'school_world_pressure',
  'agent_descriptions',
  'player_descriptions',
]);

if (args.flags.has('self-test')) {
  runSelfTest();
  process.exit(0);
}

const inDir = args.values.get('in-dir') ?? DEFAULT_IN_DIR;
const outPath = args.values.get('out') ?? DEFAULT_OUT;
if (!existsSync(join(inDir, 'manifest.json'))) {
  throw new Error(`continuity package manifest not found: ${join(inDir, 'manifest.json')}`);
}

const audit = auditPackage(inDir);
const report = buildReport(audit);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, report, 'utf8');
console.log(
  `[underworld-continuity-package-audit] verdict=${audit.verdict} exported=${audit.totalExported} high_risk=${audit.highRiskCount}`,
);
console.log(`[underworld-continuity-package-audit] report=${relative(REPO_ROOT, outPath)}`);

function auditPackage(packageDir) {
  const manifest = JSON.parse(readFileSync(join(packageDir, 'manifest.json'), 'utf8'));
  const rows = [];
  for (const [kind, filename] of Object.entries(manifest.files ?? {})) {
    const filePath = join(packageDir, filename);
    if (!existsSync(filePath)) continue;
    for (const line of readLines(filePath)) {
      if (!line.trim()) continue;
      rows.push({ kind, record: JSON.parse(line) });
    }
  }

  const byKind = new Map();
  const fallbackHits = [];
  const legacyHits = [];
  const alanRelated = [];
  const coreCandidateRows = [];
  const importNever = [];
  for (const item of rows) {
    byKind.set(item.kind, (byKind.get(item.kind) ?? 0) + 1);
    const text = searchableText(item.record.doc);
    for (const pattern of FALLBACK_PATTERNS) {
      if (pattern.test(text)) {
        fallbackHits.push({ ...item, pattern: pattern.source, preview: previewText(text) });
        break;
      }
    }
    for (const pattern of LEGACY_CHARACTER_PATTERNS) {
      if (pattern.test(text)) {
        legacyHits.push({ ...item, pattern: pattern.source, preview: previewText(text) });
        break;
      }
    }
    if (text.includes('Alan')) alanRelated.push({ ...item, preview: previewText(text) });
    if (
      CURATED_RESTORE_CANDIDATE_KINDS.has(item.kind) &&
      CORE_NAMES.some((name) => text.includes(name)) &&
      IMPORT_CANDIDATE_RE.test(text)
    ) {
      coreCandidateRows.push({ ...item, preview: previewText(text) });
    }
    if (RAW_EVIDENCE_ONLY_KINDS.has(item.kind)) {
      importNever.push(item);
    }
  }

  const highRiskCount = fallbackHits.length + legacyHits.length;
  const missingArchivedConversations = Number(manifest.totals?.archived_conversations ?? 0) === 0;
  const verdict =
    highRiskCount > 0 || missingArchivedConversations
      ? 'REVIEW_REQUIRED'
      : 'EXPORT_PACKAGE_USABLE_AS_EVIDENCE';

  return {
    generatedAt: new Date().toISOString(),
    packageDir,
    manifest,
    totalExported: rows.length,
    byKind: Object.fromEntries([...byKind.entries()].sort(([a], [b]) => a.localeCompare(b))),
    fallbackHits,
    legacyHits,
    fallbackHitsByKind: countByKind(fallbackHits),
    legacyHitsByKind: countByKind(legacyHits),
    alanRelated,
    coreCandidateRows,
    importNeverCount: importNever.length,
    missingArchivedConversations,
    highRiskCount,
    verdict,
  };
}

function buildReport(audit) {
  const lines = [
    '# Underworld Continuity Package Audit',
    '',
    `Generated: ${audit.generatedAt}`,
    `Package: \`${audit.packageDir}\``,
    `Verdict: ${audit.verdict}`,
    '',
    'Read-only. This audits an exported JSONL package; it does not read or mutate Convex sqlite.',
    '',
    '## Totals',
    '',
    `- Total exported rows read: ${audit.totalExported}`,
    `- Manifest rows scanned: ${audit.manifest.rowsScanned}`,
    `- Manifest skipped: ${audit.manifest.skipped}`,
    `- High-risk text hits: ${audit.highRiskCount}`,
    `- Alan-related rows: ${audit.alanRelated.length}`,
    `- Core candidate rows: ${audit.coreCandidateRows.length}`,
    `- Rows that should not be directly imported: ${audit.importNeverCount}`,
    '',
    '| Kind | Rows |',
    '|---|---:|',
    ...Object.entries(audit.byKind).map(([kind, count]) => `| ${kind} | ${count} |`),
    '',
    '## Findings',
    '',
    audit.missingArchivedConversations
      ? '- FAIL: no archived conversations were exported; export classifier is incomplete.'
      : '- PASS: archived conversations are present in the package.',
    audit.fallbackHits.length
      ? `- WARN: ${audit.fallbackHits.length} fallback/pollution-like text hits need review before import.`
      : '- PASS: no fallback/pollution pattern hits found by the current deterministic scan.',
    audit.legacyHits.length
      ? `- WARN: ${audit.legacyHits.length} legacy-character hits (CaoCao/Liu Bei family) need alias/remap review.`
      : '- PASS: no legacy-character pattern hits found by the current deterministic scan.',
    '',
    '## Fallback / Pollution Samples',
    '',
    ...kindCountBullets(audit.fallbackHitsByKind),
    '',
    ...sampleBullets(audit.fallbackHits),
    '',
    '## Legacy Character Samples',
    '',
    ...kindCountBullets(audit.legacyHitsByKind),
    '',
    ...sampleBullets(audit.legacyHits),
    '',
    '## Candidate Restoration Policy',
    '',
    '- Do not directly import raw `messages`, `archived_conversations`, `participated_together`, `school_world_pressure`, `agent_descriptions`, or `player_descriptions` rows into live runtime tables.',
    '- Use raw rows as evidence to produce curated summaries or legacy evidence records.',
    '- First restoration subset should be Alan/Umi/Mahiru/Tianze `memories`, `school_timeline`, selected `notifications`, and Alan behavior notes only, after pollution review.',
    '- Any imported record must keep `legacyArchive: true`, source db path/tableId/ts, and must not count as fresh v0.1 sample evidence.',
    '',
    '## Core Candidate Samples',
    '',
    ...sampleBullets(audit.coreCandidateRows, 20),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function sampleBullets(items, limit = 12) {
  if (!items.length) return ['- none'];
  return items.slice(0, limit).map((item) => `- ${item.kind}: ${escapeLine(item.preview)}`);
}

function kindCountBullets(counts) {
  const entries = Object.entries(counts);
  if (!entries.length) return ['- by kind: none'];
  return [`- by kind: ${entries.map(([kind, count]) => `${kind}=${count}`).join(', ')}`];
}

function countByKind(items) {
  const counts = {};
  for (const item of items) counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function searchableText(doc) {
  const fields = [];
  collectText(doc, fields);
  return fields.join('\n');
}

function collectText(value, out) {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectText(item, out);
  }
}

function previewText(text) {
  return text.replace(/\s+/g, ' ').slice(0, 240);
}

function escapeLine(text) {
  return String(text ?? '').replace(/\n/g, ' ').replace(/\|/g, '\\|');
}

function readLines(path) {
  return readFileSync(path, 'utf8').split(/\n/);
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
  const fallbackText = searchableText({ description: '我懂。這種感覺需要先試著感受。' });
  if (!FALLBACK_PATTERNS.some((pattern) => pattern.test(fallbackText))) {
    throw new Error('fallback pattern self-test failed');
  }
  const cleanText = searchableText({ description: '海記得 Alan 說「不是依賴，是喜歡」。' });
  if (!IMPORT_CANDIDATE_RE.test(cleanText)) throw new Error('candidate regex self-test failed');
  console.log('[underworld-continuity-package-audit:self-test] PASS');
}

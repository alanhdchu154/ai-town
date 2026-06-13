#!/usr/bin/env node
// Build a small, human-reviewable candidate packet from an exported Underworld
// continuity package. This is read-only and never imports into Convex.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_IN_DIR = join(REPO_ROOT, 'umi', 'exports', 'archive-continuity-latest');
const DEFAULT_OUT_DIR = join(REPO_ROOT, 'umi', 'exports', 'curated-continuity-candidates-latest');
const DEFAULT_REPORT = join(REPO_ROOT, 'umi', 'reports', 'curated-continuity-candidates-latest.md');

const ELIGIBLE_KINDS = new Set(['memories', 'school_timeline', 'notifications', 'alan_behavior_profiles']);
const EVIDENCE_ONLY_KINDS = new Set([
  'messages',
  'archived_conversations',
  'participated_together',
  'school_world_pressure',
  'agent_descriptions',
  'player_descriptions',
]);

const FALLBACK_PATTERNS = [
  /我懂。這種感覺/i,
  /先看它有沒有影響睡眠/i,
  /世界變得太聰明/i,
  /忘了問一句「你餓不餓」/i,
  /不再值得被守護/i,
  /抱歉，我不能再/i,
  /\[ABORT_CONVERSATION\]/i,
  /\[LEAVE\]/i,
  /fallback/i,
  /deterministic/i,
];
const LEGACY_CHARACTER_PATTERNS = [
  /CaoCao|Cao Cao|曹操/g,
  /Liu Bei|LiuBei|劉備/g,
  /Mai|麻衣/g,
  /Asuna|明日奈/g,
];
const BROAD_LORE_PATTERNS = [/政治|派系|權力|學生會|社會|秩序網絡|規則網絡|立場/g];
const LOW_VALUE_PATTERNS = [
  /我記下這次互動，但不把它誇大/,
  /標籤：ordinary/,
  /先保留作為短期脈絡，不急著寫成人格設定/,
];
const SLOGAN_COLLAPSE_PATTERNS = [
  /簡報只留三件事/,
  /誰沒吃早餐、誰說自己沒事、誰需要先被安靜陪一下/,
  /這段對話留下了選擇，不只是漂亮話/,
  /不只被記住，也轉化成後續可能執行的行動/,
  /把 Alan 今天最需要先看見的三個生活狀態整理出來/,
];
const STAGE_DIRECTION_LEAK_PATTERNS = [
  /「[^」]*(?:我笑著|我退後|我合上|我放下|我看向|我走到|我把|我靠|我拿起|我坐下|我站起|眼神|退後半步)[^」]*」/,
  /」[^「。]{0,48}(?:我笑著|我退後|我合上|我放下|我看向|我走到|我把|我靠|我拿起|我坐下|我站起|眼神|退後半步)/,
];
const FOOD_MOTIF_RE = /咖哩|便當|飯涼|沒吃|熱茶|冷茶|熱牛奶|冷咖啡|飯糰|餐盤|食堂|午餐|早餐/;
const FATIGUE_MOTIF_RE = /累|疲倦|安靜|沒說完|硬撐|發呆|嘆氣|手在抖|沒睡|休息/;

const CORE_PATTERNS = [
  [/Alan/g, 6],
  [/Umi|海/g, 5],
  [/Mahiru|真晝/g, 5],
  [/Tianze|天澤/g, 4],
  [/Asuna|明日奈/g, 3],
  [/Ichinose|一之瀨/g, 3],
  [/Maomao|貓貓/g, 2],
  [/Sakiko|祥子/g, 2],
];
const CONTINUITY_PATTERNS = [
  [/不是依賴，是喜歡/g, 12],
  [/答應|約定|承諾/g, 7],
  [/記得|想起|上次|昨天|明天/g, 5],
  [/休息|疲倦|累|安靜|沒說完/g, 4],
  [/簡報|責任|清單|交接|咖哩/g, 4],
  [/留下|餘波|後來|下一次|接下來/g, 3],
];

const args = parseArgs(process.argv.slice(2));
if (args.flags.has('self-test')) {
  runSelfTest();
  process.exit(0);
}

const inDir = args.values.get('in-dir') ?? DEFAULT_IN_DIR;
const outDir = args.values.get('out-dir') ?? DEFAULT_OUT_DIR;
const reportPath = args.values.get('report') ?? DEFAULT_REPORT;
const limitPerBucket = Number(args.values.get('limit-per-bucket') ?? 80);

if (!existsSync(join(inDir, 'manifest.json'))) {
  throw new Error(`continuity package manifest not found: ${join(inDir, 'manifest.json')}`);
}

const packet = buildCandidatePacket({ inDir, limitPerBucket });
writePacket({ packet, outDir, reportPath });

console.log(
  `[underworld-continuity-restore-candidates] tier1=${packet.tier1.length} review=${packet.reviewOnly.length} rejected=${packet.rejected.length}`,
);
console.log(`[underworld-continuity-restore-candidates] out=${relative(REPO_ROOT, outDir)}`);
console.log(`[underworld-continuity-restore-candidates] report=${relative(REPO_ROOT, reportPath)}`);

function buildCandidatePacket({ inDir: packageDir, limitPerBucket: limit }) {
  const manifest = JSON.parse(readFileSync(join(packageDir, 'manifest.json'), 'utf8'));
  const rows = readPackageRows(packageDir, manifest);
  const pollutedConversationIds = collectPollutedConversationIds(rows);
  const summaries = {
    totalRowsRead: rows.length,
    byKind: {},
    byStatus: {},
    byRisk: {},
  };

  const assessed = [];
  const seen = new Set();
  const motifCounts = new Map();
  for (const row of rows) {
    summaries.byKind[row.kind] = (summaries.byKind[row.kind] ?? 0) + 1;
    const item = assessRow(row, { pollutedConversationIds });
    const dedupeKey = buildDedupeKey(item);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (item.motifFamilyKey) {
      const motifCount = motifCounts.get(item.motifFamilyKey) ?? 0;
      motifCounts.set(item.motifFamilyKey, motifCount + 1);
      if (motifCount > 0) {
        addRisk(item, 'repeated_motif_family');
        item.valueScore -= 8;
        if (item.status === 'tier1_review_candidate') item.status = 'review_only';
      }
    }
    assessed.push(item);
    summaries.byStatus[item.status] = (summaries.byStatus[item.status] ?? 0) + 1;
    for (const risk of item.risks) summaries.byRisk[risk] = (summaries.byRisk[risk] ?? 0) + 1;
  }

  const tier1 = assessed
    .filter((item) => item.status === 'tier1_review_candidate')
    .sort(candidateSort)
    .slice(0, limit);
  const reviewOnly = assessed
    .filter((item) => item.status === 'review_only')
    .sort(candidateSort)
    .slice(0, limit);
  const rejected = assessed
    .filter((item) => item.status === 'reject_or_evidence_only')
    .sort(candidateSort)
    .slice(0, limit);

  return {
    generatedAt: new Date().toISOString(),
    packageDir,
    sourceManifest: {
      generatedAt: manifest.generatedAt,
      dbPath: manifest.dbPath,
      totals: manifest.totals,
      rowsScanned: manifest.rowsScanned,
      skipped: manifest.skipped,
    },
    policy: {
      mode: 'candidate_packet_only_no_import_no_mutation',
      firstImportBoundary: 'Alan approval required; import as curated legacy evidence, not raw prompt-facing memory.',
      freshnessPolicy: 'legacyArchive rows must not count as fresh v0.1 samples.',
    },
    summaries,
    tier1,
    reviewOnly,
    rejected,
  };
}

function readPackageRows(packageDir, manifest) {
  const rows = [];
  for (const [kind, filename] of Object.entries(manifest.files ?? {})) {
    const filePath = join(packageDir, filename);
    if (!existsSync(filePath)) continue;
    for (const line of readLines(filePath)) {
      if (!line.trim()) continue;
      rows.push({ kind, record: JSON.parse(line) });
    }
  }
  return rows;
}

function assessRow(row, { pollutedConversationIds = new Set() } = {}) {
  const doc = row.record.doc ?? {};
  const text = restoreRelevantText(row.kind, doc);
  const normalizedText = normalizeText(text);
  const risks = [];
  const conversationIds = collectConversationIds(doc, text);

  addPatternRisk({ risks, text, patterns: FALLBACK_PATTERNS, risk: 'fallback_or_pollution_text' });
  addPatternRisk({ risks, text, patterns: LEGACY_CHARACTER_PATTERNS, risk: 'legacy_character_name' });
  addPatternRisk({ risks, text, patterns: BROAD_LORE_PATTERNS, risk: 'broad_lore_or_politics' });
  addPatternRisk({ risks, text, patterns: LOW_VALUE_PATTERNS, risk: 'low_value_generic_memory' });
  addPatternRisk({ risks, text, patterns: SLOGAN_COLLAPSE_PATTERNS, risk: 'slogan_or_repeated_motif' });
  addPatternRisk({ risks, text, patterns: STAGE_DIRECTION_LEAK_PATTERNS, risk: 'stage_direction_leak' });
  if (conversationIds.some((id) => pollutedConversationIds.has(id))) {
    risks.push('pollution_adjacent_conversation');
  }
  if (EVIDENCE_ONLY_KINDS.has(row.kind)) risks.push('raw_evidence_only_kind');
  if (!ELIGIBLE_KINDS.has(row.kind)) risks.push('not_first_restore_kind');
  if (normalizedText.length < 24) risks.push('too_short_to_restore');

  const valueScore = scoreContinuity({ row, text, risks });
  let status = 'review_only';
  if (risks.includes('fallback_or_pollution_text')) {
    status = 'reject_or_evidence_only';
  } else if (risks.includes('pollution_adjacent_conversation')) {
    status = 'review_only';
  } else if (risks.includes('raw_evidence_only_kind') || risks.includes('not_first_restore_kind')) {
    status = 'reject_or_evidence_only';
  } else if (
    risks.includes('low_value_generic_memory') ||
    risks.includes('broad_lore_or_politics') ||
    risks.includes('slogan_or_repeated_motif') ||
    risks.includes('stage_direction_leak') ||
    row.kind === 'alan_behavior_profiles' ||
    row.kind === 'notifications' ||
    risks.includes('legacy_character_name')
  ) {
    status = 'review_only';
  } else if (valueScore >= 12) {
    status = 'tier1_review_candidate';
  }

  const createdAt = Number(doc.createdAt ?? doc.createdAtUnix ?? doc._creationTime ?? 0);
  return {
    status,
    kind: row.kind,
    valueScore,
    risks,
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : undefined,
    createdAtIso: doc.createdAtIso ?? (createdAt > 0 ? new Date(createdAt).toISOString() : undefined),
    sourceId: doc._id ?? doc.eventId ?? doc.notificationId ?? row.record.source?.ts,
    source: row.record.source,
    suggestedRestoreShape: suggestedRestoreShape(row.kind),
    conversationIds,
    residueDedupeKey: residueDedupeKey(normalizedText),
    motifFamilyKey: motifFamilyKey(normalizedText),
    preview: previewText(text),
    normalizedText,
  };
}

function scoreContinuity({ row, text, risks }) {
  let score = 0;
  for (const [pattern, value] of CORE_PATTERNS) {
    if (pattern.test(text)) score += value;
    pattern.lastIndex = 0;
  }
  for (const [pattern, value] of CONTINUITY_PATTERNS) {
    if (pattern.test(text)) score += value;
    pattern.lastIndex = 0;
  }
  const importance = Number(row.record.doc?.importance ?? 0);
  if (Number.isFinite(importance)) score += Math.min(importance, 8);
  if (row.kind === 'alan_behavior_profiles') score += 5;
  if (row.kind === 'school_timeline' && row.record.doc?.outcomeQuality === 'concrete_action') score += 4;
  if (row.kind === 'notifications' && row.record.doc?.type === 'emotion_changed') score += 2;
  if (risks.includes('legacy_character_name')) score -= 5;
  if (risks.includes('broad_lore_or_politics')) score -= 4;
  if (risks.includes('low_value_generic_memory')) score -= 8;
  if (risks.includes('slogan_or_repeated_motif')) score -= 10;
  if (risks.includes('stage_direction_leak')) score -= 12;
  if (motifFamilyKey(text)) score -= 6;
  if (risks.includes('pollution_adjacent_conversation')) score -= 14;
  if (risks.includes('fallback_or_pollution_text')) score -= 100;
  return score;
}

function suggestedRestoreShape(kind) {
  if (kind === 'memories') return 'legacyMemorySummary';
  if (kind === 'school_timeline') return 'legacyTimelineEvidence';
  if (kind === 'notifications') return 'legacyStatusEvidence';
  if (kind === 'alan_behavior_profiles') return 'legacyAlanPatternSummary';
  return 'evidenceOnly';
}

function writePacket({ packet, outDir, reportPath }) {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  writeJsonl(join(outDir, 'tier1-review-candidates.jsonl'), packet.tier1);
  writeJsonl(join(outDir, 'review-only-candidates.jsonl'), packet.reviewOnly);
  writeJsonl(join(outDir, 'rejected-or-evidence-only-samples.jsonl'), packet.rejected);
  writeFileSync(join(outDir, 'README.md'), buildReadme(packet), 'utf8');
  writeFileSync(reportPath, buildReport(packet), 'utf8');
}

function buildReadme(packet) {
  return [
    '# Curated Continuity Restore Candidates',
    '',
    `Generated: ${packet.generatedAt}`,
    '',
    'Read-only candidate packet. Nothing in this directory has been imported.',
    '',
    'Files:',
    '',
    '- `tier1-review-candidates.jsonl`: best first human-review candidates.',
    '- `review-only-candidates.jsonl`: possibly useful but risky or noisy.',
    '- `rejected-or-evidence-only-samples.jsonl`: examples that should not be restored directly.',
    '',
    'Import boundary:',
    '',
    '- Alan approval required before any import.',
    '- Import curated summaries or legacy evidence only, not raw dialogue rows.',
    '- Keep `legacyArchive: true` source metadata and exclude from fresh v0.1 eval windows.',
    '',
  ].join('\n');
}

function buildReport(packet) {
  const lines = [
    '# Underworld Curated Continuity Restore Candidates',
    '',
    `Generated: ${packet.generatedAt}`,
    `Package: \`${packet.packageDir}\``,
    '',
    'Read-only. This report selects human-review candidates from the exported legacy package. It does not import or mutate Convex state.',
    '',
    '## Summary',
    '',
    `- Rows read: ${packet.summaries.totalRowsRead}`,
    `- Tier 1 review candidates written: ${packet.tier1.length}`,
    `- Review-only candidates written: ${packet.reviewOnly.length}`,
    `- Rejected/evidence-only samples written: ${packet.rejected.length}`,
    '',
    '## Counts By Kind',
    '',
    tableFromObject(packet.summaries.byKind, 'Kind'),
    '',
    '## Counts By Status',
    '',
    tableFromObject(packet.summaries.byStatus, 'Status'),
    '',
    '## Counts By Risk',
    '',
    tableFromObject(packet.summaries.byRisk, 'Risk'),
    '',
    '## Restore Boundary',
    '',
    '- Do not import raw messages or archived conversations.',
    '- Tier 1 means "human review first", not automatic restore.',
    '- First live import should write curated legacy evidence with provenance, not prompt-facing memory spam.',
    '- Legacy rows must not count as fresh v0.1 evidence.',
    '',
    '## Tier 1 Samples',
    '',
    ...candidateBullets(packet.tier1, 20),
    '',
    '## Review-Only Samples',
    '',
    ...candidateBullets(packet.reviewOnly, 12),
    '',
    '## Reject / Evidence-Only Samples',
    '',
    ...candidateBullets(packet.rejected, 12),
    '',
    '## Next Implementation Task',
    '',
    '- Create an Alan-approved import proposal for a small `legacyContinuityEvidence` record shape.',
    '- Add a dry-run importer that reads `tier1-review-candidates.jsonl`, validates provenance/risk flags, and prints the exact rows it would write.',
    '- Do not write to Convex until Alan approves the import boundary.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function tableFromObject(obj, label) {
  const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return '| ' + label + ' | Count |\n|---|---:|\n| none | 0 |';
  return ['| ' + label + ' | Count |', '|---|---:|', ...entries.map(([key, count]) => `| ${key} | ${count} |`)].join('\n');
}

function candidateBullets(items, limit) {
  if (!items.length) return ['- none'];
  return items.slice(0, limit).map((item) => {
    const risks = item.risks.length ? item.risks.join(', ') : 'none';
    return `- ${item.kind} score=${item.valueScore} risks=${risks}: ${escapeLine(item.preview)}`;
  });
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => `${JSON.stringify(row)}\n`).join(''), 'utf8');
}

function addPatternRisk({ risks, text, patterns, risk }) {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      risks.push(risk);
      pattern.lastIndex = 0;
      return;
    }
    pattern.lastIndex = 0;
  }
}

function restoreRelevantText(kind, doc) {
  if (kind === 'memories') {
    return [doc.description, doc.data?.conversationId, doc.data?.type, ...(doc.data?.playerIds ?? [])]
      .filter(Boolean)
      .join('\n');
  }
  if (kind === 'school_timeline') {
    return [
      doc.actorName,
      doc.targetName,
      doc.descriptionZh,
      doc.futureImplicationsZh,
      doc.interpretationZh,
      doc.reactionDialogueZh,
      doc.locationZh,
      doc.worldTimeLabelZh,
      doc.outcomeQuality,
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (kind === 'notifications') {
    return [
      doc.titleZh,
      doc.contentZh,
      doc.relatedCharacterName,
      doc.type,
      doc.worldTimeLabelZh,
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (kind === 'alan_behavior_profiles') {
    return [
      doc.reflectionZh,
      ...(doc.supportsZh ?? []),
      ...(doc.traits ?? []).map((trait) => `${trait.labelZh ?? ''} ${trait.evidenceZh ?? ''}`),
      ...(doc.timeSpentWith ?? []).map((person) => `${person.displayNameZh ?? ''} ${person.name ?? ''}`),
      ...(doc.trustedCharacters ?? []).map((person) => `${person.displayNameZh ?? ''} ${person.name ?? ''}`),
    ]
      .filter(Boolean)
      .join('\n');
  }
  return searchableText(doc);
}

function collectPollutedConversationIds(rows) {
  const ids = new Set();
  for (const row of rows) {
    const doc = row.record.doc ?? {};
    const text = searchableText(doc);
    if (!patternListMatches(FALLBACK_PATTERNS, text)) continue;
    for (const id of collectConversationIds(doc, text)) ids.add(id);
  }
  return ids;
}

function collectConversationIds(doc, text = '') {
  const ids = new Set();
  if (typeof doc?.conversationId === 'string') ids.add(doc.conversationId);
  if (typeof doc?.data?.conversationId === 'string') ids.add(doc.data.conversationId);
  for (const match of String(text).matchAll(/\bc:\d+\b/g)) ids.add(match[0]);
  return [...ids].sort();
}

function patternListMatches(patterns, text) {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      pattern.lastIndex = 0;
      return true;
    }
    pattern.lastIndex = 0;
  }
  return false;
}

function buildDedupeKey(item) {
  if (item.conversationIds?.length) return `${item.kind}:conversation:${item.conversationIds.join('+')}`;
  if (item.residueDedupeKey) return `${item.kind}:residue:${item.residueDedupeKey}`;
  if (item.motifFamilyKey) return `${item.kind}:motif:${item.motifFamilyKey}:${item.normalizedText.slice(0, 80)}`;
  return `${item.kind}:text:${stableHash(item.normalizedText.slice(0, 260))}`;
}

function residueDedupeKey(text) {
  const match = text.match(/殘留：(.+?)(?:觸發：|記憶層級：|conversation|$)/);
  if (!match) return undefined;
  return stableHash(normalizeText(match[1]).slice(0, 220));
}

function motifFamilyKey(text) {
  if (!FOOD_MOTIF_RE.test(text) || !FATIGUE_MOTIF_RE.test(text)) return undefined;
  const names = [
    text.match(/Alan/) ? 'Alan' : '',
    text.match(/Umi|海/) ? 'Umi' : '',
    text.match(/Mahiru|真晝/) ? 'Mahiru' : '',
    text.match(/Tianze|天澤/) ? 'Tianze' : '',
    text.match(/Asuna|明日奈/) ? 'Asuna' : '',
    text.match(/Ichinose|一之瀨/) ? 'Ichinose' : '',
    text.match(/Mai|麻衣/) ? 'Mai' : '',
  ].filter(Boolean);
  return stableHash(`food-fatigue:${names.sort().join('+') || 'unknown'}`);
}

function stableHash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function addRisk(item, risk) {
  if (!item.risks.includes(risk)) item.risks.push(risk);
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

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function previewText(text) {
  return normalizeText(text).slice(0, 260);
}

function escapeLine(text) {
  return String(text ?? '').replace(/\n/g, ' ').replace(/\|/g, '\\|');
}

function readLines(path) {
  return readFileSync(path, 'utf8').split(/\n/);
}

function candidateSort(a, b) {
  if (b.valueScore !== a.valueScore) return b.valueScore - a.valueScore;
  return Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
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
  const clean = assessRow({
    kind: 'memories',
    record: {
      source: { tableId: 'T', ts: 1, legacyArchive: true },
      doc: {
        _id: 'm1',
        description: '與 Alan 和海的對話：Alan 說不是依賴，是喜歡。海記得這句話，明天要用更短的簡報陪他休息。',
        importance: 7,
      },
    },
  });
  if (clean.status !== 'tier1_review_candidate') {
    throw new Error(`expected tier1 candidate, got ${clean.status}`);
  }
  const fallback = assessRow({
    kind: 'memories',
    record: {
      source: { tableId: 'T', ts: 2, legacyArchive: true },
      doc: { _id: 'm2', description: '嗯，我懂。這種感覺不需要先被審判。先看它有沒有影響睡眠。' },
    },
  });
  if (fallback.status !== 'reject_or_evidence_only') {
    throw new Error(`expected reject for fallback, got ${fallback.status}`);
  }
  const legacy = assessRow({
    kind: 'school_timeline',
    record: {
      source: { tableId: 'T', ts: 3, legacyArchive: true },
      doc: { _id: 't1', descriptionZh: '劉備決定明天午餐找真晝聊學生會政治。', importance: 6 },
    },
  });
  if (!legacy.risks.includes('legacy_character_name') || !legacy.risks.includes('broad_lore_or_politics')) {
    throw new Error('expected legacy and broad-lore risks');
  }
  const polluted = new Set(['c:1']);
  const adjacent = assessRow(
    {
      kind: 'memories',
      record: {
        source: { tableId: 'T', ts: 4, legacyArchive: true },
        doc: {
          _id: 'm3',
          data: { conversationId: 'c:1' },
          description: '與 Alan 的對話：海記得 Alan 說不是依賴，是喜歡。',
          importance: 7,
        },
      },
    },
    { pollutedConversationIds: polluted },
  );
  if (!adjacent.risks.includes('pollution_adjacent_conversation') || adjacent.status !== 'review_only') {
    throw new Error('expected polluted conversation adjacency to downgrade to review_only');
  }
  console.log('[underworld-continuity-restore-candidates:self-test] PASS');
}

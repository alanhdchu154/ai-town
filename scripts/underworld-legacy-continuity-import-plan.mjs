#!/usr/bin/env node
// Produce a dry-run import plan from curated legacy continuity candidates.
//
// This script is deliberately non-mutating. It does not call Convex and does
// not write live memory. It creates the exact legacy evidence rows that a future
// Alan-approved importer may write.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_CANDIDATES = join(
  REPO_ROOT,
  'umi',
  'exports',
  'curated-continuity-candidates-latest',
  'tier1-review-candidates.jsonl',
);
const DEFAULT_OUT_DIR = join(REPO_ROOT, 'umi', 'exports', 'legacy-continuity-import-plan-latest');
const DEFAULT_REPORT = join(REPO_ROOT, 'umi', 'reports', 'legacy-continuity-import-plan-latest.md');
const FIRST_RESTORE_KINDS = new Set(['memories', 'school_timeline']);
const FOOD_CARE_MOTIF_RE = /咖哩|便當|飯涼|沒吃|熱茶|冷茶|熱牛奶|冷咖啡|飯糰|餐盤|食堂|午餐|早餐|吃口飯|吃頓飯|吃完/;

const args = parseArgs(process.argv.slice(2));
if (args.flags.has('self-test')) {
  runSelfTest();
  process.exit(0);
}

const candidatesPath = args.values.get('candidates') ?? DEFAULT_CANDIDATES;
const outDir = args.values.get('out-dir') ?? DEFAULT_OUT_DIR;
const reportPath = args.values.get('report') ?? DEFAULT_REPORT;
const limit = Number(args.values.get('limit') ?? 12);

if (!existsSync(candidatesPath)) {
  throw new Error(`candidate file not found: ${candidatesPath}`);
}

const plan = buildPlan({ candidatesPath, limit });
writePlan({ plan, outDir, reportPath });

console.log(
  `[underworld-legacy-continuity-import-plan] dryRunRows=${plan.rows.length} skipped=${plan.skipped.length}`,
);
console.log(`[underworld-legacy-continuity-import-plan] out=${relative(REPO_ROOT, outDir)}`);
console.log(`[underworld-legacy-continuity-import-plan] report=${relative(REPO_ROOT, reportPath)}`);

function buildPlan({ candidatesPath: path, limit: rowLimit }) {
  const candidates = readLines(path)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const rows = [];
  const skipped = [];
  const seen = new Set();
  const seenMotifs = new Set();

  for (const candidate of candidates) {
    const validation = validateCandidate(candidate);
    if (!validation.ok) {
      skipped.push({ sourceId: candidate.sourceId, kind: candidate.kind, reason: validation.reason });
      continue;
    }
    const row = toDryRunEvidenceRow(candidate);
    const dedupeKey = buildImportDedupeKey(candidate, row);
    if (seen.has(dedupeKey)) {
      skipped.push({ sourceId: candidate.sourceId, kind: candidate.kind, reason: 'duplicate_summary' });
      continue;
    }
    if (candidate.motifFamilyKey) {
      if (seenMotifs.has(candidate.motifFamilyKey)) {
        skipped.push({ sourceId: candidate.sourceId, kind: candidate.kind, reason: 'duplicate_motif_family' });
        continue;
      }
      seenMotifs.add(candidate.motifFamilyKey);
    }
    seen.add(dedupeKey);
    rows.push(row);
    if (rows.length >= rowLimit) break;
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: 'dry_run_only_no_convex_writes',
    candidatesPath: path,
    proposedTarget: 'legacyContinuityEvidence',
    approvalRequired: true,
    rows,
    skipped,
    invariants: [
      'legacyArchive must be true',
      'freshEvalEligible must be false',
      'promptFacing must be false until a later explicit read-path design',
      'raw messages and archived conversations are not imported directly',
      'future importer must run dry-run and require Alan approval before write',
    ],
  };
}

function validateCandidate(candidate) {
  if (!FIRST_RESTORE_KINDS.has(candidate.kind)) {
    return { ok: false, reason: `not_first_restore_kind_${candidate.kind}` };
  }
  if (candidate.motifFamilyKey) {
    return { ok: false, reason: 'motif_family_requires_review' };
  }
  if (FOOD_CARE_MOTIF_RE.test(candidate.normalizedText ?? '')) {
    return { ok: false, reason: 'food_care_motif_requires_review' };
  }
  if (candidate.risks?.includes('stage_direction_leak')) {
    return { ok: false, reason: 'stage_direction_leak_requires_review' };
  }
  if (candidate.status !== 'tier1_review_candidate') {
    return { ok: false, reason: `status_${candidate.status}` };
  }
  if (candidate.risks?.length) {
    return { ok: false, reason: `risk_${candidate.risks.join('_')}` };
  }
  if (!candidate.source?.legacyArchive) {
    return { ok: false, reason: 'missing_legacy_archive_source' };
  }
  if (!candidate.normalizedText || candidate.normalizedText.length < 24) {
    return { ok: false, reason: 'missing_summary_text' };
  }
  return { ok: true };
}

function buildImportDedupeKey(candidate, row) {
  if (candidate.conversationIds?.length) {
    return `${row.sourceKind}:conversation:${candidate.conversationIds.join('+')}`;
  }
  if (candidate.residueDedupeKey) return `${row.sourceKind}:residue:${candidate.residueDedupeKey}`;
  if (candidate.motifFamilyKey) return `${row.sourceKind}:motif:${candidate.motifFamilyKey}`;
  if (row.sourceKind === 'school_timeline') {
    return `${row.sourceKind}:timeline:${canonicalTimelineSummary(row.summaryZh).slice(0, 220)}`;
  }
  return `${row.sourceKind}:summary:${canonicalSummary(row.summaryZh).slice(0, 180)}`;
}

function toDryRunEvidenceRow(candidate) {
  const names = extractNames(candidate.normalizedText);
  return {
    targetRecordKind: 'legacyContinuityEvidence',
    dryRunOnly: true,
    legacyArchive: true,
    freshEvalEligible: false,
    promptFacing: false,
    sourceKind: candidate.kind,
    sourceId: candidate.sourceId,
    sourceTableId: candidate.source?.tableId,
    sourceTs: candidate.source?.ts,
    sourceDbPath: candidate.source?.dbPath,
    sourceCreatedAtIso: candidate.createdAtIso,
    conversationIds: candidate.conversationIds ?? [],
    suggestedRestoreShape: candidate.suggestedRestoreShape,
    residueDedupeKey: candidate.residueDedupeKey,
    motifFamilyKey: candidate.motifFamilyKey,
    valueScore: candidate.valueScore,
    involvedNames: names,
    summaryZh: summarize(candidate.normalizedText),
    restoreReasonZh: restoreReason(candidate),
    reviewRequired: true,
    approvalNoteZh: 'Alan approval required before this can be written to Convex.',
  };
}

function summarize(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 360);
}

function canonicalSummary(text) {
  return String(text ?? '')
    .replace(/Alan|Umi|海|Mahiru Shiina|Mahiru|真晝/g, '')
    .replace(/\b2026\/\d{1,2}\/\d{1,2}\b/g, '')
    .replace(/\b\d{1,2}\/\d{1,2}\/2026\b/g, '')
    .replace(/第\s*\d+\s*(?:週\s*)?第?\s*\d*\s*天/g, '')
    .replace(/(?:上午|下午|晚上|早晨|白天)?\s*\d{1,2}:\d{2}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalTimelineSummary(text) {
  return canonicalSummary(text)
    .replace(/宿舍|教室|餐廳|中央庭院|校長室|AI社團教室/g, '')
    .replace(/[。；，、：:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function restoreReason(candidate) {
  if (candidate.kind === 'memories') {
    return '舊世界的長期候選記憶，可能保留承諾、情緒餘波或關係延續。';
  }
  if (candidate.kind === 'school_timeline') {
    return '舊世界的時間線事件，可能說明某個角色後來為什麼改變行動。';
  }
  if (candidate.kind === 'alan_behavior_profiles') {
    return '舊世界對 Alan 互動習慣的摘要，只能作為低權重背景，不可替 Alan 做決定。';
  }
  if (candidate.kind === 'notifications') {
    return '舊世界的狀態提示，只能作為歷史證據，不可當成今日狀態。';
  }
  return '舊世界 continuity evidence。';
}

function extractNames(text) {
  const pairs = [
    ['Alan', /Alan/g],
    ['Umi', /Umi|海/g],
    ['Mahiru', /Mahiru|真晝|Mahiru Shiina/g],
    ['Asuna', /Asuna|明日奈/g],
    ['Tianze', /Tianze|天澤/g],
    ['Ichinose', /Ichinose|一之瀨/g],
    ['Mai', /Mai|麻衣/g],
    ['Maomao', /Maomao|貓貓/g],
    ['Sakiko', /Sakiko|祥子/g],
  ];
  return pairs.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function writePlan({ plan, outDir, reportPath }) {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  writeFileSync(join(outDir, 'dry-run-legacy-continuity-evidence.jsonl'), plan.rows.map((row) => `${JSON.stringify(row)}\n`).join(''), 'utf8');
  writeFileSync(reportPath, buildReport(plan), 'utf8');
}

function buildReport(plan) {
  const lines = [
    '# Underworld Legacy Continuity Import Plan',
    '',
    `Generated: ${plan.generatedAt}`,
    `Mode: ${plan.mode}`,
    `Candidates: \`${plan.candidatesPath}\``,
    '',
    'This is not an import. It is a dry-run plan for future Alan-approved restoration.',
    '',
    '## Summary',
    '',
    `- Proposed target record: ${plan.proposedTarget}`,
    `- Dry-run rows: ${plan.rows.length}`,
    `- Skipped candidates: ${plan.skipped.length}`,
    `- Approval required: ${plan.approvalRequired ? 'yes' : 'no'}`,
    '',
    '## Invariants',
    '',
    ...plan.invariants.map((item) => `- ${item}`),
    '',
    '## Proposed Rows',
    '',
    ...plan.rows.map((row, index) => {
      const names = row.involvedNames.length ? row.involvedNames.join(', ') : 'unknown';
      return `${index + 1}. ${row.sourceKind} score=${row.valueScore} names=${names}: ${escapeLine(row.summaryZh)}`;
    }),
    '',
    '## Skipped',
    '',
    ...(plan.skipped.length
      ? plan.skipped.slice(0, 20).map((item) => `- ${item.kind} ${item.sourceId}: ${item.reason}`)
      : ['- none']),
    '',
    '## Next Step',
    '',
    '- Ask cc to review this plan after Claude session reset.',
    '- If Alan approves, implement a Convex mutation behind an explicit dry-run/write flag.',
    '- First write target should be a separate legacy evidence table/read path, not direct memory spam.',
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
  const plan = buildPlanFromCandidatesForTest([
    {
      status: 'tier1_review_candidate',
      kind: 'memories',
      valueScore: 30,
      risks: [],
      createdAtIso: '2026-06-01T12:00:00.000Z',
      sourceId: 'm1',
      source: { tableId: 'T', ts: 1, dbPath: '/tmp/archive.sqlite3', legacyArchive: true },
      suggestedRestoreShape: 'legacyMemorySummary',
      normalizedText: 'Alan 和海有一段承諾：海記得 Alan 說不是依賴，是喜歡。',
    },
    {
      status: 'review_only',
      kind: 'memories',
      valueScore: 10,
      risks: ['slogan_or_repeated_motif'],
      sourceId: 'm2',
      source: { legacyArchive: true },
      normalizedText: '海決定明天簡報只留三件事。',
    },
    {
      status: 'tier1_review_candidate',
      kind: 'alan_behavior_profiles',
      valueScore: 30,
      risks: [],
      sourceId: 'p1',
      source: { tableId: 'T', ts: 3, dbPath: '/tmp/archive.sqlite3', legacyArchive: true },
      suggestedRestoreShape: 'legacyAlanPatternSummary',
      normalizedText: 'Alan 最近似乎越來越偏向反思與整理。這不是世界替他做決定。',
    },
  ]);
  if (plan.rows.length !== 1) throw new Error(`expected 1 dry-run row, got ${plan.rows.length}`);
  if (plan.rows[0].freshEvalEligible !== false || plan.rows[0].promptFacing !== false) {
    throw new Error('dry-run row must be non-fresh and non-prompt-facing');
  }
  console.log('[underworld-legacy-continuity-import-plan:self-test] PASS');
}

function buildPlanFromCandidatesForTest(candidates) {
  const tempPath = '<self-test>';
  const rows = [];
  const skipped = [];
  for (const candidate of candidates) {
    const validation = validateCandidate(candidate);
    if (!validation.ok) {
      skipped.push({ sourceId: candidate.sourceId, kind: candidate.kind, reason: validation.reason });
      continue;
    }
    rows.push(toDryRunEvidenceRow(candidate));
  }
  return {
    generatedAt: new Date().toISOString(),
    mode: 'dry_run_only_no_convex_writes',
    candidatesPath: tempPath,
    proposedTarget: 'legacyContinuityEvidence',
    approvalRequired: true,
    rows,
    skipped,
    invariants: [],
  };
}

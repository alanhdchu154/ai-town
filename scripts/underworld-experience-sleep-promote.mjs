#!/usr/bin/env node
// Promote bounded experience logs into sleepNotes.
//
// Default mode is dry-run. With --write and the explicit approval token, this
// promotes at most one meaningful experience residue per character per local
// day. It never imports transcripts and never writes to memories/profiles.

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'experience-sleep-promotion-latest.md');
const OUT_DIR = join(REPO_ROOT, 'umi', 'exports', 'experience-sleep-promotion-latest');
const APPROVAL = 'alan-approved-sleep-notes-2026-06-12';
const TIME_ZONE = 'America/Chicago';
const MAX_PROMOTIONS_PER_CHARACTER_PER_DAY = 1;
const PILOT_SUBJECTS = new Set(['海', '真晝', '貓貓', '天澤', '一之瀨', '祥子']);

const args = parseArgs(process.argv.slice(2));
const SELF_TEST = args.flags.has('self-test');
const WRITE = args.flags.has('write');
const approval = args.values.get('approval') ?? '';

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

const worldStatus = await convexRun('world:defaultWorldStatus', {});
const worldId = worldStatus?.worldId;
if (!worldId) throw new Error('default worldId not found');

const experienceLogs = await convexRun('agent/experienceLog:recentExperienceLogs', {
  worldId,
  limit: 100,
});
const rows = buildSleepNoteRows(experienceLogs, Date.now());
const validation = validateRows(rows);
if (!validation.ok) {
  throw new Error(`experience sleep promotion validation failed:\n${validation.errors.join('\n')}`);
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

writeOutputs({
  rows,
  writeResult,
  logsRead: experienceLogs.length,
  subjectiveLogsRead: experienceLogs.filter(isSubjectiveExperienceLog).length,
});
console.log(
  `[experience-sleep-promote] mode=${WRITE ? 'write' : 'dry-run'} logs=${experienceLogs.length} rows=${rows.length} inserted=${writeResult?.inserted ?? 0} skipped=${writeResult?.skipped ?? 0}`,
);
console.log(`[experience-sleep-promote] report=${relative(REPO_ROOT, REPORT_PATH)}`);

function buildSleepNoteRows(logs, now) {
  const localDate = localDateKey(now);
  const byCharacter = new Map();
  for (const log of logs) {
    if (!PILOT_SUBJECTS.has(log.characterName)) continue;
    if (!meaningfulForSleep(log)) continue;
    const current = byCharacter.get(log.characterName);
    if (!current || rankLog(log) > rankLog(current)) byCharacter.set(log.characterName, log);
  }
  return [...byCharacter.values()]
    .slice(0, PILOT_SUBJECTS.size)
    .map((log) => {
      const noteZh = noteFromLog(log);
      return {
        sourceKind: 'experienceLog',
        sourceEvidenceId: `experienceLog:${localDate}:${log.characterName}`,
        sourceConversationId: log.conversationId,
        legacyArchive: false,
        promptFacing: true,
        freshEvalEligible: true,
        reviewStatus: 'promoted',
        noteType: log.importance === 'high' ? 'long_term_memory_candidate' : 'emotional_residue_candidate',
        subjectName: log.characterName,
        participantNames: unique([log.characterName, ...(log.involvedCharacters ?? [])]),
        noteZh,
        usageHintZh: usageFromLog(log),
        riskTags: [],
        motifHash: motifHash(`${log.characterName}:${noteZh}`),
        importance: log.importance === 'high' ? 8 : 6,
        createdAt: log.timestamp ?? now,
        updatedAt: now,
        promotedAt: now,
        promotedBy: 'experience-sleep-promote',
        approvalNoteZh: 'Promoted from bounded experienceLogs as the v0.1 sleep/tomorrow bridge.',
      };
    })
    .slice(0, PILOT_SUBJECTS.size * MAX_PROMOTIONS_PER_CHARACTER_PER_DAY);
}

function meaningfulForSleep(log) {
  if (!log?.characterName || !PILOT_SUBJECTS.has(log.characterName)) return false;
  if (!isSubjectiveExperienceLog(log)) return false;
  if (log.importance === 'low') return false;
  return Boolean(log.residue || log.behaviorHint || log.beliefSeed);
}

function isSubjectiveExperienceLog(log) {
  const summary = cleanText(log?.eventSummary);
  if (!summary || !log?.characterName) return false;
  if (!summary.startsWith(`對${log.characterName}來說`)) return false;
  if (/^[^：]{1,12}與[^：]{1,12}：/.test(summary)) return false;
  if (/留下了一段短記憶|進行了一段短暫對話|短暫對話|objective|event summary/i.test(summary)) {
    return false;
  }
  return true;
}

function rankLog(log) {
  const importance = log.importance === 'high' ? 3 : log.importance === 'medium' ? 2 : 1;
  const residue = log.residue ? 1 : 0;
  const behavior = log.behaviorHint ? 1 : 0;
  return importance * 10 + residue * 2 + behavior;
}

function noteFromLog(log) {
  const residue = cleanText(log.residue);
  if (residue) return clip(residue, 120);
  const interpretation = cleanText(log.emotionalInterpretation);
  if (interpretation) return clip(interpretation, 120);
  return clip(cleanText(log.eventSummary), 120);
}

function usageFromLog(log) {
  const behavior = cleanText(log.behaviorHint);
  if (behavior && /Alan|校長/i.test(behavior)) {
    return clip(
      `只讓它影響下一次面對${log.otherCharacterName ?? '對方'}時是否先確認對方的負擔；不要把 Alan 當成話題重複。`,
      120,
    );
  }
  if (behavior) return clip(`讓它影響下一次面對對方時的語氣或小行動：${behavior}`, 120);
  const seed = cleanText(log.beliefSeed);
  if (seed) return clip(`只讓它影響注意力，不要逐字提起：${seed}`, 120);
  return '只讓它影響注意力、語氣長短或是否主動靠近；不要逐字提起。';
}

function validateRows(rows) {
  const errors = [];
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    const prefix = `row ${index + 1} ${row.subjectName}`;
    if (!PILOT_SUBJECTS.has(row.subjectName)) errors.push(`${prefix}: non-pilot subject`);
    if (row.sourceKind !== 'experienceLog') errors.push(`${prefix}: sourceKind must be experienceLog`);
    if (row.legacyArchive !== false) errors.push(`${prefix}: experience sleep note must not be legacyArchive`);
    if (row.freshEvalEligible !== true) errors.push(`${prefix}: current experience note must be fresh eval evidence`);
    if (row.reviewStatus !== 'promoted' || row.promptFacing !== true) {
      errors.push(`${prefix}: promoted prompt-facing note required`);
    }
    if (row.noteZh.length < 8 || row.noteZh.length > 150) errors.push(`${prefix}: note length out of range`);
    if (row.usageHintZh.length < 8 || row.usageHintZh.length > 140) {
      errors.push(`${prefix}: usage hint length out of range`);
    }
    const perDay = row.sourceEvidenceId;
    if (seen.has(perDay)) errors.push(`${prefix}: duplicate per-day promotion key`);
    seen.add(perDay);
  }
  return { ok: errors.length === 0, errors };
}

async function convexRun(functionName, payload) {
  const { stdout } = await execFileAsync(
    'npx',
    ['convex', 'run', '--typecheck', 'disable', '--codegen', 'disable', functionName, JSON.stringify(payload)],
    { cwd: REPO_ROOT, timeout: 180_000, maxBuffer: 1024 * 1024 * 16 },
  );
  const trimmed = stdout.trim();
  const starts = [trimmed.indexOf('{'), trimmed.indexOf('[')].filter((index) => index >= 0);
  const jsonStart = starts.length ? Math.min(...starts) : -1;
  if (jsonStart < 0) return null;
  return JSON.parse(trimmed.slice(jsonStart));
}

function writeOutputs({ rows, writeResult, logsRead, subjectiveLogsRead }) {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(join(OUT_DIR, 'sleep-note-promotions.jsonl'), rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
  writeFileSync(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: WRITE ? 'write' : 'dry-run',
        logsRead,
        subjectiveLogsRead,
        rows: rows.length,
        writeResult,
      },
      null,
      2,
    ),
  );
  writeFileSync(REPORT_PATH, buildReport({ rows, writeResult, logsRead, subjectiveLogsRead }), 'utf8');
}

function buildReport({ rows, writeResult, logsRead, subjectiveLogsRead }) {
  const lines = [
    '# Underworld Experience Sleep Promotion',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${WRITE ? 'write' : 'dry-run'}`,
    `Experience logs read: ${logsRead}`,
    `Subjective-shaped logs eligible: ${subjectiveLogsRead}`,
    `Rows prepared: ${rows.length}`,
    `Inserted: ${writeResult?.inserted ?? 0}`,
    `Skipped: ${writeResult?.skipped ?? 0}`,
    '',
    '## Candidate Sleep Notes',
    '',
  ];
  if (!rows.length) lines.push('- none');
  for (const row of rows) {
    lines.push(`- ${row.subjectName}: ${row.noteZh}`);
    lines.push(`  - use: ${row.usageHintZh}`);
    lines.push(`  - source: ${row.sourceEvidenceId}; conversation=${row.sourceConversationId ?? 'unknown'}; freshEvalEligible=${row.freshEvalEligible}`);
  }
  lines.push('');
  lines.push('## Policy');
  lines.push('');
  lines.push('- At most one promoted sleep note per pilot character per local day.');
  lines.push('- Only subjective-shaped experience logs (`對某某來說...`) may promote.');
  lines.push('- No raw transcripts, memories, profiles, or embeddings are written.');
  lines.push('- Promoted notes from current experience logs are fresh eval evidence.');
  lines.push('- Legacy / old-world sleep notes remain freshEvalEligible=false in the legacy import path.');
  return `${lines.join('\n')}\n`;
}

function runSelfTest() {
  const now = Date.UTC(2026, 5, 12, 21, 0, 0);
  if (!isSubjectiveExperienceLog(sampleLog('海', 'high', '海記得真晝沒有催她。', '下次少接一件事。'))) {
    console.error('[experience-sleep-promote:self-test] FAIL subjective log was not eligible');
    process.exit(1);
  }
  if (
    isSubjectiveExperienceLog({
      ...sampleLog('海', 'high', '海記得真晝沒有催她。', '下次少接一件事。'),
      eventSummary: '海與真晝：兩人留下了一段短記憶。',
    })
  ) {
    console.error('[experience-sleep-promote:self-test] FAIL objective-shaped log was eligible');
    process.exit(1);
  }
  const rows = buildSleepNoteRows(
    [
      sampleLog('海', 'high', '海記得真晝沒有催她，只是讓她先停一下。', '下次先少接一件事。'),
      sampleLog('海', 'high', '海又想把事情接回自己手上。', '先停一下。'),
      sampleLog('真晝', 'medium', '真晝記得海今天沒有完全接住照顧。', ''),
      sampleLog('天澤', 'high', '天澤記得一之瀨把溫柔收回去的方式。', '下次先問清楚底線，不要只測試。'),
      sampleLog('一之瀨', 'medium', '一之瀨記得貓貓把善意看成症狀。', ''),
      sampleLog('貓貓', 'medium', '貓貓記得真晝沒有把沉默當成沒事。', '下次先看停頓，不急著診斷。'),
      sampleLog('祥子', 'medium', '祥子記得天澤沒有把她的停頓說破。', '下次先守住姿態，再決定要不要說真話。'),
      sampleLog('明日奈', 'high', '明日奈不是目前 live evidence pilot。', ''),
      {
        ...sampleLog('海', 'high', '海記得真晝沒有催她。', '下次少接一件事。'),
        eventSummary: '海與真晝：兩人留下了一段短記憶。',
      },
    ],
    now,
  );
  const validation = validateRows(rows);
  if (!validation.ok) {
    console.error(`[experience-sleep-promote:self-test] FAIL\n${validation.errors.join('\n')}`);
    process.exit(1);
  }
  const triggerRow = buildSleepNoteRows(
    [
      sampleLog(
        '海',
        'medium',
        '海記得天澤差點把玩笑收起來。 觸發：Alan。',
        '把 Alan 的擔心留在自己心裡前，先問對方一次。',
      ),
    ],
    now,
  )[0];
  if (!triggerRow || /觸發|Alan/.test(triggerRow.noteZh) || !/不要把 Alan 當成話題重複/.test(triggerRow.usageHintZh)) {
    console.error('[experience-sleep-promote:self-test] FAIL trigger metadata/generic Alan hint was not cleaned');
    process.exit(1);
  }
  const subjects = rows.map((row) => row.subjectName).sort();
  if (subjects.join(',') !== '一之瀨,天澤,海,真晝,祥子,貓貓') {
    console.error(`[experience-sleep-promote:self-test] FAIL unexpected subjects: ${subjects.join(',')}`);
    process.exit(1);
  }
  console.log('[experience-sleep-promote:self-test] PASS');
}

function sampleLog(characterName, importance, residue, behaviorHint) {
  return {
    characterName,
    otherCharacterName: '真晝',
    eventSummary: `對${characterName}來說，真晝留下的是一個需要明天再確認的反應。`,
    emotionalInterpretation: `${characterName} 心裡留下了一點餘波。`,
    residue,
    beliefSeed: '',
    behaviorHint,
    importance,
    involvedCharacters: [characterName, '真晝'],
    day: 25,
    timestamp: Date.UTC(2026, 5, 12, 21, 0, 0),
    conversationId: `conversation-${characterName}`,
  };
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/(?:^|[\s。；;])觸發[:：][^。；;\n]+[。；;]?/g, ' ')
    .replace(/(?:^|[\s。；;])trigger[:：][^。；;\n]+[。；;]?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(value, max) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function motifHash(text) {
  return createHash('sha256').update(text.replace(/\s+/g, '')).digest('hex').slice(0, 16);
}

function localDateKey(timestamp) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
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

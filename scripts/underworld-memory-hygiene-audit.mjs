#!/usr/bin/env node
// Read-only memory hygiene audit.
//
// Scans every pilot character's recent memories and flags likely pollution:
//   1. known fabrication fragments (the 6/4 「世界變得太聰明」 family, extendable
//      via --fragment="...", repeatable),
//   2. legacy-format memories (en-US dates / UTC era, pre zh-TW convention),
//   3. Alan-quote claims with no support in the archived Alan transcripts
//      ("unverified", NOT proven false — archive coverage is bounded),
//   4. memories already marked recall-corrected (for visibility).
//
// Principle: subjective feelings may be wrong (that is human); objective facts
// about Alan (what he said, what was promised, which day) must not be. This
// script never writes to Convex; cleanup happens manually via
// `npx convex run school:downweightFalseMemory '{"characterName":...,"fragment":...,"dryRun":true}'`.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative as relativePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'memory-hygiene-latest.md');

const RECALL_CORRECTED_MARKER = '〔此記憶曾被對方糾正，內容不可靠〕';
const DEFAULT_KNOWN_FRAGMENTS = [
  '世界變得太聰明',
  '忘了問一句「你餓不餓」',
  '不再值得被守護',
];
// Same claim shapes as claimedRecallFragmentsFromMessages in convex/agent/memory.ts.
const CLAIM_PATTERN = /(?:我記得|我們談過|你曾說|你說過|你提過|Alan ?說過?)+[，,：:]?「?([^。！？!?\n「」]{6,40})/g;
const LEGACY_FORMAT_PATTERN = /\b\d{1,2}\/\d{1,2}\/\d{4}\b|[AP]M\b|GMT|UTC/;

const args = parseArgs(process.argv.slice(2));
if (args.flags.has('self-test')) {
  runSelfTest();
  process.exit(0);
}

const knownFragments = [...DEFAULT_KNOWN_FRAGMENTS, ...args.fragments];
const exportData = await convexRun('school:exportPilotMemoriesForAudit', {
  perCharacter: 300,
});
const transcriptData = await convexRun('school:recentConversationEvalData', {
  timeZone: 'America/Chicago',
  limit: 200,
  compact: false,
  messagesPerConversation: 20,
});
const alanTranscriptText = collectAlanTranscriptText(transcriptData);

const results = (exportData?.characters ?? []).map((character) =>
  auditCharacter(character, { knownFragments, alanTranscriptText }),
);
const report = buildReport(results);
await mkdir(dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, report, 'utf8');
const totals = results.reduce(
  (acc, item) => ({
    fragments: acc.fragments + item.knownFragmentHits.length,
    legacy: acc.legacy + item.legacyFormat.length,
    unverified: acc.unverified + item.unverifiedClaims.length,
    marked: acc.marked + item.alreadyMarked,
  }),
  { fragments: 0, legacy: 0, unverified: 0, marked: 0 },
);
console.log(
  `[memory-hygiene] fragments=${totals.fragments} legacy=${totals.legacy} unverified_alan_claims=${totals.unverified} already_marked=${totals.marked}`,
);
console.log(`[memory-hygiene] report=${relativePath(REPO_ROOT, REPORT_PATH)}`);

function auditCharacter(character, { knownFragments: fragments, alanTranscriptText: archive }) {
  const knownFragmentHits = [];
  const legacyFormat = [];
  const unverifiedClaims = [];
  let alreadyMarked = 0;
  for (const memory of character.memories ?? []) {
    const description = memory.description ?? '';
    if (description.includes(RECALL_CORRECTED_MARKER)) {
      alreadyMarked += 1;
      continue;
    }
    const fragmentHit = fragments.find((fragment) => description.includes(fragment));
    if (fragmentHit) {
      knownFragmentHits.push({ memory, fragment: fragmentHit });
    }
    if (LEGACY_FORMAT_PATTERN.test(description)) {
      legacyFormat.push({ memory });
    }
    if (memory.aboutAlan) {
      for (const claim of claimedFragments(description)) {
        if (!claimSupported(claim, archive)) {
          unverifiedClaims.push({ memory, claim });
          break; // one flag per memory is enough
        }
      }
    }
  }
  return { name: character.name, total: (character.memories ?? []).length, knownFragmentHits, legacyFormat, unverifiedClaims, alreadyMarked };
}

export function claimedFragments(text) {
  const fragments = [];
  for (const match of text.matchAll(CLAIM_PATTERN)) {
    const fragment = match[1].trim();
    if (fragment.length >= 6 && !fragments.includes(fragment)) fragments.push(fragment);
  }
  return fragments;
}

export function claimSupported(claim, archive) {
  if (!archive) return true; // no archive coverage -> cannot judge, do not flag
  const probe = claim.slice(0, 8);
  return archive.includes(probe);
}

function collectAlanTranscriptText(data) {
  const conversations = Array.isArray(data?.conversations) ? data.conversations : [];
  const parts = [];
  for (const conversation of conversations) {
    const names = conversation.involvedCharacters ?? [];
    if (!names.includes('Alan')) continue;
    for (const message of conversation.transcriptMessages ?? conversation.previewMessages ?? []) {
      parts.push(message.text ?? '');
    }
  }
  return parts.join('\n');
}

function buildReport(items) {
  const lines = [
    '# Memory Hygiene Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Read-only. "Unverified Alan claim" means the archived transcripts in the scanned window do not support the quoted claim — it is a review queue, not a verdict. Cleanup: `npx convex run school:downweightFalseMemory \'{"characterName":"...","fragment":"...","dryRun":true}\'`.',
    '',
  ];
  for (const item of items) {
    lines.push(`## ${item.name} (${item.total} memories scanned, ${item.alreadyMarked} already marked)`);
    lines.push('');
    if (!item.knownFragmentHits.length && !item.legacyFormat.length && !item.unverifiedClaims.length) {
      lines.push('- clean');
      lines.push('');
      continue;
    }
    for (const hit of item.knownFragmentHits) {
      lines.push(`- KNOWN_FRAGMENT「${hit.fragment}」 · ${preview(hit.memory)}`);
    }
    for (const hit of item.unverifiedClaims) {
      lines.push(`- UNVERIFIED_ALAN_CLAIM「${hit.claim}」 · ${preview(hit.memory)}`);
    }
    for (const hit of item.legacyFormat) {
      lines.push(`- LEGACY_FORMAT · ${preview(hit.memory)}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function preview(memory) {
  const when = new Date(memory.createdAt).toLocaleString('zh-TW', { timeZone: 'America/Chicago' });
  return `[${when} · importance ${memory.importance}] ${String(memory.description).slice(0, 90)}`;
}

async function convexRun(fn, payload) {
  const { stdout } = await execFileAsync(
    'npx',
    ['convex', 'run', '--typecheck', 'disable', '--codegen', 'disable', fn, JSON.stringify(payload)],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
          process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS ?? '180',
      },
      maxBuffer: 1024 * 1024 * 32,
      timeout: 180_000,
    },
  );
  const start = stdout.indexOf('{');
  if (start < 0) throw new Error(`no JSON in convex run output for ${fn}`);
  return JSON.parse(stdout.slice(start));
}

function parseArgs(argv) {
  const flags = new Set();
  const fragments = [];
  for (const value of argv) {
    if (value.startsWith('--fragment=')) fragments.push(value.slice('--fragment='.length));
    else if (value.startsWith('--')) flags.add(value.replace(/^--/, '').replace(/=true$/, ''));
  }
  return { flags, fragments };
}

function runSelfTest() {
  const claims = claimedFragments('我記得你說過世界變得太聰明卻少了溫度。');
  if (claims.length !== 1 || !claims[0].includes('世界變得太聰明')) {
    throw new Error(`claim extraction failed: ${JSON.stringify(claims)}`);
  }
  if (claimSupported('世界變得太聰明卻少了溫度', '昨天聊到天氣')) throw new Error('expected unsupported');
  if (!claimSupported('世界變得太聰明卻少了溫度', '…你說過世界變得太聰明卻少了溫度…')) {
    throw new Error('expected supported');
  }
  if (!claimSupported('任何主張', '')) throw new Error('empty archive must not flag');
  const audited = auditCharacter(
    {
      name: '海',
      memories: [
        { description: '與 Alan 在 5/28/2026 的對話：……', aboutAlan: true, importance: 5, createdAt: 1 },
        { description: `${RECALL_CORRECTED_MARKER}舊的`, aboutAlan: false, importance: 0, createdAt: 1 },
        { description: '我們談過世界變得太聰明卻少了溫度。', aboutAlan: true, importance: 6, createdAt: 1 },
      ],
    },
    { knownFragments: DEFAULT_KNOWN_FRAGMENTS, alanTranscriptText: '無關內容' },
  );
  if (audited.legacyFormat.length !== 1) throw new Error('legacy format check failed');
  if (audited.alreadyMarked !== 1) throw new Error('marked count failed');
  if (audited.knownFragmentHits.length !== 1) throw new Error('fragment check failed');
  console.log('[memory-hygiene:self-test] PASS');
}

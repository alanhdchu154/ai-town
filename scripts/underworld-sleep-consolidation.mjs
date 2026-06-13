#!/usr/bin/env node
// GIIS Underworld sleep-consolidation MVP.
//
// This is a dry-run classifier only. It reads recent conversation evidence and
// proposes what might become short-term context, emotional residue, long-term
// memory, or forgotten noise. It does not write Convex memory/residue/profile
// rows and does not make legacy evidence prompt-facing.

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_REPORT = join(REPO_ROOT, 'umi', 'reports', 'sleep-consolidation-latest.md');
const DEFAULT_OUT_DIR = join(REPO_ROOT, 'umi', 'exports', 'sleep-consolidation-latest');

const args = parseArgs(process.argv.slice(2));
const SELF_TEST = args.flags.has('self-test');
const TIME_ZONE = args.values.get('time-zone') ?? 'America/Chicago';
const LIMIT = numberArg('limit', 120, 5, 500);
const MESSAGES_PER_CONVERSATION = numberArg('messages-per-conversation', 12, 1, 12);
const REPORT_PATH = resolvePath(args.values.get('report') ?? DEFAULT_REPORT);
const OUT_DIR = resolvePath(args.values.get('out-dir') ?? DEFAULT_OUT_DIR);

async function main() {
  if (SELF_TEST) {
    runSelfTest();
    return;
  }

  const evalData = await convexRun('school:recentConversationEvalData', {
    timeZone: TIME_ZONE,
    limit: LIMIT,
    compact: false,
    messagesPerConversation: MESSAGES_PER_CONVERSATION,
  });

  const legacySummary = await bestEffortLegacySummary();
  const experienceSummary = await bestEffortExperienceSummary();
  const conversations = Array.isArray(evalData?.conversations) ? evalData.conversations : [];
  const rawCandidates = conversations.map((conversation) => classifyConversation(conversation, { timeZone: TIME_ZONE }));
  const candidates = dedupeWithinDay(rawCandidates);
  const summary = summarizeCandidates(candidates);
  const payload = {
    generatedAt: new Date().toISOString(),
    mode: 'dry_run_only_no_convex_writes',
    timeZone: TIME_ZONE,
    source: {
      function: 'school:recentConversationEvalData',
      checkedAt: evalData?.checkedAt ?? null,
      requestedLimit: LIMIT,
      conversationsRead: conversations.length,
    },
    legacyContinuityEvidence: normalizeLegacySummary(legacySummary),
    experienceLogs: normalizeExperienceSummary(experienceSummary),
    policy: sleepPolicy(),
    summary,
    candidates,
  };

  await writeOutputs(payload, { reportPath: REPORT_PATH, outDir: OUT_DIR });
  console.log(
    `[sleep-consolidation] mode=dry_run_only conversations=${conversations.length} long_term=${summary.byBucket.long_term_memory_candidate ?? 0} residue=${summary.byBucket.emotional_residue_candidate ?? 0} review=${summary.byBucket.needs_human_review ?? 0}`,
  );
  console.log(`[sleep-consolidation] report=${relative(REPO_ROOT, REPORT_PATH)}`);
  console.log(`[sleep-consolidation] out=${relative(REPO_ROOT, OUT_DIR)}`);
}

function classifyConversation(conversation, { timeZone }) {
  const messages = extractMessages(conversation);
  const text = messages.map((message) => `${message.author}: ${message.text}`).join('\n');
  const participants = extractParticipants(conversation, messages);
  const risks = detectRisks({ conversation, messages, text });
  const reasons = [];
  let score = 0;

  const futureHits = hitCount(text, /答應|約定|承諾|明天|下次|回來再|練習前|週末|週一|週二|週三|週四|週五|週六|週日/g);
  if (futureHits > 0) {
    score += Math.min(18, futureHits * 6);
    reasons.push('has_future_or_promise_hook');
  }

  const nearFutureHits = hitCount(text, /待會|等一下|一下|之後/g);
  if (nearFutureHits > 0) {
    score += Math.min(6, nearFutureHits * 2);
    reasons.push('has_near_term_hook');
  }

  const residueHits = hitCount(text, /還記得|上次|昨天|剛才|剛剛|你自己呢|自己呢|沒說完|被看見|安靜|擔心|硬撐|責任|交接|接住|袖口|粉筆灰|紙邊角|走廊|窗邊/g);
  if (residueHits > 0) {
    score += Math.min(18, residueHits * 4);
    reasons.push('has_concrete_residue_cue');
  }

  const behaviorHits = hitCount(text, /少接|不再|先不要|先別|放下|關掉|留下|靠近|避開|陪|等|處理|告訴我|接手|交給|停一下/g);
  if (behaviorHits > 0) {
    score += Math.min(16, behaviorHits * 4);
    reasons.push('has_behavior_change_cue');
  }

  const characterHits = participants.filter((name) => CORE_NAMES.has(name)).length;
  if (characterHits > 0) {
    score += characterHits * 3;
    reasons.push('involves_current_core_character');
  }

  if (conversation?.memoryTraces?.length > 0) {
    score += Math.min(4, conversation.memoryTraces.length * 2);
    reasons.push('current_runtime_wrote_memory_trace');
  }

  if (isShortGenericGreeting(text)) {
    risks.push('too_generic_or_greeting_only');
  }
  if (messages.length <= 2) {
    risks.push('too_few_turns');
  }

  const riskPenalty = risks.length * 5;
  score = Math.max(0, score - riskPenalty);
  const bucket = decideBucket({ score, risks, reasons, conversation, text });
  const sleepAction = sleepActionForBucket(bucket);

  return normalizeCandidate({
    id: stableCandidateId(conversation?.id ?? text),
    conversationId: conversation?.id ?? null,
    createdAt: conversation?.createdAt ?? null,
    timestampLabelZh: conversation?.timestampLabelZh ?? null,
    localDate: conversation?.createdAt ? dateKeyFor(conversation.createdAt, timeZone) : null,
    participants,
    messageCount: conversation?.messageCount ?? messages.length,
    outcomeQuality: conversation?.outcomeQuality ?? null,
    bucket,
    score,
    reasons,
    risks: [...new Set(risks)],
    sleepAction,
    summaryZh: buildSummaryZh({ bucket, conversation, messages, participants, reasons, risks }),
    possibleMemoryZh: buildPossibleMemoryZh({ bucket, conversation, messages, participants }),
    transcriptPreview: messages.slice(0, 8),
    promptFacing: false,
    writeRecommended: false,
    requiresApprovalBeforeWrite: bucket !== 'forget_or_ignore',
  });
}

function decideBucket({ score, risks, reasons, conversation, text }) {
  if (isLowSignalRuntimeNoise({ score, risks, reasons })) return 'forget_or_ignore';
  if (risks.some((risk) => BLOCKING_RISKS.has(risk))) return 'needs_human_review';
  if (risks.includes('too_generic_or_greeting_only') || text.trim().length < 18) return 'forget_or_ignore';
  if (
    score >= 26 &&
    reasons.includes('has_future_or_promise_hook') &&
    reasons.includes('has_behavior_change_cue') &&
    !risks.includes('object_prop_churn') &&
    !risks.includes('closing_boundary_line') &&
    !risks.includes('food_care_motif')
  ) {
    return 'long_term_memory_candidate';
  }
  if (risks.includes('object_prop_churn') || risks.includes('closing_boundary_line') || risks.includes('food_care_motif')) {
    return 'short_term_context';
  }
  if (score >= 12 && reasons.includes('has_concrete_residue_cue') && reasons.includes('involves_current_core_character')) {
    return 'emotional_residue_candidate';
  }
  if (score >= 12 || conversation?.outcomeQuality === 'concrete_action') return 'short_term_context';
  return 'forget_or_ignore';
}

function sleepActionForBucket(bucket) {
  switch (bucket) {
    case 'long_term_memory_candidate':
      return 'keep_for_human_review_before_any_long_term_memory_write';
    case 'emotional_residue_candidate':
      return 'keep_as_residue_candidate_for_next_day_continuity_review';
    case 'short_term_context':
      return 'keep_for_near_term_context_then_fade_if_not_referenced';
    case 'needs_human_review':
      return 'do_not_write_until_pollution_or_format_risk_is_resolved';
    default:
      return 'let_fade_without_memory_write';
  }
}

function detectRisks({ conversation, messages, text }) {
  const risks = [];
  addRiskIf(text, FALLBACK_RE, risks, 'fallback_or_deterministic_leak');
  addRiskIf(text, STAGE_DIRECTION_RE, risks, 'stage_direction_inside_dialogue');
  addRiskIf(text, BROAD_LORE_RE, risks, 'broad_lore_or_social_theory');
  addRiskIf(text, SLOGAN_RE, risks, 'emotional_slogan_or_motif_collapse');
  if (conversation?.outcomeQuality === 'repeated_noise') risks.push('runtime_marked_repeated_noise');
  if (hasMirrorEcho(messages)) risks.push('mirror_echo_repetition');
  if (foodCareLoopScore(text) >= 2) risks.push('food_fatigue_care_loop');
  if (/便當|飯|咖哩|午餐|早餐|吃飽|食堂|餐廳|飲料|蛋糕|咖啡/.test(text)) risks.push('food_care_motif');
  if (hasObjectPropChurn(messages)) risks.push('object_prop_churn');
  if (/抱歉，?得先(?:走|離開|走一步)|先走囉|先離開一下/.test(text)) risks.push('closing_boundary_line');
  if (hasUnbalancedQuote(text)) risks.push('malformed_quote_fragment');
  return risks;
}

function isLowSignalRuntimeNoise({ score, risks, reasons }) {
  if (!risks.includes('runtime_marked_repeated_noise')) return false;
  const nonRuntimeRisks = risks.filter((risk) => risk !== 'runtime_marked_repeated_noise');
  if (nonRuntimeRisks.length > 0) return false;
  if (reasons.includes('has_future_or_promise_hook')) return false;
  return score < 6;
}

function dedupeWithinDay(candidates) {
  const seen = new Set();
  return candidates.map((candidate) => {
    if (!['long_term_memory_candidate', 'emotional_residue_candidate'].includes(candidate.bucket)) return candidate;
    const key = motifKey(candidate);
    if (!key) return candidate;
    if (!seen.has(key)) {
      seen.add(key);
      return candidate;
    }
    return demoteCandidate(candidate, 'short_term_context', 'duplicate_motif_same_day');
  });
}

function motifKey(candidate) {
  const memory = candidate.possibleMemoryZh ?? candidate.summaryZh ?? '';
  const signature = normalizeForSimilarity(memory)
    .replace(/今天提到|留下了具體餘波|有一個可能延續到明天的未完線索/g, '')
    .replace(/^[^：:]{1,30}[：:]/, '')
    .slice(0, 80);
  if (signature.length < 10) return null;
  const participants = [...candidate.participants].sort().join('|');
  const hash = createHash('sha256').update(signature).digest('hex').slice(0, 10);
  return `${candidate.localDate ?? 'unknown'}:${participants}:${hash}`;
}

function demoteCandidate(candidate, bucket, risk) {
  const risks = [...new Set([...candidate.risks, risk])];
  const reasons = [...candidate.reasons, `demoted:${risk}`];
  return {
    ...candidate,
    bucket,
    risks,
    reasons,
    sleepAction: sleepActionForBucket(bucket),
    requiresApprovalBeforeWrite: bucket !== 'forget_or_ignore',
    summaryZh: `${candidate.summaryZh}；分類調整：${risk} -> ${bucket}`,
  };
}

function normalizeCandidate(candidate) {
  let next = candidate;
  if (
    next.possibleMemoryZh &&
    hasUnbalancedQuote(next.possibleMemoryZh) &&
    ['long_term_memory_candidate', 'emotional_residue_candidate'].includes(next.bucket)
  ) {
    next = demoteCandidate(next, 'needs_human_review', 'malformed_possible_memory');
  }
  if (next.risks.includes('food_care_motif') && next.bucket === 'long_term_memory_candidate') {
    next = demoteCandidate(next, 'short_term_context', 'food_care_motif');
  }
  return next;
}

function buildSummaryZh({ bucket, conversation, messages, participants, reasons, risks }) {
  const names = participants.length > 0 ? participants.join(' / ') : 'unknown';
  const last = [...messages].reverse().find((message) => message.text)?.text ?? conversation?.summaryZh ?? '';
  const reasonText = reasons.length > 0 ? reasons.join(', ') : 'low_signal';
  const riskText = risks.length > 0 ? `；風險：${[...new Set(risks)].join(', ')}` : '';
  return `${names}：${bucket}。依據：${reasonText}${riskText}。片段：「${trimText(last, 80)}」`;
}

function buildPossibleMemoryZh({ bucket, conversation, messages, participants }) {
  if (bucket === 'forget_or_ignore' || bucket === 'needs_human_review') return null;
  const names = participants.length > 0 ? participants.join(' 和 ') : '角色';
  const best = chooseBestMemoryLine(conversation, messages);
  if (!best) return null;
  if (bucket === 'short_term_context') return `${names}今天提到：「${trimText(best, 70)}」`;
  if (bucket === 'emotional_residue_candidate') return `${names}留下了具體餘波：「${trimText(best, 70)}」`;
  return `${names}有一個可能延續到明天的未完線索：「${trimText(best, 70)}」`;
}

function chooseBestMemoryLine(conversation, messages) {
  const traceLine = conversation?.memoryTraces?.find((trace) => trace?.memoryLineZh)?.memoryLineZh;
  if (traceLine) {
    const match = traceLine.match(/情緒重點是：「([^」]+)」/);
    return match?.[1] ?? traceLine;
  }
  const sorted = [...messages].sort((a, b) => scoreLine(b.text) - scoreLine(a.text));
  return sorted[0]?.text ?? '';
}

function scoreLine(line) {
  return (
    hitCount(line, /明天|下次|答應|約定|記得|昨天|剛才|沒說完/g) * 4 +
    hitCount(line, /粉筆灰|袖口|紙邊角|責任|清單|交接|接住|安靜/g) * 3 +
    Math.min(2, Math.floor(line.length / 20))
  );
}

function summarizeCandidates(candidates) {
  const byBucket = {};
  const byRisk = {};
  const risksByBucket = {};
  for (const candidate of candidates) {
    byBucket[candidate.bucket] = (byBucket[candidate.bucket] ?? 0) + 1;
    risksByBucket[candidate.bucket] ??= {};
    for (const risk of candidate.risks) {
      byRisk[risk] = (byRisk[risk] ?? 0) + 1;
      risksByBucket[candidate.bucket][risk] = (risksByBucket[candidate.bucket][risk] ?? 0) + 1;
    }
  }
  return {
    totalCandidates: candidates.length,
    byBucket,
    byRisk,
    risksByBucket,
    writeCount: 0,
    promptFacingCount: 0,
    approvalRequiredCount: candidates.filter((candidate) => candidate.requiresApprovalBeforeWrite).length,
  };
}

async function writeOutputs(payload, { reportPath, outDir }) {
  await mkdir(dirname(reportPath), { recursive: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(toManifest(payload), null, 2), 'utf8');
  await writeFile(
    join(outDir, 'sleep-consolidation-candidates.jsonl'),
    payload.candidates.map((candidate) => JSON.stringify(candidate)).join('\n') + '\n',
    'utf8',
  );
  await writeFile(reportPath, buildReport(payload), 'utf8');
}

function buildReport(payload) {
  const lines = [];
  lines.push('# Underworld Sleep Consolidation MVP');
  lines.push('');
  lines.push(`Generated: ${payload.generatedAt}`);
  lines.push(`Mode: ${payload.mode}`);
  lines.push(`Source conversations checked: ${payload.source.conversationsRead}`);
  lines.push(`Convex writes: 0`);
  lines.push(`Prompt-facing writes: 0`);
  lines.push('');
  lines.push('## Bucket Summary');
  lines.push('');
  for (const bucket of BUCKET_ORDER) {
    lines.push(`- ${bucket}: ${payload.summary.byBucket[bucket] ?? 0}`);
  }
  lines.push('');
  lines.push('## Risk Breakdown By Bucket');
  lines.push('');
  for (const bucket of BUCKET_ORDER) {
    const risks = payload.summary.risksByBucket[bucket] ?? {};
    const riskSummary = Object.keys(risks).length > 0
      ? Object.entries(risks)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([risk, count]) => `${risk}=${count}`)
          .join(', ')
      : 'none';
    lines.push(`- ${bucket}: ${riskSummary}`);
  }
  lines.push('');
  lines.push('## Legacy Evidence Boundary');
  lines.push('');
  lines.push(`- Stored legacy evidence rows: ${payload.legacyContinuityEvidence.count ?? 'unknown'}`);
  lines.push(`- Prompt-facing legacy rows: ${payload.legacyContinuityEvidence.promptFacing ?? 'unknown'}`);
  lines.push(`- Fresh-eval-eligible legacy rows: ${payload.legacyContinuityEvidence.freshEvalEligible ?? 'unknown'}`);
  lines.push('- Policy: legacy evidence remains historical review material, not fresh memory and not prompt context.');
  lines.push('');
  lines.push('## Experience Log Boundary');
  lines.push('');
  lines.push(`- Recent experience logs read: ${payload.experienceLogs.count ?? 'unknown'}`);
  lines.push(`- Residue-bearing logs: ${payload.experienceLogs.residueCount ?? 'unknown'}`);
  lines.push(`- Behavior-hint logs: ${payload.experienceLogs.behaviorHintCount ?? 'unknown'}`);
  lines.push('- Policy: experience logs are raw material for sleep review, not personality updates.');
  lines.push('');
  lines.push('## Top Candidates');
  lines.push('');
  for (const bucket of BUCKET_ORDER) {
    const examples = payload.candidates
      .filter((candidate) => candidate.bucket === bucket)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    lines.push(`### ${bucket}`);
    if (examples.length === 0) {
      lines.push('');
      lines.push('- none');
      lines.push('');
      continue;
    }
    lines.push('');
    for (const candidate of examples) {
      const riskText = candidate.risks.length > 0 ? ` risks=${candidate.risks.join(',')}` : '';
      lines.push(
        `- score=${candidate.score} ${candidate.conversationId ?? candidate.id} ${candidate.participants.join(' / ')}${riskText}`,
      );
      lines.push(`  - ${candidate.summaryZh}`);
      if (candidate.possibleMemoryZh) lines.push(`  - possible: ${candidate.possibleMemoryZh}`);
    }
    lines.push('');
  }
  lines.push('## Candidate Text To Review Before Any Write');
  lines.push('');
  const writableCandidates = payload.candidates.filter((candidate) =>
    ['long_term_memory_candidate', 'emotional_residue_candidate'].includes(candidate.bucket),
  );
  if (writableCandidates.length === 0) {
    lines.push('- none');
  } else {
    for (const candidate of writableCandidates) {
      lines.push(
        `- ${candidate.bucket} ${candidate.conversationId ?? candidate.id} ${candidate.participants.join(' / ')}: ${
          candidate.possibleMemoryZh ?? candidate.summaryZh
        }`,
      );
    }
  }
  lines.push('');
  lines.push('## Policy');
  lines.push('');
  for (const rule of payload.policy.guardrails) lines.push(`- ${rule}`);
  lines.push('');
  lines.push('## Next Gate');
  lines.push('');
  lines.push('- Ask cc for read-only review of this classifier and report.');
  lines.push('- Alan approval is required before any candidate becomes a live memory, residue, profile update, or prompt-facing read path.');
  lines.push('- If approved later, implement a bounded write path with caps, dedupe, and rollback/reporting first.');
  lines.push('');
  return lines.join('\n');
}

function toManifest(payload) {
  return {
    generatedAt: payload.generatedAt,
    mode: payload.mode,
    source: payload.source,
    legacyContinuityEvidence: payload.legacyContinuityEvidence,
    experienceLogs: payload.experienceLogs,
    summary: payload.summary,
    files: {
      candidates: 'sleep-consolidation-candidates.jsonl',
    },
  };
}

async function convexRun(functionName, payload) {
  const { stdout } = await execFileAsync(
    'npx',
    ['convex', 'run', '--typecheck', 'disable', '--codegen', 'disable', functionName, JSON.stringify(payload ?? {})],
    { cwd: REPO_ROOT, timeout: 180_000, maxBuffer: 1024 * 1024 * 32 },
  );
  return parseJson(stdout);
}

async function bestEffortLegacySummary() {
  try {
    return await convexRun('legacyContinuity:legacyContinuityEvidenceSummary', {});
  } catch (error) {
    return { unavailable: true, error: error instanceof Error ? error.message.split('\n')[0] : String(error) };
  }
}

async function bestEffortExperienceSummary() {
  try {
    const worldStatus = await convexRun('world:defaultWorldStatus', {});
    if (!worldStatus?.worldId) return { unavailable: true, error: 'worldId unavailable' };
    const rows = await convexRun('agent/experienceLog:recentExperienceLogs', {
      worldId: worldStatus.worldId,
      limit: 100,
    });
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    return { unavailable: true, error: error instanceof Error ? error.message.split('\n')[0] : String(error) };
  }
}

function normalizeLegacySummary(summary) {
  if (!summary || summary.unavailable) return summary ?? { unavailable: true };
  return {
    count: summary.count ?? 0,
    promptFacing: summary.promptFacing ?? 0,
    freshEvalEligible: summary.freshEvalEligible ?? 0,
    byRun: summary.byRun ?? {},
  };
}

function normalizeExperienceSummary(summary) {
  if (summary?.unavailable) return { unavailable: true, error: summary.error };
  const rows = Array.isArray(summary) ? summary : [];
  return {
    count: rows.length,
    residueCount: rows.filter((row) => row.residue).length,
    behaviorHintCount: rows.filter((row) => row.behaviorHint).length,
    latest: rows.slice(0, 8).map((row) => ({
      characterName: row.characterName,
      day: row.day,
      importance: row.importance,
      residue: row.residue,
      behaviorHint: row.behaviorHint,
      conversationId: row.conversationId,
    })),
  };
}

function parseJson(stdout) {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const candidates = [
      [trimmed.indexOf('{'), trimmed.lastIndexOf('}')],
      [trimmed.indexOf('['), trimmed.lastIndexOf(']')],
    ].filter(([start, end]) => start >= 0 && end > start);
    if (candidates.length) {
      const [start, end] = candidates.sort((a, b) => a[0] - b[0])[0];
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error(`Convex output was not JSON: ${trimmed.slice(0, 200)}`);
  }
}

function extractMessages(conversation) {
  const raw = Array.isArray(conversation?.transcriptMessages)
    ? conversation.transcriptMessages
    : Array.isArray(conversation?.messages)
      ? conversation.messages
      : Array.isArray(conversation?.previewMessages)
        ? conversation.previewMessages
        : [];
  return raw
    .map((message) => ({
      author: String(message?.author ?? message?.authorName ?? message?.name ?? 'unknown'),
      text: normalizeWhitespace(String(message?.text ?? message?.message ?? message?.content ?? '')),
      timestampLabelZh: message?.timestampLabelZh ?? null,
    }))
    .filter((message) => message.text.length > 0);
}

function extractParticipants(conversation, messages) {
  const names = Array.isArray(conversation?.involvedCharacters)
    ? conversation.involvedCharacters
    : Array.isArray(conversation?.participants)
      ? conversation.participants
      : messages.map((message) => message.author);
  return [...new Set(names.map((name) => String(name)).filter(Boolean))];
}

function hasMirrorEcho(messages) {
  for (let index = 1; index < messages.length; index += 1) {
    const previous = normalizeForSimilarity(messages[index - 1].text);
    const current = normalizeForSimilarity(messages[index].text);
    if (previous.length < 8 || current.length < 8) continue;
    if (previous === current) return true;
    if (jaccard(previous, current) >= 0.72) return true;
  }
  return false;
}

function jaccard(a, b) {
  const aSet = new Set(a.split(''));
  const bSet = new Set(b.split(''));
  const intersection = [...aSet].filter((item) => bSet.has(item)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function foodCareLoopScore(text) {
  let score = 0;
  if (/便當|飯|咖哩|午餐|早餐|食堂|餐廳|水杯|茶|湯|豆漿|筷子|湯匙/.test(text)) score += 1;
  if (/累|休息|疲|睡|硬撐|沒吃/.test(text)) score += 1;
  if (/Alan.*累|Alan.*休息|校長.*累|校長.*休息/.test(text)) score += 1;
  return score;
}

function hasObjectPropChurn(messages) {
  const allText = messages.map((message) => message.text).join('\n');
  const totalHits = hitObjectFamilies(allText).length;
  if (totalHits >= 3) return true;

  const familyMessageCounts = new Map();
  for (const message of messages) {
    for (const family of new Set(hitObjectFamilies(message.text))) {
      familyMessageCounts.set(family, (familyMessageCounts.get(family) ?? 0) + 1);
    }
  }
  return [...familyMessageCounts.values()].some((count) => count >= 2);
}

function hitObjectFamilies(text) {
  const hits = [];
  for (const [family, regex] of OBJECT_PROP_FAMILIES) {
    if (regex.test(text)) hits.push(family);
    regex.lastIndex = 0;
  }
  return hits;
}

function hasUnbalancedQuote(text) {
  return hitCount(text, /「/g) !== hitCount(text, /」/g);
}

function isShortGenericGreeting(text) {
  const normalized = normalizeWhitespace(text);
  if (normalized.length > 36) return false;
  return /^(你好|嗨|嗯|好|謝謝|今天先這樣|再見|晚安|早安|好的|大丈夫)[。！!？?\s]*$/.test(normalized);
}

function hitCount(text, regex) {
  return [...text.matchAll(regex)].length;
}

function addRiskIf(text, regex, risks, risk) {
  if (regex.test(text)) risks.push(risk);
  regex.lastIndex = 0;
}

function stableCandidateId(source) {
  return `sleep-${createHash('sha256').update(String(source)).digest('hex').slice(0, 12)}`;
}

function dateKeyFor(timestamp, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeForSimilarity(text) {
  return normalizeWhitespace(text)
    .replace(/[，。！？、…「」『』,.!?]/g, '')
    .replace(/你剛才說|你剛說|那我們就|我聽進去了/g, '')
    .trim();
}

function trimText(text, maxLength) {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function resolvePath(path) {
  return isAbsolute(path) ? path : join(REPO_ROOT, path);
}

function numberArg(name, fallback, min, max) {
  const value = Number(args.values.get(name) ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`--${name} must be a number between ${min} and ${max}`);
  }
  return value;
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

function sleepPolicy() {
  return {
    philosophy: 'Sleep consolidation means classify and fade before writing. It is not raw recall and not an emotion meter.',
    guardrails: [
      'No Convex writes in this MVP dry-run.',
      'No candidate is prompt-facing by default.',
      'Legacy continuity evidence remains historical review material and cannot count as fresh v0.1 evidence.',
      'Fallback, stage-direction leaks, mirror echo, broad lore, and food/fatigue loops are review blockers.',
      'Long-term memory requires concrete unresolved future hook, behavior shift, or repeated emotionally specific evidence.',
      'Short-term context should fade if it is not referenced again.',
      'Emotional residue should be short, concrete, and tied to a person/event, not a slogan.',
    ],
  };
}

function runSelfTest() {
  const samples = [
    {
      name: 'long term promise',
      expected: 'long_term_memory_candidate',
      conversation: {
        id: 'test-long',
        involvedCharacters: ['一之瀨', '天澤'],
        transcriptMessages: [
          { author: '一之瀨', text: '你剛才那句玩笑，是想試我會不會接住？' },
          { author: '天澤', text: '明天社團練習，你會不會也這樣接我？' },
          { author: '一之瀨', text: '明天練習前，你先告訴我想被接住哪一秒。' },
        ],
      },
    },
    {
      name: 'residue',
      expected: 'emotional_residue_candidate',
      conversation: {
        id: 'test-residue',
        involvedCharacters: ['海', '真晝'],
        transcriptMessages: [
          { author: '真晝', text: '你剛才一直整理 Alan 的事，可是你自己呢？' },
          { author: '海', text: '今天我只整理三件事。其他的，明天再說。' },
        ],
      },
    },
    {
      name: 'generic',
      expected: 'forget_or_ignore',
      conversation: {
        id: 'test-generic',
        involvedCharacters: ['海', 'Alan'],
        transcriptMessages: [{ author: 'Alan', text: '你好' }],
      },
    },
    {
      name: 'fallback',
      expected: 'needs_human_review',
      conversation: {
        id: 'test-fallback',
        involvedCharacters: ['海', 'Alan'],
        transcriptMessages: [{ author: '海', text: '我懂。這種感覺需要先看它有沒有影響睡眠。' }],
      },
    },
    {
      name: 'stage direction',
      expected: 'needs_human_review',
      conversation: {
        id: 'test-stage',
        involvedCharacters: ['海', '天澤'],
        transcriptMessages: [{ author: '海', text: '我合上筆電，看向你手邊那疊文件。明天我們一起分掉。' }],
      },
    },
  ];
  const failures = [];
  for (const sample of samples) {
    const result = classifyConversation(sample.conversation, { timeZone: TIME_ZONE });
    if (result.bucket !== sample.expected) {
      failures.push(`${sample.name}: expected ${sample.expected}, got ${result.bucket}`);
    }
  }
  if (failures.length > 0) {
    console.error(`[sleep-consolidation:self-test] FAIL\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log('[sleep-consolidation:self-test] PASS');
}

const CORE_NAMES = new Set(['Alan', '海', 'Umi', '真晝', 'Mahiru', '天澤', 'Tianze', '一之瀨', 'Ichinose', '貓貓', 'Maomao', '祥子', 'Sakiko']);
const BLOCKING_RISKS = new Set([
  'fallback_or_deterministic_leak',
  'stage_direction_inside_dialogue',
  'runtime_marked_repeated_noise',
  'mirror_echo_repetition',
  'malformed_quote_fragment',
]);
const BUCKET_ORDER = [
  'long_term_memory_candidate',
  'emotional_residue_candidate',
  'short_term_context',
  'forget_or_ignore',
  'needs_human_review',
];
const FALLBACK_RE = /我懂。這種感覺|先看它有沒有影響睡眠|fallback|deterministic|\[ABORT_CONVERSATION\]|\[LEAVE\]/i;
const STAGE_DIRECTION_RE = /(?:我合上|我放下|我看向|我走到|我把|我靠回|我拿起|我坐下|我站起|我笑著|我退後|眼神|退後半步)/;
const BROAD_LORE_RE = /政治|派系|權力|社會|文明|秩序網絡|規則網絡|世界變得太聰明/;
const SLOGAN_RE = /這一刻我們誰都不動|我又想把它拆成任務|先看人，不是先加功能|簡報只留三件事/;
const OBJECT_PROP_FAMILIES = [
  ['drinkware', /水杯|杯子|茶|湯|豆漿/g],
  ['chair_light', /椅子|光線/g],
  ['pen_stationery', /筆蓋|紅筆|鉛筆|粉筆灰|透明膠帶|針尖/g],
  ['paper_docs', /紙邊角|文件|問卷|藍色紙|樂譜|截圖|螢幕/g],
  ['desk_storage', /桌角|抽屜|鑰匙/g],
  ['clothing', /袖口|鈕扣|布裡/g],
  ['food_prop', /便當|咖哩|飯|午餐|早餐|食堂|餐廳/g],
  ['small_object', /薄荷葉|湯匙|指印|弓毛|咖啡漬/g],
];

await main();

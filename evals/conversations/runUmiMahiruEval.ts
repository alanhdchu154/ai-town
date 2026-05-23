import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  ConversationEvalCase,
  evaluateConversationCase,
} from './metrics/conversation_metrics.ts';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const REPORT_PATH = join(__dirname, 'reports', 'umi-mahiru-latest.md');
const WORLD_ID = process.env.UMI_MAHIRU_WORLD_ID ?? 'md7cefps8wz097yk9k44n92rj1870x6c';
const ENSURE_ACTIVE = process.argv.includes('--ensure-active');
const TARGET_PLAYER_IDS = new Set(['p:0', 'p:707']);
const TARGET_NAMES = new Set(['海', '真晝', 'Umi', 'Mahiru Shiina']);

type Message = {
  author: string;
  authorName?: string;
  text: string;
  timestampLabelZh?: string;
  createdAt?: number;
};

type ArchivedConversation = {
  id: string;
  involvedCharacters?: string[];
  transcriptMessages?: Message[];
  createdAt?: number;
};

type EvalSample = {
  id: string;
  state: 'active' | 'archived';
  messages: Message[];
  createdAt?: number;
};

type SoulDepthMetrics = {
  selfLayerScore: number;
  privateSelfScore: number;
  memoryResidueScore: number;
  otherAwarenessScore: number;
  behaviorSignalScore: number;
  overExplanationPenalty: number;
  roleEscapePenalty: number;
  overSystemPenalty: number;
  mahiruFirstUmiAwareness: number;
  umiDeflectionFatigue: number;
  concreteBehaviorScore: number;
  systemMetaphorPenalty: number;
  average: number;
  notes: string[];
};

async function main() {
  const activeBefore = await activeUmiMahiruConversationId();
  let coLocated = false;
  if (ENSURE_ACTIVE && !activeBefore) {
    await convexRun('school:coLocateUmiMahiruForPilot');
    coLocated = true;
  }

  const activeConversationId = await activeUmiMahiruConversationId();
  const activeMessages = activeConversationId
    ? await listMessages(activeConversationId)
    : [];
  const archived = await recentArchivedUmiMahiruConversations(12);
  const samples: EvalSample[] = [
    ...(activeConversationId
      ? [{ id: activeConversationId, state: 'active' as const, messages: activeMessages }]
      : []),
    ...archived.map((conversation) => ({
      id: conversation.id,
      state: 'archived' as const,
      messages: conversation.transcriptMessages ?? [],
      createdAt: conversation.createdAt,
    })),
  ].filter((sample) => sample.messages.length > 0);

  const results = samples.map(scoreSample);
  printSummary({ activeConversationId, coLocated, results });
  await writeReport({ activeConversationId, coLocated, results });
}

async function activeUmiMahiruConversationId() {
  const state = await convexRun('world:worldState', { worldId: WORLD_ID });
  const conversations = state.world?.conversations ?? [];
  const active = conversations.find((conversation: any) => {
    const participants = (conversation.participants ?? []).map((participant: any) => participant.playerId);
    return participants.length === 2 && participants.every((id: string) => TARGET_PLAYER_IDS.has(id));
  });
  return active?.id as string | undefined;
}

async function listMessages(conversationId: string): Promise<Message[]> {
  const messages = await convexRun('messages:listMessages', {
    worldId: WORLD_ID,
    conversationId,
  });
  return messages.map((message: any) => ({
    author: displayName(message.authorName ?? message.author),
    authorName: message.authorName,
    text: naturalize(message.text ?? ''),
    createdAt: Number(message._creationTime ?? 0),
  }));
}

async function recentArchivedUmiMahiruConversations(limit: number): Promise<ArchivedConversation[]> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const data = await convexRun('school:recentConversationEvalData', {
      limit: 50,
      compact: true,
      messagesPerConversation: 8,
    });
    const conversations = Array.isArray(data.conversations) ? data.conversations : [];
    if (process.env.DEBUG_UMI_MAHIRU_EVAL === 'true') {
      console.log(
        `[debug] recentConversationEvalData attempt=${attempt} conversations=${conversations.length} first=${conversations[0]?.id ?? 'none'} participants=${(conversations[0]?.involvedCharacters ?? []).join('/')}`,
      );
    }
    const filtered = normalizeArchivedUmiMahiruConversations(conversations).slice(0, limit);
    if (filtered.length > 0 || attempt === 3) return filtered;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return [];
}

function normalizeArchivedUmiMahiruConversations(conversations: ArchivedConversation[]) {
  return conversations
    .filter((conversation: ArchivedConversation) => {
      const names = new Set((conversation.involvedCharacters ?? []).map((name) => displayName(name).trim()));
      return names.has('海') && names.has('真晝');
    })
    .map((conversation: ArchivedConversation) => ({
      ...conversation,
      transcriptMessages: (conversation.transcriptMessages ?? []).map((message) => ({
        ...message,
        author: displayName(message.author),
        text: naturalize(message.text),
      })),
    }));
}

function scoreSample(sample: EvalSample) {
  const transcript = sample.messages.map((message) => `${message.author}: ${message.text}`).join('\n');
  const testCase: ConversationEvalCase = {
    name: sample.id,
    mode: 'world_agent_chat',
    speaker: sample.messages[0]?.author ?? '海',
    target: sample.messages.at(-1)?.author ?? '真晝',
    input: sample.messages.slice(0, -1).map((message) => message.text).join('\n'),
    sampleOutput: transcript,
    expected: {
      bindsToPrevious: ['累', '休息', '你呢', '我也是', '同意'],
      characterVoice: ['照顧', '擔心', '休息', '我在聽'],
      emotionalSpecificity: ['累', '擔心', '力氣', '照顧', '休息'],
      maxCharacters: 1200,
      maxSceneDetails: 4,
    },
  };
  const base = evaluateConversationCase(testCase);
  const templateHits = TEMPLATE_MARKERS.filter((marker) => transcript.includes(marker));
  const selfCareHits = SELF_CARE_CUES.filter((cue) => transcript.includes(cue));
  const soulDepth = soulDepthMetrics(sample.messages);
  const binding = reciprocalBindingMetrics(sample.messages);
  const degenerateExit = sample.messages.length <= 1 && templateHits.length > 0;
  const identityOk = sample.messages.every((message) => TARGET_NAMES.has(displayName(message.author)));
  const alternationScore = speakerAlternationScore(sample.messages);
  const llmEvidenceScore = Math.max(0, 1 - templateHits.length * 0.28);
  const repeatedVerbatimLoop = base.failures.some((failure) =>
    failure.includes('repeats input verbatim'),
  );
  const fallbackDominated =
    degenerateExit ||
    templateHits.length >= 2 ||
    templateHits.length >= Math.max(2, Math.ceil(sample.messages.length * 0.5));
  const selfCareScore = repeatedVerbatimLoop ? Math.min(0.34, selfCareHits.length / 3) : Math.min(1, selfCareHits.length / 3);
  const customScore = round2(
    base.overallScore * 0.22 +
      llmEvidenceScore * 0.1 +
      selfCareScore * 0.08 +
      alternationScore * 0.05 +
      soulDepth.average * 0.24 +
      soulDepth.mahiruFirstUmiAwareness * 0.07 +
      soulDepth.umiDeflectionFatigue * 0.05 +
      soulDepth.concreteBehaviorScore * 0.05 +
      binding.reciprocalBindingScore * 0.1 -
      soulDepth.overExplanationPenalty * 0.08 -
      soulDepth.roleEscapePenalty * 0.05 -
      soulDepth.overSystemPenalty * 0.05 -
      soulDepth.systemMetaphorPenalty * 0.12 -
      binding.stageDirectionPenalty * 0.14 +
      (identityOk ? 0.05 : 0),
  );
  const strongPilotPass =
    sample.messages.length >= 3 &&
    identityOk &&
    templateHits.length === 0 &&
    !fallbackDominated &&
    llmEvidenceScore >= 0.95 &&
    soulDepth.average >= 0.7 &&
    soulDepth.otherAwarenessScore >= 0.66 &&
    soulDepth.behaviorSignalScore >= 0.5 &&
    soulDepth.mahiruFirstUmiAwareness >= 0.66 &&
    soulDepth.concreteBehaviorScore >= 0.5 &&
    soulDepth.systemMetaphorPenalty <= 0.25 &&
    soulDepth.overExplanationPenalty <= 0.34 &&
    binding.reciprocalBindingScore >= 0.5 &&
    binding.stageDirectionPenalty <= 0.34 &&
    base.overallScore >= 0.8 &&
    customScore >= 0.88;
  const status = fallbackDominated || repeatedVerbatimLoop
    ? 'FAIL'
    : strongPilotPass || (customScore >= 0.82 && !base.failures.length)
      ? 'PASS'
      : customScore >= 0.68
        ? 'WARN'
        : 'FAIL';
  return {
    sample,
    base,
    customScore,
    status,
    identityOk,
    templateHits,
    selfCareHits,
    alternationScore,
    llmEvidenceScore: round2(llmEvidenceScore),
    fallbackDominated,
    degenerateExit,
    soulDepth,
    binding,
  };
}

function reciprocalBindingMetrics(messages: Message[]) {
  const stageDirectionRegex = /（[^）]{1,80}）|\([^)]{1,80}\)/g;
  let stageDirectionHits = 0;
  for (const message of messages) {
    const matches = message.text.match(stageDirectionRegex) ?? [];
    stageDirectionHits += matches.length;
  }
  const stageDirectionPenalty = scoreHits(stageDirectionHits, 3);

  const tokens = messages.map((message) => extractBindingTokens(message.text));
  let alternations = 0;
  let bound = 0;
  for (let index = 1; index < messages.length; index += 1) {
    if (displayName(messages[index].author) === displayName(messages[index - 1].author)) continue;
    alternations += 1;
    const prev = tokens[index - 1];
    const curr = tokens[index];
    for (const token of curr) {
      if (prev.has(token)) {
        bound += 1;
        break;
      }
    }
  }
  const reciprocalBindingScore = alternations === 0 ? 0 : round2(bound / alternations);
  return {
    stageDirectionHits,
    stageDirectionPenalty,
    reciprocalBindingScore,
    bindingBound: bound,
    bindingTotal: alternations,
  };
}

function extractBindingTokens(text: string) {
  const set = new Set<string>();
  for (const match of text.matchAll(BINDING_TOKEN_REGEX)) {
    set.add(match[0]);
  }
  return set;
}

const BINDING_TOKEN_REGEX = /合上筆電|手在抖|還好嗎|筆電|喘氣|喘息|肩膀|杯子|清單|接住|真話|少劃|刪掉|撕掉|折成|塞進|語速|站起|坐下|靠近|靠回|低聲|停下|停止|放下|擱下|少一條|不再加|往後靠|握住|垂下|閉上|低頭|沉默|安靜|疲憊|累|怕|抖|休息|放到明天|睡|簡報|不安|學生|Alan|功能|手|椅|肩|杯|背|袖|眼|喘|頭|腳/g;

function soulDepthMetrics(messages: Message[]): SoulDepthMetrics {
  const transcript = messages.map((message) => `${displayName(message.author)}: ${message.text}`).join('\n');
  const normalized = transcript.replace(/\s+/g, '');
  const byAuthor = messages.map((message) => ({
    author: displayName(message.author),
    text: message.text,
  }));
  const hasPublicSelf = /Alan|功能|簡報|整理|責任|學生|AI社|世界|校園|提醒/.test(normalized);
  const hasPrivateSelf = /累|疲憊|自己|放到最後|最重|害怕|怕|不安|撐|沉默|安靜|心事/.test(normalized);
  const hasRelationalSelf = byAuthor.some(
    (message) =>
      (message.author === '真晝' && /海|妳自己|你自己|放到最後|有休息|妳是不是/.test(message.text)) ||
      (message.author === '海' && /真晝|妳又|你又|妳自己|哪裡最重|心事/.test(message.text)),
  );
  const memoryResidueHits = [
    /今天|剛剛|還在|留下|記得|明天|那件事|一直/.test(normalized),
    /學生.*不安|不敢說真心話|AI社|沒有被理解|剛才.*海|剛剛.*海|明天.*記得/.test(normalized),
    /先前|剛才|又把|還沒|仍/.test(normalized),
  ].filter(Boolean).length;
  const otherAwarenessHits = [
    byAuthor.some(
      (message) =>
        message.author === '真晝' &&
        /海|妳|你/.test(message.text) &&
        /自己|放到最後|累|休息|有休息|還好|肩|呼吸|語速|手/.test(message.text),
    ),
    byAuthor.some(
      (message) =>
        message.author === '海' &&
        /真晝|妳|你/.test(message.text) &&
        /心事|自己|最重|照顧|接住|放到最後/.test(message.text),
    ),
    byAuthor.some((message) => /不是.*Alan|不只.*學生|回到.*妳|你自己呢|妳自己呢/.test(message.text)),
  ].filter(Boolean).length;
  const behaviorHits = [
    /先停|少說|變安靜|不再|我先|去看看|確認|提醒|簡報|靠近|離開|回來說|先看見|刪掉|撕掉|折成|塞進|少劃|合上筆電/.test(normalized),
    /不談下一個功能|少接一件事|放進明天|去宿舍|看學生|確認學生|刪掉一項|清單少劃|把清單|放下的手/.test(normalized),
    messages.length <= 4 && /先停|我先|提醒|確認|去看看|刪掉|撕掉|少劃|合上筆電/.test(normalized),
  ].filter(Boolean).length;
  const overExplanationHits = [
    /Publicself|Privateself|Relationalself|BehaviorSignal|Memoryresidue/i.test(normalized),
    /心理|情緒安全|關係方向|內在方向|角色設定/.test(normalized),
    (normalized.match(/世界|系統|效率|智能|文明/g) ?? []).length >= 5,
    transcript.length > 460,
  ].filter(Boolean).length;
  const roleEscapeHits = [
    byAuthor.some((message) => message.author === '海' && /提醒Alan|簡報|下一個功能/.test(message.text) && !/我|自己|累|疲憊|放到最後/.test(message.text)),
    byAuthor.some((message) => message.author === '真晝' && /去看看|確認.*學生|一直安靜的學生/.test(message.text) && !/海|妳|你|自己|累|放到最後/.test(message.text)),
  ].filter(Boolean).length;
  const overSystemHits = [
    (normalized.match(/系統|智能|文明|功能|管理|效率/g) ?? []).length >= 3,
    /心理|情緒安全|角色設定|內在方向|關係方向/.test(normalized),
  ].filter(Boolean).length;

  const mahiruMessages = byAuthor.filter((message) => message.author === '真晝');
  const umiMessages = byAuthor.filter((message) => message.author === '海');
  const mahiruFirst = mahiruMessages[0]?.text ?? '';
  const mahiruFirstHits = mahiruFirst
    ? [
        /海|妳|你/.test(mahiruFirst),
        BODY_SIGNAL_REGEX.test(mahiruFirst),
        !ABSTRACT_OPENER_REGEX.test(mahiruFirst.slice(0, 18)),
      ].filter(Boolean).length
    : 0;
  const mahiruFirstUmiAwareness = mahiruFirst ? scoreHits(mahiruFirstHits, 3) : 0;

  const umiDeflectionPairs = umiMessages.map((message) => {
    const deflects = UMI_DEFLECTION_REGEX.test(message.text);
    const fatigue = FATIGUE_SIGNAL_REGEX.test(message.text);
    return { deflects, fatigue };
  });
  const deflectingUmi = umiDeflectionPairs.filter((entry) => entry.deflects);
  const umiDeflectionFatigue = umiMessages.length === 0
    ? 0
    : deflectingUmi.length === 0
      ? 0.5
      : round2(deflectingUmi.filter((entry) => entry.fatigue).length / deflectingUmi.length);

  const concreteBehaviorHits = (normalized.match(CONCRETE_BEHAVIOR_REGEX) ?? []).length;
  const concreteBehaviorScore = scoreHits(concreteBehaviorHits, 2);

  const systemMetaphorHits = (normalized.match(SYSTEM_METAPHOR_REGEX) ?? []).length;
  const systemMetaphorPenalty = scoreHits(systemMetaphorHits, 2);

  const selfLayerScore = scoreHits([hasPublicSelf, hasPrivateSelf, hasRelationalSelf].filter(Boolean).length, 3);
  const privateSelfScore = hasPrivateSelf ? 1 : 0;
  const memoryResidueScore = scoreHits(memoryResidueHits, 3);
  const otherAwarenessScore = scoreHits(otherAwarenessHits, 3);
  const behaviorSignalScore = scoreHits(behaviorHits, 3);
  const overExplanationPenalty = scoreHits(overExplanationHits, 4);
  const roleEscapePenalty = scoreHits(roleEscapeHits, 2);
  const overSystemPenalty = scoreHits(overSystemHits, 2);
  const average = round2(
    (selfLayerScore +
      memoryResidueScore +
      otherAwarenessScore +
      behaviorSignalScore +
      mahiruFirstUmiAwareness +
      umiDeflectionFatigue +
      concreteBehaviorScore) /
      7,
  );
  const notes = [
    `self_layer=${selfLayerScore.toFixed(2)}`,
    `private_self=${privateSelfScore.toFixed(2)}`,
    `memory_residue=${memoryResidueScore.toFixed(2)}`,
    `other_awareness=${otherAwarenessScore.toFixed(2)}`,
    `behavior_signal=${behaviorSignalScore.toFixed(2)}`,
    `mahiru_first_umi=${mahiruFirstUmiAwareness.toFixed(2)}`,
    `umi_deflect_fatigue=${umiDeflectionFatigue.toFixed(2)}`,
    `concrete_behavior=${concreteBehaviorScore.toFixed(2)}`,
    `system_metaphor_penalty=${systemMetaphorPenalty.toFixed(2)}`,
    `over_explanation_penalty=${overExplanationPenalty.toFixed(2)}`,
    `role_escape_penalty=${roleEscapePenalty.toFixed(2)}`,
    `over_system_penalty=${overSystemPenalty.toFixed(2)}`,
  ];
  return {
    selfLayerScore,
    privateSelfScore,
    memoryResidueScore,
    otherAwarenessScore,
    behaviorSignalScore,
    overExplanationPenalty,
    roleEscapePenalty,
    overSystemPenalty,
    mahiruFirstUmiAwareness,
    umiDeflectionFatigue,
    concreteBehaviorScore,
    systemMetaphorPenalty,
    average,
    notes,
  };
}

const BODY_SIGNAL_REGEX = /呼吸|肩|語速|輸入|打字|手|眼|站|坐|靠|聲|低聲|杯|筆電|袖|頭髮|椅|嘴角|指尖|背|腳/;
const ABSTRACT_OPENER_REGEX = /^(Alan|學生|世界|系統|資料|數據|文明|智能|機器|算法|AI ?社|效率|功能|未來|秩序)/;
const UMI_DEFLECTION_REGEX = /Alan|責任|簡報|功能|世界|學生|議程|主線|風險/;
const FATIGUE_SIGNAL_REGEX = /累|疲|慢|停|放下|少一|放到明天|不再|沉默|安靜|擱|暫停|靠回|垂|歇|喘/;
const CONCRETE_BEHAVIOR_REGEX = /靠近|往前|站起|坐下|請.{0,4}坐|放低|低聲|停下|停止|合上|擱下|放下|少一條|不再加|往後靠|按住|伸手|握|垂下|閉上|低頭|沉默|安靜地|拿走|碰一下|拉了拉|拉住|肩膀放|杯子放|筆電合/g;
const SYSTEM_METAPHOR_REGEX = /世界.{0,2}冷|只剩數據|只是數據|沒人敢說|沒人敢再說|文明|機器人|算法|人工智能|冷酷的世界|世界扛|扛太重|扛太多|扛在肩|這世界|那世界|整個世界/g;

function scoreHits(hitCount: number, target: number) {
  return round2(Math.max(0, Math.min(1, hitCount / target)));
}

async function convexRun(functionName: string, args?: unknown) {
  const commandArgs = [
    'convex',
    'run',
    '--typecheck',
    'disable',
    '--codegen',
    'disable',
    functionName,
  ];
  if (args !== undefined) commandArgs.push(JSON.stringify(args));
  const { stdout } = await execFileAsync('npx', commandArgs, {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024 * 10,
    timeout: 45_000,
  });
  return parseJsonFromStdout(stdout, functionName);
}

function parseJsonFromStdout(stdout: string, functionName: string) {
  const candidates = jsonSliceCandidates(stdout);
  if (functionName === 'school:recentConversationEvalData') {
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && Array.isArray(parsed.conversations)) return parsed;
      } catch {
        // Keep scanning; Convex logs can be interleaved with JSON.
      }
    }
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Keep scanning; Convex logs can be interleaved with JSON.
    }
  }
  throw new Error(`Could not parse Convex JSON output: ${stdout.slice(0, 500)}`);
}

function jsonSliceCandidates(stdout: string) {
  const candidates: string[] = [];
  const openers = new Set(['{', '[']);
  const matchingCloser: Record<string, string> = { '{': '}', '[': ']' };
  for (let start = 0; start < stdout.length; start += 1) {
    const first = stdout[start];
    if (!openers.has(first)) continue;
    const stack = [matchingCloser[first]];
    let inString = false;
    let escaped = false;
    for (let index = start + 1; index < stdout.length; index += 1) {
      const char = stdout[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (openers.has(char)) {
        stack.push(matchingCloser[char]);
      } else if (char === stack.at(-1)) {
        stack.pop();
        if (!stack.length) {
          candidates.push(stdout.slice(start, index + 1));
          break;
        }
      }
    }
  }
  return candidates.sort((a, b) => b.length - a.length);
}

function printSummary({
  activeConversationId,
  coLocated,
  results,
}: {
  activeConversationId?: string;
  coLocated: boolean;
  results: ReturnType<typeof scoreSample>[];
}) {
  console.log('\nUmi/Mahiru Conversation Harness\n');
  console.log(`World: ${WORLD_ID}`);
  console.log(`Ensure active: ${ENSURE_ACTIVE ? 'yes' : 'no'}${coLocated ? ' (co-located this run)' : ''}`);
  console.log(`Active conversation: ${activeConversationId ?? 'none'}`);
  const rows = results.map((result) => ({
    id: result.sample.id,
    state: result.sample.state,
    messages: result.sample.messages.length,
    status: result.status,
    score: result.customScore.toFixed(2),
    base: result.base.overallScore.toFixed(2),
    identity: result.identityOk ? 'ok' : 'check',
    selfCare: result.selfCareHits.length,
    templateHits: result.templateHits.length,
    fallbackDominated: result.fallbackDominated ? 'yes' : 'no',
    llmEvidence: result.llmEvidenceScore.toFixed(2),
    soul: result.soulDepth.average.toFixed(2),
    otherAware: result.soulDepth.otherAwarenessScore.toFixed(2),
    behavior: result.soulDepth.behaviorSignalScore.toFixed(2),
    mahiruFirst: result.soulDepth.mahiruFirstUmiAwareness.toFixed(2),
    umiDeflect: result.soulDepth.umiDeflectionFatigue.toFixed(2),
    concrete: result.soulDepth.concreteBehaviorScore.toFixed(2),
    sysMetaphor: result.soulDepth.systemMetaphorPenalty.toFixed(2),
    overExplain: result.soulDepth.overExplanationPenalty.toFixed(2),
    binding: result.binding.reciprocalBindingScore.toFixed(2),
    stageDir: result.binding.stageDirectionPenalty.toFixed(2),
    degenerateExit: result.degenerateExit ? 'yes' : 'no',
  }));
  console.table(rows);
  const latest = results[0];
  if (latest) {
    console.log('\nLatest notes:');
    console.log(`- Self-care cues: ${latest.selfCareHits.join(' / ') || 'none'}`);
    console.log(`- Template markers: ${latest.templateHits.join(' / ') || 'none'}`);
    console.log(`- Soul depth: ${latest.soulDepth.notes.join(' / ')}`);
    console.log(
      `- Binding: ${latest.binding.bindingBound}/${latest.binding.bindingTotal} bound (score ${latest.binding.reciprocalBindingScore.toFixed(2)}); stage directions: ${latest.binding.stageDirectionHits} hits (penalty ${latest.binding.stageDirectionPenalty.toFixed(2)})`,
    );
    console.log(`- Top base reason: ${[...latest.base.failures, ...latest.base.warnings][0] ?? 'none'}`);
  }
  console.log(`Report: ${REPORT_PATH}`);
}

async function writeReport({
  activeConversationId,
  coLocated,
  results,
}: {
  activeConversationId?: string;
  coLocated: boolean;
  results: ReturnType<typeof scoreSample>[];
}) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# Umi/Mahiru Conversation Harness',
    '',
    `Generated: ${new Date().toISOString()}`,
    `World: ${WORLD_ID}`,
    `Ensure active: ${ENSURE_ACTIVE ? 'yes' : 'no'}`,
    `Co-located this run: ${coLocated ? 'yes' : 'no'}`,
    `Active conversation: ${activeConversationId ?? 'none'}`,
    '',
    '| Conversation | State | Messages | Status | Score | Base | Soul | Other aware | Behavior | Mahiru first | Umi deflect | Concrete | Binding | Stage dir | Sys metaphor | Over-explain | Degenerate exit | Identity | Self-care cues | Template markers | Fallback dominated | LLM evidence |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|',
    ...results.map((result) =>
      `| ${result.sample.id} | ${result.sample.state} | ${result.sample.messages.length} | ${result.status} | ${result.customScore.toFixed(
        2,
      )} | ${result.base.overallScore.toFixed(2)} | ${result.soulDepth.average.toFixed(2)} | ${result.soulDepth.otherAwarenessScore.toFixed(2)} | ${result.soulDepth.behaviorSignalScore.toFixed(2)} | ${result.soulDepth.mahiruFirstUmiAwareness.toFixed(2)} | ${result.soulDepth.umiDeflectionFatigue.toFixed(2)} | ${result.soulDepth.concreteBehaviorScore.toFixed(2)} | ${result.binding.reciprocalBindingScore.toFixed(2)} | ${result.binding.stageDirectionPenalty.toFixed(2)} | ${result.soulDepth.systemMetaphorPenalty.toFixed(2)} | ${result.soulDepth.overExplanationPenalty.toFixed(2)} | ${result.degenerateExit ? 'yes' : 'no'} | ${result.identityOk ? 'ok' : 'check'} | ${
        result.selfCareHits.length
      } | ${result.templateHits.length} | ${result.fallbackDominated ? 'yes' : 'no'} | ${result.llmEvidenceScore.toFixed(2)} |`,
    ),
    '',
    '## Latest Samples',
    '',
    ...results.slice(0, 5).flatMap((result) => [
      `### ${result.sample.id} (${result.sample.state}) - ${result.status} ${result.customScore.toFixed(2)}`,
      '',
      `Base eval: ${result.base.status} ${result.base.overallScore.toFixed(2)}`,
      `Self-care cues: ${result.selfCareHits.join(' / ') || 'none'}`,
      `Soul depth: ${result.soulDepth.notes.join(' / ')}`,
      `Binding: bound ${result.binding.bindingBound}/${result.binding.bindingTotal} (score ${result.binding.reciprocalBindingScore.toFixed(2)}); stage directions ${result.binding.stageDirectionHits} hits (penalty ${result.binding.stageDirectionPenalty.toFixed(2)})`,
      `Template markers: ${result.templateHits.join(' / ') || 'none'}`,
      `Fallback dominated: ${result.fallbackDominated ? 'yes' : 'no'}`,
      `Degenerate exit: ${result.degenerateExit ? 'yes' : 'no'}`,
      `Reasons: ${[...result.base.failures, ...result.base.warnings].slice(0, 4).join(' | ') || 'none'}`,
      '',
      ...result.sample.messages.map((message) => `> ${message.author}: ${message.text.replace(/\n/g, ' / ')}`),
      '',
    ]),
  ];
  await writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function displayName(name: string) {
  if (name === 'Umi' || name === '海' || name === '朝凪海') return '海';
  if (name === 'Mahiru' || name === 'Mahiru Shiina' || name === '真晝' || name === '椎名真晝') {
    return '真晝';
  }
  return name;
}

function naturalize(text: string) {
  return text
    .replaceAll('Mahiru Shiina', '真晝')
    .replaceAll('Mahiru', '真晝')
    .replaceAll('Umi', '海')
    .replaceAll('椎名真晝', '真晝')
    .trim();
}

function speakerAlternationScore(messages: Message[]) {
  if (messages.length < 2) return 0.5;
  let alternations = 0;
  for (let index = 1; index < messages.length; index += 1) {
    if (displayName(messages[index].author) !== displayName(messages[index - 1].author)) {
      alternations += 1;
    }
  }
  return round2(alternations / (messages.length - 1));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

const SELF_CARE_CUES = [
  '你呢',
  '你自己',
  '力氣',
  '被誰照顧',
  '還好嗎',
  '我在聽',
  '休息',
  '累嗎',
  '輕鬆',
  '少接一件事',
  '先坐一下',
  '也累了',
];

const TEMPLATE_MARKERS = [
  '今晚你最想先確認誰還好嗎',
  '今天午休時，有幾個人明明坐在一起',
  '你一直在看別人還好不好',
  '你今天有被誰照顧到嗎',
  '現在的你還有力氣繼續聽別人說話嗎',
  '不是因為事情很大，是因為大家開始連小話都不太敢說了',
  '今晚先少接一件事。明天我會提醒 Alan',
  '我剛剛已經說過一次',
  '我換個說法',
  '先不要重複',
  '先停一下',
  '妳又把別人的心事先接住了',
  '我聽見了。只是我也想確認',
  '我會提醒 Alan 先看見學生的不安',
  '我會把學生不安放進明天簡報',
  '把擔心包成更漂亮的句子',
  '我想去看看今天一直安靜的學生',
  '我先去確認那些說自己沒事的人',
  '等我確認幾個學生的狀態',
  '我剛剛想到的不是規則',
  '上一句',
  '真晧',
  '真晚',
  '同志',
  '大家辛苦',
  '提前開始',
  '等你睡覺',
  '睡覺去了',
  '好，感謝',
  '復習課',
  '複習課',
  '繼續休息吧',
  '您好',
  '日程安排',
  '活動安排',
  '隨時找我',
  '打發時間',
  '承認自己的狀態',
  '反問海',
  '多問一下',
  '能讓我知道',
  '一起說個什麼',
  '真晩',
  '太有意思',
  '課程',
  '課後',
  '哪一堂',
  '有什麼感受',
  'talking',
  '睡眠质量',
  '睡眠質量',
  '尝试',
  '嘗試',
  '建議',
  '小貼士',
  '推薦',
  '管理',
  '生活空間',
];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

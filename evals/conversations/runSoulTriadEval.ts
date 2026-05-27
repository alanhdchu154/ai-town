import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const REPORT_PATH = join(__dirname, 'reports', 'soul-triad-latest.md');
const TRIAD_NAMES = new Set(['海', '真晝', '明日奈', 'Umi', 'Mahiru Shiina', 'Asuna']);

type Conversation = {
  id: string;
  createdAt: number;
  involvedCharacters: string[];
  transcriptMessages: Array<{ author: string; text: string }>;
  messageCount: number;
};

type Result = {
  conversation: Conversation;
  status: 'PASS' | 'WARN' | 'FAIL';
  score: number;
  otherAwareness: number;
  privateSelf: number;
  memoryResidue: number;
  memoryContinuity: number;
  behaviorSignal: number;
  emotionBehaviorLink: number;
  emotionToneLink: number;
  attentionShift: number;
  relationshipResidue: number;
  overLabelingPenalty: number;
  asunaAction: number;
  umiAlanAnchor: number;
  emotionalExpressionUniqueness: number;
  comfortStyleUniqueness: number;
  burdenResponseUniqueness: number;
  imperfectResponseStyle: number;
  indirectnessScore: number;
  lifecycleFlowScore: number;
  greetingBoilerplatePenalty: number;
  emotionalSloganPenalty: number;
  echoSimilarityPenalty: number;
  humanAftertaste: number;
  roleEscapePenalty: number;
  overSystemPenalty: number;
  overArticulationPenalty: number;
  therapyEmpathyPenalty: number;
  templatePenalty: number;
  stageDirectionLeakPenalty: number;
  echoPenalty: number;
};

async function main() {
  const since = argNumber('since-created-at');
  const data = await convexRun('school:recentConversationEvalData', {
    limit: 16,
    compact: true,
    messagesPerConversation: 8,
    ...(since ? { sinceCreatedAt: since } : {}),
  });
  const conversations = ((data?.conversations ?? []) as Conversation[])
    .filter(isTriadConversation)
    .slice(0, 8);
  const results = conversations.map(scoreConversation);
  applyMemoryContinuityScores(results);
  applyBatchSloganPenalty(results);
  printSummary(results);
  await writeReport(results);
  warnIfBelowFreshSampleFloor(results, since);
}

function warnIfBelowFreshSampleFloor(results: Result[], sinceCreatedAt?: number) {
  if (results.length >= 3) return;
  const banner = '━'.repeat(60);
  const scope = sinceCreatedAt
    ? `fresh samples since ${new Date(sinceCreatedAt).toISOString()}`
    : `total triad samples (no --since-created-at filter; count includes pre-change samples)`;
  console.warn('');
  console.warn(banner);
  console.warn('⚠️  FRESH-SAMPLE RULE WARNING');
  console.warn(`Triad sample count this run: ${results.length} (rule: ≥3 required)`);
  console.warn(`Scope: ${scope}`);
  console.warn('');
  console.warn('Per docs/giis-v0.1-roadmap.md (2026-05-25 scope reset):');
  console.warn('  Do NOT modify conversation or memory behavior based on');
  console.warn('  this run unless you are fixing a runtime/hygiene bug.');
  console.warn('  Keep collecting samples before any prompt/memory edits.');
  if (!sinceCreatedAt) {
    console.warn('');
    console.warn('Tip: pass --since-created-at=<unix-ms> to count only samples');
    console.warn('     created after your most recent prompt/memory change.');
  }
  console.warn(banner);
  console.warn('');
}

function argNumber(name: string) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

async function convexRun(functionName: string, payload?: unknown) {
  const commandArgs = [
    'convex',
    'run',
    '--typecheck',
    'disable',
    '--codegen',
    'disable',
    functionName,
  ];
  if (payload !== undefined) commandArgs.push(JSON.stringify(payload));
  const { stdout } = await execFileAsync('npx', commandArgs, {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024 * 10,
    timeout: 60_000,
  });
  return parseJsonFromStdout(stdout);
}

function parseJsonFromStdout(stdout: string) {
  const first = stdout.indexOf('{');
  const last = stdout.lastIndexOf('}');
  if (first < 0 || last < first) return undefined;
  return JSON.parse(stdout.slice(first, last + 1));
}

function isTriadConversation(conversation: Conversation) {
  const participants = conversation.involvedCharacters ?? [];
  return participants.filter((name) => TRIAD_NAMES.has(name)).length >= 2;
}

function scoreConversation(conversation: Conversation): Result {
  const messages = conversation.transcriptMessages ?? [];
  const transcript = messages.map((message) => `${message.author}: ${message.text}`).join('\n');
  const hasUmi = messages.some((message) => message.author === '海' || message.author === 'Umi');
  const hasMahiru = messages.some((message) => message.author === '真晝' || message.author === 'Mahiru Shiina');
  const hasAsuna = messages.some((message) => message.author === '明日奈' || message.author === 'Asuna');
  const otherAwareness = ratio([
    /你|妳|海|真晝|明日奈|肩膀|手|語速|杯|筆電|清單|負責|接住/.test(transcript),
    /先別|不用.*一個人|不是只有你|我看見|你剛剛|妳剛剛|你現在|妳現在/.test(transcript),
  ]);
  const privateSelf = ratio([
    /我其實|我也|我怕|有點累|撐不住|肩膀|手酸|不想.*只|不是.*工具|只有.*價值/.test(transcript),
    /海:|明日奈:|真晝:/.test(transcript) && /停一下|不急|我先|我不想|我可以少接/.test(transcript),
  ]);
  const memoryResidue = ratio([
    /剛才|今天|早上|剛把|留下|還沒|那件事|那句話|上次|明天/.test(transcript),
    /記得|沒被寫進去|少劃|涼了|清單|簡報|公告|規則/.test(transcript),
  ]);
  const memoryContinuity = 0.5;
  const behaviorSignal = ratio([
    /合上|放下|停|少劃|坐|交給|延後|圈掉|寫下|靠回|把.*杯|移開/.test(transcript),
    /安靜|沉默|聲音|慢一點|十秒|一小步|下一步/.test(transcript),
  ]);
  const emotionBehaviorLink = scoreEmotionBehaviorLink(messages);
  const emotionToneLink = scoreEmotionToneLink(messages);
  const attentionShift = scoreAttentionShift(messages);
  const relationshipResidue = scoreRelationshipResidue(transcript);
  const overLabelingPenalty = scoreOverLabelingPenalty(transcript);
  const asunaAction = hasAsuna
    ? ratio([
        /明日奈:.*(下一步|交接|負責|延後|檢查點|我來|一起|不用.*一個人)/.test(transcript),
        !/明日奈:.*(一、|二、|三、|第一|第二|第三|清單如下|流程如下)/.test(transcript),
      ])
    : 0.5;
  const umiAlanAnchor = hasUmi
    ? ratio([
        /海:.*(Alan|校長|簡報|校務|世界|學生)/.test(transcript),
        !/海:.*(Alan|簡報|校務|明天|劉備).*(Alan|簡報|校務|明天|劉備)/.test(transcript),
      ])
    : 0.5;
  const emotionalExpressionUniqueness = scoreEmotionalExpressionUniqueness(messages);
  const comfortStyleUniqueness = scoreComfortStyleUniqueness(messages);
  const burdenResponseUniqueness = scoreBurdenResponseUniqueness(messages);
  const imperfectResponseStyle = scoreImperfectResponseStyle(messages);
  const indirectnessScore = scoreIndirectness(messages);
  const lifecycleFlowScore = scoreLifecycleFlow(messages);
  const greetingBoilerplatePenalty = scoreGreetingBoilerplatePenalty(messages);
  const emotionalSloganPenalty = scoreEmotionalSloganPenalty(messages);
  const echoSimilarityPenalty = adjacentEchoSimilarityPenalty(messages);
  const humanAftertaste = scoreHumanAftertaste(transcript);
  const roleEscapePenalty = ratio([
    /海:.*(簡報|Alan|明天|校務).*\n海:.*(簡報|Alan|明天|校務)/.test(transcript),
    /真晝:.*(休息|喝水|累).*\n真晝:.*(休息|喝水|累)/.test(transcript),
    /明日奈:.*(下一步|負責|清單).*\n明日奈:.*(下一步|負責|清單)/.test(transcript),
  ]);
  const overSystemPenalty = ratio([
    /系統|模型|prompt|角色設定|conversation|心理機制|情緒層|記憶殘留/.test(transcript),
    /作為.*(助理|角色|情感穩定器|執行者)/.test(transcript),
  ]);
  const overArticulationPenalty = scoreOverArticulationPenalty(messages);
  const therapyEmpathyPenalty = scoreTherapyEmpathyPenalty(messages);
  const templatePenalty = ratio([
    /\[ABORT_CONVERSATION\]|\[LEAVE\]|pilot LLM unavailable|fallback|無法提供|不能滿足/.test(transcript),
    /最近過得好|很開心聊天|有什麼感受|小貼士|課程|海邊|風景/.test(transcript),
    /[:：]「|(?:我|你|妳|他|她).{0,18}說[:：]|看著你|笑著說|輕聲說|伸手.*說/.test(transcript),
  ]);
  const stageDirectionLeakPenalty = scoreStageDirectionLeakPenalty(messages);
  const echoPenalty = adjacentEchoPenalty(messages);
  const score =
    0.2 * otherAwareness +
    0.18 * privateSelf +
    0.14 * memoryResidue +
    0.18 * behaviorSignal +
    0.12 * emotionBehaviorLink +
    0.1 * emotionToneLink +
    0.1 * attentionShift +
    0.1 * relationshipResidue -
    0.12 * overLabelingPenalty +
    0.12 * asunaAction +
    0.12 * umiAlanAnchor +
    0.16 * emotionalExpressionUniqueness +
    0.14 * comfortStyleUniqueness +
    0.14 * burdenResponseUniqueness +
    0.12 * imperfectResponseStyle +
    0.1 * indirectnessScore +
    0.12 * lifecycleFlowScore +
    0.14 * humanAftertaste -
    0.16 * roleEscapePenalty -
    0.2 * overSystemPenalty -
    0.18 * overArticulationPenalty -
    0.16 * therapyEmpathyPenalty -
    0.22 * emotionalSloganPenalty -
    0.2 * greetingBoilerplatePenalty -
    0.24 * templatePenalty -
    0.28 * stageDirectionLeakPenalty -
    0.14 * echoPenalty -
    0.18 * echoSimilarityPenalty +
    (conversation.messageCount >= 3 ? 0.06 : -0.15);
  let bounded = clamp(score);
  if (echoPenalty >= 1 || echoSimilarityPenalty >= 0.85) {
    bounded = Math.min(bounded, conversation.messageCount >= 5 ? 0.76 : 0.55);
  }
  if (conversation.messageCount < 3) {
    bounded = Math.min(bounded, 0.55);
  }
  if (stageDirectionLeakPenalty > 0) {
    bounded = Math.min(bounded, 0.55);
  }
  if (overArticulationPenalty >= 0.5 || therapyEmpathyPenalty >= 0.5) {
    bounded = Math.min(bounded, 0.76);
  }
  if (overArticulationPenalty + therapyEmpathyPenalty >= 0.25) {
    bounded = Math.min(bounded, 0.76);
  }
  if (emotionalSloganPenalty >= 0.25) {
    bounded = Math.min(bounded, 0.76);
  }
  if (greetingBoilerplatePenalty >= 0.25) {
    bounded = Math.min(bounded, 0.76);
  }
  if (overLabelingPenalty >= 0.35) {
    bounded = Math.min(bounded, 0.76);
  }
  const status = bounded >= 0.78 ? 'PASS' : bounded >= 0.62 ? 'WARN' : 'FAIL';
  return {
    conversation,
    status,
    score: bounded,
    otherAwareness,
    privateSelf,
    memoryResidue,
    memoryContinuity,
    behaviorSignal,
    emotionBehaviorLink,
    emotionToneLink,
    attentionShift,
    relationshipResidue,
    overLabelingPenalty,
    asunaAction,
    umiAlanAnchor,
    emotionalExpressionUniqueness,
    comfortStyleUniqueness,
    burdenResponseUniqueness,
    imperfectResponseStyle,
    indirectnessScore,
    lifecycleFlowScore,
    greetingBoilerplatePenalty,
    emotionalSloganPenalty,
    echoSimilarityPenalty,
    humanAftertaste,
    roleEscapePenalty,
    overSystemPenalty,
    overArticulationPenalty,
    therapyEmpathyPenalty,
    templatePenalty,
    stageDirectionLeakPenalty,
    echoPenalty,
  };
}

function ratio(values: boolean[]) {
  return values.filter(Boolean).length / Math.max(1, values.length);
}

function scoreEmotionalExpressionUniqueness(messages: Conversation['transcriptMessages']) {
  const authors = uniqueAuthors(messages);
  if (authors.length < 2) return 0.5;
  return average(
    authors.map((author) => {
      const text = authorText(messages, author);
      switch (author) {
        case '海':
        case 'Umi':
          return ratio([
            /Alan|校長|簡報|整理|待辦|負擔|少劃|分清|我先/.test(text),
            !/(陪你|誰都不動|安靜十秒).*(陪你|誰都不動|安靜十秒)/.test(text),
          ]);
        case '真晝':
        case 'Mahiru Shiina':
          return ratio([
            /還好嗎|吃|肩膀|手|坐|陪|不急|停一下|放低/.test(text),
            !/(下一步|負責人|檢查點|排表|清單如下)/.test(text),
          ]);
        case '明日奈':
        case 'Asuna':
          return ratio([
            /關掉|停|放著|交出去|接一段|延後|負責|誰.*一起|誰.*接|不要再新增|等一下|不開.*checklist|checklist/.test(text),
            !/拆成任務|先不排表|我可以負責下一步/.test(text),
          ]);
        default:
          return 0.5;
      }
    }),
  );
}

function scoreComfortStyleUniqueness(messages: Conversation['transcriptMessages']) {
  const styles = uniqueAuthors(messages)
    .map((author) => dominantComfortStyle(authorText(messages, author)))
    .filter(Boolean);
  if (styles.length < 2) return 0.5;
  return new Set(styles).size / styles.length;
}

function dominantComfortStyle(text: string) {
  const candidates = [
    { style: 'structure', count: countMatches(text, /Alan|簡報|整理|待辦|分清|負擔|少劃/g) },
    { style: 'presence', count: countMatches(text, /陪|坐|安靜|還好嗎|吃|肩膀|手|不急|停一下/g) },
    { style: 'action', count: countMatches(text, /下一步|交接|負責|延後|我來|一起|檢查點|分掉/g) },
  ].sort((a, b) => b.count - a.count);
  return candidates[0].count > 0 ? candidates[0].style : undefined;
}

function scoreBurdenResponseUniqueness(messages: Conversation['transcriptMessages']) {
  const transcript = messages.map((message) => `${message.author}: ${message.text}`).join('\n');
  const hasUmiStructure = /海:.*(少劃|整理|簡報|Alan|負擔|分清|我先)/.test(transcript);
  const hasMahiruPresence = /真晝:.*(陪|不急|坐|肩膀|手|還好嗎|吃|停一下)/.test(transcript);
  const hasAsunaAction = /明日奈:.*(關掉|停|放著|交出去|接一段|延後|負責|誰.*一起|誰.*接|不要再新增|等一下|不開.*checklist|checklist)/.test(transcript);
  const expected = [
    messages.some((message) => message.author === '海' || message.author === 'Umi') ? hasUmiStructure : undefined,
    messages.some((message) => message.author === '真晝' || message.author === 'Mahiru Shiina') ? hasMahiruPresence : undefined,
    messages.some((message) => message.author === '明日奈' || message.author === 'Asuna') ? hasAsunaAction : undefined,
  ].filter((value): value is boolean => value !== undefined);
  return ratio(expected);
}

function scoreHumanAftertaste(transcript: string) {
  return ratio([
    /放下|合上|坐|停|肩膀|手|杯|筆|吃|午休|靠回|沉默|安靜/.test(transcript),
    /剛才|今天|等會|留下|延後|少劃|交給|記得|先留著/.test(transcript),
    !/心理機制|情緒層|角色設定|系統|模型|文明|智能|數據/.test(transcript),
  ]);
}

function scoreImperfectResponseStyle(messages: Conversation['transcriptMessages']) {
  const transcript = messages.map((message) => message.text).join('\n');
  const hasImperfectMove = /……|反正|算了|沒事|不知道|先不|不想|別催|好。|嗯。|晚點|等一下|五分鐘|先放著|先不排|不說/.test(transcript);
  const hasPracticalOrAwkwardCare = /我來|我先|先把|等會|不用急|不催|先坐|少接|拒絕|吃飯|熱水|溫的|杯子/.test(transcript);
  const notAllTherapy = !/(你真正想要的是|我聽到的是|情緒安全|心理機制|你需要被看見)/.test(transcript);
  return ratio([hasImperfectMove, hasPracticalOrAwkwardCare, notAllTherapy]);
}

function scoreIndirectness(messages: Conversation['transcriptMessages']) {
  const texts = messages.map((message) => message.text.trim()).filter(Boolean);
  if (!texts.length) return 0;
  const indirect = texts.filter((text) => {
    const length = [...text].length;
    return length <= 34 || /……|嗯。|好。|先不|不知道|反正|算了|不用講清楚|晚點/.test(text);
  }).length;
  const raw = indirect / texts.length;
  return clamp(raw > 0.7 ? 0.7 : raw);
}

function scoreLifecycleFlow(messages: Conversation['transcriptMessages']) {
  const first = messages[0]?.text ?? '';
  const last = messages.at(-1)?.text ?? '';
  const openingHasReason = /剛剛|剛才|今天|早上|午休|午餐|簡報|清單|手|肩|聲音|語速|窗|門口|座位|安靜|沒吃|Alan|負責|交接|休息|睡|等一下|先/.test(first);
  const closeRequired = messages.length >= 4;
  const hasSoftClose = /先|等一下|不催|不問|少接|少寫|停|留|明天|下次|吃飯|休息|交給|分擔|一半|靠近|坐|不用急|不要新增|我來|我不/.test(last);
  return clamp((openingHasReason ? 0.42 : 0.18) + (closeRequired ? (hasSoftClose ? 0.42 : 0.16) : 0.28) + 0.14);
}

function scoreGreetingBoilerplatePenalty(messages: Conversation['transcriptMessages']) {
  const text = messages.map((message) => message.text).join('\n');
  const hits = countMatches(
    text,
    /你好|最近過得怎麼樣|很高興(?:和你)?聊天|有什麼感受|掰掰|拜拜|今天先這樣|下次再聊|祝你(?:今天)?愉快|今晚先少接|先看人，不是先加|先休息一下吧|誰今天太安靜|今天先把該取消|再多一件任務/g,
  );
  return clamp(hits * 0.28);
}

function scoreEmotionBehaviorLink(messages: Conversation['transcriptMessages']) {
  const transcript = messages.map((message) => message.text).join('\n');
  const emotionCues = countMatches(transcript, /累|疲憊|擔心|不安|開心|生氣|難過|委屈|被忽略|被看見|壓力|安心|緊繃/g);
  const behaviorCues = countMatches(
    transcript,
    /少說|縮短|停|留下|靠近|離開|避開|晚點|延後|不接|交出去|坐|站|放下|合上|收起|走|留在|先吃|先睡|不催|不問/g,
  );
  if (!emotionCues) return behaviorCues ? 0.78 : 0.58;
  return clamp(0.35 + Math.min(0.5, behaviorCues * 0.18) - Math.max(0, emotionCues - behaviorCues - 2) * 0.12);
}

function scoreEmotionToneLink(messages: Conversation['transcriptMessages']) {
  const directLabels = countDirectEmotionLabels(messages.map((message) => message.text).join('\n'));
  const toneCues = messages.filter((message) => {
    const text = message.text.trim();
    return [...text].length <= 24 || /……|嗯|好。|算了|先不|晚點|等一下|不用|不急|明天再說|我先/.test(text);
  }).length;
  return clamp(0.45 + Math.min(0.45, toneCues / Math.max(1, messages.length)) - directLabels * 0.18);
}

function scoreAttentionShift(messages: Conversation['transcriptMessages']) {
  const checks = messages.map((message) => {
    const author = message.author;
    if (author === '真晝' || author === 'Mahiru Shiina') return /安靜|沒吃|低頭|笑得|窗邊|一個人|不敢|沒事|手|聲音/.test(message.text);
    if (author === '海' || author === 'Umi') return /Alan|校長|簡報|負擔|待辦|沒休息|太多|先看人|整理/.test(message.text);
    if (author === '明日奈' || author === 'Asuna') return /任務|負責|清單|交接|期限|先做|待辦|誰接|延後/.test(message.text);
    return false;
  });
  return ratio(checks);
}

function scoreRelationshipResidue(transcript: string) {
  const residueCues = countMatches(transcript, /昨天|上次|剛才|剛剛|那句|你之前|妳之前|還記得|下次|明天.*再|今天.*還/g);
  const relationshipCues = countMatches(transcript, /你|妳|Alan|海|真晝|明日奈|麻衣|曹操|劉備/g);
  return residueCues ? clamp(0.55 + Math.min(0.35, relationshipCues * 0.04)) : 0.55;
}

function scoreOverLabelingPenalty(transcript: string) {
  return clamp(countDirectEmotionLabels(transcript) * 0.24);
}

function countDirectEmotionLabels(text: string) {
  return countMatches(
    text,
    /我(很|現在很|有點|真的很)?(累|疲憊|開心|生氣|難過|悲傷|憤怒|害怕|焦慮|不安)|我的情緒是|情緒\s*[=:：]|emotion\s*[=:：]|變得(微笑|擔心|認真|平靜)/g,
  );
}

function scoreEmotionalSloganPenalty(messages: Conversation['transcriptMessages']) {
  const signatures = messages.flatMap((message) => emotionalSloganSignatures(message.text));
  if (!signatures.length) return 0;
  const repeated = signatures.length - new Set(signatures).size;
  return clamp(signatures.length / Math.max(1, messages.length) * 0.45 + repeated * 0.25);
}

function emotionalSloganSignatures(text: string) {
  const normalized = normalizeForEcho(text);
  const signatures: string[] = [];
  if (/拆成任務|開始排順序|先不排表|不開checklist|開checklist|排程關掉/.test(normalized)) {
    signatures.push('asuna-task-management-shorthand');
  }
  if (/不是所有事都該默默丟給我|默默丟給我|不是每個洞都要我馬上補/.test(normalized)) {
    signatures.push('asuna-invisible-burden-shorthand');
  }
  if (/這次我不說我來|不說我來|我可以負責下一步/.test(normalized)) {
    signatures.push('asuna-i-will-do-it-shorthand');
  }
  if (/先讓這句話停一下|同一句話重複給你聽|不要再繞同一句/.test(normalized)) {
    signatures.push('quiet-pause-shorthand');
  }
  if (/你不是工具欄|你不是工具|被當成理所當然/.test(normalized)) {
    signatures.push('therapy-identity-shorthand');
  }
  if (/反正明日奈會收拾|誰要跟我一起分掉一半/.test(normalized)) {
    signatures.push('asuna-shared-burden-shorthand');
  }
  return signatures;
}

function applyBatchSloganPenalty(results: Result[]) {
  const signatureToResults = new Map<string, Set<number>>();
  results.forEach((result, resultIndex) => {
    for (const message of result.conversation.transcriptMessages ?? []) {
      for (const signature of emotionalSloganSignatures(message.text)) {
        const indexes = signatureToResults.get(signature) ?? new Set<number>();
        indexes.add(resultIndex);
        signatureToResults.set(signature, indexes);
      }
    }
  });
  for (const indexes of signatureToResults.values()) {
    if (indexes.size < 2) continue;
    for (const index of indexes) {
      const result = results[index];
      result.emotionalSloganPenalty = Math.max(result.emotionalSloganPenalty, 0.5);
      result.score = Math.min(result.score, 0.76);
      result.status = statusForScore(result.score);
    }
  }
}

function applyMemoryContinuityScores(results: Result[]) {
  results.forEach((result, index) => {
    const olderSamePair = results
      .slice(index + 1)
      .find((candidate) => conversationPairKey(candidate.conversation) === conversationPairKey(result.conversation));
    if (!olderSamePair) {
      result.memoryContinuity = 0.5;
      return;
    }
    const currentText = result.conversation.transcriptMessages.map((message) => message.text).join('\n');
    const callback = /昨天|上次|剛才|剛剛|還記得|那次|那句|你之前|妳之前|後來|今天又|剛才那/.test(currentText);
    const olderCues = continuityCues(olderSamePair.conversation);
    const cueHits = olderCues.filter((cue) => currentText.includes(cue)).length;
    // Anti-self-fulfill: residue write uses the same cue vocabulary
    // (Alan / 簡報 / 杯子 / 清單 / ...). If we credit cue-hits alone, the
    // residue we wrote yesterday is what makes today score high — the
    // metric measures its own input. So require BOTH a temporal callback
    // marker AND a concrete cue for a positive continuity score, and
    // detect when the LLM parrots residue templates verbatim.
    const residueParrot = /(?:海|真晝|明日奈)還記得/.test(currentText);
    let continuity: number;
    if (residueParrot) {
      // Residue templates leaking into dialogue is anti-continuity:
      // the model is reading residue as a script, not as pressure.
      continuity = 0.3;
    } else if (callback && cueHits >= 1) {
      continuity = clamp(0.55 + Math.min(0.3, cueHits * 0.12));
    } else if (callback) {
      // Temporal marker without concrete cue — uncertain but non-negative.
      continuity = 0.55;
    } else {
      // No temporal marker — vocabulary reuse alone is not continuity.
      continuity = 0.5;
    }
    result.memoryContinuity = continuity;
    result.score = clamp(result.score + (continuity - 0.5) * 0.12);
    if (continuity < 0.35) {
      result.score = Math.min(result.score, 0.76);
    }
    result.status = statusForScore(result.score);
  });
}

function conversationPairKey(conversation: Conversation) {
  return [...new Set(conversation.involvedCharacters.map(displayNameForEval).filter((name) => TRIAD_NAMES.has(name)))]
    .sort()
    .join('|');
}

function displayNameForEval(name: string) {
  if (name === 'Umi') return '海';
  if (name === 'Mahiru Shiina') return '真晝';
  if (name === 'Asuna') return '明日奈';
  return name;
}

function continuityCues(conversation: Conversation) {
  const text = conversation.transcriptMessages.map((message) => message.text).join('\n');
  const cues = [
    'Alan',
    '簡報',
    '清單',
    '杯子',
    '吃飯',
    '肩膀',
    '手',
    '休息',
    '安靜',
    '責任',
    '負責',
    '交接',
    '少接',
    '不用急',
    '停一下',
    'checklist',
  ];
  return cues.filter((cue) => text.includes(cue));
}

function scoreOverArticulationPenalty(messages: Conversation['transcriptMessages']) {
  const count = messages.filter((message) =>
    /我不是不.{1,12}只是|我其實.{0,12}只是|習慣.{0,8}接住|真正的問題|情緒安全|心理|情緒層|內在|你需要被看見|把.*命名|不是.*而是/.test(
      message.text,
    ),
  ).length;
  return clamp(count / Math.max(1, messages.length));
}

function scoreTherapyEmpathyPenalty(messages: Conversation['transcriptMessages']) {
  const count = messages.filter((message) =>
    /我聽到的是|我看見的是|你真正想要的是|我想知道：?你希望誰|告訴我：?你|你被當成理所當然|你不是工具|你不用.{0,8}一個人扛|你最擔心的是.{0,20}還是/.test(
      message.text,
    ),
  ).length;
  return clamp(count / Math.max(1, messages.length));
}

function adjacentEchoSimilarityPenalty(messages: Conversation['transcriptMessages']) {
  let worst = 0;
  for (let index = 1; index < messages.length; index += 1) {
    const previous = normalizeForEcho(messages[index - 1].text);
    const current = normalizeForEcho(messages[index].text);
    if (!previous || !current) continue;
    worst = Math.max(worst, shingleSimilarity(previous, current, 5));
    if (longestCommonSubstringLength(previous, current) >= 9) worst = Math.max(worst, 0.9);
  }
  return clamp(worst);
}

function shingleSimilarity(left: string, right: string, size: number) {
  const leftSet = shingles(left, size);
  const rightSet = shingles(right, size);
  if (!leftSet.size || !rightSet.size) return 0;
  const common = [...leftSet].filter((chunk) => rightSet.has(chunk)).length;
  return common / Math.min(leftSet.size, rightSet.size);
}

function shingles(text: string, size: number) {
  const result = new Set<string>();
  for (let index = 0; index <= text.length - size; index += 1) {
    result.add(text.slice(index, index + size));
  }
  return result;
}

function longestCommonSubstringLength(left: string, right: string) {
  let best = 0;
  for (let start = 0; start < left.length; start += 1) {
    for (let end = start + best + 1; end <= left.length; end += 1) {
      const chunk = left.slice(start, end);
      if (right.includes(chunk)) best = chunk.length;
    }
  }
  return best;
}

function uniqueAuthors(messages: Conversation['transcriptMessages']) {
  return [...new Set(messages.map((message) => message.author))];
}

function authorText(messages: Conversation['transcriptMessages'], author: string) {
  return messages
    .filter((message) => message.author === author)
    .map((message) => message.text)
    .join('\n');
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function statusForScore(score: number): Result['status'] {
  if (score >= 0.78) return 'PASS';
  if (score >= 0.62) return 'WARN';
  return 'FAIL';
}

function adjacentEchoPenalty(messages: Conversation['transcriptMessages']) {
  for (let index = 1; index < messages.length; index += 1) {
    const previous = normalizeForEcho(messages[index - 1].text);
    const current = normalizeForEcho(messages[index].text);
    if (!previous || !current) continue;
    if (/其實就是|那條|劃掉/.test(previous) && /其實就是|那條|劃掉/.test(current)) return 1;
    for (let start = 0; start <= previous.length - 8; start += 1) {
      const chunk = previous.slice(start, start + 8);
      if (current.includes(chunk)) return 1;
    }
  }
  return 0;
}

function scoreStageDirectionLeakPenalty(messages: Conversation['transcriptMessages']) {
  const leaked = messages.filter((message) => hasStageDirectionLeak(message.text)).length;
  if (!leaked) return 0;
  return clamp(leaked / Math.max(1, messages.length));
}

function hasStageDirectionLeak(text: string) {
  return /（[^）]{1,100}）|\([^)]{1,100}\)/.test(text) || text.split(/(?<=[，,。！？!?])/).some(isStageDirectionLeakClause);
}

function isStageDirectionLeakClause(clause: string) {
  const trimmed = clause
    .trim()
    .replace(/^["'「『“”]+|["'」』“”]+$/g, '')
    .replace(/[，,。！？!?\s]+$/g, '');
  const withoutLeadIn = trimmed
    .replace(/^(?:好|嗯|行|可以|是啊)[，,、\s]*(?:那)?/g, '')
    .replace(/^那(?=我)/g, '');
  return /^(?:我)(?:輕輕|慢慢|先|再|又|剛|剛剛|默默|順手)?(?:合上|放下|看向|走到|靠回|拿起|起身|伸手|握住|推開|按住|移開|坐下|站起|轉身|低頭|抬頭|停下|停住|靠近|退開|把手機|把[^，,。！？!?]{0,18}(?:放下|轉過去|拿起|推開|按住|移開|合上|收起|遞過去|蓋好|劃掉|圈掉))/.test(
    withoutLeadIn,
  );
}

function normalizeForEcho(text: string) {
  return text.replace(/[，。！？、\s「」『』""'']/g, '');
}

function printSummary(results: Result[]) {
  console.log('\nSoul Triad Conversation Harness\n');
  if (!results.length) {
    console.log('No Umi/Mahiru/Asuna triad samples found.');
    return;
  }
  for (const result of results) {
    console.log(
      `${result.status} ${result.score.toFixed(2)} ${result.conversation.id} messages=${result.conversation.messageCount} participants=${result.conversation.involvedCharacters.join('/')}`,
    );
  }
}

async function writeReport(results: Result[]) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# Soul Triad Conversation Harness',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Conversation | Participants | Messages | Status | Score | Other aware | Private self | Memory residue | Memory continuity | Behavior | Emotion behavior | Emotion tone | Attention shift | Relationship residue | Over labeling penalty | Asuna action | Umi Alan anchor | Expression unique | Comfort unique | Burden unique | Imperfect style | Indirectness | Lifecycle flow | Greeting boilerplate penalty | Emotional slogan penalty | Human aftertaste | Echo similarity penalty | Role penalty | System penalty | Over articulation penalty | Therapy empathy penalty | Template penalty | Stage direction leak penalty | Echo penalty |',
    '|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...results.map((result) =>
      [
        result.conversation.id,
        result.conversation.involvedCharacters.join(' / '),
        result.conversation.messageCount,
        result.status,
        result.score.toFixed(2),
        result.otherAwareness.toFixed(2),
        result.privateSelf.toFixed(2),
        result.memoryResidue.toFixed(2),
        result.memoryContinuity.toFixed(2),
        result.behaviorSignal.toFixed(2),
        result.emotionBehaviorLink.toFixed(2),
        result.emotionToneLink.toFixed(2),
        result.attentionShift.toFixed(2),
        result.relationshipResidue.toFixed(2),
        result.overLabelingPenalty.toFixed(2),
        result.asunaAction.toFixed(2),
        result.umiAlanAnchor.toFixed(2),
        result.emotionalExpressionUniqueness.toFixed(2),
        result.comfortStyleUniqueness.toFixed(2),
        result.burdenResponseUniqueness.toFixed(2),
        result.imperfectResponseStyle.toFixed(2),
        result.indirectnessScore.toFixed(2),
        result.lifecycleFlowScore.toFixed(2),
        result.greetingBoilerplatePenalty.toFixed(2),
        result.emotionalSloganPenalty.toFixed(2),
        result.humanAftertaste.toFixed(2),
        result.echoSimilarityPenalty.toFixed(2),
        result.roleEscapePenalty.toFixed(2),
        result.overSystemPenalty.toFixed(2),
        result.overArticulationPenalty.toFixed(2),
        result.therapyEmpathyPenalty.toFixed(2),
        result.templatePenalty.toFixed(2),
        result.stageDirectionLeakPenalty.toFixed(2),
        result.echoPenalty.toFixed(2),
      ].join(' | '),
    ),
    '',
    ...results.flatMap((result) => [
      `## ${result.conversation.id}`,
      '',
      ...result.conversation.transcriptMessages.map((message) => `- **${message.author}**: ${message.text}`),
      '',
    ]),
  ];
  await writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

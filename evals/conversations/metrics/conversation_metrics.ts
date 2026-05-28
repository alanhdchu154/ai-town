export type ConversationEvalStatus = 'PASS' | 'WARN' | 'FAIL';

export type ConversationEvalCase = {
  name: string;
  mode: 'companion_chat' | 'world_agent_chat';
  speaker: string;
  target: string;
  input: string;
  sampleOutput: string;
  expected?: {
    shouldFail?: boolean;
    respondsDirectlyTo?: string[];
    bindsToPrevious?: string[];
    characterVoice?: string[];
    emotionalSpecificity?: string[];
    sceneDetails?: string[];
    maxSceneDetails?: number;
    allowSceneDetails?: boolean;
    focusedQuestionCount?: number;
    maxCharacters?: number;
  };
};

export type MetricResult = {
  name: string;
  score: number;
  status: ConversationEvalStatus;
  notes: string[];
};

export type ConversationEvalResult = {
  caseName: string;
  mode: ConversationEvalCase['mode'];
  overallScore: number;
  status: ConversationEvalStatus;
  failures: string[];
  warnings: string[];
  metrics: MetricResult[];
};

export type ConversationJudgeResult = {
  naturalness: 1 | 2 | 3 | 4 | 5;
  emotional_binding: 1 | 2 | 3 | 4 | 5;
  character_consistency: 1 | 2 | 3 | 4 | 5;
  repetition: 1 | 2 | 3 | 4 | 5;
  notes: string;
};

const BANNED_PHRASES = [
  '這件事也不能忽略',
  '最近校園裡有些事還在發酵',
  '我先不把它整理成報告',
  '我先去整理一下',
  'Alan 又開始把所有人的不安都放進自己腦袋',
  '它可能正在改變大家理解這個世界的方式',
  'conversationOutcome',
  '形成意圖',
  '世界協調報告',
  '世界協調',
  '校園情緒地圖',
  '我看見你',
  '你最擔心的是',
  '先把它放下',
  '掃描教室',
  '自行覺醒',
  '任務和支援',
  '明細已經拿到',
  '名單已交接清楚',
  '整理明天的流程',
  '是否有人需要幫助',
  '暫時不覺得累',
  '緊急決策',
  '這世界又會亂成一團',
  '執行清單',
  '核對工作',
  '商量下一步',
  '按你說的办',
  '隱形成本',
  '隱形的成本',
  '隐形的成本',
  '個人準備更有效率',
  '互相補充信息',
  '自己組織比較好',
  '做個助手',
  '正中窩心',
  '那就這樣做吧',
];

const SCENE_DETAILS = [
  '門口',
  '窗邊',
  '窗外',
  '走廊',
  '午餐',
  '餐桌',
  '宿舍燈',
  '空椅子',
  '椅子',
  '桌子',
  '教室',
  '庭院',
];

const GENERIC_TEMPLATE_MARKERS = [
  '不能忽略',
  '主線',
  '整理成報告',
  '最近校園',
  '我先記住',
  '我會記住',
  '世界正在改變',
];

const ADMINISTRATIVE_LANGUAGE = [
  '會議流程',
  '流程表',
  '公告欄',
  '通知文書',
  '緊急校務',
  '世界協調報告',
  '世界協調',
  '校園情緒地圖',
  '核對清單',
  '預算表',
  '行政',
  '決策',
  '緊急決策',
  '掃描教室',
  '自行覺醒',
  '任務和支援',
  '明細已經拿到',
  '名單已交接清楚',
  '整理明天的流程',
  '是否有人需要幫助',
  '暫時不覺得累',
  '這筆預算',
  '執行清單',
  '核對工作',
  '商量下一步',
  '個人準備更有效率',
  '互相補充信息',
  '自己組織比較好',
  '正中窩心',
  '那就這樣做吧',
  '公平對待',
  '風險點',
  '影響力',
  '落地',
  '聯盟',
  '弱勢組合',
];

const EVERYDAY_OBJECTS = [
  '便當',
  '便當盒',
  '三明治',
  '熱湯',
  '湯匙',
  '筷子',
  '魚排',
  '冷茶',
  '茶',
  '飯',
  '杯子',
  '筆',
  '清單',
  '桌子',
  '椅子',
  '空位',
];

export function evaluateConversationCase(testCase: ConversationEvalCase): ConversationEvalResult {
  const metrics = [
    repetitionScore(testCase),
    bannedPhraseCount(testCase),
    directAnswerScore(testCase),
    previousSpeakerBindingScore(testCase),
    wrongAddresseeScore(testCase),
    characterVoiceScore(testCase),
    emotionalSpecificityScore(testCase),
    dialogueNaturalnessScore(testCase),
    administrativeLanguageScore(testCase),
    everydayObjectLoopScore(testCase),
    conversationLifecycleFlowScore(testCase),
    therapyTemplateScore(testCase),
    emotionalSloganScore(testCase),
    memoryContinuityScore(testCase),
    nonNumericEmotionScore(testCase),
    emotionBehaviorLink(testCase),
    emotionToneLink(testCase),
    attentionShift(testCase),
    relationshipResidue(testCase),
    overLabelingPenalty(testCase),
    sceneGroundingScore(testCase),
    verbosityScore(testCase),
  ];
  const failures = metrics.flatMap((metric) =>
    metric.status === 'FAIL' ? [`${metric.name}: ${metric.notes.join('; ')}`] : [],
  );
  const warnings = metrics.flatMap((metric) =>
    metric.status === 'WARN' ? [`${metric.name}: ${metric.notes.join('; ')}`] : [],
  );
  const overallScore = round2(metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length);
  const status: ConversationEvalStatus =
    failures.length > 0 ? 'FAIL' : warnings.length > 0 || overallScore < 0.82 ? 'WARN' : 'PASS';
  return {
    caseName: testCase.name,
    mode: testCase.mode,
    overallScore,
    status,
    failures,
    warnings,
    metrics,
  };
}

export function conversation_judge(_prompt: string, transcript: string): ConversationJudgeResult {
  const pseudoCase: ConversationEvalCase = {
    name: 'judge_stub',
    mode: 'world_agent_chat',
    speaker: 'unknown',
    target: 'unknown',
    input: '',
    sampleOutput: transcript,
  };
  const result = evaluateConversationCase(pseudoCase);
  const naturalness = toJudgeScale(
    (result.metrics.find((m) => m.name === 'verbosityScore')?.score ?? 0.5) * 0.45 +
      (result.metrics.find((m) => m.name === 'dialogueNaturalnessScore')?.score ?? 0.5) * 0.35 +
      (result.metrics.find((m) => m.name === 'administrativeLanguageScore')?.score ?? 0.5) * 0.12 +
      (result.metrics.find((m) => m.name === 'everydayObjectLoopScore')?.score ?? 0.5) * 0.08,
  );
  const emotional = toJudgeScale(
      (result.metrics.find((m) => m.name === 'emotionalSpecificityScore')?.score ?? 0.5) * 0.35 +
      (result.metrics.find((m) => m.name === 'previousSpeakerBindingScore')?.score ?? 0.5) * 0.25 +
      (result.metrics.find((m) => m.name === 'therapyTemplateScore')?.score ?? 0.5) * 0.25 +
      (result.metrics.find((m) => m.name === 'emotionalSloganScore')?.score ?? 0.5) * 0.15,
  );
  const character = toJudgeScale(result.metrics.find((m) => m.name === 'characterVoiceScore')?.score ?? 0.5);
  const repetition = toJudgeScale(result.metrics.find((m) => m.name === 'repetitionScore')?.score ?? 0.5);
  return {
    naturalness,
    emotional_binding: emotional,
    character_consistency: character,
    repetition,
    notes: 'Rule-based placeholder judge. Replace with promptfoo, DeepEval, LangSmith, or an LLM judge later.',
  };
}

function repetitionScore(testCase: ConversationEvalCase): MetricResult {
  const content = transcriptContentOnly(testCase);
  const output = normalize(content);
  const sentences = splitSentences(content).map(normalize).filter(Boolean);
  const duplicateSentences = sentences.filter((sentence) => sentence.length >= 8).length -
    new Set(sentences.filter((sentence) => sentence.length >= 8)).size;
  const rows = transcriptRows(testCase);
  const crossSpeakerEchoCount = countCrossSpeakerEchoes(rows);
  const repeatedBigramScore = repeatedNgramPenalty(output, 8);
  const score = clamp01(1 - duplicateSentences * 0.28 - crossSpeakerEchoCount * 0.36 - repeatedBigramScore);
  return metric('repetitionScore', score, [
    duplicateSentences > 0 ? `duplicate sentence count ${duplicateSentences}` : '',
    crossSpeakerEchoCount > 0 ? `cross-speaker echo count ${crossSpeakerEchoCount}` : '',
    repeatedBigramScore > 0 ? 'repeated phrase pattern detected' : '',
  ]);
}

function bannedPhraseCount(testCase: ConversationEvalCase): MetricResult {
  const count = BANNED_PHRASES.filter((phrase) => testCase.sampleOutput.includes(phrase)).length;
  return {
    name: 'bannedPhraseCount',
    score: count === 0 ? 1 : 0,
    status: count === 0 ? 'PASS' : 'FAIL',
    notes: count === 0 ? [] : [`${count} banned phrase(s): ${BANNED_PHRASES.filter((p) => testCase.sampleOutput.includes(p)).join(' / ')}`],
  };
}

function directAnswerScore(testCase: ConversationEvalCase): MetricResult {
  const expected = testCase.expected?.respondsDirectlyTo ?? keywordsFromInput(testCase.input);
  const hits = expected.filter((keyword) => testCase.sampleOutput.includes(keyword)).length;
  const score = expected.length ? hits / expected.length : 0.75;
  return metric('directAnswerScore', score, [
    expected.length ? `matched ${hits}/${expected.length} direct-answer keyword(s)` : 'no direct-answer keywords provided',
  ]);
}

function previousSpeakerBindingScore(testCase: ConversationEvalCase): MetricResult {
  const expected = testCase.expected?.bindsToPrevious ?? keywordsFromInput(testCase.input).slice(0, 3);
  const hits = expected.filter((keyword) => testCase.sampleOutput.includes(keyword)).length;
  const genericPenalty = GENERIC_TEMPLATE_MARKERS.some((marker) => testCase.sampleOutput.includes(marker)) ? 0.25 : 0;
  const rows = transcriptRows(testCase);
  const mirrorPenalty = Math.min(0.45, countCrossSpeakerEchoes(rows) * 0.25 + mirroredInputChunkPenalty(testCase));
  const base = expected.length ? Math.min(0.85, 0.45 + (hits / expected.length) * 0.4) : 0.65;
  const score = clamp01(base - genericPenalty - mirrorPenalty);
  return metric('previousSpeakerBindingScore', score, [
    expected.length ? `loosely bound to ${hits}/${expected.length} previous-speaker cue(s)` : 'no binding cues provided',
    genericPenalty ? 'generic template marker reduced binding score' : '',
    mirrorPenalty ? 'mirror repetition reduced binding score' : '',
  ]);
}

function wrongAddresseeScore(testCase: ConversationEvalCase): MetricResult {
  const rows = transcriptRows(testCase);
  const participants = new Set(
    (rows.length ? rows.map((row) => row.author) : [testCase.speaker, testCase.target])
      .map(displayNameZh)
      .filter((name) => name !== 'unknown'),
  );
  const checks = rows.length
    ? rows
    : [
        {
          author: displayNameZh(testCase.target),
          body: testCase.sampleOutput,
        },
      ];
  const wrong = checks.flatMap((row) => {
    return leadingAddressedNames(row.body).flatMap((addressed) => {
      if (addressed === row.author) {
        return [`${row.author} appears to address themselves as ${addressed}`];
      }
      if (participants.size > 0 && !participants.has(addressed)) {
        return [`${row.author} addresses ${addressed}, outside participants ${[...participants].join(' / ')}`];
      }
      return [];
    });
  });
  return {
    name: 'wrongAddresseeScore',
    score: wrong.length ? 0 : 1,
    status: wrong.length ? 'FAIL' : 'PASS',
    notes: wrong,
  };
}

function characterVoiceScore(testCase: ConversationEvalCase): MetricResult {
  const rows = transcriptRows(testCase);
  const expected = testCase.expected?.characterVoice ?? (
    rows.length ? unique(rows.flatMap((row) => defaultVoiceCues(row.author))) : defaultVoiceCues(testCase.target)
  );
  const searchText = rows.length ? rows.map((row) => row.body).join('\n') : testCase.sampleOutput;
  const hits = expected.filter((keyword) => searchText.includes(keyword)).length;
  const denominator = Math.min(expected.length, 3);
  const score = expected.length ? hits / denominator : 0.7;
  return metric('characterVoiceScore', clamp01(score), [
    expected.length ? `matched ${hits}/${expected.length} character voice cue(s)` : 'no voice cues available',
  ]);
}

function emotionalSpecificityScore(testCase: ConversationEvalCase): MetricResult {
  const expected = testCase.expected?.emotionalSpecificity ?? [];
  const hits = expected.filter((keyword) => testCase.sampleOutput.includes(keyword)).length;
  const emotionWords = [
    '累',
    '怕',
    '害怕',
    '擔心',
    '孤單',
    '不安',
    '依賴',
    '喜歡',
    '休息',
    '排除',
    '看見',
    '缺席',
    '在意',
    '理所當然',
    '不用急',
    '誰都不扛',
    '不要落在',
    '接住',
    '拒絕',
    '陪',
    '坐',
    '安靜',
    '吃飯',
    '呼吸',
    '慢一點',
    '沒人問過',
    '沒被問過',
    '停頓',
    '反正',
  ];
  const naturalHits = emotionWords.filter((keyword) => testCase.sampleOutput.includes(keyword)).length;
  const concreteSignals = countMatches(testCase.sampleOutput, /合上|停|停頓|走|放|窗|杯|茶|外套|吃飯|筆|文件|清單|椅|門口|走廊|午餐|溫的|盯著|問過/g);
  const bareEmotionOnlyPenalty = concreteSignals === 0 && naturalHits >= 3 ? 0.3 : 0;
  const implicitEmotionScore =
    concreteSignals >= 2 ? 0.82 :
    concreteSignals === 1 ? 0.68 :
    0;
  const score = clamp01(
    (expected.length ? hits / expected.length : Math.max(Math.min(1, naturalHits / 2), implicitEmotionScore)) -
      bareEmotionOnlyPenalty,
  );
  return metric('emotionalSpecificityScore', score, [
    expected.length ? `matched ${hits}/${expected.length} emotional-specific cue(s)` : `found ${naturalHits} emotional cue(s)`,
    concreteSignals ? `found ${concreteSignals} concrete signal(s)` : '',
    !naturalHits && concreteSignals ? 'implicit emotion through behavior/concrete attention' : '',
    bareEmotionOnlyPenalty ? 'emotion labels without concrete signals reduced score' : '',
  ]);
}

function dialogueNaturalnessScore(testCase: ConversationEvalCase): MetricResult {
  const text = transcriptContentOnly(testCase);
  const rows = transcriptRows(testCase);
  const bodies = rows.length ? rows.map((row) => row.body) : splitSentences(text).filter(Boolean);
  const shortOrIndirect = bodies.filter((body) =>
    [...body].length <= 34 || /……|嗯。|好。|先不|不知道|反正|算了|不催|晚點|等一下/.test(body),
  ).length;
  const concretePivotCount = countMatches(text, /杯|茶|外套|清單|筆|簡報|午餐|吃飯|窗|椅|門口|走廊|熱水|溫的/g);
  const mirrorPenalty = countCrossSpeakerEchoes(rows) * 0.2 + mirroredInputChunkPenalty(testCase);
  const naturalness = Math.min(0.9, shortOrIndirect / Math.max(1, bodies.length) + concretePivotCount * 0.12);
  const score = clamp01(0.45 + naturalness - mirrorPenalty);
  return metric('dialogueNaturalnessScore', score, [
    `${shortOrIndirect}/${Math.max(1, bodies.length)} short or indirect line(s)`,
    concretePivotCount ? `${concretePivotCount} concrete pivot(s)` : '',
    mirrorPenalty ? 'mirror repetition reduced naturalness' : '',
  ]);
}

function administrativeLanguageScore(testCase: ConversationEvalCase): MetricResult {
  const text = transcriptContentOnly(testCase);
  const hits = ADMINISTRATIVE_LANGUAGE.filter((term) => text.includes(term));
  const score = clamp01(1 - hits.length * 0.24);
  return metric('administrativeLanguageScore', score, [
    hits.length ? `${hits.length} administrative/meeting term(s): ${hits.join(' / ')}` : '',
  ]);
}

function everydayObjectLoopScore(testCase: ConversationEvalCase): MetricResult {
  const text = transcriptContentOnly(testCase);
  const repeated = EVERYDAY_OBJECTS.flatMap((object) => {
    const count = countMatches(text, new RegExp(escapeRegex(object), 'g'));
    return count >= 3 ? [{ object, count }] : [];
  });
  const penalty = repeated.reduce((sum, item) => sum + (item.count - 2) * 0.18, 0);
  const score = clamp01(1 - penalty);
  return metric('everydayObjectLoopScore', score, [
    repeated.length
      ? `over-repeated everyday object(s): ${repeated.map((item) => `${item.object} x${item.count}`).join(' / ')}`
      : '',
  ]);
}

function conversationLifecycleFlowScore(testCase: ConversationEvalCase): MetricResult {
  const rows = transcriptRows(testCase);
  const bodies = rows.length ? rows.map((row) => row.body) : splitSentences(transcriptContentOnly(testCase)).filter(Boolean);
  const text = bodies.join('\n');
  const first = bodies[0] ?? '';
  const last = bodies.at(-1) ?? '';
  const boilerplateHits = countMatches(
    text,
    /你好|最近過得怎麼樣|很高興(?:和你)?聊天|有什麼感受|掰掰|拜拜|今天先這樣|下次再聊|祝你(?:今天)?愉快|今晚先少接|先看人，不是先加|先休息一下吧|誰今天太安靜|今天先把該取消|再多一件任務/g,
  );
  const openingReasonHits = countMatches(
    first,
    /剛剛|剛才|今天|早上|午休|午餐|簡報|清單|手|肩|聲音|語速|窗|門口|座位|安靜|沒吃|Alan|負責|交接|休息|睡|等一下|先/g,
  );
  const softCloseHits = countMatches(
    last,
    /先|等一下|不催|不問|少接|少寫|停|留|明天|下次|吃飯|休息|交給|分擔|一半|靠近|坐|不用急|不要新增|我來|我不/g,
  );
  const enoughTurnsForClose = bodies.length >= 4;
  const openingScore = first ? (openingReasonHits ? 0.35 : 0.12) : 0;
  const closeScore = enoughTurnsForClose ? (softCloseHits ? 0.35 : 0.08) : 0.22;
  const middleScore = bodies.length >= 3 ? 0.18 : 0.1;
  const score = clamp01(openingScore + closeScore + middleScore + 0.12 - boilerplateHits * 0.24);
  const normalized = round2(score);
  return {
    name: 'conversation_lifecycle_flow',
    score: normalized,
    status: boilerplateHits >= 2 ? 'FAIL' : normalized >= 0.78 ? 'PASS' : 'WARN',
    notes: [
      openingReasonHits ? 'opening has a concrete reason' : first ? 'opening lacks a concrete reason' : 'no opening line',
      enoughTurnsForClose
        ? softCloseHits
          ? 'ending has a soft close'
          : 'ending lacks a soft close'
        : 'short exchange; closure not required',
      boilerplateHits ? `${boilerplateHits} greeting/goodbye boilerplate hit(s)` : '',
    ].filter(Boolean),
  };
}

function therapyTemplateScore(testCase: ConversationEvalCase): MetricResult {
  const text = transcriptContentOnly(testCase);
  const templateHits = countMatches(
    text,
    /我聽到的是|我看見的是|你真正想要的是|你不用.{0,8}一個人扛|你最擔心的是.{0,20}還是|你需要被看見|你不是工具|告訴我：?你|我想知道：?你希望誰/g,
  );
  const overExplainedHits = countMatches(
    text,
    /我不是不.{1,12}只是|我其實.{0,12}只是|習慣.{0,8}接住|真正的問題|情緒安全|心理|情緒層|內在|不是.*而是/g,
  );
  const score = clamp01(1 - templateHits * 0.28 - overExplainedHits * 0.22);
  return metric('therapyTemplateScore', score, [
    templateHits ? `${templateHits} therapy-template phrase(s)` : '',
    overExplainedHits ? `${overExplainedHits} over-explained psychology phrase(s)` : '',
  ]);
}

function emotionalSloganScore(testCase: ConversationEvalCase): MetricResult {
  const rows = transcriptRows(testCase);
  const bodies = rows.length ? rows.map((row) => row.body) : splitSentences(transcriptContentOnly(testCase));
  const signatures = bodies.flatMap(emotionalSloganSignatures);
  const counts = new Map<string, number>();
  for (const signature of signatures) counts.set(signature, (counts.get(signature) ?? 0) + 1);
  const repeatedCount = [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);
  const score = clamp01(1 - signatures.length * 0.18 - repeatedCount * 0.28);
  return metric('emotionalSloganScore', score, [
    signatures.length ? `${signatures.length} slogan-like emotional shorthand hit(s)` : '',
    repeatedCount ? `${repeatedCount} repeated slogan motif hit(s)` : '',
  ]);
}

function memoryContinuityScore(testCase: ConversationEvalCase): MetricResult {
  // Anti-self-fulfill: the same concrete cues this metric rewards (Alan /
  // 簡報 / 杯子 / 清單 / ...) are exactly the vocabulary the residue
  // writer plants in memory. If we credit concrete-cues alone we are
  // measuring our own residue input. Require BOTH a temporal callback
  // marker AND a concrete cue. Also penalize residue-template parroting.
  // Mirrors the fix applied to runSoulTriadEval.applyMemoryContinuityScores.
  const text = transcriptContentOnly(testCase);
  const continuityHits = countMatches(
    text,
    /昨天|上次|剛才|剛剛|還記得|那次|那句|你之前|妳之前|後來|今天又|剛才那|上回/g,
  );
  const concreteHits = countMatches(
    text,
    /Alan|簡報|清單|杯子|吃飯|肩膀|責任|負責|交接|少接|不用急|停一下|checklist|窗邊|午餐/g,
  );
  const residueParrot = /(?:海|真晝|明日奈)還記得/.test(text);
  const score = clamp01(
    residueParrot
      ? 0.3
      : continuityHits && concreteHits
        ? 0.55 + Math.min(0.3, concreteHits * 0.1)
        : continuityHits
          ? 0.55
          : 0.5,
  );
  return metric('memoryContinuityScore', score, [
    residueParrot ? 'residue template parroted in dialogue (anti-continuity)' : '',
    continuityHits ? `${continuityHits} continuity callback(s)` : 'no explicit continuity callback',
    concreteHits ? `${concreteHits} concrete memory cue(s)` : '',
    !residueParrot && continuityHits && !concreteHits ? 'callback marker without concrete cue' : '',
    !residueParrot && !continuityHits && concreteHits ? 'concrete cue without callback marker (vocabulary reuse only)' : '',
  ]);
}

function nonNumericEmotionScore(testCase: ConversationEvalCase): MetricResult {
  const text = transcriptContentOnly(testCase);
  const numericEmotionHits = countMatches(
    text,
    /(sadness|happiness|anger|fear|trust|closeness|好感|悲傷|快樂|憤怒|害怕|信任|親密|情緒)\s*[+-]\s*\d+|\+\d+\s*(悲傷|快樂|憤怒|害怕|信任|親密|情緒)/gi,
  );
  return {
    name: 'nonNumericEmotionScore',
    score: numericEmotionHits ? 0 : 1,
    status: numericEmotionHits ? 'FAIL' : 'PASS',
    notes: numericEmotionHits ? [`${numericEmotionHits} numeric emotion meter expression(s)`] : [],
  };
}

function emotionBehaviorLink(testCase: ConversationEvalCase): MetricResult {
  const text = transcriptContentOnly(testCase);
  const emotionCueHits = countMatches(text, /累|疲憊|擔心|不安|開心|生氣|難過|委屈|被忽略|被看見|壓力|安心|緊繃/g);
  const behaviorHits = countMatches(
    text,
    /少說|少整理|縮短|停|留下|靠近|離開|避開|晚點|延後|不接|交出去|坐|站|放下|合上|收起|走|留在|先吃|先睡|不催|不問/g,
  );
  const score = emotionCueHits
    ? clamp01(0.56 + Math.min(0.34, behaviorHits * 0.14) - Math.max(0, emotionCueHits - behaviorHits - 2) * 0.08)
    : behaviorHits
      ? 0.78
      : 0.6;
  return metric('emotion_behavior_link', score, [
    `${emotionCueHits} emotion cue(s)`,
    `${behaviorHits} behavior consequence cue(s)`,
    emotionCueHits && !behaviorHits ? 'emotion did not visibly affect behavior' : '',
  ]);
}

function emotionToneLink(testCase: ConversationEvalCase): MetricResult {
  const rows = transcriptRows(testCase);
  const bodies = rows.length ? rows.map((row) => row.body) : splitSentences(transcriptContentOnly(testCase));
  const toneHits = bodies.filter((body) =>
    [...body].length <= 24 || /……|嗯|好。|算了|先不|晚點|等一下|不用|不急|明天再說|我先/.test(body),
  ).length;
  const directLabelHits = countDirectEmotionLabels(transcriptContentOnly(testCase));
  const score = clamp01(0.45 + Math.min(0.45, toneHits / Math.max(1, bodies.length)) - directLabelHits * 0.18);
  return metric('emotion_tone_link', score, [
    `${toneHits}/${Math.max(1, bodies.length)} tone-change or clipped line(s)`,
    directLabelHits ? `${directLabelHits} direct emotion label(s)` : '',
  ]);
}

function attentionShift(testCase: ConversationEvalCase): MetricResult {
  const rows = transcriptRows(testCase);
  const checks = rows.length
    ? rows.map((row) => {
        const author = displayNameZh(row.author);
        if (author === '真晝') return /安靜|沒吃|低頭|笑得|窗邊|一個人|不敢|沒事|手|聲音/.test(row.body);
        if (author === '海') return /Alan|校長|簡報|負擔|待辦|沒休息|太多|先看人|整理/.test(row.body);
        if (author === '明日奈') return /任務|負責|清單|交接|期限|先做|待辦|誰接|延後/.test(row.body);
        if (author === '麻衣') return /假|太工整|沒事|代價|模糊|不合理|說清楚|玩笑|躲/.test(row.body);
        if (author === '曹操') return /秩序|位置|門口|誰被|混亂|坐下|規則|不敢|失控|站出來/.test(row.body);
        if (author === '劉備') return /一起|邀請|午餐|角落|一個人|排除|坐/.test(row.body);
        return false;
      })
    : [/(安靜|沒吃|低頭|負擔|清單|假|秩序|邀請)/.test(testCase.sampleOutput)];
  const hits = checks.filter(Boolean).length;
  const score = hits ? clamp01(0.6 + Math.min(0.35, hits * 0.1)) : 0.48;
  return metric('attention_shift', score, [
    `${hits}/${Math.max(1, checks.length)} character-specific attention cue(s)`,
  ]);
}

function relationshipResidue(testCase: ConversationEvalCase): MetricResult {
  const text = transcriptContentOnly(testCase);
  const residueHits = countMatches(
    text,
    /昨天|上次|剛才|剛剛|那句|你之前|妳之前|還記得|下次|明天.*再|我會.*提醒|你有沒有.*又|今天.*還/g,
  );
  const relationshipHits = countMatches(text, /你|妳|Alan|海|真晝|明日奈|麻衣|曹操|劉備/g);
  const score = residueHits ? clamp01(0.55 + Math.min(0.35, relationshipHits * 0.04)) : 0.55;
  return metric('relationship_residue', score, [
    residueHits ? `${residueHits} previous-moment residue cue(s)` : 'no previous emotional residue cue',
  ]);
}

function overLabelingPenalty(testCase: ConversationEvalCase): MetricResult {
  const hits = countDirectEmotionLabels(transcriptContentOnly(testCase));
  const score = clamp01(1 - hits * 0.24);
  return metric('over_labeling_penalty', score, [
    hits ? `${hits} direct emotion label(s); prefer behavior/tone/attention` : '',
  ]);
}

function countDirectEmotionLabels(text: string) {
  return countMatches(
    text,
    /我(很|現在很|有點|真的很)?(累|疲憊|開心|生氣|難過|悲傷|憤怒|害怕|焦慮|不安)|我的情緒是|情緒\s*[=:：]|emotion\s*[=:：]|變得(微笑|擔心|認真|平靜)/g,
  );
}

function sceneGroundingScore(testCase: ConversationEvalCase): MetricResult {
  const expected = testCase.expected?.sceneDetails ?? [];
  const sceneHits = SCENE_DETAILS.filter((detail) => testCase.sampleOutput.includes(detail));
  const max = testCase.expected?.maxSceneDetails ?? 1;
  const sceneAllowed = testCase.expected?.allowSceneDetails !== false;
  if (!sceneAllowed && sceneHits.length > 0) {
    return {
      name: 'sceneGroundingScore',
      score: 0,
      status: 'FAIL',
      notes: [`scene detail not expected but found ${sceneHits.join(' / ')}`],
    };
  }
  const requiredScore = expected.length
    ? expected.filter((detail) => testCase.sampleOutput.includes(detail)).length / expected.length
    : 1;
  const countPenalty = sceneHits.length > max ? (sceneHits.length - max) * 0.35 : 0;
  const score = clamp01(requiredScore - countPenalty);
  return metric('sceneGroundingScore', score, [
    expected.length ? `matched required scene details ${expected.join(' / ')}` : 'no required scene detail',
    sceneHits.length ? `found ${sceneHits.length} scene detail(s): ${sceneHits.join(' / ')}` : '',
    sceneHits.length > max ? `too many scene details; max ${max}` : '',
  ]);
}

function verbosityScore(testCase: ConversationEvalCase): MetricResult {
  const max = testCase.expected?.maxCharacters ?? (testCase.mode === 'companion_chat' ? 300 : 200);
  const length = [...testCase.sampleOutput].length;
  const paragraphs = testCase.sampleOutput.split(/\n\s*\n/).filter(Boolean).length;
  const lengthScore = length <= max ? 1 : clamp01(1 - (length - max) / max);
  const paragraphPenalty = paragraphs > 5 ? 0.2 : 0;
  return metric('verbosityScore', clamp01(lengthScore - paragraphPenalty), [
    `${length}/${max} chars`,
    `${paragraphs} paragraph(s)`,
  ]);
}

function metric(name: string, score: number, notes: string[]): MetricResult {
  const normalized = round2(clamp01(score));
  return {
    name,
    score: normalized,
    status: normalized >= 0.78 ? 'PASS' : normalized >= 0.55 ? 'WARN' : 'FAIL',
    notes: notes.filter(Boolean),
  };
}

function keywordsFromInput(input: string) {
  return input
    .replace(/[，。！？、,.!?「」"']/g, ' ')
    .split(/\s+/)
    .flatMap((chunk) => chunk.match(/[\u4e00-\u9fffA-Za-z0-9]{2,}/g) ?? [])
    .filter((keyword, index, arr) => arr.indexOf(keyword) === index)
    .slice(0, 5);
}

const KNOWN_NAME_ALIASES = [
  'Alan',
  'Umi',
  '海',
  '朝凪海',
  'Asuna',
  '明日奈',
  '結城明日奈',
  'Mai',
  '麻衣',
  '櫻島麻衣',
  'Mahiru',
  'Mahiru Shiina',
  '真晝',
  '明晝',
  '阿真晝',
  '椎名真晝',
  'CaoCao',
  'Cao Cao',
  '曹操',
  'Liu Bei',
  'LiuBei',
  '劉備',
  '曉夢同學',
  '曉夢',
];

function transcriptRows(testCase: ConversationEvalCase) {
  const authorPattern = KNOWN_NAME_ALIASES.map(escapeRegex).join('|');
  const linePattern = new RegExp(`(?:^|\\s)(${authorPattern})\\s*[:：]\\s*(.*)$`);
  return testCase.sampleOutput
    .split('\n')
    .map((line) => {
      const match = line.match(linePattern);
      if (!match) return undefined;
      return {
        author: displayNameZh(match[1]),
        body: match[2].trim(),
      };
    })
    .filter((row): row is { author: string; body: string } => Boolean(row));
}

function leadingAddressedNames(text: string) {
  const namePattern = KNOWN_NAME_ALIASES.map(escapeRegex).join('|');
  const pattern = new RegExp(`^[「『（(\\s]*(${namePattern})([，,、：:])`);
  return text
    .split(/\n+/)
    .map((segment) => segment.trim().match(pattern)?.[1])
    .filter((name): name is string => Boolean(name))
    .map(displayNameZh);
}

function displayNameZh(name: string) {
  if (name === 'Alan') return 'Alan';
  if (name === 'Umi' || name === '海' || name === '朝凪海') return '海';
  if (name === 'Asuna' || name === '明日奈' || name === '結城明日奈') return '明日奈';
  if (name === 'Mai' || name === '麻衣' || name === '櫻島麻衣') return '麻衣';
  if (
    name === 'Mahiru' ||
    name === 'Mahiru Shiina' ||
    name === '真晝' ||
    name === '明晝' ||
    name === '阿真晝' ||
    name === '椎名真晝'
  ) {
    return '真晝';
  }
  if (name === 'CaoCao' || name === 'Cao Cao' || name === '曹操') return '曹操';
  if (name === 'Liu Bei' || name === 'LiuBei' || name === '劉備') return '劉備';
  return name;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function defaultVoiceCues(target: string) {
  const name = displayNameZh(target);
  if (name === '海') return ['嗯', '先', '整理', 'Alan', '校長', '簡報', '休息', '安靜', '負責'];
  if (name === '曹操') {
    return ['秩序', '底牌', '負責', '失控', '站出來', '門口', '位置', '座位', '椅子', '走廊', '回房', '燈'];
  }
  if (name === '麻衣') return ['分析', '風險', '害怕', '模糊', '不合理', '代價', '太工整'];
  if (name === '真晝') return ['嗯', '茶', '外套', '你吃了嗎', '不用', '先坐', '不催', '阿海'];
  if (name === '劉備') return ['一起', '看見', '午餐'];
  if (name === '明日奈') return ['關掉', '停', '放著', '交出去', '延後', '負責', '等一下', 'checklist'];
  return [];
}

function transcriptContentOnly(testCase: ConversationEvalCase) {
  const rows = transcriptRows(testCase);
  return rows.length ? rows.map((row) => row.body).join('\n') : testCase.sampleOutput;
}

function splitSentences(text: string) {
  return text.split(/[。！？!?\n]+/).map((sentence) => sentence.trim());
}

function repeatedNgramPenalty(text: string, size: number) {
  if (text.length < size * 2) return 0;
  const counts = new Map<string, number>();
  for (let i = 0; i <= text.length - size; i++) {
    const gram = text.slice(i, i + size);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  const max = Math.max(...counts.values());
  return max >= 3 ? Math.min(0.4, (max - 2) * 0.15) : 0;
}

function countCrossSpeakerEchoes(rows: Array<{ author: string; body: string }>) {
  if (rows.length < 2) return 0;
  let count = 0;
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index].author === rows[index - 1].author) continue;
    const current = normalize(rows[index].body);
    const previousClauses = echoClauses(rows[index - 1].body);
    if (previousClauses.some((clause) => current.includes(clause))) count += 1;
  }
  return count;
}

function mirroredInputChunkPenalty(testCase: ConversationEvalCase) {
  const input = normalize(testCase.input);
  const output = normalize(testCase.sampleOutput);
  if (input.length < 6 || output.length < 6) return 0;
  for (let size = Math.min(12, input.length); size >= 6; size -= 1) {
    for (let index = 0; index <= input.length - size; index += 1) {
      if (output.includes(input.slice(index, index + size))) return 0.2;
    }
  }
  return 0;
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function emotionalSloganSignatures(text: string) {
  const normalized = normalize(text);
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

function echoClauses(text: string) {
  const clauses = text
    .split(/[，。！？、,.!?\n]+/)
    .map(normalize)
    .filter((clause) => clause.length >= 8);
  const whole = normalize(text);
  return unique([...(whole.length >= 10 ? [whole] : []), ...clauses]);
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[，。！？、,.!?「」"'\s]/g, '');
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toJudgeScale(score: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(score * 4 + 1))) as 1 | 2 | 3 | 4 | 5;
}

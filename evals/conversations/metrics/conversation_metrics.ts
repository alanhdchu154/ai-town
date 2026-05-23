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

export function evaluateConversationCase(testCase: ConversationEvalCase): ConversationEvalResult {
  const metrics = [
    repetitionScore(testCase),
    bannedPhraseCount(testCase),
    directAnswerScore(testCase),
    previousSpeakerBindingScore(testCase),
    wrongAddresseeScore(testCase),
    characterVoiceScore(testCase),
    emotionalSpecificityScore(testCase),
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
  const naturalness = toJudgeScale((result.metrics.find((m) => m.name === 'verbosityScore')?.score ?? 0.5));
  const emotional = toJudgeScale(
    (result.metrics.find((m) => m.name === 'emotionalSpecificityScore')?.score ?? 0.5) * 0.55 +
      (result.metrics.find((m) => m.name === 'previousSpeakerBindingScore')?.score ?? 0.5) * 0.45,
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
  const duplicateSentences = sentences.length - new Set(sentences).size;
  const inputOverlap = normalize(testCase.input).length > 6 && output.includes(normalize(testCase.input));
  const repeatedBigramScore = repeatedNgramPenalty(output, 8);
  const score = clamp01(1 - duplicateSentences * 0.28 - (inputOverlap ? 0.45 : 0) - repeatedBigramScore);
  return metric('repetitionScore', score, [
    duplicateSentences > 0 ? `duplicate sentence count ${duplicateSentences}` : '',
    inputOverlap ? 'output repeats input verbatim' : '',
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
  const score = clamp01((expected.length ? hits / expected.length : 0.65) - genericPenalty);
  return metric('previousSpeakerBindingScore', score, [
    expected.length ? `bound to ${hits}/${expected.length} previous-speaker cue(s)` : 'no binding cues provided',
    genericPenalty ? 'generic template marker reduced binding score' : '',
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
  const expected = testCase.expected?.characterVoice ?? defaultVoiceCues(testCase.target);
  const hits = expected.filter((keyword) => testCase.sampleOutput.includes(keyword)).length;
  const score = expected.length ? hits / Math.min(expected.length, 3) : 0.7;
  return metric('characterVoiceScore', clamp01(score), [
    expected.length ? `matched ${hits}/${expected.length} character voice cue(s)` : 'no voice cues available',
  ]);
}

function emotionalSpecificityScore(testCase: ConversationEvalCase): MetricResult {
  const expected = testCase.expected?.emotionalSpecificity ?? [];
  const hits = expected.filter((keyword) => testCase.sampleOutput.includes(keyword)).length;
  const emotionWords = ['累', '怕', '害怕', '擔心', '孤單', '不安', '依賴', '喜歡', '休息', '排除', '看見', '位置'];
  const naturalHits = emotionWords.filter((keyword) => testCase.sampleOutput.includes(keyword)).length;
  const score = expected.length ? hits / expected.length : Math.min(1, naturalHits / 2);
  return metric('emotionalSpecificityScore', score, [
    expected.length ? `matched ${hits}/${expected.length} emotional-specific cue(s)` : `found ${naturalHits} emotional cue(s)`,
  ]);
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
  '椎名真晝',
  'CaoCao',
  'Cao Cao',
  '曹操',
  'Liu Bei',
  'LiuBei',
  '劉備',
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
  if (name === 'Mahiru' || name === 'Mahiru Shiina' || name === '真晝' || name === '椎名真晝') {
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
  if (name === '海') return ['嗯', '先', '整理'];
  if (name === '曹操') return ['秩序', '底牌', '負責'];
  if (name === '麻衣') return ['分析', '風險', '害怕'];
  if (name === '真晝') return ['擔心', '不用', '先坐'];
  if (name === '劉備') return ['一起', '看見', '午餐'];
  if (name === '明日奈') return ['下一步', '負責', '時限'];
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

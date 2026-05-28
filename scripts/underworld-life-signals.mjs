#!/usr/bin/env node
// GIIS Underworld everyday-life signal observer.
//
// Read-only against Convex. This checks whether recent/free-world dialogue is
// grounded in ordinary campus life instead of drifting into administrative,
// political, or system-planning language.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'life-signals-latest.md');

const args = parseArgs(process.argv.slice(2));
const TIME_ZONE = args.get('time-zone') ?? 'America/Chicago';
const TARGET_DATE = args.get('date') ?? dateKeyFor(Date.now(), TIME_ZONE);
const LIMIT = numberArg('limit', 160, 1, 200);
const MESSAGES_PER_CONVERSATION = numberArg('messages-per-conversation', 12, 1, 12);
const SINCE_CREATED_AT = optionalNumberArg('since-created-at');
const SELF_TEST = args.get('self-test') === 'true';

const PILOT_NAMES = new Set(['海', '真晝', '明日奈', 'Umi', 'Mahiru', 'Asuna']);

const LIFE_GROUPS = {
  classroom: ['教室', '作業', '考試', '小考', '成績', '作弊', '筆記', '書包', '座位', '黑板'],
  cafeteria: ['餐廳', '午餐', '吃飯', '便當', '熱湯', '杯', '水', '魚排', '餐盤', '座位'],
  dorm: ['宿舍', '房間', '床', '洗衣', '室友', '熄燈', '睡', '醒', '門口'],
  courtyard: ['庭院', '窗', '門口', '告白', '秘密', '樹下', '走廊', '靠近', '離開'],
  office: ['校長室', 'Alan', '校長', '簡報', '筆電', '清單'],
  bodyTone: ['手', '肩', '累', '疲', '休息', '安靜', '沉默', '小聲', '停一下', '少說'],
};

const ORDINARY_SCENE_GROUPS = ['classroom', 'cafeteria', 'dorm', 'courtyard'];

const RHYTHM_GROUPS = {
  morning: ['早上', '上午', '早餐', '第一節', '上課前'],
  midday: ['中午', '午餐', '午休', '餐廳', '吃飯'],
  afternoon: ['下午', '放學', '社團', '交接', '下一節'],
  evening: ['晚上', '晚餐', '宿舍', '熄燈', '睡前', '休息'],
  today: ['今天', '剛剛', '剛才', '等一下', '明天'],
};

const SOUL_STYLE_CUES = {
  海: ['Alan', '校長', '簡報', '整理', '先看人', '少說', '少整理', '負責'],
  Umi: ['Alan', '校長', '簡報', '整理', '先看人', '少說', '少整理', '負責'],
  真晝: ['還好', '沒事', '低頭', '小聲', '慢一點', '照顧', '有人陪', '有吃'],
  'Mahiru': ['還好', '沒事', '低頭', '小聲', '慢一點', '照顧', '有人陪', '有吃'],
  明日奈: ['負責', '清單', '下一步', '交接', '我來', '分掉', '不要新增'],
  Asuna: ['負責', '清單', '下一步', '交接', '我來', '分掉', '不要新增'],
  麻衣: ['太工整', '躲', '代價', '說清楚', '假裝', '拆你的邏輯', '別繞', '模糊', '不合理'],
  Mai: ['太工整', '躲', '代價', '說清楚', '假裝', '拆你的邏輯', '別繞', '模糊', '不合理'],
  曹操: ['秩序', '規矩', '位置', '門口', '多餘', '不敢進來', '誰被', '失控', '站出來'],
  CaoCao: ['秩序', '規矩', '位置', '門口', '多餘', '不敢進來', '誰被', '失控', '站出來'],
  劉備: ['邀請', '一起', '午餐', '角落', '坐過來', '陪', '分裂'],
  'Liu Bei': ['邀請', '一起', '午餐', '角落', '坐過來', '陪', '分裂'],
};

const PROP_ECHO_CUES = [
  '紀錄表',
  '便當',
  '壞掉的燈',
  '走廊燈',
  '燈',
  '餐盤',
  '炸雞',
  '熱茶',
  '牛奶',
  '檸檬水',
  '杯',
  '清單',
  '簡報',
  '文件',
  '課表',
  '通知單',
  '椅子',
  '座位',
];

const ADMIN_DRIFT_CUES = [
  '政治',
  '勢力',
  '組織',
  '策略',
  '導火線',
  '社會',
  '衝擊',
  '衝擊點',
  '流程',
  '會議流程',
  '公告欄',
  '緊急校務',
  '緊急決策',
  '掃描教室',
  '自行覺醒',
  '任務和支援',
  '明細已經拿到',
  '名單已交接清楚',
  '整理明天的流程',
  '這筆預算',
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
  '是否有人需要幫助',
  '暫時不覺得累',
  '落實',
  '制定計劃',
  '明確支持者',
  '緊急會議',
  '世界協調報告',
  '世界協調',
  '世界又會亂成一團',
  '校園情緒地圖',
  '學生會提案',
  '派系',
  '要變天',
  '功能',
  '系統',
  '架構',
];

const HYGIENE_CUES = [
  '[ABORT_CONVERSATION]',
  'fallback',
  '無法提供',
  'please listen carefully',
  'replied softly',
  'listened attentively',
];

const THIRD_PERSON_SELF_NARRATION_RE =
  /^(?:海|真晝|明晝|阿真晝|明日奈|麻衣|曹操|劉備|Umi|Mahiru|Mahiru Shiina|Asuna|Mai|CaoCao|Liu Bei)\s*(?:(?:看著|看向|望著|走到|靠近|拿著|放下|低頭|抬頭|停下|坐在|站在|把|對)[^「」]{0,120}(?:(?:問|說|提醒|回答|開口)[：:]|[，,])\s*「[^」]{1,240}」|(?:注意到|覺得|感覺|想起|知道|聽見|看見|看到).{2,260}|(?:靜悄悄|悄悄|默默|有些|略微|剛才)?(?:看起來|顯得|坐在|站在|看著|看向|望著|盯著|避開|保持沉默|低頭|抬頭|停下|停住|走到|靠近|拿著|放下|把|對|看)(?=.{0,180}(?:[，,。！？!?；;]|$)))/;
const MALFORMED_NAME_CLUSTER_RE =
  /[，,、]\s*(?:海|真晝|明晝|阿真晝|明日奈|麻衣|曹操|劉備|Umi|Mahiru|Mahiru Shiina|Asuna|Mai|CaoCao|Liu Bei){2,}\s*[？?。.!！]/;

const POST_PROCESSING_DRIFT_CUES = [
  'AI 社',
  'AI社',
  '學生會',
  '派系',
  '政治',
  '勢力',
  '世界情緒',
  '世界協調報告',
  '世界協調',
  '校園情緒地圖',
  '情緒脈絡',
  '主線',
  'conversationOutcome',
  '會議流程',
  '策略衝擊',
];

async function main() {
  if (SELF_TEST) {
    runSelfTest();
    return;
  }
  console.log(
    `[life-signals] observe-only; target=${TARGET_DATE} ${TIME_ZONE}` +
      `${SINCE_CREATED_AT !== undefined ? ` since=${new Date(SINCE_CREATED_AT).toISOString()}` : ''}`,
  );
  const window = localWindow(TARGET_DATE, 6, 22, TIME_ZONE);
  const requestedStartAt = SINCE_CREATED_AT === undefined ? window.startAt : Math.max(window.startAt, SINCE_CREATED_AT);
  const queryWindow = {
    startAt: Math.min(requestedStartAt, window.endAt),
    endAt: window.endAt,
  };
  const data = await convexRun('school:recentConversationEvalData', {
    timeZone: TIME_ZONE,
    limit: LIMIT,
    startAt: queryWindow.startAt,
    endAt: queryWindow.endAt,
    compact: false,
    messagesPerConversation: MESSAGES_PER_CONVERSATION,
  });
  const conversations = (Array.isArray(data?.conversations) ? data.conversations : [])
    .map((conversation) => withLocalTime(conversation, TIME_ZONE))
    .filter((conversation) => conversation.localDate === TARGET_DATE)
    .filter((conversation) => SINCE_CREATED_AT === undefined || conversation.createdAt >= SINCE_CREATED_AT)
    .sort((a, b) => b.createdAt - a.createdAt);
  const analyses = conversations.map(analyzeConversation);
  const repeatedLines = findRepeatedLines(conversations);
  const summary = summarize(analyses, repeatedLines);
  const status = decideStatus(summary);

  await writeReport({ data, window, queryWindow, conversations, analyses, repeatedLines, summary, status });
  console.log(`[life-signals] conversations=${conversations.length}`);
  console.log(`[life-signals] status=${status.label} decision=${status.decision}`);
  console.log(`[life-signals] report=${relative(REPORT_PATH)}`);
}

function runSelfTest() {
  const repeatedConversations = [
    fixtureConversation('conversation-test-1', ['明日奈', '麻衣'], [
      ['明日奈', '我剛剛差點又開始排順序。 先停，這次讓別人接一小段。'],
      ['麻衣', '先吃飯。你講太快了。'],
    ]),
    fixtureConversation('conversation-test-2', ['明日奈', '海'], [
      ['明日奈', '我剛剛差點又開始排順序。 先停，這次讓別人接一小段。'],
      ['海', '那就先把杯子放著。'],
    ]),
    fixtureConversation('conversation-test-3', ['明日奈', '真晝'], [
      ['明日奈', '我剛剛差點又開始排順序。 先停，這次讓別人接一小段。'],
      ['真晝', '你今天先坐一下。'],
    ]),
  ];
  const repeatedSummary = summarize(
    repeatedConversations.map(analyzeConversation),
    findRepeatedLines(repeatedConversations),
  );
  const repeatedStatus = decideStatus(repeatedSummary);
  assertEqual(repeatedSummary.repeatedLineFlags, 1, 'detects repeated surface line across conversations');
  assertEqual(repeatedStatus.decision, 'life_signal_repeated', 'repeated line downgrades life signal');

  const adminConversations = [
    fixtureConversation('conversation-admin-1', ['麻衣', '劉備'], [
      ['麻衣', '這個系統策略會造成政治衝擊，先不要談午餐。'],
      ['劉備', '那我們掃描教室，確保所有人都有任務和支援。'],
      ['麻衣', '你又把人說成流程了。'],
      ['劉備', '我先記下不同意見。'],
    ]),
    fixtureConversation('conversation-admin-2', ['曹操', '麻衣'], [
      ['曹操', '流程和架構比誰坐哪裡更重要。'],
      ['麻衣', '你又把人藏進系統裡了。'],
      ['曹操', '那就先確認權責。'],
      ['麻衣', '聽起來還是很像公告。'],
    ]),
    fixtureConversation('conversation-admin-3', ['海', '曹操'], [
      ['海', '這個緊急決策如果沒人接住，這世界又會亂成一團。'],
      ['曹操', '你又把學生說成需要控管的局面了。'],
      ['海', '先別新增功能，也別把校園變成策略圖。'],
      ['曹操', '今天先看學生怎麼過。'],
    ]),
  ];
  const adminSummary = summarize(adminConversations.map(analyzeConversation), []);
  const adminStatus = decideStatus(adminSummary);
  assertEqual(adminStatus.decision, 'life_signal_missing', 'admin drift can fail life signal');

  const emptySummary = summarize([], []);
  const emptyStatus = decideStatus(emptySummary);
  assertEqual(emptyStatus.decision, 'sample_pending', 'empty fresh window stays sample_pending');

  const collapsedConversations = [
    fixtureConversation('conversation-shape-1', ['海', '明日奈'], [['海', '今天先少說一點。']]),
    fixtureConversation('conversation-shape-2', ['真晝', '海'], [
      ['真晝', '你午餐有吃嗎？'],
      ['真晝', '我只是想確認。'],
    ]),
    fixtureConversation('conversation-shape-3', ['明日奈', '麻衣'], [
      ['明日奈', '先不要新增了。'],
      ['麻衣', '那你先坐。'],
    ]),
  ];
  const collapsedSummary = summarize(collapsedConversations.map(analyzeConversation), []);
  const collapsedStatus = decideStatus(collapsedSummary);
  assertEqual(collapsedSummary.singleMessageFlags, 1, 'detects single-message archived conversation');
  assertEqual(collapsedStatus.decision, 'conversation_shape_collapse', 'short or one-sided conversations flag shape collapse');

  const thinSceneConversations = [
    fixtureConversation('conversation-scene-1', ['海', '明日奈'], [
      ['海', 'Alan 的簡報今天先留三件。'],
      ['明日奈', '那我先不開清單。'],
      ['海', '你休息一下。'],
      ['明日奈', '嗯，這次我不急著接。'],
    ]),
    fixtureConversation('conversation-scene-2', ['海', '真晝'], [
      ['真晝', '你是不是還在想 Alan？'],
      ['海', '我只是把簡報短一點。'],
      ['真晝', '那也算休息。'],
      ['海', '勉強算。'],
    ]),
    fixtureConversation('conversation-scene-3', ['海', '曹操'], [
      ['海', '校長室今天先安靜一點。'],
      ['曹操', '清單留三項就夠。'],
      ['海', '不要把人排進表格裡。'],
      ['曹操', '我聽見了。'],
    ]),
    fixtureConversation('conversation-scene-4', ['明日奈', '真晝'], [
      ['明日奈', '我先把 Alan 那段收起來。'],
      ['真晝', '你可以少說一點。'],
      ['明日奈', '那清單明天再看。'],
      ['真晝', '好。'],
    ]),
    fixtureConversation('conversation-scene-5', ['海', '麻衣'], [
      ['麻衣', '簡報很乾淨，但人呢？'],
      ['海', '我知道。今天先不加。'],
      ['麻衣', '你最好真的知道。'],
      ['海', '嗯。'],
    ]),
  ];
  const thinSceneSummary = summarize(thinSceneConversations.map(analyzeConversation), []);
  const thinSceneStatus = decideStatus(thinSceneSummary);
  assertEqual(thinSceneSummary.ordinarySceneDiversity, 0, 'detects no ordinary scene coverage');
  assertEqual(thinSceneStatus.decision, 'scene_diversity_thin', 'office-only life signal warns about thin scene diversity');

  const thinRhythmConversations = [
    fixtureConversation('conversation-rhythm-1', ['明日奈', '真晝'], [
      ['明日奈', '教室裡那份作業我先放著。'],
      ['真晝', '你先看黑板旁邊那個座位。'],
      ['明日奈', '我知道。'],
      ['真晝', '不要急。'],
    ]),
    fixtureConversation('conversation-rhythm-2', ['劉備', '曹操'], [
      ['劉備', '庭院那個座位空著。'],
      ['曹操', '門口有人停住了。'],
      ['劉備', '我去問他要不要坐。'],
      ['曹操', '別太快。'],
    ]),
    fixtureConversation('conversation-rhythm-3', ['麻衣', '海'], [
      ['麻衣', '教室後排那張桌子太安靜。'],
      ['海', '我先不把它寫進簡報。'],
      ['麻衣', '這次算你聰明。'],
      ['海', '欸。'],
    ]),
    fixtureConversation('conversation-rhythm-4', ['真晝', '海'], [
      ['真晝', '庭院那張椅子旁邊沒人坐。'],
      ['海', '我會注意。'],
      ['真晝', '不用開會。'],
      ['海', '知道。'],
    ]),
    fixtureConversation('conversation-rhythm-5', ['明日奈', '麻衣'], [
      ['明日奈', '教室的清單先關掉。'],
      ['麻衣', '你終於沒有把它講成任務。'],
      ['明日奈', '先別誇。'],
      ['麻衣', '我也沒要。'],
    ]),
  ];
  const thinRhythmSummary = summarize(thinRhythmConversations.map(analyzeConversation), []);
  const thinRhythmStatus = decideStatus(thinRhythmSummary);
  assertEqual(thinRhythmSummary.rhythmGrounded, 0, 'detects no daily rhythm cues');
  assertEqual(thinRhythmStatus.decision, 'daily_rhythm_thin', 'scene-rich dialogue without daily rhythm warns');

  const flatSoulConversations = [
    fixtureConversation('conversation-soul-1', ['海', '真晝'], [
      ['海', '今天上午教室後排少了兩本筆記。'],
      ['真晝', '那邊先留意。'],
      ['海', '黑板旁邊也空了一格。'],
      ['真晝', '我知道。'],
    ]),
    fixtureConversation('conversation-soul-2', ['明日奈', '麻衣'], [
      ['明日奈', '中午餐廳靠窗那桌空著。'],
      ['麻衣', '餐盤還在桌上。'],
      ['明日奈', '我看到了。'],
      ['麻衣', '嗯。'],
    ]),
    fixtureConversation('conversation-soul-3', ['曹操', '劉備'], [
      ['曹操', '下午庭院旁邊有人把作業放著。'],
      ['劉備', '那張椅子沒人動。'],
      ['曹操', '樹下也有人站著。'],
      ['劉備', '先看著。'],
    ]),
    fixtureConversation('conversation-soul-4', ['海', '明日奈'], [
      ['海', '放學後教室桌上還有紙。'],
      ['明日奈', '旁邊的書包也還在。'],
      ['海', '今天先記下來。'],
      ['明日奈', '好。'],
    ]),
    fixtureConversation('conversation-soul-5', ['麻衣', '真晝'], [
      ['麻衣', '晚上走廊燈還亮著。'],
      ['真晝', '宿舍門旁邊有人站過。'],
      ['麻衣', '地上有水。'],
      ['真晝', '我注意到了。'],
    ]),
  ];
  const flatSoulSummary = summarize(flatSoulConversations.map(analyzeConversation), []);
  const flatSoulStatus = decideStatus(flatSoulSummary);
  assertEqual(flatSoulSummary.soulStyledConversations, 0, 'detects no character-specific soul style');
  assertEqual(flatSoulStatus.decision, 'soul_style_flat', 'life/rhythm-rich but generic dialogue warns about flat soul style');

  const postProcessingDriftConversations = [
    fixtureConversation('conversation-post-1', ['真晝', '海'], [
      ['真晝', '早餐先喝一口牛奶。'],
      ['海', '嗯，今天簡報少一點。'],
      ['真晝', '那孩子等一下再看。'],
      ['海', '好，我先把杯子拿著。'],
    ], [
      {
        characterName: '真晝',
        residueLineZh: '真晝還記得海聽起來很有用，但不像真的休息過。',
        memoryLineZh: '海要整理世界情緒的脈絡，避免牽動主線。',
      },
    ]),
    fixtureConversation('conversation-post-2', ['麻衣', '曹操'], [
      ['麻衣', '那句沒事說得太漂亮。'],
      ['曹操', '我先看門口。'],
      ['麻衣', '別把它講成規矩。'],
      ['曹操', '我知道，先留座位。'],
    ], [
      {
        characterName: '曹操',
        memoryLineZh: '曹操決定觀察誰支持 Alan 的 AI 社邊界。',
      },
    ]),
    fixtureConversation('conversation-post-3', ['劉備', '明日奈'], [
      ['劉備', '午餐我多帶一份。'],
      ['明日奈', '那我少接一件。'],
      ['劉備', '我們先不追問。'],
      ['明日奈', '好，今天先這樣。'],
    ], []),
  ];
  const postProcessingDriftSummary = summarize(
    postProcessingDriftConversations.map(analyzeConversation),
    [],
  );
  const postProcessingDriftStatus = decideStatus(postProcessingDriftSummary);
  assertEqual(postProcessingDriftSummary.postProcessingDriftFlags, 2, 'detects memory/residue post-processing drift');
  assertEqual(postProcessingDriftStatus.decision, 'post_processing_drift', 'post-processing drift warns');

  const propEchoConversations = [
    fixtureConversation('conversation-prop-1', ['海', '真晝'], [
      ['真晝', '你手裡那張紀錄表先放著，便當都涼了。'],
      ['海', '紀錄表我等一下再看，你先把便當吃掉。'],
      ['真晝', '便當可以晚一點，但紀錄表上那個名字我有點在意。'],
      ['海', '那就先不要一直盯著紀錄表。'],
    ]),
    fixtureConversation('conversation-prop-2', ['明日奈', '麻衣'], [
      ['明日奈', '今天中午餐廳那張桌子空著。'],
      ['麻衣', '我看到了，你先不要把它拆成待辦。'],
      ['明日奈', '好，下午再說。'],
      ['麻衣', '這句比較像人話。'],
    ]),
    fixtureConversation('conversation-prop-3', ['曹操', '劉備'], [
      ['曹操', '門口那張椅子還空著。'],
      ['劉備', '那我午餐多帶一份。'],
      ['曹操', '別問太快。'],
      ['劉備', '我知道。'],
    ]),
  ];
  const propEchoSummary = summarize(propEchoConversations.map(analyzeConversation), []);
  const propEchoStatus = decideStatus(propEchoSummary);
  assertEqual(propEchoSummary.propEchoFlags, 1, 'detects repeated concrete prop inside one conversation');
  assertEqual(propEchoStatus.decision, 'prop_echo_repeated', 'repeated prop echo warns');

  const narrationLeakConversations = [
    fixtureConversation('conversation-narration-1', ['海', '劉備'], [
      [
        '海',
        '海看著你面前那杯沒喝完的果汁，問：「如果下週的聯誼活動，有人因為怕被拒絕而不敢靠近任何圈子，劉備，你會怎麼自然地邀請他？」',
      ],
      ['劉備', '我會先坐遠一點，不讓他覺得自己被盯著。'],
      ['海', '嗯，這句比較像邀請。'],
      ['劉備', '那我午餐多帶一份。'],
    ]),
    fixtureConversation('conversation-narration-2', ['真晝', '明日奈'], [
      ['真晝', '早餐先吃一點吧。'],
      ['明日奈', '明日奈把清單推遠一點，「今天先不要再新增東西。」'],
      ['真晝', '不用急。'],
      ['明日奈', '好。'],
    ]),
    fixtureConversation('conversation-narration-3', ['麻衣', '曹操'], [
      ['麻衣', '麻衣看著曹操沒有碰那份午餐，你這句太工整。'],
      ['曹操', '那我不說規矩。'],
      ['麻衣', '先看誰站在門口。'],
      ['曹操', '我知道。'],
    ]),
  ];
  const narrationLeakSummary = summarize(narrationLeakConversations.map(analyzeConversation), []);
  const narrationLeakStatus = decideStatus(narrationLeakSummary);
  assertEqual(narrationLeakSummary.hygieneFlags, 3, 'detects third-person self narration as hygiene');
  assertEqual(narrationLeakStatus.decision, 'hygiene_failure', 'third-person self narration fails hygiene');

  console.log('[life-signals:self-test] PASS');
}

function fixtureConversation(id, participants, rows, memoryTraces = []) {
  return {
    id,
    createdAt: Date.now(),
    timestampLabelZh: 'self-test',
    involvedCharacters: participants,
    transcriptMessages: rows.map(([author, text]) => ({ author, text })),
    memoryTraces,
  };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function analyzeConversation(conversation) {
  const text = transcriptFor(conversation);
  const groupHits = Object.fromEntries(
    Object.entries(LIFE_GROUPS).map(([group, cues]) => [
      group,
      cues.filter((cue) => text.includes(cue)),
    ]),
  );
  const rhythmHits = Object.fromEntries(
    Object.entries(RHYTHM_GROUPS).map(([group, cues]) => [
      group,
      cues.filter((cue) => text.includes(cue)),
    ]),
  );
  const lifeCues = [...new Set(Object.values(groupHits).flat())];
  const rhythmCues = [...new Set(Object.values(rhythmHits).flat())];
  const adminCues = ADMIN_DRIFT_CUES.filter((cue) => text.includes(cue));
  const messages = conversation.transcriptMessages ?? [];
  const hygieneCues = [
    ...HYGIENE_CUES.filter((cue) => text.toLowerCase().includes(cue.toLowerCase())),
    ...thirdPersonSelfNarrationCues(messages),
    ...malformedNameClusterCues(messages),
  ];
  const memoryTraceText = memoryTraceTextFor(conversation);
  const postProcessingDriftCues = POST_PROCESSING_DRIFT_CUES.filter((cue) =>
    memoryTraceText.includes(cue),
  );
  const propEchoes = propEchoesForMessages(messages);
  const soulStyleHits = soulStyleHitsForMessages(messages);
  const speakerCount = new Set(messages.map((message) => message.author).filter(Boolean)).size;
  const messageCount = messages.filter((message) => cleanLine(message.text)).length;
  const pilotScope = (conversation.involvedCharacters ?? []).some((name) => PILOT_NAMES.has(name));
  const activeGroups = Object.values(groupHits).filter((hits) => hits.length > 0).length;
  const lifeScore = clamp01((lifeCues.length * 0.12) + activeGroups * 0.16 + (pilotScope ? 0.08 : 0));
  const adminScore = clamp01(adminCues.length * 0.18);
  const hygieneScore = clamp01(hygieneCues.length * 0.35);
  const shapeScore = clamp01(
    (messageCount <= 1 ? 0.7 : messageCount < 4 ? 0.35 : 0) +
      (speakerCount < 2 ? 0.35 : 0),
  );
  const netLifeScore = clamp01(lifeScore - adminScore * 0.55 - hygieneScore * 0.7 - shapeScore * 0.45);
  return {
    id: conversation.id,
    timeLabel: conversation.timestampLabelZh ?? localTimeLabel(conversation.createdAt, TIME_ZONE),
    participants: conversation.involvedCharacters ?? [],
    pilotScope,
    messageCount,
    speakerCount,
    lifeCues,
    adminCues,
    hygieneCues,
    groupHits,
    rhythmHits,
    rhythmCues,
    soulStyleHits,
    soulStyleAuthors: [...new Set(soulStyleHits.map((hit) => hit.author))],
    propEchoes,
    postProcessingDriftCues,
    shapeScore,
    lifeScore,
    adminScore,
    hygieneScore,
    netLifeScore,
    bestLine: bestLifeLine(conversation, lifeCues),
    driftLine: bestCueLine(conversation, adminCues),
    postProcessingDriftLine: bestMemoryTraceLine(conversation, postProcessingDriftCues),
  };
}

function malformedNameClusterCues(messages) {
  return messages
    .map((message) => cleanLine(message.text))
    .filter((line) => MALFORMED_NAME_CLUSTER_RE.test(line))
    .map(() => 'malformed addressee cluster');
}

function thirdPersonSelfNarrationCues(messages) {
  return messages
    .map((message) => cleanLine(message.text))
    .filter((line) => THIRD_PERSON_SELF_NARRATION_RE.test(line))
    .map(() => 'third-person self narration');
}

function summarize(analyses, repeatedLines) {
  const count = analyses.length;
  const average = (items) => (items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0);
  const lifeGrounded = analyses.filter((item) => item.netLifeScore >= 0.45).length;
  const adminDrift = analyses.filter((item) => item.adminScore >= 0.35 && item.netLifeScore < 0.45).length;
  const hygieneFlags = analyses.filter((item) => item.hygieneScore > 0).length;
  const conversationShapeFlags = analyses.filter((item) => item.shapeScore >= 0.35).length;
  const singleMessageFlags = analyses.filter((item) => item.messageCount <= 1).length;
  const oneSpeakerFlags = analyses.filter((item) => item.speakerCount < 2).length;
  const postProcessingDriftFlags = analyses.filter((item) => item.postProcessingDriftCues.length > 0).length;
  const propEchoFlags = analyses.filter((item) => item.propEchoes.length > 0).length;
  const pilotAnalyses = analyses.filter((item) => item.pilotScope);
  const groupCounts = Object.fromEntries(
    Object.keys(LIFE_GROUPS).map((group) => [
      group,
      analyses.filter((item) => item.groupHits[group]?.length).length,
    ]),
  );
  const activeSceneGroups = Object.entries(groupCounts)
    .filter(([, groupCount]) => groupCount > 0)
    .map(([group]) => group);
  const ordinarySceneDiversity = ORDINARY_SCENE_GROUPS.filter((group) => groupCounts[group] > 0).length;
  const officeGrounded = analyses.filter((item) => item.groupHits.office?.length).length;
  const ordinarySceneGrounded = analyses.filter((item) =>
    ORDINARY_SCENE_GROUPS.some((group) => item.groupHits[group]?.length),
  ).length;
  const rhythmGrounded = analyses.filter((item) => item.rhythmCues.length > 0).length;
  const rhythmGroups = Object.keys(RHYTHM_GROUPS).filter((group) =>
    analyses.some((item) => item.rhythmHits[group]?.length),
  );
  const soulStyledConversations = analyses.filter((item) => item.soulStyleHits.length > 0).length;
  const soulStyleAuthors = [...new Set(analyses.flatMap((item) => item.soulStyleAuthors))];
  return {
    count,
    lifeGrounded,
    adminDrift,
    hygieneFlags,
    conversationShapeFlags,
    singleMessageFlags,
    oneSpeakerFlags,
    postProcessingDriftFlags,
    propEchoFlags,
    repeatedLineFlags: repeatedLines.length,
    pilotCount: pilotAnalyses.length,
    averageNetLifeScore: average(analyses.map((item) => item.netLifeScore)),
    averagePilotLifeScore: average(pilotAnalyses.map((item) => item.netLifeScore)),
    groupCounts,
    activeSceneGroups,
    sceneDiversity: activeSceneGroups.length,
    ordinarySceneDiversity,
    officeGrounded,
    ordinarySceneGrounded,
    rhythmGrounded,
    rhythmDiversity: rhythmGroups.length,
    rhythmGroups,
    soulStyledConversations,
    soulStyleDiversity: soulStyleAuthors.length,
    soulStyleAuthors,
  };
}

function decideStatus(summary) {
  if (summary.count < 3) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'sample_pending',
      reason: 'Fewer than 3 daytime conversations are available.',
      nextAction: 'Let the world run naturally before tuning prompts.',
    };
  }
  if (summary.hygieneFlags > 0) {
    return {
      label: 'FAIL',
      passWarnFail: '0 / 0 / 1',
      decision: 'hygiene_failure',
      reason: 'At least one conversation has fallback/incomplete-format hygiene risk.',
      nextAction: 'Use repair gate only if the flagged item is fresh and specific.',
    };
  }
  if (summary.repeatedLineFlags > 0) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'life_signal_repeated',
      reason: 'Campus-life cues exist, but repeated surface lines make the world feel less free.',
      nextAction: 'Do not rewrite prompts from old samples; if this repeats in fresh samples, use repair gate/proposal.',
    };
  }
  if (summary.propEchoFlags > 0) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'prop_echo_repeated',
      reason: 'Conversation uses concrete campus-life props, but repeats the same object enough to feel scripted.',
      nextAction: 'Do not patch from one sample; if this repeats in fresh archives, review prop/motif diversity before prompt tuning.',
    };
  }
  if (summary.singleMessageFlags > 0 || summary.conversationShapeFlags / summary.count >= 0.5) {
    return {
      label: summary.singleMessageFlags > 0 ? 'FAIL' : 'WARN',
      passWarnFail: summary.singleMessageFlags > 0 ? '0 / 0 / 1' : '0 / 1 / 0',
      decision: 'conversation_shape_collapse',
      reason: 'Some archived conversations are too short or one-sided to feel like a living free-world exchange.',
      nextAction: 'Treat this as generation/archiving flow evidence; route through repair gate before changing prompts.',
    };
  }
  if (summary.postProcessingDriftFlags > 0) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'post_processing_drift',
      reason: 'Dialogue may be life-grounded, but memory/residue post-processing is reintroducing system, AI club, student-council, or main-plot language.',
      nextAction: 'Treat this as memory/outcome hygiene evidence; fix only the specific post-processing path that produced the drift.',
    };
  }
  if (summary.lifeGrounded === 0 || summary.adminDrift > summary.lifeGrounded) {
    return {
      label: 'FAIL',
      passWarnFail: '0 / 0 / 1',
      decision: 'life_signal_missing',
      reason: 'Administrative/system language is stronger than ordinary campus-life grounding.',
      nextAction: 'Draft a proposal or targeted prompt patch only after fresh samples repeat this pattern.',
    };
  }
  if (
    summary.count >= 5 &&
    summary.lifeGrounded > 0 &&
    summary.ordinarySceneDiversity < 2 &&
    summary.officeGrounded >= summary.ordinarySceneGrounded
  ) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'scene_diversity_thin',
      reason: 'Recent life cues are too concentrated around Alan/office/task language instead of varied campus scenes.',
      nextAction: 'Keep observing; if this repeats in fresh daytime samples, propose small scene-topic routing rather than adding systems.',
    };
  }
  if (summary.count >= 5 && summary.lifeGrounded > 0 && summary.rhythmGrounded / summary.count < 0.3) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'daily_rhythm_thin',
      reason: 'Recent conversations have scene cues, but too little same-day rhythm such as morning, lunch, afternoon, after-school, or rest.',
      nextAction: 'Keep observing; if fresh samples repeat this, propose small prompt/context routing so characters know what part of the day they are living.',
    };
  }
  if (summary.count >= 5 && summary.lifeGrounded > 0 && summary.soulStyledConversations / summary.count < 0.35) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'soul_style_flat',
      reason: 'Recent conversations have life/rhythm cues, but too few character-specific ways of caring, avoiding, ordering, or carrying burden.',
      nextAction: 'Keep observing; if fresh samples repeat this, propose a small character-style routing fix instead of broad prompt rewrites.',
    };
  }
  if (summary.averageNetLifeScore < 0.45 || summary.lifeGrounded / summary.count < 0.4) {
    return {
      label: 'WARN',
      passWarnFail: '0 / 1 / 0',
      decision: 'weak_life_signal',
      reason: 'Some campus-life cues exist, but they are not yet dominant.',
      nextAction: 'Keep observing and prefer small scene-topic tuning over new systems.',
    };
  }
  return {
    label: 'PASS',
    passWarnFail: '1 / 0 / 0',
    decision: 'life_signal_observed',
    reason: 'Recent conversations are mostly grounded in ordinary campus-life cues.',
    nextAction: 'Continue natural observation; do not optimize for prettier dialogue.',
  };
}

async function writeReport({ data, window, queryWindow, conversations, analyses, repeatedLines, summary, status }) {
  const report = [
    '# GIIS Underworld Life Signals Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${SINCE_CREATED_AT === undefined ? 'day_window' : 'fresh_window'}`,
    `Target date: ${TARGET_DATE}`,
    `Timezone: ${TIME_ZONE}`,
    'Window: 06:00-21:59',
    `UTC range: ${new Date(window.startAt).toISOString()} -> ${new Date(window.endAt).toISOString()}`,
    SINCE_CREATED_AT === undefined
      ? undefined
      : `Fresh boundary: ${new Date(SINCE_CREATED_AT).toISOString()}`,
    SINCE_CREATED_AT === undefined
      ? undefined
      : `Query UTC range: ${new Date(queryWindow.startAt).toISOString()} -> ${new Date(queryWindow.endAt).toISOString()}`,
    '',
    '## Summary',
    '',
    `- Status: ${status.label}`,
    `- PASS/WARN/FAIL: ${status.passWarnFail}`,
    `- Decision: ${status.decision}`,
    `- Reason: ${status.reason}`,
    `- Conversation count: ${summary.count}`,
    `- Life-grounded conversations: ${summary.lifeGrounded}`,
    `- Administrative drift flags: ${summary.adminDrift}`,
    `- Hygiene flags: ${summary.hygieneFlags}`,
    `- Conversation shape flags: ${summary.conversationShapeFlags}`,
    `- Single-message conversations: ${summary.singleMessageFlags}`,
    `- One-speaker conversations: ${summary.oneSpeakerFlags}`,
    `- Post-processing drift flags: ${summary.postProcessingDriftFlags}`,
    `- Prop echo flags: ${summary.propEchoFlags}`,
    `- Repeated line flags: ${summary.repeatedLineFlags}`,
    `- Pilot-scope conversations: ${summary.pilotCount}`,
    `- Scene diversity: ${summary.sceneDiversity}`,
    `- Ordinary scene diversity: ${summary.ordinarySceneDiversity}`,
    `- Office-grounded conversations: ${summary.officeGrounded}`,
    `- Ordinary-scene conversations: ${summary.ordinarySceneGrounded}`,
    `- Daily rhythm conversations: ${summary.rhythmGrounded}`,
    `- Daily rhythm diversity: ${summary.rhythmDiversity}`,
    `- Soul-style conversations: ${summary.soulStyledConversations}`,
    `- Soul-style diversity: ${summary.soulStyleDiversity}`,
    `- Average life signal score: ${summary.averageNetLifeScore.toFixed(2)}`,
    `- Average pilot life signal score: ${summary.averagePilotLifeScore.toFixed(2)}`,
    `- Next safest action: ${status.nextAction}`,
    `- Convex checkedAt: ${data?.checkedAt ? new Date(data.checkedAt).toISOString() : 'unknown'}`,
    '',
    '## Scene Coverage',
    '',
    ...Object.entries(summary.groupCounts).map(([group, count]) => `- ${group}: ${count}`),
    '',
    '## Soul Style Coverage',
    '',
    summary.soulStyleAuthors.length
      ? `- characters with style cues: ${summary.soulStyleAuthors.join('、')}`
      : '- characters with style cues: none',
    '',
    '## Repeated Surface Lines',
    '',
    listOrNone(
      repeatedLines.slice(0, 6).map(
        (item) =>
          `- ${item.count}x · ${item.author ?? 'unknown'} · "${item.text}"\n  - conversations: ${item.conversationIds.join(', ')}`,
      ),
      'No repeated surface lines found.',
    ),
    '',
    '## Repeated Props / Motifs',
    '',
    listOrNone(
      analyses
        .filter((item) => item.propEchoes.length)
        .slice(0, 6)
        .map(
          (item) =>
            `- ${item.id} · ${item.timeLabel} · ${item.participants.join(' / ')} · ${item.propEchoes.map((echo) => `${echo.cue} ${echo.count}x`).join('、')}\n  - ${item.bestLine || 'No clear line.'}`,
        ),
      'No repeated prop echo found.',
    ),
    '',
    '## Post-Processing Drift',
    '',
    listOrNone(
      analyses
        .filter((item) => item.postProcessingDriftCues.length)
        .slice(0, 6)
        .map(
          (item) =>
            `- ${item.id} · ${item.timeLabel} · ${item.participants.join(' / ')} · cues ${item.postProcessingDriftCues.join('、')}\n  - ${item.postProcessingDriftLine || 'No clear trace line.'}`,
        ),
      'No memory/residue post-processing drift found.',
    ),
    '',
    '## Strongest Life Signals',
    '',
    listOrNone(
      analyses
        .filter((item) => item.netLifeScore > 0)
        .sort((a, b) => b.netLifeScore - a.netLifeScore)
        .slice(0, 5)
        .map(
          (item) =>
            `- ${item.id} · ${item.timeLabel} · ${item.participants.join(' / ')} · score ${item.netLifeScore.toFixed(2)} · cues ${item.lifeCues.join('、') || 'none'}\n  - ${item.bestLine || 'No clear line.'}`,
        ),
      'No clear life signal yet.',
    ),
    '',
    '## Weakest / Drift Signals',
    '',
    listOrNone(
      analyses
        .filter((item) => item.adminCues.length || item.hygieneCues.length || item.shapeScore > 0 || item.netLifeScore < 0.25)
        .sort((a, b) => b.adminScore + b.hygieneScore + b.shapeScore - (a.adminScore + a.hygieneScore + a.shapeScore))
        .slice(0, 5)
        .map(
          (item) =>
            `- ${item.id} · ${item.timeLabel} · ${item.participants.join(' / ')} · messages ${item.messageCount} · speakers ${item.speakerCount} · life ${item.netLifeScore.toFixed(2)} · admin ${item.adminCues.join('、') || 'none'} · hygiene ${item.hygieneCues.join('、') || 'none'} · post ${item.postProcessingDriftCues.join('、') || 'none'} · shape ${item.shapeScore.toFixed(2)}\n  - ${item.postProcessingDriftLine || item.driftLine || item.bestLine || 'No clear line.'}`,
        ),
      'No drift signal found.',
    ),
    '',
    '## Policy',
    '',
    '- Observe-only report. This script did not trigger conversations or write to Convex.',
    '- This report measures ordinary-life grounding; it is not a prompt rewrite by itself.',
    '- Daily rhythm means conversation remembers the current part of the day; it is not a requirement that every line mention the clock.',
    '- Soul-style coverage means characters show their own care/avoidance/burden pattern; it is intentionally lightweight and should not be used alone for prompt rewrites.',
    '- If samples are fewer than 3, do not tune prompts from this report.',
    '',
  ].join('\n');

  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, report);
}

function findRepeatedLines(conversations) {
  const buckets = new Map();
  for (const conversation of conversations) {
    for (const message of conversation.transcriptMessages ?? []) {
      const text = cleanLine(message.text);
      if (text.length < 8) continue;
      if (/^(嗯|好|等一下|先到這裡)[。.!！?？]*$/.test(text)) continue;
      const key = `${message.author ?? 'unknown'}:${normalizeForRepeat(text)}`;
      const existing =
        buckets.get(key) ??
        {
          author: message.author,
          text: trim(text, 120),
          count: 0,
          conversationIds: [],
        };
      existing.count += 1;
      if (!existing.conversationIds.includes(conversation.id)) {
        existing.conversationIds.push(conversation.id);
      }
      buckets.set(key, existing);
    }
  }
  return [...buckets.values()]
    .filter((item) => item.count >= 3 && item.conversationIds.length >= 3)
    .sort((a, b) => b.count - a.count);
}

function propEchoesForMessages(messages) {
  const cleanMessages = messages
    .map((message) => cleanLine(message.text))
    .filter(Boolean);
  if (cleanMessages.length < 4) return [];
  return PROP_ECHO_CUES.map((cue) => {
    const count = cleanMessages.reduce((sum, line) => sum + countOccurrences(line, cue), 0);
    const messageCount = cleanMessages.filter((line) => line.includes(cue)).length;
    return { cue, count, messageCount };
  })
    .filter((item) => item.count >= 3 && item.messageCount >= 2)
    .sort((a, b) => b.count - a.count);
}

function soulStyleHitsForMessages(messages) {
  return messages.flatMap((message) => {
    const author = message.author ?? 'unknown';
    const cues = SOUL_STYLE_CUES[author] ?? [];
    const hits = cues.filter((cue) => cleanLine(message.text).includes(cue));
    return hits.length ? [{ author, cues: hits }] : [];
  });
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function bestLifeLine(conversation, cues) {
  return bestCueLine(conversation, cues);
}

function bestCueLine(conversation, cues) {
  const messages = conversation.transcriptMessages ?? [];
  const scored = messages
    .map((message) => ({
      message,
      score: cues.filter((cue) => message.text.includes(cue)).length,
    }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.score > 0 ? scored[0].message : messages[0];
  if (!best) return '';
  return `${best.author}: ${trim(best.text, 180)}`;
}

function bestMemoryTraceLine(conversation, cues) {
  for (const trace of conversation.memoryTraces ?? []) {
    for (const line of [trace.residueLineZh, trace.memoryLineZh]) {
      const text = cleanLine(line);
      if (text && cues.some((cue) => text.includes(cue))) {
        return `${trace.characterName ?? 'memory'}: ${trim(text, 180)}`;
      }
    }
  }
  return '';
}

function memoryTraceTextFor(conversation) {
  return (conversation.memoryTraces ?? [])
    .flatMap((trace) => [trace.characterName, trace.residueLineZh, trace.memoryLineZh])
    .filter(Boolean)
    .map(cleanLine)
    .join('\n');
}

function transcriptFor(conversation) {
  return (conversation.transcriptMessages ?? [])
    .map((message) => `${message.author}: ${message.text}`)
    .join('\n');
}

async function convexRun(functionName, payload) {
  const result = await execFileAsync(
    'npx',
    [
      'convex',
      'run',
      '--typecheck',
      'disable',
      '--codegen',
      'disable',
      functionName,
      JSON.stringify(payload),
    ],
    { cwd: REPO_ROOT, timeout: 60_000, maxBuffer: 1024 * 1024 * 8 },
  );
  return parseJsonFromStdout(result.stdout);
}

function parseJsonFromStdout(stdout) {
  const candidates = [];
  for (let start = 0; start < stdout.length; start += 1) {
    if (stdout[start] !== '{' && stdout[start] !== '[') continue;
    const candidate = balancedJsonSlice(stdout, start);
    if (candidate) candidates.push(candidate);
  }
  for (const candidate of candidates.sort((a, b) => b.length - a.length)) {
    try {
      return JSON.parse(candidate);
    } catch {
      // keep scanning
    }
  }
  return undefined;
}

function balancedJsonSlice(text, start) {
  const opener = text[start];
  const stack = [opener === '{' ? '}' : ']'];
  let inString = false;
  let escaped = false;
  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index];
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
    if (char === '{') stack.push('}');
    if (char === '[') stack.push(']');
    if (char === stack.at(-1)) {
      stack.pop();
      if (!stack.length) return text.slice(start, index + 1);
    }
  }
  return undefined;
}

function withLocalTime(conversation, timeZone) {
  const parts = localParts(conversation.createdAt, timeZone);
  return {
    ...conversation,
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    localHour: Number(parts.hour),
  };
}

function localWindow(dateKey, startHour, endHour, timeZone) {
  return {
    startAt: timestampForLocalDateHour(dateKey, startHour, timeZone),
    endAt: timestampForLocalDateHour(dateKey, endHour, timeZone),
  };
}

function timestampForLocalDateHour(dateKey, hour, timeZone) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  let guess = targetAsUtc;
  for (let index = 0; index < 4; index += 1) {
    const parts = localParts(guess, timeZone);
    const guessLocalAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      0,
      0,
    );
    const delta = targetAsUtc - guessLocalAsUtc;
    if (delta === 0) break;
    guess += delta;
  }
  return guess;
}

function dateKeyFor(timestamp, timeZone) {
  const parts = localParts(timestamp, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localParts(timestamp, timeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(timestamp))
      .map((part) => [part.type, part.value]),
  );
}

function localTimeLabel(timestamp, timeZone) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function listOrNone(lines, fallback) {
  return lines.length ? lines.join('\n') : fallback;
}

function cleanLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeForRepeat(value) {
  return cleanLine(value)
    .replace(/[，。！？、；：,.!?;:"“”「」『』（）()]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function trim(value, maxLength) {
  const text = cleanLine(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function relative(path) {
  return path.startsWith(`${REPO_ROOT}/`) ? path.slice(REPO_ROOT.length + 1) : path;
}

function parseArgs(argv) {
  return new Map(
    argv
      .filter((value) => value.startsWith('--'))
      .map((value) => {
        const equals = value.indexOf('=');
        if (equals === -1) return [value.slice(2), 'true'];
        return [value.slice(2, equals), value.slice(equals + 1)];
      }),
  );
}

function numberArg(name, fallback, min, max) {
  const raw = args.get(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function optionalNumberArg(name) {
  const raw = args.get(name);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

main().catch((error) => {
  console.error('[life-signals] failed');
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});

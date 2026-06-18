export type CharacterLifeEventType =
  | 'exam'
  | 'birthday'
  | 'club'
  | 'performance'
  | 'errand'
  | 'boundary';

export type CharacterLifeEventEmotion =
  | 'neutral'
  | 'smiling'
  | 'worried'
  | 'serious'
  | 'tired'
  | 'flustered'
  | 'guarded'
  | 'calm';

export type CharacterLifeEvent = {
  id: string;
  actorName: string;
  type: CharacterLifeEventType;
  titleZh: string;
  locationId: string;
  valenceZh: string;
  emotion: CharacterLifeEventEmotion;
  affectedNames: string[];
  descriptionZh: string;
  interpretationZh: string;
  reactionDialogueZh: string;
  developmentHook: string;
  importance: number;
};

// Bounded v0.1 pool: concrete life events with clear felt meaning. These are
// not civilization/lore events; they are school-life anchors that can color a
// character's current emotion and give later dialogue a real topic.
export const CHARACTER_LIFE_EVENTS: CharacterLifeEvent[] = [
  {
    id: 'tianze-perfect-quiz',
    actorName: 'Tianze',
    type: 'exam',
    titleZh: '天澤小考一百分',
    locationId: 'classroom',
    valenceZh: '得意、想測別人會不會只看分數',
    emotion: 'smiling',
    affectedNames: ['Tianze', 'Ichinose', 'Mahiru'],
    descriptionZh: '天澤小考拿了一百分，卻把考卷翻面壓在桌角，像是在等誰先問。',
    interpretationZh: '天澤不是單純開心；她想看別人會誇成績、怕她、還是看見她在測距離。',
    reactionDialogueZh: '「一百分而已，你們要先誇我，還是先懷疑我？」',
    developmentHook: '天澤可能更愛用玩笑測試別人的反應；一之瀨會注意這份得意背後的邊界。',
    importance: 7,
  },
  {
    id: 'mahiru-birthday-remembered',
    actorName: 'Mahiru',
    type: 'birthday',
    titleZh: '有人記得真晝生日',
    locationId: 'dormitory',
    valenceZh: '被看見、但有點不習慣',
    emotion: 'flustered',
    affectedNames: ['Mahiru', 'Umi', 'Sakiko'],
    descriptionZh: '宿舍門口多了一張小卡片，真晝才發現有人記得她今天生日。',
    interpretationZh: '真晝平常先照顧別人，被記得時反而不知道該怎麼收下。',
    reactionDialogueZh: '「我以為今天不會有人提這件事。」',
    developmentHook: '真晝可能短暫變得更安靜，也更容易注意誰其實在偷偷關心她。',
    importance: 8,
  },
  {
    id: 'umi-short-briefing-praised',
    actorName: 'Umi',
    type: 'errand',
    titleZh: '海的短簡報被接住',
    locationId: 'studentCouncilRoom',
    valenceZh: '鬆一口氣、被允許少說一點',
    emotion: 'calm',
    affectedNames: ['Umi', 'Mahiru', 'Alan'],
    descriptionZh: '海把今天的校長簡報縮成三行，沒有把所有事都攬進來。',
    interpretationZh: '海正在練習不是靠說更多來證明自己有用。',
    reactionDialogueZh: '「今天我只說三件事，剩下的讓世界自己呼吸一下。」',
    developmentHook: '海之後可能在 Alan 或真晝面前更敢縮短說明，而不是把疲憊翻成任務。',
    importance: 7,
  },
  {
    id: 'ichinose-kindness-boundary',
    actorName: 'Ichinose',
    type: 'boundary',
    titleZh: '一之瀨拒絕替人說沒事',
    locationId: 'courtyard',
    valenceZh: '溫柔但有邊界',
    emotion: 'serious',
    affectedNames: ['Ichinose', 'Tianze', 'Sakiko'],
    descriptionZh: '一之瀨在庭院裡很甜地拒絕替對方說「沒事」，要對方自己選清楚。',
    interpretationZh: '一之瀨的溫柔不是無限供應；她開始讓善意有主人和條件。',
    reactionDialogueZh: '「可以喔，但這次你要自己說，你想拿走的是什麼。」',
    developmentHook: '一之瀨可能更常用甜的語氣設邊界；天澤會想測那條線有多硬。',
    importance: 7,
  },
  {
    id: 'maomao-club-symptom-note',
    actorName: 'Maomao',
    type: 'club',
    titleZh: '貓貓記下奇怪症狀',
    locationId: 'aiClubRoom',
    valenceZh: '好奇、警覺',
    emotion: 'guarded',
    affectedNames: ['Maomao', 'Mahiru', 'Umi'],
    descriptionZh: '餐廳桌邊有人說沒事說得太快，貓貓把手抖和食慾一起記進小本子。',
    interpretationZh: '貓貓表面像在診斷，實際上是在意誰被大家忽略。',
    reactionDialogueZh: '「嘴說沒事，不代表身體也同意。」',
    developmentHook: '貓貓可能更常先觀察症狀，再決定要不要用尖銳的話照顧人。',
    importance: 7,
  },
  {
    id: 'sakiko-rehearsal-crack',
    actorName: 'Sakiko',
    type: 'performance',
    titleZh: '祥子練習時破音',
    locationId: 'dormitory',
    valenceZh: '維持儀態、但裂縫被聽見',
    emotion: 'guarded',
    affectedNames: ['Sakiko', 'Ichinose', 'Mahiru'],
    descriptionZh: '祥子在宿舍附近練習時破了一個音，立刻把曲譜夾好，像什麼都沒發生。',
    interpretationZh: '祥子越想保持漂亮，越怕別人聽見那個不完美的瞬間。',
    reactionDialogueZh: '「只是音準問題，不需要特別看我。」',
    developmentHook: '祥子可能用更正式的語氣保護自己；真晝會注意她退半步的方式。',
    importance: 7,
  },
];

export function characterLifeEventForClock(day: number, hour: number) {
  if (!CHARACTER_LIFE_EVENTS.length) return undefined;
  const index = Math.abs(day * 7 + Math.floor(hour / 3)) % CHARACTER_LIFE_EVENTS.length;
  return CHARACTER_LIFE_EVENTS[index];
}

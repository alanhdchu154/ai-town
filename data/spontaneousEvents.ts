// Small "突發事件" pool for ordinary school life. These are deliberately minor,
// non-plot interruptions a returning player would feel as "something happened
// while I was away" — not a generative event engine. Insertion is capped (a
// couple per day, spaced out) in convex/school.ts; content lives here so it can
// grow without touching logic.

export type SpontaneousEventSource = {
  titleZh: string;
  descriptionZh: string;
  locationId: string;
  involvedNames: string[];
  angleZh: string;
};

export const SPONTANEOUS_EVENTS: ReadonlyArray<SpontaneousEventSource> = [
  {
    titleZh: '走廊上有人突然大笑',
    descriptionZh: '走廊上不知道誰突然大笑了一聲，又馬上摀住嘴，留下一小段尷尬又好笑的安靜。',
    locationId: 'classroom',
    involvedNames: ['Tianze', 'Mahiru'],
    angleZh: '天澤會想知道笑點是什麼，真晝會在意那個摀嘴的人會不會難為情。',
  },
  {
    titleZh: '有人打翻了一整盤午餐',
    descriptionZh: '午餐時有人手一滑，整盤菜灑在地上；幾個人同時站起來想幫忙，又互相讓來讓去。',
    locationId: 'aiClubRoom',
    involvedNames: ['Sakiko', 'Maomao'],
    angleZh: '祥子會先蹲下去一起收，貓貓會留意有沒有人趁亂被笑。',
  },
  {
    titleZh: '一隻貓跑進了中央庭院',
    descriptionZh: '一隻不知道哪來的貓大搖大擺走進中央庭院，在長椅上坐下，像是來巡視的。',
    locationId: 'courtyard',
    involvedNames: ['Ichinose', 'Umi'],
    angleZh: '一之瀨會假裝不在意又偷看，海會把它當成今天少見的輕鬆畫面。',
  },
  {
    titleZh: '公佈欄多了一張沒署名的紙條',
    descriptionZh: '公佈欄上突然多了一張沒人承認貼的紙條，字寫得很小，路過的人都忍不住瞄一眼。',
    locationId: 'classroom',
    involvedNames: ['Tianze', 'Ichinose'],
    angleZh: '天澤會想拆穿是誰寫的，一之瀨會在意紙條想說又不敢說的是什麼。',
  },
  {
    titleZh: '社辦的燈無預警閃了幾下',
    descriptionZh: 'AI 社辦的燈突然閃了幾下又恢復正常，沒人知道是線路還是別的，氣氛一瞬間安靜下來。',
    locationId: 'aiClubRoom',
    involvedNames: ['Umi', 'Maomao'],
    angleZh: '海會先確認大家沒事，貓貓會把這當成一個該被記下的小異常。',
  },
  {
    titleZh: '有人帶了一盒分不完的點心',
    descriptionZh: '有人帶了一大盒點心，明顯一個人吃不完，放在桌上猶豫著要不要開口分給別人。',
    locationId: 'aiClubRoom',
    involvedNames: ['Sakiko', 'Mahiru'],
    angleZh: '祥子會直接招呼大家一起吃，真晝會注意那個不好意思開口的人。',
  },
  {
    titleZh: '操場傳來不知道誰在練球的聲音',
    descriptionZh: '放學後操場那邊一直傳來拍球的聲音，規律又有點固執，像是有人在練到不想停。',
    locationId: 'courtyard',
    involvedNames: ['Tianze', 'Maomao'],
    angleZh: '天澤會好奇那個人在跟什麼較勁，貓貓會想那是不是某種不說出口的壓力。',
  },
  {
    titleZh: '走廊盡頭有兩個人小聲爭執',
    descriptionZh: '走廊盡頭有兩個人壓低聲音在爭執，看到有人經過就突然停下來，假裝在看窗外。',
    locationId: 'classroom',
    involvedNames: ['Ichinose', 'Umi'],
    angleZh: '一之瀨會看穿那個「假裝沒事」，海會考慮要不要給他們一點空間。',
  },
  {
    titleZh: '午休廣播響了一聲又停了',
    descriptionZh: '午休時廣播突然響了一聲，像是有人要說什麼又改變主意，只留下一聲短短的雜音。',
    locationId: 'classroom',
    involvedNames: ['Mahiru', 'Tianze'],
    angleZh: '真晝會在意那個欲言又止的人，天澤會想猜本來要宣布的是什麼。',
  },
  {
    titleZh: '宿舍走廊的窗被風吹開',
    descriptionZh: '傍晚宿舍走廊的窗被風吹開，紙張散了一地；有人默默開始撿，沒有抱怨。',
    locationId: 'dormitory',
    involvedNames: ['Mahiru', 'Sakiko'],
    angleZh: '真晝會留意誰被風吵到、誰其實在等人陪，祥子會順手一起收。',
  },
];

import {
  closingBeatPromptLineForTest,
  directObjectBindingPromptLinesForTest,
  hasFreeWorldQualityLeakForTest,
  motifGuardPromptLinesForTest,
  repairFreeWorldSoulLineForTest,
  residuePromptLinesForTest,
  residueTimeLabelZhForTest,
  sanitizePilotLineForTest,
} from './conversation';

describe('conversation motif guard', () => {
  const originalResidueRead = process.env.UNDERWORLD_RESIDUE_READ;

  afterEach(() => {
    if (originalResidueRead === undefined) {
      delete process.env.UNDERWORLD_RESIDUE_READ;
    } else {
      process.env.UNDERWORLD_RESIDUE_READ = originalResidueRead;
    }
  });

  test('warns away from recently repeated prop families in residues', () => {
    const lines = motifGuardPromptLinesForTest(
      [],
      [
        '今天早上他把冷茶放在窗邊，清單還沒收。',
        '下午又提到茶、窗邊座位和那份清單。',
      ],
      'Umi',
      'Tianze',
    ).join('\n');

    expect(lines).toContain('冷茶/杯子');
    expect(lines).toContain('窗邊/走廊/空椅');
    expect(lines).toContain('清單/報告/文件');
    expect(lines).toContain('角色行動分化 / 海');
    expect(lines).toContain('not-now boundary');
  });

  test('flags the 6/10 cold-drink + stop-pushing motif family across messages', () => {
    // Real c:94473 / c:94448 shape: both 海 and 真晝 opened with a
    // cold-drink observation and a stop-pushing care move.
    const lines = motifGuardPromptLinesForTest(
      [
        '真晝 to 天澤: 你手邊的湯匙都涼了，先停一下，別再推那條規則了。',
        '海 to 真晝: 你手邊那杯茶都涼了，先別急著壓簡報。',
      ],
      [],
      'Mahiru',
      'Tianze',
    ).join('\n');

    expect(lines).toContain('涼掉的飲食');
    expect(lines).toContain('先停/先別推');
    expect(lines).toContain('不要再靠這些物件或場景推進');
  });

  test('adds a response-move guard when the last speaker already split responsibility', () => {
    const lines = motifGuardPromptLinesForTest(
      [
        '天澤 to 海: 這份清單太多了，我們一人一半分掉吧。',
      ],
      [],
      'Umi',
      'Tianze',
    ).join('\n');

    expect(lines).toContain('response-move guard');
    expect(lines).toContain('分一半');
    expect(lines).toContain('不要用同一種分擔/接走/扛下來回覆');
  });

  test('keeps Mahiru and Tianze legacy-slot action guidance distinct', () => {
    const mahiru = motifGuardPromptLinesForTest(
      [],
      ['便當放涼了，茶也放在桌角。'],
      'Mahiru',
      'Umi',
    ).join('\n');
    const tianze = motifGuardPromptLinesForTest(
      [],
      ['報告和清單又交給她，她想把工作分一半。'],
      'Tianze',
      'Mahiru',
    ).join('\n');

    expect(mahiru).toContain('角色行動分化 / 真晝');
    expect(mahiru).toContain('姿勢');
    expect(tianze).toContain('角色行動分化 / 天澤');
    expect(tianze).toContain('測一條底線');
  });

  test('adds Ichinose sweet-boundary action guidance', () => {
    const lines = motifGuardPromptLinesForTest(
      [],
      ['善意、債和代價又被說了一輪，但對方還是沒有承認自己想被照顧。'],
      'Ichinose',
      'Tianze',
    ).join('\n');

    expect(lines).toContain('角色行動分化 / 一之瀨');
    expect(lines).toContain('大姊姊式');
    expect(lines).toContain('親口承認想被照顧');
  });

  test('flags repeated transaction/debt language including price and exchange words', () => {
    const lines = motifGuardPromptLinesForTest(
      [
        '一之瀨 to 天澤: 這份溫柔可是有標價的。',
        '天澤 to 一之瀨: 你打算用什麼來換？',
      ],
      [],
      'Ichinose',
      'Tianze',
    ).join('\n');

    expect(lines).toContain('交易/欠債語言');
    expect(lines).toContain('不要再靠這些物件或場景推進');
  });

  test('flags repeated small object trace handoffs', () => {
    const lines = motifGuardPromptLinesForTest(
      [
        '祥子 to 真晝: 琴譜邊緣有點折痕。',
        '真晝 to 祥子: 我幫你用書籤夾住琴譜吧。',
      ],
      [],
      'Sakiko',
      'Mahiru',
    ).join('\n');

    expect(lines).toContain('小物件/痕跡接力');
  });

  test('repairs cross-speaker mirror lines into a distinct character move', () => {
    const repaired = repairFreeWorldSoulLineForTest(
      '我只是在想那張桌子磨損的痕跡看起來像誰上次偷偷把課本藏起來的線索吧？',
      'Mahiru',
      ['天澤 to 真晝: 欸，真晝，你該不會是在想那張桌子磨損的痕跡像不像誰上次偷偷把課本藏起來的線索吧？'],
    );

    expect(repaired).not.toContain('桌子磨損');
    expect(repaired).not.toContain('課本藏起來');
    // Autonomous pairs abort instead of pulling a canned pool line (pools
    // saturate the corpus at 100+ convs/day).
    expect(repaired).toContain('[ABORT_CONVERSATION]');
  });

  test('repairs repeated everyday props on the pilot sanitizer path', () => {
    const sanitized = sanitizePilotLineForTest(
      '那我把桌上這杯快涼掉的茶換成熱的，你坐下來歇一會兒吧。',
      'Mahiru',
      'Umi',
      [
        '海 to 真晝: 你手邊的杯子先放下。',
        '真晝 to 海: 那杯茶已經涼了。',
      ],
    );

    expect(sanitized).not.toMatch(/茶|杯/);
    expect(sanitized).toContain('[ABORT_CONVERSATION]');
  });

  test('repairs short quoted echo questions into character-specific moves', () => {
    const repaired = repairFreeWorldSoulLineForTest(
      '溫的？',
      'Tianze',
      [
        '真晝 to 天澤: 你眼神在躲，但我沒戳破；先把你手邊那杯快涼的果汁換成溫的，等你想說再說。',
      ],
    );

    expect(repaired).not.toContain('溫的');
    expect(repaired).toContain('[ABORT_CONVERSATION]');
  });

  test('aborts Umi/Maomao once repair phrases start relaying', () => {
    const repaired = repairFreeWorldSoulLineForTest(
      '症狀太整齊，反而可疑。',
      'Maomao',
      [
        '海 to 貓貓: 先停，妳不是觀察工具。',
        '貓貓 to 海: 別信嘴，先看反應。',
        '海 to 貓貓: 貓貓，先休息，不用替別人驗證沒事。',
      ],
    );

    expect(repaired).toContain('[ABORT_CONVERSATION]');
  });

  test('blocks stale template phrase that leaked into Ichinose/Sakiko', () => {
    expect(hasFreeWorldQualityLeakForTest('別讓我看見你還在硬撐。')).toBe(true);
  });

  test('blocks stale repair fallback phrases from becoming character voice', () => {
    expect(hasFreeWorldQualityLeakForTest('你躲得太明顯了，我今天先不拆。')).toBe(true);
    expect(hasFreeWorldQualityLeakForTest('這題先放著，看誰先心虛。')).toBe(true);
    expect(hasFreeWorldQualityLeakForTest('那你先說，哪一句是真心的？')).toBe(true);
    expect(hasFreeWorldQualityLeakForTest('可以喔，但這次你要自己選。')).toBe(true);
    expect(hasFreeWorldQualityLeakForTest('真的嗎？')).toBe(true);
    expect(hasFreeWorldQualityLeakForTest('剛才想到明天要處理的表格，一時分心。')).toBe(true);
  });

  test('aborts Sakiko and Tianze rehearsal-confirmation relay', () => {
    const shortEcho = repairFreeWorldSoulLineForTest(
      '不用特意來確認？',
      'Tianze',
      ['祥子 to 天澤: 明天的排練時間我已經調整過了，你不用特意來確認。'],
    );
    const sakikoRelay = repairFreeWorldSoulLineForTest(
      '排練時間已確認，沒必要再拆穿。',
      'Sakiko',
      [
        '祥子 to 天澤: 不用特意來確認，只是把時間挪到明天下午三點而已。',
        '天澤 to 祥子: 你躲得太明顯了，我今天先不拆。',
      ],
    );
    const tianzeRelay = repairFreeWorldSoulLineForTest(
      '這題先放著，看誰先心虛。',
      'Tianze',
      [
        '天澤 to 祥子: 再往前就不好玩了，先停。',
        '祥子 to 天澤: 那就到此為止。',
      ],
    );

    expect(shortEcho).not.toContain('不用特意來確認');
    expect(sakikoRelay).toContain('[ABORT_CONVERSATION]');
    expect(tianzeRelay).toContain('[ABORT_CONVERSATION]');
  });

  test('aborts Mahiru/Sakiko and Maomao/Mahiru repair phrase relays', () => {
    const mahiruSakiko = repairFreeWorldSoulLineForTest(
      '那我不動它，只陪你閉一會兒。',
      'Mahiru',
      [
        '真晝 to 祥子: 嗯，我不催你。先坐一下就好。',
        '祥子 to 真晝: 謝謝。這一小節，請讓我自己收好。',
      ],
    );
    const maomaoMahiru = repairFreeWorldSoulLineForTest(
      '創可貼邊緣已經泛白，明天換藥前別再碰水。',
      'Maomao',
      [
        '貓貓 to 真晝: 便當沒動是因為太燙，不是因為不想吃。',
        '真晝 to 貓貓: 我沒在催你，只是剛才看你手背貼著創可貼。',
      ],
    );

    expect(mahiruSakiko).toContain('[ABORT_CONVERSATION]');
    expect(maomaoMahiru).toContain('[ABORT_CONVERSATION]');
  });

  test('aborts fresh Sakiko/Tianze perfect-record relay from runtime sample', () => {
    const tianzeFirst = repairFreeWorldSoulLineForTest(
      '你躲得太明顯了，我今天先不拆。',
      'Tianze',
      ['祥子 to 天澤: 今天的排練曲目還差一點呼吸的節奏……你剛才那句話，是在試探我的台詞嗎？'],
    );
    const sakikoRecord = repairFreeWorldSoulLineForTest(
      '既然不拆，那這份「完美」的排練記錄就暫時由我收好。',
      'Sakiko',
      [
        '祥子 to 天澤: 今天的排練曲目還差一點呼吸的節奏……你剛才那句話，是在試探我的台詞嗎？',
        '天澤 to 祥子: 你躲得太明顯了，我今天先不拆。',
      ],
    );
    const tianzeRecord = repairFreeWorldSoulLineForTest(
      '既然要收好，那這本「完美」的記錄裡，有沒有哪一頁是你其實根本不想翻開的？',
      'Tianze',
      [
        '天澤 to 祥子: 你躲得太明顯了，我今天先不拆。',
        '祥子 to 天澤: 既然不拆，那這份「完美」的排練記錄就暫時由我收好。',
      ],
    );

    expect(tianzeFirst).toContain('[ABORT_CONVERSATION]');
    expect(sakikoRecord).toContain('[ABORT_CONVERSATION]');
    expect(tianzeRecord).toContain('[ABORT_CONVERSATION]');
  });

  test('aborts fresh Ichinose/Mahiru bento-truth relay from runtime sample', () => {
    const ichinoseTruth = repairFreeWorldSoulLineForTest(
      '那你先說，哪一句是真心的？',
      'Ichinose',
      [
        '一之瀨 to 真晝: 欸，真晝，你剛剛又把自己那份便當留著了吧？',
        '真晝 to 一之瀨: 被你發現了，剛才只是突然覺得有點累，不想動筷子。',
      ],
    );
    const mahiruBento = repairFreeWorldSoulLineForTest(
      '便當還熱著，我其實只是不想讓它冷掉。',
      'Mahiru',
      [
        '真晝 to 一之瀨: 被你發現了，剛才只是突然覺得有點累，不想動筷子。',
        '一之瀨 to 真晝: 那你先說，哪一句是真心的？',
      ],
    );
    const ichinoseChoice = repairFreeWorldSoulLineForTest(
      '可以喔，但這次你要自己選。',
      'Ichinose',
      [
        '一之瀨 to 真晝: 那你先說，哪一句是真心的？',
        '真晝 to 一之瀨: 便當還熱著，我其實只是不想讓它冷掉。',
      ],
    );

    expect(ichinoseTruth).toContain('[ABORT_CONVERSATION]');
    expect(mahiruBento).toContain('[ABORT_CONVERSATION]');
    expect(ichinoseChoice).toContain('[ABORT_CONVERSATION]');
  });

  test('aborts fresh Ichinose/Mahiru boiled-egg care relay from runtime sample', () => {
    const mahiruEgg = repairFreeWorldSoulLineForTest(
      '我看到你手邊那顆多出來的水煮蛋了，其實我最近胃口很淡，可能吃不下這麼多。',
      'Mahiru',
      ['一之瀨 to 真晝: 今天的便當裡多了一顆你喜歡的水煮蛋，是特意留給你的喔。'],
    );
    const ichinoseEgg = repairFreeWorldSoulLineForTest(
      '那顆水煮蛋就留著當我今晚加班的獎勵吧，真晝要是吃不下，就別勉強自己把這份溫柔也推開喔。',
      'Ichinose',
      [
        '一之瀨 to 真晝: 今天的便當裡多了一顆你喜歡的水煮蛋，是特意留給你的喔。',
        '真晝 to 一之瀨: 我看到你手邊那顆多出來的水煮蛋了，其實我最近胃口很淡，可能吃不下這麼多。',
      ],
    );
    const mahiruQuiet = repairFreeWorldSoulLineForTest(
      '我沒推開你的溫柔，只是今晚只想安靜坐著，不想吃東西。',
      'Mahiru',
      [
        '真晝 to 一之瀨: 我看到你手邊那顆多出來的水煮蛋了，其實我最近胃口很淡，可能吃不下這麼多。',
        '一之瀨 to 真晝: 那顆水煮蛋就留著當我今晚加班的獎勵吧，真晝要是吃不下，就別勉強自己把這份溫柔也推開喔。',
      ],
    );

    expect(mahiruEgg).toContain('[ABORT_CONVERSATION]');
    expect(ichinoseEgg).toContain('[ABORT_CONVERSATION]');
    expect(mahiruQuiet).toContain('[ABORT_CONVERSATION]');
  });

  test('aborts fresh Ichinose/Mahiru pudding-seat relay from runtime sample', () => {
    const mahiruPudding = repairFreeWorldSoulLineForTest(
      '布丁太甜了，我打算分給剛才在窗邊發呆、看起來沒吃飽的學生。',
      'Mahiru',
      ['一之瀨 to 真晝: 欸，真晝，你的餐盤裡還有半塊沒動過的布丁，是打算留到明天再吃嗎？'],
    );
    const ichinoseSeat = repairFreeWorldSoulLineForTest(
      '你總是把別人的空位填滿，卻忘了自己盤子裡的布丁其實還沒動過。',
      'Ichinose',
      [
        '一之瀨 to 真晝: 欸，真晝，你的餐盤裡還有半塊沒動過的布丁，是打算留到明天再吃嗎？',
        '真晝 to 一之瀨: 布丁太甜了，我打算分給剛才在窗邊發呆、看起來沒吃飽的學生。',
      ],
    );

    expect(mahiruPudding).toContain('[ABORT_CONVERSATION]');
    expect(ichinoseSeat).toContain('[ABORT_CONVERSATION]');
  });

  test('aborts fresh Ichinose/Mahiru half-bento form relay from runtime sample', () => {
    const mahiruEcho = repairFreeWorldSoulLineForTest(
      '真的嗎？',
      'Mahiru',
      ['一之瀨 to 真晝: 欸，真晝，今天的便當你只吃了一半呢。'],
    );
    const ichinoseHalf = repairFreeWorldSoulLineForTest(
      '欸，真晝，你的便當明明還剩一半，卻說「真的嗎」，是在跟我裝傻嗎？',
      'Ichinose',
      [
        '一之瀨 to 真晝: 欸，真晝，今天的便當你只吃了一半呢。',
        '真晝 to 一之瀨: 真的嗎？',
      ],
    );
    const mahiruForm = repairFreeWorldSoulLineForTest(
      '被你發現了，其實只是剛才想到明天要處理的表格，一時分心就沒吃下去。',
      'Mahiru',
      [
        '真晝 to 一之瀨: 真的嗎？',
        '一之瀨 to 真晝: 欸，真晝，你的便當明明還剩一半，卻說「真的嗎」，是在跟我裝傻嗎？',
      ],
    );

    expect(hasFreeWorldQualityLeakForTest(mahiruEcho)).toBe(true);
    expect(ichinoseHalf).toContain('[ABORT_CONVERSATION]');
    expect(mahiruForm).toContain('[ABORT_CONVERSATION]');
  });

  test('adds restaurant scene policy after food-object relay starts', () => {
    const restaurantLines = motifGuardPromptLinesForTest(
      [
        '一之瀨 to 真晝: 今天的便當裡多了一份點心，是特意留給你的喔。',
        '真晝 to 一之瀨: 我看到餐盤還沒收，其實可能吃不下這麼多。',
      ],
      [],
      'Ichinose',
      'Mahiru',
      '餐廳',
    ).join('\n');
    const classroomLines = motifGuardPromptLinesForTest(
      [
        '一之瀨 to 真晝: 今天的便當裡多了一份點心，是特意留給你的喔。',
        '真晝 to 一之瀨: 我看到餐盤還沒收，其實可能吃不下這麼多。',
      ],
      [],
      'Ichinose',
      'Mahiru',
      '教室',
    ).join('\n');

    expect(restaurantLines).toContain('餐廳接力硬規則');
    expect(restaurantLines).toContain('不要再提食物、餐具、吃不下');
    expect(classroomLines).not.toContain('餐廳接力硬規則');
  });

  test('aborts generic restaurant food-object relay without naming the new food', () => {
    const relay = repairFreeWorldSoulLineForTest(
      '那份點心還在餐盤上，她如果吃不下，我可以先留到明天。',
      'Ichinose',
      [
        '一之瀨 to 真晝: 今天的便當裡多了一顆水煮蛋，是特意留給你的喔。',
        '真晝 to 一之瀨: 我看到你手邊那顆多出來的水煮蛋了，其實我最近胃口很淡。',
      ],
    );
    const nonFoodMove = repairFreeWorldSoulLineForTest(
      '那我今天先不問了，妳把那口氣放回來就好。',
      'Mahiru',
      [
        '一之瀨 to 真晝: 今天的便當裡多了一顆水煮蛋，是特意留給你的喔。',
        '真晝 to 一之瀨: 我看到你手邊那顆多出來的水煮蛋了，其實我最近胃口很淡。',
      ],
    );

    expect(relay).toContain('[ABORT_CONVERSATION]');
    expect(nonFoodMove).not.toContain('[ABORT_CONVERSATION]');
  });

  test('does not abort ordinary non-relay breakfast chatter on broad food words', () => {
    const ordinary = repairFreeWorldSoulLineForTest(
      '我也喜歡早餐，吐司冷掉之前吃掉比較好。',
      'Mahiru',
      [
        '真晝 to 海: 今天早餐只有吐司和湯，我先拿一點就好。',
        '海 to 真晝: 嗯，吃完再慢慢說。',
      ],
    );

    expect(ordinary).not.toContain('[ABORT_CONVERSATION]');
  });

  test('aborts fresh Sakiko/Tianze skirt-wrinkle relay from runtime sample', () => {
    const tianzeWrinkle = repairFreeWorldSoulLineForTest(
      '皺痕也是演出的一部分吧？',
      'Tianze',
      ['祥子 to 天澤: 別靠太近，我的裙擺剛整理好，不想為了誰再皺一次。'],
    );
    const sakikoSkirt = repairFreeWorldSoulLineForTest(
      '備用裙在櫃子裡，天澤，明天我不會忘。',
      'Sakiko',
      [
        '祥子 to 天澤: 皺痕是演不完就結束的，天澤。',
        '天澤 to 祥子: 那如果明天排練時你忘了帶備用裙，是不是就得在台上承認自己其實很怕出錯？',
      ],
    );

    expect(tianzeWrinkle).toContain('[ABORT_CONVERSATION]');
    expect(sakikoSkirt).toContain('[ABORT_CONVERSATION]');
  });

  test('repairs Tianze/Ichinose short rhetorical echoes and abstract protection loops', () => {
    const ichinose = sanitizePilotLineForTest(
      '保護誰不重要，重要的是你現在想拿走這份溫柔，還是想先承認自己其實很怕累？',
      'Ichinose',
      'Tianze',
      ['天澤 to 一之瀨: 欸，一之瀨，你剛才那句溫柔的拒絕，到底是為了保護誰，還是怕自己太累？'],
    );
    const tianze = sanitizePilotLineForTest(
      '管不到？',
      'Tianze',
      'Ichinose',
      ['一之瀨 to 天澤: 欸，Alan 的眼神我哪管得到？'],
    );

    expect(ichinose).not.toMatch(/保護誰|拿走|承認|怕累/);
    expect(tianze).not.toContain('管不到');
    expect(ichinose.length).toBeGreaterThan(0);
    expect(tianze.length).toBeGreaterThan(0);
  });

  test('aborts Tianze/Ichinose once repair phrases start relaying', () => {
    const repaired = sanitizePilotLineForTest(
      '好啊，那我換個問題：你怕的是哪一段？',
      'Tianze',
      'Ichinose',
      [
        '天澤 to 一之瀨: 你躲得太明顯了，我今天先不拆。',
        '一之瀨 to 天澤: 那你先說，哪一句是真心的？',
      ],
    );

    expect(repaired).toContain('[ABORT_CONVERSATION]');
  });

  test('blocks system-ish emotional-memory and unnatural leave phrasing', () => {
    expect(hasFreeWorldQualityLeakForTest('我該去整理那些被我們忽略的情緒記憶了。')).toBe(true);
    expect(hasFreeWorldQualityLeakForTest('那我先不在此了。')).toBe(true);
  });

  test('keeps Tianze and Ichinose endings as closing beats, not abrupt exits', () => {
    const tianze = closingBeatPromptLineForTest('Tianze', 'Ichinose');
    const ichinose = closingBeatPromptLineForTest('Ichinose', 'Tianze');

    expect(tianze).toContain('不要只宣告離開');
    expect(tianze).toContain('這次不拆你');
    expect(ichinose).toContain('甜的邊界');
    expect(ichinose).toContain('不要只說下次見');
  });

  test('binds Alan curry requests to curry instead of generic food props', () => {
    const lines = directObjectBindingPromptLinesForTest('你週末可以做咖喱飯給我吃嗎').join('\n');

    expect(lines).toContain('咖哩飯');
    expect(lines).toContain('Do not replace');
    expect(lines).toContain('湯、便當、茶、碗');
  });

  test('labels same-day residues as today or just now in America/Chicago', () => {
    const now = Date.UTC(2026, 5, 2, 2, 30); // 2026-06-01 21:30 CT
    const afternoon = Date.UTC(2026, 5, 1, 19, 30); // 2026-06-01 14:30 CT
    const recent = Date.UTC(2026, 5, 2, 1, 0); // 2026-06-01 20:00 CT

    expect(residueTimeLabelZhForTest(afternoon, now)).toBe('今天下午 14:30');
    expect(residueTimeLabelZhForTest(recent, now)).toBe('剛才 20:00');
  });

  test('labels yesterday residues without pretending they are today', () => {
    const now = Date.UTC(2026, 5, 2, 2, 30); // 2026-06-01 21:30 CT
    const yesterdayEvening = Date.UTC(2026, 5, 1, 1, 30); // 2026-05-31 20:30 CT

    expect(residueTimeLabelZhForTest(yesterdayEvening, now)).toBe('昨天晚上 20:30');
  });

  test('labels older residues as previous dated memories', () => {
    const now = Date.UTC(2026, 5, 2, 2, 30); // 2026-06-01 21:30 CT
    const olderAfternoon = Date.UTC(2026, 4, 29, 20, 15); // 2026-05-29 15:15 CT
    const label = residueTimeLabelZhForTest(olderAfternoon, now);

    expect(label).toBe('之前 5/29 下午 15:15');
    expect(label).not.toMatch(/今天|昨天|剛才/);
  });

  test('residue read mode supports on, off, and placebo without leaking residue text', () => {
    const residues = [
      {
        text: '海還記得真晝把冷茶和清單放在窗邊，還說不要一個人硬扛。',
        createdAt: Date.UTC(2026, 5, 1, 19, 30),
      },
    ];

    delete process.env.UNDERWORLD_RESIDUE_READ;
    const onLines = residuePromptLinesForTest(residues, '真晝').join('\n');
    expect(onLines).toContain('殘留記憶');
    expect(onLines).toContain('海還記得真晝');

    process.env.UNDERWORLD_RESIDUE_READ = 'false';
    expect(residuePromptLinesForTest(residues, '真晝')).toEqual([]);

    process.env.UNDERWORLD_RESIDUE_READ = 'placebo';
    const placeboLines = residuePromptLinesForTest(residues, '真晝').join('\n');
    expect(placeboLines).toContain('場景節奏備註');
    expect(placeboLines).not.toContain('殘留');
    expect(placeboLines).not.toContain('海還記得真晝');
    expect(placeboLines).not.toContain('冷茶');
    expect(placeboLines).not.toContain('清單');
    expect(placeboLines).not.toContain('窗邊');
    expect(placeboLines).not.toContain('硬扛');
  });

  test('placebo read mode prevents residue text from driving motif guard lines', () => {
    process.env.UNDERWORLD_RESIDUE_READ = 'placebo';
    const lines = motifGuardPromptLinesForTest(
      [],
      [
        '今天早上他把冷茶放在窗邊，清單還沒收。',
        '下午又提到茶、窗邊座位和那份清單。',
      ],
      'Umi',
      'Tianze',
    ).join('\n');

    expect(lines).not.toContain('冷茶/杯子');
    expect(lines).not.toContain('窗邊/走廊/空椅');
    expect(lines).not.toContain('清單/報告/文件');
  });
});

import {
  hasCompanionSemanticDrift,
  hasDialogueSystemPhraseLeak,
  hasThirdPersonSelfNarrationLeak,
  stripSeparatorArtifacts,
  stripStageDirectionsFromDialogue,
} from './dialogueHygiene';

describe('dialogue hygiene', () => {
  test('strips third-person narration from an otherwise spoken line', () => {
    expect(
      stripStageDirectionsFromDialogue(
        '好的，明天再聊。這時牆壁上懸掛的掛盤下有一只小貓正在好奇地打量著它。我們可以聊聊那只貓的故事。',
      ),
    ).toEqual({
      line: '好的，明天再聊。我們可以聊聊那只貓的故事。',
      strippedStageDirection: true,
    });
  });

  test('keeps only quoted speech when narration is sandwiched between quotes', () => {
    // Real Ichinose leak: quoted speech, first-person narration, more quoted
    // speech. The narration verb (繫好) and description (眼神卻像溫柔的網) are not
    // in the stage-direction whitelist, so quote-dominant extraction handles it.
    expect(
      stripStageDirectionsFromDialogue(
        '「不要？那這頓飯可就不算免費了哦。」我輕輕把圍裙繫好，眼神卻像溫柔的網。「既然你堅持要我做洗碗工，那明天咖哩飯裡，我就多放點『懲罰』的鹽吧？」',
      ),
    ).toEqual({
      line: '不要？那這頓飯可就不算免費了哦。既然你堅持要我做洗碗工，那明天咖哩飯裡，我就多放點『懲罰』的鹽吧？',
      strippedStageDirection: true,
    });
  });

  test('does not treat a short emphasis quote as the whole spoken line', () => {
    // Here 「依賴」 is an emphasized word inside genuine speech, not the line.
    const input = '你問得這麼直接，是怕我反悔，還是怕自己太「依賴」這份溫柔？';
    expect(stripStageDirectionsFromDialogue(input).line).toBe(input);
  });

  test('strips first-person physical action while preserving speech', () => {
    expect(stripStageDirectionsFromDialogue('我放下杯子。先不要急。')).toEqual({
      line: '先不要急。',
      strippedStageDirection: true,
    });
    expect(stripStageDirectionsFromDialogue('我去把桌上的冷咖啡倒了，我們換個節奏慢慢弄完剩下的。')).toEqual({
      line: '我們換個節奏慢慢弄完剩下的。',
      strippedStageDirection: true,
    });
    expect(stripStageDirectionsFromDialogue('我把窗簾拉上一半，你聯絡時若遇到不接電話的，就留張便條。')).toEqual({
      line: '你聯絡時若遇到不接電話的，就留張便條。',
      strippedStageDirection: true,
    });
    expect(stripStageDirectionsFromDialogue('我先把這杯冷咖啡倒了，換點熱茶再來繼續。')).toEqual({
      line: '換點熱茶再來繼續。',
      strippedStageDirection: true,
    });
  });

  test('strips first-person staring action while preserving the spoken consequence', () => {
    expect(stripStageDirectionsFromDialogue('我剛才只是盯著窗外那棵樹發呆。那我就把這碗湯喝完。')).toEqual({
      line: '那我就把這碗湯喝完。',
      strippedStageDirection: true,
    });
  });

  test('strips pronoun action narration before Tianze-style speech', () => {
    expect(stripStageDirectionsFromDialogue('她歪了一下頭，欸，你真的不怕我拆穿你嗎？')).toEqual({
      line: '欸，你真的不怕我拆穿你嗎？',
      strippedStageDirection: true,
    });
    expect(stripStageDirectionsFromDialogue('他挑了一下眉，先別把這句話當成沒事。')).toEqual({
      line: '先別把這句話當成沒事。',
      strippedStageDirection: true,
    });
  });

  test('strips parenthetical actions while preserving speech', () => {
    expect(stripStageDirectionsFromDialogue('（她看向窗外）我們先小聲一點。')).toEqual({
      line: '我們先小聲一點。',
      strippedStageDirection: true,
    });
  });

  test('preserves ordinary life references', () => {
    expect(
      stripStageDirectionsFromDialogue('我也注意到它了，聽說它是去年宿舍收留的一隻流浪動物。'),
    ).toEqual({
      line: '我也注意到它了，聽說它是去年宿舍收留的一隻流浪動物。',
      strippedStageDirection: false,
    });
  });

  test('preserves spoken timing phrases that are not narration', () => {
    expect(stripStageDirectionsFromDialogue('這時候我們先停一下，等他自己開口。')).toEqual({
      line: '這時候我們先停一下，等他自己開口。',
      strippedStageDirection: false,
    });
  });

  test('preserves first-person timing speech about sitting down', () => {
    expect(stripStageDirectionsFromDialogue('這時我們先坐下來慢慢說。')).toEqual({
      line: '這時我們先坐下來慢慢說。',
      strippedStageDirection: false,
    });
  });

  test('preserves first-person speech about wanting rest near a window', () => {
    expect(stripStageDirectionsFromDialogue('此刻我只想靠在窗邊休息一下。')).toEqual({
      line: '此刻我只想靠在窗邊休息一下。',
      strippedStageDirection: false,
    });
  });

  test('preserves first-person speech about leaving a room', () => {
    expect(stripStageDirectionsFromDialogue('此刻我很想走出這間教室。')).toEqual({
      line: '此刻我很想走出這間教室。',
      strippedStageDirection: false,
    });
  });

  test('strips third-person self narration around quoted speech', () => {
    const line =
      '海看著你面前那杯沒喝完的果汁，問：「如果下週的聯誼活動，有人因為怕被拒絕而不敢靠近任何圈子，劉備，你會怎麼自然地邀請他？」';

    expect(stripStageDirectionsFromDialogue(line)).toEqual({
      line: '如果下週的聯誼活動，有人因為怕被拒絕而不敢靠近任何圈子，劉備，你會怎麼自然地邀請他？',
      strippedStageDirection: true,
    });
    expect(hasThirdPersonSelfNarrationLeak(line)).toBe(true);
  });

  test('strips third-person action narration before a bare quoted line', () => {
    const line = '海把餐盤推得靠近你一點，「走廊這麼安靜，你是不是又注意到誰沒有進來？」';

    expect(stripStageDirectionsFromDialogue(line)).toEqual({
      line: '走廊這麼安靜，你是不是又注意到誰沒有進來？',
      strippedStageDirection: true,
    });
    expect(hasThirdPersonSelfNarrationLeak(line)).toBe(true);
  });

  test('normalizes unquoted third-person self narration into first person speech', () => {
    const line =
      '海注意到你害怕每個圈子都有人被孤立，劉備。我們來想想如何讓大家都感到自己是重要的一分子。';

    expect(stripStageDirectionsFromDialogue(line)).toEqual({
      line: '我注意到你害怕每個圈子都有人被孤立，劉備。我們來想想如何讓大家都感到自己是重要的一分子。',
      strippedStageDirection: true,
    });
    expect(hasThirdPersonSelfNarrationLeak(line)).toBe(true);
  });

  test('strips named third-person stage narration and keeps following speech', () => {
    const line = '劉備看天澤有點心事重重的樣子，你要不要先問她午餐有沒有吃？';

    expect(stripStageDirectionsFromDialogue(line)).toEqual({
      line: '你要不要先問她午餐有沒有吃？',
      strippedStageDirection: true,
    });
    expect(hasThirdPersonSelfNarrationLeak(line)).toBe(true);
  });

  test('aborts named third-person stage narration when no speech remains', () => {
    const line = '海靜悄悄坐在走廊的一側，顯得有些緊張兮兮的。';

    expect(stripStageDirectionsFromDialogue(line)).toEqual({
      line: '',
      strippedStageDirection: true,
    });
    expect(hasThirdPersonSelfNarrationLeak(line)).toBe(true);
  });

  test('detects system phrase leaks that should not persist as memory', () => {
    expect(
      hasDialogueSystemPhraseLeak('我這幾天要整理世界情緒的脈絡，怕再待下去會把你也捲進那些混亂裡。'),
    ).toBe(true);
    expect(hasDialogueSystemPhraseLeak('我剛才突然意識到還有一項緊急的世界協調報告要處理。')).toBe(true);
    expect(hasDialogueSystemPhraseLeak('我得先整理幾份關於校園情緒地圖的報告。')).toBe(true);
    expect(hasDialogueSystemPhraseLeak('我先整理 Alan 的簡報，其他的下午再說。')).toBe(false);
  });

  test('detects Alan-Umi companion replies that dodge the latest emotional correction', () => {
    expect(
      hasCompanionSemanticDrift(
        '嗯，我懂。如果今天在這裡感到疲倦的原因是在餐桌上吃得太多放不下，那麼它很可能對睡眠和工作有影響。',
        '應該是喜歡吧',
      ),
    ).toBe(true);
    expect(
      hasCompanionSemanticDrift(
        '你的擔心更多的是關於依賴嗎？',
        '不是依賴，是喜歡',
      ),
    ).toBe(true);
    expect(
      hasCompanionSemanticDrift(
        '嗯，是喜歡。那我先不把它審判成危險，我只想陪你把這句話放穩一點。',
        '不是依賴，是喜歡',
      ),
    ).toBe(false);
  });

  test('strips standalone markdown separator artifacts from dialogue', () => {
    expect(stripSeparatorArtifacts('希望今天午餐能邀請到誰。\n\n---')).toBe('希望今天午餐能邀請到誰。');
    expect(stripSeparatorArtifacts('先到這裡。\n***\n下次再說。')).toBe('先到這裡。\n下次再說。');
  });

  test('preserves dates and spoken Chinese pauses while stripping only separator lines', () => {
    expect(stripSeparatorArtifacts('今天是 2026-05-28，我先記下來。')).toBe(
      '今天是 2026-05-28，我先記下來。',
    );
    expect(stripSeparatorArtifacts('——我不是那個意思。')).toBe('——我不是那個意思。');
  });
});

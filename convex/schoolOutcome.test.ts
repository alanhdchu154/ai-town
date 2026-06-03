import { conversationDecisionPhrase } from './school';

describe('school conversation outcomes', () => {
  test('varies repeated CaoCao outcomes while keeping concrete action language', () => {
    const first = conversationDecisionPhrase(
      'CaoCao',
      'Mahiru',
      '觀察誰站在門口卻沒有進來，先替那個人留出位置',
      '真晝說飯盒裡還有青菜，湯杯也涼了。',
    );
    const second = conversationDecisionPhrase(
      'CaoCao',
      'Ichinose',
      '觀察誰站在門口卻沒有進來，先替那個人留出位置',
      '一之瀨提到走廊門口有人停住，沒有進教室。',
    );

    expect(first).not.toBe(second);
    expect(`${first}\n${second}`).toMatch(/決定/);
    expect(`${first}\n${second}`).toMatch(/今天|明天|先|確認/);
  });

  test('uses meal cues for Mahiru instead of a fixed dorm-check line', () => {
    const mealOutcome = conversationDecisionPhrase(
      'Mahiru',
      'CaoCao',
      '確認誰因傳聞、作業壓力或太快說沒事而不敢說真心話',
      '飯盒裡多了一點沒吃完的青菜，手裡的湯杯涼了。',
    );
    const quietOutcome = conversationDecisionPhrase(
      'Mahiru',
      'Umi',
      '確認誰因傳聞、作業壓力或太快說沒事而不敢說真心話',
      '走廊突然安靜，有人太快說自己沒事。',
    );

    expect(mealOutcome).not.toBe(quietOutcome);
    expect(mealOutcome).toMatch(/飯盒|湯|吃飽|餐廳/);
    expect(quietOutcome).toMatch(/宿舍|走廊|沒事|安靜/);
  });
});

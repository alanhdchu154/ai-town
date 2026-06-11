import { repairConversationAddresseeText } from './addresseeRepair';

describe('conversation addressee repair', () => {
  test('repairs an embedded thanks-frame misaddress to the real addressee', () => {
    expect(
      repairConversationAddresseeText(
        '謝謝真晝提點，我會先找那個一直坐在角落的人吃飯。',
        '祥子',
        '一之瀨',
      ),
    ).toBe('謝謝一之瀨提點，我會先找那個一直坐在角落的人吃飯。');
  });

  test('keeps the real conversation partner when already addressed correctly', () => {
    expect(
      repairConversationAddresseeText(
        '謝謝一之瀨提醒，我先不把它講成規則。',
        '祥子',
        '一之瀨',
      ),
    ).toBe('謝謝一之瀨提醒，我先不把它講成規則。');
  });

  test('does not rewrite ordinary third-person references', () => {
    expect(
      repairConversationAddresseeText(
        '真晝昨天看起來很累。',
        '祥子',
        '一之瀨',
      ),
    ).toBe('真晝昨天看起來很累。');
  });

  test('does not corrupt words containing the single-character alias 海', () => {
    expect(
      repairConversationAddresseeText(
        '謝謝海邊的風讓我冷靜。',
        '祥子',
        '一之瀨',
      ),
    ).toBe('謝謝海邊的風讓我冷靜。');
  });

  test('repairs malformed terminal vocative clusters to the real addressee', () => {
    expect(
      repairConversationAddresseeText(
        '你為什麼今天沒說話，海真晝？',
        '貓貓',
        'Tianze',
      ),
    ).toBe('你為什麼今天沒說話，天澤？');
  });

  test('repairs observed hallucinated leading addressee to the real conversation partner', () => {
    expect(
      repairConversationAddresseeText(
        '曉夢同學，你也沒有吃飯嗎？我們現在是教室裏，你今天可能沒有吃到午餐。',
        '祥子',
        'Tianze',
      ),
    ).toBe('天澤，你也沒有吃飯嗎？我們現在是教室裏，你今天可能沒有吃到午餐。');
  });

  test('keeps a correct terminal vocative', () => {
    expect(
      repairConversationAddresseeText(
        '你今天先不要再接新的清單，天澤？',
        '貓貓',
        'Tianze',
      ),
    ).toBe('你今天先不要再接新的清單，天澤？');
  });

  test('normalizes the observed Tianze typo only when Tianze is the conversation partner', () => {
    expect(
      repairConversationAddresseeText(
        '放心去寫吧，明天奈。',
        '貓貓',
        'Tianze',
      ),
    ).toBe('放心去寫吧，天澤。');
  });

  test('does not rewrite the Tianze typo when Tianze is not the conversation partner', () => {
    expect(
      repairConversationAddresseeText(
        '我剛才聽見有人叫明天奈。',
        '貓貓',
        'Mahiru',
      ),
    ).toBe('我剛才聽見有人叫明天奈。');
  });

  test('normalizes Mahiru near-name artifacts when Mahiru is the conversation partner', () => {
    expect(
      repairConversationAddresseeText(
        '阿真晝，你剛才是不是沒吃飯？',
        '祥子',
        'Mahiru',
      ),
    ).toBe('你剛才是不是沒吃飯？');
    expect(
      repairConversationAddresseeText(
        '你剛才是不是沒吃飯，阿真晝？',
        '祥子',
        'Mahiru',
      ),
    ).toBe('你剛才是不是沒吃飯，真晝？');
  });

  test('repairs Mahiru near-name artifact to the real non-Mahiru partner', () => {
    expect(
      repairConversationAddresseeText(
        '明晝，你為什麼那天沒有來？',
        '貓貓',
        'Tianze',
      ),
    ).toBe('天澤，你為什麼那天沒有來？');
    expect(
      repairConversationAddresseeText(
        '你為什麼那天沒有來，明晝？',
        '貓貓',
        'Tianze',
      ),
    ).toBe('你為什麼那天沒有來，天澤？');
  });
});

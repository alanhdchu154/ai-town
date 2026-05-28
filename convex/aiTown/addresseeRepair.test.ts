import { repairConversationAddresseeText } from './addresseeRepair';

describe('conversation addressee repair', () => {
  test('repairs an embedded thanks-frame misaddress to the real addressee', () => {
    expect(
      repairConversationAddresseeText(
        '謝謝真晝提點，我會先找那個一直坐在角落的人吃飯。',
        '劉備',
        '麻衣',
      ),
    ).toBe('謝謝麻衣提點，我會先找那個一直坐在角落的人吃飯。');
  });

  test('keeps the real conversation partner when already addressed correctly', () => {
    expect(
      repairConversationAddresseeText(
        '謝謝麻衣提醒，我先不把它講成規則。',
        '劉備',
        '麻衣',
      ),
    ).toBe('謝謝麻衣提醒，我先不把它講成規則。');
  });

  test('does not rewrite ordinary third-person references', () => {
    expect(
      repairConversationAddresseeText(
        '真晝昨天看起來很累。',
        '劉備',
        '麻衣',
      ),
    ).toBe('真晝昨天看起來很累。');
  });

  test('does not corrupt words containing the single-character alias 海', () => {
    expect(
      repairConversationAddresseeText(
        '謝謝海邊的風讓我冷靜。',
        '劉備',
        '麻衣',
      ),
    ).toBe('謝謝海邊的風讓我冷靜。');
  });

  test('repairs malformed terminal vocative clusters to the real addressee', () => {
    expect(
      repairConversationAddresseeText(
        '你為什麼今天沒說話，海真晝？',
        '曹操',
        'Asuna',
      ),
    ).toBe('你為什麼今天沒說話，明日奈？');
  });

  test('repairs observed hallucinated leading addressee to the real conversation partner', () => {
    expect(
      repairConversationAddresseeText(
        '曉夢同學，你也沒有吃飯嗎？我們現在是教室裏，你今天可能沒有吃到午餐。',
        '劉備',
        'Asuna',
      ),
    ).toBe('你也沒有吃飯嗎？我們現在是教室裏，你今天可能沒有吃到午餐。');
  });

  test('keeps a correct terminal vocative', () => {
    expect(
      repairConversationAddresseeText(
        '你今天先不要再接新的清單，明日奈？',
        '曹操',
        'Asuna',
      ),
    ).toBe('你今天先不要再接新的清單，明日奈？');
  });

  test('normalizes the observed Asuna typo only when Asuna is the conversation partner', () => {
    expect(
      repairConversationAddresseeText(
        '放心去寫吧，明天奈。',
        '曹操',
        'Asuna',
      ),
    ).toBe('放心去寫吧，明日奈。');
  });

  test('does not rewrite the Asuna typo when Asuna is not the conversation partner', () => {
    expect(
      repairConversationAddresseeText(
        '我剛才聽見有人叫明天奈。',
        '曹操',
        'Mahiru Shiina',
      ),
    ).toBe('我剛才聽見有人叫明天奈。');
  });
});

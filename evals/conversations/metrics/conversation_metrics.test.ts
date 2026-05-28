import { evaluateConversationCase } from './conversation_metrics';

function metricStatus(sampleOutput: string, metricName: string) {
  const result = evaluateConversationCase({
    name: 'metric-test',
    mode: 'world_agent_chat',
    speaker: 'Mahiru',
    target: 'Asuna',
    input: '',
    sampleOutput,
  });
  return result.metrics.find((metric) => metric.name === metricName);
}

describe('conversation quality metrics', () => {
  it('flags administrative language leaking into school-life dialogue', () => {
    const metric = metricStatus(
      [
        '真晝: 你便當還沒吃完。',
        '明日奈: 我先把緊急校務和校園情緒地圖的報告核對完，再看會議流程。',
      ].join('\n'),
      'administrativeLanguageScore',
    );
    expect(metric?.status).toBe('FAIL');
    expect(metric?.notes.join(' ')).toContain('緊急校務');
    expect(metric?.notes.join(' ')).toContain('校園情緒地圖');
  });

  it('flags task-manager phrasing that makes free-world dialogue feel nonliving', () => {
    const metric = metricStatus(
      [
        '明日奈: 我把便條放在桌角。',
        '劉備: 太好了，謝謝你的建議！我會開始掃描教室，確保所有人都有任務和支援。',
      ].join('\n'),
      'administrativeLanguageScore',
    );
    expect(metric?.status).toBe('FAIL');
    expect(metric?.notes.join(' ')).toContain('掃描教室');
    expect(metric?.notes.join(' ')).toContain('任務和支援');
    expect(
      metricStatus('明日奈: 名單已交接清楚，混亂暫時止住了。我累了，需要去整理明天的流程。', 'bannedPhraseCount')?.status,
    ).toBe('FAIL');
    expect(
      metricStatus('劉備: 我現在在寫作業。暫時不覺得累。看看窗邊是否有人需要幫助。', 'bannedPhraseCount')?.status,
    ).toBe('FAIL');
  });

  it('flags budget checklist and hidden-cost slogan drift', () => {
    const sample = [
      '明日奈: 我先把這筆預算的執行清單寫好，這份文件的核對工作你願意分擔一半嗎？',
      '麻衣: 那就按你說的办，我們商量下一步，別讓那些隱形成本趁虛而入。',
    ].join('\n');
    const admin = metricStatus(sample, 'administrativeLanguageScore');
    const banned = metricStatus(sample, 'bannedPhraseCount');

    expect(admin?.status).toBe('FAIL');
    expect(admin?.notes.join(' ')).toContain('執行清單');
    expect(admin?.notes.join(' ')).toContain('核對工作');
    expect(banned?.status).toBe('FAIL');
    expect(banned?.notes.join(' ')).toContain('隱形成本');
    expect(banned?.notes.join(' ')).toContain('商量下一步');
  });

  it('flags efficiency-collaboration template drift', () => {
    const sample = [
      '曹操: 這樣一起合作看看可行嗎？我們可以互相補充信息。',
      '麻衣: 我覺得目前還是我自己組織比較好，個人準備更有效率。',
    ].join('\n');
    const admin = metricStatus(sample, 'administrativeLanguageScore');
    const banned = metricStatus(sample, 'bannedPhraseCount');

    expect(admin?.status).toBe('FAIL');
    expect(admin?.notes.join(' ')).toContain('互相補充信息');
    expect(banned?.status).toBe('FAIL');
    expect(banned?.notes.join(' ')).toContain('自己組織比較好');
  });

  it('flags generic agreement closure drift', () => {
    const sample = '曹操: 你剛才說的正中窩心，那就這樣做吧。';
    const admin = metricStatus(sample, 'administrativeLanguageScore');
    const banned = metricStatus(sample, 'bannedPhraseCount');

    expect(admin?.status).toBe('FAIL');
    expect(admin?.notes.join(' ')).toContain('正中窩心');
    expect(banned?.status).toBe('FAIL');
    expect(banned?.notes.join(' ')).toContain('那就這樣做吧');
  });

  it('flags repeated everyday objects becoming a loop', () => {
    const metric = metricStatus(
      [
        '真晝: 那碗熱湯先放著。',
        '明日奈: 熱湯不用管。',
        '真晝: 熱湯已經冷了。',
        '明日奈: 你別再看那碗熱湯。',
      ].join('\n'),
      'everydayObjectLoopScore',
    );
    expect(metric?.status).toBe('WARN');
    expect(metric?.notes.join(' ')).toContain('熱湯');
  });

  it('flags observed hallucinated addressee names outside the participants', () => {
    const metric = metricStatus(
      [
        '劉備: 曉夢同學，你也沒有吃飯嗎？我們現在是教室裏，你今天可能沒有吃到午餐。',
        '明日奈: 你是不是叫錯人了？',
      ].join('\n'),
      'wrongAddresseeScore',
    );
    expect(metric?.status).toBe('FAIL');
    expect(metric?.notes.join(' ')).toContain('曉夢');
  });

  it('flags Mahiru-like wrong name artifacts when they address the wrong participant', () => {
    const metric = metricStatus(
      [
        '曹操: 明晝，你為什麼那天沒有來？',
        '明日奈: 你是不是把名字記錯了？我是明日奈。',
      ].join('\n'),
      'wrongAddresseeScore',
    );
    expect(metric?.status).toBe('FAIL');
    expect(metric?.notes.join(' ')).toContain('真晝');
  });

  it('rewards CaoCao quiet order-as-care vocabulary aligned with the live prompt', () => {
    const metric = metricStatus(
      [
        '曹操: 門口那張椅子先留著。',
        '曹操: 誰要回房休息，就不要再站在走廊裡硬撐。',
      ].join('\n'),
      'characterVoiceScore',
    );

    expect(metric?.status).toBe('PASS');
  });
});

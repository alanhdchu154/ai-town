import {
  closingBeatPromptLineForTest,
  directObjectBindingPromptLinesForTest,
  motifGuardPromptLinesForTest,
  residueTimeLabelZhForTest,
} from './conversation';

describe('conversation motif guard', () => {
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
});

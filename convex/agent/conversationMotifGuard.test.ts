import {
  closingBeatPromptLineForTest,
  directObjectBindingPromptLinesForTest,
  motifGuardPromptLinesForTest,
  residuePromptLinesForTest,
  residueTimeLabelZhForTest,
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

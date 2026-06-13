import {
  EXPERIENCE_LOG_PER_DAY_CAP,
  EXPERIENCE_LOG_PILOT_NAMES,
  draftConversationExperienceLog,
  isRepeatedResidueSpam,
  isSimilarExperienceLog,
  pilotExperienceLogName,
  worldDayFromTimestamp,
} from './experienceLog';

const REAL_SUMMARY =
  '海說自己今天又一個人扛了 Alan 的擔心，真晝回應願意陪她一起想下一步，兩人約好在交誼廳坐一下。';

describe('pilot cast gating', () => {
  test('canonicalizes runtime aliases onto the current live evidence pilot', () => {
    expect(pilotExperienceLogName('Umi')).toBe('海');
    expect(pilotExperienceLogName('朝凪海')).toBe('海');
    expect(pilotExperienceLogName('Mahiru Shiina')).toBe('真晝');
    expect(pilotExperienceLogName('椎名真晝')).toBe('真晝');
    expect(pilotExperienceLogName('Maomao')).toBe('貓貓');
    expect(pilotExperienceLogName('貓貓')).toBe('貓貓');
    expect(pilotExperienceLogName('Tianze')).toBe('天澤');
    expect(pilotExperienceLogName('天澤')).toBe('天澤');
    expect(pilotExperienceLogName('Ichinose')).toBe('一之瀨');
    expect(pilotExperienceLogName('一之瀨')).toBe('一之瀨');
    expect(pilotExperienceLogName('Sakiko')).toBe('祥子');
    expect(pilotExperienceLogName('祥子')).toBe('祥子');
  });

  test('rejects absent and raw legacy characters from the fresh evidence writer', () => {
    expect(pilotExperienceLogName('Asuna')).toBeNull();
    expect(pilotExperienceLogName('明日奈')).toBeNull();
    expect(pilotExperienceLogName('結城明日奈')).toBeNull();
    expect(pilotExperienceLogName('Mai')).toBeNull();
    expect(pilotExperienceLogName('麻衣')).toBeNull();
    expect(pilotExperienceLogName('LiuBei')).toBeNull();
    expect(pilotExperienceLogName('劉備')).toBeNull();
    expect(pilotExperienceLogName('CaoCao')).toBeNull();
    expect(pilotExperienceLogName('曹操')).toBeNull();
  });

  test('rejects non-pilot characters and unknown names', () => {
    expect(pilotExperienceLogName('Alan')).toBeNull();
    expect(pilotExperienceLogName('')).toBeNull();
    expect(pilotExperienceLogName(undefined)).toBeNull();
  });

  test('drafting a non-pilot pair returns not_pilot_pair', () => {
    const result = draftConversationExperienceLog({
      playerName: 'Umi',
      otherPlayerName: 'Alan',
      summary: REAL_SUMMARY,
      residue: '',
      messages: [
        { text: '海與 Alan 聊到校園秩序與一個人扛的問題。' },
        { text: '兩個人坐在窗邊。' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_pilot_pair');
  });

  test('drafting same character with itself is rejected', () => {
    const result = draftConversationExperienceLog({
      playerName: 'Umi',
      otherPlayerName: '海',
      summary: REAL_SUMMARY,
      residue: '',
      messages: [{ text: REAL_SUMMARY }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_pilot_pair');
  });

  test('pilot set stays the documented live six names', () => {
    expect([...EXPERIENCE_LOG_PILOT_NAMES].sort()).toEqual(
      ['一之瀨', '天澤', '海', '真晝', '貓貓', '祥子'].sort(),
    );
  });
});

describe('fallback / drift rejection', () => {
  test('summary or residue containing a system abort marker is rejected', () => {
    expect(
      draftConversationExperienceLog({
        playerName: 'Umi',
        otherPlayerName: 'Mahiru',
        summary: '[ABORT_CONVERSATION] pilot LLM unavailable',
        residue: '',
        messages: [{ text: '海' }],
      }).ok,
    ).toBe(false);
  });

  test('a transcript with a deterministic template phrase is rejected', () => {
    const result = draftConversationExperienceLog({
      playerName: 'Umi',
      otherPlayerName: 'Mahiru',
      summary: REAL_SUMMARY,
      residue: '',
      messages: [
        { text: '今晚先少接一件事，世界可以慢一點。' },
        { text: '真晝點點頭，沒有再追問。' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('fallback_or_drift');
  });

  test('a transcript with memory post-processing drift is rejected', () => {
    const result = draftConversationExperienceLog({
      playerName: 'Umi',
      otherPlayerName: 'Mahiru',
      summary: REAL_SUMMARY,
      residue: '',
      messages: [
        { text: '世界協調報告：今天 AI 社的影響上升。' },
        { text: '我會把這個納入策略衝擊評估。' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('fallback_or_drift');
  });

  test('a transcript with stage direction leakage is rejected', () => {
    const result = draftConversationExperienceLog({
      playerName: 'Umi',
      otherPlayerName: 'Mahiru',
      summary: REAL_SUMMARY,
      residue: '海記得真晝看見她硬撐。',
      messages: [
        { text: '我合上筆電，看著你手邊那疊文件。' },
        { text: '明天我們先少接一件事。' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('echo_or_stage_direction');
  });

  test('a transcript with obvious echo repetition is rejected', () => {
    const result = draftConversationExperienceLog({
      playerName: 'Umi',
      otherPlayerName: 'Mahiru',
      summary: REAL_SUMMARY,
      residue: '海記得真晝看見她硬撐。',
      messages: [
        { text: '我們今天先坐五分鐘，不要再推了。' },
        { text: '那我們今天先坐五分鐘，不要再推了。' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('echo_or_stage_direction');
  });

  test('a transcript with wrong addressee leakage is rejected', () => {
    const result = draftConversationExperienceLog({
      playerName: 'Ichinose',
      otherPlayerName: 'Maomao',
      summary: '一之瀨和貓貓談到今天誰把溫柔當成免費資源。',
      residue: '貓貓記得一之瀨把關心說得像拒絕。',
      messages: [
        { author: '一之瀨', text: '一之瀨姊，你剛才幫人改作業時——手停在半空三秒。' },
        { author: '貓貓', text: '這個症狀先記下來。' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_addressee');
  });

  test('a clean pilot conversation produces a compact, readable draft', () => {
    const result = draftConversationExperienceLog({
      playerName: '朝凪海',
      otherPlayerName: '椎名真晝',
      summary: REAL_SUMMARY,
      residue: '海還記得真晝沒有只要她繼續有用，而是把問題留在她自己身上。',
      messages: [
        { text: REAL_SUMMARY },
        { text: '兩個人在交誼廳的角落聊到很晚。' },
        { text: '真晝沒有催她，只是陪著。' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { draft } = result;
    expect(draft.characterName).toBe('海');
    expect(draft.otherCharacterName).toBe('真晝');
    expect(draft.involvedCharacters).toEqual(['海', '真晝']);
    // Compact upper bound — well below the 1000-char cap the schema would tolerate.
    expect(draft.eventSummary.length).toBeLessThanOrEqual(165);
    expect(draft.emotionalInterpretation.length).toBeLessThanOrEqual(80);
    expect(draft.residue.length).toBeLessThanOrEqual(96);
    expect(draft.beliefSeed.length).toBeLessThanOrEqual(80);
    expect(draft.behaviorHint.length).toBeLessThanOrEqual(80);
    // Residue + a belief seed should classify the entry as high importance.
    expect(draft.importance).toBe('high');
    expect(draft.eventSummary.startsWith('海與真晝')).toBe(true);
  });

  test('an empty summary cannot produce a draft', () => {
    const result = draftConversationExperienceLog({
      playerName: 'Umi',
      otherPlayerName: 'Mahiru',
      summary: '   ',
      residue: '',
      messages: [{ text: 'fine, fine' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('empty_summary');
  });
});

describe('per-character / day cap and dedupe', () => {
  test('cap constant is small enough to prevent DB explosion', () => {
    expect(EXPERIENCE_LOG_PER_DAY_CAP).toBe(2);
  });

  test('identical event summary prefix from the same pair counts as duplicate', () => {
    const existing = {
      characterName: '海',
      eventSummary: '海與真晝：兩人約好在交誼廳坐一下，今天的事一起想清楚。',
      source: { otherPlayerId: 'p:mahiru' },
    };
    const candidateDuplicate = {
      characterName: '海',
      eventSummary: '海與真晝：兩人約好在交誼廳坐一下，今天的事一起想完再休息。',
      source: { otherPlayerId: 'p:mahiru' },
    };
    const candidateDifferentPair = {
      characterName: '海',
      eventSummary: '海與真晝：兩人約好在交誼廳坐一下，今天的事一起想清楚。',
      source: { otherPlayerId: 'p:tianze' },
    };
    const candidateDifferentChar = {
      characterName: '真晝',
      eventSummary: '海與真晝：兩人約好在交誼廳坐一下，今天的事一起想清楚。',
      source: { otherPlayerId: 'p:mahiru' },
    };
    expect(isSimilarExperienceLog(existing, candidateDuplicate)).toBe(true);
    expect(isSimilarExperienceLog(existing, candidateDifferentPair)).toBe(false);
    expect(isSimilarExperienceLog(existing, candidateDifferentChar)).toBe(false);
  });

  test('two recent residues with the same opening prefix flag spam', () => {
    const recent = [
      '海還記得真晝沒有催她，只是陪著她坐在窗邊。',
      '海還記得真晝沒有催她，只是陪著她聽完。',
    ];
    expect(isRepeatedResidueSpam(recent, '海還記得真晝沒有催她，只是陪她多問了一句今天累不累。')).toBe(true);
  });

  test('a residue with a fresh prefix is not flagged', () => {
    const recent = [
      '海還記得真晝沒有催她，只是陪著她坐在窗邊。',
      '海還記得真晝沒有催她，只是聽她說完。',
    ];
    expect(isRepeatedResidueSpam(recent, '真晝記得海今天又把擔心留給自己。')).toBe(false);
  });

  test('empty or very short residues are never flagged as spam', () => {
    expect(isRepeatedResidueSpam([], '')).toBe(false);
    expect(isRepeatedResidueSpam(['短', '短'], '短語')).toBe(false);
  });
});

describe('worldDayFromTimestamp', () => {
  test('uses the canonical GIIS world start when no override is supplied', () => {
    const canonicalStart = Date.UTC(2026, 4, 19, 5, 0, 0);
    expect(worldDayFromTimestamp(canonicalStart)).toBe(1);
    expect(worldDayFromTimestamp(canonicalStart + 86_400_000)).toBe(2);
  });

  test('respects an override world start real date', () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    expect(worldDayFromTimestamp(start + 3 * 86_400_000, start)).toBe(4);
  });

  test('clamps to day 1 for timestamps before the world start', () => {
    const start = Date.UTC(2026, 4, 19, 5, 0, 0);
    expect(worldDayFromTimestamp(start - 1000, start)).toBe(1);
  });
});

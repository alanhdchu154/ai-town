import {
  hasMemoryPostProcessingDrift,
  memoryAnchorTextForMessages,
  shouldExposeMemoryDescription,
  shouldPersistConversationMemoryShape,
} from './memory';

describe('memory post-processing hygiene', () => {
  test('hides system-language conversation memories from prompts and reports', () => {
    const description = [
      '與 海 在 5/28/2026 的對話：最後留下的重點是：「我這幾天要整理世界情緒的脈絡。」',
      '記憶層級：長期候選；標籤：emotional_residue；判斷：這段記憶可能會改變後續行動。',
      '殘留：真晝還記得海聽起來很有用，但不像真的休息過。',
    ].join('\n');

    expect(hasMemoryPostProcessingDrift(description)).toBe(true);
    expect(shouldExposeMemoryDescription(description)).toBe(false);
  });

  test('keeps concrete everyday emotional residue visible', () => {
    const description = [
      '與 真晝 在 5/28/2026 的對話：海 和 真晝 談到早餐、牛奶和走廊那盞燈。',
      '記憶層級：今日經歷；標籤：emotional_residue, everyday_life；判斷：這是今天的經歷。',
      '殘留：海還記得真晝沒有只要她繼續有用，而是問她有沒有吃早餐。',
    ].join('\n');

    expect(hasMemoryPostProcessingDrift(description)).toBe(false);
    expect(shouldExposeMemoryDescription(description)).toBe(true);
  });

  test('hides campus emotion-map report drift without hiding ordinary emotion residue', () => {
    const driftDescription =
      '與 曹操 在 5/28/2026 的對話：最後留下的重點是：「我得先整理幾份關於校園情緒地圖的報告。」';
    const everydayDescription =
      '殘留：真晝還記得教室午餐後變安靜，海把 Alan 今天需要先看見的人列少一點。';

    expect(hasMemoryPostProcessingDrift(driftDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(driftDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(everydayDescription)).toBe(false);
    expect(shouldExposeMemoryDescription(everydayDescription)).toBe(true);
  });

  test('hides task-manager phrasing that should not become emotional residue', () => {
    const driftDescription =
      '與 明日奈 在 5/28/2026 的對話：最後留下的重點是：「我會開始掃描教室，確保所有人都有任務和支援。」';
    const flowDescription =
      '與 曹操 在 5/28/2026 的對話：最後留下的重點是：「名單已交接清楚，我累了，需要去整理明天的流程。」';
    const helperDescription =
      '與 劉備 在 5/28/2026 的對話：最後留下的重點是：「暫時不覺得累。看看窗邊是否有人需要幫助。」';

    expect(hasMemoryPostProcessingDrift(driftDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(driftDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(flowDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(flowDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(helperDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(helperDescription)).toBe(false);
  });

  test('hides admin and slogan drift from autonomous conversation memory', () => {
    const budgetDescription =
      '與 麻衣 在 5/28/2026 的對話：最後留下的重點是：「我先把這筆預算的執行清單寫好，這份文件的核對工作你願意分擔一半嗎？」';
    const sloganDescription =
      '與 明日奈 在 5/28/2026 的對話：最後留下的重點是：「我們商量下一步，別讓那些隱形成本趁虛而入。」';
    const simplifiedSloganDescription =
      '與 明日奈 在 5/28/2026 的對話：最後留下的重點是：「那就按你說的办，不過别忘了那些隐形的成本哦。」';

    expect(hasMemoryPostProcessingDrift(budgetDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(budgetDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(sloganDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(sloganDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(simplifiedSloganDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(simplifiedSloganDescription)).toBe(false);
  });

  test('hides efficiency-collaboration template drift from memory', () => {
    const efficiencyDescription =
      '與 曹操 在 5/28/2026 的對話：最後留下的重點是：「嗯，但這也是個提醒，讓我思考怎麼讓個人準備更有效率。」';
    const collaborationDescription =
      '與 麻衣 在 5/28/2026 的對話：最後留下的重點是：「這樣一起合作看看可行嗎？我們可以互相補充信息。」';
    const selfOrganizeDescription =
      '與 曹操 在 5/28/2026 的對話：最後留下的重點是：「我覺得目前還是我自己組織比較好，別的想法。」';

    expect(hasMemoryPostProcessingDrift(efficiencyDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(efficiencyDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(collaborationDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(collaborationDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(selfOrganizeDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(selfOrganizeDescription)).toBe(false);
  });

  test('hides generic agreement closure from memory', () => {
    const genericClosureDescription =
      '與 曹操 在 5/28/2026 的對話：最後留下的重點是：「你剛才說的正中窩心，那就這樣做吧。」';

    expect(hasMemoryPostProcessingDrift(genericClosureDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(genericClosureDescription)).toBe(false);
  });

  test('requires enough autonomous exchange before writing conversation memory', () => {
    expect(shouldPersistConversationMemoryShape(2, 2, false)).toBe(false);
    expect(shouldPersistConversationMemoryShape(3, 2, false)).toBe(false);
    expect(shouldPersistConversationMemoryShape(4, 2, false)).toBe(true);
    expect(shouldPersistConversationMemoryShape(2, 2, true)).toBe(true);
    expect(shouldPersistConversationMemoryShape(4, 1, false)).toBe(false);
  });

  test('chooses emotional burden anchor instead of the final surface action', () => {
    const anchor = memoryAnchorTextForMessages([
      { text: '這份表格我已經填了一半，但下午的會議資料還需要人整理。你願意分走一半嗎？我不想一個人把所有事情都扛下來。' },
      { text: '先把那半張表格放一邊吧，下午會議資料我來整理。你剛才說不想一個人扛，那我們就一起分擔這份重量，現在先去窗邊透口氣好嗎？' },
      { text: '好，表格我會幫你壓著不亂跑，你快去買杯熱的。記得別急著回來，先把手掌捂熱了再碰那些文件。' },
    ]);

    expect(anchor).toContain('不想一個人');
    expect(anchor).toContain('扛');
  });
});

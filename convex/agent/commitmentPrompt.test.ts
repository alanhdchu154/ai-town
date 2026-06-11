import { commitmentPromptLinesForTest } from './conversation';

describe('commitmentPromptLines', () => {
  test('renders open commitments as an actionable block', () => {
    const lines = commitmentPromptLinesForTest(
      [{ text: 'Umi答應明天為Alan準備咖哩飯', createdAt: Date.now() }],
      'Alan',
    );
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('未了的約定');
    expect(lines[0]).toContain('Alan');
    expect(lines[1]).toContain('Umi答應明天為Alan準備咖哩飯');
  });

  test('returns nothing when there are no commitments', () => {
    expect(commitmentPromptLinesForTest([], 'Alan')).toEqual([]);
    expect(commitmentPromptLinesForTest(undefined, 'Alan')).toEqual([]);
  });

  test('caps at two commitments', () => {
    const lines = commitmentPromptLinesForTest(
      [
        { text: 'a', createdAt: 3 },
        { text: 'b', createdAt: 2 },
        { text: 'c', createdAt: 1 },
      ],
      '海',
    );
    // 1 header + 2 items
    expect(lines.length).toBe(3);
  });

  test('marks a commitment whose promised date has passed as expired', () => {
    // Said Wednesday 2026-06-10 noon Chicago, due 6/11 週四.
    const saidAt = Date.UTC(2026, 5, 10, 17, 0, 0);
    const dueText = '一之瀨答應明天（6/11 週四）為Alan準備咖哩飯（說於6/10 週三）';
    const dayMs = 24 * 60 * 60 * 1000;

    // Read back on 6/11 (the due day itself): still honorable.
    const onTime = commitmentPromptLinesForTest(
      [{ text: dueText, createdAt: saidAt }],
      'Alan',
      saidAt + dayMs,
    );
    expect(onTime[1]).not.toContain('已過了說好的時間');

    // Read back on 6/13: the promised day has passed.
    const late = commitmentPromptLinesForTest(
      [{ text: dueText, createdAt: saidAt }],
      'Alan',
      saidAt + 3 * dayMs,
    );
    expect(late[1]).toContain('已過了說好的時間');
    expect(late[1]).toContain('不要假裝還來得及');
  });

  test('legacy undated 明天 commitments expire 48h later; other legacy shapes do not', () => {
    const staleTomorrow = commitmentPromptLinesForTest(
      [{ text: 'Umi答應明天為Alan準備咖哩飯', createdAt: Date.UTC(2026, 5, 4) }],
      'Alan',
      Date.UTC(2026, 5, 20),
    );
    expect(staleTomorrow[1]).toContain('已過了說好的時間');

    const legacyWeekend = commitmentPromptLinesForTest(
      [{ text: 'Umi答應週末為Alan準備咖哩飯', createdAt: Date.UTC(2026, 5, 4) }],
      'Alan',
      Date.UTC(2026, 5, 20),
    );
    expect(legacyWeekend[1]).not.toContain('已過了說好的時間');
  });
});

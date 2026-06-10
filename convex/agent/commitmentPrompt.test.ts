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
});

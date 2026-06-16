import { shouldDelayAlanLeaveForTypingForTest } from './school';

describe('Alan leave conversation typing guard', () => {
  test('delays leave when the character is still typing after Alan spoke last', () => {
    expect(
      shouldDelayAlanLeaveForTypingForTest({
        typingPlayerId: 'p:umi',
        alanId: 'p:alan',
        typingSince: 10_000,
        now: 20_000,
        lastHumanMessageAt: 12_000,
        lastNonHumanMessageAt: 0,
      }),
    ).toBe(true);
  });

  test('allows leave when typing is stale or the character already replied', () => {
    expect(
      shouldDelayAlanLeaveForTypingForTest({
        typingPlayerId: 'p:umi',
        alanId: 'p:alan',
        typingSince: 10_000,
        now: 200_000,
        lastHumanMessageAt: 12_000,
        lastNonHumanMessageAt: 0,
      }),
    ).toBe(false);

    expect(
      shouldDelayAlanLeaveForTypingForTest({
        typingPlayerId: 'p:umi',
        alanId: 'p:alan',
        typingSince: 10_000,
        now: 20_000,
        lastHumanMessageAt: 12_000,
        lastNonHumanMessageAt: 15_000,
      }),
    ).toBe(false);
  });
});

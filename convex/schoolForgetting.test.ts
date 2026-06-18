import {
  DAY_MS,
  DEFAULT_FORGETTING_THRESHOLDS,
  forgettingEnabled,
  forgettingTier,
} from './schoolForgetting';

const NOW = 1_800_000_000_000;
const daysAgo = (d: number) => NOW - d * DAY_MS;

describe('forgetting tier (sink, never delete)', () => {
  test('is disabled unless explicitly env-gated', () => {
    expect(forgettingEnabled({})).toBe(false);
    expect(forgettingEnabled({ UNDERWORLD_FORGETTING: 'false' })).toBe(false);
    expect(forgettingEnabled({ UNDERWORLD_FORGETTING: 'true' })).toBe(true);
  });

  test('sinks an old, low-importance, long-unaccessed conversation memory', () => {
    expect(
      forgettingTier(
        { creationTime: daysAgo(30), importance: 3, lastAccess: daysAgo(20), dataType: 'conversation' },
        NOW,
      ),
    ).toBe('dormant_candidate');
  });

  test('keeps a recent memory active even if low importance', () => {
    expect(
      forgettingTier(
        { creationTime: daysAgo(2), importance: 1, lastAccess: daysAgo(2), dataType: 'conversation' },
        NOW,
      ),
    ).toBe('active');
  });

  test('keeps an important memory active even if old and idle', () => {
    expect(
      forgettingTier(
        { creationTime: daysAgo(60), importance: 8, lastAccess: daysAgo(40), dataType: 'conversation' },
        NOW,
      ),
    ).toBe('active');
  });

  test('keeps an old low-importance memory active if it was recently recalled', () => {
    // age + importance qualify, but it was touched (lastAccess) 1 day ago.
    expect(
      forgettingTier(
        { creationTime: daysAgo(60), importance: 2, lastAccess: daysAgo(1), dataType: 'conversation' },
        NOW,
      ),
    ).toBe('active');
  });

  test('never sinks a reflection (synthesis holds other memories together)', () => {
    expect(
      forgettingTier(
        { creationTime: daysAgo(90), importance: 0, lastAccess: daysAgo(90), dataType: 'reflection' },
        NOW,
      ),
    ).toBe('active');
  });

  test('never re-sinks an already-dormant memory', () => {
    expect(
      forgettingTier(
        { creationTime: daysAgo(90), importance: 0, lastAccess: daysAgo(90), dataType: 'conversation', dormant: true },
        NOW,
      ),
    ).toBe('active');
  });

  test('respects custom thresholds', () => {
    const view = {
      creationTime: daysAgo(10),
      importance: 5,
      lastAccess: daysAgo(10),
      dataType: 'conversation' as const,
    };
    // Default (minAge 14, maxImp 4) keeps it active.
    expect(forgettingTier(view, NOW)).toBe('active');
    // A looser threshold sinks it.
    expect(
      forgettingTier(view, NOW, { minAgeDays: 7, maxImportance: 5, minIdleDays: 7 }),
    ).toBe('dormant_candidate');
  });

  test('boundary: exactly at thresholds qualifies', () => {
    expect(
      forgettingTier(
        {
          creationTime: daysAgo(DEFAULT_FORGETTING_THRESHOLDS.minAgeDays),
          importance: DEFAULT_FORGETTING_THRESHOLDS.maxImportance,
          lastAccess: daysAgo(DEFAULT_FORGETTING_THRESHOLDS.minIdleDays),
          dataType: 'conversation',
        },
        NOW,
      ),
    ).toBe('dormant_candidate');
  });
});

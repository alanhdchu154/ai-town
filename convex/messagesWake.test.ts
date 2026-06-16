import {
  shouldKickRunningEngineForHumanInput,
  shouldWakeWorldForConversationInputStatus,
} from './messages';

describe('message write wake policy', () => {
  test('does not wake when world status is unavailable', () => {
    expect(shouldWakeWorldForConversationInputStatus(undefined)).toBe(false);
  });

  test('respects developer stop for passive wake attempts', () => {
    expect(shouldWakeWorldForConversationInputStatus('stoppedByDeveloper')).toBe(false);
  });

  test('lets explicit human chat wake a developer-stopped world', () => {
    expect(shouldWakeWorldForConversationInputStatus('stoppedByDeveloper', true)).toBe(true);
  });

  test('wakes running or inactive worlds for conversation input', () => {
    expect(shouldWakeWorldForConversationInputStatus('running')).toBe(true);
    expect(shouldWakeWorldForConversationInputStatus('inactive')).toBe(true);
  });
});

describe('running-engine kick policy for human input', () => {
  const now = 1_000_000;

  test('does NOT kick a healthy, freshly-stepping engine (avoids aborting in-flight replies)', () => {
    expect(shouldKickRunningEngineForHumanInput(now - 1_000, now)).toBe(false);
    expect(shouldKickRunningEngineForHumanInput(now, now)).toBe(false);
  });

  test('kicks an engine that has stalled (stopped advancing currentTime)', () => {
    expect(shouldKickRunningEngineForHumanInput(now - 30_000, now)).toBe(true);
  });

  test('kicks when the engine has no currentTime yet', () => {
    expect(shouldKickRunningEngineForHumanInput(undefined, now)).toBe(true);
  });
});

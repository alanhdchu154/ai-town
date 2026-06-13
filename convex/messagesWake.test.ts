import { shouldWakeWorldForConversationInputStatus } from './messages';

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

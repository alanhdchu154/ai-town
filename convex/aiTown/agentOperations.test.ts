import { scheduleMovementEnabled } from './agentOperations';

describe('agent schedule movement', () => {
  test('is enabled by default so daytime scenes can gather characters', () => {
    expect(scheduleMovementEnabled({} as NodeJS.ProcessEnv)).toBe(true);
  });

  test('can be disabled explicitly for rollback', () => {
    expect(scheduleMovementEnabled({ ENABLE_SCHEDULE_MOVEMENT: 'false' } as NodeJS.ProcessEnv)).toBe(false);
  });

  test('keeps the previous explicit true setting working', () => {
    expect(scheduleMovementEnabled({ ENABLE_SCHEDULE_MOVEMENT: 'true' } as NodeJS.ProcessEnv)).toBe(true);
  });
});

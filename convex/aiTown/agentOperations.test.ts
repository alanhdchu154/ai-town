import {
  scheduleMovementEnabled,
  shouldRunAgentGenerationForTest,
  shouldRunAgentRememberForTest,
} from './agentOperations';
import { shouldQueueConversationMemoryOnStop } from './conversation';

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

describe('agent generation preflight', () => {
  test('runs only when the operation is current and the conversation still exists', () => {
    expect(
      shouldRunAgentGenerationForTest(
        { currentOperationId: 'o:1', conversationExists: true },
        'o:1',
      ),
    ).toEqual({ run: true, clear: false, reason: 'ok' });
  });

  test('skips stale scheduled generation actions without clearing the current operation', () => {
    expect(
      shouldRunAgentGenerationForTest(
        { currentOperationId: 'o:2', conversationExists: true },
        'o:1',
      ),
    ).toEqual({ run: false, clear: false, reason: 'stale_operation' });
  });

  test('clears the current operation when its conversation no longer exists', () => {
    expect(
      shouldRunAgentGenerationForTest(
        { currentOperationId: 'o:1', conversationExists: false },
        'o:1',
      ),
    ).toEqual({ run: false, clear: true, reason: 'missing_conversation' });
  });
});

describe('agent remember preflight', () => {
  test('runs only when the operation is current and the archived conversation exists', () => {
    expect(
      shouldRunAgentRememberForTest(
        { currentOperationId: 'o:1', archivedConversationExists: true },
        'o:1',
      ),
    ).toEqual({ run: true, clear: false, reason: 'ok' });
  });

  test('skips stale remember actions without clearing the current operation', () => {
    expect(
      shouldRunAgentRememberForTest(
        { currentOperationId: 'o:2', archivedConversationExists: true },
        'o:1',
      ),
    ).toEqual({ run: false, clear: false, reason: 'stale_operation' });
  });

  test('clears current remember operation when the archive was intentionally skipped', () => {
    expect(
      shouldRunAgentRememberForTest(
        { currentOperationId: 'o:1', archivedConversationExists: false },
        'o:1',
      ),
    ).toEqual({ run: false, clear: true, reason: 'missing_archived_conversation' });
  });

  test('clears current remember operation when archived human chat has an unanswered tail', () => {
    expect(
      shouldRunAgentRememberForTest(
        {
          currentOperationId: 'o:1',
          archivedConversationExists: true,
          archivedConversationHasUnansweredHumanTail: true,
        },
        'o:1',
      ),
    ).toEqual({ run: false, clear: true, reason: 'unanswered_human_tail' });
  });

  test('runs current remember operation when a human conversation ended with the character replying', () => {
    expect(
      shouldRunAgentRememberForTest(
        {
          currentOperationId: 'o:1',
          archivedConversationExists: true,
          archivedConversationHasUnansweredHumanTail: false,
        },
        'o:1',
      ),
    ).toEqual({ run: true, clear: false, reason: 'ok' });
  });
});

describe('conversation stop memory queue policy', () => {
  test('does not queue memory for conversations with no messages', () => {
    expect(
      shouldQueueConversationMemoryOnStop({ hasMessages: false, lastAuthorIsHuman: false }),
    ).toBe(false);
  });

  test('does not queue memory when a human sent the final message', () => {
    expect(
      shouldQueueConversationMemoryOnStop({ hasMessages: true, lastAuthorIsHuman: true }),
    ).toBe(false);
  });

  test('queues memory when the final message came from a character', () => {
    expect(
      shouldQueueConversationMemoryOnStop({ hasMessages: true, lastAuthorIsHuman: false }),
    ).toBe(true);
  });
});

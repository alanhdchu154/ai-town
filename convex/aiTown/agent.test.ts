import {
  shouldDeferConversationLeave,
  shouldThrottleHumanGenerationAfterAttempt,
  shouldThrottleHumanGenerationAfterFailure,
} from './agent';
import { GameId } from './ids';

describe('agent conversation leave guard', () => {
  test('holds autonomous conversations open until the minimum shape is reached', () => {
    const now = Date.now();

    expect(
      shouldDeferConversationLeave(
        {
          hasHumanParticipant: false,
          currentMessageCount: 2,
          conversationCreated: now - 60_000,
        },
        now,
      ),
    ).toBe(true);
  });

  test('allows leave once the next message reaches minimum shape', () => {
    const now = Date.now();

    expect(
      shouldDeferConversationLeave(
        {
          hasHumanParticipant: false,
          currentMessageCount: 3,
          conversationCreated: now - 60_000,
        },
        now,
      ),
    ).toBe(false);
  });

  test('holds human conversations for Alan to close explicitly, but not hard-timeout conversations', () => {
    const now = Date.now();

    expect(
      shouldDeferConversationLeave(
        {
          hasHumanParticipant: true,
          currentMessageCount: 1,
          conversationCreated: now - 60_000,
        },
        now,
      ),
    ).toBe(true);
    expect(
      shouldDeferConversationLeave(
        {
          hasHumanParticipant: true,
          humanIdleCloseDue: true,
          currentMessageCount: 4,
          conversationCreated: now - 60_000,
        },
        now,
      ),
    ).toBe(false);
    expect(
      shouldDeferConversationLeave(
        {
          hasHumanParticipant: false,
          currentMessageCount: 1,
          conversationCreated: now - 60 * 60_000,
        },
        now,
      ),
    ).toBe(false);
  });
});

describe('human-facing generation failure cooldown', () => {
  const tianze = 'p:10' as GameId<'players'>;
  const alan = 'p:11' as GameId<'players'>;

  test('throttles the same character after a recent human-facing generation abort', () => {
    const now = 1_000_000;

    expect(
      shouldThrottleHumanGenerationAfterFailure(
        { playerId: tianze, timestamp: now - 10_000 },
        tianze,
        now,
        90_000,
      ),
    ).toBe(true);
  });

  test('does not throttle other participants or expired failures', () => {
    const now = 1_000_000;

    expect(
      shouldThrottleHumanGenerationAfterFailure(
        { playerId: tianze, timestamp: now - 10_000 },
        alan,
        now,
        90_000,
      ),
    ).toBe(false);
    expect(
      shouldThrottleHumanGenerationAfterFailure(
        { playerId: tianze, timestamp: now - 120_000 },
        tianze,
        now,
        90_000,
      ),
    ).toBe(false);
  });
});

describe('human-facing generation attempt cooldown', () => {
  const ichinose = 'p:2' as GameId<'players'>;
  const alan = 'p:11' as GameId<'players'>;

  test('throttles the same character after a recent generation attempt', () => {
    const now = 1_000_000;

    expect(
      shouldThrottleHumanGenerationAfterAttempt(
        { playerId: ichinose, timestamp: now - 20_000 },
        ichinose,
        now,
        90_000,
      ),
    ).toBe(true);
  });

  test('does not throttle other participants or expired attempts', () => {
    const now = 1_000_000;

    expect(
      shouldThrottleHumanGenerationAfterAttempt(
        { playerId: ichinose, timestamp: now - 20_000 },
        alan,
        now,
        90_000,
      ),
    ).toBe(false);
    expect(
      shouldThrottleHumanGenerationAfterAttempt(
        { playerId: ichinose, timestamp: now - 120_000 },
        ichinose,
        now,
        90_000,
      ),
    ).toBe(false);
  });
});

import { shouldDeferConversationLeave } from './agent';

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

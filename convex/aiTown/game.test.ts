import { deletedConversationArchiveDecisionForTest } from './game';

describe('deleted conversation archival policy', () => {
  test('keeps single-sided Alan pressure tests as diagnostic archives', () => {
    expect(
      deletedConversationArchiveDecisionForTest({
        conversationNumMessages: 0,
        meaningfulMessageCount: 6,
        meaningfulAuthorCount: 1,
        humanInConversation: true,
        hasCloudCharacter: true,
        failedCharacterSoulPilot: false,
        hasGeneratedFallbackText: false,
        persistenceRejection: false,
      }),
    ).toEqual({
      archive: true,
      deleteMessages: false,
      writeParticipatedTogether: false,
      reason: 'human_single_sided_diagnostic',
    });
  });

  test('still deletes weak single-sided autonomous fragments', () => {
    expect(
      deletedConversationArchiveDecisionForTest({
        conversationNumMessages: 1,
        meaningfulMessageCount: 1,
        meaningfulAuthorCount: 1,
        humanInConversation: false,
        hasCloudCharacter: true,
        failedCharacterSoulPilot: false,
        hasGeneratedFallbackText: false,
        persistenceRejection: false,
      }),
    ).toEqual({
      archive: false,
      deleteMessages: true,
      writeParticipatedTogether: false,
      reason: 'weak_single_sided_autonomous_conversation',
    });
  });

  test('writes relationship edges only for real two-sided conversations', () => {
    expect(
      deletedConversationArchiveDecisionForTest({
        conversationNumMessages: 4,
        meaningfulMessageCount: 4,
        meaningfulAuthorCount: 2,
        humanInConversation: true,
        hasCloudCharacter: true,
        failedCharacterSoulPilot: false,
        hasGeneratedFallbackText: false,
        persistenceRejection: false,
      }),
    ).toMatchObject({
      archive: true,
      deleteMessages: false,
      writeParticipatedTogether: true,
    });
  });
});

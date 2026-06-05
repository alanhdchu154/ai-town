import { archiveDeletedConversation, deletedConversationArchiveDecisionForTest } from './game';

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

  test('drops two-message cloud autonomous pilot conversations as v0.1 evidence', () => {
    expect(
      deletedConversationArchiveDecisionForTest({
        conversationNumMessages: 2,
        meaningfulMessageCount: 2,
        meaningfulAuthorCount: 2,
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
      reason: 'weak_cloud_autonomous_pilot_conversation',
    });
  });

  test('accepts three-message cloud autonomous pilot conversations as v0.1 evidence', () => {
    expect(
      deletedConversationArchiveDecisionForTest({
        conversationNumMessages: 3,
        meaningfulMessageCount: 3,
        meaningfulAuthorCount: 2,
        humanInConversation: false,
        hasCloudCharacter: true,
        failedCharacterSoulPilot: false,
        hasGeneratedFallbackText: false,
        persistenceRejection: false,
      }),
    ).toMatchObject({
      archive: true,
      writeParticipatedTogether: true,
    });
  });

  test('keeps Alan two-message conversations as diagnostic archives even when short', () => {
    expect(
      deletedConversationArchiveDecisionForTest({
        conversationNumMessages: 2,
        meaningfulMessageCount: 2,
        meaningfulAuthorCount: 2,
        humanInConversation: true,
        hasCloudCharacter: true,
        failedCharacterSoulPilot: false,
        hasGeneratedFallbackText: false,
        persistenceRejection: false,
      }),
    ).toMatchObject({
      archive: true,
      writeParticipatedTogether: true,
    });
  });
});

// Minimal in-memory MutationCtx stand-in covering only what
// archiveDeletedConversation touches: query('messages').withIndex(...).collect(),
// insert('archivedConversations' | 'participatedTogether', ...), delete(id).
function makeArchivalCtx(messages: any[]) {
  const archived: any[] = [];
  const participated: any[] = [];
  const deleted: any[] = [];
  let remaining = [...messages];
  const ctx: any = {
    db: {
      query: (table: string) => ({
        withIndex: () => ({
          collect: async () => (table === 'messages' ? remaining : []),
        }),
      }),
      insert: async (table: string, doc: any) => {
        if (table === 'archivedConversations') archived.push(doc);
        if (table === 'participatedTogether') participated.push(doc);
        return `${table}-${Math.random()}`;
      },
      delete: async (id: any) => {
        deleted.push(id);
        remaining = remaining.filter((message) => message._id !== id);
      },
    },
  };
  return { ctx, archived, participated, deleted };
}

const ALAN = 'p:alan';
const UMI = 'p:umi';

function conversationFixture(overrides: any = {}) {
  return {
    id: 'c:1',
    created: 1000,
    creator: ALAN,
    numMessages: 0,
    participants: [{ playerId: ALAN }, { playerId: UMI }],
    ...overrides,
  } as any;
}

describe('archiveDeletedConversation (durable transcript on direct leave)', () => {
  const playerNames = new Map<string, string>([
    [ALAN, 'Alan'],
    [UMI, 'Umi'],
  ]);
  const humanPlayers = new Map<string, boolean>([
    [ALAN, true],
    [UMI, false],
  ]);

  test('archives a single-sided Alan chat instead of orphaning it', async () => {
    const { ctx, archived, deleted } = makeArchivalCtx([
      { _id: 'm1', author: ALAN, text: '海，今天我有點累。', _creationTime: 1500 },
    ]);
    const result = await archiveDeletedConversation(
      ctx,
      'world1' as any,
      conversationFixture({ numMessages: 1 }),
      playerNames,
      humanPlayers,
    );
    expect(result).toEqual({ archived: true, reason: 'human_single_sided_diagnostic' });
    expect(archived).toHaveLength(1);
    expect(archived[0]).toMatchObject({ id: 'c:1', worldId: 'world1', numMessages: 1 });
    expect(deleted).toHaveLength(0);
  });

  test('archives a two-sided Alan/Umi chat and records the relationship edge', async () => {
    const { ctx, archived, participated, deleted } = makeArchivalCtx([
      { _id: 'm1', author: ALAN, text: '海，今天我有點累。', _creationTime: 1500 },
      { _id: 'm2', author: UMI, text: '那今晚先把待辦縮成三行吧。', _creationTime: 1600 },
    ]);
    const result = await archiveDeletedConversation(
      ctx,
      'world1' as any,
      conversationFixture({ numMessages: 2 }),
      playerNames,
      humanPlayers,
    );
    expect(result).toEqual({ archived: true, reason: 'archive_conversation' });
    expect(archived).toHaveLength(1);
    expect(participated).toHaveLength(2); // both directions of the pair
    expect(deleted).toHaveLength(0);
  });

  test('does not archive an empty conversation', async () => {
    const { ctx, archived } = makeArchivalCtx([]);
    const result = await archiveDeletedConversation(
      ctx,
      'world1' as any,
      conversationFixture({ numMessages: 0 }),
      playerNames,
      humanPlayers,
    );
    expect(result).toEqual({ archived: false, reason: 'empty_conversation' });
    expect(archived).toHaveLength(0);
  });
});

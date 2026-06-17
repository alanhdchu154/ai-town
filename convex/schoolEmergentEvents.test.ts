import {
  consequenceKindForConversationOutcome,
  conversationOutcomeCauseMetadata,
  emergentConsequencePlanForEvent,
  v02EmergentEventsEnabled,
} from './schoolEmergentEvents';

describe('v0.2 emergent event cause metadata', () => {
  test('is disabled unless explicitly env-gated', () => {
    expect(v02EmergentEventsEnabled({})).toBe(false);
    expect(conversationOutcomeCauseMetadata('concrete_action', {})).toBeUndefined();
  });

  test('marks clean conversation outcomes as cause candidates when gated on', () => {
    const env = { UNDERWORLD_V02_EMERGENT_EVENTS: 'true' };
    expect(conversationOutcomeCauseMetadata('concrete_action', env)).toEqual({
      emergentCauseKind: 'conversation_outcome',
      consequenceStatus: 'candidate',
      consequenceKind: 'queued_intention',
      chainDepth: 0,
    });
    expect(conversationOutcomeCauseMetadata('relationship_shift', env)?.consequenceKind).toBe(
      'relationship_shift_candidate',
    );
    expect(conversationOutcomeCauseMetadata('emotional_residue', env)?.consequenceKind).toBe(
      'memory_residue_candidate',
    );
  });

  test('does not promote repeated noise into an event cause', () => {
    expect(consequenceKindForConversationOutcome('repeated_noise')).toBeUndefined();
    expect(
      conversationOutcomeCauseMetadata('repeated_noise', { UNDERWORLD_V02_EMERGENT_EVENTS: 'true' }),
    ).toBeUndefined();
  });

  test('plans E2 queued intention consequences from conversation outcomes', () => {
    expect(
      emergentConsequencePlanForEvent({
        type: 'conversationOutcome',
        descriptionZh: '海決定明天只留三件事。',
        actorName: 'Umi',
        targetName: 'Alan',
        consequenceKind: 'queued_intention',
        chainDepth: 0,
      }),
    ).toMatchObject({
      action: 'queue_intention_and_move',
      intentionZh: expect.stringContaining('小行動'),
      followUpType: 'emergentFollowUpQueuedIntention',
      chainDepth: 1,
    });
  });

  test('plans E3 relationship shifts and E4 one-hop follow-up rows', () => {
    expect(
      emergentConsequencePlanForEvent({
        type: 'conversationOutcome',
        descriptionZh: '一之瀨和天澤的邊界變清楚了。',
        actorName: 'Ichinose',
        targetName: 'Tianze',
        consequenceKind: 'relationship_shift_candidate',
      }),
    ).toMatchObject({
      action: 'shift_relationship',
      relationshipDelta: { trust: 1, respect: 1, emotionalCloseness: 1 },
      followUpType: 'emergentFollowUpRelationshipShift',
    });
    expect(
      emergentConsequencePlanForEvent({
        type: 'conversationOutcome',
        descriptionZh: '真晝注意到海沒有休息。',
        actorName: 'Mahiru',
        targetName: 'Umi',
        consequenceKind: 'memory_residue_candidate',
      }),
    ).toMatchObject({
      action: 'write_follow_up_event',
      followUpType: 'emergentFollowUpResidue',
      chainDepth: 1,
    });
  });

  test('does not chain beyond one follow-up hop for the first increment', () => {
    expect(
      emergentConsequencePlanForEvent({
        type: 'conversationOutcome',
        descriptionZh: 'too deep',
        consequenceKind: 'queued_intention',
        chainDepth: 1,
      }),
    ).toBeUndefined();
  });
});

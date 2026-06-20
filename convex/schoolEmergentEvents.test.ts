import {
  consequenceKindForConversationOutcome,
  conversationOutcomeCauseMetadata,
  emergentConsequencePlanForEvent,
  v02EmergentEventsEnabled,
} from './schoolEmergentEvents';
import {
  characterDevelopmentPlanForTest,
  decayedEmotionForTest,
  elapsedWorldMinutesSinceForTest,
  isDuplicateDevelopmentLogEntryForTest,
  shouldApplyEmotionWriteForTest,
} from './school';

const testClock = (day: number, hour: number, minute = 0) => ({
  day,
  hour,
  minute,
  week: 1,
  semester: 1,
  timeSpeed: 60,
  lastUpdated: 0,
});

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

  test('emotion decay relaxes temporary states without inventing a new mood scale', () => {
    expect(decayedEmotionForTest('worried')).toBe('calm');
    expect(decayedEmotionForTest('serious')).toBe('calm');
    expect(decayedEmotionForTest('guarded')).toBe('calm');
    expect(decayedEmotionForTest('smiling')).toBe('neutral');
    expect(decayedEmotionForTest('calm')).toBeUndefined();
    expect(decayedEmotionForTest('neutral')).toBeUndefined();
  });

  test('emotion decay timing uses in-world clock deltas, including day rollover', () => {
    expect(elapsedWorldMinutesSinceForTest(testClock(1, 22, 30), testClock(2, 3, 0))).toBe(270);
    expect(elapsedWorldMinutesSinceForTest(testClock(4, 9, 0), testClock(4, 8, 0))).toBe(0);
  });

  test('emotion arbitration protects fresh high-priority changes from pressure and early decay', () => {
    const recentConversation = {
      causeKind: 'conversation' as const,
      clock: testClock(31, 10, 0),
    };
    expect(shouldApplyEmotionWriteForTest('pressure', testClock(31, 10, 10), recentConversation)).toBe(false);
    expect(shouldApplyEmotionWriteForTest('decay', testClock(31, 10, 10), recentConversation)).toBe(false);
    expect(shouldApplyEmotionWriteForTest('event', testClock(31, 10, 10), recentConversation)).toBe(true);
  });

  test('emotion decay does not flatten seeded baseline emotions before any live change exists', () => {
    const clock = testClock(31, 10, 0);
    expect(shouldApplyEmotionWriteForTest('decay', clock, null)).toBe(false);
    expect(shouldApplyEmotionWriteForTest('conversation', clock, null)).toBe(true);
    expect(shouldApplyEmotionWriteForTest('event', clock, null)).toBe(true);
    expect(shouldApplyEmotionWriteForTest('pressure', clock, null)).toBe(true);
  });

  test('emotion arbitration lets lower-priority signals or decay win after enough in-world time', () => {
    const oldConversation = {
      causeKind: 'conversation' as const,
      clock: testClock(31, 10, 0),
    };
    expect(shouldApplyEmotionWriteForTest('pressure', testClock(31, 12, 0), oldConversation)).toBe(true);
    expect(shouldApplyEmotionWriteForTest('decay', testClock(31, 13, 59), oldConversation)).toBe(false);
    expect(shouldApplyEmotionWriteForTest('decay', testClock(31, 14, 0), oldConversation)).toBe(true);
  });

  test('an event-set mood persists for the 90-min event hold, then a conversation can adjust it', () => {
    // Events now outrank conversations so the nuanced mood they inject (生日→flustered,
    // 破音→guarded) actually colours the next exchanges instead of being instantly flipped.
    const recentEvent = { causeKind: 'event' as const, clock: testClock(31, 10, 0) };
    expect(shouldApplyEmotionWriteForTest('conversation', testClock(31, 10, 30), recentEvent)).toBe(false);
    expect(shouldApplyEmotionWriteForTest('conversation', testClock(31, 11, 29), recentEvent)).toBe(false);
    // After the 90-min hold a conversation may adjust the mood again.
    expect(shouldApplyEmotionWriteForTest('conversation', testClock(31, 11, 30), recentEvent)).toBe(true);
    // Another event always overrides immediately (events interchange freely).
    expect(shouldApplyEmotionWriteForTest('event', testClock(31, 10, 5), recentEvent)).toBe(true);
  });

  test('character development plans turn emotion into bounded behavior color', () => {
    expect(characterDevelopmentPlanForTest('Umi', 'tired', '海縮短了早晨簡報', 'event')).toMatchObject({
      behaviorLeanZh: expect.stringContaining('簡報變短'),
      relationshipTendencyZh: expect.stringContaining('被看見'),
    });
    expect(characterDevelopmentPlanForTest('Tianze', 'guarded', '玩笑碰到邊界', 'conversation')).toMatchObject({
      behaviorLeanZh: expect.stringContaining('玩笑更短'),
      relationshipTendencyZh: expect.stringContaining('挑釁'),
    });
  });

  test('Tier 3: behaviorLean now varies by emotion for non-Umi characters (not a constant)', () => {
    // The audit found Mahiru/Tianze/etc. returned a FIXED plan regardless of
    // emotion. Now the emotion lean is appended, so a tired Mahiru leans
    // differently from a guarded Mahiru, while keeping the character signature.
    const tired = characterDevelopmentPlanForTest('Mahiru', 'tired', '又有人說沒事', 'event');
    const guarded = characterDevelopmentPlanForTest('Mahiru', 'guarded', '又有人說沒事', 'event');
    expect(tired.behaviorLeanZh).not.toEqual(guarded.behaviorLeanZh);
    expect(tired.behaviorLeanZh).toContain('一對一靠近'); // signature preserved
    expect(tired.behaviorLeanZh).toContain('少扛一件事'); // tired lean
    expect(guarded.behaviorLeanZh).toContain('距離'); // guarded lean
    // neutral adds no lean (no noise).
    const neutral = characterDevelopmentPlanForTest('Mahiru', 'neutral', '又有人說沒事', 'event');
    expect(neutral.behaviorLeanZh).not.toContain('；最近');
  });

  test('Tier 3: development log dedupe does not hide a newer event just because influence text repeats', () => {
    const existing = [
      {
        sourceEventId: 'event:old',
        summaryZh: '真晝因為「昨天有人說沒事」更注意誰把話吞回去了。',
      },
    ];
    expect(
      isDuplicateDevelopmentLogEntryForTest(existing, {
        summaryZh: '真晝因為「今天有人把話吞回去」更注意誰把話吞回去了。',
      }),
    ).toBe(false);
    expect(
      isDuplicateDevelopmentLogEntryForTest(
        existing,
        { summaryZh: '真晝因為「今天有人把話吞回去」更注意誰把話吞回去了。' },
        'event:old',
      ),
    ).toBe(true);
  });

  test('development plans stay character-specific for newer live roster members', () => {
    expect(characterDevelopmentPlanForTest('Maomao', 'serious', '有人說身體沒事但手很冷', 'event')).toMatchObject({
      behaviorLeanZh: expect.stringContaining('症狀'),
      recurringConcernZh: expect.stringContaining('身體'),
    });
    expect(characterDevelopmentPlanForTest('Sakiko', 'guarded', '練習室裡聲音破了一次', 'event')).toMatchObject({
      behaviorLeanZh: expect.stringContaining('端正'),
      relationshipTendencyZh: expect.stringContaining('禮貌'),
    });
  });
});

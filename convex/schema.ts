import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { agentTables } from './agent/schema';
import { aiTownTables } from './aiTown/schema';
import { conversationId, playerId } from './aiTown/ids';
import { engineTables } from './engine/schema';

const worldClock = v.object({
  hour: v.number(),
  minute: v.optional(v.number()),
  day: v.number(),
  week: v.number(),
  semester: v.number(),
  timeSpeed: v.number(),
  lastUpdated: v.number(),
});

const schoolRelationshipDimensions = v.object({
  trust: v.number(),
  respect: v.number(),
  affection: v.number(),
  fear: v.number(),
  influence: v.number(),
  comfort: v.optional(v.number()),
  admiration: v.optional(v.number()),
  concern: v.optional(v.number()),
  emotionalCloseness: v.optional(v.number()),
  curiosity: v.optional(v.number()),
  dependency: v.optional(v.number()),
  jealousy: v.optional(v.number()),
  emotionalTension: v.optional(v.number()),
});

export default defineSchema({
  music: defineTable({
    storageId: v.string(),
    type: v.union(v.literal('background'), v.literal('player')),
  }),

  messages: defineTable({
    conversationId,
    messageUuid: v.string(),
    author: playerId,
    text: v.string(),
    worldId: v.optional(v.id('worlds')),
  })
    .index('conversationId', ['worldId', 'conversationId'])
    .index('messageUuid', ['conversationId', 'messageUuid']),

  schoolProfiles: defineTable({
    worldId: v.id('worlds'),
    playerId,
    persona: v.string(),
    role: v.string(),
    coreValues: v.array(v.string()),
    communicationStyle: v.optional(v.string()),
    goals: v.array(v.string()),
    shortTermIntentions: v.optional(v.array(v.string())),
    shortTermMemory: v.array(v.string()),
    longTermMemory: v.array(v.string()),
    beliefs: v.array(v.string()),
    currentEmotion: v.optional(
      v.union(v.literal('neutral'), v.literal('smiling'), v.literal('worried'), v.literal('serious')),
    ),
    initialRelationships: v.optional(
      v.array(
        v.object({
          targetName: v.string(),
          dimensions: schoolRelationshipDimensions,
          cautious: v.optional(v.boolean()),
          concern: v.optional(v.string()),
          narrative: v.string(),
        }),
      ),
    ),
  })
    .index('worldId', ['worldId'])
    .index('player', ['worldId', 'playerId']),

  schoolRelationships: defineTable({
    worldId: v.id('worlds'),
    subjectPlayerId: playerId,
    objectPlayerId: playerId,
    dimensions: schoolRelationshipDimensions,
    narrative: v.string(),
    updatedAt: v.number(),
  })
    .index('subject', ['worldId', 'subjectPlayerId'])
    .index('edge', ['worldId', 'subjectPlayerId', 'objectPlayerId']),

  schoolWorldPressure: defineTable({
    worldId: v.id('worlds'),
    aiClubInfluence: v.number(),
    studentAnxiety: v.number(),
    socialDivision: v.number(),
    trustInLeadership: v.number(),
    rumorIntensity: v.number(),
    schoolStability: v.number(),
    mood: v.union(
      v.literal('calm'),
      v.literal('anxious'),
      v.literal('divided'),
      v.literal('hopeful'),
      v.literal('politically_tense'),
      v.literal('emotionally_exhausted'),
    ),
    lastEventId: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('worldId', ['worldId']),

  alanPresence: defineTable({
    worldId: v.id('worlds'),
    lastSeenAt: v.number(),
    lastSeenClock: worldClock,
    lastBriefingAt: v.optional(v.number()),
    lastBriefingShownAt: v.optional(v.number()),
  }).index('worldId', ['worldId']),

  alanBehaviorProfiles: defineTable({
    worldId: v.id('worlds'),
    traits: v.array(
      v.object({
        trait: v.string(),
        labelZh: v.string(),
        score: v.number(),
        evidenceZh: v.optional(v.string()),
      }),
    ),
    strongestTrait: v.optional(v.string()),
    strongestTraitZh: v.optional(v.string()),
    trustedCharacters: v.optional(
      v.array(
        v.object({
          name: v.string(),
          displayNameZh: v.string(),
          score: v.number(),
        }),
      ),
    ),
    timeSpentWith: v.optional(
      v.array(
        v.object({
          name: v.string(),
          displayNameZh: v.string(),
          count: v.number(),
        }),
      ),
    ),
    repeatedChoices: v.optional(
      v.array(
        v.object({
          actionType: v.string(),
          labelZh: v.string(),
          count: v.number(),
        }),
      ),
    ),
    supportsZh: v.optional(v.array(v.string())),
    ignoresZh: v.optional(v.array(v.string())),
    freeDevelopmentMode: v.optional(v.boolean()),
    reflectionZh: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('worldId', ['worldId']),

  worldEvents: defineTable({
    worldId: v.id('worlds'),
    eventId: v.string(),
    type: v.string(),
    actorPlayerId: v.optional(playerId),
    targetPlayerId: v.optional(playerId),
    actorName: v.optional(v.string()),
    targetName: v.optional(v.string()),
    source: v.optional(
      v.union(
        v.literal('player_action'),
        v.literal('autonomous_agent_action'),
        v.literal('world_simulation_event'),
        v.literal('agent_action'),
        v.literal('system_event'),
        v.literal('time_advance'),
      ),
    ),
    happenedDuringAlanPresence: v.optional(
      v.union(v.literal('online'), v.literal('away'), v.literal('unknown')),
    ),
    observerPlayerIds: v.array(playerId),
    descriptionZh: v.string(),
    descriptionEn: v.string(),
    locationId: v.optional(v.string()),
    locationZh: v.optional(v.string()),
    interpretationZh: v.optional(v.string()),
    reactionDialogueZh: v.optional(v.string()),
    futureImplicationsZh: v.optional(v.string()),
    outcomeQuality: v.optional(
      v.union(
        v.literal('meaningful_new_information'),
        v.literal('relationship_shift'),
        v.literal('concrete_action'),
        v.literal('emotional_residue'),
        v.literal('repeated_noise'),
      ),
    ),
    importance: v.number(),
    createdAt: v.number(),
    createdAtUnix: v.optional(v.number()),
    createdAtIso: v.optional(v.string()),
    createdAtTimeZone: v.optional(v.string()),
    worldTimeLabelZh: v.optional(v.string()),
    clock: worldClock,
  })
    .index('worldId', ['worldId', 'createdAt'])
    .index('type', ['worldId', 'type', 'createdAt']),

  schoolNotifications: defineTable({
    worldId: v.id('worlds'),
    notificationId: v.string(),
    type: v.union(
      v.literal('relationship_change'),
      v.literal('rumor_created'),
      v.literal('intention_created'),
      v.literal('major_event'),
      v.literal('quest_available'),
      v.literal('emotion_changed'),
      v.literal('world_pressure_changed'),
    ),
    titleZh: v.string(),
    contentZh: v.string(),
    relatedCharacterName: v.optional(v.string()),
    relatedEventId: v.optional(v.string()),
    locationId: v.optional(v.string()),
    locationZh: v.optional(v.string()),
    createdAt: v.number(),
    createdAtUnix: v.number(),
    createdAtIso: v.string(),
    createdAtTimeZone: v.string(),
    worldTimeLabelZh: v.string(),
  }).index('worldId', ['worldId', 'createdAt']),

  schoolRumors: defineTable({
    worldId: v.id('worlds'),
    rumorId: v.string(),
    contentZh: v.string(),
    sourceEventId: v.string(),
    spreadLevel: v.number(),
    affectedCharacters: v.array(v.string()),
    locationId: v.optional(v.string()),
    locationZh: v.optional(v.string()),
    createdAt: v.number(),
    createdAtUnix: v.number(),
    createdAtIso: v.string(),
    createdAtTimeZone: v.string(),
    worldTimeLabelZh: v.string(),
  })
    .index('worldId', ['worldId', 'createdAt'])
    .index('sourceEvent', ['worldId', 'sourceEventId']),

  schoolClubs: defineTable({
    worldId: v.id('worlds'),
    clubId: v.string(),
    nameZh: v.string(),
    founderName: v.string(),
    members: v.array(v.string()),
    statusZh: v.string(),
    influence: v.number(),
    activity: v.number(),
    currentTensionZh: v.optional(v.string()),
    relatedEventIds: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('worldId', ['worldId', 'updatedAt'])
    .index('name', ['worldId', 'nameZh']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});

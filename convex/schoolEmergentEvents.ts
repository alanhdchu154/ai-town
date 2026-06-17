export type ConversationOutcomeQuality =
  | 'meaningful_new_information'
  | 'relationship_shift'
  | 'concrete_action'
  | 'emotional_residue'
  | 'repeated_noise';

export type EmergentEventConsequenceKind =
  | 'queued_intention'
  | 'relationship_shift_candidate'
  | 'memory_residue_candidate';

export type EmergentEventCauseMetadata = {
  emergentCauseKind: 'conversation_outcome';
  consequenceStatus: 'candidate' | 'queued' | 'applied' | 'skipped';
  consequenceKind: EmergentEventConsequenceKind;
  chainDepth: number;
};

export type EmergentEventCandidatePlan = {
  consequenceKind: EmergentEventConsequenceKind;
  action: 'queue_intention_and_move' | 'shift_relationship' | 'write_follow_up_event';
  intentionZh?: string;
  relationshipDelta?: {
    trust?: number;
    respect?: number;
    concern?: number;
    emotionalCloseness?: number;
    emotionalTension?: number;
  };
  followUpType?: string;
  followUpDescriptionZh?: string;
  chainDepth: number;
};

export function v02EmergentEventsEnabled(env: Pick<NodeJS.ProcessEnv, string> = process.env) {
  return env.UNDERWORLD_V02_EMERGENT_EVENTS === 'true';
}

export function consequenceKindForConversationOutcome(
  quality: ConversationOutcomeQuality,
): EmergentEventConsequenceKind | undefined {
  switch (quality) {
    case 'concrete_action':
    case 'meaningful_new_information':
      return 'queued_intention';
    case 'relationship_shift':
      return 'relationship_shift_candidate';
    case 'emotional_residue':
      return 'memory_residue_candidate';
    case 'repeated_noise':
      return undefined;
  }
}

export function conversationOutcomeCauseMetadata(
  quality: ConversationOutcomeQuality,
  env: Pick<NodeJS.ProcessEnv, string> = process.env,
): EmergentEventCauseMetadata | undefined {
  if (!v02EmergentEventsEnabled(env)) return undefined;
  const consequenceKind = consequenceKindForConversationOutcome(quality);
  if (!consequenceKind) return undefined;
  return {
    emergentCauseKind: 'conversation_outcome',
    consequenceStatus: 'candidate',
    consequenceKind,
    chainDepth: 0,
  };
}

export function emergentConsequencePlanForEvent(event: {
  type: string;
  descriptionZh: string;
  actorName?: string;
  targetName?: string;
  consequenceKind?: EmergentEventConsequenceKind;
  chainDepth?: number;
}): EmergentEventCandidatePlan | undefined {
  if (event.type !== 'conversationOutcome') return undefined;
  if (!event.consequenceKind) return undefined;
  const actor = event.actorName ?? '角色';
  const target = event.targetName ?? '對方';
  const nextDepth = (event.chainDepth ?? 0) + 1;
  if (nextDepth > 1) return undefined;

  switch (event.consequenceKind) {
    case 'queued_intention':
      return {
        consequenceKind: event.consequenceKind,
        action: 'queue_intention_and_move',
        intentionZh: `${actor}要把和${target}的對話變成一個小行動：${event.descriptionZh}`,
        followUpType: 'emergentFollowUpQueuedIntention',
        followUpDescriptionZh: `${actor}把剛才與${target}的對話收成一個待執行的小行動。`,
        chainDepth: nextDepth,
      };
    case 'relationship_shift_candidate':
      return {
        consequenceKind: event.consequenceKind,
        action: 'shift_relationship',
        relationshipDelta: { trust: 1, respect: 1, emotionalCloseness: 1 },
        followUpType: 'emergentFollowUpRelationshipShift',
        followUpDescriptionZh: `${actor}和${target}之間留下了一點新的關係重量，不只是一句話。`,
        chainDepth: nextDepth,
      };
    case 'memory_residue_candidate':
      return {
        consequenceKind: event.consequenceKind,
        action: 'write_follow_up_event',
        followUpType: 'emergentFollowUpResidue',
        followUpDescriptionZh: `${actor}沒有立刻行動，但這段和${target}的對話留下了一個之後可能被想起的餘波。`,
        chainDepth: nextDepth,
      };
  }
}

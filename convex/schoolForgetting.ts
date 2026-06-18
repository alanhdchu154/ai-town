// Forgetting mechanism — pure logic (no Convex ctx), so it is unit-testable and
// the Convex functions in school.ts stay thin. See
// docs/soul/FORGETTING_MECHANISM_SPEC.md and docs/soul/MEMORY_DYNAMICS_AND_FORGETTING.md.
//
// Forgetting = SINK, never delete. A "dormant_candidate" memory is one whose
// embedding may be moved out of the active vector index (so vectorSearch can no
// longer surface it = unreachable by association) WHILE its `memories` row and
// `description` text are kept untouched and the embedding is ARCHIVED (recoverable).
// This both implements the #42 forgetting design AND shrinks the search/vector
// index that crashes the local backend's cleanup thread (WORKLOG #47).

export type ForgettingThresholds = {
  // A memory must be at least this old (since creation) to be eligible.
  minAgeDays: number;
  // ...AND its importance must be at or below this floor (importance is 0–9).
  maxImportance: number;
  // ...AND it must not have been recalled (lastAccess) within this many days.
  minIdleDays: number;
};

// Conservative defaults: only OLD + LOW-importance + LONG-unaccessed memories
// sink. Tunable from the F0 audit's real distribution.
export const DEFAULT_FORGETTING_THRESHOLDS: ForgettingThresholds = {
  minAgeDays: 14,
  maxImportance: 4,
  minIdleDays: 7,
};

export const DAY_MS = 86_400_000;

export type ForgettingTier = 'active' | 'dormant_candidate';

export type ForgettingMemoryView = {
  creationTime: number; // _creationTime
  importance: number;
  lastAccess: number;
  dataType: 'relationship' | 'conversation' | 'reflection' | string;
  dormant?: boolean;
};

// Env gate: actual archiving (F2 write path) is blocked unless this is set.
export function forgettingEnabled(env: Pick<NodeJS.ProcessEnv, string> = process.env) {
  return env.UNDERWORLD_FORGETTING === 'true';
}

// The single source of truth for "may this memory sink?". Pure + deterministic.
export function forgettingTier(
  m: ForgettingMemoryView,
  nowMs: number,
  t: ForgettingThresholds = DEFAULT_FORGETTING_THRESHOLDS,
): ForgettingTier {
  // Already sunk — not a fresh candidate.
  if (m.dormant) return 'active';
  // Never sink reflections: they are syntheses that hold other memories together.
  if (m.dataType === 'reflection') return 'active';
  const ageDays = (nowMs - m.creationTime) / DAY_MS;
  const idleDays = (nowMs - m.lastAccess) / DAY_MS;
  if (ageDays >= t.minAgeDays && m.importance <= t.maxImportance && idleDays >= t.minIdleDays) {
    return 'dormant_candidate';
  }
  return 'active';
}

export function ageDaysOf(creationTime: number, nowMs: number) {
  return (nowMs - creationTime) / DAY_MS;
}

export function idleDaysOf(lastAccess: number, nowMs: number) {
  return (nowMs - lastAccess) / DAY_MS;
}

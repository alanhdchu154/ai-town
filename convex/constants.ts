export const ACTION_TIMEOUT = 120_000; // more time for local dev
// export const ACTION_TIMEOUT = 60_000;// normally fine

export const IDLE_WORLD_TIMEOUT = 5 * 60 * 1000;
export const WORLD_HEARTBEAT_INTERVAL = 60 * 1000;

export const MAX_STEP = 10 * 60 * 1000;
export const TICK = 16;
export const STEP_INTERVAL = 1000;

export const PATHFINDING_TIMEOUT = 60 * 1000;
export const PATHFINDING_BACKOFF = 1000;
// Slightly wider than one tile so visually adjacent characters reliably enter
// conversation even with floating point movement and scene anchor offsets.
export const CONVERSATION_DISTANCE = 1.6;
export const MIDPOINT_THRESHOLD = 4;
export const TYPING_TIMEOUT = 15 * 1000;
export const COLLISION_THRESHOLD = 0.75;

// How many human players can be in a world at once.
export const MAX_HUMAN_PLAYERS = 8;

// Keep agents from machine-gunning conversations, but allow enough daytime
// samples for v0.1 conversation QA.
export const CONVERSATION_COOLDOWN = 60_000;

// Don't do another activity immediately after doing one.
export const ACTIVITY_COOLDOWN = 30_000;

// Don't talk to the same player again too soon.
export const PLAYER_CONVERSATION_COOLDOWN = 2 * 60_000;

// Most daytime invites should land during the v0.1 tuning phase; night rhythm
// is still controlled by schedule-aware conversation gates.
export const INVITE_ACCEPT_PROBABILITY = 0.75;

// Wait for 1m for invites to be accepted.
export const INVITE_TIMEOUT = 60000;

// Wait for another player to say something before jumping in.
export const AWKWARD_CONVERSATION_TIMEOUT = 60_000; // more time locally
// export const AWKWARD_CONVERSATION_TIMEOUT = 20_000;

// Leave a conversation after participating too long.
export const MAX_CONVERSATION_DURATION = 4 * 60_000;

// Leave a conversation before it turns into an endless seminar, while still
// allowing short 3-6 turn scenes for evaluation.
export const MAX_CONVERSATION_MESSAGES = 6;

// Wait for 1s after sending an input to the engine. We can remove this
// once we can await on an input being processed.
export const INPUT_DELAY = 1000;

// How many memories to get from the agent's memory.
// This is over-fetched by 10x so we can prioritize memories by more than relevance.
export const NUM_MEMORIES_TO_SEARCH = 3;

// Wait for at least two seconds before sending another message.
export const MESSAGE_COOLDOWN = 2000;

// Don't run a turn of the agent more than once a second.
export const AGENT_WAKEUP_THRESHOLD = 1000;

// How old we let memories be before we vacuum them
export const VACUUM_MAX_AGE = 2 * 7 * 24 * 60 * 60 * 1000;
export const DELETE_BATCH_SIZE = 64;

export const HUMAN_IDLE_TOO_LONG = 5 * 60 * 1000;

export const ACTIVITIES = [
  { description: 'preparing class notes', emoji: '📖', duration: 60_000 },
  { description: 'watching hallway politics', emoji: '🤔', duration: 60_000 },
  { description: 'checking student council rumors', emoji: '🥕', duration: 60_000 },
];

export const ENGINE_ACTION_DURATION = 30000;

// Bound the number of pathfinding searches we do per game step.
export const MAX_PATHFINDS_PER_STEP = 16;

export const DEFAULT_NAME = 'Alan';

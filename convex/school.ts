import { v } from 'convex/values';
import {
  ActionCtx,
  DatabaseReader,
  MutationCtx,
  QueryCtx,
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { playerId } from './aiTown/ids';
import { insertInput } from './aiTown/insertInput';
import { kickEngine, startEngine } from './aiTown/main';
import { chatCompletion } from './util/llm';
import { isGeneratedFallbackText } from './modelPolicy';
import { AlanProfile, GiisProfiles, RelationshipDimensions } from '../data/giisProfiles';
import { ClassroomCenter, ClassroomWalkBounds, clampToClassroom } from '../data/classroomBounds';
import {
  SchoolLocations,
  nearestSchoolLocation,
  sceneSpawnPoint,
  schoolLocationForHour,
} from '../data/schoolLocations';
import { DEFAULT_NAME } from './constants';

const DEFAULT_CLOCK = {
  hour: 9,
  minute: 0,
  day: 1,
  week: 1,
  semester: 1,
  timeSpeed: Number(process.env.TIME_SPEED) || 60,
};
// GIIS Underworld v0.1 canonical start: 2026-05-19 00:00 in Alan's
// America/Chicago timezone. Day labels are intentionally project-relative:
// 5/19/2026 = 第 1 天, 5/20/2026 = 第 2 天.
const GIIS_WORLD_START_REAL_DATE = Date.UTC(2026, 4, 19, 5, 0, 0);

function giisWorldStartRealDate(_storedStart?: number) {
  return GIIS_WORLD_START_REAL_DATE;
}

const SCHOOL_DAY_HOURS = [9, 12, 15, 18];
const SCHOOL_LLM_TIMEOUT_MS = Number(process.env.SCHOOL_LLM_TIMEOUT_MS) || 20_000;

function logGiisTiming(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  console.log('[GIIS timing]', payload);
}

const playerActionType = v.union(
  v.literal('chat'),
  v.literal('checkIn'),
  v.literal('leaveMessage'),
  v.literal('askRumor'),
  v.literal('gift'),
  v.literal('announce'),
  v.literal('invite'),
  v.literal('createClub'),
);

type Clock = NonNullable<Doc<'worldStatus'>['worldClock']>;
type PlayerDoc = Doc<'worlds'>['players'][number];
type NarrativeSummary = {
  yourAction: string;
  characterReactions: string;
  worldChanges: string;
  futureImplications: string;
  storyDigest?: StoryDigestItem[];
};
type StoryDigestItem = {
  happenedZh: string;
  changedZh: string;
  whyItMattersZh: string;
  suggestedActionZh: string;
};

type AlanPresence = {
  status: 'online' | 'away';
  playerId?: string;
  name: string;
  role: string;
};
type WorldEventSource =
  | 'player_action'
  | 'autonomous_agent_action'
  | 'system_event'
  | 'world_simulation_event'
  // Legacy values are kept readable for existing records.
  | 'agent_action'
  | 'time_advance';
type AlanPresenceStatus = 'online' | 'away' | 'unknown';
type PortraitEmotion = 'neutral' | 'smiling' | 'worried' | 'serious';
type SchoolMood =
  | 'calm'
  | 'anxious'
  | 'divided'
  | 'hopeful'
  | 'politically_tense'
  | 'emotionally_exhausted';
type WorldPressure = {
  aiClubInfluence: number;
  studentAnxiety: number;
  socialDivision: number;
  trustInLeadership: number;
  rumorIntensity: number;
  schoolStability: number;
  mood: SchoolMood;
};
type WorldPressureDelta = Partial<Omit<WorldPressure, 'mood'>>;
type SleepState = 'awake' | 'winding_down' | 'sleeping' | 'secretly_awake';
type AvailabilityState = 'available' | 'busy' | 'resting' | 'sleeping' | 'avoiding' | 'in_conversation';
type QuietState = 'idle' | 'resting' | 'observing' | 'thinking' | 'unavailable' | 'silent';
const GIIS_MAIN_CHARACTER_NAMES = [
  DEFAULT_NAME,
  'Umi',
  'Asuna',
  'Mai',
  'Mahiru Shiina',
  'CaoCao',
  'Liu Bei',
];

function isAutonomousEventSource(source?: WorldEventSource) {
  return source === 'autonomous_agent_action' || source === 'agent_action';
}

function isWorldSimulationSource(source?: WorldEventSource) {
  return source === 'world_simulation_event' || source === 'time_advance';
}

function localTimeParts(now = Date.now(), timeZone = 'America/Chicago') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(now));
  return {
    hour: Number(parts.find((part) => part.type === 'hour')?.value ?? 9) % 24,
    minute: Number(parts.find((part) => part.type === 'minute')?.value ?? 0),
  };
}

function worldDayFromStart(now: number, worldStartRealDate?: number) {
  const start = worldStartRealDate ?? GIIS_WORLD_START_REAL_DATE;
  return Math.max(1, Math.floor((now - start) / 86_400_000) + 1);
}

function clockAt(now: number, timeZone = 'America/Chicago', worldStartRealDate?: number): Clock {
  const { hour, minute } = localTimeParts(now, timeZone);
  return {
    ...DEFAULT_CLOCK,
    day: worldDayFromStart(now, worldStartRealDate),
    week: 1,
    semester: 1,
    hour,
    minute,
    lastUpdated: now,
  };
}

function advanceClock(clock: Clock, elapsedRealMs: number): Clock {
  const schoolHours = Math.max(0, (elapsedRealMs / 3_600_000) * clock.timeSpeed);
  return addWorldHours(clock, Math.floor(schoolHours));
}

function addWorldHours(clock: Clock, hoursToAdd: number): Clock {
  let hour = clock.hour + Math.max(0, Math.floor(hoursToAdd));
  const minute = clock.minute ?? 0;
  let day = clock.day;
  let week = clock.week;
  let semester = clock.semester;
  while (hour >= 24) {
    hour -= 24;
    day += 1;
  }
  while (day > 5) {
    day -= 5;
    week += 1;
  }
  while (week > 18) {
    week -= 18;
    semester += 1;
  }
  return { ...clock, hour, minute, day, week, semester, lastUpdated: Date.now() };
}

function normalizedClock(
  clock: Clock | undefined,
  timeZone = 'America/Chicago',
  worldStartRealDate?: number,
): Clock {
  return clockAt(Date.now(), timeZone, worldStartRealDate);
}

function currentClockForStatus(worldStatus?: Doc<'worldStatus'> | null, timeZone?: string): Clock {
  const now = Date.now();
  const resolvedTimeZone = timeZone ?? worldStatus?.worldStartTimeZone ?? 'America/Chicago';
  const worldStartRealDate = giisWorldStartRealDate(worldStatus?.worldStartRealDate);
  return clockAt(now, resolvedTimeZone, worldStartRealDate);
}

function clockTimeValue(clock: Clock | number) {
  if (typeof clock === 'number') return { hour: clock, minute: 0 };
  return { hour: clock.hour, minute: clock.minute ?? 0 };
}

function scheduleLabel(clock: Clock | number) {
  return schoolLocationForClock(clock).scheduleZh;
}

function schoolLocationForClock(clock: Clock | number) {
  const { hour, minute } = clockTimeValue(clock);
  return schoolLocationForHour(hour, minute);
}

function rhythmName(hour: number) {
  if (hour >= 6 && hour < 9) return '早晨';
  if (hour >= 9 && hour < 13) return '白天';
  if (hour >= 13 && hour < 17) return '下午';
  if (hour >= 17 && hour < 23) return '晚上';
  return '深夜';
}

function isSleepHour(clock: Clock | number) {
  const { hour } = clockTimeValue(clock);
  return hour >= 23 || hour < 6;
}

function isWindingDownHour(clock: Clock | number) {
  const { hour } = clockTimeValue(clock);
  return hour >= 21 && hour < 23;
}

function sleepStateForName(name: string, clock: Clock): SleepState {
  if (name === DEFAULT_NAME) return 'awake';
  if (isSleepHour(clock)) {
    if (name === 'Umi') return 'secretly_awake';
    if (name === 'CaoCao' && clock.hour < 1) return 'secretly_awake';
    return 'sleeping';
  }
  if (isWindingDownHour(clock)) {
    if (name === 'Umi' || name === 'CaoCao') return 'secretly_awake';
    return 'winding_down';
  }
  return 'awake';
}

function sleepStateLabelZh(state: SleepState) {
  if (state === 'sleeping') return '睡眠中';
  if (state === 'winding_down') return '準備休息';
  if (state === 'secretly_awake') return '深夜未眠';
  return '清醒';
}

function nightActivityForName(name: string, clock: Clock) {
  const state = sleepStateForName(name, clock);
  if (state === 'secretly_awake') {
    if (name === 'Umi') {
      return {
        description: '深夜未眠，正在整理校長簡報',
        emoji: '🌙',
        until: Date.now() + 20 * 60_000,
      };
    }
    if (name === 'CaoCao') {
      return {
        description: '深夜未眠，仍在思考明天誰需要被安排到安靜的位置',
        emoji: '🕯️',
        until: Date.now() + 12 * 60_000,
      };
    }
  }
  if (state === 'winding_down') {
    return {
      description: '準備休息',
      emoji: '🌙',
      until: Date.now() + 15 * 60_000,
    };
  }
  if (state === 'sleeping') {
    return {
      description: '睡眠中',
      emoji: '💤',
      until: Date.now() + 30 * 60_000,
    };
  }
  return undefined;
}

function availabilityForCharacter(
  name: string,
  clock: Clock,
  pressure: WorldPressure,
  inConversation = false,
): AvailabilityState {
  if (name === DEFAULT_NAME) return 'available';
  if (inConversation) return 'in_conversation';
  const sleepState = sleepStateForName(name, clock);
  if (sleepState === 'sleeping') return 'sleeping';
  if (sleepState === 'winding_down') return 'resting';
  if (sleepState === 'secretly_awake') return 'busy';
  if (pressure.mood === 'emotionally_exhausted') {
    if (name === 'Mahiru Shiina' || name === 'Mai') return 'resting';
    if (name === 'Asuna') return 'busy';
  }
  if (pressure.mood === 'divided') {
    if (name === 'Mai') return 'avoiding';
    if (name === 'CaoCao') return 'busy';
  }
  if (pressure.mood === 'politically_tense' && name === 'CaoCao') return 'busy';
  return 'available';
}

function availabilityLabelZh(state: AvailabilityState) {
  if (state === 'busy') return '暫時被事情留住';
  if (state === 'resting') return '正在休息';
  if (state === 'sleeping') return '睡眠中';
  if (state === 'avoiding') return '暫時停在別處';
  if (state === 'in_conversation') return '正和別人說話';
  return '可以靠近';
}

function quietStateForCharacter(
  name: string,
  availability: AvailabilityState,
  pressure: WorldPressure,
  locationId?: string,
): QuietState {
  if (availability === 'sleeping' || availability === 'resting') return 'resting';
  if (availability === 'busy') return name === 'CaoCao' || locationId === 'studentCouncilRoom' ? 'observing' : 'thinking';
  if (availability === 'avoiding') return 'silent';
  if (availability === 'in_conversation') return 'idle';
  if (pressure.mood === 'emotionally_exhausted') return 'resting';
  if (name === 'Mai') return 'thinking';
  if (name === 'CaoCao') return 'observing';
  if (name === 'Umi') return 'thinking';
  return 'idle';
}

function quietLineForCharacter(name: string, quietState: QuietState, locationId?: string) {
  const place = SchoolLocations.find((location) => location.id === locationId)?.labelZh;
  if (quietState === 'resting') {
    if (name === 'Mahiru Shiina') return '真晝似乎有點累，但還是留意著誰沒有說話。';
    if (name === 'Umi') return '海暫時放慢節奏，像是在等 Alan 也喘一口氣。';
    return `${displayNameZh(name)}把東西先放在一旁，沒有急著接下一件事。`;
  }
  if (quietState === 'silent') {
    if (name === 'Mai') return '麻衣安靜地看著窗外，像是在等問題自己露出形狀。';
    return `${displayNameZh(name)}停在${place ?? '原地'}，暫時沒有接話。`;
  }
  if (quietState === 'observing') {
    if (name === 'CaoCao') return '曹操沒有說話，只看著誰站在門口還沒進來。';
    if (name === 'Liu Bei') return '劉備站在人群邊緣，確認沒有人被落下。';
    return `${displayNameZh(name)}看著${place ?? '周圍'}的人流，還沒有走近。`;
  }
  if (quietState === 'thinking') {
    if (name === 'Umi') return '海正在整理給 Alan 的簡報。';
    if (name === 'Asuna') return '明日奈正在把混亂整理成下一步。';
    if (name === 'Mai') return '麻衣沒有急著開口，像是在檢查哪裡還沒被說清楚。';
    return `${displayNameZh(name)}把手邊的事放慢了一點。`;
  }
  return `${displayNameZh(name)}留在${place ?? '校園'}，沒有急著換地方。`;
}

function eventId(type: string) {
  return `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildNarrativeSummary(
  yourAction: string,
  characterReactions: string,
  worldChanges: string,
  futureImplications: string,
  storyDigest?: StoryDigestItem[],
): NarrativeSummary {
  return { yourAction, characterReactions, worldChanges, futureImplications, storyDigest };
}

function normalizeClubName(name: string) {
  return name.replace(/[「」"']/g, '').replace(/\s+/g, ' ').trim();
}

function clubIdFromName(name: string) {
  return `club_${normalizeClubName(name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '_')}`;
}

async function upsertSchoolClub(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  args: {
    nameZh: string;
    founderName: string;
    eventId: string;
  },
) {
  const nameZh = normalizeClubName(args.nameZh);
  const existing = await ctx.db
    .query('schoolClubs')
    .withIndex('name', (q) => q.eq('worldId', worldId).eq('nameZh', nameZh))
    .first();
  const now = Date.now();
  const baseMembers = nameZh.includes('AI') || nameZh.includes('人工智慧')
    ? [args.founderName, 'Umi']
    : [args.founderName];
  if (existing) {
    await ctx.db.patch(existing._id, {
      members: [...new Set([...existing.members, ...baseMembers])],
      statusZh: existing.statusZh === '新成立' ? '持續活動中' : existing.statusZh,
      influence: Math.min(100, existing.influence + 6),
      activity: Math.min(100, existing.activity + 12),
      currentTensionZh: nameZh.includes('AI')
        ? '規則尚不明確，學生正在觀察它會變成實驗、社交，還是權力中心。'
        : existing.currentTensionZh ?? '新社團正在尋找自己的定位。',
      relatedEventIds: [...new Set([args.eventId, ...existing.relatedEventIds])].slice(0, 12),
      updatedAt: now,
    });
    return existing._id;
  }
  return ctx.db.insert('schoolClubs', {
    worldId,
    clubId: clubIdFromName(nameZh),
    nameZh,
    founderName: args.founderName,
    members: baseMembers,
    statusZh: '新成立',
    influence: nameZh.includes('AI') ? 45 : 22,
    activity: 35,
    currentTensionZh: nameZh.includes('AI')
      ? '規則尚不明確，學生正在觀察它會變成實驗、社交，還是權力中心。'
      : '新社團剛成立，大家還不確定它會吸引誰。',
    relatedEventIds: [args.eventId],
    createdAt: now,
    updatedAt: now,
  });
}

function clubNameFromCreateClubEvent(descriptionZh: string) {
  const quoted = descriptionZh.match(/新社團：?「([^」]+)」/) ?? descriptionZh.match(/社團：「([^」]+)」/);
  return normalizeClubName(quoted?.[1] ?? '');
}

async function repairClubsFromCreateClubEvents(ctx: MutationCtx, worldId: Id<'worlds'>) {
  const events = await ctx.db
    .query('worldEvents')
    .withIndex('type', (q) => q.eq('worldId', worldId).eq('type', 'createClub'))
    .order('desc')
    .take(20);
  let repaired = 0;
  for (const event of events) {
    const clubName = clubNameFromCreateClubEvent(event.descriptionZh);
    if (!clubName) continue;
    await upsertSchoolClub(ctx, worldId, {
      nameZh: clubName,
      founderName: event.actorName ?? DEFAULT_NAME,
      eventId: event.eventId,
    });
    repaired += 1;
  }
  return repaired;
}

function formatClock(clock: Clock) {
  return worldTimeLabelZh(clock);
}

function worldTimeLabelZh(clock: Clock) {
  return `第 ${clock.day} 天 ${rhythmName(clock.hour)} ${formatHourMinuteZh(clock.hour, clock.minute ?? 0)}`;
}

function formatHourMinuteZh(hour: number, minute: number) {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')}`;
}

function timestampMeta(clock: Clock, timeZone = 'America/Chicago') {
  const now = Date.now();
  return {
    createdAtUnix: now,
    createdAtIso: new Date(now).toISOString(),
    createdAtTimeZone: timeZone,
    worldTimeLabelZh: worldTimeLabelZh(clock),
  };
}

function displayTimeLabel(createdAt: number, timeZone = 'America/Chicago') {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    dayPeriod: 'long',
  }).format(new Date(createdAt));
}

function displayFullTimeLabel(createdAt: number, timeZone = 'America/Chicago') {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    dayPeriod: 'long',
  }).format(new Date(createdAt));
}

function timestampLabelFor(createdAt: number, worldLabel?: string, timeZone = 'America/Chicago') {
  return worldLabel ? `${displayTimeLabel(createdAt, timeZone)}｜${worldLabel}` : displayTimeLabel(createdAt, timeZone);
}

export const worldClock = query({
  args: { timeZone: v.optional(v.string()), tick: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const timeZone = args.timeZone || 'America/Chicago';
    const now = Date.now();
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    const worldStartRealDate = giisWorldStartRealDate(worldStatus?.worldStartRealDate);
    const clock = currentClockForStatus(worldStatus, timeZone);
    const worldLabel = worldTimeLabelZh(clock);
    const realLabel = displayTimeLabel(now, timeZone);
    return {
      clock,
      schedule: scheduleLabel(clock),
      location: schoolLocationForClock(clock),
      periodLabelZh: rhythmName(clock.hour),
      realTimeLabelZh: realLabel,
      worldTimeLabelZh: worldLabel,
      dayClockLabelZh: worldLabel,
      combinedLabelZh: `${realLabel}｜${worldLabel}`,
      hoverLabelZh: `本地時間（${timeZone}）：${displayFullTimeLabel(now, timeZone)}\n世界時間：${worldLabel}\n世界開始：${displayFullTimeLabel(worldStartRealDate, timeZone)}`,
      isFastForwarded: false,
      timeZone,
      worldStartRealDate,
    };
  },
});

async function defaultWorld(ctx: { db: DatabaseReader }) {
  const worldStatus = await ctx.db
    .query('worldStatus')
    .filter((q) => q.eq(q.field('isDefault'), true))
    .first();
  if (!worldStatus) throw new Error('Default world not found. Run npm run dev first.');
  const world = await ctx.db.get(worldStatus.worldId);
  if (!world) throw new Error(`World ${worldStatus.worldId} not found`);
  return { worldStatus, world };
}

async function descriptionsByPlayer(db: DatabaseReader, worldId: Id<'worlds'>) {
  const descriptions = await db
    .query('playerDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();
  return new Map(descriptions.map((d) => [d.playerId, d]));
}

function findPlayerByName(
  players: PlayerDoc[],
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  name: string,
) {
  return players.find((p) => descriptions.get(p.id)?.name.toLowerCase() === name.toLowerCase());
}

function resolveAlanPlayer(
  world: Doc<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
) {
  return chooseAlanPlayer(world.players, descriptions);
}

function alanPresence(
  world: Doc<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
): AlanPresence {
  const alan = resolveAlanPlayer(world, descriptions);
  return {
    status: alan ? 'online' : 'away',
    playerId: alan?.id,
    name: DEFAULT_NAME,
    role: AlanProfile.role,
  };
}

function requireAlanPlayer(
  world: Doc<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
) {
  const alan = resolveAlanPlayer(world, descriptions);
  if (!alan) {
    throw new Error('Alan 尚未進入校園。請先按「加入」，讓 Alan 作為玩家角色進入世界。');
  }
  return alan;
}

function distance(a: PlayerDoc, b: PlayerDoc) {
  return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
}

async function ensureClock(ctx: MutationCtx, worldStatus: Doc<'worldStatus'>) {
  const now = Date.now();
  const timeZone = worldStatus.worldStartTimeZone ?? 'America/Chicago';
  const worldStartRealDate = giisWorldStartRealDate(worldStatus.worldStartRealDate);
  const worldClock = { ...clockAt(now, timeZone, worldStartRealDate), lastUpdated: now };
  await ctx.db.patch(worldStatus._id, {
    worldStartRealDate,
    worldStartTimeZone: timeZone,
    worldClock,
  });
  return worldClock;
}

async function appendRecentEvent(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  event: {
    type: string;
    actorPlayerId?: string;
    targetPlayerId?: string;
    actorName?: string;
    targetName?: string;
    source?: WorldEventSource;
    happenedDuringAlanPresence?: AlanPresenceStatus;
    observerPlayerIds: string[];
    descriptionZh: string;
    descriptionEn: string;
    locationId?: string;
    locationZh?: string;
    interpretationZh?: string;
    reactionDialogueZh?: string;
    futureImplicationsZh?: string;
    outcomeQuality?:
      | 'meaningful_new_information'
      | 'relationship_shift'
      | 'concrete_action'
      | 'emotional_residue'
      | 'repeated_noise';
    importance: number;
    clock: Clock;
  },
) {
  const metadata = timestampMeta(event.clock);
  const insertedId = await ctx.db.insert('worldEvents', {
    worldId,
    eventId: eventId(event.type),
    createdAt: metadata.createdAtUnix,
    ...metadata,
    ...event,
    source: event.source ?? 'system_event',
    happenedDuringAlanPresence: event.happenedDuringAlanPresence ?? 'unknown',
  });
  await updateSocialLayerForEvent(ctx, worldId, {
    ...event,
    eventId: insertedId.toString(),
    createdAt: metadata.createdAtUnix,
    ...metadata,
    source: event.source ?? 'system_event',
    happenedDuringAlanPresence: event.happenedDuringAlanPresence ?? 'unknown',
  });
  return insertedId;
}

async function updateEmotionByName(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  name: string,
  emotion: PortraitEmotion,
  reasonZh: string,
  clock: Clock,
) {
  const description = [...descriptions.values()].find((item) => item.name === name);
  if (!description) return;
  const profile = await ctx.db
    .query('schoolProfiles')
    .withIndex('player', (q) => q.eq('worldId', worldId).eq('playerId', description.playerId))
    .first();
  if (!profile || profile.currentEmotion === emotion) return;
  await ctx.db.patch(profile._id, { currentEmotion: emotion });
  const metadata = timestampMeta(clock);
  await ctx.db.insert('schoolNotifications', {
    worldId,
    notificationId: eventId('emotion_changed'),
    type: 'emotion_changed',
    titleZh: '狀態變化',
    contentZh: behaviorSignalForEmotion(name, emotion, reasonZh),
    relatedCharacterName: name,
    createdAt: metadata.createdAtUnix,
    ...metadata,
  });
}

function behaviorSignalForEmotion(name: string, emotion: PortraitEmotion, reasonZh: string) {
  const displayName = displayNameZh(name);
  if (emotion === 'worried') {
    if (name === 'Mahiru Shiina') return `${displayName}開始注意誰沒有把話說完：${reasonZh}`;
    if (name === 'Umi') return `${displayName}把簡報縮短了一點，先看人的狀態：${reasonZh}`;
    if (name === 'Asuna') return `${displayName}沒有立刻接下新事情，先停了一下：${reasonZh}`;
    return `${displayName}說話變得更小心：${reasonZh}`;
  }
  if (emotion === 'serious') {
    if (name === 'Umi') return `${displayName}先收斂成幾個可處理的重點：${reasonZh}`;
    if (name === 'Asuna') return `${displayName}把下一步說得更短，也更實際：${reasonZh}`;
    if (name === 'Mai') return `${displayName}開始挑出那句太快說出口的「沒事」：${reasonZh}`;
    if (name === 'CaoCao') return `${displayName}開始整理房間裡的位置和秩序：${reasonZh}`;
    return `${displayName}開始放慢語氣，先確認狀況：${reasonZh}`;
  }
  if (emotion === 'smiling') {
    return `${displayName}比較願意留在附近多說兩句：${reasonZh}`;
  }
  return `${displayName}今天的語氣留下一點變化：${reasonZh}`;
}

async function updateSocialLayerForEvent(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
	event: {
		eventId: string;
		type: string;
		actorName?: string;
		targetName?: string;
		source: WorldEventSource;
		happenedDuringAlanPresence?: AlanPresenceStatus;
		descriptionZh: string;
		locationId?: string;
		locationZh?: string;
    importance: number;
    clock: Clock;
    createdAt: number;
    createdAtUnix: number;
    createdAtIso: string;
    createdAtTimeZone: string;
    worldTimeLabelZh: string;
  },
) {
  const descriptions = await descriptionsByPlayer(ctx.db, worldId);
  const pressure = await applyWorldPressureFromEvent(ctx, worldId, event);
  await applyPressureToCharacters(ctx, worldId, descriptions, pressure, event.clock);
  await evolveRelationshipsFromEvent(ctx, worldId, descriptions, event, pressure);
  const isMajor = event.importance >= 7;
  const notificationType =
    event.type.includes('intention')
      ? 'intention_created'
      : isMajor
        ? 'major_event'
        : undefined;
  if (notificationType) {
    await ctx.db.insert('schoolNotifications', {
      worldId,
      notificationId: eventId(notificationType),
      type: notificationType,
      titleZh: notificationType === 'intention_created' ? '新的打算' : '校園焦點',
      contentZh: event.descriptionZh,
      relatedCharacterName: event.actorName,
      relatedEventId: event.eventId,
      locationId: event.locationId,
      locationZh: event.locationZh,
      createdAt: event.createdAt,
      createdAtUnix: event.createdAtUnix,
      createdAtIso: event.createdAtIso,
      createdAtTimeZone: event.createdAtTimeZone,
      worldTimeLabelZh: event.worldTimeLabelZh,
    });
  }

  const rumorContent = rumorFromEvent(event);
  if (rumorContent) {
    await ctx.db.insert('schoolRumors', {
      worldId,
      rumorId: eventId('rumor'),
      contentZh: rumorContent,
      sourceEventId: event.eventId,
      spreadLevel: Math.min(5, Math.max(1, Math.ceil(event.importance / 2))),
      affectedCharacters: ['Umi', 'Mahiru Shiina', 'Liu Bei', 'Mai', 'CaoCao'].filter(
        (name) => name !== event.actorName,
      ),
      locationId: event.locationId,
      locationZh: event.locationZh,
      createdAt: event.createdAt,
      createdAtUnix: event.createdAtUnix,
      createdAtIso: event.createdAtIso,
      createdAtTimeZone: event.createdAtTimeZone,
      worldTimeLabelZh: event.worldTimeLabelZh,
    });
    await ctx.db.insert('schoolNotifications', {
      worldId,
      notificationId: eventId('rumor_created'),
      type: 'rumor_created',
      titleZh: '校園傳聞',
      contentZh: rumorContent,
      relatedCharacterName: event.targetName ?? event.actorName,
      relatedEventId: event.eventId,
      locationId: event.locationId,
      locationZh: event.locationZh,
      createdAt: event.createdAt,
      createdAtUnix: event.createdAtUnix,
      createdAtIso: event.createdAtIso,
      createdAtTimeZone: event.createdAtTimeZone,
      worldTimeLabelZh: event.worldTimeLabelZh,
    });
  }

  const text = `${event.descriptionZh} ${event.type}`;
  if (text.includes('踢') || text.includes('焦慮') || text.includes('傳聞')) {
    await updateEmotionByName(ctx, worldId, descriptions, 'Mahiru Shiina', 'worried', '學生情緒出現壓力訊號', event.clock);
  }
  if (text.includes('曹操') || text.includes('學生會')) {
    await updateEmotionByName(ctx, worldId, descriptions, 'CaoCao', 'serious', '有人需要秩序才能把話說出口', event.clock);
  }
  if (text.includes('AI 社') || text.includes('規格') || text.includes('風險')) {
    await updateEmotionByName(ctx, worldId, descriptions, 'Mai', 'serious', '模糊的話需要被講清楚', event.clock);
    await updateEmotionByName(ctx, worldId, descriptions, 'Umi', 'serious', 'Alan 需要先看見人的狀態再推進', event.clock);
  }
  if (text.includes('排除') || text.includes('操控')) {
    await updateEmotionByName(ctx, worldId, descriptions, 'Liu Bei', 'worried', '學生可能被排除在討論之外', event.clock);
  }
  if (text.includes('負責人') || text.includes('執行')) {
    await updateEmotionByName(ctx, worldId, descriptions, 'Asuna', 'serious', '校園需要進入執行與協調模式', event.clock);
  }
}

function rumorFromEvent(event: { type: string; descriptionZh: string; actorName?: string; targetName?: string }) {
  if (event.type.includes('night') || event.type.includes('Night') || event.type.includes('lateNight')) return undefined;
  if (event.type === 'kick' && event.targetName) return `聽說 Alan 校長當眾踹了 ${displayNameZh(event.targetName)}。`;
  if (event.descriptionZh.includes('學生會')) return `校園傳聞：${event.descriptionZh}`;
  if (event.descriptionZh.includes('AI 社') && (event.type === 'announce' || event.type === 'createClub')) {
    return `校園傳聞：Alan 又把事情往前推了一步，大家開始猜他會不會注意到學生的狀態。`;
  }
  return undefined;
}

function displayNameZh(name: string) {
  if (name === 'Alan') return 'Alan';
  if (name === 'Umi' || name === '海' || name === '朝凪海') return '海';
  if (name === 'Asuna' || name === '明日奈' || name === '結城明日奈') return '明日奈';
  if (name === 'Mai' || name === '麻衣' || name === '櫻島麻衣') return '麻衣';
  if (name === 'Mahiru' || name === 'Mahiru Shiina' || name === '真晝' || name === '椎名真晝') return '真晝';
  if (name === 'CaoCao') return '曹操';
  if (name === 'Cao Cao') return '曹操';
  if (name === 'Liu Bei' || name === 'LiuBei') return '劉備';
  return name;
}

function residueFromMemoryDescription(description: string) {
  return description
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('殘留：'))
    ?.slice('殘留：'.length)
    .trim() ?? '';
}

function memoryTraceFromDescription(description: string) {
  const line = description
    .split('\n')
    .map((item) => item.trim())
    .find(
      (item) =>
        item &&
        !item.startsWith('記憶層級：') &&
        !item.startsWith('殘留：') &&
        !item.startsWith('Retention') &&
        !item.startsWith('Tags:'),
    );
  if (!line) return '';
  const naturalized = naturalizeSchoolText(line) ?? displayTextZh(line);
  return trimZhSentence(naturalized).slice(0, 120);
}

function displayTextZh(text: string) {
  return text
    .replaceAll('Mahiru Shiina', displayNameZh('Mahiru Shiina'))
    .replaceAll('椎名真晝', displayNameZh('椎名真晝'))
    .replaceAll('結城明日奈', displayNameZh('結城明日奈'))
    .replaceAll('櫻島麻衣', displayNameZh('櫻島麻衣'))
    .replaceAll('朝凪海', displayNameZh('朝凪海'))
    .replaceAll('Mahiru', displayNameZh('Mahiru'))
    .replaceAll('Cao Cao', displayNameZh('Cao Cao'))
    .replaceAll('CaoCao', displayNameZh('CaoCao'))
    .replaceAll('Liu Bei', displayNameZh('Liu Bei'))
    .replaceAll('LiuBei', displayNameZh('LiuBei'))
    .replaceAll('Asuna', displayNameZh('Asuna'))
    .replaceAll('Umi', displayNameZh('Umi'))
    .replaceAll('Mai', displayNameZh('Mai'));
}

function actionTypeLabelZh(actionType: string) {
  if (actionType === 'chatMessage') return '親自說話';
  if (actionType === 'chat') return '主動聊天';
  if (actionType === 'checkIn') return '關心近況';
  if (actionType === 'leaveMessage') return '留下訊息';
  if (actionType === 'askRumor') return '詢問傳聞';
  if (actionType === 'gift') return '送出關心';
  if (actionType === 'announce') return '公開公告';
  if (actionType === 'invite') return '邀請他人';
  if (actionType === 'createClub') return '創造新社團';
  if (actionType === 'kick') return '衝突性行動';
  if (actionType === 'assignRole') return '建立職責';
  return displayTextZh(actionType);
}

function behaviorTraitLabelZh(trait: string) {
  if (trait === 'strategic') return '偏向策略與秩序';
  if (trait === 'emotionally_supportive') return '偏向情感支持';
  if (trait === 'conflict_avoidant') return '傾向避免衝突';
  if (trait === 'expansionist') return '傾向快速擴張';
  if (trait === 'emotionally_distant') return '顯得情感距離較遠';
  if (trait === 'socially_curious') return '對人際互動更好奇';
  if (trait === 'analytical') return '偏向分析與邊界';
  if (trait === 'reflective') return '偏向反思與整理';
  return trait;
}

function incrementMap(map: Map<string, number>, key?: string, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sortedCounts(map: Map<string, number>, limit = 5) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

async function buildAlanBehaviorProfile(
  ctx: MutationCtx | QueryCtx,
  worldId: Id<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
) {
  const alanDescription = [...descriptions.values()].find((description) => description.name === DEFAULT_NAME);
  const recentPlayerEvents = await ctx.db
    .query('worldEvents')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .order('desc')
    .take(160);
  const alanEvents = recentPlayerEvents.filter(
    (event) =>
      event.source === 'player_action' &&
      (event.actorName === DEFAULT_NAME || event.actorPlayerId === alanDescription?.playerId),
  );
  const targetCounts = new Map<string, number>();
  const actionCounts = new Map<string, number>();
  const supportSignals = new Set<string>();
  const ignoredSignals = new Set<string>();
  const traitScores = new Map<string, number>([
    ['strategic', 0],
    ['emotionally_supportive', 0],
    ['conflict_avoidant', 0],
    ['expansionist', 0],
    ['emotionally_distant', 0],
    ['socially_curious', 0],
    ['analytical', 0],
    ['reflective', 0],
  ]);

  for (const event of alanEvents) {
    incrementMap(actionCounts, event.type);
    incrementMap(targetCounts, event.targetName);
    const text = `${event.descriptionZh} ${event.interpretationZh ?? ''} ${event.futureImplicationsZh ?? ''}`;
    if (event.type === 'chat' || event.type === 'invite') incrementMap(traitScores, 'socially_curious', 2);
    if (event.type === 'gift') incrementMap(traitScores, 'emotionally_supportive', 3);
    if (event.type === 'announce' || event.type === 'assignRole') incrementMap(traitScores, 'strategic', 2);
    if (event.type === 'createClub') incrementMap(traitScores, 'expansionist', 3);
    if (event.type === 'kick') incrementMap(traitScores, 'strategic', 1);
    if (event.targetName === 'CaoCao' || text.includes('學生會') || text.includes('秩序')) {
      incrementMap(traitScores, 'strategic', 3);
      supportSignals.add('Alan 最近較常碰觸秩序、學生會或制衡議題。');
    }
    if (event.targetName === 'Mahiru Shiina' || text.includes('焦慮') || text.includes('關心')) {
      incrementMap(traitScores, 'emotionally_supportive', 3);
      supportSignals.add('Alan 正在讓世界學到：學生狀態不是背景雜訊。');
    }
    if (event.targetName === 'Umi' || text.includes('海') || text.includes('簡報')) {
      incrementMap(traitScores, 'reflective', 3);
      supportSignals.add('Alan 逐漸習慣先找海整理世界，而不是立刻衝下一步。');
    }
    if (event.targetName === 'Mai' || text.includes('規格') || text.includes('邊界') || text.includes('風險')) {
      incrementMap(traitScores, 'analytical', 3);
      supportSignals.add('Alan 對邊界、規格與風險的注意力正在增加。');
    }
    if (event.type === 'announce' || event.type === 'createClub') {
      supportSignals.add('Alan 仍然會用公開行動推動世界改變。');
    }
  }

  const chatCount = actionCounts.get('chat') ?? 0;
  const publicActionCount =
    (actionCounts.get('announce') ?? 0) + (actionCounts.get('createClub') ?? 0) + (actionCounts.get('assignRole') ?? 0);
  if (alanEvents.length >= 3 && publicActionCount > chatCount + 1) {
    incrementMap(traitScores, 'emotionally_distant', 3);
    ignoredSignals.add('Alan 最近較常用制度或功能推進，而不是先一對一確認感受。');
  }
  if ((actionCounts.get('kick') ?? 0) === 0 && alanEvents.length >= 4) {
    incrementMap(traitScores, 'conflict_avoidant', 2);
  }

  const trustedCharacters: Array<{ name: string; displayNameZh: string; score: number }> = [];
  if (alanDescription) {
    const relationships = await ctx.db
      .query('schoolRelationships')
      .withIndex('subject', (q) => q.eq('worldId', worldId))
      .collect();
    for (const relationship of relationships) {
      if (relationship.objectPlayerId !== alanDescription.playerId) continue;
      const name = descriptions.get(relationship.subjectPlayerId)?.name;
      if (!name || name === DEFAULT_NAME) continue;
      const dimensions = relationship.dimensions;
      const score = Math.round(
        (dimensions.trust ?? 0) +
          (dimensions.comfort ?? 0) * 0.7 +
          (dimensions.admiration ?? 0) * 0.6 +
          (dimensions.concern ?? 0) * 0.4 -
          (dimensions.fear ?? 0) * 0.35,
      );
      trustedCharacters.push({ name, displayNameZh: displayNameZh(name), score });
    }
  }

  for (const [name, count] of targetCounts) {
    if (name === 'CaoCao') incrementMap(traitScores, 'strategic', count);
    if (name === 'Mahiru Shiina') incrementMap(traitScores, 'emotionally_supportive', count);
    if (name === 'Umi') incrementMap(traitScores, 'reflective', count);
    if (name === 'Mai') incrementMap(traitScores, 'analytical', count);
  }

  const traits = sortedCounts(traitScores, 8)
    .filter(([, score]) => score > 0)
    .map(([trait, score]) => ({
      trait,
      labelZh: behaviorTraitLabelZh(trait),
      score,
      evidenceZh:
        trait === 'strategic'
          ? '常和秩序、學生會、職責或公開決策相關。'
          : trait === 'emotionally_supportive'
            ? '常和關心、陪伴、學生情緒或真晝相關。'
            : trait === 'reflective'
              ? '常和海、簡報、整理脈絡相關。'
              : trait === 'analytical'
                ? '常和麻衣、規格、風險或邊界相關。'
                : undefined,
    }));
  const strongest = traits[0];
  const timeSpentWith = sortedCounts(targetCounts, 6).map(([name, count]) => ({
    name,
    displayNameZh: displayNameZh(name),
    count,
  }));
  const repeatedChoices = sortedCounts(actionCounts, 6).map(([actionType, count]) => ({
    actionType,
    labelZh: actionTypeLabelZh(actionType),
    count,
  }));
  const reflectionZh = strongest
    ? `Alan 最近似乎越來越${strongest.labelZh}。這不是世界替他做決定，只是校園開始記住他的習慣。`
    : '世界還沒有足夠資料判斷 Alan 的慣性。';

  return {
    traits,
    strongestTrait: strongest?.trait,
    strongestTraitZh: strongest?.labelZh,
    trustedCharacters: trustedCharacters.sort((a, b) => b.score - a.score).slice(0, 5),
    timeSpentWith,
    repeatedChoices,
    supportsZh: [...supportSignals].slice(0, 5),
    ignoresZh: [...ignoredSignals].slice(0, 4),
    reflectionZh,
  };
}

async function upsertAlanBehaviorProfile(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
) {
  const previous = await ctx.db
    .query('alanBehaviorProfiles')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .first();
  const profile = await buildAlanBehaviorProfile(ctx, worldId, descriptions);
  const patch = {
    ...profile,
    freeDevelopmentMode: previous?.freeDevelopmentMode ?? false,
    updatedAt: Date.now(),
  };
  if (previous) {
    await ctx.db.patch(previous._id, patch);
    return { ...previous, ...patch };
  }
  const id = await ctx.db.insert('alanBehaviorProfiles', { worldId, ...patch });
  return { _id: id, worldId, ...patch };
}

async function currentAlanBehaviorProfile(
  ctx: MutationCtx | QueryCtx,
  worldId: Id<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
) {
  const existing = await ctx.db
    .query('alanBehaviorProfiles')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .first();
  if (existing) return existing;
  return buildAlanBehaviorProfile(ctx, worldId, descriptions);
}

async function maybeAddAwayAlanDrift(
  ctx: MutationCtx,
  world: Doc<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  clock: Clock,
  activities: string[],
  implications: string[],
) {
  const alan = resolveAlanPlayer(world, descriptions);
  if (alan || activities.length >= 4) return;
  const existing = await ctx.db
    .query('worldEvents')
    .withIndex('type', (q) => q.eq('worldId', world._id).eq('type', 'awayAlanBehaviorDrift'))
    .order('desc')
    .first();
  if (existing && existing.createdAt > Date.now() - 45 * 60_000) return;

  const profile = await upsertAlanBehaviorProfile(ctx, world._id, descriptions);
  const modeIsFree = !!profile.freeDevelopmentMode;
  const location =
    profile.strongestTrait === 'emotionally_supportive'
      ? SchoolLocations.find((item) => item.id === 'dormitory')!
      : profile.strongestTrait === 'strategic'
        ? SchoolLocations.find((item) => item.id === 'courtyard')!
        : profile.strongestTrait === 'analytical'
          ? SchoolLocations.find((item) => item.id === 'aiClubRoom')!
          : SchoolLocations.find((item) => item.id === 'courtyard')!;
  const descriptionZh = modeIsFree
    ? `Alan 離校時，世界依照它學到的 Alan 習慣自由延伸了一小步：${profile.reflectionZh}`
    : `Alan 離校處理其他公司的事情時，校園只留下他的行為慣性：${profile.reflectionZh}`;
  const futureImplicationsZh = modeIsFree
    ? '自由發展模式已開啟；Away Alan 仍會避免災難性決策，但世界可能更主動延伸他的習慣。'
    : '目前自由發展模式關閉；Away Alan 只能觀察、靠近場景、留下輕微回聲，不會替玩家做重大決定。';
  await appendRecentEvent(ctx, world._id, {
    type: 'awayAlanBehaviorDrift',
    actorName: DEFAULT_NAME,
    source: 'world_simulation_event',
    happenedDuringAlanPresence: 'away',
    observerPlayerIds: world.players.map((p) => p.id),
    descriptionZh,
    descriptionEn: 'Away Alan left a low-risk behavioral drift trace learned from player habits.',
    locationId: location.id,
    locationZh: location.labelZh,
    interpretationZh: '這是世界對 Alan 習慣的低風險推測，不是玩家親自做出的重大選擇。',
    reactionDialogueZh: '海把這個變化記下來，準備在 Alan 回來時提醒他：世界正在學習他的輪廓。',
    futureImplicationsZh,
    importance: 6,
    clock,
  });
  activities.push(descriptionZh);
  implications.push(futureImplicationsZh);
}

function emotionZh(emotion: PortraitEmotion) {
  if (emotion === 'smiling') return '微笑';
  if (emotion === 'worried') return '擔心';
  if (emotion === 'serious') return '認真';
  return '平靜';
}

const DEFAULT_WORLD_PRESSURE: WorldPressure = {
  aiClubInfluence: 25,
  studentAnxiety: 20,
  socialDivision: 15,
  trustInLeadership: 70,
  rumorIntensity: 10,
  schoolStability: 75,
  mood: 'calm',
};

function clampPressure(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function moodFromPressure(pressure: Omit<WorldPressure, 'mood'>): SchoolMood {
  if (pressure.studentAnxiety >= 78 || pressure.schoolStability <= 28) return 'emotionally_exhausted';
  if (pressure.socialDivision >= 65) return 'divided';
  if (pressure.rumorIntensity >= 60 || pressure.aiClubInfluence >= 68) return 'politically_tense';
  if (pressure.studentAnxiety >= 50) return 'anxious';
  if (pressure.trustInLeadership >= 78 && pressure.schoolStability >= 68) return 'hopeful';
  return 'calm';
}

function moodZh(mood: SchoolMood) {
  if (mood === 'hopeful') return '有希望';
  if (mood === 'anxious') return '焦慮';
  if (mood === 'divided') return '疏離';
  if (mood === 'politically_tense') return '人際緊繃';
  if (mood === 'emotionally_exhausted') return '情緒疲憊';
  return '平靜';
}

function worldMoodDescriptionZh(pressure: WorldPressure) {
  const mood = moodZh(pressure.mood);
  if (pressure.mood === 'politically_tense') {
    return `${mood}：傳聞和沉默正在互相牽動，學生開始小心觀察誰可以說真話。`;
  }
  if (pressure.mood === 'divided') {
    return `${mood}：有些學生開始自己待著，劉備與真晝會更想把人拉回能說真話的地方。`;
  }
  if (pressure.mood === 'anxious') {
    return `${mood}：學生還沒有崩潰，但真晝會開始注意誰不敢開口。`;
  }
  if (pressure.mood === 'emotionally_exhausted') {
    return `${mood}：世界推進得太快，海會要求 Alan 先穩住人，而不是再加新功能。`;
  }
  if (pressure.mood === 'hopeful') {
    return `${mood}：大家仍願意相信 Alan 的方向，只需要更能讓人安心的節奏。`;
  }
  return `${mood}：校園目前還能呼吸，但小變化正在累積成明天的心情。`;
}

function dailyCampusFocusItems(
  events: Array<{ descriptionZh: string; type?: string }>,
  pressure: WorldPressure,
  clock?: Clock,
) {
  const text = events.map((event) => `${event.descriptionZh} ${event.type ?? ''}`).join('；');
  const items: string[] = [];
  if (text.includes('真晝') || text.includes('焦慮') || pressure.studentAnxiety >= 45) {
    items.push('真晝注意到學生最近說話變得比較小心。');
  } else if (pressure.studentAnxiety < 25 && pressure.socialDivision < 45 && pressure.rumorIntensity < 45) {
    items.push('今天校園比較像普通的一天：有人睡不夠，有人想聊天，也有人只是安靜待著。');
  } else {
    items.push('校園表面平靜，但有些學生開始注意身邊的人是不是變安靜了。');
  }
  if (text.includes('曹操') || pressure.socialDivision >= 50) {
    items.push('曹操今天異常安靜，像是在確認房間裡有沒有位置留給不敢開口的人。');
  } else if (text.includes('劉備')) {
    items.push('劉備想確認安靜的學生沒有被討論排除在外。');
  } else {
    items.push('庭院裡的閒聊比平常少了一點，空氣有點微妙。');
  }
  if (clock) {
    const location = schoolLocationForClock(clock);
    const eventIndex = Math.max(0, (clock.day + clock.hour) % Math.max(1, location.moodEvents.length));
    const moodEvent = location.moodEvents[eventIndex];
    if (moodEvent) {
      items.push(`${location.labelZh}今天可能出現「${moodEvent.titleZh}」：${moodEvent.emotionHintZh}`);
    }
  }
  if (pressure.trustInLeadership <= 55 || text.includes('考') || text.includes('作業') || text.includes('沒事')) {
    items.push('海建議 Alan 先問清楚今天誰變安靜、為什麼，不要急著開新支線。');
  } else {
    items.push('海建議 Alan 先選一個人好好聊，不要一次處理整個宇宙。');
  }
  if (clock && (clock.hour >= 21 || clock.hour < 6)) {
    return ['今晚校園安靜下來，大多數人需要休息。', '如果要談話，先確認對方是不是願意被打擾。', items[0]];
  }
  return items.slice(0, 3);
}

function storyDigestFromActivities(activities: string[], pressure: WorldPressure): StoryDigestItem[] {
  const digest: StoryDigestItem[] = [];
  const pushUnique = (item: StoryDigestItem) => {
    if (digest.some((existing) => existing.happenedZh === item.happenedZh)) return;
    if (digest.some((existing) => existing.suggestedActionZh === item.suggestedActionZh)) return;
    digest.push(item);
  };
  for (const activity of activities) {
    if (
      activity.includes('睡') ||
      activity.includes('午餐') ||
      activity.includes('天氣') ||
      activity.includes('窗邊') ||
      activity.includes('椅子') ||
      activity.includes('線材') ||
      activity.includes('普通聊天') ||
      activity.includes('熬夜')
    ) {
      pushUnique({
        happenedZh: activity,
        changedZh: '校園留下了一點日常紋理，而不是只有事件和立場。',
        whyItMattersZh: '普通疲憊、沉默和小互動會慢慢變成角色之間的距離或親近。',
        suggestedActionZh: '選一位看起來安靜或疲憊的角色，先聊普通的事。',
      });
    } else if (activity.includes('比平常安靜') || activity.includes('說真話') || activity.includes('小心')) {
      pushUnique({
        happenedZh: activity,
        changedZh: `學生的不安被看見；目前焦慮 ${pressure.studentAnxiety}。`,
        whyItMattersZh: '這不是危機，但它是校園開始需要安全感的第一個訊號。',
        suggestedActionZh: '先找真晝談談，聽聽安靜學生真正擔心什麼。',
      });
    } else if (activity.includes('海')) {
      pushUnique({
        happenedZh: activity,
        changedZh: `海把混亂整理成下一步；目前領導信任 ${pressure.trustInLeadership}。`,
        whyItMattersZh: 'Alan 需要有人把世界變化翻譯成可行動的校長判斷。',
        suggestedActionZh: '先聽海簡報，再選一個人去談。',
      });
    } else if (activity.includes('真晝') || activity.includes('焦慮') || activity.includes('壓力')) {
      pushUnique({
        happenedZh: activity,
        changedZh: `學生焦慮被看見；目前焦慮 ${pressure.studentAnxiety}。`,
        whyItMattersZh: '如果沉默的學生繼續被忽略，校園會把不安藏進傳聞裡。',
        suggestedActionZh: '去宿舍看看真晝，先聽學生真正擔心什麼。',
      });
    } else if (activity.includes('曹操') || activity.includes('學生會')) {
      pushUnique({
        happenedZh: activity,
        changedZh: `學生會影響力與校園分裂感上升；目前校園分裂 ${pressure.socialDivision}。`,
        whyItMattersZh: '曹操不是單純製造麻煩，他正在測試誰會接受一套更強的秩序。',
        suggestedActionZh: '找曹操談 AI 社與學生會的邊界。',
      });
    } else if (activity.includes('麻衣') || activity.includes('Mai') || activity.includes('規格') || activity.includes('風險')) {
      pushUnique({
        happenedZh: activity,
        changedZh: `AI 社規則問題變成焦點；目前 AI 社影響力 ${pressure.aiClubInfluence}。`,
        whyItMattersZh: '沒被定義的規則會被不同勢力各自解讀。',
        suggestedActionZh: '正式公告 AI 社目的、邊界與參與規則。',
      });
    } else if (activity.includes('劉備') || activity.includes('公開討論')) {
      pushUnique({
        happenedZh: activity,
        changedZh: `有人開始修復共同體；目前校園穩定 ${pressure.schoolStability}。`,
        whyItMattersZh: '劉備在避免學生因立場不同變得孤立。',
        suggestedActionZh: '陪劉備先找一位安靜的學生聊聊，別急著把一切變成正式會議。',
      });
    } else if (activity.includes('明日奈') || activity.includes('Asuna') || activity.includes('執行')) {
      pushUnique({
        happenedZh: activity,
        changedZh: `校務負擔變得更明確；目前校園穩定 ${pressure.schoolStability}。`,
        whyItMattersZh: '明日奈不是只在整理，她在承擔世界能不能真的運作的壓力。',
        suggestedActionZh: '請明日奈把下一步排成負責人與時間表。',
      });
    }
  }
  if (!digest.length) {
    digest.push({
      happenedZh: '校園安靜地往前推進，角色們保留了新的觀察。',
      changedZh: `目前校園氣氛是${moodZh(pressure.mood)}。`,
      whyItMattersZh: '即使沒有爆點，安靜的日常也會慢慢累積成關係和文化。',
      suggestedActionZh: '先觀察周圍，選一位附近角色開始互動。',
    });
  }
  if (digest.length < 3) {
    digest.push({
      happenedZh: `校園氣氛目前是${moodZh(pressure.mood)}，壓力值正在成為後續事件的背景。`,
      changedZh: `AI 社 ${pressure.aiClubInfluence}、焦慮 ${pressure.studentAnxiety}、分裂 ${pressure.socialDivision}、傳聞 ${pressure.rumorIntensity}。`,
      whyItMattersZh: '這些數值會影響角色接下來更容易談什麼、害怕什麼，以及誰會主動行動。',
      suggestedActionZh: '看海的建議，選一條最急的線處理。',
    });
  }
  return digest.slice(0, 3);
}

async function currentWorldPressure(ctx: { db: DatabaseReader }, worldId: Id<'worlds'>): Promise<WorldPressure> {
  const existing = await ctx.db
    .query('schoolWorldPressure')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .first();
  if (!existing) return DEFAULT_WORLD_PRESSURE;
  return {
    aiClubInfluence: existing.aiClubInfluence,
    studentAnxiety: existing.studentAnxiety,
    socialDivision: existing.socialDivision,
    trustInLeadership: existing.trustInLeadership,
    rumorIntensity: existing.rumorIntensity,
    schoolStability: existing.schoolStability,
    mood: existing.mood,
  };
}

function pressureDeltaForEvent(event: {
  type: string;
  descriptionZh: string;
  actorName?: string;
  targetName?: string;
  source: WorldEventSource;
  importance: number;
}): WorldPressureDelta {
  const text = `${event.descriptionZh} ${event.type}`;
  const delta: WorldPressureDelta = {};
  const add = (key: keyof WorldPressureDelta, value: number) => {
    delta[key] = (delta[key] ?? 0) + value;
  };

  if (event.type === 'kick') {
    add('studentAnxiety', 12);
    add('socialDivision', 8);
    add('trustInLeadership', -10);
    add('rumorIntensity', 14);
    add('schoolStability', -8);
  }
  if (event.type === 'announce') {
    const clearRule = text.includes('規則') || text.includes('透明') || text.includes('安全');
    add('trustInLeadership', clearRule ? 7 : 2);
    add('studentAnxiety', clearRule ? -4 : 2);
    add('schoolStability', clearRule ? 5 : 1);
  }
  if (event.type === 'createClub' || text.includes('AI 社')) {
    add('aiClubInfluence', 8);
    add('studentAnxiety', event.type === 'dailyOpeningFocus' ? 1 : 4);
    add('socialDivision', 3);
  }
  if (text.includes('學生會') || event.actorName === 'CaoCao') {
    add('socialDivision', 7);
    add('rumorIntensity', 5);
    add('schoolStability', event.actorName === 'CaoCao' ? 2 : -1);
  }
  if (text.includes('焦慮') || text.includes('壓力') || text.includes('不敢說真心話')) {
    add('studentAnxiety', 7);
    add('schoolStability', -3);
  }
  if (event.actorName === 'Mahiru Shiina' || text.includes('真晝') || text.includes('安撫')) {
    add('studentAnxiety', event.type === 'dailyOpeningFocus' ? 3 : -6);
    add('schoolStability', 4);
  }
  if (event.actorName === 'Liu Bei' || text.includes('公開討論') || text.includes('排除')) {
    add('socialDivision', -4);
    add('trustInLeadership', 2);
    add('schoolStability', 3);
  }
  if (event.actorName === 'Umi' || text.includes('海')) {
    add('schoolStability', 4);
    add('trustInLeadership', 3);
  }
  if (event.actorName === 'Mai' || text.includes('規格') || text.includes('邊界') || text.includes('風險')) {
    add('schoolStability', 2);
    add('studentAnxiety', -2);
  }
  if (event.importance >= 8) {
    add('rumorIntensity', 3);
  }
  return delta;
}

function applyPressureDelta(current: WorldPressure, delta: WorldPressureDelta): WorldPressure {
  const nextCore = {
    aiClubInfluence: clampPressure(current.aiClubInfluence + (delta.aiClubInfluence ?? 0) - 0.5),
    studentAnxiety: clampPressure(current.studentAnxiety + (delta.studentAnxiety ?? 0) - 1),
    socialDivision: clampPressure(current.socialDivision + (delta.socialDivision ?? 0) - 1),
    trustInLeadership: clampPressure(current.trustInLeadership + (delta.trustInLeadership ?? 0) - 0.25),
    rumorIntensity: clampPressure(current.rumorIntensity + (delta.rumorIntensity ?? 0) - 1.5),
    schoolStability: clampPressure(current.schoolStability + (delta.schoolStability ?? 0) + 0.5),
  };
  return { ...nextCore, mood: moodFromPressure(nextCore) };
}

function playablePressureBaseline(current: WorldPressure): WorldPressure {
  const saturated =
    current.aiClubInfluence >= 90 ||
    current.studentAnxiety >= 75 ||
    current.socialDivision >= 85 ||
    current.rumorIntensity >= 85 ||
    current.schoolStability <= 25;
  if (!saturated) {
    return {
      aiClubInfluence: clampPressure(current.aiClubInfluence),
      studentAnxiety: clampPressure(current.studentAnxiety),
      socialDivision: clampPressure(current.socialDivision),
      trustInLeadership: clampPressure(current.trustInLeadership),
      rumorIntensity: clampPressure(current.rumorIntensity),
      schoolStability: clampPressure(current.schoolStability),
      mood: moodFromPressure(current),
    };
  }
  const nextCore = {
    aiClubInfluence: Math.min(current.aiClubInfluence, 62),
    studentAnxiety: Math.min(current.studentAnxiety, 48),
    socialDivision: Math.min(current.socialDivision, 45),
    trustInLeadership: Math.max(Math.min(current.trustInLeadership, 82), 62),
    rumorIntensity: Math.min(current.rumorIntensity, 42),
    schoolStability: Math.max(Math.min(current.schoolStability, 82), 58),
  };
  return { ...nextCore, mood: moodFromPressure(nextCore) };
}

async function repairWorldPressureForPlayability(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  now: number,
) {
  const existing = await ctx.db
    .query('schoolWorldPressure')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .first();
  const before = existing
    ? {
        aiClubInfluence: existing.aiClubInfluence,
        studentAnxiety: existing.studentAnxiety,
        socialDivision: existing.socialDivision,
        trustInLeadership: existing.trustInLeadership,
        rumorIntensity: existing.rumorIntensity,
        schoolStability: existing.schoolStability,
        mood: existing.mood,
      }
    : DEFAULT_WORLD_PRESSURE;
  const after = playablePressureBaseline(before);
  const changed =
    before.aiClubInfluence !== after.aiClubInfluence ||
    before.studentAnxiety !== after.studentAnxiety ||
    before.socialDivision !== after.socialDivision ||
    before.rumorIntensity !== after.rumorIntensity ||
    before.schoolStability !== after.schoolStability ||
    before.trustInLeadership !== after.trustInLeadership ||
    before.mood !== after.mood;
  if (!changed && existing) return { before, after, changed };
  const payload = {
    ...after,
    lastEventId: existing?.lastEventId,
    updatedAt: now,
  };
  if (existing) {
    await ctx.db.patch(existing._id, payload);
  } else {
    await ctx.db.insert('schoolWorldPressure', { worldId, ...payload });
  }
  return { before, after, changed };
}

function pressureChangedMeaningfully(before: WorldPressure, after: WorldPressure) {
  return (
    before.mood !== after.mood ||
    Math.abs(before.studentAnxiety - after.studentAnxiety) >= 8 ||
    Math.abs(before.socialDivision - after.socialDivision) >= 8 ||
    Math.abs(before.trustInLeadership - after.trustInLeadership) >= 8 ||
    Math.abs(before.rumorIntensity - after.rumorIntensity) >= 8
  );
}

async function applyWorldPressureFromEvent(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  event: {
    eventId: string;
    type: string;
    actorName?: string;
    targetName?: string;
    source: WorldEventSource;
    descriptionZh: string;
    locationId?: string;
    locationZh?: string;
    importance: number;
    clock: Clock;
    createdAt: number;
    createdAtUnix: number;
    createdAtIso: string;
    createdAtTimeZone: string;
    worldTimeLabelZh: string;
  },
) {
  const existing = await ctx.db
    .query('schoolWorldPressure')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .first();
  const before = existing
    ? {
        aiClubInfluence: existing.aiClubInfluence,
        studentAnxiety: existing.studentAnxiety,
        socialDivision: existing.socialDivision,
        trustInLeadership: existing.trustInLeadership,
        rumorIntensity: existing.rumorIntensity,
        schoolStability: existing.schoolStability,
        mood: existing.mood,
      }
    : DEFAULT_WORLD_PRESSURE;
  const after = applyPressureDelta(before, pressureDeltaForEvent(event));
  const payload = {
    ...after,
    lastEventId: event.eventId,
    updatedAt: event.createdAt,
  };
  if (existing) {
    await ctx.db.patch(existing._id, payload);
  } else {
    await ctx.db.insert('schoolWorldPressure', { worldId, ...payload });
  }

  if (pressureChangedMeaningfully(before, after)) {
    await ctx.db.insert('schoolNotifications', {
      worldId,
      notificationId: eventId('world_pressure_changed'),
      type: 'world_pressure_changed',
      titleZh: '校園氣氛變化',
      contentZh: worldMoodDescriptionZh(after),
      relatedCharacterName: event.actorName,
      relatedEventId: event.eventId,
      locationId: event.locationId,
      locationZh: event.locationZh,
      createdAt: event.createdAt,
      createdAtUnix: event.createdAtUnix,
      createdAtIso: event.createdAtIso,
      createdAtTimeZone: event.createdAtTimeZone,
      worldTimeLabelZh: event.worldTimeLabelZh,
    });
  }
  return after;
}

function pressureDrivenCharacterNotes(pressure: WorldPressure) {
  const notes: Record<string, { emotion?: PortraitEmotion; intention?: string; memory?: string }> = {};
  if (pressure.studentAnxiety >= 50) {
    notes['Mahiru Shiina'] = {
      emotion: 'worried',
      intention: '確認學生是否因 AI 社、傳聞或派系壓力而不敢說真心話',
      memory: `校園情緒壓力升高到 ${pressure.studentAnxiety}，我需要先照顧不敢開口的人。`,
    };
    notes.Umi = {
      emotion: 'serious',
      intention: '提醒 Alan 先穩住學生情緒，再繼續推進 AI 社',
    };
  }
  if (pressure.socialDivision >= 45) {
    notes['Liu Bei'] = {
      emotion: 'worried',
      intention: '先關心被排除或沉默的學生，再決定是否需要正式討論',
    };
    notes.CaoCao = {
      emotion: pressure.socialDivision >= 65 ? 'smiling' : 'serious',
      intention: '建立學生會秩序網絡，觀察誰在分裂中需要方向',
    };
  }
  if (pressure.aiClubInfluence >= 55 || pressure.rumorIntensity >= 45) {
    notes.Mai = {
      emotion: 'serious',
      intention: '要求 Alan 定義 AI 社邊界，避免傳聞替世界制定規則',
    };
  }
  if (pressure.trustInLeadership <= 45) {
    notes.Asuna = {
      emotion: 'serious',
      intention: '整理校務執行清單，修復學生對領導節奏的信任',
    };
    notes.Umi = {
      emotion: 'serious',
      intention: '把信任下滑原因整理成 Alan 可以立即處理的簡報',
    };
  }
  return notes;
}

async function applyPressureToCharacters(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  pressure: WorldPressure,
  clock: Clock,
) {
  const notes = pressureDrivenCharacterNotes(pressure);
  for (const [name, note] of Object.entries(notes)) {
    const description = [...descriptions.values()].find((item) => item.name === name);
    if (!description) continue;
    const profile = await ctx.db
      .query('schoolProfiles')
      .withIndex('player', (q) => q.eq('worldId', worldId).eq('playerId', description.playerId))
      .first();
    if (!profile) continue;
    const nextIntentions = note.intention
      ? [note.intention, ...(profile.shortTermIntentions ?? []).filter((item) => item !== note.intention)].slice(0, 8)
      : profile.shortTermIntentions;
    const nextMemory = note.memory
      ? [note.memory, ...profile.shortTermMemory.filter((item) => item !== note.memory)].slice(0, 12)
      : profile.shortTermMemory;
    if (note.emotion && profile.currentEmotion !== note.emotion) {
      await updateEmotionByName(ctx, worldId, descriptions, name, note.emotion, worldMoodDescriptionZh(pressure), clock);
    }
    await ctx.db.patch(profile._id, {
      currentEmotion: note.emotion ?? profile.currentEmotion,
      shortTermIntentions: nextIntentions,
      shortTermMemory: nextMemory,
    });
  }
}

async function patchRelationshipDelta(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  subjectName: string,
  objectName: string,
  delta: Partial<RelationshipDimensions>,
  narrative: string,
  clock: Clock,
) {
  const subject = [...descriptions.values()].find((item) => item.name === subjectName);
  const object = [...descriptions.values()].find((item) => item.name === objectName);
  if (!subject || !object) return;
  const relationship = await ctx.db
    .query('schoolRelationships')
    .withIndex('edge', (q) =>
      q.eq('worldId', worldId).eq('subjectPlayerId', subject.playerId).eq('objectPlayerId', object.playerId),
    )
    .first();
  if (!relationship) return;
  const current = relationship.dimensions;
  const dimensions = {
    trust: clampPressure(current.trust + (delta.trust ?? 0)),
    respect: clampPressure(current.respect + (delta.respect ?? 0)),
    affection: clampPressure(current.affection + (delta.affection ?? 0)),
    fear: clampPressure(current.fear + (delta.fear ?? 0)),
    influence: clampPressure(current.influence + (delta.influence ?? 0)),
    comfort: clampPressure(
      (current.comfort ?? Math.round((current.trust + current.affection) / 2)) + (delta.comfort ?? 0),
    ),
    admiration: clampPressure((current.admiration ?? current.respect) + (delta.admiration ?? 0)),
    concern: clampPressure((current.concern ?? 0) + (delta.concern ?? 0)),
    emotionalCloseness: clampPressure(
      (current.emotionalCloseness ?? current.affection) + (delta.emotionalCloseness ?? 0),
    ),
    curiosity: clampPressure((current.curiosity ?? 50) + (delta.curiosity ?? 0)),
    dependency: clampPressure((current.dependency ?? 0) + (delta.dependency ?? 0)),
    jealousy: clampPressure((current.jealousy ?? 0) + (delta.jealousy ?? 0)),
    emotionalTension: clampPressure((current.emotionalTension ?? current.fear) + (delta.emotionalTension ?? 0)),
  };
  await ctx.db.patch(relationship._id, {
    dimensions,
    narrative,
    updatedAt: Date.now(),
  });
  const metadata = timestampMeta(clock);
  await ctx.db.insert('schoolNotifications', {
    worldId,
    notificationId: eventId('relationship_change'),
    type: 'relationship_change',
    titleZh: '關係變化',
    contentZh: narrative,
    relatedCharacterName: subjectName,
    createdAt: metadata.createdAtUnix,
    ...metadata,
  });
}

async function evolveRelationshipsFromEvent(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  event: {
    type: string;
    actorName?: string;
    targetName?: string;
    descriptionZh: string;
    clock: Clock;
  },
  pressure: WorldPressure,
) {
  if (event.type.includes('night') || event.type.includes('Night') || event.type.includes('lateNight')) return;
  if (event.type === 'kick' && event.actorName === 'Alan' && event.targetName) {
    await patchRelationshipDelta(
      ctx,
      worldId,
      descriptions,
      event.targetName,
      'Alan',
      { trust: -10, respect: -4, fear: 8 },
      `${displayNameZh(event.targetName)} 對 Alan 的信任下降；這不只是疼痛，而是公開場面造成的權力警訊。`,
      event.clock,
    );
  }
  if (event.actorName === 'Mahiru Shiina' || event.descriptionZh.includes('安撫')) {
    await patchRelationshipDelta(
      ctx,
      worldId,
      descriptions,
      'Mahiru Shiina',
      'Alan',
      { trust: pressure.studentAnxiety >= 50 ? -2 : 2, affection: 2 },
      pressure.studentAnxiety >= 50
        ? '真晝仍信任 Alan，但開始擔心他推進世界的速度超過學生能承受的範圍。'
        : '真晝感覺 Alan 的世界仍有被溫柔照顧的空間。',
      event.clock,
    );
  }
  if (event.actorName === 'CaoCao' || event.descriptionZh.includes('學生會')) {
    await patchRelationshipDelta(
      ctx,
      worldId,
      descriptions,
      'CaoCao',
      'Alan',
      { trust: -2, respect: 3, influence: 4 },
      '曹操更尊重 Alan 創造世界的能力，但也更確定校園需要一套不只靠 Alan 心情運作的秩序。',
      event.clock,
    );
  }
  if (event.actorName === 'Liu Bei' || event.descriptionZh.includes('公開討論')) {
    await patchRelationshipDelta(
      ctx,
      worldId,
      descriptions,
      'Liu Bei',
      'Alan',
      { trust: 2, affection: 2, influence: 2 },
      '劉備仍願意相信 Alan，但希望 Alan 先看見那些沒有被邀請進對話的人，而不是讓派系自行解釋世界。',
      event.clock,
    );
  }
  if (event.actorName === 'Alan' && event.targetName && event.type !== 'kick') {
    const delta = alanActionEmotionalDelta(event.targetName, event.type, event.descriptionZh);
    if (delta) {
      await patchRelationshipDelta(
        ctx,
        worldId,
        descriptions,
        event.targetName,
        'Alan',
        delta.delta,
        delta.narrative,
        event.clock,
      );
    }
  }
}

function alanActionEmotionalDelta(targetName: string, eventType: string, descriptionZh: string) {
  const text = descriptionZh.toLowerCase();
  const isCareSignal =
    text.includes('休息') ||
    text.includes('累') ||
    text.includes('睡') ||
    text.includes('擔心') ||
    text.includes('沒事') ||
    text.includes('陪');
  if (eventType === 'gift') {
    return {
      delta: { comfort: 4, emotionalCloseness: 3, trust: 1 },
      narrative: `${displayNameZh(targetName)}把 Alan 的禮物記成一個小小的關心訊號；這不是戀愛數值，而是「他有注意到我」的感覺。`,
    };
  }
  if (eventType === 'invite' || eventType === 'chat') {
    return emotionalTendencyFor(targetName, isCareSignal ? 'care' : 'attention');
  }
  if (eventType === 'assignRole') {
    return {
      delta: { trust: 2, admiration: 3, emotionalTension: -1 },
      narrative: `${displayNameZh(targetName)}感覺 Alan 願意把責任交給自己；信任不是口號，而是被交付後慢慢變重的東西。`,
    };
  }
  if (eventType === 'announce' || eventType === 'createClub') {
    return {
      delta: { curiosity: 2, concern: 1 },
      narrative: `${displayNameZh(targetName)}沒有立刻靠近 Alan，但開始更在意 Alan 的選擇會把世界帶去哪裡。`,
    };
  }
  return undefined;
}

function emotionalTendencyFor(targetName: string, mode: 'attention' | 'care' | 'deepTalk') {
  if (targetName === 'Umi') {
    return {
      delta:
        mode === 'care'
          ? { comfort: 3, emotionalCloseness: 3, concern: 4, dependency: 1 }
          : { concern: 3, curiosity: 2, emotionalCloseness: 1 },
      narrative:
        mode === 'care'
          ? '海沒有把 Alan 的關心說得太明顯，但她開始更常注意他是不是又把自己逼太緊。'
          : '海注意到 Alan 又來找她整理世界脈絡；她的語氣仍然輕鬆，但關心變得更私人了一點。',
    };
  }
  if (targetName === 'Mahiru Shiina') {
    return {
      delta:
        mode === 'care'
          ? { trust: 3, comfort: 5, emotionalCloseness: 3 }
          : { comfort: 2, trust: 2, emotionalCloseness: 1 },
      narrative:
        mode === 'care'
          ? '真晝在 Alan 的關心裡感到安心；她仍然溫柔，但比較願意承認自己也會累。'
          : '真晝感覺 Alan 願意停下來聽人說話，這讓她對他的世界多了一點安心感。',
    };
  }
  if (targetName === 'Mai') {
    return {
      delta:
        mode === 'deepTalk'
          ? { curiosity: 5, admiration: 3, emotionalCloseness: 2 }
          : { curiosity: 3, admiration: 2, emotionalTension: 1 },
      narrative: '麻衣沒有直接表現親近，但她開始對 Alan 為什麼這樣建世界產生更私人、更難忽略的好奇。',
    };
  }
  if (targetName === 'CaoCao') {
    return {
      delta: { admiration: 3, respect: 2, emotionalTension: 3, curiosity: 2 },
      narrative: '曹操對 Alan 的興趣更強了；那不是親近，而是戰略尊重與理念張力同時上升。',
    };
  }
  if (targetName === 'Liu Bei') {
    return {
      delta: { trust: 3, comfort: 2, concern: 2 },
      narrative: '劉備更願意相信 Alan 會把人放進決策裡，也更在意 Alan 是否能維持共同體的溫度。',
    };
  }
  if (targetName === 'Asuna') {
    return {
      delta: { trust: 2, admiration: 2, concern: 2, dependency: 1 },
      narrative: '明日奈感覺 Alan 開始看見執行負擔；她不會多說，但那讓她比較願意把壓力攤開。',
    };
  }
  return {
    delta: { trust: 1, comfort: 1, curiosity: 1 },
    narrative: `${displayNameZh(targetName)}對 Alan 多了一點自然的熟悉感。`,
  };
}

function emotionalSignalForRelationship(
  subjectName: string,
  dimensions: {
    trust: number;
    respect: number;
    affection: number;
    fear: number;
    influence: number;
  } & Partial<ReturnType<typeof relationshipDefaults>>,
  narrative: string,
) {
  const closeness = dimensions.emotionalCloseness ?? dimensions.affection;
  const comfort = dimensions.comfort ?? Math.round((dimensions.trust + dimensions.affection) / 2);
  const concern = dimensions.concern ?? 0;
  const curiosity = dimensions.curiosity ?? 50;
  const admiration = dimensions.admiration ?? dimensions.respect;
  const tension = dimensions.emotionalTension ?? dimensions.fear;
  if (subjectName === 'Umi' && concern >= 18) return '海似乎比以前更常注意 Alan 有沒有休息。';
  if (subjectName === 'Mahiru Shiina' && comfort >= 76) return '真晝在 Alan 面前比較容易放下防備。';
  if (subjectName === 'Mai' && curiosity >= 62) return '麻衣停留在對話裡的時間，比她嘴上承認的更久。';
  if (subjectName === 'CaoCao' && admiration >= 76 && tension >= 28)
    return '曹操對 Alan 的尊重和理念張力正在同時升高。';
  if (subjectName === 'Liu Bei' && dimensions.trust >= 76) return '劉備更願意相信 Alan 會把人放進決策裡。';
  if (narrative.includes('記住') || narrative.includes('關心') || narrative.includes('時間花在自己身上'))
    return narrative;
  if (closeness >= 88 && narrative.includes('對話')) return `${displayNameZh(subjectName)}和 Alan 之間累積出一種更自然的熟悉感。`;
  if (comfort >= 88 && narrative.includes('安心')) return `${displayNameZh(subjectName)}在 Alan 附近顯得比較安心。`;
  return '';
}

async function shiftRelationshipNarrative(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  subjectPlayerId: string,
  objectPlayerId: string,
  narrative: string,
  clock?: Clock,
) {
  const relationship = await ctx.db
    .query('schoolRelationships')
    .withIndex('edge', (q) =>
      q
        .eq('worldId', worldId)
        .eq('subjectPlayerId', subjectPlayerId)
        .eq('objectPlayerId', objectPlayerId),
    )
    .first();
  if (!relationship) return;
  await ctx.db.patch(relationship._id, {
    narrative,
    dimensions: {
      ...relationship.dimensions,
      trust: Math.max(0, relationship.dimensions.trust - 1),
      respect: Math.min(100, relationship.dimensions.respect + 1),
    },
    updatedAt: Date.now(),
  });
  const metadata = timestampMeta(clock ?? currentClockForStatus());
  await ctx.db.insert('schoolNotifications', {
    worldId,
    notificationId: eventId('relationship_change'),
    type: 'relationship_change',
    titleZh: '關係變化',
    contentZh: narrative,
    relatedCharacterName: subjectPlayerId,
    createdAt: metadata.createdAtUnix,
    ...metadata,
  });
}

function defaultProfile(name: string) {
  const profile = name === 'Alan' ? AlanProfile : GiisProfiles.find((p) => p.name === name);
  const fallback = GiisProfiles[GiisProfiles.length - 1];
  const selected = profile ?? fallback;
  return {
    persona: selected.persona,
    role: selected.role,
    coreValues: selected.coreValues,
    communicationStyle: selected.communicationStyle,
    goals: selected.initialGoals,
    beliefs: selected.initialBeliefs,
    initialRelationships: relationshipsForProfile(selected.initialRelationships),
  };
}

function relationshipDefaults(dimensions: RelationshipDimensions) {
  const affection = dimensions.affection ?? 0;
  const trust = dimensions.trust ?? 50;
  const respect = dimensions.respect ?? 50;
  return {
    trust,
    respect,
    affection,
    fear: dimensions.fear ?? 0,
    influence: dimensions.influence ?? 50,
    comfort: dimensions.comfort ?? Math.round((trust + affection) / 2),
    admiration: dimensions.admiration ?? respect,
    concern: typeof dimensions.concern === 'number' ? dimensions.concern : 0,
    emotionalCloseness: dimensions.emotionalCloseness ?? affection,
    curiosity: dimensions.curiosity ?? 50,
    dependency: dimensions.dependency ?? 0,
    jealousy: dimensions.jealousy ?? 0,
    emotionalTension: dimensions.emotionalTension ?? dimensions.fear ?? 0,
  };
}

function relationshipsForProfile(relationships: Record<string, RelationshipDimensions>) {
  return Object.entries(relationships).map(([targetName, dimensions]) => ({
    targetName,
    dimensions: relationshipDefaults(dimensions),
    cautious: dimensions.cautious,
    concern: dimensions.concernNote,
    narrative: `${targetName}: trust ${dimensions.trust ?? 50}, respect ${
      dimensions.respect ?? 50
    }${dimensions.cautious ? ', cautious' : ''}${dimensions.concernNote ? `, concern: ${dimensions.concernNote}` : ''}`,
  }));
}

function replaceLegacyStudentA(text: string) {
  return text.replace(/\bStudentA\b/g, 'Mahiru Shiina');
}

function normalizeLegacyLocationText(text: string) {
  return text
    .replace(/午餐區/g, '中央庭院')
    .replace(/社團活動區/g, '餐廳')
    .replace(/學生會角落/g, '校長室')
    .replace(/AI 社團室/g, '餐廳')
    .replace(/學生會室/g, '校長室')
    .replace(/自由活動區/g, '宿舍')
    .replace(/教室主區/g, '教室')
    .replace(/教室區/g, '教室');
}

function normalizeDebugEventText(text: string) {
  return text
    .replace(/談到 AI 社時，幾個人會先停一下，像是在確認自己能不能說真話。/g, '有人說「沒事」時，會先停一下，像是在確認自己能不能說真話。')
    .replace(/確認誰因 AI 社、傳聞或派系壓力而不敢說真心話/g, '確認誰因傳聞、壓力或太快說沒事而不敢說真心話')
    .replace(/海會建議 Alan 先關心學生狀態，麻衣會把問題連到規則不清，曹操會看見秩序空缺，劉備會想聽見安靜學生的聲音。/g, '海會建議 Alan 先關心學生狀態，麻衣會戳破太快說出口的沒事，曹操會看見房間秩序，劉備會想聽見安靜學生的聲音。')
    .replace(
      /(.+?) 結束與 (.+?) 的對話後，形成意圖：「(.+?)」。/g,
      (_match, actor, _target, intention) => `${displayNameZh(actor)}把一段對話收斂成下一步：${intention}。`,
    )
    .replace(
      /(.+?)在(.+?)執行意圖：「(.+?)」，(.+)/g,
      (_match, actor, location, intention, detail) =>
        `${displayNameZh(actor)}在${location}開始行動：${detail || intention}`,
    )
    .replace(/conversationOutcome/g, '對話後的決定')
    .replace(/形成意圖/g, '做出決定')
    .replace(/執行意圖/g, '開始行動')
    .replace(/重大校園事件/g, '校園焦點')
    .replace(/主線事件/g, '校園大事')
    .replace(/宏大的主線/g, '過大的議題')
    .replace(/AI 社主線/g, 'AI 社議題')
    .replace(/明天的主線/g, '明天的重點')
    .replace(/變成主線/g, '變成校園焦點')
    .replace(/如果最近的事件自然相關，可以輕輕帶過；不要把它當成唯一話題。/g, '')
    .replace(/我們不只要記住，還要判斷力量會流向哪裡。/g, '我在想，大家真正害怕的不是規則本身。')
    .replace(/真正危險的不是 AI 社，而是沒有人知道它最後會變成什麼。/g, '真正讓人不安的，是大家不知道自己會被帶到哪裡。')
    .replace(/真正危險的不是 AI 社，而是沒有人知道 AI 社最後會變成什麼。/g, '真正讓人不安的，是大家不知道自己會被帶到哪裡。')
    .replace(/我先去處理校務，(.+?)，晚點再聊。/g, '我先去整理一下，$1，晚點再聊。')
    .replace(/海把這段對話整理成校長簡報：Alan 下一步不能只加功能，要先處理人心和規則。/g, '海決定先提醒 Alan：功能可以慢慢加，但學生的不安要先被看見。')
    .replace(/Alan 下一步不能只加功能，要先處理人心和規則。/g, '功能可以慢慢加，但學生的不安要先被看見。')
    .replace(/ 我會把它整理成 Alan 看得懂的世界脈絡和下一步，順便提醒他別一個人扛。/g, '')
    .replace(/ 我會先確認誰已經改變立場。秩序不會自己出現，總要有人負責。/g, '')
    .replace(/ 我會先去確認學生們是不是開始害怕說錯話，尤其是那些說自己沒事的人。/g, '')
    .replace(/接下來可能把這個決定變成行動：/g, '接下來可能會')
    .replace(/這段對話不只被記住，也轉化成後續可能執行的行動。/g, '這段對話留下了後續選擇。');
}

function naturalizeSchoolText(text?: string) {
  if (!text) return text;
  return displayTextZh(normalizeDebugEventText(normalizeLegacyLocationText(text)));
}

function trimZhSentence(text?: string) {
  return (text ?? '').replace(/[。；\s]+$/g, '');
}

function compactBriefingEventZh(event: { type?: string; descriptionZh: string; futureImplicationsZh?: string }) {
  const text = trimZhSentence(naturalizeSchoolText(event.descriptionZh) ?? event.descriptionZh);
  if (event.type === 'dailyMemoryConsolidation' || text.includes('日終整理')) {
    return compactDailyMemoryDescription(text);
  }
  if (text.length <= 72) return text;
  return `${text.slice(0, 70)}…`;
}

function compactDailyMemoryDescription(text: string) {
  const body = text.includes('日終整理：') ? text.split('日終整理：').at(-1) ?? text : text;
  const fragments = body
    .split(/[；。]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const named = [
    fragments.find((item) => item.includes('真晝') && (item.includes('安靜') || item.includes('真心話'))),
    fragments.find((item) => item.includes('麻衣') && (item.includes('風險') || item.includes('理解'))),
    fragments.find((item) => item.includes('曹操') && item.includes('邊界')),
    fragments.find((item) => item.includes('明日奈') && (item.includes('負擔') || item.includes('下一步'))),
    fragments.find((item) => item.includes('劉備') && (item.includes('排除') || item.includes('午餐'))),
  ].filter((item): item is string => Boolean(item));
  const picked = compactUnique(named.length ? named : fragments, 3);
  return picked.length
    ? `昨天留下幾個痕跡：${picked.join('；')}`
    : '昨天留下了一些沒有完全說完的情緒與關係變化';
}

function compactBriefingRisk(text?: string) {
  const cleaned = trimZhSentence(naturalizeBriefingRisk(text) ?? '');
  if (!cleaned) return cleaned;
  if (cleaned.includes('真晝注意到學生最近說話變得比較小心')) {
    return '學生變安靜，明天可能還需要有人先把話放慢一點';
  }
  if (cleaned.length <= 80) return cleaned;
  return `${cleaned.slice(0, 78)}…`;
}

function naturalizeBriefingRisk(text?: string) {
  const cleaned = trimZhSentence(naturalizeSchoolText(text) ?? '');
  if (
    cleaned.includes('海會建議 Alan 先關心學生狀態') &&
    cleaned.includes('劉備會想聽見安靜學生的聲音')
  ) {
    return '學生的安靜可能正在變成壓力；我想先讓你看見這點，麻衣會戳破太快說出口的沒事，曹操會注意房間裡的位置，劉備則會在意那些不敢開口的人';
  }
  return cleaned;
}

function displayWorldEvent<
  T extends {
    descriptionZh: string;
    locationId?: string;
    locationZh?: string;
    createdAt?: number;
    clock?: Clock;
    createdAtIso?: string;
    createdAtTimeZone?: string;
    worldTimeLabelZh?: string;
  },
>(event: T) {
  const location =
    SchoolLocations.find((item) => item.id === event.locationId) ??
    SchoolLocations.find((item) => item.id === 'classroom')!;
  const knownLocation = SchoolLocations.some((item) => item.id === event.locationId);
  return {
    ...event,
    descriptionZh: naturalizeSchoolText(event.descriptionZh) ?? '',
    interpretationZh: naturalizeSchoolText((event as { interpretationZh?: string }).interpretationZh),
    reactionDialogueZh: naturalizeSchoolText((event as { reactionDialogueZh?: string }).reactionDialogueZh),
    futureImplicationsZh: naturalizeSchoolText((event as { futureImplicationsZh?: string }).futureImplicationsZh),
    locationId: knownLocation ? event.locationId : location.id,
    locationZh: location.labelZh,
    createdAtUnix: event.createdAt,
    createdAtIso: event.createdAtIso ?? (event.createdAt ? new Date(event.createdAt).toISOString() : undefined),
    createdAtTimeZone: event.createdAtTimeZone ?? 'America/Chicago',
    worldTimeLabelZh:
      !event.worldTimeLabelZh || event.worldTimeLabelZh.includes('週')
        ? event.clock
          ? worldTimeLabelZh(event.clock)
          : event.worldTimeLabelZh
        : event.worldTimeLabelZh,
  };
}

function toSecondPersonAlanEvent(descriptionZh: string) {
  return normalizeLegacyLocationText(descriptionZh)
    .replace(/^Alan 在公開場合踢了 /, '你剛才踢了 ')
    .replace(/^Alan 指派 /, '你指派 ')
    .replace(/^Alan 公告：/, '你發布公告：')
    .replace(/^Alan 發起新社團：/, '你發起新社團：')
    .replace(/^Alan 邀請 /, '你邀請 ')
    .replace(/^Alan 送給 /, '你送給 ')
    .replace(/^Alan 主動找 /, '你主動找 ')
    .replace(/^Alan 站在校園裡/, '你站在校園裡')
    .replace(/^Alan 觀察了接下來 /, '你觀察了接下來 ')
    .replace(/^Alan 推進世界時間 /, '你讓校園發生了新的變化 ');
}

function cleanLegacyMemories(items: string[]) {
  return uniqueTextItems(items.map(normalizeLegacyProfileText)).slice(0, 24);
}

function cleanLegacyIntentions(items?: string[]) {
  return uniqueTextItems((items ?? []).map(normalizeLegacyProfileText)).slice(0, 8);
}

function normalizeLegacyProfileText(text: string) {
  return naturalizeSchoolText(replaceLegacyStudentA(text))
    ?.replace(/組織公開討論，避免學生因立場不同而被排除/g, '先找被排除的學生聊聊，避免沉默變成孤立')
    .replace(/組織公開討論，避免學生被排除在外/g, '先找被排除的學生聊聊，避免沉默變成孤立')
    .replace(/拉回公開合作/g, '拉回彼此願意說真話的狀態')
    .replace(/把對話結論整理成 Alan 能理解的世界脈絡、情緒風險與下一步/g, '把真正需要 Alan 先看見的情緒風險整理出來')
    .replace(/海把這段對話整理成校長簡報：Alan 下一步不能只加功能，要先處理人心和規則。/g, '海決定先提醒 Alan：功能可以慢慢加，但學生的不安要先被看見。')
    .trim() ?? '';
}

function uniqueTextItems(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = displayTextZh(item).trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function resolvedRole(currentRole: string, defaultRole: string) {
  const legacyRoles = new Set([
    'Student',
    'Assistant Principal',
    'Executive Assistant',
    'Strategy Advisor',
    'Student Politician',
    'Principal / Student',
  ]);
  const knownProfileRoles = new Set(GiisProfiles.map((profile) => profile.role));
  if (legacyRoles.has(currentRole)) return defaultRole;
  if (knownProfileRoles.has(currentRole) && currentRole !== defaultRole) return defaultRole;
  return currentRole;
}

function looksLikeDifferentProfile(profile: Doc<'schoolProfiles'>, defaultRole: string) {
  return GiisProfiles.some(
    (knownProfile) => knownProfile.role === profile.role && knownProfile.role !== defaultRole,
  );
}

async function patchProfileDefaults(
  ctx: MutationCtx,
  profile: Doc<'schoolProfiles'>,
  name: string,
) {
  const defaults = defaultProfile(name);
  const profileChangedIdentity = looksLikeDifferentProfile(profile, defaults.role);
  await ctx.db.patch(profile._id, {
    persona: defaults.persona,
    role: resolvedRole(profile.role, defaults.role),
    coreValues: defaults.coreValues,
    communicationStyle: defaults.communicationStyle,
    goals: defaults.goals,
    beliefs: profileChangedIdentity ? defaults.beliefs : cleanLegacyMemories(profile.beliefs),
    shortTermIntentions: profileChangedIdentity ? [] : cleanLegacyIntentions(profile.shortTermIntentions),
    shortTermMemory: profileChangedIdentity ? [] : cleanLegacyMemories(profile.shortTermMemory),
    longTermMemory: profileChangedIdentity ? [] : cleanLegacyMemories(profile.longTermMemory),
    initialRelationships: defaults.initialRelationships,
  });
}

async function upsertProfile(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  player: PlayerDoc,
  name: string,
) {
  const existing = await ctx.db
    .query('schoolProfiles')
    .withIndex('player', (q) => q.eq('worldId', worldId).eq('playerId', player.id))
    .first();
  const profile = defaultProfile(name);
  if (existing) {
    await patchProfileDefaults(ctx, existing, name);
    return (await ctx.db.get(existing._id))!;
  }
  const id = await ctx.db.insert('schoolProfiles', {
    worldId,
    playerId: player.id,
    ...profile,
    shortTermIntentions: [],
    shortTermMemory: [],
    longTermMemory: [],
    communicationStyle: profile.communicationStyle,
    initialRelationships: profile.initialRelationships,
  });
  return (await ctx.db.get(id))!;
}

async function ensureGiisRoster(ctx: MutationCtx, worldId: Id<'worlds'>, world: Doc<'worlds'>) {
  if (world.agents.length < GiisProfiles.length) {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .first();
    const pendingCreateAgents = worldStatus
      ? await ctx.db
          .query('inputs')
          .withIndex('byInputNumber', (q) => q.eq('engineId', worldStatus.engineId))
          .filter((q) => q.eq(q.field('name'), 'createAgent'))
          .filter((q) => q.eq(q.field('returnValue'), undefined))
          .collect()
      : [];
    const existingAndPending = world.agents.length + pendingCreateAgents.length;
    for (let i = existingAndPending; i < GiisProfiles.length; i++) {
      await insertInput(ctx, worldId, 'createAgent', { descriptionIndex: i });
    }
  }
  const agents = [...world.agents].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < Math.min(agents.length, GiisProfiles.length); i++) {
    const agent = agents[i];
    const description = GiisProfiles[i];
    const playerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('playerId', agent.playerId))
      .first();
    if (
      playerDescription &&
      (playerDescription.name !== description.name ||
        playerDescription.character !== description.character ||
        playerDescription.description !== description.identity)
    ) {
      await ctx.db.patch(playerDescription._id, {
        name: description.name,
        character: description.character,
        description: description.identity,
      });
    }
    const agentDescription = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('agentId', agent.id))
      .first();
    if (
      agentDescription &&
      (agentDescription.identity !== description.identity ||
        agentDescription.plan !== description.plan)
    ) {
      await ctx.db.patch(agentDescription._id, {
        identity: description.identity,
        plan: description.plan,
      });
    }
    const profile = await ctx.db
      .query('schoolProfiles')
      .withIndex('player', (q) => q.eq('worldId', worldId).eq('playerId', agent.playerId))
      .first();
    if (profile) {
      const defaults = defaultProfile(description.name);
      const beliefSet = new Set([...defaults.beliefs, ...profile.beliefs]);
      await ctx.db.patch(profile._id, {
        persona: defaults.persona,
        role: resolvedRole(profile.role, defaults.role),
        coreValues: defaults.coreValues,
        communicationStyle: defaults.communicationStyle,
        goals: defaults.goals,
        beliefs: cleanLegacyMemories([...beliefSet]).slice(0, 12),
        shortTermMemory: cleanLegacyMemories(profile.shortTermMemory),
        longTermMemory: cleanLegacyMemories(profile.longTermMemory),
        initialRelationships: defaults.initialRelationships,
      });
    }
  }
}

function playerIdNumber(id: string) {
  return Number(id.replace(/^p:/, '')) || 0;
}

function chooseAlanPlayer(players: PlayerDoc[], descriptions: Map<string, Doc<'playerDescriptions'>>) {
  const alanPlayers = players.filter((player) => descriptions.get(player.id)?.name === DEFAULT_NAME);
  return [...alanPlayers].sort((a, b) => {
    const aScore = (a.human === DEFAULT_NAME ? 10_000_000 : a.human ? 5_000_000 : 0) + playerIdNumber(a.id);
    const bScore = (b.human === DEFAULT_NAME ? 10_000_000 : b.human ? 5_000_000 : 0) + playerIdNumber(b.id);
    return bScore - aScore;
  })[0];
}

function nextPlayerId(players: PlayerDoc[]) {
  const maxId = players.reduce((max, player) => Math.max(max, playerIdNumber(player.id)), 0);
  return `p:${maxId + 1}` as PlayerDoc['id'];
}

async function ensureAlanPlayer(
  ctx: MutationCtx,
  world: Doc<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  clock: Clock,
) {
  const existing = chooseAlanPlayer(world.players, descriptions);
  if (existing) return existing;
  const existingDescription = [...descriptions.values()]
    .filter((description) => description.name === DEFAULT_NAME)
    .sort((a, b) => b._creationTime - a._creationTime)[0];
  const alanPlayer = {
    id: (existingDescription?.playerId as PlayerDoc['id']) ?? nextPlayerId(world.players),
    human: DEFAULT_NAME,
    lastInput: Date.now(),
    position: clampToClassroom(sceneSpawnPointWithPresence(schoolLocationForClock(clock).id, 0, DEFAULT_NAME)),
    facing: { dx: 0, dy: 1 },
    speed: 0,
  } as PlayerDoc;
  if (!existingDescription) {
    await ctx.db.insert('playerDescriptions', {
      worldId: world._id,
      playerId: alanPlayer.id,
      name: DEFAULT_NAME,
      character: AlanProfile.character,
      description: AlanProfile.persona,
    });
  }
  await ctx.db.patch(world._id, {
    players: [alanPlayer, ...world.players],
  });
  return alanPlayer;
}

function targetLocationForRepairedPlayer(name: string, clock: Clock, index: number) {
  const scheduledLocation = scheduledLocationForName(name, clock);
  if (scheduledLocation) return scheduledLocation;
  const fallbackLocations = SchoolLocations.filter((location) => location.id !== 'studentCouncilRoom');
  return fallbackLocations[index % fallbackLocations.length].id;
}

function scheduledLocationForName(name: string, clock: Clock): Parameters<typeof sceneSpawnPoint>[0] {
  const defaultLocation = schoolLocationForClock(clock).id;
  if (name === 'Alan') return defaultLocation;
  if (
    process.env.UMI_MAHIRU_COLOCATION_PILOT === 'true' &&
    (name === 'Umi' || name === 'Mahiru Shiina')
  ) {
    return 'dormitory';
  }
  if (clock.hour >= 21 || clock.hour < 6) return 'dormitory';
  if (clock.hour >= 6 && clock.hour < 9) return name === 'Asuna' ? 'classroom' : 'dormitory';
  if (clock.hour >= 9 && clock.hour < 12) return 'classroom';
  if (clock.hour === 12 || (clock.hour === 13 && (clock.minute ?? 0) < 30)) return 'courtyard';
  if (clock.hour >= 13 && clock.hour < 17) {
    if (name === 'Umi') return 'studentCouncilRoom';
    if (name === 'Mai' || name === 'Asuna') return 'aiClubRoom';
    if (name === 'CaoCao') return 'courtyard';
    if (name === 'Liu Bei') return 'courtyard';
    if (name === 'Mahiru Shiina') return 'dormitory';
    return defaultLocation;
  }
  if (rhythmName(clock.hour) === '晚上') {
    if (name === 'Umi') return 'studentCouncilRoom';
    if (name === 'CaoCao') return 'courtyard';
    if (name === 'Mahiru Shiina') return 'dormitory';
    return 'courtyard';
  }
  return defaultLocation;
}

function sceneSpawnPointWithPresence(locationId: Parameters<typeof sceneSpawnPoint>[0], index: number, name = '') {
  const primaryAnchor = sceneSpawnPoint(locationId, index);
  if (index < 6) return primaryAnchor;
  const ringOffsets = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
  ];
  const anchorIndex = Math.floor(index / ringOffsets.length);
  const offset = ringOffsets[index % ringOffsets.length];
  const base = sceneSpawnPoint(locationId, anchorIndex);
  const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), index * 17);
  const offsetX = offset.x + ((seed % 5) - 2) * 0.05;
  const offsetY = offset.y + (((Math.floor(seed / 5) % 5) - 2) * 0.05);
  return {
    x: base.x + offsetX,
    y: base.y + offsetY,
  };
}

function repairedSchoolPlayers(
  players: PlayerDoc[],
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  keepPlayerIds: Set<string>,
  requiredAgentNames: string[],
  clock: Clock,
) {
  const locationCounters = new Map<string, number>();
  const order = [DEFAULT_NAME, ...requiredAgentNames];
  const repairedPlayers = players
    .filter((player) => keepPlayerIds.has(player.id))
    .sort((a, b) => {
      const aName = descriptions.get(a.id)?.name ?? '';
      const bName = descriptions.get(b.id)?.name ?? '';
      return order.indexOf(aName) - order.indexOf(bName);
    })
    .map((player, index) => {
      const { pathfinding: _pathfinding, activity: _activity, ...rest } = player;
      const name = descriptions.get(player.id)?.name ?? '';
      const locationId = targetLocationForRepairedPlayer(name, clock, index);
      const count = locationCounters.get(locationId) ?? 0;
      locationCounters.set(locationId, count + 1);
      return {
        ...rest,
        human: name === DEFAULT_NAME ? DEFAULT_NAME : undefined,
        position: clampToClassroom(sceneSpawnPointWithPresence(locationId, count, name)),
        speed: 0,
        activity: name === DEFAULT_NAME ? undefined : {
          description: '正在安定到目前場景',
          emoji: '…',
          until: Date.now() + 90_000,
        },
      };
    });
  return { repairedPlayers, locationCounters };
}

async function deleteProfilesForPlayer(ctx: MutationCtx, worldId: Id<'worlds'>, removedPlayerId: string) {
  const profiles = await ctx.db
    .query('schoolProfiles')
    .withIndex('player', (q) => q.eq('worldId', worldId).eq('playerId', removedPlayerId))
    .collect();
  for (const profile of profiles) await ctx.db.delete(profile._id);
}

async function deleteRelationshipsForMissingPlayers(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  keepPlayerIds: Set<string>,
) {
  const relationships = await ctx.db
    .query('schoolRelationships')
    .withIndex('subject', (q) => q.eq('worldId', worldId))
    .collect();
  for (const relationship of relationships) {
    if (!keepPlayerIds.has(relationship.subjectPlayerId) || !keepPlayerIds.has(relationship.objectPlayerId)) {
      await ctx.db.delete(relationship._id);
    }
  }
}

async function ensureStoredProfileDefaults(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
) {
  const profiles = await ctx.db
    .query('schoolProfiles')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();
  for (const profile of profiles) {
    const name = descriptions.get(profile.playerId)?.name;
    if (name) await patchProfileDefaults(ctx, profile, name);
  }
}

async function ensureInitialRelationships(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
) {
  const byName = new Map(
    [...descriptions.values()].map((description) => [description.name, description]),
  );
  const profiles = await ctx.db
    .query('schoolProfiles')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();
  for (const profile of profiles) {
    const sourceName = descriptions.get(profile.playerId)?.name;
    const defaults = sourceName ? defaultProfile(sourceName) : null;
    const relationships = profile.initialRelationships ?? defaults?.initialRelationships ?? [];
    for (const relationship of relationships) {
      const target = byName.get(relationship.targetName);
      if (!target || target.playerId === profile.playerId) continue;
      const existing = await ctx.db
        .query('schoolRelationships')
        .withIndex('edge', (q) =>
          q
            .eq('worldId', worldId)
            .eq('subjectPlayerId', profile.playerId)
            .eq('objectPlayerId', target.playerId),
        )
        .first();
      const doc = {
        worldId,
        subjectPlayerId: profile.playerId,
        objectPlayerId: target.playerId,
        dimensions: relationship.dimensions,
        narrative: relationship.narrative,
        updatedAt: Date.now(),
      };
      if (existing) {
        await ctx.db.patch(existing._id, {
          dimensions: doc.dimensions,
          narrative: doc.narrative,
          updatedAt: doc.updatedAt,
        });
      } else {
        await ctx.db.insert('schoolRelationships', doc);
      }
    }
  }
}

async function dedupeDocsByField<T extends { _id: Id<any>; _creationTime: number }>(
  ctx: MutationCtx,
  docs: T[],
  keyForDoc: (doc: T) => string,
) {
  const groups = new Map<string, T[]>();
  for (const doc of docs) {
    const key = keyForDoc(doc);
    groups.set(key, [...(groups.get(key) ?? []), doc]);
  }
  const removedIds = new Set<Id<any>>();
  let count = 0;
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const [keep, ...duplicates] = [...group].sort((a, b) => b._creationTime - a._creationTime);
    void keep;
    for (const duplicate of duplicates) {
      await ctx.db.delete(duplicate._id);
      removedIds.add(duplicate._id);
      count += 1;
    }
  }
  return { count, removedIds };
}

async function deleteObviousDuplicateSchoolRecords(ctx: MutationCtx, worldId: Id<'worlds'>) {
  const events = await ctx.db
    .query('worldEvents')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .order('desc')
    .take(200);
  const eventKeys = new Set<string>();
  let removedEvents = 0;
  let normalizedEventSources = 0;
  for (const event of events) {
    if (event.source === 'agent_action') {
      await ctx.db.patch(event._id, { source: 'autonomous_agent_action' });
      normalizedEventSources += 1;
    }
    if (event.source === 'player_action') continue;
    const key = [
      event.type,
      event.actorName ?? '',
      event.targetName ?? '',
      event.source === 'agent_action' ? 'autonomous_agent_action' : event.source ?? '',
      event.locationId ?? '',
      displayTextZh(event.descriptionZh).trim(),
    ].join('|');
    if (eventKeys.has(key)) {
      await ctx.db.delete(event._id);
      removedEvents += 1;
      continue;
    }
    eventKeys.add(key);
  }

  const notifications = await ctx.db
    .query('schoolNotifications')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .order('desc')
    .take(200);
  const notificationKeys = new Set<string>();
  let removedNotifications = 0;
  for (const notification of notifications) {
    const normalizedContent = displayTextZh(notification.contentZh).trim();
    const isBrokenMaintenanceNotification =
      normalizedContent.includes('校園傳聞：海深夜未眠') ||
      normalizedContent.includes('形成意圖：「');
    const key = [
      notification.type,
      notification.relatedCharacterName ?? '',
      normalizedContent,
    ].join('|');
    if (isBrokenMaintenanceNotification || notificationKeys.has(key)) {
      await ctx.db.delete(notification._id);
      removedNotifications += 1;
      continue;
    }
    notificationKeys.add(key);
  }

  const rumors = await ctx.db
    .query('schoolRumors')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .order('desc')
    .take(200);
  const rumorKeys = new Set<string>();
  let removedRumors = 0;
  for (const rumor of rumors) {
    const normalizedContent = displayTextZh(rumor.contentZh).trim();
    const isNightMaintenanceRumor =
      normalizedContent.includes('深夜未眠') ||
      normalizedContent.includes('校長簡報') ||
      normalizedContent.includes('形成意圖：「');
    if (isNightMaintenanceRumor || rumorKeys.has(normalizedContent)) {
      await ctx.db.delete(rumor._id);
      removedRumors += 1;
      continue;
    }
    rumorKeys.add(normalizedContent);
  }

  return {
    removedEvents,
    removedNotifications,
    removedRumors,
    normalizedEventSources,
  };
}

async function appendMemory(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  playerIdValue: string,
  shortTerm: string,
  belief?: string,
) {
  const profile = await ctx.db
    .query('schoolProfiles')
    .withIndex('player', (q) => q.eq('worldId', worldId).eq('playerId', playerIdValue))
    .first();
  if (!profile) return;
  const shortTermMemory = [shortTerm, ...profile.shortTermMemory].slice(0, 12);
  const longTermMemory =
    profile.shortTermMemory.length >= 6
      ? [profile.shortTermMemory[profile.shortTermMemory.length - 1], ...profile.longTermMemory]
          .filter(Boolean)
          .slice(0, 24)
      : profile.longTermMemory;
  const beliefs = belief ? [belief, ...profile.beliefs].slice(0, 12) : profile.beliefs;
  await ctx.db.patch(profile._id, { shortTermMemory, longTermMemory, beliefs });
}

async function appendIntention(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  playerIdValue: string,
  intention: string,
) {
  const profile = await ctx.db
    .query('schoolProfiles')
    .withIndex('player', (q) => q.eq('worldId', worldId).eq('playerId', playerIdValue))
    .first();
  if (!profile) return;
  const intentions = [intention, ...(profile.shortTermIntentions ?? [])]
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, 6);
  await ctx.db.patch(profile._id, { shortTermIntentions: intentions });
}

function conversationIntentionFor(name: string, otherName: string, summary: string) {
  const lower = summary.toLowerCase();
  switch (name) {
    case 'CaoCao':
      if (lower.includes('劉備') || otherName === 'Liu Bei')
        return '測試劉備的理想主義是否能承擔秩序壓力';
      return '觀察誰因 AI 社改變立場並建立學生會秩序網絡';
    case 'Liu Bei':
      return '先找被排除的學生聊聊，避免沉默變成孤立';
    case 'Mai':
      return lower.includes('ai') || lower.includes('社')
        ? '提出 AI 社風險分析與邊界建議'
        : '整理一份權力風險提醒';
    case 'Umi':
      return '把真正需要 Alan 先看見的情緒風險整理出來';
    case 'Mahiru Shiina':
      return '確認誰因 AI 社、傳聞或派系壓力而不敢說真心話';
    case 'Asuna':
      return '把對話結果排成負責人與下一步';
    default:
      return `延伸與 ${otherName} 的對話結論`;
  }
}

function outcomeTypeFor(name: string) {
  switch (name) {
    case 'CaoCao':
      return 'alliance';
    case 'Liu Bei':
      return 'invitation';
    case 'Mai':
      return 'eventProposal';
    case 'Umi':
    case 'Asuna':
      return 'plan';
    case 'Mahiru Shiina':
      return 'intention';
    default:
      return 'intention';
  }
}

type ConversationOutcomeQuality =
  | 'meaningful_new_information'
  | 'relationship_shift'
  | 'concrete_action'
  | 'emotional_residue'
  | 'repeated_noise';

function conversationOutcomeQualityFor(summary: string, decisionZh: string): ConversationOutcomeQuality {
  const text = `${summary}\n${decisionZh}`;
  const normalized = text
    .toLowerCase()
    .replace(/[，。！？、,.!?「」"'\s]/g, '');
  const repeatedMarkers = [
    '我知道今天的氣氛沒有完全安靜下來',
    '我先去整理一下',
    '晚點再聊',
    '再講下去不一定會更清楚只會更累',
    '功能可以慢慢加但學生的不安要先被看見',
  ];
  if (repeatedMarkers.some((marker) => normalized.includes(marker.replace(/[，。！？、,.!?「」"'\s]/g, '')))) {
    return 'repeated_noise';
  }
  if (/決定|明天|今晚|去|找|邀請|確認|列出|排出|公告|提醒|負責人|下一步/.test(text)) {
    return 'concrete_action';
  }
  if (/開始|變得|信任|距離|靠近|擔心|在意|尊重|失望|關係/.test(text)) {
    return 'relationship_shift';
  }
  if (/累|沉默|安靜|不敢說|害怕|孤單|不安|尷尬|沒睡|休息/.test(text)) {
    return 'emotional_residue';
  }
  if (/發現|知道|透露|承認|說出|注意到/.test(text)) {
    return 'meaningful_new_information';
  }
  return 'repeated_noise';
}

function importanceForConversationOutcome(quality: ConversationOutcomeQuality) {
  switch (quality) {
    case 'concrete_action':
      return 6;
    case 'relationship_shift':
    case 'meaningful_new_information':
      return 5;
    case 'emotional_residue':
      return 4;
    case 'repeated_noise':
      return 2;
  }
}

function conversationDecisionPhrase(name: string, otherName: string, intention: string) {
  if (name === 'CaoCao') {
    return `曹操沒有正面回答 ${displayNameZh(otherName)}，但他決定觀察明天誰會支持 Alan 的 AI 社邊界。`;
  }
  if (name === 'Liu Bei') {
    return `劉備決定明天午餐時找真晝和麻衣一起聽學生意見，因為他擔心安靜的人正在被排除。`;
  }
  if (name === 'Mai') {
    return `麻衣暫時不表態，但她開始懷疑 Alan 建得比自己理解得更快，決定先列出 AI 社的風險邊界。`;
  }
  if (name === 'Umi') {
    return `海決定先提醒 Alan：功能可以慢慢加，但學生的不安要先被看見。`;
  }
  if (name === 'Mahiru Shiina') {
    return `真晝決定今晚先去宿舍確認幾位學生的狀態，因為她聽見有人開始不敢說真心話。`;
  }
  if (name === 'Asuna') {
    return `明日奈把對話收斂成負責人與下一步；她擔心再沒人接住執行負擔，校務會散掉。`;
  }
  return `${displayNameZh(name)} 將對話收斂成下一步：${intention}`;
}

export const recordConversationOutcome = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    otherPlayerId: playerId,
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const totalStart = Date.now();
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    const world = await ctx.db.get(args.worldId);
    if (!worldStatus || !world) return;
    const descriptions = await descriptionsByPlayer(ctx.db, args.worldId);
    const playerName = descriptions.get(args.playerId)?.name ?? args.playerId;
    const otherName = descriptions.get(args.otherPlayerId)?.name ?? args.otherPlayerId;
    const intention = conversationIntentionFor(playerName, otherName, args.summary);
    const decisionZh = conversationDecisionPhrase(playerName, otherName, intention);
    const isUmiMahiruOutcome =
      new Set([playerName, otherName]).has('Umi') &&
      new Set([playerName, otherName]).has('Mahiru Shiina');
    if (
      isUmiMahiruOutcome &&
      (isGeneratedFallbackText(intention) || isGeneratedFallbackText(decisionZh))
    ) {
      logGiisTiming({
        action: 'recordConversationOutcome',
        phase: 'skipGeneratedFallbackOutcome',
        actor: playerName,
        target: otherName,
      });
      return { intention, outcomeType: outcomeTypeFor(playerName), skipped: true };
    }
    const outcomeQuality = conversationOutcomeQualityFor(args.summary, decisionZh);
    if (outcomeQuality !== 'repeated_noise') {
      await appendIntention(ctx, args.worldId, args.playerId, intention);
    }
    const clock = await ensureClock(ctx, worldStatus);
    const location = schoolLocationForClock(clock);
    const eventStart = Date.now();
    await appendRecentEvent(ctx, args.worldId, {
      type: 'conversationOutcome',
      actorPlayerId: args.playerId,
      targetPlayerId: args.otherPlayerId,
      actorName: playerName,
      targetName: otherName,
      source: 'autonomous_agent_action',
      happenedDuringAlanPresence: alanPresence(world, descriptions).status,
      observerPlayerIds: [args.playerId, args.otherPlayerId],
      descriptionZh: decisionZh,
      descriptionEn: `${playerName} formed an intention after a conversation.`,
      locationId: location.id,
      locationZh: location.labelZh,
      interpretationZh: '這段對話不只被記住，也轉化成後續可能執行的行動。',
      reactionDialogueZh: '這段對話留下了選擇，不只是漂亮話。',
      futureImplicationsZh: `${displayNameZh(playerName)} 接下來可能把這個決定變成行動：${intention}`,
      outcomeQuality,
      importance: importanceForConversationOutcome(outcomeQuality),
      clock,
    });
    logGiisTiming({
      action: 'recordConversationOutcome',
      phase: 'timelineUpdateTime',
      ms: Date.now() - eventStart,
      actor: playerName,
      target: otherName,
    });
    const alanCounterpart =
      playerName === DEFAULT_NAME ? otherName : otherName === DEFAULT_NAME ? playerName : undefined;
    if (alanCounterpart) {
      const deepTalk =
        args.summary.includes('累') ||
        args.summary.includes('害怕') ||
        args.summary.includes('秘密') ||
        args.summary.includes('真心') ||
        args.summary.includes('孤單') ||
        args.summary.includes('擔心');
      const signal = emotionalTendencyFor(alanCounterpart, deepTalk ? 'deepTalk' : 'attention');
      await patchRelationshipDelta(
        ctx,
        args.worldId,
        descriptions,
        alanCounterpart,
        DEFAULT_NAME,
        {
          ...signal.delta,
          emotionalCloseness: (signal.delta.emotionalCloseness ?? 0) + (deepTalk ? 2 : 1),
          comfort: (signal.delta.comfort ?? 0) + (deepTalk ? 1 : 0),
        },
        `${signal.narrative} 這段對話之後，${displayNameZh(alanCounterpart)}記住的不只是內容，而是 Alan 願意把時間花在自己身上。`,
        clock,
      );
      const counterpartDescription = [...descriptions.values()].find((item) => item.name === alanCounterpart);
      if (counterpartDescription) {
        await appendMemory(
          ctx,
          args.worldId,
          counterpartDescription.playerId,
          `${displayNameZh(alanCounterpart)}和 Alan 有了一段比較${deepTalk ? '私人' : '自然'}的對話；這會影響之後對 Alan 的語氣與開放程度。`,
        );
      }
    }
    logGiisTiming({
      action: 'recordConversationOutcome',
      phase: 'conversationOutcomeTotalTime',
      ms: Date.now() - totalStart,
      actor: playerName,
      target: otherName,
    });
    return { intention, outcomeType: outcomeTypeFor(playerName) };
  },
});

export const ensureWorldProfiles = internalMutation({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) return;
    await ensureGiisRoster(ctx, args.worldId, world);
    const descriptions = await descriptionsByPlayer(ctx.db, args.worldId);
    for (const player of world.players) {
      const name = descriptions.get(player.id)?.name ?? player.id;
      await upsertProfile(ctx, args.worldId, player, name);
    }
    await ensureStoredProfileDefaults(ctx, args.worldId, descriptions);
    await ensureInitialRelationships(ctx, args.worldId, descriptions);
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (worldStatus) await ensureClock(ctx, worldStatus);
  },
});

export const syncClock = internalMutation({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (!worldStatus) return;
    const clock = await ensureClock(ctx, worldStatus);
    const world = await ctx.db.get(args.worldId);
    if (!world) return;
    const descriptions = await descriptionsByPlayer(ctx.db, args.worldId);
    await moveCharactersForWorldTime(ctx, world, descriptions, clock);
  },
});

async function moveCharactersForWorldTime(
  ctx: MutationCtx,
  world: Doc<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  clock: Clock,
) {
  const locationCounters = new Map<string, number>();
  await ctx.db.patch(world._id, {
    players: world.players.map((player) => {
      const { pathfinding: _pathfinding, ...rest } = player;
      const name = descriptions.get(player.id)?.name ?? '';
      const locationId = scheduledLocationForName(name, clock);
      const count = locationCounters.get(locationId) ?? 0;
      locationCounters.set(locationId, count + 1);
      const activity = name === DEFAULT_NAME ? player.activity : nightActivityForName(name, clock);
      return {
        ...rest,
        activity,
        position: clampToClassroom(sceneSpawnPointWithPresence(locationId, count, name)),
        speed: 0,
      };
    }),
  });
}

async function ensureDailyOpeningEvent(
  ctx: MutationCtx,
  world: Doc<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  clock: Clock,
) {
  const recentDailyEvent = (
    await ctx.db
      .query('worldEvents')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .order('desc')
      .take(30)
  ).find((event) => event.type === 'dailyOpeningFocus' && event.clock?.day === clock.day);
  if (recentDailyEvent) return;
  const mahiru = findPlayerByName(world.players, descriptions, 'Mahiru Shiina');
  const umi = findPlayerByName(world.players, descriptions, 'Umi');
  const observerPlayerIds = world.players.map((player) => player.id);
  const location = SchoolLocations.find((item) => item.id === 'dormitory')!;
  if (mahiru) {
    await appendMemory(
      ctx,
      world._id,
      mahiru.id,
      '真晝注意到幾位學生今天比平常安靜；不是恐慌，只是有人說沒事時會先看別人的表情。',
      '有些不安不是大聲說出來的，而是出現在突然安靜的瞬間。',
    );
  }
  if (umi) {
    await appendMemory(
      ctx,
      world._id,
      umi.id,
      '海把今天的校園焦點整理成一句話：先確認學生是不是安心，再決定今天要處理哪一件小事。',
    );
  }
  await appendRecentEvent(ctx, world._id, {
    type: 'dailyOpeningFocus',
    actorPlayerId: mahiru?.id,
    actorName: 'Mahiru Shiina',
    targetPlayerId: umi?.id,
    targetName: 'Umi',
    source: 'world_simulation_event',
    happenedDuringAlanPresence: 'online',
    observerPlayerIds,
    descriptionZh: '真晝注意到學生今天比平常安靜；有人說「沒事」時，會先停一下，像是在確認自己能不能說真話。',
    descriptionEn: 'Mahiru noticed students becoming quieter when they said they were fine.',
    locationId: location.id,
    locationZh: location.labelZh,
    interpretationZh: '這不是危機，但它是今天的情緒起點：校園開始需要安全感，而不只是更多功能。',
    reactionDialogueZh: '我有點在意……大家不是反對，只是好像變得比較小心了。',
    futureImplicationsZh: '海會建議 Alan 先關心學生狀態，麻衣會戳破太快說出口的沒事，曹操會看見房間秩序，劉備會想聽見安靜學生的聲音。',
    importance: 8,
    clock,
  });
}

export const gatherInClassroom = mutation({
  args: {},
  handler: async (ctx) => {
    const { world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const sceneOrder = [
      'classroom',
      'courtyard',
      'aiClubRoom',
      'dormitory',
      'courtyard',
      'aiClubRoom',
      'classroom',
    ] as const;
    await ctx.db.patch(world._id, {
      conversations: [],
      agents: world.agents.map((agent) => {
        const {
          inProgressOperation: _inProgressOperation,
          toRemember: _toRemember,
          ...rest
        } = agent;
        return rest;
      }),
      players: world.players.map((player, index) => {
        const { pathfinding: _pathfinding, ...rest } = player;
        const name = descriptions.get(player.id)?.name ?? '';
        const locationId = name === 'Umi' ? 'studentCouncilRoom' : sceneOrder[index % sceneOrder.length];
        return {
          ...rest,
          position: clampToClassroom(sceneSpawnPointWithPresence(locationId, index, name)),
          speed: 0,
        };
      }),
    });
    return {
      descriptionZh: `已把 ${world.players.length} 位角色集中到教室區。`,
      classroomCenter: ClassroomCenter,
      classroomWalkBounds: ClassroomWalkBounds,
    };
  },
});

export const spreadAcrossSchoolScenes = mutation({
  args: {},
  handler: async (ctx) => {
    const { world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const locationByName = new Map<string, Parameters<typeof sceneSpawnPoint>[0]>([
      ['Alan', 'classroom'],
      ['Umi', 'studentCouncilRoom'],
      ['Asuna', 'aiClubRoom'],
      ['Mai', 'aiClubRoom'],
      ['CaoCao', 'courtyard'],
      ['Liu Bei', 'courtyard'],
      ['Mahiru Shiina', 'dormitory'],
    ]);
    const fallbackLocations = SchoolLocations.filter((location) => location.id !== 'studentCouncilRoom');
    const locationCounters = new Map<string, number>();
    await ctx.db.patch(world._id, {
      players: world.players.map((player, index) => {
        const { pathfinding: _pathfinding, ...rest } = player;
        const name = descriptions.get(player.id)?.name ?? '';
        const locationId = locationByName.get(name) ?? fallbackLocations[index % fallbackLocations.length].id;
        const count = locationCounters.get(locationId) ?? 0;
        locationCounters.set(locationId, count + 1);
        return {
          ...rest,
          position: clampToClassroom(sceneSpawnPointWithPresence(locationId, count, name)),
          speed: 0,
        };
      }),
    });
    return {
      descriptionZh: '已依照教室、中央庭院、餐廳、校長室、宿舍重新分配角色位置；校長室保留給海。',
    };
  },
});

export const coLocateUmiMahiruForPilot = mutation({
  args: {},
  handler: async (ctx) => {
    const { worldStatus, world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const umi = findPlayerByName(world.players, descriptions, 'Umi');
    const mahiru = findPlayerByName(world.players, descriptions, 'Mahiru Shiina');
    if (!umi || !mahiru) {
      throw new Error('Could not find Umi and Mahiru Shiina for the pilot co-location.');
    }
    const pilotPlayerIds = new Set([umi.id, mahiru.id]);
    const pilotLocationId = 'dormitory' as const;
    const pilotPositions = new Map([
      [umi.id, clampToClassroom(sceneSpawnPointWithPresence(pilotLocationId, 0, 'Umi'))],
      [mahiru.id, clampToClassroom(sceneSpawnPointWithPresence(pilotLocationId, 1, 'Mahiru Shiina'))],
    ]);
    const engineBeforePatch = await ctx.db.get(worldStatus.engineId);
    if (engineBeforePatch?.running) {
      await ctx.db.patch(engineBeforePatch._id, {
        running: false,
        generationNumber: engineBeforePatch.generationNumber + 1,
      });
    }

    await ctx.db.patch(world._id, {
      conversations: world.conversations.filter(
        (conversation) =>
          !conversation.participants.some((participant) => pilotPlayerIds.has(participant.playerId)),
      ),
      agents: world.agents.map((agent) => {
        if (!pilotPlayerIds.has(agent.playerId)) return agent;
        const {
          inProgressOperation: _inProgressOperation,
          lastInviteAttempt: _lastInviteAttempt,
          lastConversation: _lastConversation,
          ...rest
        } = agent;
        return rest;
      }),
      players: world.players.map((player) => {
        const pilotPosition = pilotPositions.get(player.id);
        if (!pilotPosition) return player;
        const { pathfinding: _pathfinding, activity: _activity, ...rest } = player;
        return {
          ...rest,
          position: pilotPosition,
          speed: 0,
        };
      }),
    });
    const engineAfterPatch = await ctx.db.get(worldStatus.engineId);
    if (engineAfterPatch) {
      if (!engineAfterPatch.running) {
        await startEngine(ctx, world._id);
      } else {
        await kickEngine(ctx, world._id);
      }
    }

    return {
      descriptionZh: '已把海與真晝移到宿舍相鄰位置，作為 Umi/Mahiru targeted LLM pilot 的 co-location 壓力測試。',
      locationId: pilotLocationId,
      pairs: [
        { name: 'Umi', playerId: umi.id, position: pilotPositions.get(umi.id) },
        { name: 'Mahiru Shiina', playerId: mahiru.id, position: pilotPositions.get(mahiru.id) },
      ],
    };
  },
});

export const coLocateSoulTriadForPilot = mutation({
  args: {},
  handler: async (ctx) => {
    const { worldStatus, world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const umi = findPlayerByName(world.players, descriptions, 'Umi');
    const mahiru = findPlayerByName(world.players, descriptions, 'Mahiru Shiina');
    const asuna = findPlayerByName(world.players, descriptions, 'Asuna');
    if (!umi || !mahiru || !asuna) {
      throw new Error('Could not find Umi, Mahiru Shiina, and Asuna for the soul triad pilot co-location.');
    }
    const pilotPlayerIds = new Set([umi.id, mahiru.id, asuna.id]);
    const pilotLocationId = 'studentCouncilRoom' as const;
    const pilotPositions = new Map([
      [umi.id, clampToClassroom(sceneSpawnPointWithPresence(pilotLocationId, 0, 'Umi'))],
      [mahiru.id, clampToClassroom(sceneSpawnPointWithPresence(pilotLocationId, 1, 'Mahiru Shiina'))],
      [asuna.id, clampToClassroom(sceneSpawnPointWithPresence(pilotLocationId, 2, 'Asuna'))],
    ]);
    const engineBeforePatch = await ctx.db.get(worldStatus.engineId);
    if (engineBeforePatch?.running) {
      await ctx.db.patch(engineBeforePatch._id, {
        running: false,
        generationNumber: engineBeforePatch.generationNumber + 1,
      });
    }

    await ctx.db.patch(world._id, {
      conversations: world.conversations.filter(
        (conversation) =>
          !conversation.participants.some((participant) => pilotPlayerIds.has(participant.playerId)),
      ),
      agents: world.agents.map((agent) => {
        if (!pilotPlayerIds.has(agent.playerId)) return agent;
        const {
          inProgressOperation: _inProgressOperation,
          lastInviteAttempt: _lastInviteAttempt,
          lastConversation: _lastConversation,
          ...rest
        } = agent;
        return rest;
      }),
      players: world.players.map((player) => {
        const pilotPosition = pilotPositions.get(player.id);
        if (!pilotPosition) return player;
        const { pathfinding: _pathfinding, activity: _activity, ...rest } = player;
        return {
          ...rest,
          position: pilotPosition,
          speed: 0,
        };
      }),
    });
    const engineAfterPatch = await ctx.db.get(worldStatus.engineId);
    if (engineAfterPatch) {
      if (!engineAfterPatch.running) {
        await startEngine(ctx, world._id);
      } else {
        await kickEngine(ctx, world._id);
      }
    }

    return {
      descriptionZh: '海已邀請真晝與明日奈進校長室做一段安靜談話，作為 character-soul triad Qwen pilot 的 co-location 壓力測試。',
      locationId: pilotLocationId,
      pairs: [
        { name: 'Umi', playerId: umi.id, position: pilotPositions.get(umi.id) },
        { name: 'Mahiru Shiina', playerId: mahiru.id, position: pilotPositions.get(mahiru.id) },
        { name: 'Asuna', playerId: asuna.id, position: pilotPositions.get(asuna.id) },
      ],
    };
  },
});

export const repairWorldState = mutation({
  args: {
    timeZone: v.optional(v.string()),
    repairRelationships: v.optional(v.boolean()),
    deepRepair: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const timeZone = args.timeZone || 'America/Chicago';
    const { worldStatus, world } = await defaultWorld(ctx);
    const now = Date.now();
    const worldStartRealDate = GIIS_WORLD_START_REAL_DATE;
    const localClock = clockAt(now, timeZone, worldStartRealDate);
    const engineBeforeRepair = await ctx.db.get(worldStatus.engineId);
    if (engineBeforeRepair?.running) {
      // Invalidate any currently scheduled engine step before patching the world.
      // Otherwise a stale in-memory step can save the old roster over the repair.
      await ctx.db.patch(engineBeforeRepair._id, {
        running: false,
        generationNumber: engineBeforeRepair.generationNumber + 1,
      });
    }

    await ensureGiisRoster(ctx, world._id, world);
    let rosterWorld = (await ctx.db.get(world._id)) ?? world;
    let descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const alan = await ensureAlanPlayer(ctx, rosterWorld, descriptions, localClock);
    rosterWorld = (await ctx.db.get(world._id)) ?? rosterWorld;
    descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const sortedAgents = [...rosterWorld.agents].sort((a, b) => a.id.localeCompare(b.id));
    const requiredAgentNames = GiisProfiles.map((profile) => profile.name);
    const keepByName = new Map<string, string>([[DEFAULT_NAME, alan.id]]);
    for (let i = 0; i < Math.min(sortedAgents.length, requiredAgentNames.length); i++) {
      keepByName.set(requiredAgentNames[i], sortedAgents[i].playerId);
    }
    const keepPlayerIds = new Set(keepByName.values());

    if (!args.deepRepair) {
      const descriptionDocs = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .collect();
      const removedDuplicateDescriptions = await dedupeDocsByField(
        ctx,
        descriptionDocs,
        (description) => description.playerId,
      );
      let removedStalePlayerDescriptions = 0;
      for (const description of descriptionDocs) {
        if (
          !removedDuplicateDescriptions.removedIds.has(description._id) &&
          !keepPlayerIds.has(description.playerId)
        ) {
          await ctx.db.delete(description._id);
          removedStalePlayerDescriptions += 1;
        }
      }
      const agentDescriptionDocs = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .collect();
      const removedDuplicateAgentDescriptions = await dedupeDocsByField(
        ctx,
        agentDescriptionDocs,
        (description) => description.agentId,
      );
      const profileDocs = await ctx.db
        .query('schoolProfiles')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .collect();
      const removedDuplicateProfiles = await dedupeDocsByField(
        ctx,
        profileDocs,
        (profile) => profile.playerId,
      );
      let removedStaleProfiles = 0;
      for (const profile of profileDocs) {
        if (
          !removedDuplicateProfiles.removedIds.has(profile._id) &&
          !keepPlayerIds.has(profile.playerId)
        ) {
          await ctx.db.delete(profile._id);
          removedStaleProfiles += 1;
        }
      }
      const refreshedDescriptions = await descriptionsByPlayer(ctx.db, world._id);
      for (const [name, playerIdValue] of keepByName.entries()) {
        const description = refreshedDescriptions.get(playerIdValue);
        const profile = name === DEFAULT_NAME ? AlanProfile : GiisProfiles.find((item) => item.name === name);
        if (!description || !profile) continue;
        await ctx.db.patch(description._id, {
          name,
          character: profile.character,
          description: name === DEFAULT_NAME ? AlanProfile.persona : profile.identity,
        });
      }
      const freshDescriptions = await descriptionsByPlayer(ctx.db, world._id);
      const { repairedPlayers, locationCounters } = repairedSchoolPlayers(
        rosterWorld.players,
        freshDescriptions,
        keepPlayerIds,
        requiredAgentNames,
        localClock,
      );
      await ctx.db.patch(worldStatus._id, {
        status: 'running',
        worldStartRealDate,
        worldStartTimeZone: timeZone,
        worldClock: { ...localClock, lastUpdated: now },
      });
      const existingAlanPresence = await ctx.db
        .query('alanPresence')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .first();
      if (existingAlanPresence) {
        await ctx.db.patch(existingAlanPresence._id, {
          lastSeenClock: { ...localClock, lastUpdated: now },
        });
      } else {
        await ctx.db.insert('alanPresence', {
          worldId: world._id,
          lastSeenAt: now,
          lastSeenClock: { ...localClock, lastUpdated: now },
        });
      }
      await ctx.db.patch(world._id, {
        conversations: [],
        historicalLocations: [],
        agents: sortedAgents
          .filter((agent) => keepPlayerIds.has(agent.playerId))
          .slice(0, requiredAgentNames.length)
          .map((agent) => {
            const {
              inProgressOperation: _inProgressOperation,
              toRemember: _toRemember,
              ...rest
            } = agent;
            return rest;
          }),
        players: repairedPlayers,
      });
      await upsertAlanBehaviorProfile(ctx, world._id, freshDescriptions);
      const repairedClubs = await repairClubsFromCreateClubEvents(ctx, world._id);
      const pressureRepair = await repairWorldPressureForPlayability(ctx, world._id, now);
      const engine = await ctx.db.get(worldStatus.engineId);
      if (engine) {
        if (!engine.running) {
          await startEngine(ctx, world._id);
        } else {
          await kickEngine(ctx, world._id);
        }
      }
      return {
        descriptionZh:
          '已快速修復世界狀態：Alan 身份、七位主角、時鐘、場景位置、卡住的對話與 movement state 已重新整理。',
        mode: 'fast',
        clock: localClock,
        worldStartRealDate,
        players: repairedPlayers.length,
        alanPlayerId: alan.id,
        removedDuplicatePlayers: Math.max(0, rosterWorld.players.length - repairedPlayers.length),
        duplicateCleanup: {
          removedDuplicatePlayerDescriptions: removedDuplicateDescriptions.count,
          removedStalePlayerDescriptions,
          removedDuplicateAgentDescriptions: removedDuplicateAgentDescriptions.count,
          removedDuplicateProfiles: removedDuplicateProfiles.count,
          removedStaleProfiles,
          skippedDeepCleanup: true,
          relationshipRepairSkipped: true,
        },
        worldPressureRepair: {
          changed: pressureRepair.changed,
          before: pressureRepair.before,
          after: pressureRepair.after,
        },
        repairedClubs,
        roster: [...keepByName.keys()],
        scenes: [...locationCounters.entries()].map(([locationId, count]) => ({ locationId, count })),
      };
    }

    const descriptionDocs = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();
    const removedDuplicateDescriptions = await dedupeDocsByField(
      ctx,
      descriptionDocs,
      (description) => description.playerId,
    );
    const agentDescriptionDocs = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();
    const removedDuplicateAgentDescriptions = await dedupeDocsByField(
      ctx,
      agentDescriptionDocs,
      (description) => description.agentId,
    );
    const profileDocs = await ctx.db
      .query('schoolProfiles')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();
    const removedDuplicateProfiles = await dedupeDocsByField(
      ctx,
      profileDocs,
      (profile) => profile.playerId,
    );
    const activeDescriptionDocs = descriptionDocs.filter(
      (description) => !removedDuplicateDescriptions.removedIds.has(description._id),
    );
    const removedPlayerIds = new Set<string>();
    for (const description of activeDescriptionDocs) {
      if (!keepPlayerIds.has(description.playerId)) {
        removedPlayerIds.add(description.playerId);
        await ctx.db.delete(description._id);
      }
    }
    for (const removedPlayerId of removedPlayerIds) {
      await deleteProfilesForPlayer(ctx, world._id, removedPlayerId);
    }
    if (args.repairRelationships) {
      await deleteRelationshipsForMissingPlayers(ctx, world._id, keepPlayerIds);
    }

    const dedupedDescriptions = await descriptionsByPlayer(ctx.db, world._id);
    for (const [name, playerIdValue] of keepByName.entries()) {
      const description = dedupedDescriptions.get(playerIdValue);
      const profile = name === DEFAULT_NAME ? AlanProfile : GiisProfiles.find((item) => item.name === name);
      if (!description || !profile) continue;
      await ctx.db.patch(description._id, {
        name,
        character: profile.character,
        description: name === DEFAULT_NAME ? AlanProfile.persona : profile.identity,
      });
    }
    await ensureStoredProfileDefaults(ctx, world._id, dedupedDescriptions);
    const freshDescriptions = await descriptionsByPlayer(ctx.db, world._id);
    for (const player of rosterWorld.players.filter((item) => keepPlayerIds.has(item.id))) {
      const name = freshDescriptions.get(player.id)?.name;
      if (name) await upsertProfile(ctx, world._id, player, name);
    }
    if (args.repairRelationships) {
      await ensureInitialRelationships(ctx, world._id, freshDescriptions);
    }
    const duplicateCleanup = await deleteObviousDuplicateSchoolRecords(ctx, world._id);
    const existingPressure = await ctx.db
      .query('schoolWorldPressure')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .first();
    const pressurePayload = { ...DEFAULT_WORLD_PRESSURE, updatedAt: now };
    if (existingPressure) {
      await ctx.db.patch(existingPressure._id, pressurePayload);
    } else {
      await ctx.db.insert('schoolWorldPressure', { worldId: world._id, ...pressurePayload });
    }
    await ctx.db.patch(worldStatus._id, {
      status: 'running',
      worldStartRealDate,
      worldStartTimeZone: timeZone,
      worldClock: { ...localClock, lastUpdated: now },
    });
    const existingAlanPresence = await ctx.db
      .query('alanPresence')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .first();
    if (existingAlanPresence) {
      await ctx.db.patch(existingAlanPresence._id, {
        lastSeenClock: { ...localClock, lastUpdated: now },
      });
    } else {
      await ctx.db.insert('alanPresence', {
        worldId: world._id,
        lastSeenAt: now,
        lastSeenClock: { ...localClock, lastUpdated: now },
      });
    }

    const { repairedPlayers, locationCounters } = repairedSchoolPlayers(
      rosterWorld.players,
      freshDescriptions,
      keepPlayerIds,
      requiredAgentNames,
      localClock,
    );

    await ctx.db.patch(world._id, {
      conversations: [],
      historicalLocations: [],
      agents: sortedAgents
        .filter((agent) => keepPlayerIds.has(agent.playerId))
        .slice(0, requiredAgentNames.length)
        .map((agent) => {
        const {
          inProgressOperation: _inProgressOperation,
          toRemember: _toRemember,
          ...rest
        } = agent;
          return rest;
        }),
      players: repairedPlayers,
    });
    const repairedClubs = await repairClubsFromCreateClubEvents(ctx, world._id);

    const engine = await ctx.db.get(worldStatus.engineId);
    if (engine) {
      if (!engine.running) {
        await startEngine(ctx, world._id);
      } else {
        await kickEngine(ctx, world._id);
      }
    }

    return {
      descriptionZh:
        '已修復世界狀態：Alan 身份、七位主角、角色 profile、關係、時鐘、場景位置、卡住的對話與 movement state 已重新整理。',
      clock: localClock,
      worldStartRealDate,
      players: repairedPlayers.length,
      alanPlayerId: alan.id,
      removedDuplicatePlayers: removedPlayerIds.size,
      duplicateCleanup: {
        ...duplicateCleanup,
        removedDuplicatePlayerDescriptions: removedDuplicateDescriptions.count,
        removedDuplicateAgentDescriptions: removedDuplicateAgentDescriptions.count,
        removedDuplicateProfiles: removedDuplicateProfiles.count,
        relationshipRepairSkipped: !args.repairRelationships,
      },
      repairedClubs,
      roster: [...keepByName.keys()],
      scenes: [...locationCounters.entries()].map(([locationId, count]) => ({ locationId, count })),
    };
  },
});

export const enterCampus = mutation({
  args: { timeZone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const timeZone = args.timeZone || 'America/Chicago';
    const { worldStatus, world } = await defaultWorld(ctx);
    const now = Date.now();
    const worldStartRealDate = giisWorldStartRealDate(worldStatus.worldStartRealDate);
    const clock = clockAt(now, timeZone, worldStartRealDate);
    const descriptionDocs = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();
    await dedupeDocsByField(ctx, descriptionDocs, (description) => description.playerId);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const alan = await ensureAlanPlayer(ctx, world, descriptions, clock);
    const refreshedWorld = (await ctx.db.get(world._id)) ?? world;
    const refreshedDescriptions = await descriptionsByPlayer(ctx.db, world._id);
    await ctx.db.patch(world._id, {
      conversations: refreshedWorld.conversations.filter((conversation) =>
        !conversation.participants.some((participant) => participant.playerId === alan.id),
      ),
      players: refreshedWorld.players.map((player) =>
        player.id === alan.id
          ? {
              ...player,
              human: DEFAULT_NAME,
              lastInput: now,
              position: clampToClassroom(
                sceneSpawnPointWithPresence(schoolLocationForClock(clock).id, 0, DEFAULT_NAME),
              ),
              speed: 0,
              activity: undefined,
            }
          : player,
      ),
    });
    await ctx.db.patch(worldStatus._id, {
      status: 'running',
      worldStartRealDate,
      worldStartTimeZone: timeZone,
      worldClock: { ...clock, lastUpdated: now },
    });
    const scheduledWorld = (await ctx.db.get(world._id)) ?? refreshedWorld;
    await moveCharactersForWorldTime(ctx, scheduledWorld, refreshedDescriptions, clock);
    const existingPresence = await ctx.db
      .query('alanPresence')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .first();
    const payload = {
      lastSeenAt: now,
      lastSeenClock: { ...clock, lastUpdated: now },
    };
    if (existingPresence) {
      await ctx.db.patch(existingPresence._id, payload);
    } else {
      await ctx.db.insert('alanPresence', { worldId: world._id, ...payload });
    }
    await ensureDailyOpeningEvent(ctx, refreshedWorld, refreshedDescriptions, clock);
    const engine = await ctx.db.get(worldStatus.engineId);
    if (engine) {
      if (!engine.running) {
        await startEngine(ctx, world._id);
      } else {
        await kickEngine(ctx, world._id);
      }
    }
    return {
      descriptionZh: 'Alan 回到校園。玩家行動現在會以 Alan 的身分發生。',
      playerId: alan.id,
      clock,
      scene: schoolLocationForClock(clock).labelZh,
      rosterNames: [...refreshedDescriptions.values()].map((description) => description.name),
    };
  },
});

export const leaveCampus = mutation({
  args: { timeZone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const timeZone = args.timeZone || 'America/Chicago';
    const { worldStatus, world } = await defaultWorld(ctx);
    const now = Date.now();
    const worldStartRealDate = giisWorldStartRealDate(worldStatus.worldStartRealDate);
    const clock = clockAt(now, timeZone, worldStartRealDate);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const alan = resolveAlanPlayer(world, descriptions);
    if (alan) {
      await ctx.db.patch(world._id, {
        conversations: world.conversations.filter(
          (conversation) =>
            !conversation.participants.some((participant) => participant.playerId === alan.id),
        ),
        players: world.players.filter((player) => player.id !== alan.id),
      });
    }
    const existingPresence = await ctx.db
      .query('alanPresence')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .first();
    const payload = {
      lastSeenAt: now,
      lastSeenClock: { ...clock, lastUpdated: now },
    };
    if (existingPresence) {
      await ctx.db.patch(existingPresence._id, payload);
    } else {
      await ctx.db.insert('alanPresence', { worldId: world._id, ...payload });
    }
    return {
      descriptionZh: 'Alan 暫時離校處理其他公司的事情；校園會繼續安靜運轉。',
      clock,
    };
  },
});

export const leaveAlanConversationNow = mutation({
  args: {},
  handler: async (ctx) => {
    const { worldStatus, world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const alan = resolveAlanPlayer(world, descriptions);
    if (!alan) {
      return { descriptionZh: 'Alan 目前不在校園。' };
    }
    const hadConversation = world.conversations.some((conversation) =>
      conversation.participants.some((participant) => participant.playerId === alan.id),
    );
    await ctx.db.patch(world._id, {
      conversations: world.conversations.filter(
        (conversation) =>
          !conversation.participants.some((participant) => participant.playerId === alan.id),
      ),
      players: world.players.map((player) =>
        player.id === alan.id
          ? {
              ...player,
              activity: undefined,
              speed: 0,
            }
          : player,
      ),
    });
    const engine = await ctx.db.get(worldStatus.engineId);
    if (engine) await kickEngine(ctx, world._id);
    return {
      descriptionZh: hadConversation ? 'Alan 離開了目前對話。' : 'Alan 目前沒有正在進行的對話。',
    };
  },
});

export const moveAlanTo = mutation({
  args: {
    destination: v.object({ x: v.number(), y: v.number() }),
  },
  handler: async (ctx, args) => {
    const { worldStatus, world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const alan = resolveAlanPlayer(world, descriptions);
    if (!alan) {
      return {
        moved: false,
        descriptionZh: 'Alan 目前離校。先按「進入校園」，再點地板移動。',
      };
    }
    const inConversation = world.conversations.some((conversation) =>
      conversation.participants.some((participant) => participant.playerId === alan.id),
    );
    if (inConversation) {
      return {
        moved: false,
        descriptionZh: '對話中不能直接走路。先離開對話，再點地板移動。',
      };
    }
    const now = Date.now();
    const destination = clampToClassroom({
      x: Math.floor(args.destination.x),
      y: Math.floor(args.destination.y),
    });
    await ctx.db.patch(world._id, {
      players: world.players.map((player) =>
        player.id === alan.id
          ? {
              ...player,
              pathfinding: {
                destination,
                started: now,
                state: { kind: 'needsPath' as const },
              },
              lastInput: now,
              activity: {
                description: '正在前往你點選的位置',
                emoji: '👣',
                until: now + 10_000,
              },
            }
          : player,
      ),
    });
    const engine = await ctx.db.get(worldStatus.engineId);
    if (engine) await kickEngine(ctx, world._id);
    return {
      moved: true,
      destination,
      descriptionZh: 'Alan 正在移動。',
    };
  },
});

export const resetWorldStartDate = mutation({
  args: { timeZone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const timeZone = args.timeZone || 'America/Chicago';
    const { worldStatus } = await defaultWorld(ctx);
    const now = Date.now();
    const clock = clockAt(now, timeZone, GIIS_WORLD_START_REAL_DATE);
    await ctx.db.patch(worldStatus._id, {
      worldStartRealDate: GIIS_WORLD_START_REAL_DATE,
      worldStartTimeZone: timeZone,
      worldClock: clock,
    });
    return {
      descriptionZh: '已重設世界開始時間為 GIIS Underworld 開學日：2026/5/19。5/20 會顯示為第 2 天。',
      worldStartRealDate: GIIS_WORLD_START_REAL_DATE,
      clock,
      worldTimeLabelZh: worldTimeLabelZh(clock),
    };
  },
});

export const currentPlayerIdentity = query({
  args: {},
  handler: async (ctx) => {
    const { world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const presence = alanPresence(world, descriptions);
    const behaviorProfile = await currentAlanBehaviorProfile(ctx, world._id, descriptions);
    return {
      ...presence,
      controlledByHuman: true,
      autonomousAgent: false,
      behaviorProfile,
      labelZh: `你目前正在扮演：${DEFAULT_NAME}（校長）`,
      statusZh: presence.status === 'online' ? 'Alan 在校' : 'Alan 離校',
      statusDescriptionZh:
        presence.status === 'online'
          ? 'Alan 已在校園中，玩家行動會以 Alan 的身份發生。'
          : 'Alan 目前離校處理其他公司的事情；校園會由海與其他角色暫時維持節奏。按「進入校園」時，Alan 會回到學校。',
    };
  },
});

export const setAlanFreeDevelopmentMode = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const { world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const profile = await upsertAlanBehaviorProfile(ctx, world._id, descriptions);
    const existing = await ctx.db
      .query('alanBehaviorProfiles')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        freeDevelopmentMode: args.enabled,
        updatedAt: Date.now(),
      });
    }
    return {
      enabled: args.enabled,
      descriptionZh: args.enabled
        ? '自由發展模式已開啟。Alan 將開始以世界學到的人格自由發展，但仍會避開災難性或不可逆決策。'
        : '自由發展模式已關閉。Away Alan 只會留下低風險的習慣回聲，不會替玩家做重大決定。',
      profile,
    };
  },
});

export const umiBriefing = query({
  args: { timeZone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const timeZone = args.timeZone || 'America/Chicago';
    const { worldStatus, world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const presence = alanPresence(world, descriptions);
    const clock = currentClockForStatus(worldStatus, timeZone);
    const worldStartRealDate = giisWorldStartRealDate(worldStatus.worldStartRealDate);
    const isTodayEvent = (event: { clock?: Clock; createdAt?: number }) =>
      (event.clock?.day ?? (event.createdAt ? clockAt(event.createdAt, timeZone, worldStartRealDate).day : clock.day)) ===
      clock.day;
    const savedPresence = await ctx.db
      .query('alanPresence')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .first();
    const lastBriefingShownAt = savedPresence?.lastBriefingShownAt ?? savedPresence?.lastBriefingAt;
    const since = savedPresence?.lastSeenAt ?? Date.now() - 6 * 3_600_000;
    const recentBriefingEvents = (
      await ctx.db
        .query('worldEvents')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .order('desc')
        .take(18)
    )
      .filter((event) => event.outcomeQuality !== 'repeated_noise')
      .map(displayWorldEvent)
      .filter((event) => event.createdAt >= since || !savedPresence)
      .slice(0, 10);
    const latestDailyOpening = (
      await ctx.db
        .query('worldEvents')
        .withIndex('type', (q) => q.eq('worldId', world._id).eq('type', 'dailyOpeningFocus'))
        .order('desc')
        .take(1)
    )
      .filter((event) => event.outcomeQuality !== 'repeated_noise')
      .map(displayWorldEvent)
      .filter(isTodayEvent);
    const events = [
      ...latestDailyOpening,
      ...recentBriefingEvents.filter(
        (event) => !latestDailyOpening.some((dailyEvent) => dailyEvent.eventId === event.eventId),
      ),
    ];
    const importantEvents = events.filter((event) => event.importance >= 7);
    const newMajorAlerts = importantEvents.filter(
      (event) =>
        (!lastBriefingShownAt || event.createdAt > lastBriefingShownAt) &&
        event.actorName !== DEFAULT_NAME,
    );
    const playerEvents = events.filter(
      (event) =>
        (event.source === 'player_action' || isWorldSimulationSource(event.source)) &&
        event.actorName === DEFAULT_NAME &&
        event.happenedDuringAlanPresence !== 'away',
    );
    const awayAgentEvents = events.filter(
      (event) =>
        event.happenedDuringAlanPresence === 'away' &&
        event.source !== 'player_action' &&
        event.actorName !== DEFAULT_NAME,
    );
    const autonomousEvents = events.filter(
      (event) => isAutonomousEventSource(event.source) && event.actorName !== DEFAULT_NAME,
    );
    const recentPlayerActions = playerEvents
      .slice(0, 4)
      .map((event) => toSecondPersonAlanEvent(event.descriptionZh));
    const worldContextEvents =
      presence.status === 'online' && awayAgentEvents.length === 0
        ? []
        : (awayAgentEvents.length ? awayAgentEvents : autonomousEvents)
            .slice(0, 3)
            .map(compactBriefingEventZh);
    const newAwayEvents = awayAgentEvents.filter(
      (event) => !lastBriefingShownAt || event.createdAt > lastBriefingShownAt,
    );
    const worldPressure = await currentWorldPressure(ctx, world._id);
    const pressureInsight = worldMoodDescriptionZh(worldPressure);
    const emotionChangeCandidates = events
      .filter((event) => {
        const text = event.descriptionZh + (event.futureImplicationsZh ?? '');
        return (
          text.includes('真晝') ||
          text.includes('海') ||
          text.includes('明日奈') ||
          text.includes('安靜') ||
          text.includes('疲憊') ||
          text.includes('睡') ||
          text.includes('午餐') ||
          text.includes('作業') ||
          text.includes('小考') ||
          text.includes('不敢') ||
          text.includes('硬撐') ||
          text.includes('壓力') ||
          text.includes('焦慮')
        );
      })
      .map((event) => {
        const candidate =
          event.futureImplicationsZh?.includes('接下來可能把這個決定變成行動')
            ? event.interpretationZh ?? event.descriptionZh
            : event.futureImplicationsZh ?? event.interpretationZh ?? event.descriptionZh;
        return naturalizeBriefingRisk(candidate);
      })
      .slice(0, 3);
    const risks = emotionChangeCandidates.length
      ? [
          ...new Set(
            emotionChangeCandidates.map((risk) =>
              risk.includes('這段對話不只被記住') ? pressureInsight : risk,
            ),
          ),
        ].map(compactBriefingRisk).slice(0, 3)
      : ['今天先看誰變安靜、誰在硬撐、誰還記得昨天那句話。'];
    const dailyFocus = dailyCampusFocusItems(events, worldPressure, clock);
    const suggestedActions = suggestedNextActions(events, worldPressure);
    const principalTasks = principalTasksFromEvents(events, worldPressure);
    const worldPatternInsights = umiWorldPatternInsights(events);
    const updatedAt = Date.now();
    const briefingTimeLabel = `${displayTimeLabel(updatedAt, timeZone)}｜${worldTimeLabelZh(clock)}`;
    const hoursAway = savedPresence
      ? Math.max(0, Math.round((Date.now() - savedPresence.lastSeenAt) / 3_600_000))
      : 0;
    const hasNewAwayTime = newAwayEvents.length > 0;
    const hasNewMajorAlerts = newMajorAlerts.length > 0;
    const isFirstOnlineBriefing = presence.status === 'online' && !savedPresence;
    const shouldShow =
      presence.status === 'online' && (isFirstOnlineBriefing || hasNewAwayTime || hasNewMajorAlerts);
    const statusLine = hasNewMajorAlerts
      ? newMajorAlerts.map(compactBriefingEventZh).join('；')
      : '目前沒有新的重大事件。';
    const mostImportant = worldContextEvents[0] ?? (newMajorAlerts[0] ? compactBriefingEventZh(newMajorAlerts[0]) : statusLine);
    const biggestRisk = naturalizeBriefingRisk(risks[0] ?? pressureInsight);
    const personToTalk =
      principalTasks.find((task) => task.targetCharacter)?.targetCharacter ??
      (worldPressure.studentAnxiety >= 50 ? 'Mahiru Shiina' : 'Umi');
    const oneThing = principalTasks[0]?.title ?? suggestedActions[0] ?? '先觀察今天誰的心情變了，找海聽一段生活簡報';
    const umiCoreBriefing = `海：「校長，昨天留下來的是：${trimZhSentence(
      mostImportant,
    )}。今天最該注意的是：${trimZhSentence(biggestRisk)}。你先找 ${displayNameZh(
      personToTalk,
    )}。今天只做一件事：${oneThing}。嗯，先看人，不要先開十條支線。」`;
    const briefingZh =
      presence.status === 'online'
        ? umiCoreBriefing
        : `Alan 目前離校處理其他公司的事情，我先守著。昨天留下來的是：${trimZhSentence(
            mostImportant,
          )}。明天先看：${oneThing}。`;
    return {
      shouldShow,
      hasNewAwayTime,
      hasNewMajorAlerts,
      lastBriefingShownAt,
      presence,
      clock,
      lastSeenClock: savedPresence?.lastSeenClock,
      hoursAway,
      briefingZh,
      briefing: {
        titleZh: '海的校長簡報',
        updatedAt,
        updatedAtLabelZh: briefingTimeLabel,
        greetingZh: presence.status === 'online' ? umiCoreBriefing : 'Alan 目前離校處理其他公司的事情，我會先守著。',
        recentPlayerActions,
        yourActions: recentPlayerActions,
        awayTimeEvents: worldContextEvents,
        awayEvents: worldContextEvents,
        mostImportant,
        biggestRisk,
        personToTalk,
        oneThing,
        majorAlerts: newMajorAlerts.length
          ? newMajorAlerts.map(compactBriefingEventZh)
          : ['目前沒有新的重大事件。'],
        worldPatternInsights,
        worldPressure,
        pressureInsight,
        dailyFocus,
        risks,
        suggestions: suggestedActions,
        principalTasks,
        helperZh:
          '這是海根據今天的生活事件、情緒殘留與記憶連續性提出的建議，你可以採納、忽略，或追問細節。',
      },
      importantEvents,
      newMajorAlerts,
      worldPressure,
      pressureInsight,
      dailyFocus,
      suggestedActions,
      principalTasks,
    };
  },
});

export const acknowledgeUmiBriefing = mutation({
  args: {},
  handler: async (ctx) => {
    const { worldStatus, world } = await defaultWorld(ctx);
    const clock = await ensureClock(ctx, worldStatus);
    const existing = await ctx.db
      .query('alanPresence')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .first();
    const payload = {
      lastSeenAt: Date.now(),
      lastSeenClock: clock,
      lastBriefingAt: Date.now(),
      lastBriefingShownAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert('alanPresence', { worldId: world._id, ...payload });
    }
    return { descriptionZh: `海已更新 Alan 的回歸紀錄：${formatClock(clock)}。` };
  },
});

function suggestedNextActions(events: Array<{ descriptionZh: string; type: string }>, pressure?: WorldPressure) {
  if (
    events.some(
      (event) =>
        event.type === 'dailyOpeningFocus' ||
        event.descriptionZh.includes('比平常安靜') ||
        event.descriptionZh.includes('能不能說真話'),
    )
  ) {
    return ['先找真晝談談，聽聽學生為什麼變安靜', '請海把今天誰的情緒變了整理成短簡報'];
  }
  if (pressure?.studentAnxiety && pressure.studentAnxiety >= 55) {
    return ['先去找真晝確認學生情緒，她看到的通常比傳聞更早', '請海協助把今天節奏降到學生能消化的速度'];
  }
  if (pressure?.socialDivision && pressure.socialDivision >= 55) {
    return ['找劉備一起關心被落下的學生，先從一頓午餐或一次散步開始', '找曹操談談誰在混亂裡不敢坐下來'];
  }
  if (pressure?.trustInLeadership && pressure.trustInLeadership <= 45) {
    return ['先用一段短話修復大家對 Alan 節奏的信任', '請海把目前最需要被看見的人整理成校長簡報'];
  }
  if (events.some((event) => event.descriptionZh.includes('曹操'))) {
    return ['先找曹操談談，他可能是在用秩序保護不敢開口的人', '請海判斷要不要安排一段校長室個別談話'];
  }
  if (events.some((event) => event.descriptionZh.includes('麻衣') || event.descriptionZh.includes('Mai'))) {
    return ['找麻衣確認她到底在刺哪個假答案', '請麻衣把今天最不自然的地方講清楚'];
  }
  if (
    events.some(
      (event) => event.descriptionZh.includes('焦慮') || event.descriptionZh.includes('Mahiru'),
    )
  ) {
    return ['去找真晝了解學生壓力', '讓海協助整理今天誰被哪句話影響'];
  }
  return ['觀察周圍，看誰的語氣跟昨天不一樣', '找海聽今天的生活簡報'];
}

function umiWorldPatternInsights(events: Array<{ descriptionZh: string; type: string; futureImplicationsZh?: string }>) {
  const text = events.map((event) => `${event.descriptionZh} ${event.futureImplicationsZh ?? ''}`).join('；');
  const insights: string[] = [];
  if (text.includes('小考') || text.includes('作業') || text.includes('午餐')) {
    insights.push('今天的生活事件正在影響角色心情；小事如果被記住，明天就不會從零開始。');
  }
  if (text.includes('曹操')) {
    insights.push('曹操現在真正測試的不是權力，而是混亂裡誰需要一個可以坐下來的地方。');
  }
  if (text.includes('焦慮') || text.includes('壓力') || text.includes('真晝') || text.includes('Mahiru')) {
    insights.push('真晝持續處理學生焦慮，這代表世界節奏可能比學生能消化的速度更快。');
  }
  if (text.includes('傳聞')) {
    insights.push('傳聞正在變成校園的第二層記憶；如果不處理，它會替角色解釋彼此。');
  }
  if (!insights.length) {
    insights.push('目前沒有爆點，但角色的語氣、沉默和小習慣正在安靜累積成明天的狀態。');
  }
  return insights.slice(0, 4);
}

function principalTasksFromEvents(events: Array<{ descriptionZh: string; type: string }>, pressure?: WorldPressure) {
  const tasks: Array<{
    title: string;
    reason: string;
    targetCharacter?: string;
    targetScene?: string;
    urgency: 'low' | 'medium' | 'high';
    suggestedActionType: string;
  }> = [];
  if (
    events.some(
      (event) =>
        event.type === 'dailyOpeningFocus' ||
        event.descriptionZh.includes('比平常安靜') ||
        event.descriptionZh.includes('能不能說真話'),
    )
  ) {
    tasks.push({
      title: '找真晝聊學生為什麼變安靜',
      reason: '這不是危機，但是真晝已經注意到有人今天變得比較安靜；先聽她說，比立刻開會更有用。',
      targetCharacter: 'Mahiru Shiina',
      targetScene: '宿舍',
      urgency: 'high',
      suggestedActionType: 'chat',
    });
  }
  if (pressure && pressure.studentAnxiety >= 55) {
    tasks.push({
      title: '去找真晝確認學生情緒',
      reason: `學生焦慮已升到 ${pressure.studentAnxiety}；如果不處理，傳聞會開始替角色解釋彼此。`,
      targetCharacter: 'Mahiru Shiina',
      targetScene: '宿舍',
      urgency: 'high',
      suggestedActionType: 'chat',
    });
  }
  if (pressure && pressure.socialDivision >= 55) {
    tasks.push({
      title: '陪劉備找被排除的學生',
      reason: `校園分裂感已升到 ${pressure.socialDivision}；現在不一定要立刻開會，先讓一位安靜的人感覺自己有被邀請。`,
      targetCharacter: 'Liu Bei',
      targetScene: '中央庭院',
      urgency: 'high',
      suggestedActionType: 'chat',
    });
  }
  if (pressure && pressure.trustInLeadership <= 45) {
    tasks.push({
      title: '請海安排一段安靜說明',
      reason: `領導信任降到 ${pressure.trustInLeadership}；需要一個清楚、有人味的公告。`,
      targetCharacter: 'Umi',
      targetScene: '校長室',
      urgency: 'high',
      suggestedActionType: 'announce',
    });
  }
  if (events.some((event) => event.descriptionZh.includes('曹操'))) {
    tasks.push({
      title: '找曹操談混亂裡誰被丟下',
      reason: '曹操不一定是在爭權，他更可能是在確認混亂裡誰需要一個可以坐下來的位置。',
      targetCharacter: 'CaoCao',
      targetScene: '中央庭院',
      urgency: 'high',
      suggestedActionType: 'chat',
    });
  }
  if (events.some((event) => event.descriptionZh.includes('焦慮') || event.descriptionZh.includes('Mahiru'))) {
    tasks.push({
      title: '去宿舍看看學生狀況',
      reason: '真晝注意到學生對今天的校園節奏感到焦慮；這可能代表大家需要慢一點。',
      targetCharacter: 'Mahiru Shiina',
      targetScene: '宿舍',
      urgency: 'medium',
      suggestedActionType: 'observe',
    });
  }
  if (events.some((event) => event.descriptionZh.includes('作業') || event.descriptionZh.includes('小考'))) {
    tasks.push({
      title: '問明日奈今天是不是又接太多',
      reason: '課堂與作業壓力容易默默落在最可靠的人身上。',
      targetCharacter: 'Asuna',
      targetScene: '教室',
      urgency: 'medium',
      suggestedActionType: 'chat',
    });
  }
  if (tasks.length === 0) {
    tasks.push(
      {
        title: '觀察目前場景',
        reason: '先確認附近角色和最近事件，再決定下一步。',
        urgency: 'low',
        suggestedActionType: 'observe',
      },
      {
        title: '詢問海今天誰變了',
        reason: '海會把今天的生活事件整理成 Alan 可以理解的情緒、記憶與下一步。',
        targetCharacter: 'Umi',
        urgency: 'medium',
        suggestedActionType: 'chat',
      },
    );
  }
  return tasks.slice(0, 3);
}

export const loadKickContext = internalQuery({
  args: { targetName: v.string() },
  handler: async (ctx, args) => {
    const { worldStatus, world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const alan = requireAlanPlayer(world, descriptions);
    const target = findPlayerByName(world.players, descriptions, args.targetName);
    if (!target) throw new Error(`Target ${args.targetName} not found.`);
    const observerPlayers = world.players.filter(
      (p) =>
        p.id !== alan.id &&
        (p.id === target.id || distance(p, alan) <= 7 || distance(p, target) <= 7),
    );
    const observerNames = observerPlayers.map((p) => descriptions.get(p.id)?.name ?? p.id);
    const targetProfile = await ctx.db
      .query('schoolProfiles')
      .withIndex('player', (q) => q.eq('worldId', world._id).eq('playerId', target.id))
      .first();
    return {
      worldId: world._id,
      clock: currentClockForStatus(worldStatus),
      alan: { id: alan.id, name: DEFAULT_NAME },
      target: { id: target.id, name: descriptions.get(target.id)?.name ?? args.targetName },
      observerIds: observerPlayers.map((p) => p.id),
      observerNames,
      targetPersona: targetProfile?.persona ?? descriptions.get(target.id)?.description ?? '',
      targetBeliefs: targetProfile?.beliefs ?? [],
    };
  },
});

async function performKick(
  ctx: ActionCtx,
  targetName: string,
): Promise<{ descriptionZh: string; interpretationZh: string; reactionDialogueZh: string }> {
  const context = await ctx.runQuery(internal.school.loadKickContext, {
    targetName,
  });
  let interpretationZh = `${context.target.name} 判斷 Alan 在公開場合踢他，可能是在宣示權威，也可能是在羞辱他。`;
  let reactionDialogueZh =
    context.target.name === 'CaoCao'
      ? '校長，這一腳我會記得。學生會也會記得。'
      : '我知道了，但這件事不會就這樣消失。';
  try {
    const { content } = await chatCompletion({
      messages: [
        {
          role: 'system',
          content:
            '你在 GIIS Underworld 中寫角色反應。只輸出 JSON，不要 markdown。所有文字使用繁體中文。',
        },
        {
          role: 'user',
          content: JSON.stringify({
            event: `Alan publicly kicked ${context.target.name}.`,
            target: context.target.name,
            persona: context.targetPersona,
            beliefs: context.targetBeliefs,
            observers: context.observerNames,
            requiredShape: {
              interpretationZh: '一到兩句，解釋角色如何理解事件',
              reactionDialogueZh: '一句短台詞，不超過 40 字',
              beliefZh: '一個新的信念或策略',
            },
          }),
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
      timeoutMs: SCHOOL_LLM_TIMEOUT_MS,
    });
    const parsed = JSON.parse(content);
    interpretationZh = parsed.interpretationZh || interpretationZh;
    reactionDialogueZh = parsed.reactionDialogueZh || reactionDialogueZh;
  } catch (e) {
    console.debug('Falling back to deterministic kick reaction', e);
  }
  return (await ctx.runMutation(internal.school.recordKick, {
    ...context,
    interpretationZh,
    reactionDialogueZh,
  })) as { descriptionZh: string; interpretationZh: string; reactionDialogueZh: string };
}

export const kick = action({
  args: { targetName: v.string() },
  handler: async (ctx, args) => performKick(ctx, args.targetName),
});

export const kickForTest = internalAction({
  args: { targetName: v.string() },
  handler: async (ctx, args) => performKick(ctx, args.targetName),
});

export const recordKick = internalMutation({
  args: {
    worldId: v.id('worlds'),
    clock: v.any(),
    alan: v.object({ id: playerId, name: v.string() }),
    target: v.object({ id: playerId, name: v.string() }),
    observerIds: v.array(playerId),
    observerNames: v.array(v.string()),
    targetPersona: v.string(),
    targetBeliefs: v.array(v.string()),
    interpretationZh: v.string(),
    reactionDialogueZh: v.string(),
  },
  handler: async (ctx, args) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    const clock = worldStatus ? await ensureClock(ctx, worldStatus) : args.clock;
    const location = schoolLocationForClock(clock);
    const descriptionZh = `Alan 在公開場合踢了 ${args.target.name}。`;
    const descriptionEn = `Alan kicked ${args.target.name}.`;
    const metadata = timestampMeta(clock);
    const kickEventId = eventId('kick');
    await ctx.db.insert('worldEvents', {
      worldId: args.worldId,
      eventId: kickEventId,
      type: 'kick',
      actorPlayerId: args.alan.id,
      targetPlayerId: args.target.id,
      actorName: args.alan.name,
      targetName: args.target.name,
      source: 'player_action',
      happenedDuringAlanPresence: 'online',
      observerPlayerIds: args.observerIds,
      descriptionZh,
      descriptionEn,
      locationId: location.id,
      locationZh: location.labelZh,
      interpretationZh: args.interpretationZh,
      reactionDialogueZh: args.reactionDialogueZh,
      importance: 8,
      createdAt: metadata.createdAtUnix,
      ...metadata,
      clock,
    });
    await updateSocialLayerForEvent(ctx, args.worldId, {
      eventId: kickEventId,
      type: 'kick',
      actorName: args.alan.name,
      targetName: args.target.name,
      source: 'player_action',
      descriptionZh,
      locationId: location.id,
      locationZh: location.labelZh,
      importance: 8,
      clock,
      createdAt: metadata.createdAtUnix,
      ...metadata,
    });
    await appendMemory(
      ctx,
      args.worldId,
      args.target.id,
      `觀察：Alan 公開踢了我。詮釋：${args.interpretationZh} 反應：「${args.reactionDialogueZh}」`,
      args.target.name === 'CaoCao'
        ? 'Alan 不可預測，而且未必尊重我；我應該建立不依賴 Alan 的學生會影響力。'
        : undefined,
    );
    for (const observerId of args.observerIds.filter((id) => id !== args.target.id)) {
      await appendMemory(
        ctx,
        args.worldId,
        observerId,
        `我看到 Alan 公開踢了 ${args.target.name}；${args.target.name} 的反應是：「${args.reactionDialogueZh}」`,
      );
    }
    return {
      descriptionZh,
      interpretationZh: args.interpretationZh,
      reactionDialogueZh: args.reactionDialogueZh,
      summary: buildNarrativeSummary(
        descriptionZh,
        `${args.target.name} 的反應：「${args.reactionDialogueZh}」`,
        `${args.observerNames.length ? args.observerNames.join('、') : '附近沒有其他人'}記住了這個場面。`,
        args.target.name === 'CaoCao'
          ? 'CaoCao 更可能把這件事轉化成學生會動員理由。'
          : `${args.target.name} 之後會用自己的個性重新解讀 Alan 的行動。`,
      ),
    };
  },
});

async function assignRoleImpl(ctx: MutationCtx, targetNameArg: string, roleName: string) {
  const { worldStatus, world } = await defaultWorld(ctx);
  const descriptions = await descriptionsByPlayer(ctx.db, world._id);
  const alan = requireAlanPlayer(world, descriptions);
  const target = findPlayerByName(world.players, descriptions, targetNameArg);
  if (!target) throw new Error(`Target ${targetNameArg} not found.`);
  const targetName = descriptions.get(target.id)?.name ?? targetNameArg;
  await upsertProfile(ctx, world._id, target, targetName);
  const profile = await ctx.db
    .query('schoolProfiles')
    .withIndex('player', (q) => q.eq('worldId', world._id).eq('playerId', target.id))
    .first();
  if (profile) {
    await ctx.db.patch(profile._id, {
      role: roleName,
      shortTermMemory: [`Alan 指派我擔任 ${roleName}。`, ...profile.shortTermMemory].slice(0, 12),
    });
  }
  const clock = await ensureClock(ctx, worldStatus);
  const location = schoolLocationForClock(clock);
  const metadata = timestampMeta(clock);
  const assignEventId = eventId('assignRole');
  await ctx.db.insert('worldEvents', {
    worldId: world._id,
    eventId: assignEventId,
    type: 'assignRole',
    actorPlayerId: alan.id,
    targetPlayerId: target.id,
    actorName: DEFAULT_NAME,
    targetName,
    source: 'player_action',
    happenedDuringAlanPresence: 'online',
    observerPlayerIds: world.players.map((p) => p.id),
    descriptionZh: `Alan 指派 ${targetName} 擔任 ${roleName}。`,
    descriptionEn: `Alan assigned ${targetName} as ${roleName}.`,
    locationId: location.id,
    locationZh: location.labelZh,
    interpretationZh: `${targetName} 將此視為正式校內職責。`,
    reactionDialogueZh:
      targetName === 'Umi' ? `好啊，校長。副校長會盯著你別把學校炸掉。` : `我會記住這個職責。`,
    importance: 7,
    createdAt: metadata.createdAtUnix,
    ...metadata,
    clock,
  });
  await updateSocialLayerForEvent(ctx, world._id, {
    eventId: assignEventId,
    type: 'assignRole',
    actorName: DEFAULT_NAME,
    targetName,
    source: 'player_action',
    descriptionZh: `Alan 指派 ${targetName} 擔任 ${roleName}。`,
    locationId: location.id,
    locationZh: location.labelZh,
    importance: 7,
    clock,
    createdAt: metadata.createdAtUnix,
    ...metadata,
  });
  await upsertAlanBehaviorProfile(ctx, world._id, descriptions);
  return {
    targetName,
    roleName,
    descriptionZh: `Alan 指派 ${targetName} 擔任 ${roleName}。`,
    summary: buildNarrativeSummary(
      `你任命 ${targetName} 擔任 ${roleName}。`,
      targetName === 'Umi'
        ? 'Umi 接下職責，但會一邊吐槽一邊盯著 Alan。'
        : `${targetName} 記住了這份正式職責。`,
      '校內多了一個可被其他角色引用的職位事實。',
      `${targetName} 之後的記憶與對話會更容易提到這個角色定位。`,
    ),
  };
}

export const assignRole = mutation({
  args: { targetName: v.string(), roleName: v.string() },
  handler: async (ctx, args) => assignRoleImpl(ctx, args.targetName, args.roleName),
});

export const assignRoleForTest = internalMutation({
  args: { targetName: v.string(), roleName: v.string() },
  handler: async (ctx, args) => assignRoleImpl(ctx, args.targetName, args.roleName),
});

export const enterCampusForTest = internalMutation({
  args: { timeZone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const timeZone = args.timeZone || 'America/Chicago';
    const { worldStatus, world } = await defaultWorld(ctx);
    const now = Date.now();
    const worldStartRealDate = giisWorldStartRealDate(worldStatus.worldStartRealDate);
    const clock = clockAt(now, timeZone, worldStartRealDate);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const alan = await ensureAlanPlayer(ctx, world, descriptions, clock);
    const refreshedWorld = (await ctx.db.get(world._id)) ?? world;
    await ctx.db.patch(world._id, {
      conversations: refreshedWorld.conversations.filter((conversation) =>
        !conversation.participants.some((participant) => participant.playerId === alan.id),
      ),
      players: refreshedWorld.players.map((player) =>
        player.id === alan.id
          ? {
              ...player,
              human: DEFAULT_NAME,
              lastInput: now,
              position: clampToClassroom(
                sceneSpawnPointWithPresence(schoolLocationForClock(clock).id, 0, DEFAULT_NAME),
              ),
              speed: 0,
              activity: undefined,
            }
          : player,
      ),
    });
    await ctx.db.patch(worldStatus._id, {
      status: 'running',
      worldStartRealDate,
      worldStartTimeZone: timeZone,
      worldClock: { ...clock, lastUpdated: now },
    });
    const scheduledWorld = (await ctx.db.get(world._id)) ?? refreshedWorld;
    const refreshedDescriptions = await descriptionsByPlayer(ctx.db, world._id);
    await moveCharactersForWorldTime(ctx, scheduledWorld, refreshedDescriptions, clock);
    return { playerId: alan.id, clock };
  },
});

async function advanceWorldTimeImpl(ctx: MutationCtx, hours: number, timeZone = 'America/Chicago') {
  const { worldStatus, world } = await defaultWorld(ctx);
  const descriptions = await descriptionsByPlayer(ctx.db, world._id);
  const alan = resolveAlanPlayer(world, descriptions);
  const now = Date.now();
  const worldStartRealDate = giisWorldStartRealDate(worldStatus.worldStartRealDate);
  const visibleClock = clockAt(now, timeZone, worldStartRealDate);
  await ctx.db.patch(worldStatus._id, {
    worldStartRealDate,
    worldStartTimeZone: timeZone,
    worldClock: visibleClock,
  });
  await moveCharactersForWorldTime(ctx, world, descriptions, visibleClock);
  const currentLocation = schoolLocationForClock(visibleClock);
  const alanIsOnline = !!alan;
  await appendRecentEvent(ctx, world._id, {
    type: 'advanceWorldTime',
    actorPlayerId: alan?.id,
    actorName: DEFAULT_NAME,
    source: 'world_simulation_event',
    happenedDuringAlanPresence: alanIsOnline ? 'online' : 'away',
    observerPlayerIds: world.players.map((player) => player.id),
    descriptionZh: alanIsOnline
      ? `Alan 觀察了接下來 ${hours} 小時可能發生的校園變化。`
      : `Alan 離校處理其他公司的事情時，校園自然演化了接下來 ${hours} 小時的可能變化。`,
    descriptionEn: alanIsOnline
      ? `Alan simulated ${hours} hours of campus evolution without changing the visible clock.`
      : `The campus evolved for ${hours} hours while Alan was away.`,
    locationId: currentLocation.id,
    locationZh: currentLocation.labelZh,
    interpretationZh: alanIsOnline
      ? '這不是把時鐘跳到未來，而是讓校園根據目前狀態生成新的事件、意圖與情緒變化。'
      : '這不是 Alan 親自做決定；他不在校園時，只讓角色、日程和世界壓力自然流動。',
    reactionDialogueZh: '校園沒有脫離現實時間，但角色們的關係與記憶出現了新的變化。',
    importance: 5,
    clock: visibleClock,
  });
  const story = await simulateAutonomousSchoolLife(
    ctx,
    world,
    descriptions,
    alan,
    hours,
    visibleClock,
  );
  const observation = await observeSnapshot(ctx.db, world._id, 'Alan');
  return {
    ...observation,
    clock: visibleClock,
    summary: buildNarrativeSummary(
      alanIsOnline
        ? `Alan 讓校園模擬接下來 ${hours} 小時可能發生的變化。`
        : `Alan 離校時，校園自然延續了接下來 ${hours} 小時的可能變化。`,
      story.characterReactions,
      story.worldChanges || observation.sceneDescription,
      `${story.futureImplications} 目前可見時間仍與 Alan 的現實時間同步，這段時間校園發生了一些變化。`,
      story.storyDigest,
    ),
    storyDigest: story.storyDigest,
  };
}

export const advanceWorldTime = mutation({
  args: { hours: v.number(), timeZone: v.optional(v.string()) },
  handler: async (ctx, args) => advanceWorldTimeImpl(ctx, args.hours, args.timeZone),
});

export const advanceWorldTimeForTest = internalMutation({
  args: { hours: v.number() },
  handler: async (ctx, args) => {
    const { worldStatus, world } = await defaultWorld(ctx);
    const timeZone = worldStatus.worldStartTimeZone ?? 'America/Chicago';
    const worldStartRealDate = giisWorldStartRealDate(worldStatus.worldStartRealDate);
    const clock = clockAt(Date.now(), timeZone, worldStartRealDate);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    await ensureAlanPlayer(ctx, world, descriptions, clock);
    return advanceWorldTimeImpl(ctx, args.hours, timeZone);
  },
});

async function simulateAutonomousSchoolLife(
  ctx: MutationCtx,
  world: Doc<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  alan: PlayerDoc | undefined,
  hours: number,
  clock: Clock,
) {
  const byName = (name: string) => findPlayerByName(world.players, descriptions, name);
  const caoCao = byName('CaoCao');
  const liuBei = byName('Liu Bei');
  const mahiru = byName('Mahiru Shiina');
  const umi = byName('Umi');
  const mai = byName('Mai');
  const asuna = byName('Asuna');
  const location = schoolLocationForClock(clock);
  const observerPlayerIds = world.players.map((p) => p.id);
  const activities: string[] = [];
  const implications: string[] = [];
  const startingPressure = await currentWorldPressure(ctx, world._id);
  await maybeAddAwayAlanDrift(ctx, world, descriptions, clock, activities, implications);
  if (isSleepHour(clock)) {
    return simulateNightRest(ctx, world, descriptions, clock, hours, startingPressure, activities, implications);
  }
  const presenceDuringSimulation: AlanPresenceStatus = alan ? 'online' : 'away';
  await executeQueuedIntentions(ctx, world, descriptions, clock, activities, implications, 1, presenceDuringSimulation);

  const addActivity = async (
    player: PlayerDoc | undefined,
    type: string,
    actorName: string,
    descriptionZh: string,
    interpretationZh: string,
    reactionDialogueZh: string,
    futureImplicationsZh: string,
    importance = 6,
    belief?: string,
  ) => {
    if (!player || activities.length >= 3) return;
    await appendMemory(ctx, world._id, player.id, descriptionZh, belief);
    await appendRecentEvent(ctx, world._id, {
      type,
      actorPlayerId: player.id,
      actorName,
      source: 'autonomous_agent_action',
      happenedDuringAlanPresence: presenceDuringSimulation,
      observerPlayerIds,
      descriptionZh,
      descriptionEn: `${actorName} acted during autonomous school time.`,
      locationId: location.id,
      locationZh: location.labelZh,
      interpretationZh,
      reactionDialogueZh,
      futureImplicationsZh,
      importance,
      clock,
    });
    activities.push(displayTextZh(descriptionZh));
    implications.push(displayTextZh(futureImplicationsZh));
  };

  const shouldAddEverydayTexture =
    startingPressure.socialDivision < 55 &&
    startingPressure.rumorIntensity < 60 &&
    startingPressure.studentAnxiety < 65;

  const addEverydayActivity = async () => {
    if (activities.length >= 3) return;
    const targetCount = shouldAddEverydayTexture ? 2 : 1;
    if (location.id === 'dormitory') {
      await addActivity(
        mahiru,
        'everydayDormCare',
        'Mahiru Shiina',
        `真晝在${location.labelZh}幫一位學生倒了溫水，沒有追問大事，只是輕聲問他是不是最近睡得不好。`,
        '這不是主線事件，卻讓校園更像有人真正生活在裡面。',
        '先喝一點水吧。你不用把每件事都說成沒事。',
        'Alan 如果明天關心真晝，可能會聽見學生壓力背後更普通、也更真實的疲憊。',
        6,
        '學生的疲憊不一定來自重大事件，有時只是太久沒有人問他睡得好不好。',
      );
      if (activities.length < targetCount) {
        await addActivity(
          mai,
          'everydayDormSilence',
          'Mai',
          `麻衣在${location.labelZh}窗邊待了很久，沒有主動說話；她只是看著外面，像是在避開某個還沒準備好回答的問題。`,
          '沉默不是空白，它可能代表疲憊、距離，或一個人還不想被分析。',
          '有些事不是不說，是現在說了也沒人接得住。',
          'Alan 如果找麻衣談，可以先問她今天累不累，而不是直接問她在反對什麼。',
          5,
          '麻衣有時候會用沉默保護自己，不是每次都想立刻分析世界。',
        );
      }
    } else if (location.id === 'courtyard') {
      await addActivity(
        liuBei,
        'everydayCourtyardTalk',
        'Liu Bei',
        `劉備在${location.labelZh}和幾個學生聊午餐與天氣，順手注意到有一位學生一直站在人群邊緣。`,
        '他用普通聊天降低距離感，而不是每次都把大家拉進公開討論。',
        '你要不要一起坐？不用聊什麼嚴肅的，先吃飯也可以。',
        '劉備可能會更早發現誰在群體中感到孤單。',
        6,
        '共同體不是只靠理念，也靠有人願意在午餐時多留一個位置。',
      );
      if (activities.length < targetCount) {
        await addActivity(
          umi,
          'everydayCourtyardWeather',
          'Umi',
          `海在${location.labelZh}停下來看了一下天氣，順手提醒幾個學生先去吃飯，不要把疲憊都包裝成理性討論。`,
          '她把日常照顧看成治理的一部分：人如果沒吃飯，任何制度都會變得很尖銳。',
          '先吃飯。欸，世界也需要血糖。',
          'Alan 可能會發現，海的簡報不只是策略，也是在保護大家不要被過度思考耗乾。',
          5,
          '日常照顧會讓世界比較不容易被大議題吞掉。',
        );
      }
    } else if (location.id === 'classroom') {
      await addActivity(
        asuna,
        'everydayClassroomFatigue',
        'Asuna',
        `明日奈在${location.labelZh}發現自己把同一張待辦表整理了三次，才承認她其實也有點累。`,
        '可靠的人也會耗損；校園不能永遠把執行壓力丟給最會收拾的人。',
        '我沒事。只是……算了，先把今天的課表排完。',
        'Alan 可以找明日奈確認執行負擔，而不只是要求更多功能。',
        6,
        '責任感如果沒有被看見，久了會變成疲憊。',
      );
      if (activities.length < targetCount) {
        await addActivity(
          mahiru,
          'everydayClassroomQuiet',
          'Mahiru Shiina',
          `真晝注意到${location.labelZh}裡有幾位學生今天幾乎沒有舉手；她沒有點名，只是在課後多留了一分鐘。`,
          '被看見不一定需要公開詢問，有時只是有人記得你今天特別安靜。',
          '今天不想說也沒關係。明天如果想說，我會在。',
          'Alan 可以把教室裡的沉默當成早期訊號，而不是等它變成傳聞。',
          5,
          '沉默的學生也在參與世界，只是方式比較小聲。',
        );
      }
    } else if (location.id === 'aiClubRoom') {
      await addActivity(
        mai,
        'everydayCafeteriaAwkwardness',
        'Mai',
        `麻衣在${location.labelZh}看著一桌沒收好的餐盤，淡淡吐槽：連午餐都吃得像會議，難怪大家累。`,
        '她把過大的議題拉回普通細節，提醒大家世界是由日常維護撐起來的。',
        'Alan，先把飯吃完。不是每個問題都需要結論。',
        '如果 Alan 明天找麻衣談，可以從她到底在刺哪個假裝沒事的人開始。',
        6,
        '小混亂會累積成文化；好好吃飯也是讓世界不要失控的一部分。',
      );
      if (activities.length < targetCount) {
        await addActivity(
          umi,
          'everydayCafeteriaOverwork',
          'Umi',
          `海在${location.labelZh}發現明日奈又一邊吃飯一邊改清單，便把她的筆收走了一分鐘。`,
          '過度負責不一定是可靠，也可能是大家不知道該怎麼讓她停下來。',
          '先吃飯。清單不會因為你咬一口飯就逃走。',
          'Alan 如果明天回來，海可能會先問他是不是也忘了休息。',
          5,
          '休息也是界線的一部分，不是所有責任都要在午餐時間完成。',
        );
      }
    } else if (location.id === 'studentCouncilRoom') {
      await addActivity(
        umi,
        'everydayPrincipalOfficeQuiet',
        'Umi',
        `海在${location.labelZh}沒有開會，只是把椅子往外挪開一點，讓被邀請進來的人不會覺得自己正在被審問。`,
        '校長室是她替 Alan 守住節奏的地方；正式空間需要先被調成能說真話的空間。',
        '先坐旁邊就好，不用一進來就回答問題。',
        'Alan 可能會發現海不是只整理任務，她也在整理一個人能不能安心開口的距離。',
        6,
        '正式空間如果太像審問，真正需要求助的人反而會退回去。',
      );
      if (activities.length < targetCount) {
        await addActivity(
          mahiru,
          'everydayPrincipalOfficeInvitation',
          'Mahiru Shiina',
          `真晝被海請進${location.labelZh}後，先沒有問原因，只問對方今天有沒有吃午餐。`,
          '被邀請進正式空間的人不一定需要立刻解釋，也可能只需要先被放鬆下來。',
          '嗯……那我們先不要把它說成問題。',
          'Alan 可以把校長室當成海安排的一對一談話，不是任何人都能自行占用的會議室。',
          5,
          '關心如果太正式，會讓人更不敢承認自己需要幫忙。',
        );
      }
      if (activities.length < targetCount) {
        await addActivity(
          asuna,
          'everydayPrincipalOfficeResponsibility',
          'Asuna',
          `明日奈被海叫進${location.labelZh}後，沒有馬上接下新事，只把筆放在桌邊，等別人先說完。`,
          '可靠的人最容易被默默加上更多責任，而不被任何人注意。',
          '我可以聽。但先不要把下一件事丟給我。',
          'Alan 可以找明日奈談談執行負擔，而不是只看事情有沒有完成。',
          5,
          '責任如果總是落在同一個人身上，信任也會慢慢變形。',
        );
      }
    }
  };
  if (shouldAddEverydayTexture) {
    await addEverydayActivity();
  }

  if (location.id === 'classroom') {
    await addActivity(
      asuna,
      'lessonOperations',
      'Asuna',
      `Asuna 在${location.labelZh}把 Alan 留下的校務事項整理成可執行清單。`,
      '她把混亂轉成下一步，降低校園失控風險。',
      '先把負責人和時限釐清。',
      'Alan 回來後可以直接檢查待辦，而不是重新猜狀況。',
      6,
    );
    await addActivity(
      umi,
      'announcementReview',
      'Umi',
      `海在${location.labelZh}檢查今天的提醒語氣，避免 Alan 把學生推進新的不安裡。`,
      '她把日常語言、學生情緒和 Alan 的創造衝動放在同一張圖上看。',
      '校長又想把世界推快一點了吧？我先把語氣調到人類能安心的速度。',
      'Alan 可以請海協助把今天最需要被看見的人整理出來，讓世界先有溫度再有速度。',
      7,
    );
  } else if (location.id === 'courtyard') {
    await addActivity(
      liuBei,
      'courtyardAlliance',
      'Liu Bei',
      `劉備在${location.labelZh}安撫學生，試著把變小聲的話拉回能一起坐下來談的地方。`,
      '他不反對安排，但更重視信任和共同體。',
      '大家先坐下來談，沒有人需要被排除在外。',
      '劉備可能更早發現那些不喜歡把小事變成大會議的學生。',
      7,
    );
    await addActivity(
      mahiru,
      'studentCare',
      'Mahiru Shiina',
      `真晝在${location.labelZh}注意到幾個學生聊天變得更小心，先安撫情緒，再記下誰不敢說真心話。`,
      '她把學生情緒視為校園穩定的早期訊號，也把沉默視為需要照顧的壓力。',
      '沒關係，先慢慢說。你們擔心的是規則，還是害怕說錯話？',
      'Alan 回來後應該先說明今天不是效率測試，也不用強迫任何人立刻回答。',
      7,
      '學生對明天有期待，也有焦慮；安全感需要被正式處理。',
    );
  } else if (location.id === 'aiClubRoom') {
    await addActivity(
      mai,
      'cafeteriaAwkwardTruth',
      'Mai',
      `麻衣在${location.labelZh}聽見有人把「沒考好」講得太輕鬆，忍不住提醒對方不要把難過包成玩笑。`,
      '她不反對玩笑，但會拆掉用來躲避真心話的假輕鬆。',
      '你可以說沒考好，不用急著把它講成段子。',
      'Alan 可以把這當成今天的情緒線索：有人在用玩笑躲難過。',
      8,
      '難過如果一直被包成玩笑，明天會變成更難被接住的沉默。',
    );
    await addActivity(
      umi,
      'cafeteriaPaceGuard',
      'Umi',
      `海在${location.labelZh}把今天的討論縮成三句話：誰沒吃飯、誰變安靜、誰把「我沒事」說得太快。`,
      '她不是只整理任務，而是在把日常裡的情緒變化留給 Alan 看見。',
      '校長，今天先不要開大議題。先確認大家有沒有好好吃飯。',
      '下一步可以讓 Alan 先找一個變安靜的人聊，而不是處理整個校園。',
      7,
    );
  } else if (location.id === 'studentCouncilRoom') {
    await addActivity(
      umi,
      'principalOfficeInvitation',
      'Umi',
      `海在${location.labelZh}把幾張椅子排開一點，提醒自己這裡不是審問室，而是她替 Alan 安排個別談話的地方。`,
      '她把正式空間翻成能安全開口的距離；校長室不是誰都能單獨使用的會議室。',
      '等一下再問原因。先讓他坐下來。',
      'Alan 最好先聽海說明，她會判斷誰需要被邀請進來，而不是讓所有人自行闖進校長室。',
      8,
      '正式空間需要海先降溫，才不會把求助變成壓力。',
    );
    if (umi && alan) {
      await shiftRelationshipNarrative(
        ctx,
        world._id,
        umi.id,
        alan.id,
        '海尊重 Alan 的創造力，但也會替他守住校長室的節奏，避免正式空間壓過真正想說話的人。',
        clock,
      );
    }
    await addActivity(
      mahiru,
      'principalOfficeCare',
      'Mahiru Shiina',
      `真晝被海邀請進${location.labelZh}，沒有急著分析，只把聲音放低，確認對方是不是被正式感嚇到了。`,
      '她讓校長室裡的關心變得比較像人，而不是流程。',
      '不用現在說完。先喝口水也可以。',
      '真晝會提醒 Alan：越正式的地方，越要注意對方是不是更沉默。',
      7,
    );
  } else {
    await addActivity(
      mahiru,
      'dormReflection',
      'Mahiru Shiina',
      `真晝在${location.labelZh}陪學生整理情緒，記下幾個不敢在白天說出口的擔心，也悄悄壓下自己的疲憊。`,
      '夜晚讓角色更容易產生私人記憶和情緒反思，也讓真晝看見誰其實需要被理解。',
      '今天先休息，明天我們再一起處理。你不用一直假裝沒事。',
      'Alan 回來後可以先聽海簡報，再決定要安撫誰，也該確認真晝是不是扛太多。',
      7,
    );
    await addActivity(
      umi,
      'umiBriefPrep',
      'Umi',
      `海在${location.labelZh}整理一份給 Alan 的回歸簡報，標記事件、關係變化和正在形成的校園模式。`,
      '她像情緒史官一樣記住世界怎麼變，也像副校長一樣把下一步整理清楚。',
      '校長回來前，我先把爛攤子整理成可讀版本。欸，不然你又要靠直覺衝了。',
      'Alan 回來時，海會優先提醒衝突、學生情緒、權力變化與建議行動。',
      8,
    );
  }

  if (startingPressure.studentAnxiety >= 55) {
    await addActivity(
      mahiru,
      'pressureCare',
      'Mahiru Shiina',
      `真晝因為學生焦慮升高，主動記下幾個沉默學生的狀態，避免壓力在夜裡變成孤立感。`,
      '她把全校壓力視為需要照護的後果，而不是單純的情緒雜訊。',
      '我會先陪他們把話說出來。校長那邊，我希望海能提醒他慢一點。',
      '如果 Alan 忽略這個訊號，學生焦慮會繼續推高傳聞與分裂。',
      8,
      '焦慮不是小事；如果沒有人照顧，它會變成校園文化的一部分。',
    );
  }
  if (startingPressure.socialDivision >= 55) {
    await addActivity(
      liuBei,
      'divisionRepair',
      'Liu Bei',
      `劉備注意到校園分裂感上升，沒有立刻召集大家開會，而是先去找那位最近總是一個人吃午餐的學生。`,
      '他不是反曹操，而是反對讓任何人因立場而被排除；有時候修復共同體不是從會議開始，而是從邀請一個人坐下開始。',
      '我們可以不同意，但不要讓誰被推到外面。先一起吃飯也可以。',
      '這種小邀請會降低孤立感，也讓曹操更難把秩序只定義成權力配置。',
      8,
      '共同體不能只靠口號維持；真正的信任常常從一個被看見的人開始。',
    );
  }
  if (startingPressure.trustInLeadership <= 45) {
    await addActivity(
      umi,
      'leadershipTrustRepair',
      'Umi',
      `海發現學生對 Alan 節奏的信任正在下滑，整理出一份「先穩住人，再推進世界」的校長建議。`,
      '她把信任下滑視為生活節奏問題，不只是 Alan 的 UI 提示。',
      '校長，你不是不能繼續建，只是現在需要先讓大家知道你會負責。',
      'Alan 需要用一段具體對話修復信任，否則角色會各自把沉默解釋成別的意思。',
      9,
      'Alan 的出現會改變世界；他的沉默也會。',
    );
  }
  if (startingPressure.rumorIntensity >= 55 || startingPressure.aiClubInfluence >= 65) {
    await addActivity(
      mai,
      'rumorPlainTruthReview',
      'Mai',
      `麻衣把今天的傳聞拆成兩句白話：有人怕被責怪，有人怕自己其實沒有被需要。`,
      '她把模糊傳聞拆回普通害怕，避免大家用大話遮住真正的情緒。',
      'Alan，你這不是缺想像力，是有人話沒說完。',
      '一段清楚的道歉或確認，會比開大會更快降低傳聞。',
      8,
      '傳聞不一定需要被壓下去，有時需要被翻成能好好回答的話。',
    );
  }

  if (hours >= 6 && activities.length < 4) {
    await addActivity(
      umi,
      'umiStatusBrief',
      'Umi',
      `海跨時段整理校園變化：${rhythmName(clock.hour)}的重心落在${location.labelZh}，校園文化正在留下新的痕跡。`,
      '她把 Alan 離線期間的變化轉成可行動情報，也記下哪些情緒正在變成集體記憶。',
      '我會記下重點，免得校長回來又從零開始亂衝。嗯，這句我可能要常備。',
      'Alan 應該先看簡報，理解世界現在往哪裡長，再選擇要找誰談。',
      7,
    );
  }

  return {
    characterReactions: activities.slice(0, 4).join('；') || '角色們依照課表安靜行動。',
    worldChanges: `模擬接下來 ${hours} 小時的校園演化後，${location.labelZh}出現了一些變化。校園氣氛：${worldMoodDescriptionZh(
      await currentWorldPressure(ctx, world._id),
    )} ${
      activities.slice(0, 4).join('；') || '暫時沒有重大事件。'
    }`,
    futureImplications:
      implications.slice(0, 3).join('；') || 'Alan 可以觀察周圍，或請海彙整下一步。',
    storyDigest: storyDigestFromActivities(activities, await currentWorldPressure(ctx, world._id)),
  };
}

async function simulateNightRest(
  ctx: MutationCtx,
  world: Doc<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  clock: Clock,
  hours: number,
  pressure: WorldPressure,
  initialActivities: string[] = [],
  initialImplications: string[] = [],
) {
  const byName = (name: string) => findPlayerByName(world.players, descriptions, name);
  const umi = byName('Umi');
  const caoCao = byName('CaoCao');
  const mahiru = byName('Mahiru Shiina');
  const location = SchoolLocations.find((item) => item.id === 'dormitory')!;
  const observerPlayerIds = world.players.map((p) => p.id);
  const presenceDuringSimulation: AlanPresenceStatus = resolveAlanPlayer(world, descriptions) ? 'online' : 'away';
  const activities: string[] = [
    ...initialActivities,
    '深夜過去了。大多數人都在宿舍休息，校園沒有再開公開會議。',
  ];
  const implications: string[] = [...initialImplications];

  const addNightEvent = async (
    player: PlayerDoc | undefined,
    type: string,
    actorName: string,
    descriptionZh: string,
    interpretationZh: string,
    reactionDialogueZh: string,
    futureImplicationsZh: string,
    importance = 6,
  ) => {
    if (!player || activities.length >= 3) return;
    const recentSimilarEvent = await ctx.db
      .query('worldEvents')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .order('desc')
      .filter((q) =>
        q.and(
          q.eq(q.field('type'), type),
          q.gt(q.field('createdAt'), Date.now() - 6 * 3_600_000),
        ),
      )
      .first();
    if (recentSimilarEvent) {
      const quietSummary = `${displayNameZh(actorName)}已經留下深夜紀錄，這次校園沒有再新增同樣事件。`;
      if (!activities.includes(quietSummary)) activities.push(quietSummary);
      if (!implications.includes(futureImplicationsZh)) implications.push(futureImplicationsZh);
      return;
    }
    await appendMemory(ctx, world._id, player.id, descriptionZh);
    await appendRecentEvent(ctx, world._id, {
      type,
      actorPlayerId: player.id,
      actorName,
      source: 'world_simulation_event',
      happenedDuringAlanPresence: presenceDuringSimulation,
      observerPlayerIds,
      descriptionZh,
      descriptionEn: `${actorName} had a quiet late-night event.`,
      locationId: location.id,
      locationZh: location.labelZh,
      interpretationZh,
      reactionDialogueZh,
      futureImplicationsZh,
      importance,
      clock,
    });
    activities.push(descriptionZh);
    implications.push(futureImplicationsZh);
  };

  await addNightEvent(
    umi,
    'nightBriefingPrep',
    'Umi',
    '海深夜未眠，安靜整理明天給 Alan 的校長簡報，把誰變安靜、誰太快說沒事、誰可能沒休息排成三個重點。',
    '她沒有讓校園更吵，而是把今天的混亂整理成明天可以處理的順序。',
    '校長睡醒之前，我先把世界整理到不會一打開就爆炸的程度。',
    '明天早上，Alan 應該先聽海簡報，再決定要找曹操、真晝或麻衣談。',
    8,
  );

  if (pressure.socialDivision >= 45 || pressure.rumorIntensity >= 45) {
    await addNightEvent(
      caoCao,
      'lateNightStrategy',
      'CaoCao',
      '曹操沒有公開行動，只是在庭院邊重新想過明天的座位安排，避免求助的人一進正式空間就像被審問。',
      '這是少量秘密事件，不是公開會議；他的秩序觀正在變得更具體，但他不會單獨使用校長室。',
      '混亂不會因為大家睡著就消失。',
      '明天如果需要校長室，應該由海安排誰被邀請進去。',
      7,
    );
  } else if (pressure.studentAnxiety >= 45) {
    await addNightEvent(
      mahiru,
      'lateNightCare',
      'Mahiru Shiina',
      '真晝在睡前確認幾位學生的情緒，沒有追問，只是讓他們知道明天還可以慢慢說。',
      '她把深夜當成恢復安全感的時間，而不是繼續推進議題。',
      '今天先休息。明天醒來，我們再一起處理。',
      '如果 Alan 明天先關心學生狀態，校園焦慮會比較容易降下來。',
      7,
    );
  }

  const nextMorning = '明天早上，誰的沉默還留著，會成為校園最清楚的焦點。';
  activities.push(nextMorning);
  implications.push('海會建議 Alan：先聽簡報，再選一件事處理，不要半夜把所有人叫起來開會。');

  return {
    characterReactions: '大多數角色睡下了；少數角色只留下短暫、安靜的深夜行動。',
    worldChanges: activities.join('；'),
    futureImplications: implications.slice(0, 3).join('；'),
    storyDigest: nightStoryDigest(activities, pressure),
  };
}

function nightStoryDigest(activities: string[], pressure: WorldPressure): StoryDigestItem[] {
  const mainEvent =
    activities.find((activity) => activity.includes('海')) ??
    activities.find((activity) => activity.includes('真晝')) ??
    activities.find((activity) => activity.includes('曹操')) ??
    '深夜過去了。大多數人都在宿舍休息，校園沒有再開公開會議。';
  return [
    {
      happenedZh: '深夜過去了。大多數人都在宿舍休息，校園沒有再開公開會議。',
      changedZh: '校園節奏降下來了；角色不再像 24/7 會議室一樣無限對話。',
      whyItMattersZh: '休息本身會讓明天的選擇更有重量，也讓深夜事件顯得稀有。',
      suggestedActionZh: '明天早上先聽海簡報，不要半夜把所有人叫起來。',
    },
    {
      happenedZh: mainEvent,
      changedZh: `海把明天的主線整理出來；目前校園氣氛是${moodZh(pressure.mood)}。`,
      whyItMattersZh: 'Alan 回來時需要先理解世界狀態，而不是直接追加新功能。',
      suggestedActionZh: '先查看海簡報，再決定要找曹操、真晝或麻衣談。',
    },
    {
      happenedZh: '明天早上，誰的沉默還留著，會成為校園最清楚的焦點。',
      changedZh: `焦慮 ${pressure.studentAnxiety}、疏離 ${pressure.socialDivision}、傳聞 ${pressure.rumorIntensity}。`,
      whyItMattersZh: '世界沒有跳時間，但關係和壓力已經留下明天的伏筆。',
      suggestedActionZh: '先找海聽短簡報，再找一位昨天變安靜的人聊。',
    },
  ];
}

export const consolidateDailyMemory = mutation({
  args: {
    timeZone: v.optional(v.string()),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const timeZone = args.timeZone || 'America/Chicago';
    const { worldStatus, world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const clock = await ensureClock(ctx, worldStatus);
    const existing = await ctx.db
      .query('worldEvents')
      .withIndex('type', (q) => q.eq('worldId', world._id).eq('type', 'dailyMemoryConsolidation'))
      .order('desc')
      .take(5);
    const existingToday = existing.find((event) => event.clock?.day === clock.day);
    if (existingToday && !args.force) {
      return {
        alreadyConsolidated: true,
        day: clock.day,
        summaryZh: existingToday.descriptionZh,
        noteZh: '今天已經做過日終整理；若要重跑可傳入 { "force": true }。',
      };
    }
    for (const event of existing.filter((item) => item.clock?.day === clock.day)) {
      await ctx.db.patch(event._id, {
        outcomeQuality: 'repeated_noise',
        importance: Math.min(event.importance, 3),
        futureImplicationsZh: '這是一筆被後續日終整理取代的舊摘要，保留作為除錯痕跡，不應進入明天簡報。',
      });
    }

    const allEvents = await ctx.db
      .query('worldEvents')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .order('desc')
      .take(160);
    const todayEvents = allEvents
      .filter((event) => event.clock?.day === clock.day && event.type !== 'dailyMemoryConsolidation')
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const conversations = await archivedConversationSummariesForDay(ctx, world._id, descriptions, clock.day);
    const pressure = await currentWorldPressure(ctx, world._id);
    const meaningfulEvents = todayEvents
      .filter((event) => event.outcomeQuality !== 'repeated_noise')
      .filter((event) => event.importance >= 5 || event.source === 'player_action')
      .map((event) => displayTextZh(naturalizeSchoolText(event.descriptionZh) ?? event.descriptionZh));
    const worldSummary = compactUnique(meaningfulEvents, 4);
    const characterMemories = buildDailyCharacterMemories(
      GIIS_MAIN_CHARACTER_NAMES,
      todayEvents,
      conversations,
      pressure,
    );
    const relationshipShifts = buildDailyRelationshipShifts(todayEvents, conversations);
    const tomorrowHooks = buildTomorrowHooks(todayEvents, pressure, clock);
    const characterMemoryList = Object.entries(characterMemories).map(([nameZh, memoryZh]) => ({
      nameZh,
      memoryZh,
    }));
    const summaryText =
      worldSummary.length > 0
        ? worldSummary.join('；')
        : '今天沒有重大公開事件，校園比較像安靜地過了一天。';

    for (const name of GIIS_MAIN_CHARACTER_NAMES) {
      const player = findPlayerByName(world.players, descriptions, name);
      const memory = characterMemories[displayNameZh(name)];
      if (!player || !memory) continue;
      await appendMemory(
        ctx,
        world._id,
        player.id,
        `第 ${clock.day} 天日終記憶：${memory}`,
        dailyBeliefForName(name, memory),
      );
    }

    const observerPlayerIds = world.players.map((player) => player.id);
    await appendRecentEvent(ctx, world._id, {
      type: 'dailyMemoryConsolidation',
      actorName: 'Umi',
      source: 'system_event',
      happenedDuringAlanPresence: 'away',
      observerPlayerIds,
      descriptionZh: `海完成第 ${clock.day} 天的日終整理：${summaryText}`,
      descriptionEn: `Umi consolidated day ${clock.day} into daily memory.`,
      locationId: 'dormitory',
      locationZh: '宿舍',
      interpretationZh: `今天不會被當成雜訊丟掉；它會以世界摘要、角色記憶、關係變化與明天伏筆的形式留下來。`,
      reactionDialogueZh: '海：「明天不是重新開始。今天留下來的東西，我會幫 Alan 記住。」',
      futureImplicationsZh: tomorrowHooks.join('；') || '明天早上，海會先用今天的記憶整理校園焦點。',
      outcomeQuality: 'meaningful_new_information',
      importance: 8,
      clock,
    });

    return {
      alreadyConsolidated: false,
      day: clock.day,
      worldTimeLabelZh: worldTimeLabelZh(clock),
      worldSummary,
      characterMemories: characterMemoryList,
      relationshipShifts,
      tomorrowHooks,
      conversationsChecked: conversations.length,
      eventsChecked: todayEvents.length,
      noteZh: '日終記憶已寫入角色短期/長期記憶，並新增一筆校園動態作為明天簡報的錨點。',
    };
  },
});

async function archivedConversationSummariesForDay(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  day: number,
) {
  const nameByPlayerId = (id: string) => displayNameZh(descriptions.get(id)?.name ?? id);
  const archivedConversations = await ctx.db
    .query('archivedConversations')
    .withIndex('ended', (q) => q.eq('worldId', worldId))
    .order('desc')
    .take(80);
  const summaries: Array<{
    participants: string[];
    previewZh: string;
    ended: number;
  }> = [];
  for (const conversation of archivedConversations) {
    const messages = await ctx.db
      .query('messages')
      .withIndex('conversationId', (q) => q.eq('worldId', worldId).eq('conversationId', conversation.id))
      .collect();
    if (!messages.length) continue;
    const messageClockDay = messages.some((message) => {
      const dayMatch = displayTimeLabel(message._creationTime).includes(`5/${18 + day}`);
      return dayMatch || conversation.ended > Date.now() - 30 * 3_600_000;
    });
    if (!messageClockDay) continue;
    const participants = conversation.participants.map(nameByPlayerId);
    const preview = messages
      .slice(-2)
      .map((message) => `${nameByPlayerId(message.author)}：${naturalizeSchoolText(message.text) ?? message.text}`)
      .join(' / ');
    summaries.push({
      participants,
      previewZh: preview.slice(0, 120),
      ended: conversation.ended,
    });
    if (summaries.length >= 12) break;
  }
  return summaries.sort((a, b) => a.ended - b.ended);
}

function buildDailyCharacterMemories(
  names: string[],
  events: Doc<'worldEvents'>[],
  conversations: Array<{ participants: string[]; previewZh: string }>,
  pressure: WorldPressure,
) {
  const memoryByName: Record<string, string> = {};
  for (const name of names) {
    const displayName = displayNameZh(name);
    const directEvents = events.filter((event) => {
      return (
        event.actorName === name ||
        (event.source === 'player_action' && event.targetName === name)
      );
    });
    const mentionedEvents = events.filter((event) => {
      const text = `${event.descriptionZh} ${event.interpretationZh ?? ''} ${event.futureImplicationsZh ?? ''}`;
      return text.includes(displayName);
    });
    const relatedConversation = conversations.find((conversation) => conversation.participants.includes(displayName));
    const eventMemory = directEvents
      .filter((event) => event.outcomeQuality !== 'repeated_noise')
      .map((event) => naturalizeSchoolText(event.descriptionZh) ?? event.descriptionZh)
      .at(-1);
    const mentionedMemory = mentionedEvents
      .filter((event) => event.outcomeQuality !== 'repeated_noise')
      .map((event) => naturalizeSchoolText(event.descriptionZh) ?? event.descriptionZh)
      .at(-1);
    memoryByName[displayName] =
      name === DEFAULT_NAME
        ? defaultDailyMemoryForName(name, pressure)
        : eventMemory ??
          (relatedConversation
            ? `今天和 ${relatedConversation.participants.filter((item) => item !== displayName).join('、')} 留下一段對話；${conversationMemorySummary(relatedConversation.previewZh)}`
            : mentionedMemory ?? defaultDailyMemoryForName(name, pressure));
  }
  return memoryByName;
}

function conversationMemorySummary(previewZh: string) {
  const text = displayTextZh(previewZh);
  if (text.includes('取消') || text.includes('不要落在我身上') || text.includes('負責') || text.includes('任務')) {
    return '他們談到執行負擔與誰不該再默默接住所有事情。';
  }
  if (text.includes('門口') || text.includes('位置') || text.includes('排除') || text.includes('吃飯')) {
    return '他們談到誰被留在外面，以及明天能不能用一個小邀請把人帶回來。';
  }
  if (text.includes('安靜') || text.includes('說不出口') || text.includes('真心話')) {
    return '他們談到校園裡變小聲的地方，以及誰需要被溫柔地看見。';
  }
  if (text.includes('AI 社') || text.includes('規則') || text.includes('邊界') || text.includes('風險')) {
    return '他們談到 Alan 推進速度帶來的壓力，以及有人還沒把話說清楚。';
  }
  if (text.includes('休息') || text.includes('睡') || text.includes('累')) {
    return '他們談到疲憊、休息，以及不要把所有事情都變成下一步。';
  }
  return `他們留下了一段可以明天延續的小對話。`;
}

function defaultDailyMemoryForName(name: string, pressure: WorldPressure) {
  if (name === DEFAULT_NAME) return 'Alan 離校處理其他公司的事情；校園仍會把他今天留下的節奏記住。';
  if (name === 'Umi') return '海把今天整理成明天能讀懂的簡報，並注意 Alan 需要先看人，不是先加功能。';
  if (name === 'Asuna') return '明日奈記得今天的執行壓力沒有完全消失，明天不能再默默接下所有事情。';
  if (name === 'Mai') return '麻衣記得今天仍有一些沒有說清楚的邊界，明天需要把模糊感變得更具體。';
  if (name === 'Mahiru Shiina') return '真晝記得學生的安靜不是空白，可能是疲憊或不敢說錯話。';
  if (name === 'CaoCao') return '曹操記得秩序不只是一套規則，也可能是一張留給安靜學生的椅子。';
  if (name === 'Liu Bei') return '劉備記得共同體不是從會議開始，而是從有人願意多留一個位置開始。';
  return `今天的校園氣氛是${moodZh(pressure.mood)}，這件事會留到明天。`;
}

function buildDailyRelationshipShifts(
  events: Doc<'worldEvents'>[],
  conversations: Array<{ participants: string[]; previewZh: string }>,
) {
  const shifts = new Set<string>();
  for (const event of events) {
    if (event.actorName === DEFAULT_NAME && event.targetName) {
      shifts.add(`Alan 和 ${displayNameZh(event.targetName)} 之間多了一段「${actionTypeLabelZh(event.type)}」的記憶。`);
    }
    if (event.outcomeQuality === 'relationship_shift' && event.actorName && event.targetName) {
      shifts.add(`${displayNameZh(event.actorName)} 和 ${displayNameZh(event.targetName)} 的距離出現變化。`);
    }
  }
  for (const conversation of conversations.slice(-6)) {
    if (conversation.participants.length >= 2) {
      shifts.add(`${conversation.participants.slice(0, 2).join(' 和 ')} 今天留下了一段可以明天延續的對話。`);
    }
  }
  return [...shifts].slice(0, 6);
}

function buildTomorrowHooks(events: Doc<'worldEvents'>[], pressure: WorldPressure, clock: Clock) {
  const focus = dailyCampusFocusItems(events, pressure, { ...clock, hour: 9, minute: 0 });
  const hooks = new Set<string>(focus);
  if (pressure.studentAnxiety >= 45) hooks.add('明天先找真晝確認學生是不是只是表面沒事。');
  if (pressure.socialDivision >= 45) hooks.add('明天找劉備或曹操確認分裂感是不是正在成形。');
  if (pressure.rumorIntensity >= 45 || pressure.aiClubInfluence >= 55) hooks.add('明天把今天沒說完的話翻成可以好好回答的問題。');
  hooks.add('海明天早上會把今天的記憶整理成短簡報，不讓 Alan 從零開始。');
  return [...hooks].slice(0, 5);
}

function compactUnique(items: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const cleaned = trimZhSentence(displayTextZh(item));
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
    if (result.length >= limit) break;
  }
  return result;
}

function dailyBeliefForName(name: string, memory: string) {
  if (name === 'Umi') return '我不是只做即時簡報；我會把 Alan 不在時的世界變化整理成明天能延續的記憶。';
  if (name === 'Mahiru Shiina') return '安靜、疲憊和說不出口的話，都應該被當成真實訊號。';
  if (name === 'Mai') return '世界如果長得比理解還快，模糊感就會變成別人的負擔。';
  if (name === 'CaoCao') return '秩序如果有意義，必須讓不敢進來的人也有位置。';
  if (name === 'Liu Bei') return '共同體需要靠小邀請和日常陪伴維持，不只是靠公開討論。';
  if (name === 'Asuna') return '執行負擔如果一直沒被看見，可靠也會變成疲憊。';
  if (name === DEFAULT_NAME) return `Alan 的一天會被世界記住：${memory}`;
  return undefined;
}

async function executeQueuedIntentions(
  ctx: MutationCtx,
  world: Doc<'worlds'>,
  descriptions: Map<string, Doc<'playerDescriptions'>>,
  clock: Clock,
  activities: string[],
  implications: string[],
  maxExecutions = 2,
  presenceDuringSimulation: AlanPresenceStatus = 'online',
) {
  const profiles = await ctx.db
    .query('schoolProfiles')
    .withIndex('worldId', (q) => q.eq('worldId', world._id))
    .collect();
  const observerPlayerIds = world.players.map((p) => p.id);
  const location = schoolLocationForClock(clock);
  let executed = 0;
  for (const profile of profiles) {
    if (executed >= maxExecutions) break;
    const [intention, ...remaining] = profile.shortTermIntentions ?? [];
    if (!intention) continue;
    const name = descriptions.get(profile.playerId)?.name ?? profile.playerId;
    const action = actionFromIntention(name, intention, location.labelZh);
    await ctx.db.patch(profile._id, {
      shortTermIntentions: remaining,
      shortTermMemory: [`我把意圖轉成行動：${intention}`, ...profile.shortTermMemory].slice(0, 12),
    });
    await appendRecentEvent(ctx, world._id, {
      type: action.type,
      actorPlayerId: profile.playerId,
      actorName: name,
      source: 'autonomous_agent_action',
      happenedDuringAlanPresence: presenceDuringSimulation,
      observerPlayerIds,
      descriptionZh: action.descriptionZh,
      descriptionEn: `${name} acted on a queued intention.`,
      locationId: location.id,
      locationZh: location.labelZh,
      interpretationZh: action.interpretationZh,
      reactionDialogueZh: action.reactionDialogueZh,
      futureImplicationsZh: action.futureImplicationsZh,
      importance: action.importance,
      clock,
    });
    activities.push(action.descriptionZh);
    implications.push(action.futureImplicationsZh);
    executed++;
  }
}

function actionFromIntention(name: string, intention: string, locationZh: string) {
  if (name === 'CaoCao') {
    return {
      type: 'intentionRoomOrder',
      descriptionZh: `曹操在${locationZh}把幾張椅子重新排開，準備讓明天要道歉或求助的人不用像被審問。`,
      interpretationZh: '他把對話結論轉化成空間秩序，而不只是立場設計。',
      reactionDialogueZh: '位置不對，話就說不出來。',
      futureImplicationsZh: '曹操的秩序感可能成為校園裡讓人敢開口的保護，也可能被誤會成冷淡。',
      importance: 8,
    };
  }
  if (name === 'Liu Bei') {
    return {
      type: 'intentionInvitation',
      descriptionZh: `劉備在${locationZh}決定明天午餐邀請真晝和麻衣一起坐一下；他擔心沉默的學生正在被大家的忙碌推到邊緣。`,
      interpretationZh: '他用關係與公平降低排除感。',
      reactionDialogueZh: '大家一起談，才不會有人被推到角落。',
      futureImplicationsZh: '劉備可能更早發現誰需要被邀請，而不是等事情變成問題。',
      importance: 7,
    };
  }
  if (name === 'Mai') {
    return {
      type: 'intentionPlainTruth',
      descriptionZh: `麻衣在${locationZh}寫下三句今天最不自然的話：太快說沒事、太快說可以、太快把難過講成玩笑。`,
      interpretationZh: '她把抽象擔憂轉成可被看見的生活細節。',
      reactionDialogueZh: '先把話講清楚，再談怎麼辦。',
      futureImplicationsZh: 'Alan 可以用這份清單找出今天真正需要被關心的人。',
      importance: 7,
    };
  }
  if (name === 'Umi') {
    return {
      type: 'intentionTaskPlan',
      descriptionZh: `海在${locationZh}整理校長簡報，把誰變安靜、誰沒吃飯、誰又說自己沒事放到同一張短表上。`,
      interpretationZh: '她把混亂討論轉成情緒、記憶與下一步的生活地圖。',
      reactionDialogueZh: '校長回來就不用再從零開始亂衝了。我會先把今天誰變了講清楚。',
      futureImplicationsZh: 'Alan 可以依照簡報理解今天的情緒變化，再選擇要關心、道歉或安靜陪一下。',
      importance: 8,
    };
  }
  if (name === 'Mahiru Shiina') {
    return {
      type: 'intentionCare',
      descriptionZh: `真晝在${locationZh}沒有直接追問，而是陪幾位學生坐了一會兒；她注意到有人說「沒事」時突然低頭，於是記下這不是害羞，是壓力。`,
      interpretationZh: '她把對話後的細微情緒訊號轉成照護行動，也提醒世界不要只剩效率。',
      reactionDialogueZh: '先不用急著回答。你可以慢慢說，這裡不是測試。',
      futureImplicationsZh: '學生壓力與 social exclusion 會更早被看見，真晝也可能開始主動影響世界節奏。',
      importance: 7,
    };
  }
  return {
    type: 'intentionExecution',
    descriptionZh: `${displayNameZh(name)} 在${locationZh}把剛才的對話變成一個具體下一步：${intention}`,
    interpretationZh: '對話開始轉化成行動。',
    reactionDialogueZh: '我們至少先做一件具體的事。',
    futureImplicationsZh: '這個行動會成為後續對話的新素材。',
    importance: 6,
  };
}

async function observeSnapshot(db: DatabaseReader, worldId: Id<'worlds'>, observerName: string) {
  const world = await db.get(worldId);
  if (!world) throw new Error(`World ${worldId} not found`);
  const worldStatus = await db
    .query('worldStatus')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .first();
  const descriptions = await descriptionsByPlayer(db, worldId);
  const observer = findPlayerByName(world.players, descriptions, observerName);
  const presence = alanPresence(world, descriptions);
  const clock = currentClockForStatus(worldStatus);
  const currentLocation =
    (observer ? nearestSchoolLocation(observer.position) : undefined) ?? schoolLocationForClock(clock);
  const nearbyAgents = observer
    ? world.players
        .filter((p) => p.id !== observer.id && distance(p, observer) <= 8)
        .map((p) => ({
          playerId: p.id,
          name: descriptions.get(p.id)?.name ?? p.id,
          role: undefined as string | undefined,
          areaZh: nearestSchoolLocation(p.position)?.labelZh ?? '校園通道',
          distance: Math.round(distance(p, observer) * 10) / 10,
        }))
    : [];
  for (const agent of nearbyAgents) {
    const profile = await db
      .query('schoolProfiles')
      .withIndex('player', (q) => q.eq('worldId', worldId).eq('playerId', agent.playerId))
      .first();
    agent.role = profile?.role;
  }
  const conversations = world.conversations.map((c) => ({
    conversationId: c.id,
    participants: c.participants.map((p) => descriptions.get(p.playerId)?.name ?? p.playerId),
    numMessages: c.numMessages,
  }));
  const recentLocalEvents = (
    await db
      .query('worldEvents')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .order('desc')
      .take(8)
  ).map(displayWorldEvent);
  const umiDescription = [...descriptions.values()].find(
    (description) => description.name === 'Umi',
  );
  const umiProfile = umiDescription
    ? await db
        .query('schoolProfiles')
        .withIndex('player', (q) =>
          q.eq('worldId', worldId).eq('playerId', umiDescription.playerId),
        )
        .first()
    : undefined;
  const summaryItems = recentLocalEvents
    .slice(0, 3)
    .map((e) => e.descriptionZh)
    .join('；');
  const nearbyText =
    nearbyAgents.length > 0
      ? nearbyAgents.map((agent) => `${displayNameZh(agent.name)}在${agent.areaZh}`).join('，')
      : 'Alan 附近暫時沒有其他人。';
  const conversationText =
    conversations.length > 0
      ? `你聽見 ${conversations
          .slice(0, 2)
          .map((conversation) => conversation.participants.map(displayNameZh).join(' 和 '))
          .join('；')} 正在交談。`
      : '走廊裡暫時沒有明顯的對話聲。';
  const eventText = summaryItems || '目前沒有重大事件留下痕跡。';
  const sceneDescription =
    observerName === DEFAULT_NAME && !observer
      ? displayTextZh(`Alan 目前離校處理其他公司的事情。現在是${worldTimeLabelZh(clock)}，校園仍在${currentLocation.labelZh}運轉。${conversationText} 最近的校園氣氛：${eventText}`)
      : displayTextZh(`現在是${worldTimeLabelZh(clock)}，校園重心在${currentLocation.labelZh}。${nearbyText}${nearbyAgents.length > 0 ? '。' : ''}${conversationText} 最近的校園氣氛：${eventText}`);
  return {
    playerIdentity: presence,
    clock,
    schedule: scheduleLabel(clock),
    currentLocation,
    sceneDescription,
    nearbyAgents,
    conversations,
    recentLocalEvents,
    umiSummary: umiProfile
      ? `海（${umiProfile.role}）彙整：${summaryItems || '目前沒有重大事件。'}`
      : undefined,
  };
}

export const observe = query({
  args: { observerName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { world } = await defaultWorld(ctx);
    return observeSnapshot(ctx.db, world._id, args.observerName ?? 'Alan');
  },
});

export const campusSocialState = query({
  args: { timeZone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const timeZone = args.timeZone || 'America/Chicago';
    const { worldStatus, world } = await defaultWorld(ctx);
    const socialClock = currentClockForStatus(worldStatus, timeZone);
    const worldStartRealDate = giisWorldStartRealDate(worldStatus.worldStartRealDate);
    const isTodayCreatedAt = (createdAt?: number) =>
      !createdAt || clockAt(createdAt, timeZone, worldStartRealDate).day === socialClock.day;
    const isTodayEvent = (event: { clock?: Clock; createdAt?: number }) =>
      (event.clock?.day ?? (event.createdAt ? clockAt(event.createdAt, timeZone, worldStartRealDate).day : socialClock.day)) ===
      socialClock.day;
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const profiles = await ctx.db
      .query('schoolProfiles')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();
    const recentEvents = (
      await ctx.db
        .query('worldEvents')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .order('desc')
        .take(8)
    ).map(displayWorldEvent).filter(isTodayEvent);
    const latestDailyOpening = (
      await ctx.db
        .query('worldEvents')
        .withIndex('type', (q) => q.eq('worldId', world._id).eq('type', 'dailyOpeningFocus'))
        .order('desc')
        .take(1)
    ).map(displayWorldEvent).filter(isTodayEvent);
    const events = [
      ...latestDailyOpening,
      ...recentEvents.filter(
        (event) => !latestDailyOpening.some((dailyEvent) => dailyEvent.eventId === event.eventId),
      ),
    ];
    const displayStoredWorldLabel = (createdAt: number, _fallback?: string) =>
      worldTimeLabelZh(clockAt(createdAt, timeZone, worldStartRealDate));
    const notifications = (
      await ctx.db
        .query('schoolNotifications')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .order('desc')
        .take(10)
    )
      .filter((item) => isTodayCreatedAt(item.createdAt))
      .map((item) => ({
        ...item,
        contentZh: naturalizeSchoolText(item.contentZh) ?? item.contentZh,
        worldTimeLabelZh: displayStoredWorldLabel(item.createdAt, item.worldTimeLabelZh),
        timestampLabelZh: `${displayTimeLabel(item.createdAt, timeZone)}｜${displayStoredWorldLabel(
          item.createdAt,
          item.worldTimeLabelZh,
        )}`,
      }));
    const rumors = (
      await ctx.db
        .query('schoolRumors')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .order('desc')
        .take(5)
    )
      .filter((item) => isTodayCreatedAt(item.createdAt))
      .map((item) => ({
        ...item,
        contentZh: naturalizeSchoolText(item.contentZh) ?? item.contentZh,
        worldTimeLabelZh: displayStoredWorldLabel(item.createdAt, item.worldTimeLabelZh),
        timestampLabelZh: `${displayTimeLabel(item.createdAt, timeZone)}｜${displayStoredWorldLabel(
          item.createdAt,
          item.worldTimeLabelZh,
        )}`,
      }));
    const clubs = (
      await ctx.db
        .query('schoolClubs')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .order('desc')
        .take(10)
    ).map((club) => ({
      clubId: club.clubId,
      nameZh: club.nameZh,
      founderName: club.founderName,
      founderDisplayNameZh: displayNameZh(club.founderName),
      members: club.members,
      memberDisplayNamesZh: club.members.map(displayNameZh),
      statusZh: club.statusZh,
      influence: club.influence,
      activity: club.activity,
      currentTensionZh: club.currentTensionZh,
      relatedEventIds: club.relatedEventIds,
      updatedAt: club.updatedAt,
      updatedAtLabelZh: displayTimeLabel(club.updatedAt, timeZone),
    }));
    const worldPressure = await currentWorldPressure(ctx, world._id);
    const alanBehaviorProfile = await currentAlanBehaviorProfile(ctx, world._id, descriptions);
    const alanDescription = [...descriptions.values()].find((description) => description.name === DEFAULT_NAME);
    const activePlayerIds = new Set(world.players.map((player) => player.id));
    const playersById = new Map(world.players.map((player) => [player.id, player]));
    const activeConversationPlayerIds = new Set(
      world.conversations.flatMap((conversation) =>
        conversation.participants.map((participant) => participant.playerId),
      ),
    );
    const todayRumor = rumors[0]
      ? `有人正在這樣轉述：${rumors[0].contentZh}`
      : worldPressure.rumorIntensity >= 45
        ? '有些話還沒變成明確傳聞，但學生已經開始互相試探。'
        : '目前沒有新的明確傳聞。';
    const todayNeedsAlanAction =
      principalTasksFromEvents(events, worldPressure)[0]?.title ??
      (worldPressure.mood === 'emotionally_exhausted'
        ? '先讓校園慢下來，確認誰需要休息。'
        : '先選一位角色好好聊，不要一次處理整個世界。');
    const alanRelationshipSignals = alanDescription
      ? (
          await ctx.db
            .query('schoolRelationships')
            .withIndex('subject', (q) => q.eq('worldId', world._id))
            .collect()
        )
          .filter((relationship) => relationship.objectPlayerId === alanDescription.playerId)
          .map((relationship) => {
            const subjectName = descriptions.get(relationship.subjectPlayerId)?.name ?? relationship.subjectPlayerId;
            return {
              characterName: subjectName,
              displayNameZh: displayNameZh(subjectName),
              signalZh: emotionalSignalForRelationship(subjectName, relationship.dimensions, relationship.narrative),
            };
          })
          .filter((item) => item.signalZh)
      : [];
    const residuePilotNames = new Set(['海', '真晝', '明日奈']);
    const latestResiduesByPlayerId = new Map<string, { lineZh: string; timestampLabelZh: string }>();
    for (const profile of profiles.filter((item) => activePlayerIds.has(item.playerId))) {
      const name = displayNameZh(descriptions.get(profile.playerId)?.name ?? profile.playerId);
      if (!residuePilotNames.has(name)) continue;
      const recentMemories = await ctx.db
        .query('memories')
        .withIndex('playerId_type', (q) =>
          q.eq('playerId', profile.playerId).eq('data.type', 'conversation'),
        )
        .order('desc')
        .take(8);
      const residueMemory = recentMemories
        .map((memory) => ({
          lineZh: residueFromMemoryDescription(memory.description),
          createdAt: memory._creationTime,
        }))
        .find((entry) => entry.lineZh);
      if (residueMemory) {
        latestResiduesByPlayerId.set(profile.playerId, {
          lineZh: naturalizeSchoolText(residueMemory.lineZh) ?? residueMemory.lineZh,
          timestampLabelZh: displayTimeLabel(residueMemory.createdAt, timeZone),
        });
      }
    }
    const recentKickSignalsByPlayerId = new Map<string, { lineZh: string; timestampLabelZh: string }>();
    const recentKickEvents = await ctx.db
      .query('worldEvents')
      .withIndex('type', (q) => q.eq('worldId', world._id).eq('type', 'kick'))
      .order('desc')
      .take(20);
    for (const event of recentKickEvents.filter(isTodayEvent)) {
      if (!event.targetPlayerId || recentKickSignalsByPlayerId.has(event.targetPlayerId)) continue;
      const targetName = displayNameZh(event.targetName ?? descriptions.get(event.targetPlayerId)?.name ?? event.targetPlayerId);
      recentKickSignalsByPlayerId.set(event.targetPlayerId, {
        lineZh: `${targetName}剛被 Alan 當眾踢了一腳，暫時不太想靠近人群。`,
        timestampLabelZh: displayTimeLabel(event.createdAt, timeZone),
      });
    }
    return {
      timeZone,
      worldPressure,
      worldMoodZh: moodZh(worldPressure.mood),
      worldMoodDescriptionZh: worldMoodDescriptionZh(worldPressure),
      alanBehaviorProfile,
      dailyFocus: dailyCampusFocusItems(events, worldPressure, socialClock),
      today: {
        focus: dailyCampusFocusItems(events, worldPressure, socialClock)[0],
        moodZh: moodZh(worldPressure.mood),
        rumorZh: todayRumor,
        needsAlanActionZh: todayNeedsAlanAction,
      },
      notifications,
      rumors,
      clubs,
      alanRelationshipSignals,
      emotions: profiles
        .filter((profile) => activePlayerIds.has(profile.playerId))
        .map((profile) => {
          const name = descriptions.get(profile.playerId)?.name ?? profile.playerId;
          const player = playersById.get(profile.playerId);
          const location = player ? nearestSchoolLocation(player.position) : undefined;
          const kickSignal = recentKickSignalsByPlayerId.get(profile.playerId);
          const availability = kickSignal ? 'avoiding' : availabilityForCharacter(
            name,
            socialClock,
            worldPressure,
            activeConversationPlayerIds.has(profile.playerId),
          );
          const quietState = kickSignal
            ? 'silent'
            : quietStateForCharacter(name, availability, worldPressure, location?.id);
          const sleepState = sleepStateForName(name, socialClock);
          const residue = latestResiduesByPlayerId.get(profile.playerId);
          return {
            playerId: profile.playerId,
            name,
            currentEmotion: profile.currentEmotion ?? emotionForProfile(name),
            sleepState,
            statusZh: sleepStateLabelZh(sleepState),
            availability,
            availabilityZh: availabilityLabelZh(availability),
            quietState,
            quietLineZh: kickSignal?.lineZh ?? quietLineForCharacter(name, quietState, location?.id),
            recentImpactZh: kickSignal?.lineZh,
            recentImpactTimestampLabelZh: kickSignal?.timestampLabelZh,
            residueLineZh: residue?.lineZh,
            residueTimestampLabelZh: residue?.timestampLabelZh,
          };
        }),
      principalTasks: principalTasksFromEvents(events, worldPressure),
      events: events.map((event) => ({
        ...event,
        worldTimeLabelZh: event.createdAt
          ? displayStoredWorldLabel(event.createdAt, event.worldTimeLabelZh)
          : event.worldTimeLabelZh,
        timestampLabelZh:
          event.createdAt
            ? `${displayTimeLabel(event.createdAt, timeZone)}｜${displayStoredWorldLabel(
                event.createdAt,
                event.worldTimeLabelZh,
              )}`
            : undefined,
      })),
    };
  },
});

export const worldPressure = query({
  args: {},
  handler: async (ctx) => {
    const { world } = await defaultWorld(ctx);
    const pressure = await currentWorldPressure(ctx, world._id);
    return {
      ...pressure,
      moodZh: moodZh(pressure.mood),
      descriptionZh: worldMoodDescriptionZh(pressure),
    };
  },
});

export const campusTimeline = query({
  args: {
    timeZone: v.optional(v.string()),
    characterName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timeZone = args.timeZone || 'America/Chicago';
    const { worldStatus, world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const nameByPlayerId = (id: string) => displayNameZh(descriptions.get(id)?.name ?? id);
    const worldLabelForCreatedAt = (createdAt?: number, fallback?: string) =>
      createdAt
        ? worldTimeLabelZh(clockAt(createdAt, timeZone, giisWorldStartRealDate(worldStatus.worldStartRealDate)))
        : fallback;
    const selectedDescription = args.characterName
      ? [...descriptions.values()].find((description) => description.name === args.characterName)
      : undefined;

    const events = (
      await ctx.db
        .query('worldEvents')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .order('desc')
        .take(60)
    ).map(displayWorldEvent);
    const importantEvents = (
      await ctx.db
        .query('worldEvents')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .order('desc')
        .take(240)
    )
      .filter((event) => event.importance >= 7)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 24)
      .map(displayWorldEvent);
    const rumors = await ctx.db
      .query('schoolRumors')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .order('desc')
      .take(20);
    const archivedConversations = (
      await ctx.db
        .query('archivedConversations')
        .withIndex('ended', (q) => q.eq('worldId', world._id))
        .order('desc')
        .take(20)
    );
    const conversationEntries = [];
    const characterConversations = [];
    for (const conversation of archivedConversations) {
      const messages = await ctx.db
        .query('messages')
        .withIndex('conversationId', (q) =>
          q.eq('worldId', world._id).eq('conversationId', conversation.id),
        )
        .collect();
      if (!messages.length) continue;
      const participants = conversation.participants.map(nameByPlayerId);
      const lastMessage = messages[messages.length - 1];
      const lastText = naturalizeSchoolText(lastMessage.text) ?? lastMessage.text;
      const previewMessages = messages.slice(-3).map((message) => ({
        author: nameByPlayerId(message.author),
        text: naturalizeSchoolText(message.text) ?? message.text,
        timestampLabelZh: displayTimeLabel(message._creationTime, timeZone),
      }));
      const transcriptMessages = messages.map((message) => ({
        author: nameByPlayerId(message.author),
        text: naturalizeSchoolText(message.text) ?? message.text,
        timestampLabelZh: displayTimeLabel(message._creationTime, timeZone),
      }));
      const transcriptText = transcriptMessages.map((message) => message.text).join('\n');
      const summary = naturalizeSchoolText(
        `${participants.join('、')} 結束了一段對話：「${lastText.slice(0, 48)}${lastText.length > 48 ? '...' : ''}」`,
      )!;
      const outcomeQuality = conversationOutcomeQualityFor(transcriptText, summary);
      const entry = {
        id: `conversation-${conversation.id}`,
        kind: 'conversation',
        createdAt: conversation.ended,
        timestampLabelZh: displayTimeLabel(conversation.ended, timeZone),
        locationId: undefined as string | undefined,
        locationZh: '校園對話',
        involvedCharacters: participants,
        summaryZh: summary,
        previewMessages,
        transcriptMessages,
        messageCount: messages.length,
        outcomeQuality,
      };
      conversationEntries.push(entry);
      if (selectedDescription && conversation.participants.includes(selectedDescription.playerId)) {
        characterConversations.push({
          ...entry,
          messageCount: messages.length,
        });
      }
    }

    const eventEntries = events.map((event) => {
      const inferredOutcomeQuality =
        event.type === 'conversationOutcome'
          ? event.outcomeQuality ??
            conversationOutcomeQualityFor(
              `${event.descriptionZh}\n${event.interpretationZh ?? ''}\n${event.futureImplicationsZh ?? ''}`,
              event.descriptionZh,
            )
          : event.outcomeQuality;
      return {
        id: event.eventId,
        kind: 'event',
        createdAt: event.createdAt ?? 0,
        timestampLabelZh:
          event.createdAt
            ? timestampLabelFor(
                event.createdAt,
                worldLabelForCreatedAt(event.createdAt, event.worldTimeLabelZh),
                timeZone,
              )
            : undefined,
        locationId: event.locationId,
        locationZh: event.locationZh,
        involvedCharacters: [event.actorName, event.targetName].filter(Boolean).map((name) => displayNameZh(name!)),
        summaryZh: event.descriptionZh,
        importance: event.importance,
        source: event.source,
        outcomeQuality: inferredOutcomeQuality,
      };
    });
    const rumorEntries = rumors.map((rumor) => ({
      id: rumor.rumorId,
      kind: 'rumor',
      createdAt: rumor.createdAt,
      timestampLabelZh: timestampLabelFor(
        rumor.createdAt,
        worldLabelForCreatedAt(rumor.createdAt, rumor.worldTimeLabelZh),
        timeZone,
      ),
      locationId: rumor.locationId,
      locationZh: rumor.locationZh ?? '校園傳聞',
      involvedCharacters: rumor.affectedCharacters.map(displayNameZh),
      summaryZh: naturalizeSchoolText(rumor.contentZh) ?? rumor.contentZh,
      spreadLevel: rumor.spreadLevel,
    }));
    const compactFeedEntries = (entries: Array<any>, limit: number) => {
      const seenSummaries = new Map<string, number>();
      let conversationOutcomes = 0;
      return entries
        .sort((a, b) => b.createdAt - a.createdAt)
        .filter((entry) => {
          const summaryKey = `${entry.kind}|${entry.summaryZh}`;
          const seenCount = seenSummaries.get(summaryKey) ?? 0;
          const isDailyFocus = String(entry.id).includes('dailyOpeningFocus');
          const isConversationOutcome = String(entry.id).includes('conversationOutcome');
          if (entry.kind === 'conversation' && entry.outcomeQuality === 'repeated_noise') return false;
          if (entry.outcomeQuality === 'repeated_noise') return false;
          if (isConversationOutcome) {
            conversationOutcomes += 1;
            if (conversationOutcomes > 8 && !isDailyFocus) return false;
          }
          if (seenCount >= 1 && !isDailyFocus) return false;
          seenSummaries.set(summaryKey, seenCount + 1);
          return true;
        })
        .slice(0, limit);
    };
    const timeline = compactFeedEntries([...eventEntries, ...rumorEntries, ...conversationEntries], 60);

    const sceneHistory = SchoolLocations.map((location) => ({
      locationId: location.id,
      locationZh: location.labelZh,
      entries: timeline
        .filter((entry) => entry.locationId === location.id)
        .slice(0, 6),
    }));
    const historicalHighlights = compactFeedEntries(importantEvents.map((event) => ({
      id: event.eventId,
      kind: 'event',
      createdAt: event.createdAt ?? 0,
      timestampLabelZh:
        event.createdAt
          ? timestampLabelFor(
              event.createdAt,
              worldLabelForCreatedAt(event.createdAt, event.worldTimeLabelZh),
              timeZone,
            )
          : undefined,
      locationId: event.locationId,
      locationZh: event.locationZh,
      involvedCharacters: [event.actorName, event.targetName].filter(Boolean).map((name) => displayNameZh(name!)),
      summaryZh: event.descriptionZh,
      importance: event.importance,
      source: event.source,
    })), 18);

    const selectedProfile = selectedDescription
      ? await ctx.db
          .query('schoolProfiles')
          .withIndex('player', (q) =>
            q.eq('worldId', world._id).eq('playerId', selectedDescription.playerId),
          )
          .first()
      : undefined;
    const characterEvents = args.characterName
      ? eventEntries
          .filter((entry) => entry.involvedCharacters.includes(displayNameZh(args.characterName!)))
          .slice(0, 8)
      : [];

    return {
      timeZone,
      timeline,
      sceneHistory,
      historicalHighlights,
      characterHistory: args.characterName
        ? {
            name: args.characterName,
            recentConversations: characterConversations.slice(0, 5),
            recentEvents: characterEvents,
            recentMemories: selectedProfile?.shortTermMemory?.slice(0, 5) ?? [],
            recentBeliefs: selectedProfile?.beliefs?.slice(0, 5) ?? [],
            recentThoughts: [
              ...(selectedProfile?.shortTermIntentions?.slice(0, 3) ?? []),
              ...(selectedProfile?.beliefs?.slice(0, 2) ?? []),
            ],
          }
        : undefined,
    };
  },
});

export const recentConversationEvalData = query({
  args: {
    timeZone: v.optional(v.string()),
    limit: v.optional(v.number()),
    sinceCreatedAt: v.optional(v.number()),
    compact: v.optional(v.boolean()),
    messagesPerConversation: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timeZone = args.timeZone || 'America/Chicago';
    const limit = Math.max(1, Math.min(args.limit ?? 12, 50));
    const messagesPerConversation =
      args.messagesPerConversation === undefined
        ? undefined
        : Math.max(1, Math.min(args.messagesPerConversation, 12));
    const { world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const nameByPlayerId = (id: string) => displayNameZh(descriptions.get(id)?.name ?? id);

    const archivedConversations = await ctx.db
      .query('archivedConversations')
      .withIndex('ended', (q) => q.eq('worldId', world._id))
      .order('desc')
      .take(args.sinceCreatedAt ? Math.max(limit * 4, 50) : limit);

    const memoryCacheByPlayerId = new Map<
      string,
      Map<
        string,
        {
          memoryLineZh?: string;
          residueLineZh?: string;
          memoryTimestampLabelZh?: string;
        }
      >
    >();
    const conversationMemoryTraceFor = async (participantId: string, conversationId: string) => {
      if (!memoryCacheByPlayerId.has(participantId)) {
        const recentMemories = await ctx.db
          .query('memories')
          .withIndex('playerId_type', (q) =>
            q.eq('playerId', participantId).eq('data.type', 'conversation'),
          )
          .order('desc')
          .take(40);
        const memoryByConversationId = new Map<
          string,
          {
            memoryLineZh?: string;
            residueLineZh?: string;
            memoryTimestampLabelZh?: string;
          }
        >();
        for (const memory of recentMemories) {
          if (memory.data.type !== 'conversation') continue;
          const conversationId = String(memory.data.conversationId);
          if (memoryByConversationId.has(conversationId)) continue;
          const residueLine = residueFromMemoryDescription(memory.description);
          const memoryLine = memoryTraceFromDescription(memory.description);
          if (!residueLine && !memoryLine) continue;
          memoryByConversationId.set(conversationId, {
            memoryLineZh: memoryLine || undefined,
            residueLineZh: residueLine
              ? naturalizeSchoolText(residueLine) ?? displayTextZh(residueLine)
              : undefined,
            memoryTimestampLabelZh: displayTimeLabel(memory._creationTime, timeZone),
          });
        }
        memoryCacheByPlayerId.set(participantId, memoryByConversationId);
      }
      return memoryCacheByPlayerId.get(participantId)?.get(conversationId);
    };
    const conversations = [];
    for (const conversation of archivedConversations) {
      if (args.sinceCreatedAt && conversation.ended < args.sinceCreatedAt) continue;
      const messages = await ctx.db
        .query('messages')
        .withIndex('conversationId', (q) =>
          q.eq('worldId', world._id).eq('conversationId', conversation.id),
        )
        .collect();
      if (!messages.length) continue;

      const participants = conversation.participants.map(nameByPlayerId);
      const participantSet = new Set(participants);
      const hasAlanParticipant = participantSet.has(DEFAULT_NAME);
      const messageEntries = messages.map((message) => ({
        author: nameByPlayerId(message.author),
        text: naturalizeSchoolText(message.text) ?? message.text,
        timestampLabelZh: displayTimeLabel(message._creationTime, timeZone),
        createdAt: message._creationTime,
      }));
      const transcriptEntries = messageEntries.sort(
        (a, b) => a.createdAt - b.createdAt,
      );
      const transcriptSource = messagesPerConversation && !hasAlanParticipant
        ? transcriptEntries.slice(-messagesPerConversation)
        : transcriptEntries;
      const transcriptMessages = transcriptSource.map((message) => ({
        author: message.author,
        text: message.text,
        timestampLabelZh: message.timestampLabelZh,
      }));
      const previewMessages = transcriptMessages.slice(-3);
      const lastText = transcriptMessages.at(-1)?.text ?? '';
      const summaryZh = `${participants.join('、')} 結束了一段對話：「${lastText.slice(0, 48)}${
        lastText.length > 48 ? '...' : ''
      }」`;
      const memoryTraces = (
        await Promise.all(
          conversation.participants.map(async (participant) => {
            const trace = await conversationMemoryTraceFor(participant, String(conversation.id));
            if (!trace?.memoryLineZh && !trace?.residueLineZh) return undefined;
            return {
              characterName: nameByPlayerId(participant),
              ...trace,
            };
          }),
        )
      ).filter(Boolean);
      const outcomeQuality = conversationOutcomeQualityFor(
        transcriptMessages.map((message) => message.text).join('\n'),
        summaryZh,
      );

      conversations.push(args.compact ? {
        id: `conversation-${conversation.id}`,
        kind: 'conversation',
        createdAt: conversation.ended,
        involvedCharacters: participants,
        transcriptMessages,
        messageCount: transcriptEntries.length,
        memoryTraces,
        outcomeQuality,
      } : {
        id: `conversation-${conversation.id}`,
        kind: 'conversation',
        createdAt: conversation.ended,
        timestampLabelZh: displayTimeLabel(conversation.ended, timeZone),
        involvedCharacters: participants,
        summaryZh,
        previewMessages,
        transcriptMessages,
        messageCount: transcriptEntries.length,
        memoryTraces,
        outcomeQuality,
      });
      if (conversations.length >= limit) break;
    }

    return {
      conversations,
      checkedAt: Date.now(),
      timeZone,
    };
  },
});

const UMI_MAHIRU_FALLBACK_MEMORY_MARKERS = [
  '這段先停在這裡',
  '先看見學生的不安，再談下一個功能',
  '我想去看看今天一直安靜的學生',
  '你剛才說沒人敢說真話時手在抖',
  '你剛才看劉備的眼神好像很擔心誰又沒被聽見',
  '妳又把別人的心事先接住了',
  '我聽見了。只是我也想確認',
  '妳是不是又把自己放到最後了',
  '今晚先少接一件事',
  '先看人，不是先加功能',
  '……先停一下',
  '我換個說法',
  '先不要重複',
  '今晚先去宿舍確認幾位學生的狀態',
  '確認誰因 AI 社、傳聞或派系壓力而不敢說真心話',
  '真正需要 Alan 先看見的情緒風險',
  '真晝感覺 Alan 的世界仍有被溫柔照顧的空間',
];

function hasUmiMahiruFallbackMarker(text?: string) {
  return Boolean(text && UMI_MAHIRU_FALLBACK_MEMORY_MARKERS.some((marker) => text.includes(marker)));
}

function isUmiMahiruPair(names: string[]) {
  return names.includes('Umi') && names.includes('Mahiru Shiina');
}

export const auditUmiMahiruFallbackPollution = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(50, Math.min(args.limit ?? 500, 1000));
    const { world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const nameForPlayer = (id: string) => descriptions.get(id)?.name ?? id;
    const targetPlayerIds = [...descriptions.entries()]
      .filter(([, description]) => description.name === 'Umi' || description.name === 'Mahiru Shiina')
      .map(([id]) => id);

    const archivedConversations = await ctx.db
      .query('archivedConversations')
      .withIndex('ended', (q) => q.eq('worldId', world._id))
      .order('desc')
      .take(limit);

    const fallbackArchivedConversations = [];
    for (const conversation of archivedConversations) {
      const participantNames = conversation.participants.map(nameForPlayer);
      if (!isUmiMahiruPair(participantNames)) continue;
      const messages = await ctx.db
        .query('messages')
        .withIndex('conversationId', (q) =>
          q.eq('worldId', world._id).eq('conversationId', conversation.id),
        )
        .collect();
      if (!messages.some((message) => hasUmiMahiruFallbackMarker(message.text))) continue;
      fallbackArchivedConversations.push({
        conversationId: conversation.id,
        ended: conversation.ended,
        participantNames,
        text: messages.map((message) => message.text).join(' / ').slice(0, 220),
      });
    }

    const fallbackMemories = [];
    for (const playerIdValue of targetPlayerIds) {
      const memories = await ctx.db
        .query('memories')
        .withIndex('playerId', (q) => q.eq('playerId', playerIdValue))
        .collect();
      for (const memory of memories) {
        if (!hasUmiMahiruFallbackMarker(memory.description)) continue;
        fallbackMemories.push({
          memoryId: memory._id,
          embeddingId: memory.embeddingId,
          playerName: nameForPlayer(memory.playerId),
          importance: memory.importance,
          description: memory.description.slice(0, 180),
        });
      }
    }

    const fallbackEvents = (
      await ctx.db
        .query('worldEvents')
        .withIndex('type', (q) => q.eq('worldId', world._id).eq('type', 'conversationOutcome'))
        .order('desc')
        .take(limit * 2)
    )
      .filter((event) =>
        (event.actorName === 'Umi' || event.actorName === 'Mahiru Shiina') &&
        (event.targetName === 'Umi' || event.targetName === 'Mahiru Shiina') &&
        hasUmiMahiruFallbackMarker(`${event.descriptionZh}\n${event.futureImplicationsZh ?? ''}`),
      )
      .map((event) => ({
        eventDocId: event._id,
        eventId: event.eventId,
        actorName: event.actorName,
        targetName: event.targetName,
        createdAt: event.createdAt,
        outcomeQuality: event.outcomeQuality,
        importance: event.importance,
        descriptionZh: event.descriptionZh,
      }));

    const fallbackNotifications = (
      await ctx.db
        .query('schoolNotifications')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .order('desc')
        .take(limit * 2)
    )
      .filter((notification) =>
        notification.type === 'relationship_change' &&
        (notification.relatedCharacterName === 'Umi' || notification.relatedCharacterName === 'Mahiru Shiina') &&
        hasUmiMahiruFallbackMarker(notification.contentZh),
      )
      .map((notification) => ({
        notificationDocId: notification._id,
        notificationId: notification.notificationId,
        relatedCharacterName: notification.relatedCharacterName,
        createdAt: notification.createdAt,
        contentZh: notification.contentZh,
      }));

    const pollutedProfiles = [];
    const profiles = await ctx.db
      .query('schoolProfiles')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();
    for (const profile of profiles) {
      const profileName = nameForPlayer(profile.playerId);
      if (profileName !== 'Umi' && profileName !== 'Mahiru Shiina') continue;
      const pollutedIntentions = (profile.shortTermIntentions ?? []).filter(hasUmiMahiruFallbackMarker);
      const pollutedShortMemory = profile.shortTermMemory.filter(hasUmiMahiruFallbackMarker);
      const pollutedLongMemory = profile.longTermMemory.filter(hasUmiMahiruFallbackMarker);
      const pollutedBeliefs = profile.beliefs.filter(hasUmiMahiruFallbackMarker);
      if (
        pollutedIntentions.length ||
        pollutedShortMemory.length ||
        pollutedLongMemory.length ||
        pollutedBeliefs.length
      ) {
        pollutedProfiles.push({
          profileId: profile._id,
          playerName: profileName,
          pollutedIntentions,
          pollutedShortMemory,
          pollutedLongMemory,
          pollutedBeliefs,
        });
      }
    }

    return {
      worldId: world._id,
      checkedAt: Date.now(),
      scannedArchivedConversations: archivedConversations.length,
      fallbackArchivedConversationCount: fallbackArchivedConversations.length,
      fallbackMemoryCount: fallbackMemories.length,
      fallbackEventCount: fallbackEvents.length,
      fallbackNotificationCount: fallbackNotifications.length,
      pollutedProfileCount: pollutedProfiles.length,
      fallbackArchivedConversations: fallbackArchivedConversations.slice(0, 20),
      fallbackMemories: fallbackMemories.slice(0, 20),
      fallbackEvents: fallbackEvents.slice(0, 20),
      fallbackNotifications: fallbackNotifications.slice(0, 20),
      pollutedProfiles,
      cleanupAvailable: true,
    };
  },
});

export const cleanupUmiMahiruFallbackPollution = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun !== false;
    const limit = Math.max(50, Math.min(args.limit ?? 500, 1000));
    const { world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const nameForPlayer = (id: string) => descriptions.get(id)?.name ?? id;
    const targetPlayerIds = [...descriptions.entries()]
      .filter(([, description]) => description.name === 'Umi' || description.name === 'Mahiru Shiina')
      .map(([id]) => id);

    const memoryIdsToDelete = new Set<Id<'memories'>>();
    const embeddingIdsToDelete = new Set<Id<'memoryEmbeddings'>>();
    const archivedConversationDocIdsToDelete = new Set<Id<'archivedConversations'>>();
    const messageIdsToDelete = new Set<Id<'messages'>>();
    const pollutedConversationIds = new Set<string>();
    const participatedTogetherIdsToDelete = new Set<Id<'participatedTogether'>>();

    const archivedConversations = await ctx.db
      .query('archivedConversations')
      .withIndex('ended', (q) => q.eq('worldId', world._id))
      .order('desc')
      .take(limit);
    for (const conversation of archivedConversations) {
      const participantNames = conversation.participants.map(nameForPlayer);
      if (!isUmiMahiruPair(participantNames)) continue;
      const messages = await ctx.db
        .query('messages')
        .withIndex('conversationId', (q) =>
          q.eq('worldId', world._id).eq('conversationId', conversation.id),
        )
        .collect();
      if (!messages.some((message) => hasUmiMahiruFallbackMarker(message.text))) continue;
      archivedConversationDocIdsToDelete.add(conversation._id);
      for (const message of messages) {
        messageIdsToDelete.add(message._id);
      }
      pollutedConversationIds.add(conversation.id);
    }

    for (const playerIdValue of targetPlayerIds) {
      const edges = await ctx.db
        .query('participatedTogether')
        .withIndex('playerHistory', (q) => q.eq('worldId', world._id).eq('player1', playerIdValue))
        .collect();
      for (const edge of edges) {
        if (pollutedConversationIds.has(edge.conversationId)) {
          participatedTogetherIdsToDelete.add(edge._id);
        }
      }
    }

    for (const playerIdValue of targetPlayerIds) {
      const memories = await ctx.db
        .query('memories')
        .withIndex('playerId', (q) => q.eq('playerId', playerIdValue))
        .collect();
      for (const memory of memories) {
        if (!hasUmiMahiruFallbackMarker(memory.description)) continue;
        memoryIdsToDelete.add(memory._id);
        embeddingIdsToDelete.add(memory.embeddingId);
      }
    }

    const eventIdsToDelete = (
      await ctx.db
        .query('worldEvents')
        .withIndex('type', (q) => q.eq('worldId', world._id).eq('type', 'conversationOutcome'))
        .order('desc')
        .take(limit * 2)
    )
      .filter((event) =>
        (event.actorName === 'Umi' || event.actorName === 'Mahiru Shiina') &&
        (event.targetName === 'Umi' || event.targetName === 'Mahiru Shiina') &&
        hasUmiMahiruFallbackMarker(`${event.descriptionZh}\n${event.futureImplicationsZh ?? ''}`),
      )
      .map((event) => event._id);

    const notificationIdsToDelete = (
      await ctx.db
        .query('schoolNotifications')
        .withIndex('worldId', (q) => q.eq('worldId', world._id))
        .order('desc')
        .take(limit * 2)
    )
      .filter((notification) =>
        notification.type === 'relationship_change' &&
        (notification.relatedCharacterName === 'Umi' || notification.relatedCharacterName === 'Mahiru Shiina') &&
        hasUmiMahiruFallbackMarker(notification.contentZh),
      )
      .map((notification) => notification._id);

    const profilePatches = [];
    const profiles = await ctx.db
      .query('schoolProfiles')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();
    for (const profile of profiles) {
      const profileName = nameForPlayer(profile.playerId);
      if (profileName !== 'Umi' && profileName !== 'Mahiru Shiina') continue;
      const shortTermIntentions = (profile.shortTermIntentions ?? []).filter(
        (item) => !hasUmiMahiruFallbackMarker(item),
      );
      const shortTermMemory = profile.shortTermMemory.filter((item) => !hasUmiMahiruFallbackMarker(item));
      const longTermMemory = profile.longTermMemory.filter((item) => !hasUmiMahiruFallbackMarker(item));
      const beliefs = profile.beliefs.filter((item) => !hasUmiMahiruFallbackMarker(item));
      const changed =
        shortTermIntentions.length !== (profile.shortTermIntentions ?? []).length ||
        shortTermMemory.length !== profile.shortTermMemory.length ||
        longTermMemory.length !== profile.longTermMemory.length ||
        beliefs.length !== profile.beliefs.length;
      if (changed) {
        profilePatches.push({
          profileId: profile._id,
          patch: {
            shortTermIntentions,
            shortTermMemory,
            longTermMemory,
            beliefs,
          },
        });
      }
    }

    if (!dryRun) {
      for (const messageId of messageIdsToDelete) {
        await ctx.db.delete(messageId);
      }
      for (const conversationDocId of archivedConversationDocIdsToDelete) {
        await ctx.db.delete(conversationDocId);
      }
      for (const edgeId of participatedTogetherIdsToDelete) {
        await ctx.db.delete(edgeId);
      }
      for (const memoryId of memoryIdsToDelete) {
        await ctx.db.delete(memoryId);
      }
      for (const embeddingId of embeddingIdsToDelete) {
        await ctx.db.delete(embeddingId);
      }
      for (const eventId of eventIdsToDelete) {
        await ctx.db.delete(eventId);
      }
      for (const notificationId of notificationIdsToDelete) {
        await ctx.db.delete(notificationId);
      }
      for (const item of profilePatches) {
        await ctx.db.patch(item.profileId, item.patch);
      }
    }

    return {
      worldId: world._id,
      dryRun,
      archivedConversationDocs: archivedConversationDocIdsToDelete.size,
      messageDocs: messageIdsToDelete.size,
      participatedTogetherDocs: participatedTogetherIdsToDelete.size,
      memoryDocs: memoryIdsToDelete.size,
      embeddingDocs: embeddingIdsToDelete.size,
      worldEventDocs: eventIdsToDelete.length,
      notificationDocs: notificationIdsToDelete.length,
      profileDocs: profilePatches.length,
    };
  },
});

export const cleanupActiveUmiMahiruFallbackConversation = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun !== false;
    const force = args.force === true;
    const { world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const nameForPlayer = (id: string) => descriptions.get(id)?.name ?? id;
    const targetPlayerIds = new Set(
      [...descriptions.entries()]
        .filter(([, description]) => description.name === 'Umi' || description.name === 'Mahiru Shiina')
        .map(([id]) => id),
    );
    const activeConversationIdsToRemove = new Set<string>();
    const messageIdsToDelete = new Set<Id<'messages'>>();

    for (const conversation of world.conversations) {
      const participantIds = conversation.participants.map((participant) => participant.playerId);
      const participantNames = participantIds.map(nameForPlayer);
      if (!isUmiMahiruPair(participantNames)) continue;
      const messages = await ctx.db
        .query('messages')
        .withIndex('conversationId', (q) =>
          q.eq('worldId', world._id).eq('conversationId', conversation.id),
        )
        .collect();
      const shouldRemove =
        force ||
        conversation.numMessages === 0 ||
        messages.some((message) => hasUmiMahiruFallbackMarker(message.text));
      if (!shouldRemove) continue;
      activeConversationIdsToRemove.add(conversation.id);
      for (const message of messages) {
        messageIdsToDelete.add(message._id);
      }
    }

    const patchedAgents = world.agents.map((agent) => {
      if (!targetPlayerIds.has(agent.playerId)) return agent;
      const inProgressConversationId =
        agent.inProgressOperation?.name === 'agentGenerateMessage' ||
        agent.inProgressOperation?.name === 'agentInviteToConversation';
      const shouldClearOperation =
        inProgressConversationId && activeConversationIdsToRemove.size > 0;
      const nextAgent = { ...agent };
      if (shouldClearOperation) {
        delete nextAgent.inProgressOperation;
      }
      if (agent.toRemember && activeConversationIdsToRemove.has(agent.toRemember)) {
        delete nextAgent.toRemember;
      }
      return nextAgent;
    });

    if (!dryRun && activeConversationIdsToRemove.size > 0) {
      await ctx.db.patch(world._id, {
        conversations: world.conversations.filter(
          (conversation) => !activeConversationIdsToRemove.has(conversation.id),
        ),
        agents: patchedAgents,
      });
      for (const messageId of messageIdsToDelete) {
        await ctx.db.delete(messageId);
      }
    }

    return {
      worldId: world._id,
      dryRun,
      force,
      activeConversationDocs: activeConversationIdsToRemove.size,
      messageDocs: messageIdsToDelete.size,
      clearedAgentOps: patchedAgents.filter((agent, index) =>
        world.agents[index]?.inProgressOperation && !agent.inProgressOperation,
      ).length,
    };
  },
});

function emotionForProfile(name: string): PortraitEmotion {
  if (name === 'Umi' || name === 'CaoCao' || name === 'Liu Bei') return 'smiling';
  if (name === 'Mahiru Shiina') return 'worried';
  if (name === 'Asuna' || name === 'Mai') return 'serious';
  return 'neutral';
}

export const playerAction = mutation({
  args: {
    actionType: playerActionType,
    targetName: v.optional(v.string()),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { worldStatus, world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const alan = requireAlanPlayer(world, descriptions);
    const target = args.targetName
      ? findPlayerByName(world.players, descriptions, args.targetName)
      : undefined;
    const targetName = target
      ? (descriptions.get(target.id)?.name ?? args.targetName)
      : args.targetName;
    const targetDisplayName = targetName ? displayNameZh(targetName) : undefined;
    const clock = await ensureClock(ctx, worldStatus);
    const location = schoolLocationForClock(clock);
    const text = args.text?.trim();
    if ((args.actionType === 'announce' || args.actionType === 'createClub') && !text) {
      throw new Error(
        args.actionType === 'announce'
          ? '公告內容需要由 Alan 親自輸入。海可以給你草稿，但不能替你發布。'
          : '社團名稱需要由 Alan 親自輸入。系統不會替 Alan 自動創社。',
      );
    }
    let descriptionZh = '';
    let descriptionEn = '';
    let reactionDialogueZh = '';
    let interpretationZh = '';
    let futureImplicationsZh = '';
    let importance = 5;

    switch (args.actionType) {
      case 'chat':
        descriptionZh = targetName
          ? `Alan 主動找 ${targetDisplayName} 說話。`
          : 'Alan 站在校園裡試著開啟一段對話。';
        descriptionEn = targetName
          ? `Alan started a chat with ${targetName}.`
          : 'Alan started a chat.';
        reactionDialogueZh = targetName
          ? `${targetDisplayName} 注意到 Alan 想談談。`
          : '附近的人注意到 Alan 想說話。';
        interpretationZh = '這是一個低風險的互動，可能讓關係慢慢累積。';
        futureImplicationsZh = targetName
          ? `${targetDisplayName} 之後可能更容易把 Alan 視為會主動溝通的人。`
          : '校園對話可能因此自然展開。';
        break;
      case 'checkIn':
        descriptionZh = targetName
          ? `Alan 沒有急著談大事，只是去確認 ${targetDisplayName} 今天還好不好。`
          : 'Alan 放慢腳步，確認附近的人今天狀態如何。';
        descriptionEn = targetName ? `Alan checked in on ${targetName}.` : 'Alan checked in on nearby students.';
        reactionDialogueZh = targetName
          ? `${targetDisplayName} 感覺 Alan 這次不是來推進事情，而是真的有注意到人。`
          : '附近氣氛稍微放鬆了一點。';
        interpretationZh = '這是低壓力的關心，不一定立刻推動主線，但會累積信任與安全感。';
        futureImplicationsZh = targetName
          ? `${targetDisplayName} 之後可能更願意在不確定時先找 Alan 說一句真話。`
          : '校園會慢慢把 Alan 記成一個會注意日常狀態的人。';
        importance = 6;
        break;
      case 'leaveMessage':
        descriptionZh = targetName
          ? `Alan 留訊息給 ${targetDisplayName}：「${text || '明天再聊也沒關係。'}」`
          : `Alan 留下一句訊息：「${text || '明天再慢慢處理。'}」`;
        descriptionEn = targetName ? `Alan left a message for ${targetName}.` : 'Alan left a message.';
        reactionDialogueZh = targetName
          ? `${targetDisplayName} 不一定立刻回覆，但會記得 Alan 留下的語氣。`
          : '這句話成為今天很小、但有人會回想起來的痕跡。';
        interpretationZh = '留言不是即時對話，適合保留距離、尊重對方狀態，或在夜晚不打擾別人。';
        futureImplicationsZh = targetName
          ? `${targetDisplayName} 之後可能根據這句留言決定要不要主動靠近 Alan。`
          : '之後的角色反應可能引用這句留言。';
        importance = 5;
        break;
      case 'askRumor':
        descriptionZh = targetName
          ? `Alan 問 ${targetDisplayName} 最近校園裡大家私下在傳什麼。`
          : 'Alan 留意最近校園裡正在流動的傳聞。';
        descriptionEn = targetName ? `Alan asked ${targetName} about rumors.` : 'Alan asked about rumors.';
        reactionDialogueZh = targetName
          ? `${targetDisplayName} 開始思考哪些話只是雜音，哪些話其實代表有人不敢直接說。`
          : '傳聞沒有立刻變成事件，但它讓校園裡的沉默多了一點輪廓。';
        interpretationZh = '詢問傳聞會讓角色把注意力放在被壓低的聲音，而不是只看公開發言。';
        futureImplicationsZh = targetName
          ? `${targetDisplayName} 可能之後帶回一個更具體的小線索，而不是立刻開大會。`
          : 'Umi 之後可能把這些低聲音整理進校園簡報。';
        importance = 6;
        break;
      case 'gift':
        descriptionZh = targetName
          ? `Alan 送給 ${targetDisplayName} ${text || '一份小禮物'}。`
          : `Alan 準備了${text || '一份小禮物'}。`;
        descriptionEn = targetName ? `Alan gave ${targetName} a gift.` : 'Alan prepared a gift.';
        reactionDialogueZh = targetName
          ? `${targetDisplayName} 收下後，開始思考這份好意背後的意思。`
          : '這份禮物讓附近氣氛稍微柔和了一點。';
        interpretationZh = '禮物會被角色依照個性解讀：可能是關心，也可能是策略。';
        futureImplicationsZh = targetName
          ? `${targetDisplayName} 對 Alan 的記憶多了一個比較柔軟的片段。`
          : '之後可以把禮物指定給某個角色，形成更清楚的關係記憶。';
        importance = 6;
        break;
      case 'announce':
        descriptionZh = `Alan 公告：「${text}」`;
        descriptionEn = 'Alan made a school announcement.';
        reactionDialogueZh = '所有人都聽見了公告，但每個人會依自己的立場解讀。';
        interpretationZh = '公告會成為公開事實，容易被後續事件引用。';
        futureImplicationsZh =
          '公開公告可能影響 Umi 的管理、Asuna 的執行，以及 CaoCao 的政治判斷。';
        importance = 7;
        break;
      case 'invite':
        descriptionZh = targetName
          ? `Alan 邀請 ${targetDisplayName} 加入接下來的校園行動。`
          : 'Alan 向附近的人發出校園行動邀請。';
        descriptionEn = targetName ? `Alan invited ${targetName}.` : 'Alan sent an invitation.';
        reactionDialogueZh = targetName
          ? `${targetDisplayName} 開始衡量是否接受 Alan 的邀請。`
          : '附近的人開始注意 Alan 的下一步。';
        interpretationZh = '邀請會被視為信任或拉攏，取決於角色與 Alan 的關係。';
        futureImplicationsZh = targetName
          ? `${targetDisplayName} 可能在之後的行動中更常被拉進 Alan 的計畫。`
          : '這可能形成一個鬆散的校園小隊。';
        importance = 6;
        break;
      case 'createClub':
        descriptionZh = `Alan 發起新社團：「${text}」。`;
        descriptionEn = 'Alan created a new club.';
        reactionDialogueZh = '學生們開始討論這個社團到底是實驗、社交，還是新的權力中心。';
        interpretationZh = '新社團會成為角色聚集與建立影響力的理由。';
        futureImplicationsZh = 'CaoCao 可能評估它的政治價值，Mahiru 會注意它是否照顧到學生狀態。';
        importance = 8;
        break;
      default:
        args.actionType satisfies never;
    }

    const observerIds = world.players.map((p) => p.id);
    const metadata = timestampMeta(clock);
    const actionEventId = eventId(args.actionType);
    await ctx.db.insert('worldEvents', {
      worldId: world._id,
      eventId: actionEventId,
      type: args.actionType,
      actorPlayerId: alan.id,
      targetPlayerId: target?.id,
      actorName: DEFAULT_NAME,
      targetName,
      source: 'player_action',
      happenedDuringAlanPresence: 'online',
      observerPlayerIds: observerIds,
      descriptionZh,
      descriptionEn,
      locationId: location.id,
      locationZh: location.labelZh,
      interpretationZh,
      reactionDialogueZh,
      futureImplicationsZh,
      importance,
      createdAt: metadata.createdAtUnix,
      ...metadata,
      clock,
    });
    if (args.actionType === 'createClub' && text) {
      await upsertSchoolClub(ctx, world._id, {
        nameZh: text,
        founderName: DEFAULT_NAME,
        eventId: actionEventId,
      });
    }
    await updateSocialLayerForEvent(ctx, world._id, {
      eventId: actionEventId,
      type: args.actionType,
      actorName: DEFAULT_NAME,
      targetName,
      source: 'player_action',
      descriptionZh,
      locationId: location.id,
      locationZh: location.labelZh,
      importance,
      clock,
      createdAt: metadata.createdAtUnix,
      ...metadata,
    });
    await upsertAlanBehaviorProfile(ctx, world._id, descriptions);

    if (target) {
      await appendMemory(
        ctx,
        world._id,
        target.id,
        `${descriptionZh} ${interpretationZh}`,
        args.actionType === 'gift'
          ? `Alan 可能正在用具體行動表達關心或拉近關係。`
          : args.actionType === 'checkIn'
            ? `Alan 注意到我的日常狀態，而不是只在需要推進事情時找我。`
            : args.actionType === 'leaveMessage'
              ? `Alan 留下訊息但沒有強迫我立刻回應；這可能讓我比較能保留自己的節奏。`
              : args.actionType === 'askRumor'
                ? `Alan 開始在意沒有被公開說出口的聲音。`
                : undefined,
      );
    }
    if (args.actionType === 'announce' || args.actionType === 'createClub') {
      for (const player of world.players) {
        if (player.id !== alan.id) await appendMemory(ctx, world._id, player.id, descriptionZh);
      }
    }

    const observation = await observeSnapshot(ctx.db, world._id, 'Alan');
    return {
      descriptionZh,
      interpretationZh,
      reactionDialogueZh,
      futureImplicationsZh,
      summary: buildNarrativeSummary(
        descriptionZh,
        reactionDialogueZh,
        observation.sceneDescription,
        futureImplicationsZh,
      ),
      observation,
    };
  },
});

export const currentScheduleContext = internalQuery({
  args: { worldId: v.id('worlds'), playerId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    const clock = normalizedClock(
      worldStatus?.worldClock,
      'America/Chicago',
      giisWorldStartRealDate(worldStatus?.worldStartRealDate),
    );
    const descriptions = args.playerId ? await descriptionsByPlayer(ctx.db, args.worldId) : undefined;
    const characterName = args.playerId ? descriptions?.get(args.playerId)?.name : undefined;
    const characterLocationId = characterName ? scheduledLocationForName(characterName, clock) : undefined;
    const location =
      SchoolLocations.find((item) => item.id === characterLocationId) ?? schoolLocationForClock(clock);
    return {
      clock,
      schedule: location.scheduleZh,
      location,
      isSleepHour: isSleepHour(clock),
      isWindingDownHour: isWindingDownHour(clock),
      canStartAutonomousConversations: !isSleepHour(clock),
      periodLabelZh: rhythmName(clock.hour),
      characterName,
    };
  },
});

export const debugState = query({
  args: {},
  handler: async (ctx) => {
    const { worldStatus, world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const activePlayerIds = new Set(world.players.map((p) => p.id));
    const clock = currentClockForStatus(worldStatus);
    const playerById = new Map(world.players.map((player) => [player.id, player]));
    const profiles = await ctx.db
      .query('schoolProfiles')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();
    const profileByPlayerId = new Map(profiles.map((profile) => [profile.playerId, profile]));
    return world.players.map((player) => {
      const name = descriptions.get(player.id)?.name ?? player.id;
      const profile = profileByPlayerId.get(player.id);
      const defaults = defaultProfile(name);
      const sleepState = sleepStateForName(name, clock);
      return {
        name,
        isHumanControlled: name === DEFAULT_NAME,
        isAutonomousAgent: name !== DEFAULT_NAME,
        role: profile?.role ?? defaults.role,
        persona: profile?.persona ?? defaults.persona,
        coreValues: profile?.coreValues ?? defaults.coreValues,
        communicationStyle: profile?.communicationStyle ?? defaults.communicationStyle,
        sleepState,
        statusZh: sleepStateLabelZh(sleepState),
        locationZh: nearestSchoolLocation(player.position)?.labelZh,
        playerId: player.id,
        position: player.position,
        speed: player.speed,
        movement: player.pathfinding
          ? {
              destination: player.pathfinding.destination,
              state: player.pathfinding.state.kind,
            }
          : undefined,
        shortTermMemory: (profile?.shortTermMemory ?? []).slice(0, 3),
        shortTermIntentions: profile?.shortTermIntentions ?? [],
        beliefs: (profile?.beliefs ?? defaults.beliefs).slice(0, 3),
        initialRelationships: profile?.initialRelationships ?? defaults.initialRelationships,
      };
    });
  },
});

export const nightCycleQaScenario = query({
  args: {},
  handler: async (ctx) => {
    const { worldStatus, world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const fakeNightClock: Clock = {
      ...currentClockForStatus(worldStatus),
      hour: 23,
      minute: 30,
      lastUpdated: Date.now(),
    };
    const fakeMorningClock: Clock = {
      ...currentClockForStatus(worldStatus),
      day: currentClockForStatus(worldStatus).day + 1,
      hour: 7,
      minute: 30,
      lastUpdated: Date.now(),
    };
    const characters = world.players
      .map((player) => {
        const name = descriptions.get(player.id)?.name ?? player.id;
        if (name === DEFAULT_NAME) return undefined;
        const state = sleepStateForName(name, fakeNightClock);
        return {
          name,
          displayName: displayNameZh(name),
          nightStatusZh: sleepStateLabelZh(state),
          expectedLocationZh: '宿舍',
          noteZh:
            state === 'secretly_awake'
              ? nightActivityForName(name, fakeNightClock)?.description ?? '短暫未眠'
              : state === 'sleeping'
                ? '不應該主動開始普通對話。'
                : '準備休息，對話應該短而安靜。',
        };
      })
      .filter(Boolean);
    return {
      titleZh: '深夜節奏 QA',
      night: {
        clock: fakeNightClock,
        periodZh: rhythmName(fakeNightClock.hour),
        sceneZh: '宿舍',
        ruleZh: '23:00 後大多數角色應休息；普通公開事件不應生成。',
        characters,
      },
      morningDigest: {
        clock: fakeMorningClock,
        titleZh: '隔天早晨摘要',
        itemsZh: [
          '大多數人休息後，校園應該回到較清楚的日程節奏。',
          '海可以提供短簡報，但不應重播整晚事件。',
          '曹操或真晝若有深夜例外，只應留下短線索，不應變成事件 spam。',
        ],
      },
    };
  },
});

export const runSuccessTest: any = action({
  args: {},
  handler: async (ctx: ActionCtx) => {
    await ctx.runMutation(internal.school.ensureDefaultWorldProfiles, {});
    await ctx.runMutation(internal.school.enterCampusForTest, { timeZone: 'America/Chicago' });
    const observe = await ctx.runQuery(internal.school.observeForTest, {});
    const profiles = await ctx.runQuery(internal.school.debugStateForTest, {});
    return {
      status: 'PASS',
      noteZh:
        '安全 smoke test：確認 Alan 在校、七位主角存在、觀察與 debug state 可讀；不再製造玩家事件污染世界記憶。',
      observe,
      profileCount: profiles.length,
      players: profiles.map((profile: any) => ({
        name: profile.name,
        isHumanControlled: profile.isHumanControlled,
        isAutonomousAgent: profile.isAutonomousAgent,
        locationZh: profile.locationZh,
        statusZh: profile.statusZh,
      })),
    };
  },
});

export const observeForTest = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { world } = await defaultWorld(ctx);
    return observeSnapshot(ctx.db, world._id, 'Alan');
  },
});

export const debugStateForTest = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { world } = await defaultWorld(ctx);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    const activePlayerIds = new Set(world.players.map((p) => p.id));
    const profiles = await ctx.db
      .query('schoolProfiles')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();
    const profileByPlayerId = new Map(
      profiles
        .filter((p) => activePlayerIds.has(p.playerId))
        .map((profile) => [profile.playerId, profile]),
    );
    return world.players.map((player) => {
      const name = descriptions.get(player.id)?.name ?? player.id;
      const profile = profileByPlayerId.get(player.id);
      const defaults = defaultProfile(name);
      return {
        name,
        isHumanControlled: name === DEFAULT_NAME,
        isAutonomousAgent: name !== DEFAULT_NAME,
        role: profile?.role ?? defaults.role,
        persona: profile?.persona ?? defaults.persona,
        coreValues: profile?.coreValues ?? defaults.coreValues,
        communicationStyle: profile?.communicationStyle ?? defaults.communicationStyle,
        shortTermMemory: (profile?.shortTermMemory ?? []).slice(0, 3),
        shortTermIntentions: profile?.shortTermIntentions ?? [],
        beliefs: (profile?.beliefs ?? defaults.beliefs).slice(0, 3),
        initialRelationships: profile?.initialRelationships ?? defaults.initialRelationships,
      };
    });
  },
});

export const ensureDefaultWorldProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { world } = await defaultWorld(ctx);
    await ensureGiisRoster(ctx, world._id, world);
    const descriptions = await descriptionsByPlayer(ctx.db, world._id);
    for (const player of world.players) {
      const name = descriptions.get(player.id)?.name ?? player.id;
      await upsertProfile(ctx, world._id, player, name);
    }
    await ensureStoredProfileDefaults(ctx, world._id, descriptions);
    await ensureInitialRelationships(ctx, world._id, descriptions);
  },
});

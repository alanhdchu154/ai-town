import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import closeImg from '../../assets/close.svg';
import { SelectElement } from './Player';
import { Messages } from './Messages';
import { toastOnError } from '../toasts';
import { useSendInputQueued } from '../hooks/sendInput';
import { Player } from '../../convex/aiTown/player';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';
import { CharacterPortrait } from './CharacterPortrait';
import { displayAgentName, displayTextWithNames } from '../../data/displayNames';
import { SchoolLocation, nearestSchoolLocation } from '../../data/schoolLocations';
import { SHOW_DEBUG_UI } from './Game';

type SchoolActionType =
  | 'observe'
  | 'chat'
  | 'checkIn'
  | 'leaveMessage'
  | 'askRumor'
  | 'kick'
  | 'assignRole'
  | 'gift'
  | 'announce'
  | 'invite'
  | 'createClub'
  | 'advanceWorldTime';

type ActionSummary = {
  yourAction: string;
  characterReactions: string;
  worldChanges: string;
  futureImplications: string;
  sourceLabel?: string;
  storyDigest?: Array<{
    happenedZh: string;
    changedZh: string;
    whyItMattersZh: string;
    suggestedActionZh: string;
  }>;
};

type QueueItem = {
  id: string;
  key: string;
  label: string;
  status: 'queued' | 'running' | 'done';
};

type PanelTab =
  | 'action'
  | 'dialogue'
  | 'characters'
  | 'schedule'
  | 'debug';
type ScheduleCharacter = {
  name: string;
  displayName: string;
  locationZh?: string;
  statusZh?: string;
  expectedZh: string;
  currentFocusZh: string;
};
type SuggestedTask = {
  title: string;
  reason: string;
  targetCharacter?: string;
  targetScene?: string;
  urgency: 'low' | 'medium' | 'high';
  suggestedActionType: SchoolActionType;
};

const timeAdvanceOptions = [
  { label: '+1 hour', labelZh: '+1 小時', hours: 1 },
  { label: '+6 hours', labelZh: '+6 小時', hours: 6 },
  { label: '+1 day', labelZh: '+1 天', hours: 24 },
] as const;

const actionLabels: Record<SchoolActionType, string> = {
  observe: '觀察周圍',
  chat: '聊天',
  checkIn: '關心近況',
  leaveMessage: '留言',
  askRumor: '詢問傳聞',
  kick: '踹一腳',
  assignRole: '任命為助理校長',
  gift: '送禮',
  announce: '公告',
  invite: '邀請',
  createClub: '建立社團',
  advanceWorldTime: '看看接下來發生什麼',
};

const primaryActions: SchoolActionType[] = ['observe', 'chat', 'checkIn', 'leaveMessage'];
const targetActions: SchoolActionType[] = ['askRumor', 'gift', 'invite'];
const advancedTargetActions: SchoolActionType[] = ['kick', 'assignRole'];

const actionDescriptions: Record<SchoolActionType, string> = {
  observe: '讀取 Alan 周圍場景、附近角色與近期事件。',
  chat: '讓 Alan 主動找目標角色開始一段對話。',
  checkIn: '不開大議題，只確認對方今天狀態；適合累、安靜或避開人群的角色。',
  leaveMessage: 'Alan 留下一句短訊息，對方之後會把它當成一段小記憶。',
  askRumor: '詢問對方最近聽到或在意的校園傳聞，可能牽出小型後續行動。',
  kick: '讓 Alan 對目標角色做出公開挑釁，角色會依個性解讀。',
  assignRole: '任命目標角色為助理校長，寫入記憶與世界事件。',
  gift: '送出一個物品或心意，讓目標角色留下較柔軟的記憶。',
  announce: '以 Alan 的身分發布校園公告，讓大家之後可引用。',
  invite: '邀請目標角色參與 Alan 的計畫或社團。',
  createClub: '建立一個新社團，讓校園出現新的討論焦點。',
  advanceWorldTime: '不跳轉可見時鐘，只看校園接下來自然出現的新變化。',
};

function formatRealTimeZh(timeZone: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    dayPeriod: 'long',
  }).format(new Date());
}

function periodLabelZh(hour: number) {
  if (hour >= 6 && hour < 9) return '早晨';
  if (hour >= 9 && hour < 13) return '白天';
  if (hour >= 13 && hour < 17) return '下午';
  if (hour >= 17 && hour < 23) return '晚上';
  return '深夜';
}

function formatWorldTimeZh(clock: { day: number; hour: number; minute?: number }) {
  const hour12 = clock.hour % 12 === 0 ? 12 : clock.hour % 12;
  return `第 ${clock.day} 天 ${periodLabelZh(clock.hour)} ${hour12}:${String(clock.minute ?? 0).padStart(2, '0')}`;
}

function matchesCharacterName(candidate?: string, target?: string) {
  if (!candidate || !target) return false;
  return candidate === target || displayAgentName(candidate) === displayAgentName(target);
}

function currentTimeBlock(clock?: { hour: number }) {
  const hour = clock?.hour ?? new Date().getHours();
  if (hour >= 6 && hour < 9) {
    return {
      title: '早晨準備',
      description: '整理課表、準備簡報，校園還在慢慢醒來。',
    };
  }
  if (hour >= 9 && hour < 12) {
    return {
      title: '上午課堂',
      description: '正式討論、課堂活動與校務公告比較自然。',
    };
  }
  if (hour >= 12 && hour < 13.5) {
    return {
      title: '午間交流',
      description: '庭院與午餐時間容易出現閒聊、傳聞和輕鬆觀察。',
    };
  }
  if (hour >= 13.5 && hour < 17) {
    return {
      title: '下午課後整理',
      description: '補作業、個別談話、午餐後的小情緒比較容易浮出來。',
    };
  }
  if (hour >= 17 && hour < 21) {
    return {
      title: '放學後自由時間',
      description: '角色會分散到庭院、社團室或宿舍，對話比較私人。',
    };
  }
  if (hour >= 21 && hour < 23) {
    return {
      title: '夜間收心',
      description: '宿舍開始安靜下來，適合低聲對話與情緒整理。',
    };
  }
  return {
    title: '深夜休息',
    description: '大多數人應該休息；只有少數角色可能短暫未眠。',
  };
}

function expectedScheduleFor(name: string, clock?: { hour: number }) {
  const hour = clock?.hour ?? new Date().getHours();
  if (hour >= 23 || hour < 6) {
    if (name === 'Umi') return '在宿舍或辦公角落整理明早簡報';
    if (name === 'Maomao') return '可能短暫未眠，記下幾個不像沒事的停頓';
    if (name === 'Sakiko') return '在宿舍把曲譜收好，練習讓呼吸重新穩住';
    return '休息中，不應該被普通校務打擾';
  }
  if (hour >= 21) {
    if (name === 'Mahiru' || name === 'Mahiru Shiina') return '在宿舍關心學生情緒後準備休息';
    if (name === 'Umi') return '收尾校務，準備給 Alan 的簡短提醒';
    return '準備回宿舍，對話應該變安靜';
  }
  if (hour >= 17) {
    if (name === 'Maomao') return '在庭院觀察誰不願意開口';
    if (name === 'Sakiko') return '在庭院維持禮貌，避免裂縫被看見';
    if (name === 'Mahiru' || name === 'Mahiru Shiina') return '在宿舍或庭院照顧學生狀態';
    if (name === 'Umi') return '在校長室整理給 Alan 的短簡報';
    return '自由時間，可能移動到庭院、餐廳或宿舍';
  }
  if (hour >= 13.5) {
    if (name === 'Ichinose') return '在餐廳或庭院讓人承認自己欠了哪份善意';
    if (name === 'Maomao') return '在庭院確認哪句「沒事」其實是症狀';
    if (name === 'Umi') return '在校長室把 Alan 的想法整理成可執行事項';
    return '補作業、整理課後情緒，或進行小組討論';
  }
  if (hour >= 12) {
    if (name === 'Sakiko') return '在中央庭院把退場衝動藏進禮貌';
    if (name === 'Mahiru' || name === 'Mahiru Shiina') return '觀察誰在午間顯得不安';
    return '午間社交或休息';
  }
  if (hour >= 9) {
    if (name === 'Umi') return '準備校長簡報並觀察課堂秩序';
    if (name === 'Tianze') return '觀察哪條校園規則最經不起壓力測試';
    if (name === 'Ichinose') return '觀察課堂裡誰把溫柔當成自己的所有物';
    return '在教室參與課堂或正式討論';
  }
  return '早晨準備，移動到今天第一個主要場景';
}

function currentFocusFor(profile: any) {
  const intention = profile?.shortTermIntentions?.[0];
  const memory = profile?.shortTermMemory?.[0];
  const raw = intention || memory;
  if (!raw) return defaultConcern(profile?.name ?? '');
  return sanitizeCharacterFocus(profile?.name ?? '', raw);
}

function naturalizeWorldText(text?: string) {
  return displayTextWithNames(text ?? '')
    .replaceAll('conversationOutcome', '對話後的決定')
    .replaceAll('形成意圖', '做出決定')
    .replaceAll('執行意圖', '開始行動')
    .replaceAll('重大校園事件', '校園焦點')
    .replaceAll('新的角色意圖', '新的打算')
    .replaceAll('推進世界時間', '讓校園自然發展')
    .replaceAll('如果最近的事件自然相關，可以輕輕帶過；不要把它當成唯一話題。', '')
    .replaceAll('我們不只要記住，還要判斷力量會流向哪裡。', '我在想，大家真正害怕的不是規則本身。')
    .replaceAll('真正危險的不是 AI 社，而是沒有人知道它最後會變成什麼。', '真正讓人不安的，是大家不知道自己會被帶到哪裡。')
    .replaceAll('真正危險的不是 AI 社，而是沒有人知道 AI 社最後會變成什麼。', '真正讓人不安的，是大家不知道自己會被帶到哪裡。')
    .replace(/我先去處理校務，(.+?)，晚點再聊。/g, '我先去整理一下，$1，晚點再聊。')
    .replaceAll(' 我會把它整理成 Alan 看得懂的世界脈絡和下一步，順便提醒他別一個人扛。', '')
    .replaceAll(' 我會先確認誰已經改變立場。秩序不會自己出現，總要有人負責。', '')
    .replaceAll(' 我會先去確認學生們是不是開始害怕說錯話，尤其是那些說自己沒事的人。', '');
}

export default function PlayerDetails({
  worldId,
  engineId,
  game,
  playerId,
  setSelectedElement,
  scrollViewRef,
  currentScene,
  scenePlayers = [],
  clockState,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
  scrollViewRef: React.RefObject<HTMLDivElement>;
  currentScene?: SchoolLocation;
  scenePlayers?: Array<{ id: GameId<'players'>; name: string }>;
  clockState?: any;
}) {
  const convex = useConvex();
  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId });
  const playerIdentity = useQuery(api.school.currentPlayerIdentity);
  const userTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago',
    [],
  );
  const umiBriefing = useQuery(api.school.umiBriefing, { timeZone: userTimeZone });
  const campusSocialState = useQuery(api.school.campusSocialState, { timeZone: userTimeZone });
  const worldClockState = clockState;

  const players = [...game.world.players.values()];
  const humanPlayer = players.find((p) => p.human === humanTokenIdentifier);
  const humanConversation = humanPlayer ? game.world.playerConversation(humanPlayer) : undefined;
  // Always select the other player if we're in a conversation with them.
  if (humanPlayer && humanConversation) {
    const otherPlayerIds = [...humanConversation.participants.keys()].filter(
      (p) => p !== humanPlayer.id,
    );
    playerId = otherPlayerIds[0];
  }

  const player = playerId && game.world.players.get(playerId);
  const playerConversation = player && game.world.playerConversation(player);

  const previousConversation = useQuery(
    api.world.previousConversation,
    playerId ? { worldId, playerId } : 'skip',
  );
  const [schoolState, setSchoolState] = useState<any[]>([]);
  const [schoolObservation, setSchoolObservation] = useState<any>();
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<SchoolActionType>('observe');
  const [actionText, setActionText] = useState('');
  const [actionSummary, setActionSummary] = useState<ActionSummary>();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [activeActionLabel, setActiveActionLabel] = useState('');
  const [runningActionKeys, setRunningActionKeys] = useState<Record<string, string>>({});
  const runningActionKeysRef = useRef<Record<string, string>>({});
  const lastConversationStartAtRef = useRef(0);
  const [activeTab, setActiveTab] = useState<PanelTab>('dialogue');
  const [timeAdvanceHours, setTimeAdvanceHours] =
    useState<(typeof timeAdvanceOptions)[number]['hours']>(1);
  const playerDescription = playerId && game.playerDescriptions.get(playerId);
  const selectableAgents = useMemo(
    () =>
      players
        .map((p) => game.playerDescriptions.get(p.id)?.name)
        .filter((name): name is string => !!name && name !== 'Alan'),
    [players, game.playerDescriptions],
  );
  const [targetName, setTargetName] = useState(playerDescription?.name ?? '');
  const openTab = useCallback((tab: PanelTab) => {
    const start = performance.now();
    setActiveTab(tab);
    if (import.meta.env.DEV) {
      requestAnimationFrame(() => {
        console.debug('[GIIS timing]', {
          action: 'openTab',
          phase: 'renderUpdateTime',
          tab,
          ms: Math.round(performance.now() - start),
        });
      });
    }
  }, []);
  const selectTargetByName = useCallback(
    (name: string) => {
      const start = performance.now();
      setTargetName(name);
      const target = players.find((p) =>
        matchesCharacterName(game.playerDescriptions.get(p.id)?.name, name),
      );
      if (target) setSelectedElement({ kind: 'player', id: target.id });
      if (import.meta.env.DEV) {
        requestAnimationFrame(() => {
          console.debug('[GIIS timing]', {
            action: 'selectCharacter',
            phase: 'renderUpdateTime',
            target: name,
            ms: Math.round(performance.now() - start),
          });
        });
      }
    },
    [players, game.playerDescriptions, setSelectedElement],
  );
  const navigateToCharacter = useCallback(
    (name: string, travel = false) => {
      setTargetName(name);
      const target = players.find((p) =>
        matchesCharacterName(game.playerDescriptions.get(p.id)?.name, name),
      );
      if (target) setSelectedElement({ kind: 'player', id: target.id });
      window.dispatchEvent(
        new CustomEvent('giis:navigate-character', { detail: { name, travel } }),
      );
    },
    [players, game.playerDescriptions, setSelectedElement],
  );
  const campusTimeline = useQuery(api.school.campusTimeline, {
    timeZone: userTimeZone,
    characterName: targetName || undefined,
  });
  const liveSchoolState = useMemo(
    () =>
      (schoolState ?? []).map((profile: any) => {
        const livePlayer = players.find((item) =>
          matchesCharacterName(game.playerDescriptions.get(item.id)?.name, profile.name),
        );
        const liveLocation = livePlayer ? nearestSchoolLocation(livePlayer.position) : undefined;
        const destinationLocation = livePlayer?.pathfinding?.destination
          ? nearestSchoolLocation(livePlayer.pathfinding.destination)
          : undefined;
        return {
          ...profile,
          locationZh: liveLocation?.labelZh ?? profile.locationZh,
          destinationLocationZh: destinationLocation?.labelZh,
          statusZh: livePlayer?.pathfinding
            ? `正在前往${destinationLocation?.labelZh ?? liveLocation?.labelZh ?? '目的地'}`
            : profile.statusZh,
        };
      }),
    [
      schoolState,
      players.map((item) => `${item.id}:${item.position.x}:${item.position.y}:${!!item.pathfinding}`).join('|'),
      game.playerDescriptions,
    ],
  );
  const refreshSchoolState = useCallback(async () => {
    setSchoolLoading(true);
    try {
      const state = await toastOnError(convex.query(api.school.debugState, {}));
      if (state) setSchoolState(state as any[]);
    } finally {
      setSchoolLoading(false);
    }
  }, [convex]);
  const refreshObservation = useCallback(async () => {
    const observation = await toastOnError(convex.query(api.school.observe, {}));
    if (observation) setSchoolObservation(observation);
    return observation as any;
  }, [convex]);
  useEffect(() => {
    if (playerDescription?.name && playerDescription.name !== 'Alan') {
      setTargetName(playerDescription.name);
      void refreshSchoolState();
    }
  }, [playerDescription?.name, refreshSchoolState]);
  useEffect(() => {
    void refreshSchoolState();
  }, [refreshSchoolState]);
  useEffect(() => {
    void refreshObservation();
  }, [refreshObservation]);
  const targetProfile = liveSchoolState?.find((p: { name: string }) => p.name === targetName);
  const schoolProfile = liveSchoolState?.find(
    (p: { name: string }) => p.name === playerDescription?.name,
  );
  const emotionFor = (name?: string) =>
    campusSocialState?.emotions?.find((emotion: { name: string }) => emotion.name === name)
      ?.currentEmotion;
  const socialPresenceFor = (name?: string) =>
    campusSocialState?.emotions?.find((emotion: { name: string }) => emotion.name === name);
  const visibleClock = worldClockState?.clock ?? schoolObservation?.clock;
  const isLateNight = visibleClock ? visibleClock.hour >= 23 || visibleClock.hour < 6 : false;
  const visibleRealTime = worldClockState?.realTimeLabelZh ?? '讀取中';
  const visibleWorldTime = worldClockState?.worldTimeLabelZh ?? '讀取中';
  const timeHoverLabel =
    worldClockState?.hoverLabelZh ?? `現實：${visibleRealTime}\n世界：${visibleWorldTime}`;
  const timeBlock = currentTimeBlock(visibleClock);
  const scheduleCharacters: ScheduleCharacter[] = useMemo(
    () =>
      (liveSchoolState ?? [])
        .filter((profile: any) => profile.name !== 'Alan')
        .map((profile: any) => {
          const presence = socialPresenceFor(profile.name);
          return {
            name: profile.name,
            displayName: displayAgentName(profile.name),
            locationZh: profile.locationZh,
            statusZh: profile.statusZh?.startsWith('正在前往')
              ? profile.statusZh
              : presence?.availabilityZh ?? profile.statusZh,
            expectedZh: expectedScheduleFor(profile.name, visibleClock),
            currentFocusZh: presence?.quietLineZh ?? currentFocusFor(profile),
          };
        }),
    [liveSchoolState, campusSocialState?.emotions, visibleClock?.day, visibleClock?.hour, visibleClock?.minute],
  );
  const tabLabels: Partial<Record<PanelTab, string>> = {
    dialogue: '對話',
    characters: '角色',
    ...(SHOW_DEBUG_UI ? { debug: '進階' as const } : {}),
  };
  const visibleTabs = Object.keys(tabLabels) as PanelTab[];
  const renderTabs = () => (
    <div className={`grid gap-1 grid-cols-${visibleTabs.length}`}>
      {visibleTabs.map((tab) => (
        <button
          key={tab}
          className={`panel-tab ${activeTab === tab ? 'panel-tab-active' : ''}`}
          onClick={() => openTab(tab)}
        >
          {tabLabels[tab]}
        </button>
      ))}
    </div>
  );

  useEffect(() => {
    const onOpenPanelTab = (event: Event) => {
      const tab = (event as CustomEvent<{ tab?: PanelTab }>).detail?.tab;
      if (!tab) return;
      if (!Object.prototype.hasOwnProperty.call(tabLabels, tab)) return;
      setActiveTab(tab);
    };
    window.addEventListener('giis:open-panel-tab', onOpenPanelTab);
    return () => window.removeEventListener('giis:open-panel-tab', onOpenPanelTab);
  }, []);

  useEffect(() => {
    if (humanConversation) setActiveTab('dialogue');
  }, [humanConversation?.id]);

  const startConversationQueued = useSendInputQueued(engineId, 'startConversation');
  const acceptInviteQueued = useSendInputQueued(engineId, 'acceptInvite');
  const rejectInviteQueued = useSendInputQueued(engineId, 'rejectInvite');
  const leaveAlanConversationNow = useMutation(api.school.leaveAlanConversationNow);
  const enterCampus = useMutation(api.school.enterCampus);
  const kick = useAction(api.school.kick);
  const assignRole = useMutation(api.school.assignRole);
  const advanceWorldTime = useMutation(api.school.advanceWorldTime);
  const playerAction = useMutation(api.school.playerAction);
  const acknowledgeUmiBriefing = useMutation(api.school.acknowledgeUmiBriefing);
  const setAlanFreeDevelopmentMode = useMutation(api.school.setAlanFreeDevelopmentMode);

  const targetPlayer = players.find((p) =>
    matchesCharacterName(game.playerDescriptions.get(p.id)?.name, targetName),
  );
  const targetConversation = targetPlayer ? game.world.playerConversation(targetPlayer) : undefined;
  const conversationOtherNames = (conversation?: any, excludeIds: string[] = []) =>
    conversation
      ? [...conversation.participants.keys()]
          .filter((participantId) => !excludeIds.includes(participantId))
          .map((participantId) =>
            displayAgentName(game.playerDescriptions.get(participantId)?.name ?? participantId),
          )
          .join('、')
      : '';
  const targetBusyDescription =
    targetConversation && targetPlayer && targetConversation.id !== humanConversation?.id
      ? `${displayAgentName(game.playerDescriptions.get(targetPlayer.id)?.name ?? targetName)} 正在和 ${
          conversationOtherNames(targetConversation, [targetPlayer.id]) || '其他人'
        } 談話。你可以先等待、旁聽校園動態，或改找另一位角色。`
      : undefined;
  const canStartSelectedChat =
    targetPlayer &&
    (!humanPlayer || targetPlayer.id !== humanPlayer.id) &&
    !humanConversation &&
    !targetConversation;
  const ensureHumanPlayerId = async () => {
    if (humanPlayer) return humanPlayer.id;
    const result = await enterCampus({});
    return result.playerId as GameId<'players'>;
  };
  const queueConversationStart = async (label: string, inviteeId: GameId<'players'>) => {
    const now = Date.now();
    if (now - lastConversationStartAtRef.current < 3000) return;
    lastConversationStartAtRef.current = now;
    await runWithStatus(label, async () => {
      const playerId = await ensureHumanPlayerId();
      const queuedAt = performance.now();
      await startConversationQueued({ playerId, invitee: inviteeId });
      if (import.meta.env.DEV) {
        console.debug('[GIIS timing]', {
          action: 'startConversation',
          phase: 'uiClickToQueued',
          ms: Math.round(performance.now() - queuedAt),
        });
      }
      setActiveTab('dialogue');
      setActionSummary({
        yourAction: label,
        characterReactions: '對話邀請已送出，角色正在靠近或準備回應。',
        worldChanges: '校園已收到這個互動，不需要等 AI 想完才看到回饋。',
        futureImplications: '對話面板會在角色接近後自動更新；你可以先看其他資訊。',
      });
    }, 'conversation:start');
  };

  const onStartSelectedConversation = async () => {
    if (!targetPlayer || !canStartSelectedChat) {
      if (targetBusyDescription) {
        setActiveTab('dialogue');
        setActionSummary({
          yourAction: `Alan 想找 ${displayAgentName(targetName)} 說話。`,
          characterReactions: targetBusyDescription,
          worldChanges: '校園沒有強行打斷正在進行的對話。',
          futureImplications: '等對話結束再切入，會比硬闖更自然。也可以先查看校園動態掌握脈絡。',
        });
      }
      return;
    }
    await queueConversationStart(`正在前往 ${displayAgentName(targetName)}`, targetPlayer.id);
  };
  const onLeaveSelectedConversation = async () => {
    if (!humanPlayer || !humanConversation) return;
    await runWithStatus('離開對話', async () => {
      const result: any = await leaveAlanConversationNow({});
      if (result?.waitedForReply) {
        setActionSummary({
          yourAction: 'Alan 想離開目前對話。',
          characterReactions: result.descriptionZh ?? '角色還在回覆，先等一下。',
          worldChanges: '這段對話暫時沒有被切掉，避免留下只有 Alan 的單邊紀錄。',
          futureImplications: '等角色回完再離開會比較自然；如果真的卡太久，系統會允許離開並保留診斷。',
        });
        return;
      }
      setActionSummary({
        yourAction: 'Alan 離開了目前對話。',
        characterReactions: '對話正在收尾，校園會繼續自然流動。',
        worldChanges: '你可以立刻選擇下一個角色或場景。',
        futureImplications: '剛才的對話仍會留在歷史記錄中。',
      });
    }, 'conversation:leave');
  };

  const runWithStatus = async <T,>(label: string, work: () => Promise<T>, key: string = selectedAction) => {
    if (runningActionKeysRef.current[key]) {
      return undefined as T;
    }
    const clickStart = performance.now();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setActiveActionLabel(label);
    runningActionKeysRef.current = { ...runningActionKeysRef.current, [key]: label };
    setRunningActionKeys(runningActionKeysRef.current);
    setQueueItems((items) => [...items.slice(-2), { id, key, label, status: 'queued' }]);
    if (import.meta.env.DEV) {
      console.debug('[GIIS timing]', { action: key, phase: 'uiClickLatency', ms: 0, label });
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    setQueueItems((items) =>
      items.map((item) => (item.id === id ? { ...item, status: 'running' } : item)),
    );
    if (import.meta.env.DEV) {
      console.debug('[GIIS timing]', {
        action: key,
        phase: 'renderUpdateQueued',
        ms: Math.round(performance.now() - clickStart),
      });
    }
    try {
      const mutationStart = performance.now();
      const result = await work();
      if (import.meta.env.DEV) {
        console.debug('[GIIS timing]', {
          action: key,
          phase: 'convexMutationOrAction',
          ms: Math.round(performance.now() - mutationStart),
        });
      }
      window.dispatchEvent(
        new CustomEvent('giis:action-cinematic', {
          detail: { label, actionType: selectedAction },
        }),
      );
      return result;
    } finally {
      setQueueItems((items) =>
        items.map((item) => (item.id === id ? { ...item, status: 'done' } : item)),
      );
      setActiveActionLabel('');
      setRunningActionKeys(() => {
        const next = { ...runningActionKeysRef.current };
        delete next[key];
        runningActionKeysRef.current = next;
        return next;
      });
      window.setTimeout(() => {
        setQueueItems((items) => items.filter((item) => item.id !== id));
      }, 1200);
    }
  };

  const applyResult = async (summary?: ActionSummary, observation?: any) => {
    if (summary) setActionSummary(summary);
    if (observation) setSchoolObservation(observation);
    await refreshSchoolState();
    if (!observation) await refreshObservation();
  };

  const onKick = async (targetOverride?: string) => {
    const actionTarget = targetOverride ?? targetName;
    if (!actionTarget) return;
    await runWithStatus(`踹 ${actionTarget}`, async () => {
      const result: any = await toastOnError(kick({ targetName: actionTarget }));
      if (result) await applyResult(result.summary);
    });
  };
  const onAssignAssistantPrincipal = async (targetOverride?: string) => {
    const actionTarget = targetOverride ?? targetName;
    if (!actionTarget) return;
    await runWithStatus(`任命 ${actionTarget}`, async () => {
      const result: any = await toastOnError(
        assignRole({ targetName: actionTarget, roleName: 'Assistant Principal / 助理校長' }),
      );
      if (result) await applyResult(result.summary);
    });
  };
  const onObserve = async () => {
    await runWithStatus('觀察校園', async () => {
      const observation = await refreshObservation();
      if (!observation) return;
      const recent =
        observation.recentLocalEvents
          ?.slice(0, 2)
          .map((event: { descriptionZh: string }) => event.descriptionZh)
          .join('；') || '暫時沒有新的校園事件。';
      await applyResult(
        {
          yourAction: '你停下腳步，觀察 Alan 周圍的校園狀態。',
          characterReactions: observation.nearbyAgents?.length
            ? `${observation.nearbyAgents.map((agent: { name: string }) => displayAgentName(agent.name)).join('、')} 出現在你的感知範圍內。`
            : '附近沒有角色立刻回應，但校園仍在運轉。',
          worldChanges: observation.sceneDescription || recent,
          futureImplications: '觀察不會強行改變關係，但能讓你決定下一個更有意義的行動。',
        },
        observation,
      );
    });
  };
  const onAdvanceTime = async () => {
    const selectedTimeOption =
      timeAdvanceOptions.find((option) => option.hours === timeAdvanceHours) ??
      timeAdvanceOptions[0];
    await runWithStatus(`讓校園自然發展 ${selectedTimeOption.labelZh}`, async () => {
      const result: any = await toastOnError(
        advanceWorldTime({ hours: selectedTimeOption.hours, timeZone: userTimeZone }),
      );
      if (result?.clock) {
        const updatedRealTime = formatRealTimeZh(userTimeZone);
        const updatedWorldTime = formatWorldTimeZh(result.clock);
        await applyResult(
          {
            sourceLabel: '來源：世界自然發展',
            yourAction:
              result.summary?.yourAction ??
              `Alan 讓校園自然發展，觀察接下來 ${selectedTimeOption.labelZh}可能發生的變化。`,
            characterReactions:
              result.summary?.characterReactions ?? '角色們繼續依課表與自己的目標行動。',
            worldChanges: `${
              result.summary?.worldChanges ?? '校園發生了一些新的變化。'
            } 現實：${updatedRealTime}。世界：${updatedWorldTime}（這段時間校園發生了一些變化）。`,
            futureImplications:
              result.summary?.futureImplications ??
              '可見時間仍與現實同步，但事件、記憶、野心與關係會在之後的對話中浮出來。',
          },
          result,
        );
      }
    });
  };
  const runPlayerAction = async (
    actionType: SchoolActionType,
    overrides?: { targetName?: string; text?: string },
  ) => {
    const actionTargetName = overrides?.targetName ?? targetName;
    const actionInputText = (overrides?.text ?? actionText).trim();
    if ((actionType === 'announce' || actionType === 'createClub') && !actionInputText) {
      const label = actionType === 'announce' ? '公告內容' : '社團名稱';
      setSelectedAction(actionType);
      setActiveTab('characters');
      setActionSummary({
        yourAction: `請先輸入${label}。`,
        characterReactions: '海沒有替你發布。她只是把筆遞給你，決定權留在 Alan 手上。',
        worldChanges: '校園沒有新增 Alan 的重大決策。',
        futureImplications: '你可以採用海的草稿，但最後文字必須由你確認後送出。',
      });
      return;
    }
    if (actionType === 'observe') return onObserve();
    if (actionType === 'kick') return onKick(actionTargetName);
    if (actionType === 'assignRole') return onAssignAssistantPrincipal(actionTargetName);
    if (actionType === 'advanceWorldTime') return onAdvanceTime();
    await runWithStatus(actionLabels[actionType], async () => {
      const actionTargetPlayer = players.find((p) =>
        matchesCharacterName(game.playerDescriptions.get(p.id)?.name, actionTargetName),
      );
      const busyConversation = actionTargetPlayer
        ? game.world.playerConversation(actionTargetPlayer)
        : undefined;
      if (
        actionType === 'chat' &&
        actionTargetPlayer &&
        busyConversation &&
        busyConversation.id !== humanConversation?.id
      ) {
        const busyTargetName = game.playerDescriptions.get(actionTargetPlayer.id)?.name ?? actionTargetName;
        const busyWith = conversationOtherNames(busyConversation, [actionTargetPlayer.id]) || '其他人';
        setActiveTab('dialogue');
        await applyResult({
          yourAction: `Alan 想找 ${displayAgentName(busyTargetName)} 說話。`,
          characterReactions: `${displayAgentName(busyTargetName)} 正在和 ${busyWith} 談話。`,
          worldChanges: '你沒有打斷正在進行的對話，校園節奏保持自然。',
          futureImplications: '可以等待、改找附近角色，或先從校園動態理解他們在談什麼。',
        });
        return;
      }
      if (actionType === 'chat' && actionTargetPlayer && !humanConversation) {
        const now = Date.now();
        if (now - lastConversationStartAtRef.current < 3000) return;
        lastConversationStartAtRef.current = now;
        const playerId = await ensureHumanPlayerId();
        await startConversationQueued({ playerId, invitee: actionTargetPlayer.id });
        setActiveTab('dialogue');
      }
      const result: any = await toastOnError(
        playerAction({
          actionType,
          targetName:
            actionType === 'announce' || actionType === 'createClub'
              ? undefined
              : actionTargetName || undefined,
          text: actionInputText || undefined,
        }),
      );
      if (result) {
        setActionText('');
        await applyResult(result.summary, result.observation);
      }
    });
  };
  const onPlayerAction = async () => runPlayerAction(selectedAction);
  const onExecuteSuggestedTask = async (task: SuggestedTask) => {
    const actionType = task.suggestedActionType;
  const taskText =
    actionType === 'announce'
        ? '今天先看誰變安靜，誰需要被慢慢聽完。'
        : actionType === 'createClub'
          ? '午餐讀書會'
          : undefined;
    if (task.targetCharacter) setTargetName(task.targetCharacter);
    if (taskText) setActionText(taskText);
    setSelectedAction(actionType);
    setActiveTab(actionType === 'advanceWorldTime' ? 'action' : 'characters');
    if (actionType === 'announce' || actionType === 'createClub') {
      setActionSummary({
        sourceLabel: '來源：海的建議草稿',
        yourAction: `海準備了一份草稿：「${taskText}」`,
        characterReactions: '這還不是 Alan 的正式決定，角色不會把它當成已發生事件。',
        worldChanges: '校園暫時沒有變化。',
        futureImplications: '請確認或改寫內容後，再按一次執行。這樣事件才會被記錄為 Alan 親自發布。',
      });
      return;
    }
    await runPlayerAction(actionType, { targetName: task.targetCharacter, text: taskText });
  };

  useEffect(() => {
    if (!actionSummary) return;
    window.dispatchEvent(new CustomEvent('giis:action-result', { detail: actionSummary }));
  }, [actionSummary]);

  useEffect(() => {
    const onQuickAction = (event: Event) => {
      const detail = (
        event as CustomEvent<{ actionType: SchoolActionType; execute?: boolean; text?: string }>
      ).detail;
      if (!detail?.actionType) return;
      setSelectedAction(detail.actionType);
      // 互動 tab was removed from the right drawer; advanceWorldTime now
      // lives under 角色 (characters) alongside the other action controls.
      setActiveTab('characters');
      if (detail.execute) {
        window.setTimeout(
          () => void runPlayerAction(detail.actionType, { text: detail.text }),
          0,
        );
      }
    };
    window.addEventListener('giis:quick-action', onQuickAction);
    return () => window.removeEventListener('giis:quick-action', onQuickAction);
  }, [onPlayerAction]);

  if (!playerId) {
    return (
      <div className="h-full text-base flex flex-col p-2 gap-3">
        {renderTabs()}
        {activeTab === 'action' ? (
          <>
            <PlayerOverviewCard
              playerIdentity={playerIdentity}
              currentScene={currentScene}
              timeBlock={timeBlock}
              visibleRealTime={visibleRealTime}
              visibleWorldTime={visibleWorldTime}
              timeHoverLabel={timeHoverLabel}
              scenePlayers={scenePlayers}
              campusSocialState={campusSocialState}
              scheduleCharacters={scheduleCharacters}
              targetName={targetName}
              canStartSelectedChat={!!canStartSelectedChat}
              onOpenBriefing={() => window.dispatchEvent(new CustomEvent('giis:open-umi-panel'))}
              onOpenSchedule={() => setActiveTab('schedule')}
              onOpenCharacters={() => setActiveTab('characters')}
              onOpenTimeline={() => window.dispatchEvent(new CustomEvent('giis:open-campus-feed'))}
              onOpenDialogue={() => setActiveTab('dialogue')}
              onStartConversation={() => void onStartSelectedConversation()}
            />
            {actionSummary ? <NarrativeResult summary={actionSummary} /> : null}
            <details className="bg-brown-700 border border-brown-500 p-3 text-sm">
              <summary className="cursor-pointer font-bold">可選：讓校園自然發展</summary>
              <p className="mt-2 text-brown-200">這不是讓 Alan 做決定，而是讓校園根據目前狀態自然產生一段變化。</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {timeAdvanceOptions.map((option) => (
                  <button
                    key={option.hours}
                    className={`action-pill ${timeAdvanceHours === option.hours ? 'action-pill-active' : ''}`}
                    onClick={() => setTimeAdvanceHours(option.hours)}
                  >
                    {option.labelZh}
                  </button>
                ))}
              </div>
              <button className="action-pill action-pill-active mt-2 w-full" onClick={() => void onAdvanceTime()}>
                看看接下來發生什麼
              </button>
            </details>
          </>
        ) : null}
        {activeTab === 'characters' ? (
          <>
            <CharacterRosterPanel
              names={selectableAgents}
              schoolState={liveSchoolState}
              campusSocialState={campusSocialState}
              emotionFor={emotionFor}
              targetName={targetName}
              onSelect={selectTargetByName}
            />
            <CharacterActionPanel
              targetName={targetName}
              targetProfile={targetProfile}
              runningActionKeys={runningActionKeys}
              playerIdentity={playerIdentity}
              canStartSelectedChat={!!canStartSelectedChat}
              onTravelToTarget={() => targetName && navigateToCharacter(targetName, true)}
              onStartConversation={() => void onStartSelectedConversation()}
              onOpenDialogue={() => setActiveTab('dialogue')}
              onKick={() => void onKick()}
              onAssign={() => void onAssignAssistantPrincipal()}
              clubs={campusSocialState?.clubs ?? []}
              onCreateClub={() =>
                window.dispatchEvent(
                  new CustomEvent('giis:quick-action', { detail: { actionType: 'createClub', execute: false } }),
                )
              }
            onPrepareAiClubRules={() => {
                setActionText('今天先看誰變安靜，誰需要被慢慢聽完。');
                window.dispatchEvent(
                  new CustomEvent('giis:quick-action', { detail: { actionType: 'announce', execute: false } }),
                );
              }}
            />
            {actionSummary ? <NarrativeResult summary={actionSummary} /> : null}
          </>
        ) : null}
        {activeTab === 'schedule' ? (
          <SchedulePanel
            timeBlock={timeBlock}
            currentScene={currentScene}
            visibleWorldTime={visibleWorldTime}
            timeHoverLabel={timeHoverLabel}
            characters={scheduleCharacters}
          />
        ) : null}
        {activeTab === 'dialogue' ? (
          <ConversationPanel
            worldId={worldId}
            engineId={engineId}
            humanPlayer={humanPlayer}
            humanConversation={humanConversation}
            targetName={targetName}
            targetPlayer={targetPlayer}
            targetProfile={targetProfile}
            targetEmotion={emotionFor(targetName)}
            targetPresence={socialPresenceFor(targetName)}
            previousConversation={previousConversation}
            timelineState={campusTimeline}
            scrollViewRef={scrollViewRef}
            onStartConversation={onStartSelectedConversation}
            onLeaveConversation={onLeaveSelectedConversation}
            canStart={!!canStartSelectedChat}
            inConversationWithMe={!!humanConversation}
            waitingForAccept={false}
            waitingForNearby={false}
            unavailableReason={targetBusyDescription}
            isLateNight={isLateNight}
            conversationLoadingLabel={
              runningActionKeys['conversation:start'] ||
              runningActionKeys['conversation:leave'] ||
              runningActionKeys['conversation:accept'] ||
              runningActionKeys['conversation:reject']
            }
          />
        ) : null}
        {activeTab === 'debug' ? (
          <DebugPanel
            targetName={targetName}
            targetProfile={targetProfile}
            schoolState={schoolState}
            alanBehaviorProfile={campusSocialState?.alanBehaviorProfile}
            onToggleFreeDevelopment={(enabled) =>
              void toastOnError(setAlanFreeDevelopmentMode({ enabled }))
            }
            onRefreshSchoolState={() => void refreshSchoolState()}
          />
        ) : null}
      </div>
    );
  }
  if (!player) {
    return null;
  }
  const isMe = humanPlayer && player.id === humanPlayer.id;
  const playerLocation = nearestSchoolLocation(player.position);
  const canInvite = !isMe && !playerConversation && !humanConversation;
  const sameConversation =
    !isMe &&
    humanPlayer &&
    humanConversation &&
    playerConversation &&
    humanConversation.id === playerConversation.id;

  const humanStatus =
    humanPlayer && humanConversation && humanConversation.participants.get(humanPlayer.id)?.status;
  const playerStatus = playerConversation && playerConversation.participants.get(playerId)?.status;

  const haveInvite = sameConversation && humanStatus?.kind === 'invited';
  const waitingForAccept =
    sameConversation && playerConversation.participants.get(playerId)?.status.kind === 'invited';
  const waitingForNearby =
    sameConversation && playerStatus?.kind === 'walkingOver' && humanStatus?.kind === 'walkingOver';

  const inConversationWithMe =
    sameConversation &&
    playerStatus?.kind === 'participating' &&
    humanStatus?.kind === 'participating';
  const compactDialogueMode = activeTab === 'dialogue' && inConversationWithMe;

  const onStartConversation = async () => {
    if (!playerId) return;
    const inviteeId = playerId;
    await runWithStatus(
      `正在前往 ${displayAgentName(playerDescription?.name)}`,
      async () => {
        const alanPlayerId = await ensureHumanPlayerId();
        await startConversationQueued({ playerId: alanPlayerId, invitee: inviteeId });
      },
      'conversation:start',
    );
  };
  const onAcceptInvite = async () => {
    if (!humanPlayer || !humanConversation) return;
    await runWithStatus(
      '接受對話邀請',
      async () => {
        await acceptInviteQueued({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
        });
      },
      'conversation:accept',
    );
  };
  const onRejectInvite = async () => {
    if (!humanPlayer || !humanConversation) return;
    await runWithStatus(
      '暫時不加入對話',
      async () => {
        await rejectInviteQueued({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
        });
      },
      'conversation:reject',
    );
  };
  const onLeaveConversation = async () => {
    if (!humanPlayer || !humanConversation) return;
    await runWithStatus(
      '離開對話',
      async () => {
        const result: any = await leaveAlanConversationNow({});
        if (result?.waitedForReply) {
          setActionSummary({
            yourAction: 'Alan 想離開目前對話。',
            characterReactions: result.descriptionZh ?? '角色還在回覆，先等一下。',
            worldChanges: '這段對話暫時沒有被切掉，避免留下只有 Alan 的單邊紀錄。',
            futureImplications: '等角色回完再離開會比較自然；如果真的卡太久，系統會允許離開並保留診斷。',
          });
        }
      },
      'conversation:leave',
    );
  };

  return (
    <>
      {compactDialogueMode ? (
        <button
          className="giis-panel-close giis-dialogue-panel-close pointer-events-auto"
          onClick={() => setSelectedElement(undefined)}
          title="關閉"
          aria-label="關閉"
        >
          <img src={closeImg} alt="" />
        </button>
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="giis-vn-card mr-auto flex w-3/4 items-center justify-center p-2 sm:w-full">
              <CharacterPortrait
                name={playerDescription?.name}
                size="lg"
                emotion={emotionFor(playerDescription?.name)}
              />
            </div>
            <button
              className="giis-panel-close pointer-events-auto"
              onClick={() => setSelectedElement(undefined)}
              title="關閉"
              aria-label="關閉"
            >
              <img src={closeImg} alt="" />
            </button>
          </div>
          <div className="mt-3">{renderTabs()}</div>
        </>
      )}
      {activeTab === 'action' ? (
        <>
          <PlayerOverviewCard
            playerIdentity={playerIdentity}
            currentScene={currentScene}
            timeBlock={timeBlock}
          visibleRealTime={visibleRealTime}
          visibleWorldTime={visibleWorldTime}
          timeHoverLabel={timeHoverLabel}
          scenePlayers={scenePlayers}
          campusSocialState={campusSocialState}
            scheduleCharacters={scheduleCharacters}
            targetName={targetName}
            canStartSelectedChat={!!canStartSelectedChat}
            onOpenBriefing={() => window.dispatchEvent(new CustomEvent('giis:open-umi-panel'))}
            onOpenSchedule={() => setActiveTab('schedule')}
            onOpenCharacters={() => setActiveTab('characters')}
            onOpenTimeline={() => window.dispatchEvent(new CustomEvent('giis:open-campus-feed'))}
            onOpenDialogue={() => setActiveTab('dialogue')}
            onStartConversation={() => void onStartSelectedConversation()}
          />
          {actionSummary ? <NarrativeResult summary={actionSummary} /> : null}
          <details className="mt-4 bg-brown-700 border border-brown-500 p-3 text-sm">
            <summary className="cursor-pointer font-bold">可選：讓校園自然發展</summary>
            <p className="mt-2 text-brown-200">這不是讓 Alan 做決定，而是讓校園根據目前狀態自然產生一段變化。</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {timeAdvanceOptions.map((option) => (
                <button
                  key={option.hours}
                  className={`action-pill ${timeAdvanceHours === option.hours ? 'action-pill-active' : ''}`}
                  onClick={() => setTimeAdvanceHours(option.hours)}
                >
                  {option.labelZh}
                </button>
              ))}
            </div>
            <button
              className="action-pill action-pill-active mt-2 w-full"
              disabled={!!runningActionKeys.advanceWorldTime}
              onClick={() => void onAdvanceTime()}
            >
              {runningActionKeys.advanceWorldTime ? '世界正在更新...' : '看看接下來發生什麼'}
            </button>
          </details>
        </>
      ) : null}
      {!compactDialogueMode ? (
        <div className="giis-vn-card mt-3 p-2 text-sm leading-tight">
          {isMe ? (
            <span>Alan｜{playerLocation?.labelZh ?? currentScene?.labelZh ?? schoolObservation?.currentLocation?.labelZh ?? '校園'}｜{timeBlock.title}</span>
          ) : (
            <span>
              {displayAgentName(playerDescription?.name) || '角色'}｜所在場景：{playerLocation?.labelZh ?? '校園'}
            </span>
          )}
        </div>
      ) : null}
      {canInvite && (
        <button
          className="action-pill action-pill-active pointer-events-auto mt-3 w-full disabled:opacity-60"
          disabled={!!runningActionKeys['conversation:start']}
          onClick={onStartConversation}
        >
          {runningActionKeys['conversation:start'] ? '正在前往...' : '開始對話'}
        </button>
      )}
      {activeTab === 'action' && (schoolLoading || activeActionLabel || queueItems.length) ? (
        <div className="mt-4 space-y-2">
          {(schoolLoading || activeActionLabel) && (
            <div className="action-panel-status giis-vn-card p-2 text-sm">
              {activeActionLabel ? `正在執行：${activeActionLabel}` : '更新校園狀態中...'}
            </div>
          )}
          {queueItems.map((item) => (
            <div key={item.id} className={`action-queue-item action-${item.status}`}>
              <span>{item.label}</span>
              <span>
                {item.status === 'queued'
                  ? '排隊中'
                  : item.status === 'running'
                    ? '執行中'
                    : '完成'}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {waitingForAccept && (
        <div className="giis-vn-card mt-3 p-2 text-center text-sm opacity-80">等待接受...</div>
      )}
      {waitingForNearby && (
        <div className="giis-vn-card mt-3 p-2 text-center text-sm opacity-80">正在走近...</div>
      )}
      {inConversationWithMe && !compactDialogueMode && (
        // Compact, right-aligned: leaving is an escape hatch, not the main
        // action of a conversation — the old full-width text-xl bar was the
        // single most prominent element on the screen.
        <div className="mt-2 flex justify-end">
          <button
            className="action-pill pointer-events-auto disabled:opacity-60"
            disabled={!!runningActionKeys['conversation:leave']}
            onClick={onLeaveConversation}
            title="結束這段對話（Esc）"
          >
            {runningActionKeys['conversation:leave'] ? '處理中...' : '離開對話'}
          </button>
        </div>
      )}
      {haveInvite && (
        <div className="giis-invite-card pointer-events-auto mt-3">
          <p>{displayAgentName(playerDescription?.name) || '對方'} 想跟你聊聊</p>
          <div className="giis-invite-actions">
            <button
              className="action-pill action-pill-active disabled:opacity-60"
              disabled={!!runningActionKeys['conversation:accept']}
              onClick={onAcceptInvite}
            >
              {runningActionKeys['conversation:accept'] ? '處理中...' : '接受'}
            </button>
            <button
              className="action-pill disabled:opacity-60"
              disabled={!!runningActionKeys['conversation:reject']}
              onClick={onRejectInvite}
            >
              {runningActionKeys['conversation:reject'] ? '處理中...' : '拒絕'}
            </button>
          </div>
        </div>
      )}
      {!playerConversation && player.activity && player.activity.until > Date.now() && (
        <div className="giis-vn-card mt-3 flex-grow p-2">
          <h2 className="text-center text-base sm:text-lg">{player.activity.description}</h2>
        </div>
      )}
      {activeTab === 'characters' ? (
        <>
          <CharacterRosterPanel
            names={selectableAgents}
            schoolState={liveSchoolState}
            campusSocialState={campusSocialState}
            emotionFor={emotionFor}
            targetName={targetName}
            onSelect={selectTargetByName}
          />
          <CharacterActionPanel
            targetName={targetName}
            targetProfile={targetProfile}
            runningActionKeys={runningActionKeys}
            playerIdentity={playerIdentity}
            canStartSelectedChat={!!canStartSelectedChat}
            onTravelToTarget={() => targetName && navigateToCharacter(targetName, true)}
            onStartConversation={() => void onStartSelectedConversation()}
            onOpenDialogue={() => setActiveTab('dialogue')}
            onKick={() => void onKick()}
            onAssign={() => void onAssignAssistantPrincipal()}
            clubs={campusSocialState?.clubs ?? []}
            onCreateClub={() =>
              window.dispatchEvent(
                new CustomEvent('giis:quick-action', { detail: { actionType: 'createClub', execute: false } }),
              )
            }
            onPrepareAiClubRules={() => {
              setActionText('今天先看誰變安靜，誰需要被慢慢聽完。');
              window.dispatchEvent(
                new CustomEvent('giis:quick-action', { detail: { actionType: 'announce', execute: false } }),
              );
            }}
          />
          {actionSummary ? <NarrativeResult summary={actionSummary} /> : null}
        </>
      ) : null}
      {activeTab === 'schedule' ? (
        <SchedulePanel
          timeBlock={timeBlock}
          currentScene={currentScene}
          visibleWorldTime={visibleWorldTime}
          timeHoverLabel={timeHoverLabel}
          characters={scheduleCharacters}
        />
      ) : null}
      {activeTab === 'dialogue' ? (
        <ConversationPanel
          worldId={worldId}
          engineId={engineId}
          humanPlayer={humanPlayer}
          humanConversation={humanConversation}
          targetName={playerDescription?.name ?? targetName}
          targetPlayer={player}
          targetProfile={schoolProfile}
          targetEmotion={emotionFor(playerDescription?.name)}
          targetPresence={socialPresenceFor(playerDescription?.name)}
          previousConversation={previousConversation}
          timelineState={campusTimeline}
          scrollViewRef={scrollViewRef}
          onStartConversation={onStartConversation}
          onLeaveConversation={onLeaveConversation}
          canStart={!!canInvite}
          inConversationWithMe={!!inConversationWithMe}
          waitingForAccept={!!waitingForAccept}
          waitingForNearby={!!waitingForNearby}
          unavailableReason={
            playerConversation && !sameConversation
              ? `${displayAgentName(playerDescription?.name)} 正在和 ${
                  conversationOtherNames(playerConversation, [playerId]) || '其他人'
                } 談話。你可以先等待，或改找另一位角色。`
              : undefined
          }
          isLateNight={isLateNight}
        />
      ) : null}
      {activeTab === 'debug' ? (
        <DebugPanel
          targetName={targetName}
          targetProfile={targetProfile}
          schoolState={schoolState}
          timelineState={campusTimeline}
          alanBehaviorProfile={campusSocialState?.alanBehaviorProfile}
          onToggleFreeDevelopment={(enabled) =>
            void toastOnError(setAlanFreeDevelopmentMode({ enabled }))
          }
          onRefreshSchoolState={() => void refreshSchoolState()}
        />
      ) : null}
    </>
  );
}

function ConversationPanel({
  worldId,
  engineId,
  humanPlayer,
  humanConversation,
  targetName,
  targetPlayer,
  targetProfile,
  targetEmotion,
  targetPresence,
  previousConversation,
  timelineState,
  scrollViewRef,
  onStartConversation,
  onLeaveConversation,
  canStart,
  inConversationWithMe,
  waitingForAccept,
  waitingForNearby,
  unavailableReason,
  isLateNight,
  conversationLoadingLabel,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  humanPlayer?: Player;
  humanConversation: any;
  targetName?: string;
  targetPlayer?: Player;
  targetProfile?: any;
  targetEmotion?: any;
  targetPresence?: {
    availability?: string;
    availabilityZh?: string;
    quietLineZh?: string;
    residueLineZh?: string;
    residueTimestampLabelZh?: string;
  };
  previousConversation: any;
  timelineState?: any;
  scrollViewRef: React.RefObject<HTMLDivElement>;
  onStartConversation: () => void | Promise<void>;
  onLeaveConversation: () => void | Promise<void>;
  canStart: boolean;
  inConversationWithMe: boolean;
  waitingForAccept: boolean;
  waitingForNearby: boolean;
  unavailableReason?: string;
  isLateNight?: boolean;
  conversationLoadingLabel?: string;
}) {
  // Smart default: when the drawer first opens with no active conversation,
  // 目前對話 is empty — land on 歷史對話 so there is actual content. When
  // a new conversation starts later, useEffect below promotes to 目前對話.
  const [conversationTab, setConversationTab] = useState<'current' | 'history' | 'profile'>(
    () => (humanConversation ? 'current' : 'history'),
  );
  const [historyFilter, setHistoryFilter] = useState<'今天' | '全部' | '與 Alan' | '與其他角色'>('今天');
  const [selectedHistoryThreadId, setSelectedHistoryThreadId] = useState<string>();
  const [showWakePrompt, setShowWakePrompt] = useState(false);
  // Auto-switch to 目前對話 only when a conversation transitions from
  // absent to present. Subsequent re-renders keep the user's manual tab.
  const hadActiveConversationRef = useRef(!!humanConversation);
  useEffect(() => {
    const hasNow = !!humanConversation;
    if (hasNow && !hadActiveConversationRef.current) {
      setConversationTab('current');
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    }
    hadActiveConversationRef.current = hasNow;
  }, [humanConversation]);
  const selectedCharacterHistory = targetName ? timelineState?.characterHistory : undefined;
  const scopedConversationThreads = useMemo(
    () =>
      targetName
        ? selectedCharacterHistory?.recentConversations ?? []
        : (timelineState?.timeline ?? []).filter((entry: any) => entry.previewMessages?.length).slice(0, 12),
    [selectedCharacterHistory?.recentConversations, targetName, timelineState?.timeline],
  );
  const conversationThreads = useMemo(
    () => filterCharacterConversationThreads(scopedConversationThreads, historyFilter),
    [scopedConversationThreads, historyFilter],
  );
  const selectedHistoryThread = useMemo(
    () => conversationThreads.find((entry: any) => entry.id === selectedHistoryThreadId),
    [conversationThreads, selectedHistoryThreadId],
  );
  useEffect(() => {
    if (!conversationThreads.length) {
      setSelectedHistoryThreadId(undefined);
      return;
    }
    if (!selectedHistoryThreadId || !conversationThreads.some((entry: any) => entry.id === selectedHistoryThreadId)) {
      setSelectedHistoryThreadId(conversationThreads[0].id);
    }
  }, [conversationThreads, selectedHistoryThreadId]);
  useEffect(() => {
    const leave = () => void onLeaveConversation();
    window.addEventListener('giis:leave-conversation', leave);
    return () => window.removeEventListener('giis:leave-conversation', leave);
  }, [onLeaveConversation]);
  const activeConversation = humanConversation ?? (targetPlayer ? undefined : undefined);
  const targetDisplayName = displayAgentName(targetName) || '選定角色';
  const canWakeAtNight = targetDisplayName === '海';
  const availabilityHint =
    targetPresence?.availability === 'busy'
      ? `${targetDisplayName} 現在有點忙，可能只會簡短回應。`
      : targetPresence?.availability === 'avoiding'
        ? `${targetDisplayName} 似乎暫時想避開對話。`
        : targetPresence?.availability === 'resting'
          ? `${targetDisplayName} 正在休息，最好先確認要不要打擾。`
          : targetPresence?.availability === 'sleeping'
            ? `${targetDisplayName} 已經睡了，除非很重要，不然明天再談比較好。`
            : undefined;
  const statusText = humanConversation
    ? inConversationWithMe
      ? `${targetDisplayName} 正在和 Alan 對話`
      : waitingForNearby
        ? `Alan 正在靠近 ${targetDisplayName}`
        : waitingForAccept
          ? `等待 ${targetDisplayName} 回應邀請`
          : '對話正在建立中'
    : availabilityHint
      ? availabilityHint
      : unavailableReason
      ? unavailableReason
      : canStart
      ? `可以開始和 ${targetDisplayName} 說話`
      : targetName
        ? `${targetDisplayName} 目前沒有在對話中`
        : '選一位角色開始互動';

  return (
    <section className={`giis-side-conversation-panel ${humanConversation ? 'giis-side-conversation-panel-active' : ''}`}>
      <header className="giis-side-conversation-header">
        {humanConversation && targetName ? (
          <div className="giis-rpg-portrait-stage" aria-hidden={conversationTab !== 'current'}>
            <CharacterPortrait name={targetName} size="lg" emotion={targetEmotion} />
            <div className="giis-rpg-portrait-caption">
              <span>{targetDisplayName}</span>
              <p>{targetPresence?.quietLineZh ? displayTextWithNames(targetPresence.quietLineZh) : statusText}</p>
            </div>
          </div>
        ) : null}
        <div className="giis-chat-header-row">
          {targetName ? (
            <CharacterPortrait name={targetName} size="sm" showName={false} emotion={targetEmotion} />
          ) : (
            <CharacterPortrait name="Umi" size="sm" showName={false} />
          )}
          <div>
            <h3>{targetName ? targetDisplayName : '對話'}</h3>
            <p>{statusText}</p>
            {targetPresence?.quietLineZh ? (
              <p className="giis-conversation-presence">「{displayTextWithNames(targetPresence.quietLineZh)}」</p>
            ) : null}
          </div>
        </div>
        {canStart && !isLateNight ? (
          <button
            className="action-pill action-pill-active mt-3 w-full"
            disabled={!!conversationLoadingLabel}
            onClick={() => void onStartConversation()}
          >
            {conversationLoadingLabel ? '正在前往...' : '開始說話'}
          </button>
        ) : null}
      </header>

      <div className="giis-conversation-tabs">
        <button
          className={conversationTab === 'current' ? 'active' : ''}
          onClick={() => setConversationTab('current')}
        >
          目前對話
          {activeConversation && conversationTab !== 'current' ? (
            <span className="giis-tab-dot" aria-label="有進行中的對話" />
          ) : null}
        </button>
        <button
          className={conversationTab === 'history' ? 'active' : ''}
          onClick={() => setConversationTab('history')}
        >
          歷史對話
        </button>
        <button
          className={conversationTab === 'profile' ? 'active' : ''}
          onClick={() => setConversationTab('profile')}
        >
          角色資料
        </button>
      </div>

      {conversationTab === 'current' ? (
        <div className="giis-side-conversation-body">
          {activeConversation && humanPlayer ? (
            <Messages
              worldId={worldId}
              engineId={engineId}
              inConversationWithMe={inConversationWithMe}
              conversation={{ kind: 'active', doc: activeConversation }}
              humanPlayer={humanPlayer}
              scrollViewRef={scrollViewRef}
              placeholderTargetName={targetName}
            />
          ) : (
            <div className="giis-dialogue-empty">
              <b>
                {unavailableReason
                  ? '對方正在對話中。'
                  : canStart
                    ? '可以開始對話。'
                    : '目前沒有進行中的對話。'}
              </b>
              <p>
                {unavailableReason
                  ? unavailableReason
                  : canStart
                  ? `Alan 可以直接找 ${targetDisplayName} 說話。`
                  : '先在場景或角色卡選一位角色，這裡會顯示對話狀態。'}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {conversationTab === 'history' ? (
        <div className="giis-side-conversation-body">
          {targetName ? (
            <div className="giis-character-history-head">
              <b>{targetDisplayName}｜歷史對話</b>
              <div className="giis-history-filters">
                {(['今天', '全部', '與 Alan', '與其他角色'] as const).map((filter) => (
                  <button
                    key={filter}
                    className={historyFilter === filter ? 'active' : ''}
                    onClick={() => setHistoryFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {conversationThreads.length ? (
            <div className="giis-message-history-layout">
              <div className="giis-thread-list" aria-label={`${targetDisplayName} 的歷史對話列表`}>
                {conversationThreads.map((entry: any) => {
                  const isExpanded = selectedHistoryThread?.id === entry.id;
                  const transcriptMessages = entry.transcriptMessages?.length
                    ? entry.transcriptMessages
                    : entry.previewMessages ?? [];
                  return (
                    <article
                      key={entry.id}
                      className={`giis-thread-list-item ${isExpanded ? 'active giis-thread-list-item-expanded' : ''}`}
                    >
                      <button
                        className="giis-thread-list-summary"
                        onClick={() => setSelectedHistoryThreadId(isExpanded ? undefined : entry.id)}
                      >
                        <div className="giis-thread-title">
                          <b>{conversationThreadTitle(entry)}</b>
                          <span>{entry.timestampLabelZh}</span>
                        </div>
                        <p>{conversationSummaryLine(entry)}</p>
                        {/* Footer just shows turn count; speaker/last-line
                            already live in the summary above to keep the
                            card scannable. */}
                        <small>
                          {entry.messageCount ?? entry.transcriptMessages?.length ?? entry.previewMessages?.length ?? 0} 則
                        </small>
                      </button>
                      {isExpanded ? (
                        <div className="giis-thread-inline-panel">
                          <div className="giis-thread-inline-head">
                            <span>完整對話紀錄</span>
                            <button onClick={() => setSelectedHistoryThreadId(undefined)}>收起</button>
                          </div>
                          <div className="giis-thread-window-summary">
                            {conversationSummaryLine(entry)}
                          </div>
                          <div className="giis-thread-transcript giis-thread-transcript-inline">
                            {transcriptMessages.map((message: any, index: number) => {
                              const speakerName = displayAgentName(message.author);
                              const speakerKind = speakerName === 'Alan' ? 'alan' : speakerName === targetDisplayName ? 'target' : 'other';
                              return (
                                <div
                                  key={`${entry.id}-message-${index}`}
                                  className={`giis-thread-message-row giis-thread-message-${speakerKind}`}
                                >
                                  <div>
                                    <b>{speakerName}</b>
                                    <span>{message.timestampLabelZh ?? entry.timestampLabelZh}</span>
                                  </div>
                                  <p>{naturalizeWorldText(message.text)}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="giis-dialogue-empty">
              <b>{targetName ? `${targetDisplayName} 還沒有符合條件的歷史對話。` : '請先選一位角色。'}</b>
              <p>
                {targetName
                  ? '這裡只會顯示和選定角色有關的對話，不會混入全校對話。'
                  : '選擇角色後，這裡會像訊息 inbox 一樣只顯示該角色的對話回顧。'}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {conversationTab === 'profile' ? (
        <div className="giis-side-conversation-body">
          {targetName ? (
            <>
              <CharacterProfileCard
                name={targetName}
                locationZh={(targetPlayer as any)?.locationZh}
                statusZh={inConversationWithMe ? '正在和 Alan 對話' : statusText}
                emotion={targetEmotion}
                presence={targetPresence}
                profile={targetProfile}
                history={selectedCharacterHistory}
              />
              <CharacterHistoryPanel timelineState={timelineState} targetName={targetName} compact />
            </>
          ) : (
            <div className="giis-dialogue-empty">
              <b>尚未選擇角色。</b>
              <p>選一位角色後，這裡會顯示他的狀態、最近事件與想法。</p>
            </div>
          )}
        </div>
      ) : null}

      <div className="giis-side-conversation-actions">
        {canStart && isLateNight && !showWakePrompt ? (
          <button
            className="action-pill action-pill-active"
            disabled={!!conversationLoadingLabel}
            onClick={() => setShowWakePrompt(true)}
          >
            {canWakeAtNight ? (conversationLoadingLabel ? '正在前往...' : '開始說話') : '夜間互動'}
          </button>
        ) : null}
        {canStart && isLateNight && showWakePrompt ? (
          <div className="giis-night-prompt">
            <b>{canWakeAtNight ? '現在已經很晚了。要叫醒海嗎？' : '現在已經很晚了。先不要叫醒學生。'}</b>
            {canWakeAtNight ? (
              <button
                className="action-pill action-pill-active"
                disabled={!!conversationLoadingLabel}
                onClick={() => void onStartConversation()}
              >
                {conversationLoadingLabel ? '正在前往...' : '輕聲叫醒'}
              </button>
            ) : null}
            <button className="action-pill" onClick={() => setShowWakePrompt(false)}>
              明天再談
            </button>
            <button className="action-pill" onClick={() => setConversationTab('history')}>
              留下訊息
            </button>
          </div>
        ) : null}
        {humanConversation ? (
          <button
            className="action-pill"
            disabled={!!conversationLoadingLabel}
            onClick={() => void onLeaveConversation()}
          >
            {conversationLoadingLabel ? '處理中...' : '離開對話'}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function CharacterProfileCard({
  name,
  statusZh,
  emotion,
  presence,
  profile,
  history,
}: {
  name: string;
  locationZh?: string;
  statusZh?: string;
  emotion?: string;
  presence?: {
    availabilityZh?: string;
    quietLineZh?: string;
  };
  profile?: any;
  history?: any;
}) {
  const displayName = displayAgentName(name);
  const isUmi = displayName === '海';
  const latestThought = history?.recentThoughts?.[0] ?? profile?.shortTermIntentions?.[0];
  const latestMemory = history?.recentMemories?.[0] ?? profile?.shortTermMemory?.[0];
  return (
    <section className="giis-character-profile-card">
      <div className="giis-character-status-card">
        <div>
          <span className="giis-kicker">目前狀態</span>
          <h4>{displayName}</h4>
        </div>
        <dl>
          <div>
            <dt>外顯狀態</dt>
            <dd>{displayTextWithNames(presence?.quietLineZh ?? behaviorHintFromEmotion(name, emotion))}</dd>
          </div>
          <div>
            <dt>可用狀態</dt>
            <dd>{presence?.availabilityZh ?? statusZh ?? '可以互動'}</dd>
          </div>
          <div>
            <dt>最近想法</dt>
            <dd>{displayTextWithNames(latestThought ?? '還沒有新的想法紀錄。')}</dd>
          </div>
          <div>
            <dt>最近記憶</dt>
            <dd>{displayTextWithNames(latestMemory ?? '還沒有新的記憶。')}</dd>
          </div>
        </dl>
      </div>
      <details>
        <summary>角色資料</summary>
      {isUmi ? (
        <dl>
          <div>
            <dt>名字</dt>
            <dd>海</dd>
          </div>
          <div>
            <dt>角色定位</dt>
            <dd>Alan 的桌面 AI companion / AI coordinator</dd>
          </div>
          <div>
            <dt>個性</dt>
            <dd>溫柔、直接、輕微吐槽、實用優先</dd>
          </div>
          <div>
            <dt>目前關係</dt>
            <dd>{statusZh ?? '正在和 Alan 對話'}</dd>
          </div>
          <div>
            <dt>互動風格</dt>
            <dd>繁中為主，技術詞自然用 English</dd>
          </div>
        </dl>
      ) : (
        <dl>
          <div>
            <dt>名字</dt>
            <dd>{displayName}</dd>
          </div>
          <div>
            <dt>目前狀態</dt>
            <dd>{statusZh ?? '可以互動'}</dd>
          </div>
          <div>
            <dt>提示</dt>
            <dd>角色設定與 raw state 放在「維護」，這裡只保留玩家互動需要知道的資訊。</dd>
          </div>
        </dl>
      )}
    </details>
    </section>
  );
}

function behaviorHintFromEmotion(name: string, emotion?: string) {
  const displayName = displayAgentName(name);
  if (emotion === 'smiling') return `${displayName}今天比較願意留在附近多說兩句。`;
  if (emotion === 'worried') return `${displayName}今天會更注意沒有說完的話。`;
  if (emotion === 'serious') return `${displayName}今天說話可能更短、更實際。`;
  return `${displayName}今天還沒有明顯的行為變化。`;
}

function filterCharacterConversationThreads(entries: any[], filter: '今天' | '全部' | '與 Alan' | '與其他角色') {
  const today = new Date().toLocaleDateString('en-CA');
  return entries.filter((entry) => {
    const participants = entry.involvedCharacters ?? [];
    if (filter === '與 Alan') return participants.includes('Alan');
    if (filter === '與其他角色') return !participants.includes('Alan');
    if (filter === '今天') {
      const createdAt = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-CA') : '';
      return createdAt === today || String(entry.timestampLabelZh ?? '').includes('/');
    }
    return true;
  });
}

function conversationSummaryLine(entry: any) {
  // Title above already shows participants — summary just surfaces the
  // last spoken line so the card stays scannable.
  const last = entry.previewMessages?.[entry.previewMessages.length - 1];
  if (last?.text) {
    const speaker = displayAgentName(last.author);
    const text = naturalizeWorldText(last.text);
    return speaker ? `${speaker}：${text}` : text;
  }
  return naturalizeWorldText(entry.summaryZh ?? '這是一段校園對話。');
}

function conversationThreadTitle(entry: any) {
  const participants = (entry.involvedCharacters ?? []).map(displayAgentName).filter(Boolean);
  if (!participants.length) return '校園對話';
  if (participants.length <= 3) return participants.join('、');
  return `${participants.slice(0, 3).join('、')} 等 ${participants.length} 人`;
}

function CharacterRosterPanel({
  names,
  schoolState,
  campusSocialState,
  emotionFor,
  targetName,
  onSelect,
}: {
  names: string[];
  schoolState: any[];
  campusSocialState: any;
  emotionFor: (name?: string) => any;
  targetName?: string;
  onSelect?: (name: string) => void;
}) {
  return (
    <section className="giis-roster-section">
      <div className="giis-roster-brief">
        <span className="giis-kicker">角色</span>
        <h3>找人與角色互動</h3>
        <p>選一位角色，再前往、開始說話或採取行動。</p>
      </div>
      <div className="giis-roster-list">
        {names.map((name) => {
          const profile = schoolState?.find((item: any) => item.name === name);
          const presence = campusSocialState?.emotions?.find((item: any) => item.name === name);
          const selected = targetName === name;
          return (
            <button
              key={name}
              className={`giis-roster-card ${selected ? 'giis-roster-card-selected' : ''}`}
              onClick={() => onSelect?.(name)}
            >
              <SocialCharacterCard
                name={name}
                emotion={emotionFor(name)}
                concern={characterConcern(name, campusSocialState, schoolState)}
                presence={presence}
                compact
              />
              <div className="giis-roster-meta">
                <span title={profile?.locationZh ?? '位置更新中'}>
                  {profile?.locationZh ?? '位置更新中'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CharacterActionPanel({
  targetName,
  targetProfile,
  runningActionKeys,
  playerIdentity,
  canStartSelectedChat,
  onTravelToTarget,
  onStartConversation,
  onOpenDialogue,
  onKick,
  onAssign,
  clubs,
  onCreateClub,
  onPrepareAiClubRules,
}: {
  targetName?: string;
  targetProfile?: any;
  runningActionKeys: Record<string, string | undefined>;
  playerIdentity?: { status?: string };
  canStartSelectedChat: boolean;
  onTravelToTarget: () => void;
  onStartConversation: () => void;
  onOpenDialogue: () => void;
  onKick: () => void;
  onAssign: () => void;
  clubs: any[];
  onCreateClub: () => void;
  onPrepareAiClubRules: () => void;
}) {
  const targetDisplayName = displayAgentName(targetName) || '尚未選擇';
  const targetLocation =
    targetProfile?.locationZh ??
    targetProfile?.location?.labelZh ??
    targetProfile?.currentLocation?.labelZh ??
    '位置更新中';
  const targetStatus = targetProfile?.statusZh ?? targetProfile?.activityZh ?? '正在觀察校園';
  const targetFocus = targetName ? characterConcern(targetName, undefined, targetProfile ? [targetProfile] : []) : '';
  const offline = playerIdentity?.status !== 'online';
  return (
    <section className="giis-character-actions">
      <div className="giis-character-actions-header">
        <div>
          <span className="giis-kicker">角色焦點</span>
          <h3>{targetName ? targetDisplayName : '選一位角色開始互動'}</h3>
          <p>
            {targetName
              ? `${targetDisplayName} 目前在：${targetLocation}`
              : '從上方角色卡選一位。常用互動（聊天 / 關心 / 送禮…）在底部互動列。'}
          </p>
        </div>
      </div>
      {targetName ? (
        <>
          <div className="giis-selected-character-brief">
            <div>
              <b>所在場景</b>
              <span>{targetLocation}</span>
            </div>
            <div>
              <b>現在狀態</b>
              <span>{displayTextWithNames(targetStatus)}</span>
            </div>
            <p>「{displayTextWithNames(targetFocus || defaultConcern(targetName))}」</p>
          </div>
          <p className="giis-character-actions-hint">
            常用互動（聊天 / 關心 / 問傳聞 / 送禮 / 留訊息 / 邀請）已搬到底部互動列。
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="action-pill action-pill-active" onClick={onTravelToTarget}>
              前往所在地
            </button>
            <button
              className="action-pill action-pill-active"
              disabled={!canStartSelectedChat || !!runningActionKeys['conversation:start']}
              onClick={onStartConversation}
            >
              {runningActionKeys['conversation:start'] ? '正在前往...' : '開始說話'}
            </button>
            <button className="action-pill" onClick={onOpenDialogue}>
              看對話紀錄
            </button>
            <button
              className="action-pill"
              onClick={() => window.dispatchEvent(new CustomEvent('giis:quick-action', { detail: { actionType: 'observe', execute: true } }))}
            >
              觀察對方
            </button>
          </div>
        </>
      ) : null}
      {targetName ? (
        <details className="giis-advanced-actions">
          <summary className="cursor-pointer text-sm">進階 / 玩具行動（會被記錄為事件）</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className="action-pill"
              disabled={offline || !!runningActionKeys.kick}
              onClick={onKick}
              title={actionDescriptions.kick}
            >
              {runningActionKeys.kick ? '處理中...' : actionLabels.kick}
            </button>
            <button
              className="action-pill"
              disabled={offline || !!runningActionKeys.assignRole}
              onClick={onAssign}
              title={actionDescriptions.assignRole}
            >
              {runningActionKeys.assignRole ? '處理中...' : actionLabels.assignRole}
            </button>
          </div>
        </details>
      ) : null}
    </section>
  );
}

function ClubRegistryPanel({
  clubs,
  selectedAction,
  onCreateClub,
  onPrepareAiClubRules,
}: {
  clubs: any[];
  selectedAction: SchoolActionType;
  onCreateClub: () => void;
  onPrepareAiClubRules: () => void;
}) {
  const visibleClubs = clubs.slice(0, 2);
  const archivedClubs = clubs.slice(2);
  const renderClubCard = (club: any) => (
    <article key={club.clubId ?? club.nameZh} className="giis-club-card">
      <div className="giis-club-card-title">
        <b>{displayTextWithNames(club.nameZh)}</b>
        <span>{club.statusZh ?? '活動中'}</span>
      </div>
      <p>創辦人：{displayAgentName(club.founderName) || club.founderDisplayNameZh || 'Alan'}</p>
      <p>
        成員：{' '}
        {(club.memberDisplayNamesZh ?? club.members ?? []).map((name: string) => displayAgentName(name) || name).join('、') ||
          'Alan'}
      </p>
      <div className="giis-club-meter-row">
        <span>影響力 {Math.round(club.influence ?? 0)}</span>
        <span>活躍度 {Math.round(club.activity ?? 0)}</span>
      </div>
      <p className="text-brown-200">
        目前張力：{displayTextWithNames(club.currentTensionZh ?? '社團正在尋找自己的定位。')}
      </p>
      {String(club.nameZh ?? '').includes('AI') ? (
        <button className="action-pill mt-2 w-full" onClick={onPrepareAiClubRules}>
          準備今日關心提醒
        </button>
      ) : null}
    </article>
  );
  return (
    <section className="giis-club-registry">
      <div className="giis-club-registry-header">
        <div>
          <span className="giis-kicker">社團</span>
          <h3>校園社團</h3>
        </div>
        <button
          className={`action-pill ${selectedAction === 'createClub' ? 'action-pill-active' : ''}`}
          onClick={onCreateClub}
        >
          建立新社團
        </button>
      </div>
      {visibleClubs.length ? (
        <div className="space-y-2">
          {visibleClubs.map(renderClubCard)}
          {archivedClubs.length ? (
            <details className="giis-club-archive">
              <summary>較早登記的社團（{archivedClubs.length}）</summary>
              <div className="space-y-2 mt-2">{archivedClubs.map(renderClubCard)}</div>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="giis-club-empty">
          還沒有正式登記的社團。Alan 建立社團後，這裡會顯示創辦人、成員、活動度與相關張力。
        </p>
      )}
    </section>
  );
}

function SocialCharacterCard({
  name,
  emotion,
  concern,
  presence,
  compact = false,
}: {
  name: string;
  emotion?: any;
  concern?: string;
  presence?: {
    availabilityZh?: string;
    quietLineZh?: string;
  };
  compact?: boolean;
}) {
  const visibleConcern = presence?.quietLineZh ?? concern ?? defaultConcern(name);
  return (
    <div className={`social-character-card ${compact ? 'social-character-card-compact' : ''}`}>
      <CharacterPortrait name={name} size="lg" emotion={emotion} />
      {presence?.availabilityZh ? (
        <span className="giis-availability-pill">{presence.availabilityZh}</span>
      ) : null}
      <div className="social-character-card-line">
        <span>「{displayTextWithNames(visibleConcern)}」</span>
      </div>
    </div>
  );
}

function characterConcern(name: string, socialState: any, schoolState: any[]) {
  const displayName = displayAgentName(name);
  const emotionState = socialState?.emotions?.find((item: any) => {
    const text = `${item.name ?? ''}${displayAgentName(item.name) ?? ''}`;
    return text.includes(name) || text.includes(displayName);
  });
  if (
    emotionState?.statusZh &&
    ['睡眠中', '準備休息', '深夜未眠'].includes(emotionState.statusZh)
  ) {
    if (displayName === '海' && emotionState.statusZh === '深夜未眠') {
      return '深夜未眠，正在整理校長簡報。';
    }
    if (displayName === '貓貓' && emotionState.statusZh === '深夜未眠') {
      return '可能仍在記下明天要確認的幾個症狀。';
    }
    return emotionState.statusZh;
  }
  if (emotionState?.quietLineZh) return emotionState.quietLineZh;
  const notification = socialState?.notifications?.find((item: any) => {
    const text = `${item.titleZh ?? ''}${item.contentZh ?? ''}${item.relatedCharacterName ?? ''}`;
    return text.includes(name) || text.includes(displayName);
  });
  if (notification?.contentZh) return sanitizeCharacterFocus(name, notification.contentZh);
  const event = socialState?.events?.find((item: any) => {
    const text = `${item.descriptionZh ?? ''}${item.involvedCharacters?.join(' ') ?? ''}`;
    return text.includes(name) || text.includes(displayName);
  });
  if (event?.descriptionZh) return sanitizeCharacterFocus(name, event.descriptionZh);
  const profile = schoolState?.find((item: any) => item.name === name);
  const intention = profile?.shortTermIntentions?.[0] ?? profile?.goals?.[0] ?? profile?.initialGoals?.[0];
  if (intention) return sanitizeCharacterFocus(name, intention);
  return defaultConcern(name);
}

function sanitizeCharacterFocus(name: string, text: string) {
  const displayName = displayAgentName(name);
  const cleaned = displayTextWithNames(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return defaultConcern(name);
  const otherNames = ['海', '天澤', '一之瀨', '天澤', '一之瀨', '真晝', '貓貓', '祥子'].filter(
    (item) => item !== displayName,
  );
  const looksLikeOtherCharacterStatus =
    otherNames.some((otherName) => cleaned.startsWith(otherName)) &&
    (cleaned.includes('變得') || cleaned.includes('情緒') || cleaned.includes('正在'));
  const isInternalMoodNoise =
    cleaned.includes('變得微笑') ||
    cleaned.includes('變得認真') ||
    cleaned.includes('relationship_change') ||
    cleaned.includes('emotion_changed');
  if (looksLikeOtherCharacterStatus || isInternalMoodNoise) return defaultConcern(name);
  return shortConcern(cleaned);
}

function shortConcern(text: string) {
  const cleaned = displayTextWithNames(text).replace(/\s+/g, ' ').trim();
  return cleaned.length > 32 ? `${cleaned.slice(0, 32)}...` : cleaned;
}

function defaultConcern(name: string) {
  const displayName = displayAgentName(name);
  if (displayName === '海') return '校長是不是又沒好好休息。';
  if (displayName === '一之瀨') return '今天誰欠了善意，卻還沒親口承認？';
  if (displayName === '貓貓') return '安靜不代表沒有症狀。';
  if (displayName === '真晝') return '有些學生今天比較安靜。';
  if (displayName === '祥子') return '禮貌一旦太完美，就像在退場。';
  if (displayName === '天澤') return '這條規則被推半步後會先斷在哪裡？';
  return '正在觀察今天的校園節奏。';
}

function UmiBriefingCard({
  umiBriefing,
  umiEmotion,
  onExecuteTask,
  onAcknowledge,
  onAskDetail,
}: {
  umiBriefing: any;
  umiEmotion?: any;
  onExecuteTask: (task: SuggestedTask) => void;
  onAcknowledge: () => void;
  onAskDetail: () => void;
}) {
  const briefing = umiBriefing?.briefing;
  const suggestedTasks: SuggestedTask[] = briefing?.principalTasks ?? umiBriefing?.principalTasks ?? [];
  const [showDetails, setShowDetails] = useState(!!umiBriefing?.shouldShow);
  useEffect(() => {
    if (umiBriefing?.shouldShow) setShowDetails(true);
  }, [umiBriefing?.shouldShow, umiBriefing?.lastBriefingShownAt]);

  if (!showDetails) {
    return (
      <div className="bg-brown-700 border border-brown-500 p-3 text-sm action-result-enter">
        <div className="flex items-center gap-3">
          <CharacterPortrait name="Umi" size="md" emotion={umiEmotion} />
          <div className="min-w-0 flex-1">
            <b>海的校長簡報</b>
            <p className="mt-1 text-brown-200">
              {displayTextWithNames(briefing?.majorAlerts?.[0] ?? '目前沒有新的今日焦點。')}
            </p>
          </div>
        </div>
        <button className="action-pill mt-3 w-full" onClick={() => setShowDetails(true)}>
          查看海簡報
        </button>
      </div>
    );
  }
  const dismiss = () => {
    onAcknowledge();
    setShowDetails(false);
  };
  return (
    <div className="bg-brown-700 border border-brown-500 p-3 action-result-enter text-sm space-y-3">
      <CharacterPortrait name="Umi" size="lg" emotion={umiEmotion} />
      <div>
        <h3 className="font-bold text-base">{displayTextWithNames(briefing?.titleZh ?? '海的校長簡報')}</h3>
        {briefing?.updatedAtLabelZh ? (
          <p className="mt-1 text-xs text-brown-200">更新時間：{briefing.updatedAtLabelZh}</p>
        ) : null}
        <p className="mt-1 leading-relaxed">{displayTextWithNames(briefing?.greetingZh ?? umiBriefing.briefingZh)}</p>
      </div>
      <BriefingSection
        title="今日校園焦點"
        items={briefing?.dailyFocus ?? umiBriefing?.dailyFocus}
        fallback="今天校園還算平靜。先選一位角色聊聊。"
      />
      <BriefingSection
        title="今日生活小事"
        items={briefing?.dailyLifeBulletin ?? umiBriefing?.dailyLifeBulletin}
        fallback="今天還沒有整理出明確的生活小事。"
      />
      <BriefingSection
        title="最近玩家行動"
        items={briefing?.recentPlayerActions ?? briefing?.yourActions}
        fallback="你目前沒有新的玩家行動。"
      />
      <BriefingSection
        title="離線期間事件"
        items={briefing?.awayTimeEvents ?? briefing?.awayEvents}
        fallback="你不在時沒有明顯的自主事件。"
      />
      <BriefingSection
        title="今日提醒"
        items={briefing?.majorAlerts}
        fallback="目前沒有新的今日焦點。"
      />
      <BriefingSection
        title="關係脈絡"
        items={briefing?.worldPatternInsights}
        fallback="目前世界還在累積早期模式。"
      />
      <BriefingSection title="今天留下的痕跡" items={briefing?.risks} fallback="目前沒有需要立刻處理的痕跡。" />
      <BriefingSection title="海的建議" items={briefing?.suggestions} fallback="先觀察，再決定下一步。" />
      <UmiSuggestedActions
        tasks={suggestedTasks}
        onExecuteTask={onExecuteTask}
        onIgnoreTask={dismiss}
        onAskDetail={onAskDetail}
      />
      <p className="text-brown-200">{displayTextWithNames(briefing?.helperZh)}</p>
      <div className="grid grid-cols-3 gap-2">
        <button className="action-pill" onClick={dismiss}>
          知道了
        </button>
        <button className="action-pill" onClick={dismiss}>
          暫時忽略
        </button>
        <button className="action-pill" onClick={onAskDetail}>
          詢問海詳情
        </button>
      </div>
    </div>
  );
}

function urgencyLabelZh(urgency: SuggestedTask['urgency']) {
  if (urgency === 'high') return '高';
  if (urgency === 'medium') return '中';
  return '低';
}

function UmiSuggestedActions({
  tasks,
  onExecuteTask,
  onIgnoreTask,
  onAskDetail,
}: {
  tasks: SuggestedTask[];
  onExecuteTask: (task: SuggestedTask) => void;
  onIgnoreTask: () => void;
  onAskDetail: () => void;
}) {
  if (!tasks.length) return null;
  return (
    <section className="rounded-sm border border-brown-500 bg-brown-800/50 p-3">
      <h4 className="font-bold">海的建議行動</h4>
      <div className="mt-2 space-y-3">
        {tasks.slice(0, 3).map((task) => (
          <div key={`${task.title}-${task.suggestedActionType}`} className="border-t border-brown-500 pt-2">
            <div className="flex items-start gap-2">
              {task.targetCharacter ? (
                <CharacterPortrait name={task.targetCharacter} size="sm" showName={false} />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <b>{displayTextWithNames(task.title)}</b>
                  <span className="shrink-0 text-xs text-brown-200">急迫度：{urgencyLabelZh(task.urgency)}</span>
                </div>
                <p className="mt-1 text-brown-100">{displayTextWithNames(task.reason)}</p>
              </div>
            </div>
            <p className="mt-1 text-xs text-brown-200">
              {task.targetCharacter ? `目標：${displayAgentName(task.targetCharacter)}。` : ''}
              {task.targetScene ? `場景：${task.targetScene}。` : ''}
              建議行動：{actionLabels[task.suggestedActionType]}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button className="action-pill" onClick={() => void onExecuteTask(task)}>
                {task.suggestedActionType === 'announce'
                  ? '採納草稿'
                  : task.suggestedActionType === 'createClub'
                    ? '採納草稿'
                    : '執行建議'}
              </button>
              <button className="action-pill" onClick={onIgnoreTask}>
                先不要
              </button>
              <button className="action-pill" onClick={onAskDetail}>
                修改內容
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BriefingSection({
  title,
  items,
  fallback,
}: {
  title: string;
  items?: string[];
  fallback: string;
}) {
  const visibleItems = items?.length ? items : [fallback];
  return (
    <section>
      <h4 className="font-bold">{title}</h4>
      <ul className="mt-1 space-y-1 text-brown-100">
        {visibleItems.map((item, index) => (
          <li key={`${title}-${index}`}>{displayTextWithNames(item)}</li>
        ))}
      </ul>
    </section>
  );
}

function DailyFocusCard({ items }: { items: string[] }) {
  const visibleItems = items.length
    ? items.slice(0, 3)
    : ['今天校園還算平靜。先選一位角色聊聊，看看水面下有什麼變化。'];
  return (
    <section className="giis-daily-focus">
      <span className="giis-kicker">今日校園焦點</span>
      <ul>
        {visibleItems.map((item, index) => (
          <li key={`${item}-${index}`}>{displayTextWithNames(item)}</li>
        ))}
      </ul>
    </section>
  );
}

function PlayerOverviewCard({
  playerIdentity,
  currentScene,
  timeBlock,
  visibleRealTime,
  visibleWorldTime,
  timeHoverLabel,
  scenePlayers,
  campusSocialState,
  scheduleCharacters,
  targetName,
  canStartSelectedChat,
  onOpenBriefing,
  onOpenSchedule,
  onOpenCharacters,
  onOpenTimeline,
  onOpenDialogue,
  onStartConversation,
}: {
  playerIdentity: any;
  currentScene?: SchoolLocation;
  timeBlock: { title: string; description: string };
  visibleRealTime: string;
  visibleWorldTime: string;
  timeHoverLabel: string;
  scenePlayers: Array<{ id: GameId<'players'>; name: string }>;
  campusSocialState: any;
  scheduleCharacters: ScheduleCharacter[];
  targetName: string;
  canStartSelectedChat: boolean;
  onOpenBriefing: () => void;
  onOpenSchedule: () => void;
  onOpenCharacters: () => void;
  onOpenTimeline: () => void;
  onOpenDialogue: () => void;
  onStartConversation: () => void;
}) {
  const presentSceneNames = scenePlayers
    .map((player) => displayAgentName(player.name))
    .filter((name) => name && name !== 'Alan');
  const isAlanAway = playerIdentity?.status === 'away';
  const scenePeopleLabel = isAlanAway
    ? presentSceneNames.length
      ? `Alan 離校中；${currentScene?.labelZh ?? '此處'}有 ${presentSceneNames.join('、')}`
      : 'Alan 離校中；目前場景很安靜。'
    : presentSceneNames.length
      ? presentSceneNames.join('、')
      : '這裡暫時沒有其他人';
  return (
    <section className="giis-player-overview">
      <div>
        <span className="giis-kicker">現在</span>
        <h3>{currentScene?.labelZh ?? '讀取中'}｜{timeBlock.title}</h3>
        <p title={timeHoverLabel}>
          {playerIdentity?.statusDescriptionZh ?? 'Alan 已在校園中。'}　
          <span>世界：{visibleWorldTime}</span>
        </p>
        <p className="text-brown-200">現實：{visibleRealTime}</p>
      </div>
      <div className="giis-overview-grid">
        <div>
          <b>{isAlanAway ? '場景人物' : '附近角色'}</b>
          <p>{scenePeopleLabel}</p>
        </div>
        <div>
          <b>校園氣氛</b>
          <p>{campusSocialState?.worldMoodZh ?? '平靜'}</p>
        </div>
      </div>
      <div className="giis-now-actions">
        <b>現在可以做什麼</b>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {targetName ? (
            <button
              className={`action-pill ${canStartSelectedChat ? 'action-pill-active' : ''}`}
              onClick={canStartSelectedChat ? onStartConversation : onOpenDialogue}
            >
              {canStartSelectedChat ? `開始和${displayAgentName(targetName)}說話` : '查看對話狀態'}
            </button>
          ) : (
            <button className="action-pill action-pill-active" onClick={onOpenCharacters}>
              找人聊天
            </button>
          )}
          <button className="action-pill" onClick={onOpenBriefing}>找海聽簡報</button>
          <button className="action-pill" onClick={onOpenSchedule}>查看日程</button>
          <button className="action-pill" onClick={onOpenTimeline}>看校園動態</button>
        </div>
      </div>
      {campusSocialState?.alanBehaviorProfile ? (
        <div className="giis-umi-mini">
          <b>Alan 的世界慣性</b>
          <p>{campusSocialState.alanBehaviorProfile.reflectionZh}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-brown-200">
            {(campusSocialState.alanBehaviorProfile.traits ?? []).slice(0, 3).map((trait: any) => (
              <span key={trait.trait} className="rounded-sm border border-brown-500/70 px-2 py-1">
                {trait.labelZh} {trait.score}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="text-xs text-brown-200">
        目前節奏：{timeBlock.description}
        {scheduleCharacters.length ? ` ${scheduleCharacters[0].displayName}：${scheduleCharacters[0].expectedZh}` : ''}
      </div>
    </section>
  );
}

function SchedulePanel({
  timeBlock,
  currentScene,
  visibleWorldTime,
  timeHoverLabel,
  characters,
}: {
  timeBlock: { title: string; description: string };
  currentScene?: SchoolLocation;
  visibleWorldTime: string;
  timeHoverLabel: string;
  characters: ScheduleCharacter[];
}) {
  return (
    <section className="bg-brown-700 border border-brown-500 p-3 text-sm">
      <span className="giis-kicker">日程表</span>
      <h3 className="text-lg font-bold">{timeBlock.title}</h3>
      <p className="mt-1 text-brown-200" title={timeHoverLabel}>
        {visibleWorldTime}｜目前場景：{currentScene?.labelZh ?? '讀取中'}
      </p>
      <p className="mt-2">{timeBlock.description}</p>
      <p className="mt-1 text-xs text-brown-200">
        日程只用來理解「大家為什麼在那裡」。要找人或說話，請到「找人」或「行動」。
      </p>
      <div className="mt-3 space-y-2">
        {characters.length ? (
          characters.map((character) => (
            <div key={character.name} className="rounded-sm border border-brown-500/70 bg-brown-900/30 p-2">
              <div className="flex items-center justify-between gap-2">
                <b>{character.displayName}</b>
                <span className="text-xs text-brown-200">
                  {character.locationZh ?? '位置調整中'}｜{character.statusZh ?? '清醒'}
                </span>
              </div>
              <p className="mt-1 text-brown-100">{character.expectedZh}</p>
              <p className="mt-1 text-xs text-brown-200">目前狀態：{character.currentFocusZh}</p>
            </div>
          ))
        ) : (
          <p className="text-brown-200">日程正在整理中。</p>
        )}
      </div>
    </section>
  );
}

function TimelineEntry({ entry }: { entry: any }) {
  const primaryCharacter = entry.involvedCharacters?.[0];
  return (
    <div className="rounded-sm border border-brown-500/70 bg-brown-800/40 p-2 flex gap-2">
      {primaryCharacter ? (
        <CharacterPortrait name={primaryCharacter} size="sm" showName={false} />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-xs text-brown-200">
          {entry.timestampLabelZh}
          {entry.locationZh ? `｜${entry.locationZh}` : ''}
        </div>
        <div className="mt-1 leading-relaxed">{naturalizeWorldText(entry.summaryZh)}</div>
        {entry.involvedCharacters?.length ? (
          <div className="mt-1 text-xs text-brown-200">
            相關角色：{entry.involvedCharacters.map(displayAgentName).join('、')}
          </div>
        ) : null}
        {entry.previewMessages?.length ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-brown-200">展開對話片段</summary>
            <div className="mt-2 space-y-1 rounded-sm bg-brown-900/40 p-2">
              {entry.previewMessages.map((message: any, index: number) => (
                <p key={`${entry.id}-preview-${index}`} className="text-xs leading-relaxed">
                  <b>{displayAgentName(message.author)}：</b>
                  {naturalizeWorldText(message.text)}
                </p>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function CampusTimelinePanel({ timelineState }: { timelineState: any }) {
  const timeline = timelineState?.timeline ?? [];
  const campusFeed = timeline.filter((entry: any) => !entry.previewMessages?.length).slice(0, 40);
  const sceneHistory = timelineState?.sceneHistory ?? [];
  const highlights = timelineState?.historicalHighlights ?? [];
  return (
    <div className="space-y-3">
      <div className="bg-brown-700 border border-brown-500 p-3 text-sm">
        <b>校園動態</b>
        <p className="mt-1 text-brown-200">
          這裡只放校園最近發生的事、影響與社交變化。對話紀錄請到「對話」頁看，避免兩邊重複。
        </p>
        <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {campusFeed.length ? (
            campusFeed.map((entry: any) => <TimelineEntry key={entry.id} entry={entry} />)
          ) : (
            <p className="text-brown-200">校園目前很平靜。</p>
          )}
        </div>
      </div>
      {highlights.length ? (
        <details className="bg-brown-700 border border-brown-500 p-3 text-sm">
          <summary className="cursor-pointer font-bold">重要歷史事件</summary>
          <div className="mt-2 space-y-2">
            {highlights.map((entry: any) => (
              <TimelineEntry key={`highlight-${entry.id}`} entry={entry} />
            ))}
          </div>
        </details>
      ) : null}
      <details className="bg-brown-700 border border-brown-500 p-3 text-sm">
        <summary className="cursor-pointer font-bold">依場景回顧</summary>
        <div className="mt-2 space-y-3">
          {sceneHistory.map((scene: any) => (
            <section key={scene.locationId}>
              <b>【{scene.locationZh}】</b>
              <div className="mt-1 space-y-2">
                {scene.entries?.length ? (
                  scene.entries.map((entry: any) => (
                    <TimelineEntry key={`${scene.locationId}-${entry.id}`} entry={entry} />
                  ))
                ) : (
                  <p className="text-brown-200">這裡暫時沒有近期事件。</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </details>
    </div>
  );
}

function CharacterHistoryPanel({
  timelineState,
  targetName,
  compact = false,
}: {
  timelineState: any;
  targetName: string;
  compact?: boolean;
}) {
  const history = timelineState?.characterHistory;
  if (!targetName || !history) return null;
  return (
    <div className={compact ? 'giis-character-context-card' : 'bg-brown-700 border border-brown-500 p-3 text-sm'}>
      <b>{displayAgentName(targetName)} 的歷史</b>
      <div className="mt-3 space-y-3">
        {!compact ? (
          <section>
            <h4 className="font-bold">最近對話</h4>
            <div className="mt-1 space-y-2">
              {history.recentConversations?.length ? (
                history.recentConversations.map((entry: any) => (
                  <TimelineEntry key={`character-conversation-${entry.id}`} entry={entry} />
                ))
              ) : (
                <p className="text-brown-200">目前沒有可回顧的對話。</p>
              )}
            </div>
          </section>
        ) : null}
        <section>
          <h4 className="font-bold">最近事件</h4>
          <div className="mt-1 space-y-2">
            {history.recentEvents?.length ? (
              history.recentEvents.map((entry: any) => (
                <TimelineEntry key={`character-event-${entry.id}`} entry={entry} />
              ))
            ) : (
              <p className="text-brown-200">目前沒有和這個角色直接相關的事件。</p>
            )}
          </div>
        </section>
        <section>
          <h4 className="font-bold">最近想法</h4>
          <ul className="mt-1 space-y-1 text-brown-100">
            {(history.recentThoughts?.length ? history.recentThoughts : ['目前沒有新的想法紀錄。']).map(
              (item: string, index: number) => (
                <li key={`thought-${index}`}>{item}</li>
              ),
            )}
          </ul>
        </section>
        <details>
          <summary className="cursor-pointer font-bold">近期記憶 / 信念</summary>
          <div className="mt-2 space-y-2 text-brown-100">
            <p>{displayTextWithNames(history.recentMemories?.join('；') || '目前沒有近期記憶。')}</p>
            <p>{displayTextWithNames(history.recentBeliefs?.join('；') || '目前沒有近期信念。')}</p>
          </div>
        </details>
      </div>
    </div>
  );
}

function DebugPanel({
  targetName,
  targetProfile,
  schoolState,
  timelineState,
  alanBehaviorProfile,
  onToggleFreeDevelopment,
  onRefreshSchoolState,
}: {
  targetName: string;
  targetProfile: any;
  schoolState: any[];
  timelineState?: any;
  alanBehaviorProfile?: any;
  onToggleFreeDevelopment: (enabled: boolean) => void;
  onRefreshSchoolState: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="bg-brown-700 border border-brown-500 p-3 text-sm">
        <b>維護 / 診斷</b>
        <p className="mt-1 text-brown-200">一般遊玩不用進來。這裡只放修理、raw state、記憶與診斷資訊。</p>
        <button className="action-pill mt-2" onClick={onRefreshSchoolState}>
          重新讀取角色狀態
        </button>
      </div>
      <details className="desc">
        <summary className="leading-tight -m-4 bg-brown-700 text-base sm:text-sm cursor-pointer">
          <b>{displayAgentName(targetName) || '目標角色'} 的近期記憶</b>（展開）
        </summary>
        <p className="leading-tight mt-6 -mx-4 -mb-4 bg-brown-700 text-base sm:text-sm">
          {displayTextWithNames(targetProfile?.shortTermMemory?.slice(0, 4).join('；') || '目前沒有可顯示的近期記憶。')}
        </p>
      </details>
      <details className="desc">
        <summary className="leading-tight -m-4 bg-brown-700 text-base sm:text-sm cursor-pointer">
          <b>{displayAgentName(targetName) || '目標角色'} 的信念</b>（展開）
        </summary>
        <p className="leading-tight mt-6 -mx-4 -mb-4 bg-brown-700 text-base sm:text-sm">
          {displayTextWithNames(targetProfile?.beliefs?.join('；') || '目前沒有可顯示的信念。')}
        </p>
      </details>
      <details className="bg-brown-700 border border-brown-500 p-3 text-sm">
        <summary className="cursor-pointer font-bold">Alan 自主漂移設定</summary>
        <div className="mt-3 space-y-2">
          <p className="text-brown-100">
            目前：{alanBehaviorProfile?.freeDevelopmentMode ? '自由發展模式開啟' : '自由發展模式關閉'}
          </p>
          <p className="text-brown-200">
            關閉時，Away Alan 只會留下低風險的觀察與習慣回聲，不會替你公告、創社、建立大型關係線或做不可逆決策。
          </p>
          <p className="text-brown-200">
            開啟後，Alan 將開始以這個世界學到的人格自由發展；世界可能會開始改變你未預料到的事情。
          </p>
          <button
            className={`action-pill ${alanBehaviorProfile?.freeDevelopmentMode ? '' : 'action-pill-active'}`}
            onClick={() => onToggleFreeDevelopment(!alanBehaviorProfile?.freeDevelopmentMode)}
          >
            {alanBehaviorProfile?.freeDevelopmentMode ? '關閉自由發展模式' : '開啟自由發展模式'}
          </button>
        </div>
      </details>
      <details className="bg-brown-700 border border-brown-500 p-3 text-sm">
        <summary className="cursor-pointer font-bold">角色 raw state</summary>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-brown-100">
          {JSON.stringify(schoolState, null, 2)}
        </pre>
      </details>
      <details className="bg-brown-700 border border-brown-500 p-3 text-sm">
        <summary className="cursor-pointer font-bold">選定角色歷史</summary>
        <CharacterHistoryPanel timelineState={timelineState} targetName={targetName} />
      </details>
    </div>
  );
}

function NarrativeResult({ summary }: { summary: ActionSummary }) {
  const sourceLabel =
    summary.sourceLabel ??
    (summary.storyDigest?.length
      ? '來源：世界自然發展'
      : summary.yourAction.includes('海準備')
        ? '來源：海的建議草稿'
        : '來源：Alan 手動行動');
  return (
    <div className="desc my-4 action-result-enter">
      <div className="leading-tight -m-4 bg-brown-700 text-base sm:text-sm space-y-3">
        {summary.storyDigest?.length ? (
          <section className="giis-story-digest">
            <h3>校園剛剛發生了 3 件事</h3>
            {summary.storyDigest.map((item, index) => (
              <article key={`${item.happenedZh}-${index}`}>
                <b>{index + 1}. {displayTextWithNames(item.happenedZh)}</b>
                <p>影響：{displayTextWithNames(item.changedZh)}</p>
                <p>意義：{displayTextWithNames(item.whyItMattersZh)}</p>
                <p>建議：{displayTextWithNames(item.suggestedActionZh)}</p>
              </article>
            ))}
          </section>
        ) : null}
        <p className="text-brown-200">
          <b>{sourceLabel}</b>
        </p>
        <p>
          <b>你的行動：</b>
          {displayTextWithNames(summary.yourAction)}
        </p>
        <p>
          <b>角色反應：</b>
          {displayTextWithNames(summary.characterReactions)}
        </p>
        <p>
          <b>世界變化：</b>
          {displayTextWithNames(summary.worldChanges)}
        </p>
        <p>
          <b>後續伏筆 / 建議行動：</b>
          {displayTextWithNames(summary.futureImplications)}
        </p>
      </div>
    </div>
  );
}

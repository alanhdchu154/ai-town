import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import PixiGame from './PixiGame.tsx';

import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useMutation, useQuery } from 'convex/react';
import PlayerDetails from './PlayerDetails.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame } from '../hooks/serverGame.ts';
import {
  SchoolLocationId,
  SchoolLocations,
  nearestSchoolLocation,
  SchoolLocation,
} from '../../data/schoolLocations.ts';
import { displayAgentName, displayTextWithNames } from '../../data/displayNames.ts';
import { CharacterPortrait } from './CharacterPortrait.tsx';
import InteractButton from './buttons/InteractButton.tsx';
import { ClassroomBounds, ClassroomCenter, ClassroomWalkBounds } from '../../data/classroomBounds.ts';

const ROOM_PADDING_TILES = 0.5;
const ROOM_VIEW_WIDTH_TILES =
  ClassroomBounds.maxX - ClassroomBounds.minX + 1 + 2 * ROOM_PADDING_TILES;
const ROOM_VIEW_HEIGHT_TILES =
  ClassroomBounds.maxY - ClassroomBounds.minY + 1 + 2 * ROOM_PADDING_TILES;
const ROOM_VIEW_ASPECT = ROOM_VIEW_WIDTH_TILES / ROOM_VIEW_HEIGHT_TILES;

export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;

type RightPanelTab = 'action' | 'dialogue' | 'characters' | 'schedule' | 'debug';
type CampusFeedFilter = '全部' | '未讀' | '今日焦點' | '傳聞' | '關係事件' | '對話' | '場景事件';
type CampusNotificationItem = {
  id: string;
  text: string;
  detail?: string;
  category: Exclude<CampusFeedFilter, '全部' | '未讀'>;
  createdAt: number;
  timestamp?: string;
  priority: number;
};
type FloatingActionSummary = {
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

type GameProps = {
  view?: 'world' | 'conversations';
  onChangeView?: (next: 'world' | 'conversations') => void;
};

export default function Game({ view = 'world', onChangeView }: GameProps = {}) {
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [selectedSceneId, setSelectedSceneId] = useState<SchoolLocationId>('classroom');
  const [sceneMessage, setSceneMessage] = useState('');
  const [umiPanelCollapsed, setUmiPanelCollapsed] = useState(
    () => globalThis.localStorage?.getItem('giis:umi-panel-collapsed') === '1',
  );
  const [campusFeedCollapsed, setCampusFeedCollapsed] = useState(true);
  const [campusFeedFullView, setCampusFeedFullView] = useState(false);
  const [quickTextAction, setQuickTextAction] = useState<QuickActionType>();
  const [quickText, setQuickText] = useState('');
  const [floatingActionSummary, setFloatingActionSummary] = useState<FloatingActionSummary>();
  const [schedulePanelCollapsed, setSchedulePanelCollapsed] = useState(
    () => globalThis.localStorage?.getItem('giis:schedule-panel-collapsed') !== '0',
  );
  const [campusFeedFilter, setCampusFeedFilter] = useState<CampusFeedFilter>('全部');
  const [readCampusFeedIds, setReadCampusFeedIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(globalThis.localStorage?.getItem('giis:campus-feed-read') ?? '[]'));
    } catch {
      return new Set();
    }
  });
  const [focusRequest, setFocusRequest] = useState<{
    x: number;
    y: number;
    scale?: number;
    nonce: number;
  }>();
  const [minuteTick, setMinuteTick] = useState(() => Math.floor(Date.now() / 60_000));
  const lastAlanFocusKey = useRef('');
  const previousMovingStateRef = useRef<Map<string, boolean>>(new Map());
  const [gameWrapperRef, { width, height }] = useElementSize();
  const userTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago',
    [],
  );

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const clockState = useQuery(api.school.worldClock, { timeZone: userTimeZone, tick: minuteTick });
  const campusSocialState = useQuery(api.school.campusSocialState, { timeZone: userTimeZone });
  const umiBriefing = useQuery(api.school.umiBriefing, { timeZone: userTimeZone });
  const playerIdentity = useQuery(api.school.currentPlayerIdentity);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;
  const moveAlanTo = useMutation(api.school.moveAlanTo);
  const enterCampus = useMutation(api.school.enterCampus);
  const humanTokenIdentifier = useQuery(api.world.userStatus, worldId ? { worldId } : 'skip');

  const game = useServerGame(worldId);
  const movementStateKey = useMemo(() => {
    if (!game) return '';
    return [...game.world.players.values()]
      .map((player) => `${player.id}:${player.pathfinding ? 'moving' : 'idle'}:${player.position.x.toFixed(2)}:${player.position.y.toFixed(2)}`)
      .join('|');
  }, [game]);
  const alanPlayerForFocus = useMemo(() => {
    if (!game) return undefined;
    return [...game.world.players.values()].find(
      (player) => game.playerDescriptions.get(player.id)?.name === 'Alan',
    );
  }, [game]);
  const focusOn = (position?: { x: number; y: number }, scale = 1.7) => {
    if (!position) return;
    if (import.meta.env.DEV) {
      console.debug('[GIIS focus]', {
        targetCoordinates: position,
        scale,
        currentScene: selectedSceneId,
      });
    }
    setFocusRequest({ ...position, scale, nonce: Date.now() });
  };

  useEffect(() => {
    const updateTick = () => setMinuteTick(Math.floor(Date.now() / 60_000));
    const interval = window.setInterval(updateTick, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    globalThis.localStorage?.setItem('giis:umi-panel-collapsed', umiPanelCollapsed ? '1' : '0');
  }, [umiPanelCollapsed]);

  useEffect(() => {
    globalThis.localStorage?.setItem(
      'giis:schedule-panel-collapsed',
      schedulePanelCollapsed ? '1' : '0',
    );
  }, [schedulePanelCollapsed]);

  useEffect(() => {
    globalThis.localStorage?.setItem(
      'giis:campus-feed-read',
      JSON.stringify([...readCampusFeedIds]),
    );
  }, [readCampusFeedIds]);

  useEffect(() => {
    if (!sceneMessage) return;
    const timeout = window.setTimeout(() => setSceneMessage(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [sceneMessage]);

  useEffect(() => {
    if (!floatingActionSummary) return;
    const timeout = window.setTimeout(() => setFloatingActionSummary(undefined), 6500);
    return () => window.clearTimeout(timeout);
  }, [floatingActionSummary]);

  useEffect(() => {
    const openUmiPanel = () => {
      setCampusFeedCollapsed(true);
      setCampusFeedFullView(false);
      setUmiPanelCollapsed(false);
    };
    const openCampusFeed = () => {
      setUmiPanelCollapsed(true);
      setCampusFeedCollapsed(false);
    };
    window.addEventListener('giis:open-umi-panel', openUmiPanel);
    window.addEventListener('giis:open-campus-feed', openCampusFeed);
    return () => {
      window.removeEventListener('giis:open-umi-panel', openUmiPanel);
      window.removeEventListener('giis:open-campus-feed', openCampusFeed);
    };
  }, []);

  useEffect(() => {
    if (!alanPlayerForFocus?.position) return;
    const focusKey = `${alanPlayerForFocus.id}:${Math.round(alanPlayerForFocus.position.x * 10)}:${Math.round(
      alanPlayerForFocus.position.y * 10,
    )}`;
    if (lastAlanFocusKey.current === focusKey) return;
    const isFirstFocus = !lastAlanFocusKey.current;
    lastAlanFocusKey.current = focusKey;
    const alanScene = nearestSchoolLocation(alanPlayerForFocus.position);
    if (alanScene) setSelectedSceneId(alanScene.id);
    focusOn(alanPlayerForFocus.position, isFirstFocus ? 1.35 : 1.25);
    if (isFirstFocus) {
      setSceneMessage('鏡頭已聚焦 Alan 的校園位置。');
    }
  }, [alanPlayerForFocus?.id, alanPlayerForFocus?.position?.x, alanPlayerForFocus?.position?.y]);

  useEffect(() => {
    if (!game || alanPlayerForFocus?.position) return;
    const timeout = window.setTimeout(() => {
      focusOn(ClassroomCenter, 1.02);
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [game, alanPlayerForFocus?.position]);

  useEffect(() => {
    const onActionCinematic = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string }>).detail;
      focusOn(alanPlayerForFocus?.position, 1.45);
      setSceneMessage(detail?.label ? `Alan 行動：${detail.label}` : 'Alan 的行動已影響校園。');
    };
    const onSceneMessage = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) setSceneMessage(detail.message);
    };
    const onActionResult = (event: Event) => {
      const detail = (event as CustomEvent<FloatingActionSummary>).detail;
      if (detail?.yourAction) setFloatingActionSummary(detail);
    };
    window.addEventListener('giis:action-cinematic', onActionCinematic);
    window.addEventListener('giis:scene-message', onSceneMessage);
    window.addEventListener('giis:action-result', onActionResult);
    return () => {
      window.removeEventListener('giis:action-cinematic', onActionCinematic);
      window.removeEventListener('giis:scene-message', onSceneMessage);
      window.removeEventListener('giis:action-result', onActionResult);
    };
  }, [alanPlayerForFocus?.position?.x, alanPlayerForFocus?.position?.y]);

  useEffect(() => {
    if (!game) return;
    const nextState = new Map<string, boolean>();
    for (const player of game.world.players.values()) {
      const isMoving = !!player.pathfinding;
      const wasMoving = previousMovingStateRef.current.get(player.id);
      nextState.set(player.id, isMoving);
      const isAlan = game.playerDescriptions.get(player.id)?.name === 'Alan';
      const isSelected = selectedElement?.id === player.id;
      if (wasMoving && !isMoving && (isAlan || isSelected)) {
        const scene = nearestSchoolLocation(player.position);
        const name = displayAgentName(game.playerDescriptions.get(player.id)?.name ?? player.id);
        setSceneMessage(`${name} 抵達${scene?.labelZh ?? '目的地'}。`);
      }
    }
    previousMovingStateRef.current = nextState;
  }, [game, movementStateKey, selectedElement?.id]);

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onCharacterNavigation = (event: Event) => {
      if (!game || !engineId) return;
      const detail = (event as CustomEvent<{ name?: string; travel?: boolean }>).detail;
      if (!detail?.name) return;
      const allPlayers = [...game.world.players.values()];
      const activeHuman = allPlayers.find((player) => player.human === humanTokenIdentifier);
      const target = allPlayers.find((player) =>
        matchesCharacterName(game.playerDescriptions.get(player.id)?.name, detail.name),
      );
      const targetName = displayAgentName(detail.name);
      if (!target) {
        setSceneMessage(`找不到 ${targetName}。`);
        return;
      }
      setSelectedElement({ kind: 'player', id: target.id });
      const scene = nearestSchoolLocation(target.position);
      if (scene) setSelectedSceneId(scene.id);
      if (detail.travel) {
        if (activeHuman && game.world.playerConversation(activeHuman)) {
          setSceneMessage('正在對話中。請先離開目前對話，再去找其他人。');
        } else {
          const destination = {
            x: Math.max(1, Math.min(game.worldMap.width - 2, Math.round(target.position.x + 1))),
            y: Math.max(1, Math.min(game.worldMap.height - 2, Math.round(target.position.y))),
          };
          void (async () => {
            if (!activeHuman) {
              await enterCampus({});
            }
            const result = await moveAlanTo({ destination });
            setSceneMessage(result.descriptionZh || `Alan 正在前往 ${targetName}。`);
          })().catch((error) => {
            console.error('[GIIS travel to character failed]', error);
            setSceneMessage(`暫時無法前往 ${targetName}。`);
          });
          setSceneMessage(
            activeHuman
              ? `Alan 正在前往 ${targetName} 所在位置。`
              : `先把 Alan 接回校園，再前往 ${targetName}。`,
          );
        }
      } else {
        setSceneMessage(`已找到 ${targetName}。`);
      }
      window.setTimeout(() => focusOn(target.position, detail.travel ? 1.35 : 1.5), 60);
    };
    window.addEventListener('giis:navigate-character', onCharacterNavigation);
    return () => window.removeEventListener('giis:navigate-character', onCharacterNavigation);
  }, [enterCampus, game, humanTokenIdentifier, moveAlanTo, setSelectedElement]);

  if (!worldId || !engineId || !game) {
    return null;
  }
  const players = [...game.world.players.values()];
  const humanPlayer = players.find((player) => player.human === humanTokenIdentifier);
  const humanConversation = humanPlayer ? game.world.playerConversation(humanPlayer) : undefined;
  const currentScene =
    SchoolLocations.find((location) => location.id === selectedSceneId) ?? SchoolLocations[0];
  const sceneGroups = SchoolLocations.map((location) => {
    const occupants = players.filter(
      (player) => nearestSchoolLocation(player.position)?.id === location.id,
    );
    return { location, occupants };
  });
  const scenePlayers =
    sceneGroups.find((group) => group.location.id === currentScene.id)?.occupants ?? [];
  const scheduleEntries = players
    .map((player) => {
      const name = game.playerDescriptions.get(player.id)?.name;
      if (!name || name === 'Alan') return null;
      const presence = campusSocialState?.emotions?.find((item: any) => item.name === name);
      const location = nearestSchoolLocation(player.position);
      const destination = player.pathfinding?.destination
        ? nearestSchoolLocation(player.pathfinding.destination)
        : undefined;
      return {
        id: player.id,
        name,
        displayName: displayAgentName(name),
        locationZh: location?.labelZh ?? '位置調整中',
        statusZh: player.pathfinding
          ? `正在前往 ${destination?.labelZh ?? '目的地'}`
          : presence?.availabilityZh ?? '停留中',
        quietLineZh: presence?.quietLineZh,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-Hant'));
  const alanPlayer = players.find((player) => game.playerDescriptions.get(player.id)?.name === 'Alan');
  const conversationPlayerIds = humanConversation
    ? [...humanConversation.participants.keys()].filter((participantId) => participantId !== humanPlayer?.id)
    : [];
  const conversationTargets = conversationPlayerIds
    .map((conversationPlayerId) => game.world.players.get(conversationPlayerId))
    .filter(Boolean);
  const isConversationMode = !!humanPlayer && !!humanConversation;
  const selectedPlayer =
    (selectedElement?.id ? game.world.players.get(selectedElement.id) : undefined) ?? conversationTargets[0];
  const selectedName = selectedPlayer
    ? game.playerDescriptions.get(selectedPlayer.id)?.name
    : undefined;
  const alanLocation = alanPlayer ? nearestSchoolLocation(alanPlayer.position) : undefined;
  const selectedLocation = selectedPlayer ? nearestSchoolLocation(selectedPlayer.position) : undefined;
  const targetDistance =
    alanPlayer && selectedPlayer
      ? Math.hypot(alanPlayer.position.x - selectedPlayer.position.x, alanPlayer.position.y - selectedPlayer.position.y)
      : undefined;
  const targetDistanceStatus = playerIdentity?.status === 'away'
    ? 'Alan 離校'
    : !selectedPlayer
    ? '找不到角色'
    : !alanLocation || !selectedLocation || alanLocation.id !== selectedLocation.id
      ? '不在同場景'
      : targetDistance !== undefined && targetDistance <= 4
        ? '附近'
        : humanConversation
          ? '正在靠近'
          : '較遠';
  const selectedDestination = selectedPlayer?.pathfinding?.destination
    ? nearestSchoolLocation(selectedPlayer.pathfinding.destination)
    : undefined;
  const selectedStatus = selectedPlayer?.pathfinding
    ? `正在前往${selectedDestination?.labelZh ?? '目的地'}`
    : selectedPlayer?.activity?.description ?? '正在觀察今天的校園心情';
  const measuredWorldWidth = width ?? 0;
  const measuredWorldHeight = height ?? 0;
  // Let the canvas fill the whole world window. The bottom action bar and
  // right panel float above it, so shrinking the canvas left a large dark
  // backing plate that made the classroom feel boxed-in.
  const stageWidth = Math.max(360, measuredWorldWidth);
  const stageHeight = Math.max(320, measuredWorldHeight);
  const alanDestination = alanPlayer?.pathfinding?.destination
    ? nearestSchoolLocation(alanPlayer.pathfinding.destination)
    : undefined;
  const alanMovementHint = alanPlayer?.pathfinding
    ? `Alan 正在前往${alanDestination?.labelZh ?? '目的地'}`
    : isConversationMode
      ? '對話中：先離開對話才能移動'
      : '點地板移動 Alan';
  const periodLabel = clockState?.periodLabelZh ?? '讀取中';
  // Visual cue for time of day. Scene tone already shifts with period,
  // but a glyph in the topbar lets the player read it without parsing
  // the Chinese label.
  const periodGlyph =
    periodLabel === '深夜'
      ? '🌙'
      : periodLabel === '晚上'
        ? '🌆'
        : periodLabel === '早晨'
          ? '🌅'
          : periodLabel === '下午'
            ? '☀️'
            : periodLabel === '中午'
              ? '🌞'
              : '◐';
  const realClockLabel = clockState?.realTimeLabelZh ?? '讀取中';
  const worldClockLabel = clockState?.worldTimeLabelZh ?? '讀取中';
  const hudTimeLabel = clockState?.dayClockLabelZh ?? worldClockLabel;
  const timeHoverLabel =
    clockState?.hoverLabelZh ?? `現實：${realClockLabel}\n世界：${worldClockLabel}`;
  const alanPlaceLabel = alanPlayer ? alanLocation?.labelZh ?? currentScene.labelZh : '離校處理其他公司';
  const visibleSceneNames = scenePlayers
    .map((player) => displayAgentName(game.playerDescriptions.get(player.id)?.name))
    .filter(Boolean);
  const occupiedRoomLabels = sceneGroups
    .filter((group) => group.occupants.length > 0)
    .map((group) => `${group.location.labelZh} (${group.occupants.length})`);
  const emptyRoomTitle =
    periodLabel === '深夜'
      ? `${currentScene.labelZh}安靜下來了。`
      : `「${currentScene.labelZh}」現在沒有人。`;
  const emptyRoomDetail = occupiedRoomLabels.length
    ? `大家在：${occupiedRoomLabels.join('、')}`
    : periodLabel === '深夜'
      ? '大多數人可能在休息或移動中。'
      : '大家可能在移動，或正在處理自己的事。';
  const campusFeedItems: CampusNotificationItem[] = [
    ...(campusSocialState?.dailyFocus ?? []).map((item: any, index: number) => ({
      id: feedItemId('daily-focus', item, clockState?.clock?.day ?? 'unknown-day', index),
      text: typeof item === 'string' ? item : item.summaryZh ?? item.descriptionZh ?? item.titleZh,
      detail:
        typeof item === 'string'
          ? '今天值得 Alan 先留意的校園焦點。'
          : item.whyItMattersZh ??
            item.futureImplicationsZh ??
            item.reasonZh ??
            item.needsAlanActionZh ??
            '今天值得 Alan 先留意的校園焦點。',
      category: '今日焦點' as const,
      createdAt: feedCreatedAt(item, Date.now() - index),
      timestamp: clockState?.combinedLabelZh ?? clockState?.realTimeLabelZh,
      priority: 100 - index,
    })),
    ...(campusSocialState?.events ?? []).map((event: any) => ({
      id: String(event.eventId ?? event._id ?? `event-${event.descriptionZh}`),
      text: event.descriptionZh,
      detail:
        event.type === 'chatMessage'
          ? event.interpretationZh ?? 'Alan 親自說了一句話；這只是今日紀錄，不等於角色已寫入情緒殘留。'
          : event.whyItMattersZh ??
            event.futureImplicationsZh ??
            event.reactionDialogueZh ??
            event.outcomeZh ??
            event.resultZh,
      category: eventCategory(event),
      createdAt: feedCreatedAt(event),
      timestamp: event.timestampLabelZh ?? event.createdAtLabelZh ?? event.createdAtRealLabelZh,
      priority: event.type === 'dailyOpeningFocus' ? 95 : event.importance ?? 1,
    })),
    ...(campusSocialState?.notifications ?? []).map((item: any) => ({
      id: String(item.notificationId ?? item._id ?? `notification-${item.contentZh ?? item.titleZh}`),
      text: item.contentZh ?? item.titleZh,
      detail: item.reasonZh ?? item.whyItMattersZh ?? item.futureImplicationsZh ?? item.descriptionZh,
      category: notificationCategory(item),
      createdAt: feedCreatedAt(item),
      timestamp: item.timestampLabelZh ?? item.createdAtLabelZh ?? item.createdAtRealLabelZh,
      priority: item.importance ?? 1,
    })),
    ...(campusSocialState?.rumors ?? []).map((rumor: any) => ({
      id: String(rumor.rumorId ?? rumor._id ?? `rumor-${rumor.contentZh}`),
      text: rumor.contentZh,
      detail:
        rumor.affectedCharacters?.length
          ? `影響：${rumor.affectedCharacters.map((name: string) => displayAgentName(name)).join('、')}`
          : '這個傳聞正在校園裡慢慢流動。',
      category: '傳聞' as const,
      createdAt: feedCreatedAt(rumor),
      timestamp: rumor.timestampLabelZh ?? rumor.createdAtLabelZh ?? rumor.createdAtRealLabelZh,
      priority: rumor.spreadLevel ?? 1,
    })),
  ]
    .filter((item, index, list) => {
      if (!item.text) return false;
      const text = displayTextWithNames(item.text);
      if (text.includes('變得微笑') || text.includes('變得認真')) return false;
      return list.findIndex((candidate) => candidate.text === item.text) === index;
    })
    .sort((a, b) => {
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return (b.priority ?? 0) - (a.priority ?? 0);
    });
  const unreadCampusFeedCount = campusFeedItems.filter((item) => !readCampusFeedIds.has(item.id)).length;
  const umiSuggestions =
    umiBriefing?.briefing?.principalTasks?.length
      ? umiBriefing.briefing.principalTasks
      : campusSocialState?.principalTasks ?? [];
  const contextualActions =
    periodLabel === '深夜'
      ? [
          { label: '觀察', actionType: 'observe' as QuickActionType },
          { label: '留訊息', actionType: 'chat' as QuickActionType },
        ]
      : quickActionsForScene(currentScene.id);
  const runQuickAction = (actionType: QuickActionType) => {
    if (import.meta.env.DEV) {
      console.debug('[GIIS timing]', { action: actionType, phase: 'quickActionClick', ms: 0 });
    }
    const needsText = QUICK_TEXT_ACTIONS.has(actionType);
    if (needsText) {
      const needsTarget = QUICK_TARGET_TEXT_ACTIONS.has(actionType);
      if (needsTarget && !selectedName) {
        setSceneMessage('先選一位角色，再留下這個小行動。');
        return;
      }
      setQuickTextAction(actionType);
      setQuickText('');
      window.dispatchEvent(
        new CustomEvent('giis:quick-action', { detail: { actionType, execute: false } }),
      );
      return;
    }
    setQuickTextAction(undefined);
    setQuickText('');
    window.dispatchEvent(
      new CustomEvent('giis:quick-action', { detail: { actionType, execute: true } }),
    );
  };
  const submitQuickTextAction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quickTextAction) return;
    const text = quickText.trim();
    if (!text) {
      setSceneMessage(`${QUICK_ACTION_LABELS[quickTextAction]}需要一句短內容。`);
      return;
    }
    window.dispatchEvent(
      new CustomEvent('giis:quick-action', {
        detail: { actionType: quickTextAction, execute: true, text },
      }),
    );
    setQuickTextAction(undefined);
    setQuickText('');
  };
  const handleWorldPanelClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLCanvasElement)) return;
    if (event.defaultPrevented) return;
    const rect = event.target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const destination = {
      x: Math.round(
        ClassroomWalkBounds.minX + xRatio * (ClassroomWalkBounds.maxX - ClassroomWalkBounds.minX),
      ),
      y: Math.round(
        ClassroomWalkBounds.minY + yRatio * (ClassroomWalkBounds.maxY - ClassroomWalkBounds.minY),
      ),
    };
    void moveAlanTo({ destination })
      .then((result) => setSceneMessage(result.descriptionZh))
      .catch((error) => {
        console.error('[GIIS floor click move failed]', error);
        setSceneMessage('暫時無法移動 Alan。');
      });
  };
  const switchScene = (nextId: SchoolLocationId) => {
    const clickStart = performance.now();
    const nextScene = SchoolLocations.find((location) => location.id === nextId) ?? SchoolLocations[0];
    const nextGroup = sceneGroups.find((group) => group.location.id === nextId);
    if (isConversationMode) {
      setSceneMessage('正在對話中。請先離開目前對話，再切換場景。');
      return;
    }
    setSelectedSceneId(nextId);
    const destination = nextScene.spawnPoints[0] ?? nextScene.position;
    void (async () => {
      if (!humanPlayer) {
        await enterCampus({});
      }
      return moveAlanTo({ destination });
    })().then((result) => {
        setSceneMessage(result.descriptionZh || `Alan 前往：${nextScene.labelZh}。`);
      }).catch((error) => {
        console.error('[GIIS scene travel failed]', error);
        setSceneMessage(`無法前往：${nextScene.labelZh}`);
      });
    focusOn(nextScene.position, 1.2);
    setSceneMessage(
      humanPlayer
        ? `Alan 前往：${nextScene.labelZh}。此處有 ${nextGroup?.occupants.length ?? 0} 位角色。`
        : `先把 Alan 接回校園，再前往：${nextScene.labelZh}。`,
    );
    if (import.meta.env.DEV) {
      requestAnimationFrame(() => {
        console.debug('[GIIS timing]', {
          action: 'switchScene',
          phase: 'renderUpdateTime',
          ms: Math.round(performance.now() - clickStart),
          scene: nextScene.id,
        });
      });
    }
  };
  const switchSceneAndFocus = (
    scene: SchoolLocation | undefined,
    position: { x: number; y: number } | undefined,
    label: string,
    scale = 1.35,
  ) => {
    if (!scene || !position) {
      setSceneMessage('找不到角色位置。');
      return;
    }
    setSelectedSceneId(scene.id);
    window.setTimeout(() => focusOn(position, scale), 60);
    setSceneMessage(label);
    if (import.meta.env.DEV) {
      console.debug('[GIIS focus request]', {
        label,
        targetScene: scene.id,
        targetCoordinates: position,
        currentScene: selectedSceneId,
      });
    }
  };
  const focusSelectedTarget = () => {
    if (!selectedPlayer) {
      setSceneMessage('請先選擇角色');
      return;
    }
    switchSceneAndFocus(
      selectedLocation,
      selectedPlayer.position,
      `已聚焦 ${displayAgentName(selectedName)}`,
      1.5,
    );
  };
  const focusSceneCharacters = () => {
    if (!scenePlayers.length) {
      focusOn(currentScene.position, 1.12);
      setSceneMessage('此場景目前沒有角色。');
      return;
    }
    const center = scenePlayers.reduce(
      (acc, player) => ({ x: acc.x + player.position.x, y: acc.y + player.position.y }),
      { x: 0, y: 0 },
    );
    focusOn({ x: center.x / scenePlayers.length, y: center.y / scenePlayers.length }, 1.18);
    setSceneMessage(`已顯示 ${currentScene.labelZh} 的所有角色。`);
  };
  const focusAlan = () => {
    if (alanPlayerForFocus) {
      const scene = nearestSchoolLocation(alanPlayerForFocus.position);
      switchSceneAndFocus(scene, alanPlayerForFocus.position, '已找到 Alan。', 1.55);
      return;
    }
    void enterCampus({})
      .then((result) => {
        setSceneMessage(result.descriptionZh || 'Alan 已回到校園。');
      })
      .catch((error) => {
        console.error('[GIIS enter campus for focus failed]', error);
        setSceneMessage('暫時無法把 Alan 接回校園。');
      });
    setSceneMessage('正在把 Alan 接回校園。');
  };
  const openPanelTab = (tab: RightPanelTab) => {
    setPanelCollapsed(false);
    window.dispatchEvent(new CustomEvent('giis:open-panel-tab', { detail: { tab } }));
  };
  const shellPeriodClass =
    periodLabel === '深夜'
      ? 'period-late-night'
      : periodLabel === '晚上'
        ? 'period-night'
        : periodLabel === '早晨'
          ? 'period-morning'
          : periodLabel === '下午'
            ? 'period-afternoon'
            : 'period-day';
  const playFlowSteps = [
    { label: '進入', state: humanPlayer ? 'done' : 'active' },
    { label: '選人', state: selectedName ? 'done' : humanPlayer ? 'active' : 'pending' },
    {
      label: '靠近',
      state:
        !selectedName
          ? 'pending'
          : targetDistanceStatus === '附近' || isConversationMode
            ? 'done'
            : 'active',
    },
    { label: '對話', state: isConversationMode ? 'active' : selectedName ? 'pending' : 'pending' },
    { label: '回顧', state: !isConversationMode && selectedName ? 'active' : 'pending' },
  ] as const;

  return (
    <>
      {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
      <div
        className={`giis-switch-shell giis-live-room-shell ${
          currentScene.id === 'aiClubRoom'
            ? 'scene-ai'
            : currentScene.id === 'studentCouncilRoom'
              ? 'scene-council'
              : currentScene.id === 'dormitory'
                ? 'scene-dorm'
                : currentScene.id === 'courtyard'
                  ? 'scene-courtyard'
                  : 'scene-classroom'
        } ${shellPeriodClass} ${isConversationMode ? 'giis-conversation-active' : ''} ${
          panelCollapsed && !isConversationMode ? 'giis-panel-is-collapsed' : ''
        }`}
      >
        <div className="giis-topbar">
          <div className="giis-topbar-title">
            <span className="giis-kicker">GIIS Underworld</span>
            <b>
              <span className="giis-period-glyph" aria-hidden="true">
                {periodGlyph}
              </span>
              {currentScene.labelZh}｜{periodLabel}
            </b>
            <p className="giis-topbar-line" title={timeHoverLabel}>
              Alan｜{hudTimeLabel}
            </p>
          </div>
          {onChangeView ? (
            <div className="giis-view-switch" role="tablist" aria-label="切換視圖">
              <button
                role="tab"
                aria-selected={view === 'world'}
                className={view === 'world' ? 'active' : ''}
                onClick={() => onChangeView('world')}
              >
                世界
              </button>
              <button
                role="tab"
                aria-selected={view === 'conversations'}
                className={view === 'conversations' ? 'active' : ''}
                onClick={() => onChangeView('conversations')}
              >
                對話
              </button>
            </div>
          ) : null}
          <label className="giis-scene-select" title={isConversationMode ? '正在對話中，先離開對話才能切換場景。' : '切換到其他場景'}>
            <span className="giis-scene-select-glyph" aria-hidden="true">→</span>
            <select
              className="giis-select"
              value={selectedSceneId}
              disabled={isConversationMode}
              aria-label="切換場景"
              onChange={(event) => switchScene(event.target.value as SchoolLocationId)}
            >
              {sceneGroups.map(({ location, occupants }) => (
                <option key={location.id} value={location.id}>
                  {location.labelZh} ({occupants.length})
                </option>
              ))}
            </select>
          </label>
          <InteractButton />
          <button
            className="giis-presence-button giis-find-alan-button"
            onClick={focusAlan}
            title={alanPlayerForFocus ? '把鏡頭移到 Alan 所在位置' : 'Alan 離校時先接回校園'}
          >
            找到 Alan
          </button>
          <div className="giis-topbar-meta">
            <span title={timeHoverLabel}>
              {periodLabel === '深夜'
                ? '大多數人已經休息。'
                : topbarLifeStatus(currentScene, clockState?.schedule)}
            </span>
          </div>
        </div>

        <div className="giis-left-column">
          {/* Pill row: 海 / 今日 / 日程 sit side-by-side when collapsed.
              When any panel is expanded, that panel renders below; the
              other two pills stay visible in this row. */}
          <div className="giis-left-pill-row">
            {umiPanelCollapsed ? (
              <button
                className="giis-left-pill giis-left-pill-umi"
                onClick={() => {
                  setUmiPanelCollapsed(false);
                  setCampusFeedCollapsed(true);
                  setSchedulePanelCollapsed(true);
                }}
              >
                海
              </button>
            ) : null}
            {campusFeedCollapsed ? (
              <button
                className="giis-left-pill giis-left-pill-feed"
                onClick={() => {
                  setUmiPanelCollapsed(true);
                  setSchedulePanelCollapsed(true);
                  setCampusFeedCollapsed(false);
                  setCampusFeedFullView(false);
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  setUmiPanelCollapsed(true);
                  setSchedulePanelCollapsed(true);
                  setCampusFeedCollapsed(false);
                  setCampusFeedFullView(true);
                }}
                title="雙擊展開全部校園動態"
              >
                今日
                {unreadCampusFeedCount ? (
                  <span className="giis-unread-badge">{unreadCampusFeedCount}</span>
                ) : null}
              </button>
            ) : null}
            {schedulePanelCollapsed ? (
              <button
                className="giis-left-pill giis-left-pill-schedule"
                onClick={() => {
                  setSchedulePanelCollapsed(false);
                  setUmiPanelCollapsed(true);
                  setCampusFeedCollapsed(true);
                }}
              >
                日程
                {scheduleEntries.length ? (
                  <span className="giis-schedule-count">{scheduleEntries.length}</span>
                ) : null}
              </button>
            ) : null}
          </div>

          {!umiPanelCollapsed && (
            <LeftUmiPanel
              collapsed={false}
              tasks={umiSuggestions}
              dailyFocus={campusSocialState?.dailyFocus ?? []}
              today={campusSocialState?.today}
              briefing={umiBriefing?.briefing}
              umiEmotion={campusSocialState?.emotions?.find((item: any) => item.name === 'Umi')?.currentEmotion}
              onCollapse={() => setUmiPanelCollapsed(true)}
              onExpand={() => {
                setUmiPanelCollapsed(false);
                setCampusFeedCollapsed(true);
                setSchedulePanelCollapsed(true);
              }}
              onOpenDialogue={() => {
                window.dispatchEvent(new CustomEvent('giis:navigate-character', { detail: { name: 'Umi', travel: true } }));
                openPanelTab('dialogue');
              }}
            />
          )}

          {!campusFeedCollapsed && (
            <CampusNotificationPanel
              collapsed={false}
              items={campusFeedItems}
              filter={campusFeedFilter}
              fullView={campusFeedFullView}
              readIds={readCampusFeedIds}
              unreadCount={unreadCampusFeedCount}
              onToggle={() =>
                setCampusFeedCollapsed((value) => {
                  if (!value) {
                    setCampusFeedFullView(false);
                    return true;
                  }
                  setUmiPanelCollapsed(true);
                  setSchedulePanelCollapsed(true);
                  return false;
                })
              }
              onShowAll={() => {
                setUmiPanelCollapsed(true);
                setSchedulePanelCollapsed(true);
                setCampusFeedCollapsed(false);
                setCampusFeedFullView(true);
              }}
              onSummaryView={() => setCampusFeedFullView(false)}
              onFilterChange={setCampusFeedFilter}
              onMarkRead={(id) => setReadCampusFeedIds((ids) => new Set([...ids, id]))}
              onMarkAllRead={() => setReadCampusFeedIds(new Set(campusFeedItems.map((item) => item.id)))}
            />
          )}

          {!schedulePanelCollapsed && (
            <LeftSchedulePanel
              collapsed={false}
              entries={scheduleEntries}
              periodLabel={periodLabel}
              onCollapse={() => setSchedulePanelCollapsed(true)}
              onExpand={() => {
                setSchedulePanelCollapsed(false);
                setUmiPanelCollapsed(true);
                setCampusFeedCollapsed(true);
              }}
              onSelectCharacter={(name) =>
                window.dispatchEvent(
                  new CustomEvent('giis:navigate-character', { detail: { name } }),
                )
              }
            />
          )}
        </div>

        <div className="giis-world-panel" ref={gameWrapperRef} onClick={handleWorldPanelClick}>
          {width && height ? (
            <div className="giis-stage-wrapper" style={{ width: stageWidth, height: stageHeight }}>
              <Stage
                width={stageWidth}
                height={stageHeight}
                options={{ backgroundColor: sceneBackgroundColor(currentScene.id) }}
              >
                {/* Re-propagate context because contexts are not shared between renderers.
https://github.com/michalochman/react-pixi-fiber/issues/145#issuecomment-531549215 */}
                <ConvexProvider client={convex}>
                  <PixiGame
                    game={game}
                    worldId={worldId}
                    engineId={engineId}
                    width={stageWidth}
                    height={stageHeight}
                    sceneId={currentScene.id}
                    visiblePlayerIds={scenePlayers.map((player) => player.id)}
                    historicalTime={historicalTime}
                    focusRequest={focusRequest}
                    selectedPlayerId={selectedPlayer?.id}
                    setSelectedElement={setSelectedElement}
                  />
                </ConvexProvider>
              </Stage>
            </div>
          ) : null}
          <div className="giis-move-hint">
            {alanMovementHint}
          </div>
          {sceneMessage ? <div className="giis-scene-toast">{sceneMessage}</div> : null}
          {scenePlayers.length === 0 ? (
            <div className="giis-empty-room-cue" aria-live="polite">
              <b>{emptyRoomTitle}</b>
              <span>{emptyRoomDetail}</span>
            </div>
          ) : null}

          {selectedName ? (
            <div className="giis-focus-card">
              <button
                className="giis-focus-card-close"
                onClick={() => setSelectedElement(undefined)}
                aria-label="取消選擇"
                title="取消選擇"
              >
                ×
              </button>
              <div className="giis-focus-card-head">
                <div className="giis-focus-card-portrait">
                  <CharacterPortrait name={selectedName} size="lg" showName={false} />
                </div>
                <div className="giis-focus-card-meta">
                  <b>{displayAgentName(selectedName)}</b>
                  {selectedLocation?.labelZh ? (
                    <small>
                      在 {selectedLocation.labelZh}
                      {targetDistanceStatus === '附近'
                        ? '・附近'
                        : targetDistanceStatus === '不在同場景'
                          ? '・不在同場景'
                          : ''}
                    </small>
                  ) : null}
                </div>
              </div>
              <p className="giis-focus-card-status">「{selectedStatus}。」</p>
              <div className="giis-focus-card-actions">
                {targetDistanceStatus === '不在同場景' ? (
                  <button
                    className="giis-action-pill giis-action-pill-primary"
                    title={`前往 ${displayAgentName(selectedName)} 所在的場景`}
                    onClick={focusSelectedTarget}
                  >
                    前往 {displayAgentName(selectedName)}
                  </button>
                ) : (
                  <button
                    className="giis-action-pill giis-action-pill-primary"
                    title={ACTION_TOOLTIPS.chat}
                    onClick={() => runQuickAction('chat')}
                  >
                    說話
                  </button>
                )}
                <button
                  className="giis-action-pill"
                  title="打開角色資料 / 完整互動選項"
                  onClick={() => openPanelTab('characters')}
                >
                  看資料
                </button>
              </div>
            </div>
          ) : null}
          {floatingActionSummary && panelCollapsed && !isConversationMode ? (
            <FloatingActionResult
              summary={floatingActionSummary}
              onDismiss={() => setFloatingActionSummary(undefined)}
            />
          ) : null}
        </div>

        <div className="giis-bottom-bar">
          <div className="giis-play-flow" aria-label="目前互動流程">
            {playFlowSteps.map((step, index) => (
              <span key={step.label} className={`giis-play-step giis-play-step-${step.state}`}>
                <b>{index + 1}</b>
                {step.label}
              </span>
            ))}
          </div>
          <div className="giis-bottom-status">
            {/* Top bar already shows {scene}｜{period} and Alan｜{clock}.
                Bottom only surfaces Alan's place when it differs from the
                current view (so the player notices when Alan is elsewhere). */}
            {alanPlaceLabel && alanPlaceLabel !== currentScene.labelZh ? (
              <span className="giis-main-presence" title={timeHoverLabel}>
                Alan 目前在：{alanPlaceLabel}
              </span>
            ) : null}
            {selectedName ? (
              <span>
                {isConversationMode ? '對話中' : '目標'}：{displayAgentName(selectedName)}
                {selectedLocation?.labelZh ? `｜${selectedLocation.labelZh}` : ''}
                {targetDistanceStatus === '附近' ? '｜附近' : targetDistanceStatus === '不在同場景' ? '｜不在同場景' : ''}
              </span>
            ) : (
              <span className="giis-soft-prompt">選一位角色開始互動。</span>
            )}
            {visibleSceneNames.length ? (
              <span>本場景：{visibleSceneNames.join('、')}</span>
            ) : (
              <span>校園目前很平靜。</span>
            )}
          </div>
          <div className="giis-bottom-actions">
            {contextualActions.map((action) => (
              <button
                key={`scene-${action.label}`}
                className="giis-action-pill giis-action-pill-scene"
                title={ACTION_TOOLTIPS[action.actionType]}
                onClick={() => runQuickAction(action.actionType)}
              >
                {action.label}
              </button>
            ))}
            {selectedName && !isConversationMode ? (
              <>
                <span className="giis-action-divider" aria-hidden="true" />
                <button
                  className="giis-action-pill giis-action-pill-primary"
                  title={ACTION_TOOLTIPS.chat}
                  onClick={() => runQuickAction('chat')}
                  disabled={!targetDistanceStatus || targetDistanceStatus === '不在同場景'}
                >
                  聊聊 {displayAgentName(selectedName)}
                </button>
                <button
                  className="giis-action-pill"
                  title={ACTION_TOOLTIPS.checkIn}
                  onClick={() => runQuickAction('checkIn')}
                >
                  關心近況
                </button>
                <button
                  className="giis-action-pill"
                  title={ACTION_TOOLTIPS.invite}
                  onClick={() => runQuickAction('invite')}
                >
                  邀請
                </button>
                {/* 問傳聞 / 送禮 / 留訊息 live under 更多互動 to keep the
                    primary action row scannable. */}
              </>
            ) : null}
            <span className="giis-action-divider" aria-hidden="true" />
            <button
              className="giis-action-pill giis-action-pill-ghost"
              title="打開角色行動面板看完整選項與留言"
              onClick={() => openPanelTab('characters')}
            >
              更多互動
            </button>
          </div>
          {quickTextAction ? (
            <form className="giis-bottom-text-action" onSubmit={submitQuickTextAction}>
              <label htmlFor="giis-quick-text-input">
                {QUICK_ACTION_LABELS[quickTextAction]}
                {QUICK_TARGET_TEXT_ACTIONS.has(quickTextAction) && selectedName
                  ? `｜${displayAgentName(selectedName)}`
                  : ''}
              </label>
              <input
                id="giis-quick-text-input"
                className="giis-bottom-text-input"
                value={quickText}
                autoFocus
                maxLength={120}
                placeholder={QUICK_ACTION_PLACEHOLDERS[quickTextAction]}
                onChange={(event) => setQuickText(event.target.value)}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === 'Escape') {
                    setQuickTextAction(undefined);
                    setQuickText('');
                  }
                }}
              />
              <button className="giis-bottom-text-submit" type="submit">
                送出
              </button>
              <button
                className="giis-bottom-text-cancel"
                type="button"
                onClick={() => {
                  setQuickTextAction(undefined);
                  setQuickText('');
                }}
              >
                取消
              </button>
            </form>
          ) : null}
        </div>

        <div
          className={`giis-utility-panel ${
            panelCollapsed && !isConversationMode ? 'giis-utility-panel-collapsed' : ''
          }`}
          ref={scrollViewRef}
        >
          <button
            className="giis-panel-toggle"
            onClick={() => setPanelCollapsed((value) => !value)}
          >
            {panelCollapsed ? '展開控制面板' : '收合控制面板'}
          </button>
          <PlayerDetails
            worldId={worldId}
            engineId={engineId}
            game={game}
            playerId={selectedPlayer?.id}
            setSelectedElement={setSelectedElement}
            scrollViewRef={scrollViewRef}
            currentScene={currentScene}
            scenePlayers={scenePlayers.map((player) => ({
              id: player.id,
              name: game.playerDescriptions.get(player.id)?.name ?? player.id,
            }))}
            clockState={clockState}
          />
        </div>
      </div>
    </>
  );
}

type QuickActionType =
  | 'observe'
  | 'chat'
  | 'gift'
  | 'announce'
  | 'createClub'
  | 'advanceWorldTime'
  | 'checkIn'
  | 'leaveMessage'
  | 'askRumor'
  | 'invite'
  | 'kick'
  | 'assignRole';

function FloatingActionResult({
  summary,
  onDismiss,
}: {
  summary: FloatingActionSummary;
  onDismiss: () => void;
}) {
  const sourceLabel =
    summary.sourceLabel ??
    (summary.storyDigest?.length
      ? '來源：世界自然發展'
      : summary.yourAction.includes('海準備')
        ? '來源：海的建議草稿'
        : '來源：Alan 手動行動');
  return (
    <aside className="giis-floating-action-result" aria-live="polite">
      <button
        className="giis-floating-action-dismiss"
        type="button"
        aria-label="關閉行動結果"
        onClick={onDismiss}
      >
        ×
      </button>
      {summary.storyDigest?.length ? (
        <div className="giis-floating-story-digest">
          <b>校園剛剛發生了 {summary.storyDigest.length} 件事</b>
          <span>{displayTextWithNames(summary.storyDigest[0]?.happenedZh ?? '')}</span>
        </div>
      ) : null}
      <span className="giis-floating-action-source">{sourceLabel}</span>
      <p>
        <b>你的行動：</b>
        {displayTextWithNames(summary.yourAction)}
      </p>
      <p>
        <b>角色反應：</b>
        {displayTextWithNames(summary.characterReactions)}
      </p>
      <p>
        <b>後續：</b>
        {displayTextWithNames(summary.futureImplications)}
      </p>
    </aside>
  );
}

function quickActionsForScene(sceneId: SchoolLocationId): Array<{ label: string; actionType: QuickActionType }> {
  if (sceneId === 'dormitory') {
    return [
      { label: '聊天', actionType: 'chat' },
      { label: '陪伴', actionType: 'gift' },
      { label: '觀察', actionType: 'observe' },
    ];
  }
  if (sceneId === 'studentCouncilRoom') {
    return [
      { label: '談話', actionType: 'chat' },
      { label: '道歉', actionType: 'leaveMessage' },
      { label: '觀察', actionType: 'observe' },
      { label: '提醒', actionType: 'announce' },
    ];
  }
  if (sceneId === 'aiClubRoom') {
    return [
      { label: '吃飯', actionType: 'gift' },
      { label: '聊天', actionType: 'chat' },
      { label: '觀察', actionType: 'observe' },
    ];
  }
  if (sceneId === 'courtyard') {
    return [
      { label: '聊天', actionType: 'chat' },
      { label: '旁聽', actionType: 'observe' },
      { label: '公告', actionType: 'announce' },
    ];
  }
  return [
    { label: '觀察', actionType: 'observe' },
    { label: '聊天', actionType: 'chat' },
    { label: '公告', actionType: 'announce' },
  ];
}

const QUICK_TEXT_ACTIONS: ReadonlySet<QuickActionType> = new Set([
  'gift',
  'leaveMessage',
  'announce',
  'createClub',
]);

const QUICK_TARGET_TEXT_ACTIONS: ReadonlySet<QuickActionType> = new Set(['gift', 'leaveMessage']);

const QUICK_ACTION_LABELS: Record<QuickActionType, string> = {
  observe: '觀察',
  chat: '聊天',
  gift: '送禮',
  announce: '公告',
  createClub: '建立社團',
  advanceWorldTime: '自然發展',
  checkIn: '關心近況',
  leaveMessage: '留訊息',
  askRumor: '問傳聞',
  invite: '邀請',
  kick: '挑釁',
  assignRole: '任命',
};

const QUICK_ACTION_PLACEHOLDERS: Record<QuickActionType, string> = {
  observe: '',
  chat: '',
  gift: '一句心意或小禮物，例如：熱茶，先休息一下。',
  announce: '一句校園公告，例如：今天先看人，不先加功能。',
  createClub: '社團名稱或主題，例如：午餐讀書會。',
  advanceWorldTime: '',
  checkIn: '',
  leaveMessage: '留下一句短訊息，之後可能成為小記憶。',
  askRumor: '',
  invite: '',
  kick: '',
  assignRole: '',
};

const ACTION_TOOLTIPS: Record<QuickActionType, string> = {
  observe: '讀取 Alan 周圍場景、附近角色與近期事件。',
  chat: 'Alan 主動找選定角色開始一段對話。',
  gift: '送出物品或心意，讓對方留下較柔軟的記憶。',
  announce: '以 Alan 的身分發布校園公告，大家之後可引用。',
  createClub: '建立新社團，校園出現新的討論焦點。',
  advanceWorldTime: '不跳轉可見時鐘，只看校園接下來自然出現的新變化。',
  checkIn: '不開大議題，只確認對方今天狀態；適合累或安靜的角色。',
  askRumor: '詢問對方最近聽到或在意的校園傳聞。',
  invite: '邀請對方參與 Alan 的計畫或社團。',
  leaveMessage: 'Alan 留下一句短訊息，對方之後會把它當成一段小記憶。',
  kick: '讓 Alan 對目標做出公開挑釁，角色會依個性解讀。',
  assignRole: '任命目標為助理校長，寫入記憶與世界事件。',
};

function sceneBackgroundColor(sceneId: SchoolLocationId) {
  switch (sceneId) {
    case 'courtyard':
      return 0x10251f;
    case 'aiClubRoom':
      return 0x071923;
    case 'studentCouncilRoom':
      return 0x160d16;
    case 'dormitory':
      return 0x171326;
    case 'classroom':
    default:
      return 0x111827;
  }
}

function topbarLifeStatus(scene: SchoolLocation, schedule?: string) {
  if (schedule && !schedule.includes('/')) return schedule;
  if (scene.id === 'aiClubRoom') return '餐廳：適合午餐、閒聊、尷尬沉默與小衝突。';
  if (scene.id === 'studentCouncilRoom') return '校長室：海的簡報與邀請談話空間，其他角色不會單獨進來。';
  if (scene.id === 'dormitory') return '宿舍：適合安靜休息、私人對話與情緒整理。';
  if (scene.id === 'courtyard') return '中央庭院：適合閒聊、告白、秘密與公開觀察。';
  return '教室：適合課堂、小考、作業與正式討論。';
}

function LeftSchedulePanel({
  collapsed,
  entries,
  periodLabel,
  onCollapse,
  onExpand,
  onSelectCharacter,
}: {
  collapsed: boolean;
  entries: Array<{
    id: string;
    name: string;
    displayName: string;
    locationZh: string;
    statusZh: string;
    quietLineZh?: string;
  }>;
  periodLabel: string;
  onCollapse: () => void;
  onExpand: () => void;
  onSelectCharacter: (name: string) => void;
}) {
  if (collapsed) return null;
  return (
    <aside className="giis-left-schedule-panel">
      <div className="giis-left-panel-header">
        <div>
          <span className="giis-kicker">校園日程</span>
          <h3>{periodLabel}｜大家在哪</h3>
        </div>
        <button className="giis-icon-button" onClick={onCollapse} aria-label="收合日程">
          ×
        </button>
      </div>
      <div className="giis-schedule-list">
        {entries.length ? (
          entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="giis-schedule-row"
              onClick={() => onSelectCharacter(entry.name)}
            >
              <div className="giis-schedule-row-head">
                <b>{entry.displayName}</b>
                <span>{entry.locationZh}</span>
              </div>
              <small>{entry.statusZh}</small>
              {entry.quietLineZh ? (
                <small className="giis-schedule-behavior-line">
                  {displayTextPreview(entry.quietLineZh, 48)}
                </small>
              ) : null}
            </button>
          ))
        ) : (
          <p>校園日程整理中。</p>
        )}
      </div>
    </aside>
  );
}

function LeftUmiPanel({
  collapsed,
  tasks,
  dailyFocus,
  today,
  briefing,
  umiEmotion,
  onCollapse,
  onExpand,
  onOpenDialogue,
}: {
  collapsed: boolean;
  tasks: Array<{ title?: string; reason?: string; titleZh?: string }>;
  dailyFocus: any[];
  today?: { focus?: string; moodZh?: string; rumorZh?: string; needsAlanActionZh?: string };
  briefing?: any;
  umiEmotion?: any;
  onCollapse: () => void;
  onExpand: () => void;
  onOpenDialogue: () => void;
}) {
  const visibleTasks = tasks.slice(0, 3);
  const visibleFocus = dailyFocus.slice(0, 3);
  const greeting = cleanUmiBriefingLine(
    briefing?.greetingZh ?? '歡迎回來，Alan。先看今天校園的氣氛，再決定要找誰聊。',
  );
  if (collapsed) return null;
  return (
    <aside className="giis-left-umi-panel">
      <div className="giis-left-panel-header">
        <CharacterPortrait name="Umi" size="md" emotion={umiEmotion} showName={false} />
        <div>
          <span className="giis-kicker">海的判讀</span>
          <h3>誰變了，為什麼</h3>
        </div>
        <button className="giis-icon-button" onClick={onCollapse} aria-label="收合海的簡報">
          ×
        </button>
      </div>
      <p className="giis-umi-brief-line">{displayTextWithNames(greeting)}</p>
      <section>
        <b>今日焦點</b>
        {visibleFocus.length ? (
          visibleFocus.map((item, index) => (
            <p key={`focus-${index}`}>{displayTextPreview(focusText(item))}</p>
          ))
        ) : (
          <p>校園目前很平靜。</p>
        )}
      </section>
      {today ? (
        <section className="giis-today-brief">
          <b>今天的空氣</b>
          <p>變化：{displayTextPreview(today.focus ?? '目前沒有明顯變化。')}</p>
          <p>流動的話：{displayTextPreview(today.rumorZh ?? '目前沒有新的明確傳聞。')}</p>
          <p>Alan 下一步：{displayTextPreview(today.needsAlanActionZh ?? '先選一位角色好好聊。')}</p>
        </section>
      ) : null}
      <section>
        <b>海的建議</b>
        {visibleTasks.length ? (
          visibleTasks.map((task, index) => (
            <p key={`${task.title ?? task.titleZh ?? task.reason}-${index}`}>
              {displayTextPreview(task.title ?? task.titleZh ?? task.reason ?? '')}
            </p>
          ))
        ) : (
          <p>先選一位角色，看看今天誰最需要你。</p>
        )}
      </section>
      <div className="giis-left-panel-actions">
        <button onClick={onOpenDialogue}>找海聊聊</button>
        <button onClick={onCollapse}>知道了</button>
      </div>
    </aside>
  );
}

function cleanUmiBriefingLine(text: string) {
  let cleaned = displayTextWithNames(text).trim();
  for (let i = 0; i < 3; i += 1) {
    cleaned = cleaned
      .replace(/^\s*[「"“”]+/u, '')
      .replace(/[」"“”]+\s*$/u, '')
      .replace(/^\s*海\s*[:：]\s*/u, '')
      .trim();
  }
  return cleaned ? `「${cleaned}」` : '「歡迎回來，Alan。先看今天校園的氣氛，再決定要找誰聊。」';
}

function CampusNotificationPanel({
  collapsed,
  items,
  filter,
  fullView,
  readIds,
  unreadCount,
  onToggle,
  onShowAll,
  onSummaryView,
  onFilterChange,
  onMarkRead,
  onMarkAllRead,
}: {
  collapsed: boolean;
  items: CampusNotificationItem[];
  filter: CampusFeedFilter;
  fullView: boolean;
  readIds: Set<string>;
  unreadCount: number;
  onToggle: () => void;
  onShowAll: () => void;
  onSummaryView: () => void;
  onFilterChange: (filter: CampusFeedFilter) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const filters: CampusFeedFilter[] = ['全部', '未讀', '今日焦點', '傳聞', '關係事件', '對話', '場景事件'];
  const filteredItems = items
    .filter((item) => {
      if (filter === '全部') return true;
      if (filter === '未讀') return !readIds.has(item.id);
      return item.category === filter;
    })
    .slice(0, fullView ? 80 : 8);
  if (collapsed) return null;
  return (
    <aside
      className={`giis-campus-notifications ${fullView ? 'giis-campus-notifications-full' : ''}`}
      onDoubleClick={onShowAll}
      title={fullView ? '完整校園動態' : '雙擊展開全部校園動態'}
    >
      <div className="giis-left-panel-header">
        <div>
          <span className="giis-kicker">今日校園動態</span>
          <h3>{fullView ? '今天全部紀錄' : '今天紀錄'}</h3>
        </div>
        {unreadCount ? <span className="giis-unread-badge">{unreadCount}</span> : null}
        <button
          className="giis-icon-button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          aria-label="收合校園動態"
          title="關閉校園動態"
        >
          ×
        </button>
      </div>
      <div className="giis-feed-mode-row">
        <span>
          {fullView
            ? `顯示 ${filteredItems.length} 則訊息｜最新在上`
            : '摘要模式：雙擊展開全部訊息'}
        </span>
        {fullView ? (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onSummaryView();
            }}
          >
            回到摘要
          </button>
        ) : (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onShowAll();
            }}
          >
            看全部
          </button>
        )}
      </div>
      <div className="giis-feed-filters">
        {filters.map((item) => (
          <button
            key={item}
            className={filter === item ? 'active' : ''}
            onClick={(event) => {
              event.stopPropagation();
              onFilterChange(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <button
        className="giis-feed-mark-read"
        onClick={(event) => {
          event.stopPropagation();
          onMarkAllRead();
        }}
        disabled={!unreadCount}
      >
        全部標為已讀
      </button>
      <div className="giis-feed-list">
        {filteredItems.length ? (
          filteredItems.map((item) => (
            <button
              key={item.id}
              className={`giis-feed-row ${readIds.has(item.id) ? 'read' : 'unread'}`}
              onClick={(event) => {
                event.stopPropagation();
                onMarkRead(item.id);
              }}
            >
              <span>{item.timestamp ?? '剛剛'}｜{displayTextPreview(item.text, fullView ? 72 : 40)}</span>
              {item.detail ? (
                <p className="giis-feed-detail">
                  {displayTextPreview(item.detail, fullView ? 96 : 54)}
                </p>
              ) : null}
              <small>{item.category}</small>
            </button>
          ))
        ) : (
          <p className="giis-empty-feed">目前沒有符合條件的校園動態。</p>
        )}
      </div>
    </aside>
  );
}

function focusText(item: any) {
  if (typeof item === 'string') return item;
  return item?.summaryZh ?? item?.descriptionZh ?? item?.titleZh ?? item?.contentZh ?? '';
}

function notificationCategory(item: any): CampusNotificationItem['category'] {
  if (item?.type === 'rumor_created') return '傳聞';
  if (item?.type === 'relationship_change') return '關係事件';
  if (item?.type === 'major_event' || item?.importance >= 8) return '今日焦點';
  if (item?.type === 'conversation' || item?.type === 'conversation_created') return '對話';
  return '場景事件';
}

function eventCategory(event: any): CampusNotificationItem['category'] {
  if (event?.type === 'rumor_created' || event?.rumorId) return '傳聞';
  if (event?.type === 'relationship_change') return '關係事件';
  if (event?.type === 'conversationOutcome' || event?.type === 'chatMessage') return '對話';
  if (event?.importance >= 8 || event?.type === 'dailyOpeningFocus') return '今日焦點';
  return '場景事件';
}

function feedItemId(prefix: string, item: any, scope: string | number, index = 0) {
  const text = focusText(item) || item?.contentZh || item?.descriptionZh || item?.titleZh || prefix;
  return `${prefix}-${scope}-${index}-${stableTextHash(displayTextWithNames(String(text)))}`;
}

function stableTextHash(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function feedCreatedAt(item: any, fallback = Date.now()) {
  const raw =
    item?.createdAt ??
    item?.createdAtUnix ??
    item?._creationTime ??
    item?.updatedAt ??
    item?.timestamp ??
    item?.time;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw < 10_000_000_000 ? raw * 1000 : raw;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function matchesCharacterName(candidate?: string, target?: string) {
  if (!candidate || !target) return false;
  return candidate === target || displayAgentName(candidate) === displayAgentName(target);
}

function displayTextPreview(text: string, maxLength = 38) {
  const cleaned = naturalizeSchoolFeedText(displayTextWithNames(text)).replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned;
}

function naturalizeSchoolFeedText(text: string) {
  return text
    .replaceAll('conversationOutcome', '對話後的變化')
    .replaceAll('執行意圖', '開始行動')
    .replaceAll('形成意圖', '決定')
    .replaceAll('重大校園事件', '校園焦點')
    .replaceAll('如果最近的事件自然相關，可以輕輕帶過；不要把它當成唯一話題。', '')
    .replaceAll('我們不只要記住，還要判斷力量會流向哪裡。', '我在想，大家真正害怕的不是規則本身。')
    .replaceAll('真正危險的不是 AI 社，而是沒有人知道它最後會變成什麼。', '真正讓人不安的，是大家不知道自己會被帶到哪裡。')
    .replaceAll('真正危險的不是 AI 社，而是沒有人知道 AI 社最後會變成什麼。', '真正讓人不安的，是大家不知道自己會被帶到哪裡。')
    .replace(/我先去處理校務，(.+?)，晚點再聊。/g, '我先去整理一下，$1，晚點再聊。')
    .replaceAll('world_simulation_event', '校園自然發展')
    .replaceAll('autonomous_agent_action', '角色行動')
    .replaceAll('player_action', 'Alan 的行動')
    .replaceAll('system_event', '校園狀態')
    .replaceAll('relationship_change', '關係變化')
    .replaceAll('rumor_created', '今日傳聞')
    .replaceAll('intention_created', '新的打算')
    .replaceAll('major_event', '校園焦點');
}

import clsx from 'clsx';
import { Doc, Id } from '../../convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MessageInput } from './MessageInput';
import { Player } from '../../convex/aiTown/player';
import { Conversation } from '../../convex/aiTown/conversation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CharacterPortrait } from './CharacterPortrait';
import { displayAgentName, displayTextWithNames } from '../../data/displayNames';

type PendingChatMessage = {
  conversationId: string;
  messageUuid: string;
  author: string;
  authorName?: string;
  text: string;
  createdAt: number;
};

const HUMAN_REPLY_WAIT_TIMEOUT_MS = 45_000;

export function Messages({
  worldId,
  engineId,
  conversation,
  inConversationWithMe,
  humanPlayer,
  scrollViewRef,
  placeholderTargetName,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  conversation:
    | { kind: 'active'; doc: Conversation }
    | { kind: 'archived'; doc: Doc<'archivedConversations'> };
  inConversationWithMe: boolean;
  humanPlayer?: Player;
  scrollViewRef: React.RefObject<HTMLDivElement>;
  placeholderTargetName?: string;
}) {
  const humanPlayerId = humanPlayer?.id;
  const descriptions = useQuery(api.world.gameDescriptions, { worldId });
  const messages = useQuery(api.messages.listMessages, {
    worldId,
    conversationId: conversation.doc.id,
  });
  const [pendingMessages, setPendingMessages] = useState<PendingChatMessage[]>([]);
  const [awaitingReply, setAwaitingReply] = useState<{
    since: number;
    targetName?: string;
    afterMessageUuid: string;
  } | null>(null);
  const [replyWaitExpired, setReplyWaitExpired] = useState(false);
  const [typingWaitExpired, setTypingWaitExpired] = useState(false);
  const confirmedMessageUuids = useMemo(
    () => new Set((messages ?? []).map((message: { messageUuid: string }) => message.messageUuid)),
    [messages],
  );
  useEffect(() => {
    if (messages === undefined) return;
    setPendingMessages((items) =>
      items.filter(
        (item) =>
          item.conversationId === conversation.doc.id &&
          !confirmedMessageUuids.has(item.messageUuid) &&
          Date.now() - item.createdAt < 30_000,
      ),
    );
  }, [messages, confirmedMessageUuids, conversation.doc.id]);
  useEffect(() => {
    if (!awaitingReply || messages === undefined || !humanPlayerId) return;
    const reply = messages.find(
      (message: any) =>
        message.author !== humanPlayerId &&
        message._creationTime >= awaitingReply.since - 250,
    );
    if (!reply) return;
    if (import.meta.env.DEV) {
      console.debug('[GIIS timing]', {
        action: 'sendMessage',
        phase: 'totalResponseTime',
        ms: Date.now() - awaitingReply.since,
        replyAuthor: reply.authorName,
      });
      window.setTimeout(() => {
        console.debug('[GIIS timing]', {
          action: 'sendMessage',
          phase: 'replyRenderUpdateTime',
          ms: Date.now() - awaitingReply.since,
        });
      }, 0);
    }
    setAwaitingReply(null);
    setReplyWaitExpired(false);
  }, [messages, awaitingReply, humanPlayerId]);
  useEffect(() => {
    setReplyWaitExpired(false);
    if (!awaitingReply) return undefined;
    const remaining = Math.max(0, HUMAN_REPLY_WAIT_TIMEOUT_MS - (Date.now() - awaitingReply.since));
    const timeout = window.setTimeout(() => setReplyWaitExpired(true), remaining);
    return () => window.clearTimeout(timeout);
  }, [awaitingReply?.since, awaitingReply?.afterMessageUuid]);
  let currentlyTyping = conversation.kind === 'active' ? conversation.doc.isTyping : undefined;
  if (messages !== undefined && currentlyTyping) {
    if (
      messages.find((m: { messageUuid: string }) => m.messageUuid === currentlyTyping!.messageUuid)
    ) {
      currentlyTyping = undefined;
    }
  }
  const currentlyTypingName =
    currentlyTyping &&
    descriptions?.playerDescriptions.find(
      (p: { playerId: string }) => p.playerId === currentlyTyping?.playerId,
    )?.name;
  useEffect(() => {
    setTypingWaitExpired(false);
    if (!currentlyTyping || currentlyTyping.playerId === humanPlayerId) return undefined;
    const remaining = Math.max(0, HUMAN_REPLY_WAIT_TIMEOUT_MS - (Date.now() - currentlyTyping.since));
    const timeout = window.setTimeout(() => setTypingWaitExpired(true), remaining);
    return () => window.clearTimeout(timeout);
  }, [currentlyTyping?.since, currentlyTyping?.messageUuid, currentlyTyping?.playerId, humanPlayerId]);

  const conversationLogRef = useRef<HTMLDivElement>(null);
  const getScrollView = () => conversationLogRef.current ?? scrollViewRef.current;
  const isScrolledToBottom = useRef(false);
  const initializedScroll = useRef(false);
  const messageScrollKey = useMemo(
    () =>
      (messages ?? [])
        .map((message: any) => `${message.messageUuid ?? message._id}:${message._creationTime}`)
        .join('|'),
    [messages],
  );
  const pendingScrollKey = useMemo(
    () => pendingMessages.map((message) => message.messageUuid).join('|'),
    [pendingMessages],
  );
  useEffect(() => {
    initializedScroll.current = false;
    isScrolledToBottom.current = true;
  }, [conversation.doc.id]);
  useEffect(() => {
    const scrollView = getScrollView();
    if (!scrollView) return undefined;

    const onScroll = () => {
      isScrolledToBottom.current = !!(
        scrollView && scrollView.scrollHeight - scrollView.scrollTop - 50 <= scrollView.clientHeight
      );
    };
    scrollView.addEventListener('scroll', onScroll);
    return () => scrollView.removeEventListener('scroll', onScroll);
  }, [scrollViewRef]);
  useEffect(() => {
    const scrollView = getScrollView();
    if (!scrollView) return;
    const scrollToBottom = (behavior: ScrollBehavior) =>
      scrollView.scrollTo({
        top: scrollView.scrollHeight,
        behavior,
      });
    if (!initializedScroll.current && messages !== undefined) {
      initializedScroll.current = true;
      scrollToBottom('auto');
      const frame = window.requestAnimationFrame(() => scrollToBottom('auto'));
      const timeout = window.setTimeout(() => scrollToBottom('auto'), 120);
      isScrolledToBottom.current = true;
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
      };
    }
    if (isScrolledToBottom.current || awaitingReply) {
      scrollToBottom('smooth');
      const frame = window.requestAnimationFrame(() => scrollToBottom('auto'));
      const timeout = window.setTimeout(() => scrollToBottom('auto'), 120);
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
      };
    }
  }, [messageScrollKey, pendingScrollKey, awaitingReply?.since, conversation.doc.id]);

  if (messages === undefined) {
    return null;
  }
  if (messages.length === 0 && !inConversationWithMe) {
    return null;
  }
  const serverMessageItems = messages.map((message: any) => ({
    ...message,
    createdAt: message._creationTime,
    pending: false,
  }));
  const pendingMessageItems = pendingMessages
    .filter((message) => message.conversationId === conversation.doc.id)
    .filter((message) => !confirmedMessageUuids.has(message.messageUuid))
    .map((message) => ({
      _id: `pending-${message.messageUuid}`,
      _creationTime: message.createdAt,
      createdAt: message.createdAt,
      author: message.author,
      authorName: message.authorName,
      messageUuid: message.messageUuid,
      text: message.text,
      pending: true,
    }));
  const displayMessages = [...serverMessageItems, ...pendingMessageItems].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const formatConversationTime = (timestamp: number) =>
    new Date(timestamp).toLocaleString('zh-TW', {
      timeZone: 'America/Chicago',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  const messageNodes: { time: number; node: React.ReactNode }[] = displayMessages.map((m: any, index: number) => {
    const previous = displayMessages[index - 1];
    const groupedWithPrevious =
      previous &&
      previous.author === m.author &&
      m.createdAt - previous.createdAt < 4 * 60 * 1000;
    const node = (
      <div
        key={`text-${m._id}`}
        className={clsx(
          'giis-message-row leading-tight',
          groupedWithPrevious ? 'giis-message-row-grouped' : 'mb-5',
          m.pending && 'opacity-70',
        )}
      >
        {!groupedWithPrevious ? (
          <div className="giis-message-speaker">
            <CharacterPortrait name={m.authorName} size="sm" showName={false} />
            <span className="flex-grow font-bold">{displayAgentName(m.authorName)}</span>
            <time className="text-xs opacity-70" dateTime={m.createdAt.toString()}>
              {formatConversationTime(m.createdAt)}
            </time>
          </div>
        ) : null}
        <div className={clsx('bubble', m.author === humanPlayerId && 'bubble-mine')}>
          <p className="-mx-3 -my-1">{displayTextWithNames(m.text)}</p>
          {m.pending ? <span className="mt-1 block text-[10px] opacity-60">送出中...</span> : null}
        </div>
      </div>
    );
    return { node, time: m.createdAt };
  });
  const lastMessageTs = messages
    .map((m: { _creationTime: number }) => m._creationTime)
    .reduce((a: number, b: number) => Math.max(a, b), 0);

  const membershipNodes: typeof messageNodes = [];
  if (conversation.kind === 'active') {
    for (const [playerId, m] of conversation.doc.participants) {
      const playerName = descriptions?.playerDescriptions.find(
        (p: { playerId: string }) => p.playerId === playerId,
      )?.name;
      let started;
      if (m.status.kind === 'participating') {
        started = m.status.started;
      }
      if (started) {
        membershipNodes.push({
          node: (
            <div key={`joined-${playerId}`} className="leading-tight mb-6">
              <p className="text-center text-xs text-slate-300/80">{displayAgentName(playerName)} 加入了對話。</p>
            </div>
          ),
          time: started,
        });
      }
    }
  } else {
    for (const playerId of conversation.doc.participants) {
      const playerName = descriptions?.playerDescriptions.find(
        (p: { playerId: string }) => p.playerId === playerId,
      )?.name;
      const started = conversation.doc.created;
      membershipNodes.push({
        node: (
          <div key={`joined-${playerId}`} className="leading-tight mb-6">
            <p className="text-center text-xs text-slate-300/80">{displayAgentName(playerName)} 加入了對話。</p>
          </div>
        ),
        time: started,
      });
      const ended = conversation.doc.ended;
      membershipNodes.push({
        node: (
          <div key={`left-${playerId}`} className="leading-tight mb-6">
            <p className="text-center text-xs text-slate-300/80">{displayAgentName(playerName)} 離開了對話。</p>
          </div>
        ),
        // Always sort all "left" messages after the last message.
        // TODO: We can remove this once we want to support more than two participants per conversation.
        time: Math.max(lastMessageTs + 1, ended),
      });
    }
  }
  const nodes = [...messageNodes, ...membershipNodes];
  nodes.sort((a, b) => a.time - b.time);
  return (
    <div className="chats text-base sm:text-sm">
      <div ref={conversationLogRef} className="giis-conversation-log p-2">
        {nodes.length > 0 && nodes.map((n) => n.node)}
        {currentlyTyping && currentlyTyping.playerId !== humanPlayerId && (
          <div key="typing" className="leading-tight mb-6">
            <div className="giis-message-speaker">
              <CharacterPortrait name={currentlyTypingName} size="sm" showName={false} />
              <span className="flex-grow">{displayAgentName(currentlyTypingName)}</span>
              <time className="text-xs opacity-70" dateTime={currentlyTyping.since.toString()}>
                {formatConversationTime(currentlyTyping.since)}
              </time>
            </div>
            <div className={clsx('bubble')}>
              {typingWaitExpired ? (
                <div className="-mx-3 -my-1 space-y-1">
                  <p>連線暫時不穩，這段還沒有收到角色回覆。</p>
                  <p className="text-xs opacity-70">為了不污染記憶，系統不會補一段弱 fallback 當成真話。</p>
                </div>
              ) : (
                <p className="-mx-3 -my-1">
                  <i>{displayAgentName(currentlyTypingName) === '海' ? '海正在思考...' : '正在思考...'}</i>
                </p>
              )}
            </div>
          </div>
        )}
        {awaitingReply && !currentlyTyping && (
          <div key="local-thinking" className="leading-tight mb-6 opacity-80">
            <div className="giis-message-speaker">
              <CharacterPortrait name={awaitingReply.targetName ?? placeholderTargetName} size="sm" showName={false} />
              <span className="flex-grow">
                {displayAgentName(awaitingReply.targetName ?? placeholderTargetName)}
              </span>
              <time className="text-xs opacity-70" dateTime={awaitingReply.since.toString()}>
                {formatConversationTime(awaitingReply.since)}
              </time>
            </div>
            <div className={clsx('bubble')}>
              {replyWaitExpired ? (
                <div className="-mx-3 -my-1 space-y-1">
                  <p>連線暫時不穩，這段沒有寫入角色記憶。</p>
                  <p className="text-xs opacity-70">你可以稍後再送一次；我不會用弱 fallback 假裝角色回覆。</p>
                </div>
              ) : (
                <p className="-mx-3 -my-1">
                  <i>
                    {displayAgentName(awaitingReply.targetName ?? placeholderTargetName) === '海'
                      ? '海正在思考...'
                      : '正在思考...'}
                  </i>
                </p>
              )}
            </div>
          </div>
        )}
        {humanPlayer && inConversationWithMe && conversation.kind === 'active' && (
          <MessageInput
            worldId={worldId}
            engineId={engineId}
            conversation={conversation.doc}
            humanPlayer={humanPlayer}
            placeholderTargetName={placeholderTargetName}
            onOptimisticMessage={(message) =>
              {
                isScrolledToBottom.current = true;
                setPendingMessages((items) => [
                  ...items.filter((item) => item.messageUuid !== message.messageUuid),
                  message,
                ]);
                setAwaitingReply({
                  since: message.createdAt,
                  targetName: placeholderTargetName,
                  afterMessageUuid: message.messageUuid,
                });
                setReplyWaitExpired(false);
              }
            }
          />
        )}
      </div>
    </div>
  );
}

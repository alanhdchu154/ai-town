import { useMutation, useQuery } from 'convex/react';
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useSendInputQueued } from '../hooks/sendInput';
import { Player } from '../../convex/aiTown/player';
import { Conversation } from '../../convex/aiTown/conversation';
import { displayAgentName } from '../../data/displayNames';
import { toast } from 'react-toastify';

const WRITE_RETRY_DELAYS_MS = [180, 420, 900];

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function isTransientConvexWriteConflict(error: unknown) {
  const message = errorMessage(error);
  return (
    message.includes('Documents read from or written to') ||
    message.includes('changed while this mutation was being run') ||
    message.includes('Write conflict')
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function MessageInput({
  worldId,
  engineId,
  humanPlayer,
  conversation,
  placeholderTargetName,
  onOptimisticMessage,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  humanPlayer: Player;
  conversation: Conversation;
  placeholderTargetName?: string;
  onOptimisticMessage?: (message: {
    conversationId: string;
    messageUuid: string;
    author: string;
    authorName?: string;
    text: string;
    createdAt: number;
  }) => void;
}) {
  const descriptions = useQuery(api.world.gameDescriptions, { worldId });
  const humanName = descriptions?.playerDescriptions.find(
    (p: { playerId: string }) => p.playerId === humanPlayer.id,
  )?.name;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inflightUuid = useRef<string | undefined>();
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const writeMessage = useMutation(api.messages.writeMessage);
  const startTyping = useSendInputQueued(engineId, 'startTyping');
  const currentlyTyping = conversation.isTyping;
  const otherPlayerTyping = Boolean(currentlyTyping && currentlyTyping.playerId !== humanPlayer.id);
  const otherTypingName = currentlyTyping
    ? descriptions?.playerDescriptions.find(
        (p: { playerId: string }) => p.playerId === currentlyTyping.playerId,
      )?.name
    : undefined;
  const focusInput = () => inputRef.current?.focus({ preventScroll: true });

  useEffect(() => {
    const handle = window.setTimeout(() => focusInput(), 80);
    return () => window.clearTimeout(handle);
  }, [conversation.id]);

  useEffect(() => {
    window.addEventListener('giis:focus-chat-input', focusInput);
    return () => window.removeEventListener('giis:focus-chat-input', focusInput);
  }, []);

  const sendMessage = async () => {
    if (sendingRef.current) {
      return;
    }
    const messageText = text.trim();
    if (!messageText) {
      return;
    }
    if (otherPlayerTyping) {
      toast.info(`${displayAgentName(otherTypingName ?? placeholderTargetName ?? '角色')} 還在回覆，等一下再送。`);
      return;
    }
    const messageUuid = crypto.randomUUID();
    sendingRef.current = true;
    setSending(true);
    const clickStart = performance.now();
    if (import.meta.env.DEV) {
      console.debug('[GIIS timing]', { action: 'sendMessage', phase: 'uiClickLatency', ms: 0 });
    }
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (import.meta.env.DEV) {
        console.debug('[GIIS timing]', {
          action: 'sendMessage',
          phase: 'renderUpdateQueued',
          ms: Math.round(performance.now() - clickStart),
        });
      }
      const createdAt = Date.now();
      onOptimisticMessage?.({
        conversationId: conversation.id,
        messageUuid,
        author: humanPlayer.id,
        authorName: humanName,
        text: messageText,
        createdAt,
      });
      setText('');
      window.setTimeout(() => focusInput(), 0);
      const mutationStart = performance.now();
      const writeMessageArgs = {
        worldId,
        playerId: humanPlayer.id,
        conversationId: conversation.id,
        text: messageText,
        messageUuid,
      };
      for (let attempt = 0; ; attempt += 1) {
        try {
          await writeMessage(writeMessageArgs);
          break;
        } catch (error) {
          const canRetry =
            isTransientConvexWriteConflict(error) && attempt < WRITE_RETRY_DELAYS_MS.length;
          if (!canRetry) {
            toast.error(errorMessage(error));
            throw error;
          }
          if (import.meta.env.DEV) {
            console.debug('[GIIS timing]', {
              action: 'sendMessage',
              phase: 'convexMutationRetry',
              attempt: attempt + 1,
              delayMs: WRITE_RETRY_DELAYS_MS[attempt],
              message: errorMessage(error),
            });
          }
          await sleep(WRITE_RETRY_DELAYS_MS[attempt]);
        }
      }
      if (import.meta.env.DEV) {
        console.debug('[GIIS timing]', {
          action: 'sendMessage',
          phase: 'convexMutationTime',
          ms: Math.round(performance.now() - mutationStart),
        });
      }
      if (import.meta.env.DEV) {
        console.debug('[GIIS timing]', {
          action: 'sendMessage',
          phase: 'mutationQueued',
          ms: Math.round(performance.now() - mutationStart),
        });
      }
      window.dispatchEvent(
        new CustomEvent('giis:action-cinematic', {
          detail: { label: `${humanName ?? 'Alan'} 說話了`, actionType: 'chat' },
        }),
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
      window.setTimeout(() => focusInput(), 0);
    }
  };

  const beginTyping = async () => {
    if (currentlyTyping || inflightUuid.current !== undefined) {
      return;
    }
    inflightUuid.current = crypto.randomUUID();
    try {
      await startTyping({
        playerId: humanPlayer.id,
        conversationId: conversation.id,
        messageUuid: inflightUuid.current,
      });
    } finally {
      inflightUuid.current = undefined;
    }
  };

  const onKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();

    if (e.key === 'Escape') {
      window.dispatchEvent(new CustomEvent('giis:leave-conversation'));
      return;
    }

    if (e.key !== 'Enter') {
      return;
    }

    if (e.shiftKey || isComposing || e.nativeEvent.isComposing) {
      return;
    }

    e.preventDefault();
    await sendMessage();
  };

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    void beginTyping();
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    await sendMessage();
  };
  return (
    <form className="giis-chat-input-form" onSubmit={onSubmit}>
      <div className="giis-chat-input-line">
        <textarea
          className="giis-chat-input"
          ref={inputRef}
          style={{ outline: 'none' }}
          value={text}
          placeholder={
            placeholderTargetName
              ? `對 ${displayAgentName(placeholderTargetName)} 說些什麼... Enter 送出，Shift+Enter 換行`
              : '輸入訊息，Enter 送出，Shift+Enter 換行'
          }
          onKeyDown={(e) => onKeyDown(e)}
          onChange={onChange}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        />
        <button
          className="giis-send-button disabled:opacity-60"
          type="submit"
          disabled={sending || otherPlayerTyping}
        >
          {otherPlayerTyping ? '角色正在回覆' : sending ? '正在送出訊息' : '送出'}
        </button>
      </div>
      <p className="giis-chat-input-hint">
        {otherPlayerTyping
          ? `${displayAgentName(otherTypingName ?? placeholderTargetName ?? '角色')} 還在回覆。`
          : 'Esc 離開對話。中文輸入法組字時不會送出。'}
      </p>
    </form>
  );
}

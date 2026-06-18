// Conversation -> emotion (the ②→④ feedback edge that was missing). After a
// conversation, infer how it left the speaker feeling and nudge their
// `currentEmotion`. Pure + heuristic (no LLM, cheap on the M1): maps the felt
// content of the exchange onto the portrait palette. Returns null when
// there is no clear emotional signal, so a flat/neutral exchange never WIPES a
// meaningful current emotion. Once set, `currentEmotion` is already read into the
// character's next conversation prompt, so this single edge closes the loop:
// conversation → emotion → next conversation.
//
// Palette is intentionally small:
//   smiling  — warmth / connection / being moved
//   worried  — vulnerability / concern / stress surfaced
//   serious  — tension / confrontation / a boundary pressed
//   tired    — exhausted / overloaded / cannot carry more
//   flustered — affectionate warmth that breaks composure
//   guarded  — defensive distance / withheld trust
//   calm     — settled / de-escalated / safe pause
//   neutral  — ordinary closure without a strong affective residue

export type ConversationEmotion =
  | 'neutral'
  | 'smiling'
  | 'worried'
  | 'serious'
  | 'tired'
  | 'flustered'
  | 'guarded'
  | 'calm';

const EMOTION_CUES: Record<Exclude<ConversationEmotion, 'neutral'> | 'neutral', string[]> = {
  smiling: [
    '謝謝', '喜歡', '答應', '一起', '陪', '暖', '溫柔', '靠近', '信任', '放心',
    '願意', '抱', '好啊', '笑', '記得你', '想你', '在乎', '幸好', '鬆了',
  ],
  worried: [
    '累', '疲', '怕', '害怕', '擔心', '壓力', '沒事', '抖', '顫', '哭', '崩',
    '撐不住', '睡不', '孤單', '缺席', '沒回', '別撐', '逞強', '硬撐', '不舒服',
  ],
  serious: [
    '規則', '底線', '測試', '戳', '破綻', '衝突', '不行', '拒絕', '質問', '公平',
    '羞辱', '挑釁', '爭執', '警告', '代價', '買單', '欠', '帳', '推', '逼',
  ],
  tired: [
    '疲憊', '睡不', '沒睡', '睡眠', '少接', '先休息', '休息一下', '休息過嗎',
    '扛不動', '喘不過', '不想再開 checklist', '只整理三件', '今天先到這裡',
  ],
  flustered: [
    '害羞', '不好意思', '臉紅', '心跳', '慌了一下', '愣住', '喜歡你', '我也喜歡',
    '告白', '被你這樣說', '不太敢看',
  ],
  guarded: [
    '防備', '保留', '不想說', '不必說滿', '先不要問', '不要再追問', '別靠太近',
    '離遠一點', '正式一點', '我自己來', '不用你管',
  ],
  calm: [
    '平靜', '安靜一下', '說開了', '沒關係了', '先停在這裡', '放下了', '穩下來',
    '緩下來', '不用急', '不催你',
  ],
  neutral: ['沒什麼', '平常', '照舊', '先這樣', '就這樣', '結束了', '收好', '整理好'],
};

function countCues(text: string, cues: string[]): number {
  let n = 0;
  for (const cue of cues) if (text.includes(cue)) n += 1;
  return n;
}

// Infer the dominant emotion the conversation left, or null when no clear signal.
// `text` should combine what was said / the felt summary (transcript + residue +
// decision line). Ties prefer more specific states first so the expanded palette
// reduces flattening without making normal warmth/stress over-trigger.
export function inferEmotionFromConversation(text: string): ConversationEmotion | null {
  if (!text || !text.trim()) return null;
  const scores: Array<[ConversationEmotion, number]> = [
    ['tired', countCues(text, EMOTION_CUES.tired)],
    ['flustered', countCues(text, EMOTION_CUES.flustered)],
    ['guarded', countCues(text, EMOTION_CUES.guarded)],
    ['worried', countCues(text, EMOTION_CUES.worried)],
    ['smiling', countCues(text, EMOTION_CUES.smiling)],
    ['serious', countCues(text, EMOTION_CUES.serious)],
    ['calm', countCues(text, EMOTION_CUES.calm)],
    ['neutral', countCues(text, EMOTION_CUES.neutral)],
  ];
  const best = scores.reduce((a, b) => (b[1] > a[1] ? b : a));
  if (best[1] === 0) return null; // no signal at all → don't change the emotion
  return best[0];
}

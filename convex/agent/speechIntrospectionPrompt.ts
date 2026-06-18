// Speech-introspection (the "unsaid" made visible) — pure prompt + parser, no
// Convex ctx, so it is unit-testable and the action in memory.ts stays thin.
// See docs/SPEECH_INTROSPECTION_DASHBOARD_SPEC.md + SOUL_SPEECH_LITERATURE_BRIDGE.md.
//
// This is POST-HOC and DECOUPLED from live generation: given the line a
// character actually SAID (③, unchanged), plus their soul + the conversation, the
// model articulates ①what they wanted to say and ②what they held back / why.
// The spoken line (the baseline collection) is never touched — only annotated.

export type SpeechIntrospection = {
  innerWant: string; // ① 內心想說什麼
  heldBack: string; // ② 被 HIDE / 軟化 / 沒說的
  gateReason: string; // ② why (面子 / 風險 / 關係 / 信任 / 不想加重負擔)
};

export function speechIntrospectionEnabled(env: Pick<NodeJS.ProcessEnv, string> = process.env) {
  return env.UNDERWORLD_SPEECH_INTROSPECTION === 'true';
}

export function buildSpeechIntrospectionPrompt(
  self: string,
  other: string,
  profile: {
    role: string;
    persona: string;
    communicationStyle: string;
    stakes: { hiddenFear: string; hiddenDesire: string; emotionalVulnerability: string };
    coreValues: string[];
  } | null,
  transcript: string,
  saidLine: string,
): string {
  const soul = profile
    ? [
        `你（${self}）的內裡——只用來判斷你「真正想說什麼、為什麼把它收住」，永遠不要直接引用：`,
        `隱藏的恐懼：${profile.stakes.hiddenFear}`,
        `隱藏的渴望：${profile.stakes.hiddenDesire}`,
        `情緒上的脆弱：${profile.stakes.emotionalVulnerability}`,
        `核心價值：${profile.coreValues.join('、')}`,
        `你平常的樣子：${profile.persona}`,
        ``,
      ]
    : [];
  return [
    `You are ${self}. 你剛剛跟 ${other} 的一段對話如下：`,
    transcript,
    ``,
    ...soul,
    `在這段對話裡，你（${self}）實際說出口的是這句：`,
    `「${saidLine}」`,
    ``,
    `現在誠實地回看那一刻——人在開口前，心裡常有更直接的話，但會因為對方是誰、關係、面子、風險而把它收住、軟化、繞開或乾脆不說。請輸出三件事（繁體中文，各一句、白話、不堆砌）：`,
    `1. innerWant：那一刻你心裡其實最想說/最想讓對方知道的是什麼（比說出口的更直接、更未經修飾）。`,
    `2. heldBack：你把什麼收住了、軟化了、或選擇不說——說出口的那句和你內心想說的之間，被你藏起來的是什麼。`,
    `3. gateReason：你為什麼收住它（例如：怕加重對方負擔／面子／關係風險／不信任／想保持距離／時機不對）。用幾個字。`,
    ``,
    `規則：`,
    `- 只根據這段對話真的發生的內容，不要虛構事實或對方沒做過的事。`,
    `- innerWant 要比說出口的那句更裸、更直接，否則就沒有「被收住」的落差。`,
    `- 如果這句其實就是你心裡想說的、沒有收住什麼，innerWant 照實寫，heldBack 寫「這次沒有特別收住什麼」。`,
    `- 不要寫成舞台動作或心理分析論文；像你自己事後的一句老實話。`,
    `[嚴格只輸出一個 JSON 物件，沒有別的字：{"innerWant":"...","heldBack":"...","gateReason":"..."}]`,
  ].join('\n');
}

export const SPEECH_INTROSPECTION_FAILED = '__SPEECH_INTROSPECTION_FAILED__';

export function parseSpeechIntrospection(raw: string): SpeechIntrospection | null {
  if (!raw || raw.trim() === SPEECH_INTROSPECTION_FAILED) return null;
  // Tolerate code fences / stray prose around the JSON.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const innerWant = typeof o.innerWant === 'string' ? o.innerWant.trim() : '';
  const heldBack = typeof o.heldBack === 'string' ? o.heldBack.trim() : '';
  const gateReason = typeof o.gateReason === 'string' ? o.gateReason.trim() : '';
  if (!innerWant) return null; // innerWant is the point; without it there is no flow
  const cap = (s: string) => (s.length > 120 ? s.slice(0, 119) + '…' : s);
  return {
    innerWant: cap(innerWant),
    heldBack: cap(heldBack || '這次沒有特別收住什麼'),
    gateReason: cap(gateReason),
  };
}

export type ModelPolicyRole = 'smoke' | 'characterSoul' | 'memorySummarization' | 'reflection';

export type ModelPolicyEnv = Record<string, string | undefined>;

export const MODEL_POLICY = {
  smoke: {
    role: 'smoke' as const,
    allowedProvider: 'ollama',
    allowedModel: 'qwen2.5:1.5b',
  },
  characterSoul: {
    role: 'characterSoul' as const,
    allowedProviders: ['gemini', 'qwen', 'openai', 'openai-compatible'],
    defaultModelByProvider: {
      gemini: 'gemini-2.5-flash',
      qwen: 'qwen3-max',
      openai: 'qwen3-max',
      'openai-compatible': 'qwen3-max',
    },
  },
  memorySummarization: {
    role: 'memorySummarization' as const,
    mode: 'deterministic',
  },
  reflection: {
    role: 'reflection' as const,
    enabled: false,
  },
};

type CharacterSoulProvider = keyof typeof MODEL_POLICY.characterSoul.defaultModelByProvider;

const LOCAL_SMOKE_MODELS = new Set(['qwen2.5:1.5b']);
const CHARACTER_SOUL_CLOUD_PROVIDERS = new Set<string>(
  MODEL_POLICY.characterSoul.allowedProviders,
);
const FREE_WORLD_CLOUD_CHARACTER_NAMES = new Set([
  'umi',
  'mahiru',
  'mahirushiina',
  'tianze',
  'ichinose',
]);

const DEFAULT_DAILY_QUOTA = 24;
const DEFAULT_COOLDOWN_MS = 5 * 60_000;
const DEFAULT_FAILURE_THRESHOLD = 3;

type CharacterSoulProviderState = {
  dayKey: string;
  attempts: number;
  consecutiveFailures: number;
  cooldownUntil: number;
};

const characterSoulProviderState: CharacterSoulProviderState = {
  dayKey: '',
  attempts: 0,
  consecutiveFailures: 0,
  cooldownUntil: 0,
};

function todayKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

function envInteger(env: ModelPolicyEnv, name: string, fallback: number, min: number, max: number) {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function resetDailyStateIfNeeded(now: number) {
  const key = todayKey(now);
  if (characterSoulProviderState.dayKey === key) return;
  characterSoulProviderState.dayKey = key;
  characterSoulProviderState.attempts = 0;
  characterSoulProviderState.consecutiveFailures = 0;
  characterSoulProviderState.cooldownUntil = 0;
}

export function normalizeModelProvider(provider?: string) {
  return provider?.trim().toLowerCase() ?? '';
}

export function defaultCharacterSoulModel(provider?: string) {
  const normalized = normalizeModelProvider(provider) as CharacterSoulProvider;
  return MODEL_POLICY.characterSoul.defaultModelByProvider[normalized];
}

export function isLocalSmokeModel(model?: string) {
  return Boolean(model && LOCAL_SMOKE_MODELS.has(model.trim().toLowerCase()));
}

export function characterSoulPolicyViolation(provider?: string, model?: string) {
  const normalizedProvider = normalizeModelProvider(provider);
  if (!CHARACTER_SOUL_CLOUD_PROVIDERS.has(normalizedProvider)) {
    return 'characterSoul requires cloud provider mode';
  }
  if (isLocalSmokeModel(model)) {
    return 'qwen2.5:1.5b is smoke-only and cannot be used for characterSoul';
  }
  return null;
}

export function shouldUseCharacterSoulCloudProvider(provider?: string, model?: string) {
  const normalizedProvider = normalizeModelProvider(provider);
  if (CHARACTER_SOUL_CLOUD_PROVIDERS.has(normalizedProvider)) return true;
  const normalizedModel = model?.trim().toLowerCase() ?? '';
  return normalizedModel === 'gemini' || normalizedModel.startsWith('gemini/') || normalizedModel.startsWith('qwen/');
}

export function normalizedCharacterName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '');
}

export function isFreeWorldCloudCharacterName(name: string) {
  return FREE_WORLD_CLOUD_CHARACTER_NAMES.has(normalizedCharacterName(name));
}

export function freeWorldConversationProviderRole(
  speakerName: string,
  listenerName: string,
  humanInConversation = false,
) {
  void listenerName;
  if (humanInConversation) return 'human' as const;
  return isFreeWorldCloudCharacterName(speakerName) ? 'cloud' as const : 'local' as const;
}

export function characterSoulLocalFallbackEnabled(env: ModelPolicyEnv = process.env) {
  return env.CHARACTER_SOUL_LOCAL_FALLBACK === 'true';
}

export function characterSoulProviderGuard(env: ModelPolicyEnv = process.env, now = Date.now()) {
  resetDailyStateIfNeeded(now);
  if (characterSoulProviderState.cooldownUntil > now) {
    return {
      allowed: false,
      reason: `characterSoul provider is cooling down until ${new Date(characterSoulProviderState.cooldownUntil).toISOString()}`,
    };
  }
  const limit = envInteger(env, 'UMI_MAHIRU_PILOT_DAILY_QUOTA', DEFAULT_DAILY_QUOTA, 1, 500);
  if (characterSoulProviderState.attempts >= limit) {
    return {
      allowed: false,
      reason: `characterSoul daily quota reached (${characterSoulProviderState.attempts}/${limit})`,
    };
  }
  return { allowed: true, reason: null };
}

export function recordCharacterSoulProviderAttempt(now = Date.now()) {
  resetDailyStateIfNeeded(now);
  characterSoulProviderState.attempts += 1;
}

export function recordCharacterSoulProviderSuccess(now = Date.now()) {
  resetDailyStateIfNeeded(now);
  characterSoulProviderState.consecutiveFailures = 0;
}

export function recordCharacterSoulProviderFailure(env: ModelPolicyEnv = process.env, now = Date.now()) {
  resetDailyStateIfNeeded(now);
  characterSoulProviderState.consecutiveFailures += 1;
  const threshold = envInteger(
    env,
    'UMI_MAHIRU_PILOT_COOLDOWN_FAILURES',
    DEFAULT_FAILURE_THRESHOLD,
    1,
    20,
  );
  if (characterSoulProviderState.consecutiveFailures < threshold) return;
  const cooldownMs = envInteger(
    env,
    'UMI_MAHIRU_PILOT_COOLDOWN_MS',
    DEFAULT_COOLDOWN_MS,
    30_000,
    60 * 60_000,
  );
  characterSoulProviderState.cooldownUntil = now + cooldownMs;
}

export function resetCharacterSoulProviderGuardForTests() {
  characterSoulProviderState.dayKey = '';
  characterSoulProviderState.attempts = 0;
  characterSoulProviderState.consecutiveFailures = 0;
  characterSoulProviderState.cooldownUntil = 0;
}

export function memorySummarizationMode(env: ModelPolicyEnv = process.env) {
  return env.MEMORY_LLM_MODE ?? MODEL_POLICY.memorySummarization.mode;
}

export function reflectionLlmEnabled(env: ModelPolicyEnv = process.env) {
  void env;
  return MODEL_POLICY.reflection.enabled;
}

// System abort/leave markers emitted by the conversation engine itself
// when LLM is unavailable, aborted, repetitive, or template-leaking. These
// are NEVER legitimate model output — if any of these substrings appear,
// the text is engine scaffolding that must not reach archive, memory,
// reflection, or world events.
//
// Use `includes()` not `startsWith()` so mid-text leakage (e.g. a model
// quoting the marker back) is still caught.
export function isSystemAbortMarker(text: string): boolean {
  return (
    text.includes('[ABORT_CONVERSATION]') ||
    text.includes('[LEAVE]') ||
    text.includes('pilot LLM unavailable') ||
    text.includes('pilot repair fallback')
  );
}

// Deterministic-template Chinese phrases — only produced by the
// initiativeFallback / companionFallback / bindingFallback / repair paths
// in conversation.ts. A model emitting these standalone by coincidence is
// theoretically possible but vanishingly unlikely (the strings are
// signature-unique to their template branches). Where there was overlap
// with documented golden lines (the Tianze soul references), we picked a
// phrase that ONLY exists in the template context — see comments below.
export function isDeterministicTemplatePhrase(text: string): boolean {
  return (
    text.includes('這段先停在這裡') ||
    text.includes('先看見學生的不安，再談下一個功能') ||
    text.includes('我想去看看今天一直安靜的學生') ||
    text.includes('今晚先少接一件事') ||
    text.includes('我換個說法') ||
    text.includes('先不要重複') ||
    text.includes('我可以拆下一步') ||
    // Detects the L2736 / L1380 templates via a phrase that ONLY appears
    // in deterministic templates, not in the golden Tianze line
    // 「不是所有事都該默默丟給我」 itself. Without this split we would
    // block the legitimate model-generated golden line (see docs/soul/
    // UNDERWORLD_SOUL_ARCHITECTURE.md and README golden moments).
    text.includes('但這次我想先說清楚') ||
    // Detects the L2677 template via a phrase that ONLY appears there,
    // not in the standalone golden line 「你不是工具欄」.
    text.includes('今天先挑一件不要接的事') ||
    text.includes('今天我不開 checklist') ||
    text.includes('先不要再新增東西') ||
    text.includes('這段我先不寫進待辦') ||
    text.includes('海決定先提醒 Alan：功能可以慢慢加，但學生的不安要先被看見') ||
    text.includes('真晝決定今晚先去宿舍確認幾位學生的狀態，因為她聽見有人開始不敢說真心話') ||
    text.includes('確認誰因 AI 社、傳聞或派系壓力而不敢說真心話') ||
    text.includes('真晝感覺 Alan 的世界仍有被溫柔照顧的空間')
  );
}

// Catch-both wrapper. Use when you want to reject anything that smells
// like engine scaffolding — covers all current callers (persistence
// gates, archive guards, send-message guards). Prefer the two specific
// functions at NEW call sites so the intent is explicit, especially if
// the caller could legitimately want one but not the other.
export function isGeneratedFallbackText(text: string): boolean {
  return isSystemAbortMarker(text) || isDeterministicTemplatePhrase(text);
}

const CHARACTER_SOUL_REPEATED_MOTIFS = [
  '便當',
  '便當盒',
  '餐盤',
  '三明治',
  '熱湯',
  '湯匙',
  '筷子',
  '魚排',
  '飯',
  '杯子',
  '杯',
  '茶',
  '冷茶',
  '紅茶',
  '咖啡',
  '清單',
  '名單',
  '表單',
  '文件',
  '資料',
  '數據',
  '便條',
  '紀錄表',
  '簡報',
  '燈',
  '門縫',
  '窗',
  '角落',
  '椅子',
  '座位',
  '桌子',
];

function repeatedCharacterSoulMotif(messages: string[]) {
  const text = messages.join('\n');
  return CHARACTER_SOUL_REPEATED_MOTIFS.find((motif) => countLiteral(text, motif) >= 3);
}

function countLiteral(text: string, literal: string) {
  if (!literal) return 0;
  return text.split(literal).length - 1;
}

export function shouldPersistCharacterSoulTranscript(participantNames: string[], messages: string[]) {
  return characterSoulPersistenceRejectionReason(participantNames, messages) === null;
}

export function characterSoulPersistenceRejectionReason(
  participantNames: string[],
  messages: string[],
): null | 'generated_fallback' | 'empty_pilot_transcript' | 'too_short_pilot_transcript' {
  const names = new Set(participantNames.map(normalizedCharacterName));
  const coreTriadCount = ['umi', 'mahiru', 'mahirushiina', 'tianze'].filter((name) => names.has(name)).length;
  const isTianzeIchinosePair = names.has('tianze') && names.has('ichinose');
  const isPilotPair =
    (names.has('umi') && (names.has('mahiru') || names.has('mahirushiina'))) ||
    coreTriadCount >= 2 ||
    isTianzeIchinosePair;
  if (messages.some(isGeneratedFallbackText)) return 'generated_fallback';
  if (!isPilotPair) return null;
  if (messages.length === 0) return 'empty_pilot_transcript';
  if (messages.length < 3) return 'too_short_pilot_transcript';
  return null;
}

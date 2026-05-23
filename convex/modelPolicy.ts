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

export function isGeneratedFallbackText(text: string) {
  return (
    text.startsWith('[ABORT_CONVERSATION]') ||
    text.includes('這段先停在這裡') ||
    text.includes('先看見學生的不安，再談下一個功能') ||
    text.includes('我想去看看今天一直安靜的學生') ||
    text.includes('今晚先少接一件事') ||
    text.includes('我換個說法') ||
    text.includes('先不要重複') ||
    text.includes('海決定先提醒 Alan：功能可以慢慢加，但學生的不安要先被看見') ||
    text.includes('真晝決定今晚先去宿舍確認幾位學生的狀態，因為她聽見有人開始不敢說真心話') ||
    text.includes('確認誰因 AI 社、傳聞或派系壓力而不敢說真心話') ||
    text.includes('真晝感覺 Alan 的世界仍有被溫柔照顧的空間')
  );
}

export function shouldPersistCharacterSoulTranscript(participantNames: string[], messages: string[]) {
  const names = new Set(participantNames);
  const isPilotPair = names.has('Umi') && names.has('Mahiru Shiina');
  if (!isPilotPair) return true;
  if (messages.length === 0) return false;
  return !messages.some(isGeneratedFallbackText);
}

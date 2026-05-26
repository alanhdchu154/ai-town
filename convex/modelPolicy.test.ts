import {
  characterSoulPolicyViolation,
  characterSoulProviderGuard,
  isGeneratedFallbackText,
  memorySummarizationMode,
  recordCharacterSoulProviderAttempt,
  recordCharacterSoulProviderFailure,
  reflectionLlmEnabled,
  resetCharacterSoulProviderGuardForTests,
  shouldPersistCharacterSoulTranscript,
} from './modelPolicy';

describe('model policy', () => {
  beforeEach(() => {
    resetCharacterSoulProviderGuardForTests();
  });

  test('keeps qwen2.5:1.5b as smoke-only, not character soul', () => {
    expect(characterSoulPolicyViolation('qwen', 'qwen2.5:1.5b')).toMatch(/smoke-only/);
    expect(characterSoulPolicyViolation('qwen', 'qwen3-max')).toBeNull();
    expect(characterSoulPolicyViolation('ollama', 'qwen2.5:1.5b')).toMatch(/cloud provider/);
  });

  test('keeps memory summarization deterministic and reflection disabled by policy', () => {
    expect(memorySummarizationMode({})).toBe('deterministic');
    expect(reflectionLlmEnabled({ ENABLE_MEMORY_REFLECTION_LLM: 'true' })).toBe(false);
    expect(
      reflectionLlmEnabled({
        ENABLE_MEMORY_REFLECTION_LLM: 'true',
        MEMORY_LLM_MODE: 'full',
      }),
    ).toBe(false);
  });

  test('blocks generated fallback text from Umi/Mahiru persistence', () => {
    const participants = ['Umi', 'Mahiru Shiina'];
    expect(shouldPersistCharacterSoulTranscript(participants, [])).toBe(false);
    expect(
      shouldPersistCharacterSoulTranscript(participants, [
        '[ABORT_CONVERSATION] pilot LLM unavailable',
      ]),
    ).toBe(false);
    expect(
      shouldPersistCharacterSoulTranscript(participants, [
        '這段先停在這裡。我會提醒 Alan 先看見學生的不安，再談下一個功能。',
      ]),
    ).toBe(false);
    expect(
      shouldPersistCharacterSoulTranscript(participants, [
        '海，妳剛剛一直在整理 Alan 的事情，可是妳自己有休息嗎？',
      ]),
    ).toBe(true);
  });

  test('blocks generated fallback text from all persistence but allows ordinary other-pair text', () => {
    expect(
      shouldPersistCharacterSoulTranscript(['Umi', 'CaoCao'], [
        '這段先停在這裡。我會提醒 Alan 先看見學生的不安，再談下一個功能。',
      ]),
    ).toBe(false);
    expect(
      shouldPersistCharacterSoulTranscript(['Umi', 'CaoCao'], [
        '曹操，這件事我會先看清楚再告訴 Alan。',
      ]),
    ).toBe(true);
    expect(isGeneratedFallbackText('[ABORT_CONVERSATION] anything')).toBe(true);
  });

  test('enforces a daily quota and cooldown guard for character soul providers', () => {
    const now = Date.UTC(2026, 4, 22, 12, 0, 0);
    expect(characterSoulProviderGuard({ UMI_MAHIRU_PILOT_DAILY_QUOTA: '2' }, now)).toEqual({
      allowed: true,
      reason: null,
    });
    recordCharacterSoulProviderAttempt(now);
    recordCharacterSoulProviderAttempt(now);
    expect(characterSoulProviderGuard({ UMI_MAHIRU_PILOT_DAILY_QUOTA: '2' }, now)).toMatchObject({
      allowed: false,
    });

    resetCharacterSoulProviderGuardForTests();
    recordCharacterSoulProviderFailure(
      {
        UMI_MAHIRU_PILOT_COOLDOWN_FAILURES: '1',
        UMI_MAHIRU_PILOT_COOLDOWN_MS: '30000',
      },
      now,
    );
    expect(characterSoulProviderGuard({}, now + 1)).toMatchObject({ allowed: false });
  });
});

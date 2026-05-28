import {
  characterSoulPolicyViolation,
  characterSoulLocalFallbackEnabled,
  characterSoulProviderGuard,
  freeWorldConversationProviderRole,
  isFreeWorldCloudCharacterName,
  isDeterministicTemplatePhrase,
  isGeneratedFallbackText,
  isSystemAbortMarker,
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

  test('routes free-world main three as cloud speakers and others as local speakers', () => {
    expect(isFreeWorldCloudCharacterName('Umi')).toBe(true);
    expect(isFreeWorldCloudCharacterName('Mahiru Shiina')).toBe(true);
    expect(isFreeWorldCloudCharacterName('Asuna')).toBe(true);
    expect(isFreeWorldCloudCharacterName('CaoCao')).toBe(false);
    expect(isFreeWorldCloudCharacterName('Mai')).toBe(false);
    expect(isFreeWorldCloudCharacterName('Liu Bei')).toBe(false);

    expect(freeWorldConversationProviderRole('Umi', 'CaoCao')).toBe('cloud');
    expect(freeWorldConversationProviderRole('Mahiru Shiina', 'Asuna')).toBe('cloud');
    expect(freeWorldConversationProviderRole('Asuna', 'Liu Bei')).toBe('cloud');
    expect(freeWorldConversationProviderRole('CaoCao', 'Umi')).toBe('local');
    expect(freeWorldConversationProviderRole('Mai', 'Liu Bei')).toBe('local');
    expect(freeWorldConversationProviderRole('Umi', 'Alan', true)).toBe('human');
  });

  test('allows local LLM fallback for character soul unless explicitly disabled', () => {
    expect(characterSoulLocalFallbackEnabled({})).toBe(true);
    expect(characterSoulLocalFallbackEnabled({ CHARACTER_SOUL_LOCAL_FALLBACK: 'true' })).toBe(true);
    expect(characterSoulLocalFallbackEnabled({ CHARACTER_SOUL_LOCAL_FALLBACK: 'false' })).toBe(false);
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
    expect(
      shouldPersistCharacterSoulTranscript(['Asuna', 'Mai'], [
        '我可以拆下一步。但這次我想先說清楚：我不是不累，只是習慣先把事情接住。',
      ]),
    ).toBe(false);
    expect(
      shouldPersistCharacterSoulTranscript(['Asuna', 'CaoCao'], [
        '……先不要再新增東西了。你直接說哪件事可以關掉。',
      ]),
    ).toBe(false);
    expect(
      shouldPersistCharacterSoulTranscript(['Asuna', 'Mai'], [
        '今天我不開 checklist。你選一件事，我只負責把它交出去。',
      ]),
    ).toBe(false);
    expect(isGeneratedFallbackText('[ABORT_CONVERSATION] anything')).toBe(true);
  });

  test('split: system abort markers vs deterministic template phrases', () => {
    // System markers — engine-emitted, never legitimate model output.
    expect(isSystemAbortMarker('[ABORT_CONVERSATION] autonomous LLM disabled')).toBe(true);
    expect(isSystemAbortMarker('[LEAVE] 我先休息一下')).toBe(true);
    expect(isSystemAbortMarker('pilot LLM unavailable now')).toBe(true);
    expect(isSystemAbortMarker('我覺得我們先到這裡。')).toBe(false);

    // Template phrases — only present in deterministic fallback templates.
    expect(isDeterministicTemplatePhrase('今天先挑一件不要接的事，好嗎？')).toBe(true);
    expect(isDeterministicTemplatePhrase('但這次我想先說清楚：我不是不累')).toBe(true);
    expect(isDeterministicTemplatePhrase('明日奈，我覺得你今天有點累。')).toBe(false);

    // The two Asuna golden lines must NOT be blocked standalone — only
    // the template variants that contain them along with the unique
    // template signature.
    expect(isDeterministicTemplatePhrase('不是所有事都該默默丟給我')).toBe(false);
    expect(isDeterministicTemplatePhrase('你不是工具欄')).toBe(false);
    // But the full templates that wrap them must still block:
    expect(
      isDeterministicTemplatePhrase(
        '我可以負責下一步。但這次我想先說清楚：不是所有事都該默默丟給我。',
      ),
    ).toBe(true);
    expect(
      isDeterministicTemplatePhrase('你不是工具欄，明日奈。\n\n今天先挑一件不要接的事，好嗎？'),
    ).toBe(true);

    // Catch-both wrapper still covers both.
    expect(isGeneratedFallbackText('[ABORT_CONVERSATION] anything')).toBe(true);
    expect(isGeneratedFallbackText('今天我不開 checklist。')).toBe(true);
    expect(isGeneratedFallbackText('真晝，妳剛剛聲音很輕。')).toBe(false);
  });

  test('autonomous abort variants all dropped from persistence', () => {
    // Spot-check the new abort marker variants introduced when the engine
    // replaced deterministic fallbacks with [ABORT_CONVERSATION] markers.
    // All start with [ABORT_CONVERSATION] so isSystemAbortMarker catches.
    const variants = [
      '[ABORT_CONVERSATION] autonomous LLM disabled at start',
      '[ABORT_CONVERSATION] autonomous LLM unavailable at start',
      '[ABORT_CONVERSATION] autonomous LLM disabled mid-conversation',
      '[ABORT_CONVERSATION] autonomous conversation lifecycle exhausted',
      '[ABORT_CONVERSATION] autonomous deterministic pressure',
      '[ABORT_CONVERSATION] autonomous LLM unavailable mid-conversation',
      '[ABORT_CONVERSATION] autonomous repetitive response',
      '[ABORT_CONVERSATION] autonomous LLM disabled on leave',
      '[ABORT_CONVERSATION] autonomous LLM unavailable on leave',
      '[ABORT_CONVERSATION] companion template leak',
      '[ABORT_CONVERSATION] autonomous template leak',
      '[ABORT_CONVERSATION] companion repetitive fallback',
    ];
    for (const variant of variants) {
      expect(isSystemAbortMarker(variant)).toBe(true);
      expect(shouldPersistCharacterSoulTranscript(['CaoCao', 'Mai'], [variant])).toBe(false);
    }
    // Mid-text leakage (if a model quotes the marker back) also caught.
    expect(isSystemAbortMarker('I said [ABORT_CONVERSATION] in the middle')).toBe(true);
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

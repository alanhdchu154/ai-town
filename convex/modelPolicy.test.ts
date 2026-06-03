import {
  characterSoulPersistenceRejectionReason,
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
    expect(isFreeWorldCloudCharacterName('Mahiru')).toBe(true);
    expect(isFreeWorldCloudCharacterName('Mahiru Shiina')).toBe(true);
    expect(isFreeWorldCloudCharacterName('Tianze')).toBe(true);
    expect(isFreeWorldCloudCharacterName('Ichinose')).toBe(true);
    expect(isFreeWorldCloudCharacterName('CaoCao')).toBe(false);
    expect(isFreeWorldCloudCharacterName('Liu Bei')).toBe(false);

    expect(freeWorldConversationProviderRole('Umi', 'CaoCao')).toBe('cloud');
    expect(freeWorldConversationProviderRole('Mahiru', 'Tianze')).toBe('cloud');
    expect(freeWorldConversationProviderRole('Mahiru Shiina', 'Tianze')).toBe('cloud');
    expect(freeWorldConversationProviderRole('Tianze', 'Liu Bei')).toBe('cloud');
    expect(freeWorldConversationProviderRole('Ichinose', 'Liu Bei')).toBe('cloud');
    expect(freeWorldConversationProviderRole('CaoCao', 'Umi')).toBe('local');
    expect(freeWorldConversationProviderRole('Umi', 'Alan', true)).toBe('human');
  });

  test('disables local LLM fallback for character soul unless explicitly enabled', () => {
    expect(characterSoulLocalFallbackEnabled({})).toBe(false);
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
    const participants = ['Umi', 'Mahiru'];
    expect(shouldPersistCharacterSoulTranscript(participants, [])).toBe(false);
    expect(characterSoulPersistenceRejectionReason(participants, [])).toBe('empty_pilot_transcript');
    expect(
      shouldPersistCharacterSoulTranscript(participants, [
        '[ABORT_CONVERSATION] pilot LLM unavailable',
      ]),
    ).toBe(false);
    expect(
      characterSoulPersistenceRejectionReason(participants, [
        '[ABORT_CONVERSATION] pilot LLM unavailable',
      ]),
    ).toBe('generated_fallback');
    expect(
      shouldPersistCharacterSoulTranscript(participants, [
        '這段先停在這裡。我會提醒 Alan 先看見學生的不安，再談下一個功能。',
      ]),
    ).toBe(false);
    expect(
      shouldPersistCharacterSoulTranscript(participants, [
        '海，妳剛剛一直在整理 Alan 的事情，可是妳自己有休息嗎？',
      ]),
    ).toBe(false);
    expect(
      characterSoulPersistenceRejectionReason(participants, [
        '海，妳剛剛一直在整理 Alan 的事情，可是妳自己有休息嗎？',
      ]),
    ).toBe('too_short_pilot_transcript');
    expect(shouldPersistCharacterSoulTranscript(['Umi', 'Mahiru Shiina'], ['真晝，我先少講一點。'])).toBe(false);
    expect(
      shouldPersistCharacterSoulTranscript(['Umi', 'Mahiru Shiina'], [
        '真晝，我先少講一點。',
        '嗯，那你先坐一下。',
        '好，我只留三件事給 Alan。',
      ]),
    ).toBe(true);
  });

  test('allows repeated everyday motifs through persistence so eval can judge them', () => {
    expect(
      shouldPersistCharacterSoulTranscript(['Umi', 'Mahiru'], [
        '真晝，便當先放著。',
        '便當還熱著，你先別急。',
        '我去把便當熱一下。',
      ]),
    ).toBe(true);
    expect(
      shouldPersistCharacterSoulTranscript(['Umi', 'Mahiru'], [
        '真晝，茶都涼了。',
        '茶涼了也沒關係。',
        '那今晚就只聊茶涼不涼。',
      ]),
    ).toBe(true);
    expect(
      shouldPersistCharacterSoulTranscript(['Umi', 'Tianze'], [
        '天澤，我先把簡報刪掉一半。',
        '簡報先別管，你肩膀太緊了。',
        '那我晚點再碰簡報。',
      ]),
    ).toBe(true);
    expect(
      shouldPersistCharacterSoulTranscript(['Mahiru', 'Tianze'], [
        '天澤，清單先放著。',
        '我知道，但清單還沒處理完。',
        '那今天先別再開清單了。',
      ]),
    ).toBe(true);
    expect(
      shouldPersistCharacterSoulTranscript(['Mahiru', 'Tianze'], [
        '這份表單我本來想自己填完。',
        '你手邊那三張表單先擱著。',
        '紅茶都快涼了，我還是先填完這三張表單再喝。',
      ]),
    ).toBe(true);
    expect(
      characterSoulPersistenceRejectionReason(['Mahiru', 'Tianze'], [
        '這份表單我本來想自己填完。',
        '你手邊那三張表單先擱著。',
        '紅茶都快涼了，我還是先填完這三張表單再喝。',
      ]),
    ).toBeNull();
    expect(
      shouldPersistCharacterSoulTranscript(['Umi', 'Mahiru'], [
        '真晝，茶都涼了。',
        '那先別喝了，我陪你坐一下。',
      ]),
    ).toBe(false);
    expect(
      characterSoulPersistenceRejectionReason(['Umi', 'Mahiru'], [
        '真晝，茶都涼了。',
        '那先別喝了，我陪你坐一下。',
      ]),
    ).toBe('too_short_pilot_transcript');
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
      shouldPersistCharacterSoulTranscript(['Tianze', 'Ichinose'], [
        '我可以拆下一步。但這次我想先說清楚：我不是不累，只是習慣先把事情接住。',
      ]),
    ).toBe(false);
    expect(
      shouldPersistCharacterSoulTranscript(['Tianze', 'CaoCao'], [
        '……先不要再新增東西了。你直接說哪件事可以關掉。',
      ]),
    ).toBe(false);
    expect(
      shouldPersistCharacterSoulTranscript(['Tianze', 'Ichinose'], [
        '今天我不開 checklist。你選一件事，我只負責把它交出去。',
      ]),
    ).toBe(false);
    expect(
      characterSoulPersistenceRejectionReason(['Tianze', 'Ichinose'], [
        '天澤，你剛才那句玩笑，是想測底線，還是想讓別人替你付費？',
        '一之瀨，妳笑得這麼甜，是不是已經把我的玩笑寫進帳本了？',
      ]),
    ).toBe('too_short_pilot_transcript');
    expect(
      shouldPersistCharacterSoulTranscript(['Tianze', 'Ichinose'], [
        '天澤，你剛才那句玩笑，是想測底線，還是想讓別人替你付費？',
        '一之瀨，妳笑得這麼甜，是不是已經把我的玩笑寫進帳本了？',
        '我只是想確認，這次你停手，是因為無聊，還是因為真的看見有人會痛。',
      ]),
    ).toBe(true);
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
    expect(isDeterministicTemplatePhrase('天澤，我覺得你今天有點累。')).toBe(false);

    // The two Tianze golden lines must NOT be blocked standalone — only
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
      isDeterministicTemplatePhrase('你不是工具欄，天澤。\n\n今天先挑一件不要接的事，好嗎？'),
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
      expect(shouldPersistCharacterSoulTranscript(['CaoCao', 'Ichinose'], [variant])).toBe(false);
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

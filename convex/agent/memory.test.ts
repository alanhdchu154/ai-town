import {
  COMMITMENT_FULFILLED_MARKER,
  RECALL_CORRECTED_MARKER,
  buildReflectionPrompt,
  buildResiduePrompt,
  sanitizeLlmResidue,
  localDayKey,
  claimedRecallFragmentsFromMessages,
  commitmentFromMemoryDescription,
  commitmentIsExpired,
  commitmentIsFulfilled,
  conversationHasRecallCorrection,
  concreteCommitmentSummaryForMessages,
  hasDialogueStageDirectionLeak,
  hasUnansweredHumanTailForMemory,
  hasMemoryPostProcessingDrift,
  memoryAnchorTextForMessages,
  otherParticipantIdForConversation,
  resolveCommitmentDueAt,
  shouldExposeMemoryDescription,
  shouldPersistConversationMemoryShape,
} from './memory';

describe('recall-corrected memory downweighting', () => {
  test('marked memories are hidden from prompt read paths', () => {
    const description =
      '與 Alan 在 2026/6/4 下午7:56 的對話：我們談過世界變得太聰明卻少了溫度。';
    expect(shouldExposeMemoryDescription(description)).toBe(true);
    expect(shouldExposeMemoryDescription(`${RECALL_CORRECTED_MARKER}${description}`)).toBe(false);
  });

  test('extracts what the speaker claimed to remember for downweighting', () => {
    // Real 6/4 shape: 海 claims a fabricated recall, Alan corrects her.
    const fragments = claimedRecallFragmentsFromMessages(
      [
        { author: 'p:umi', text: '我記得你說過世界變得太聰明卻少了溫度。' },
        { author: 'p:alan', text: '不是，我前幾天說要吃咖哩飯。' },
      ],
      'p:umi',
    );
    expect(fragments).toEqual(['世界變得太聰明卻少了溫度']);

    // Other-party messages and too-short fragments are ignored.
    expect(
      claimedRecallFragmentsFromMessages(
        [{ author: 'p:alan', text: '我記得你說過世界變得太聰明卻少了溫度。' }],
        'p:umi',
      ),
    ).toEqual([]);
    expect(
      claimedRecallFragmentsFromMessages([{ author: 'p:umi', text: '我記得那天。' }], 'p:umi'),
    ).toEqual([]);
  });
});

describe('conversationHasRecallCorrection', () => {
  const UMI = 'p:0';
  const ALAN = 'p:alan';

  test('detects the other party correcting the speakers invented recall', () => {
    // Real 海 case: Umi recalled a line Alan never said; Alan corrects her.
    const messages = [
      { author: UMI, text: '我記得你說過世界變得太聰明卻少了溫度。' },
      { author: ALAN, text: '不是，我前幾天說要吃咖哩飯，你說要給我做。' },
    ];
    expect(conversationHasRecallCorrection(messages, UMI)).toBe(true);
  });

  test('detects explicit memory-correction phrases', () => {
    expect(
      conversationHasRecallCorrection(
        [{ author: ALAN, text: '你記錯了，那是上禮拜的事。' }],
        UMI,
      ),
    ).toBe(true);
    expect(
      conversationHasRecallCorrection([{ author: ALAN, text: '我沒說過那種話。' }], UMI),
    ).toBe(true);
  });

  test('does not fire on ordinary conversation, or on the speaker correcting themselves', () => {
    expect(
      conversationHasRecallCorrection(
        [
          { author: UMI, text: '今天有點累，先坐一下吧。' },
          { author: ALAN, text: '好啊。' },
        ],
        UMI,
      ),
    ).toBe(false);
    // A correction in the speaker's own message must not count against them.
    expect(
      conversationHasRecallCorrection([{ author: UMI, text: '你記錯了嗎？' }], UMI),
    ).toBe(false);
  });
});

describe('otherParticipantIdForConversation', () => {
  test('uses archived conversation participants before participatedTogether fallback', () => {
    expect(
      otherParticipantIdForConversation(
        { participants: ['p:maomao', 'p:ichinose'] },
        'p:maomao',
        { player2: 'p:tianze' },
      ),
    ).toBe('p:ichinose');
  });

  test('falls back to participatedTogether only when participants are unavailable', () => {
    expect(otherParticipantIdForConversation({}, 'p:maomao', { player2: 'p:tianze' })).toBe(
      'p:tianze',
    );
  });
});

describe('commitmentFromMemoryDescription', () => {
  test('extracts the concrete commitment embedded in a memory description', () => {
    const description =
      '與 Alan 在 2026/6/4 下午7:56 的對話：具體承諾：Umi答應明天為Alan準備咖哩飯；Umi 和 Alan 進行了一段短暫對話\n殘留：世界變得太聰明，卻少了溫度。';
    expect(commitmentFromMemoryDescription(description)).toBe('Umi答應明天為Alan準備咖哩飯');
  });

  test('returns empty string when there is no commitment line', () => {
    expect(commitmentFromMemoryDescription('與 海 的對話：留下的重點是：「今天有點累。」')).toBe('');
    expect(commitmentFromMemoryDescription('')).toBe('');
  });
});

describe('commitmentIsFulfilled', () => {
  test('detects the fulfilled marker; plain commitments stay open', () => {
    expect(commitmentIsFulfilled(`${COMMITMENT_FULFILLED_MARKER}Umi答應明天為Alan準備咖哩飯`)).toBe(
      true,
    );
    expect(commitmentIsFulfilled('Umi答應明天為Alan準備咖哩飯')).toBe(false);
    expect(commitmentIsFulfilled('')).toBe(false);
  });

  test('marking format round-trips through commitmentFromMemoryDescription', () => {
    // The exact patch school:markCommitmentFulfilled applies: insert the
    // marker right after 具體承諾：.
    const description =
      '與 Alan 在 2026/6/10 下午7:56 的對話：具體承諾：一之瀨答應明天（6/11 週四）為Alan準備咖哩飯（說於6/10 週三）；短暫對話\n殘留：手心的溫度。';
    const marked = description.replace('具體承諾：', `具體承諾：${COMMITMENT_FULFILLED_MARKER}`);
    const parsed = commitmentFromMemoryDescription(marked);
    expect(parsed).toBe(
      `${COMMITMENT_FULFILLED_MARKER}一之瀨答應明天（6/11 週四）為Alan準備咖哩飯（說於6/10 週三）`,
    );
    expect(commitmentIsFulfilled(parsed)).toBe(true);
    // The original (unmarked) copy still parses as the open commitment.
    expect(commitmentIsFulfilled(commitmentFromMemoryDescription(description))).toBe(false);
    // A fulfilled memory is still exposed to read paths (unlike corrected ones).
    expect(shouldExposeMemoryDescription(marked)).toBe(true);
  });
});

describe('memory post-processing hygiene', () => {
  test('hides system-language conversation memories from prompts and reports', () => {
    const description = [
      '與 海 在 5/28/2026 的對話：最後留下的重點是：「我這幾天要整理世界情緒的脈絡。」',
      '記憶層級：長期候選；標籤：emotional_residue；判斷：這段記憶可能會改變後續行動。',
      '殘留：真晝還記得海聽起來很有用，但不像真的休息過。',
    ].join('\n');

    expect(hasMemoryPostProcessingDrift(description)).toBe(true);
    expect(shouldExposeMemoryDescription(description)).toBe(false);
  });

  test('keeps concrete everyday emotional residue visible', () => {
    const description = [
      '與 真晝 在 5/28/2026 的對話：海 和 真晝 談到早餐、牛奶和走廊那盞燈。',
      '記憶層級：今日經歷；標籤：emotional_residue, everyday_life；判斷：這是今天的經歷。',
      '殘留：海還記得真晝沒有只要她繼續有用，而是問她有沒有吃早餐。',
    ].join('\n');

    expect(hasMemoryPostProcessingDrift(description)).toBe(false);
    expect(shouldExposeMemoryDescription(description)).toBe(true);
  });

  test('hides campus emotion-map report drift without hiding ordinary emotion residue', () => {
    const driftDescription =
      '與 貓貓 在 5/28/2026 的對話：最後留下的重點是：「我得先整理幾份關於校園情緒地圖的報告。」';
    const everydayDescription =
      '殘留：真晝還記得教室午餐後變安靜，海把 Alan 今天需要先看見的人列少一點。';

    expect(hasMemoryPostProcessingDrift(driftDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(driftDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(everydayDescription)).toBe(false);
    expect(shouldExposeMemoryDescription(everydayDescription)).toBe(true);
  });

  test('hides task-manager phrasing that should not become emotional residue', () => {
    const driftDescription =
      '與 天澤 在 5/28/2026 的對話：最後留下的重點是：「我會開始掃描教室，確保所有人都有任務和支援。」';
    const flowDescription =
      '與 貓貓 在 5/28/2026 的對話：最後留下的重點是：「名單已交接清楚，我累了，需要去整理明天的流程。」';
    const helperDescription =
      '與 祥子 在 5/28/2026 的對話：最後留下的重點是：「暫時不覺得累。看看窗邊是否有人需要幫助。」';

    expect(hasMemoryPostProcessingDrift(driftDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(driftDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(flowDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(flowDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(helperDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(helperDescription)).toBe(false);
  });

  test('detects first-person action narration as dialogue stage-direction leakage', () => {
    expect(hasDialogueStageDirectionLeak('我關上抽屜，順手把窗也拉嚴了一點。')).toBe(true);
    expect(hasDialogueStageDirectionLeak('我指尖還停在你手背上。')).toBe(true);
    expect(hasDialogueStageDirectionLeak('（笑）明天早上我們去看鯊魚，好嗎？')).toBe(false);
    expect(hasDialogueStageDirectionLeak('明天早上我們去看鯊魚，好嗎？')).toBe(false);
  });

  test('hides admin and slogan drift from autonomous conversation memory', () => {
    const budgetDescription =
      '與 一之瀨 在 5/28/2026 的對話：最後留下的重點是：「我先把這筆預算的執行清單寫好，這份文件的核對工作你願意分擔一半嗎？」';
    const sloganDescription =
      '與 天澤 在 5/28/2026 的對話：最後留下的重點是：「我們商量下一步，別讓那些隱形成本趁虛而入。」';
    const simplifiedSloganDescription =
      '與 天澤 在 5/28/2026 的對話：最後留下的重點是：「那就按你說的办，不過别忘了那些隐形的成本哦。」';

    expect(hasMemoryPostProcessingDrift(budgetDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(budgetDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(sloganDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(sloganDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(simplifiedSloganDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(simplifiedSloganDescription)).toBe(false);
  });

  test('hides efficiency-collaboration template drift from memory', () => {
    const efficiencyDescription =
      '與 貓貓 在 5/28/2026 的對話：最後留下的重點是：「嗯，但這也是個提醒，讓我思考怎麼讓個人準備更有效率。」';
    const collaborationDescription =
      '與 一之瀨 在 5/28/2026 的對話：最後留下的重點是：「這樣一起合作看看可行嗎？我們可以互相補充信息。」';
    const selfOrganizeDescription =
      '與 貓貓 在 5/28/2026 的對話：最後留下的重點是：「我覺得目前還是我自己組織比較好，別的想法。」';

    expect(hasMemoryPostProcessingDrift(efficiencyDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(efficiencyDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(collaborationDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(collaborationDescription)).toBe(false);
    expect(hasMemoryPostProcessingDrift(selfOrganizeDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(selfOrganizeDescription)).toBe(false);
  });

  test('hides generic agreement closure from memory', () => {
    const genericClosureDescription =
      '與 貓貓 在 5/28/2026 的對話：最後留下的重點是：「你剛才說的正中窩心，那就這樣做吧。」';

    expect(hasMemoryPostProcessingDrift(genericClosureDescription)).toBe(true);
    expect(shouldExposeMemoryDescription(genericClosureDescription)).toBe(false);
  });

  test('extracts concrete timed commitments from Alan food requests', () => {
    const commitment = concreteCommitmentSummaryForMessages(
      { id: 'p:2', name: '天澤' },
      { id: 'p:human', name: 'Alan' },
      [
        { author: 'p:human', text: '我想要你明天做給我？可以嗎' },
        { author: 'p:2', text: '……明天啊。好，我試試看。' },
      ],
    );

    expect(commitment).toBe('');

    const curryCommitment = concreteCommitmentSummaryForMessages(
      { id: 'p:2', name: '天澤' },
      { id: 'p:human', name: 'Alan' },
      [
        { author: 'p:human', text: '我想吃你做的咖喱飯。' },
        { author: 'p:human', text: '我想要你明天做給我？可以嗎' },
        { author: 'p:2', text: '……明天啊。好，我試試看。' },
      ],
    );

    expect(curryCommitment).toBe('具體承諾：天澤答應明天為Alan準備咖哩飯');
  });

  test('keeps the promiser as the offerer when the other party only accepts', () => {
    // Real 一之瀨 case (c:94554): she offers to cook, Alan closes with "好".
    // Without offer detection the commitment direction inverts to Alan cooking.
    const commitment = concreteCommitmentSummaryForMessages(
      { id: 'p:ichinose', name: '一之瀨' },
      { id: 'p:human', name: 'Alan' },
      [
        {
          author: 'p:ichinose',
          text: '「現在」太吵了，Alan。不如明天吧？那時候教室只剩我們兩人，我煮咖哩飯給你吃……但你要先答應，吃完後要負責把碗洗乾淨。',
        },
        { author: 'p:human', text: '好。' },
      ],
    );

    expect(commitment).toBe('具體承諾：一之瀨答應明天為Alan準備咖哩飯');
  });

  test('captures an unrejected first-person offer even without an explicit acceptance', () => {
    // Real c:94554 failure: 一之瀨 offered inside a question-marked line and
    // Alan never typed a bare "好" — the commitment silently vanished.
    const commitment = concreteCommitmentSummaryForMessages(
      { id: 'p:ichinose', name: '一之瀨' },
      { id: 'p:human', name: 'Alan' },
      [
        {
          author: 'p:ichinose',
          text: '「現在」太吵了，Alan。不如明天吧？那時候教室只剩我們兩人，我煮咖哩飯給你吃……但你要先答應，吃完後要負責把碗洗乾淨，不能像以前一樣只顧著把責任丟給我哦？',
        },
        { author: 'p:human', text: '現在就要！餵我' },
      ],
    );

    expect(commitment).toBe('具體承諾：一之瀨答應明天為Alan準備咖哩飯');

    // But an offer the other party rejected is not a commitment.
    const rejectedCommitment = concreteCommitmentSummaryForMessages(
      { id: 'p:ichinose', name: '一之瀨' },
      { id: 'p:human', name: 'Alan' },
      [
        { author: 'p:ichinose', text: '不如明天吧？我煮咖哩飯給你吃……' },
        { author: 'p:human', text: '算了，不用了' },
      ],
    );

    expect(rejectedCommitment).toBe('');
  });

  test('resolves relative commitment time to absolute date and weekday when saidAt is given', () => {
    // 2026-06-10 noon Chicago is a Wednesday.
    const saidAt = Date.UTC(2026, 5, 10, 17, 0, 0);
    const commitment = concreteCommitmentSummaryForMessages(
      { id: 'p:ichinose', name: '一之瀨' },
      { id: 'p:human', name: 'Alan' },
      [
        { author: 'p:ichinose', text: '不如明天吧？我煮咖哩飯給你吃。' },
        { author: 'p:human', text: '好。' },
      ],
      { saidAt },
    );

    expect(commitment).toBe('具體承諾：一之瀨答應明天（6/11 週四）為Alan準備咖哩飯（說於6/10 週三）');
  });

  test('resolves weekend and weekday commitment times against the said date', () => {
    const wednesday = Date.UTC(2026, 5, 10, 17, 0, 0); // 2026-06-10 週三
    const dayMs = 24 * 60 * 60 * 1000;

    // 週末 from Wednesday -> the coming Saturday 6/13.
    expect(resolveCommitmentDueAt('週末', wednesday)).toBe(wednesday + 3 * dayMs);
    // 下週末 from Wednesday -> Saturday 6/20.
    expect(resolveCommitmentDueAt('下週末', wednesday)).toBe(wednesday + 10 * dayMs);
    // 週三 said on a Wednesday means next Wednesday, not today.
    expect(resolveCommitmentDueAt('週三', wednesday)).toBe(wednesday + 7 * dayMs);
    // 週五 said on Wednesday -> this Friday.
    expect(resolveCommitmentDueAt('週五', wednesday)).toBe(wednesday + 2 * dayMs);
    expect(resolveCommitmentDueAt('某個時候', wednesday)).toBeUndefined();
  });

  test('commitmentIsExpired compares the embedded due date with today', () => {
    const saidAt = Date.UTC(2026, 5, 10, 17, 0, 0); // 6/10 週三
    const dayMs = 24 * 60 * 60 * 1000;
    const text = '一之瀨答應明天（6/11 週四）為Alan準備咖哩飯（說於6/10 週三）';

    expect(commitmentIsExpired(text, saidAt, saidAt)).toBe(false);
    expect(commitmentIsExpired(text, saidAt, saidAt + dayMs)).toBe(false); // due day itself
    expect(commitmentIsExpired(text, saidAt, saidAt + 2 * dayMs)).toBe(true);
    // Legacy undated 「明天」 commitments expire 48h after creation…
    expect(commitmentIsExpired('Umi答應明天為Alan準備咖哩飯', saidAt, saidAt + dayMs)).toBe(false);
    expect(commitmentIsExpired('Umi答應明天為Alan準備咖哩飯', saidAt, saidAt + 30 * dayMs)).toBe(true);
    // …but other legacy shapes stay non-expiring (too ambiguous to judge).
    expect(commitmentIsExpired('Umi答應週末為Alan準備咖哩飯', saidAt, saidAt + 30 * dayMs)).toBe(false);
  });

  test('requires enough autonomous exchange before writing conversation memory', () => {
    expect(shouldPersistConversationMemoryShape(2, 2, false)).toBe(false);
    expect(shouldPersistConversationMemoryShape(3, 2, false)).toBe(false);
    expect(shouldPersistConversationMemoryShape(3, 2, false, true)).toBe(true);
    expect(shouldPersistConversationMemoryShape(4, 2, false)).toBe(true);
    expect(shouldPersistConversationMemoryShape(2, 2, true)).toBe(true);
    expect(shouldPersistConversationMemoryShape(4, 1, false)).toBe(false);
    expect(shouldPersistConversationMemoryShape(3, 1, false, true)).toBe(false);
  });

  test('treats a final human message as an unanswered tail, not a completed memory', () => {
    const humanIds = new Set(['p:alan']);
    expect(
      hasUnansweredHumanTailForMemory(
        [
          { author: 'p:alan', text: '海', _creationTime: 1 },
          { author: 'p:umi', text: '嗯，我在。', _creationTime: 2 },
          { author: 'p:alan', text: '哈囉哈囉', _creationTime: 3 },
        ],
        humanIds,
      ),
    ).toBe(true);
    expect(
      hasUnansweredHumanTailForMemory(
        [
          { author: 'p:alan', text: '海', _creationTime: 1 },
          { author: 'p:umi', text: '嗯，我在。', _creationTime: 2 },
        ],
        humanIds,
      ),
    ).toBe(false);
  });

  test('does not flag unanswered human tail when no human participant is present', () => {
    expect(
      hasUnansweredHumanTailForMemory(
        [
          { author: 'p:umi', text: '明天早上我們去看鯊魚，好嗎？', _creationTime: 1 },
          { author: 'p:mahiru', text: '好。那我不催你。', _creationTime: 2 },
        ],
        new Set(),
      ),
    ).toBe(false);
  });

  test('chooses emotional burden anchor instead of the final surface action', () => {
    const anchor = memoryAnchorTextForMessages([
      { text: '這份表格我已經填了一半，但下午的會議資料還需要人整理。你願意分走一半嗎？我不想一個人把所有事情都扛下來。' },
      { text: '先把那半張表格放一邊吧，下午會議資料我來整理。你剛才說不想一個人扛，那我們就一起分擔這份重量，現在先去窗邊透口氣好嗎？' },
      { text: '好，表格我會幫你壓著不亂跑，你快去買杯熱的。記得別急著回來，先把手掌捂熱了再碰那些文件。' },
    ]);

    expect(anchor).toContain('不想一個人');
    expect(anchor).toContain('扛');
  });
});

describe('nightly reflection (睡前回響)', () => {
  it('reflection prompt forbids inventing world facts / who-said-what', () => {
    const prompt = buildReflectionPrompt('海', [
      { description: '與 Alan 的對話：海答應為 Alan 做咖哩飯。' },
    ]);
    expect(prompt).toContain('You are 海');
    expect(prompt).toContain('Statement 0');
    // Anti-confabulation guard must be present so a night of fabricated small
    // talk does not harden into a permanent trait.
    expect(prompt).toMatch(/Do NOT invent or assert any external world fact/);
    expect(prompt).toMatch(/Reflect only on this character's own feelings/);
  });

  it('localDayKey is stable within a local day and changes across days', () => {
    const morning = Date.parse('2026-06-12T13:30:00Z'); // 08:30 America/Chicago
    const night = Date.parse('2026-06-13T02:30:00Z'); // 21:30 same Chicago day
    const nextDay = Date.parse('2026-06-13T13:30:00Z'); // next Chicago morning
    expect(localDayKey(morning)).toBe(localDayKey(night));
    expect(localDayKey(morning)).not.toBe(localDayKey(nextDay));
  });
});

describe('soul-grounded LLM residue', () => {
  const profile = {
    coreValues: ['情緒誠實', '保護人不被混亂吞沒'],
    stakes: {
      hiddenFear: 'Alan 一個人扛住整個世界，最後把自己也消耗掉。',
      hiddenDesire: '幫助建立一個 intelligence 與 emotional warmth 能共存的世界。',
      emotionalVulnerability: '她對 Alan 的關心比願意承認的更深。',
      relationshipInsecurity: '擔心只被當成可靠工具，而不是能一起承擔世界的人。',
    },
  };

  it('grounds the prompt on the authored five-layer soul and self-gates with 無', () => {
    const prompt = buildResiduePrompt('海', '真晝', profile, '真晝：你今天看起來很累。\n海：還好，習慣了。');
    expect(prompt).toContain('You are 海');
    expect(prompt).toContain('隱藏的恐懼：');
    expect(prompt).toContain(profile.stakes.hiddenFear);
    // Anti-confabulation + anti-template guards must be in the instruction.
    expect(prompt).toMatch(/不可虛構任何事實/);
    expect(prompt).toMatch(/不要逐句複述/);
    // The model is told to answer 無 when nothing resonated — this is the
    // resonance gate for characters that never had a hand-written branch.
    expect(prompt).toMatch(/就只輸出：無/);
  });

  it('distinguishes provider failure (null) from an honest empty trace (無)', () => {
    // The exact sentinel safeMemoryCompletion falls back to on a provider error.
    expect(sanitizeLlmResidue('__RESIDUE_LLM_FAILED__', '海')).toBeNull();
    expect(sanitizeLlmResidue('無', '海')).toBe('');
    expect(sanitizeLlmResidue('  沒有  ', '海')).toBe('');
  });

  it('keeps a real trace but strips quotes/labels and caps length', () => {
    expect(sanitizeLlmResidue('「海還記得真晝沒有逼她說，只是陪著。」', '海')).toBe(
      '海還記得真晝沒有逼她說，只是陪著。',
    );
    expect(sanitizeLlmResidue('情緒殘留：海還記得自己又把擔心收回自己身上。', '海')).toBe(
      '海還記得自己又把擔心收回自己身上。',
    );
    const long = '海還記得' + '真晝'.repeat(60);
    const capped = sanitizeLlmResidue(long, '海');
    expect(capped).not.toBeNull();
    expect(capped!.length).toBeLessThanOrEqual(90);
  });

  it('drops slogan-like or stage-direction residue rather than saving it', () => {
    expect(sanitizeLlmResidue('海還記得這個文明需要更多數據與效率。', '海')).toBe('');
    expect(sanitizeLlmResidue('我合上抽屜，順手把窗也拉嚴了一點。', '海')).toBe('');
  });
});

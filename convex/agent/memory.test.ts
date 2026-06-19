import {
  COMMITMENT_FULFILLED_MARKER,
  RECALL_CORRECTED_MARKER,
  buildReflectionPrompt,
  buildResiduePrompt,
  buildSubjectiveSummaryPrompt,
  carriedOutEmotionForMemory,
  emotionResidueColorZh,
  normalizeReflectionInsightForPermanentMemory,
  reflectionInsightSafetyReasons,
  stripCommitmentForReflectionInput,
  residueEligible,
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
  subjectiveMemoryAnchorTextForMessages,
  subjectiveMemoryJudgmentForMessages,
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

  test('does not turn rejected curry into a later breakfast commitment', () => {
    const commitment = concreteCommitmentSummaryForMessages(
      { id: 'p:0', name: 'Umi' },
      { id: 'p:human', name: 'Alan' },
      [
        {
          author: 'p:0',
          text: '…那咖哩飯的約定，今天要重新排進日程嗎？',
        },
        { author: 'p:human', text: '先不要咖哩飯了！我們明天一起吃早餐嗎' },
        {
          author: 'p:0',
          text: '好啊。我會把鬧鐘調早十分鐘。……你明天想吃什麼？',
        },
        { author: 'p:human', text: '你準備什麼就吃什麼吧？你有建議嗎' },
        {
          author: 'p:0',
          text: '要不，我們把吐司烤脆一點，再淋點蜂蜜？',
        },
        { author: 'p:human', text: '好！就交給你了～' },
        {
          author: 'p:0',
          text: '我會把吐司烤得剛好脆，蜂蜜淋得不多不少。',
        },
        { author: 'p:human', text: '好，那我們就說好了！' },
      ],
      { saidAt: Date.UTC(2026, 5, 13, 14, 45, 0) },
    );

    expect(commitment).toBe('');
  });

  test('extracts Alan and Umi tomorrow lunch pearl milk tea commitment', () => {
    const saidAt = Date.UTC(2026, 5, 16, 1, 8, 0); // 2026-06-15 20:08 CDT
    const commitment = concreteCommitmentSummaryForMessages(
      { id: 'p:0', name: '海' },
      { id: 'p:human', name: 'Alan' },
      [
        { author: 'p:human', text: '我不要帶便當盒了吧，你可以帶嗎？幫我準備午餐' },
        {
          author: 'p:0',
          text: '……好。我帶便當盒，也帶那罐你說過喜歡的紅椒醬。——但明天午休，你得陪我把咖哩飯煮完。',
        },
        { author: 'p:human', text: '這有什麼問題，再帶上你喜歡的珍珠奶茶？' },
        {
          author: 'p:0',
          text: '……珍珠奶茶？一杯少糖、一杯正常甜。你選哪一杯？',
        },
        { author: 'p:human', text: '我要少糖的，因為跟你一起喝就夠甜了' },
        { author: 'p:0', text: '——明天午休，我們從拆開便當盒開始？' },
        { author: 'p:human', text: '好呀！' },
      ],
      { saidAt },
    );

    expect(commitment).toBe('具體承諾：海答應明天午休（6/16 週二）為Alan準備珍珠奶茶（說於6/15 週一）');
  });

  test('extracts lunch-only commitment when no more specific drink appears', () => {
    const commitment = concreteCommitmentSummaryForMessages(
      { id: 'p:0', name: '海' },
      { id: 'p:human', name: 'Alan' },
      [
        { author: 'p:human', text: '你明天中午可以幫我準備午餐嗎？' },
        { author: 'p:0', text: '可以，我明天中午幫你準備午餐。' },
      ],
      { saidAt: Date.UTC(2026, 5, 16, 1, 8, 0) },
    );

    expect(commitment).toBe('具體承諾：海答應明天午休（6/16 週二）為Alan準備午餐（說於6/15 週一）');
  });

  test('does not turn a bento-box refusal into a bento commitment', () => {
    const commitment = concreteCommitmentSummaryForMessages(
      { id: 'p:0', name: '海' },
      { id: 'p:human', name: 'Alan' },
      [
        { author: 'p:human', text: '我明天不要帶便當盒了。' },
        { author: 'p:0', text: '嗯，那就先不要帶。' },
      ],
      { saidAt: Date.UTC(2026, 5, 16, 1, 8, 0) },
    );

    expect(commitment).toBe('');
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
    expect(
      hasUnansweredHumanTailForMemory(
        [
          { author: 'p:alan', text: '一之瀨', _creationTime: 1 },
          { author: 'p:ichinose', text: '……嗯，這次念對了呢。', _creationTime: 2 },
          { author: 'p:alan', text: '你明天晚上願意跟我去後山看星星嗎？', _creationTime: 3 },
          { author: 'p:ichinose', text: '獵戶座……啊，確實升起來了呢。', _creationTime: 4 },
          { author: 'p:alan', text: '記住了麻，你有約麻', _creationTime: 5 },
        ],
        humanIds,
      ),
    ).toBe(true);
    expect(
      hasUnansweredHumanTailForMemory(
        [
          { author: 'p:alan', text: '晚上好', _creationTime: 1 },
          { author: 'p:umi', text: '晚上好，Alan。', _creationTime: 2 },
          { author: 'p:alan', text: '明天午休見', _creationTime: 3 },
          { author: 'p:umi', text: '嗯，我會記得窗邊的位置。', _creationTime: 4 },
          { author: 'p:alan', text: '今天先這樣吧，晚安', _creationTime: 5 },
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

  test('prefers what the other participant said for subjective fallback memory', () => {
    const messages = [
      { author: 'p:ichinose', text: '你今天的便當盒蓋子沒扣緊喔……要我幫你壓一下嗎？' },
      { author: 'p:sakiko', text: '謝謝，我自己來就好。' },
      { author: 'p:ichinose', text: '嗯…那我幫你按住盒子邊緣，你來扣？' },
      { author: 'p:sakiko', text: '盒蓋邊緣還留著你的指溫……我得去練習室了。' },
    ];

    expect(subjectiveMemoryAnchorTextForMessages(messages, 'p:sakiko')).toContain('指溫');
    expect(subjectiveMemoryAnchorTextForMessages(messages, 'p:ichinose')).toContain('便當盒');
  });

  test('turns ordinary fallback memory into owner-specific subjective judgment, not raw quotes', () => {
    const messages = [
      { author: 'p:ichinose', text: '你今天的便當盒蓋子沒扣緊喔……要我幫你壓一下嗎？' },
      { author: 'p:sakiko', text: '謝謝，我自己來就好。' },
      { author: 'p:ichinose', text: '嗯…那我幫你按住盒子邊緣，你來扣？' },
      { author: 'p:sakiko', text: '盒蓋邊緣還留著你的指溫……我得去練習室了。' },
    ];

    const ichinoseJudgment = subjectiveMemoryJudgmentForMessages(
      { id: 'p:ichinose', name: '一之瀨' },
      { id: 'p:sakiko', name: '祥子' },
      messages,
    );
    const sakikoJudgment = subjectiveMemoryJudgmentForMessages(
      { id: 'p:sakiko', name: '祥子' },
      { id: 'p:ichinose', name: '一之瀨' },
      messages,
    );

    expect(ichinoseJudgment).toContain('祥子');
    expect(ichinoseJudgment).toContain('距離');
    expect(sakikoJudgment).toContain('一之瀨');
    expect(sakikoJudgment).not.toBe(ichinoseJudgment);
    for (const judgment of [ichinoseJudgment, sakikoJudgment]) {
      expect(judgment).not.toContain('便當盒蓋子沒扣緊');
      expect(judgment).not.toContain('盒蓋邊緣還留著你的指溫');
      expect(judgment).not.toContain('「');
    }
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
    expect(prompt).toMatch(/Do NOT preserve prop\/location\/body-detail microfacts/);
    expect(prompt).toContain('exact seconds/counts');
    expect(prompt).toMatch(/Do NOT use quote marks or repeat exact phrases/);
    expect(prompt).toMatch(/Use only current display names/);
  });

  it('F2: strips 具體承諾/date text from the reflection input (no confabulated commitment can harden)', () => {
    const prompt = buildReflectionPrompt('海', [
      { description: '與 Alan 的對話：海覺得被需要。具體承諾：海答應明天幫 Alan 做咖哩飯。' },
    ]);
    // The relational stance stays; the specific commitment/date is gone.
    expect(prompt).toContain('海覺得被需要');
    expect(prompt).not.toContain('具體承諾');
    expect(prompt).not.toContain('咖哩飯');
    expect(stripCommitmentForReflectionInput('我很累。具體承諾：海答應明天交報告。')).toBe('我很累。');
    expect(stripCommitmentForReflectionInput('沒有承諾的普通記憶。')).toBe('沒有承諾的普通記憶。');
  });

  it('blocks prop-heavy or quote-like reflection insights before permanent memory write', () => {
    expect(
      reflectionInsightSafetyReasons(
        'Umi 把「順路」說三次、把紙船挪到抽屜最上層、把沒拆封的考卷留在原處。',
      ),
    ).toEqual(
      expect.arrayContaining([
        'concrete_prop_or_place_microfact',
        'action_stage_direction_fact',
      ]),
    );
    expect(reflectionInsightSafetyReasons('我開始相信真晝的靠近不是催促，而是願意等我慢慢說。')).toEqual([]);
    expect(reflectionInsightSafetyReasons('真晝的靠近讓我第一次覺得，留白也可以被允許。')).toEqual([]);
    expect(reflectionInsightSafetyReasons('我開始相信天澤把選擇權交給我，不是試探。')).toEqual([]);
    expect(normalizeReflectionInsightForPermanentMemory('我確認海的守候不是把『等』說成決定。')).toBe(
      '我確認海的守候不是把等說成決定。',
    );
    expect(normalizeReflectionInsightForPermanentMemory('我對Ichinose的信任變得比較安靜。')).toBe(
      '我對一之瀨的信任變得比較安靜。',
    );
    expect(reflectionInsightSafetyReasons('我願意讓一之瀨走開，因為他離開時會帶走整張傳單。')).toEqual([
      'concrete_prop_or_place_microfact',
    ]);
    expect(reflectionInsightSafetyReasons('他把症狀和地點一起交出來。')).toEqual([
      'concrete_prop_or_place_microfact',
    ]);
    expect(reflectionInsightSafetyReasons('他不再藏起症狀，而是把觀察交給我命名。')).toEqual([
      'concrete_prop_or_place_microfact',
    ]);
    expect(reflectionInsightSafetyReasons('我逐漸放下對麻桜的戒備。')).toEqual([
      'legacy_or_unknown_character_name',
    ]);
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

  const otherPublic = {
    role: '保健室老師 / 校園的安靜照顧者',
    persona: '真晝在別人面前話不多，但很會察覺誰沒說出口的疲憊。',
    communicationStyle: '輕聲、不逼問，先陪著再說。',
  };

  it('grounds the prompt on my Private Self and the other party Public Self, self-gating with 無', () => {
    const prompt = buildResiduePrompt(
      '海',
      '真晝',
      profile,
      otherPublic,
      '真晝：你今天看起來很累。\n海：還好，習慣了。',
    );
    expect(prompt).toContain('You are 海');
    // My private interior.
    expect(prompt).toContain('隱藏的恐懼：');
    expect(prompt).toContain(profile.stakes.hiddenFear);
    // The other party's public surface — the trace must connect to what THEY did.
    expect(prompt).toContain('真晝 的角色：');
    expect(prompt).toContain(otherPublic.communicationStyle);
    // De-philosophise guards: grounded observation, no aphorisms, no projecting
    // the other party's unspoken interior.
    expect(prompt).toMatch(/不要用「原來/);
    expect(prompt).toMatch(/不要替 真晝 臆測/);
    // Anti-confabulation + anti-template guards must be in the instruction.
    expect(prompt).toMatch(/不可虛構任何事實/);
    expect(prompt).toMatch(/不要逐句複述/);
    // The model is told to answer 無 when nothing resonated — this is the
    // resonance gate for characters that never had a hand-written branch.
    expect(prompt).toMatch(/就只輸出：無/);
    // Stage ① inversion: 無 is a FIRST-CLASS outcome, not a buried escape hatch.
    // The prompt must lead with "decide whether anything stuck", say most
    // ordinary conversations leave nothing, and prefer 無 over forcing a
    // low-weight micro-tell. Without this, the thin-situation substrate makes
    // the model always grab a micro-prosodic detail (the 本末倒置 we observed).
    expect(prompt).toMatch(/有沒有真的.*留下一點分量/);
    expect(prompt).toMatch(/大多數平常的對話其實不會/);
    expect(prompt).toMatch(/寧可常常是「無」/);
    // The micro-body-movement rule now routes to 無 rather than to "use it only
    // when meaningful" — the default for a micro-tell is now to drop it.
    expect(prompt).toMatch(/當成預設殘留.*直接輸出「無」/s);
  });

  it('gives each character a distinct residue lens so traces do not collapse onto one template', () => {
    const umiPrompt = buildResiduePrompt('海', '貓貓', profile, otherPublic, '貓貓：你的手在抖。');
    const maomaoPrompt = buildResiduePrompt('貓貓', '海', profile, otherPublic, '海：我幫你收好。');
    // Each soul is told what KIND of detail it tends to notice...
    expect(umiPrompt).toContain('有沒有真的需要你'); // 海: usefulness / being-needed
    expect(maomaoPrompt).toContain('被忽略的症狀'); // 貓貓: the hidden symptom
    // ...and they are NOT the same lens.
    expect(umiPrompt).not.toContain('被忽略的症狀');
    expect(maomaoPrompt).not.toContain('有沒有真的需要你');
    // The anti-fixed-template guard is present.
    expect(umiPrompt).toMatch(/避免每次都用同一種固定句式/);
  });

  it('still builds a valid prompt when the other party has no authored profile', () => {
    const prompt = buildResiduePrompt('海', 'Alan', profile, null, '海：你又熬夜了。');
    expect(prompt).toContain('You are 海');
    expect(prompt).not.toContain('的角色：');
    expect(prompt).toMatch(/就只輸出：無/);
  });

  it('grounds the first-person summary on the speaker Private Self', () => {
    const grounded = buildSubjectiveSummaryPrompt('海', 'Alan', profile);
    expect(grounded).toContain('You are 海');
    expect(grounded).toContain('隱藏的恐懼：');
    expect(grounded).toContain(profile.stakes.hiddenFear);
    // Grounded, de-philosophised: no "原來" aphorisms, no projecting the other.
    expect(grounded).toMatch(/不要用「原來/);
    expect(grounded).toMatch(/不要替 Alan 臆測/);
    // Inversion follow-up: after residue went 無-first, the micro-tell relocated
    // into the subjective summary memory (喉結動了一下 ×3 in one runtime batch).
    // The summary must redirect AWAY from micro-body-tells toward substance
    // (choice/words/decision), or it becomes the new template treadmill.
    expect(grounded).toMatch(/不要習慣性地把記憶寫成「喉結動了一下」/);
    expect(grounded).toMatch(/那是模板，不是記憶/);
    // Without a profile it still produces a valid plain first-person prompt.
    const plain = buildSubjectiveSummaryPrompt('海', 'Alan', null);
    expect(plain).toContain('You are 海');
    expect(plain).not.toContain('隱藏的恐懼：');
  });

  it('④→③: the carried-out emotion colors residue + summary, neutral adds nothing', () => {
    // A guarded vs calm 海 must NOT remember identically (the missing loop edge).
    const guarded = buildResiduePrompt('海', '天澤', profile, null, '天澤：你今天很安靜。', 'guarded');
    const calm = buildResiduePrompt('海', '天澤', profile, null, '天澤：你今天很安靜。', 'calm');
    expect(guarded).toContain('防備、留了距離');
    expect(calm).toContain('平靜、放下了一些');
    expect(guarded).not.toEqual(calm);
    // It's a coloring nudge, not a fact to write out.
    expect(guarded).toMatch(/不要把這個狀態直接寫進殘留/);
    // neutral / unknown → no mood line at all (a flat mood must not add noise).
    const neutral = buildResiduePrompt('海', '天澤', profile, null, '天澤：你今天很安靜。', 'neutral');
    const none = buildResiduePrompt('海', '天澤', profile, null, '天澤：你今天很安靜。');
    expect(neutral).toEqual(none);
    expect(neutral).not.toContain('心裡的狀態偏向');
    // Same for the subjective summary path.
    const worriedSummary = buildSubjectiveSummaryPrompt('海', 'Alan', profile, 'worried');
    expect(worriedSummary).toContain('擔心、心還懸著');
    expect(buildSubjectiveSummaryPrompt('海', 'Alan', profile, 'neutral')).toEqual(
      buildSubjectiveSummaryPrompt('海', 'Alan', profile),
    );
    // The mapping itself: neutral/garbage → null, the 7 felt states → a phrase.
    expect(emotionResidueColorZh('neutral')).toBeNull();
    expect(emotionResidueColorZh(undefined)).toBeNull();
    expect(emotionResidueColorZh('tired')).toBe('疲憊、想少扛一點');
  });

  it('④→③: current transcript emotion beats stale profile emotion for memory coloring', () => {
    expect(
      carriedOutEmotionForMemory('Alan 說他喜歡你，海心跳快了一下，臉紅到不太敢看。', 'smiling'),
    ).toBe('flustered');
    expect(
      carriedOutEmotionForMemory('只是普通打招呼，沒有明顯情緒轉折。', 'worried'),
    ).toBe('worried');
    expect(carriedOutEmotionForMemory('只是普通打招呼，沒有明顯情緒轉折。', null)).toBeNull();
  });

  it('lets a pilot carry a residue from talking to a pilot OR to the human Alan', () => {
    // pilot ↔ pilot
    expect(residueEligible({ name: '海' }, { name: '天澤' })).toBe(true);
    // pilot ↔ Alan (human): the character still carries a soul-trace from Alan.
    expect(residueEligible({ name: '海' }, { name: 'Alan', human: 'p:alan' })).toBe(true);
    // Alan has no agent, so the human side never writes a residue.
    expect(residueEligible({ name: 'Alan' }, { name: '海' })).toBe(false);
    // a non-pilot other who is not human earns no residue.
    expect(residueEligible({ name: '海' }, { name: '路人' })).toBe(false);
    // self must differ from other.
    expect(residueEligible({ name: '海' }, { name: '海' })).toBe(false);
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
    // Fiction-break guard: Alan's persona ("人類玩家") must not leak into a trace.
    expect(sanitizeLlmResidue('海還記得 Alan 終究是個忙著搭 AI world 的人類玩家。', '海')).toBe('');
  });
});

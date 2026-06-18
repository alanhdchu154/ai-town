# Codex Task — Close the Soul Loop: Event → Emotion → Dialogue → Character Development

Time anchor: 2026-06-18 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Owner: Codex (hard/structural work). CC did the simple prompt fixes; CC returns to review each phase.
Mode: Phased program — land + let Alan review between phases.
Status: ready_for_codex

## Task ID

underworld-soul-loop-events-and-development-20260618

## Architecture / Why

Soul loop: ①event → ②speech → ③memory → ④emotion → (colors next speech).
Forward edges work. After a 3-agent review (2026-06-18), two feedback edges are
still OPEN, and Alan wants a richer event model on top:

- **①→④ event→emotion: missing.** `moodEvents` only become prompt TEXT; they
  never patch `currentEmotion`. The only event→emotion wiring is a brittle
  keyword block (`convex/school.ts:1051-1067`) that almost never matches real
  bulletin descriptions.
- **④→③ emotion→memory: missing.** `rememberConversation` never reads
  `currentEmotion`; a guarded 海 and a calm 海 remember the same exchange
  identically.
- **No decay / no arbitration / not observable.** Emotion is last-writer-wins,
  never relaxes, and there is no structured log to chart it.

Alan's sharpened intent (2026-06-18 chat):
- **小物件:** characters must NOT invent objects, and must NOT route emotion
  THROUGH an object at all. Objects appear ONLY when literally functional
  (遞考卷, 提醒便當沒吃, 桌上那隻貓). Emotion is expressed like a real person
  (直接講 / 沉默 / 岔到一件實際的事 / 開玩笑 / 換話題).
- **event:** wants CONCRETE, character-specific life events with clear valence
  (天澤 考試一百分→開心; 今天是誰的生日→大家有反應) — not the current ambient
  mood atmosphere. And these should reach all three layers below.
- **Chosen scope: all three layers, including character development.**

## Already done by CC — DO NOT redo (only the PROMPT side)

In `convex/agent/conversation.ts`:
- `plainSpeechRule` (~:1595): bans object-as-emotion metaphor; objects are
  functional-only; emotion expressed like a real person. (prompt-only)
- `characterFlawRule` (~:1601/:1606): 天澤 "危險的問題用最直白一句問出來，不要
  包裝成物件意象"; 海 "盔甲是普通提醒，不是系統/流程的比喻".
- `bindingRule` (:1644) + continue-mode line (:1694): removed the
  "岔開到一個小物件 / 用小物件繞開" instructions that contradicted the above.

These are PROMPT-only. Codex adds the ENFORCEMENT detector (Phase A2) and the
SCENE-prop supply (Phase A1) so the rule has teeth and ② has real props to use.

## Phases (priority order; land + review between each)

### Phase A — Ground objects in the real scene (小物件根治)
- **A1.** Make the scene supply real, present, FUNCTIONAL props. Extend
  `data/schoolLocations.ts` / the `sceneContext` builder so each scene hands the
  prompt a short list of "此刻在場、真的能被使用的具體道具", and constrain ② to
  only reference those (or none). Root cause of invented 橡皮擦/窗簾 is that ①
  gives no real props.
- **A2.** Object-as-emotion DETECTOR (teeth for CC's prompt rule). In
  `sanitizeUmiMahiruPilotLine` (~`conversation.ts:3246`), detect the simile
  CONSTRUCTION, not specific nouns: a comparison connective binding a concrete
  physical noun to an emotional/temporal beat (e.g. `像…的那[數字]秒`,
  `像你剛(才|說)…時`, `就像…一樣`) → `[ABORT_CONVERSATION]`. Add unit tests
  (this module is well-tested). Generalizes past the 橡皮擦/窗簾 whack-a-mole.

### Phase B — Concrete character life-events (the new event model) + ①→④
- **B1.** New event type: a character life event carrying
  `{ actorName, type ('考試'|'生日'|'比賽'|'社團'|'成果'|…), valenceZh,
  emotion (PortraitEmotion), affectedNames[], developmentHook }`. Author a small
  seed set — real, character-specific, clear valence (e.g. 天澤 考試一百分→
  `smiling`; X 的生日→大家). Keep it data-driven like `moodEvents`.
- **B2.** Layer 1 (①→④ 即時情緒): when such an event is emitted, call
  `updateEmotionByName` (`convex/school.ts:890`, the single choke-point) for the
  actor + `affectedNames`. RETIRE / replace the brittle keyword block
  (`school.ts:1051-1067`). **This changes live emotion behavior Alan is
  observing — land it, then pause for Alan review before going further.**
- **B3.** Layer 2 (①→② 進對話): the event becomes a TOPIC. Feed it into the
  recent-events / sceneContext channel the speech prompt already reads so others
  can congratulate / tease / mention it naturally (not as narration).
- **B4.** Emotion DECAY: on the existing clock/day tick, relax `currentEmotion`
  toward `calm`/`neutral` after N in-world hours unless reinforced. Stops stuck
  emotion. (Currently NONE — grep decay/衰減 finds nothing.)
- **B5.** ARBITRATION: tag each emotion write with an intensity (event
  `importance` or cue score); overwrite only when stronger or sufficiently more
  recent. At minimum fix the silent clobber where the keyword block overrode
  `applyPressureToCharacters` within one event.

### Phase C — Character development (Layer 3 — deepest, NEW)
- **C1.** Accumulation mechanism: events DRIFT long-term character state
  (trait leanings / relationship deltas / recurring concerns) — NOT overwriting
  momentary `currentEmotion`, but slowly shaping a baseline. E.g. repeated
  boundary-tests → more `guarded` baseline; birthday remembered → more trust
  toward that person.
- **C2.** Storage + use: a per-character development state/log (distinct from
  `currentEmotion`). Feed a short digest into the speech prompt as LONG-TERM
  coloring, separate from the short-term emotion line.
- **C3.** Keep it BOUNDED and observable — do not create another unbounded table
  (see the crash lesson in Phase F). Decay/cap old drift.

### Phase D — Make fluctuation visible (the dashboard Alan asked for)
- **D1.** Add an `emotionChanges` structured table, written from the single
  choke-point `updateEmotionByName`:
  `{ worldId, name, previousEmotion, emotion, reasonZh,
  causeKind ('conversation'|'event'|'pressure'), causeEventId?, day, clock,
  createdAt }` + worldId/day indexes.
- **D2.** `recentEmotionChanges` query — mirror `recentSpeechIntrospection`
  (`convex/school.ts:4196`).
- **D3.** `EmotionFluctuationDashboard.tsx` — mirror
  `src/components/SpeechIntrospectionDashboard.tsx`: per-character timeline,
  each chip = one change (tooltip = `reasonZh` + linked event), left=event →
  right=emotion + `behaviorSignalForEmotion` gloss. Add as a sibling/sub-tab of
  the 內省 view (`src/App.tsx`, `src/components/Game.tsx`).

### Phase E — ④→③ emotion→memory (close the other open edge)
- **E.** Pass the speaker's `currentEmotion` into `buildResiduePrompt` and
  `buildSubjectiveSummaryPrompt` (`convex/agent/memory.ts`) as ONE line:
  "你現在心情偏向 X；讓它影響你*注意到*什麼，但不要直接寫出來." So a guarded 海
  and a calm 海 remember differently. Cheap, high narrative payoff.

### Phase F — Honest memory/forgetting items (lower priority; needs Alan decision)
- **F1.** Forgetting is INERT: `archiveDormantEmbeddings` (`school.ts:4069`) has
  NO scheduled caller, budget ≤200/call vs ~150k docs/day, and the crash root
  cause is the no-GC version HISTORY of the search index — archiving (delete + 2
  inserts + patch) ADDS churn. Reframe honestly: it is NOT the near-term crash
  fix; the real fix is the unbounded-embeddings ticket (#41). Alan to decide:
  cron it anyway / loosen thresholds / defer to #41.
- **F2.** Before flipping nightly reflection to WRITE: reflections are
  never-forgettable + never-vacuumed = a permanent unbounded memory class; the
  reflection input still includes `具體承諾：` / date text that could harden a
  confabulated commitment outside the recall-correction net. Address first.
- **F3.** `insertMemory`: add a `conversationId` idempotency guard (residual
  double-write on the re-archive/backfill path; the experience log already
  dedupes, the core memory does not).

## Hard constraints

- Phase by phase. Land, typecheck + tests + build, THEN let Alan review. Do not
  chain all phases blind.
- Do NOT break v0.1 data collection.
- Do NOT create new unbounded tables without a forgetting/TTL/decay plan — this
  is the crash lesson (no-GC version history). Applies to `emotionChanges` and
  the Phase C development state.
- Compaction stays separate; do NOT touch launchd / system automations.
- Keep emotion expressed like a real person — never re-introduce object-as-
  emotion (Phase A is the whole point).

## Suggested commands

```bash
git status --short
npx tsc --noEmit --pretty false
npm test -- convex/agent/conversationEmotion.test.ts
npm run build
git diff --check
```

## Expected output (per phase)

1. Files changed.
2. What the phase wired and how it avoids over-triggering / unbounded growth.
3. Tests added/updated + results.
4. What Alan should watch in-world before the next phase.

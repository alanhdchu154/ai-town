# GIIS Underworld v0.1 Roadmap

Last updated: 2026-06-11 (late morning — Alan/海 pass evidence + role-to-role mirror QA + v0.2 draft)

This file is the current v0.1 contract. Historical shipped work belongs in git
history and reports, not in the active roadmap.

## 2026-06-10 Late Evening Session (Claude) — for Codex alignment

Driven by three live Alan playtests (海 12:48 / 21:04, 一之瀨 20:16). Voice
differentiation is no longer the v0.1 bottleneck; the memory layer was. All
changes verified by `tsc`, unit tests (memory / commitmentPrompt / motif guard),
and script self-tests; live behavior confirmed in a real chat where 海
unprompted acknowledged the missed curry promise.

**Eval framing (was `eval_rubric_disagreement`, now adjudicated):** both
harnesses are right — soul-triad sees improved differentiation, recent eval sees
a real cross-speaker motif loop. Verdict + open proposals in
`evals/conversations/reports/soul-rubric-reconciliation.md` (2026-06-10
section). Failure-category mislabel fixed in `runRecentConversationEval.ts`
(mirror-repetition now labeled as such, not "not responding"). Motif guard
gained three families: 涼掉的飲食, 先停/先別推, 伺服器/螢幕隱喻.

**Commitment system (`convex/agent/memory.ts` + `conversation.ts`):**
- Write: relative times resolve to absolute date+weekday（「答應明天（6/11 週四）…（說於6/10 週三）」）.
- Direction: promiser = the offerer, not whoever said 「好」.
- Offer-based extraction: an unrejected first-person offer counts even with no
  explicit acceptance (the lost 一之瀨 curry promise, c:94554).
- Read: dedicated 150-row commitment scan (was buried in the residues'
  take(24) all-partner window — 海's 6/4 curry promise was present at
  importance 7 but unreachable). Expired promises surface with
  「已過了說好的時間」 instruction; legacy undated 「答應明天」 expires 48h
  after creation.
- Still open: fulfilled-marking (expiry exists, fulfillment detection does not);
  importance-weighted recall for residues (commitments solved, residues still
  recency-only).

**Anti-confabulation:**
- Retroactive down-weight: an in-conversation correction now stamps matching
  older memories with `RECALL_CORRECTED_MARKER`, zeroes importance, and hides
  them from read paths. Manual cleanup mutation:
  `school:downweightFalseMemory` (supports dryRun).
- The 6/4 「世界變得太聰明」 fabrication (was evolving across days) and one
  unverified 真晝 claim were cleaned.
- Prompt rule: claiming 「我記得」 requires quoting actual evidence; fabricating
  present objects (「趁它還熱著」 with no curry) is named and banned.
- New read-only audit: `npm run underworld:memory-hygiene` (pollution found to
  be small: 2 suspect rows / 919 scanned; zero legacy-format rows — follow-up
  #2 backfill likely unnecessary, Alan to confirm).
- Principle: 主觀記憶可以錯，關於 Alan 的客觀事實（說過什麼、約了什麼、星期幾）不能錯。

**Transcript visibility:** `underworld:alan-playtest-candidates` gained
`--target=all`; `underworld:rolling-continuity` auto-refreshes that export, so
reviewing Alan chats no longer needs a manual command.

**UI (user-perspective walkthrough of the running app, then fixes in `src/`):**
- VN side-panel mode was built then removed同夜 per Alan's verdict (the
  full-screen conversation view already serves the VN role).
- Fixed: 「大家在：場景(N)」 chips are now clickable camera jumps that never
  move Alan; scene `<select>` tooltip now states it moves Alan; 說話 click
  gives immediate 「正在走向…」 feedback (was ~10s of dead silence); 離開對話
  shrunk from the screen's most prominent full-width bar to a compact
  right-aligned button.
- Observed but deferred: characters clump and name tags overlap (engine-level
  positioning); too many near-duplicate interaction verbs (聊天/聊聊X/說話/
  陪伴/關心近況 all visible at once); conversation-view scene label can lag
  actual positions while characters walk; emotion portrait variants for the
  conversation view are not yet generated (prompts ready in
  `docs/giis-vn-art-spec.md`).

**Remaining v0.1 gates (unchanged):** fresh-window life signals + the real
Alan-facing playtest artifact (五條 checklist). Tomorrow's playtest doubles as
the cross-day commitment test: 一之瀨/海 should surface the curry promise with
the right weekday.

## Paper Track Status (2026-06-10)

- **Paper 1** (feasibility / systems contribution, `docs/paper/arxiv/main.tex`)
  is **submitted to OSF**. Lane 1 is done.
- **Paper 2** (the empirical residue read-on/off study) is **deferred**, not
  started. We have no collected data and no confirmed effect yet. Do not write
  it until: the 24/7 world has accumulated arm-pure on/off data over weeks, a
  read-on vs read-off signal is actually visible, and human-annotation validity
  is checked. Writing earlier just produces more protocol/audit docs.
- The empirical apparatus under `docs/paper/` + `scripts/paper/` is **frozen** —
  do not expand it (it is already over-built: ~17 audit scripts for one
  feasibility paper). Consolidate toward ~4 audits only when Paper 2 is real.
- During the wait the **product is primary**: keep the world running, do the
  Alan playtest, and let continuity / ablation data accumulate as a by-product.

## 2026-06-11 Morning Product Evidence

Alan-facing 海 is currently the strongest v0.1 evidence. The archived
Alan/海 conversation at 09:54 CDT is recorded in
`umi/reports/alan-facing-v01-playtest-latest.md` as `Verdict: PASS` across all
five checklist rows: greeting binding, latest-sentence binding, correction
binding, yesterday/today continuity, and closing/idle boundary. Caveats remain
non-blocking for that specific human-facing sample: curry direction drift,
one simplified-character leak, and the Friday 2026-06-12 cross-day curry recall
still needs a live check.

All-character dialogue is not yet complete. Fresh 10:07-10:29 CDT probes show
that the old 天澤/一之瀨 transaction loop improved after prompt/source hygiene
and pilot-path repair (`利息` / `付費` / `交換` / `免費午餐` are now guarded in
the actual sanitizer path), and soul-triad often scores the pair `PASS 1.00`.
However `eval:conversation:recent` still reports FAIL/WARN because several
samples collapse into concept handoff rather than distinct role action:
一之瀨/天澤 overuses `邊界 / 承認 / 拿走什麼`, 海/真晝 can still loop tea/cup
objects, and natural side samples such as 一之瀨/真晝 can score low on character
voice. Treat this as active v0.1 dialogue QA, not completed readiness.

Late-morning continuation (10:49-11:07 CDT): v0.1-bounded mirror hygiene now
covers the fresh failure shapes seen in natural role-to-role samples:
stage/clothing/light loops, score-sheet/fingertip loops, short quoted echoes
(`溫的？` / `管不到？`), 海/貓貓 tea-diagnosis loops, 海 checklist loops, and
天澤/一之瀨 abstract dismantling / human-debt games, 海/貓貓 schedule/drink/
medical-device relay, and 真晝/祥子 cold-food care loops. This is still active QA, not completion:
fresh natural eval after the patch still produced FAIL rows before the latest
guard additions, and the next required evidence is a post-addition fresh window
with no hard mirror/motif failures across multiple core pairs.

Verification from this continuation:
- `npm test -- convex/agent/conversationMotifGuard.test.ts` (47/47).
- `npx tsc --noEmit --pretty false`.
- Disposable live probes for `Sakiko:Mahiru` and `Tianze:Ichinose` show
  directional improvement (old prop loops replaced by more character-shaped
  moves, soul-triad can pass Tianze/Ichinose), but recent eval has not yet
  cleared the role-to-role mirror gate. This is progress, not completion.

Afternoon continuation (15:00-15:23 CDT): the guard has moved from single
motif words toward fresh pair-specific relay exhaustion. It now blocks stale
repair fallback phrases (`你躲得太明顯了，我今天先不拆`, `這題先放著，看誰先心虛`,
`那你先說，哪一句是真心的`, `可以喔，但這次你要自己選`) from becoming
character voice, adds a final pilot-path quality gate, and covers fresh runtime
failure families:

- 祥子/天澤: rehearsal-confirmation relay, `完美/記錄/翻開`, and
  `裙擺/皺痕/備用裙` stage-clothing loops.
- 一之瀨/真晝: `便當/真心/自己選`, water-boiled-egg care, `布丁/空位`,
  and `一半/真的嗎/表格/分心` food-care loops.
- 貓貓/真晝 and 真晝/祥子: repair phrase relays around bento, bandage,
  no-pressure sitting, and `這一小節`.

Verification after this continuation:
- `npm test -- convex/agent/conversationMotifGuard.test.ts` (60/60).
- `npx tsc --noEmit --pretty false`.
- `git diff --check -- convex/agent/conversation.ts convex/agent/conversationMotifGuard.test.ts docs/giis-v0.1-roadmap.md WORKLOG.md evals/conversations/reports/latest.md`.

Current role-to-role status remains **not complete**. Fresh runtime probes after
the first afternoon patch improved 祥子/天澤 from hard FAIL to WARN in one
sample, but later 一之瀨/真晝 probes still produced hard FAIL rows by finding new
food-object variants. The next improvement should not be an endless list of
food names; it should introduce a higher-level pair+scene policy for restaurant
food-object loops, then prove it with several fresh samples across core pairs.

## v0.2 Draft Direction

v0.2 should not be "more prompts." The likely product jump is making the world
more lived-in and consequence-bearing while keeping v0.1's small emotional loop.

1. **Memory Flow By Recent Windows** — keep the two-hour continuity gate as the
   default recency model. Characters should remember what happened earlier this
   morning / this afternoon without needing a rigid AM/PM split.
2. **Commitment Lifecycle** — fulfilled, missed, rescheduled, and declined
   promises should become first-class states, especially for food/date-like
   promises such as curry.
3. **Daily Life Event Threads** — each school day should seed several ordinary
   events (food, class, dorm, club, hallway, weather, small conflicts) that
   different characters interpret differently; avoid one global plot per day.
4. **Character Initiative And Closing** — idle Alan should trigger bounded
   follow-ups or soft closings, not abrupt silence; characters may approach Alan
   or each other when a memory/commitment makes it natural.
5. **Pair-Specific Relationship Drift** — keep this narrow: store small residues
   and avoid a giant graph. v0.2 should prove a few pair dynamics deepen over
   time before broad expansion.
6. **Dialogue Golden Set** — promote a small all-core-character regression suite
   for mirror/motif loops, with human-readable examples for 海、真晝、天澤、
   一之瀨、貓貓、祥子. Include the exact v0.1 failure families now observed in
   live samples: prop/object relay, stage/light relay, checklist relay,
   diagnosis relay, short quoted echoes, and abstract concept handoff.
7. **Dialogue Acceptance Windows** — v0.2 should not rely on one lucky sample.
   Define a rolling role-to-role quality gate that requires several recent core
   pair conversations to avoid hard mirror/motif failures while still allowing
   low-stakes WARN rows for missing memory callbacks or sample-pending windows.

Non-goal for v0.2: starting a major civilization simulation, large relationship
schema migration, or durable backend object system without a proposal.

## Current Goal

Ship the smallest emotional-continuity loop that makes Underworld feel alive:

```text
conversation -> emotional residue -> memory continuity -> small behavioral consequence -> tomorrow feels different
```

## Active Scope

### 1. Character Soul Expression

- Umi should sound like Alan's coordinator and emotional load reducer.
- Mahiru should notice quiet pain without becoming a generic comfort bot.
- Tianze should pressure-test weak rules without becoming a checklist executor
  or cruelty engine.
- Focus runtime soul work on Umi / Mahiru / Tianze; Convex still addresses
  Tianze through the `Tianze` runtime key.

### 2. Conversation To Emotional Residue

- Meaningful conversations should leave a small human-readable trace.
- Do not model the core loop as numerical emotion dashboards.
- Residue should persist, fade, and resurface when triggered.

### 3. Memory Continuity

- Characters should remember meaningful conversations.
- Old conversations should affect later phrasing, initiative, avoidance, or
  small behavior.
- Memory writes must avoid spam and must not persist fallback/abort pollution.
- v0.1 uses rolling two-hour continuity as the primary recent-memory proof:
  adjacent two-hour windows should show concrete residue -> callback or behavior
  change. AM -> PM remains a broader day-arc cross-check, not the only hard
  completion blocker.
- Recall now has two channels: emotional **residue** (pressure, never quoted) and
  **concrete commitments** (e.g. a promise to make curry), surfaced at read time
  as an actionable "未了的約定" block (added 2026-06-10). Before this, only residue
  was recalled — commitments sat buried in the raw memory dump and were skipped.
- Next memory directions (not yet built), in priority order:
  1. **Commitment lifecycle** — mark a commitment fulfilled/expired once honored
     so stale promises stop resurfacing; let residue fade with age.
  2. **Anti-confabulation** — when the human corrects an invented recall
     (e.g. "不是，我說的是咖哩飯"), down-weight the false memory instead of letting
     the fabrication persist as canon. (Observed: 海 recalled a line she herself
     invented on 6/4.)
  3. **Importance-weighted recall**, not recency-only — use the existing
     `importance` field so a high-importance older memory can still surface.

### 4. Event Thread Continuity

- Today should have small school events that several people can naturally talk
  around from different angles.
- Continuity should not only mean repeating a prior line; it can mean the same
  event creates different residues for different characters.
- Keep this bounded: one current scene event thread, up to three involved
  characters, no giant event engine.

### 5. Human Alan Conversation Quality

- Alan-facing chat with Umi must bind to the latest sentence.
- Simple greetings should receive real greetings before analysis.
- Corrections such as "不是依賴，是喜歡" must not be dodged with unrelated
  analogies.
- Prerequisite (fixed 2026-06-04): Alan-facing chats must be durably recorded so
  the playtest can be judged from evidence, not memory. See "Recently Hardened".

## Recently Hardened (2026-06-04 evening)

- Root cause of `human_chat_not_archived` orphan sessions found and fixed:
  `leaveAlanConversationNow` and `leaveCampus` removed Alan's conversation by
  directly patching `world.conversations`, which bypassed the engine's
  `saveDiff` archival. The transcript and Alan's `chatMessage` timeline events
  were orphaned and never written to `archivedConversations`. This is why
  playtest chats "could not be recorded".
- Archival is now a single shared helper, `archiveDeletedConversation`
  (`convex/aiTown/game.ts`), called by both the engine diff loop and the two
  direct-leave mutations, so a chat is recorded the same way no matter how it
  ends. Covered by unit tests in `convex/aiTown/game.test.ts`.
- Daily-life bulletin content moved out of `convex/school.ts` into
  `data/dailyLifeBulletin.ts` (content vs. logic separation); the day selector
  now wraps cleanly and is unit-tested in `data/dailyLifeBulletin.test.ts`.
- Still open: the wakeWorld fix keeps the engine processing inputs, but verify
  end-to-end that a fresh Alan chat now produces an `archivedConversations` row
  on leave/leave-campus before trusting the playtest gate.

## Current Gates

Keep this minimal. Only two gates block v0.1; everything else is an optional
diagnostic to run when a question comes up, not a ritual to run on a schedule.

Current 2026-06-10 note: rolling two-hour continuity has fresh PASS evidence
from the 18:58 CDT report, but product v0.1 is still not complete. The latest
completion audit is still failed by character-soul/event-thread evidence plus
Alan-facing playtest, and the 20:26 CDT candidate scan found
`NO_COMPLETE_CANDIDATE`. Do not restart broad readiness rituals; use a narrow
eval-framing review and one intentional Alan-facing playtest or explicit defer.

Required for v0.1:

1. `npm run underworld:v01-completion-audit` — the single source of truth.
   Require no `fail`. It internally requires `npm run
   underworld:rolling-continuity` PASS / `continuity_observed` unless
   Alan/product-owner explicitly defers continuity.
2. One real Alan playtest where yesterday is felt inside today's conversation.
   The transcript-durability blocker is fixed, so this is executable: chat, then
   leave, then confirm the conversation appears in `recentConversationEvalData`
   as a real archived conversation (not an `active_conversation_not_archived` /
   orphan session). Record it in `umi/reports/alan-facing-v01-playtest-latest.md`
   and validate with `npm run underworld:alan-playtest-check`.

Optional diagnostics (run on demand, never required to "prove readiness"):
`underworld:observe`, `:life-density`, `:life-signals`, `:alan-chat-archival`,
`:repair-gate`, `:rubric-reconcile`, `:runtime-preflight`, `:am-pm-continuity`.

The heartbeat / afternoon-gate readiness ritual and its cron were retired on
2026-06-05 (scripts deleted; recoverable from git history at commit `a14090d`);
do not reintroduce scheduled "readiness pulse" commits. Use `umi/workload.md`
for active Codex/cc handoffs and `WORKLOG.md` for today / last few days of
verification evidence.

## Deferred

- Large civilization systems
- Giant relationship graphs
- New scenes, factions, lore, or broad character expansion
- Numerical emotion dashboards
- Large memory schema migrations
- Three.js / true 3D
- Full all-NPC LLM expansion
- Major UI redesigns not directly supporting the v0.1 loop

## Working Rule

Before changing behavior, ask:

1. Does this improve character-soul authenticity?
2. Does this create or preserve emotional residue?
3. Does this improve memory continuity without memory spam?
4. Is there fresh evidence, or is the old sample only historical?
5. Does this move a decision forward, or is it ceremony (heartbeat/readiness
   commits) standing in for the one human action that is actually blocking?

## v0.2 Plan (approved by Alan 2026-06-11 evening)

North-star question for v0.2: **"Did yesterday change today?"** — Alan returns,
asks nothing, and can feel from behavior alone that yesterday happened. (v0.1
asked only "is yesterday remembered".)

### Shipped immediately with this plan (the UI/infra slice, 2026-06-11)

- A1 Scene/camera decoupling: manual scene viewing pauses Alan auto-follow
  (the per-second [GIIS focus] yank that made switching feel stuck and caused
  選教室卻到餐廳); 「找到 Alan」 re-enables following.
- A2 Invite UI: compact inline card (was full-screen takeover with hero
  接受/拒絕 bars); panel close button normalized.
- A3 Conversation panel reskinned to the dark VN scene-stage language (was
  legacy brown/cream AI-town).
- F2 Verb consolidation: with a target selected the generic 聊天 hides
  (聊聊 X is the one primary); 關心近況/邀請 fold into 更多互動.
- F3 Human-path quota exemption: Alan-facing replies bypass the shared daily
  cloud quota (cooldown still applies) — pairs with the no-weak-model rule.
- A5 .gitignore for tmp/ and vite timestamp artifacts.
- F1 (partial): emotion-asset wiring verified; generation checklist in
  `docs/giis-emotion-asset-manifest.md` (32 images, prompts in
  giis-vn-art-spec.md). Asset generation runs in Alan's image pipeline.

### Deferred from the UI pass (needs assets/design, not just code)

- Backdrop time-of-day variants (宿舍 shows a moon at 下午4:07 — each scene has
  exactly one render today; needs day/evening/night variants per scene).
- 左上角 chips (海/今日/日程) consolidation into one 「海的校園手帳」 front
  door with tabs 今日動態/日程/約定 — pairs with C1. Current sources for the
  record: 今日 = campusSocialState (dailyFocus + worldEvents + notifications +
  schoolRumors); 日程 = schoolCalendar rhythm + dailyLifeBulletin (curated).

### B. Prop system — props are where yesterday becomes visible

- B1 Per-scene per-day prop STATE, rewritten by character behavior as a
  by-product of conversations/events (考卷「被天澤翻過」, 黑板「真晝擦到一半」).
  The world should look used.
- B2 Commitments pinned to props (curry promise lives on the 餐廳 pot; honored
  /missed changes the prop state).
- B3 Residue bound to props; passing characters can trigger callbacks.
- B4 Alan-interactable props (leave a line on the blackboard; characters react
  tomorrow via bulletin/worldEvents).
- B5 Prop events feed the motif guard (no new prop-echo families).

### C. Promises & schedule (player-facing, in-world — NOT a dev dashboard)

- C1 約定頁 hosted by 海 inside the 校園手帳: all active commitments (who
  promised whom, due day, expired/fulfilled), from the dated-commitment data.
- C2 Fulfillment detection: honored promise → fulfilled mark + relationship
  warmth; missed → disappointment residue. (First real data: the 6/12 Friday
  curry dinner.)
- C3 Soft-correction detection (「是X，不是Y」 phrasing should trigger the
  recall down-weight; today only 不是/記錯 forms do).

### D. Gifts (design decisions, build after B)

- D1 A gift becomes a persistent prop in the receiver's scene — the strongest
  form of visible yesterday. (The 'gift' quick-action type already exists.)
- D2 Effects flow through residue/mentions (「你上次送的筆我還在用」), NOT
  numeric affinity boosts — no gift-shop loop.
- D3 Character-differentiated reactions (一之瀨 prices it, 貓貓 suspects it,
  祥子 flusters) — gifts as a soul-differentiation probe.
- D4 Transaction-language risk watched by the 交易/欠債 motif family.

### E. Memory deepening (progression-ladder mainline)

- E1 Behavioral drift: residue changes initiative/avoidance — from tone to feet.
- E2 Daily diary: 2-3 lines per character per day; cross-day reads consume the
  diary, not raw memory dumps.
- E3 Relationship drift: residue nudges trust/affection in small steps; UI
  shows text trends (最近比較親近/疏遠), never gauges.
- E4 Gossip with provenance: cross-character memory spread carries 「聽海說的」
  source tags (schoolRumors plumbing exists).
- E5 Importance-weighted residue recall (commitments fixed; residues are still
  recency-only).

### Suggested order

A-slice (done) → B1+B2+C1 (props + 約定頁; one week to a visible 「世界記得我」
moment) → C2 (fulfillment, with the curry-dinner data) → E1+E2 → D → E3-E5.

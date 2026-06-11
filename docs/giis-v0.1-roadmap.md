# GIIS Underworld v0.1 Roadmap

Last updated: 2026-06-10 (late evening — memory/commitment overhaul + UI pass; Claude/Cowork session, for Codex alignment)

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

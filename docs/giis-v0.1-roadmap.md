# GIIS Underworld v0.1 Roadmap

Last updated: 2026-05-23 (late)

## 2026-05-24 → 05-30 Plan (next-week work)

Goal: lock down the routing + memory gating we just changed, get a real
soul-depth corpus, and ship the carry-over UI polish so playtests stop
tripping on chrome. Tests pass (55/55) and the working tree is green
heading into the week.

### Monday 2026-05-24 — verify and sample
- Reload the live app, walk through Alan ↔ Umi / CaoCao / Asuna to
  confirm each round goes through LLM, and check Convex logs for
  `skipFallbackOnlyConversation` lines after autonomous NPC↔NPC chats
  end (those should be the ones we now skip writing to memory).
- Re-run `npm run pilot:umi-mahiru:single-sample` once during quiet
  hours; if the autonomous loop still doesn't seed a conversation in
  240s, try `npm run eval:umi-mahiru` directly (which calls the LLM
  without waiting on the agent tick) and archive whatever sample lands.
- Save one Alan ↔ Umi sample for diffing against the NPC ↔ NPC sample;
  this is the corpus pair we will tune prompts against.

### Tuesday–Wednesday 2026-05-25/26 — soul-depth prompt rev
- Run `evals/conversations/runUmiMahiruEval.ts` over the archived
  samples and read the five soul markers
  (`docs/giis-soul-systems-revisit-plan.md`: concrete detail,
  emotional honesty, contradiction tolerance, memory callback, refusal
  of platitudes). Note where each character is weak.
- Make one prompt edit in `convex/agent/conversation.ts`
  (`richUmiMahiruPrompt` for the pilot pair; `companionChatPrompt` if
  Alan ↔ Umi is the weak spot). One change at a time, re-sample, diff
  against the previous corpus. Stop when one marker moves cleanly up.
- DO NOT re-enable `COMPANION_CLOUD_LLM` globally during this loop;
  set `AUTONOMOUS_CONVERSATION_LLM_PAIRS=Umi:Mahiru Shiina` per-run via
  the existing pilot script if more samples are needed against quota.

### Thursday 2026-05-27 — UI follow-ups
- Build the floating action-result card. `actionSummary` /
  `NarrativeResult` still only renders inside the right drawer.
  Either lift it to `Game.tsx` or dispatch a `giis:action-result`
  custom event so the card slides in above the bottom bar for ~6s
  after Alan acts, without forcing the drawer open.
- Inline text input on the bottom action row. Today, text-input
  actions (gift / leaveMessage / announce / createClub) bounce the
  player into the 角色 tab. Add a one-line input that surfaces only
  when one of those is selected, so we keep the bottom flow intact.

### Friday 2026-05-28 — drawer + conversation overlay
- Trim 角色 tab density: the roster + action panel + club registry
  all stack and overflow. Cut what now lives in the bottom bar; the
  drawer should mostly be the roster + "find/travel" controls.
- Open one real conversation and re-check the VN overlay
  (`.giis-conversation-mode` / `.giis-vn-panel`). Confirm it still
  anchors sanely now that the world panel grid is single-column.
- Captures a fresh playtest note (handwritten in `WORKLOG.md`) for
  the next pass.

### Stretch (only if Mon-Fri ran ahead of plan)
- Schedule the 30-min `eval:umi-mahiru:soul-loop` once on Saturday
  under quiet hours to build out the corpus without using daytime
  Qwen quota.
- Audit `convex/agent/memory.ts` `rememberConversation` to see if the
  importance/retention call still makes sense now that we drop
  fallback memories on the floor — possibly tighten the
  `classifyMemoryRetention` thresholds.

### Out of scope (do NOT pick up next week)
- New characters, factions, or scenes.
- Re-enabling cloud LLM globally without an explicit token-budget OK.
- Rewriting the memory architecture (`docs/giis-memory-architecture.md`
  remains the design note; migration not on this sprint).
- Mobile / tablet breakpoint cleanup — user has explicitly said this
  is off the table for the v0.1k window.

## 2026-05-23 Session Tail: Memory Gate + Classroom Auto-Fit + Routing Audit

Done this session:
- Audited conversation routing in `convex/agent/conversation.ts`. Current
  state: Alan ↔ any NPC → LLM (local Ollama; cloud only kicks in if
  `COMPANION_CLOUD_LLM=true`, which is OFF). NPC ↔ NPC → template
  fallback unless `AUTONOMOUS_CONVERSATION_LLM_PAIRS` enables that pair.
  This already matches Alan's "Alan↔ LLM, others fallback" ask, so no
  code change was needed there.
- Added `conversationEligibleForLLM()` helper in `agent/conversation.ts`
  and gated `agent/memory.ts:rememberConversation` on it. NPC↔NPC
  fallback-only conversations are now dropped at the top of the memory
  pipeline with a `skipFallbackOnlyConversation` timing log; they no
  longer pollute character memory with template lines the character
  never "really" said.
- Made `PixiGame.tsx:clampBounds` dynamic. The clamp region now stretches
  horizontally (or vertically) until its aspect matches the stage, so
  the classroom auto-fits the available space at `minScale`. Extra
  padding is pushed onto the right side so the room hugs the left edge
  (drawer overlays scene-toned space, not the room). Caps at 10 tiles
  horizontal / 6 vertical so very wide/tall windows don't inset the
  room into a tiny strip.
- 55/55 unit tests still pass. `npx tsc --noEmit` and `npx vite build`
  both green.

## 2026-05-23 Soul Deepening v0.1k Goal + Token-Outage Fallback

Pivot: cc / codex tokens are exhausted, so the v0.1k goal becomes
**how to deepen the soul of GIIS characters without leaning on a paid
cloud LLM during day-to-day play**. Use the remaining Qwen quota
deliberately for soul-depth sampling, and keep daily-loop conversations
on the local template path so nothing breaks while we iterate.

Captured this session:
- Attempted one Umi↔Mahiru cloud (Qwen) sample via
  `npm run pilot:umi-mahiru:single-sample`. The script applied the
  three pilot-control envs (`UMI_MAHIRU_SINGLE_SAMPLE_AFTER_MS`,
  `UMI_MAHIRU_COLOCATION_PILOT`, `AUTONOMOUS_CONVERSATION_LLM_PAIRS`),
  ran `testing:resume` and `school:coLocateUmiMahiruForPilot`, then
  polled for 240s with 0 fresh archived conversations landing. Result:
  **timed out with no fresh archived Umi/Mahiru sample**. The script's
  `finally` block correctly removed the pilot-control envs and ran
  `testing:stop`. Log preserved at
  `.hatch-pet-runs/umi-mahiru-2026-05-22.log`.
- Likely cause of the empty run (next session, debug before re-running):
  the autonomous loop did not seem to fire a Umi-Mahiru conversation in
  that window. Could be (a) the engine never actually picked up the
  pair after `coLocateUmiMahiruForPilot`, (b) cooldown still active from
  earlier same-day runs, or (c) the daily quota already drained for
  `2026-05-23` UTC. Surface convex logs around the run timestamp before
  the next attempt; also consider seeding via the existing
  `eval:umi-mahiru` harness directly (skips the autonomous-loop wait).
- Switched the day-to-day Alan↔Umi companion path back to template:
  `COMPANION_CLOUD_LLM` removed from Convex env (`npx convex env remove
  COMPANION_CLOUD_LLM`). Alan's private chat now falls back to the
  template `companionFallback` path. Pilot envs (`UMI_MAHIRU_PILOT_*`)
  stay configured so the soul loop can still be triggered manually
  without re-pasting the API key.

Soul-depth work to drive next (v0.1k):
- Bigger sample pool: schedule `pilot:umi-mahiru:single-sample` (or the
  `eval:umi-mahiru:soul-loop` 30-min loop) under quiet hours and archive
  results so we have a corpus to diff prompt edits against.
- Prompt edits should target the same five soul markers tracked by the
  soul-depth eval (specific concrete detail, emotional honesty,
  contradiction tolerance, callback to prior memories, refusal of
  generic platitudes). The eval harness lives in
  `evals/conversations/`; consult `docs/giis-soul-systems-revisit-plan.md`
  for the deeper plan.
- Once a prompt rev shows a clear improvement on the eval, enable the
  cloud path for that pair only by setting
  `AUTONOMOUS_CONVERSATION_LLM_PAIRS=Umi:Mahiru Shiina` (or the
  expansion target) on Convex, not by flipping the global toggle. Keep
  Alan's companion path off until we have a separate prompt rev for it.

Operational rule: do NOT re-enable `COMPANION_CLOUD_LLM` globally
without an explicit token-budget check. Out-of-token fallback should be
the template path, which is now what the running backend is using.

## 2026-05-23 UI Pass: 互動 to Bottom + Right Drawer Slim

Driver: Alan asked to put 互動 at the bottom and keep 對話 on the right; he
also wants less duplicated chrome and a real way to use the floating
left panels one at a time.

Done this session (UI):
- Right drawer tab list trimmed to 對話 + 角色 (debug only with
  `VITE_SHOW_DEBUG_UI`). Default `activeTab` is now `dialogue` so opening
  the drawer goes straight to the conversation surface. The action /
  schedule tabs are gone; their content lives at the bottom or in the
  left column.
- Bottom bar refactored from `status + tiny quick-actions` into a real
  互動列: status chips on top, action pill row below. Scene actions
  always visible; when a target is selected we add `聊聊 {target}`,
  `關心近況`, `問傳聞`, `送禮`, `邀請` plus a `更多互動` link that
  opens the drawer 角色 tab for text-input actions
  (gift/leaveMessage/announce/createClub).
- `actionDescriptions` now ride on each pill's `title` attribute so they
  surface as native tooltips on hover instead of as always-on paragraphs.
- `詳細狀態` `<details>` removed from the bottom bar; the same fields are
  already shown by the topbar / left panels.
- Floating left panels (海 / 校園動態 / 日程) are now mutually
  exclusive: expanding one collapses the other two so they never stack
  on top of each other.
- `FirstRunGuide` (the duplicate "歡迎回來 Alan" card) finished being
  removed; the entry-point copy lives only in 海's briefing.

Carried over to next UI pass:
- **P0** Floating action-result card. `actionSummary` / `NarrativeResult`
  still renders inside the drawer only; lift it (or dispatch via
  `giis:action-result`) so Alan sees his action outcome above the map
  without opening anything.
- **P1** `runQuickAction` opens the drawer for text-input actions. That
  works but loses focus context; consider an inline text input on the
  bottom action row instead of a drawer trip.
- **P1** 角色 tab content is still dense — character roster + action
  panel + club registry all stack. Trim or paginate once we live with
  the new bottom interaction.
- **P2** VN conversation overlay (`.giis-conversation-mode` /
  `.giis-vn-panel`) hasn't been eyeballed against the new layout. Open
  a conversation and confirm the panel still positions sanely.

## 2026-05-22 Switch-style Layout Pass (UI Fit-to-Window)

Driver: Alan reported the UI was hard to use — square map in the middle,
right panel too dense, dark margins around the room from PIXI viewport
panning, no obvious left/center/right separation.

Done this session:
- Shell grid collapsed from `left | world | right` to a single `world`
  column. Right `PlayerDetails` is now an absolutely-positioned drawer
  (collapsed by default, expands as overlay) instead of stealing 28rem of
  width. The 海 / 校園動態 / 日程 buttons float over the left edge of the
  shell instead of occupying a fixed grid column.
  (`src/index.css` `.giis-switch-shell` / `.giis-left-column` /
  `.giis-utility-panel`.)
- PIXI stage no longer fixed to room aspect. It fills the entire world
  panel; the room is anchored to the left via pixi-viewport
  `underflow: 'left'` and clamped to `ClassroomBounds` ± 0.5 tile, so the
  scene-toned `backgroundColor` fills the right-side breathing room which
  is exactly where the right drawer opens into. `minScale` is recomputed
  so the room fits entirely without panning; `maxScale` allows ~2.2× zoom
  for close-ups. (`PixiViewport.tsx`, `PixiGame.tsx`, `Game.tsx`.)
- Replaced the bright blue Stage `backgroundColor` (`0x7ab5ff`) with a
  per-scene tone matching `ClassroomMap.sceneToneFor`, so the canvas no
  longer flashes blue around the room.
- 日程 moved out of the right tab list into a collapsible left-column
  panel (`LeftSchedulePanel` in `Game.tsx`); shows each non-Alan character
  with live location and pathfinding status; clicking a row dispatches
  `giis:navigate-character` to focus the map there.
- Right panel tab list trimmed: `日程` removed (now in left col), `進階`
  hidden unless `VITE_SHOW_DEBUG_UI` is set. `PlayerDetails.tsx`.
- `FirstRunGuide` removed from the right panel — its "歡迎回來 Alan" line
  duplicated 海's briefing on the left.
- Font sizes bumped across topbar / bottom-status / left panels for
  readability (~0.82rem → 0.88-0.92rem on body copy; topbar title to
  1.15rem). Button hit areas slightly larger.

Remaining UI gaps (next pass, in priority order):
- **P0** Right drawer content is still dense. The 互動 tab opens with a
  long character overview + grid; `actionDescriptions` should become hover
  tooltips, not always-on paragraphs.
- **P0** Action result narration (when Alan acts) currently dumps as a
  toast + log. Consider a Switch-style "action result card" anchored over
  the map for ~3s instead of the toast pile.
- **P1** Bottom bar has `.giis-bottom-status` with 3-4 chips + a
  `<details>` for "詳細狀態". Either fold detail into the topbar or drop
  it (most fields already shown elsewhere).
- **P1** Floating left buttons (海/校園動態/日程) currently stack
  vertically at top-left. When 海 is expanded it covers the other two
  buttons; consider letting them slide right or shrink to icons when one
  expands.
- **P2** Right drawer doesn't push the map — it overlays. Decide if we
  want a "split mode" (map shrinks left) for users who want both visible
  while reading dialogue history.
- **P2** Conversation overlay (`.giis-conversation-mode` /
  `.giis-vn-panel`) hasn't been re-checked against the new layout; verify
  the VN panel still positions sanely when the right drawer is also open.
- **P2** Mobile breakpoint (`@media (max-width: 900px)`): the rules still
  reference the old 3-column grid in some places. Audit + simplify now
  that the shell is single-column at all sizes.

## Current State

Status: v0.1 candidate, pending one longer live playtest under normal local LLM load.

The world now has a recognizable school identity: Alan can enter campus, see Umi's briefing, choose characters, view campus feed, switch scenes, and start conversations. The UI is much closer to a Switch-style social sim than the original AI Town dashboard.

It is not v0.1 final yet because the loop still needs stronger smoothness, visible movement, clearer story memory, and more consistently natural conversations.
The core loop is now coherent enough to call a v0.1 candidate: Alan enters, Umi briefs, the player can choose people/actions, campus feed remembers events, Day 2 timing is correct, and debug/repair can restore the seven-character roster. The remaining risk is live responsiveness under local LLM load and longer-form conversation quality.

## 2026-05-22 Start Plan

Operating principle:
- Do not expand systems, factions, lore, or UI architecture.
- Make the existing school feel quieter, more emotionally continuous, and more human.
- Judge success by whether characters feel slightly different tomorrow because today happened.

## 2026-05-22 Targeted LLM Autonomy Pilot

Purpose:
- Move back toward the real "free world" goal without reintroducing local LLM stampedes.
- Keep Alan/Umi human conversations as the highest-value path, but allow one NPC-to-NPC relationship to grow even when Alan is away.
- Treat deterministic autonomous dialogue as scaffolding, not the end state.

Current pilot:
- LLM pair: `Umi:Mahiru Shiina`.
- Env gate: `AUTONOMOUS_CONVERSATION_LLM_PAIRS=Umi:Mahiru Shiina`.
- All other NPC-to-NPC autonomous conversations stay deterministic unless explicitly added to the pair list.
- Global all-NPC LLM remains off: do not set `AUTONOMOUS_CONVERSATION_LLM=true` during this pilot.

Why Umi + Mahiru:
- Umi needs a non-Alan conversation partner so the world can develop while Alan is away.
- Mahiru is the best first partner for testing emotional continuity, student safety, quiet concern, and ordinary school texture.
- This avoids making the first autonomy pilot mainly about faction politics or big-system exposition.

### Pilot Acceleration Plan

Principle:
- Because only one NPC pair can hit the LLM path, we can safely increase daytime conversation throughput.
- Prefer env-only rhythm changes first; do not edit watched conversation code while collecting pilot samples.
- Change a few pacing knobs together only when they all serve the same measurable goal: enough fresh archived conversations to evaluate.

Phase A: start now, env-only:
- Keep `AUTONOMOUS_CONVERSATION_CHANCE_MULTIPLIER=1.0`.
- Restore invite acceptance to the v0.1 default: `INVITE_ACCEPT_PROBABILITY=0.75`.
- Shorten global conversation cooldown for daytime sampling: `CONVERSATION_COOLDOWN_MS=90000`.
- Shorten same-pair cooldown but keep it nonzero: `PLAYER_CONVERSATION_COOLDOWN_MS=180000`.
- Allow slightly fuller scenes: `MAX_CONVERSATION_MESSAGES=6`.

Expected effect:
- More natural invitations during daytime.
- More archived conversations without forcing dialogue.
- Umi/Mahiru gets enough chances to produce LLM samples, while other NPC pairs remain cheap deterministic background texture.

Rollback thresholds:
- If live logs show repeated `conversationLLM` fallback/timeouts for the pilot pair, remove `AUTONOMOUS_CONVERSATION_LLM_PAIRS` first.
- If action churn returns, set `CONVERSATION_COOLDOWN_MS=180000` and `PLAYER_CONVERSATION_COOLDOWN_MS=300000`.
- If deterministic NPC chatter becomes too repetitive before the LLM pilot yields useful samples, lower `AUTONOMOUS_CONVERSATION_CHANCE_MULTIPLIER` to `0.7`.

Do not do yet:
- Do not enable `AUTONOMOUS_CONVERSATION_LLM=true` for all NPCs.
- Do not add new characters, factions, lore, or major UI systems.
- Do not patch prompt or agent code during the first 30-45 minute pilot collection window unless there is a runtime bug.

Fast pilot evaluation:
- For the first 30 minutes, run a lightweight check every 5 minutes: `school:worldClock`, `eval:conversation:recent -- --since-last-change`, and recent archived conversation inspection.
- Keep the "no code change unless evidence supports it" rule: if post-pilot samples are fewer than 5, report the count and keep collecting unless there is a runtime bug.
- For Umi/Mahiru samples, inspect manually as well as with eval.
- Score: latency/fallback, wrong addressee, emotional binding to previous speaker, relationship development, memory outcome, and whether the conversation feels less scripted than deterministic NPC text.
- After 30 minutes or 5+ post-pilot archived conversations, decide whether to keep the 5-minute cadence, roll back to 30-45 minutes, or apply exactly one targeted fix.

Expansion gate:
- Expand to 2-3 LLM pairs only after Umi/Mahiru has at least 5 usable archived samples with no timeout burst and no identity collapse.
- Candidate next pairs: `Umi:Asuna` for operational coordination, `Mai:CaoCao` for strategic tension.
- Restore full NPC LLM only after 2-3 pairs remain stable under longer daytime playtest and p95 response latency is acceptable.

## 2026-05-22 UI Pass + Companion Cloud (Cowork)

(Cowork session, Umi. Layout + path wiring done this session; tsc + modelPolicy tests PASS, but visual layout not yet eyeballed live by Alan.)

- Right panel (`.giis-utility-panel`) widened for readability: 22→28rem (conversation-active 28→34rem, max 23→32rem). `src/index.css`.
- Left side: 海的簡報 + 校園動態 merged into ONE fixed left column (Option A: briefing on top, feed below, scrolls). New `.giis-left-column` flex wrapper in `src/components/Game.tsx`; the two `<aside>`s no longer free-float and no longer spread into the centre map (old rule pushed the feed to `left: 25rem`). Their mutual-exclusion collapse logic was relaxed so both can be open stacked. `src/index.css` + `Game.tsx`.
- Companion path (Alan↔Umi) wired to the same cloud Qwen adapter as the pilot (was on base ollama → `companionFallback` templates). Additive opt-in `COMPANION_CLOUD_LLM`; reuses Codex's `modelPolicy` characterSoul cloud layer + quota guard; companion-specific `COMPANION_PILOT_MODEL` / `COMPANION_PILOT_TIMEOUT_MS` (30s default to avoid timeout→fallback). `convex/agent/conversation.ts` only — modelPolicy untouched. Privacy: 3rd-party proxy now touches Alan's private chat; gate default-off, Alan explicitly approved. Details in WORKLOG.
- Pending: Alan eyeballs the left column live (full-view overlay, collapse pills, bottom overlap with camera dock are the things to check); right-side target/action flow audit (#11) not yet done.

## 2026-05-22 Umi Soul Prompt Target Fix + Prompt-Constraint Audit

(Cowork session, Umi. For the upcoming Codex discussion — this is exactly what changed and why.)

### What changed (applied + typecheck PASS)

Two lines in `richUmiMahiruPrompt()` (`convex/agent/conversation.ts`) were rewritten:

1. `hardLocalPriority` (海 branch, ~L895)
   - Before: 「你可以把話題試著轉去 Alan 或責任，**但同一句內必須露出一個小疲憊訊號**…」
   - After: deflection 是「盔甲」可出現但**不能每一句都這樣**；真晝指名海本人時**至少一句完全停在自己身上、不接 Alan/劉備/簡報/明天**；被照顧那句不准尾隨任務或「明天再說」。
2. `節奏` rhythm line (~L930)
   - Before: 「Mahiru 先看見 Umi 本人 → **Umi 嘗試把話題帶去 Alan/責任** → 同一句露出一個小疲憊或變安靜。」
   - After: 真晝關注一層層累積；海可以先擋一兩次但不要每句都擋；整段**至少一次真正卸下盔甲**（不帶 Alan/劉備/簡報/明天的真話，或一個只屬於此刻的沉默）；明寫「一次裂縫勝過五句客套疲憊」防新模板。

### Root-cause reframe (differs from the original "add a guard" plan)

The bottleneck was NOT a missing guard. The prompt itself **mandated** the deflection: the old rhythm rule literally instructed Umi to pivot to Alan/責任 every turn (with a fatigue tag). Sample `c:38192` is the model obeying that rule perfectly — every Umi line deflects to 劉備/明天 + a fatigue tag (合筆電/放杯子/手放下). So the fix is corrective (rewrite the offending rule), not additive (a new "stay one line" rule, which would have become the next template — the project's recurring failure mode).

Confirmed by code trace: for the pilot pair, the system prompt is **only** `richUmiMahiruPrompt` (conversation.ts L322-324 → `prompt.join('\n')`). The pilot does NOT receive `topicShiftPrompt`, the Layer 1-5 `stakesLayerInstruction`, or the Language-ban stack. So these two lines are the pilot's only lever; nothing else competes.

### Prompt-constraint audit — other places limited the same way

Same class of "forced move every turn → template" bug, found while auditing. NONE currently affect the Umi:Mahiru pilot (it only reads richUmiMahiruPrompt), but they will bite the moment LLM expands to other pairs:

- Secondary reinforcers still inside `richUmiMahiruPrompt` (survived this fix, milder because they are context not hard-rules): `umiMahiruDailyState` 海 → 「容易把自己的疲憊藏進簡報語氣」/「想把風險整理給 Alan」 (~L995/997); `umiMahiruUnresolvedMemory` 海 default → 「Alan 和學生的不安誰來接住」 (~L1024). If the two-line fix does not fully land, these are the next levers — they keep pointing 海 at Alan/簡報.
- `topicShiftPrompt` (~L1094-1111): every character is pinned to ONE signature move — CaoCao always「fears nobody will be responsible」, Asuna always「exhaustion from coordinating」, Mai always「worries Alan doesn't understand」, etc. Run every conversation, each becomes that character's predictable tic. Same flatten, distributed across the cast.
- `stakesLayerInstruction` Layer 5 (~L2757): top of the escalation ladder forces「make a decision / ask Alan for direction / leave with a concrete next action」. That is task-resolution pushed onto the end of every escalating scene — anti-soul for an intimacy/quiet beat, and it routes back to Alan again.

### Open questions for Codex

- Eval alignment: does the binding eval reward「每句都接住一個詞」(which would score deflection-with-tag as binding, explaining 38192 = 0.62 not lower)? Recommend it instead reward「整段至少出現一次卸甲」(one genuine crack), and penalize「全段都在 deflect」. Otherwise the eval re-trains the template.
- Validate on n≥3-5, not on 38192 alone, before/after.
- When expanding LLM beyond Umi:Mahiru, apply the same de-templating to `topicShiftPrompt` and reconsider Layer 5's task-resolution mandate.

## Day / Night Work Split

Reason:
- Character soul work needs real dialogue samples, so it belongs mostly to daytime.
- Night should feel quiet in-world, so engineering cleanup should happen without forcing characters to talk.

Night lane, 22:00-05:59:
- Keep the school quiet; no forced conversation generation.
- Fix app stability, local Convex state, scheduler floods, build errors, and repair tools.
- Polish UI/control-panel layout, portraits, sprites, scene readability, and roadmap notes.
- Improve eval harness and golden archive scaffolding.
- Prepare the next morning checklist and Umi opening focus.

Day lane, 06:00-21:59:
- Let characters naturally produce fresh conversations.
- Run `npm run eval:conversation:recent -- --since-last-change` every 45 minutes.
- During the 2026-05-22 Umi/Mahiru fast pilot, override the normal 45-minute rhythm with the local 5-minute watch for the first 30 minutes, then return to the adaptive cadence unless the evidence says to continue.
- Tune only from new post-fix samples, not old `legacy_noise`.
- Prioritize wrong addressee, fallback loops, emotional binding, relationship chemistry, and behavior consequence.
- Capture genuinely good conversations into the golden archive.

Automation:
- `giis-conversation-watch-loop-v2` now follows this split: quiet engineering at night, conversation QA during the day.
- The external automation scheduler has not been changed from inside this repo; the fast pilot is currently run by the local `launchctl` one-shot watch documented above.
- If the world is intentionally stopped for night quiet, the daytime automation may run `npx convex run testing:resume` at or after 06:00 before collecting fresh samples.

### Morning Opening QA

First checks:
- Confirm project day/time display is correct.
- Confirm Alan returns from away state cleanly.
- Confirm Umi briefing is short, useful, and emotionally legible.
- Confirm today's focus gives Alan one obvious first action.
- Confirm character states are visible enough to explain why people are quiet, busy, tired, or available.

Target morning briefing shape:
- Yesterday's most important emotional residue.
- Today's biggest risk.
- One person Alan should talk to first.
- If Alan only does one thing, what it should be.

### P0: Wrong Addressee Fix

Why:
- Calling the wrong person breaks immersion harder than awkward wording.

Plan:
- Inspect fresh post-fix conversations for wrong names such as CaoCao addressing Mahiru as Liu Bei.
- Strengthen repair/sanitization around speaker-target names.
- Make deterministic fallbacks receive and preserve the actual conversation partner.
- Add or improve eval detection so wrong addressee becomes a first-class failure reason.

### P0: Umi Briefing Compression

Why:
- Daily memory now feeds Umi, but raw day summaries can make her sound like a report generator.

Plan:
- Keep detailed daily memory in world state.
- Display only a compact briefing in the morning.
- Move extra details into Campus Feed / Memory rather than Umi's opening line.
- Avoid repeated dailyMemoryConsolidation entries in briefing output.

### P1: Daily Character State

Goal:
- Add lightweight daily states without turning them into permanent personality rewrites.

Initial states to surface:
- 海：過度整理世界、未休息。
- 真晝：疲憊、擔心學生變安靜。
- 麻衣：觀察中、保留態度。
- 曹操：安靜、評估秩序。
- 劉備：想邀請被排除的人。
- 明日奈：負擔過高、仍在接事情。

These should influence:
- tone;
- reply length;
- willingness to talk;
- initiative;
- movement/activity/status text.

### P1: Quiet World / Atmosphere

Goal:
- Let silence be valid.

Add more non-verbal signals:
- sitting;
- pacing;
- staying late;
- avoiding rooms;
- lingering in hallway;
- lights still on at night.

Where they should appear:
- Campus Feed;
- Umi briefing;
- scene descriptions;
- character status.

Do not force them into dialogue.

### P1: Fresh Conversation Eval

Daytime:
- Allow more natural conversation samples from 06:00 to 21:59.
- Run the adaptive watch loop every 45 minutes.
- Temporary fast pilot exception: Umi/Mahiru collection may run every 5 minutes for 30 minutes using `umi/fast_pilot_watch.sh` while the LLM pair gate is limited to `Umi:Mahiru Shiina`.

Night:
- From 22:00 to 05:59, keep the world quiet.
- Watch loop only performs a real eval near two-hour checkpoints.
- No forced conversation generation at night.

Evaluation priority:
- wrong addressee;
- fallback identity collapse;
- emotional binding to the previous speaker;
- relationship chemistry;
- behavior/world consequence;
- daily-state continuity.

### P2: Golden Conversation Archive

Purpose:
- Save good conversations as taste references and future eval fixtures.

Candidates:
- 明日奈 saying not everything should be silently put on her.
- 曹操 talking about order and the person at the door.
- 真晝 talking about people becoming afraid to say the truth.
- 海 reducing Alan's overload without becoming a report generator.

Keep this lightweight:
- Start as docs/eval examples, not a major data system.

## v0.1 Target Loop

Alan enters campus  
-> sees Umi briefing and today's focus  
-> understands current time, scene, mood, and nearby people  
-> chooses one person or place  
-> travels, talks, observes, or acts  
-> the world reacts with readable consequences  
-> campus feed and conversation history remember it  
-> tomorrow feels slightly different

## v0.1 Acceptance Criteria

- Alan can enter/leave campus without duplicate identity or broken state.
- Time shows dynamic project day, starting from 2026-05-19, so 2026-05-20 is Day 2.
- UI answers immediately: where am I, who is here, what happened, what can I do now.
- Character tab is the main social entry point: select character, see location/status, travel, start talking, review history.
- Conversation panel feels like companion/social-sim chat, not debug chat.
- Umi feels like Alan's guide and emotional anchor, not a generic quest giver.
- Campus feed reads like school memory, not raw logs.
- Characters visibly occupy scenes, avoid stacking, and have enough motion/presence to feel alive.
- Scene switching and character travel are understandable.
- Night/day rhythm changes availability, tone, and event generation.
- Push/simulate world produces short story digest, not clock confusion.
- Club creation is visible in a simple club registry, or hidden when not meaningful.
- Build checks pass: `npx tsc --noEmit`, `npm run build`.

## Completed Recently

- Centralized display name behavior and short-form names.
- Dynamic project-day clock anchored to 2026-05-19.
- Left Umi panel for briefing, suggestions, and today's focus.
- Left campus feed notification panel with read/unread, filters, and full-view expansion.
- Right panel responsibility cleanup:
  - `互動`: Alan/world status and current next-step entry points.
  - `角色`: find people, see location/status, travel, start conversation, character actions, clubs.
  - `對話`: active conversation and scoped history.
  - `日程`: schedule/readability only.
  - `進階`: debug/repair.
- Character cards use portrait-based presentation.
- Map sprites use distinct character visual identity and light idle breathing.
- Umi companion prompt has anti-template guard for vulnerable Alan messages.
- Topbar scene tags changed from slash metadata to natural scene guidance.

## Highest Priority Gaps

### P0: Make Characters Feel Mobile And Placed

Problem: Characters can still feel fixed or clustered even when the backend has positions.

Needed:
- Verify schedule movement actually changes NPC scene/location over time.
- Make travel feedback clearer when Alan moves to target.
- Show transition states such as `正在前往宿舍`, `剛到 AI 社團室`.
- Keep spacing offsets stable enough that characters look gathered, not fused.
- Make focus/scene switch follow movement reliably.

### P0: Conversation Flow Must Feel Immediate

Problem: Conversation is functional but can still feel like a panel with controls.

Needed:
- Selecting a character should show the fastest path to `前往 -> 開始說話`.
- Active conversation should clearly show whose turn it is.
- Character history should stay scoped to selected character.
- Empty states should guide gently, not expose system state.
- Conversation should end with a decision, pause, invitation, emotional shift, or unresolved tension.

### P1: Campus Feed As Story Memory

Problem: Campus feed can still mix older noisy event wording with useful story items.

Needed:
- Rewrite old system-ish event labels on display.
- Group or summarize repeated similar events.
- Show why an event matters in 1 line when available.
- Keep global feed separate from selected character history.

### P1: Daily Rhythm And Availability

Problem: The world is closer to school rhythm, but needs stronger readability.

Needed:
- Character availability visible in role cards.
- Night should reduce normal public activity.
- Morning should show a short digest and one clear focus.
- Daily ordinary life events should remain low-key, not all become plot.

### P1: Umi Guidance Quality

Problem: Umi is much better, but her guidance should consistently reduce Alan's decision load.

Needed:
- Briefing should always answer: what matters, who needs Alan, what one thing to do.
- Suggested actions should route to the right UI flow.
- Umi should avoid repeating full world summaries unless requested.

### P2: Visual Polish

Needed:
- Reduce remaining boxy/dashboard styling.
- Make side panels feel like controller/info surfaces.
- Keep bottom bar compact.
- Ensure mobile panels do not overlap key actions.

## Dangerous Scope To Avoid Before v0.1

- New characters.
- New factions.
- Large autonomous Alan mode.
- Complex romance/relationship meters.
- Full simulation rewrite.
- More lore before the daily loop is smooth.
- Full memory-storage migration before conversation quality is stable.

## Memory Architecture Pending List

Decision:
- For v0.1, keep runtime memories in Convex and add lightweight retention classification.
- Do not split every character into separate memory files yet.
- Use `docs/giis-memory-architecture.md` as the working design note.

Done now:
- Conversation memories are classified as `今日經歷` or `長期候選`.
- Reflection now acts as the lightweight promotion step into long-term insight.
- Ordinary daily texture is allowed to stay ordinary instead of becoming permanent personality.

Later:
- Add explicit schema fields/tables for biography, daily experience, long-term candidates, and long-term memories.
- Add per-character memory inspection/editing UI for Alan.
- Add memory compaction and stale-memory hygiene.
- Add optional file-backed character profile snapshots for review/export.

Why later:
- The immediate v0.1 bottleneck is still playability and conversation quality, not storage architecture.
- A large memory migration now could break retrieval, old history, and the live eval loop.

## Current Work Log

### 2026-05-20: Roadmap Setup

Goal:
- Establish a living v0.1 roadmap.
- Use this file as the coordination point before future implementation passes.

Status:
- Roadmap created.
- Next implementation focus should be P0 movement/placement plus conversation entry clarity.

### 2026-05-20: P0 Movement / Placement Pass

Goal:
- Fix the reason NPCs feel like they gather in the same place.
- Make autonomous schedule context character-aware instead of using only one global time-block location.

Plan:
- Pass the acting player's id into the schedule context query.
- Resolve the player's display name and return a character-specific expected scene.
- Keep the existing movement/pathfinding engine intact.

Status:
- Completed first pass.

Result:
- `currentScheduleContext` is now character-aware when called by autonomous agents.
- Shared `scheduledLocationForName` now drives repair, time movement, and autonomous schedule movement.
- Repair/debug check showed 7 players and no duplicate Alan.
- Current afternoon distribution after repair: AI 社團室 4, 學生會室 1, 宿舍 1, 中央庭院 1.

Remaining:
- Need browser/playtest verification that autonomous movement remains visible over time, not only after repair.
- Need clearer in-UI transition copy when a character is moving between scenes.

### 2026-05-20: P0 Movement Feedback Pass

Goal:
- Make movement readable in the UI, not just technically present in pathfinding.
- Show where a character is heading when they are moving.
- Make map sprites visibly communicate movement/transition.

Plan:
- Derive destination scene from `player.pathfinding.destination` in the frontend.
- Show `正在前往 X` in character cards and schedule/status surfaces.
- Add a lightweight map indicator for moving characters.

Status:
- Completed first pass.

Result:
- Character cards and schedule/status surfaces now derive destination scene from `player.pathfinding.destination`.
- Moving characters display `正在前往 X` instead of vague current-location status.
- Selected character focus card also reports destination when moving.
- Map sprites show a small `…` motion indicator while moving.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Browser DOM smoke confirmed the line now displays as one clean quoted Umi sentence.

### 2026-05-20: v0.1 Candidate Stability Check

Goal:
- Verify the world can be repaired, clocked, and resumed after the UI cleanup passes.

Status:
- Completed.

Result:
- `school:repairWorldState` returned 7 players, 0 duplicate players removed, and one Alan player id.
- World clock returned `第 2 天 下午 3:49`, anchored to `2026/5/19 凌晨12:00`.
- `testing:resume` reported the world is running.
- Browser DOM smoke loaded `/ai-town`, showed Day 2, Umi left panel, campus feed badge, right-side tabs, and clean Umi briefing copy.

Known Risk:
- Browser click/screenshot automation intermittently times out while local Convex/Ollama load is high. DOM smoke works, but I am not counting the final click-through playtest as fully complete until it can be repeated smoothly.
- User playtest reported two v0.1 blockers:
  - Character history still feels odd: it should be a scoped conversation summary list, with click-to-open full timestamped transcript and a clear close action.
  - Characters still appear unable to walk/move in the live world, despite repair placing them in scenes.

v0.1 Candidate Judgment:
- Good enough for Alan to open and play the core loop.
- Not yet good enough to freeze as v0.1 final without one longer manual/live session focused on conversation start, leaving, and character movement over several minutes.

### 2026-05-20: Active Blocker Pass

Goal:
- Replace the awkward selected-character previous-conversation details UI with an inbox-style history viewer.
- Diagnose and fix live character movement.

Status:
- Completed first pass.

Result:
- Selected character history now behaves more like a conversation inbox:
  - Each history item is a scoped summary card.
  - The card shows participants, timestamp, a one-line summary, and a preview.
  - Clicking the card expands the real transcript with per-message speaker names and timestamps.
  - Clicking the card summary again collapses it.
- `campusTimeline` now returns full archived `transcriptMessages` for character-scoped history instead of only a short preview.
- Removed the awkward `展開選定角色完整上一段對話` section from the conversation panel.
- Found the movement root cause: `repairWorldState` could patch the correct seven-character roster while an already-running engine step still held the stale world in memory, then that stale step saved the old roster back over the repair.
- `repairWorldState` now invalidates the currently running engine generation before patching world state, so stale scheduled steps cannot overwrite the repaired roster.
- Manual movement test confirmed pathfinding/input works after repair: Alan moved from `(12,14)` to `(8,9)` and the engine processed the move input.
- Right-side selected-player location copy now uses the selected player's actual position, not the currently viewed scene, fixing misleading text such as `劉備｜所在場景：AI 社團室` when 劉備 is elsewhere.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npx convex run school:repairWorldState` passed after the stale-engine invalidation change.
- `npx convex run world:worldState ...` showed one Alan (`p:15799`) and all seven main characters in the repaired world.

### 2026-05-20: v0.1 Soul / Movement / Memory Cleanup Pass

Goal:
- Finish the current 2-5 stabilization pass:
  - make movement visibly readable,
  - reduce old timeline/system wording,
  - make Umi's briefing less report-like,
  - audit recent history for conversation depth,
  - run another repair/build smoke.

Status:
- Completed implementation pass; still needs one longer live click-through session for final v0.1 confidence.

Result:
- Map characters now show movement when either `historicalLocation.speed > 0` or active `pathfinding` exists.
- Moving characters render a small trail / `...` indicator so pathfinding is visible instead of looking frozen.
- Conversation prompt rules now force a “soul check”: each response should include a concrete school-life detail, personal stake, hesitation, cost, silence, or decision.
- Character-specific conversation guidance was strengthened:
  - CaoCao should not repeat generic influence language without a person, cost, or concrete move.
  - Liu Bei should focus on excluded/quiet students instead of always calling public discussions.
  - Umi should speak more like Alan's emotional/world interpreter and less like a briefing generator.
  - Mahiru, Mai, Asuna now have clearer personal pressure hooks.
- Old displayed timeline/conversation text is naturalized on read:
  - removes leaked prompt text,
  - rewrites `形成意圖` / `執行意圖` style language,
  - softens repeated strategy slogans,
  - reduces old “校長簡報” phrasing.
- `repairWorldState` now also cleans legacy profile memories and intentions, so stale repeated phrases stop resurfacing in character cards and debug/profile surfaces.
- Umi briefing risk copy now avoids third-person self-reference like `海會建議 Alan...` in the spoken briefing.

Conversation Depth Audit:
- Recent history now shows real emotional hooks:
  - Mahiru notices quiet students and emotional safety.
  - Mai worries Alan builds faster than he understands.
  - Asuna carries execution burden.
  - CaoCao frames order as protection from chaos.
  - Liu Bei's best direction is now loneliness/exclusion, not just “公開討論”.
- Remaining weakness: older archived conversations still contain repetition because they were generated before the new prompt rules. Display cleanup hides the worst wording, but this is not the same as fully regenerated history.

Verification:
- `npx tsc --noEmit` passed after the movement/display cleanup pass.
- `npm run build` passed after the movement/display cleanup pass.
- `school:repairWorldState` returned 7 players and one Alan player id.
- `school:debugState` showed Mahiru actively moving, confirming movement state exists in current world data.
- `school:umiBriefing` returned Day 2 timing and current daily focus.
- Browser smoke on `http://localhost:5173/ai-town` loaded the app, showed Day 2, Umi briefing, campus feed, right tabs, and removed the old `海把這段對話整理成校長簡報` phrase from the visible briefing.

v0.1 Judgment:
- Closer than before, but not final.
- The core school loop is readable; the biggest remaining risk is whether newly generated live conversations consistently avoid fallback repetition under local LLM load.
- Browser smoke initially hit a stale duplicate Vite server on `localhost:5173`; after shutting down the duplicate listener, `/ai-town` rendered normally again with Day 2, Umi panel, campus feed, right panel, and character scene occupancy.

Remaining:
- Need one longer visual playtest to confirm movement *feels* visible enough in the browser, not just that backend pathfinding works.
- Need to reduce stale old memories/noisy historical phrases in archived transcripts without deleting world memory.

### 2026-05-20: Conversation History UX Pass

Goal:
- Make selected-character history feel like a message app / social-sim archive instead of expandable debug logs.

Decision:
- Keep global `校園動態` as whole-school memory.
- Make the `對話` tab behave like a scoped message archive:
  - `目前對話` is the active chat window.
  - `歷史對話` is the selected character's thread inbox.
  - `角色資料` stays separate from the chat.

Result:
- Replaced per-card `<details>` expansion with a fixed thread viewer:
  - Top/list area shows different conversation threads by time.
  - Selecting a thread opens its full transcript in the same fixed window.
  - The transcript shows real speaker names and per-message timestamps.
  - A `關閉` button hides the transcript while preserving the thread list.
- This should make `曾經跟誰講過話 / 幾點幾分 / 點開看真實紀錄 / 可以關掉` much clearer.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

### 2026-05-20: Conversation Soul / De-Template Pass

Goal:
- Decide honestly whether characters are speaking with enough depth for v0.1.
- Reduce the feeling that every conversation becomes AI 社 / 學生會 / influence politics.

Judgment:
- Characters have strong profile architecture, but v0.1 final still depends on live conversation feel.
- The biggest risk is not missing lore; it is characters sounding like smart strategy memos instead of people living in a school.

Result:
- Strengthened conversation prompt rules:
  - Each reply should include a concrete school-life detail, personal cost, hesitation, silence, decision, or exit when natural.
  - Repeated ideas must move to a personal stake or ordinary-life pivot.
  - Banned system-ish language such as `主線`, `形成意圖`, `conversationOutcome`, and `不能忽略`.
- Made role fallbacks more human:
  - 劉備 now tends to find excluded students first instead of always calling public discussions.
  - 明日奈 can name the burden of being the person everyone expects to clean up.
  - 曹操 notices vulnerable people through the lens of order.
  - 麻衣 can refuse over-explaining and let silence carry tension.
  - 海 avoids briefing voice unless Alan asks for it.
- Updated Umi suggestions and world-event consequences so `請劉備組織公開討論` is no longer the default repeated advice.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Browser smoke loaded `/ai-town`; still need live manual chat with 海 / 真晝 / 麻衣 / 曹操 to judge emotional resonance.
- In progress.

Remaining:
- Need live playtest: trigger Alan travel to target and confirm the status copy updates while movement is in progress.
- Need stronger scene-arrival feedback after pathfinding completes.

### 2026-05-20: P0 Arrival Feedback Pass

Goal:
- Give travel a readable ending, not only a start/moving state.

Result:
- Game now tracks moving -> idle transitions for Alan and the selected character.
- When movement completes, scene toast shows `X 抵達 Y。`
- This completes the first pass of start/moving/arrival feedback.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need live browser playtest to verify the toast timing during actual travel.

### 2026-05-20: Travel Toast QA Follow-Up

Finding:
- Browser playtest confirmed `前往所在地` enters moving state and shows `正在前往`.
- The scene toast could stay visible too long, making the UI look stuck if arrival detection did not replace it quickly.

Fix:
- Scene toast now auto-clears after 6 seconds.
- Persistent movement state remains in character/status UI instead of relying on the temporary toast.

Status:
- Implemented and verified.

### 2026-05-20: P1 Campus Feed Story Memory Pass

Goal:
- Make 校園動態 read like school memory instead of raw simulation logs.
- Keep global campus feed separate from selected character history.

Plan:
- Add a short meaning/detail line to feed items when source data has it.
- Naturalize old system-ish phrases at display time instead of deleting old events.
- Keep notification filters/read-state behavior intact.

Status:
- Completed first pass.

Result:
- 校園動態 now supports a second detail/meaning line per item.
- Old system-ish phrases such as `conversationOutcome`, `形成意圖`, and raw event-source labels are naturalized at display time.
- No historical world data was deleted or rewritten.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

### 2026-05-20: Conversation / Character Clarity Pass

Goal:
- Reduce repeated speaker labels in conversation.
- Make no-target character actions read like a game UI instead of a system template.
- Keep selected target, action panel, and map card synchronized.

Status:
- Completed first pass.

Result:
- Message rows no longer repeat names such as `Alan Alan` or `海 海`.
- Character action text no longer says `尚未選擇` as if it were a target.
- No-target actions are now limited to scene/world actions.
- Character lookup now accepts both internal names and display names.
- Map selected card now prioritizes the selected target over unrelated active conversation participants.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Browser smoke confirmed the no-target wording fix and improved target-location sync before the final selected-target source fix.

Remaining:
- Need one more browser retest after the selected-target source-of-truth patch.

### 2026-05-20: Quiet World Density Pass

Goal:
- Make the school less like a 24/7 meeting simulator.
- Let silence, resting, and ordinary activity exist between conversations.

Status:
- Completed first pass.

Result:
- Autonomous conversation chance is now schedule-aware.
- Deep-night sleep blocks normal autonomous conversation.
- Dormitory/night activity is quieter.
- Conversation duration and message count are shorter.
- Agents spend longer in place before choosing another action, reducing constant churn.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `school:repairWorldState` passed after stopping the local engine.
- `school:debugState` showed seven main characters and one Alan.
- `school:nightCycleQaScenario` produced sleep/rest behavior and a morning digest.

Remaining:
- Need longer live playtest with the engine running normally.

### 2026-05-20: Umi Briefing Presentation Cleanup

Goal:
- Remove nested speaker/quote artifacts from the left Umi briefing.

Status:
- Completed.

Result:
- Umi greeting lines now strip duplicated `海：` prefixes and outer quote marks before display.
- The left briefing reads like a clean spoken line instead of `「海：「...」」`.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need live browser review to see whether the feed feels calm enough in real data.
- Need further grouping if older noisy history still overwhelms the panel.

### 2026-05-20: P0 Conversation Readability Pass

Goal:
- Make the active conversation feel like a clean companion/social-sim chat.
- Remove duplicated speaker names inside message rows.
- Keep selected-character history scoped and messenger-like.

Plan:
- Ensure message rows show avatar + one speaker label, not duplicated names.
- Pass selected target into chat input placeholder.
- Tighten empty/history states without changing stored data.

Status:
- Completed first pass.

Result:
- Active conversation message rows now show avatar + one speaker name, avoiding duplicated `Alan Alan` / `海 海` style repetition.
- Chat input placeholder now scopes to the selected target when available.
- Existing selected-character history behavior remains scoped and unchanged.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need live browser review with a real 海 conversation to confirm the emotional prompt + UI rhythm together.

### 2026-05-20: Player Presence Copy Fix

Finding:
- Browser smoke showed the main panel could say `附近角色：目前只有 Alan` while Alan was actually away from campus.

Plan:
- Make the overview copy distinguish Alan's away state from nearby/scene characters.
- Avoid implying Alan is physically present when the player identity says he is handling other work.

Status:
- Completed.

Result:
- Main overview now distinguishes `場景人物` while Alan is away from `附近角色` while Alan is present.
- Alan away state no longer implies he is physically standing in the current scene.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

### 2026-05-20: Character Tab Action Clarity Pass

Goal:
- Make the 角色 tab clearly behave as `select person -> find them -> talk/act`.
- Remove confusing no-target copy such as `Alan 對 尚未選擇 執行...`.

Plan:
- Show role/action controls only after a character is selected.
- Keep club registry visible but separate from selected-character action state.
- Keep unusual actions collapsed away from the primary route.

Status:
- Completed first pass.

Result:
- Character action prep copy no longer says `Alan 對 尚未選擇`.
- No-target state now describes valid world actions such as observing the current scene, announcing, or creating a club.
- Role-dependent interactions remain disabled until a character is selected.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need browser review that the 角色 tab feels more like find/interact than a settings overview.

### 2026-05-20: Club Registry Noise Reduction

Finding:
- Live data contains several old/test club records, which makes the player-facing registry feel repetitive.

Plan:
- Do not delete historical club records.
- Show the two most recent clubs first.
- Move older clubs into a collapsible archive inside the registry.

Status:
- Completed.

Result:
- Club registry now shows the two most recent clubs first.
- Older club records are still preserved but collapsed under `較早登記的社團`.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

### 2026-05-20: Quiet World Conversation Density Pass

Goal:
- Stop the school from feeling like everyone is always in meetings.
- Preserve autonomous life while making idle/resting/observing states more common.

Plan:
- Lower autonomous invite acceptance.
- Shorten autonomous conversations.
- Add a probability gate before agents start new autonomous conversations.
- Lengthen ordinary activities slightly so characters visibly occupy scenes.

Status:
- Completed first pass.

Result:
- Autonomous agents now start fewer conversations by probability instead of always seeking a target.
- Autonomous invite acceptance is lower.
- Autonomous conversations end sooner.
- Ordinary school activities last longer, so characters can visibly occupy scenes without immediately starting another talk.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need longer runtime observation to tune exact conversation frequency.

### 2026-05-21: Conversation Sample Density Rebalance

Goal:
- Generate enough real post-fix conversations for the v0.1 conversation watch loop.
- Keep deep-night quiet behavior intact.

Status:
- Completed first pass.

Result:
- Daytime autonomous conversation cooldown is shorter.
- Autonomous invite acceptance is higher during the v0.1 tuning phase.
- Agents now try to find a conversation before falling back to idle activity when awake and available.
- Schedule-aware probabilities are higher in daytime/social scenes and still blocked during sleep hours.
- Autonomous conversations can reach six messages before the hard cap, giving the eval loop more 3-6 turn scenes.

Remaining:
- Let the running world produce new post-fix conversations, then evaluate only those samples.

### 2026-05-21: Small Meaningful Player Actions Pass

Goal:
- Make the action panel feel less like admin controls and more like ordinary school interaction.
- Give Alan a few low-risk actions that create memory without expanding into a new system.

Status:
- Completed first pass.

Result:
- Added player-authored actions: `關心近況`, `留言`, and `詢問傳聞`.
- These actions write natural world events, update social layer, and add target memories when a character is selected.
- Moved `踹一腳` and `任命為助理校長` into a collapsed advanced/toy action area instead of normal character actions.
- AI club cards can now prepare an editable announcement draft for AI 社 boundaries, rather than being only a passive registry.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Browser-playtest the action panel hierarchy and confirm the new actions feel useful rather than noisy.

### 2026-05-21: Formative Memory / Social Layer Downweight Pass

Goal:
- Let characters grow from personal history, daily life, and relationships instead of defaulting to AI 社 / student council / world-pressure analysis.
- Keep social systems as atmosphere, not the main script.

Status:
- Completed first pass.

Result:
- Added optional `formativeMemories` seeds to the GIIS character profiles and Alan profile.
- Conversation prompts now include a `Character soul source priority` block:
  1. previous speaker, current scene, formative memories;
  2. recent personal memories and relationship tension;
  3. campus politics/world pressure only as background weather.
- Recent world events are now explicitly framed as background weather and limited to at most one emotional-thread reference.
- Formative memories are instructed to shape what a character notices, avoids, protects, asks, or leaves unsaid rather than being quoted directly.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Generate and inspect fresh conversations to see whether characters stop overusing AI 社 / student council analysis and begin reacting from personal pressure.

### 2026-05-21: End-of-Day Daily Memory Consolidation

Goal:
- Make tomorrow inherit today instead of starting from zero.
- Keep the implementation lightweight: no new major memory architecture, no new UI, no schema migration.

Status:
- Completed first pass and ran it for the current end-of-day state.

Result:
- Added `school:consolidateDailyMemory`.
- The mutation summarizes the current world day into:
  - world summary;
  - per-character daily memories;
  - relationship shifts;
  - tomorrow hooks.
- It writes the result into existing profile memory and creates one `dailyMemoryConsolidation` world event for tomorrow's briefing/campus feed.
- It avoids storing raw transcript snippets in character memory; conversation memories are compressed into short summaries.
- Re-running the consolidation marks older same-day consolidation events as `repeated_noise` so old test runs do not spam Umi's briefing.
- Conversation watch automation was reduced to every 2 hours, and the prompt now treats nighttime silence as valid instead of forcing new conversations.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npx convex run school:consolidateDailyMemory '{"timeZone":"America/Chicago","force":true}'` completed.
- `npx convex run school:umiBriefing '{"timeZone":"America/Chicago"}'` shows one current daily memory consolidation as a briefing anchor.

Remaining:
- Tomorrow morning, verify that Umi's opening briefing is concise enough and that characters reference daily memory without repeating old wording.
- Later v0.1 work should add a cleaner memory hygiene pass so forced/dev consolidations can be pruned or hidden more elegantly.

### 2026-05-21: Anti-Silence-Template Conversation Patch

Goal:
- Fix the first post-formative-memory eval finding: anti-repeat logic was redirecting into repeated quiet/silence templates.

Status:
- Completed one targeted patch.

Result:
- Added the repeated silence phrases to the conversation language ban and template-leak guard.
- Replaced fallback lines like `我先不替這段話下結論 / 讓它安靜一下` with concrete low-stakes actions:
  - cancel one task;
  - check who actually needs rest;
  - identify who left early;
  - remind Alan to see people before adding features.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npm run eval:conversation` stayed at expected baseline: 5 PASS / 1 WARN / 3 intentional bad-fixture FAIL.

Remaining:
- Wait for new post-patch archived conversations before judging whether the repeated silence pattern is fixed.

Runtime QA:
- `npx convex run school:repairWorldState` passed.
- Repair kept 7 players and one Alan.
- `npx convex run school:debugState '{}'` showed the seven main characters without stale active conversation state.
- `npx convex run school:nightCycleQaScenario '{}'` showed 23:00 sleep behavior and a short next-morning digest.

### 2026-05-21: Night Groundwork For Tomorrow Morning

Goal:
- Prepare the 2026-05-22 morning loop without expanding systems.
- Fix the most immersion-breaking conversation risks before collecting new daytime samples.

Status:
- Completed focused implementation pass.

Result:
- Umi briefing now compresses daily memory into a short emotional residue instead of reading like a system report.
- Wrong-addressee repair now handles full Chinese/English aliases in both generation cleanup and final message insertion.
- Conversation eval now includes `wrongAddresseeScore`, so CaoCao addressing Mahiru as Liu Bei becomes a first-class failure.
- Added a lightweight golden conversation archive scaffold for future taste references.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npm run eval:conversation` passed expected baseline: 5 PASS / 1 WARN / 4 intentional bad-fixture FAIL.
- `npm run eval:conversation:recent -- --since-last-change` ran, but found 0 post-patch conversations.

Remaining:
- Tomorrow morning, collect fresh post-patch conversations. Do not judge old `legacy_noise` conversations as current failure.
- Capture 3-5 genuinely good archived conversations into the golden archive once they occur naturally.

Operational finding:
- Local Convex state is bloated: about 4.1M documents, including about 3.4M duplicate `schoolRelationships` rows and about 148k pending `ensureWorldProfiles` scheduled functions.
- Root cause patch: `Game.saveWorld()` no longer schedules `ensureWorldProfiles` on every engine save.
- Before a long playtest, do a controlled local-state hygiene pass. Do not reset world memory casually; clear scheduler/relationship flood carefully.

Follow-up repair:
- Added `scripts/repair-local-convex-state.mjs`.
- Ran dry run, then backed up and cleaned local Convex SQLite.
- Active documents dropped from about 4.15M to about 464k.
- Backup path: `/Users/alanhdchu/.convex/convex-backend-state/local-alan_chu-ai_town/backups/convex_local_backend.2026-05-22T04-42-45-280Z.sqlite3.bak`.
- `npm run dev` can serve the frontend again at `http://localhost:5173/ai-town`.
- `repairWorldState` ran after cleanup and restored seven players plus one Alan.
- Night safety stop: after repair, the engine was stopped with `npx convex run testing:stop` so stale scheduled movement cannot keep moving sleeping characters tonight.

### 2026-05-20: Target Location Source Sync

Finding:
- Browser playtest showed the same selected character could display different scenes in different UI surfaces.

Plan:
- Match live map players to profile/target names by both internal name and display name.
- Use live map position as the primary source for character location/status where possible.

Status:
- Completed first pass.

Result:
- Character lookup now matches both internal names and display names.
- Character tab, action panel, and map navigation are less likely to disagree about the selected target.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need live browser retest after reload because autonomous movement can still legitimately change location between checks.

### 2026-05-20: Selected Target Source-Of-Truth Pass

Finding:
- Browser playtest showed the top target card could be overwritten by the active conversation participant, while the right panel used the selected character.

Plan:
- Keep explicit player selection as the primary selected-target source.
- Use active conversation participants only as fallback when no character is selected.

Status:
- Completed first pass.

Result:
- Explicitly selected character now stays the selected target in the top/map HUD.
- Active conversation participant only fills the target card when nothing else is selected.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

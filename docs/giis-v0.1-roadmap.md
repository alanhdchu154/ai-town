# GIIS Underworld v0.1 Roadmap

Last updated: 2026-06-16 16:48 CDT (data-collection readiness reset; cc review completed; human-flow gate ready)

This file is the current v0.1 contract. Historical shipped work belongs in git
history and reports, not in the active roadmap.

## 2026-06-16 Data-Collection Readiness Reset

Alan's current goal is not to declare v0.1 done by adding more features. The
goal is to make the environment stable enough that fresh Underworld evidence can
be collected and judged without UI/runtime noise corrupting the read.

Core problem:

- Recent hardware/local-runtime issues and frontend friction made the world hard
  to observe cleanly.
- UI issues can block Alan from collecting usable manual-test evidence even when
  the backend is partly healthy.
- Pre-recovery samples should not be treated as clean v0.1 proof.

Current direction:

- Keep the target narrow: data-collection readiness and Alan human-test flow.
- Use the completed `umi/workload.md` cc Opus review as a read-only findings
  pass over the current dirty set, MysteryDetector boundary, frontend changes,
  and smallest readiness patch.
- Accept only small readiness fixes that make evidence collection cleaner, such
  as fail-fast backend listener checks, no-side-effect clock refresh, clearer
  frontend no-data states, or a human-flow readiness report.

Success criteria before calling v0.1 evidence review fair:

- `npm run underworld:runtime-preflight` passes or fails fast with a clear
  backend/listener reason.
- `npm run underworld:frontend-smoke` passes on the Alan-facing flow.
- Conversation Wall / Scene Mode do not block Alan with indefinite loading,
  misleading presence, or flicker that prevents observation.
- At least one clean post-recovery evidence window is collected after the UI and
  runtime checks are stable.

## 2026-06-16 State Sustainability (the real blocker behind repeated resets)

The recurring "the world won't open / runtime is slow / conversations drop" was
diagnosed to its real cause: the Convex **local** backend retains full document
version history, and AI Town rewrites the engine + world docs ~every second, so
the `documents` table grows ~150k rows/day even though real app data (memories,
conversations, residue) is tiny (~35k rows / 33 MB). At ~1 GB the backend
cold-opens in ~9 min and queries fail with "too many system operations". Cloud
Convex compacts this automatically; the local OSS backend does not. This — not
the app data — is why WORKLOG #9's fresh-world reset kept recurring.

- Cure (data-preserving, keeps continuity): `scripts/underworld-compact-state.sh`
  exports current data → archives the bloated state → fresh backend → imports →
  restores env → resumes. 1 GB → ~tens of MB, cold-open back to seconds. First
  run 2026-06-16: 690k→37k docs, all souls/continuity intact (same world id, sim
  day preserved).
- This is **recurring maintenance**, not a one-time fix: run
  `scripts/underworld-compact-state.sh --check` periodically and compact (~weekly
  or when it warns). `convex export/import` does NOT carry Convex env vars, so the
  script backs them up + restores them; secrets stay in Alan's secure source
  (`docs/current-env.md` lists the non-secret re-apply commands).
- Longer-term if weekly compaction is too manual: move the deployment to Convex
  cloud (auto-compacts) or reduce engine doc-churn frequency.

- Alan's manual acceptance remains separate from machine checks; do not mark
  v0.1 closed without Alan seeing the actual experience.

Out of scope for this reset:

- broad prompt rewriting,
- memory architecture rewrites,
- provider migration,
- schema redesign,
- new character expansion,
- using Field Notes story needs to mutate the runtime.

## 2026-06-14 Runtime Guard Reset — Monday/Tuesday Run, Wednesday Review

Alan explicitly approved starting repairs Sunday night rather than waiting for
the broken weekend run to continue. The weekend freeze note below is historical:
it correctly warned that repeated redeploy/kick can create split-brain
`runStep` loops, but it no longer blocks this targeted runtime-health fix.

What happened:

- `/ai-town` and Convex queries were alive, but role-to-role conversation flow
  stopped around 10:59-11:00 CDT.
- Two stale active unarchived conversations (`海/一之瀨`, `祥子/貓貓`) blocked
  natural flow and were cleared with Alan approval.
- The old preflight only checked whether Convex functions responded, so it
  incorrectly passed during a half-stuck world.

What is live now:

- **ROOT-CAUSE FIX (Claude, 21:32):** the stall's cause was found, not just
  detected. A hung `agentGenerateMessage` (cloud LLM call) blocks every agent via
  the global conversation single-flight until its operation backstop — which
  defaulted to **10 minutes** (`AGENT_GENERATE_MESSAGE_TIMEOUT_MS` 600_000). One
  hung call froze the whole world for 10 min; persistent cloud trouble compounded
  it into hours (~400 `Timing out` reaps in the log). Fixed
  `convex/aiTown/agent.ts` to default the backstop to **120s** (the single-flight
  floor) — a hang now clears in 2 min and others move on. Verified by a clean
  stop→resume + a forced conversation that engaged immediately and wrote residue.
  Codex's guards below are the detection/cleanup safety net; this is prevention.
- `school:activeConversationRuntimeHealth` reports latest input age, processed
  input position, due-but-unprocessed input backlog, active conversations, and
  stale active conversations.
- `npm run underworld:runtime-preflight` now fails on stale daytime agent input,
  stale active conversations, or due pending input backlog.
- `npm run underworld:stale-watchdog` is dry-run/report-only by default.
  Applying cleanup requires both human approval and
  `UNDERWORLD_STALE_WATCHDOG_ALLOW_DIRECT_WRITE=true`.
- The dev stack was restarted once to load these guards; current verification:
  `/ai-town` HTTP 200, runtime preflight PASS, stale watchdog dry-run stale=0,
  due pending inputs=0, typecheck/build PASS.

Run plan:

1. Monday 2026-06-15: observe/report only. Do not tune prompts unless repeated
   fresh evidence shows a low-risk hygiene failure.
2. Tuesday 2026-06-16: continue natural collection; watch experienceLogs,
   sleepNotes, same-pair continuity, and motif loops.
3. Wednesday 2026-06-17: judge whether v0.1 evidence exists: conversation ->
   subjective residue -> bounded experience log -> sleep/tomorrow continuity ->
   small behavior change.

Do not count 2026-06-14 afternoon/evening as complete continuity data.

## 2026-06-13 Weekend Run — Soul Memory Live + Critical Fix (Claude, with Alan)

The world is set to run unattended through the weekend; Alan reviews results in
a day. Before letting it run, a careful live check found a real bug that would
have wasted the run.

**CRITICAL BUG FOUND & FIXED — residue was silently empty.** Summaries were rich
and per-character, but EVERY conversation stored an empty 殘留. Root cause: the
residue is a second sequential LLM call, and `MEMORY_LLM_TIMEOUT_MS` defaulted to
**10s** while the local model **qwen3:8b is a reasoning model that takes ~17s**
(it emits thinking tokens first). So every residue call timed out →
`RESIDUE_LLM_FAILED` → null → deterministic fallback → '' (the new three pilots
have no deterministic branch; the old three are gated by resonance). Verified by
running the exact residue prompt against both cloud qwen-plus (1.4s, great
residue) and local qwen3:8b (16.9s, great residue), and confirming the sanitizer
keeps the output — so the timeout was the sole killer. Fix: `MEMORY_LLM_CLOUD=true`
(cloud primary, 1.4s) + `MEMORY_LLM_TIMEOUT_MS=30000` (local fallback now fits).

**Live env settings for this run (NOT in git — set on the Convex deployment):**

- `MEMORY_LLM_CLOUD=true`, `MEMORY_LLM_CLOUD_MODEL=qwen-plus` — memory
  summary/residue runs on the same cloud model the conversations use, via the
  pilot cloud path (humanFacing → bypasses the autonomous daily quota), with
  local qwen3:8b then deterministic template as the two fallbacks.
- `MEMORY_LLM_TIMEOUT_MS=30000` — so the slow local reasoning model fallback does
  not time out.
- `UNDERWORLD_KEEP_WORLD_ALIVE=true` — keepDefaultWorldAlive cron keeps the world
  running 24/7 with no browser open (Alan accepts the cost).
- Kill switches: set any of the above to false to stop cloud spend / always-on.

**What is now live (this session):** soul-grounded subjective summary (injects
the speaker's own Private Self); soul-grounded LLM residue for all six pilots
(my Private Self × the other's Public Self); Alan↔character now leaves a residue
in the character (rejected from experienceLog so it does not pollute lane-1);
心跡 consolidated into the 對話牆; cloud memory LLM; always-alive world.

**How Alan verifies after the run:** open 對話牆 → 試點/有殘留 filter, or run
`npx convex run school:notebookSoulTraces '{}'`. Recent pilot conversations
should now show a 殘留 line (they were empty before the timeout fix). Watch that
residues read grounded and per-character, not generic. If cloud gets throttled
it silently degrades to local (still fine at 30s); if quality drops, check
whether it fell back.

**Per-use-case model routing (memoryCloudModel).** The official Qwen endpoint
serves qwen-max/plus/turbo/flash/qwen3-235b. Tested on real transcripts:
qwen-plus writes the most vivid, concrete emotional residue/summary; **qwen-max
is more conservative/abstract and even returned 無 where qwen-plus found a real
trace**, so the flagship is the wrong tool for evocative writing. Current
routing (env-overridable via MEMORY_{RESIDUE,SUMMARY,REFLECTION,IMPORTANCE}_CLOUD_MODEL):
residue/summary/reflection → qwen-plus; importance (0–9 mechanical score) →
qwen-turbo. Local fallback switched OLLAMA_MODEL → qwen2.5:14b (non-reasoning, so
no `<think>` leak, unlike qwen3:8b). Local latency is ~16s either way
(hardware-bound model load), which is why the 30s timeout matters.

**OPERATIONAL — do NOT redeploy or kick over the weekend.** Every `convex env
set/remove` or code save redeploys functions and bumps the engine generation;
~10 redeploys this session left all six agents idle for 33 min, then spawned a
**split-brain engine** — duplicate runStep loops fighting, repeated `Generation
number mismatch` errors, conversations unable to complete. **Correction to an
earlier note in this doc: `testing:kick` is NOT the fix — kick spawns ANOTHER
duplicate loop and re-creates the mismatch (verified live).** The only clean
recovery is ONE `testing:stop` → wait ~20s → `testing:resume` (single engine,
0 mismatches). For the weekend free run: **leave files and env completely
alone.** keepDefaultWorldAlive prevents idling; an untouched repo runs stably.

**VERIFIED end-to-end (2026-06-13 22:14).** Forced a 海↔真晝 conversation via a
`startConversation` input (no redeploy) and both characters wrote vivid,
per-character residue — so conversation → cloud LLM → remember → residue all
work now. (Forcing a test conversation without redeploy: `convex run
aiTown/main:sendInput '{"worldId":"<id>","name":"startConversation","args":{"playerId":"p:0","invitee":"p:6"}}'`.)

**Also fixed: unanswered-human-tail guard.** It dropped ANY conversation Alan
closed (a real 27-msg Alan↔Tianze chat → memCount=0). Now skips only a true
ping-fest (<2 character replies); real exchanges Alan ends are remembered.

**Open for Monday (needs a redeploy — NOT this weekend):** residue reads too
philosophical/aphoristic ("原來溫柔也能有重量") and slightly over-interprets
(projected a fear onto 海 that the event did not contain). Tune the residue
prompt toward grounded/observational, banning "原來X" aphorisms and invented
hidden meanings — keep soul depth, stay anchored to what happened. Also still
unconfirmed live: Alan↔character residue (logic + unit tests pass).

## 2026-06-13 Night Closeout / Next Morning Contract

Current stance: **do not expand tonight**. The world is running, v0.1 machine
gate is PASS, and the right next evidence is natural overnight / morning
behavior rather than more prompt churn.

What is active:

- Rolling continuity monitor: Codex-level local automation is ACTIVE and should
  keep running observe/report-only every 120 minutes.
- Nightly reflection / 睡前回響: Codex-level local automation is ACTIVE at 23:30
  local time, but **shadow only**. It runs `npm run underworld:nightly-reflection`
  and must not pass `--write`, import sleepNotes, mutate Convex state, restart
  the world, or send Telegram.
- Free-world runtime: keep the world alive overnight if the dev stack remains
  healthy. Do not force conversations at night.

Tomorrow's first useful checks:

1. Runtime health: confirm `/ai-town` and `world:defaultWorldStatus` are alive.
2. Read `umi/reports/nightly-reflection-latest.md`; treat empty/no-insight output
   as `SHADOW_WARN/provider_or_threshold_pending`, not failure.
3. Check whether fresh morning conversations naturally reference yesterday
   without motif loops, hallucinated facts, or stage-direction narration.
4. Only repair if a repeated fresh failure appears. No fresh evidence means no
   prompt/memory tuning.

Deferred idea: subjective memory re-bedding is preserved at
`docs/paper/subjective-rebedding/SUBJECTIVE_MEMORY_REBEDDING_IDEA.md`. It is a future v0.2 / paper
direction ("Yesterday mattered differently to each person"), not part of the
current v0.1 implementation scope.

## 2026-06-13 Continuity Lanes

Alan's current product model has three lanes. v0.1 should keep them separated
so the world can start collecting evidence without turning into a large
civilization system.

| Lane | v0.1 Status | Rule |
| --- | --- | --- |
| 1. Character-to-character conversation -> subjective residue -> later behavior | Core | This is the main v0.1 proof. Collect clean archived conversations, write bounded `experienceLogs` only from `llm_soul` residue, then compare later behavior against the residue. |
| 2. Alan-to-character conversation -> that character's subjective interpretation | Shadow | Alan can be the other party conceptually, but do not make Alan a generated subject and do not promote Alan-facing residues into prompt-facing sleepNotes until dry-run evidence is clean. |
| 3a. Shared campus-life incident/topic -> characters react differently | Thin shadow | Use a small daily campus seed / daily focus label only. No new schema, no durable world-state mutation, no global prompt spam. |
| 3b. Character soul causes world-state changes | v0.2 | A character causing a vending-machine incident or changing prop state is a real world-write system. Defer until v0.1 proves residue -> tomorrow continuity. |

Immediate diagnostic priority: observe reports must show why fresh samples did
or did not become experience evidence. `underworld:observe` therefore reports a
fresh experience-log rejection histogram such as `source_not_archived_yet`,
`alan_pair_shadow_not_enabled`, `no_memory_trace_yet`,
`ordinary_memory_fragment_not_residue`, `no_residue`, or
`possible_cap_dedupe_or_not_archived_gate`.

Do not implement lane 2 or lane 3 write behavior until lane 1's rejection
reasons are visible and at least three fresh archived samples have been checked.

## Scene Mode UI Contract

Scene Mode is the default Alan-facing world view for v0.1. It should read like a
visual-novel stage, not a debug map squeezed behind UI chrome.

Current contract:

- Scene object/hotspot tags stay anchored to their real scene positions. They
  are UI-only hooks/event seeds and should not be moved into generic toolbars.
- The `場景中：...` occupant summary belongs near the upper center of the stage,
  separate from prop tags and bottom action controls.
- Character standee status cards must render above character art so activity,
  emotion, and quiet-line previews remain readable.
- Alan appears as a scene character only when an active Alan player exists in
  the world. If Alan is away / not currently online, Scene Mode should not show
  Alan's portrait. Other HUD text may still explain Alan's away status.
- Alan's scene render uses a transparent-background asset; baked checkerboard
  or photo-card backgrounds are not acceptable for the stage.
- The Pixi map is no longer exposed in the Alan-facing v0.1 UI. Keep Scene Mode
  as the only world surface unless a future debug-only route explicitly needs
  the old coordinate map.

## 2026-06-12 Night — Memory Quality + 睡前回響 (Claude, with Alan)

Context: Alan's first real fresh-world chat with 海 (53 turns, 21:29) felt warm
but "不夠好". Honest diagnosis: the failures were mostly **generation**, not
memory — (1) the model fabricates world facts every turn (紅椒粉, AI社海報, a
2022 club key, 素紗 borrowing a skirt) and keeps inventing NEW ones after each
correction; (2) stage-direction narration in every line (Alan complained
directly); (3) a structural motif — almost every reply ends 「要現在，X 嗎？還是
…」; (4) objective facts about Alan/world remembered wrong (thinks 海 lives in
the dorm, school/student roles reversed). The curry sleepNote DID work (海
raised the promise unprompted), but she stayed evasive about it.

Key product judgment recorded: **do NOT enable nightly reflection on top of
fabricated daily memory** — it would harden hallucinations ("海 lives in the
dorm") into permanent traits. Memory quality must lead reflection.

### Late-night follow-up — soul-grounded memory deepening (Claude, with Alan)

Built on top of the same evening, after Alan pushed the memory/soul model deeper:

- **Subjective summary deepened.** The first-person `rememberConversation`
  prompt no longer just tags like/dislike. It now captures the one concrete
  moment that mattered, the specific emotion (被看見 / 被當工具 / 鬆一口氣 / 愧疚…),
  whether it shifted how the speaker sees the other, and a forward intention
  (the seed of Drift) — with an anti-confabulation clause. This is the text that
  gets embedded, recalled, and reflected on, so depth here compounds everywhere.
- **Soul-grounded LLM residue, live for all six pilots.** Residue was previously
  hand-written regex for 海/真晝/天澤 only. `llmResidueSentence` now derives the
  trace from each character's authored five-layer soul: the model reads the
  transcript through the speaker's Private Self (giisProfiles `stakes`) **and the
  other party's Public Self** (role / persona / communication style), because a
  residue lives at the meeting point of *what the other actually did/showed*
  (their surface) and *what it touched in me* (my fear/desire). It writes one
  bounded trace or answers 無 (the prompt is its own resonance gate, so the three
  characters that never had a hand-written branch are covered). Output passes
  every existing guard (slogan / system-phrase / stage-direction / length) plus
  the downstream repeat-pattern and recall-correction gates. Provider failure
  falls back to the deterministic sentence; an honest 無 is respected. Togglable
  via `UNDERWORLD_RESIDUE_LLM=false`. `RESIDUE_PILOT_NAMES` expanded 3 → 6.
- **校園手帳「心跡」inspection tab.** Read-only surface that pairs each recent
  conversation with the trace it left (or 沒有沉澱下來). Text only, no gauges
  (honours E3). This is how Alan judges whether an exchange actually touched a
  character's soul — read the conversation next to its trace, no score needed.
  `school:notebookSoulTraces`.

Design note (the LLM's "subjective analysis" is generative, not a score): the
residue decision IS the subjective judgment — one human-readable line or 無. We
deliberately did NOT build a scoring dashboard; per E3 the soul layer is read as
text, never quantified into gauges.

Open UI question (Alan, deciding): move 回響 + 心跡 out of the daily 校園手帳 into a
conversation-adjacent "soul/memory" surface so they sit next to 對話 for
comparison, and so a conversation can eventually show its per-participant
subjective memory + residue side by side (same event → divergent souls — the
research question in `docs/paper/subjective-rebedding/SUBJECTIVE_MEMORY_REBEDDING_IDEA.md`). Leaning
yes; de-crowds the notebook back to 今日/日程/約定.

Shipped earlier the same evening:

- **Subjective first-person memory (the per-character interpretation Alan
  asked for).** `rememberConversation` now uses the LLM first-person summary
  ("summarize from my perspective; did I like/dislike this") for Alan-facing
  chats and pilot residue pairs, instead of the shared deterministic template.
  Same event → each participant remembers it differently. NPC small talk stays
  deterministic for cost. Falls back to template on provider timeout. The
  earlier `conversationEligibleForLLM` gate already removed NPC↔NPC chatter, so
  this is scoped by construction. `convex/agent/memory.ts`; tsc + 26 memory
  tests pass. Takes effect on next Convex deploy.
- **Nightly reflection "睡前回響" — built, default SHADOW.** Refactored the
  proven `reflectOnMemories` into compute (`computeReflectionInsights`) + write,
  and added public action `agent/memory:nightlyReflectionForWorld` plus
  `npm run underworld:nightly-reflection`. Once per local day, each pilot reviews
  the day's memories and the LLM previews ≤3 long-term consolidations. SHADOW
  writes nothing (so Alan reads the preview and catches fabrications first);
  `--write` needs the approval token and skips characters who already reflected
  today (idempotent). The reflection prompt now carries an **anti-confabulation
  guard**: never invent world facts / who-said-what; promote only the
  character's own stance. Report at `umi/reports/nightly-reflection-latest.md`.
  tsc + 31 memory tests pass. This is the in-world version of E2; the old
  manual `sleep-consolidation` heuristic stays as the offline classifier.

Alan's two design intents map cleanly:

1. "對話完判斷哪些要被記住 + 情緒波動" → the immediate pass (rememberConversation
   retention classify + residue), now upgraded to subjective summaries.
2. "睡覺前是另一次回響，讓事情被記住" → nightly reflection above (the second,
   consolidating echo).

Sequencing (Claude's recommendation, Alan to confirm):

1. Land subjective summaries + let the world run a few days so memories
   accumulate in the new (subjective) shape.
2. Run nightly reflection in SHADOW nightly; read the preview. Expect it to
   surface the fabrication problem concretely.
3. Fix generation (anti-fabrication grounding + stage-direction/motif guards —
   Codex's conversation.ts lane) BEFORE enabling reflection `--write`.
4. Then enable `--write`, and only after that flip real embeddings.

Embeddings (real semantic, build b) — assessed, NOT flipped yet. `full` mode
already wires to Ollama `mxbai-embed-large` (1024-dim) via `fetchEmbedding`;
it's deterministic only because the global memory mode is deterministic. Hold
because: (a) requires the Ollama embed model pulled + adds latency/cost per
memory; (b) deterministic→full is a representation change, so old
deterministic vectors won't be comparable to new real ones — retrieval is
degraded across the boundary until memories are re-embedded. Right order: turn
embeddings on AFTER subjective summaries are the norm (embedding rich subjective
text is high value; embedding deterministic templates is not), and plan a
re-embed pass. Config when ready: `MEMORY_EMBEDDING_MODE=full` with the embed
model available.

## 2026-06-12 State Sustainability Reset

Fresh-world recovery got the app moving again, but it is not the long-term
answer. Underworld v0.1 now treats sustainable state retention as a product
requirement: characters cannot be forced to forget themselves every 20 days.

Accepted direction:

- Preserve character memory, emotional residue, relationship continuity,
  archived dialogue, daily state, and Alan-facing history.
- Do not solve local DB growth by deleting the soul surface first.
- Treat old runtime/scheduler/job history, processed inputs, soft-deleted world
  versions, repeated full-world patches, and large local storage artifacts as
  the cleanup candidates.
- Recover the archived old world as continuity data before relying on fresh
  world samples as the only history.

Current evidence:

- Old state was archived at
  `/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town-archive-20260612T085455-pre-fresh-world`.
- Copy-only diagnostics showed the archive was structurally readable, but a
  compacted sandbox boot still failed to bind port 3210 within 60 seconds.
- The largest bloat source was Convex internal scheduled job args, not
  character memories.
- cc review identified `agentDoSomething` scheduled args carrying full map and
  character snapshots as the highest-leverage byte-rate source.

Next state-health order:

1. Slim `agentDoSomething` scheduled args to IDs only and load current context
   inside the action. Completed 2026-06-12 09:32 CDT.
2. Keep the read-only state audit in the loop:
   `npm run underworld:state-audit`. Post-T1 active evidence shows newest
   scheduled args are now small ID-only / conversation / run-step payloads,
   while the old archive still has repeated 95-98 KiB map/player/agent snapshot
   payloads near its final rows. The audit is live-DB lock tolerant as of
   2026-06-12 10:12 CDT and last passed against the active backend with sqlite
   45.9MB / state dir 86MB / 1,254 scheduled-arg rows scanned.
3. Build export-only archive continuity recovery from the 18GB old state.
   Completed first pass 2026-06-12: `npm run
   underworld:archive-continuity-export` produced
   `umi/exports/archive-continuity-latest/` with 56,525 exported continuity
   rows in about 40 MiB, including archived conversations, messages, memories,
   school timeline, notifications, participated-together rows, world-pressure
   snapshots, Alan behavior profiles, and character descriptions. This is not
   an import and must not count as fresh v0.1 evidence.
4. Audit the export package for fallback pollution, stale renamed characters,
   and which Alan/Umi/Mahiru/Tianze memories are worth curated restoration.
   Current `npm run underworld:continuity-package-audit` verdict is
   `REVIEW_REQUIRED`: 14 fallback/pollution-like hits and 8,066 legacy
   CaoCao/Liu Bei-era hits require filtering/remap before import. Candidate
   packet tooling now exists: `npm run underworld:continuity-restore-candidates`
   writes capped Tier 1 / review-only / rejected candidate files, and
   `npm run underworld:legacy-continuity-import-plan` writes a dry-run-only
   `legacyContinuityEvidence` plan. cc reviewed the first 24-row packet and
   found it too duplicated / motif-heavy, so the current plan defaults to 12
   rows and skips food-care motifs, stage-direction leaks, repeated motif
   families, duplicate summaries, and non-first-restore kinds. Nothing is
   imported yet; Alan approval is still required before any live write.
5. Design the live `legacyContinuityEvidence` table/read path only after the
   dry-run plan is reviewed. First live import must be small, non-prompt-facing
   by default, `legacyArchive: true`, and excluded from fresh v0.1 eval windows.
   Schema and a dry-run validator are now implemented:
   `npm run underworld:legacy-continuity-import` validates 12 rows and writes
   `umi/reports/legacy-continuity-import-latest.md`. Alan approved the first
   live evidence write at 15:19 CDT: 12 rows are now stored in
   `legacyContinuityEvidence`, with 0 prompt-facing and 0 fresh-eval-eligible
   rows. This table remains an isolated evidence vault, not character brain.
6. Study sleep/consolidation before adding any live memory promotion.
   Completed first dry-run 2026-06-12 15:40 CDT:
   `npm run underworld:sleep-consolidation` reads recent conversations and
   classifies them as `long_term_memory_candidate`,
   `emotional_residue_candidate`, `short_term_context`, `forget_or_ignore`, or
   `needs_human_review`. Latest report:
   `umi/reports/sleep-consolidation-latest.md`; export:
   `umi/exports/sleep-consolidation-latest/`. It checked 50 recent
   conversations and produced 1 long-term candidate, 2 emotional-residue
   candidates, 30 short-term context rows, 4 forget/ignore rows, and 13
   human-review rows. Convex writes: 0. Prompt-facing writes: 0. This is the
   beginning of the sleep system, not live brain rewiring. cc reviewed the
   classifier at 15:44 CDT and Codex accepted the no-write fixes: low-signal
   repeated noise fades, same-day duplicate motifs demote, object-prop churn is
   family/repeat-based, and food/closing-line motifs cannot become long-term
   candidates.
7. Add a bounded `sleepNotes` read gate between legacy evidence and prompts.
   Completed first pass 2026-06-12 16:09 CDT after cc read-only review:
   `sleepNotes` is a separate table from `memories`, imports require explicit
   approval, rows are capped/deduped, legacy rows must keep
   `freshEvalEligible=false`, and prompts read at most one promoted note for the
   current speaker/partner. First curated restore wrote exactly 2 rewritten
   notes from old evidence: one for 海/真晝 and one for 真晝/天澤. Raw archived
   conversations, debug summaries, memories, embeddings, and motif-heavy rows
   are still not imported. Reports:
   `umi/reports/20260612T205950Z-workload.md` and
   `umi/reports/sleep-notes-import-latest.md`. The command is
   `npm run underworld:sleep-notes-import` for dry-run and
   `npm run underworld:sleep-notes-import -- --write --approval=alan-approved-sleep-notes-2026-06-12`
   for the approved curated import.
8. Add diff-before-patch behavior only where it is clearly no-op safe, then
   study the bigger `worlds` / `engines` / `inputs` version churn separately.
9. Replace age-only memory vacuum with soul-preserving retention and
   cursor-aware runtime cleanup.
10. Add daily state-size / growth-delta health reporting.

Fresh reset is allowed only as emergency recovery with archive preservation. It
is not a normal continuity strategy.

## 2026-06-12 v0.1 Evidence Layer

The current v0.1 proof is deliberately narrow:

conversation -> emotional residue -> bounded experience log -> tiny sleep-note
candidate -> later behavior check.

Current evidence pilot:

- `海`
- `真晝`
- `貓貓`
- `天澤`
- `一之瀨`
- `祥子`

Do not use Asuna, Mai, Liu Bei, CaoCao, or other legacy/absent characters as
v0.1 experience-log evidence unless Alan explicitly changes the pilot set.

Completed implementation:

- `experienceLogs` is now the core bounded evidence layer for the six current
  pilots only.
- Runtime aliases normalize to the current pilot names: `Umi -> 海`,
  `Mahiru / Mahiru Shiina / 椎名真晝 -> 真晝`, `Maomao -> 貓貓`,
  `Tianze -> 天澤`, `Ichinose -> 一之瀨`, and `Sakiko -> 祥子`.
- Raw legacy names such as `明日奈`, `麻衣`, `劉備`, and raw `曹操` are rejected
  by the experience-log writer.
- The writer only runs after `memory.ts` has loaded and accepted an archived
  conversation; its internal call contract now requires
  `sourceKind: archivedConversation`.
- Guards reject fallback/provider abort markers, deterministic drift,
  wrong-addressee output, stage-direction leakage, obvious echo/motif loops,
  prompt/system leakage, and non-current pilot pairs.
- Caps are enforced inside the Convex mutation: max 2 logs per character per
  local day, max 1 log per source conversation per character, dedupe by event
  prefix/residue prefix, and no embeddings.
- `underworld:observe:daytime-samples` now requires archived samples and the
  observe report compares fresh transcripts against experience-log rows.
- `eval:soul-triad` now includes all six current evidence pilots rather than
  silently filtering out `貓貓` or `祥子`.
- `underworld:experience-sleep-promote` remains dry-run by default and prepares
  at most one tiny candidate per pilot character; live write still requires
  explicit approval.

Latest evidence run:

- World baseline: `underworld:runtime-preflight` PASS,
  `underworld:afternoon-world-ready` resumed inactive -> running,
  `underworld:state-audit` reported db 172.3MB / state 454MB, and
  `school:debugState` returned the live six-character roster.
- Fresh archived samples: 4.
- Experience logs: 1 fresh conversation (`一之瀨 / 貓貓`) created 2 bounded logs.
- Rejections/statuses: one sample was blocked as
  `obvious_echo_or_motif_loop`; two were not written because of cap/dedupe or
  no qualifying residue.
- Sleep bridge dry-run: 12 logs read, 2 tiny candidates prepared, 0 writes.
- Quality remains incomplete: recent eval was 0 PASS / 2 WARN / 2 FAIL due to
  repeated everyday-object motifs and weak character voice in the fresh window.

Next evidence question:

Can a later clean conversation briefly and naturally reflect one specific
experience-log residue without repeating the same object, slogan, or therapy
style? If yes, the v0.1 loop is functioning. If not, fix only the smallest
fresh-evidence-backed hygiene issue or write a proposal.

Evening gate result (20:16 CDT): the current machine completion audit is now
**PASS**: 0 fail / 0 pending / 0 deferred / 8 pass. The final push collected
fresh archived 海/真晝 samples (`conversation-c:7038`, `conversation-c:7057`,
and follow-up `conversation-c:7152`) after two non-海/真晝 focus attempts timed
out without archived samples. Fresh-window `life-signals` is PASS /
`life_signal_observed`, with 3 conversations, no repeated surface lines, no
prop echo, and pilot expected action match rate 1.00. `eval:conversation:recent`
is still not pretty (0 PASS / 2 WARN / 1 FAIL) and should remain a quality
caveat, but it no longer blocks the current completion audit. Treat this as
human-review-ready v0.1, not perfect v0.2 readiness.

Closing caveat patch (20:30 CDT): two issues found after the PASS are now
covered by code and tests.

- Alan/海 orphan timeline: fresh diagnostics showed Alan-side messages at
  20:06 while the default world was `stoppedByDeveloper` and engine-running
  false. `messages.writeMessage` now schedules the post-write wake with an
  explicit human-input force flag, so Alan typing into chat can wake a
  developer-stopped world while passive wake attempts still respect the stop.
- 海/真晝 motif relay: fresh samples c:7038 / c:7057 / c:7152 showed a
  hand/quoted-phrase relay around `手還舉著`, `這句話`, `明天簡報第一行`,
  and `收進口袋`. The motif guard now warns away from that family and the
  output guard aborts the relay once it repeats, without banning ordinary body
  noticing.

Verification: targeted Jest
`npm test -- --runTestsByPath convex/messagesWake.test.ts convex/agent/conversationMotifGuard.test.ts`
passes 40/40, full Jest passes 233/233, `npm run build` passes with only the
existing Vite chunk-size warning, `npm run underworld:harness:self-test` passes,
and `npm run underworld:v01-completion-audit` remains **PASS** at 0 fail /
0 pending / 0 deferred / 8 pass.

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

- **Paper 1** (feasibility / systems contribution, `docs/paper/emotional-residue/manuscript/main.tex`)
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

Evening continuation (20:10 CDT): the higher-level restaurant policy is now
implemented in the dialogue guard path. Compact and rich character prompts add
a scene-aware restaurant rule only after prior turns already leaned on food,
cutlery, eating, leftovers, or empty-seat cues; output repair now aborts generic
food-object relay if the model tries to continue the same food/cutlery/eating
move under a new food name. This is intentionally narrower than a prompt
rewrite and broader than adding one-off words like `水煮蛋` / `布丁`. A narrowed
cc read-only review flagged that the first output guard was broader than the
scene-gated prompt, so the generic abort cue set was tightened to avoid
blocking ordinary non-restaurant breakfast/tea chatter. Verification:
`npm test -- convex/agent/conversationMotifGuard.test.ts` (34/34) and
`npx tsc --noEmit --pretty false` pass. Current status is still **not complete**
until a non-quiet-window fresh runtime window shows several core pairs avoid
hard mirror/motif failures.

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
- Do not make v0.1 "remember more" by dumping larger raw history into every
  prompt. The immediate goal is **more relevant recall**, not more context:
  select the right 1-3 memories/residues/commitments for the current partner,
  scene, event thread, and character soul cue.
- Deep soul should come from relevance and behavior, not long biographies.
  Runtime prompts should remind a character of the current relational pressure
  (for example Umi facing Alan vs. Umi facing Mahiru), then let the model speak
  briefly. If a memory is not actionable in the current scene, leave it out.
- Alan-facing chats should prioritize Alan-related commitments, corrections,
  and emotional residues. NPC-to-NPC chats should prioritize the other speaker,
  the current scene, today's event thread, and unresolved residues. The eval
  question is "did the past surface naturally?", not "how many past facts were
  included?"
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
  2. **Memory relevance gate** — keep prompts small by ranking candidate recall
     against current partner / scene / event / soul cue, then pass only the top
     1-3 usable traces. This should be deterministic or lightly scored first;
     do not add a high-frequency LLM summarizer just to decide every line.
  3. **Anti-confabulation** — when the human corrects an invented recall
     (e.g. "不是，我說的是咖哩飯"), down-weight the false memory instead of letting
     the fabrication persist as canon. (Observed: 海 recalled a line she herself
     invented on 6/4.)
  4. **Importance-weighted recall**, not recency-only — use the existing
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

- C1 約定頁 hosted by 海 inside the 校園手帳 — **SHIPPED 2026-06-11 evening**:
  the three top-left pills (海/今日/日程) are now one 「手帳」 pill opening a
  tabbed notebook (今日 = 海的判讀 + campus feed with player-language filter
  labels; 日程 = unchanged; 約定 = new tab fed by `school:notebookCommitments`,
  deduped commitments across rememberers, 與你的約定 grouped first, expired
  chips). One unread badge. Fulfilled-marking still pending C2.
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
  diary, not raw memory dumps. **Mechanism shipped 2026-06-12 night as nightly
  reflection (睡前回響), default SHADOW** — see top section. Remaining: read
  shadow previews, gate generation quality, then enable `--write`, then have
  prompts read the consolidated reflection rather than raw memory.
- E3 Relationship drift: residue nudges trust/affection in small steps; UI
  shows text trends (最近比較親近/疏遠), never gauges.
- E4 Gossip with provenance: cross-character memory spread carries 「聽海說的」
  source tags (schoolRumors plumbing exists).
- E5 Importance-weighted residue recall (commitments fixed; residues are still
  recency-only).

### Suggested order

A-slice (done) → B1+B2+C1 (props + 約定頁; one week to a visible 「世界記得我」
moment) → C2 (fulfillment, with the curry-dinner data) → E1+E2 → D → E3-E5.

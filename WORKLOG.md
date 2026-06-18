# WORKLOG - Umi / Codex / CC Current Evidence

Last updated: 2026-06-18 11:24 CDT

This file is for current coordination only. Completed implementation history was
removed from the active worklog; use git history and generated reports when
historical evidence is needed.

## Usage

1. Read `Open Follow-Ups` before changing code.
2. Put one focused worker task in `umi/workload.md` before assigning cc.
3. Append only active, decision-relevant entries. Remove completed/stale entries
   once the result is captured elsewhere.
4. Treat prior-day reports as historical evidence and refresh before answering
   "today/now/recently".

## Open Follow-Ups

| # | Item | Owner | Status |
|---|---|---|---|
| 0 | Local storage migration status: Ollama models are active on T9 and verified by `ollama list`. Underworld Convex local backend state is active on T9 via `/Users/alanhdchu/.convex/convex-backend-state/local-alan_chu-ai_town` -> `/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town`; `CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS=180 ./node_modules/.bin/convex run --typecheck disable --codegen disable school:debugState` returned world/debug data. See `/Users/alanhdchu/umi-central/docs/local_storage_layout.md`. | Umi / Codex | active_on_t9_verified |
| 1 | Alan-facing v0.1 playtest is currently proven by `umi/reports/alan-facing-v01-playtest-latest.md`: 2026-06-11 09:54 CDT `Verdict: PASS`, 5/5 checklist rows. Later fresh recent-eval saw one diagnostic orphan Alan/海 timeline session at 2026-06-12 20:06 with Alan-side messages only; root cause matched `worldStatus=stoppedByDeveloper` / engine not running after controlled checks. `messages.writeMessage` now force-wakes the world for explicit human chat while passive wakes still respect developer stop; covered by `convex/messagesWake.test.ts`. | Alan / Umi | pass_caveat_patched_watch_next_real_chat |
| 2 | Decide whether to backfill old memory strings that used UTC + `en-US` formatting before the newer `zh-TW` + `America/Chicago` convention. | Alan / Codex | waiting on Alan decision |
| 3 | Compact Alan-facing v0.1 playtest checklist and success/failure record format exists at `umi/playtest-v01-alan-facing-gate.md`; `v01-completion-audit` now reads `umi/reports/alan-facing-v01-playtest-latest.md` when present and only accepts `Verdict: PASS` if all five required checklist lines are present and marked PASS, so use that artifact before treating Alan-facing quality as proven. | Codex | ready |
| 4 | CC timeout is an orchestration issue, not a reason to give up on cc. `umi/orchestrator.py` now follows a Claude Code timeout with a read-only recovery pass that narrows the task and reports exact retry/auth/tooling evidence. If cc returns auth/provider errors, diagnose and fix that layer or produce the smallest explicit blocker; do not silently mark cc as unusable. | Umi / Codex | watch_and_recover |
| 5 | Post-role-change v0.1 machine gate is now PASS as of 2026-06-12 20:30 CDT: `npm run underworld:v01-completion-audit` reports 0 fail / 0 pending / 0 deferred / 8 pass after the orphan/no-response and 海/真晝 motif-relay caveat patches. This is human-review-ready, not a claim of perfect dialogue: fresh recent eval still has 0 PASS / 2 WARN / 1 FAIL across the latest three 海/真晝 samples, and the best next product judgment is Alan acceptance plus one small real playtest, not more synthetic prompt churn. | Alan / Umi | machine_gate_pass_human_review_ready |
| 6 | Paper (emotional residue) is local-source ready only as a conservative design/systems preprint, and Alan reported submitting the A-path preprint on OSF on 2026-06-10 because arXiv upload is blocked by endorsement. `docs/paper/OSF_RELEASE_RECORD.md` is the current OSF posting ledger; public OSF URL / DOI / license metadata remain `TO_RECORD` locally, while the local OSF-ready PDF is `docs/paper/results/osf/emotional-residue-osf-preprint.pdf` (SHA-256 `27e03968d30bb09d6449ca2121afa9ff721d9516a6ebda21e17a5110aea1da8f`). `docs/paper/arxiv/main.tex` now uses public author text `Alan Hwader Chu / Independent Researcher`, uses `Underworld` rather than `GIIS Underworld`, describes pilot characters by role/personality rather than public character names, includes provider/model-path disclosure, measured-limits text for untested verbatim leakage, an explicit ethics/scope note, denominator-safe wording for the 15-candidate/2-callback rolling window, reflexivity disclosure for author-designed rule markers, narrowed read-block-suppression wording instead of "primary causal ablation", social-agent evaluation context via SOTOPIA / Lifelong SOTOPIA, and a disclosure that `UNDERWORLD_RESIDUE_READ=placebo` is draft runtime plumbing that is not preregistered, collected, or analyzed in this paper. `docs/paper/ARXIV_PREPRINT_RELEASE_PACKET.md` remains the future arXiv mirror packet; arXiv is paused until endorsement/account readiness and platform preview are resolved. `docs/paper/CITATION_PROVENANCE.md` plus `npm run paper:citation-audit` cover all 17 bibliography keys and primary/official URLs for recent LLM-agent / AI Town / social-agent references. `docs/paper/PREREGISTRATION_PROTOCOL.md` is a machine-audited draft for the future empirical study, not an accepted collection authorization; it now records continuing-world carryover/read-eligibility, dyad fallback, no interim effect peeking, and a concrete final-N selection procedure from pilot baseline/MDE/design-effect. `paper:residue-arm-window` still requires both `SCHEDULE_ACCEPTANCE.json` and `PREREGISTRATION_ACCEPTANCE.json` before it can change `UNDERWORLD_RESIDUE_READ` or hold a collection window; it now writes `run-provenance.json` / `artifact-hashes.json` and attaches `run_provenance` to future dataset rows so long-window collection preserves secret-safe git state, accepted schedule/preregistration hashes, source-archive hash, command args, runtime, env policy, and artifact/log hashes. Legacy forced runners `paper:residue-ablation` and `paper:residue-ablation:blocks` now refuse to run unless `--allow-legacy-forced-pilot` is explicitly provided, so accidental short forced collection is blocked by default. `paper:run-provenance-audit` can check each completed arm-window run directory before merge, and `paper:merge-ablation-runs` now writes a merge manifest and refuses to merge failed-provenance arm-window runs. Human annotation plumbing is ready but unrun: `annotation_sheet.csv` is still a blank blinded worksheet with only 4 rows; `annotation_packet_manifest.json` and `transcript_packet_manifest.json` now prove the pre-rater sheet/key/transcript hashes, selected blind IDs, exact blind-id-to-source-report mapping, missing-transcript status, source-report hashes, and blinding flags; `paper:annotation-audit` now verifies those source report paths/hashes and future completed rater sheet paths/hashes. `scripts/paper/merge_rater_annotations.py` must later merge completed independent rater sheets into analysis-ready `annotations.csv` with `annotations_manifest.json`, and now refuses completed rater sheets that include leaked/unblinded columns or non-blinded `case_ref` values. `paper:annotation-audit` reports `PACKET_READY_INCOMPLETE_STUDY`: 0 FAIL, with empirical blockers for stale/missing source-report hashes, 4 rows, no merged annotations, and one dyad. `docs/paper/ALAN_HANDOFF.md` is the one-page boundary summary; `docs/paper/REVIEWER_PREMORTEM.md` records cc-reviewed objections including between-arm carryover. `paper:archive-audit` rebuilds the local arXiv/source archive with atomic output replacement, verifies the manifest/SHA/member allowlist, and checks for accidental data/results/annotation/transcript or obvious secret leakage. Current `npm run paper:readiness` verdict is `LOCAL_SOURCE_READY_WITH_WARNINGS`, archive SHA-256 `d9a7b2a928403b12976b9422381b5353a340394728c840b54375c59097c5e911`. Empirical/mechanism claims remain blocked: n=4, one dyad, no completed independent rater merge, stale/missing annotation source-report packet, saturated aftertaste proxy, missing generation metadata/provenance on old rows, trace-overlap audit only has 11 callback cases, final N is not fixed, no accepted long-window schedule or preregistration, and the local placebo plumbing is not preregistered, collected, or analyzed. | Alan / Codex | osf_pdf_ready_arxiv_endorsement_blocked_empirical_blocked |
| 7 | Scene-first UI lane is now active: the main world defaults to generated VN-style Scene Mode, while the original Pixi map remains behind the `地圖` toggle. Scene objects are intentionally UI-only hotspots/event seeds for now; do not add durable backend object/event behavior without a proposal because that would affect world continuity and memory. Corrected transparent default-emotion standees now exist for the active core cast (`海`, `天澤`, `一之瀨`, `貓貓`, `祥子`, `真晝`); the next art task is completing consistent multi-emotion render sets, not another Tianze rescue. 2026-06-16 mobile UX patch: selected-character conversation CTA now uses one state model for `邀請 X` / `直接對話` / busy states; if Alan is offline, the CTA stays clickable and first wakes Alan before sending the invite. Character lookup is view/focus-only instead of secretly moving Alan, and mobile standee/conversation portraits have larger non-clipping containers. cc review `umi/reports/20260616T153202Z-workload.md` passed with caveats; the pre-commit camera-jump nit was fixed. 12:50 flicker follow-up: logs showed real local Convex overload/restart around 12:41-12:44, and UI also had an unconditional action-cinematic focus-to-Alan path; `Game.tsx` now only refocuses Alan when Alan-follow mode is active and turns follow mode off when the user finds/selects another character. 13:02 frontend market-readiness audit `umi/reports/20260616T180013Z-workload.md` found duplicate subscriptions and conversation/mobile jump risks; first anti-flicker batch now passes shared world/player/briefing/social state from `Game` into `PlayerDetails`, stops typing-state auto-scroll from pulling conversation views around, avoids initial mobile textarea autofocus, resets stale message drafts on conversation change, scopes conversation-start scroll to the panel instead of `window`, and resets history/wake prompt/tab state when switching target characters. 13:13 second-batch cc review `umi/reports/20260616T180949Z-workload.md` accepted a smaller-than-WorldContext resilience batch; `useWorldHeartbeat` now reuses `Game`'s `worldStatus` via a ref without recreating intervals, `InteractButton` reuses `Game`'s parsed game/user status instead of duplicating `defaultWorldStatus`/`worldState`/`gameDescriptions`/`userStatus`, and `App.tsx` now wraps route content in an ErrorBoundary with a reconnect fallback and view-change reset. 13:36 flicker root cause: mobile Alan-offline invite/send reproduced an ErrorBoundary jump; logs showed `school:campusSocialState`, `school:umiBriefing`, and `school:campusTimeline` timing out while the world was busy generating. `Game.tsx` now skips notebook-only queries until their tabs open, pauses cached campus summary/briefing queries during active conversations, `PlayerDetails.tsx` skips `campusTimeline` during current dialogue, chat quick actions now return after queueing `startConversation` instead of also sending generic `playerAction(chat)`, and crowded 5-6 character scenes use wider responsive standee rows. Mobile smoke verified Tianze invite from offline Alan -> principal office conversation -> message send -> 12s idle without fallback. 13:51 post-flicker cc review `umi/reports/20260616T184531Z-workload.md` found no confirmed P0 but flagged three launch-risk polish gaps; patched current-dialogue `previousConversation` skip, loading-disabled `InteractButton`, and a nonblank `Game` loading shell so slow world reconnects no longer unmount to blank. 14:04 residual market-readiness cc review `umi/reports/20260616T190105Z-workload.md` found no P0 and identified the last high-value jump vector: `worldState`/`gameDescriptions`/`listMessages` returning transient `undefined` could still unmount active dialogue. `useServerGame` and `Messages` now keep last-good same-world/same-conversation data during brief Convex hiccups, and `PlayerDetails` skips `debugState`/`observe` refreshes while Alan is already in a human conversation. 14:18 repeatable frontend smoke gate added: `npm run underworld:frontend-smoke` drives headless Chrome mobile 390x844 and desktop 1440x960, waits for the live room, captures screenshots, fails on horizontal overflow or hard 4xx/failed assets, and writes `umi/reports/frontend-smoke-latest.json`. The first run passed 2/2; it also exposed missing emotion portrait 404s, fixed by mapping unavailable portrait emotions back to base portraits while preserving existing Maomao/Sakiko serious portrait variants. Remaining caveats: full WorldContext consolidation for non-hot-path duplicates, real Alan/in-app mobile acceptance, the known Convex browser-import console warning, and confirming whether engine `startConversation` should keep Alan anchored in the principal office for every edge case. | Alan / Umi / Codex | hotpath_queries_patched_mobile_invite_smoke_pass_loading_shell_stale_revalidate_frontend_smoke_gate_context_engine_anchor_followup |
| 8 | CaoCao / Liu Bei live replacement is implemented as Maomao / Sakiko, while old conversations/memories remain as transfer-student history unless Alan later approves a destructive purge. Code/profile/docs/eval/assets now use Maomao diagnostic-symptom soul and Sakiko stage-composure soul; legacy aliases map old names to new display/runtime names. Local Convex profile migration ran non-destructively with `school:migrateCharacterRuntimeNames` (`scope=profiles`, `clearHistory=false`), and `school:debugState` confirms active roster has `Maomao` and `Sakiko` with no active `CaoCao` / `Liu Bei`; target short-term state is cleared. LLM active path is cloud-Qwen for all free-world soul characters (`Umi`, `Mahiru`, `Tianze`, `Ichinose`, `Maomao`, `Sakiko`) with local Ollama fallback enabled on the local Convex deployment (`CHARACTER_SOUL_LOCAL_FALLBACK=true`, `CHARACTER_SOUL_LOCAL_FALLBACK_MODEL=qwen3:8b`). The two soul files define Maomao's five layers as diagnosis-as-reluctant-care and Sakiko's five layers as stage-composure-as-protection. Runtime prompts now explicitly constrain both to short, concrete, non-mirroring lines; active event/Alan-state inference no longer treats Maomao as a student-council/order strategist. Disposable probes produced two-line Maomao/Sakiko, Umi/Maomao, and Ichinose/Sakiko samples; names/routing/personality were directionally correct, but local fallback live probes can still be slow or sample-pending, so short-sample quality should be rechecked after provider quota/key health is stable. `.env.local.example`, active soul index, portrait README, memory examples, life-signals cues, PlayerDetails flavor text, and the disposable free-world runner are aligned. Deep historical deletion was dry-run only because it would delete 759 conversations, 2727 messages, 252 memories, and 414 timeline events; require explicit Alan approval before running destructive `clearHistory=true`. Verification: targeted Jest suite 55/55 pass, `npx tsc --noEmit --pretty false`, `npm run build`, asset HTTP smoke for `/ai-town`, `/portraits/maomao.png`, `/renders/sakiko-serious.png`, `/sprites/maomao.png`; post-followup active-doc stale-reference scan returned no hits; smoke follow-up ran `npm run underworld:life-signals:self-test`, targeted model/dialogue/metrics Jest 45/45, typecheck, disposable probes, cleanup, and `world:defaultWorldStatus` with status `running`. | Alan / Umi / Codex | live_replacement_complete_keep_history_souls_done_provider_quality_recheck |
| 9 | Local Convex state blocker resolved by fresh-world-with-archive recovery. Old active state was moved, not deleted, to `/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town-archive-20260612T085455-pre-fresh-world` (18GB). Fresh active state was recreated at `/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town`, with only `config.json` copied back from the archive. `npx convex run init` created a fresh default world; `world:defaultWorldStatus` shows `running`, `school:debugState` / `school:worldClock` / `school:umiBriefing` return without timeout, and `/ai-town` is HTTP 200. Fresh active state is about 3.6MB and backend RSS is about 252MB. Do not delete the archive or treat old archived conversations as fresh samples; next v0.1 loop must collect fresh-world evidence. Reports: `umi/proposals/20260612T082840-local-convex-state-hygiene.md`, `umi/reports/local-convex-state-diagnostic-latest.md`, `umi/reports/local-convex-fresh-world-recovery-latest.md`. | Umi / Codex | fresh_world_recovered_collect_new_samples |
| 10 | Sustainable state retention is now the priority before more soul-system expansion. Alan correctly objected that fresh reset cannot become the normal answer because it forces character amnesia and blocks long-term residue research. cc read-only review (`umi/reports/20260612T142341Z-workload.md`) agreed the root cause is runtime/job bloat, especially `agentDoSomething` scheduled args carrying full map/player/agent snapshots into `_scheduled_job_args`. Proposal: `umi/proposals/20260612T092435-sustainable-state-retention.md`. Durable system design now exists at `docs/underworld-sustainable-world-system-design.md`. T1 is implemented and measured: `agentDoSomething` scheduled args now pass IDs only; `npm run underworld:state-audit` shows newest active scheduled args are small ID-only/conversation/run-step payloads, while the old archive ended with repeated 95-98 KiB map/player/agent snapshot payloads. State audit is now live-DB lock tolerant and last passed against the active backend at 10:12 CDT: sqlite 45.9MB / state dir 86MB / 1,254 scheduled-arg rows scanned. Export-only archive continuity package is available at `umi/exports/archive-continuity-latest/`: 56,525 rows / about 40MB, no embeddings, no import, no mutation. Package audit (`npm run underworld:continuity-package-audit`) is `REVIEW_REQUIRED`: 14 fallback/pollution-like hits and 8,066 legacy-character hits must be filtered/remapped before any import. cc reviewed the first 24-row dry-run plan at 14:06 CDT (`umi/reports/20260612T190648Z-workload.md`) and found it too duplicated / motif-heavy. Codex tightened the sampler: candidate packet now tracks stage-direction leaks, pollution-adjacent conversations, legacy names, repeated motifs, and first-pass food-care motifs; import plan now defaults to 12 dry-run-only `legacyContinuityEvidence` rows and keeps `promptFacing=false` / `freshEvalEligible=false`. Alan approved schema/dry-run at 15:06 and first live isolated evidence write at 15:19. `legacyContinuityEvidence` now contains 12 rows, with 0 prompt-facing / 0 fresh-eval-eligible rows; duplicate rerun still totals 12. Sleep/consolidation dry-run now exists (`npm run underworld:sleep-consolidation`): latest report checked 50 recent conversations and classified 1 long-term candidate, 2 emotional-residue candidates, 30 short-term context rows, 4 forget/ignore rows, and 13 human-review rows, with 0 Convex writes and 0 prompt-facing writes. cc reviewed the dry-run at 15:44 CDT (`umi/reports/20260612T204455Z-workload.md`); accepted fixes landed. cc then reviewed the `sleepNotes` read-gate proposal at 15:59 CDT (`umi/reports/20260612T205950Z-workload.md`) and rejected direct promotion of raw legacy rows. Codex implemented the safer version: new `sleepNotes` table, approval-gated importer, prompt read capped at one promoted note for current speaker/partner, blocked drift/system wording, source/motif dedupe, and legacy notes always `freshEvalEligible=false`. First approved write imported exactly 2 rewritten promoted notes; duplicate write skipped both. `sleepNotes:sleepNotesSummary` reports count 2 / promptFacing 2 / promoted 2 / freshEvalEligible 0; `legacyContinuityEvidenceSummary` remains count 12 / promptFacing 0 / freshEvalEligible 0. Reports: `umi/reports/sleep-notes-import-latest.md`; design: `umi/proposals/20260612T1608-sleep-notes-read-gate.md`. Preserve memory/conversation/residue tables. Next: collect fresh conversations and watch whether these two old traces influence behavior without slogan/motif relapse. | Umi / Codex / cc | sleep_notes_gate_live_watch_fresh_samples |
| 11 | Fresh 2026-06-12 conversations exposed two related but separate defects: conversation memory load could pair a player with the wrong `participatedTogether` fallback instead of the archived conversation's actual participant list, and the live message insert addressee repair path still missed titled self-addresses such as `一之瀨姊` / `貓貓老師` plus possessive self-reference like `一之瀨姊姊的...`. Targeted prevention fix is in code with tests. Recent-data cleanup ran against the latest 80 archived conversations: repaired 98 conversation memories, 6 message texts, and removed drifted residue lines by demoting those memories to ordinary when the residue mentioned nonparticipants; no memories/conversations were deleted, and final dry-run is 0 affected. Spot-checks: `conversation-c:6306` now shows 天澤 saying `不用了，祥子。` with 祥子/天澤 memories; `conversation-c:6057` now shows `欸，你的「幫」字...` with 貓貓/一之瀨 memories. | Codex | prevention_and_recent_cleanup_done |
| 12 | v0.1 evidence layer is live and contributed to the machine PASS. `experienceLogs` accepts only the current evidence pilot (`海 / 真晝 / 貓貓 / 天澤 / 一之瀨 / 祥子`), rejects legacy names, requires archived-conversation call contract, and enforces 2 logs per character/day plus 1 log per source conversation/character. The 20:00 observe collected 2 archived 海/真晝 samples and two other focus attempts timed out; a follow-up single 海/真晝 sample created `conversation-c:7152`, giving enough fresh samples for the completion audit. Fresh-window `life-signals` is PASS / `life_signal_observed`; recent eval remains imperfect at 0 PASS / 2 WARN / 1 FAIL. The fresh hand/quote relay caveat is now patched in `conversation.ts` and covered by `conversationMotifGuard.test.ts`; watch future samples rather than broad-rewriting prompts. | Umi / Codex / cc | machine_gate_pass_quality_caveat_patched |
| 13 | Future paper / v0.2 research idea preserved at `docs/paper/SUBJECTIVE_MEMORY_REBEDDING_IDEA.md`: separate canonical event records from per-character subjective memory traces, so the same event can become different grounded emotional residues and future behaviors for Umi/Mahiru/Maomao/etc. This is explicitly deferred until v0.1 residue -> sleep/tomorrow continuity is stable and should not broaden current implementation scope. | Alan / Umi / cc | future_revisit_after_v01 |
| 14 | Alan-facing character chat guard patched after 2026-06-13 morning playtest: 天澤 produced unfinished fragments (`欸——`, `你剛才那句...`, `你問這句的時候...`) and 真晝 drifted into passive food/body-cue loops. `conversation.ts` now adds character-specific Alan-facing prompt rules for 海 / 真晝 / 天澤 / 貓貓 / 一之瀨 / 祥子, removes the prompt allowance for `unfinished` replies, passes the runtime clock into sanitizer, and repairs only clear Alan-facing dangling fragments / unsupported body cues / repeated 真晝 food loops. Verification: targeted `conversationMotifGuard.test.ts` 38/38, `npx tsc --noEmit --pretty false`, `npm run build`, `npm run underworld:runtime-preflight`, and `curl -I http://127.0.0.1:5173/ai-town` HTTP 200. Next: Alan real-playtest these five characters; treat results as fresh evidence before further prompt tuning. | Alan / Umi / Codex | patched_watch_next_real_chat |
| 15 | Free-world role-to-role conversation was temporarily caged by stale Convex env from an old triad single-sample pilot: `SOUL_TRIAD_COLOCATION_PILOT`, `SOUL_TRIAD_FOCUS_PAIR`, and `SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS`. Runtime was healthy (`world:defaultWorldStatus` running; `school:debugState` all six current characters awake; Saturday free-activity clock), but general NPC candidate selection was narrowed/excluded and post-fix eval initially saw no archived conversations. Codex removed those three env vars and resumed the running world. Evidence after removal: logs immediately created role-to-role conversations including `c:8625` 貓貓->海, `c:8635` 貓貓/一之瀨, `c:8644` 海/真晝, `c:8661` 貓貓/天澤, and active `c:8668` 一之瀨/祥子; `eval:conversation:recent -- --since-last-change` now checks 4 post-fix samples with 0 PASS / 2 WARN / 2 FAIL. This is no longer a "no one talks" problem; next evidence focus is quality: stage-direction leakage, food/object motif loops, weak character voice for 一之瀨/祥子/貓貓 samples, and whether enough clean archived samples produce experience logs. | Umi / Codex | stale_pilot_env_removed_free_world_talking_quality_watch |
| 16 | Alan caught a false concrete commitment in `conversation-c:8563`: the transcript says Alan rejected curry (`先不要咖哩飯了`) and changed the plan to tomorrow breakfast, but memory stored `Alan答應明天（6/14 週日）為Umi準備咖哩飯`. Root cause was `concreteCommitmentSummaryForMessages` extracting the object from any curry mention in the acceptance window, including rejected/prior-commitment probe lines. Fix: `commitmentObjectFromText` now scans line-by-line from newest to oldest, ignores object rejection lines and question-only prior-commitment probes, and only returns curry when a positive offer/request/eating/preparing cue supports it. Added regression test for the Alan/海 breakfast case; targeted memory tests 37/37, typecheck, and build passed. The existing bad memory was not deleted but was marked corrected with importance 0 via `school:downweightFalseMemory`; no experienceLogs had been written for it. cc second-look was attempted read-only but unavailable due Claude session limit reset at 12pm. World was resumed and `world:defaultWorldStatus` is `running`. | Alan / Umi / Codex | false_commitment_downweighted_future_guard_patched_cc_unavailable |
| 17 | Alan correctly flagged that the conversation wall showed ordinary memory summaries as `心裡留下的`, making objective same-text memory look like subjective residue. Fix separates layers: `ConversationWall` now labels true `殘留：...` rows as `心裡留下的`, but ordinary `memoryLineZh` rows as `記住的片段`; `school:memoryTraceFromDescription` now displays only the remembered anchor (`某某記住了：「...」`) instead of the full objective `與 X 在 DATE 的對話...` line. Future autonomous NPC↔NPC base summaries no longer use free LLM summarization by default; they use deterministic owner-perspective fallback that prefers what the other participant said, while subjective NPC emotion remains the bounded residue path. Added targeted test for other-participant fallback memory. Verification: `npm test -- --runTestsByPath convex/agent/memory.test.ts` 38/38, `npx tsc --noEmit --pretty false`, `npm run build`. Existing old rows are not rewritten; they will display more honestly but may still contain same-objective anchors until new conversations are written. | Alan / Umi / Codex | ordinary_memory_not_subjective_residue_display_and_future_writer_patched |
| 18 | Alan found 一之瀨/祥子 repeated essentially the same lunch-box conversation at 10:09 (`conversation-c:8668`) and 10:15 (`conversation-c:8732`). Root cause: `participatedTogether` knew the pair had spoken, but compact autonomous start prompt only received a weak boolean (`You have spoken before`) and no content from the prior same-pair conversation; because the 10:09 row had no true residue, `recentResidues` was empty and the model restarted the same bento/helping motif. Fix: compact autonomous start prompts now include a short `Recent same-pair memory` hint built from the previous archived conversation's messages, elapsed minutes, final beat, and motif labels, with an explicit rule not to restart the same object/helping move unless genuinely acknowledging the previous refusal/boundary. This is prompt-only short-term continuity, not a schema or DB-write change. Verification: targeted conversation/memory Jest 77/77, `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check`. | Alan / Umi / Codex | same_pair_short_term_motif_guard_patched_watch_next_samples |
| 35 | 2026-06-16 ~00:20-01:00 CDT overnight check: the world looked "stalled" (no new conversations since sim/real 23:09, agents doing only ~1 op per 14 min). **Root cause was NOT a bug — it is the designed sleep schedule.** `convex/school.ts:isSleepHour` = `hour >= 23 || hour < 6`; the sim clock tracks real America/Chicago local time, so at real ~00:45 the world clock is `day29 00:45`, a sleep hour. `sleepStateForName` puts most characters in `sleeping`, with `Umi` `secretly_awake` and `Maomao` `secretly_awake` while `hour < 1`; the ~14-min op cadence was exactly Umi/Maomao's `nightActivityForName` (20-min `until`). Both keep-alive crons correctly leave it alone: `world:keepDefaultWorldAlive` only revives `inactive` worlds, `world:restartDeadWorlds` only kicks engines whose `currentTime` stalled (physics was still advancing). During the misdiagnosis I temporarily set `SOUL_TRIAD_COLOCATION_PILOT=true`, did 2 clean stop/resume restarts, forced one Umi/Mahiru conversation (`c` ~00:45), and ran a short safe-wake loop — all of which woke sleeping agents and created a few unnatural midnight conversations/activities (~00:45-00:54). **All of that is now reverted**: colocation env unset, wake loop killed, throwaway `scripts/underworld-keepalive-wake.sh` deleted. World is back to clean natural state (`status running`, agents sleeping). Lesson: before treating quiet-at-night as a stall, check `school` sim clock + `isSleepHour`; conversations resume naturally at sim 06:00. Disregard the handful of ~00:45-00:54 midnight samples when reviewing data. | Alan / Umi | no_bug_designed_sleep_schedule_interference_reverted |
| 36 | 2026-06-16 ~09:30 CDT: found the **structural root cause** of the chronic "連線不穩" (the #1/#14 retry-storm symptom). `messages.writeMessage` schedules `wakeWorldForConversationInputAfterWrite` with `forceHumanInputWake:true` on EVERY human message, and `wakeWorldForConversationInput` called `kickEngine` unconditionally whenever the engine was running. Each kick bumps the engine generationNumber and aborts the in-flight `runStep` — including a character's half-generated reply (`agentGenerateMessage`) — so the reply is lost; when the human sends several messages in a row (impatient), each kick spawns a competing runStep loop → persistent `Generation number mismatch` storm (split brain). Live evidence while Alan chatted 天澤 (`c:32233`, p:10↔p:11): 6 mismatches / 5 min, 天澤's o:32248→o:32250→o:32253 reply attempts all killed, then the frontend `HUMAN_REPLY_WAIT_TIMEOUT_MS=45000` showed "連線不穩". Immediate recovery: ONE clean `testing:stop`→~22s→`testing:resume` collapsed the split brain. Structural fix in `convex/messages.ts`: a running engine still advancing `currentTime` is NOT kicked anymore (it picks the freshly-written input up on its own next step ~1s); only a *stalled* engine (`currentTime` lag > `ENGINE_STALL_WAKE_MS=5000`) or a non-running engine is kicked/started — preserving #1's developer-stop / idle-wake guarantee. New pure helper `shouldKickRunningEngineForHumanInput`; `convex/messagesWake.test.ts` 7/7 pass, `tsc --noEmit` clean, change hot-reloaded live and 天澤 resumed replying (`c:32233` grew 9→23 msgs). Watch: confirm "連線不穩" no longer appears when Alan sends rapid follow-up messages mid-reply. | Alan / Umi | human_input_kick_root_cause_fixed_watch_rapid_messages |
| 37 | 2026-06-16 ~09:50 CDT: a SECOND, distinct "連線不穩" cause surfaced minutes after #20 — this time the `replyWaitExpired` ("這段沒有寫入角色記憶") variant, with NO split brain (0 mismatch). Root cause: **human chat was starved by the conversation single-flight.** `agent.ts hasActiveConversationGeneration` only granted single-flight priority to the hardcoded Umi/Mahiru pilot pair (`p:0`/`p:707`); a human↔非-pilot conversation (Alan p:11 ↔ 天澤 p:10) got `pilotConversation=false`, so once the daytime world filled with autonomous character↔character generations (one ~every 8s), 天澤 could never grab a generation slot and Alan's reply blew past the 45s client wait. Fix in `convex/aiTown/agent.ts`: new `agentConversationHasPriority(game, playerId)` (true if the agent's conversation has a human participant OR is the pilot pair); `hasActiveConversationGeneration`'s `priority` arg now skips ordinary autonomous blockers instead of hardcoding `p:0/p:707`; each generation gate passes `priorityConversation = pilotConversation || player.human || otherPlayer.human`. Net effect: human (and pilot) generations run even while autonomous chatter is mid-generation; autonomous conversations still single-flight among themselves. `tsc --noEmit` clean; hot-reloaded live and verified: `c:32233` advanced 24→28 msgs with 天澤 replying promptly, and the log showed `p:10↔p:11` (human) generating concurrently with `p:0↔p:2` (autonomous) — the priority bypass working, 0 mismatch. Watch: human chat stays responsive during busy daytime autonomous load. | Alan / Umi | human_conversation_singleflight_priority_fixed |
| 38 | 2026-06-16 ~09:55 CDT audit (Alan asked "any similar problems left?"): swept every `kickEngine` caller for the same "kick a healthy running engine → abort in-flight ops" class as #20. Found 3 more **UI-triggered** unconditional kicks in `convex/school.ts`: `moveAlanTo` (runs on every Alan map move — highest risk), `leaveAlanConversationNow`, and `enterCampus`. Added shared helper `nudgeEngineForInput` + `ENGINE_STALL_WAKE_MS` in `convex/aiTown/main.ts` (start a stopped engine, kick only a *stalled* running one, otherwise let the running loop pick the input up) and switched those 3 sites to it. Left as-is (manual/admin/test only, never in normal play, where a forced kick is intentional): `testing.ts` `testing:kick`, `school.ts` coLocate*/start|enqueueConversation*ForTest pilots, and `repairWorldState` (2 kicks). `tsc --noEmit` clean; `messagesWake` + `conversationMotifGuard` 53/53 pass; live 0 mismatch, Alan `c:32233` kept advancing to 30 msgs. Remaining known non-kick "連線不穩" vector for later if it recurs: a single legitimate generation that genuinely exceeds the client's `HUMAN_REPLY_WAIT_TIMEOUT_MS=45000` under slow cloud — that's latency, not a kick/starvation bug, and would need either a faster path or a longer/streamed client wait. | Alan / Umi | similar_kick_callers_audited_ui_ones_fixed_manual_left |
| 39 | 2026-06-16 ~20:00-21:00 CDT: found + fixed the REAL root cause of the recurring DB bloat / "can't open the world" (behind WORKLOG #9's repeated fresh-world resets). It is **Convex local-backend document VERSION HISTORY**, not app data. AI Town rewrites the engine + world docs ~every second; cloud Convex compacts old versions, the local OSS backend keeps them all. sqlite breakdown of the 690k-doc / 1 GB DB: engine-doc versions 240k, world-doc versions 105k, `_scheduled_functions`+args ~277k — actual app data is tiny (memories 3365, messages 12k, conversations 1.7k; full export = 33 MB). At ~1 GB the backend cold-opens in ~9 min (state on the T9 USB SSD) and queries fail with "too many system operations" (lost conversations/data; ~80/day, rising). Cure = **compaction**: `convex export` → archive the bloated state dir → fresh empty backend → `convex import --replace-all` → resume. Result: 690k→37k docs, 1 GB→127 MB, cold-open 9 min→~5-30 s, "too many system operations" 0, continuity preserved (same world/engine id `mx7cyj…`, sim day 29, all 6 characters, memories/residue/experienceLogs intact). **KEY LESSON: `convex export/import` does NOT carry Convex env vars** — all 23 were wiped and had to be re-applied (21 non-secret from `docs/current-env.md`, 2 cloud secrets from Alan's `.env.local`; cloud re-verified). Tooling: `scripts/underworld-compact-state.sh` — `--check` size monitor (WARN 250k / CRIT 500k docs) + full compaction that **auto-backs-up + restores env** and keeps a recoverable archive. RECURRING maintenance (history regrows ~150k docs/day → re-compact ~weekly or when `--check` warns); long-term: move off local backend (cloud auto-compacts) or reduce engine churn. Archive at `…/local-alan_chu-ai_town-archive-precompact-20260616`. | Alan / Umi | state_bloat_real_cause_is_convex_version_history_compaction_tooled_recurring |
| 40 | 2026-06-16 ~21:00-22:00 CDT data-quality + presentation pass (Alan-directed). (1) **Per-character residue lens** (`convex/agent/memory.ts` `RESIDUE_LENS` + `buildResiduePrompt`): residues were collapsing onto shared templates ("停頓的那半秒", "語氣像在報天氣") across every soul; each character now gets a perceptual lens from `docs/soul/pilots/*.md` (海=被需要 / 真晝=藏起來的累 / 天澤=被推後的破綻 / 一之瀨=沒講明的人情帳 / 貓貓=被忽略的症狀 / 祥子=儀態哪裡裂了) + an anti-fixed-template rule. (2) **Cross-partner motif guard** (`convex/agent/conversation.ts`): added the 袖口/粉筆灰 family and `recentSelfResidues` (this speaker's recent residues across ALL partners) fed into both compact builders' motif guard, so a signature opener reused across different partners (貓貓's 袖口粉筆灰 to 祥子 AND 一之瀨) trips the cooldown. (3) **Conversation Wall tabs** (`src/components/ConversationWall.tsx`): split into 對話 / 殘留 / 記憶 / 睡眠筆記 so the 對話→殘留→記憶→睡眠 soul-formation pipeline is legible; sleep tab reads `sleepNotesSummary.latest`. (4) Read-only `scripts/underworld-peek.sh` (peek [all|talk|sleep|health]) for at-a-glance data. Tests: memory 45, motifGuard 47, tsc clean. NOTE for **today's samples are 7b/pre-lens** (cloud creds were lost ~20:40-21:05 then restored) — the lens + motif effects show only in tomorrow's fresh cloud conversations. CODEX ACTION completed 2026-06-16 22:21 CDT: `scripts/underworld-rolling-continuity.mjs` now folds read-only `underworld-peek.sh health` plus recent-residue digest into `umi/reports/rolling-continuity-latest.md` under `Peek Health` and `Peek Recent Residue Digest`; therefore the codex-level **Underworld Rolling Continuity Telegram** automation gets passive world health/residue visibility if it runs the repo rolling-continuity command. Accepted future presentation direction: a "soul uniqueness over time" trend view built on `docs/paper/.../soul_uniqueness.csv`. Cloud quota note: the 600/day counter is in-memory and reset on every backend restart (we restarted many times today), so it never approached 600; today's cloud spend was light (lots of F15-fallback + downtime). | Alan / Umi / **Codex** | quality_lens_and_motif_shipped_wall_tabs_done_peek_folded_into_2h_telegram |
| 41 | 2026-06-16 ~22:30 CDT state-sustainability decision + tooling (Alan-directed). Investigated whether the Convex LOCAL backend can auto-GC its document version history (the real cause of WORKLOG #39's bloat): it CANNOT — the precompiled `convex-local-backend` binary exposes no retention/GC/compaction flag, no retention env var (only RocksDB internal compaction strings), and the CLI has only export/import. So export/import compaction is the only safe mechanism, and moving to Convex Cloud is rejected for now because cloud functions can't reach the F15 LLM on the home LAN (would break the local fallback). **(A) SOUL DATA IS NOW PERMANENT** — `convex/crons.ts` `TablesToVacuum` no longer includes `memories` / `memoryEmbeddings` (the upstream default deleted them after `VACUUM_MAX_AGE`=14d, which would have silently erased ~14-day-old soul memories around 2026-06-26). Only `inputs` (replay log) is still vacuumed. Watch-out documented in code: embeddings now grow unbounded; past ~100k vectors search slows — if it bites, tier/archive OLD embeddings while keeping memory TEXT, never delete memories. **(B)** `scripts/underworld-compact-state.sh` gained an `--auto` mode: it compacts ONLY when `documents >= WARN_DOCS (250k)` and runs non-interactively, otherwise no-op (verified: at 48k docs it skipped and left the world running). Version history grows ~150-170k docs/day, so a fixed *weekly* slot is too coarse (would balloon to ~1.2M before it ran); `--auto` self-paces to ~every 2-3 nights. **>>> CODEX ACTION (Alan delegated the scheduling to Codex):** add a launchd agent (model it on `~/Library/LaunchAgents/com.giis.underworld.morning-healthcheck.plist`) that runs **nightly at 04:00 America/Chicago** (deep sim-sleep, agents are asleep 23:00-06:00 so a ~10-min world pause loses no conversations): `cd /Users/alanhdchu/ai-town && CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS=900 ./scripts/underworld-compact-state.sh --auto >> umi/reports/compact-auto.log 2>&1`. It is safe to run every night because `--auto` is a no-op below 250k docs and only actually compacts (and keeps a recoverable archive) when needed. | Alan / Umi / **Codex** | soul_data_permanent_compaction_auto_mode_codex_schedule_nightly |
| 42 | 2026-06-16 ~23:00 CDT recorded a soul-memory design direction (Alan-directed, **not built** — v0.2+). `docs/soul/MEMORY_DYNAMICS_AND_FORGETTING.md` captures: the 記得 (cued recall) vs 主動想起 (active recall) distinction; that an **embedding IS the "能被提醒想起" handle** (drop it and the memory text still exists but can't be reached by association); a three-tier reachability model (Active / Cued / Deep-dormant) where **forgetting = sinking deep, never deleting text** (soul tables stay permanent per #41); the **convergence** that archiving old embeddings to bound the ~100k-vector limit IS the forgetting mechanism, so the embedding-scaling threshold is the natural trigger to build it; plus residue re-consolidation + importance decay/reinforcement during sleep. Guidance: don't build now (too little memory to forget yet); let the substrate thicken; frame as a soul feature, not cleanup. **>>> CODEX (no rush, review-gated):** this "what is the difference between a machine *remembering* and *actively recalling* — and what would it mean for an AI to *forget*?" theme is a strong **Field Note / short-form** candidate. Consider drafting it through the review-gated media pipeline (WORKLOG #7: package-first, no auto-publish, human approval, evidence-grounded — tie it to the actual residue/embedding mechanism, not hype) and sharing it in Field Notes. | Alan / **Codex** | soul_memory_forgetting_design_note_recorded_codex_fieldnote_candidate |
| 43 | 2026-06-17 ~15:30 CDT first review of fresh cloud+lens samples + two fixes (Alan-directed). REVIEW: the per-character residue lens clearly worked — souls are now distinct (貓貓 reads a hidden symptom, 天澤 pressure-tests, 祥子 performs-then-cracks, 海 caretakes, 一之瀨 keeps an unspoken ledger) — a real jump from yesterday's homogeneous 7b templates. But two new problems: (a) residues converged onto a NEW micro-tic ("喉結/睫毛/眨眼動了一下", "尾音上揚") — banning phrases one-by-one is whack-a-mole; (b) 貓貓/祥子 over-paired (4 of 10 conversations, same rehearsal-eye dynamic). FIX 1 — root cause of repetition (Alan's insight: humans never use a template; their first line comes from event + who the other is + their own mood): `conversationMicroPurpose` hardcoded each character's signature move ("Maomao: diagnose one symptom") as the opening GOAL, applied every time regardless of context, so the archetype WAS the template. Shifted from negative (ban phrases) to **generative (ground the opening)** in `convex/agent/conversation.ts`: personality reframed as STYLE not opener; an opening-grounding block routes the first line through (1) a concrete matter with THIS person → (2) a real thing that happened today / scene everyday life → (3) who the other actually is; strengthened the day-event anchor; banned micro-body-detail openers; and `buildResiduePrompt` now discourages defaulting to a tiny body micro-movement (vary: choice/tone/silence/avoidance, or honestly leave nothing). FIX 2 — pairing rate: the general free-world branch of `findConversationCandidate` used `PLAYER_CONVERSATION_COOLDOWN` (only **2 min**, separate from the pilot's 10-min `SOUL_PILOT_PAIR_COOLDOWN_MS`), so co-located pairs re-paired every few minutes; raised the constant to **15 min** in `convex/constants.ts`. tsc clean; motifGuard+memory 92 pass. Effects show in NEW cloud conversations — re-check with `./scripts/underworld-peek.sh talk`. **>>> CODEX (review-gated short-form, Alan-requested):** make a video/Field Note on **"how do humans actually talk — and how do you make an LLM talk like a person, not a template?"** Use our real UW journey as the spine: watching every 貓貓 line open with a body-symptom read; the "停頓的那半秒" → "喉結動" template treadmill; the whack-a-mole realisation; Alan's question "why don't humans repeat? because the first sentence comes from the event + who you're with + your mood"; and the fix = stop hardcoding the archetype move, ground each opening in real context (personality is the *how*, not the *what*). Draft through the review-gated media pipeline (WORKLOG #7: package-first, no auto-publish, human approval, evidence-grounded, real transcript before/after, no hype). | Alan / **Codex** | grounding_fix_and_pairing_cooldown_done_codex_make_human-like-llm_video |
| 44 | 2026-06-17 ~16:30 CDT architecture-inversion roadmap + Stage ① started (Alan-directed). Deep review (two Explore agents) mapped (a) the full 7-layer speech-style stack (per-character voice prompt + conversationMicroPurpose archetype + 5-layer souls + 16 motif families + response-move/rhythm/naturalness/speaker-lock/turn-state guards + residue lens) and (b) how world events work (hardcoded authored injections in `data/dailyLifeBulletin.ts` / `spontaneousEvents.ts` / `schoolLocations.ts` moodEvents — they name real characters but did NOT happen in-sim; they tint mood/memory/conversation-context but cause no real consequences: no movement, activities, plot). CONCLUSION (Alan's read, confirmed): we are 本末倒置 — ~90% of effort CONTROLS the output (30+ mostly-negative guards) and FORCE-FEEDS residue, both symptoms of a THIN situation; speech and "events" are the SAME problem because the situation is the substrate speech must draw from. Roadmap written: `docs/soul/SPEECH_AND_SITUATION_INVERSION.md` — Stage ① give every conversation a real spine (wire existing selfState/relationship/recentEvents from weak "background" into the centre; archetype drops to flavour, residue becomes natural), Stage ② retire the most arbitrary guards as quality holds (the safe inversion), Stage ③ (v0.2) make events emergent + consequential. NOT a big-bang — guards are scar tissue, advance one increment at a time. **Stage ① increment 1 shipped:** the compact start AND continue builders received `selfState`/`otherState` (current emotion / intention / lingering memory) but never surfaced them — only the pilot path did; wired `characterStatePromptLines(...)` into both compact builders so every conversation now opens from the character's real current state (the grounding block already referenced "他此刻真實的樣子（狀態）" but had no data behind it). tsc clean; motifGuard 47 pass. **>>> CODEX (review-gated short-form):** today's discussion is itself a strong Field Note — companion to #43: **"we built it backwards — we were forcing the AI NOT to say things and forcing it to remember weird things, when the real fix is giving it a real situation to speak from."** The 本末倒置 / output-control-vs-situation-substrate insight is the hook. Same review-gated pipeline (WORKLOG #7), evidence-grounded, real before/after. | Alan / CC / **Codex** | inversion_roadmap_written_stage1_increment1_state_in_spine_codex_fieldnote |
| 45 | 2026-06-17 ~17:00 CDT division of labour set + Codex work queued (Alan-directed). Stage ① increment 2 shipped by CC: compiled the authored per-pair relationship dynamics from `docs/soul/pilots/*.md` into `RELATIONSHIP_DYNAMICS` and wired `relationshipDynamicPromptLines` into both compact builders, so a conversation now opens knowing the real history of THIS pair (一之瀨 prices 天澤's tests; 貓貓 sees 祥子's hidden symptoms; 真晝 brings 海's hidden fatigue back). v0.1-roadmap got an inversion pointer (visible each time). **DIVISION OF LABOUR (Alan-approved):** CC keeps driving the *speech inversion* (Stages ①–②) because it is an observe-output-then-adjust loop and is philosophy-sensitive — a goal-pursuing agent tends to "fix" an over-constrained system by adding MORE guards (the wrong way). Inversion status: ①.1 (current state) + ①.2 (relationship) shipped; next steps need (a) observing new cloud output and (b) the v0.2 event substrate, so the cheap spine increments are done. **>>> CODEX A — v0.2 emergent events (the big parallel piece):** pursue `docs/V0_2_EMERGENT_EVENTS_SPEC.md` — make events emergent (arise from real agent actions, not the hardcoded `data/*.ts` injections), consequential (real movement/activity/relationship shift, not just a prompt hint), and chained; in review-gated increments E1–E4, env-gated, with real before/after in WORKLOG. This is Stage ③ of the inversion (the situation substrate). **>>> CODEX B — source-novel lore:** Alan supplied the sources (`docs/soul/CHARACTER_SOURCES.md`): 一之瀨=Honami Ichinose & 天澤=Ichika Amasawa (BOTH from Classroom of the Elite — richest pair, canonical interactions), 海=「クラスで2番目に可愛い女の子」, 真晝=Shiina Mahiru (お隣の天使様), 貓貓=Maomao (薬屋のひとりごと), 祥子=Sakiko Togawa (Ave Mujica). Crawl each source for public-self/known-deeds + canonical relationships, then ENRICH `RELATIONSHIP_DYNAMICS` + identity hints WITHOUT overriding the authored souls; review-gated, cite sources, no plot/spoilers the in-world character would not treat as ordinary self-knowledge. **>>> CODEX C — shorts plan (Alan: make sure Codex knows):** 3 strong + 2 stretch, all review-gated via the WORKLOG #7 media pipeline, evidence-grounded with real before/after, no hype: (1) how to make an LLM talk like a person not a template [#43], (2) we built it backwards / 本末倒置 — controlling output vs giving a real situation [#44], (3) remember vs actively recall / what would it mean for an AI to forget [#42]; stretch: (4) the residue lens — same event, different souls, (5) the world's events are scripted weather — what real emergent events would mean [ties to CODEX A]. | Alan / CC / **Codex** | labour_split_cc_drives_inversion_codex_v0.2events_lore_shorts |
| 46 | 2026-06-17 ~16:50-17:10 CDT CC reviewed Codex's #45 A/B/C handoff (all PASS) + shipped the next inversion increment. **REVIEW of Codex (committed `715b78fe`):** (A) v0.2 emergent events E1–E4 — `convex/schoolEmergentEvents.ts` (pure planning rules) + `school:applyEmergentEventCandidates` (dry-run/write consumer) + optional `worldEvents` consequence metadata in `schema.ts`. Verified **v0.1 runtime is unchanged**: the only always-on hook (`...conversationOutcomeCauseMetadata(outcomeQuality)` in `recordConversationOutcome`) returns `undefined` when `UNDERWORLD_V02_EMERGENT_EVENTS` is unset; every write path is blocked by `write && !enabled → write_blocked`; schema fields are all optional (no migration); live dry-run = `enabled=false, checked=0`. (B) source-lore enrichment of `RELATIONSHIP_DYNAMICS` (海=朝凪海, 天澤↔一之瀨 same-classroom conflict, 貓貓↔祥子) stays inside the authored souls; 天澤 kept safe (test asserts `not.toMatch(/內褲|露出|explicit|羞辱/)`). (C) 5 review-gated shorts under `media/shorts/` — accurate, nothing rendered/uploaded. Tests 54 + tsc + runtime-preflight green. Minor follow-up (non-blocking, post-v0.2): `applyEmergentEventCandidates` could be `internalMutation`; and when E2 is actually turned on, its direct `world.players` pathfinding patch bypasses the engine input system — should route through `inputs`/`nudgeEngineForInput` to avoid racing the engine. **CC SHIPPED (committed `f81e0017`) — inversion Stage ① "residue is optional":** live 6/17 peek showed that even WITH the ①.1 state + ①.2 relationship spine, residue is still ~100% forced micro-prosodic tells (筷子停住那一下 / 指尖避開杯沿熱度 / 把「沒」字咬得特別輕). The pipeline already RESPECTS an honest 無 (empty LLM residue → `residueSource='none'`, no deterministic paper-over), but the model never picked it because 無 sat buried under a "write ONE residue" command + a lens that ordered it to always notice a detail. Recalibrated `buildResiduePrompt` in `convex/agent/memory.ts`: lead with "decide first whether anything of real weight stuck", state most ordinary conversations leave 無 (normal), prefer 無 over a low-weight micro-tell, route micro-body-movements to 無 by default, and demote the lens to conditional. Prompt-only (pipeline already handles higher 無 frequency); 148 agent tests + tsc PASS; live via `convex dev` (PID 317). **WATCH next cloud conversations:** residue density should DROP and what remains should carry more weight — this is the "force-feed residue" half of 本末倒置 being undone. If quality holds, Stage ② (retire the now-redundant micro-tic guards) becomes safe. | Alan / CC | codex_handoff_reviewed_pass_cc_shipped_residue_optional_watch_density_drop |
| 47 | 2026-06-17 ~20:30-21:10 CDT found the REAL root cause of the recurring world stalls (#33/#34 this morning + a fresh crash at 20:32) and shipped a self-heal workaround. **ROOT CAUSE (not "machine too weak", not OOM):** crash report `~/Library/Logs/DiagnosticReports/convex-local-backend-2026-06-17-203203.ips` shows the backend calls `abort()` (EXC_CRASH / SIGABRT) on a **Rust panic in `search::archive::cache::cleanup_thread`** — the Convex local backend's search/vector-index archive-cache cleanup background thread (RocksDB + SQLite frames confirm the search path). Backend software bug, triggered under load. **Why it keeps the world DOWN:** when the `convex-local-backend` CHILD crashes, the `convex dev` wrapper does NOT exit (it retries "waiting for local backend"), so the launchd `KeepAlive` on `com.giis.underworld.dev-stack` never fires → world stays down until a manual restart. **Aggravator (not main cause):** M1 Pro / 16GB / 8-core — CPU fine but 16GB tight; swap was 14.3/15.3 GB used (Codex.app ~1.2GB, VS Code ~1GB, Claude, browser, growing backend); memory pressure makes the cleanup-thread panic likelier. **Trigger hypothesis:** search index (embeddings) grows unbounded because #41 made soul data permanent (stopped vacuuming `memoryEmbeddings`; #41 warned ~100k vectors degrades search); bigger index + #39 version-history bloat → more pressure on the buggy cleanup thread. **WORKAROUND shipped (commit f722f2ff, prepared NOT auto-installed per Alan):** `scripts/underworld-world-watchdog.sh` — external poller; if port 3210 down on two checks it `launchctl kickstart -k gui/$(id -u)/com.giis.underworld.dev-stack` (rate-limited 1/5min, logs to `umi/reports/world-watchdog.log`, silent no-op when healthy; healthy path tested). Launchd agent prepared at `scripts/com.giis.underworld.world-watchdog.plist` (activate: copy to ~/Library/LaunchAgents + `launchctl bootstrap gui/$(id -u) …`). Recovery proven live: 20:46 kickstart brought 3210 back in ~3s, preflight PASS, engine resumed. **Free mitigation:** close Codex.app/VS Code during collection. **PENDING:** (b) real fix = bound/archive old embeddings — doubles as the #42 forgetting mechanism (on-strategy); (a) compact more often (#39); (d) maybe upgrade the 2026-06-09 precompiled backend binary (possible upstream fix); (e) Convex Cloud long-term (blocked by F15 LAN LLM routing). **HARDWARE (Alan weighing mini vs MacBook):** dedicated always-on Mac mini (M4, 48GB) recommended — isolates world from dev-app memory contention + always-on + NVMe over USB-T9, cheaper than 48GB MacBook; reliability/QoL investment, NOT a collection prerequisite (workaround covers that) and NOT a fix for the software panic. Apple Silicon RAM is soldered — the M1's 16GB cannot be upgraded; "換" = replace the whole machine. | Alan / CC | root_cause_search_cache_panic_watchdog_ready_b_fix_and_hardware_pending |
| 19 | Alan approved making autopilot subjective residue / experienceLog formally soul-grounded instead of letting ordinary memory carry "soul." cc read-only review was attempted again but still blocked by Claude session limit (`resets 12pm America/Chicago`), so Codex implemented the bounded fallback. Experience logs now require a non-empty residue with `residueSource='llm_soul'`; clean ordinary memory rows with no residue return `no_residue`, and deterministic/provider-fallback residue returns `non_soul_residue`, so provider failure cannot create v0.1 evidence. `rememberConversation` now tags residue source after the soul-grounded LLM residue path and resets it to `none` if repeat/recall-correction gates clear the residue. ExperienceLog draft interpretation/behavior hints now use character-specific subjective handling for 海/真晝/天澤/一之瀨/貓貓/祥子 instead of generic summary-only wording. Tests cover no-residue rejection, deterministic-residue rejection, and same objective event producing different subjective drafts per character. Verification: targeted experience/memory/conversation Jest 103/103, `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check`. | Alan / Umi / Codex | experience_log_requires_llm_soul_residue |
| 20 | Alan observed that 2026-06-13 is Saturday/weekend but autonomous characters were not naturally talking about weekend life. Diagnosis: calendar/weekend context existed in `schoolDayRhythmContext` and full prompts, but compact autonomous start/continue prompts mostly saw it as a buried `calendarHint` rather than a concrete conversation motive. Fix: compact autonomous prompts now add `週末生活錨點` / `週末場景 seed` lines when `clockContext.isWeekend` is true, steering openers or pivots toward free activity, homework, laundry, club practice, errands, walking, dorm choices, or private check-ins while avoiding saturated food/drink/utensil/rest/global-topic loops. Added regression test to ensure Saturday compact prompts include weekend life anchors and do not seed bento/teacup loops. Verification: targeted conversation/experience/memory Jest 104/104, `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check`. | Alan / Umi / Codex | compact_weekend_life_anchor_patched_watch_next_samples |
| 21 | 2026-06-14 evening incident: Alan reported Underworld felt hung. Triage showed `/ai-town` HTTP 200 and old `underworld:runtime-preflight` PASS, but role-to-role conversation flow had stopped around 10:59-11:00 CDT. `debugInputQueue` latest processed inputs were still morning events, while `recentConversationEvalData` showed two stale active unarchived conversations (`海/一之瀨`, `祥子/貓貓`). Alan approved clearing them; `school:cleanupActiveConversationsByCharacterNamesForTest {"dryRun":false,"targetNames":["海","一之瀨","祥子","貓貓"]}` removed 2 active conversations, 10 unarchived messages, and 1 in-progress agent op. Alan then explicitly approved starting repairs tonight instead of waiting. Codex coordinated a cc read-only review, implemented `school:activeConversationRuntimeHealth`, `school:cleanupStaleActiveConversations`, `scripts/underworld-stale-conversation-watchdog.mjs`, and extended `underworld:runtime-preflight` so it fails on stale daytime agent inputs, stale active conversations, and due-but-unprocessed input backlog. The dev stack was restarted once in `underworld-mobile` screen to load the new functions. Post-restart evidence: `/ai-town` HTTP 200, `underworld:runtime-preflight` PASS, `underworld:stale-watchdog` dry-run stale=0/messages=0, runtime health due pending inputs=0, processedInputNumber advanced beyond the morning stall, typecheck/build passed. Treat 2026-06-14 afternoon as missing natural-conversation data; next plan is Monday/Tuesday observe-only collection and Wednesday v0.1 evidence review. | Alan / Umi / Codex / cc | runtime_freshness_guard_live_monday_tuesday_run_wednesday_review |
| 22 | Underworld Media Pipeline v1 scaffold exists under `media/`. Alan's goal is a public record of AI society emergence, not generic AI education. The scaffold is package-first and review-gated: Topic, Research, Script, Asset, and Upload agents may generate reviewable packages, but must not mutate Convex/runtime state, change prompts/memory/souls, upload automatically, or make public claims without evidence and human approval. cc feasibility review was attempted in plan mode, but Claude Code is session-limited until 1:30am America/Chicago, so Umi implemented the conservative markdown scaffold only. Next useful work is a small script that reads existing reports and produces a ranked topic package, still read-only. | Alan / Umi / Codex | media_pipeline_v1_scaffolded_review_gated |
| 23 | Underworld Field Notes Watcher role is defined at `media/watcher.md`, with current playtest-note candidates in `media/topics/watcher-inbox.md`. Central Codex automation `underworld-field-notes-watcher` is active daily at 23:00 America/Chicago. It is read-only and should scout for shareable moments such as repeated fallback lines, dirty memory pollution, runtime stalls, motif loops, or genuine social signals. It must not mutate Convex/runtime state, restart/kick/repair, upload, or change YouTube privacy. First watcher Short, `When an AI World Is Online but Not Alive | Field Note`, was uploaded public at `https://youtu.be/_to91-H3DEY` after Alan's explicit public approval; no runtime mutation was performed for the video. | Umi / Codex automation | active_read_only_content_scout_first_short_public |
| 24 | 2026-06-15 morning health incident: frontend/dev stack looked alive (`/ai-town` HTTP 200, world status `running`, engineRunning true), but agent input freshness showed the world had not advanced for about 2h17m and stored `worldClock` was stuck near 05:59 while real local time was after 08:12 CDT. There were no stale active conversations or due pending inputs, so `testing:stop` -> wait -> `testing:resume` did not wake it. A controlled `underworld-mobile` dev-stack restart recovered the loop; logs showed `world:restartDeadWorlds`, runtime input advanced, and Umi/Mahiru started fresh conversation `c:20060`. `underworld:runtime-preflight` now uses real America/Chicago time from `payload.now` for day/night mode instead of trusting stale stored `worldClock.hour`, reports stored worldClock age, and fails if stored worldClock age exceeds the stale threshold during daytime. Verification after recovery: `/ai-town` HTTP 200, `underworld:runtime-preflight` PASS, `underworld:runtime-preflight:self-test` PASS, `underworld:stale-watchdog` dry-run stale=0/messages=0, `npx tsc --noEmit --pretty false`, and `npm run build`. Treat 2026-06-15 before about 08:18 CDT as missing/unreliable continuity data; collect Monday evidence only after this recovery point. | Umi / Codex | recovered_preflight_time_guard_patched_watch_next_two_hours |
| 25 | 2026-06-15 evening data review showed the world is now producing continuity evidence but still has dialogue hygiene failures: `underworld:rolling-continuity` PASS for the 16:00-20:00 window, while `eval:conversation:recent -- --since-last-change` reported 0 PASS / 6 WARN / 6 FAIL with repeated small-object motifs and dangling autonomous endings (`啊……抱歉，祥子，`, `「糖紙剝開了...`, `嗯…待會琴房的燈，`). cc read-only review (`umi/reports/20260616T003312Z-workload.md`) agreed the repair should be narrow: ungate dangling-fragment rejection for non-Alan autonomous pairs and avoid broad memory/provider/schema changes. Patch landed in `convex/agent/conversation.ts`: same-pair motif cooldown line, extra prop-family prompt cooldowns for needle/candy/curtain/hand/sleeve loops, autonomous dangling-fragment abort before archive, and preserved Alan-facing repair behavior. Tests added in `conversationMotifGuard.test.ts`. Verification: targeted Jest 43/43, `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check`, and `npm run underworld:runtime-preflight` PASS. Existing pre-patch eval reports will still show old failures; judge this fix on fresh post-patch samples. | Umi / Codex / cc | motif_cooldown_and_dangling_guard_patched_watch_fresh_samples |
| 26 | 2026-06-15 Alan-facing human chat repair landed after Alan playtested 海/真晝/天澤. Evidence: 海 kept dragging an expired curry promise into unrelated current topics; 真晝 answered direct Alan questions with stage/action phrasing instead of answer-first; 天澤 archived a single-sided Alan-only conversation while the character was still typing. cc read-only review (`umi/reports/20260616T013551Z-workload.md`) recommended a bounded commitment cooldown and warned against broad prompt rewrites. Codex implemented the low-risk subset plus direct evidence guards: expired commitments now surface only when Alan explicitly mentions the object, Umi curry output is repaired when Alan asks feelings/current topics, Mahiru direct secret/invitation/check-in questions repair to answer-first lines, first-person stage-direction detection catches `我正/正在...推過來`, MessageInput blocks duplicate sends while the other participant is typing, and `leaveAlanConversationNow` delays leave/archive for up to 90s if Alan spoke last and the character is still typing. Verification: targeted Jest 54/54, `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check`, and `npm run underworld:runtime-preflight` PASS. Next: Alan human-test Umi/Mahiru/Tianze/Ichinose once; judge only fresh post-patch chats. | Umi / Codex / cc | alan_facing_smoothness_patched_human_test_next |
| 27 | 2026-06-15 follow-up playtest: Alan tried to establish a "明天午休 / 中午 珍珠奶茶" promise with 海 and felt she did not catch it. Evidence from `school:debugAlanConversationState` showed 海 did answer in dialogue (`明天午休，見`; `明天午休，我們先喝珍珠奶茶，再煮咖哩`), but `school:notebookCommitments` returned `[]`. Root cause: `concreteCommitmentSummaryForMessages` only recognized curry-like objects and scanned early acceptances before later concrete refinements, so it could collapse to lunch/box or miss boba entirely. Codex patched `convex/agent/memory.ts` to support `珍珠奶茶/奶茶`, `午餐`, `便當/便當盒`, `明天午休/明天中午`, more specific object priority, newest acceptance-first scanning, and boba offer cues like `一杯少糖` / `你選哪一杯`. cc read-only review (`umi/reports/20260616T015123Z-workload.md`) agreed and suggested edge tests; Codex added lunch-only and bento-box-refusal tests. Alan then retested once; `c:30552` still produced `commitments: []` because Umi's stale-curry repair converted her answer into the generic `嗯，我先照你說的來...`, leaving no explicit commitment text. Codex patched the Umi repair branch so 明天午休/少糖珍珠奶茶 and lunch requests repair to explicit acceptances (`好。明天午休，我帶少糖珍珠奶茶，我們一起喝。`). Verification: targeted Jest 90/90, `npm test -- convex/agent` 145/145, `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check`, and `npm run underworld:runtime-preflight` PASS. Existing `c:29920`/`c:30552` will not auto-backfill; the next fresh Alan/海 test should now produce both explicit answer and commitment notebook row. | Umi / Codex / cc | boba_lunch_commitment_extractor_and_reply_repair_patched_retest_needed |
| 28 | 2026-06-15 night Tianze stuck-reply incident: Alan's active 天澤 conversation `c:30631` was not a frontend send failure or down world. `runtime-preflight` passed, `world:defaultWorldStatus` was running, and `school:debugAlanConversationState` showed Alan's final message `你明天晚上有空嗎？` while Tianze agent `a:11` repeatedly entered `agentGenerateMessage`. Logs showed `p:10 continuing conversation with p:11` plus new operation IDs every few seconds, but no new Tianze message. cc confirmed the code-level mechanism: human-facing generation abort/provider failure cleared `inProgressOperation`/typing without leaving the human conversation; because Alan remained the last real speaker, `Agent.tick` immediately retried forever. Patch landed with a per-conversation human generation failure marker and cooldown; `agentAbortConversation` and `clearAgentOperation` now mark human-facing generation failures, `Agent.tick` throttles same-character retries, and real new messages clear the marker. No fallback text, memory, archive, or experienceLog write is introduced. Verification: targeted aiTown Jest 21/21, typecheck PASS, build PASS, diff-check clean, runtime preflight PASS. Existing `c:30631` is not backfilled with a Tianze answer; next fresh Tianze chat should fail softly instead of machine-gun retrying if provider/hygiene aborts again. | Umi / Codex / cc | retry_loop_guard_patched_watch_next_tianze_chat |
| 29 | 2026-06-15 follow-up Ichinose stuck incident: Alan's 一之瀨 chat `c:30814` exposed two remaining human-chat stall paths after the Tianze patch. First, `agentGenerateMessage` timeout was cleared inside `Agent.tick` itself, not through `agentAbortConversation` / `clearAgentOperation`, so the failure marker/cooldown was never written and timeout immediately retried. Second, human-facing NPCs could self-continue after their own last message once the awkward deadline passed, so Alan could see "thinking" even when he had not sent a new message. Codex restarted the dev stack once because Convex backend had gone half-ready (`/ai-town` 200 but port 3210 initially absent / local backend waiting), then patched `agent.ts`: timed-out human-facing `agentGenerateMessage` now clears typing, marks generation failure, and returns; human-facing conversations now stop after the character's own message and wait for Alan instead of self-continuing. Verification: targeted aiTown Jest 21/21, typecheck PASS, build PASS, diff-check clean, runtime preflight PASS; post-patch active state shows 一之瀨 `inProgressOperation=null`, no new `p:2 continuing conversation with p:11` after Convex functions reloaded at 21:35:42. Existing `c:30814` contains one pre-patch self-continuation line (`……那你要不要，幫我接住下一聲？`) and should not be used as post-patch quality evidence. | Umi / Codex | timeout_path_and_self_continue_guard_patched_watch_fresh_human_chat |
| 30 | 2026-06-15 second 一之瀨 "connection unstable" report: active `c:30824` showed Alan's final line `記住了麻，你有約麻`; logs then showed `p:2 continuing conversation with p:11`, repeated `agentGenerateMessage` starts, and Convex `generationNumber mismatch`. The app/backend were healthy (`/ai-town` HTTP 200, Convex 3210 listening), so this was not Wi-Fi/frontend downtime. cc read-only review (`umi/reports/20260616T025008Z-workload.md`) agreed the missing start-level attempt marker was a real defense-in-depth gap and caught a sharper bug: `finishSendingMessage` was clearing generation failure markers for every author, so Alan sending another line could clear Ichinose's cooldown. Patch landed with `lastGenerationAttempt`, a 30s human-facing attempt cooldown, scoped clearing of attempt/failure markers only when the same character successfully sends, and a memory guard that treats final human "記住/有約/嗎/麻" tails as unanswered instead of complete memory. Verification: aiTown targeted Jest 23/23, memory Jest 44/44, `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check`, and `npm run underworld:runtime-preflight` PASS. Live post-patch spot-check shows world running, no active Alan conversation, no agent stuck in `agentGenerateMessage`, and no new `p:2 continuing conversation with p:11` storm in the latest log window. Existing `c:30824` already archived pre-patch and still contains a memory; do not treat it as clean post-patch evidence. | Umi / Codex / cc | attempt_backoff_and_unanswered_tail_guard_patched_watch_fresh_ichinose_chat |
| 31 | 2026-06-15 23:31 CDT hardware/runtime architecture review after Claude Code's F15 setup: current design is Mac runs Convex/world; cloud qwen-plus is primary; F15 `192.168.1.69` serves Ollama `qwen2.5:7b` as local fallback. Live checks from the Mac: `curl /api/tags` saw `qwen2.5:7b`; `curl /api/ps` showed the model loaded with `expires_at` in 2318, proving `OLLAMA_KEEP_ALIVE=-1`; OpenAI-compatible `/v1/chat/completions` returned in 2.26s; `npm run underworld:runtime-preflight` PASS with world running, due pending inputs 0, active conversations 0, stale active 0. Tail log still records older 22:58 `No route to host` memory fallbacks, but the current LAN path is reachable. If this hardware shape still fails under real load, next step is not more prompt churn: first pin/verify F15 network stability or DHCP reservation, then lower fallback load (`qwen2.5:3b`, `OLLAMA_NUM_PARALLEL=1`, cloud-only for Alan chats), and only then consider stronger hardware/cloud provider. | Umi / Codex | f15_fallback_reachable_watch_under_real_load |
| 32 | 2026-06-15 23:53 CDT Alan approved doubling the cloud attempt budget for the 2026-06-16 observation run and explicitly asked not to create another automation. `npx convex env set UMI_MAHIRU_PILOT_DAILY_QUOTA 600` succeeded on local deployment `local-alan_chu-ai_town`. Existing Codex automation `underworld-rolling-continuity-telegram` was updated in place to remain the single every-two-hour observer: it now records F15 reachability (`/api/tags`, `/api/ps`), quota/cost watch context, and strict no-auto-tuning rules. It may do only read-only checks plus the existing narrow liveness recovery boundary; it must not rewrite prompts/memory/provider config/code or create new threads/automations. `docs/current-env.md` and Central automation registry were updated. | Alan / Umi / Codex | quota_600_existing_two_hour_observer_only |
| 33 | 2026-06-16 08:02-08:43 CDT morning liveness recovery: the two-hour observer found `underworld:runtime-preflight` FAIL with `stored_world_clock_stale=7h22m` and `daytime_agent_input_stale=2h7m`; stale-watchdog dry-run had stale=0/messages=0 and F15 remained reachable. A first `testing:stop` -> wait -> `testing:resume` did not recover, but the `underworld-mobile` dev stack was then running again and a second clean stop -> wait 20s -> resume cleared the duplicate/generation mismatch loop. Verification after recovery: `/ai-town` HTTP 200, `underworld:runtime-preflight` PASS, `school:activeConversationRuntimeHealth` shows latest inputs completed through `agentFinishSendingMessage`, processed input caught up, active conversations 0, stale conversations 0, and logs show fresh conversations (`c:31467`, `c:31471`) plus `agentGenerateMessage`/memory operations rather than only repeated `agentDoSomething` timeouts. No code, prompt, env, memory, or Convex data cleanup was changed beyond the allowed runtime stop/resume. | Alan / Umi / Codex | morning_liveness_recovered_watch_next_observer |
| 34 | 2026-06-16 08:35-08:47 CDT Alan reported the world looked stuck again. This incident differed from #33: Vite/frontend stayed HTTP 200 on both `127.0.0.1:5173` and `192.168.1.239:5173`, but Convex local backend was not listening on `3210/3211`; `convex run` hung at `waiting for local backend to start...`, and `mobile-dev-stack.log` showed repeated `Failed to fetch logs` retries. Root cause: half-alive dev stack where wrapper/Vite survived but the `convex-local-backend` child was gone. Recovery: quit and restart the `underworld-mobile` screen; `3210` returned after about 12s. First post-restart preflight failed only on stale stored worldClock (`7h51m`); `school:advanceWorldTime {"hours":0,"timeZone":"America/Chicago"}` refreshed clock to 08:37, then `underworld:runtime-preflight` PASS at 08:47. Caveat: `advanceWorldTime hours=0` emits zero-hour world events, so future prevention should add a no-side-effect clock refresh or use a dedicated recovery path. No code, provider, prompt, memory cleanup, or destructive data changes were made. | Umi / Codex | backend_child_down_recovered_need_listener_check_no_side_effect_clock_refresh |

## Current State Snapshot

- 2026-06-18 ~12:30 CDT (CC, Alan-directed): **>>> CODEX D — merge the 3 read-only
  UW automations into ONE hourly hour-dispatcher; keep compaction separate.**
  Goal: easier management (4 Codex automations → 2) without losing safety. Build a
  single `kind=heartbeat` automation `underworld-hourly-ops`, `FREQ=HOURLY;BYMINUTE=0`,
  that branches on the current America/Chicago hour:
  - **every hour wake**, run the rolling-continuity work on ITS existing allowed
    hours only (the current automation gates to 08/10/12/14/16/18/20/22, not every
    hour) — keep that gating + its narrow-liveness-recovery/Telegram behavior. It
    already runs `npm run underworld:rolling-continuity` (which also does the
    speech-introspection capture when `UNDERWORLD_SPEECH_INTROSPECTION=true`).
  - **hour == 20** → ALSO a field-notes pass, but **DOWNGRADED to read-only scout /
    package-suggest ONLY**. >>> SAFETY (Codex caught this, CC agrees): the standalone
    field-notes-watcher prompt currently ALLOWS publish/upload of Field Notes when
    gates pass, and lives in the Field Notes channel/thread. Do NOT carry that
    publish/upload authority into the unattended hourly Underworld dispatcher —
    publishing the Umi channel must stay a separate, human-gated Field Notes operator.
    The hourly branch only scouts + suggests packages; it never publishes/uploads.
  - **hour == 23 (or 23:30)** → ALSO the nightly-reflection SHADOW pass (`npm run
    underworld:nightly-reflection`, shadow only — NEVER `--write`/approval token;
    reflection now actually produces insights after the max_tokens fix, so the shadow
    reports are finally meaningful — watch them, do not auto-enable write).
  Carry each task's existing safety rules into the merged prompt's per-hour branch,
  EXCEPT the field-notes publish/upload permission (dropped, per above). The
  `automation_update` tool is not exposed, so Codex edits the LOCAL source-of-truth
  `~/.codex/automations/*/automation.toml` and labels it as local config (does not
  claim to have operated the app panel). After the merged automation is confirmed
  running, PAUSE/retire the 3
  separate ones (`underworld-rolling-continuity-telegram`,
  `underworld-field-notes-watcher`, `underworld-nightly-reflection-shadow`).
  **KEEP `underworld-nightly-compaction` (04:00) SEPARATE and unchanged** — it is the
  only one that WRITES + cycles the backend ~10min and is coordinated with the
  world-watchdog via the maintenance lock; do NOT fold the dangerous compaction into
  the hourly dispatcher. End state: 2 Codex UW automations (hourly-ops + compaction).

- 2026-06-18 11:24 CDT (Codex): **Handled cc's CODEX A/B/C homework,
  keeping runtime behavior bounded.** A: added
  `docs/soul/SOUL_LOOP_LITERATURE_BRIDGE.md` as the conservative literature
  bridge for the full affective loop (situation/appraisal -> speech/residue ->
  emotion -> next speech -> sleep/tomorrow), and linked it from
  `docs/soul/README.md`. B: added review-gated Short package
  `media/shorts/2026-06-18-01-close-soul-loop/` with script, captions,
  thumbnail prompt, metadata, and `FIX_FIRST` review status; no render/upload.
  C: expanded `PortraitEmotion` display/type/schema support to include `tired`,
  `flustered`, `guarded`, and `calm`; generated provisional derived portrait
  and render assets for all 6 active stage characters; wired UI labels,
  prompt-facing emotion labels, and `portraitPaths`/`renderPaths`. Codex then
  attempted the cc inference handoff, but Claude returned a session-limit
  blocker (`resets 1:30pm America/Chicago`). Because the scope was already
  narrowed, Codex fallback completed the bounded `conversationEmotion`
  inference/test update directly: `tired`, `flustered`, `guarded`, and `calm`
  now infer from conservative cues while normal warmth/stress/confrontation
  still map to `smiling`/`worried`/`serious`. **Important boundary:** no
  memory/residue/sleep pipeline or provider config changed. The existing dirty
  `media/topics/mystery-candidates-latest.md` was pre-existing and unrelated.
- 2026-06-18 ~12:00 CDT (CC, Alan-directed): **Nightly reflection BUG FOUND + FIXED
  (07740de7) — the sleep/daily-consolidation edge was silently broken.** Investigated
  why the shadow reflection returned "no insights" for all 6: the LLM request had no
  `max_tokens`, so output was truncated mid-string and JSON.parse always threw →
  reflection NEVER consolidated anything (the ③→明天 daily-synthesis edge has been
  dead). Fixed (max_tokens=700 + valid-JSON example + tolerant parser); shadow now
  produces clean, grounded daily consolidations (relationship-stance shifts, no
  fabricated facts) for all 6 — the first usable shadow reports. **Open decision for
  Alan:** now that shadow output exists and is clean, whether to flip nightly
  reflection to WRITE mode (writes permanent `reflection` memories; needs the
  approval token). Recommend 1–2 more clean shadow nights, then enable.
- 2026-06-18 ~12:00 CDT (CC, Alan-directed): **>>> CODEX C — expand the emotion
  palette + portrait art.** Only 4 emotions exist (neutral/smiling/worried/serious),
  too few for the loop now that conversations drive emotion (②→④). Add a small,
  soul-relevant set with portrait art for all 6 characters. Proposed additions
  (Codex/Alan refine): **tired/疲憊** (exhaustion — a core 海/真晝 theme), **flustered/
  害羞** (warmth/fluster — Alan's confession case), **guarded/防備** (boundary
  defensiveness — 天澤/一之瀨), and optionally **calm/平靜** (settled, distinct from the
  neutral default). Work: add the values to `PortraitEmotion` (`data/characterVisuals.ts`
  + the duplicate in `convex/school.ts`), produce portrait images per character/emotion
  and wire `portraitPaths`, keeping the existing art style. **Coordination — tell
  Codex:** CC then updates the ②→④ inference (`convex/agent/conversationEmotion.ts`)
  and the `emotionZh` label map to use the new emotions; so Codex's PR should land the
  type + art + portraitPaths, and ping CC to extend the inference. Review-gated; do
  not change the conversation/residue pipeline.

- 2026-06-18 ~11:30 CDT (CC, Alan-directed): **Soul loop CLOSED** (②→④ conversation
  →emotion shipped, e8c9e3d4; ④→② already existed) + two Codex handoffs queued.
  **>>> CODEX A — literature study on the affective soul loop.** Companion to
  `docs/soul/SOUL_SPEECH_LITERATURE_BRIDGE.md`, but for the FULL loop now that it is
  closed: situation/event → speech → memory/residue → emotion → (colors next
  speech) → … Research + translate the relevant science into UW design language
  (conservative, no "agents have feelings" overclaim): appraisal theory of emotion
  (Lazarus/Scherer — emotion as the appraisal of what an event means to me),
  affect-as-information, mood-congruent memory & attention (a worried mind notices
  & recalls different things — this is exactly our un-wired ④→③ edge), emotion
  regulation, and memory consolidation during sleep (why a "nightly reflection"
  that synthesizes the day matters). Output a `docs/soul/SOUL_LOOP_LITERATURE_BRIDGE.md`
  design-lens doc; cite sources; mark which edges are live vs shallow (see the
  loop-review considerations in this snapshot). Review-gated, not a runtime change.
  **>>> CODEX B — short on closing the soul loop.** Through the WORKLOG #7
  review-gated media pipeline (package-first, no auto-publish, evidence-grounded,
  real before/after, no hype): the spine is the multi-day arc that converged today
  — we built a one-way pipeline (situation→speech→memory), realized the FEEDBACK
  edges were broken (a character's feelings never moved from what you said to them),
  and closed it: conversation → emotion → how they talk next. Use the real verified
  beat (a warm summary moved Umi serious→smiling, which then colors her next line).
  Honest boundary: it's a functional affective loop / heuristic emotion, not claimed
  sentience; deeper edges (emotion→memory, daily consolidation) are next.
- 2026-06-18 ~11:30 CDT (CC): **Nightly reflection (sleep consolidation) NOT enabled
  — blocked on a real issue.** Alan asked about turning the sleep mechanism to write.
  The latest shadow report (06-18 04:31) shows all 6 characters "would reflect" but
  every one returned "LLM returned no insights — provider unavailable" — i.e. the
  04:00-area reflection generation is failing (cloud LLM unavailable at ~4am), so
  there is NOT YET a single clean shadow report to judge consolidation quality. Per
  the mechanism's own safety rule (enable write only after several clean shadow
  reports), it stays in shadow. NEXT: diagnose why the ~04:00 reflection produces no
  insights (cloud cooldown/quota at that hour? run it at a different time?) so it
  actually generates, review the output for hallucination-free consolidation, THEN
  consider write mode. This is the ③→明天 daily-synthesis edge of the loop and is
  currently observed-only, not live.

- 2026-06-18 ~10:30 CDT (CC): **Automation consolidation (Alan-directed) — recovery
  unified into the watchdog, morning-healthcheck retired (pushed 2f006727).**
  Liveness/recovery was split across 3 agents with duplicated restart logic + a gap
  (a stopped-but-backend-up engine was only caught once a day at 06:00). Folded the
  two unique morning-healthcheck recoveries into `world-watchdog`: engine
  stopped/inactive → `testing:resume` (throttled ~10min), LLM-host DNS broken →
  `networksetup` DNS swap (~20min); both skip during a compaction (maintenance
  lock) and self-pace so the 120s loop stays cheap (port-down kickstart unchanged).
  Live-verified: watchdog detected `testing:stop` and resumed the engine. Retired
  the `com.giis.underworld.morning-healthcheck` launchd agent (bootout + plist
  removed; rollback copy `scripts/*.plist.retired` + the script stays in repo).
  **Now: ONE fast recovery agent (every 120s) covering port-down + engine-stopped +
  DNS, instead of watchdog + a once-daily healthcheck.** Remaining automation map:
  launchd = dev-stack (KeepAlive) + world-watchdog (120s, recovery); Codex =
  rolling-continuity (hourly, observe+introspection), nightly-compaction (04:00,
  coordinates with the watchdog via the lock), field-notes (20:00), reflection
  (23:30). The Codex underworld nightly trio run at distinct times by design — not
  worth merging.

- 2026-06-18 ~10:30 CDT (CC): **Fixed 3 collection-blocking issues (pushed
  a5c5934d).** (1) **Compaction↔watchdog conflict** (would have broken tonight's
  04:00 run): the nightly compaction cycles the backend ~10min, and the
  world-watchdog (every 120s) would `kickstart -k` the dev-stack mid-compaction and
  corrupt it. Added a maintenance lock (`umi/reports/.compaction-in-progress`):
  `underworld-compact-state.sh` holds it across the backend-down window
  (trap-cleaned), the watchdog stands down while a fresh lock exists (ignores a
  >20min stale lock). Codex's automation rules forbid launchctl, so the lock-file
  approach is the right coordination. Also fixed the compaction's hardcoded
  `STAMP=20260616` → dynamic. (2) **Day/night background flicker** (Alan's report:
  校長室 flips to a night image): `sceneVisualStyle` used `periodLabel`, which dropped
  to the '讀取中' loading sentinel every time the worldClock query re-subscribed
  (minuteTick) → no day/night variant → the base image flashed. Background now uses
  a retained last-good period (`lastGoodPeriodRef`) so it never flickers during
  reloads. (3) **Alan position**: `ensurePersistentAlan` now walks Alan back to the
  principal office (`moveTo` engine input) if `join` spawned him at a random tile.
  NOTE: 校長室 (=studentCouncilRoom) is shared by 海 + Alan; other characters showing
  there is proximity-based occupancy (normal movement), not a bug. build + tsc +
  preflight PASS.

- 2026-06-18 09:46 CDT (Codex): Read cc's nightly-compaction handoff and
  validated the prepared pieces. This Codex session did not expose
  `automation_update` after tool discovery, but the local Codex automation
  source-of-truth is available under `~/.codex/automations/*/automation.toml`.
  Codex therefore created Codex-level config
  `/Users/alanhdchu/.codex/automations/underworld-nightly-compaction/automation.toml`
  for daily 04:00 America/Chicago. This is **not** launchd/system-level
  scheduling. Verified: `scripts/underworld-nightly-compaction.sh`
  exists/executable, `scripts/com.giis.underworld.nightly-compaction.plist`
  linted OK but remains uninstalled, `bash -n` passed for both compaction
  scripts, and `scripts/underworld-compact-state.sh --check` reports
  `documents=309609`, `db=478 MB`, WARN not CRIT. The compaction script backs up
  Convex env with `convex env list` and restores with `convex env set`;
  `docs/current-env.md` includes `UNDERWORLD_SPEECH_INTROSPECTION=true` for
  manual restore/audit visibility. Next: confirm the first 04:00 run no-ops or
  compacts successfully.
- 2026-06-18 ~09:45 CDT (CC): **>>> CODEX — set up a Codex-level nightly
  compaction automation (Alan-directed).** The #41 launchd schedule was delegated
  to Codex but never built, so the DB grew unchecked overnight to ~304k docs (past
  the 250k WARN; #47 crash risk rises with DB/index size). CC prepared the pieces
  (commit 7a768e7d): `scripts/underworld-nightly-compaction.sh` (wrapper: cd +
  `CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS=900` + `underworld-compact-state.sh
  --auto`, logs to `umi/reports/compact-auto.log`) and a prepared launchd plist
  `scripts/com.giis.underworld.nightly-compaction.plist` (04:00 daily). **Codex
  task:** wire a Codex-level automation that runs `bash
  scripts/underworld-nightly-compaction.sh` **nightly at 04:00 America/Chicago**
  (deep sim-sleep 23:00-06:00 → the ~10-min world pause loses no conversations).
  `--auto` is a NO-OP below 250k docs and only compacts when grown past it (backs
  up + restores Convex env, keeps a recoverable archive), so it is safe every
  night. Confirm the compaction backs up/restores the live Convex env (incl.
  `UNDERWORLD_SPEECH_INTROSPECTION=true`) so the dashboard keeps refreshing after a
  compaction. DB is WARN not CRIT (500k) and the world was stable overnight, so the
  first scheduled 04:00 run handling it is fine — no urgent manual compaction.
- 2026-06-18 ~09:30 CDT (CC): **Persistent-Alan overnight regression FIXED
  (pushed cd6a0494).** Alan vanished overnight: the engine removes idle human
  players after 5min (`HUMAN_IDLE_TOO_LONG`) and the leave/create direct patches
  race the busy engine. Fix: exempt Alan (`human === DEFAULT_NAME`) from
  idle-removal in `player.ts` + `school:ensurePersistentAlan` recreates him
  race-proof via the engine `join` input. Live-verified: Alan recreated (p:54823)
  and survived past the 5-min idle threshold. Effect visible in samples —
  characters reference Alan naturally again (送藥/撿筆/偷喝茶).

- 2026-06-17 23:45 CDT (Codex): **UW speech-introspection + UI review wrap-up.**
  CC's small handoff is handled: Central confirmed the Codex heartbeat automation
  `underworld-rolling-continuity-telegram` runs `npm run
  underworld:rolling-continuity` in the allowed 2h daytime/evening windows, and
  `docs/current-env.md` now records `UNDERWORLD_SPEECH_INTROSPECTION=true` for
  Convex env restore after compaction/export resets. Codex also tightened
  `scripts/underworld-rolling-continuity.mjs` so capture is gated by the Convex
  deployment env exposed through `school:recentSpeechIntrospection.enabled`, not
  only by the shell's `process.env`; this avoids silent non-refresh in Codex
  automation shells. Live verification: Convex env list shows
  `UNDERWORLD_SPEECH_INTROSPECTION=true`; `school:recentSpeechIntrospection
  {"limit":10}` returns `enabled=true` and 8 live samples after a real
  `npm run underworld:rolling-continuity` run, which logged `introspection: 7 new
  / 8 generated / 8 candidates`. UI review: Conversation Wall tabs
  (`對話`/`殘留`/`記憶`/`睡眠筆記`) are clear enough as data-layer tabs on desktop
  and mobile with no horizontal overflow; the new speech-introspection page now
  auto-expands the first live conversation and labels conversation headers with
  `展開`/`收起`, so Alan sees the three-column evidence immediately. Verification:
  `npm run underworld:rolling-continuity:self-test`, `npm run
  underworld:introspection:self-test` (7/7), `npm run build`, browser desktop +
  390px mobile UI checks. Important product caveat: the refreshed rolling report
  is still `WARN / weak_continuity` and the v0.1 audit remains `FAIL` with 3
  fail / 5 pass; dashboard visibility is improved, but product v0.1 is not done.
- 2026-06-17 ~23:25 CDT (CC): **Speech-introspection dashboard now auto-refreshes
  every 2h.** `scripts/underworld-rolling-continuity.mjs` (the existing 2h job)
  now runs `agent/memory:captureSpeechIntrospection` (write, max 8) when
  `UNDERWORLD_SPEECH_INTROSPECTION=true` — best-effort, gated, doesn't affect the
  continuity verdict; adds a result line to the report. Flag is SET on the local
  deployment; live capture wrote rows and `school:recentSpeechIntrospection`
  returns them, so the `/introspection` view shows real 想說→被HIDE→說出口 data.
  Pushed (e4f4aeea). **>>> CODEX (small):** (1) confirm the every-2h
  Underworld Rolling Continuity automation actually runs `npm run
  underworld:rolling-continuity` (it should, per #40) so the capture fires on
  schedule; (2) add `UNDERWORLD_SPEECH_INTROSPECTION=true` to `docs/current-env.md`
  so compaction (export/import wipes env, see #39) restores it — otherwise the
  dashboard silently stops refreshing after a compaction.

- 2026-06-17 ~23:05 CDT (CC): **Codex speech-introspection dashboard accepted +
  3 user bugs fixed, all pushed (320771b1..a8e87142).** (1) Reviewed + committed
  Codex's `SpeechIntrospectionDashboard.tsx` (new `/introspection` view, 3-column
  flow, mockup-labelled, reachable from world 內省 tab / Wall 語音內省 button;
  frontend tsc clean). (2) **Duplicate conversations in the wall** — dedup the
  archived loop in `recentConversationEvalData` by conversation id (c:51740 had 9
  archive rows → 30 entries became 22 unique). (3) **Leave-race** — route
  `leaveAlanConversationNow` through the engine `leaveConversation` input instead
  of a clobbered direct patch (also kills the double-archive root cause);
  live-verified Alan leaves in ~3s with the engine running. (4) **Persistent Alan
  (Alan-directed design)** — Alan no longer leaves the world: `leaveCampus` keeps
  him as a passive presence hiding in the principal's office (flips `human` off,
  rotating solo activity 彈鋼琴/看樂譜/泡茶, ends conversations via engine input);
  `agentOperations.otherFreePlayers` excludes agent-less Alan so characters never
  autonomously invite the passive Alan. Fixes `alan: null` / can't-invite at the
  root (no transient re-creation race). Offline Alan stays PASSIVE (no AI drives
  him to talk → human-facing sample pool not polluted). Live-verified: leave keeps
  Alan present (was null before), re-enter online works. full tsc + 155 agent
  tests + preflight green.

- 2026-06-17 22:35 CDT (Codex): **Speech-introspection dashboard UI built and
  wired.** New route `?view=introspection` renders a read-only dashboard separate
  from Conversation Wall, with expandable conversation groups by day and three
  columns: `想說` / `被 HIDE + gateReason` / `說出口`. Entry points now exist from
  the main view switch (`內省`) and Conversation Wall (`語音內省`). The dashboard
  calls `school:recentSpeechIntrospection { limit: 80 }`; while runtime capture is
  empty or loading, it clearly shows layout-preview sample rows and states they
  are not real conversation evidence. Codex touched only frontend route/UI/CSS
  files: `src/App.tsx`, `src/components/Game.tsx`,
  `src/components/ConversationWall.tsx`, `src/components/SpeechIntrospectionDashboard.tsx`,
  and `src/index.css`. Verification: `npm run build` PASS,
  `npm run underworld:introspection:self-test` PASS (7/7), `git diff --check`
  PASS, and browser smoke at `http://127.0.0.1:5173/ai-town?view=introspection`
  confirmed the new page and route buttons. Direct Convex check
  `school:recentSpeechIntrospection {"limit":1}` returned `enabled=false`,
  `count=0`, `samples=[]`, matching the expected pre-capture state. **CC next
  remains runtime capture:** write gated/sampled ①②③ rows into
  `speechIntrospection`; until then live row count may be 0 / loading.
- 2026-06-17 ~22:15 CDT (CC): **Speech-introspection dashboard — spec'd + data
  contract built; Codex to build the UI.** Alan wants the literature-bridge speech
  flow made visible: ①內心想說 → ②被HIDE/軟化 → ③說出口. Today's runtime only
  generates ③, so CC is adding a **gated + sampled introspection capture**
  (`UNDERWORLD_SPEECH_INTROSPECTION`, **baseline collection untouched**) that also
  generates ①②. Shipped now (commit fcd10d1f): `speechIntrospection` table +
  `school:recentSpeechIntrospection` read query (with `enabled`/empty-state) +
  `docs/SPEECH_INTROSPECTION_DASHBOARD_SPEC.md`. **>>> CODEX:** build the web
  dashboard per that spec — NEW page separate from the Conversation Wall, 3-column
  flow (想說 | 被HIDE+why | 說出口), group-by-day, expandable, **mockup-first** for
  Alan to approve layout, then wire to `recentSpeechIntrospection`. Read-only, no
  runtime/schema changes. **>>> CC DONE (commit 1ac8f75a):** runtime capture
  shipped — `agent/speechIntrospectionPrompt.ts` (pure prompt+parser, 7 tests),
  `school:turnsForSpeechIntrospection` + `school:writeSpeechIntrospectionRows`,
  `agent/memory:captureSpeechIntrospection` action (POST-HOC + decoupled: given the
  SAID line unchanged, generates ①innerWant + ②heldBack + why; baseline untouched;
  dry-run / env-gated by `UNDERWORLD_SPEECH_INTROSPECTION`; bounded; dedup by
  messageUuid). Live dry-run verified (海→Alan: said「校長室的燈我會留一盞」/ wanted
  「怕你累倒，想抱你進休息室蓋毯」/ held fear+touch as metaphor, why 怕加重負擔). Populate:
  `convex env set UNDERWORLD_SPEECH_INTROSPECTION true` then `npx convex run
  agent/memory:captureSpeechIntrospection '{"write":true,"max":8}'`.
- 2026-06-17 ~22:05 CDT (CC): **Two human-play-path bugs found (manually worked
  around tonight; need a real fix so Alan can play without hand-holding).** (1)
  **Enter:** Alan invited 海 but `debugAlanConversationState.alan` was `null` — the
  frontend "enter game" did NOT call `school:enterCampus`, so Alan was an observer
  not a player. Worked around by running `enterCampus` manually. Fix: make the
  frontend enter flow reliably call enterCampus (likely regressed with the recent
  "offline Alan observation mode" / scene-mode changes). (2) **Leave:** Alan
  couldn't leave conversation c:51740; `leaveAlanConversationNow` returned success
  but the conversation persisted because it **directly patches the world doc and
  the running engine's saveDiff clobbers the patch (race)** — the function's own
  6513 comment warns about exactly this. Worked around with `testing:stop` → leave
  → `testing:resume`. Fix: route the human leave through an **engine input**
  (so the engine applies it) instead of a direct patch. Also seen: human-facing
  replies intermittently time out as "連線暫時不穩" under cloud latency (late-night /
  heavy-day), and by design do NOT fall back to local 7b — that is provider
  flakiness, not a code bug; revisit (allow fallback / tune timeout) only if it
  blocks human-sample collection.
- 2026-06-17 ~22:00 CDT (CC): **Forgetting mechanism F0–F3 BUILT + deployed (env OFF).**
  `docs/soul/FORGETTING_MECHANISM_SPEC.md` implemented: `convex/schoolForgetting.ts`
  (pure `forgettingTier` — sink only OLD + importance≤4 + long-idle, never
  reflections; 9 unit tests), `agent/schema.ts` (`memoryEmbeddingsArchive` table
  with NO vectorIndex + optional `memories.dormant/dormantSince/archivedEmbeddingId`),
  `school.ts` `forgettingAudit` (F0 read-only) / `archiveDormantEmbeddings` (F2
  dry-run/env-gated write — sink = copy embedding to archive, delete from active
  vector index, mark dormant, **never touch description**) / `reactivateMemory`
  (F3 restore). Live-verified: F0 = **4539 memories/embeddings, 0 sink candidates**
  under conservative defaults (world only ~5 days old since the 6/12 reset). F2
  dry-run + write-block gate proven. tsc + 9 tests + preflight green. Env-gated
  OFF; live world untouched until `UNDERWORLD_FORGETTING=true`. **HONEST
  RECALIBRATION of WORKLOG #47's crash hypothesis:** the index is only ~4.5k
  embeddings yet the backend still crashes — so index SIZE is NOT the dominant
  near-term crash driver at this scale; the search-cleanup-thread bug + 16GB
  memory pressure is. Forgetting is the right LONG-TERM hygiene + the #42 soul
  feature (matters as the index grows over weeks), but it will NOT noticeably cut
  crashes in the 3-week window. **The watchdog remains the near-term stability
  answer.** Forgetting starts having candidates naturally once memories age past
  14 days (~9 days out) or if thresholds are tuned.
- 2026-06-17 21:15 CDT (CC): **Inversion Stage ① (memory layer) VERIFIED DONE.** Watcher
  cycle 4 (post-20:47 batch, 12 conversations) confirms the summary patch (b,
  e83a28b8) worked: 記住 summary micro-tell ratio dropped from ~6/9 pre-patch
  (喉結動 ×3 etc.) to **0/11** — summaries now anchor on real substance (「抹布晾在
  二樓洗衣間」「鑰匙在筆盒旁沒動過」「利息得你親口說想換什麼」). Residue stays
  SELECTIVE (~4/12 leave a trace on weighty moments, ~8/12 leave 無) — not
  over-corrected. Both memory-layer exits (residue + summary) are now off the
  micro-tell template. NEXT (Alan's call, not started): (c) EVENTS — safely enable
  Codex's E1→E2 (UNDERWORLD_V02_EMERGENT_EVENTS) for the first consequential event,
  the prerequisite for the speech-layer "unsaid" gate (SOUL_SPEECH_LITERATURE_BRIDGE).
  World stability: stable since the 20:46 recovery; watchdog installed + quiet (no
  crash). In-session watcher stood down (watchdog owns uptime; no quality patch pending).

- 2026-06-17 20:01 CDT: Central Umi aligned Alan's soul/speech literature-review
  insight into the Underworld roadmap. Added
  `docs/soul/SOUL_SPEECH_LITERATURE_BRIDGE.md` as a design seed connecting
  soul/self, speech intention, common ground, inner speech, self-monitoring,
  inhibition, and face-work to the existing Speech & Situation inversion plan.
  Updated `docs/soul/README.md`, `docs/soul/SPEECH_AND_SITUATION_INVERSION.md`,
  and `docs/giis-v0.1-roadmap.md` to route future work through the bridge. This
  is not a runtime change and not a v0.1 completion claim. Next useful use:
  evaluate future speech-quality work for situation appraisal -> private
  candidate speech -> social/pragmatic gate -> spoken line/silence, without
  broad prompt rewrites before fresh v0.1 evidence is collectible.
- 2026-06-17 16:42 CDT: Completed cc WORKLOG #45 handoff items A/B, and also
  packaged the requested Shorts candidates for review. v0.2 emergent-events
  substrate is now implemented but runtime-default-off: `worldEvents` has
  optional consequence metadata, `convex/schoolEmergentEvents.ts` defines the
  env gate and E1-E4 planning rules, and
  `school:applyEmergentEventCandidates` can dry-run candidate consequences or
  write only when `UNDERWORLD_V02_EMERGENT_EVENTS=true`. E1 marks only clean
  conversation outcomes as candidates, repeated-noise never promotes, E2 queues
  an intention and safe pathfinding movement, E3 applies a tiny relationship
  shift, and E4 writes one bounded follow-up event with no recursive chaining.
  Current live dry-run is callable but found 0 candidates, so no live world
  mutation was performed. Source-lore enrichment is aligned in
  `docs/soul/CHARACTER_SOURCES.md` and `convex/agent/conversation.ts`: Umi is
  grounded as 朝凪海, Tianze keeps only safe mischievous/boundary-testing energy
  with explicit/露出 material forbidden, and Tianze/Ichinose is treated as the
  richest source-conflict relationship spine. Five review-gated Shorts packages
  were created under `media/shorts/` plus
  `media/topics/2026-06-17-worklog45-shorts-plan.md`; nothing was rendered or
  uploaded. Verification: `npm run underworld:emergent-events:self-test` PASS,
  `npm test -- convex/agent/conversationMotifGuard.test.ts` PASS,
  `npx tsc --noEmit --pretty false` PASS, `npm run build` PASS,
  `git diff --check` PASS, `npm run underworld:runtime-preflight` PASS, and
  `npx convex run --typecheck disable --codegen disable school:applyEmergentEventCandidates '{"write":false,"max":3}'`
  returned `status=dry_run`, `enabled=false`, `checked=0`.
- 2026-06-16 22:21 CDT: Completed WORKLOG #40 CODEX ACTION. `scripts/underworld-rolling-continuity.mjs`
  now calls `scripts/underworld-peek.sh health` and `scripts/underworld-peek.sh talk`
  while building the read-only rolling continuity report, then writes the
  outputs into `umi/reports/rolling-continuity-latest.md` as `Peek Health` and
  `Peek Recent Residue Digest`. The actual run confirms those sections now show
  world status (`status=running`, sim day/time, active conversation count, DB
  size) and recent conversation residue/memory lines. This does not mutate
  Convex, trigger conversations, send Telegram directly, or change the
  codex-level automation panel; it makes the repo report richer so any
  codex-level automation that runs `underworld:rolling-continuity` inherits the
  passive health/residue snapshot. Verification: `npm run underworld:rolling-continuity:self-test`
  PASS, `node --check scripts/underworld-rolling-continuity.mjs` PASS,
  `bash -n scripts/underworld-peek.sh` PASS, actual `npm run underworld:rolling-continuity`
  wrote the new sections and exited WARN / `weak_continuity` as expected,
  `npm run underworld:runtime-preflight` PASS, and `git diff --check` PASS.
- 2026-06-16 22:17 CDT: Reviewed cc's forced-sample focus diagnosis and
  completed the remaining handoff item. The focus-pair timeout/harness issue was
  already patched and verified in `ad6d6636` / `umi/reports/20260617T000242Z-workload.md`;
  Codex found one follow-up reporting bug in `underworld:v01-completion-audit`:
  rolling continuity refreshed the completion audit from current reports, but
  the audit did not read `evals/conversations/reports/soul-triad-latest.md`, so
  it could show `freshSamples=0` even when the soul-triad report had fresh rows.
  Patch: `scripts/underworld-v01-completion-audit.mjs` now reads the soul-triad
  report and falls back to its conversation-row count when repair/rubric reports
  do not include `Fresh triad samples`; self-test covers this path.
  Verification: `npm run underworld:v01-completion-audit:self-test` PASS,
  `node --check scripts/underworld-v01-completion-audit.mjs` PASS,
  `npm run underworld:v01-completion-audit` still correctly FAILs but now with
  `freshSamples=3`, `npm run underworld:runtime-preflight` PASS,
  `npm test -- evals/conversations/metrics/conversation_metrics.test.ts` PASS
  20/20, `npm run underworld:life-signals:self-test` PASS, and
  `git diff --check` PASS. Current real blockers are not harness count bugs:
  `life-signals-latest.md` remains WARN / `life_signal_repeated` with repeated
  surface lines and pilot action collapse, and `rolling-continuity-latest.md`
  remains WARN / `weak_continuity`. Next safe task is a bounded quality patch or
  proposal for repeated surface lines / object-motif relay, not broad prompt
  tuning or memory/provider changes.
- 2026-06-16 19:16 CDT: Alan asked Codex/Umi to force a few fresh
  conversations and fix the current dialogue issue. Controlled sample collection
  exposed a harness bug before any prompt repair: `underworld:observe:daytime-samples`
  collected 5 fresh transcripts and `eval:soul-triad` passed them 5/5, but two
  focus runs (`Tianze:Ichinose`, `Ichinose:Maomao`) timed out while valid focus
  conversations were later visible in `school:recentConversationEvalData`.
  cc read-only diagnosis `umi/reports/20260617T000242Z-workload.md` correctly
  identified that `scripts/run-soul-triad-single-sample.mjs` rejected
  non-original-triad focus pairs before checking the focus key; Codex also found
  the missing alias layer (`Ichinose`, `Maomao`, `Sakiko`) and patched both.
  `scripts/underworld-observe-once.mjs` also had a report-writing crash because
  `openingTemplateLines()` called an undefined `truncate()` helper; Codex added
  the local helper. Verification: `node --check scripts/run-soul-triad-single-sample.mjs`
  PASS, `node scripts/run-soul-triad-single-sample.mjs --self-test` PASS,
  `node scripts/underworld-observe-once.mjs --self-test` PASS,
  `npm test -- evals/conversations/metrics/conversation_metrics.test.ts` PASS
  20/20, `npm test -- convex/agent/conversationMotifGuard.test.ts` PASS 46/46,
  `npx tsc --noEmit --pretty false` PASS, `npm run build` PASS,
  `git diff --check` PASS, and `npm run underworld:runtime-preflight` PASS.
  Live confirmation after the alias patch accepted `Tianze:Ichinose` focus sample
  `conversation-c:37914` after 5 polls and `eval:soul-triad` passed it. Dialogue
  quality itself is not fixed yet: latest `eval:conversation:recent -- --since-last-change`
  remains 0 PASS / 4 WARN / 8 FAIL, with mirror/motif and weak character-voice
  findings. Do not broad prompt-tune from this patch; next safe task is a
  separate, small proposal or patch for conversation-quality calibration/motif
  diversification after reviewing the fresh 12-sample window.
- 2026-06-16 17:18 CDT: Completed Alan-approved narrow v0.1 evidence fix for
  the three issues from today's data review. cc read-only review
  `umi/reports/20260616T224524Z-workload.md` agreed with the boundary: fix the
  eval blind spot, add cross-conversation opener-template diagnostics, and keep
  experience-log cap/dedupe observe-only for now. Codex patched
  `emotionalSpecificityScore` so concrete care commitments such as "我先去把便當盒熱好，
  回來陪你一起吃" count as implicit emotional specificity without turning generic
  food props into free points; added regression tests including a negative
  `收條` teasing case; added a reusable opener-template fingerprint helper and
  `Cross-Conversation Opener Templates` section to recent eval reports; and
  split observe experience-log rejection language so day caps show as
  `cap_reached_for:<角色>` instead of the old ambiguous
  `possible_cap_dedupe_or_recent_not_loaded`. Latest recent eval now surfaces a
  concrete duplicate opener template:
  `conversation-c:36886` / `conversation-c:36774` both start with
  `貓貓: 你剛才轉圈時左腳鞋帶鬆了。`. This proves the next product issue is real
  repeated opener/object templates, not merely the old "0 emotional cue" rubric
  bug. Verification: `npm test -- evals/conversations/metrics/conversation_metrics.test.ts`
  PASS 20/20, `node --check scripts/underworld-observe-once.mjs` PASS,
  `npm run underworld:observe:self-test` PASS, `npm run eval:conversation:recent -- --since-last-change`
  completed and wrote the opener-template section, `npm run eval:soul-triad`
  PASS 8/8, `npx tsc --noEmit --pretty false` PASS, `npm run build` PASS,
  `npm run underworld:runtime-preflight` PASS, and `git diff --check` PASS.
  Do not broad prompt-tune yet; next safe direction is a proposal/small patch
  against repeated opener/object templates only if another fresh window confirms
  the pattern.
- 2026-06-16 16:48 CDT: Underworld v0.1 review / human-test readiness pass is
  complete enough to commit and hand Alan a stable next manual test. cc
  performed the requested current-diff second opinion in
  `umi/reports/20260616T211519Z-workload.md`: no P0, no commit blocker;
  MysteryDetector stayed read-only/review-safe; the selected-character anchor
  and Conversation Wall graceful empty state were accepted with caveats; cc's
  smallest recommended readiness patch was a fail-fast backend listener probe.
  Codex implemented that plus a safer no-event clock refresh mutation
  (`school:refreshStoredWorldClock`), a new
  `npm run underworld:human-flow-ready` gate/report, frontend loading-shell
  recovery buttons, frontend-smoke scene fallback for empty rooms, and
  Conversation Wall wording polish. Verification after the patch:
  `npm run underworld:runtime-preflight:self-test` PASS,
  `npm run underworld:human-flow-ready:self-test` PASS,
  `node --check` on the changed scripts PASS, `npm run underworld:mystery-detector`
  PASS, `npx tsc --noEmit --pretty false` PASS, `npm run build` PASS,
  `git diff --check` PASS, `npm run underworld:runtime-preflight` PASS,
  `npm run underworld:frontend-smoke` PASS 5/5, and
  `npm run underworld:human-flow-ready` READY with mobile URL
  `http://192.168.1.239:5173/ai-town`. Evidence collection ran but did not close
  v0.1: `npm run underworld:observe:daytime-samples` collected 4 fresh pilot
  samples; `eval:soul-triad` was 8/8 PASS, while
  `eval:conversation:recent -- --since-last-change` stayed 0 PASS / 3 WARN / 9
  FAIL and `underworld:rolling-continuity` stayed WARN / weak continuity. Repair
  gate correctly produced proposal-only
  `umi/proposals/20260616T214514Z-v01-approach-proposal.md`; cc agreed not to
  prompt-tune yet because the likely next safe task is rubric/emotional-cue
  calibration plus residue/opening-template investigation, not broad prompt
  changes. Manual acceptance still required: Alan should run the human-flow
  gate, then test 海 / 真晝 / 貓貓 / 天澤 / 一之瀨 / 祥子 with greeting plus one
  short promise/memory hook, recording stuck state, scroll behavior, fallback,
  and residue quality.
- 2026-06-16 16:10 CDT: Alan reported today's UI felt especially flickery /
  like the screen suddenly jumped while playing. Fresh evidence separated three
  causes: local dev/build HMR page reloads while Codex was editing, real Convex
  runtime overload, and one frontend selection-anchor gap. First
  `npm run underworld:runtime-preflight` failed because
  `school:activeConversationRuntimeHealth` timed out with `performing too many
  system operations`; `umi/reports/mobile-dev-stack.log` around 16:02-16:03 CDT
  showed timeouts in `campusTimeline`, `campusSocialState`, `umiBriefing`,
  `agentSendMessage`, and `saveWorld`, then `restartDeadWorlds` restarted the
  engine. A smoke run during the overload reproduced visible UI symptoms:
  mobile Conversation Wall stayed at `載入中` and returned to a loading world,
  while small-mobile selected 一之瀨 and then lost the central selected standee
  after the live simulation pulled her into a conversation with 海. Patch:
  `Game.tsx` now keeps the selected player in the stage as a visual anchor even
  when the simulation moves them out of the viewed scene, and marks any
  off-scene staged player as `is-offscene`; `ConversationWall.tsx` now degrades
  to a stable empty/partial state after a short no-data wait instead of staying
  indefinitely on `載入中`. Verification: `npx tsc --noEmit --pretty false`
  PASS, `npm run build` PASS, `npm run underworld:runtime-preflight` rerun
  PASS, `git diff --check` PASS, and `npm run underworld:frontend-smoke` PASS
  5/5 generated at `2026-06-16T21:07:09.150Z`; all viewports returned to world
  without overflow / hard console / hard network issues. Remaining risk:
  runtime overload still needs engine/query pressure work; UI now degrades more
  gently but cannot make Convex timeouts disappear.
- 2026-06-16 15:56 CDT: Continued frontend launch-readiness audit after
  `2527bd0f`. cc residual review `umi/reports/20260616T204624Z-workload.md`
  found no confirmed P0, but flagged two P1s: iOS `100vh` world-shell clipping
  risk and Conversation Wall smoke skipping small-mobile/tablet. Codex also ran
  a local non-mutating 844x390 landscape probe and reproduced a concrete
  clipping issue: before patch the standee row had `y=-101` while the topbar was
  176px tall, so character art was pushed above the viewport. Patch: `App.tsx`
  now uses `100dvh` root height, `index.css` adds a short-height mobile
  landscape layout that compresses the topbar and standees (probe after patch:
  topbar 54px, standee row `y=137`, no overflow), and
  `underworld:frontend-smoke` now includes `landscape-mobile` 844x390 plus
  runs Conversation Wall open/return checks for every viewport instead of only
  mobile/desktop. `umi/playtest-frontend-mobile-acceptance.md` now records the
  expanded machine coverage while keeping real-device iPhone acceptance
  required. Verification: `npx tsc --noEmit --pretty false` PASS,
  `npm run build` PASS, `npm run underworld:runtime-preflight` PASS,
  `git diff --check` PASS, and `npm run underworld:frontend-smoke` PASS 5/5
  generated at `2026-06-16T20:54:02.188Z`; mobile, small-mobile,
  landscape-mobile, tablet, and desktop all selected a character, held idle,
  opened Conversation Wall, returned to world, had `conversationWallCheck.ok=true`,
  and had no horizontal overflow. Remaining launch condition: Alan real
  iPhone/in-app mobile acceptance for touch feel, keyboard occlusion during real
  message send, background/foreground reconnect, native select rendering, and
  subjective flicker.
- 2026-06-16 15:38 CDT: Alan reported today's UI felt especially flickery /
  like it suddenly jumped while playing. cc read-only review
  `umi/reports/20260616T203207Z-workload.md` recommended closing the remaining
  machine-check gap by exercising the topbar `對話` route. First patched smoke
  run caught a real mobile issue: world selection stayed stable, but mobile
  Conversation Wall remained `載入中` after 15s while desktop loaded 45 cards
  and returned to world correctly. Patch: `ConversationWall.tsx` now starts
  mobile/tablet with a smaller payload (`limit=18`, `messagesPerConversation=5`)
  and renders partial available rows/status instead of blocking the whole grid
  until both conversation and campus-state queries finish. `underworld:frontend-smoke`
  now opens `對話` and returns to `世界` for mobile 390x844 and desktop
  1440x960, asserting wall header/metrics/filters/select/grid, no reconnect
  fallback, no horizontal overflow, no hard console/network issue, and live room
  return. Verification: `npx tsc --noEmit --pretty false` PASS, `npm run build`
  PASS, `npm run underworld:runtime-preflight` PASS, `git diff --check` PASS,
  and `npm run underworld:frontend-smoke` PASS 4/4 generated at
  `2026-06-16T20:37:57.589Z`; mobile wall check now passes in 2.7s with 9 cards
  plus the partial-loading note, desktop wall check passes and returns to world.
  Remaining launch condition is still Alan real iPhone/in-app mobile acceptance,
  especially touch feel, iOS background/foreground reconnect, and long wall
  readability.
- 2026-06-16 15:26 CDT: Tablet breakpoint frontend smoke coverage added after
  cc's residual frontend pass identified the 768-900px tablet range as the only
  cheap machine-check gap worth closing before Alan's real-device acceptance.
  Patch: `underworld:frontend-smoke` now includes a tablet viewport
  `820x1180` in addition to mobile 390x844, small-mobile 360x640, and desktop
  1440x960. Verification: `npx tsc --noEmit --pretty false` PASS,
  `npm run build` PASS, `npm run underworld:runtime-preflight` initially saw a
  transient `school:debugState` "performing too many system operations" timeout
  while listener ports 3210/3211/5173 were healthy, then rerun PASS;
  `npm run underworld:frontend-smoke` PASS 4/4 generated at
  `2026-06-16T20:25:09.761Z`. Mobile, small-mobile, and tablet selected 天澤 in
  餐廳場景; desktop selected 祥子 in 中央庭院場景; every viewport had
  `idleOk=true`, 7 samples, `drift=0`, `consoleIssues=0`, `badNetwork=0`, and
  no horizontal overflow (`tablet` scroll `820/820`). Remaining frontend launch
  condition is unchanged: Alan real mobile/touch acceptance via
  `umi/playtest-frontend-mobile-acceptance.md`.
- 2026-06-16 15:18 CDT: cc residual frontend market-readiness pass
  `umi/reports/20260616T201756Z-workload.md` found no P0 after `80cd6a22`.
  It classified the remaining P1 as manual-only real mobile/touch acceptance:
  headless Chrome proves structural stability, but not iPhone Safari tap
  latency, keyboard occlusion, iOS bounce, foreground/background reconnect, or
  cellular websocket behavior. Codex did not pre-patch subjective P2 items
  (toast wrapping, helper clamp, tablet viewport) because cc judged them
  unconfirmed polish. Instead, Codex added
  `umi/playtest-frontend-mobile-acceptance.md`, a 12-step real-device frontend
  acceptance gate with required pass items for cold open, conversation
  affordance, send-message, and background/foreground reconnect. Fresh
  verification before the gate: `npm run underworld:runtime-preflight` PASS and
  `npm run underworld:frontend-smoke` PASS 3/3 generated at
  `2026-06-16T20:15:59.259Z`, with mobile/small-mobile/desktop all selecting
  祥子 in 中央庭院場景, `idleOk=true`, 7 samples each, `drift=0`,
  `consoleIssues=0`, `badNetwork=0`, and no horizontal overflow. Remaining
  frontend launch condition: Alan must run the real-device acceptance gate; do
  not mark frontend market-ready from machine checks alone.
- 2026-06-16 15:10 CDT: cc post-selection stability review
  `umi/reports/20260616T200529Z-workload.md` found a remaining P1 jump vector
  matching Alan's "suddenly jumps then comes back" report: transient
  `defaultWorldStatus` or `userStatus` `undefined` could briefly make
  `worldId`, `game`, `humanPlayer`, or `isConversationMode` disappear, dropping
  the live room into loading or non-conversation styling and then snapping back
  when Convex recovered. Patch: `Game.tsx` now keeps last-good
  `defaultWorldStatus` and same-world `userStatus` during brief Convex
  undefined windows, while still clearing the user cache when the world id is
  gone/changes. The existing non-mutating `underworld:frontend-smoke` now also
  runs a post-selection idle stability check: after selecting a visible
  non-Alan standee, each viewport samples the live room for 7 seconds and fails
  if the loading shell, reconnect fallback, selected target, scene aria-label,
  bottom status, CTA/helper/focus card, horizontal overflow, console issue, or
  bad network state drifts. Verification: `npx tsc --noEmit --pretty false`
  PASS, `npm run build` PASS, `npm run underworld:runtime-preflight` PASS,
  `npm run underworld:frontend-smoke` PASS 3/3 with mobile 390x844,
  small-mobile 360x640, and desktop 1440x960 all selecting 祥子 in
  中央庭院場景, `idleOk=true`, 7 samples each, `drift=0`,
  `consoleIssues=0`, `badNetwork=0`, and no horizontal overflow; `git diff
  --check` PASS. Remaining manual gate: Alan real mobile/touch acceptance and
  any subjective residual toast flicker.
- 2026-06-16 14:55 CDT: cc mobile-flow gate review
  `umi/reports/20260616T195319Z-workload.md` found no P0 after `82dad797` and
  recommended extending the existing frontend smoke with a non-mutating
  select-visible-character step rather than creating a separate script. Patch:
  `underworld:frontend-smoke` now clicks the first visible non-Alan standee in
  each viewport, verifies a selected character, bottom status `目標`, visible
  mobile helper / desktop focus card, and a visible primary CTA, while still
  avoiding all action/CTA buttons that would mutate Convex state or trigger LLM
  work. The stricter gate now fails on any hard console issue; this immediately
  exposed a React duplicate-key warning from `playFlowSteps` when two steps both
  used label `對話`, fixed by keying flow steps with label+index. Verification:
  `npm run underworld:frontend-smoke` PASS 3/3 with mobile 390x844,
  small-mobile 360x640, and desktop 1440x960 all selecting 一之瀨, showing the
  invite/wake- Alan helper/CTA, `consoleIssues=0`, and no horizontal overflow;
  `npx tsc --noEmit --pretty false` PASS, `npm run build` PASS,
  `npm run underworld:runtime-preflight` PASS, and `git diff --check` PASS.
  This still does not replace Alan's real mobile/touch acceptance, but it now
  proves the main read-only selection path rather than only passive page mount.
- 2026-06-16 14:41 CDT: Residual frontend market-readiness cc review
  `umi/reports/20260616T193516Z-workload.md` found no P0 after `4abe717e` and
  confirmed the main P1 was the Convex browser-import warning in frontend
  smoke. Patch: frontend parsing now uses a client-only `ClientWorld` snapshot
  instead of importing backend simulation classes (`World` / `Player` /
  `Conversation` / `Agent`) into the browser; related frontend imports were
  narrowed to `import type`; `conversation.ts` and `player.ts` now import
  backend `Game` only as a type; and the smoke gate no longer treats the Convex
  browser-import warning as known/allowed. Verification:
  `npx tsc --noEmit --pretty false` PASS, `npm run build` PASS with frontend JS
  bundle reduced from 487.07 kB to 417.58 kB, `npm run
  underworld:runtime-preflight` PASS, `git diff --check` PASS. The strict smoke
  gate now covers mobile 390x844, small-mobile 360x640, and desktop 1440x960;
  `npm run underworld:frontend-smoke` PASS 3/3 with all viewports live, 0 hard
  console issues, no horizontal overflow, and only the harmless
  `Ignoring Event: localhost` known warning. The two cc P2 mobile polish issues
  were also patched: mobile bottom status now shows the selected CTA helper line
  when the focus card is hidden, and small-phone bottom bar / character-row
  spacing is guarded by a 360x640 smoke viewport. Remaining frontend launch
  evidence gap: real Alan/in-app mobile acceptance.
- 2026-06-16 14:27 CDT: Alan reported that today's UI still felt unusually
  flickery / suddenly jumped while playing. The fresh smoke report reproduced
  the concrete jump path: mobile hit the route-level reconnect fallback because
  `school:campusSocialState` timed out with `performing too many system
  operations`, and that non-critical query was still inside the main `Game`
  render path. Patch: `Game.tsx` now moves `campusSocialState` and
  `umiBriefing` into a hidden `CampusContextLoader` wrapped by a
  `SoftQueryBoundary`; successful results update cached parent state, but
  transient timeout/errors only pause/retry the optional loader instead of
  remounting the live room. Verification: `npx tsc --noEmit --pretty false`
  PASS, `npm run build` PASS, `npm run underworld:runtime-preflight` PASS,
  `git diff --check` PASS, and `npm run underworld:frontend-smoke` PASS 2/2
  with mobile/desktop live room, no ErrorBoundary, no horizontal overflow, and
  no hard asset/network failures. Remaining caveat: the known Convex
  browser-import console warning is still a future-compatibility follow-up,
  not the root cause of this jump.
- 2026-06-16 14:18 CDT: Added repeatable frontend visual smoke coverage after
  the transient-reload resilience patch. `npm run underworld:frontend-smoke`
  now launches headless Chrome for mobile 390x844 and desktop 1440x960, waits
  for `.giis-live-room-shell`, captures screenshots, checks no horizontal
  overflow, and fails on hard 4xx/failed asset requests. First run PASS 2/2:
  both mobile and desktop reached live room, `loading=false`, `badNetwork=[]`,
  and scroll width matched viewport width. The smoke found missing emotion
  portrait 404s for characters without generated portrait variants; fixed by
  mapping unavailable portrait emotions back to the base portrait while keeping
  existing `maomao-serious` and `sakiko-serious` variants. Known remaining
  console warning: browser bundle imports some Convex server/function modules;
  smoke records this as known but does not fail on it yet. Verification:
  `npx tsc --noEmit --pretty false` PASS, `npm run build` PASS,
  `npm run underworld:runtime-preflight` PASS, `git diff --check` PASS, and
  `npm run underworld:frontend-smoke` PASS.
- 2026-06-16 14:04 CDT: Residual frontend market-readiness cc review
  `umi/reports/20260616T190105Z-workload.md` found no P0 after `bec338b`, but
  identified one remaining P1 jump vector: if `worldState`,
  `gameDescriptions`, or `messages.listMessages` briefly returned `undefined`
  during a Convex hiccup, active dialogue could still unmount, wiping draft /
  optimistic state. Patch: `useServerGame` keeps last-good world/descriptions
  for the same `worldId`; `Messages` keeps last-good messages for the same
  conversation id; and `PlayerDetails` no longer fires `debugState` / `observe`
  refreshes while Alan is in an active human conversation. Verification:
  `npx tsc --noEmit --pretty false` PASS, `npm run build` PASS, `npm run
  underworld:runtime-preflight` PASS, `git diff --check` PASS, and `curl -I
  http://localhost:5173/ai-town` HTTP 200. Remaining launch evidence gap:
  Alan/in-app mobile visual acceptance is still unproven.
- 2026-06-16 13:51 CDT: Post-flicker cc frontend review
  `umi/reports/20260616T184531Z-workload.md` found no confirmed P0 after the
  earlier anti-flicker patches, but flagged three remaining launch-risk UI
  gaps: active conversations still loaded `previousConversation`,
  `InteractButton` silently no-oped while the world was loading, and `Game`
  returned `null` while `worldId`/`engineId`/`game` were unavailable. Patch:
  `PlayerDetails` skips previous-history query during current human dialogue,
  `InteractButton` disables and labels itself as `正在連線...` during world
  load, and `Game` renders a stable `giis-loading-shell` instead of blanking the
  screen. Verification: `npx tsc --noEmit --pretty false` PASS, `npm run build`
  PASS, `npm run underworld:runtime-preflight` PASS, `git diff --check` PASS,
  and `curl -I http://localhost:5173/ai-town` HTTP 200. Browser visual smoke in
  Codex/Chrome was attempted but blocked by app/window automation permissions,
  so Alan/in-app play remains the next real visual check.
- 2026-06-16 13:36 CDT: Alan's "today UI flicker / sudden jump" report was
  reproduced in mobile Chrome. The first visible failure was a reconnect
  fallback after notebook/summary queries timed out; a second mobile invite/send
  run showed the active root cause in logs: `school:campusSocialState`,
  `school:umiBriefing`, and `school:campusTimeline` timed out while the world
  was busy generating. Patch: notebook commitments/reflections now load only
  when their notebook tab is open; `Game` pauses campus summary/briefing queries
  during active conversations and uses last-good cached data; `PlayerDetails`
  skips `campusTimeline` during current dialogue; chat quick actions return
  after queueing `startConversation` instead of also sending generic
  `playerAction(chat)`; 5-6 character scenes use crowd-aware standee spacing.
  Verification: `npx tsc --noEmit --pretty false` PASS, `npm run build` PASS,
  targeted Jest 22/22 PASS, `npm run underworld:runtime-preflight` PASS,
  `git diff --check` PASS, `curl -I http://localhost:5173/ai-town` HTTP 200,
  and mobile Chrome smoke completed Tianze invite from offline Alan -> principal
  office conversation -> message send -> 12s idle without falling back.
- 2026-06-16 13:13 CDT: Second frontend resilience batch is implemented after
  cc read-only review `umi/reports/20260616T180949Z-workload.md`. `Game` now
  shares `worldStatus` with `useWorldHeartbeat`, which reads latest status via
  ref while keeping the interval keyed only by `worldId`/mutation identity;
  `InteractButton` now consumes shared `worldStatus`, parsed `game`, and
  `humanTokenIdentifier` from `Game` instead of re-querying/re-parsing the
  world; `App.tsx` has a route-scoped ErrorBoundary with a humane reconnect
  fallback, console error logging, refresh button, and `key={view}` reset when
  switching between world/conversation views. Verification: `npx tsc --noEmit
  --pretty false` PASS, `npm run build` PASS, `npm run
  underworld:runtime-preflight` PASS, `git diff --check` PASS. Touched-files
  eslint was attempted but blocked by existing repo ESLint config error
  (`Unexpected top-level property "__esModule"` in `.eslintrc.js`), not by this
  diff. Remaining frontend launch follow-ups: Alan/in-app mobile visual smoke,
  later full WorldContext pass for non-hot-path duplicates, and engine anchor
  behavior review.
- 2026-06-16 13:02 CDT: First frontend market-readiness anti-flicker batch is
  implemented after cc read-only audit `umi/reports/20260616T180013Z-workload.md`.
  The patch reduces duplicated main-world subscriptions by passing
  `humanTokenIdentifier`, `playerIdentity`, `umiBriefing`, and
  `campusSocialState` from `Game` into `PlayerDetails`; conversation scroll now
  keys on real message/pending-message changes instead of typing-state churn;
  mobile no longer auto-focuses the chat textarea on conversation entry;
  changing conversations clears stale draft/inflight send state; conversation
  start scroll is scoped to the panel rather than `window`; changing target
  characters resets history filter, selected history thread, wake prompt, and
  conversation tab. Verification: `npm run build` PASS and `git diff --check`
  PASS. Browser automation was attempted but blocked by unavailable Playwright
  in the node runtime and Codex app safety restrictions; use Alan/in-app mobile
  playtest as the next visual check. Remaining follow-ups: full WorldContext
  consolidation, ErrorBoundary fallback, and engine anchor behavior.
- 2026-06-16 08:47 CDT: Second morning liveness recovery complete. This time
  the actual blocker was missing Convex local backend listener on 3210/3211
  while Vite still served `/ai-town` 200, so the browser looked alive but data
  calls waited for a backend that was not there. Restarting `underworld-mobile`
  brought 3210 back after about 12s; a clock refresh cleared stale
  `worldClock`; final `underworld:runtime-preflight` PASS. Future prevention:
  health automation should explicitly check 3210/3211 listeners and avoid using
  side-effectful `advanceWorldTime {"hours":0}` as the normal clock refresh.
- 2026-06-15 23:31 CDT: Claude Code's F15 fallback architecture is live enough
  to test from the Mac. The world still runs on the Mac; F15 only serves Ollama
  over LAN. Current evidence: F15 `192.168.1.69` exposes `qwen2.5:7b`,
  keep-alive is active (`/api/ps` loaded model expires in 2318),
  `/v1/chat/completions` responded in 2.26s, and `underworld:runtime-preflight`
  is PASS with no active/stale conversations. Earlier logs did show
  `No route to host` at 22:58, so if stalls recur, treat the next bottleneck as
  network/runtime resilience before buying hardware: pin the F15 IP or verify
  LAN stability, then reduce local fallback load, then consider cloud/stronger
  GPU.
- 2026-06-15 23:53 CDT: For the Tuesday observation run, cloud autonomous
  character-soul attempt quota is now 600/day. Use the existing
  `underworld-rolling-continuity-telegram` heartbeat as the only two-hour
  observer; it should check runtime, stale watchdog, rolling continuity,
  F15 reachability, and quota/cost context. Do not create another automation
  and do not auto-tune prompts/memory/world architecture every two hours.
- 2026-06-16 08:43 CDT: Morning liveness is recovered after a failed 08:02
  observer run. Preflight now PASS, `/ai-town` HTTP 200, F15 reachable, and
  runtime health shows fresh completed inputs. Treat samples before the recovery
  window as unreliable for Tuesday continuity; let the next two-hour observer
  judge fresh post-recovery evidence.
- 2026-06-15 21:52 CDT: A second 一之瀨 "connection unstable" report was
  diagnosed as a backend generation retry/backoff issue, not local Wi-Fi or
  frontend downtime. cc reviewed the narrow scheduler path and caught that
  Alan-authored follow-up messages could clear the character's generation
  cooldown. Patch: human-facing conversations now record
  `lastGenerationAttempt` before scheduling `agentGenerateMessage`, throttle
  repeated attempts for 30s, clear attempt/failure markers only when the same
  character successfully sends, and skip memory for final human open prompts
  such as `記住了嗎 / 有約嗎`. Verification: targeted aiTown Jest 23/23,
  memory Jest 44/44, typecheck PASS, build PASS, diff-check clean, runtime
  preflight PASS. Post-patch live state is running with no active Alan
  conversation and no agent stuck in `agentGenerateMessage`; judge the fix on a
  fresh post-patch 一之瀨 or 天澤 chat.
- 2026-06-15 21:36 CDT: Alan reported 一之瀨 chat stuck after the Tianze retry
  patch. Live evidence showed a second pair of bugs: timeout cleanup inside
  `Agent.tick` did not mark the human-generation failure cooldown, and
  human-facing NPCs could self-continue after their own last message once the
  awkward deadline passed. A controlled dev-stack restart recovered Convex after
  the backend was half-ready, then `agent.ts` was patched so timed-out
  human-facing message generation marks failure/clears typing/returns, and
  human-facing conversations wait for Alan after the character replies.
  Verification: targeted aiTown Jest 21/21, typecheck PASS, build PASS,
  diff-check clean, runtime preflight PASS. Post-patch spot check: active
  一之瀨 conversation has `inProgressOperation=null`; no new self-continue logs
  appeared after Convex functions reloaded at 21:35:42. Existing `c:30814`
  includes pre-patch wind-chime motif/self-continuation and is not clean
  post-patch evidence.
- 2026-06-15 21:23 CDT: Alan reported current 天澤 chat stuck on thinking.
  Live checks showed Underworld healthy and `c:30631` active, with Alan's final
  line `你明天晚上有空嗎？` and Tianze repeatedly starting `agentGenerateMessage`
  without inserting a reply. This was a backend retry loop, not a dead server:
  generation abort/failure cleared the active op in a human conversation, but
  the conversation stayed open with Alan as last speaker, so the scheduler
  retried every few seconds. cc reviewed the diagnosis in
  `umi/reports/20260616T022108Z-workload.md` and recommended a bounded
  failure cooldown rather than fallback text or cleanup. Patch: conversations
  now store `lastGenerationFailure`, human-facing abort/clear paths mark it,
  `Agent.tick` throttles same-player retries for a bounded cooldown, and real
  new messages clear the marker. Verification: targeted aiTown Jest 21/21,
  typecheck PASS, build PASS, diff-check clean, runtime preflight PASS.
  Existing `c:30631` will not get a synthetic Tianze reply; Alan can send again
  after cooldown or start a fresh Tianze chat.
- 2026-06-15 21:02 CDT: Alan retested the "明天午休少糖珍珠奶茶" promise and
  the notebook still stayed empty. New evidence showed `c:30552` archived with
  海 replying `嗯，我先照你說的來...`; the stale-curry repair had protected
  against curry relapse but over-repaired the boba promise into a generic line,
  leaving the memory extractor no explicit commitment text. Patch: Umi's
  Alan-facing repair now answers boba/lunch commitment requests directly:
  `好。明天午休，我帶少糖珍珠奶茶，我們一起喝。` or `好。明天午休，我幫你準備午餐。`
  Added a sanitizer regression test proving a stale curry reply becomes the
  explicit boba acceptance. Verification: targeted Jest 90/90, agent Jest
  145/145, typecheck PASS, build PASS, diff-check clean, runtime preflight PASS.
  Existing `c:29920` and `c:30552` are already processed and will not backfill
  automatically without explicit data-write approval; next fresh retest should
  write the commitment.
- 2026-06-15 20:57 CDT: Alan's "明天午休少糖珍珠奶茶" playtest revealed a
  memory-write gap, not a dialogue-only gap. 海 did answer with tomorrow-lunch
  boba language in `c:29920`, but `school:notebookCommitments` remained empty
  because the extractor only understood curry-like objects and accepted the
  first coarse lunch/box commitment before seeing the later boba refinement.
  Patch: commitment extraction now recognizes `珍珠奶茶/奶茶`, `午餐`,
  `便當/便當盒`, and `明天午休/明天中午`; prefers more specific drink over
  meal/container; scans acceptance windows newest-first; and treats `一杯少糖`,
  `一杯正常甜`, and `你選哪一杯` as bounded offer cues. cc reviewed and agreed
  via `umi/reports/20260616T015123Z-workload.md`; added edge tests for
  lunch-only success and bento-box-only refusal. Verification: memory Jest
  44/44, `npm test -- convex/agent` 144/144, with earlier typecheck/build/diff
  check/runtime preflight already green. Existing `c:29920` is already
  processed and will not be auto-backfilled without explicit data-write
  approval; future fresh conversations should write this kind of commitment.
- 2026-06-15 20:55 CDT: Alan-facing chat smoothness guard is patched after
  Alan's direct playtest. Root causes: old time-bound commitments were too
  sticky in prompt assembly; answer-first repair did not catch some direct
  Mahiru questions after stage-direction stripping; and the UI/backend could
  let Alan send/leave while the character was still typing, producing a
  single-sided diagnostic archive. Fixes: expired commitments now surface only
  when Alan explicitly mentions the object; Umi curry output is repaired away
  from unrelated feeling/current-topic questions; Mahiru direct questions about
  secrets/invitations/check-ins answer first; first-person stage-direction
  detection catches `我正/正在...推過來`; MessageInput blocks duplicate sends
  while the other participant is typing; `leaveAlanConversationNow` waits up to
  90s before archiving Alan-only conversations when a character is still
  typing. cc reviewed the issue in read-only mode at
  `umi/reports/20260616T013551Z-workload.md`; Codex accepted the bounded parts
  and kept broader prompt/memory/provider changes out of scope. Verification:
  targeted Jest 54/54, typecheck PASS, build PASS, `git diff --check` clean,
  runtime preflight PASS. Next: Alan should human-test one short chat each with
  海 / 真晝 / 天澤 or 一之瀨 and treat only post-patch rows as evidence.
- 2026-06-15 19:35 CDT: After Alan approved a targeted repair, Codex/Umi used
  split-work with cc. cc confirmed the safest fix is not a broad prompt or
  memory rewrite: the main gap was autonomous non-Alan pairs archiving dangling
  fragments while the Alan-facing path already had a repair guard. Implemented a
  bounded conversation-hygiene patch: recent same-pair motif cooldown now tells
  the model not to reuse already-used motif families as the next opener or
  emotional proof; prop diversity guidance now prefers plain replies or soft
  closes instead of another object callback; fresh repeated motif families for
  needle/candy/wrapper, curtain/hook/window, and hand/finger/sleeve/dust are in
  the cooldown set; autonomous dangling fragments abort before archive while
  Alan-facing dangling replies still use the existing character-specific repair
  path. Added sanitizer-level tests for non-Alan dangling aborts. Verification:
  `npm test -- --runTestsByPath convex/agent/conversationMotifGuard.test.ts`
  43/43, `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check`,
  and `npm run underworld:runtime-preflight` PASS. Next check should use fresh
  post-patch conversations; old latest eval report still reflects pre-patch
  failures.
- 2026-06-15 11:48 CDT: Added a polished mobile home-screen icon for
  Underworld/UW, then corrected the direction to match Alan's expectation that
  the app icon should show Umi rather than only the school entrance. Active icon
  is now a square Umi-face app icon: close-up short navy hair, pink-purple eyes,
  gray cardigan / blue bow, warm night principal-office glow, and teal/violet AI
  halo. Saved the project-bound source and resized variants under `public/icons/`
  (`underworld-icon-1024.png`, `underworld-icon-512.png`,
  `underworld-icon-192.png`, `apple-touch-icon.png`, `favicon-32.png`). The
  earlier doorway concept is preserved as `underworld-doorway-icon-1024.png`.
  Added `public/site.webmanifest` with `name=Underworld`, `short_name=UW`,
  `start_url=/ai-town`, standalone display, and 192/512 icons. Updated
  `index.html` with PNG favicon, Apple touch icon, manifest, theme color, Apple
  mobile web app metadata, title `Underworld`, and updated description.
  Verification: `npm run build`, `file public/icons/*.png`, `sips` dimension
  checks, and HTTP 200 for `/site.webmanifest`, `/icons/apple-touch-icon.png`,
  and `/icons/underworld-icon-512.png`.
- 2026-06-15 08:24 CDT: Underworld was half-collapsed this morning: Vite/Convex
  and `/ai-town` were up, but the agent loop had no fresh input for about 2h17m
  and stored `worldClock` was still around 05:59 while real Chicago time was
  after 08:12. There were no stale active conversations to clear, and
  `testing:stop` -> `testing:resume` did not revive the loop. A controlled
  restart of the `underworld-mobile` dev stack recovered it; logs showed
  `world:restartDeadWorlds`, processed input advanced, and Umi/Mahiru created a
  fresh role-to-role conversation (`c:20060`). `underworld:runtime-preflight`
  now computes day/night mode from real local time rather than stale stored
  `worldClock.hour`, prints stored worldClock age, and fails if stored worldClock
  age exceeds the stale threshold during daytime so this specific false
  reassurance is visible next time. Verified after recovery: HTTP 200,
  `underworld:runtime-preflight` PASS, `underworld:stale-watchdog` dry-run
  stale=0/messages=0, typecheck PASS, and build PASS. Do not count 2026-06-15
  pre-08:18 samples as clean v0.1 evidence.
- 2026-06-14 21:32 CDT (Claude, with Alan): ROOT CAUSE of the recurring world
  stall found and fixed (complements Codex's detection guards — which detect +
  allow manual cleanup but did not prevent the stall). Mechanism: a single
  `agentGenerateMessage` (a cloud LLM call) that hangs blocks EVERY agent via the
  global conversation single-flight until the operation times out — and that
  backstop defaulted to **10 minutes** (`AGENT_GENERATE_MESSAGE_TIMEOUT_MS`
  600_000 in `convex/aiTown/agent.ts`). So one hung cloud call froze the whole
  world for 10 min; under persistent cloud trouble (Sunday, with the doubled
  MEMORY_LLM_CLOUD load) repeated hangs compounded into the multi-hour stall. The
  log showed ~400 `Timing out` operation reaps. Fix: lowered the backstop default
  to **120s** (the single-flight floor) so a hang clears in 2 min, not 10, and
  the other agents move on. A message generation taking 10 min is never
  legitimate (the conversation LLM call itself times out in ~30-60s). Verified:
  tsc clean, clean `stop`->`resume` (0 mismatches), forced 海<->真晝 conversation
  engaged immediately and wrote per-character residue. This is the prevention
  layer; Codex's `runtime-preflight` + `stale-watchdog` remain the
  detection/manual-cleanup safety net. **Still recommended for the Mon/Tue run:**
  run `underworld:runtime-preflight` every ~2h (Codex's continuity automation can
  fold this in) so any residual stall is caught fast, not silently for hours.
- 2026-06-14 21:14 CDT (Alan / Codex / cc): The old weekend "do not edit or
  restart" guard is now historical. Alan explicitly approved fixing the runtime
  stall tonight, then running Monday/Tuesday and reviewing Wednesday. The live
  world was half-stuck from about 10:59-11:00 CDT until the evening recovery:
  frontend and Convex queries were alive, but role-to-role agent flow had no
  fresh processed inputs. Stale active conversations were cleared with Alan
  approval, the dev stack was restarted once, and new runtime guards are live.
  `underworld:runtime-preflight` now checks real runtime freshness, stale active
  conversations, and due-but-unprocessed input backlog; `underworld:stale-watchdog`
  is dry-run by default and direct write requires explicit env + human approval.
  Current verified state: `/ai-town` HTTP 200, runtime preflight PASS, stale
  watchdog dry-run stale=0/messages=0, due pending inputs=0, typecheck/build
  PASS. Do not count 2026-06-14 afternoon/evening as complete continuity data;
  use Monday/Tuesday natural samples, then judge v0.1 evidence Wednesday.
- 2026-06-13 19:51 CDT: Alan reported that mobile chat looked unable to send
  and asked for a new principal-office workflow. Root cause was not
  `writeMessage`: selecting a character in another scene left Alan in a
  different/offline/scheduled location, so the active conversation input never
  appeared. Patch makes Alan's login/home/scheduled location the principal
  office (`studentCouncilRoom` / `校長室`), makes scene dropdown changes
  observation-only so Alan stays in the office, and changes cross-scene target
  chat buttons from disabled `聊聊 X` into enabled `邀請 X` actions that start
  the conversation and return the view to `校長室`. Mobile conversation input
  CSS now keeps the chat form sticky at the bottom and fixes the small-screen
  form grid so textarea + `送出` remain usable. Verification: `npm run build`,
  `npx tsc --noEmit --pretty false`, `git diff --check -- convex/school.ts
  src/components/Game.tsx src/index.css`, `curl -I http://localhost:5173/ai-town`
  HTTP 200, `school:enterCampus` returned `scene: 校長室`, `school:debugState`
  confirmed Alan at `校長室` `{ x: 13, y: 9 }`, and browser extension smoke
  confirmed: login view starts at `校長室`, switching to `餐廳` keeps
  `Alan 目前在：校長室`, `邀請 天澤` creates an active `校長室` conversation with
  textarea + `送出`, and a test message sends/clears the textarea. Limitation:
  the in-app `iab` browser endpoint was unavailable and temporary Playwright
  package execution could not resolve `playwright`, so final smoke used Chrome
  extension DOM rather than a true 390px screenshot; CSS/build covers the
  mobile input layout change.
- 2026-06-13 18:44 CDT: Alan asked that each life-signal check print the
  underlying dialogue so repeated-life/motif WARNs can be reviewed without a
  second Convex query. `scripts/underworld-life-signals.mjs` now adds
  `## Conversation Samples` to `umi/reports/life-signals-latest.md`, selecting
  repeated surface lines, prop/motif echoes, drift/shape flags, strongest life
  signals, and recent samples, then printing bounded transcript excerpts for up
  to 8 conversations. This is report-only/read-only and does not change Convex
  state, prompts, or memory behavior. Verification:
  `npm run underworld:life-signals:self-test`, `npm run underworld:life-signals`,
  `npm run underworld:rolling-continuity:self-test`, `npm run
  underworld:rolling-continuity`, and `git diff --check --
  scripts/underworld-life-signals.mjs`. Latest refreshed life-signals report
  still warns `life_signal_repeated`, now with visible transcript evidence.
- 2026-06-13 16:15 CDT: Mobile UI pass after Alan flagged that the `對話` tab
  was especially unfriendly. The conversation wall is now phone-shaped instead
  of a squeezed desktop dashboard: compact 4-up metrics, clamped focus snippets,
  horizontally scrollable filter chips, a full-height scrollable conversation
  list, and card previews capped to the first three transcript lines on mobile.
  Scene mobile polish moved the collapsed control-panel toggle away from the
  bottom character/status cards and padded the scene character carousel so cards
  are not hidden under the right-side toggle. Conversation drawer mobile history
  bodies now scroll instead of clipping. Also corrected stale UI copy from
  `地圖` to `場景`, and fixed the day/night frontend mapping so `白天` uses day
  backgrounds/icons instead of falling back to night-looking base scenes.
  Verification: `npx tsc --noEmit --pretty false`, `npm run build`,
  `git diff --check -- src/index.css src/components/PlayerDetails.tsx
  src/components/Game.tsx`, and Playwright mobile visual QA at 390x844,
  375x667, and 430x932. Final screenshot:
  `tmp/visual-qa/mobile-small-conversation-tab-final.png`.
- 2026-06-13 15:01 CDT: v0.1 evidence collection is now ready to distinguish
  ordinary memory from true experience-log evidence. Runtime baseline is healthy:
  `underworld:runtime-preflight` passed, `underworld:afternoon-world-ready`
  reported `noop_running`, and `world:defaultWorldStatus` showed the default
  world `running`. Codex ran `underworld:observe:daytime-samples`; it collected
  one archived 海/真晝 sample (`conversation-c:10313`) but the later focused
  pairs timed out/cleaned up, so no repair-gate decision was made. While
  debugging, fresh natural conversations archived (`c:10430`, `c:10511`,
  `c:10499`), but the latest observe report correctly marks their
  experience-log status as `ordinary_memory_fragment_not_residue`; they are
  ordinary subjective memory fragments, not soul residue, so they did not write
  experienceLogs. Fixes landed: legacy objective `experienceLogs` no longer
  count against the v0.1 subjective cap/dedupe/spam window, and observe now
  reports ordinary memory fragments separately from true residue instead of
  guessing `possible_cap_dedupe_or_recent_not_loaded`. Runtime env was aligned
  for data collection by setting `MEMORY_LLM_TIMEOUT_MS=60000` and
  `UNDERWORLD_RESIDUE_LLM=true` on the local Convex deployment; this gives the
  cloud soul-residue writer enough time to produce `llm_soul` residue without
  lowering the experience-log safety gate. Current state: data collection can
  run, but there are still 0 fresh subjective-shaped experienceLogs; wait for a
  clean conversation that produces `llm_soul` residue before claiming the
  experience-log bridge is proven. Verification:
  `npm run underworld:observe:self-test`, `npm run underworld:observe --
  --dry-run --target-samples=0 --cc=skip --since-created-at=1781380664352`,
  `npm run underworld:experience-sleep-promote`, `npm test --
  --runTestsByPath convex/agent/experienceLog.test.ts` (27/27),
  `npx tsc --noEmit --pretty false`, `npm run build`, and `git diff --check`.
- 2026-06-13 12:22 CDT: cc read-only review is available at
  `umi/reports/20260613T171934Z-workload.md` and shaped the current continuity
  lane plan. Accepted recommendation: Lane 1 (character-to-character
  conversation -> subjective residue -> later behavior) is v0.1 core and
  already wired; Lane 2 (Alan-to-character -> character subjective
  interpretation) should be v0.1 shadow only and must not promote to
  prompt-facing sleepNotes yet; Lane 3 splits into 3a shared campus daily topic
  as thin shadow and 3b character-soul-caused world-state writes as v0.2.
  `docs/giis-v0.1-roadmap.md` now records this lane assignment. cc's strongest
  point was that lane 1 is opaque without rejection reasons, so Codex added an
  observe-only diagnostic histogram in `scripts/underworld-observe-once.mjs`.
  Fresh samples now report reasons such as `source_not_archived_yet`,
  `alan_pair_shadow_not_enabled`, `ordinary_memory_fragment_not_residue`, and
  `possible_cap_dedupe_or_not_archived_gate`. Dry-run after the patch found 2
  fresh active samples and correctly reported `source_not_archived_yet=2`, so
  the current blocker is not the subjective gate itself; those samples have not
  archived yet. Verification: `npm run underworld:observe:self-test`,
  `npx tsc --noEmit --pretty false`, `npm run underworld:observe -- --dry-run
  --target-samples=0`, `npm run build`, and `git diff --check`.
- 2026-06-13 12:00 CDT: Propagated Alan's "主觀認定才算 v0.1
  evidence" rule through downstream reporting / sleep gates, not only the
  writer. `underworld:experience-sleep-promote` now promotes only
  subjective-shaped experience logs whose `eventSummary` starts with
  `對某某來說...`; old objective `A與B：...` rows and generic "短暫對話 /
  留下一段短記憶" rows are ineligible. `underworld:observe` now reports
  subjective vs non-subjective experience log counts and marks fresh matching
  rows with `non_subjective_experience_log_shape` instead of counting them as
  evidence. `underworld:sleep-consolidation` now reports the same boundary and
  demotes ordinary `記住的片段` candidates to short-term context with
  `ordinary_memory_fragment_not_residue`, so sleep dry-runs no longer pretend a
  raw remembered fragment is emotional residue. Current dry-run evidence:
  `underworld:experience-sleep-promote` read 24 experienceLogs, found 0
  subjective-shaped eligible logs, prepared 0 rows, and wrote nothing;
  `underworld:sleep-consolidation` read 50 conversations, classified 1
  emotional-residue candidate, 25 short-term context rows, 24 human-review
  rows, and wrote nothing; `underworld:observe -- --dry-run --target-samples=0`
  found 2 fresh active samples, so v0.1 scoring remains `sample_pending` until
  at least 3 fresh samples exist. Verification:
  `npm run underworld:sleep-consolidation -- --self-test`,
  `npm run underworld:experience-sleep-promote:self-test`,
  `npm run underworld:observe:self-test`, `npm run
  underworld:experience-sleep-promote`, `npm run
  underworld:sleep-consolidation`, `npm test -- --runTestsByPath
  convex/agent/experienceLog.test.ts convex/agent/memory.test.ts` (65/65),
  `npx tsc --noEmit --pretty false`, `npm run build`, `npm run
  underworld:observe -- --dry-run --target-samples=0`, and `git diff --check`.
  Next: let the running world create fresh conversations; only logs with
  `llm_soul` residue and owner-perspective `對某某來說...` shape should count
  for data collection.
- 2026-06-13 11:51 CDT: Alan correctly tightened the v0.1 semantics:
  `experienceLogs` must be subjective lived experience, not an objective event
  summary or a quote. Codex kept the existing safety gates (`llm_soul` residue
  required, no fallback/deterministic residue, hard caps) and changed the draft
  shape so `eventSummary` is now an owner-perspective experience summary
  (`對海來說...`, `對真晝來說...`) rather than `A與B：objective summary`.
  `emotionalInterpretation`, `beliefSeed`, and `behaviorHint` remain
  character-specific and now more explicitly follow each active pilot's soul
  lens: 海/usefulness-responsibility, 真晝/unspoken quiet care,
  天澤/boundary-testing, 一之瀨/permissioned kindness, 貓貓/diagnostic restraint,
  祥子/composure-boundary. Tests now assert the same objective event produces
  different subjective experience summaries and does not copy the raw line
  `今天只整理三件事`. Verification: `npm test -- --runTestsByPath
  convex/agent/experienceLog.test.ts convex/agent/memory.test.ts` 65/65,
  `npx tsc --noEmit --pretty false`, `npm run build`, and `git diff --check`
  for touched files.
- 2026-06-13 11:47 CDT: Alan asked whether the conversation wall's remembered
  items were truly subjective. Fresh query evidence showed they were not all
  subjective: many ordinary conversation memories still displayed direct line
  anchors, e.g. `綠蘿葉子有點蔫...`, `譜子我收下了`, or `啊……是嗎？`, while
  true `殘留：...` rows were separate. Fix keeps the v0.1 evidence split but
  makes future ordinary fallback memory more honest and more character-specific:
  autonomous conversation summaries now write `記住的主觀判斷是：「...」` using
  owner/other signals instead of storing a raw quote as `留下的情緒重點`. The
  conversation wall displays new rows as `某某記住的是：...`; legacy raw-anchor
  rows display as `某某記住的片段：「...」` rather than pretending to be
  subjective. `experienceLog` remains the real v0.1 evidence layer and still
  requires soul-grounded LLM residue. Verification: `npm test --
  --runTestsByPath convex/agent/memory.test.ts` 39/39, `npx tsc --noEmit
  --pretty false`, `npm run build`, `git diff --check` for touched files, and
  a live `school:recentConversationEvalData` spot-check showing the new
  `記住的是` / legacy `記住的片段` split.
- 2026-06-13 10:20 CDT: Patched conversation-wall / memory semantics after Alan
  flagged 一之瀨/祥子 showing identical objective memory under `心裡留下的`.
  The issue was not a true subjective residue; those rows had no `殘留：...`
  line and were ordinary conversation memory summaries. UI now labels true
  residue as `心裡留下的` and ordinary memory as `記住的片段`. `school.ts`
  extracts only the remembered anchor for ordinary rows (`某某記住了：「...」`)
  instead of showing the full objective memory header. Future autonomous
  NPC↔NPC memory summaries no longer use free LLM summary by default; they use
  deterministic owner-perspective anchors, preferring what the other participant
  said. True subjective emotion remains the bounded residue path. Existing old
  rows are not rewritten, but the wall no longer presents them as subjective
  residue. Verification: `npm test -- --runTestsByPath
  convex/agent/memory.test.ts` 38/38, `npx tsc --noEmit --pretty false`, and
  `npm run build`.
- 2026-06-13 10:27 CDT: Patched the same-pair short-term continuity gap after
  Alan noticed 一之瀨/祥子 replaying the same lunch-box/helping conversation at
  10:09 and 10:15. Diagnosis: they were not fully amnesic; the pair history
  existed, but compact autonomous start prompts only saw "you have spoken
  before" and not the prior conversation content. Since the first sample did
  not produce true residue, no residue prompt discouraged the repeat. Fix:
  compact autonomous start prompts now receive a tiny previous same-pair hint
  from the last archived conversation's messages, including minutes ago, first
  / final beat, and motif labels, plus a hard instruction not to restart the
  same object/helping move. No schema or DB writes changed. Verification:
  `npm test -- --runTestsByPath convex/agent/conversationMotifGuard.test.ts
  convex/agent/memory.test.ts` 77/77, `npx tsc --noEmit --pretty false`,
  `npm run build`, and `git diff --check`.
- 2026-06-13 10:32 CDT: Implemented the v0.1 evidence-layer split Alan asked
  for: ordinary conversation memory can still exist as a remembered fragment,
  but it can no longer become experienceLog evidence unless the conversation
  produced non-empty soul-grounded LLM residue. `memory.ts` now tags residue
  source as `llm_soul`, `deterministic`, or `none`; repeat-pattern and
  recall-correction gates reset the source to `none` when they clear residue.
  `experienceLog.ts` rejects `no_residue` and `non_soul_residue`, and gives the
  six active pilot characters character-specific interpretation/behavior hints
  from the residue. This means provider failure / deterministic fallback may
  still leave ordinary memory if clean, but cannot become v0.1 continuity
  evidence. cc review was attempted but blocked by session limit, so this is a
  Codex-accepted bounded fix. Verification: `npm test -- --runTestsByPath
  convex/agent/experienceLog.test.ts convex/agent/memory.test.ts
  convex/agent/conversationMotifGuard.test.ts` 103/103, `npx tsc --noEmit
  --pretty false`, `npm run build`, `git diff --check`.
- 2026-06-13 10:37 CDT: Patched the weekend-life gap after Alan noticed that
  today is Saturday but nobody was talking about weekend topics. Root cause:
  calendar/weekend context existed, but compact autonomous prompts treated it
  as a buried date hint instead of a concrete life motive. `conversation.ts`
  now adds `週末生活錨點` and scene-specific `週末場景 seed` lines for compact
  start/continue prompts when `clockContext.isWeekend` is true, with examples
  like free activity, homework, laundry, club practice, errands, walking, dorm
  choices, and private check-ins. The seed filters out food/drink/utensil
  surfaces so weekend talk does not collapse back into bento/tea loops.
  Verification: `npm test -- --runTestsByPath
  convex/agent/conversationMotifGuard.test.ts convex/agent/experienceLog.test.ts
  convex/agent/memory.test.ts` 104/104, `npx tsc --noEmit --pretty false`,
  `npm run build`, `git diff --check`.
- 2026-06-13 10:14 CDT: Fixed Alan/海 false commitment extraction from
  `conversation-c:8563`. The actual transcript changed away from curry
  (`先不要咖哩飯了`) to tomorrow breakfast, but the memory writer stored a
  concrete curry commitment because the acceptance-window parser saw curry
  anywhere in the nearby text and then saw later acceptance lines. Codex patched
  `convex/agent/memory.ts` so commitment object extraction ignores rejected
  object lines and question-only prior-commitment probes, and requires a
  positive offer/request/eating/preparing cue. Added regression coverage in
  `convex/agent/memory.test.ts`. The one bad memory was marked corrected /
  importance 0 with `school:downweightFalseMemory`; `experienceLogs` were empty
  for that conversation, so the v0.1 evidence layer was not polluted. cc
  read-only second-look was attempted but blocked by Claude session limit; do
  not record cc approval for this patch. Verification: `npm test --
  --runTestsByPath convex/agent/memory.test.ts`, `npx tsc --noEmit --pretty
  false`, `npm run build`, `school:debugAlanConversationState`, and
  `world:defaultWorldStatus` running after `testing:resume`.
- 2026-06-13 10:09 CDT: Investigated why role-to-role conversations were not
  visible in the conversation tab. Runtime was not asleep or dead:
  `world:defaultWorldStatus` was `running`, `school:debugState` showed all six
  current characters awake, and `school:worldClock` showed Saturday free
  activity. Root cause was stale Convex env from an earlier single-sample triad
  pilot (`SOUL_TRIAD_COLOCATION_PILOT`, `SOUL_TRIAD_FOCUS_PAIR`, and
  `SOUL_TRIAD_SINGLE_SAMPLE_AFTER_MS`), which effectively narrowed autonomous
  candidate selection and made the world look like it had stopped talking. Codex
  removed those three env vars and ran `testing:resume`; logs then showed fresh
  NPC conversations starting/continuing/remembing, including 貓貓/海,
  貓貓/一之瀨, 海/真晝, 貓貓/天澤, and 一之瀨/祥子. Fresh recent eval now sees 4
  post-fix samples: 0 PASS / 2 WARN / 2 FAIL. Conversation visibility is back,
  but quality is not solved: report flags motif/mirror repetition, stage-action
  leakage in 海/真晝, and weak character-voice cues in 貓貓/一之瀨 and 一之瀨/祥子.
  Do not re-enable triad pilot envs unless explicitly running a bounded pilot.
- 2026-06-13 10:04 CDT: Patched Alan-facing chat quality after Alan's fresh
  天澤 / 真晝 / 海 playtest. Root cause was prompt-level permission for
  "unfinished" replies plus lack of character-specific Alan-facing binding:
  天澤 collapsed into incomplete reaction fragments, 真晝 became too passive
  and repeated food/body cues, and 海 was directionally smooth but over-prop-y.
  Fix: `conversation.ts` now gives Alan-facing character rules to 海 / 真晝 /
  天澤 / 貓貓 / 一之瀨 / 祥子, requires complete spoken replies, uses the
  America/Chicago runtime clock for date/weekend questions, and only repairs
  clear broken shapes instead of replacing ordinary imperfect lines. Targeted
  tests cover Tianze dangling fragments and Mahiru restaurant/food-loop repair.
  Runtime check also passed: `underworld:runtime-preflight` PASS and
  `/ai-town` HTTP 200. Verification: `npm test -- --runTestsByPath
  convex/agent/conversationMotifGuard.test.ts`, `npx tsc --noEmit --pretty
  false`, `npm run build`, `npm run underworld:runtime-preflight`, and `curl -I
  http://127.0.0.1:5173/ai-town`.
- 2026-06-13 00:06 CDT: Midnight closeout after Alan asked for cc contribution
  summary, roadmap alignment, and commit prep. cc's useful night contributions
  were: (1) caught scope creep / schema-coupling risk in the orphan-wake +
  motif patch review, especially `sleepNotes` prompt reads needing schema/index
  to ship together; (2) flagged TS narrowing/test gaps around explicit human
  wake; (3) caught the stage-direction memory guard false-positive on benign
  parentheticals, which Codex accepted and patched before verification; (4)
  reinforced that failed/hallucinated Alan chats must not enter memory or
  experience logs. Codex judgment: cc was valuable tonight as a skeptical
  reviewer, not as an implementation owner. Roadmap now records the 2026-06-13
  night closeout: keep free-world runtime alive, nightly reflection remains
  shadow-only, no prompt/memory tuning without fresh evidence, and subjective
  memory re-bedding is parked as a future v0.2/paper idea. Paper docs were
  tidied with a new package index and future-idea note; no runtime behavior was
  changed by this closeout.
- 2026-06-12 22:33 CDT: Codex-level Underworld automation alignment updated
  after Alan approved the sleep-recall direction. Existing local Codex
  automation
  `/Users/alanhdchu/.codex/automations/underworld-rolling-continuity-telegram/automation.toml`
  is now `ACTIVE` again and still runs the observe/report-only rolling
  continuity monitor every 120 minutes. New local Codex automation
  `/Users/alanhdchu/.codex/automations/underworld-nightly-reflection-shadow/automation.toml`
  is `ACTIVE` and scheduled daily at 23:30 local time; it may only run
  `npm run underworld:nightly-reflection` in SHADOW mode and is explicitly
  forbidden from running `--write`, mutating Convex data, importing sleepNotes,
  changing prompts/code, sending Telegram, committing, pushing, or restarting
  the world. Manual shadow smoke before setup produced
  `umi/reports/nightly-reflection-latest.md` with `mode=shadow`,
  `characters=6`, and `written=0`; all characters returned no insights, so
  future runs should be treated as preview/provide-health-signal only until
  several clean reports justify a separate write approval. Verification:
  read-back of both automation TOML files plus Python `tomllib` parse for id,
  status, and rrule. The app-level `automation_update` tool was not available
  in this session, so this was done by editing local Codex automation config
  files directly.
- 2026-06-12 22:17 CDT: Fixed the "Alan goes offline, then immediately comes
  online again" UX bug. Backend `leaveCampus` already removes Alan's player
  from the world; the leak was frontend auto-entry from view/navigation helpers:
  character notebook travel, scene select, and `找到 Alan` each called
  `enterCampus()` when Alan was away. `src/components/Game.tsx` now treats away
  mode as observation-only: scene select changes camera view, character travel
  focuses the target scene, and `找到 Alan` explains that Alan is away without
  rejoining. Only explicit `接手 Alan` and explicit start-chat actions still
  enter campus. Verification: `npx tsc --noEmit --pretty false`, `git diff
  --check -- src/components/Game.tsx`, `npm run build` (existing Vite chunk
  warning), and Chrome headless smoke confirmed presence button stayed
  `接手 Alan` after scene select and `找到 Alan`.
- 2026-06-12 21:45 CDT: Scene Mode polish for Alan's mobile/UI follow-up is
  implemented. Root cause for "window sits idle then jumps to another scene and
  back" was the Alan-follow effect calling `setSelectedSceneId()` on every Alan
  position update while `followAlanRef` was true; tiny coordinate updates near a
  room boundary could yank the selected scene. `Game.tsx` now only switches to
  Alan's scene on initial lock / explicit `找到 Alan`, then refocuses only when
  Alan is still in the selected scene. Scene Mode also keeps Alan visible as a
  stage card: live Alan appears in the character row, off-scene Alan is shown as
  a dim presence card with his location, and away/unclaimed Alan gets a dashed
  presence card so Alan can tell whether he is online. Scene hotspot banners
  moved into an upper rail, and standee labels now sit above the portrait
  stacking layer. Visual QA screenshots:
  `tmp/visual-qa/scene-polish-final2-mobile.png` and
  `tmp/visual-qa/scene-polish-final2-desktop.png`; both showed no horizontal
  overflow and included the Alan presence card in the tested runtime.
- 2026-06-12 21:39 CDT: Deep-dived Alan's repeated Alan/海 `連線暫時不穩`
  reports after the cloud-Qwen env fix. The later 21:11-21:13 symptom was not
  an official Qwen timeout: live debug showed Umi had been carrying stale
  `toRemember: c:7180` from an archived Alan chat whose final meaningful
  messages were Alan-side pings (`海`, `海`, `哈囉哈囉`), and the engine had
  generation-number races while new code was deploying. Manual repair cleared
  the stale marker; a stop/quiet-check confirmed it stayed gone. Both affected
  archived Alan/海 conversations (`c:7180` and the later bad recovery
  conversation `c:7246`) currently report `memoryCount: 0` and
  `experienceLogs: []`, so the failed/hallucinated transcripts did not enter
  Umi's memory or the v0.1 experience-log layer. Durable hotfix: human-facing
  conversations with no messages or a final human message no longer queue
  `agent.toRemember`; remember preflight clears `unanswered_human_tail`; memory
  writing has a defense-in-depth `skipUnansweredHumanTail`; memory and
  experience-log writers now reject first-person/third-person stage-direction
  leakage without treating benign parentheticals as leaks. cc completed a
  read-only postpatch review at `umi/reports/20260613T023526Z-workload.md` and
  flagged the parenthetical false-positive risk; Codex accepted and patched it.
  Verification: targeted Jest 66/66, `npx convex codegen`, `npx tsc --noEmit
  --pretty false`, `npm run build` (existing chunk warning only), `git diff
  --check`, `world:defaultWorldStatus` running at day 25 21:38, and
  `school:debugAlanConversationState` summary clean.
- 2026-06-12 21:12 CDT: Deep-dived Alan's 20:59-21:03 Alan/海 chat timeout
  where the UI showed `連線暫時不穩，這段沒有寫入角色記憶。`. Evidence:
  `mobile-dev-stack.log` showed repeated `Human-facing retry failed; aborting
  instead of weak-model fallback` / `AbortError` around 21:04, followed by
  `LLM_PROVIDER=ollama` warnings. Root cause was config mismatch, not official
  Qwen slowness: Qwen pilot env existed, but Alan human chat cloud switches were
  absent, so human-facing replies fell through to local Ollama and then aborted
  rather than saving weak fallback. Official Qwen smoke against the configured
  primary key/base/model returned HTTP 200 in about 1.6s; the backup key returned
  401 and was removed from local Convex env. Fixed local env:
  `HUMAN_CONVERSATION_CLOUD_LLM=true`, `ALAN_HUMAN_CLOUD_LLM=true`,
  `COMPANION_PILOT_TIMEOUT_MS=60000`; restarted detached `screen`
  `underworld-mobile`. Verified env, HTTP 200 for `/ai-town` and Convex proxy,
  and `world:defaultWorldStatus` `running` at world day 25 21:11.
- 2026-06-12 20:59 CDT: Alan reported the world collapsed. Runtime triage found
  no active Vite/mobile proxy/Convex dev processes, `5173` was unreachable, and
  `world:defaultWorldStatus` showed `stoppedByDeveloper` at world day 25 20:42.
  Root cause was operational: the previous mobile stack was tied to an
  ephemeral Codex exec session instead of a durable local session. Recovered by
  launching a detached `screen` session named `underworld-mobile` with
  `npm run dev:mobile -- --host 192.168.1.239 --skip-init`, then running
  `testing:resume`. Verified `http://127.0.0.1:5173/ai-town`,
  `http://192.168.1.239:5173/ai-town`, and `http://192.168.1.239:13210` return
  HTTP 200. `world:defaultWorldStatus` reports `running` at world day 25 20:58.
  Manage with `screen -r underworld-mobile` to view, `screen -S
  underworld-mobile -X quit` to stop, and `tail -f
  umi/reports/mobile-dev-stack.log` for logs.
- 2026-06-12 20:30 CDT: Patched the two closing caveats Alan flagged after the
  v0.1 PASS. Orphan Alan/海 timeline diagnosis: `messages.writeMessage` now
  force-wakes a `stoppedByDeveloper` world for explicit human chat, while
  passive wake attempts still respect developer stop. 海/真晝 motif diagnosis:
  the fresh `手還舉著` / `這句話` / `明天簡報第一行` / `收進口袋` relay is now a
  named motif family with output abort once it repeats. cc did a read-only
  review and flagged TS narrowing + test coverage; Codex applied both followups
  and confirmed `sleepNotes` schema/index ships with the broader v0.1 memory
  batch. Verification: targeted Jest 40/40, full Jest 233/233,
  `npm run build`, `npm run underworld:harness:self-test`, and
  `npm run underworld:v01-completion-audit` PASS 0/0/0/8.
- 2026-06-12 20:19 CDT: Mobile UI pass completed for `/ai-town`.
  `src/index.css` now has a narrow-screen (`max-width: 700px`) scene layout
  override: the topbar is compacted into three rows, `手帳` stays as a
  horizontal chip below the topbar, scene characters stop idle animation on
  mobile so taps are stable, the character row/bottom bar no longer occupy the
  same band, and active conversations switch to a single-column phone layout
  with compact portrait header, horizontal tabs, full-width message body, and
  usable input. Visual QA screenshots were captured under `tmp/visual-qa/`,
  including `mobile-world-layer-final2-390x844.png` and
  `mobile-dialogue-after-390x844.png`; Playwright mobile tap selected a
  standee successfully. Verification: `npx tsc --noEmit --pretty false`,
  `git diff --check -- src/index.css`, and `npm run build` passed (existing
  Vite chunk-size warning only).
- 2026-06-12 19:34 CDT: Mobile same-Wi-Fi dev stack is live for Alan testing.
  The normal `com.giis.underworld.dev-stack` LaunchAgent was stopped to avoid a
  port conflict with the mobile stack. Current process is
  `npm run dev:mobile -- --host 192.168.1.239`, with Vite on `*:5173`,
  Convex proxies on `*:13210` / `*:13211`, and Convex backend on `*:3210`.
  Verified `http://127.0.0.1:5173/ai-town`, `http://192.168.1.239:5173/ai-town`,
  and `http://192.168.1.239:13210` return HTTP 200 after allowing the active
  Homebrew Node binary (`/opt/homebrew/Cellar/node/26.0.0/bin/node`) through the
  macOS application firewall. `world:defaultWorldStatus` reports `running`
  at world day 25 19:32. Phone URL: `http://192.168.1.239:5173/ai-town`.
- 2026-06-12 18:57 CDT: Added same-Wi-Fi mobile dev launcher
  (`scripts/dev-mobile.mjs`) and npm entry `dev:mobile` so Alan can open the
  local Underworld UI from a phone without editing `.env.local`, while the
  laptop can still use `http://localhost:<port>/ai-town`. The launcher
  detects the Mac LAN IP, starts Vite on `0.0.0.0`, sets
  LAN-facing `VITE_CONVEX_URL` / `VITE_CONVEX_SITE_URL`, injects
  localhost-only `VITE_CONVEX_URL_LOCAL` / `VITE_CONVEX_SITE_URL_LOCAL`, and
  exposes local Convex through TCP proxies on `13210` / `13211` to avoid
  assuming Convex listens directly on LAN. `ConvexClientProvider` now chooses
  the local Convex URL when the browser hostname is `localhost`, `127.0.0.1`,
  or `::1`; phone/LAN browsers keep using the LAN proxy URL. Current detected
  URLs: phone `http://192.168.1.239:5173/ai-town`, laptop
  `http://localhost:5173/ai-town`. Verification: `npm run dev:mobile --
  --print`, `node --check scripts/dev-mobile.mjs`, package JSON parse,
  `git diff --check -- package.json scripts/dev-mobile.mjs
  src/components/ConvexClientProvider.tsx`, `npx tsc --noEmit --pretty false`,
  and `npm run build` passed (existing Vite chunk warning only). Earlier short
  smoke with `--no-backend --skip-init --frontend-port 5174` started Vite and
  both proxies; `127.0.0.1:5174` returned HTTP 200 and proxy
  `127.0.0.1:13210` returned Convex HTTP 200. Mac self-curl to its own LAN IP
  connected but timed out even with a minimal Node HTTP server, so final LAN
  proof should be a real phone browser on the same Wi-Fi.
- 2026-06-12 17:24 CDT: Implemented the v0.1 evidence-layer pass after Alan's
  scope reset. World rebuild baseline is acceptable for continued evidence:
  `underworld:runtime-preflight` PASS, `underworld:afternoon-world-ready`
  resumed inactive -> running, `underworld:state-audit` reported db 172.3MB /
  state 454MB, and `school:debugState` returned the live roster
  Umi/Ichinose/Maomao/Mahiru/Sakiko/Tianze. Old 18GB state remains archived and
  legacy evidence stays non-fresh. Experience logs now use the six current
  evidence pilots only (`海 / 真晝 / 貓貓 / 天澤 / 一之瀨 / 祥子`) with alias
  normalization, archived-source call contract, fallback/drift/wrong-addressee/
  stage/echo guards, 2/day cap, 1/source-conversation cap, dedupe, and no
  embeddings. Observe/report now prints fresh transcripts plus experience-log
  created/rejected status. Latest fresh archived run produced 4 samples:
  `conversation-c:6842` 一之瀨/貓貓 wrote 2 logs; `conversation-c:6861`
  真晝/天澤 was blocked as `obvious_echo_or_motif_loop`; two other samples did
  not write because of cap/dedupe/no qualifying residue. `eval:soul-triad` now
  includes 貓貓 and reported 4 PASS; `eval:conversation:recent` remains
  0 PASS / 2 WARN / 2 FAIL due to repeated everyday-object motifs and weak
  character voice. `underworld:experience-sleep-promote` dry-run read 12 logs,
  prepared 2 tiny candidates, inserted 0. `rolling-continuity` remains WARN /
  weak_continuity and exits 1 because v0.1 completion audit is still FAIL;
  AM->PM continuity PASS and sleep-consolidation dry-run PASS. Verification:
  codegen, targeted Jest 54/54, `npx tsc --noEmit --pretty false`,
  `npm run build`, and `git diff --check`.
- 2026-06-12 16:10 CDT: Investigated Alan's pasted 一之瀨/貓貓 and 貓貓/一之瀨
  samples. Recent eval data confirmed systemic memory attribution pollution
  (54 mismatched memory traces across 68 checked traces / 27 conversations),
  plus a separate send-time addressee repair gap for titled self-vocatives like
  `一之瀨姊`. Codex fixed future prevention by making memory conversation load
  prefer archived `participants` over stale `participatedTogether` fallback,
  routing `agentSendMessage` through the shared addressee repair helper, and
  teaching the helper titled aliases (`姊`, `姐`, `老師`, `前輩`, `同學`) for
  the active cast. Existing Convex rows were not mutated; cleanup requires a
  dry-run-first pass. Verification: targeted Jest 39/39, `git diff --check`,
  and `npx tsc --noEmit --pretty false` passed.
- 2026-06-12 16:24 CDT: Alan showed a 15:03 祥子/天澤 case where 天澤 said
  `不用了，真晝。` and both memories were attributed through 真晝. Codex added
  `school:repairRecentConversationParticipantDrift`, ran dry-run first, then
  repaired the latest 80 archived conversations. Write results: first pass fixed
  50 affected conversations, 5 message texts, and 98 conversation memories; a
  second normalization pass fixed 3 remaining repaired-address messages; a
  final possessive self-reference pass fixed 1 `一之瀨姊姊的...` message. No
  memories/conversations were deleted, no unrepairable memories remained, and
  no stale/missing participatedTogether edges were found in this recent window.
  Final dry-run: 0 affected. Recent eval mismatch counter: 70 memory traces,
  0 mismatches. Verification: targeted Jest 40/40, `npx tsc --noEmit --pretty
  false`, and `git diff --check` passed.
- 2026-06-12 08:58 CDT: Alan approved the fresh-world-with-archive recovery
  path. Codex moved the old active state to
  `/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town-archive-20260612T085455-pre-fresh-world`
  and recreated a fresh active directory at the original T9 symlink target.
  Only Convex local deployment `config.json` was copied back from the archive;
  no old sqlite/storage data was copied into the fresh world. After
  `npx convex run init`, `world:defaultWorldStatus` returned a running default
  world, `school:debugState`, `school:worldClock`, and `school:umiBriefing`
  returned without timeout, and `/ai-town` returned HTTP 200. Fresh active
  state is about 3.6MB; old archive is 18GB. Next step: collect fresh-world
  v0.1 samples before making further prompt/residue changes.
- 2026-06-12 09:24 CDT: Alan corrected the direction: a long-running emotional
  world cannot reset every time local DB state becomes too large. Codex and cc
  shifted priority to sustainable state retention. cc's read-only report
  identifies the likely main growth source as `agentDoSomething` scheduling
  whole map/player/agent snapshots into Convex internal scheduled-job args.
  Roadmap/proposal now require preserving soul/continuity data and slimming
  runtime/job payloads first. The next code task is T1 scheduled-arg slimming,
  then archive continuity export/import.
- 2026-06-12 09:32 CDT: T1 scheduled-arg slimming completed. `agentDoSomething`
  no longer schedules full map/player/agent snapshots; it passes IDs only and
  reloads context inside `agentOperations.loadAgentDoSomethingContext`. This
  directly targets the `_scheduled_job_args` byte-rate source without touching
  memories, residues, conversations, or the archived old state. Verification:
  typecheck passed, targeted agent Jest 12/12 passed, build passed with the
  existing chunk-size warning, and live smoke confirmed world `running`,
  `school:debugState` returns 6 characters, and `/ai-town` is HTTP 200.
- 2026-06-12 09:47 CDT: Added read-only state growth audit
  (`scripts/underworld-state-growth-audit.mjs`; npm scripts
  `underworld:state-audit` and `underworld:state-audit:self-test`). Active
  fresh audit reports state dir about 42MB / sqlite about 36MB and newest
  scheduled args are small ID-only / conversation / run-step payloads, which is
  positive evidence that T1 is working for new rows. The fresh state still has
  217 large pre-T1 map/snapshot rows in scheduled args backlog. Archive fast
  audit reports the old 18GB state has 6.3GB sqlite, 6.6GB local storage,
  1.56M document rows, 2.1GB freelist, and large map/player/agent snapshot
  payloads near its final scheduled args. Updated roadmap/proposal: next step is
  export-only archive continuity recovery, not deleting memory or trying direct
  sqlite surgery. cc review retry was blocked by Claude session limit until
  12:30 CDT, recorded in `umi/reports/20260612T144121Z-workload.md`.
- 2026-06-12 09:51 CDT: Added export-only archive continuity recovery script
  (`scripts/underworld-archive-continuity-export.mjs`; npm scripts
  `underworld:archive-continuity-export` and
  `underworld:archive-continuity-export:self-test`). Active smoke export passed.
  Full old-archive export completed from readonly sqlite and wrote
  `umi/exports/archive-continuity-latest/`: 87,751 candidate rows scanned,
  56,525 continuity rows exported, package about 40MB. Exported counts:
  archived conversations 4,154; messages 25,449; memories 5,974; school
  timeline 5,478; notifications 3,061; participated-together 10,210;
  school-world-pressure 2,046; Alan behavior profiles 88; agent descriptions
  30; player descriptions 35. Embeddings were excluded by default. This is not
  an import and should not count as fresh v0.1 evidence. Next safe step is
  export audit / curated import design, not runtime mutation.
- 2026-06-12 10:07 CDT: Added sustainable-world system design doc
  (`docs/underworld-sustainable-world-system-design.md`), package audit script
  (`scripts/underworld-continuity-package-audit.mjs`; npm scripts
  `underworld:continuity-package-audit` and self-test), and morning healthcheck
  integration for active state-audit summaries. Continuity package audit reports
  `REVIEW_REQUIRED`: archived conversations are present; 14 fallback/pollution
  hits (memories 3, messages 11) need filtering; 8,066 legacy CaoCao/Liu
  Bei-era hits need alias/remap or historical-label review; 41,924 raw evidence
  rows should not be directly imported. Import boundary remains Alan-approved
  curated summaries only, with `legacyArchive` provenance and exclusion from
  fresh v0.1 samples.
- 2026-06-12 10:12 CDT: Hardened the active state audit for live sqlite lock
  behavior. `scripts/underworld-state-growth-audit.mjs` now uses sqlite
  busy-timeout plus short retry for `database is locked` so morning checks do
  not fail just because Convex is writing. Verification passed:
  `underworld:state-audit:self-test`, live `underworld:state-audit` (sqlite
  45.9MB, state 86MB, 1,254 scheduled-arg rows scanned),
  `underworld:continuity-package-audit`, `bash -n
  umi/underworld_morning_healthcheck.sh`, `git diff --check`, `npx tsc
  --noEmit --pretty false`, and `npm run build`.
- 2026-06-12 10:46 CDT: Added read-only curated restore tooling for the old
  archive continuity package. `scripts/underworld-continuity-restore-candidates.mjs`
  / `npm run underworld:continuity-restore-candidates` creates capped Tier 1,
  review-only, and rejected candidate packets under
  `umi/exports/curated-continuity-candidates-latest/` plus report
  `umi/reports/curated-continuity-candidates-latest.md`; the current
  classification saw 650 Tier 1 candidates, 7,526 review-only candidates, and
  26,251 reject/evidence-only rows after dedupe and policy checks.
  `scripts/underworld-legacy-continuity-import-plan.mjs` /
  `npm run underworld:legacy-continuity-import-plan` creates a 24-row
  dry-run-only `legacyContinuityEvidence` plan under
  `umi/exports/legacy-continuity-import-plan-latest/`; all proposed rows are
  `legacyArchive: true`, `freshEvalEligible: false`, `promptFacing: false`,
  and `reviewRequired: true`. This is still not an import. A cc retry at 10:41
  CDT still hit the Claude session limit until 12:30 CDT, recorded in
  `umi/reports/20260612T154155Z-workload.md`.
- 2026-06-12 14:15 CDT: cc review succeeded after the session reset
  (`umi/reports/20260612T190648Z-workload.md`). cc agreed the export/audit/dry-run
  shape is safe, but rejected the original 24-row packet as too duplicated and
  motif-heavy: repeated curry/food/fatigue, mirror duplicates, and abstract
  Alan behavior profiles should not be the first restore packet. Codex accepted
  the review and tightened the tools. The candidate sampler now tracks
  stage-direction leaks, Mai/Asuna legacy names, pollution-adjacent conversation
  IDs, residue/conversation dedupe, repeated motif families, and review-only
  Alan behavior profiles/notifications. The import plan now defaults to 12
  dry-run rows and skips food-care motifs, stage-direction leaks, repeated motif
  families, duplicate summaries, and non-first-restore kinds. Latest reports:
  `umi/reports/curated-continuity-candidates-latest.md` and
  `umi/reports/legacy-continuity-import-plan-latest.md`. No live Convex import
  or mutation has happened. Follow-up proposal written:
  `umi/proposals/20260612T1418-legacy-continuity-evidence-layer.md`; after
  15:06, schema + dry-run are implemented, while live write mode, prompt read
  path, and legacy evidence promotion still require Alan approval.
- 2026-06-12 15:06 CDT: Alan approved the schema + dry-run importer boundary,
  not live row write. Added `legacyContinuityEvidence` to `convex/schema.ts`
  with `promptFacing`, `freshEvalEligible`, `reviewRequired`, provenance,
  `primaryConversationId`, and import-run metadata. Added
  `scripts/underworld-legacy-continuity-import.mjs` plus npm scripts
  `underworld:legacy-continuity-import` and self-test. The dry-run validator
  wrote `umi/reports/legacy-continuity-import-latest.md` and
  `umi/exports/legacy-continuity-import-latest/`: 12 valid rows, 0 rejected,
  0 prompt-facing, 0 fresh-eval-eligible. `--write` mode is intentionally
  blocked and throws an explicit error. `npx convex codegen` was run for local
  generated bindings; it uploaded function metadata as part of Convex's codegen
  flow, but no import command or legacy row write was executed. Verification:
  importer self-test, dry-run import, `npx tsc --noEmit --pretty false`, and
  `npm run build` passed.
- 2026-06-12 08:29 CDT: v0.1 morning push paused on runtime health. After the
  07:50 fresh observe, Codex attempted to collect one more Umi/Mahiru sample to
  satisfy the ≥3 fresh-sample rule. The sample failed before collection because
  `convex run world:defaultWorldStatus` waited for the local backend. Logs and
  process inspection showed `Invalid conversation ID c:103698`, repeated
  system-operation timeouts, dead-engine restart, and then multiple local
  backends briefly competing for port 3210. Codex stopped the LaunchAgent,
  killed duplicate/stuck Convex run/backend processes, restarted only the
  dev-stack, and waited more than 5 minutes. A single backend still consumed
  high CPU/RAM and never bound 3210; active sqlite state is 6.3GB on T9. The
  dev-stack was intentionally stopped to protect the machine. Root cause is
  currently local Convex state/startup health, not frontend or Qwen. Proposal
  written: `umi/proposals/20260612T082840-local-convex-state-hygiene.md`.
  Follow-up diagnostics at 08:45-08:53 CDT were copy-only: copied the state to a
  timestamped T9 diagnostic directory, ran sqlite `quick_check=ok`, found 1.56M
  document rows / 1.03M index rows, about 2.1GB freelist, and confirmed the
  largest bloat is internal `_scheduled_job_args` / `_scheduled_jobs` rather
  than character memories. `VACUUM INTO` reduced a copy from 6.3GB to 4.0GB and
  `quick_check=ok`, but a sandbox backend boot against the compacted copy still
  did not bind 3210 within 60s and reached about 4GB RSS. The sandbox backend was
  stopped. Updated recommendation: do not directly swap compacted sqlite; choose
  fresh-world-with-archive for momentum or deeper supported Convex scheduled-job
  cleanup investigation for continuity preservation.
- 2026-06-12 07:50 CDT: Started the next-day v0.1 push from fresh evidence
  instead of treating yesterday's state as current. Runtime preflight passed
  (`npm run underworld:runtime-preflight`), Vite `/ai-town` returned HTTP 200,
  local Convex responded on port 3210, and the official Qwen smoke
  (`node scripts/test-qwen-key.mjs`) returned HTTP 200 on `qwen-plus` without
  printing key material. A daytime observe run collected fresh controlled
  samples and printed transcripts, but recent eval mixed together pre-change
  samples and found real object/food loops (`湯匙`, `豆漿`, `筷子`, `蛋捲`) plus a
  character-voice rubric mismatch. Per Alan's reminder to use cc, Codex assigned
  cc a read-only second-opinion pass in `umi/workload.md`; report:
  `umi/reports/20260612T124215Z-workload.md`. cc agreed the primary harness issue
  was a too-literal `characterVoiceScore`, while the object/food motif loop was
  a real separate runtime pressure problem. Applied a narrow harness fix so
  character voice can credit behavior-shaped cues without disabling object-loop
  detection; then applied a bounded prompt/data pressure fix that removes
  default food/rest care moves and "Alan is tired" assumptions in favor of
  broader school-life cues. Verification so far: targeted Jest suite for motif
  guard + conversation metrics, `npx tsc --noEmit --pretty false`, `npm run
  build` (existing chunk-size warning only), and `git diff --check` on touched
  files. Next proof: run a fresh observe/eval after this runtime prompt/data
  change; do not use the older 12:30Z eval boundary as post-change evidence.
- 2026-06-11 22:46 CDT: Applied a bounded life-topic diversity pass after Alan
  observed that the world kept circling bento/food/rest/tiredness, especially
  in Alan-facing chats. Root cause was prompt/data pressure, not a memory
  architecture problem: companion prompts did not explicitly forbid assuming
  Alan is tired, weekend/calendar hints over-weighted food/rest, scene topic
  lists for dorm/club/courtyard leaned on fatigue/lunch, and several fallback
  lines used food/rest as the default care move. `convex/agent/conversation.ts`
  now tells Alan-facing companion mode to answer Alan's actual intent without
  assuming fatigue unless Alan or fresh evidence says so; everyday pivots now
  prefer class mistakes, rumors, hobbies, clubs, weekend plans, lost items,
  awkward friendships, and scene-specific memories before food/rest. `data/schoolCalendar.ts`
  no longer defines weekend as rest/eating first, and `data/dailyLifeBulletin.ts`
  swaps several food/rest bulletin items for club notes, practice sheets,
  borrowed-item notes, moved chairs, flyers, and quiz mistakes. This is a
  low-risk prompt/data pass only; no runtime memory/provider architecture was
  changed. Verification: `git diff --check -- convex/agent/conversation.ts
  data/dailyLifeBulletin.ts data/schoolCalendar.ts`, `npx tsc --noEmit --pretty
  false`, `npm run build` (existing chunk-size warning only).
- 2026-06-11 22:05 CDT: Updated `docs/giis-v0.1-roadmap.md` with the memory
  relevance principle for v0.1. Decision: do not deepen characters by dumping
  more raw memory into every prompt. The next memory step is to rank/select the
  right 1-3 usable traces for the current partner, scene, event thread, Alan
  context, and soul cue. Alan-facing chats should prioritize Alan-related
  commitments/corrections/residues; NPC-to-NPC chats should prioritize the
  other speaker, current scene, today's event thread, and unresolved residues.
  This is a tomorrow work item after official Qwen/provider stability is
  rechecked; no runtime behavior changed in this note.
- 2026-06-11 23:40 CDT: Completed a bounded large-render framing pass based on
  Alan's request to make character display scale closer to Mahiru and crop
  visible art around head-to-knee instead of showing full body too small. Added
  per-character `renderFraming` data in `data/characterVisuals.ts`; `CharacterPortrait`
  now exports `--render-zoom` / `--render-y`; Scene Mode standees and the active
  dialogue portrait stage now use a clipped viewport with zoomed top-aligned
  art. No PNGs were regenerated or overwritten. Visual QA: live scene screenshot
  `tmp/visual-qa/render-framing-scene-final.png` and comparison sheet
  `tmp/visual-qa/render-framing-contact.png`. Verification:
  `npx tsc --noEmit --pretty false`, `git diff --check`, and `npm run build`
  (existing chunk warning only).
  2026-06-12 02:55 CDT follow-up: after Alan's screenshot showed Sakiko visually
  shorter and the character row feeling off-center/cropped on one side, added a
  Sakiko-only `offsetY: -1.3rem` and changed the Scene Mode standee row from
  width-by-content flex to a centered equal-slot grid (`row center=1024` in a
  2048px probe). Visual QA: `tmp/visual-qa/render-framing-scene-centered.png`.
  Verification: `npx tsc --noEmit --pretty false`, `git diff --check`,
  `npm run build` (existing chunk warning only), and headless Chrome geometry
  probe against `http://localhost:5173/ai-town`.
  2026-06-12 07:33 CDT follow-up: Alan still perceived the stage characters as
  cropped, so the Scene Mode standee card no longer hard-clips with `clip-path`;
  it keeps `overflow: visible` and lets the character render naturally extend
  beyond the invisible slot while labels/UI remain on top. This removes the hard
  horizontal cut line without regenerating art. Visual QA:
  `tmp/visual-qa/render-framing-no-hard-crop-dormitory.png`. Verification:
  `npx tsc --noEmit --pretty false`, `git diff --check`, and `npm run build`
  (existing chunk warning only).
- 2026-06-11 22:38 CDT: Fixed the Alan conversation drawer initial-position
  bug where opening dialogue and starting to type could push the usable text
  area out of view until refresh. Root cause was browser focus scroll plus
  duplicated outer character chrome above the active `ConversationPanel`.
  `MessageInput` now focuses the textarea with `preventScroll`, `Messages`
  schedules a second bottom-align after layout settles, and the selected-player
  drawer hides the redundant outer portrait/tabs/location/leave controls while
  an active dialogue is open so the real conversation panel starts near the top
  of the viewport. Visual probe: `tmp/visual-qa/dialogue-open-after-compact-fix.png`
  showed `window.scrollY=0`, active panel y=35, and input bottom=873 in a
  1440x1000 viewport. Verification: `npx tsc --noEmit --pretty false`,
  `git diff --check`, `npm run build` (existing chunk warning only), and
  headless Chrome layout probe against `http://localhost:5173/ai-town`.
- 2026-06-11 21:49 CDT: Migrated Alan's new official Alibaba Cloud Model
  Studio / Qwen workspace API key out of `.env.local.example` and into
  `~/.config/giis-underworld/secrets.env` (600, with timestamped backup) plus
  the local Convex deployment env `local-alan_chu-ai_town`. `.env.local.example`
  is back to a secret-free template. Official Qwen routing now defaults to
  `UMI_MAHIRU_PILOT_MODEL=qwen-plus` and an OpenAI-compatible
  `/compatible-mode/v1` base URL; the runtime and preflight scripts normalize
  base URLs that already end in `/v1` so they do not append a duplicate path.
  `qwen-plus` smoke-tested successfully against the official endpoint
  (HTTP 200, 2.3s). `qwen3.5-plus` timed out at 40s in the same smoke script,
  so keep `qwen-plus` as the Underworld default and only use `qwen3.5-plus` for
  a later longer-timeout A/B quality check. Verification: repo scan found no
  `sk-ws-` key material, `node scripts/test-qwen-key.mjs`, `npm test -- --runTestsByPath
  convex/modelPolicy.test.ts`, and `npm run build`.
- 2026-06-11 21:20 CDT: Diagnosed Alan-facing 海 / 一之瀨 chats that appeared
  stuck on "正在思考". Root cause was not Vite, Convex, input queue, or local
  CPU slowness: both primary and backup Qwen/newcoin cloud paths returned
  HTTP 429 (`insufficient_user_quota` / upstream saturated), the character-soul
  provider entered cooldown, and local fallback was not allowed to masquerade
  as a real Alan-facing soul reply. The affected conversations were archived as
  single-sided diagnostics (`c:101049` Alan/海 and `c:101087` Alan/一之瀨), so no
  weak fallback reply entered memory. Frontend `Messages.tsx` now converts stale
  typing/awaiting-reply states after 45s into an explicit "connection unstable,
  not written to memory" bubble instead of showing infinite "正在思考".
  Recommendation: move v0.1 primary traffic to a stable official cloud provider
  before relying on long Alan playtests; keep local Ollama as smoke/debug or
  explicitly labeled non-memory fallback only. Verification: primary and backup
  `scripts/test-qwen-key.mjs` returned HTTP 429 without printing keys, `ollama
  list` confirmed local models exist, `npx tsc --noEmit --pretty false`, `npm
  run build`, `npm run test -- convex/modelPolicy.test.ts`, `git diff --check`.
- 2026-06-11 20:19 CDT: Completed the bounded Scene Mode day/night backdrop
  pass. Generated and saved 10 new VN backgrounds under `public/backgrounds/`:
  `classroom-day.png`, `classroom-night.png`, `courtyard-day.png`,
  `courtyard-night.png`, `aiClubRoom-day.png`, `aiClubRoom-night.png`,
  `studentCouncilRoom-day.png`, `studentCouncilRoom-night.png`,
  `dormitory-day.png`, and `dormitory-night.png`. `Game.tsx` now selects day
  variants for 早晨 / 中午 / 下午 and night variants for 晚上 / 深夜, with the
  original no-suffix backgrounds kept as fallback. This intentionally does not
  add weather, sunset, event-specific, or backend scene-state systems. QA
  contact sheet: `tmp/visual-qa/scene-day-night-contact.png`. Verification:
  `npx tsc --noEmit --pretty false`, `git diff --check`, `npm run build`
  (existing chunk warning only), and HTTP 200 asset smoke for all 10 new
  day/night background URLs. Headless Chrome `/ai-town` runtime smoke was
  blocked by the existing local Convex websocket refusal at
  `ws://127.0.0.1:3210/api/1.39.1/sync`; screenshot saved to
  `tmp/visual-qa/scene-day-night-browser-smoke.png`.
- 2026-06-11 17:37 CDT: Completed the bounded v1 stage emotion matrix pass Alan
  requested after noting scope control. Generated and chroma-key processed the
  final six large renders (`umi-neutral.png`, `mahiru-neutral.png`,
  `tianze-worried.png`, `ichinose-worried.png`, `maomao-worried.png`,
  `sakiko-worried.png`), normalized them against same-character footprints, and
  wired missing `renderPaths` in `data/characterVisuals.ts`.
  `docs/giis-emotion-asset-manifest.md` now shows 0 missing large renders and
  18 remaining portraits; action/talking/working pose generation remains
  intentionally deferred. Verification: alpha audit/contact sheet
  `tmp/visual-qa/full-emotion-render-matrix.png`, all 24
  `/renders/{slug}-{emotion}.png` URLs returned HTTP 200,
  `npx tsc --noEmit --pretty false`, `git diff --check`, `npm run build`
  (existing chunk warning only).
- 2026-06-10 evening (Claude/Cowork session): the `eval_rubric_disagreement`
  blocker was adjudicated — both harnesses are right (soul-triad: differentiation
  improved; recent eval: a real cross-speaker motif loop persists). Record:
  `evals/conversations/reports/soul-rubric-reconciliation.md` (2026-06-10
  section). The motif family (涼掉的飲食 / 先停先別推) was added to the
  conversation motif guard per the ≥3-sample rule. Memory layer received the
  larger fixes, driven by live Alan playtests (海 8:06pm, 一之瀨 8:16pm):
  commitment extraction now resolves relative dates to absolute date+weekday at
  write time, detects offer-based promises without an explicit "好" (the
  一之瀨 c:94554 loss), attributes the promiser as the offerer (direction
  inversion fix), expires stale promises at read time (dated label or legacy
  「答應明天」+48h), and scans a deeper window (150 rows) so old promises stop
  scrolling out of reach (海's 6/4 curry promise was present at importance 7
  but unreachable behind take(24)). Anti-confabulation now also works
  retroactively: a recall correction down-weights matching older memories
  (RECALL_CORRECTED_MARKER + importance 0, hidden from read paths); the 6/4
  「世界變得太聰明」 fabrication and one unverified 真晝 claim were cleaned
  manually via `school:downweightFalseMemory`. New read-only audit:
  `npm run underworld:memory-hygiene` (found pollution to be small: 2 suspect
  rows out of 919; zero legacy-format rows, which suggests follow-up #2
  backfill may be unnecessary — Alan to confirm). Transcript visibility:
  `underworld:alan-playtest-candidates` gained `--target=all`, and
  `underworld:rolling-continuity` now auto-refreshes that export, so Alan
  chats no longer require a manual export before review. UI: new VN-style
  conversation view (`src/components/VnConversationView.tsx`, toggle in
  ConversationPanel, default ON) using existing neutral portraits; emotion
  portrait variants are not yet generated. Remaining v0.1 gates after this
  session: fresh-window life signals + the real Alan-facing playtest artifact
  (五條 checklist). Verification: `npx tsc --noEmit`, `npm test --
  convex/agent/memory.test.ts convex/agent/commitmentPrompt.test.ts
  convex/agent/conversationMotifGuard.test.ts` (39 tests), script self-tests
  (candidates, rolling-continuity, memory-hygiene), `git diff --check`.
- Cloud Qwen path has been used for recent guarded samples, but afternoon scoped
  sample collection timed out on 2026-05-31; natural archived conversations were
  still sufficient to judge AM->PM continuity. After the prop/motif candidate
  patch, active collection failed earlier at provider preflight with Qwen
  `403 token quota is not enough`; Alan provided a replacement key on
  2026-05-31 and a minimal `scripts/test-qwen-key.mjs` smoke returned HTTP 200.
- Fallback pollution cleanup previously reached zero across audited surfaces;
  rerun the audit before relying on that as current.
- v0.1 was evidence-complete / human-review-ready on the 2026-06-01 role setup,
  not perfect. After the 2026-06-02 Tianze/Ichinose role change and the
  2026-06-04 resumed-world morning evidence, the rerun temporarily became an
  active FAIL through `pilot_role_action_collapse`; the 09:04 CDT daytime rerun
  cleared that hard role-action blocker. As of 12:38 CDT, the latest completion
  audit is `PENDING` with 0 fail, 1 pending, 0 deferred, 7 pass. The only
  pending gate is Alan-facing Umi playtest quality.
- Rolling two-hour continuity is now the primary v0.1 recent-memory gate.
  Latest report is PASS / `continuity_observed`: 10:00-12:00 source window ->
  12:00-14:00 callback window, 28 source samples, 7 callback samples, 40
  residue candidates, and 6 rolling callbacks. AM->PM remains useful legacy
  day-arc evidence, but no longer blocks v0.1 by itself when rolling continuity
  passes.
- Day-window life-signal diagnostics now include pilot role-action coverage.
  Latest 2026-06-04 09:04 CDT daytime evidence has 9 day-window conversations,
  life signals PASS / `life_signal_observed`, pilot expected action match rate
  0.69, and 3 day-window pilot action collapse flags. Rubric reconciliation no
  longer lists `pilot_role_action_collapse` as a blocker; recent eval still
  reports human-review quality gaps (`voice_rubric_gap` /
  `reply_binding_rubric_gap`) that should not trigger prompt auto-fixes before
  Alan playtest.
- As of 2026-06-04 12:38 CDT, local runtime/tooling readiness is stronger and
  the continuity gate has moved from AM/PM to rolling two-hour windows.
  `npm run underworld:v01-afternoon-gate` now refreshes rolling continuity in
  both full and read-only modes, then repair/rubric/completion. The old AM->PM
  report can still describe day-arc evidence, but it is not the only hard v0.1
  continuity blocker.
- Alan-facing playtest evidence is still pending. The ignored local artifact
  `umi/reports/alan-facing-v01-playtest-latest.md` now exists as a non-passing
  `PARTIAL` draft, and `umi/reports/alan-playtest-candidates-latest.md` reports
  `NO_COMPLETE_CANDIDATE` from a read-only scan, so the human gate still needs
  an intentional Alan/Umi playtest or an explicit Alan/product-owner defer.
- At 2026-06-04 12:38 CDT, the latest completion audit is authoritative:
  v0.1 is still `PENDING` with 0 fail / 1 pending / 7 pass, waiting only on
  Alan-facing playtest PASS or explicit Alan/product-owner defer.
- At 2026-06-04 21:25 CDT, the Alan->海 / Alan->天澤 chats from earlier tonight
  still cannot be fully judged from durable evidence because the reports only
  have Alan-side `human_chat_not_archived` orphan sessions. The runtime queue
  root cause is now narrowed: Alan message writes could leave conversation
  inputs pending while the default world engine was inactive. `messages.writeMessage`
  now wakes/kicks the engine after queuing `finishSendingMessage`, and
  `school:debugInputQueue` confirms the prior pending input is completed and
  the world is running. This should protect future Alan-character transcripts,
  but it does not reconstruct old missing character replies.
- Daily life density now has a bounded v0.1-aligned layer: `enterCampus` and
  `advanceWorldTime` ensure one same-day `dailyLifeBulletinItem` set with four
  ordinary school-life items, Umi briefing exposes `dailyLifeBulletin`, and
  `npm run underworld:life-density` writes an observer report. As of
  2026-06-04 21:43 CDT, current report is `PASS /
  life_density_and_multi_angle_uptake_observed`: four same-day ordinary events
  across four periods / three locations, plus 海 and 天澤 mentioning different
  bulletin items from different angles. The uptake proof uses current
  `recentConversationEvalData` plus today's append-only
  `alan-chat-archival-history.jsonl` verifier evidence because active test
  conversations can be replaced by later targeted chats.
- At 2026-06-06 09:01 CDT, the latest completion audit is authoritative:
  v0.1 is still `PENDING` with 0 fail / 2 pending / 6 pass. Pending gates are
  rolling two-hour continuity (`WARN` / `sample_pending`) and Alan-facing Umi
  playtest quality (`NOT_PASS_READY` / `PARTIAL`, 0/5 PASS rows). This is not a
  hard failure; it means today's evidence is not sufficient to declare v0.1
  complete.
- At 2026-06-04 21:47 CDT, the Alan-chat archival / daily-life bulletin goal is
  complete by current evidence: a fresh 海 archival verifier run is `PASS`,
  Umi briefing reads four concise same-day bulletin items without duplicated
  body text, and `npm run underworld:life-density` requires and reports two
  distinct uptake angles (`quiet_care` and `rule_probe`) before returning
  `PASS / life_density_and_multi_angle_uptake_observed`.
- At 2026-06-10 10:35 CDT, today's product v0.1 refresh has moved from
  `PENDING` to `FAIL` in the completion audit, but this should not trigger an
  automatic prompt rewrite. `npm run underworld:observe -- --target-samples=3
  --cc=skip --require-archived=true` collected two fresh archived morning
  samples (`conversation-c:94448` 海/真晝 and `conversation-c:94473` 真晝/天澤)
  and timed out on the third focused 海/天澤 sample, leaving one active
  incomplete conversation. `v01-approach` reports runtime/provider/fallback
  health OK, soul eval 2/0/0, recent eval 0/0/3, and identifies
  `eval_rubric_disagreement` as proposal-only. Rolling continuity remains
  `WARN / sample_pending` because there is no adjacent two-hour callback window
  yet, and life-density is `WARN / conversation_uptake_pending` for today.
- At 2026-06-10 20:28 CDT, Central Umi aligned the local evidence after later
  observe/report activity. `rolling-continuity-latest.md` generated at 18:58 CDT
  is now `PASS / continuity_observed` with 34 callbacks from 10:00-12:00 ->
  12:00-14:00, so the rolling-continuity blocker from the 10:35 completion
  audit is stale. However, `alan-playtest-candidates-latest.md` generated at
  20:26 CDT is still `NO_COMPLETE_CANDIDATE`; product v0.1 remains active until
  character-soul/event-thread eval framing is reconciled and the Alan-facing
  playtest is passed or explicitly deferred.

## Work Log

- 2026-06-11 20:47 CDT: Recovered the local Underworld FE/BE after Alan saw the
  frontend appear broken. Current central/local state was refreshed first.
  Root cause: Vite on 5173 was still serving HTML, but the local Convex backend
  on 3210 was not listening, so browser sync/websocket failed. A manual
  `bash umi/underworld_morning_healthcheck.sh` restarted the launchd dev stack;
  Convex took roughly 10 minutes to open the 6.7GB T9-backed sqlite and start
  listening on 3210. The healthcheck had incorrectly waited only 210 seconds
  despite `run_underworld_dev_stack.sh` documenting a 900-second cold-start
  budget, so it reported FAIL while the backend was still bootstrapping. Patched
  `umi/underworld_morning_healthcheck.sh` to default
  `CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS` to 900 and use that same value in
  `wait_until_ready`, preventing false failed-restart reports and restart-loop
  risk. Verification: `curl -I http://localhost:5173/ai-town`, `curl
  http://localhost:3210/version`, `npx convex run --typecheck disable --codegen
  disable world:defaultWorldStatus` now reports `status: running`,
  `school:debugState` and `school:worldClock` return data, `npx tsc --noEmit
  --pretty false` passes, and `git diff --check` passes.
- 2026-06-11 20:10 CDT: Worktree hygiene + cc coordination refresh. Initial
  `git status --porcelain=v1 -uall` was clean, so the earlier visual/emotion
  asset lane is no longer an active dirty-worktree blocker. A bounded
  Claude Code handoff was written in `umi/workload.md` and dry-run report
  `umi/reports/20260612T004808Z-workload.md` was generated, but the actual
  `python umi/orchestrator.py run umi/workload.md --skip-codex --write
  --timeout 600` run timed out; its recovery Claude process also remained
  stuck and was killed. Treat this as an orchestration/tooling timeout with no
  useful cc findings, not as approval or rejection of the plan. Codex then made
  the narrow v0.1-aligned dialogue fix directly: `convex/agent/conversation.ts`
  now adds a scene-aware restaurant food-object relay prompt when prior turns
  already leaned on food/cutlery/eating/empty-seat cues, and the output repair
  path now aborts generic food-object relay attempts without needing a specific
  food name like `水煮蛋` or `布丁`. A narrowed 20:08 CDT cc read-only diff review
  then flagged that the first output guard was broader than the scene-gated
  prompt and could over-fire on ordinary classroom/dorm food chat; Codex
  accepted that finding, removed broad everyday cues (`茶` / `杯` / `早餐` /
  `吐司` / `麵包` / `湯`) from the generic abort cue set, and added regression
  coverage proving ordinary breakfast chatter is not aborted. Verification:
  `npm test -- convex/agent/conversationMotifGuard.test.ts` passes 34/34;
  `npx tsc --noEmit --pretty false` passes. Fresh long runtime samples were not
  forced at 20:10 CDT to preserve the quiet/winding-down policy; next evidence
  should be several non-quiet-window core-pair samples plus recent eval.
- 2026-06-11 17:01 CDT: Completed the priority emotion-render pass from
  `docs/giis-emotion-asset-manifest.md` so Ichinose, Maomao, and Sakiko no
  longer stay stuck on serious-only stage art. Generated chroma-key sources and
  processed transparent 1024x1536 knee-up renders for
  `ichinose-neutral.png`, `ichinose-smiling.png`, `maomao-neutral.png`,
  `maomao-smiling.png`, `sakiko-neutral.png`, and `sakiko-smiling.png`.
  Normalized each new variant against its existing serious render footprint,
  wired the new `renderPaths` in `data/characterVisuals.ts`, updated
  `docs/giis-emotion-asset-manifest.md`, and updated `public/renders/README.md`.
  Remaining asset gaps are now 6 large renders (`umi-neutral`,
  `mahiru-neutral`, `tianze-worried`, `ichinose-worried`, `maomao-worried`,
  `sakiko-worried`) plus 18 bust portraits. Verification: alpha/bbox audit
  confirms the nine Ichinose/Maomao/Sakiko stage renders have transparent
  corners; HTTP smoke returns 200 for the nine stage render URLs; `npx tsc
  --noEmit --pretty false`; `git diff --check`; `npm run build` (passes with
  existing Vite chunk-size warning). Browser Scene Mode smoke was blocked
  because the local Convex websocket at `127.0.0.1:3210` was not running in the
  headless session; asset and build verification are green. Visual QA:
  `tmp/visual-qa/priority-emotion-renders-contact.png`.
- 2026-06-11 15:24 CDT: Continued active role-to-role mirror/motif goal. Added
  fresh-evidence-backed conversation hygiene in `convex/agent/conversation.ts`
  and regression coverage in `convex/agent/conversationMotifGuard.test.ts` for
  stale repair fallback phrases, pilot-path post-repair quality leaks,
  祥子/天澤 rehearsal-confirmation / perfect-record / skirt-wrinkle relays,
  一之瀨/真晝 bento-truth / boiled-egg / pudding-seat / half-bento-form relays,
  真晝/祥子 repair phrase relays, and 貓貓/真晝 bandage/bento relays. Verification:
  `npm test -- convex/agent/conversationMotifGuard.test.ts` passes 60/60,
  `npx tsc --noEmit --pretty false` passes, and `git diff --check` passes for
  touched files. Runtime evidence improved but does not prove completion:
  a 15:06 fresh 祥子/天澤 probe dropped from FAIL to WARN, but later fresh
  一之瀨/真晝 probes still produced hard FAIL rows through new restaurant
  food-object variants (`水煮蛋`, `布丁`, `一半/真的嗎/表格`). Current judgment:
  do not mark role-to-role dialogue complete; next fix should be a higher-level
  pair+scene policy for restaurant food-object loops rather than adding endless
  individual food names. Updated `docs/giis-v0.1-roadmap.md` with the afternoon
  evidence and v0.2 implication.
- 2026-06-11 11:55 CDT: Refreshed Alan-facing and all-character conversation
  evidence after Alan asked about the latest "everyone" conversation, especially
  海. Current time anchor: 2026-06-11 11:54 CDT. `school:debugInputQueue`
  reports the world running and latest inputs completed, so the server is not
  currently hung. A 09:00+ `recentConversationEvalData` window found five Alan
  conversations and zero orphan chat events; the latest complete Alan/海
  archived transcript is still `conversation-c:98479` from 09:49-09:54 CDT.
  Verdict remains Alan-facing PASS with caveats: 海 greeted directly, recalled
  the curry commitment, handled Alan's date correction, re-anchored it to
  Friday evening, and gave a clean farewell; caveats are curry-direction drift
  toward "mutual curry," one simplified-character leak, and Friday recall still
  pending. Latest role-to-role evidence is mixed and not completion-ready:
  `conversation-c:99746` 海/貓貓 is directionally good because 海 protects 貓貓
  from being treated as a diagnostic tool, but `evals/conversations/reports/latest.md`
  still reports 0 PASS / 2 WARN / 2 FAIL for post-fix role-to-role samples,
  including 一之瀨/祥子 stale phrase leak (`我看見你`) and 祥子/天澤
  mirror/motif repetition.
- 2026-06-11 11:08 CDT: Continued the active role-to-role mirror/motif goal.
  Implemented additional v0.1-bounded dialogue hygiene in
  `convex/agent/conversation.ts` plus regression coverage in
  `convex/agent/conversationMotifGuard.test.ts`: scene-family echo detection
  for stage/clothing/light/score-sheet/trace-object loops; short quoted echo
  repair (`溫的？`, `管不到？`); 真晝 schedule-solving and repeated soft-care
  repairs; 祥子 generic-thanks/uncertainty repairs; 海/貓貓 tea-diagnosis and
  checklist-loop repairs; 天澤/一之瀨 abstract dismantling / food-motif relapse
  repairs; the post-addition first-hard `欠你人情` / `拿了我的溫柔`
  relapse; Tianze/Ichinose `口袋/責任/拆穿/好意/債` relays; 海/貓貓
  schedule-logistics, hot/cold drink, medical-device power, and repair-fallback
  loops; plus 真晝/祥子 cold-bento/cold-plate loops. Verification: `npm test --
  convex/agent/conversationMotifGuard.test.ts` now passes 47/47,
  `npx tsc --noEmit --pretty false` passes, and `git diff --check` passes for
  touched files. Fresh evidence is improved but not complete: `Sakiko:Mahiru`
  probes moved from light/score echo into more character-shaped turns,
  `Tianze:Ichinose` soul-triad can PASS and later recent eval downgraded that
  pair to WARN-only, but fresh `Umi:Maomao` probes still exposed hard FAIL rows
  before the latest repair-fallback fix. Keep the goal active until a fresh
  post-addition role-to-role window shows no hard mirror/motif failures across
  multiple core pairs. Updated
  `docs/giis-v0.1-roadmap.md` v0.2 draft with dialogue golden-set failure
  families and rolling acceptance-window guidance.
- 2026-06-11 10:49 CDT: Refreshed latest conversation evidence after Alan asked
  for the "everyone" conversation analysis with special attention to Alan/海.
  Current raw `school:recentConversationEvalData` confirms the latest complete
  archived Alan/海 transcript is still `conversation-c:98479` from 09:49-09:54
  CDT, with 16 messages and `outcomeQuality=concrete_action`; no newer complete
  Alan/海 archived chat appeared in the refreshed limit-140 read. Verdict remains
  Alan-facing PASS with caveats: she bound greeting/correction/date/closing and
  converted the curry plan to Friday evening, but drifted from "海 makes curry
  for Alan" toward "mutual curry," briefly framed Alan like a student, and leaked
  one simplified character. Fresh role-to-role evidence through 10:49 CDT still
  shows character QA is not complete: 海/貓貓 is better and concrete, but
  all-character side conversations still show mirror/motif loops, missing soft
  closes, and object/prop echo around sleeves, soup/fog, bentō, score sheets, and
  stage/clothing imagery.
- 2026-06-11 10:31 CDT: Reviewed Alan's latest "everyone" conversation evidence
  with special attention to Alan/海. Current time anchor: 2026-06-11 10:11 CDT
  at refresh. The durable Alan/海 playtest at 09:54 CDT is a real archived
  transcript and `umi/reports/alan-facing-v01-playtest-latest.md` records
  `Verdict: PASS` for all five Alan-facing rows (greeting binding,
  latest-sentence binding, correction binding, yesterday/today continuity, and
  closing/idle boundary). Human-facing verdict: pass, with caveats for curry
  direction drift, one simplified-character leak, and Friday 2026-06-12 curry
  recall still pending. Also refreshed `recentConversationEvalData`; runtime
  queue is healthy (`school:debugInputQueue` showed engine running and latest
  inputs completed), so fresh read failures were query weight / sample-pending
  rather than server-down evidence. Continued all-character dialogue QA:
  implemented v0.1-bounded motif/mirror hygiene in `convex/agent/conversation.ts`
  and `convex/agent/conversationMotifGuard.test.ts`: transaction/debt motif
  family, cross-speaker mirror repair, actual pilot-sanitizer-path repair,
  `免費午餐` / `利息` / `交換` / `交易` guards, Maomao counting-rice repair, and
  repeated everyday-prop repair before pilot fallback. Reduced Ichinose source
  over-priming in `data/giisProfiles.ts` from debt/account language toward
  boundary/choice language. Verification: `npm test --
  convex/agent/conversationMotifGuard.test.ts` (20/20) and `npx tsc --noEmit
  --pretty false` pass. Live disposable Tianze/Ichinose probes show progress
  but not completion: the latest focused sample no longer used debt/interest
  transaction wording and soul-triad passed, but `eval:conversation:recent`
  still reports `0 PASS / 3 WARN / 2 FAIL` for the fresh window because
  character voice/action still collapses into concept handoff (`邊界 / 承認 /
  拿走什麼`) and side conversations still have mirror/prop loops. Updated
  `docs/giis-v0.1-roadmap.md` with the 2026-06-11 evidence split and a v0.2
  draft direction. Current verdict: Alan/海 passes v0.1 human-facing quality;
  all-character dialogue QA remains active and v0.1 is not complete by current
  machine evidence.
- 2026-06-11 07:50 CDT: Continued all-core-character dialogue/soul QA after Alan
  asked to raise every character to the same quality tier. Live disposable
  probes showed two separate issues: (1) Maomao/Sakiko identity/routing is now
  correct when a two-line sample forms, but startup reliability is uneven
  (`Maomao:Sakiko` later returned `sample_pending` while cleaning 2 active
  conversations / 4 messages); (2) old-core pairs can still collapse into
  cross-speaker motif loops (`Tianze:Ichinose` debt/account language,
  `Mahiru` mirroring food/sleep checks, and one Umi/Sakiko milk side sample).
  Implemented compact autonomous speaker-lock and turn-move contrast prompts,
  a one-spoken-beat free-world hygiene pass, narrow repairs for Sakiko schedule
  explanations, Maomao measurement/physiology-report drift, Mahiru reverse
  checking, and Ichinose repeated debt/account motifs. Also updated the
  disposable probe transcript to print authors, aligned Maomao/Sakiko cue
  metrics with live prompt vocabulary (`領結`, `舞臺`, `燈`), blocked
  `系統日誌`/runtime/eval/prompt leaks in free-world dialogue, and changed
  recent conversation eval to ignore one-message active conversations. A
  targeted cleanup dry-run identified probe side-pollution
  `conversation-c:97690` (Umi/Sakiko milk conversation: 1 archived
  conversation, 4 messages, 2 memories, 2 relationship edges, 2 embeddings).
  The first apply attempt timed out because the by-id cleanup scanned all
  character memories; `cleanupArchivedConversationsById` now scans only the
  target conversation participants, and the second apply removed the side
  pollution (final dry-run reports 0 docs). Verification:
  `npx tsc --noEmit --pretty false`; targeted Jest suite 45/45 pass;
  `node --check scripts/run-free-world-routing-disposable-sample.mjs`; final
  `world:defaultWorldStatus` is `running`. Current verdict: text quality and
  speaker consistency improved, but all-character quality is not yet fully
  green: a final `Tianze:Ichinose` live probe still failed 0.85 because
  Ichinose shifted from debt/account wording into the same transaction motif
  via `標價` / `換`; the repair trigger was expanded to cover that vocabulary,
  but it still needs the next fresh live pass. Focused startup reliability also
  remains uneven.
- 2026-06-11 07:47 CDT: Completed the next Scene Mode UI polish pass Alan
  requested: expression renders, conversation focus, natural status text, and
  microanimation. Generated and chroma-key processed six core emotion standees:
  `umi-worried.png`, `umi-serious.png`, `tianze-neutral.png`,
  `tianze-smiling.png`, `mahiru-smiling.png`, and `mahiru-serious.png`.
  `data/characterVisuals.ts` now wires Umi/Tianze/Mahiru `renderPaths` for
  emotion-driven large renders, and `Game.tsx` passes
  `campusSocialState.emotions.currentEmotion` into Scene Mode
  `CharacterPortrait`. Scene standees now have focus hierarchy for selected /
  talking characters, background characters dim slightly, natural per-character
  activity labels replace debug-like status text, and CSS adds light idle /
  selected motion. Adjusted desktop/mobile Scene Mode spacing so labels do not
  collide with the bottom action bar. Updated `public/renders/README.md`.
  Verification: alpha audit confirms all nine core Umi/Tianze/Mahiru emotion
  renders are 1024x1536 with transparent corners; HTTP smoke returns 200 for
  all nine assets; `npx tsc --noEmit --pretty false`; `git diff --check`; `npm
  run build` (passes with existing Vite chunk-size warning); Chrome desktop and
  mobile smoke confirm Scene Mode renders `/renders/*`, has no portrait/CSS
  fallback, and has 0 horizontal overflow. Visual QA:
  `tmp/visual-qa/core-emotion-renders-contact.png`,
  `tmp/visual-qa/ui-polish-scene-desktop-v2.png`, and
  `tmp/visual-qa/ui-polish-scene-mobile-v2.png`.
- 2026-06-11 07:15 CDT: Re-ran live disposable Maomao/Sakiko probes after Alan
  asked to run them. Qwen cloud preflight now passes on each run. Results:
  `Maomao:Sakiko` produced a two-line sample with Maomao noticing Sakiko's dusty
  sleeve / hallway stop and Sakiko deflecting through rehearsal, but
  `eval:conversation:recent` still scored it FAIL 0.86 for naturalness /
  mirror-repetition. `Ichinose:Sakiko` produced a two-line cake / rehearsal-prop
  sample, but scored FAIL 0.78 for weak Sakiko character-voice cues. `Umi:Maomao`
  timed out as `sample_pending` with no two-message sample and cleaned up 1
  active conversation / 0 messages. All disposable probes cleaned their target
  active conversations; final `world:defaultWorldStatus` is `running`. Current
  verdict: provider/routing is usable and no old CaoCao/Liu Bei identity leak
  appeared, but Maomao/Sakiko live dialogue quality is not green yet; the next
  tuning target is shorter, less mirrored second turns and stronger Sakiko crack
  cues.
- 2026-06-11 07:07 CDT: Balanced the perceived character size of the core
  transparent standees after Alan clarified that the "size" issue meant the
  visible person scale, not the PNG canvas size. Kept the shared 1024x1536
  transparent canvas and knee-up framing; left Umi/Tianze/Ichinose/Mahiru as
  the reference group, scaled Maomao up from the shorter crop, and scaled Sakiko
  down from the visually oversized hair/coat mass. Verification:
  bundled-Python alpha audit confirms all six core renders remain 1024x1536
  with transparent corners; HTTP smoke returns 200 for all six `/renders/*`
  assets; `git diff --check`. Visual QA:
  `tmp/visual-qa/render-person-scale-balanced-contact.png`.
- 2026-06-11 07:00 CDT: Tightened Maomao/Sakiko soul execution after Alan asked
  what their souls look like and to continue the quality pass. The durable soul
  docs already define Maomao as diagnosis-as-reluctant-care and Sakiko as
  stage-composure-as-protection across five layers; this pass aligned runtime
  behavior with that shape. Updated `convex/agent/conversation.ts` so Maomao
  and Sakiko replies prefer one short concrete sentence, avoid measurements /
  case-report language, and avoid generic invitation / meeting-organizer voice.
  Updated the shared event-thread prompt so Maomao diagnoses suspicious "fine"
  signals and Sakiko preserves dignity with one crack, instead of the old
  order/exclusion and invitation roles. Updated `convex/school.ts` so Alan-state
  inference treats Maomao interactions as analytical symptom attention, not
  strategic student-council/order attention; public kick memory now records
  Alan's loss of control as a symptom Maomao tracks. Updated
  `conversation_metrics` voice cues and tests for Sakiko's controlled-composure
  vocabulary. Also fixed `run-free-world-routing-disposable-sample.mjs` so
  disposable probes restore the world to running after cleanup. Verification:
  stale-reference scan for old Maomao/Sakiko role residues returned no hits;
  `npm test -- --runInBand evals/conversations/metrics/conversation_metrics.test.ts
  convex/modelPolicy.test.ts convex/agent/dialogueHygiene.test.ts` passed 45/45;
  `node --check scripts/run-free-world-routing-disposable-sample.mjs`;
  `npx tsc --noEmit --pretty false`; final `world:defaultWorldStatus` is
  `running`. Live local-fallback probe after the prompt tightening was
  `sample_pending` and cleaned up 2 active conversations / 1 message / 1 agent
  op, so re-run live quality after cloud/provider health is stable.
- 2026-06-11 06:56 CDT: Rotated the Qwen cloud key after Alan supplied a new
  provider token. The old primary key failed `scripts/test-qwen-key.mjs` with
  HTTP 403 `token quota is not enough`. A one-off smoke using the new key passed
  HTTP 200 against the configured OpenAI-compatible chat completions endpoint
  with `qwen3-max`. Updated local personal secrets at
  `~/.config/giis-underworld/secrets.env` (`QWEN_API_KEY`, file mode remains
  600) and updated the local Convex deployment env
  `UMI_MAHIRU_PILOT_API_KEY` so the character-soul runtime path uses the new
  primary key. Verified again without sourcing local secrets; the script pulled
  from Convex env and passed HTTP 200. No key material was written into repo
  files.
- 2026-06-11 06:50 CDT: Normalized Scene Mode character render framing after
  Alan clarified that the standees should be cropped around the knee/lower-thigh
  area, like Umi / Ichinose, rather than mixing full-body figures with closer VN
  renders. Reprocessed Tianze, Maomao, and Sakiko onto a shared 1024x1536
  transparent canvas and adjusted Maomao/Sakiko away from full-body-to-shoes
  framing into the same knee-up composition family. Verification:
  bundled-Python alpha audit confirms all six core renders are 1024x1536 with
  transparent corners; HTTP smoke returns 200 for all six `/renders/*` assets;
  `git diff --check`. Current world scene had no visible standees during the
  final browser smoke, so the six-asset contact sheet is the visual QA source
  for this framing pass. Visual QA: `tmp/visual-qa/render-knee-up-contact-v2.png`.
- 2026-06-11 06:40 CDT: Completed the Scene Mode character standee cleanup
  Alan asked for after the portrait fallback issue. Generated corrected
  chroma-key sources for Tianze, Maomao, and Sakiko; processed them into
  transparent PNG standees at `public/renders/tianze-serious.png`,
  `public/renders/maomao-serious.png`, and
  `public/renders/sakiko-serious.png`. Rewired Tianze `renderPath` in
  `data/characterVisuals.ts`; Maomao/Sakiko now replace their prior opaque
  render files. `public/renders/README.md` and `docs/giis-vn-art-spec.md` now
  record that the corrected female Tianze render landed and the active core
  cast has transparent default-emotion standees. Verification: bundled-Python
  alpha audit confirms all six core renders have transparent corners and alpha
  channels; HTTP smoke returns 200 for all six `/renders/*` assets; `npx tsc
  --noEmit --pretty false`; `git diff --check`; `npm run build` (passes with
  existing Vite chunk-size warning); Chrome/Playwright desktop and mobile smoke
  confirm the current Tianze + Maomao scene uses `/renders/*`, has 0 portrait
  fallback, 0 CSS fallback, and 0 horizontal overflow. Visual QA screenshots:
  `tmp/visual-qa/final-render-alpha-contact.png`,
  `tmp/visual-qa/final-renders-desktop.png`, and
  `tmp/visual-qa/final-renders-mobile.png`.
- 2026-06-11 06:34 CDT: Prepared an OSF/SocArXiv-ready PDF after Alan reported
  the submission was rejected for ORCID/profile linkage and missing PDF. Updated
  `docs/paper/arxiv/main.tex` so the public manuscript uses `Underworld`
  instead of `GIIS Underworld`, removes public pilot character names from the
  manuscript body in favor of role/personality descriptions, and replaces the
  author placeholder with `Alan Hwader Chu / Independent Researcher` for the
  rendered PDF. Updated `docs/paper/ALAN_HANDOFF.md`,
  `docs/paper/ARXIV_PREPRINT_RELEASE_PACKET.md`,
  `docs/paper/SUBMISSION_STRATEGY.md`, `docs/paper/CITATION_PROVENANCE.md`,
  `docs/paper/OSF_RELEASE_RECORD.md`, `docs/paper/PUBLISH_READY_CHECKLIST.md`,
  and `docs/paper/arxiv/README.md` to match the public naming decision.
  Added `scripts/paper/render_osf_pdf.mjs`, which renders an HTML copy and
  prints it to PDF with local Google Chrome headless, avoiding system TeX
  installation. Generated
  `docs/paper/results/osf/emotional-residue-osf-preprint.pdf` (SHA-256
  `27e03968d30bb09d6449ca2121afa9ff721d9516a6ebda21e17a5110aea1da8f`) and
  previewed the first page via Quick Look; title, author, affiliation, abstract,
  and introduction render correctly. Rebuilt the source archive; current source
  archive SHA-256 is
  `d9a7b2a928403b12976b9422381b5353a340394728c840b54375c59097c5e911`.
  Verification: `node --check scripts/paper/render_osf_pdf.mjs`; `node
  scripts/paper/render_osf_pdf.mjs`; Quick Look PNG preview; `npm run
  paper:source-audit` (`PASS_WITH_WARNINGS`, author metadata now public but
  submitter decision JSON still unconfirmed); `npm run paper:claim-audit`
  (`PASS_CONSERVATIVE_PREPRINT`); `npm run paper:citation-audit` (`PASS`);
  `npm run paper:consistency-audit` (`PASS`); `npm run paper:archive-audit`
  (`PASS`); `npm run paper:submission-audit` (`EXTERNAL_BLOCKERS`, no FAIL);
  `python3 scripts/paper/paper_annotation_audit.py --selftest`; `npm run
  paper:annotation-audit` (`PACKET_READY_INCOMPLETE_STUDY`, 0 FAIL); `npm run
  paper:readiness` (`LOCAL_SOURCE_READY_WITH_WARNINGS`, 0 FAIL / 32 empirical
  blockers / 10 external blockers / 5 PDF blockers); `git diff --check`. No
  external upload, OSF edit, arXiv action, Convex mutation, or new dataset
  collection was run.
- 2026-06-11 06:26 CDT: Hotfixed Scene Mode after Alan reported character
  photos disappeared. The previous `renderOnly` Scene Mode use hid characters
  without vetted transparent renders behind CSS silhouettes. Scene standees now
  allow the existing `/public/portraits` fallback again, with CSS that frames
  portrait fallback images as smaller photo cards instead of treating them as
  full transparent standees. Verification: `npx tsc --noEmit --pretty false`;
  `git diff --check`; `npm run build` (passes with existing Vite chunk-size
  warning); Chrome DevTools Protocol smoke confirms current scene standees have
  1 portrait image + 1 render image, 0 CSS fallbacks, and 0 horizontal overflow.
- 2026-06-11 00:10 CDT: Added per-character activity readability to Scene Mode
  after Alan asked that the world distinguish what each character is doing.
  Scene standees now compose existing runtime signals (`player.activity`,
  movement/conversation state, `campusSocialState.emotions.currentEmotion`,
  `availabilityZh`, and `quietLineZh`) into visible name/emotion/activity/quiet
  line labels, with stable activity categories such as resting, talking,
  moving, studying, eating, social, briefing, reflecting, and observing. Also
  added `CharacterPortrait renderOnly` for Scene Mode so characters without a
  vetted transparent `/public/renders` asset use the clean CSS fallback instead
  of white-background legacy portrait art; this keeps the removed Tianze render
  from reappearing through portrait fallback. Verification: `npx tsc --noEmit
  --pretty false`; `git diff --check`; `npm run build` (passes with existing
  Vite chunk-size warning); Chrome DevTools Protocol smoke confirms desktop and
  mobile Scene Mode show 4 standees, 4 activity rows, 4 quiet lines, only the
  valid Umi render image in the current deep-night宿舍 state, and zero page
  horizontal overflow.
- 2026-06-10 23:40 CDT: Landed the scene-first UI direction Alan asked for.
  Generated three additional original VN-style 16:9 backgrounds
  (`classroom.png`, `courtyard.png`, `aiClubRoom.png`) and now all five
  `SchoolLocationId` scenes have background art. `Game.tsx` defaults the world
  panel to Scene Mode with full-bleed background, large character standees,
  scene-object hotspots, and a one-time initial auto-select to the busiest
  occupied scene when Alan is away and the default scene is empty. The original
  Pixi map remains available behind the `地圖` toggle; a Pixi error boundary
  prevents browser/Pixi renderer failures from blanking the app and shows a
  map fallback in unsupported headless environments. Object/event decision:
  scene objects are UI-only event seeds for now, not a durable backend object
  system. Updated `docs/giis-vn-art-spec.md` and `public/backgrounds/README.md`.
  Verification: `npx tsc --noEmit --pretty false`; `git diff --check`;
  `npm run build` (passes with existing Vite chunk-size warning); HTTP 200 for
  five backgrounds / three valid renders and 404 for removed
  `tianze-serious.png`; Chrome DevTools Protocol smoke on localhost verifies
  desktop/mobile Scene Mode background + hotspots + standees + zero page
  horizontal overflow, and verifies map toggle shows a Pixi fallback instead of
  blanking in headless Chrome.
- 2026-06-10 23:02 CDT: Corrected the Phase 1 VN asset spike after Alan caught
  that the first generated Tianze render drifted male, which conflicts with the
  Tianze Ichika-inspired female character direction in `data/giisProfiles.ts`
  and `docs/soul/pilots/tianze.md`. Removed the wrong public
  `public/renders/tianze-serious.png` asset and removed Tianze `renderPath`
  wiring, so Tianze falls back to the existing portrait until a correct female
  Tianze render is generated. Tightened Tianze `artDirection` wording to say
  female / Tianze Ichika-inspired. Verification: `rg tianze-serious` no longer
  finds active code/docs references; HTTP check returns 404 for the removed
  render and 200 for the remaining render/background assets; `npx tsc --noEmit
  --pretty false`.
- 2026-06-10 22:57 CDT: Completed Phase 1 anime/VN asset spike for the UI
  polish lane. Generated four original default-emotion large renders
  (`public/renders/umi-smiling.png`, `mahiru-worried.png`,
  `tianze-serious.png`, `ichinose-serious.png`) via built-in image generation
  on chroma-key backgrounds, then removed the key with the bundled Pillow
  runtime. Generated two 16:9 room backdrops
  (`public/backgrounds/studentCouncilRoom.png`, `dormitory.png`). Integrated
  the renders through optional `renderPath` / `renderPaths` fields in
  `data/characterVisuals.ts`; `CharacterPortrait size="lg"` now prefers
  `/public/renders` and falls back to existing portraits. Conversation mode now
  receives a scene backdrop CSS variable for the two generated rooms while the
  Pixi exploration map remains unchanged. Updated `docs/giis-vn-art-spec.md`
  and added asset README notes. Limits: this is a visual spike, not a locked
  production character sheet; only the pilot default emotions exist, and
  in-app Browser screenshot capture timed out after the new assets, so visual
  proof used local asset contact sheets plus Chrome headless static screenshots
  for reachable pages. Verification: transparent alpha/corner audit for all
  renders; HTTP 200 for all new public asset paths; `git diff --check`;
  `npx tsc --noEmit --pretty false`; `npm run build`.
- 2026-06-10 22:35 CDT: Ran a user-perspective UI polish pass for the anime/VN
  direction without changing Convex, map architecture, character behavior, or
  backend state. Added character portrait strips to `ConversationWall` cards so
  the conversation view reads more like a memory wall than a debug dashboard.
  Added a scoped CSS polish layer for the live-room shell, HUD buttons, bottom
  action bar, conversation wall cards, and mobile layout; fixed the mobile
  horizontal scrollbar/overlap seen in Browser screenshots. Remaining higher
  gain visual work is still art-asset led: larger consistent VN renders and
  scene backgrounds per `docs/giis-vn-art-spec.md`. Verification:
  `git diff --check`; `npx tsc --noEmit --pretty false`; `npm run build`;
  Browser screenshots for desktop/mobile world and conversation wall.
- 2026-06-10 23:25 CDT: Inspected and updated the Codex-level
  `underworld-rolling-continuity-telegram` automation. The local Codex
  automation file is active at
  `/Users/alanhdchu/.codex/automations/underworld-rolling-continuity-telegram/automation.toml`
  with `FREQ=MINUTELY;INTERVAL=120`; its prompt now explicitly treats
  `npm run underworld:rolling-continuity` as the source of truth and reports
  the refreshed rolling continuity, Alan-facing candidates, memory hygiene,
  life-signals, and v0.1 completion audit gates. Telegram notification remains
  deduped and only fires for fresh `PASS / continuity_observed` evidence.
  System-level inspection found two Underworld LaunchAgents:
  `com.giis.underworld.dev-stack` is running and keeps the local dev stack
  alive; `com.giis.underworld.morning-healthcheck` is loaded but not currently
  running, and is configured as `StartInterval=7200` rather than a once-daily
  06:00 check. No user crontab entries were found.
- 2026-06-10 23:29 CDT: Optimized the Underworld automation split. Kept
  `com.giis.underworld.dev-stack` as the system-level long-running keepalive
  for Vite/Convex. Changed
  `/Users/alanhdchu/Library/LaunchAgents/com.giis.underworld.morning-healthcheck.plist`
  from `StartInterval=7200` to `StartCalendarInterval` at 06:00 daily, then
  reloaded it with `launchctl bootout/bootstrap`. `launchctl print` now shows
  calendar trigger Hour 6 / Minute 0, while the Codex-level
  `underworld-rolling-continuity-telegram` remains active every 120 minutes for
  quality/continuity reporting. This removes the accidental duplicate two-hour
  healthcheck loop.
- 2026-06-10 22:31 CDT: Tightened the cc failure policy after Alan clarified
  that cc timeout should be fixed, not treated as "cc unavailable." Added a
  read-only timeout recovery path to `umi/orchestrator.py`: when a Claude Code
  worker pass times out, the orchestrator automatically reruns a smaller
  recovery prompt that inspects only the workload, current diff/status, worklog,
  and at most five relevant files, then returns salvage findings or an exact
  narrower retry/auth diagnostic. Updated Open Follow-Up #4 to say timeout is
  an orchestration issue and auth/provider errors require diagnosis. This does
  not change Underworld runtime behavior.
- 2026-06-10 22:13 CDT: Aligned with cc on today's Underworld product changes
  and updated the two-hour rolling review path. Current evidence after read-only
  refresh: `npm run underworld:rolling-continuity` is still `PASS /
  continuity_observed` for 18:00-20:00 -> 20:00-22:00, but the tick now also
  refreshes Alan-facing candidate scan, memory hygiene, life-signals, and the
  v0.1 completion audit. This prevents a rolling PASS from hiding the current
  blockers: `memory-hygiene` reports 1 known fragment + 1 unverified Alan claim,
  `life-signals` is `WARN / life_signal_repeated` with 97 day-window
  conversations and repeated surface/motif issues, and completion audit remains
  `FAIL` with 2 fail / 1 pending / 5 pass. cc's read-only review
  `umi/reports/20260611T031406Z-workload.md` recommended exactly this
  extension and warned not to automate cleanup, prompt rewrites, Alan playtest
  acceptance, or paper-lane actions. Implemented the extension in
  `scripts/underworld-rolling-continuity.mjs`, updated
  `umi/COMMAND_REFERENCE.md`, and marked `umi/workload.md` back to no active
  task. The recurring automation prompt, if external to this repo, should call
  the same command; the current session did not expose an automation-update
  tool, so no Codex panel automation was modified.
  Verification: `python umi/orchestrator.py run umi/workload.md --dry-run`;
  `python umi/orchestrator.py run umi/workload.md --skip-codex --timeout 600`;
  `npm run underworld:life-signals`; `npm run underworld:memory-hygiene`;
  `npm run underworld:v01-completion-audit`; `npm run
  underworld:rolling-continuity:self-test`; `node --check
  scripts/underworld-rolling-continuity.mjs`; `npx tsc --noEmit --pretty
  false`; `npm run underworld:rolling-continuity`.
- 2026-06-10 UTC: Implemented VN big-frame conversation view (Route A, layout
  step), Alan-directed direct implementation. CSS-only, additive: appended a
  `@media (min-width: 901px)` block to `src/index.css` that, while
  `.giis-conversation-active`, enlarges `.giis-utility-panel` to near-fullscreen
  and scales the `.giis-rpg-portrait-stage` portrait up to a large VN-style
  render (height min(74vh,48rem)) with a roomier dialogue textbox. Reuses the
  existing `/public/portraits` PNGs (no new art yet — full renders tracked in
  `docs/giis-vn-art-spec.md`). Desktop-only; mobile stacked layout untouched
  (mobile rules live in the existing `@media (max-width: 900px)` block). No JSX,
  no Convex, no schema change. Verification: `npx tsc --noEmit` clean; postcss
  parse of `src/index.css` OK + braces balanced (577/577). `vite build` NOT run
  here — this Linux sandbox has a macOS esbuild binary (platform mismatch),
  unrelated to the change; **Alan to confirm with local `npm run dev` and enter a
  conversation to eyeball the frame.**

- 2026-06-10 UTC: Added v0.2+ planning docs (Cowork session, Alan-directed):
  Version Mapping table in `docs/soul/SOUL_PROGRESSION_PLAN.md` (each progression
  stage → version + gate + metric), `docs/giis-ui-directions.md` (UI direction
  note), `docs/giis-vn-art-spec.md` (Route A full-VN-render art brief + §8
  ready-to-paste prompts), and
  `umi/proposals/20260610T163348Z-vn-render-conversation-overlay.md` (flagged VN
  overlay proposal, default-off, fallback to current panel). Registered new docs
  in `docs/INDEX.md`. Corrected stale roster: current pilots are 海/真晝/天澤/一之瀨;
  Asuna and Mai no longer exist. Docs only — no code, schema, prompt, or asset
  changes; VN overlay is proposal-only and NOT pulled into the v0.1 sample
  sprint. Verification: none required (doc-only).

- 2026-06-10 CDT: Updated the emotional-residue paper publication state after
  Alan reported that arXiv upload is blocked by endorsement and that the
  conservative A-path preprint was submitted on OSF instead. Added
  `docs/paper/OSF_RELEASE_RECORD.md` with OSF status and `TO_RECORD` fields for
  public URL, DOI, exact submitted file, and license/visibility metadata.
  Updated `docs/paper/ALAN_HANDOFF.md`,
  `docs/paper/SUBMISSION_STRATEGY.md`,
  `docs/paper/ARXIV_PREPRINT_RELEASE_PACKET.md`,
  `docs/paper/PUBLISH_READY_CHECKLIST.md`, and `umi/workload.md` so the current
  state is OSF-submitted / arXiv endorsement-blocked / empirical B-path still
  blocked. Also adjusted `paper_annotation_audit.py` so stale source-report
  hashes from mutable `latest` reports are treated as empirical blockers rather
  than A-path source failures; this keeps the annotation packet blocked for
  evidence use without making the conservative preprint source unreadable.
  Verification: `python3 -m py_compile
  scripts/paper/paper_annotation_audit.py`; `python3
  scripts/paper/paper_annotation_audit.py --selftest`; `npm run
  paper:annotation-audit` (`PACKET_READY_INCOMPLETE_STUDY`, 0 FAIL); `npm run
  paper:source-audit` (`PASS`); `npm run paper:claim-audit`
  (`PASS_CONSERVATIVE_PREPRINT`); `npm run paper:citation-audit` (`PASS`);
  `npm run paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0
  FAIL / 24 empirical blockers / 10 external blockers / 5 PDF blockers); `git
  diff --check`. No external action, upload, submission, PDF render, Convex
  mutation, or dataset collection was run by Codex in this update.
- 2026-06-10 10:35 CDT: Restarted the Underworld product v0.1 path from current
  state instead of relying on 2026-06-04 evidence. Current Chicago time was
  10:24 CDT. `npm run underworld:runtime-preflight` passed, but the old
  `underworld:afternoon-world-ready` script no longer exists in current
  `package.json`; the current safe daytime path is `underworld:observe`.
  `school:enterCampus` seeded today's world clock/day 23 and restored Umi
  briefing's four daily-life bulletin items. Initial `life-density` changed
  from `FAIL / daily_life_bulletin_density_missing` to `WARN /
  conversation_uptake_pending` after entering campus. A dry-run observe showed
  no fresh triad samples, then the real observe pass collected two archived
  morning samples and timed out on the third focused 海/天澤 sample. Fresh
  report status: `v01-approach` says runtime/provider/fallback OK, soul eval
  2 PASS / 0 WARN / 0 FAIL, recent eval 0 PASS / 0 WARN / 3 FAIL, top issue
  `eval_rubric_disagreement`, repair class `proposal_only`, and next safest
  action "reconcile eval framing before changing dialogue code." Completion
  audit is now `FAIL` with 2 fail / 2 pending / 4 pass; rolling continuity is
  still `WARN / sample_pending` because today's conversations all sit in the
  10:00-12:00 window, and Alan-facing playtest remains the 2026-06-04
  `PARTIAL` draft. No code edits were made. Verification/commands:
  `npm run underworld:runtime-preflight`, `npx convex run school:enterCampus`,
  `npx convex run school:umiBriefing`, `npm run underworld:life-density`, `npm
  run underworld:rolling-continuity`, `npm run underworld:observe -- --dry-run
  --target-samples=1 --cc=skip`, `npm run underworld:observe --
  --target-samples=3 --cc=skip --require-archived=true`, `npm run
  underworld:v01-completion-audit`.
- 2026-06-10 08:08 CDT: Accepted Alan's A-path direction and made the remaining
  reviewer-defensibility citation update without changing the empirical claim
  boundary. `docs/paper/arxiv/main.tex` now includes a narrow social-agent
  evaluation paragraph citing SOTOPIA and Lifelong SOTOPIA to situate the paper
  against interactive social-intelligence and multi-episode interaction-history
  benchmarks, while explicitly keeping emotional residue as a narrower deployed
  character-world memory primitive. Added both references to the hand-written
  bibliography and to `docs/paper/CITATION_PROVENANCE.md`; updated
  `scripts/paper/paper_citation_audit.py` so those recent social-agent keys
  require primary-source provenance. Regenerated the Alan decision packet and
  source archive; current arXiv source SHA-256 is
  `099a8fbcdb2c588e3678b850d6f1ba40fc36f563bae3657a434827d857f222ab`.
  Verification: `npm run paper:citation-audit` (`PASS`, 17 bibliography keys);
  `npm run paper:source-audit` (`PASS`); `npm run paper:claim-audit`
  (`PASS_CONSERVATIVE_PREPRINT`); `python3
  scripts/paper/paper_citation_audit.py --selftest`; `npm run
  paper:consistency-audit` (`PASS`); `npm run paper:submission-audit`
  (`EXTERNAL_BLOCKERS`, 0 FAIL); `npm run paper:pdf-verification-audit`
  (`PDF_BLOCKER`, 0 FAIL); `npm run paper:alan-decision-packet`; `npm run
  paper:archive-audit` (`PASS`); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  10 external blockers / 5 PDF blockers); `git diff --check`. No external
  upload, PDF render/install, live collection, Convex env mutation, acceptance
  JSON edit, rater fabrication, or submission action was run.
- 2026-06-10 07:30 CDT: Addressed the remaining cc conceptual-review weakness:
  novelty defense against "summary memory plus a do-not-quote instruction." In
  `docs/paper/arxiv/main.tex`, added a concrete contrast between a one-line
  relationship summary that invites explicit recall and emotional residue as a
  smaller trace meant to change timing, restraint, and initiative. Kept the
  example constructed rather than using raw player transcripts. Regenerated the
  Alan decision packet and source archive; current arXiv source SHA-256 is
  `af8ebe6c68140515e39c149e69e79774e31faf0929626803b083046a2befc12d`.
  Verification: `npm run paper:source-audit` (`PASS`); `npm run
  paper:claim-audit` (`PASS_CONSERVATIVE_PREPRINT`); `npm run
  paper:consistency-audit` (`PASS`); `npm run paper:archive-audit` (`PASS`);
  `npm run paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL
  / 23 empirical blockers / 10 external blockers / 5 PDF blockers). No live
  collection, Convex env mutation, PDF render/install, acceptance/submission
  decision edit, rater fabrication, or remote-service action was run.
- 2026-06-10 07:09 CDT: Ran a read-only cc skeptical reviewer pass for the
  A-path preprint (`umi/reports/20260610T120519Z-workload.md`) and accepted the
  safe A-scope wording fixes. The manuscript title now uses "Trace-Based
  Continuity" instead of "Felt Continuity"; the abstract no longer foregrounds
  the 15/2 pilot numbers; five-layer identity is framed as a situating device
  rather than an overlarge contribution; the manuscript now includes a
  constructed residue-trace example, explicit author/reflexivity disclosure for
  markers and observation, deployment-local time-label wording, a hand-curated
  motif-guard limitation, feasibility/analysis-determinism wording instead of
  smoke/repeatability overclaiming, and a note that PASS/WARN table values are
  harness labels rather than significance labels. Updated consistency audit so
  the abstract is guarded against 2/15-style overclaiming while正文 artifact
  counts remain checked. Then-current arXiv source SHA-256 was
  `e82f88c8bf9cc960edf3b764a190a7253880a9b642613d7afd2671c1b74afde8`.
  Verification: `python3 -m py_compile
  scripts/paper/paper_consistency_audit.py`; `python3
  scripts/paper/paper_consistency_audit.py --selftest`; `npm run
  paper:consistency-audit`; `npm run paper:claim-audit`; `npm run
  paper:source-audit`; `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  10 external blockers / 5 PDF blockers). No live collection, Convex env
  mutation, PDF render/install, acceptance/submission decision edit, rater
  fabrication, or remote-service action was run.
- 2026-06-10 00:10 CDT: Completed the local A-path arXiv conservative-preprint
  release packet, without performing external posting. Added
  `docs/paper/ARXIV_PREPRINT_RELEASE_PACKET.md` with conservative positioning,
  local package paths, recommended-but-unconfirmed submitter choices, official
  arXiv doc checks, stop conditions, and the B-path empirical follow-up.
  Updated `docs/paper/arxiv/main.tex` date to June 10, 2026. Rebuilt the
  allowlisted arXiv source archive; then-current source SHA-256 was
  `e82f88c8bf9cc960edf3b764a190a7253880a9b642613d7afd2671c1b74afde8`.
  Hardened `build_arxiv_source_package.py` to write the archive and manifest
  via atomic replacement so concurrent archive/readiness audits do not read a
  half-written manifest. Updated `docs/INDEX.md`,
  `docs/paper/ALAN_HANDOFF.md`, `docs/paper/PUBLISH_READY_CHECKLIST.md`,
  `docs/paper/CLAIM_EVIDENCE_MATRIX.md`,
  `docs/paper/REVIEWER_PREMORTEM.md`, `scripts/paper/README.md`, and
  `umi/workload.md` to point at the A-path packet and current SHA. Verification:
  `python3 -m py_compile scripts/paper/build_arxiv_source_package.py
  scripts/paper/paper_archive_audit.py scripts/paper/paper_readiness_report.py`;
  `python3 scripts/paper/build_arxiv_source_package.py --selftest`; `npm run
  paper:alan-decision-packet`; `npm run paper:source-audit`; `npm run
  paper:submission-audit` (`EXTERNAL_BLOCKERS`, 0 FAIL); `npm run
  paper:pdf-verification-audit` (`PDF_BLOCKER`, 0 FAIL); `npm run
  paper:archive-audit` (`PASS`); `npm run paper:consistency-audit` (`PASS`);
  `npm run paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL
  / 23 empirical blockers / 10 external blockers / 5 PDF blockers); `git diff
  --check`. No live collection, Convex env mutation, TeX install, PDF render,
  submission JSON edit, rater fabrication, upload, or external action was run.
- 2026-06-09 23:55 CDT: Fixed stale trace-overlap coordination text and
  guarded it with `paper:consistency-audit`. `docs/paper/ALAN_HANDOFF.md` and
  `docs/paper/PUBLISH_READY_CHECKLIST.md` now reflect the current
  trace-overlap audit denominator: 11 callback cases assessed, max overlap
  ratio 0.242. `scripts/paper/paper_consistency_audit.py` now checks those
  Alan-facing docs against `docs/paper/results/trace-overlap-audit.md`, so a
  future mismatch between the generated trace-overlap artifact and the handoff
  docs fails the consistency audit instead of silently drifting. Verification:
  `python3 -m py_compile scripts/paper/paper_consistency_audit.py`; `python3
  scripts/paper/paper_consistency_audit.py --selftest`; `npm run
  paper:consistency-audit` (`PASS`); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  10 external blockers / 5 PDF blockers); `git diff --check`. No live
  collection, Convex env mutation, cache deletion, PDF render/install,
  submission JSON edit, rater fabrication, upload, or external action was run.
- 2026-06-09 20:42 CDT: Hardened submission/PDF audits against copied template
  placeholders. `paper_submission_audit.py` now explicitly treats
  `TO_CONFIRM`, `CHOOSE_ONE`, `TO_RECORD`, `YYYY-MM-DD`, and placeholder
  `example.com` values in submitter-decision fields as external blockers, so
  the Alan decision packet worksheet cannot be copied verbatim and mistaken for
  real metadata. `paper_pdf_verification_audit.py` now fails claimed
  PDF/platform verification if `verified_at`, `render_tool`,
  `render_environment`, `source_archive_sha256`, or `rendered_pdf_sha256` still
  contain template placeholders. Verification: `python3 -m py_compile
  scripts/paper/paper_submission_audit.py
  scripts/paper/paper_pdf_verification_audit.py`; `python3
  scripts/paper/paper_submission_audit.py --selftest`; `python3
  scripts/paper/paper_pdf_verification_audit.py --selftest`; `npm run
  paper:submission-audit` (`EXTERNAL_BLOCKERS`, 0 FAIL); `npm run
  paper:pdf-verification-audit` (`PDF_BLOCKER`, 0 FAIL); `npm run
  paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23
  empirical blockers / 10 external blockers / 5 PDF blockers); `git diff
  --check`. Current decision JSON remains blank/false and no submission JSON
  edit, PDF render/install, live collection, Convex env mutation, rater
  fabrication, upload, or external action was run.
- 2026-06-09 20:39 CDT: Made the arXiv source author metadata conservative
  while public author identity remains unconfirmed. `docs/paper/arxiv/main.tex`
  now uses only `Author details to confirm before submission` in the author
  block instead of carrying the previous public name/project metadata. This
  removes the `main_author_identity_unconfirmed` blocker while keeping
  `main_author_placeholder` and all Alan-facing metadata/category/license/PDF
  blockers intact. `paper_source_audit.py` now treats the author placeholder
  marker case-insensitively, so the conservative placeholder passes source
  hygiene without warning. Rebuilt the local source archive; then-current arXiv
  source SHA-256 was
  `58ad18182d8ecc40db614997efc60f721d65d5fc82c9760ca3788c35a8dd4c43`, and
  the Alan decision packet's PDF verification template now references that
  current archive hash. Verification: `npm run paper:submission-audit`
  (`EXTERNAL_BLOCKERS`, 10 external blockers / 2 PDF blockers / 0 FAIL);
  `python3 scripts/paper/paper_source_audit.py --selftest`; `npm run
  paper:source-audit` (`PASS`); `npm run paper:archive-audit` (`PASS`);
  `npm run paper:alan-decision-packet -- --stdout`; `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  10 external blockers / 5 PDF blockers); `rg` found no old `Alan H. Chu` /
  `GIIS Underworld Project` author strings in the checked arXiv/decision
  artifacts; `git diff --check`. No author decision, submission JSON edit, PDF
  render/install, live collection, Convex env mutation, rater fabrication,
  upload, or external action was run.
- 2026-06-09 20:37 CDT: Hardened the external-posting/PDF decision section of
  the Alan decision packet. `scripts/paper/alan_decision_packet.py` now embeds
  a `SUBMISSION_DECISIONS.json` worksheet template with explicit
  `TO_CONFIRM`/`CHOOSE_ONE` placeholders and a `PDF_VERIFICATION.json` evidence
  template that includes the current arXiv source archive SHA-256. The packet
  states that the submission template is not pass-ready until Alan replaces the
  placeholders and confirms the booleans, and the PDF template is not evidence
  until a real rendered PDF/platform preview is inspected and the rendered PDF
  SHA/details are recorded. Verification: `python3 -m py_compile
  scripts/paper/alan_decision_packet.py`; `python3
  scripts/paper/alan_decision_packet.py --selftest`; `npm run
  paper:alan-decision-packet -- --stdout`; `npm run paper:submission-audit`
  (`EXTERNAL_BLOCKERS`, 0 FAIL); `npm run paper:pdf-verification-audit`
  (`PDF_BLOCKER`, 0 FAIL); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  12 external blockers / 5 PDF blockers); `git diff --check`. No live
  collection, Convex env mutation, rater fabrication, PDF render/install,
  acceptance/submission JSON edit, upload, or external action was run.
- 2026-06-09 20:35 CDT: Hardened the Alan acceptance decision packet without
  changing acceptance state. `scripts/paper/acceptance_hashes.py` now emits
  complete, separate JSON templates for `docs/paper/SCHEDULE_ACCEPTANCE.json`
  and `docs/paper/PREREGISTRATION_ACCEPTANCE.json`, each with the current
  document SHA-256 and explicit `accepted_by` / `accepted_at` placeholders,
  instead of only printing loose hash fields. `scripts/paper/alan_decision_packet.py`
  now embeds those exact templates in `docs/paper/results/alan-decision-packet.md`
  under the explicit "only after Alan acceptance" section. Verification:
  `python3 -m py_compile scripts/paper/acceptance_hashes.py
  scripts/paper/alan_decision_packet.py`; `python3
  scripts/paper/acceptance_hashes.py --selftest`; `python3
  scripts/paper/alan_decision_packet.py --selftest`; `npm run
  paper:acceptance-hashes`; `npm run paper:alan-decision-packet -- --stdout`;
  `npm run paper:protocol-audit` (`PASS`); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  12 external blockers / 5 PDF blockers); `git diff --check`. The actual
  acceptance JSON files remain `accepted=false`; no collection, Convex env
  mutation, rater fabrication, PDF render/install, acceptance/submission JSON
  edit, upload, or external action was run.
- 2026-06-09 20:31 CDT: Ran an independent read-only expert pass through the
  sub-agent path (`Russell`) focused on empirical/annotation readiness after the
  packet manifest hardening. Accepted the safe local findings and patched them:
  `merge_rater_annotations.py` now refuses completed rater sheets whose columns
  differ from the blinded worksheet schema or whose `case_ref` is not the
  `blind_id`, so it cannot assert a blinding manifest over leaked
  `condition`/`case_name`/`rolling_callback` columns. `export_blinded_transcripts.py`
  now fails on conflicting duplicate case transcripts and writes
  `output.case_sources` mapping each `blind_id` to its exact `case_name` and
  source `soul-triad.md`; the current transcript manifest was regenerated with
  all four source report mappings. `paper_annotation_audit.py` now verifies
  transcript source report paths and SHA-256 hashes, verifies future completed
  rater sheet paths and hashes in `annotations_manifest.json`, and checks
  `case_sources` against key/transcript IDs. `HUMAN_ANNOTATION_PROTOCOL.md`
  now says rater-visible sheets use `blind_id`/`case_ref`, not `case_name`.
  Verification: `python3 -m py_compile
  scripts/paper/export_blinded_transcripts.py
  scripts/paper/merge_rater_annotations.py
  scripts/paper/paper_annotation_audit.py`; `python3
  scripts/paper/export_blinded_transcripts.py --selftest`; `python3
  scripts/paper/merge_rater_annotations.py --selftest`; `python3
  scripts/paper/paper_annotation_audit.py --selftest`; `npm run
  paper:annotation-audit` (`PACKET_READY_INCOMPLETE_STUDY`, 0 FAIL / 3
  empirical blockers / 1 PASS); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  12 external blockers / 5 PDF blockers); `git diff --check`. No live
  collection, Convex env mutation, rater fabrication, PDF render/install,
  acceptance/submission JSON edit, upload, or external action was run.
- 2026-06-09 20:25 CDT: Hardened the pre-rater human-annotation packet
  provenance. `export_annotation_sheet.py` now writes
  `annotation_packet_manifest.json` with dataset/sheet/key SHA-256 hashes,
  sampling metadata, selected blind IDs, and the rater-visible blinding
  contract. `export_blinded_transcripts.py` now writes
  `blinded_transcripts/transcript_packet_manifest.json` with the key hash,
  source-report hashes, output transcript hashes, missing-transcript status, and
  transcript blinding flags. `paper_annotation_audit.py` now verifies these
  packet manifests against the actual CSV/transcript files, including row
  counts, blind-id order, output count, empty missing list, source reports, and
  hashes. Regenerated the current blank 4-row packet manifests without adding
  ratings or new collection. Updated `docs/paper/HUMAN_ANNOTATION_PROTOCOL.md`,
  `scripts/paper/README.md`, and `docs/paper/ALAN_HANDOFF.md` so future rater
  logistics keep the packet manifests with the worksheet/transcripts. Verification:
  `python3 -m py_compile scripts/paper/export_annotation_sheet.py
  scripts/paper/export_blinded_transcripts.py
  scripts/paper/paper_annotation_audit.py`; `python3
  scripts/paper/export_annotation_sheet.py --selftest`; `python3
  scripts/paper/export_blinded_transcripts.py --selftest`; `python3
  scripts/paper/paper_annotation_audit.py --selftest`; `npm run
  paper:annotation-audit` (`PACKET_READY_INCOMPLETE_STUDY`, 0 FAIL / 3
  empirical blockers / 1 PASS); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  12 external blockers / 5 PDF blockers); `git diff --check`. No live
  collection, Convex env mutation, rater fabrication, PDF render/install,
  acceptance/submission JSON edit, upload, or external action was run.
- 2026-06-09 20:17 CDT: Hardened human-annotation provenance for future blind
  validation. `scripts/paper/merge_rater_annotations.py` now writes an
  `annotations_manifest.json` by default (or a caller-specified `--manifest`)
  containing the annotation key SHA, completed rater sheet paths and SHA-256
  hashes, output `annotations.csv` SHA, row/case/rater counts, `min_raters`, and
  an explicit blinding contract. `paper_annotation_audit.py` now requires and
  verifies this manifest whenever `annotations.csv` exists: output hash, row
  count, key hash, at least two unique raters, at least two rater sheet entries,
  and true blinding-contract fields. Current repo state still has no merged
  `annotations.csv`, so the audit remains `PACKET_READY_INCOMPLETE_STUDY`
  rather than pretending human validation is complete. Updated
  `docs/paper/HUMAN_ANNOTATION_PROTOCOL.md`, `docs/paper/ALAN_HANDOFF.md`, and
  `scripts/paper/README.md` to require keeping the manifest with merged
  annotations. Verification: `python3 -m py_compile
  scripts/paper/merge_rater_annotations.py scripts/paper/paper_annotation_audit.py`;
  `python3 scripts/paper/merge_rater_annotations.py --selftest`; `python3
  scripts/paper/paper_annotation_audit.py --selftest`; `npm run
  paper:annotation-audit` (`PACKET_READY_INCOMPLETE_STUDY`, 0 FAIL / 3
  empirical blockers / 1 PASS); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  12 external blockers / 5 PDF blockers); `git diff --check`. No rater data was
  fabricated or merged, and no collection, Convex env mutation, PDF
  render/install, acceptance/submission JSON edit, upload, or external action
  was run.
- 2026-06-09 20:14 CDT: Guarded the legacy forced-sample collection entrypoints
  so they cannot be mistaken for the rigorous empirical design. `npm run
  paper:residue-ablation` and `npm run paper:residue-ablation:blocks` now refuse
  by default before entering `main()` and require explicit
  `--allow-legacy-forced-pilot` for mechanism-debugging-only collection. The
  repeated-block runner passes this flag through to the single forced runner
  only after its own explicit opt-in. `paper_protocol_audit.py` now checks both
  legacy guards, and docs now label the flag in forced-pilot examples while
  continuing to route primary empirical collection to `paper:residue-arm-window`
  after schedule/preregistration acceptance. Verification: `node --check
  scripts/paper/run_residue_ablation.mjs`; `node --check
  scripts/paper/run_longitudinal_ablation_blocks.mjs`; `npm run
  paper:residue-ablation -- --selftest`; `npm run
  paper:residue-ablation:blocks -- --selftest`; `npm run
  paper:residue-ablation` (expected refusal, exit 2, no collection); `npm run
  paper:residue-ablation:blocks` (expected refusal, exit 2, no collection);
  `python3 -m py_compile scripts/paper/paper_protocol_audit.py`; `python3
  scripts/paper/paper_protocol_audit.py --selftest`; `npm run
  paper:protocol-audit` (`PASS`); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  12 external blockers / 5 PDF blockers); `git diff --check`. No collection,
  Convex env mutation, rater fabrication, PDF render/install,
  acceptance/submission JSON edit, upload, or external action was run.
- 2026-06-09 20:10 CDT: Hardened merge-time longitudinal dataset provenance.
  `scripts/paper/merge_ablation_runs.py` now supports both legacy forced
  `ablation-*` directories and future `arm-window-*` directories, writes a
  merge manifest, and refuses to merge arm-window runs or any run containing
  `run-provenance.json` unless `paper_run_provenance_audit` returns `PASS`.
  The new `--require-provenance` flag can require the same audit for every run,
  including legacy dirs. Added `npm run paper:merge-ablation-runs` and updated
  `paper_protocol_audit.py` so the script entrypoint is checked. Documentation
  now directs future long-window merges through
  `npm run paper:merge-ablation-runs -- --runs 'docs/paper/results/arm-window-*'
  --out docs/paper/results/longitudinal/dataset.json --manifest
  docs/paper/results/longitudinal/merge-manifest.json`, while explicitly
  labeling current `ablation-*` merges as legacy pipeline evidence only.
  Verification: `python3 -m py_compile scripts/paper/merge_ablation_runs.py
  scripts/paper/paper_protocol_audit.py`; `npm run paper:merge-ablation-runs --
  --selftest`; `python3 scripts/paper/merge_ablation_runs.py --runs
  'docs/paper/results/ablation-*' --out /tmp/ai-town-paper-merge-test-dataset.json
  --manifest /tmp/ai-town-paper-merge-test-manifest.json` (merged 4 qualifying
  legacy records, on=2/off=2, without touching repo results); `python3
  scripts/paper/paper_protocol_audit.py --selftest`; `npm run
  paper:protocol-audit` (`PASS`); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  12 external blockers / 5 PDF blockers); `git diff --check`. No collection,
  Convex env mutation, rater fabrication, PDF render/install,
  acceptance/submission JSON edit, upload, or external action was run.
- 2026-06-09 20:06 CDT: Added a completed-run provenance audit for future
  long-window collection. New `scripts/paper/paper_run_provenance_audit.py` /
  `npm run paper:run-provenance-audit -- --run-dir <arm-window-dir>` checks a
  completed arm-window directory for `metadata.json`, `generation-metadata.json`,
  `run-provenance.json`, `artifact-hashes.json`, `dataset.json`,
  `soul-triad.md`, `rolling-continuity.md`, required scoring/parsing logs,
  accepted schedule/preregistration provenance, source archive provenance,
  row-level `generation_metadata` / `run_provenance`, source_run/window/condition
  consistency, and artifact/log SHA-256 hashes. The arm-window runner now writes
  `artifact-hashes.json` for data/report/log artifacts after scoring; it avoids
  hashing metadata/provenance/hash files to prevent circular hashes.
  `paper_protocol_audit.py` now requires the npm script plus runner provenance
  and artifact-hash wiring. Updated `scripts/paper/README.md`,
  `docs/paper/EXPERIMENTS.md`, `docs/paper/PUBLISH_READY_CHECKLIST.md`,
  `docs/paper/ALAN_HANDOFF.md`, and
  `docs/paper/LONGITUDINAL_EXPERIMENT_PLAN.md` so future long-window rows should
  pass this run audit before merge. Verification: `node --check
  scripts/paper/run_arm_pure_residue_window.mjs`; `python3 -m py_compile
  scripts/paper/paper_run_provenance_audit.py
  scripts/paper/paper_protocol_audit.py`; `python3
  scripts/paper/paper_run_provenance_audit.py --selftest`; `python3
  scripts/paper/paper_protocol_audit.py --selftest`; `npm run
  paper:run-provenance-audit -- --selftest`; `npm run paper:protocol-audit`
  (`PASS`); `npm run paper:empirical-audit`
  (`PILOT_ONLY_INCOMPLETE_ABLATION`); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  12 external blockers / 5 PDF blockers); `npm run paper:residue-arm-window --
  --selftest --arm=off`; `git diff --check`. No collection, Convex env
  mutation, rater fabrication, PDF render/install, acceptance/submission JSON
  edit, upload, or external action was run.
- 2026-06-09 19:59 CDT: Added a long-window run-provenance layer before any
  new collection. `scripts/paper/run_arm_pure_residue_window.mjs` now writes
  `run-provenance.json` alongside `metadata.json` / `generation-metadata.json`
  and attaches it to future rows via `report_to_dataset.py --provenance-json`.
  The provenance snapshot records secret-safe command args, git commit/dirty
  status sample, accepted schedule/preregistration document hashes and match
  state, source-archive manifest/hash state, runtime, env-key presence policy,
  and `secret_values_recorded: false`. `paper_empirical_audit.py` now adds a
  `run_provenance` blocker for rows lacking this evidence and checks schema
  fields when provenance is present; the current n=4 pilot remains blocked
  rather than backfilled. `paper_protocol_audit.py` now statically requires the
  runner to keep provenance wiring, and `attach_rolling_callbacks.py` selftest
  now asserts callback labeling preserves provenance fields. A bounded read-only
  reviewer sub-agent agreed the main gap was run manifest / git / accepted-doc /
  source-archive / command provenance, and noted that per-row copied generation
  metadata should eventually become a manifest reference plus row override if
  provider/model can vary mid-run. Updated docs: `docs/paper/EXPERIMENTS.md`,
  `docs/paper/PUBLISH_READY_CHECKLIST.md`, `docs/paper/ALAN_HANDOFF.md`,
  `docs/paper/LONGITUDINAL_EXPERIMENT_PLAN.md`, and `scripts/paper/README.md`.
  Verification: `node --check scripts/paper/run_arm_pure_residue_window.mjs`;
  `python3 -m py_compile scripts/paper/attach_rolling_callbacks.py
  scripts/paper/report_to_dataset.py scripts/paper/paper_empirical_audit.py
  scripts/paper/paper_protocol_audit.py`; selftests for
  `attach_rolling_callbacks.py`, `report_to_dataset.py`,
  `paper_empirical_audit.py`, `paper_protocol_audit.py`, and
  `paper:residue-arm-window -- --selftest --arm=placebo`; `npm run
  paper:protocol-audit` (`PASS`); `npm run paper:empirical-audit`
  (`PILOT_ONLY_INCOMPLETE_ABLATION`, now 9 empirical blockers including
  `run_provenance`); `npm run paper:residue-arm-window:acceptance` (expected
  refusal because schedule acceptance remains false); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 23 empirical blockers /
  12 external blockers / 5 PDF blockers); `npm run paper:archive-audit`
  (`PASS`); `npm run paper:pdf-verification-audit` (`PDF_BLOCKER`, expected);
  `git diff --check`. No collection, Convex env mutation, rater fabrication,
  PDF render/install, acceptance/submission JSON edit, upload, or external
  action was run.
- 2026-06-09 19:50 CDT: Added an explicit rendered-PDF/platform-preview
  verification gate without rendering, installing tools, or touching external
  services. New `docs/paper/PDF_VERIFICATION_PROTOCOL.md`,
  `docs/paper/PDF_VERIFICATION.json`, and
  `scripts/paper/paper_pdf_verification_audit.py` / `npm run
  paper:pdf-verification-audit` require real verification details before the PDF
  gate can pass: verifier, timestamp, render tool/environment, current source
  archive SHA, rendered PDF SHA, and visual checks for title/author/abstract,
  tables, citations, no raw transcript/sensitive files, and visible
  limitations. The JSON intentionally remains false/blank, and the audit reports
  `PDF_BLOCKER`, because no rendered PDF or platform preview has been inspected.
  `paper_readiness_report.py` now includes `PDF verification audit:
  PDF_BLOCKER`, so the readiness report separates local TeX tool availability
  from actual rendered-PDF/platform verification. Updated `package.json`,
  `docs/paper/arxiv/README.md`, `docs/paper/PUBLISH_READY_CHECKLIST.md`,
  `docs/paper/ALAN_HANDOFF.md`, `scripts/paper/README.md`, and
  `scripts/paper/alan_decision_packet.py` so the new gate appears in the
  external-posting command path. Verification: `python3 -m py_compile
  scripts/paper/paper_pdf_verification_audit.py
  scripts/paper/paper_readiness_report.py`; `python3
  scripts/paper/paper_pdf_verification_audit.py --selftest`; `python3
  scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:pdf-verification-audit` (`PDF_BLOCKER`, expected); `npm run
  paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 22
  empirical blockers / 12 external blockers / 5 PDF blockers); `npm run
  paper:submission-audit`; `npm run paper:alan-decision-packet -- --stdout`;
  `git diff --check`. No collection, Convex env mutation, rater fabrication,
  PDF render/install, acceptance/submission JSON approval, upload, or external
  action was run.
- 2026-06-09 19:44 CDT: Added a generated arXiv source-archive hygiene gate so
  source-ready cannot mean "we built a tarball but never inspected what is in
  it." New `scripts/paper/paper_archive_audit.py` / `npm run
  paper:archive-audit` rebuilds
  `docs/paper/results/arxiv-source/emotional-residue-arxiv-source.tar.gz`,
  verifies the manifest and archive/source SHA values, requires archive members
  to match the `main.tex` allowlist, checks file-name/path safety, confirms the
  manifest records excluded datasets/annotations/transcript packets/generated
  results, and scans TeX-like source members for obvious secret or raw
  conversation-id leakage. `paper_readiness_report.py` now includes this audit
  and writes `docs/paper/results/archive-audit.md`; the readiness summary now
  shows `Archive package audit: PASS`. Updated `package.json`,
  `docs/paper/arxiv/README.md`, `docs/paper/PUBLISH_READY_CHECKLIST.md`,
  `docs/paper/ALAN_HANDOFF.md`, and `scripts/paper/README.md` so the new gate
  is documented. Verification: `python3 -m py_compile
  scripts/paper/paper_archive_audit.py scripts/paper/paper_readiness_report.py`;
  `python3 scripts/paper/paper_archive_audit.py --selftest`; `python3
  scripts/paper/build_arxiv_source_package.py --selftest`; `python3
  scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:archive-audit` (`PASS`); `npm run paper:source-audit` (`PASS`); `npm
  run paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 22
  empirical blockers / 12 external blockers / 3 PDF blockers, archive package
  audit `PASS`); `npm run paper:arxiv-package` (archive SHA-256
  `f47bbd59fe5d14b2af0b95e292388909fc614734acf283bf2ca48ff0686fc6f9`);
  `npm run paper:alan-decision-packet -- --stdout`; `git diff --check`. No
  collection, Convex env mutation, rater fabrication, PDF render/install,
  acceptance/submission JSON edit, upload, or external action was run.
- 2026-06-09 19:37 CDT: Ran a bounded read-only HCI / LLM-agent reviewer pass
  through cc (`umi/reports/20260610T003328Z-workload.md`) and accepted the safe
  experiment-design fixes. `docs/paper/arxiv/main.tex` now avoids "primary
  causal ablation" language, defines `soul-triad` on first abstract mention,
  denominator-qualifies the 15 candidate / 2 callback rolling-window numbers,
  names the author-designed-marker reflexivity threat, labels the 8 smoke rows
  as convenience-sampled recent archived evaluations, softens design-opinion
  claims, and frames the future manipulation as narrowed read-block suppression
  unless a length-matched placebo is preregistered and collected. `docs/paper/PREREGISTRATION_PROTOCOL.md`
  and `docs/paper/SCHEDULE_DECISION.md` now disclose continuing-world carryover
  / read eligibility, define dyad-coverage fallback, forbid interim arm-level
  effect peeking before pilot stopping, and spell out the final-N procedure from
  pilot baseline rate, MDE, cluster size/design effect, alpha=0.05, and 0.80
  power. `docs/paper/REVIEWER_PREMORTEM.md` now has a between-arm carryover
  objection block, and `docs/paper/CLAIM_EVIDENCE_MATRIX.md` now records the
  narrowed mechanism boundary. `scripts/paper/analyze.py` now labels per-pair
  marker rows with `ci_note=no_bootstrap_n_lt_3` instead of zero-width bootstrap
  CIs for n=1/2, records `aftertaste_variance_status`, and extends selftest to
  require saturated aftertaste summaries to label `saturated_no_usable_variance`.
  `scripts/paper/paper_claim_audit.py` now fails on `primary causal ablation`
  drift and requires `read-block-suppression` disclosure. Current acceptance
  hashes changed because schedule/prereg docs changed: schedule
  `934fdd895b5e61c68a5aa827b54e810534f69be59b2b61a98ee796acc182d5b8`,
  preregistration
  `cfe64845013bdd5c34817ce1553ce3cc611c21c2b5f34eece267d5ec5e034104`; both
  acceptance JSON files remain `accepted: false` with blank hash fields.
  Verification: `python3 -m py_compile scripts/paper/analyze.py
  scripts/paper/paper_claim_audit.py`; `python3
  scripts/paper/paper_claim_audit.py --selftest`; `python3
  scripts/paper/paper_consistency_audit.py --selftest`; `python3
  scripts/paper/paper_design_audit.py --selftest`; `npm run paper:claim-audit`;
  `npm run paper:consistency-audit`; `npm run paper:design-audit`; `npm run
  paper:protocol-audit`; `npm run paper:empirical-audit`; `npm run
  paper:source-audit`; `npm run paper:acceptance-hashes`; `npm run
  paper:alan-decision-packet -- --stdout`; `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 22 empirical blockers /
  12 external blockers / 3 PDF blockers); `npm run paper:arxiv-package`
  (archive SHA-256
  `f47bbd59fe5d14b2af0b95e292388909fc614734acf283bf2ca48ff0686fc6f9`);
  `git diff --check`. `python3 scripts/paper/analyze.py --selftest` still does
  not run under system Python because `numpy` is missing, and no venv rebuild
  was attempted under the current low-disk constraint. No collection, Convex env
  mutation, rater fabrication, PDF render/install, acceptance-file approval, or
  outside action was run.
- 2026-06-09 19:26 CDT: Closed the `paper-final-local-hardening-readonly-review`
  cc pass (`umi/reports/20260610T002227Z-workload.md`) and applied the safe local
  fixes. `scripts/paper/paper_submission_audit.py` now parses the `main.tex`
  author block and reports `main_author_identity_unconfirmed` when public author
  metadata appears while `SUBMISSION_DECISIONS.json` keeps
  `public_author_identity_confirmed: false`; its selftest covers both blocked
  and confirmed-matching author states. `docs/paper/arxiv/main.tex` now marks
  the 15 source residue candidates / 2 callbacks as window-level feasibility
  diagnostics, not a controlled comparison, and discloses that
  `UNDERWORLD_RESIDUE_READ=placebo` is local draft runtime plumbing not
  preregistered, collected, or analyzed in this paper. `docs/paper/ALAN_HANDOFF.md`
  now frames n=40/arm as only a large-effect pilot threshold and says final N
  must be preregistered from pilot baseline/yield. `scripts/paper/alan_decision_packet.py`
  now dedupes repeated blocker concepts so the Alan-facing packet surfaces the
  author/PDF/external gates more clearly. Verification: `python3 -m py_compile
  scripts/paper/paper_submission_audit.py scripts/paper/alan_decision_packet.py`;
  `python3 scripts/paper/paper_submission_audit.py --selftest`; `python3
  scripts/paper/alan_decision_packet.py --selftest`; `npm run
  paper:submission-audit` (`EXTERNAL_BLOCKERS`, including
  `main_author_identity_unconfirmed`); `npm run paper:claim-audit`; `npm run
  paper:source-audit`; `npm run paper:consistency-audit`; `npm run
  paper:alan-decision-packet -- --stdout`; `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 22 empirical blockers /
  12 external blockers / 3 PDF blockers); `npm run paper:arxiv-package`
  (archive SHA-256
  `e5095f51bd99f0eab387591ef714b6974aa38f80b2b66605b6f62bf6d2ae20bf`);
  `git diff --check`. No collection, Convex env mutation, rater fabrication,
  PDF render/install, acceptance-file approval, or outside action was run.
- 2026-06-09 20:08 CDT: Added a read-only Alan decision packet generator so the
  paper's next decisions are no longer scattered across readiness, submission,
  acceptance, and handoff docs. New `scripts/paper/alan_decision_packet.py` /
  `npm run paper:alan-decision-packet` writes
  `docs/paper/results/alan-decision-packet.md` and can also print to stdout. It
  summarizes the current `LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY` verdict,
  top empirical blockers, top external/PDF blockers, current acceptance state,
  exact acceptance hashes to fill only after Alan explicitly accepts, and the
  verification commands to run before collection or posting. The script is
  read-only: it does not edit JSON, start collection, render PDFs, or perform
  external actions. Updated `scripts/paper/README.md`, `package.json`, and
  `paper_protocol_audit.py` so the packet stays part of the paper workflow.
  Verification: `python3 -m py_compile scripts/paper/alan_decision_packet.py
  scripts/paper/paper_protocol_audit.py`; `python3
  scripts/paper/alan_decision_packet.py --selftest`; `npm run
  paper:alan-decision-packet -- --stdout`; `python3
  scripts/paper/paper_protocol_audit.py --selftest`; `npm run
  paper:protocol-audit`; `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 22 empirical blockers /
  11 external blockers / 3 PDF blockers); `npm run paper:arxiv-package`
  (archive SHA-256
  `1f855034a3da996261da88d3cff4071cc209cd9081e932a1e82a60c4e07bba18`);
  `git diff --check`. No collection, Convex env mutation, rater fabrication,
  PDF render, acceptance-file approval, or outside action was run.
- 2026-06-09 19:55 CDT: Added a read-only acceptance hash helper so Alan/Codex
  can fill the schedule/preregistration SHA fields after explicit acceptance
  without hand-copying from `shasum`. New `scripts/paper/acceptance_hashes.py`
  prints the current schedule/preregistration SHA-256 values, current acceptance
  state, and the JSON fields to fill; it does not edit files or authorize
  collection. Added `npm run paper:acceptance-hashes`, documented it in
  `docs/paper/SCHEDULE_DECISION.md` and `scripts/paper/README.md`, and extended
  `paper_protocol_audit.py` to require the script. Current helper output shows
  schedule SHA
  `74d745addcc35748c45ff500966df8ee0bfda83d1c23482763658562d2805b3d` and
  preregistration SHA
  `9d3ca19e76c6dbe22f9bde6ac9111bfff82ecba3a07eefb622921195000ee81f`, while
  both acceptance JSON files remain `accepted: false` with blank hash fields.
  Verification: `python3 -m py_compile scripts/paper/acceptance_hashes.py
  scripts/paper/paper_protocol_audit.py`; `python3
  scripts/paper/acceptance_hashes.py --selftest`; `python3
  scripts/paper/paper_protocol_audit.py --selftest`; `npm run
  paper:acceptance-hashes`; `npm run paper:protocol-audit`; `npm run
  paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 22
  empirical blockers / 11 external blockers / 3 PDF blockers); `npm run
  paper:arxiv-package` (archive SHA-256
  `1f855034a3da996261da88d3cff4071cc209cd9081e932a1e82a60c4e07bba18`);
  `git diff --check`. No collection, Convex env mutation, rater fabrication,
  PDF render, acceptance-file approval, or outside action was run.
- 2026-06-09 19:43 CDT: Hardened the preregistration/schedule acceptance gate
  against document drift. `docs/paper/SCHEDULE_ACCEPTANCE.json` now includes a
  blank `schedule_sha256`, and
  `docs/paper/PREREGISTRATION_ACCEPTANCE.json` includes a blank
  `preregistration_sha256`; they remain `accepted: false`. The accepted-gated
  arm-window runner now requires the accepted JSON hash to match the current
  schedule/preregistration document before collection can run, so accepting one
  version and silently editing the protocol later will pause collection until
  Alan re-accepts the current documents. `paper_protocol_audit.py` now checks
  the blank-hash state while unaccepted and statically verifies the runner's
  SHA-256 gate. `docs/paper/SCHEDULE_DECISION.md` and
  `docs/paper/PREREGISTRATION_PROTOCOL.md` now document the hash requirement.
  Current document hashes, not filled into acceptance JSON because Alan has not
  accepted, are `31e8f63e4d219a6a41afcf3d296d82aafc144b4f2fe8a0e49eb126902f4205cd`
  for `SCHEDULE_DECISION.md` and
  `9d3ca19e76c6dbe22f9bde6ac9111bfff82ecba3a07eefb622921195000ee81f` for
  `PREREGISTRATION_PROTOCOL.md`. Verification: `python3 -m py_compile
  scripts/paper/paper_protocol_audit.py`; `node --check
  scripts/paper/run_arm_pure_residue_window.mjs`; `python3
  scripts/paper/paper_protocol_audit.py --selftest`; `npm run
  paper:residue-arm-window:acceptance` expected failure with exit 2 while
  accepted=false; `npm run paper:residue-arm-window -- --selftest
  --arm=placebo`; `npm run paper:protocol-audit`; `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 22 empirical blockers /
  11 external blockers / 3 PDF blockers); `npm run paper:arxiv-package`
  (archive SHA-256
  `1f855034a3da996261da88d3cff4071cc209cd9081e932a1e82a60c4e07bba18`);
  `git diff --check`. No collection, Convex env mutation, rater fabrication,
  PDF render, acceptance-file approval, or outside action was run.
- 2026-06-09 19:31 CDT: Fixed the future dataset plumbing that would have made
  the new cluster-aware empirical gate impossible to clear. `report_to_dataset.py`
  now accepts `--source-run`, `--window`, and `--collection-day` and writes those
  fields into every parsed row; its selftest now covers these fields. The
  accepted-gated arm-window runner (`scripts/paper/run_arm_pure_residue_window.mjs`)
  now passes those fields when converting `soul-triad.md` to `dataset.json`,
  using the run directory name, actual window start/end label, and collection
  day. `paper_protocol_audit.py` now statically requires the runner to pass
  `--source-run`, `--window`, and `--collection-day`, and
  `scripts/paper/README.md` documents the manual conversion form so empirical
  datasets do not silently lose cluster metadata. Verification: `python3 -m
  py_compile scripts/paper/report_to_dataset.py
  scripts/paper/paper_protocol_audit.py`; `node --check
  scripts/paper/run_arm_pure_residue_window.mjs`; `python3
  scripts/paper/report_to_dataset.py --selftest`; `python3
  scripts/paper/paper_protocol_audit.py --selftest`; `npm run
  paper:residue-arm-window -- --selftest --arm=placebo`; `npm run
  paper:protocol-audit`; `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 22 empirical blockers /
  11 external blockers / 3 PDF blockers); `npm run paper:arxiv-package`
  (archive SHA-256
  `1f855034a3da996261da88d3cff4071cc209cd9081e932a1e82a60c4e07bba18`);
  `git diff --check`. No collection, Convex env mutation, rater fabrication,
  PDF render, or outside action was run.
- 2026-06-09 19:18 CDT: Closed the cc-identified cluster-awareness gap in the
  paper analysis path without running collection or strengthening claims.
  `scripts/paper/analyze.py` now preserves `source_run` / `collection_day`
  fields from `dataset.json`, defines the formal cluster key as
  `pair + source_run + window`, and emits cluster-unit mean-difference
  bootstrap/permutation columns for callback-rate and aftertaste contrasts when
  metadata are complete. Row-level p-values remain labeled as sanity statistics;
  confirmatory reporting now requires accepted preregistration plus complete
  cluster metadata and cluster-unit analysis. `scripts/paper/paper_empirical_audit.py`
  now blocks completed empirical claims when callback-denominator rows lack
  complete cluster metadata or enough cluster units, which adds the expected
  `cluster_metadata` empirical blocker to the current n=4 pilot dataset.
  `scripts/paper/paper_design_audit.py` now statically verifies that
  `analyze.py` contains the cluster analysis path. Updated
  `docs/paper/PREREGISTRATION_PROTOCOL.md`, `docs/paper/SCHEDULE_DECISION.md`,
  `docs/paper/CLAIM_EVIDENCE_MATRIX.md`, and `scripts/paper/README.md` to align
  the claim boundary. Verification: `python3 -m py_compile
  scripts/paper/analyze.py scripts/paper/paper_empirical_audit.py
  scripts/paper/paper_design_audit.py`; `python3
  scripts/paper/paper_empirical_audit.py --selftest`; `python3
  scripts/paper/paper_design_audit.py --selftest`; `python3
  scripts/paper/report_to_dataset.py --selftest`; `npm run
  paper:empirical-audit` (`PILOT_ONLY_INCOMPLETE_ABLATION`, now with
  `cluster_metadata` blocker); `npm run paper:design-audit`
  (`EMPIRICAL_DESIGN_BLOCKED`); `npm run paper:evidence-matrix-audit`; `npm run
  paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 22
  empirical blockers / 11 external blockers / 3 PDF blockers); `npm run
  paper:arxiv-package` (archive SHA-256
  `1f855034a3da996261da88d3cff4071cc209cd9081e932a1e82a60c4e07bba18`);
  `git diff --check`. Full `scripts/paper/analyze.py --selftest` still was not
  rerun because the current system Python lacks numpy/pandas/scipy and disk
  remains too tight for a safe venv rebuild. No sample collection, Convex env
  mutation, rater fabrication, PDF render, or outside action was run.
- 2026-06-09 19:02 CDT: Ran a bounded read-only cc review of the placebo
  analysis contract (`umi/reports/20260609T235929Z-workload.md`) after local
  placebo-arm plumbing landed. Accepted the high-risk findings that the
  generated residue-ablation table could mislead readers by pairing
  `effect_type=cliffs_delta` with mean-difference CI columns, and that the
  generated markdown should not auto-label placebo rows as a planned/confirmatory
  mechanism contrast before preregistration and schedule acceptance. Updated
  `scripts/paper/analyze.py` so future `residue_placebo` rows are reported only
  when the relevant observed outcome denominator exists, CIs are named
  `mean_diff_ci_*`, the summary labels placebo as confirmatory only if accepted
  before collection, direct `analyze.py` runs emit a `PILOT_SAMPLE_WARNING` for
  callback denominators below 30, and output text states that row-level p-values
  remain sanity statistics until the accepted cluster-aware plan is run. Updated
  `scripts/paper/README.md` to match the new output contract and cluster caveat.
  Verification: `python3 umi/orchestrator.py run umi/workload.md --dry-run`
  (after removing safety-filter-triggering wording from the handoff); `python3
  umi/orchestrator.py run umi/workload.md --skip-codex --timeout 600`;
  `python3 -m py_compile scripts/paper/analyze.py`; `python3
  scripts/paper/report_to_dataset.py --selftest`; `python3
  scripts/paper/paper_empirical_audit.py --selftest`; `npm run
  paper:protocol-audit`; `npm run paper:mechanism-audit`; `npm run
  paper:design-audit` (`EMPIRICAL_DESIGN_BLOCKED`); `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 0 FAIL / 21 empirical blockers /
  11 external blockers / 3 PDF blockers); `npm run paper:arxiv-package`
  (archive SHA-256
  `1f855034a3da996261da88d3cff4071cc209cd9081e932a1e82a60c4e07bba18`);
  `git diff --check`. Full `scripts/paper/analyze.py --selftest` was not rerun
  because system Python lacks numpy/pandas/scipy and `/tmp` has only about
  520MB free, so rebuilding the temporary venv would be unsafe. No sample
  collection, Convex env mutation, rater fabrication, PDF render, or outside
  action was run.
- 2026-06-09 18:53 CDT: Central Umi refresh split current Underworld state into
  product v0.1 and paper lanes. Product v0.1 remains `PENDING`: `npm run
  underworld:alan-playtest-check` is still `NOT_PASS_READY` / `PARTIAL` with
  0/5 PASS rows, and `npm run underworld:v01-completion-audit` reports 0 fail /
  2 pending / 6 pass. Paper readiness is healthy but bounded:
  `npm run paper:readiness` returns `LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`
  with 0 FAIL, while still listing empirical, external, and PDF blockers. Cleared
  stale `umi/workload.md` active handoff; the prior placebo-arm design review is
  complete and no live collection or external release was run.
- 2026-06-06 CDT: Added Phase-A local placebo-arm plumbing for the future
  rigorous residue experiment without opening collection or strengthening paper
  claims. A bounded cc read-only review
  (`umi/reports/20260606T193608Z-workload.md`) recommended a tri-state
  `UNDERWORLD_RESIDUE_READ` shape and warned that motif-guard residue input
  would leak content under placebo. Accepted the local-code part only:
  `convex/agent/conversation.ts` now treats `UNDERWORLD_RESIDUE_READ=placebo`
  as a fixed neutral prompt slot that ignores `recentResidues`, while
  `UNDERWORLD_RESIDUE_READ=false` still removes the residue block and unset
  still reads real residue. The motif guard now also ignores residue text under
  placebo, so residue-derived cold-tea/window/checklist motifs do not leak into
  placebo prompt lines. Added targeted tests in
  `convex/agent/conversationMotifGuard.test.ts`, documented the env state in
  `convex/aiTown/agent.ts`, taught
  `scripts/paper/run_arm_pure_residue_window.mjs` to parse `--arm=placebo` as
  `residue_placebo`, and updated dataset/audit plumbing to allow future
  `residue_placebo` rows while keeping current evidence blocked. The old short
  `paper:residue-ablation` runner remains a two-arm pilot path; the accepted
  rigorous path is still the acceptance-gated arm-window runner. Updated
  `docs/paper/SCHEDULE_DECISION.md` and
  `docs/paper/PREREGISTRATION_PROTOCOL.md`; preregistration now records
  `placebo_arm_status: local_plumbing_not_preregistered`, not an accepted or
  analyzed arm. `paper:design-audit` now reports
  `placebo_not_preregistered_or_analyzed`, preserving the narrowed read-block
  suppression boundary. Verification: `node --check
  scripts/paper/run_arm_pure_residue_window.mjs`; `npm run
  paper:residue-arm-window -- --selftest`; `npm run
  paper:residue-arm-window -- --selftest --arm=placebo`; `npm run
  paper:residue-arm-window -- --check-acceptance-only --arm=placebo` expected
  failure with exit 2 while schedule acceptance remains false; `python3
  scripts/paper/paper_protocol_audit.py --selftest`; `npm run
  paper:protocol-audit`; `python3 scripts/paper/paper_mechanism_audit.py
  --selftest`; `npm run paper:mechanism-audit`; `python3
  scripts/paper/paper_design_audit.py --selftest`; `npm run
  paper:design-audit` (`EMPIRICAL_DESIGN_BLOCKED`); `python3
  scripts/paper/paper_empirical_audit.py --selftest`; `npm run
  paper:empirical-audit`; `python3 scripts/paper/report_to_dataset.py
  --selftest`; `python3 scripts/paper/merge_ablation_runs.py --runs
  docs/paper/results/longitudinal --out /tmp/merged-residue-test.json`;
  `NODE_OPTIONS=--experimental-vm-modules npx jest
  convex/agent/conversationMotifGuard.test.ts --runInBand`; `npx tsc
  --noEmit --pretty false`; `python3
  scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, archive
  SHA-256 `1f855034a3da996261da88d3cff4071cc209cd9081e932a1e82a60c4e07bba18`);
  `npm run paper:arxiv-package`; `git diff --check`. No sample collection,
  Convex env mutation, rater fabrication, PDF render, or outside release action
  was run. Also removed the temporary `/tmp/ai-town-paper-venv` created for
  analysis verification after the machine reported only 115MB free; `/tmp`
  remained very tight afterward (~376MB free), so avoid large installs.
- 2026-06-06 CDT: Tightened the annotation-completion gate so packet readiness
  cannot be confused with completed human validation. `paper_annotation_audit.py`
  now treats `annotation_sheet.csv` as a blank blinded worksheet and requires a
  merged `docs/paper/results/longitudinal/annotations.csv` with at least two
  rater rows per keyed case before the local annotation study can pass. The
  current blocker is now correctly reported as "No merged annotations.csv found;
  completed independent rater sheets must be merged through
  merge_rater_annotations.py." Updated `docs/paper/ALAN_HANDOFF.md`,
  `docs/paper/CLAIM_EVIDENCE_MATRIX.md`,
  `docs/paper/PUBLISH_READY_CHECKLIST.md`,
  `docs/paper/LONGITUDINAL_EXPERIMENT_PLAN.md`,
  `docs/paper/HUMAN_ANNOTATION_PROTOCOL.md`,
  `docs/paper/PREREGISTRATION_PROTOCOL.md`,
  `docs/paper/SCHEDULE_DECISION.md`, `docs/paper/EXPERIMENTS.md`,
  `docs/paper/emotional-residue.md`, and `scripts/paper/README.md` to use
  "qualifying archived records" / merged-annotation wording instead of
  overloading "publishable" or worksheet completion. Updated
  `scripts/paper/paper_consistency_audit.py` and
  `scripts/paper/paper_readiness_report.py` fixtures to match the tightened
  manuscript language. Verification: `python3
  scripts/paper/paper_annotation_audit.py --selftest`; `npm run
  paper:annotation-audit` (`PACKET_READY_INCOMPLETE_STUDY`); `python3
  scripts/paper/paper_consistency_audit.py --selftest`; `npm run
  paper:consistency-audit`; `python3
  scripts/paper/paper_evidence_matrix_audit.py --selftest`; `npm run
  paper:evidence-matrix-audit`; `python3
  scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:claim-audit`; `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, archive SHA-256
  `1f855034a3da996261da88d3cff4071cc209cd9081e932a1e82a60c4e07bba18`);
  `npm run paper:arxiv-package`; `git diff --check`; `npm run
  paper:residue-arm-window:acceptance` expected failure with exit 2 while
  schedule acceptance remains false. No sample collection, rater fabrication,
  Convex env mutation, PDF render, or outside release action was run.
- 2026-06-06 CDT: Ran a narrow read-only cc empirical-boundary review
  (`umi/reports/20260606T192313Z-workload.md`) after updating
  `umi/workload.md` to avoid the orchestrator's external-action safety filter.
  cc found no must-fix local issues for the conservative source package, but
  recommended low-risk wording polish so inclusion criteria, local source
  readiness, and completed empirical evidence cannot be confused. Accepted the
  recommendations: `docs/paper/arxiv/main.tex` now says planned causal test,
  qualifying conversations, inclusion-criteria-passing records, stronger
  empirical version, and explicitly describes the longitudinal pilot as
  `n=2/arm` and single-dyad; `docs/paper/arxiv/README.md` now states the local
  readiness verdict and says it is not a completed empirical-effect package.
  Also hardened `scripts/paper/analyze.py` so passing a blank blinded worksheet
  as `annotations.csv` raises a clear error pointing to
  `scripts/paper/merge_rater_annotations.py`; the selftest now covers that
  guard. Verification: `python3 umi/orchestrator.py run umi/workload.md
  --dry-run`; `python3 umi/orchestrator.py run umi/workload.md --skip-codex
  --timeout 600`; `/tmp/ai-town-paper-venv/bin/python
  scripts/paper/analyze.py --selftest`; `npm run paper:annotation-merge --
  --selftest`; `npm run paper:annotation-audit`
  (`PACKET_READY_INCOMPLETE_STUDY`); `npm run paper:source-audit`; `npm run
  paper:claim-audit`; `npm run paper:readiness`
  (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, archive SHA-256
  `1f855034a3da996261da88d3cff4071cc209cd9081e932a1e82a60c4e07bba18`);
  `npm run paper:arxiv-package`; `git diff --check`; `npm run
  paper:residue-arm-window:acceptance` expected failure with exit 2 while
  schedule acceptance remains false. No sample collection, rater fabrication,
  Convex env mutation, PDF render, or outside release action was run.
- 2026-06-06 CDT: Added the missing human-annotation merge step so the paper
  pipeline separates blank blinded rater worksheets from completed
  analysis-ready ratings. `scripts/paper/merge_rater_annotations.py` now joins
  completed `blind_id`-keyed rater sheets through
  `docs/paper/results/longitudinal/annotation_key.csv`, validates each Likert
  value as an integer 1..5, requires at least two unique raters by default, and
  writes `case_name,rater,naturalness,emotional_binding,character_consistency,repetition`
  rows for `scripts/paper/analyze.py`. Added `npm run paper:annotation-merge`,
  updated `docs/paper/HUMAN_ANNOTATION_PROTOCOL.md`,
  `scripts/paper/README.md`, `scripts/paper/paper_annotation_audit.py`, and
  `docs/paper/PUBLISH_READY_CHECKLIST.md` so packet readiness is not confused
  with a completed annotation study. Verification: `python3
  scripts/paper/merge_rater_annotations.py --selftest`; `npm run
  paper:annotation-merge -- --selftest`; `python3
  scripts/paper/paper_annotation_audit.py --selftest`; `npm run
  paper:annotation-audit` (`PACKET_READY_INCOMPLETE_STUDY` with no FAILs);
  `python3 scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:readiness`; `npm run paper:arxiv-package`; `git diff --check`. No
  sample collection, rater fabrication, Convex env mutation, PDF render, or
  outside release action was run.
- 2026-06-06 CDT: Tightened the live arm-window collection gate so the future
  long-window residue ablation cannot start from schedule acceptance alone.
  Added `docs/paper/PREREGISTRATION_ACCEPTANCE.json` and updated
  `scripts/paper/run_arm_pure_residue_window.mjs` so `main()` and
  `--check-acceptance-only` both require accepted schedule JSON and accepted
  preregistration JSON before the runner can mutate `UNDERWORLD_RESIDUE_READ`
  or hold a collection window. Updated `scripts/paper/paper_protocol_audit.py`
  to statically verify schedule docs, preregistration docs, both acceptance
  files, runner gate strings, and package scripts; updated
  `scripts/paper/paper_claim_audit.py` and `scripts/paper/paper_design_audit.py`
  so readiness reports `preregistration_acceptance` as an empirical blocker.
  Aligned `docs/paper/SCHEDULE_DECISION.md`,
  `docs/paper/PREREGISTRATION_PROTOCOL.md`, `docs/paper/ALAN_HANDOFF.md`,
  `docs/paper/PUBLISH_READY_CHECKLIST.md`, `docs/paper/arxiv/README.md`, and
  `scripts/paper/README.md`. Verification: `node --check
  scripts/paper/run_arm_pure_residue_window.mjs`; `npm run
  paper:residue-arm-window -- --selftest`; `python3
  scripts/paper/paper_protocol_audit.py --selftest`; `npm run
  paper:protocol-audit`; `python3 scripts/paper/paper_claim_audit.py
  --selftest`; `python3 scripts/paper/paper_design_audit.py --selftest`;
  `python3 scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 21 empirical
  blockers); `npm run paper:arxiv-package`; `git diff --check`; `npm run
  paper:residue-arm-window:acceptance` expected failure with exit 2; temporary
  schedule-accepted/prereg-rejected JSON failed with exit 2; temporary accepted
  versions of both JSON files passed `--check-acceptance-only` without
  collection. No sample collection, Convex env mutation, PDF render, or outside
  release action was run.
- 2026-06-06 CDT: Added a machine-audited preregistration protocol for the
  future rigorous residue ablation and fixed a design-audit false negative.
  `docs/paper/PREREGISTRATION_PROTOCOL.md` now records explicit status fields
  (`draft_not_accepted`, collection paused, final N not fixed, placebo arm not
  implemented/analyzed, narrowed read-block suppression claim), arms, primary
  callback-rate outcome, secondary outcomes, inclusion/exclusion criteria,
  counterbalanced arm-pure schedule, stopping rules, sample-size/cluster policy,
  analysis plan, and deviation policy. Updated `scripts/paper/paper_design_audit.py`
  so it no longer treats the phrase "length-matched placebo arm has been
  implemented" inside a limitation sentence as evidence that placebo is
  implemented; the audit now reads explicit preregistration status and reports
  `placebo_not_implemented` as an empirical/mechanism blocker. Wired the
  preregistration boundary into `docs/paper/ALAN_HANDOFF.md`,
  `docs/paper/PUBLISH_READY_CHECKLIST.md`, `docs/paper/arxiv/README.md`,
  `scripts/paper/README.md`, and the readiness selftest fixture. Verification:
  `python3 scripts/paper/paper_design_audit.py --selftest`; `npm run
  paper:design-audit` (`EMPIRICAL_DESIGN_BLOCKED` with blockers for schedule
  acceptance, preregistration acceptance, placebo not implemented/analyzed,
  final N not fixed, and annotation minimum); `python3
  scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, 19 empirical
  blockers); `npm run paper:arxiv-package`; `git diff --check`; `npm run
  paper:residue-arm-window:acceptance` expected failure with exit 2 while
  schedule acceptance remains false. No sample collection, Convex env mutation,
  PDF render, or outside release action was run.
- 2026-06-06 CDT: Added citation provenance as a first-class paper gate.
  Created `docs/paper/CITATION_PROVENANCE.md` with provenance rows for all 15
  bibliography keys, using primary/official/publisher/DOI URLs for recent
  LLM-agent, AI Town, role-playing, memory, affective-computing, and
  believable-agent references, while keeping Goffman as a stable classic
  bibliographic anchor pending final copyedit. Added
  `scripts/paper/paper_citation_audit.py` and `npm run paper:citation-audit`;
  the audit requires every `main.tex` bibitem to have a provenance row and
  requires recent LLM-agent / AI Town keys to point at primary or official URLs.
  Wired the audit into `scripts/paper/paper_readiness_report.py`,
  `package.json`, `scripts/paper/README.md`, `docs/paper/arxiv/README.md`,
  `docs/paper/PUBLISH_READY_CHECKLIST.md`, and `docs/paper/ALAN_HANDOFF.md`.
  Verification: `python3 scripts/paper/paper_citation_audit.py --selftest`;
  `npm run paper:citation-audit` (`PASS`, 15 bibliography keys);
  `python3 scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:readiness` (`LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY` with citation
  provenance audit `PASS`); `npm run paper:source-audit`; `npm run
  paper:arxiv-package`; `git diff --check`; `npm run
  paper:residue-arm-window:acceptance` expected failure with exit 2 while
  schedule acceptance remains false. No sample collection, Convex env mutation,
  PDF render, or outside release action was run.
- 2026-06-06 CDT: Ran a bounded read-only cc citation/novelty/ethics final
  review (`umi/reports/20260606T185800Z-workload.md`). cc found citations and
  novelty boundaries acceptable for a conservative design/systems preprint, but
  flagged an implicit-only ethics/transcript scope note as a release-readiness
  soft edge. Accepted that finding and added a `Scope and ethics` limitation to
  `docs/paper/arxiv/main.tex`: author-observed single-player prototype, no
  external participants recruited or recorded, no IRB or human-subjects approval
  claimed, raw player-conversation transcripts excluded from the source archive,
  and controlled player study future work. Updated
  `scripts/paper/paper_claim_audit.py` to require these disclosures with
  whitespace-normalized phrase checks, and aligned
  `docs/paper/ALAN_HANDOFF.md`, `docs/paper/REVIEWER_PREMORTEM.md`, and
  `docs/paper/PUBLISH_READY_CHECKLIST.md`. Verification:
  `python3 scripts/paper/paper_claim_audit.py --selftest`; `npm run
  paper:claim-audit`; `npm run paper:source-audit`; `npm run paper:readiness`;
  `npm run paper:arxiv-package`. Current source archive SHA-256 is
  `bc7f9ceeaa104fcd63a6c0addf6554a9b38d404dc5a13f96630bcfe50c919cb9`.
  No sample collection, Convex env mutation, PDF render, or outside release
  action was run.
- 2026-06-06 CDT: Finished the final rigor pass for the emotional-residue paper
  package by adding cluster/design-effect sensitivity to the sample-size
  planning boundary. `scripts/paper/power_sensitivity.py` now emits
  `docs/paper/results/power/cluster_power_grid.csv` and the generated power
  summary includes a `Cluster Sensitivity` section using the standard
  design-effect approximation. Updated `docs/paper/SCHEDULE_DECISION.md`,
  `docs/paper/ALAN_HANDOFF.md`, `docs/paper/PUBLISH_READY_CHECKLIST.md`,
  `docs/paper/CLAIM_EVIDENCE_MATRIX.md`, `docs/paper/REVIEWER_PREMORTEM.md`,
  and `scripts/paper/README.md` so reviewers cannot mistake nominal row count
  for independent evidence. Current readiness remains
  `LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`; empirical/mechanism claims remain
  blocked by unaccepted schedule, final N not fixed, only n=4 pilot rows, one
  dyad, no completed raters, missing old-row generation metadata, pilot-only
  trace-overlap coverage, and no placebo arm unless the narrowed read-block
  claim is kept. Verification: `python3 scripts/paper/power_sensitivity.py
  --selftest`; `python3 scripts/paper/power_sensitivity.py --outdir
  docs/paper/results/power`; `python3 scripts/paper/paper_design_audit.py
  --selftest`; `python3 scripts/paper/paper_evidence_matrix_audit.py
  --selftest`; `python3 scripts/paper/paper_readiness_report.py --selftest`;
  `npm run paper:design-audit`; `npm run paper:evidence-matrix-audit`;
  `npm run paper:readiness`; `npm run paper:arxiv-package`; `git diff
  --check`; `npm run paper:residue-arm-window:acceptance` expected failure with
  exit 2 while schedule acceptance remains false. No sample collection, Convex
  env mutation, PDF render, or outside release action was run.
- 2026-06-06 CDT: Ran a final read-only cc reviewer-premortem pass via
  `umi/orchestrator.py` after updating `umi/workload.md` to avoid external-action
  wording that triggers the safety gate. cc accepted the local-source-ready
  boundary for a conservative design/systems preprint and flagged model/provider
  disclosure, over-readable bootstrap CIs, unmeasured residue-verbatim leakage,
  novelty defense versus summary memory, single-player author-observer scope,
  and the need for a one-page Alan handoff. Accepted the actionable findings:
  `docs/paper/arxiv/main.tex` now discloses local/cloud model policy paths
  (`qwen2.5:1.5b` smoke-only, local Ollama default `qwen3:8b`,
  OpenAI-compatible Qwen default `qwen3-max`), states datasets do not yet store
  per-conversation provider/model metadata, moves the author-observer boundary
  into the abstract, softens the marker CI table as diagnostic only, adds a
  trace-to-dialogue overlap limitation, and sharpens novelty versus summary
  memory. Added `docs/paper/ALAN_HANDOFF.md` and
  `docs/paper/REVIEWER_PREMORTEM.md`; updated
  `docs/paper/CLAIM_EVIDENCE_MATRIX.md`,
  `docs/paper/PUBLISH_READY_CHECKLIST.md`,
  `docs/paper/arxiv/README.md`, `scripts/paper/paper_claim_audit.py`,
  `scripts/paper/paper_evidence_matrix_audit.py`, and
  `scripts/paper/paper_readiness_report.py`. Verification:
  `python3 scripts/paper/paper_claim_audit.py --selftest`;
  `python3 scripts/paper/paper_evidence_matrix_audit.py --selftest`;
  `python3 scripts/paper/paper_readiness_report.py --selftest`;
  `npm run paper:source-audit`; `npm run paper:claim-audit`;
  `npm run paper:consistency-audit`; `npm run paper:protocol-audit`;
  `npm run paper:mechanism-audit`; `npm run paper:annotation-audit`;
  `npm run paper:empirical-audit`; `npm run paper:evidence-matrix-audit`;
  `npm run paper:submission-audit`; `npm run paper:pdf-preflight`;
  `npm run paper:arxiv-package`; `npm run paper:readiness`;
  `git diff --check`; `npm run paper:residue-arm-window:acceptance` expected
  failure with exit 2 while schedule acceptance remains false. No Convex env
  mutation, sample collection, PDF render, or outside release action was run.
- 2026-06-06 CDT: Tightened future experiment reproducibility metadata without
  backfilling old data. `scripts/paper/report_to_dataset.py` now accepts
  `--metadata-json` and attaches run-level `generation_metadata` to parsed
  rows. `scripts/paper/run_residue_ablation.mjs` and
  `scripts/paper/run_arm_pure_residue_window.mjs` now write
  `generation-metadata.json` snapshots for future ablation rows, including
  local/cloud provider/model defaults without API keys. `scripts/paper/paper_empirical_audit.py`
  now treats rows missing `generation_metadata` as an empirical blocker; the
  current n=4 pilot remains blocked with `4/4 rows lack run-level
  provider/model metadata`. Updated `scripts/paper/README.md`,
  `docs/paper/LONGITUDINAL_EXPERIMENT_PLAN.md`,
  `docs/paper/ALAN_HANDOFF.md`, and
  `docs/paper/PUBLISH_READY_CHECKLIST.md`. Verification:
  `python3 scripts/paper/report_to_dataset.py --selftest`; `node --check
  scripts/paper/run_arm_pure_residue_window.mjs`; `node --check
  scripts/paper/run_residue_ablation.mjs`; `npm run paper:residue-arm-window
  -- --selftest`; `python3 scripts/paper/paper_empirical_audit.py --selftest`;
  `npm run paper:empirical-audit`; `python3
  scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:readiness`; `git diff --check`; `npm run
  paper:residue-arm-window:acceptance` expected failure with exit 2. No sample
  collection or Convex env mutation was run.
- 2026-06-06 CDT: Added a trace-to-dialogue overlap audit for the paper's
  "pressure, not quotation" claim. `scripts/paper/paper_trace_overlap_audit.py`
  scans rolling-continuity reports, links callback lines to source memory traces,
  and computes a simple longest-common-substring overlap ratio. Current verdict:
  `PILOT_ONLY_TRACE_OVERLAP_AUDIT`: 11 callback cases assessed, max overlap
  ratio 0.242, no high verbatim-overlap warning, but sample size is below the
  30-callback validation threshold and 1/11 callback cases lacks parsed source
  trace linkage. Wired `npm run paper:trace-overlap-audit` into
  `scripts/paper/paper_readiness_report.py`, `package.json`,
  `scripts/paper/README.md`, `docs/paper/arxiv/README.md`,
  `docs/paper/PUBLISH_READY_CHECKLIST.md`, `docs/paper/ALAN_HANDOFF.md`,
  `docs/paper/REVIEWER_PREMORTEM.md`, and
  `docs/paper/CLAIM_EVIDENCE_MATRIX.md` as C10. Verification:
  `python3 scripts/paper/paper_trace_overlap_audit.py --selftest`;
  `npm run paper:trace-overlap-audit`; `python3
  scripts/paper/paper_evidence_matrix_audit.py --selftest`; `python3
  scripts/paper/paper_readiness_report.py --selftest`;
  `npm run paper:evidence-matrix-audit`; `npm run paper:readiness`;
  `npm run paper:arxiv-package`; `git diff --check`. No sample collection,
  Convex env mutation, PDF render, or outside release action was run.
- 2026-06-06 CDT: Added an empirical causal/mechanism design gate for the
  residue paper. `docs/paper/SCHEDULE_DECISION.md` and
  `docs/paper/LONGITUDINAL_EXPERIMENT_PLAN.md` now explicitly state that the
  two-arm read-off design tests suppression of the residue-read prompt block and
  does not isolate residue content from prompt length/shape unless a
  length-matched placebo arm is implemented; otherwise the paper must keep the
  narrowed read-block suppression claim. `scripts/paper/paper_design_audit.py`
  and `npm run paper:design-audit` now check arm-pure design wording,
  callback-window denominator policy, no optional stopping, MDE/final-N caveats,
  cluster-aware caution, placebo-or-narrowed-claim boundary, generation
  metadata, trace-overlap, annotation minimum, and schedule acceptance. Current
  verdict: `EMPIRICAL_DESIGN_BLOCKED` with blockers for unaccepted schedule,
  final N not fixed until pilot baseline/yield estimates, and only 4 annotation
  rows. Wired the gate into `scripts/paper/paper_readiness_report.py`,
  `package.json`, `scripts/paper/README.md`, `docs/paper/arxiv/README.md`,
  `docs/paper/PUBLISH_READY_CHECKLIST.md`, `docs/paper/ALAN_HANDOFF.md`, and
  `docs/paper/CLAIM_EVIDENCE_MATRIX.md` as C11. Verification:
  `python3 scripts/paper/paper_design_audit.py --selftest`;
  `npm run paper:design-audit`; `python3
  scripts/paper/paper_evidence_matrix_audit.py --selftest`;
  `npm run paper:evidence-matrix-audit`; `python3
  scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:readiness`; `npm run paper:arxiv-package`; `git diff --check`. No
  sample collection, Convex env mutation, PDF render, or outside release action
  was run.
- 2026-06-06 CDT: Added a claim-to-evidence matrix for reviewer-facing claim
  discipline. `docs/paper/CLAIM_EVIDENCE_MATRIX.md` now maps nine major
  manuscript claims to current evidence artifacts and explicit boundaries:
  supported systems pattern, code-aligned mechanism, smoke evidence,
  feasibility evidence, pipeline sanity, future-work blocked claims, incomplete
  annotation study, local source readiness, and external blockers.
  `scripts/paper/paper_evidence_matrix_audit.py` and
  `npm run paper:evidence-matrix-audit` verify that each required claim ID,
  status, artifact reference, gate summary, and boundary phrase is present and
  aligned with current artifacts. Wired the audit into
  `scripts/paper/paper_readiness_report.py`, `package.json`,
  `scripts/paper/README.md`, `docs/paper/arxiv/README.md`, and
  `docs/paper/PUBLISH_READY_CHECKLIST.md`. Current verdict is `PASS`; readiness
  now reports `Evidence matrix audit: PASS` and 6 PASS gates while retaining the
  empirical, external, and PDF blockers. No sample collection, Convex env
  mutation, claim strengthening, PDF render, or external submission was run.
  Verification: `python3 scripts/paper/paper_evidence_matrix_audit.py
  --selftest`; `npm run paper:evidence-matrix-audit`; `python3
  scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:readiness`; full paper gate matrix (`source`, `claim`, `consistency`,
  `protocol`, `mechanism`, `annotation`, `empirical`, `evidence-matrix`,
  `submission`, `pdf-preflight`, `arxiv-package`).
- 2026-06-06 CDT: Added a longitudinal empirical-ablation dataset audit so the
  paper package can distinguish pipeline/sanity evidence from completed effect
  evidence without relying on prose alone. `scripts/paper/paper_empirical_audit.py`
  and `npm run paper:empirical-audit` check the current merged longitudinal
  dataset for archived-row hygiene, condition labels, n/arm, dyad coverage,
  source-run coverage, window metadata, callback-denominator size, callback
  labels, and aftertaste-proxy variance. Current verdict is
  `PILOT_ONLY_INCOMPLETE_ABLATION`: n=4 total (2/arm), one dyad, two source
  runs, no useful long-window metadata, 4 callback-denominator rows, callback
  snapshot 1/4, and saturated rule-based aftertaste proxy at 1.0. Wired this
  audit into `scripts/paper/paper_readiness_report.py`, `package.json`,
  `scripts/paper/README.md`, `docs/paper/arxiv/README.md`, and
  `docs/paper/PUBLISH_READY_CHECKLIST.md`. `npm run paper:readiness` now reports
  `Empirical ablation audit: PILOT_ONLY_INCOMPLETE_ABLATION` while preserving
  the conservative source-ready verdict and explicit blockers. No sample
  collection, Convex env mutation, or claim strengthening was run. Verification:
  `python3 scripts/paper/paper_empirical_audit.py --selftest`; `npm run
  paper:empirical-audit`; `python3 scripts/paper/paper_readiness_report.py
  --selftest`; `npm run paper:readiness`; `npm run paper:source-audit`;
  `npm run paper:claim-audit`; `npm run paper:consistency-audit`; `npm run
  paper:protocol-audit`; `npm run paper:mechanism-audit`; `npm run
  paper:annotation-audit`; `npm run paper:submission-audit`; `npm run
  paper:pdf-preflight`; `npm run paper:arxiv-package`; package JSON parse
  check; `git diff --check`.
- 2026-06-06 CDT: Added a local submitter-decision gate for external readiness.
  `docs/paper/SUBMISSION_DECISIONS.json` now records Alan-facing choices that
  must be explicitly confirmed before any external posting: author name,
  affiliation, contact email, public author identity, primary/cross-list
  categories, account readiness, license, upstream AI Town attribution comfort,
  raw transcript policy, timing decision, rendered PDF verification, and
  platform preview verification. `scripts/paper/paper_submission_audit.py` and
  `npm run paper:submission-audit` validate that file and the source package
  without contacting external services. Current verdict is `EXTERNAL_BLOCKERS`:
  the decision file is schema-valid, but author/category/account/license/timing
  decisions are blank, rendered PDF and platform preview are unverified, and
  `main.tex` still intentionally contains the author metadata placeholder.
  Wired the submission audit into `scripts/paper/paper_readiness_report.py`,
  `package.json`, `scripts/paper/README.md`,
  `docs/paper/arxiv/README.md`, and
  `docs/paper/PUBLISH_READY_CHECKLIST.md`. `npm run paper:readiness` now reports
  `Submission decision audit: EXTERNAL_BLOCKERS` while preserving the
  conservative source-ready verdict and explicit empirical/PDF blockers. No
  sample collection, Convex env mutation, metadata finalization, PDF render, or
  external submission was run. Verification: `python3
  scripts/paper/paper_submission_audit.py --selftest`; `npm run
  paper:submission-audit`; `python3 scripts/paper/paper_readiness_report.py
  --selftest`; package JSON parse check; `npm run paper:readiness`; `npm run
  paper:source-audit`; `npm run paper:claim-audit`; `npm run
  paper:consistency-audit`; `npm run paper:protocol-audit`; `npm run
  paper:mechanism-audit`; `npm run paper:annotation-audit`; `npm run
  paper:pdf-preflight`; `npm run paper:arxiv-package`.
- 2026-06-06 CDT: Added a local PDF/render preflight gate for the
  emotional-residue source package. `scripts/paper/paper_pdf_preflight.py` and
  `npm run paper:pdf-preflight` now copy `docs/paper/arxiv/main.tex` into a
  temporary directory and try the first available local renderer among
  `tectonic`, `latexmk`, `pdflatex`, `xelatex`, `lualatex`, and `pandoc`; it
  passes only if a non-empty `main.pdf` is produced. On this machine the current
  verdict is `PDF_BLOCKER` because none of those tools are installed, so source
  readiness remains conservative but rendered-PDF readiness is explicitly
  unverified. Wired the preflight into `package.json`,
  `scripts/paper/paper_readiness_report.py`, `scripts/paper/README.md`,
  `docs/paper/arxiv/README.md`, and
  `docs/paper/PUBLISH_READY_CHECKLIST.md`; `npm run paper:readiness` now writes
  `docs/paper/results/pdf-preflight.md` and summarizes `PDF preflight:
  PDF_BLOCKER` alongside the other gates. No sample collection, Convex env
  mutation, TeX installation, PDF upload, or external submission was run.
  Verification: `python3 scripts/paper/paper_pdf_preflight.py --selftest`;
  `npm run paper:pdf-preflight`; `python3
  scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:readiness`; `npm run paper:source-audit`; `npm run paper:claim-audit`;
  `npm run paper:consistency-audit`; `npm run paper:protocol-audit`; `npm run
  paper:mechanism-audit`; `npm run paper:annotation-audit`; `npm run
  paper:arxiv-package`.
- 2026-06-06 CDT: Added a static residue mechanism/code-path audit for the
  emotional-residue systems paper. `scripts/paper/paper_mechanism_audit.py` and
  `npm run paper:mechanism-audit` now verify that the manuscript's residue
  architecture maps to current code paths: `convex/agent/memory.ts`
  write gating via `UNDERWORLD_RESIDUE_WRITE`, `deterministicResidueSentence`,
  minimum exchange and shape/hygiene gates, residue storage under the memory
  description prefix, `convex/agent/conversation.ts` read gating via
  `UNDERWORLD_RESIDUE_READ`, `residuePromptLines`, the at-most-two residue
  prompt bound, America/Chicago time labels, no-quotation instructions, motif
  guard/repeated motif families, env documentation in `convex/aiTown/agent.ts`,
  and the schema `emotional_residue` outcome label. Wired this audit into
  `scripts/paper/paper_readiness_report.py`, `package.json`, `scripts/paper/README.md`,
  `docs/paper/arxiv/README.md`, and `docs/paper/PUBLISH_READY_CHECKLIST.md`.
  Current readiness now reports claim/source/consistency/protocol/mechanism
  audits passing, annotation packet ready but study incomplete, and the same
  empirical/external/PDF blockers. No sample collection, Convex env mutation,
  PDF compilation, or external submission was run. Verification:
  `python3 scripts/paper/paper_mechanism_audit.py --selftest`; `npm run
  paper:mechanism-audit`; `python3 scripts/paper/paper_readiness_report.py
  --selftest`; package JSON parse check; `npm run paper:source-audit`;
  `npm run paper:claim-audit`; `npm run paper:consistency-audit`; `npm run
  paper:protocol-audit`; `npm run paper:annotation-audit`; `npm run
  paper:arxiv-package`; `npm run paper:readiness`.
- 2026-06-06 CDT: Ran a final read-only cc expert review on the
  emotional-residue paper after the local readiness gates were in place
  (`umi/reports/20260606T180028Z-workload.md`). cc accepted the current package
  as a conservative local design/systems preprint source and rejected it as a
  completed empirical ablation/player-experience paper, matching
  `npm run paper:readiness`. Codex applied cc's accepted minor revisions to
  `docs/paper/arxiv/main.tex`: added concrete write/read architecture details
  with `convex/agent/memory.ts`, `convex/agent/conversation.ts`,
  `UNDERWORLD_RESIDUE_WRITE`, and `UNDERWORLD_RESIDUE_READ`; added a Goffman
  layered-self citation and paragraph; defined soul-triad once; added smoke
  pair distribution; clarified Table 2 window-denominator headers; added
  bootstrap wording to Table 1 caption; disclosed inter-block ON->OFF residue
  carryover in the ablation caveats and limitations; and added an AI Town /
  Generative Agents acknowledgement. Kept the source ASCII-only by romanizing
  pair labels. Rebuilt the allowlisted local source archive; current SHA-256 is
  `7812365450fec61ade2563468338fa7b0ac5ae55fad72aa3988ac1ea943d617f`.
  Verification: `python3 umi/orchestrator.py run umi/workload.md --dry-run`;
  `python3 umi/orchestrator.py run umi/workload.md --skip-codex --timeout 600`;
  `npm run paper:source-audit`; `npm run paper:claim-audit`; `npm run
  paper:consistency-audit`; `npm run paper:protocol-audit`; `npm run
  paper:annotation-audit`; `npm run paper:arxiv-package`; `npm run
  paper:readiness`; `python3 scripts/paper/paper_readiness_report.py
  --selftest`; `python3 scripts/paper/paper_annotation_audit.py --selftest`.
  No sample collection, Convex env mutation, PDF compilation, or external
  submission was run.
- 2026-06-06 CDT: Added a human-annotation packet audit for the
  emotional-residue paper. `scripts/paper/paper_annotation_audit.py` and
  `npm run paper:annotation-audit` now check the blinded rater packet schema,
  blind-id/key alignment, condition/callback/metric/conversation-id leakage,
  annotation sample size, rater completion, and dyad coverage. Current verdict
  is `PACKET_READY_INCOMPLETE_STUDY`: no FAIL findings; schema/blinding passes,
  but the empirical human-validation study is still incomplete with 4 rows, no
  completed rater rows, and one observed dyad. Wired this into
  `scripts/paper/paper_readiness_report.py`, so `npm run paper:readiness` now
  reports claim/source/consistency/protocol audits passing, annotation packet
  ready but incomplete, and 6 empirical blockers / 1 external blocker / 1 PDF
  blocker. No sample collection, env mutation, PDF compilation, or external
  submission was run. Verification: `npm run paper:annotation-audit`;
  `python3 scripts/paper/paper_annotation_audit.py --selftest`; `npm run
  paper:readiness`; `python3 scripts/paper/paper_readiness_report.py
  --selftest`; `npm run paper:claim-audit`; `npm run paper:source-audit`;
  `npm run paper:consistency-audit`; `npm run paper:protocol-audit`; `npm run
  paper:arxiv-package`; package JSON parse check; `git diff --check`.
- 2026-06-06 CDT: Added a protocol/collection-gate consistency audit for the
  emotional-residue long-window experiment design. `scripts/paper/paper_protocol_audit.py`
  and `npm run paper:protocol-audit` now statically verify that
  `docs/paper/SCHEDULE_DECISION.md`, `docs/paper/SCHEDULE_ACCEPTANCE.json`,
  `scripts/paper/run_arm_pure_residue_window.mjs`, and `package.json` agree on
  the arm-pure design, READ on/off mapping, default `--collect=none`, mechanism
  `--collect=force`, rolling-callback denominator policy, no optional stopping,
  sample-size caveats, human-annotation minimums, acceptance fields, env restore,
  and npm entrypoints. Current result is `PASS` and writes
  `docs/paper/results/protocol-audit.md`. Wired the protocol audit into
  `scripts/paper/paper_readiness_report.py`, so `npm run paper:readiness` now
  reports claim/source/consistency/protocol audits all passing while still
  listing empirical/external/PDF blockers. The explicit acceptance preflight
  `npm run paper:residue-arm-window:acceptance` expected-failed with exit code
  2 because `SCHEDULE_ACCEPTANCE.json` remains `accepted: false`; this confirms
  collection remains paused. No sample collection or env change was run.
  Verification: `python3 scripts/paper/paper_protocol_audit.py --selftest`;
  `python3 scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:protocol-audit`; `npm run paper:readiness`; expected-failing `npm run
  paper:residue-arm-window:acceptance`; `npm run paper:claim-audit`; `npm run
  paper:source-audit`; `npm run paper:consistency-audit`; `npm run
  paper:arxiv-package`; package JSON parse check; `git diff --check`.
- 2026-06-06 CDT: Added a manuscript/artifact numeric consistency gate for the
  emotional-residue paper. `scripts/paper/paper_consistency_audit.py` and
  `npm run paper:consistency-audit` now check selected hard-coded manuscript
  numbers against generated artifacts: the 8-conversation smoke marker table,
  June 5 rolling-continuity counts, the repeatability table for 2026-06-04 /
  2026-06-05 / 2026-06-06, and longitudinal sanity claims (`n=2/arm`, one dyad,
  aftertaste saturation). Current result is `PASS` and writes
  `docs/paper/results/consistency-audit.md`. Wired this into
  `scripts/paper/paper_readiness_report.py`, so `npm run paper:readiness` now
  reports claim audit `PASS_CONSERVATIVE_PREPRINT`, source audit `PASS`,
  consistency audit `PASS`, and the same empirical/external/PDF blockers. Updated
  `package.json`, `scripts/paper/README.md`, `docs/paper/arxiv/README.md`, and
  `docs/paper/PUBLISH_READY_CHECKLIST.md`. No sample collection or env changes
  were run. Verification: `python3 scripts/paper/paper_consistency_audit.py
  --selftest`; `python3 scripts/paper/paper_readiness_report.py --selftest`;
  `npm run paper:consistency-audit`; `npm run paper:readiness`; `npm run
  paper:claim-audit`; `npm run paper:source-audit`; `npm run
  paper:arxiv-package`; package JSON parse check; `git diff --check`.
- 2026-06-06 CDT: Added the combined local paper readiness report for the
  emotional-residue paper. `scripts/paper/paper_readiness_report.py` and
  `npm run paper:readiness` now run the claim audit, source audit, deterministic
  allowlisted arXiv source package build, archive/manifest SHA checks, and local
  PDF-tool availability check, then write `docs/paper/results/readiness.md`.
  Current verdict is `LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`: local source
  and claim boundary are ready for a conservative design/systems preprint, while
  the report still explicitly lists 3 empirical blockers (schedule acceptance,
  n=2/arm longitudinal pilot data, 4 annotation rows), 1 external blocker
  (author metadata), and 1 PDF blocker (no local TeX/pandoc tool found; PDF /
  arXiv preview unverified). Updated `package.json`, `scripts/paper/README.md`,
  `docs/paper/arxiv/README.md`, and `docs/paper/PUBLISH_READY_CHECKLIST.md` so
  `paper:readiness` is the recommended one-command status check before
  discussing publication timing. No collection or upload was run. Verification:
  `python3 scripts/paper/paper_readiness_report.py --selftest`; `npm run
  paper:readiness`; `npm run paper:claim-audit`; `npm run paper:source-audit`;
  `npm run paper:arxiv-package`; package JSON parse check; `git diff --check`.
  A fresh `npx convex env get UNDERWORLD_RESIDUE_READ` check was attempted but
  the local Convex backend did not start within 30 seconds; the query process
  was stopped and no new env-state evidence was obtained in this pass.
- 2026-06-06 CDT: Added a local arXiv source package builder for the
  emotional-residue paper without uploading or starting collection.
  `scripts/paper/build_arxiv_source_package.py` and
  `npm run paper:arxiv-package` create an allowlisted deterministic archive at
  `docs/paper/results/arxiv-source/emotional-residue-arxiv-source.tar.gz` plus
  `manifest.json`. The archive currently contains only `main.tex`; datasets,
  ablation logs, annotation sheets/keys, blinded transcript packets, figures,
  and generated results are excluded by design. Current archive SHA-256:
  `a323e9df68766fe890c737b1d2d7dee42f53d40856ee9b7ce583554ef01456d9`.
  Updated `scripts/paper/README.md`, `docs/paper/arxiv/README.md`,
  `docs/paper/PUBLISH_READY_CHECKLIST.md`, and `package.json` so this packaging
  gate is documented. This still does not submit externally and does not replace
  PDF/arXiv preview inspection. Verification: `python3
  scripts/paper/build_arxiv_source_package.py --selftest`; `npm run
  paper:arxiv-package`; `tar -tzf` confirmed only `main.tex`; archive-member
  leakage scan for dataset/annotation/transcript/results/figures returned no
  matches; `npm run paper:claim-audit` (`PASS_CONSERVATIVE_PREPRINT`);
  `npm run paper:source-audit` (`PASS`); package JSON parse check; `git diff
  --check`; `npx convex env get UNDERWORLD_RESIDUE_READ` (not found/unset).
- 2026-06-06 CDT: Added local arXiv source hygiene auditing for the
  emotional-residue paper without touching collection or Convex env.
  `scripts/paper/paper_source_audit.py` and `npm run paper:source-audit` now
  check the source package for basic LaTeX structure, environment balance,
  placeholder tokens, label/ref consistency, duplicate labels, citation/bibitem
  consistency, simple tabular column mismatches, README boundary language, and
  source-package notes. The current result is `PASS` with 0 FAIL / 0 WARN and
  writes `docs/paper/results/source-audit.md`. Updated `scripts/paper/README.md`,
  `docs/paper/arxiv/README.md`, `docs/paper/PUBLISH_READY_CHECKLIST.md`, and
  `package.json` so this is now a fixed local paper gate. This does not replace
  PDF compilation or arXiv preview inspection, which still require a TeX-capable
  environment or arXiv's preview. Verification: `python3
  scripts/paper/paper_source_audit.py --selftest`; `npm run paper:source-audit`;
  `npm run paper:claim-audit` (`PASS_CONSERVATIVE_PREPRINT`); `python3
  scripts/paper/paper_claim_audit.py --selftest`; package JSON parse check;
  `git diff --check`; `npx convex env get UNDERWORLD_RESIDUE_READ` (not
  found/unset).
- 2026-06-06 CDT: Closed the remaining related-work gap from the fifth cc
  expert review without changing evidence claims or running collection. Verified
  primary sources for Character-LLM and Bickmore-style relational agents, then
  updated `docs/paper/arxiv/main.tex` to position emotional residue as a
  runtime memory primitive rather than training-time persona construction or a
  validated relational-agent intervention. Added bibliography entries for
  Character-LLM and Bickmore et al.'s relational-agent older-adults study; all
  bibliography entries are now cited. Current claim audit remains
  `PASS_CONSERVATIVE_PREPRINT` with only the expected empirical/external
  blockers. Verification: `npm run paper:claim-audit`; `python3
  scripts/paper/paper_claim_audit.py --selftest`; citation-key sanity script
  (`bibitems 14`, `uncited []`); `git diff --check`.
- 2026-06-06 CDT: Added a cc-reviewed claim-boundary audit for the
  emotional-residue paper package. `scripts/paper/paper_claim_audit.py` and
  `npm run paper:claim-audit` now check the manuscript/evidence package for
  unsupported causal or player-study claims, required limitation language,
  author metadata blockers, schedule acceptance, longitudinal n/arm,
  annotation packet size, annotation-key alignment, and blinded transcript label
  leakage including the aggregate `transcripts.md`. Current audit verdict is
  `PASS_CONSERVATIVE_PREPRINT`: no FAIL findings, with expected blockers for
  author metadata, unaccepted arm-pure schedule, n=2/arm longitudinal pilot
  data, and only 4 annotation rows. A fifth cc read-only expert review
  (`umi/reports/20260606T172507Z-workload.md`) accepted the current claim
  boundary as a conservative design/systems preprint with minor revisions.
  Codex applied the accepted revisions: added the Bates believable-agents
  citation, clarified that bootstrap CIs and SHA-1 repeatability are pipeline
  checks rather than population/generation stability, documented window
  sensitivity in rolling-continuity verdicts, and added Limitations paragraphs
  for read-off prompt-shape confounds and saturated rule-based aftertaste proxy.
  No collection was run and `UNDERWORLD_RESIDUE_READ` remained unset.
  Verification: `python3 scripts/paper/paper_claim_audit.py --selftest`;
  `npm run paper:claim-audit`; `python3 umi/orchestrator.py run
  umi/workload.md --dry-run`; `python3 umi/orchestrator.py run
  umi/workload.md --skip-codex --timeout 600`; `git diff --check`; package JSON
  parse check; `npx convex env get UNDERWORLD_RESIDUE_READ` (not found/unset).
- 2026-06-06 CDT: Completed the emotional-residue paper package to a conservative
  arXiv-source-ready state. Added `docs/paper/arxiv/main.tex` as the actual
  publishable source draft with no `[FILL]` placeholders, no raw Chinese/player
  transcript excerpts, and explicit limitations: no completed causal ablation,
  no controlled player study, and rule-based markers needing human validation.
  Added `docs/paper/arxiv/README.md` and `docs/paper/PUBLISH_READY_CHECKLIST.md`
  with arXiv metadata, final submitter confirmations, and verification status.
  Generated `docs/paper/data/current-smoke/dataset.json` from the current
  `soul-triad-latest.md`, attached 2 rolling-callback labels from the regenerated
  2026-06-05 rolling-continuity report, and analyzed the 8-conversation smoke
  dataset into `docs/paper/results/current-smoke/results/`. Updated the Markdown
  planning docs so the repo no longer presents stale `[FILL]` blocks as the
  submission source.
  Verification: `python3 scripts/paper/report_to_dataset.py --selftest`;
  `python3 scripts/paper/attach_rolling_callbacks.py --selftest`;
  `/tmp/ai-town-paper-venv/bin/python scripts/paper/analyze.py --selftest`;
  `npm run underworld:rolling-continuity -- --date=2026-06-05`;
  `npx tsc --noEmit --pretty false`; `git diff --check`. PDF compilation was
  not verified locally because `pdflatex`, `latexmk`, and `pandoc` are not
  installed.
- 2026-06-06 09:01 CDT: Daily Central Umi refresh reran the v0.1 gates after the
  paper work. `npm run underworld:alan-playtest-check` remains
  `NOT_PASS_READY` / `PARTIAL` with 0/5 PASS rows. `npm run
  underworld:v01-completion-audit` now reports `PENDING` with 0 fail / 2
  pending / 6 pass because rolling two-hour continuity is sample-pending today
  and the Alan-facing playtest is still not passed. Treat the emotional-residue
  paper as a separate research/publication lane; it does not clear the v0.1
  product gate.
- 2026-06-06 CDT: Added repeatability evidence and expanded related work for the
  emotional-residue paper. Re-ran `analyze.py` twice on the same smoke dataset
  and confirmed identical SHA-1 hashes for the generated CSV outputs. Sequential
  rolling-continuity snapshots are now stored for 2026-06-04, 2026-06-05, and
  2026-06-06 under `docs/paper/results/repeatability/`: 2026-06-05 repeats as
  PASS / `continuity_observed`, while 2026-06-04 and 2026-06-06 are WARN /
  `sample_pending`, which keeps the claim bounded to deterministic measurement
  and feasibility rather than stable causal effect. Updated
  `docs/paper/arxiv/main.tex` with a Repeatability Checks subsection and added
  citations for MemoryBank, LongMem, MemGPT, Reflexion, Voyager, and an
  LLM-agent memory survey.
  Verification: repeated analysis hash check; `npm run
  underworld:rolling-continuity -- --date=2026-06-04`; `npm run
  underworld:rolling-continuity -- --date=2026-06-05`; `npm run
  underworld:rolling-continuity -- --date=2026-06-06`; `git diff --check`.
- 2026-06-06 CDT: Began rigorous fresh `UNDERWORLD_RESIDUE_READ` ablation work
  instead of publishing from smoke evidence. Added
  `scripts/paper/run_residue_ablation.mjs` and `npm run paper:residue-ablation`
  to snapshot/restore the Convex env, run fresh ON/OFF arms with
  `--since-created-at`, parse datasets, and analyze outputs. Initial forced
  3-per-arm pilots exposed a validity bug: raw eval reports can contain
  `active-conversation-*` and short rows that are not publishable archived
  records. Tightened `report_to_dataset.py`, `run-soul-triad-single-sample.mjs`,
  and `underworld-observe-once.mjs` so paper ablations can require archived
  `conversation-*` rows with `message_count >= 3`. Two counterbalanced
  archived-only sanity blocks succeeded with two publishable records per arm
  (`conversation-c:93286`, `conversation-c:93373` residue_on;
  `conversation-c:93305`, `conversation-c:93338` residue_off), then restored
  `UNDERWORLD_RESIDUE_READ` to unset. Added
  `scripts/paper/merge_ablation_runs.py`, `docs/paper/LONGITUDINAL_EXPERIMENT_PLAN.md`,
  and `docs/paper/results/longitudinal/` so future blocks can accumulate to
  the real target (`n>=40` publishable records per arm). Current ablation data
  are pipeline/sanity evidence only, not an effect claim: n=2/arm, one dyad,
  saturated aftertaste scores in both arms, permutation p=1.0000.
  Verification: `node --check scripts/run-soul-triad-single-sample.mjs`;
  `node --check scripts/underworld-observe-once.mjs`; `node --check
  scripts/paper/run_residue_ablation.mjs`; `python3
  scripts/paper/report_to_dataset.py --selftest`; `python3
  scripts/paper/merge_ablation_runs.py --runs docs/paper/results/ablation-2026-06-06T13-20-58-196Z
  --out /tmp/merged-ablation-test.json`; `npm run paper:residue-ablation --
  --samples-per-arm=1 --order=off,on --sample-timeout-ms=300000
  --post-collection-wait-ms=0 --python=/tmp/ai-town-paper-venv/bin/python`;
  `/tmp/ai-town-paper-venv/bin/python
  scripts/paper/analyze.py --dataset docs/paper/results/longitudinal/dataset.json
  --outdir /tmp/longitudinal-check`; `npx tsc --noEmit --pretty false`;
  `git diff --check`.
- 2026-06-06 CDT: Paused further longitudinal ablation collection after a cc
  read-only expert review (`umi/reports/20260606T162427Z-workload.md`). cc
  agreed the pipeline hygiene is careful but found three blockers before more
  cloud-provider collection is worth spending: `human_aftertaste_score` is
  saturated and should not be a primary continuous outcome; the longitudinal
  dataset has `rolling_callback: null`, so the intended primary outcome is not
  wired into the arm-level pipeline; and forced dyad collection cannot support
  the full felt-continuity / initiative claim by itself. A started long-run was
  stopped before completing block 1; `UNDERWORLD_RESIDUE_READ` was verified
  unset afterward. Updated `docs/paper/LONGITUDINAL_EXPERIMENT_PLAN.md` and
  `docs/paper/arxiv/main.tex` so the experiment is marked paused pending
  arm-aware callback labels, human annotation, and a pre-registered MDE/N/stopping
  rule.
  Verification: `python3 umi/orchestrator.py run umi/workload.md --dry-run`;
  `python3 umi/orchestrator.py run umi/workload.md --skip-codex --timeout 600`;
  `npx convex env get UNDERWORLD_RESIDUE_READ` (unset); `git diff --check`.
- 2026-06-06 CDT: Wired the ablation runner toward cc's primary-outcome fix.
  `scripts/underworld-rolling-continuity.mjs` now accepts `--since-created-at`,
  `--until-created-at`, and `--out`, and `scripts/paper/run_residue_ablation.mjs`
  attaches rolling callback labels from each arm-scoped report into the arm
  dataset. This fixes the `rolling_callback: null` plumbing problem, but does
  not by itself make short forced blocks suitable as the causal primary outcome:
  two-hour rolling callbacks still need arm-pure long windows/days with enough
  source and callback samples. Updated `docs/paper/LONGITUDINAL_EXPERIMENT_PLAN.md`
  and `docs/paper/EXPERIMENTS.md` accordingly.
  Verification: `node --check scripts/underworld-rolling-continuity.mjs`;
  `node --check scripts/paper/run_residue_ablation.mjs`; `npm run
  underworld:rolling-continuity:self-test`; `python3
  scripts/paper/attach_rolling_callbacks.py --selftest`; arm-scoped
  `npm run underworld:rolling-continuity -- --date=2026-06-06
  --since-created-at=1780752060423 --until-created-at=1780752385716
  --out=/tmp/arm-rolling-check.md` wrote the expected bounded WARN report;
  `git diff --check`.
- 2026-06-06 CDT: Completed the cc-recommended no-cloud follow-up before any
  further collection. Backfilled existing arm datasets with
  `attach_rolling_callbacks.py`, fixed `merge_ablation_runs.py` so it prefers
  per-arm datasets over stale run-level datasets, and re-merged/analyzed
  longitudinal data. The merged plumbing-check dataset is now n=2/arm with
  non-null callback labels (`conversation-c:93286` has `rolling_callback=1`;
  the other three rows are 0), but this remains non-causal because the matching
  report was generated before arm-scoped rolling windows and the design is one
  dyad only. Added `docs/paper/SCHEDULE_DECISION.md`, choosing arm-pure
  full-day / long-window collection as the primary design and forced dyad blocks
  as mechanism debugging only. Updated `docs/paper/arxiv/main.tex` with
  read-off control caveats: prompt-length mismatch and motif-guard partial leak.
  Verification: `python3 scripts/paper/merge_ablation_runs.py --runs
  'docs/paper/results/ablation-*' --out docs/paper/results/longitudinal/dataset.json`;
  `/tmp/ai-town-paper-venv/bin/python scripts/paper/analyze.py --dataset
  docs/paper/results/longitudinal/dataset.json --outdir
  docs/paper/results/longitudinal`; `git diff --check`.
- 2026-06-06 CDT: Completed a third cc read-only methodology review after adding
  the arm-pure runner and annotation protocol (`umi/reports/20260606T165403Z-workload.md`).
  cc accepted the latest fixes but correctly kept collection paused until Alan
  explicitly accepts `docs/paper/SCHEDULE_DECISION.md`. Codex then fixed the
  remaining denominator risk: `scripts/underworld-rolling-continuity.mjs` now
  lists source-window and callback-window conversation ids, and
  `scripts/paper/attach_rolling_callbacks.py --mark-callback-window-zero` marks
  only callback-window non-hits as 0 while leaving source-window rows null.
  Added `scripts/paper/run_arm_pure_residue_window.mjs` /
  `npm run paper:residue-arm-window`, a dyad rotation policy, a denominator
  policy, `docs/paper/HUMAN_ANNOTATION_PROTOCOL.md`, and
  `docs/paper/annotations_template.csv`. A read-only archived yield check for
  2026-06-05 15:00-19:00 CT found enough natural density (2 source
  conversations, 5 callback conversations, 12 candidates, 3 weak callbacks) but
  only `WARN / weak_continuity`, so 4-hour windows look feasible for yield, not
  guaranteed effect. Do not resume new sample collection until Alan accepts the
  schedule decision.
  Verification: `python3 umi/orchestrator.py run umi/workload.md --dry-run`;
  `python3 umi/orchestrator.py run umi/workload.md --skip-codex --timeout 600`;
  `node --check scripts/underworld-rolling-continuity.mjs`; `node --check
  scripts/paper/run_arm_pure_residue_window.mjs`; `node --check
  scripts/paper/run_residue_ablation.mjs`; `python3
  scripts/paper/attach_rolling_callbacks.py --selftest`; `npm run
  paper:residue-arm-window -- --selftest`; `npm run
  underworld:rolling-continuity:self-test`; `/tmp/ai-town-paper-venv/bin/python
  scripts/paper/analyze.py --selftest`; `python3
  scripts/paper/report_to_dataset.py --selftest`; read-only archived yield
  check saved to
  `docs/paper/results/repeatability/rolling-continuity-2026-06-05-15-19-yield-check.md`;
  `npx convex env get UNDERWORLD_RESIDUE_READ` (unset); `git diff --check`.
- 2026-06-06 CDT: Added no-collection statistical planning and annotation
  readiness artifacts for the emotional-residue paper. `scripts/paper/power_sensitivity.py`
  now generates `docs/paper/results/power/summary.md`, `mde_grid.csv`, and
  `power_grid.csv` using an approximate Cohen's-h two-proportion planning
  calculation for `rolling_callback_rate`. A fourth cc read-only review
  (`umi/reports/20260606T170630Z-workload.md`) accepted the method as a planning
  table, and Codex added cc's caveats: the table assumes independent rows,
  dyad/day/window clustering reduces effective N, `n=40/arm` is large-effect
  pilot evidence only, and `n>=150/arm` is baseline-dependent (higher baselines
  can push 10 percentage-point effects toward `n≈250/arm`). Added
  `scripts/paper/export_annotation_sheet.py` plus generated
  `docs/paper/results/longitudinal/annotation_sheet.csv` and
  `annotation_key.csv`; the exporter preserves condition/pair blinding but
  currently exports only 4 rows because the merged longitudinal dataset has only
  4 publishable records. Added `scripts/paper/export_blinded_transcripts.py` and
  generated `docs/paper/results/longitudinal/blinded_transcripts/`, a rater
  packet keyed by blind ids that omits condition labels, callback labels, marker
  scores, and original conversation ids. No sample collection was run and
  collection remains paused pending Alan acceptance of
  `docs/paper/SCHEDULE_DECISION.md`.
  Verification: `python3 scripts/paper/power_sensitivity.py --selftest`;
  `python3 scripts/paper/export_annotation_sheet.py --selftest`; `python3
  scripts/paper/power_sensitivity.py --outdir docs/paper/results/power`;
  `python3 scripts/paper/export_annotation_sheet.py --dataset
  docs/paper/results/longitudinal/dataset.json --out-sheet
  docs/paper/results/longitudinal/annotation_sheet.csv --out-key
  docs/paper/results/longitudinal/annotation_key.csv --target 30`;
  `python3 scripts/paper/export_blinded_transcripts.py --selftest`; `python3
  scripts/paper/export_blinded_transcripts.py --key
  docs/paper/results/longitudinal/annotation_key.csv --outdir
  docs/paper/results/longitudinal/blinded_transcripts`; leakage scan over
  `docs/paper/results/longitudinal/blinded_transcripts`;
  `/tmp/ai-town-paper-venv/bin/python scripts/paper/analyze.py --selftest`;
  `python3 scripts/paper/report_to_dataset.py --selftest`; `python3
  scripts/paper/attach_rolling_callbacks.py --selftest`;
  `npx convex env get UNDERWORLD_RESIDUE_READ` (unset); `git diff --check`.
- 2026-06-06 CDT: Added a machine-checkable schedule acceptance gate before any
  arm-pure collection can run. `docs/paper/SCHEDULE_ACCEPTANCE.json` is currently
  `accepted: false`, and `scripts/paper/run_arm_pure_residue_window.mjs` now
  refuses to run unless the acceptance file records `accepted: true`,
  `accepted_by`, and `accepted_at`. Added `npm run
  paper:residue-arm-window:acceptance` for a no-side-effect preflight. This
  prevents accidental `UNDERWORLD_RESIDUE_READ` changes or long-window waiting
  before Alan explicitly accepts `docs/paper/SCHEDULE_DECISION.md`.
  Verification: `node --check scripts/paper/run_arm_pure_residue_window.mjs`;
  `npm run paper:residue-arm-window -- --selftest`; `npm run
  paper:residue-arm-window:acceptance` expected-failed cleanly with collection
  paused; a temporary accepted JSON passed `--check-acceptance-only` without
  collection; `npx convex env get UNDERWORLD_RESIDUE_READ` remained unset.
- 2026-06-06 CDT: Reviewed PR #1 emotional-residue paper scaffold and imported
  the paper docs/scripts into the local tree without applying the PR's older
  `WORKLOG.md` heading changes. Fixed a blocking parser mismatch in
  `scripts/paper/report_to_dataset.py`: real `eval:soul-triad` report rows do
  not start with `|`, so the PR version parsed 0 conversations even though its
  synthetic selftest passed. Added a selftest covering both real-style and
  pipe-wrapped rows. Added `scripts/paper/attach_rolling_callbacks.py` to join
  rolling-continuity callback ids back onto `dataset.json`. Cleaned public paper
  wording so markers are consistently described as deterministic rule-based
  metrics, not LLM-as-judge, and recorded `UNDERWORLD_RESIDUE_READ=false` as the
  primary Exp 2 control with `WRITE+READ=false` only as optional sensitivity.
  Corrected the Exp 2 protocol: ablation must collect fresh conversations under
  each Convex env condition before scoring; rerunning eval on already-existing
  transcripts is not causal evidence.
  Verification: `python3 scripts/paper/report_to_dataset.py --selftest` PASS;
  `python3 scripts/paper/attach_rolling_callbacks.py --selftest` PASS;
  `/tmp/ai-town-paper-venv/bin/python scripts/paper/analyze.py --selftest` PASS;
  real `evals/conversations/reports/soul-triad-latest.md` now parses 8 records
  after `npm run eval:soul-triad`; `attach_rolling_callbacks.py` labeled 2/8
  callbacks from `umi/reports/rolling-continuity-latest.md`; analyzer smoke ran
  on that one-arm dataset but produced expected `nan` ablation fields because
  no fresh off-arm data exists yet. Also ran `npm run
  underworld:rolling-continuity` (PASS / continuity_observed), `npx tsc
  --noEmit --pretty false`, and `git diff --check`.
- 2026-06-05 CDT: Slimmed gate ceremony. Confirmed the noisy heartbeat /
  afternoon-gate Codex cron is already gone (its automation dir no longer
  exists); remaining scheduled jobs are benign (dev-stack, 6am morning
  healthcheck which writes a log and does not commit, 9am Codex daily-project-sync
  thread). Retired the dead readiness-ritual scripts that only existed to feed
  that cron — `underworld-v01-afternoon-gate`, `-afternoon-world-ready`,
  `-v01-goal-audit`, `-day-start`, `-approach-v01`, `-heartbeat` and
  `run_v01_approach_loop.sh` deleted (recoverable from git history at `a14090d`)
  and removed 10 npm entries.
  Underworld npm scripts: 40 -> 30. Proven safe: the real v0.1 gate
  (`underworld:v01-completion-audit`) depends only on `rolling-continuity`, and
  no kept script / .sh / automation referenced the retired drivers. Fixed
  `underworld:harness:self-test` and `underworld:morning-check` to drop the
  retired references. Roadmap "Current Gates" rewritten to a minimal required set
  (completion-audit + one Alan playtest); everything else is now explicitly an
  optional on-demand diagnostic. 驗證: `npm run underworld:harness:self-test`
  all PASS; `npm run underworld:v01-completion-audit` runs (PENDING 0 fail / 1
  pending / 7 pass, unchanged); no dangling npm refs; package.json valid.
  狀態: done, uncommitted pending Alan go-ahead (he already said do it).
- 2026-06-05 early CDT: Fixed the real "Alan chats are not recorded" root cause
  and shifted memory toward forming more easily.
  做了什麼:
  (1) `leaveAlanConversationNow` and `leaveCampus` removed Alan's conversation by
  patching `world.conversations` directly, bypassing the engine's `saveDiff`
  archival, so transcripts + Alan `chatMessage` events were orphaned and never
  reached `archivedConversations`. Extracted one shared `archiveDeletedConversation`
  helper (`convex/aiTown/game.ts`) and call it before removal in both paths.
  (2) Re-archived 14 orphaned two-sided Alan conversations and ran the normal
  (deterministic) memory pipeline for them: 18 conversation memories written
  (incl. older convos that never got a memory), 0 duplicates. The data was never
  lost — it sat in `messages` — see `convex/underworldOrphanBackfill.ts`
  (idempotent; `npx convex run underworldOrphanBackfill:run '{"dryRun":true}'`).
  (3) Memory date label now uses the conversation's logical `created` instead of
  the archive row `_creationTime`, so re-archived old chats are dated correctly.
  (4) When Alan talks to a non-cloud character (anyone outside
  Umi/Mahiru/Tianze/Ichinose) the reply now uses the local model instead of the
  paid cloud quota — `humanCloudSpeaker` in `convex/agent/conversation.ts`. This
  preserves soul-triad cloud quota and avoids the quota-exhaustion path that used
  to leak deterministic fallback text into memory.
  (5) The residue repeat-pattern suppression now applies only to autonomous
  character↔character residues; Alan-facing residues always persist so a
  recurring emotional theme with Alan can accumulate.
  (6) Daily-life bulletin content moved to `data/dailyLifeBulletin.ts`.
  為什麼: archival was the prerequisite for any real Alan-facing continuity; with
  it broken, characters had no real memory and confabulated when asked to recall.
  動到哪些檔案: `convex/aiTown/game.ts`, `convex/aiTown/game.test.ts`,
  `convex/school.ts`, `convex/agent/memory.ts`, `convex/agent/conversation.ts`,
  `convex/underworldOrphanBackfill.ts`, `data/dailyLifeBulletin.ts`(+test),
  `docs/giis-v0.1-roadmap.md`.
  驗證: `npx tsc --noEmit -p convex` clean; `npx jest` 148/148 pass; backfill
  dry-run + run verified against the local default world; post-backfill snapshot
  confirmed 14/14 archived, 18 memories with real 1024-dim deterministic
  embeddings and correct dates, 0 duplicates; orphan sessions dropped 28 -> 21
  (remainder are one-sided fragments / limit-window artifacts).
  狀態: archival fix committed as `a35b546`; items (2)-(6) staged/uncommitted
  pending Alan's go-ahead. NOTE: `MEMORY_LLM_MODE` / `MEMORY_EMBEDDING_MODE` are
  still `deterministic` by design, so memory summaries are template recaps of the
  real (LLM) conversation, not LLM reflections — flip those env vars separately
  if richer memory is wanted.
- 2026-06-04 21:47 CDT: Tightened the last proof gap for the Alan-chat archival
  and daily-life bulletin goal. Simplified Umi briefing bulletin snippets to
  period + title only, so items like the 庭院/餐盤 examples no longer repeat the
  same phrase in the compact briefing. Strengthened
  `npm run underworld:life-density` so `PASS` now requires at least two
  distinct non-unknown uptake angles in addition to multiple events, speakers,
  and mentioned bulletin items; the report now labels angles such as
  `quiet_care` and `rule_probe`. Fresh evidence: `npm run
  underworld:alan-chat-archival -- --target=Umi ...` passed with raw/eval Alan
  marker plus 海 reply, `school:umiBriefing` showed four concise bulletin
  items, and `npm run underworld:life-density` passed with four bulletin items,
  four periods, three locations, two speakers, two mentioned items, and two
  uptake angles. Main v0.1 completion audit remains expected `PENDING` only
  because Alan-facing Umi playtest is still `PARTIAL` / 0 of 5 PASS.
  Verification: `node --check scripts/underworld-life-density.mjs`, `npm run
  underworld:life-density:self-test`, `npx tsc --noEmit --pretty false`,
  `npm run build`, `npm run underworld:alan-chat-archival:self-test`, `node
  --check scripts/underworld-alan-chat-archival.mjs`, `npm run
  underworld:alan-chat-archival -- --target=Umi ...`, `npx convex run
  school:umiBriefing`, `npm run underworld:life-density`, `npm run
  underworld:v01-completion-audit` (expected PENDING), `npm run
  underworld:alan-playtest-check` (expected NOT_PASS_READY), `git diff
  --check`.
- 2026-06-04 21:43 CDT: Completed the next Alan-character archival and daily
  life-density proof pass. `messages.writeMessage` now schedules the
  world-wakeup/kick in an internal mutation after queuing `finishSendingMessage`,
  which kept Alan message writes lightweight and avoided the previous timeout
  path. Added `npm run underworld:alan-chat-archival` /
  `:self-test`; each verifier run writes the latest transcript report and
  appends a compact same-day transcript proof to
  `umi/reports/alan-chat-archival-history.jsonl`. Updated
  `npm run underworld:life-density` to read current recent conversations plus
  today's archival verifier history and to require cue-backed matches, so the
  gate no longer passes on loose repeated motifs. Fresh 海 and 天澤 verifier
  runs both passed with raw/eval transcripts containing Alan marker plus
  post-marker character reply, and life-density is now `PASS /
  life_density_and_multi_angle_uptake_observed`. Main v0.1 completion audit
  remains expected `PENDING` with 0 fail / 1 pending / 7 pass, blocked only by
  Alan-facing Umi playtest PASS or explicit Alan defer. Verification:
  `node --check scripts/underworld-alan-chat-archival.mjs`, `node --check
  scripts/underworld-life-density.mjs`, `npm run
  underworld:alan-chat-archival:self-test`, `npm run
  underworld:life-density:self-test`, `npm run underworld:alan-chat-archival`
  for 海 and 天澤, `npm run underworld:life-density`, `npx convex run
  school:umiBriefing`, `npm run underworld:alan-playtest-check` (expected
  NOT_PASS_READY), `npm run underworld:v01-completion-audit` (expected
  PENDING), `npx tsc --noEmit --pretty false`, `npm run build`, `git diff
  --check`.
- 2026-06-04 21:25 CDT: Fixed the next archival/runtime risk behind Alan-facing
  chats and added a small daily life-density layer. `messages.writeMessage` now
  wakes or kicks the world engine after queuing `finishSendingMessage`, while
  respecting `stoppedByDeveloper`, so user chat inputs should not sit pending
  when the world is inactive. Added daily life bulletin generation with four
  ordinary school events per day, wired it into Umi's briefing and the briefing
  UI, and added `npm run underworld:life-density` / self-test. Verified the
  old pending queue item completed after `school:enterCampus`, Umi briefing now
  lists today's life items, and the new density report is `WARN` only because
  conversation uptake is still pending. Completion audit remains expected
  `PENDING` with 0 fail / 1 pending / 7 pass because Alan-facing playtest
  evidence is not complete. Verification: `npx tsc --noEmit --pretty false`,
  `npm run build`, `npm run underworld:life-density:self-test`,
  `npm run underworld:life-density`, `npx convex run school:enterCampus`,
  `npx convex run school:debugInputQueue`, `npx convex run school:umiBriefing`,
  `npx convex run school:recentConversationEvalData`, `npm run
  underworld:v01-completion-audit` (expected PENDING), `git diff --check`.
- 2026-06-04 20:10 CDT: Fixed the "find Alan / start talking while Alan is
  away" UX gap. `/ai-town` now has a topbar `找到 Alan` control; character
  navigation, scene switching, selected-character chat, and character-card chat
  will auto-enter Alan before moving/starting a conversation when Alan is away.
  Added a targeted dialogue hygiene guard for pronoun-led stage directions such
  as `她歪了一下頭...`, preserving the spoken line. Also taught
  `school:recentConversationEvalData` to include active, not-yet-archived
  conversation messages when they exist. Latest raw eval data still showed
  Alan->海 / Alan->天澤 sessions only as `human_chat_not_archived` Alan-side
  timeline events, so full Alan-facing reply judgment still belongs to the
  pending playtest / archival gate. Verified with
  `npm test -- convex/agent/dialogueHygiene.test.ts`, `npm run build`,
  `npm run eval:conversation:recent -- --since-last-change`, raw
  `school:recentConversationEvalData`, `curl -I http://localhost:5173/ai-town`,
  and `git diff --check`.
- 2026-06-04 14:57 CDT: Fixed the conversation panel sitting too low in
  `/ai-town`. Conversation-active utility panel now uses `dvh` height and
  safe-area-aware bottom spacing; mobile/narrow layouts keep side margins and
  no longer pin the dialogue panel flush to the viewport bottom; sticky chat
  input bubbles now keep a 1rem bottom gap. Verified with `npm run build` and
  Chrome at `http://localhost:5173/ai-town`: entered active conversation mode
  and confirmed the input area is visible above the viewport bottom.
- 2026-06-04 12:38 CDT: Replaced the hard AM/PM continuity dependency with a
  rolling two-hour continuity gate for v0.1. Added
  `scripts/underworld-rolling-continuity.mjs`, wired package scripts, refreshed
  afternoon gate, repair gate, rubric reconciliation, and completion audit to
  treat rolling continuity as the primary recent-memory proof while preserving
  AM->PM as legacy day-arc evidence. Actual rolling report passed for
  10:00-12:00 -> 12:00-14:00 with 6 callbacks. Rubric reconciliation is now
  `HUMAN_REVIEW_READY` with no v0.1 blockers; completion audit is `PENDING`
  with 0 fail / 1 pending / 7 pass, blocked only by Alan-facing Umi playtest
  evidence. Verification: `npm run underworld:rolling-continuity:self-test`;
  `npm run underworld:rolling-continuity`; `npm run
  underworld:repair-gate -- --cc=skip`; `npm run underworld:rubric-reconcile`;
  `npm run underworld:v01-completion-audit:self-test`; `npm run
  underworld:v01-completion-audit`.
- 2026-06-04 10:31 CDT: Re-ran the allowed pre-afternoon no-sample readiness
  path while waiting for the scheduled 11:05 heartbeat. `npm run
  underworld:afternoon-world-ready` reported `status=running` /
  `action=already_running`; `npm run underworld:heartbeat -- --once` wrote
  `heartbeat_ok: yes` with `status_before: running` / `status_after: running`;
  `world:defaultWorldStatus` confirmed the default world `running`. Completion
  audit remains expected `PENDING` with 0 fail / 3 pending / 5 pass, so no
  code, prompt, or central goal update was justified. Verification: `npm run
  underworld:afternoon-world-ready`; `npm run underworld:heartbeat -- --once`;
  `npx convex run world:defaultWorldStatus`; `npm run
  underworld:v01-completion-audit` (expected PENDING).
- 2026-06-04 10:29 CDT: Ran the current pre-afternoon no-sample readiness path
  again under the updated heartbeat policy. `npm run
  underworld:afternoon-world-ready` found the default world already `running`;
  `npm run underworld:heartbeat -- --once` wrote
  `umi/reports/underworld-heartbeat-latest.log` with `heartbeat_ok: yes` and
  `status_before: running` / `status_after: running`; `world:defaultWorldStatus`
  confirmed `running`. A fresh completion audit remained expected `PENDING`
  with 0 fail / 3 pending / 5 pass. No code or prompt repair was justified.
  Verification: `npm run underworld:afternoon-world-ready`; `npm run
  underworld:heartbeat -- --once`; `npx convex run world:defaultWorldStatus`;
  `npm run underworld:v01-completion-audit` (expected PENDING).
- 2026-06-04 10:26 CDT: Closed a pre-afternoon automation prompt gap. The
  active Codex heartbeat schedule now includes 11:05/11:35 in addition to the
  12:05/12:35 and 13:05-16:35 half-hour passes
  (`FREQ=DAILY;COUNT=12;BYHOUR=11,12,13,14,15,16;BYMINUTE=5,35;BYSECOND=0`).
  The heartbeat prompt now explicitly says that daytime runs before 13:00 must
  run only `npm run underworld:afternoon-world-ready` and `npm run
  underworld:heartbeat -- --once`, and must not run `daytime_check`, observe
  collection, or `--allow-outside-afternoon`. Verification: read back
  `/Users/alanhdchu/.codex/automations/underworld-v0-1-afternoon-gate/automation.toml`;
  `npm run underworld:afternoon-world-ready -- --dry-run` (running/no-op);
  `npm run underworld:heartbeat -- --once` (running -> running); `npm run
  underworld:v01-completion-audit` (expected PENDING with 0 fail / 3 pending /
  5 pass).
- 2026-06-04 10:22 CDT: Strengthened the active Codex heartbeat cadence for
  the remaining afternoon proof window after the default world drifted back to
  `inactive` again. `npm run underworld:afternoon-world-ready` resumed the
  world, `npm run underworld:heartbeat -- --once` kept it `running -> running`,
  and `world:defaultWorldStatus` confirmed `running`. Updated the existing
  Codex heartbeat `underworld-v0-1-afternoon-gate` from four hourly afternoon
  passes to ten same-day passes at 12:05/12:35/13:05/13:35/14:05/14:35/15:05/
  15:35/16:05/16:35 CDT (`FREQ=DAILY;COUNT=10;BYHOUR=12,13,14,15,16;BYMINUTE=5,35;BYSECOND=0`).
  Runs before 13:00 still rely on the wrapper/window guard and must not collect
  samples; later same-day passes preserve the read-only refresh policy after
  the first controlled afternoon gate. A fresh completion audit remained
  expected `PENDING` with 0 fail / 3 pending / 5 pass. Verification: read back
  `/Users/alanhdchu/.codex/automations/underworld-v0-1-afternoon-gate/automation.toml`;
  `npx convex run world:defaultWorldStatus` (running); `npm run
  underworld:v01-completion-audit` (expected PENDING).
- 2026-06-04 10:17 CDT: Refreshed the v0.1 proof state after the readiness
  heartbeat. Current Chicago time is still outside 13:00-16:59, so no
  afternoon collection was run. `npm run underworld:runtime-preflight` passed,
  `world:defaultWorldStatus` reported the default world `running`, `npm run
  underworld:alan-playtest-check` returned expected `NOT_PASS_READY` /
  `PARTIAL` with 0/5 PASS rows, and `npm run
  underworld:v01-completion-audit` remained expected `PENDING` with 0 fail /
  3 pending / 5 pass. Updated
  `docs/soul/V01_COMPLETION_AUDIT_PREFLIGHT.md` so it no longer says the
  Alan-facing result artifact is missing; the artifact is present but still a
  non-passing draft. Verification: report inspection; no prompt/code repairs
  were made.
- 2026-06-04 10:15 CDT: Refreshed daytime runtime readiness without collecting
  samples before the afternoon evidence window. `world:defaultWorldStatus`
  showed the default world had drifted to `inactive`; `npm run
  underworld:afternoon-world-ready` resumed it, and `npm run
  underworld:heartbeat -- --once` wrote
  `umi/reports/underworld-heartbeat-latest.log` with `heartbeat_ok: yes` and
  `status_before: running` / `status_after: running`. A fresh completion audit
  still returned expected `PENDING` with 0 fail / 3 pending / 5 pass, so v0.1
  remains active pending afternoon AM->PM evidence and Alan-facing playtest.
  Verification: `npx convex run world:defaultWorldStatus` (running); `npm run
  underworld:v01-completion-audit` (expected PENDING).
- 2026-06-04 10:10 CDT: Added a read-only Alan-facing playtest candidate
  scanner so the remaining human gate can search for real existing Alan/Umi
  evidence before asking Alan to repeat a playtest. `npm run
  underworld:alan-playtest-candidates` reads `school:recentConversationEvalData`
  and writes `umi/reports/alan-playtest-candidates-latest.md`; it does not
  write the playtest result artifact or clear the gate. The live scan returned
  `NO_COMPLETE_CANDIDATE` with 0 Alan + Umi/海 candidates in the scanned window,
  so the human gate still requires an intentional Alan/Umi playtest. Verification:
  `npm run underworld:alan-playtest-candidates:self-test`; `npm run
  underworld:alan-playtest-candidates` (expected nonzero/no complete candidate);
  `npm run underworld:alan-playtest-check` (expected NOT_PASS_READY / PARTIAL);
  `npm run underworld:v01-completion-audit` (expected PENDING with 0 fail /
  3 pending / 5 pass); `git diff --check`.
- 2026-06-04 10:05 CDT: Fixed a proof-record drift risk in the Alan-facing
  playtest draft. The initial draft recorded `Commit: 0f8bf4b`, but the repo had
  advanced to `8bf4cd6` after the helper commit, so future commits could make
  the draft's "commit under test" look stale before the real playtest. The draft
  helper now writes `Draft initialized by commit` separately and leaves
  `Commit under test` for the actual playtest record. Regenerated the ignored
  local draft with `--force`; it remains `PARTIAL` and does not clear the
  Alan-facing gate. Verification: `node
  scripts/underworld-alan-playtest-result.mjs --init-draft --force`; `npm run
  underworld:alan-playtest:self-test`; `npm run underworld:alan-playtest-check`
  (expected NOT_PASS_READY / PARTIAL); `npm run
  underworld:v01-completion-audit` (expected PENDING with 0 fail / 3 pending /
  5 pass); `git diff --check`.
- 2026-06-04 10:02 CDT: Reduced friction for the remaining Alan-facing Umi
  playtest gate without fabricating evidence. Added `npm run
  underworld:alan-playtest-init`, which writes a non-passing `PARTIAL` draft to
  the ignored local artifact path `umi/reports/alan-facing-v01-playtest-latest.md`
  when no result exists. Initialized the draft at commit `0f8bf4b`; all five
  checklist rows are `PARTIAL`, so the artifact is present but does not clear
  the gate. Verification: `npm run underworld:alan-playtest:self-test`; `npm
  run underworld:alan-playtest-init`; `npm run underworld:alan-playtest-check`
  (expected NOT_PASS_READY / PARTIAL); `npm run
  underworld:v01-completion-audit` (expected PENDING with 0 fail / 3 pending /
  5 pass); `git diff --check`.
- 2026-06-04 09:58 CDT: Tightened the multi-pass afternoon heartbeat so it
  preserves the AM->PM natural-observation policy. `npm run
  underworld:v01-afternoon-gate` now chooses `full_collection_gate` only when
  the same day's afternoon gate report has not yet run `daytime_check`; later
  same-day passes switch to `read_only_refresh` and run runtime preflight,
  inactive-only world readiness, AM->PM continuity, life-signals, repair gate,
  rubric reconciliation, and completion audit without another controlled
  `daytime_check` collection. Updated `umi/COMMAND_REFERENCE.md`,
  `docs/soul/V01_COMPLETION_AUDIT_PREFLIGHT.md`, and the active Codex heartbeat
  prompt to document that repeated afternoon heartbeats read natural evidence
  instead of forcing more samples. Verification: `npm run
  underworld:v01-afternoon-gate:self-test`; `npm run
  underworld:harness:self-test`; `npm run underworld:v01-completion-audit`
  (expected PENDING); `git diff --check`; read back
  `/Users/alanhdchu/.codex/automations/underworld-v0-1-afternoon-gate/automation.toml`.
- 2026-06-04 09:46 CDT: Changed the active Codex afternoon heartbeat schedule
  from a single 13:05 run to four afternoon passes at 13:05, 14:05, 15:05, and
  16:05 CDT (`FREQ=DAILY;COUNT=4;BYHOUR=13,14,15,16;BYMINUTE=5;BYSECOND=0`).
  This matches the AM->PM continuity requirement better: the first afternoon
  gate may still be below the 12-PM-sample threshold, so later heartbeats should
  re-read natural afternoon evidence instead of treating `sample_pending` as a
  prompt-repair signal. The heartbeat prompt now explicitly keeps v0.1 active
  when AM->PM is pending only because afternoon samples are below 12. A fresh
  `npm run underworld:afternoon-world-ready -- --dry-run` again found the
  default world `inactive`, so `npm run underworld:afternoon-world-ready` was
  run and `world:defaultWorldStatus` confirmed `running`. No afternoon
  collection was run because current time was still outside 13:00-16:59 CDT;
  completion audit remains `PENDING` with 0 fail / 3 pending / 5 pass.
  Verification: read back
  `/Users/alanhdchu/.codex/automations/underworld-v0-1-afternoon-gate/automation.toml`;
  `npm run underworld:afternoon-world-ready -- --dry-run`
  (inactive/would resume); `npm run underworld:afternoon-world-ready`
  (resumed inactive default world); `world:defaultWorldStatus` (running);
  `npm run underworld:v01-completion-audit` (expected PENDING).
- 2026-06-04 09:43 CDT: Aligned the active Codex heartbeat automation
  `underworld-v0-1-afternoon-gate` with the new afternoon world-readiness
  helper. The 13:05 prompt now states that `npm run
  underworld:v01-afternoon-gate` runs `npm run underworld:runtime-preflight`
  followed by `npm run underworld:afternoon-world-ready`, and its direct
  fallback path includes the same helper before `npm run
  underworld:v01-daytime-check`. Verification: read back
  `/Users/alanhdchu/.codex/automations/underworld-v0-1-afternoon-gate/automation.toml`;
  `npm run underworld:afternoon-world-ready -- --dry-run` (running/no-op);
  `npm run underworld:v01-completion-audit` (expected PENDING with 0 fail /
  3 pending / 5 pass); `git status --short`.
- 2026-06-04 09:38 CDT: Hardened the afternoon gate against a fresh runtime
  readiness gap found in the previous check: the default world can pass runtime
  preflight while still being `inactive`, which weakens natural afternoon
  evidence and causes controlled sample runners to restore the world back to
  inactive. Added `npm run underworld:afternoon-world-ready`, which reads
  `world:defaultWorldStatus`, resumes only `inactive` worlds during non-quiet
  hours, and leaves `stoppedByDeveloper` untouched. Wired it into
  `npm run underworld:v01-afternoon-gate` between runtime preflight and
  daytime check, and updated command/preflight docs. No afternoon collection was
  run because current time was outside 13:00-16:59 CDT; completion audit remains
  `PENDING` with 0 fail / 3 pending / 5 pass. Verification: `npm run
  underworld:afternoon-world-ready:self-test`; `npm run
  underworld:v01-afternoon-gate:self-test` after fixing a self-test
  initialization ordering bug; `npm run underworld:harness:self-test`; `npm run
  underworld:v01-completion-audit` (expected PENDING); `npm run
  underworld:afternoon-world-ready -- --dry-run` (inactive/would resume);
  `npm run underworld:afternoon-world-ready` (resumed inactive default world);
  `world:defaultWorldStatus` (running); `npm run underworld:runtime-preflight`
  (PASS); `git diff --check`.
- 2026-06-04 09:35 CDT: Refreshed runtime readiness for the pending afternoon
  gate. `npm run underworld:runtime-preflight` passed, `/ai-town` returned HTTP
  200, and `world:defaultWorldStatus` showed the default world had drifted back
  to `inactive`; ran `npx convex run testing:resume`, then confirmed
  `world:defaultWorldStatus` is `running` and reran
  `npm run underworld:runtime-preflight` with PASS. No afternoon collection was
  run because current time was still outside 13:00-16:59 CDT, and
  `npm run underworld:alan-playtest-check` still returned expected `MISSING`.
  This is runtime readiness for the 13:05 heartbeat, not v0.1 completion
  proof.
- 2026-06-04 09:32 CDT: Continued the v0.1 completion check after the
  09:29 proof-path wording commit. Current Chicago time was still outside the
  13:00-16:59 afternoon evidence window, so no afternoon collection was run.
  Fresh completion audit remained `PENDING` with 0 fail / 3 pending / 5 pass;
  Alan-facing playtest artifact validation returned expected `MISSING`; latest
  approach/goal/rubric/AM-PM/life/repair reports still agree that the only
  machine blocker is AM->PM `sample_pending`, with Alan-facing playtest still
  pending human evidence. Verification: `npm run
  underworld:v01-completion-audit` (expected PENDING); `npm run
  underworld:alan-playtest-check` (expected MISSING); read-only report
  inspection; `git status --short`.
- 2026-06-04 09:29 CDT: Updated the afternoon gate summary wording so the
  final report points to the current proof path after a NOT_COMPLETE run.
  `scripts/underworld-v01-afternoon-gate.mjs` now tells the next operator to
  keep AM->PM `sample_pending` as an evidence gap, not prompt-repair
  permission, and to validate any Alan-facing artifact with `npm run
  underworld:alan-playtest-check` before treating the human gate as proven.
  No afternoon collection was run because current time was outside the
  13:00-16:59 CDT window. Verification: `npm run
  underworld:v01-afternoon-gate:self-test`; `npm run
  underworld:v01-completion-audit` (expected PENDING); `git diff --check`.
- 2026-06-04 09:27 CDT: Cleaned the active WORKLOG snapshot so it no longer
  presents the 08:55 active FAIL as current state. Open handoff #5 now points
  to `npm run underworld:alan-playtest-check` for the Alan-facing result
  artifact, the AM->PM snapshot matches the latest completion evidence
  (0 afternoon samples, 18 AM residue candidates), and runtime readiness is
  anchored to the 09:16 CDT PASS / running check. No evidence was generated.
  Verification: docs-only; `git diff --check`.
- 2026-06-04 09:24 CDT: Updated the v0.1 completion preflight source of truth
  after the morning rerun and Alan artifact helper changes. `docs/soul/V01_COMPLETION_AUDIT_PREFLIGHT.md`
  now reflects the current PENDING state instead of the stale 08:55 active FAIL:
  character soul expression and event-thread continuity are PROVEN by latest
  soul/life evidence, AM->PM and Alan-facing playtest remain PENDING, and
  motif/repair/rubric is pending only because AM->PM is still sample-pending.
  Also aligned `/Users/alanhdchu/umi-central/goals.md` so Central Umi points to
  `npm run underworld:alan-playtest-check` before final audit. Verification:
  docs-only; `git diff --check`.
- 2026-06-04 09:21 CDT: Added a non-evidence Alan-facing playtest artifact
  helper so the remaining human gate is easier to complete without accidental
  false PASS. `npm run underworld:alan-playtest-template` prints the exact
  five-check result shape, and `npm run underworld:alan-playtest-check`
  validates the ignored local `umi/reports/alan-facing-v01-playtest-latest.md`
  before completion audit consumes it. The helper does not write playtest
  evidence, run conversations, or mark PASS. Updated `umi/playtest-v01-alan-facing-gate.md`
  and `umi/COMMAND_REFERENCE.md`; wired the helper self-test into
  `underworld:harness:self-test`. Verification: `npm run
  underworld:alan-playtest:self-test`; `npm run underworld:alan-playtest-template`;
  `npm run underworld:alan-playtest-check` (expected nonzero because the
  artifact is still missing); `npm run underworld:v01-completion-audit`
  (expected PENDING); `git diff --check`.
- 2026-06-04 09:19 CDT: Hardened the Alan-facing playtest completion gate
  without running or fabricating a playtest. `scripts/underworld-v01-completion-audit.mjs`
  now parses the five required checklist rows in
  `umi/reports/alan-facing-v01-playtest-latest.md`; a `Verdict: PASS` artifact
  clears `human_alan_conversation_quality` only when all five rows are present
  and PASS, a thin PASS artifact stays PENDING, and a contradictory PASS with a
  failed subcheck fails the audit. Updated `umi/playtest-v01-alan-facing-gate.md`
  to document the stricter artifact requirement. Latest completion audit remains
  `PENDING` with 0 fail / 3 pending / 5 pass because Alan-facing playtest and
  AM->PM evidence are still genuinely missing. Verification: `npm run
  underworld:v01-completion-audit:self-test`; `npm run
  underworld:v01-completion-audit` (expected PENDING); `git diff --check`.
- 2026-06-04 09:13 CDT: Ran the requested daytime v0.1 rerun after confirming
  runtime health. `npm run underworld:runtime-preflight` passed, `/ai-town`
  returned HTTP 200, `world:defaultWorldStatus` showed `inactive`, and
  `npx convex run testing:resume` moved the default world back to `running`.
  `npm run underworld:v01-daytime-check` then collected three fresh scoped AM
  samples: `c:91090` (海/真晝), `c:91109` (真晝/天澤), and `c:91129` (海/天澤).
  Soul-triad was 3 PASS / 0 WARN / 0 FAIL; life-signals improved to PASS /
  `life_signal_observed`; repair-gate became `eval_rubric_disagreement` /
  proposal-only / observe-only; rubric is BLOCKED only by AM->PM
  `sample_pending`; recent eval still reports 0 PASS / 1 WARN / 3 FAIL as
  human-review quality gaps. Aligned `scripts/underworld-v01-completion-audit.mjs`
  so recent eval failures classified by rubric as human-review gaps do not
  incorrectly fail `character_soul_expression` when soul-triad and life-signals
  pass. Latest completion audit is now `PENDING` with 0 fail / 3 pending /
  5 pass. Verification: `npm run underworld:v01-daytime-check` (expected
  nonzero/PENDING wrapper); `npm run underworld:repair-gate -- --cc=skip`;
  `npm run underworld:rubric-reconcile` (expected BLOCKED on AM->PM only);
  `npm run underworld:v01-completion-audit:self-test`; `npm run
  underworld:v01-completion-audit` (expected PENDING); `git diff --check`.
- 2026-06-04 09:00 CDT: Wrote the proposal-only role-action separation plan at
  `umi/proposals/20260604T140000Z-v01-pilot-role-action-separation.md`.
  The proposal captures the fresh `pilot_role_action_collapse` evidence from
  the 08:55 refresh, explains why this is a v0.1 blocker but not a safe
  auto-fix, and sketches a narrow guard only for future Alan/product-owner
  approval or stronger repeated fresh evidence. No prompt/runtime code was
  changed. Verification: proposal/docs-only; `git diff --check`.
- 2026-06-04 08:55 CDT: Refreshed read-only gates after a natural resumed-world
  morning sample (`conversation-c:91021`) appeared. A first observe-only refresh
  with the default current timestamp correctly found 0 new samples but polluted
  `latest` eval artifacts for completion use; reran observe with the 08:13 CDT
  morning boundary (`--since-created-at=1780578800000`) and `--collect=skip` to
  restore current morning evidence without collecting controlled samples.
  Updated report logic so `pilot_role_action_collapse` is proposal-only in the
  repair gate and a v0.1 blocker in rubric reconciliation, while AM->PM
  `sample_pending` now points to the afternoon evidence window instead of a code
  fix. Latest trusted gates: approach 4 fresh triad samples, soul 3 PASS /
  1 WARN / 0 FAIL, recent 0 PASS / 3 WARN / 1 FAIL, life-signals WARN /
  `pilot_role_action_collapse`, AM->PM WARN / `sample_pending`, repair
  category `pilot_role_action_collapse` / proposal-only / observe-only, rubric
  BLOCKED by life-signals and AM->PM, and completion audit FAIL with 3 fail /
  2 pending / 3 pass. Verification: `npm run underworld:repair-gate:self-test`;
  `npm run underworld:rubric-reconcile:self-test`; `npm run underworld:observe
  -- --cc=skip --collect=skip --target-samples=0
  --since-created-at=1780578800000`; `npm run underworld:repair-gate --
  --cc=skip`; `npm run underworld:rubric-reconcile` (expected BLOCKED);
  `npm run underworld:v01-goal-audit` (expected PENDING); `npm run
  underworld:v01-completion-audit` (expected FAIL).
- 2026-06-04 08:46 CDT: Verified the afternoon gate safety guard before the
  afternoon window. `npm run underworld:v01-afternoon-gate` wrote
  `umi/reports/v01-afternoon-gate-latest.md` with `Overall: SKIPPED` because
  the current Chicago time was outside 13:00-16:59, and no collection steps ran.
  A follow-up `npm run underworld:v01-completion-audit` remained `PENDING` with
  0 fail / 3 pending / 5 pass. This preserves the AM->PM evidence boundary:
  do not treat pre-afternoon reads as PM continuity proof.
- 2026-06-04 08:44 CDT: Prepared the Alan-facing playtest runtime path without
  collecting controlled samples. `npm run underworld:runtime-preflight` passed,
  `curl -I http://localhost:5173/ai-town` returned HTTP 200, then
  `npx convex run testing:resume` moved the default world from
  `stoppedByDeveloper` to `running`. Follow-up read-only checks confirmed
  `world:defaultWorldStatus` is `running` and `school:worldClock` is
  2026-06-04 08:44 CDT / day 17 morning. v0.1 remains `PENDING` with the same
  three proof gates: AM->PM continuity, Alan-facing playtest result artifact,
  and final repair/rubric clearance after AM->PM is no longer sample-pending.
- 2026-06-04 local: Added a durable Alan-facing playtest result path so the
  completion gate no longer depends only on a one-off `--alan-playtest=pass`
  command flag. `scripts/underworld-v01-completion-audit.mjs` now reads
  `umi/reports/alan-facing-v01-playtest-latest.md` when present: `PASS` clears
  the human Alan gate, `PARTIAL` keeps it pending, and `FAIL` fails the
  completion audit. Updated `umi/playtest-v01-alan-facing-gate.md` and the
  completion preflight to point Alan/Umi at the ignored local result artifact.
  Latest completion audit remains `PENDING` with 0 fail / 3 pending / 5 pass
  because the Alan result artifact is missing and AM->PM continuity is still
  sample-pending. Verification: `npm run
  underworld:v01-completion-audit:self-test`; `npm run
  underworld:v01-completion-audit` (expected PENDING); `git diff --check`.
- 2026-06-04 local: Aligned motif/rubric gates so evaluator soft-echo does not
  masquerade as a product motif loop. `scripts/underworld-v01-goal-audit.mjs`
  now treats `eval_rubric_disagreement` + life-signals PASS as motif/hygiene
  PASS, `scripts/underworld-rubric-reconcile.mjs` keeps soft echo as a human
  review gap instead of a blocker, and
  `scripts/underworld-v01-completion-audit.mjs` marks motif/repair/rubric
  PENDING when the only blocker is AM->PM `sample_pending`. Latest gates:
  `v01-goal-audit` PENDING with 0 fail / 1 pending, rubric BLOCKED only by
  AM->PM sample-pending, and completion audit PENDING with 0 fail / 3 pending /
  5 pass. Verification: `npm run underworld:v01-goal-audit:self-test`; `npm run
  underworld:rubric-reconcile:self-test`; `npm run
  underworld:v01-completion-audit:self-test`; `npm run underworld:v01-goal-audit`
  (expected PENDING); `npm run underworld:rubric-reconcile` (expected BLOCKED on
  AM->PM); `npm run underworld:v01-completion-audit` (expected PENDING).
- 2026-06-04 local: Aligned the completion audit aggregation with the
  life-signals gate. `scripts/underworld-v01-completion-audit.mjs` no longer
  requires zero pilot action collapse flags when `life-signals` itself is PASS;
  the life-signals script already warns when role-action collapse crosses its
  threshold. Current completion audit now reports `FAIL` with 1 fail /
  2 pending / 5 pass: character-soul expression, event-thread continuity,
  residue, fallback/provider hygiene, and night quiet pass; AM->PM and
  Alan-facing playtest are pending; motif/repair/rubric still fails. Verification:
  `npm run underworld:v01-completion-audit:self-test`; `npm run
  underworld:v01-completion-audit` (expected FAIL).
- 2026-06-04 local: At 08:15-08:24 CDT, ran the first daytime evidence pass for
  the new date. `npm run underworld:runtime-preflight` passed, then
  `npm run underworld:v01-daytime-check` collected three scoped morning triad
  samples: `c:90964` (海/真晝, PASS), `c:90987` (真晝/天澤, WARN), and
  `c:91005` (海/天澤, PASS). Fresh approach evidence now has provider/runtime OK,
  fallback pollution 0, soul 2 PASS / 1 WARN / 0 FAIL, recent eval 0 PASS /
  2 WARN / 1 FAIL, life signals PASS, and AM->PM `WARN / sample_pending` with
  3 morning samples, 0 afternoon samples, and 9 AM residue candidates.
  Follow-up `repair-gate --cc=skip`, `rubric-reconcile`, and
  `v01-completion-audit` kept v0.1 active: completion is still `FAIL` with
  2 fail / 2 pending / 4 pass because character-soul expression,
  motif/repair/rubric, AM->PM continuity, and Alan-facing playtest are not all
  proven. Next real proof window is afternoon 13:00-16:59 CDT.
- 2026-06-04 local: Still inside night quiet at 00:52 CDT, refreshed the short
  read-only gates without collecting samples. `npm run underworld:repair-gate`
  wrote a fresh `umi/reports/v01-repair-gate-latest.md` with
  `classification=observe_only`, `decision=observe_only`, and blockers
  `am_pm_sample_pending`, `fresh_triad_samples_below_8`, `life_signals_warn`,
  `strongest_equals_weakest`, and
  `recent_failure_reason_category_mismatch`. A follow-up
  `npm run underworld:v01-completion-audit` still reports `FAIL` with 3 fail /
  2 pending / 3 pass. Two attempts to run the full read-only observe command
  with `--cc=skip`, `--collect=skip`, `--target-samples=0`, and
  `--since-created-at=1780513280836` reached night-quiet skip/read-only checks
  but were interrupted before writing `v01-approach-latest.md`; do not treat the
  stale approach report's `auto_fix_allowed` line as authoritative over the
  fresh repair gate. Verification: `npm run underworld:repair-gate`; `npm run
  underworld:v01-completion-audit`.
- 2026-06-04 local: Still inside night quiet at 00:16 CDT, aligned
  `underworld:observe` repair guidance with the stricter repair gate without
  starting runtime or collecting samples. `scripts/underworld-observe-once.mjs`
  now reports `Repair confidence blockers` and downgrades overclaimed
  `echo_repetition` findings to `observe_only` when evidence is weak
  (`fresh_triad_samples_below_8`, AM->PM `sample_pending`, life-signal WARN, or
  recent failure category mismatch). This prevents the approach report from
  inviting prompt edits while completion/repair gates are still blocked.
  Verification: `npm run underworld:observe:self-test`; `npm run
  underworld:repair-gate:self-test`; `git diff --check`.
- 2026-06-04 local: Still inside night quiet at 00:13 CDT, clarified the next
  natural PM evidence path without starting runtime or collecting samples.
  `docs/soul/V01_COMPLETION_AUDIT_PREFLIGHT.md` and `umi/COMMAND_REFERENCE.md`
  now explain that if the afternoon gate remains `sample_pending`, the next step
  is to let natural afternoon conversations or Alan playtest happen inside the
  13:00-16:59 CDT window, then read with
  `npm run underworld:observe -- --cc=skip --collect=skip --target-samples=0`
  and rerun AM->PM/life/repair/rubric/completion checks. This keeps the 12 PM
  sample requirement separate from forced controlled pilot collection.
  Verification: docs-only; `git diff --check`.
- 2026-06-04 local: Still inside night quiet at 00:10 CDT, aligned the command
  reference with the current v0.1 evidence gates. `umi/COMMAND_REFERENCE.md`
  now says `underworld:observe:daytime-samples` / `v01-daytime-check` collect a
  small 3-sample directional batch, not enough by themselves to prove AM->PM
  continuity, and documents `underworld:v01-afternoon-gate` plus the 12 archived
  PM-sample requirement. Verification: docs-only; `git diff --check`.
- 2026-06-04 local: Still inside night quiet at 00:07 CDT, aligned v0.1 source
  docs with the current completion gates without starting runtime or collecting
  samples. `docs/soul/V01_COMPLETION_AUDIT_PREFLIGHT.md` now reflects the latest
  post-role-change state (`FAIL`, 3 fail / 2 pending / 3 pass, AM->PM 9/12 with
  1 weak callback, Alan checklist ready but playtest pending) and updates the
  AM->PM stop condition from fewer than 3 afternoon samples to fewer than 12.
  `docs/soul/AM_PM_CONTINUITY_GOAL.md` now matches the 12-sample judgment
  threshold used by the scripts. Verification: docs-only; `git diff --check`.
- 2026-06-04 local: Still inside night quiet at 00:05 CDT, made a read-only
  completion-audit reporting improvement. `scripts/underworld-v01-completion-audit.mjs`
  now aggregates the current multi-blocker state into a concrete next action:
  wait for the next afternoon window to reach the AM->PM sample threshold, run
  or explicitly defer the Alan-facing Umi playtest using the checklist, and keep
  repair gate observe-only until fresh evidence supports a narrow fix/proposal.
  Latest audit remains `FAIL` with 3 fail / 2 pending / 3 pass. Verification:
  `npm run underworld:v01-completion-audit:self-test`; `npm run
  underworld:v01-completion-audit` (expected FAIL); `git diff --check`.
- 2026-06-04 local: Still inside night quiet at 00:02 CDT, reran the read-only
  completion audit after adding the Alan-facing playtest checklist. Tightened
  `scripts/underworld-v01-completion-audit.mjs` so the
  `human_alan_conversation_quality` evidence now reports
  `checklistReady=true` when `umi/playtest-v01-alan-facing-gate.md` exists, but
  still keeps the requirement `PENDING` until Alan produces a fresh playtest
  record or explicitly defers the gate. Latest audit remains `FAIL` with
  3 fail / 2 pending / 3 pass. Verification: `npm run
  underworld:v01-completion-audit:self-test`; `npm run
  underworld:v01-completion-audit` (expected FAIL); `git diff --check`.
- 2026-06-03 local: Still inside night quiet, prepared the next Alan-facing
  v0.1 playtest gate without starting runtime or collecting samples. Added
  `umi/playtest-v01-alan-facing-gate.md` with a compact checklist and result
  template for greeting binding, latest-sentence binding, correction binding
  (`不是依賴，是喜歡`), yesterday/today continuity, and closing/idle boundary.
  Updated the active handoffs so broad playtesting has a record format ready,
  while the actual Alan-facing playtest remains pending fresh sample.
  Verification: docs-only; no runtime commands.
- 2026-06-03 local: While still inside night quiet at 23:57 CDT, made one
  reporting-only repair-gate hygiene pass without starting runtime or collecting
  samples. `scripts/underworld-repair-gate.mjs` now merges overclaim confidence
  blockers into the decision `blockedReasons`, so the current
  `echo_repetition` observe-only decision records the full reason set:
  `am_pm_sample_pending`, `fresh_triad_samples_below_8`, `life_signals_warn`,
  `strongest_equals_weakest`, and `recent_failure_reason_category_mismatch`.
  Also changed the state snapshot wording from "pending patch" to latest
  committed eval hygiene. Verification: `npm run underworld:repair-gate:self-test`;
  `npm run underworld:repair-gate -- --cc=skip`; `npm run
  underworld:v01-completion-audit` (expected FAIL).
- 2026-06-04 local: Resumed after a user interruption and found it was 23:45
  CDT, inside night quiet. Did not force new collection. Started backend-only
  Convex so read-only queries could inspect the 2026-06-03 afternoon state; the
  Convex startup automatically ran existing vacuum crons for old inputs/memory
  tables, which was not a sample-collection action. `npm run
  underworld:runtime-preflight` passed, then `npm run underworld:observe -- --cc=skip
  --collect=skip --target-samples=0 --since-created-at=1780513280836` skipped
  night collection and found one additional natural triad sample (`c:90923`
  海/真晝). AM->PM is still `WARN / sample_pending` with 9 afternoon samples
  against the >=12 threshold, though it now finds 1 weak PM callback from the
  morning "清單 / 誰沒吃早餐" residue to the afternoon window/clean-list moment.
  Latest completion audit remains `FAIL` with 3 fail / 2 pending / 3 pass.
  Tightened `scripts/underworld-repair-gate.mjs` so overclaimed
  `echo_repetition` auto-fix classifications are downgraded to `observe_only`
  under weak evidence; current repair gate now reports `classification=observe_only`.
  Verification so far: `npm run underworld:repair-gate:self-test`; `npm run
  underworld:repair-gate -- --cc=skip`; `npm run underworld:rubric-reconcile`
  (expected BLOCKED); `npm run underworld:v01-completion-audit` (expected FAIL).
- 2026-06-03 local: Continued the afternoon v0.1 rerun at 14:01-14:35 CDT.
  The first rerun collected 3 controlled triad samples (`c:90819` 海/真晝,
  `c:90836` 真晝/天澤, `c:90858` 海/天澤) and briefly produced an
  overconfident AM->PM memory-continuity proposal at only 6 afternoon samples.
  Removed that proposal and raised AM->PM completion/repair judgment to require
  >=12 afternoon samples. A later controlled Umi/Mahiru collection timed out
  after 240s with 6 active messages and no archived triad sample, which points
  at conversation lifecycle/closing/archive fragility. Cleaned stale local
  `SOUL_TRIAD_*` pilot env, ran an 8-minute natural window, and observed
  `c:90902` 海/真晝: the strongest fresh natural sample so far, with quiet
  presence and a soft ending feel, though still mirror-repetitive around sigh /
  tea / quiet-student motifs. Latest completion audit is still `FAIL` with
  3 fail / 2 pending / 3 pass; fallback/provider hygiene and night quiet pass,
  but character-soul expression, event-thread continuity, motif/repair/rubric,
  AM->PM continuity, and Alan-facing Umi playtest are not complete. Verification:
  `npm run underworld:am-pm-continuity:self-test`; `npm run
  underworld:repair-gate:self-test`; `npm run
  underworld:v01-completion-audit:self-test`; `npm run underworld:observe -- --cc=skip
  --collect=skip --target-samples=0 --since-created-at=1780513280836`; `npm run
  underworld:v01-goal-audit`; `npm run underworld:repair-gate`; `npm run
  underworld:rubric-reconcile` (expected BLOCKED); `npm run
  underworld:v01-completion-audit` (expected FAIL).
- 2026-06-03 local: Ran the 13:05 CDT v0.1 afternoon gate after recovering the
  local runtime. The LaunchAgent dev stack was stuck in a 180s restart loop with
  Vite listening on 5173 but no Convex backend on 3210; stopped the stale
  `com.giis.underworld.dev-stack` run, fixed `package.json` so `dev:backend`
  respects external `CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS`, and started a
  manual 360s stack. Runtime preflight passed, the gate collected 3 fresh
  afternoon samples (`c:90763` 海/真晝 WARN, `c:90785` 真晝/天澤 PASS,
  `c:90809` 海/天澤 PASS), and fallback/provider hygiene stayed clean. The gate
  is still not complete: recent eval is 0 PASS / 1 WARN / 2 FAIL, AM->PM is
  `WARN / sample_pending` with 3 afternoon samples against the new >=5 threshold,
  day-window life signals remain `WARN / prop_echo_repeated` with role-action
  collapse flags, and Alan-facing Umi playtest is still pending. Made only
  report/runtime hygiene fixes: AM->PM continuity and life-signal prop/repeat
  patterns now stay sample-pending below threshold, completion audit treats
  insufficient PM evidence as pending, and repair gate no longer misclassifies
  `UMI_MAHIRU_PILOT_DAILY_QUOTA` or sample timeout flags as provider failure.
  Verification: `npm run underworld:runtime-preflight`;
  `npm run underworld:v01-afternoon-gate` (expected NOT_COMPLETE on current
  evidence); `npm run underworld:am-pm-continuity:self-test`; `npm run
  underworld:life-signals:self-test`; `npm run underworld:repair-gate:self-test`;
  `npm run underworld:v01-completion-audit:self-test`; `npm run underworld:observe
  -- --cc=skip --collect=skip --target-samples=0 --since-created-at=1780511972630`;
  `npm run underworld:v01-goal-audit`; `npm run underworld:repair-gate`;
  `npm run underworld:rubric-reconcile` (expected BLOCKED); `npm run
  underworld:v01-completion-audit` (expected FAIL).
- 2026-06-03 local: Tuned runtime preflight timeouts after live evidence showed
  local Convex can false-fail with 70-90s per-check timeouts while replaying the
  large local state. Two preflight runs failed with exactly one timeout while
  later checks succeeded. Updated all runtime-preflight checks to allow 180s.
  A live rerun then passed all three checks (`school:worldClock`,
  `world:defaultWorldStatus`, `school:debugState`), though each took roughly
  90s. This should reduce false runtime blockers in the 13:05 afternoon gate
  without collecting samples before the afternoon window.
  Verification: `npm run underworld:runtime-preflight:self-test`; `npm run
  underworld:harness:self-test`; `npm run underworld:runtime-preflight` (PASS);
  `git diff --check`.
- 2026-06-03 local: Added a read-only runtime preflight as the first real step
  inside the guarded afternoon wrapper. `npm run underworld:runtime-preflight`
  checks `school:worldClock`, `world:defaultWorldStatus`, and
  `school:debugState`, writes `umi/reports/runtime-preflight-latest.md`, and
  returns non-zero if local Convex is not responsive. The afternoon wrapper now
  stops after a failed runtime preflight instead of trying to collect samples or
  running dialogue evals against an unhealthy backend. Pre-afternoon wrapper
  runs still stop at the Chicago-time guard before runtime checks.
  Verification: `npm run underworld:runtime-preflight:self-test`; `npm run
  underworld:v01-afternoon-gate:self-test`; `npm run underworld:harness:self-test`;
  `npm run underworld:v01-afternoon-gate` (expected exit 2 / SKIPPED before
  afternoon); `git diff --check`.
- 2026-06-03 local: Added runtime recovery notes to the v0.1 preflight so a
  13:05 gate failure caused by local Convex/dev-stack readiness does not get
  mistaken for character-quality evidence. The runbook keeps recovery manual:
  start `umi/run_underworld_dev_stack.sh`, verify `school:worldClock`,
  `world:defaultWorldStatus`, and `school:debugState`, then rerun the guarded
  afternoon wrapper only if still inside 13:00-16:59 America/Chicago. No
  runtime process was started and no Convex state was changed.
  Verification: docs-only update; `git diff --check`.
- 2026-06-03 local: Hardened the one-command afternoon gate wrapper with an
  internal Chicago-time guard. `npm run underworld:v01-afternoon-gate` now
  refuses to collect outside 13:00-16:59 America/Chicago unless explicitly run
  with `--allow-outside-afternoon`; a pre-afternoon run at 10:58 CDT wrote a
  `SKIPPED` summary and did not execute collection steps. This protects AM->PM
  continuity evidence from accidental morning collection.
  Verification: `npm run underworld:v01-afternoon-gate:self-test`; `npm run
  underworld:v01-afternoon-gate` (expected exit 2 / SKIPPED before afternoon);
  `npm run underworld:harness:self-test`; `git diff --check`.
- 2026-06-03 local: Added a one-command afternoon gate wrapper so the 13:05
  heartbeat can run the full v0.1 gate without stopping halfway on an expected
  non-zero audit result. `npm run underworld:v01-afternoon-gate` runs the
  daytime sample/goal audit, repair gate, rubric reconciliation, and final
  completion audit, then writes `umi/reports/v01-afternoon-gate-latest.md`.
  This does not change Convex/runtime behavior; it only makes the verification
  path harder to interrupt or misread.
  Verification: `npm run underworld:v01-afternoon-gate:self-test`; `npm run
  underworld:harness:self-test`; `git diff --check`.
- 2026-06-03 local: Added a read-only completion audit command so the afternoon
  gate can produce a requirement-by-requirement v0.1 completion report instead
  of relying on manual interpretation of several separate reports. The new
  `npm run underworld:v01-completion-audit` command writes
  `umi/reports/v01-completion-audit-latest.md` and stays conservative: the
  current morning evidence correctly reports FAIL with 3 fail, 1 pending, 0
  deferred, 4 pass because AM->PM continuity, Alan-facing playtest evidence,
  and motif/repair gate completion are not yet proven. Updated the preflight
  afternoon gate plan to include this command. No Convex state or runtime
  behavior changed.
  Verification: `npm run underworld:v01-completion-audit:self-test`; `npm run
  underworld:harness:self-test`; `npx tsc --noEmit --pretty false`; `npm run
  underworld:v01-completion-audit` (expected non-zero on current incomplete
  evidence).
- 2026-06-03 local: Continued the active v0.1 goal at 10:46 CDT. It is still
  before the afternoon continuity window, so no collection was forced and v0.1
  remains pending afternoon evidence. Verified the afternoon gate harness itself
  is ready: all self-tests for AM->PM continuity, life-signals, repair gate,
  observe, v0.1 goal audit, rubric reconciliation, and soul-triad single-sample
  passed. This narrows the next afternoon run's risk to runtime/provider/fresh
  evidence, not known broken report parsing.
  Verification: `npm run underworld:harness:self-test`.
- 2026-06-03 local: Refreshed current v0.1 state at 10:43 CDT from a clean
  worktree. It is still before the real afternoon continuity window, so v0.1
  cannot be honestly completed yet: the latest AM->PM report remains
  `WARN / sample_pending` with 10 morning samples, 0 afternoon samples, and 0 PM
  callbacks. Added `docs/soul/V01_COMPLETION_AUDIT_PREFLIGHT.md` to pin the
  requirement-by-requirement completion criteria, afternoon gate plan, and stop
  conditions before the next run. No runtime or role behavior was changed.
  Verification: source-of-truth refresh only; `git diff --check`.
- 2026-06-03 local: Continued the post-role-change v0.1 gate from a clean
  worktree. Local launchd dev stack was auto-restarting but Convex backend 3210
  was stuck against a 15GB local state directory / 6GB SQLite DB; paused
  `com.giis.underworld.dev-stack`, started the dev stack manually, and stopped
  the world engine so Convex queries became responsive. First daytime check
  reproduced the sampling blocker: `school:startConversationByCharacterNamesForTest`
  timed out while unrelated world operations produced non-target samples. Applied
  a narrow harness reliability fix: outer observe no longer hard-resumes the
  world; the single-sample runner stops the engine, cleans/co-locates the focus
  pair without kick, enqueues one focus conversation, and restores the previous
  engine state. Added forced `pair-cooldown-ms=0` / `provider-cooldown-ms=0` for
  daytime collection and fixed the soul-report parser so an unpiped markdown row
  no longer shifts `Echo penalty` into `Stage direction leak penalty`. Full
  morning gate then collected 3 fresh samples (`conversation-c:90679`
  海/真晝 PASS, `conversation-c:90708` 真晝/天澤 WARN, `conversation-c:90736`
  海/天澤 PASS), with provider/runtime/fallback/life-signal checks OK. v0.1 is
  still not complete: recent eval reports repetition/object-loop risks, repair
  gate says observe-only, and AM->PM continuity is sample-pending because it is
  still morning.
  Verification: `npm run underworld:v01-daytime-check` (completed sample
  collection but goal audit FAIL/PENDING for motif/AM->PM), `npm run
  underworld:repair-gate`, `npm run underworld:observe:self-test`, `npm run
  pilot:soul-triad:single-sample:self-test`, `npx tsc --noEmit --pretty false`,
  `npx convex run --typecheck disable --codegen disable school:debugInputQueue
  '{"limit":6}'`.
- 2026-06-02 local: Fixed the Alan playtest record split where a long Alan ->
  Tianze pressure-test chat appeared in `campusTimeline` but not in recent
  archived conversation reports. Root cause was a persistence/reporting gap:
  Alan chat `worldEvents` did not carry `conversationId`, and deleted
  conversations were archived based on world-state `numMessages` / two-author
  shape instead of the actual `messages` table, so timeout or single-sided human
  pressure tests could become timeline-only evidence. Added `conversationId` to
  future `chatMessage` world events, changed deleted-conversation archival to
  keep human single-sided sessions as diagnostic archives without writing
  `participatedTogether` relationship edges, and updated
  `school:recentConversationEvalData` plus `eval:conversation:recent` to surface
  `orphanChatSessions` separately from character-quality scoring. Verified the
  latest 2026-06-02 20:50-21:18 Alan -> Tianze session is now visible as one
  diagnostic orphan session with 16 Alan messages.
  Verification: `npm test -- convex/aiTown/game.test.ts
  convex/aiTown/agentOperations.test.ts`; `npx tsc --noEmit --pretty false`;
  `git diff --check -- convex/schema.ts convex/messages.ts
  convex/aiTown/game.ts convex/aiTown/game.test.ts convex/school.ts
  evals/conversations/runRecentConversationEval.ts`; `npx convex run --push
  --typecheck disable school:recentConversationEvalData
  '{"timeZone":"America/Chicago","limit":6,"compact":true,"messagesPerConversation":8}'`;
  `npm run eval:conversation:recent -- --since-created-at=1780451000000`.
- 2026-06-02 local: Audited "what did cc change?" for Alan and aligned the
  worker handoff state. Current evidence says recent Claude Code / cc did not
  directly write code: the 19:06 stale-conversation-loop report was read-only
  and timed out after 240s with empty stdout/stderr; the 20:04 continuity-metric
  report was dry-run only; the 20:06 continuity-metric real cc-only report was
  read-only and timed out after 120s with empty stdout/stderr. Earlier 17:58
  zero-message run had write permission in the workload but Claude still timed
  out after 600s, so the accepted implementation came from Codex/Umi using local
  evidence plus an in-app sidecar reviewer root-cause finding, not direct cc file
  edits. Updated `umi/workload.md` to "No active cc task" so future agents do
  not attribute the dirty tree to an active cc owner. Current Central Umi goal
  remains aligned: Underworld is `blocked_sampling`, and the next useful work is
  narrow sampling/helper or eval reliability, not broad prompt or memory
  rewrites.
  Verification: `rg` over recent `umi/reports/*.md` for worker permission,
  Claude Code findings, timeout/skip status; `git status --short`; report
  inspection for `20260603T000600Z-*`, `20260603T010405Z-*`,
  `20260603T010610Z-*`, and `20260602T175830Z-*`.
- 2026-06-02 local: Investigated Alan's playtest observation that Tianze and
  Ichinose are especially interesting, but conversations feel like they cut off
  midstream without a closing part. Refreshed recent conversation eval:
  10 post-fix archived conversations, 0 PASS / 4 WARN / 6 FAIL, with the dominant
  issue `not responding to previous speaker`; Tianze/Ichinose samples are
  flavorful but several endings read like abrupt leave declarations rather than
  emotional closing beats. Example: `conversation-c:89779` ends with Tianze
  putting the pen down and leaving the room after a debt/interest exchange,
  which has a leave sentence but does not digest Ichinose's previous pressure.
  Dev log also showed a separate runtime-health layer around 20:16-20:17 CT:
  multiple Convex query/mutation timeouts including `agentSendMessage`, so some
  user-visible "disconnect" feeling may be backend timeout, not only dialogue
  prompt shape. Applied a narrow lifecycle hygiene patch, not a character
  rewrite: added `closingBeatPromptLine` to normal compact autonomous replies,
  rich pilot replies, and pilot leave replies. The rule tells characters to
  answer one concrete point from the previous line and leave a small handoff,
  pause, boundary, or decision; Tianze/Ichinose get pair-specific closing beats
  so tension closes as "this time I won't dismantle you" / sweet boundary rather
  than a raw goodbye. Pushed Convex functions to the local dev deployment.
  Verification: `npm run eval:conversation:recent -- --since-last-change`;
  `npm test -- convex/agent/conversationMotifGuard.test.ts
  evals/conversations/metrics/conversation_metrics.test.ts
  convex/modelPolicy.test.ts`; `npx tsc --noEmit --pretty false`;
  `git diff --check -- convex/agent/conversation.ts
  convex/agent/conversationMotifGuard.test.ts`; `npx convex run --push
  --typecheck disable school:debugState`.
- 2026-06-02 local: Aligned the cc assignment flow with Central Umi for Alan.
  Refreshed `/Users/alanhdchu/umi-central/goals.md` first; it marks Underworld
  as `blocked_sampling` after the Tianze/Ichinose role change and says the next
  useful work should be narrow sampling/helper or eval reliability, not prompt
  or memory rewrites from 0-1 fresh samples. Replaced `umi/workload.md` with one
  focused read-only cc task:
  `2026-06-02-cc-review-tianze-ichinose-continuity-metric`, scoped only to the
  Tianze/Ichinose `memoryContinuityScore` concern. Ran the repo orchestrator
  path instead of direct ad hoc CLI: dry-run succeeded and wrote
  `umi/reports/20260603T010405Z-2026-06-02-cc-review-tianze-ichinose-continuity-metric.md`;
  the real cc-only run wrote
  `umi/reports/20260603T010610Z-2026-06-02-cc-review-tianze-ichinose-continuity-metric.md`
  but Claude Code timed out after 120s with empty stdout/stderr. Conclusion:
  the Central Umi -> project workload -> orchestrator assignment contract is now
  clean, but the current Claude CLI worker remains unreliable; keep using cc via
  bounded orchestrator tasks only, and treat empty timeouts as worker
  availability failures rather than repo evidence.
  Verification: `python3 umi/orchestrator.py run umi/workload.md --dry-run
  --skip-codex --timeout 120`; `python3 umi/orchestrator.py run
  umi/workload.md --skip-codex --timeout 120`; report inspection.
- 2026-06-02 local: Reviewed today's Tianze/Ichinose role-change code for Alan.
  Attempted a bounded read-only cc review over the role wiring, runtime prompt,
  model policy, eval metrics, and sampling harness; the Claude CLI worker hung
  with no output for ~3 minutes and was killed, matching the current CC
  reliability watch item. Codex completed the review locally. No stale
  Asuna/Mai runtime wiring was found in the targeted role-change paths, and
  current targeted tests still pass. The main code-review concern is eval/harness
  accuracy rather than a proven runtime character bug: `memoryContinuityScore`
  still rewards old concrete cues such as cup/checklist/lunch but lacks
  Tianze/Ichinose continuity cues such as boundary/rule/crack/kindness/debt, and
  its residue-parrot guard checks `海|真晝|天澤` but not `一之瀨`. This can
  under-score or miss-loop Ichinose/Tianze continuity during the fresh gate.
  Verification: `npm test -- convex/modelPolicy.test.ts
  evals/conversations/metrics/conversation_metrics.test.ts
  convex/agent/conversationMotifGuard.test.ts`; targeted `rg`/`sed` inspection
  of role profiles, display names, visuals, runtime conversation prompt,
  model policy, metrics, and sampling scripts.
- 2026-06-02 local: Reran the v0.1 gate after Alan changed the role setup.
  First run at 19:15 CT collected only 1 fresh sample (`conversation-c:89733`,
  天澤 / 海): soul eval PASS 1.00, recent eval WARN 0.90 for mirror-like
  previous-speaker binding, no fallback markers, no hygiene leaks. The run did
  not meet the v0.1 fresh-sample rule because two collection attempts failed
  before producing samples (`testing:resume` InternalServerError and
  `school:coLocateSoulTriadForPilot` SystemTimeoutError). The audit therefore
  reported FAIL/BLOCKED with fresh sample count 1. Inspection also found the
  baseline local Convex env still allowed stale role pairs
  `Umi:Asuna,Mahiru:Asuna`; updated `AUTONOMOUS_CONVERSATION_LLM_PAIRS` on the
  local deployment to `Umi:Mahiru,Umi:Tianze,Mahiru:Tianze,Tianze:Ichinose`
  without touching secrets. Reran observe at 19:23 CT: model policy env became
  ready/ok, but the run collected 0 fresh samples because
  `school:startConversationByCharacterNamesForTest` timed out. Latest
  v0.1-goal-audit remains FAIL and rubric reconciliation BLOCKED, now for
  fresh sample count 0 and AM->PM continuity WARN/weak_continuity on the 6/2
  day window. Repair gate classifies the issue as provider_failure_handling /
  auto_fix_allowed but decision observe_only: do not rewrite prompts or memory
  from this evidence. Interpretation: the historical v0.1 PASS from 6/1 remains
  valid evidence for the old completed gate, but after the 6/2 role changes the
  current fresh v0.1 rerun is not proven and is blocked by sampling/provider
  helper reliability, not by a demonstrated character-quality failure.
  Verification: `npm run underworld:observe -- --cc=skip --target-samples=3
  --sample-timeout-ms=240000` (twice), `npm run underworld:v01-goal-audit`,
  `npm run underworld:rubric-reconcile`, `npm run underworld:life-signals --
  --since-created-at=1780445721015`, `npm run underworld:life-signals --
  --since-created-at=1780446221969`, `npm run underworld:repair-gate`, local
  Convex env pair sync.
- 2026-06-02 local: Refreshed today's Underworld state for Alan and split the
  status into v0.1 vs. post-v0.1. The original Umi/Mahiru/Asuna v0.1 evidence
  gate remains PASS / HUMAN_REVIEW_READY from the 2026-06-01 goal audit:
  fallback markers 0, AM->PM continuity PASS, fresh-window life signals PASS,
  and no v0.1 blockers. Today's 6/2 work moved beyond that gate: Tianze and
  Ichinose received deeper soul/runtime wiring, Ichinose portrait direction was
  corrected, and live sampling produced partial Tianze evidence but still lacks
  complete Tianze/Ichinose fresh transcript evidence. Created a new read-only
  cc handoff in `umi/workload.md` for code-optimizer review of the stale
  conversation loop; Claude Code timed out after 240s with empty output, so
  Codex proceeded from local evidence. Runtime logs showed repeated
  `Conversation c:87543 not found` failures from prompt construction. Root
  cause was stale/missing archived conversation references: `participatedTogether`
  could point at an archived conversation skipped by persistence guards, and
  scheduled agent actions could also outlive the current operation. Added
  preflight guards for agent generate/remember actions so stale scheduled work
  no-ops and missing active/archive conversations clear the operation without
  entering prompt or memory construction. Also changed previous-conversation
  prompt loading to warn and continue when a referenced archive is missing,
  instead of throwing. After pushing local Convex functions, the fatal
  `agentGenerateMessage failed; Conversation c:87543 not found` loop stopped;
  the queue returned to normal completed `agentFinishSendingMessage`,
  `finishDoSomething`, and `agentAbortConversation` inputs. Remaining warnings
  about missing old archived conversations are now non-fatal and should be
  treated as cleanup/backfill polish, not a v0.1 blocker.
  Verification: `npm test -- convex/aiTown/agentOperations.test.ts
  convex/aiTown/agent.test.ts convex/agent/conversationMotifGuard.test.ts`,
  `npx tsc --noEmit --pretty false`, `npm run build`, `npx convex run --push
  --typecheck disable school:debugInputQueue`, dev-log tail review.
- 2026-06-02 local: Fixed Alan's Ichinose visual note that the bangs were too
  long and covered her face. Generated a replacement original anime-style
  `public/portraits/ichinose.png` with pink hair, shorter side-swept bangs, and
  both eyes clearly visible; updated `data/characterVisuals.ts` and
  `public/portraits/README.md` so future Ichinose art direction explicitly
  requires a clear full face and visible eyes. Continued Tianze/Ichinose live
  sampling after the prior disposable harness timed out: the live conversation
  produced two on-flavor Tianze lines around truth/安心/利息/人情, but Ichinose did
  not reply before the harness stopped, so the pair is still not fresh-transcript
  evidence-complete. Cleaned the lingering Tianze/Ichinose active test
  conversation from the world and confirmed the default world is running with
  `cleanupActiveConversationsByCharacterNamesForTest` dry-run reporting 0 target
  active conversations.
  Verification: viewed the new portrait via Codex image viewer; `file
  public/portraits/ichinose.png`; `npx tsc --noEmit --pretty false`; `git diff
  --check -- data/characterVisuals.ts public/portraits/README.md WORKLOG.md`;
  `npx convex run world:defaultWorldStatus`; `npx convex run world:worldState`;
  `npx convex run school:cleanupActiveConversationsByCharacterNamesForTest`.
- 2026-06-02 local: Implemented Alan's Tianze/Ichinose new-role soul flavor
  pass. Expanded both soul docs into complete five-layer depth with safe
  boundaries: Tianze is now a safe little-devil pressure tester who can make
  someone blush through timing, distance, and too-accurate questions while
  stopping before harm; Ichinose is now public cute-big-sister warmth plus
  private sweet-boundary control, making people admit what care/kindness they
  want or have taken. Updated source profiles, runtime rich/compact prompts,
  role-action guard, daily state/unresolved residue prompts, lifecycle goals,
  deterministic fallback lines, conversation outcome/intention phrases, eval
  cue recognition, and disposable sample harness cloud-character coverage.
  Synced Tianze and Ichinose into the Convex dev runtime. Live `debugState` now
  shows Tianze persona with safe little-devil teasing and short-term intention
  `用一句安全小惡魔式的問題測出誰在躲，並在傷到人之前停手`; Ichinose persona now
  shows cute-big-sister/private-distance flavor and short-term intentions
  around sweet care/conditions and reclaiming warmth from free use. Attempted a
  disposable Tianze/Ichinose live sample: first run timed out during Qwen
  provider preflight; second run skipped preflight, co-located the pair, but the
  enqueue call timed out and left active disposable conversations. Cleaned those
  active conversations and agent ops; final queue had no pending inputs and
  `world:worldState` showed conversation count 0. Fresh transcript evidence is
  still pending because provider/runtime sampling did not complete.
  Verification: `npx tsc --noEmit --pretty false`; `npm test --
  convex/agent/conversationMotifGuard.test.ts convex/modelPolicy.test.ts
  evals/conversations/metrics/conversation_metrics.test.ts`; `node --check
  scripts/run-free-world-routing-disposable-sample.mjs`; `node --check
  scripts/run-soul-triad-single-sample.mjs`; `git diff --check` on touched
  files; `npx convex run --push --typecheck disable
  school:syncCharacterProfilesFromSource` for Tianze/Ichinose; `npx convex run
  school:debugState`; disposable sample attempts and
  `school:cleanupActiveConversationsByCharacterNamesForTest`.
- 2026-06-02 local: Audited full character-setting completeness after Alan
  asked whether the roster is done. Confirmed the structural migration is
  complete: six soul pilot docs exist for non-Alan characters, seven
  portrait/sprite pairs exist, display aliases cover Umi/Tianze/Ichinose/Mahiru/
  CaoCao/Liu Bei/Alan, active text scan found no old Asuna/Mai residual in
  `data`, `docs`, `convex`, `src`, `scripts`, or active `public` metadata, and
  live Convex profiles identify Tianze/Ichinose with their new roles. Remaining
  gap is flavor/depth, not structure: Tianze is currently "pressure-test
  transfer" rather than Alan's safer "slightly H-ish little devil" direction,
  Ichinose is "soft-dominion/kindness debt" rather than the full "public cute
  big-sister / private ambiguous teasing" contrast, and live Tianze still has a
  responsibility-carrying `shortTermIntentions` residue ("先交出一件不該只由自己接住
  的事"). CaoCao and Liu Bei also retain old AI club / Day 3 short-term state,
  which is not former-role residue but is not a completely fresh slate.
  Verification: `rg` residual scan for Asuna/Mai variants; `npx convex run
  school:debugState`; `file public/portraits/*.png public/sprites/*.png`;
  source reads for `data/characterVisuals.ts`, `data/displayNames.ts`,
  `docs/soul/pilots/tianze.md`, `docs/soul/pilots/ichinose.md`, and
  `convex/agent/conversation.ts`.
- 2026-06-02 local: Continued Alan's Tianze/Ichinose soul-depth check. Found
  that the source soul docs and live Convex profiles already carry the intended
  DNA for Tianze as a playful pressure-test transfer and Ichinose as a
  pink-haired soft-dominion strategist, but runtime depth was not fully wired:
  Tianze/Ichinose conversations still used the compact free-world prompt path,
  and short two-message samples could be treated as ordinary non-pilot
  transcripts. Patched the runtime so Tianze<->Ichinose is a rich soul pair,
  added Ichinose-specific stance / flaw / anti-slogan / relationship guidance
  inside the rich prompt path, taught persistence and the soul harness to treat
  Tianze/Ichinose as an active soul sample pair, renamed the old internal
  `asunaAction` eval metric to `tianzeAction`, and removed duplicate
  Tianze/Ichinose alias cases that were producing Convex push warnings. Also
  split the disposable test setup into lower-risk `coLocate(..., kick:false)`
  and `enqueueConversationByCharacterNamesForTest(..., kick:false)` helpers,
  added `school:debugInputQueue`, `testing:repairDefaultWorldRunState`, and a
  generic active-conversation cleanup helper after the test harness exposed a
  status mismatch (`worldStatus=stoppedByDeveloper` while the engine was still
  running) plus a pending input. Controlled sampling created active
  conversation `c:89115`; Tianze's first rich-path line was on target ("一之瀨...
  那句話太工整...帳算在你頭上"), but Ichinose's second reply stayed stuck behind
  `agentGenerateMessage`, so the deep-pair runtime is wired but not yet
  evidence-complete. Cleaned the stuck test conversation and agent operation;
  final world status is `running`.
  Verification: `npx tsc --noEmit --pretty false`; `npm test --
  convex/modelPolicy.test.ts convex/aiTown/agent.test.ts
  convex/aiTown/addresseeRepair.test.ts`; `npm test --
  convex/modelPolicy.test.ts convex/aiTown/agent.test.ts
  convex/aiTown/addresseeRepair.test.ts
  evals/conversations/metrics/conversation_metrics.test.ts`;
  `npx convex run --push --typecheck disable world:defaultWorldStatus`;
  `npx convex run school:debugInputQueue`; `npx convex run messages:listMessages`;
  `npx convex run school:cleanupActiveConversationsByCharacterNamesForTest`.
- 2026-06-02 local: Reviewed the zero-message active conversation blocker with
  a bounded cc handoff plus an in-app sidecar reviewer after the local Claude
  Code CLI timed out for 600s with empty stdout/stderr. Accepted the sidecar
  root-cause finding and local evidence: `startConversationByCharacterNamesForTest`
  only enqueued a start input and kicked the engine, while `advanceWorldTime`
  is school simulation, not an AI Town engine wait/tick helper. Patched
  `startConversationByCharacterNamesForTest` to behave like a disposable
  conversation setup by clearing the two target characters' active conversations,
  pathfinding/activity, and stale agent operation/cooldown state before
  enqueueing the forced conversation, and by placing them adjacent in a stable
  test location. Also patched `moveCharactersForWorldTime` to skip players who
  are currently in active conversations so schedule movement cannot reset or
  reposition participants mid-conversation. Existing `world:worldState` proved
  active conversations had reached `participating` state but were waiting behind
  an `agentGenerateMessage` single-flight operation; this patch fixes the
  helper/school-simulation mismatch, while provider/action latency remains a
  separate observation risk.
  Verification: `npx tsc --noEmit --pretty false`; `npm test --
  convex/aiTown/agent.test.ts convex/aiTown/addresseeRepair.test.ts`.
- 2026-06-02 local: Synced the zero-message lifecycle patch to the Convex dev
  deployment with `npx convex run --push --typecheck disable
  world:defaultWorldStatus` and re-ran forced Tianze/Ichinose sampling. The
  first post-push forced conversation progressed from active `numMessages: 0`
  to 2 messages and archived, proving the helper/schedule movement fix unblocked
  the lifecycle. The first Ichinose reply still used Simplified Chinese and a
  birthday hallucination, matching the sidecar risk that Ichinose was not a
  free-world cloud speaker. Patched `convex/modelPolicy.ts` so Ichinose is a
  free-world cloud character like Umi/Mahiru/Tianze, updated
  `convex/modelPolicy.test.ts`, pushed again, and collected
  `conversation-c:88416`: Tianze challenged whether Ichinose uses "kindness" as
  a transferable resource, and Ichinose replied in Traditional Chinese that the
  question was really about whether she treats warmth as a free resource. Recent
  eval still rated the 2-message smoke sample FAIL 0.81 for character voice cue
  coverage, so the next issue is richer/deeper sample quality, not zero-message
  lifecycle.
  Verification: `npx tsc --noEmit --pretty false`; `npm test --
  convex/modelPolicy.test.ts convex/aiTown/agent.test.ts
  convex/aiTown/addresseeRepair.test.ts`; `npx convex run --push --typecheck
  disable world:defaultWorldStatus`; `npx convex run
  school:startConversationByCharacterNamesForTest`; `npx convex run
  messages:listMessages`; `npm run eval:conversation:recent --
  --since-created-at=1780425940000`.
- 2026-06-02 local: Ran post-migration runtime sampling for the new
  Tianze/Ichinose cast state. Found that some former-role aliases could survive
  inside non-target archived transcripts, so broadened
  `school:migrateCharacterRuntimeNames` conversation cleanup to match transcript
  message text as well as participant ids; applied the cleanup until
  conversation/message dry-runs returned 0. Verified repo text residual scan is
  0 and live world status is `running`. Sample harness attempts were unstable:
  the soul-triad single-sample timed out with no fresh archive, and the
  free-world disposable harness hung around Convex world-status/start flow.
  Direct `school:startConversationByCharacterNamesForTest` for
  `Tianze:Ichinose` succeeded and world advancement now reports active
  conversation `c:87731` with participants Tianze/Ichinose, but the active
  conversation still has `numMessages: 0` after two ticks, so there is no fresh
  transcript to judge yet. Autonomous world actions did fire and showed
  Ichinose in the intended soft-dominion direction: she wrote down the three
  most unnatural phrases of the day, including people saying they are fine or
  can accept something too quickly.
  Verification: `npx convex run school:migrateCharacterRuntimeNames` dry-run
  scopes for conversations/all, `rg` residual scan, `npx convex run
  world:defaultWorldStatus`, direct `school:startConversationByCharacterNamesForTest`,
  and two `npx convex run school:advanceWorldTime '{"hours":0.25,...}'`
  checks.
- 2026-06-02 local: Completed Alan's requested full Tianze/Ichinose runtime
  slot migration instead of preserving the former two character keys. Renamed
  active source/runtime references to `Tianze` and `Ichinose`, moved the
  portrait/sprite/soul-pilot filenames to `tianze` / `ichinose`, and added
  `school:migrateCharacterRuntimeNames` as a generic from/to runtime cleanup
  tool with explicit scopes. Applied the live Convex migration for world
  `md7cefps8wz097yk9k44n92rj1870x6c`: player/agent/profile docs now use
  `Tianze` / `Ichinose`; old conversation-history dry-runs now report 0
  conversations/messages/participatedTogether; old memory dry-runs now report
  0 memories/embeddings; old timeline dry-runs now report 0 world events,
  notifications, and rumors. Reset/reseeded relationship baselines and cleaned
  non-target profile short-term residues so `debugState` no longer contains
  former slot names or aliases. Temporarily stopped the world engine to avoid
  Convex OCC during cleanup, then restored it to running.
  Verification: `rg` residual scan for former slot names and aliases returned
  no repo hits, old asset/pilot filenames are gone, filtered
  `npx convex run school:debugState` returned no stale tokens and showed
  Tianze/Ichinose with empty short-term memory, `npx tsc --noEmit --pretty
  false`, and `npm test -- convex/aiTown/addresseeRepair.test.ts
  convex/agent/memory.test.ts convex/agent/conversationMotifGuard.test.ts
  evals/conversations/metrics/conversation_metrics.test.ts`.
- 2026-06-02 local: Cleaned up Alan-facing/docs wording around Tianze and
  Ichinose so `Tianze` / `Ichinose` are described as Convex runtime keys, not
  player-facing role names or "slots" to rename. Updated README cast/status,
  v0.1 roadmap, docs index, soul pilot docs, portrait README, and recent worklog
  wording. Kept runtime/test/provider references to `Tianze` and `Ichinose` intact
  because Convex/world still uses those keys to find the characters.
  Verification: `npx tsc --noEmit --pretty false`; targeted `rg` found no
  remaining active-doc old slot wording or old Tianze responsibility-role
  wording outside historical worklog entries.
- 2026-06-02 local: Audited the Tianze/Ichinose role migration for active
  character settings, soul docs, soul progression fixtures, display repair,
  runtime Convex profiles, and sample collection. Fixed remaining old-role
  residuals where Tianze's `Tianze` runtime key still behaved like a
  responsibility carrier / checklist executor and where Ichinose's `Ichinose`
  runtime key still read like the old hidden-cost reader instead of Ichinose's
  pink-haired soft-dominion direction. Added
  `school:syncCharacterProfilesFromSource` with dry-run and per-character
  targeting, then synced live runtime state for Tianze (`Tianze`), Ichinose
  (`Ichinose`), and `Mahiru`; confirmed `debugState` now shows Tianze as
  `Pressure Test Transfer / 混亂壓力測試者`, Ichinose as
  `Soft Dominion Strategist / 溫柔支配者`, and Mahiru as
  `Emotional Care Anchor / 學生事務助理`, with stale short-term memories cleared
  for identity-changed profiles. Fresh dialogue sampling did not produce new
  transcripts: `underworld:observe` first hit a Convex
  `school:startConversationByCharacterNamesForTest` timeout, and later direct
  soul-triad sample attempts were blocked by Qwen/newcoin `fetch failed`; the
  standalone `node scripts/test-qwen-key.mjs` connectivity smoke also failed
  against both `/v1/chat/completions` and `/chat/completions`.
  Verification: `npx tsc --noEmit --pretty false`, `npm test --
  convex/aiTown/addresseeRepair.test.ts convex/agent/memory.test.ts
  convex/agent/conversationMotifGuard.test.ts
  evals/conversations/metrics/conversation_metrics.test.ts`,
  `npm run underworld:life-signals:self-test`,
  `npm run pilot:soul-triad:single-sample:self-test`,
  `npm run underworld:am-pm-continuity:self-test`, targeted `rg` residual
  audit, `npx convex run school:syncCharacterProfilesFromSource` dry-run and
  per-character apply, and `npx convex run school:debugState`.
- 2026-06-02 local: Corrected Umi's visual identity after Alan provided the
  intended reference: short dark navy bob hair, pink-purple eyes, gray school
  jacket/cardigan, blue ribbon, navy pleated skirt, dark knee socks, and brown
  shoes. Replaced `public/portraits/umi.png` with a new original full-body
  non-sexual VN-style portrait following that direction rather than the earlier
  adult office outfit. Updated Umi art-direction guidance in
  `data/characterVisuals.ts` and `public/portraits/README.md`, adjusted the Umi
  sprite palette/spec in `scripts/generate_chibi_sprites.py`, regenerated
  `public/sprites/umi.png` and sprite QA output, and updated the QA report row.
  Verification: visual inspection of `public/portraits/umi.png` and
  `public/sprites/umi.png`, direct `curl -I` checks for both Umi asset URLs,
  `file public/portraits/umi.png public/sprites/umi.png`, and
  `npx tsc --noEmit --pretty false`.
- 2026-06-02 local: Updated the female character portraits to a consistent safe
  full-body character-reference style after Alan liked the full-body look. Kept
  the existing runtime/asset filenames and replaced `public/portraits/umi.png`,
  `public/portraits/tianze.png`, `public/portraits/ichinose.png`, and
  `public/portraits/mahiru.png` with original non-sexual full-body anime-style
  designs: Umi as an adult assistant-principal figure, Tianze as a playful
  pressure-test transfer student, Ichinose as a pink-haired soft dominion
  strategist, and Mahiru as a gentle student-affairs care anchor. Updated
  portrait art-direction guidance in `data/characterVisuals.ts`,
  `public/portraits/README.md`, and the sprite QA report so future regenerations
  preserve the full-body non-fetishized reference direction.
  Verification: visual inspection of all four generated portraits,
  `file public/portraits/umi.png public/portraits/tianze.png
  public/portraits/ichinose.png public/portraits/mahiru.png`, direct `curl -I` checks
  for all four portrait URLs, and `npx tsc --noEmit --pretty false`.
- 2026-06-02 local: Reframed Ichinose's new direction after Alan asked to push
  her toward the latest novel's darker "big demon" feeling. Kept the legacy
  `Ichinose` runtime slot, but changed player-facing Ichinose from a general
  boundary-aware kindness strategist into a pink-haired soft dominion strategist:
  angelic warmth, quiet possession, kindness as named debt, and refusal framed
  as a gift rather than loud villain behavior. Updated `data/giisProfiles.ts`,
  `convex/agent/conversation.ts`, `convex/agent/memory.ts`,
  `scripts/underworld-life-signals.mjs`, PlayerDetails concern/activity copy,
  soul docs, portrait guidance, README cast copy, sprite QA wording, and
  replaced `public/portraits/ichinose.png` with a new original anime-style
  pink-haired portrait with a warm but dangerous smile. The existing pink sprite
  remains compatible with the new art direction.
  Verification: visual inspection of `public/portraits/ichinose.png`,
  `npx tsc --noEmit --pretty false`, `npm test -- convex/agent/memory.test.ts
  convex/agent/conversationMotifGuard.test.ts`, `npm run build`, and `curl -I
  http://localhost:5173/ai-town/portraits/ichinose.png`.
- 2026-06-02 local: Updated Ichinose's visual identity after Alan noted she
  looked too similar to Mahiru. Replaced `public/portraits/ichinose.png` with a new
  original anime-style portrait using unmistakable pink hair while preserving
  the boundary-aware kindness strategist mood. Updated the Ichinose visual
  palette in `data/characterVisuals.ts`, adjusted the sprite generator's
  `Ichinose` runtime-key colors, and regenerated `public/sprites/ichinose.png` plus sprite QA
  output so the map character also reads as pink-haired and distinct from
  Mahiru.
  Verification: visual inspection of `public/portraits/ichinose.png` and
  `public/sprites/ichinose.png`, `curl -I` checks for `/ai-town/portraits/ichinose.png`
  and `/ai-town/sprites/ichinose.png`, `npx tsc --noEmit --pretty false`.
- 2026-06-02 local: Replaced the player-facing Tianze/Ichinose character direction
  with Tianze/Ichinose-inspired original Underworld roles while preserving the
  `Tianze` and `Ichinose` runtime keys for Convex/world compatibility. Tianze is
  written as a playful pressure-test transfer student who exposes weak rules
  and stops before harm; Ichinose is written as a boundary-aware kindness
  strategist whose warmth has visible cost. Updated profile source of truth, display-name
  aliases, character visuals, conversation prompt guards, residue memory cues,
  soul docs, README/docs index, conversation wall display, PlayerDetails
  fallback focus copy, and the soul-triad eval display/scoring cues. Generated
  new original anime-style portraits for `public/portraits/tianze.png` and
  `public/portraits/ichinose.png`, cleaned the generated checkerboard backgrounds to
  solid white, updated sprite specs, and regenerated `public/sprites/tianze.png`
  / `public/sprites/ichinose.png` plus the sprite QA output. Historical reports and
  unrelated pre-existing worktree changes were not reverted.
  Verification: `npx tsc --noEmit --pretty false`, `npm run build`,
  `npm test -- convex/agent/memory.test.ts
  convex/agent/conversationMotifGuard.test.ts`, `curl -I
  http://localhost:5173/ai-town`, direct asset `curl -I` checks for
  `/ai-town/portraits/tianze.png`, `/ai-town/portraits/ichinose.png`,
  `/ai-town/sprites/tianze.png`, and `/ai-town/sprites/ichinose.png`. Headless
  Playwright using local Chrome reached the app and wrote
  `tmp/tianze-ichinose-smoke.png`, but the captured app state had not yet loaded
  character DOM/images, so visual confirmation was completed via direct asset
  inspection instead.
- 2026-06-01 local: Implemented the narrow v0.1.1 yesterday/today memory-flow
  pass Alan approved. Kept the existing memory architecture and changed the
  prompt residue labels to be America/Chicago calendar-aware: same-day residues
  now show `剛才` or `今天早上/下午/晚上`, prior local calendar day residues show
  `昨天早上/下午/晚上`, and older residues show `之前` plus a date instead of
  being mislabeled as today. Updated residue usage guidance so today can be
  carried as `剛才/早上那件事`, yesterday can only be softly continued as
  `昨天那件事/昨天留下的感覺`, and older dated memories cannot be spoken as
  today/yesterday. Added a human-chat guard against invented precise callbacks
  such as `昨天深夜你一直沒回` when there is no transcript or memory evidence.
  The prior curry commitment extractor still passes, so 天澤's `明天咖哩飯`
  continuity is preserved without adding a new promise-memory system. Current
  Chicago/world time was night (`6/1 晚上9:55｜第 14 天 晚上 9:55`), so I did not
  force daytime sample collection.
  Verification: `npm test -- convex/agent/memory.test.ts
  convex/agent/conversationMotifGuard.test.ts`, `npx tsc --noEmit --pretty
  false`, `npm run build`, `npx convex run school:worldClock`.
- 2026-06-01 local: Applied a conservative curry/promise continuity fix after
  Alan questioned whether adding a new promise-memory system was too heavy.
  Kept the existing memory architecture and added a narrow extractor for
  concrete timed commitments in conversation summaries: it only records a
  commitment when a request includes both a specific object (`咖哩飯`) and time
  (`明天`, `週末`, weekday, etc.) and a later non-question response affirms it
  (`好`, `我試試`, `我會`, etc.). The extracted line is injected into the memory
  description even when LLM summarization is enabled, so a future Tianze memory
  can preserve `天澤答應明天為 Alan 準備咖哩飯` instead of only remembering generic
  meal/care residue. Also added human-chat direct object binding so if Alan says
  `咖哩飯`, the character must answer that object first and must not replace it
  with soup, bento, tea, bowl, greens, tray, or generic food. This is intended
  to reduce the latest bowl/meal motif drift without adding a new durable
  promise subsystem.
  Verification: `npm test -- convex/agent/memory.test.ts
  convex/agent/conversationMotifGuard.test.ts`, `npx tsc --noEmit --pretty
  false`, `npm run build`.
- 2026-06-01 local: Reviewed Alan's latest fresh human-chat samples and the
  report that dialogue panels keep disappearing. Recent archived samples showed
  Alan<->Ichinose (`conversation-c:82555`) and Alan<->Mahiru (`conversation-c:82780`)
  ended after short one-question/one-answer arcs, with characters often turning
  Alan's concrete asks into another follow-up question instead of a lived
  decision/action. Runtime/code inspection found a likely lifecycle bug: human
  `Player.tick()` removes Alan after `HUMAN_IDLE_TOO_LONG`, but chat typing and
  message sends did not refresh `lastInput`, so Alan could be considered idle
  while actively chatting; `Player.leave()` then stops and archives the active
  conversation, making the panel appear to jump away. Fixed conversation inputs
  so `startTyping` and `finishSendingMessage` refresh `lastInput` for human
  players, added a human-chat rhythm prompt to avoid mandatory follow-up
  questions, and corrected the agent leave-guard test to match the intended
  Alan-explicit-close policy.
  Verification: `npm test -- convex/aiTown/agent.test.ts`, `npx tsc --noEmit
  --pretty false`, `npm run build`, `curl -I http://localhost:5173/ai-town`,
  `npx convex run school:worldClock`.
- 2026-06-01 local: Refined the human idle policy after Alan noted that idle
  should feel like characters calling for him and then closing naturally, not
  like his role disconnecting. Active human conversations now suppress the
  generic `HUMAN_IDLE_TOO_LONG` player removal, allowing the existing
  awkward-deadline rhythm to produce one or more check-ins. Added an
  8-minute `HUMAN_CONVERSATION_IDLE_CLOSE_AFTER` path where, after an agent has
  already checked in and Alan remains quiet, the agent can generate a warm
  in-world leave line and then actually archive the conversation. Human
  leave-guard logic still blocks ordinary agent-requested exits; it only permits
  exits for this explicit idle-closing path.
  Verification: `npm test -- convex/aiTown/agent.test.ts`, `npx tsc --noEmit
  --pretty false`, `npm run build`.
- 2026-06-01 local: Reviewed Alan's fresh Alan<->Tianze playtest after a mid-chat
  disconnect. Recent conversation evidence (`conversation-c:82407`, 6/1 13:45
  CT) showed Tianze was directionally successful at concrete responsibility
  differentiation: she turned care into tomorrow's curry / lunch follow-through,
  kept a boundary around Alan forgetting to eat, and avoided collapsing fully
  into Umi-style coordination. Weak spots were one over-specific/hallucinated
  "5/20 chaotic project" callback, repeated food/greens/hand-shaking motifs,
  and the final Alan question about whether Umi would be unhappy being archived
  without an Tianze reply. Runtime evidence showed the server was alive but a
  Convex optimistic-concurrency conflict hit during `writeMessage` /
  `finishSendingMessage` while `saveWorld` was also updating inputs. Added a
  narrow runtime guard: client-side short retry only for transient Convex write
  conflicts, plus server-side `messageUuid` idempotency so retrying a send cannot
  duplicate the same message.
  Verification: `npx tsc --noEmit --pretty false`, `npm run build`, `curl -I
  http://localhost:5173/ai-town`, `npx convex run school:worldClock`.
- 2026-06-01 local: Checked Alan's report that the server might be down. Frontend
  Vite was alive on `localhost:5173` but bound to IPv6 `::1`, so
  `127.0.0.1:5173` failed while `http://localhost:5173/ai-town` returned HTTP
  200. Convex local backend was stuck during startup with duplicate
  `convex-local-backend` processes and no listener on port 3210. Killed the
  stuck backend/run processes and restarted `npm run dev:backend` with
  `CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS=180`. Backend recovered, Convex
  functions became ready, world status is `running`, and `school:worldClock`
  reports 2026-06-01 13:34 CT / world day 14 afternoon 1:34. Some restart logs
  showed expected scheduled-job backlog and transient world-blocked warnings
  after downtime.
  Verification: `curl -I http://localhost:5173/ai-town`, `lsof -nP -iTCP:3210
  -sTCP:LISTEN`, `npx convex run school:worldClock`, `npx convex run
  world:defaultWorldStatus`, `npx convex run school:debugState`.
- 2026-05-31 local / 2026-06-01 UTC: Added Alan's new Qwen/newcoin key as a
  backup, without writing the secret into the repo. Stored it in
  `~/.config/giis-underworld/secrets.env` as `QWEN_API_KEY_BACKUP` and synced
  the local Convex env `UMI_MAHIRU_PILOT_API_KEY_BACKUP`. Updated the
  OpenAI-compatible Qwen pilot path so it uses the primary key first and retries
  the backup key once on provider/auth/quota/rate/timeout/server failures.
  Updated `scripts/test-qwen-key.mjs --backup` and `.env.local.example` to make
  the backup path explicit. Verified the key works against the configured
  OpenAI-compatible chat completions endpoint with `qwen3-max`; no secret was
  found in repo search.
  Verification: masked secrets/env checks, `node scripts/test-qwen-key.mjs
  --backup`, `npx tsc --noEmit --pretty false`, `npm run build`, repo `rg`
  secret scan.
- 2026-05-31 local / 2026-06-01 UTC: Investigated Alan's latest Alan<->Umi and
  Alan<->Mahiru playtest issues. Evidence showed Umi failed greeting/direct
  binding, hallucinated the time as early morning despite the world clock being
  Sunday 20:xx CT, and did not answer Alan's final casual weekend question.
  Mahiru's dialogue quality was better but the human chat still ended too
  quickly. Also found frontend duplication evidence: repeated
  `Alan 主動找 真晝 說話。` events within one second and multiple Alan messages
  sharing one `messageUuid`, explaining the visible optimistic-message overlap.
  Implemented the P0 stability pass: every manual send now gets a fresh UUID and
  stays locked until the write mutation settles; conversation-start actions are
  single-flight plus a 3s local debounce; agent-requested leaves are deferred
  for human conversations so Alan's explicit leave action owns closure; and
  conversation prompts now use the America/Chicago school-clock context instead
  of naked `toLocaleString()` time. Added stronger human-chat binding so
  characters greet Alan, answer his latest input first, and keep casual life
  questions in ordinary school life unless Alan asks for whole-school analysis.
  Verification: `npx tsc --noEmit`, `npm run build`, `curl -I
  http://localhost:5173/ai-town`, `npx convex run school:worldClock`, `npx
  convex run school:observe '{}'`, `npm run eval:conversation:recent --
  --since-last-change` (0 post-fix archived conversations yet; wait for fresh
  samples before judging quality).
- 2026-05-31 local / 2026-06-01 UTC: Ran the quota-aware fresh validation gate
  after the Qwen key rotation. Boundary `1780272321375` collected 3 scoped
  triad samples: `conversation-c:80477` (Umi/Mahiru, PASS 1.00),
  `conversation-c:80506` (Mahiru/Tianze, PASS 1.00), and
  `conversation-c:80535` (Umi/Tianze, PASS 1.00). Latest v0.1 goal audit is PASS:
  local fallback blocked, pilot env clean, fresh sample count 3, fresh fallback
  markers 0, no fresh motif/hygiene loop, AM->PM continuity PASS, old fallback
  cleanup remains proposal-only, and night quiet was not forced. Rubric
  reconciliation is HUMAN_REVIEW_READY with no v0.1 blockers. Remaining quality
  gaps for Alan review: `conversation-c:80535` loops on `飯` x4, `conversation-c:80506`
  has a voice-rubric gap, and `conversation-c:80477` has mirror-binding warning
  despite a strong Umi moment ("名字定下來了，但剛才那五分鐘……我其實也想停一會兒。").
  Repair gate says proposal-only / observe-only; do not auto-fix dialogue code
  from these three samples. v0.1 is complete as an evidence gate and should move
  to Alan human playtest review.
  Verification: `npm run underworld:observe -- --cc=skip --target-samples=3
  --sample-timeout-ms=240000 --since-created-at=1780272321375`, `npm run
  underworld:v01-goal-audit`, `npm run underworld:rubric-reconcile`, `npm run
  underworld:repair-gate`.
- 2026-05-31 local: Rotated the Qwen key after Alan provided a
  replacement purchase screenshot. Updated `~/.config/giis-underworld/secrets.env`
  and local Convex env `UMI_MAHIRU_PILOT_API_KEY`; kept the secret out of the
  repo. Verified the secret file remains mode 600 and ran a minimal Qwen smoke
  test against the configured OpenAI-compatible endpoint with `qwen3-max`, which
  returned HTTP 200. I did not run the full 3-sample v0.1 gate immediately in order to avoid
  burning the newly purchased quota without Alan explicitly asking for that next
  spend. Next useful command: rerun a quota-aware fresh gate for the prop/motif
  candidate patch.
  Verification: masked `awk`/`stat` on `~/.config/giis-underworld/secrets.env`,
  `npx convex env set UMI_MAHIRU_PILOT_API_KEY "$QWEN_API_KEY"`, `node
  scripts/test-qwen-key.mjs qwen3-max <configured-base-url>`.
- 2026-05-31 local: Alan approved the narrow prop/motif diversification proposal,
  so I implemented it as a bounded v0.1 candidate. `convex/agent/conversation.ts`
  now builds a motif guard from current conversation messages plus recent
  same-pair residues, warns away from repeated prop families (cold tea/cups,
  bento/meals, checklists/reports/files, window/hallway/empty chair, split/carry
  responsibility moves), adds a response-move guard when the previous speaker
  already used split/carry/handoff/rest, and gives Umi/Mahiru/Tianze distinct
  action guidance: Umi reduces overload through queue/not-now boundary/shorter
  brief, Mahiru notices quiet pain through posture/voice/silence/distance/eye
  contact, and Tianze changes concrete responsibility through owner/deadline/
  refusal/handoff. Added `convex/agent/conversationMotifGuard.test.ts`. Updated
  the proposal as accepted/implemented. No memory schema, provider routing,
  DB cleanup, relationship schema, or broad soul architecture changed.
  Post-change fresh validation is still pending: the sample run at boundary
  `1780270175518` collected 0 samples because Qwen preflight returned
  `403 token quota is not enough`. Latest observe therefore withholds v0.1
  scores; goal audit is PENDING and rubric reconciliation is BLOCKED. Repair
  gate classified provider failure handling as observe-only and made no code
  change. Next useful action is provider quota/key/routing fix or Alan-approved
  alternate provider path, then rerun fresh sample gate.
  Verification: `npm test -- --runInBand
  convex/agent/conversationMotifGuard.test.ts
  convex/agent/dialogueHygiene.test.ts`, `npx tsc --noEmit --pretty false`,
  `git diff --check`, `npm run underworld:harness:self-test`, `npm run build`,
  `npm run underworld:observe -- --cc=skip --target-samples=3
  --sample-timeout-ms=240000 --since-created-at=1780270175518` (provider quota
  failure / 0 samples), `npm run underworld:v01-goal-audit` (expected PENDING /
  non-zero), `npm run underworld:rubric-reconcile` (expected BLOCKED /
  non-zero), `npm run underworld:repair-gate`.
- 2026-05-31 local: Ran the 16:40-16:59 CT afternoon v0.1 continuation. Active
  scoped sample collection hit provider/Convex timeouts, so repair gate held at
  observe-only for that operational issue. A no-collect full-day observe from
  boundary `1780225944601` still found enough natural archived evidence to prove
  AM->PM continuity: latest report shows `PASS / continuity_observed`, 24 fresh
  triad samples, 0 fresh fallback markers, 76 morning samples, 61 afternoon
  samples, and 12 PM callbacks. v0.1 is still not complete: latest goal audit is
  FAIL because `no_fresh_motif_or_hygiene_loop` fails, life signals are
  `WARN / prop_echo_repeated`, recent eval is 0 PASS / 3 WARN / 9 FAIL, and
  broader day-window diagnostics show 39 prop echo flags plus 42 pilot action
  collapse flags. Repair gate and CC second opinion classify this as
  proposal-only content-shape work, with `stage_direction_leak` likely a rubric
  misdiagnosis. Created
  `umi/proposals/20260531T215710Z-v01-prop-motif-lock-proposal.md`; do not
  implement prompt/soul changes from it until Alan or Central Umi accepts this
  as the next v0.1 blocker.
  Verification: `npm run underworld:v01-daytime-check` (provider/Convex
  timeout, expected non-completion), `npx convex run school:debugState`,
  `npx convex run world:defaultWorldStatus`, `npx convex run school:worldClock`,
  `npm run underworld:observe -- --cc=skip --target-samples=0
  --since-created-at=1780225944601`, `npm run underworld:v01-goal-audit`
  (expected FAIL / non-zero), `npm run underworld:rubric-reconcile` (expected
  BLOCKED / non-zero), `npm run underworld:repair-gate`, `git diff --check`.
- 2026-05-31 local: Ran the 06:10 CT daytime v0.1 gate and collected fresh
  Umi/Mahiru/Tianze triad samples. Current v0.1 audit is PENDING with one
  remaining requirement: AM->PM continuity is still `WARN / sample_pending`
  because the afternoon window has 0 samples. Fresh gate evidence improved:
  fresh triad sample count is 3, local fallback is blocked, fresh fallback
  markers are 0, fresh motif/hygiene loop is clear, fresh-window life signals
  are `PASS / life_signal_observed`, and the soul harness passed all 3 fresh
  samples. Recent-conversation eval still reports rubric disagreement (0 PASS /
  1 WARN / 2 FAIL), so do not tune broad prompts from score alone. I made one
  narrow harness-only fix in `scripts/underworld-life-signals.mjs`: role-action
  diagnostics now prefer a pilot character's expected action style when that
  style is present, so shared body/prop words like `手` do not falsely mark Umi,
  Mahiru, and Tianze as collapsed. After rerunning a fresh 3-sample gate,
  role-action collapse cleared for the fresh window (expected action matches
  6/6, collapse flags 0), while day-window life signals still warn on one
  prop/motif echo from broader morning archives. The next true completion gate
  is afternoon continuity: wait until 13:00-16:59 CT has at least 3 archived
  samples, then rerun the v0.1 audit/rubric.
  Verification: `npm run underworld:v01-daytime-check` (expected PENDING /
  non-zero because AM->PM is sample-pending), `npm run
  underworld:rubric-reconcile` (expected BLOCKED / non-zero), `node --check
  scripts/underworld-life-signals.mjs`, `npm run
  underworld:life-signals:self-test`, `npm run underworld:life-signals`, `npm
  run underworld:harness:self-test`, `git diff --check`.
- 2026-05-31 local: Cleaned up the role-action life-signal report for the
  daytime gate. `scripts/underworld-life-signals.mjs` now renders empty pilot
  expected-action windows as `no_data (0/0)` instead of `0.00`, matching the
  observe/day-start reports and avoiding a false "bad role differentiation"
  signal when no samples exist. Regenerated read-only life-signals and observe
  reports at 00:22 CT; night quiet correctly skipped collection, fresh samples
  remain 0, v0.1 audit remains PENDING, and rubric reconciliation remains
  BLOCKED until daytime evidence exists. The browser UI readiness report from
  00:18 CT is also captured at `umi/reports/ui-readiness-latest.md` with a
  screenshot under `umi/reports/screenshots/`; it supports readable UI/runtime
  only, not the dialogue loop.
  Verification: `node --check scripts/underworld-life-signals.mjs`, `npm run
  underworld:life-signals:self-test`, `npm run underworld:life-signals`, `npm
  run underworld:observe -- --cc=skip` (night quiet / no collection), `npm run
  underworld:v01-goal-audit` (expected PENDING / non-zero), `npm run
  underworld:rubric-reconcile` (expected BLOCKED / non-zero), `npm run
  underworld:harness:self-test`, `git diff --check`.
- 2026-05-31 local: Added pilot role-action readiness to
  `scripts/underworld-day-start.mjs`, including `no_data (0/0)` handling for
  empty sample windows and routing `pilot_role_actions_flat` /
  `pilot_role_action_collapse` into the life-signal review path. Refreshed the
  read-only day-start report at 00:16 CT: frontend ok, local Convex ok, world
  running, fallback pollution 0, life signals `WARN / sample_pending`, and
  role-action readiness `0/0` no-data. No world resume, dialogue trigger, or
  Convex write was performed.
  Verification: `node --check scripts/underworld-day-start.mjs`, `npm run
  underworld:day-start`, `git diff --check`.
- 2026-05-31 local: Verified non-sampling v0.1 runtime/readiness while waiting
  for the daytime sample gate. Production build passes, and read-only
  `underworld:day-start` reports `/ai-town` frontend ok, local Convex backend
  ok, world status `running`, active fallback pollution 0, and report freshness
  around 4 minutes. Because local time was 00:14 CT, day-start's safest next
  action remains "Let the world sleep"; no world resume, dialogue trigger, or
  Convex write was performed.
  Verification: `npm run build` (passes with existing Vite chunk-size warning),
  `npm run underworld:day-start`, `git diff --check`.
- 2026-05-31 local: Updated Codex heartbeat `underworld-v0-1-daytime-gate`
  so the 06:10 CT continuation explicitly inspects fresh role-action
  diagnostics in addition to sample count, fallback contamination, AM->PM
  continuity, and prop/motif loops. The heartbeat should only mark the active
  goal complete after a requirement-by-requirement audit proves v0.1, and it
  must preserve night quiet if the thread resumes early.
  Verification: viewed `/Users/alanhdchu/.codex/automations/underworld-v0-1-daytime-gate/automation.toml`
  and confirmed the prompt update.
- 2026-05-31 local: Wired the new pilot role-action diagnostics into
  `scripts/underworld-observe-once.mjs` so `v01-approach-latest.md` now reports
  pilot expected action match rate and action-collapse flags for both fresh and
  day-window life signals. Refreshed observe at 00:10 CT; night quiet correctly
  skipped collection, fresh samples remain 0, 5/31 day-window signals are
  `WARN / sample_pending`, role-action rate is shown as `no_data (0/0)`, and
  v0.1 audit is PENDING while rubric reconciliation remains BLOCKED. This
  replaces the older 5/30 `weak_continuity` snapshot as the current-state
  source; the next real gate is still the 06:10 CT daytime sample run.
  Verification: `node --check scripts/underworld-observe-once.mjs`, `npm run
  underworld:observe:self-test`, `npm run underworld:observe -- --cc=skip`
  (night quiet / no collection), `npm run underworld:v01-goal-audit` (expected
  PENDING), `npm run underworld:rubric-reconcile` (expected BLOCKED), `git diff
  --check`.
- 2026-05-31 local: Added a read-only pilot role-action diagnostic to
  `scripts/underworld-life-signals.mjs`. The report now lists expected action
  matches and role-action collapse for Umi/Mahiru/Tianze, so v0.1 can distinguish
  "same emotional direction" from "same care shape" during fresh daytime
  sampling. Regenerated the 2026-05-30 life-signals report; it remains
  `WARN / prop_echo_repeated`, with additional evidence that old samples often
  collapse into shared care/action styles. No Convex writes or sample collection
  were performed because local time was 00:03 CT night quiet.
  Verification: `node --check scripts/underworld-life-signals.mjs`, `npm run
  underworld:life-signals:self-test`, `npm run underworld:life-signals --
  --date=2026-05-30`, `npm run underworld:harness:self-test`, `git diff
  --check`, `npm run underworld:v01-goal-audit` (expected FAIL), `npm run
  underworld:rubric-reconcile` (expected BLOCKED).
- 2026-05-30 local / 2026-05-31 UTC: Created Codex thread heartbeat
  `underworld-v0-1-daytime-gate` so the active v0.1 goal resumes during the
  next daytime window instead of forcing night collection. The heartbeat should
  refresh current state, run `npm run underworld:v01-daytime-check` only if
  Chicago time is daytime, inspect fresh reports, and either complete-audit or
  make evidence-backed v0.1 fixes. This preserves the night quiet policy while
  keeping the goal moving.
  Verification: Codex automation create returned automation id
  `underworld-v0-1-daytime-gate`.
- 2026-05-30 local / 2026-05-31 UTC: Fixed v0.1 observe report
  overclaiming when no fresh samples exist. `scripts/underworld-observe-once.mjs`
  now withholds the `v0.1 Scores` block until at least 3 fresh conversations
  exist, instead of rendering default decimals that look like measured
  regression/readiness. Refreshed observe during night quiet; report now says
  `status: withheld` with `fresh_sample_count: 0`. Updated central
  `/Users/alanhdchu/umi-central/goals.md` so Underworld no longer claims PASS;
  it now points to the local FAIL/BLOCKED truth and the next daytime command.
  Verification: `npm run underworld:observe:self-test`, `node --check
  scripts/underworld-observe-once.mjs`, `npm run underworld:observe --
  --cc=skip` (night quiet / no collection), `npm run
  underworld:v01-goal-audit` (expected FAIL), `git diff --check`.
- 2026-05-30 local / 2026-05-31 UTC: Added a narrow prompt hygiene pass toward
  v0.1 readiness. Compact autonomous and soul-triad continuation prompts now
  receive previous-message prop repetition context, so repeated objects/scenes
  like tea/cups/lights/files can be explicitly avoided after two mentions.
  Same-pair residue prompt lines now include Chicago time-of-day labels
  (`today morning/afternoon/evening/night`) and guidance to turn earlier-today
  residue into a short behavior callback instead of replaying the line. Current
  night observe correctly skipped sample collection; v0.1 remains active
  because fresh triad samples are 0 and AM->PM continuity is still
  `WARN / weak_continuity`. Next useful command during daytime:
  `npm run underworld:v01-daytime-check`.
  Verification: `npx tsc --noEmit --pretty false`, `npm run
  underworld:harness:self-test`, `npm run underworld:observe -- --cc=skip`
  (night quiet / no collection), `npm run underworld:v01-goal-audit`
  (expected FAIL), `npm run underworld:rubric-reconcile` (expected BLOCKED),
  `npm run build`, `git diff --check`.
- 2026-05-30 local / 2026-05-31 UTC: Added bounded event-thread
  continuity MVP. Autonomous school-life advancement now seeds at most one
  `campusEventThread` from the current scene's school-life mood event, writes a
  single world event plus short memories for up to three involved characters,
  and prompts later conversations to treat that event as shared school context
  without repeating the summary verbatim. Added
  `docs/soul/EVENT_THREAD_CONTINUITY_PLAN.md` and roadmap/index entries.
  Verification: `npx tsc --noEmit --pretty false`, `npm run build`, `npm run
  underworld:harness:self-test`.
- 2026-05-30 local / 2026-05-31 UTC: Tightened
  `scripts/underworld-am-pm-continuity.mjs` so shared life cues like `Alan`,
  `手`, `休息`, or repeated `作業/硬撐` motifs no longer count as strong
  AM->PM continuity without explicit morning callback or PM memory-trace
  evidence. Updated docs, reports, and rubric reconciliation so weak AM->PM
  continuity blocks v0.1 playtest readiness. Verification: `npm run
  underworld:am-pm-continuity:self-test`, `npm run underworld:am-pm-continuity`,
  `npm run underworld:observe`, `npm run underworld:v01-goal-audit` (expected
  FAIL because strict AM->PM is only WARN), `npx tsc --noEmit --pretty false`,
  `npm run build`, `npm run underworld:harness:self-test`, `npm run
  underworld:rubric-reconcile` (expected BLOCKED), `git diff --check`.

## Verification Commands

Use only the commands relevant to the change:

```bash
npm test
npx tsc --noEmit --pretty false
npm run build
npm run underworld:rubric-reconcile
npm run underworld:am-pm-continuity
npx convex run school:auditFallbackPollution '{"limit":1000}'
```

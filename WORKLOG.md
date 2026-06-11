# WORKLOG - Umi / Codex / CC Current Evidence

Last updated: 2026-06-10

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
| 1 | Next Alan <-> Umi playtest should confirm greeting behavior, latest-sentence binding, correction binding (`不是依賴，是喜歡`), yesterday/today continuity, and closing behavior using `umi/playtest-v01-alan-facing-gate.md`; fill the existing ignored local `PARTIAL` draft at `umi/reports/alan-facing-v01-playtest-latest.md`, then validate it with `npm run underworld:alan-playtest-check`. The read-only candidate scan at `umi/reports/alan-playtest-candidates-latest.md` found `NO_COMPLETE_CANDIDATE`, so do not backfill this gate from old chats. | Alan / Umi | pending fresh playtest |
| 2 | Decide whether to backfill old memory strings that used UTC + `en-US` formatting before the newer `zh-TW` + `America/Chicago` convention. | Alan / Codex | waiting on Alan decision |
| 3 | Compact Alan-facing v0.1 playtest checklist and success/failure record format exists at `umi/playtest-v01-alan-facing-gate.md`; `v01-completion-audit` now reads `umi/reports/alan-facing-v01-playtest-latest.md` when present and only accepts `Verdict: PASS` if all five required checklist lines are present and marked PASS, so use that artifact before treating Alan-facing quality as proven. | Codex | ready |
| 4 | CC auth/keychain remains unreliable; use bounded in-app sub-agent/cc paths only when available and verify output before accepting. | Umi / Codex | watch |
| 5 | Post-role-change v0.1 rerun remains active, not complete. On 2026-06-10 10:35 CDT, `npm run underworld:v01-completion-audit` is `FAIL` with 2 fail / 2 pending / 4 pass after a fresh morning observe pass. The useful evidence is mixed: runtime/provider/fallback are healthy, two fresh archived triad samples passed soul-triad eval, but the third focused sample timed out and left an active incomplete 海/天澤 conversation; recent eval marked 0 PASS / 0 WARN / 3 FAIL, while `v01-approach` labels the blocker `eval_rubric_disagreement` / proposal-only. Later evidence improved one gate: the 18:58 CDT `rolling-continuity-latest.md` is now `PASS / continuity_observed` with 34 callbacks from the 10:00-12:00 source window to the 12:00-14:00 callback window, so rolling continuity is no longer the leading blocker. The 20:26 CDT Alan-facing candidate scan still found `NO_COMPLETE_CANDIDATE`, and the durable Alan-facing playtest artifact remains `PARTIAL` with 0/5 PASS rows. The next safe actions are to reconcile eval framing before changing dialogue code, and fill/replace `umi/reports/alan-facing-v01-playtest-latest.md` only from a real Alan <-> Umi playtest or explicit Alan/product-owner defer. | Alan / Umi | active_fail_eval_framing_and_alan_playtest |
| 6 | Paper (emotional residue) is local-source ready only as a conservative design/systems preprint, and Alan reported submitting the A-path preprint on OSF on 2026-06-10 because arXiv upload is blocked by endorsement. `docs/paper/OSF_RELEASE_RECORD.md` is the current OSF posting ledger; public OSF URL / DOI / submitted file / license metadata remain `TO_RECORD` locally. `docs/paper/arxiv/main.tex` now includes provider/model-path disclosure, measured-limits text for untested verbatim leakage, an explicit ethics/scope note, denominator-safe wording for the 15-candidate/2-callback rolling window, reflexivity disclosure for author-designed rule markers, narrowed read-block-suppression wording instead of "primary causal ablation", social-agent evaluation context via SOTOPIA / Lifelong SOTOPIA, and a disclosure that `UNDERWORLD_RESIDUE_READ=placebo` is draft runtime plumbing that is not preregistered, collected, or analyzed in this paper. `docs/paper/ARXIV_PREPRINT_RELEASE_PACKET.md` remains the future arXiv mirror packet; arXiv is paused until endorsement/account readiness and platform preview are resolved. `docs/paper/CITATION_PROVENANCE.md` plus `npm run paper:citation-audit` cover all 17 bibliography keys and primary/official URLs for recent LLM-agent / AI Town / social-agent references. `docs/paper/PREREGISTRATION_PROTOCOL.md` is a machine-audited draft for the future empirical study, not an accepted collection authorization; it now records continuing-world carryover/read-eligibility, dyad fallback, no interim effect peeking, and a concrete final-N selection procedure from pilot baseline/MDE/design-effect. `paper:residue-arm-window` still requires both `SCHEDULE_ACCEPTANCE.json` and `PREREGISTRATION_ACCEPTANCE.json` before it can change `UNDERWORLD_RESIDUE_READ` or hold a collection window; it now writes `run-provenance.json` / `artifact-hashes.json` and attaches `run_provenance` to future dataset rows so long-window collection preserves secret-safe git state, accepted schedule/preregistration hashes, source-archive hash, command args, runtime, env policy, and artifact/log hashes. Legacy forced runners `paper:residue-ablation` and `paper:residue-ablation:blocks` now refuse to run unless `--allow-legacy-forced-pilot` is explicitly provided, so accidental short forced collection is blocked by default. `paper:run-provenance-audit` can check each completed arm-window run directory before merge, and `paper:merge-ablation-runs` now writes a merge manifest and refuses to merge failed-provenance arm-window runs. Human annotation plumbing is ready but unrun: `annotation_sheet.csv` is still a blank blinded worksheet with only 4 rows; `annotation_packet_manifest.json` and `transcript_packet_manifest.json` now prove the pre-rater sheet/key/transcript hashes, selected blind IDs, exact blind-id-to-source-report mapping, missing-transcript status, source-report hashes, and blinding flags; `paper:annotation-audit` now verifies those source report paths/hashes and future completed rater sheet paths/hashes. `scripts/paper/merge_rater_annotations.py` must later merge completed independent rater sheets into analysis-ready `annotations.csv` with `annotations_manifest.json`, and now refuses completed rater sheets that include leaked/unblinded columns or non-blinded `case_ref` values. `paper:annotation-audit` reports `PACKET_READY_INCOMPLETE_STUDY`: 0 FAIL, with empirical blockers for stale mutable source-report hash, 4 rows, no merged annotations, and one dyad. `docs/paper/ALAN_HANDOFF.md` is the one-page boundary summary; `docs/paper/REVIEWER_PREMORTEM.md` records cc-reviewed objections including between-arm carryover. `paper:archive-audit` rebuilds the local arXiv/source archive with atomic output replacement, verifies the manifest/SHA/member allowlist, and checks for accidental data/results/annotation/transcript or obvious secret leakage. Current `npm run paper:readiness` verdict is `LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`, archive SHA-256 `099a8fbcdb2c588e3678b850d6f1ba40fc36f563bae3657a434827d857f222ab`. Empirical/mechanism claims remain blocked: n=4, one dyad, no completed independent rater merge, stale annotation source-report packet, saturated aftertaste proxy, missing generation metadata/provenance on old rows, trace-overlap audit only has 11 callback cases, final N is not fixed, no accepted long-window schedule or preregistration, and the local placebo plumbing is not preregistered, collected, or analyzed. | Alan / Codex | osf_submitted_arxiv_endorsement_blocked_empirical_blocked |

## Current State Snapshot

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
  the backup path explicit. Verified the key works against
  `https://api.newcoin.top/v1/chat/completions` with `qwen3-max`; no secret was
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
- 2026-05-31 local: Rotated the Qwen/newcoin key after Alan provided a
  replacement purchase screenshot. Updated `~/.config/giis-underworld/secrets.env`
  and local Convex env `UMI_MAHIRU_PILOT_API_KEY`; kept the secret out of the
  repo. Verified the secret file remains mode 600 and ran a minimal Qwen smoke
  test against `https://api.newcoin.top` with `qwen3-max`, which returned HTTP
  200. I did not run the full 3-sample v0.1 gate immediately in order to avoid
  burning the newly purchased quota without Alan explicitly asking for that next
  spend. Next useful command: rerun a quota-aware fresh gate for the prop/motif
  candidate patch.
  Verification: masked `awk`/`stat` on `~/.config/giis-underworld/secrets.env`,
  `npx convex env set UMI_MAHIRU_PILOT_API_KEY "$QWEN_API_KEY"`, `node
  scripts/test-qwen-key.mjs qwen3-max https://api.newcoin.top`.
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

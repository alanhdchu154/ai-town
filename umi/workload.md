# Umi Workload

Last updated: 2026-06-12 20:34 America/Chicago

This file holds one active worker handoff at a time. Keep it narrow.

## Active Task

`uw-2026-06-12-orphan-wake-motif-review`

Goal:

- Read-only review of Codex's two v0.1 caveat fixes before commit/push:
  1. Alan chat no-response/orphan timeline when the world is `stoppedByDeveloper`.
  2. Fresh 海/真晝 hand / quoted-phrase motif relay from c:7057 / c:7038 / c:7152.

Current evidence:

- `npm run underworld:v01-completion-audit` is PASS as of 2026-06-12 20:15 CDT:
  0 fail / 0 pending / 0 deferred / 8 pass.
- Fresh-window `life-signals` is PASS / `life_signal_observed`.
- Alan-facing 海 playtest artifact is PASS at 2026-06-11 09:54 CDT.
- Fresh recent eval remains imperfect: 0 PASS / 2 WARN / 1 FAIL across three
  fresh 海/真晝 samples. Treat this as a v0.1 quality caveat, not a blocker under
  the current completion audit.
- One 2026-06-12 20:06 Alan/海 timeline session appears as an orphan diagnostic
  with Alan-side messages only. Fresh runtime diagnostics showed
  `worldStatus: stoppedByDeveloper`, `engineRunning: false`, and no pending
  `finishSendingMessage`; `convex/messages.ts` previously returned without
  waking on `stoppedByDeveloper`.
- Codex patch under review:
  - `convex/messages.ts` exports a pure wake-policy helper and schedules the
    post-write wake with `forceHumanInputWake: true`.
  - `convex/messagesWake.test.ts` locks passive stop respect vs explicit human
    chat wake.
  - `convex/agent/conversation.ts` adds a fresh-evidence motif family and
    output relay abort for hand / `這句話` / `明天簡報第一行` / `收進口袋`.
  - `convex/agent/conversationMotifGuard.test.ts` locks prompt and output guards.
- Targeted Jest already passed:
  `npm test -- --runTestsByPath convex/messagesWake.test.ts convex/agent/conversationMotifGuard.test.ts`.

Allowed scope:

- Read-only review only.
- Inspect only:
  - `convex/messages.ts`
  - `convex/messagesWake.test.ts`
  - `convex/agent/conversation.ts`
  - `convex/agent/conversationMotifGuard.test.ts`
  - relevant `git diff` for those files.
- Do not edit, stage, commit, push, run broad evals, or inspect unrelated files
  unless needed to explain a direct bug in this patch.

Stop condition:

- Report top findings by severity, missing tests if any, and whether the patch is
  safe to keep before build/gate.
- If the review needs broader repo context, stop and say exactly what is missing
  rather than expanding scope.

## Last Completed Handoff

`uw-2026-06-12-v01-experience-log-postpatch-review`

Outcome:

- cc completed a read-only postpatch review at
  `umi/reports/20260612T221947Z-workload.md`.
- cc found the five-pilot experience-log scope, pollution guards, caps, and
  dry-run sleep bridge sound.
- Codex accepted cc's only small follow-up and added an explicit
  `sourceKind: archivedConversation` internal contract to the writer call.

Next likely cc handoff:

- Only after fresh evidence repeats the same failure across enough clean
  archived samples.
- Candidate scope: review motif-loop / character-voice failures from
  `umi/reports/v01-approach-latest.md` and recommend whether the fix should be
  auto-fix, proposal-only, or observe-only.

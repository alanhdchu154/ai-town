# CC Workload - Underworld Forced Sample Focus + Motif Diagnosis

Time anchor: 2026-06-16 18:58 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first diagnosis
Status: completed; report `umi/reports/20260617T000242Z-workload.md`

## Task ID

underworld-forced-sample-focus-motif-diagnosis-20260616-1858

## Current Goal

Alan asked Umi to force a few fresh conversations and then fix the current
Underworld dialogue issue. Umi collected a fresh daytime sample batch. The batch
produced enough evidence for diagnosis, but also exposed a sample-runner harness
bug and focus-routing instability.

Do not broad prompt-tune. Do not change memory architecture, provider config,
Convex schema, character expansion, or world state. This pass is read-only.

## Fresh Evidence From Umi

Command run:

```bash
npm run underworld:runtime-preflight && npm run underworld:observe:daytime-samples
```

Observed:

- Runtime preflight PASS before sample collection.
- Focus sample 1 `Umi:Mahiru` eventually produced archived sample
  `conversation-c:37647` (`海 / 真晝`) plus an extra fresh sample
  `conversation-c:37638` (`貓貓 / 祥子`); `eval:soul-triad` PASS for both.
- Focus sample 2 `Tianze:Ichinose` timed out after 240000ms. It repeatedly
  reported `ignored 1 fresh incomplete/non-focus triad candidate(s)` and no
  expected archived focus sample.
- Focus sample 3 `Ichinose:Maomao` also timed out after 240000ms with repeated
  `ignored 1 fresh incomplete/non-focus triad candidate(s)`.
- Despite focus timeouts, the wrapper printed 5 fresh transcripts:
  `conversation-c:37730` 天澤/海, `conversation-c:37683` 天澤/一之瀨,
  `conversation-c:37686` 海/真晝, `conversation-c:37647` 海/真晝,
  `conversation-c:37638` 貓貓/祥子.
- `eval:soul-triad --since-created-at=1781653446624`: PASS 5/5.
- `eval:conversation:recent --since-created-at=1781653446624`: 0 PASS / 2 WARN / 3 FAIL.
- `underworld-observe-once.mjs` then crashed while writing its report because
  `openingTemplateLines()` called an undefined `truncate()` helper. Codex already
  patched that harness bug locally and `npm run underworld:observe:self-test`
  PASS.

Latest report to read:

- `evals/conversations/reports/latest.md`
- `evals/conversations/reports/soul-triad-latest.md`
- `umi/reports/runtime-preflight-latest.md`

Key recent-eval failures:

- `conversation-c:37683` 天澤/一之瀨: FAIL 0.81; over-repeated `湯匙` x6;
  weak emotional specificity; attention shift 0/8.
- `conversation-c:37638` 貓貓/祥子: FAIL 0.84; weak character voice; no explicit
  continuity callback; opening lacks concrete reason and ending lacks soft close.
- `conversation-c:37730` 天澤/海: FAIL 0.90; weak character voice; mirror/motif
  loop; care move too similar.
- `conversation-c:37686` and `conversation-c:37647` 海/真晝: WARN; previous
  speaker binding mirror repetition and continuity callback without concrete cue.

## Candidate Files To Inspect

- `scripts/run-soul-triad-single-sample.mjs`
- `scripts/underworld-observe-once.mjs`
- `evals/conversations/runRecentConversationEval.ts`
- `evals/conversations/metrics/conversation_metrics.ts`
- `evals/conversations/metrics/opening_template.ts`
- `convex/agent/conversation.ts`
- `convex/agent/conversationMotifGuard.test.ts`
- `convex/agent/experienceLog.ts`
- `convex/aiTown/agent.ts`
- `convex/constants.ts`

## Questions For CC

Read-only findings-first:

1. Why did the controlled focus samples time out while non-focus/fresh triad
   conversations were created? Is the smallest fix in the sample runner,
   focus-pair aliases, co-location/enqueue logic, polling/expected-sample
   predicate, or engine behavior?
2. Does the fresh 0 PASS / 2 WARN / 3 FAIL point to a code-level motif guard
   issue, eval over-penalization, or prompt-level template collapse?
3. What is the smallest safe patch Codex should make today?
4. Which parts should remain observe-only until more natural samples exist?
5. What exact verification commands should Codex run after the patch?

## Constraints

- Read-only: do not modify files in this cc pass.
- Do not run watch/dev servers.
- Do not intentionally mutate Convex state or trigger new conversations.
- Do not call provider/LLM generation.
- No broad prompt rewrite.
- Treat the `truncate` helper patch as already made by Codex; review it only if
  relevant.

## Suggested Non-Mutating Commands

```bash
git status --short
sed -n '1,220p' evals/conversations/reports/latest.md
npm test -- evals/conversations/metrics/conversation_metrics.test.ts
node --check scripts/run-soul-triad-single-sample.mjs
node --check scripts/underworld-observe-once.mjs
```

Stop if any command would trigger live generation or mutate Convex state.

## Expected Output

Return:

1. Top findings by severity, with file/line references where useful.
2. One recommended smallest patch, or say no patch yet if evidence is
   insufficient.
3. Tests/checks to run.
4. Explicit "do not change yet" boundaries.

## Result

cc completed the read-only diagnosis. Accepted findings:

- The controlled focus runner first rejected focus pairs outside the old
  海/真晝/天澤 triad before applying the focus-pair key.
- Codex's follow-up live query found an additional alias bug: `Ichinose`,
  `Maomao`, and `Sakiko` were not normalized to `一之瀨`, `貓貓`, and `祥子`,
  so English focus-pair args could still fail to match valid archived
  conversations.
- Fresh dialogue quality still has real WARN/FAIL signals, but this patch should
  not change prompts or motif guards. The quality repair remains a separate
  product task.

Codex implementation:

- Patched `scripts/run-soul-triad-single-sample.mjs` so a supplied focus pair is
  the matching scope before falling back to original triad matching.
- Added English aliases for `Ichinose`, `Maomao`, and `Sakiko`.
- Added self-test coverage for non-original-triad focus pairs.
- Patched `scripts/underworld-observe-once.mjs` with the missing `truncate`
  helper used by opening-template report lines.

Verification:

- `node --check scripts/run-soul-triad-single-sample.mjs`: PASS.
- `node scripts/run-soul-triad-single-sample.mjs --self-test`: PASS.
- `node scripts/underworld-observe-once.mjs --self-test`: PASS.
- `npm test -- evals/conversations/metrics/conversation_metrics.test.ts`: PASS
  20/20.
- `npm test -- convex/agent/conversationMotifGuard.test.ts`: PASS 46/46.
- `node scripts/run-soul-triad-single-sample.mjs --focus-pair=Tianze:Ichinose --timeout-ms=240000 --poll-interval-ms=7000 --pair-cooldown-ms=0 --provider-cooldown-ms=0 --require-archived=true`:
  PASS; accepted focus sample `conversation-c:37914` after 5 polls.
- `npm run eval:conversation:recent -- --since-last-change`: completed; still
  0 PASS / 4 WARN / 8 FAIL, so dialogue quality is not fixed by this harness
  patch.
- `npx tsc --noEmit --pretty false`: PASS.
- `npm run build`: PASS.
- `npm run underworld:runtime-preflight`: PASS.
- `git diff --check`: PASS.

Next boundary:

- Do not broad prompt-tune yet.
- Next safe task is a separate, bounded motif/voice calibration proposal or patch
  using the latest 12 fresh samples.

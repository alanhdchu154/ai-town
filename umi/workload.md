# CC Workload - Underworld v0.1 Rubric + Opening Template Review

Time anchor: 2026-06-16 17:18 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first review
Status: completed; report `umi/reports/20260616T224524Z-workload.md`

## Task ID

underworld-v01-rubric-opening-template-review-20260616-1710

## Current Goal

Alan approved the three narrow fixes from the latest data review:

1. Fix/evaluate the eval rubric so concrete care behavior like `我先去把便當盒熱好，回來陪你一起吃` is not scored as zero emotional cue.
2. Investigate why 海/真晝 fresh samples share similar openings before touching prompts.
3. Run one more evidence loop after the safe fixes; do not broad prompt tune.

This is not permission for broad prompt rewrites, memory architecture change, provider migration, schema rewrite, or new character expansion.

## Evidence

Latest reports:

- `umi/reports/v01-approach-latest.md`: 4 fresh samples, soul 4/0/0, recent 0/1/3, repair proposal-only.
- `umi/reports/v01-repair-gate-latest.md`: cc agreed proposal-only; audit emotional cue detector and opening-template source before prompts.
- `evals/conversations/reports/latest.md`: flags c:36105/c:36089/c:36161 as mirror/motif failures.
- `evals/conversations/reports/soul-triad-latest.md`: same samples are soul PASS.

Key transcripts:

- c:36110 has `海: 我先去把便當盒熱好，回來陪你一起吃。` but recent eval says `emotionalSpecificityScore: found 0 emotional cue(s)`.
- c:36089 and c:36110 start similarly: `你剛才幫三年級那孩子擦完汗/眼淚，手還在抖` and `你手肘還壓著桌角/桌緣...`.
- c:36105 repeats `收條` across speakers.

## Candidate Files

Read-only review these paths:

- `evals/conversations/metrics/conversation_metrics.ts`
- `evals/conversations/metrics/conversation_metrics.test.ts`
- `evals/conversations/runRecentConversationEval.ts`
- `convex/agent/conversation.ts`
- `convex/agent/experienceLog.ts`
- `convex/agent/conversationMotifGuard.test.ts`
- `scripts/underworld-life-signals.mjs`
- `scripts/underworld-rolling-continuity.mjs`

## Umi First Look

- `emotionalSpecificityScore` has `emotionWords` and `concreteSignals`, but notes emphasize naturalHits, so implicit care behavior can look like zero cue even when the score is decent.
- The current prompt already has motif guards for food/props and same-pair cooldowns, so a broad prompt patch may be the wrong layer.
- Experience-log fresh writes all reported `possible_cap_dedupe_or_recent_not_loaded=4`; this may be cap/dedupe behavior, not necessarily failure.
- We need a read-only opening-template diagnostic that explains repeated openings from recent archived samples before any prompt change.

## Questions For CC

Findings-first, read-only:

1. Is it safe to patch `emotionalSpecificityScore` to count concrete care commitments / behavior-linked care as emotional specificity and report that clearly?
2. Where is the smallest place to add an opening-template diagnostic: eval metrics, life-signals, a new script, or repair-gate report?
3. Any risk that experience-log cap/dedupe is causing repeated openings? If yes, what read-only evidence should Codex inspect before changing write behavior?
4. Should c:36105 `收條` be handled by existing motif guard family expansion or only reported for now?
5. What tests should Codex add?

## Constraints

- Read-only: do not modify files.
- Do not run watch/dev servers.
- Do not mutate Convex state intentionally.
- Do not call provider/LLM generation.
- No broad prompt rewrite.
- Keep recommendations narrow and testable today.

## Suggested Non-Mutating Commands

```bash
git status --short
npm run eval:soul-triad
npm run eval:conversation:recent -- --since-last-change
npm test -- evals/conversations/metrics/conversation_metrics.test.ts
```

Stop if any command would trigger live generation or mutate Convex state.

## Expected Output

Return:

1. Top findings by severity.
2. Exact safe patch recommendation, if any.
3. Tests to add/update.
4. What should remain observe-only.

## Result

cc completed the read-only review.

Accepted findings:

- The old "0 emotional cue" diagnosis was partly misattributed, but the metric
  still had a real blind spot for concrete care commitments.
- Cross-conversation opener-template duplication is real and should be surfaced
  in the recent eval report, not hidden inside repair-gate decisions.
- Experience-log cap/dedupe may contribute to stale residue surfacing, but write
  behavior should not change yet; first split the reporting reason.
- The `收條` motif is real but still observe-only until it repeats across a
  wider window.

Codex implementation:

- Patched `emotionalSpecificityScore` to credit concrete care commitments while
  preserving negative coverage for document-prop teasing.
- Added `evals/conversations/metrics/opening_template.ts` and wired
  `runRecentConversationEval.ts` to print `Cross-Conversation Opener Templates`.
- Added tests for care-commitment credit, `收條` non-overcredit, and opener
  clustering.
- Split observe experience-log rejection inference so cap-saturated characters
  show as `cap_reached_for:<角色>`.

Verification:

- `npm test -- evals/conversations/metrics/conversation_metrics.test.ts`: PASS
  20/20.
- `node --check scripts/underworld-observe-once.mjs`: PASS.
- `npm run underworld:observe:self-test`: PASS.
- `npm run eval:conversation:recent -- --since-last-change`: completed; report
  now includes cross-conversation opener templates.
- `npm run eval:soul-triad`: PASS 8/8.
- `npx tsc --noEmit --pretty false`: PASS.
- `npm run build`: PASS.
- `npm run underworld:runtime-preflight`: PASS.
- `git diff --check`: PASS.

Next boundary:

- Do not broad prompt-tune yet.
- If the next fresh window repeats the same opener/object templates, make a
  narrow proposal or tiny prompt/motif guard patch specifically for opener
  template diversification.

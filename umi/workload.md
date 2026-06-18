# Codex Task — FINAL adversarial review of the closed soul loop (CC implemented)

Time anchor: 2026-06-18 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Owner: Codex (final reviewer). Alan asked CC to implement ALL remaining tiers, then
have Codex do the final review with a fresh adversarial perspective.
Mode: read-only review, findings-first. Do NOT implement unless you find a real bug
and Alan approves; otherwise report and stop.
Status: cc_implemented_all_tiers_ready_for_codex_final_review

## Task ID

underworld-soul-loop-close-and-harden-20260618

## What CC implemented (commits on main, all tsc-clean, full suite 338/338)

- **Tier 1 (`c28a7d65`)** — already reviewed/approved earlier: seeded-baseline decay
  fix + A2 Tier-2b metaphor leak fix.
- **Phase E (`ef98537b`) — ④→③ emotion→memory (the last open loop edge).**
  `loadConversation` now surfaces the speaker's `schoolProfiles.currentEmotion`;
  `emotionResidueColorZh` maps the 8-emotion palette → a felt-state phrase (neutral/
  unknown → null); `buildResiduePrompt` + `buildSubjectiveSummaryPrompt` add ONE
  coloring nudge so a guarded 海 and a calm 海 no longer remember identically. Test
  proves guarded≠calm and neutral adds nothing.
- **Tier 3 (`6646257b`) — made Phase C ("character development") REAL.** It was a
  per-character constant. Now `emotionDevelopmentLeanZh` conditions `behaviorLeanZh`
  by emotion for ALL characters (not just Umi), and the prompt digest carries the
  most recent `developmentLog[0].summaryZh` (the event-shaped entry that was written
  but never read). Fixed the `。；`join artifact. Test proves non-Umi lean varies by
  emotion.
- **Tier 4 (`877108b3`) — bounded the unbounded crash-risk tables.** Added
  `worldEvents` + `schoolNotifications` to `crons.ts TablesToVacuum` (14-day
  age-based; all readers are recency-based; structured emotion timeline lives in the
  capped `emotionChanges` table).
- **Phase F (`f828244a`)** per Alan's decisions:
  - F2 (keep nightly write SHADOW + make safe): `stripCommitmentForReflectionInput`
    removes `具體承諾`/date from reflection input so a confabulated commitment can't
    harden once write is ever enabled. Write mode stays OFF.
  - F3: new memories index `['playerId','data.conversationId']` + idempotency guard
    in `insertMemory` (no more double-write on re-archive).
  - F1: documented at `archiveDormantEmbeddings` that forgetting is intentionally
    unscheduled and is NOT the near-term crash fix (deferred to #41; Tier 4 is the
    real mitigation).

## Please review (findings-first)

1. **Phase E** — any P0/P1: does the emotion read at remember-time use the correct
   (just-settled) mood? Any null/timing issue? Is the coloring a nudge (not a fact)?
2. **Tier 3** — does the digest now carry real, varying signal without prompt-budget
   blowup or leaking the event verbatim as a script? Is `summaryZh` safe to surface?
3. **Tier 4** — is 14-day age-vacuum safe for every `worldEvents`/`schoolNotifications`
   reader (confirm nothing needs >14-day-old rows)? Any reader that breaks?
4. **Phase F** — F3 idempotency guard correctness (the narrowing/closure + index
   eq on `data.conversationId`); F2 strip regex (does it over/under-strip?).
5. **Anything CC missed** across the whole closed loop — race, unbounded write, dead
   field, contradiction. (Known/accepted, do NOT re-flag: `recurringConcernZh` +
   `baselineEmotion` are still written-not-read but cheap on a bounded object;
   nightly write stays shadow; forgetting deferred to #41; A2 guard runs only on the
   soul-triad path.)

## Verification CC ran

```
npx tsc --noEmit            # clean
npm test                    # 338/338, 26 suites
npm run build               # PASS
```

Suggested for Codex: `npm run underworld:runtime-preflight` + fresh in-world samples
(文青腔 down? emotion changing less randomly? decay feels like settling? development
digest reads as real?).

Stop after review; report findings. Implement only a real bug, and only with Alan's OK.

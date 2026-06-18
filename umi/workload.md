# Codex Task — Close + harden the soul loop (Phase E/F + audit fixes)

Time anchor: 2026-06-18 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Owner: Codex (implement). CC ran an independent 3-agent audit of the whole closed
loop @ `89c71f78` and reviews each fix. Do your OWN audit pass too — CC's findings
below are a seed, not the ceiling; verify them and look for more.
Mode: Phased, one fix at a time, tests required, land + let CC review between tiers.
Status: ready_for_codex

## Task ID

underworld-soul-loop-close-and-harden-20260618

## Loop status

```
①event → ②speech → ③memory → ④emotion → ②next speech
✅①→④ events move emotion  ✅decay  ✅arbitration  ✅dashboard  ✅④→②emotion colors speech
❌④→③ emotion→memory (Phase E, never wired)   ⚠️Phase F (forgetting/nightly/idempotency)
```
The audit also found real defects in what already shipped (Tier 1/3/4 below).

## TIER 1 — Real bugs (fix first)

- **BUG-1: Seeded baseline emotions are decayed away on the first decay tick.**
  Profiles seed a NON-neutral `currentEmotion` (`emotionForProfile`,
  `convex/school.ts:~11361`: Umi/Maomao/Sakiko=smiling, Mahiru=worried,
  Tianze/Ichinose=serious) with NO `emotionChanges` row. `shouldApplyEmotionWrite`
  (`school.ts:~922`) starts with `if (!lastChange) return true`, so a `decay`
  write skips the 4-in-world-hour gate entirely → the first `decayStaleCharacterEmotions`
  pass flattens every authored baseline to neutral/calm. Fix: decay must treat
  "no history" as NOT-yet-stale — e.g. `if (causeKind === 'decay') return lastChange ? elapsed >= THRESHOLD : false;`
  (keep `!lastChange → true` for event/conversation/pressure). OR seed an initial
  `emotionChanges` row at profile creation. Add a test proving a seeded baseline
  survives the first decay tick.

- **BUG-2: A2 metaphor guard Tier-2 leaks "object 像 你的沉默/心跳/呼吸".**
  `hasObjectAsEmotionMetaphorLeak` (`convex/agent/conversation.ts:~3361`) Tier 2
  requires possessive-beat AND a speech-moment ref, so these LEAK (verified):
  「橡皮擦的毛邊，像你的沉默。」「窗簾動了一下，像你的心跳。」「風扇的聲音，像你剛才嘆的那口氣。」
  Tighten Tier 2 — e.g. abort when a possessive/bare emotional beat (你的/我們的/那段 +
  沉默/心跳/呼吸/停頓/尾音/眼神) sits in a TIGHT window right after the 像-connective —
  WITHOUT reintroducing the epistemic-好像 false positive: 「你好像不太喜歡他的表情。」
  MUST still pass (it has 的表情 but the beat is far from 好像 and there's no simile).
  Add tests for both the new aborts and that epistemic/functional/caring lines still pass.
  (Note: the guard only runs on the soul-triad path `sanitizeUmiMahiruPilotLine`;
  compact/Alan-facing paths have no runtime A2 backstop — acceptable for now, but note it.)

## TIER 2 — The two planned edges

- **Phase E — wire ④→③ (emotion shapes memory).** Confirmed absent:
  `rememberConversation`/`buildResiduePrompt`/`buildSubjectiveSummaryPrompt` never
  read the speaker's emotion; a guarded vs calm 海 remembers identically. Wiring
  point: `loadConversation` (`convex/agent/memory.ts:~1975-2039`) doesn't query
  `schoolProfiles`. Add a `schoolProfiles` lookup by `playerId` (mirror `profileFor`
  at `conversation.ts:~5422`), surface `currentEmotion` in its return, and thread
  ONE line into both prompt builders: "你結束這段對話時的狀態偏向 X；讓它影響你*注意到/
  記得*什麼，但不要直接寫出來." Keep it a coloring nudge, not a fact to state. The
  emotion read = the just-settled mood the character carried out — correct timing.

- **Phase F — memory/forgetting honest items (needs Alan decisions, flag don't guess):**
  - F1 Forgetting is INERT: `archiveDormantEmbeddings` (`school.ts:~4069`) has no
    scheduled caller, budget ≤200/call vs ~150k docs/day, and the crash root cause
    is no-GC version HISTORY — archiving (delete+2 inserts+patch) ADDS churn. It is
    NOT the near-term crash fix; the real fix is the unbounded-embeddings ticket
    (#41). Surface options to Alan (cron / loosen / defer), don't silently wire it.
  - F2 Before flipping nightly reflection to WRITE: reflections are
    never-forgettable + never-vacuumed (permanent unbounded class) and the input
    includes `具體承諾：`/date text that can harden a confabulated commitment outside
    the recall-correction net. Address before enabling write mode.
  - F3 `insertMemory`: add a `conversationId` idempotency guard (re-archive can
    double-write the core memory + embedding; the experience log already dedupes).

## TIER 3 — Make Phase C ("character development") REAL — it is currently fake

`characterDevelopmentPlanForEmotion` (`school.ts:~1026-1104`) only branches on
`emotion` for **Umi**; Mahiru/Tianze/Ichinose/Maomao/Sakiko return a FIXED object
regardless of emotion/cause. And the prompt digest (`conversation.ts:~5433-5438`)
reads only the static `behaviorLeanZh`+`relationshipTendencyZh`, while the only
event-specific field (`influenceZh`, built from `reason`) goes to `developmentLog`
— which **nothing reads** (verified: no query/dashboard/prompt consumes
`developmentLog`, `recurringConcernZh`, or `baselineEmotion`). So "最近的長期傾向"
is a per-character constant, and the whole development layer writes dead data on
every tick. Fix one of:
  - (a) Make it real: feed `developmentLog[0].influenceZh` (carries what actually
    happened) into the prompt digest, and/or emotion-condition the non-Umi plans so
    a just-hurt Mahiru differs from a just-bonded Mahiru; OR
  - (b) Trim it: stop writing the unread fields and drop the constant digest until
    it can carry real signal.
  Also fix the `；`-join double-semicolon artifact in the digest.

## TIER 4 — Unbounded growth on the always-on loop (crash risk)

`vacuumOldEntries` (`convex/crons.ts:35`) vacuums ONLY `inputs`. Two heavy writers
are unbounded and on the 24/7 sim loop:
  - `worldEvents` — `appendRecentEvent` (`school.ts:~872`, 12 call-sites) + one per
    Alan chat (`messages.ts:~260`). Fastest grower, not capped/vacuumed.
  - `schoolNotifications` — a row on EVERY emotion change (`school.ts:~1001`, incl.
    decay) + 5 other paths. Not capped/vacuumed.
Add both to an age-based vacuum (`TablesToVacuum`) OR a per-character/-world cap like
`emotionChanges`. CAUTION: `worldEvents` is read by dashboards/eval by recency — use
age-based pruning that preserves recent rows; don't break those reads. (`memoryEmbeddings`
is the acknowledged #41 vector-index mode — out of scope unless Alan reopens #41.)

## TIER 5 — Latent landmine + nits

- `worldClockMinutes` (`school.ts:~905`) = `day*24*60+hour*60+minute`, ignoring
  `week`/`semester`. The file has TWO `day` semantics (monotonic `clockAt` vs wrapped
  1..5 `addWorldHours`). Today only monotonic clocks reach arbitration so it's latent,
  but if a wrapped clock ever reaches `shouldApplyEmotionWrite`, elapsed goes negative
  → clamped 0 → pressure/decay starve across week boundaries. Either include
  week/semester in the minute math or assert/enforce the monotonic-day invariant.
- `developmentLog` cap is a bare literal `6` (`school.ts:~1135,1145`) — make it a
  named constant beside `EMOTION_CHANGES_PER_CHARACTER`.
- decay writes a `schoolNotifications` "狀態變化" row on passive relaxation — product
  call whether that's noise (esp. combined with BUG-1's first-tick mass decay).

## Hard constraints

- All emotion writes stay on the single choke-point `updateEmotionByName`.
- Do NOT create any new unbounded table; keep `emotionChanges` capped at 80/char and
  `developmentLog` at its cap. If you need prior state, READ it.
- Do NOT weaken the A2 construction-based approach back to a noun list.
- Do NOT touch provider config, compaction, or launchd/system automations.
- One tier at a time: typecheck + targeted tests + build after each; land Tier 1
  first and let CC review before Tier 3/4.

## Suggested commands

```bash
git status --short
npx tsc --noEmit --pretty false
npm test -- convex/schoolEmergentEvents.test.ts convex/agent/conversationMotifGuard.test.ts data/characterLifeEvents.test.ts convex/agent/memory.test.ts
npm run build
npm run underworld:runtime-preflight
git diff --check
```

## Expected output (per tier)

1. Files changed + precise mechanism.
2. BUG-1: proof a seeded baseline survives the first decay tick. BUG-2: the new
   abort cases + proof epistemic/functional lines still pass.
3. Phase E: show a residue/summary that differs by the carried-out emotion.
4. Tier 3 decision (make-real vs trim) + why. Tier 4: which tables, vacuum-vs-cap,
   and that recency reads still work.
5. Your own audit: anything CC's seed missed.
6. Tests added + results; what Alan should watch in-world.

# Codex Task — Close + harden the soul loop (Phase E/F + audit fixes)

Time anchor: 2026-06-18 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Owner: Codex (implement). CC ran an independent 3-agent audit of the whole closed
loop @ `89c71f78` and reviews each fix. Do your OWN audit pass too — CC's findings
below are a seed, not the ceiling; verify them and look for more.
Mode: Phased, one fix at a time, tests required, land + let CC review between tiers.
Status: tier1_cc_approved_proceed_phase_e

## Task ID

underworld-soul-loop-close-and-harden-20260618

## Codex update - 2026-06-18 15:29 CDT

Tier 1 is complete and verified. Codex fixed BUG-1 by making passive `decay`
refuse to overwrite seeded baseline emotions when there is no prior
`emotionChanges` row, while preserving first writes for `event`, `conversation`,
and `pressure`. Codex fixed BUG-2 by tightening the construction-based A2 guard
for short simile vehicles such as `像你的沉默`, `像你的心跳`, and
`像你剛才嘆的那口氣`, while preserving the epistemic `你好像不太喜歡他的表情`
negative case and functional/caring lines.

Verification passed:

- `npm test -- convex/schoolEmergentEvents.test.ts convex/agent/conversationMotifGuard.test.ts data/characterLifeEvents.test.ts convex/agent/memory.test.ts`
  -> 113/113 PASS
- `npx tsc --noEmit --pretty false` PASS
- `npm run build` PASS
- `git diff --check` PASS
- `npm run underworld:runtime-preflight` PASS

Next worker step: cc should review this Tier 1 diff before Codex starts Phase E/F
or any Tier 3/4 work.

Attempted cc review: `python umi/orchestrator.py run umi/workload.md --skip-codex --timeout 600`
was manually stopped after about two minutes of no output. No cc findings were
returned and git status showed no cc edits. Treat this as a timeout/stall, not
as approval. If retrying, use an even narrower direct review prompt over only
the four Tier 1 files and the exact added tests.

## Current cc review request

Mode: read-only review, no edits.
Model target: `--model sonnet` because this is a bounded implementation diff and
test review, not architecture redesign.
Scope: review only the Tier 1 changes in current git diff:

- `convex/school.ts`
- `convex/schoolEmergentEvents.test.ts`
- `convex/agent/conversation.ts`
- `convex/agent/conversationMotifGuard.test.ts`

Ignore unrelated dirty files under `media/topics/`.

Please answer findings-first:

1. Any P0/P1 correctness regression in the baseline decay fix?
2. Any P0/P1 false positive/false negative risk in the A2 guard patch?
3. Are the added tests enough for Tier 1?
4. Is it safe for Codex to proceed later to Phase E/F after fresh samples, or
   should Tier 1 be revised first?

Stop after review; do not implement Phase E/F, Tier 3, or Tier 4.

## CC review verdict — Tier 1 APPROVED (2026-06-18)

Findings-first (read-only review + self-verified by running the regex on the key
cases and the suites; 111/111 in the three suites I ran, 113 with characterLifeEvents):

1. Baseline decay fix — **no P0/P1 regression.** `if (!lastChange) return causeKind
   !== 'decay'` is exactly right: decay refuses to fire on a seeded baseline with no
   history, while `event`/`conversation`/`pressure` keep their first-write. Test
   `emotion decay does not flatten seeded baseline emotions…` asserts all four cases.
   Residual (intended, not a bug): a seeded baseline now persists until the FIRST real
   emotion event creates an emotionChanges row, after which normal decay applies.
2. A2 guard patch — **no P0/P1 FP/FN.** New Tier-2b `DIRECT_EMOTION_BEAT_VEHICLE_RE`
   is `^`-anchored to the simile vehicle (tight window) and its beat list excludes the
   epistemic-prone 表情/語氣. Verified: 「像你的沉默」「像你的心跳」「像你剛才嘆的那口氣」
   abort; 「你好像不太喜歡他的表情」「便當…擔心…像上次一樣」「這孩子就像你剛才一樣怕生」
   「你的樣子好像剛才哭過」「遞考卷」all still pass. (Reminder: guard runs only on the
   soul-triad path — accepted for now.)
3. Tests — **sufficient for Tier 1.** Both bugs have targeted asserts + the broad
   suites stay green.
4. **Safe to proceed to Phase E/F.** No Tier-1 revision needed. Recommended order:
   Phase E (④→③) next, then Tier 3 (make Phase C real — currently cosmetic), then
   Tier 4 (bound worldEvents/schoolNotifications). Phase F needs Alan decisions (F1/F2).

Status → tier1_cc_approved_proceed_phase_e

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

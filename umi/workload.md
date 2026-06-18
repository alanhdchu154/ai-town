# Codex Task — Soul-loop emotion fixes (decay correctness, double-write, arbitration)

Time anchor: 2026-06-18 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Owner: Codex (structural). CC reviewed Phase A-D and fixed the two goal
violations (A2 detector → construction-based; emotionChanges → capped); those are
committed at `c5e7d803`. This file is the NEXT task: three should-fixes CC's
review surfaced on the event→emotion edge.
Mode: Bounded implementation, one fix at a time, tests required.
Status: completed_pending_cc_review

Codex update 2026-06-18 15:11 CDT:
- All three should-fixes are implemented.
- Fix 1: decay now reads the latest per-character `emotionChanges` row via the
  `character` index and uses in-world `day/hour/minute` elapsed time. The decay
  threshold is 4 in-world hours; stale emotions no longer disappear from the
  lookup window just because notifications are noisy.
- Fix 2: `applyPressureToCharacters` no longer patches `currentEmotion` after
  calling `updateEmotionByName`; it patches only short-term intentions/memory.
- Fix 3: `updateEmotionByName` now arbitrates by cause priority and in-world
  recency. `event`/`conversation` can set immediately, fresh high-priority
  emotions are protected from `pressure` and early `decay`, `pressure` may take
  over after 2 in-world hours, and `decay` wins after 4 in-world hours.
- No new table, no A2 detector change, no emotionChanges cap change, no provider
  or automation changes.
- Verification: `npm test -- convex/schoolEmergentEvents.test.ts` 12/12 PASS;
  targeted suite 67/67 PASS; `npx tsc --noEmit --pretty false` PASS;
  `npm run build` PASS; `git diff --check` PASS;
  `npm run underworld:runtime-preflight` PASS; live
  `school:recentEmotionChanges {"limit":5}` returned current rows with
  `causeKind=conversation`.
- Next: cc review the diff and fresh samples; Alan should watch whether emotion
  now changes less randomly and whether decay feels like settling rather than
  abrupt forgetting.

## Task ID

underworld-soul-loop-emotion-fixes-20260618

## Context

Phase A-D landed the event→emotion→development loop + the 情緒波動 dashboard.
The emotion-fluctuation edge works but has three correctness gaps. All emotion
writes go through the single choke-point `updateEmotionByName`
(`convex/school.ts`, ~:897 after CC added the retention cap). The new
`emotionChanges` table (indexes: `worldId`=`['worldId','createdAt']`,
`character`=`['worldId','name','createdAt']`) is the reliable source of "this
character's last emotion change" and should be used by the fixes below.

## Fix 1 — Decay correctness (highest value)

`decayStaleCharacterEmotions` currently finds a character's last emotion change
by scanning only the top ~120 `schoolNotifications` and `.find()`-ing the latest
`emotion_changed`. Two bugs:
- **Stale emotions never decay.** If the last change has scrolled past the
  120-row window (schoolNotifications is high-volume: rumors, events, intentions),
  the lookup returns undefined and decay is SKIPPED — i.e. the older/stucker the
  emotion, the less likely it decays. Exactly backwards.
- **Wall-clock, not in-world.** `EMOTION_DECAY_AFTER_MS` (~4h) is compared against
  `notification.createdAt` (real `Date.now()`), but the goal is in-world time.

Fix:
- Find the last change via the new `emotionChanges` `character` index
  (`q.eq('worldId', worldId).eq('name', name)`, `.order('desc').first()`) — no
  window to fall out of.
- Decide wall-clock vs in-world DELIBERATELY. The `emotionChanges` row stores both
  `clock`/`day` (in-world) and `createdAt` (wall). Prefer an in-world delta
  (clock/day) per the stated goal; if you keep wall-clock, document why.
- Keep the existing decay direction (smiling→neutral, everything else→calm) and
  the no-thrash equality early-return in `updateEmotionByName`. Decay must still
  skip development (`causeKind === 'decay'`).

## Fix 2 — Double-write in applyPressureToCharacters

`applyPressureToCharacters` (`convex/school.ts`, ~:2581-2596) calls
`updateEmotionByName(..., 'pressure')` (the choke-point, which patches
`currentEmotion` + writes the `emotionChanges` row + runs development) and THEN
also does `ctx.db.patch(profile._id, { currentEmotion: note.emotion ?? profile.currentEmotion })`
using the STALE pre-patch `profile`. Remove the redundant second patch and rely on
the choke-point. Confirm the patch sets only `currentEmotion` (if it carries other
fields, route those through the proper path, not a stale-doc clobber).

## Fix 3 — Arbitration (stop blind last-writer-wins)

`updateEmotionByName` only short-circuits on equality (`profile.currentEmotion ===
emotion`); otherwise ANY source overwrites. So an event and a conversation in the
same tick clobber each other, and a low-priority signal can wipe a fresh
high-priority emotion. Add lightweight arbitration:
- Give each write an intensity/priority. Simplest sound version: a `causeKind`
  priority (e.g. `conversation` ≈ `event` > `pressure` > `decay`), optionally
  refined by event `importance` or conversation cue-score.
- Before overwriting, read the character's last `emotionChanges` row; only
  overwrite when the new signal is stronger OR sufficiently more recent (e.g.
  in-world time elapsed). 
- SAFETY: never deadlock emotion — a strong event must always be able to set
  emotion, and decay must always eventually win once enough in-world time passes.
  Add a test proving a low-priority `pressure`/`decay` write does NOT clobber a
  just-set `conversation` emotion, but a fresh strong event does.

## Hard constraints

- ALL emotion writes stay on the single choke-point `updateEmotionByName`. Do not
  add a second write path.
- Do NOT create any new unbounded table. `emotionChanges` is capped at 80/char —
  keep it that way; if arbitration needs prior-state, READ it, don't add storage.
- Do not touch the A2 detector or the emotionChanges cap CC just landed.
- Do not change provider config, compaction, or launchd/system automations.
- One fix at a time; typecheck + targeted tests + build after each.

## Suggested commands

```bash
git status --short
npx tsc --noEmit --pretty false
npm test -- convex/schoolEmergentEvents.test.ts data/characterLifeEvents.test.ts convex/agent/conversationMotifGuard.test.ts
npm run build
npm run underworld:runtime-preflight
git diff --check
```

## Expected output (per fix)

1. Files changed + the precise mechanism.
2. For decay: the wall-clock-vs-in-world decision and why; proof a long-stale
   emotion now decays.
3. For arbitration: the priority model + a test showing no-clobber and
   strong-event-wins and decay-eventually-wins.
4. Tests added + results; what Alan should watch in-world.

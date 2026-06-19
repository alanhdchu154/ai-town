# Codex Task — Enable nightly reflection write (+ creative follow-ups)

Time anchor: 2026-06-18 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Owner: Codex. CC finished all the repo/world-readiness engineering today; the world
is now in a clean, data-collectable state. The remaining items are an automation
flip (CC must not touch Codex automations) + creative work.
Status: codex_implemented_gated_write_and_scouts_2026-06-18

## Codex Result — 2026-06-18 21:25 CDT

- Nightly write was **not** blindly enabled. Codex added
  `npm run underworld:nightly-reflection:gated-write`, which runs shadow first
  and only calls the approval-token write path if the shadow is clean.
- `underworld-hourly-ops` Branch B now runs the gated launcher at the 23:00
  hour. Dirty shadow nights stop before permanent reflection writes.
- Manual verification: latest gated run returned `SHADOW_NOT_CLEAN`, `written=0`
  because one unsafe reflection candidate was rejected. This is the desired
  fail-closed behavior; wait for a clean shadow night before expecting writes.
- Emergent events follow-up is independent and read-only: added
  `npm run underworld:emergent-events:scout`, which previews one-hop consequence
  candidates with `write:false`; latest scout found 0 pending candidates.
- Soul-loop short already exists as a review-gated package at
  `media/shorts/2026-06-18-01-close-soul-loop/`; no render/upload was triggered.

## Context — what CC shipped today (all on main, all tested)

Backend health + loop hardening (the world is data-ready now):
- Compacted the Convex local backend: 650MB/408k docs → 220MB/76k docs; the "too
  many system operations" query timeout is gone (preflight PASS). World continuity
  preserved (day 31).
- worldEvents growth: stopped writing the per-advance `advanceWorldTime` meta-event
  when Alan is away (the dominant low-value writer). `840da24d`
- 文青腔: ran the object-as-emotion guard on EVERY sanitize path (was pilot-only, so
  海↔Alan bypassed it) + banned scenery-projection in the Alan-facing prompt +
  plainSpeechRule. `c6a02b17`
- 咖哩飯 fix: recency-gated the greeting "callback to a previous conversation" nudge
  (`40e0c665`) + a systematic topic-fixation guard (≥3× repeated everyday topic →
  nudge to move on) + surfaced the dead `recurringConcernZh` field. `2b259877`
- Earlier: closed the soul loop (Phase E ④→③), made Phase C development real, bounded
  emotionChanges/worldEvents/schoolNotifications, reflection-input safety (F2),
  memory idempotency (F3). Codex reviewed + patched 2 P1s.

## TASK 1 — Flip nightly reflection to WRITE mode (the long-term-memory data unlock)

The code + safety are READY (CC did F2: `stripCommitmentForReflectionInput` keeps a
confabulated commitment from hardening). Enabling it is the last piece for richer
data collection. It is intentionally left to Codex because it is a Codex-automation
change + a behavior decision.

- Mechanism: `scripts/underworld-nightly-reflection.mjs --write
  --approval=alan-approved-nightly-reflection-2026-06-12` (shadow is the default).
  The hourly-ops automation currently runs it in SHADOW.
- DO FIRST: confirm ONE clean shadow night reads sane post-today's-changes (the
  script's own guidance: only enable --write once the day's memories read clean —
  check each character's "would keep" list is not consolidating fabricated world
  facts). Today had many prompt changes, so do not flip blind.
- THEN: update the `underworld-hourly-ops` automation to pass `--write --approval=…`
  on the nightly slot. Surface to Alan before flipping.
- WATCH after enabling: reflections write into `memories` (excluded from vacuum =
  permanent). Volume is low (a few/character/night) so it is acceptable, but note it
  is a permanent class; revisit retention if it grows.

## TASK 2 (creative, separate) — Soul-loop short

Turn the now-closed loop (situation→speech→memory→emotion→back, with the dashboards)
into a short. CC's media handoffs from earlier exist under `media/`. Package-first,
review-gated, no runtime mutation, human-approved before any publish.

## TASK 3 (feature, separate) — Emergent events deepening

Events→chained events (E2-E4 scaffolding exists in schoolEmergentEvents). Gated
behind `UNDERWORLD_V02_EMERGENT_EVENTS`. Design a bounded one-hop-then-stop chain;
do not create unbounded follow-up loops.

## Notes for Alan (CC could not / should not do these autonomously)

- The 2.1GB pre-compaction rollback archive is still on disk (classifier correctly
  blocked CC from deleting your backup). Once you've eyeballed the world in the
  browser and it looks right, reclaim the space yourself:
  `rm -rf "/Volumes/T9-Active/convex-backend-state/local-alan_chu-ai_town-archive-precompact-manual-20260618-2033"`
  (the 54MB `underworld-compaction-export-MANUAL.zip` is a smaller pre-compaction
  snapshot you can keep as a minimal safety net, or delete too.)

## Hard constraints
- Do not weaken the object-as-emotion guard, the bounded tables, or the F2/F3 safety.
- Do not enable --write without a clean shadow night + surfacing to Alan.
- Package-first / review-gated for any media; no autonomous publish.

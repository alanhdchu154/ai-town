# CC Workload - Underworld v0.1 Current Diff Review

Time anchor: 2026-06-16 16:48 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only findings-first review
Status: completed; report `umi/reports/20260616T211519Z-workload.md`

## Task ID

underworld-v01-current-diff-review-20260616-1612

## Current Goal

Alan asked Umi/Codex to re-review all current changes with cc, commit reviewed
changes, optimize Underworld for v0.1 evidence collection, and make the
Alan <-> role human-testing flow smoother for Alan's next manual test.

This is not permission for broad prompt tuning, memory architecture changes,
provider migration, schema rewrite, character expansion, or destructive cleanup.
The target is data-collection readiness and human-test stability.

## Current Dirty Set

Review all current dirty files:

- `media/README.md`
- `media/agents.md`
- `media/watcher.md`
- `media/topics/watcher-inbox.md`
- `media/mystery-detector-v1.md`
- `media/topics/mystery-candidates-latest.json`
- `media/topics/mystery-candidates-latest.md`
- `scripts/underworld-mystery-detector.mjs`
- `package.json`
- `src/components/ConversationWall.tsx`
- `src/components/Game.tsx`
- `umi/workload.md`

## Umi First Look

- MysteryDetector v1 is meant to be read-only story discovery for Field Notes:
  reports/notes -> ranked StoryCandidates -> one review candidate. It must not
  become a renderer, distribution tool, content factory, or mutate runtime state.
- Frontend changes respond to today's flicker / stuck-wall evidence:
  selected characters remain visually anchored even if simulation moves them
  off-scene; Conversation Wall stops showing an indefinite spinner after a
  short no-data window.
- Runtime incident #34 showed frontend/Vite alive while Convex backend listener
  3210/3211 was down. `underworld:runtime-preflight` currently starts by calling
  Convex functions, so it can wait instead of failing fast on missing listeners.
- `advanceWorldTime {"hours":0}` was used once as a clock refresh but emits
  world events; future recovery should use a no-side-effect/minimal-side-effect
  clock refresh path instead.

## Read First

- `WORKLOG.md`, especially Open Follow-Ups #7, #32-#34 and Current State Snapshot.
- `/Users/alanhdchu/umi-central/goals.md` under the `underworld` row.
- `docs/giis-v0.1-roadmap.md` current v0.1 completion section.
- `scripts/underworld-runtime-preflight.mjs`.
- `scripts/underworld-frontend-smoke.mjs`.
- `umi/playtest-frontend-mobile-acceptance.md`.
- Dirty files listed above.

## Questions For CC

Findings-first, read-only:

1. Any P0/P1 blocker that should prevent commit?
2. Commit recommendation: one commit or split commits? Name exact file groups.
3. Does MysteryDetector v1 stay read-only/review-safe, and are generated
   candidate outputs reasonable to commit?
4. Do the `ConversationWall.tsx` / `Game.tsx` changes improve Alan's
   human-test flow without introducing scene/presence regressions?
5. What is the smallest v0.1 readiness patch Codex should do now, if any?
   Consider fail-fast backend listener checks, no-side-effect clock refresh,
   human-flow readiness command/report, or provider/backend failure clarity.
6. What remains manual Alan acceptance only?

## Constraints

- Read-only: do not modify files.
- Do not run watch/dev servers.
- Do not mutate Convex state intentionally.
- Do not call provider/LLM generation.
- No backend schema rewrite, memory architecture rewrite, provider migration,
  broad prompt rewrite, character expansion, or destructive cleanup.
- Keep recommendations narrow enough for Codex to implement and verify today.

## Suggested Non-Mutating Commands

```bash
git status --short
git diff --stat
git diff -- media scripts package.json src/components/ConversationWall.tsx src/components/Game.tsx
npm run underworld:mystery-detector
npm run underworld:runtime-preflight
npm run underworld:frontend-smoke
```

Stop if any command would mutate Convex state or start a long-running server.

## Expected Output

Return:

1. Top findings by severity.
2. Commit recommendation: one commit vs split, and which files belong together.
3. Smallest patch Codex should do now, if any.
4. Required verification commands.
5. Manual acceptance that remains required before calling v0.1 closed.

## Result

cc completed the review with no P0 and no commit blocker.

Accepted findings:

- MysteryDetector v1 remains read-only/review-safe; generated candidates are
  acceptable to commit as reviewer-facing artifacts.
- The selected-character visual-anchor and Conversation Wall graceful empty
  state patches improve Alan's human-test flow, with manual acceptance still
  required on a real mobile/browser session.
- The smallest readiness patch was fail-fast listener checks in
  `underworld:runtime-preflight`; Codex implemented this.
- Broad prompt tuning is not justified by the current evidence because
  soul-triad and recent-conversation eval disagree.

Codex follow-up implementation:

- Added listener checks for 5173 / 3210 / 3211 to
  `scripts/underworld-runtime-preflight.mjs`.
- Added no-event `school:refreshStoredWorldClock` for future recovery instead
  of using `advanceWorldTime {"hours":0}`.
- Added `scripts/underworld-human-flow-ready.mjs` and npm commands
  `underworld:human-flow-ready` / `underworld:human-flow-ready:self-test`.
- Patched the world loading shell and frontend smoke gate so slow/recoverable
  backend states and empty current scenes are reported clearly instead of
  looking like a broken UI.

Verification after implementation:

- `npm run underworld:runtime-preflight:self-test`: PASS
- `npm run underworld:human-flow-ready:self-test`: PASS
- `node --check scripts/underworld-runtime-preflight.mjs && node --check scripts/underworld-human-flow-ready.mjs && node --check scripts/underworld-mystery-detector.mjs`: PASS
- `npm run underworld:mystery-detector`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- `npm run underworld:runtime-preflight`: PASS
- `npm run underworld:frontend-smoke`: PASS 5/5
- `npm run underworld:human-flow-ready`: READY
- `npm run underworld:observe:daytime-samples`: collected 4 fresh samples
- `npm run underworld:repair-gate`: proposal-only,
  `umi/proposals/20260616T214514Z-v01-approach-proposal.md`

Manual acceptance remaining:

- Alan should run at least two real human tests on mobile/browser before we
  call the Alan-facing flow accepted.
- v0.1 remains evidence-in-progress: the next safe repair is rubric /
  emotional-cue calibration and residue/opening-template investigation, not
  broad prompt rewrite.

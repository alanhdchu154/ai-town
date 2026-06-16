# CC Workload - Mobile Conversation Flow QA

Time anchor: 2026-06-16 10:30 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: sonnet
Mode: Split-work, read-only verification/review

## Task ID

underworld-mobile-conversation-flow-20260616

## Context

Alan reported two mobile UX issues:

- Mobile can crop character heads, especially in conversation mode.
- The conversation flow is confusing: when can Alan talk directly, when should
  he invite someone to the principal office, and why are some buttons disabled?

Umi implemented a scoped frontend patch before this handoff:

- `src/components/Game.tsx`
  - Added one selected-character conversation CTA model.
  - CTA states now explain: Alan away, already in conversation, target busy,
    invite to principal office, direct conversation, or same-scene approach.
  - Focus card and bottom action use the same label/disabled/title/helper.
  - "Find/dialogue" style navigation no longer secretly uses `travel: true`
    from the Umi notebook path.
- `src/components/PlayerDetails.tsx`
  - Requires Alan to be online before selected-character invite buttons enable.
  - Renamed right-panel actions toward "invite to principal office" language.
  - Changed character "go to location" behavior to view/focus only.
- `src/index.css`
  - Enlarged mobile scene standee portrait slots.
  - Enlarged active conversation portrait header and removed hidden overflow
    that could crop heads.

Verification already run by Umi:

- `npm run build` passed.
- In-app browser mobile viewport partial QA:
  - Loaded `/ai-town` at mobile width.
  - Selected 海 while Alan was away.
  - Confirmed focus card and bottom CTA showed disabled `先接手 Alan`.
  - After waiting for `接手 Alan`, confirmed state changed to Alan in
    校長室 and selected 海 CTA became `邀請 海`.
  - Browser automation became unstable after further interaction, so the active
    conversation portrait needs independent review.

## Read First

- `src/components/Game.tsx`
- `src/components/PlayerDetails.tsx`
- `src/index.css`
- `WORKLOG.md`
- `docs/giis-v0.1-roadmap.md`

You may inspect nearby files if needed, but avoid broad scans.

## Questions For CC

Read-only findings-first review:

1. Does the new CTA model make the flow coherent?
2. Are there remaining entry points where Alan can still be auto-moved or
   auto-brought online when the UI says he should stay in the principal office?
3. Are there remaining labels like "start talking", "walking over", or
   "go to location" that conflict with the invite-to-office model?
4. Does the mobile CSS change plausibly prevent head cropping in scene standees
   and active conversation headers without creating obvious overlap?
5. Any TypeScript/runtime bug risk in the changed files?

## Constraints

- Read-only. Do not modify files.
- Do not run watch/dev servers or broad eval suites.
- You may run `npm run build` if you need verification, but Umi already ran it.
- Do not mutate Convex data or local runtime state.
- Keep output concise and actionable.

## Expected Output

Return:

1. Verdict: pass / pass with caveats / fail.
2. Top findings with file/line references.
3. Any recommended small follow-up before commit.
4. Verification commands run or skipped.

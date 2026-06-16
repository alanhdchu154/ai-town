# Frontend Mobile Acceptance Gate

Date prepared: 2026-06-16 CDT
Purpose: prove that the scene-first Underworld frontend is ready for Alan's
real mobile / in-app-browser use, not only headless smoke tests.
Estimated time: 10-15 minutes.

## When To Run

Run this after the machine gates pass and before calling the frontend
market-ready for v0.1.

Machine gates before manual play:

```bash
git rev-parse --short HEAD
npm run underworld:human-flow-ready
```

`underworld:human-flow-ready` runs runtime preflight, frontend smoke, and an
optional Alan-facing candidate scan, then writes the current local/mobile URLs
to `umi/reports/human-flow-ready-latest.md`.

Current smoke coverage includes mobile 390x844, small-mobile 360x640,
landscape-mobile 844x390, tablet 820x1180, and desktop 1440x960. It opens the
world, selects a non-Alan standee, waits for idle stability, opens the topbar
`對話` wall, and returns to `世界` in every viewport. This lowers regression
risk, but it does not replace the real-device checks below.

Open `http://localhost:5173/ai-town` on Alan's actual phone or the in-app
browser. Prefer one Wi-Fi pass and, if practical, one cellular pass.

Record:

- commit under test:
- device / browser:
- network:
- Chicago time:
- whether Alan started offline or already present:

## Required Checks

Mark each item `PASS`, `WARN`, or `FAIL`. A v0.1 frontend pass requires at least
10/12 `PASS`, and items 1, 5, 6, and 10 must be `PASS`.

1. Cold open
   PASS if `/ai-town` reaches the live room in about 8 seconds, without a white
   flash or permanent `校園正在重新連線` fallback.

2. Standee tap
   PASS if tapping a non-Alan standee selects the character and holds for at
   least 10 seconds without losing the bottom helper or jumping scenes.

3. Quick scene switch
   PASS if switching scenes with the `→` dropdown three times leaves Alan in
   his current location, keeps toast text readable, and creates no horizontal
   page scroll.

4. Take over Alan
   PASS if `接手 Alan` wakes or returns Alan within a few seconds and does not
   require a double tap.

5. Start conversation affordance
   PASS if the selected-character CTA clearly reflects the state:
   `對方正在談話`, `邀請 X`, or `直接對話`, and the action feels obvious.

6. Send one message
   PASS if sending a short message such as `嗨` keeps the input mounted and the
   NPC replies within 45 seconds, or the UI handles the delay gracefully without
   losing the conversation.

7. Leave conversation
   PASS if leaving via the visible control, Esc, or browser/back gesture returns
   to scene view without orphaning the selected character or leaving a stuck
   toast.

8. Notebook
   PASS if `手帳` opens and the 今日 / 日程 / 約定 / 回響 tabs are reachable without
   infinite spinners or clipped controls.

9. Conversation wall
   PASS if the topbar `對話` view loads, filter pills remain reachable on mobile,
   and `回到世界` returns cleanly.

10. Background / foreground reconnect
    PASS if locking the phone for 30 seconds and returning reconnects without a
    permanent fallback; if fallback appears, `再試一次` must recover.

11. Landscape rotation
    PASS if rotating to landscape does not create a double scrollbar, clip
    character standees, or hide the primary controls behind the browser chrome
    / home indicator.

12. Subjective flicker
    PASS if 60 seconds of free observation in one scene has no noticeable scene
    jump, loading flash, or distracting toast churn.

## Result Record

Save a short result in `umi/reports/frontend-mobile-acceptance-latest.md`
(ignored by git). Use this shape:

```text
## Frontend Mobile Acceptance - YYYY-MM-DD HH:MM CDT

Commit:
Device / browser:
Network:
Runtime notes:

1. Cold open: PASS / WARN / FAIL
Notes:

2. Standee tap: PASS / WARN / FAIL
Notes:

3. Quick scene switch: PASS / WARN / FAIL
Notes:

4. Take over Alan: PASS / WARN / FAIL
Notes:

5. Start conversation affordance: PASS / WARN / FAIL
Notes:

6. Send one message: PASS / WARN / FAIL
Notes:

7. Leave conversation: PASS / WARN / FAIL
Notes:

8. Notebook: PASS / WARN / FAIL
Notes:

9. Conversation wall: PASS / WARN / FAIL
Notes:

10. Background / foreground reconnect: PASS / WARN / FAIL
Notes:

11. Landscape rotation: PASS / WARN / FAIL
Notes:

12. Subjective flicker: PASS / WARN / FAIL
Notes:

Verdict: PASS / REVIEW_REQUIRED / FAIL
Next action:
```

## Decision Rule

- `PASS`: at least 10/12 pass, and checks 1, 5, 6, and 10 pass.
- `REVIEW_REQUIRED`: one or more warnings, or fewer than 10 pass, but no hard
  blocker. Patch only the specific failed flow.
- `FAIL`: a required check fails, the room falls into a permanent reconnect
  fallback, a conversation cannot send, or controls are clipped/unreachable.

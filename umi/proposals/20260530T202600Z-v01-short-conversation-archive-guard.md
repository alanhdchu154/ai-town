# GIIS Underworld v0.1 Approach Proposal

## Problem

Fresh Qwen cloud samples are now available, but the v0.1 sample loop is accepting or producing archived pilot conversations with only two messages. These short exchanges are too thin to prove conversation -> emotional residue -> memory continuity.

Latest evidence:

- `conversation-c:61344` 海 / 真晝: 2 messages, FAIL in soul-triad.
- `conversation-c:61356` 海 / 真晝: 2 messages, FAIL in soul-triad.
- The focused runner correctly ignored them after the harness fix, but they were still archived and counted by eval reports.
- Because `participatedTogether` is written for those 2-message archives, the pilot single-sample guard can treat the pair as already sampled and stop before a valid 3+ message exchange appears.

## Evidence

`npm run underworld:v01-daytime-check` after the runtime fix:

- Runtime health: ok.
- Provider health: qwen preflight ok.
- Fallback pollution: 0.
- v0.1 goal audit: PENDING because fresh sample count is 2, both short/incomplete.

Fresh transcripts:

```text
海: 欸，真晝，先別管那些安靜的孩子，你剛才那聲嘆氣……其實也是在喊累吧？
真晝: 你手邊那杯茶都涼了，先喝一口再說吧。
```

```text
真晝: 欸，海，你桌角那杯茶都涼了，是不是又在幫 Alan 整理那些沒完的傳聞？
先別急著想怎麼解決，我剛在走廊看到你一直盯著窗戶發呆，要不要先坐下來歇一會兒？
海: 茶涼了就換一杯吧，反正我也只是把那些傳聞攏在一起，沒在發呆。既然你看到了，那我們就一起把窗邊這塊空位留出來，讓晚風先吹進來。
```

## Proposed Fix

Add a scoped archive guard for character-soul pilot conversations:

- If a non-human Umi / Mahiru / Tianze conversation has fewer than 3 meaningful messages, do not archive it as v0.1 evidence.
- Do not write memory/residue/participatedTogether for those short pilot conversations.
- Delete the transient messages the same way existing archive rejection paths already do.
- Keep Alan/human conversations unaffected.
- Keep non-pilot behavior unchanged unless an existing persistence guard already rejects it.

Implementation target:

- `convex/aiTown/game.ts`, near the existing archive guard that deletes conversations with insufficient meaningful messages.
- Test target if feasible: add/adjust a model-policy or memory/persistence guard test for two-message pilot conversation rejection.

## Expected Benefit

- Fresh sample count becomes meaningful: one archived pilot conversation should be at least 3 messages.
- 2-message fragments stop becoming eval/memory evidence.
- The single-sample loop will no longer be blocked by `participatedTogether` edges from incomplete pilot exchanges.
- This directly supports v0.1: conversation quality can be evaluated from real, minimally complete exchanges.

## Risks

- If the generator often stops after 2 messages, fewer samples will archive and collection may take longer.
- If the exit logic is too aggressive, this guard hides a real conversation-shape problem instead of fixing generation.
- Deleting short pilot archives means some natural tiny exchanges are not preserved, but v0.1 currently values memory continuity over more dialogue.

## Rollback Plan

- Revert the guard in `convex/aiTown/game.ts`.
- Re-run `npm run underworld:v01-daytime-check` and compare fresh sample count and archive rate.

## Files Touched

Expected:

- `convex/aiTown/game.ts`
- optional focused test file if an existing persistence-guard test is available
- `WORKLOG.md`

## Why Not Smaller

The runner-side fix already prevents false success, but it cannot prevent short conversations from being archived, writing `participatedTogether`, and influencing later sample collection/eval. The archive boundary is the smallest reliable place to prevent weak pilot fragments from becoming v0.1 evidence.

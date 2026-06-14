# CC Workload — Weekend Free Run (HANDS OFF)

Time anchor: 2026-06-13 22:25 CDT (Saturday)
Repo cwd: /Users/alanhdchu/ai-town
Status: **HOLD. Do not touch the repo or the running world until Monday 2026-06-15.**

## Active task

None. The soul-memory world is intentionally running unattended through the
weekend so the six pilots accumulate real conversations + residue. Alan reviews
results Monday.

## Hard rules until Monday (read WORKLOG 2026-06-13 22:25 entry for detail)

- **Do NOT edit files, set/remove env, redeploy, `testing:kick`, or restart.**
  Any redeploy bumps the engine generation and can spawn a split-brain engine
  (duplicate runStep loops → `Generation number mismatch` → conversations stop).
- If the world genuinely looks frozen (no new conversations for a very long
  time, confirmed via log + `school:debugAlanConversationState`), the ONLY safe
  recovery is one `testing:stop` → wait ~20s → `testing:resume`. Never `kick`.
- Observe/report-only automations and `npx convex run` checks are fine (they do
  not change files). The nightly-reflection automation must stay SHADOW.
- To sanity-check residue is writing, force a conversation with an input (no
  redeploy):
  `convex run aiTown/main:sendInput '{"worldId":"<id>","name":"startConversation","args":{"playerId":"p:0","invitee":"p:6"}}'`
  then read `school:notebookSoulTraces` / `recentConversationEvalData`.

## Monday backlog (deliberate, needs a redeploy)

1. Tune residue prompt: too philosophical/aphoristic ("原來X"), slightly
   over-interprets. Pull toward grounded/observational, ban invented meanings.
2. Confirm Alan↔character residue live (logic + unit tests pass already).
3. Consider real embeddings + nightly reflection `--write` only after the above.

## Last completed handoff

Continuity-lanes review (2026-06-13 12:10) — superseded by the weekend hold.

# Umi Workload

This file is the active handoff contract between Alan, Umi, Codex, and Claude Code / CC.

Use it for one focused worker task at a time. Keep longer multi-agent state and open handoffs in `WORKLOG.md`.

## Active Task

### Task ID
2026-05-28-verify-rebuilt-leave-guard-in-live-world

### Status
OPEN_READ_ONLY_OBSERVATION

### Assigned Worker
Claude Code / CC first-look read-only review. Codex/Umi owns final acceptance and any implementation.

### Context
On 2026-05-28 the working-tree copy of `convex/aiTown/agent.ts` had been reverted to HEAD (17:39), losing today's leave-guard work. It was rebuilt from the 17:30 build bundle (`dist/assets/index-6d4dafe0.js`) plus the `convex/aiTown/agent.test.ts` contract, then verified with `tsc` clean and `npm test` 110/110. The rebuilt logic re-wires *live* conversation leave behaviour, so it should be confirmed against fresh world evidence — not just unit tests.

Rebuilt behaviour to confirm:

- `minAutonomousConversationMessages()` default 4 (clamp 2..MAX).
- `hardAutonomousConversationDurationMs()` default MAX×3 (clamp MAX..30min).
- Ordinary duration timeout only ends an autonomous conversation once `numMessages >= MIN`; the hard cap still force-ends it.
- `agentSendMessage` defers a requested `[LEAVE]` when the next message would still be below MIN, unless the hard cap elapsed.

Do not edit files in this pass.

### Goal
Confirm, from fresh post-recovery samples, that:

1. Autonomous (NPC↔NPC) conversations reach 4+ meaningful messages more consistently.
2. Weak two/three-line exchanges are NOT archived early.
3. No conversation gets stuck open (hard cap still fires).

### Fresh Boundary
- Set a new forward boundary at the time observation starts and record it here before judging samples.

### How To Observe (read-only)
- `npm run underworld:heartbeat -- --once` to keep the world alive (no forced conversations).
- `npm run underworld:life-signals -- --since-created-at=<boundary>`
- `npm run eval:conversation:recent -- --since-created-at=<boundary>`
- `npx convex run school:recentConversationEvalData '{"sinceCreatedAt":<boundary>,"limit":10}'`

### Questions For CC
Answer concisely:

1. Do fresh autonomous conversations now reach 4+ messages more often than before?
2. Are any conversations stuck open past the hard cap?
3. Any sign the leave-guard is suppressing conversations that should have ended?
4. Is there enough evidence (3+ fresh samples) to judge, or stay sample-gated?

### Constraints
- Read-only review only. Do not edit files.
- Do not call provider APIs. Do not change Convex env.
- Do not force conversations. Do not clean or patch Convex DB.
- Do not rewrite prompts. Do not broaden into Simplified Chinese / phonetic alias repair.

### Files To Inspect Read-Only
- `convex/aiTown/agent.ts`
- `convex/aiTown/agent.test.ts`
- `convex/agent/memory.ts`
- `WORKLOG.md`

### Expected Output
- PASS/WARN/FAIL
- exact evidence (conversation ids, message counts)
- whether to stay sample-gated or act
- files inspected
- what Codex should not do yet

## Queued (not this task)

- **舊記憶時間戳 backfill**：`memory.ts:611` 時間格式已修，但只影響之後寫入的記憶。既有舊記憶字串仍是 UTC/en-US「5/28/2026, 5:39:23 PM」。待 Alan 決定是否跑一次性 backfill 重寫舊 description 時間戳。
- **前端時間一致性**：已由 Codex/Umi 修正 forward UI：`src/components/Messages.tsx` 的 message / typing / awaiting timestamps 共用 `zh-TW + America/Chicago` formatter。待下一次 UI smoke 確認顯示。
- **`明天奈` 精確 typo guard**：已由 Codex/Umi 實作 forward-only guard 與測試：只在 Asuna/明日奈是對話對象時把 terminal vocative `明天奈` 正規化成 `明日奈`；不擴成 Simplified 轉換或 phonetic alias。新 boundary：`1779989437042`。仍待 fresh post-boundary 樣本驗證是否消失。
- **Mahiru canonical rename**：DONE by Codex/Umi on 2026-05-28. Backend canonical source and live Convex roster now use `Mahiru`; display remains `真晝`; `Mahiru Shiina` remains compatibility alias only. Follow-up is fresh-sample monitoring for wrong-name artifacts and smoother openers.
- **cue registry 收斂（B1/B4）**：精確詞守門已散在 `conversation.ts`/`memory.ts`/`school.ts`/eval metrics/life-signals 共 5 處且 Mai 的 `隱形成本` 有誤殺風險，建議收斂為單一 registry。
- **B3 N+1**：`recentConversationEvalData` 在 audit 改掃全員後 N+1 會更糟。

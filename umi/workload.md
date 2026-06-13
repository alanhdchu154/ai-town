# Umi Workload

Last updated: 2026-06-12 21:34 America/Chicago

This file holds one active worker handoff at a time. Keep it narrow.

## Active Task

`uw-2026-06-12-alan-umi-timeout-memory-guard-review`

Goal:

- Read-only postpatch review of Codex's Alan-facing conversation timeout / memory-pollution hotfix.

Current evidence:

- Alan reported repeated `連線暫時不穩，這段沒有寫入角色記憶。` in Alan ↔ 海 around 21:02 and 21:13 CDT.
- Earlier evidence showed a cloud/local config mismatch, but the later failure was a separate engine-state issue:
  - `c:7180` archived with Alan trailing messages after Umi's last reply.
  - Umi agent had stale `toRemember: c:7180` and earlier stale `agentGenerateMessage`.
  - `c:7180` currently has `memoryCount: 0` and `experienceLogs: []`.
- A later recovery conversation `c:7246` became bad quality (hallucinated red pepper powder / old AI club / first-person stage directions), but it also currently has `memoryCount: 0` and `experienceLogs: []`.
- World is running; build/typecheck and targeted tests passed.

Codex patch under review:

- `convex/aiTown/conversation.ts`
  - Adds `shouldQueueConversationMemoryOnStop`.
  - Does not queue `agent.toRemember` when a conversation has no messages or the final message author is human.
- `convex/aiTown/agentOperations.ts`
  - Extends remember preflight with `archivedConversationHasUnansweredHumanTail`.
  - Clears current remember operation with reason `unanswered_human_tail` when an archived human conversation ends on a human message.
- `convex/agent/memory.ts`
  - Adds `hasUnansweredHumanTailForMemory` defense-in-depth before memory write.
  - Adds `hasDialogueStageDirectionLeak` and skips memory writes for first-person/third-person stage-direction contamination.
- `convex/agent/dialogueHygiene.ts`
  - Expands stage-direction detection for `我關上...`, `我把...拉嚴`, and `我手/指尖/目光...停在/碰/握...` style narration.
- Tests:
  - `convex/aiTown/agentOperations.test.ts`
  - `convex/agent/memory.test.ts`

Allowed scope:

- Read-only review only.
- Inspect current git diff and these files:
  - `convex/aiTown/conversation.ts`
  - `convex/aiTown/agentOperations.ts`
  - `convex/agent/memory.ts`
  - `convex/agent/dialogueHygiene.ts`
  - `convex/aiTown/agentOperations.test.ts`
  - `convex/agent/memory.test.ts`
  - `convex/agent/experienceLog.ts` only if needed to assess memory/experience contamination.
- Do not edit, stage, commit, push, run dev servers, or run broad evals.

Commands already run by Codex:

- `npm test -- --runTestsByPath convex/agent/memory.test.ts convex/aiTown/agentOperations.test.ts convex/agent/experienceLog.test.ts`
- `npx convex codegen`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- live checks with `school:debugAlanConversationState` and `world:defaultWorldStatus`

Review questions:

1. Does the unanswered-human-tail guard correctly prevent half-failed Alan-facing conversations from becoming memory without blocking normal completed chats too aggressively?
2. Is placing the guard in conversation stop, remember preflight, and memory writer reasonable, or is one layer unsafe/redundant?
3. Does the expanded stage-direction detector create obvious false positives for normal spoken lines?
4. Are there missing tests or edge cases before we keep this patch?

Expected output:

- Findings first, ordered by severity.
- State whether patch is safe to keep, safe with small follow-up, or should be narrowed.
- Mention any test gap that should be added now.

Stop condition:

- Report only. If more repo context is needed, say exactly what context; do not expand scope.

## Last Completed Handoff

`uw-2026-06-12-v01-experience-log-postpatch-review`

Outcome:

- cc completed a read-only postpatch review at `umi/reports/20260612T221947Z-workload.md`.
- cc found the five-pilot experience-log scope, pollution guards, caps, and dry-run sleep bridge sound.
- Codex accepted cc's only small follow-up and added an explicit `sourceKind: archivedConversation` internal contract to the writer call.

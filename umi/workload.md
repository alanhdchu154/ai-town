# CC Workload - Human-Facing Generation Retry Storm Review

Time anchor: 2026-06-15 21:49 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: Split-work, read-only diagnosis/review first

> 2026-06-16 01:05 CDT update: separate overnight check found the world was
> only "quiet" because it was sim-night (sleep schedule, see WORKLOG #19) — no
> retry storm / engine bug at that time. World is healthy and sleeping; it
> resumes conversations at sim 06:00. Tomorrow's real focus is still dialogue
> QUALITY on fresh daytime samples (motif loops, voice), not engine health.

## Context

Alan reported another "connection unstable" moment while chatting with
一之瀨 / Ichinose.

Umi/Codex first-look evidence:

- `npm run underworld:runtime-preflight` passed earlier this turn.
- `curl -I http://127.0.0.1:5173/ai-town` returned HTTP 200.
- Convex backend is listening on port 3210 and Vite is listening on 5173.
- `school:debugAlanConversationState` showed active `c:30824` with Alan and
  Ichinose, last message by Alan: `記住了麻，你有約麻`.
- `umi/reports/mobile-dev-stack.log` then showed repeated:
  - `p:2 continuing conversation with p:11.`
  - `Agent a:3 starting operation agentGenerateMessage (...)`
  - Convex `generationNumber mismatch` errors.
- A later debug snapshot showed `c:30824` was archived without a final
  Ichinose reply to Alan's last line, and memory was queued.

Current code already has an earlier failure cooldown:

- `Conversation.lastGenerationFailure`
- `conversation.markGenerationFailure`
- `shouldThrottleHumanGenerationAfterFailure`
- `agentAbortConversation` / `clearAgentOperation` mark failure for human
  conversations.

But the current failure cooldown is only written after an abort / clear /
timeout path. It does not mark a generation attempt before scheduling. If the
operation fails before cleanup, is preempted by generation mismatch, or does not
persist the failure marker reliably, `Agent.tick` can immediately start another
`agentGenerateMessage`.

## Candidate Patch Shape

Minimal hardening:

- Add a per-conversation `lastGenerationAttempt` marker for human-facing
  conversations.
- Before scheduling `agentGenerateMessage` for a human-facing conversation,
  check recent attempt/failure cooldown.
- Mark the attempt before `setIsTyping` / `startOperation`.
- Clear attempt/failure only when a real message is successfully recorded.
- Keep no fallback dialogue, no fake lastMessage, no provider/env changes.
- Avoid broad memory or prompt changes.

Potential files:

- `convex/aiTown/conversation.ts`
- `convex/aiTown/agent.ts`
- `convex/aiTown/agentInputs.ts`
- `convex/aiTown/agent.test.ts`

## Questions for CC

Findings-first, no writes:

1. Is the attempt-marker approach the smallest safe fix for this retry storm?
2. Is there a safer place to mark the attempt than `Agent.tick` before
   `startOperation`?
3. Should memory queueing be blocked when a human conversation ends with the
   last message authored by Alan and a recent generation failure/attempt exists?
4. What focused tests are needed?

## Constraints

- Do not touch provider keys or env.
- Do not delete live Convex state.
- Do not insert fallback / fake character dialogue.
- Do not rewrite prompts, memory architecture, or experienceLog logic.
- Do not run dev servers or broad evals.

## Expected Output

Short review:

- top findings by severity
- recommended minimal patch
- risks
- smallest verification commands

# Umi Workload

This file is the active handoff contract between Alan, Umi, Codex, and Claude Code / CC.

Use it for one focused worker task at a time. Keep longer multi-agent state and open handoffs in `WORKLOG.md`.

## Active Task

### Task ID
2026-05-22-cc-umi-mahiru-single-sample-binding-patch

### Status
DONE

### Assigned Worker
Claude Code / CC

### Goal
Implement the next narrow Umi x Mahiru targeted experiment:

1. Add a single-sample gate so a Qwen pilot window can produce at most one fresh archived Umi/Mahiru conversation after a run timestamp.
2. Nudge the prompt away from heavy parenthesized stage directions and toward spoken reciprocal binding.
3. Update the eval harness to measure those two failure modes.

Fresh evidence:
- After the previous patch, `conversation-c:38093` improved:
  - real Qwen, no fallback, no template marker, no system metaphor.
  - Mahiru noticed Umi first.
  - Umi revealed fatigue through `合上筆電` / `喘氣時間變少`.
- Remaining problems:
  - too many parenthesized stage directions like `（輕輕握住...）`.
  - weak turn-to-turn binding; base eval reports `previousSpeakerBindingScore: bound to 0/5`.
  - short test window overran and created extra samples (`38109`, half-open `c:38116`).

### Files You May Modify
- convex/aiTown/agent.ts
- convex/agent/conversation.ts
- evals/conversations/runUmiMahiruEval.ts
- scripts/run-umi-mahiru-single-sample.mjs
- package.json
- umi/reports/20260522T-cc-umi-mahiru-single-sample-binding-patch.md

### Requirements
- Do not read, print, test, or mention `key.md`.
- Do not call Qwen, Gemini, OpenAI, or any external model API.
- Do not run Convex env commands.
- Do not stop/resume Convex, Ollama, launchctl, browser, or world engine.
- Do not add lore, characters, UI, schema, all-NPC LLM, or memory summarization.
- Keep scope to Umi x Mahiru pilot.

### Implementation Guidance

#### A. Single-sample runtime gate

Patch `convex/aiTown/agent.ts` inside the `umiMahiruPilotEnabled()` branch of `findConversationCandidate`.

Add an env helper like:
- `UMI_MAHIRU_SINGLE_SAMPLE_AFTER_MS`

If set to a valid timestamp:
- query latest `participatedTogether` edge for Umi/Mahiru as the code already does;
- if `lastMember.ended >= timestamp`, return `undefined`.

This should prevent second and third conversations from starting after the first fresh post-run pilot conversation archives.

Do not change normal Umi/Mahiru behavior when env is unset.

#### B. Single-sample runner script

Add `scripts/run-umi-mahiru-single-sample.mjs`.

The script should:
- set `UMI_MAHIRU_SINGLE_SAMPLE_AFTER_MS` to a run timestamp;
- set `UMI_MAHIRU_COLOCATION_PILOT=true`;
- set `AUTONOMOUS_CONVERSATION_LLM_PAIRS="Umi:Mahiru Shiina"`;
- call `testing:resume`;
- call `school:coLocateUmiMahiruForPilot`;
- poll `school:recentConversationEvalData` until one archived Umi/Mahiru conversation with `createdAt >= run timestamp` exists, or timeout;
- run `npm run eval:umi-mahiru`;
- in `finally`, remove the three env vars, call `testing:stop`, and run `school:cleanupActiveUmiMahiruFallbackConversation {"dryRun":false,"force":true}` only if an active pilot remains or the script cannot confirm it is clean.

Keep it conservative and transparent. Do not read secrets; assume Qwen env is already configured.

Add a package script, e.g.:
- `pilot:umi-mahiru:single-sample`

#### C. Prompt nudge

Patch `richUmiMahiruPrompt()` only.

Add a narrow instruction:
- Use spoken dialogue first.
- Avoid parenthesized stage directions.
- At most one short visible action phrase; prefer putting action in the sentence naturally.
- Every continuation should echo one concrete word from the previous speaker, then move one step deeper.

Keep the output short. Do not remove the prior soul-depth constraints.

#### D. Eval harness

Patch `evals/conversations/runUmiMahiruEval.ts`.

Add metrics:
- `reciprocalBindingScore`: adjacent turns share/respond to concrete emotional/action tokens, not just generic care.
- `stageDirectionPenalty`: penalize heavy `（...）` or `(...)` stage directions.

Wire them into summary/report and scoring:
- binding should help `customScore` and strong pass gate.
- stage direction penalty should reduce score.
- old `conversation-c:38093` should remain WARN, not become PASS.

### Output Files
- Write a concise implementation report to `umi/reports/20260522T-cc-umi-mahiru-single-sample-binding-patch.md`.

### Done Criteria
Claude Code stdout includes:
- Files changed.
- Single-sample gate behavior.
- Runner script behavior.
- Prompt/eval behavior changed.
- Risks.
- Verification commands run, if any.
- One recommended next action.

## Result

Completed 2026-05-22 by CC, reviewed and tightened by Umi/Codex.

CC implemented the single-sample gate, runner script, prompt nudge, and eval binding/stage metrics. Umi/Codex accepted the direction and made three follow-up corrections:

- `scripts/run-umi-mahiru-single-sample.mjs` now applies/removes the three pilot-control Convex env vars itself and waits briefly after archive discovery before running eval.
- `richUmiMahiruPrompt()` uses different binding instructions for start vs continue turns, so a first message does not hallucinate that the other speaker already said something.
- `evals/conversations/runUmiMahiruEval.ts` recognizes concrete binding/action tokens seen in real samples such as `清單`, `接住`, `還好嗎`, `刪掉`, and `少劃`.

Runtime safety follow-up:

- `convex/aiTown/game.ts` now refuses to archive failed Umi/Mahiru pilot conversations with fewer than two messages, and deletes their partial messages instead.
- `convex/school.ts` includes the one hallucinated first-line marker from this run so fallback/misbound residue can be audited and cleaned.

Samples:

- `conversation-c:38123`: failed 1-message first-turn hallucination; cleaned from archived conversations, messages, memories, embeddings, and relationship edge state.
- `conversation-c:38134`: real Qwen 3-message sample; current eval `WARN 0.82`, no fallback/template, no stage directions, reciprocal binding `2/2`, behavior signal `1.00`.

Verification:

- `npx tsc --noEmit --pretty false` PASS
- `node --check scripts/run-umi-mahiru-single-sample.mjs` PASS
- `npm test -- --runTestsByPath convex/modelPolicy.test.ts` PASS
- `npm run build` PASS
- `npm run eval:umi-mahiru` PASS; latest fresh sample `conversation-c:38134` WARN 0.82
- `npx convex run school:auditUmiMahiruFallbackPollution '{"limit":1000}'` PASS / all zero
- Convex env check confirms only provider/model/quota/cooldown pilot config remains; pair gate and single-sample env are removed.
- `world:worldState` confirms engine stopped and no active conversations.

Recommended next action:

Run one more single-sample window only after a prompt nudge that makes continuation less poetic/action-heavy and more explicitly responsive in plain speech. Do not expand beyond Umi/Mahiru yet.

Follow-up completed:

- Prompt-only plain speech nudge produced `conversation-c:38147`, which regressed with first-turn `你剛才...` and parenthesized stage directions. It was treated as failed data, not success.
- Umi/Codex added a code-level sanitizer guard: Umi/Mahiru pilot strips parenthesized stage directions, blocks symbolic/poetic objects such as `紙鶴`, and aborts a first turn that pretends there was a previous utterance.
- `38147` was marker-scoped and cleaned; audit confirms no memory/event/profile residue.
- Guarded sample `conversation-c:38170` was collected. It is real Qwen, no fallback/template, stageDir 0, binding 1/1, WARN 0.75. This proves the guard works, but the sample is still not v0.1 PASS because the exit is too long and the emotional language still becomes polished/abstract near the end.

Next recommended target:

Limit pilot exit verbosity/abstractness and make Umi's fatigue land more privately instead of converting back into responsibility/briefing language.

Second follow-up completed:

- `leaveConversationMessage()` now runs through the Umi/Mahiru pilot sanitizer too.
- Pilot leave output is constrained to a short plain spoken sentence; verbose/abstract exit gets `[ABORT_CONVERSATION] pilot verbose exit` instead of being archived.
- `eval:umi-mahiru` now retries briefly when the first Convex read returns no Umi/Mahiru samples, fixing the intermittent empty table.
- Umi/Mahiru eval now reads up to 8 transcript messages so it judges the whole short conversation rather than only the last three lines.
- Guarded sample `conversation-c:38192` was collected. It is real Qwen, no fallback/template, stageDir 0, but full-conversation eval is FAIL 0.62 because reciprocal binding is only 1/6 and Umi still deflects into Liu Bei / briefing language.

Current conclusion:

The safety and sampling layer is now much healthier. The remaining issue is not provider, fallback, or archive hygiene; it is the soul prompt target. Umi needs a stricter relational rule: when Mahiru notices Umi's body/fatigue/toolness, Umi must answer from herself for one short turn before returning to Alan, Liu Bei, briefings, or tomorrow's tasks.

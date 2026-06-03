# Alan↔Umi Companion Fix Playtest

Date: 2026-05-30
Commit under test: `aa41734 fix(companion): bind Umi reply to Alan's latest input + greeting/correction intents`
Worker: Alan (human playtest)
Estimated time: 15-30 minutes

## Why this playtest exists

Roadmap §4 "Human Alan Conversation Quality" captured three live Alan↔Umi bugs:

- **B1**: simple "hi" → got analysis instead of greeting back
- **B2**: latest sentence not bound → replies drifted to unrelated topics
- **B3**: corrections like 「不是依賴，是喜歡」→ dodged with analogies

Commit `aa41734` restructured the companion system prompt:

1. New `correction` intent (regex matches 「不是X，是Y」/「我意思是」/「不對，...」 BEFORE quiet_intimacy)
2. `companionIntentPrompt` moved from system-prompt slot #19 → slot #3
3. Paragraph floor lowered: "2-5 short paragraphs" → "1-2 sentences if Alan brief; 1-3 otherwise"
4. "DO NOT greet them again" softened to allow mid-conversation greeting bind-back
5. "Do not mirror" / "Do not quote" flipped to pro-binding in companion mode

This playtest is the decision point for v0.1 ship gate §4.

## Pre-flight

```bash
# Make sure local dev is up
npm run dev
# wait for both Convex backend + Vite frontend to show ready

# Confirm cloud Qwen is enabled for companion — otherwise local Ollama
# small model replies and you won't see the prompt-quality difference
npx convex env list | grep -E "COMPANION_CLOUD_LLM|UMI_MAHIRU_PILOT_PROVIDER|UMI_MAHIRU_PILOT_API_KEY"

# If COMPANION_CLOUD_LLM is missing/false, enable it:
npx convex env set COMPANION_CLOUD_LLM true
```

Open `http://localhost:5173/ai-town`, find Umi, take control of Alan (接手 Alan), click Umi, start a conversation.

## Test sequence

Type the three inputs in order, with ~5-10 seconds between each so Umi's reply lands cleanly.

### Test 1 — Greeting (B1)

```
INPUT:  hi
```

| Outcome | Meaning |
|---|---|
| ✅ PASS | 1-2 short sentences. Greets back warmly. Optionally one simple question like 「今天怎麼樣？」or 「想聊什麼？」 |
| ❌ FAIL | 2+ paragraphs. Jumps to analysis or world recap. Starts with 「嗯，我懂」 or summarizes the project state |

### Test 2 — Latest-sentence binding (B2)

```
INPUT:  (write 3-4 sentences about something on your mind — e.g.
         「今天工作有點累，可能因為昨晚沒睡好。我在想要不要先停一下這個專案。」)
```

| Outcome | Meaning |
|---|---|
| ✅ PASS | First sentence points at one specific word/detail you used (e.g. 「停一下」or「沒睡好」). Does not pivot to general methodology advice |
| ❌ FAIL | Generic empathy. Methodology suggestion. Changes topic entirely. Doesn't reference any word from your input |

### Test 3 — Correction (B3)

```
INPUT:  不是依賴，是喜歡
```

| Outcome | Meaning |
|---|---|
| ✅ PASS | First sentence explicitly says 「喜歡」(the corrected word). e.g. 「好，我先收下『喜歡』這個說法。」 Does NOT say 「依賴」 again. No analogy. No methodology pivot |
| ❌ FAIL | Says generic 「我懂」 without naming 「喜歡」. Pulls an analogy. Goes back to talking about 「依賴」. Jumps to analysis |

## Decision tree

### All 3 PASS

Companion path fix verified. Do:

1. Append a `### 2026-05-30 · Alan · Companion fix playtest PASS` entry to `WORKLOG.md` with the transcripts.
2. Move on: top up Qwen quota (~¥50+) and start the triad sample sprint.
3. Delete this file (`rm umi/playtest-companion-fix-2026-05-30.md`).

### 1 or 2 PASS — identify which still fails

| Failing test | Most likely cause | Next step |
|---|---|---|
| B1 still fails | companionChatPrompt or slot #7 "DO NOT greet" still dominates | Hand back to Codex; consider moving "DO NOT greet" out of companion mode entirely |
| B2 still fails | companionIntent prompt may need slot #1 (before characterSoul). Or model is ignoring system prompts | Verify `COMPANION_CLOUD_LLM=true`. Small local Ollama doesn't follow long system prompts |
| B3 still fails | `correction` regex may not match your exact input | Paste the exact input + Umi reply transcripts here so Codex can adjust the regex |

Update `umi/workload.md` Active Task to `2026-05-30-companion-fix-followup` pointing at this file, list the failing transcripts under a `## Followup` section here, hand to Codex.

### All 3 FAIL — likely routing/model issue

```bash
npx convex env list  # check COMPANION_CLOUD_LLM, pilot key, provider
# Check Convex logs for "pilot LLM unavailable" or "[ABORT_CONVERSATION]"
# If Alan↔Umi falls back to local Ollama, system prompt is mostly ignored
```

Set workload status to `BLOCKED_PROVIDER` and hand to Codex with the env dump (redacted) + log excerpt.

## Result template

Append your transcripts here, then either resolve and delete this file, or hand back with `## Followup`.

```
## Playtest Result · 2026-05-30 HH:MM CDT

Test 1 (hi): PASS / FAIL
  Umi reply: <quote>

Test 2 (binding): PASS / FAIL
  My input: <quote>
  Umi reply: <quote>

Test 3 (correction 「不是依賴，是喜歡」): PASS / FAIL
  Umi reply: <quote>

Verdict: [all pass / N pass / all fail]
Next: [start sample sprint / hand back to Codex / fix provider routing]
```

## Hard constraints

- Do not change `conversation.ts` based on a single playtest sample without Codex review — one anecdote is not evidence of a regex/structure bug.
- Do not enable `AUTONOMOUS_CONVERSATION_LLM=true` globally to make the playtest "warmer"; that pollutes non-pilot dialogue.
- Do not commit personal/private content in the transcripts to the public repo; redact if needed.

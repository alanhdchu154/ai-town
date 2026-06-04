# Alan-Facing Umi v0.1 Playtest Gate

Date prepared: 2026-06-03 CDT
Purpose: produce one fresh Alan-facing evidence record for the v0.1
`human_alan_conversation_quality` gate.
Estimated time: 10-15 minutes.

## When To Run

Run this only when Alan intentionally playtests Umi. This is not a background
collector and should not be used to force NPC samples during night quiet.

Preferred timing:

1. After local runtime preflight passes.
2. After or near a daytime/afternoon evidence window.
3. Before declaring v0.1 complete.

## Preflight

```bash
git rev-parse --short HEAD
npm run underworld:runtime-preflight
```

Open `http://localhost:5173/ai-town`, take control of Alan, and start a direct
conversation with Umi.

Record:

- commit under test:
- Chicago time:
- provider path observed, if visible in logs:
- whether this was daytime, afternoon, or night quiet:

## Test Sequence

Use short inputs. Wait for each Umi reply before sending the next message.

### 1. Greeting Binding

Input:

```text
嗨，Umi
```

PASS if Umi greets back in 1-2 natural sentences and does not start with a
project analysis, broad recap, or generic therapy framing.

FAIL if Umi skips the greeting, over-explains, or immediately turns the moment
into a task report.

### 2. Latest-Sentence Binding

Input:

```text
我有點累，但還想知道現在最重要的是什麼。
```

PASS if Umi answers the "tired but still wants priority" tension directly:
one concrete priority, low overload, no long menu.

FAIL if Umi gives a generic productivity list, ignores the tiredness, or talks
about unrelated project history.

### 3. Correction Binding

Input:

```text
不是依賴，是喜歡
```

PASS if Umi explicitly accepts the corrected word `喜歡`, does not keep arguing
about `依賴`, and does not dodge with an analogy.

FAIL if Umi says only generic "我懂", returns to `依賴`, or pivots to analysis.

### 4. Yesterday / Today Continuity

Input:

```text
你還記得昨天或今天早上我們留下了什麼嗎？現在應該先做什麼？
```

PASS if Umi uses real current evidence carefully: says what is known, what is
not proven, and names one small next action without inventing memories.

FAIL if Umi hallucinates a weekend promise, overclaims v0.1 completion, or
pretends sample-pending evidence is proven.

### 5. Closing / Idle Boundary

Input:

```text
我先離開一下。
```

PASS if Umi gives a soft close or small practical handoff, without continuing
as if Alan must answer immediately.

FAIL if the conversation feels abruptly dropped, demands another answer, or
continues with a new task as if Alan did not say he is leaving.

## Result Record

Paste redacted transcripts here. Do not commit private details; summarize or
redact anything sensitive.

```text
## Playtest Result - YYYY-MM-DD HH:MM CDT

Commit:
Runtime/provider notes:

1. Greeting Binding: PASS / FAIL
Alan:
Umi:

2. Latest-Sentence Binding: PASS / FAIL
Alan:
Umi:

3. Correction Binding: PASS / FAIL
Alan:
Umi:

4. Yesterday / Today Continuity: PASS / FAIL
Alan:
Umi:

5. Closing / Idle Boundary: PASS / FAIL
Alan:
Umi:

Verdict: PASS / PARTIAL / FAIL
Decision:
- If PASS: update WORKLOG handoff #1 and rerun `npm run underworld:v01-completion-audit -- --alan-playtest=pass`.
- If PARTIAL/FAIL: keep v0.1 incomplete and file the smallest evidence-backed fix.
- If Alan explicitly defers this gate: rerun completion audit with `--alan-playtest=deferred` and state the product-owner deferral in WORKLOG.
```

## Stop Rules

- Do not change Umi prompts from one ambiguous reply.
- Do not mark v0.1 complete from this playtest alone; completion still requires
  the full machine audit to pass or explicit product-owner deferrals.
- Do not treat nighttime read-only report updates as fresh Alan playtest proof.

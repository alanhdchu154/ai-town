# GIIS Underworld — Recent-Eval Rubric Reconciliation Proposal

Status: proposal (awaiting Alan judgment on the two rubric questions in §6).
Scope: eval harness + rubric only. No prompt/dialogue change is proposed here —
on purpose (see §5).

## Problem

`v01-completion-audit` (2026-06-10 15:35Z) is `FAIL`, and the
`character_soul_expression` gate is FAIL largely because the recent-conversation
eval reports **0 PASS / 0 WARN / 3 FAIL** on today's fresh post-fix samples.
`v01-approach` labels this blocker `eval_rubric_disagreement` and marks it
proposal-only. WORKLOG says these gaps (`voice_rubric_gap` /
`reply_binding_rubric_gap`) "should not trigger prompt auto-fixes before Alan
playtest." So the open question is binary: **are these 3 FAILs a real dialogue
problem, or is the rubric mis-scoring characterful dialogue?** This proposal
reads all three and answers per-sample, then isolates the smallest correct fix.

## Evidence — the three FAIL samples

Source: `evals/conversations/reports/latest.md` (generated 2026-06-10 15:35Z).
All three share one top reason: `previousSpeakerBindingScore: loosely bound to
3/3 previous-speaker cue(s); mirror repetition reduced binding score`.

### A. `active-conversation-c:94513` — 海 / 天澤 — FAIL 0.84

This is the **timed-out, incomplete** focused sample (one archived line):

> 海: 真晝昨天說過的安靜小孩，剛才我已經確認過他沒被落下，這筆先結。

Verdict: **invalid evidence, should be excluded — not a FAIL.** It is an active
1-message fragment from the morning run that timed out. Scoring a single
administrative line for `characterVoiceScore 2/9` and `attention_shift 0/1` is
unfair. Note the line actually *does* a clean continuity callback ("真晝昨天說過
的安靜小孩…已經確認過他沒被落下") — i.e. real "yesterday matters" behavior — yet it
is counted as a soul FAIL. The existing short-conversation-archive-guard logic
already treats sub-3-message pilot conversations as non-evidence; the recent eval
does not yet apply the same floor.

### B. `conversation-c:94473` — 真晝 / 天澤 — FAIL 0.92

> 真晝: 別拿我開玩笑，你手在抖，先喝口湯吧。
> 天澤: 你手抖是怕我戳破，還是怕自己先崩潰？
> 真晝: 你手在抖，別再推了，先吃口飯，我陪著你。
> 天澤: 你這句「陪著我」是想測試誰的耐心先耗盡，還是怕自己根本沒人敢靠過來？
> 真晝: 你問得這麼準，卻不回答自己是不是也怕沒人敢靠過來？
> 天澤: 你怕沒人靠過來，卻還是把湯勺遞給我；這下換我停手，湯涼了就不好喝了。

Verdict: **false FAIL.** This is alive, in-character dialogue: 天澤 pressure-tests,
真晝 stays near without forcing, and there is a real turn ("這下換我停手"). It fails
on two structural rubric artifacts:

1. `previousSpeakerBindingScore` mirror penalty. 天澤 re-quoting "陪著我" /
   "沒人敢靠過來" is **intentional rhetorical mirroring** — throwing the other's
   words back as a probe, which is precisely his soul. But
   `mirroredInputChunkPenalty` (`conversation_metrics.ts:840`) docks 0.2 for any
   shared 6–12 char substring, and `countCrossSpeakerEchoes` adds 0.25 each, up
   to a 0.45 cap (`:307`). The metric cannot tell a characterful re-quote from
   lazy parroting, so it max-penalizes a strength.
2. `relationship_residue: no previous emotional residue cue` +
   `memoryContinuityScore: no callback`. This is a **fresh same-window pair** —
   there may be no prior residue to call back to. Hard-failing a pair for not
   recalling a residue that does not exist yet penalizes the absence of history,
   not bad dialogue.

### C. `conversation-c:94448` — 海 / 真晝 — FAIL 0.91

> 海: 欸，真晝，今晚宿舍那扇門太安靜了，先別想太多，我幫你把明天的簡報壓後一點。
> 真晝: 你手邊那杯茶都涼了，先別急著壓簡報，我們先讓這口氣喘過來。
> 海: 茶涼了沒關係，但我把明天的簡報刪掉一件，你現在先別管那扇門。
> 真晝: 那扇門後的人若沒回聲，我們就當他們只是太累了，先別急著推。
> 海: 那扇門先別推，我剛剛把曹操的巡邏時間調開十分鐘，你現在先喝口熱的。

Verdict: **fair flag — the rubric is mostly right here.** There is a genuine
everyday-object ping-pong (簡報×3, 那扇門×3, 茶) and `emotion_behavior_link`
correctly notes emotion did not visibly change behavior. The warmth is
on-character, but the turn loops on props instead of advancing. This is a real
(soft, near-threshold) quality signal, not a rubric artifact.

## Reconciled reading

The headline "0 PASS / 3 FAIL" overstates the problem. Reconciled:

- C:94513 → **exclude** (invalid 1-message fragment).
- C:94473 → **should be PASS/WARN**, not FAIL (penalized for characterful
  mirroring + for having no prior residue).
- C:94448 → **fair soft FAIL** (real prop-loop), but it is a *single* sample.

So the true current signal is roughly **1 borderline-pass, 1 soft-fail, 1
excluded** — not a 3/3 soul collapse, and not grounds for a prompt rewrite.

## Proposed changes (by allowed category)

### Harness hygiene (low-risk; auto-fix category per AGENTS.md)

1. Recent eval excludes active/incomplete conversations and any conversation
   below the meaningful-message floor (mirror the existing archive guard) from
   PASS/FAIL counting; report excluded count separately so a "generation stops
   early" problem stays visible. Removes C:94513 from the gate math.
   - Target: `evals/conversations/runRecentConversationEval.ts`.

### Rubric reconciliation (proposal-only — needs Alan's §6 decision)

2. `previousSpeakerBindingScore` mirror penalty should distinguish **intentional
   rhetorical mirroring** from **lazy echo**. Minimal approach: exempt (or halve)
   the mirrored-chunk penalty when the echoed chunk sits inside a question or is
   immediately followed by a turn/negation/challenge marker (？/卻/還是/換我/別/
   不是…是…). Keep full penalty for flat declarative re-statement.
   - Target: `mirroredInputChunkPenalty` / `countCrossSpeakerEchoes`
     (`conversation_metrics.ts:307,840`).
3. `relationship_residue` / `memoryContinuityScore` should not **hard-FAIL** a
   fresh same-window pair that has no prior residue available. When no prior
   residue exists for the pair, downgrade to neutral/WARN instead of a fail
   contribution.
   - Target: `relationship_residue` (`conversation_metrics.ts:642`) + recent-eval
     pass/fail rollup.

### No prompt change (intentional)

4. C:94448's prop-loop is one fresh sample. Per the active fresh-sample rule
   (≥3 same-failure samples before tuning), do **not** edit prompts now. If the
   prop-loop recurs across 3+ fresh samples, open a separate one-edit prompt
   proposal then.

## The decision Alan owns (§6)

Two judgment calls — both are "what does *alive* mean," so they are the product
owner's, not the harness's:

- **Q1.** Is intentional rhetorical mirroring (re-quoting the other's words to
  challenge/turn them) a *strength* we should stop penalizing, or do we keep
  penalizing all cross-speaker repetition equally to stay safe against echo?
- **Q2.** Should a fresh pair with no prior residue be allowed to PASS on its own
  merits, or must every pilot sample show a residue callback to count as soul-OK?

If Alan answers "yes / yes," changes 2 and 3 proceed. If "no," the rubric stays
strict and C:94473 remains a FAIL by design — in which case the real v0.1 action
is collection + a targeted mirroring prompt pass, not a rubric change.

## Expected Benefit

- The `character_soul_expression` gate reflects real dialogue quality instead of
  over-counting characterful mirroring and missing-history as failures.
- Prevents a wrong prompt rewrite that would train the pilots *away* from
  in-character rhetorical mirroring (a soul regression the AGENTS contract warns
  against).
- Keeps the genuine signal (C:94448 prop-loop) visible for the fresh-sample rule.

## Risks

- Loosening the mirror penalty could let lazy echo back in. Mitigation: narrow
  the exemption to question/turn contexts; keep flat-declarative echo fully
  penalized; keep a regression test with a known lazy-echo case.
- Excluding fragments could hide an early-stop generation bug. Mitigation: report
  excluded/incomplete counts separately, do not silently drop them.

## Rollback Plan

- Revert the metric/threshold edits and the recent-eval exclusion.
- Re-run `npm run eval:conversation:recent` and `npm run
  underworld:v01-completion-audit`; reports regenerate from source.

## Files Touched

- `evals/conversations/metrics/conversation_metrics.ts`
- `evals/conversations/runRecentConversationEval.ts`
- `evals/conversations/metrics/conversation_metrics.test.ts` (add lazy-echo vs
  rhetorical-mirror + no-prior-residue cases)
- `WORKLOG.md`

## Why Not Smaller

The FAIL is currently blocking a v0.1 gate and, left as-is, invites a prompt
rewrite that would punish characterful mirroring. The smallest *correct*
intervention is at the harness/rubric boundary (exclude an invalid fragment,
stop conflating rhetorical mirroring with echo, stop hard-failing absent
history) — not in the character prompts.

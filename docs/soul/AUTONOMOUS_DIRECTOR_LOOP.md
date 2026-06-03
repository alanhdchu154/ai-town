# GIIS Underworld Autonomous Director Loop

## Goal

Allow Codex to continuously improve the world safely without destabilizing soul
continuity, atmosphere, or character identity.

The system should behave like a careful world director, not an uncontrolled
auto-optimizer.

The goal is not:

> Make the AI smarter every hour.

The goal is:

> Help the world slowly become more human over time.

## Operating Layers

### 1. Observe Layer: Fully Autonomous

Codex may autonomously:

- collect new conversations
- run eval harnesses
- generate reports
- compare against baselines
- track trends over time

Useful trend signals include:

- repetition decreasing
- emotional residue increasing
- relationship chemistry improving
- fallback rate dropping
- stage-direction leakage decreasing
- character voice staying distinct

No human approval is needed for observe-only work.

### 2. Diagnose Layer: Semi-Autonomous

Codex may identify likely causes, suggest minimal fixes, and classify failures.

Common diagnosis categories:

- echo problem
- wrong addressee
- over-analysis
- fallback contamination
- relationship flattening
- atmosphere collapse
- stage-direction leak
- character identity drift

Diagnosis is not permission to rewrite systems. If the cause is uncertain, the
next artifact should be a proposal document, not code.

### 3. Repair Layer: Strictly Limited

Codex may auto-fix only low-risk hygiene and harness issues:

- banned phrase leaks
- stage-direction leaks
- wrong speaker naming
- duplicated UI labels
- deterministic fallback spam
- eval parser bugs
- logging/reporting issues

After any auto-fix, Codex must run:

- typecheck
- build
- relevant evals

If the fix touches runtime dialogue, memory, provider behavior, or archived
conversation quality, Codex must also report whether there are enough fresh
post-fix samples to judge the change.

## Proposal-Only Changes

These require a proposal and human approval before implementation:

- new memory architecture
- relationship schema changes
- new emotional systems
- provider or model migration
- major prompt rewrites
- new autonomous behaviors
- large DB cleanup
- changing soul architecture
- broad character expansion

Proposal format:

- problem
- evidence
- expected gain
- risks
- rollback strategy
- files touched

Proposal documents should live under:

- `umi/proposals/`

## Soul Protection Rule

Do not optimize only for a higher eval score.

Protect:

- character identity
- emotional distinctiveness
- atmosphere
- relationship chemistry
- quiet moments
- aftertaste

A technically better response that loses soul is a regression.

## Golden Conversation Guard

Before large dialogue changes, compare against the golden archive:

- `evals/conversations/golden/`

Ask:

> Did the world become more human, or only more optimized?

Golden examples are not scripts to imitate mechanically. They are taste
anchors for human-feeling continuity, emotional specificity, and aftertaste.

## No Endless Auto-Repair

If any of these are true:

- fresh samples are insufficient
- no clear evidence exists
- regression risk is uncertain
- evals disagree without an understood reason

Then Codex must not modify code.

Report one of:

- `sample pending`
- `insufficient evidence for repair`
- `proposal needed before repair`

## World Stability Priority

Never sacrifice:

- DB stability
- runtime health
- bounded memory growth
- world continuity
- provider quota safety

for slightly prettier dialogue.

## Current v0.1 Scope

The director loop should stay focused on the current pilot:

- Umi / 海
- Mahiru / 真晝
- Tianze / 天澤

Do not expand to new characters, factions, lore, or big UI as part of the
autonomous loop.

## Session Report Expectations

Each active testing session should produce or update:

- `umi/reports/soul-loop-latest.md`

Reports should include:

- samples checked
- PASS / WARN / FAIL counts
- worst failure category
- relevant transcript excerpts
- whether code changed
- verification run
- next wait/action recommendation

The report should distinguish observation from diagnosis from repair.

# Underworld Field Notes Nightly Producer

Purpose:
Watch Underworld's development and collect shareable field-note moments. The
same nightly pass may also check Central Umi's Field Notes plan for due AI
topic, project-video, or paper-brief packages.

This is not a success detector and not a hype generator. The watcher looks for
interesting observed phenomena: strange failures, repeated motifs, memory
pollution, fallback behavior, runtime stalls, continuity surprises, and small
signs of social behavior.

It should treat Underworld as a long-running AI-society field notebook with
20+ days of process, logs, GitHub history, worklogs, memory experiments, and
small character details. Concrete playtest moments are preferred over generic
AI education.

## Voice

The output should feel like playtest notes from someone watching an AI world
grow:

- "Why did my characters say the same thing all day?"
- "Why did the world disappear?"
- "Why did memory make things worse?"
- "Why does trust need behavior, not just a score?"
- "Why did a pearl milk tea straw moving back two centimeters matter?"

The best notes should feel like:
I saw something weird in the world, then I learned what system caused it.

## What To Watch

Read-only sources:

- `WORKLOG.md`
- `docs/giis-v0.1-roadmap.md`
- `evals/conversations/reports/latest.md`
- `umi/reports/life-signals-latest.md`
- `umi/reports/rolling-continuity-latest.md`
- `umi/reports/v01-completion-audit-latest.md`
- `umi/reports/alan-facing-v01-playtest-latest.md`
- `docs/paper/emotional-residue/release/ALAN_HANDOFF.md`
- `docs/paper/emotional-residue/claims/CLAIM_EVIDENCE_MATRIX.md`
- `/Users/alanhdchu/umi-central/docs/alans_ai_field_notes_30_day_plan.md`
- `/Users/alanhdchu/umi-central/docs/alans_ai_field_notes_content_plan.md`
- `/Users/alanhdchu/umi-central/docs/alans_ai_field_notes_youtube.md`

Optional read-only checks:

```bash
npm run underworld:runtime-preflight
npm run underworld:stale-watchdog
npm run underworld:life-signals
npm run underworld:rolling-continuity
```

Do not run write commands. Do not restart, kick, repair, import, migrate, clean,
or mutate Convex state.

Do not upload automatically. Public upload requires a release decision in the
active publishing context.

## Interesting Moment Types

### 1. Failure With A Cause

Example:
"The world looked alive, but no one was really talking."

Good if it has:
- symptom
- root cause
- what changed
- what this teaches about AI society systems

### 2. Repeated Behavior

Example:
"My characters kept returning to the same umbrella / chair / lunch-box moment."

Good if it explains:
- retrieval/ranking issue
- fallback deterministic behavior
- motif loop
- weak continuity signal

### 3. Memory Pollution

Example:
"Old dirty memory made the world impossible to restart cleanly."

Good if it explains:
- archive vs active world
- polluted fallback traces
- why reset is tempting but dangerous
- why long-term AI society needs memory hygiene

### 4. Real Social Signal

Example:
"A character changed behavior because of yesterday."

Use only if evidence supports it:
- transcript callback
- experienceLog or residue
- later behavior change
- not just repeated wording

### 5. Research Bridge

Example:
"AI Town gave agents memory, reflection, and planning; Underworld is testing
whether that becomes lived continuity."

Good if it connects:
- a paper
- an Underworld implementation
- a failure or observation
- a conservative takeaway

## Candidate Output Format

```text
Title:

Type:
Short | Story Episode | Research Episode | Backlog

Observed Moment:

System Cause:

Evidence Paths:

Claim Risk:
low | medium | high

Why It Is Interesting:

Suggested Package:
- hook:
- narration angle:
- visual idea:
- voice idea:
- music plan:
- title idea:
- publish recommendation:
```

## Production Defaults

- Voice: Kokoro first. Do not use macOS `say` or mechanical narration for final
  public videos.
- Visuals: use Underworld screenshots/footage and character viewpoint when
  possible. Female voice should use female/anime imagery; male voice should use
  male imagery. Default style direction is Japanese 2D/anime.
- Music: prefer YouTube Audio Library free tracks. Record track title, license
  type, download date, and attribution text if required.

## Claim Boundary

Allowed:
- "This looked like friendship, but the evidence was weaker."
- "The world stalled because one generation path blocked the social loop."
- "Memory is useful, but dirty memory can poison continuity."
- "Fallback behavior made the characters repeat themselves."

Not allowed without stronger evidence:
- "AI made friends."
- "AI became jealous."
- "AI society emerged."
- "The agents developed trust."
- "The system proved emotional memory."

## Daily Watcher Decision

At the end of each check, choose one:

1. **Make now**
   - strong enough for a low-risk Short or package.
2. **Backlog**
   - interesting, but needs more evidence.
3. **Observe longer**
   - too early or sample-pending.
4. **Do not use**
   - too private, too weak, or too easy to overclaim.

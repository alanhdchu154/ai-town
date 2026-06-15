# CC Workload — Underworld Media Pipeline v1 Feasibility Review

Time anchor: 2026-06-15 America/Chicago
Repo cwd: `/Users/alanhdchu/ai-town`
Model target: opus
Mode: read-only feasibility / architecture review

## Context

Alan wants an Underworld Media Pipeline v1. The goal is not generic AI
education. The goal is documenting and studying the emergence of AI society.

Requested categories:

- Category A Shorts, 30-60s, single question + surprising answer.
- Category B Story Episodes, 5-15m, narrative documentary.
- Category C Research Episodes, 5-20m, paper + Underworld implementation +
  findings.

Requested folder:

```text
media/
  topics/
  scripts/
  shorts/
  longform/
  papers/
  generated/
  uploads/
```

Requested agents:

- Topic Agent: generate ranked video ideas from current Underworld status,
  existing logs, recent experiments.
- Research Agent: collect papers/references/experiments into a research package.
- Script Agent: generate Shorts / long-form scripts.
- Asset Agent: generate image prompts, thumbnail prompts, visual suggestions.
- Upload Agent: generate title, description, tags, and prepare upload package.

Important constraint:
No automatic publishing yet. Human review required.

## Umi First Look

Current Underworld direction is v0.1 evidence collection, not broad civilization
feature expansion. The media pipeline should be read-only over runtime/project
evidence and should not mutate Convex, prompt state, memory, experienceLogs,
sleepNotes, or YouTube privacy.

Useful source paths already exist:

- `WORKLOG.md`
- `docs/giis-v0.1-roadmap.md`
- `evals/conversations/reports/latest.md`
- `umi/reports/life-signals-latest.md`
- `umi/reports/rolling-continuity-latest.md`
- `umi/reports/v01-completion-audit-latest.md`
- `docs/paper/README.md`
- `docs/paper/emotional-residue/release/ALAN_HANDOFF.md`
- `docs/paper/emotional-residue/claims/CLAIM_EVIDENCE_MATRIX.md`

Current risk:
2026-06-15 life-signals report is still `sample_pending` with fewer than three
daytime conversations. The media pipeline must not turn sparse evidence into
strong claims like "AI society emerged" or "AI citizens formed real trust."

## Task

Read only. Do not edit files.

Assess the feasibility of adding the requested `media/` scaffold and lightweight
pipeline docs/scripts.

Please answer:

1. Is the requested v1 feasible without touching runtime behavior?
2. What should v1 include versus defer?
3. Which files/folders should Codex create now?
4. What source reports should Topic Agent read first?
5. What safety gates are required before any upload package?
6. What would be dangerous over-automation?
7. Should this live in `/Users/alanhdchu/ai-town/media/`, or in
   `/Users/alanhdchu/umi-central/content/`, or both?

## Constraints

- No runtime mutation.
- No Convex writes.
- No prompt/memory/soul changes.
- No automatic publishing.
- No public upload from this pipeline.
- No claims of validation from sparse synthetic/internal evidence.
- Keep v1 markdown/JSON/scriptable and lightweight.
- Prefer generated packages that a human can review.

## Expected Output

Findings-first, concise:

- Feasibility verdict.
- Recommended v1 shape.
- Minimal file scaffold.
- Risks and mitigations.
- Smallest next implementation step.

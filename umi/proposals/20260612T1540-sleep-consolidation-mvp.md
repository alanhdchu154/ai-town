# Sleep Consolidation MVP Dry-Run

Date: 2026-06-12 15:40 America/Chicago

## Status

Implemented as a dry-run only.

No Convex memory rows are written. No emotional residue is promoted. No profile,
world event, notification, or prompt-facing read path is changed.

## Goal

Turn the "sleep system" idea into a bounded review loop:

1. Read fresh recent conversations.
2. Classify each conversation into a memory fate.
3. Produce a human-readable report.
4. Require cc/Alan review before any live write path exists.

This lets us study what the world would remember without forcing characters to
remember noisy or polluted dialogue.

## Buckets

- `long_term_memory_candidate`
  - Unresolved future hook, promise, callback, or behavior shift that may affect
    tomorrow.
- `emotional_residue_candidate`
  - Concrete person/event-specific emotional residue, not a slogan.
- `short_term_context`
  - Useful near-term scene context that should fade if not referenced.
- `forget_or_ignore`
  - Greeting, low-signal, generic, or ordinary interaction.
- `needs_human_review`
  - Risky sample: fallback leak, stage direction, repeated noise, mirror echo,
    or other hygiene issue.

## Guardrails

- No raw numeric emotion such as `sad +3`.
- No candidate is prompt-facing by default.
- Legacy continuity evidence remains historical review material:
  `promptFacing=false`, `freshEvalEligible=false`.
- Food/fatigue motifs and object-prop churn are downgraded to short-term
  context unless a later reviewed rule proves they matter.
- Closing lines such as "I have to go" are not long-term memory by themselves.
- Runtime-marked repeated noise blocks automatic promotion.
- Future live writes must be capped, deduped, logged, and reversible.

## Current Dry-Run Evidence

Command:

```bash
npm run underworld:sleep-consolidation
```

Latest report:

- `umi/reports/sleep-consolidation-latest.md`
- 50 recent conversations checked.
- 1 long-term candidate.
- 0 emotional-residue candidates.
- 31 short-term context rows.
- 4 forget/ignore rows.
- 14 human-review rows.
- Convex writes: 0.
- Prompt-facing writes: 0.
- Stored legacy evidence rows: 12.
- Legacy prompt-facing rows: 0.
- Legacy fresh-eval-eligible rows: 0.

## cc Review Outcome

cc reviewed the first dry-run at
`umi/reports/20260612T204455Z-workload.md`. Accepted classifier-only fixes:

- Low-signal `runtime_marked_repeated_noise` can fade instead of filling human
  review.
- Duplicate same-day motifs demote to short-term context.
- Object-prop churn uses family/repeat logic instead of any two prop words.
- Food/closing-line motifs cannot become long-term candidates.
- Malformed possible-memory text is human-review only.
- The markdown report now shows per-bucket risk breakdown and the exact
  candidate text Alan would review before any future write.

## cc Review Request

No further cc review is needed for this dry-run unless new evidence appears.
If Alan approves a future implementation, create a new cc handoff to review the
new table/writer design.

Original review questions were:

- whether the bucket thresholds are too strict or too loose
- whether food/object/closing-line downgrades are appropriate
- whether any bucket should become proposal-only instead of future auto-write
- whether the report has enough evidence for Alan to judge the sleep system

## Not Approved Yet

- Writing sleep output into `memories`
- Writing sleep output into an emotional residue table
- Reading legacy evidence into prompts
- Promoting old-world evidence into current character memory
- Automatic daily/nightly memory consolidation writes

## Next Decision

If cc and Alan accept this dry-run, the next implementation should be a
bounded writer that creates review-only sleep notes in a new isolated table,
still not prompt-facing until separately approved.

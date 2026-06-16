# MysteryDetector v1

Purpose:
Find the most interesting thing that happened inside Underworld.

This is the first priority of the media system. If Underworld cannot reliably
surface interesting events, Shorts, scripts, renders, and uploads are premature.

MysteryDetector is not a content generator. It discovers public field-note
candidates and attaches evidence so a human or channel manager can decide what
is worth turning into content.

## Boundaries

MysteryDetector v1 is read-only.

It must not:
- mutate Convex or runtime state
- restart, kick, repair, import, clean, or migrate the world
- change prompts, souls, memories, relationships, trust, or env vars
- render media
- upload or change YouTube privacy
- generate a large content backlog

## Inputs

v1 reads only existing reports and notes:

- `WORKLOG.md`
- `media/topics/watcher-inbox.md`
- `umi/reports/life-signals-latest.md`
- `umi/reports/rolling-continuity-latest.md`
- `umi/reports/v01-completion-audit-latest.md`
- `evals/conversations/reports/latest.md`

Direct Convex queries, relationship deltas, trust tables, and raw memory-log
mining are v2 work.

## StoryCandidate Schema

Each candidate must use this shape:

```json
{
  "score": 9.2,
  "type": "memory_anomaly",
  "title": "Can AI Remember A Moment?",
  "source_event": "Window-light-on-hand detail reappeared in later conversation.",
  "why_interesting": "A tiny sensory detail survived long enough to shape a later line.",
  "public_safe_summary": "A concrete detail from one conversation appeared again later, suggesting a small continuity signal.",
  "mystery_angle": "Did the character remember the moment, or did the system merely reuse a cue?",
  "suggested_format": "field_note_short",
  "narrator_or_pov": "Umi watcher diary",
  "risk_level": "medium",
  "evidence_links": [
    "umi/reports/rolling-continuity-latest.md",
    "media/topics/watcher-inbox.md"
  ],
  "recommended_action": "draft_short_candidate"
}
```

Allowed `type` values:
`memory_anomaly`, `repeated_behavior`, `relationship_shift`, `trust_shift`,
`social_loop_stagnation`, `conflict_or_misunderstanding`,
`character_consistency`, `personality_like_bug`, `builder_failure`.

Allowed `suggested_format` values:
`field_note_short`, `underworld_story`, `research_episode`, `builder_log`,
`observe_more`, `do_not_use`.

Allowed `risk_level` values:
`low`, `medium`, `high`.

Allowed `recommended_action` values:
`draft_short_candidate`, `draft_video_outline`, `backfill_story`,
`observe_more`, `do_not_use`.

## Detection Targets

MysteryDetector v1 should detect and rank:

- memory anomalies
- repeated behavior
- relationship or trust shifts
- social loop stagnation
- conflict or misunderstanding emergence
- surprising character consistency
- bugs that create interesting personality-like behavior

## Scoring

Score range: `0.0-10.0`.

Scoring dimensions:
- unexpectedness
- emotional relevance
- recurrence
- contradiction
- social significance
- story potential
- evidence strength
- public-safety risk adjustment

Initial deterministic rules:
- strong rolling continuity callback: `8-9.5`
- repeated phrase loop: `8-9`
- contradictory or failed memory: `8.5-10`
- social loop stagnation with clear cause: `7.5-9`
- relationship or trust shift with weak evidence: `6-7.5`
- abstract method-only topic: cap at `6.5`
- high overclaim or privacy risk: subtract `1-2`

## Daily Channel Manager Loop

Every run:

1. Review latest uploads, available metrics, comments, and style ledger.
2. Run or read MysteryDetector output.
3. Identify what appears to work or fail without blindly chasing views.
4. Generate exactly 3 Short ideas and 1 longer video idea.
5. Select only one item for the run.
6. Create only the needed draft asset: script, outline, title, thumbnail
   concepts, description, or review package.
7. Update Mystery candidates, style/metrics ledger, and Central handoff.
8. Stop before uploader work.

## Human Review Package Format

```text
Candidate:
Source evidence:
Public-safe claim:
Risk level:
Narrator / POV:
Format:
Draft assets included:
Quality gate:
Human decision:
Next action:
```

The review package is not an upload package. It exists to decide whether the
story is worth turning into content.

## Current v1 Command

```bash
npm run underworld:mystery-detector
```

Outputs:

- `media/topics/mystery-candidates-latest.json`
- `media/topics/mystery-candidates-latest.md`

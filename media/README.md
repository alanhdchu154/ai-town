# Underworld Media Pipeline v1

Purpose:
Document and study the emergence of AI society in Underworld.

This is not a generic AI education content factory. The media pipeline turns
Underworld experiments, logs, reports, failures, and papers into reviewable
YouTube content packages.

## Core Rule

Automation may generate packages.

Automation must not publish.

Every package requires human review before upload or privacy changes.

## Content Categories

### Category A - Shorts

Length:
30-60 seconds.

Format:
Single question + surprising answer.

Output:
- title
- hook
- narration script
- subtitle file
- thumbnail prompt
- YouTube description
- tags
- human review checklist

### Category B - Story Episodes

Length:
5-15 minutes.

Format:
Narrative documentary.

Output:
- episode outline
- script
- chapter structure
- thumbnail prompt
- description
- tags
- human review checklist

### Category C - Research Episodes

Length:
5-20 minutes.

Format:
Paper + Underworld implementation + findings.

Required structure:
1. What the paper claims.
2. How Underworld implemented or explored the idea.
3. Results.
4. Failures.
5. Future work.

Output:
- script
- references
- visual suggestions
- description
- tags
- human review checklist

## Folder Map

```text
media/
  topics/      ranked ideas and experiment-to-video mappings
  scripts/     drafted narration scripts and subtitles
  shorts/      Short packages
  longform/    Story episode packages
  papers/      paper intake and research packages
  generated/   generated assets or local render outputs; review before tracking
  uploads/     upload packages only; no automatic publishing
```

## Agents

Agent contracts live in [agents.md](agents.md).

The playtest-note scout role lives in [watcher.md](watcher.md). Its inbox is
[topics/watcher-inbox.md](topics/watcher-inbox.md).

The first v1 implementation is markdown/JSON-first. It should stay readable,
diffable, and easy to review before any code automation is added.

## Evidence Boundary

Underworld reports may show sample-pending, weak continuity, or failed cases.
Those are useful media material, but they must not be rewritten into stronger
claims.

Allowed:
- "The world got stuck."
- "The characters repeated a motif."
- "This suggests memory is not enough."
- "The current evidence is sample-pending."

Not allowed:
- "AI society has emerged."
- "The agents proved friendship."
- "The system validated emotional memory."
- "The paper proves Underworld works."

## First v1 Goal

For every meaningful Underworld experiment, create:

1. One Short candidate.
2. One Story Episode candidate.
3. One Research Episode candidate.

The output can be a package, not necessarily a rendered video.

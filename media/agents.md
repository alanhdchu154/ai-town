# Underworld Media Agents

All agents are package generators, not publishers.

They read evidence and write reviewable drafts under `media/`. They must not
mutate Convex, change prompts, write memories, restart the world, or upload to
YouTube.

## MysteryDetector

Input:
- existing Underworld reports and watcher notes
- memory anomalies
- repeated behavior
- relationship/trust shifts
- social loop stagnation
- conflict or misunderstanding emergence
- surprising character consistency
- bugs that create interesting personality-like behavior

Read first:
- `WORKLOG.md`
- `media/topics/watcher-inbox.md`
- `docs/giis-v0.1-roadmap.md`
- `evals/conversations/reports/latest.md`
- `umi/reports/life-signals-latest.md`
- `umi/reports/rolling-continuity-latest.md`
- `umi/reports/v01-completion-audit-latest.md`

Output:
- ranked StoryCandidates
- evidence links
- public-safe summary
- mystery angle
- recommended action

Rule:
This is the first priority. Do not generate scripts, assets, or upload packages
until the strongest StoryCandidate is clear.

## StoryCandidateGenerator

Input:
- MysteryDetector output
- current style ledger
- channel-manager notes

Output:
- exactly 3 Short ideas
- exactly 1 longer video idea
- one selected item for the run

Rule:
Quality over quantity. One selected item per run.

## Research Agent

Input:
- paper links, PDFs, DOI, or titles
- Underworld implementation notes
- relevant experiments and reports

Output:
- research package
- paper claims
- Underworld connection
- references
- limitations
- "what this does not prove" section

## Script Agent

Input:
- selected topic package
- research package if applicable
- evidence constraints

Output:
- Shorts script or long-form script
- subtitle text
- chapter structure for long-form
- narration notes

Rule:
No generic AI hype. Script from observed behavior, failure, or constraint.

## Asset Agent

Input:
- script
- source project
- evidence screenshots or report excerpts

Output:
- image prompts
- thumbnail prompt
- visual suggestions
- B-roll / screen capture suggestions
- asset risk notes

Rule:
Visuals should support the field-note claim. They must not fake evidence.

## Upload Agent

Input:
- final reviewed script
- asset notes
- source references

Output:
- title
- description
- tags
- category
- attribution text
- privacy recommendation
- human review checklist

Rule:
Prepare upload package only. Do not upload or change video privacy.

Upload Agent is not part of MysteryDetector v1 and should not be built before
story discovery is working.

## Human Review Gate

Before upload:
- Alan or Umi explicitly approves the package.
- Claims match evidence.
- Private data and secrets are absent.
- Captions are readable.
- The source project and paper references are credited.
- Upload privacy is explicit.

Public release requires the active Field Notes release gate and a recorded
release decision.

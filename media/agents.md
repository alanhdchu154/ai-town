# Underworld Media Agents

All agents are package generators, not publishers.

They read evidence and write reviewable drafts under `media/`. They must not
mutate Convex, change prompts, write memories, restart the world, or upload to
YouTube.

## Topic Agent

Input:
- current Underworld status
- existing logs
- recent experiments
- latest reports

Read first:
- `WORKLOG.md`
- `docs/giis-v0.1-roadmap.md`
- `evals/conversations/reports/latest.md`
- `umi/reports/life-signals-latest.md`
- `umi/reports/rolling-continuity-latest.md`
- `umi/reports/v01-completion-audit-latest.md`

Output:
- ranked video ideas
- category recommendation: Short, Story Episode, Research Episode
- evidence source paths
- claim risk: low / medium / high
- next package path

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

## Human Review Gate

Before upload:
- Alan or Umi explicitly approves the package.
- Claims match evidence.
- Private data and secrets are absent.
- Captions are readable.
- The source project and paper references are credited.
- Upload privacy is explicit.

Public release requires explicit Alan approval in the current conversation.

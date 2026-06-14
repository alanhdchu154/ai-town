# CC Workload - Underworld v0.1 Continuity Lanes Review

Time anchor: 2026-06-13 12:10 CDT
Repo cwd: /Users/alanhdchu/ai-town
Mode: Split-work, read-only architecture/product review.
Model target: opus.

Goal:
Review Alan's proposed three continuity lanes and recommend how to arrange them
without expanding GIIS Underworld beyond v0.1.

Alan's proposed lanes:
1. Character-to-character conversation creates subjective interpretation,
   affects later development, and may gradually affect relationship tendency.
2. Alan-to-character conversation creates that character's subjective
   interpretation and later change. Example: Alan tells a character "I like
   you"; the character reacts through their soul depth and carries a trace.
3. Character soul causes small world events. Example: Tianze's 小惡魔 tendency
   causes a vending-machine incident; the day has a shared topic, and others
   react subjectively to that event.

Current v0.1 state:
- Current pilot roster: 海 / 真晝 / 貓貓 / 天澤 / 一之瀨 / 祥子.
- Experience logs require non-empty `llm_soul` residue.
- ExperienceLog `eventSummary` should be owner-perspective, starting with
  `對某某來說...`.
- Ordinary memory can exist as `記住的片段` / `記住的是`, but is not v0.1
  evidence by itself.
- Sleep promotion rejects objective-shaped experienceLogs.
- Observe reports subjective vs non-subjective experienceLog counts.
- Sleep consolidation demotes ordinary `記住的片段` candidates to short-term
  context with `ordinary_memory_fragment_not_residue`.
- Current dry-run evidence: 24 existing experienceLogs are non-subjective /
  legacy, 0 subjective eligible, fresh sample count below 3.

Read first:
- WORKLOG.md
- docs/giis-v0.1-roadmap.md
- convex/agent/conversation.ts
- convex/agent/memory.ts
- convex/agent/experienceLog.ts
- scripts/underworld-observe-once.mjs
- scripts/underworld-experience-sleep-promote.mjs
- scripts/underworld-sleep-consolidation.mjs

Review questions:
1. Which of the three lanes should be v0.1 core, which should be v0.1 shadow /
   dry-run, and which should wait for v0.2?
2. Does lane 3 require a new event system, or can it be represented for now as
   a bounded daily campus incident seed / scenario topic without new schema?
3. What is the smallest safe implementation path that lets us start collecting
   data for lanes 1 and 2 immediately?
4. How should reports distinguish:
   - character-to-character residue;
   - Alan-to-character residue;
   - shared campus incident context;
   - relationship tendency evidence;
   - behavior change evidence?
5. What must NOT be implemented yet because it risks DB growth, prompt bloat,
   false continuity, or scope creep?

Constraints:
- Read-only review only. Do not edit files.
- Do not add new characters, factions, lore, large relationship graphs, or
  major schema.
- Do not treat old logs as fresh v0.1 evidence.
- Keep v0.1 proof focused on conversation -> subjective residue -> bounded
  experienceLog -> sleep/tomorrow -> small behavior change.
- Lane 3 must stay small and school-life grounded if accepted at all.

Expected output:
- Findings first, ordered by severity.
- Recommended lane assignment: v0.1 core / v0.1 shadow / v0.2.
- Minimal code changes needed, if any.
- Data-collection plan for the next 24 hours.
- Risks and stop conditions.

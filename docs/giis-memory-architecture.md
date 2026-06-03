# GIIS Underworld Memory Architecture

Status: v0.1 foundation, not a full storage refactor.

## Principle

Characters should not remember everything the same way.

- Objective profile: relatively stable facts about who someone is.
- Daily experience: what happened today or recently.
- Long-term candidate: an experience that may change future behavior.
- Long-term insight: a promoted pattern that shapes identity, trust, fear, or relationships.

This lets characters grow without turning every lunch conversation into permanent lore.

## Current v0.1 Implementation

For now, the existing Convex memory table remains the source of truth.

When a conversation is archived, the memory layer now classifies the summary as:

- `今日經歷`: useful short-term context, not a permanent trait.
- `長期候選`: possibly important because it touches trust, fear, decisions, identity, or relationship movement.
- `長期洞察`: produced later by reflection after enough meaningful memories accumulate.

Reflection should only promote patterns that change:

- relationship stance
- self-understanding
- repeated concern
- trust or distance
- future behavior

Ordinary events stay ordinary unless they repeat or carry emotional consequence.

## Promotion Rule

A daily experience can become a long-term candidate when it includes:

- strong emotion or vulnerability
- a concrete decision
- a relationship shift
- a repeated worry
- a change in behavior
- a meaningful Alan interaction
- a world-level consequence

Examples:

- `真晝開始覺得 Alan 會把所有人的疲憊扛在自己身上。`
- `曹操不再只把 Alan 視為混亂源，而開始觀察他是否願意負責秩序。`
- `海發現自己越來越擔心 Alan 不肯休息。`

Non-examples:

- `今天午餐很安靜。`
- `一之瀨看著窗外。`
- `劉備去了中央庭院。`

Those can stay as daily texture unless they repeat or later become meaningful.

## v0.2+ Pending Work

Do not do this before v0.1 unless current memory quality becomes the main blocker.

- Add explicit memory tables or fields for `biography`, `daily_experience`, `long_term_candidate`, and `long_term`.
- Add per-character memory inspection tools.
- Add memory compaction so old daily memories can become summaries.
- Add manual world hygiene tools for stale profiles and legacy noisy memories.
- Consider file-backed character profile snapshots for review/export, while keeping runtime memory in Convex.

## Why Not Split Into Files Yet

Per-character memory files will be useful later for review, editing, and backups.

But for v0.1, a full storage split risks:

- breaking existing retrieval
- losing old world context
- creating migration bugs
- slowing down conversation QA

The current approach gives us the useful part now: characters begin separating daily texture from deeper memories.

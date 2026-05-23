# GIIS Underworld Soul Systems Revisit Plan

Status: staged audit + pilot rollout plan.
Last updated: 2026-05-22.

## Goal

Do not optimize for more dialogue. Optimize for characters remembering, noticing, and changing slightly over time.

v0.1 success means Alan returns and feels: yesterday mattered, and today Umi/Mahiru are not exactly the same.

This plan is intentionally conservative:

- Do not blindly turn systems on.
- Do not add large new systems.
- Do not expand beyond Umi/Mahiru until the pilot produces clean multi-turn samples.
- Do not let deterministic fallback lines become archived dialogue.

## Current Fresh Sample

Fresh post-change samples before the abort fix showed a new failure mode:

- `conversation-c:37691` through `conversation-c:37817`
- Status: FAIL
- Shape: 1-message archived conversations
- Root cause confirmed from live logs: Gemini pilot returned HTTP 429, so the start message fell back to deterministic `[LEAVE]`.

Representative lines:

```text
真晝: 先到這裡吧。我想去看看今天一直安靜的學生。
海: 這段先停在這裡。我會提醒 Alan 先看見學生的不安，再談下一個功能。
```

These are not soul-depth samples. They are provider-rate-limit collapse samples.

Accepted targeted fix:

- Pilot start fallback now returns `[ABORT_CONVERSATION]` instead of an archived deterministic exit line.
- `agentAbortConversation` clears the operation and leaves the conversation without inserting a message.
- 0-message conversations are not archived.
- Pre-fix 1-message Umi/Mahiru deterministic exit archives are skipped by `rememberConversation`, so they do not create fake memory, embeddings, or conversationOutcome events.
- Historical Umi/Mahiru fallback pollution was audited and cleaned from archived conversations, messages, participatedTogether edges, agent memories, memory embeddings, conversationOutcome world events, fallback-triggered notifications, and profile memory/intentions via `school:auditUmiMahiruFallbackPollution` and `school:cleanupUmiMahiruFallbackPollution`.
- Eval now marks one-message exit samples as `degenerateExit`.

## Soul Systems Inventory

| Area | Current system | Status | Soul value | Risk |
|---|---|---|---|---|
| Emotion | `schoolProfiles.currentEmotion`, `updateEmotionByName`, pressure-driven emotion changes | Active, coarse | Lets characters visibly become worried/serious/smiling | Low cost, but notifications can spam if over-triggered |
| Relationship | `schoolRelationships` with trust/respect/affection/fear/influence plus concern/closeness/tension | Active, partially wired | Gives pair-specific stance and drift | DB notification growth if unthrottled |
| Memory: profile | `shortTermMemory`, `longTermMemory`, `beliefs`, `shortTermIntentions` | Active, bounded arrays | Safest current memory source | Low risk; not fully wired into Umi/Mahiru prompt yet |
| Memory: vector | `memories`, `memoryEmbeddings`, `rememberConversation` | Degraded | Could support recall later | Deterministic embeddings are cheap but semantically weak; row growth per archived conversation |
| Memory: reflection | reflection / long-term insight promotion | Disabled/degraded | Would create deeper identity drift | Keep off; local LLM timeout risk |
| Behavior | availability, sleep/rest, quiet state, activity, leaving, initiating | Active | Makes emotion change action/silence/availability | Low risk if derived; high risk if every tick writes |
| Conversation | lifecycle, emotional binding, anti-repeat, companion mode, pilot pair mode, fallback/exit logic | Active but pilot unstable | Core visible soul layer | Provider 429 and fallback archive pollution |
| World rhythm | day/night cycle, Umi briefing, world pressure, campus mood, daily consolidation | Active | Makes yesterday matter tomorrow | Mostly bounded; daily consolidation must stay once/day |

## Disabled Or Degraded Systems

| System | Current status | Why reduced | Re-enable now? |
|---|---|---|---|
| Global autonomous NPC LLM | Disabled | Timeout/stampede | No |
| Non-pilot NPC pair LLM | Disabled/deterministic | Timeout/cost | No |
| Memory LLM summarization | Degraded/deterministic | Timeout | Not yet |
| Embeddings | Degraded/deterministic | Timeout | Not for semantic recall yet |
| Reflection LLM | Disabled | Timeout/DB growth risk | No |
| Schedule movement hard mode | Opt-in | Pathfinding churn | No |
| Umi/Mahiru deterministic fallback archive | Being repaired | Fallback loop and 429 collapse | Stop archiving fallback first |

## Rollout Tiers

### Tier 1: Safe To Enable Now

Low cost, high soul impact.

- Keep availability/rest/sleep/quiet state visible.
- Keep currentEmotion active.
- Keep daily profile memory arrays capped.
- Wire existing bounded `schoolProfiles` state into the Umi/Mahiru prompt:
  - top 1-2 short-term memories;
  - currentEmotion;
  - one shortTermIntention if present.
- Keep eval honesty:
  - `degenerateExit`;
  - `private_self_score`;
  - `role_escape_penalty`;
  - `over_system_penalty`.

### Tier 2: Enable With Throttling

Useful, but only after Umi/Mahiru has clean multi-turn samples.

- Live relationship dimensions in Umi/Mahiru prompt.
- Relationship drift after meaningful pilot conversations only.
- Emotion update after meaningful pilot conversations only.
- Daily memory consolidation as once/day or manual, never per conversation loop.
- Memory summarization only in batch or with explicit rate limit.

### Tier 3: Keep Disabled For Now

Too risky until performance and DB write patterns are stable.

- Global all-character autonomous LLM.
- All-character relationship drift every tick.
- Every-turn memory summarization.
- Reflection LLM.
- Full semantic embeddings on the local slow path.
- New schema-heavy soul systems.

## Recommended Re-enable Order

1. Stop fallback archive pollution.
2. Confirm fresh sample no longer creates one-message archived conversations.
3. Improve eval labels only, not thresholds.
4. Wire bounded profile state into Umi/Mahiru prompt.
5. Wait for a fresh 3+ message real LLM sample.
6. Only then consider live relationship context and throttled emotion/memory writes.

## Umi/Mahiru Pilot Plan

Acceptance gate for any future soul-system change:

- Fresh post-change sample exists.
- At least 3 messages.
- `degenerateExit=no`.
- `fallbackDominated=no`.
- No deterministic template markers.
- Mahiru notices Umi specifically.
- Umi reveals responsibility/fatigue indirectly or becomes quieter.
- The conversation leaves memory residue or behavior signal.

Current target pattern:

```text
Event: Umi spends the morning preparing Alan's briefing.
Mahiru interpretation: Umi is taking care of everyone except herself.
Mahiru behavior: approaches Umi quietly and asks if she rested.
Umi response: deflects into usefulness, then becomes quieter.
Memory residue: Mahiru remembers Umi looked tired; Umi remembers Mahiru noticed her first.
```

## Eval Changes Needed

Already added or improved:

- `other_awareness_score`
- `private_self_score`
- `memory_residue_score`
- `behavior_signal_score`
- `role_escape_penalty`
- `over_system_penalty`
- `degenerateExit`

Still needed later:

- Separate "true LLM evidence" from "not a known template" if provider logs are available.
- Add sample age/boundary labeling so pre-fix failures cannot be confused with current failures.
- Add a golden Umi/Mahiru target fixture once a good real sample appears.

## Performance Guardrails

Before enabling any soul write path:

- Confirm writes are bounded.
- Prefer patch/update over append-only documents.
- Cap memory residue entries.
- Rate-limit relationship and emotion notifications.
- Do not write memory/relationship outcomes for degenerate conversations.
- Log write counts when adding a new writer.

No soul system should write thousands of documents overnight.

## What Not To Turn On Yet

- Global all-NPC LLM.
- More LLM pairs.
- Reflection LLM.
- Full local semantic embeddings.
- Every-turn memory summarization.
- High-frequency relationship drift.
- New schema-heavy soul system.
- Major UI systems, lore, factions, worlds, or characters.

## Joint Recommendation

Codex and CC agree on the direction:

- The existing soul systems are not mostly absent; many are already active or partially active.
- The immediate blocker is not "turn more on." It is that the pilot conversation collapsed under Gemini 429 and archived deterministic exits.
- The safest next move is to stop fallback archive pollution, then use fresh samples to decide whether to wire bounded profile memory into Umi/Mahiru prompts.

Next action:

Wait for a fresh post-abort-fix Umi/Mahiru sample. If no new real sample appears, report `sample pending`; do not tune memory or relationship systems yet.

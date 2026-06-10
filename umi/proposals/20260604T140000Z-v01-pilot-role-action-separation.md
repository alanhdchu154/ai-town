# Underworld v0.1 Pilot Role-Action Separation Proposal

## Problem

The latest 2026-06-04 morning evidence shows the pilot trio can produce
grounded, memory-bearing conversations, but their actions are starting to
collapse into the same care style.

The v0.1 goal is not just "characters sound warm." It needs the pilot trio to
change the world in different ways:

- Umi / 海 reduces overload.
- Mahiru / 真晝 stays near and notices quiet pain.
- Tianze / 天澤 pressure-tests a weak rule, then stops before harm.

The current failure is that these roles are partly present in voice, but the
behavioral move often converges on presence/care. That makes the world feel
safer, but less differentiated.

## Current Evidence

Generated from the 2026-06-04 08:55 CDT read-only refresh:

```bash
npm run underworld:observe -- --cc=skip --collect=skip --target-samples=0 --since-created-at=1780578800000
npm run underworld:repair-gate -- --cc=skip
npm run underworld:rubric-reconcile
npm run underworld:v01-completion-audit
```

Latest trusted status:

- Completion audit: `FAIL`, 3 fail / 2 pending / 3 pass.
- Fresh triad samples: 4.
- Soul eval: 3 PASS / 1 WARN / 0 FAIL.
- Recent eval: 0 PASS / 3 WARN / 1 FAIL.
- AM->PM continuity: `WARN / sample_pending`, morning 4, afternoon 0.
- AM residue candidates: 14.
- Life signals: `WARN / pilot_role_action_collapse`.
- Pilot expected action match rate: 0.63.
- Pilot action collapse flags: 2.
- Repair gate: `pilot_role_action_collapse`, `proposal_only`, `observe_only`.
- Rubric reconciliation: BLOCKED by life-signals WARN and AM->PM sample-pending.
- Fallback markers: 0.
- Active fallback pollution: 0.

Representative collapse evidence from `umi/reports/life-signals-latest.md`:

- `conversation-c:91021` · 海 / 天澤:
  - 海 is scored as `presence` but expected `reduce_overload`.
  - 天澤 is scored as `presence` but expected `pressure_test`.
  - The scene is grounded and caring, but both sides orbit quiet presence and food.
- `conversation-c:91005` · 海 / 天澤:
  - 海 is scored as `pressure_test` but expected `reduce_overload`.
  - 天澤 is correctly pressure-testing, but 海 also moves into a similar pressure lane.

The issue is not fallback, provider failure, stage-direction leak, or DB
cleanup. It is a product/soul-shape issue.

## Interpretation

This is a v0.1 blocker, but not a safe auto-fix.

The samples have life:

- ordinary scenes exist,
- residue exists,
- dialogue is not fallback-contaminated,
- Tianze has pressure-test language,
- Umi can perform concrete care.

The regression is more subtle: role-action routing is too loose. The prompt
already contains the intended roles, but fresh outputs show characters choosing
overlapping moves under emotional pressure.

This should not be solved by a broad prompt rewrite. A broad rewrite risks
flattening the trio into explicit instruction-following and losing the ordinary
texture that made the morning samples useful.

## Proposed Fix Shape

Do not implement this until Alan/product-owner approves or fresh afternoon
evidence repeats the same blocker strongly enough for a narrow fix.

Preferred implementation shape if approved:

1. Add a narrow role-action guard near existing conversation guidance.
   - It should bias the next move, not ban wording.
   - It should activate only for the pilot scope or existing role-action eval
     path, not every character in the world.

2. Define the move as a concrete action, not a tone.
   - Umi: reduce one source of overload, shorten a queue, remove one decision,
     name the one next thing, or create a "not now" boundary.
   - Mahiru: notice a quiet physical/emotional signal, stay nearby, lower the
     ask, leave space, or protect silence.
   - Tianze: ask one pressure-test question, expose a weak rule, force a concrete
     owner/deadline/refusal, then stop before the tease becomes harm.

3. Add a pair-aware anti-collapse hint.
   - If the previous line already provides quiet care, Umi should not answer
     with another quiet-care move; she should reduce overload.
   - If Umi already reduces overload, Tianze should not just care back; she
     should test the rule or boundary underneath it.
   - If Mahiru is present, do not turn her into checklist execution.

4. Keep this out of memory/schema architecture.
   - No new memory fields.
   - No relationship schema changes.
   - No provider/model migration.
   - No broad character expansion.

## Expected Gain

If the narrow role-action guard works, fresh v0.1 samples should still feel
ordinary and warm, but the trio should create different consequences:

- Umi makes Alan/the scene lighter by removing or narrowing responsibility.
- Mahiru changes the scene by staying near quiet pain instead of solving it.
- Tianze changes the scene by testing the rule and stopping at a boundary.

This should improve:

- `pilot expected action match rate`,
- `pilot action collapse flags`,
- `character_soul_expression`,
- `event_thread_continuity`,
- Alan's subjective sense that characters are distinct under the same emotional
  pressure.

## Acceptance Criteria

Before any implementation:

- Confirm whether the afternoon 13:00-16:59 CDT evidence repeats
  `pilot_role_action_collapse`.
- Preserve the night quiet policy.
- Keep fallback markers at 0.
- Keep provider/runtime health ok.

After an approved narrow fix, run:

```bash
npm run underworld:harness:self-test
npm run underworld:observe -- --cc=skip --target-samples=3 --sample-timeout-ms=240000
npm run underworld:repair-gate -- --cc=skip
npm run underworld:rubric-reconcile
npm run underworld:v01-completion-audit
```

Expected direction:

- Fresh triad samples >= 3.
- Life signals are not `WARN / pilot_role_action_collapse`.
- Pilot expected action match rate improves above the current 0.63.
- Pilot action collapse flags drop below the current 2/4 sample pattern.
- Soul eval does not regress to FAIL.
- Fallback markers remain 0.
- No stage-direction leak appears.

v0.1 still cannot complete from this alone. Completion also requires:

- AM->PM continuity PASS with enough afternoon samples,
- Alan-facing Umi playtest result or explicit deferral,
- final repair/rubric/completion audit pass.

## Risks

- Over-specifying roles could make dialogue feel like it is obeying a rubric
  instead of living.
- Umi could become too utilitarian and lose warmth.
- Mahiru could become too passive if "stay near" is interpreted as no action.
- Tianze could become too aggressive if "pressure-test" is not bounded by
  stopping before harm.
- A prompt change may improve role-action metrics while reducing aftertaste.

## Rollback

- Revert only the role-action guard.
- Re-run the same observe/repair/rubric/completion sequence from a fresh
  boundary.
- If warmth, residue, or AM->PM continuity regresses, prefer the current
  ordinary-life texture and return to proposal review.

## Files Likely Touched

- `convex/agent/conversation.ts`
- possibly `convex/agent/conversationMotifGuard.test.ts`
- possibly `scripts/underworld-life-signals.mjs` only if the eval vocabulary
  proves wrong on hand review
- `WORKLOG.md`

## Decision Needed

Pending Alan/product-owner review.

Do not implement this proposal automatically. The next safe action is to wait
for the afternoon evidence window and see whether the role-action collapse
repeats across more fresh samples, then decide whether a narrow role-action
guard is worth the soul-regression risk.

# GIIS Underworld v0.1 Roadmap

Last updated: 2026-05-26 (UI pass + portrait fix + backend audit follow-ups)

## 2026-05-26 UI Pass + Portrait Fix + Backend Audit Follow-Ups

Long session. Three streams of work, four UI commits, one portrait
regression fix, two backend hardening fixes pulled from a fresh audit.

### UI work (player walkthrough → ship)

Goal: cut visible friction for players who pick up the project without
context. Findings came from a deliberate "play as Alan, what feels
broken?" review.

Done:

- [10ffb58] **Left column 海 / 今日 / 日程 in one pill row.**
  Used to stack vertically and eat vertical space; now a horizontal
  `.giis-left-pill-row` with the expanded panel rendering below.
  Also dropped the "聚焦 Alan" mini-button (the camera already
  auto-follows Alan on every position change, so it was redundant).

- [727e575] **Sharper presence button + bottom-bar de-duplication.**
  `進入校園 / 暫離校園` reframed as `接手 Alan / 放開 Alan` — the
  button is about player control, not Alan's geography (he is
  visible in the world either way). Filled-accent style when the
  player is in control so the toggle state is visible at a glance.
  Bottom-bar status no longer repeats the topbar's time + view scene;
  it now only surfaces "Alan 目前在：X" when Alan's location differs
  from the current view.

- [ec47ce2] **Character pills 6 → 3 + focus card popup.**
  Trimmed the bottom character row from
  `聊聊 / 關心 / 問傳聞 / 送禮 / 留訊息 / 邀請` to the three highest-
  traffic actions (`聊聊 / 關心 / 邀請`); the other three moved under
  the existing 更多互動 ghost button. The `.giis-focus-card` that
  appears in the bottom-right on character selection now carries
  action buttons (`說話 / 看資料`, or `前往 X / 看資料` when the
  target is in a different scene) plus a close button, collapsing
  the prior 3-click "select → drawer → 角色 tab → 開始說話" trap.

- [5800bb9] **Period glyph + scene-switch as action + smart dialogue
  tab + denser thread cards.**
  Topbar shows a day/night glyph (🌅 / ☀️ / 🌆 / 🌙). Scene dropdown
  reframed with an `→` arrow so it stops competing with the bold
  title for the same scene name. Right-drawer dialogue tab now lands
  on `歷史對話` when there is no active conversation (so the user sees
  content, not empty state) and auto-promotes to `目前對話` only on
  the transition from absent → present; orange dot badge on
  `目前對話` when an active conversation exists but the user is on a
  different tab. Thread cards in history lost two lines of redundant
  text (summary no longer repeats participants, footer collapsed to
  turn count).

### Portrait regression fix

- [7d1a733] **portrait paths now include `/ai-town` base prefix.**
  Root cause: `vite.config.ts` sets `base: '/ai-town'`, so any
  absolute asset URL referenced from React must include that
  prefix. `data/characters.ts` already does this for sprites
  (`/ai-town/assets/...`), but `data/characterVisuals.ts` was
  emitting `/portraits/<slug>.png` — Vite returns 404 → the
  CharacterPortrait component walks portraitPaths candidates,
  every one fails, falls back to the silhouette/eye/mouth SVG.
  Looked like "characters broken." Extracted `PORTRAIT_BASE`
  constant + comment so the next portrait add does not regress
  again.

### Backend audit follow-ups (this commit)

A parallel agent audit flagged three critical concerns. Two were
already addressed by tonight's earlier hardening; one was not:

- **`memoryContinuityScore` in `conversation_metrics.ts:403` had the
  same self-fulfilling pattern** I fixed in `runSoulTriadEval` last
  commit. The metric was crediting `concreteHits >= 2` on its own
  (0.68), but those concrete cues (Alan / 簡報 / 杯子 / 清單 / ...)
  are exactly the vocabulary the residue writer plants in memory.
  Updated to require both a temporal callback marker AND a concrete
  cue, plus the `(?:海|真晝|明日奈)還記得` residue-template parrot
  penalty (0.3).

- **`getReflectionMemories` now bounded.** `args.numberOfItems` was
  passed directly to `.take(...)` without a cap. Real caller passes
  100; clamped to `[1, 200]` defensively.

### Backend Codex Handoffs (pickable in any order unless dep noted)

Each item below is sized for an independent Codex commit. They are
infrastructure / contract fixes, NOT behavior tuning, so the
fresh-sample rule does not block them. Take them in any order; #4
depends on #1.

---

#### Codex-B1 · Pilot-pair registry (high value, ~45 min)

**Problem.** Pilot-pair detection is split across two incompatible
checks. [convex/aiTown/agent.ts:126-130](convex/aiTown/agent.ts#L126-L130)
`isUmiMahiruPilotConversation` hardcodes `p:0` / `p:707`, but
[convex/agent/conversation.ts](convex/agent/conversation.ts)
`characterSoulPilotPair` uses display names + env flags. If the world
is reseeded, player IDs shift, or a new pilot pair is added, the two
checks drift silently — conversations route as non-pilot, hit
deterministic lifecycle exits, then memory writes skip residue.

**Files.**
- create `convex/agent/pilotRegistry.ts`
- update `convex/aiTown/agent.ts` (`isUmiMahiruPilotConversation`, `isSoulTriadName`, `soulTriadFocusPairNames`)
- update `convex/agent/conversation.ts` (`characterSoulPilotPair`)
- update `convex/agent/memory.ts` (`RESIDUE_PILOT_NAMES` at L44 → consume registry)
- update `convex/modelPolicy.ts` (`shouldPersistCharacterSoulTranscript` `isPilotPair` check at L191-194 → consume registry)

**Fix shape.**
```ts
// convex/agent/pilotRegistry.ts
export const PILOT_PAIRS = [
  { displayNames: ['Umi', 'Mahiru Shiina'] as const, playerIds: ['p:0', 'p:707'] as const, envGate: 'UMI_MAHIRU_COLOCATION_PILOT' },
  { displayNames: ['Umi', 'Asuna'] as const, playerIds: ['p:0', 'p:???'] as const, envGate: 'SOUL_TRIAD_COLOCATION_PILOT' },
  // ...
];
export function isPilotPairByName(a?: string, b?: string): boolean;
export function isPilotPairById(a: GameId<'players'>, b: GameId<'players'>): boolean;
export function pilotPilotNames(): ReadonlySet<string>; // for RESIDUE_PILOT_NAMES
```

**Acceptance.**
- `npm test` PASS (modelPolicy tests still green).
- `npx tsc --noEmit` PASS.
- Grep for `p:0` / `p:707` / `'Umi'` literal checks across `convex/` returns only the registry file.
- One soul-triad sample run still produces an archived conversation with residue (existing `pilot:soul-triad:single-sample` script).

**Subsumes.** Codex-B4.

---

#### Codex-B2 · Split `isGeneratedFallbackText` (~30 min)

**Problem.** [convex/modelPolicy.ts:189-211](convex/modelPolicy.ts#L189-L211)
mixes two detection modes:
- System abort markers (`[ABORT_CONVERSATION]`, `[LEAVE]`, `pilot LLM unavailable`, `pilot repair fallback`) — always wrong, always block.
- Deterministic-template Chinese phrases (`但這次我想先說清楚`, `今天先挑一件不要接的事`, `這段我先不寫進待辦`, ...) — only wrong when emitted by the deterministic fallback path; a model writing legitimate output that happens to overlap is a false positive.

The Asuna golden-line allowlist (commit 90bb19d) is a stop-gap that
swapped overlapping fragments for template-unique signatures, but
the contract is still muddled.

**Files.**
- update `convex/modelPolicy.ts`
- update callers — grep `isGeneratedFallbackText` to find them:
  - `convex/agent/memory.ts` (via `shouldPersistCharacterSoulTranscript`)
  - `convex/agent/conversation.ts` (pilot abort guards)

**Fix shape.**
```ts
// Two functions, one contract each.
export function isSystemAbortMarker(text: string): boolean {
  // [ABORT_CONVERSATION], [LEAVE], pilot LLM unavailable, pilot repair fallback
}
export function isDeterministicTemplatePhrase(text: string): boolean {
  // All the Chinese template signatures
}
// Keep isGeneratedFallbackText as a deprecated wrapper that calls both,
// or remove it and update callers to call both explicitly.
```

**Acceptance.**
- `modelPolicy.test.ts` "blocks generated fallback text from Umi/Mahiru persistence" test still PASS.
- Add one new test case: a synthetic LLM output that contains the Asuna golden line `不是所有事都該默默丟給我` standalone (no template surrounding text) — should NOT be blocked.
- `npx tsc --noEmit` PASS.

**Independent of B1.**

---

#### Codex-B3 · `recentConversationEvalData` N+1 fix (~30 min)

**Problem.** [convex/school.ts:6287+](convex/school.ts#L6287)
`recentConversationEvalData` fetches 40 recent memories per
participant inside the conversation map iteration. For 100 recent
conversations that is up to 4000 memory reads per call. The eval
harness + ConversationWall both consume this query.

**Files.**
- update `convex/school.ts` (`recentConversationEvalData` handler)

**Fix shape.**
```ts
handler: async (ctx, args) => {
  const conversations = await /* existing fetch */;
  // Lift per-participant memory fetch out of the per-conversation loop.
  const memoryCacheByPlayerId = new Map<string, Memory[]>();
  const allParticipants = new Set(conversations.flatMap(c => c.participants));
  for (const playerId of allParticipants) {
    const memories = await ctx.db.query('memories')
      .withIndex('playerId_type', q => q.eq('playerId', playerId).eq('data.type', 'conversation'))
      .order('desc')
      .take(Math.min(args.limit * 4, 80));  // cap, not per-conversation
    memoryCacheByPlayerId.set(playerId, memories);
  }
  // Existing per-conversation logic now reads from the cache.
};
```

**Acceptance.**
- `npm run eval:soul-triad` produces identical report content (verify
  by diffing `evals/conversations/reports/soul-triad-latest.md`
  before/after).
- `npx tsc --noEmit` PASS.
- Convex logs show one memory read per participant per call instead
  of one per (conversation × participant).

**Independent of B1, B2.**

---

#### Codex-B4 · Residue write registry symmetry

**Subsumed by B1.** Once `RESIDUE_PILOT_NAMES` in `memory.ts:44` and
`characterSoulPilotPair` in `conversation.ts` both consume the
registry from B1, this concern resolves automatically. Do not pick up
separately — wait for B1.

---

#### Codex-B5 · `memoryInfluenceScore` design (defer; needs sample data)

**Problem.** Today's `memoryContinuityScore` (in both
`runSoulTriadEval.ts` and `conversation_metrics.ts`) measures
memory-AWARENESS framing — does the LLM say "上次" / "還記得"? —
not memory-DRIVEN behavior — did Mahiru actually linger because she
remembered Umi sounded tired?

**Why deferred.** Designing the influence metric needs corpus data:
3+ fresh post-fix triad samples to see what "behavioral influence"
looks like in practice (silence duration? topic deflection from a
remembered concern? proximity choice?). Picking the regex / heuristic
without samples is guessing.

**Trigger.** Pick this up only after the soul-triad eval has produced
≥ 3 PASS-grade conversations with rich enough behavior signals to
discriminate. Until then this is a research task, not an engineering
task.

---

### Picking order suggestion

1. **B2** (split function) — smallest, unblocks reasoning about
   contract elsewhere. ~30 min.
2. **B3** (N+1) — independent, isolated change. ~30 min.
3. **B1** (pilot registry) — bigger, touches 5 files, but subsumes
   B4. ~45 min.
4. Skip B4, it auto-resolves with B1.
5. **B5** waits for samples.

Total ~ 1 hr 45 min if all done in one Codex session.

### Fresh-sample rule reminder

Still in force. No prompt or memory behavior tuning until at least
3 fresh post-fix triad samples exist. The deferred items above are
infrastructure / contract fixes, not tuning — those can proceed once
prioritized. The `eval:soul-triad` runner now prints a warning when
sample count < 3 to keep this rule visible.

## 2026-05-26 Asuna Golden-Line Allowlist + Audit Follow-Ups

Driver: Self-review of last commit (2fbdfa3) + audit of Codex's
post-commit changes in `convex/agent/conversation.ts`,
`convex/aiTown/agent.ts`, `convex/modelPolicy.ts`,
`evals/conversations/runSoulTriadEval.ts`,
`evals/conversations/metrics/conversation_metrics.ts`, and
`scripts/run-soul-triad-single-sample.mjs`.

Codex's work is sound overall (pilot LLM eligibility realignment, world
heartbeat in single-sample runner, soul-pilot same-pair cooldown
separated from world cooldown, focus-pair single-initiator gate,
lifecycle flow scoring, greeting-boilerplate penalty). One concrete
regression was flagged: Codex's additions to `isGeneratedFallbackText`
included `不是所有事都該默默丟給我` and `你不是工具欄` as substring
matches, but those are also the Asuna golden lines in
`docs/soul/UNDERWORLD_SOUL_ARCHITECTURE.md` and README golden moments.
Substring-matching them would block legitimate model-generated golden
output, not just the deterministic templates they came from.

Done this session:

1. **Asuna golden-line allowlist** — `convex/modelPolicy.ts`
   `isGeneratedFallbackText` now detects the two ambiguous templates
   via phrases that ONLY appear in deterministic-template context:
   `但這次我想先說清楚` (L2736 / L1380 templates) and
   `今天先挑一件不要接的事` (L2677 template). The standalone golden
   lines can now be archived. Other four Codex additions kept as-is
   (they don't conflict with any documented golden line).

2. **Roadmap date corrected** — Previous "Post-Review Hardening Pass"
   entry was dated 2026-05-25; actually shipped 2026-05-26. Fixed.

3. **Bounded `recentSamePairResidues` query** —
   `convex/agent/memory.ts` clamps `args.limit` to `[1, 10]` before
   the 5x overfetch, so a misconfigured caller cannot ask for
   thousands of rows. Only real caller passes `limit=2`.

4. **Fresh-sample warning surfaces filter context** —
   `evals/conversations/runSoulTriadEval.ts`
   `warnIfBelowFreshSampleFloor` now distinguishes
   `total triad samples (no --since-created-at filter)` from
   `fresh samples since <ISO timestamp>`, and prints a tip on how to
   restrict the count to truly fresh post-change samples. Addresses
   the gap that the original warning measured total, not fresh.

5. **Deprecated shell wrappers verified by grep** —
   `umi/COMMAND_REFERENCE.md` now distinguishes "truly orphaned
   (safe to `rm`)" from "still wired via npm alias (remove alias
   first)". Found that `umi/umi_mahiru_soul_depth_30min_loop.sh` is
   still referenced from `package.json` `eval:umi-mahiru:soul-loop`,
   contradicting my prior "Safe to delete" label.

Verification:

- `npx tsc --noEmit --pretty false` PASS.
- `npm test` PASS, 55/55. The existing `modelPolicy.test.ts`
  "blocks generated fallback text from Umi/Mahiru persistence" test
  still passes after the template-signature swap.

Not done:

- Did not actually `rm` any deprecated shell wrapper. The user can do
  that after one more confirmation pass.
- Did not restructure `isGeneratedFallbackText` into separate marker /
  content-phrase functions; chose the minimum-scope template-signature
  swap instead.

## 2026-05-26 Pilot Runner / Provider Safety Hardening

Status: implemented as a harness and provider-safety fix after focused
Umi/Mahiru collection hit local runtime and Qwen availability blockers.

Evidence:

- A focused Umi/Mahiru run timed out with no fresh archived sample.
- Backend logs showed `testing:resume` restarted the engine without refreshing
  `worldStatus.lastViewed`, so the inactive-world cron could stop the engine
  during collection.
- Backend logs also showed Qwen returning HTTP 429 with a
  `model_not_found`/upstream-saturated response. The hard-abort rule correctly
  prevented those failed cloud calls from becoming archived dialogue or memory.
- A prior focused run created duplicate same-pair active conversations after
  resume, consistent with both dyad members initiating at once.

Fix:

- Focused `SOUL_TRIAD_FOCUS_PAIR` runs now use the left side of the dyad as the
  sole initiator. This is limited to focused sample collection and does not
  change normal world behavior.
- `scripts/run-soul-triad-single-sample.mjs` now calls
  `world:heartbeatWorld` during polling so local sample runs keep the default
  world active.
- The runner now sets `UMI_MAHIRU_PILOT_COOLDOWN_FAILURES=1` and a 10-minute
  `UMI_MAHIRU_PILOT_COOLDOWN_MS` during focused QA runs, so one provider failure
  prevents repeated Qwen calls in that collection window.
- Conversation logs now say `Aborting conversation after LLM failure` when the
  cloud character-soul path returns an abort marker, instead of implying a
  deterministic fallback line was persisted.

Decision:

- Provider 429 / quota / model availability is an operational blocker, not a
  dialogue-quality signal.
- If provider is unavailable, report `sample pending / provider unavailable`,
  do not tune prompts, and do not count the run as evidence against v0.1 soul
  quality.
- Keep the hard rule: failed cloud calls must not archive conversation, memory,
  reflection, world event, notification, or profile updates.

## 2026-05-26 Conversation Lifecycle Hygiene

Status: implemented as a small dialogue-hygiene pass after Alan asked whether
conversations should have greetings and endings.

Decision:

- Conversations should have lifecycle shape, not forced greeting scripts.
- Good shape means:
  1. a natural opening reason: why this person speaks now;
  2. a middle turn: something emotional, practical, or remembered changes;
  3. a soft close when long enough: a small boundary, action, silence, refusal,
     or unresolved line.
- Do not force `你好`, `最近過得怎麼樣`, `掰掰`, or `今天先這樣`.
- Short exchanges do not need a full closing. Silence or stopping can be the
  close.

Implementation:

- Deterministic exits now rotate among several character-specific soft-close
  shapes, instead of repeatedly emitting the same Umi / Mahiru / Asuna stock
  tails.
- Recent conversation eval now includes `conversation_lifecycle_flow`. It
  rewards concrete opening reasons and soft closes, and flags customer-service
  greeting/goodbye boilerplate.
- Soul-triad eval now tracks `Lifecycle flow` and `Greeting boilerplate
  penalty`.

Guardrail:

- Do not add a larger prompt mandate yet. If this rule becomes a template, it
  is a regression.
- Tune thresholds only after 3+ fresh post-change samples.

## 2026-05-26 Pilot LLM / Memory Eligibility Alignment

Status: implemented as a v0.1 blocker fix.

Problem:

- Post-lifecycle samples had better soft closes, but `memoryTraces: []`.
- Umi/Asuna produced near-identical archived conversations one minute apart.
- Root cause: soul pilot routing and memory eligibility had drifted apart.
  Conversation generation checked generic autonomous LLM env before
  `characterSoulPilotPair()`, and memory writing used the same generic LLM
  eligibility helper. This let pilot-shaped conversations fall back to
  deterministic dialogue and then skip memory/residue writes.
- Local same-pair cooldown was 30 seconds, too short for high-probability pilot
  sampling.

Fix:

- `conversationEligibleForLLM()` and autonomous generation gating now treat
  `characterSoulPilotPair()` as LLM-eligible.
- Soul pilot same-pair cooldown now uses `SOUL_PILOT_PAIR_COOLDOWN_MS`, default
  10 minutes, instead of the general 30-second local player cooldown.
- Same-conversation duplicate guard now rejects not only exact repeated lines,
  but also near-identical semantic tails with long shared fragments. This keeps
  one character from archiving two versions of the same ending inside the same
  conversation.
- The single-sample runner now sets `SOUL_PILOT_PAIR_COOLDOWN_MS=60000` by
  default, with `--pair-cooldown-ms=` available for overrides. The live pilot
  default remains 10 minutes; this only keeps focused QA samples from timing out
  when the normal cooldown was still active.
- Pilot conversations now hard-abort if the response is a known deterministic
  fallback slogan or if the pilot path tries to use a deterministic lifecycle
  exit before asking the cloud character-soul model. This protects the rule:
  fallback output must not become archived dialogue or memory for the soul
  pilot.
- Recent-conversation eval now treats concrete behavior and attention cues as
  valid implicit emotion. A line can show emotion through a pause, a file, a
  hand, or responsibility avoidance without saying an emotion label directly.

Guardrail:

- This does not enable all autonomous conversations.
- This does not change provider/model.
- Fresh post-change samples are still required before judging quality. Current
  status after the first successful pilot checks: the Qwen pilot can produce
  real Umi/Mahiru/Asuna samples with non-empty `memoryTraces`, but v0.1 is not
  final until at least 3 fresh post-fix samples show stable naturalness,
  continuity, and no fallback contamination.

## 2026-05-26 Post-Review Hardening Pass

Driver: Two parallel agents reviewed the just-shipped Phase 1 residue
loop and the working-tree health. They surfaced one critical eval
self-fulfilling bug, one defensive abort-marker coverage gap, and one
structural "residue becomes new template" risk that matches the
2026-05-22 prompt-mandate failure mode. Alan approved a 🟢 + #3
override scope tonight (override = explicitly allow a memory-behavior
change despite the fresh-sample rule, on the grounds that this is a
preventive structural gate, not a tuning attempt toward observed
samples).

Done this session:

1. **Eval self-fulfill fix.** [evals/conversations/runSoulTriadEval.ts](../evals/conversations/runSoulTriadEval.ts)
   `applyMemoryContinuityScores()` no longer rewards cue-hits alone.
   Continuity now requires BOTH a temporal callback marker (`還記得`,
   `上次`, `那次`, ...) AND ≥1 concrete cue hit. Cue-only matches
   default to neutral 0.5 (vocabulary reuse, not continuity). A new
   anti-parrot rule penalizes residue templates (`(?:海|真晝|明日奈)還記得`)
   appearing verbatim in conversation text, since that means the model
   is reading residue as a script instead of as pressure. Without this
   fix, the residue we wrote yesterday was what made today score
   high — the metric was measuring its own input.

2. **Fresh-sample rule moved into the runtime.** Same file now ends
   with `warnIfBelowFreshSampleFloor()` that prints a large warning
   block when triad sample count < 3, restating the rule. The rule
   used to live only in the roadmap as human discipline.

3. **Defensive abort-marker coverage.** [convex/modelPolicy.ts](../convex/modelPolicy.ts)
   `isGeneratedFallbackText()` now uses `.includes()` instead of
   `.startsWith()` for `[ABORT_CONVERSATION]`, adds `[LEAVE]`, and adds
   `pilot LLM unavailable` / `pilot repair fallback` substrings. Belt
   and suspenders — `shouldPersistCharacterSoulTranscript()` was
   already gating, but mid-text leakage would have slipped past.

4. **Residue repeat-pattern gate (#3 override).** [convex/agent/memory.ts](../convex/agent/memory.ts)
   - `deterministicResidueSentence()` now requires `messages.length ≥ 4`
     before writing residue (`RESIDUE_MIN_MESSAGES`). Short exchanges
     don't earn a trace.
   - New `recentSamePairResidues` internalQuery fetches the last 2
     residues for the same pair.
   - `rememberConversation()` now compares the new residue's
     first-10-char prefix against the last 2 same-pair residues and
     skips the write if all three would share the same opening shape —
     stops the residue line from becoming the next template.

5. **SOUL_TRIAD env knobs documented.** [convex/aiTown/agent.ts](../convex/aiTown/agent.ts)
   gained a 20-line comment block listing every pilot env knob and
   what it gates. [.env.local.example](../.env.local.example) gained a
   commented-out block for the pilot + residue env vars so a new
   developer can discover them.

6. **Command surface consolidated.** New [umi/COMMAND_REFERENCE.md](../umi/COMMAND_REFERENCE.md)
   maps every npm script / shell wrapper / direct convex command to
   what it does and when to use it. Marks the legacy `umi/*_loop.sh`
   wrappers as deprecated candidates.

7. **Documentation index added.** New [docs/INDEX.md](INDEX.md) names
   the authoritative documents and the "where does X go?" rule, so
   the three doc hierarchies (`docs/soul/`, `evals/.../reports/`,
   `umi/proposals/`) stop drifting.

Verification:

- `npx tsc --noEmit --pretty false` PASS (clean).
- `npm test` PASS, 55/55. The existing modelPolicy test
  "blocks generated fallback text from Umi/Mahiru persistence" still
  passes after the `.includes()` / `[LEAVE]` widening.
- Eval and runtime changes are behavior-additive on the safe side:
  every change either tightens a gate, hardens a defensive check, or
  surfaces a warning. Nothing relaxes an existing constraint.

Not done tonight (deliberately deferred):

- **Working-tree split into 3 coherent commits.** Too risky to do
  late-night without per-commit supervision; tomorrow.
- **ConversationWall unit tests.** Lower priority than the eval fix;
  the component is read-only.
- **Residue integration test.** Needs a Convex test-infra decision;
  not a half-asleep choice.

Open questions for the next session:

- After 3+ fresh post-fix triad samples land: does `Memory continuity`
  now move with the conversation's actual feel, or is the anti-parrot
  penalty too aggressive?
- Did the `RESIDUE_MIN_MESSAGES = 4` gate over-filter? Watch
  `evals/conversations/reports/soul-triad-latest.md` for warning-class
  conversations where a short exchange genuinely earned residue.
- Should the repeat-pattern prefix length stay at 10 chars? Too short
  could over-trigger (every Umi line starts `海還記得真晝...`); too long
  could under-trigger (small wording variation slips through).

## 2026-05-26 Emotional Expression MVP

Status: accepted as the current emotion design rule.

Emotion must not become RPG stats, visible meters, or a dashboard. The player
should infer emotion from:

- behavior: shorter replies, staying nearby, avoiding a room, delaying tasks;
- tone: clipped answers, hesitation, softer wording, silence;
- attention: what each character notices or misses;
- relationship tendency: who they approach, avoid, check on, or become more
  honest with.

UI contract:

- Umi briefing is interpretation: who changed today, how, and why.
- Campus dynamics is evidence: what happened today that supports that reading.
- Schedule is availability/context: where people are, whether they can be
  approached, and why that location matters.

Do not make all three surfaces equal dashboards. Umi is the front door; campus
dynamics and schedule are supporting lenses.

Implementation notes:

- Internal `currentEmotion` may still drive portraits and lightweight runtime
  behavior, but player-facing copy should say what changed in behavior, tone,
  attention, or relationship tendency.
- Notifications should avoid direct labels such as `變得擔心`; prefer lines like
  `真晝開始注意誰沒有把話說完`.
- Eval should check `emotion_behavior_link`, `emotion_tone_link`,
  `attention_shift`, `relationship_residue`, and `over_labeling_penalty`.

## 2026-05-26 Life-Emotion Pivot

Status: implemented as a small foregrounding change, not a new system.

Alan reset the product surface again: v0.1 should not foreground politics,
factions, civilization growth, or broad social systems. The current visible loop
should feel like school life:

```text
daily campus moment
-> someone changes emotionally
-> Umi explains who changed, how, and why
-> memory/residue can carry that into tomorrow
```

Implementation notes:

- Existing physical scene IDs stay the same to avoid map/pathfinding churn.
- `aiClubRoom` is displayed as `餐廳`; `studentCouncilRoom` is displayed as
  `校長室`.
- `校長室` is Umi's authority space: Umi may work there and invite pilot
  characters there for a private talk, but other characters should not be
  scheduled there alone.
- Each scene now has a small `moodEvents` palette, such as bad exams, cheating
  being discovered, overheard secrets, lunch embarrassment, quiet apologies, or
  dorm lights staying on too late.
- Campus dynamics should show today's items only.
- Umi briefing copy should prioritize emotional changes, not political risk.
- Low-value camera buttons were removed except `聚焦 Alan`, which remains as a
  useful navigation anchor.

Do not add a mood-event engine yet. Scene mood events are a bounded string
library for the existing briefing/feed path.

## 2026-05-26 Phase 1 Implementation: Residue Write / Read / Eval

Status: implemented as the first runnable slice of the v0.1 emotional
continuity loop.

Scope:

- Pilot only: Umi / Mahiru / Asuna.
- No schema migration.
- No numeric emotion meters.
- No behavior drift engine yet.
- No all-character rollout.

Runtime contract:

1. Conversation -> emotional residue
   - `convex/agent/memory.ts` now appends at most one short `殘留：...` line
     to qualified pilot conversation memories.
   - Existing LLM eligibility, fallback, sanitizer, and degenerate transcript
     guards still run before memory is written.
   - Residue write can be disabled with `UNDERWORLD_RESIDUE_WRITE=false`.

2. Emotional residue -> prompt memory continuity
   - `convex/agent/conversation.ts` now fetches up to 2 recent same-pair
     residue memories for the current speaker.
   - The pilot prompt receives them as emotional pressure, not as text to quote.
   - Residue read can be disabled with `UNDERWORLD_RESIDUE_READ=false`.

3. Evaluation
   - `eval:soul-triad` now reports `Memory continuity` across recent same-pair
     samples.
   - `eval:conversation:recent` now includes guardrails for memory continuity
     cues and rejects raw numeric emotion-meter language.

### Memory Residual Definition

For v0.1, a memory residual is not an eval label and not a UI interpretation.
It is one short Traditional Chinese line stored in `memories.description` after
the literal prefix `殘留：`.

A conversation may create memory residual only when all of these are true:

- the conversation is LLM-eligible: Alan is involved, or the pair is explicitly
  enabled as a cloud-LLM pilot pair;
- the transcript is not fallback, provider-error, timeout, smoke-test,
  deterministic-only, or degenerate pilot exit output;
- the residue writer is enabled with `UNDERWORLD_RESIDUE_WRITE` not set to
  `false`;
- the pair is within the current pilot scope: Umi / Mahiru / Asuna;
- the residue line is short, non-slogan-like, and grounded in the conversation.
- the conversation has enough semantic resonance with the characters: at least
  one concrete life cue plus one character-soul cue from Umi / Mahiru / Asuna.
  This is a deterministic gate, not another LLM judge.

Why not an LLM judge in the residue write path yet:

- residue is persistence, not display. If the judge is slow, expensive, down, or
  inconsistent, it can contaminate tomorrow's prompts;
- the same cloud quota is needed for actual character speech, so judging every
  archive would reduce fresh sample collection;
- LLM semantic review is better used in eval/offline reports until fresh
  samples prove the deterministic gate is too weak.

If a conversation does not write a `殘留：...` line or a conversation memory
summary, it has no residual. `outcomeQuality` is only an eval/read-model
classifier. It must not be displayed as emotional residue, and it must not be
allowed to make fallback or deterministic dialogue look like memory.

How residual affects memory:

- it is appended to the remembered conversation, so future retrieval can find
  that emotional trace;
- same-pair prompts may read up to two recent residue memories as emotional
  pressure;
- it should influence attention, tone, availability, and small behavior, not
  become a numeric emotion score.

UI rule:

- `ConversationWall` may show actual memory traces and current status updates
  together, separated by filters;
- character-side history stays a clean transcript viewer and should not display
  per-role residue blocks;
- no emotion dashboard, no `sad +3`, no invented residue from eval outcome.

Night / companion rule:

- ordinary students should not be woken casually at night;
- Alan may still talk to Umi because Umi is the school coordinator and is often
  `secretly_awake`;
- Alan-involved conversations must not archive deterministic fallback. If the
  LLM path fails, the generation aborts instead of saving a fake character
  reply;
- cloud for every Alan conversation is explicit: set
  `HUMAN_CONVERSATION_CLOUD_LLM=true` or `ALAN_HUMAN_CLOUD_LLM=true`. Without
  that switch, Alan chats may use local LLM, but still should not persist
  fallback as character dialogue.

Rollback:

- Set `UNDERWORLD_RESIDUE_WRITE=false` and/or `UNDERWORLD_RESIDUE_READ=false`.
- No data migration is needed because residue is a bounded line in
  `memories.description`.

Next evidence needed:

- Generate fresh post-change Umi/Mahiru/Asuna conversations.
- Check whether later conversations naturally reference prior residue without
  repeating it as a slogan.
- If fresh samples are fewer than 3, do not tune prompt or memory behavior
  further.

## 2026-05-25 v0.1 Scope Reset: Smallest Emotional Continuity Loop

Alan's current goal is to reduce scope and focus on the smallest emotional loop
that can make Underworld feel alive.

Do not build large civilization systems yet. Do not build giant relationship
graphs. Do not optimize for more dialogue.

v0.1 should focus on:

```text
conversation
-> emotional residue
-> memory continuity
-> small behavioral consequence
-> tomorrow feels different
```

### Active v0.1 Scope

Only discuss and optimize these three systems:

1. Character soul expression
   - Does the character say things that fit their soul?
   - Does Umi sound like Alan's world coordinator and emotional load reducer?
   - Does Mahiru notice quiet pain without becoming a generic comfort bot?
   - Does Asuna carry responsibility without collapsing into checklist slogans?

2. Conversation -> emotional residue
   - A conversation can leave a small emotional trace.
   - Do not model this primarily as numbers such as sadness +3 or anger +5.
   - Store human residue such as:
     - "Mahiru still remembers Umi sounded tired."
     - "Asuna is still bothered by being treated as the default burden carrier."
     - "Umi keeps thinking about Alan carrying too much alone."
   - Residue should persist, fade, and resurface when triggered.

3. Emotional residue -> memory continuity
   - Characters should remember meaningful conversations.
   - They should reference unresolved concerns and what others said before.
   - Memories should resurface when the same person, same emotional context,
     same location, or unresolved issue appears again.

Small behavioral change remains important, but only as an output of residue and
memory. Do not build a separate behavior engine yet.

Examples of allowed small behavioral consequences:

- shorter replies;
- delayed task-taking;
- quieter behavior;
- checking on someone;
- avoiding a room;
- staying nearby longer;
- taking initiative once because of a remembered concern.

### Explicitly Deferred

Archive or put aside for now:

- large civilization systems;
- giant relationship graphs;
- global all-character soul systems;
- new factions, lore, scenes, or characters;
- high-frequency emotion writes;
- numerical emotion dashboards;
- large memory schema migrations;
- fine-tuning;
- full all-NPC LLM;
- major UI redesigns.

UI polish, relationship drift, behavior drift, and broader world systems may
remain useful later, but they should not drive v0.1 discussion unless they
directly support the three active systems above.

### v0.1 Priority Characters

Focus only on:

- Umi / 海
- Mahiru / 真晝
- Asuna / 明日奈

Optional secondary observation only:

- CaoCao
- Mai

Do not expand full runtime soul work to everyone yet.

### Eval Direction

Eval should measure:

- Character authenticity: does the character sound like themselves?
- Emotional continuity: did yesterday affect today?
- Memory continuity: did the character remember meaningful past interactions?
- Behavioral consequence: did emotion slightly change action, silence,
  availability, initiative, or avoidance?
- Human naturalness: does dialogue feel like real people, not AI essays?
- Emotional uniqueness: do different characters care differently?
- Day/world awareness: does the character know today, the date, and what they
  are doing today when relevant?

Eval should not reward:

- perfect therapy-speak;
- emotional slogans;
- generic empathy;
- more dialogue for its own sake;
- raw labels such as "private self" appearing in speech.

### Research Inspiration

Do not copy academic frameworks directly. Use them as inspiration only:

- Generative Agents: memory, reflection, planning.
- Attachment theory: different ways people seek, avoid, or offer care.
- Narrative psychology: identity as remembered stories.
- Persona / social-link game design: small repeated emotional moments.
- Relational psychology and Internal Family Systems: inner conflict and
  relational parts, without turning dialogue into therapy labels.

The goal is not academic completeness. The goal is characters slowly feeling
more human over time.

### v0.1 Success Definition

Success is not "the AI said something deep."

Success is:

- yesterday emotionally mattered;
- characters remember each other;
- behavior changes slightly over time;
- the player notices emotional continuity;
- the world feels lived-in;
- the player wants to return tomorrow.

### Codex Working Rule

When working on v0.1, Codex should ask:

1. Does this change improve character-soul authenticity?
2. Does this change create or preserve emotional residue?
3. Does this change improve memory continuity without memory spam?

If the answer is no, the change is likely out of scope for v0.1.

Fresh-sample rule remains active:

- If fresh pilot samples are fewer than 3, do not modify conversation or memory
  behavior unless there is a runtime/hygiene bug.
- Fallback, deterministic template, timeout, sanitizer-aborted, or provider
  error output must not become archived dialogue, memory, reflection, profile
  residue, notification, or world event.

## Archived / Deferred 2026-05-25 Ship Polish Lane

This lane is still useful for external sharing, but it is no longer the main
v0.1 soul scope.

Previously planned ship-polish items:

- Trim `角色` tab density.
- Add inline bottom-bar input for short text actions.
- Float the action result card above the map.
- Re-check conversation wall / VN overlay.
- Capture screenshots for `docs/screens/`.

Keep these as UI support tasks only. Do not let them pull focus away from the
conversation -> emotional residue -> memory continuity loop.

## 2026-05-25 Soul Differentiation Pass

Goal: move the triad from "emotionally aligned" to emotionally distinct.
The new target is not prettier dialogue; it is making Alan feel that each
person loves, worries, avoids, and carries responsibility differently.

Current diagnosis:
- `conversation-c:38831` showed real Qwen and real care, but Umi and Asuna
  repeated the same quiet phrase. That means the system has emotional
  alignment, but not enough differentiated emotional expression.
- The next small fix should not add lore, all-character prompts, or more
  verbosity. It should make the same emotional direction come out through
  different care styles.

Implementation:
- `richUmiMahiruPrompt()` now includes a small emotional-expression identity
  for the pilot triad:
  - Umi reduces overload by organizing burden and protecting Alan's attention.
  - Mahiru cares through presence, quiet noticing, and emotional safety.
  - Asuna carries responsibility physically and asks for help awkwardly.
- The prompt now explicitly bans same-phrase / same-action emotional echo:
  if two characters align emotionally, they must still respond in their own
  care language.
- `eval:soul-triad` now adds:
  - `emotional_expression_uniqueness`
  - `comfort_style_uniqueness`
  - `burden_response_uniqueness`
  - `echo_similarity_penalty`
  - `human_aftertaste_score`

Success rule:
- A good sample is not longer or more poetic. A good sample makes the reader
  feel: Umi protects by reducing load, Mahiru protects by staying near, and
  Asuna protects by sharing the next concrete burden.

## 2026-05-25 Umi / Mahiru / Asuna Soul Triad Pilot

Goal: keep the v0.1 soul loop small, but open one more character brain with
cloud Qwen so Umi and Mahiru are not the only source of civilization growth.

Chosen third brain: Asuna. She adds execution pressure and responsibility
without adding new lore, factions, scenes, or a new system. Umi remains centered
on Alan / school coordination, but Asuna gives the pilot a second kind of
fatigue: reliable people being treated as the default person who will quietly
fix things.

Runtime policy:
- `qwen3-max` remains the only confirmed working Qwen model on the current
  OpenAI-compatible proxy. A `qwen-turbo` smoke was attempted and rejected by
  the proxy with `model_not_found`, so do not switch hourly eval to it unless
  the provider channel changes.
- `qwen2.5:1.5b` stays smoke/harness-only.
- Character-soul conversations stay cloud-only, gated, and sample-scoped.
- If a Qwen call errors, times out, is fallback, or is sanitizer-aborted, the
  transcript must not become archived dialogue, memory, reflection, profile
  residue, notification, or world event.
- Memory summarization / reflection stay deterministic or disabled.

Implementation plan now in repo:
- `pilot:soul-triad:single-sample` temporarily opens
  `SOUL_TRIAD_COLOCATION_PILOT`, co-locates Umi / Mahiru / Asuna, collects one
  archived sample, runs `eval:soul-triad`, then removes the temporary envs and
  stops the engine.
- `eval:soul-triad` scores other-awareness, private self, memory residue,
  behavior signal, Asuna action, Umi Alan anchor, role escape, system/template
  leakage, and echoing the previous line.
- `eval:soul-triad:hourly` is the intended daytime loop until sleep time. It
  should be allowed to collect evidence, not trigger new prompt edits every run.

Current evidence:
- `conversation-c:38819`: first Umi / Asuna sample archived; real Qwen,
  fallback-free, but FAIL after echo penalty because Asuna mirrored Umi's first
  sentence too closely.
- `conversation-c:38831`: stronger sample, WARN 0.76. Umi notices Asuna's
  burden, Asuna names a handoff to Liu Bei / Alan, memory and behavior scores
  are high, but repeated quiet phrases remain a quality issue.

Next rule:
- Do not keep chasing PASS by adding more prompt clauses today. Let the hourly
  harness gather 2-3 more samples. Only make one more targeted fix if fresh
  samples repeat the same failure class.
- If Convex concurrent write contention causes a no-sample run, treat it as
  runtime contention, not dialogue quality.

## 2026-05-24 → 05-30 Plan (next-week work)

Goal: lock down the routing + memory gating we just changed, get a real
soul-depth corpus, and ship the carry-over UI polish so playtests stop
tripping on chrome. Tests pass (55/55) and the working tree is green
heading into the week.

### Monday 2026-05-24 — verify and sample
- Reload the live app, walk through Alan ↔ Umi / CaoCao / Asuna to
  confirm each round goes through LLM, and check Convex logs for
  `skipFallbackOnlyConversation` lines after autonomous NPC↔NPC chats
  end (those should be the ones we now skip writing to memory).
- Re-run `npm run pilot:umi-mahiru:single-sample` once during quiet
  hours; if the autonomous loop still doesn't seed a conversation in
  240s, try `npm run eval:umi-mahiru` directly (which calls the LLM
  without waiting on the agent tick) and archive whatever sample lands.
- Save one Alan ↔ Umi sample for diffing against the NPC ↔ NPC sample;
  this is the corpus pair we will tune prompts against.

### Tuesday–Wednesday 2026-05-25/26 — soul-depth prompt rev
- Run `evals/conversations/runUmiMahiruEval.ts` over the archived
  samples and read the five soul markers
  (`docs/giis-soul-systems-revisit-plan.md`: concrete detail,
  emotional honesty, contradiction tolerance, memory callback, refusal
  of platitudes). Note where each character is weak.
- Make one prompt edit in `convex/agent/conversation.ts`
  (`richUmiMahiruPrompt` for the pilot pair; `companionChatPrompt` if
  Alan ↔ Umi is the weak spot). One change at a time, re-sample, diff
  against the previous corpus. Stop when one marker moves cleanly up.
- DO NOT re-enable `COMPANION_CLOUD_LLM` globally during this loop;
  set `AUTONOMOUS_CONVERSATION_LLM_PAIRS=Umi:Mahiru Shiina` per-run via
  the existing pilot script if more samples are needed against quota.

### Thursday 2026-05-27 — UI follow-ups
- Build the floating action-result card. `actionSummary` /
  `NarrativeResult` still only renders inside the right drawer.
  Either lift it to `Game.tsx` or dispatch a `giis:action-result`
  custom event so the card slides in above the bottom bar for ~6s
  after Alan acts, without forcing the drawer open.
- Inline text input on the bottom action row. Today, text-input
  actions (gift / leaveMessage / announce / createClub) bounce the
  player into the 角色 tab. Add a one-line input that surfaces only
  when one of those is selected, so we keep the bottom flow intact.

### Friday 2026-05-28 — drawer + conversation overlay
- Trim 角色 tab density: the roster + action panel + club registry
  all stack and overflow. Cut what now lives in the bottom bar; the
  drawer should mostly be the roster + "find/travel" controls.
- Open one real conversation and re-check the VN overlay
  (`.giis-conversation-mode` / `.giis-vn-panel`). Confirm it still
  anchors sanely now that the world panel grid is single-column.
- Captures a fresh playtest note (handwritten in `WORKLOG.md`) for
  the next pass.

### Stretch (only if Mon-Fri ran ahead of plan)
- Schedule the 30-min `eval:umi-mahiru:soul-loop` once on Saturday
  under quiet hours to build out the corpus without using daytime
  Qwen quota.
- Audit `convex/agent/memory.ts` `rememberConversation` to see if the
  importance/retention call still makes sense now that we drop
  fallback memories on the floor — possibly tighten the
  `classifyMemoryRetention` thresholds.

### Out of scope (do NOT pick up next week)
- New characters, factions, or scenes.
- Re-enabling cloud LLM globally without an explicit token-budget OK.
- Rewriting the memory architecture (`docs/giis-memory-architecture.md`
  remains the design note; migration not on this sprint).
- Mobile / tablet breakpoint cleanup — user has explicitly said this
  is off the table for the v0.1k window.

## 2026-05-23 Session Tail: Memory Gate + Classroom Auto-Fit + Routing Audit

Done this session:
- Audited conversation routing in `convex/agent/conversation.ts`. Current
  state: Alan ↔ any NPC → LLM (local Ollama; cloud only kicks in if
  `COMPANION_CLOUD_LLM=true`, which is OFF). NPC ↔ NPC → template
  fallback unless `AUTONOMOUS_CONVERSATION_LLM_PAIRS` enables that pair.
  This already matches Alan's "Alan↔ LLM, others fallback" ask, so no
  code change was needed there.
- Added `conversationEligibleForLLM()` helper in `agent/conversation.ts`
  and gated `agent/memory.ts:rememberConversation` on it. NPC↔NPC
  fallback-only conversations are now dropped at the top of the memory
  pipeline with a `skipFallbackOnlyConversation` timing log; they no
  longer pollute character memory with template lines the character
  never "really" said.
- Made `PixiGame.tsx:clampBounds` dynamic. The clamp region now stretches
  horizontally (or vertically) until its aspect matches the stage, so
  the classroom auto-fits the available space at `minScale`. Extra
  padding is pushed onto the right side so the room hugs the left edge
  (drawer overlays scene-toned space, not the room). Caps at 10 tiles
  horizontal / 6 vertical so very wide/tall windows don't inset the
  room into a tiny strip.
- 55/55 unit tests still pass. `npx tsc --noEmit` and `npx vite build`
  both green.

## 2026-05-23 Soul Deepening v0.1k Goal + Token-Outage Fallback

Pivot: cc / codex tokens are exhausted, so the v0.1k goal becomes
**how to deepen the soul of GIIS characters without leaning on a paid
cloud LLM during day-to-day play**. Use the remaining Qwen quota
deliberately for soul-depth sampling, and keep daily-loop conversations
on the local template path so nothing breaks while we iterate.

Captured this session:
- Attempted one Umi↔Mahiru cloud (Qwen) sample via
  `npm run pilot:umi-mahiru:single-sample`. The script applied the
  three pilot-control envs (`UMI_MAHIRU_SINGLE_SAMPLE_AFTER_MS`,
  `UMI_MAHIRU_COLOCATION_PILOT`, `AUTONOMOUS_CONVERSATION_LLM_PAIRS`),
  ran `testing:resume` and `school:coLocateUmiMahiruForPilot`, then
  polled for 240s with 0 fresh archived conversations landing. Result:
  **timed out with no fresh archived Umi/Mahiru sample**. The script's
  `finally` block correctly removed the pilot-control envs and ran
  `testing:stop`. Log preserved at
  `.hatch-pet-runs/umi-mahiru-2026-05-22.log`.
- Likely cause of the empty run (next session, debug before re-running):
  the autonomous loop did not seem to fire a Umi-Mahiru conversation in
  that window. Could be (a) the engine never actually picked up the
  pair after `coLocateUmiMahiruForPilot`, (b) cooldown still active from
  earlier same-day runs, or (c) the daily quota already drained for
  `2026-05-23` UTC. Surface convex logs around the run timestamp before
  the next attempt; also consider seeding via the existing
  `eval:umi-mahiru` harness directly (skips the autonomous-loop wait).
- Switched the day-to-day Alan↔Umi companion path back to template:
  `COMPANION_CLOUD_LLM` removed from Convex env (`npx convex env remove
  COMPANION_CLOUD_LLM`). Alan's private chat now falls back to the
  template `companionFallback` path. Pilot envs (`UMI_MAHIRU_PILOT_*`)
  stay configured so the soul loop can still be triggered manually
  without re-pasting the API key.

Soul-depth work to drive next (v0.1k):
- Bigger sample pool: schedule `pilot:umi-mahiru:single-sample` (or the
  `eval:umi-mahiru:soul-loop` 30-min loop) under quiet hours and archive
  results so we have a corpus to diff prompt edits against.
- Prompt edits should target the same five soul markers tracked by the
  soul-depth eval (specific concrete detail, emotional honesty,
  contradiction tolerance, callback to prior memories, refusal of
  generic platitudes). The eval harness lives in
  `evals/conversations/`; consult `docs/giis-soul-systems-revisit-plan.md`
  for the deeper plan.
- Once a prompt rev shows a clear improvement on the eval, enable the
  cloud path for that pair only by setting
  `AUTONOMOUS_CONVERSATION_LLM_PAIRS=Umi:Mahiru Shiina` (or the
  expansion target) on Convex, not by flipping the global toggle. Keep
  Alan's companion path off until we have a separate prompt rev for it.

Operational rule: do NOT re-enable `COMPANION_CLOUD_LLM` globally
without an explicit token-budget check. Out-of-token fallback should be
the template path, which is now what the running backend is using.

## 2026-05-23 UI Pass: 互動 to Bottom + Right Drawer Slim

Driver: Alan asked to put 互動 at the bottom and keep 對話 on the right; he
also wants less duplicated chrome and a real way to use the floating
left panels one at a time.

Done this session (UI):
- Right drawer tab list trimmed to 對話 + 角色 (debug only with
  `VITE_SHOW_DEBUG_UI`). Default `activeTab` is now `dialogue` so opening
  the drawer goes straight to the conversation surface. The action /
  schedule tabs are gone; their content lives at the bottom or in the
  left column.
- Bottom bar refactored from `status + tiny quick-actions` into a real
  互動列: status chips on top, action pill row below. Scene actions
  always visible; when a target is selected we add `聊聊 {target}`,
  `關心近況`, `問傳聞`, `送禮`, `邀請` plus a `更多互動` link that
  opens the drawer 角色 tab for text-input actions
  (gift/leaveMessage/announce/createClub).
- `actionDescriptions` now ride on each pill's `title` attribute so they
  surface as native tooltips on hover instead of as always-on paragraphs.
- `詳細狀態` `<details>` removed from the bottom bar; the same fields are
  already shown by the topbar / left panels.
- Floating left panels (海 / 校園動態 / 日程) are now mutually
  exclusive: expanding one collapses the other two so they never stack
  on top of each other.
- `FirstRunGuide` (the duplicate "歡迎回來 Alan" card) finished being
  removed; the entry-point copy lives only in 海's briefing.

Carried over to next UI pass:
- **P0** Floating action-result card. `actionSummary` / `NarrativeResult`
  still renders inside the drawer only; lift it (or dispatch via
  `giis:action-result`) so Alan sees his action outcome above the map
  without opening anything.
- **P1** `runQuickAction` opens the drawer for text-input actions. That
  works but loses focus context; consider an inline text input on the
  bottom action row instead of a drawer trip.
- **P1** 角色 tab content is still dense — character roster + action
  panel + club registry all stack. Trim or paginate once we live with
  the new bottom interaction.
- **P2** VN conversation overlay (`.giis-conversation-mode` /
  `.giis-vn-panel`) hasn't been eyeballed against the new layout. Open
  a conversation and confirm the panel still positions sanely.

## 2026-05-22 Switch-style Layout Pass (UI Fit-to-Window)

Driver: Alan reported the UI was hard to use — square map in the middle,
right panel too dense, dark margins around the room from PIXI viewport
panning, no obvious left/center/right separation.

Done this session:
- Shell grid collapsed from `left | world | right` to a single `world`
  column. Right `PlayerDetails` is now an absolutely-positioned drawer
  (collapsed by default, expands as overlay) instead of stealing 28rem of
  width. The 海 / 校園動態 / 日程 buttons float over the left edge of the
  shell instead of occupying a fixed grid column.
  (`src/index.css` `.giis-switch-shell` / `.giis-left-column` /
  `.giis-utility-panel`.)
- PIXI stage no longer fixed to room aspect. It fills the entire world
  panel; the room is anchored to the left via pixi-viewport
  `underflow: 'left'` and clamped to `ClassroomBounds` ± 0.5 tile, so the
  scene-toned `backgroundColor` fills the right-side breathing room which
  is exactly where the right drawer opens into. `minScale` is recomputed
  so the room fits entirely without panning; `maxScale` allows ~2.2× zoom
  for close-ups. (`PixiViewport.tsx`, `PixiGame.tsx`, `Game.tsx`.)
- Replaced the bright blue Stage `backgroundColor` (`0x7ab5ff`) with a
  per-scene tone matching `ClassroomMap.sceneToneFor`, so the canvas no
  longer flashes blue around the room.
- 日程 moved out of the right tab list into a collapsible left-column
  panel (`LeftSchedulePanel` in `Game.tsx`); shows each non-Alan character
  with live location and pathfinding status; clicking a row dispatches
  `giis:navigate-character` to focus the map there.
- Right panel tab list trimmed: `日程` removed (now in left col), `進階`
  hidden unless `VITE_SHOW_DEBUG_UI` is set. `PlayerDetails.tsx`.
- `FirstRunGuide` removed from the right panel — its "歡迎回來 Alan" line
  duplicated 海's briefing on the left.
- Font sizes bumped across topbar / bottom-status / left panels for
  readability (~0.82rem → 0.88-0.92rem on body copy; topbar title to
  1.15rem). Button hit areas slightly larger.

Remaining UI gaps (next pass, in priority order):
- **P0** Right drawer content is still dense. The 互動 tab opens with a
  long character overview + grid; `actionDescriptions` should become hover
  tooltips, not always-on paragraphs.
- **P0** Action result narration (when Alan acts) currently dumps as a
  toast + log. Consider a Switch-style "action result card" anchored over
  the map for ~3s instead of the toast pile.
- **P1** Bottom bar has `.giis-bottom-status` with 3-4 chips + a
  `<details>` for "詳細狀態". Either fold detail into the topbar or drop
  it (most fields already shown elsewhere).
- **P1** Floating left buttons (海/校園動態/日程) currently stack
  vertically at top-left. When 海 is expanded it covers the other two
  buttons; consider letting them slide right or shrink to icons when one
  expands.
- **P2** Right drawer doesn't push the map — it overlays. Decide if we
  want a "split mode" (map shrinks left) for users who want both visible
  while reading dialogue history.
- **P2** Conversation overlay (`.giis-conversation-mode` /
  `.giis-vn-panel`) hasn't been re-checked against the new layout; verify
  the VN panel still positions sanely when the right drawer is also open.
- **P2** Mobile breakpoint (`@media (max-width: 900px)`): the rules still
  reference the old 3-column grid in some places. Audit + simplify now
  that the shell is single-column at all sizes.

## Current State

Status: v0.1 candidate, pending one longer live playtest under normal local LLM load.

The world now has a recognizable school identity: Alan can enter campus, see Umi's briefing, choose characters, view campus feed, switch scenes, and start conversations. The UI is much closer to a Switch-style social sim than the original AI Town dashboard.

It is not v0.1 final yet because the loop still needs stronger smoothness, visible movement, clearer story memory, and more consistently natural conversations.
The core loop is now coherent enough to call a v0.1 candidate: Alan enters, Umi briefs, the player can choose people/actions, campus feed remembers events, Day 2 timing is correct, and debug/repair can restore the seven-character roster. The remaining risk is live responsiveness under local LLM load and longer-form conversation quality.

## 2026-05-22 Start Plan

Operating principle:
- Do not expand systems, factions, lore, or UI architecture.
- Make the existing school feel quieter, more emotionally continuous, and more human.
- Judge success by whether characters feel slightly different tomorrow because today happened.

## 2026-05-22 Targeted LLM Autonomy Pilot

Purpose:
- Move back toward the real "free world" goal without reintroducing local LLM stampedes.
- Keep Alan/Umi human conversations as the highest-value path, but allow one NPC-to-NPC relationship to grow even when Alan is away.
- Treat deterministic autonomous dialogue as scaffolding, not the end state.

Current pilot:
- LLM pair: `Umi:Mahiru Shiina`.
- Env gate: `AUTONOMOUS_CONVERSATION_LLM_PAIRS=Umi:Mahiru Shiina`.
- All other NPC-to-NPC autonomous conversations stay deterministic unless explicitly added to the pair list.
- Global all-NPC LLM remains off: do not set `AUTONOMOUS_CONVERSATION_LLM=true` during this pilot.

Why Umi + Mahiru:
- Umi needs a non-Alan conversation partner so the world can develop while Alan is away.
- Mahiru is the best first partner for testing emotional continuity, student safety, quiet concern, and ordinary school texture.
- This avoids making the first autonomy pilot mainly about faction politics or big-system exposition.

### Pilot Acceleration Plan

Principle:
- Because only one NPC pair can hit the LLM path, we can safely increase daytime conversation throughput.
- Prefer env-only rhythm changes first; do not edit watched conversation code while collecting pilot samples.
- Change a few pacing knobs together only when they all serve the same measurable goal: enough fresh archived conversations to evaluate.

Phase A: start now, env-only:
- Keep `AUTONOMOUS_CONVERSATION_CHANCE_MULTIPLIER=1.0`.
- Restore invite acceptance to the v0.1 default: `INVITE_ACCEPT_PROBABILITY=0.75`.
- Shorten global conversation cooldown for daytime sampling: `CONVERSATION_COOLDOWN_MS=90000`.
- Shorten same-pair cooldown but keep it nonzero: `PLAYER_CONVERSATION_COOLDOWN_MS=180000`.
- Allow slightly fuller scenes: `MAX_CONVERSATION_MESSAGES=6`.

Expected effect:
- More natural invitations during daytime.
- More archived conversations without forcing dialogue.
- Umi/Mahiru gets enough chances to produce LLM samples, while other NPC pairs remain cheap deterministic background texture.

Rollback thresholds:
- If live logs show repeated `conversationLLM` fallback/timeouts for the pilot pair, remove `AUTONOMOUS_CONVERSATION_LLM_PAIRS` first.
- If action churn returns, set `CONVERSATION_COOLDOWN_MS=180000` and `PLAYER_CONVERSATION_COOLDOWN_MS=300000`.
- If deterministic NPC chatter becomes too repetitive before the LLM pilot yields useful samples, lower `AUTONOMOUS_CONVERSATION_CHANCE_MULTIPLIER` to `0.7`.

Do not do yet:
- Do not enable `AUTONOMOUS_CONVERSATION_LLM=true` for all NPCs.
- Do not add new characters, factions, lore, or major UI systems.
- Do not patch prompt or agent code during the first 30-45 minute pilot collection window unless there is a runtime bug.

Fast pilot evaluation:
- For the first 30 minutes, run a lightweight check every 5 minutes: `school:worldClock`, `eval:conversation:recent -- --since-last-change`, and recent archived conversation inspection.
- Keep the "no code change unless evidence supports it" rule: if post-pilot samples are fewer than 5, report the count and keep collecting unless there is a runtime bug.
- For Umi/Mahiru samples, inspect manually as well as with eval.
- Score: latency/fallback, wrong addressee, emotional binding to previous speaker, relationship development, memory outcome, and whether the conversation feels less scripted than deterministic NPC text.
- After 30 minutes or 5+ post-pilot archived conversations, decide whether to keep the 5-minute cadence, roll back to 30-45 minutes, or apply exactly one targeted fix.

Expansion gate:
- Expand to 2-3 LLM pairs only after Umi/Mahiru has at least 5 usable archived samples with no timeout burst and no identity collapse.
- Candidate next pairs: `Umi:Asuna` for operational coordination, `Mai:CaoCao` for strategic tension.
- Restore full NPC LLM only after 2-3 pairs remain stable under longer daytime playtest and p95 response latency is acceptable.

## 2026-05-22 UI Pass + Companion Cloud (Cowork)

(Cowork session, Umi. Layout + path wiring done this session; tsc + modelPolicy tests PASS, but visual layout not yet eyeballed live by Alan.)

- Right panel (`.giis-utility-panel`) widened for readability: 22→28rem (conversation-active 28→34rem, max 23→32rem). `src/index.css`.
- Left side: 海的簡報 + 校園動態 merged into ONE fixed left column (Option A: briefing on top, feed below, scrolls). New `.giis-left-column` flex wrapper in `src/components/Game.tsx`; the two `<aside>`s no longer free-float and no longer spread into the centre map (old rule pushed the feed to `left: 25rem`). Their mutual-exclusion collapse logic was relaxed so both can be open stacked. `src/index.css` + `Game.tsx`.
- Companion path (Alan↔Umi) wired to the same cloud Qwen adapter as the pilot (was on base ollama → `companionFallback` templates). Additive opt-in `COMPANION_CLOUD_LLM`; reuses Codex's `modelPolicy` characterSoul cloud layer + quota guard; companion-specific `COMPANION_PILOT_MODEL` / `COMPANION_PILOT_TIMEOUT_MS` (30s default to avoid timeout→fallback). `convex/agent/conversation.ts` only — modelPolicy untouched. Privacy: 3rd-party proxy now touches Alan's private chat; gate default-off, Alan explicitly approved. Details in WORKLOG.
- Pending: Alan eyeballs the left column live (full-view overlay, collapse pills, bottom overlap with camera dock are the things to check); right-side target/action flow audit (#11) not yet done.

## 2026-05-22 Umi Soul Prompt Target Fix + Prompt-Constraint Audit

(Cowork session, Umi. For the upcoming Codex discussion — this is exactly what changed and why.)

### What changed (applied + typecheck PASS)

Two lines in `richUmiMahiruPrompt()` (`convex/agent/conversation.ts`) were rewritten:

1. `hardLocalPriority` (海 branch, ~L895)
   - Before: 「你可以把話題試著轉去 Alan 或責任，**但同一句內必須露出一個小疲憊訊號**…」
   - After: deflection 是「盔甲」可出現但**不能每一句都這樣**；真晝指名海本人時**至少一句完全停在自己身上、不接 Alan/劉備/簡報/明天**；被照顧那句不准尾隨任務或「明天再說」。
2. `節奏` rhythm line (~L930)
   - Before: 「Mahiru 先看見 Umi 本人 → **Umi 嘗試把話題帶去 Alan/責任** → 同一句露出一個小疲憊或變安靜。」
   - After: 真晝關注一層層累積；海可以先擋一兩次但不要每句都擋；整段**至少一次真正卸下盔甲**（不帶 Alan/劉備/簡報/明天的真話，或一個只屬於此刻的沉默）；明寫「一次裂縫勝過五句客套疲憊」防新模板。

### Root-cause reframe (differs from the original "add a guard" plan)

The bottleneck was NOT a missing guard. The prompt itself **mandated** the deflection: the old rhythm rule literally instructed Umi to pivot to Alan/責任 every turn (with a fatigue tag). Sample `c:38192` is the model obeying that rule perfectly — every Umi line deflects to 劉備/明天 + a fatigue tag (合筆電/放杯子/手放下). So the fix is corrective (rewrite the offending rule), not additive (a new "stay one line" rule, which would have become the next template — the project's recurring failure mode).

Confirmed by code trace: for the pilot pair, the system prompt is **only** `richUmiMahiruPrompt` (conversation.ts L322-324 → `prompt.join('\n')`). The pilot does NOT receive `topicShiftPrompt`, the Layer 1-5 `stakesLayerInstruction`, or the Language-ban stack. So these two lines are the pilot's only lever; nothing else competes.

### Prompt-constraint audit — other places limited the same way

Same class of "forced move every turn → template" bug, found while auditing. NONE currently affect the Umi:Mahiru pilot (it only reads richUmiMahiruPrompt), but they will bite the moment LLM expands to other pairs:

- Secondary reinforcers still inside `richUmiMahiruPrompt` (survived this fix, milder because they are context not hard-rules): `umiMahiruDailyState` 海 → 「容易把自己的疲憊藏進簡報語氣」/「想把風險整理給 Alan」 (~L995/997); `umiMahiruUnresolvedMemory` 海 default → 「Alan 和學生的不安誰來接住」 (~L1024). If the two-line fix does not fully land, these are the next levers — they keep pointing 海 at Alan/簡報.
- `topicShiftPrompt` (~L1094-1111): every character is pinned to ONE signature move — CaoCao always「fears nobody will be responsible」, Asuna always「exhaustion from coordinating」, Mai always「worries Alan doesn't understand」, etc. Run every conversation, each becomes that character's predictable tic. Same flatten, distributed across the cast.
- `stakesLayerInstruction` Layer 5 (~L2757): top of the escalation ladder forces「make a decision / ask Alan for direction / leave with a concrete next action」. That is task-resolution pushed onto the end of every escalating scene — anti-soul for an intimacy/quiet beat, and it routes back to Alan again.

### Open questions for Codex

- Eval alignment: does the binding eval reward「每句都接住一個詞」(which would score deflection-with-tag as binding, explaining 38192 = 0.62 not lower)? Recommend it instead reward「整段至少出現一次卸甲」(one genuine crack), and penalize「全段都在 deflect」. Otherwise the eval re-trains the template.
- Validate on n≥3-5, not on 38192 alone, before/after.
- When expanding LLM beyond Umi:Mahiru, apply the same de-templating to `topicShiftPrompt` and reconsider Layer 5's task-resolution mandate.

## Day / Night Work Split

Reason:
- Character soul work needs real dialogue samples, so it belongs mostly to daytime.
- Night should feel quiet in-world, so engineering cleanup should happen without forcing characters to talk.

Night lane, 22:00-05:59:
- Keep the school quiet; no forced conversation generation.
- Fix app stability, local Convex state, scheduler floods, build errors, and repair tools.
- Polish UI/control-panel layout, portraits, sprites, scene readability, and roadmap notes.
- Improve eval harness and golden archive scaffolding.
- Prepare the next morning checklist and Umi opening focus.

Day lane, 06:00-21:59:
- Let characters naturally produce fresh conversations.
- Run `npm run eval:conversation:recent -- --since-last-change` every 45 minutes.
- During the 2026-05-22 Umi/Mahiru fast pilot, override the normal 45-minute rhythm with the local 5-minute watch for the first 30 minutes, then return to the adaptive cadence unless the evidence says to continue.
- Tune only from new post-fix samples, not old `legacy_noise`.
- Prioritize wrong addressee, fallback loops, emotional binding, relationship chemistry, and behavior consequence.
- Capture genuinely good conversations into the golden archive.

Automation:
- `giis-conversation-watch-loop-v2` now follows this split: quiet engineering at night, conversation QA during the day.
- The external automation scheduler has not been changed from inside this repo; the fast pilot is currently run by the local `launchctl` one-shot watch documented above.
- If the world is intentionally stopped for night quiet, the daytime automation may run `npx convex run testing:resume` at or after 06:00 before collecting fresh samples.

### Morning Opening QA

First checks:
- Confirm project day/time display is correct.
- Confirm Alan returns from away state cleanly.
- Confirm Umi briefing is short, useful, and emotionally legible.
- Confirm today's focus gives Alan one obvious first action.
- Confirm character states are visible enough to explain why people are quiet, busy, tired, or available.

Target morning briefing shape:
- Yesterday's most important emotional residue.
- Today's biggest risk.
- One person Alan should talk to first.
- If Alan only does one thing, what it should be.

### P0: Wrong Addressee Fix

Why:
- Calling the wrong person breaks immersion harder than awkward wording.

Plan:
- Inspect fresh post-fix conversations for wrong names such as CaoCao addressing Mahiru as Liu Bei.
- Strengthen repair/sanitization around speaker-target names.
- Make deterministic fallbacks receive and preserve the actual conversation partner.
- Add or improve eval detection so wrong addressee becomes a first-class failure reason.

### P0: Umi Briefing Compression

Why:
- Daily memory now feeds Umi, but raw day summaries can make her sound like a report generator.

Plan:
- Keep detailed daily memory in world state.
- Display only a compact briefing in the morning.
- Move extra details into Campus Feed / Memory rather than Umi's opening line.
- Avoid repeated dailyMemoryConsolidation entries in briefing output.

### P1: Daily Character State

Goal:
- Add lightweight daily states without turning them into permanent personality rewrites.

Initial states to surface:
- 海：過度整理世界、未休息。
- 真晝：疲憊、擔心學生變安靜。
- 麻衣：觀察中、保留態度。
- 曹操：安靜、評估秩序。
- 劉備：想邀請被排除的人。
- 明日奈：負擔過高、仍在接事情。

These should influence:
- tone;
- reply length;
- willingness to talk;
- initiative;
- movement/activity/status text.

### P1: Quiet World / Atmosphere

Goal:
- Let silence be valid.

Add more non-verbal signals:
- sitting;
- pacing;
- staying late;
- avoiding rooms;
- lingering in hallway;
- lights still on at night.

Where they should appear:
- Campus Feed;
- Umi briefing;
- scene descriptions;
- character status.

Do not force them into dialogue.

### P1: Fresh Conversation Eval

Daytime:
- Allow more natural conversation samples from 06:00 to 21:59.
- Run the adaptive watch loop every 45 minutes.
- Temporary fast pilot exception: Umi/Mahiru collection may run every 5 minutes for 30 minutes using `umi/fast_pilot_watch.sh` while the LLM pair gate is limited to `Umi:Mahiru Shiina`.

Night:
- From 22:00 to 05:59, keep the world quiet.
- Watch loop only performs a real eval near two-hour checkpoints.
- No forced conversation generation at night.

Evaluation priority:
- wrong addressee;
- fallback identity collapse;
- emotional binding to the previous speaker;
- relationship chemistry;
- behavior/world consequence;
- daily-state continuity.

### P2: Golden Conversation Archive

Purpose:
- Save good conversations as taste references and future eval fixtures.

Candidates:
- 明日奈 saying not everything should be silently put on her.
- 曹操 talking about order and the person at the door.
- 真晝 talking about people becoming afraid to say the truth.
- 海 reducing Alan's overload without becoming a report generator.

Keep this lightweight:
- Start as docs/eval examples, not a major data system.

## v0.1 Target Loop

Alan enters campus  
-> sees Umi briefing and today's focus  
-> understands current time, scene, mood, and nearby people  
-> chooses one person or place  
-> travels, talks, observes, or acts  
-> the world reacts with readable consequences  
-> campus feed and conversation history remember it  
-> tomorrow feels slightly different

## v0.1 Acceptance Criteria

- Alan can enter/leave campus without duplicate identity or broken state.
- Time shows dynamic project day, starting from 2026-05-19, so 2026-05-20 is Day 2.
- UI answers immediately: where am I, who is here, what happened, what can I do now.
- Character tab is the main social entry point: select character, see location/status, travel, start talking, review history.
- Conversation panel feels like companion/social-sim chat, not debug chat.
- Umi feels like Alan's guide and emotional anchor, not a generic quest giver.
- Campus feed reads like school memory, not raw logs.
- Characters visibly occupy scenes, avoid stacking, and have enough motion/presence to feel alive.
- Scene switching and character travel are understandable.
- Night/day rhythm changes availability, tone, and event generation.
- Push/simulate world produces short story digest, not clock confusion.
- Club creation is visible in a simple club registry, or hidden when not meaningful.
- Build checks pass: `npx tsc --noEmit`, `npm run build`.

## Completed Recently

- Centralized display name behavior and short-form names.
- Dynamic project-day clock anchored to 2026-05-19.
- Left Umi panel for briefing, suggestions, and today's focus.
- Left campus feed notification panel with read/unread, filters, and full-view expansion.
- Right panel responsibility cleanup:
  - `互動`: Alan/world status and current next-step entry points.
  - `角色`: find people, see location/status, travel, start conversation, character actions, clubs.
  - `對話`: active conversation and scoped history.
  - `日程`: schedule/readability only.
  - `進階`: debug/repair.
- Character cards use portrait-based presentation.
- Map sprites use distinct character visual identity and light idle breathing.
- Umi companion prompt has anti-template guard for vulnerable Alan messages.
- Topbar scene tags changed from slash metadata to natural scene guidance.

## Highest Priority Gaps

### P0: Make Characters Feel Mobile And Placed

Problem: Characters can still feel fixed or clustered even when the backend has positions.

Needed:
- Verify schedule movement actually changes NPC scene/location over time.
- Make travel feedback clearer when Alan moves to target.
- Show transition states such as `正在前往宿舍`, `剛到 AI 社團室`.
- Keep spacing offsets stable enough that characters look gathered, not fused.
- Make focus/scene switch follow movement reliably.

### P0: Conversation Flow Must Feel Immediate

Problem: Conversation is functional but can still feel like a panel with controls.

Needed:
- Selecting a character should show the fastest path to `前往 -> 開始說話`.
- Active conversation should clearly show whose turn it is.
- Character history should stay scoped to selected character.
- Empty states should guide gently, not expose system state.
- Conversation should end with a decision, pause, invitation, emotional shift, or unresolved tension.

### P1: Campus Feed As Story Memory

Problem: Campus feed can still mix older noisy event wording with useful story items.

Needed:
- Rewrite old system-ish event labels on display.
- Group or summarize repeated similar events.
- Show why an event matters in 1 line when available.
- Keep global feed separate from selected character history.

### P1: Daily Rhythm And Availability

Problem: The world is closer to school rhythm, but needs stronger readability.

Needed:
- Character availability visible in role cards.
- Night should reduce normal public activity.
- Morning should show a short digest and one clear focus.
- Daily ordinary life events should remain low-key, not all become plot.

### P1: Umi Guidance Quality

Problem: Umi is much better, but her guidance should consistently reduce Alan's decision load.

Needed:
- Briefing should always answer: what matters, who needs Alan, what one thing to do.
- Suggested actions should route to the right UI flow.
- Umi should avoid repeating full world summaries unless requested.

### P2: Visual Polish

Needed:
- Reduce remaining boxy/dashboard styling.
- Make side panels feel like controller/info surfaces.
- Keep bottom bar compact.
- Ensure mobile panels do not overlap key actions.

## Dangerous Scope To Avoid Before v0.1

- New characters.
- New factions.
- Large autonomous Alan mode.
- Complex romance/relationship meters.
- Full simulation rewrite.
- More lore before the daily loop is smooth.
- Full memory-storage migration before conversation quality is stable.

## Memory Architecture Pending List

Decision:
- For v0.1, keep runtime memories in Convex and add lightweight retention classification.
- Do not split every character into separate memory files yet.
- Use `docs/giis-memory-architecture.md` as the working design note.

Done now:
- Conversation memories are classified as `今日經歷` or `長期候選`.
- Reflection now acts as the lightweight promotion step into long-term insight.
- Ordinary daily texture is allowed to stay ordinary instead of becoming permanent personality.

Later:
- Add explicit schema fields/tables for biography, daily experience, long-term candidates, and long-term memories.
- Add per-character memory inspection/editing UI for Alan.
- Add memory compaction and stale-memory hygiene.
- Add optional file-backed character profile snapshots for review/export.

Why later:
- The immediate v0.1 bottleneck is still playability and conversation quality, not storage architecture.
- A large memory migration now could break retrieval, old history, and the live eval loop.

## Current Work Log

### 2026-05-20: Roadmap Setup

Goal:
- Establish a living v0.1 roadmap.
- Use this file as the coordination point before future implementation passes.

Status:
- Roadmap created.
- Next implementation focus should be P0 movement/placement plus conversation entry clarity.

### 2026-05-20: P0 Movement / Placement Pass

Goal:
- Fix the reason NPCs feel like they gather in the same place.
- Make autonomous schedule context character-aware instead of using only one global time-block location.

Plan:
- Pass the acting player's id into the schedule context query.
- Resolve the player's display name and return a character-specific expected scene.
- Keep the existing movement/pathfinding engine intact.

Status:
- Completed first pass.

Result:
- `currentScheduleContext` is now character-aware when called by autonomous agents.
- Shared `scheduledLocationForName` now drives repair, time movement, and autonomous schedule movement.
- Repair/debug check showed 7 players and no duplicate Alan.
- Current afternoon distribution after repair: cafeteria / courtyard /
  dormitory for ordinary characters, with `校長室` reserved for Umi or an
  explicit Umi invitation.

Remaining:
- Need browser/playtest verification that autonomous movement remains visible over time, not only after repair.
- Need clearer in-UI transition copy when a character is moving between scenes.

### 2026-05-20: P0 Movement Feedback Pass

Goal:
- Make movement readable in the UI, not just technically present in pathfinding.
- Show where a character is heading when they are moving.
- Make map sprites visibly communicate movement/transition.

Plan:
- Derive destination scene from `player.pathfinding.destination` in the frontend.
- Show `正在前往 X` in character cards and schedule/status surfaces.
- Add a lightweight map indicator for moving characters.

Status:
- Completed first pass.

Result:
- Character cards and schedule/status surfaces now derive destination scene from `player.pathfinding.destination`.
- Moving characters display `正在前往 X` instead of vague current-location status.
- Selected character focus card also reports destination when moving.
- Map sprites show a small `…` motion indicator while moving.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Browser DOM smoke confirmed the line now displays as one clean quoted Umi sentence.

### 2026-05-20: v0.1 Candidate Stability Check

Goal:
- Verify the world can be repaired, clocked, and resumed after the UI cleanup passes.

Status:
- Completed.

Result:
- `school:repairWorldState` returned 7 players, 0 duplicate players removed, and one Alan player id.
- World clock returned `第 2 天 下午 3:49`, anchored to `2026/5/19 凌晨12:00`.
- `testing:resume` reported the world is running.
- Browser DOM smoke loaded `/ai-town`, showed Day 2, Umi left panel, campus feed badge, right-side tabs, and clean Umi briefing copy.

Known Risk:
- Browser click/screenshot automation intermittently times out while local Convex/Ollama load is high. DOM smoke works, but I am not counting the final click-through playtest as fully complete until it can be repeated smoothly.
- User playtest reported two v0.1 blockers:
  - Character history still feels odd: it should be a scoped conversation summary list, with click-to-open full timestamped transcript and a clear close action.
  - Characters still appear unable to walk/move in the live world, despite repair placing them in scenes.

v0.1 Candidate Judgment:
- Good enough for Alan to open and play the core loop.
- Not yet good enough to freeze as v0.1 final without one longer manual/live session focused on conversation start, leaving, and character movement over several minutes.

### 2026-05-20: Active Blocker Pass

Goal:
- Replace the awkward selected-character previous-conversation details UI with an inbox-style history viewer.
- Diagnose and fix live character movement.

Status:
- Completed first pass.

Result:
- Selected character history now behaves more like a conversation inbox:
  - Each history item is a scoped summary card.
  - The card shows participants, timestamp, a one-line summary, and a preview.
  - Clicking the card expands the real transcript with per-message speaker names and timestamps.
  - Clicking the card summary again collapses it.
- `campusTimeline` now returns full archived `transcriptMessages` for character-scoped history instead of only a short preview.
- Removed the awkward `展開選定角色完整上一段對話` section from the conversation panel.
- Found the movement root cause: `repairWorldState` could patch the correct seven-character roster while an already-running engine step still held the stale world in memory, then that stale step saved the old roster back over the repair.
- `repairWorldState` now invalidates the currently running engine generation before patching world state, so stale scheduled steps cannot overwrite the repaired roster.
- Manual movement test confirmed pathfinding/input works after repair: Alan moved from `(12,14)` to `(8,9)` and the engine processed the move input.
- Right-side selected-player location copy now uses the selected player's actual position, not the currently viewed scene, fixing misleading text such as `劉備｜所在場景：AI 社團室` when 劉備 is elsewhere.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npx convex run school:repairWorldState` passed after the stale-engine invalidation change.
- `npx convex run world:worldState ...` showed one Alan (`p:15799`) and all seven main characters in the repaired world.

### 2026-05-20: v0.1 Soul / Movement / Memory Cleanup Pass

Goal:
- Finish the current 2-5 stabilization pass:
  - make movement visibly readable,
  - reduce old timeline/system wording,
  - make Umi's briefing less report-like,
  - audit recent history for conversation depth,
  - run another repair/build smoke.

Status:
- Completed implementation pass; still needs one longer live click-through session for final v0.1 confidence.

Result:
- Map characters now show movement when either `historicalLocation.speed > 0` or active `pathfinding` exists.
- Moving characters render a small trail / `...` indicator so pathfinding is visible instead of looking frozen.
- Conversation prompt rules now force a “soul check”: each response should include a concrete school-life detail, personal stake, hesitation, cost, silence, or decision.
- Character-specific conversation guidance was strengthened:
  - CaoCao should not repeat generic influence language without a person, cost, or concrete move.
  - Liu Bei should focus on excluded/quiet students instead of always calling public discussions.
  - Umi should speak more like Alan's emotional/world interpreter and less like a briefing generator.
  - Mahiru, Mai, Asuna now have clearer personal pressure hooks.
- Old displayed timeline/conversation text is naturalized on read:
  - removes leaked prompt text,
  - rewrites `形成意圖` / `執行意圖` style language,
  - softens repeated strategy slogans,
  - reduces old “校長簡報” phrasing.
- `repairWorldState` now also cleans legacy profile memories and intentions, so stale repeated phrases stop resurfacing in character cards and debug/profile surfaces.
- Umi briefing risk copy now avoids third-person self-reference like `海會建議 Alan...` in the spoken briefing.

Conversation Depth Audit:
- Recent history now shows real emotional hooks:
  - Mahiru notices quiet students and emotional safety.
  - Mai worries Alan builds faster than he understands.
  - Asuna carries execution burden.
  - CaoCao frames order as protection from chaos.
  - Liu Bei's best direction is now loneliness/exclusion, not just “公開討論”.
- Remaining weakness: older archived conversations still contain repetition because they were generated before the new prompt rules. Display cleanup hides the worst wording, but this is not the same as fully regenerated history.

Verification:
- `npx tsc --noEmit` passed after the movement/display cleanup pass.
- `npm run build` passed after the movement/display cleanup pass.
- `school:repairWorldState` returned 7 players and one Alan player id.
- `school:debugState` showed Mahiru actively moving, confirming movement state exists in current world data.
- `school:umiBriefing` returned Day 2 timing and current daily focus.
- Browser smoke on `http://localhost:5173/ai-town` loaded the app, showed Day 2, Umi briefing, campus feed, right tabs, and removed the old `海把這段對話整理成校長簡報` phrase from the visible briefing.

v0.1 Judgment:
- Closer than before, but not final.
- The core school loop is readable; the biggest remaining risk is whether newly generated live conversations consistently avoid fallback repetition under local LLM load.
- Browser smoke initially hit a stale duplicate Vite server on `localhost:5173`; after shutting down the duplicate listener, `/ai-town` rendered normally again with Day 2, Umi panel, campus feed, right panel, and character scene occupancy.

Remaining:
- Need one longer visual playtest to confirm movement *feels* visible enough in the browser, not just that backend pathfinding works.
- Need to reduce stale old memories/noisy historical phrases in archived transcripts without deleting world memory.

### 2026-05-20: Conversation History UX Pass

Goal:
- Make selected-character history feel like a message app / social-sim archive instead of expandable debug logs.

Decision:
- Keep global `校園動態` as whole-school memory.
- Make the `對話` tab behave like a scoped message archive:
  - `目前對話` is the active chat window.
  - `歷史對話` is the selected character's thread inbox.
  - `角色資料` stays separate from the chat.

Result:
- Replaced per-card `<details>` expansion with a fixed thread viewer:
  - Top/list area shows different conversation threads by time.
  - Selecting a thread opens its full transcript in the same fixed window.
  - The transcript shows real speaker names and per-message timestamps.
  - A `關閉` button hides the transcript while preserving the thread list.
- This should make `曾經跟誰講過話 / 幾點幾分 / 點開看真實紀錄 / 可以關掉` much clearer.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

### 2026-05-20: Conversation Soul / De-Template Pass

Goal:
- Decide honestly whether characters are speaking with enough depth for v0.1.
- Reduce the feeling that every conversation becomes AI 社 / 學生會 / influence politics.

Judgment:
- Characters have strong profile architecture, but v0.1 final still depends on live conversation feel.
- The biggest risk is not missing lore; it is characters sounding like smart strategy memos instead of people living in a school.

Result:
- Strengthened conversation prompt rules:
  - Each reply should include a concrete school-life detail, personal cost, hesitation, silence, decision, or exit when natural.
  - Repeated ideas must move to a personal stake or ordinary-life pivot.
  - Banned system-ish language such as `主線`, `形成意圖`, `conversationOutcome`, and `不能忽略`.
- Made role fallbacks more human:
  - 劉備 now tends to find excluded students first instead of always calling public discussions.
  - 明日奈 can name the burden of being the person everyone expects to clean up.
  - 曹操 notices vulnerable people through the lens of order.
  - 麻衣 can refuse over-explaining and let silence carry tension.
  - 海 avoids briefing voice unless Alan asks for it.
- Updated Umi suggestions and world-event consequences so `請劉備組織公開討論` is no longer the default repeated advice.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Browser smoke loaded `/ai-town`; still need live manual chat with 海 / 真晝 / 麻衣 / 曹操 to judge emotional resonance.
- In progress.

Remaining:
- Need live playtest: trigger Alan travel to target and confirm the status copy updates while movement is in progress.
- Need stronger scene-arrival feedback after pathfinding completes.

### 2026-05-20: P0 Arrival Feedback Pass

Goal:
- Give travel a readable ending, not only a start/moving state.

Result:
- Game now tracks moving -> idle transitions for Alan and the selected character.
- When movement completes, scene toast shows `X 抵達 Y。`
- This completes the first pass of start/moving/arrival feedback.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need live browser playtest to verify the toast timing during actual travel.

### 2026-05-20: Travel Toast QA Follow-Up

Finding:
- Browser playtest confirmed `前往所在地` enters moving state and shows `正在前往`.
- The scene toast could stay visible too long, making the UI look stuck if arrival detection did not replace it quickly.

Fix:
- Scene toast now auto-clears after 6 seconds.
- Persistent movement state remains in character/status UI instead of relying on the temporary toast.

Status:
- Implemented and verified.

### 2026-05-20: P1 Campus Feed Story Memory Pass

Goal:
- Make 校園動態 read like school memory instead of raw simulation logs.
- Keep global campus feed separate from selected character history.

Plan:
- Add a short meaning/detail line to feed items when source data has it.
- Naturalize old system-ish phrases at display time instead of deleting old events.
- Keep notification filters/read-state behavior intact.

Status:
- Completed first pass.

Result:
- 校園動態 now supports a second detail/meaning line per item.
- Old system-ish phrases such as `conversationOutcome`, `形成意圖`, and raw event-source labels are naturalized at display time.
- No historical world data was deleted or rewritten.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

### 2026-05-20: Conversation / Character Clarity Pass

Goal:
- Reduce repeated speaker labels in conversation.
- Make no-target character actions read like a game UI instead of a system template.
- Keep selected target, action panel, and map card synchronized.

Status:
- Completed first pass.

Result:
- Message rows no longer repeat names such as `Alan Alan` or `海 海`.
- Character action text no longer says `尚未選擇` as if it were a target.
- No-target actions are now limited to scene/world actions.
- Character lookup now accepts both internal names and display names.
- Map selected card now prioritizes the selected target over unrelated active conversation participants.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Browser smoke confirmed the no-target wording fix and improved target-location sync before the final selected-target source fix.

Remaining:
- Need one more browser retest after the selected-target source-of-truth patch.

### 2026-05-20: Quiet World Density Pass

Goal:
- Make the school less like a 24/7 meeting simulator.
- Let silence, resting, and ordinary activity exist between conversations.

Status:
- Completed first pass.

Result:
- Autonomous conversation chance is now schedule-aware.
- Deep-night sleep blocks normal autonomous conversation.
- Dormitory/night activity is quieter.
- Conversation duration and message count are shorter.
- Agents spend longer in place before choosing another action, reducing constant churn.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `school:repairWorldState` passed after stopping the local engine.
- `school:debugState` showed seven main characters and one Alan.
- `school:nightCycleQaScenario` produced sleep/rest behavior and a morning digest.

Remaining:
- Need longer live playtest with the engine running normally.

### 2026-05-20: Umi Briefing Presentation Cleanup

Goal:
- Remove nested speaker/quote artifacts from the left Umi briefing.

Status:
- Completed.

Result:
- Umi greeting lines now strip duplicated `海：` prefixes and outer quote marks before display.
- The left briefing reads like a clean spoken line instead of `「海：「...」」`.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need live browser review to see whether the feed feels calm enough in real data.
- Need further grouping if older noisy history still overwhelms the panel.

### 2026-05-20: P0 Conversation Readability Pass

Goal:
- Make the active conversation feel like a clean companion/social-sim chat.
- Remove duplicated speaker names inside message rows.
- Keep selected-character history scoped and messenger-like.

Plan:
- Ensure message rows show avatar + one speaker label, not duplicated names.
- Pass selected target into chat input placeholder.
- Tighten empty/history states without changing stored data.

Status:
- Completed first pass.

Result:
- Active conversation message rows now show avatar + one speaker name, avoiding duplicated `Alan Alan` / `海 海` style repetition.
- Chat input placeholder now scopes to the selected target when available.
- Existing selected-character history behavior remains scoped and unchanged.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need live browser review with a real 海 conversation to confirm the emotional prompt + UI rhythm together.

### 2026-05-20: Player Presence Copy Fix

Finding:
- Browser smoke showed the main panel could say `附近角色：目前只有 Alan` while Alan was actually away from campus.

Plan:
- Make the overview copy distinguish Alan's away state from nearby/scene characters.
- Avoid implying Alan is physically present when the player identity says he is handling other work.

Status:
- Completed.

Result:
- Main overview now distinguishes `場景人物` while Alan is away from `附近角色` while Alan is present.
- Alan away state no longer implies he is physically standing in the current scene.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

### 2026-05-20: Character Tab Action Clarity Pass

Goal:
- Make the 角色 tab clearly behave as `select person -> find them -> talk/act`.
- Remove confusing no-target copy such as `Alan 對 尚未選擇 執行...`.

Plan:
- Show role/action controls only after a character is selected.
- Keep club registry visible but separate from selected-character action state.
- Keep unusual actions collapsed away from the primary route.

Status:
- Completed first pass.

Result:
- Character action prep copy no longer says `Alan 對 尚未選擇`.
- No-target state now describes valid world actions such as observing the current scene, announcing, or creating a club.
- Role-dependent interactions remain disabled until a character is selected.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need browser review that the 角色 tab feels more like find/interact than a settings overview.

### 2026-05-20: Club Registry Noise Reduction

Finding:
- Live data contains several old/test club records, which makes the player-facing registry feel repetitive.

Plan:
- Do not delete historical club records.
- Show the two most recent clubs first.
- Move older clubs into a collapsible archive inside the registry.

Status:
- Completed.

Result:
- Club registry now shows the two most recent clubs first.
- Older club records are still preserved but collapsed under `較早登記的社團`.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

### 2026-05-20: Quiet World Conversation Density Pass

Goal:
- Stop the school from feeling like everyone is always in meetings.
- Preserve autonomous life while making idle/resting/observing states more common.

Plan:
- Lower autonomous invite acceptance.
- Shorten autonomous conversations.
- Add a probability gate before agents start new autonomous conversations.
- Lengthen ordinary activities slightly so characters visibly occupy scenes.

Status:
- Completed first pass.

Result:
- Autonomous agents now start fewer conversations by probability instead of always seeking a target.
- Autonomous invite acceptance is lower.
- Autonomous conversations end sooner.
- Ordinary school activities last longer, so characters can visibly occupy scenes without immediately starting another talk.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need longer runtime observation to tune exact conversation frequency.

### 2026-05-21: Conversation Sample Density Rebalance

Goal:
- Generate enough real post-fix conversations for the v0.1 conversation watch loop.
- Keep deep-night quiet behavior intact.

Status:
- Completed first pass.

Result:
- Daytime autonomous conversation cooldown is shorter.
- Autonomous invite acceptance is higher during the v0.1 tuning phase.
- Agents now try to find a conversation before falling back to idle activity when awake and available.
- Schedule-aware probabilities are higher in daytime/social scenes and still blocked during sleep hours.
- Autonomous conversations can reach six messages before the hard cap, giving the eval loop more 3-6 turn scenes.

Remaining:
- Let the running world produce new post-fix conversations, then evaluate only those samples.

### 2026-05-21: Small Meaningful Player Actions Pass

Goal:
- Make the action panel feel less like admin controls and more like ordinary school interaction.
- Give Alan a few low-risk actions that create memory without expanding into a new system.

Status:
- Completed first pass.

Result:
- Added player-authored actions: `關心近況`, `留言`, and `詢問傳聞`.
- These actions write natural world events, update social layer, and add target memories when a character is selected.
- Moved `踹一腳` and `任命為助理校長` into a collapsed advanced/toy action area instead of normal character actions.
- AI club cards can now prepare an editable announcement draft for AI 社 boundaries, rather than being only a passive registry.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Browser-playtest the action panel hierarchy and confirm the new actions feel useful rather than noisy.

### 2026-05-21: Formative Memory / Social Layer Downweight Pass

Goal:
- Let characters grow from personal history, daily life, and relationships instead of defaulting to AI 社 / student council / world-pressure analysis.
- Keep social systems as atmosphere, not the main script.

Status:
- Completed first pass.

Result:
- Added optional `formativeMemories` seeds to the GIIS character profiles and Alan profile.
- Conversation prompts now include a `Character soul source priority` block:
  1. previous speaker, current scene, formative memories;
  2. recent personal memories and relationship tension;
  3. campus politics/world pressure only as background weather.
- Recent world events are now explicitly framed as background weather and limited to at most one emotional-thread reference.
- Formative memories are instructed to shape what a character notices, avoids, protects, asks, or leaves unsaid rather than being quoted directly.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Generate and inspect fresh conversations to see whether characters stop overusing AI 社 / student council analysis and begin reacting from personal pressure.

### 2026-05-21: End-of-Day Daily Memory Consolidation

Goal:
- Make tomorrow inherit today instead of starting from zero.
- Keep the implementation lightweight: no new major memory architecture, no new UI, no schema migration.

Status:
- Completed first pass and ran it for the current end-of-day state.

Result:
- Added `school:consolidateDailyMemory`.
- The mutation summarizes the current world day into:
  - world summary;
  - per-character daily memories;
  - relationship shifts;
  - tomorrow hooks.
- It writes the result into existing profile memory and creates one `dailyMemoryConsolidation` world event for tomorrow's briefing/campus feed.
- It avoids storing raw transcript snippets in character memory; conversation memories are compressed into short summaries.
- Re-running the consolidation marks older same-day consolidation events as `repeated_noise` so old test runs do not spam Umi's briefing.
- Conversation watch automation was reduced to every 2 hours, and the prompt now treats nighttime silence as valid instead of forcing new conversations.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npx convex run school:consolidateDailyMemory '{"timeZone":"America/Chicago","force":true}'` completed.
- `npx convex run school:umiBriefing '{"timeZone":"America/Chicago"}'` shows one current daily memory consolidation as a briefing anchor.

Remaining:
- Tomorrow morning, verify that Umi's opening briefing is concise enough and that characters reference daily memory without repeating old wording.
- Later v0.1 work should add a cleaner memory hygiene pass so forced/dev consolidations can be pruned or hidden more elegantly.

### 2026-05-21: Anti-Silence-Template Conversation Patch

Goal:
- Fix the first post-formative-memory eval finding: anti-repeat logic was redirecting into repeated quiet/silence templates.

Status:
- Completed one targeted patch.

Result:
- Added the repeated silence phrases to the conversation language ban and template-leak guard.
- Replaced fallback lines like `我先不替這段話下結論 / 讓它安靜一下` with concrete low-stakes actions:
  - cancel one task;
  - check who actually needs rest;
  - identify who left early;
  - remind Alan to see people before adding features.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npm run eval:conversation` stayed at expected baseline: 5 PASS / 1 WARN / 3 intentional bad-fixture FAIL.

Remaining:
- Wait for new post-patch archived conversations before judging whether the repeated silence pattern is fixed.

Runtime QA:
- `npx convex run school:repairWorldState` passed.
- Repair kept 7 players and one Alan.
- `npx convex run school:debugState '{}'` showed the seven main characters without stale active conversation state.
- `npx convex run school:nightCycleQaScenario '{}'` showed 23:00 sleep behavior and a short next-morning digest.

### 2026-05-21: Night Groundwork For Tomorrow Morning

Goal:
- Prepare the 2026-05-22 morning loop without expanding systems.
- Fix the most immersion-breaking conversation risks before collecting new daytime samples.

Status:
- Completed focused implementation pass.

Result:
- Umi briefing now compresses daily memory into a short emotional residue instead of reading like a system report.
- Wrong-addressee repair now handles full Chinese/English aliases in both generation cleanup and final message insertion.
- Conversation eval now includes `wrongAddresseeScore`, so CaoCao addressing Mahiru as Liu Bei becomes a first-class failure.
- Added a lightweight golden conversation archive scaffold for future taste references.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npm run eval:conversation` passed expected baseline: 5 PASS / 1 WARN / 4 intentional bad-fixture FAIL.
- `npm run eval:conversation:recent -- --since-last-change` ran, but found 0 post-patch conversations.

Remaining:
- Tomorrow morning, collect fresh post-patch conversations. Do not judge old `legacy_noise` conversations as current failure.
- Capture 3-5 genuinely good archived conversations into the golden archive once they occur naturally.

Operational finding:
- Local Convex state is bloated: about 4.1M documents, including about 3.4M duplicate `schoolRelationships` rows and about 148k pending `ensureWorldProfiles` scheduled functions.
- Root cause patch: `Game.saveWorld()` no longer schedules `ensureWorldProfiles` on every engine save.
- Before a long playtest, do a controlled local-state hygiene pass. Do not reset world memory casually; clear scheduler/relationship flood carefully.

Follow-up repair:
- Added `scripts/repair-local-convex-state.mjs`.
- Ran dry run, then backed up and cleaned local Convex SQLite.
- Active documents dropped from about 4.15M to about 464k.
- Backup path: `/Users/alanhdchu/.convex/convex-backend-state/local-alan_chu-ai_town/backups/convex_local_backend.2026-05-22T04-42-45-280Z.sqlite3.bak`.
- `npm run dev` can serve the frontend again at `http://localhost:5173/ai-town`.
- `repairWorldState` ran after cleanup and restored seven players plus one Alan.
- Night safety stop: after repair, the engine was stopped with `npx convex run testing:stop` so stale scheduled movement cannot keep moving sleeping characters tonight.

### 2026-05-20: Target Location Source Sync

Finding:
- Browser playtest showed the same selected character could display different scenes in different UI surfaces.

Plan:
- Match live map players to profile/target names by both internal name and display name.
- Use live map position as the primary source for character location/status where possible.

Status:
- Completed first pass.

Result:
- Character lookup now matches both internal names and display names.
- Character tab, action panel, and map navigation are less likely to disagree about the selected target.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Remaining:
- Need live browser retest after reload because autonomous movement can still legitimately change location between checks.

### 2026-05-20: Selected Target Source-Of-Truth Pass

Finding:
- Browser playtest showed the top target card could be overwritten by the active conversation participant, while the right panel used the selected character.

Plan:
- Keep explicit player selection as the primary selected-target source.
- Use active conversation participants only as fallback when no character is selected.

Status:
- Completed first pass.

Result:
- Explicitly selected character now stays the selected target in the top/map HUD.
- Active conversation participant only fills the target card when nothing else is selected.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Verification:
- `npx tsc --noEmit` passed.
- `npm run build` passed.

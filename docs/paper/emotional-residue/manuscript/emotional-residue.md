# Emotional Residue: A Lightweight Memory Pattern for Trace-Based Continuity in LLM-Driven Character Agents

> **Design-note companion.** The local arXiv source now lives at
> `docs/paper/emotional-residue/manuscript/main.tex`. This Markdown file preserves the richer planning
> prose and repo-grounded notes; treat the LaTeX file as the submission source.

---

## Abstract

We present **emotional residue**, a deliberately minimal memory pattern for
persistent LLM-driven character agents, and report it as a design/systems
contribution built on the AI Town / Generative Agents substrate. Instead of
representing the aftermath of a conversation as a numeric affect state
(`sadness +3`) or a full transcript summary, a qualifying conversation leaves a
**single bounded, human-readable trace line** (e.g. *"殘留：海聽起來很累"* —
*"residue: Umi sounded tired"*) inside the agent's memory. A later conversation
between the same pair reads back up to two recent residue lines as *emotional
pressure* that shapes what a character notices, avoids, or how short they reply —
**never quoted verbatim**, and time-gated so that older traces cannot be spoken
of as if they were recent. We situate the pattern in a five-layer soul model
(Public / Private / Relational / Residue / Drift) with a differentiation rule
that keeps multiple characters from collapsing into one voice, and evaluate it
with a *reproducible, deterministic, rule-based* harness measuring soul
uniqueness and rolling two-hour memory continuity, cross-checked against human
annotation. The pattern is ablatable via two environment flags with no schema
migration. The current arXiv-source version reports an 8-conversation smoke
snapshot and a regenerated 2026-06-05 rolling-continuity report, while explicitly
marking controlled ablation and player-study evidence as future work.

<!-- The paragraph below is the long-form design claim retained for future workshop expansion. -->
Skeleton claim: We present **emotional residue**, a deliberately minimal memory
pattern for persistent LLM-driven character agents. Instead of representing the
aftermath of a conversation as a numeric affect state (`sadness +3`) or a full
transcript summary, a qualifying conversation leaves a **single bounded,
human-readable trace line** (e.g. *"殘留：海聽起來很累"* — *"residue: Umi sounded
tired"*). A later conversation between the same pair reads back up to two recent
residue lines as *emotional pressure* that shapes what a character notices,
avoids, or how short they reply — **never quoted verbatim**. We build this on the
AI Town / Generative Agents substrate inside *GIIS Underworld*, a single-campus
emotional simulation with a three-character soul pilot. We describe the
five-layer soul model the pattern sits in, the write/read mechanics and rollback
knobs, and an evaluation harness that measures *soul uniqueness* (do characters
care differently?) and *rolling two-hour continuity* (does an earlier trace
surface later as behavior, not as a slogan?). The conservative arXiv draft
reports smoke evidence and discusses the pattern as an anti-pattern to numeric affect
dashboards.

---

## 1. Introduction

- **Problem.** LLM-driven character agents talk fluently but rarely make a player
  feel that *yesterday mattered*. The common fixes pull in opposite unhelpful
  directions: (a) **numeric affect dashboards** (`trust=0.7`, `sadness +3`) that
  are legible to engineers but emotionally dead and prone to slogan-leak into
  dialogue; (b) **verbatim transcript memory** that is heavy, spammy, and turns
  every callback into a quotation.
- **Our position.** The felt sense of continuity needs *less*, not more: a small,
  selective, emotionally loaded **trace** that the next conversation can *feel*
  without *citing*. We call this the **emotional residue** pattern.
- **Setting.** GIIS Underworld — a fork of AI Town reshaped around one success
  criterion: *"Alan returns tomorrow and the world feels slightly different."* It
  is intentionally small (one campus, seven characters, a three-character soul
  pilot: Umi / Mahiru / Tianze), which is a feature for a design contribution,
  not a limitation to apologize for.
- **The v0.1 loop** (the whole scope):
  `conversation → emotional residue → memory continuity → small behavioral
  consequence → tomorrow feels different`.
- **Contributions.**
  1. The **emotional residue pattern**: a bounded, human-readable,
     write-once-per-qualifying-conversation memory line, with an
     asymmetric *read* path that injects it as pressure rather than content.
  2. A **five-layer soul model** (Public / Private / Relational / Residue /
     Drift) that gives the pattern a place to live and a differentiation rule
     that keeps multiple characters from collapsing into one voice.
  3. An **evaluation harness** pairing deterministic, rule-based
     *soul-uniqueness markers* with a *rolling two-hour continuity* metric
     operationalizing "yesterday mattered."
  4. An honest account of what this does **not** establish (see §7).

## 2. Related Work

- **Generative agents.** Park et al., *Generative Agents: Interactive Simulacra
  of Human Behavior* (2023) — memory stream, reflection, retrieval by
  recency/importance/relevance. GIIS Underworld inherits this lineage via AI Town
  but **diverges on what is stored**: not observations to be retrieved, but a
  selective emotional trace to be *felt*.
- **AI Town** (a16z-infra) — the shared-state simulation engine, Convex backend,
  agent loop, and memory/embedding scaffolding we build on.
- **Affective computing / appraisal models** (e.g. OCC, PAD/affect-state agents)
  — contrast: we argue *against* exposing numeric affect as the unit of memory.
- **Memory for LLM agents** (summarization memory, reflection, episodic vs.
  semantic memory) — position residue as a third option: *aftertaste*, not log
  or summary.
- **Believable agents in games / interactive narrative** (AIIDE / FDG / EXAG
  community) — the venue and tradition this paper speaks to.
  The current arXiv source cites Park et al., AI Town, Picard, OCC, PAD, and
  Bates as the minimum related-work spine.

## 3. System: GIIS Underworld and the Five-Layer Soul

- **Substrate.** Convex game engine + agent loop (`convex/aiTown`,
  `convex/agent`), PixiJS client, local Ollama (`qwen2.5/qwen3`) for most NPC
  turns, cloud Qwen (`qwen3-max`) gated to the soul-pilot triad via
  `convex/modelPolicy.ts`.
- **Five-layer soul model** (`docs/soul/UNDERWORLD_SOUL_ARCHITECTURE.md`):
  1. **Public Self** — outward role/tone/default way of helping.
  2. **Private Self** — hidden fear/cost; leaks through hesitation, not exposition.
  3. **Relational Self** — *who they become around a specific person*; the main
     tool against emotional sameness.
  4. **Emotional Residue** — what survives a conversation (this paper's focus).
  5. **Behavioral Drift** — emotion/memory slowly changing action, silence,
     availability, initiative.
- **Soul differentiation rule.** *Same emotional direction, different emotional
  language.* Umi protects by reducing overload; Mahiru by staying near and
  noticing quiet pain; Tianze by stress-testing a rule, then learning to stop
  before the test becomes harm.
- **Behavioral consequence rule.** Emotion should change *behavior* (put down a
  pen, shorten a briefing, leave a big room for a one-on-one), not trigger world
  analysis.

## 4. The Emotional Residue Pattern (core)

### 4.1 What residue is (and is not)

- **Is:** one short, selective, emotionally loaded line. Good: *"Mahiru noticed I
  was still awake before I did."* / *"They said the rule was safe. Tianze heard
  who would be hurt first."*
- **Is not:** a log dump, a per-line summary, a generic mood label, or
  fallback/template text saved as memory.

### 4.2 Write path

Grounded in `convex/agent/memory.ts` and `convex/agent/conversation.ts`:

- Residue lives as a **bounded line inside `memories.description`**, prefixed
  `殘留：` (`RESIDUE_PREFIX`). No schema migration — this is deliberate (cheap,
  reversible).
- Written **only for qualifying conversations** among the pilot set
  `RESIDUE_PILOT_NAMES = {海, 真晝, 天澤}`. Qualification gates on real (non-
  fallback) multi-turn content; short/one-sided/fallback transcripts do not
  qualify (this is also where archival hygiene lives — see §5.3).
- **At most one residue line per qualifying conversation** → avoids memory spam,
  a named failure mode in the soul architecture doc.

### 4.3 Read path (the asymmetric part)

In `residuePromptLines()` (`convex/agent/conversation.ts`):

- The next prompt between the **same pair** reads back up to **two** recent
  residue lines under a header that explicitly says *"do not quote verbatim"*
  (`殘留記憶（先前和X的對話留下的，不要逐字複述）`).
- Usage instruction injected to the model: *let it influence only what you
  notice, what you avoid, whether your tone gets shorter, or who you ask first —
  do not say "I remember the residue."*
- **Time-labeled pressure.** Residue carries an America/Chicago time-of-day label
  (`今天 / 剛才 / 昨天 / 之前`) via `residueTimeLabelZh()`. Today/just-now residue
  may surface as a short behavior callback; *yesterday* residue may only be
  touched softly ("昨天留下的感覺") with **no invented precise detail**; older/
  dated residue may not be spoken of as today.
- **Motif-repetition guard** (`repeatedMotifLabels()`): if an object/scene
  (tea/cups/lights/files…) already appears ≥2× in prior text or residue, the
  prompt is told to avoid it — fighting the LLM's tendency to re-stage the same
  props as a cheap continuity signal.

### 4.4 Rollback knobs

- `UNDERWORLD_RESIDUE_WRITE=false` — stop writing residue.
- `UNDERWORLD_RESIDUE_READ=false` — stop reading residue (read path early-returns).
- No data migration needed in either direction. This makes residue an
  **ablatable** unit for evaluation (write-on/read-off, etc.).

### 4.5 Why a single human-readable line beats a number

Our central design argument is that the *unit* of emotional memory should be a
trace, not a measurement. A scalar affect state (`sadness +3`) is legible to the
engine but not to the world: it carries no *who* and no *kind of care*, so the
model, asked to act on it, tends to verbalize it — the number leaks back out as a
slogan ("你看起來 sadness 升高了"). A full transcript summary has the opposite
failure: it is so complete that every callback becomes a quotation, which reads as
recall, not memory. A single human-readable residue line sits between the two: it
is small enough to resist quotation yet specific enough to redirect attention. It
names the person and the texture of care ("Mahiru noticed I was still awake before
I did"), which is exactly the content a believable callback needs and a scalar
cannot hold. And because it is one bounded line in `memories.description` behind
two env flags, it is cheap, reversible, and cleanly **ablatable** — the property
that makes §5.2 possible at all. The claim is therefore not "residue is richer"
but "residue is the *right size*": less memory, more felt.

## 5. Evaluation

### 5.1 Soul-uniqueness markers (rule-based, deterministic)

**Honest framing:** the current markers are computed by *deterministic, rule-based*
heuristics (`evaluateConversationCase`, `scoreConversation` in
`evals/conversations/`), not by an LLM judge — `conversation_judge` is presently
a documented rule-based stub. We frame this as a strength: the metric is
reproducible and seed-free. An LLM judge is future work; in its place we validate
the rule-based markers against **human annotation** (§5.x). From the harness
(`eval:soul-triad`):

| Marker | Measures |
|---|---|
| `emotional_expression_uniqueness` | Do the three speak in their own voice? |
| `comfort_style_uniqueness` | Do they comfort differently? |
| `burden_response_uniqueness` | Do they react to overload differently? |
| `human_aftertaste_score` | Does the conversation leave a human residue? |
| `echo_similarity_penalty` | Penalize same-sentence echoes between speakers |
| `stage_direction_leak_penalty` | Penalize first-person physical narration leaking into spoken lines |

### 5.2 Rolling two-hour continuity (the "yesterday mattered" proxy)

- `underworld:rolling-continuity`: take a source two-hour window, then a later
  callback window; count residue candidates in the source and **rolling
  callbacks** in the later window where an earlier trace surfaces as behavior/
  phrasing change rather than a quote.
- Regenerated PASS example (2026-06-05): 14:00–16:00 source → 16:00–18:00
  callback, 3 source conversations, 2 callback conversations, 15 source residue
  candidates, 2 rolling callbacks. This is feasibility evidence, not a controlled
  ablation.
- AM→PM continuity retained as a broader day-arc cross-check.

### 5.3 Pollution hygiene as a first-class metric

- The eval is only meaningful if fallback/template text never becomes memory.
  `auditFallbackPollution` checks memories / archived conversations / world
  events / notifications / profiles all read 0 fallback artifacts.
- The durable-archival fix (`archiveDeletedConversation`, `convex/aiTown/game.ts`)
  ensures a chat is recorded the *same* way whether it ends via the engine diff
  loop or a direct leave — so evaluation samples are not silently dropped.

### 5.4 Case studies / golden moments

For the arXiv source, raw transcript excerpts are intentionally omitted until
Alan confirms what player-facing text may be published. Candidate case studies
for a later workshop version:

- One Umi↔Mahiru pair showing a residue surfacing as a *shorter* reply, not a quote.
- One Tianze moment ("你剛剛躲過去了。放心，我只拆到這裡。").
- One negative example: residue leaking as a slogan (and the prompt fix that closed it).

## 6. Discussion

- Residue as a **third memory primitive**: not log, not summary, but *aftertaste*.
- The differentiation rule is what makes residue legible: shared concern + shared
  residue would still collapse without distinct care languages.
- Engineering ergonomics: ablatable via env flags, no schema migration, bounded
  write — cheap enough to try in any AI-Town-style world.

## 7. Limitations and Threats to Validity (write this honestly)

- **n = 1 player.** The felt-continuity claim rests on a single returning player
  (Alan) and author observation. **No controlled user study, no baseline
  condition, no statistical claim.** This is a design/systems contribution, not
  an empirical HCI study.
- **Rule-based markers need validity evidence.** Soul-uniqueness markers are
  deterministic heuristics, not an LLM judge or a validated psychometric
  instrument. The planned cross-check is ≥2 raters × ~20 samples with agreement
  and convergent-validity reporting.
- **Scale.** Three pilot characters, one campus, one language register
  (zh-TW). Generalization to larger casts / other languages is untested.
- **Provider coupling.** Results depend on cloud Qwen for the triad; behavior on
  weaker local models is qualitatively thinner.
- **Not a consciousness claim.** Early prototype; not AGI, not production.

## 8. Conclusion

Felt continuity in LLM-driven character agents does not require richer memory; it
requires memory of the right size. We argued for **emotional residue** — a single
bounded, human-readable trace, written once per qualifying conversation and read
back as time-gated *pressure* rather than quotable content — as that unit, and
showed it can live inside an ordinary AI-Town-style stack with no schema change
and a clean two-flag ablation. The five-layer soul model gives the trace a place
to be legible across multiple characters, and a deterministic, reproducible
harness lets us measure whether characters stay distinct and whether yesterday
surfaces today. We do not claim a validated player effect from a single-player
prototype; we offer a pattern, an honest evaluation design, and an ablation others
can re-run. *Less memory, more felt.*

---

## References (to flesh out)

- Park, J. S. et al. *Generative Agents: Interactive Simulacra of Human Behavior.*
  UIST 2023. (arXiv:2304.03442)
- a16z-infra. *AI Town.* (project repo)
- Picard, R. W. *Affective Computing.* MIT Press, 1997.
- Ortony, A., Clore, G. L., and Collins, A. *The Cognitive Structure of
  Emotions.* Cambridge University Press, 1988.
- Mehrabian, A. and Russell, J. A. *An Approach to Environmental Psychology.*
  MIT Press, 1974.
- Bates, J. "The Role of Emotion in Believable Agents." *Communications of the
  ACM*, 1994.

---

## Appendix A — Reproducibility pointers (repo-grounded)

- Soul model: `docs/soul/UNDERWORLD_SOUL_ARCHITECTURE.md`
- Pilot definitions: `docs/soul/pilots/{umi,mahiru,tianze}.md`
- Residue write: `convex/agent/memory.ts` (`RESIDUE_PREFIX`, `RESIDUE_PILOT_NAMES`)
- Residue read: `convex/agent/conversation.ts` (`residuePromptLines`,
  `residueTimeLabelZh`, `repeatedMotifLabels`)
- Durable archival: `convex/aiTown/game.ts` (`archiveDeletedConversation`)
- Eval harness: `evals/conversations/`, `npm run eval:soul-triad`
- Continuity metric: `npm run underworld:rolling-continuity`
- Pollution audit: `npx convex run school:auditFallbackPollution`
- Ablation: `UNDERWORLD_RESIDUE_WRITE`, `UNDERWORLD_RESIDUE_READ`

# Emotional Residue: A Lightweight Memory Pattern for Felt Continuity in LLM-Driven Character Agents

> **Draft skeleton — angle A (design/systems pattern).** Target first artifact:
> arXiv preprint, then an AIIDE EXAG / FDG / agent-eval workshop. Sections marked
> `[FILL]` need Alan's empirical content (transcripts, a small annotation study).
> Everything else is grounded in the current GIIS Underworld implementation and
> `docs/soul/`.

---

## Abstract

`[FILL — 150–200 words, write last]`

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
surface later as behavior, not as a slogan?). We report `[FILL — N]` qualitative
observations and discuss the pattern as an anti-pattern to numeric affect
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
  3. An **evaluation harness** pairing LLM-as-judge *soul-uniqueness markers*
     with a *rolling two-hour continuity* metric operationalizing "yesterday
     mattered."
  4. An honest account of what this does **not** establish (see §7).

## 2. Related Work

`[FILL — tighten with real citations]`

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

`[FILL — sharpen into the paper's thesis paragraph]`
- Legible to a human reader without a decoder ring.
- Carries *who* and *what kind of care*, which a scalar cannot.
- Resists slogan-leak: a number invites the model to verbalize the number; a
  trace invites the model to *act differently*.
- Cheap, reversible, ablatable.

## 5. Evaluation

### 5.1 Soul-uniqueness markers (LLM-as-judge)

From the eval harness (`evals/conversations/`, `eval:soul-triad`):

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
- Reported PASS example (2026-06-04): 10:00–12:00 source → 12:00–14:00 callback,
  28 source samples, 7 callback samples, 40 residue candidates, 6 rolling
  callbacks. `[FILL — refresh with current numbers before submission]`
- AM→PM continuity retained as a broader day-arc cross-check.

### 5.3 Pollution hygiene as a first-class metric

- The eval is only meaningful if fallback/template text never becomes memory.
  `auditFallbackPollution` checks memories / archived conversations / world
  events / notifications / profiles all read 0 fallback artifacts.
- The durable-archival fix (`archiveDeletedConversation`, `convex/aiTown/game.ts`)
  ensures a chat is recorded the *same* way whether it ends via the engine diff
  loop or a direct leave — so evaluation samples are not silently dropped.

### 5.4 Case studies / golden moments

`[FILL — 3–4 real transcripts]`
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
- **LLM-as-judge without human-validation.** Soul-uniqueness markers are scored
  by an LLM with no reported inter-rater reliability against human annotators.
  `[FILL — add a small human annotation cross-check, even n=2 raters × 20 samples]`
- **Scale.** Three pilot characters, one campus, one language register
  (zh-TW). Generalization to larger casts / other languages is untested.
- **Provider coupling.** Results depend on cloud Qwen for the triad; behavior on
  weaker local models is qualitatively thinner.
- **Not a consciousness claim.** Early prototype; not AGI, not production.

## 8. Conclusion

`[FILL — restate: less memory, more felt; a single human-readable trace as the
unit of emotional continuity.]`

---

## References (to flesh out)

- Park, J. S. et al. *Generative Agents: Interactive Simulacra of Human Behavior.*
  UIST 2023. (arXiv:2304.03442)
- a16z-infra. *AI Town.* (project repo)
- `[FILL]` affective computing / appraisal (OCC, PAD)
- `[FILL]` LLM agent memory (reflection / summarization memory)
- `[FILL]` believable agents / interactive narrative (AIIDE, FDG, EXAG)

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

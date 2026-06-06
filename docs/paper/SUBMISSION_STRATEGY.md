# Submission Strategy — Emotional Residue paper

Companion to `emotional-residue.md`. Chosen angle: **A (design/systems pattern).**

## Recommended path

1. **arXiv preprint first** (cs.HC / cs.AI). Zero gatekeeping, immediately
   citable, establishes priority on the "emotional residue" framing. Do this as
   soon as the skeleton's `[FILL]` blocks have ≥3 real transcripts and the
   honest Limitations section.
2. **Then a workshop** in the believable-agents / interactive-narrative tradition
   — these accept prototype + qualitative evidence and will not demand
   statistical significance.
3. Only chase a **full HCI long paper** (CHI PLAY / DIS) if you decide to run a
   real player study (see "What unlocks each tier").

## Venue table

| Tier | Venue | Why it fits | Format (verify yearly) | What you must add |
|---|---|---|---|---|
| Immediate | **arXiv** (cs.HC, cs.AI) | citable preprint, priority on framing | no page limit | ≥3 transcripts + honest limits |
| Best workshop fit | **AIIDE EXAG** (Experimental AI in Games) | believable agents, prototypes welcome | ~short paper | demo description + case studies |
| Best workshop fit | **AIIDE INT** (Intelligent Narrative Technologies) | character continuity / narrative memory | ~6–8 pp | residue-as-narrative-memory framing |
| Workshop / venue | **FDG** (Foundations of Digital Games) workshops/short | games + agents community | short/workshop | tighten related work |
| ML side | NeurIPS/ICML/EMNLP **agent or eval workshops** | the soul-uniqueness eval harness | 4–8 pp | lean into eval methodology (angle B) |
| Demo/short | **CHI Late-Breaking Work**, **UIST demo**, **AIIDE demo** | live, playable artifact | 4–6 pp + demo | a stable runnable build |
| Full long (high bar) | **CHI PLAY**, **DIS**, **FDG full** | player-experience empirical | full paper | **user study required** |

> Action: confirm current-year CFP deadlines, page limits, and templates before
> committing — these shift annually. `[FILL — paste deadlines once chosen]`

## What unlocks each tier

- **Workshop / arXiv (now):** the existing system + ≥3 grounded transcripts +
  honest limitations. You essentially have this.
- **Stronger workshop / short paper:** add a **small human-annotation
  cross-check** of the LLM-as-judge markers (even 2 raters × ~20 conversations,
  report agreement). Cheap, kills the most predictable reviewer objection.
- **Full empirical long paper:** a **player study** (n≈5–10), within-subjects
  residue-on vs residue-off (the env flags make this a clean ablation), plus
  qualitative coding of "did yesterday feel present?" This is the only thing that
  moves you from "design artifact" to "evidence."

## Predictable reviewer objections (pre-empt in the draft)

1. *"n=1, no study"* → own it in §7; position as design/systems, not empirical.
2. *"LLM judge isn't validated"* → add the human cross-check; report agreement.
3. *"How is this different from Generative Agents' memory stream?"* → §2 + §4.5:
   not retrieval of observations, but a felt aftertaste read as *pressure* not
   content; ablatable; anti-numeric.
4. *"Cherry-picked transcripts"* → include a negative example (slogan-leak) and
   the pollution-audit = 0 evidence.
5. *"Single language / tiny cast"* → scope it as intentional (design stance), and
   list generalization as future work.

## Title candidates

- *Emotional Residue: A Lightweight Memory Pattern for Felt Continuity in
  LLM-Driven Character Agents*
- *Less Memory, More Felt: Emotional Residue as the Unit of Continuity*
- *Aftertaste, Not Logs: Human-Readable Residue for Believable Character Agents*

## Authorship / ethics checklist before posting

- [ ] Confirm AI Town / upstream license attribution is correct in the paper.
- [ ] Decide author list + affiliation (GIIS).
- [ ] Scrub any private keys/paths (`~/.config/giis-underworld/...`) from figures
      and appendices.
- [ ] If transcripts include the human player (Alan), confirm consent to publish.
- [ ] State LLM-assisted writing per venue policy if required.

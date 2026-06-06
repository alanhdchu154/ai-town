# Experiments — runnable protocol (for Codex / local execution)

> Cloud Claude cannot generate live LLM data (no Ollama / no Convex world / Qwen
> key returns 403 here). This file is the **exact protocol Codex (or Alan) runs
> locally** to produce the data, then feeds it into the offline analysis the
> cloud already built and tested. Every analysis/transform step here is
> offline-tested via `--selftest`.

Pipeline overview:

```
live world (Convex + Ollama/Qwen)  ──►  existing eval reports
        │                                     │
        │ npm run eval:soul-triad             │ report_to_dataset.py  (offline-tested)
        │ npm run underworld:rolling-continuity│
        ▼                                     ▼
   transcripts / reports  ───────────────►  dataset.json + annotations.csv
                                              │
                                              │ analyze.py  (offline-tested, --selftest)
                                              ▼
                            results/{tables,figures,summary.md}  ──►  paste into the paper
```

---

## Prerequisites (local only)

- Convex backend running with the v0.1 world resumed (`npx convex run testing:resume`).
- An LLM provider live (local Ollama, or cloud Qwen for the triad per `modelPolicy.ts`).
- `pip install -r scripts/paper/requirements.txt`.
- `ts-node` available for the eval runners (the repo's `eval:*` scripts use
  `node --loader ts-node/esm`; install if missing).

---

## Experiment 1 — Soul uniqueness (do the three differ?)

**Question:** Do Umi / Mahiru / Tianze score as distinct on the uniqueness
markers, and is cross-speaker echo low?

**Run:**
```bash
npm run eval:soul-triad
cp evals/conversations/reports/soul-triad-latest.md /tmp/triad_baseline.md
python scripts/paper/report_to_dataset.py \
    --report /tmp/triad_baseline.md --condition na --out /tmp/exp1.json
python scripts/paper/analyze.py --dataset /tmp/exp1.json --outdir results/exp1
```

**Target sample size:** ≥ 30 conversations per pair (3 pairs). Re-run the eval
across several days if a single run is thin (the eval reads recent conversations
from Convex).

**Outputs to paper:** §5.1 table — per-marker mean ± 95% bootstrap CI, overall
and per pair; the echo-penalty readout.

---

## Experiment 2 — Residue ablation (the causal core)

**Question:** Does reading residue raise the rolling-callback rate and human
aftertaste vs. not reading it, holding the world fixed?

**Design:** within-world A/B on `UNDERWORLD_RESIDUE_READ`, interleaved on the
same day to avoid world-state drift.

**Decision needed before running (flagged for Codex in PAPER_PLAN §9.1):**
is `residue_off = READ off only` a clean control, or must `WRITE` also be off?
- READ-off only: residue lines still exist in memory, just not injected →
  isolates the *read* mechanism (recommended; cleaner causal target).
- WRITE+READ off: no residue exists at all → tests the whole pattern but
  confounds with whatever else the write path touches.
Record the choice in `results/exp2/README` so the paper states it explicitly.

**Run (READ-off control, recommended):**
```bash
# residue ON
npm run eval:soul-triad
cp evals/conversations/reports/soul-triad-latest.md /tmp/triad_on.md
npm run underworld:rolling-continuity            # records rolling callbacks (ON)
cp umi/reports/*rolling-continuity*latest* /tmp/cont_on.* 2>/dev/null || true

# residue OFF (read disabled)
UNDERWORLD_RESIDUE_READ=false npm run eval:soul-triad
cp evals/conversations/reports/soul-triad-latest.md /tmp/triad_off.md
UNDERWORLD_RESIDUE_READ=false npm run underworld:rolling-continuity
cp umi/reports/*rolling-continuity*latest* /tmp/cont_off.* 2>/dev/null || true

# build dataset
python scripts/paper/report_to_dataset.py --report /tmp/triad_on.md  --condition residue_on  --out /tmp/on.json
python scripts/paper/report_to_dataset.py --report /tmp/triad_off.md --condition residue_off --out /tmp/off.json
python scripts/paper/report_to_dataset.py --merge /tmp/on.json /tmp/off.json --out /tmp/exp2.json
```

**Add rolling-callback labels:** the soul-triad table does not carry
`rolling_callback`. Pull the per-conversation callback flag from the
rolling-continuity report and set `rolling_callback` (0/1) on the matching
`case_name` in `/tmp/exp2.json` (the rolling-continuity report lists callback
conversation ids; a short join script or manual patch is fine — document which).
If a clean per-conversation callback flag is not available, fall back to the
primary outcome = `human_aftertaste_score` (already in the dataset) and report
rolling-callback rate at the report-aggregate level only.

**Analyze:**
```bash
python scripts/paper/analyze.py --dataset /tmp/exp2.json --outdir results/exp2
```

**Target sample size:** ≥ 40 conversations per arm, ≥ 20 residue candidates.

**Outputs to paper:** §5.2 — residue_on vs residue_off on rolling-callback rate
(risk difference) and human_aftertaste (Cliff's delta), each with a two-sided
permutation p and a bootstrap 95% CI. **Report whatever it shows.**

---

## Experiment 3 — Metric validity (human cross-check)

**Question:** Do the rule-based markers agree with human judgment? (Pre-empts the
"your judge isn't validated" reviewer objection.)

**Procedure:**
1. Sample ~20–30 conversations (mix of PASS/WARN/FAIL) into a sheet.
2. ≥ 2 human raters independently score each on 4 Likert dims (1–5), matching the
   code's `ConversationJudgeResult`: `naturalness`, `emotional_binding`,
   `character_consistency`, `repetition`.
3. Save as `annotations.csv` with columns:
   `case_name,rater,naturalness,emotional_binding,character_consistency,repetition`.

**Analyze:**
```bash
python scripts/paper/analyze.py --dataset /tmp/exp1.json \
    --annotations annotations.csv --outdir results/exp3
```

**Outputs to paper:** §5.x — inter-rater agreement (weighted Cohen's κ for 2
raters, Krippendorff's ordinal α for >2) + convergent validity (Spearman ρ
between machine `human_aftertaste_score` and mean human `emotional_binding`).

---

## Experiment 4 — Player study (OPTIONAL; only for a full HCI long paper)

Not required for arXiv / workshop. Within-subjects residue_on/off, n≈5–10, with a
post-session questionnaire and qualitative coding of "did yesterday feel present
inside today?" Use the same env-flag ablation. Requires consent (see
`SUBMISSION_STRATEGY.md` ethics checklist). Skip unless escalating to CHI PLAY/DIS.

---

## What cloud Claude already verified offline

- `python scripts/paper/report_to_dataset.py --selftest` → PASS.
- `python scripts/paper/analyze.py --selftest` → PASS (synthetic data with a
  planted residue effect; pipeline recovers direction; κ sanity-checked).
- Column order in `report_to_dataset.py` matches `runSoulTriadEval.ts::writeReport`.

## What only Codex / local can do

- Resume the world and run the LLM evals to produce real reports.
- Choose and document the Exp 2 control (READ-off vs WRITE+READ-off).
- Join rolling-continuity callback flags onto the dataset.
- Recruit the ≥2 annotators for Exp 3.
- Paste `results/*/summary.md` numbers into the `[FILL]` blocks of
  `docs/paper/emotional-residue.md`.

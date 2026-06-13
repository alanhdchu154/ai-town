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

**Question:** Does reading residue raise the rolling-callback rate and a
rule-based aftertaste proxy vs. not reading it, holding the world fixed?

**Design:** within-world A/B on `UNDERWORLD_RESIDUE_READ`, collected in
arm-pure long windows/days. Do not interleave ON/OFF inside the same rolling
continuity window; that can mix source and callback windows across conditions
and create carryover from already-written residue.

**Control choice:** use `UNDERWORLD_RESIDUE_READ=false` as the primary
`residue_off` arm. This isolates the *read* mechanism: residue lines may still
exist in memory, but they are not injected into the next prompt. `WRITE+READ`
off is a useful sensitivity check only; it tests the whole pattern while also
changing candidate-residue observability and any write-path side effects.
Record this in `results/exp2/README` so the paper states it explicitly.

**Important:** `eval:soul-triad` scores already-existing conversations; it does
not generate new conversations. Therefore the ablation must first **collect fresh
conversations under each condition**, then run the eval on those fresh samples.
Also, `UNDERWORLD_RESIDUE_READ` is read by Convex server code, so set it through
`npx convex env set/remove`, not only as a one-command shell variable.

**Run (forced mechanism sanity block only, READ-off control):**
```bash
npm run paper:residue-ablation -- \
    --samples-per-arm=3 \
    --allow-legacy-forced-pilot \
    --python=/tmp/ai-town-paper-venv/bin/python
```

The command above is a reproducible mechanism-debugging entrypoint. It snapshots the
previous `UNDERWORLD_RESIDUE_READ` env value, runs fresh collection and
`eval:soul-triad -- --since-created-at=<arm_start_ms>` for each arm, restores the
env var, builds `dataset.json`, runs `analyze.py`, and writes an arm-level
README under `docs/paper/emotional-residue/results/ablation-*`. Forced co-location is not the main
causal outcome because it weakens the initiative channel, and the command now
refuses to run unless `--allow-legacy-forced-pilot` is explicitly present. The parser excludes
`active-conversation-*` rows and requires at least 3 messages for qualifying
datasets; active/short rows are useful debug evidence but should not enter the
paper's main statistics.

**Run (primary arm-pure long-window design):**
```bash
# One accepted schedule should list the order before collection starts.
npm run paper:residue-arm-window -- \
    --arm=on \
    --duration-min=240 \
    --collect=none \
    --python=/tmp/ai-town-paper-venv/bin/python

npm run paper:residue-arm-window -- \
    --arm=off \
    --duration-min=240 \
    --collect=none \
    --python=/tmp/ai-town-paper-venv/bin/python
```

Use `--collect=none` for natural/world-generated traffic. Use `--collect=force`
only as a mechanism-pilot supplement and label it as such. The runner restores
`UNDERWORLD_RESIDUE_READ`, writes a window-level `dataset.json`, and attaches
arm-scoped rolling callback labels from the same window. It also writes
`generation-metadata.json` and `run-provenance.json`; the latter captures
secret-safe git, accepted-document, source-archive, command, runtime, and env
policy evidence for future audit.

After each completed arm-window run, audit the run directory before merging it:

```bash
npm run paper:run-provenance-audit -- \
    --run-dir docs/paper/emotional-residue/results/arm-window-YYYY-MM-DD-on \
    --out docs/paper/emotional-residue/results/arm-window-YYYY-MM-DD-on/provenance-audit.md
```

Do not merge a long-window run into the empirical dataset if this audit fails.

Manual equivalent:
```bash
# residue ON: residue read enabled by removing the false override.
npx convex env remove UNDERWORLD_RESIDUE_READ || true
ON_START_MS=$(node -e 'console.log(Date.now())')

# Collect fresh samples. Repeat/loop until target sample size is met.
npm run underworld:observe -- --collect=force --target-samples=3 --sample-timeout-ms=240000

npm run eval:soul-triad -- --since-created-at="$ON_START_MS"
cp evals/conversations/reports/soul-triad-latest.md /tmp/triad_on.md
npm run underworld:rolling-continuity            # records rolling callbacks (ON)
cp umi/reports/*rolling-continuity*latest* /tmp/cont_on.* 2>/dev/null || true

# residue OFF (read disabled in Convex env)
npx convex env set UNDERWORLD_RESIDUE_READ false
OFF_START_MS=$(node -e 'console.log(Date.now())')

# Collect fresh samples under the read-off condition. Repeat/loop until target.
npm run underworld:observe -- --collect=force --target-samples=3 --sample-timeout-ms=240000

npm run eval:soul-triad -- --since-created-at="$OFF_START_MS"
cp evals/conversations/reports/soul-triad-latest.md /tmp/triad_off.md
npm run underworld:rolling-continuity
cp umi/reports/*rolling-continuity*latest* /tmp/cont_off.* 2>/dev/null || true

# Restore residue read for normal development.
npx convex env remove UNDERWORLD_RESIDUE_READ || true

# build dataset
python scripts/paper/report_to_dataset.py --report /tmp/triad_on.md  --condition residue_on  --out /tmp/on.json
python scripts/paper/report_to_dataset.py --report /tmp/triad_off.md --condition residue_off --out /tmp/off.json
python scripts/paper/report_to_dataset.py --merge /tmp/on.json /tmp/off.json --out /tmp/exp2.json
```

**Add rolling-callback labels:** the soul-triad table does not carry
`rolling_callback`. Pull the per-conversation callback flag from the
rolling-continuity report and set `rolling_callback` (0/1) on the matching
`case_name`:

```bash
python scripts/paper/attach_rolling_callbacks.py \
    --dataset /tmp/exp2.json \
    --rolling-report umi/reports/rolling-continuity-latest.md \
    --out /tmp/exp2.with-callbacks.json \
    --mark-callback-window-zero
```

Use `--mark-callback-window-zero` for the primary analysis: callback-window
non-hits become 0, source-window rows remain null, and `analyze.py` drops null
labels from the callback-rate denominator. For the causal paper, prefer arm-pure
long windows/days so the rolling source and callback windows are not mixed
across ON/OFF arms. Do not use `human_aftertaste_score` as the primary outcome;
report it only as a saturated rule-based aftertaste proxy in current pilots.

**Analyze:**
```bash
python scripts/paper/analyze.py --dataset /tmp/exp2.with-callbacks.json --outdir results/exp2
```

**Target sample size:** choose from a pre-registered minimum detectable effect.
Use `n=10/arm` as a pipeline pilot, `n=40/arm` only as large-effect
workshop-scale evidence, and treat `n>=150/arm` as baseline-dependent if
targeting small 10--15 percentage-point callback-rate effects. Higher baseline
rates or clustered dyad/window samples can require larger N or a cluster-aware
analysis.

Refresh the approximate planning table:

```bash
python3 scripts/paper/power_sensitivity.py \
    --outdir docs/paper/emotional-residue/results/power
```

**Longitudinal collection:** see `docs/paper/emotional-residue/experiments/LONGITUDINAL_EXPERIMENT_PLAN.md`.
The 2026-06-06 forced pilots showed that active conversations can appear in raw
reports before archival, so qualifying datasets must exclude
`active-conversation-*` rows and require `message_count >= 3`. Use
`npm run paper:merge-ablation-runs` to accumulate multiple audited arm-window
runs across days. Arm-window runs must pass `paper:run-provenance-audit` before
merge; legacy forced `ablation-*` directories remain pipeline evidence only
unless they meet the newer provenance and cluster-metadata requirements.

**Outputs to paper:** §5.2 — residue_on vs residue_off on rolling-callback rate
(risk difference) and the rule-based aftertaste proxy (Cliff's delta), each with
a two-sided permutation p and a bootstrap 95% CI. **Report whatever it shows.**

---

## Experiment 3 — Metric validity (human cross-check)

**Question:** Do the rule-based markers agree with human judgment? (Pre-empts the
"your judge isn't validated" reviewer objection.)

**Procedure:**
1. Sample at least 30 conversations balanced across arms for the pilot (mix of
   PASS/WARN/FAIL where possible) into a sheet.
2. ≥ 2 human raters independently score each on 4 Likert dims (1–5), matching the
   code's `ConversationJudgeResult`: `naturalness`, `emotional_binding`,
   `character_consistency`, `repetition`.
3. Save as `annotations.csv` with columns:
   `case_name,rater,naturalness,emotional_binding,character_consistency,repetition`.

Generate a blinded sheet and separate key from the current merged dataset:

```bash
python3 scripts/paper/export_annotation_sheet.py \
    --dataset docs/paper/emotional-residue/results/longitudinal/dataset.json \
    --out-sheet docs/paper/emotional-residue/results/longitudinal/annotation_sheet.csv \
    --out-key docs/paper/emotional-residue/results/longitudinal/annotation_key.csv \
    --target 30

python3 scripts/paper/export_blinded_transcripts.py \
    --key docs/paper/emotional-residue/results/longitudinal/annotation_key.csv \
    --outdir docs/paper/emotional-residue/results/longitudinal/blinded_transcripts
```

**Analyze:**
```bash
python scripts/paper/analyze.py --dataset /tmp/exp1.json \
    --annotations annotations.csv --outdir results/exp3
```

**Outputs to paper:** §5.x — inter-rater agreement (weighted Cohen's κ for 2
raters, Krippendorff's ordinal α for >2) + convergent validity (Spearman ρ
between the machine aftertaste proxy and mean human `emotional_binding`).

---

## Experiment 4 — Player study (OPTIONAL; only for a full HCI long paper)

Not required for arXiv / workshop. Within-subjects residue_on/off, n≈5–10, with a
post-session questionnaire and qualitative coding of "did yesterday feel present
inside today?" Use the same env-flag ablation. Requires consent (see
`SUBMISSION_STRATEGY.md` ethics checklist). Skip unless escalating to CHI PLAY/DIS.

---

## What cloud Claude already verified offline

- `python scripts/paper/report_to_dataset.py --selftest` → PASS.
- `python scripts/paper/attach_rolling_callbacks.py --selftest` → PASS.
- `python scripts/paper/power_sensitivity.py --selftest` → PASS.
- `python scripts/paper/export_annotation_sheet.py --selftest` → PASS.
- `python scripts/paper/export_blinded_transcripts.py --selftest` → PASS.
- `python scripts/paper/analyze.py --selftest` → PASS (synthetic data with a
  planted residue effect; pipeline recovers direction; κ sanity-checked).
- Column order in `report_to_dataset.py` matches `runSoulTriadEval.ts::writeReport`.

## What only Codex / local can do

- Resume the world and run the LLM evals to produce real reports.
- Choose and document the Exp 2 control (READ-off vs WRITE+READ-off).
- Join rolling-continuity callback flags onto the dataset.
- Recruit the ≥2 annotators for Exp 3.
- Keep the conservative arXiv source (`docs/paper/emotional-residue/manuscript/main.tex`) aligned with
  the latest `results/*/summary.md` numbers before submission.

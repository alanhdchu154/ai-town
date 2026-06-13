# Publish-Ready Checklist

Status on 2026-06-10: **submitted by Alan on OSF as a conservative
design/systems preprint**, with public URL / DOI still to record locally. The
arXiv route is paused because endorsement is required. The paper is not ready
to claim a completed controlled ablation or a player study.

## Completed

- Imported the PR paper plan, experiment protocol, submission strategy, and
  analysis scripts into the local repo.
- Fixed `report_to_dataset.py` so it parses the real `soul-triad-latest.md`
  table format, not only pipe-wrapped self-test rows.
- Added `attach_rolling_callbacks.py` to attach rolling-continuity callback
  labels to parsed datasets.
- Corrected the Exp 2 protocol: each residue-on/off arm must collect fresh
  conversations before scoring; re-scoring old transcripts is not an ablation.
- Set Exp 2 primary control to `UNDERWORLD_RESIDUE_READ=false`.
- Re-ran the current soul-triad eval and generated an 8-conversation feasibility
  dataset and analysis output.
- Re-generated the 2026-06-05 rolling-continuity report:
  14:00-16:00 source window, 16:00-18:00 callback window, 3 source
  conversations, 2 callback conversations, 15 source residue candidates, and 2
  rolling callbacks.
- Added repeatability checks:
  - identical SHA-1 hashes for two independent analyses of the same smoke
    dataset;
  - sequential rolling-continuity snapshots for 2026-06-04, 2026-06-05, and
    2026-06-06 under `docs/paper/emotional-residue/results/repeatability/`.
- Added rigorous ablation tooling:
  - `npm run paper:residue-ablation` now runs fresh READ-on/off blocks and
    restores `UNDERWORLD_RESIDUE_READ`;
  - qualifying datasets exclude `active-conversation-*` rows and require
    `message_count >= 3`;
  - `scripts/paper/merge_ablation_runs.py` merges many blocks for longitudinal
    analysis.
- Ran archived-only sanity ablation:
  - first forced 3-per-arm pilots exposed active-row / low-archival-yield
    problems and are treated as debug only;
  - two archived-only 1-per-arm sanity blocks succeeded;
  - merged longitudinal dataset currently has `n=2` on / `n=2` off, all from
    the same dyad, which is pipeline evidence only, not an effect claim.
- Added cc-reviewed schedule decision:
  - further cloud collection is paused;
  - primary causal design should use arm-pure full-day / long-window collection;
  - forced dyad blocks are mechanism debugging only;
  - `rolling_callback` labels are now wired into arm datasets, but current labels
    are a plumbing check, not causal evidence.
- Added `npm run paper:residue-arm-window` for the accepted arm-pure
  long-window design. This is a runnable entrypoint, but it has not been used to
  collect new cloud-provider data yet.
- Added `docs/paper/emotional-residue/experiments/SCHEDULE_ACCEPTANCE.json`,
  `docs/paper/emotional-residue/experiments/PREREGISTRATION_ACCEPTANCE.json`, and a runner gate:
  `paper:residue-arm-window` refuses to run until both acceptance files record
  explicit Alan acceptance.
- Tightened the rolling-callback denominator: rolling reports now list callback
  window conversation ids, and `attach_rolling_callbacks.py
  --mark-callback-window-zero` marks only callback-window non-hits as 0 while
  leaving source-window rows null.
- Ran a zero-cost archived yield check for 2026-06-05 15:00--19:00:
  `WARN / weak_continuity`, 2 source conversations, 5 callback conversations, 12
  source candidates, and 3 weak callbacks. This supports 4-hour window yield
  feasibility but not strong-effect claims.
- Added offline sample-size sensitivity outputs under `docs/paper/emotional-residue/results/power/`.
  The table supports the current caution: `n=40/arm` is large-effect pilot
  evidence, not a powered small-effect study.
- Expanded `scripts/paper/power_sensitivity.py` to emit
  `docs/paper/emotional-residue/results/power/cluster_power_grid.csv` and a cluster-sensitivity
  section in `summary.md`. This uses a simple design-effect approximation to
  show how dyad/day/window clustering can reduce effective n; it is a planning
  guardrail, not final cluster-aware inference.
- Added `docs/paper/emotional-residue/experiments/HUMAN_ANNOTATION_PROTOCOL.md` and
  `docs/paper/emotional-residue/experiments/annotations_template.csv` for the blind two-rater validation step.
- Added `scripts/paper/export_annotation_sheet.py`; the current longitudinal
  dataset exports only 4 annotation rows, confirming that Exp 3 is not complete.
- Added `scripts/paper/export_blinded_transcripts.py`, which turns a separate
  annotation key plus soul-triad reports into rater-visible transcript packets
  keyed by blind ids. The current packet exports all 4 available longitudinal
  records and contains no condition labels, callback labels, marker scores, or
  original conversation ids.
- Added `scripts/paper/merge_rater_annotations.py` /
  `npm run paper:annotation-merge` so completed blinded rater worksheets can be
  merged through `annotation_key.csv` into the `case_name,rater,...`
  `annotations.csv` schema expected by `analyze.py`, instead of relying on
  manual unblinding/editing.
- Added `scripts/paper/paper_annotation_audit.py` /
  `npm run paper:annotation-audit` as an annotation packet/blinding audit. The
  current expected verdict is `PACKET_READY_INCOMPLETE_STUDY`: schema and
  blinding pass, but no completed independent rater sheets have been merged
  into analysis-ready `annotations.csv`.
- Added `scripts/paper/paper_empirical_audit.py` /
  `npm run paper:empirical-audit` as a longitudinal ablation dataset audit. The
  current expected verdict is `PILOT_ONLY_INCOMPLETE_ABLATION`: the dataset has
  n=2/arm, one dyad, two source runs, missing long-window metadata, only four
  callback-denominator rows, missing run-level provider/model metadata, and
  saturated aftertaste proxy. It is valid pipeline/sanity evidence, not a
  completed effect claim.
- Added `scripts/paper/paper_trace_overlap_audit.py` /
  `npm run paper:trace-overlap-audit` as a pilot pressure-not-quotation audit.
  It scans rolling-continuity reports for simple source-trace-to-callback text
  overlap. The current expected verdict is `PILOT_ONLY_TRACE_OVERLAP_AUDIT`:
  11 callback cases are assessed, the max overlap ratio is 0.242, no high
  verbatim-overlap warning fires, but the sample size is below the 30-callback
  validation threshold and one callback lacks parsed source-trace linkage.
- Added `docs/paper/emotional-residue/claims/CLAIM_EVIDENCE_MATRIX.md` plus
  `scripts/paper/paper_evidence_matrix_audit.py` /
  `npm run paper:evidence-matrix-audit` as a claim-to-evidence ledger. The
  current expected verdict is `PASS`: every major manuscript claim maps to
  current artifacts and a boundary such as supported systems pattern,
  smoke/feasibility evidence, pilot-only sanity evidence, future-work blocked,
  or external blocked.
- Added `docs/paper/emotional-residue/claims/CITATION_PROVENANCE.md` plus
  `scripts/paper/paper_citation_audit.py` /
  `npm run paper:citation-audit` as a citation-source ledger. The current
  expected result is `PASS`: every bibliography key has a provenance row, and
  recent LLM-agent / AI Town references point to primary or official sources.
- Added `docs/paper/emotional-residue/release/ALAN_HANDOFF.md` as the one-page Alan-facing source of
  truth for what is defensible now, what remains blocked, and what must happen
  before any outside release decision or empirical-effect claim.
- Added `docs/paper/emotional-residue/claims/REVIEWER_PREMORTEM.md` to record likely reviewer objections:
  pilot-only evidence, unvalidated rule-based markers, prompt-shape confounds,
  unmeasured verbatim leakage, provider/model metadata limits, novelty defense,
  single-player author-observer scope, and ethics/transcript-release scope.
- Added `scripts/paper/paper_claim_audit.py` / `npm run paper:claim-audit` as
  a claim-boundary audit. The current expected healthy result is
  `PASS_CONSERVATIVE_PREPRINT`: no unsupported causal/player-study claim, but
  empirical and external submission blockers still remain.
- Added `scripts/paper/paper_source_audit.py` / `npm run paper:source-audit` as
  a local source-hygiene audit. The current expected result is `PASS`; this does
  not replace PDF compilation or arXiv preview inspection.
- Added `scripts/paper/paper_consistency_audit.py` /
  `npm run paper:consistency-audit` as a manuscript/artifact numeric consistency
  audit. The current expected result is `PASS`: checked hard-coded manuscript
  numbers match generated paper artifacts.
- Added `scripts/paper/paper_protocol_audit.py` /
  `npm run paper:protocol-audit` as a schedule/acceptance/runner consistency
  audit. The current expected result is `PASS`: the pre-registered schedule,
  acceptance file, arm-pure runner, and npm scripts are aligned while collection
  remains paused.
- Added `scripts/paper/paper_design_audit.py` /
  `npm run paper:design-audit` as a causal/mechanism design audit. The current
  expected verdict is `EMPIRICAL_DESIGN_BLOCKED`: the design is acceptable for a
  conservative systems preprint, but empirical/mechanism claims remain blocked
  until Alan accepts the schedule/preregistration, final N is fixed from pilot
  baseline/yield, annotation reaches the minimum, and either a length-matched
  placebo arm is implemented or the narrowed read-block suppression claim is
  kept.
- Added `docs/paper/emotional-residue/experiments/PREREGISTRATION_PROTOCOL.md` as the machine-audited
  preregistration draft for the future rigorous empirical version. It records
  arms, outcomes, inclusion/exclusion criteria, stopping rules,
  cluster-aware sample-size policy, deviation policy, and explicit status fields
  showing collection is paused, final N is not fixed, and the placebo arm has
  only local draft plumbing, not accepted/preregistered analysis.
- Tightened `scripts/paper/run_arm_pure_residue_window.mjs` so the live
  collection runner requires both schedule acceptance and preregistration
  acceptance before it can change `UNDERWORLD_RESIDUE_READ` or hold a collection
  window.
- Added `scripts/paper/paper_mechanism_audit.py` /
  `npm run paper:mechanism-audit` as a systems/code-path alignment audit. The
  current expected result is `PASS`: the manuscript's residue write/read
  architecture maps to current code paths, env gates, storage prefix, prompt
  injection, time labels, and motif guard. This is static systems evidence, not
  runtime or empirical proof.
- Added `scripts/paper/paper_pdf_preflight.py` /
  `npm run paper:pdf-preflight` as a local render preflight. The current
  expected result on this machine is `PDF_BLOCKER`, because no
  `tectonic`/`latexmk`/`pdflatex`/`xelatex`/`lualatex`/`pandoc` executable is
  available. If a TeX-capable toolchain is installed later, the same command
  attempts to compile `main.tex` in a temporary directory and passes only when a
  non-empty PDF is produced.
- Added `docs/paper/emotional-residue/release/PDF_VERIFICATION_PROTOCOL.md`,
  `docs/paper/emotional-residue/release/PDF_VERIFICATION.json`, and
  `scripts/paper/paper_pdf_verification_audit.py` /
  `npm run paper:pdf-verification-audit` as the rendered-PDF/platform-preview
  evidence gate. The current expected result is `PDF_BLOCKER` until a real
  rendered PDF and platform preview are visually inspected and recorded with
  tool/environment/source-archive hash/PDF hash/checklist details.
- Added `docs/paper/emotional-residue/release/SUBMISSION_DECISIONS.json` plus
  `scripts/paper/paper_submission_audit.py` /
  `npm run paper:submission-audit` as an Alan-facing submitter-decision gate.
  The current expected result is `EXTERNAL_BLOCKERS` until Alan confirms author
  identity, affiliation, email, category, arXiv account readiness, license,
  upstream attribution comfort, transcript policy, timing, rendered PDF, and
  platform preview.
- Added `scripts/paper/build_arxiv_source_package.py` /
  `npm run paper:arxiv-package` as a local allowlisted source bundle builder.
  The current archive contains only `main.tex`, with datasets/logs/annotations/
  transcript packets/figures/results excluded by design.
- Added `docs/paper/emotional-residue/release/ARXIV_PREPRINT_RELEASE_PACKET.md` as the A-path release
  packet. It captures conservative positioning, local package paths,
  recommended-but-unconfirmed submitter decisions, official arXiv doc checks,
  stop conditions, and the B-path empirical follow-up.
- Added `docs/paper/emotional-residue/release/OSF_RELEASE_RECORD.md` after Alan reported submitting the
  conservative A-path preprint on OSF because arXiv upload is blocked by
  endorsement. Public OSF URL / DOI remain `TO_RECORD` until Alan provides
  them.
- Added `scripts/paper/paper_archive_audit.py` /
  `npm run paper:archive-audit` as a generated-source-archive hygiene audit.
  It rebuilds the local source archive, verifies the manifest and SHA values,
  requires the member list to stay on the allowlist, and checks for accidental
  data/results/annotation/transcript or obvious secret leakage. This reflects
  final file-review discipline before any external release, but performs no
  upload.
- Added `scripts/paper/paper_readiness_report.py` /
  `npm run paper:readiness` as the combined local readiness report. The current
  expected verdict is `LOCAL_SOURCE_READY_WITH_WARNINGS`; the warning is that
  public author metadata now appears in `main.tex` while local submitter
  decision JSON remains unconfirmed. Empirical, external, and PDF blockers are
  still listed explicitly.
- Expanded related work with MemoryBank, LongMem, MemGPT, Reflexion, Voyager,
  a recent LLM-agent memory survey, and social-agent evaluation context from
  SOTOPIA / Lifelong SOTOPIA.
- Added reproducibility disclosure for the local/cloud model policy paths:
  smoke-only `qwen2.5:1.5b`, general local Ollama default `qwen3:8b`, and
  character-soul OpenAI-compatible Qwen default `qwen3-max`. The manuscript also
  states that current datasets do not store per-conversation provider/model
  metadata, so provider-controlled comparisons are out of scope.
- Updated future ablation runners and `report_to_dataset.py` so newly collected
  ablation rows can carry run-level `generation_metadata` snapshots plus
  `run_provenance` evidence for git state, accepted document hashes,
  source-archive hash, command args, runtime, and secret-redaction policy.
  Existing n=4 pilot rows were not backfilled; the empirical audit correctly
  keeps them blocked for missing metadata/provenance.
- Added `scripts/paper/paper_run_provenance_audit.py` /
  `npm run paper:run-provenance-audit -- --run-dir <arm-window-dir>` so each
  completed long-window run can be checked for metadata/provenance/row/log/hash
  consistency before merging.
- Created `docs/paper/emotional-residue/manuscript/main.tex` with no `[FILL]` placeholders and no raw
  Chinese transcript examples.
- Added an explicit manuscript scope/ethics limitation: author-observed
  single-player prototype, no external participants recruited or recorded, no
  IRB or human-subjects approval claimed, raw player-conversation transcripts
  excluded from the source archive, and controlled player study future work.

## Remaining Posting / Submission Records

- OSF public URL and DOI, if assigned.
- Confirm whether the submitted OSF file is
  `docs/paper/emotional-residue/results/osf/emotional-residue-osf-preprint.pdf`.
- OSF license/visibility metadata.
- arXiv account/endorsement readiness if Alan still wants an arXiv mirror.
- Author name, affiliation, and email in local source if the arXiv/source
  package should later match the public OSF metadata.
- Whether to include any raw player/Alan transcript excerpts in a later version.
- Whether to keep collecting longitudinal ablation blocks until at least
  `n=40` qualifying archived records per arm before posting a stronger empirical
  version.
- Whether to accept `docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md` before resuming any
  cloud-provider collection.
- Recruit at least one additional blind rater if Alan wants empirical metric
  validation before posting.

## Verification Run

- `python3 scripts/paper/report_to_dataset.py --selftest`
- `python3 scripts/paper/attach_rolling_callbacks.py --selftest`
- `/tmp/ai-town-paper-venv/bin/python scripts/paper/analyze.py --selftest`
- `npm run eval:soul-triad`
- `npm run underworld:rolling-continuity -- --date=2026-06-05`
- `python3 scripts/paper/report_to_dataset.py --report evals/conversations/reports/soul-triad-latest.md --condition residue_on --out docs/paper/emotional-residue/data/current-smoke/dataset.json`
- `python3 scripts/paper/attach_rolling_callbacks.py --dataset docs/paper/emotional-residue/data/current-smoke/dataset.json --rolling-report umi/reports/rolling-continuity-latest.md --out docs/paper/emotional-residue/data/current-smoke/dataset.json --mark-other-zero`
- `/tmp/ai-town-paper-venv/bin/python scripts/paper/analyze.py --dataset docs/paper/emotional-residue/data/current-smoke/dataset.json --outdir docs/paper/emotional-residue/results/current-smoke`
- `npx tsc --noEmit --pretty false`
- `git diff --check`
- repeated `analyze.py` on the same dataset twice and checked identical CSV
  SHA-1 hashes
- `npm run underworld:rolling-continuity -- --date=2026-06-04`
- `npm run underworld:rolling-continuity -- --date=2026-06-06`
- Legacy forced-pilot commands, if reproduced for mechanism debugging only,
  now require `--allow-legacy-forced-pilot`; do not use them for the primary
  long-window experiment.
- `npm run paper:residue-ablation -- --samples-per-arm=3 --allow-legacy-forced-pilot --python=/tmp/ai-town-paper-venv/bin/python`
- `npm run paper:residue-ablation -- --samples-per-arm=3 --order=off,on --post-collection-wait-ms=90000 --allow-legacy-forced-pilot --python=/tmp/ai-town-paper-venv/bin/python`
- `npm run paper:residue-ablation -- --samples-per-arm=1 --order=on,off --sample-timeout-ms=300000 --post-collection-wait-ms=0 --allow-legacy-forced-pilot --python=/tmp/ai-town-paper-venv/bin/python`
- `npm run paper:residue-ablation -- --samples-per-arm=1 --order=off,on --sample-timeout-ms=300000 --post-collection-wait-ms=0 --allow-legacy-forced-pilot --python=/tmp/ai-town-paper-venv/bin/python`
- `npm run paper:merge-ablation-runs -- --runs 'docs/paper/emotional-residue/results/arm-window-*' --out docs/paper/emotional-residue/results/longitudinal/dataset.json --manifest docs/paper/emotional-residue/results/longitudinal/merge-manifest.json`
- For reproducing the current legacy pilot only: `python3 scripts/paper/merge_ablation_runs.py --runs 'docs/paper/emotional-residue/results/ablation-*' --out docs/paper/emotional-residue/results/longitudinal/dataset.json`
- `/tmp/ai-town-paper-venv/bin/python scripts/paper/analyze.py --dataset docs/paper/emotional-residue/results/longitudinal/dataset.json --outdir docs/paper/emotional-residue/results/longitudinal`

- `node --check scripts/paper/run_arm_pure_residue_window.mjs`
- `node --check scripts/underworld-rolling-continuity.mjs`
- `npm run paper:residue-arm-window -- --selftest`
- `npm run paper:residue-arm-window:acceptance` (expected failure while
  `SCHEDULE_ACCEPTANCE.json` and `PREREGISTRATION_ACCEPTANCE.json` are not both
  accepted)
- temporary accepted schedule JSON plus temporary rejected preregistration JSON
  with `node scripts/paper/run_arm_pure_residue_window.mjs
  --check-acceptance-only --acceptance-file=<tmp-schedule>
  --preregistration-acceptance-file=<tmp-prereg>` expected failure with exit 2;
  temporary accepted versions of both JSON files expected PASS with no
  collection
- `npm run underworld:rolling-continuity:self-test`
- `/tmp/ai-town-paper-venv/bin/python scripts/paper/analyze.py --selftest`
- `python3 scripts/paper/attach_rolling_callbacks.py --selftest`
- `python3 scripts/paper/power_sensitivity.py --selftest`
- `python3 scripts/paper/export_annotation_sheet.py --selftest`
- `python3 scripts/paper/export_blinded_transcripts.py --selftest`
- `python3 scripts/paper/paper_annotation_audit.py --selftest`
- `python3 scripts/paper/paper_empirical_audit.py --selftest`
- `python3 scripts/paper/paper_trace_overlap_audit.py --selftest`
- `python3 scripts/paper/paper_evidence_matrix_audit.py --selftest`
- `python3 scripts/paper/paper_claim_audit.py --selftest`
- `python3 scripts/paper/paper_source_audit.py --selftest`
- `python3 scripts/paper/paper_consistency_audit.py --selftest`
- `python3 scripts/paper/paper_protocol_audit.py --selftest`
- `python3 scripts/paper/paper_design_audit.py --selftest`
- `python3 scripts/paper/paper_mechanism_audit.py --selftest`
- `python3 scripts/paper/paper_pdf_preflight.py --selftest`
- `python3 scripts/paper/paper_pdf_verification_audit.py --selftest`
- `python3 scripts/paper/paper_submission_audit.py --selftest`
- `python3 scripts/paper/build_arxiv_source_package.py --selftest`
- `python3 scripts/paper/paper_archive_audit.py --selftest`
- `python3 scripts/paper/paper_readiness_report.py --selftest`
- `python3 scripts/paper/power_sensitivity.py --outdir docs/paper/emotional-residue/results/power`
- `python3 scripts/paper/export_annotation_sheet.py --dataset docs/paper/emotional-residue/results/longitudinal/dataset.json --out-sheet docs/paper/emotional-residue/results/longitudinal/annotation_sheet.csv --out-key docs/paper/emotional-residue/results/longitudinal/annotation_key.csv --target 30`
- `python3 scripts/paper/export_blinded_transcripts.py --key docs/paper/emotional-residue/results/longitudinal/annotation_key.csv --outdir docs/paper/emotional-residue/results/longitudinal/blinded_transcripts`
- `rg -n "residue_on|residue_off|rolling_callback|conversation-c:|condition|callback|Score|PASS|WARN" docs/paper/emotional-residue/results/longitudinal/blinded_transcripts || true` (no leakage)
- `/tmp/ai-town-paper-venv/bin/python scripts/paper/analyze.py --dataset docs/paper/emotional-residue/results/longitudinal/dataset.json --outdir docs/paper/emotional-residue/results/longitudinal`
- `npm run paper:claim-audit` (expected `PASS_CONSERVATIVE_PREPRINT` while
  empirical/external blockers remain)
- `npm run paper:annotation-audit` (expected `PACKET_READY_INCOMPLETE_STUDY`;
  packet blinding/schema pass, no merged `annotations.csv` yet)
- `npm run paper:empirical-audit` (expected
  `PILOT_ONLY_INCOMPLETE_ABLATION`; dataset is pipeline evidence only)
- `npm run paper:trace-overlap-audit` (expected
  `PILOT_ONLY_TRACE_OVERLAP_AUDIT`; overlap check is wired but callback sample
  size is too small for validation)
- `npm run paper:evidence-matrix-audit` (expected `PASS`; major claims map to
  evidence artifacts and boundaries)
- `npm run paper:source-audit` (expected `PASS`; PDF compilation still not
  verified locally)
- `npm run paper:consistency-audit` (expected `PASS`; checked manuscript
  numbers match generated artifacts)
- `npm run paper:protocol-audit` (expected `PASS`; schedule/preregistration/
  acceptance/runner gate aligned, collection still paused)
- `npm run paper:design-audit` (expected `EMPIRICAL_DESIGN_BLOCKED`; causal and
  mechanism claims remain blocked beyond conservative-preprint framing)
- `npm run paper:mechanism-audit` (expected `PASS`; manuscript residue
  architecture matches current code paths)
- `npm run paper:pdf-preflight` (expected `PDF_BLOCKER` on this machine until a
  TeX/PDF toolchain is installed)
- `npm run paper:pdf-verification-audit` (expected `PDF_BLOCKER` until a real
  rendered PDF/platform preview is inspected and recorded)
- `npm run paper:submission-audit` (expected `EXTERNAL_BLOCKERS` until Alan
  confirms local submitter decisions)
- `npm run paper:arxiv-package` (expected archive files: `main.tex` only)
- `npm run paper:archive-audit` (expected `PASS`; archive and manifest are
  allowlisted and leakage-free)
- `npm run paper:readiness` (expected
  `LOCAL_SOURCE_READY_WITH_WARNINGS`, with empirical/external/PDF
  blockers still visible)

## Not Verified Locally

- PDF compilation: `tectonic`, `latexmk`, `pdflatex`, `xelatex`, `lualatex`,
  and `pandoc` were not installed on this machine during preparation.
- arXiv upload preview: this requires Alan's arXiv account and final submitter
  confirmation.

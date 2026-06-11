# arXiv / Source Package

This directory contains the current local source draft for the emotional
residue manuscript.

Status on 2026-06-10: Alan reported that the conservative A-path preprint was
submitted on OSF because arXiv upload is blocked by endorsement. This directory
still contains the TeX/source package used for local source audits and a future
arXiv mirror; it does not mean the paper has been posted to arXiv.

## Files

- `main.tex` - single-file LaTeX source, no BibTeX dependency.

## Local Source Audit

Run from the repository root:

```bash
npm run paper:source-audit
npm run paper:annotation-audit
npm run paper:empirical-audit
npm run paper:trace-overlap-audit
npm run paper:evidence-matrix-audit
npm run paper:citation-audit
npm run paper:consistency-audit
npm run paper:protocol-audit
npm run paper:design-audit
npm run paper:mechanism-audit
npm run paper:pdf-preflight
npm run paper:pdf-verification-audit
npm run paper:submission-audit
npm run paper:arxiv-package
npm run paper:archive-audit
npm run paper:readiness
```

This verifies source-level hygiene (labels, citations, table shape, placeholders,
and package notes), checks the annotation packet/blinding contract, checks
whether the longitudinal ablation dataset is still pilot-only or empirically
complete, checks whether available rolling-continuity callbacks show obvious
residue-to-dialogue quotation, checks the claim-evidence matrix, checks
the citation provenance ledger, checks
selected manuscript numbers against generated artifacts, checks the
schedule/acceptance/runner gate, writes `docs/paper/results/source-audit.md`,
`docs/paper/results/annotation-audit.md`,
`docs/paper/results/consistency-audit.md`, and
`docs/paper/results/protocol-audit.md`, checks whether the causal/mechanism
design and preregistration protocol remain blocked or ready beyond
conservative-preprint framing, verifies
that the manuscript's residue
architecture maps to the current write/read code paths, checks whether the
source can be rendered by a local PDF-capable toolchain, checks whether Alan's
local PDF/platform verification record is complete and tied to the current
source archive, checks whether Alan's local submitter decisions are explicitly
recorded, and builds a local
allowlisted source
archive at
`docs/paper/results/arxiv-source/emotional-residue-arxiv-source.tar.gz`.
`paper:archive-audit` then rebuilds that archive, verifies the manifest and
member allowlist, and checks for accidental data/results/annotation/transcript
or obvious secret leakage.
The archive currently contains only `main.tex`; generated data, logs,
annotations, transcript packets, figures, and results are excluded by design.
This does not replace compiling the PDF or checking the arXiv preview.
For the human-validation path, completed independent rater worksheets must be
merged with `npm run paper:annotation-merge` before `annotations.csv` can be
used by the analysis pipeline; the blank blinded worksheet alone is not
evidence of completed ratings.
If `paper:pdf-preflight` reports `PDF_BLOCKER`, local rendering remains
unverified because no suitable toolchain was found on this machine.
If `paper:pdf-verification-audit` reports `PDF_BLOCKER`, a rendered PDF and
platform preview still have not been inspected and recorded in
`docs/paper/PDF_VERIFICATION.json`.
If `paper:submission-audit` reports `EXTERNAL_BLOCKERS`, fill
`docs/paper/SUBMISSION_DECISIONS.json` only after Alan confirms the listed
metadata, license, timing, attribution, and preview choices.
`paper:readiness` writes `docs/paper/results/readiness.md` and summarizes the
current local source verdict plus remaining empirical/external/PDF blockers.
For the shortest human-readable boundary, read `docs/paper/ALAN_HANDOFF.md`.
For likely reviewer objections, read `docs/paper/REVIEWER_PREMORTEM.md`.

## Intended arXiv Metadata

- Title: `Emotional Residue: A Lightweight Memory Pattern for Trace-Based Continuity in LLM-Driven Character Agents`
- Suggested primary category: `cs.HC`
- Suggested cross-list: `cs.AI`
- Draft type: design/systems technical report with preliminary feasibility evidence
- Submission status: OSF submitted by Alan; arXiv mirror paused pending
  endorsement/account readiness
- Local readiness verdict: `LOCAL_SOURCE_READY_WITH_WARNINGS`; this is
  not a completed empirical-effect package.
- Evidence status: no completed causal ablation or player study; current
  wording intentionally limits claims to feasibility and inspectability.

## Final Checks Before arXiv Upload / Mirror

- Record OSF public URL / DOI in `docs/paper/OSF_RELEASE_RECORD.md`.
- Confirm author line, affiliation, and email.
- Confirm arXiv account/endorsement status for the chosen category.
- Confirm license choice in the arXiv submission UI.
- Confirm upstream AI Town license attribution.
- Confirm whether Alan/player transcript snippets can be published; the current
  LaTeX draft avoids raw player transcript excerpts.
- Compile with PDFLaTeX or arXiv's TeX processor and inspect the generated PDF.
- Run `npm run paper:source-audit` and confirm it reports `PASS`.
- Run `npm run paper:annotation-audit` and confirm the packet is either complete
  or explicitly reported as an incomplete study.
- Run `npm run paper:empirical-audit` and confirm the longitudinal ablation
  evidence is either complete or explicitly reported as pilot-only.
- Run `npm run paper:trace-overlap-audit` and confirm the trace-overlap check is
  either validated or explicitly reported as pilot-only.
- Run `npm run paper:evidence-matrix-audit` and confirm all major claims map to
  current artifacts and boundaries.
- Run `npm run paper:citation-audit` and confirm every bibliography key has a
  provenance row, with primary/official sources for recent LLM-agent and AI
  Town references.
- Run `npm run paper:consistency-audit` and confirm checked manuscript numbers
  still match generated artifacts.
- Run `npm run paper:protocol-audit` and confirm the schedule, acceptance file,
  preregistration acceptance file, runner, and npm scripts are aligned.
- Run `npm run paper:design-audit` and confirm causal/mechanism claims are
  either ready or explicitly blocked, including preregistration acceptance,
  final-N, annotation, and placebo-status boundaries.
- Run `npm run paper:mechanism-audit` and confirm the manuscript/code-path
  alignment report is `PASS`.
- Run `npm run paper:pdf-preflight`; if it reports `PDF_BLOCKER`, compile in
  another TeX-capable environment before external posting.
- Run `npm run paper:pdf-verification-audit`; if it reports `PDF_BLOCKER`,
  inspect a rendered PDF/platform preview and record the verification details
  in `docs/paper/PDF_VERIFICATION.json` before external posting.
- Run `npm run paper:submission-audit` and confirm Alan's local submitter
  decisions are recorded.
- Run `npm run paper:arxiv-package` and confirm the archive manifest lists only
  intended TeX source files.
- Run `npm run paper:archive-audit` and confirm the generated archive contains
  only allowlisted source files and no data/results/annotation/transcript or
  obvious secret leakage.
- Run `npm run paper:readiness` and confirm the verdict and blockers match the
  intended submission timing.
- Verify title and abstract metadata before final `Submit Article`.

Local note: this machine did not have `pdflatex`, `latexmk`, or `pandoc`
available during package preparation, so PDF compilation must be verified in an
environment with TeX installed or in the arXiv preview step.

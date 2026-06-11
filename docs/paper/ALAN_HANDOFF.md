# Alan Handoff: Emotional-Residue Paper

Status on 2026-06-10: the package is locally source-ready as a conservative
design/systems preprint source, and Alan reported submitting that A-path
preprint on OSF because arXiv upload is blocked by endorsement. It is not an
empirical effect paper.

## TL;DR

- Defensible now: emotional residue as a lightweight, inspectable write/read
  memory pattern for LLM-driven character agents.
- Not defensible yet: residue improves felt continuity, callback rate, or
  player experience.
- Current readiness command: `npm run paper:readiness`
- Current readiness verdict: `LOCAL_SOURCE_READY_WITH_WARNINGS`
- A-path release packet:
  `docs/paper/ARXIV_PREPRINT_RELEASE_PACKET.md`
- OSF release record:
  `docs/paper/OSF_RELEASE_RECORD.md`
- Citation provenance is tracked in `docs/paper/CITATION_PROVENANCE.md`; it
  covers every bibliography key and keeps final copyediting separate from
  empirical/PDF/submission blockers.
- Outside release status: Alan reported an OSF submission; public OSF URL / DOI
  are still `TO_RECORD` locally. A local OSF-ready PDF now exists at
  `docs/paper/results/osf/emotional-residue-osf-preprint.pdf`. arXiv is not
  posted because endorsement is still required.
- No new long-window cloud collection should run until
  `docs/paper/SCHEDULE_DECISION.md` and
  `docs/paper/PREREGISTRATION_PROTOCOL.md` are accepted by Alan.

## What The Current Paper Can Say

The current source can say that Underworld implements emotional residue as:

- one bounded same-pair trace line;
- readback of at most two recent traces;
- pressure on attention, avoidance, tone, and initiative rather than quotation;
- separate write/read flags;
- deterministic rule-based smoke metrics;
- a runnable ablation and annotation pipeline.

It can also report feasibility artifacts:

- 8 recent soul-triad conversations as a deterministic feasibility snapshot;
- a June 5, 2026 rolling-continuity report with archived-window callback
  diagnostics;
- two archived-only sanity blocks producing n=2/arm pipeline evidence;
- a blind annotation packet that is schema/blinding ready but unrun.
- a pilot trace-overlap audit over 11 rolling-callback cases, with max overlap
  ratio 0.242 and no high verbatim-overlap flag; this is hygiene evidence, not
  validation.

## What It Must Not Say Yet

Do not present the current package as showing that residue improves:

- player-perceived continuity;
- callback probability;
- emotional aftertaste;
- character quality;
- population-level outcomes.

The empirical blockers are still open:

- total longitudinal n=4, with residue_on=2 and residue_off=2;
- only one dyad in the merged longitudinal pilot;
- no merged `annotations.csv` from completed independent rater sheets;
- current aftertaste proxy is saturated;
- window metadata are not yet long-window/arm-pure;
- existing n=4 pilot rows lack run-level provider/model metadata;
- trace-overlap audit has only 11 callback cases, below the 30-case validation
  threshold;
- read-off still has prompt-shape and motif-guard confounds.
- causal/mechanism design is blocked until the schedule is accepted, final N is
  fixed from pilot baseline/yield, preregistration is accepted, annotation
  reaches the minimum, and either a length-matched placebo arm is implemented or
  the narrowed read-block suppression claim is kept.
- manuscript ethics scope is conservative: author-observed single-player
  prototype, no external participants recruited or recorded, no IRB or
  human-subjects approval claimed, and raw player-conversation transcripts are
  excluded from the source archive.

## Release / Posting Status

- OSF: submitted by Alan on 2026-06-10; public URL / DOI still need to be
  recorded in `docs/paper/OSF_RELEASE_RECORD.md`.
- arXiv: not posted; blocked by endorsement/account readiness.
- Empirical B-path: not complete and should not be implied by the OSF posting.

## Before Any Further Outside Release Decision

Alan must decide:

- author name, affiliation, and email;
- public author identity;
- primary category, likely `cs.HC` or `cs.AI`;
- license;
- arXiv account and endorsement readiness;
- comfort with AI Town upstream attribution;
- whether raw transcript excerpts remain excluded;
- timing: conservative design/systems source now, empirical ablation first, or
  hold.

Tooling still needs:

- rendered PDF verification;
- platform preview verification;
- TeX toolchain or another trusted render path.
- `docs/paper/PDF_VERIFICATION.json` must remain false/blank until the rendered
  PDF and platform preview are actually inspected; `npm run
  paper:pdf-verification-audit` enforces that record.

## Before Claiming An Empirical Effect

The stronger empirical version needs:

- explicit Alan acceptance of `docs/paper/SCHEDULE_DECISION.md`;
- explicit Alan acceptance of `docs/paper/PREREGISTRATION_PROTOCOL.md`;
- matching accepted JSON gates in `docs/paper/SCHEDULE_ACCEPTANCE.json` and
  `docs/paper/PREREGISTRATION_ACCEPTANCE.json`;
- arm-pure long-window collection;
- at least n=40 qualifying archived records per arm only as a large-effect
  pilot threshold; final per-arm N must be preregistered from pilot
  baseline/yield and may be n>=150 per arm, or higher, for 10--15 percentage
  point effects;
- at least 3 dyads and multiple windows;
- cluster-sensitivity planning using dyad/day/window design-effect assumptions;
- a length-matched placebo or a narrowed read-path mechanism claim;
- trace-to-dialogue verbatim-overlap measurement;
- run-level provider/model metadata and `run_provenance` stored on each new
  ablation row, including git state, accepted schedule/preregistration hashes,
  source archive hash, command args, runtime, and secret-redaction policy;
- `npm run paper:run-provenance-audit -- --run-dir <arm-window-dir>` passing
  for each completed long-window run before those rows are merged;
- at least 2 blind raters over at least 30 balanced transcripts;
- blinded rater packet manifests (`annotation_packet_manifest.json` and
  `transcript_packet_manifest.json`) proving the pre-rater sheet/key/transcript
  hashes, selected blind ids, source reports, missing-transcript status, and
  blinding flags;
- merged `annotations.csv` plus `annotations_manifest.json` proving the rater
  sheet hashes, key hash, row counts, and blinding contract;
- agreement and convergent-validity statistics.

## Source Package

The allowlisted source archive is:

`docs/paper/results/arxiv-source/emotional-residue-arxiv-source.tar.gz`

The archive intentionally contains only `main.tex`. It excludes datasets,
annotation packets, transcript packets, figures, logs, and generated reports.
`npm run paper:archive-audit` rebuilds and verifies this local archive/manifest
allowlist and checks for accidental data, transcript, annotation, or obvious
secret leakage. It does not upload anything.

## Current One-Line Boundary

The paper currently supports a lightweight, inspectable residue memory pattern
and a working evaluation/ablation pipeline; it does not yet support causal,
population-level, or player-experience claims about residue improving felt
continuity.

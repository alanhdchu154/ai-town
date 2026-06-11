# arXiv Conservative Preprint Release Packet

Status on 2026-06-10: this packet prepared the A path as a conservative arXiv
design/systems preprint package, but Alan reported that arXiv upload is blocked
by endorsement and that the preprint was submitted on OSF instead. This packet
remains useful for a future arXiv mirror; it does not authorize or perform any
external posting by itself.

## Paper Positioning

Title:

`Emotional Residue: A Lightweight Memory Pattern for Trace-Based Continuity in LLM-Driven Character Agents`

Defensible contribution:

- a lightweight write/read memory pattern for LLM-driven character agents;
- a bounded same-pair residue trace that is read back as behavioral pressure,
  not quotation;
- static mechanism/code-path alignment for the current Underworld
  implementation;
- deterministic feasibility, analysis-determinism, trace-overlap, and pipeline-sanity
  artifacts;
- a future empirical study plan with acceptance gates that currently prevent
  accidental live collection.

Not claimed in this version:

- residue improves player-perceived continuity;
- residue improves callback rate or emotional aftertaste;
- the read-off or placebo arms establish a completed causal mechanism;
- human annotation or player-study validation is complete.

## Local Package

Current source package:

- source: `docs/paper/arxiv/main.tex`
- archive: `docs/paper/results/arxiv-source/emotional-residue-arxiv-source.tar.gz`
- manifest: `docs/paper/results/arxiv-source/manifest.json`
- archive SHA-256:
  `d9a7b2a928403b12976b9422381b5353a340394728c840b54375c59097c5e911`
- member allowlist: `main.tex` only
- excluded by design: datasets, ablation logs, annotation sheets/keys, blinded
  transcript packets, generated figures/results

The archive audit rebuilds this package locally and performs no upload.

## Current Posting Route

- OSF: submitted by Alan on 2026-06-10; URL / DOI still need to be recorded in
  `docs/paper/OSF_RELEASE_RECORD.md`.
- arXiv: paused until endorsement/account readiness is resolved.
- Claim boundary: still conservative design/systems preprint only.

## Recommended Submitter Decisions

These are recommendations, not confirmed metadata. Fill
`docs/paper/SUBMISSION_DECISIONS.json` only after Alan explicitly confirms.

| Field | Recommended value | Why |
|---|---|---|
| `author_name` | Alan's public academic/professional name | Required author metadata. |
| `affiliation` | Independent Researcher, or a confirmed institutional line | Use only a line Alan is comfortable making public; do not imply institutional endorsement from the project name. |
| `contact_email` | A public email Alan is comfortable exposing | arXiv metadata is public. |
| `public_author_identity_confirmed` | `true` only after Alan confirms | Do not infer this from repo ownership. |
| `primary_category` | `cs.HC` | Best fit for interaction, felt continuity, and agent experience framing. |
| `cross_list_categories` | `["cs.AI"]` if arXiv allows it during submission | Useful secondary fit for LLM agents; primary should remain HCI-facing. |
| `license_choice` | `arxiv-default` for conservative control, or `cc-by-4.0` for broad reuse | This is an author/legal preference, not a technical decision. |
| `upstream_ai_town_attribution_confirmed` | `true` only after final attribution review | The manuscript already names AI Town lineage; Alan must be comfortable. |
| `raw_player_transcript_policy` | `avoid_raw_excerpts` | Keeps private/player transcripts out of the source package. |
| `posting_timing_decision` | `conservative_preprint_now` | This is the A path; empirical B remains future work. |

## Required Before arXiv Upload

1. Confirm `SUBMISSION_DECISIONS.json`.
2. Replace the author placeholder in `docs/paper/arxiv/main.tex`.
3. Build or preview the PDF.
4. Inspect the rendered PDF:
   - title, author, abstract;
   - tables and line wrapping;
   - citations/references;
   - visible limitations;
   - no raw transcripts, local secrets, or sensitive files.
5. Inspect the arXiv platform preview.
6. Fill `docs/paper/PDF_VERIFICATION.json` with real render details and PDF
   SHA-256.
7. Rerun:

```bash
npm run paper:submission-audit
npm run paper:pdf-preflight
npm run paper:pdf-verification-audit
npm run paper:readiness
```

## Official arXiv Checks

Use current arXiv documentation at release time:

- TeX/LaTeX submission help:
  `https://info.arxiv.org/help/submit_tex.html`
- TeX Live at arXiv:
  `https://info.arxiv.org/help/faq/texlive.html`
- Submission guidelines:
  `https://info.arxiv.org/help/submit/index.html`
- Licenses:
  `https://info.arxiv.org/help/license/index.html`
- Endorsement:
  `https://info.arxiv.org/help/endorsement.html`
- Submission agreement:
  `https://info.arxiv.org/help/policies/submission_agreement.html`

As of the checked 2026-06-10 documentation, arXiv accepts TeX/LaTeX source,
requires registered authors, may require endorsement for first submissions or
new categories, requires an irrevocable distribution license, and supports
Creative Commons license choices in addition to the default arXiv license.

## Stop Conditions

Do not upload or submit if any of these are true:

- author identity, affiliation, email, category, account, license, or timing is
  still blank or placeholder-like;
- the source author block still says `Author details to confirm before
  submission`;
- rendered PDF has not been inspected;
- arXiv platform preview has not been inspected;
- the manuscript wording implies completed causal, player-study, or human
  annotation evidence;
- the source package includes data, results, transcript packets, annotation
  keys, logs, figures, or secrets.

## B Path After A

After the conservative preprint is posted, the next paper version should run
the B path:

- accept the schedule and preregistration before collection;
- run arm-pure long-window collection;
- collect enough residue-on/off and, ideally, placebo rows;
- cover multiple dyads and windows;
- complete two-rater blind annotation;
- validate trace-overlap on at least 30 callback cases;
- rewrite the results section around real effect estimates and human agreement.

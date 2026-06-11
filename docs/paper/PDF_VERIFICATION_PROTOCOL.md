# PDF Verification Protocol

Status on 2026-06-09: **not verified**. This protocol records what must be true
before the paper can be treated as rendered-PDF or platform-preview ready.

## Purpose

Source readiness is not PDF readiness. A local archive can be hygienic while the
rendered paper still has broken citations, bad table layout, wrong metadata, or
missing limitations. Before any external release, the rendered PDF and platform
preview must be checked explicitly.

## Required Evidence

Fill `docs/paper/PDF_VERIFICATION.json` only after all of the following are
actually true:

- A TeX-capable tool or platform preview rendered the allowlisted source archive.
- The rendered PDF was inspected visually.
- The title, author line, abstract, section headings, tables, citations, and
  acknowledgements render correctly.
- The limitations and non-empirical claim boundary remain visible.
- No raw Alan/player transcript excerpts, annotation keys, datasets, logs,
  generated results, or obvious secrets are present in the rendered artifact.
- The rendered source archive SHA-256 matches the current
  `docs/paper/results/arxiv-source/manifest.json` archive hash.
- The rendered PDF SHA-256 is recorded.

## JSON Contract

`docs/paper/PDF_VERIFICATION.json` is the local record. Required fields:

- `pdf_render_verified`
- `platform_preview_verified`
- `verified_by`
- `verified_at`
- `render_tool`
- `render_environment`
- `source_archive_sha256`
- `rendered_pdf_sha256`
- `visual_checks.title_author_abstract_checked`
- `visual_checks.tables_checked`
- `visual_checks.citations_checked`
- `visual_checks.no_raw_transcripts_or_sensitive_files`
- `visual_checks.limitations_visible`

The fields should stay blank or `false` until the check has actually happened.
Do not copy hashes from a stale archive after `main.tex` changes; rerun
`npm run paper:arxiv-package`, `npm run paper:archive-audit`, and
`npm run paper:pdf-verification-audit`.

## Current Local Constraint

On this machine, `npm run paper:pdf-preflight` currently reports `PDF_BLOCKER`
because no local `tectonic`, `latexmk`, `pdflatex`, `xelatex`, `lualatex`, or
`pandoc` executable is available. That does not invalidate the TeX source, but
it means rendered-PDF readiness remains unverified.

## Boundary

This protocol is local and read-only until Alan explicitly provides real
verification details. It does not upload, submit, or contact any external
service.

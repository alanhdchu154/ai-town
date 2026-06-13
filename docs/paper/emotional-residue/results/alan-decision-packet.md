# Alan Decision Packet: Emotional-Residue Paper

Read-only packet. It does not edit files, start collection, render PDFs, or perform external actions.

## Current Verdict

- readiness: `LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY`
- submission decisions: `EXTERNAL_BLOCKERS`
- schedule accepted: `False`
- preregistration accepted: `False`
- posting timing decision: ``

Local source is ready only for a conservative design/systems preprint; empirical, PDF, and external gates remain unresolved.

## What Is Defensible Now

- Emotional residue as a lightweight, inspectable write/read memory pattern.
- Deterministic smoke, repeatability, trace-overlap, and pipeline sanity artifacts.
- Conservative source-level arXiv package, if Alan accepts the remaining external/PDF decisions.

## What Is Not Defensible Yet

- Causal or population-level claims that residue improves felt continuity.
- Completed mechanism isolation via the placebo arm.
- Completed human validation or player-study evidence.
- External posting readiness without author/license/category/account/PDF/platform decisions.

## Top Empirical Blockers

- **schedule_acceptance**: Arm-pure collection schedule is not accepted; do not resume collection.
- **preregistration_acceptance**: Preregistration protocol is not accepted; do not resume collection.
- **longitudinal_sample_size**: Longitudinal ablation is pilot-only: total n=4, residue_on=2, residue_off=2.
- **annotation_rows**: Blind annotation packet has 4 rows; pilot target is at least 30 balanced conversations.
- **placebo_not_preregistered_or_analyzed**: Length-matched placebo has local draft plumbing but is not preregistered, accepted, collected, or analyzed; only the narrowed read-block suppression claim is currently allowed.
- **final_n_not_fixed**: Final N is intentionally not fixed until pilot baseline/yield estimates are available.
- **rater_completion**: No merged annotations.csv found; completed independent rater sheets must be merged through merge_rater_annotations.py.
- **dyad_coverage**: Annotation key has one observed dyad: {'海-真晝': 4}
- **sample_size**: Pilot-only sample size: total n=4, residue_on=2, residue_off=2, residue_placebo=0; planned minimum is at least 40/observed arm and likely higher for small effects.
- **run_coverage**: Only 2 source run(s): {'ablation-2026-06-06T13-20-58-196Z': 2, 'ablation-2026-06-06T13-30-38-681Z': 2}.

## Top External/PDF Blockers

- **EXTERNAL_BLOCKER / author_name**: Author name is not confirmed.
- **EXTERNAL_BLOCKER / public_author_identity**: Public author identity has not been confirmed.
- **EXTERNAL_BLOCKER / primary_category**: Primary category must be one of ['cs.AI', 'cs.CL', 'cs.CY', 'cs.HC', 'cs.MA']; got ''.
- **EXTERNAL_BLOCKER / arxiv_account**: arXiv account/endorsement readiness is not confirmed.
- **EXTERNAL_BLOCKER / license_choice**: License choice must be one of ['arxiv-default', 'cc-by-4.0', 'cc-by-nc-sa-4.0', 'cc-by-sa-4.0', 'cc-zero'].
- **EXTERNAL_BLOCKER / upstream_attribution**: Upstream AI Town attribution comfort is not confirmed.
- **EXTERNAL_BLOCKER / timing_decision**: Timing decision must be one of ['conservative_preprint_now', 'empirical_ablation_first', 'hold'].
- **PDF_BLOCKER / pdf_render_verified**: Rendered PDF has not been verified by Alan/Codex.
- **PDF_BLOCKER / platform_preview_verified**: Platform preview has not been verified.
- **EXTERNAL_BLOCKER / main_author_placeholder**: main.tex still contains the author metadata placeholder.
- **PDF_BLOCKER / pdf_tools**: No local tectonic/latexmk/pdflatex/xelatex/lualatex/pandoc found; PDF compilation remains unverified.

## If Alan Wants To Accept The Empirical Schedule

Only after explicit Alan acceptance, update both acceptance JSON files with the exact templates below, replacing only the timestamp if needed:

## Fill Only After Explicit Alan Acceptance

`docs/paper/emotional-residue/experiments/SCHEDULE_ACCEPTANCE.json`:

```json
{
  "accepted": true,
  "accepted_by": "Alan",
  "accepted_at": "YYYY-MM-DDTHH:MM:SSZ",
  "schedule_document": "docs/paper/emotional-residue/experiments/SCHEDULE_DECISION.md",
  "schedule_date": "2026-06-06",
  "schedule_sha256": "934fdd895b5e61c68a5aa827b54e810534f69be59b2b61a98ee796acc182d5b8",
  "notes": "Alan explicitly accepted the schedule decision before collection."
}
```

`docs/paper/emotional-residue/experiments/PREREGISTRATION_ACCEPTANCE.json`:

```json
{
  "accepted": true,
  "accepted_by": "Alan",
  "accepted_at": "YYYY-MM-DDTHH:MM:SSZ",
  "preregistration_document": "docs/paper/emotional-residue/experiments/PREREGISTRATION_PROTOCOL.md",
  "preregistration_date": "2026-06-06",
  "preregistration_sha256": "cfe64845013bdd5c34817ce1553ce3cc611c21c2b5f34eece267d5ec5e034104",
  "notes": "Alan explicitly accepted the preregistration protocol before collection."
}
```

Then verify, still before collection:

```bash
npm run paper:residue-arm-window:acceptance
npm run paper:protocol-audit
npm run paper:readiness
```

## If Alan Wants External Posting

First fill `docs/paper/emotional-residue/release/SUBMISSION_DECISIONS.json` from this worksheet. It is not pass-ready until all `TO_CONFIRM` / `CHOOSE_ONE` values are replaced and Alan explicitly confirms the booleans:

```json
{
  "author_name": "TO_CONFIRM",
  "affiliation": "TO_CONFIRM",
  "contact_email": "TO_CONFIRM@example.com",
  "public_author_identity_confirmed": false,
  "primary_category": "CHOOSE_ONE: cs.HC | cs.AI | cs.CL | cs.CY | cs.MA",
  "cross_list_categories": [],
  "arxiv_account_ready": false,
  "license_choice": "CHOOSE_ONE: arxiv-default | cc-by-4.0 | cc-by-sa-4.0 | cc-by-nc-sa-4.0 | cc-zero",
  "upstream_ai_town_attribution_confirmed": false,
  "raw_player_transcript_policy": "avoid_raw_excerpts",
  "posting_timing_decision": "CHOOSE_ONE: conservative_preprint_now | empirical_ablation_first | hold",
  "pdf_render_verified": false,
  "platform_preview_verified": false,
  "notes": "Decision worksheet only. Replace CHOOSE_ONE/TO_CONFIRM values and set booleans true only after Alan explicitly confirms them."
}
```

After rendering and inspecting the PDF/platform preview, fill `docs/paper/emotional-residue/release/PDF_VERIFICATION.json` from this evidence template. It is not pass-ready until the rendered PDF SHA and all render details are real:

```json
{
  "pdf_render_verified": true,
  "platform_preview_verified": true,
  "verified_by": "Alan",
  "verified_at": "YYYY-MM-DDTHH:MM:SSZ",
  "render_tool": "TO_RECORD: tectonic | latexmk | pdflatex | arXiv preview | other",
  "render_environment": "TO_RECORD: local machine / arXiv platform preview / other",
  "source_archive_sha256": "099a8fbcdb2c588e3678b850d6f1ba40fc36f563bae3657a434827d857f222ab",
  "rendered_pdf_sha256": "TO_RECORD_64_HEX_SHA256_AFTER_RENDER",
  "visual_checks": {
    "title_author_abstract_checked": true,
    "tables_checked": true,
    "citations_checked": true,
    "no_raw_transcripts_or_sensitive_files": true,
    "limitations_visible": true
  },
  "notes": "Fill only after the rendered PDF and platform preview are actually inspected. Do not use this template as evidence until placeholders are replaced."
}
```

Then rerun:

```bash
npm run paper:submission-audit
npm run paper:pdf-preflight
npm run paper:pdf-verification-audit
npm run paper:readiness
```

## Safe Next Action

Without Alan acceptance, continue only read-only/static hardening. Do not run live collection, mutate Convex env, fabricate rater data, or perform external posting.


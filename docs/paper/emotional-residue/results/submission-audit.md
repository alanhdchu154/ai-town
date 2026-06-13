# Paper Submission Decision Audit

Repository: `/Users/alanhdchu/ai-town`
Verdict: **EXTERNAL_BLOCKERS**

## Severity Counts

- FAIL: 0
- EXTERNAL_BLOCKER: 10
- PDF_BLOCKER: 2
- WARN: 0
- PASS: 0

## Findings

- **EXTERNAL_BLOCKER / author_name**: Author name is not confirmed.
- **EXTERNAL_BLOCKER / affiliation**: Affiliation line is not confirmed.
- **EXTERNAL_BLOCKER / contact_email**: Contact email is missing or not email-shaped.
- **EXTERNAL_BLOCKER / public_author_identity**: Public author identity has not been confirmed.
- **EXTERNAL_BLOCKER / primary_category**: Primary category must be one of ['cs.AI', 'cs.CL', 'cs.CY', 'cs.HC', 'cs.MA']; got ''.
- **EXTERNAL_BLOCKER / arxiv_account**: arXiv account/endorsement readiness is not confirmed.
- **EXTERNAL_BLOCKER / license_choice**: License choice must be one of ['arxiv-default', 'cc-by-4.0', 'cc-by-nc-sa-4.0', 'cc-by-sa-4.0', 'cc-zero'].
- **EXTERNAL_BLOCKER / upstream_attribution**: Upstream AI Town attribution comfort is not confirmed.
- **EXTERNAL_BLOCKER / timing_decision**: Timing decision must be one of ['conservative_preprint_now', 'empirical_ablation_first', 'hold'].
- **PDF_BLOCKER / pdf_render_verified**: Rendered PDF has not been verified by Alan/Codex.
- **PDF_BLOCKER / platform_preview_verified**: Platform preview has not been verified.
- **EXTERNAL_BLOCKER / main_author_identity_unconfirmed**: main.tex contains public author metadata, but public_author_identity_confirmed is false.

## Interpretation

- `PASS` means local submitter decisions are recorded; it does not perform external submission.
- `EXTERNAL_BLOCKERS` means Alan-facing metadata, license, timing, account, attribution, or preview decisions remain unresolved.
- `FAIL` means the decision file or source package has an internal schema/source problem.

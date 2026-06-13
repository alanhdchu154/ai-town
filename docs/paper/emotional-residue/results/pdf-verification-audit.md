# Paper PDF Verification Audit

Repository: `/Users/alanhdchu/ai-town`
Verdict: **PDF_BLOCKER**

## Severity Counts

- FAIL: 0
- PDF_BLOCKER: 2
- PASS: 0

## Findings

- **PDF_BLOCKER / pdf_render_verified**: Rendered PDF has not been verified.
- **PDF_BLOCKER / platform_preview_verified**: Platform preview has not been verified.

## Interpretation

- `PASS` means rendered-PDF and platform-preview verification details are recorded and match the current source archive.
- `PDF_BLOCKER` means verification has not happened yet.
- `FAIL` means verification was claimed but required evidence is missing or stale.
- This audit does not render, upload, or submit anything.

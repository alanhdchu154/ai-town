# Emotion Asset Manifest (F1)

Last updated: 2026-06-11 evening. Code is already wired (CharacterPortrait /
scene-stage fall back: emotion variant → neutral → silhouette), so dropping a
correctly-named PNG into the folder makes it live immediately — no code change
needed. Generation prompts live in `docs/giis-vn-art-spec.md`.

Naming: `public/renders/{slug}-{emotion}.png` (full-body, scene stage) and
`public/portraits/{slug}-{emotion}.png` (bust, cards/conversation). Emotions:
`neutral` / `smiling` / `worried` / `serious`. The no-suffix file
(`{slug}.png`) doubles as neutral for portraits.

## Missing renders (public/renders/)

| Character | neutral | smiling | worried | serious |
|---|---|---|---|---|
| umi | ✅ | ✅ | ✅ | ✅ |
| mahiru | ✅ | ✅ | ✅ | ✅ |
| tianze | ✅ | ✅ | ✅ | ✅ |
| ichinose | ✅ | ✅ | ✅ | ✅ |
| maomao | ✅ | ✅ | ✅ | ✅ |
| sakiko | ✅ | ✅ | ✅ | ✅ |

Completed priority pass: ichinose/maomao/sakiko `neutral` + `smiling` renders
landed on 2026-06-11 and are wired in `data/characterVisuals.ts`, so they no
longer only show serious on stage.

Completed v1 emotion-render matrix: all six core stage characters now have
`neutral`, `smiling`, `worried`, and `serious` large renders wired in
`data/characterVisuals.ts`.

## Missing portraits (public/portraits/)

| Character | neutral (no suffix) | smiling | worried | serious |
|---|---|---|---|---|
| umi | ✅ | ❌ | ❌ | ❌ |
| mahiru | ✅ | ❌ | ❌ | ❌ |
| tianze | ✅ | ❌ | ❌ | ❌ |
| ichinose | ✅ | ❌ | ❌ | ❌ |
| maomao | ✅ | ❌ | ❌ | ✅ |
| sakiko | ✅ | ❌ | ❌ | ✅ |

Remaining after the 2026-06-11 v1 stage-render pass: 0 large renders + 18
portraits = 18 images. The next bounded asset pass should generate bust
portraits only; do not start action-pose renders until the portrait gap is
closed or explicitly deferred.

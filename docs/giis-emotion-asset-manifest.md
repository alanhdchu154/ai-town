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
| umi | ❌ | ✅ | ✅ | ✅ |
| mahiru | ❌ | ✅ | ✅ | ✅ |
| tianze | ✅ | ✅ | ❌ | ✅ |
| ichinose | ❌ | ❌ | ❌ | ✅ |
| maomao | ❌ | ❌ | ❌ | ✅ |
| sakiko | ❌ | ❌ | ❌ | ✅ |

Priority: ichinose/maomao/sakiko `neutral` + `smiling` first (they currently
only ever show serious on stage), then the scattered gaps.

## Missing portraits (public/portraits/)

| Character | neutral (no suffix) | smiling | worried | serious |
|---|---|---|---|---|
| umi | ✅ | ❌ | ❌ | ❌ |
| mahiru | ✅ | ❌ | ❌ | ❌ |
| tianze | ✅ | ❌ | ❌ | ❌ |
| ichinose | ✅ | ❌ | ❌ | ❌ |
| maomao | ✅ | ❌ | ❌ | ✅ |
| sakiko | ✅ | ❌ | ❌ | ✅ |

Total to generate: 14 renders + 18 portraits = 32 images. With the art spec's
per-character prompts this is one batch session in the image pipeline.

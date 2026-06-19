Generated VN-style character renders for large Scene Mode and conversation
surfaces.

Current transparent default-emotion assets:

- `umi-neutral.png`
- `umi-smiling.png`
- `umi-worried.png`
- `umi-serious.png`
- `umi-tired.png`
- `umi-flustered.png`
- `umi-guarded.png`
- `umi-calm.png`
- `mahiru-neutral.png`
- `mahiru-worried.png`
- `mahiru-smiling.png`
- `mahiru-serious.png`
- `mahiru-tired.png`
- `mahiru-flustered.png`
- `mahiru-guarded.png`
- `mahiru-calm.png`
- `ichinose-neutral.png`
- `ichinose-smiling.png`
- `ichinose-worried.png`
- `ichinose-serious.png`
- `ichinose-tired.png`
- `ichinose-flustered.png`
- `ichinose-guarded.png`
- `ichinose-calm.png`
- `tianze-neutral.png`
- `tianze-smiling.png`
- `tianze-worried.png`
- `tianze-serious.png`
- `tianze-tired.png`
- `tianze-flustered.png`
- `tianze-guarded.png`
- `tianze-calm.png`
- `maomao-neutral.png`
- `maomao-smiling.png`
- `maomao-worried.png`
- `maomao-serious.png`
- `maomao-tired.png`
- `maomao-flustered.png`
- `maomao-guarded.png`
- `maomao-calm.png`
- `sakiko-neutral.png`
- `sakiko-smiling.png`
- `sakiko-worried.png`
- `sakiko-serious.png`
- `sakiko-tired.png`
- `sakiko-flustered.png`
- `sakiko-guarded.png`
- `sakiko-calm.png`

These are original generated art assets processed from chroma-key sources in
`tmp/imagegen/`. The current set covers the active core cast with transparent
default-emotion standees, including the corrected female Tianze render. The
earlier Tianze candidate drifted male and was removed before this corrected
asset landed.

Current render framing standard: transparent PNG, 1024x1536 canvas, character
framed as a VN knee-up standee. Umi and Ichinose define the preferred
composition: large character art cropped around the knee/lower-thigh area, not
full-body figures down to the shoes. Tianze, Maomao, and Sakiko were normalized
to that canvas and knee-up composition so Scene Mode uses one visual language.
Maomao and Sakiko were then scale-balanced against the Umi / Tianze / Ichinose /
Mahiru reference group so the perceived character size is closer, not just the
PNG canvas size.
Sakiko's current set is palette-corrected toward her recognizable cold
blue-gray / navy identity colors rather than the earlier purple design drift.

Core emotion switching is landed for all six stage characters across
`neutral`, `smiling`, `worried`, `serious`, `tired`, `flustered`, `guarded`,
and `calm`. Scene Mode reads
`campusSocialState.emotions.currentEmotion` and selects a matching large render
when a variant exists, falling back to each character's default render
otherwise.

Sleep-state illustrations are available under `public/renders/sleep/`:

- `umi-sleep.png`
- `mahiru-sleep.png`
- `maomao-sleep.png`
- `tianze-sleep.png`
- `ichinose-sleep.png`
- `sakiko-sleep.png`

These are display-mode assets, not another emotion in the backend model. Scene
Mode uses them only when a character's current activity/status is classified as
`resting`, so "sleep" stays a visible availability/behavior state rather than a
new emotional stat.

The `tired`, `flustered`, `guarded`, and `calm` variants are provisional
derived assets made from the existing approved render set so the expanded
palette has non-missing UI assets. They are review-gated and can be replaced by
final hand-authored/generated character-sheet variants later.

These are good enough for the current Scene Mode polish pass, but they are not
a locked production character sheet. If final consistency matters, regenerate
the full emotion set from a single approved character design per character.

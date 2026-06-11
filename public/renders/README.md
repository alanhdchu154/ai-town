Generated VN-style character renders for large Scene Mode and conversation
surfaces.

Current transparent default-emotion assets:

- `umi-smiling.png`
- `umi-worried.png`
- `umi-serious.png`
- `mahiru-worried.png`
- `mahiru-smiling.png`
- `mahiru-serious.png`
- `ichinose-serious.png`
- `tianze-neutral.png`
- `tianze-smiling.png`
- `tianze-serious.png`
- `maomao-serious.png`
- `sakiko-serious.png`

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

Core emotion switching is currently landed for Umi, Tianze, and Mahiru. Scene
Mode reads `campusSocialState.emotions.currentEmotion` and selects a matching
large render when a variant exists, falling back to each character's default
render otherwise.

These are good enough for the current Scene Mode polish pass, but they are not
a locked production character sheet. If final consistency matters, regenerate
the full emotion set from a single approved character design per character.

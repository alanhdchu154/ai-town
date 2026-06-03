Drop original anime-inspired portrait PNGs here.

Production UI rule:
The app only loads images from this folder. Files in /public/portrait-references/ are never used directly in UI.

Expected paths:
- /portraits/alan.png
- /portraits/umi.png
- /portraits/tianze.png
- /portraits/ichinose.png
- /portraits/mahiru.png
- /portraits/caocao.png
- /portraits/liubei.png

Optional expression variants:
- /portraits/<slug>-smiling.png
- /portraits/<slug>-worried.png
- /portraits/<slug>-serious.png

The base file is treated as the neutral expression. The UI can request:
- neutral
- smiling
- worried
- serious

Global style:
Anime-inspired visual novel portrait, half-body or chest-up composition, cinematic school/social-sim lighting, expressive eyes, distinct silhouette, polished modern anime rendering, soft gradients, subtle glow, transparent background preferred. Keep all art original; do not copy official anime/game art or screenshots.

Asset checklist:
- If /public/portraits/alan.png exists, Alan uses it; otherwise Alan uses the VN placeholder.
- If /public/portraits/umi.png exists, Umi uses it; otherwise Umi uses the VN placeholder.
- If /public/portraits/tianze.png exists, Tianze uses it through the `Tianze` runtime key; otherwise Tianze uses the VN placeholder.
- If /public/portraits/ichinose.png exists, Ichinose uses it through the `Ichinose` runtime key; otherwise Ichinose uses the VN placeholder.
- If /public/portraits/mahiru.png exists, Mahiru uses it; otherwise Mahiru uses the VN placeholder.
- If /public/portraits/caocao.png exists, CaoCao uses it; otherwise CaoCao uses the VN placeholder.
- If /public/portraits/liubei.png exists, Liu Bei uses it; otherwise Liu Bei uses the VN placeholder.

Reference workflow:
- Store Alan-provided reference images in /public/portrait-references/.
- Use reference images for inspiration only.
- Save final original anime-inspired portraits in this folder.
- Do not ship copyrighted official images or exact copied designs as final portraits.

Prompt guidance for original, non-copyrighted portraits:
- Alan: original anime-style modern tech-school principal/student, black/navy palette, thoughtful chaotic builder, laptop or AI school motif.
- Umi: original anime-style full-body Umi companion with short dark navy bob hair, pink-purple eyes, light gray school cardigan or blazer, white blouse, small blue ribbon bow, navy pleated skirt, dark knee-high socks, brown loafers, clever gentle teasing smile, safe non-sexual character reference pose.
- Tianze: original anime-style full-body mischievous elite transfer student, coral red palette, black/white school blazer, sharp playful eyes, pressure-test energy, safe non-sexual character reference pose.
- Ichinose: original anime-style full-body pink-haired former class leader with angelic demon aura, short side-swept bangs that leave the full face and both eyes clearly visible, rose/navy palette, warm possessive smile, weaponized kindness, yandere-like psychological pressure without fantasy horns, safe non-sexual character reference pose.
- Mahiru: original anime-style full-body gentle student affairs assistant, soft cream/pink palette, kind expression, warm comforting aura, caring school counselor vibe, safe non-sexual character reference pose.
- CaoCao: original anime-style ambitious strategist, red/black palette, confident political smile, sharp eyes, student council power aura.
- LiuBei: original anime-style warm alliance leader, green/gold palette, trustworthy smile, gentle charismatic expression.

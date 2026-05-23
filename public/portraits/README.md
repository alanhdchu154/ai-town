Drop original anime-inspired portrait PNGs here.

Production UI rule:
The app only loads images from this folder. Files in /public/portrait-references/ are never used directly in UI.

Expected paths:
- /portraits/alan.png
- /portraits/umi.png
- /portraits/asuna.png
- /portraits/mai.png
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
- If /public/portraits/asuna.png exists, Asuna uses it; otherwise Asuna uses the VN placeholder.
- If /public/portraits/mai.png exists, Mai uses it; otherwise Mai uses the VN placeholder.
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
- Umi: original anime-style witty assistant principal, teal/blue palette, clever teasing smile, school office outfit, warm but sharp eyes.
- Asuna: original anime-style disciplined executive assistant, red/orange warm palette, composed confident expression, formal school uniform style, organized leader energy.
- Mai: original anime-style mature strategic advisor, purple/black cool palette, dry humor expression, elegant long dark hair, calm analytical gaze.
- Mahiru: original anime-style gentle student affairs assistant, soft cream/pink palette, kind expression, warm comforting aura, caring school counselor vibe.
- CaoCao: original anime-style ambitious strategist, red/black palette, confident political smile, sharp eyes, student council power aura.
- LiuBei: original anime-style warm alliance leader, green/gold palette, trustworthy smile, gentle charismatic expression.

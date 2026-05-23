Portrait Reference Workflow

This folder is for Alan-provided appearance references only.

Expected reference files:
- alan-ref.png
- umi-ref.png
- asuna-ref.png
- mai-ref.png
- mahiru-ref.png
- caocao-ref.png
- liubei-ref.png

Rules:
- Do not import files from this folder in production UI.
- Do not use these images directly as final app portraits.
- References are only for art direction: silhouette, color mood, pose, expression, or character vibe.
- Final app assets must be original anime-inspired portraits saved in /public/portraits/.
- Do not copy copyrighted official art, screenshots, or exact character designs into final portraits.

Workflow:
1. Put Alan's reference image here as <slug>-ref.png.
2. Use the reference only to guide an original generated or hand-drawn portrait.
3. Save the final original portrait as /public/portraits/<slug>.png.
4. Optional emotion variants can be saved as:
   - /public/portraits/<slug>-smiling.png
   - /public/portraits/<slug>-worried.png
   - /public/portraits/<slug>-serious.png

Production rule:
The app should only load /public/portraits/*.png. If a final portrait is missing, the UI must fall back to the VN placeholder.

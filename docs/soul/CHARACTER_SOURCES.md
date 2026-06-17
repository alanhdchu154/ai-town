# Character sources (canonical mapping)

The 6 pilots are adapted from existing fiction. The authored souls
(`docs/soul/pilots/*.md`) are **this project's canonical version** — source lore
ENRICHES (backstory, relationships, known "deeds" = their public self) but must
NOT override or contradict the authored souls.

| Pilot (display) | runtime key | Source character | Source work |
| --- | --- | --- | --- |
| **一之瀨** | Ichinose | 一之瀬帆波 (Honami Ichinose) | ようこそ実力至上主義の教室へ / Classroom of the Elite |
| **天澤** | Tianze | 天沢一夏 (Ichika Amasawa) | Classroom of the Elite (same work as 一之瀨) |
| **海** | Umi | 朝凪海 (Asanagi Umi) | クラスで2番目に可愛い女の子と友だちになった / "I became friends with the 2nd cutest girl in class" |
| **真晝** | Mahiru | 椎名真昼 (Mahiru Shiina) | お隣の天使様にいつの間にか駄目人間にされていた件 / The Angel Next Door |
| **貓貓** | Maomao | 猫猫 (Maomao) | 薬屋のひとりごと / The Apothecary Diaries |
| **祥子** | Sakiko | 豊川祥子 (Sakiko Togawa) | Ave Mujica (BanG Dream!) |

Note: **一之瀨 and 天澤 are from the SAME work** (Classroom of the Elite), so they
have canonical on-page interactions — the richest source for a real relationship
history. The authored souls already give them a sharp dynamic (Tianze tests
boundaries / Ichinose prices the test); source lore can deepen it.

## How to use this lore (for the Codex lore-crawl task)
For each character, research the source for: (a) what they are *known for* / did
in their world (= their **public self**, which the others would plausibly know),
(b) canonical relationships and tensions, (c) one or two signature
situations/beats. Then ENRICH (do not overwrite):
- `RELATIONSHIP_DYNAMICS` in `convex/agent/conversation.ts` (directed per-pair
  lines) — especially 一之瀨↔天澤,
- the character identity / public-self hints used in prompts,
- optionally the `docs/soul/pilots/*.md` relationship sections.
Stay inside the authored soul (e.g. 真晝 stays the gentle care-anchor; do not
import plot that breaks her). Keep it review-gated and evidence-grounded; cite the
source. Do NOT inject spoilers/plot that the in-world character would not treat as
their own ordinary self-knowledge.

## Lore notes from Alan (2026-06-17) — handle with care

- **天澤 / Amasawa Ichika** — in-source she has a provocative little-devil edge
  (the "want to see?" / flashing mischief). For this project, **enrich the ENERGY
  ONLY** — boundary-pushing, mischievous, fluster-through-timing and a too-accurate
  question. The authored soul (`docs/soul/pilots/tianze.md`) explicitly KEEPS IT
  SAFE: **no actual exposure / underwear / explicit / humiliating content.** Deepen
  the mischief, never the explicit beat.
- **天澤 ↔ 一之瀨** — they have a canonical **conflict** in Classroom of the Elite
  (same source work). This is the richest material for that pair: sharpen the
  `RELATIONSHIP_DYNAMICS` 天澤↔一之瀨 entries with the source's real antagonism,
  staying inside each authored soul (Tianze tests boundaries; Ichinose prices the
  test and makes him pause by asking who pays for the joke).

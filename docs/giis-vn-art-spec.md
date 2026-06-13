# GIIS Underworld — VN Render Art Spec (Route A)

Last updated: 2026-06-11.

Status: **Phase 1 visual spike + scene-first world view + core transparent standees landed.**
This describes the full-VN-render visual direction Alan selected (big character
renders, no top-down pixel crowd). A conservative frontend integration now
prefers generated large renders for `CharacterPortrait size="lg"` and uses
generated room backgrounds as the only Alan-facing world view. The original
Pixi exploration map is no longer exposed in the main UI; bring it back only as
a future debug-only route if coordinate inspection is needed. This is still not
a final locked production art sheet: only some pilot default-emotion renders
exist.

Governance anchors: `docs/giis-ui-directions.md` (why a bigger conversation
frame is north-star-aligned), `docs/soul/SOUL_PROGRESSION_PLAN.md` (Version
Mapping — UI fidelity follows the soul engine, not before it).

## 0. Current pilot cast (verified 2026-06-10)

The runtime / eval pilot is **海 Umi · 真晝 Mahiru · 天澤 Tianze · 一之瀨 Ichinose**
(`evals/conversations/runSoulTriadEval.ts` `TRIAD_NAMES`). Secondary local-LLM
souls: 曹操 CaoCao, 劉備 Liu Bei. **Asuna (明日奈) and Mai (麻衣) no longer exist** —
they were removed; older docs/memory that name them are stale, ignore them.
All four pilots already have an `artDirection` + 4-emotion portrait set in
`data/characterVisuals.ts`, so no new character design is needed — just render
them larger.

## 1. Where the "好看" actually comes from

The reference style does **not** come from the engine. It is AI-generated 2.5D
anime renders shown VN-style. So this whole spec is about *generating consistent
character art*, then compositing it. The code side (a VN conversation overlay
that hides the Pixi map and shows `background + character render + dialogue box`)
is the easy, additive part — see §6.

What we keep from the reference: full-bleed character render, large dialogue box
with name + voice feel, focused single-character framing.
What we **drop** (genre drift away from the north star): affinity Lv bars, gift
boxes, currency counter, "成人氛围." Affection, if shown at all, is expressed the
project's own way — through remembered residue, not a number.

## 2. What the existing system already gives us

`data/characterVisuals.ts` already defines, per character:

- an `artDirection` prompt string (already written, already tagged
  `safe non-sexual character reference pose` — reuse these verbatim as the base).
- a 4-emotion enum: `neutral | smiling | worried | serious`, with a
  per-character `defaultEmotion`.
- a naming convention via `portraitSet(slug)` →
  `umi.png` / `umi-smiling.png` / `umi-worried.png` / `umi-serious.png`.

`data/schoolLocations.ts` defines 5 scenes for backgrounds: `classroom` 教室,
`courtyard` 中央庭院, `aiClubRoom` 餐廳 (Cafeteria), `studentCouncilRoom` 校長室
(Principal Office), `dormitory` 宿舍.

So we **extend** this, we do not invent a new system. The current `.png` files
are small bust portraits; VN render needs larger, fuller renders → put them in a
new dir so the existing portrait usage is untouched (§5).

## 3. Asset list (Phase 1 = the 4 pilots)

Character renders, per pilot × the 4 existing emotions:

| Character | Base (reuse `artDirection`) | Emotions to generate |
|---|---|---|
| Umi 海 | navy bob, pink-purple eyes, gray cardigan/blazer, blue ribbon, clever gentle teasing smile | neutral, smiling, worried, serious |
| Mahiru 真晝 | gentle student-affairs assistant, cream/pink palette, cardigan counselor vibe, kind concerned expression | neutral, smiling, worried, serious |
| Tianze 天澤 | mischievous elite transfer student, coral red palette, b/w blazer, teasing sharp eyes, playful dangerous smile | neutral, smiling, worried, serious |
| Ichinose 一之瀨 | pink-haired ex class leader, rose/navy palette, warm possessive smile, weaponized kindness (no fantasy horns) | neutral, smiling, worried, serious |

Backgrounds, Phase 1 (core scenes): `classroom` 教室, `courtyard` 中央庭院,
`aiClubRoom` 餐廳, `studentCouncilRoom` 校長室 (Umi's briefing room), and
`dormitory` 宿舍 (late-night quiet scenes). Day/night variants landed on
2026-06-11 as a bounded asset pass, without adding weather or event-specific
background systems.

Phase 1 target: 4 chars × 4 emotions = **16 renders** + **5 backgrounds**.
Current landed spike: Umi=smiling, Mahiru=worried, Ichinose=serious,
Tianze=serious, Maomao=serious, Sakiko=serious — 6 transparent default-emotion
renders + 5 base backgrounds (`classroom`, `courtyard`, `aiClubRoom`,
`studentCouncilRoom`, `dormitory`) plus day/night variants for each base
background. The first Tianze candidate drifted male and was removed; the
current Tianze render is a corrected female pressure-test character aligned
with the Tianze Ichika-inspired direction.

## 4. Image-generation spec

**Style target:** modern 2.5D anime render — soft directional lighting, clean
line/shading, slight depth, neutral-to-warm interior tone. School-appropriate
(these are students); keep it tasteful, no sexualization. Carry the existing
`safe non-sexual character reference` tag in every prompt.

**Output format & framing:**

- Character renders: portrait aspect, **832×1216** (or 1024×1536), **transparent
  background** (generate on a flat backdrop and matte/cut if the model can't do
  true alpha). Framing: **waist-up, single character, facing viewer, slight
  3/4 angle**, consistent eye-line so swaps don't jump.
- Backgrounds: **16:9, 1920×1080**, no characters, empty room with a clear
  center where the render sits.

**Consistency strategy (the make-or-break part):**

1. Build **one base prompt per character** = their `artDirection` string + fixed
   framing/quality/lighting tags + the `safe non-sexual` tag.
2. **Lock the seed** and generate a character sheet first; once a face/design is
   approved, reuse that seed + base prompt for every emotion variant, changing
   **only the expression token**. This keeps the same character across the 4 PNGs.
3. Keep a per-character palette consistent with `characterVisuals.ts` (`tint` /
   `accent` / `palette`) so renders match the existing UI accent colors.

**Prompt template (per render):**

```
<character base prompt from characterVisuals.ts artDirection>,
<expression token>,
waist-up, single character, facing viewer slight 3/4, eye contact,
soft directional anime lighting, clean 2.5D render, neutral studio backdrop,
high detail, consistent character design,
safe non-sexual character reference
--neg: gacha UI, HUD, affinity bar, gift icon, currency, watermark, text,
nsfw, cleavage, suggestive, extra fingers, multiple characters, lowres
```

Expression token map → enum:

- `neutral` → calm relaxed expression, mouth closed
- `smiling` → warm gentle smile, soft eyes
- `worried` → concerned brow, slightly downturned, caring
- `serious` → focused, direct gaze, composed

(Optional later: `talking` (mouth open mid-speech) and `blush` for emotional
beats — both are pure additions to the same enum + naming.)

## 5. Naming & file convention

Do **not** overwrite the existing bust portraits in `public/portraits/`. Add a
new dir for the larger VN renders:

```
public/renders/<slug>-<emotion>.png      e.g. public/renders/umi-serious.png
public/backgrounds/<sceneId>.png         e.g. public/backgrounds/studentCouncilRoom.png
public/backgrounds/<sceneId>-day.png     e.g. public/backgrounds/studentCouncilRoom-day.png
public/backgrounds/<sceneId>-night.png   e.g. public/backgrounds/studentCouncilRoom-night.png
```

Then mirror the existing `portraitSet()` helper with a `renderSet(slug)` in
`data/characterVisuals.ts` (additive; no change to current portrait fields).
`<slug>` matches the existing portrait slugs (`umi`, `mahiru`, …); `<sceneId>`
matches `SchoolLocationId`.

Current implementation uses optional `renderPath` / `renderPaths` fields in
`data/characterVisuals.ts` for the landed default-emotion assets and falls back
to existing `/public/portraits` when a requested render variant is missing.

## 6. React integration outline

No Convex change. Current implementation takes the additive path:

- `Game.tsx` defaults the main world panel to Scene Mode: generated background,
  large character portraits/standees, and scene-object hotspots.
- Scene Mode selects `-day` backgrounds for 早晨 / 中午 / 下午 and `-night`
  backgrounds for 晚上 / 深夜, falling back to the original no-suffix scene art
  if the clock label is unavailable.
- The original Pixi `Stage` is not rendered in the main Alan-facing world view;
  Scene Mode is the single v0.1 surface.
- Conversation mode reuses the same current-scene backdrop and the larger
  `CharacterPortrait size="lg"` render preference.
- Scene hotspots are currently non-mutating UI hooks that surface existing
  `moodEvents` / scene prompts. They are event seeds, not a new inventory or
  backend event system yet.

This is purely a frontend mode swap layered over the data that already flows
from Convex.

## 7. Phasing

- **Phase 1:** resolve §0; generate initial pilot renders + 5 core backgrounds;
  land Scene Mode as the single Alan-facing world view.
- **Phase 2:** complete the remaining pilot emotion renders; add
  `talking`/`blush` expressions; emotion driven by residue/mood (ties into v0.2
  Behavioral Drift).
- **Phase 3:** extend renders to the rest of the cast as they get screen time.

Implementation gate: deeper backend event-object behavior still needs a
`umi/proposals/` doc because it would affect world continuity and memory. The
current scene-object layer is UI-only and low-risk.

## 8. Ready-to-paste prompts (Phase 1)

Assemble each render as: **`<character base>` + `,` + `<expression>` + `,` +
`<shared suffix>`**, with the shared negative. Lock one seed per character and
change only the expression token across the 4 variants so the face stays
identical.

**Shared suffix (every render):**

```
waist-up, single character, facing viewer slight 3/4 angle, eye contact,
soft directional anime lighting, clean 2.5D anime render, neutral studio backdrop,
high detail, consistent character design, safe non-sexual character reference,
school-appropriate
```

**Shared negative (every render):**

```
gacha UI, HUD, affinity bar, gift icon, currency, watermark, text, signature,
nsfw, cleavage, suggestive, bare skin, extra fingers, deformed hands,
multiple characters, lowres, blurry, fantasy horns
```

**Expression tokens** (→ filename emotion):

```
neutral  -> calm relaxed expression, mouth closed, gentle steady eyes
smiling  -> warm gentle smile, soft eyes, light cheerful mood
worried  -> concerned brow, slightly downturned mouth, caring worried look
serious  -> focused composed expression, direct steady gaze, quietly intense
```

**Character bases** (derived from `data/characterVisuals.ts` `artDirection`):

```
Umi 海:
original anime-style Umi, short dark navy bob hair, pink-purple eyes,
light gray school cardigan over white blouse, small blue ribbon bow,
navy pleated skirt, dark knee-high socks, brown loafers,
clever gentle teasing personality

Mahiru 真晝:
original anime-style Mahiru, gentle student-affairs assistant,
cream and pink palette, soft cardigan counselor vibe, warm kind eyes,
emotionally safe gentle presence

Tianze 天澤:
original anime-style Tianze, mischievous elite transfer student,
coral-red accent with black-and-white school blazer, sharp teasing eyes,
playful dangerous charm, pressure-test energy

Ichinose 一之瀨:
original anime-style Ichinose, pink-haired former class leader,
short side-swept bangs keeping the full face and both eyes clearly visible,
rose and navy palette, polished student council aura,
warm possessive smile, weaponized kindness, no fantasy horns
```

**Two fully-assembled examples:**

```
# umi-smiling.png
original anime-style Umi, short dark navy bob hair, pink-purple eyes,
light gray school cardigan over white blouse, small blue ribbon bow,
navy pleated skirt, dark knee-high socks, brown loafers,
clever gentle teasing personality, warm gentle smile, soft eyes, light cheerful mood,
waist-up, single character, facing viewer slight 3/4 angle, eye contact,
soft directional anime lighting, clean 2.5D anime render, neutral studio backdrop,
high detail, consistent character design, safe non-sexual character reference,
school-appropriate
neg: gacha UI, HUD, affinity bar, gift icon, currency, watermark, text, signature,
nsfw, cleavage, suggestive, bare skin, extra fingers, deformed hands,
multiple characters, lowres, blurry, fantasy horns

# mahiru-worried.png
original anime-style Mahiru, gentle student-affairs assistant,
cream and pink palette, soft cardigan counselor vibe, warm kind eyes,
emotionally safe gentle presence, concerned brow, slightly downturned mouth, caring worried look,
waist-up, single character, facing viewer slight 3/4 angle, eye contact,
soft directional anime lighting, clean 2.5D anime render, neutral studio backdrop,
high detail, consistent character design, safe non-sexual character reference,
school-appropriate
neg: gacha UI, HUD, affinity bar, gift icon, currency, watermark, text, signature,
nsfw, cleavage, suggestive, bare skin, extra fingers, deformed hands,
multiple characters, lowres, blurry, fantasy horns
```

**Backgrounds (no characters):**

```
# studentCouncilRoom.png (校長室 / Umi's briefing room)
anime visual-novel background, tidy principal/student-council office interior,
warm desk lamp, window with soft evening light, bookshelves, clean center space,
no characters, 16:9, high detail
neg: people, character, text, watermark, lowres

# dormitory.png (宿舍 / late-night quiet scene)
anime visual-novel background, cozy student dormitory room at night,
warm bedside lamp, soft shadows, window with city/night sky, calm intimate mood,
clean center space, no characters, 16:9, high detail
neg: people, character, text, watermark, lowres
```

Save outputs to `public/renders/<slug>-<emotion>.png` and
`public/backgrounds/<sceneId>.png` per §5.

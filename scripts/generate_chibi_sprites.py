from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw


SCALE = 4
CELL = 32
SHEET_COLS = 3
SHEET_ROWS = 4
OUT = Path("public/sprites")
QA_OUT = Path("docs/qa")


def rgba(hex_color: int, alpha: int = 255) -> tuple[int, int, int, int]:
    return (
        (hex_color >> 16) & 255,
        (hex_color >> 8) & 255,
        hex_color & 255,
        alpha,
    )


@dataclass(frozen=True)
class SpriteSpec:
    slug: str
    display: str
    portrait: Path
    hair: int
    skin: int
    outfit: int
    accent: int
    secondary: int
    eye: int
    shoe: int
    hair_style: str
    outfit_style: str
    accessory: str
    tone: str


SPECS = [
    SpriteSpec(
        "alan",
        "Alan",
        Path("public/portraits/alan.png"),
        hair=0x111827,
        skin=0xE8B07F,
        outfit=0x111827,
        accent=0xF6C94A,
        secondary=0x2F4FD8,
        eye=0x26324A,
        shoe=0x0B1020,
        hair_style="messy",
        outfit_style="hoodie",
        accessory="laptop",
        tone="sleep-deprived builder energy",
    ),
    SpriteSpec(
        "umi",
        "Umi",
        Path("public/portraits/umi.png"),
        hair=0x153653,
        skin=0xF0BE98,
        outfit=0xD8DEE8,
        accent=0x2C8DC5,
        secondary=0x223B63,
        eye=0xBB4D8F,
        shoe=0x3B2F3A,
        hair_style="short_wave",
        outfit_style="blazer_bow",
        accessory="tablet",
        tone="clever teasing assistant",
    ),
    SpriteSpec(
        "asuna",
        "Asuna",
        Path("public/portraits/asuna.png"),
        hair=0xB35E2D,
        skin=0xEFB88F,
        outfit=0xF7F2E8,
        accent=0xD9573D,
        secondary=0x8F2F2F,
        eye=0x9A4B35,
        shoe=0x3A2020,
        hair_style="long_side_tail",
        outfit_style="red_white_uniform",
        accessory="clipboard",
        tone="disciplined executive energy",
    ),
    SpriteSpec(
        "mai",
        "Mai",
        Path("public/portraits/mai.png"),
        hair=0x17111F,
        skin=0xE7B894,
        outfit=0x2A2432,
        accent=0x7D5BBF,
        secondary=0xB7A8C8,
        eye=0x8F5CB7,
        shoe=0x16111C,
        hair_style="long_straight",
        outfit_style="taupe_blazer",
        accessory="folder",
        tone="calm strategic advisor",
    ),
    SpriteSpec(
        "mahiru",
        "Mahiru",
        Path("public/portraits/mahiru.png"),
        hair=0xF0C778,
        skin=0xF2C5A2,
        outfit=0xFFF1D6,
        accent=0xF28ABD,
        secondary=0xD68BA8,
        eye=0xA96F62,
        shoe=0x8B6A5B,
        hair_style="soft_long",
        outfit_style="cardigan",
        accessory="heart_pin",
        tone="gentle student affairs warmth",
    ),
    SpriteSpec(
        "caocao",
        "Cao Cao",
        Path("public/portraits/caocao.png"),
        hair=0x17111B,
        skin=0xDCA078,
        outfit=0x201018,
        accent=0xB72F35,
        secondary=0x6F2530,
        eye=0xC43A44,
        shoe=0x15101A,
        hair_style="topknot",
        outfit_style="warlord_robe",
        accessory="beard_cape",
        tone="ambitious strategist",
    ),
    SpriteSpec(
        "liubei",
        "Liu Bei",
        Path("public/portraits/liubei.png"),
        hair=0x2D341F,
        skin=0xEDBD8F,
        outfit=0x26351E,
        accent=0x49B96A,
        secondary=0xC7A64A,
        eye=0x425A35,
        shoe=0x2C2418,
        hair_style="long_tied",
        outfit_style="sage_robe",
        accessory="beard_headband",
        tone="warm alliance leader",
    ),
]


def box(values: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return tuple(v * SCALE for v in values)


def point(x: int, y: int) -> tuple[int, int]:
    return x * SCALE, y * SCALE


def draw_rect(d: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], fill: int, outline: int | None = 0x181425) -> None:
    d.rectangle(box(xy), fill=rgba(fill), outline=rgba(outline) if outline is not None else None)


def draw_round(
    d: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    fill: int,
    radius: int = 2,
    outline: int | None = 0x181425,
) -> None:
    d.rounded_rectangle(
        box(xy),
        radius=radius * SCALE,
        fill=rgba(fill),
        outline=rgba(outline) if outline is not None else None,
    )


def draw_ellipse(d: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], fill: int, outline: int | None = 0x181425) -> None:
    d.ellipse(box(xy), fill=rgba(fill), outline=rgba(outline) if outline is not None else None)


def draw_poly(d: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: int, outline: int | None = 0x181425) -> None:
    scaled = [point(x, y) for x, y in points]
    d.polygon(scaled, fill=rgba(fill), outline=rgba(outline) if outline is not None else None)


def draw_hair_back(d: ImageDraw.ImageDraw, spec: SpriteSpec, direction: str) -> None:
    if spec.hair_style in {"long_straight", "soft_long", "long_tied", "long_side_tail"}:
        draw_round(d, (8, 6, 24, 24), spec.hair, radius=6)
        if direction != "up":
            draw_round(d, (7, 14, 11, 28), spec.hair, radius=2)
            draw_round(d, (21, 14, 25, 28), spec.hair, radius=2)
        else:
            draw_round(d, (7, 12, 25, 29), spec.hair, radius=4)
    elif spec.hair_style == "topknot":
        draw_ellipse(d, (12, 1, 20, 8), spec.hair)
        draw_round(d, (9, 6, 23, 22), spec.hair, radius=5)
    else:
        draw_round(d, (8, 5, 24, 22), spec.hair, radius=5)


def draw_head(d: ImageDraw.ImageDraw, spec: SpriteSpec, direction: str, blink: bool) -> None:
    draw_ellipse(d, (9, 7, 23, 21), spec.skin)
    if direction == "up":
        draw_round(d, (8, 5, 24, 17), spec.hair, radius=5)
        if spec.accessory in {"headband", "beard_headband"}:
            draw_rect(d, (9, 8, 23, 10), spec.accent)
        return

    # Main hair cap and bangs.
    draw_round(d, (8, 4, 24, 13), spec.hair, radius=5)
    draw_poly(d, [(9, 9), (13, 6), (14, 13), (11, 14)], spec.hair, outline=None)
    draw_poly(d, [(16, 7), (20, 10), (18, 14)], spec.hair, outline=None)
    if spec.hair_style == "messy":
        draw_poly(d, [(11, 5), (14, 1), (16, 7)], spec.hair, outline=None)
        draw_poly(d, [(19, 6), (24, 8), (21, 10)], spec.hair, outline=None)
    if spec.hair_style == "short_wave":
        draw_round(d, (7, 12, 9, 21), spec.hair, radius=1)
        draw_round(d, (23, 12, 25, 20), spec.hair, radius=1)
    if spec.hair_style == "long_straight":
        draw_round(d, (7, 12, 9, 25), spec.hair, radius=1)
        draw_round(d, (23, 12, 25, 25), spec.hair, radius=1)
    if spec.hair_style == "soft_long":
        draw_round(d, (7, 12, 10, 26), spec.hair, radius=2)
        draw_round(d, (22, 12, 25, 26), spec.hair, radius=2)
    if spec.hair_style == "long_side_tail":
        draw_round(d, (22, 9, 27, 24), spec.hair, radius=2)
        draw_ellipse(d, (22, 9, 26, 13), spec.accent)
    if spec.hair_style == "topknot":
        draw_poly(d, [(15, 4), (18, 1), (20, 7)], spec.accent)
    if spec.accessory in {"headband", "beard_headband"}:
        draw_rect(d, (9, 8, 23, 10), spec.accent)
    if spec.accessory in {"beard_cape", "beard_headband"}:
        draw_poly(d, [(13, 18), (19, 18), (17, 22), (15, 22)], spec.hair, outline=None)

    if direction in {"left", "right"}:
        eye_points = [(13, 14), (18, 14)]
    else:
        eye_points = [(12, 14), (18, 14)]

    for x, y in eye_points:
        if blink:
            draw_rect(d, (x, y, x + 2, y + 1), 0x181425, outline=None)
        else:
            draw_rect(d, (x, y, x + 1, y + 2), spec.eye, outline=None)
            draw_rect(d, (x, y, x, y), 0xFFFFFF, outline=None)

    if direction == "down":
        draw_rect(d, (15, 18, 17, 19), 0x5C3240 if spec.slug != "caocao" else spec.accent, outline=None)
    else:
        draw_rect(d, (15, 18, 16, 19), 0x5C3240, outline=None)


def draw_body(d: ImageDraw.ImageDraw, spec: SpriteSpec, direction: str, frame: int, moving: bool) -> None:
    step = 0 if frame == 0 else (-1 if frame == 1 else 1)
    if direction in {"left", "right"}:
        step = -step if direction == "left" else step

    # Legs and shoes.
    left_leg_x = 12 + (step if moving else 0)
    right_leg_x = 18 - (step if moving else 0)
    leg_color = spec.secondary if spec.outfit_style in {"blazer_bow", "uniform", "cardigan", "red_white_uniform", "taupe_blazer"} else spec.outfit
    draw_rect(d, (left_leg_x, 22, left_leg_x + 4, 28), leg_color)
    draw_rect(d, (right_leg_x, 22, right_leg_x + 4, 28), leg_color)
    draw_round(d, (left_leg_x - 1, 28, left_leg_x + 5, 31), spec.shoe, radius=1)
    draw_round(d, (right_leg_x - 1, 28, right_leg_x + 5, 31), spec.shoe, radius=1)

    # Torso.
    torso = (10, 18, 22, 25)
    draw_round(d, torso, spec.outfit, radius=2)
    if spec.outfit_style in {"blazer_bow", "uniform", "cardigan", "red_white_uniform", "taupe_blazer"}:
        draw_poly(d, [(11, 18), (16, 24), (10, 24)], 0xF7F1E8, outline=None)
        draw_poly(d, [(21, 18), (16, 24), (22, 24)], 0xF7F1E8, outline=None)
    if spec.outfit_style == "red_white_uniform":
        draw_rect(d, (10, 22, 22, 25), spec.accent, outline=None)
        d.line([point(12, 20), point(20, 20)], fill=rgba(spec.accent), width=1 * SCALE)
    if spec.outfit_style == "warlord_robe":
        d.line([point(11, 19), point(21, 25)], fill=rgba(spec.accent), width=2 * SCALE)
        d.line([point(11, 22), point(21, 22)], fill=rgba(spec.secondary), width=1 * SCALE)
    if spec.outfit_style == "sage_robe":
        d.line([point(12, 19), point(20, 19)], fill=rgba(spec.secondary), width=2 * SCALE)
        d.line([point(16, 18), point(16, 25)], fill=rgba(spec.secondary), width=1 * SCALE)
        draw_rect(d, (10, 22, 22, 25), spec.accent, outline=None)
    if spec.outfit_style == "hoodie":
        draw_rect(d, (14, 19, 18, 24), spec.secondary, outline=None)

    # Accent tie/bow/cardigan cue.
    if spec.outfit_style == "blazer_bow":
        draw_poly(d, [(16, 19), (12, 20), (15, 22)], spec.accent)
        draw_poly(d, [(16, 19), (20, 20), (17, 22)], spec.accent)
        draw_rect(d, (15, 21, 17, 25), spec.accent, outline=None)
    elif spec.outfit_style == "cardigan":
        draw_rect(d, (13, 19, 19, 24), spec.secondary, outline=None)
        draw_rect(d, (15, 19, 17, 24), spec.accent, outline=None)
    elif spec.outfit_style in {"dark_blazer", "taupe_blazer"}:
        draw_rect(d, (15, 18, 17, 25), spec.accent, outline=None)
    else:
        draw_rect(d, (15, 18, 17, 25), spec.accent, outline=None)

    # Arms.
    arm_swing = step if moving else 0
    draw_round(d, (7, 18 + max(0, arm_swing), 11, 25 + max(0, arm_swing)), spec.outfit, radius=1)
    draw_round(d, (21, 18 + max(0, -arm_swing), 25, 25 + max(0, -arm_swing)), spec.outfit, radius=1)
    draw_ellipse(d, (7, 24 + max(0, arm_swing), 11, 27 + max(0, arm_swing)), spec.skin)
    draw_ellipse(d, (21, 24 + max(0, -arm_swing), 25, 27 + max(0, -arm_swing)), spec.skin)

    # Small identity props kept close to the body.
    if spec.accessory == "laptop" and direction != "up":
        draw_round(d, (5, 20, 12, 25), 0x26324A, radius=1)
        draw_rect(d, (6, 21, 11, 24), 0x4F6DF5, outline=None)
    elif spec.accessory == "tablet" and direction != "up":
        draw_round(d, (20, 20, 25, 26), 0x243B53, radius=1)
        draw_rect(d, (21, 21, 24, 25), 0xAEE9FF, outline=None)
    elif spec.accessory == "clipboard" and direction != "up":
        draw_round(d, (20, 18, 25, 25), 0x4A2A2A, radius=1)
        draw_rect(d, (21, 19, 24, 24), 0xFFF4E6, outline=None)
    elif spec.accessory == "folder" and direction != "up":
        draw_round(d, (20, 19, 26, 25), 0x2C2340, radius=1)
        draw_rect(d, (21, 20, 25, 24), spec.accent, outline=None)
    elif spec.accessory == "heart_pin" and direction != "up":
        draw_rect(d, (20, 19, 22, 21), spec.accent, outline=None)
    elif spec.accessory in {"cape", "beard_cape"}:
        draw_poly(d, [(8, 18), (4, 29), (10, 26)], spec.secondary)


def draw_frame(spec: SpriteSpec, direction: str, frame: int) -> Image.Image:
    high = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), (0, 0, 0, 0))
    d = ImageDraw.Draw(high)
    moving = frame != 0
    bob = -1 if moving and frame == 1 else 0

    # Draw on a shifted layer for the tiny walk-cycle bob.
    layer = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    draw_hair_back(ld, spec, direction)
    draw_body(ld, spec, direction, frame, moving)
    draw_head(ld, spec, direction, blink=frame == 1 and direction == "down")
    high.alpha_composite(layer, (0, bob * SCALE))

    return high.resize((CELL, CELL), Image.Resampling.NEAREST)


def write_sprite_sheet(spec: SpriteSpec) -> None:
    sheet = Image.new("RGBA", (CELL * SHEET_COLS, CELL * SHEET_ROWS), (0, 0, 0, 0))
    for row, direction in enumerate(["down", "left", "right", "up"]):
        for col in range(SHEET_COLS):
            sheet.alpha_composite(draw_frame(spec, direction, col), (col * CELL, row * CELL))
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f"{spec.slug}.png")


def write_contact_sheet() -> None:
    QA_OUT.mkdir(parents=True, exist_ok=True)
    scale = 2
    column_width = 190
    width = column_width * len(SPECS)
    height = 390
    contact = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    d = ImageDraw.Draw(contact)
    for index, spec in enumerate(SPECS):
        x = index * column_width
        portrait = Image.open(spec.portrait).convert("RGBA")
        portrait.thumbnail((96, 108), Image.Resampling.LANCZOS)
        contact.alpha_composite(portrait, (x + (column_width - portrait.width) // 2, 6))
        sprite = Image.open(OUT / f"{spec.slug}.png").convert("RGBA")
        preview = sprite.resize((sprite.width * scale, sprite.height * scale), Image.Resampling.NEAREST)
        contact.alpha_composite(preview, (x + (column_width - preview.width) // 2, 116))
        d.text((x + 8, 356), spec.slug, fill=(0, 0, 0, 255))
        d.text((x + 8, 372), spec.tone[:28], fill=(0, 0, 0, 255))
    contact.save(QA_OUT / "character-sprites-contact.png")


def write_report() -> None:
    QA_OUT.mkdir(parents=True, exist_ok=True)
    rows = [
        "# RPG Sprite Upgrade Report",
        "",
        "Generated by `scripts/generate_chibi_sprites.py`.",
        "",
        "## Output Contract",
        "",
        "- Sprite path: `public/sprites/<slug>.png`",
        "- Sheet size: `96x128`",
        "- Frame size: `32x32`",
        "- Layout: 3 columns x 4 rows",
        "- Rows: `down`, `left`, `right`, `up`",
        "- Columns: standing, walk A, walk B",
        "- Background: transparent RGBA",
        "",
        "## Portrait To Sprite Mapping",
        "",
        "| Character | Portrait source | Sprite output | Identity cues preserved |",
        "|---|---|---|---|",
    ]
    for spec in SPECS:
        rows.append(
            f"| {spec.display} | `{spec.portrait}` | `public/sprites/{spec.slug}.png` | "
            f"{spec.tone}; hair `#{spec.hair:06x}`, outfit `#{spec.outfit:06x}`, accent `#{spec.accent:06x}` |"
        )
    rows.extend(
        [
            "",
            "## Reference QA",
            "",
            "- Comparison sheet: `docs/qa/character-ref-portrait-sprite-comparison.png`",
            "- The sprite specs intentionally bias toward `public/portrait-references/*-ref.png` when the final portrait lost a strong source cue.",
            "- Cao Cao and Liu Bei need extra simplification because their references are realistic/historical, not anime chibi; their readable traits are robe color, head silhouette, beard, and authority posture.",
            "",
            "## Replacement Notes",
            "",
            "- Existing `data/characterVisuals.ts` paths are preserved, so the app keeps loading `/sprites/<slug>.png`.",
            "- `src/components/Character.tsx` now treats those files as directional RPG sprite sheets when dimensions are at least `96x128`.",
            "- If a custom sprite fails to load, the existing procedural `PixelAvatar` and original `32x32folk.png` fallback path still remain available.",
            "",
            "## Style Consistency Concerns",
            "",
            "- These are intentionally small, deterministic RPG-style sprites. Facial detail is simplified so characters stay readable at map scale.",
            "- Portraits remain the source of truth for expressive UI; sprites prioritize silhouette, palette, hair shape, and role props.",
        ]
    )
    (QA_OUT / "rpg-sprite-upgrade-report.md").write_text("\n".join(rows) + "\n", encoding="utf-8")


def main() -> None:
    for spec in SPECS:
        write_sprite_sheet(spec)
    write_contact_sheet()
    write_report()


if __name__ == "__main__":
    main()

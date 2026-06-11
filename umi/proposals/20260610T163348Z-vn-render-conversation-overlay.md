# GIIS Underworld — VN Render Conversation Overlay Proposal

Status: proposal (awaiting Alan approval). Exploratory / v0.2+ visual surface.
Companion brief: `docs/giis-vn-art-spec.md`. Direction rationale:
`docs/giis-ui-directions.md`.

## Problem

The current play view renders characters as small top-down PixiJS pixel
sprites with multiple NPCs wandering the classroom. Alan wants the visual
*style* of a modern VN/RPG: a focused, large character render with a big
dialogue frame when talking to someone — "fewer dot-like little people," more
"actually seeing this person." The pixel-sprite world undersells the emotional
weight of a conversation, which is the product's whole point (the north star is
that a conversation *matters*, not "AI agents talking").

This is primarily an art-asset + frontend-layout change. No Convex/backend
change: the data (current speaker, dialogue, scene) already flows from Convex.

## Evidence

- Reference style Alan supplied: full-bleed AI-rendered anime character + large
  bottom dialogue box + single-character focus.
- `data/characterVisuals.ts` already defines, per pilot, an `artDirection`
  prompt string, a 4-emotion enum (`neutral|smiling|worried|serious`), and a
  `portraitSet()` naming convention — so a render layer extends existing data
  rather than inventing a system.
- `data/schoolLocations.ts` already defines 5 scene IDs for backgrounds.
- Current pilot cast (verified 2026-06-10): 海 Umi / 真晝 Mahiru / 天澤 Tianze /
  一之瀨 Ichinose (`evals/conversations/runSoulTriadEval.ts` `TRIAD_NAMES`).
  Asuna / Mai no longer exist.
- The conversation UI today lives in `src/components/PlayerDetails.tsx`,
  `Messages.tsx`, `MessageInput.tsx`, layered over `PixiGame.tsx` by
  `Game.tsx`.

## Proposed Change

Add an additive `VNConversationView` React overlay, gated behind a flag, that
takes over the screen only while the human is in an active conversation:

- On conversation enter: render `public/backgrounds/<currentSceneId>.png`
  full-bleed; dim or hide the Pixi `Stage` behind it.
- Render `public/renders/<speakerSlug>-<emotion>.png` foreground-center, keyed
  off the current speaker and an emotion (start from each character's
  `defaultEmotion`; do not yet drive emotion from mood — that is v0.2).
- Re-lay-out the existing dialogue components into a bottom VN dialogue box:
  speaker-name pill + text + the existing `MessageInput`. Reuse `Messages.tsx`
  rendering; do not fork the conversation data path.
- On conversation leave: tear down the overlay, return to the Pixi world.
- Exploration view stays as-is for this change (separate decision whether to
  also thin/zoom the wandering NPCs).

Data additions (additive only, mirror existing helpers):

- `renderSet(slug)` + `backgroundFor(sceneId)` in `data/characterVisuals.ts` /
  a small backgrounds map. No change to existing portrait/sprite fields.

Assets (generated first as a spike, per `docs/giis-vn-art-spec.md` §8):

- Phase 1: 16 character renders (4 pilots × 4 emotions) + 2 backgrounds
  (`studentCouncilRoom`, `dormitory`), saved to `public/renders/` and
  `public/backgrounds/`.

Flag:

- `VITE_VN_CONVERSATION_VIEW` (default off). Old top-down conversation panel
  remains the fallback when off, so nothing regresses if renders are missing.

## Expected Benefit

- The conversation becomes a focused, emotionally weighted moment instead of two
  pixel dots — directly serves the "a conversation matters" north star and the
  UI-direction note's "make the moment bigger."
- No backend risk: the change is a frontend mode swap over existing Convex data.
- Bounded and reversible: behind a flag, with the existing panel as fallback.

## Risks

- Art consistency is the main risk: the 4 emotion variants per character must be
  the same face. Mitigation: lock one seed per character, change only the
  expression token (spec §4).
- Scope creep toward a gacha/dating-sim shell. Mitigation: spec explicitly drops
  affinity bars / gifts / currency / suggestive framing; affection is expressed
  via residue, not a meter.
- This is a major UI surface during the v0.1 evidence phase. Mitigation: assets
  + overlay land behind a default-off flag and are NOT pulled into the v0.1
  sample sprint; v0.1 ship gate is unchanged.

## Rollback Plan

- Set `VITE_VN_CONVERSATION_VIEW=false` (instant fallback to the current panel).
- Revert `VNConversationView` and the additive `renderSet`/backgrounds map.
- No data migration: renders/backgrounds are static assets; removing them only
  disables the view.

## Files Touched

Expected:

- `src/components/VNConversationView.tsx` (new)
- `src/components/Game.tsx` (mount the overlay when flag on + in conversation)
- `data/characterVisuals.ts` (additive `renderSet`), small backgrounds map
- `public/renders/*`, `public/backgrounds/*` (new assets)
- `.env.local.example` (document `VITE_VN_CONVERSATION_VIEW`)
- `WORKLOG.md`

## Why Not Smaller

A pure CSS resize of the existing panel cannot deliver the requested *style* —
the "好看" lives in the character art, which the top-down pixel sprite cannot
provide. The smallest change that achieves the goal is a flagged overlay that
swaps in generated renders for the conversation moment while leaving the world,
the data path, and the v0.1 gate untouched.

## Phasing

1. Generate Phase 1 assets (spec §8); approve the look in a static mockup.
2. Build `VNConversationView` behind the default-off flag against those assets.
3. (v0.2) Drive `emotion` from residue/mood; add `talking`/`blush`; extend
   renders to the rest of the cast.

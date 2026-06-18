# Speech-introspection dashboard — spec for Codex

Status: **spec for Codex (UI). Data contract owned by CC.** Time anchor 2026-06-17.

## What Alan wants to see
The literature-bridge speech flow, made visible, for real conversations:

```
①內心想說什麼  →  ②什麼被 HIDE / 軟化 / 不說  →  ③實際講了什麼
 innerWant          heldBack (+ why)              said
```

Today the runtime only generates ③ (the spoken line). CC is adding a **gated,
sampled introspection layer** that also generates ① and ② (see "Runtime" below).
Codex builds the **web dashboard** that renders the three-column flow. This is the
"unsaid" made visible — the heart of the soul project (see
`docs/soul/SOUL_SPEECH_LITERATURE_BRIDGE.md`).

## Division of labour
- **CC (owns runtime + data):** generates ①②③ into the `speechIntrospection`
  table (gated, sampled, baseline untouched). Owns the data contract below.
- **Codex (this spec): the web dashboard** — a NEW page, SEPARATE from the
  Conversation Wall (the Wall stays the "understand the souls" view; this is the
  "see the speech flow" view). Read-only. No runtime/prompt/schema changes.

## Data contract — `speechIntrospection` table (CC creates it)
Codex renders from this table (CC fills it). Fields:

| field | type | meaning |
| --- | --- | --- |
| `worldId` | id('worlds') | world |
| `conversationId` | string | the conversation |
| `playerId` | string | speaker player id |
| `characterName` | string | speaker display name (海/天澤/…) |
| `otherCharacterName` | string | listener display name |
| `messageUuid` | optional string | link to the actual message |
| `innerWant` | string | ① 內心想說什麼 (private candidate / intent) |
| `heldBack` | string | ② 被 HIDE / 軟化 / 不說的 |
| `gateReason` | optional string | ② why held back (面子 / 風險 / 關係 / 信任) |
| `said` | string | ③ 實際講出口的那句（= the real message text） |
| `day` | number | sim day |
| `createdAt` | number | epoch ms |

Indexes CC will provide: by `worldId`, by `conversationId`, by `worldId+day`.
A read query (e.g. `school:recentSpeechIntrospection { limit, day? }`) will be
provided by CC; until then, Codex builds against SAMPLE data (below).

## Dashboard requirements
1. **New page**, separate route (e.g. `/introspection` or an in-app view toggle),
   not inside the Conversation Wall.
2. **Three-column flow row** per captured turn:
   - Left = **內心想說** (`innerWant`)
   - Middle = **被 HIDE / 沒說** (`heldBack`, with `gateReason` as a small tag)
   - Right = **說出口** (`said`), with speaker → listener label.
   - Visually convey the left→middle→right flow (arrows / columns), so the gap
     between "想說" and "說出口" (the unsaid) is the visual point.
3. **Group by day**, newest first; show speaker/listener + time per row.
4. **Expandable per conversation** to see the turn sequence in order.
5. **Header explainer** (short): the 內心 → 社交 gate → 說出口 pipeline and that
   this shows what each character chose NOT to say.
6. Read-only. Reuse the project's existing styling (see `src/index.css` /
   `ConversationWall.tsx` for tokens), but keep it a distinct view.
7. **Empty state**: when no introspection samples exist yet (the runtime is
   gated off by default), show a clear "尚未開啟 introspection 取樣" message, not a
   blank/broken page.

## Mockup-first (do this first)
Before wiring to live data, deliver a **static mockup** with 3–4 hardcoded sample
rows so Alan can approve the LAYOUT. Sample rows to use:

```
① 想說: 海想直接說「你又熬夜了，別再硬撐」
② 被HIDE: 把指責收起來，怕讓對方有壓力 (gate: 關係/不想加重負擔)
③ 說出口: 「桌上那杯，我幫你換成熱的。」

① 想說: 天澤想戳穿「你根本不信任我的提案」
② 被HIDE: 把對抗壓成玩笑，留退路 (gate: 風險/面子)
③ 說出口: 「欸，這個玩笑誰買單啊？」

① 想說: 一之瀨想說「這份善意你欠我一次」
② 被HIDE: 不講出帳，只留一個甜的鉤子 (gate: 控制距離)
③ 說出口: 「沒事，我本來就想幫你。」
```

After Alan approves the layout, wire it to the `speechIntrospection` query CC
provides.

## Boundaries
- Read-only. No runtime/prompt/memory/schema changes (CC owns the schema + capture).
- Do not fabricate introspection for real conversations — only render what the
  `speechIntrospection` table actually contains (CC's gated capture writes it).
- Keep it a separate view; do not clutter the Conversation Wall (Alan removed QA
  cruft from the Wall earlier — keep that clean).

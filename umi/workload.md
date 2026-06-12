# Umi Workload

Last updated: 2026-06-11 America/Chicago

This file holds one active worker handoff at a time. Keep it narrow.

## Active Task

`uw-2026-06-11-role-dialogue-food-object-policy`

Goal:

- Finish the current role-to-role mirror/motif cleanup by replacing the
  expanding one-off food-name guard pattern with a higher-level pair+scene
  policy for restaurant food-object relay.

Current evidence:

- Alan-facing 海 has a current archived PASS artifact at 09:54 CDT.
- Role-to-role dialogue remains active QA, not complete.
- Targeted guard tests pass 60/60 after fresh-evidence additions.
- Current live worktree at 2026-06-11 19:47 CDT is not the old huge dirty tree:
  dirty files are mostly the emotion-render/visual-asset lane
  (`data/characterVisuals.ts`, `docs/giis-emotion-asset-manifest.md`,
  `public/renders/*`, `public/renders/README.md`) plus coordination files
  (`WORKLOG.md`, `umi/workload.md`). Treat visual assets as a separate
  completed/verification lane and do not modify or stage them while doing
  dialogue QA.
- Runtime evidence after the afternoon patch:
  - 祥子/天澤 improved from hard FAIL to WARN in one fresh probe.
  - 一之瀨/真晝 still produced hard FAIL rows through restaurant food-object
    variants (`水煮蛋`, `布丁`, `一半/真的嗎/表格`).
- Next implementation should not keep adding individual food names forever.

Allowed scope:

- First, report the current worktree buckets:
  1. visual/emotion asset lane,
  2. coordination docs,
  3. dialogue policy/test lane,
  4. unrelated surprises.
  Do not stage, commit, delete, or revert anything.
- Inspect and edit only the dialogue policy / sanitizer / guard path needed for
  restaurant food-object relay, primarily:
  - `convex/agent/conversation.ts`
  - `convex/agent/conversationMotifGuard.test.ts`
  - `evals/conversations/metrics/conversation_metrics.ts` only if the current
    rubric is proven to misclassify an acceptable non-mirror sample.
- Update `WORKLOG.md` and `docs/giis-v0.1-roadmap.md` after verification.

Constraints:

- Do not rewrite the whole prompt system.
- Do not weaken Alan-facing 海 behavior.
- Do not make restaurant scenes silent by default; the goal is to force a
  different move after one food-object beat, or soft-close when the pair keeps
  relaying food objects.
- Preserve night quiet policy and do not use old archived failures as proof of
  current failure.

Suggested verification:

```bash
npm test -- convex/agent/conversationMotifGuard.test.ts
npx tsc --noEmit --pretty false
node scripts/run-free-world-routing-disposable-sample.mjs --focus-pair=Ichinose:Mahiru --min-messages=4 --timeout-ms=260000
node scripts/run-free-world-routing-disposable-sample.mjs --focus-pair=Sakiko:Tianze --min-messages=4 --timeout-ms=260000
npm run eval:conversation:recent -- --since-created-at=<fresh-boundary>
```

Stop condition:

- Stop and report if a fresh runtime sample still produces hard FAIL through a
  genuinely new motif family that is not food-object relay; do not keep stacking
  unrelated repairs into this task.
- Stop and report if the actual worktree differs from the current evidence above
  in a way that would make visual-asset cleanup or dialogue QA unsafe.

## Completed Task

`uw-2026-06-11-maomao-sakiko-replacement`

Alan approved replacing the two legacy male slots:

- `CaoCao` / `曹操` -> Maomao / `貓貓`
- `Liu Bei` / `劉備` -> Sakiko / `祥子`

Intent:

- Follow the same replacement pattern previously used when Asuna/Mai became Tianze/Ichinose.
- Keep current architecture. Do not redesign the map, memory schema, or event engine.
- All live characters should use cloud Qwen for character-soul conversations; local LLM is backup only.
- New characters need complete five-layer soul definitions: public self, private self, relational self, emotional residue, behavioral drift, plus long-term arc/prompt notes if the pilot docs use that shape.
- Update live visual references/portraits/sprites/render wiring so the UI no longer presents CaoCao/Liu Bei as current characters.

Scope for cc:

1. Inspect current git status and relevant files only:
   - `data/giisProfiles.ts`
   - `data/characterVisuals.ts`
   - `data/displayNames.ts`
   - `data/dailyLifeBulletin.ts`
   - `data/spontaneousEvents.ts`
   - `convex/modelPolicy.ts`
   - `convex/modelPolicy.test.ts`
   - `convex/school.ts`
   - `convex/aiTown/agent.ts`
   - `convex/aiTown/addresseeRepair.ts`
   - `convex/agent/dialogueHygiene.ts`
   - `convex/agent/conversation.ts`
   - `docs/soul/README.md`
   - `docs/soul/SOUL_PROGRESSION_PLAN.md`
   - `docs/soul/pilots/caocao.md`
   - `docs/soul/pilots/liubei.md`
   - focused eval/script files that hard-code current live character names, excluding generated/historical reports and paper result archives.
2. Report the live-code replacement map and any missed runtime risk.
3. Implement only narrow textual/data/test updates if confident. Do not touch historical report artifacts under `evals/conversations/reports/**` or `docs/paper/results/**`.
4. Do not run long dev servers or broad eval loops.

Allowed edits:

- Rename or replace the two live character profiles and aliases.
- Add/rename soul pilot docs for Maomao and Sakiko.
- Update provider policy/tests so current live characters route cloud-first with local fallback gated by existing fallback env.
- Update authored daily-life/spontaneous event text for the new roles.
- Update visual config and docs references for the new current characters.
- Update narrow eval/script fixtures where they refer to live current character identities.

Stop conditions:

- Stop and report if a DB migration/destructive reset appears necessary.
- Stop and report if old generated data would need mass rewrite.
- Stop after one bounded pass, with changed files and verification suggestions.

Outcome:

- Live code/data/docs/eval/assets now use Maomao / `貓貓` and Sakiko / `祥子`.
- Legacy aliases (`CaoCao`, `Cao Cao`, `曹操`, `Liu Bei`, `LiuBei`, `劉備`) remain only for compatibility and display/runtime normalization.
- Local Convex runtime profile migration ran with `scope=profiles` and `clearHistory=false`; active debug state confirms Maomao/Sakiko are the persisted roster names and target short-term state is cleared.
- Deep history purge was dry-run only because it would delete conversations/messages/memories/timeline rows. Run it only with Alan approval.

Verification completed:

```bash
npx tsc --noEmit --pretty false
npm test -- --runInBand convex/modelPolicy.test.ts convex/aiTown/addresseeRepair.test.ts convex/agent/dialogueHygiene.test.ts evals/conversations/metrics/conversation_metrics.test.ts
npm run build
CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS=180 ./node_modules/.bin/convex run --typecheck disable --codegen disable school:debugState
```

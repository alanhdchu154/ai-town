# Umi Workload

Last updated: 2026-06-11 America/Chicago

This file holds one active worker handoff at a time. Keep it narrow.

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

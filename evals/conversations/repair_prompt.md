# Codex Conversation Repair Prompt

Given `evals/conversations/reports/latest.md`, make the smallest prompt or code adjustment that reduces the reported conversation failures.

Rules:

- Do not add features.
- Do not change UI.
- Do not rewrite character personalities unless the eval proves a specific character voice regression.
- Prefer small changes in the existing conversation, persona, fallback, memory, or outcome-quality logic.
- Fix the highest-frequency failure category first.
- If the report shows banned template phrases, remove or narrow the fallback path that emits them.
- If the report shows repetition, add response-move diversity or stop conditions; do not only ban another phrase.
- If the report shows weak previous-speaker binding, improve emotional hook extraction or prompt instructions.
- If the report shows verbosity, allow short replies, refusal, silence, or early ending.
- Preserve existing user data and Convex state.

After changes, run:

```bash
npm run eval:conversation
npm run eval:conversation:recent
npx tsc --noEmit
npm run build
```

Then report:

- What report failures were addressed
- What files changed
- New eval summary
- Remaining weakest category

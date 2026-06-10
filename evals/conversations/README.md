# Underworld Conversation Evals

This folder contains a small local regression harness for conversation quality.

It does not fine-tune models and it does not require Convex or an LLM provider. The first version evaluates stored sample outputs with rule-based metrics so prompt changes can be checked quickly before touching live world state.

## Run

```bash
npm run eval:conversation
```

Evaluate recent real archived conversations:

```bash
npm run eval:conversation:recent
```

Evaluate only conversations archived after the latest `convex/agent/conversation.ts` modification:

```bash
npm run eval:conversation:recent -- --since-last-change
```

This mode reports post-fix conversations separately from historical archived conversations. Older samples are labeled `legacy_noise` so they do not keep making a fresh prompt/code fix look worse than it is.

## Fixtures

- `fixtures/umi_companion_cases.json`
  - Alan talking directly to 海 in `companion_chat` mode.
  - Checks direct emotional response, no verbatim repetition, warm Umi voice, and one focused question when appropriate.

- `fixtures/agent_pair_cases.json`
  - NPC-to-NPC conversation samples.
  - Checks emotional binding, one small purpose, character voice, and scene grounding.

- `fixtures/bad_template_cases.json`
  - Known failure patterns.
  - These cases are expected to fail, so the harness can prove it catches old templates.

## Metrics

The current rule-based metrics are:

- `repetitionScore`
- `bannedPhraseCount`
- `directAnswerScore`
- `previousSpeakerBindingScore`
- `wrongAddresseeScore`
- `characterVoiceScore`
- `emotionalSpecificityScore`
- `sceneGroundingScore`
- `verbosityScore`

Each metric returns `PASS`, `WARN`, or `FAIL`. The runner prints a table and exits non-zero only when a fixture produces an unexpected result, for example a known-bad case passing or a normal case failing.

## Optional LLM Judge

`metrics/conversation_metrics.ts` includes a placeholder `conversation_judge(prompt, transcript)` interface:

```ts
conversation_judge(prompt, transcript) => {
  naturalness: 1-5,
  emotional_binding: 1-5,
  character_consistency: 1-5,
  repetition: 1-5,
  notes: string
}
```

Later this can be replaced by promptfoo, DeepEval, LangSmith, or a local judge model. Keep the rule-based metrics even after adding a judge; they catch deterministic regressions cheaply.

## Golden Archive

`golden/` is a tiny taste archive for real conversations that should guide future prompt/model changes. Add only strong archived examples: one clear purpose, correct addressee, emotional binding, character-specific voice, and a natural pause or outcome.

## Future Adapter

The runner currently evaluates `sampleOutput`. A later adapter can generate output through the current Convex prompt path, Qwen, or another model, then feed that output into the same metrics. That lets us compare models without rewriting the eval criteria.

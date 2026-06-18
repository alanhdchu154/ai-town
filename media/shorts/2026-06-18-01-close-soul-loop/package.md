# Short Package: Closing The Soul Loop

Status: review-gated draft. Do not render or upload without Alan approval.

Source:
- `WORKLOG.md` 2026-06-18 Current State Snapshot
- `docs/soul/SOUL_LOOP_LITERATURE_BRIDGE.md`
- `convex/agent/conversationEmotion.ts`
- `convex/agent/conversationEmotion.test.ts`

Core question:
What changed when Underworld stopped treating conversation as the end of the
loop?

Answer:
Conversation now feeds character state, and that state can color how the
character speaks next. It is a functional affective loop, not a claim of
sentience.

Hook:
We finally closed the loop that makes yesterday matter.

Claim boundary:
This is about a bounded simulation mechanism: conversation -> emotion -> later
speech. It does not claim the characters have real feelings.

Verified beat:
A warm summary can move Umi from serious toward smiling, and that current
emotion is then available to the next conversation prompt/UI state.

Visual plan:
- Start with a broken one-way arrow: situation -> speech -> memory.
- Add the missing return arrow: conversation -> emotion -> next speech.
- Show the tiny palette: neutral / smiling / worried / serious, then the new
  planned additions: tired / flustered / guarded / calm.
- End on the test question: did tomorrow sound slightly different?

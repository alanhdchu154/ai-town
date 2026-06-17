# Short Package: How To Make An LLM Talk Like A Person

Status: review-gated draft. Do not render or upload without Alan approval.

Source:
- `WORKLOG.md` #43
- Recent motif/repetition fixes in `convex/agent/conversation.ts`
- Eval reports showing repeated opener / object-template issues

Core question:
Why did the AI characters sound like templates even after the dialogue got more emotional?

Answer:
Because the opener was being driven by archetype. Humans usually start from a
specific event, the person in front of them, and their current mood. Personality
should shape how they speak, not decide the same first move every time.

Hook:
My AI characters were not bad at emotion. They were too good at repeating their assigned role.

Claim boundary:
This is an Underworld bug/postmortem, not a claim that AI characters are human.

Visual plan:
- Before: repeated opener words / symptom motifs highlighted.
- Middle: simple stack: event + person + mood -> first line.
- After: one quieter conversation line that starts from context.

Review requirement:
Alan must approve the exact transcript examples before any public use.

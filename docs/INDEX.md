# Documentation Index

A single page mapping where every kind of information lives. If you are
looking for something and it is not here, ask before grepping — adding a
new doc location without updating this index is how the project
accumulates 3 contradictory sources of truth.

Last updated: 2026-06-10.

---

## Authoritative documents (the ones that drive decisions)

| Document | Purpose | When to read / update |
|---|---|---|
| [docs/giis-v0.1-roadmap.md](giis-v0.1-roadmap.md) | **The** v0.1 contract. North-star scope, current foregrounding rules, Phase 1 residue contract, dangerous-scope guardrail, durable follow-ups, recent-context entries (2026-05-28+). Earlier phases live in git log only (use `git log -p docs/giis-v0.1-roadmap.md` to recover historical content). | Update on every significant scope decision or phase completion. |
| [../README.md](../README.md) | Outward-facing project overview, v0.1 goal, screenshots, what's-next gate. | Keep in sync with roadmap when v0.1 scope shifts. |
| [../AGENTS.md](../AGENTS.md) | Working agreement: how Codex / CC / Umi collaborate, secrets policy, where keys live. | Update only when collaboration rules actually change. |
| [../WORKLOG.md](../WORKLOG.md) | Today / last few days of activity, current evidence, open follow-ups, and verification notes. Not append-only; completed/stale/duplicate items can be removed, summarized, or archived. | After meaningful sessions that change current state, risk, evidence, or next action. |

## Paper / preprint package

| Document | Purpose |
|---|---|
| [paper/ALAN_HANDOFF.md](paper/ALAN_HANDOFF.md) | One-page boundary summary for the emotional-residue paper. |
| [paper/OSF_RELEASE_RECORD.md](paper/OSF_RELEASE_RECORD.md) | OSF submission record. Alan reported OSF submission on 2026-06-10; URL / DOI still need to be recorded locally. |
| [paper/ARXIV_PREPRINT_RELEASE_PACKET.md](paper/ARXIV_PREPRINT_RELEASE_PACKET.md) | Conservative arXiv A-path packet retained for a future arXiv mirror; arXiv is currently blocked by endorsement. |
| [paper/PUBLISH_READY_CHECKLIST.md](paper/PUBLISH_READY_CHECKLIST.md) | Detailed local checklist of completed paper hardening and remaining blockers. |
| [paper/CLAIM_EVIDENCE_MATRIX.md](paper/CLAIM_EVIDENCE_MATRIX.md) | Claim-to-artifact ledger and reviewer-safe boundaries. |

## Soul / character architecture

| Document | Purpose |
|---|---|
| [soul/UNDERWORLD_SOUL_ARCHITECTURE.md](soul/UNDERWORLD_SOUL_ARCHITECTURE.md) | The five-layer soul model. |
| [soul/SOUL_PROGRESSION_PLAN.md](soul/SOUL_PROGRESSION_PLAN.md) | How soul depth deepens across v0.1 → v0.2+. |
| [soul/AUTONOMOUS_DIRECTOR_LOOP.md](soul/AUTONOMOUS_DIRECTOR_LOOP.md) | The observe → propose → repair loop design. |
| [soul/EVENT_THREAD_CONTINUITY_PLAN.md](soul/EVENT_THREAD_CONTINUITY_PLAN.md) | Event-thread continuity plan: school events become shared context without becoming scripts. |
| [soul/pilots/umi.md](soul/pilots/umi.md) | Umi pilot soul definition (v0.1 primary). |
| [soul/pilots/mahiru.md](soul/pilots/mahiru.md) | Mahiru pilot soul definition (v0.1 primary). |
| [soul/pilots/tianze.md](soul/pilots/tianze.md) | Tianze pilot soul definition (v0.1 primary, Convex runtime key `Tianze`). |
| [soul/pilots/caocao.md](soul/pilots/caocao.md) | Cao Cao soul definition (secondary local-LLM). |
| [soul/pilots/ichinose.md](soul/pilots/ichinose.md) | Ichinose soul definition (secondary local-LLM, Convex runtime key `Ichinose`). |
| [soul/pilots/liubei.md](soul/pilots/liubei.md) | Liu Bei soul definition (secondary local-LLM). |
| [soul/README.md](soul/README.md) | Soul docs sub-index. |

Recent-memory continuity is now contracted by **rolling two-hour continuity**
(`npm run underworld:rolling-continuity`); the old AM→PM goal doc was retired on
2026-06-10 (recoverable via git history).

## Design notes (deeper than the roadmap, may decay)

| Document | Purpose | Status |
|---|---|---|
| [giis-memory-architecture.md](giis-memory-architecture.md) | Working design note for memory storage. Not yet migrated — kept as reference. | Deferred to v0.2+. |
| [umi-emotional-response-examples.md](umi-emotional-response-examples.md) | Voice references for Umi. | Active. |
| [giis-ui-directions.md](giis-ui-directions.md) | UI direction note: make residue visible, separate player value from dev tooling, briefing as front door, freeze-don't-churn. Judged against the north star, not a contract. | Active (may decay). |
| [giis-vn-art-spec.md](giis-vn-art-spec.md) | VN full-render art brief (Route A): character render generation prompts, emotion set, naming, scene backgrounds, React overlay outline. Exploratory, v0.2+, implementation needs a proposal. | Exploratory (v0.2+). |

## Eval output (machine-generated, gets overwritten)

| Path | What it contains |
|---|---|
| [../evals/conversations/reports/soul-triad-latest.md](../evals/conversations/reports/soul-triad-latest.md) | Latest Umi / Mahiru / Tianze triad eval result. Overwritten by `npm run eval:soul-triad`. |
| [../evals/conversations/reports/latest.md](../evals/conversations/reports/latest.md) | Latest general conversation eval. |
| [../evals/conversations/reports/soul-rubric-reconciliation.md](../evals/conversations/reports/soul-rubric-reconciliation.md) | Analysis of soul-marker scoring decisions. |
| `../evals/conversations/golden/` | Hand-curated conversations as quality references / future eval fixtures. |

## Operational handoff (active task state)

| Path | Purpose |
|---|---|
| [../umi/workload.md](../umi/workload.md) | **Current active task** for CC. Replaceable, one task at a time. |
| [../umi/COMMAND_REFERENCE.md](../umi/COMMAND_REFERENCE.md) | Single page mapping every npm script / shell wrapper / direct Convex command. |
| `../umi/proposals/` | Archived proposals (e.g. `v01-approach-proposal.mjs`). |
| `../umi/reports/` | Machine-written reports from director loop / repair gate / observe runs. |

## Screenshots

| Path | Purpose |
|---|---|
| [screens/campus-overview.png](screens/campus-overview.png) | Main play view (left pills, classroom, right drawer). |
| [screens/conversation-wall.png](screens/conversation-wall.png) | The 對話牆 archive view. |
| [screens/README.md](screens/README.md) | Capture conventions. |

---

## Where does X go?

| If you have… | Put it in… |
|---|---|
| A scope or acceptance decision | `docs/giis-v0.1-roadmap.md` (brief durable milestone or direction) |
| A session work log | `WORKLOG.md` (today / last few days only; clean completed/stale items) |
| A new active CC handoff | `umi/workload.md` (overwrite — one task at a time, with pass type / Umi first look / current change set / open questions for cc) |
| A character soul change | `docs/soul/pilots/<name>.md` + roadmap note |
| A new command / script | Document it in `umi/COMMAND_REFERENCE.md` |
| A new env var | `.env.local.example` + comment block where it's read |
| A reusable design note | `docs/<topic>.md` and add a line here |
| An eval output | Let the script write it under `evals/conversations/reports/` |
| A throwaway investigation | A scratch file in `/tmp` — not the repo |

---

## Rules

1. **Do not write the same fact in two places.** Link instead. Stale
   duplicates are how the project drifted into three soul docs that
   contradicted each other.
2. **`WORKLOG.md` is today / last few days of current evidence.
   `umi/workload.md` is overwritable and holds the active Codex/cc task.
   `docs/giis-v0.1-roadmap.md` is durable direction.** Do not mix them.
   Remove, summarize, or archive completed/stale/duplicate worklog items when
   they no longer drive the next action.
3. **`docs/giis-v0.1-roadmap.md` overrides everything else for v0.1
   scope.** If a design note conflicts with the roadmap, the roadmap
   wins until it is updated.

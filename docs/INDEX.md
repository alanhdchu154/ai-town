# Documentation Index

A single page mapping where every kind of information lives. If you are
looking for something and it is not here, ask before grepping — adding a
new doc location without updating this index is how the project
accumulates 3 contradictory sources of truth.

Last updated: 2026-05-25.

---

## Authoritative documents (the ones that drive decisions)

| Document | Purpose | When to read / update |
|---|---|---|
| [docs/giis-v0.1-roadmap.md](giis-v0.1-roadmap.md) | **The** v0.1 contract. Scope, acceptance criteria, fresh-sample rule, weekly plan, dated implementation phases. | Update on every significant scope decision or phase completion. |
| [../README.md](../README.md) | Outward-facing project overview, v0.1 goal, screenshots, what's-next gate. | Keep in sync with roadmap when v0.1 scope shifts. |
| [../AGENTS.md](../AGENTS.md) | Working agreement: how Codex / CC / Umi collaborate, secrets policy, where keys live. | Update only when collaboration rules actually change. |
| [../WORKLOG.md](../WORKLOG.md) | Append-only chronological log of work done, by whom, with verification. New entries on top. | After every meaningful session. |

## Soul / character architecture

| Document | Purpose |
|---|---|
| [soul/UNDERWORLD_SOUL_ARCHITECTURE.md](soul/UNDERWORLD_SOUL_ARCHITECTURE.md) | The five-layer soul model. |
| [soul/SOUL_PROGRESSION_PLAN.md](soul/SOUL_PROGRESSION_PLAN.md) | How soul depth deepens across v0.1 → v0.2+. |
| [soul/AUTONOMOUS_DIRECTOR_LOOP.md](soul/AUTONOMOUS_DIRECTOR_LOOP.md) | The observe → propose → repair loop design. |
| [soul/pilots/umi.md](soul/pilots/umi.md) | Umi pilot soul definition. |
| [soul/pilots/mahiru.md](soul/pilots/mahiru.md) | Mahiru pilot soul definition. |
| [soul/pilots/asuna.md](soul/pilots/asuna.md) | Asuna pilot soul definition. |
| [soul/README.md](soul/README.md) | Soul docs sub-index. |

## Design notes (deeper than the roadmap, may decay)

| Document | Purpose | Status |
|---|---|---|
| [giis-memory-architecture.md](giis-memory-architecture.md) | Working design note for memory storage. Not yet migrated — kept as reference. | Deferred to v0.2+. |
| [giis-soul-systems-revisit-plan.md](giis-soul-systems-revisit-plan.md) | Five soul markers and how to score them. | Mostly absorbed into `evals/conversations/runSoulTriadEval.ts`. |
| [umi-emotional-response-examples.md](umi-emotional-response-examples.md) | Voice references for Umi. | Active. |

## Eval output (machine-generated, gets overwritten)

| Path | What it contains |
|---|---|
| [../evals/conversations/reports/soul-triad-latest.md](../evals/conversations/reports/soul-triad-latest.md) | Latest Umi / Mahiru / Asuna triad eval result. Overwritten by `npm run eval:soul-triad`. |
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
| A scope or acceptance decision | `docs/giis-v0.1-roadmap.md` (dated section) |
| A session work log | `WORKLOG.md` (append on top) |
| A new active CC handoff | `umi/workload.md` (overwrite — one task at a time) |
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
2. **`WORKLOG.md` is append-only and chronological. `umi/workload.md`
   is overwritable and holds the active task.** Do not mix them.
3. **`docs/giis-v0.1-roadmap.md` overrides everything else for v0.1
   scope.** If a design note conflicts with the roadmap, the roadmap
   wins until it is updated.

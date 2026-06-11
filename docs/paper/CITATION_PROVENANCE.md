# Citation Provenance Ledger

Status on 2026-06-06: this ledger records source provenance for the references
used in `docs/paper/arxiv/main.tex`. It is a release-readiness aid, not a
substitute for final copyediting, DOI normalization, or venue-specific
bibliography style.

## Policy

- Recent LLM-agent, memory, role-playing, and AI Town references should point
  to a primary or official source such as arXiv, ACL Anthology, ACM DOI, or
  GitHub.
- Classic books and older theory references may be listed as stable
  bibliographic anchors when they support broad background framing rather than
  fragile empirical claims.
- The manuscript must not strengthen novelty claims merely because a reference
  appears here; the claim boundary remains governed by
  `docs/paper/CLAIM_EVIDENCE_MATRIX.md`.

## References

| key | source_status | source | manuscript role | boundary |
|---|---|---|---|---|
| park2023generative | primary_verified | https://arxiv.org/abs/2304.03442 | Generative Agents baseline for observe-memory-reflect-plan shared-world agents. | Use as lineage and contrast; do not claim emotional residue supersedes the architecture. |
| aitown | official_verified | https://github.com/a16z-infra/ai-town | Upstream implementation lineage for AI Town-derived world. | Attribute fork lineage; do not imply upstream authors endorse Underworld. |
| picard1997affective | publisher_verified | https://mitpress.mit.edu/9780262161701/affective-computing/ | Affective-computing background for computational emotion state. | Background only; the paper does not claim an affective-computing model. |
| ortony1988cognitive | publisher_verified | https://www.cambridge.org/core/books/cognitive-structure-of-emotions/cognitive-structure-of-emotions/D16784CA50F5BBD58F3140B575BB7881 | Appraisal/emotion-structure background. | Background only; no OCC implementation claim. |
| mehrabian1974approach | publisher_verified | https://mitpress.mit.edu/9780262130905/an-approach-to-environmental-psychology/ | Classic affect/environment framing. | Background only; no PAD-scale experiment claim. |
| bates1994role | publisher_verified | https://cacm.acm.org/research/the-role-of-emotion-in-believable-agents/ | Believable-agent emotion and behavior framing. | Background only; do not claim current agents are validated as believable agents. |
| goffman1959presentation | classic_bibliographic_anchor | Goffman, E. (1959). The Presentation of Self in Everyday Life. Doubleday. | Frontstage/backstage social-self framing for the five-layer model. | Stable sociological anchor; final copyedit should verify edition/page details if quoted. |
| bickmore2005relational | doi_verified | https://doi.org/10.1016/j.intcom.2005.09.002 | Relational-agent framing for long-term social-emotional interfaces. | Use as motivation; current work is not a validated relational-agent intervention. |
| shao2023characterllm | primary_verified | https://arxiv.org/abs/2310.10158 | Role-playing / trainable character-agent contrast. | Contrast runtime residue with training-time persona construction. |
| sotopia | primary_verified | https://arxiv.org/abs/2310.11667 | Interactive social-intelligence evaluation context for language agents. | Use as evaluation-field context; current work does not claim SOTOPIA-style broad social-intelligence scores. |
| lifelongsotopia | primary_verified | https://arxiv.org/abs/2506.12666 | Multi-episode social-agent evaluation and interaction-history context. | Use as motivation for history-sensitive social agents; do not claim comparable benchmark coverage or human-level validation. |
| memorybank | primary_verified | https://arxiv.org/abs/2305.10250 | Long-term companion-dialogue memory reference. | Contrast broader memory updating with bounded same-pair residue trace. |
| longmem | primary_verified | https://arxiv.org/abs/2306.07174 | Long-context / long-term memory mechanism reference. | Contrast capacity/context memory with relational pressure. |
| memgpt | primary_verified | https://arxiv.org/abs/2310.08560 | Virtual context / memory-tier management reference. | Contrast context-management systems with emotional residue pattern. |
| reflexion | primary_verified | https://arxiv.org/abs/2303.11366 | Verbal reflection / episodic memory for agent improvement. | Contrast task-feedback memory with relational aftertaste memory. |
| voyager | primary_verified | https://arxiv.org/abs/2305.16291 | Skill-library memory for embodied open-ended learning. | Contrast executable skill memory with dialogue-continuity trace. |
| llmagentmemorysurvey | primary_verified | https://arxiv.org/abs/2404.13501 | Survey anchor for LLM-agent memory mechanisms. | Use as field map; do not claim exhaustive coverage of all 2025-2026 memory work. |

## Known Copyedit Limits

- The current arXiv source uses hand-written `thebibliography` entries rather
  than BibTeX. Before an external release, Alan/Codex should normalize venue
  style, DOI links, and edition details if a target venue requires them.
- This ledger is source-provenance evidence for conservative preprint framing;
  it does not clear empirical, PDF, or submitter-decision blockers.

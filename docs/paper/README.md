# Research Papers — Topic Map

這個資料夾依**研究主題**組織：每個 topic 衍生出一篇或多篇 paper，每篇 paper 底下再分
manuscript / plan / claims / experiments / release / data / tooling。不確定某份文件在幹嘛、
或新東西該放哪，先看這頁。

```
docs/paper/
├── README.md                      ← 你在這裡（主題地圖）
├── emotional-residue/             ← Topic 1, Paper A（v0.1，已投 OSF）
│   ├── manuscript/   投稿本體
│   ├── plan/         計畫 + 投稿策略
│   ├── claims/       claim 帳本 + reviewer 防守
│   ├── experiments/  協議 + 預註冊 + 接受 gate
│   ├── release/      發布紀錄 + 對外 gate + handoff
│   ├── data/         分析輸入 dataset
│   └── results/      生成的 audit / 圖表 / 報告（會被覆蓋）
└── subjective-rebedding/          ← Topic 1, Paper B（v0.2+，構想中）
```

> ⚠️ **每篇 paper 資料夾內的檔名/相對位置不要再亂搬。** `scripts/paper/` 的 audit、
> `npm run paper:*`、`acceptance_hashes.py` 都把這些路徑寫死，有些還對特定檔案做 SHA-256 hash。
> 要再重組，先改 `scripts/paper/` 裡的路徑常數，否則整條工具鏈會壞。

最後更新：2026-06-13。

---

# Topic 1 — Memory & Felt Continuity in LLM Character Agents

核心研究線：**用輕量記憶讓 LLM 角色「昨天有意義」**。底下兩篇 paper：A 已成形、B 是延伸構想。

## Paper A — Emotional Residue　[ACTIVE · v0.1 · 已投 OSF]

> 一句話：要讓玩家覺得昨天有意義，需要的是**更少**記憶——一行人類可讀的情感痕跡，
> 被下一段對話當**壓力**讀回去（影響注意/語氣），而非逐字引用或數值儀表板。
> 定位是 **design / systems pattern**，不是 empirical effect paper。

全部檔案在 [emotional-residue/](emotional-residue/)。**先讀** [release/ALAN_HANDOFF.md](emotional-residue/release/ALAN_HANDOFF.md)（一頁 boundary）。

### 📄 manuscript — 投稿本體
| 檔案 | 用途 |
|---|---|
| [manuscript/main.tex](emotional-residue/manuscript/main.tex) | **投稿 source（LaTeX）**，submission 的真正來源。 |
| [manuscript/emotional-residue.md](emotional-residue/manuscript/emotional-residue.md) | design-note 草稿 prose（較豐富的規劃文字），也是 OSF PDF 的 render 來源。 |
| [manuscript/README.md](emotional-residue/manuscript/README.md) | source package 說明。 |

### 🗺️ plan — 計畫 + 投稿策略
| 檔案 | 用途 |
|---|---|
| [plan/PAPER_PLAN.md](emotional-residue/plan/PAPER_PLAN.md) | 高層種子：thesis、4 claims、分工。細節已拆到其他資料夾（文末有對照表）。 |
| [plan/SUBMISSION_STRATEGY.md](emotional-residue/plan/SUBMISSION_STRATEGY.md) | venue 表（OSF→arXiv→workshop→full）、解鎖條件、title 候選。 |

### 🛡️ claims — claim 帳本 + reviewer 防守
| 檔案 | 用途 |
|---|---|
| [claims/CLAIM_EVIDENCE_MATRIX.md](emotional-residue/claims/CLAIM_EVIDENCE_MATRIX.md) | claim → 最強證據 → 必守邊界。`npm run paper:evidence-matrix-audit` 稽核。 |
| [claims/REVIEWER_PREMORTEM.md](emotional-residue/claims/REVIEWER_PREMORTEM.md) | 預想 reviewer 反對 + 回應邊界。 |
| [claims/CITATION_PROVENANCE.md](emotional-residue/claims/CITATION_PROVENANCE.md) | 每個 bibliography key 的來源帳本。`npm run paper:citation-audit` 稽核。 |

### 🧪 experiments — 協議 + 預註冊（目前 paused）
> 為「升級成 empirical effect 論文」準備。收集**暫停中**，要重啟須 Alan 接受 schedule + prereg 兩個 gate。

| 檔案 | 用途 | 狀態 |
|---|---|---|
| [experiments/EXPERIMENTS.md](emotional-residue/experiments/EXPERIMENTS.md) | 可執行協議：本機跑出 dataset 再餵離線分析。 | — |
| [experiments/LONGITUDINAL_EXPERIMENT_PLAN.md](emotional-residue/experiments/LONGITUDINAL_EXPERIMENT_PLAN.md) | 長期 ablation 計畫。 | paused（n=2/arm） |
| [experiments/SCHEDULE_DECISION.md](emotional-residue/experiments/SCHEDULE_DECISION.md) + [SCHEDULE_ACCEPTANCE.json](emotional-residue/experiments/SCHEDULE_ACCEPTANCE.json) | 收集排程決定 + 接受 gate（含 SHA-256）。 | `accepted: false` |
| [experiments/PREREGISTRATION_PROTOCOL.md](emotional-residue/experiments/PREREGISTRATION_PROTOCOL.md) + [PREREGISTRATION_ACCEPTANCE.json](emotional-residue/experiments/PREREGISTRATION_ACCEPTANCE.json) | 機器稽核的預註冊 + 接受 gate。 | `accepted: false` |
| [experiments/HUMAN_ANNOTATION_PROTOCOL.md](emotional-residue/experiments/HUMAN_ANNOTATION_PROTOCOL.md) + [annotations_template.csv](emotional-residue/experiments/annotations_template.csv) | 人工標註協議 + 表範本。 | 未標註 |

### 🚀 release — 發布紀錄 + 對外 gate + handoff
| 檔案 | 用途 | 狀態 |
|---|---|---|
| [release/ALAN_HANDOFF.md](emotional-residue/release/ALAN_HANDOFF.md) | **一頁 boundary**：能說什麼、不能說什麼、發布前要決定什麼。 | — |
| [release/PUBLISH_READY_CHECKLIST.md](emotional-residue/release/PUBLISH_READY_CHECKLIST.md) | 進度總帳：完成項 + 剩餘 blocker + 驗證指令。 | — |
| [release/OSF_RELEASE_RECORD.md](emotional-residue/release/OSF_RELEASE_RECORD.md) | OSF 投稿紀錄。 | URL/DOI 待補 |
| [release/ARXIV_PREPRINT_RELEASE_PACKET.md](emotional-residue/release/ARXIV_PREPRINT_RELEASE_PACKET.md) | A-path arXiv packet。 | arXiv 卡 endorsement |
| [release/SUBMISSION_DECISIONS.json](emotional-residue/release/SUBMISSION_DECISIONS.json) | 投稿決定 gate（作者/affiliation/category/license…）。 | 未確認 |
| [release/PDF_VERIFICATION_PROTOCOL.md](emotional-residue/release/PDF_VERIFICATION_PROTOCOL.md) + [PDF_VERIFICATION.json](emotional-residue/release/PDF_VERIFICATION.json) | PDF render 驗證 gate。 | `PDF_BLOCKER` |

### 📊 data / results — 輸入與生成物（機器產生，會被覆蓋，不要手改）
| 路徑 | 內容 |
|---|---|
| [data/](emotional-residue/data/) | 分析用輸入 dataset.json。 |
| [results/](emotional-residue/results/) | 各 `paper:*-audit` 輸出、longitudinal dataset/blinded transcripts、power 表、repeatability 快照、osf PDF、arxiv-source 壓縮包。 |

### 🔧 tooling（不在這個資料夾）
分析 + 18 個 audit 腳本與資料契約：[scripts/paper/README.md](../../scripts/paper/README.md)。

### Gate 狀態速查
| Gate | 檔案 | 現況 |
|---|---|---|
| 收集排程 | experiments/SCHEDULE_ACCEPTANCE.json | ❌ 未接受 |
| 預註冊 | experiments/PREREGISTRATION_ACCEPTANCE.json | ❌ 未接受 |
| 投稿決定 | release/SUBMISSION_DECISIONS.json | ❌ 未確認 |
| PDF 驗證 | release/PDF_VERIFICATION.json | ❌ `PDF_BLOCKER` |
| 本機 readiness | `npm run paper:readiness` | ⚠️ `LOCAL_SOURCE_READY_WITH_WARNINGS` |

---

## Paper B — Subjective Memory Re-Bedding　[FUTURE · v0.2+]

> 一句話：同一個客觀事件，在不同角色身上長成**不同的** subjective memory 與行為。
> 「Yesterday mattered **differently** to each person.」是 Paper A 的延伸，尚未實作。

| 檔案 | 用途 |
|---|---|
| [subjective-rebedding/SUBJECTIVE_MEMORY_REBEDDING_IDEA.md](subjective-rebedding/SUBJECTIVE_MEMORY_REBEDDING_IDEA.md) | 構想筆記：核心問題、working model、實驗設計草圖、實作前置條件。 |

建立在 Paper A 的 residue 機制 + 五層靈魂模型之上；自己的 data/experiments 還沒有
（前置條件見構想筆記）。

---

## 之後新增主題/論文的慣例

- 新的研究主題 → 開一個 `docs/paper/<topic-slug>/` 資料夾。
- 主題下的單篇 paper 若文件夠多 → 用同樣的 `manuscript / plan / claims / experiments / release / data / results` 分層。
- 加了新檔案，順手更新這頁的主題地圖，以及全 repo 文件總索引 [../INDEX.md](../INDEX.md)。
</content>

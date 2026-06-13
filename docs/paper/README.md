# Paper Package Index — Emotional Residue

這是 **emotional-residue 論文** 整包文件的地圖。檔案很多，但其實只分成幾類。
不確定某份文件在幹嘛、或某個事實該寫哪，先看這頁。

> ⚠️ **不要搬動或改名這個資料夾裡的檔案。** `scripts/paper/` 的 audit 腳本、
> `npm run paper:*` 工具、以及 `acceptance_hashes.py` 都把這些路徑/檔名寫死，
> 有些還對特定檔案做 SHA-256 hash。要重組請先改腳本，否則整條工具鏈會壞。

最後更新：2026-06-13。

---

## 一句話定位

這是一篇 **design / systems pattern 論文**，不是 empirical effect 論文。
現在能辯護的是「emotional residue 是一個輕量、可檢視的 write/read 記憶 pattern」；
**還不能**宣稱 residue 改善了玩家感受到的連續性、callback 率或角色品質。
完整邊界看 [ALAN_HANDOFF.md](ALAN_HANDOFF.md)。

---

## 先讀這三份（entry points）

| 檔案 | 用途 |
|---|---|
| [ALAN_HANDOFF.md](ALAN_HANDOFF.md) | **從這裡開始。** 一頁 boundary：現在能說什麼、不能說什麼、對外發布前 Alan 要決定什麼。 |
| [PAPER_PLAN.md](PAPER_PLAN.md) | 高層種子（中文）：一句話 thesis、4 個貢獻 claims、分工。細節已拆到專門檔，文末有「細節去哪了」對照表。 |
| [PUBLISH_READY_CHECKLIST.md](PUBLISH_READY_CHECKLIST.md) | 進度總帳：已完成的所有硬化工作 + 剩餘 blocker + 驗證指令清單。要看「做到哪了」翻這份。 |

---

## 投稿 source（真正要送出去的東西）

| 檔案 | 用途 |
|---|---|
| [arxiv/main.tex](arxiv/main.tex) | **投稿 source（LaTeX）。** 這是 submission 的真正來源。 |
| [arxiv/README.md](arxiv/README.md) | source package 說明 + 目前狀態。 |
| [emotional-residue.md](emotional-residue.md) | design-note 草稿 prose（較豐富的規劃文字 + repo-grounded 註記）。投稿以 `main.tex` 為準，這份是陪襯。 |

## 投稿 / 發布策略與紀錄

| 檔案 | 用途 | 狀態 |
|---|---|---|
| [SUBMISSION_STRATEGY.md](SUBMISSION_STRATEGY.md) | venue table、tier 路線（OSF → arXiv → workshop → full）、reviewer 反對預案、title 候選。 | — |
| [OSF_RELEASE_RECORD.md](OSF_RELEASE_RECORD.md) | OSF 投稿紀錄。Alan 2026-06-10 報告已投 OSF。 | URL / DOI 待補 |
| [ARXIV_PREPRINT_RELEASE_PACKET.md](ARXIV_PREPRINT_RELEASE_PACKET.md) | A-path arXiv packet，保留給未來 arXiv mirror。 | arXiv 被 endorsement 卡住 |
| [SUBMISSION_DECISIONS.json](SUBMISSION_DECISIONS.json) | Alan 要拍板的投稿決定 gate（作者名/affiliation/email/category/license…）。 | 全空，未確認 |

## 實驗協議 / 預註冊（未來嚴謹版的合約，目前 paused）

> 這一整組是為了「升級成 empirical effect 論文」準備的。收集**目前暫停**，
> 要重啟必須 Alan 明確接受 schedule + preregistration 兩個 gate。

| 檔案 | 用途 | 狀態 |
|---|---|---|
| [EXPERIMENTS.md](EXPERIMENTS.md) | 可執行協議：Alan 本機要跑的確切步驟，產出 dataset 再餵離線分析。 | — |
| [LONGITUDINAL_EXPERIMENT_PLAN.md](LONGITUDINAL_EXPERIMENT_PLAN.md) | 長期 residue ablation 計畫。 | paused（n=2/arm，太小） |
| [SCHEDULE_DECISION.md](SCHEDULE_DECISION.md) | residue READ ablation 的收集排程決定（arm-pure long-window）。 | 待 Alan 接受 |
| [SCHEDULE_ACCEPTANCE.json](SCHEDULE_ACCEPTANCE.json) | 上者的接受 gate（含 SHA-256）。 | `accepted: false` |
| [PREREGISTRATION_PROTOCOL.md](PREREGISTRATION_PROTOCOL.md) | 機器稽核的預註冊草稿：arms、outcomes、納入排除、停止規則、樣本量政策。 | draft，未接受 |
| [PREREGISTRATION_ACCEPTANCE.json](PREREGISTRATION_ACCEPTANCE.json) | 上者的接受 gate（含 SHA-256）。 | `accepted: false` |
| [HUMAN_ANNOTATION_PROTOCOL.md](HUMAN_ANNOTATION_PROTOCOL.md) | 人工標註協議（≥2 raters 驗 rule-based markers 的 convergent validity）。 | 協議 ready，尚未標註 |
| [annotations_template.csv](annotations_template.csv) | 標註表 schema 範本。 | — |

## 證據帳本 / reviewer 防守

| 檔案 | 用途 |
|---|---|
| [CLAIM_EVIDENCE_MATRIX.md](CLAIM_EVIDENCE_MATRIX.md) | claim → 最強現有證據 → 必須守住的邊界。`npm run paper:evidence-matrix-audit` 稽核。 |
| [CITATION_PROVENANCE.md](CITATION_PROVENANCE.md) | 每個 bibliography key 的來源帳本。`npm run paper:citation-audit` 稽核。 |
| [REVIEWER_PREMORTEM.md](REVIEWER_PREMORTEM.md) | 預想 reviewer 反對 + 目前的回應邊界。 |

## PDF / 發布前驗證 gate

| 檔案 | 用途 | 狀態 |
|---|---|---|
| [PDF_VERIFICATION_PROTOCOL.md](PDF_VERIFICATION_PROTOCOL.md) | rendered-PDF / 平台預覽 ready 前要滿足什麼。 | 未驗證 |
| [PDF_VERIFICATION.json](PDF_VERIFICATION.json) | PDF 驗證證據 gate（本機無 TeX 工具鏈）。 | `PDF_BLOCKER` |

## 未來研究方向（不屬於 v0.1）

| 檔案 | 用途 |
|---|---|
| [SUBJECTIVE_MEMORY_REBEDDING_IDEA.md](SUBJECTIVE_MEMORY_REBEDDING_IDEA.md) | v0.2+ 想法：同一客觀事件在不同角色身上長成不同的 subjective memory。「Yesterday mattered **differently** to each person.」尚未實作。 |

## 生成結果 / audit 輸出（機器產生，會被覆蓋，不要手改）

| 路徑 | 內容 |
|---|---|
| [results/](results/) | 各 `paper:*-audit` 的輸出 report（claim / empirical / mechanism / source / consistency…）。 |
| [results/longitudinal/](results/longitudinal/) | 合併後的 ablation dataset、blinded transcripts、標註 packet、圖表。目前 n=2/arm pilot。 |
| [results/current-smoke/](results/current-smoke/) | 8-conversation 可行性 snapshot 的分析輸出。 |
| [results/power/](results/power/) | 樣本量 / MDE / cluster 敏感度表。 |
| [results/repeatability/](results/repeatability/) | rolling-continuity 連續性快照（2026-06-04～06）。 |
| [results/osf/](results/osf/) | 本機產的 OSF-ready PDF/HTML。 |
| [results/arxiv-source/](results/arxiv-source/) | allowlisted source 壓縮包（只含 `main.tex`）+ manifest。 |
| [data/](data/) | 分析用的輸入 dataset.json。 |

---

## Gate 狀態速查（一眼看現在卡在哪）

| Gate | 檔案 | 現況 |
|---|---|---|
| 收集排程 | `SCHEDULE_ACCEPTANCE.json` | ❌ 未接受 |
| 預註冊 | `PREREGISTRATION_ACCEPTANCE.json` | ❌ 未接受 |
| 投稿決定 | `SUBMISSION_DECISIONS.json` | ❌ 未確認 |
| PDF 驗證 | `PDF_VERIFICATION.json` | ❌ `PDF_BLOCKER` |
| 本機 readiness | `npm run paper:readiness` | ⚠️ `LOCAL_SOURCE_READY_WITH_WARNINGS` |

要重啟 empirical 收集，前兩個 gate 必須先 accepted；要對外正式投稿，後三個要清掉。

## 相關（不在這個資料夾）

- 分析 / audit 腳本與資料契約：[scripts/paper/README.md](../../scripts/paper/README.md)
- 全 repo 文件總索引：[docs/INDEX.md](../INDEX.md)

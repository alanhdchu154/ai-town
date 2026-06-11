# 論文計畫（給 Codex / 外部 review 用）

> 這份文件是 **GIIS Underworld** 第一篇論文的完整 plan，刻意寫成「讓人挑毛病」的格式。
> Codex / reviewer：請直接攻擊 §3 的實驗設計、§4 的統計選擇、§7 的對外宣稱強度。
> 配套文件：`emotional-residue.md`（草稿骨架）、`SUBMISSION_STRATEGY.md`（投稿表）、
> `EXPERIMENTS.md`（可執行協議，建置中）、`scripts/paper/`（分析腳本，建置中）。

---

## 0. 一句話論點（thesis）

> 要讓 LLM 角色讓玩家「感覺昨天有意義」，需要的是**更少**而非更多的記憶：
> 一行**人類可讀、情感性的痕跡（emotional residue）**，被下一段對話當成**壓力**讀回去
> （影響注意什麼、避開什麼、語氣是否變短），而**不是逐字引用**，也**不是數值情感儀表板**。

這是一個 **design / systems pattern 論文**，不是 empirical HCI 論文（這個定位本身就是防守 §7 的關鍵）。

## 1. 貢獻（claims）

1. **Emotional residue pattern**：每段合格對話寫**一行**有界、人類可讀的痕跡（`殘留：…`），
   存在 `memories.description` 裡（無 schema 遷移）；read path 不對稱——下一段同一對的對話讀回
   ≤2 行 residue，明令「不可逐字複述」，並帶 America/Chicago 時段標籤（今天/剛才/昨天/之前）
   控制能不能講、能講多細。可用兩個 env flag（`UNDERWORLD_RESIDUE_WRITE/READ`）做**乾淨 ablation**。
2. **五層靈魂模型**（Public / Private / Relational / Residue / Drift）+ 差異化規則
   （「同情感方向、不同情感語言」），讓 residue 在多角色下仍可辨識、不塌成同一個聲音。
3. **可複現的規則式評測**：soul-uniqueness markers + rolling 兩小時連續性，全部**規則式、確定性、離線可跑**
   （見 §6 誠實聲明），並用小型人工標註做 convergent validity 交叉檢驗。
4. **誠實的負面證據**：slogan-leak 失敗案例 + fallback 污染稽核 = 0。

## 2. 現有證據盤點（誠實版）

| 項目 | 現況 | 缺口 |
|---|---|---|
| 系統可運行 | ✅ v0.1 candidate，跑在 Convex + Ollama/cloud Qwen | — |
| Residue 機制 | ✅ 已實作（write/read/time-label/motif-guard/rollback） | — |
| Rolling 連續性 | ✅ 曾 PASS（2026-06-04：40 residue candidates、6 rolling callbacks） | 需在 ablation 下重跑、配對照組 |
| Soul markers | ✅ 規則式、可離線 | **目前是規則式啟發，非 LLM-judge**（README 講過頭，要改） |
| 玩家證據 | ⚠️ **n=1（Alan）+ 作者觀察** | 無對照、無統計、無 user study |
| Metric validity | ❌ 尚無人工標註對照 | 要補（最容易被打的點） |

## 3. 實驗設計（核心，請 Codex 主攻這段）

### Exp 1 — Soul uniqueness（三角色是否真的不同？）
- **資料**：對 Umi / Mahiru / Tianze 的對話跑 `evaluateConversationCase`，輸出每段的 marker 分數。
- **條件**：無 ablation；描述性 + pairwise echo。
- **指標**：6 個 marker（emotional_expression / comfort_style / burden_response uniqueness、
  rule-based aftertaste proxy、echo penalty、stage_direction_leak penalty），每個 0–1。
- **樣本量目標**：每 pair ≥ 30 段（共 3 pairs）。
- **分析**：每 marker 的 mean ± 95% bootstrap CI，overall 與 per-pair；echo penalty 跨講者比較。

### Exp 2 — Residue ablation（**最重要、給因果性的那個**）
- **設計**：同一世界、within-world，`residue_on` vs `residue_off`（主對照翻 `UNDERWORLD_RESIDUE_READ`），
  但主實驗採 **arm-pure 長時間 window/day**，不要在同一個 rolling continuity window 裡交錯 ON/OFF。
- **已決定的主對照**：`UNDERWORLD_RESIDUE_READ=false` only。這隔離的是 read-path 機制：
  residue 可以存在於 memory，但不注入下一段 prompt。`WRITE+READ=false` 可以作為 sensitivity
  check，但不要當主結果，因為它同時改變 candidate residue 的可觀測性與 write-path 副作用。
- **必要流程**：必須先在 `residue_on` / `residue_off` 各自條件下收集 fresh conversations，
  再跑 `eval:soul-triad -- --since-created-at=<arm_start_ms>`。只對既有 transcripts 重跑 eval
  不是 ablation，因為 env flag 不會 retroactively 改變已生成的對話。
- **主要結果**：rolling-callback 率（後窗有多少比例真的把前窗 residue 變成行為/語氣變化，而非引用）。
- **次要結果**：`human_aftertaste_score` 只作 rule-based aftertaste proxy，不作 human outcome 或 primary。
- **樣本量目標**：先按 MDE 預註冊；`n=10/arm` 是 pipeline pilot，`n=40/arm` 只支撐 large-effect workshop-scale evidence，
  若要檢 small 10–15 percentage-point callback-rate effect，`n>=150/arm` 只在低 baseline rate 時較合理；
  baseline 較高或 dyad/window clustering 明顯時可能要接近 `n≈250/arm` 或採 cluster-aware analysis。
- **分析**：因 n 小 → 兩側 **permutation test**（10k，seeded）+ 差異的 **bootstrap 95% CI** +
  效果量（連續用 **Cliff's delta**、比例用 risk difference）。**不假裝顯著**。
- **混淆控制**：預先寫好 ON/OFF 長時間 schedule，固定 prompt/model/角色定義；rolling source/callback windows
  必須落在同一 arm。motif-guard 在兩臂一致，但 read-off 仍有 prompt-length mismatch 與 partial motif leak，
  需在 paper 裡揭露。

### Exp 3 — Metric validity（規則式 marker 站不站得住？）
- **設計**：抽 ~20–30 段對話，**2 位以上人工 rater** 各打 4 維 Likert（naturalness /
  emotional_binding / character_consistency / repetition，1–5，沿用程式裡 `ConversationJudgeResult` 的維度）。
- **分析**：
  - rater 間一致性：**quadratic-weighted Cohen's κ**（2 人）或 **Krippendorff's ordinal α**（>2 人）。
  - convergent validity：機器 aftertaste proxy 對人工 emotional_binding 的 **Spearman ρ**。
- **目的**：把「LLM/規則 judge 沒驗證過」這個最可預測的 reviewer 反對直接擋掉。

### Exp 4 —（可選，升級到 full paper 才做）玩家研究
- within-subjects residue_on/off，n≈5–10，問卷 +「昨天有沒有活在今天」的質性編碼。
- 這是唯一能把論文從「design artifact」推到「empirical evidence」的東西；workshop/arXiv 不需要。

## 4. 資料分析計畫（統計）
- 全部小樣本友善、非參數：bootstrap CI、permutation test、Cliff's delta、weighted κ /
  ordinal α、Spearman。seed 固定（複現）。
- 由 `scripts/paper/analyze.py` 一次產出：markdown + CSV 表 + matplotlib 圖 + `summary.md`
  純英文 readout。內建 `--selftest`（合成資料植入已知效果，驗證 pipeline 能還原方向）。
- 資料契約見 `scripts/paper/README.md`（`dataset.json` + `annotations.csv`）。

## 5. 投稿計畫（tiered）
1. **arXiv preprint**（cs.HC / cs.AI）先掛——零守門、可引用、卡住「emotional residue」這個 framing。
2. **Workshop**：AIIDE **EXAG** / **INT**、**FDG** short/workshop（believable agents 社群，收 prototype + 質性）。
3. **Full long（高門檻）**：CHI PLAY / DIS / FDG full——**只有做了 Exp 4 玩家研究才追**。
- 細節（截稿/頁數/格式/反對預案）見 `SUBMISSION_STRATEGY.md`。

## 6. 一個必須對外更正的事（誠實）
README 把 markers 寫成 "LLM-as-judge"，但**程式裡 `conversation_judge` 是 rule-based placeholder
（judge_stub），現行 markers 是確定性啟發式**。論文要寫成「規則式語言差異度量（可複現），LLM-judge 列為 future work」。
這其實**更好辯護**（確定性、可複現），但 README / 任何宣稱都要跟著改。

## 7. 對外宣稱強度（請 Codex 校準）
- ✅ 可宣稱：一個可運行的 pattern + 機制描述 + 可複現規則式度量 + ablation 設計 + 誠實限制。
- ❌ 不可宣稱：residue「讓玩家更覺得連續」具統計顯著的 empirical 結論（n=1，沒做 Exp 4 前）。
- 定位句：**design/systems contribution**，非 empirical HCI study。

## 8. 分工（雲端 Claude vs Alan 本機）
| 工作 | 誰 |
|---|---|
| Paper prose、實驗協議、分析腳本（含 selftest）、投稿策略 | 雲端 Claude（進行中） |
| 跑 live 取樣產生 `dataset.json`（Ollama/cloud Qwen + 跑世界） | **Alan 本機**（雲端無 LLM/世界） |
| 2 人以上人工標註 `annotations.csv` | Alan + 1 位（Exp 3） |
| 最後填數字、看圖、定稿 | 一起 |

## 9. 我最想要 Codex 第二意見的地方（請優先回答）
1. **Exp 2 的因果宣稱夠不夠**？主對照採 `READ=false` only，因果宣稱應限縮為
   "reading residue into the next prompt changes callback/aftertaste signals"；
   `WRITE+READ=false` 只作 sensitivity check。within-world 交錯 ablation 還有沒有被忽略的混淆
   （世界狀態漂移、同一 memory corpus 跨臂污染、Qwen/Ollama provider variability）？
2. **樣本量**：每臂 40 段只適合 large effect 嗎？main phase 應按 pilot baseline rate 和 power sensitivity
   預註冊 final N，而不是固定寫 n>=150/arm？
3. **定位**：第一篇就衝 workshop full，還是 arXiv + 短文先卡 framing 再養 Exp 4？
4. **Metric validity**：規則式 marker 的 convergent validity 只用 Spearman 夠嗎，要不要加 per-marker 對人工維度的對應表？
5. **Novelty 防守**：跟 Generative Agents 的 memory stream / reflection 的區隔（aftertaste vs retrieval、
   讀為 pressure 而非 content、anti-numeric、ablatable）夠不夠硬？還缺哪些 related work？
6. 有沒有**更強的單一 framing**（residue / soul-uniqueness eval / 體驗報告 三選一）我們沒選對？

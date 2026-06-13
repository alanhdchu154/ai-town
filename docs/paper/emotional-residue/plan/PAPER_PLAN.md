# 論文計畫（高層種子 + 導覽）

> 這份是 **GIIS Underworld** 第一篇論文最早的總計畫種子。
> 計畫成形後，細節已被拆進各專門文件（見下方「細節去哪了」）。
> 這裡**只保留不會重複的高層內容**：一句話論點、貢獻 claims、分工。
> 要看實驗設計 / 統計 / 投稿 / claim 邊界的最新版，請走專門檔，別在這裡找。
> 整包主題地圖見 [../../README.md](../../README.md)。

---

## 0. 一句話論點（thesis）

> 要讓 LLM 角色讓玩家「感覺昨天有意義」，需要的是**更少**而非更多的記憶：
> 一行**人類可讀、情感性的痕跡（emotional residue）**，被下一段對話當成**壓力**讀回去
> （影響注意什麼、避開什麼、語氣是否變短），而**不是逐字引用**，也**不是數值情感儀表板**。

這是一個 **design / systems pattern 論文**，不是 empirical HCI 論文（這個定位本身就是防守的關鍵）。

## 1. 貢獻（claims）

1. **Emotional residue pattern**：每段合格對話寫**一行**有界、人類可讀的痕跡（`殘留：…`），
   存在 `memories.description` 裡（無 schema 遷移）；read path 不對稱——下一段同一對的對話讀回
   ≤2 行 residue，明令「不可逐字複述」，並帶 America/Chicago 時段標籤（今天/剛才/昨天/之前）
   控制能不能講、能講多細。可用兩個 env flag（`UNDERWORLD_RESIDUE_WRITE/READ`）做**乾淨 ablation**。
2. **五層靈魂模型**（Public / Private / Relational / Residue / Drift）+ 差異化規則
   （「同情感方向、不同情感語言」），讓 residue 在多角色下仍可辨識、不塌成同一個聲音。
3. **可複現的規則式評測**：soul-uniqueness markers + rolling 兩小時連續性，全部**規則式、確定性、離線可跑**，
   並用小型人工標註做 convergent validity 交叉檢驗。
4. **誠實的負面證據**：slogan-leak 失敗案例 + fallback 污染稽核 = 0。

> claim → 證據 → 必須守住的邊界的**可稽核版**：[../claims/CLAIM_EVIDENCE_MATRIX.md](../claims/CLAIM_EVIDENCE_MATRIX.md)。

## 2. 分工（雲端 Claude vs Alan 本機）

| 工作 | 誰 |
|---|---|
| Paper prose、實驗協議、分析腳本（含 selftest）、投稿策略 | 雲端 Claude |
| 跑 live 取樣產生 `dataset.json`（Ollama/cloud Qwen + 跑世界） | **Alan 本機**（雲端無 LLM/世界） |
| 2 人以上人工標註 `annotations.csv` | Alan + 1 位（見人工標註協議） |
| 最後填數字、看圖、定稿 | 一起 |

---

## 細節去哪了（原 §2–§7、§9 已被這些檔案取代）

這份種子文件原本還有「證據盤點 / 實驗設計 / 統計 / 投稿 / claim 強度 / 給 Codex 的問題」等段落。
那些內容後來都被拆進更新、且多半被機器稽核的專門文件，這裡不再重複，避免出現過時的第二版本：

| 原本的段落 | 現在的權威來源 |
|---|---|
| §2 現有證據盤點（誠實版） | [../release/ALAN_HANDOFF.md](../release/ALAN_HANDOFF.md)（一頁 boundary）＋ [../claims/CLAIM_EVIDENCE_MATRIX.md](../claims/CLAIM_EVIDENCE_MATRIX.md)（claim→證據帳本） |
| §3 實驗設計（Exp 1–4） | [../experiments/EXPERIMENTS.md](../experiments/EXPERIMENTS.md)（可執行協議）；長期 ablation 的決定與暫停見 [../experiments/LONGITUDINAL_EXPERIMENT_PLAN.md](../experiments/LONGITUDINAL_EXPERIMENT_PLAN.md) + [../experiments/SCHEDULE_DECISION.md](../experiments/SCHEDULE_DECISION.md) + [../experiments/PREREGISTRATION_PROTOCOL.md](../experiments/PREREGISTRATION_PROTOCOL.md) |
| §4 資料分析計畫（bootstrap / permutation / Cliff's δ / κ / Spearman） | [../experiments/EXPERIMENTS.md](../experiments/EXPERIMENTS.md) 各 Exp 的 analyze 步驟 ＋ [scripts/paper/README.md](../../../../scripts/paper/README.md)（資料契約 + selftest） |
| §5 投稿計畫（tiered：OSF → arXiv → workshop → full） | [SUBMISSION_STRATEGY.md](SUBMISSION_STRATEGY.md)（venue 表 + 解鎖條件 + title 候選） |
| §6 必須對外更正（markers 是規則式、非 LLM-judge） | 已處理：manuscript 現以「deterministic rule-based markers」陳述，LLM-judge 列 future work。邊界見 [../claims/REVIEWER_PREMORTEM.md](../claims/REVIEWER_PREMORTEM.md) §2 |
| §7 對外宣稱強度（能說 / 不能說） | [../release/ALAN_HANDOFF.md](../release/ALAN_HANDOFF.md) + [../claims/CLAIM_EVIDENCE_MATRIX.md](../claims/CLAIM_EVIDENCE_MATRIX.md) 結尾的 reviewer-safe 一句話邊界 |
| §9 給 Codex 的第二意見問題 | 已在 review 中處理：因果宣稱限縮、樣本量改 MDE-driven、定位採 OSF/A-path、novelty 防守等，落在 [../experiments/SCHEDULE_DECISION.md](../experiments/SCHEDULE_DECISION.md) 與 [../claims/REVIEWER_PREMORTEM.md](../claims/REVIEWER_PREMORTEM.md) |

> 進度總帳（做到哪、剩哪些 blocker）：[../release/PUBLISH_READY_CHECKLIST.md](../release/PUBLISH_READY_CHECKLIST.md)。
</content>

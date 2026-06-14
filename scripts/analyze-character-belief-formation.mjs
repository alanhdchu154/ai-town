#!/usr/bin/env node
// Placeholder for the Underworld 100-200 day character belief-formation
// analysis. The Experience Log MVP that landed on 2026-06-12 only writes
// the substrate (compact lived-history rows for the current live evidence
// pilot — Umi, Mahiru, Maomao, Tianze, Ichinose — gated behind every existing memory archival quality
// check). It deliberately does NOT yet read those rows back into
// personality, prompts, beliefs, long-term memory, or behavior.
//
// This script is a stub. Running it prints the planned shape of the
// future analysis so the project handoff stays explicit, then exits
// cleanly. Do not implement the real analysis here without an explicit
// Alan-approved handoff — the task is large and must coordinate with
// memory.ts, modelPolicy.ts, soul docs, and the eval harness.

const PLAN = [
  '讀取最近 100–200 天 (worldClock day) 的 experienceLogs，依角色分組 (海 / 真晝 / 貓貓 / 天澤 / 一之瀨 / 祥子)。',
  '只納入主觀 experienceLogs：eventSummary 必須是「對某某來說...」；舊的「A與B：...」objective shape 只能作為 legacy/background，不能形成 belief。',
  '對每個角色，把同一天 + 同一對話夥伴的條目聚成 episode，避免日內噪音被當成趨勢。',
  '依 importance + beliefSeed + behaviorHint 算 episode 信號權重；丟掉只剩 eventSummary 的低訊號條目。',
  '抽取重複出現的 beliefSeed (例如「不是所有事都該自己一個人扛」) 並計算首次出現、近 14 天頻率、近 30 天頻率。',
  '對每個 belief 候選，找出最早 3 條對應的 experienceLog 作為證據連結，存到 reports/.',
  '輸出建議：哪些 belief 已穩定成形、哪些只是短期殘留，並標註是否值得讓 soul docs 升級。',
  '永遠不要在本腳本裡直接覆寫角色的 initialBeliefs / soul docs / prompts；必須由 Alan 手動審。',
];

const SAFETY_NOTES = [
  '本腳本不會修改 Convex 資料；只可讀。',
  '不要呼叫付費 API，不要連雲端 LLM，不要寫入 docs/soul/* 或 data/giisProfiles.ts。',
  'experienceLogs 表為了 v0.1 安全鎖在 30 天 expiresAfterDays；分析腳本要假設舊資料可能消失。',
  '若條目 < 30 日量或 < 3 條同主題，要回報 PENDING 而不是強制給結論。',
];

const args = new Set(process.argv.slice(2));
if (args.has('--self-test')) {
  // Keep the smoke test minimal — just enough that
  // underworld:harness:self-test could one day chain it without
  // surprising side effects.
  console.log(JSON.stringify({ status: 'PASS', plan: PLAN.length, notes: SAFETY_NOTES.length }));
  process.exit(0);
}

console.log('# Underworld belief-formation analysis (placeholder)');
console.log('');
console.log('## 計畫');
for (const step of PLAN) console.log(`- ${step}`);
console.log('');
console.log('## 安全約束');
for (const note of SAFETY_NOTES) console.log(`- ${note}`);
console.log('');
console.log('Status: NOT_IMPLEMENTED — Experience Log MVP 寫入路徑已就緒，等待 Alan 開新 handoff 才執行 100–200 天分析。');
process.exit(0);

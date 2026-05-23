#!/usr/bin/env node
// Quick connectivity + auth test for the Qwen API key in key.md.
//
//   node scripts/test-qwen-key.mjs [model] [baseUrl]
//
// Defaults: model=qwen3-max, base=https://api.newcoin.top (OpenAI-compatible proxy).
// - Never prints the key (only prefix + length).
// - Tries "{base}/v1/chat/completions" then "{base}/chat/completions".
// - Reports HTTP status, latency, token usage, and a sample Umi-voice reply.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const keyPath = join(here, '..', 'key.md');

let key;
try {
  key = readFileSync(keyPath, 'utf8').trim();
} catch (e) {
  console.error(`✗ 讀不到 ${keyPath}: ${e.message}`);
  process.exit(1);
}
if (!key) {
  console.error('✗ key.md 是空的');
  process.exit(1);
}

const model = process.argv[2] || 'qwen3-max';
const base = (process.argv[3] || 'https://api.newcoin.top').replace(/\/$/, '');
console.log(`key prefix: ${key.slice(0, 3)}…  length: ${key.length}`);
console.log(`base: ${base}`);
console.log(`model: ${model}\n`);

const urls = [base + '/v1/chat/completions', base + '/chat/completions'];

const body = {
  model,
  messages: [
    {
      role: 'system',
      content: '你是海(Umi)，溫柔、冷靜、技術可靠的桌邊AI夥伴。只用繁體中文，禁止簡體字。',
    },
    {
      role: 'user',
      content: '真晝看起來很累卻不說。你會先對她說的一句話是什麼？只回一句。',
    },
  ],
  max_tokens: 80,
  temperature: 0.7,
};

let ok = false;
for (const url of urls) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40000),
    });
    const ms = Date.now() - t0;
    const text = await res.text();
    if (!res.ok) {
      console.log(`[${url}] HTTP ${res.status} (${ms}ms)`);
      console.log('  ' + text.slice(0, 300).replace(/\s+/g, ' '));
      continue;
    }
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* leave json null */
    }
    const content = json?.choices?.[0]?.message?.content?.trim();
    console.log(`✓ [${url}] HTTP 200 (${ms}ms)  model=${json?.model ?? model}`);
    console.log(`  Umi: ${content ?? '(no content) ' + text.slice(0, 200)}`);
    if (json?.usage) {
      console.log(
        `  tokens: prompt=${json.usage.prompt_tokens} completion=${json.usage.completion_tokens}`,
      );
    }
    console.log(`\n>>> 可用的 endpoint：${url}`);
    ok = true;
    break;
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`[${url}] 連線失敗 (${ms}ms): ${e.message}`);
  }
}

if (!ok) {
  console.log(
    '\n✗ 未通過。401 → key 無效或餘額/權限問題（查 https://cha.newcoin.tech）；連線失敗 → 檢查主機 URL/網路。',
  );
  process.exit(2);
}
console.log('\n✓ key 可用，可以接下一步接進 Mahiru × Umi pilot。');

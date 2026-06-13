#!/usr/bin/env node
// Quick connectivity + auth test for the Qwen API key.
//
//   node scripts/test-qwen-key.mjs [model] [baseUrl]
//
// Defaults: model=qwen-plus, base=https://dashscope-intl.aliyuncs.com/compatible-mode/v1.
// - Never prints the key.
// - Accepts either an OpenAI-compatible base URL or a full chat/completions URL.
// - Reports HTTP status, latency, token usage, and a sample Umi-voice reply.

import { execFileSync } from 'node:child_process';

const useBackup = process.argv.includes('--backup');
const key = useBackup
  ? process.env.UMI_MAHIRU_PILOT_API_KEY_BACKUP?.trim() ||
    process.env.QWEN_API_KEY_BACKUP?.trim() ||
    convexEnvGet('UMI_MAHIRU_PILOT_API_KEY_BACKUP')
  : process.env.UMI_MAHIRU_PILOT_API_KEY?.trim() ||
    process.env.QWEN_API_KEY?.trim() ||
    convexEnvGet('UMI_MAHIRU_PILOT_API_KEY');
if (!key) {
  console.error(
    useBackup
      ? '✗ 找不到 Qwen backup key。請設定 UMI_MAHIRU_PILOT_API_KEY_BACKUP / QWEN_API_KEY_BACKUP，或 Convex env UMI_MAHIRU_PILOT_API_KEY_BACKUP。'
      : '✗ 找不到 Qwen key。請設定 UMI_MAHIRU_PILOT_API_KEY / QWEN_API_KEY，或 Convex env UMI_MAHIRU_PILOT_API_KEY。',
  );
  process.exit(1);
}

const positionalArgs = process.argv.slice(2).filter((arg) => arg !== '--backup');
const model = positionalArgs[0] || 'qwen-plus';
const base = (
  positionalArgs[1] || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
).replace(/\/+$/, '');
console.log(`key: ${useBackup ? 'backup ' : ''}set (${key.length} chars)`);
console.log(`base: ${base}`);
console.log(`model: ${model}\n`);

const urls = [chatCompletionsUrl(base)];

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
    if (!json || !Array.isArray(json.choices) || !content) {
      console.log(`[${url}] HTTP 200 but response was not a valid chat completion (${ms}ms)`);
      console.log('  ' + text.slice(0, 200).replace(/\s+/g, ' '));
      continue;
    }
    console.log(`✓ [${url}] HTTP 200 (${ms}ms)  model=${json?.model ?? model}`);
    console.log(`  Umi: ${content}`);
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
    '\n✗ 未通過。401 → key 無效或 region/base URL 不匹配；402/403 → 餘額、權限或服務未開通；連線失敗 → 檢查主機 URL/網路。',
  );
  process.exit(2);
}
console.log('\n✓ key 可用，可以接下一步接進 Mahiru × Umi pilot。');

function chatCompletionsUrl(baseUrl) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function convexEnvGet(name) {
  try {
    return execFileSync('npx', ['convex', 'env', 'get', name], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 45_000,
    }).trim();
  } catch {
    return '';
  }
}

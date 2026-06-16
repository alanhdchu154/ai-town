#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'umi', 'reports');
const TARGET_URL = process.env.UNDERWORLD_FRONTEND_SMOKE_URL ?? 'http://localhost:5173/ai-town';
const CHROME_PATH =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WAIT_MS = Number(process.env.UNDERWORLD_FRONTEND_SMOKE_WAIT_MS ?? 25_000);
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, mobile: true },
  { name: 'desktop', width: 1440, height: 960, mobile: false },
];

fs.mkdirSync(REPORT_DIR, { recursive: true });

const WebSocketCtor = globalThis.WebSocket ?? (await import('ws')).default;
if (!fs.existsSync(CHROME_PATH)) {
  console.error(`[underworld-frontend-smoke] Chrome not found: ${CHROME_PATH}`);
  process.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(port, route) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${route}`);
      if (response.ok) return await response.json();
    } catch {
      // Chrome may need a moment to expose the debugging endpoint.
    }
    await sleep(100);
  }
  throw new Error(`CDP endpoint did not become ready on port ${port}`);
}

function connect(wsUrl) {
  const ws = new WebSocketCtor(wsUrl);
  return new Promise((resolve, reject) => {
    ws.once ? ws.once('open', () => resolve(ws)) : ws.addEventListener('open', () => resolve(ws), { once: true });
    ws.once ? ws.once('error', reject) : ws.addEventListener('error', reject, { once: true });
  });
}

function onMessage(ws, listener) {
  if (ws.on) {
    ws.on('message', (raw) => listener(raw.toString()));
  } else {
    ws.addEventListener('message', (event) => listener(event.data));
  }
}

function sendFactory(ws) {
  let id = 0;
  const pending = new Map();
  onMessage(ws, (raw) => {
    const message = JSON.parse(raw);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  return (method, params = {}) => {
    const requestId = ++id;
    ws.send(JSON.stringify({ id: requestId, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      setTimeout(() => {
        if (!pending.has(requestId)) return;
        pending.delete(requestId);
        reject(new Error(`CDP timeout: ${method}`));
      }, 10_000);
    });
  };
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  return result.result.value;
}

async function smokeViewport(viewport, index) {
  const port = 9400 + index;
  const profileDir = path.join(os.tmpdir(), `underworld-frontend-smoke-${Date.now()}-${index}`);
  const chrome = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      `--window-size=${viewport.width},${viewport.height}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let stderr = '';
  chrome.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const pages = await getJson(port, '/json/list');
    const page = pages.find((item) => item.type === 'page') ?? pages[0];
    const ws = await connect(page.webSocketDebuggerUrl);
    const send = sendFactory(ws);

    const requestUrls = new Map();
    const badNetwork = [];
    const consoleIssues = [];
    onMessage(ws, (raw) => {
      const message = JSON.parse(raw);
      if (message.method === 'Network.requestWillBeSent') {
        requestUrls.set(message.params.requestId, message.params.request.url);
      }
      if (message.method === 'Network.responseReceived') {
        const url = requestUrls.get(message.params.requestId) ?? message.params.response.url;
        if (message.params.response.status >= 400) {
          badNetwork.push({ type: 'http', status: message.params.response.status, url });
        }
      }
      if (message.method === 'Network.loadingFailed') {
        const url = requestUrls.get(message.params.requestId);
        if (!message.params.canceled && message.params.errorText !== 'net::ERR_ABORTED') {
          badNetwork.push({ type: 'failed', error: message.params.errorText, url });
        }
      }
      if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
        const args = message.params.args.map((arg) => arg.value ?? arg.description);
        const text = args.join(' ');
        const knownConvexBrowserWarning = text.includes('Convex functions should not be imported in the browser');
        const knownLocalhostWarning = text.includes('Ignoring Event: localhost');
        consoleIssues.push({
          level: message.params.type,
          known: knownConvexBrowserWarning || knownLocalhostWarning,
          text,
        });
      }
    });

    await send('Runtime.enable');
    await send('Network.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
    });
    await send('Page.navigate', { url: TARGET_URL });

    const deadline = Date.now() + WAIT_MS;
    let state;
    do {
      await sleep(500);
      state = await evaluate(
        send,
        `(() => ({
          text: document.body.innerText.slice(0, 800),
          loading: !!document.querySelector('.giis-loading-shell'),
          live: !!document.querySelector('.giis-live-room-shell'),
          error: !!document.querySelector('.giis-action-pill-primary'),
          viewport: {
            innerWidth,
            innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            scrollHeight: document.documentElement.scrollHeight
          }
        }))()`,
      );
      if (state.live) break;
    } while (Date.now() < deadline);

    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(REPORT_DIR, `frontend-smoke-${viewport.name}-latest.png`);
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

    const hardConsoleIssues = consoleIssues.filter((issue) => !issue.known);
    const horizontalOverflow =
      state?.viewport?.scrollWidth > state?.viewport?.innerWidth + 2;
    return {
      viewport,
      ok: Boolean(state?.live) && !state?.loading && !horizontalOverflow && badNetwork.length === 0,
      state,
      screenshotPath,
      badNetwork,
      consoleIssues: hardConsoleIssues,
      knownConsoleIssues: consoleIssues.filter((issue) => issue.known),
      stderrTail: stderr.slice(-1000),
    };
  } finally {
    chrome.kill('SIGTERM');
    await sleep(300);
  }
}

const results = [];
for (const [index, viewport] of VIEWPORTS.entries()) {
  results.push(await smokeViewport(viewport, index));
}

const report = {
  generatedAt: new Date().toISOString(),
  targetUrl: TARGET_URL,
  waitMs: WAIT_MS,
  results,
};
const reportPath = path.join(REPORT_DIR, 'frontend-smoke-latest.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`[underworld-frontend-smoke] FAIL (${failed.length}/${results.length})`);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(`[underworld-frontend-smoke] PASS (${results.length}/${results.length})`);
console.log(`report written: ${reportPath}`);

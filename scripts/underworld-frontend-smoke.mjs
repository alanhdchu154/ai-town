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
const POST_SELECTION_IDLE_MS = Number(process.env.UNDERWORLD_FRONTEND_SMOKE_IDLE_MS ?? 7_000);
const POST_SELECTION_SAMPLE_MS = Number(process.env.UNDERWORLD_FRONTEND_SMOKE_SAMPLE_MS ?? 1_000);
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, mobile: true },
  { name: 'small-mobile', width: 360, height: 640, mobile: true },
  { name: 'landscape-mobile', width: 844, height: 390, mobile: true },
  { name: 'tablet', width: 820, height: 1180, mobile: true },
  { name: 'desktop', width: 1440, height: 960, mobile: false },
];
const CONVERSATION_WALL_VIEWPORTS = new Set(VIEWPORTS.map((viewport) => viewport.name));

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

async function readSelectionStabilitySnapshot(send, viewport) {
  return evaluate(
    send,
    `(() => {
      const selected = document.querySelector('.giis-scene-standee.is-selected');
      const bottomStatus = document.querySelector('.giis-bottom-status');
      const helper = document.querySelector('.giis-bottom-helper');
      const focusCard = document.querySelector('.giis-focus-card');
      const primaryButtons = [...document.querySelectorAll('.giis-action-pill-primary')]
        .map((button) => ({
          text: button.textContent.trim(),
          disabled: button.disabled,
          visible: !!(button.offsetWidth || button.offsetHeight || button.getClientRects().length),
        }))
        .filter((button) => button.visible);
      const helperVisible = helper
        ? !!(helper.offsetWidth || helper.offsetHeight || helper.getClientRects().length)
        : false;
      const focusCardVisible = focusCard
        ? !!(focusCard.offsetWidth || focusCard.offsetHeight || focusCard.getClientRects().length)
        : false;
      const helperText = helper?.textContent.trim() ?? '';
      const bottomStatusText = bottomStatus?.textContent.trim() ?? '';
      const horizontalOverflow = document.documentElement.scrollWidth > window.innerWidth + 2;
      return {
        live: !!document.querySelector('.giis-live-room-shell'),
        loading: !!document.querySelector('.giis-loading-shell'),
        reconnectFallback: document.body.innerText.includes('校園正在重新連線'),
        sceneLabel: document.querySelector('.giis-scene-stage')?.getAttribute('aria-label') ?? '',
        selectedName: selected?.querySelector('.giis-scene-standee-name-row b')?.textContent.trim() ?? '',
        selected: !!selected,
        bottomStatusText,
        helperText,
        helperVisible,
        focusCardVisible,
        primaryButtons,
        horizontalOverflow,
        ok:
          !!selected &&
          !!document.querySelector('.giis-live-room-shell') &&
          !document.querySelector('.giis-loading-shell') &&
          !document.body.innerText.includes('校園正在重新連線') &&
          bottomStatusText.includes('目標') &&
          primaryButtons.some((button) => button.text.length > 0) &&
          !horizontalOverflow &&
          (${viewport.mobile ? 'helperVisible && helperText.length > 0' : 'focusCardVisible'})
      };
    })()`,
  );
}

async function runReadOnlySelectionCheck(send, viewport) {
  const clicked = await evaluate(
    send,
    `(() => {
      const standees = [...document.querySelectorAll('.giis-scene-standee')];
      const target = standees.find((button) =>
        !button.classList.contains('is-alan') &&
        !button.classList.contains('is-offscene') &&
        button.textContent.trim().length > 0
      );
      if (!target) return false;
      target.click();
      return true;
    })()`,
  );
  if (!clicked) {
    return { clicked: false, ok: false, reason: 'no selectable non-Alan standee' };
  }
  await sleep(300);
  return { clicked: true, ...(await readSelectionStabilitySnapshot(send, viewport)) };
}

async function runPostSelectionIdleCheck(send, viewport, initialSnapshot) {
  if (!initialSnapshot?.ok) {
    return { ok: false, reason: 'initial selection failed', samples: [] };
  }
  const expected = {
    selectedName: initialSnapshot.selectedName,
    sceneLabel: initialSnapshot.sceneLabel,
  };
  const samples = [];
  const deadline = Date.now() + POST_SELECTION_IDLE_MS;
  do {
    await sleep(Math.min(POST_SELECTION_SAMPLE_MS, Math.max(0, deadline - Date.now())));
    const sample = await readSelectionStabilitySnapshot(send, viewport);
    samples.push(sample);
  } while (Date.now() < deadline);

  const drift = samples.filter((sample) => {
    const stableSelected = sample.selectedName === expected.selectedName;
    const stableScene = sample.sceneLabel === expected.sceneLabel;
    const statusAnchored =
      sample.bottomStatusText.includes('目標') || sample.bottomStatusText.includes('對話中');
    return (
      !sample.live ||
      sample.loading ||
      sample.reconnectFallback ||
      !sample.selected ||
      !stableSelected ||
      !stableScene ||
      !statusAnchored ||
      !sample.primaryButtons.some((button) => button.text.length > 0) ||
      sample.horizontalOverflow ||
      (viewport.mobile
        ? !(sample.helperVisible && sample.helperText.length > 0)
        : !sample.focusCardVisible)
    );
  });
  return {
    ok: drift.length === 0,
    durationMs: POST_SELECTION_IDLE_MS,
    expected,
    samples,
    drift,
  };
}

async function readConversationWallSnapshot(send) {
  return evaluate(
    send,
    `(() => {
      const wall = document.querySelector('.giis-conversation-wall');
      const grid = document.querySelector('.giis-wall-grid');
      const empty = document.querySelector('.giis-wall-empty');
      const returnButton = document.querySelector('.giis-wall-world-button');
      const characterSelect = document.querySelector('.giis-wall-controls select[aria-label="character"]');
      const segmentButtons = [...document.querySelectorAll('.giis-wall-controls .giis-wall-segments button')];
      const cards = [...document.querySelectorAll('.giis-conversation-card')];
      const emptyText = empty?.textContent.trim() ?? '';
      const horizontalOverflow = document.documentElement.scrollWidth > window.innerWidth + 2;
      const settled = !!grid && (cards.length > 0 || (emptyText.length > 0 && emptyText !== '載入中'));
      return {
        wall: !!wall,
        headerText: document.querySelector('.giis-conversation-wall-header h2')?.textContent.trim() ?? '',
        metricCount: document.querySelectorAll('.giis-wall-metrics .giis-wall-metric').length,
        segmentCount: segmentButtons.length,
        segmentLabels: segmentButtons.map((button) => button.textContent.trim()),
        hasCharacterSelect: !!characterSelect,
        characterSelectDisabled: characterSelect ? characterSelect.disabled : true,
        hasReturnButton: !!returnButton,
        returnButtonDisabled: returnButton ? returnButton.disabled : true,
        returnButtonText: returnButton?.textContent.trim() ?? '',
        hasGrid: !!grid,
        cardCount: cards.length,
        emptyText,
        settled,
        loading: !!document.querySelector('.giis-loading-shell'),
        reconnectFallback: document.body.innerText.includes('校園正在重新連線'),
        horizontalOverflow,
        ok:
          !!wall &&
          document.querySelector('.giis-conversation-wall-header h2')?.textContent.trim() === '對話牆' &&
          document.querySelectorAll('.giis-wall-metrics .giis-wall-metric').length === 4 &&
          segmentButtons.length === 6 &&
          !!characterSelect &&
          !characterSelect.disabled &&
          !!returnButton &&
          !returnButton.disabled &&
          returnButton.textContent.trim() === '回到世界' &&
          settled &&
          !document.querySelector('.giis-loading-shell') &&
          !document.body.innerText.includes('校園正在重新連線') &&
          !horizontalOverflow
      };
    })()`,
  );
}

async function waitForConversationWall(send) {
  const deadline = Date.now() + 15_000;
  let snapshot;
  do {
    await sleep(500);
    snapshot = await readConversationWallSnapshot(send);
    if (snapshot.ok) break;
  } while (Date.now() < deadline);
  return snapshot;
}

async function readReturnedWorldSnapshot(send) {
  return evaluate(
    send,
    `(() => {
      const horizontalOverflow = document.documentElement.scrollWidth > window.innerWidth + 2;
      return {
        live: !!document.querySelector('.giis-live-room-shell'),
        loading: !!document.querySelector('.giis-loading-shell'),
        reconnectFallback: document.body.innerText.includes('校園正在重新連線'),
        sceneLabel: document.querySelector('.giis-scene-stage')?.getAttribute('aria-label') ?? '',
        horizontalOverflow,
        ok:
          !!document.querySelector('.giis-live-room-shell') &&
          !document.querySelector('.giis-loading-shell') &&
          !document.body.innerText.includes('校園正在重新連線') &&
          !!document.querySelector('.giis-scene-stage')?.getAttribute('aria-label') &&
          !horizontalOverflow
      };
    })()`,
  );
}

async function waitForReturnedWorld(send) {
  const deadline = Date.now() + 8_000;
  let snapshot;
  do {
    await sleep(300);
    snapshot = await readReturnedWorldSnapshot(send);
    if (snapshot.ok) break;
  } while (Date.now() < deadline);
  return snapshot;
}

async function runConversationWallCheck(send, viewport, badNetwork, consoleIssues) {
  if (!CONVERSATION_WALL_VIEWPORTS.has(viewport.name)) {
    return {
      skipped: 'viewport not in conversation-wall coverage',
      ok: true,
    };
  }

  const startedAt = Date.now();
  const networkStart = badNetwork.length;
  const consoleStart = consoleIssues.length;
  const opened = await evaluate(
    send,
    `(() => {
      const tab = [...document.querySelectorAll('.giis-view-switch button')]
        .find((button) => button.textContent.trim() === '對話');
      if (!tab) return false;
      tab.click();
      return true;
    })()`,
  );
  if (!opened) {
    return {
      opened: false,
      ok: false,
      reason: 'conversation tab not found',
      durationMs: Date.now() - startedAt,
    };
  }

  const wallSnapshot = await waitForConversationWall(send);
  const returnedClick = await evaluate(
    send,
    `(() => {
      const button = document.querySelector('.giis-wall-world-button');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`,
  );
  const returnedWorld = returnedClick ? await waitForReturnedWorld(send) : null;
  const hardConsoleIssues = consoleIssues.slice(consoleStart).filter((issue) => !issue.known);
  const newBadNetwork = badNetwork.slice(networkStart);

  return {
    opened,
    wallSnapshot,
    returnedClick,
    returnedWorld,
    durationMs: Date.now() - startedAt,
    badNetwork: newBadNetwork,
    consoleIssues: hardConsoleIssues,
    ok:
      opened &&
      wallSnapshot?.ok === true &&
      returnedClick &&
      returnedWorld?.ok === true &&
      newBadNetwork.length === 0 &&
      hardConsoleIssues.length === 0,
  };
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
        const knownLocalhostWarning = text.includes('Ignoring Event: localhost');
        consoleIssues.push({
          level: message.params.type,
          known: knownLocalhostWarning,
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

    const selectionCheck = state?.live ? await runReadOnlySelectionCheck(send, viewport) : null;
    const idleCheck = selectionCheck?.ok
      ? await runPostSelectionIdleCheck(send, viewport, selectionCheck)
      : null;
    const conversationWallCheck = idleCheck?.ok
      ? await runConversationWallCheck(send, viewport, badNetwork, consoleIssues)
      : { ok: false, reason: 'selection idle check failed' };
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(REPORT_DIR, `frontend-smoke-${viewport.name}-latest.png`);
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

    const hardConsoleIssues = consoleIssues.filter((issue) => !issue.known);
    const horizontalOverflow =
      state?.viewport?.scrollWidth > state?.viewport?.innerWidth + 2;
    return {
      viewport,
      ok:
        Boolean(state?.live) &&
        !state?.loading &&
        !horizontalOverflow &&
        badNetwork.length === 0 &&
        hardConsoleIssues.length === 0 &&
        selectionCheck?.ok === true &&
        idleCheck?.ok === true &&
        conversationWallCheck?.ok === true,
      state,
      selectionCheck,
      idleCheck,
      conversationWallCheck,
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

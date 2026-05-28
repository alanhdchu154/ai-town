#!/usr/bin/env node
// GIIS Underworld day-start readiness check.
//
// Read-only: checks local server health, world status, active fallback
// pollution, and latest continuity report, then prints the safest next action.

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'day-start-latest.md');
const APPROACH_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'v01-approach-latest.md');
const AM_PM_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'am-pm-continuity-latest.md');
const LIFE_SIGNALS_REPORT_PATH = join(REPO_ROOT, 'umi', 'reports', 'life-signals-latest.md');
const STALE_REPORT_MINUTES = 120;

async function main() {
  const timing = chicagoTiming();
  const [frontend, backend, worldStatus, fallbackAudit, approachReport, amPmReport, lifeSignalsReport] =
    await Promise.all([
      checkHttp('http://localhost:5173/ai-town'),
      checkHttp('http://localhost:3210/version'),
      convexRunSafe('world:defaultWorldStatus'),
      convexRunSafe('school:auditFallbackPollution', { limit: 1000 }),
      readOptional(APPROACH_REPORT_PATH),
      readOptional(AM_PM_REPORT_PATH),
      readOptional(LIFE_SIGNALS_REPORT_PATH),
    ]);

  const activeFallbackBreakdown = activeFallbackCounts(fallbackAudit.data);
  const activeFallbackPollutionCount = activeFallbackBreakdown.total;
  const archivedFallbackHistoryCount = fallbackAudit.data?.fallbackArchivedConversationCount;
  const worldState = summarizeWorld(worldStatus.data);
  const amPm = parseAmPmSummary(amPmReport);
  const lifeSignals = parseLifeSignalsSummary(lifeSignalsReport);
  const approach = parseApproachSummary(approachReport);
  const reportFreshness = {
    approach: reportFreshnessFor(approachReport),
    amPm: reportFreshnessFor(amPmReport),
    lifeSignals: reportFreshnessFor(lifeSignalsReport),
  };
  const next = chooseNextAction({
    timing,
    frontend,
    backend,
    worldStatus,
    worldState,
    activeFallbackPollutionCount,
    activeFallbackBreakdown,
    amPm,
    lifeSignals,
    reportFreshness,
  });

  const report = renderReport({
    timing,
    frontend,
    backend,
    worldStatus,
    worldState,
    activeFallbackPollutionCount,
    activeFallbackBreakdown,
    archivedFallbackHistoryCount,
    amPm,
    lifeSignals,
    approach,
    reportFreshness,
    next,
  });
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, report);

  console.log(report);
  console.log(`[underworld-day-start] report=${relative(REPORT_PATH)}`);
}

function chooseNextAction({
  timing,
  frontend,
  backend,
  worldStatus,
  worldState,
  activeFallbackPollutionCount,
  activeFallbackBreakdown,
  amPm,
  lifeSignals,
  reportFreshness,
}) {
  if (timing.isNight) {
    return {
      status: 'night_quiet',
      title: 'Let the world sleep',
      command: 'npm run underworld:observe -- --dry-run --cc=skip --target-samples=0',
      reason: 'It is night in America/Chicago. Do not generate or force conversations.',
    };
  }
  if (!frontend.ok || !backend.ok) {
    return {
      status: 'server_down',
      title: 'Start the local dev stack',
      command: 'npm run dev',
      reason: 'Vite or the local Convex backend is not reachable.',
    };
  }
  if (!worldStatus.ok) {
    return {
      status: 'world_status_unknown',
      title: 'Repair/check local Convex state before samples',
      command: 'npx convex run school:debugState',
      reason: 'Could not read default world status.',
    };
  }
  if (worldState.status === 'stoppedByDeveloper' || worldState.status === 'inactive') {
    return {
      status: 'resume_world',
      title: 'Resume the world, then observe',
      command: 'npx convex run testing:resume && npm run underworld:observe -- --cc=skip',
      reason: `The default world is ${worldState.status}. Daytime samples need the world running.`,
    };
  }
  if (activeFallbackPollutionCount > 0 && !activeFallbackBreakdown.notificationOnly) {
    return {
      status: 'active_pollution',
      title: 'Inspect active brain pollution before collecting samples',
      command: 'npm run underworld:cleanup-fallback-pollution:dry-run',
      reason: 'Active fallback-like memory/event/notification/profile state can contaminate fresh samples.',
    };
  }
  if (reportFreshness.approach.stale || reportFreshness.amPm.stale || reportFreshness.lifeSignals.stale) {
    return {
      status: 'stale_reports',
      title: 'Refresh observe reports before judging the world',
      command: 'npm run underworld:observe -- --cc=skip',
      reason: 'One or more v0.1 reports are stale or missing; refresh fresh-window evidence first.',
    };
  }
  if (amPm.decision === 'sample_pending') {
    return {
      status: 'natural_observe',
      title: 'Let the world run naturally, then observe',
      command: 'npm run underworld:observe -- --cc=skip',
      reason: 'Continuity evidence still needs enough fresh daytime conversations.',
    };
  }
  if (
    [
      'life_signal_repeated',
      'prop_echo_repeated',
      'life_signal_missing',
      'conversation_shape_collapse',
      'scene_diversity_thin',
      'daily_rhythm_thin',
      'soul_style_flat',
    ].includes(lifeSignals.decision ?? '')
  ) {
    return {
      status: 'life_signal_review',
      title: 'Review life-signal evidence before repair',
      command: 'npm run underworld:repair-gate -- --cc=skip',
      reason: 'Life-signal report detected repeated, missing, or collapsed everyday-life conversation shape.',
    };
  }
  return {
    status: 'review_evidence',
    title: 'Review evidence before repair',
    command: 'npm run underworld:repair-gate -- --cc=skip',
    reason: 'There is enough report structure to classify whether any small repair is justified.',
  };
}

function renderReport({
  timing,
  frontend,
  backend,
  worldStatus,
  worldState,
  activeFallbackPollutionCount,
  activeFallbackBreakdown,
  archivedFallbackHistoryCount,
  amPm,
  lifeSignals,
  approach,
  reportFreshness,
  next,
}) {
  return `# GIIS Underworld Day-Start Readiness

Generated: ${new Date().toISOString()}
Chicago time: ${timing.label}
Night quiet: ${timing.isNight ? 'yes' : 'no'}

## Status

- Frontend /ai-town: ${frontend.ok ? 'ok' : 'down'}${frontend.status ? ` (${frontend.status})` : ''}
- Local Convex backend: ${backend.ok ? 'ok' : 'down'}${backend.status ? ` (${backend.status})` : ''}
- World status: ${worldStatus.ok ? worldState.status : 'unknown'}
- World clock: ${worldState.clockLabel}
- Active fallback pollution: ${activeFallbackPollutionCount}${activeFallbackBreakdown.notificationOnly ? ' (notification-only; UI read path isolated)' : ''}
- Archived fallback history retained: ${archivedFallbackHistoryCount ?? 'unknown'}
- Latest observe top category: ${approach.topFailureCategory ?? 'unknown'}
- Latest observe next action: ${approach.nextSafestAction ?? 'unknown'}
- Latest observe report age: ${formatReportAge(reportFreshness.approach)}
- AM→PM continuity: ${amPm.status ?? 'unknown'} / ${amPm.decision ?? 'unknown'}
- AM→PM samples: morning ${amPm.morningSamples ?? 'unknown'}, afternoon ${amPm.afternoonSamples ?? 'unknown'}
- AM→PM report age: ${formatReportAge(reportFreshness.amPm)}
- Life signals: ${lifeSignals.status ?? 'unknown'} / ${lifeSignals.decision ?? 'unknown'}
- Life samples: conversations ${lifeSignals.conversationCount ?? 'unknown'}, repeated lines ${lifeSignals.repeatedLineFlags ?? 'unknown'}, prop echo ${lifeSignals.propEchoFlags ?? 'unknown'}, shape flags ${lifeSignals.conversationShapeFlags ?? 'unknown'}, one-line ${lifeSignals.singleMessageConversations ?? 'unknown'}, ordinary scenes ${lifeSignals.ordinarySceneDiversity ?? 'unknown'}, daily rhythm ${lifeSignals.dailyRhythmConversations ?? 'unknown'}, soul style ${lifeSignals.soulStyleConversations ?? 'unknown'}, admin drift ${lifeSignals.administrativeDriftFlags ?? 'unknown'}
- Life-signals report age: ${formatReportAge(reportFreshness.lifeSignals)}

## Safest Next Action

${next.title}

\`\`\`bash
${next.command}
\`\`\`

Reason: ${next.reason}

## Daytime Rhythm

- Morning: keep \`npm run dev\` alive and leave \`/ai-town\` open for heartbeat.
- Midday/afternoon: run \`npm run underworld:observe -- --cc=skip\`.
- After 13:00 with enough samples: run \`npm run underworld:am-pm-continuity\`.
- Scan everyday grounding with \`npm run underworld:life-signals\` when dialogue feels too abstract or repetitive.
- Repair only through \`npm run underworld:repair-gate -- --cc=skip\`; continuity gaps are proposal-only.

## Policy

- Read-only readiness check. This script did not resume the world, trigger dialogue, edit code, or write Convex data.
- If current time is night, do not force conversations unless Alan explicitly asks for a forced test.
`;
}

async function checkHttp(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error.message ?? String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function convexRunSafe(fnName, payload) {
  const commandArgs = ['convex', 'run', fnName];
  if (payload !== undefined) commandArgs.push(JSON.stringify(payload));
  try {
    const { stdout, stderr } = await execFileAsync('npx', commandArgs, {
      cwd: REPO_ROOT,
      env: process.env,
      timeout: 20_000,
      maxBuffer: 1024 * 1024 * 8,
    });
    return { ok: true, data: parseJson(stdout), stdout, stderr };
  } catch (error) {
    return {
      ok: false,
      data: undefined,
      stdout: error.stdout?.toString() ?? '',
      stderr: error.stderr?.toString() ?? error.message ?? String(error),
    };
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

function summarizeWorld(data) {
  const clock = data?.worldClock;
  const clockLabel = clock
    ? `day ${clock.day}, ${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`
    : 'unknown';
  return {
    status: data?.status ?? 'unknown',
    clockLabel,
  };
}

function activeFallbackCounts(data) {
  const memories = data?.fallbackMemoryCount ?? 0;
  const events = data?.fallbackEventCount ?? 0;
  const notifications = data?.fallbackNotificationCount ?? 0;
  const profiles = data?.pollutedProfileCount ?? 0;
  const total = memories + events + notifications + profiles;
  return {
    memories,
    events,
    notifications,
    profiles,
    total,
    notificationOnly: total > 0 && notifications === total,
  };
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function parseApproachSummary(report) {
  return {
    topFailureCategory: lineValue(report, 'Top failure category'),
    nextSafestAction: lineValue(report, 'Next safest action'),
  };
}

function parseAmPmSummary(report) {
  return {
    status: lineValue(report, 'Status'),
    decision: lineValue(report, 'Decision'),
    morningSamples: numberLineValue(report, 'Morning sample count'),
    afternoonSamples: numberLineValue(report, 'Afternoon sample count'),
  };
}

function parseLifeSignalsSummary(report) {
  return {
    status: lineValue(report, 'Status'),
    decision: lineValue(report, 'Decision'),
    conversationCount: numberLineValue(report, 'Conversation count'),
    repeatedLineFlags: numberLineValue(report, 'Repeated line flags'),
    propEchoFlags: numberLineValue(report, 'Prop echo flags'),
    conversationShapeFlags: numberLineValue(report, 'Conversation shape flags'),
    singleMessageConversations: numberLineValue(report, 'Single-message conversations'),
    oneSpeakerConversations: numberLineValue(report, 'One-speaker conversations'),
    sceneDiversity: numberLineValue(report, 'Scene diversity'),
    ordinarySceneDiversity: numberLineValue(report, 'Ordinary scene diversity'),
    officeGroundedConversations: numberLineValue(report, 'Office-grounded conversations'),
    ordinarySceneConversations: numberLineValue(report, 'Ordinary-scene conversations'),
    dailyRhythmConversations: numberLineValue(report, 'Daily rhythm conversations'),
    dailyRhythmDiversity: numberLineValue(report, 'Daily rhythm diversity'),
    soulStyleConversations: numberLineValue(report, 'Soul-style conversations'),
    soulStyleDiversity: numberLineValue(report, 'Soul-style diversity'),
    administrativeDriftFlags: numberLineValue(report, 'Administrative drift flags'),
  };
}

function reportFreshnessFor(report) {
  const generated = report.match(/^Generated:\s*(.+)$/m)?.[1]?.trim();
  const timestamp = generated ? Date.parse(generated) : NaN;
  if (!Number.isFinite(timestamp)) {
    return { generated: undefined, ageMinutes: undefined, stale: true };
  }
  const ageMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  return {
    generated,
    ageMinutes,
    stale: ageMinutes > STALE_REPORT_MINUTES,
  };
}

function formatReportAge(freshness) {
  if (freshness.ageMinutes === undefined) return 'missing/stale';
  return `${freshness.ageMinutes} min${freshness.stale ? ' (stale)' : ''}`;
}

function lineValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^- ${escaped}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim();
}

function numberLineValue(text, label) {
  const value = lineValue(text, label);
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function chicagoTiming() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour);
  return {
    hour,
    isNight: hour >= 22 || hour < 6,
    label: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} America/Chicago`,
  };
}

function relative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

main().catch((error) => {
  console.error(`[underworld-day-start] fatal: ${error.stack ?? error.message ?? error}`);
  process.exitCode = 1;
});

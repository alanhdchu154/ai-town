#!/usr/bin/env bash
# Underworld world watchdog (data-collection uptime workaround).
#
# WHY: the Convex local backend periodically dies via an internal Rust panic in
# its search-index archive-cache cleanup thread (abort/SIGABRT) — see the
# `backend-crash-root-cause` note. When the backend CHILD crashes, the
# `convex dev` wrapper does NOT exit (it just retries "waiting for local
# backend"), so the launchd `KeepAlive` on com.giis.underworld.dev-stack never
# fires and the world stays down until someone restarts it manually.
#
# WHAT: this is an EXTERNAL poller. If port 3210 (the backend) is down, it does
# the proven recovery — `launchctl kickstart -k` of the dev-stack service — then
# waits for the backend to come back. It is intentionally conservative:
#   - requires TWO consecutive down checks (ignore a transient blip),
#   - rate-limited to at most one restart per RESTART_COOLDOWN_S (no thrash),
#   - no code/data change, no engine kick — just a service restart.
# Healthy runs are a near-instant no-op. Run it on a short launchd interval.
#
# Read-only otherwise. Exit 0 = healthy or recovery issued; never hard-fails the
# agent.

set -uo pipefail

REPO_ROOT="/Users/alanhdchu/ai-town"
LOG="${REPO_ROOT}/umi/reports/world-watchdog.log"
STAMP_FILE="${REPO_ROOT}/umi/reports/.world-watchdog-last-restart"
SERVICE="com.giis.underworld.dev-stack"
BACKEND_HOST="127.0.0.1"
BACKEND_PORT="3210"
RESTART_COOLDOWN_S=300      # don't restart more than once per 5 min
UP_POLL_MAX=40             # after restart, poll up to ~120s for the backend
UP_POLL_SLEEP=3

NC="/usr/bin/nc"
LAUNCHCTL="/bin/launchctl"

ts() { date '+%Y-%m-%d %H:%M:%S %Z'; }
log() { echo "[$(ts)] $*" >>"$LOG"; }

port_open() { "$NC" -z -w3 "$BACKEND_HOST" "$BACKEND_PORT" >/dev/null 2>&1; }

# --- health check (two consecutive checks to ignore a transient blip) ---
if port_open; then
  exit 0   # healthy: silent no-op (avoid log spam every interval)
fi
sleep 4
if port_open; then
  log "transient: 3210 was briefly closed but recovered on recheck; no action."
  exit 0
fi

# --- backend is genuinely down: rate-limit before restarting ---
now_epoch=$(date +%s)
if [ -f "$STAMP_FILE" ]; then
  last=$(cat "$STAMP_FILE" 2>/dev/null || echo 0)
  age=$(( now_epoch - last ))
  if [ "$age" -lt "$RESTART_COOLDOWN_S" ]; then
    log "DOWN: 3210 closed, but a restart was issued ${age}s ago (< ${RESTART_COOLDOWN_S}s cooldown). Waiting for it to come up; no new restart."
    exit 0
  fi
fi

# --- recover ---
log "DOWN: backend 3210 closed on two checks. Issuing 'launchctl kickstart -k ${SERVICE}'."
echo "$now_epoch" >"$STAMP_FILE"
uid=$(id -u)
if "$LAUNCHCTL" kickstart -k "gui/${uid}/${SERVICE}" >>"$LOG" 2>&1; then
  log "kickstart issued; polling for backend to come up..."
else
  log "WARN: kickstart command returned non-zero (service may not be loaded). Check 'launchctl list | grep underworld'."
fi

for i in $(seq 1 "$UP_POLL_MAX"); do
  if port_open; then
    log "RECOVERED: backend 3210 open after ~$(( i * UP_POLL_SLEEP ))s."
    exit 0
  fi
  sleep "$UP_POLL_SLEEP"
done

log "ERROR: backend still down after ~$(( UP_POLL_MAX * UP_POLL_SLEEP ))s post-restart. Manual attention needed (check the .ips crash report and umi/reports/underworld-dev-stack.err.log)."
exit 0

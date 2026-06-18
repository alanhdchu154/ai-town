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

# Consolidated from the retired morning-healthcheck: while the backend is UP this
# agent also (a) resumes a stopped engine and (b) fixes LLM-host DNS. Both are
# throttled (port-down kickstart stays every cycle; these heavier convex/dig
# checks self-pace) so the 120s loop stays cheap.
MAINTENANCE_LOCK="${REPO_ROOT}/umi/reports/.compaction-in-progress"
ENGINE_STAMP="${REPO_ROOT}/umi/reports/.world-watchdog-last-engine-check"
DNS_STAMP="${REPO_ROOT}/umi/reports/.world-watchdog-last-dns-check"
ENGINE_CHECK_INTERVAL_S=600   # check for a stopped engine ~every 10 min
DNS_CHECK_INTERVAL_S=1200      # check LLM-host DNS ~every 20 min
CONVEX="${REPO_ROOT}/node_modules/.bin/convex"
LLM_API_HOST="${LLM_API_HOST:-dashscope-intl.aliyuncs.com}"
LLM_API_DNS_SERVICE="${LLM_API_DNS_SERVICE:-Wi-Fi}"
LLM_API_DNS_PUBLIC="${LLM_API_DNS_PUBLIC:-1.1.1.1 8.8.8.8}"

NC="/usr/bin/nc"
LAUNCHCTL="/bin/launchctl"

ts() { date '+%Y-%m-%d %H:%M:%S %Z'; }
log() { echo "[$(ts)] $*" >>"$LOG"; }

port_open() { "$NC" -z -w3 "$BACKEND_HOST" "$BACKEND_PORT" >/dev/null 2>&1; }

# True if `stamp_file` is missing or older than `interval` seconds (self-pacing).
due() {
  local stamp_file="$1" interval="$2" last now
  [ -f "$stamp_file" ] || return 0
  last=$(cat "$stamp_file" 2>/dev/null || echo 0)
  now=$(date +%s)
  [ $(( now - last )) -ge "$interval" ]
}

maintenance_locked() {
  [ -f "$MAINTENANCE_LOCK" ] || return 1
  local lock_ts age
  lock_ts=$(cat "$MAINTENANCE_LOCK" 2>/dev/null || echo 0)
  age=$(( $(date +%s) - lock_ts ))
  [ "$age" -ge 0 ] && [ "$age" -lt 1200 ]   # fresh lock (<20min) = compaction in progress
}

dns_resolves() {
  dig +short +timeout=3 +tries=1 "$LLM_API_HOST" 2>/dev/null | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
}

# Resume the engine if the backend is up but the world is stopped/inactive — the
# "backend alive but engine dead" case the port check alone cannot see.
resume_engine_if_stopped() {
  local status
  status=$(cd "$REPO_ROOT" && "$CONVEX" run --typecheck disable --codegen disable world:defaultWorldStatus 2>/dev/null) || return 0
  if printf '%s' "$status" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"(stoppedByDeveloper|inactive)"'; then
    log "engine stopped/inactive while backend up — resuming (testing:resume)."
    (cd "$REPO_ROOT" && "$CONVEX" run --typecheck disable --codegen disable testing:resume >/dev/null 2>&1) \
      || log "WARN: testing:resume failed."
  fi
}

# Swap the system resolver to public DNS if the LLM host stops resolving (a known
# router-DNS failure that silences every cloud-routed character).
dns_fix_if_broken() {
  dns_resolves && return 0
  log "DNS: $LLM_API_HOST not resolving — switching $LLM_API_DNS_SERVICE DNS to $LLM_API_DNS_PUBLIC."
  # shellcheck disable=SC2086
  networksetup -setdnsservers "$LLM_API_DNS_SERVICE" $LLM_API_DNS_PUBLIC >/dev/null 2>&1 \
    || { log "WARN: networksetup DNS swap failed."; return 1; }
  sleep 2
  dns_resolves && log "DNS: $LLM_API_HOST resolves after swap." || log "WARN: $LLM_API_HOST still unresolved after DNS swap."
}

# --- health check (two consecutive checks to ignore a transient blip) ---
if port_open; then
  # Backend alive. Also self-heal the two things the retired morning-healthcheck
  # used to cover — a stopped engine (backend up but world inactive) and broken
  # LLM-host DNS — but skip them during a compaction (it owns the world then).
  # Throttled via timestamps so the 120s loop stays cheap.
  if ! maintenance_locked; then
    if due "$ENGINE_STAMP" "$ENGINE_CHECK_INTERVAL_S"; then date +%s >"$ENGINE_STAMP"; resume_engine_if_stopped; fi
    if due "$DNS_STAMP" "$DNS_CHECK_INTERVAL_S"; then date +%s >"$DNS_STAMP"; dns_fix_if_broken; fi
  fi
  exit 0   # healthy
fi
sleep 4
if port_open; then
  log "transient: 3210 was briefly closed but recovered on recheck; no action."
  exit 0
fi

# --- stand down during a scheduled compaction (maintenance lock) ---
# The nightly compaction intentionally cycles the backend for ~5-10min; if the
# watchdog kickstart-restarts the dev-stack then, the two fight and corrupt it. A
# STALE lock (>20min) is ignored so a genuinely-dead backend still recovers.
if maintenance_locked; then
  log "DOWN but compaction maintenance lock is fresh — standing down (no restart)."
  exit 0
fi
[ -f "$MAINTENANCE_LOCK" ] && log "DOWN with a STALE maintenance lock — ignoring it, proceeding with recovery."

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

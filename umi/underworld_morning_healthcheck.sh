#!/usr/bin/env bash
set -uo pipefail

REPO_ROOT="/Users/alanhdchu/ai-town"
REPORT_DIR="$REPO_ROOT/umi/reports"
LOG_FILE="$REPORT_DIR/underworld-morning-healthcheck.log"
STATUS_FILE="$REPORT_DIR/underworld-morning-healthcheck-latest.md"
DEV_LOG_FILE="$REPORT_DIR/underworld-dev-stack.log"
DEV_PID_FILE="$REPORT_DIR/underworld-dev-stack.pid"
DEV_STACK_LABEL="com.giis.underworld.dev-stack"
DEV_STACK_PLIST="$HOME/Library/LaunchAgents/$DEV_STACK_LABEL.plist"

export PATH="$HOME/.nvm/versions/node/v21.7.2/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export NVM_DIR="$HOME/.nvm"
export CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS="${CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:-180}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use default >/dev/null 2>&1 || true
fi

mkdir -p "$REPORT_DIR"
cd "$REPO_ROOT" || exit 1

timestamp() {
  date "+%Y-%m-%d %H:%M:%S %Z"
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*" | tee -a "$LOG_FILE"
}

http_ok() {
  local url="$1"
  curl -fsS --max-time 8 "$url" >/dev/null 2>&1
}

# Selective DNS failure on the AT&T router has knocked the Qwen host
# off-resolution before. When that happens every cloud-routed character
# (Umi / Mahiru / Tianze / Ichinose) goes silent because fetch fails at
# DNS, the abort marker is filtered, and the UI looks frozen. Swap the
# system resolver to public DNS if the Qwen host stops resolving.
LLM_API_HOST="${LLM_API_HOST:-api.newcoin.top}"
LLM_API_DNS_SERVICE="${LLM_API_DNS_SERVICE:-Wi-Fi}"
LLM_API_DNS_PUBLIC="${LLM_API_DNS_PUBLIC:-1.1.1.1 8.8.8.8}"

dns_resolves() {
  dig +short +timeout=3 +tries=1 "$LLM_API_HOST" 2>/dev/null | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
}

dns_preflight() {
  if dns_resolves; then
    log "DNS preflight: $LLM_API_HOST resolves via current resolver"
    return 0
  fi
  log "DNS preflight: $LLM_API_HOST did not resolve; switching $LLM_API_DNS_SERVICE DNS to $LLM_API_DNS_PUBLIC"
  if ! networksetup -setdnsservers "$LLM_API_DNS_SERVICE" $LLM_API_DNS_PUBLIC >/tmp/underworld-dns-swap.out 2>/tmp/underworld-dns-swap.err; then
    log "WARN: networksetup -setdnsservers failed; see /tmp/underworld-dns-swap.err"
    return 1
  fi
  # macOS DNS cache TTL is short, but give the new resolver a beat.
  sleep 2
  if dns_resolves; then
    log "DNS preflight: $LLM_API_HOST now resolves after DNS swap"
    return 0
  fi
  log "WARN: $LLM_API_HOST still unresolved after DNS swap; cloud-routed characters may stay silent"
  return 1
}

convex_ok() {
  npx convex run --typecheck disable --codegen disable school:worldClock >/tmp/underworld-worldClock.json 2>/tmp/underworld-worldClock.err
}

world_status() {
  npx convex run --typecheck disable --codegen disable world:defaultWorldStatus 2>/dev/null || true
}

stack_ok() {
  http_ok "http://localhost:5173/ai-town" &&
    http_ok "http://localhost:3210/version" &&
    convex_ok
}

kill_port_listener() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    log "Stopping listener(s) on port $port: $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 2
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
}

start_stack() {
  log "Starting Underworld dev stack via launchd"
  launchctl bootstrap "gui/$(id -u)" "$DEV_STACK_PLIST" >/tmp/underworld-dev-bootstrap.out 2>/tmp/underworld-dev-bootstrap.err || true
  launchctl kickstart -k "gui/$(id -u)/$DEV_STACK_LABEL" >/tmp/underworld-dev-kickstart.out 2>/tmp/underworld-dev-kickstart.err
}

restart_stack() {
  log "Restarting Underworld local stack"
  launchctl bootout "gui/$(id -u)" "$DEV_STACK_PLIST" >/tmp/underworld-dev-bootout.out 2>/tmp/underworld-dev-bootout.err || true
  kill_port_listener 5173
  kill_port_listener 3210
  start_stack
}

wait_until_ready() {
  local deadline=$((SECONDS + 210))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if stack_ok; then
      return 0
    fi
    sleep 5
  done
  return 1
}

resume_world_if_needed() {
  local status
  status="$(world_status)"
  if printf '%s' "$status" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"(stoppedByDeveloper|inactive)"'; then
    log "World engine is stopped/inactive at morning check; resuming"
    npx convex run --typecheck disable --codegen disable testing:resume >/tmp/underworld-resume.out 2>/tmp/underworld-resume.err || {
      log "WARN: testing:resume failed; see /tmp/underworld-resume.err"
      return 1
    }
  fi
  return 0
}

write_status_report() {
  local result="$1"
  local action="$2"
  local clock_json
  clock_json="$(cat /tmp/underworld-worldClock.json 2>/dev/null || true)"
  cat >"$STATUS_FILE" <<EOF
# Underworld Morning Healthcheck

- Checked at: $(timestamp)
- Result: $result
- Action: $action
- Frontend: http://localhost:5173/ai-town
- Backend: http://localhost:3210/version
- Dev log: $DEV_LOG_FILE
- LaunchAgent log: $LOG_FILE

## worldClock

\`\`\`json
$clock_json
\`\`\`
EOF
}

main() {
  log "Morning healthcheck started"
  dns_preflight || true
  if stack_ok; then
    resume_world_if_needed || true
    if stack_ok; then
      log "Underworld healthy; no restart needed"
      write_status_report "PASS" "No restart needed"
      exit 0
    fi
  fi

  log "Underworld health failed; attempting restart"
  restart_stack
  if wait_until_ready; then
    resume_world_if_needed || true
    if stack_ok; then
      log "Underworld restarted and verified healthy"
      write_status_report "PASS_AFTER_RESTART" "Restarted npm run dev and verified"
      exit 0
    fi
  fi

  log "ERROR: Underworld still unhealthy after restart attempt"
  write_status_report "FAIL" "Restart attempted, verification failed"
  exit 2
}

main "$@"

#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INTERVAL_SECONDS="${1:-3600}"
LOG_DIR="$REPO_ROOT/umi/reports"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date -u +%Y%m%dT%H%M%SZ)-soul-triad-hourly-until-sleep.log"

echo "[soul-triad-loop] log=$LOG_FILE"

while true; do
  HOUR="$(TZ=America/Chicago date +%H)"
  if [[ "$HOUR" -ge 23 || "$HOUR" -lt 6 ]]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] sleep window reached in America/Chicago; stopping." | tee -a "$LOG_FILE"
    exit 0
  fi

  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] running soul triad single-sample + eval." | tee -a "$LOG_FILE"
  (
    cd "$REPO_ROOT"
    npm run pilot:soul-triad:single-sample -- --timeout-ms=240000
  ) 2>&1 | tee -a "$LOG_FILE" || true

  HOUR="$(TZ=America/Chicago date +%H)"
  if [[ "$HOUR" -ge 23 || "$HOUR" -lt 6 ]]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] sleep window reached after run; stopping." | tee -a "$LOG_FILE"
    exit 0
  fi

  sleep "$INTERVAL_SECONDS"
done

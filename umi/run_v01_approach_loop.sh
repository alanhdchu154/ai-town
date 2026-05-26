#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$ROOT_DIR/umi/reports/v01-approach-loop.log"

mkdir -p "$(dirname "$LOG_FILE")"

{
  echo ""
  echo "============================================================"
  echo "[v01-approach-loop] started $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "[v01-approach-loop] cwd=$ROOT_DIR"
  echo "[v01-approach-loop] log=$LOG_FILE"
  echo "[v01-approach-loop] stop with Ctrl-C"
  echo "============================================================"
} | tee -a "$LOG_FILE"

cd "$ROOT_DIR"

npm run underworld:approach:v01 -- "$@" 2>&1 | tee -a "$LOG_FILE"

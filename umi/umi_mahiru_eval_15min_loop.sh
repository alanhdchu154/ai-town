#!/usr/bin/env bash
set -u

cd /Users/alanhdchu/ai-town || exit 1

rounds="${1:-8}"
sleep_seconds="${2:-900}"

for ((i = 1; i <= rounds; i += 1)); do
  echo "===== UMI/MAHIRU EVAL ROUND ${i} $(date -u +%Y-%m-%dT%H:%M:%SZ) ====="
  npm run eval:umi-mahiru -- --ensure-active || true
  if [ "${i}" -lt "${rounds}" ]; then
    echo "--- sleeping ${sleep_seconds}s ---"
    sleep "${sleep_seconds}"
  fi
done

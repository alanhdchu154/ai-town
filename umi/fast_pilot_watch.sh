#!/usr/bin/env bash
set -u

cd /Users/alanhdchu/ai-town || exit 1

rounds="${1:-6}"
sleep_seconds="${2:-300}"

for ((i = 1; i <= rounds; i += 1)); do
  echo "===== ROUND ${i} $(date -u +%Y-%m-%dT%H:%M:%SZ) ====="
  echo "--- worldClock ---"
  npx convex run --typecheck disable --codegen disable school:worldClock || true
  echo "--- recent eval since last watched change ---"
  npm run eval:conversation:recent -- --since-last-change || true
  echo "--- recent archived conversations compact ---"
  npx convex run --typecheck disable --codegen disable school:recentConversationEvalData '{"limit":8,"compact":true}' || true
  if [ "${i}" -lt "${rounds}" ]; then
    echo "--- sleeping ${sleep_seconds}s ---"
    sleep "${sleep_seconds}"
  fi
done

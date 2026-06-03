#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/Users/alanhdchu/ai-town"

export PATH="$HOME/.nvm/versions/node/v21.7.2/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use default >/dev/null 2>&1 || true
fi

# Convex local sometimes needs longer than the CLI default 30s to decide the
# backend is ready after a Mac sleep/wake or large local-state replay.
export CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS="${CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:-180}"

cd "$REPO_ROOT"
exec ./node_modules/.bin/npm-run-all --parallel dev:backend dev:frontend

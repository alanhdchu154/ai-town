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
# 900s (not 180s): the backend state lives on the external T9-Active SSD, and a
# cold open of the multi-GB sqlite + search/vector index bootstrap over USB took
# ~520s under the dev stack. A 180s timeout tripped convex dev mid-bootstrap and
# caused a launchd restart loop; 900s leaves comfortable margin. Warm restarts
# (OS page cache) are much faster.
export CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS="${CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:-900}"

cd "$REPO_ROOT"
exec ./node_modules/.bin/npm-run-all --parallel dev:backend dev:frontend

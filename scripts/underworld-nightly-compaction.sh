#!/usr/bin/env bash
# Nightly auto-compaction wrapper (the launchd agent calls this).
#
# WHY: the Convex local backend keeps full document VERSION HISTORY and never
# GCs it (WORKLOG #39), so the `documents` table grows ~150k rows/day. A big DB
# slows cold-open AND raises the search-cache-cleanup crash risk (#47). The only
# safe shrink is export -> fresh backend -> import (the compaction script).
#
# WHAT: runs `underworld-compact-state.sh --auto`, which is a NO-OP below
# WARN_DOCS (250k) and only actually compacts (backing up + restoring env, keeping
# a recoverable archive) when the DB has grown past it. Scheduled for 04:00 local
# (deep sim-sleep, agents sleep 23:00-06:00) so the ~10-min world pause loses no
# conversations. Idempotent + safe to run every night.

set -uo pipefail

REPO_ROOT="/Users/alanhdchu/ai-town"
LOG="${REPO_ROOT}/umi/reports/compact-auto.log"

export PATH="$HOME/.nvm/versions/node/v21.7.2/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
# Cold-open of the freshly-imported backend can be slow on the external SSD;
# give it generous margin so the script does not trip the CLI's default timeout.
export CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS="${CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:-900}"

cd "$REPO_ROOT" || exit 1
echo "[nightly-compaction] $(date '+%Y-%m-%d %H:%M:%S %Z') starting --auto run" >>"$LOG"
./scripts/underworld-compact-state.sh --auto >>"$LOG" 2>&1
echo "[nightly-compaction] $(date '+%Y-%m-%d %H:%M:%S %Z') finished (exit $?)" >>"$LOG"

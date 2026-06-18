#!/usr/bin/env bash
# GIIS Underworld — Convex local-backend state compaction.
#
# WHY THIS EXISTS
# ---------------
# The AI Town engine rewrites the engine + world docs ~every second. Convex's
# LOCAL backend keeps the full document VERSION HISTORY (cloud Convex compacts
# it automatically; the local OSS backend does not). So the `documents` table
# grows ~150k rows/day even though the real app data (memories, conversations,
# residue) is tiny (~35k rows / ~33 MB). Left alone it reaches ~1 GB in ~4 days,
# at which point the backend takes ~9 minutes to cold-open and queries start
# failing with "too many system operations" (lost conversations / data).
#
# This script COMPACTS the backend: export current data -> archive the bloated
# state -> fresh empty backend -> import -> restore env -> resume. Version
# history is dropped; ALL data + continuity (same world/engine id, same sim day)
# is preserved. 1 GB -> ~tens of MB; cold-open 9 min -> ~5-30 s.
#
# It is a CURE that must be RE-RUN periodically (e.g. weekly, or when
# `--check` says so). It is NOT a one-time fix — the history grows back.
#
# USAGE
#   scripts/underworld-compact-state.sh --check   # report size, recommend or not
#   scripts/underworld-compact-state.sh           # do the compaction (asks once)
#   scripts/underworld-compact-state.sh --yes     # do it without the prompt
#
# SAFETY NET: the old 1 GB state dir is MOVED (not deleted) to a timestamped
# `*-archive-precompact-*` sibling. If anything goes wrong, stop convex dev,
# remove the fresh dir, move the archive back to the original name, restart.
set -uo pipefail

REPO_ROOT="/Users/alanhdchu/ai-town"
cd "$REPO_ROOT" || exit 1
export CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS="${CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:-900}"

STATE_BASE="/Volumes/T9-Active/convex-backend-state"
LIVE="$STATE_BASE/local-alan_chu-ai_town"
SQLITE="$LIVE/convex_local_backend.sqlite3"
STAMP="${COMPACT_STAMP:-$(date +%Y%m%d)}"   # dynamic so nightly archives never collide
CONVEX="./node_modules/.bin/convex"

# Maintenance lock: while this file exists, the world-watchdog skips its recovery
# so it does NOT kickstart-restart the dev-stack mid-compaction (the two would
# fight and corrupt the compaction). Created right before the backend goes down,
# removed on any exit via trap. The watchdog also ignores a stale lock (>20min).
LOCK="$REPO_ROOT/umi/reports/.compaction-in-progress"

# Size thresholds (documents-table row count from the sqlite).
WARN_DOCS=250000     # getting big — plan a compaction soon
CRIT_DOCS=500000     # compact now; cold-open is getting slow

doc_count() { sqlite3 "$SQLITE" "SELECT COUNT(*) FROM documents WHERE deleted=0;" 2>/dev/null || echo "?"; }
db_mb() { echo $(( $(stat -f%z "$SQLITE" 2>/dev/null || echo 0) / 1024 / 1024 )); }

check_only() {
  local n mb; n=$(doc_count); mb=$(db_mb)
  echo "[compact-state] db=${mb} MB documents=${n}"
  if [ "$n" = "?" ]; then echo "  (could not read sqlite — backend may be mid-restart)"; return 0; fi
  if   [ "$n" -ge "$CRIT_DOCS" ]; then echo "  ⛔ CRITICAL: compact now (run this script with no args)."
  elif [ "$n" -ge "$WARN_DOCS" ]; then echo "  ⚠️  WARN: schedule a compaction soon."
  else echo "  ✅ OK: no compaction needed yet."; fi
}

if [ "${1:-}" = "--check" ]; then check_only; exit 0; fi

# --auto: for an unattended scheduler (e.g. a nightly cron during deep sleep).
# Compacts ONLY when the document count has grown past WARN_DOCS, then runs
# non-interactively; otherwise it does nothing. The version history grows
# ~150-170k docs/day, so this self-paces to roughly every 2-3 nights.
if [ "${1:-}" = "--auto" ]; then
  n=$(doc_count)
  if [ "$n" = "?" ]; then echo "[compact-state] --auto: backend not ready, skipping."; exit 0; fi
  if [ "$n" -lt "$WARN_DOCS" ]; then
    echo "[compact-state] --auto: documents=$n < $WARN_DOCS — no compaction needed."
    exit 0
  fi
  echo "[compact-state] --auto: documents=$n >= $WARN_DOCS — compacting now."
fi

# ---- confirmation (skipped for --yes / --auto) ----
if [ "${1:-}" != "--yes" ] && [ "${1:-}" != "--auto" ]; then
  echo "About to compact the Convex local backend (stops the world ~5-10 min)."
  echo "Current: db=$(db_mb) MB, documents=$(doc_count)."
  read -r -p "Proceed? [y/N] " ans
  [ "$ans" = "y" ] || { echo "Aborted."; exit 1; }
fi

ARCHIVE="$STATE_BASE/local-alan_chu-ai_town-archive-precompact-$STAMP-$(doc_count)"
EXPORT_ZIP="$STATE_BASE/../underworld-compaction-export-$STAMP.zip"
ENV_BACKUP="$(mktemp /tmp/underworld-env-backup.XXXXXX)"

# Hold the maintenance lock for the whole backend-down window so the watchdog
# stands down. Removed on ANY exit (success, failure, or interrupt).
mkdir -p "$(dirname "$LOCK")"
date +%s > "$LOCK"
trap 'rm -f "$LOCK"' EXIT
echo "[compact-state] maintenance lock set ($LOCK) — world-watchdog will skip recovery during compaction."

echo "==> 1/8 Backing up env vars (CRITICAL — export/import does NOT carry these)"
$CONVEX env list > "$ENV_BACKUP" 2>/dev/null
echo "    saved $(grep -c '=' "$ENV_BACKUP") env vars to $ENV_BACKUP"

echo "==> 2/8 Stopping engine for a clean snapshot"
$CONVEX run testing:stop '{}' >/dev/null 2>&1; sleep 6

echo "==> 3/8 Exporting current data (+ file storage)"
rm -f "$EXPORT_ZIP"
$CONVEX export --path "$EXPORT_ZIP" --include-file-storage 2>&1 | tail -2
[ -s "$EXPORT_ZIP" ] || { echo "❌ export failed — aborting BEFORE any destructive step. Env backup at $ENV_BACKUP"; exit 1; }
echo "    export: $(du -h "$EXPORT_ZIP" | cut -f1)"

echo "==> 4/8 Stopping convex dev + archiving old state (recoverable)"
pkill -f "convex dev" 2>/dev/null; sleep 4
mv "$LIVE" "$ARCHIVE" || { echo "❌ archive move failed"; exit 1; }
mkdir -p "$LIVE"; cp "$ARCHIVE/config.json" "$LIVE/config.json"
echo "    archived to $ARCHIVE"

echo "==> 5/8 Starting fresh empty backend"
nohup env CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS=900 $CONVEX dev --tail-logs \
  >> umi/reports/mobile-dev-stack.log 2>&1 &
disown 2>/dev/null
s=$SECONDS; until nc -z -w2 127.0.0.1 3210 2>/dev/null; do
  [ $((SECONDS-s)) -gt 180 ] && { echo "❌ fresh backend did not come up — restore: mv \"$ARCHIVE\" \"$LIVE\""; exit 1; }
  sleep 3
done
sleep 25  # let convex dev push schema/functions

echo "==> 6/8 Importing snapshot (--replace-all)"
$CONVEX import --replace-all "$EXPORT_ZIP" -y 2>&1 | tail -2

echo "==> 7/8 Restoring env vars"
while IFS= read -r line; do
  [ -z "$line" ] && continue
  name="${line%%=*}"; val="${line#*=}"
  [ -z "$name" ] && continue
  $CONVEX env set "$name" "$val" >/dev/null 2>&1
done < "$ENV_BACKUP"
echo "    restored $(grep -c '=' "$ENV_BACKUP") env vars"
rm -f "$ENV_BACKUP"

echo "==> 8/8 Resuming engine + verifying"
$CONVEX run testing:resume '{}' >/dev/null 2>&1; sleep 8
$CONVEX run world:defaultWorldStatus '{}' 2>&1 | grep -E '"status"' | head -1
echo "    new size: db=$(db_mb) MB documents=$(doc_count)"
echo ""
echo "✅ Done. Archive kept at: $ARCHIVE"
echo "   Verify the world for a bit, then delete the archive to reclaim space:"
echo "     rm -rf \"$ARCHIVE\""

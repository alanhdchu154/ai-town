#!/usr/bin/env bash
# GIIS Underworld — read-only "peek" at the live world's data.
# One command to see: world health, recent conversations + residue, memories,
# sleep notes, and v0.1 evidence counts. Pure reads, never mutates anything.
#
#   scripts/underworld-peek.sh            # everything
#   scripts/underworld-peek.sh talk       # recent conversations + residue only
#   scripts/underworld-peek.sh sleep      # sleep notes only
#   scripts/underworld-peek.sh health     # world status / sim clock / db size
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
export CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS="${CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:-900}"
WANT="${1:-all}"
RUN() { ./node_modules/.bin/convex run "$@" 2>&1 | grep -vE "Experimental|trace-warnings|node --trace"; }

if [ "$WANT" = all ] || [ "$WANT" = health ]; then
  echo "━━━ 世界健康 / world health ━━━"
  RUN school:debugAlanConversationState '{}' | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except: print('  (backend not ready)'); sys.exit()
wc=d.get('worldClock',{}); h=wc.get('hour',0)
ph='睡眠' if (h>=23 or h<6) else ('準備休息' if 21<=h<23 else '清醒')
print(f\"  status={d.get('status')}  sim=day{wc.get('day')} {h:02d}:{wc.get('minute',0):02d} ({ph})  active對話={d.get('activeConversationCount')}\")
" 2>/dev/null
  echo "  DB大小:"; ./scripts/underworld-compact-state.sh --check 2>/dev/null | sed 's/^/  /'
  echo ""
fi

if [ "$WANT" = all ] || [ "$WANT" = talk ]; then
  echo "━━━ 最近對話 + 心裡留下的(殘留) / recent conversations + residue ━━━"
  RUN school:recentConversationEvalData '{"timeZone":"America/Chicago","limit":12,"messagesPerConversation":4}' | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except: print('  (no data)'); sys.exit()
for c in d.get('conversations',[])[:12]:
    chars='/'.join(c.get('involvedCharacters',[]))
    res=[t.get('residueLineZh') for t in c.get('memoryTraces',[]) if t.get('residueLineZh')]
    mem=[t.get('memoryLineZh') for t in c.get('memoryTraces',[]) if t.get('memoryLineZh') and not t.get('residueLineZh')]
    print(f\"\n  [{c.get('timestampLabelZh')}] {chars}\")
    for r in res: print(f'    殘留: {r}')
    for m in mem[:1]: print(f'    記住: {m[:50]}')
" 2>/dev/null
  echo ""
fi

if [ "$WANT" = all ] || [ "$WANT" = sleep ]; then
  echo "━━━ 睡眠筆記 / sleep notes ━━━"
  RUN sleepNotes:sleepNotesSummary '{}' | python3 -c "
import json,sys
try: d=json.load(sys.stdin); print('  ', json.dumps(d,ensure_ascii=False))
except: print('  (no sleep-notes summary)')
" 2>/dev/null
  echo ""
fi

if [ "$WANT" = all ]; then
  echo "━━━ 更多 / more (UI 在瀏覽器 http://localhost:5173/ai-town 的「對話牆」) ━━━"
  echo "  完整世界狀態:  npx convex run school:debugState '{}'"
  echo "  校園時間軸:    npx convex run school:campusTimeline '{\"timeZone\":\"America/Chicago\"}'"
fi

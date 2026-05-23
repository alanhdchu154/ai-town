#!/usr/bin/env bash
set -u

cd /Users/alanhdchu/ai-town || exit 1

world_id="${WORLD_ID:-md7cefps8wz097yk9k44n92rj1870x6c}"
rounds="${1:-12}"
sleep_seconds="${2:-300}"

for ((i = 1; i <= rounds; i += 1)); do
  echo "===== UMI/MAHIRU ROUND ${i} $(date -u +%Y-%m-%dT%H:%M:%SZ) ====="
  state_file="$(mktemp /tmp/umi-mahiru-world-state.XXXXXX.json)"
  if npx convex run --typecheck disable --codegen disable world:worldState "{\"worldId\":\"${world_id}\"}" > "${state_file}"; then
    active_conversation_id="$(
      node - "${state_file}" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const target = new Set(['p:0', 'p:707']);
const active = data.world.conversations.find((conversation) => {
  const participants = conversation.participants.map((participant) => participant.playerId);
  return participants.length === 2 && participants.every((id) => target.has(id));
});
if (active) {
  console.log(active.id);
}
NODE
    )"
    if [ -n "${active_conversation_id}" ]; then
      echo "--- active Umi/Mahiru conversation: ${active_conversation_id} ---"
      npx convex run --typecheck disable --codegen disable messages:listMessages "{\"worldId\":\"${world_id}\",\"conversationId\":\"${active_conversation_id}\"}" || true
    else
      echo "--- no active Umi/Mahiru conversation; co-locating pilot pair ---"
      npx convex run --typecheck disable --codegen disable school:coLocateUmiMahiruForPilot || true
    fi
  else
    echo "--- worldState unavailable; keeping loop alive ---"
  fi
  rm -f "${state_file}"

  echo "--- recent archived conversations ---"
  npx convex run --typecheck disable --codegen disable school:recentConversationEvalData '{"limit":6,"compact":true}' || true

  if [ "${i}" -lt "${rounds}" ]; then
    echo "--- sleeping ${sleep_seconds}s ---"
    sleep "${sleep_seconds}"
  fi
done

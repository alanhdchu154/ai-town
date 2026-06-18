# Live Deployment Env — GIIS Underworld (snapshot 2026-06-15)

Convex env vars are **not** in git. This file records the current live config on
the local Convex deployment (`local-alan_chu-ai_town`) so it can be re-applied if
the deployment is ever reset. **Secrets are NOT listed here** — the qwen-plus
cloud credentials (`UMI_MAHIRU_PILOT_API_KEY`, `UMI_MAHIRU_PILOT_BASE_URL`) must
be restored from a secure source, not this doc.

## Architecture (what this config implements)

```
Memory + conversations:  ☁️ cloud qwen-plus (primary)  ──fail──►  F15 7b (fallback)
Alan's chats:            ☁️ cloud qwen-plus
Conversation frequency:  10-min soul-pair cooldown (keeps cloud sustainable)
Mac (M1 Pro):  runs the world (Convex + engine)
F15 (RTX 3060 6GB, 192.168.1.69):  local Ollama qwen2.5:7b — the overflow/fallback node
```

The cloud endpoint has a self-imposed daily quota (`UMI_MAHIRU_PILOT_DAILY_QUOTA`,
default 24 in `convex/modelPolicy.ts`, raised to 600 for the 2026-06-16 run). When the cloud is
saturated/quota-blown, generation falls back to the F15. The F15 must be powered
on, on the same LAN, and warm (`OLLAMA_KEEP_ALIVE=-1` on the F15 itself).

## Re-apply commands (run on the Mac if the deployment is reset)

```bash
# --- LLM routing: cloud primary, F15 (LAN Ollama) as the local fallback ---
npx convex env set MEMORY_LLM_CLOUD true
npx convex env set MEMORY_LLM_TIMEOUT_MS 30000
npx convex env set OLLAMA_BASE_URL "http://192.168.1.69:11434"   # F15 LAN IP (DHCP — re-check if it changed)
npx convex env set OLLAMA_MODEL qwen2.5:7b
npx convex env set CHARACTER_SOUL_LOCAL_FALLBACK true
npx convex env set CHARACTER_SOUL_LOCAL_FALLBACK_MODEL qwen2.5:7b
npx convex env set CHARACTER_SOUL_LOCAL_FALLBACK_TIMEOUT_MS 12000

# --- cloud pilot (qwen-plus). API key + base URL are SECRETS, restore separately ---
npx convex env set UMI_MAHIRU_PILOT_PROVIDER qwen
npx convex env set UMI_MAHIRU_PILOT_MODEL qwen-plus
npx convex env set UMI_MAHIRU_PILOT_TIMEOUT_MS 60000
npx convex env set UMI_MAHIRU_PILOT_DAILY_QUOTA 600
npx convex env set UMI_MAHIRU_PILOT_COOLDOWN_FAILURES 1
npx convex env set UMI_MAHIRU_PILOT_COOLDOWN_MS 0
npx convex env set ALAN_HUMAN_CLOUD_LLM true
npx convex env set HUMAN_CONVERSATION_CLOUD_LLM true
npx convex env set AUTONOMOUS_CONVERSATION_LLM true
npx convex env set AUTONOMOUS_CONVERSATION_LLM_PAIRS "Umi:Mahiru,Umi:Tianze,Mahiru:Tianze,Tianze:Ichinose"

# --- frequency / engine resilience ---
npx convex env set SOUL_PILOT_PAIR_COOLDOWN_MS 600000          # 10-min cooldown (lowers cloud load)
npx convex env set AGENT_GENERATE_MESSAGE_TIMEOUT_MS 150000    # operation backstop (was a bad 600000 default)
npx convex env set UNDERWORLD_KEEP_WORLD_ALIVE true
npx convex env set UNDERWORLD_RESIDUE_LLM true
npx convex env set UNDERWORLD_SPEECH_INTROSPECTION true        # Convex-gated speech introspection capture for /introspection

# then: testing:stop -> wait ~20s -> testing:resume  (clean restart, never testing:kick)
```

## On the F15 (Windows, the Ollama server) — not Convex env

```powershell
setx OLLAMA_HOST "0.0.0.0:11434"
setx OLLAMA_NUM_PARALLEL "2"
setx OLLAMA_KEEP_ALIVE "-1"      # keep model resident — REQUIRED for the fallback to be fast
# pull: ollama pull qwen2.5:7b   (6 GB VRAM → 7b is the sweet spot)
```
Full guide: `docs/f15-ollama-server-setup.md`. The F15 IP is DHCP
(`192.168.1.69`); if it changes, update `OLLAMA_BASE_URL` (or pin a DHCP
reservation on the router).

## Kill switches (to stop cloud spend / always-on)

- `MEMORY_LLM_CLOUD=false` → memory runs on the local (F15) model instead of cloud.
- `UNDERWORLD_KEEP_WORLD_ALIVE=false` → world idles when no browser is open.
- Lower `UMI_MAHIRU_PILOT_DAILY_QUOTA` → throttle cloud usage sooner.

## Notes / known caveats (2026-06-15)

- 7b memory quality is more flowery than qwen-plus; that's why memory is on cloud
  (primary) and the F15 7b is fallback only.
- 600 cloud attempts/day is an autonomous character-soul attempt quota, not a
  hard token cap. For the 2026-06-16 run, treat about USD $5/day as the soft
  watch cap unless fresh provider usage evidence says otherwise.
- De-philosophised residue/summary prompts are committed (`f8e10d3d`).
- Conversation motif-loop guards are committed (`1170e359`) — verify on fresh
  conversations.
- Recovery from a stuck/split-brain engine: ONE `testing:stop` → wait →
  `testing:resume`. Never `testing:kick` (it spawns a duplicate runStep loop).

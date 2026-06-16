# F15 as the Ollama LLM Server (for GIIS Underworld)

**Read this if you are Claude Code running on Alan's ASUS TUF F15 (Windows + NVIDIA GPU).**

## Your job (and what you are NOT doing)

This F15 laptop has the NVIDIA GPU. Its ONLY job is to be a fast **Ollama LLM
inference server** on the home LAN. The GIIS Underworld world itself runs on
Alan's **Mac** (`192.168.1.239`); the Mac's Convex backend will call this F15's
Ollama over the LAN for conversation/memory generation.

So on this F15 you do **NOT**:
- run the world / `npm run dev` / Convex / the Vite app,
- need the rest of this repo's code to work (the repo is here only so you can
  read this doc and report back).

You **only** set up Ollama, expose it to the LAN, pull a model, and report two
things back to Alan so the Mac side can be wired up:
1. this F15's **LAN IP** (e.g. `192.168.1.xxx`),
2. the **GPU model + VRAM** and the **model name** you pulled.

The Mac side (`OLLAMA_BASE_URL` env + restart) is done on the Mac, not here.

---

## Step 0 — check the GPU (decides which model to pull)

```powershell
nvidia-smi
```
Note the GPU name and the total memory (VRAM), e.g. "NVIDIA GeForce RTX 4060
Laptop GPU, 8188 MiB". Pick the model in Step 3 by VRAM:

| VRAM | Pull this model | Notes |
| --- | --- | --- |
| ≤ 6 GB | `qwen2.5:7b` (or `qwen2.5:3b` if 7b is slow) | 7b may partly spill to CPU |
| 8 GB | `qwen2.5:7b` | fits fully on GPU → fast (~1–2 s) |
| 12 GB | `qwen2.5:14b` | better quality |
| 16 GB+ | `qwen2.5:14b` (or `qwen2.5:32b` for best) | |

## Step 1 — install Ollama (Windows)

```powershell
winget install --id Ollama.Ollama -e
```
(or download the installer from https://ollama.com/download). After install,
Ollama runs as a tray app / background service.

## Step 2 — expose Ollama to the LAN (the critical step)

By default Ollama only listens on `localhost`, so the Mac cannot reach it. Make
it listen on all interfaces, then RESTART Ollama so it takes effect:

```powershell
setx OLLAMA_HOST "0.0.0.0:11434"
setx OLLAMA_NUM_PARALLEL "2"
# restart the Ollama process so the new env is picked up:
taskkill /IM ollama.exe /F
# then relaunch it (Start menu -> Ollama), or:
ollama serve
```
`OLLAMA_NUM_PARALLEL=2` lets it handle 2 requests at once (helps throughput).

## Step 3 — pull the model (from the Step 0 table)

```powershell
ollama pull qwen2.5:7b
```
(use whatever the VRAM table said). This downloads a few GB once.

## Step 4 — open the firewall for port 11434

Run PowerShell **as Administrator**:
```powershell
New-NetFirewallRule -DisplayName "Ollama LAN" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Allow -Profile Private
```
If Windows pops up "Allow Ollama to communicate on networks?" choose **Private
networks → Allow** as well.

## Step 5 — find this F15's LAN IP

```powershell
ipconfig | findstr /i "IPv4"
```
Take the `192.168.1.xxx` one (same subnet as the Mac's `192.168.1.239`). If
there are several, it's the one for your active Wi-Fi / Ethernet adapter.

## Step 6 — verify locally + that it serves on the LAN

```powershell
# is it up and does it list your model?
curl http://localhost:11434/api/tags
# quick generation smoke test (should return a short reply in a second or two):
ollama run qwen2.5:7b "用繁體中文回一句：今天好嗎？"
```
Both should work. If `curl http://localhost:11434` says "Ollama is running",
the server is healthy.

## Step 7 — report back to Alan

Tell Alan (so the Mac side can be wired):
- **F15 LAN IP**: `192.168.1.___`
- **GPU + VRAM**: e.g. `RTX 4060 Laptop, 8 GB`
- **model pulled**: e.g. `qwen2.5:7b`
- confirmation that Step 6 worked.

Then on the **Mac**, the wiring is just:
```
npx convex env set OLLAMA_BASE_URL "http://<F15-IP>:11434"
npx convex env set OLLAMA_MODEL "qwen2.5:7b"     # match the F15's model
# then a clean restart of the world: testing:stop -> wait -> testing:resume
```
and a forced conversation to confirm latency dropped from ~16 s to ~1–2 s.

---

## Keep-it-running notes

- The F15 must stay **on** and on the **same network** whenever the world runs.
- Wired Ethernet is steadier than Wi-Fi for a server, but Wi-Fi is fine.
- Set Windows power/sleep so the laptop does not sleep while serving (Settings →
  Power → Screen and sleep → "When plugged in, put to sleep" = Never).
- Running an LLM keeps the GPU warm; fans will spin. Fine for testing; for long
  24/7 runs watch temperatures.
- If the F15's IP changes after a reboot (DHCP), re-run Step 5 and tell Alan the
  new IP (or set a DHCP reservation on the router so it stays fixed).

#!/usr/bin/env bash
set -euo pipefail

# Start the user-local universal/arm64 Ollama binary so Apple Silicon Metal is used.
# The Intel Homebrew Ollama under /usr/local runs, but falls back to CPU on this Mac.
NATIVE_OLLAMA="${NATIVE_OLLAMA:-$HOME/.local/bin/ollama-native}"

if [[ ! -x "$NATIVE_OLLAMA" ]]; then
  cat >&2 <<EOF
Missing native Ollama binary at:
  $NATIVE_OLLAMA

Install it without sudo:
  curl -L -o /tmp/ollama-darwin.tgz https://github.com/ollama/ollama/releases/download/v0.24.0/ollama-darwin.tgz
  mkdir -p /tmp/ollama-darwin ~/.local/bin
  tar -xzf /tmp/ollama-darwin.tgz -C /tmp/ollama-darwin
  cp /tmp/ollama-darwin/ollama ~/.local/bin/ollama-native
  chmod +x ~/.local/bin/ollama-native
EOF
  exit 1
fi

if command -v brew >/dev/null 2>&1; then
  brew services stop ollama >/dev/null 2>&1 || true
fi

pkill -f '/usr/local/.*ollama' >/dev/null 2>&1 || true
pkill -f 'ollama runner' >/dev/null 2>&1 || true

export OLLAMA_CONTEXT_LENGTH="${OLLAMA_CONTEXT_LENGTH:-4096}"
export OLLAMA_FLASH_ATTENTION="${OLLAMA_FLASH_ATTENTION:-1}"
export OLLAMA_KV_CACHE_TYPE="${OLLAMA_KV_CACHE_TYPE:-q8_0}"

echo "Starting native Ollama:"
echo "  binary: $NATIVE_OLLAMA"
echo "  context: $OLLAMA_CONTEXT_LENGTH"
echo "  host: ${OLLAMA_HOST:-http://127.0.0.1:11434}"
exec "$NATIVE_OLLAMA" serve

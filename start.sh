#!/usr/bin/env bash
#
# One-command launcher for the Eisenhower Matrix.
# Installs dependencies (first run), builds the app, and starts the server that
# serves the UI and saves your tasks to a JSON file.
#
# Usage:
#   ./start.sh
#
# Optional environment overrides:
#   PORT=3000 ./start.sh                              # change the port (default 4317)
#   EISENHOWER_DATA_FILE=~/tasks.json ./start.sh      # change where tasks are saved
#   NO_OPEN=1 ./start.sh                              # don't auto-open the browser
#   HOST=0.0.0.0 ./start.sh                           # expose on the LAN (off by default)

set -euo pipefail

# Always run from the project directory, wherever the script is called from.
cd "$(dirname "$0")"

PORT="${PORT:-4317}"

# 1. Require Node.
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed or not on your PATH."
  echo "Install Node 18+ (https://nodejs.org) and try again. No admin rights needed for a user-level install (e.g. nvm)."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Warning: detected Node $(node -v). This app targets Node 18+; older versions may not work."
fi

# 2. Install dependencies on first run.
if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)…"
  npm install
fi

# 3. Build the UI (fast; keeps the served app in sync with the code).
echo "Building the app…"
npm run build

# 4. Auto-open the browser shortly after the server comes up (macOS 'open').
if [ -z "${NO_OPEN:-}" ] && command -v open >/dev/null 2>&1; then
  ( sleep 1.5; open "http://localhost:${PORT}" ) &
fi

# 5. Start the server (foreground). Ctrl+C to stop.
echo "Starting the server… (press Ctrl+C to stop)"
exec node server.mjs

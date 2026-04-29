#!/usr/bin/env bash
# run-local.sh — start psych-battery-app locally (Mac/Linux)
# Usage: bash run-local.sh [--dpm-hub PATH]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DPM_HUB="${SCRIPT_DIR}/../dpm-research-hub"

# Parse --dpm-hub argument
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dpm-hub)
      DPM_HUB="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: bash run-local.sh [--dpm-hub PATH]" >&2
      exit 1
      ;;
  esac
done

FLASK_PID=""
PROXY_PID=""

cleanup() {
  echo ""
  echo "Stopping servers..."
  if [[ -n "$FLASK_PID" ]] && kill -0 "$FLASK_PID" 2>/dev/null; then
    kill "$FLASK_PID" 2>/dev/null
    echo "  Flask backend stopped (PID $FLASK_PID)"
  fi
  if [[ -n "$PROXY_PID" ]] && kill -0 "$PROXY_PID" 2>/dev/null; then
    kill "$PROXY_PID" 2>/dev/null
    echo "  Proxy server stopped (PID $PROXY_PID)"
  fi
  echo "Stopped both servers."
  exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo "================================================"
echo " Psych Battery - Local Launcher"
echo "================================================"
echo ""

# Check ActivityWatch
echo "Checking ActivityWatch at localhost:5600..."
if curl -sf --max-time 2 http://localhost:5600/api/0/info > /dev/null 2>&1; then
  echo "  ✓ ActivityWatch is running."
else
  echo "  Warning: ActivityWatch not detected at localhost:5600."
  echo "  Full mode requires AW running. Download from: https://activitywatch.net/"
  echo "  Continuing — app will work in demo mode without AW."
fi
echo ""

# Start Flask backend
DPM_HUB_REAL="$(realpath "${DPM_HUB}" 2>/dev/null || echo "${DPM_HUB}")"
if [[ -d "${DPM_HUB_REAL}" ]]; then
  echo "Starting Flask backend from ${DPM_HUB_REAL} ..."
  (cd "${DPM_HUB_REAL}" && python -m integrations.models.main) &
  FLASK_PID=$!
  echo "  ✓ Flask backend started (PID ${FLASK_PID})."
else
  echo "  Warning: dpm-research-hub not found at '${DPM_HUB_REAL}'."
  echo "  Pass --dpm-hub PATH to specify its location."
  echo "  Continuing — app will work in demo mode without the Flask backend."
fi
echo ""

# Start proxy server
echo "Starting proxy server from ${SCRIPT_DIR} ..."
(cd "${SCRIPT_DIR}" && python server.py) &
PROXY_PID=$!
echo "  ✓ Proxy server started (PID ${PROXY_PID})."
echo ""

# Wait then open browser
echo "Waiting for servers to initialize..."
sleep 2

OS="$(uname -s)"
echo "Opening browser at http://localhost:3131"
if [[ "${OS}" == "Darwin" ]]; then
  open http://localhost:3131
else
  if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3131
  else
    echo "  Could not open browser automatically. Visit http://localhost:3131"
  fi
fi

echo ""
echo "================================================"
echo " Psych Battery is running at http://localhost:3131"
echo " Press Ctrl+C to stop both servers."
echo "================================================"
echo ""

# Keep running until Ctrl+C
wait

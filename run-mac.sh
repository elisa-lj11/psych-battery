#!/usr/bin/env bash
# Start Psych Battery: proxy server + CrowPanel bridge (Mac)
set -e

cd "$(dirname "$0")"

# Kill any stale instances
pkill -f "python.*server.py" 2>/dev/null || true
pkill -f "python.*charge_sender.py" 2>/dev/null || true
sleep 1

echo "Starting server..."
python3 server.py &

sleep 2

# Auto-detect CrowPanel port (CP210x or CH340 USB-serial adapters)
PORT=$(python3 crowpanel/charge_sender.py --list 2>/dev/null | grep -Ei "cp210|ch340|esp32|usbserial" | awk '{print $1}' | head -1)
if [ -n "$PORT" ]; then
  echo "Starting CrowPanel bridge on $PORT..."
  python3 crowpanel/charge_sender.py --port "$PORT" &
else
  echo "CrowPanel not found — skipping display bridge. Plug in the display and rerun."
fi

echo ""
echo "Psych Battery is running."
echo "  Web app : http://localhost:3131"
[ -n "$PORT" ] && echo "  Display : CrowPanel on $PORT (updates every 30s)"

open "http://localhost:3131"

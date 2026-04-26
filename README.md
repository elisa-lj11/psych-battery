# Psych Battery

Visualizes your cognitive energy as a depleting battery based on screen activity tracked by [ActivityWatch](https://activitywatch.net/). Optionally displays on an [Elecrow CrowPanel 5.79" e-ink display](https://www.elecrow.com/crowpanel-esp32-e-paper-hmi-display-5-79-inch.html).

## How it works

ActivityWatch runs in the background and logs which apps and windows are in focus. Psych Battery pulls that data via ActivityWatch's local API, scores each app by cognitive drain, and renders a battery that depletes over a 2-minute rolling window. A local server calculates the current level and serves both the browser UI and the e-ink display so they always show the same value.

- **Draining:** the battery depletes while you're actively using apps, at a rate determined by the app category.
- **Recharging:** the battery recharges during AFK periods detected by ActivityWatch (mouse/keyboard idle).
- **Trend arrows:** ↑ if the battery went up since the last reading, ↓ if it went down.

## Prerequisites

- [ActivityWatch](https://activitywatch.net/downloads/) installed and running
- Python 3.x

## Web app setup

1. Clone the repo:
   ```bash
   git clone https://github.com/elisa-lj11/psych-battery.git
   cd psych-battery
   ```

2. Make sure ActivityWatch is running — check by opening [http://localhost:5600](http://localhost:5600).

3. Start everything with one command:

   **Windows (PowerShell):**
   ```powershell
   .\run.ps1
   ```
   If PowerShell blocks the script, run this once first:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

   **Mac:**
   ```bash
   bash run-mac.sh
   ```

4. Open [http://localhost:3131](http://localhost:3131) in your browser.

> **Why a server?** Browsers block direct requests from a web page to a different localhost port (CORS). `server.py` is a minimal proxy that forwards requests to ActivityWatch — no data leaves your machine.

## E-ink display setup (optional)

Hardware: **Elecrow CrowPanel ESP32-S3 5.79" E-Paper Display** — one USB-C cable, no soldering.

The display shows the battery level as a full-screen black fill that drains from right to left. The percentage number and trend arrow (^ up, V down) are drawn in white on black or black on white, checked pixel-by-pixel against the fill.

### 1. Arduino IDE board settings

Install the ESP32 board package (add `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json` to Additional Boards Manager URLs, then install **esp32 by Espressif**), then configure under Tools:

| Setting | Value |
|---|---|
| Board | ESP32S3 Dev Module |
| Partition Scheme | Huge APP (3MB No OTA/1MB SPIFFS) |
| PSRAM | OPI PSRAM |
| USB CDC On Boot | **Disabled** |
| Upload Speed | 921600 |
| Flash Size | 8MB (64Mb) |
| Flash Mode | QIO |

### 2. Download the Elecrow library

```
https://github.com/Elecrow-RD/CrowPanel-ESP32-5.79-E-paper-HMI-Display-with-272-792
```

Click **Code → Download ZIP** and unzip. Copy these 7 files from `example/arduino/Demos/5.79_WIFI_refresh/` into `crowpanel/psych_battery_crowpanel/`:

```
EPD.h  EPD.cpp  EPD_Init.h  EPD_Init.cpp  EPDfont.h  spi.h  spi.cpp
```

The `psych_battery_crowpanel.ino` is already in that folder.

### 3. Upload the firmware

1. Plug the CrowPanel in via USB-C.
2. In Arduino IDE: Tools → Port → select the COM port that appeared.
3. Open `crowpanel/psych_battery_crowpanel/psych_battery_crowpanel.ino` and click Upload.
4. The display should show 100% (fully black) on boot.

**Smoke test:** Open Serial Monitor (115200 baud, Newline line ending), type `75 down`, press Enter. Display should update to 75% fill and print `ACK 75`.

### 4. Connect the display to the web app

Install the Python bridge dependency:
```bash
pip install pyserial requests
```

Find your COM port:
```bash
python crowpanel/charge_sender.py --list
```

Update the port in `run.ps1` if yours isn't COM5, then run:
```powershell
.\run.ps1
```

This starts both the server and the bridge together. The bridge polls `http://localhost:3131/state` every 10 seconds and sends the current battery level and trend to the display. The server caches the computed value for 8 seconds so the browser and the physical display always show the same reading.

## Tuning drain rates

`DRAIN_RULES` in both `index.html` and `server.py` maps app names and window titles to drain rates. The two files must be kept in sync — rates run from 15.0 (AI tools, video calls) down to 4.0 (music, system tools). Edit the patterns or rates to match your usage.

The rolling window is 2 minutes by default. Change `WINDOW_HOURS` in `server.py` and `WINDOW_MINS` in `index.html` to adjust.

AFK recharge rate is controlled by `AFK_RECHARGE` in `server.py` (default 7.5 drain units per minute).

## Browser extension (optional)

Install the [ActivityWatch browser extension](https://activitywatch.net/docs/watchers.html#web-watchers) to log URLs alongside app names. Without it, all browser activity is classified as **Browser** regardless of which site you're on.

# Psych Battery

Visualizes your cognitive energy as a depleting battery based on screen activity tracked by [ActivityWatch](https://activitywatch.net/). Optionally displays on an [Elecrow CrowPanel 5.79" e-ink display](https://www.elecrow.com/wiki/CrowPanel_ESP32_E-paper_5.79-inch_HMI_Display.html).

## How it works

ActivityWatch runs in the background and logs which apps and windows are in focus. Psych Battery pulls that data via ActivityWatch's local API, scores each app by cognitive drain, and renders a battery that depletes over a 4-hour rolling window. A local server calculates the current level and serves both the browser UI and the e-ink display.

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

3. Start everything with one command (PowerShell):
   ```powershell
   .\run.ps1
   ```
   This starts the local server and (if you have the CrowPanel) the display bridge. If PowerShell blocks the script, run this once first:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

4. Open [http://localhost:3131](http://localhost:3131) in your browser.

> **Why a server?** Browsers block direct requests from a web page to a different localhost port (CORS). `server.py` is a minimal proxy that forwards requests to ActivityWatch — no data leaves your machine.

## E-ink display setup (optional)

Hardware: **Elecrow CrowPanel ESP32-S3 5.79" E-Paper Display** — one USB-C cable, no soldering.

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
4. The display should show a full battery on boot.

**Smoke test:** Open Serial Monitor (115200 baud, Newline line ending), type `75`, press Enter. Display should update and print `ACK 75`.

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

This starts both the server and the bridge together. The bridge polls `http://localhost:3131/state` every 10 seconds and sends the current battery level to the display. The browser at `http://localhost:3131` and the physical display will always show the same value.

## Tuning drain rates

`DRAIN_RULES` in both `index.html` and `server.py` maps app names and window titles to drain rates. The two files must be kept in sync — rates run from 15.0 (AI tools, video calls) down to 1.5 (music, system tools). Edit the patterns or rates to match your usage.

The rolling window is 4 hours by default. Change `WINDOW_HOURS` in `server.py` to adjust.

## Browser extension (optional)

Install the [ActivityWatch browser extension](https://activitywatch.net/docs/watchers.html#web-watchers) to log URLs alongside app names. Without it, all browser activity is classified as **Browser** regardless of which site you're on.

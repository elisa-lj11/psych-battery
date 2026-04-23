# CrowPanel E-Ink Display — setup brief for Claude Code

Paste this entire document into a fresh Claude Code session (or save as
`CLAUDE.md` in the sketch directory) and ask Claude to "set up the CrowPanel
e-ink display from this brief." Everything Claude needs is here.

Scope: JUST the display firmware + Python bridge that sends it a charge
level. Does not cover the backend model server or web app.

---

## What this is

An ELECROW CrowPanel 5.79" e-paper display (ESP32-S3) that shows a battery
charge level (0–100%). The display receives integers over USB Serial from a
Python bridge script — no WiFi, no HTTP, just a USB cable.

Firmware is written in Arduino C++. The bridge is a ~100-line Python script.

## Hardware

- **ELECROW CrowPanel ESP32-S3 5.79" E-Paper Display (DIS08792E)**
  - Dual SSD1683 controllers, 792×272 B/W panel (logical 800×272 for address
    alignment)
  - USB-C connector
  - Approx $55–70 on Amazon / DigiKey
- **USB-C data cable** (NOT a charge-only cable — the computer must see a COM
  port when you plug it in)

No soldering, no wiring, no breadboard. One cable.

## Prerequisites (host machine)

- Arduino IDE 2.x (`https://www.arduino.cc/en/software`)
- Python 3.8+
- Computer with a USB port and ability to install the ESP32 board package

## Files (this folder contains)

- `psych_battery_crowpanel.ino` — Arduino firmware (Serial-only)
- `charge_sender.py` — Python bridge script
- `CROWPANEL_SETUP.md` — this file

## Step-by-step setup

### 1. Arduino IDE — board package

1. Open Arduino IDE → **File → Preferences** (or **Arduino IDE → Settings** on
   macOS).
2. In "Additional boards manager URLs" paste:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. **Tools → Board → Boards Manager**, search `esp32`, install
   "esp32 by Espressif Systems" (takes 2–5 min).

### 2. Arduino IDE — board settings

After installing, configure under **Tools**:

| Setting | Value |
|---|---|
| Board | **ESP32S3 Dev Module** |
| Partition Scheme | **Huge APP (3MB No OTA/1MB SPIFFS)** |
| PSRAM | **OPI PSRAM** |
| USB CDC On Boot | **Enabled** ← critical for Serial over native USB |
| Upload Speed | 921600 |
| Flash Size | 8MB (64Mb) |
| Flash Mode | QIO |

If "USB CDC On Boot" is disabled, Serial Monitor will be blank after upload.

### 3. Download the Elecrow library

```
https://github.com/Elecrow-RD/CrowPanel-ESP32-5.79-E-paper-HMI-Display-with-272-792
```

Click **Code → Download ZIP**. Unzip. The folder you need is:

```
example/arduino/Demos/5.79_WIFI_refresh/
```

### 4. Assemble the sketch folder

Create a new folder called `psych_battery_crowpanel/` (e.g. in
`~/Documents/Arduino/`). Copy **7 files** from the ELECROW example folder above:

- `EPD.h`, `EPD.cpp`
- `EPD_Init.h`, `EPD_Init.cpp`
- `EPDfont.h`
- `spi.h`, `spi.cpp`

Then copy `psych_battery_crowpanel.ino` from THIS folder into the sketch folder.

Final contents:

```
psych_battery_crowpanel/
├── psych_battery_crowpanel.ino   ← our Serial-only firmware
├── EPD.h
├── EPD.cpp
├── EPD_Init.h
├── EPD_Init.cpp
├── EPDfont.h
├── spi.h
└── spi.cpp
```

**Do NOT** copy these (they're not needed and will cause confusion):
- `5.79_WIFI_refresh.ino` (we replace this with our own .ino)
- `Ap_29demo.h` (demo bitmap data, 300 KB, irrelevant)

**Do NOT** look for these — they don't exist in this library:
- `GUI_Paint.h` / `GUI_Paint.cpp` (that's the Waveshare library, different API)
- `Debug.h`, `fonts.h` (Waveshare names; Elecrow uses EPDfont.h)

### 5. Connect the CrowPanel and upload

1. Plug CrowPanel into host via USB-C.
2. **Tools → Port** — select the new port that appeared (COM* on Windows,
   `/dev/cu.usbmodem*` on macOS, `/dev/ttyACM0` on Linux).
3. Open `psych_battery_crowpanel.ino` in Arduino IDE.
4. Click **Upload** (right-arrow button). First compile takes 2–3 min while
   the toolchain builds its cache; subsequent uploads ~20 s.
5. When upload finishes, the display should flash a few times (full refresh
   pattern) and settle on 100% filled battery.

### 6. Smoke test via Serial Monitor

1. **Tools → Serial Monitor** (or Ctrl+Shift+M).
2. Set baud rate to **115200** (dropdown, bottom-right).
3. Set line ending to **Newline** (other dropdown, bottom-right).
4. Type `75` in the input box, press Enter.
5. Display fast-refreshes (<1 s) and shows 75% fill. Serial Monitor prints
   `ACK 75`.
6. Try `15` — display should invert (black background, white "15%",
   "RECHARGE" label). This transition triggers a full refresh (~8 s).
7. Try `25` — reverts to white background, another full refresh.

### 7. Python bridge

Close Serial Monitor first (only one program can own the port).

```bash
pip install pyserial requests
```

Find the port if you don't know it:

```bash
python charge_sender.py --list
```

Send a one-shot test value:

```bash
python charge_sender.py --port COM3 --test 42
```

Should print `ACK: ACK 42`. Display updates to 42%.

Run the continuous bridge (polls `http://localhost:7070/state` every 30 s):

```bash
python charge_sender.py --port COM3
```

This requires something serving `GET /state` that returns JSON with an
`E_display` field in the range 0–1. The bridge multiplies by 100 and sends
as an integer. If you're testing without a real backend, any HTTP server
returning `{"E_display": 0.73}` on `/state` will do.

## Architecture

```
┌─────────────────┐     Serial/USB      ┌──────────────────┐
│  host computer  │────── 115200 ──────→│  CrowPanel ESP32 │
│                 │      "75\n"         │                  │
│ charge_sender   │←──── "ACK 75\n" ────│  reads Serial,   │
│  .py polls      │                     │  draws battery   │
│  /state JSON    │                     │  on e-ink panel  │
└─────────────────┘                     └──────────────────┘
     ↑
     │ HTTP GET /state
     ↓
┌─────────────────┐
│  model server   │  (any HTTP server exposing E_display 0-1)
│  localhost:7070 │
└─────────────────┘
```

## Firmware contract

**Input:** ASCII integer 0–100 followed by `\n`, over USB Serial at 115200 baud.

**Output:**
- On successful update: prints `ACK <N>\n` on Serial.
- Display refreshes: fast partial refresh (<1 s) for most updates; full
  refresh (~8 s) every 10th update OR when crossing the 20% alert boundary.

**Alert mode:** when charge < 20%, inverts the whole display (black bg,
white elements, "RECHARGE" label below the battery). Above 20%, normal
mode (white bg, black elements).

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| Compile error: `'UBYTE' was not declared` | You copied the wrong library (Waveshare instead of Elecrow) | Delete `GUI_Paint.h/cpp`, `Debug.h`, `fonts.h` from the sketch folder. Copy the 7 files listed in Step 4. |
| Compile error: `'GUI_Paint.h' file not found` | You're using old docs | The sketch doesn't include GUI_Paint. Open our `.ino` — it only includes `EPD.h` and `EPDfont.h`. |
| Compile error: `'Paint_NewImage' was not declared` | You didn't copy `EPD.cpp` | Make sure all 7 support files are in the sketch folder. Restart Arduino IDE. |
| Upload fails: "Failed to connect" | Board didn't enter flash mode | Hold **BOOT**, tap **RESET**, release **BOOT**, click Upload again. |
| Upload succeeds but display stays blank | PSRAM is not set to OPI PSRAM | Tools → PSRAM → OPI PSRAM. Re-upload. |
| Upload succeeds, Serial Monitor is blank | USB CDC On Boot is disabled | Tools → USB CDC On Boot → Enabled. Re-upload. |
| Only half the panel draws | Using GxEPD2 or a single-SSD1683 driver | You must use Elecrow's `EPD.h` (dual-driver). |
| Display shows "garbled" pixels | SPI clock issue | Lower upload speed to 460800, re-flash. |
| `charge_sender.py` "Cannot open port" | Arduino Serial Monitor holding the port | Close Serial Monitor. Only one program at a time. |
| `charge_sender.py` "No serial ports found" | Driver not installed or bad cable | Verify Arduino IDE Tools→Port shows a port. If not, check USB cable is data-capable. On Windows you may need CP210x or CH340 driver. |
| `charge_sender.py` connects but display doesn't update | Bridge sending same value repeatedly | By design — firmware only redraws on value change. Try `--test 99` to force a different value. |

## Pin map (reference only — hardwired on the PCB)

| Signal | ESP32-S3 GPIO |
|---|---|
| SCK (SPI clock) | GPIO 12 |
| MOSI (SPI data) | GPIO 11 |
| CS (chip select) | GPIO 45 |
| DC (data/command) | GPIO 46 |
| RES (reset) | GPIO 47 |
| BUSY | GPIO 48 |

Free GPIOs on the 2×10 header: typically GPIO 1–10 and 17–21. Don't need to
touch any of these for the basic charge-level display.

## Files Claude will touch

To complete this setup, Claude should:

1. Download and unzip the Elecrow library.
2. Create the sketch folder with the 7 support files + our `.ino`.
3. Walk the user through Arduino IDE board settings (can't automate — physical
   dropdown menus).
4. Verify upload succeeds (Claude can read Serial Monitor output if they set
   up a serial-reading command).
5. Install `pyserial requests` via pip.
6. Run `charge_sender.py --list` to show ports, then `--test 42` to verify
   the full pipeline.

Nothing else needs writing or editing. The firmware and Python script are
complete as-is.

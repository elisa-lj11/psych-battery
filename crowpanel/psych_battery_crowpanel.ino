/*
 * Psych_Battery — CrowPanel ESP32-S3 5.79" E-Paper Firmware
 * Hardware: ELECROW CrowPanel DIS08792E (dual SSD1683, 792x272 B/W)
 *
 * MODE: Serial (USB) only — no WiFi needed.
 * Send a number 0-100 over Serial at 115200 baud to update the display.
 * The Python script charge_sender.py does this automatically from the model.
 *
 * FILE STRUCTURE — put these files in the same sketch folder:
 *   psych_battery_crowpanel.ino  ← this file
 *   EPD.h / EPD.cpp              ← from example/arduino/Demos/5.79_WIFI_refresh/
 *   EPD_Init.h / EPD_Init.cpp    ← same source folder
 *   EPDfont.h                    ← same source folder (this is the fonts file)
 *   spi.h / spi.cpp              ← same source folder
 *   (do NOT copy Ap_29demo.h — demo bitmap, not needed)
 *   (do NOT look for GUI_Paint.h — that's a different library, doesn't exist here)
 *
 * To send data from Python:
 *   import serial
 *   ser = serial.Serial('COM3', 115200)   # adjust port (COMx on Windows, /dev/tty... on Mac)
 *   ser.write(b'75\n')                    # send any integer 0-100
 */

#include "EPD.h"        // Includes EPD_Init.h internally; all drawing functions here
#include "EPDfont.h"    // Font bitmaps (8, 12, 16, 24, 48 px)

// ── Display dimensions ──────────────────────────────────────────────────────
// EPD_W is 800 (not 792!) — the dual-SSD1683 design uses 800 for address
// alignment. The actual visible area is still 792 pixels wide.
// EPD_H and EPD_W are already defined in EPD_Init.h, but restated here for clarity.
// #define EPD_W 800
// #define EPD_H 272

// Framebuffer: 800 * 272 / 8 = 27200 bytes
uint8_t ImageBW[27200];

// ── Battery layout constants ─────────────────────────────────────────────────
const int BX   = 40;    // battery body left edge (x)
const int BY   = 50;    // battery body top edge (y)
const int BW   = 680;   // battery body width
const int BH   = 172;   // battery body height
const int PAD  = 8;     // inner fill padding
const int NUB  = 22;    // terminal nub width

// ── State ─────────────────────────────────────────────────────────────────────
int  currentCharge  = 100;
bool needsRedraw    = true;
int  refreshCount   = 0;

// ── Forward declarations ───────────────────────────────────────────────────────
void drawChargeBar(int pct);
void fullRefresh();
void fastRefresh();

// ── setup ──────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("Psych_Battery CrowPanel ready. Send 0-100 over Serial.");

  // Initialize display and show 100% on boot
  EPD_Init();
  Paint_NewImage(ImageBW, EPD_W, EPD_H, 0, WHITE);
  Paint_Clear(WHITE);
  drawChargeBar(currentCharge);
  EPD_Display(ImageBW);
  EPD_Update();
  EPD_DeepSleep();
}

// ── loop ───────────────────────────────────────────────────────────────────────
void loop() {
  // Read charge level from Serial
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      int val = line.toInt();
      if (val >= 0 && val <= 100 && val != currentCharge) {
        currentCharge = val;
        needsRedraw   = true;
        Serial.print("ACK ");
        Serial.println(currentCharge);
      }
    }
  }

  if (needsRedraw) {
    Paint_Clear(WHITE);
    drawChargeBar(currentCharge);

    // Full refresh every 10 draws to clear ghosting; fast otherwise
    refreshCount++;
    if (refreshCount % 10 == 0) {
      fullRefresh();
    } else {
      fastRefresh();
    }
    needsRedraw = false;
  }
}

// ── Display helpers ────────────────────────────────────────────────────────────

void fullRefresh() {
  EPD_Init();
  EPD_Display(ImageBW);
  EPD_Update();
  EPD_DeepSleep();
}

void fastRefresh() {
  EPD_FastMode1Init();
  EPD_Display(ImageBW);
  EPD_FastUpdate();
  EPD_DeepSleep();
}

// ── Battery drawing ────────────────────────────────────────────────────────────

void drawChargeBar(int pct) {
  pct = constrain(pct, 0, 100);
  bool isAlert = (pct < 20);

  if (isAlert) {
    // Alert mode: invert — black background, white elements
    Paint_Clear(BLACK);

    // Battery outline in white
    EPD_DrawRectangle(BX, BY, BX + BW, BY + BH, WHITE, 0);

    // Terminal nub
    EPD_DrawRectangle(BX + BW, BY + 50, BX + BW + NUB, BY + BH - 50, WHITE, 1);

    // Fill bar (white)
    int fillW = (BW - PAD * 2) * pct / 100;
    if (fillW > 0) {
      EPD_DrawRectangle(BX + PAD, BY + PAD, BX + PAD + fillW, BY + BH - PAD, WHITE, 1);
    }

    // Percentage — large, centered in battery
    // EPD_ShowNum: (x, y, number, digits, font_size, color)
    char buf[4];
    snprintf(buf, sizeof(buf), "%d", pct);
    int textX = BX + BW / 2 - (strlen(buf) * 24 + 12) / 2;  // rough center for 48px font
    EPD_ShowNum(textX, BY + BH / 2 - 24, pct, 3, 48, WHITE);
    EPD_ShowString(textX + strlen(buf) * 24, BY + BH / 2 - 24, "%", 48, WHITE);

    // "RECHARGE" label below battery
    EPD_ShowString(BX + BW / 2 - 72, BY + BH + 10, "RECHARGE", 16, WHITE);

  } else {
    // Normal mode: black on white
    // Battery outline
    EPD_DrawRectangle(BX, BY, BX + BW, BY + BH, BLACK, 0);

    // Terminal nub (filled, black)
    EPD_DrawRectangle(BX + BW, BY + 50, BX + BW + NUB, BY + BH - 50, BLACK, 1);

    // Fill bar
    int fillW = (BW - PAD * 2) * pct / 100;
    if (fillW > 0) {
      EPD_DrawRectangle(BX + PAD, BY + PAD, BX + PAD + fillW, BY + BH - PAD, BLACK, 1);
    }

    // Percentage — centered in the battery body
    // Use white text if fill extends past center, black otherwise
    int centerX = BX + BW / 2;
    int fillRight = BX + PAD + fillW;
    uint16_t textColor = (fillRight > centerX - 20) ? WHITE : BLACK;

    char buf[4];
    snprintf(buf, sizeof(buf), "%d", pct);
    int numW  = strlen(buf) * 24;   // approx width at size 48 (24px per char)
    int unitW = 12;                 // "%" width at size 48
    int totalW = numW + unitW;
    int textX  = centerX - totalW / 2;

    EPD_ShowNum(textX, BY + BH / 2 - 24, pct, 3, 48, textColor);
    EPD_ShowString(textX + numW, BY + BH / 2 - 24, "%", 48, textColor);
  }
}

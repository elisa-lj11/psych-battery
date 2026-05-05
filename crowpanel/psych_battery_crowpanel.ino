/*
 * Psych_Battery — CrowPanel ESP32-S3 5.79" E-Paper Firmware
 * Hardware: ELECROW CrowPanel DIS08792E (dual SSD1683, 792x272 B/W)
 *
 * MODE: Serial (USB) only — no WiFi needed.
 * Send "NN trend status\n" over Serial at 115200 baud to update the display.
 * trend: up | down | flat
 * status: live | stale | offline
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
 *   ser.write(b'75 up live\n')            # "NN trend status"
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

// ── Arrow constants ───────────────────────────────────────────────────────────
// Solid filled triangle placed below the battery, centered.
// ARROW_W is the half-width at the base; full base = 2*ARROW_W.
const int ARROW_CX = BX + BW / 2;  // x center
const int ARROW_Y  = BY + BH + 10; // top of the arrow zone
const int ARROW_H  = 30;           // triangle height in pixels
const int ARROW_W  = 38;           // triangle half-width (base = 76px)

// ── State ─────────────────────────────────────────────────────────────────────
int  currentCharge  = 100;
char currentTrend[8] = "flat";   // "up" | "down" | "flat"
bool needsRedraw    = true;
int  refreshCount   = 0;

// ── Forward declarations ───────────────────────────────────────────────────────
void drawChargeBar(int pct, const char* trend);
void drawFilledTriangle(int x0, int y0, int x1, int y1, int x2, int y2, uint16_t color);
void drawTrendArrow(const char* trend, uint16_t color);
void fullRefresh();
void fastRefresh();

// ── setup ──────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("Psych_Battery CrowPanel ready. Send \"NN trend status\" over Serial.");

  EPD_Init();
  Paint_NewImage(ImageBW, EPD_W, EPD_H, 0, WHITE);
  Paint_Clear(WHITE);
  drawChargeBar(currentCharge, currentTrend);
  EPD_Display(ImageBW);
  EPD_Update();
  EPD_DeepSleep();
}

// ── loop ───────────────────────────────────────────────────────────────────────
void loop() {
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      // Parse: "NN trend status"
      char trendBuf[16]  = "flat";
      char statusBuf[16] = "offline";
      int  val           = 0;
      sscanf(line.c_str(), "%d %15s %15s", &val, trendBuf, statusBuf);

      if (val >= 0 && val <= 100) {
        bool changed = (val != currentCharge) || (strcmp(trendBuf, currentTrend) != 0);
        currentCharge = val;
        strncpy(currentTrend, trendBuf, sizeof(currentTrend) - 1);
        currentTrend[sizeof(currentTrend) - 1] = '\0';
        if (changed) needsRedraw = true;
        Serial.print("ACK ");
        Serial.print(currentCharge);
        Serial.print(" ");
        Serial.println(currentTrend);
      }
    }
  }

  if (needsRedraw) {
    Paint_Clear(WHITE);
    drawChargeBar(currentCharge, currentTrend);

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

// ── Filled triangle via horizontal scan lines ─────────────────────────────────
// Vertices can be in any order; they are sorted by y internally.
void drawFilledTriangle(int x0, int y0, int x1, int y1, int x2, int y2, uint16_t color) {
  // Sort by y: y0 <= y1 <= y2
  if (y0 > y1) { int t; t=x0;x0=x1;x1=t; t=y0;y0=y1;y1=t; }
  if (y0 > y2) { int t; t=x0;x0=x2;x2=t; t=y0;y0=y2;y2=t; }
  if (y1 > y2) { int t; t=x1;x1=x2;x2=t; t=y1;y1=y2;y2=t; }

  int totalH = y2 - y0;
  if (totalH == 0) return;

  for (int y = y0; y <= y2; y++) {
    bool lowerHalf = (y >= y1) || (y1 == y0);
    int segH = lowerHalf ? y2 - y1 : y1 - y0;
    if (segH == 0) segH = 1;

    // ax: interpolate along the long edge (y0→y2)
    int ax = x0 + (int)((long)(x2 - x0) * (y - y0) / totalH);
    // bx: interpolate along the short edge (y0→y1 or y1→y2)
    int bx = lowerHalf
      ? x1 + (int)((long)(x2 - x1) * (y - y1) / segH)
      : x0 + (int)((long)(x1 - x0) * (y - y0) / segH);

    if (ax > bx) { int t = ax; ax = bx; bx = t; }
    EPD_DrawLine(ax, y, bx, y, color);
  }
}

// ── Trend arrow ───────────────────────────────────────────────────────────────
// Draws a solid filled triangle below the battery.
//   up   → ▲ (apex at top, base at bottom)
//   down → ▼ (apex at bottom, base at top)
//   flat → ━ (thin filled rectangle)
void drawTrendArrow(const char* trend, uint16_t color) {
  int cx = ARROW_CX;
  int y0 = ARROW_Y;
  int y1 = ARROW_Y + ARROW_H;

  if (strcmp(trend, "up") == 0) {
    // Apex top-center, base bottom-left + bottom-right
    drawFilledTriangle(cx, y0, cx - ARROW_W, y1, cx + ARROW_W, y1, color);

  } else if (strcmp(trend, "down") == 0) {
    // Apex bottom-center, base top-left + top-right
    drawFilledTriangle(cx, y1, cx - ARROW_W, y0, cx + ARROW_W, y0, color);

  } else {
    // Flat: a squat filled rectangle centered vertically in the arrow zone
    int barH  = 10;
    int barMid = y0 + ARROW_H / 2;
    EPD_DrawRectangle(
      cx - ARROW_W, barMid - barH / 2,
      cx + ARROW_W, barMid + barH / 2,
      color, 1
    );
  }
}

// ── Battery drawing ────────────────────────────────────────────────────────────

void drawChargeBar(int pct, const char* trend) {
  pct = constrain(pct, 0, 100);
  bool isAlert = (pct < 20);

  if (isAlert) {
    // Alert mode: invert — black background, white elements
    Paint_Clear(BLACK);

    EPD_DrawRectangle(BX, BY, BX + BW, BY + BH, WHITE, 0);
    EPD_DrawRectangle(BX + BW, BY + 50, BX + BW + NUB, BY + BH - 50, WHITE, 1);

    int fillW = (BW - PAD * 2) * pct / 100;
    if (fillW > 0) {
      EPD_DrawRectangle(BX + PAD, BY + PAD, BX + PAD + fillW, BY + BH - PAD, WHITE, 1);
    }

    char buf[4];
    snprintf(buf, sizeof(buf), "%d", pct);
    int textX = BX + BW / 2 - (strlen(buf) * 24 + 12) / 2;
    EPD_ShowNum(textX, BY + BH / 2 - 24, pct, 3, 48, WHITE);
    EPD_ShowString(textX + strlen(buf) * 24, BY + BH / 2 - 24, "%", 48, WHITE);

    EPD_ShowString(BX + BW / 2 - 72, BY + BH + 10, "RECHARGE", 16, WHITE);

  } else {
    // Normal mode: black on white
    EPD_DrawRectangle(BX, BY, BX + BW, BY + BH, BLACK, 0);
    EPD_DrawRectangle(BX + BW, BY + 50, BX + BW + NUB, BY + BH - 50, BLACK, 1);

    int fillW = (BW - PAD * 2) * pct / 100;
    if (fillW > 0) {
      EPD_DrawRectangle(BX + PAD, BY + PAD, BX + PAD + fillW, BY + BH - PAD, BLACK, 1);
    }

    int centerX  = BX + BW / 2;
    int fillRight = BX + PAD + fillW;
    uint16_t textColor = (fillRight > centerX - 20) ? WHITE : BLACK;

    char buf[4];
    snprintf(buf, sizeof(buf), "%d", pct);
    int numW   = strlen(buf) * 24;
    int unitW  = 12;
    int totalW = numW + unitW;
    int textX  = centerX - totalW / 2;

    EPD_ShowNum(textX, BY + BH / 2 - 24, pct, 3, 48, textColor);
    EPD_ShowString(textX + numW, BY + BH / 2 - 24, "%", 48, textColor);

    // Trend arrow below battery (black on white)
    drawTrendArrow(trend, BLACK);
  }
}

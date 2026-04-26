/*
 * Psych Battery - CrowPanel ESP32-S3 5.79" E-Paper Firmware
 *
 * Minimal recovery display: show only the current charge as "NN%".
 * Send an integer 0-100 over USB Serial at 115200 baud.
 * The bridge may send "NN trend"; toInt() reads the leading number.
 */

#include "EPD.h"
#include "EPDfont.h"

uint8_t ImageBW[27200];  // 800 * 272 / 8

int    currentCharge = 100;
String currentTrend  = "flat";
bool   needsRedraw   = true;

void drawBattery(int pct, const String& trend);
void drawPercentRotatedCCW(int x, int y, int pct, uint16_t color);
void drawTrendArrow(const String& trend, int x, int y, uint16_t color);
void fullRefresh();

void setup() {
  Serial.begin(115200);

  pinMode(7, OUTPUT);
  digitalWrite(7, HIGH);
  EPD_GPIOInit();

  Paint_NewImage(ImageBW, EPD_W, EPD_H, 0, WHITE);
  Paint_Clear(WHITE);

  EPD_FastMode1Init();
  EPD_Display_Clear();
  EPD_Update();

  drawBattery(currentCharge, currentTrend);
  fullRefresh();
  needsRedraw = false;

  delay(200);
  Serial.println("Psych_Battery CrowPanel ready. Send '0-100 up|down|flat' over Serial.");
}

void loop() {
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();

    if (line.length() > 0) {
      int spaceIdx = line.indexOf(' ');
      int val = line.toInt();
      String trend = "flat";

      if (spaceIdx > 0) {
        trend = line.substring(spaceIdx + 1);
        trend.trim();
      }

      if (val >= 0 && val <= 100) {
        currentCharge = val;
        currentTrend = trend;
        needsRedraw = true;
        Serial.print("ACK ");
        Serial.println(currentCharge);
      }
    }
  }

  if (needsRedraw) {
    Paint_Clear(WHITE);
    drawBattery(currentCharge, currentTrend);
    fullRefresh();
    needsRedraw = false;
  }
}

void fullRefresh() {
  EPD_GPIOInit();
  EPD_Init();
  EPD_Display(ImageBW);
  EPD_Update();
  EPD_DeepSleep();
}

void drawBattery(int pct, const String& trend) {
  pct = constrain(pct, 0, 100);

  const int bx = 64;
  const int by = 28;
  const int bw = 672;
  const int bh = 216;
  const int nubW = 32;
  const int pad = 10;

  EPD_DrawRectangle(bx, by, bx + bw, by + bh, BLACK, 0);
  EPD_DrawRectangle(bx - nubW, by + 64, bx, by + bh - 64, BLACK, 1);

  int fillW = (bw - pad * 2) * pct / 100;
  if (fillW > 0) {
    EPD_DrawRectangle(bx + bw - pad - fillW, by + pad, bx + bw - pad, by + bh - pad, BLACK, 1);
  }

  char buf[4];
  snprintf(buf, sizeof(buf), "%d", pct);

  int numDigits = strlen(buf);
  int percentBlockH = numDigits * 24 + 12;
  int textX = bx + bw / 2 - 48;
  int textY = by + bh / 2 - percentBlockH / 2;

  drawPercentRotatedCCW(textX, textY, pct, BLACK);
  drawTrendArrow(trend, textX + 96, by + bh / 2 - 24, BLACK);
}

void drawTrendArrow(const String& trend, int x, int y, uint16_t color) {
  if (trend == "up") {
    EPD_ShowString(x, y, "<", 48, color);
  } else if (trend == "down") {
    EPD_ShowString(x, y, ">", 48, color);
  }
}

uint16_t fontByte(char chr, uint16_t size, uint16_t idx) {
  uint16_t chrIdx = chr - ' ';
  if (size == 12) return ascii_1206[chrIdx][idx];
  if (size == 16) return ascii_1608[chrIdx][idx];
  if (size == 24) return ascii_2412[chrIdx][idx];
  if (size == 48) return ascii_4824[chrIdx][idx];
  return 0;
}

void setPixelSafe(int x, int y, uint16_t color) {
  if (x < 0 || x >= 792 || y < 0 || y >= EPD_H) return;
  if (x >= 396) x += 8;
  if (x < 0 || x >= EPD_W) return;

  uint32_t addr = x / 8 + y * (EPD_W / 8);
  uint8_t mask = 0x80 >> (x % 8);
  if (color == BLACK) {
    ImageBW[addr] &= ~mask;
  } else {
    ImageBW[addr] |= mask;
  }
}

void drawCharRotatedCCW(int dstX, int dstY, int srcX, int srcY, int blockW,
                        char chr, uint16_t size, uint16_t color) {
  uint16_t charW = size / 2;
  uint16_t byteCount = (size / 8 + ((size % 8) ? 1 : 0)) * charW;

  for (uint16_t i = 0; i < byteCount; i++) {
    uint16_t temp = fontByte(chr, size, i);
    uint16_t col = i % charW;
    uint16_t rowBase = (i / charW) * 8;

    for (uint16_t bit = 0; bit < 8 && rowBase + bit < size; bit++) {
      int px = srcX + col;
      int py = srcY + rowBase + bit;
      int rx = dstX + py;
      int ry = dstY + blockW - 1 - px;

      setPixelSafe(rx, ry, (temp & 0x01) ? color : !color);
      temp >>= 1;
    }
  }
}

void drawPercentRotatedCCW(int x, int y, int pct, uint16_t color) {
  char num[4];
  snprintf(num, sizeof(num), "%d", pct);

  int numDigits = strlen(num);
  int numW = numDigits * 24;
  int unitW = 12;
  int blockW = numW + unitW;

  for (int i = 0; i < numDigits; i++) {
    drawCharRotatedCCW(x, y, i * 24, 0, blockW, num[i], 48, color);
  }
  drawCharRotatedCCW(x, y, numW, 12, blockW, '%', 24, color);
}

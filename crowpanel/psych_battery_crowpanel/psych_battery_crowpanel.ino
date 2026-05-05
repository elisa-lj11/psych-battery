/*
 * Psych Battery - CrowPanel ESP32-S3 5.79" E-Paper Firmware
 *
 * Minimal recovery display: show only the current charge as "NN%".
 * Send an integer 0-100 over USB Serial at 115200 baud.
 * The bridge may send "NN trend status" (for example: "53 flat live").
 */

#include "EPD.h"
#include "EPDfont.h"

uint8_t ImageBW[27200];  // 800 * 272 / 8

int    currentCharge = 100;
String currentTrend  = "flat";
unsigned long lastPacketAtMs = 0;
bool   needsRedraw   = true;
int    g_fillW       = 0;  // right-edge of fill; pixels at x >= (EPD_W - g_fillW) are black

#define LED_R 15  // Red anode
#define LED_G 17  // Green anode
#define LED_B 21  // Blue anode

const unsigned long OFFLINE_TIMEOUT_MS = 60UL * 1000UL;

enum SyncStatus {
  STATUS_OFFLINE = 0,
  STATUS_STALE = 1,
  STATUS_LIVE = 2
};

SyncStatus currentStatus = STATUS_OFFLINE;

void drawBattery(int pct, const String& trend);
void drawPercentRotatedCCW(int x, int y, int pct);
void drawTrendArrow(const String& trend, int x, int y);
void drawCharRotatedCCW(int dstX, int dstY, int srcX, int srcY, int blockW, char chr, uint16_t size);
void fullRefresh();
SyncStatus parseStatusToken(const String& token);
const char* statusName(SyncStatus status);
void writeLedPins(bool redOn, bool greenOn, bool blueOn);
void updateStatusLed();
bool parseSerialPayload(const String& line, int& chargeOut, String& trendOut, SyncStatus& statusOut);

void setup() {
  Serial.begin(115200);

  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  updateStatusLed();

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
  Serial.println("Psych_Battery CrowPanel ready. Send '0-100 up|down|flat live|stale|offline' over Serial.");
}

void loop() {
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();

    if (line.length() > 0) {
      int nextCharge = currentCharge;
      String nextTrend = currentTrend;
      SyncStatus nextStatus = currentStatus;

      if (parseSerialPayload(line, nextCharge, nextTrend, nextStatus)) {
        bool chargeChanged = nextCharge != currentCharge;
        bool trendChanged = nextTrend != currentTrend;
        currentCharge = nextCharge;
        currentTrend = nextTrend;
        currentStatus = nextStatus;
        lastPacketAtMs = millis();
        needsRedraw = needsRedraw || chargeChanged || trendChanged;
        Serial.print("ACK ");
        Serial.print(currentCharge);
        Serial.print(" ");
        Serial.println(statusName(currentStatus));
      }
    }
  }

  updateStatusLed();

  if (needsRedraw) {
    Paint_Clear(WHITE);
    drawBattery(currentCharge, currentTrend);
    fullRefresh();
    needsRedraw = false;
  }
}

SyncStatus parseStatusToken(const String& token) {
  if (token == "live") return STATUS_LIVE;
  if (token == "stale") return STATUS_STALE;
  return STATUS_OFFLINE;
}

const char* statusName(SyncStatus status) {
  switch (status) {
    case STATUS_LIVE:
      return "live";
    case STATUS_STALE:
      return "stale";
    default:
      return "offline";
  }
}

void writeLedPins(bool redOn, bool greenOn, bool blueOn) {
  digitalWrite(LED_R, redOn ? HIGH : LOW);
  digitalWrite(LED_G, greenOn ? HIGH : LOW);
  digitalWrite(LED_B, blueOn ? HIGH : LOW);
}

void updateStatusLed() {
  SyncStatus effectiveStatus = currentStatus;
  if (lastPacketAtMs == 0 || (millis() - lastPacketAtMs) > OFFLINE_TIMEOUT_MS) {
    effectiveStatus = STATUS_OFFLINE;
  }

  switch (effectiveStatus) {
    case STATUS_LIVE:
      writeLedPins(false, true, false);  // GREEN
      break;
    case STATUS_STALE:
      writeLedPins(true, true, false);   // AMBER = R + G
      break;
    default:
      writeLedPins(true, false, false);  // RED
      break;
  }
}

bool parseSerialPayload(const String& line, int& chargeOut, String& trendOut, SyncStatus& statusOut) {
  int value = line.toInt();
  if (value < 0 || value > 100) {
    return false;
  }

  int firstSpace = line.indexOf(' ');
  int secondSpace = firstSpace >= 0 ? line.indexOf(' ', firstSpace + 1) : -1;

  trendOut = "flat";
  statusOut = currentStatus;

  if (firstSpace > 0) {
    if (secondSpace > firstSpace) {
      trendOut = line.substring(firstSpace + 1, secondSpace);
    } else {
      trendOut = line.substring(firstSpace + 1);
    }
    trendOut.trim();
  }

  if (secondSpace > firstSpace) {
    String statusToken = line.substring(secondSpace + 1);
    statusToken.trim();
    statusOut = parseStatusToken(statusToken);
  }

  chargeOut = value;
  return true;
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

  // Fill from right edge — drains left as pct decreases
  int fillW = (long)EPD_W * pct / 100;
  g_fillW = fillW;
  if (fillW > 0) {
    EPD_DrawRectangle(EPD_W - fillW, 0, EPD_W, EPD_H, BLACK, 1);
  }

  char buf[4];
  snprintf(buf, sizeof(buf), "%d", pct);
  int numDigits = strlen(buf);
  int percentBlockH = numDigits * 24 + 12;
  int textX = EPD_W / 2 - 48;
  int textY = EPD_H / 2 - percentBlockH / 2;

  drawPercentRotatedCCW(textX, textY, pct);
  drawTrendArrow(trend, textX + 96, EPD_H / 2 - 24);
}

// Solid filled triangle via horizontal scan lines in buffer space.
// Vertices are in buffer (bx, by) coordinates.
void drawFilledTriangleBuf(int x0, int y0, int x1, int y1, int x2, int y2) {
  // Sort by buffer-y (y0 <= y1 <= y2) so scan goes top-to-bottom in buffer-y.
  if (y0 > y1) { int t; t=x0;x0=x1;x1=t; t=y0;y0=y1;y1=t; }
  if (y0 > y2) { int t; t=x0;x0=x2;x2=t; t=y0;y0=y2;y2=t; }
  if (y1 > y2) { int t; t=x1;x1=x2;x2=t; t=y1;y1=y2;y2=t; }
  int totalH = y2 - y0;
  if (totalH == 0) return;
  for (int by = y0; by <= y2; by++) {
    bool lower = (by >= y1) || (y1 == y0);
    int segH = lower ? y2 - y1 : y1 - y0;
    if (segH == 0) segH = 1;
    int ax = x0 + (int)((long)(x2 - x0) * (by - y0) / totalH);
    int bx = lower
      ? x1 + (int)((long)(x2 - x1) * (by - y1) / segH)
      : x0 + (int)((long)(x1 - x0) * (by - y0) / segH);
    if (ax > bx) { int t = ax; ax = bx; bx = t; }
    // Fill-aware: pixels in the charged region use WHITE on black, others BLACK on white
    for (int px = ax; px <= bx; px++) {
      uint16_t col = (px >= EPD_W - g_fillW) ? WHITE : BLACK;
      setPixelSafe(px, by, col);
    }
  }
}

// Draw solid trend arrow. Display is CCW-rotated, so buffer-x maps to physical-down.
// "up" (energy rising)  → physical UP = increasing buffer-x → ► in buffer
// "down" (energy falling) → physical DOWN = decreasing buffer-x → ◄ in buffer
// "flat" → horizontal bar (= vertical bar on physical display)
void drawTrendArrow(const String& trend, int x, int y) {
  const int H  = 44;   // span in buffer-x direction (= physical height of arrow)
  const int HW = 20;   // half-width in buffer-y direction (base = 40px physical width)
  int midY = y + HW;   // buffer-y center of the arrow block

  if (trend == "up") {
    // ► in buffer: apex right, base left
    drawFilledTriangleBuf(x + H, midY, x, midY - HW, x, midY + HW);
  } else if (trend == "down") {
    // ◄ in buffer: apex left, base right
    drawFilledTriangleBuf(x, midY, x + H, midY - HW, x + H, midY + HW);
  } else {
    // Flat: short horizontal bar in buffer (= vertical bar on physical)
    int barX0 = x + H / 4, barX1 = x + 3 * H / 4;
    int barY0 = midY - 5, barY1 = midY + 5;
    for (int px = barX0; px <= barX1; px++) {
      for (int py = barY0; py <= barY1; py++) {
        uint16_t col = (px >= EPD_W - g_fillW) ? WHITE : BLACK;
        setPixelSafe(px, py, col);
      }
    }
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
                        char chr, uint16_t size) {
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

      if (temp & 0x01) setPixelSafe(rx, ry, (rx >= EPD_W - g_fillW) ? WHITE : BLACK);
      temp >>= 1;
    }
  }
}

void drawPercentRotatedCCW(int x, int y, int pct) {
  char num[4];
  snprintf(num, sizeof(num), "%d", pct);

  int numDigits = strlen(num);
  int numW = numDigits * 24;
  int unitW = 12;
  int blockW = numW + unitW;

  for (int i = 0; i < numDigits; i++) {
    drawCharRotatedCCW(x, y, i * 24, 0, blockW, num[i], 48);
  }
  drawCharRotatedCCW(x, y, numW, 12, blockW, '%', 24);
}

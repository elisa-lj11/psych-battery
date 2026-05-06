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
int    g_fillW       = 0;  // visual fill width (0-792); pixels at x >= (792 - g_fillW) are black

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
void setLedColor(uint8_t r, uint8_t g, uint8_t b);
void updateStatusLed();
bool parseSerialPayload(const String& line, int& chargeOut, String& trendOut, SyncStatus& statusOut);

void setup() {
  Serial.begin(115200);

  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);

  // Startup flash: R → G → B
  setLedColor(255, 0, 0);  delay(200);
  setLedColor(0, 255, 0);  delay(200);
  setLedColor(0, 0, 255);  delay(200);
  setLedColor(0, 0, 0);

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

void setLedColor(uint8_t r, uint8_t g, uint8_t b) {
  analogWrite(LED_R, r);
  analogWrite(LED_G, g);
  analogWrite(LED_B, b);
}

void updateStatusLed() {
  // Map charge 0–100 to hue 0–191 (red → orange → yellow → green → cyan → blue → violet)
  // H in 0–255 spans 360°; 191 ≈ 270° so 100% lands near blue-purple.
  uint8_t h = (uint8_t)((long)currentCharge * 191 / 100);
  uint8_t region = h / 43;
  uint8_t f = (h % 43) * 6;  // 0–255 progress within region
  uint8_t r, g, b;
  switch (region) {
    case 0: r = 255;       g = f;         b = 0;         break; // red → yellow
    case 1: r = 255 - f;   g = 255;       b = 0;         break; // yellow → green
    case 2: r = 0;         g = 255;       b = f;         break; // green → cyan
    case 3: r = 0;         g = 255 - f;   b = 255;       break; // cyan → blue
    default: r = f;        g = 0;         b = 255;       break; // blue → violet
  }
  setLedColor(r, g, b);
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
  int fillW = (long)792 * pct / 100;
  g_fillW = fillW;
  if (fillW > 0) {
    EPD_DrawRectangle(792 - fillW, 0, 791, EPD_H, BLACK, 1);
  }

  char buf[4];
  snprintf(buf, sizeof(buf), "%d", pct);
  int numDigits = strlen(buf);
  int blockW = numDigits * 24 + 12;  // buffer-y span of "NN%"

  // Number at buffer-x 132 (~80% down display). Lower buffer-x = physically above.
  // "up" arrow above number (buffer-x 56), "down"/"flat" below (buffer-x 188).
  drawPercentRotatedCCW(132, EPD_H / 2 - blockW / 2, pct);
  int arrowX = (trend == "up") ? 56 : 188;
  drawTrendArrow(trend, arrowX, EPD_H / 2 - 20);
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
      uint16_t col = (px >= 792 - g_fillW) ? WHITE : BLACK;
      setPixelSafe(px, by, col);
    }
  }
}

// Draw solid trend arrow.
// "up"   → ▲ physically: ◄ in buffer (apex at low bx), placed above number
// "down" → ▼ physically: ► in buffer (apex at high bx), placed below number
void drawTrendArrow(const String& trend, int x, int y) {
  const int H  = 44;   // span in buffer-x direction
  const int HW = 20;   // half-width in buffer-y direction (base = 40px)
  int midY = y + HW;

  if (trend == "up") {
    // ◄ in buffer → ▲ on display
    drawFilledTriangleBuf(x, midY, x + H, midY - HW, x + H, midY + HW);
  } else if (trend == "down") {
    // ► in buffer → ▼ on display
    drawFilledTriangleBuf(x + H, midY, x, midY - HW, x, midY + HW);
  }
  // flat: no arrow
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

      if (temp & 0x01) setPixelSafe(rx, ry, (rx >= 792 - g_fillW) ? WHITE : BLACK);
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

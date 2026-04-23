#include <GxEPD2_BW.h>
#include <SPI.h>

#define PWR_PIN    7
#define NUM_HEARTS 8
#define DEMO_PCT   62   // hardcoded for now — will wire to server later

GxEPD2_BW<GxEPD2_579_GDEY0579T93, GxEPD2_579_GDEY0579T93::HEIGHT>
  display(GxEPD2_579_GDEY0579T93(/*CS*/45, /*DC*/46, /*RST*/47, /*BUSY*/48));

// Portrait canvas after rotation(1): 272 wide x 792 tall
static const int16_t CW = 272, CH = 792;

// ── Drawing primitives ──────────────────────────────────────────────────────

void drawFilledHeart(int16_t cx, int16_t cy, int16_t r) {
  int16_t cr = r / 2;
  display.fillCircle(cx - cr, cy - cr / 2, cr + 1, GxEPD_BLACK);
  display.fillCircle(cx + cr, cy - cr / 2, cr + 1, GxEPD_BLACK);
  display.fillTriangle(cx - r, cy, cx + r, cy, cx, cy + r + cr / 2, GxEPD_BLACK);
}

void drawOutlineHeart(int16_t cx, int16_t cy, int16_t r) {
  int16_t cr = r / 2;
  display.drawCircle(cx - cr, cy - cr / 2, cr + 1, GxEPD_BLACK);
  display.drawCircle(cx + cr, cy - cr / 2, cr + 1, GxEPD_BLACK);
  display.drawLine(cx - r + 2, cy, cx, cy + r + cr / 2, GxEPD_BLACK);
  display.drawLine(cx + r - 2, cy, cx, cy + r + cr / 2, GxEPD_BLACK);
}

void drawSmiley(int16_t cx, int16_t cy, int16_t r) {
  // Square pixel-art eyes
  int16_t ew = 5;
  display.fillRect(cx - r / 3 - ew / 2, cy - r / 5 - ew / 2, ew, ew, GxEPD_BLACK);
  display.fillRect(cx + r / 3 - ew / 2, cy - r / 5 - ew / 2, ew, ew, GxEPD_BLACK);
  // V-shaped smile
  int16_t my = cy + r / 6, mw = r / 2;
  display.drawLine(cx - mw, my,     cx, my + r / 5,     GxEPD_BLACK);
  display.drawLine(cx,      my + r / 5, cx + mw, my,    GxEPD_BLACK);
  display.drawLine(cx - mw, my + 1, cx, my + r / 5 + 1, GxEPD_BLACK);
  display.drawLine(cx,      my + r / 5 + 1, cx + mw, my + 1, GxEPD_BLACK);
}

// ── Main scene ──────────────────────────────────────────────────────────────

void drawScene(int pct) {
  display.fillScreen(GxEPD_WHITE);

  int16_t margin = 30;
  int16_t top    = 40;
  int16_t bot    = CH - 40;

  // ── Hearts — left column ──────────────────────────────────────────────
  int16_t heartR  = 19;
  int16_t heartCX = CW / 4;
  int16_t hGap    = (bot - top) / (NUM_HEARTS - 1);
  int     filled  = (int)round(pct / 100.0 * NUM_HEARTS);

  for (int i = 0; i < NUM_HEARTS; i++) {
    int16_t hy = top + i * hGap;
    bool f = (i >= NUM_HEARTS - filled);
    if (f) drawFilledHeart(heartCX, hy, heartR);
    else   drawOutlineHeart(heartCX, hy, heartR);
  }

  // ── Spoon/thermometer — right column ──────────────────────────────────
  int16_t spX     = (CW * 3) / 4;
  int16_t spR     = 36;
  int16_t spHeadY = top + spR;

  // Spoon head (double-stroke circle)
  display.drawCircle(spX, spHeadY, spR,     GxEPD_BLACK);
  display.drawCircle(spX, spHeadY, spR - 1, GxEPD_BLACK);
  drawSmiley(spX, spHeadY, spR);

  // Stem outline (double-stroke)
  int16_t stemW = 24;
  int16_t stemX = spX - stemW / 2;
  int16_t stemT = spHeadY + spR;
  int16_t stemB = bot;
  int16_t stemH = stemB - stemT;
  display.drawRect(stemX,     stemT, stemW,     stemH, GxEPD_BLACK);
  display.drawRect(stemX + 1, stemT, stemW - 2, stemH, GxEPD_BLACK);

  // Fill from bottom based on pct
  if (pct > 0) {
    int16_t fillH = max((int16_t)2, (int16_t)((stemH - 4) * pct / 100));
    display.fillRect(stemX + 3, stemB - fillH, stemW - 6, fillH, GxEPD_BLACK);
  }
}

// ── Entry point ─────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);

  pinMode(PWR_PIN, OUTPUT);
  digitalWrite(PWR_PIN, HIGH);
  delay(100);

  SPI.begin(/*SCK*/12, /*MISO*/-1, /*MOSI*/11, /*SS*/45);
  display.init(115200, true, 2, false);
  display.setRotation(1); // portrait: 272 wide x 792 tall

  display.setFullWindow();
  display.firstPage();
  do {
    drawScene(DEMO_PCT);
  } while (display.nextPage());
}

void loop() {}

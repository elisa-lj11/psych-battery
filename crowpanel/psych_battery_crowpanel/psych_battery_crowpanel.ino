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

int  currentCharge = 100;
bool needsRedraw   = true;

void drawPercent(int pct);
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

  drawPercent(currentCharge);
  fullRefresh();
  needsRedraw = false;

  delay(200);
  Serial.println("Psych_Battery CrowPanel ready. Send 0-100 over Serial.");
}

void loop() {
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();

    if (line.length() > 0) {
      int val = line.toInt();
      if (val >= 0 && val <= 100) {
        currentCharge = val;
        needsRedraw = true;
        Serial.print("ACK ");
        Serial.println(currentCharge);
      }
    }
  }

  if (needsRedraw) {
    Paint_Clear(WHITE);
    drawPercent(currentCharge);
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

void drawPercent(int pct) {
  pct = constrain(pct, 0, 100);

  char buf[4];
  snprintf(buf, sizeof(buf), "%d", pct);

  int numDigits = strlen(buf);
  int numW = numDigits * 24;  // 48px font is 24px wide per digit.
  int unitW = 12;             // 24px font is 12px wide per character.
  int textX = (EPD_W - numW - unitW) / 2;
  int textY = (EPD_H - 48) / 2;

  EPD_ShowNum(textX, textY, pct, numDigits, 48, BLACK);
  EPD_ShowString(textX + numW, textY + 12, "%", 24, BLACK);
}

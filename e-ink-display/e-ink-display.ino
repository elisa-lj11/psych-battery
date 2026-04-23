#include <GxEPD2_BW.h>
#include <Fonts/FreeMonoBold9pt7b.h>
#include <SPI.h>

#define PWR_PIN 7   // display panel power enable

GxEPD2_BW<GxEPD2_579_GDEY0579T93, GxEPD2_579_GDEY0579T93::HEIGHT>
  display(GxEPD2_579_GDEY0579T93(/*CS=*/45, /*DC=*/46, /*RST=*/47, /*BUSY=*/48));

void setup() {
  Serial.begin(115200);

  // Enable display panel power
  pinMode(PWR_PIN, OUTPUT);
  digitalWrite(PWR_PIN, HIGH);
  delay(100);

  // Initialize SPI with the board's custom pins
  SPI.begin(/*SCK=*/12, /*MISO=*/-1, /*MOSI=*/11, /*SS=*/45);

  display.init(115200, true, 2, false);
  display.setRotation(1);           // landscape
  display.setFont(&FreeMonoBold9pt7b);
  display.setTextColor(GxEPD_BLACK);

  display.setFullWindow();
  display.firstPage();
  do {
    display.fillScreen(GxEPD_WHITE);
    display.setCursor(20, 50);
    display.println("Psych Battery");
    display.setCursor(20, 80);
    display.println("Hello, Elisa!");
  } while (display.nextPage());
}

void loop() {}

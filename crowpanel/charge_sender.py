"""
charge_sender.py — Serial bridge between the Flask model server and the CrowPanel.

Polls localhost:7070/state every 30 seconds, reads E_display (0-1),
converts to 0-100, and sends it to the CrowPanel over USB Serial.

Usage:
    python charge_sender.py --port COM3           # Windows
    python charge_sender.py --port /dev/ttyUSB0   # Linux
    python charge_sender.py --port /dev/cu.usbserial-XXXX  # Mac

    # Find your port: in Arduino IDE → Tools → Port (look for CP2102 or CH340)
    # Or: python charge_sender.py --list

Requirements:
    pip install pyserial requests
"""
from __future__ import annotations
import argparse
import time
import sys
import requests
import serial
import serial.tools.list_ports

MODEL_URL   = "http://localhost:7070/state"
POLL_SEC    = 30
BAUD_RATE   = 115200


def find_crowpanel_port() -> str | None:
    """Try to auto-detect the CrowPanel by VID/PID or description."""
    for p in serial.tools.list_ports.comports():
        desc = (p.description or "").lower()
        if any(kw in desc for kw in ("cp210", "ch340", "esp32", "uart", "usb serial")):
            return p.device
    return None


def list_ports() -> None:
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        print("No serial ports found.")
    for p in ports:
        print(f"  {p.device:20s} — {p.description}")


def fetch_charge() -> int | None:
    try:
        r = requests.get(MODEL_URL, timeout=3)
        r.raise_for_status()
        data = r.json()
        e_display = float(data.get("E_display", 0))
        # E_display is 0-1 from the updated /state endpoint
        return round(e_display * 100)
    except Exception as e:
        print(f"[model] fetch failed: {e}")
        return None


def run(port: str) -> None:
    print(f"Connecting to CrowPanel on {port} at {BAUD_RATE} baud…")
    try:
        ser = serial.Serial(port, BAUD_RATE, timeout=2)
    except serial.SerialException as e:
        print(f"Cannot open {port}: {e}")
        sys.exit(1)

    time.sleep(1.5)  # let ESP32 boot/reset after Serial open
    print("Connected. Polling model server every", POLL_SEC, "seconds.")
    last_sent = -1

    while True:
        charge = fetch_charge()
        if charge is not None and charge != last_sent:
            msg = f"{charge}\n".encode()
            try:
                ser.write(msg)
                ser.flush()
                # Read ACK (optional)
                ack = ser.readline().decode(errors="replace").strip()
                print(f"[{time.strftime('%H:%M:%S')}] Sent {charge}% → {ack or '(no ack)'}")
                last_sent = charge
            except Exception as e:
                print(f"[serial] write failed: {e}")
        elif charge == last_sent:
            print(f"[{time.strftime('%H:%M:%S')}] {charge}% (no change, skipped)")
        time.sleep(POLL_SEC)


def main() -> None:
    p = argparse.ArgumentParser(description="Send charge level to CrowPanel over Serial")
    p.add_argument("--port", help="Serial port (e.g. COM3 or /dev/ttyUSB0)")
    p.add_argument("--list", action="store_true", help="List available serial ports and exit")
    p.add_argument("--test", type=int, metavar="N", help="Send a single value N (0-100) and exit")
    args = p.parse_args()

    if args.list:
        list_ports()
        return

    port = args.port or find_crowpanel_port()
    if not port:
        print("Could not auto-detect port. Run with --list to see available ports.")
        sys.exit(1)

    if args.test is not None:
        print(f"Sending test value {args.test}% to {port}…")
        try:
            ser = serial.Serial(port, BAUD_RATE, timeout=2)
            time.sleep(1.5)
            ser.write(f"{args.test}\n".encode())
            ser.flush()
            ack = ser.readline().decode(errors="replace").strip()
            print(f"ACK: {ack or '(none)'}")
            ser.close()
        except Exception as e:
            print(f"Error: {e}")
        return

    run(port)


if __name__ == "__main__":
    main()

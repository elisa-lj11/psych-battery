"""
charge_sender.py — Serial bridge between the local /state endpoint and the CrowPanel.

Polls localhost:3131/state every 10 seconds, reads the shared battery/status
payload, and sends "NN trend status" to the CrowPanel over USB Serial.

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

STATE_URL     = "http://localhost:3131/state"
HEARTBEAT_URL = "http://localhost:3131/heartbeat"
POLL_SEC      = 10
BAUD_RATE     = 115200


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


def _coerce_pct(data: dict) -> int:
    if "battery_pct" in data:
        return max(0, min(100, round(float(data["battery_pct"]))))
    e_display = float(data.get("E_display", 0))
    return max(0, min(100, round(e_display * 100)))


def fetch_state(session: requests.Session) -> tuple[int, str, str, int] | None:
    try:
        r = session.get(STATE_URL, timeout=15)
        r.raise_for_status()
        data = r.json()
        charge = _coerce_pct(data)
        trend = str(data.get("trend", "flat")).strip().lower()
        status = str(data.get("status", "offline")).strip().lower()
        if trend not in {"up", "down", "flat"}:
            trend = "flat"
        if status not in {"live", "stale", "offline"}:
            status = "offline"
        next_ms = int(data.get("next_refresh_in_ms", POLL_SEC * 1000))
        return charge, trend, status, next_ms
    except Exception as e:
        print(f"[state] fetch failed: {e}")
        return None


def put_heartbeat(session: requests.Session, charge: int, trend: str, status: str) -> None:
    try:
        r = session.put(
            HEARTBEAT_URL,
            json={"battery_pct": charge, "trend": trend, "status": status},
            timeout=5,
        )
        r.raise_for_status()
    except Exception as e:
        print(f"[heartbeat] update failed: {e}")


def run(port: str) -> None:
    print(f"Connecting to CrowPanel on {port} at {BAUD_RATE} baud…")
    try:
        ser = serial.Serial(port, BAUD_RATE, timeout=2)
    except serial.SerialException as e:
        print(f"Cannot open {port}: {e}")
        sys.exit(1)

    time.sleep(1.5)  # let ESP32 boot/reset after Serial open
    print("Connected. Polling shared /state endpoint every", POLL_SEC, "seconds.")
    session = requests.Session()
    last_sent = None

    next_poll_sec = POLL_SEC
    while True:
        time.sleep(next_poll_sec)
        result = fetch_state(session)
        if result is not None:
            charge, trend, status, next_ms = result
            next_poll_sec = max(1, next_ms / 1000.0)
            msg = f"{charge} {trend} {status}\n".encode()
            try:
                ser.reset_input_buffer()
                ser.write(msg)
                ser.flush()
                ack = ser.readline().decode(errors="replace").strip()
                change_label = "changed" if (charge, trend, status) != last_sent else "steady"
                print(
                    f"[{time.strftime('%H:%M:%S')}] Sent {charge}% {trend} {status}"
                    f" ({change_label}) → {ack or '(no ack)'}"
                )
                if ack.startswith("ACK"):
                    put_heartbeat(session, charge, trend, status)
                    last_sent = (charge, trend, status)
                else:
                    print("[heartbeat] skipped because the CrowPanel did not ACK the packet")
            except Exception as e:
                print(f"[serial] write failed: {e}")
        else:
            next_poll_sec = POLL_SEC


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
            ser.write(f"{args.test} down live\n".encode())
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

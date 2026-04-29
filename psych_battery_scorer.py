"""Psych Battery scorer: ActivityWatch + Google Calendar -> energy score (stdout)."""

import socket
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from aw_client import ActivityWatchClient

# ---- Tunable constants -------------------------------------------------------
LOOP_SECONDS = 60
WINDOW_MINUTES = 30             # rolling AW signal window

BASELINE_SCORE = 75
MIN_SCORE, MAX_SCORE = 0, 100

SWITCH_DRAIN_PER_SWITCH  = 0.4   # points per app switch in window
MEETING_DRAIN_PER_HOUR   = 12.0  # points per hour of meetings remaining today
IN_MEETING_PENALTY       = 8.0   # flat penalty while a meeting is in progress
STREAK_DRAIN_THRESHOLD   = 90    # minutes of unbroken work before fatigue starts
STREAK_DRAIN_PER_MIN     = 0.25  # points per minute past threshold
AFK_RECHARGE_RATE        = 30.0  # points added when AFK fraction = 1.0
AFK_BREAK_MIN            = 5     # min AFK duration that counts as a real break

AW_HOST = "localhost"
AW_PORT = 5600

# Credentials live in ~/.config/psych-battery/ — never in the repo.
CONFIG_DIR  = Path.home() / ".config" / "psych-battery"
CREDS_PATH  = CONFIG_DIR / "credentials.json"
TOKEN_PATH  = CONFIG_DIR / "token.json"
GCAL_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
# ------------------------------------------------------------------------------


# ---- ActivityWatch -----------------------------------------------------------

def discover_buckets() -> dict[str, str | None]:
    r = requests.get(f"http://{AW_HOST}:{AW_PORT}/api/0/buckets", timeout=5)
    r.raise_for_status()
    prefixes = {"afk": "aw-watcher-afk_", "window": "aw-watcher-window_", "web": "aw-watcher-web"}
    out: dict[str, str | None] = {k: None for k in prefixes}
    for bid in r.json():
        for key, pref in prefixes.items():
            if bid.startswith(pref) and out[key] is None:
                out[key] = bid
    return out


def get_events(client: ActivityWatchClient, bucket_id: str | None, since: datetime):
    if not bucket_id:
        return []
    try:
        return client.get_events(bucket_id, start=since, end=datetime.now(timezone.utc))
    except Exception as e:
        print(f"[warn] AW read failed ({bucket_id}): {e}")
        return []


def compute_afk_fraction(afk_events) -> float:
    total = sum(e.duration.total_seconds() for e in afk_events)
    if total <= 0:
        return 0.0
    afk = sum(e.duration.total_seconds() for e in afk_events if e.data.get("status") == "afk")
    return afk / total


def compute_switch_rate(window_events, window_minutes: int) -> float:
    apps = [e.data.get("app") for e in window_events if e.data.get("app")]
    apps.reverse()  # AW returns newest-first; we want chronological
    switches = sum(1 for a, b in zip(apps, apps[1:]) if a != b)
    return switches / max(window_minutes, 1)


def update_work_streak(state: dict, afk_events) -> float:
    events = sorted(afk_events, key=lambda e: e.timestamp)
    last_break_end = state.get("last_break_end")
    for e in events:
        if e.data.get("status") == "afk" and e.duration.total_seconds() >= AFK_BREAK_MIN * 60:
            last_break_end = e.timestamp + e.duration
    state["last_break_end"] = last_break_end
    if last_break_end is None:
        last_break_end = events[0].timestamp if events else datetime.now(timezone.utc)
    return max(0.0, (datetime.now(timezone.utc) - last_break_end).total_seconds() / 60.0)


# ---- Google Calendar (optional) ---------------------------------------------

def _build_gcal_service():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), GCAL_SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_PATH), GCAL_SCOPES)
            creds = flow.run_local_server(port=0)
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        TOKEN_PATH.write_text(creds.to_json())
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def init_gcal():
    """Return a Calendar service, or None if credentials aren't set up yet."""
    if not CREDS_PATH.exists():
        print(f"[info] No credentials.json at {CREDS_PATH} — calendar signals disabled.")
        print(f"[info] See CALENDAR_SETUP.md to enable Google Calendar.")
        return None
    try:
        return _build_gcal_service()
    except Exception as e:
        print(f"[warn] Google Calendar auth failed: {e}")
        return None


def meeting_signals(service) -> tuple[float, bool]:
    """Return (meeting_minutes_remaining_today, is_in_meeting_now)."""
    now = datetime.now(timezone.utc)
    eod = datetime.now().replace(hour=23, minute=59, second=59).astimezone(timezone.utc)
    items = service.events().list(
        calendarId="primary",
        timeMin=now.isoformat().replace("+00:00", "Z"),
        timeMax=eod.isoformat().replace("+00:00", "Z"),
        singleEvents=True,
        orderBy="startTime",
    ).execute().get("items", [])

    minutes, in_meeting = 0.0, False
    for ev in items:
        if ev.get("status") == "cancelled":
            continue
        start_str = ev["start"].get("dateTime")
        end_str   = ev["end"].get("dateTime")
        if not start_str or not end_str:
            continue  # all-day event
        s = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        e = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
        if e <= now:
            continue
        if s <= now < e:
            in_meeting = True
        minutes += (e - max(s, now)).total_seconds() / 60.0
    return minutes, in_meeting


# ---- Scoring -----------------------------------------------------------------

def compute_score(switch_rate, afk_fraction, streak_min, meeting_min, in_meeting) -> int:
    score = float(BASELINE_SCORE)
    score -= SWITCH_DRAIN_PER_SWITCH * switch_rate * WINDOW_MINUTES
    score -= MEETING_DRAIN_PER_HOUR * (meeting_min / 60.0)
    if in_meeting:
        score -= IN_MEETING_PENALTY
    if streak_min > STREAK_DRAIN_THRESHOLD:
        score -= STREAK_DRAIN_PER_MIN * (streak_min - STREAK_DRAIN_THRESHOLD)
    score += AFK_RECHARGE_RATE * afk_fraction
    return int(max(MIN_SCORE, min(MAX_SCORE, round(score))))


# ---- Main loop ---------------------------------------------------------------

def main():
    print(f"[info] host={socket.gethostname()}")
    print(f"[info] AW at http://{AW_HOST}:{AW_PORT}")
    print(f"[info] Config dir: {CONFIG_DIR}")

    aw = ActivityWatchClient("psych-battery-scorer", testing=False)
    cal = init_gcal()
    streak_state: dict = {}

    while True:
        try:
            buckets = discover_buckets()
            since   = datetime.now(timezone.utc) - timedelta(minutes=WINDOW_MINUTES)

            afk_events    = get_events(aw, buckets["afk"],    since)
            window_events = get_events(aw, buckets["window"], since)

            afk_fraction = compute_afk_fraction(afk_events)
            switch_rate  = compute_switch_rate(window_events, WINDOW_MINUTES)
            streak_min   = update_work_streak(streak_state, afk_events)

            meeting_min, in_meeting = 0.0, False
            if cal:
                try:
                    meeting_min, in_meeting = meeting_signals(cal)
                except Exception as e:
                    print(f"[warn] calendar query failed: {e}")

            score = compute_score(switch_rate, afk_fraction, streak_min, meeting_min, in_meeting)
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"{ts}  score={score:3d}  switches={switch_rate:.2f}/min  "
                  f"afk={afk_fraction:.2f}  streak={streak_min:.0f}m  "
                  f"meeting={in_meeting}")

        except Exception as e:
            print(f"[error] {e}")

        time.sleep(LOOP_SECONDS)


if __name__ == "__main__":
    main()

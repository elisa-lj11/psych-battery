"""
Mental Meter local server.
- Serves index.html
- Proxies /aw/* → http://localhost:5600/api/0/*
- Exposes GET /state for the browser fallback path and CrowPanel bridge
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from threading import Lock
import urllib.request
import urllib.error
import urllib.parse
import json
from datetime import datetime, timezone, timedelta
import statistics as _statistics

AW_BASE             = 'http://localhost:5600/api/0'
MODEL_URL           = 'http://localhost:7070/state'  # Flask ODE model (browser source of truth)
NORMAL_WINDOW_HOURS = 4        # 4-hour rolling window (normal use)
DEMO_WINDOW_HOURS   = 2 / 60   # 2-minute rolling window (accelerated demo)
DEMO_STATE_TTL_SEC  = 10 * 60  # UI agent must refresh demo override before this expires
LIVE_HEARTBEAT_SEC  = 60
DATA_STALE_SEC      = 5 * 60
HIGH_DRAIN          = 15.0     # max drain rate (normalises battery to 0%)
AFK_RECHARGE        = 7.5      # recharge rate while AFK (drain units per minute)

_accelerated = False   # toggled via POST /accelerate

DRAIN_RULES = [
    {'patterns': ['claude', 'chatgpt', 'gemini', 'copilot', 'cursor', 'perplexity', 'gpt', 'mistral', 'openai'], 'rate': 15.0},
    {'patterns': ['zoom', 'teams', 'webex', 'whereby', 'loom', 'meet -', '| meet', 'google meet', 'zoom meeting'], 'rate': 15.0},
    {'patterns': ['slack', 'discord', 'telegram', 'whatsapp', 'messenger', 'signal'],                             'rate': 14.0},
    {'patterns': ['twitter', 'x.com', '/ x', 'reddit', 'instagram', 'tiktok', 'facebook', 'linkedin'],           'rate': 14.0},
    {'patterns': ['outlook', 'gmail', 'mail', 'thunderbird'],                                                      'rate': 12.0},
    {'patterns': ['code', 'visual studio', 'intellij', 'pycharm', 'vim', 'nvim', 'emacs', 'sublime', 'zed'],     'rate': 12.0},
    {'patterns': ['figma', 'sketch', 'photoshop', 'illustrator', 'affinity', 'canva'],                            'rate': 12.0},
    {'patterns': ['notion', 'obsidian', 'onenote', 'google docs', 'google sheets', 'google slides'],              'rate': 10.0},
    {'patterns': ['word', 'excel', 'pages', 'numbers', 'powerpoint', 'keynote'],                                  'rate': 10.0},
    {'patterns': ['chrome', 'firefox', 'safari', 'edge', 'brave', 'opera', 'arc'],                               'rate': 10.0},
    {'patterns': ['youtube', 'netflix', 'vlc', 'plex', 'hbo', 'prime video', 'twitch'],                          'rate':  6.0},
    {'patterns': ['spotify', 'music', 'podcasts', 'apple music'],                                                  'rate':  4.0},
    {'patterns': ['explorer', 'finder', 'terminal', 'cmd', 'powershell', 'bash', 'wt', 'iterm'],                 'rate':  4.0},
    {'patterns': [],                                                                                                'rate':  8.0},
]


def _match_rate(app: str, title: str) -> float:
    app, title = app.lower(), title.lower()
    for rule in DRAIN_RULES:
        if not rule['patterns']:
            return rule['rate']
        if any(p in app or p in title for p in rule['patterns']):
            return rule['rate']
    return 4.0


SERVER_START  = datetime.now(timezone.utc)
_prev_battery = None
_demo_state   = None
_last_display_heartbeat_at = None
_STATE_LOCK   = Lock()


def _now_local() -> datetime:
    return datetime.now().astimezone()


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=_now_local().tzinfo)
    return parsed.astimezone()


def _fetch_json(url: str, timeout: int = 10):
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.load(response)


def _next_trend(battery_pct: int) -> str:
    global _prev_battery
    if _prev_battery is None:
        trend = 'flat'
    elif battery_pct > _prev_battery:
        trend = 'up'
    elif battery_pct < _prev_battery:
        trend = 'down'
    else:
        trend = 'flat'
    _prev_battery = battery_pct
    return trend


def _is_after_hours(ts_str: str) -> bool:
    """Return True if timestamp falls outside M–F 9am–6pm (weekends always True)."""
    try:
        dt = datetime.fromisoformat(ts_str.replace('Z', '+00:00')).astimezone()
        if dt.weekday() >= 5:
            return True
        h = dt.hour + dt.minute / 60
        return h < 9.0 or h >= 18.0
    except Exception:
        return False


def _enrich_last_feats(payload: dict) -> dict:
    """Replace sparse 5-min last_feats with 4-hour rolling AW features for display."""
    try:
        now   = datetime.now(timezone.utc)
        start = now - timedelta(hours=NORMAL_WINDOW_HOURS)
        buckets = _fetch_json(AW_BASE + '/buckets/', timeout=5)
        window_bucket = next((k for k in buckets if k.startswith('aw-watcher-window_')), None)
        afk_bucket    = next((k for k in buckets if k.startswith('aw-watcher-afk_')), None)
        if not window_bucket:
            return payload

        s = urllib.parse.quote(start.isoformat())
        e = urllib.parse.quote(now.isoformat())

        # Window events → context switches + focus blocks
        wurl = f'{AW_BASE}/buckets/{urllib.parse.quote(window_bucket)}/events?start={s}&end={e}&limit=-1'
        wevents = _fetch_json(wurl, timeout=10)

        last_app = None
        context_switches = 0
        session_mins = []
        cur_min = 0.0
        for ev in wevents:
            app  = ev['data'].get('app', '')
            mins = ev['duration'] / 60
            if app != last_app:
                if last_app is not None:
                    if cur_min > 0:
                        session_mins.append(cur_min)
                    context_switches += 1
                cur_min  = mins
                last_app = app
            else:
                cur_min += mins
        if cur_min > 0:
            session_mins.append(cur_min)

        focus_block_min = sum(m for m in session_mins if m >= 10)
        frag_std = _statistics.stdev(session_mins) if len(session_mins) >= 2 else 0.0
        fragmentation_dev = (frag_std / 10.0 - 1.0)  # baseline = 10 min stddev

        # AFK events → active + afk_10plus
        active_min = 0.0
        afk_10plus_min = 0.0
        if afk_bucket:
            aurl = f'{AW_BASE}/buckets/{urllib.parse.quote(afk_bucket)}/events?start={s}&end={e}&limit=-1'
            aevents = _fetch_json(aurl, timeout=10)
            afk_blocks = []
            for ev in aevents:
                dur    = ev['duration']
                status = ev['data'].get('status', '')
                if status == 'afk':
                    afk_blocks.append(dur)
                else:
                    active_min += dur / 60
            afk_10plus_min = sum(d for d in afk_blocks if d >= 10 * 60) / 60

            after_hours_min = 0.0
            for ev in aevents:
                if ev['data'].get('status', '') != 'afk':
                    ts = ev.get('timestamp', '')
                    if ts and _is_after_hours(ts):
                        after_hours_min += ev['duration'] / 60
            after_hours_frac = round(after_hours_min / active_min, 3) if active_min > 0 else 0.0
        else:
            after_hours_frac = 0.0

        feats = dict(payload.get('last_feats', {}))
        feats.update({
            'context_switches':  float(context_switches),
            'focus_block_min':   round(focus_block_min, 1),
            'afk_10plus_min':    round(afk_10plus_min, 1),
            'fragmentation_dev': round(fragmentation_dev, 3),
            'after_hours_frac':  after_hours_frac,
        })
        if active_min > 0:
            feats['active_min'] = round(active_min, 1)
        payload = dict(payload)
        payload['last_feats'] = feats
    except Exception:
        pass
    return payload


def _fetch_model_state() -> dict | None:
    """Return the live Flask model payload plus derived battery_pct/trend."""
    try:
        data = _fetch_json(MODEL_URL, timeout=3)
        e = float(data.get('E_display', -1))
        if 0 <= e <= 1:
            payload = dict(data)
            payload['battery_pct'] = round(e * 100)
            payload['trend'] = _next_trend(payload['battery_pct'])
            payload['aw_connected'] = _aw_connected()
            payload['source'] = 'model'
            return _enrich_last_feats(payload)
    except Exception:
        pass
    return None


def _mark_display_heartbeat() -> datetime:
    global _last_display_heartbeat_at
    stamped = _now_local()
    with _STATE_LOCK:
        _last_display_heartbeat_at = stamped
    return stamped


def _get_display_heartbeat() -> datetime | None:
    with _STATE_LOCK:
        return _last_display_heartbeat_at


def _set_demo_state(payload: dict) -> None:
    global _demo_state
    cleaned = dict(payload)
    cleaned.setdefault('last_tick_iso', _now_local().isoformat())
    with _STATE_LOCK:
        _demo_state = {
            'payload': cleaned,
            'updated_at': _now_local(),
        }


def _clear_demo_state() -> None:
    global _demo_state
    with _STATE_LOCK:
        _demo_state = None


def _get_demo_state() -> dict | None:
    global _demo_state
    with _STATE_LOCK:
        if not _demo_state:
            return None
        age_sec = (_now_local() - _demo_state['updated_at']).total_seconds()
        if age_sec > DEMO_STATE_TTL_SEC:
            _demo_state = None
            return None
        return {
            'payload': dict(_demo_state['payload']),
            'updated_at': _demo_state['updated_at'],
        }


def _build_demo_state() -> dict | None:
    demo_state = _get_demo_state()
    if not demo_state:
        return None
    payload = dict(demo_state['payload'])
    try:
        e = float(payload.get('E_display', -1))
    except (TypeError, ValueError):
        return None
    if not 0 <= e <= 1:
        return None
    payload.setdefault('last_tick_iso', demo_state['updated_at'].isoformat())
    payload['battery_pct'] = round(e * 100)
    payload['trend'] = _next_trend(payload['battery_pct'])
    payload['aw_connected'] = bool(payload.get('aw_connected', True))
    payload['source'] = 'demo'
    return payload


def _aw_connected() -> bool:
    try:
        buckets = _fetch_json(AW_BASE + '/buckets/', timeout=3)
    except Exception:
        return False
    return any(bucket.startswith('aw-watcher-window_') for bucket in buckets)


def _enrich_status(payload: dict) -> dict:
    enriched = dict(payload)
    heartbeat_at = _get_display_heartbeat()
    heartbeat_age = None
    if heartbeat_at is not None:
        heartbeat_age = max(0.0, (_now_local() - heartbeat_at).total_seconds())

    data_tick = _parse_iso(enriched.get('last_tick_iso'))
    data_age = None
    if data_tick is not None:
        data_age = max(0.0, (_now_local() - data_tick).total_seconds())

    aw_connected = bool(enriched.get('aw_connected', False))

    if heartbeat_age is None or heartbeat_age > LIVE_HEARTBEAT_SEC:
        status = 'offline'
    elif (not aw_connected) or (data_age is None) or (data_age > DATA_STALE_SEC):
        status = 'stale'
    else:
        status = 'live'

    enriched['aw_connected'] = aw_connected
    enriched['data_age_sec'] = None if data_age is None else round(data_age, 3)
    enriched['heartbeat_age_sec'] = None if heartbeat_age is None else round(heartbeat_age, 3)
    enriched['last_display_heartbeat_iso'] = None if heartbeat_at is None else heartbeat_at.isoformat()
    enriched['last_update_iso'] = enriched.get('last_tick_iso') or _now_local().isoformat()
    enriched['status'] = status
    return enriched


def _build_aw_fallback_state() -> dict:
    """Compute the legacy AW battery when the Flask model is unavailable."""
    window_hours = DEMO_WINDOW_HOURS if _accelerated else NORMAL_WINDOW_HOURS
    now   = datetime.now(timezone.utc)
    start = now - timedelta(hours=window_hours)

    buckets = _fetch_json(AW_BASE + '/buckets/', timeout=10)

    window_bucket = next((k for k in buckets if k.startswith('aw-watcher-window_')), None)
    afk_bucket    = next((k for k in buckets if k.startswith('aw-watcher-afk_')),    None)

    if not window_bucket:
        battery = _prev_battery if _prev_battery is not None else 100
        return {
            'E_display': round(battery / 100, 4),
            'battery_pct': battery,
            'trend': _next_trend(battery),
            'aw_connected': False,
            'source': 'aw-fallback',
            'last_tick_iso': now.isoformat(),
        }

    s = urllib.parse.quote(start.isoformat())
    e = urllib.parse.quote(now.isoformat())

    url = f'{AW_BASE}/buckets/{urllib.parse.quote(window_bucket)}/events?start={s}&end={e}&limit=-1'
    events = _fetch_json(url, timeout=10)

    total_drain = 0.0
    for ev in events:
        mins = ev['duration'] / 60
        if mins < 0.1:
            continue
        total_drain += mins * _match_rate(ev['data'].get('app', ''), ev['data'].get('title', ''))

    # Subtract AFK recharge
    if afk_bucket:
        url = f'{AW_BASE}/buckets/{urllib.parse.quote(afk_bucket)}/events?start={s}&end={e}&limit=-1'
        afk_events = _fetch_json(url, timeout=10)
        for ev in afk_events:
            if ev['data'].get('status') == 'afk':
                mins = ev['duration'] / 60
                if mins < 0.1:
                    continue
                total_drain -= mins * AFK_RECHARGE

    capacity = window_hours * 60 * HIGH_DRAIN
    battery  = max(0, min(100, round(100 - (total_drain / capacity) * 100)))

    return {
        'E_display': round(battery / 100, 4),
        'battery_pct': battery,
        'trend': _next_trend(battery),
        'aw_connected': True,
        'source': 'aw-fallback',
        'last_tick_iso': now.isoformat(),
    }


def build_state_payload() -> dict:
    """
    Return the authoritative state for both the browser fallback path and the
    CrowPanel bridge.

    When the Flask model is live, forward that payload directly so the browser
    and display read the same `E_display` source. Only fall back to the local
    AW calculation if the model server is unavailable.
    """
    demo_state = _build_demo_state()
    if demo_state:
        return _enrich_status(demo_state)

    model_state = _fetch_model_state()
    if model_state:
        return _enrich_status(model_state)
    return _enrich_status(_build_aw_fallback_state())


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/state':
            self._state()
        elif self.path == '/mode':
            self._mode()
        elif self.path.startswith('/aw/'):
            self._proxy(self.path[3:])
        else:
            super().do_GET()

    def do_POST(self):
        global _accelerated
        if self.path == '/accelerate':
            _accelerated = not _accelerated
            label = 'demo (2 min)' if _accelerated else 'normal (4 hr)'
            print(f'[mode] switched to {label}')
            data = json.dumps({'accelerated': _accelerated}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(404)
            self.end_headers()

    def do_PUT(self):
        if self.path == '/demo-state':
            self._put_demo_state()
        elif self.path == '/heartbeat':
            self._put_heartbeat()
        else:
            self.send_response(404)
            self.end_headers()

    def do_DELETE(self):
        if self.path == '/demo-state':
            _clear_demo_state()
            self._send_json({'ok': True, 'demo_active': False})
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _send_json(self, payload: dict, status: int = 200):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get('Content-Length', '0') or '0')
        raw = self.rfile.read(length) if length > 0 else b'{}'
        try:
            payload = json.loads(raw.decode() or '{}')
        except json.JSONDecodeError as exc:
            raise ValueError(f'invalid JSON body: {exc.msg}') from exc
        if not isinstance(payload, dict):
            raise ValueError('JSON body must be an object')
        return payload

    def _mode(self):
        self._send_json({
            'accelerated': _accelerated,
            'demo_active': _get_demo_state() is not None,
            'window': 'demo (2 min)' if _accelerated else 'normal (4 hr)',
        })

    def _put_demo_state(self):
        try:
            body = self._read_json_body()
            payload = body.get('payload') if isinstance(body.get('payload'), dict) else body
            e_display = float(payload.get('E_display', -1))
            if not 0 <= e_display <= 1:
                raise ValueError('E_display must be a float in [0, 1]')
            _set_demo_state(payload)
            self._send_json({
                'ok': True,
                'demo_active': True,
                'expires_in_sec': DEMO_STATE_TTL_SEC,
            })
        except ValueError as exc:
            self._send_json({'error': str(exc)}, status=400)

    def _put_heartbeat(self):
        try:
            # Optional JSON body accepted for future debugging/telemetry, but the
            # endpoint contract only requires recording the receipt time.
            self._read_json_body()
        except ValueError as exc:
            self._send_json({'error': str(exc)}, status=400)
            return

        stamped = _mark_display_heartbeat()
        self._send_json({
            'ok': True,
            'last_display_heartbeat_iso': stamped.isoformat(),
        })

    def _state(self):
        try:
            self._send_json(build_state_payload())
        except Exception as ex:
            msg = str(ex).encode()
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def _proxy(self, aw_path):
        url = AW_BASE + aw_path
        try:
            with urllib.request.urlopen(url) as resp:
                data = resp.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.URLError as e:
            msg = str(e).encode()
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def log_message(self, fmt, *args):
        pass


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        import sys
        if issubclass(sys.exc_info()[0], (ConnectionAbortedError, BrokenPipeError, ConnectionResetError)):
            return
        super().handle_error(request, client_address)


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 3131))
    addr = ('', port)
    print(f'Mental Meter running at http://localhost:{port}')
    print(f'  Battery state: http://localhost:{port}/state')
    ThreadedHTTPServer(addr, Handler).serve_forever()

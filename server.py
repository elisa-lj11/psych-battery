"""
Psych Battery local server.
- Serves index.html
- Proxies /aw/* → http://localhost:5600/api/0/*
- Exposes GET /state → {"E_display": 0-1} for the CrowPanel bridge
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
import urllib.request
import urllib.error
import urllib.parse
import json
from datetime import datetime, timezone, timedelta

AW_BASE      = 'http://localhost:5600/api/0'
WINDOW_HOURS = 2 / 60  # 2-minute rolling window
HIGH_DRAIN   = 15.0    # max drain rate (normalises battery to 0%)
AFK_RECHARGE = 7.5     # recharge rate while AFK (drain units per minute)

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


SERVER_START   = datetime.now(timezone.utc)
_prev_battery  = 100


def compute_battery() -> tuple[int, str]:
    global _prev_battery
    now   = datetime.now(timezone.utc)
    start = max(SERVER_START, now - timedelta(hours=WINDOW_HOURS))

    with urllib.request.urlopen(AW_BASE + '/buckets/', timeout=10) as r:
        buckets = json.load(r)

    window_bucket = next((k for k in buckets if k.startswith('aw-watcher-window_')), None)
    afk_bucket    = next((k for k in buckets if k.startswith('aw-watcher-afk_')),    None)

    if not window_bucket:
        return _prev_battery, 'flat'

    s = urllib.parse.quote(start.isoformat())
    e = urllib.parse.quote(now.isoformat())

    url = f'{AW_BASE}/buckets/{urllib.parse.quote(window_bucket)}/events?start={s}&end={e}&limit=-1'
    with urllib.request.urlopen(url, timeout=10) as r:
        events = json.load(r)

    total_drain = 0.0
    for ev in events:
        mins = ev['duration'] / 60
        if mins < 0.1:
            continue
        total_drain += mins * _match_rate(ev['data'].get('app', ''), ev['data'].get('title', ''))

    # Subtract AFK recharge
    if afk_bucket:
        url = f'{AW_BASE}/buckets/{urllib.parse.quote(afk_bucket)}/events?start={s}&end={e}&limit=-1'
        with urllib.request.urlopen(url, timeout=10) as r:
            afk_events = json.load(r)
        for ev in afk_events:
            if ev['data'].get('status') == 'afk':
                mins = ev['duration'] / 60
                if mins < 0.1:
                    continue
                total_drain -= mins * AFK_RECHARGE

    capacity = WINDOW_HOURS * 60 * HIGH_DRAIN
    battery  = max(0, min(100, round(100 - (total_drain / capacity) * 100)))

    trend = 'up' if battery > _prev_battery else ('down' if battery < _prev_battery else 'flat')
    _prev_battery = battery
    return battery, trend


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/state':
            self._state()
        elif self.path.startswith('/aw/'):
            self._proxy(self.path[3:])
        else:
            super().do_GET()

    def _state(self):
        try:
            battery, trend = compute_battery()
            data = json.dumps({'E_display': battery / 100, 'battery_pct': battery, 'trend': trend}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
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
    addr = ('', 3131)
    print('Psych Battery running at http://localhost:3131')
    print('  Battery state: http://localhost:3131/state')
    ThreadedHTTPServer(addr, Handler).serve_forever()

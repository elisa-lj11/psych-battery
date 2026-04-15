"""
Psych Battery local server.
Serves index.html and proxies /aw/* → http://localhost:5600/api/0/*
so the browser doesn't hit CORS restrictions.
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.error

AW_BASE = 'http://localhost:5600/api/0'


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/aw/'):
            self._proxy(self.path[3:])  # strip /aw → /buckets/... etc.
        else:
            super().do_GET()

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
        pass  # silence request logs


if __name__ == '__main__':
    addr = ('', 3131)
    print('Psych Battery running at http://localhost:3131')
    HTTPServer(addr, Handler).serve_forever()

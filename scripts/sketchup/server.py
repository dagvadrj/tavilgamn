"""Private Windows SDK conversion service. Put behind HTTPS; Vercel calls it with a server-only bearer token."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading

MAX_BYTES = 4 * 1024 * 1024
TOKEN = os.environ.get('SKP_CONVERTER_TOKEN', '')
SDK = os.environ.get('SKETCHUP_API_PATH', '')
SLOT = threading.BoundedSemaphore(1)

class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup(); self.connection.settimeout(15)
    def log_message(self, *_):
        pass  # Do not log request headers, model content or tokens.
    def reply(self, status, body, content_type='application/json'):
        if not isinstance(body, bytes): body = json.dumps(body).encode()
        self.send_response(status); self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body))); self.send_header('Cache-Control', 'no-store'); self.end_headers()
        self.wfile.write(body)
    def authorized(self):
        return hmac.compare_digest(self.headers.get('Authorization', '').encode(), ('Bearer '+TOKEN).encode())
    def do_GET(self):
        if not self.authorized(): self.reply(401, {'error': 'Unauthorized'}); return
        self.reply(200 if self.path == '/health' else 404, {'available': Path(SDK).is_file()})
    def do_POST(self):
        if not self.authorized(): self.reply(401, {'error': 'Unauthorized'}); return
        if self.path != '/convert': self.reply(404, {'error': 'Not found'}); return
        try: size = int(self.headers.get('Content-Length', '0'))
        except ValueError: size = 0
        if self.headers.get('Transfer-Encoding') or not 20 <= size <= MAX_BYTES:
            self.reply(413, {'error': 'Invalid length'}); return
        if self.headers.get('Content-Type', '').split(';')[0] != 'model/gltf-binary':
            self.reply(415, {'error': 'GLB required'}); return
        if not SLOT.acquire(blocking=False): self.reply(429, {'error': 'Busy'}); return
        try:
            data = self.rfile.read(size)
            if len(data) != size: raise ValueError('Truncated body')
            with tempfile.TemporaryDirectory(prefix='kitchen-skp-job-') as directory:
                directory = Path(directory).resolve()
                if directory.parent != Path(tempfile.gettempdir()).resolve(): raise ValueError('Unexpected temp folder')
                source, output = directory/'input.glb', directory/'output.skp'; source.write_bytes(data)
                # Each process uses the SDK exclusively on its own main thread. A failed native parse cannot kill this service.
                result = subprocess.run([sys.executable, str(Path(__file__).with_name('convert.py')), str(source), str(output), '--sdk', SDK],
                    capture_output=True, timeout=45, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
                if result.returncode or not output.is_file(): raise ValueError('Conversion failed')
                if output.stat().st_size > MAX_BYTES: self.reply(413, {'error': 'Output too large'}); return
                self.reply(200, output.read_bytes(), 'application/octet-stream')
        except subprocess.TimeoutExpired: self.reply(504, {'error': 'Conversion timed out'})
        except (ValueError, OSError): self.reply(422, {'error': 'Invalid or unsupported kitchen export'})
        finally: SLOT.release()

if __name__ == '__main__':
    if len(TOKEN) < 32 or not Path(SDK).is_file():
        raise SystemExit('Set a random SKP_CONVERTER_TOKEN (32+ characters) and valid SKETCHUP_API_PATH.')
    server = ThreadingHTTPServer((os.environ.get('SKP_BIND', '127.0.0.1'), int(os.environ.get('SKP_PORT', '8789'))), Handler)
    print('SketchUp converter ready', flush=True)
    server.serve_forever()

#!/usr/bin/env python3
"""HTTP server with cache-busting headers for local development."""
import http.server
import socketserver
import os

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Add cache-busting headers before ending headers
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_header(self, keyword, value):
        # Override to ensure our cache headers go out
        super().send_header(keyword, value)

    def send_response_only(self, code, message=None):
        # Called before headers are sent; ensure cache headers are ready
        super().send_response_only(code, message)

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Serving at http://localhost:{PORT} (no-cache mode)")
        print(f"Directory: {DIRECTORY}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down...")
            httpd.shutdown()

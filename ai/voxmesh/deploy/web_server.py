#!/usr/bin/env python3
"""Static HTTP/HTTPS server for the browser ASR test page."""

import argparse
import http.server
import ssl
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GUIDES_DIR = REPO_ROOT / "docs" / "guides"
SSL_DIR = REPO_ROOT / "ssl"
DEFAULT_PAGE = "/web-asr-client.html"


class GuidesHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(GUIDES_DIR), **kwargs)

    def do_GET(self):
        if self.path in ("", "/"):
            self.path = DEFAULT_PAGE
        return super().do_GET()

    def log_message(self, format, *args):
        sys.stdout.write("%s - %s\n" % (self.address_string(), format % args))


def main():
    parser = argparse.ArgumentParser(description="ASR Web test page server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=36004)
    parser.add_argument("--no-https", action="store_true", help="Use HTTP only")
    args = parser.parse_args()

    if not GUIDES_DIR.is_dir():
        print(f"Error: guides directory not found: {GUIDES_DIR}", file=sys.stderr)
        sys.exit(1)

    page = GUIDES_DIR / "web-asr-client.html"
    if not page.is_file():
        print(f"Error: test page not found: {page}", file=sys.stderr)
        sys.exit(1)

    server = http.server.HTTPServer((args.host, args.port), GuidesHandler)

    scheme = "http"
    if not args.no_https:
        cert = SSL_DIR / "server.crt"
        key = SSL_DIR / "server.key"
        if cert.is_file() and key.is_file():
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(str(cert), str(key))
            server.socket = ctx.wrap_socket(server.socket, server_side=True)
            scheme = "https"
        else:
            print(
                f"Warning: TLS cert not found in {SSL_DIR}; falling back to HTTP.\n"
                "Generate certs: see ssl/README.md",
                file=sys.stderr,
            )

    print(f"Serving {GUIDES_DIR}")
    print(f"Open {scheme}://localhost:{args.port}{DEFAULT_PAGE}")
    print("Point ASR WebSocket to ws://localhost:36005")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()

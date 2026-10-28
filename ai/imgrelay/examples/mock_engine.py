"""Tiny image-to-image stand-in for local compose.

Speaks the imgrelay engine contract: POST /v1/images/edits returns a PNG body.
It does not look at the prompt. Replace this process with a real engine.
"""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# 1x1 PNG
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)

HOST = "0.0.0.0"
PORT = 8081


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        if length:
            self.rfile.read(length)
        if self.path.split("?", 1)[0] != "/v1/images/edits":
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(PNG)))
        self.end_headers()
        self.wfile.write(PNG)

    def log_message(self, fmt: str, *args) -> None:
        print(f"[mock-engine] {self.address_string()} {fmt % args}")


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"mock engine listening on {HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()

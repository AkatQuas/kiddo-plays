#!/usr/bin/env python3
"""Python sidecar — same TCP JSON-line contract as echo-server.js."""

from __future__ import annotations

import json
import socket
import sys
import time


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 58999
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", port))
    srv.listen(8)
    print(f"python sidecar listening on {port}", flush=True)

    while True:
        conn, _addr = srv.accept()
        with conn:
            buf = b""
            while True:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    if not line.strip():
                        continue
                    try:
                        msg = json.loads(line.decode("utf-8"))
                    except Exception:
                        msg = {"raw": line.decode("utf-8", "replace")}
                    reply = {
                        "from": "sidecar-python",
                        "received": msg,
                        "ts": int(time.time() * 1000),
                    }
                    conn.sendall((json.dumps(reply) + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()

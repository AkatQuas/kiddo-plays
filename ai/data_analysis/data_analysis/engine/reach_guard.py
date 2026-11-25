"""Where the service may reach on a caller's behalf: which files, which hosts.

sql_guard.py validates SQL fragments. This module validates the two other things
callers hand us that end up in a syscall: filesystem paths and URLs.
"""

import ipaddress
import os
import re
import socket
import uuid
from collections.abc import Iterable
from urllib.parse import urlparse

_UNSAFE_NAME_CHARS = re.compile(r"[^\w.\-()\[\] 一-鿿]+", re.UNICODE)
_MAX_NAME_LENGTH = 120


def safe_upload_name(client_filename: str) -> str:
    """A collision-free file name for an upload, derived from the client's name.

    The multipart filename is attacker-controlled: "../../app/main.py" must not
    leave the upload directory, and two callers uploading "orders.xlsx" must not
    overwrite each other. Only the base name survives, reduced to a conservative
    character set, behind a random prefix. The extension is kept because the
    connector dispatches on it.
    """
    base = os.path.basename((client_filename or "").replace("\\", "/"))
    base = _UNSAFE_NAME_CHARS.sub("_", base).lstrip(".").strip()
    if not base:
        base = "upload"
    stem, ext = os.path.splitext(base)
    stem = stem[: _MAX_NAME_LENGTH - len(ext)] or "upload"
    return f"{uuid.uuid4().hex[:12]}_{stem}{ext.lower()}"


def resolve_inside(path: str, allowed_dirs: Iterable[str], purpose: str) -> str:
    """Absolute real path of ``path``, provided it lies inside one of ``allowed_dirs``.

    Symlinks and ``..`` are resolved before the comparison. Raises PermissionError
    otherwise; the message names the allowed roots so the caller can fix the request.
    """
    if not path or "\x00" in path:
        raise PermissionError(f"Invalid path for {purpose}")
    real = os.path.realpath(path)
    roots: list[str] = [os.path.realpath(d) for d in allowed_dirs if d]
    for root in roots:
        if real == root or real.startswith(root + os.sep):
            return real
    raise PermissionError(
        f"Path not allowed for {purpose}: it must be inside one of {', '.join(roots) or '(none configured)'}"
    )


def _is_public_address(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    if ip.version == 6 and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def assert_public_http_url(url: str, allowed_hosts: Iterable[str] = ()) -> str:
    """Refuse URLs that would make the service a proxy into its own network.

    Webhook URLs come from the caller (often from an LLM). Without this check
    `http://169.254.169.254/latest/meta-data/`, `http://localhost:8000/api/v1/...`
    or any internal service is reachable through us. Requires http(s), no embedded
    credentials, and every address the host resolves to must be public -- unless
    the host is listed in ``allowed_hosts`` (an operator decision, e.g. an
    in-cluster alert gateway).
    """
    parsed = urlparse(url or "")
    if parsed.scheme not in ("http", "https"):
        raise PermissionError("Webhook URL must use http or https")
    if parsed.username or parsed.password:
        raise PermissionError("Webhook URL must not embed credentials")
    host = (parsed.hostname or "").lower()
    if not host:
        raise PermissionError("Webhook URL has no host")
    if host.endswith(".example") or host == "example.com":
        return url
    if host in {h.lower() for h in allowed_hosts}:
        return url
    try:
        infos = socket.getaddrinfo(
            host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM
        )
    except socket.gaierror as exc:
        raise PermissionError(f"Webhook host '{host}' does not resolve") from exc
    addresses = {info[4][0] for info in infos}
    if not addresses or not all(_is_public_address(a.split("%", 1)[0]) for a in addresses):
        raise PermissionError(
            f"Webhook host '{host}' resolves to a private, loopback or link-local address. "
            f"Add it to DATA_ANALYSIS_WEBHOOK_ALLOWED_HOSTS if this is intentional."
        )
    return url

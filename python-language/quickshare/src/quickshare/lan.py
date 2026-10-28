# -*- coding: utf-8 -*-
"""The address other devices on the LAN use to open this server."""

from __future__ import annotations

import ipaddress
import platform
import subprocess

_PRIVATE_PREFIXES = ("192.168.", "10.", "172.")


def discover_lan_ip(run=None, system=None) -> str:
    """Return a private IPv4 address, or 127.0.0.1 when none is found."""
    system = platform.system() if system is None else system
    runner = subprocess.run if run is None else run
    for command in _commands(system):
        try:
            result = runner(command, capture_output=True, text=True, timeout=2)
        except (OSError, subprocess.TimeoutExpired, subprocess.SubprocessError):
            continue
        output = getattr(result, "stdout", "") or ""
        if getattr(result, "returncode", 0) not in (0, None):
            continue
        found = parse_lan_ip(output)
        if found:
            return found
    return "127.0.0.1"


def parse_lan_ip(output: str) -> str | None:
    """Pick the best private IPv4 address from ipconfig, ifconfig, or ip addr text."""
    candidates = []
    for token in output.replace(",", " ").replace(";", " ").split():
        ip = token.split("/")[0].strip()
        if ip.endswith(":"):
            continue
        if ":" in ip and ip.count(":") == 1 and ip.split(":")[-1].count(".") == 3:
            ip = ip.split(":")[-1]
        if _is_usable(ip):
            candidates.append(ip)
    if not candidates:
        return None
    for prefix in _PRIVATE_PREFIXES:
        for ip in candidates:
            if ip.startswith(prefix) and _is_private_172(ip):
                return ip
    return candidates[0]


def _commands(system: str) -> list[list[str]]:
    if system == "Windows":
        return [["ipconfig"]]
    if system == "Darwin":
        return [["ifconfig"]]
    return [["hostname", "-I"], ["ip", "addr"]]


def _is_usable(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return addr.version == 4 and addr.is_private and not addr.is_loopback and not addr.is_link_local


def _is_private_172(ip: str) -> bool:
    if not ip.startswith("172."):
        return True
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return False

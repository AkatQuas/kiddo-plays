from quickshare.lan import discover_lan_ip, parse_lan_ip


class Result:
    def __init__(self, stdout, returncode=0):
        self.stdout = stdout
        self.returncode = returncode


def test_parse_prefers_lan_prefix_and_skips_loopback():
    output = """
    inet 127.0.0.1 netmask 0xff000000
    inet 169.254.1.1 netmask 0xffff0000
    inet 10.1.2.3 netmask 0xffffff00
    inet 192.168.1.9 netmask 0xffffff00 broadcast 192.168.1.255
    """
    assert parse_lan_ip(output) == "192.168.1.9"


def test_parse_private_172_and_ignores_public_172():
    assert parse_lan_ip("172.32.0.1 172.16.5.5") == "172.16.5.5"


def test_parse_windows_ipconfig_and_linux_cidr():
    windows = "IPv4 Address. . . . . . . . . . . : 192.168.0.20"
    assert parse_lan_ip(windows) == "192.168.0.20"
    assert parse_lan_ip("inet 10.0.0.8/24 brd 10.0.0.255") == "10.0.0.8"


def test_discover_uses_one_probe_and_falls_through():
    calls = []

    def run(command, **_kwargs):
        calls.append(command)
        if command[0] == "hostname":
            raise FileNotFoundError("hostname")
        return Result("inet 10.9.8.7/24 scope global")

    assert discover_lan_ip(run=run, system="Linux") == "10.9.8.7"
    assert calls == [["hostname", "-I"], ["ip", "addr"]]


def test_discover_without_a_private_address_is_loopback():
    def run(_command, **_kwargs):
        return Result("inet 127.0.0.1 netmask 0xff000000")

    assert discover_lan_ip(run=run, system="Darwin") == "127.0.0.1"


def test_parse_empty_is_none():
    assert parse_lan_ip("no addresses here") is None

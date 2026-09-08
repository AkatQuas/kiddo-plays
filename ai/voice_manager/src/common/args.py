import os
from argparse import ArgumentParser


def parse_args(argv: list[str] | None = None):
    parser = ArgumentParser()
    parser.add_argument(
        "--config-path",
        type=str,
        default=os.environ.get("CONFIG_PATH", "config/config.json"),
        help="Path to config JSON",
    )
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--log-dir", type=str, help="Log directory path")

    args, _unknown = parser.parse_known_args(argv)
    return args

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from repo_report.orchestrator import Orchestrator


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise argparse.ArgumentTypeError(
        f"Invalid date '{value}', use YYYY-MM-DD or ISO datetime"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="repo-report",
        description="AI daily commit analysis and team report push",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    run_parser = sub.add_parser("run", help="Run daily report pipeline")
    run_parser.add_argument(
        "--config",
        type=Path,
        default=Path("config/config.yaml"),
        help="Path to config.yaml (default: config/config.yaml)",
    )
    run_parser.add_argument(
        "--since",
        type=_parse_date,
        default=None,
        help="Manual start date (YYYY-MM-DD)",
    )
    run_parser.add_argument(
        "--until",
        type=_parse_date,
        default=None,
        help="Manual end date (YYYY-MM-DD)",
    )
    run_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Collect commits but skip AI, push, and cursor updates",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "run":
        orchestrator = Orchestrator(
            config_path=args.config.resolve(),
            since=args.since,
            until=args.until,
            dry_run=args.dry_run,
        )
        sys.exit(orchestrator.run())

    parser.print_help()
    sys.exit(1)

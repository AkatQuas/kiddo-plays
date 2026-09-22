import argparse
import logging
import sys

from clip_embed.config import settings
from clip_embed.download import download_model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def cmd_download_model() -> None:
    download_model()
    logger.info("Model ready at %s", settings.resolved_model_path)


def cmd_serve() -> None:
    import uvicorn

    uvicorn.run(
        "clip_embed.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="clip-embed — CLIP image embedding service")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("download-model", help="Download CLIP model from Hugging Face Hub")
    subparsers.add_parser("serve", help="Start the API server")

    args = parser.parse_args()

    if args.command == "download-model":
        cmd_download_model()
    elif args.command == "serve":
        cmd_serve()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()

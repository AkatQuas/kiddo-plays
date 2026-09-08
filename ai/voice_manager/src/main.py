from api.app import create_app
from common.args import parse_args
from common.config import init_config, is_config_initialized

args = parse_args()

if not is_config_initialized():
    init_config(args.config_path)

from common.log import init_log, logger

init_log()

app = create_app()


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Voice Manager API on %s:%s", args.host, args.port)
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="info",
        access_log=True,
        timeout_graceful_shutdown=args.timeout,
    )

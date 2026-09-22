#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import asyncio
import json
import os
import ssl
import time
import uuid

import bootstrap  # noqa: F401 — ensure sys.path before other imports
import websockets
from common.config import get_server_config, init_config
from voxmesh.path import REPO_ROOT

PARENT_DIR_PATH = str(REPO_ROOT)

init_config(os.path.join(os.path.dirname(__file__), "common", "config.json"))

from common.asr_enum import ASRType
from common.logger_config import logger
from model.model_pool import get_model_pool_manager
from service.session_manager import SessionManager
from transport.client_session import ASRClient
from transport.message_handler import MessageHandler
from voxmesh.app.streaming import StreamingApp
from voxmesh.version import get_version

parser = argparse.ArgumentParser(description="ASR WebSocket服务器")
parser.add_argument("--device", type=str, help="设备类型 (cuda/cpu)")
parser.add_argument("--host", type=str, help="服务器主机地址")
parser.add_argument("--port", type=int, help="服务器端口")
parser.add_argument("--max_clients", type=int, help="最大客户端连接数")
parser.add_argument("--log_dir", type=str, help="日志目录路径")
parser.add_argument("--session_dir", type=str, help="会话文件存储目录路径")
args = parser.parse_args()

if args.device:
    get_server_config().asr_default_params.device = args.device
if args.host:
    get_server_config().network_config.host = args.host
if args.port:
    get_server_config().network_config.port = args.port
if args.max_clients:
    get_server_config().network_config.max_clients = args.max_clients
if args.log_dir:
    get_server_config().logger_config.log_dir = args.log_dir
if args.session_dir:
    get_server_config().session_dir = args.session_dir

if os.getenv("HW_ENABLE"):
    try:
        import torch_npu  # noqa: F401
        from torch_npu.contrib import transfer_to_npu  # noqa: F401

        logger.info("华为NPU环境已启用，成功导入torch_npu")
    except ImportError as exc:
        logger.warning(f"华为NPU环境变量已设置，但导入torch_npu失败: {exc}")


class ASRWebSocketServer:
    """ASR WebSocket server — transport separated from recognition orchestration."""

    def __init__(
        self,
        host: str,
        port: int,
        streaming_model_dir: str,
        offline_model_dir: str,
        vad_model_path: str,
        model_pool_manager,
        enable_advice: bool = False,
        streaming_asr_type: ASRType = ASRType.SENSEVOICE,
        offline_asr_type: ASRType = ASRType.SENSEVOICE,
        detector_pool_size: int = 5,
        asr_pool_size: int = 3,
        speaker_pool_size: int = 3,
        session_dir: str = "sessions",
        **model_kwargs,
    ):
        self.host = host
        self.port = port
        self.streaming_model_dir = streaming_model_dir
        self.offline_model_dir = offline_model_dir
        self.vad_model_path = vad_model_path
        self.enable_advice = enable_advice
        self.streaming_asr_type = streaming_asr_type
        self.offline_asr_type = offline_asr_type
        self.detector_pool_size = detector_pool_size
        self.asr_pool_size = asr_pool_size
        self.speaker_pool_size = speaker_pool_size
        self.model_kwargs = model_kwargs
        self.model_pool_manager = model_pool_manager

        config = get_server_config()
        self.max_clients = config.network_config.max_clients
        self.clients = {}
        self.session_manager = SessionManager(session_dir=session_dir)
        self.message_handler = MessageHandler(self)

        logger.info("ASR WebSocket服务器初始化完成")

    async def handle_new_connection(self, websocket):
        if len(self.clients) >= self.max_clients:
            logger.warning(f"连接数已达上限({self.max_clients})，拒绝新连接")
            try:
                await websocket.send(
                    json.dumps(
                        {
                            "type": "connection_limit",
                            "message": f"服务器连接数已达上限({self.max_clients})，请稍后重试",
                            "timestamp": time.time(),
                        },
                        ensure_ascii=False,
                    )
                )
            except Exception:
                pass
            finally:
                await websocket.close()
            return None

        client_id = f"{int(time.time())}_{str(uuid.uuid4())[:8]}"
        self.clients[client_id] = ASRClient(websocket, client_id)
        logger.info(f"新客户端连接 {client_id}，当前连接数: {len(self.clients)}")
        return client_id

    async def handle_message(self, client_id: str, message):
        await self.message_handler.handle_message(client_id, message)

    async def disconnect_client(self, client_id: str):
        client = self.clients.pop(client_id, None)
        if client:
            if client.asr_instance:
                save_success = self.session_manager.save_session_state(
                    client_id, client.asr_instance
                )
                if save_success:
                    logger.info(f"客户端 {client_id} 会话状态已保存")
                else:
                    logger.warning(f"客户端 {client_id} 会话状态保存失败")
            client.cleanup()
            logger.info(f"客户端 {client_id} 已断开连接，当前连接数: {len(self.clients)}")

    async def websocket_handler(self, websocket):
        client_id = None
        try:
            client_id = await self.handle_new_connection(websocket)
            if not client_id:
                return
            async for message in websocket:
                await self.handle_message(client_id, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"客户端 {client_id} 连接已关闭")
        except Exception as exc:
            logger.error(f"处理客户端 {client_id} 连接时出错: {exc}", exc_info=True)
        finally:
            if client_id:
                await self.disconnect_client(client_id)

    async def init_model_pools(self):
        logger.info("开始初始化模型池...")
        try:
            unified_max_size = max(
                self.detector_pool_size, self.asr_pool_size, self.speaker_pool_size
            )
            unified_min_size = max(1, unified_max_size)
            self.model_pool_manager.set_pool_sizes(unified_max_size, unified_min_size)

            config = get_server_config()
            default_params = config.asr_default_params

            if self.detector_pool_size > 0:
                detector_kwargs = {
                    "framerate": self.model_kwargs.get("sample_rate", default_params.sample_rate),
                    "silence_duration_s": self.model_kwargs.get(
                        "vad_silence_duration_s", default_params.vad_silence_duration_s
                    ),
                    "threshold": self.model_kwargs.get(
                        "vad_threshold", default_params.vad_threshold
                    ),
                    "max_speech_duration_s": self.model_kwargs.get(
                        "vad_max_speech_duration_s", default_params.vad_max_speech_duration_s
                    ),
                    "speech_start_buffer": self.model_kwargs.get(
                        "vad_speech_start_buffer", default_params.vad_speech_start_buffer
                    ),
                }
                self.model_pool_manager.create_detector_pool(
                    vad_model_path=self.vad_model_path,
                    **detector_kwargs,
                )

            if self.speaker_pool_size > 0:
                speaker_kwargs = {
                    "delta_new": self.model_kwargs.get(
                        "spk_delta_new", default_params.spk_delta_new
                    ),
                    "max_speakers": self.model_kwargs.get(
                        "spk_max_speakers", default_params.spk_max_speakers
                    ),
                    "device": self.model_kwargs.get("device", default_params.device),
                }
                self.model_pool_manager.create_speaker_clustering_pool(
                    embedding_model_dir=config.asr_model_config.embedding_model_dir,
                    segmentation_model_path=config.asr_model_config.segmentation_model_path,
                    **speaker_kwargs,
                )

            configured_types = set()
            if self.streaming_asr_type:
                configured_types.add(self.streaming_asr_type)
            if self.offline_asr_type:
                configured_types.add(self.offline_asr_type)

            for asr_type in configured_types:
                if self.asr_pool_size > 0:
                    self.model_pool_manager.create_asr_pool(
                        model_type=asr_type,
                        streaming_model_dir=self.streaming_model_dir,
                        offline_model_dir=self.offline_model_dir,
                        streaming_type=self.streaming_asr_type,
                        offline_type=self.offline_asr_type,
                        **self.model_kwargs,
                    )

            self.model_pool_manager.init_all_pools()
            logger.info("所有模型池初始化完成")
        except Exception as exc:
            logger.error(f"模型池初始化失败: {exc}")
            raise

    async def start_server(self):
        try:
            await self.init_model_pools()

            ssl_context_to_use = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            crt_path = os.path.join(PARENT_DIR_PATH, "ssl", "server.crt")
            key_path = os.path.join(PARENT_DIR_PATH, "ssl", "server.key")
            ssl_context_to_use.load_cert_chain(crt_path, key_path)

            server = await websockets.serve(
                self.websocket_handler,
                self.host,
                self.port,
                ping_interval=None,
                max_size=2 ** 22,
                max_queue=1024,
                close_timeout=10,
                compression=None,
                open_timeout=60,
                logger=logger,
            )

            logger.info(f"ASR WebSocket服务器已启动 (WS): ws://{self.host}:{self.port}")
            await server.wait_closed()
        except Exception as exc:
            logger.error(f"启动服务器失败: {exc}", exc_info=True)
            raise

    async def shutdown(self):
        logger.info("开始关闭服务器...")
        for client_id in list(self.clients.keys()):
            await self.disconnect_client(client_id)
        self.model_pool_manager.cleanup_all()
        logger.info("服务器已关闭")


async def main():
    version = get_version()
    logger.info("ASR WebSocket服务器启动")
    logger.info(f"当前版本: {version}")

    config = get_server_config()
    pool_manager = get_model_pool_manager()
    server = ASRWebSocketServer(
        host=config.network_config.host,
        port=config.network_config.port,
        streaming_model_dir=config.asr_model_config.streaming_model_dir,
        offline_model_dir=config.asr_model_config.offline_model_dir,
        vad_model_path=config.asr_model_config.vad_model_path,
        model_pool_manager=pool_manager,
        enable_advice=config.asr_default_params.enable_advice,
        streaming_asr_type=config.asr_model_config.streaming_asr_type,
        offline_asr_type=config.asr_model_config.offline_asr_type,
        detector_pool_size=config.network_config.max_clients,
        asr_pool_size=config.network_config.max_clients,
        speaker_pool_size=config.network_config.max_clients,
        device=config.asr_default_params.device,
        session_dir=config.session_dir,
    )

    app = StreamingApp.create(
        server=server,
        model_pool_manager=pool_manager,
        session_manager=server.session_manager,
        config=config,
    )

    try:
        await app.start()
    except KeyboardInterrupt:
        logger.info("收到停止信号")
        await app.shutdown()


if __name__ == "__main__":
    asyncio.run(main())

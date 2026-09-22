from __future__ import annotations

import json
from typing import Any, Dict, Optional

from common.config import get_server_config
from common.logger_config import logger
from voxmesh.version import get_version

from transport.protocol import validate_hotwords


class MessageHandler:
    """Routes WebSocket messages to recognition orchestration."""

    def __init__(self, server):
        self.server = server

    def build_init_params(self, client_id: str, init_params: Optional[dict]) -> Dict[str, Any]:
        if init_params is None:
            init_params = {}

        config = get_server_config()
        default_params = {
            "enable_advice": config.asr_default_params.enable_advice,
            "enable_text_correction": config.asr_default_params.enable_text_correction,
            "text_correction_min_length": config.asr_default_params.text_correction_min_length,
            "is_debug": False,
            "spk_delta_new": config.asr_default_params.spk_delta_new,
            "spk_max_speakers": config.asr_default_params.spk_max_speakers,
            "sample_rate": config.asr_default_params.sample_rate,
            "vad_silence_duration_s": config.asr_default_params.vad_silence_duration_s,
            "vad_threshold": config.asr_default_params.vad_threshold,
            "vad_max_speech_duration_s": config.asr_default_params.vad_max_speech_duration_s,
            "vad_speech_start_buffer": config.asr_default_params.vad_speech_start_buffer,
            "transcribe_interval": config.asr_default_params.transcribe_interval,
            "embedding_model_dir": config.asr_model_config.embedding_model_dir,
            "device": config.asr_default_params.device,
            "enable_volume_detection": config.asr_default_params.enable_volume_detection,
            "volume_threshold_db": config.asr_default_params.volume_threshold_db,
            "volume_check_duration_s": config.asr_default_params.volume_check_duration_s,
            "volume_warning_interval_s": config.asr_default_params.volume_warning_interval_s,
        }

        final_params = {**default_params}

        speakers_data = init_params.get("speakers", [])
        if speakers_data:
            logger.info(f"客户端 {client_id} 传递了 {len(speakers_data)} 个预注册说话人")
            final_params["speakers"] = speakers_data

        hotword_data = init_params.get("hotword", [])
        if hotword_data:
            if validate_hotwords(hotword_data):
                logger.info(f"客户端 {client_id} 传递了 {len(hotword_data)} 个热词: {hotword_data}")
                final_params["hotword"] = hotword_data
            else:
                logger.warning(f"客户端 {client_id} 传递的热词格式无效，已忽略: {hotword_data}")
        else:
            logger.info(f"客户端 {client_id} 未传递热词或热词列表为空")

        final_params.update(self.server.model_kwargs)
        return final_params

    async def initialize_client_asr(
        self,
        client_id: str,
        init_params: dict = None,
        session_id: str = None,
    ) -> bool:
        client = self.server.clients.get(client_id)
        if not client:
            return False

        import asyncio

        logger.info(f"开始为客户端 {client_id} 创建ASR实例")
        loop = asyncio.get_running_loop()
        final_params = self.build_init_params(client_id, init_params)

        logger.info(f"客户端 {client_id} 使用参数: {final_params}")
        success = client.create_asr_instance(event_loop=loop, **final_params)

        session_restored = False
        if success and session_id:
            if self.server.session_manager.restore_session_state(session_id, client.asr_instance):
                client.asr_instance.client_time = init_params.get("record_time", 0)
                session_restored = True
                logger.info(f"客户端 {client_id} 成功恢复会话状态，原会话ID: {session_id}")
            else:
                logger.warning(f"客户端 {client_id} 会话状态恢复失败，将使用新会话")

        if success:
            advice_status = "已启用" if final_params.get("enable_advice", False) else "未启用"
            correction_status = (
                "已启用" if final_params.get("enable_text_correction", False) else "未启用"
            )
            hotword_info = (
                f"，热词功能已启用({len(final_params['hotword'])}个热词)"
                if final_params.get("hotword")
                else "，热词功能未启用"
            )
            session_info = f"，会话已从 {session_id} 恢复" if session_restored else ""
            welcome_msg = (
                f"ASR服务已就绪，AI建议功能{advice_status}，文本纠错功能{correction_status}"
                f"{hotword_info}{session_info}，可以开始发送音频数据"
            )
            await client.send_message(
                "welcome",
                {
                    "message": welcome_msg,
                    "client_id": client_id,
                    "session_restored": session_restored,
                    "restored_from": session_id,
                    "version": get_version(),
                    "params": final_params,
                },
            )
        else:
            await client.send_message("init_failed", message="ASR服务初始化失败")
            logger.error(f"客户端 {client_id} ASR实例初始化失败")

        return success

    async def handle_message(self, client_id: str, message):
        client = self.server.clients.get(client_id)
        if not client:
            return

        try:
            if isinstance(message, bytes):
                if client.is_ready and client.asr_instance:
                    client.asr_instance.recognize(message)
                else:
                    await client.send_message(
                        "error",
                        message="池化ASR实例未就绪，请等待初始化完成",
                    )
                return

            try:
                data = json.loads(message) if isinstance(message, str) else message
            except json.JSONDecodeError as exc:
                await client.send_message("error", message=f"JSON格式错误: {str(exc)}")
                return

            message_type = data.get("type", "")

            if message_type == "ping":
                await client.send_message("pong")
            elif message_type == "init":
                await self.initialize_client_asr(
                    client_id,
                    data.get("params", {}),
                    data.get("session_id"),
                )
            elif message_type == "advice_status":
                if client.is_ready and client.asr_instance:
                    status = client.asr_instance.get_advice_status()
                    await client.send_message("advice_status", {"status": status})
                else:
                    await client.send_message("error", message="ASR实例未就绪")
            elif message_type == "pool_status":
                pool_stats = self.server.model_pool_manager.get_all_stats()
                await client.send_message("pool_status", {"stats": pool_stats})
            else:
                await client.send_message("error", message=f"未知消息类型: {message_type}")
        except Exception as exc:
            logger.error(f"处理客户端 {client_id} 消息时出错: {exc}", exc_info=True)
            await client.send_message("error", message=f"服务器处理错误: {str(exc)}")

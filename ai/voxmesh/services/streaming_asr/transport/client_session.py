from __future__ import annotations

import asyncio
import json
import time
from typing import Optional

from common.logger_config import logger
from service.pooled_realtime_asr import PooledRealtimeSpeechRecognizer


class ASRClient:
    """ASR client session — WebSocket transport bound to a recognition instance."""

    def __init__(self, websocket, client_id: str):
        self.websocket = websocket
        self.client_id = client_id
        self.asr_instance: Optional[PooledRealtimeSpeechRecognizer] = None
        self.connected_time = time.time()
        self.is_ready = False

    async def send_message(self, message_type: str, data: dict = None, message: str = None):
        try:
            response = {
                "type": message_type,
                "timestamp": time.time(),
                "client_id": self.client_id,
            }
            if data:
                response.update(data)
            if message:
                response["message"] = message
            await self.websocket.send(json.dumps(response, ensure_ascii=False))
            return True
        except Exception as exc:
            logger.error(f"向客户端 {self.client_id} 发送消息失败: {exc}")
            return False

    def create_asr_instance(self, event_loop, enable_advice: bool = False, **kwargs):
        try:
            def result_callback(results):
                try:
                    asyncio.run_coroutine_threadsafe(
                        self._handle_recognition_results(results),
                        event_loop,
                    )
                except Exception as exc:
                    logger.error(f"回调函数执行失败: {exc}")

            def advice_callback(advice_data: dict):
                try:
                    asyncio.run_coroutine_threadsafe(
                        self._handle_advice_message(advice_data),
                        event_loop,
                    )
                except Exception as exc:
                    logger.error(f"建议回调函数执行失败: {exc}")

            def volume_callback(volume_result):
                try:
                    asyncio.run_coroutine_threadsafe(
                        self._handle_volume_warning(volume_result),
                        event_loop,
                    )
                except Exception as exc:
                    logger.error(f"音量回调函数执行失败: {exc}")

            self.asr_instance = PooledRealtimeSpeechRecognizer(
                result_callback=result_callback,
                enable_async=True,
                enable_advice=enable_advice,
                advice_callback=advice_callback if enable_advice else None,
                volume_callback=volume_callback,
                **kwargs,
            )

            if not self.asr_instance.acquire_models():
                logger.error(f"客户端 {self.client_id} 无法从模型池获取模型")
                self.asr_instance = None
                return False

            self.is_ready = True
            logger.info(f"客户端 {self.client_id} 池化ASR实例创建成功")
            return True
        except Exception as exc:
            logger.error(f"客户端 {self.client_id} ASR实例创建失败: {exc}")
            return False

    async def _handle_recognition_results(self, results):
        if results and len(results) > 0:
            logger.info(f"客户端 {self.client_id} 识别结果: {results}")
            await self.send_message("recognition_result", {"results": results})
            for result in results:
                if result.get("type") == "end" and result.get("text"):
                    logger.info(f"客户端 {self.client_id} 识别结果: {result['text']}")

    async def _handle_advice_message(self, advice_data: dict):
        try:
            await self.send_message("advice", advice_data)
            logger.info(
                f"已向客户端 {self.client_id} 发送AI建议: {advice_data.get('title', '未知建议')}"
            )
        except Exception as exc:
            logger.error(f"向客户端 {self.client_id} 发送AI建议失败: {exc}")

    async def _handle_volume_warning(self, volume_result):
        try:
            volume_warning_data = {
                "rms_db": float(volume_result.rms_db),
                "peak_db": float(volume_result.peak_db),
                "is_low_volume": bool(volume_result.is_low_volume),
                "duration_s": float(volume_result.duration_s),
                "detection_time_ms": float(volume_result.detection_time_ms),
                "message": (
                    f"检测到低音量 (RMS: {float(volume_result.rms_db):.1f}dB)，"
                    "请检查麦克风设置或提高说话音量"
                ),
            }
            await self.send_message("volume_warning", volume_warning_data)
        except Exception as exc:
            logger.error(f"向客户端 {self.client_id} 发送音量警告失败: {exc}")

    def cleanup(self):
        if self.asr_instance:
            self.asr_instance.stop_async_processing()
            self.asr_instance = None
        self.is_ready = False

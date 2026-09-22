#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Whisper离线和流式识别实现
基于FunASR的AutoModel接口实现
"""

import re

import numpy as np
from common.logger_config import logger
from funasr import AutoModel
from model.model_base import ASROfflineBase, ASRStreamingBase


class WhisperOffline(ASROfflineBase):
    """Whisper离线识别实现"""

    def __init__(self, model_dir, **kwargs):
        super().__init__(model_dir, **kwargs)

        # 从kwargs中提取参数，设置默认值
        device = kwargs.get('device', "cuda")

        logger.info(f"初始化Whisper离线模型: {model_dir}")
        logger.info(f"设备: {device}")

        try:
            self.model = AutoModel(
                model=model_dir,
                vad_model=None,
                device=device,
                disable_pbar=True,
                disable_update=True,
            )

            if self.model is None:
                raise ValueError("AutoModel返回None，模型初始化失败")

            logger.info("Whisper离线模型初始化成功")

        except Exception as e:
            logger.error(f"Whisper离线模型初始化失败: {e}")
            raise

        # Whisper解码选项
        self.decoding_options = {
            "task": "transcribe",
            "language": kwargs.get('language', 'zh'),  # 中文简体
            "beam_size": kwargs.get('beam_size', None),
            "fp16": kwargs.get('fp16', True),
            "without_timestamps": kwargs.get('without_timestamps', False),
            "prompt": kwargs.get('prompt', None),
        }

        logger.info(f"Whisper解码选项: {self.decoding_options}")

    def transcribe(self, wav_buffer):
        """离线转录音频"""
        try:
            if self.model is None:
                raise ValueError("Whisper模型未初始化")

            if not hasattr(self.model, 'generate'):
                raise AttributeError("Whisper模型没有generate方法")

            # Whisper转录配置
            transcribe_kwargs = {
                "DecodingOptions": self.decoding_options,
                "batch_size_s": 0,  # Whisper推荐设置为0
            }

            logger.info(f"Whisper转录参数: {transcribe_kwargs}")

            # 执行转录
            results = self.model.generate(input=wav_buffer, **transcribe_kwargs)
            logger.info(f"Whisper转录结果: {results}")

            if len(results) > 0:
                text = results[0].get("text", "")
                # 清理文本，移除可能的特殊标签
                text = re.sub(r"<.*?>", "", text)  # 移除尖括号标签
                text = text.strip()
                return text
            else:
                return ""

        except Exception as e:
            logger.error(f"Whisper离线转录失败: {e}")
            raise

class WhisperStreaming(ASRStreamingBase):
    """Whisper流式识别实现"""

    def __init__(self, model_dir, **kwargs):
        super().__init__(model_dir, **kwargs)

        # 从kwargs中提取参数，设置默认值
        device = kwargs.get('device', "cuda")

        logger.info(f"初始化Whisper流式模型: {model_dir}")
        logger.info(f"设备: {device}")

        try:
            self.model = AutoModel(
                model=model_dir,
                vad_model=None,
                device=device,
                disable_pbar=True,
                disable_update=True,
            )

            if self.model is None:
                raise ValueError("AutoModel返回None，模型初始化失败")

            logger.info("Whisper流式模型初始化成功")

        except Exception as e:
            logger.error(f"Whisper流式模型初始化失败: {e}")
            raise

        # Whisper解码选项
        self.decoding_options = {
            "task": "transcribe",
            "language": kwargs.get('language', 'zh'),  # 中文简体
            "beam_size": kwargs.get('beam_size', None),
            "fp16": kwargs.get('fp16', True),
            "without_timestamps": kwargs.get('without_timestamps', False),
            "prompt": kwargs.get('prompt', None),
        }

        # 语音缓冲区
        self.wav_buffer = np.empty(0, dtype=np.float32)

        logger.info(f"Whisper解码选项: {self.decoding_options}")

    def get_wav_buffer(self):
        """获取音频缓冲区"""
        return self.wav_buffer

    def input(self, streaming_wav_np):
        """输入音频流数据"""
        if len(self.wav_buffer) == 0:
            self.wav_buffer = streaming_wav_np.astype(np.float32)
        else:
            self.wav_buffer = np.concatenate(
                (self.wav_buffer, streaming_wav_np.astype(np.float32))
            )

    def get_input_length(self):
        """获取输入音频长度"""
        return len(self.wav_buffer)

    def clear_state(self):
        """清除当前状态"""
        self.wav_buffer = np.empty(0, dtype=np.float32)

    def transcribe(self):
        """流式转录当前缓冲区音频"""
        try:
            if len(self.wav_buffer) == 0:
                return ""

            if self.model is None:
                raise ValueError("Whisper模型未初始化")

            if not hasattr(self.model, 'generate'):
                raise AttributeError("Whisper模型没有generate方法")

            # Whisper转录配置
            transcribe_kwargs = {
                "DecodingOptions": self.decoding_options,
                "batch_size_s": 0,  # Whisper推荐设置为0
            }

            logger.debug(f"Whisper流式转录参数: {transcribe_kwargs}")

            # 执行转录
            results = self.model.generate(input=self.wav_buffer, **transcribe_kwargs)

            if len(results) > 0:
                text = results[0].get("text", "")
                # 清理文本，移除可能的特殊标签
                text = re.sub(r"<.*?>", "", text)  # 移除尖括号标签
                text = text.strip()
                return text
            else:
                return ""

        except Exception as e:
            logger.error(f"Whisper流式转录失败: {e}")
            raise

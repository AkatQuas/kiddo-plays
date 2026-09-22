#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Qwen-Audio离线和流式识别实现
基于FunASR的AutoModel接口实现
"""

import re

import numpy as np
from common.logger_config import logger
from funasr import AutoModel
from model.model_base import ASROfflineBase, ASRStreamingBase


class QwenOffline(ASROfflineBase):
    """Qwen-Audio离线识别实现"""

    def __init__(self, model_dir, **kwargs):
        super().__init__(model_dir, **kwargs)

        logger.info(f"初始化Qwen-Audio离线模型: {model_dir}")

        try:
            self.model = AutoModel(
                model=model_dir, device="cuda:1", vad_model=None, disable_pbar=True, disable_update=True
            )

            if self.model is None:
                raise ValueError("AutoModel返回None，模型初始化失败")

            logger.info("Qwen-Audio离线模型初始化成功")

        except Exception as e:
            logger.error(f"Qwen-Audio离线模型初始化失败: {e}")
            raise

        # Qwen-Audio的默认prompt模板
        self.default_prompt = kwargs.get(
            "prompt",
            "<|startoftranscription|><|zh|><|transcribe|><|zh|><|notimestamps|><|wo_itn|>",
        )

        logger.info(f"Qwen-Audio默认prompt: {self.default_prompt}")

    def transcribe(self, wav_buffer):
        """离线转录音频"""
        try:
            if self.model is None:
                raise ValueError("Qwen-Audio模型未初始化")

            if not hasattr(self.model, "generate"):
                raise AttributeError("Qwen-Audio模型没有generate方法")

            logger.debug(f"Qwen-Audio离线转录参数: prompt={self.default_prompt}")

            # 使用Qwen-Audio进行转录
            results = self.model.generate(input=wav_buffer, prompt=self.default_prompt)

            if len(results) > 0:
                text = results[0].get("text", "")
                # 清理文本，移除可能的特殊标签
                text = re.sub(r"<.*?>", "", text)  # 移除尖括号标签
                text = text.strip()
                return text
            else:
                return ""

        except Exception as e:
            logger.error(f"Qwen-Audio离线转录失败: {e}")
            raise

class QwenStreaming(ASRStreamingBase):
    """Qwen-Audio流式识别实现"""

    def __init__(self, model_dir, **kwargs):
        super().__init__(model_dir, **kwargs)

        logger.info(f"初始化Qwen-Audio流式模型: {model_dir}")

        try:
            self.model = AutoModel(
                model=model_dir, device="cuda", vad_model=None, disable_pbar=True, disable_update=True
            )

            if self.model is None:
                raise ValueError("AutoModel返回None，模型初始化失败")

            logger.info("Qwen-Audio流式模型初始化成功")

        except Exception as e:
            logger.error(f"Qwen-Audio流式模型初始化失败: {e}")
            raise

        # Qwen-Audio的默认prompt模板
        self.default_prompt = kwargs.get(
            "prompt",
            "<|startoftranscription|><|zh|><|transcribe|><|zh|><|notimestamps|><|wo_itn|>",
        )

        # 语音缓冲区
        self.wav_buffer = np.empty(0, dtype=np.float32)

        logger.info(f"Qwen-Audio默认prompt: {self.default_prompt}")

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
                raise ValueError("Qwen-Audio模型未初始化")

            if not hasattr(self.model, "generate"):
                raise AttributeError("Qwen-Audio模型没有generate方法")

            logger.debug(f"Qwen-Audio流式转录参数: prompt={self.default_prompt}")

            # 使用Qwen-Audio进行转录
            results = self.model.generate(
                input=self.wav_buffer, prompt=self.default_prompt
            )

            logger.info(f"Qwen-Audio流式转录结果: {results}")

            if len(results) > 0:
                text = results[0].get("text", "")
                # 清理文本，移除可能的特殊标签
                text = re.sub(r"<.*?>", "", text)  # 移除尖括号标签
                text = text.strip()
                return text
            else:
                return ""

        except Exception as e:
            logger.error(f"Qwen-Audio流式转录失败: {e}")
            raise

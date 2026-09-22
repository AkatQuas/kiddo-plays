#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SenseVoice离线和流式识别实现
"""

import os
import re

import numpy as np
from common.logger_config import logger
from funasr import AutoModel
from model.model_base import ASROfflineBase, ASRStreamingBase


class SenseVoiceOffline(ASROfflineBase):
    """SenseVoice离线识别实现"""

    def __init__(self, model_dir, **kwargs):
        super().__init__(model_dir, **kwargs)

        # 从kwargs中提取参数，设置默认值
        device = kwargs.get('device', "cuda")

        # SenseVoice Small模型配置
        self.model = AutoModel(
            model=model_dir,
            vad_model=None,
            punc_model=None,
            spk_model=None,
            device=device,
            disable_pbar=True,
            disable_update=True,
        )

    def transcribe(self, wav_buffer):
        # SenseVoice特定的转录配置
        transcribe_kwargs = {
            "cache": {},
            "language": "zh",  # SenseVoice支持多语言自动检测
            "use_itn": True,
            "output_timestamp": True,
            "ban_emo_unk": True,
        }
        results = self.model.generate(input=wav_buffer, **transcribe_kwargs)
        if len(results) > 0:
            text = results[0].get("text", "")
            # SenseVoice可能有不同的输出格式，这里统一处理
            text = re.sub(r"<.*?>", "", text)  # 移除标签
            return text
        else:
            return ""

class SenseVoiceStreaming(ASRStreamingBase):
    """SenseVoice流式识别实现"""

    def __init__(self, model_dir, **kwargs):
        super().__init__(model_dir, **kwargs)

        # 从kwargs中提取参数，设置默认值
        device = kwargs.get('device', "cuda")

        # SenseVoice Small模型配置
        self.model = AutoModel(
            model=model_dir,
            vad_model=None,
            punc_model=None,
            spk_model=None,
            device=device,
            disable_pbar=True,
            disable_update=True,
        )

        # 语音缓冲区
        self.wav_buffer = np.empty(0, dtype=np.float32)

    def get_wav_buffer(self):
        return self.wav_buffer

    def input(self, streaming_wav_np):
        if len(self.wav_buffer) == 0:
            self.wav_buffer = streaming_wav_np.astype(np.float32)
        else:
            self.wav_buffer = np.concatenate(
                (self.wav_buffer, streaming_wav_np.astype(np.float32))
            )

    def get_input_length(self):
        return len(self.wav_buffer)

    def clear_state(self):
        self.wav_buffer = np.empty(0, dtype=np.float32)

    def transcribe(self):
        # SenseVoice特定的转录配置
        transcribe_kwargs = {
            "cache": {},
            "language": "zh",  # SenseVoice支持多语言自动检测
            "use_itn": True,
            "output_timestamp": False,
            "ban_emo_unk": True,
        }
        try:
            results = self.model.generate(input=self.wav_buffer, **transcribe_kwargs)
            logger.info(f"SenseVoice转录结果: {results}")
            if len(results) > 0:
                text = results[0].get("text", "")
                # SenseVoice可能包含情感、事件等标签，需要特殊处理
                text = re.sub(r"<.*?>", "", text)  # 移除尖括号标签
                return text
            else:
                return ""
        except Exception as e:
            logger.error(f"SenseVoice转录失败: {e}")
            raise

    def transcribe_with_timestamp(self):
        # SenseVoice特定的转录配置，包含时间戳
        transcribe_kwargs = {
            "cache": {},
            "language": "zh",  # SenseVoice支持多语言自动检测
            "use_itn": True,
            "output_timestamp": True,
            "ban_emo_unk": True,
        }
        try:
            results = self.model.generate(input=self.wav_buffer, **transcribe_kwargs)
            logger.info(f"SenseVoice转录结果(带时间戳): {results}")
            if len(results) > 0:
                result = results[0].copy()
                # 对text进行正则表达式过滤，移除标签
                if "text" in result:
                    result["text"] = re.sub(r"<.*?>", "", result["text"])
                return result
            else:
                return {"text": "", "timestamp": [], "words": []}
        except Exception as e:
            logger.error(f"SenseVoice转录失败: {e}")
            raise

    def save(self, sentence_id):
        """保存音频和消息到文件"""
        try:
            # 确保目录存在
            audio_dir = "/workspace/audio"
            os.makedirs(audio_dir, exist_ok=True)

            # 检查音频数据
            if len(self.wav_buffer) == 0:
                logger.warning("没有音频数据可保存")
                return

            # 保存为WAV格式
            import wave

            audio_filename = f"sensevoice_audio_{sentence_id}.wav"
            audio_path = os.path.join(audio_dir, audio_filename)

            with wave.open(audio_path, "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(16000)
                audio_data = np.frombuffer(self.wav_buffer, np.float32).astype(np.int16)
                wav_file.writeframes(audio_data.tobytes())

            logger.info(f"已保存SenseVoice音频文件 {audio_filename}")

        except Exception as e:
            logger.error(f"保存SenseVoice音频文件时出错: {e}")
            import traceback
            traceback.print_exc()

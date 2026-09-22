#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FunASR离线和流式识别实现
"""

import os
import re

import numpy as np
from common.logger_config import logger
from funasr import AutoModel
from model.model_base import ASROfflineBase, ASRStreamingBase


class FunASROffline(ASROfflineBase):
    def __init__(self, model_dir, **kwargs):
        super().__init__(model_dir, **kwargs)

        # 从kwargs中提取参数，设置默认值
        device = kwargs.get('device', "cuda")
        vad_model = kwargs.get('vad_model', None)
        punc_model = kwargs.get('punc_model', None)
        spk_model = kwargs.get('spk_model', None)

        logger.info(f"FunASR离线模型配置 - 主模型: {model_dir}")
        if vad_model:
            logger.info(f"VAD模型: {vad_model}")
        if punc_model:
            logger.info(f"标点模型: {punc_model}")
        if spk_model:
            logger.info(f"说话人模型: {spk_model}")

        self.model = AutoModel(
            model=model_dir,
            vad_model=vad_model,
            punc_model=punc_model,
            spk_model=spk_model,
            device=device,
            disable_pbar=True,
            disable_update=True,  # 禁用版本检查和自动下载
        )

    def transcribe(self, wav_buffer):
        transcribe_kwargs = {
            "batch_size_s": 60,
            "merge_vad": True,
            "cache": {},
            "language": "zh",
            "use_itn": True,
            "merge_length_s": 15,
        }
        results = self.model.generate(input=wav_buffer, **transcribe_kwargs)
        if len(results) > 0:
            text = results[0].get("text", "")
            return text
        else:
            return ""

class FunASRStreaming(ASRStreamingBase):
    def __init__(self, model_dir, **kwargs):
        super().__init__(model_dir, **kwargs)

        # 从kwargs中提取参数，设置默认值
        device = kwargs.get('device', "cuda")
        vad_model = kwargs.get('vad_model', None)
        punc_model = kwargs.get('punc_model', None)
        spk_model = kwargs.get('spk_model', None)

        logger.info(f"FunASR流式模型配置 - 主模型: {model_dir}")
        if vad_model:
            logger.info(f"VAD模型: {vad_model}")
        if punc_model:
            logger.info(f"标点模型: {punc_model}")
        if spk_model:
            logger.info(f"说话人模型: {spk_model}")

        # 语音识别
        self.model = AutoModel(
            model=model_dir,
            vad_model=vad_model,
            punc_model=punc_model,
            spk_model=spk_model,
            device=device,
            disable_pbar=True,
            disable_update=True,  # 禁用版本检查和自动下载
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
        transcribe_kwargs = {
            "batch_size_s": 60,
            "merge_vad": True,
            "cache": {},
            "language": "zh",
            "use_itn": True,
            "merge_length_s": 15,
        }
        try:
            results = self.model.generate(input=self.wav_buffer, **transcribe_kwargs)
            if len(results) > 0:
                # <|zh|><|NEUTRAL|><|Speech|><|withitn|>我们也非常荣幸, text字段是这样，需要通过正则表达式过滤掉前缀内容
                # <|en|><|EMO_UNKNOWN|><|BGM|><|withitn|>And in fact
                # <|zh|><|NEUTRAL|><|d|><|withitn|>我们也非常荣幸, text字段是这样，需要通过正则表达式过滤掉前缀内容
                text = results[0].get("text", "")
                text = re.sub(r"<.*>", "", text)
                return text
            else:
                return ""
        except Exception as e:
            logger.error(f"转录失败: {e}")
            raise

    def save(self, sentence_id, audio_buffer):
        """保存音频和消息到文件"""
        try:
            # 确保目录存在
            audio_dir = "/workspace/audio"
            os.makedirs(audio_dir, exist_ok=True)

            # 检查音频数据
            if len(self.wav_buffer) == 0:
                logger.warning("没有音频数据可保存")
                return

            # 记录音频数据信息
            logger.debug(
                f"音频数据信息: 长度={len(self.wav_buffer)}, 类型={self.wav_buffer.dtype}"
            )
            logger.debug(f"数据范围: [{self.wav_buffer.min()}, {self.wav_buffer.max()}]")
            logger.debug(
                f"数据均值: {self.wav_buffer.mean():.2f}, 标准差: {self.wav_buffer.std():.2f}"
            )

            # 保存为WAV格式（可播放）
            import wave

            audio_filename = f"audio_{sentence_id}.wav"
            audio_path = os.path.join(audio_dir, audio_filename)

            with wave.open(audio_path, "wb") as wav_file:
                # 设置WAV文件参数
                wav_file.setnchannels(1)  # 单声道
                wav_file.setsampwidth(2)  # 16位
                wav_file.setframerate(16000)  # 16kHz采样率

                audio_data = np.frombuffer(self.wav_buffer, np.float32).astype(np.int16)
                wav_file.writeframes(audio_data.tobytes())

            logger.info(f"已保存音频文件 {audio_filename}")

            audio_in_offline = audio_buffer.tobytes()
            # 将audio_buffer中的数据合并为wav文件
            wav_filename = f"audio_{sentence_id}_all.wav"

            wav_path = os.path.join(audio_dir, wav_filename)
            with wave.open(wav_path, "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(16000)
                wav_file.writeframes(audio_in_offline)

            logger.info(f"已保存合并后的WAV文件 {wav_filename}")

        except Exception as e:
            logger.error(f"保存音频文件时出错: {e}")
            import traceback

            traceback.print_exc()

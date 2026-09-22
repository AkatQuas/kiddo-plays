#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频增益控制模块
提供自动增益控制、音频窗口管理等功能
"""

import numpy as np
from common.logger_config import logger


class AudioGainController:
    """音频增益控制器"""

    def __init__(self,
                 sample_rate: int = 16000,
                 window_duration: float = 1.0,
                 target_db: float = -10.0):
        """
        初始化音频增益控制器

        Args:
            sample_rate: 采样率
            window_duration: 音频窗口时长（秒）
            target_db: 目标响度（dB）
        """
        self.sample_rate = sample_rate
        self.window_duration = window_duration
        self.target_db = target_db

        # 音频窗口
        self.audio_window_size = int(sample_rate * window_duration)
        self.audio_window = np.empty(0, dtype=np.int16)

        logger.info(f"音频增益控制器初始化 - 采样率: {sample_rate}, 窗口时长: {window_duration}s, "
                   f"目标响度: {target_db}dB")

    def reset_window(self):
        """重置音频窗口"""
        self.audio_window = np.empty(0, dtype=np.int16)
        logger.debug("音频增益窗口已重置")

    def process_audio_frame(self, input_audio: np.ndarray) -> np.ndarray:
        """
        处理音频帧

        Args:
            input_audio: 输入音频数据 (int16)

        Returns:
            np.ndarray: 处理后的音频数据，如果窗口未准备好返回空数组
        """
        # 更新音频窗口
        if len(self.audio_window) == 0:
            self.audio_window = input_audio.copy()
        else:
            self.audio_window = np.concatenate((self.audio_window, input_audio))

        # 保持窗口大小
        if len(self.audio_window) > self.audio_window_size:
            self.audio_window = self.audio_window[-self.audio_window_size:]

        # 如果窗口还没填满，返回空音频
        if len(self.audio_window) < self.audio_window_size:
            return np.empty(0, dtype=np.int16)

        # 窗口填满后，应用自动增益控制到整个窗口
        gained_window = self._apply_auto_gain(self.audio_window)

        # 提取当前帧对应的增益后数据
        current_frame_size = len(input_audio)
        current_gained_frame = gained_window[-current_frame_size:]

        return current_gained_frame

    def _calculate_rms_db(self, audio_np: np.ndarray) -> float:
        """
        计算音频的RMS响度（dB）

        Args:
            audio_np: 音频数据

        Returns:
            float: RMS响度（dB）
        """
        if len(audio_np) == 0:
            return -60.0  # 静音默认值

        # 计算RMS
        rms = np.sqrt(np.mean(audio_np.astype(np.float32) ** 2))

        # 避免log(0)
        if rms < 1e-10:
            return -60.0

        # 转换为dB，参考值为int16最大值32767
        db = 20 * np.log10(rms / 32767.0)
        return db

    def _apply_auto_gain(self, audio_np: np.ndarray) -> np.ndarray:
        """
        应用自动增益控制

        Args:
            audio_np: 输入音频数据

        Returns:
            np.ndarray: 增益后的音频数据
        """
        current_db = self._calculate_rms_db(audio_np)
        logger.debug(f"当前音频响度: {current_db:.1f}dB")

        # 如果当前响度低于-30dB，认为是静音，不进行增益
        if current_db < -30.0:
            logger.debug("音频响度过低，跳过增益处理")
            return audio_np

        # 计算需要的增益
        gain_db = self.target_db - current_db

        # 限制增益范围，避免过度放大
        gain_db = np.clip(gain_db, -20.0, 20.0)

        # 转换为线性增益
        gain_linear = 10 ** (gain_db / 20.0)

        # 应用增益
        gained_audio = audio_np.astype(np.float32) * gain_linear

        # 防止溢出
        gained_audio = np.clip(gained_audio, -32768, 32767)

        logger.debug(f"自动增益: {current_db:.1f}dB -> {self.target_db}dB, 增益: {gain_db:.1f}dB")

        return gained_audio.astype(np.int16)

    def get_current_db(self) -> float:
        """
        获取当前音频窗口的响度

        Returns:
            float: 当前响度（dB），如果窗口未准备好返回-60.0
        """
        if len(self.audio_window) < self.audio_window_size:
            return -60.0
        return self._calculate_rms_db(self.audio_window)

    def get_window_info(self) -> dict:
        """
        获取音频窗口信息

        Returns:
            dict: 窗口信息
        """
        return {
            "window_size": self.audio_window_size,
            "current_window_length": len(self.audio_window),
            "window_ready": len(self.audio_window) >= self.audio_window_size,
            "target_db": self.target_db,
            "current_db": self.get_current_db(),
            "sample_rate": self.sample_rate,
            "window_duration": self.window_duration
        }

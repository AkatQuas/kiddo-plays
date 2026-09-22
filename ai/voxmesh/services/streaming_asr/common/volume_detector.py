#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音量检测模块
使用纯NumPy计算音频片段的分贝大小，并判断是否需要音量警告
避免librosa依赖
"""

import time
from dataclasses import dataclass
from typing import Callable, Optional

import numpy as np

from common.logger_config import logger


@dataclass
class VolumeCheckResult:
    """音量检测结果"""
    rms_db: float  # RMS分贝值
    peak_db: float  # 峰值分贝值
    is_low_volume: bool  # 是否低音量
    duration_s: float  # 检测的音频时长
    detection_time_ms: float = 0.0  # 检测耗时(毫秒)

    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            'rms_db': round(self.rms_db, 2),
            'peak_db': round(self.peak_db, 2),
            'is_low_volume': self.is_low_volume,
            'duration_s': round(self.duration_s, 3),
            'detection_time_ms': round(self.detection_time_ms, 2)
        }


class VolumeDetector:
    """音量检测器"""

    def __init__(self,
                 sample_rate: int = 16000,
                 volume_threshold_db: float = -30.0,
                 check_duration_s: float = 2.0,
                 warning_callback: Optional[Callable[[VolumeCheckResult], None]] = None,
                 warning_interval_s: float = 10.0,
                 enable_peak_detection: bool = True):
        """
        初始化音量检测器

        Args:
            sample_rate: 采样率
            volume_threshold_db: 音量阈值(dB)，低于此值认为是低音量
            check_duration_s: 检测时长(秒)，累积多长时间的音频进行检测
            warning_callback: 低音量警告回调函数
            warning_interval_s: 警告间隔(秒)，避免频繁发送警告
            enable_peak_detection: 是否启用峰值检测
        """
        self.sample_rate = sample_rate
        self.volume_threshold_db = volume_threshold_db
        self.check_duration_s = check_duration_s
        self.warning_callback = warning_callback
        self.warning_interval_s = warning_interval_s
        self.enable_peak_detection = enable_peak_detection

        # 音频缓冲区
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_max_samples = int(check_duration_s * sample_rate)

        # 警告相关
        self.last_warning_time = 0.0


    def _calculate_rms_db(self, audio_data: np.ndarray) -> float:
        """
        使用纯NumPy计算RMS分贝值

        Args:
            audio_data: 音频数据 (float32格式，范围[-1, 1])

        Returns:
            float: RMS分贝值
        """
        if len(audio_data) == 0:
            return -np.inf

        # 计算RMS (Root Mean Square)
        rms = np.sqrt(np.mean(audio_data ** 2))

        # 转换为分贝，避免log(0)的情况
        if rms > 1e-10:
            rms_db = 20 * np.log10(rms)
        else:
            rms_db = -np.inf

        return rms_db

    def _calculate_peak_db(self, audio_data: np.ndarray) -> float:
        """
        使用纯NumPy计算峰值分贝值

        Args:
            audio_data: 音频数据 (float32格式，范围[-1, 1])

        Returns:
            float: 峰值分贝值
        """
        if len(audio_data) == 0:
            return -np.inf

        # 计算峰值幅度
        peak_amplitude = np.max(np.abs(audio_data))

        # 转换为分贝
        if peak_amplitude > 1e-10:
            peak_db = 20 * np.log10(peak_amplitude)
        else:
            peak_db = -np.inf

        return peak_db

    def calculate_volume(self, audio_data: np.ndarray, detection_time_ms: float = 0.0) -> VolumeCheckResult:
        """
        计算音频数据的音量

        Args:
            audio_data: 音频数据 (float32格式，范围[-1, 1])

        Returns:
            VolumeCheckResult: 音量检测结果
        """
        if len(audio_data) == 0:
            return VolumeCheckResult(
                rms_db=-np.inf,
                peak_db=-np.inf,
                is_low_volume=True,
                duration_s=0.0
            )

        # 计算音频时长
        duration_s = len(audio_data) / self.sample_rate

        # 使用纯NumPy计算RMS分贝值
        rms_db = self._calculate_rms_db(audio_data)

        # 计算峰值分贝
        peak_db = -np.inf
        if self.enable_peak_detection:
            peak_db = self._calculate_peak_db(audio_data)

        # 判断是否低音量
        is_low_volume = rms_db < self.volume_threshold_db

        result = VolumeCheckResult(
            rms_db=rms_db,
            peak_db=peak_db,
            is_low_volume=is_low_volume,
            duration_s=duration_s,
            detection_time_ms=detection_time_ms
        )

        return result

    def add_audio_frame(self, audio_frame: np.ndarray) -> Optional[VolumeCheckResult]:
        """
        添加单帧音频数据，实现流式检测

        Args:
            audio_frame: 单帧音频数据 (支持int16或float32格式)

        Returns:
            VolumeCheckResult: 如果进行了检测则返回结果，否则返回None
        """
        try:
            # 确保音频帧是float32格式并归一化到[-1, 1]范围
            if audio_frame.dtype == np.int16:
                audio_frame_normalized = audio_frame.astype(np.float32) / 32768.0
            elif audio_frame.dtype == np.float32:
                # 如果已经是float32但可能没有归一化，检查范围
                max_abs = np.max(np.abs(audio_frame))
                if max_abs > 1.0:
                    audio_frame_normalized = audio_frame / 32768.0
                else:
                    audio_frame_normalized = audio_frame
            else:
                audio_frame_normalized = audio_frame.astype(np.float32)

            # 添加到缓冲区
            self.audio_buffer = np.concatenate([self.audio_buffer, audio_frame_normalized])

            # 如果缓冲区超过最大长度，保留最新的数据
            if len(self.audio_buffer) > self.buffer_max_samples:
                self.audio_buffer = self.audio_buffer[-self.buffer_max_samples:]

            # 如果累积的数据足够进行检测
            if len(self.audio_buffer) >= int(self.check_duration_s * self.sample_rate):
                # 测量检测耗时
                start_time = time.time()
                result = self.calculate_volume(self.audio_buffer)
                detection_time = time.time() - start_time

                # 更新结果中的耗时信息
                result.detection_time_ms = detection_time * 1000


                # 处理低音量警告
                if result.is_low_volume and self.warning_callback:
                    # 检查警告间隔，避免过于频繁
                    if time.time() - self.last_warning_time > self.warning_interval_s:
                        self.warning_callback(result)
                        self.last_warning_time = time.time()

                return result

            return None

        except Exception as e:
            logger.error(f"音量检测异常: {e}")
            return None

    def reset_buffer(self):
        """重置音频缓冲区"""
        self.audio_buffer = np.array([], dtype=np.float32)

def create_volume_detector(sample_rate: int = 16000,
                          volume_threshold_db: float = -30.0,
                          check_duration_s: float = 3.0,
                          warning_callback: Optional[Callable] = None,
                          **kwargs) -> VolumeDetector:
    """
    Args:
        sample_rate: 采样率
        volume_threshold_db: 音量阈值
        check_duration_s: 检测时长
        warning_callback: 警告回调
        **kwargs: 其他参数

    Returns:
        VolumeDetector: 音量检测器实例
    """
    return VolumeDetector(
        sample_rate=sample_rate,
        volume_threshold_db=volume_threshold_db,
        check_duration_s=check_duration_s,
        warning_callback=warning_callback,
        **kwargs
    )

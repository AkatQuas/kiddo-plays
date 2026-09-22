#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
说话人特征提取模型基类
定义所有embedding模型的通用接口
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Tuple

import numpy as np
import torch
from logger_config import get_logger
from pyannote.audio import Model

logger = get_logger()


class BaseEmbeddingModel(ABC):
    """说话人特征提取模型基类"""

    def __init__(self, model_dir: str, device: str = "cuda", sample_rate: int = 16000,
                 segmentation_model_path: str = None):
        """
        初始化模型

        Args:
            model_dir: 模型路径
            device: 计算设备
            sample_rate: 音频采样率
            segmentation_model_path: 分割模型路径
        """
        self.model_dir = model_dir
        self.device = device
        self.sample_rate = sample_rate
        self.segmentation_model_path = segmentation_model_path
        self.model = None
        self.model_name = "unknown"
        self.vad_model = None

    @abstractmethod
    def load_model(self) -> None:
        """加载模型"""
        pass

    def load_segmentation_model(self) -> None:
        """加载分割模型"""
        if self.segmentation_model_path:
            logger.info(f"正在加载分割模型: {self.segmentation_model_path}")
            self.vad_model = Model.from_pretrained(self.segmentation_model_path, device=self.device)
            logger.info("分割模型加载成功")
        else:
            logger.info("未提供分割模型路径，将跳过语音分段")

    def get_vad_segments(self, audio_data: np.ndarray, threshold: float = 0.7) -> List[Tuple[float, float, np.ndarray]]:
        """
        使用pyannote模型根据阈值切分音频段

        Args:
            audio_data: 音频数据
            threshold: VAD阈值，超过此值为语音段

        Returns:
            List[Tuple[float, float, np.ndarray]]: 语音段列表 [(start_time, end_time, audio_data), ...]
        """
        if self.vad_model is None:
            logger.warning("分割模型未加载，返回整个音频")
            return [(0.0, len(audio_data) / self.sample_rate, audio_data)]

        try:
            # 将音频数据转换为tensor
            waveform = torch.from_numpy(audio_data).float().unsqueeze(0)
            if waveform.device != next(self.vad_model.parameters()).device:
                waveform = waveform.to(next(self.vad_model.parameters()).device)

            # VAD检测
            vad_output = self.vad_model(waveform)
            vad_probs = torch.max(vad_output, dim=2)[0].squeeze().cpu().detach().numpy()

            # 计算每帧对应的样本范围
            frame_count = len(vad_probs)
            samples_per_frame = len(audio_data) // frame_count

            segments = []
            current_start = None

            for i, prob in enumerate(vad_probs):
                frame_start = i * samples_per_frame
                min((i + 1) * samples_per_frame, len(audio_data))

                if prob > threshold:
                    # 语音帧
                    if current_start is None:
                        current_start = frame_start
                else:
                    # 非语音帧
                    if current_start is not None:
                        # 结束当前语音段
                        segment_data = audio_data[current_start:frame_start]
                        start_time = current_start / self.sample_rate
                        end_time = frame_start / self.sample_rate
                        if len(segment_data) > 0:
                            segments.append((start_time, end_time, segment_data))
                        current_start = None

            # 处理最后一个语音段
            if current_start is not None:
                segment_data = audio_data[current_start:]
                start_time = current_start / self.sample_rate
                end_time = len(audio_data) / self.sample_rate
                if len(segment_data) > 0:
                    segments.append((start_time, end_time, segment_data))

            return segments if segments else [(0.0, len(audio_data) / self.sample_rate, audio_data)]

        except Exception as e:
            logger.error(f"VAD分段失败: {e}")
            return [(0.0, len(audio_data) / self.sample_rate, audio_data)]

    def sv_chunk(self, vad_segments: List[Tuple[float, float, np.ndarray]], fs: int = 16000) -> List[Tuple[float, float, np.ndarray]]:
        """
        对VAD分段进行滑动窗口切分
        """
        config = {
            "seg_dur": 1.5,
            "seg_shift": 0.75,
        }

        def seg_chunk(seg_data):
            seg_st, seg_ed, data = seg_data
            chunk_len = int(config["seg_dur"] * fs)
            chunk_shift = int(config["seg_shift"] * fs)
            last_chunk_ed = 0
            seg_res = []

            for chunk_st in range(0, data.shape[0], chunk_shift):
                chunk_ed = min(chunk_st + chunk_len, data.shape[0])
                if chunk_ed <= last_chunk_ed:
                    break
                last_chunk_ed = chunk_ed
                chunk_st = max(0, chunk_ed - chunk_len)
                chunk_data = data[chunk_st:chunk_ed]

                if chunk_data.shape[0] < chunk_len:
                    chunk_data = np.pad(chunk_data, (0, chunk_len - chunk_data.shape[0]), "constant")

                chunk_start_time = chunk_st / fs + seg_st
                chunk_end_time = chunk_ed / fs + seg_st
                seg_res.append((chunk_start_time, chunk_end_time, chunk_data))

            return seg_res

        segs = []
        for seg in vad_segments:
            segs.extend(seg_chunk(seg))

        return segs

    @abstractmethod
    def extract_chunk_features(self, chunk_data: np.ndarray) -> Optional[np.ndarray]:
        """
        提取单个音频片段的特征

        Args:
            chunk_data: 音频片段数据

        Returns:
            np.ndarray: 特征向量，失败时返回None
        """
        pass

    def extract_features(self, audio_path: str) -> Optional[np.ndarray]:
        """
        使用分段策略提取说话人特征

        Args:
            audio_path: 音频文件路径

        Returns:
            np.ndarray: 特征向量，失败时返回None
        """
        try:
            logger.info(f"开始提取特征: {audio_path}")
            import torchaudio
            # 加载音频文件
            waveform, sr = torchaudio.load(audio_path)
            logger.info(f"音频加载成功: 采样率={sr}, 形状={waveform.shape}")

            # 重采样到目标采样率
            if sr != self.sample_rate:
                logger.info(f"重采样: {sr} -> {self.sample_rate}")
                resampler = torchaudio.transforms.Resample(sr, self.sample_rate)
                waveform = resampler(waveform)

            # 转换为单声道
            if waveform.shape[0] > 1:
                logger.info(f"转换为单声道: {waveform.shape[0]}通道 -> 1通道")
                waveform = torch.mean(waveform, dim=0, keepdim=True)

            # 转换为numpy数组
            audio_data = waveform.squeeze().numpy()
            logger.info(f"音频预处理完成: 长度={len(audio_data)}, 时长={len(audio_data)/self.sample_rate:.2f}秒")

            # 1. 获取VAD分段
            vad_segments = self.get_vad_segments(audio_data)
            if vad_segments:
                vad_info = ", ".join([f"({seg[0]:.2f}-{seg[1]:.2f}s)" for seg in vad_segments])
                logger.info(f"VAD分段完成: 共{len(vad_segments)}个语音段 [{vad_info}]")
            else:
                logger.info("VAD分段完成: 未检测到语音段")

            # 2. 对每个VAD段进行滑动窗口切分
            chunks = self.sv_chunk(vad_segments, self.sample_rate)
            if chunks:
                chunks_info = ", ".join([f"({chunk[0]:.2f}-{chunk[1]:.2f}s)" for chunk in chunks[:5]])  # 只显示前5个
                if len(chunks) > 5:
                    chunks_info += f"...等{len(chunks)}个"
                logger.info(f"滑动窗口切分完成: 共{len(chunks)}个音频块 [{chunks_info}]")
            else:
                logger.info("滑动窗口切分完成: 未生成音频块")

            # 3. 批量特征提取
            embeddings = []
            for i, chunk in enumerate(chunks):
                chunk_embedding = self.extract_chunk_features(chunk[2])
                if chunk_embedding is not None:
                    embeddings.append(chunk_embedding)
                if (i + 1) % 10 == 0:
                    logger.debug(f"已处理 {i + 1}/{len(chunks)} 个音频块")
            logger.info(f"特征提取完成: 有效块={len(embeddings)}/{len(chunks)}")

            # 4. 特征融合 (均值 + L2归一化)
            if embeddings:
                final_embedding = np.mean(embeddings, axis=0)
                # L2归一化
                norm = np.linalg.norm(final_embedding)
                if norm > 0:
                    final_embedding = final_embedding / norm
                logger.info(f"特征融合完成: 维度={final_embedding.shape}, 范数={norm:.4f}")
                return final_embedding
            else:
                logger.warning("未提取到有效特征")
                return None

        except Exception as e:
            logger.error(f"特征提取失败 {audio_path}: {e}")
            return None

    def get_model_info(self) -> dict:
        """
        获取模型信息

        Returns:
            dict: 包含模型名称的字典
        """
        return {
            "model_name": self.model_name
        }

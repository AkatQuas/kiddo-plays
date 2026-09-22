#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
独立的说话人识别聚类模块
提供基于音频缓冲区的说话人识别功能
"""

import numpy as np
import torch
from common.logger_config import logger
from funasr import AutoModel
from speaker.km_clustering import IncrementalSpeakerClustering


class SpeakerClustering:
    """
    独立的说话人识别聚类类
    提供基于音频缓冲区的说话人识别功能
    """

    def __init__(self,
                 embedding_model_dir,
                 segmentation_model_path,
                 delta_new: float = 0.72,
                 max_speakers: int = 20,
                 device: str = "cuda"):
        """
        初始化说话人识别聚类器

        Args:
            embedding_model_dir: 说话人特征提取模型路径
            segmentation_model_path: 说话人分割模型路径
            delta_new: 说话人识别阈值，越低越敏感
            max_speakers: 最大说话人数
            device: 计算设备
        """
        self.embedding_model_dir = embedding_model_dir
        self.segmentation_model_path = segmentation_model_path
        self.delta_new = delta_new
        self.max_speakers = max_speakers
        self.device = device

        self.last_result = ("0", 0.0)

        logger.info("初始化说话人识别聚类器")
        logger.info(f"  特征提取模型: {embedding_model_dir}")
        logger.info(f"  分割模型: {segmentation_model_path}")
        logger.info(f"  识别阈值: {delta_new}")
        logger.info(f"  最大说话人数: {max_speakers}")
        logger.info(f"  计算设备: {device}")

        try:
            self.model = AutoModel(
                model=self.embedding_model_dir,
                vad_model=None,
                punc_model=None,
                spk_model=None,
                device=device,
                disable_pbar=True,
                disable_update=True,
            )

            # 初始化说话人聚类器
            self.speaker_cluster = IncrementalSpeakerClustering(
                delta_new=delta_new,
                max_speakers=max_speakers
            )

            logger.info("说话人识别聚类器初始化完成")

        except Exception as e:
            logger.error(f"说话人识别聚类器初始化失败: {e}")
            raise

    def sv_chunk(self, audio_data: np.ndarray, fs: int = 16000) -> list:
        """
        对音频进行滑动窗口切分

        Args:
            audio_data: 音频数据
            fs: 采样率

        Returns:
            list: 切分后的片段 [(start_time, end_time, audio_data), ...]
        """
        config = {
            "seg_dur": 1.5,
            "seg_shift": 0.75,
        }

        chunk_len = int(config["seg_dur"] * fs)
        chunk_shift = int(config["seg_shift"] * fs)
        last_chunk_ed = 0
        chunks = []

        for chunk_st in range(0, audio_data.shape[0], chunk_shift):
            chunk_ed = min(chunk_st + chunk_len, audio_data.shape[0])
            if chunk_ed <= last_chunk_ed:
                break
            last_chunk_ed = chunk_ed
            chunk_st = max(0, chunk_ed - chunk_len)
            chunk_data = audio_data[chunk_st:chunk_ed]

            if chunk_data.shape[0] < chunk_len:
                chunk_data = np.pad(chunk_data, (0, chunk_len - chunk_data.shape[0]), "constant")

            chunk_start_time = chunk_st / fs
            chunk_end_time = chunk_ed / fs
            chunks.append((chunk_start_time, chunk_end_time, chunk_data))

        return chunks

    def extract_batch_features(self, chunk_data_list: list) -> list:
        """
        批量提取音频片段的特征

        Args:
            chunk_data_list: 音频片段数据列表

        Returns:
            list: 特征向量列表
        """
        if not chunk_data_list:
            return []

        try:
            # 批量处理所有chunk
            results = self.model.generate(input=chunk_data_list, batch_size=len(chunk_data_list))
            if len(results) == 0:
                return []

            embeddings = []
            with torch.no_grad():
                # 批量推理返回的是 [{'spk_embedding': tensor([[emb1], [emb2], [emb3], ...])}]
                batch_embeddings = results[0]['spk_embedding']

                if isinstance(batch_embeddings, torch.Tensor):
                    batch_embeddings = batch_embeddings.cpu().numpy()

                # batch_embeddings 是 (N, D) 的二维数组，N是批量大小，D是特征维度
                # 将其转换为列表，每个元素是一个特征向量
                for i in range(batch_embeddings.shape[0]):
                    embeddings.append(batch_embeddings[i])

            logger.info(f"批量特征提取完成，输入{len(chunk_data_list)}个片段，输出{len(embeddings)}个特征")
            return embeddings

        except Exception as e:
            logger.warning(f"批量特征提取失败: {e}，回退到逐个提取")
            # 回退到逐个提取
            embeddings = []
            for chunk_data in chunk_data_list:
                chunk_embedding = self.extract_chunk_features(chunk_data)
                if chunk_embedding is not None:
                    embeddings.append(chunk_embedding)
            return embeddings

    def extract_chunk_features(self, chunk_data: np.ndarray) -> np.ndarray:
        """
        提取单个音频片段的特征

        Args:
            chunk_data: 音频片段数据

        Returns:
            np.ndarray: 特征向量，失败时返回None
        """
        try:
            results = self.model.generate(input=chunk_data)

            if len(results) == 0:
                return None

            with torch.no_grad():
                embedding = results[0]['spk_embedding']

                if isinstance(embedding, torch.Tensor):
                    embedding = embedding.cpu()
                    if embedding.dim() > 1:
                        embedding = embedding.squeeze()
                    embedding = embedding.numpy()
                elif isinstance(embedding, np.ndarray):
                    if embedding.ndim > 1:
                        embedding = embedding.squeeze()

                return embedding

        except Exception as e:
            logger.debug(f"音频片段特征提取失败: {e}")
            return None

    def register_speakers(self, speakers_data: list):
        """注册预定义的说话人"""
        if hasattr(self.speaker_cluster, 'register_speakers'):
            self.speaker_cluster.register_speakers(speakers_data)
            # 注册完说话人后，重置last_result为默认说话人
            default_speaker = self.speaker_cluster.get_default_speaker()
            self.last_result = (default_speaker, 0.0)
            logger.info(f"注册说话人完成，重置默认说话人为: {default_speaker}")
        else:
            logger.warning("当前聚类器不支持预注册说话人功能")

    def cluster(self, wav_buffer: np.ndarray) -> tuple:
        """
        对音频缓冲区进行说话人识别
        统一使用分段策略提取特征

        Args:
            wav_buffer: 音频数据缓冲区 (numpy.ndarray, dtype=float32)

        Returns:
            tuple: (speaker_id, distance) - 说话人标识和最近距离
        """
        try:
            if len(wav_buffer) == 0:
                logger.warning("音频缓冲区为空，返回上一次识别结果")
                return self.last_result

            # 统一使用分段策略
            # 1. 分段
            chunks = self.sv_chunk(wav_buffer, fs=16000)

            # 2. 批量特征提取
            embeddings = self.extract_batch_features([chunk[2] for chunk in chunks])

            if not embeddings:
                logger.warning("未提取到有效特征，返回上一次识别结果")
                return self.last_result

            logger.info(f"音频分段提取特征完成，共提取{len(embeddings)}个有效片段，总音频长度: {len(wav_buffer)}")

            try:
                # 进行说话人聚类识别
                current_speaker, distance = self.speaker_cluster.identify_single_speaker(embeddings)
            except RuntimeError as e:
                logger.info(f"说话人识别失败: {e}，返回上一个说话人: {self.last_result[0]}")
                return self.last_result

            # 保存成功的识别结果
            result = (current_speaker, distance)
            self.last_result = result

            logger.info(f"说话人识别结果: {current_speaker}, 距离: {distance:.4f}")

            return result

        except Exception as e:
            logger.error(f"说话人识别失败: {e}，返回上一次识别结果: {self.last_result}")
            return self.last_result

    def reset(self):
        """重置说话人聚类器状态"""
        try:
            self.speaker_cluster = IncrementalSpeakerClustering(
                delta_new=self.delta_new,
                max_speakers=self.max_speakers
            )
            # 重置时使用默认说话人
            default_speaker = self.speaker_cluster.get_default_speaker()
            self.last_result = (default_speaker, 0.0)
            logger.info("说话人聚类器状态已重置")
        except Exception as e:
            logger.error(f"重置说话人聚类器失败: {e}")

    def get_speaker_count(self) -> int:
        """获取当前识别的说话人数量"""
        try:
            # 从聚类器获取当前说话人数量
            # 这个方法的具体实现依赖于IncrementalSpeakerClustering的内部实现
            return getattr(self.speaker_cluster, 'n_clusters', 0)
        except Exception as e:
            logger.warning(f"获取说话人数量失败: {e}")
            return 0

    def get_info(self) -> dict:
        """获取说话人识别器信息"""
        return {
            "embedding_model_dir": self.embedding_model_dir,
            "segmentation_model_path": self.segmentation_model_path,
            "delta_new": self.delta_new,
            "max_speakers": self.max_speakers,
            "device": self.device,
            "current_speaker_count": self.get_speaker_count()
        }

    def embedding_port(self):
        """Return unified embedding port for cross-service use."""
        from voxmesh.embedding.adapters import StreamingEmbeddingAdapter

        return StreamingEmbeddingAdapter(self)

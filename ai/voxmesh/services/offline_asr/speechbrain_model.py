#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SpeechBrain说话人特征提取模型实现
"""

from typing import Optional

import numpy as np
import torch
from base_model import BaseEmbeddingModel
from logger_config import get_logger

logger = get_logger()


class SpeechBrainEmbeddingModel(BaseEmbeddingModel):
    """SpeechBrain说话人特征提取模型"""

    def __init__(self, model_dir: str, device: str = "cuda", sample_rate: int = 16000):
        super().__init__(model_dir, device, sample_rate)
        self.model_name = "speechbrain/spkrec-ecapa-voxceleb"

    def load_model(self) -> None:
        """加载SpeechBrain模型"""
        try:
            logger.info(f"正在加载SpeechBrain模型: {self.model_dir}")

            from speechbrain.inference.speaker import EncoderClassifier
            self.model = EncoderClassifier.from_hparams(
                source=self.model_dir,
                savedir=self.model_dir,
                run_opts={"device": self.device}
            )

            logger.info("SpeechBrain模型加载成功")

        except Exception as e:
            logger.error(f"SpeechBrain模型加载失败: {e}")
            raise

    def extract_chunk_features(self, chunk_data: np.ndarray) -> Optional[np.ndarray]:
        """
        提取单个音频片段的特征

        Args:
            chunk_data: 音频片段数据

        Returns:
            np.ndarray: 特征向量，失败时返回None
        """
        try:
            # 将numpy数组转换为tensor
            waveform = torch.from_numpy(chunk_data).float().unsqueeze(0)

            # 提取特征
            with torch.no_grad():
                embedding = self.model.encode_batch(waveform).squeeze().cpu().numpy()

            return embedding

        except Exception as e:
            logger.debug(f"音频片段特征提取失败: {e}")
            return None

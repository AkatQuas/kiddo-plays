#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Campplus说话人特征提取模型实现
"""

from typing import Optional

import numpy as np
import torch
from base_model import BaseEmbeddingModel
from logger_config import get_logger

logger = get_logger()


class CampplusEmbeddingModel(BaseEmbeddingModel):
    """Campplus说话人特征提取模型"""

    def __init__(self, model_dir: str, device: str = "cuda", sample_rate: int = 16000):
        super().__init__(model_dir, device, sample_rate)
        self.model_name = "speech_campplus_sv_zh-cn_16k-common"

    def load_model(self) -> None:
        """加载Campplus模型"""
        try:
            logger.info(f"正在加载Campplus模型: {self.model_dir}")

            from funasr import AutoModel
            self.model = AutoModel(
                model=self.model_dir,
                vad_model=None,
                punc_model=None,
                spk_model=None,
                device=self.device,
                disable_pbar=True,
                disable_update=True,
            )

            logger.info("Campplus模型加载成功")

        except Exception as e:
            logger.error(f"模型加载失败: {e}")
            raise

    def extract_chunk_features(self, chunk_data: np.ndarray) -> Optional[np.ndarray]:
        """
        提取单个音频片段的特征
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


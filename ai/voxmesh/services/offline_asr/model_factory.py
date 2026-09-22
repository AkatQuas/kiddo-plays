#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Embedding模型工厂
用于创建不同类型的embedding模型实例
"""

from typing import Dict, Type

from base_model import BaseEmbeddingModel
from campplus_model import CampplusEmbeddingModel
from speechbrain_model import SpeechBrainEmbeddingModel


class ModelFactory:
    """Embedding模型工厂类"""

    # 注册的模型类型
    _models: Dict[str, Type[BaseEmbeddingModel]] = {
        "speechbrain": SpeechBrainEmbeddingModel,
        "campplus": CampplusEmbeddingModel,
        # 可以在这里添加更多模型类型
        # "huggingface": HuggingFaceEmbeddingModel,
        # "openai": OpenAIEmbeddingModel,
    }

    @classmethod
    def create_model(cls,
                    model_type: str,
                    model_dir: str,
                    device: str = "cuda",
                    sample_rate: int = 16000,
                    segmentation_model_path: str = None) -> BaseEmbeddingModel:
        """
        创建embedding模型实例

        Args:
            model_type: 模型类型 ("speechbrain", "campplus", 等)
            model_dir: 模型路径
            device: 计算设备
            sample_rate: 音频采样率
            segmentation_model_path: 分割模型路径

        Returns:
            BaseEmbeddingModel: 模型实例

        Raises:
            ValueError: 不支持的模型类型
        """
        if model_type not in cls._models:
            supported_types = list(cls._models.keys())
            raise ValueError(f"不支持的模型类型: {model_type}. 支持的类型: {supported_types}")

        model_class = cls._models[model_type]
        model = model_class(model_dir, device, sample_rate)

        # 在基类层面设置segmentation_model_path
        if segmentation_model_path is not None:
            model.segmentation_model_path = segmentation_model_path

        model.load_model()

        # 加载分割模型
        model.load_segmentation_model()

        return model

    @classmethod
    def register_model(cls, model_type: str, model_class: Type[BaseEmbeddingModel]) -> None:
        """
        注册新的模型类型

        Args:
            model_type: 模型类型名称
            model_class: 模型类
        """
        cls._models[model_type] = model_class

    @classmethod
    def get_supported_models(cls) -> list:
        """
        获取支持的模型类型列表

        Returns:
            list: 支持的模型类型
        """
        return list(cls._models.keys())

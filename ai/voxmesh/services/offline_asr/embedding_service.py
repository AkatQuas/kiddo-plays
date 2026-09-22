#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Embedding服务模块
提供说话人特征提取功能
"""

import asyncio
import base64
import os
import tempfile
from typing import Optional, Tuple

import numpy as np
from logger_config import get_logger
from model_factory import ModelFactory
from pydantic import BaseModel
from pydub import AudioSegment
from voxmesh.embedding.port import embedding_to_base64

logger = get_logger()


class EmbeddingRequest(BaseModel):
    """特征提取请求模型"""
    wav_data: str


class EmbeddingData(BaseModel):
    """特征提取响应数据模型"""
    model_name: str
    embedding: str  # base64编码的特征向量
    wav_duration: float  # 音频时长（秒）


class EmbeddingResponse(BaseModel):
    """特征提取响应模型"""
    code: int
    message: str
    data: Optional[EmbeddingData] = None


class EmbeddingService:
    """说话人特征提取服务"""

    def __init__(self,
                 embedding_model_dir: str,
                 model_type: str = "campplus",
                 device: str = "cuda",
                 min_duration: float = 10.0,
                 segmentation_model_path: str = None):
        """
        初始化说话人特征提取服务

        Args:
            embedding_model_dir: 说话人特征提取模型路径
            model_type: 模型类型 ("speechbrain", "campplus", 等)
            device: 计算设备
            min_duration: 最小音频时长（秒）
            segmentation_model_path: 分割模型路径
        """
        self.embedding_model_dir = embedding_model_dir
        self.model_type = model_type
        self.device = device
        self.sample_rate = 16000  # 固定采样率
        self.min_duration = min_duration
        self.segmentation_model_path = segmentation_model_path
        self.model_lock = asyncio.Lock()

        # 初始化特征提取模型
        self.emb_model = None
        self.model_load_error = None
        self._load_embedding_model()

    def _load_embedding_model(self):
        """加载说话人特征提取模型"""
        try:
            logger.info("开始加载说话人特征提取模型")
            logger.info(f"  模型类型: {self.model_type}")
            logger.info(f"  模型目录: {self.embedding_model_dir}")
            logger.info(f"  设备: {self.device}")
            logger.info(f"  采样率: {self.sample_rate}")
            logger.info(f"  最小时长: {self.min_duration}秒")
            logger.info(f"  分割模型路径: {self.segmentation_model_path}")

            # 创建模型实例
            logger.info("正在初始化模型实例...")
            self.emb_model = ModelFactory.create_model(
                model_type=self.model_type,
                model_dir=self.embedding_model_dir,
                device=self.device,
                sample_rate=self.sample_rate,
                segmentation_model_path=self.segmentation_model_path
            )

            logger.info(f"模型加载成功: {self.emb_model.model_name}")
            logger.info(f"模型特征维度: {getattr(self.emb_model, 'feature_dim', '未知')}")
            self.model_load_error = None

        except Exception as e:
            logger.error(f"模型加载失败: {e}")
            logger.error(f"  模型类型: {self.model_type}")
            logger.error(f"  模型目录: {self.embedding_model_dir}")
            logger.error(f"  设备: {self.device}")
            import traceback
            logger.error(f"  详细错误: {traceback.format_exc()}")
            self.model_load_error = str(e)

    def _extract_features_from_audio_file(self, audio_path: str) -> Optional[np.ndarray]:
        """从音频文件提取特征向量"""
        if self.emb_model is None:
            logger.error("模型未加载，无法提取特征")
            return None

        logger.info(f"开始从音频文件提取特征: {audio_path}")
        embedding = self.emb_model.extract_features(audio_path)

        if embedding is not None:
            logger.info(f"特征提取成功，特征维度: {embedding.shape}")
        else:
            logger.warning("特征提取返回None")

        return embedding

    async def extract_embedding_from_data(self, wav_data: str) -> Tuple[Optional[np.ndarray], float, str]:
        """从base64数据提取特征"""
        temp_file = None
        try:
            # 解码base64数据
            try:
                audio_bytes = base64.b64decode(wav_data)
            except Exception:
                return None, 0.0, "base64_decode_error"

            logger.info(f"extract_embedding_from_data: 音频数据长度: {len(audio_bytes)}")

            # 检查文件格式（检查WAV文件头）
            if len(audio_bytes) < 12 or not audio_bytes.startswith(b'RIFF') or audio_bytes[8:12] != b'WAVE':
                logger.error(f"WAV格式检查失败: 长度={len(audio_bytes)}, 开头={'RIFF' if audio_bytes.startswith(b'RIFF') else '非RIFF'}, WAVE标识={'WAVE' if len(audio_bytes) >= 12 and audio_bytes[8:12] == b'WAVE' else '非WAVE'}")
                return None, 0.0, "audio_invalid"

            # 创建临时文件
            temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            temp_file.write(audio_bytes)
            temp_file.close()

            logger.info(f"extract_embedding_from_data: 临时文件路径: {temp_file.name}")

            # 获取音频时长
            try:
                logger.info("开始获取音频时长")
                audio = AudioSegment.from_wav(temp_file.name)
                duration = len(audio) / 1000.0
                logger.info(f"音频时长: {duration:.2f}秒")
            except Exception as e:
                logger.error(f"获取音频时长失败: {e}")
                return None, 0.0, "audio_invalid"

            if duration < self.min_duration:
                logger.warning(f"音频时长不足: {duration:.2f}秒 < {self.min_duration}秒")
                return None, duration, "duration_short"

            # 提取特征
            logger.info("开始提取说话人特征...")
            async with self.model_lock:
                embedding = self._extract_features_from_audio_file(temp_file.name)

            if embedding is not None:
                logger.info(f"说话人特征提取成功，时长: {duration:.2f}秒")
                return (embedding, duration, "")
            else:
                logger.error("说话人特征提取失败")
                return (None, duration, "extract_error")

        except Exception as e:
            logger.error(f"从数据提取特征失败: {e}")
            return None, 0.0, "extract_error"
        finally:
            if temp_file and os.path.exists(temp_file.name):
                logger.info(f"extract_embedding_from_data: 删除临时文件: {temp_file.name}")
                os.unlink(temp_file.name)

    def embedding_to_base64(self, embedding: np.ndarray) -> str:
        """将特征向量转换为base64字符串"""
        return embedding_to_base64(embedding)

    async def process_embedding_request(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """处理特征提取请求"""
        logger.info(f"收到特征提取请求，数据长度: {len(request.wav_data) if request.wav_data else 0}")

        # 检查模型是否加载成功
        if self.model_load_error is not None:
            logger.error(f"模型未正常加载，无法处理请求: {self.model_load_error}")
            return EmbeddingResponse(
                code=1004,
                message=f"模型加载失败: {self.model_load_error}"
            )

        # 检查必需参数
        if not hasattr(request, 'wav_data') or not request.wav_data:
            return EmbeddingResponse(
                code=1006,
                message="参数错误，缺少wav_data参数"
            )

        # 错误码映射
        error_map = {
            "duration_short": (1003, f"音频时长不足，最小要求: {self.min_duration}秒"),
            "base64_decode_error": (1007, "base64解码失败"),
            "audio_invalid": (1008, "音频数据无效"),
        }

        # 从base64数据提取特征
        embedding, duration, error_type = await self.extract_embedding_from_data(request.wav_data)
        logger.info(f"process_embedding_request: 提取特征，时长: {duration:.2f}秒，错误类型: {error_type}")

        # 处理错误
        if embedding is None:
            logger.warning(f"特征提取失败，错误类型: {error_type}")
            if error_type in error_map:
                code, message = error_map[error_type]
                if error_type == "duration_short":
                    message = f"音频时长不足，当前时长: {duration:.2f}秒，最小要求: {self.min_duration}秒"
                logger.warning(f"返回错误响应: code={code}, message={message}")
                return EmbeddingResponse(code=code, message=message)
            logger.error("未知错误类型，返回通用特征提取失败")
            return EmbeddingResponse(code=1005, message="特征提取失败")

        # 成功响应
        try:
            logger.info("开始编码特征向量为base64格式")
            embedding_b64 = self.embedding_to_base64(embedding)
            model_info = self.emb_model.get_model_info()
            logger.info(f"特征提取完全成功，模型: {model_info['model_name']}, 时长: {duration:.2f}秒, 特征维度: {embedding.shape}")

            data = EmbeddingData(
                model_name=model_info["model_name"],
                embedding=embedding_b64,
                wav_duration=duration
            )
            logger.info("返回成功响应")
            return EmbeddingResponse(code=0, message="成功", data=data)
        except Exception as e:
            logger.error(f"特征向量编码失败: {e}")
            return EmbeddingResponse(code=1005, message="特征向量编码失败")

    def is_model_loaded(self) -> bool:
        """检查模型是否加载成功"""
        return self.emb_model is not None and self.model_load_error is None

    def get_model_info(self) -> dict:
        """获取模型信息"""
        if self.emb_model:
            return self.emb_model.get_model_info()
        return {"model_name": "未加载", "error": self.model_load_error}

    def embedding_port(self):
        """Return unified embedding port for cross-service use."""
        from voxmesh.embedding.adapters import OfflineEmbeddingAdapter

        return OfflineEmbeddingAdapter(self)

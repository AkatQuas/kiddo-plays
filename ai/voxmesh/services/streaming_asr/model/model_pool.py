#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ASR模型池管理系统
- DetectorModel池：独立管理VAD模型
- ASR模型池：按类型分别管理（SenseVoice池、FunASR池等）
- 动态配置：根据服务器启动配置决定各池的大小
"""

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from queue import Empty, Full, Queue
from typing import Any, Dict, Optional

from common.asr_enum import ASRType
from common.config import get_server_config
from common.logger_config import logger
from model.model_base import ASROfflineBase, ASRStreamingBase
from service.asr_factory import ASRFactory
from speaker.speaker_clustering import SpeakerClustering

if get_server_config().asr_model_config.detector_type == "pyannote":
    from speech.speech_detector_pyannote import SpeechDetector
else:
    from speech.speech_detector import SpeechDetector


class GlobalPoolExecutor:
    """全局线程池管理器，供所有模型池共用"""

    def __init__(self, max_workers: int = 3):
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="ModelPool")
        self._lock = threading.Lock()

    def submit(self, fn, *args, **kwargs):
        """提交任务到线程池"""
        with self._lock:
            return self._executor.submit(fn, *args, **kwargs)

    def shutdown(self, wait: bool = True):
        """关闭线程池"""
        with self._lock:
            self._executor.shutdown(wait=wait)

# 全局线程池实例
global_pool_executor = GlobalPoolExecutor()

class BaseModelPool:
    """模型池基类，提供通用的异步创建功能"""

    def __init__(self, max_size: int, min_size: int, pool_name: str):
        self.max_size = max_size
        self.min_size = min_size
        self.pool_name = pool_name

        # 使用队列管理可用模型
        self._available_models = Queue(maxsize=max_size)
        self._all_models = {}
        self._lock = threading.Lock()

        # 正在创建中的实例数量
        self._creating_count = 0

        # 统计信息
        self.created_count = 0
        self.borrowed_count = 0
        self.returned_count = 0

    def _create_model_instance(self):
        """子类必须实现的模型创建方法"""
        raise NotImplementedError("子类必须实现_create_model_instance方法")

    def _async_create_model(self):
        """异步创建模型实例并放入队列"""
        try:
            with self._lock:
                self._creating_count += 1

            logger.info(f"异步创建{self.pool_name}实例")
            pooled_model = self._create_model_instance()

            # 尝试将新创建的实例放入队列
            try:
                self._available_models.put_nowait(pooled_model)
                logger.info(f"异步创建的{self.pool_name}实例已加入队列")
            except Full:
                logger.info(f"队列已满，销毁新创建的{self.pool_name}实例")
                with self._lock:
                    self._all_models.pop(id(pooled_model), None)
                del pooled_model

        except Exception as e:
            logger.error(f"异步创建{self.pool_name}实例失败: {e}")
        finally:
            with self._lock:
                self._creating_count -= 1

    def _check_and_create_async(self):
        """检查并启动异步创建任务"""
        with self._lock:
            available_count = self._available_models.qsize()
            total_count = len(self._all_models) + self._creating_count

            # 如果可用实例少于最小值的一半且总数未达上限，启动异步创建
            if (available_count < max(1, self.min_size // 2) and
                total_count < self.max_size and
                self._creating_count == 0):

                logger.info(f"检测到{self.pool_name}池实例不足，启动异步创建任务")
                global_pool_executor.submit(self._async_create_model)

    def get_base_stats(self) -> Dict[str, Any]:
        """获取基础统计信息"""
        with self._lock:
            return {
                "total_models": len(self._all_models),
                "available_models": self._available_models.qsize(),
                "creating_models": self._creating_count,
                "max_size": self.max_size,
                "min_size": self.min_size,
                "created_count": self.created_count,
                "borrowed_count": self.borrowed_count,
                "returned_count": self.returned_count,
                "models_in_use": sum(1 for m in self._all_models.values() if getattr(m, 'is_in_use', False))
            }


@dataclass
class PooledDetector:
    """池化的Detector模型"""
    detector: SpeechDetector
    created_time: float
    last_used_time: float
    usage_count: int = 0
    is_in_use: bool = False

    def mark_used(self):
        """标记为使用中"""
        self.is_in_use = True
        self.last_used_time = time.time()
        self.usage_count += 1

    def mark_available(self):
        """标记为可用状态并清理资源"""
        self.is_in_use = False
        self.last_used_time = time.time()
        # Detector可能需要重置状态
        if hasattr(self.detector, 'reset'):
            self.detector.reset()

@dataclass
class PooledSpeakerClustering:
    """池化的说话人识别模型"""
    speaker_clustering: SpeakerClustering
    created_time: float
    last_used_time: float
    usage_count: int = 0
    is_in_use: bool = False

    def mark_used(self):
        """标记为使用中"""
        self.is_in_use = True
        self.last_used_time = time.time()
        self.usage_count += 1

    def mark_available(self):
        """标记为可用状态并清理资源"""
        self.is_in_use = False
        self.last_used_time = time.time()
        # 清理说话人识别状态
        if hasattr(self.speaker_clustering, 'reset'):
            self.speaker_clustering.reset()

@dataclass
class PooledASRModel:
    """池化的ASR模型（包含streaming和offline）"""
    streaming_model: ASRStreamingBase
    offline_model: Optional[ASROfflineBase]  # 如果类型相同则为None
    model_type: ASRType
    same_type: bool  # streaming和offline是否相同类型
    created_time: float
    last_used_time: float
    usage_count: int = 0
    is_in_use: bool = False

    def mark_used(self):
        """标记为使用中"""
        self.is_in_use = True
        self.last_used_time = time.time()
        self.usage_count += 1

    def mark_available(self):
        """标记为可用状态并清理资源"""
        self.is_in_use = False
        self.last_used_time = time.time()

        # 清理streaming模型状态
        if hasattr(self.streaming_model, 'clear_state'):
            self.streaming_model.clear_state()

        # 如果有独立的offline模型，也清理其状态
        if self.offline_model and hasattr(self.offline_model, 'clear_state'):
            self.offline_model.clear_state()

    def get_streaming_model(self) -> ASRStreamingBase:
        """获取流式模型"""
        return self.streaming_model

    def get_offline_model(self) -> ASRStreamingBase:
        """获取离线模型（如果类型相同，返回streaming模型）"""
        if self.same_type:
            return self.streaming_model
        return self.offline_model

class DetectorPool(BaseModelPool):
    """Detector模型池"""

    def __init__(self,
                 vad_model_path: str,
                 max_size: int = 5,
                 min_size: int = 2,
                 **detector_kwargs):
        super().__init__(max_size, min_size, "Detector")
        self.vad_model_path = vad_model_path
        self.detector_kwargs = detector_kwargs

        logger.info(f"创建Detector模型池: 最大尺寸={max_size}, 最小尺寸={min_size}")

    def _create_model_instance(self) -> PooledDetector:
        """创建新的Detector实例"""
        try:
            logger.info("创建Detector模型实例")

            detector = SpeechDetector(
                self.vad_model_path,
                **self.detector_kwargs
            )

            pooled_detector = PooledDetector(
                detector=detector,
                created_time=time.time(),
                last_used_time=time.time()
            )

            with self._lock:
                self._all_models[id(pooled_detector)] = pooled_detector
                self.created_count += 1

            logger.info("Detector模型创建成功")
            return pooled_detector

        except Exception as e:
            logger.error(f"创建Detector模型失败: {e}")
            raise

    def init_pool(self):
        """初始化池，预创建最小数量的模型"""
        if self.max_size == 0:
            logger.info("Detector池大小为0，跳过初始化")
            return

        logger.info("初始化Detector模型池")

        for i in range(self.min_size):
            try:
                pooled_detector = self._create_model_instance()
                self._available_models.put_nowait(pooled_detector)
                logger.info(f"预创建Detector模型 {i+1}/{self.min_size}")
            except Exception as e:
                logger.error(f"预创建Detector模型失败 {i+1}/{self.min_size}: {e}")
                continue

        logger.info(f"Detector模型池初始化完成: 实际创建={self._available_models.qsize()}/{self.min_size}")

    def borrow_detector(self, timeout: float = 5.0) -> Optional[PooledDetector]:
        """从池中借用一个Detector"""
        if self.max_size == 0:
            logger.warning("Detector池大小为0，无法借用")
            return None

        try:
            # 先尝试从队列中获取
            try:
                pooled_detector = self._available_models.get(timeout=timeout)
                pooled_detector.mark_used()

                with self._lock:
                    self.borrowed_count += 1

                logger.debug(f"从池中借用Detector: 使用次数={pooled_detector.usage_count}")

                # 检查是否需要异步补充实例
                self._check_and_create_async()

                return pooled_detector

            except Empty:
                # 队列为空，检查是否可以创建新模型
                with self._lock:
                    current_size = len(self._all_models)
                    total_size = current_size + self._creating_count

                    if total_size < self.max_size:
                        logger.info("Detector池无可用实例，同步创建新实例")
                        pooled_detector = self._create_model_instance()
                        pooled_detector.mark_used()
                        self.borrowed_count += 1

                        # 启动异步创建任务补充池
                        self._check_and_create_async()

                        return pooled_detector
                    else:
                        logger.warning("Detector池已达上限且无可用模型")
                        return None

        except Exception as e:
            logger.error(f"借用Detector失败: {e}")
            return None

    def return_detector(self, pooled_detector: PooledDetector):
        """归还Detector到池中"""
        if self.max_size == 0:
            return

        try:
            if not pooled_detector.is_in_use:
                logger.warning("尝试归还未使用的Detector")
                return

            pooled_detector.mark_available()

            try:
                self._available_models.put_nowait(pooled_detector)
                with self._lock:
                    self.returned_count += 1

                logger.debug(f"归还Detector到池: 总使用次数={pooled_detector.usage_count}")
            except Full:
                logger.info("Detector池已满，销毁多余模型")
                with self._lock:
                    self._all_models.pop(id(pooled_detector), None)
                del pooled_detector

        except Exception as e:
            logger.error(f"归还Detector失败: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """获取池统计信息"""
        stats = self.get_base_stats()
        stats["model_type"] = "detector"
        return stats

    def cleanup(self):
        """清理池"""
        logger.info("清理Detector模型池")

        while not self._available_models.empty():
            try:
                self._available_models.get_nowait()
            except Empty:
                break

        with self._lock:
            for pooled_detector in self._all_models.values():
                if hasattr(pooled_detector.detector, 'cleanup'):
                    try:
                        pooled_detector.detector.cleanup()
                    except Exception as e:
                        logger.warning(f"清理Detector时出错: {e}")

            self._all_models.clear()
            logger.info("Detector模型池清理完成")

class SpeakerClusteringPool(BaseModelPool):
    """说话人识别模型池"""

    def __init__(self,
                 embedding_model_dir: str,
                 segmentation_model_path: str,
                 max_size: int = 5,
                 min_size: int = 2,
                 **speaker_kwargs):
        super().__init__(max_size, min_size, "说话人识别")
        self.embedding_model_dir = embedding_model_dir
        self.segmentation_model_path = segmentation_model_path
        self.speaker_kwargs = speaker_kwargs

        logger.info(f"创建说话人识别模型池: 最大尺寸={max_size}, 最小尺寸={min_size}")

    def _create_model_instance(self) -> PooledSpeakerClustering:
        """创建新的说话人识别实例"""
        try:
            logger.info("创建说话人识别模型实例")

            speaker_clustering = SpeakerClustering(
                embedding_model_dir=self.embedding_model_dir,
                segmentation_model_path=self.segmentation_model_path,
                **self.speaker_kwargs
            )

            pooled_speaker_clustering = PooledSpeakerClustering(
                speaker_clustering=speaker_clustering,
                created_time=time.time(),
                last_used_time=time.time()
            )

            with self._lock:
                self._all_models[id(pooled_speaker_clustering)] = pooled_speaker_clustering
                self.created_count += 1

            logger.info("说话人识别模型创建成功")
            return pooled_speaker_clustering

        except Exception as e:
            logger.error(f"创建说话人识别模型失败: {e}")
            raise

    def init_pool(self):
        """初始化池，预创建最小数量的模型"""
        if self.max_size == 0:
            logger.info("说话人识别池大小为0，跳过初始化")
            return

        logger.info("初始化说话人识别模型池")

        for i in range(self.min_size):
            try:
                pooled_speaker_clustering = self._create_model_instance()
                self._available_models.put_nowait(pooled_speaker_clustering)
                logger.info(f"预创建说话人识别模型 {i+1}/{self.min_size}")
            except Exception as e:
                logger.error(f"预创建说话人识别模型失败 {i+1}/{self.min_size}: {e}")
                continue

        logger.info(f"说话人识别模型池初始化完成: 实际创建={self._available_models.qsize()}/{self.min_size}")

    def borrow_speaker_clustering(self, timeout: float = 5.0) -> Optional[PooledSpeakerClustering]:
        """从池中借用一个说话人识别模型"""
        if self.max_size == 0:
            logger.warning("说话人识别池大小为0，无法借用")
            return None

        try:
            # 先尝试从队列中获取
            try:
                pooled_speaker_clustering = self._available_models.get(timeout=timeout)
                pooled_speaker_clustering.mark_used()

                with self._lock:
                    self.borrowed_count += 1

                logger.debug(f"从池中借用说话人识别模型: 使用次数={pooled_speaker_clustering.usage_count}")

                # 检查是否需要异步补充实例
                self._check_and_create_async()

                return pooled_speaker_clustering

            except Empty:
                # 队列为空，检查是否可以创建新模型
                with self._lock:
                    current_size = len(self._all_models)
                    total_size = current_size + self._creating_count

                    if total_size < self.max_size:
                        logger.info("说话人识别池无可用实例，同步创建新实例")
                        pooled_speaker_clustering = self._create_model_instance()
                        pooled_speaker_clustering.mark_used()
                        self.borrowed_count += 1

                        # 启动异步创建任务补充池
                        self._check_and_create_async()

                        return pooled_speaker_clustering
                    else:
                        logger.warning("说话人识别池已达上限且无可用模型")
                        return None

        except Exception as e:
            logger.error(f"借用说话人识别模型失败: {e}")
            return None

    def return_speaker_clustering(self, pooled_speaker_clustering: PooledSpeakerClustering):
        """归还说话人识别模型到池中"""
        if self.max_size == 0:
            return

        try:
            if not pooled_speaker_clustering.is_in_use:
                logger.warning("尝试归还未使用的说话人识别模型")
                return

            pooled_speaker_clustering.mark_available()

            try:
                # 重置说话人聚类器状态
                speaker_clustering = pooled_speaker_clustering.speaker_clustering
                if hasattr(speaker_clustering, 'reset'):
                    speaker_clustering.reset()
                    logger.info("说话人聚类器状态已重置")

                self._available_models.put_nowait(pooled_speaker_clustering)
                with self._lock:
                    self.returned_count += 1

                logger.debug(f"归还说话人识别模型到池: 总使用次数={pooled_speaker_clustering.usage_count}")
            except Full:
                logger.info("说话人识别池已满，销毁多余模型")
                with self._lock:
                    self._all_models.pop(id(pooled_speaker_clustering), None)
                del pooled_speaker_clustering

        except Exception as e:
            logger.error(f"归还说话人识别模型失败: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """获取池统计信息"""
        stats = self.get_base_stats()
        stats["model_type"] = "speaker_clustering"
        return stats

    def cleanup(self):
        """清理池"""
        logger.info("清理说话人识别模型池")

        while not self._available_models.empty():
            try:
                self._available_models.get_nowait()
            except Empty:
                break

        with self._lock:
            for pooled_speaker_clustering in self._all_models.values():
                if hasattr(pooled_speaker_clustering.speaker_clustering, 'cleanup'):
                    try:
                        pooled_speaker_clustering.speaker_clustering.cleanup()
                    except Exception as e:
                        logger.warning(f"清理说话人识别模型时出错: {e}")

            self._all_models.clear()
            logger.info("说话人识别模型池清理完成")

class ASRPool(BaseModelPool):
    """ASR模型池（按类型）"""

    def __init__(self,
                 model_type: ASRType,
                 streaming_model_dir: str,
                 offline_model_dir: str,
                 streaming_type: ASRType,
                 offline_type: ASRType,
                 max_size: int = 3,
                 min_size: int = 2,
                 **model_kwargs):
        super().__init__(max_size, min_size, model_type.value)
        self.model_type = model_type  # 池的主要类型
        self.streaming_model_dir = streaming_model_dir
        self.offline_model_dir = offline_model_dir
        self.streaming_type = streaming_type
        self.offline_type = offline_type
        self.model_kwargs = model_kwargs

        # 判断是否是相同类型
        self.same_type = streaming_type == offline_type

        logger.info(f"创建{model_type.value}模型池: streaming={streaming_type.value}, "
                f"offline={offline_type.value}, 相同类型={self.same_type}, "
                f"最大尺寸={max_size}, 最小尺寸={min_size}")

    def _create_model_instance(self) -> PooledASRModel:
        """创建新的ASR模型"""
        try:
            logger.info(f"创建{self.model_type.value}模型: streaming={self.streaming_type.value}, "
                    f"offline={self.offline_type.value}")

            # 创建streaming模型
            streaming_kwargs = {
                'device': self.model_kwargs.get('device', 'cuda')
            }
            for key in ['vad_model', 'punc_model', 'spk_model']:
                if key in self.model_kwargs:
                    streaming_kwargs[key] = self.model_kwargs[key]

            streaming_model = ASRFactory.create_streaming_instance(
                self.streaming_type, self.streaming_model_dir, **streaming_kwargs
            )

            # 创建offline模型（如果类型不同）
            offline_model = None
            if not self.same_type:
                offline_kwargs = {
                    'device': self.model_kwargs.get('device', 'cuda')
                }
                for key in ['vad_model', 'punc_model', 'spk_model']:
                    if key in self.model_kwargs:
                        offline_kwargs[key] = self.model_kwargs[key]

                offline_model = ASRFactory.create_offline_instance(
                    self.offline_type, self.offline_model_dir, **offline_kwargs
                )

            pooled_asr_model = PooledASRModel(
                streaming_model=streaming_model,
                offline_model=offline_model,
                model_type=self.model_type,
                same_type=self.same_type,
                created_time=time.time(),
                last_used_time=time.time()
            )

            with self._lock:
                self._all_models[id(pooled_asr_model)] = pooled_asr_model
                self.created_count += 1

            logger.info(f"{self.model_type.value}模型创建成功")
            return pooled_asr_model

        except Exception as e:
            logger.error(f"创建{self.model_type.value}模型失败: {e}")
            raise

    def init_pool(self):
        """初始化池"""
        if self.max_size == 0:
            logger.info(f"{self.model_type.value}池大小为0，跳过初始化")
            return

        logger.info(f"初始化{self.model_type.value}模型池")

        for i in range(self.min_size):
            try:
                pooled_asr_model = self._create_model_instance()
                self._available_models.put_nowait(pooled_asr_model)
                logger.info(f"预创建{self.model_type.value}模型 {i+1}/{self.min_size}")
            except Exception as e:
                logger.error(f"预创建{self.model_type.value}模型失败 {i+1}/{self.min_size}: {e}")
                continue

        logger.info(f"{self.model_type.value}模型池初始化完成: "
                f"实际创建={self._available_models.qsize()}/{self.min_size}")

    def borrow_asr_model(self, timeout: float = 5.0) -> Optional[PooledASRModel]:
        """借用ASR模型"""
        if self.max_size == 0:
            logger.warning(f"{self.model_type.value}池大小为0，无法借用")
            return None

        try:
            try:
                pooled_asr_model = self._available_models.get(timeout=timeout)
                pooled_asr_model.mark_used()

                with self._lock:
                    self.borrowed_count += 1

                logger.debug(f"借用{self.model_type.value}模型: 使用次数={pooled_asr_model.usage_count}")

                # 检查是否需要异步补充实例
                self._check_and_create_async()

                return pooled_asr_model

            except Empty:
                with self._lock:
                    current_size = len(self._all_models)
                    total_size = current_size + self._creating_count

                    if total_size < self.max_size:
                        logger.info(f"{self.model_type.value}池无可用实例，同步创建新实例")
                        pooled_asr_model = self._create_model_instance()
                        pooled_asr_model.mark_used()
                        self.borrowed_count += 1

                        # 启动异步创建任务补充池
                        self._check_and_create_async()

                        return pooled_asr_model
                    else:
                        logger.warning(f"{self.model_type.value}池已达上限且无可用模型")
                        return None

        except Exception as e:
            logger.error(f"借用{self.model_type.value}模型失败: {e}")
            return None

    def return_asr_model(self, pooled_asr_model: PooledASRModel):
        """归还ASR模型"""
        if self.max_size == 0:
            return

        try:
            if not pooled_asr_model.is_in_use:
                logger.warning(f"尝试归还未使用的{self.model_type.value}模型")
                return

            pooled_asr_model.mark_available()

            try:
                self._available_models.put_nowait(pooled_asr_model)
                with self._lock:
                    self.returned_count += 1

                logger.debug(f"归还{self.model_type.value}模型: 总使用次数={pooled_asr_model.usage_count}")
            except Full:
                logger.info(f"{self.model_type.value}池已满，销毁多余模型")
                with self._lock:
                    self._all_models.pop(id(pooled_asr_model), None)
                del pooled_asr_model

        except Exception as e:
            logger.error(f"归还{self.model_type.value}模型失败: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """获取池统计信息"""
        stats = self.get_base_stats()
        stats.update({
            "model_type": self.model_type.value,
            "streaming_type": self.streaming_type.value,
            "offline_type": self.offline_type.value,
            "same_type": self.same_type
        })
        return stats

    def cleanup(self):
        """清理池"""
        logger.info(f"清理{self.model_type.value}模型池")

        while not self._available_models.empty():
            try:
                self._available_models.get_nowait()
            except Empty:
                break

        with self._lock:
            for pooled_asr_model in self._all_models.values():
                # 清理streaming模型
                if hasattr(pooled_asr_model.streaming_model, 'cleanup'):
                    try:
                        pooled_asr_model.streaming_model.cleanup()
                    except Exception as e:
                        logger.warning(f"清理streaming模型时出错: {e}")

                # 清理offline模型
                if (pooled_asr_model.offline_model and
                    hasattr(pooled_asr_model.offline_model, 'cleanup')):
                    try:
                        pooled_asr_model.offline_model.cleanup()
                    except Exception as e:
                        logger.warning(f"清理offline模型时出错: {e}")

            self._all_models.clear()
            logger.info(f"{self.model_type.value}模型池清理完成")

class ModelPoolManager:
    """模型池管理器"""

    def __init__(self):
        self.detector_pool: Optional[DetectorPool] = None
        self.speaker_clustering_pool: Optional[SpeakerClusteringPool] = None
        self.asr_pools: Dict[ASRType, ASRPool] = {}
        self._lock = threading.Lock()

        # 统一的池大小配置
        self._pool_max_size = 15  # 默认最大大小
        self._pool_min_size = 2   # 默认最小大小

        logger.info("模型池管理器初始化")

    def set_pool_sizes(self, max_size: int, min_size: int = None):
        """设置所有池的统一大小"""
        self._pool_max_size = max_size
        self._pool_min_size = min_size or max(1, max_size // 2)  # 默认为max_size的1/2
        logger.info(f"设置统一池大小: max_size={self._pool_max_size}, min_size={self._pool_min_size}")

    def get_pool_sizes(self) -> tuple[int, int]:
        """获取当前池大小配置"""
        return self._pool_max_size, self._pool_min_size

    def create_detector_pool(self,
                           vad_model_path: str,
                           **detector_kwargs) -> DetectorPool:
        """创建Detector池"""
        with self._lock:
            if self.detector_pool:
                logger.warning("Detector池已存在")
                return self.detector_pool

            self.detector_pool = DetectorPool(
                vad_model_path=vad_model_path,
                max_size=self._pool_max_size,
                min_size=self._pool_min_size,
                **detector_kwargs
            )
            return self.detector_pool

    def create_speaker_clustering_pool(self,
                                     embedding_model_dir: str,
                                     segmentation_model_path: str,
                                     **speaker_kwargs) -> SpeakerClusteringPool:
        """创建说话人识别池"""
        with self._lock:
            if self.speaker_clustering_pool:
                logger.warning("说话人识别池已存在")
                return self.speaker_clustering_pool

            self.speaker_clustering_pool = SpeakerClusteringPool(
                embedding_model_dir=embedding_model_dir,
                segmentation_model_path=segmentation_model_path,
                max_size=self._pool_max_size,
                min_size=self._pool_min_size,
                **speaker_kwargs
            )
            return self.speaker_clustering_pool

    def create_asr_pool(self,
                       model_type: ASRType,
                       streaming_model_dir: str,
                       offline_model_dir: str,
                       streaming_type: ASRType,
                       offline_type: ASRType,
                       **model_kwargs) -> ASRPool:
        """创建ASR池"""
        with self._lock:
            if model_type in self.asr_pools:
                logger.warning(f"{model_type.value}池已存在")
                return self.asr_pools[model_type]

            pool = ASRPool(
                model_type=model_type,
                streaming_model_dir=streaming_model_dir,
                offline_model_dir=offline_model_dir,
                streaming_type=streaming_type,
                offline_type=offline_type,
                max_size=self._pool_max_size,
                min_size=self._pool_min_size,
                **model_kwargs
            )

            self.asr_pools[model_type] = pool
            return pool

    def init_all_pools(self):
        """初始化所有池"""
        logger.info("开始初始化所有模型池")

        # 初始化Detector池
        if self.detector_pool:
            try:
                self.detector_pool.init_pool()
            except Exception as e:
                logger.error(f"初始化Detector池失败: {e}")

        # 初始化说话人识别池
        if self.speaker_clustering_pool:
            try:
                self.speaker_clustering_pool.init_pool()
            except Exception as e:
                logger.error(f"初始化说话人识别池失败: {e}")

        # 初始化所有ASR池
        for model_type, pool in self.asr_pools.items():
            try:
                pool.init_pool()
            except Exception as e:
                logger.error(f"初始化{model_type.value}池失败: {e}")

        logger.info("所有模型池初始化完成")

    def get_detector(self, timeout: float = 5.0) -> Optional[PooledDetector]:
        """获取Detector"""
        if not self.detector_pool:
            logger.error("Detector池未创建")
            return None
        return self.detector_pool.borrow_detector(timeout)

    def get_speaker_clustering(self, timeout: float = 5.0) -> Optional[PooledSpeakerClustering]:
        """获取说话人识别模型"""
        if not self.speaker_clustering_pool:
            logger.error("说话人识别池未创建")
            return None
        return self.speaker_clustering_pool.borrow_speaker_clustering(timeout)

    def get_asr_model(self, model_type: ASRType, timeout: float = 5.0) -> Optional[PooledASRModel]:
        """获取指定类型的ASR模型"""
        pool = self.asr_pools.get(model_type)
        if not pool:
            logger.error(f"未找到{model_type.value}池")
            return None
        return pool.borrow_asr_model(timeout)

    def get_configured_asr_model(self, timeout: float = 5.0) -> Optional[PooledASRModel]:
        """获取服务器配置的ASR模型（从第一个可用池获取）"""
        if not self.asr_pools:
            logger.error("没有配置的ASR池")
            return None

        # 获取第一个（也可能是唯一的）配置的ASR池
        first_pool_type = next(iter(self.asr_pools.keys()))
        pool = self.asr_pools[first_pool_type]

        logger.debug(f"从{first_pool_type.value}池获取ASR模型")
        return pool.borrow_asr_model(timeout)

    def return_detector(self, pooled_detector: PooledDetector):
        """归还Detector"""
        if self.detector_pool:
            self.detector_pool.return_detector(pooled_detector)

    def return_speaker_clustering(self, pooled_speaker_clustering: PooledSpeakerClustering):
        """归还说话人识别模型"""
        if self.speaker_clustering_pool:
            self.speaker_clustering_pool.return_speaker_clustering(pooled_speaker_clustering)

    def return_asr_model(self, pooled_asr_model: PooledASRModel):
        """归还ASR模型"""
        pool = self.asr_pools.get(pooled_asr_model.model_type)
        if pool:
            pool.return_asr_model(pooled_asr_model)

    def get_all_stats(self) -> Dict[str, Any]:
        """获取所有池统计信息"""
        total_pools = len(self.asr_pools)
        if self.detector_pool:
            total_pools += 1
        if self.speaker_clustering_pool:
            total_pools += 1

        stats = {
            "detector_pool": None,
            "speaker_clustering_pool": None,
            "asr_pools": {},
            "total_pools": total_pools,
            "unified_pool_config": {
                "max_size": self._pool_max_size,
                "min_size": self._pool_min_size
            },
            "timestamp": time.time()
        }

        if self.detector_pool:
            stats["detector_pool"] = self.detector_pool.get_stats()

        if self.speaker_clustering_pool:
            stats["speaker_clustering_pool"] = self.speaker_clustering_pool.get_stats()

        for model_type, pool in self.asr_pools.items():
            stats["asr_pools"][model_type.value] = pool.get_stats()

        return stats

    def cleanup_all(self):
        """清理所有池"""
        logger.info("开始清理所有模型池")

        # 清理Detector池
        if self.detector_pool:
            try:
                self.detector_pool.cleanup()
                self.detector_pool = None
            except Exception as e:
                logger.error(f"清理Detector池失败: {e}")

        # 清理说话人识别池
        if self.speaker_clustering_pool:
            try:
                self.speaker_clustering_pool.cleanup()
                self.speaker_clustering_pool = None
            except Exception as e:
                logger.error(f"清理说话人识别池失败: {e}")

        # 清理所有ASR池
        for model_type, pool in self.asr_pools.items():
            try:
                pool.cleanup()
            except Exception as e:
                logger.error(f"清理{model_type.value}池失败: {e}")

        with self._lock:
            self.asr_pools.clear()

        # 关闭全局线程池
        try:
            global_pool_executor.shutdown(wait=True)
            logger.info("全局模型池线程池已关闭")
        except Exception as e:
            logger.error(f"关闭全局线程池失败: {e}")

        logger.info("所有模型池清理完成")

_model_pool_manager = None


def get_model_pool_manager() -> ModelPoolManager:
    global _model_pool_manager
    if _model_pool_manager is None:
        _model_pool_manager = ModelPoolManager()
    return _model_pool_manager


class _LazyModelPoolManager:
    def __getattr__(self, name):
        return getattr(get_model_pool_manager(), name)


model_pool_manager = _LazyModelPoolManager()

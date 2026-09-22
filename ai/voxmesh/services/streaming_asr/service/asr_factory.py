#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ASR类型枚举和工厂类
"""

from typing import Dict, Type

from common.asr_enum import ASRType
from common.logger_config import logger
from model.model_base import ASROfflineBase, ASRStreamingBase


class ASRFactory:
    """ASR工厂类，用于根据类型创建相应的ASR实例"""

    # 注册流式ASR实现类
    _streaming_classes: Dict[ASRType, Type[ASRStreamingBase]] = {}

    # 注册离线ASR实现类
    _offline_classes: Dict[ASRType, Type[ASROfflineBase]] = {}

    @classmethod
    def register_streaming_class(cls, asr_type: ASRType, asr_class: Type[ASRStreamingBase]):
        """注册流式ASR实现类"""
        cls._streaming_classes[asr_type] = asr_class
        logger.info(f"已注册流式ASR实现: {asr_type.value} -> {asr_class.__name__}")

    @classmethod
    def register_offline_class(cls, asr_type: ASRType, asr_class: Type[ASROfflineBase]):
        """注册离线ASR实现类"""
        cls._offline_classes[asr_type] = asr_class
        logger.info(f"已注册离线ASR实现: {asr_type.value} -> {asr_class.__name__}")

    @classmethod
    def get_streaming_class(cls, asr_type: ASRType) -> Type[ASRStreamingBase]:
        """获取流式ASR实现类"""
        if asr_type not in cls._streaming_classes:
            raise ValueError(f"未注册的流式ASR类型: {asr_type.value}")
        return cls._streaming_classes[asr_type]

    @classmethod
    def get_offline_class(cls, asr_type: ASRType) -> Type[ASROfflineBase]:
        """获取离线ASR实现类"""
        if asr_type not in cls._offline_classes:
            raise ValueError(f"未注册的离线ASR类型: {asr_type.value}")
        return cls._offline_classes[asr_type]

    @classmethod
    def create_streaming_instance(cls, asr_type: ASRType, model_dir: str, **kwargs) -> ASRStreamingBase:
        """创建流式ASR实例"""
        asr_class = cls.get_streaming_class(asr_type)
        return asr_class(model_dir, **kwargs)

    @classmethod
    def create_offline_instance(cls, asr_type: ASRType, model_dir: str, **kwargs) -> ASROfflineBase:
        """创建离线ASR实例"""
        asr_class = cls.get_offline_class(asr_type)
        return asr_class(model_dir, **kwargs)

    @classmethod
    def get_available_types(cls) -> Dict[str, list]:
        """获取所有可用的ASR类型"""
        return {
            "streaming": [asr_type.value for asr_type in cls._streaming_classes.keys()],
            "offline": [asr_type.value for asr_type in cls._offline_classes.keys()]
        }

# 自动注册FunASR实现
def _register_funasr():
    """自动注册FunASR实现"""
    try:
        from model.funasr_model import FunASROffline, FunASRStreaming
        ASRFactory.register_streaming_class(ASRType.FUNASR, FunASRStreaming)
        ASRFactory.register_offline_class(ASRType.FUNASR, FunASROffline)
    except ImportError as e:
        logger.warning(f"FunASR模块导入失败，跳过注册: {e}")

# 自动注册SenseVoice实现
def _register_sensevoice():
    """自动注册SenseVoice实现"""
    try:
        from model.sensevoice_model import SenseVoiceOffline, SenseVoiceStreaming
        ASRFactory.register_streaming_class(ASRType.SENSEVOICE, SenseVoiceStreaming)
        ASRFactory.register_offline_class(ASRType.SENSEVOICE, SenseVoiceOffline)
    except ImportError as e:
        logger.warning(f"SenseVoice模块导入失败，跳过注册: {e}")

# 注册Whisper实现
def _register_whisper():
    """注册Whisper实现"""
    try:
        from model.whisper_model import WhisperOffline, WhisperStreaming
        ASRFactory.register_streaming_class(ASRType.WHISPER, WhisperStreaming)
        ASRFactory.register_offline_class(ASRType.WHISPER, WhisperOffline)
    except ImportError as e:
        logger.warning(f"Whisper模块导入失败，跳过注册: {e}")

# 注册Qwen实现
def _register_qwen():
    """注册Qwen-Audio实现"""
    try:
        from model.qwen_model import QwenOffline, QwenStreaming
        ASRFactory.register_streaming_class(ASRType.QWEN, QwenStreaming)
        ASRFactory.register_offline_class(ASRType.QWEN, QwenOffline)
    except ImportError as e:
        logger.warning(f"Qwen模块导入失败，跳过注册: {e}")

# 自动注册所有可用的ASR实现
def register_all_asr_types():
    """注册所有可用的ASR类型"""
    logger.info("开始注册ASR实现类...")
    _register_funasr()
    _register_sensevoice()
    _register_whisper()
    _register_qwen()
    logger.info(f"ASR注册完成，可用类型: {ASRFactory.get_available_types()}")

# 模块导入时自动注册
register_all_asr_types()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Latest系统配置模块
管理AI建议功能相关配置
"""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

from common.asr_enum import ASRType
from common.llm_defaults import (
    DEFAULT_LLM_API_KEY,
    DEFAULT_LLM_API_URL,
    DEFAULT_LLM_MAX_TOKENS,
    DEFAULT_LLM_MODEL,
)


@dataclass
class KnowledgeConfig:
    """AI知识建议配置"""
    api_url: str
    model: str
    api_key: str
    max_tokens: int
    sensitive_words: List[str]

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'KnowledgeConfig':
        """从字典创建KnowledgeConfig实例，优先使用环境变量"""
        return cls(
            api_url=os.getenv('LLM_API_URL', config_dict.get('api_url', DEFAULT_LLM_API_URL)),
            model=os.getenv('LLM_MODEL', config_dict.get('model', DEFAULT_LLM_MODEL)),
            api_key=os.getenv('LLM_API_KEY', config_dict.get('api_key', DEFAULT_LLM_API_KEY)),
            max_tokens=int(os.getenv('LLM_MAX_TOKENS', config_dict.get('max_tokens', DEFAULT_LLM_MAX_TOKENS))),
            sensitive_words=config_dict.get('sensitive_words', []),
        )


@dataclass
class TextCorrectorConfig:
    """文本纠错配置"""
    api_url: str
    model: str
    api_key: str
    max_tokens: int
    timeout: int
    connection_timeout: int

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'TextCorrectorConfig':
        """从字典创建TextCorrectorConfig实例，优先使用环境变量"""
        api_url = os.getenv(
            'TEXT_CORRECTOR_API_URL',
            config_dict.get('api_url', os.getenv('LLM_API_URL', DEFAULT_LLM_API_URL)),
        )
        model = os.getenv(
            'TEXT_CORRECTOR_MODEL',
            config_dict.get('model', os.getenv('LLM_MODEL', DEFAULT_LLM_MODEL)),
        )
        api_key = os.getenv(
            'TEXT_CORRECTOR_API_KEY',
            config_dict.get('api_key', os.getenv('LLM_API_KEY', DEFAULT_LLM_API_KEY)),
        )
        max_tokens = int(os.getenv(
            'TEXT_CORRECTOR_MAX_TOKENS',
            config_dict.get('max_tokens', os.getenv('LLM_MAX_TOKENS', DEFAULT_LLM_MAX_TOKENS)),
        ))
        timeout = float(os.getenv('TEXT_CORRECTOR_TIMEOUT', config_dict.get('timeout', 1.2)))
        connection_timeout = float(os.getenv('TEXT_CORRECTOR_CONNECTION_TIMEOUT', config_dict.get('connection_timeout', 0.5)))

        return cls(
            api_url=api_url,
            model=model,
            api_key=api_key,
            max_tokens=max_tokens,
            timeout=timeout,
            connection_timeout=connection_timeout
        )


@dataclass
class ASRModelConfig:
    """ASR模型配置"""
    streaming_model_dir: str
    offline_model_dir: str
    vad_model_path: str
    segmentation_model_path: str
    embedding_model_dir: str
    streaming_asr_type: ASRType
    offline_asr_type: ASRType
    detector_type: str

    @classmethod
    def _validate_path(cls, path: str) -> str:
        """验证路径是否存在，如果不存在则尝试从INPUT_PATH环境变量拼接"""
        if os.path.exists(path):
            return path

        input_path = os.getenv('INPUT_PATH')
        if input_path:
            full_path = os.path.join(input_path, path)
            if os.path.exists(full_path):
                return full_path

        # 如果都不存在，返回原路径
        return path

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'ASRModelConfig':
        """从字典创建ASRModelConfig实例"""
        # 将字符串转换为ASRType枚举
        config_dict = config_dict.copy()
        config_dict['streaming_asr_type'] = ASRType(config_dict['streaming_asr_type'])
        config_dict['offline_asr_type'] = ASRType(config_dict['offline_asr_type'])

        # 验证并修正路径
        path_fields = ['streaming_model_dir', 'offline_model_dir', 'vad_model_path', 'segmentation_model_path', 'embedding_model_dir']
        for field in path_fields:
            if field in config_dict:
                config_dict[field] = cls._validate_path(config_dict[field])

        return cls(**config_dict)



@dataclass
class ASRDefaultParams:
    """ASR默认参数配置"""
    enable_advice: bool
    enable_text_correction: bool
    text_correction_min_length: int
    spk_delta_new: float
    spk_max_speakers: int
    sample_rate: int
    min_duration_on: float
    vad_silence_duration_s: float
    vad_threshold: float
    vad_max_speech_duration_s: float
    vad_speech_start_buffer: float
    transcribe_interval: float
    device: str
    enable_volume_detection: bool = True
    volume_threshold_db: float = -35.0
    volume_check_duration_s: float = 1.0
    volume_warning_interval_s: float = 2.0

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'ASRDefaultParams':
        """从字典创建ASRDefaultParams实例，优先使用环境变量"""
        # 优先使用环境变量，其次使用配置文件
        enable_text_correction_str = os.getenv('ENABLE_TEXT_CORRECTION')
        if enable_text_correction_str is not None:
            enable_text_correction = enable_text_correction_str.lower() in ('true', '1', 'yes', 'on')
        else:
            enable_text_correction = config_dict.get('enable_text_correction')

        # 音量检测相关参数
        enable_volume_detection_str = os.getenv('ENABLE_VOLUME_DETECTION')
        if enable_volume_detection_str is not None:
            enable_volume_detection = enable_volume_detection_str.lower() in ('true', '1', 'yes', 'on')
        else:
            enable_volume_detection = config_dict.get('enable_volume_detection', True)

        volume_threshold_db = float(os.getenv('VOLUME_THRESHOLD_DB', config_dict.get('volume_threshold_db', -50.0)))
        volume_check_duration_s = float(os.getenv('VOLUME_CHECK_DURATION_S', config_dict.get('volume_check_duration_s', 1.0)))
        volume_warning_interval_s = float(os.getenv('VOLUME_WARNING_INTERVAL_S', config_dict.get('volume_warning_interval_s', 60.0)))

        # 创建配置副本并更新值
        config_dict = config_dict.copy()
        config_dict['enable_text_correction'] = enable_text_correction
        config_dict['enable_volume_detection'] = enable_volume_detection
        config_dict['volume_threshold_db'] = volume_threshold_db
        config_dict['volume_check_duration_s'] = volume_check_duration_s
        config_dict['volume_warning_interval_s'] = volume_warning_interval_s

        return cls(**config_dict)

@dataclass
class LoggerConfig:
    """日志配置"""
    level: str
    log_dir: str
    max_file_size: int
    backup_count: int
    console_output: bool

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'LoggerConfig':
        """从字典创建LoggerConfig实例"""
        return cls(**config_dict)


@dataclass
class NetworkConfig:
    """网络配置"""
    host: str
    port: int
    max_clients: int

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'NetworkConfig':
        """从字典创建NetworkConfig实例"""
        return cls(**config_dict)


@dataclass
class ServerConfig:
    """服务器配置"""
    knowledge_config: KnowledgeConfig
    text_corrector_config: TextCorrectorConfig
    asr_model_config: ASRModelConfig
    asr_default_params: ASRDefaultParams
    logger_config: LoggerConfig
    network_config: NetworkConfig
    session_dir: str = "sessions"

    def set_max_clients(self, max_clients: int):
        """设置最大客户端数"""
        self.network_config.max_clients = max_clients

    @classmethod
    def from_dict(cls, data: dict) -> 'ServerConfig':
        """从字典创建ServerConfig实例"""
        knowledge_config = KnowledgeConfig.from_dict(data['knowledge_config'])
        text_corrector_config = TextCorrectorConfig.from_dict(data['text_corrector_config'])
        asr_model_config = ASRModelConfig.from_dict(data['asr_model_config'])
        asr_default_params = ASRDefaultParams.from_dict(data['asr_default_params'])
        logger_config = LoggerConfig.from_dict(data['logger_config'])
        network_config = NetworkConfig.from_dict(data['network_config'])
        session_dir = data.get('session_dir', 'sessions')

        return cls(
            knowledge_config=knowledge_config,
            text_corrector_config=text_corrector_config,
            asr_model_config=asr_model_config,
            asr_default_params=asr_default_params,
            logger_config=logger_config,
            network_config=network_config,
            session_dir=session_dir
        )


def load_config(config_path: str) -> ServerConfig:
    """从JSON文件加载配置"""
    config_file = Path(config_path)
    if not config_file.exists():
        raise FileNotFoundError(f"配置文件不存在: {config_path}")

    with open(config_file, "r", encoding="utf-8") as f:
        config_data = json.load(f)

    return ServerConfig.from_dict(config_data)


# 全局配置实例
server_config = None

def init_config(config_path: str):
    """初始化配置"""
    global server_config
    server_config = load_config(config_path)


def get_server_config() -> ServerConfig:
    """获取服务器配置"""
    global server_config
    if server_config is None:
        # 返回默认配置
        server_config = ServerConfig(
            knowledge_config=KnowledgeConfig(
                api_url=DEFAULT_LLM_API_URL,
                model=DEFAULT_LLM_MODEL,
                api_key=DEFAULT_LLM_API_KEY,
                max_tokens=DEFAULT_LLM_MAX_TOKENS,
                sensitive_words=["什么", "如何", "怎么", "为什么", "how", "what", "why", "?", "不会", "不懂", "帮我", "请问", "能否", "建议", "麻烦", "请教"]
            ),
            text_corrector_config=TextCorrectorConfig(
                api_url=DEFAULT_LLM_API_URL,
                model=DEFAULT_LLM_MODEL,
                api_key=DEFAULT_LLM_API_KEY,
                max_tokens=DEFAULT_LLM_MAX_TOKENS,
                timeout=1.2,
                connection_timeout=0.5,
            ),
            asr_model_config=ASRModelConfig(
                streaming_model_dir="/all_models/ASRMODEL/SenseVoiceSmall",
                offline_model_dir="/all_models/ASRMODEL/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
                vad_model_path="./pretrained_models/silero_vad.onnx",
                segmentation_model_path="./pretrained_models/silero_vad.onnx",
                embedding_model_dir="speechbrain/spkrec-ecapa-voxceleb",
                streaming_asr_type=ASRType.SENSEVOICE,
                offline_asr_type=ASRType.SENSEVOICE
            ),
            asr_default_params=ASRDefaultParams(
                enable_advice=False,
                enable_text_correction=False,
                text_correction_min_length=40,
                spk_delta_new=0.58,
                spk_max_speakers=20,
                sample_rate=16000,
                min_duration_on=0.136,
                vad_silence_duration_s=0.6,
                vad_threshold=0.5,
                vad_max_speech_duration_s=30.0,
                vad_speech_start_buffer=0.2,
                transcribe_interval=1.0,
                device="cuda",
                enable_volume_detection=True,
                volume_threshold_db=-35.0,
                volume_check_duration_s=1.0,
                volume_warning_interval_s=2.0
            ),
            logger_config=LoggerConfig(
                level="DEBUG",
                log_dir="./logs",
                max_file_size=10485760,
                backup_count=5,
                console_output=True
            ),
            network_config=NetworkConfig(
                host="0.0.0.0",
                port=36005,
                max_clients=5
            ),
            session_dir="sessions"
        )
    return server_config

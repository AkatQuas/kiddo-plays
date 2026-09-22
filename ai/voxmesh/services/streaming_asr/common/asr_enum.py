#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ASR类型枚举定义
纯粹的枚举定义，不依赖任何其他模块，避免循环导入
"""

from enum import Enum


class ASRType(Enum):
    """ASR实现类型枚举"""
    FUNASR = "funasr"  # FunASR Large模型
    SENSEVOICE = "sensevoice"  # SenseVoice Small模型
    WHISPER = "whisper"
    QWEN = "qwen"  # Qwen-Audio模型
    PADDLE_SPEECH = "paddle_speech"

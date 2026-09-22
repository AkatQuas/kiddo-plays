#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Streaming ASR text correction — thin wrapper over voxmesh.llm."""

from common.config import get_server_config
from common.logger_config import logger
from voxmesh.llm.client import LLMClientConfig
from voxmesh.llm.correction import LLMCorrector


class TextCorrector:
    """文本纠错器"""

    def __init__(self, min_text_length: int = 20):
        self.min_text_length = min_text_length
        config = get_server_config().text_corrector_config
        self._corrector = LLMCorrector(
            config=LLMClientConfig(
                api_url=config.api_url,
                api_key=config.api_key,
                model=config.model,
                max_tokens=config.max_tokens,
                connect_timeout=config.connection_timeout,
                timeout=config.timeout,
            ),
            min_text_length=min_text_length,
            logger=logger,
        )

    def should_correct_text(self, text: str) -> bool:
        return self._corrector.should_correct_text(text)

    def correct_text(self, text: str, hotwords: list = None) -> str:
        return self._corrector.correct_text(text, hotwords)

    def is_available(self) -> bool:
        return self._corrector.is_available()


_text_corrector = None


def get_text_corrector() -> TextCorrector:
    global _text_corrector
    if _text_corrector is None:
        logger.info("创建全局文本纠错器实例")
        min_length = get_server_config().asr_default_params.text_correction_min_length
        _text_corrector = TextCorrector(min_text_length=min_length)
        logger.info(f"文本纠错器最小长度配置: {min_length}")
    return _text_corrector

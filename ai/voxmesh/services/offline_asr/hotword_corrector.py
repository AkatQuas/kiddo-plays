#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Offline hotword correction — thin wrapper over voxmesh.llm."""

import os
from typing import List, Optional

from logger_config import get_logger
from voxmesh.llm.client import LLMClientConfig
from voxmesh.llm.correction import LLMCorrector
from voxmesh.llm_defaults import (
    DEFAULT_LLM_API_KEY,
    DEFAULT_LLM_API_URL,
    DEFAULT_LLM_MAX_TOKENS,
    DEFAULT_LLM_MODEL,
)

logger = get_logger()


class HotwordCorrector:
    """热词纠错器"""

    def __init__(
        self,
        api_url: str = None,
        api_key: str = None,
        model: str = None,
        max_tokens: int = None,
        timeout: float = 10.0,
    ):
        self.timeout = timeout
        config = LLMClientConfig(
            api_url=api_url
            or os.getenv("HOTWORD_API_URL", os.getenv("LLM_API_URL", DEFAULT_LLM_API_URL)),
            api_key=api_key
            or os.getenv("HOTWORD_API_KEY", os.getenv("LLM_API_KEY", DEFAULT_LLM_API_KEY)),
            model=model or os.getenv("HOTWORD_MODEL", os.getenv("LLM_MODEL", DEFAULT_LLM_MODEL)),
            max_tokens=max_tokens or int(os.getenv("LLM_MAX_TOKENS", DEFAULT_LLM_MAX_TOKENS)),
            timeout=timeout,
        )
        self._corrector = LLMCorrector(config=config, min_text_length=0, logger=logger)
        if self._corrector.is_available():
            logger.info(f"热词纠错器初始化成功，API地址: {config.api_url}, 模型: {config.model}")
        else:
            logger.error("热词纠错器初始化失败")

    def correct_text_with_hotwords(self, text: str, hotwords: List[str]) -> str:
        return self._corrector.correct_text_with_hotwords(text, hotwords)

    def correct_texts_batch_with_hotwords(
        self,
        texts: List[str],
        hotwords: List[str],
        batch_size: int = 100,
    ) -> List[str]:
        return self._corrector.correct_texts_batch_with_hotwords(texts, hotwords, batch_size)

    def is_available(self) -> bool:
        return self._corrector.is_available()


_hotword_corrector = None


def get_hotword_corrector(
    api_url: str = None,
    api_key: str = None,
    model: str = None,
) -> Optional[HotwordCorrector]:
    global _hotword_corrector
    if _hotword_corrector is None:
        logger.info("创建全局热词纠错器实例")
        try:
            _hotword_corrector = HotwordCorrector(
                api_url=api_url,
                api_key=api_key,
                model=model,
            )
        except Exception as exc:
            logger.error(f"创建热词纠错器失败: {exc}")
            return None
    return _hotword_corrector

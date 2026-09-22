from __future__ import annotations

from typing import Any

from common.logger_config import logger


def validate_hotwords(hotwords: Any) -> bool:
    try:
        if not isinstance(hotwords, list):
            logger.error(f"热词必须是列表格式，当前类型: {type(hotwords)}")
            return False

        if len(hotwords) > 200:
            logger.error(f"热词数量超过限制，最大200个，当前: {len(hotwords)}")
            return False

        for i, word in enumerate(hotwords):
            if not isinstance(word, str):
                logger.error(f"热词[{i}]必须是字符串，当前类型: {type(word)}")
                return False

            word = word.strip()
            if len(word) == 0:
                logger.error(f"热词[{i}]不能为空")
                return False

            if len(word) > 50:
                logger.error(f"热词[{i}]长度超过限制，最大50字符，当前: {len(word)}")
                return False

        return True
    except Exception as exc:
        logger.error(f"热词验证过程中出错: {exc}")
        return False

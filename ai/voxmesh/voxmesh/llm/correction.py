from __future__ import annotations

import time
from typing import List, Optional

import openai

from voxmesh.llm.client import LLMClientConfig, create_openai_client
from voxmesh.llm.prompts import hotword_correction_system_prompt, streaming_correction_system_prompt
from voxmesh.llm.utils import calculate_edit_distance, has_consecutive_repeated_chars


class LLMCorrector:
    """Unified OpenAI-compatible text correction client."""

    def __init__(
        self,
        config: LLMClientConfig,
        min_text_length: int = 20,
        max_edit_distance: int = 5,
        logger=None,
    ):
        self.config = config
        self.min_text_length = min_text_length
        self.max_edit_distance = max_edit_distance
        self.logger = logger
        self.client = create_openai_client(config)

    def is_available(self) -> bool:
        return self.client is not None

    def should_correct_text(self, text: str) -> bool:
        if not text or not text.strip():
            return False
        length_condition = len(text.strip()) >= self.min_text_length
        repeated_chars_condition = has_consecutive_repeated_chars(text)
        return length_condition or repeated_chars_condition

    def _apply_edit_distance_guard(self, original: str, corrected: str) -> str:
        if not corrected or corrected == original:
            return original
        edit_distance = calculate_edit_distance(original, corrected)
        if edit_distance > self.max_edit_distance:
            if self.logger:
                self.logger.error(
                    f"纠错编辑距离过大({edit_distance} > {self.max_edit_distance})，返回原文本: '{original}'"
                )
            return original
        return corrected

    def _chat(self, system_prompt: str, user_content: str) -> Optional[str]:
        if not self.client:
            return None
        response = self.client.chat.completions.create(
            model=self.config.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            stream=False,
            temperature=0,
            max_tokens=self.config.max_tokens,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )
        return response.choices[0].message.content.strip()

    def correct_text(self, text: str, hotwords: Optional[List[str]] = None) -> str:
        if not text or not text.strip():
            return text
        if not self.should_correct_text(text):
            return text
        if not self.client:
            return text

        start_time = time.time()
        try:
            corrected = self._chat(
                streaming_correction_system_prompt(hotwords),
                text,
            )
            if corrected is None:
                return text
            request_time = (time.time() - start_time) * 1000
            if self.logger and corrected != text:
                self.logger.info(
                    f"文本纠错完成 (耗时: {request_time:.1f}ms): '{text}' -> '{corrected}'"
                )
            return self._apply_edit_distance_guard(text, corrected)
        except openai.APITimeoutError:
            if self.logger:
                self.logger.warning(f"文本纠错请求超时，返回原文本: {text}")
            return text
        except Exception as exc:
            if self.logger:
                self.logger.error(f"文本纠错失败: {exc}")
            return text

    def correct_text_with_hotwords(self, text: str, hotwords: List[str]) -> str:
        if not text or not text.strip() or not hotwords:
            return text
        if not self.client:
            return text

        start_time = time.time()
        try:
            corrected = self._chat(
                hotword_correction_system_prompt(hotwords, batch=False),
                text,
            )
            if corrected is None:
                return text
            request_time = (time.time() - start_time) * 1000
            if self.logger and corrected != text:
                self.logger.info(
                    f"热词纠错完成 (耗时: {request_time:.1f}ms): '{text}' -> '{corrected}'"
                )
            return self._apply_edit_distance_guard(text, corrected)
        except openai.APITimeoutError:
            if self.logger:
                self.logger.warning(f"热词纠错请求超时，返回原文本: {text}")
            return text
        except Exception as exc:
            if self.logger:
                self.logger.error(f"热词纠错失败: {exc}")
            return text

    def correct_texts_batch_with_hotwords(
        self,
        texts: List[str],
        hotwords: List[str],
        batch_size: int = 100,
    ) -> List[str]:
        if not texts or not hotwords or not self.client:
            return texts

        corrected_texts: List[str] = []
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i : i + batch_size]
            try:
                corrected_response = self._chat(
                    hotword_correction_system_prompt(hotwords, batch=True),
                    "\n".join(batch_texts),
                )
                if corrected_response is None:
                    corrected_texts.extend(batch_texts)
                    continue

                batch_corrected = [line.strip() for line in corrected_response.split("\n")]
                if len(batch_corrected) != len(batch_texts):
                    if self.logger:
                        self.logger.warning(
                            f"批量纠错输出句子数({len(batch_corrected)})与输入({len(batch_texts)})不一致"
                        )
                    corrected_texts.extend(batch_texts)
                    continue

                for orig, corr in zip(batch_texts, batch_corrected):
                    corrected_texts.append(self._apply_edit_distance_guard(orig, corr))
            except Exception as exc:
                if self.logger:
                    self.logger.error(f"批量纠错失败: {exc}")
                corrected_texts.extend(batch_texts)

        return corrected_texts

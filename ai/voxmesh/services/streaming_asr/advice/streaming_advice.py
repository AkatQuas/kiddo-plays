#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI智能建议流式处理模块
从service/streaming_advice.py移植并适配latest系统
"""

import asyncio
import queue
import threading
import time
from typing import Callable

from advice.summary_title import summary_title
from common.config import get_server_config
from common.logger_config import logger


class StreamingAdvice:
    """
    智能自适应滑动窗口建议服务类。
    负责根据说话频率动态调整窗口，智能判断何时触发LLM总结/建议，自动异步推送建议。
    用法：每次识别出一段文本后，调用add_text(text)，其余全部自动管理。
    """

    def __init__(self, send_func: Callable[[str], None]):
        """
        初始化流式建议服务

        Args:
            send_func: 发送建议的回调函数（如websocket.send）
        """
        # 待总结内容队列，累计到一定数量或满足条件时触发总结
        self.pending_texts = []
        # 消息时间戳队列，用于动态计算说话频率
        self.msg_timestamps = []
        # 上次总结时间，用于定时兜底触发
        self.last_summary_time = time.time()
        # 线程安全锁，保护窗口相关操作
        self.text_window_lock = asyncio.Lock()
        # 主题窗口，避免重复建议
        self.title_window = []
        # 主题窗口阈值
        self.title_window_threshold = 5

        # 发送建议的回调函数（如websocket.send）
        self.send_func = send_func

        # 文本处理队列
        self.text_queue = queue.Queue()

        # 启动固定线程
        self.processing_thread = threading.Thread(target=self._thread_worker, daemon=True)
        self.processing_thread.start()

        logger.info("StreamingAdvice已初始化")

    def _thread_worker(self):
        """固定线程的工作函数"""
        logger.info("AI建议处理线程已启动")

        # 在新线程中创建事件循环
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            # 运行异步函数
            loop.run_until_complete(self.process_text())
        finally:
            loop.close()

        logger.info("AI建议处理线程已结束")

    async def process_text(self):
        """处理文本的异步函数"""
        while True:
            try:
                text = self.text_queue.get(timeout=1)
                if text is None:
                    break

                now = time.time()
                trigger = self._should_trigger_summary(text)
                need_summary = False
                input_text = None

                async with self.text_window_lock:
                    self.pending_texts.append(text)
                    self.msg_timestamps.append(now)
                    N = self._get_dynamic_threshold()

                    if len(self.pending_texts) >= N:
                        need_summary = True
                    elif self.pending_texts and (now - self.last_summary_time > 60):
                        need_summary = True

                    if need_summary or trigger:
                        input_text = "\n".join(self.pending_texts)

                logger.debug(f"add_text: {text}, need_summary: {need_summary}, trigger: {trigger}, input_text_len: {len(input_text) if input_text else 0}")

                if (need_summary or trigger) and input_text:
                    await self._async_advice_task(input_text)

            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"process_text 处理文本时发生错误: {e}")

    def add_text(self, text: str):
        """
        新增一条识别文本，自动判断是否需要触发总结/建议。
        满足动态阈值、定时、内容敏感任一条件即触发。

        Args:
            text: 识别出的文本
        """
        if not text or not text.strip():
            return

        self.text_queue.put(text.strip())
        logger.debug(f"添加文本到建议队列: {text[:50]}...")

    def _should_trigger_summary(self, text: str) -> bool:
        """
        判断当前文本是否为敏感内容（如疑问、求助等），遇到则立即触发总结/建议。

        Args:
            text: 输入文本

        Returns:
            bool: 是否需要立即触发建议
        """
        try:
            config = get_server_config()
            sensitive_words = config.knowledge_config.sensitive_words

            for word in sensitive_words:
                if word in text:
                    logger.debug(f"检测到敏感词 '{word}'，立即触发建议")
                    return True

        except Exception as e:
            logger.error(f"检查敏感词时出错: {e}")

        return False

    def _get_dynamic_threshold(self, duration: int = 20) -> int:
        """
        根据最近20秒内的说话频率，动态调整触发总结的阈值N。
        说话频率高则N大，频率低则N小。
        动态调整msg_timestamps队列，只保留最近duration秒内的消息。

        Args:
            duration: 时间窗口长度（秒）

        Returns:
            int: 动态阈值
        """
        now = time.time()
        self.msg_timestamps = [t for t in self.msg_timestamps if now - t < duration]
        freq = len(self.msg_timestamps)

        min_N, max_N = 2, 10
        if freq >= 20:
            threshold = max_N
        elif freq <= 5:
            threshold = min_N
        else:
            threshold = int(min_N + (max_N - min_N) * (freq - 5) / (20 - 5))

        logger.debug(f"动态阈值计算: 频率={freq}, 阈值={threshold}")
        return threshold

    async def _async_advice_task(self, input_text: str):
        """
        异步调用LLM总结/建议，推送建议到客户端。
        总结后清空pending_texts，更新last_summary_time。

        Args:
            input_text: 待分析的文本
        """
        logger.info(f"开始异步建议任务，文本长度: {len(input_text)}")

        try:
            result = await asyncio.to_thread(summary_title, input_text, pre_titles=self.title_window)
            logger.info(f"AI总结结果: {result}")

            async with self.text_window_lock:
                if result.get("title") and result.get("title") not in self.title_window:
                    self.title_window.append(result["title"])
                    if len(self.title_window) > self.title_window_threshold:
                        self.title_window.pop(0)

                self.pending_texts.clear()
                self.last_summary_time = time.time()
                logger.debug(f"pending_texts已清空，title_window: {self.title_window}")

            if result.get("advice") and result.get("title") and result.get("content"):
                await self._send_advice(result["title"], result["content"])
                logger.info(f"已发送AI建议: {result['title']}")

        except Exception as e:
            logger.error(f"async_advice_task调用失败: {e}")

    async def _send_advice(self, title: str, content: str):
        """
        发送建议到客户端

        Args:
            title: 建议标题
            content: 建议内容
        """
        try:
            # 组成json对象
            advice_data = {
                "title": title,
                "prompt": content
            }

            # 直接传递JSON对象而不是字符串
            self.send_func(advice_data)
            logger.debug(f"已通过send_func发送建议: {title}")

        except Exception as e:
            logger.error(f"发送建议失败: {e}")

    def cleanup(self):
        """
        清理 StreamingAdvice 的资源
        """
        try:
            self.pending_texts.clear()
            self.msg_timestamps.clear()
            self.title_window.clear()
            self.last_summary_time = time.time()
            self.text_queue.put(None)

            if self.processing_thread.is_alive():
                self.processing_thread.join(timeout=5)

            logger.info("StreamingAdvice 资源清理完成")

        except Exception as e:
            logger.error(f"StreamingAdvice 清理时出错: {e}")

    def get_status(self) -> dict:
        """获取当前状态信息"""
        return {
            "pending_texts_count": len(self.pending_texts),
            "title_window": self.title_window,
            "msg_frequency": len(self.msg_timestamps),
            "last_summary_time": self.last_summary_time,
            "thread_alive": self.processing_thread.is_alive() if self.processing_thread else False
        }

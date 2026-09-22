#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
说话人特征提取服务日志配置模块
"""

import logging
import os
import socket
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler


class BeijingTimeFormatter(logging.Formatter):
    """使用北京时间的日志格式器"""

    def __init__(self, fmt=None, datefmt=None):
        super().__init__(fmt, datefmt)
        self.beijing_tz = timezone(timedelta(hours=8))

    def formatTime(self, record, datefmt=None):
        """重写formatTime方法以使用北京时间"""
        dt = datetime.fromtimestamp(record.created, tz=self.beijing_tz)
        if datefmt:
            return dt.strftime(datefmt)
        else:
            return dt.strftime('%Y-%m-%d %H:%M:%S')


# 全局logger实例
_logger = None

def setup_logger(log_dir: str = "./logs"):
    """设置说话人特征提取服务的日志配置

    Args:
        log_dir: 日志目录，默认为 "./logs"
    """
    global _logger

    # 独立服务配置
    max_file_size = 10485760  # 10MB
    backup_count = 5
    console_output = True
    level = "INFO"

    # 确保日志目录存在
    if not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)

    # 根据hostname生成日志文件名
    hostname = socket.gethostname()
    log_filename = os.path.join(log_dir, f"offline_asr_{hostname}.log")

    # 创建滚动日志处理器
    rotating_handler = RotatingFileHandler(
        log_filename,
        maxBytes=max_file_size,
        backupCount=backup_count,
        encoding='utf-8'
    )

    # 日志格式 - 使用北京时间格式器
    formatter = BeijingTimeFormatter("%(asctime)s|%(thread)d|%(levelname)s|%(module)s.%(filename)s:%(lineno)d|%(message)s")
    rotating_handler.setFormatter(formatter)

    handlers = [rotating_handler]

    # 控制台处理器
    if console_output:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        handlers.append(console_handler)

    # 设置日志级别
    log_level = getattr(logging, level.upper(), logging.INFO)

    # 创建专用的logger实例
    _logger = logging.getLogger("wakeup")

    # 清除现有的handlers
    for handler in _logger.handlers[:]:
        _logger.removeHandler(handler)

    # 添加新的handlers
    for handler in handlers:
        _logger.addHandler(handler)

    _logger.setLevel(log_level)

    # 设置离线模式，避免网络请求
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"


def get_logger() -> logging.Logger:
    """获取配置好的logger实例"""
    if _logger is None:
        raise RuntimeError("Logger not initialized. Call setup_logger() first.")
    return _logger

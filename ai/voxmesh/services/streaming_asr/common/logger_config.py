#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全局日志配置模块
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

def init_log():
    """初始化日志系统"""
    from common.config import get_server_config
    config = get_server_config().logger_config

    # 确保日志目录存在
    if config.log_dir and not os.path.exists(config.log_dir):
        os.makedirs(config.log_dir, exist_ok=True)

    hostname = socket.gethostname()
    log_filename = os.path.join(config.log_dir or "./logs", f"asr_service_{hostname}.log")

    # 创建滚动日志处理器
    rotating_handler = RotatingFileHandler(
        log_filename,
        maxBytes=config.max_file_size,
        backupCount=config.backup_count,
        encoding='utf-8'
    )

    # 日志格式 - 使用北京时间格式器
    formatter = BeijingTimeFormatter("%(asctime)s|%(thread)d|%(levelname)s|%(module)s.%(filename)s:%(lineno)d|%(message)s")
    rotating_handler.setFormatter(formatter)

    handlers = [rotating_handler]

    # 控制台处理器
    if config.console_output:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        handlers.append(console_handler)

    # 设置日志级别
    level = getattr(logging, config.level.upper(), logging.INFO)

    logging.basicConfig(
        level=level,
        handlers=handlers,
        force=True  # 强制重新配置
    )

# 初始化日志系统
init_log()

# 创建全局logger
logger = logging.getLogger("asr_service")

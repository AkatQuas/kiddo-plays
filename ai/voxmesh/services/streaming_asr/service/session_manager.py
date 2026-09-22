#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import time
from pathlib import Path
from typing import Optional

from common.logger_config import logger


class SessionManager:
    """会话状态管理器"""

    def __init__(self, session_dir: str = "sessions"):
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(exist_ok=True)
        logger.info(f"会话管理器初始化，会话目录: {self.session_dir.absolute()}")

    def _get_session_file(self, client_id: str) -> Path:
        """获取会话文件路径"""
        return self.session_dir / f"{client_id}.json"

    def save_session_state(self, client_id: str, asr_instance) -> bool:
        """保存会话状态到文件"""
        try:
            if not asr_instance:
                logger.warning(f"客户端 {client_id} ASR实例为空，无法保存会话状态")
                return False

            # 保存核心的会话状态
            session_data = {
                'client_id': client_id,
                'connection_start_time': getattr(asr_instance, 'connection_start_time', time.time()),
                'save_timestamp': time.time()
            }

            # 保存说话人聚类状态
            speaker_state = asr_instance.save_speaker_clustering()
            if speaker_state:
                session_data['speaker_clustering'] = speaker_state
                logger.info(f"客户端 {client_id} 保存了说话人聚类状态，包含 {len(speaker_state.get('registered_speakers', {}))} 个注册说话人")

            # 保存到文件（JSON格式，可读）
            session_file = self._get_session_file(client_id)
            with open(session_file, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, ensure_ascii=False, indent=2)

            logger.info(f"客户端 {client_id} 会话状态已保存到 {session_file}")
            return True

        except Exception as e:
            logger.error(f"保存客户端 {client_id} 会话状态失败: {e}")
            return False

    def _load_session_data(self, session_id: str) -> Optional[dict]:
        """从文件加载会话状态"""
        try:
            session_file = self._get_session_file(session_id)
            if not session_file.exists():
                logger.info(f"会话文件不存在: {session_file}")
                return None

            with open(session_file, 'r', encoding='utf-8') as f:
                session_data = json.load(f)

            logger.info(f"成功加载会话状态: {session_id}")
            return session_data

        except Exception as e:
            logger.error(f"加载会话状态失败 {session_id}: {e}")
            return None

    def restore_session_state(self, session_id, asr_instance) -> bool:
        """恢复ASR实例的会话状态"""
        try:
            session_data = self._load_session_data(session_id)
            if not session_data:
                logger.info(f"会话状态文件不存在: {session_id}")
                return False
            self.delete_session(session_id)

            # 只恢复连接开始时间（用于计算时间戳）
            asr_instance.connection_start_time = session_data.get('connection_start_time', time.time())

            # 恢复说话人聚类状态
            speaker_data = session_data.get('speaker_clustering')
            if speaker_data and hasattr(asr_instance, 'pooled_speaker_clustering') and asr_instance.pooled_speaker_clustering:
                success = asr_instance.restore_speaker_clustering(speaker_data)
                if success:
                    logger.info(f"说话人聚类状态恢复成功，包含 {len(speaker_data.get('registered_speakers', {}))} 个注册说话人")
                    return True
                else:
                    logger.warning("说话人聚类状态恢复失败")
                    return False
            else:
                logger.info("没有说话人聚类状态需要恢复")
                return True

        except Exception as e:
            logger.error(f"恢复会话状态失败: {e}")
            return False



    def delete_session(self, client_id: str) -> bool:
        """删除会话文件"""
        try:
            session_file = self._get_session_file(client_id)
            if session_file.exists():
                session_file.unlink()
                logger.info(f"会话文件已删除: {session_file}")
                return True
            return False
        except Exception as e:
            logger.error(f"删除会话文件失败 {client_id}: {e}")
            return False

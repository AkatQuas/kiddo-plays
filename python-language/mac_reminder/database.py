import sqlite3
import os
from datetime import datetime
from typing import List, Dict, Optional

class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_database()

    def _init_database(self):
        """初始化数据库和表结构"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 创建提醒任务表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS reminder_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name TEXT NOT NULL,
            task_type TEXT NOT NULL,
            cron_expression TEXT NOT NULL,
            content TEXT NOT NULL,
            image_path TEXT,
            hyperlink TEXT,
            is_active BOOLEAN DEFAULT 1,
            create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # 创建系统配置表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_key TEXT UNIQUE NOT NULL,
            config_value TEXT NOT NULL,
            description TEXT
        )
        ''')

        # 插入默认配置（首次启动）
        cursor.execute('SELECT COUNT(*) FROM system_config WHERE config_key = "http_port"')
        if cursor.fetchone()[0] == 0:
            default_configs = [
                ("http_port", "8000", "HTTP服务端口"),
                ("ws_port", "8000", "WebSocket端口"),
                ("notification_sound", "default", "通知音效"),
                ("notification_timeout", "10", "通知显示时长（秒）")
            ]
            cursor.executemany('INSERT INTO system_config (config_key, config_value, description) VALUES (?, ?, ?)', default_configs)

        # 插入默认提醒任务（首次启动）
        cursor.execute('SELECT COUNT(*) FROM reminder_tasks')
        if cursor.fetchone()[0] == 0:
            default_tasks = [
                ("喝水提醒", "drink_water", "0 */60 * * * *", "该喝水啦！每天8杯水，健康好身体～", "", "", 1),
                ("远眺提醒", "look_far", "0 */90 * * * *", "该远眺啦！让眼睛休息一下，看看窗外的风景～", "", "", 1)
            ]
            cursor.executemany('INSERT INTO reminder_tasks (task_name, task_type, cron_expression, content, image_path, hyperlink, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', default_tasks)

        conn.commit()
        conn.close()

    def get_all_tasks(self, is_active: Optional[bool] = None) -> List[Dict]:
        """获取所有提醒任务，可筛选是否启用"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # 让结果以字典形式返回
        cursor = conn.cursor()

        if is_active is None:
            cursor.execute('SELECT * FROM reminder_tasks ORDER BY id')
        else:
            cursor.execute('SELECT * FROM reminder_tasks WHERE is_active = ? ORDER BY id', (is_active,))

        tasks = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return tasks

    def add_task(self, task_name: str, task_type: str, cron_expression: str, content: str, image_path: str = "", hyperlink: str = "", is_active: bool = 1) -> int:
        """新增提醒任务，返回任务ID"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO reminder_tasks (task_name, task_type, cron_expression, content, image_path, hyperlink, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (task_name, task_type, cron_expression, content, image_path, hyperlink, is_active))
        task_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return task_id

    def update_task(self, task_id: int, **kwargs) -> bool:
        """更新任务信息，kwargs支持：task_name, task_type, cron_expression, content, image_path, hyperlink, is_active"""
        if not kwargs:
            return False

        set_clause = ", ".join([f"{k} = ?" for k in kwargs.keys()])
        params = list(kwargs.values()) + [task_id]

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(f'''
            UPDATE reminder_tasks
            SET {set_clause}, update_time = CURRENT_TIMESTAMP
            WHERE id = ?
            ''', params)
            conn.commit()
            return cursor.rowcount > 0
        except Exception:
            conn.rollback()
            return False
        finally:
            conn.close()

    def delete_task(self, task_id: int) -> bool:
        """删除任务"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM reminder_tasks WHERE id = ?', (task_id,))
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        return success

    def get_config(self, config_key: str) -> Optional[str]:
        """获取系统配置"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT config_value FROM system_config WHERE config_key = ?', (config_key,))
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else None

    def update_config(self, config_key: str, config_value: str) -> bool:
        """更新系统配置"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            # 先查是否存在，存在则更新，不存在则插入
            cursor.execute('SELECT COUNT(*) FROM system_config WHERE config_key = ?', (config_key,))
            if cursor.fetchone()[0] > 0:
                cursor.execute('UPDATE system_config SET config_value = ? WHERE config_key = ?', (config_value, config_key))
            else:
                cursor.execute('INSERT INTO system_config (config_key, config_value) VALUES (?, ?)', (config_key, config_value))
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            return False
        finally:
            conn.close()
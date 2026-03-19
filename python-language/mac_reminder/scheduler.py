import threading
from typing import Dict

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from database import Database
from notification import MacNotification


class ReminderScheduler:
    def __init__(self, db: Database, notification: MacNotification):
        self.db = db
        self.notification = notification
        self.scheduler = BackgroundScheduler(timezone="Asia/Shanghai")
        self.ws_connections = []  # 存储WebSocket连接
        self.lock = threading.Lock()

    def add_ws_connection(self, conn):
        """添加WebSocket连接"""
        with self.lock:
            self.ws_connections.append(conn)

    def remove_ws_connection(self, conn):
        """移除WebSocket连接"""
        with self.lock:
            if conn in self.ws_connections:
                self.ws_connections.remove(conn)

    async def send_ws_message(self, message: Dict):
        """推送消息到所有WebSocket客户端"""
        with self.lock:
            for conn in self.ws_connections:
                try:
                    await conn.send_json(message)
                except Exception:
                    self.ws_connections.remove(conn)

    def _reminder_job(self, task: Dict):
        """提醒任务执行函数"""
        # 发送MacOS通知
        self.notification.send_notification(
            title=task["task_name"],
            content=task["content"],
            image_path=task["image_path"],
            hyperlink=task["hyperlink"]
        )

        # 推送WebSocket消息（异步需包装）
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self.send_ws_message({
            "type": "reminder",
            "task_id": task["id"],
            "task_name": task["task_name"],
            "content": task["content"],
            "timestamp": loop.time()
        }))
        loop.close()

    def load_tasks(self):
        """加载所有启用的提醒任务到调度器"""
        # 先清空现有任务
        self.scheduler.remove_all_jobs()

        # 获取启用的任务
        active_tasks = self.db.get_all_tasks(is_active=True)
        for task in active_tasks:
            try:
                # 解析Cron表达式（秒 分 时 日 月 周）
                trigger = CronTrigger.from_crontab(task["cron_expression"], timezone="Asia/Shanghai")
                # 添加任务到调度器
                self.scheduler.add_job(
                    self._reminder_job,
                    trigger=trigger,
                    args=[task],
                    id=f"task_{task['id']}"
                )
            except Exception as e:
                print(f"加载任务失败（ID:{task['id']}）：{e}")

    def start(self):
        """启动调度器"""
        self.load_tasks()
        if not self.scheduler.running:
            self.scheduler.start()

    def stop(self):
        """停止调度器"""
        if self.scheduler.running:
            self.scheduler.shutdown()

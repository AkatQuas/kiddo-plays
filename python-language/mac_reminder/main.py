import argparse
import yaml
import os
import sys
from database import Database
from notification import MacNotification
from scheduler import ReminderScheduler
from api import create_api_app
import uvicorn
import threading

def load_yaml_config(config_path: str) -> dict:
    """加载YAML配置文件"""
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"配置文件不存在：{config_path}")
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def main():
    # 解析启动参数
    parser = argparse.ArgumentParser(description="MacOS定时提醒程序")
    parser.add_argument("--http-server", action="store_true", default=False, help="是否启动HTTP/WS服务（默认关闭）")
    parser.add_argument("--port", type=int, default=8000, help="HTTP/WS服务端口（默认8000）")
    parser.add_argument("--config", type=str, default="./config.yaml", help="配置文件路径（默认./config.yaml）")
    args = parser.parse_args()

    try:
        # 加载配置文件
        config = load_yaml_config(args.config)
        db_path = config["database"]["path"]
        enable_cors = config["server"]["enable_cors"]
        notification_sound = config["notification"]["sound"]
        notification_timeout = config["notification"]["timeout"]

        # 初始化组件
        db = Database(db_path)
        notification = MacNotification(sound=notification_sound, timeout=notification_timeout)
        scheduler = ReminderScheduler(db, notification)

        # 启动定时任务调度器
        scheduler.start()
        print("✅ 定时提醒调度器已启动")

        # 如果启动HTTP服务
        if args.http_server:
            # 创建FastAPI应用
            app = create_api_app(db, scheduler, enable_cors=enable_cors)
            # 启动HTTP服务（后台线程）
            server_thread = threading.Thread(
                target=uvicorn.run,
                args=(app,),
                kwargs={"host": "0.0.0.0", "port": args.port, "log_level": "info"},
                daemon=True
            )
            server_thread.start()
            print(f"✅ HTTP/WS服务已启动：http://localhost:{args.port} (接口文档：http://localhost:{args.port}/docs)")

        # 保持主程序运行
        print("📌 程序已后台运行，按 Ctrl+C 退出")
        while True:
            pass

    except KeyboardInterrupt:
        print("\n🛑 程序正在退出...")
        scheduler.stop()
        sys.exit(0)
    except Exception as e:
        print(f"❌ 程序启动失败：{e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import Database
from scheduler import ReminderScheduler


# 定义请求模型
class TaskCreate(BaseModel):
    task_name: str
    task_type: str
    cron_expression: str
    content: str
    image_path: Optional[str] = ""
    hyperlink: Optional[str] = ""
    is_active: Optional[bool] = True

class TaskUpdate(BaseModel):
    task_name: Optional[str] = None
    task_type: Optional[str] = None
    cron_expression: Optional[str] = None
    content: Optional[str] = None
    image_path: Optional[str] = None
    hyperlink: Optional[str] = None
    is_active: Optional[bool] = None

class ConfigUpdate(BaseModel):
    config_key: str
    config_value: str

def create_api_app(db: Database, scheduler: ReminderScheduler, enable_cors: bool = True):
    """创建FastAPI应用"""
    app = FastAPI(title="Mac提醒程序API", version="1.0")

    # 跨域中间件
    if enable_cors:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # WebSocket端点
    @app.websocket("/ws/reminder")
    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        scheduler.add_ws_connection(websocket)
        try:
            while True:
                # 保持连接，接收客户端心跳（可选）
                await websocket.receive_text()
        except WebSocketDisconnect:
            scheduler.remove_ws_connection(websocket)

    # 任务管理接口
    @app.get("/api/tasks", response_model=List[Dict])
    def get_tasks(is_active: Optional[bool] = None):
        """获取所有任务（可筛选是否启用）"""
        return db.get_all_tasks(is_active=is_active)

    @app.post("/api/tasks", response_model=Dict)
    def create_task(task: TaskCreate):
        """新增任务"""
        task_id = db.add_task(
            task_name=task.task_name,
            task_type=task.task_type,
            cron_expression=task.cron_expression,
            content=task.content,
            image_path=task.image_path,
            hyperlink=task.hyperlink,
            is_active=task.is_active
        )
        # 重新加载任务到调度器
        scheduler.load_tasks()
        return {"code": 200, "msg": "任务创建成功", "task_id": task_id}

    @app.put("/api/tasks/{task_id}", response_model=Dict)
    def update_task(task_id: int, task: TaskUpdate):
        """更新任务"""
        update_data = task.dict(exclude_none=True)
        success = db.update_task(task_id, **update_data)
        if not success:
            raise HTTPException(status_code=404, detail="任务不存在")
        # 重新加载任务到调度器
        scheduler.load_tasks()
        return {"code": 200, "msg": "任务更新成功"}

    @app.delete("/api/tasks/{task_id}", response_model=Dict)
    def delete_task(task_id: int):
        """删除任务"""
        success = db.delete_task(task_id)
        if not success:
            raise HTTPException(status_code=404, detail="任务不存在")
        # 重新加载任务到调度器
        scheduler.load_tasks()
        return {"code": 200, "msg": "任务删除成功"}

    # 系统配置接口
    @app.get("/api/config/{config_key}", response_model=Dict)
    def get_config(config_key: str):
        """获取系统配置"""
        value = db.get_config(config_key)
        if value is None:
            raise HTTPException(status_code=404, detail="配置不存在")
        return {"code": 200, "config_key": config_key, "config_value": value}

    @app.post("/api/config", response_model=Dict)
    def update_config(config: ConfigUpdate):
        """更新系统配置"""
        success = db.update_config(config.config_key, config.config_value)
        if not success:
            raise HTTPException(status_code=500, detail="配置更新失败")
        return {"code": 200, "msg": "配置更新成功"}

    return app

# Mac Reminder

## 打包为 MacOS App

打包失败，项目作废。

不过只需要替换 `notification` 的实现即可，项目中关于定时，http server 等能力依然完整可用。

## Run

仅后台运行（无 HTTP 服务，默认）

```bash
python3 main.py
```

启动 HTTP/WS 服务（支持接口调用）

```bash
# 默认端口8000
python3 main.py --http-server

# 自定义端口
python3 main.py --http-server --port 8888
```

## API

接口文档：访问 http://localhost:8000/docs（自动生成的 Swagger 文档）o

示例：新增自定义提醒任务

```bash
curl -X POST "http://localhost:8000/api/tasks" -H "Content-Type: application/json" -d '{
      "task_name": "午休提醒",
      "task_type": "custom",
      "cron_expression": "0 0 12 * * *",
      "content": "该午休啦！休息15分钟再工作～",
      "image_path": "/Users/yourname/Desktop/break.png",
      "hyperlink": "https://www.baidu.com"
    }'
```

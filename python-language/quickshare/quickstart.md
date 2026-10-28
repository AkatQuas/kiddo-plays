# QuickShare 快速开始

## 环境

- [uv](https://docs.astral.sh/uv/)
- Python 3.9 或更高版本（由 uv 准备）
- 设备在同一个局域网

## 启动

Windows 双击 `start.bat`。

macOS / Linux：

```bash
./start.sh
```

或：

```bash
uv sync
uv run quickshare
```

启动后终端会打印本地地址和局域网地址。其他设备用浏览器打开局域网那一个。

## 使用

1. 打开「文件管理」，拖拽或选择文件上传。其他设备点下载。
2. 打开「文本」，写下内容。编辑会保留原来的那一条。

## 改端口和上传上限

编辑 `config.py` 里的 `PORT`、`MAX_UPLOAD_MB` 和 `DATA_DIR`。环境变量 `QUICKSHARE_PORT`、`QUICKSHARE_MAX_UPLOAD_MB`、`QUICKSHARE_DATA_DIR` 会覆盖文件里的值。上传的文件和文本都在 `DATA_DIR` 这一个目录里。页面上的「最大 xxMB」跟上传上限是同一个数。

## 防火墙

其他设备打不开时，放行你设置的端口（默认 9527）。

## 安全

这个服务没有登录。同一局域网里的人都能上传、下载和删除。不要暴露到公网。调试模式默认关闭，不要在局域网里打开 Werkzeug 调试器。

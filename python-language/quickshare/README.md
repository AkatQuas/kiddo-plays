# QuickShare

局域网里的临时共享站。一台电脑运行服务，同一网络里的手机或另一台电脑用浏览器上传、下载文件，或留下一段文本。

没有账号，也没有权限区分。只适合你信任的局域网，不要把端口暴露到公网。

## 功能

- 文件上传、下载、删除，拖拽和多文件上传
- 原始文件名会保留，磁盘上的名字带时间戳，避免重名
- 分类、搜索，以及 MD5
- 文本的创建、编辑、删除。一条文本只有内容，编辑不会换掉原来的 id
- 页面上的上传上限和服务器实际限制是同一个数

## 运行

需要 [uv](https://docs.astral.sh/uv/) 和 Python 3.9+。uv 会按 `uv.lock` 创建项目环境。

```bash
uv sync
uv run quickshare
```

[快速开始](./quickstart.md)， macOS / Linux 也可以 `./start.sh`，Windows 双击 `start.bat`。这两个脚本都会先执行 `uv sync --frozen`。

默认地址是 <http://localhost:9527>。终端会打印局域网地址，例如 `http://192.168.1.20:9527`。

## 配置

改 `config.py`，或用环境变量覆盖（环境变量优先）：

| config.py            | 环境变量                        | 含义                              |
| -------------------- | ------------------------------- | --------------------------------- |
| `HOST`               | `QUICKSHARE_HOST`               | 监听地址，默认 `0.0.0.0`          |
| `PORT`               | `QUICKSHARE_PORT`               | 端口，默认 `9527`                 |
| `DEBUG`              | `QUICKSHARE_DEBUG`              | 调试器，默认关闭                  |
| `MAX_UPLOAD_MB`      | `QUICKSHARE_MAX_UPLOAD_MB`      | 上传上限，默认 `1024`（1GB）      |
| `MAX_CONTENT_LENGTH` | `QUICKSHARE_MAX_CONTENT_LENGTH` | 文本内容上限                      |
| `DATA_DIR`           | `QUICKSHARE_DATA_DIR`           | 上传内容和文本的目录，默认 `data` |

调试器默认关闭：Werkzeug 调试器在局域网里等于远程代码执行。需要自动重载时再设 `QUICKSHARE_DEBUG=1`。

## 数据放在哪

上传的文件和文本都在项目根目录的 `data/` 里，已写入 `.gitignore`：

- `data/uploads/`：文件本体和元数据
- `data/texts.json`、`data/categories.json`、`data/md5_cache.json`

改 `config.py` 的 `DATA_DIR`，或用 `QUICKSHARE_DATA_DIR` 换一个目录。相对路径相对于项目根目录。

## 测试

```bash
uv sync
uv run pytest
```

## 布局

- `src/quickshare/`：应用代码、页面和静态文件
- `src/quickshare/file_share.py`：文件共享。名字、分类、MD5、删除时的清理都在这里
- `src/quickshare/text_share.py`：文本共享。编辑保持原来的 id
- `src/quickshare/lan.py`：局域网地址
- `src/quickshare/settings.py`：上传上限、端口和数据目录。根目录的 `config.py` 是它读取的配置
- `src/quickshare/app.py`：HTTP 路由，本身不保存文件
- `data/`：上传内容和文本
- `tests/`：测试

词汇见 [`GLOSSARY.md`](./GLOSSARY.md)。

## 许可

MIT，见 [`LICENSE`](./LICENSE)。

# -*- coding: utf-8 -*-
"""
QuickShare 配置。

改这里，或用环境变量覆盖（环境变量优先）：

    QUICKSHARE_HOST
    QUICKSHARE_PORT
    QUICKSHARE_DEBUG          1 / true / yes / on
    QUICKSHARE_MAX_UPLOAD_MB
    QUICKSHARE_MAX_CONTENT_LENGTH
    QUICKSHARE_DATA_DIR
"""

# 监听地址。0.0.0.0 表示本机所有网卡。
HOST = "0.0.0.0"

# 服务端口。页面上的局域网地址和 413 提示都读这个值。
PORT = 9527

# 调试器默认关闭。Werkzeug 调试器在局域网里等于远程代码执行。
DEBUG = False

# 单个请求的上传上限，单位 MB。当前为 1GB。
MAX_UPLOAD_MB = 1024

# 一条文本的内容上限。
MAX_CONTENT_LENGTH = 100_000

# 上传文件、文本、分类和 MD5 都放在这里。相对路径相对于项目根目录。
DATA_DIR = "data"

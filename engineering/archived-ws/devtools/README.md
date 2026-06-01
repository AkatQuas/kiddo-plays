# Devtools Setup

首先安装 [depot_tools 工具](https://commondatastorage.googleapis.com/chrome-infra-docs/flat/depot_tools/docs/html/depot_tools_tutorial.html#_setting_up)。

```bash
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
```

将 depot_tools 所在路径写入 PATH 环境变量，举例 ~/.bash_profile 文件中，因为部分工具执行需要在 PATH 中得到正确索引。

```bash
# .bash_profile
export PATH=$PATH:/path/to/depot_tools
```

重启终端以生效。

找一个空目录，拉取 devtools-frontend 的代码，然后就看 [workflow.md](https://github.com/ChromeDevTools/devtools-frontend/blob/main/docs/workflows.md) 的描述。

```bash
# in an empty folder
$ fetch devtools-frontend

# Update third_party repos and run pre-compile hooks
$ gclient sync
```

流水线参考 [workshop-demo.sh](./workshop-demo.sh) 。

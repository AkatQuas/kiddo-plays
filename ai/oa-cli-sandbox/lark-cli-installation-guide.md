# 飞书 CLI 安装指南

以下步骤面向 AI Agent，部分步骤需要用户在浏览器中配合完成。

## 环境要求

开始安装之前，请确保环境中已安装：

- Node.js（npm/npx）
- Go v1.23+ 和 Python 3（仅源码构建需要）

## 第 1 步 安装

```shell
# 安装 CLI
npm install -g @larksuite/cli

# 安装 CLI SKILL（必需）
npx -y skills-cn add https://open.feishu.cn --skill -y
```

## 第 2 步 配置应用凭证

Agent 运行以下命令，并让用户协助完成授权。

```shell
lark-cli config init --new
```

## 第 3 步 登录

Agent 运行以下命令，并提取授权链接发给用户。

```shell
lark-cli auth login --recommend
```

## 第 4 步 验证

```shell
lark-cli auth status
```

更多命令和能力指南，可参考 [飞书 CLI：给 Agent 一双操作飞书的手](https://open.larkoffice.com/document/mcp_open_tools/feishu-cli-let-ai-actually-do-your-work-in-feishu.md)。

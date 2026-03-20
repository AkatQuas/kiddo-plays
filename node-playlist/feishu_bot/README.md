# Feish Bot

个人用的[飞书机器人](https://open.feishu.cn/app)

参考[开发指南](https://open.feishu.cn/document/server-side-sdk/nodejs-sdk/preparation-before-development)

使用[使用长连接接收事件](https://open.feishu.cn/document/server-side-sdk/nodejs-sdk/handling-events#7b66a4ad)，监听消息对话，进行额外处理。

## 使用方式

复制 `.env.example` 为 `.env`，填上正确的 `APP_ID`，`APP_SECRET` 以及 `MY_PHONE`。

获取 USER_ID ：`node src/get-user-id.mjs`。

生成 `src/constant.json` ，其中会有 `USER_ID`，这是 union_id，详见 [用户身份概述](https://open.feishu.cn/document/platform-overveiw/basic-concepts/user-identity-introduction/introduction) 。

## 启动 ws 长连接

`node src/ws.mjs` ，进行消息监听。

## 主动发送消息

`node src/send-message.mjs`，发送一些消息给指定用户。

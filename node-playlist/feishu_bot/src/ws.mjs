import * as lark from '@larksuiteoapi/node-sdk';
import { getClient, getWSClient } from './client.mjs';

function main() {
  const client = getClient();
  const wsClient = getWSClient();
  wsClient.start({
    // 处理「接收消息」事件，事件类型为 im.message.receive_v1
    eventDispatcher: new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data) => {
        const {
          message: { chat_id, content }
        } = data;
        // 示例操作：接收消息后，调用「发送消息」API 进行消息回复。
        // LLM 逻辑, agent input

        // agent output

        // 发送回复的消息
        await client.im.v1.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chat_id,
            content: lark.messageCard.defaultCard({
              title: `回复： ${JSON.parse(content).text}`,
              content: '新年好'
            }),
            msg_type: 'interactive'
          }
        });
      },
      'card.action.trigger': async (data) => {
        console.log(data);
        // action button event 事件
        return {
          toast: {
            type: 'success',
            content: '卡片交互成功',
            i18n: {
              zh_cn: '卡片交互成功',
              en_us: 'card action success'
            }
          }
        };
      }
    })
  });
}

main();

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

        // or agent invocation

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
        /*
        {
  schema: '2.0',
  event_id: '7ddc6124c257e1******e934f0ebc602',
  token: 'c-688f97c914b92********424556a8a930b852a4f',
  create_time: '1774450156843270',
  event_type: 'card.action.trigger',
  tenant_key: '2ce29b1*****975d',
  app_id: 'cli_a******46db95bde',
  operator: {
    tenant_key: '2ce2******8f975d',
    user_id: 'f1****9c',
    open_id: 'ou_762601*******3ff28ff3d7acce71c9f',
    union_id: 'on_beeee*******f879d8d63ce3973bab7f'
  },
  action: { value: { action: 'approve_task_123' }, tag: 'button' },
  host: 'im_message',
  context: {
    open_message_id: 'om_x100******0f1c46cc3bc38040f0410c',
    open_chat_id: 'oc_194cfc1*******790cd4e755680091d2'
  },
}
        */
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

import { getClient } from './client.mjs';
import { readConstantJson } from './constant.mjs';

/**
 * 主动发送消息，定时通知等等
 */
const sendMessage = async () => {
  const { USER_ID } = await readConstantJson();
  const client = getClient();
  const { data } = await client.im.message.create({
    params: {
      receive_id_type: 'union_id'
    },
    data: {
      receive_id: USER_ID,
      content: JSON.stringify({ text: 'hello world' }),
      msg_type: 'text'
    }
  });
  console.debug('\x1B[97;42;1m --- result  --- \x1B[m', '\n', data);
};

sendMessage();

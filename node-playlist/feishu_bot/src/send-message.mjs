import { getClient } from './client.mjs';
import { readConstantJson } from './constant.mjs';

/**
 * 卡片模板颜色映射
 * @readonly
 * @enum {string}
 */
export const CardTemplate = {
  /** 蓝色 - 默认/信息 */
  blue: 'blue',
  /** 绿色 - 成功 */
  green: 'green',
  /** 红色 - 错误/警告 */
  red: 'red',
  /** 黄色 - 警告 */
  yellow: 'yellow',
  /** 灰度 - 灰色 */
  grey: 'grey',
  /** 青色 - 提示 */
  cyan: 'cyan',
  /** 橙色 - 橙色 */
  orange: 'orange',
  /** 透明 - 透明 */
  transparent: 'transparent'
};

// ============ Element Builders ============

/**
 * 构建 div 元素 (文本/图片)
 * @param {object} options - 配置
 * @param {string} [options.text] - 文本内容
 * @param {string} [options.imageUrl] - 图片链接
 * @param {string} [options.altText] - 图片 alt 文本
 * @param {'left' | 'center' | 'right'} [options.textAlign] - 文本对齐方式
 * @returns {object} div 元素 JSON
 */
export const buildDiv = ({ text, imageUrl, altText, textAlign }) => {
  const element = { tag: 'div' };

  if (text) {
    element.text = {
      tag: 'plain_text',
      content: text
    };
    if (textAlign) {
      element.text.align = textAlign;
    }
  }

  if (imageUrl) {
    element.img = {
      tag: 'image',
      img_key: imageUrl,
      alt: {
        tag: 'plain_text',
        content: altText || ''
      }
    };
  }

  return element;
};

/**
 * 构建 markdown 元素
 * @param {object} options - 配置
 * @param {string} options.content - markdown 内容
 * @param {object} options.href - href object, key 可以用在 markdown 里面使用
 * @param {'left' | 'center' | 'right'} [options.textAlign] - 文本对齐方式
 * @returns {object} markdown 元素 JSON
 */
export const buildMarkdown = ({ content, textAlign, href }) => {
  const element = {
    tag: 'markdown',
    content
  };

  if (textAlign) {
    element.align = textAlign;
  }
  if (href) {
    element.href = href;
  }

  return element;
};

// ============ Action Builders ============

/**
 * 构建交互式卡片操作项（按钮）
 * @param {object} options - 操作配置
 * @param {string} options.text - 按钮文本
 * @param {'primary' | 'default'} [options.type='primary'] - 按钮类型
 * @param {string} [options.url] - 按钮跳转链接 (用于 url 类型操作)
 * @param {string} [options.value] - 按钮回调值 (用于 message 类型操作)
 * @returns {object} 操作 JSON 对象
 */
export const buildAction = ({ text, type = 'primary', url, value }) => {
  const action = {
    tag: 'button',
    text: {
      tag: 'plain_text',
      content: text
    },
    type
  };

  if (url) {
    action.url = url;
  }

  if (value) {
    action.value = { action: value };
  }

  return action;
};

/**
 * 从配置列表批量构建操作按钮
 * @param {object[]} actionList - 操作配置列表
 * @param {string} actionList[].text - 按钮文本
 * @param {'primary' | 'default'} [actionList[].type] - 按钮类型
 * @param {string} [actionList[].url] - 按钮跳转链接
 * @param {string} [actionList[].value] - 按钮回调值
 * @returns {object[]} 操作 JSON 对象数组
 */
export const buildActionsFromList = (actionList) => {
  return actionList.map((item) => buildAction(item));
};

// ============ Card Builder ============

/**
 * 构建交互式卡片
 * @param {object} options - 卡片配置
 * @param {string} [options.headerTitle] - 卡片标题
 * @param {string} [options.template='blue'] - 卡片模板颜色 (使用 CardTemplate 常量)
 * @param {object[]} [options.elements] - 元素数组 (由 buildDiv/buildMarkdown 等生成)
 * @param {object[]} [options.actions] - 操作按钮数组 (由 buildAction 生成)
 * @returns {object} 卡片 JSON 对象
 */
export const buildInteractiveCard = ({
  headerTitle,
  template = 'blue',
  elements,
  actions
}) => {
  const header = headerTitle
    ? {
        title: {
          tag: 'plain_text',
          content: headerTitle
        },
        template
      }
    : null;

  const cardElements = [];

  // 添加元素
  if (elements && elements.length > 0) {
    cardElements.push(...elements);
  }

  // 添加操作按钮
  if (actions && actions.length > 0) {
    cardElements.push({
      tag: 'action',
      actions
    });
  }

  const card = {
    config: {
      wide_screen_mode: true
    }
  };

  if (header) {
    card.header = header;
  }

  if (cardElements.length > 0) {
    card.elements = cardElements;
  }

  return card;
};

// ============ Message Senders ============

/**
 * 发送文本消息
 * @param {string} receiveId - 接收者 ID (union_id / user_id / open_id)
 * @param {string} text - 消息文本内容
 * @param {'union_id' | 'user_id' | 'open_id'} [receiveIdType='union_id'] - 接收者 ID 类型
 */
export const sendMessage = async (
  receiveId,
  text,
  receiveIdType = 'union_id'
) => {
  const client = getClient();
  const { data } = await client.im.message.create({
    params: {
      receive_id_type: receiveIdType
    },
    data: {
      receive_id: receiveId,
      content: JSON.stringify({ text }),
      msg_type: 'text'
    }
  });
  console.debug('\x1B[97;42;1m --- result --- \x1B[m', '\n', data);
  return data;
};

/**
 * 发送交互式卡片消息
 * @param {string} receiveId - 接收者 ID (union_id / user_id / open_id)
 * @param {object} card - 卡片 JSON 对象
 * @param {'union_id' | 'user_id' | 'open_id'} [receiveIdType='union_id'] - 接收者 ID 类型
 */
export const sendCardMessage = async (
  receiveId,
  card,
  receiveIdType = 'union_id'
) => {
  const client = getClient();
  const { data } = await client.im.message.create({
    params: {
      receive_id_type: receiveIdType
    },
    data: {
      receive_id: receiveId,
      content: JSON.stringify(card),
      msg_type: 'interactive'
    }
  });
  console.debug('\x1B[97;42;1m --- card result --- \x1B[m', '\n', data);
  return data;
};

// ============ Demos ============

// Demo: 发送纯文本消息
const demoSendMessage = async () => {
  const { USER_ID } = await readConstantJson();
  await sendMessage(USER_ID, 'hello world');
};

// Demo: 发送交互式卡片
const demoSendCard = async () => {
  const { USER_ID } = await readConstantJson();

  // 从列表批量构建操作按钮
  const actions = buildActionsFromList([
    { text: 'View Details', url: 'https://example.com/task/123' },
    { text: 'Approve', type: 'primary', value: 'approve_task_123' },
    { text: 'Reject', type: 'default', value: 'reject_task_123' }
  ]);

  // 构建不同类型的元素
  const elements = [
    buildDiv({ text: 'Task completed successfully!', textAlign: 'left' }),
    buildMarkdown({
      content: '**Summary**\n- Status: Completed\n- Time: 2026-03-25'
    }),
    buildDiv({
      text: 'Click the buttons below to take action:',
      textAlign: 'center'
    })
  ];

  // 构建卡片 (使用绿色模板表示成功)
  const card = buildInteractiveCard({
    headerTitle: 'Task Notification',
    template: CardTemplate.green,
    elements,
    actions
  });

  // 发送卡片
  await sendCardMessage(USER_ID, card);
};

demoSendCard();

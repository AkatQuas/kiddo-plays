import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MarkdownRender } from '../src/MarkdownRender';

const demoContent = `### 订单提醒

您有一个待处理订单

:::ui-card title="订单#1001" variant="primary" action="view:1001"

- 商品：机械键盘
- 实付：¥129
:::

:::ui-button label="去支付" variant="success" action="switch:pay_1001" :::

:::ui-panel title="更多操作"
:::ui-button label="联系客服" variant="default" action="switch:support" :::
:::ui-button label="取消订单" variant="default" action="cancel:1001" :::
:::

:::ui-form field="phone" placeholder="请输入手机号" action="submit:contact"
请留下联系方式，方便客服回访
:::
`;

function DemoApp() {
  const [lastAction, setLastAction] = useState<string>('（暂无）');

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '40px auto',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <h1>Markdown Remark Demo</h1>
      <p style={{ color: '#64748b' }}>
        最近交互：<code>{lastAction}</code>
      </p>
      <MarkdownRender
        content={demoContent}
        onAction={(action) => setLastAction(action)}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>
);

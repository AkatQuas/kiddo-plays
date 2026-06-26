# markdown-remark

AI 对话 Markdown 渲染引擎 MVP：基于 `react-markdown` + `remark-directive`，支持 `:::ui-xxx` 自定义标记自动渲染业务 UI 组件。

## 安装

```bash
npm install
```

## 开发

```bash
npm run dev      # Demo 示例页
npm test         # Vitest 单元测试
npm run test:coverage
npm run build
```

## 快速使用

```tsx
import { MarkdownRender } from 'markdown-remark';
import 'markdown-remark/styles.css';

const chatText = `
### 订单提醒
:::ui-card title="订单#1001" variant="primary" action="view:1001"
- 商品：机械键盘
- 实付：¥129
:::
:::ui-button label="去支付" variant="success" action="switch:pay_1001" :::
`;

<MarkdownRender content={chatText} onAction={(action) => console.log(action)} />
```

## 文档

- [UI 标记语法（Prompt 约束）](./docs/UI_MARKDOWN_SYNTAX.md)
- [PRD](./custom-plugin.md)

## 插件流水线

`remark-parse → 外部 remarkPlugins → remark-directive + remarkUiTransform → remark-gfm → remark-rehype → 外部 rehypePlugins + rehype-highlight`

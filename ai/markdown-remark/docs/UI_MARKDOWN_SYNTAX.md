# Markdown 自定义 UI 标记语法（Prompt 约束文档）

本文档供 Prompt 工程师约束大模型输出，确保对话 Markdown 可被 `markdown-remark` 正确解析并渲染交互 UI。

## 1. 总则

1. 交互 UI **必须**使用 `:::ui-xxx` 容器指令语法，**禁止**输出原生 HTML。
2. 普通文本、标题、列表、表格、代码块仍使用标准 Markdown。
3. 单条消息内 UI 组件不超过 **6** 个。
4. **禁止** UI 组件多层嵌套（`ui-panel` 内嵌 `ui-button` 除外）。

## 2. 通用语法

```
:::ui-[组件名] key1="值1" key2="值2"
（可选 Markdown 内容）
:::
```

单行组件（如按钮）可写为：

```
:::ui-button label="按钮文字" action="switch:target" :::
```

### 属性规则

| 属性 | 说明 | 示例 |
|------|------|------|
| `title` | 卡片/面板标题 | `title="订单详情"` |
| `label` | 按钮文字 | `label="去支付"` |
| `field` | 表单字段 key | `field="phone"` |
| `placeholder` | 输入框占位 | `placeholder="请输入手机号"` |
| `variant` | 样式变体 | `primary` / `default` / `success` |
| `action` | 交互指令 | `view:1001`、`switch:order` |

- 属性值统一使用 **双引号** 包裹。
- `action` 格式固定为 `操作类型:参数`。

### 支持的 action 操作类型

| 类型 | 含义 | 示例 |
|------|------|------|
| `switch` | 切换对话分支 | `switch:order_detail` |
| `view` | 查看详情 | `view:goods_1001` |
| `submit` | 提交数据 | `submit:user_info` |
| `cancel` | 取消操作 | `cancel:order_88` |

## 3. 预置组件

### ui-card — 信息卡片

```md
:::ui-card title="商品推荐" variant="primary" action="view:goods_1001"

- 无线蓝牙耳机 ￥199
- 机械键盘 ￥129
:::
```

### ui-button — 操作按钮

```md
:::ui-button label="查看订单" variant="primary" action="switch:order_detail" :::
```

### ui-form — 简易表单

```md
:::ui-form field="phone" placeholder="请输入手机号" action="submit:user_info"
请填写联系电话用于发货
:::
```

### ui-panel — 分组面板

```md
:::ui-panel title="订单操作面板"
:::ui-button label="取消订单" variant="default" action="cancel:order_88" :::
:::ui-button label="确认收货" variant="success" action="confirm:order_88" :::
:::
```

## 4. 完整示例

```md
### 订单提醒

您有一个待处理订单

:::ui-card title="订单#1001" variant="primary" action="view:1001"

- 商品：机械键盘
- 实付：¥129
:::

:::ui-button label="去支付" variant="success" action="switch:pay_1001" :::
```

## 5. 禁止事项

- 不要输出 `<div>`、`<button>` 等 HTML 标签。
- 不要使用未定义的 `:::ui-xxx` 组件名。
- 不要在 `ui-card` / `ui-form` 内再嵌套 `ui-card` 或 `ui-panel`。
- 不要省略容器闭合标记 `:::`（除单行 leaf 指令外）。

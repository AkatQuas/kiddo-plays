# PRD：对话Markdown自定义UI组件渲染MVP

## 文档基础信息

| 项         | 内容                                                                                |
| ---------- | ----------------------------------------------------------------------------------- |
| PRD版本    | V1.0 MVP                                                                            |
| 产品模块   | AI对话消息渲染引擎                                                                  |
| 技术底座   | react-markdown + unified/remark/rehype 生态                                         |
| 核心目标   | 支持LLM输出带自定义标记的Markdown，自动渲染业务UI组件（卡片、按钮、表单、列表面板） |
| 依赖基础包 | react-markdown、remark-gfm、rehype-highlight、remark-directive、unist-util-visit    |
| 测试框架   | Vitest + @testing-library/react（DOM渲染单元测试）                                  |
| 上线范围   | 对话消息体渲染模块，仅MVP预置基础UI组件，可后续扩展                                 |

# 一、需求背景

当前对话内容全部使用标准Markdown渲染，仅支持原生文本、表格、代码块，无法承载交互型UI（操作按钮、信息卡片、表单输入、操作面板）。
采用**扩展Markdown容器指令语法**（方案1），让大模型输出带 `:::ui-xxx` 自定义标记的Markdown文本；
前端通过自定义remark插件解析标记，映射为预设React业务组件，实现纯文本对话与动态交互UI统一渲染，无需模型输出JSON结构，降低模型输出约束成本。

# 二、核心需求范围（MVP限定）

## 1. 基础渲染能力保留（不改动原有逻辑）

原有全部能力兼容，作为底层基线：

1. react-markdown 基础Markdown解析渲染
2. remark-gfm：表格、任务列表、删除线、自动链接
3. rehype-highlight：代码块语法高亮
   新增能力：**自定义remark插件注册机制 + 自定义UI标记解析流水线**

## 2. 自定义Remark插件注册能力

### 2.1 功能说明

提供统一配置入口，支持外部注入自定义remark插件，内置MVP专用UI解析插件，插件执行顺序可控：
流水线执行顺序固定：
`remark-parse → 外部注册remark插件数组 → 内置ui-directive解析插件 → remark-gfm → remark-rehype → rehype插件`

### 2.2 对外API设计（组件Props）

```ts
type MarkdownRenderProps = {
  // 原始AI对话markdown文本
  content: string;
  // 外部自定义remark插件数组，支持业务自定义扩展
  remarkPlugins?: PluggableList;
  // 外部自定义rehype插件数组
  rehypePlugins?: PluggableList;
  // 业务自定义组件映射（覆盖默认UI组件）
  uiComponents?: Record<string, React.FC<any>>;
};
```

### 2.3 插件执行规则

1. 用户传入 `remarkPlugins` 先执行；
2. 再执行内置 `remarkUiDirective`（解析:::ui-xxx标记核心插件）；
3. 再执行内置 `remark-gfm`；
4. rehype侧保持原有：用户插件 + rehype-highlight

## 3. 自定义UI扩展标记语法规范（核心定义）

基于 `remark-directive` 标准容器指令语法，统一约定，模型强制遵循该格式输出。

### 3.1 通用语法规则

1. 容器起始标记：`:::ui-[组件名] key1="值1" key2="值2"`
2. 容器结束标记：`:::`
3. 属性规则：
   - 属性值统一双引号包裹，支持字符串、数字；
   - 预留 `action="xxx:param"` 作为对话流交互指令；
   - 预留 `variant` 控制组件样式变体（primary/default/success）；
4. 容器内部支持嵌套标准Markdown文本、列表、代码块、其他轻量ui组件；
5. 禁止多层ui组件嵌套（MVP限制，降低解析复杂度）。

### 3.2 MVP预定义4种UI组件标记

#### （1）ui-card 信息卡片

用于展示结构化信息、商品、通知、详情面板

```md
:::ui-card title="商品推荐" variant="primary" action="view:goods_1001"

- 无线蓝牙耳机 ￥199
- 机械键盘 ￥129
  :::
```

属性：

- title：卡片标题
- variant：样式变体
- action：点击卡片整体触发对话指令

#### （2）ui-button 操作按钮

单条交互按钮，驱动对话分支跳转、提交数据

```md
:::ui-button label="查看订单" variant="primary" action="switch:order_detail" :::
```

属性：

- label：按钮展示文字
- variant：按钮类型
- action：点击执行指令

#### （3）ui-form 简易输入表单

用于收集用户单行输入（查询、手机号、备注）

```md
:::ui-form field="phone" placeholder="请输入手机号" action="submit:user_info"
请填写联系电话用于发货
:::
```

属性：

- field：表单字段key
- placeholder：输入框提示文字
- action：提交后回调指令

#### （4）ui-panel 分组面板

多内容分组容器，用于多组操作集合

```md
:::ui-panel title="订单操作面板"
:::ui-button label="取消订单" variant="default" action="cancel:order_88" :::
:::ui-button label="确认收货" variant="success" action="confirm:order_88" :::
:::
```

### 3.3 模型输出约束规则（交付给Prompt使用）

1. 交互UI必须使用上述 `:::ui-xxx` 标记包裹，禁止输出原生HTML；
2. 所有action指令格式固定 `操作类型:参数`，仅支持 `switch/view/submit/cancel`；
3. 一个消息内ui组件不超过6个，禁止复杂嵌套；
4. 普通文本、列表、代码仍使用标准markdown，无需套ui标记。

## 4. 解析流水线逻辑（remarkUiDirective插件内部流程）

1. 通过 `unist-util-visit` 遍历mdast，识别 `containerDirective` 类型节点；
2. 匹配节点name前缀 `ui-`，判定为业务UI组件；
3. 提取节点上所有属性（title/action/variant等）挂载到node.data.uiProps；
4. 转换节点类型与标识，传递至remark-rehype；
5. 转换hast阶段生成自定义标签 `<ui-card data-ui-props="序列化属性">`；
6. react-markdown components 拦截自定义ui标签，渲染预设React组件，注入props与交互回调。

## 5. 内置预设UI组件实现

1. 内置4组基础React组件：UiCard、UiButton、UiForm、UiPanel；
2. 组件统一接收props：所有定义属性 + children子节点内容 + onAction回调；
3. 对外支持 `uiComponents` 属性覆盖默认组件，业务可自定义样式；
4. 交互统一回调：onAction(actionStr)，上层对话容器监听action，处理对话分支跳转、数据提交。

# 三、测试需求（Vitest DOM渲染测试）

## 1. 测试环境

- 测试框架：Vitest
- DOM渲染库：@testing-library/react
- 测试范围：单元测试，不接入后端/LLM

## 2. 测试用例分类（MVP必测）

### 2.1 基础Markdown基线测试

1. 纯文本、标题、列表、表格正常渲染；
2. 代码块高亮正常生效（rehype-highlight）。

### 2.2 自定义remark插件注册测试

1. 传入自定义remark插件可正常执行，修改mdast生效；
2. 插件执行顺序：外部插件 → 内置ui解析插件；
3. 非法插件传入不导致渲染崩溃（容错）。

### 2.3 UI标记解析核心测试

分别对4种预定义ui组件编写渲染用例：

1. 单ui-card标记完整渲染，title、variant、action属性正确透传；
2. ui-button渲染按钮，label文本、action参数正确挂载；
3. ui-form渲染输入框，placeholder、field参数正常；
4. ui-panel内部嵌套多个ui-button可正常渲染；
5. 非法ui标记（未定义ui-test）降级为普通文本，不报错。

### 2.4 交互行为测试

1. 点击ui-button触发onAction回调，正确传递action字符串；
2. ui-form输入后提交触发对应action；
3. 卡片点击触发action回调。

### 2.5 混合内容兼容测试

1. Markdown原生内容 + ui组件混合渲染无错乱；

```md
### 我的订单

这里是订单基础信息
:::ui-card title="订单1001" action="view:1001"

- 商品：机械键盘
- 金额：129元
  :::
```

2. 多段连续ui组件正常分行渲染。

### 2.6 异常容错测试

1. ui标记缺少闭合`:::`，自动降级渲染原始文本，页面不崩溃；
2. ui属性缺少引号、非法字符，插件自动过滤非法属性，保留可识别字段；
3. action空值、无效指令，组件正常渲染，点击无报错。

## 3. 测试脚本目录约定

```
__tests__/
├─ markdown-base.test.tsx       # 基础markdown、gfm、代码高亮
├─ remark-plugin-register.test.tsx # 自定义插件注册逻辑
├─ ui-card.test.tsx
├─ ui-button.test.tsx
├─ ui-form.test.tsx
├─ ui-panel.test.tsx
├─ mix-content.test.tsx         # 混合内容渲染
└─ error-fallback.test.tsx      # 异常降级容错
```

# 四、非需求范围（MVP不做，后续迭代）

1. 可视化UI标记编辑器；
2. 动态新增ui组件配置（MVP仅内置4个）；
3. 复杂多嵌套ui组件；
4. 模型输出JSON混合渲染方案；
5. 移动端独立样式适配（仅基础响应式）；
6. 权限、复杂表单校验逻辑。

# 五、交付物清单

1. Markdown渲染React组件源码，支持remark插件注入、uiComponents覆盖；
2. 内置 remarkUiDirective 解析插件源码；
3. 4套预置UI业务组件（UiCard/UiButton/UiForm/UiPanel）；
4. Vitest完整DOM测试用例，单测覆盖率≥90%；
5. Markdown自定义UI标记语法文档（提供给Prompt工程师约束模型输出）；
6. 组件使用Demo页面（Storybook/简单示例页）。

# 六、上线验收标准

1. 原有全部Markdown渲染能力无回归；
2. 4种预定义ui标记均可正常解析、渲染、触发交互；
3. 外部传入自定义remark插件可正常注册并执行；
4. 所有Vitest单元测试全部通过，无渲染报错；
5. 非法、残缺ui标记自动降级，页面不白屏、不崩溃；
6. LLM输出混合标准md + ui标记文本展示效果符合预期。

# 补充：简易组件使用示例（开发参考）

```tsx
import MarkdownRender from './MarkdownRender';

const chatText = `
### 订单提醒
您有一个待处理订单
:::ui-card title="订单#1001" variant="primary" action="view:1001"
- 商品：机械键盘
- 实付：¥129
:::
:::ui-button label="去支付" variant="success" action="pay:1001" :::
`;

function ChatMsg() {
  const handleAction = (actionStr: string) => {
    // 处理对话流跳转、提交逻辑
    console.log('触发交互', actionStr);
  };
  return (
    <MarkdownRender
      content={chatText}
      // 支持注入自定义remark插件
      remarkPlugins={[yourCustomRemarkPlugin]}
      // 覆盖默认UI组件样式
      uiComponents={{
        UiButton: CustomBrandButton
      }}
      onAction={handleAction}
    />
  );
}
```

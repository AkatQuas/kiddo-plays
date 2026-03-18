重要：只做方案设计，输出成 Markdown 内容，后续会用于 coding agent 进行代码实现。。

设计一个运行在网页的 chatbot agent 项目，基本要求：

- Web UI，使用 react 和 Typescript
- 优先使用浏览器原生支持的能力，或者开源的库来实现功能，
- UI 展现使用 shadcn UI 或 Radix UI
- 请求使用浏览器原生的 Fetch
- 需要额外实现的内容，请先留空标注，提醒实现逻辑要点。
- 大模型 provider 调用工具使用类似 litellm 的库，不要直接调用 LLM 的 api，使用社区已实现的适配库

产品设计：

- chatbot 的运行对话模式为接收用户的消息后发送给 LLM 大模型，
- 大模型 API key 的配置入口，可以通过 modal 来实现，首次使用时，提醒用户进行设置
- 每一轮对话开始时是一个会话 session，
- 用户的一次输入可能涉及多次 LLM 调用，所以存在 loop 机制，
- loop 机制中暴露一些 hooks 钩子函数，允许对对话过程进行 interception
- 每一条用户消息，需要 guardian 进行安全检测和转译，再进行 context 整理，组装 system prompt ，历史消息等，发送给大模型
- 消息体过长时，需要考虑 compact ，自动执行，不阻塞当前的会话，且不影响当前的历史消息
- 大模型返回流式结果 stream response ，因此渲染消息时需要注意动态的渲染内容。
- chatbot 中对话消息中需要支持 LLM 的流式渲染内容，
- 支持不同类型的内容展示，如大模型的思考过程内容，code block，表格，图片，markdown 语法
- 大模型会返回若干 tool call / mcp 的调用处理，前端需要实现相应的处理能力，现阶段以 mock 返回进行占位兜底，至少实现 3 个工具，均使用 mock 兜底，这些调用过程也需要在消息列表中进行展现，包括调用状态，调用入参，调用结果
- 大模型返回的内容可能存在错误，如 API key 过期，接口无法连接，等等，需要有错误提醒给用户，以及推荐解决办法
- 消息列表展示的历史消息可使用懒加载，提高性能，有条件的话考虑虚拟滚动
- 会话的用户输入中支持文本输入，支持图片附件
- 单条消息可以被删除，在对话中删除
- 支持用户在 LLM 返回响应的过程中仍然输入，追加消息
- 用户可以中断当前的对话过程，正在运行的请求应当终止，
- 消息渲染的块元素支持对消息内容删除、复制的能力，这些功能以通用化的按钮设计承载
- 部分信息需要长期记忆的，写入 long term memory ，考虑持久化
- 可引导用户定义特性，user prompt ，这些都需要持久化
- 历史会话列表的处理，需要支持切换，导出和删除，另外需要考虑持久化，下次打开后依然可以读取，持久化需要考虑载入性能，例如增量写入，避免全量覆盖；读取时异步加载，分片读入，不阻塞页面渲染
- provider API 配置页面需要表单处理，使用强类型的表单，schema 优先的表单

性能要求：
- 非核心组件的应该懒加载，如使用 IntersectionObserver 实现图片懒加载，使用 React.memo 缓存纯展示组件，useCallback/useMemo 优化回调和计算值
- 选择合理的状态管理工具， 如 zustand，精细化管理状态，组件仅订阅所需状态，避免嵌套层级的组件的更新引起性能问题

风格：

- 所有文件名只有小写字母，数字，下划线
- 配置 git hooks，执行lint ， 类型检测等必要质量保障手段
- 使用 vite 工具，编译要快，用上常规的编译产物优化手段
- 优先使用 named export ,避免 default export
- 配置好 lint 工具，eslint 和 prettier，每个工具的配置项都使用脚本，支持人工二次编辑
- 整体架构需要清晰地分层次，例如参考：
   - 用户交互层：接收文本 / 图片输入、触发发送 / 删除 / 导出等操作、响应键盘 / 鼠标事件
   - UI 层：渲染消息列表、会话列表、配置 Modal、工具调用展示等，仅处理视图逻辑
   - 应用逻辑层：消息安全检测、上下文整理、消息压缩、会话生命周期、hook 拦截逻辑
   - 数据模块：内存状态管理（Zustand）、持久化读写、数据格式转换
   - LLM 交互模块：litellm 调用、流式响应处理、API 错误捕获与提示、请求中断逻辑
   - 工具调用模块：tool call/mcp 解析、调用状态管理、Mock 工具实现、调用过程展示逻辑
   - 持久化模块：增量写入、分片读取、数据序列化 / 反序列化
- react 是 ui 层，主体逻辑应当有一个自洽的 application 应用承载
- hooks 尽量用来承载 状态 和 view ，事件和 view 的连接，而不是具体的逻辑
- 以路由为划分页面，为后续扩展功能留下基础
- 组件内部状态尽量只维护自身的，或从全局 store 订阅，
- 全局 store 与持久化的能力之间需要解耦
- 组件实现时遵循 react 推荐，追求高性能
- 对于关键模块要使用单元测试

目录结构参考：

```
chatbot_agent/
├── .husky/                      # git hooks配置
│   ├── pre-commit               # 提交前执行lint/类型检测
│   └── pre-push                 # 推送前执行构建验证
├── public/                      # 静态资源
├── src/
│   ├── assets/                  # 图片/样式等资源
│   ├── components/              # UI组件（按功能划分）
│   │   ├── chat/                # 聊天相关组件
│   │   │   ├── chat_input.tsx   # 消息输入框（文本+图片）
│   │   │   ├── chat_message.tsx # 单条消息渲染组件
│   │   │   ├── chat_list.tsx    # 消息列表（虚拟滚动）
│   │   │   ├── tool_call_item.tsx # 工具调用展示项
│   │   │   └── message_actions.tsx # 消息删除/复制按钮
│   │   ├── common/              # 通用组件
│   │   │   ├── button.tsx       # 通用按钮
│   │   │   ├── modal.tsx        # 通用Modal
│   │   │   └── lazy_image.tsx   # 懒加载图片组件
│   │   ├── config/              # 配置相关组件
│   │   │   ├── api_config_form.tsx # API配置表单
│   │   │   └── prompt_setting.tsx # 自定义Prompt配置
│   │   └── session/             # 会话列表组件
│   │       ├── session_item.tsx # 单条会话项
│   │       └── session_list.tsx # 会话列表
│   ├── hooks/                   # 视图相关Hooks
│   │   ├── use_chat_input.ts    # 输入框状态/事件Hook
│   │   ├── use_message_list.ts  # 消息列表渲染Hook
│   │   ├── use_session_list.ts  # 会话列表Hook
│   │   ├── use_lazy_load.ts     # 懒加载Hook
│   │   └── use_stream_render.ts # 流式渲染Hook
│   ├── pages/                   # 路由页面
│   │   ├── chat_page.tsx        # 主聊天页面
│   │   ├── config_page.tsx      # 配置页面
│   │   └── session_page.tsx     # 会话管理页面
│   ├── application/             # 应用逻辑层
│   │   ├── chat_agent.ts        # 核心Chatbot逻辑
│   │   ├── session_manager.ts   # 会话生命周期管理
│   │   ├── message_guardian.ts  # 消息安全检测/转译
│   │   ├── context_builder.ts   # 上下文组装（system prompt+历史消息）
│   │   ├── message_compact.ts   # 消息压缩逻辑
│   │   └── hooks/               # 对话过程拦截钩子
│   │       ├── pre_send_hook.ts # 发送前拦截
│   │       ├── post_receive_hook.ts # 接收后拦截
│   │       └── tool_call_hook.ts # 工具调用拦截
│   ├── store/                   # 状态管理（Zustand）
│   │   ├── chat_store.ts        # 聊天状态（当前消息、输入内容等）
│   │   ├── session_store.ts     # 会话状态（历史会话、当前会话等）
│   │   ├── config_store.ts      # 配置状态（API key、provider等）
│   │   └── tool_store.ts        # 工具调用状态
│   ├── persistence/             # 持久化模块
│   │   ├── base_persistence.ts  # 持久化基类
│   │   ├── local_storage.ts     # localStorage适配
│   │   ├── indexed_db.ts        # IndexedDB适配
│   │   └── serializer.ts        # 数据序列化/反序列化
│   ├── services/                # 服务层
│   │   ├── llm_service.ts       # LLM交互服务
│   │   ├── tool_service.ts      # 工具调用服务
│   │   └── error_service.ts     # 错误处理服务
│   ├── mocks/                   # Mock数据
│   │   ├── tools/               # 工具Mock实现
│   │   │   ├── weather_tool.ts  # 天气工具Mock
│   │   │   ├── calculator_tool.ts # 计算器工具Mock
│   │   │   └── translator_tool.ts # 翻译工具Mock
│   │   └── llm_responses.ts     # LLM响应Mock
│   ├── types/                   # 类型定义
│   │   ├── chat.ts              # 聊天相关类型
│   │   ├── session.ts           # 会话相关类型
│   │   ├── config.ts            # 配置相关类型
│   │   ├── tool.ts              # 工具调用相关类型
│   │   └── api.ts               # API交互相关类型
│   ├── utils/                   # 工具函数
│   │   ├── fetch_utils.ts       # Fetch封装
│   │   ├── markdown_utils.ts    # Markdown处理
│   │   ├── performance_utils.ts # 性能优化工具
│   │   └── validation_utils.ts  # 数据验证工具
│   ├── routes/                  # 路由配置
│   │   ├── router.tsx           # 路由定义
│   │   └── routes.ts            # 路由常量
│   ├── App.tsx                  # 根组件
│   ├── main.tsx                 # 入口文件
│   └── vite-env.d.ts            # Vite类型声明
├── .eslintrc.js                 # ESLint配置
├── .prettierrc.js               # Prettier配置
├── tsconfig.json                # TypeScript配置
├── vite.config.ts               # Vite配置
├── package.json                 # 依赖配置
└── README.md                    # 项目说明
```

UI 层详细设计
3.1.1 核心页面

聊天主页面（chat_page.tsx）
- 左侧：会话列表（支持切换、删除、导出）
- 右侧：消息列表（虚拟滚动）+ 输入框（文本 + 图片上传）
- 首次进入：弹出 API 配置 Modal，引导用户配置 LLM API key
- 交互：支持中断当前请求、追加消息、删除单条消息

配置页面（config_page.tsx）
- Schema 优先的表单（基于 zod+react-hook-form）
- 支持配置：LLM provider（OpenAI/Anthropic 等）、API key、system prompt、自定义特性
-表单验证：实时校验 API key 格式，支持保存 / 重置
- 持久化：配置变更后增量写入持久化存储

会话管理页面（session_page.tsx）
- 展示所有历史会话，支持批量删除、导出
- 会话筛选、搜索（预留扩展点）
- 异步加载会话列表，分片读取，不阻塞渲染

3.1.2 核心组件

聊天输入组件（chat_input.tsx）
- 功能：文本输入、图片附件上传、发送按钮、中断按钮（请求中显示）
- 优化：React.memo 缓存，useCallback 优化事件回调
- 交互：回车发送、支持粘贴图片、请求中仍可输入追加内容

消息渲染组件（chat_message.tsx）
- 支持类型：用户消息、LLM 消息（流式渲染）、工具调用消息（状态 + 入参 + 结果）
- 富文本：渲染 Markdown、代码块（语法高亮）、表格、图片
- 操作按钮：删除、复制（悬浮显示）
- 优化：React.memo 缓存，仅当消息内容变更时重新渲染

虚拟滚动消息列表（chat_list.tsx）
- 基于 @tanstack/react-virtualizer 实现
- 懒加载：仅渲染可视区域内的消息
- 性能：useMemo 缓存列表计算值，IntersectionObserver 实现图片懒加载

API 配置 Modal（api_config_modal.tsx）
- Schema 优先表单：zod 定义表单结构，react-hook-form 处理状态
- 强类型：表单值与配置类型严格匹配
- 引导：首次使用自动弹出，配置完成后隐藏

验收要求：

- 编译通过，无类型报错
- 如果有单元测试，单元测试也要通过

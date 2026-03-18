# Chatbot Agent 项目设计方案详解

## 1. 项目概述

### 1.1 核心目标

开发一款运行在网页端的 Chatbot Agent，支持与大模型的流式交互、工具调用、会话管理、配置持久化等核心能力，兼顾性能与用户体验。

### 1.2 设计原则

- 优先使用浏览器原生能力 + 开源库，减少冗余依赖

- 分层架构设计，解耦核心逻辑与UI层

- 强类型约束，全流程 TypeScript 覆盖

- 性能优先，通过懒加载、虚拟滚动等手段优化体验

- 工程化规范，保障代码质量与可维护性

## 2. 技术栈选型

| 分类          | 技术/库                         | 选型理由                                                    |
| ------------- | ------------------------------- | ----------------------------------------------------------- |
| 核心框架      | React + TypeScript              | 前端主流框架，强类型保障代码健壮性                          |
| UI 组件库     | shadcn/ui + Radix UI            | 轻量、可定制，符合原子化设计理念，无冗余封装                |
| 网络请求      | 浏览器原生 Fetch                | 无需额外依赖，符合\&\#34;优先原生\&\#34;原则                |
| LLM 适配      | litellm                         | 统一多厂商 LLM API 调用方式，避免直接对接各厂商接口         |
| 状态管理      | Zustand                         | 轻量、无 Provider 嵌套，支持精细化订阅，性能优于 Redux      |
| 表单处理      | react\-hook\-form + zod         | Schema 优先，强类型表单验证，适配 TypeScript                |
| 虚拟滚动      | @tanstack/react\-virtualizer    | 高性能虚拟列表，适配长列表渲染场景                          |
| Markdown 渲染 | react\-markdown + rehype\-prism | 支持富文本渲染，代码块语法高亮                              |
| 构建工具      | Vite                            | 编译速度快，内置优化能力，适配现代前端工程化                |
| 代码规范      | ESLint + Prettier + Husky       | 保障代码风格统一，提交前自动校验                            |
| 持久化存储    | localStorage + IndexedDB        | 分层存储：轻量配置用 localStorage，大量会话数据用 IndexedDB |
| 测试工具      | Vitest + React Testing Library  | 轻量测试框架，适配 Vite 生态，支持单元测试                  |

## 3. 整体架构设计

采用分层解耦的架构设计，各层职责清晰，避免逻辑耦合：

```Plaintext
graph TD
    A[用户交互层] --> B[UI层]
    B --> C[应用逻辑层]
    C --> D[数据层]
    C --> E[LLM交互层]
    C --> F[工具调用层]
    D --> G[持久化层]
    E --> H[第三方LLM Provider]
    F --> I[Mock工具集]
```

### 3.1 分层职责说明

| 分层       | 核心职责                                                         | 核心文件/模块                                           |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| 用户交互层 | 接收文本/图片输入、触发操作（发送/删除/导出）、响应键盘/鼠标事件 | chat_input.tsx、message_actions.tsx                     |
| UI 层      | 渲染页面/组件，仅处理视图逻辑，不包含业务逻辑                    | chat_page.tsx、chat_list.tsx、session_list.tsx          |
| 应用逻辑层 | 消息安全检测、上下文组装、消息压缩、会话生命周期、拦截钩子       | chat_agent.ts、message_guardian.ts、context_builder.ts  |
| 数据层     | 内存状态管理、数据格式转换、状态订阅/更新                        | store/chat_store.ts、store/session_store.ts             |
| LLM 交互层 | litellm 调用、流式响应处理、API 错误捕获、请求中断               | services/llm_service.ts                                 |
| 工具调用层 | tool call 解析、Mock 工具实现、调用状态管理、过程展示            | services/tool_service.ts、mocks/tools/                  |
| 持久化层   | 增量写入、分片读取、数据序列化/反序列化                          | persistence/local_storage.ts、persistence/indexed_db.ts |

## 4. 详细目录结构

```Plaintext
chatbot_agent/
├── .husky/                      # Git Hooks配置
│   ├── pre-commit               # 提交前执行lint/类型检测
│   └── pre-push                 # 推送前执行构建验证
├── public/                      # 静态资源（favicon、默认图片等）
├── src/
│   ├── assets/                  # 静态资源（样式、图片、图标）
│   ├── components/              # UI组件（按功能划分，纯视图逻辑）
│   │   ├── chat/                # 聊天核心组件
│   │   │   ├── chat_input.tsx   # 消息输入框（文本+图片上传）
│   │   │   ├── chat_message.tsx # 单条消息渲染组件
│   │   │   ├── chat_list.tsx    # 虚拟滚动消息列表
│   │   │   ├── tool_call_item.tsx # 工具调用展示项
│   │   │   └── message_actions.tsx # 消息删除/复制操作按钮
│   │   ├── common/              # 通用基础组件
│   │   │   ├── button.tsx       # 通用按钮（封装shadcn按钮）
│   │   │   ├── modal.tsx        # 通用Modal（基于Radix UI）
│   │   │   ├── lazy_image.tsx   # 懒加载图片组件
│   │   │   └── virtual_list.tsx # 通用虚拟滚动容器
│   │   ├── config/              # 配置相关组件
│   │   │   ├── api_config_form.tsx # API配置表单（Schema优先）
│   │   │   └── prompt_setting.tsx # 自定义Prompt配置组件
│   │   └── session/             # 会话管理组件
│   │       ├── session_item.tsx # 单条会话项组件
│   │       └── session_list.tsx # 会话列表组件
│   ├── hooks/                   # 视图相关Hooks（仅状态/事件绑定）
│   │   ├── use_chat_input.ts    # 输入框状态/事件处理Hook
│   │   ├── use_message_list.ts  # 消息列表渲染Hook（绑定虚拟滚动）
│   │   ├── use_session_list.ts  # 会话列表加载/操作Hook
│   │   ├── use_lazy_load.ts     # 通用懒加载Hook（基于IntersectionObserver）
│   │   └── use_stream_render.ts # 流式消息渲染Hook
│   ├── pages/                   # 路由页面（仅组装组件，无业务逻辑）
│   │   ├── chat_page.tsx        # 主聊天页面（核心页面）
│   │   ├── config_page.tsx      # 全局配置页面
│   │   └── session_page.tsx     # 会话管理页面
│   ├── application/             # 应用逻辑层（核心业务逻辑）
│   │   ├── chat_agent.ts        # Chatbot核心逻辑（会话流转、Loop机制）
│   │   ├── session_manager.ts   # 会话生命周期管理（创建/切换/删除）
│   │   ├── message_guardian.ts  # 消息安全检测/转译（待实现：关键词过滤、内容转译）
│   │   ├── context_builder.ts   # 上下文组装（system prompt+历史消息）
│   │   ├── message_compact.ts   # 消息压缩逻辑（待实现：长消息自动压缩，不阻塞会话）
│   │   └── hooks/               # 对话拦截钩子
│   │       ├── pre_send_hook.ts # 发送前拦截钩子（待实现：自定义处理逻辑入口）
│   │       ├── post_receive_hook.ts # 接收后拦截钩子（待实现：结果加工入口）
│   │       └── tool_call_hook.ts # 工具调用拦截钩子（待实现：工具调用干预入口）
│   ├── store/                   # Zustand状态管理（仅存储内存状态）
│   │   ├── chat_store.ts        # 聊天状态（当前消息、输入内容、加载状态）
│   │   ├── session_store.ts     # 会话状态（历史会话、当前会话ID）
│   │   ├── config_store.ts      # 配置状态（API key、Provider、Prompt）
│   │   └── tool_store.ts        # 工具调用状态（调用中/成功/失败、入参/结果）
│   ├── persistence/             # 持久化模块（解耦store与存储介质）
│   │   ├── base_persistence.ts  # 持久化基类（定义通用接口）
│   │   ├── local_storage.ts     # localStorage适配实现
│   │   ├── indexed_db.ts        # IndexedDB适配实现（大量数据存储）
│   │   └── serializer.ts        # 数据序列化/反序列化工具
│   ├── services/                # 服务层（对接外部/核心能力）
│   │   ├── llm_service.ts       # LLM交互服务（litellm调用、流式处理）
│   │   ├── tool_service.ts      # 工具调用服务（解析/执行/状态更新）
│   │   └── error_service.ts     # 错误处理服务（错误分类、提示文案）
│   ├── mocks/                   # Mock数据/工具（兜底实现）
│   │   ├── tools/               # 工具Mock实现（至少3个）
│   │   │   ├── weather_tool.ts  # 天气查询工具Mock
│   │   │   ├── calculator_tool.ts # 计算器工具Mock
│   │   │   └── translator_tool.ts # 翻译工具Mock
│   │   └── llm_responses.ts     # LLM响应Mock（流式/非流式）
│   ├── types/                   # 全局类型定义（强类型约束）
│   │   ├── chat.ts              # 聊天消息相关类型
│   │   ├── session.ts           # 会话相关类型
│   │   ├── config.ts            # 配置相关类型
│   │   ├── tool.ts              # 工具调用相关类型
│   │   └── api.ts               # API交互相关类型
│   ├── utils/                   # 通用工具函数
│   │   ├── fetch_utils.ts       # Fetch封装（拦截、错误处理）
│   │   ├── markdown_utils.ts    # Markdown处理（渲染配置、特殊语法）
│   │   ├── performance_utils.ts # 性能优化工具（防抖、节流、缓存）
│   │   └── validation_utils.ts  # 数据验证工具（对接zod）
│   ├── routes/                  # 路由配置
│   │   ├── router.tsx           # 路由定义（React Router v6）
│   │   └── routes.ts            # 路由常量（路径、名称）
│   ├── App.tsx                  # 根组件（路由出口、全局样式）
│   ├── main.tsx                 # 入口文件（React渲染、全局初始化）
│   └── vite-env.d.ts            # Vite类型声明
├── .eslintrc.js                 # ESLint配置（TypeScript+React规则）
├── .prettierrc.js               # Prettier配置（代码格式化规则）
├── tsconfig.json                # TypeScript配置（编译选项、类型解析）
├── vite.config.ts               # Vite配置（构建、优化、别名）
├── package.json                 # 依赖配置（核心依赖+开发依赖）
└── README.md                    # 项目说明（启动、构建、目录说明）
```

## 5. 核心模块详细设计

### 5.1 应用逻辑层核心设计

#### 5.1.1 ChatAgent 核心逻辑（application/chat_agent.ts）

```TypeScript
// 核心能力：会话Loop机制、钩子执行、消息流转
export class ChatAgent {
  private sessionId: string;
  private abortController: AbortController | null = null; // 用于中断请求
  private hooks = {
    preSend: [] as PreSendHook[], // 发送前钩子
    postReceive: [] as PostReceiveHook[], // 接收后钩子
    toolCall: [] as ToolCallHook[], // 工具调用钩子
  };

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  // 注册钩子
  registerHook(type: HookType, hook: Function) {
    // 实现逻辑：将钩子添加到对应数组，去重
    // 【待实现】：钩子优先级管理、执行顺序控制
  }

  // 核心Loop：处理用户消息 -> 安全检测 -> 上下文组装 -> LLM调用 -> 工具调用 -> 结果返回
  async handleUserMessage(message: UserMessage): Promise<void> {
    // 1. 中断已有请求（如果存在）
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      // 2. 执行发送前钩子
      const processedMessage = await this.executePreSendHooks(message);

      // 3. 消息安全检测
      const guardedMessage = await messageGuardian.validateAndTransform(processedMessage);

      // 4. 上下文组装（system prompt + 历史消息 + 当前消息）
      const context = await contextBuilder.buildContext({
        sessionId: this.sessionId,
        message: guardedMessage,
        // 【待实现】：消息压缩逻辑调用（超长历史自动压缩）
      });

      // 5. 调用LLM服务（流式）
      const llmResponse = await llmService.completions({
        context,
        signal: this.abortController.signal,
      });

      // 6. 流式处理响应（实时更新UI）
      for await (const chunk of llmResponse) {
        // 【待实现】：流式消息更新逻辑
        // 检测tool call -> 触发工具调用流程
        if (chunk.toolCalls) {
          await this.handleToolCalls(chunk.toolCalls);
        }

        // 执行接收后钩子
        await this.executePostReceiveHooks(chunk);
      }
    } catch (error) {
      // 7. 错误处理（分类提示、解决方案推荐）
      errorService.handleLLMError(error);
    } finally {
      this.abortController = null;
    }
  }

  // 工具调用处理
  private async handleToolCalls(toolCalls: ToolCall[]) {
    // 【待实现】：遍历toolCalls，执行对应工具，更新调用状态，处理调用结果
    // 执行工具调用钩子
    await this.executeToolCallHooks(toolCalls);
    // 调用Mock工具（兜底实现）
    for (const call of toolCalls) {
      const toolResult = await toolService.executeTool(call);
      // 更新工具调用状态到store
      toolStore.updateToolCallStatus(call.id, {
        status: 'success',
        result: toolResult,
      });
    }
  }

  // 中断当前对话
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      // 更新状态为已中断
      chatStore.updateMessageStatus(this.sessionId, 'aborted');
    }
  }

  // 钩子执行逻辑（示例：preSend钩子）
  private async executePreSendHooks(message: UserMessage): Promise<UserMessage> {
    let processedMessage = { ...message };
    for (const hook of this.hooks.preSend) {
      processedMessage = await hook(processedMessage);
    }
    return processedMessage;
  }

  // 【待实现】：其他钩子执行方法（postReceive、toolCall）
}
```

#### 5.1.2 消息压缩逻辑（application/message_compact.ts）

```TypeScript
// 核心能力：自动压缩超长历史消息，不阻塞会话，不影响历史消息展示
export const compactMessages = async (
  sessionId: string,
  maxTokens: number = 2000 // 默认阈值
): Promise<CompactedContext> => {
  // 【待实现】：
  // 1. 获取会话历史消息
  // 2. 计算消息token总数
  // 3. 超过阈值时，对早期消息进行摘要/压缩
  // 4. 返回压缩后的上下文（保留核心信息，标记压缩状态）
  // 5. 不修改原始历史消息，仅在发送给LLM时使用压缩后内容
  return {
    compacted: false,
    messages: [],
  };
};
```

### 5.2 LLM 交互层设计（services/llm_service.ts）

```TypeScript
import { completion } from 'litellm';
import type { LLMConfig, LLMStreamResponse } from '../types/api';
import { configStore } from '../store/config_store';

// 封装litellm调用，统一处理流式响应、错误、中断
export const llmService = {
  async completions({
    context,
    signal,
  }: {
    context: Context;
    signal: AbortSignal;
  }): Promise<AsyncGenerator<LLMStreamResponse>> {
    const config = configStore.getState().llmConfig;

    // 验证配置
    if (!config.apiKey) {
      throw new Error('API Key未配置，请在设置中完成配置');
    }

    try {
      // 调用litellm流式接口
      const response = await completion({
        model: config.provider,
        api_key: config.apiKey,
        messages: context.messages,
        stream: true,
        signal,
      });

      // 转换为统一的流式响应格式
      return this.transformStream(response);
    } catch (error) {
      // 错误分类处理（API key过期、网络错误、模型不支持等）
      throw this.formatLLMError(error);
    }
  },

  // 【待实现】：流式响应转换（统一不同厂商的返回格式）
  private async* transformStream(rawStream: any): AsyncGenerator<LLMStreamResponse> {
    for await (const chunk of rawStream) {
      // 转换逻辑：提取content、tool_calls、finish_reason等
      yield {
        content: chunk.choices[0]?.delta?.content || '',
        toolCalls: chunk.choices[0]?.delta?.tool_calls || [],
        finishReason: chunk.choices[0]?.finish_reason || null,
      };
    }
  },

  // 【待实现】：错误格式化（分类+推荐解决方案）
  private formatLLMError(error: any): Error {
    // 示例：API key过期
    if (error.message.includes('invalid api key') || error.message.includes('expired')) {
      return new Error('API Key无效或已过期，请前往配置页面更新');
    }
    // 其他错误类型...
    return new Error(`LLM调用失败：${error.message}`);
  },
};
```

### 5.3 工具调用层设计（services/tool_service.ts + mocks/tools/）

#### 5.3.1 工具服务核心

```TypeScript
import { weatherTool } from '../mocks/tools/weather_tool';
import { calculatorTool } from '../mocks/tools/calculator_tool';
import { translatorTool } from '../mocks/tools/translator_tool';
import type { ToolCall, ToolResult } from '../types/tool';
import { toolStore } from '../store/tool_store';

// 工具注册表（扩展时仅需新增工具）
const TOOL_REGISTRY = {
  weather: weatherTool,
  calculator: calculatorTool,
  translator: translatorTool,
};

export const toolService = {
  // 执行工具调用
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const { toolName, parameters, id } = toolCall;

    // 更新工具调用状态为"执行中"
    toolStore.updateToolCallStatus(id, {
      status: 'loading',
      parameters,
    });

    try {
      // 查找并执行Mock工具
      const tool = TOOL_REGISTRY[toolName as keyof typeof TOOL_REGISTRY];
      if (!tool) {
        throw new Error(`未找到工具：${toolName}`);
      }

      const result = await tool.execute(parameters);

      // 更新状态为"成功"
      toolStore.updateToolCallStatus(id, {
        status: 'success',
        result,
      });

      return result;
    } catch (error) {
      // 更新状态为"失败"
      toolStore.updateToolCallStatus(id, {
        status: 'failed',
        error: (error as Error).message,
      });
      throw error;
    }
  },
};
```

#### 5.3.2 Mock工具实现示例（mocks/tools/weather_tool.ts）

```TypeScript
import type { Tool, ToolParameters, ToolResult } from '../../types/tool';

// 天气查询工具Mock实现
export const weatherTool: Tool = {
  name: 'weather',
  description: '查询指定城市的天气信息',
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名称' },
      date: { type: 'string', description: '查询日期（YYYY-MM-DD）', optional: true },
    },
    required: ['city'],
  },

  // 执行逻辑（Mock）
  async execute(parameters: ToolParameters): Promise<ToolResult> {
    // 模拟异步调用
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock返回结果
    return {
      content: `【${parameters.city}】${parameters.date || '今日'}天气：晴，气温15-28℃，微风`,
      raw: {
        code: 200,
        data: {
          city: parameters.city,
          date: parameters.date || new Date().toISOString().split('T')[0],
          weather: '晴',
          temp: '15-28℃',
          wind: '微风',
        },
      },
    };
  },
};
```

### 5.4 持久化层设计（persistence/）

#### 5.4.1 基类定义（persistence/base_persistence.ts）

```TypeScript
// 通用持久化接口
export interface Persistence<T> {
  // 增量写入（避免全量覆盖）
  write(key: string, data: Partial<T>): Promise<void>;
  // 分片读取（避免一次性加载大量数据）
  read(key: string, page?: number, pageSize?: number): Promise<T | T[] | null>;
  // 删除
  delete(key: string): Promise<void>;
  // 批量操作（预留）
  batch(operations: Array<{ type: 'write' | 'delete'; key: string; data?: any }>): Promise<void>;
}
```

#### 5.4.2 localStorage实现（persistence/local_storage.ts）

```TypeScript
import { Persistence } from './base_persistence';
import { serializer } from './serializer';

// 轻量配置持久化（localStorage）
export class LocalStoragePersistence<T> implements Persistence<T> {
  async write(key: string, data: Partial<T>): Promise<void> {
    const existingData = await this.read(key);
    const newData = existingData ? { ...existingData, ...data } : data;
    localStorage.setItem(key, serializer.serialize(newData));
  }

  async read(key: string): Promise<T | null> {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return serializer.deserialize<T>(raw);
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  // 分片读取适配（localStorage无分页，直接返回）
  async read(key: string): Promise<T | null> {
    // 实现逻辑同上
  }

  async batch(): Promise<void> {
    // 【待实现】：批量操作逻辑
  }
}
```

### 5.5 状态管理设计（store/chat_store.ts）

```TypeScript
import { create } from 'zustand';
import type { Message, MessageStatus } from '../types/chat';

// 聊天状态Store（仅内存状态，持久化通过persistence层处理）
type ChatState = {
  messages: Record<string, Message[]>; // 会话ID -> 消息列表
  currentInput: string; // 当前输入框内容
  currentSessionId: string | null; // 当前会话ID
  messageStatus: Record<string, MessageStatus>; // 消息ID -> 状态

  // 动作
  addMessage: (sessionId: string, message: Message) => void;
  updateMessageContent: (sessionId: string, messageId: string, content: string) => void;
  setCurrentInput: (input: string) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
};

export const chatStore = create<ChatState>((set) => ({
  messages: {},
  currentInput: '',
  currentSessionId: null,
  messageStatus: {},

  addMessage: (sessionId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [sessionId]: [...(state.messages[sessionId] || []), message],
    },
  })),

  updateMessageContent: (sessionId, messageId, content) => set((state) => ({
    messages: {
      ...state.messages,
      [sessionId]: state.messages[sessionId]?.map(msg =>
        msg.id === messageId ? { ...msg, content } : msg
      ) || [],
    },
  })),

  setCurrentInput: (input) => set({ currentInput: input }),
  setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
  updateMessageStatus: (messageId, status) => set((state) => ({
    messageStatus: { ...state.messageStatus, [messageId]: status },
  })),

  deleteMessage: (sessionId, messageId) => set((state) => ({
    messages: {
      ...state.messages,
      [sessionId]: state.messages[sessionId]?.filter(msg => msg.id !== messageId) || [],
    },
  })),
}));
```

## 6. UI层详细设计

### 6.1 核心页面设计

#### 6.1.1 聊天主页面（pages/chat_page.tsx）

```TypeScript
import { useEffect } from 'react';
import { ChatList } from '../components/chat/chat_list';
import { ChatInput } from '../components/chat/chat_input';
import { SessionList } from '../components/session/session_list';
import { ApiConfigModal } from '../components/config/api_config_modal';
import { configStore } from '../store/config_store';
import { useSessionList } from '../hooks/use_session_list';

// 主聊天页面（左侧会话列表，右侧消息+输入）
export const ChatPage = () => {
  const { hasConfig } = configStore();
  const { loadSessions } = useSessionList();

  // 首次加载：加载会话列表，检测配置
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <div className="flex h-screen">
      {/* 左侧会话列表 */}
      <div className="w-64 border-r p-4">
        <SessionList />
      </div>

      {/* 右侧聊天区域 */}
      <div className="flex-1 flex flex-col">
        {/* 消息列表 */}
        <div className="flex-1 overflow-auto">
          <ChatList />
        </div>

        {/* 输入框 */}
        <div className="border-t p-4">
          <ChatInput />
        </div>
      </div>

      {/* 首次使用弹出API配置Modal */}
      {!hasConfig && <ApiConfigModal open={true} />}
    </div>
  );
};
```

#### 6.1.2 API配置表单（components/config/api_config_form.tsx）

```TypeScript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../common/button';
import type { LLMConfig } from '../../types/config';
import { configStore } from '../../store/config_store';
import { localStoragePersistence } from '../../persistence/local_storage';

// Schema定义（强类型）
const llmConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini']),
  apiKey: z.string().min(1, 'API Key不能为空'),
  systemPrompt: z.string().optional(),
});

// 表单类型
type LLMConfigFormValues = z.infer<typeof llmConfigSchema>;

export const ApiConfigForm = () => {
  // 初始化表单（对接zod Schema）
  const { register, handleSubmit, formState: { errors }, reset } = useForm<LLMConfigFormValues>({
    resolver: zodResolver(llmConfigSchema),
    defaultValues: configStore.getState().llmConfig,
  });

  // 提交处理
  const onSubmit = async (data: LLMConfigFormValues) => {
    // 更新store
    configStore.setState({ llmConfig: data });
    // 持久化存储（增量写入）
    await localStoragePersistence.write('llm_config', data);
    // 关闭Modal（通过父组件回调）
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Provider选择 */}
      <div>
        <label>LLM Provider</label>
        <select {...register('provider')} className="w-full p-2 border rounded">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Google Gemini</option>
        </select>
      </div>

      {/* API Key输入 */}
      <div>
        <label>API Key</label>
        <input
          {...register('apiKey')}
          type="password"
          className="w-full p-2 border rounded"
        />
        {errors.apiKey && <p className="text-red-500 text-sm">{errors.apiKey.message}</p>}
      </div>

      {/* System Prompt输入 */}
      <div>
        <label>System Prompt（可选）</label>
        <textarea
          {...register('systemPrompt')}
          className="w-full p-2 border rounded"
          rows={4}
        />
      </div>

      {/* 按钮组 */}
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="secondary" onClick={() => reset()}>
          重置
        </Button>
        <Button type="submit" variant="primary">
          保存配置
        </Button>
      </div>
    </form>
  );
};
```

### 6.2 核心组件设计

#### 6.2.1 消息渲染组件（components/chat/chat_message.tsx）

```TypeScript
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypePrism from 'rehype-prism';
import { MessageActions } from './message_actions';
import { ToolCallItem } from './tool_call_item';
import type { Message } from '../../types/chat';
import { markdownUtils } from '../../utils/markdown_utils';

// 消息渲染组件（Memo缓存，仅内容变更时重渲染）
const ChatMessageComponent = ({ message }: { message: Message }) => {
  // 区分消息类型：用户/LLM/工具调用
  if (message.role === 'user') {
    return (
      <div className="mb-4 flex gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          U
        </div>
        <div className="flex-1">
          <div className="bg-gray-100 p-3 rounded-lg">
            {message.content}
            {/* 图片附件展示 */}
            {message.attachments?.map(att => (
              <img
                key={att.id}
                src={att.url}
                className="mt-2 max-w-xs rounded"
                loading="lazy" // 懒加载
              />
            ))}
          </div>
          <MessageActions messageId={message.id} />
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    return (
      <div className="mb-4 flex gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center">
          AI
        </div>
        <div className="flex-1">
          <div className="bg-blue-50 p-3 rounded-lg">
            {/* 流式渲染Markdown */}
            <ReactMarkdown
              rehypePlugins={[rehypePrism]}
              components={markdownUtils.getRenderComponents()}
            >
              {message.content}
            </ReactMarkdown>

            {/* 工具调用展示 */}
            {message.toolCalls?.map(call => (
              <ToolCallItem key={call.id} toolCall={call} />
            ))}
          </div>
          <MessageActions messageId={message.id} />
        </div>
      </div>
    );
  }

  // 工具调用消息
  return <ToolCallItem toolCall={message.toolCall!} />;
};

// Memo缓存，仅当message引用变更时重渲染
export const ChatMessage = memo(ChatMessageComponent, (prev, next) => {
  return prev.message.id === next.message.id && prev.message.content === next.message.content;
});
```

#### 6.2.2 虚拟滚动消息列表（components/chat/chat_list.tsx）

```TypeScript
import { useVirtualizer } from '@tanstack/react-virtualizer';
import { useMessageList } from '../../hooks/use_message_list';
import { ChatMessage } from './chat_message';

export const ChatList = () => {
  const { messages, containerRef } = useMessageList();

  // 虚拟滚动配置
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 100, // 预估每条消息高度
    overscan: 5, // 预渲染可视区域外5条
  });

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{
        position: 'relative',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => {
          const message = messages[virtualItem.index];
          return (
            <div
              key={message.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                height: `${virtualItem.size}px`,
              }}
            >
              <ChatMessage message={message} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

## 7. 工程化配置

### 7.1 ESLint配置（.eslintrc.js）

```JavaScript
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier', // 兼容Prettier
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react'],
  rules: {
    'react/prop-types': 'off', // TypeScript替代prop-types
    'react/react-in-jsx-scope': 'off', // React 18无需导入
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'import/prefer-default-export': 'off', // 优先named export
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

### 7.2 Vite配置（vite.config.ts）

```TypeScript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild', // 高效压缩
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // 代码分割：按模块拆分
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand'],
          ui: ['@radix-ui/react-dialog', 'shadcn/ui'],
          llm: ['litellm'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand'], // 预构建核心依赖
  },
});
```

### 7.3 Git Hooks配置（.husky/pre\-commit）

```Bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# 执行TypeScript类型检查
npx tsc --noEmit

# 执行ESLint检查
npx eslint src --ext .ts,.tsx

# 执行Prettier格式化
npx prettier --check src
```

## 8. 性能优化策略

| 优化点         | 实现方式                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| 组件缓存       | React.memo 缓存纯展示组件（如ChatMessage），仅内容变更时重渲染           |
| 回调优化       | useCallback 缓存事件回调（如输入框 onChange），避免子组件不必要重渲染    |
| 计算值缓存     | useMemo 缓存列表计算、虚拟滚动配置等，避免重复计算                       |
| 虚拟滚动       | @tanstack/react\-virtualizer 实现消息列表虚拟滚动，仅渲染可视区域内容    |
| 懒加载         | IntersectionObserver 实现图片懒加载，路由懒加载（React.lazy + Suspense） |
| 状态精细化订阅 | Zustand 支持组件仅订阅所需状态，避免全局状态变更导致无关组件重渲染       |
| 数据分片加载   | 会话列表、历史消息分片读取，异步加载，不阻塞页面渲染                     |
| 增量持久化     | 配置/会话数据增量写入，避免全量覆盖导致的性能损耗                        |
| 代码分割       | Vite 构建时按模块拆分chunk，首屏仅加载核心代码                           |

## 9. 验收标准

### 9.1 基础验收

1. 项目编译通过，无 TypeScript 类型报错

2. ESLint/Prettier 校验通过，无代码规范问题

3. 单元测试（核心模块）通过率 100%

4. 页面加载无白屏、卡顿，核心功能可正常交互

### 9.2 功能验收

1. API 配置：首次进入弹出配置Modal，表单验证有效，配置可持久化

2. 消息交互：支持文本/图片输入，流式响应渲染，消息删除/复制

3. 会话管理：支持会话切换、删除、导出，历史会话可持久化

4. 工具调用：至少3个Mock工具可展示调用状态、入参、结果

5. 异常处理：API Key错误、网络错误等有明确提示及解决方案

6. 交互体验：支持请求中断、输入追加，消息列表滚动流畅

### 9.3 性能验收

1. 消息列表（1000+条）滚动无明显卡顿

2. 页面首次加载时间 \&lt; 2s

3. 组件重渲染次数符合预期（仅必要时重渲染）

4. 持久化读写无阻塞页面渲染的情况

## 10. 总结

### 核心设计要点

1. **分层解耦**：将UI层与业务逻辑层分离，核心逻辑由ChatAgent承载，UI仅负责视图渲染，便于维护和扩展。

2. **性能优先**：通过虚拟滚动、组件缓存、分片加载等手段优化长列表和大量数据场景的体验。

3. **强类型约束**：全流程TypeScript覆盖，Schema优先的表单设计，保障代码健壮性。

4. **工程化规范**：配置Git Hooks、ESLint/Prettier，保障代码质量，降低协作成本。

5. **扩展性设计**：钩子机制、工具注册表、分层持久化等设计，便于后续扩展真实工具、多LLM Provider适配等能力。

### 关键待实现点

1. 消息压缩逻辑：需实现长消息自动压缩，保障LLM调用效率且不影响历史展示。

2. 钩子执行逻辑：需完善钩子的优先级、执行顺序、异常处理，支持自定义拦截逻辑。

3. IndexedDB分片读取：需实现大量会话数据的异步分片加载，优化读取性能。

4. 流式响应转换：需适配不同LLM Provider的流式响应格式，统一输出结构。

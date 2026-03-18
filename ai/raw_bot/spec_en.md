# Chatbot Agent Project Design Plan

## 1. Project Overview

### 1.1 Core Objectives

Develop a web-based Chatbot Agent that supports core capabilities including streaming interaction with large language models (LLMs), tool calling, session management, and configuration persistence, while balancing performance and user experience.

### 1.2 Design Principles

- Prioritize native browser capabilities + open-source libraries to reduce redundant dependencies

- Adopt a layered architecture to decouple core logic from the UI layer

- Enforce strong typing with full TypeScript coverage across the entire workflow

- Performance-first design, optimized via lazy loading, virtual scrolling, and other optimization techniques

- Follow engineering standards to ensure code quality and maintainability

## 2. Technology Stack Selection

| Category             | Technology/Library             | Selection Rationale                                                                                               |
| -------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Core Framework       | React + TypeScript             | Industry-standard frontend framework with strong typing to ensure code robustness                                 |
| UI Component Library | shadcn/ui + Radix UI           | Lightweight, highly customizable, aligned with atomic design principles, no redundant encapsulation               |
| Network Requests     | Native Browser Fetch           | No extra dependencies, complies with the &#34;native first&#34; principle                                         |
| LLM Adaptation       | litellm                        | Unifies API calling patterns for multi-vendor LLMs, avoiding direct integration with individual vendor interfaces |
| State Management     | Zustand                        | Lightweight, no Provider nesting, supports fine-grained state subscription, outperforms Redux in performance      |
| Form Handling        | react-hook-form + zod          | Schema-first approach, strongly typed form validation, fully compatible with TypeScript                           |
| Virtual Scrolling    | @tanstack/react-virtualizer    | High-performance virtual list, optimized for long-list rendering scenarios                                        |
| Markdown Rendering   | react-markdown + rehype-prism  | Supports rich text rendering and syntax highlighting for code blocks                                              |
| Build Tool           | Vite                           | Fast compilation speed, built-in optimization capabilities, tailored for modern frontend engineering              |
| Code Standards       | ESLint + Prettier + Husky      | Ensures consistent code style and automatic pre-commit validation                                                 |
| Persistence Storage  | localStorage + IndexedDB       | Tiered storage: lightweight configurations use localStorage, large session datasets use IndexedDB                 |
| Testing Tools        | Vitest + React Testing Library | Lightweight testing framework, compatible with Vite ecosystem, supports unit testing                              |

## 3. Overall Architecture Design

Adopt a layered decoupled architecture with clear responsibilities for each layer to avoid logical coupling:

```Plaintext
graph TD
    A[User Interaction Layer] --> B[UI Layer]
    B --> C[Application Logic Layer]
    C --> D[Data Layer]
    C --> E[LLM Interaction Layer]
    C --> F[Tool Calling Layer]
    D --> G[Persistence Layer]
    E --> H[Third-Party LLM Provider]
    F --> I[Mock Toolset]
```

### 3.1 Layered Responsibility Description

| Layer                   | Core Responsibilities                                                                                  | Core Files/Modules                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| User Interaction Layer  | Receives text/image input, triggers operations (send/delete/export), responds to keyboard/mouse events | chat_input.tsx, message_actions.tsx                     |
| UI Layer                | Renders pages/components, handles view logic only, contains no business logic                          | chat_page.tsx, chat_list.tsx, session_list.tsx          |
| Application Logic Layer | Message security validation, context assembly, message compression, session lifecycle, intercept hooks | chat_agent.ts, message_guardian.ts, context_builder.ts  |
| Data Layer              | In-memory state management, data format conversion, state subscription/updates                         | store/chat_store.ts, store/session_store.ts             |
| LLM Interaction Layer   | litellm invocation, streaming response handling, API error catching, request abortion                  | services/llm_service.ts                                 |
| Tool Calling Layer      | Tool call parsing, mock tool implementation, call state management, process visualization              | services/tool_service.ts, mocks/tools/                  |
| Persistence Layer       | Incremental writing, sharded reading, data serialization/deserialization                               | persistence/local_storage.ts, persistence/indexed_db.ts |

## 4. Detailed Directory Structure

```Plaintext
chatbot_agent/
├── .husky/                      # Git Hooks Configuration
│   ├── pre-commit               # Run lint/type checks before commit
│   └── pre-push                 # Run build validation before push
├── public/                      # Static assets (favicon, default images, etc.)
├── src/
│   ├── assets/                  # Static resources (styles, images, icons)
│   ├── components/              # UI components (grouped by function, pure view logic)
│   │   ├── chat/                # Core chat components
│   │   │   ├── chat_input.tsx   # Message input box (text + image upload)
│   │   │   ├── chat_message.tsx # Single message rendering component
│   │   │   ├── chat_list.tsx    # Virtual scrolling message list
│   │   │   ├── tool_call_item.tsx # Tool call display item
│   │   │   └── message_actions.tsx # Message delete/copy action buttons
│   │   ├── common/              # Generic base components
│   │   │   ├── button.tsx       # Universal button (encapsulated shadcn button)
│   │   │   ├── modal.tsx        # Universal Modal (based on Radix UI)
│   │   │   ├── lazy_image.tsx   # Lazy-loaded image component
│   │   │   └── virtual_list.tsx # Generic virtual scrolling container
│   │   ├── config/              # Configuration-related components
│   │   │   ├── api_config_form.tsx # API configuration form (Schema-first)
│   │   │   └── prompt_setting.tsx # Custom Prompt configuration component
│   │   └── session/             # Session management components
│   │       ├── session_item.tsx # Single session item component
│   │       └── session_list.tsx # Session list component
│   ├── hooks/                   # View-related Hooks (state/event binding only)
│   │   ├── use_chat_input.ts    # Input box state/event handling Hook
│   │   ├── use_message_list.ts  # Message list rendering Hook (bound to virtual scrolling)
│   │   ├── use_session_list.ts  # Session list loading/operation Hook
│   │   ├── use_lazy_load.ts     # Generic lazy loading Hook (based on IntersectionObserver)
│   │   └── use_stream_render.ts # Streaming message rendering Hook
│   ├── pages/                   # Route pages (component assembly only, no business logic)
│   │   ├── chat_page.tsx        # Main chat page (core page)
│   │   ├── config_page.tsx      # Global configuration page
│   │   └── session_page.tsx     # Session management page
│   ├── application/             # Application logic layer (core business logic)
│   │   ├── chat_agent.ts        # Chatbot core logic (session flow, Loop mechanism)
│   │   ├── session_manager.ts   # Session lifecycle management (create/switch/delete)
│   │   ├── message_guardian.ts  # Message security validation/transcoding (To-Do: keyword filtering, content transcoding)
│   │   ├── context_builder.ts   # Context assembly (system prompt + historical messages)
│   │   ├── message_compact.ts   # Message compression logic (To-Do: auto-compress long messages without blocking sessions)
│   │   └── hooks/               # Conversation intercept hooks
│   │       ├── pre_send_hook.ts # Pre-send intercept hook (To-Do: custom logic entry)
│   │       ├── post_receive_hook.ts # Post-receive intercept hook (To-Do: result processing entry)
│   │       └── tool_call_hook.ts # Tool call intercept hook (To-Do: tool call intervention entry)
│   ├── store/                   # Zustand state management (in-memory state storage only)
│   │   ├── chat_store.ts        # Chat state (current messages, input content, loading status)
│   │   ├── session_store.ts     # Session state (historical sessions, current session ID)
│   │   ├── config_store.ts      # Configuration state (API key, Provider, Prompt)
│   │   └── tool_store.ts        # Tool call state (calling/success/failure, params/results)
│   ├── persistence/             # Persistence module (decouples store from storage medium)
│   │   ├── base_persistence.ts  # Persistence base class (defines universal interfaces)
│   │   ├── local_storage.ts     # localStorage adapter implementation
│   │   ├── indexed_db.ts        # IndexedDB adapter implementation (large dataset storage)
│   │   └── serializer.ts        # Data serialization/deserialization utilities
│   ├── services/                # Service layer (external/core capability integration)
│   │   ├── llm_service.ts       # LLM interaction service (litellm invocation, streaming processing)
│   │   ├── tool_service.ts      # Tool call service (parsing/execution/state updates)
│   │   └── error_service.ts     # Error handling service (error classification, prompt messages)
│   ├── mocks/                   # Mock data/tools (fallback implementation)
│   │   ├── tools/               # Mock tool implementations (minimum 3)
│   │   │   ├── weather_tool.ts  # Weather query tool Mock
│   │   │   ├── calculator_tool.ts # Calculator tool Mock
│   │   │   └── translator_tool.ts # Translator tool Mock
│   │   └── llm_responses.ts     # LLM response Mock (streaming/non-streaming)
│   ├── types/                   # Global type definitions (strong typing constraints)
│   │   ├── chat.ts              # Chat message-related types
│   │   ├── session.ts           # Session-related types
│   │   ├── config.ts            # Configuration-related types
│   │   ├── tool.ts              # Tool call-related types
│   │   └── api.ts               # API interaction-related types
│   ├── utils/                   # Generic utility functions
│   │   ├── fetch_utils.ts       # Fetch encapsulation (interception, error handling)
│   │   ├── markdown_utils.ts    # Markdown processing (rendering config, special syntax)
│   │   ├── performance_utils.ts # Performance optimization tools (debounce, throttle, caching)
│   │   └── validation_utils.ts  # Data validation utilities (integrated with zod)
│   ├── routes/                  # Route configuration
│   │   ├── router.tsx           # Route definition (React Router v6)
│   │   └── routes.ts            # Route constants (paths, names)
│   ├── App.tsx                  # Root component (route outlet, global styles)
│   ├── main.tsx                 # Entry file (React rendering, global initialization)
│   └── vite-env.d.ts            # Vite type declarations
├── .eslintrc.js                 # ESLint configuration (TypeScript+React rules)
├── .prettierrc.js               # Prettier configuration (code formatting rules)
├── tsconfig.json                # TypeScript configuration (compiler options, type resolution)
├── vite.config.ts               # Vite configuration (build, optimization, aliases)
├── package.json                 # Dependency configuration (core + dev dependencies)
└── README.md                    # Project documentation (startup, build, directory guide)
```

## 5. Core Module Detailed Design

### 5.1 Core Application Logic Layer Design

#### 5.1.1 ChatAgent Core Logic (application/chat_agent.ts)

```TypeScript
// Core Capabilities: Session Loop mechanism, hook execution, message flow
export class ChatAgent {
  private sessionId: string;
  private abortController: AbortController | null = null; // Used for request abortion
  private hooks = {
    preSend: [] as PreSendHook[], // Pre-send hooks
    postReceive: [] as PostReceiveHook[], // Post-receive hooks
    toolCall: [] as ToolCallHook[], // Tool call hooks
  };

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  // Register hooks
  registerHook(type: HookType, hook: Function) {
    // Implementation: Add hooks to the corresponding array, deduplicate
    // 【To-Do】: Hook priority management, execution order control
  }

  // Core Loop: Process user message -> Security validation -> Context assembly -> LLM call -> Tool call -> Result return
  async handleUserMessage(message: UserMessage): Promise<void> {
    // 1. Abort existing request (if exists)
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      // 2. Execute pre-send hooks
      const processedMessage = await this.executePreSendHooks(message);

      // 3. Message security validation
      const guardedMessage = await messageGuardian.validateAndTransform(processedMessage);

      // 4. Context assembly (system prompt + historical messages + current message)
      const context = await contextBuilder.buildContext({
        sessionId: this.sessionId,
        message: guardedMessage,
        // 【To-Do】: Invoke message compression logic (auto-compress long history)
      });

      // 5. Call LLM service (streaming)
      const llmResponse = await llmService.completions({
        context,
        signal: this.abortController.signal,
      });

      // 6. Stream response processing (real-time UI updates)
      for await (const chunk of llmResponse) {
        // 【To-Do】: Streaming message update logic
        // Detect tool call -> trigger tool call workflow
        if (chunk.toolCalls) {
          await this.handleToolCalls(chunk.toolCalls);
        }

        // Execute post-receive hooks
        await this.executePostReceiveHooks(chunk);
      }
    } catch (error) {
      // 7. Error handling (classified prompts, solution recommendations)
      errorService.handleLLMError(error);
    } finally {
      this.abortController = null;
    }
  }

  // Tool call processing
  private async handleToolCalls(toolCalls: ToolCall[]) {
    // 【To-Do】: Iterate toolCalls, execute corresponding tools, update call status, process results
    // Execute tool call hooks
    await this.executeToolCallHooks(toolCalls);
    // Invoke Mock tools (fallback implementation)
    for (const call of toolCalls) {
      const toolResult = await toolService.executeTool(call);
      // Update tool call status to store
      toolStore.updateToolCallStatus(call.id, {
        status: 'success',
        result: toolResult,
      });
    }
  }

  // Abort current conversation
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      // Update status to aborted
      chatStore.updateMessageStatus(this.sessionId, 'aborted');
    }
  }

  // Hook execution logic (example: preSend hook)
  private async executePreSendHooks(message: UserMessage): Promise<UserMessage> {
    let processedMessage = { ...message };
    for (const hook of this.hooks.preSend) {
      processedMessage = await hook(processedMessage);
    }
    return processedMessage;
  }

  // 【To-Do】: Other hook execution methods (postReceive, toolCall)
}
```

#### 5.1.2 Message Compression Logic (application/message_compact.ts)

```TypeScript
// Core Capabilities: Auto-compress ultra-long historical messages without blocking sessions or affecting message display
export const compactMessages = async (
  sessionId: string,
  maxTokens: number = 2000 // Default threshold
): Promise<CompactedContext> => {
  // 【To-Do】:
  // 1. Fetch session historical messages
  // 2. Calculate total message token count
  // 3. Summarize/compress early messages when threshold is exceeded
  // 4. Return compressed context (retain core info, mark compression status)
  // 5. Do not modify original historical messages; use compressed content only for LLM requests
  return {
    compacted: false,
    messages: [],
  };
};
```

### 5.2 LLM Interaction Layer Design (services/llm_service.ts)

```TypeScript
import { completion } from 'litellm';
import type { LLMConfig, LLMStreamResponse } from '../types/api';
import { configStore } from '../store/config_store';

// Encapsulate litellm calls, unify streaming response handling, errors, and abortion
export const llmService = {
  async completions({
    context,
    signal,
  }: {
    context: Context;
    signal: AbortSignal;
  }): Promise<AsyncGenerator<LLMStreamResponse>> {
    const config = configStore.getState().llmConfig;

    // Validate configuration
    if (!config.apiKey) {
      throw new Error('API Key not configured. Please complete setup in settings.');
    }

    try {
      // Call litellm streaming interface
      const response = await completion({
        model: config.provider,
        api_key: config.apiKey,
        messages: context.messages,
        stream: true,
        signal,
      });

      // Convert to unified streaming response format
      return this.transformStream(response);
    } catch (error) {
      // Classified error handling (API key expiration, network errors, model unsupported, etc.)
      throw this.formatLLMError(error);
    }
  },

  // 【To-Do】: Streaming response transformation (unify return formats across vendors)
  private async* transformStream(rawStream: any): AsyncGenerator<LLMStreamResponse> {
    for await (const chunk of rawStream) {
      // Transformation logic: extract content, tool_calls, finish_reason, etc.
      yield {
        content: chunk.choices[0]?.delta?.content || '',
        toolCalls: chunk.choices[0]?.delta?.tool_calls || [],
        finishReason: chunk.choices[0]?.finish_reason || null,
      };
    }
  },

  // 【To-Do】: Error formatting (classification + recommended solutions)
  private formatLLMError(error: any): Error {
    // Example: API key expiration
    if (error.message.includes('invalid api key') || error.message.includes('expired')) {
      return new Error('API Key is invalid or expired. Please update it in the configuration page.');
    }
    // Other error types...
    return new Error(`LLM call failed: ${error.message}`);
  },
};
```

### 5.3 Tool Calling Layer Design (services/tool_service.ts + mocks/tools/)

#### 5.3.1 Core Tool Service

```TypeScript
import { weatherTool } from '../mocks/tools/weather_tool';
import { calculatorTool } from '../mocks/tools/calculator_tool';
import { translatorTool } from '../mocks/tools/translator_tool';
import type { ToolCall, ToolResult } from '../types/tool';
import { toolStore } from '../store/tool_store';

// Tool registry (extend by adding new tools only)
const TOOL_REGISTRY = {
  weather: weatherTool,
  calculator: calculatorTool,
  translator: translatorTool,
};

export const toolService = {
  // Execute tool call
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const { toolName, parameters, id } = toolCall;

    // Update tool call status to "loading"
    toolStore.updateToolCallStatus(id, {
      status: 'loading',
      parameters,
    });

    try {
      // Find and execute Mock tool
      const tool = TOOL_REGISTRY[toolName as keyof typeof TOOL_REGISTRY];
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      const result = await tool.execute(parameters);

      // Update status to "success"
      toolStore.updateToolCallStatus(id, {
        status: 'success',
        result,
      });

      return result;
    } catch (error) {
      // Update status to "failed"
      toolStore.updateToolCallStatus(id, {
        status: 'failed',
        error: (error as Error).message,
      });
      throw error;
    }
  },
};
```

#### 5.3.2 Mock Tool Implementation Example (mocks/tools/weather_tool.ts)

```TypeScript
import type { Tool, ToolParameters, ToolResult } from '../../types/tool';

// Weather query tool Mock implementation
export const weatherTool: Tool = {
  name: 'weather',
  description: 'Query weather information for a specified city',
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' },
      date: { type: 'string', description: 'Query date (YYYY-MM-DD)', optional: true },
    },
    required: ['city'],
  },

  // Execution logic (Mock)
  async execute(parameters: ToolParameters): Promise<ToolResult> {
    // Simulate async call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock return result
    return {
      content: `【${parameters.city}】${parameters.date || 'Today'} Weather: Sunny, Temperature 15-28℃, Gentle Breeze`,
      raw: {
        code: 200,
        data: {
          city: parameters.city,
          date: parameters.date || new Date().toISOString().split('T')[0],
          weather: 'Sunny',
          temp: '15-28℃',
          wind: 'Gentle Breeze',
        },
      },
    };
  },
};
```

### 5.4 Persistence Layer Design (persistence/)

#### 5.4.1 Base Class Definition (persistence/base_persistence.ts)

```TypeScript
// Universal persistence interface
export interface Persistence<T> {
  // Incremental write (avoid full overwrites)
  write(key: string, data: Partial<T>): Promise<void>;
  // Sharded read (avoid loading large datasets at once)
  read(key: string, page?: number, pageSize?: number): Promise<T | T[] | null>;
  // Delete
  delete(key: string): Promise<void>;
  // Batch operations (reserved)
  batch(operations: Array<{ type: 'write' | 'delete'; key: string; data?: any }>): Promise<void>;
}
```

#### 5.4.2 localStorage Implementation (persistence/local_storage.ts)

```TypeScript
import { Persistence } from './base_persistence';
import { serializer } from './serializer';

// Lightweight configuration persistence (localStorage)
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

  // Sharded read adaptation (no pagination for localStorage, return directly)
  async read(key: string): Promise<T | null> {
    // Same implementation as above
  }

  async batch(): Promise<void> {
    // 【To-Do】: Batch operation logic
  }
}
```

### 5.5 State Management Design (store/chat_store.ts)

```TypeScript
import { create } from 'zustand';
import type { Message, MessageStatus } from '../types/chat';

// Chat state Store (in-memory state only, persistence handled by persistence layer)
type ChatState = {
  messages: Record<string, Message[]>; // Session ID -> Message list
  currentInput: string; // Current input box content
  currentSessionId: string | null; // Current session ID
  messageStatus: Record<string, MessageStatus>; // Message ID -> Status

  // Actions
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

## 6. UI Layer Detailed Design

### 6.1 Core Page Design

#### 6.1.1 Main Chat Page (pages/chat_page.tsx)

```TypeScript
import { useEffect } from 'react';
import { ChatList } from '../components/chat/chat_list';
import { ChatInput } from '../components/chat/chat_input';
import { SessionList } from '../components/session/session_list';
import { ApiConfigModal } from '../components/config/api_config_modal';
import { configStore } from '../store/config_store';
import { useSessionList } from '../hooks/use_session_list';

// Main chat page (session list on left, messages + input on right)
export const ChatPage = () => {
  const { hasConfig } = configStore();
  const { loadSessions } = useSessionList();

  // Initial load: fetch session list, validate configuration
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <div className="flex h-screen">
      {/* Left session list */}
      <div className="w-64 border-r p-4">
        <SessionList />
      </div>

      {/* Right chat area */}
      <div className="flex-1 flex flex-col">
        {/* Message list */}
        <div className="flex-1 overflow-auto">
          <ChatList />
        </div>

        {/* Input box */}
        <div className="border-t p-4">
          <ChatInput />
        </div>
      </div>

      {/* Pop API config Modal for first-time use */}
      {!hasConfig && <ApiConfigModal open={true} />}
    </div>
  );
};
```

#### 6.1.2 API Configuration Form (components/config/api_config_form.tsx)

```TypeScript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../common/button';
import type { LLMConfig } from '../../types/config';
import { configStore } from '../../store/config_store';
import { localStoragePersistence } from '../../persistence/local_storage';

// Schema definition (strong typing)
const llmConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini']),
  apiKey: z.string().min(1, 'API Key cannot be empty'),
  systemPrompt: z.string().optional(),
});

// Form type
type LLMConfigFormValues = z.infer<typeof llmConfigSchema>;

export const ApiConfigForm = () => {
  // Initialize form (integrated with zod Schema)
  const { register, handleSubmit, formState: { errors }, reset } = useForm<LLMConfigFormValues>({
    resolver: zodResolver(llmConfigSchema),
    defaultValues: configStore.getState().llmConfig,
  });

  // Submit handler
  const onSubmit = async (data: LLMConfigFormValues) => {
    // Update store
    configStore.setState({ llmConfig: data });
    // Persist storage (incremental write)
    await localStoragePersistence.write('llm_config', data);
    // Close Modal (via parent component callback)
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Provider selection */}
      <div>
        <label>LLM Provider</label>
        <select {...register('provider')} className="w-full p-2 border rounded">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Google Gemini</option>
        </select>
      </div>

      {/* API Key input */}
      <div>
        <label>API Key</label>
        <input
          {...register('apiKey')}
          type="password"
          className="w-full p-2 border rounded"
        />
        {errors.apiKey && <p className="text-red-500 text-sm">{errors.apiKey.message}</p>}
      </div>

      {/* System Prompt input */}
      <div>
        <label>System Prompt (Optional)</label>
        <textarea
          {...register('systemPrompt')}
          className="w-full p-2 border rounded"
          rows={4}
        ></textarea>
      </div>

      {/* Button group */}
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="secondary" onClick={() => reset()}>
          Reset
        </Button>
        <Button type="submit" variant="primary">
          Save Configuration
        </Button>
      </div>
    </form>
  );
};
```

### 6.2 Core Component Design

#### 6.2.1 Message Rendering Component (components/chat/chat_message.tsx)

```TypeScript
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypePrism from 'rehype-prism';
import { MessageActions } from './message_actions';
import { ToolCallItem } from './tool_call_item';
import type { Message } from '../../types/chat';
import { markdownUtils } from '../../utils/markdown_utils';

// Message rendering component (Memo cached, re-renders only on content changes)
const ChatMessageComponent = ({ message }: { message: Message }) => {
  // Distinguish message types: user/LLM/tool call
  if (message.role === 'user') {
    return (
      <div className="mb-4 flex gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          U
        </div>
        <div className="flex-1">
          <div className="bg-gray-100 p-3 rounded-lg">
            {message.content}
            {/* Image attachment display */}
            {message.attachments?.map(att => (
              <img
                key={att.id}
                src={att.url}
                className="mt-2 max-w-xs rounded"
                loading="lazy" // Lazy loading
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
            {/* Streaming Markdown rendering */}
            <ReactMarkdown
              rehypePlugins={[rehypePrism]}
              components={markdownUtils.getRenderComponents()}
            >
              {message.content}
            </ReactMarkdown>

            {/* Tool call display */}
            {message.toolCalls?.map(call => (
              <ToolCallItem key={call.id} toolCall={call} />
            ))}
          </div>
          <MessageActions messageId={message.id} />
        </div>
      </div>
    );
  }

  // Tool call message
  return <ToolCallItem toolCall={message.toolCall!} />;
};

// Memo cache, re-renders only when message reference changes
export const ChatMessage = memo(ChatMessageComponent, (prev, next) => {
  return prev.message.id === next.message.id && prev.message.content === next.message.content;
});
```

#### 6.2.2 Virtual Scrolling Message List (components/chat/chat_list.tsx)

```TypeScript
import { useVirtualizer } from '@tanstack/react-virtualizer';
import { useMessageList } from '../../hooks/use_message_list';
import { ChatMessage } from './chat_message';

export const ChatList = () => {
  const { messages, containerRef } = useMessageList();

  // Virtual scrolling configuration
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 100, // Estimated height per message
    overscan: 5, // Pre-render 5 items outside viewport
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

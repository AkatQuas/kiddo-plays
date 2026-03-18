import { create } from 'zustand';
import type { Message, MessageStatus } from '../types/chat';

type ChatState = {
  messages: Record<string, Message[]>;
  currentInput: string;
  currentSessionId: string | null;
  messageStatus: Record<string, MessageStatus>;
  isStreaming: boolean;
  abortController: AbortController | null;

  // Actions
  addMessage: (sessionId: string, message: Message) => void;
  updateMessageContent: (
    sessionId: string,
    messageId: string,
    content: string
  ) => void;
  setCurrentInput: (input: string) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  clearMessages: (sessionId: string) => void;
  appendToMessage: (
    sessionId: string,
    messageId: string,
    content: string
  ) => void;
};

export const chatStore = create<ChatState>((set) => ({
  messages: {},
  currentInput: '',
  currentSessionId: null,
  messageStatus: {},
  isStreaming: false,
  abortController: null,

  addMessage: (sessionId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), message]
      }
    })),

  updateMessageContent: (sessionId, messageId, content) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]:
          state.messages[sessionId]?.map((msg) =>
            msg.id === messageId ? { ...msg, content } : msg
          ) || []
      }
    })),

  appendToMessage: (sessionId, messageId, content) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]:
          state.messages[sessionId]?.map((msg) =>
            msg.id === messageId
              ? { ...msg, content: msg.content + content }
              : msg
          ) || []
      }
    })),

  setCurrentInput: (input) => set({ currentInput: input }),
  setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
  updateMessageStatus: (messageId, status) =>
    set((state) => ({
      messageStatus: { ...state.messageStatus, [messageId]: status }
    })),

  deleteMessage: (sessionId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]:
          state.messages[sessionId]?.filter((msg) => msg.id !== messageId) || []
      }
    })),

  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setAbortController: (controller) => set({ abortController: controller }),
  clearMessages: (sessionId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: []
      }
    }))
}));

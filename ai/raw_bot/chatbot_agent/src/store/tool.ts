import { create } from 'zustand';
import type { ToolCall, ToolCallStatus } from '../types/tool';

type ToolState = {
  toolCalls: Record<string, ToolCall>; // toolCallId -> ToolCall
  activeToolCalls: string[]; // IDs of currently active tool calls

  // Actions
  addToolCall: (toolCall: ToolCall) => void;
  updateToolCallStatus: (
    toolCallId: string,
    status: ToolCallStatus,
    error?: string,
    result?: any
  ) => void;
  removeToolCall: (toolCallId: string) => void;
  clearToolCalls: () => void;
};

export const toolStore = create<ToolState>((set) => ({
  toolCalls: {},
  activeToolCalls: [],

  addToolCall: (toolCall) =>
    set((state) => ({
      toolCalls: { ...state.toolCalls, [toolCall.id]: toolCall },
      activeToolCalls:
        toolCall.status === 'loading'
          ? [...state.activeToolCalls, toolCall.id]
          : state.activeToolCalls
    })),

  updateToolCallStatus: (toolCallId, status, error, result) =>
    set((state) => {
      const toolCall = state.toolCalls[toolCallId];
      if (!toolCall) return state;

      const updatedToolCall = {
        ...toolCall,
        status,
        ...(error && { error }),
        ...(result && { result })
      };

      return {
        toolCalls: { ...state.toolCalls, [toolCallId]: updatedToolCall },
        activeToolCalls:
          status === 'loading'
            ? [...state.activeToolCalls, toolCallId]
            : state.activeToolCalls.filter((id) => id !== toolCallId)
      };
    }),

  removeToolCall: (toolCallId) =>
    set((state) => ({
      toolCalls: Object.fromEntries(
        Object.entries(state.toolCalls).filter(([id]) => id !== toolCallId)
      ),
      activeToolCalls: state.activeToolCalls.filter((id) => id !== toolCallId)
    })),

  clearToolCalls: () =>
    set({
      toolCalls: {},
      activeToolCalls: []
    })
}));

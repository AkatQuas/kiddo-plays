import type { z } from 'zod';

// ─── Task Types ────────────────────────────────────────────

export interface Task {
  id: string;
  description: string;
  requiredTools: string[];
  isParallel: boolean;
  dependsOn: string[];
  acceptanceCriteria: string;
}

export interface TaskList {
  tasks: Task[];
  planningRationale: string;
}

// ─── Execution Types ───────────────────────────────────────

export interface TaskResult {
  taskId: string;
  taskDescription: string;
  rawOutput: string;
  success: boolean;
  error?: string;
}

// ─── Review Types ──────────────────────────────────────────

export interface ReviewedItem {
  taskId: string;
  taskDescription: string;
  rawOutput: string;
  passed: boolean;
  rejectionReason?: string;
  correctionRequirements?: string;
}

export interface ReviewOutput {
  reviewedItems: ReviewedItem[];
  summary: string;
}

// ─── Report Types ──────────────────────────────────────────

export interface StructuredDetail {
  taskId: string;
  taskDescription: string;
  output: string;
}

export interface ExecutionSummary {
  totalTasks: number;
  passedTasks: number;
  retriedTasks: number;
  totalDurationMs: number;
}

export interface FinalReport {
  naturalLanguageSummary: string;
  structuredDetails: StructuredDetail[];
  executionSummary: ExecutionSummary;
}

// ─── Trace Log Types ───────────────────────────────────────

export type TraceStatus = 'normal' | 'retry' | 'error';

export interface TraceLog {
  traceId: string;
  stepName: string;
  role: string;
  timestamp: string;
  durationMs: number;
  inputSummary: string;
  outputSummary: string;
  status: TraceStatus;
  error?: string;
  retryCount?: number;
}

// ─── Agent Role Enum ───────────────────────────────────────

export type AgentRole = 'planner' | 'worker' | 'reviewer' | 'reporter';

// ─── Global Config ─────────────────────────────────────────

export interface TeamConfig {
  maxRetries: number;
  maxParallelWorkers: number;
}

export const DEFAULT_CONFIG: TeamConfig = {
  maxRetries: 2,
  maxParallelWorkers: 5,
};

// ─── Orchestrator States ───────────────────────────────────

export type OrchestratorState =
  | 'initialized'
  | 'planning'
  | 'executing'
  | 'reviewing'
  | 'retrying'
  | 'reporting'
  | 'completed'
  | 'failed';

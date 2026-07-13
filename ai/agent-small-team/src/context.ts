import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { TraceLog, TraceStatus, TeamConfig, AgentRole } from './types.js';

/**
 * Global shared context accessible by all agents (read-only for agents, managed by orchestrator).
 */
export class GlobalContext {
  readonly traceId: string;
  readonly userInput: string;
  readonly config: TeamConfig;
  readonly traceLogs: TraceLog[] = [];
  /** Full raw outputs per step (for file dump) */
  readonly rawOutputLogs: Array<{ stepName: string; role: string; content: string }> = [];
  state: string = 'initialized';
  startTime: number = Date.now();

  constructor(userInput: string, config: TeamConfig) {
    this.traceId = randomUUID().slice(0, 8);
    this.userInput = userInput;
    this.config = config;
  }

  addTraceLog(log: Omit<TraceLog, 'timestamp' | 'traceId'>) {
    this.traceLogs.push({
      ...log,
      traceId: this.traceId,
      timestamp: new Date().toISOString(),
    });
  }

  /** Log full raw output for file dump (not truncated). */
  addRawOutput(stepName: string, role: string, content: string) {
    this.rawOutputLogs.push({ stepName, role, content });
  }

  getTraceLogs(): TraceLog[] {
    return [...this.traceLogs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  elapsedMs(): number {
    return Date.now() - this.startTime;
  }

  /** Write full trace + raw logs to a file. */
  async saveToFile(outputDir?: string): Promise<string> {
    const dir = outputDir || process.cwd();
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `trace-${this.traceId}.log`);

    const lines: string[] = [];
    lines.push('='.repeat(70));
    lines.push(`AGENT SMALL TEAM — TRACE LOG`);
    lines.push(`Trace ID: ${this.traceId}`);
    lines.push(`User Input: ${this.userInput}`);
    lines.push(`Total Duration: ${this.elapsedMs()}ms`);
    lines.push(`Final State: ${this.state}`);
    lines.push('='.repeat(70));
    lines.push('');

    for (const log of this.getTraceLogs()) {
      const elapsed = new Date(log.timestamp).getTime() - new Date(this.traceLogs[0]?.timestamp || Date.now()).getTime();
      lines.push(`--- [+${(elapsed / 1000).toFixed(1)}s] ${log.stepName} ---`);
      lines.push(`  Role:       ${log.role}`);
      lines.push(`  Status:     ${log.status}`);
      lines.push(`  Duration:   ${log.durationMs}ms`);
      lines.push(`  Input:      ${log.inputSummary}`);
      lines.push(`  Output:     ${log.outputSummary}`);
      if (log.error) lines.push(`  Error:      ${log.error}`);
      if (log.retryCount != null) lines.push(`  Retry:      #${log.retryCount}`);
      lines.push('');

      // Append full raw output for this step if available
      const raw = this.rawOutputLogs.filter(r => r.stepName === log.stepName && r.role === log.role);
      for (const r of raw) {
        lines.push(`  [Full Raw Output]:`);
        lines.push(r.content);
        lines.push('');
      }
    }

    lines.push('='.repeat(70));
    lines.push('END OF TRACE');

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
    return filePath;
  }
}

/**
 * Role-specific private context passed to each agent instance.
 */
export interface RoleContext {
  role: AgentRole;
  /** Planner: the raw user input */
  userInput?: string;
  /** Worker: the task assigned to this worker */
  task?: {
    taskId: string;
    description: string;
    requiredTools: string[];
    acceptanceCriteria: string;
    previousResult?: string;
    rejectionReason?: string;
    retryCount?: number;
  };
  /** Reviewer: all results to review */
  resultsToReview?: Array<{
    taskId: string;
    taskDescription: string;
    acceptanceCriteria: string;
    rawOutput: string;
  }>;
  /** Reporter: all passed results */
  passedResults?: Array<{
    taskId: string;
    taskDescription: string;
    output: string;
  }>;
  executionSummary?: {
    totalTasks: number;
    passedTasks: number;
    retriedTasks: number;
    totalDurationMs: number;
  };
  /** Shared global context reference (agents only read this) */
  global: GlobalContext;
}

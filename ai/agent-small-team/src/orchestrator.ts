import { run } from '@openai/agents';
import { plannerAgent } from './agents/planner.js';
import { reporterAgent } from './agents/reporter.js';
import { reviewerAgent } from './agents/reviewer.js';
import { createWorkerAgent } from './agents/worker.js';
import { GlobalContext, type RoleContext } from './context.js';
import type {
  FinalReport,
  OrchestratorState,
  ReviewOutput,
  ReviewedItem,
  Task,
  TaskList,
  TaskResult,
  TeamConfig,
} from './types.js';

export class TeamOrchestrator {
  private global: GlobalContext;
  private config: TeamConfig;
  private state: OrchestratorState = 'initialized';
  private taskList: TaskList | null = null;
  private taskResults: Map<string, TaskResult> = new Map();
  private retryCounts: Map<string, number> = new Map();

  constructor(userInput: string, config: TeamConfig) {
    this.config = config;
    this.global = new GlobalContext(userInput, config);
  }

  /**
   * Run the full team workflow.
   */
  async run(): Promise<{ report: FinalReport | null; traceLogs: any[] }> {
    try {
      this.state = 'planning';
      const taskList = await this.runPlanner();
      this.taskList = taskList;

      this.state = 'executing';
      await this.executeAndReviewLoop();

      this.state = 'reporting';
      const report = await this.runReporter();

      this.state = 'completed';
      return { report, traceLogs: this.global.getTraceLogs() };
    } catch (err: any) {
      this.state = 'failed';
      this.global.addTraceLog({
        stepName: 'orchestrator',
        role: 'orchestrator',
        durationMs: this.global.elapsedMs(),
        inputSummary: 'full workflow',
        outputSummary: 'FAILED',
        status: 'error',
        error: err.message || String(err),
      });
      return { report: null, traceLogs: this.global.getTraceLogs() };
    }
  }

  // ─── Phase 1: Planner ─────────────────────────────────

  private async runPlanner(): Promise<TaskList> {
    const start = Date.now();

    const roleCtx: RoleContext = {
      role: 'planner',
      userInput: this.global.userInput,
      global: this.global,
    };

    const result = await run(plannerAgent, 'Plan this task', {
      context: roleCtx,
    });

    const taskList = result.finalOutput as any as TaskList;

    this.global.addRawOutput(
      'planning',
      'planner',
      JSON.stringify(taskList, null, 2)
    );

    const duration = Date.now() - start;
    this.global.addTraceLog({
      stepName: 'planning',
      role: 'planner',
      durationMs: duration,
      inputSummary: truncate(this.global.userInput, 200),
      outputSummary: `Planned ${taskList.tasks.length} tasks: ${taskList.tasks.map((t) => t.id).join(', ')}`,
      status: 'normal',
    });

    return taskList;
  }

  // ─── Phases 2-4: Execute → Review → Retry Loop ────────

  private async executeAndReviewLoop(): Promise<void> {
    if (!this.taskList) throw new Error('No task list from planner');

    const allTasks = this.taskList.tasks;
    let allPassed = false;

    // First execution: run all tasks
    await this.executeTasks(allTasks);

    while (!allPassed) {
      // Review
      const review = await this.runReviewer();

      const failedItems = review.reviewedItems.filter((i) => !i.passed);

      if (failedItems.length === 0) {
        allPassed = true;
        break;
      }

      // Check retry limits
      const retryableFailed: ReviewedItem[] = [];
      const permanentFailed: ReviewedItem[] = [];

      for (const item of failedItems) {
        const currentRetries = this.retryCounts.get(item.taskId) ?? 0;
        if (currentRetries >= this.config.maxRetries) {
          permanentFailed.push(item);
        } else {
          retryableFailed.push(item);
        }
      }

      if (permanentFailed.length > 0) {
        const failedIds = permanentFailed.map((f) => f.taskId).join(', ');
        throw new Error(
          `Tasks exceeded max retries (${this.config.maxRetries}): ${failedIds}. Reasons: ${permanentFailed.map((f) => f.rejectionReason).join('; ')}`
        );
      }

      if (retryableFailed.length === 0) {
        allPassed = true;
        break;
      }

      // Retry
      this.state = 'retrying';

      const retryTasks = retryableFailed.map((f) => {
        const originalTask = allTasks.find((t) => t.id === f.taskId);
        return {
          ...originalTask!,
          previousResult: f.rawOutput,
          rejectionReason: f.rejectionReason ?? 'No reason provided',
          retryCount: (this.retryCounts.get(f.taskId) ?? 0) + 1,
        };
      });

      await this.executeTasks(retryTasks);
    }
  }

  /**
   * Execute a set of tasks (initial or retry batch).
   * Handles parallelism for tasks marked isParallel.
   */
  private async executeTasks(
    tasks: (Task & {
      previousResult?: string;
      rejectionReason?: string;
      retryCount?: number;
    })[]
  ): Promise<void> {
    const start = Date.now();

    const { serialTasks, parallelTasks } = this.partitionTasks(tasks);

    // Execute parallel tasks concurrently
    if (parallelTasks.length > 0) {
      const workerPromises = parallelTasks.map((task) =>
        this.executeSingleTask(task)
      );
      await Promise.all(workerPromises);
    }

    // Execute serial tasks sequentially
    for (const task of serialTasks) {
      await this.executeSingleTask(task);
    }

    const duration = Date.now() - start;
    this.global.addTraceLog({
      stepName: 'batch_execution',
      role: 'orchestrator',
      durationMs: duration,
      inputSummary: `Executing ${tasks.length} tasks (${parallelTasks.length} parallel, ${serialTasks.length} serial)`,
      outputSummary: `Completed ${tasks.length} task executions`,
      status: 'normal',
    });
  }

  /**
   * Execute a single worker task, passing predecessor results into the worker context.
   */
  private async executeSingleTask(
    task: Task & {
      previousResult?: string;
      rejectionReason?: string;
      retryCount?: number;
    }
  ): Promise<void> {
    const start = Date.now();
    const isRetry = !!task.previousResult;
    const retryCount =
      task.retryCount ?? (isRetry ? (this.retryCounts.get(task.id) ?? 0) : 0);

    if (isRetry) {
      this.retryCounts.set(task.id, retryCount);
    }

    // Gather predecessor results — tasks this task depends on
    const predecessorResults: Array<{ taskId: string; output: string }> = [];
    if (task.dependsOn && task.dependsOn.length > 0) {
      for (const depId of task.dependsOn) {
        const depResult = this.taskResults.get(depId);
        if (depResult) {
          predecessorResults.push({
            taskId: depId,
            output: depResult.rawOutput,
          });
        }
      }
    }

    const worker = createWorkerAgent({
      taskId: task.id,
      description: task.description,
      requiredTools: task.requiredTools,
      acceptanceCriteria: task.acceptanceCriteria,
      previousResult: task.previousResult,
      rejectionReason: task.rejectionReason,
      retryCount,
      predecessorResults,
    });

    const roleCtx: RoleContext = {
      role: 'worker',
      global: this.global,
    };

    try {
      const result = await run(worker, `Execute task ${task.id}`, {
        context: roleCtx,
      });

      const textOutput = (result.finalOutput as string) || '';

      // Capture raw tool outputs from result items as source of truth
      const rawToolOutputs: string[] = [];
      for (const item of result.newItems) {
        if ('type' in item && (item as any).type === 'tool_call_output_item') {
          const toolItem = item as any;
          const toolName = toolItem.rawItem?.name || toolItem.agent?.name || 'unknown';
          const toolOutput = typeof toolItem.output === 'string' ? toolItem.output : JSON.stringify(toolItem.output);
          if (toolOutput) {
            rawToolOutputs.push(`[Tool: ${toolName}]\n${toolOutput}`);
          }
        }
      }

      // Combined raw data: tool outputs + summary as one source of truth
      const fullRawData = rawToolOutputs.length > 0
        ? `=== RAW TOOL OUTPUTS ===\n${rawToolOutputs.join('\n\n')}\n\n=== WORKER SUMMARY ===\n${textOutput}`
        : textOutput;

      const output: TaskResult = {
        taskId: task.id,
        taskDescription: task.description,
        rawOutput: fullRawData,
        success: !textOutput.toLowerCase().includes('success: false'),
        error: textOutput.includes('Error:') || textOutput.includes('failed') ? textOutput.slice(0, 500) : undefined,
      };
      this.taskResults.set(task.id, output);

      this.global.addRawOutput(
        isRetry ? 'task_execution_retry' : 'task_execution',
        `worker-${task.id}`,
        fullRawData
      );

      const duration = Date.now() - start;
      this.global.addTraceLog({
        stepName: isRetry ? `task_execution_retry` : `task_execution`,
        role: `worker-${task.id}`,
        durationMs: duration,
        inputSummary: `Task: ${task.id} - ${truncate(task.description, 200)}`,
        outputSummary: `Success: ${output.success} | ${truncate(output.rawOutput, 300)}`,
        status: output.success ? 'normal' : 'error',
        error: output.error,
        retryCount: isRetry ? retryCount : undefined,
      });
    } catch (err: any) {
      const duration = Date.now() - start;
      this.taskResults.set(task.id, {
        taskId: task.id,
        taskDescription: task.description,
        rawOutput: '',
        success: false,
        error: err.message || String(err),
      });

      this.global.addTraceLog({
        stepName: isRetry ? `task_execution_retry` : `task_execution`,
        role: `worker-${task.id}`,
        durationMs: duration,
        inputSummary: `Task: ${task.id} - ${truncate(task.description, 200)}`,
        outputSummary: 'EXECUTION_ERROR',
        status: 'error',
        error: err.message || String(err),
        retryCount: isRetry ? retryCount : undefined,
      });
    }
  }

  // ─── Phase 3: Reviewer ─────────────────────────────────

  private async runReviewer(): Promise<ReviewOutput> {
    const start = Date.now();
    if (!this.taskList) throw new Error('No task list');

    const allTasks = this.taskList.tasks;
    const resultsToReview = allTasks
      .map((t) => {
        const result = this.taskResults.get(t.id);
        return result
          ? {
              taskId: t.id,
              taskDescription: t.description,
              acceptanceCriteria: t.acceptanceCriteria,
              rawOutput: result.rawOutput || result.error || '(no output)',
            }
          : null;
      })
      .filter(Boolean) as Array<{
      taskId: string;
      taskDescription: string;
      acceptanceCriteria: string;
      rawOutput: string;
    }>;

    const roleCtx: RoleContext = {
      role: 'reviewer',
      resultsToReview,
      global: this.global,
    };

    const result = await run(reviewerAgent, 'Review all task results', {
      context: roleCtx,
    });

    const review = result.finalOutput as any as ReviewOutput;

    this.global.addRawOutput(
      'review',
      'reviewer',
      JSON.stringify(review, null, 2)
    );

    const duration = Date.now() - start;
    const passedCount = review.reviewedItems.filter((i) => i.passed).length;
    this.global.addTraceLog({
      stepName: 'review',
      role: 'reviewer',
      durationMs: duration,
      inputSummary: `Reviewing ${resultsToReview.length} task results`,
      outputSummary: `${passedCount} passed, ${review.reviewedItems.length - passedCount} failed`,
      status: 'normal',
    });

    return review;
  }

  // ─── Phase 5: Reporter ─────────────────────────────────

  private async runReporter(): Promise<FinalReport> {
    const start = Date.now();
    if (!this.taskList) throw new Error('No task list');

    const passedResults = this.taskList.tasks
      .map((t) => {
        const result = this.taskResults.get(t.id);
        return result && result.success
          ? {
              taskId: t.id,
              taskDescription: t.description,
              output: result.rawOutput,
            }
          : null;
      })
      .filter(Boolean) as Array<{
      taskId: string;
      taskDescription: string;
      output: string;
    }>;

    const totalTasks = this.taskList.tasks.length;
    const retriedTasks = this.retryCounts.size;

    const roleCtx: RoleContext = {
      role: 'reporter',
      userInput: this.global.userInput,
      passedResults,
      executionSummary: {
        totalTasks,
        passedTasks: passedResults.length,
        retriedTasks,
        totalDurationMs: this.global.elapsedMs(),
      },
      global: this.global,
    };

    const result = await run(reporterAgent, 'Generate final report', {
      context: roleCtx,
    });

    const report = result.finalOutput as any as FinalReport;

    this.global.addRawOutput(
      'reporting',
      'reporter',
      JSON.stringify(report, null, 2)
    );

    const duration = Date.now() - start;
    this.global.addTraceLog({
      stepName: 'reporting',
      role: 'reporter',
      durationMs: duration,
      inputSummary: `Aggregating ${passedResults.length} passed results`,
      outputSummary: truncate(report.naturalLanguageSummary, 200),
      status: 'normal',
    });

    return report;
  }

  // ─── Helpers ───────────────────────────────────────────

  private partitionTasks(tasks: Task[]): {
    serialTasks: Task[];
    parallelTasks: Task[];
  } {
    const serialTasks: Task[] = [];
    const parallelTasks: Task[] = [];

    for (const task of tasks) {
      if (task.isParallel && task.dependsOn.length === 0) {
        parallelTasks.push(task);
      } else {
        serialTasks.push(task);
      }
    }

    return { serialTasks, parallelTasks };
  }
}

function truncate(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen) + '...';
}

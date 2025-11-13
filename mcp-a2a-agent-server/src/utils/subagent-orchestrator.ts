import pLimit from 'p-limit';
import { nanoid } from 'nanoid';
import type { SubAgentTask, SubAgentResult, AgentExecutionContext } from '../types/index.js';
import { logger } from './logger.js';

/**
 * SubAgent Orchestrator with parallel execution support
 * Manages up to 4 concurrent subagents per tool execution
 */
export class SubAgentOrchestrator {
  private maxConcurrency: number;
  private limiter: ReturnType<typeof pLimit>;

  constructor(maxConcurrency = 4) {
    this.maxConcurrency = maxConcurrency;
    this.limiter = pLimit(maxConcurrency);
  }

  /**
   * Execute multiple subagent tasks in parallel with dependency resolution
   */
  async executeParallel(
    tasks: SubAgentTask[],
    context: AgentExecutionContext,
    executor: (task: SubAgentTask, ctx: AgentExecutionContext) => Promise<unknown>
  ): Promise<SubAgentResult[]> {
    logger.info('Starting parallel subagent execution', {
      sessionId: context.sessionId,
      taskCount: tasks.length,
      maxConcurrency: this.maxConcurrency,
    });

    const results = new Map<string, SubAgentResult>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Group tasks by dependency level
    const levels = this.resolveDependencyLevels(tasks);

    // Execute level by level
    for (const [level, levelTasks] of levels.entries()) {
      logger.debug(`Executing dependency level ${level}`, {
        taskCount: levelTasks.length,
      });

      const promises = levelTasks.map(task =>
        this.limiter(async () => this.executeSingleTask(task, context, executor, results))
      );

      const levelResults = await Promise.allSettled(promises);

      // Store results
      levelResults.forEach((result, idx) => {
        const task = levelTasks[idx];
        if (result.status === 'fulfilled') {
          results.set(task.id, result.value);
        } else {
          results.set(task.id, {
            taskId: task.id,
            success: false,
            error: result.reason?.message || 'Unknown error',
            duration: 0,
          });
        }
      });
    }

    const finalResults = Array.from(results.values());

    logger.info('Parallel execution completed', {
      sessionId: context.sessionId,
      totalTasks: tasks.length,
      successCount: finalResults.filter(r => r.success).length,
      failureCount: finalResults.filter(r => !r.success).length,
    });

    return finalResults;
  }

  /**
   * Execute a single subagent task
   */
  private async executeSingleTask(
    task: SubAgentTask,
    context: AgentExecutionContext,
    executor: (task: SubAgentTask, ctx: AgentExecutionContext) => Promise<unknown>,
    previousResults: Map<string, SubAgentResult>
  ): Promise<SubAgentResult> {
    const startTime = Date.now();

    try {
      // Check dependencies
      if (task.dependencies && task.dependencies.length > 0) {
        const depResults = task.dependencies.map(depId => previousResults.get(depId));
        if (depResults.some(r => !r || !r.success)) {
          throw new Error('Dependency failed or not completed');
        }
      }

      logger.debug(`Executing subagent task: ${task.name}`, {
        taskId: task.id,
        sessionId: context.sessionId,
      });

      const data = await executor(task, context);
      const duration = Date.now() - startTime;

      return {
        taskId: task.id,
        success: true,
        data,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Subagent task failed: ${task.name}`, {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }

  /**
   * Resolve dependency levels for parallel execution
   * Returns a Map of level -> tasks that can be executed in parallel
   */
  private resolveDependencyLevels(tasks: SubAgentTask[]): Map<number, SubAgentTask[]> {
    const levels = new Map<number, SubAgentTask[]>();
    const taskLevels = new Map<string, number>();

    // Calculate level for each task
    const calculateLevel = (task: SubAgentTask): number => {
      if (taskLevels.has(task.id)) {
        return taskLevels.get(task.id)!;
      }

      if (!task.dependencies || task.dependencies.length === 0) {
        taskLevels.set(task.id, 0);
        return 0;
      }

      const depTasks = task.dependencies
        .map(depId => tasks.find(t => t.id === depId))
        .filter((t): t is SubAgentTask => t !== undefined);

      const maxDepLevel = Math.max(...depTasks.map(calculateLevel));
      const level = maxDepLevel + 1;
      taskLevels.set(task.id, level);
      return level;
    };

    // Group tasks by level
    for (const task of tasks) {
      const level = calculateLevel(task);
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(task);
    }

    return new Map([...levels.entries()].sort((a, b) => a[0] - b[0]));
  }

  /**
   * Create a batch of subagent tasks
   */
  static createTasks(
    taskDefinitions: Array<{
      name: string;
      prompt: string;
      dependencies?: string[];
      priority?: number;
    }>
  ): SubAgentTask[] {
    return taskDefinitions.map(def => ({
      id: nanoid(10),
      ...def,
    }));
  }

  /**
   * Aggregate results from multiple subagents
   */
  static aggregateResults<T>(
    results: SubAgentResult[],
    aggregator: (data: unknown[]) => T
  ): T {
    const successfulData = results
      .filter(r => r.success && r.data !== undefined)
      .map(r => r.data);

    return aggregator(successfulData);
  }
}

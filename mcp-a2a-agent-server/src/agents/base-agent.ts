import { z } from 'zod';
import type { AgentTool, AgentConfig, AgentExecutionContext, ToolExecutionResult, SubAgentTask } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';
import { A2AClient } from '../utils/a2a-client.js';
import { logger } from '../utils/logger.js';

/**
 * Base Agent class with subagent orchestration capabilities
 */
export abstract class BaseAgent implements AgentTool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: z.ZodSchema;
  abstract config: AgentConfig;

  protected orchestrator: SubAgentOrchestrator;
  protected a2aClient?: A2AClient;

  constructor(a2aClient?: A2AClient) {
    this.orchestrator = new SubAgentOrchestrator(4); // Max 4 concurrent subagents
    this.a2aClient = a2aClient;
  }

  /**
   * Main execution method - must be implemented by subclasses
   */
  abstract execute(input: unknown, context: AgentExecutionContext): Promise<ToolExecutionResult>;

  /**
   * Execute subagents in parallel
   */
  protected async executeSubAgents(
    tasks: SubAgentTask[],
    context: AgentExecutionContext,
    executor: (task: SubAgentTask, ctx: AgentExecutionContext) => Promise<unknown>
  ) {
    return this.orchestrator.executeParallel(tasks, context, executor);
  }

  /**
   * Validate input against schema
   */
  protected validateInput<T>(input: unknown): T {
    try {
      return this.inputSchema.parse(input) as T;
    } catch (error) {
      logger.error('Input validation failed', {
        agent: this.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Invalid input: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a successful result
   */
  protected success<T>(data: T, metadata?: Record<string, unknown>): ToolExecutionResult<T> {
    return {
      success: true,
      data,
      metadata: {
        duration: 0, // Will be set by wrapper
        ...metadata,
      },
    };
  }

  /**
   * Create an error result
   */
  protected error(message: string, metadata?: Record<string, unknown>): ToolExecutionResult {
    return {
      success: false,
      error: message,
      metadata: {
        duration: 0, // Will be set by wrapper
        ...metadata,
      },
    };
  }

  /**
   * Log agent activity
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>) {
    logger[level](message, {
      agent: this.name,
      ...metadata,
    });
  }
}

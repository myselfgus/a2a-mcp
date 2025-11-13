import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';

/**
 * Task Orchestrator Agent
 * Decomposes complex tasks into subtasks and orchestrates their execution
 */
export class TaskOrchestratorAgent extends BaseAgent {
  name = 'task_orchestrator';
  description = 'Breaks down complex tasks into manageable subtasks, creates execution plans, and coordinates parallel execution with dependency management.';

  inputSchema = z.object({
    task: z.string().describe('The complex task to decompose and execute'),
    maxSubtasks: z.number().min(1).max(4).default(4).describe('Maximum number of subtasks'),
    executionMode: z.enum(['plan_only', 'plan_and_execute']).default('plan_and_execute'),
  });

  config: AgentConfig = {
    name: this.name,
    description: this.description,
    capabilities: {
      maxSubAgents: 4,
      supportsParallelization: true,
      supportsStreaming: false,
      timeoutMs: 120000,
    },
  };

  async execute(input: unknown, context: AgentExecutionContext): Promise<ToolExecutionResult> {
    const params = this.validateInput<z.infer<typeof this.inputSchema>>(input);

    this.log('info', 'Starting task orchestration', {
      task: params.task,
      mode: params.executionMode,
      sessionId: context.sessionId,
    });

    try {
      // Step 1: Decompose the task using orchestrator workflow
      const decomposition = await this.decomposeTask(params.task, params.maxSubtasks);

      if (params.executionMode === 'plan_only') {
        return this.success({
          task: params.task,
          plan: decomposition,
          executionMode: 'plan_only',
          status: 'planned',
        });
      }

      // Step 2: Create subtask execution plan with dependencies
      const tasks = SubAgentOrchestrator.createTasks(
        decomposition.subtasks.map((subtask: any, idx: number) => ({
          name: subtask.name || `subtask_${idx + 1}`,
          prompt: subtask.description || subtask.prompt || String(subtask),
          dependencies: subtask.dependencies || [],
          priority: subtask.priority || 0,
        }))
      );

      // Step 3: Execute subtasks with dependency resolution
      const results = await this.executeSubAgents(tasks, context, async (task) => {
        if (this.a2aClient) {
          // Route subtask to appropriate workflow
          return await this.a2aClient.executeRouter(task.prompt);
        }
        return { result: `Subtask completed: ${task.name}`, success: true };
      });

      // Step 4: Aggregate and validate results
      const aggregatedResults = SubAgentOrchestrator.aggregateResults(results, (data) => {
        return data.map((item, idx) => ({
          subtask: decomposition.subtasks[idx],
          result: item,
          success: results[idx].success,
        }));
      });

      // Step 5: Synthesize final result
      const synthesis = await this.synthesizeResults(
        params.task,
        aggregatedResults,
        context
      );

      const successCount = results.filter(r => r.success).length;

      return this.success({
        task: params.task,
        plan: decomposition,
        subtaskResults: aggregatedResults,
        synthesis,
        summary: {
          totalSubtasks: tasks.length,
          successfulSubtasks: successCount,
          failedSubtasks: tasks.length - successCount,
          overallSuccess: successCount === tasks.length,
        },
      }, {
        subAgentsUsed: results.length,
      });
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async decomposeTask(task: string, maxSubtasks: number): Promise<any> {
    const decompositionPrompt = `Decompose the following complex task into ${maxSubtasks} or fewer manageable subtasks.
For each subtask, provide:
1. Name: Brief descriptive name
2. Description: What needs to be done
3. Dependencies: Array of subtask names this depends on (empty if none)
4. Priority: Number (higher = more important)

Task: ${task}

Provide the decomposition in a structured format.`;

    if (this.a2aClient) {
      try {
        const result = await this.a2aClient.executeOrchestrator(decompositionPrompt);

        // Try to parse structured response
        try {
          return JSON.parse(result);
        } catch {
          // If not JSON, create structure from text
          return {
            subtasks: this.parseTextDecomposition(result, maxSubtasks),
            strategy: 'text_based',
          };
        }
      } catch (error) {
        this.log('warn', 'Task decomposition via A2A failed', { error });
      }
    }

    // Fallback: simple decomposition
    return {
      subtasks: [
        {
          name: 'analyze_requirements',
          description: `Analyze requirements for: ${task}`,
          dependencies: [],
          priority: 1,
        },
        {
          name: 'execute_task',
          description: `Execute main task: ${task}`,
          dependencies: ['analyze_requirements'],
          priority: 0,
        },
      ],
      strategy: 'fallback',
    };
  }

  private parseTextDecomposition(text: string, maxSubtasks: number): any[] {
    // Simple parser for text-based decomposition
    const lines = text.split('\n').filter(l => l.trim());
    const subtasks: any[] = [];

    for (let i = 0; i < Math.min(lines.length, maxSubtasks); i++) {
      const line = lines[i];
      subtasks.push({
        name: `subtask_${i + 1}`,
        description: line.replace(/^\d+[\.)]\s*/, ''),
        dependencies: [],
        priority: 0,
      });
    }

    return subtasks;
  }

  private async synthesizeResults(
    originalTask: string,
    results: any[],
    context: AgentExecutionContext
  ): Promise<string> {
    const synthesisPrompt = `Original task: ${originalTask}

Subtask results:
${results.map((r, idx) => `${idx + 1}. ${r.subtask.name}: ${JSON.stringify(r.result)}`).join('\n')}

Provide a cohesive synthesis that:
1. Summarizes what was accomplished
2. Identifies any gaps or issues
3. Provides final recommendations or next steps`;

    if (this.a2aClient) {
      try {
        return await this.a2aClient.executeEvaluatorOptimizer(synthesisPrompt);
      } catch (error) {
        this.log('warn', 'Synthesis failed', { error });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return `Completed ${successCount}/${results.length} subtasks for: ${originalTask}`;
  }
}

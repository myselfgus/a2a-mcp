import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';

/**
 * A2A Server Manager Agent
 * Manages and monitors the A2A server connection and workflows
 */
export class A2AServerManagerAgent extends BaseAgent {
  name = 'a2a_server_manager';
  description = 'Manages A2A server connections, health checks, and workflow routing. Can test workflows and monitor server status.';

  inputSchema = z.object({
    action: z.enum(['status', 'health_check', 'test_workflow', 'list_workflows']),
    workflow: z.enum(['chaining', 'parallel', 'router', 'orchestrator', 'evaluator_optimizer', 'simple_assistant']).optional(),
    testMessage: z.string().optional(),
  });

  config: AgentConfig = {
    name: this.name,
    description: this.description,
    capabilities: {
      maxSubAgents: 4,
      supportsParallelization: true,
      supportsStreaming: false,
      timeoutMs: 30000,
    },
  };

  async execute(input: unknown, context: AgentExecutionContext): Promise<ToolExecutionResult> {
    const params = this.validateInput<z.infer<typeof this.inputSchema>>(input);

    this.log('info', 'Executing A2A server manager action', {
      action: params.action,
      sessionId: context.sessionId,
    });

    try {
      switch (params.action) {
        case 'status':
          return await this.getStatus();
        case 'health_check':
          return await this.performHealthCheck();
        case 'test_workflow':
          return await this.testWorkflow(params.workflow!, params.testMessage!);
        case 'list_workflows':
          return this.listWorkflows();
        default:
          return this.error('Unknown action');
      }
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async getStatus(): Promise<ToolExecutionResult> {
    if (!this.a2aClient) {
      return this.success({
        enabled: false,
        message: 'A2A client not configured',
      });
    }

    const status = this.a2aClient.getStatus();
    return this.success(status);
  }

  private async performHealthCheck(): Promise<ToolExecutionResult> {
    if (!this.a2aClient) {
      return this.error('A2A client not configured');
    }

    const isHealthy = await this.a2aClient.checkHealth();
    return this.success({
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
    });
  }

  private async testWorkflow(workflow: string, message: string): Promise<ToolExecutionResult> {
    if (!this.a2aClient) {
      return this.error('A2A client not configured');
    }

    if (!message) {
      return this.error('Test message is required');
    }

    const startTime = Date.now();
    const result = await this.a2aClient.executeWorkflow({
      workflow: workflow as any,
      message,
    });

    return this.success({
      workflow,
      result: result.result,
      duration: Date.now() - startTime,
    });
  }

  private listWorkflows(): ToolExecutionResult {
    return this.success({
      workflows: [
        {
          name: 'chaining',
          description: 'Sequential processing with output feeding to next step',
          useCase: 'Multi-step transformations, content pipelines',
        },
        {
          name: 'parallel',
          description: 'Concurrent processing with aggregated results',
          useCase: 'Multi-perspective analysis, validation from different angles',
        },
        {
          name: 'router',
          description: 'Intelligent routing to specialized agents',
          useCase: 'Classification-based task delegation',
        },
        {
          name: 'orchestrator',
          description: 'Dynamic task decomposition with worker coordination',
          useCase: 'Complex problems requiring strategic breakdown',
        },
        {
          name: 'evaluator_optimizer',
          description: 'Iterative refinement with feedback loops',
          useCase: 'Content optimization, quality improvement',
        },
        {
          name: 'simple_assistant',
          description: 'Basic question answering',
          useCase: 'General queries, information retrieval',
        },
      ],
    });
  }
}

import type { A2AServerConfig, A2AWorkflowRequest, A2AWorkflowResponse } from '../types/index.js';
import { logger } from './logger.js';

/**
 * A2A Server Client for workflow execution
 */
export class A2AClient {
  private config: A2AServerConfig;
  private baseUrl: string;
  private isConnected = false;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config: A2AServerConfig) {
    this.config = config;
    this.baseUrl = `http://${config.host}:${config.port}`;

    if (config.enabled) {
      this.startHealthCheck();
    }
  }

  /**
   * Execute a workflow on the A2A server
   */
  async executeWorkflow(request: A2AWorkflowRequest): Promise<A2AWorkflowResponse> {
    if (!this.config.enabled) {
      throw new Error('A2A server is not enabled');
    }

    if (!this.isConnected) {
      logger.warn('A2A server not connected, attempting connection');
      await this.checkHealth();
      if (!this.isConnected) {
        throw new Error('Cannot connect to A2A server');
      }
    }

    try {
      const startTime = Date.now();

      // Format message according to A2A server expectations
      const message = `workflow:${request.workflow}_workflow|${request.message}`;

      logger.debug('Sending request to A2A server', {
        workflow: request.workflow,
        messageLength: request.message.length,
      });

      const response = await fetch(`${this.baseUrl}/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context: request.context || {},
        }),
      });

      if (!response.ok) {
        throw new Error(`A2A server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      logger.info('A2A workflow completed', {
        workflow: request.workflow,
        duration,
      });

      return {
        result: data.result || data.response || String(data),
        metadata: {
          workflow: request.workflow,
          duration,
          stepsExecuted: data.steps_executed,
        },
      };
    } catch (error) {
      logger.error('A2A workflow execution failed', {
        workflow: request.workflow,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `A2A workflow execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute chaining workflow: sequential processing
   */
  async executeChaining(message: string): Promise<string> {
    const response = await this.executeWorkflow({
      workflow: 'chaining',
      message,
    });
    return response.result;
  }

  /**
   * Execute parallel workflow: concurrent processing with aggregation
   */
  async executeParallel(message: string): Promise<string> {
    const response = await this.executeWorkflow({
      workflow: 'parallel',
      message,
    });
    return response.result;
  }

  /**
   * Execute router workflow: intelligent routing to specialized agents
   */
  async executeRouter(message: string): Promise<string> {
    const response = await this.executeWorkflow({
      workflow: 'router',
      message,
    });
    return response.result;
  }

  /**
   * Execute orchestrator workflow: dynamic task decomposition
   */
  async executeOrchestrator(message: string): Promise<string> {
    const response = await this.executeWorkflow({
      workflow: 'orchestrator',
      message,
    });
    return response.result;
  }

  /**
   * Execute evaluator-optimizer workflow: iterative refinement
   */
  async executeEvaluatorOptimizer(message: string): Promise<string> {
    const response = await this.executeWorkflow({
      workflow: 'evaluator_optimizer',
      message,
    });
    return response.result;
  }

  /**
   * Execute simple assistant workflow: basic Q&A
   */
  async executeSimpleAssistant(message: string): Promise<string> {
    const response = await this.executeWorkflow({
      workflow: 'simple_assistant',
      message,
    });
    return response.result;
  }

  /**
   * Check A2A server health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      this.isConnected = response.ok;

      if (this.isConnected) {
        logger.debug('A2A server health check passed');
      } else {
        logger.warn('A2A server health check failed', {
          status: response.status,
        });
      }

      return this.isConnected;
    } catch (error) {
      this.isConnected = false;
      logger.warn('A2A server not reachable', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    const interval = this.config.healthCheckInterval || 30000;

    this.healthCheckTimer = setInterval(() => {
      this.checkHealth();
    }, interval);

    // Initial check
    this.checkHealth();
  }

  /**
   * Stop health checks and cleanup
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; serverUrl: string } {
    return {
      connected: this.isConnected,
      serverUrl: this.baseUrl,
    };
  }
}

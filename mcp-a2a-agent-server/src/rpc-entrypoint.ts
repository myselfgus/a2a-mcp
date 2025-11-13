import { WorkerEntrypoint } from 'cloudflare:workers';
import type { AgentExecutionContext, ToolExecutionResult } from './types/index.js';
import { AGENT_CLASSES } from './agents/index.js';
import { A2AClient } from './utils/a2a-client.js';
import { logger } from './utils/logger.js';
import { nanoid } from 'nanoid';

/**
 * A2A Agent Server RPC Entrypoint
 * Exposes all agents as RPC methods for inter-worker communication
 */
export default class A2ARPC extends WorkerEntrypoint<Env> {
  private agents: Map<string, any>;
  private a2aClient?: A2AClient;

  constructor(ctx: any, env: Env) {
    super(ctx, env);
    this.agents = new Map();
    this.initializeAgents();
  }

  /**
   * Required fetch handler (returns 404 as per RPC pattern)
   */
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({
      error: 'Direct fetch not supported. Use RPC methods.',
      availableMethods: this.getAvailableMethods(),
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Initialize all agents
   */
  private initializeAgents(): void {
    // Initialize A2A client if configured
    if (this.env.A2A_ENABLED !== 'false') {
      const a2aConfig = {
        host: this.env.A2A_HOST || 'localhost',
        port: parseInt(this.env.A2A_PORT || '9999', 10),
        enabled: true,
      };
      this.a2aClient = new A2AClient(a2aConfig);
    }

    // Register all agents
    for (const AgentClass of AGENT_CLASSES) {
      const agent = new AgentClass(this.a2aClient);
      this.agents.set(agent.name, agent);
    }

    logger.info('A2ARPC initialized', {
      agentCount: this.agents.size,
      a2aEnabled: !!this.a2aClient,
    });
  }

  /**
   * Get list of available RPC methods
   */
  getAvailableMethods(): string[] {
    return [
      'health',
      'listAgents',
      'executeAgent',
      // Individual agent methods
      ...Array.from(this.agents.keys()),
    ];
  }

  /**
   * Health check RPC method
   */
  async health(): Promise<{
    status: string;
    agents: number;
    a2aConnected: boolean;
    timestamp: string;
  }> {
    const a2aStatus = this.a2aClient?.getStatus();

    return {
      status: 'healthy',
      agents: this.agents.size,
      a2aConnected: a2aStatus?.connected || false,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * List all available agents
   */
  async listAgents(): Promise<Array<{
    name: string;
    description: string;
    capabilities: any;
  }>> {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.name,
      description: agent.description,
      capabilities: agent.config.capabilities,
    }));
  }

  /**
   * Execute any agent by name
   */
  async executeAgent(
    agentName: string,
    input: unknown,
    metadata?: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      return {
        success: false,
        error: `Agent not found: ${agentName}`,
        metadata: { duration: 0 },
      };
    }

    const context: AgentExecutionContext = {
      sessionId: nanoid(16),
      metadata: {
        agent: agentName,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
      depth: 0,
    };

    const startTime = Date.now();
    try {
      const result = await agent.execute(input, context);
      const duration = Date.now() - startTime;

      if (result.metadata) {
        result.metadata.duration = duration;
      }

      logger.info('Agent execution completed via RPC', {
        agent: agentName,
        success: result.success,
        duration,
        sessionId: context.sessionId,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Agent execution failed via RPC', {
        agent: agentName,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { duration },
      };
    }
  }

  // ========================================
  // Individual Agent RPC Methods
  // ========================================

  /**
   * A2A Server Manager RPC
   */
  async a2a_server_manager(input: {
    action: 'status' | 'health_check' | 'test_workflow' | 'list_workflows';
    workflow?: string;
    testMessage?: string;
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('a2a_server_manager', input);
  }

  /**
   * Code Analyst RPC
   */
  async code_analyst(input: {
    code: string;
    language?: string;
    aspects?: string[];
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('code_analyst', input);
  }

  /**
   * Research Agent RPC
   */
  async research_agent(input: {
    topic: string;
    perspectives?: string[];
    depth?: 'quick' | 'standard' | 'deep';
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('research_agent', input);
  }

  /**
   * Task Orchestrator RPC
   */
  async task_orchestrator(input: {
    task: string;
    maxSubtasks?: number;
    executionMode?: 'plan_only' | 'plan_and_execute';
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('task_orchestrator', input);
  }

  /**
   * Content Generator RPC
   */
  async content_generator(input: {
    topic: string;
    formats?: string[];
    tone?: string;
    length?: string;
    optimize?: boolean;
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('content_generator', input);
  }

  /**
   * Data Processor RPC
   */
  async data_processor(input: {
    data: any;
    operations?: string[];
    outputFormat?: string;
    customRules?: string;
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('data_processor', input);
  }

  /**
   * Testing Agent RPC
   */
  async testing_agent(input: {
    target: string;
    testTypes?: string[];
    framework?: string;
    coverage?: string;
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('testing_agent', input);
  }

  /**
   * Documentation Agent RPC
   */
  async documentation_agent(input: {
    target: string;
    docTypes?: string[];
    format?: string;
    audience?: string;
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('documentation_agent', input);
  }

  /**
   * Optimization Agent RPC
   */
  async optimization_agent(input: {
    target: string;
    optimizationTypes?: string[];
    iterations?: number;
    constraints?: string;
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('optimization_agent', input);
  }

  /**
   * Integration Agent RPC
   */
  async integration_agent(input: {
    sourceSystem: string;
    targetSystem: string;
    integrationType?: string;
    requirements?: string;
    generateCode?: boolean;
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('integration_agent', input);
  }

  /**
   * Security Audit RPC
   */
  async security_audit(input: {
    target: string;
    auditTypes?: string[];
    complianceFrameworks?: string[];
    depth?: string;
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('security_audit', input);
  }

  /**
   * Deployment Agent RPC
   */
  async deployment_agent(input: {
    application: string;
    environment?: string;
    platform?: string;
    components?: string[];
    strategy?: string;
  }): Promise<ToolExecutionResult> {
    return this.executeAgent('deployment_agent', input);
  }
}

/**
 * Type definitions for Cloudflare Workers environment
 */
interface Env {
  // A2A Configuration
  A2A_ENABLED?: string;
  A2A_HOST?: string;
  A2A_PORT?: string;

  // Optional bindings to other workers/services
  META_MCP?: Service<MetaMCPRPC>;
  WORKER_PUBLISHER?: Service<WorkerPublisherRPC>;
  MCP_CLIENT?: Service<MCPClientRPC>;
  CONTAINER_MANAGER?: Service<ContainerManagerRPC>;

  // Durable Object namespace (if needed)
  DISPATCHER?: DurableObjectNamespace;

  // KV/R2 (if needed)
  CACHE?: KVNamespace;
  STORAGE?: R2Bucket;
}

/**
 * Type definitions for other RPC services
 */
interface MetaMCPRPC {
  health(): Promise<any>;
  listServers(): Promise<any>;
  executeOnServer(serverId: string, tool: string, args: any): Promise<any>;
}

interface WorkerPublisherRPC {
  health(): Promise<any>;
  publish(topic: string, message: any): Promise<any>;
  subscribe(topic: string): Promise<any>;
}

interface MCPClientRPC {
  health(): Promise<any>;
  connectToServer(serverUrl: string): Promise<any>;
  callTool(tool: string, args: any): Promise<any>;
}

interface ContainerManagerRPC {
  health(): Promise<any>;
  startContainer(config: any): Promise<any>;
  stopContainer(containerId: string): Promise<any>;
  getContainerStatus(containerId: string): Promise<any>;
}

/**
 * Service type helper
 */
interface Service<T = unknown> {
  fetch(request: Request): Promise<Response>;
  [K: string]: any;
}

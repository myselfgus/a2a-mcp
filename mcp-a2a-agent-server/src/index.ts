#!/usr/bin/env node

/**
 * MCP A2A Agent Server
 * Production-ready MCP server with A2A integration and advanced agent orchestration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { A2AClient } from './utils/a2a-client.js';
import { logger } from './utils/logger.js';
import { AGENT_CLASSES, AGENT_METADATA } from './agents/index.js';
import type { AgentTool, AgentExecutionContext, A2AServerConfig, ServiceHealth } from './types/index.js';
import { nanoid } from 'nanoid';

/**
 * MCP A2A Agent Server Configuration
 */
class MCPAgentServer {
  private server: Server;
  private a2aClient?: A2AClient;
  private agents: Map<string, AgentTool>;
  private startTime: number;

  constructor() {
    this.server = new Server(
      {
        name: '@a2a-mcp/agent-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.agents = new Map();
    this.startTime = Date.now();

    this.initializeA2AClient();
    this.registerAgents();
    this.setupHandlers();

    logger.info('MCP A2A Agent Server initialized', {
      agentCount: this.agents.size,
      a2aEnabled: !!this.a2aClient,
    });
  }

  /**
   * Initialize A2A client if configured
   */
  private initializeA2AClient(): void {
    const a2aConfig: A2AServerConfig = {
      host: process.env.A2A_HOST || 'localhost',
      port: parseInt(process.env.A2A_PORT || '9999', 10),
      enabled: process.env.A2A_ENABLED !== 'false',
      healthCheckInterval: 30000,
    };

    if (a2aConfig.enabled) {
      this.a2aClient = new A2AClient(a2aConfig);
      logger.info('A2A client initialized', {
        host: a2aConfig.host,
        port: a2aConfig.port,
      });
    } else {
      logger.warn('A2A client disabled - agents will run in fallback mode');
    }
  }

  /**
   * Register all agent tools
   */
  private registerAgents(): void {
    for (const AgentClass of AGENT_CLASSES) {
      const agent = new AgentClass(this.a2aClient);
      this.agents.set(agent.name, agent);

      logger.debug('Registered agent', {
        name: agent.name,
        description: agent.description,
        maxSubAgents: agent.config.capabilities.maxSubAgents,
      });
    }
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = Array.from(this.agents.values()).map(agent => ({
        name: agent.name,
        description: agent.description,
        inputSchema: agent.inputSchema as any,
      }));

      // Add server health tool
      tools.push({
        name: 'server_health',
        description: 'Get MCP server health status and metrics',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });

      return { tools };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.info('Tool execution requested', {
        tool: name,
        hasArgs: !!args,
      });

      try {
        // Handle special server_health tool
        if (name === 'server_health') {
          const health = this.getServerHealth();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(health, null, 2),
              },
            ],
          };
        }

        // Get agent
        const agent = this.agents.get(name);
        if (!agent) {
          throw new Error(`Unknown tool: ${name}`);
        }

        // Create execution context
        const context: AgentExecutionContext = {
          sessionId: nanoid(16),
          metadata: {
            tool: name,
            timestamp: new Date().toISOString(),
          },
          depth: 0,
        };

        // Execute agent
        const startTime = Date.now();
        const result = await agent.execute(args || {}, context);
        const duration = Date.now() - startTime;

        if (result.metadata) {
          result.metadata.duration = duration;
        }

        logger.info('Tool execution completed', {
          tool: name,
          success: result.success,
          duration,
          sessionId: context.sessionId,
        });

        // Format response
        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result.data, null, 2),
              },
            ],
            isError: false,
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${result.error}`,
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        logger.error('Tool execution failed', {
          tool: name,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Get server health status
   */
  private getServerHealth(): ServiceHealth {
    const uptime = Date.now() - this.startTime;
    const a2aStatus = this.a2aClient?.getStatus();

    return {
      status: 'healthy',
      uptime,
      a2aServerConnected: a2aStatus?.connected || false,
      activeAgents: this.agents.size,
      agents: Array.from(this.agents.keys()),
      a2aServer: a2aStatus,
      metadata: {
        version: '1.0.0',
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
      },
    };
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('MCP A2A Agent Server started', {
      transport: 'stdio',
      agents: this.agents.size,
    });
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down MCP A2A Agent Server');

    if (this.a2aClient) {
      this.a2aClient.destroy();
    }

    await this.server.close();
  }
}

/**
 * Main entry point
 */
async function main() {
  const server = new MCPAgentServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.shutdown();
    process.exit(0);
  });

  // Start server
  await server.start();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}

export { MCPAgentServer };

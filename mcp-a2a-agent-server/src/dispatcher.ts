/**
 * Dispatcher Worker
 * Routes requests to the appropriate A2A agent worker instance
 */

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Health check endpoint
    if (path === '/health' || path === '/') {
      try {
        const worker = env.DISPATCHER.get(env.DISPATCHER.idFromName('a2a-agents'));
        const health = await worker.health();

        return new Response(JSON.stringify({
          service: 'A2A Agent Server Dispatcher',
          status: 'healthy',
          agents: health,
          timestamp: new Date().toISOString(),
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          service: 'A2A Agent Server Dispatcher',
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // List agents endpoint
    if (path === '/agents') {
      try {
        const worker = env.DISPATCHER.get(env.DISPATCHER.idFromName('a2a-agents'));
        const agents = await worker.listAgents();

        return new Response(JSON.stringify({
          agents,
          count: agents.length,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Execute agent endpoint: POST /execute
    if (path === '/execute' && req.method === 'POST') {
      try {
        const body = await req.json() as {
          agent: string;
          input: unknown;
          metadata?: Record<string, unknown>;
        };

        if (!body.agent) {
          return new Response(JSON.stringify({
            error: 'Missing required field: agent',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const worker = env.DISPATCHER.get(env.DISPATCHER.idFromName('a2a-agents'));
        const result = await worker.executeAgent(body.agent, body.input, body.metadata);

        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Agent-specific endpoints: POST /agents/:agentName
    const agentMatch = path.match(/^\/agents\/([a-z_]+)$/);
    if (agentMatch && req.method === 'POST') {
      try {
        const agentName = agentMatch[1];
        const body = await req.json();

        const worker = env.DISPATCHER.get(env.DISPATCHER.idFromName('a2a-agents'));

        // Call the specific agent method via RPC
        const result = await (worker as any)[agentName](body);

        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // RPC bridge endpoint for cross-worker communication
    if (path === '/rpc' && req.method === 'POST') {
      try {
        const body = await req.json() as {
          method: string;
          args: any[];
        };

        if (!body.method) {
          return new Response(JSON.stringify({
            error: 'Missing required field: method',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const worker = env.DISPATCHER.get(env.DISPATCHER.idFromName('a2a-agents'));

        // Call the RPC method
        const result = await (worker as any)[body.method](...(body.args || []));

        return new Response(JSON.stringify({
          success: true,
          result,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Integration with other services via bindings
    if (path === '/integrate' && req.method === 'POST') {
      try {
        const body = await req.json() as {
          service: 'meta_mcp' | 'worker_publisher' | 'mcp_client' | 'container_manager';
          method: string;
          args: any[];
        };

        let result: any;

        switch (body.service) {
          case 'meta_mcp':
            if (env.META_MCP) {
              result = await (env.META_MCP as any)[body.method](...(body.args || []));
            } else {
              throw new Error('META_MCP service not bound');
            }
            break;

          case 'worker_publisher':
            if (env.WORKER_PUBLISHER) {
              result = await (env.WORKER_PUBLISHER as any)[body.method](...(body.args || []));
            } else {
              throw new Error('WORKER_PUBLISHER service not bound');
            }
            break;

          case 'mcp_client':
            if (env.MCP_CLIENT) {
              result = await (env.MCP_CLIENT as any)[body.method](...(body.args || []));
            } else {
              throw new Error('MCP_CLIENT service not bound');
            }
            break;

          case 'container_manager':
            if (env.CONTAINER_MANAGER) {
              result = await (env.CONTAINER_MANAGER as any)[body.method](...(body.args || []));
            } else {
              throw new Error('CONTAINER_MANAGER service not bound');
            }
            break;

          default:
            throw new Error(`Unknown service: ${body.service}`);
        }

        return new Response(JSON.stringify({
          success: true,
          result,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Documentation endpoint
    if (path === '/docs') {
      const docs = {
        service: 'A2A Agent Server',
        version: '1.0.0',
        endpoints: {
          'GET /': 'Health check',
          'GET /health': 'Health check',
          'GET /agents': 'List all available agents',
          'POST /execute': 'Execute an agent by name',
          'POST /agents/:agentName': 'Execute specific agent directly',
          'POST /rpc': 'RPC bridge for cross-worker communication',
          'POST /integrate': 'Integrate with other services',
          'GET /docs': 'This documentation',
        },
        agents: [
          'a2a_server_manager',
          'code_analyst',
          'research_agent',
          'task_orchestrator',
          'content_generator',
          'data_processor',
          'testing_agent',
          'documentation_agent',
          'optimization_agent',
          'integration_agent',
          'security_audit',
          'deployment_agent',
        ],
        rpcMethods: [
          'health()',
          'listAgents()',
          'executeAgent(agentName, input, metadata?)',
          'a2a_server_manager(input)',
          'code_analyst(input)',
          'research_agent(input)',
          'task_orchestrator(input)',
          'content_generator(input)',
          'data_processor(input)',
          'testing_agent(input)',
          'documentation_agent(input)',
          'optimization_agent(input)',
          'integration_agent(input)',
          'security_audit(input)',
          'deployment_agent(input)',
        ],
        integrations: {
          META_MCP: 'Meta MCP server orchestration',
          WORKER_PUBLISHER: 'Pub/sub messaging',
          MCP_CLIENT: 'MCP client connections',
          CONTAINER_MANAGER: 'Container lifecycle management',
        },
      };

      return new Response(JSON.stringify(docs, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 404 - Not Found
    return new Response(JSON.stringify({
      error: 'Not Found',
      path,
      availableEndpoints: ['/', '/health', '/agents', '/execute', '/agents/:agentName', '/rpc', '/integrate', '/docs'],
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

/**
 * Environment bindings
 */
interface Env {
  DISPATCHER: DurableObjectNamespace;

  // Optional service bindings
  META_MCP?: Service;
  WORKER_PUBLISHER?: Service;
  MCP_CLIENT?: Service;
  CONTAINER_MANAGER?: Service;

  // Environment variables
  A2A_ENABLED?: string;
  A2A_HOST?: string;
  A2A_PORT?: string;
}

interface Service {
  [method: string]: (...args: any[]) => Promise<any>;
}

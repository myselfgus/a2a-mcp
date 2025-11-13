# A2A Agent Server - RPC Integration Guide

## Overview

The A2A Agent Server is designed for **RPC (Remote Procedure Call)** communication between Cloudflare Workers using the `WorkerEntrypoint` pattern. This enables efficient inter-worker communication without HTTP overhead.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Dispatcher Worker                         │
│  (Entry point - routes requests)                            │
│  - HTTP endpoints for external access                       │
│  - RPC bridge for worker-to-worker communication            │
└──────────────────────┬──────────────────────────────────────┘
                       │ RPC Calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              A2ARPC (Durable Object)                         │
│  (Extends WorkerEntrypoint)                                 │
│  - 12 specialized agent methods                             │
│  - Parallel subagent orchestration                          │
│  - A2A workflow integration                                 │
└──────────┬────────────┬────────────┬─────────────┬──────────┘
           │            │            │             │
           ▼            ▼            ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ META_MCP │  │ WORKER_  │  │   MCP_   │  │CONTAINER_│
    │   RPC    │  │PUBLISHER │  │ CLIENT   │  │ MANAGER  │
    │          │  │   RPC    │  │   RPC    │  │   RPC    │
    └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

## RPC Methods

### Core Methods

All agents expose these standard methods:

```typescript
// Health check
await env.DISPATCHER.health();

// List all agents
await env.DISPATCHER.listAgents();

// Execute any agent by name
await env.DISPATCHER.executeAgent(agentName, input, metadata);
```

### Agent-Specific RPC Methods

Each agent has a dedicated RPC method:

#### 1. A2A Server Manager
```typescript
await env.DISPATCHER.a2a_server_manager({
  action: 'status' | 'health_check' | 'test_workflow' | 'list_workflows',
  workflow?: 'chaining' | 'parallel' | 'router' | 'orchestrator' | 'evaluator_optimizer' | 'simple_assistant',
  testMessage?: string
});
```

#### 2. Code Analyst
```typescript
await env.DISPATCHER.code_analyst({
  code: 'your code here',
  language?: 'javascript' | 'python' | 'rust' | ...,
  aspects?: ['quality', 'security', 'performance', 'maintainability', 'all']
});
```

#### 3. Research Agent
```typescript
await env.DISPATCHER.research_agent({
  topic: 'Your research topic',
  perspectives?: ['technical', 'business', 'user', 'competitive', 'all'],
  depth?: 'quick' | 'standard' | 'deep'
});
```

#### 4. Task Orchestrator
```typescript
await env.DISPATCHER.task_orchestrator({
  task: 'Complex task description',
  maxSubtasks?: 1-4,
  executionMode?: 'plan_only' | 'plan_and_execute'
});
```

#### 5. Content Generator
```typescript
await env.DISPATCHER.content_generator({
  topic: 'Content topic',
  formats?: ['blog', 'social', 'technical', 'marketing', 'email', 'all'],
  tone?: 'professional' | 'casual' | 'technical' | 'persuasive' | 'educational',
  length?: 'short' | 'medium' | 'long',
  optimize?: boolean
});
```

#### 6. Data Processor
```typescript
await env.DISPATCHER.data_processor({
  data: yourData,
  operations?: ['validate', 'transform', 'aggregate', 'analyze', 'visualize', 'all'],
  outputFormat?: 'json' | 'csv' | 'summary' | 'report',
  customRules?: 'optional rules'
});
```

#### 7. Testing Agent
```typescript
await env.DISPATCHER.testing_agent({
  target: 'code or system to test',
  testTypes?: ['unit', 'integration', 'e2e', 'performance', 'security', 'all'],
  framework?: 'jest' | 'vitest' | 'pytest' | ...,
  coverage?: 'basic' | 'comprehensive' | 'exhaustive'
});
```

#### 8. Documentation Agent
```typescript
await env.DISPATCHER.documentation_agent({
  target: 'code or system to document',
  docTypes?: ['api', 'user_guide', 'architecture', 'tutorial', 'readme', 'all'],
  format?: 'markdown' | 'html' | 'pdf' | 'json',
  audience?: 'developer' | 'user' | 'admin' | 'mixed'
});
```

#### 9. Optimization Agent
```typescript
await env.DISPATCHER.optimization_agent({
  target: 'code or system to optimize',
  optimizationTypes?: ['performance', 'memory', 'cost', 'scalability', 'all'],
  iterations?: 1-5,
  constraints?: 'optional constraints'
});
```

#### 10. Integration Agent
```typescript
await env.DISPATCHER.integration_agent({
  sourceSystem: 'source system name',
  targetSystem: 'target system name',
  integrationType?: 'api' | 'database' | 'file' | 'stream' | 'webhook' | 'auto',
  requirements?: 'optional requirements',
  generateCode?: boolean
});
```

#### 11. Security Audit
```typescript
await env.DISPATCHER.security_audit({
  target: 'code or system to audit',
  auditTypes?: ['owasp', 'dependencies', 'secrets', 'compliance', 'infrastructure', 'all'],
  complianceFrameworks?: ['SOC2', 'GDPR', 'HIPAA'],
  depth?: 'quick' | 'standard' | 'comprehensive'
});
```

#### 12. Deployment Agent
```typescript
await env.DISPATCHER.deployment_agent({
  application: 'app name',
  environment?: 'development' | 'staging' | 'production' | 'all',
  platform?: 'kubernetes' | 'docker' | 'serverless' | 'vm' | 'auto',
  components?: ['cicd', 'infrastructure', 'monitoring', 'security', 'all'],
  strategy?: 'blue_green' | 'canary' | 'rolling' | 'recreate'
});
```

## Integration with Other Services

### Using Service Bindings

In your worker, define bindings in `wrangler.jsonc`:

```jsonc
{
  "services": [
    {
      "binding": "A2A_AGENTS",
      "service": "a2a-agent-server",
      "entrypoint": "A2ARPC"
    }
  ]
}
```

### Example: Calling from MetaMCP

```typescript
// meta-mcp worker
export default class MetaMCPRPC extends WorkerEntrypoint {
  async analyzeCode(code: string) {
    // Call A2A agents via RPC
    const result = await this.env.A2A_AGENTS.code_analyst({
      code,
      aspects: ['security', 'performance']
    });

    return result;
  }
}
```

### Example: Calling from Worker Publisher

```typescript
// worker-publisher
export default class WorkerPublisherRPC extends WorkerEntrypoint {
  async publish(topic: string, message: any) {
    // Generate content using A2A agents
    if (topic === 'blog-post') {
      const content = await this.env.A2A_AGENTS.content_generator({
        topic: message.topic,
        formats: ['blog', 'social']
      });

      // Publish the generated content
      // ...
      return content;
    }
  }
}
```

### Example: Calling from MCP Client

```typescript
// mcp-client
export default class MCPClientRPC extends WorkerEntrypoint {
  async executeRemoteTool(toolName: string, args: any) {
    // Route to appropriate A2A agent
    const result = await this.env.A2A_AGENTS.executeAgent(
      toolName,
      args
    );

    return result;
  }
}
```

### Example: Calling from Container Manager

```typescript
// container-manager
export default class ContainerManagerRPC extends WorkerEntrypoint {
  async deployContainer(config: any) {
    // Use deployment agent to orchestrate
    const deployment = await this.env.A2A_AGENTS.deployment_agent({
      application: config.name,
      platform: 'docker',
      components: ['all']
    });

    // Execute deployment based on plan
    // ...
    return deployment;
  }
}
```

## HTTP API Endpoints

For external access, the Dispatcher exposes HTTP endpoints:

### GET /health
Health check endpoint

**Response:**
```json
{
  "service": "A2A Agent Server Dispatcher",
  "status": "healthy",
  "agents": {
    "status": "healthy",
    "agents": 12,
    "a2aConnected": true
  },
  "timestamp": "2025-01-13T..."
}
```

### GET /agents
List all available agents

**Response:**
```json
{
  "agents": [
    {
      "name": "code_analyst",
      "description": "...",
      "capabilities": { ... }
    },
    // ... more agents
  ],
  "count": 12
}
```

### POST /execute
Execute an agent by name

**Request:**
```json
{
  "agent": "code_analyst",
  "input": {
    "code": "function add(a, b) { return a + b; }",
    "aspects": ["quality"]
  },
  "metadata": {
    "requestId": "123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis": { ... }
  },
  "metadata": {
    "duration": 1234
  }
}
```

### POST /agents/:agentName
Execute specific agent directly

**Example: POST /agents/code_analyst**

**Request:**
```json
{
  "code": "function add(a, b) { return a + b; }",
  "aspects": ["quality", "performance"]
}
```

### POST /rpc
RPC bridge for programmatic access

**Request:**
```json
{
  "method": "code_analyst",
  "args": [{
    "code": "...",
    "aspects": ["security"]
  }]
}
```

### POST /integrate
Call other bound services

**Request:**
```json
{
  "service": "meta_mcp",
  "method": "listServers",
  "args": []
}
```

### GET /docs
API documentation

## Configuration

### Environment Variables

```bash
# A2A Server
A2A_ENABLED=true
A2A_HOST=localhost
A2A_PORT=9999

# Logging
LOG_LEVEL=info

# Agent Configuration
MAX_SUBAGENTS=4
AGENT_TIMEOUT_MS=120000
```

### Service Bindings

Define in `wrangler.jsonc`:

```jsonc
{
  "services": [
    {
      "binding": "META_MCP",
      "service": "meta-mcp",
      "entrypoint": "MetaMCPRPC"
    },
    {
      "binding": "WORKER_PUBLISHER",
      "service": "worker-publisher",
      "entrypoint": "WorkerPublisherRPC"
    },
    {
      "binding": "MCP_CLIENT",
      "service": "mcp-client",
      "entrypoint": "MCPClientRPC"
    },
    {
      "binding": "CONTAINER_MANAGER",
      "service": "container-manager",
      "entrypoint": "ContainerManagerRPC"
    }
  ]
}
```

## Deployment

### Development
```bash
npm run wrangler:dev
```

### Staging
```bash
npm run wrangler:deploy:staging
```

### Production
```bash
npm run wrangler:deploy:production
```

### View Logs
```bash
npm run wrangler:logs
```

## Testing RPC Calls

### From Another Worker

```typescript
export default {
  async fetch(req: Request, env: Env) {
    // Direct RPC call
    const result = await env.A2A_AGENTS.code_analyst({
      code: 'console.log("hello")',
      aspects: ['quality']
    });

    return new Response(JSON.stringify(result));
  }
}
```

### Via HTTP

```bash
# Health check
curl https://a2a-agents.example.com/health

# Execute agent
curl -X POST https://a2a-agents.example.com/agents/code_analyst \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function test() {}",
    "aspects": ["quality"]
  }'

# RPC bridge
curl -X POST https://a2a-agents.example.com/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "method": "research_agent",
    "args": [{
      "topic": "AI agents",
      "depth": "quick"
    }]
  }'
```

## Best Practices

### 1. Use RPC for Inter-Worker Communication
```typescript
// Good: Direct RPC call
const result = await env.A2A_AGENTS.code_analyst(input);

// Avoid: HTTP fetch between workers
const response = await fetch('https://a2a-agents.example.com/agents/code_analyst');
```

### 2. Handle Errors Gracefully
```typescript
try {
  const result = await env.A2A_AGENTS.code_analyst(input);
  if (!result.success) {
    // Handle agent error
    console.error('Agent failed:', result.error);
  }
} catch (error) {
  // Handle RPC error
  console.error('RPC call failed:', error);
}
```

### 3. Pass Metadata for Tracing
```typescript
const result = await env.A2A_AGENTS.executeAgent(
  'code_analyst',
  input,
  {
    requestId: req.headers.get('x-request-id'),
    userId: user.id,
    timestamp: Date.now()
  }
);
```

### 4. Batch Related Operations
```typescript
// Execute multiple agents in parallel
const [analysis, tests, docs] = await Promise.all([
  env.A2A_AGENTS.code_analyst({ code }),
  env.A2A_AGENTS.testing_agent({ target: code }),
  env.A2A_AGENTS.documentation_agent({ target: code })
]);
```

## Performance Considerations

- **RPC calls**: ~1-5ms overhead (much faster than HTTP)
- **Agent execution**: 1-120 seconds (depending on complexity)
- **Parallel subagents**: Up to 4 concurrent executions
- **Timeout**: Configurable per agent (default: 60-120s)

## Security

- **Service bindings**: Only explicitly bound workers can call RPC methods
- **Input validation**: All inputs validated with Zod schemas
- **Rate limiting**: Configure via Cloudflare Workers rate limiting
- **Authentication**: Implement in Dispatcher if needed

## Monitoring

### View Real-time Logs
```bash
wrangler tail a2a-agent-server --format pretty
```

### Metrics Available
- RPC call count
- Agent execution duration
- Success/failure rates
- Error types and frequencies

## Troubleshooting

### RPC Method Not Found
- Ensure the method exists in A2ARPC class
- Check service binding in wrangler.jsonc
- Verify the worker is deployed

### Timeout Errors
- Increase `AGENT_TIMEOUT_MS` environment variable
- Check A2A server connectivity
- Review agent complexity

### Type Errors
- Install `@cloudflare/workers-types`
- Add to tsconfig.json `types` array
- Rebuild with `npm run build`

---

**Version**: 1.0.0
**Last Updated**: 2025-01-13

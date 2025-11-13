# MCP A2A Agent Server - Architecture

## Overview

The MCP A2A Agent Server is a production-ready implementation combining Model Context Protocol (MCP), Agent-to-Agent (A2A) communication, and the Claude Agents SDK to provide a powerful platform for AI agent orchestration.

## Core Design Principles

### 1. Composability
- Agents are self-contained, reusable components
- Each agent can invoke up to 4 subagents in parallel
- Agents can be chained through A2A workflows

### 2. Parallel Execution
- SubAgentOrchestrator manages concurrent execution
- Dependency-aware scheduling
- Result aggregation and synthesis

### 3. Production Readiness
- Comprehensive error handling
- Structured logging with Winston
- Health monitoring
- Type safety with TypeScript and Zod

### 4. A2A Integration
- Seamless integration with A2A multi-workflow server
- Access to 6 different workflow patterns
- Fallback mechanisms when A2A unavailable

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   MCP Client (Claude)                    │
└────────────────────┬────────────────────────────────────┘
                     │ MCP Protocol (stdio)
                     ▼
┌─────────────────────────────────────────────────────────┐
│              MCP A2A Agent Server (Node.js)              │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │           MCP Server (SDK)                         │ │
│  │  • ListTools handler                               │ │
│  │  • CallTool handler                                │ │
│  │  • Health monitoring                               │ │
│  └────────────┬───────────────────────────────────────┘ │
│               │                                          │
│  ┌────────────▼───────────────────────────────────────┐ │
│  │         Agent Registry                             │ │
│  │  • 12 specialized agents                           │ │
│  │  • Dynamic tool discovery                          │ │
│  └────────────┬───────────────────────────────────────┘ │
│               │                                          │
│  ┌────────────▼───────────────────────────────────────┐ │
│  │         Base Agent (Abstract)                      │ │
│  │  • Input validation (Zod)                          │ │
│  │  • SubAgent orchestration                          │ │
│  │  • A2A client access                               │ │
│  │  • Logging and metrics                             │ │
│  └────────────┬───────────────────────────────────────┘ │
│               │                                          │
│  ┌────────────▼───────────────────────────────────────┐ │
│  │      SubAgent Orchestrator                         │ │
│  │  • Parallel execution (max 4)                      │ │
│  │  • Dependency resolution                           │ │
│  │  • Result aggregation                              │ │
│  └────────────┬───────────────────────────────────────┘ │
│               │                                          │
│  ┌────────────▼───────────────────────────────────────┐ │
│  │         A2A Client                                 │ │
│  │  • Workflow execution                              │ │
│  │  • Health checking                                 │ │
│  │  • Connection pooling                              │ │
│  └────────────┬───────────────────────────────────────┘ │
└────────────────┼────────────────────────────────────────┘
                 │ HTTP/JSON-RPC
                 ▼
┌─────────────────────────────────────────────────────────┐
│          A2A Multi-Workflow Server (Python)              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  MultiWorkflowExecutor                           │   │
│  │  • Chaining workflow                             │   │
│  │  • Parallel workflow                             │   │
│  │  • Router workflow                               │   │
│  │  • Orchestrator workflow                         │   │
│  │  • Evaluator-Optimizer workflow                  │   │
│  │  • Simple Assistant workflow                     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Agent Execution Flow

### 1. Tool Invocation

```typescript
MCP Client → MCP Server → CallTool Handler
                            ↓
                      Agent Registry
                            ↓
                    Specific Agent
                            ↓
                   Input Validation (Zod)
                            ↓
                   Execute Method
```

### 2. Subagent Orchestration

```typescript
Agent.execute()
    ↓
Create SubAgent Tasks
    ↓
SubAgentOrchestrator.executeParallel()
    ↓
┌─────────────────────────────────┐
│  Dependency Resolution          │
│  • Level 0: Independent tasks   │
│  • Level 1: Tasks with deps     │
│  • Level N: Chained tasks       │
└─────────────────────────────────┘
    ↓
Execute Level by Level
    ↓
┌──────────┬──────────┬──────────┬──────────┐
│ SubAgent │ SubAgent │ SubAgent │ SubAgent │
│    1     │    2     │    3     │    4     │
└──────────┴──────────┴──────────┴──────────┘
    ↓          ↓          ↓          ↓
┌────────────────────────────────────────────┐
│         Result Aggregation                 │
└────────────────────────────────────────────┘
    ↓
Return to Agent
```

### 3. A2A Workflow Integration

```typescript
Agent needs LLM processing
    ↓
A2AClient.executeWorkflow()
    ↓
┌─────────────────────────────────┐
│  Select Workflow Pattern        │
│  • Chaining: Sequential         │
│  • Parallel: Multi-perspective  │
│  • Router: Classification       │
│  • Orchestrator: Decomposition  │
│  • Evaluator: Refinement        │
│  • Assistant: Simple Q&A        │
└─────────────────────────────────┘
    ↓
HTTP Request to A2A Server
    ↓
A2A Server executes workflow
    ↓
Response aggregated and returned
```

## Data Flow

### Input Processing

```
Raw Input (from MCP Client)
    ↓
JSON Schema Validation (MCP SDK)
    ↓
Zod Schema Validation (Agent)
    ↓
Type-safe Input Object
```

### Output Processing

```
Agent Result
    ↓
ToolExecutionResult {
  success: boolean,
  data?: T,
  error?: string,
  metadata?: { ... }
}
    ↓
MCP Response Format
    ↓
Client receives structured result
```

## Key Components

### BaseAgent

**Responsibilities**:
- Abstract base class for all agents
- Input validation with Zod
- SubAgent orchestration access
- A2A client access
- Standardized error handling
- Logging integration

**Interface**:
```typescript
abstract class BaseAgent {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: z.ZodSchema;
  abstract config: AgentConfig;
  abstract execute(input, context): Promise<ToolExecutionResult>;
}
```

### SubAgentOrchestrator

**Responsibilities**:
- Manage parallel subagent execution
- Resolve task dependencies
- Aggregate results
- Handle failures gracefully

**Key Methods**:
```typescript
- executeParallel(tasks, context, executor)
- resolveDependencyLevels(tasks)
- aggregateResults(results, aggregator)
```

### A2AClient

**Responsibilities**:
- Manage connection to A2A server
- Execute workflows
- Health monitoring
- Error handling and retries

**Workflow Methods**:
```typescript
- executeChaining(message)
- executeParallel(message)
- executeRouter(message)
- executeOrchestrator(message)
- executeEvaluatorOptimizer(message)
- executeSimpleAssistant(message)
```

## Scaling Considerations

### Horizontal Scaling

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  MCP Server │     │  MCP Server │     │  MCP Server │
│  Instance 1 │     │  Instance 2 │     │  Instance N │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                  ┌────────▼────────┐
                  │  Load Balancer  │
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │  A2A Server     │
                  │  (Stateless)    │
                  └─────────────────┘
```

### Resource Management

- **CPU**: Each agent can use up to 4 concurrent subagents
- **Memory**: Streaming responses for large outputs
- **Network**: Connection pooling to A2A server
- **Timeouts**: Configurable per agent (default: 60-120s)

## Error Handling

### Error Hierarchy

```
Try Agent Execution
    ↓
Input Validation Error?
    → Return validation error
    ↓
Execute Subagents
    ↓
Subagent Failed?
    → Mark as failed, continue others
    ↓
A2A Call Failed?
    → Fallback to local processing
    ↓
All Failed?
    → Return aggregated error
    ↓
Success → Return result
```

### Retry Strategy

- **A2A Connection**: Exponential backoff (3 retries)
- **Subagent Execution**: No retry (fail fast)
- **Workflow Execution**: Single retry with fallback

## Performance Optimization

### 1. Parallel Execution
- Up to 4 concurrent subagents per tool
- Dependency-aware scheduling
- P-limit for concurrency control

### 2. Caching
- A2A client connection pooling
- Agent instance reuse
- Schema validation caching (Zod)

### 3. Resource Limits
- Configurable timeouts
- Memory-efficient streaming
- Graceful degradation

## Security

### Input Validation
- Zod schema validation for all inputs
- Type checking at runtime
- Sanitization of user inputs

### Communication Security
- HTTPS for A2A communication (production)
- No secrets in logs
- Environment-based configuration

### Agent Isolation
- Each agent runs in isolated context
- No shared state between requests
- Clean execution contexts

## Monitoring and Observability

### Metrics
- Agent execution count
- Success/failure rates
- Execution duration
- Subagent utilization

### Logs
- Structured JSON logging (Winston)
- Log levels: debug, info, warn, error
- Context propagation (sessionId)

### Health Checks
- Server health endpoint
- A2A connectivity check
- Agent availability status

## Extension Points

### Adding New Agents
1. Extend BaseAgent
2. Implement required methods
3. Register in AGENT_CLASSES
4. Add metadata in AGENT_METADATA

### Custom Workflows
1. Add new method in A2AClient
2. Implement workflow in A2A server
3. Use in agent execution

### Custom Subagent Executors
1. Implement executor function
2. Pass to orchestrator.executeParallel()
3. Handle results in aggregator

## Future Enhancements

- [ ] Streaming responses for long operations
- [ ] Agent-to-agent direct communication
- [ ] Persistent agent state (Durable Objects)
- [ ] Multi-tenant support
- [ ] Rate limiting per agent
- [ ] Cost tracking and optimization
- [ ] Agent composition DSL
- [ ] Visual workflow builder

---

**Version**: 1.0.0
**Last Updated**: 2025-01-13

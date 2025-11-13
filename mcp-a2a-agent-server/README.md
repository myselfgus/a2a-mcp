# MCP A2A Agent Server

A production-ready Model Context Protocol (MCP) server featuring 12 specialized AI agents with A2A (Agent-to-Agent) integration and Claude Agents SDK orchestration capabilities.

## 🌟 Features

- **12 Specialized Agents**: Production-ready agents for various domains
- **A2A Integration**: Seamless integration with A2A multi-workflow server
- **Parallel Execution**: Up to 4 concurrent subagents per tool with dependency resolution
- **Claude Agents SDK**: Built using Claude's official agent framework
- **Type-Safe**: Full TypeScript implementation with Zod validation
- **Production Ready**: Comprehensive logging, error handling, and monitoring
- **Docker Support**: Complete containerization with docker-compose orchestration
- **Composable Tools**: Agents can be combined and chained for complex workflows

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (optional, for containerized deployment)
- Python 3.13+ (for A2A server)

### Installation

```bash
# Clone the repository
cd mcp-a2a-agent-server

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Build the project
npm run build
```

### Running with Docker Compose (Recommended)

```bash
# Start both A2A server and MCP server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Running Locally

```bash
# Terminal 1: Start A2A server (from parent directory)
cd ..
python a2a_multi_workflow_server.py

# Terminal 2: Start MCP server
npm start
```

### Development Mode

```bash
npm run dev
```

## 🤖 Available Agents

### 1. A2A Server Manager
**Category**: Infrastructure
**Purpose**: Manages A2A server connections and workflow routing

```json
{
  "action": "status" | "health_check" | "test_workflow" | "list_workflows",
  "workflow": "chaining" | "parallel" | "router" | "orchestrator" | "evaluator_optimizer" | "simple_assistant",
  "testMessage": "string"
}
```

**Use Cases**:
- Check A2A server connectivity
- Test specific workflows
- Monitor server health

---

### 2. Code Analyst Agent
**Category**: Development
**Purpose**: Deep code analysis with parallel quality, security, performance, and maintainability checks

```json
{
  "code": "string",
  "language": "string (optional)",
  "aspects": ["quality", "security", "performance", "maintainability", "all"]
}
```

**Features**:
- 4 parallel analysis perspectives
- OWASP security checks
- Performance bottleneck detection
- Code quality metrics

---

### 3. Research Agent
**Category**: Intelligence
**Purpose**: Multi-perspective research with parallel analysis

```json
{
  "topic": "string",
  "perspectives": ["technical", "business", "user", "competitive", "all"],
  "depth": "quick" | "standard" | "deep"
}
```

**Features**:
- Parallel research from 4 perspectives
- Synthesis of findings
- Actionable insights

---

### 4. Task Orchestrator Agent
**Category**: Orchestration
**Purpose**: Complex task decomposition with dependency-aware execution

```json
{
  "task": "string",
  "maxSubtasks": 1-4,
  "executionMode": "plan_only" | "plan_and_execute"
}
```

**Features**:
- Intelligent task decomposition
- Dependency resolution
- Parallel subtask execution
- Result synthesis

---

### 5. Content Generator Agent
**Category**: Content
**Purpose**: Multi-format content generation with iterative refinement

```json
{
  "topic": "string",
  "formats": ["blog", "social", "technical", "marketing", "email", "all"],
  "tone": "professional" | "casual" | "technical" | "persuasive" | "educational",
  "length": "short" | "medium" | "long",
  "optimize": true | false
}
```

**Outputs**:
- Blog posts
- Social media content
- Technical documentation
- Marketing copy
- Email campaigns

---

### 6. Data Processor Agent
**Category**: Data
**Purpose**: Data processing, transformation, and analysis

```json
{
  "data": "any",
  "operations": ["validate", "transform", "aggregate", "analyze", "visualize", "all"],
  "outputFormat": "json" | "csv" | "summary" | "report",
  "customRules": "string (optional)"
}
```

**Capabilities**:
- Data validation
- Transformation pipelines
- Statistical analysis
- Report generation

---

### 7. Testing Agent
**Category**: QA
**Purpose**: Comprehensive test generation

```json
{
  "target": "string",
  "testTypes": ["unit", "integration", "e2e", "performance", "security", "all"],
  "framework": "string (optional)",
  "coverage": "basic" | "comprehensive" | "exhaustive"
}
```

**Generates**:
- Unit tests
- Integration tests
- E2E test scenarios
- Performance benchmarks
- Security tests

---

### 8. Documentation Agent
**Category**: Documentation
**Purpose**: Multi-format documentation generation

```json
{
  "target": "string",
  "docTypes": ["api", "user_guide", "architecture", "tutorial", "readme", "all"],
  "format": "markdown" | "html" | "pdf" | "json",
  "audience": "developer" | "user" | "admin" | "mixed"
}
```

**Produces**:
- API documentation
- User guides
- Architecture docs
- Tutorials
- README files

---

### 9. Optimization Agent
**Category**: Optimization
**Purpose**: Iterative optimization with evaluator-optimizer pattern

```json
{
  "target": "string",
  "optimizationTypes": ["performance", "memory", "cost", "scalability", "all"],
  "iterations": 1-5,
  "constraints": "string (optional)"
}
```

**Optimizes**:
- Performance
- Memory usage
- Cost efficiency
- Scalability

---

### 10. Integration Agent
**Category**: Integration
**Purpose**: System integration design and implementation

```json
{
  "sourceSystem": "string",
  "targetSystem": "string",
  "integrationType": "api" | "database" | "file" | "stream" | "webhook" | "auto",
  "requirements": "string (optional)",
  "generateCode": true | false
}
```

**Delivers**:
- Integration architecture
- Connector code
- Transformation logic
- Error handling
- Tests

---

### 11. Security Audit Agent
**Category**: Security
**Purpose**: Comprehensive security audits

```json
{
  "target": "string",
  "auditTypes": ["owasp", "dependencies", "secrets", "compliance", "infrastructure", "all"],
  "complianceFrameworks": ["SOC2", "GDPR", "HIPAA"],
  "depth": "quick" | "standard" | "comprehensive"
}
```

**Audits**:
- OWASP Top 10
- Dependency vulnerabilities
- Secret scanning
- Compliance checks
- Infrastructure security

---

### 12. Deployment Agent
**Category**: DevOps
**Purpose**: End-to-end deployment orchestration

```json
{
  "application": "string",
  "environment": "development" | "staging" | "production" | "all",
  "platform": "kubernetes" | "docker" | "serverless" | "vm" | "auto",
  "components": ["cicd", "infrastructure", "monitoring", "security", "all"],
  "strategy": "blue_green" | "canary" | "rolling" | "recreate"
}
```

**Generates**:
- CI/CD pipelines
- Infrastructure as Code
- Monitoring setup
- Security policies
- Deployment runbooks

---

## 🏗️ Architecture

### Core Components

```
mcp-a2a-agent-server/
├── src/
│   ├── agents/           # 12 specialized agents
│   │   ├── base-agent.ts # Base agent class
│   │   ├── 01-a2a-server-manager.ts
│   │   ├── 02-code-analyst-agent.ts
│   │   ├── ... (10 more agents)
│   │   └── index.ts      # Agent registry
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   ├── utils/            # Utilities
│   │   ├── logger.ts              # Winston logger
│   │   ├── a2a-client.ts          # A2A integration
│   │   └── subagent-orchestrator.ts  # Parallel execution
│   └── index.ts          # MCP server entry point
├── docker-compose.yml    # Orchestration
├── Dockerfile           # Container build
├── package.json
└── tsconfig.json
```

### Subagent Orchestration

Each agent can spawn up to 4 subagents with:
- **Parallel Execution**: Independent tasks run concurrently
- **Dependency Resolution**: Tasks execute in correct order
- **Result Aggregation**: Intelligent synthesis of subagent outputs

```typescript
// Example: Code Analyst spawns 4 parallel subagents
const tasks = [
  { name: 'quality_analysis', prompt: '...' },
  { name: 'security_analysis', prompt: '...' },
  { name: 'performance_analysis', prompt: '...' },
  { name: 'maintainability_analysis', prompt: '...' },
];

const results = await orchestrator.executeParallel(tasks, context, executor);
```

### A2A Workflows

The server integrates with 6 A2A workflows:

1. **Chaining**: Sequential processing with output feeding forward
2. **Parallel**: Concurrent multi-perspective analysis
3. **Router**: Intelligent routing to specialized agents
4. **Orchestrator**: Dynamic task decomposition
5. **Evaluator-Optimizer**: Iterative refinement
6. **Simple Assistant**: Basic Q&A

## 🔧 Configuration

### Environment Variables

```bash
# Node Environment
NODE_ENV=development|production

# Logging
LOG_LEVEL=debug|info|warn|error

# A2A Server
A2A_ENABLED=true|false
A2A_HOST=localhost
A2A_PORT=9999

# Agent Settings
MAX_SUBAGENTS=4
AGENT_TIMEOUT_MS=120000
```

### MCP Client Configuration

Add to your MCP settings (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "a2a-agent-server": {
      "command": "node",
      "args": ["/path/to/mcp-a2a-agent-server/dist/index.js"],
      "env": {
        "A2A_ENABLED": "true",
        "A2A_HOST": "localhost",
        "A2A_PORT": "9999"
      }
    }
  }
}
```

## 📊 Monitoring

### Health Check

```bash
# Call server_health tool
{
  "name": "server_health"
}
```

**Returns**:
```json
{
  "status": "healthy",
  "uptime": 123456,
  "a2aServerConnected": true,
  "activeAgents": 12,
  "agents": ["a2a_server_manager", "code_analyst", ...],
  "metadata": {
    "version": "1.0.0",
    "nodeVersion": "v20.0.0",
    "platform": "linux",
    "memory": { ... }
  }
}
```

### Logs

```bash
# View logs in Docker
docker-compose logs -f mcp-agent-server

# Local logs
tail -f logs/combined.log
tail -f logs/error.log
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint
```

## 🛠️ Development

### Adding a New Agent

1. Create agent file in `src/agents/`:

```typescript
import { z } from 'zod';
import { BaseAgent } from './base-agent.js';

export class MyCustomAgent extends BaseAgent {
  name = 'my_custom_agent';
  description = 'Description of what this agent does';

  inputSchema = z.object({
    input: z.string(),
  });

  config = { /* ... */ };

  async execute(input, context) {
    // Implementation
  }
}
```

2. Register in `src/agents/index.ts`:

```typescript
export { MyCustomAgent } from './13-my-custom-agent.js';

export const AGENT_CLASSES = [
  // ... existing agents
  MyCustomAgent,
];
```

3. Rebuild and test:

```bash
npm run build
npm start
```

## 📚 Examples

### Example 1: Code Analysis

```json
{
  "tool": "code_analyst",
  "arguments": {
    "code": "function add(a, b) { return a + b; }",
    "language": "javascript",
    "aspects": ["quality", "security", "performance"]
  }
}
```

### Example 2: Research with Synthesis

```json
{
  "tool": "research_agent",
  "arguments": {
    "topic": "Microservices architecture best practices",
    "perspectives": ["technical", "business", "user"],
    "depth": "comprehensive"
  }
}
```

### Example 3: Task Orchestration

```json
{
  "tool": "task_orchestrator",
  "arguments": {
    "task": "Build a REST API with authentication, rate limiting, and comprehensive documentation",
    "maxSubtasks": 4,
    "executionMode": "plan_and_execute"
  }
}
```

## 🔐 Security

- All inputs validated with Zod schemas
- Secure communication with A2A server
- No secrets in logs or responses
- Rate limiting supported via A2A server
- OWASP security checks in Code Analyst and Security Audit agents

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes with tests
4. Run `npm run lint` and `npm test`
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Built with [MCP SDK](https://github.com/anthropics/modelcontextprotocol)
- Uses [Claude Agents SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- A2A protocol implementation
- Anthropic's AI agent patterns

## 📞 Support

- Documentation: See this README
- Issues: [GitHub Issues](https://github.com/your-repo/issues)
- Discussions: [GitHub Discussions](https://github.com/your-repo/discussions)

---

**Built with ❤️ using Claude Agents SDK and A2A Protocol**

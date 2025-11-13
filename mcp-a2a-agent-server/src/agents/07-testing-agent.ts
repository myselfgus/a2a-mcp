import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';

/**
 * Testing Agent
 * Generates and executes comprehensive tests using parallel subagents
 */
export class TestingAgent extends BaseAgent {
  name = 'testing_agent';
  description = 'Generates comprehensive test suites including unit, integration, e2e, and performance tests with parallel execution.';

  inputSchema = z.object({
    target: z.string().describe('Code or system to test'),
    testTypes: z.array(z.enum(['unit', 'integration', 'e2e', 'performance', 'security', 'all'])).default(['all']),
    framework: z.string().optional().describe('Testing framework (e.g., jest, vitest, pytest)'),
    coverage: z.enum(['basic', 'comprehensive', 'exhaustive']).default('comprehensive'),
  });

  config: AgentConfig = {
    name: this.name,
    description: this.description,
    capabilities: {
      maxSubAgents: 4,
      supportsParallelization: true,
      supportsStreaming: false,
      timeoutMs: 90000,
    },
  };

  async execute(input: unknown, context: AgentExecutionContext): Promise<ToolExecutionResult> {
    const params = this.validateInput<z.infer<typeof this.inputSchema>>(input);

    this.log('info', 'Starting test generation', {
      testTypes: params.testTypes,
      coverage: params.coverage,
      sessionId: context.sessionId,
    });

    try {
      const testTypesToGenerate = params.testTypes.includes('all')
        ? ['unit', 'integration', 'e2e', 'performance']
        : params.testTypes;

      // Create parallel test generation tasks
      const tasks = SubAgentOrchestrator.createTasks(
        testTypesToGenerate.map(testType => ({
          name: `${testType}_tests`,
          prompt: this.generateTestPrompt(testType, params.target, params.framework, params.coverage),
        }))
      );

      // Generate tests in parallel
      const results = await this.executeSubAgents(tasks, context, async (task) => {
        if (this.a2aClient) {
          return await this.a2aClient.executeOrchestrator(task.prompt);
        }
        return this.generateFallbackTests(task.name, params.target);
      });

      // Aggregate test suites
      const testSuites = SubAgentOrchestrator.aggregateResults(results, (data) => {
        const aggregated: Record<string, any> = {};
        data.forEach((item, idx) => {
          const testType = testTypesToGenerate[idx];
          aggregated[testType] = item;
        });
        return aggregated;
      });

      // Generate test execution plan
      const executionPlan = this.generateExecutionPlan(testSuites, params.framework);

      return this.success({
        target: params.target,
        testSuites,
        executionPlan,
        metadata: {
          testTypesGenerated: testTypesToGenerate.length,
          coverage: params.coverage,
          framework: params.framework || 'auto-detected',
        },
      }, {
        subAgentsUsed: results.length,
      });
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private generateTestPrompt(testType: string, target: string, framework?: string, coverage?: string): string {
    const frameworkHint = framework ? ` using ${framework}` : '';
    const coverageGuidance = {
      basic: 'Cover main happy paths and critical error cases',
      comprehensive: 'Cover happy paths, error cases, edge cases, and boundary conditions',
      exhaustive: 'Cover all possible scenarios including edge cases, error cases, boundary conditions, and negative tests',
    };

    const prompts: Record<string, string> = {
      unit: `Generate comprehensive unit tests${frameworkHint} for:

${target}

Requirements:
- ${coverageGuidance[coverage as keyof typeof coverageGuidance]}
- Test individual functions/methods in isolation
- Mock dependencies appropriately
- Include setup and teardown
- Test data validation
- Error handling tests
- Assertion clarity

Provide complete, runnable test code.`,

      integration: `Generate integration tests${frameworkHint} for:

${target}

Requirements:
- Test component interactions
- Verify data flow between modules
- Test API endpoints and responses
- Database integration tests
- External service mocking
- ${coverageGuidance[coverage as keyof typeof coverageGuidance]}

Provide complete test suite with setup.`,

      e2e: `Generate end-to-end tests${frameworkHint} for:

${target}

Requirements:
- Test complete user workflows
- Multi-step scenarios
- Cross-browser compatibility (if applicable)
- Authentication flows
- Error scenarios and recovery
- ${coverageGuidance[coverage as keyof typeof coverageGuidance]}

Provide complete E2E test scenarios.`,

      performance: `Generate performance tests${frameworkHint} for:

${target}

Requirements:
- Load testing scenarios
- Response time benchmarks
- Memory usage profiling
- Concurrent user simulation
- Stress testing
- Resource utilization metrics
- Performance baselines and thresholds

Provide performance test suite.`,

      security: `Generate security tests for:

${target}

Requirements:
- Authentication/authorization tests
- Input validation and sanitization
- SQL injection tests
- XSS vulnerability tests
- CSRF protection tests
- Rate limiting tests
- Sensitive data exposure checks

Provide security test suite.`,
    };

    return prompts[testType] || prompts.unit;
  }

  private generateFallbackTests(testType: string, target: string): Record<string, any> {
    return {
      testType,
      tests: [
        {
          name: `${testType}_basic_test`,
          description: `Basic ${testType} test for ${target}`,
          code: `// ${testType} test template\ntest('basic ${testType} test', () => {\n  // Test implementation\n});`,
        },
      ],
      note: 'Template tests - A2A server unavailable',
    };
  }

  private generateExecutionPlan(testSuites: Record<string, any>, framework?: string): Record<string, any> {
    const testTypes = Object.keys(testSuites);

    return {
      framework: framework || 'auto-detect',
      executionOrder: [
        'unit',      // Fast, run first
        'integration', // Medium speed
        'performance', // Slower
        'e2e',       // Slowest, run last
        'security',  // Can run in parallel with others
      ].filter(type => testTypes.includes(type)),
      parallelizable: ['unit', 'security'],
      sequential: ['integration', 'e2e'],
      estimatedDuration: this.estimateDuration(testTypes),
      recommendations: [
        'Run unit tests on every commit',
        'Run integration tests pre-merge',
        'Run E2E tests before deployment',
        'Run performance tests periodically',
        'Run security tests in CI/CD pipeline',
      ],
    };
  }

  private estimateDuration(testTypes: string[]): string {
    const durations: Record<string, number> = {
      unit: 1,
      integration: 5,
      e2e: 15,
      performance: 30,
      security: 10,
    };

    const total = testTypes.reduce((sum, type) => sum + (durations[type] || 0), 0);
    return `${total} minutes (estimated)`;
  }
}

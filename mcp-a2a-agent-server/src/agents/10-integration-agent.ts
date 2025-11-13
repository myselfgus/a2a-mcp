import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';

/**
 * Integration Agent
 * Designs and implements system integrations using orchestrator pattern
 */
export class IntegrationAgent extends BaseAgent {
  name = 'integration_agent';
  description = 'Designs and implements integrations between systems, APIs, and services with parallel connector generation and testing.';

  inputSchema = z.object({
    sourceSystem: z.string().describe('The source system to integrate from'),
    targetSystem: z.string().describe('The target system to integrate to'),
    integrationType: z.enum(['api', 'database', 'file', 'stream', 'webhook', 'auto']).default('auto'),
    requirements: z.string().optional().describe('Specific integration requirements'),
    generateCode: z.boolean().default(true).describe('Generate integration code'),
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

    this.log('info', 'Starting integration design', {
      sourceSystem: params.sourceSystem,
      targetSystem: params.targetSystem,
      type: params.integrationType,
      sessionId: context.sessionId,
    });

    try {
      // Step 1: Analyze both systems in parallel
      const analysisTasks = SubAgentOrchestrator.createTasks([
        {
          name: 'source_analysis',
          prompt: this.generateSystemAnalysisPrompt(params.sourceSystem, 'source'),
        },
        {
          name: 'target_analysis',
          prompt: this.generateSystemAnalysisPrompt(params.targetSystem, 'target'),
        },
        {
          name: 'integration_strategy',
          prompt: this.generateStrategyPrompt(
            params.sourceSystem,
            params.targetSystem,
            params.integrationType,
            params.requirements
          ),
        },
      ]);

      const analysisResults = await this.executeSubAgents(analysisTasks, context, async (task) => {
        if (this.a2aClient) {
          return await this.a2aClient.executeRouter(task.prompt);
        }
        return this.generateFallbackAnalysis(task.name);
      });

      const [sourceAnalysis, targetAnalysis, integrationStrategy] = analysisResults.map(r => r.data);

      // Step 2: Design integration architecture
      const architecture = await this.designArchitecture(
        sourceAnalysis,
        targetAnalysis,
        integrationStrategy,
        params
      );

      // Step 3: Generate integration components in parallel (if requested)
      let implementationComponents = null;
      if (params.generateCode) {
        const componentTasks = SubAgentOrchestrator.createTasks([
          {
            name: 'connector_code',
            prompt: this.generateConnectorPrompt(architecture, params),
          },
          {
            name: 'transformation_logic',
            prompt: this.generateTransformationPrompt(architecture, params),
          },
          {
            name: 'error_handling',
            prompt: this.generateErrorHandlingPrompt(architecture),
          },
          {
            name: 'tests',
            prompt: this.generateTestsPrompt(architecture),
          },
        ]);

        const componentResults = await this.executeSubAgents(componentTasks, context, async (task) => {
          if (this.a2aClient) {
            return await this.a2aClient.executeOrchestrator(task.prompt);
          }
          return `// ${task.name} implementation\n// Generated code would go here`;
        });

        implementationComponents = {
          connector: componentResults[0].data,
          transformation: componentResults[1].data,
          errorHandling: componentResults[2].data,
          tests: componentResults[3].data,
        };
      }

      // Step 4: Generate deployment guide
      const deploymentGuide = await this.generateDeploymentGuide(architecture, params);

      return this.success({
        integration: {
          source: params.sourceSystem,
          target: params.targetSystem,
          type: params.integrationType,
        },
        analysis: {
          source: sourceAnalysis,
          target: targetAnalysis,
          strategy: integrationStrategy,
        },
        architecture,
        implementation: implementationComponents,
        deploymentGuide,
      }, {
        subAgentsUsed: analysisResults.length + (implementationComponents ? 4 : 0),
      });
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private generateSystemAnalysisPrompt(system: string, role: 'source' | 'target'): string {
    return `Analyze the ${role} system for integration: ${system}

Provide:
1. System type and capabilities
2. Available APIs/interfaces
3. Data formats and schemas
4. Authentication methods
5. Rate limits and constraints
6. Best practices for integration

Focus on aspects relevant for ${role === 'source' ? 'reading/extracting data' : 'writing/sending data'}.`;
  }

  private generateStrategyPrompt(
    source: string,
    target: string,
    type: string,
    requirements?: string
  ): string {
    const reqSection = requirements ? `\n\nRequirements:\n${requirements}` : '';

    return `Design an integration strategy between:
Source: ${source}
Target: ${target}
Type: ${type}

Determine:
1. Optimal integration pattern (request-response, pub-sub, batch, streaming)
2. Data flow direction and frequency
3. Synchronization approach (real-time, scheduled, event-driven)
4. Data transformation needs
5. Error handling strategy
6. Monitoring and alerting approach${reqSection}

Provide a comprehensive integration strategy.`;
  }

  private async designArchitecture(
    sourceAnalysis: any,
    targetAnalysis: any,
    strategy: any,
    params: any
  ): Promise<any> {
    const architecturePrompt = `Design integration architecture:

Source Analysis:
${JSON.stringify(sourceAnalysis, null, 2)}

Target Analysis:
${JSON.stringify(targetAnalysis, null, 2)}

Strategy:
${JSON.stringify(strategy, null, 2)}

Provide:
1. Component diagram (textual description)
2. Data flow specification
3. Technology stack recommendations
4. Scalability considerations
5. Security measures
6. Failure recovery mechanisms`;

    if (this.a2aClient) {
      try {
        const result = await this.a2aClient.executeOrchestrator(architecturePrompt);
        try {
          return JSON.parse(result);
        } catch {
          return { description: result, type: 'text' };
        }
      } catch (error) {
        this.log('warn', 'Architecture design failed', { error });
      }
    }

    return {
      components: ['connector', 'transformer', 'error_handler', 'monitor'],
      pattern: params.integrationType,
      note: 'Template architecture - A2A server unavailable',
    };
  }

  private generateConnectorPrompt(architecture: any, params: any): string {
    return `Generate connector code for integration:

Architecture:
${JSON.stringify(architecture, null, 2)}

Source: ${params.sourceSystem}
Target: ${params.targetSystem}

Generate production-ready connector code with:
1. Connection management
2. Authentication handling
3. Request/response handling
4. Connection pooling
5. Retry logic`;
  }

  private generateTransformationPrompt(architecture: any, params: any): string {
    return `Generate data transformation logic for:

Architecture:
${JSON.stringify(architecture, null, 2)}

Include:
1. Schema mapping
2. Data type conversions
3. Field transformations
4. Validation logic
5. Enrichment logic`;
  }

  private generateErrorHandlingPrompt(architecture: any): string {
    return `Generate comprehensive error handling for integration:

Architecture:
${JSON.stringify(architecture, null, 2)}

Include:
1. Error classification
2. Retry strategies
3. Circuit breaker pattern
4. Logging and alerting
5. Graceful degradation`;
  }

  private generateTestsPrompt(architecture: any): string {
    return `Generate integration tests:

Architecture:
${JSON.stringify(architecture, null, 2)}

Include:
1. Unit tests for transformations
2. Integration tests for connectors
3. End-to-end flow tests
4. Error scenario tests
5. Performance tests`;
  }

  private async generateDeploymentGuide(architecture: any, params: any): Promise<string> {
    const guidePrompt = `Generate deployment guide for integration:

Architecture:
${JSON.stringify(architecture, null, 2)}

Source: ${params.sourceSystem}
Target: ${params.targetSystem}

Include:
1. Prerequisites
2. Configuration steps
3. Deployment checklist
4. Verification procedures
5. Rollback plan
6. Monitoring setup`;

    if (this.a2aClient) {
      try {
        return await this.a2aClient.executeChaining(guidePrompt);
      } catch (error) {
        this.log('warn', 'Deployment guide generation failed', { error });
      }
    }

    return `# Integration Deployment Guide\n\n## Prerequisites\n[Prerequisites here]\n\n## Deployment\n[Steps here]`;
  }

  private generateFallbackAnalysis(analysisName: string): Record<string, any> {
    return {
      analysis: analysisName,
      status: 'template',
      note: 'A2A server unavailable - using template',
    };
  }
}

import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';

/**
 * Deployment Agent
 * Orchestrates deployment processes including CI/CD, infrastructure, and monitoring setup
 */
export class DeploymentAgent extends BaseAgent {
  name = 'deployment_agent';
  description = 'Orchestrates deployments including CI/CD pipeline setup, infrastructure provisioning, monitoring, and rollback strategies using parallel workflows.';

  inputSchema = z.object({
    application: z.string().describe('Application or service to deploy'),
    environment: z.enum(['development', 'staging', 'production', 'all']).default('staging'),
    platform: z.enum(['kubernetes', 'docker', 'serverless', 'vm', 'auto']).default('auto'),
    components: z.array(z.enum(['cicd', 'infrastructure', 'monitoring', 'security', 'all'])).default(['all']),
    strategy: z.enum(['blue_green', 'canary', 'rolling', 'recreate']).default('rolling'),
  });

  config: AgentConfig = {
    name: this.name,
    description: this.description,
    capabilities: {
      maxSubAgents: 4,
      supportsParallelization: true,
      supportsStreaming: false,
      timeoutMs: 120000,
    },
  };

  async execute(input: unknown, context: AgentExecutionContext): Promise<ToolExecutionResult> {
    const params = this.validateInput<z.infer<typeof this.inputSchema>>(input);

    this.log('info', 'Starting deployment orchestration', {
      application: params.application,
      environment: params.environment,
      platform: params.platform,
      sessionId: context.sessionId,
    });

    try {
      const componentsToGenerate = params.components.includes('all')
        ? ['cicd', 'infrastructure', 'monitoring', 'security']
        : params.components;

      // Step 1: Analyze application and requirements
      const requirements = await this.analyzeRequirements(
        params.application,
        params.platform,
        params.environment
      );

      // Step 2: Generate deployment components in parallel
      const componentTasks = SubAgentOrchestrator.createTasks(
        componentsToGenerate.map(component => ({
          name: `${component}_config`,
          prompt: this.generateComponentPrompt(
            component,
            params,
            requirements
          ),
          dependencies: component === 'monitoring' ? ['infrastructure_config'] : [],
        }))
      );

      const componentResults = await this.executeSubAgents(componentTasks, context, async (task) => {
        if (this.a2aClient) {
          return await this.a2aClient.executeOrchestrator(task.prompt);
        }
        return this.generateFallbackComponent(task.name, params);
      });

      const deploymentComponents = SubAgentOrchestrator.aggregateResults(componentResults, (data) => {
        const aggregated: Record<string, any> = {};
        data.forEach((item, idx) => {
          const component = componentsToGenerate[idx];
          aggregated[component] = item;
        });
        return aggregated;
      });

      // Step 3: Generate deployment runbook
      const runbook = await this.generateDeploymentRunbook(
        params,
        requirements,
        deploymentComponents,
        context
      );

      // Step 4: Generate rollback plan
      const rollbackPlan = await this.generateRollbackPlan(
        params,
        deploymentComponents,
        context
      );

      // Step 5: Create verification checklist
      const verificationChecklist = this.createVerificationChecklist(
        params,
        deploymentComponents
      );

      return this.success({
        application: params.application,
        environment: params.environment,
        requirements,
        deploymentComponents,
        runbook,
        rollbackPlan,
        verificationChecklist,
        metadata: {
          componentsGenerated: componentsToGenerate.length,
          platform: params.platform,
          strategy: params.strategy,
        },
      }, {
        subAgentsUsed: componentResults.length,
      });
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async analyzeRequirements(
    application: string,
    platform: string,
    environment: string
  ): Promise<any> {
    const analysisPrompt = `Analyze deployment requirements for:

Application: ${application}
Platform: ${platform}
Environment: ${environment}

Determine:
1. Compute resources needed (CPU, memory, storage)
2. Network requirements (load balancer, CDN, DNS)
3. Database and data storage needs
4. External dependencies and integrations
5. Scaling requirements
6. Security requirements
7. Compliance requirements
8. Monitoring and observability needs

Provide structured requirements.`;

    if (this.a2aClient) {
      try {
        const result = await this.a2aClient.executeRouter(analysisPrompt);
        try {
          return JSON.parse(result);
        } catch {
          return { description: result, type: 'text' };
        }
      } catch (error) {
        this.log('warn', 'Requirements analysis failed', { error });
      }
    }

    return {
      compute: { cpu: '2 cores', memory: '4GB', storage: '20GB' },
      network: ['load_balancer'],
      scaling: { min: 1, max: 5 },
      note: 'Template requirements - A2A server unavailable',
    };
  }

  private generateComponentPrompt(
    component: string,
    params: any,
    requirements: any
  ): string {
    const prompts: Record<string, string> = {
      cicd: `Generate CI/CD pipeline configuration for:

Application: ${params.application}
Platform: ${params.platform}
Environment: ${params.environment}

Requirements:
${JSON.stringify(requirements, null, 2)}

Generate:
1. Build pipeline configuration
2. Test stages (unit, integration, E2E)
3. Security scanning stages
4. Deployment stages
5. Environment-specific configurations
6. Secrets management
7. Rollback automation

Provide configuration files for popular CI/CD platforms (GitHub Actions, GitLab CI, Jenkins).`,

      infrastructure: `Generate infrastructure as code for:

Application: ${params.application}
Platform: ${params.platform}
Environment: ${params.environment}
Deployment Strategy: ${params.strategy}

Requirements:
${JSON.stringify(requirements, null, 2)}

Generate:
1. Compute resources (containers, VMs, serverless)
2. Networking (VPC, subnets, security groups)
3. Load balancers and routing
4. Auto-scaling configuration
5. Storage provisioning
6. Database setup
7. Service mesh (if applicable)

Provide IaC templates (Terraform, CloudFormation, or Kubernetes manifests).`,

      monitoring: `Generate monitoring and observability setup for:

Application: ${params.application}
Platform: ${params.platform}
Environment: ${params.environment}

Generate:
1. Metrics collection (Prometheus, CloudWatch, etc.)
2. Logging aggregation (ELK, Loki, etc.)
3. Distributed tracing (Jaeger, Zipkin)
4. Dashboards (Grafana, CloudWatch)
5. Alerting rules
6. SLIs and SLOs
7. Health check endpoints

Provide configuration files and setup instructions.`,

      security: `Generate security configuration for deployment:

Application: ${params.application}
Platform: ${params.platform}
Environment: ${params.environment}

Generate:
1. Network security policies
2. IAM roles and policies
3. Secrets management setup
4. TLS/SSL configuration
5. Container security policies
6. Runtime security monitoring
7. Compliance checks

Provide security configuration files and policies.`,
    };

    return prompts[component] || prompts.infrastructure;
  }

  private async generateDeploymentRunbook(
    params: any,
    requirements: any,
    components: Record<string, any>,
    context: AgentExecutionContext
  ): Promise<any> {
    const runbookPrompt = `Generate deployment runbook for:

Application: ${params.application}
Environment: ${params.environment}
Platform: ${params.platform}
Strategy: ${params.strategy}

Requirements:
${JSON.stringify(requirements, null, 2)}

Components:
${Object.keys(components).join(', ')}

Create step-by-step runbook:
1. Pre-deployment checklist
2. Deployment steps (numbered and detailed)
3. Validation steps after each phase
4. Troubleshooting common issues
5. Communication plan
6. Post-deployment verification
7. Monitoring dashboards to watch

Make it actionable for DevOps engineers.`;

    if (this.a2aClient) {
      try {
        return await this.a2aClient.executeChaining(runbookPrompt);
      } catch (error) {
        this.log('warn', 'Runbook generation failed', { error });
      }
    }

    return `# Deployment Runbook\n\n## Pre-deployment\n- [ ] Backup current version\n\n## Deployment\n- [ ] Deploy new version\n\n## Verification\n- [ ] Check health endpoints`;
  }

  private async generateRollbackPlan(
    params: any,
    components: Record<string, any>,
    context: AgentExecutionContext
  ): Promise<any> {
    const rollbackPrompt = `Generate rollback plan for:

Application: ${params.application}
Environment: ${params.environment}
Strategy: ${params.strategy}

Components deployed:
${Object.keys(components).join(', ')}

Create rollback plan:
1. Rollback triggers (when to rollback)
2. Automated rollback procedures
3. Manual rollback steps
4. Data migration rollback (if applicable)
5. Configuration rollback
6. Verification after rollback
7. Incident communication
8. Post-mortem process

Provide clear rollback procedures.`;

    if (this.a2aClient) {
      try {
        return await this.a2aClient.executeOrchestrator(rollbackPrompt);
      } catch (error) {
        this.log('warn', 'Rollback plan generation failed', { error });
      }
    }

    return {
      triggers: ['Health check failures', 'Error rate spike', 'Performance degradation'],
      steps: ['Stop new traffic', 'Restore previous version', 'Verify rollback'],
    };
  }

  private createVerificationChecklist(
    params: any,
    components: Record<string, any>
  ): any {
    const checklist = [
      {
        category: 'Health',
        checks: [
          'Application health endpoint responds 200',
          'All pods/containers are running',
          'No crash loops detected',
        ],
      },
      {
        category: 'Functionality',
        checks: [
          'Critical user flows working',
          'API endpoints responding correctly',
          'Database connections stable',
        ],
      },
      {
        category: 'Performance',
        checks: [
          'Response times within SLA',
          'Error rate below threshold',
          'Resource utilization normal',
        ],
      },
      {
        category: 'Monitoring',
        checks: [
          'Metrics being collected',
          'Logs flowing to aggregator',
          'Alerts configured and firing',
        ],
      },
    ];

    if (components.security) {
      checklist.push({
        category: 'Security',
        checks: [
          'TLS certificates valid',
          'Security policies applied',
          'No exposed secrets',
        ],
      });
    }

    return {
      deployment: params.strategy,
      environment: params.environment,
      checklist,
      estimatedTime: '15-30 minutes',
    };
  }

  private generateFallbackComponent(componentName: string, params: any): string {
    return `# ${componentName.replace('_', ' ').toUpperCase()}

Configuration for ${params.application} on ${params.platform}

[Generated configuration would go here]

Note: A2A server unavailable - template configuration provided.
`;
  }
}

import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';

/**
 * Documentation Agent
 * Generates comprehensive documentation using parallel subagents
 */
export class DocumentationAgent extends BaseAgent {
  name = 'documentation_agent';
  description = 'Generates comprehensive documentation including API docs, user guides, architecture docs, and tutorials using parallel generation.';

  inputSchema = z.object({
    target: z.string().describe('Code, API, or system to document'),
    docTypes: z.array(z.enum(['api', 'user_guide', 'architecture', 'tutorial', 'readme', 'all'])).default(['all']),
    format: z.enum(['markdown', 'html', 'pdf', 'json']).default('markdown'),
    audience: z.enum(['developer', 'user', 'admin', 'mixed']).default('mixed'),
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

    this.log('info', 'Starting documentation generation', {
      docTypes: params.docTypes,
      format: params.format,
      sessionId: context.sessionId,
    });

    try {
      const docTypesToGenerate = params.docTypes.includes('all')
        ? ['api', 'user_guide', 'architecture', 'readme']
        : params.docTypes;

      // Create parallel documentation tasks
      const tasks = SubAgentOrchestrator.createTasks(
        docTypesToGenerate.map(docType => ({
          name: `${docType}_documentation`,
          prompt: this.generateDocPrompt(docType, params.target, params.audience, params.format),
        }))
      );

      // Generate documentation in parallel
      const results = await this.executeSubAgents(tasks, context, async (task) => {
        if (this.a2aClient) {
          return await this.a2aClient.executeChaining(task.prompt);
        }
        return this.generateFallbackDoc(task.name, params.target);
      });

      // Aggregate documentation
      const documentation = SubAgentOrchestrator.aggregateResults(results, (data) => {
        const aggregated: Record<string, any> = {};
        data.forEach((item, idx) => {
          const docType = docTypesToGenerate[idx];
          aggregated[docType] = item;
        });
        return aggregated;
      });

      // Generate index/navigation
      const navigation = this.generateNavigation(documentation, params.format);

      return this.success({
        target: params.target,
        documentation,
        navigation,
        metadata: {
          docTypesGenerated: docTypesToGenerate.length,
          format: params.format,
          audience: params.audience,
          timestamp: new Date().toISOString(),
        },
      }, {
        subAgentsUsed: results.length,
      });
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private generateDocPrompt(docType: string, target: string, audience: string, format: string): string {
    const audienceGuidance = {
      developer: 'Write for technical developers with code examples and API details',
      user: 'Write for end users with step-by-step instructions and screenshots',
      admin: 'Write for system administrators with configuration and maintenance info',
      mixed: 'Write for a mixed audience with appropriate sections for each',
    };

    const prompts: Record<string, string> = {
      api: `Generate comprehensive API documentation for:

${target}

Include:
1. Overview and introduction
2. Authentication and authorization
3. Endpoints with:
   - HTTP methods
   - Request parameters
   - Request body schemas
   - Response formats
   - Error codes
   - Rate limiting
4. Code examples in multiple languages
5. Best practices
6. Changelog

Audience: ${audienceGuidance[audience as keyof typeof audienceGuidance]}
Format: ${format}`,

      user_guide: `Generate a comprehensive user guide for:

${target}

Include:
1. Getting started
2. Installation/setup
3. Basic usage
4. Advanced features
5. Troubleshooting
6. FAQs
7. Tips and tricks
8. Screenshots/diagrams (descriptions)

Audience: ${audienceGuidance[audience as keyof typeof audienceGuidance]}
Format: ${format}`,

      architecture: `Generate architecture documentation for:

${target}

Include:
1. System overview
2. Architecture diagrams (descriptions)
3. Component breakdown
4. Data flow
5. Technology stack
6. Design patterns used
7. Scalability considerations
8. Security architecture
9. Deployment architecture
10. Integration points

Audience: ${audienceGuidance[audience as keyof typeof audienceGuidance]}
Format: ${format}`,

      tutorial: `Generate a step-by-step tutorial for:

${target}

Include:
1. What you'll learn
2. Prerequisites
3. Step-by-step instructions with code
4. Expected outputs
5. Common pitfalls
6. Next steps
7. Additional resources

Audience: ${audienceGuidance[audience as keyof typeof audienceGuidance]}
Format: ${format}`,

      readme: `Generate a comprehensive README for:

${target}

Include:
1. Project title and description
2. Badges (CI, coverage, version)
3. Features
4. Installation
5. Quick start
6. Usage examples
7. Configuration
8. API reference (brief)
9. Contributing guidelines
10. License
11. Contact/support

Audience: ${audienceGuidance[audience as keyof typeof audienceGuidance]}
Format: ${format}`,
    };

    return prompts[docType] || prompts.readme;
  }

  private generateFallbackDoc(docType: string, target: string): string {
    return `# ${docType.replace('_', ' ').toUpperCase()}

## ${target}

Documentation for ${target}.

This is a template document. Full documentation generation requires A2A server connection.

### Overview

[Overview section]

### Details

[Detailed documentation]

---
Generated: ${new Date().toISOString()}
`;
  }

  private generateNavigation(documentation: Record<string, any>, format: string): any {
    const docTypes = Object.keys(documentation);

    if (format === 'markdown') {
      return {
        type: 'markdown',
        content: `# Documentation Index

${docTypes.map((type, idx) => `${idx + 1}. [${type.replace('_', ' ').toUpperCase()}](#${type})`).join('\n')}

---
`,
      };
    }

    if (format === 'json') {
      return {
        type: 'json',
        sections: docTypes.map(type => ({
          id: type,
          title: type.replace('_', ' ').toUpperCase(),
          link: `#${type}`,
        })),
      };
    }

    return {
      type: 'simple',
      sections: docTypes,
    };
  }
}

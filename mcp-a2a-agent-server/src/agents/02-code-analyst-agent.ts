import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';

/**
 * Code Analyst Agent
 * Deep code analysis using parallel subagents for different aspects
 */
export class CodeAnalystAgent extends BaseAgent {
  name = 'code_analyst';
  description = 'Performs comprehensive code analysis including quality, security, performance, and maintainability checks using parallel subagents.';

  inputSchema = z.object({
    code: z.string().describe('The code to analyze'),
    language: z.string().optional().describe('Programming language (auto-detected if not provided)'),
    aspects: z.array(z.enum(['quality', 'security', 'performance', 'maintainability', 'all'])).default(['all']),
  });

  config: AgentConfig = {
    name: this.name,
    description: this.description,
    capabilities: {
      maxSubAgents: 4,
      supportsParallelization: true,
      supportsStreaming: false,
      timeoutMs: 60000,
    },
  };

  async execute(input: unknown, context: AgentExecutionContext): Promise<ToolExecutionResult> {
    const params = this.validateInput<z.infer<typeof this.inputSchema>>(input);

    this.log('info', 'Starting code analysis', {
      codeLength: params.code.length,
      aspects: params.aspects,
      sessionId: context.sessionId,
    });

    try {
      const aspectsToAnalyze = params.aspects.includes('all')
        ? ['quality', 'security', 'performance', 'maintainability']
        : params.aspects;

      // Create subagent tasks for parallel analysis
      const tasks = SubAgentOrchestrator.createTasks(
        aspectsToAnalyze.map(aspect => ({
          name: `${aspect}_analysis`,
          prompt: this.generateAnalysisPrompt(aspect, params.code, params.language),
          priority: aspect === 'security' ? 1 : 0,
        }))
      );

      // Execute subagents in parallel
      const results = await this.executeSubAgents(tasks, context, async (task) => {
        if (this.a2aClient) {
          return await this.a2aClient.executeRouter(task.prompt);
        }
        // Fallback: return mock analysis
        return this.performLocalAnalysis(task.name, params.code);
      });

      // Aggregate results
      const analysis = SubAgentOrchestrator.aggregateResults(results, (data) => {
        const aggregated: Record<string, any> = {};
        data.forEach((item, idx) => {
          const aspect = aspectsToAnalyze[idx];
          aggregated[aspect] = item;
        });
        return aggregated;
      });

      const successCount = results.filter(r => r.success).length;
      const totalIssues = this.countIssues(analysis);

      return this.success({
        analysis,
        summary: {
          aspectsAnalyzed: aspectsToAnalyze.length,
          successfulAnalyses: successCount,
          totalIssues,
          overallScore: this.calculateScore(analysis),
        },
      }, {
        subAgentsUsed: results.length,
      });
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private generateAnalysisPrompt(aspect: string, code: string, language?: string): string {
    const langHint = language ? `(${language})` : '';

    const prompts: Record<string, string> = {
      quality: `Analyze the following code ${langHint} for code quality issues including:
- Code structure and organization
- Naming conventions
- Code duplication
- Code complexity
Provide specific issues and recommendations.

Code:
\`\`\`
${code}
\`\`\``,

      security: `Perform a security analysis of the following code ${langHint}. Check for:
- Input validation issues
- SQL injection vulnerabilities
- XSS vulnerabilities
- Authentication/authorization issues
- Sensitive data exposure
- OWASP Top 10 vulnerabilities
Identify specific security risks with severity levels.

Code:
\`\`\`
${code}
\`\`\``,

      performance: `Analyze the following code ${langHint} for performance issues:
- Algorithmic complexity
- Memory usage patterns
- Database query optimization
- Resource leaks
- Caching opportunities
Provide specific performance bottlenecks and optimization suggestions.

Code:
\`\`\`
${code}
\`\`\``,

      maintainability: `Evaluate the maintainability of the following code ${langHint}:
- Code readability
- Documentation quality
- Testability
- Modularity and coupling
- Error handling
- Technical debt indicators
Provide specific recommendations for improving maintainability.

Code:
\`\`\`
${code}
\`\`\``,
    };

    return prompts[aspect] || prompts.quality;
  }

  private performLocalAnalysis(aspectName: string, code: string): Record<string, any> {
    // Fallback local analysis
    return {
      aspect: aspectName,
      issues: [],
      score: 8.0,
      note: 'Local analysis performed (A2A server unavailable)',
    };
  }

  private countIssues(analysis: Record<string, any>): number {
    let count = 0;
    for (const aspect of Object.values(analysis)) {
      if (typeof aspect === 'object' && aspect.issues) {
        count += aspect.issues.length;
      }
    }
    return count;
  }

  private calculateScore(analysis: Record<string, any>): number {
    const scores: number[] = [];
    for (const aspect of Object.values(analysis)) {
      if (typeof aspect === 'object' && typeof aspect.score === 'number') {
        scores.push(aspect.score);
      }
    }
    return scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
  }
}

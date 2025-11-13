import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';

/**
 * Optimization Agent
 * Optimizes code, performance, and processes using evaluator-optimizer pattern
 */
export class OptimizationAgent extends BaseAgent {
  name = 'optimization_agent';
  description = 'Optimizes code performance, algorithms, database queries, and system architecture with iterative refinement using parallel analysis.';

  inputSchema = z.object({
    target: z.string().describe('Code, query, or system to optimize'),
    optimizationTypes: z.array(z.enum(['performance', 'memory', 'cost', 'scalability', 'all'])).default(['all']),
    iterations: z.number().min(1).max(5).default(3).describe('Number of optimization iterations'),
    constraints: z.string().optional().describe('Optimization constraints or requirements'),
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

    this.log('info', 'Starting optimization', {
      optimizationTypes: params.optimizationTypes,
      iterations: params.iterations,
      sessionId: context.sessionId,
    });

    try {
      const optimizationTypesToApply = params.optimizationTypes.includes('all')
        ? ['performance', 'memory', 'scalability', 'cost']
        : params.optimizationTypes;

      // Step 1: Analyze current state in parallel
      const analysisTasks = SubAgentOrchestrator.createTasks(
        optimizationTypesToApply.map(type => ({
          name: `${type}_analysis`,
          prompt: this.generateAnalysisPrompt(type, params.target, params.constraints),
        }))
      );

      const analysisResults = await this.executeSubAgents(analysisTasks, context, async (task) => {
        if (this.a2aClient) {
          return await this.a2aClient.executeRouter(task.prompt);
        }
        return this.performLocalAnalysis(task.name, params.target);
      });

      const analyses = SubAgentOrchestrator.aggregateResults(analysisResults, (data) => {
        const aggregated: Record<string, any> = {};
        data.forEach((item, idx) => {
          const type = optimizationTypesToApply[idx];
          aggregated[type] = item;
        });
        return aggregated;
      });

      // Step 2: Iterative optimization using evaluator-optimizer workflow
      let currentVersion = params.target;
      const optimizationHistory: any[] = [];

      for (let i = 0; i < params.iterations; i++) {
        this.log('debug', `Optimization iteration ${i + 1}/${params.iterations}`);

        const optimized = await this.performOptimizationIteration(
          currentVersion,
          analyses,
          optimizationTypesToApply,
          params.constraints,
          i + 1
        );

        optimizationHistory.push({
          iteration: i + 1,
          improvements: optimized.improvements,
          metrics: optimized.metrics,
        });

        currentVersion = optimized.optimizedVersion;

        // Early exit if no more improvements
        if (optimized.improvements.length === 0) {
          this.log('info', 'Optimization converged early', { iteration: i + 1 });
          break;
        }
      }

      // Step 3: Final evaluation
      const finalEvaluation = await this.evaluateFinal(
        params.target,
        currentVersion,
        optimizationHistory
      );

      return this.success({
        original: params.target,
        optimized: currentVersion,
        analyses,
        optimizationHistory,
        finalEvaluation,
        metadata: {
          optimizationTypes: optimizationTypesToApply.length,
          iterations: optimizationHistory.length,
          totalImprovements: optimizationHistory.reduce((sum, h) => sum + h.improvements.length, 0),
        },
      }, {
        subAgentsUsed: analysisResults.length,
      });
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private generateAnalysisPrompt(type: string, target: string, constraints?: string): string {
    const constraintSection = constraints ? `\n\nConstraints:\n${constraints}` : '';

    const prompts: Record<string, string> = {
      performance: `Analyze performance characteristics of:

${target}

Identify:
1. Time complexity bottlenecks
2. Algorithmic inefficiencies
3. I/O operations that can be optimized
4. Caching opportunities
5. Parallelization possibilities

Provide specific performance issues with severity.${constraintSection}`,

      memory: `Analyze memory usage of:

${target}

Identify:
1. Memory leaks
2. Excessive allocations
3. Data structure inefficiencies
4. Caching vs memory tradeoffs
5. Memory pool opportunities

Provide memory optimization opportunities.${constraintSection}`,

      cost: `Analyze cost implications of:

${target}

Identify:
1. Resource usage costs
2. API call costs
3. Storage costs
4. Compute costs
5. Cost optimization opportunities

Provide cost reduction strategies.${constraintSection}`,

      scalability: `Analyze scalability of:

${target}

Identify:
1. Scaling bottlenecks
2. Single points of failure
3. Load distribution issues
4. Database scaling concerns
5. Horizontal vs vertical scaling

Provide scalability improvements.${constraintSection}`,
    };

    return prompts[type] || prompts.performance;
  }

  private async performOptimizationIteration(
    current: string,
    analyses: Record<string, any>,
    types: string[],
    constraints: string | undefined,
    iteration: number
  ): Promise<any> {
    const optimizationPrompt = `Optimize the following based on analysis results:

Current version:
${current}

Analysis results:
${types.map(t => `${t.toUpperCase()}:\n${JSON.stringify(analyses[t], null, 2)}`).join('\n\n')}

${constraints ? `Constraints:\n${constraints}\n` : ''}

Iteration: ${iteration}

Provide:
1. Optimized version of the code/system
2. List of specific improvements made
3. Expected impact metrics

Return as structured data.`;

    if (this.a2aClient) {
      try {
        const result = await this.a2aClient.executeEvaluatorOptimizer(optimizationPrompt);

        // Try to parse structured response
        try {
          return JSON.parse(result);
        } catch {
          // If not JSON, extract from text
          return {
            optimizedVersion: result,
            improvements: ['General optimization applied'],
            metrics: { iteration },
          };
        }
      } catch (error) {
        this.log('warn', 'Optimization iteration failed', { error, iteration });
      }
    }

    return {
      optimizedVersion: current,
      improvements: [],
      metrics: {},
    };
  }

  private async evaluateFinal(
    original: string,
    optimized: string,
    history: any[]
  ): Promise<any> {
    const evaluationPrompt = `Evaluate the optimization results:

Original:
${original.substring(0, 500)}...

Optimized:
${optimized.substring(0, 500)}...

Optimization history:
${JSON.stringify(history, null, 2)}

Provide:
1. Overall improvement percentage
2. Key benefits achieved
3. Potential tradeoffs
4. Remaining optimization opportunities
5. Recommendation (deploy/iterate more)`;

    if (this.a2aClient) {
      try {
        return await this.a2aClient.executeEvaluatorOptimizer(evaluationPrompt);
      } catch (error) {
        this.log('warn', 'Final evaluation failed', { error });
      }
    }

    return {
      improvementPercentage: 'N/A',
      summary: `Completed ${history.length} optimization iterations`,
      recommendation: 'Manual review recommended',
    };
  }

  private performLocalAnalysis(analysisName: string, target: string): Record<string, any> {
    return {
      analysis: analysisName,
      issues: [],
      opportunities: [],
      note: 'Local analysis - A2A server unavailable',
    };
  }
}

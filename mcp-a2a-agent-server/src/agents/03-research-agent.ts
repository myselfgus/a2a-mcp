import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';

/**
 * Research Agent
 * Multi-perspective research using parallel subagents
 */
export class ResearchAgent extends BaseAgent {
  name = 'research_agent';
  description = 'Conducts comprehensive research from multiple perspectives (technical, business, user, competitive) using parallel subagents.';

  inputSchema = z.object({
    topic: z.string().describe('The research topic or question'),
    perspectives: z.array(z.enum(['technical', 'business', 'user', 'competitive', 'all'])).default(['all']),
    depth: z.enum(['quick', 'standard', 'deep']).default('standard'),
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

    this.log('info', 'Starting research', {
      topic: params.topic,
      perspectives: params.perspectives,
      depth: params.depth,
      sessionId: context.sessionId,
    });

    try {
      const perspectivesToResearch = params.perspectives.includes('all')
        ? ['technical', 'business', 'user', 'competitive']
        : params.perspectives;

      // Create parallel research tasks
      const tasks = SubAgentOrchestrator.createTasks(
        perspectivesToResearch.map(perspective => ({
          name: `${perspective}_research`,
          prompt: this.generateResearchPrompt(perspective, params.topic, params.depth),
        }))
      );

      // Execute research in parallel using A2A parallel workflow
      const results = await this.executeSubAgents(tasks, context, async (task) => {
        if (this.a2aClient) {
          // Use parallel workflow for multi-perspective analysis
          return await this.a2aClient.executeParallel(task.prompt);
        }
        return this.performLocalResearch(task.name, params.topic);
      });

      // Aggregate findings
      const research = SubAgentOrchestrator.aggregateResults(results, (data) => {
        const aggregated: Record<string, any> = {};
        data.forEach((item, idx) => {
          const perspective = perspectivesToResearch[idx];
          aggregated[perspective] = item;
        });
        return aggregated;
      });

      // Synthesize insights
      const synthesis = await this.synthesizeFindings(research, params.topic, context);

      return this.success({
        topic: params.topic,
        perspectives: research,
        synthesis,
        metadata: {
          perspectivesResearched: perspectivesToResearch.length,
          depth: params.depth,
        },
      }, {
        subAgentsUsed: results.length,
      });
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private generateResearchPrompt(perspective: string, topic: string, depth: string): string {
    const depthInstructions = {
      quick: 'Provide a brief overview with key points.',
      standard: 'Provide a comprehensive analysis with details and examples.',
      deep: 'Provide an in-depth analysis with extensive details, examples, and references.',
    };

    const prompts: Record<string, string> = {
      technical: `Research the technical aspects of: ${topic}

Focus on:
- Technical architecture and design patterns
- Technologies and tools involved
- Implementation challenges and solutions
- Technical best practices
- Scalability and performance considerations

${depthInstructions[depth as keyof typeof depthInstructions]}`,

      business: `Research the business aspects of: ${topic}

Focus on:
- Market analysis and trends
- Business model and monetization
- Competitive landscape
- ROI and cost considerations
- Risk assessment

${depthInstructions[depth as keyof typeof depthInstructions]}`,

      user: `Research from the user perspective: ${topic}

Focus on:
- User needs and pain points
- User experience considerations
- Accessibility and usability
- User feedback and sentiment
- Adoption barriers and enablers

${depthInstructions[depth as keyof typeof depthInstructions]}`,

      competitive: `Research the competitive landscape for: ${topic}

Focus on:
- Key competitors and alternatives
- Competitive advantages and differentiators
- Market positioning
- Strengths and weaknesses analysis
- Opportunities and threats

${depthInstructions[depth as keyof typeof depthInstructions]}`,
    };

    return prompts[perspective] || prompts.technical;
  }

  private async synthesizeFindings(
    research: Record<string, any>,
    topic: string,
    context: AgentExecutionContext
  ): Promise<string> {
    const perspectives = Object.keys(research);
    const synthesisPrompt = `Based on the following multi-perspective research on "${topic}", provide a synthesized summary that:
1. Identifies key insights across all perspectives
2. Highlights agreements and contradictions
3. Provides actionable recommendations

Research findings:
${perspectives.map(p => `\n${p.toUpperCase()} PERSPECTIVE:\n${JSON.stringify(research[p], null, 2)}`).join('\n')}

Provide a clear, structured synthesis.`;

    if (this.a2aClient) {
      try {
        return await this.a2aClient.executeOrchestrator(synthesisPrompt);
      } catch (error) {
        this.log('warn', 'Synthesis via A2A failed, using fallback', { error });
      }
    }

    return `Research completed from ${perspectives.length} perspectives. Key areas covered: ${perspectives.join(', ')}`;
  }

  private performLocalResearch(perspectiveName: string, topic: string): Record<string, any> {
    return {
      perspective: perspectiveName,
      summary: `Local research performed for ${topic} from ${perspectiveName} perspective`,
      keyPoints: [],
      note: 'A2A server unavailable - limited local analysis',
    };
  }
}

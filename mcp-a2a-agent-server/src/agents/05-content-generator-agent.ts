import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';

/**
 * Content Generator Agent
 * Generates content in multiple formats using parallel subagents
 */
export class ContentGeneratorAgent extends BaseAgent {
  name = 'content_generator';
  description = 'Generates high-quality content in multiple formats (blog, social, technical, marketing) with iterative refinement.';

  inputSchema = z.object({
    topic: z.string().describe('The topic or subject for content generation'),
    formats: z.array(z.enum(['blog', 'social', 'technical', 'marketing', 'email', 'all'])).default(['all']),
    tone: z.enum(['professional', 'casual', 'technical', 'persuasive', 'educational']).default('professional'),
    length: z.enum(['short', 'medium', 'long']).default('medium'),
    optimize: z.boolean().default(true).describe('Apply evaluator-optimizer workflow for refinement'),
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

    this.log('info', 'Starting content generation', {
      topic: params.topic,
      formats: params.formats,
      tone: params.tone,
      sessionId: context.sessionId,
    });

    try {
      const formatsToGenerate = params.formats.includes('all')
        ? ['blog', 'social', 'technical', 'marketing']
        : params.formats;

      // Create parallel content generation tasks
      const tasks = SubAgentOrchestrator.createTasks(
        formatsToGenerate.map(format => ({
          name: `${format}_content`,
          prompt: this.generateContentPrompt(format, params.topic, params.tone, params.length),
        }))
      );

      // Generate content in parallel
      const results = await this.executeSubAgents(tasks, context, async (task) => {
        if (this.a2aClient) {
          // Use chaining workflow for structured content generation
          let content = await this.a2aClient.executeChaining(task.prompt);

          // Optionally optimize using evaluator-optimizer
          if (params.optimize) {
            content = await this.optimizeContent(content, task.name);
          }

          return content;
        }
        return this.generateFallbackContent(task.name, params.topic);
      });

      // Aggregate generated content
      const content = SubAgentOrchestrator.aggregateResults(results, (data) => {
        const aggregated: Record<string, any> = {};
        data.forEach((item, idx) => {
          const format = formatsToGenerate[idx];
          aggregated[format] = item;
        });
        return aggregated;
      });

      return this.success({
        topic: params.topic,
        content,
        metadata: {
          formatsGenerated: formatsToGenerate.length,
          tone: params.tone,
          length: params.length,
          optimized: params.optimize,
        },
      }, {
        subAgentsUsed: results.length,
      });
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private generateContentPrompt(format: string, topic: string, tone: string, length: string): string {
    const lengthGuidance = {
      short: '200-300 words',
      medium: '500-700 words',
      long: '1000-1500 words',
    };

    const prompts: Record<string, string> = {
      blog: `Write a ${tone} blog post about: ${topic}

Requirements:
- Length: ${lengthGuidance[length as keyof typeof lengthGuidance]}
- Include an engaging introduction
- Use clear headings and structure
- Provide actionable insights
- End with a strong conclusion
- Tone: ${tone}`,

      social: `Create social media content about: ${topic}

Generate:
1. Twitter/X post (280 characters max)
2. LinkedIn post (professional, ~150 words)
3. Instagram caption (engaging, with hashtags)

Tone: ${tone}`,

      technical: `Write technical documentation for: ${topic}

Include:
- Overview and purpose
- Technical specifications
- Implementation details
- Code examples (if applicable)
- Best practices
- Troubleshooting guide

Length: ${lengthGuidance[length as keyof typeof lengthGuidance]}
Tone: ${tone}`,

      marketing: `Create marketing copy for: ${topic}

Include:
- Compelling headline
- Value proposition
- Key benefits (3-5 points)
- Customer pain points addressed
- Call to action
- Social proof or testimonials structure

Tone: ${tone}
Length: ${lengthGuidance[length as keyof typeof lengthGuidance]}`,

      email: `Write an email campaign about: ${topic}

Structure:
- Subject line (compelling, <60 chars)
- Preview text
- Email body with:
  - Personalized greeting
  - Hook
  - Value proposition
  - Call to action
- PS section

Tone: ${tone}
Length: ${lengthGuidance[length as keyof typeof lengthGuidance]}`,
    };

    return prompts[format] || prompts.blog;
  }

  private async optimizeContent(content: string, contentType: string): Promise<string> {
    if (!this.a2aClient) {
      return content;
    }

    const optimizationPrompt = `Review and optimize the following ${contentType}:

${content}

Improvements to make:
1. Enhance clarity and readability
2. Strengthen key messages
3. Improve structure and flow
4. Add compelling elements
5. Ensure consistency

Provide the optimized version.`;

    try {
      return await this.a2aClient.executeEvaluatorOptimizer(optimizationPrompt);
    } catch (error) {
      this.log('warn', 'Content optimization failed, returning original', { error });
      return content;
    }
  }

  private generateFallbackContent(format: string, topic: string): Record<string, any> {
    return {
      format,
      content: `Generated ${format} content for: ${topic}`,
      note: 'Fallback content - A2A server unavailable',
    };
  }
}

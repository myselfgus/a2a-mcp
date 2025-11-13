import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';

/**
 * Data Processor Agent
 * Processes, transforms, and analyzes data using parallel subagents
 */
export class DataProcessorAgent extends BaseAgent {
  name = 'data_processor';
  description = 'Processes and analyzes data with operations like validation, transformation, aggregation, and insights extraction using parallel processing.';

  inputSchema = z.object({
    data: z.any().describe('The data to process (can be array, object, or string)'),
    operations: z.array(z.enum(['validate', 'transform', 'aggregate', 'analyze', 'visualize', 'all'])).default(['all']),
    outputFormat: z.enum(['json', 'csv', 'summary', 'report']).default('json'),
    customRules: z.string().optional().describe('Custom processing rules or requirements'),
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

    this.log('info', 'Starting data processing', {
      operations: params.operations,
      outputFormat: params.outputFormat,
      sessionId: context.sessionId,
    });

    try {
      const operationsToPerform = params.operations.includes('all')
        ? ['validate', 'transform', 'analyze', 'aggregate']
        : params.operations;

      // Serialize data for processing
      const serializedData = typeof params.data === 'string'
        ? params.data
        : JSON.stringify(params.data, null, 2);

      // Create parallel processing tasks
      const tasks = SubAgentOrchestrator.createTasks(
        operationsToPerform.map(operation => ({
          name: `${operation}_operation`,
          prompt: this.generateOperationPrompt(operation, serializedData, params.customRules),
          dependencies: operation === 'aggregate' ? ['validate_operation', 'transform_operation'] : [],
        }))
      );

      // Execute operations in parallel (respecting dependencies)
      const results = await this.executeSubAgents(tasks, context, async (task) => {
        if (this.a2aClient) {
          return await this.a2aClient.executeRouter(task.prompt);
        }
        return this.performLocalOperation(task.name, params.data);
      });

      // Aggregate results
      const processed = SubAgentOrchestrator.aggregateResults(results, (data) => {
        const aggregated: Record<string, any> = {};
        data.forEach((item, idx) => {
          const operation = operationsToPerform[idx];
          aggregated[operation] = item;
        });
        return aggregated;
      });

      // Format output
      const formattedOutput = await this.formatOutput(
        processed,
        params.outputFormat,
        serializedData,
        context
      );

      return this.success({
        originalData: params.data,
        operations: processed,
        output: formattedOutput,
        metadata: {
          operationsPerformed: operationsToPerform.length,
          outputFormat: params.outputFormat,
        },
      }, {
        subAgentsUsed: results.length,
      });
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private generateOperationPrompt(operation: string, data: string, customRules?: string): string {
    const customSection = customRules ? `\n\nCustom rules to apply:\n${customRules}` : '';

    const prompts: Record<string, string> = {
      validate: `Validate the following data and identify any issues:

Data:
${data}

Check for:
1. Data integrity and completeness
2. Format consistency
3. Invalid values or outliers
4. Missing required fields
5. Data type mismatches

Provide validation results with specific issues found.${customSection}`,

      transform: `Transform the following data according to best practices:

Data:
${data}

Apply transformations:
1. Normalize formats
2. Standardize naming conventions
3. Remove duplicates
4. Clean and sanitize values
5. Enrich with derived fields

Provide the transformed data structure.${customSection}`,

      analyze: `Analyze the following data and extract insights:

Data:
${data}

Provide:
1. Statistical summary
2. Patterns and trends
3. Anomalies or outliers
4. Key findings
5. Actionable insights

Present a comprehensive analysis.${customSection}`,

      aggregate: `Aggregate and summarize the following data:

Data:
${data}

Create:
1. Summary statistics
2. Grouped aggregations
3. Key metrics
4. Distribution analysis
5. Comparative insights

Provide aggregated results.${customSection}`,

      visualize: `Suggest visualizations for the following data:

Data:
${data}

Recommend:
1. Best chart types for this data
2. Key metrics to visualize
3. Dashboard layout suggestions
4. Color schemes and design
5. Interactive elements

Provide visualization recommendations.${customSection}`,
    };

    return prompts[operation] || prompts.analyze;
  }

  private performLocalOperation(operationName: string, data: any): Record<string, any> {
    // Basic local processing
    const dataArray = Array.isArray(data) ? data : [data];

    return {
      operation: operationName,
      recordCount: dataArray.length,
      summary: `Local ${operationName} performed`,
      note: 'Limited local processing - A2A server unavailable',
    };
  }

  private async formatOutput(
    processed: Record<string, any>,
    format: string,
    originalData: string,
    context: AgentExecutionContext
  ): Promise<any> {
    switch (format) {
      case 'json':
        return processed;

      case 'csv':
        return this.convertToCSV(processed);

      case 'summary':
        return this.generateSummary(processed);

      case 'report':
        return await this.generateReport(processed, originalData, context);

      default:
        return processed;
    }
  }

  private convertToCSV(data: Record<string, any>): string {
    // Simple CSV conversion
    const rows: string[] = [];
    rows.push('Operation,Result');

    for (const [operation, result] of Object.entries(data)) {
      const resultStr = typeof result === 'object'
        ? JSON.stringify(result).replace(/,/g, ';')
        : String(result);
      rows.push(`${operation},${resultStr}`);
    }

    return rows.join('\n');
  }

  private generateSummary(processed: Record<string, any>): Record<string, any> {
    return {
      operationsCompleted: Object.keys(processed).length,
      operations: Object.keys(processed),
      timestamp: new Date().toISOString(),
    };
  }

  private async generateReport(
    processed: Record<string, any>,
    originalData: string,
    context: AgentExecutionContext
  ): Promise<string> {
    const reportPrompt = `Generate a comprehensive data processing report based on:

Original Data Summary:
${originalData.substring(0, 500)}...

Processing Results:
${JSON.stringify(processed, null, 2)}

Create a report with:
1. Executive Summary
2. Processing Steps Performed
3. Key Findings
4. Data Quality Assessment
5. Recommendations

Format as a professional report.`;

    if (this.a2aClient) {
      try {
        return await this.a2aClient.executeChaining(reportPrompt);
      } catch (error) {
        this.log('warn', 'Report generation failed', { error });
      }
    }

    return `Data Processing Report\n\nOperations: ${Object.keys(processed).join(', ')}\nTimestamp: ${new Date().toISOString()}`;
  }
}

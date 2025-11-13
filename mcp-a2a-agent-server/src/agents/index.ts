/**
 * Agent Registry - Export all available agents
 */

import { A2AServerManagerAgent } from './01-a2a-server-manager.js';
import { CodeAnalystAgent } from './02-code-analyst-agent.js';
import { ResearchAgent } from './03-research-agent.js';
import { TaskOrchestratorAgent } from './04-task-orchestrator-agent.js';
import { ContentGeneratorAgent } from './05-content-generator-agent.js';
import { DataProcessorAgent } from './06-data-processor-agent.js';
import { TestingAgent } from './07-testing-agent.js';
import { DocumentationAgent } from './08-documentation-agent.js';
import { OptimizationAgent } from './09-optimization-agent.js';
import { IntegrationAgent } from './10-integration-agent.js';
import { SecurityAuditAgent } from './11-security-audit-agent.js';
import { DeploymentAgent } from './12-deployment-agent.js';

export {
  A2AServerManagerAgent,
  CodeAnalystAgent,
  ResearchAgent,
  TaskOrchestratorAgent,
  ContentGeneratorAgent,
  DataProcessorAgent,
  TestingAgent,
  DocumentationAgent,
  OptimizationAgent,
  IntegrationAgent,
  SecurityAuditAgent,
  DeploymentAgent,
};

/**
 * All available agent classes
 */
export const AGENT_CLASSES = [
  A2AServerManagerAgent,
  CodeAnalystAgent,
  ResearchAgent,
  TaskOrchestratorAgent,
  ContentGeneratorAgent,
  DataProcessorAgent,
  TestingAgent,
  DocumentationAgent,
  OptimizationAgent,
  IntegrationAgent,
  SecurityAuditAgent,
  DeploymentAgent,
] as const;

/**
 * Agent metadata for discovery and documentation
 */
export const AGENT_METADATA = {
  a2a_server_manager: {
    category: 'infrastructure',
    tags: ['a2a', 'server', 'health', 'workflows'],
    complexity: 'simple',
  },
  code_analyst: {
    category: 'development',
    tags: ['code', 'quality', 'security', 'performance', 'analysis'],
    complexity: 'advanced',
  },
  research_agent: {
    category: 'intelligence',
    tags: ['research', 'analysis', 'multi-perspective', 'insights'],
    complexity: 'advanced',
  },
  task_orchestrator: {
    category: 'orchestration',
    tags: ['tasks', 'decomposition', 'orchestration', 'parallel'],
    complexity: 'advanced',
  },
  content_generator: {
    category: 'content',
    tags: ['content', 'writing', 'marketing', 'documentation'],
    complexity: 'intermediate',
  },
  data_processor: {
    category: 'data',
    tags: ['data', 'processing', 'transformation', 'analysis'],
    complexity: 'intermediate',
  },
  testing_agent: {
    category: 'qa',
    tags: ['testing', 'qa', 'unit', 'integration', 'e2e'],
    complexity: 'advanced',
  },
  documentation_agent: {
    category: 'documentation',
    tags: ['docs', 'api', 'guides', 'tutorials'],
    complexity: 'intermediate',
  },
  optimization_agent: {
    category: 'optimization',
    tags: ['optimization', 'performance', 'cost', 'scalability'],
    complexity: 'advanced',
  },
  integration_agent: {
    category: 'integration',
    tags: ['integration', 'api', 'connectors', 'systems'],
    complexity: 'advanced',
  },
  security_audit: {
    category: 'security',
    tags: ['security', 'audit', 'owasp', 'compliance', 'vulnerabilities'],
    complexity: 'advanced',
  },
  deployment_agent: {
    category: 'devops',
    tags: ['deployment', 'cicd', 'infrastructure', 'monitoring'],
    complexity: 'advanced',
  },
} as const;

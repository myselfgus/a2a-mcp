import type { z } from 'zod';

/**
 * Core types for A2A MCP Agent Server
 */

export interface SubAgentTask {
  id: string;
  name: string;
  prompt: string;
  priority?: number;
  dependencies?: string[];
}

export interface SubAgentResult {
  taskId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

export interface AgentExecutionContext {
  sessionId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  parentAgentId?: string;
  depth: number;
}

export interface AgentCapabilities {
  maxSubAgents: number;
  supportsParallelization: boolean;
  supportsStreaming: boolean;
  timeoutMs: number;
}

export interface AgentConfig {
  name: string;
  description: string;
  capabilities: AgentCapabilities;
  modelPreferences?: {
    primary?: string;
    fallback?: string;
  };
}

export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    duration: number;
    subAgentsUsed?: number;
    tokensUsed?: number;
  };
}

export interface A2AServerConfig {
  host: string;
  port: number;
  enabled: boolean;
  healthCheckInterval?: number;
}

export interface A2AWorkflowRequest {
  workflow: 'chaining' | 'parallel' | 'router' | 'orchestrator' | 'evaluator_optimizer' | 'simple_assistant';
  message: string;
  context?: Record<string, unknown>;
}

export interface A2AWorkflowResponse {
  result: string;
  metadata?: {
    workflow: string;
    duration: number;
    stepsExecuted?: number;
  };
}

/**
 * Agent Tool Registry
 */
export interface AgentTool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  execute: (input: unknown, context: AgentExecutionContext) => Promise<ToolExecutionResult>;
  config: AgentConfig;
}

/**
 * Logging and Monitoring
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  agentName?: string;
  sessionId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Health and Status
 */
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  a2aServerConnected: boolean;
  activeAgents: number;
  lastError?: string;
}

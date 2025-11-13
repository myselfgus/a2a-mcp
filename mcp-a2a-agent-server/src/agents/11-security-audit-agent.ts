import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig, AgentExecutionContext, ToolExecutionResult } from '../types/index.js';
import { SubAgentOrchestrator } from '../utils/subagent-orchestrator.js';

/**
 * Security Audit Agent
 * Performs comprehensive security audits using parallel subagents
 */
export class SecurityAuditAgent extends BaseAgent {
  name = 'security_audit';
  description = 'Performs comprehensive security audits including OWASP Top 10, SAST, dependency scanning, and compliance checks using parallel agents.';

  inputSchema = z.object({
    target: z.string().describe('Code, system, or application to audit'),
    auditTypes: z.array(z.enum(['owasp', 'dependencies', 'secrets', 'compliance', 'infrastructure', 'all'])).default(['all']),
    complianceFrameworks: z.array(z.string()).optional().describe('e.g., SOC2, GDPR, HIPAA'),
    depth: z.enum(['quick', 'standard', 'comprehensive']).default('standard'),
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

    this.log('info', 'Starting security audit', {
      auditTypes: params.auditTypes,
      depth: params.depth,
      sessionId: context.sessionId,
    });

    try {
      const auditTypesToPerform = params.auditTypes.includes('all')
        ? ['owasp', 'dependencies', 'secrets', 'compliance']
        : params.auditTypes;

      // Create parallel audit tasks
      const tasks = SubAgentOrchestrator.createTasks(
        auditTypesToPerform.map((auditType, idx) => ({
          name: `${auditType}_audit`,
          prompt: this.generateAuditPrompt(
            auditType,
            params.target,
            params.depth,
            params.complianceFrameworks
          ),
          priority: auditType === 'owasp' ? 1 : 0, // Prioritize OWASP audit
        }))
      );

      // Execute audits in parallel
      const results = await this.executeSubAgents(tasks, context, async (task) => {
        if (this.a2aClient) {
          return await this.a2aClient.executeParallel(task.prompt);
        }
        return this.performLocalAudit(task.name, params.target);
      });

      // Aggregate audit results
      const auditResults = SubAgentOrchestrator.aggregateResults(results, (data) => {
        const aggregated: Record<string, any> = {};
        data.forEach((item, idx) => {
          const auditType = auditTypesToPerform[idx];
          aggregated[auditType] = item;
        });
        return aggregated;
      });

      // Calculate risk scores and prioritize findings
      const riskAssessment = this.calculateRiskAssessment(auditResults);

      // Generate remediation plan
      const remediationPlan = await this.generateRemediationPlan(
        auditResults,
        riskAssessment,
        context
      );

      // Generate compliance report (if frameworks specified)
      let complianceReport = null;
      if (params.complianceFrameworks && params.complianceFrameworks.length > 0) {
        complianceReport = await this.generateComplianceReport(
          auditResults,
          params.complianceFrameworks,
          context
        );
      }

      const criticalFindings = this.countFindingsBySeverity(auditResults, 'critical');
      const highFindings = this.countFindingsBySeverity(auditResults, 'high');

      return this.success({
        target: params.target,
        auditResults,
        riskAssessment,
        remediationPlan,
        complianceReport,
        summary: {
          auditsPerformed: auditTypesToPerform.length,
          criticalFindings,
          highFindings,
          overallRiskLevel: riskAssessment.overallRiskLevel,
          complianceStatus: complianceReport?.status || 'N/A',
        },
      }, {
        subAgentsUsed: results.length,
      });
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private generateAuditPrompt(
    auditType: string,
    target: string,
    depth: string,
    complianceFrameworks?: string[]
  ): string {
    const depthGuidance = {
      quick: 'Focus on critical vulnerabilities and common issues',
      standard: 'Comprehensive scan including common and moderate severity issues',
      comprehensive: 'Exhaustive audit including all severity levels and edge cases',
    };

    const prompts: Record<string, string> = {
      owasp: `Perform OWASP Top 10 security audit on:

${target}

Check for:
1. A01:2021 - Broken Access Control
2. A02:2021 - Cryptographic Failures
3. A03:2021 - Injection
4. A04:2021 - Insecure Design
5. A05:2021 - Security Misconfiguration
6. A06:2021 - Vulnerable and Outdated Components
7. A07:2021 - Identification and Authentication Failures
8. A08:2021 - Software and Data Integrity Failures
9. A09:2021 - Security Logging and Monitoring Failures
10. A10:2021 - Server-Side Request Forgery (SSRF)

Depth: ${depthGuidance[depth as keyof typeof depthGuidance]}

For each finding:
- Severity: Critical/High/Medium/Low
- Location: Specific file/line if applicable
- Description: What the vulnerability is
- Impact: Potential consequences
- Remediation: How to fix it

Provide structured findings.`,

      dependencies: `Perform dependency security audit on:

${target}

Analyze:
1. Known vulnerabilities in dependencies (CVEs)
2. Outdated packages
3. License compliance issues
4. Transitive dependency risks
5. Supply chain security risks

Depth: ${depthGuidance[depth as keyof typeof depthGuidance]}

For each issue:
- Package name and version
- Vulnerability ID (CVE)
- Severity
- Affected versions
- Patched version
- Remediation steps`,

      secrets: `Perform secrets and credential scanning on:

${target}

Detect:
1. API keys and tokens
2. Database credentials
3. Private keys
4. Passwords and secrets in code
5. Cloud provider credentials
6. OAuth tokens
7. Encryption keys

Depth: ${depthGuidance[depth as keyof typeof depthGuidance]}

For each finding:
- Secret type
- Location
- Severity
- Exposure risk
- Rotation recommendations`,

      compliance: `Perform compliance audit on:

${target}

${complianceFrameworks ? `Frameworks: ${complianceFrameworks.join(', ')}` : 'General compliance requirements'}

Check:
1. Data protection measures
2. Access control implementation
3. Audit logging
4. Encryption at rest and in transit
5. Incident response readiness
6. Data retention policies
7. Privacy controls

Depth: ${depthGuidance[depth as keyof typeof depthGuidance]}

Identify compliance gaps and requirements.`,

      infrastructure: `Perform infrastructure security audit on:

${target}

Analyze:
1. Network security configuration
2. Firewall rules
3. Exposed services
4. SSL/TLS configuration
5. Container security
6. Cloud resource configuration
7. IAM policies

Depth: ${depthGuidance[depth as keyof typeof depthGuidance]}

Identify misconfigurations and vulnerabilities.`,
    };

    return prompts[auditType] || prompts.owasp;
  }

  private calculateRiskAssessment(auditResults: Record<string, any>): any {
    const findings = this.extractAllFindings(auditResults);

    const severityCounts = {
      critical: this.countFindingsBySeverity(auditResults, 'critical'),
      high: this.countFindingsBySeverity(auditResults, 'high'),
      medium: this.countFindingsBySeverity(auditResults, 'medium'),
      low: this.countFindingsBySeverity(auditResults, 'low'),
    };

    // Calculate risk score (0-100)
    const riskScore =
      severityCounts.critical * 25 +
      severityCounts.high * 10 +
      severityCounts.medium * 3 +
      severityCounts.low * 1;

    let overallRiskLevel: string;
    if (severityCounts.critical > 0) {
      overallRiskLevel = 'critical';
    } else if (severityCounts.high > 0) {
      overallRiskLevel = 'high';
    } else if (severityCounts.medium > 5) {
      overallRiskLevel = 'medium';
    } else {
      overallRiskLevel = 'low';
    }

    return {
      riskScore: Math.min(riskScore, 100),
      overallRiskLevel,
      severityBreakdown: severityCounts,
      totalFindings: Object.values(severityCounts).reduce((a, b) => a + b, 0),
      priorityActions: this.identifyPriorityActions(auditResults),
    };
  }

  private async generateRemediationPlan(
    auditResults: Record<string, any>,
    riskAssessment: any,
    context: AgentExecutionContext
  ): Promise<any> {
    const planPrompt = `Generate a prioritized remediation plan based on security audit findings:

Risk Assessment:
${JSON.stringify(riskAssessment, null, 2)}

Audit Results Summary:
${JSON.stringify(this.summarizeAuditResults(auditResults), null, 2)}

Provide:
1. Prioritized remediation steps (Critical → High → Medium → Low)
2. Estimated effort for each fix
3. Dependencies between fixes
4. Quick wins (high impact, low effort)
5. Timeline recommendations
6. Resource requirements

Format as actionable plan.`;

    if (this.a2aClient) {
      try {
        const plan = await this.a2aClient.executeOrchestrator(planPrompt);
        try {
          return JSON.parse(plan);
        } catch {
          return { description: plan, type: 'text' };
        }
      } catch (error) {
        this.log('warn', 'Remediation plan generation failed', { error });
      }
    }

    return {
      phases: ['Immediate', 'Short-term', 'Long-term'],
      immediate: 'Address critical findings',
      note: 'Template plan - A2A server unavailable',
    };
  }

  private async generateComplianceReport(
    auditResults: Record<string, any>,
    frameworks: string[],
    context: AgentExecutionContext
  ): Promise<any> {
    const reportPrompt = `Generate compliance report for:

Frameworks: ${frameworks.join(', ')}

Audit Results:
${JSON.stringify(auditResults, null, 2)}

Provide:
1. Compliance status per framework
2. Gaps identified
3. Controls implemented
4. Controls missing
5. Recommendations for compliance
6. Certification readiness assessment`;

    if (this.a2aClient) {
      try {
        return await this.a2aClient.executeEvaluatorOptimizer(reportPrompt);
      } catch (error) {
        this.log('warn', 'Compliance report generation failed', { error });
      }
    }

    return {
      status: 'partial',
      frameworks: frameworks.map(f => ({ name: f, status: 'needs_review' })),
    };
  }

  private performLocalAudit(auditName: string, target: string): Record<string, any> {
    return {
      audit: auditName,
      findings: [],
      note: 'Local audit - A2A server unavailable',
    };
  }

  private extractAllFindings(auditResults: Record<string, any>): any[] {
    const findings: any[] = [];
    for (const audit of Object.values(auditResults)) {
      if (typeof audit === 'object' && audit.findings) {
        findings.push(...audit.findings);
      }
    }
    return findings;
  }

  private countFindingsBySeverity(auditResults: Record<string, any>, severity: string): number {
    const findings = this.extractAllFindings(auditResults);
    return findings.filter(f => f.severity?.toLowerCase() === severity).length;
  }

  private identifyPriorityActions(auditResults: Record<string, any>): string[] {
    // Extract critical and high severity findings
    const findings = this.extractAllFindings(auditResults);
    return findings
      .filter(f => ['critical', 'high'].includes(f.severity?.toLowerCase()))
      .slice(0, 5)
      .map(f => f.description || f.title || 'Security issue')
      .filter(Boolean);
  }

  private summarizeAuditResults(auditResults: Record<string, any>): any {
    const summary: any = {};
    for (const [auditType, result] of Object.entries(auditResults)) {
      if (typeof result === 'object' && result.findings) {
        summary[auditType] = {
          totalFindings: result.findings.length,
          critical: this.countFindingsInResult(result, 'critical'),
          high: this.countFindingsInResult(result, 'high'),
        };
      }
    }
    return summary;
  }

  private countFindingsInResult(result: any, severity: string): number {
    if (!result.findings) return 0;
    return result.findings.filter((f: any) => f.severity?.toLowerCase() === severity).length;
  }
}

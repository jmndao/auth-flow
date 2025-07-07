import type { AuthConfig } from './config';

/**
 * Diagnostic and troubleshooting type definitions
 */

export interface HealthReport {
  healthy: boolean;
  issues: HealthIssue[];
  recommendations: string[];
  workingConfig?: Partial<AuthConfig> | undefined;
}

export interface HealthIssue {
  code: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  solution: string;
}

export interface DiagnosticResult {
  environment: string;
  capabilities: {
    cookies: boolean;
    localStorage: boolean;
    serverActions: boolean;
  };
  issues: HealthIssue[];
  fixes: string[];
}

import type { HealthReport, HealthIssue, AuthConfig, StorageAdapter } from '../types';
import { createStorageAdapter } from '../storage';

/**
 * Runtime health monitoring and issue detection
 * Performs checks on storage, network, and authentication state
 */
export class HealthChecker {
  private readonly config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthReport> {
    const issues: HealthIssue[] = [];
    const recommendations: string[] = [];

    const storageIssues = await this.checkStorage();
    issues.push(...storageIssues);

    const networkIssues = await this.checkNetwork();
    issues.push(...networkIssues);

    const envIssues = this.checkEnvironment();
    issues.push(...envIssues);

    if (issues.length > 0) {
      recommendations.push(...this.generateRecommendations(issues));
    }

    const healthy = issues.filter((i) => i.severity === 'high').length === 0;

    return {
      healthy,
      issues,
      recommendations,
      workingConfig: healthy ? undefined : this.generateWorkingConfig(issues),
    };
  }

  /**
   * Check storage adapter functionality
   */
  private async checkStorage(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = [];
    const storage = createStorageAdapter(this.config.storage);

    try {
      await this.setStorageItem(storage, '__auth_health_test__', 'test');

      const value = await this.getStorageItem(storage, '__auth_health_test__');
      if (value !== 'test') {
        issues.push({
          code: 'STORAGE_READ_FAIL',
          severity: 'high',
          description: 'Storage adapter cannot read values correctly',
          solution: 'Try a different storage adapter or check storage permissions',
        });
      }

      await this.removeStorageItem(storage, '__auth_health_test__');
    } catch {
      issues.push({
        code: 'STORAGE_WRITE_FAIL',
        severity: 'high',
        description: 'Storage adapter cannot write values',
        solution: 'Storage may be disabled or full. Try browser or memory storage.',
      });
    }

    return issues;
  }

  /**
   * Check network connectivity to API
   */
  private async checkNetwork(): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = [];

    try {
      const response = await fetch(this.config.baseURL, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok && response.status !== 404) {
        issues.push({
          code: 'NETWORK_UNREACHABLE',
          severity: 'medium',
          description: `API endpoint returned ${response.status}`,
          solution: 'Check baseURL configuration and network connectivity',
        });
      }
    } catch {
      issues.push({
        code: 'NETWORK_ERROR',
        severity: 'high',
        description: 'Cannot reach API endpoint',
        solution: 'Verify baseURL and check network connectivity',
      });
    }

    return issues;
  }

  /**
   * Check environment compatibility
   */
  private checkEnvironment(): HealthIssue[] {
    const issues: HealthIssue[] = [];
    const isServer = typeof window === 'undefined';

    if (isServer && this.config.storage === 'browser') {
      issues.push({
        code: 'INVALID_STORAGE_SERVER',
        severity: 'high',
        description: 'Browser storage not available in server environment',
        solution: 'Use cookies or memory storage for server-side rendering',
      });
    }

    if (isServer && this.config.storage === 'cookies') {
      try {
        require('next/headers');
      } catch {
        issues.push({
          code: 'NEXTJS_NOT_AVAILABLE',
          severity: 'medium',
          description: 'Next.js headers not available for cookie management',
          solution: 'Ensure Next.js is installed or use different storage adapter',
        });
      }
    }

    return issues;
  }

  /**
   * Generate recommendations based on detected issues
   */
  private generateRecommendations(issues: HealthIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some((i) => i.code.startsWith('STORAGE_'))) {
      recommendations.push('Consider using automatic storage selection with storage: "auto"');
    }

    if (issues.some((i) => i.code.startsWith('NETWORK_'))) {
      recommendations.push('Verify your API baseURL is correct and accessible');
      recommendations.push('Check if CORS is properly configured on your API');
    }

    if (issues.some((i) => i.code.includes('SERVER'))) {
      recommendations.push('Use server-compatible storage options like cookies or memory');
      recommendations.push('Consider using framework-specific optimizations');
    }

    return recommendations;
  }

  /**
   * Generate a working configuration based on detected issues
   */
  private generateWorkingConfig(issues: HealthIssue[]): Partial<AuthConfig> {
    const workingConfig: Partial<AuthConfig> = { ...this.config };

    if (issues.some((i) => i.code === 'INVALID_STORAGE_SERVER')) {
      workingConfig.storage = 'cookies';
    }

    if (issues.some((i) => i.code === 'STORAGE_WRITE_FAIL')) {
      workingConfig.storage = 'memory';
    }

    return workingConfig;
  }

  /**
   * Helper methods for storage operations
   */
  private async setStorageItem(storage: StorageAdapter, key: string, value: string): Promise<void> {
    const result = storage.set(key, value);
    if (result instanceof Promise) {
      await result;
    }
  }

  private async getStorageItem(storage: StorageAdapter, key: string): Promise<string | null> {
    const result = storage.get(key);
    return result instanceof Promise ? await result : result;
  }

  private async removeStorageItem(storage: StorageAdapter, key: string): Promise<void> {
    const result = storage.remove(key);
    if (result instanceof Promise) {
      await result;
    }
  }
}

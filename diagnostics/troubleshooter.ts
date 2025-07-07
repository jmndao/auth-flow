import type { DiagnosticResult, HealthIssue, AuthConfig } from '../types';
import { ConfigValidator } from './validator';
import { HealthChecker } from './health-check';

/**
 * Comprehensive troubleshooting and auto-fix suggestions
 * Combines validation, health checks, and environment detection
 */
export class Troubleshooter {
  /**
   * Run comprehensive diagnostic check
   */
  static async diagnose(config: AuthConfig): Promise<DiagnosticResult> {
    const environment = this.detectEnvironment();
    const capabilities = this.detectCapabilities();

    const configIssues = ConfigValidator.validate(config);
    const healthChecker = new HealthChecker(config);
    const healthReport = await healthChecker.performHealthCheck();

    const allIssues = [...configIssues, ...healthReport.issues];
    const fixes = this.generateFixes(allIssues, environment);

    return {
      environment,
      capabilities,
      issues: allIssues,
      fixes,
    };
  }

  /**
   * Detect runtime environment
   */
  private static detectEnvironment(): string {
    if (typeof window === 'undefined') {
      try {
        require('next/headers');
        return 'nextjs-server';
      } catch {
        if (typeof process !== 'undefined' && process.versions?.node) {
          return 'nodejs';
        }
        return 'server-unknown';
      }
    }

    if (typeof document !== 'undefined') {
      const userAgent = navigator.userAgent;
      if (userAgent.includes('Chrome')) return 'browser-chrome';
      if (userAgent.includes('Firefox')) return 'browser-firefox';
      if (userAgent.includes('Safari')) return 'browser-safari';
      return 'browser-unknown';
    }

    return 'unknown';
  }

  /**
   * Detect environment capabilities
   */
  private static detectCapabilities() {
    const isServer = typeof window === 'undefined';

    return {
      cookies: isServer ? this.detectServerCookies() : this.detectBrowserCookies(),
      localStorage: !isServer && typeof localStorage !== 'undefined',
      serverActions: isServer && this.detectNextJSServerActions(),
    };
  }

  /**
   * Detect server-side cookie capabilities
   */
  private static detectServerCookies(): boolean {
    try {
      require('next/headers');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect browser cookie capabilities
   */
  private static detectBrowserCookies(): boolean {
    if (typeof document === 'undefined') return false;

    try {
      const testKey = '__auth_cookie_test__';
      document.cookie = `${testKey}=test; path=/`;
      const canSet = document.cookie.includes(testKey);

      if (canSet) {
        document.cookie = `${testKey}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }

      return canSet;
    } catch {
      return false;
    }
  }

  /**
   * Detect Next.js server actions capability
   */
  private static detectNextJSServerActions(): boolean {
    try {
      require('next/headers');
      return typeof process !== 'undefined' && process.env.NODE_ENV !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Generate specific fixes for detected issues
   */
  private static generateFixes(issues: HealthIssue[], environment: string): string[] {
    const fixes: string[] = [];
    const isServer = environment.includes('server') || environment.includes('nextjs');

    if (issues.some((i) => i.code === 'STORAGE_WRITE_FAIL' && isServer)) {
      fixes.push('Use server-compatible storage: { storage: "cookies" }');
      fixes.push('Or use memory storage for stateless operation: { storage: "memory" }');
    }

    if (issues.some((i) => i.code === 'INVALID_STORAGE_SERVER')) {
      fixes.push('Change storage to cookies for SSR: { storage: "cookies" }');
    }

    if (issues.some((i) => i.code === 'NEXTJS_NOT_AVAILABLE')) {
      fixes.push('Install Next.js or use different storage adapter');
      fixes.push('For non-Next.js servers, use: { storage: "memory" }');
    }

    if (issues.some((i) => i.code === 'NETWORK_ERROR')) {
      fixes.push('Verify your API is running and accessible');
      fixes.push('Check CORS configuration on your API');
      fixes.push('Ensure baseURL is correct and includes protocol');
    }

    if (issues.some((i) => i.code === 'MISSING_BASE_URL')) {
      fixes.push('Add baseURL to config: createAuthFlow({ baseURL: "https://api.example.com" })');
    }

    if (issues.some((i) => i.code.includes('TOKEN'))) {
      fixes.push('Verify your API returns tokens with the expected field names');
      fixes.push('Check tokens configuration matches your API response format');
    }

    if (environment === 'nextjs-server') {
      fixes.push('For Next.js server components, consider using server actions');
      fixes.push('Or move authentication logic to client components');
    }

    if (fixes.length === 0 && issues.length > 0) {
      fixes.push('Run health check for detailed diagnostics: auth.diagnose()');
      fixes.push('Check the issues array for specific problems and solutions');
    }

    return fixes;
  }

  /**
   * Generate working configuration for detected environment
   */
  static generateOptimalConfig(baseURL: string): AuthConfig {
    const environment = this.detectEnvironment();
    const capabilities = this.detectCapabilities();

    let storage: AuthConfig['storage'] = 'auto';

    if (environment.includes('server')) {
      storage = capabilities.cookies ? 'cookies' : 'memory';
    } else if (environment.includes('browser')) {
      storage = capabilities.localStorage ? 'browser' : capabilities.cookies ? 'cookies' : 'memory';
    }

    return {
      baseURL,
      storage,
      timeout: 10000,
      retry: {
        attempts: 3,
        delay: 1000,
      },
    };
  }
}

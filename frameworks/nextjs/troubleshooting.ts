import type { HealthIssue, AuthConfig } from '../../types';

/**
 * Next.js specific troubleshooting and issue detection
 * Identifies and provides solutions for common Next.js authentication problems
 */

export interface NextJSIssue extends HealthIssue {
  nextjsVersion?: string;
  routerType?: 'app' | 'pages';
  component?: 'server' | 'client' | 'middleware';
}

export class NextJSTroubleshooter {
  /**
   * Detect Next.js specific issues
   */
  static async diagnoseNextJS(config: AuthConfig): Promise<NextJSIssue[]> {
    const issues: NextJSIssue[] = [];
    const environment = this.detectNextJSEnvironment();

    if (!environment.isNextJS) {
      return issues;
    }

    issues.push(...this.checkCookieIssues(config, environment));
    issues.push(...this.checkServerComponentIssues(config, environment));
    issues.push(...this.checkMiddlewareIssues(config, environment));
    issues.push(...this.checkAppRouterIssues(config, environment));

    return issues;
  }

  /**
   * Detect Next.js environment details
   */
  private static detectNextJSEnvironment() {
    const isServer = typeof window === 'undefined';
    let isNextJS = false;
    let version = 'unknown';
    let routerType: 'app' | 'pages' | 'unknown' = 'unknown';

    try {
      require('next/headers');
      isNextJS = true;
      routerType = 'app';
    } catch {
      try {
        require('next/router');
        isNextJS = true;
        routerType = 'pages';
      } catch {
        // Not Next.js
      }
    }

    try {
      const nextPackage = require('next/package.json');
      version = nextPackage.version;
    } catch {
      // Cannot determine version
    }

    return {
      isNextJS,
      isServer,
      version,
      routerType,
    };
  }

  /**
   * Check for cookie-related issues in Next.js
   */
  private static checkCookieIssues(config: AuthConfig, env: any): NextJSIssue[] {
    const issues: NextJSIssue[] = [];

    if (config.storage === 'cookies' && env.isServer && env.routerType === 'app') {
      issues.push({
        code: 'NEXTJS_COOKIE_SERVER_COMPONENT',
        severity: 'high',
        description: 'Cannot set cookies directly in Next.js server components',
        solution: 'Use server actions or move to client component',
        nextjsVersion: env.version,
        routerType: env.routerType,
        component: 'server',
      });
    }

    return issues;
  }

  /**
   * Check for server component issues
   */
  private static checkServerComponentIssues(config: AuthConfig, env: any): NextJSIssue[] {
    const issues: NextJSIssue[] = [];

    if (env.routerType === 'app' && env.isServer) {
      issues.push({
        code: 'NEXTJS_SERVER_COMPONENT_AUTH',
        severity: 'medium',
        description: 'Authentication in server components has limitations',
        solution: 'Use server actions for login/logout or move auth to client components',
        nextjsVersion: env.version,
        routerType: env.routerType,
        component: 'server',
      });
    }

    return issues;
  }

  /**
   * Check for middleware issues
   */
  private static checkMiddlewareIssues(config: AuthConfig, env: any): NextJSIssue[] {
    const issues: NextJSIssue[] = [];

    if (env.isNextJS) {
      issues.push({
        code: 'NEXTJS_MIDDLEWARE_RECOMMENDATION',
        severity: 'low',
        description: 'Consider using Next.js middleware for route protection',
        solution: 'Implement auth middleware for automatic route protection',
        nextjsVersion: env.version,
        routerType: env.routerType,
        component: 'middleware',
      });
    }

    return issues;
  }

  /**
   * Check for App Router specific issues
   */
  private static checkAppRouterIssues(config: AuthConfig, env: any): NextJSIssue[] {
    const issues: NextJSIssue[] = [];

    if (env.routerType === 'app') {
      issues.push({
        code: 'NEXTJS_APP_ROUTER_COOKIES',
        severity: 'medium',
        description: 'App Router requires careful cookie handling',
        solution: 'Use cookies() function from next/headers and server actions',
        nextjsVersion: env.version,
        routerType: env.routerType,
        component: 'server',
      });
    }

    return issues;
  }

  /**
   * Generate Next.js specific fixes
   */
  static generateNextJSFixes(issues: NextJSIssue[]): string[] {
    const fixes: string[] = [];

    if (issues.some((i) => i.code === 'NEXTJS_COOKIE_SERVER_COMPONENT')) {
      fixes.push('Move login logic to a server action:');
      fixes.push('```typescript');
      fixes.push('async function loginAction(formData: FormData) {');
      fixes.push('  "use server"');
      fixes.push('  const auth = createAuthFlow({ baseURL: "...", storage: "cookies" })');
      fixes.push('  await auth.login(credentials)');
      fixes.push('}');
      fixes.push('```');
    }

    if (issues.some((i) => i.code === 'NEXTJS_SERVER_COMPONENT_AUTH')) {
      fixes.push('For server components, read tokens only:');
      fixes.push('```typescript');
      fixes.push('import { cookies } from "next/headers"');
      fixes.push('async function ServerComponent() {');
      fixes.push('  const cookieStore = await cookies()');
      fixes.push('  const token = cookieStore.get("accessToken")');
      fixes.push('  // Use token for API calls');
      fixes.push('}');
      fixes.push('```');
    }

    if (issues.some((i) => i.code === 'NEXTJS_MIDDLEWARE_RECOMMENDATION')) {
      fixes.push('Add authentication middleware:');
      fixes.push('```typescript');
      fixes.push('// middleware.ts');
      fixes.push('import { createAuthMiddleware } from "@jmndao/auth-flow/frameworks/nextjs"');
      fixes.push('export default createAuthMiddleware({');
      fixes.push('  publicPaths: ["/", "/login", "/register"]');
      fixes.push('})');
      fixes.push('```');
    }

    return fixes;
  }

  /**
   * Generate optimal Next.js configuration
   */
  static generateNextJSConfig(baseURL: string): AuthConfig {
    const env = this.detectNextJSEnvironment();

    const config: AuthConfig = {
      baseURL,
      storage: 'cookies',
      timeout: 10000,
      retry: {
        attempts: 3,
        delay: 1000,
      },
    };

    if (env.routerType === 'app') {
      // App Router optimizations
      config.tokens = {
        access: 'accessToken',
        refresh: 'refreshToken',
      };
    }

    return config;
  }
}

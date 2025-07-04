import type { AuthContext } from '../types/config';

export class ContextDetector {
  private static cachedContext: AuthContext | null = null;
  private static detectionAttempted = false;

  /**
   * Automatically detects the runtime context and provides appropriate cookie handling
   */
  static getAutoContext(): AuthContext {
    if (this.detectionAttempted && this.cachedContext) {
      return this.cachedContext;
    }

    this.detectionAttempted = true;
    const context: AuthContext = {};

    if (typeof window === 'undefined') {
      context.cookies = this.detectNextJSCookies();
      context.headers = this.detectNextJSHeaders();
      context.cookieSetter = this.createNextJSCookieSetter();

      if (!context.cookies) {
        this.detectExpressContext(context);
      }
    }

    this.cachedContext = context;
    return context;
  }

  /**
   * Detects Next.js App Router cookies() function
   */
  private static detectNextJSCookies(): (() => any) | undefined {
    try {
      const nextHeaders = require('next/headers');
      if (nextHeaders?.cookies && typeof nextHeaders.cookies === 'function') {
        return () => {
          try {
            return nextHeaders.cookies();
          } catch {
            console.warn('Next.js cookies() called outside request context');
            return null;
          }
        };
      }
    } catch {
      // Next.js not available or not App Router
    }
    return undefined;
  }

  /**
   * Detects Next.js App Router headers() function
   */
  private static detectNextJSHeaders(): (() => any) | undefined {
    try {
      const nextHeaders = require('next/headers');
      if (nextHeaders?.headers && typeof nextHeaders.headers === 'function') {
        return () => {
          try {
            return nextHeaders.headers();
          } catch {
            console.warn('Next.js headers() called outside request context');
            return null;
          }
        };
      }
    } catch {
      // Next.js not available
    }
    return undefined;
  }

  /**
   * Creates a cookie setter for Next.js
   */
  private static createNextJSCookieSetter():
    | ((name: string, value: string, options?: any) => void)
    | undefined {
    const cookiesFn = this.detectNextJSCookies();
    if (!cookiesFn) return undefined;

    return (name: string, value: string, options: any = {}) => {
      try {
        const cookieStore = cookiesFn();
        if (cookieStore?.set && typeof cookieStore.set === 'function') {
          cookieStore.set(name, value, {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days default
            httpOnly: false,
            ...options,
          });
        }
      } catch (error) {
        console.warn(`Failed to set Next.js cookie ${name}:`, (error as Error).message);
      }
    };
  }

  /**
   * Detects Express.js or similar server context
   */
  private static detectExpressContext(context: AuthContext): void {
    try {
      if (global && (global as any).req && (global as any).res) {
        context.req = (global as any).req;
        context.res = (global as any).res;
      }
    } catch {
      // No Express context available
    }
  }

  /**
   * Reset cached context (useful for testing)
   */
  static resetContext(): void {
    this.cachedContext = null;
    this.detectionAttempted = false;
  }

  /**
   * Check if we're in a server environment
   */
  static isServer(): boolean {
    return typeof window === 'undefined';
  }

  /**
   * Check if we're in a Next.js environment
   */
  static isNextJS(): boolean {
    try {
      require('next/headers');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get environment info for debugging
   */
  static getEnvironmentInfo() {
    return {
      isServer: this.isServer(),
      isNextJS: this.isNextJS(),
      hasWindow: typeof window !== 'undefined',
      hasDocument: typeof document !== 'undefined',
      hasGlobal: typeof global !== 'undefined',
      nodeEnv: process.env.NODE_ENV,
    };
  }
}

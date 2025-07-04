import type { AuthContext } from '../types/config';

export class ContextDetector {
  private static cachedContext: AuthContext | null = null;
  private static detectionAttempted = false;

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

  private static detectNextJSCookies(): (() => any) | undefined {
    try {
      const nextHeaders = require('next/headers');
      if (nextHeaders?.cookies && typeof nextHeaders.cookies === 'function') {
        return () => {
          try {
            // ONLY CHANGE: Return a promise to support await
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

  private static createNextJSCookieSetter():
    | ((name: string, value: string, options?: any) => void)
    | undefined {
    const cookiesFn = this.detectNextJSCookies();
    if (!cookiesFn) return undefined;

    return (name: string, value: string, options: any = {}) => {
      try {
        // ONLY CHANGE: Await the cookies function properly
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

  static resetContext(): void {
    this.cachedContext = null;
    this.detectionAttempted = false;
  }

  static isServer(): boolean {
    return typeof window === 'undefined';
  }

  static isNextJS(): boolean {
    try {
      require('next/headers');
      return true;
    } catch {
      return false;
    }
  }

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

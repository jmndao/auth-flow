import type { AuthContext } from '../types/config';

export class ContextDetector {
  private static cachedContext: AuthContext | null = null;
  private static detectionAttempted = false;

  /**
   * Automatically detects the runtime context and provides appropriate cookie handling
   */
  static getAutoContext(): AuthContext {
    // Return cached context if already detected
    if (this.detectionAttempted && this.cachedContext) {
      return this.cachedContext;
    }

    this.detectionAttempted = true;
    const context: AuthContext = {};

    // Server-side context detection
    if (typeof window === 'undefined') {
      // Try Next.js App Router
      context.cookies = this.detectNextJSCookies();
      context.headers = this.detectNextJSHeaders();
      context.cookieSetter = this.createNextJSCookieSetter();

      // Try to detect other server frameworks
      if (!context.cookies) {
        this.detectExpressContext(context);
      }
    }

    this.cachedContext = context;
    return context;
  }

  /**
   * Detects Next.js App Router cookies() function with proper async handling
   */
  private static detectNextJSCookies(): (() => Promise<any>) | undefined {
    try {
      // Try to dynamically import Next.js cookies
      const nextHeaders = require('next/headers');
      if (nextHeaders?.cookies && typeof nextHeaders.cookies === 'function') {
        return async () => {
          try {
            // Always await the cookies() function call
            return await nextHeaders.cookies();
          } catch (error) {
            // cookies() called outside request context
            console.warn('[AuthFlow] Next.js cookies() called outside request context:', error);
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
   * Detects Next.js App Router headers() function with proper async handling
   */
  private static detectNextJSHeaders(): (() => Promise<any>) | undefined {
    try {
      const nextHeaders = require('next/headers');
      if (nextHeaders?.headers && typeof nextHeaders.headers === 'function') {
        return async () => {
          try {
            // Always await the headers() function call
            return await nextHeaders.headers();
          } catch (error) {
            console.warn('[AuthFlow] Next.js headers() called outside request context:', error);
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
   * Creates an async cookie setter for Next.js that properly awaits cookies()
   */
  private static createNextJSCookieSetter():
    | ((name: string, value: string, options?: any) => Promise<void>)
    | undefined {
    const cookiesFn = this.detectNextJSCookies();
    if (!cookiesFn) return undefined;

    return async (name: string, value: string, options: any = {}) => {
      try {
        // Await the cookies() function call
        const cookieStore = await cookiesFn();
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
        console.warn(`[AuthFlow] Failed to set Next.js cookie ${name}:`, error);
        throw error; // Re-throw so caller can handle the error
      }
    };
  }

  /**
   * Detects Express.js or similar server context
   */
  private static detectExpressContext(context: AuthContext): void {
    // This would be populated if user provides req/res
    // For now, we'll detect from global context if available
    try {
      // Check if we're in an Express-like environment
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

  /**
   * Creates a safer context for Next.js server actions that handles async properly
   */
  static createServerActionContext(): AuthContext {
    const context: AuthContext = {};

    if (this.isNextJS()) {
      // Return async functions that properly await Next.js APIs
      context.cookies = async () => {
        try {
          const { cookies } = require('next/headers');
          return await cookies();
        } catch (error) {
          console.warn('[AuthFlow] Failed to get Next.js cookies in server action:', error);
          return null;
        }
      };

      context.headers = async () => {
        try {
          const { headers } = require('next/headers');
          return await headers();
        } catch (error) {
          console.warn('[AuthFlow] Failed to get Next.js headers in server action:', error);
          return null;
        }
      };

      context.cookieSetter = async (name: string, value: string, options: any = {}) => {
        try {
          const { cookies } = require('next/headers');
          const cookieStore = await cookies();
          if (cookieStore?.set) {
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
          console.warn(`[AuthFlow] Failed to set cookie ${name} in server action:`, error);
          throw error;
        }
      };
    }

    return context;
  }
}

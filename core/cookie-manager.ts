import type {
  StorageAdapter,
  CookieStorageOptions,
  StorageAdapterContext,
  TokenPair,
} from '../types';

interface CookieManagerOptions extends CookieStorageOptions {
  waitForCookies?: number;
  fallbackToBody?: boolean;
  retryCount?: number;
}

/**
 * Manages cookie storage for tokens across different server and client environments
 * Supports Next.js, Express, and browser environments with automatic fallbacks
 */
export class CookieManager implements StorageAdapter {
  private readonly context: StorageAdapterContext;
  public readonly options: CookieManagerOptions;
  private readonly isServer: boolean;
  private fallbackTokens: TokenPair | null = null;

  constructor(context: StorageAdapterContext = {}, options: CookieManagerOptions = {}) {
    this.context = context;
    this.options = {
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
      waitForCookies: 500,
      fallbackToBody: false, // Disable fallback by default
      retryCount: 3,
      ...options,
    };
    this.isServer = typeof window === 'undefined';
  }

  /**
   * Retrieves a cookie value with retry logic for server environments
   */
  async get(key: string): Promise<string | null> {
    // Always try to read from actual storage first
    for (let attempt = 0; attempt < (this.options.retryCount || 3); attempt++) {
      const value = this.isServer ? await this.getServerCookie(key) : this.getClientCookie(key);

      if (value) {
        return value;
      }

      // Wait before retry
      if (attempt < (this.options.retryCount || 3) - 1) {
        await this.sleep(this.options.waitForCookies || 500);
      }
    }

    // Clear fallback tokens if real cookies are missing
    if (this.fallbackTokens) {
      this.fallbackTokens = null;
    }

    return null;
  }

  /**
   * Sets a cookie value
   */
  set(key: string, value: string): void | Promise<void> {
    if (this.isServer) {
      return this.setServerCookie(key, value);
    } else {
      this.setClientCookie(key, value);
    }
  }

  /**
   * Removes a cookie
   */
  remove(key: string): void | Promise<void> {
    // Clear fallback tokens when removing cookies
    if (this.fallbackTokens) {
      if (
        (key.includes('access') && this.fallbackTokens.accessToken) ||
        (key.includes('refresh') && this.fallbackTokens.refreshToken)
      ) {
        this.fallbackTokens = null;
      }
    }

    if (this.isServer) {
      return this.removeServerCookie(key);
    } else {
      this.removeClientCookie(key);
    }
  }

  /**
   * Clears all managed data
   */
  clear(): void {
    this.fallbackTokens = null;
  }

  /**
   * Sets fallback tokens for when cookies are not immediately available
   */
  setFallbackTokens(tokens: TokenPair): void {
    this.fallbackTokens = tokens;
  }

  /**
   * Gets fallback tokens
   */
  getFallbackTokens(): TokenPair | null {
    return this.fallbackTokens;
  }

  /**
   * Clears fallback tokens
   */
  clearFallbackTokens(): void {
    this.fallbackTokens = null;
  }

  /**
   * Gets current options
   */
  getOptions(): CookieManagerOptions {
    return this.options;
  }

  /**
   * Utility method to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Client-side cookie methods
  private getClientCookie(key: string): string | null {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [cookieKey, cookieValue] = cookie.trim().split('=');
      if (cookieKey === key) {
        return decodeURIComponent(cookieValue);
      }
    }
    return null;
  }

  private setClientCookie(key: string, value: string): void {
    if (typeof document === 'undefined') return;

    const encodedValue = encodeURIComponent(value);
    let cookieString = `${key}=${encodedValue}`;

    if (this.options.maxAge) {
      cookieString += `; Max-Age=${this.options.maxAge}`;
    }
    if (this.options.path) {
      cookieString += `; Path=${this.options.path}`;
    }
    if (this.options.domain) {
      cookieString += `; Domain=${this.options.domain}`;
    }
    if (this.options.secure) {
      cookieString += '; Secure';
    }
    if (this.options.sameSite) {
      cookieString += `; SameSite=${this.options.sameSite}`;
    }

    document.cookie = cookieString;
  }

  private removeClientCookie(key: string): void {
    if (typeof document === 'undefined') return;

    let cookieString = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    if (this.options.path) {
      cookieString += `; Path=${this.options.path}`;
    }
    if (this.options.domain) {
      cookieString += `; Domain=${this.options.domain}`;
    }

    document.cookie = cookieString;
  }

  // Server-side cookie methods
  /**
   * Attempts to retrieve server-side cookie using multiple strategies
   */
  private async getServerCookie(key: string): Promise<string | null> {
    const attempts = [
      // Next.js App Router cookies() API with proper async handling
      async () => {
        if (this.context.cookies && typeof this.context.cookies === 'function') {
          try {
            const cookieStore = await this.context.cookies();

            if (cookieStore && typeof cookieStore.get === 'function') {
              const cookie = cookieStore.get(key);
              return cookie?.value || null;
            }

            if (cookieStore && typeof cookieStore === 'object') {
              return cookieStore[key] || null;
            }
          } catch {
            // Context access failed
          }
        }
        return null;
      },

      // Pre-extracted cookies object
      () => {
        if (this.context.cookiesObject && typeof this.context.cookiesObject === 'object') {
          return this.context.cookiesObject[key] || null;
        }
        return null;
      },

      // Express-style req.cookies
      () => {
        return this.context.req?.cookies?.[key] || null;
      },

      // Direct cookie header parsing
      () => {
        const cookieHeader = this.context.req?.headers?.cookie;
        if (cookieHeader) {
          const cookies = cookieHeader.split(';');
          for (const cookie of cookies) {
            const [cookieKey, cookieValue] = cookie.trim().split('=');
            if (cookieKey === key) {
              return decodeURIComponent(cookieValue);
            }
          }
        }
        return null;
      },

      // Next.js headers() API fallback
      async () => {
        try {
          if (this.context.headers && typeof this.context.headers === 'function') {
            const headers = await this.context.headers();
            const cookieHeader = headers.get('cookie');
            if (cookieHeader) {
              const cookies = cookieHeader.split(';');
              for (const cookie of cookies) {
                const [cookieKey, cookieValue] = cookie.trim().split('=');
                if (cookieKey === key) {
                  return decodeURIComponent(cookieValue);
                }
              }
            }
          }
        } catch {
          // Headers API access failed
        }
        return null;
      },
    ];

    for (const attempt of attempts) {
      try {
        const value = await attempt();
        if (value) {
          return value;
        }
      } catch {
        // Continue to next attempt
      }
    }

    return null;
  }

  /**
   * Sets server-side cookie using multiple strategies
   */
  private async setServerCookie(key: string, value: string): Promise<void> {
    const cookieOptions: any = {
      secure: this.options.secure,
      sameSite: this.options.sameSite,
      path: this.options.path,
      domain: this.options.domain,
      httpOnly: this.options.httpOnly,
    };

    if (this.options.maxAge) {
      cookieOptions.maxAge = this.options.maxAge;
    }

    // Remove undefined values
    Object.keys(cookieOptions).forEach((k) => {
      if (cookieOptions[k] === undefined) {
        delete cookieOptions[k];
      }
    });

    let success = false;

    // Try Next.js cookies() API first with proper async handling
    if (this.context.cookies && typeof this.context.cookies === 'function') {
      try {
        const cookieStore = await this.context.cookies();

        if (cookieStore && cookieStore.set && typeof cookieStore.set === 'function') {
          cookieStore.set(key, value, cookieOptions);
          success = true;
        }
      } catch {
        // Continue to next method
      }
    }

    // Try custom cookie setter
    if (!success && this.context.cookieSetter && typeof this.context.cookieSetter === 'function') {
      try {
        const result = this.context.cookieSetter(key, value, cookieOptions) as any;
        if (result instanceof Promise) {
          await result;
        }
        success = true;
      } catch {
        // Continue to next method
      }
    }

    // Try Express-style res.cookie
    if (!success && this.context.res?.cookie && typeof this.context.res.cookie === 'function') {
      try {
        const expressOptions = { ...cookieOptions };
        if (expressOptions.maxAge) {
          expressOptions.maxAge = expressOptions.maxAge * 1000;
        }
        this.context.res.cookie(key, value, expressOptions);
        success = true;
      } catch {
        // Continue to next method
      }
    }

    // Try Node.js native setHeader as last resort
    if (
      !success &&
      this.context.res?.setHeader &&
      typeof this.context.res.setHeader === 'function'
    ) {
      try {
        const cookieString = this.buildCookieString(key, value, cookieOptions);
        const existingCookies = this.context.res.getHeader('Set-Cookie') || [];
        const cookies = Array.isArray(existingCookies) ? existingCookies : [existingCookies];
        cookies.push(cookieString);
        this.context.res.setHeader('Set-Cookie', cookies);
        success = true;
      } catch {
        // All methods failed
      }
    }
  }

  /**
   * Removes server-side cookie using multiple strategies
   */
  private async removeServerCookie(key: string): Promise<void> {
    const expiredOptions = {
      ...this.options,
      expires: new Date(0),
      maxAge: 0,
    };

    let success = false;

    if (this.context.cookies && typeof this.context.cookies === 'function') {
      try {
        const cookieStore = await this.context.cookies();

        if (cookieStore && cookieStore.delete && typeof cookieStore.delete === 'function') {
          cookieStore.delete(key);
          success = true;
        } else if (cookieStore && cookieStore.set && typeof cookieStore.set === 'function') {
          cookieStore.set(key, '', expiredOptions);
          success = true;
        }
      } catch {
        // Continue to next method
      }
    }

    if (!success && this.context.cookieSetter && typeof this.context.cookieSetter === 'function') {
      try {
        const result = this.context.cookieSetter(key, '', expiredOptions) as any;
        if (result instanceof Promise) {
          await result;
        }
        success = true;
      } catch {
        // Continue to next method
      }
    }

    if (
      !success &&
      this.context.res?.clearCookie &&
      typeof this.context.res.clearCookie === 'function'
    ) {
      try {
        this.context.res.clearCookie(key, expiredOptions);
        success = true;
      } catch {
        // Continue to next method
      }
    }

    if (
      !success &&
      this.context.res?.setHeader &&
      typeof this.context.res.setHeader === 'function'
    ) {
      try {
        const cookieString = this.buildCookieString(key, '', expiredOptions);
        const existingCookies = this.context.res.getHeader('Set-Cookie') || [];
        const cookies = Array.isArray(existingCookies) ? existingCookies : [existingCookies];
        cookies.push(cookieString);
        this.context.res.setHeader('Set-Cookie', cookies);
        success = true;
      } catch {
        // All methods failed
      }
    }
  }

  /**
   * Builds cookie string for raw header setting
   */
  private buildCookieString(key: string, value: string, options: any): string {
    let cookieString = `${key}=${encodeURIComponent(value)}`;

    if (options.expires) {
      cookieString += `; Expires=${options.expires.toUTCString()}`;
    }
    if (options.maxAge && options.maxAge > 0) {
      cookieString += `; Max-Age=${options.maxAge}`;
    }
    if (options.path) {
      cookieString += `; Path=${options.path}`;
    }
    if (options.domain) {
      cookieString += `; Domain=${options.domain}`;
    }
    if (options.secure) {
      cookieString += '; Secure';
    }
    if (options.httpOnly) {
      cookieString += '; HttpOnly';
    }
    if (options.sameSite) {
      cookieString += `; SameSite=${options.sameSite}`;
    }

    return cookieString;
  }
}

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
  debugMode?: boolean;
}

export class CookieManager implements StorageAdapter {
  private readonly context: StorageAdapterContext;
  public readonly options: CookieManagerOptions;
  private readonly isServer: boolean;
  private fallbackTokens: TokenPair | null = null;
  private readonly temporaryStore: Map<string, string> = new Map();
  private successfulAccessMethod: string | null = null;

  constructor(context: StorageAdapterContext = {}, options: CookieManagerOptions = {}) {
    this.context = context;
    this.options = {
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
      waitForCookies: 100,
      fallbackToBody: true,
      retryCount: 1,
      debugMode: false,
      ...options,
    };
    this.isServer = typeof window === 'undefined';
  }

  async get(key: string): Promise<string | null> {
    // Check temporary store first for immediate access
    if (this.temporaryStore.has(key)) {
      return this.temporaryStore.get(key)!;
    }

    // Use cached successful method if available
    if (this.successfulAccessMethod && this.isServer) {
      try {
        const value = await this.trySpecificAccessMethod(key, this.successfulAccessMethod);
        if (value) {
          this.temporaryStore.set(key, value);
          return value;
        }
      } catch {
        // Reset cached method if it fails
        this.successfulAccessMethod = null;
      }
    }

    // Try appropriate cookie access method
    if (this.isServer) {
      const cookieValue = await this.getServerCookie(key);
      if (cookieValue) {
        this.temporaryStore.set(key, cookieValue);
        return cookieValue;
      }
    } else {
      const cookieValue = this.getClientCookie(key);
      if (cookieValue) {
        this.temporaryStore.set(key, cookieValue);
        return cookieValue;
      }
    }

    // Try fallback tokens as last resort
    return this.tryFallbackTokens(key);
  }

  set(key: string, value: string): void {
    // Update temporary store immediately for fast access
    this.temporaryStore.set(key, value);

    // Set cookies without blocking main thread
    if (this.isServer) {
      this.setServerCookie(key, value);
    } else {
      this.setClientCookie(key, value);
    }
  }

  remove(key: string): void {
    this.temporaryStore.delete(key);

    if (this.isServer) {
      this.removeServerCookie(key);
    } else {
      this.removeClientCookie(key);
    }
  }

  clear(): void {
    this.temporaryStore.clear();
  }

  setFallbackTokens(tokens: TokenPair): void {
    this.fallbackTokens = tokens;
    // Cache tokens immediately in temporary store for fast access
    if (tokens.accessToken && tokens.refreshToken) {
      this.temporaryStore.set('token', tokens.accessToken);
      this.temporaryStore.set('accessToken', tokens.accessToken);
      this.temporaryStore.set('refreshToken', tokens.refreshToken);
    }
  }

  getFallbackTokens(): TokenPair | null {
    return this.fallbackTokens;
  }

  getOptions(): CookieManagerOptions {
    return this.options;
  }

  /**
   * Try to get token from fallback storage
   */
  private tryFallbackTokens(key: string): string | null {
    if (this.options.fallbackToBody && this.fallbackTokens) {
      if (key.includes('access') || key === 'token') {
        return this.fallbackTokens.accessToken || null;
      }
      if (key.includes('refresh')) {
        return this.fallbackTokens.refreshToken || null;
      }
    }
    return null;
  }

  /**
   * Get cookie from client-side document
   */
  private getClientCookie(key: string): string | null {
    try {
      if (typeof document === 'undefined') return null;

      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [cookieKey, cookieValue] = cookie.trim().split('=');
        if (cookieKey === key) {
          return decodeURIComponent(cookieValue);
        }
      }
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('Client cookie access failed:', error);
      }
    }
    return null;
  }

  /**
   * Set cookie on client-side
   */
  private setClientCookie(key: string, value: string): void {
    try {
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
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('Client cookie setting failed:', error);
      }
    }
  }

  /**
   * Remove cookie from client-side
   */
  private removeClientCookie(key: string): void {
    try {
      if (typeof document === 'undefined') return;

      let cookieString = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      if (this.options.path) {
        cookieString += `; Path=${this.options.path}`;
      }
      if (this.options.domain) {
        cookieString += `; Domain=${this.options.domain}`;
      }

      document.cookie = cookieString;
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('Client cookie removal failed:', error);
      }
    }
  }

  /**
   * Try a specific cookie access method by name
   */
  private async trySpecificAccessMethod(key: string, method: string): Promise<string | null> {
    switch (method) {
      case 'nextjs-cookies': {
        if (this.context.cookies && typeof this.context.cookies === 'function') {
          const cookieStore = this.context.cookies();
          // ONLY CHANGE: Handle both sync and async cookies
          const resolvedStore = cookieStore instanceof Promise ? await cookieStore : cookieStore;
          if (resolvedStore && typeof resolvedStore.get === 'function') {
            const cookie = resolvedStore.get(key);
            return cookie?.value || null;
          }
        }
        break;
      }

      case 'cookies-object': {
        if (this.context.cookiesObject && typeof this.context.cookiesObject === 'object') {
          return this.context.cookiesObject[key] || null;
        }
        break;
      }

      case 'express-cookies': {
        return this.context.req?.cookies?.[key] || null;
      }

      case 'cookie-header': {
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
        break;
      }
    }
    return null;
  }

  /**
   * Get cookie from server-side using multiple methods
   */
  private async getServerCookie(key: string): Promise<string | null> {
    const accessMethods = [
      {
        name: 'nextjs-cookies',
        fn: async (): Promise<string | null> => {
          if (this.context.cookies && typeof this.context.cookies === 'function') {
            const cookieStore = this.context.cookies();
            // ONLY CHANGE: Handle both sync and async cookies
            const resolvedStore = cookieStore instanceof Promise ? await cookieStore : cookieStore;

            if (resolvedStore && typeof resolvedStore.get === 'function') {
              const cookie = resolvedStore.get(key);
              return cookie?.value || null;
            }

            if (resolvedStore && typeof resolvedStore === 'object') {
              return resolvedStore[key] || null;
            }
          }
          return null;
        },
      },
      {
        name: 'cookies-object',
        fn: (): string | null => {
          if (this.context.cookiesObject && typeof this.context.cookiesObject === 'object') {
            return this.context.cookiesObject[key] || null;
          }
          return null;
        },
      },
      {
        name: 'express-cookies',
        fn: (): string | null => {
          return this.context.req?.cookies?.[key] || null;
        },
      },
      {
        name: 'cookie-header',
        fn: (): string | null => {
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
      },
      {
        name: 'nextjs-headers',
        fn: async (): Promise<string | null> => {
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
          return null;
        },
      },
    ];

    const errors: Error[] = [];

    // Try each method and cache the successful one
    for (const method of accessMethods) {
      try {
        const value = await method.fn();
        if (value) {
          this.successfulAccessMethod = method.name;
          return value;
        }
      } catch (error) {
        errors.push(error as Error);
      }
    }

    // Log errors only in debug mode after all methods failed
    if (this.options.debugMode && errors.length > 0) {
      console.warn(`All server cookie access methods failed for key "${key}":`, errors);
    }

    return null;
  }

  /**
   * Set cookie on server-side using multiple methods
   */
  private setServerCookie(key: string, value: string): void {
    const cookieOptions: Record<string, any> = {
      secure: this.options.secure,
      sameSite: this.options.sameSite,
      path: this.options.path,
      domain: this.options.domain,
      httpOnly: this.options.httpOnly,
    };

    if (this.options.maxAge) {
      cookieOptions.maxAge = this.options.maxAge;
    }

    // Remove undefined values for cleaner options
    Object.keys(cookieOptions).forEach((k) => {
      if (cookieOptions[k] === undefined) {
        delete cookieOptions[k];
      }
    });

    // Execute all cookie setting methods in parallel
    const setOperations = [
      this.context.cookies && typeof this.context.cookies === 'function'
        ? this.setWithNextjsCookies(key, value, cookieOptions)
        : null,

      this.context.cookieSetter && typeof this.context.cookieSetter === 'function'
        ? this.setWithCustomSetter(key, value, cookieOptions)
        : null,

      this.context.res?.cookie && typeof this.context.res.cookie === 'function'
        ? this.setWithExpressCookie(key, value, cookieOptions)
        : null,

      this.context.res?.setHeader && typeof this.context.res.setHeader === 'function'
        ? this.setWithNativeHeader(key, value, cookieOptions)
        : null,
    ];

    // Filter valid operations and execute without blocking
    const validOperations = setOperations.filter((op) => op !== null);
    if (validOperations.length > 0) {
      Promise.allSettled(validOperations).catch(() => {
        // Ignore errors in background cookie setting
      });
    }
  }

  /**
   * Set cookie using Next.js cookies API
   */
  private async setWithNextjsCookies(
    key: string,
    value: string,
    options: Record<string, any>
  ): Promise<void> {
    try {
      const cookieStore = this.context.cookies!();
      // ONLY CHANGE: Handle both sync and async cookies
      const resolvedStore = cookieStore instanceof Promise ? await cookieStore : cookieStore;
      if (resolvedStore && resolvedStore.set && typeof resolvedStore.set === 'function') {
        resolvedStore.set(key, value, options);
      }
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('Next.js cookies set failed:', error);
      }
    }
  }

  /**
   * Set cookie using custom cookie setter function
   */
  private async setWithCustomSetter(
    key: string,
    value: string,
    options: Record<string, any>
  ): Promise<void> {
    try {
      this.context.cookieSetter!(key, value, options);
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('Custom cookie setter failed:', error);
      }
    }
  }

  /**
   * Set cookie using Express response cookie method
   */
  private async setWithExpressCookie(
    key: string,
    value: string,
    options: Record<string, any>
  ): Promise<void> {
    try {
      const expressOptions = { ...options };
      if (expressOptions.maxAge) {
        expressOptions.maxAge = expressOptions.maxAge * 1000; // Express expects milliseconds
      }
      this.context.res!.cookie(key, value, expressOptions);
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('Express cookie set failed:', error);
      }
    }
  }

  /**
   * Set cookie using native Node.js setHeader
   */
  private async setWithNativeHeader(
    key: string,
    value: string,
    options: Record<string, any>
  ): Promise<void> {
    try {
      const cookieString = this.buildCookieString(key, value, options);
      const existingCookies = this.context.res!.getHeader('Set-Cookie') || [];
      const cookies = Array.isArray(existingCookies) ? existingCookies : [existingCookies];
      cookies.push(cookieString);
      this.context.res!.setHeader('Set-Cookie', cookies);
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('Native header cookie set failed:', error);
      }
    }
  }

  /**
   * Remove cookie from server-side using multiple methods
   */
  private removeServerCookie(key: string): void {
    const expiredOptions: Record<string, any> = {
      ...this.options,
      expires: new Date(0),
      maxAge: 0,
    };

    // Execute all removal methods in parallel
    const removeOperations = [
      this.context.cookies ? this.removeWithNextjsCookies(key, expiredOptions) : null,
      this.context.cookieSetter ? this.removeWithCustomSetter(key, expiredOptions) : null,
      this.context.res?.clearCookie ? this.removeWithExpressClear(key, expiredOptions) : null,
      this.context.res?.setHeader ? this.removeWithNativeHeader(key, expiredOptions) : null,
    ];

    const validOperations = removeOperations.filter((op) => op !== null);
    if (validOperations.length > 0) {
      Promise.allSettled(validOperations).catch(() => {
        // Ignore errors in background cookie removal
      });
    }
  }

  /**
   * Remove cookie using Next.js cookies API
   */
  private async removeWithNextjsCookies(key: string, options: Record<string, any>): Promise<void> {
    try {
      const cookieStore = this.context.cookies!();
      // ONLY CHANGE: Handle both sync and async cookies
      const resolvedStore = cookieStore instanceof Promise ? await cookieStore : cookieStore;
      if (resolvedStore && resolvedStore.delete && typeof resolvedStore.delete === 'function') {
        resolvedStore.delete(key);
      } else if (resolvedStore && resolvedStore.set && typeof resolvedStore.set === 'function') {
        resolvedStore.set(key, '', options);
      }
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('Next.js cookies remove failed:', error);
      }
    }
  }

  /**
   * Remove cookie using custom cookie setter
   */
  private async removeWithCustomSetter(key: string, options: Record<string, any>): Promise<void> {
    try {
      this.context.cookieSetter!(key, '', options);
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('Custom cookie setter remove failed:', error);
      }
    }
  }

  /**
   * Remove cookie using Express clearCookie method
   */
  private async removeWithExpressClear(key: string, options: Record<string, any>): Promise<void> {
    try {
      this.context.res!.clearCookie(key, options);
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('Express clear cookie failed:', error);
      }
    }
  }

  /**
   * Remove cookie using native Node.js setHeader
   */
  private async removeWithNativeHeader(key: string, options: Record<string, any>): Promise<void> {
    try {
      const cookieString = this.buildCookieString(key, '', options);
      const existingCookies = this.context.res!.getHeader('Set-Cookie') || [];
      const cookies = Array.isArray(existingCookies) ? existingCookies : [existingCookies];
      cookies.push(cookieString);
      this.context.res!.setHeader('Set-Cookie', cookies);
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('Native header cookie remove failed:', error);
      }
    }
  }

  /**
   * Build cookie string for Set-Cookie header
   */
  private buildCookieString(key: string, value: string, options: Record<string, any>): string {
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

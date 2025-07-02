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
  private readonly options: CookieManagerOptions;
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
      fallbackToBody: true,
      retryCount: 3,
      debugMode: false,
      ...options,
    };
    this.isServer = typeof window === 'undefined';

    if (this.options.debugMode) {
      console.log('CookieManager initialized', { isServer: this.isServer, context: !!context });
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.options.debugMode) {
      console.log(`Cookie get: ${key} (server: ${this.isServer})`);
    }

    // Try multiple times for cookie propagation
    for (let attempt = 0; attempt < (this.options.retryCount || 3); attempt++) {
      const value = this.isServer ? await this.getServerCookie(key) : this.getClientCookie(key);

      if (value) {
        if (this.options.debugMode) {
          console.log(`Cookie found on attempt ${attempt + 1}: ${key}`);
        }
        return value;
      }

      // Use fallback tokens if available
      if (attempt === 0 && this.options.fallbackToBody && this.fallbackTokens) {
        const fallbackValue = key.includes('access')
          ? this.fallbackTokens.accessToken
          : this.fallbackTokens.refreshToken;

        if (fallbackValue) {
          if (this.options.debugMode) {
            console.log(`Using fallback token for ${key}`);
          }
          return fallbackValue;
        }
      }

      // Wait before retry
      if (attempt < (this.options.retryCount || 3) - 1) {
        await this.sleep(this.options.waitForCookies || 500);
      }
    }

    if (this.options.debugMode) {
      console.log(`Cookie not found: ${key}`);
    }
    return null;
  }

  set(key: string, value: string): void {
    if (this.options.debugMode) {
      console.log(`Setting cookie: ${key} (server: ${this.isServer})`);
    }

    if (this.isServer) {
      this.setServerCookie(key, value);
    } else {
      this.setClientCookie(key, value);
    }
  }

  remove(key: string): void {
    if (this.isServer) {
      this.removeServerCookie(key);
    } else {
      this.removeClientCookie(key);
    }
  }

  clear(): void {
    console.warn('Cookie clear() - use remove() for specific tokens');
  }

  setFallbackTokens(tokens: TokenPair): void {
    this.fallbackTokens = tokens;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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

  private async getServerCookie(key: string): Promise<string | null> {
    const attempts = [
      // Next.js App Router cookies() API
      async () => {
        if (this.context.cookies && typeof this.context.cookies === 'function') {
          try {
            const cookieStore = this.context.cookies();
            // Handle both sync and async cookies() calls
            const resolvedStore = cookieStore instanceof Promise ? await cookieStore : cookieStore;
            const cookie = resolvedStore.get(key);
            return cookie?.value || null;
          } catch (error) {
            if (this.options.debugMode) {
              console.warn('Next.js cookies() access failed:', error);
            }
            return null;
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
    ];

    for (const attempt of attempts) {
      try {
        const value = await attempt();
        if (value) {
          if (this.options.debugMode) {
            console.log(`Server cookie found: ${key}`);
          }
          return value;
        }
      } catch (error) {
        if (this.options.debugMode) {
          console.warn(`Cookie access attempt failed:`, error);
        }
      }
    }

    return null;
  }

  private setServerCookie(key: string, value: string): void {
    const cookieOptions: any = {
      secure: this.options.secure,
      sameSite: this.options.sameSite,
      path: this.options.path,
      domain: this.options.domain,
      httpOnly: this.options.httpOnly,
    };

    // Convert maxAge from seconds to milliseconds for some APIs
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

    // Try Next.js cookies() API first
    if (this.context.cookies && typeof this.context.cookies === 'function') {
      try {
        const cookieStore = this.context.cookies();
        if (cookieStore.set && typeof cookieStore.set === 'function') {
          cookieStore.set(key, value, cookieOptions);
          success = true;
          if (this.options.debugMode) {
            console.log(`Cookie set via Next.js API: ${key}`);
          }
        }
      } catch (error) {
        if (this.options.debugMode) {
          console.warn('Next.js cookie setting failed:', error);
        }
      }
    }

    // Try custom cookie setter
    if (!success && this.context.cookieSetter && typeof this.context.cookieSetter === 'function') {
      try {
        this.context.cookieSetter(key, value, cookieOptions);
        success = true;
        if (this.options.debugMode) {
          console.log(`Cookie set via custom setter: ${key}`);
        }
      } catch {
        if (this.options.debugMode) {
          console.warn('Custom cookie setter failed');
        }
      }
    }

    // Try Express-style res.cookie
    if (!success && this.context.res?.cookie && typeof this.context.res.cookie === 'function') {
      try {
        // Express expects maxAge in milliseconds
        const expressOptions = { ...cookieOptions };
        if (expressOptions.maxAge) {
          expressOptions.maxAge = expressOptions.maxAge * 1000;
        }
        this.context.res.cookie(key, value, expressOptions);
        success = true;
        if (this.options.debugMode) {
          console.log(`Cookie set via Express: ${key}`);
        }
      } catch {
        if (this.options.debugMode) {
          console.warn('Express cookie setting failed');
        }
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
        if (this.options.debugMode) {
          console.log(`Cookie set via setHeader: ${key}`);
        }
      } catch {
        if (this.options.debugMode) {
          console.warn('SetHeader cookie setting failed');
        }
      }
    }

    if (!success && this.options.debugMode) {
      console.warn(`Failed to set server cookie: ${key} - no valid context found`);
    }
  }

  private removeServerCookie(key: string): void {
    const expiredOptions = {
      ...this.options,
      expires: new Date(0),
      maxAge: 0,
    };

    // Try all the same methods as setServerCookie but with expired options
    let success = false;

    if (this.context.cookies && typeof this.context.cookies === 'function') {
      try {
        const cookieStore = this.context.cookies();
        if (cookieStore.delete && typeof cookieStore.delete === 'function') {
          cookieStore.delete(key);
          success = true;
        } else if (cookieStore.set && typeof cookieStore.set === 'function') {
          cookieStore.set(key, '', expiredOptions);
          success = true;
        }
      } catch {
        // Continue to next method
      }
    }

    if (!success && this.context.cookieSetter && typeof this.context.cookieSetter === 'function') {
      try {
        this.context.cookieSetter(key, '', expiredOptions);
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
        // Final attempt failed
      }
    }
  }

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

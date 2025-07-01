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
  }

  async get(key: string): Promise<string | null> {
    if (this.options.debugMode) {
      console.log(`Cookie get: ${key}`);
    }

    // Try multiple times for cookie propagation
    for (let attempt = 0; attempt < (this.options.retryCount || 3); attempt++) {
      const value = this.isServer ? this.getServerCookie(key) : this.getClientCookie(key);

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
      console.log(`Setting cookie: ${key}`);
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

  // Store tokens for fallback during cookie propagation delays
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

  private getServerCookie(key: string): string | null {
    // Try multiple cookie access patterns
    const attempts = [
      () => this.context.req?.cookies?.[key],
      () => {
        if (this.context.cookies && typeof this.context.cookies === 'function') {
          try {
            const cookieStore = this.context.cookies();
            return cookieStore.get?.(key)?.value;
          } catch {
            return null;
          }
        }
        return null;
      },
      () => {
        // Parse cookie header directly
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
        const value = attempt();
        if (value) return value;
      } catch (error) {
        if (this.options.debugMode) {
          console.warn(`Cookie access attempt failed:`, error);
        }
      }
    }

    return null;
  }

  private setServerCookie(key: string, value: string): void {
    if (!this.context.res) return;

    const cookieOptions: any = {
      maxAge: this.options.maxAge ? this.options.maxAge * 1000 : undefined,
      secure: this.options.secure,
      sameSite: this.options.sameSite,
      path: this.options.path,
      domain: this.options.domain,
      httpOnly: this.options.httpOnly,
    };

    // Remove undefined values
    Object.keys(cookieOptions).forEach((key) => {
      if (cookieOptions[key] === undefined) {
        delete cookieOptions[key];
      }
    });

    if (this.context.res.cookie) {
      this.context.res.cookie(key, value, cookieOptions);
    } else if (this.context.res.setHeader) {
      const cookieString = this.buildCookieString(key, value, cookieOptions);
      this.context.res.setHeader('Set-Cookie', cookieString);
    }
  }

  private removeServerCookie(key: string): void {
    if (!this.context.res) return;

    const expiredOptions = {
      ...this.options,
      expires: new Date(0),
    };

    if (this.context.res.clearCookie) {
      this.context.res.clearCookie(key, expiredOptions);
    } else if (this.context.res.setHeader) {
      const cookieString = this.buildCookieString(key, '', {
        ...expiredOptions,
        expires: new Date(0),
      });
      this.context.res.setHeader('Set-Cookie', cookieString);
    }
  }

  private buildCookieString(key: string, value: string, options: any): string {
    let cookieString = `${key}=${encodeURIComponent(value)}`;

    if (options.expires) {
      cookieString += `; Expires=${options.expires.toUTCString()}`;
    }
    if (options.maxAge) {
      cookieString += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
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

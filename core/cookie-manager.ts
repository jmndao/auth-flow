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

    // First check temporary store for immediate access
    if (this.temporaryStore.has(key)) {
      const value = this.temporaryStore.get(key)!;
      if (this.options.debugMode) {
        console.log(`Found in temporary store: ${key}`);
      }
      return value;
    }

    // Then try server or client cookie access
    if (this.isServer) {
      const cookieValue = await this.getServerCookie(key);
      if (cookieValue) {
        // Store in temporary store for subsequent access
        this.temporaryStore.set(key, cookieValue);
        return cookieValue;
      }
    } else {
      // Client-side cookie access
      const cookieValue = this.getClientCookie(key);
      if (cookieValue) {
        this.temporaryStore.set(key, cookieValue);
        return cookieValue;
      }
    }

    // Finally try fallback tokens
    return this.tryFallbackTokens(key);
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

  set(key: string, value: string): void {
    this.temporaryStore.set(key, value);

    if (this.options.debugMode) {
      console.log(`Stored in temporary store: ${key}`);
    }

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
    console.warn('Cookie clear() - temporary store cleared');
  }

  setFallbackTokens(tokens: TokenPair): void {
    this.fallbackTokens = tokens;
    if (this.options.debugMode) {
      console.log('Fallback tokens set:', tokens);
    }
  }

  getFallbackTokens(): TokenPair | null {
    return this.fallbackTokens;
  }

  getOptions(): CookieManagerOptions {
    return this.options;
  }

  private tryFallbackTokens(key: string): string | null {
    if (this.options.fallbackToBody && this.fallbackTokens) {
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
      async () => {
        if (this.context.cookies && typeof this.context.cookies === 'function') {
          try {
            const cookieStore = this.context.cookies();

            const resolvedStore = cookieStore instanceof Promise ? await cookieStore : cookieStore;

            if (resolvedStore && typeof resolvedStore.get === 'function') {
              const cookie = resolvedStore.get(key);
              return cookie?.value || null;
            }

            if (resolvedStore && typeof resolvedStore === 'object') {
              return resolvedStore[key] || null;
            }
          } catch (error) {
            if (this.options.debugMode) {
              console.warn('Next.js cookies() access failed:', (error as Error).message);
            }
          }
        }
        return null;
      },

      () => {
        if (this.context.cookiesObject && typeof this.context.cookiesObject === 'object') {
          return this.context.cookiesObject[key] || null;
        }
        return null;
      },

      () => {
        return this.context.req?.cookies?.[key] || null;
      },

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
        } catch (error) {
          if (this.options.debugMode) {
            console.warn('Headers API access failed:', (error as Error).message);
          }
        }
        return null;
      },
    ];

    for (const [index, attempt] of attempts.entries()) {
      try {
        const value = await attempt();
        if (value) {
          if (this.options.debugMode) {
            console.log(`Server cookie found via method ${index + 1}: ${key}`);
          }
          return value;
        }
      } catch (error) {
        if (this.options.debugMode) {
          console.warn(`Cookie access attempt ${index + 1} failed:`, (error as Error).message);
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

    if (this.options.maxAge) {
      cookieOptions.maxAge = this.options.maxAge;
    }

    Object.keys(cookieOptions).forEach((k) => {
      if (cookieOptions[k] === undefined) {
        delete cookieOptions[k];
      }
    });

    let success = false;

    if (this.context.cookies && typeof this.context.cookies === 'function') {
      try {
        const cookieStore = this.context.cookies();
        const resolvedStore =
          cookieStore instanceof Promise ? cookieStore : Promise.resolve(cookieStore);

        resolvedStore
          .then((store) => {
            if (store && store.set && typeof store.set === 'function') {
              store.set(key, value, cookieOptions);
              success = true;
              if (this.options.debugMode) {
                console.log(`Cookie set via Next.js API: ${key}`);
              }
            }
          })
          .catch((error) => {
            if (this.options.debugMode) {
              console.warn('Next.js cookie setting failed:', (error as Error).message);
            }
          });
      } catch (error) {
        if (this.options.debugMode) {
          console.warn('Next.js cookie setting failed:', (error as Error).message);
        }
      }
    }

    if (!success && this.context.cookieSetter && typeof this.context.cookieSetter === 'function') {
      try {
        this.context.cookieSetter(key, value, cookieOptions);
        success = true;
        if (this.options.debugMode) {
          console.log(`Cookie set via custom setter: ${key}`);
        }
      } catch (error) {
        if (this.options.debugMode) {
          console.warn('Custom cookie setter failed:', (error as Error).message);
        }
      }
    }

    if (!success && this.context.res?.cookie && typeof this.context.res.cookie === 'function') {
      try {
        const expressOptions = { ...cookieOptions };
        if (expressOptions.maxAge) {
          expressOptions.maxAge = expressOptions.maxAge * 1000;
        }
        this.context.res.cookie(key, value, expressOptions);
        success = true;
        if (this.options.debugMode) {
          console.log(`Cookie set via Express: ${key}`);
        }
      } catch (error) {
        if (this.options.debugMode) {
          console.warn('Express cookie setting failed:', (error as Error).message);
        }
      }
    }

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
      } catch (error) {
        if (this.options.debugMode) {
          console.warn('SetHeader cookie setting failed:', (error as Error).message);
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

    let success = false;

    if (this.context.cookies && typeof this.context.cookies === 'function') {
      try {
        const cookieStore = this.context.cookies();
        const resolvedStore =
          cookieStore instanceof Promise ? cookieStore : Promise.resolve(cookieStore);

        resolvedStore
          .then((store) => {
            if (store && store.delete && typeof store.delete === 'function') {
              store.delete(key);
              success = true;
            } else if (store && store.set && typeof store.set === 'function') {
              store.set(key, '', expiredOptions);
              success = true;
            }
          })
          .catch(() => {
            // Continue to next method
          });
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

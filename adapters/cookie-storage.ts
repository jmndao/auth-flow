import type { StorageAdapter, CookieStorageOptions, StorageAdapterContext } from '../types';

export class CookieStorageAdapter implements StorageAdapter {
  private readonly context: StorageAdapterContext;
  private readonly options: CookieStorageOptions;
  private readonly isServer: boolean;

  constructor(context: StorageAdapterContext = {}, options: CookieStorageOptions = {}) {
    this.context = context;
    this.options = {
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400, // 24 hours
      ...options,
    };
    this.isServer = typeof window === 'undefined';
  }

  get(key: string): string | null {
    if (this.isServer) {
      return this.getServerSideCookie(key);
    } else {
      return this.getClientSideCookie(key);
    }
  }

  set(key: string, value: string): void {
    if (this.isServer) {
      this.setServerSideCookie(key, value);
    } else {
      this.setClientSideCookie(key, value);
    }
  }

  remove(key: string): void {
    if (this.isServer) {
      this.removeServerSideCookie(key);
    } else {
      this.removeClientSideCookie(key);
    }
  }

  clear(): void {
    // Can't clear all cookies, only warn
    console.warn('Cookie clear() not implemented - clear tokens individually');
  }

  // Client-side cookie methods
  private getClientSideCookie(key: string): string | null {
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

  private setClientSideCookie(key: string, value: string): void {
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

  private removeClientSideCookie(key: string): void {
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
  private getServerSideCookie(key: string): string | null {
    // Try different cookie access patterns
    if (this.context.req?.cookies) {
      return this.context.req.cookies[key] || null;
    }

    // Try Next.js style
    if (this.context.cookies && typeof this.context.cookies === 'function') {
      try {
        const cookieStore = this.context.cookies();
        return cookieStore.get(key)?.value || null;
      } catch {
        // Fallback
      }
    }

    return null;
  }

  private setServerSideCookie(key: string, value: string): void {
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
      // Express-style
      this.context.res.cookie(key, value, cookieOptions);
    } else if (this.context.res.setHeader) {
      // Node.js native style
      const cookieString = this.buildCookieString(key, value, cookieOptions);
      this.context.res.setHeader('Set-Cookie', cookieString);
    }
  }

  private removeServerSideCookie(key: string): void {
    if (!this.context.res) return;

    const expiredOptions = {
      ...this.options,
      expires: new Date(0),
    };

    if (this.context.res.clearCookie) {
      // Express-style
      this.context.res.clearCookie(key, expiredOptions);
    } else if (this.context.res.setHeader) {
      // Node.js native style
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

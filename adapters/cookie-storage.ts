import type { StorageAdapter, CookieStorageOptions, StorageAdapterContext } from '../types';

export class CookieStorageAdapter implements StorageAdapter {
  private readonly context: StorageAdapterContext;
  private readonly options: CookieStorageOptions;
  private readonly isServer: boolean;

  constructor(context: StorageAdapterContext = {}, options: CookieStorageOptions = {}) {
    this.context = context;
    this.options = {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400, // 24 hours
      httpOnly: false,
      ...options,
    };
    this.isServer = typeof window === 'undefined';
  }

  async get(key: string): Promise<string | null> {
    if (this.isServer) {
      return this.getServerCookie(key);
    } else {
      return this.getClientCookie(key);
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (this.isServer) {
      this.setServerCookie(key, value);
    } else {
      this.setClientCookie(key, value);
    }
  }

  async remove(key: string): Promise<void> {
    if (this.isServer) {
      this.removeServerCookie(key);
    } else {
      this.removeClientCookie(key);
    }
  }

  async clear(): Promise<void> {
    console.warn('Cookie clear() not implemented - clear tokens individually');
  }

  private getClientCookie(key: string): string | null {
    if (typeof document === 'undefined') return null;

    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [cookieKey, cookieValue] = cookie.trim().split('=');
        if (cookieKey === key) {
          return decodeURIComponent(cookieValue);
        }
      }
    } catch (error) {
      console.warn('Failed to read client cookie:', error);
    }

    return null;
  }

  private setClientCookie(key: string, value: string): void {
    if (typeof document === 'undefined') return;

    try {
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
      console.warn('Failed to set client cookie:', error);
    }
  }

  private removeClientCookie(key: string): void {
    if (typeof document === 'undefined') return;

    try {
      let cookieString = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;

      if (this.options.path) {
        cookieString += `; Path=${this.options.path}`;
      }
      if (this.options.domain) {
        cookieString += `; Domain=${this.options.domain}`;
      }

      document.cookie = cookieString;
    } catch (error) {
      console.warn('Failed to remove client cookie:', error);
    }
  }

  private async getServerCookie(key: string): Promise<string | null> {
    // Try Next.js cookies() function - ONLY CHANGE: properly await
    if (this.context.cookies && typeof this.context.cookies === 'function') {
      try {
        const cookieStore = await this.context.cookies();
        if (cookieStore && typeof cookieStore.get === 'function') {
          const cookie = cookieStore.get(key);
          return cookie?.value || null;
        }
      } catch (error) {
        console.warn('Failed to access Next.js cookies:', error);
      }
    }

    // Try Express-style cookies
    if (this.context.req?.cookies) {
      return this.context.req.cookies[key] || null;
    }

    // Try parsing cookie header
    if (this.context.req?.headers?.cookie) {
      try {
        const cookies = this.context.req.headers.cookie.split(';');
        for (const cookie of cookies) {
          const [cookieKey, cookieValue] = cookie.trim().split('=');
          if (cookieKey === key) {
            return decodeURIComponent(cookieValue);
          }
        }
      } catch (error) {
        console.warn('Failed to parse cookie header:', error);
      }
    }

    return null;
  }

  private setServerCookie(key: string, value: string): void {
    const cookieOptions = this.buildCookieOptions();

    // Try custom cookie setter first
    if (this.context.cookieSetter && typeof this.context.cookieSetter === 'function') {
      try {
        this.context.cookieSetter(key, value, cookieOptions);
        return;
      } catch (error) {
        console.warn('Custom cookie setter failed:', error);
      }
    }

    // Try Express-style response.cookie
    if (this.context.res?.cookie && typeof this.context.res.cookie === 'function') {
      try {
        const expressOptions = { ...cookieOptions };
        if (expressOptions.maxAge) {
          expressOptions.maxAge = expressOptions.maxAge * 1000; // Express expects milliseconds
        }
        this.context.res.cookie(key, value, expressOptions);
        return;
      } catch (error) {
        console.warn('Express cookie setting failed:', error);
      }
    }

    // Try native setHeader as fallback
    if (this.context.res?.setHeader && typeof this.context.res.setHeader === 'function') {
      try {
        const cookieString = this.buildCookieString(key, value, cookieOptions);
        const existingCookies = this.context.res.getHeader('Set-Cookie') || [];
        const cookies = Array.isArray(existingCookies) ? existingCookies : [existingCookies];
        cookies.push(cookieString);
        this.context.res.setHeader('Set-Cookie', cookies);
      } catch (error) {
        console.warn('Native setHeader cookie setting failed:', error);
      }
    }
  }

  private removeServerCookie(key: string): void {
    const expiredOptions = {
      ...this.buildCookieOptions(),
      expires: new Date(0),
      maxAge: 0,
    };

    // Try custom cookie setter
    if (this.context.cookieSetter && typeof this.context.cookieSetter === 'function') {
      try {
        this.context.cookieSetter(key, '', expiredOptions);
        return;
      } catch (error) {
        console.warn('Custom cookie setter removal failed:', error);
      }
    }

    // Try Express clearCookie
    if (this.context.res?.clearCookie && typeof this.context.res.clearCookie === 'function') {
      try {
        this.context.res.clearCookie(key, expiredOptions);
        return;
      } catch (error) {
        console.warn('Express clearCookie failed:', error);
      }
    }

    // Try native setHeader
    if (this.context.res?.setHeader && typeof this.context.res.setHeader === 'function') {
      try {
        const cookieString = this.buildCookieString(key, '', expiredOptions);
        const existingCookies = this.context.res.getHeader('Set-Cookie') || [];
        const cookies = Array.isArray(existingCookies) ? existingCookies : [existingCookies];
        cookies.push(cookieString);
        this.context.res.setHeader('Set-Cookie', cookies);
      } catch (error) {
        console.warn('Native setHeader cookie removal failed:', error);
      }
    }
  }

  private buildCookieOptions(): Record<string, any> {
    const options: Record<string, any> = {
      secure: this.options.secure,
      sameSite: this.options.sameSite,
      path: this.options.path,
      httpOnly: this.options.httpOnly,
    };

    if (this.options.maxAge) {
      options.maxAge = this.options.maxAge;
    }
    if (this.options.domain) {
      options.domain = this.options.domain;
    }

    // Remove undefined values
    Object.keys(options).forEach((key) => {
      if (options[key] === undefined) {
        delete options[key];
      }
    });

    return options;
  }

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

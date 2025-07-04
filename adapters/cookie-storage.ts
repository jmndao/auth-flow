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
      maxAge: 86400,
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

  /**
   * Set cookie value
   */
  async set(key: string, value: string): Promise<void> {
    if (this.isServer) {
      await this.setServerCookie(key, value);
    } else {
      this.setClientCookie(key, value);
    }
  }

  async remove(key: string): Promise<void> {
    if (this.isServer) {
      await this.removeServerCookie(key);
    } else {
      this.removeClientCookie(key);
    }
  }

  async clear(): Promise<void> {
    // Not implemented for security
  }

  /**
   * Get cookie from client-side document
   */
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
    } catch {
      // Silently handle client cookie errors
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
    } catch {
      // Silently handle client cookie setting errors
    }
  }

  /**
   * Remove cookie from client-side
   */
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
    } catch {
      // Silently handle client cookie removal errors
    }
  }

  private async getServerCookie(key: string): Promise<string | null> {
    // Try Next.js cookies() function with proper await
    if (this.context.cookies && typeof this.context.cookies === 'function') {
      try {
        const cookieStore = await this.context.cookies();
        if (cookieStore && typeof cookieStore.get === 'function') {
          const cookie = cookieStore.get(key);
          return cookie?.value || null;
        }
      } catch {
        // Continue to next method
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
      } catch {
        // Continue if parsing fails
      }
    }

    return null;
  }

  private async setServerCookie(key: string, value: string): Promise<void> {
    const cookieOptions = this.buildCookieOptions();

    // Try custom cookie setter first (async)
    if (this.context.cookieSetter && typeof this.context.cookieSetter === 'function') {
      try {
        await this.context.cookieSetter(key, value, cookieOptions);
        return;
      } catch {
        // Continue to next method
      }
    }

    // Try Next.js cookies() with proper await
    if (this.context.cookies && typeof this.context.cookies === 'function') {
      try {
        const cookieStore = await this.context.cookies();
        if (cookieStore && typeof cookieStore.set === 'function') {
          cookieStore.set(key, value, cookieOptions);
          return;
        }
      } catch {
        // Continue to next method
      }
    }

    // Try Express-style response.cookie
    if (this.context.res?.cookie && typeof this.context.res.cookie === 'function') {
      try {
        const expressOptions = { ...cookieOptions };
        if (expressOptions.maxAge) {
          expressOptions.maxAge = expressOptions.maxAge * 1000;
        }
        this.context.res.cookie(key, value, expressOptions);
        return;
      } catch {
        // Continue to next method
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
      } catch {
        // Final fallback failed
      }
    }
  }

  private async removeServerCookie(key: string): Promise<void> {
    const expiredOptions = {
      ...this.buildCookieOptions(),
      expires: new Date(0),
      maxAge: 0,
    };

    // Try custom cookie setter (async)
    if (this.context.cookieSetter && typeof this.context.cookieSetter === 'function') {
      try {
        await this.context.cookieSetter(key, '', expiredOptions);
        return;
      } catch {
        // Continue to next method
      }
    }

    // Try Next.js cookies() with proper await
    if (this.context.cookies && typeof this.context.cookies === 'function') {
      try {
        const cookieStore = await this.context.cookies();
        if (cookieStore && typeof cookieStore.delete === 'function') {
          cookieStore.delete(key);
          return;
        } else if (cookieStore && typeof cookieStore.set === 'function') {
          cookieStore.set(key, '', expiredOptions);
          return;
        }
      } catch {
        // Continue to next method
      }
    }

    // Try Express clearCookie
    if (this.context.res?.clearCookie && typeof this.context.res.clearCookie === 'function') {
      try {
        this.context.res.clearCookie(key, expiredOptions);
        return;
      } catch {
        // Continue to next method
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
      } catch {
        // Final cleanup failed
      }
    }
  }

  /**
   * Build cookie options object
   */
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

    Object.keys(options).forEach((key) => {
      if (options[key] === undefined) {
        delete options[key];
      }
    });

    return options;
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

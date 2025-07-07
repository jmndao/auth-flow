import type { StorageAdapter } from '../types';

/**
 * Universal cookie storage adapter
 * Works in both browser and server environments
 */
export class CookieStorage implements StorageAdapter {
  private readonly isServer: boolean;
  private readonly options: CookieOptions;

  constructor(options: CookieOptions = {}) {
    this.isServer = typeof window === 'undefined';
    this.options = {
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      ...options,
    };
  }

  async get(key: string): Promise<string | null> {
    if (this.isServer) {
      return this.getServerCookie(key);
    }
    return this.getBrowserCookie(key);
  }

  async set(key: string, value: string): Promise<void> {
    if (this.isServer) {
      await this.setServerCookie(key, value);
    } else {
      this.setBrowserCookie(key, value);
    }
  }

  async remove(key: string): Promise<void> {
    if (this.isServer) {
      await this.removeServerCookie(key);
    } else {
      this.removeBrowserCookie(key);
    }
  }

  async clear(): Promise<void> {
    // Cannot clear all cookies generically
  }

  private getBrowserCookie(key: string): string | null {
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

  private setBrowserCookie(key: string, value: string): void {
    if (typeof document === 'undefined') return;

    const encodedValue = encodeURIComponent(value);
    let cookieString = `${key}=${encodedValue}`;

    if (this.options.maxAge) {
      cookieString += `; Max-Age=${this.options.maxAge}`;
    }
    if (this.options.path) {
      cookieString += `; Path=${this.options.path}`;
    }
    if (this.options.secure) {
      cookieString += '; Secure';
    }
    if (this.options.sameSite) {
      cookieString += `; SameSite=${this.options.sameSite}`;
    }

    document.cookie = cookieString;
  }

  private removeBrowserCookie(key: string): void {
    if (typeof document === 'undefined') return;

    let cookieString = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    if (this.options.path) {
      cookieString += `; Path=${this.options.path}`;
    }
    document.cookie = cookieString;
  }

  private async getServerCookie(key: string): Promise<string | null> {
    try {
      // Try Next.js cookies() API
      const { cookies } = await require('next/headers');
      const cookieStore = await cookies();
      return cookieStore.get(key)?.value || null;
    } catch {
      // Next.js not available or cookies() failed
      return null;
    }
  }

  private async setServerCookie(key: string, value: string): Promise<void> {
    try {
      // Try Next.js cookies() API
      const { cookies } = await require('next/headers');
      const cookieStore = await cookies();
      cookieStore.set(key, value, this.options);
    } catch {
      // Server cookie setting failed - this is expected in many contexts
      // Framework-specific helpers should handle this
    }
  }

  private async removeServerCookie(key: string): Promise<void> {
    try {
      const { cookies } = await require('next/headers');
      const cookieStore = await cookies();
      cookieStore.delete(key);
    } catch {
      // Server cookie removal failed
    }
  }
}

interface CookieOptions {
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;
  maxAge?: number;
  httpOnly?: boolean;
}

import type { StorageAdapter } from '../types';

/**
 * Browser storage adapter with localStorage and sessionStorage fallback
 * Designed for client-side environments
 */
export class BrowserStorage implements StorageAdapter {
  private preferredStorage: Storage | null = null;
  private fallbackStorage: Storage | null = null;

  constructor() {
    this.initializeStorage();
  }

  private initializeStorage(): void {
    try {
      // Test localStorage availability
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('__auth_test__', 'test');
        localStorage.removeItem('__auth_test__');
        this.preferredStorage = localStorage;
      }
    } catch {
      // localStorage not available or blocked
    }

    try {
      // Test sessionStorage as fallback
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('__auth_test__', 'test');
        sessionStorage.removeItem('__auth_test__');
        this.fallbackStorage = sessionStorage;
      }
    } catch {
      // sessionStorage not available or blocked
    }
  }

  get(key: string): string | null {
    try {
      return this.preferredStorage?.getItem(key) || this.fallbackStorage?.getItem(key) || null;
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      this.preferredStorage?.setItem(key, value);
    } catch {
      try {
        this.fallbackStorage?.setItem(key, value);
      } catch {
        // Both storage methods failed - silent failure
      }
    }
  }

  remove(key: string): void {
    try {
      this.preferredStorage?.removeItem(key);
      this.fallbackStorage?.removeItem(key);
    } catch {
      // Silent failure
    }
  }

  clear(): void {
    try {
      this.preferredStorage?.clear();
      this.fallbackStorage?.clear();
    } catch {
      // Silent failure
    }
  }

  isAvailable(): boolean {
    return this.preferredStorage !== null || this.fallbackStorage !== null;
  }
}

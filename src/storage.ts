import { StorageAdapter } from './types';

/**
 * Memory storage adapter (fallback)
 */
class MemoryStorage implements StorageAdapter {
  private readonly store = new Map<string, string>();

  get(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.store.set(key, value);
  }

  remove(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Browser storage adapter with fallback support
 */
class BrowserStorage implements StorageAdapter {
  private readonly storage: Storage | null;
  private readonly fallback = new MemoryStorage();

  constructor(type: 'localStorage' | 'sessionStorage') {
    this.storage = this.getStorage(type);
  }

  private getStorage(type: 'localStorage' | 'sessionStorage'): Storage | null {
    try {
      const storage = type === 'localStorage' ? localStorage : sessionStorage;
      // Test storage availability
      const testKey = '__auth_flow_test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return storage;
    } catch {
      return null;
    }
  }

  get(key: string): string | null {
    if (this.storage) {
      try {
        return this.storage.getItem(key);
      } catch {
        // Fall back to memory storage
      }
    }
    return this.fallback.get(key);
  }

  set(key: string, value: string): void {
    if (this.storage) {
      try {
        this.storage.setItem(key, value);
        return;
      } catch {
        // Fall back to memory storage
      }
    }
    this.fallback.set(key, value);
  }

  remove(key: string): void {
    if (this.storage) {
      try {
        this.storage.removeItem(key);
      } catch {
        // Continue to fallback
      }
    }
    this.fallback.remove(key);
  }

  clear(): void {
    if (this.storage) {
      try {
        this.storage.clear();
      } catch {
        // Continue to fallback
      }
    }
    this.fallback.clear();
  }
}

/**
 * Create storage adapter based on type
 */
export function createStorage(type: 'localStorage' | 'sessionStorage' | 'memory'): StorageAdapter {
  if (type === 'memory') {
    return new MemoryStorage();
  }
  return new BrowserStorage(type);
}

import type { StorageAdapter } from '../types';

/**
 * In-memory storage adapter
 * Fallback storage that works in all environments
 */
export class MemoryStorage implements StorageAdapter {
  private readonly storage = new Map<string, string>();

  get(key: string): string | null {
    return this.storage.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.storage.set(key, value);
  }

  remove(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }
}

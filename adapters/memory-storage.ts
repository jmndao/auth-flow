import type { StorageAdapter } from '../types';

export class MemoryStorageAdapter implements StorageAdapter {
  private storage: Map<string, string> = new Map();

  get(key: string): string | null {
    return this.storage.get(key) || null;
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

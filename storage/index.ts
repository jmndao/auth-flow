import type { StorageAdapter } from '../types';
import { MemoryStorage } from './memory';
import { BrowserStorage } from './browser';
import { CookieStorage } from './cookie';

/**
 * Smart storage adapter selection
 * Automatically chooses the best storage option for the current environment
 */
export function createStorageAdapter(
  type: 'auto' | 'memory' | 'browser' | 'cookies' = 'auto'
): StorageAdapter {
  if (type === 'memory') {
    return new MemoryStorage();
  }

  if (type === 'browser') {
    return new BrowserStorage();
  }

  if (type === 'cookies') {
    return new CookieStorage();
  }

  // Auto-selection logic
  return selectOptimalStorage();
}

function selectOptimalStorage(): StorageAdapter {
  const isServer = typeof window === 'undefined';

  if (isServer) {
    // Server environment: prefer cookies, fallback to memory
    return new CookieStorage();
  }

  // Browser environment: try browser storage first, then cookies, then memory
  const browserStorage = new BrowserStorage();
  if (browserStorage.isAvailable()) {
    return browserStorage;
  }

  return new CookieStorage();
}

export { MemoryStorage, BrowserStorage, CookieStorage };

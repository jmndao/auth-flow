import type { Environment, StorageType } from '../types';

export function detectEnvironment(): Environment {
  if (typeof window === 'undefined') {
    return 'server';
  }

  if (typeof document !== 'undefined') {
    return 'client';
  }

  return 'server'; // Default fallback
}

export function isServerEnvironment(): boolean {
  return typeof window === 'undefined';
}

export function isClientEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function getOptimalStorageType(environment?: Environment): StorageType {
  const env = environment === 'auto' ? detectEnvironment() : environment;

  switch (env) {
    case 'client':
      // Prefer localStorage, fallback to cookies, then memory
      if (typeof localStorage !== 'undefined') {
        return 'localStorage';
      }
      if (typeof document !== 'undefined') {
        return 'cookies';
      }
      return 'memory';

    case 'server':
      // Server environment prefers cookies for persistence
      return 'cookies';

    default:
      return 'memory';
  }
}

export function supportsLocalStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;

    const testKey = '__authflow_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function supportsCookies(): boolean {
  if (isServerEnvironment()) {
    // On server, we assume cookies are supported if we have context
    return true;
  }

  try {
    if (typeof document === 'undefined') return false;

    const testKey = '__authflow_test__';
    document.cookie = `${testKey}=test; path=/`;
    const supported = document.cookie.includes(testKey);

    // Clean up test cookie
    document.cookie = `${testKey}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;

    return supported;
  } catch {
    return false;
  }
}

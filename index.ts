import type { AuthConfig } from './types';
import { AuthClient } from './core/auth-client';

/**
 * Main factory function for creating AuthFlow instances
 */
export function createAuthFlow(config: AuthConfig | string): AuthClient {
  const authConfig: AuthConfig = typeof config === 'string' ? { baseURL: config } : config;

  return new AuthClient(authConfig);
}

/**
 * Export types and core classes
 */
export * from './types';
export { AuthClient } from './core/auth-client';
export { TokenManager } from './core/token-manager';
export { createStorageAdapter } from './storage';

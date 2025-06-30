import { AuthClient } from './core/auth-client';
import type { AuthFlowConfig, AuthContext } from './types';

/**
 * Creates a new AuthFlow instance for handling authentication
 *
 * @param config - Configuration object for AuthFlow
 * @param context - Optional context for server-side usage (req, res objects)
 * @returns AuthFlow instance with authentication and HTTP methods
 */
export function createAuthFlow(config: AuthFlowConfig, context?: AuthContext) {
  return new AuthClient(config, context);
}

// Export types for TypeScript users
export type {
  AuthFlowConfig,
  AuthContext,
  TokenPair,
  LoginCredentials,
  LoginResponse,
  RefreshTokenResponse,
  AuthError,
  RequestConfig,
  Environment,
  TokenSource,
  StorageType,
  StorageConfig,
  TokenConfig,
  EndpointsConfig,
  RetryConfig,
  HttpMethod,
  AuthMethods,
  StorageAdapter,
  StorageOptions,
  CookieStorageOptions,
  StorageAdapterContext,
  QueuedRequest,
} from './types';

// Export core classes for advanced usage
export { AuthClient } from './core/auth-client';
export { TokenManager } from './core/token-manager';
export { RequestQueue } from './core/request-queue';
export { ErrorHandler } from './core/error-handler';

// Export adapters for custom implementations
export { LocalStorageAdapter, CookieStorageAdapter, MemoryStorageAdapter } from './adapters';

// Export utilities
export {
  detectEnvironment,
  isServerEnvironment,
  isClientEnvironment,
  getOptimalStorageType,
  supportsLocalStorage,
  supportsCookies,
  validateConfig,
  ValidationError,
  validateTokenPair,
  validateLoginCredentials,
} from './utils';

// Default export for convenience
export default createAuthFlow;

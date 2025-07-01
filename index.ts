import { AuthClient } from './core/auth-client';
import type { AuthFlowConfig, AuthContext } from './types';

/**
 * Creates AuthFlow instance
 * @param config - Config object or baseURL string
 * @param context - Optional server context (auto-detected)
 */
export function createAuthFlow(config: AuthFlowConfig | string, context?: AuthContext) {
  // Allow passing just baseURL for quick setup
  const normalizedConfig: AuthFlowConfig =
    typeof config === 'string'
      ? {
          baseURL: config,
          endpoints: getDefaultEndpoints(),
          tokens: getDefaultTokens(),
        }
      : {
          // Smart defaults - config overrides these
          environment: 'auto',
          tokenSource: 'body',
          storage: 'auto',
          timeout: 10000,
          retry: { attempts: 3, delay: 1000 },
          ...config, // Config comes after defaults
          // Ensure endpoints and tokens have defaults if not provided
          endpoints: config.endpoints || getDefaultEndpoints(),
          tokens: config.tokens || getDefaultTokens(),
        };

  return new AuthClient(normalizedConfig, context);
}

// Default endpoints
function getDefaultEndpoints() {
  return {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
  };
}

// Default token names
function getDefaultTokens() {
  return {
    access: 'accessToken',
    refresh: 'refreshToken',
  };
}

// Export types
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

// Export core classes
export { AuthClient } from './core/auth-client';
export { TokenManager } from './core/token-manager';
export { RequestQueue } from './core/request-queue';
export { ErrorHandler } from './core/error-handler';

// Export adapters
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

export default createAuthFlow;

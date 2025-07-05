import type { AuthFlowConfig, AuthContext } from './types';
import { AuthClient } from './core/auth-client';
import { SingleTokenAuthClient } from './core/single-token-auth';

/**
 * Main factory function for creating standard AuthFlow instances
 */
export function createAuthFlow(config: AuthFlowConfig, context?: AuthContext) {
  return new AuthClient(config, context);
}

/**
 * Creates single token authentication client for backends without refresh tokens
 */
export function createSingleTokenAuth(config: {
  baseURL: string;
  token: { access: string };
  endpoints: {
    login: string;
    logout?: string;
  };
  sessionManagement?: {
    checkInterval?: number;
    renewBeforeExpiry?: number;
    persistCredentials?: boolean;
    onSessionExpired?: () => void;
  };
  timeout?: number;
  onTokenRefresh?: (token: string) => void;
  onAuthError?: (error: any) => void;
  onLogout?: () => void;
}) {
  return new SingleTokenAuthClient(config);
}

/**
 * Preset configurations for common single token scenarios
 */
export const singleTokenPresets = {
  jwtOnly: (baseURL: string, tokenField: string = 'accessToken') => ({
    baseURL,
    token: { access: tokenField },
    endpoints: { login: 'auth/login' },
    sessionManagement: { persistCredentials: true, renewBeforeExpiry: 300 },
  }),

  sessionBased: (baseURL: string) => ({
    baseURL,
    token: { access: 'token' },
    endpoints: { login: 'auth/login', logout: 'auth/logout' },
    sessionManagement: { checkInterval: 60000, renewBeforeExpiry: 300 },
  }),

  apiKey: (baseURL: string, keyField: string = 'apiKey') => ({
    baseURL,
    token: { access: keyField },
    endpoints: { login: 'auth/login' },
    sessionManagement: { persistCredentials: true },
  }),
};

/**
 * Configuration helper for cookie-based authentication
 */
export function createCookieConfig(
  baseURL: string,
  options?: {
    tokenNames?: { access: string; refresh: string };
    cookieOptions?: {
      waitForCookies?: number;
      fallbackToBody?: boolean;
      retryCount?: number;
    };
  }
): AuthFlowConfig {
  return {
    baseURL,
    tokenSource: 'cookies',
    storage: {
      type: 'cookies',
      options: {
        secure: true,
        sameSite: 'lax',
        path: '/',
        ...options?.cookieOptions,
      },
    },
    tokens: options?.tokenNames || { access: 'accessToken', refresh: 'refreshToken' },
    endpoints: {
      login: 'auth/login',
      refresh: 'auth/refresh',
      logout: 'auth/logout',
    },
  };
}

/**
 * Diagnostic utility for troubleshooting cookie-related issues
 */
export async function diagnoseCookieIssues(credentials: any, config: AuthFlowConfig) {
  const auth = createAuthFlow({
    ...config,
    storage: {
      type: 'cookies',
      options: {},
    },
  });

  try {
    await auth.login(credentials);

    const tokens = await auth.getTokens();

    if (tokens) {
      return {
        success: true,
        hasTokens: true,
        accessTokenLength: tokens.accessToken.length,
        refreshTokenLength: tokens.refreshToken.length,
        isAuthenticated: auth.isAuthenticated(),
      };
    } else {
      return {
        success: false,
        hasTokens: false,
        isAuthenticated: auth.isAuthenticated(),
        error: 'No tokens found after login',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export everything from types and core modules
export * from './types';
export * from './core/auth-client';
export * from './core/single-token-auth';
export * from './adapters';

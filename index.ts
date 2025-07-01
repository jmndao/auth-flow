import type { AuthFlowConfig, AuthContext } from './types';
import { AuthClient } from './core/auth-client';
import { SingleTokenAuthClient } from './core/single-token-auth';

// Main factory function - works exactly like before
export function createAuthFlow(config: AuthFlowConfig, context?: AuthContext) {
  return new AuthClient(config, context);
}

// New single token auth for backends without refresh tokens
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

// Preset configurations for common scenarios
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

// Configuration helpers
export function createCookieConfig(
  baseURL: string,
  options?: {
    tokenNames?: { access: string; refresh: string };
    cookieOptions?: {
      waitForCookies?: number;
      fallbackToBody?: boolean;
      retryCount?: number;
      debugMode?: boolean;
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

// Diagnostic utility
export async function diagnoseCookieIssues(credentials: any, config: AuthFlowConfig) {
  console.log('Cookie Diagnostic Check');
  console.log('======================');

  const auth = createAuthFlow({
    ...config,
    storage: {
      type: 'cookies',
      options: { debugMode: true },
    },
  });

  try {
    console.log('Testing login...');
    await auth.login(credentials);

    console.log('Checking token retrieval...');
    const tokens = await auth.getTokens();
    console.log('Tokens found:', !!tokens);

    if (tokens) {
      console.log('Access token length:', tokens.accessToken.length);
      console.log('Refresh token length:', tokens.refreshToken.length);
    }

    console.log('Authentication status:', auth.isAuthenticated());
  } catch (error) {
    console.error('Diagnostic failed:', error);
  }
}

// Export everything from types and core modules
export * from './types';
export * from './core/auth-client';
export * from './core/single-token-auth';
export * from './adapters';

import type { AuthFlowConfig, AuthContext } from './types';
import { AuthClient } from './core/auth-client';
import { SingleTokenAuthClient } from './core/single-token-auth';

export function createAuthFlow(config: AuthFlowConfig, context?: AuthContext) {
  return new AuthClient(config, context);
}

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
 * Creates a cookie-based authentication configuration with proper Next.js support
 */
export function createCookieConfig(
  baseURL: string,
  options?: {
    tokenNames?: { access: string; refresh: string };
    cookieOptions?: {
      waitForCookies?: number;
      fallbackToBody?: boolean;
      retryCount?: number;
      debugMode?: boolean;
      secure?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
      path?: string;
      domain?: string;
      maxAge?: number;
      httpOnly?: boolean;
    };
    endpoints?: {
      login?: string;
      refresh?: string;
      logout?: string;
    };
  }
): AuthFlowConfig {
  return {
    baseURL,
    tokenSource: 'cookies',
    storage: {
      type: 'cookies',
      options: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        httpOnly: false,
        waitForCookies: 1000,
        fallbackToBody: true,
        retryCount: 3,
        debugMode: process.env.NODE_ENV !== 'production',
        ...options?.cookieOptions,
      },
    },
    tokens: options?.tokenNames || { access: 'accessToken', refresh: 'refreshToken' },
    endpoints: {
      login: '/auth/login',
      refresh: '/auth/refresh',
      logout: '/auth/logout',
      ...options?.endpoints,
    },
    debugMode: options?.cookieOptions?.debugMode ?? process.env.NODE_ENV !== 'production',
  };
}

/**
 * Diagnostic utility for troubleshooting cookie issues
 */
export async function diagnoseCookieIssues(credentials: any, config: AuthFlowConfig) {
  console.log('Cookie Diagnostic Check');
  console.log('======================');

  const auth = createAuthFlow({
    ...config,
    storage: {
      type: 'cookies',
      options: { debugMode: true },
    },
    debugMode: true,
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

/**
 * Helper to create a Next.js-optimized authentication configuration
 */
export function createNextJSConfig(
  baseURL: string,
  options?: {
    tokenNames?: { access: string; refresh: string };
    endpoints?: {
      login?: string;
      refresh?: string;
      logout?: string;
    };
    debugMode?: boolean;
  }
): AuthFlowConfig {
  return createCookieConfig(baseURL, {
    tokenNames: options?.tokenNames,
    endpoints: options?.endpoints,
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      waitForCookies: 1000,
      fallbackToBody: true,
      retryCount: 3,
      debugMode: options?.debugMode ?? process.env.NODE_ENV !== 'production',
    },
  });
}

export * from './types';
export * from './core/auth-client';
export * from './core/single-token-auth';
export * from './adapters';

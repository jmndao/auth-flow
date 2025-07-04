import type { AuthFlowConfig, AuthContext } from './types';
import { AuthClient } from './core/auth-client';

export function createAuthFlow(config: AuthFlowConfig, context?: AuthContext) {
  return new AuthClient(config, context);
}

export function createSingleTokenAuth(config: {
  baseURL: string;
  token: { access: string };
  endpoints: { login: string; logout?: string };
  timeout?: number;
}) {
  return createAuthFlow({
    baseURL: config.baseURL,
    tokens: { access: config.token.access, refresh: 'refreshToken' },
    endpoints: {
      login: config.endpoints.login,
      refresh: '/auth/refresh',
      logout: config.endpoints.logout,
    },
    tokenSource: 'body',
    storage: 'memory',
    timeout: config.timeout,
  });
}

export function createCookieConfig(
  baseURL: string,
  options?: {
    tokenNames?: { access: string; refresh: string };
    endpoints?: { login?: string; refresh?: string; logout?: string };
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
      },
    },
    tokens: options?.tokenNames || { access: 'accessToken', refresh: 'refreshToken' },
    endpoints: {
      login: '/auth/login',
      refresh: '/auth/refresh',
      logout: '/auth/logout',
      ...options?.endpoints,
    },
  };
}

export function createNextJSConfig(
  baseURL: string,
  options?: {
    tokenNames?: { access: string; refresh: string };
    endpoints?: { login?: string; refresh?: string; logout?: string };
  }
): AuthFlowConfig {
  return createCookieConfig(baseURL, options);
}

export type { TokenPair, AuthError, LoginCredentials, LoginResponse } from './types';
export type { AuthFlowConfig, AuthContext, TokenConfig, EndpointsConfig } from './types';
export { AuthClient } from './core/auth-client';

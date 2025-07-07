import { createAuthFlow } from './index';

/**
 * Pre-configured authentication setups for common scenarios
 * Simplifies AuthFlow setup for typical use cases
 */

/**
 * Simple authentication with localStorage
 */
export function createSimpleAuth(baseURL: string): ReturnType<typeof createAuthFlow> {
  return createAuthFlow({
    baseURL,
    storage: 'browser',
    timeout: 10000,
    retry: {
      attempts: 3,
      delay: 1000,
    },
  });
}

/**
 * Server-side authentication with cookies
 */
export function createServerAuth(baseURL: string): ReturnType<typeof createAuthFlow> {
  return createAuthFlow({
    baseURL,
    storage: 'cookies',
    timeout: 15000,
    retry: {
      attempts: 2,
      delay: 2000,
    },
  });
}

/**
 * Next.js optimized authentication
 */
export function createNextJSAuth(baseURL: string): ReturnType<typeof createAuthFlow> {
  return createAuthFlow({
    baseURL,
    storage: 'cookies',
    timeout: 12000,
    retry: {
      attempts: 3,
      delay: 1000,
    },
  });
}

/**
 * Development authentication with verbose logging
 */
export function createDevAuth(baseURL: string): ReturnType<typeof createAuthFlow> {
  return createAuthFlow({
    baseURL,
    storage: 'auto',
    timeout: 30000,
    retry: {
      attempts: 5,
      delay: 1000,
    },
    onTokenRefresh: (tokens) => {
      console.log('Tokens refreshed:', {
        accessToken: tokens.accessToken.substring(0, 20) + '...',
        refreshToken: tokens.refreshToken.substring(0, 20) + '...',
      });
    },
    onAuthError: (error) => {
      console.error('Auth error:', error);
    },
    onLogout: () => {
      console.log('User logged out');
    },
  });
}

/**
 * Production authentication with optimized settings
 */
export function createProductionAuth(baseURL: string): ReturnType<typeof createAuthFlow> {
  return createAuthFlow({
    baseURL,
    storage: 'auto',
    timeout: 8000,
    retry: {
      attempts: 2,
      delay: 1500,
    },
  });
}

/**
 * Mobile-optimized authentication
 */
export function createMobileAuth(baseURL: string): ReturnType<typeof createAuthFlow> {
  return createAuthFlow({
    baseURL,
    storage: 'browser',
    timeout: 20000,
    retry: {
      attempts: 5,
      delay: 2000,
    },
  });
}

/**
 * API-only authentication (no browser storage)
 */
export function createAPIAuth(baseURL: string): ReturnType<typeof createAuthFlow> {
  return createAuthFlow({
    baseURL,
    storage: 'memory',
    timeout: 5000,
    retry: {
      attempts: 1,
      delay: 0,
    },
  });
}

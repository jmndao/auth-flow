import type { TokenPair, AuthError } from './auth';

/**
 * Configuration type definitions
 */

export interface AuthConfig {
  baseURL: string;
  endpoints?: {
    login?: string;
    refresh?: string;
    logout?: string;
  };
  tokens?: {
    access?: string;
    refresh?: string;
  };
  storage?: 'auto' | 'memory' | 'browser' | 'cookies';
  timeout?: number;
  retry?: {
    attempts?: number;
    delay?: number;
  };
  onTokenRefresh?: (tokens: TokenPair) => void;
  onAuthError?: (error: AuthError) => void;
  onLogout?: () => void;
}

/**
 * Internal normalized configuration with all required fields
 */
export interface NormalizedConfig {
  baseURL: string;
  endpoints: {
    login: string;
    refresh: string;
    logout: string;
  };
  tokens: {
    access: string;
    refresh: string;
  };
  storage: 'auto' | 'memory' | 'browser' | 'cookies';
  timeout: number;
  retry: {
    attempts: number;
    delay: number;
  };
  onTokenRefresh?: ((tokens: TokenPair) => void) | undefined;
  onAuthError?: ((error: AuthError) => void) | undefined;
  onLogout?: (() => void) | undefined;
}

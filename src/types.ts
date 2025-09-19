/**
 * Core type definitions for AuthFlow
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  [key: string]: any;
}

export type AuthValidator = (tokens: TokenPair | null) => boolean;

export interface AuthFlowConfig {
  baseURL: string;
  endpoints?: {
    login?: string;
    refresh?: string;
    logout?: string;
  };
  tokenFields?: {
    access?: string;
    refresh?: string;
  };
  storage?: 'localStorage' | 'sessionStorage' | 'memory';
  timeout?: number;
  validateAuth?: AuthValidator;
}

export interface AuthError {
  status: number;
  message: string;
  code?: string;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  isRetry?: boolean;
  [key: string]: any;
}

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clear(): void;
}

export interface NormalizedConfig {
  baseURL: string;
  endpoints: {
    login: string;
    refresh: string;
    logout: string;
  };
  tokenFields: {
    access: string;
    refresh: string;
  };
  storage: 'localStorage' | 'sessionStorage' | 'memory';
  timeout: number;
  validateAuth?: AuthValidator;
}

/**
 * Permission system types (separate from core auth)
 */
export type PermissionValidator = (tokens: TokenPair | null) => boolean;

export interface UserClaims {
  roles?: string[];
  permissions?: string[];
  [key: string]: any;
}

export interface RBACConfig {
  requiredRoles: string[];
  mode: 'any' | 'all';
}

export interface ABACRule {
  resource: string;
  action: string;
  condition: (claims: UserClaims) => boolean;
}

export interface ABACConfig {
  rules: ABACRule[];
  mode: 'any' | 'all';
}

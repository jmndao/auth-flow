export type Environment = 'client' | 'server' | 'auto';

export type TokenSource = 'body' | 'cookies';

export type StorageType = 'localStorage' | 'cookies' | 'memory' | 'auto';

export interface TokenConfig {
  access: string;
  refresh: string;
}

export interface EndpointsConfig {
  login: string;
  refresh: string;
  logout?: string;
}

export interface StorageConfig {
  type?: StorageType;
  options?: {
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
    domain?: string;
    path?: string;
  };
}

export interface RetryConfig {
  attempts?: number;
  delay?: number;
}

export interface AuthFlowConfig {
  environment?: Environment;
  endpoints: EndpointsConfig;
  tokens: TokenConfig;
  tokenSource?: TokenSource;
  storage?: StorageType | StorageConfig;
  baseURL?: string;
  timeout?: number;
  retry?: RetryConfig;
  onTokenRefresh?: (tokens: TokenPair) => void;
  onAuthError?: (error: AuthError) => void;
  onLogout?: () => void;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthError {
  status: number;
  message: string;
  code?: string;
  originalError?: any;
}

export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  baseURL?: string;
  [key: string]: any;
}

export interface AuthContext {
  req?: any;
  res?: any;
  cookies?: () => any;
}

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
    httpOnly?: boolean;
    waitForCookies?: number;
    fallbackToBody?: boolean;
    retryCount?: number;
    debugMode?: boolean;
  };
}

export interface RetryConfig {
  attempts?: number;
  delay?: number;
}

export interface AuthFlowConfig {
  environment?: Environment;
  endpoints?: EndpointsConfig;
  tokens?: TokenConfig;
  tokenSource?: TokenSource;
  storage?: StorageType | StorageConfig;
  baseURL?: string;
  timeout?: number;
  retry?: RetryConfig;
  debugMode?: boolean;
  onTokenRefresh?: (tokens: TokenPair) => void;
  onAuthError?: (error: AuthError) => void;
  onLogout?: () => void;
}

export interface ValidatedAuthFlowConfig extends AuthFlowConfig {
  endpoints: EndpointsConfig;
  tokens: TokenConfig;
  environment: Environment;
  tokenSource: TokenSource;
  storage: StorageType | StorageConfig;
  timeout: number;
  retry: RetryConfig;
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
  /** Express-style request object */
  req?: any;
  /** Express-style response object */
  res?: any;
  /** Next.js App Router cookies() function */
  cookies?: () => any | Promise<any>;
  /** Next.js App Router headers() function */
  headers?: () => any | Promise<any>;
  /** Pre-extracted cookies object for performance */
  cookiesObject?: Record<string, string>;
  /** Custom cookie setter function */
  cookieSetter?: (name: string, value: string, options?: any) => void;
}

import type { CacheConfig } from './cache';
import type { PerformanceConfig } from './performance';
import type { SecurityConfig } from './security';
import type {
  RetryConfig as RetryConfigBase,
  HealthConfig,
  CircuitBreakerConfig,
} from './resilience';
import type { AuthFlowConfig, TokenPair } from './config';

/**
 * Multi-provider authentication configuration
 */
export interface MultiProviderConfig {
  /** Primary authentication provider */
  primary: ProviderConfig;
  /** Additional authentication providers */
  secondary?: Record<string, ProviderConfig>;
  /** Provider selection strategy */
  strategy?: 'primary-only' | 'failover' | 'load-balance';
}

/**
 * Individual provider configuration
 */
export interface ProviderConfig {
  /** Provider base URL */
  baseURL: string;
  /** Provider type */
  type: 'jwt' | 'oauth2' | 'saml' | 'api-key' | 'custom';
  /** Provider-specific configuration */
  config?: {
    clientId?: string;
    clientSecret?: string;
    scope?: string[];
    redirectUri?: string;
    entityId?: string;
    [key: string]: any;
  };
  /** Provider endpoints */
  endpoints?: {
    login?: string;
    refresh?: string;
    logout?: string;
    authorize?: string;
    token?: string;
    userinfo?: string;
  };
  /** Provider weight for load balancing */
  weight?: number;
}

/**
 * SSO (Single Sign-On) configuration
 */
export interface SSOConfig {
  /** Whether SSO is enabled */
  enabled: boolean;
  /** SSO provider type */
  provider: 'saml' | 'oidc' | 'oauth2';
  /** Entity ID for SAML */
  entityId?: string;
  /** SSO endpoints */
  endpoints?: {
    sso?: string;
    sls?: string; // Single Logout Service
    metadata?: string;
  };
  /** Certificate for SAML validation */
  certificate?: string;
  /** Auto-redirect to SSO provider */
  autoRedirect?: boolean;
}

/**
 * Offline support configuration
 */
export interface OfflineConfig {
  /** Whether offline support is enabled */
  enabled: boolean;
  /** Offline storage type */
  storage: 'indexeddb' | 'websql' | 'localstorage';
  /** Sync strategy when coming back online */
  syncOnReconnect: boolean;
  /** Maximum offline cache size */
  maxCacheSize?: number;
  /** Offline cache TTL */
  cacheTTL?: number;
  /** Offline-first endpoints (cached for offline use) */
  offlineEndpoints?: string[];
}

/**
 * V2 specific retry configuration
 */
export interface V2RetryConfig extends RetryConfigBase {
  /** Maximum delay cap for exponential strategies (ms) */
  maxDelay?: number;
  /** Jitter factor for exponential-jitter strategy (0-1) */
  jitterFactor?: number;
}

/**
 * Request configuration with v2.0 features
 */
export interface V2RequestConfig {
  /** Standard axios-style headers */
  headers?: Record<string, string>;
  /** Request timeout */
  timeout?: number;
  /** Base URL override */
  baseURL?: string;
  /** Cache configuration for this request */
  cache?: {
    enabled?: boolean;
    ttl?: number;
    key?: string;
  };
  /** Retry configuration for this request */
  retry?: Partial<V2RetryConfig>;
  /** Whether to bypass circuit breaker */
  bypassCircuitBreaker?: boolean;
  /** Whether this request should be cached for offline */
  offlineCache?: boolean;
  /** Custom analytics data for this request */
  analytics?: Record<string, any>;
  /** Any other configuration */
  [key: string]: any;
}

/**
 * Comprehensive AuthFlow v2.0 configuration
 */
export interface AuthFlowV2Config extends Omit<AuthFlowConfig, 'retry'> {
  // Performance features
  /** Request caching configuration */
  caching?: Partial<CacheConfig>;

  /** Performance monitoring configuration */
  monitoring?: Partial<PerformanceConfig>;

  // Security features
  /** Security configuration */
  security?: Partial<SecurityConfig>;

  // Resilience features
  /** Advanced retry configuration */
  retry?: Partial<V2RetryConfig>;

  /** Circuit breaker configuration */
  circuitBreaker?: Partial<CircuitBreakerConfig>;

  /** Health monitoring configuration */
  health?: Partial<HealthConfig>;

  // Advanced authentication
  /** Multi-provider authentication */
  providers?: MultiProviderConfig;

  /** SSO configuration */
  sso?: SSOConfig;

  /** Offline support */
  offline?: OfflineConfig;

  // Developer experience
  /** Enable debug mode with detailed logging */
  debugMode?: boolean;

  /** Custom interceptors */
  interceptors?: {
    request?: Array<(config: any) => any>;
    response?: Array<(response: any) => any>;
  };

  // Analytics and telemetry
  /** Analytics configuration */
  analytics?: {
    enabled: boolean;
    endpoint?: string;
    sampleRate?: number;
    customEvents?: Record<string, any>;
  };
}

/**
 * AuthFlow v2.0 client interface with all features
 */
export interface AuthFlowV2Client {
  // Basic authentication (inherited)
  login<TUser = any, TCredentials = any>(credentials: TCredentials): Promise<TUser>;
  logout(): Promise<void>;
  isAuthenticated(): boolean;
  hasValidTokens(): Promise<boolean>;

  // HTTP methods with caching and monitoring
  get<T = any>(url: string, config?: V2RequestConfig): Promise<T>;
  post<T = any>(url: string, data?: any, config?: V2RequestConfig): Promise<T>;
  put<T = any>(url: string, data?: any, config?: V2RequestConfig): Promise<T>;
  patch<T = any>(url: string, data?: any, config?: V2RequestConfig): Promise<T>;
  delete<T = any>(url: string, config?: V2RequestConfig): Promise<T>;

  // Token management
  getTokens(): Promise<TokenPair | null>;
  setTokens(tokens: TokenPair): Promise<void>;
  clearTokens(): Promise<void>;

  // Performance monitoring
  getPerformanceMetrics(): any;
  clearPerformanceMetrics(): void;

  // Cache management
  getCacheStats(): any;
  clearCache(pattern?: string): void;

  // Security features
  validateToken(token: string): any;
  encryptToken(token: string): string;
  decryptToken(token: string): string;

  // Health monitoring
  getHealthStatus(): any;
  checkHealth(): Promise<any>;

  // Circuit breaker
  getCircuitBreakerStats(): any;
  resetCircuitBreaker(): void;

  // Multi-provider
  switchProvider(providerName: string): Promise<void>;
  getActiveProvider(): string;

  // Offline support
  enableOfflineMode(): void;
  disableOfflineMode(): void;
  isOffline(): boolean;
  syncOfflineData(): Promise<void>;

  // Developer tools
  enableDebugMode(): void;
  disableDebugMode(): void;
  getDebugInfo(): DebugInfo;

  // Resource cleanup
  destroy(): void;
}

/**
 * Preset configurations for common scenarios
 */
export interface AuthFlowPresets {
  /** High-performance configuration with aggressive caching */
  performance: Partial<AuthFlowV2Config>;
  /** Security-focused configuration with all protections enabled */
  security: Partial<AuthFlowV2Config>;
  /** Resilient configuration for unreliable networks */
  resilient: Partial<AuthFlowV2Config>;
  /** Development configuration with debugging enabled */
  development: Partial<AuthFlowV2Config>;
  /** Production configuration with monitoring and security */
  production: Partial<AuthFlowV2Config>;
  /** Minimal configuration for simple use cases */
  minimal: Partial<AuthFlowV2Config>;
}

/**
 * Factory function type for creating AuthFlow v2.0 instances
 */
export type CreateAuthFlowV2 = (
  config: string | Partial<AuthFlowV2Config>,
  context?: any
) => AuthFlowV2Client;

/**
 * Analytics event types
 */
export interface AnalyticsEvent {
  /** Event name */
  name: string;
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data: Record<string, any>;
  /** User context */
  user?: {
    id?: string;
    sessionId?: string;
  };
  /** Request context */
  request?: {
    url: string;
    method: string;
    duration: number;
    status: number;
  };
}

/**
 * Debug information interface
 */
export interface DebugInfo {
  /** Configuration snapshot */
  config: any;
  /** Current authentication state */
  authState: {
    isAuthenticated: boolean;
    hasTokens: boolean;
    tokenExpiry?: Date;
  };
  /** Performance metrics summary */
  performance: {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
  /** Health status */
  health: {
    isHealthy: boolean;
    lastCheckTime: Date;
    responseTime: number;
  };
  /** Circuit breaker status */
  circuitBreaker: {
    state: string;
    failures: number;
    successes: number;
  };
  /** Active features */
  features: {
    caching: boolean;
    monitoring: boolean;
    security: boolean;
    circuitBreaker: boolean;
    health: boolean;
    offline: boolean;
  };
}

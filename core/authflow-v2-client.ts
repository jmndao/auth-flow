import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type {
  AuthFlowV2Config,
  AuthFlowV2Client,
  V2RequestConfig,
  DebugInfo,
  AnalyticsEvent,
} from '../types/authflow-v2';
import type { TokenPair, AuthContext } from '../types/config';

import { RequestCache } from './request-cache';
import { RequestDeduplicator } from './request-deduplicator';
import { CircuitBreaker } from './circuit-breaker';
import { PerformanceMonitor } from './performance-monitor';
import { SecurityManager } from './security-manager';
import { HealthMonitor } from './health-monitor';
import { RetryManager } from './retry-manager';
import { AuthClient } from './auth-client';

/**
 * Production-ready authentication client with comprehensive features including
 * request caching, deduplication, circuit breaker, performance monitoring,
 * security features, health monitoring, and sophisticated retry strategies
 */
export class AuthFlowV2ClientImpl implements AuthFlowV2Client {
  private readonly coreAuth: AuthClient;
  private readonly cache: RequestCache;
  private readonly deduplicator: RequestDeduplicator;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly securityManager: SecurityManager;
  private readonly healthMonitor: HealthMonitor;
  private readonly retryManager: RetryManager;
  private readonly httpClient: AxiosInstance;
  private readonly config: AuthFlowV2Config;
  private readonly context: AuthContext;

  private activeProvider = 'primary';
  private offlineMode = false;
  private readonly analyticsEvents: AnalyticsEvent[] = [];
  private refreshPromise: Promise<void> | null = null;
  private isRefreshing = false;

  constructor(config: AuthFlowV2Config, context?: AuthContext) {
    this.config = this.normalizeConfig(config);
    this.context = context || {};

    this.coreAuth = new AuthClient(config, this.enhanceContext(this.context));

    this.httpClient = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
    });

    // Initialize feature modules
    this.cache = new RequestCache(this.config.caching);
    this.deduplicator = new RequestDeduplicator();
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
    this.performanceMonitor = new PerformanceMonitor({
      ...this.config.monitoring,
      onMetrics: (metrics) => this.handlePerformanceMetrics(metrics),
    });
    this.securityManager = new SecurityManager(this.config.security);
    this.healthMonitor = new HealthMonitor(this.config.health, this.httpClient);
    this.retryManager = new RetryManager(this.config.retry);

    this.setupInterceptors();
    this.startMonitoring();
  }

  /**
   * Sets up HTTP interceptors for token management and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor: Add authorization header
    this.httpClient.interceptors.request.use(
      async (config) => {
        try {
          const accessToken = await this.coreAuth.getAccessToken();

          if (accessToken && config.headers) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
          }
        } catch (error) {
          console.error('Token retrieval failed:', error);
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: Handle 401 errors and automatic token refresh
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry && !this.isRefreshing) {
          originalRequest._retry = true;

          try {
            const refreshToken = await this.coreAuth.getRefreshToken();

            if (!refreshToken || (this.coreAuth as any).tokenManager.isTokenExpired(refreshToken)) {
              await this.coreAuth.clearTokens();
              throw error;
            }

            this.isRefreshing = true;

            this.refreshPromise ??= this.performTokenRefresh().finally(() => {
              this.refreshPromise = null;
              this.isRefreshing = false;
            });

            await this.refreshPromise;

            const newAccessToken = await this.coreAuth.getAccessToken();

            if (newAccessToken && originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
            }

            return this.httpClient.request(originalRequest);
          } catch {
            this.isRefreshing = false;
            await this.coreAuth.clearTokens();
            throw error;
          }
        }

        throw error;
      }
    );
  }

  /**
   * Performs token refresh using the core authentication client
   */
  private async performTokenRefresh(): Promise<void> {
    await this.coreAuth.performTokenRefresh();
  }

  /**
   * Enhances context with framework-specific helpers
   */
  private enhanceContext(context: AuthContext): AuthContext {
    const enhanced = { ...context };

    // Try to add Next.js headers if available and not provided
    if (typeof window === 'undefined' && !enhanced.headers) {
      try {
        const { headers } = require('next/headers');
        enhanced.headers = headers;
      } catch {
        // Next.js headers not available
      }
    }

    return enhanced;
  }

  /**
   * Normalizes configuration with sensible defaults
   */
  private normalizeConfig(config: AuthFlowV2Config): AuthFlowV2Config {
    return {
      environment: 'auto',
      tokenSource: 'body',
      storage: 'auto',
      timeout: 10000,

      caching: {
        enabled: true,
        defaultTTL: 300000,
        maxSize: 100,
        strategies: new Map(),
        ...config.caching,
      },
      monitoring: {
        enabled: true,
        sampleRate: 1.0,
        maxSamples: 1000,
        aggregationInterval: 60000,
        slowThreshold: 3000,
        ...config.monitoring,
      },
      security: {
        encryptTokens: false,
        csrf: { enabled: false },
        requestSigning: { enabled: false },
        ...config.security,
      },
      retry: {
        attempts: 3,
        delay: 1000,
        strategy: 'exponential',
        conditions: ['network', '5xx', 'timeout'],
        ...config.retry,
      },
      circuitBreaker: {
        threshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 300000,
        minimumRequests: 10,
        ...config.circuitBreaker,
      },
      health: {
        enabled: false,
        endpoint: '/health',
        interval: 60000,
        ...config.health,
      },

      ...config,
    };
  }

  /**
   * Starts monitoring services if enabled
   */
  private startMonitoring(): void {
    if (this.config.health?.enabled) {
      this.healthMonitor.start();
    }
  }

  // Authentication methods - delegate to core auth client
  async login<TUser = any, TCredentials = any>(credentials: TCredentials): Promise<TUser> {
    const result = await this.coreAuth.login<TUser, TCredentials>(credentials);

    if (this.config.analytics?.enabled) {
      this.recordAnalyticsEvent('user_login', { success: true });
    }

    return result;
  }

  async logout(): Promise<void> {
    await this.coreAuth.logout();

    if (this.config.analytics?.enabled) {
      this.recordAnalyticsEvent('user_logout', {});
    }
  }

  isAuthenticated(): boolean {
    return this.coreAuth.isAuthenticated();
  }

  async hasValidTokens(): Promise<boolean> {
    return this.coreAuth.hasValidTokens();
  }

  async getTokens(): Promise<TokenPair | null> {
    return this.coreAuth.getTokens();
  }

  async setTokens(tokens: TokenPair): Promise<void> {
    return this.coreAuth.setTokens(tokens);
  }

  async clearTokens(): Promise<void> {
    return this.coreAuth.clearTokens();
  }

  // HTTP methods with caching, deduplication, and circuit breaker
  async get<T = any>(url: string, config?: V2RequestConfig): Promise<T> {
    return this.request<T>('GET', url, undefined, config);
  }

  async post<T = any>(url: string, data?: any, config?: V2RequestConfig): Promise<T> {
    return this.request<T>('POST', url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: V2RequestConfig): Promise<T> {
    return this.request<T>('PUT', url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: V2RequestConfig): Promise<T> {
    return this.request<T>('PATCH', url, data, config);
  }

  async delete<T = any>(url: string, config?: V2RequestConfig): Promise<T> {
    return this.request<T>('DELETE', url, undefined, config);
  }

  /**
   * Makes HTTP request with all v2 features (caching, deduplication, circuit breaker, retry)
   */
  private async request<T>(
    method: string,
    url: string,
    data?: any,
    config?: V2RequestConfig
  ): Promise<T> {
    const startTime = Date.now();

    // Check cache for GET requests
    if (method === 'GET' && this.config.caching?.enabled) {
      const cached = this.cache.get(url, method, data);
      if (cached) {
        this.cache.recordHit();
        return cached;
      }
      this.cache.recordMiss();
    }

    // Execute with deduplication, circuit breaker, and retry
    return this.deduplicator.execute(
      method,
      url,
      async () => {
        return this.circuitBreaker.execute(async () => {
          return this.retryManager.execute(async () => {
            const requestConfig = await this.prepareRequestConfig(method, url, data, config);
            const response = await this.httpClient.request(requestConfig);
            this.handleSuccessfulResponse(response, startTime);

            // Cache successful GET responses
            if (method === 'GET' && this.config.caching?.enabled && response.status < 400) {
              this.cache.set(url, response.data, method, data);
            }

            return response.data;
          }, config?.retry);
        });
      },
      data
    );
  }

  /**
   * Prepares request configuration with security headers
   */
  private async prepareRequestConfig(
    method: string,
    url: string,
    data?: any,
    config?: V2RequestConfig
  ): Promise<any> {
    const requestConfig: any = {
      method,
      url,
      data,
      ...config,
    };

    let headers: Record<string, string> = {};

    if (config?.headers) {
      headers = { ...config.headers };
    }

    // Add security headers if enabled
    if (this.config.security?.csrf?.enabled) {
      headers = await this.securityManager.addCSRFHeader(headers);
    }

    if (this.config.security?.requestSigning?.enabled) {
      headers = this.securityManager.signRequest(
        method,
        url,
        headers,
        data ? JSON.stringify(data) : undefined
      );
    }

    requestConfig.headers = headers;
    return requestConfig;
  }

  /**
   * Handles successful response and records metrics
   */
  private handleSuccessfulResponse(response: AxiosResponse, startTime: number): void {
    const responseTime = Date.now() - startTime;

    this.performanceMonitor.recordRequest(
      response.config.url || '',
      response.config.method?.toUpperCase() || 'GET',
      response.status,
      responseTime,
      { cacheHit: false }
    );

    if (this.config.analytics?.enabled) {
      this.recordAnalyticsEvent('api_request_success', {
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        responseTime,
      });
    }
  }

  // Performance and monitoring methods
  getPerformanceMetrics(): any {
    return this.performanceMonitor.aggregateMetrics();
  }

  clearPerformanceMetrics(): void {
    this.performanceMonitor.clear();
  }

  getCacheStats(): any {
    return this.cache.getStats();
  }

  clearCache(pattern?: string): void {
    this.cache.invalidate(pattern);
  }

  // Security methods
  validateToken(token: string): any {
    return this.securityManager.validateToken(token);
  }

  encryptToken(token: string): string {
    return this.securityManager.encryptToken(token);
  }

  decryptToken(token: string): string {
    return this.securityManager.decryptToken(token);
  }

  // Health monitoring methods
  getHealthStatus(): any {
    return this.healthMonitor.getStatus();
  }

  async checkHealth(): Promise<any> {
    return this.healthMonitor.checkNow();
  }

  // Circuit breaker methods
  getCircuitBreakerStats(): any {
    return this.circuitBreaker.getStats();
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  // Provider switching (for multi-backend scenarios)
  async switchProvider(providerName: string): Promise<void> {
    this.activeProvider = providerName;
  }

  getActiveProvider(): string {
    return this.activeProvider;
  }

  // Offline mode management
  enableOfflineMode(): void {
    this.offlineMode = true;
  }

  disableOfflineMode(): void {
    this.offlineMode = false;
  }

  isOffline(): boolean {
    return this.offlineMode;
  }

  async syncOfflineData(): Promise<void> {
    // Implementation for offline data sync
  }

  // Debug mode management
  enableDebugMode(): void {
    this.config.debugMode = true;
  }

  disableDebugMode(): void {
    this.config.debugMode = false;
  }

  /**
   * Returns comprehensive debug information about the client state
   */
  getDebugInfo(): DebugInfo {
    const perfMetrics = this.performanceMonitor.aggregateMetrics();
    const healthStatus = this.healthMonitor.getStatus();
    const circuitStats = this.circuitBreaker.getStats();
    const cacheStats = this.cache.getStats();

    return {
      config: this.config,
      authState: {
        isAuthenticated: this.isAuthenticated(),
        hasTokens: this.coreAuth.isAuthenticated(),
      },
      performance: {
        requestCount: perfMetrics.totalRequests,
        averageResponseTime: perfMetrics.averageResponseTime,
        errorRate: 1 - perfMetrics.successRate,
        cacheHitRate: cacheStats.hitRate,
      },
      health: {
        isHealthy: healthStatus.isHealthy,
        lastCheckTime: new Date(healthStatus.lastCheckTime),
        responseTime: healthStatus.responseTime,
      },
      circuitBreaker: {
        state: circuitStats.state,
        failures: circuitStats.failures,
        successes: circuitStats.successes,
      },
      features: this.getEnabledFeatures(),
    };
  }

  /**
   * Cleanup method to properly destroy all resources
   */
  destroy(): void {
    this.healthMonitor.destroy();
    this.performanceMonitor.destroy();
    this.deduplicator.cancelAll();
    this.cache.clear();
  }

  /**
   * Returns list of enabled features
   */
  private getEnabledFeatures() {
    return {
      caching: this.config.caching?.enabled || false,
      monitoring: this.config.monitoring?.enabled || false,
      security: this.config.security?.encryptTokens || this.config.security?.csrf?.enabled || false,
      circuitBreaker: true,
      health: this.config.health?.enabled || false,
      offline: this.config.offline?.enabled || false,
    };
  }

  /**
   * Handles performance metrics collection
   */
  private handlePerformanceMetrics(metrics: any): void {
    if (this.config.analytics?.enabled) {
      this.recordAnalyticsEvent('performance_metrics', metrics);
    }
  }

  /**
   * Records analytics events for tracking
   */
  private recordAnalyticsEvent(name: string, data: any): void {
    if (!this.config.analytics?.enabled) return;

    const event: AnalyticsEvent = {
      name,
      timestamp: Date.now(),
      data,
      user: {
        sessionId: this.generateSessionId(),
      },
    };

    this.analyticsEvents.push(event);

    // Keep only last 100 events to prevent memory leaks
    if (this.analyticsEvents.length > 100) {
      this.analyticsEvents.splice(0, this.analyticsEvents.length - 100);
    }
  }

  /**
   * Generates unique session ID for analytics
   */
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

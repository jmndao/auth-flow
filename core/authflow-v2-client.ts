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
 * AuthFlowV2Client - Production-ready authentication client with comprehensive features
 *
 * Built-in Features:
 * - Request caching with intelligent strategies
 * - Automatic request deduplication
 * - Circuit breaker pattern for resilience
 * - Performance monitoring and metrics
 * - Advanced security features
 * - Health monitoring with recovery
 * - Sophisticated retry strategies
 * - Comprehensive debugging tools
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
  private debugMode = false;
  private offlineMode = false;
  private readonly analyticsEvents: AnalyticsEvent[] = [];

  constructor(config: AuthFlowV2Config, context?: AuthContext) {
    this.config = this.normalizeConfig(config);
    this.context = context || {};
    this.debugMode = config.debugMode || false;

    // Initialize core authentication client with enhanced context
    this.coreAuth = new AuthClient(config, this.enhanceContext(this.context));

    // Create HTTP client
    this.httpClient = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
    });

    // Initialize all components
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

    // Setup request/response handling
    this.setupRequestHandling();

    // Start monitoring
    this.startMonitoring();

    if (this.debugMode) {
      console.log('AuthFlow v2.0 initialized with features:', this.getEnabledFeatures());
    }
  }

  /**
   * Enhances the context with additional Next.js specific handling
   */
  private enhanceContext(context: AuthContext): AuthContext {
    const enhanced = { ...context };

    // Add headers function if available in Next.js environment
    if (typeof window === 'undefined' && !enhanced.headers) {
      try {
        // Dynamically import Next.js headers if available
        const { headers } = require('next/headers');
        enhanced.headers = headers;
      } catch {
        // Next.js headers not available, continue without it
      }
    }

    return enhanced;
  }

  /**
   * Normalizes configuration with defaults
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
   * Sets up request and response handling without using interceptors
   */
  private setupRequestHandling(): void {
    // We'll handle this in the request method instead of interceptors
    // This avoids all the TypeScript issues with Axios interceptors
  }

  /**
   * Starts monitoring services
   */
  private startMonitoring(): void {
    if (this.config.health?.enabled) {
      this.healthMonitor.start();
    }
  }

  // Core Authentication Methods (delegate to v1.x client)

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

  // HTTP Methods with enhanced context support

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
   * Request method with improved cookie context handling
   */
  private async request<T>(
    method: string,
    url: string,
    data?: any,
    config?: V2RequestConfig
  ): Promise<T> {
    const startTime = Date.now();

    // Check cache first (for GET requests)
    if (method === 'GET' && this.config.caching?.enabled) {
      const cached = this.cache.get(url, method, data);
      if (cached) {
        this.cache.recordHit();
        return cached;
      }
      this.cache.recordMiss();
    }

    // Execute with deduplication
    return this.deduplicator.execute(
      method,
      url,
      async () => {
        // Execute with circuit breaker
        return this.circuitBreaker.execute(async () => {
          // Execute with retry
          return this.retryManager.execute(async () => {
            // Prepare request config with enhanced context
            const requestConfig = await this.prepareRequestConfig(method, url, data, config);

            // Make the actual HTTP request
            const response = await this.httpClient.request(requestConfig);

            // Handle successful response
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
   * Prepares request configuration with security headers and enhanced context
   */
  private async prepareRequestConfig(
    method: string,
    url: string,
    data?: any,
    config?: V2RequestConfig
  ): Promise<any> {
    // Start with base config
    const requestConfig: any = {
      method,
      url,
      data,
      ...config,
    };

    // Prepare headers as plain object
    let headers: Record<string, string> = {};

    // Copy existing headers
    if (config?.headers) {
      headers = { ...config.headers };
    }

    // Add authentication header with improved token retrieval
    try {
      const accessToken = await this.coreAuth.getTokens();
      if (accessToken?.accessToken) {
        headers['Authorization'] = `Bearer ${accessToken.accessToken}`;
      }
    } catch (error) {
      if (this.debugMode) {
        console.warn('Failed to get tokens for request:', error);
      }
    }

    // Add security headers
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

    // Set headers on config
    requestConfig.headers = headers;

    return requestConfig;
  }

  /**
   * Handles successful responses
   */
  private handleSuccessfulResponse(response: AxiosResponse, startTime: number): void {
    const responseTime = Date.now() - startTime;

    // Record performance metrics
    this.performanceMonitor.recordRequest(
      response.config.url || '',
      response.config.method?.toUpperCase() || 'GET',
      response.status,
      responseTime,
      { cacheHit: false }
    );

    // Record analytics
    if (this.config.analytics?.enabled) {
      this.recordAnalyticsEvent('api_request_success', {
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        responseTime,
      });
    }
  }

  // Performance Monitoring Methods

  getPerformanceMetrics(): any {
    return this.performanceMonitor.aggregateMetrics();
  }

  clearPerformanceMetrics(): void {
    this.performanceMonitor.clear();
  }

  // Cache Management Methods

  getCacheStats(): any {
    return this.cache.getStats();
  }

  clearCache(pattern?: string): void {
    this.cache.invalidate(pattern);
  }

  // Security Methods

  validateToken(token: string): any {
    return this.securityManager.validateToken(token);
  }

  encryptToken(token: string): string {
    return this.securityManager.encryptToken(token);
  }

  decryptToken(token: string): string {
    return this.securityManager.decryptToken(token);
  }

  // Health Monitoring Methods

  getHealthStatus(): any {
    return this.healthMonitor.getStatus();
  }

  async checkHealth(): Promise<any> {
    return this.healthMonitor.checkNow();
  }

  // Circuit Breaker Methods

  getCircuitBreakerStats(): any {
    return this.circuitBreaker.getStats();
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  // Multi-Provider Methods

  async switchProvider(providerName: string): Promise<void> {
    this.activeProvider = providerName;
  }

  getActiveProvider(): string {
    return this.activeProvider;
  }

  // Offline Support Methods

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
    // Placeholder for offline sync implementation
  }

  // Developer Tools Methods

  enableDebugMode(): void {
    this.debugMode = true;
  }

  disableDebugMode(): void {
    this.debugMode = false;
  }

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

  // Resource cleanup

  destroy(): void {
    this.healthMonitor.destroy();
    this.performanceMonitor.destroy();
    this.deduplicator.cancelAll();
    this.cache.clear();
  }

  // Private helper methods

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

  private handlePerformanceMetrics(metrics: any): void {
    if (this.debugMode) {
      console.log('Performance metrics:', metrics);
    }

    if (this.config.analytics?.enabled) {
      this.recordAnalyticsEvent('performance_metrics', metrics);
    }
  }

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

    // Limit buffer size
    if (this.analyticsEvents.length > 100) {
      this.analyticsEvents.splice(0, this.analyticsEvents.length - 100);
    }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

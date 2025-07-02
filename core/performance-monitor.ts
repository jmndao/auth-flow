import type { RequestMetrics, AggregatedMetrics, PerformanceConfig } from '../types/performance';

/**
 * PerformanceMonitor tracks and aggregates HTTP request performance metrics.
 *
 * Features:
 * - Request timing and success rate tracking
 * - Configurable sampling for high-traffic applications
 * - Automatic metric aggregation and reporting
 * - Percentile calculations (P95, P99)
 * - Slowest endpoint identification
 * - Cache hit rate monitoring
 * - Error categorization by status code
 */
export class PerformanceMonitor {
  /** Array of collected request metrics */
  private metrics: RequestMetrics[] = [];

  /** Performance monitoring configuration */
  private config: PerformanceConfig;

  /** Timer for periodic metric aggregation */
  private aggregationTimer?: NodeJS.Timeout;

  /**
   * Creates a new PerformanceMonitor instance
   *
   * @param config - Performance monitoring configuration
   */
  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enabled: true,
      sampleRate: 1.0,
      maxSamples: 1000,
      aggregationInterval: 60000, // 1 minute
      slowThreshold: 3000, // 3 seconds
      ...config,
    };

    if (this.config.enabled && this.config.aggregationInterval > 0) {
      this.startAggregation();
    }
  }

  /**
   * Records metrics for a completed request
   *
   * @param url - Request URL
   * @param method - HTTP method
   * @param status - HTTP status code
   * @param responseTime - Response time in milliseconds
   * @param options - Additional metrics options
   */
  recordRequest(
    url: string,
    method: string,
    status: number,
    responseTime: number,
    options: {
      cacheHit?: boolean;
      retryCount?: number;
    } = {}
  ): void {
    if (!this.config.enabled) return;
    if (Math.random() > this.config.sampleRate) return;

    const metric: RequestMetrics = {
      url,
      method,
      status,
      responseTime,
      timestamp: Date.now(),
      success: status >= 200 && status < 400,
      ...options,
    };

    this.metrics.push(metric);

    // Maintain maximum sample size using LRU policy
    if (this.metrics.length > this.config.maxSamples) {
      this.metrics = this.metrics.slice(-this.config.maxSamples);
    }
  }

  /**
   * Starts periodic metric aggregation and reporting
   */
  private startAggregation(): void {
    this.aggregationTimer = setInterval(() => {
      if (this.config.onMetrics) {
        const aggregated = this.aggregateMetrics();
        this.config.onMetrics(aggregated);
      }
    }, this.config.aggregationInterval);
  }

  /**
   * Aggregates metrics over a specified time window
   *
   * @param timeWindow - Time window in milliseconds (optional, uses all data if not specified)
   * @returns Aggregated performance metrics
   */
  aggregateMetrics(timeWindow?: number): AggregatedMetrics {
    const cutoff = timeWindow ? Date.now() - timeWindow : 0;
    const relevantMetrics = this.metrics.filter((m) => m.timestamp > cutoff);

    if (relevantMetrics.length === 0) {
      return this.getEmptyMetrics();
    }

    const totalRequests = relevantMetrics.length;
    const successfulRequests = relevantMetrics.filter((m) => m.success).length;
    const failedRequests = totalRequests - successfulRequests;

    // Calculate response time statistics
    const responseTimes = relevantMetrics.map((m) => m.responseTime).sort((a, b) => a - b);
    const averageResponseTime =
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const p95ResponseTime = responseTimes[p95Index] || 0;
    const p99ResponseTime = responseTimes[p99Index] || 0;

    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;

    // Calculate cache hit rate
    const cacheHits = relevantMetrics.filter((m) => m.cacheHit).length;
    const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

    // Group errors by status code
    const errorsByStatus = new Map<number, number>();
    relevantMetrics
      .filter((m) => !m.success)
      .forEach((m) => {
        errorsByStatus.set(m.status, (errorsByStatus.get(m.status) || 0) + 1);
      });

    // Calculate slowest endpoints
    const endpointStats = new Map<string, { totalTime: number; count: number }>();
    relevantMetrics.forEach((m) => {
      const key = `${m.method} ${m.url}`;
      const existing = endpointStats.get(key) || { totalTime: 0, count: 0 };
      existing.totalTime += m.responseTime;
      existing.count++;
      endpointStats.set(key, existing);
    });

    const slowestEndpoints = Array.from(endpointStats.entries())
      .map(([url, stats]) => ({
        url,
        avgTime: stats.totalTime / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      successRate,
      cacheHitRate,
      errorsByStatus,
      slowestEndpoints,
    };
  }

  /**
   * Returns empty metrics structure for when no data is available
   *
   * @returns Empty aggregated metrics
   */
  private getEmptyMetrics(): AggregatedMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      successRate: 0,
      cacheHitRate: 0,
      errorsByStatus: new Map(),
      slowestEndpoints: [],
    };
  }

  /**
   * Gets requests that exceed the slow threshold
   *
   * @param threshold - Custom threshold in milliseconds (optional)
   * @returns Array of slow requests
   */
  getSlowRequests(threshold?: number): RequestMetrics[] {
    const slowThreshold = threshold || this.config.slowThreshold;
    return this.metrics.filter((m) => m.responseTime > slowThreshold);
  }

  /**
   * Gets all failed requests
   *
   * @returns Array of failed request metrics
   */
  getErrorRequests(): RequestMetrics[] {
    return this.metrics.filter((m) => !m.success);
  }

  /**
   * Clears all collected metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Stops monitoring and cleans up resources
   */
  destroy(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
  }

  /**
   * Gets current configuration
   *
   * @returns Copy of current configuration
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Updates configuration and restarts aggregation if needed
   *
   * @param updates - Configuration updates to apply
   */
  updateConfig(updates: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...updates };

    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }

    if (this.config.enabled && this.config.aggregationInterval > 0) {
      this.startAggregation();
    }
  }
}

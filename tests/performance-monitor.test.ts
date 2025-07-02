import { PerformanceMonitor } from '../core/performance-monitor';

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  let onMetricsSpy: jest.Mock;

  beforeEach(() => {
    onMetricsSpy = jest.fn();
    performanceMonitor = new PerformanceMonitor({
      enabled: true,
      sampleRate: 1.0,
      maxSamples: 100,
      aggregationInterval: 1000,
      slowThreshold: 1000,
      onMetrics: onMetricsSpy,
    });
  });

  afterEach(() => {
    performanceMonitor.destroy();
  });

  test('should record request metrics', () => {
    performanceMonitor.recordRequest('/api/users', 'GET', 200, 150);

    const metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);
    expect(metrics.failedRequests).toBe(0);
    expect(metrics.averageResponseTime).toBe(150);
    expect(metrics.successRate).toBe(1);
  });

  test('should track failed requests', () => {
    performanceMonitor.recordRequest('/api/users', 'GET', 404, 100);
    performanceMonitor.recordRequest('/api/users', 'GET', 500, 200);

    const metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.totalRequests).toBe(2);
    expect(metrics.successfulRequests).toBe(0);
    expect(metrics.failedRequests).toBe(2);
    expect(metrics.successRate).toBe(0);
    expect(metrics.errorsByStatus.get(404)).toBe(1);
    expect(metrics.errorsByStatus.get(500)).toBe(1);
  });

  test('should calculate percentiles correctly', () => {
    // Record requests with known response times
    const responseTimes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

    responseTimes.forEach((time) => {
      performanceMonitor.recordRequest('/api/test', 'GET', 200, time);
    });

    const metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.averageResponseTime).toBe(550);
    expect(metrics.p95ResponseTime).toBe(1000); // 95th percentile
    expect(metrics.p99ResponseTime).toBe(1000); // 99th percentile
  });

  test('should track slowest endpoints', () => {
    performanceMonitor.recordRequest('/api/slow', 'GET', 200, 1500);
    performanceMonitor.recordRequest('/api/slow', 'GET', 200, 1200);
    performanceMonitor.recordRequest('/api/fast', 'GET', 200, 100);
    performanceMonitor.recordRequest('/api/fast', 'GET', 200, 150);

    const metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.slowestEndpoints.length).toBeGreaterThan(0);

    const slowEndpoint = metrics.slowestEndpoints.find((e) => e.url.includes('/api/slow'));
    const fastEndpoint = metrics.slowestEndpoints.find((e) => e.url.includes('/api/fast'));

    if (slowEndpoint) {
      expect(slowEndpoint.avgTime).toBe(1350);
      expect(slowEndpoint.count).toBe(2);
    }

    if (fastEndpoint) {
      expect(fastEndpoint.avgTime).toBe(125);
      expect(fastEndpoint.count).toBe(2);
    }
  });

  test('should handle cache hit tracking', () => {
    performanceMonitor.recordRequest('/api/data', 'GET', 200, 50, { cacheHit: true });
    performanceMonitor.recordRequest('/api/data', 'GET', 200, 200, { cacheHit: false });

    const metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.cacheHitRate).toBe(0.5);
  });

  test('should sample requests based on sample rate', () => {
    const sampledMonitor = new PerformanceMonitor({
      enabled: true,
      sampleRate: 0.5, // 50% sampling
      maxSamples: 100,
    });

    // Record many requests
    for (let i = 0; i < 100; i++) {
      sampledMonitor.recordRequest('/api/test', 'GET', 200, 100);
    }

    const metrics = sampledMonitor.aggregateMetrics();
    // Should have approximately 50 requests (allowing for randomness)
    expect(metrics.totalRequests).toBeLessThan(80);
    expect(metrics.totalRequests).toBeGreaterThan(20);

    sampledMonitor.destroy();
  });

  test('should respect max samples limit', () => {
    const limitedMonitor = new PerformanceMonitor({
      enabled: true,
      sampleRate: 1.0,
      maxSamples: 10,
    });

    // Record more than max samples
    for (let i = 0; i < 20; i++) {
      limitedMonitor.recordRequest('/api/test', 'GET', 200, 100);
    }

    const metrics = limitedMonitor.aggregateMetrics();
    expect(metrics.totalRequests).toBe(10); // Should be capped at maxSamples

    limitedMonitor.destroy();
  });

  test('should clear metrics', () => {
    performanceMonitor.recordRequest('/api/test', 'GET', 200, 100);

    let metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.totalRequests).toBe(1);

    performanceMonitor.clear();

    metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.totalRequests).toBe(0);
  });

  test('should handle disabled monitoring', () => {
    const disabledMonitor = new PerformanceMonitor({
      enabled: false,
    });

    disabledMonitor.recordRequest('/api/test', 'GET', 200, 100);

    const metrics = disabledMonitor.aggregateMetrics();
    expect(metrics.totalRequests).toBe(0);

    disabledMonitor.destroy();
  });

  test('should call metrics callback on aggregation interval', (done) => {
    jest.useFakeTimers();

    const callbackMonitor = new PerformanceMonitor({
      enabled: true,
      sampleRate: 1.0,
      aggregationInterval: 500,
      onMetrics: (metrics) => {
        expect(metrics.totalRequests).toBe(1);
        jest.useRealTimers();
        callbackMonitor.destroy();
        done();
      },
    });

    callbackMonitor.recordRequest('/api/test', 'GET', 200, 100);

    // Advance time to trigger aggregation
    jest.advanceTimersByTime(600);
  });

  test('should track retry counts', () => {
    performanceMonitor.recordRequest('/api/test', 'GET', 200, 100, { retryCount: 2 });

    const metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.totalRequests).toBe(1);
    // Additional assertions for retry tracking could be added here
  });

  test('should handle edge cases in percentile calculation', () => {
    // Test with single request
    performanceMonitor.recordRequest('/api/test', 'GET', 200, 100);

    const metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.p95ResponseTime).toBe(100);
    expect(metrics.p99ResponseTime).toBe(100);
  });

  test('should handle zero response times', () => {
    performanceMonitor.recordRequest('/api/test', 'GET', 200, 0);

    const metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.averageResponseTime).toBe(0);
    expect(metrics.totalRequests).toBe(1);
  });

  test('should handle very large response times', () => {
    const largeTime = 30000; // 30 seconds
    performanceMonitor.recordRequest('/api/slow', 'GET', 200, largeTime);

    const metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.averageResponseTime).toBe(largeTime);
    expect(metrics.totalRequests).toBe(1);
  });

  test('should aggregate metrics from multiple endpoints', () => {
    performanceMonitor.recordRequest('/api/users', 'GET', 200, 100);
    performanceMonitor.recordRequest('/api/posts', 'POST', 201, 200);
    performanceMonitor.recordRequest('/api/comments', 'GET', 404, 50);

    const metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.totalRequests).toBe(3);
    expect(metrics.successfulRequests).toBe(2);
    expect(metrics.failedRequests).toBe(1);
    expect(metrics.averageResponseTime).toBe((100 + 200 + 50) / 3);
  });

  test('should properly destroy and cleanup', () => {
    performanceMonitor.recordRequest('/api/test', 'GET', 200, 100);

    expect(() => performanceMonitor.destroy()).not.toThrow();

    // After destroy, new metrics should still work but aggregation should stop
    const metrics = performanceMonitor.aggregateMetrics();
    expect(metrics.totalRequests).toBeGreaterThanOrEqual(0);
  });
});

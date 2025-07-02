// tests/health-monitor.test.ts

import { HealthMonitor } from '../core/health-monitor';

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;
  let mockHttpClient: any;
  let onStatusChangeSpy: jest.Mock;

  beforeEach(() => {
    onStatusChangeSpy = jest.fn();
    mockHttpClient = {
      get: jest.fn(),
    };

    // Create health monitor but don't auto-start
    healthMonitor = new HealthMonitor(
      {
        enabled: false, // Disable auto-start to control when checks happen
        endpoint: '/health',
        interval: 1000,
        timeout: 5000,
        onStatusChange: onStatusChangeSpy,
      },
      mockHttpClient
    );
  });

  afterEach(() => {
    healthMonitor.destroy();
  });

  test('should start with default healthy status', () => {
    const status = healthMonitor.getStatus();
    expect(status.isHealthy).toBe(true); // Default initial state
    expect(status.lastCheckTime).toBe(0);
    expect(status.responseTime).toBe(0);
  });

  test('should perform successful health check', async () => {
    mockHttpClient.get.mockResolvedValue({ status: 200 });

    const status = await healthMonitor.performHealthCheck();

    expect(status.isHealthy).toBe(true);
    expect(status.lastCheckTime).toBeGreaterThan(0);
    expect(status.responseTime).toBeGreaterThanOrEqual(0);
    expect(status.error).toBeUndefined();
  });

  test('should handle failed health check', async () => {
    mockHttpClient.get.mockRejectedValue(new Error('Network error'));

    const status = await healthMonitor.performHealthCheck();

    expect(status.isHealthy).toBe(false);
    expect(status.lastCheckTime).toBeGreaterThan(0);
    expect(status.responseTime).toBeGreaterThanOrEqual(0);
    expect(status.error).toBe('Network error');
  });

  test('should detect status changes and call callback', async () => {
    // Start with failed check to set initial unhealthy state
    mockHttpClient.get.mockRejectedValue(new Error('Service down'));
    await healthMonitor.performHealthCheck();

    expect(onStatusChangeSpy).toHaveBeenCalledWith(false);
    onStatusChangeSpy.mockClear();

    // Make it healthy again
    mockHttpClient.get.mockResolvedValue({ status: 200 });
    await healthMonitor.performHealthCheck();

    expect(onStatusChangeSpy).toHaveBeenCalledWith(true);
  });

  test('should not call callback if status unchanged', async () => {
    // Start with successful checks (both healthy)
    mockHttpClient.get.mockResolvedValue({ status: 200 });

    await healthMonitor.performHealthCheck();
    const firstCallCount = onStatusChangeSpy.mock.calls.length;

    await healthMonitor.performHealthCheck();
    const secondCallCount = onStatusChangeSpy.mock.calls.length;

    // Should only call when status actually changes
    expect(secondCallCount).toBe(firstCallCount);
  });

  test('should handle different HTTP status codes', async () => {
    const testCases = [
      { status: 200, expectedHealthy: true },
      { status: 204, expectedHealthy: true },
      { status: 299, expectedHealthy: true },
      { status: 300, expectedHealthy: false },
      { status: 404, expectedHealthy: false },
      { status: 500, expectedHealthy: false },
    ];

    for (const { status, expectedHealthy } of testCases) {
      mockHttpClient.get.mockResolvedValue({ status });

      const healthStatus = await healthMonitor.performHealthCheck();
      expect(healthStatus.isHealthy).toBe(expectedHealthy);
    }
  });

  test('should measure response time accurately', async () => {
    const delay = 50; // Reduced delay for faster test
    mockHttpClient.get.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ status: 200 }), delay))
    );

    const status = await healthMonitor.performHealthCheck();

    expect(status.responseTime).toBeGreaterThanOrEqual(delay - 10); // Allow some tolerance
    expect(status.responseTime).toBeLessThan(delay + 100);
  });

  test('should update lastHealthyTime only on successful checks', async () => {
    // First successful check
    mockHttpClient.get.mockResolvedValue({ status: 200 });
    const status1 = await healthMonitor.performHealthCheck();
    const firstHealthyTime = status1.lastHealthyTime;

    expect(firstHealthyTime).toBeGreaterThan(0);

    // Failed check
    mockHttpClient.get.mockRejectedValue(new Error('Failed'));
    const status2 = await healthMonitor.performHealthCheck();

    expect(status2.isHealthy).toBe(false);
    expect(status2.lastHealthyTime).toBe(firstHealthyTime); // Should not change
  });

  test('should use fetch API when no HTTP client provided', async () => {
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
    }) as jest.Mock;

    const noClientMonitor = new HealthMonitor({
      enabled: false, // Don't auto-start
      endpoint: 'http://example.com/health',
      timeout: 5000,
    });

    const status = await noClientMonitor.performHealthCheck();

    expect(status.isHealthy).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://example.com/health',
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    );

    noClientMonitor.destroy();
  });

  test('should handle fetch timeout', async () => {
    // Mock fetch to simulate timeout
    global.fetch = jest
      .fn()
      .mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), 100))
      ) as jest.Mock;

    const timeoutMonitor = new HealthMonitor({
      enabled: false,
      endpoint: 'http://example.com/health',
      timeout: 50, // Very short timeout
    });

    const status = await timeoutMonitor.performHealthCheck();

    expect(status.isHealthy).toBe(false);
    expect(status.error).toContain('AbortError');

    timeoutMonitor.destroy();
  });

  test('should start and stop monitoring', async () => {
    jest.useFakeTimers();

    const intervalMonitor = new HealthMonitor(
      {
        enabled: false, // Start disabled
        endpoint: '/health',
        interval: 1000,
      },
      mockHttpClient
    );

    mockHttpClient.get.mockResolvedValue({ status: 200 });

    // Start monitoring
    intervalMonitor.start();

    // Advance time and check if health check is called
    jest.advanceTimersByTime(1500);
    await Promise.resolve(); // Allow async operations to complete

    expect(mockHttpClient.get).toHaveBeenCalled();

    // Stop monitoring
    intervalMonitor.stop();
    mockHttpClient.get.mockClear();

    // Advance time again - should not call health check
    jest.advanceTimersByTime(2000);
    expect(mockHttpClient.get).not.toHaveBeenCalled();

    jest.useRealTimers();
    intervalMonitor.destroy();
  });

  test('should check health immediately with checkNow', async () => {
    mockHttpClient.get.mockResolvedValue({ status: 200 });

    const status = await healthMonitor.checkNow();

    expect(status.isHealthy).toBe(true);
    expect(mockHttpClient.get).toHaveBeenCalledWith('/health', {
      timeout: 5000,
    });
  });

  test('should update configuration', () => {
    const originalConfig = healthMonitor.getConfig();
    expect(originalConfig.interval).toBe(1000);

    healthMonitor.updateConfig({ interval: 2000 });

    const updatedConfig = healthMonitor.getConfig();
    expect(updatedConfig.interval).toBe(2000);
  });

  test('should restart monitoring when interval changes', () => {
    const spy = jest.spyOn(healthMonitor, 'start');

    // Enable first
    healthMonitor.updateConfig({ enabled: true, interval: 500 });

    expect(spy).toHaveBeenCalled();
  });

  test('should stop monitoring when disabled', () => {
    const spy = jest.spyOn(healthMonitor, 'stop');

    healthMonitor.updateConfig({ enabled: false });

    expect(spy).toHaveBeenCalled();
  });

  test('should start monitoring when enabled', () => {
    const disabledMonitor = new HealthMonitor(
      {
        enabled: false,
        endpoint: '/health',
      },
      mockHttpClient
    );

    const spy = jest.spyOn(disabledMonitor, 'start');

    disabledMonitor.updateConfig({ enabled: true });

    expect(spy).toHaveBeenCalled();

    disabledMonitor.destroy();
  });

  test('should calculate time since healthy', () => {
    jest.useFakeTimers();
    const startTime = Date.now();

    // Set a known healthy time by directly modifying the status
    const status = healthMonitor.getStatus();
    status.lastHealthyTime = startTime;

    // Advance time
    jest.advanceTimersByTime(5000);

    const timeSinceHealthy = healthMonitor.getTimeSinceHealthy();
    // Allow for 1ms tolerance due to timing precision
    expect(timeSinceHealthy).toBeGreaterThanOrEqual(5000);
    expect(timeSinceHealthy).toBeLessThanOrEqual(5001);

    jest.useRealTimers();
  });

  test('should calculate time since last check', async () => {
    jest.useFakeTimers();

    // Perform a health check
    mockHttpClient.get.mockResolvedValue({ status: 200 });
    await healthMonitor.performHealthCheck();

    // Advance time
    jest.advanceTimersByTime(3000);

    const timeSinceCheck = healthMonitor.getTimeSinceLastCheck();
    expect(timeSinceCheck).toBeGreaterThanOrEqual(3000);

    jest.useRealTimers();
  });

  test('should check if healthy', () => {
    // Initially healthy by default in our implementation
    expect(healthMonitor.isHealthy()).toBe(true);
  });

  test('should handle configuration edge cases', () => {
    const edgeCaseMonitor = new HealthMonitor({
      enabled: false,
      endpoint: '',
      interval: 0,
      timeout: 0,
    });

    expect(edgeCaseMonitor.getConfig().endpoint).toBe('');
    expect(edgeCaseMonitor.getConfig().interval).toBe(0);

    edgeCaseMonitor.destroy();
  });

  test('should handle multiple rapid health checks', async () => {
    mockHttpClient.get.mockResolvedValue({ status: 200 });

    // Perform multiple health checks rapidly
    const promises = Array(5)
      .fill(0)
      .map(() => healthMonitor.performHealthCheck());
    const results = await Promise.all(promises);

    // All should succeed
    results.forEach((result) => {
      expect(result.isHealthy).toBe(true);
    });
  });

  test('should maintain health status consistency', async () => {
    // Start healthy
    mockHttpClient.get.mockResolvedValue({ status: 200 });
    await healthMonitor.performHealthCheck();
    expect(healthMonitor.isHealthy()).toBe(true);

    // Make unhealthy
    mockHttpClient.get.mockRejectedValue(new Error('Service down'));
    await healthMonitor.performHealthCheck();
    expect(healthMonitor.isHealthy()).toBe(false);

    // Back to healthy
    mockHttpClient.get.mockResolvedValue({ status: 200 });
    await healthMonitor.performHealthCheck();
    expect(healthMonitor.isHealthy()).toBe(true);
  });

  test('should cleanup properly on destroy', () => {
    const spy = jest.spyOn(healthMonitor, 'stop');

    healthMonitor.destroy();

    expect(spy).toHaveBeenCalled();
  });
});

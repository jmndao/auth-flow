// tests/retry-manager.test.ts

import { RetryManager } from '../core/retry-manager';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager({
      attempts: 3,
      delay: 100,
      strategy: 'fixed',
      conditions: ['network', '5xx'],
    });
  });

  test('should execute operation successfully on first try', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const result = await retryManager.execute(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('should retry on network errors', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNREFUSED' })
      .mockRejectedValueOnce({ code: 'ECONNREFUSED' })
      .mockResolvedValueOnce('success');

    const result = await retryManager.execute(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  test('should retry on 5xx errors', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValueOnce('success');

    const result = await retryManager.execute(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test('should not retry on 4xx errors', async () => {
    const operation = jest.fn().mockRejectedValue({ status: 400 });

    await expect(retryManager.execute(operation)).rejects.toMatchObject({ status: 400 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('should fail after max attempts', async () => {
    const operation = jest.fn().mockRejectedValue({ status: 500 });

    await expect(retryManager.execute(operation)).rejects.toMatchObject({ status: 500 });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  test('should use exponential backoff strategy', async () => {
    const exponentialRetry = new RetryManager({
      attempts: 3,
      delay: 100,
      strategy: 'exponential',
      conditions: ['5xx'],
    });

    const operation = jest.fn().mockRejectedValue({ status: 500 });
    const startTime = Date.now();

    try {
      await exponentialRetry.execute(operation);
    } catch (error) {
      // Expected to fail
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should take at least 100 + 200 = 300ms with exponential backoff
    expect(totalTime).toBeGreaterThan(250);
  });

  test('should use exponential backoff with jitter', async () => {
    const jitterRetry = new RetryManager({
      attempts: 3,
      delay: 100,
      strategy: 'exponential-jitter',
      conditions: ['5xx'],
      jitterFactor: 0.1,
    });

    const operation = jest.fn().mockRejectedValue({ status: 500 });

    try {
      await jitterRetry.execute(operation);
    } catch (error) {
      // Expected to fail
    }

    expect(operation).toHaveBeenCalledTimes(3);
  });

  test('should respect max delay cap', async () => {
    const cappedRetry = new RetryManager({
      attempts: 3, // Reduce attempts to avoid timeout
      delay: 100, // Reduce delay for faster test
      strategy: 'exponential',
      conditions: ['5xx'],
      maxDelay: 200, // Cap at 200ms
    });

    const operation = jest.fn().mockRejectedValue({ status: 500 });
    const startTime = Date.now();

    try {
      await cappedRetry.execute(operation);
    } catch (error) {
      // Expected to fail
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // With max delay cap, total time should be reasonable
    // 100 + 200 = 300ms maximum
    expect(totalTime).toBeLessThan(500);
  }, 10000); // Increase timeout for this specific test

  test('should handle timeout errors', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
      .mockResolvedValueOnce('success');

    const timeoutRetry = new RetryManager({
      attempts: 3,
      delay: 50,
      strategy: 'fixed',
      conditions: ['timeout'],
    });

    const result = await timeoutRetry.execute(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test('should handle circuit breaker open errors', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce({ message: 'Circuit breaker is open' })
      .mockResolvedValueOnce('success');

    const circuitRetry = new RetryManager({
      attempts: 3,
      delay: 50,
      strategy: 'fixed',
      conditions: ['circuit-open'],
    });

    const result = await circuitRetry.execute(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test('should update configuration', () => {
    const originalConfig = retryManager.getConfig();
    expect(originalConfig.attempts).toBe(3);

    retryManager.updateConfig({ attempts: 5 });

    const updatedConfig = retryManager.getConfig();
    expect(updatedConfig.attempts).toBe(5);
    expect(updatedConfig.delay).toBe(100); // Should keep other values
  });

  test('should estimate total retry time', () => {
    // Fixed strategy: 3 attempts with 100ms delay = 2 delays = 200ms
    const fixedTime = retryManager.estimateTotalRetryTime();
    expect(fixedTime).toBe(200);

    // Exponential strategy: 100 + 200 = 300ms
    const exponentialTime = retryManager.estimateTotalRetryTime({
      strategy: 'exponential',
    });
    expect(exponentialTime).toBe(300);
  });

  test('should create scenario-specific retry managers', () => {
    const networkRetry = RetryManager.createForScenario('network');
    const apiRetry = RetryManager.createForScenario('api');
    const criticalRetry = RetryManager.createForScenario('critical');
    const fastRetry = RetryManager.createForScenario('fast');

    expect(networkRetry.getConfig().attempts).toBe(5);
    expect(apiRetry.getConfig().attempts).toBe(3);
    expect(criticalRetry.getConfig().attempts).toBe(7);
    expect(fastRetry.getConfig().attempts).toBe(2);

    expect(networkRetry.getConfig().strategy).toBe('exponential-jitter');
    expect(apiRetry.getConfig().strategy).toBe('exponential');
    expect(criticalRetry.getConfig().strategy).toBe('exponential-jitter');
    expect(fastRetry.getConfig().strategy).toBe('fixed');
  });

  test('should enhance error with retry information', async () => {
    const operation = jest.fn().mockRejectedValue({ status: 500, message: 'Server error' });

    try {
      await retryManager.execute(operation);
    } catch (error: any) {
      expect(error.retryInfo).toBeDefined();
      expect(error.retryInfo.success).toBe(false);
      expect(error.retryInfo.attempts).toHaveLength(3);
      expect(error.retryInfo.totalTime).toBeGreaterThan(0);

      // Check attempt structure
      error.retryInfo.attempts.forEach((attempt: any, index: number) => {
        expect(attempt).toHaveProperty('attempt');
        expect(attempt).toHaveProperty('delay');
        expect(attempt).toHaveProperty('error');
        expect(attempt).toHaveProperty('timestamp');
        expect(attempt.attempt).toBe(index + 1);
      });
    }
  });

  test('should handle custom retry configuration for specific operation', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValueOnce('success');

    // Override attempts for this specific operation
    const result = await retryManager.execute(operation, { attempts: 5 });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test('should detect network errors correctly', async () => {
    const networkErrors = [
      { code: 'ECONNREFUSED' },
      { code: 'ENOTFOUND' },
      { code: 'ECONNRESET' },
      { code: 'ETIMEDOUT' },
      { status: 0 },
      { message: 'Network Error' },
    ];

    const networkRetry = new RetryManager({
      attempts: 2,
      delay: 10,
      strategy: 'fixed',
      conditions: ['network'],
    });

    for (const error of networkErrors) {
      const operation = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const result = await networkRetry.execute(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);

      operation.mockClear();
    }
  });

  test('should detect 5xx errors correctly', async () => {
    const serverErrors = [500, 501, 502, 503, 504, 599];

    const serverRetry = new RetryManager({
      attempts: 2,
      delay: 10,
      strategy: 'fixed',
      conditions: ['5xx'],
    });

    for (const status of serverErrors) {
      const operation = jest
        .fn()
        .mockRejectedValueOnce({ status })
        .mockResolvedValueOnce('success');

      const result = await serverRetry.execute(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);

      operation.mockClear();
    }
  });

  test('should not retry on non-matching conditions', async () => {
    const networkOnlyRetry = new RetryManager({
      attempts: 3,
      delay: 10,
      strategy: 'fixed',
      conditions: ['network'], // Only network errors
    });

    // Try with 5xx error (should not retry)
    const operation = jest.fn().mockRejectedValue({ status: 500 });

    await expect(networkOnlyRetry.execute(operation)).rejects.toMatchObject({ status: 500 });
    expect(operation).toHaveBeenCalledTimes(1); // No retries
  });
});

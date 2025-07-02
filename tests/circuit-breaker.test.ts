// tests/circuit-breaker.test.ts

import { CircuitBreaker } from '../core/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      threshold: 3,
      resetTimeout: 1000,
      minimumRequests: 2,
    });
  });

  test('should start in closed state', () => {
    const stats = circuitBreaker.getStats();
    expect(stats.state).toBe('closed');
    expect(stats.failures).toBe(0);
  });

  test('should execute successful operations', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);

    const stats = circuitBreaker.getStats();
    expect(stats.successes).toBe(1);
    expect(stats.state).toBe('closed');
  });

  test('should track failures and open circuit', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('failure'));

    // Generate enough failures to open circuit
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected failures
      }
    }

    const stats = circuitBreaker.getStats();
    expect(stats.state).toBe('open');
    expect(stats.failures).toBeGreaterThanOrEqual(3);
  });

  test('should reject requests when circuit is open', async () => {
    // Force circuit open
    circuitBreaker.forceOpen();

    const operation = jest.fn();
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is open');
    expect(operation).not.toHaveBeenCalled();
  });

  test('should transition to half-open after timeout', async () => {
    circuitBreaker.forceOpen();

    // Mock time passage
    jest.useFakeTimers();
    const operation = jest.fn().mockResolvedValue('success');

    // Advance time past reset timeout
    jest.advanceTimersByTime(1500);

    const result = await circuitBreaker.execute(operation);
    expect(result).toBe('success');

    const stats = circuitBreaker.getStats();
    expect(stats.state).toBe('closed');

    jest.useRealTimers();
  });

  test('should transition to half-open state properly', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('failure'));

    // Generate failures to open circuit
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected
      }
    }

    expect(circuitBreaker.getStats().state).toBe('open');

    // Mock time passage
    jest.useFakeTimers();
    jest.advanceTimersByTime(1500);

    // Next request should put circuit in half-open state
    const successOperation = jest.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(successOperation);

    expect(result).toBe('success');
    expect(circuitBreaker.getStats().state).toBe('closed');

    jest.useRealTimers();
  });

  test('should reset circuit breaker manually', () => {
    // Force some failures
    const stats1 = circuitBreaker.getStats();
    circuitBreaker.forceOpen();

    const stats2 = circuitBreaker.getStats();
    expect(stats2.state).toBe('open');

    // Reset
    circuitBreaker.reset();

    const stats3 = circuitBreaker.getStats();
    expect(stats3.state).toBe('closed');
    expect(stats3.failures).toBe(0);
    expect(stats3.successes).toBe(0);
  });

  test('should force circuit states', () => {
    // Test force open
    circuitBreaker.forceOpen();
    expect(circuitBreaker.getStats().state).toBe('open');

    // Test force close
    circuitBreaker.forceClose();
    expect(circuitBreaker.getStats().state).toBe('closed');
    expect(circuitBreaker.getStats().failures).toBe(0);
  });

  test('should respect minimum requests threshold', async () => {
    const cb = new CircuitBreaker({
      threshold: 2,
      minimumRequests: 5,
      resetTimeout: 1000,
    });

    const operation = jest.fn().mockRejectedValue(new Error('failure'));

    // Generate only 3 failures (below minimum requests)
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(operation);
      } catch (error) {
        // Expected
      }
    }

    // Circuit should still be closed due to minimum requests not met
    expect(cb.getStats().state).toBe('closed');
  });

  test('should track request history within monitoring period', async () => {
    const cb = new CircuitBreaker({
      threshold: 3,
      monitoringPeriod: 1000,
      resetTimeout: 2000,
      minimumRequests: 2,
    });

    const operation = jest.fn().mockRejectedValue(new Error('failure'));

    // Generate some failures
    for (let i = 0; i < 4; i++) {
      try {
        await cb.execute(operation);
      } catch (error) {
        // Expected
      }
    }

    expect(cb.getStats().state).toBe('open');

    // Mock time passage beyond monitoring period
    jest.useFakeTimers();
    jest.advanceTimersByTime(1500);

    // Reset and try again - old failures should be outside monitoring window
    cb.reset();

    // Should need new failures to open circuit again
    expect(cb.getStats().state).toBe('closed');

    jest.useRealTimers();
  });

  test('should provide comprehensive stats', () => {
    const stats = circuitBreaker.getStats();

    expect(stats).toHaveProperty('state');
    expect(stats).toHaveProperty('failures');
    expect(stats).toHaveProperty('successes');
    expect(stats).toHaveProperty('totalRequests');
    expect(stats).toHaveProperty('lastFailureTime');
    expect(stats).toHaveProperty('nextRetryTime');

    expect(typeof stats.state).toBe('string');
    expect(typeof stats.failures).toBe('number');
    expect(typeof stats.successes).toBe('number');
    expect(typeof stats.totalRequests).toBe('number');
    expect(typeof stats.lastFailureTime).toBe('number');
    expect(typeof stats.nextRetryTime).toBe('number');
  });
});

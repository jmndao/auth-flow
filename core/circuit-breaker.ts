import type { CircuitState, CircuitBreakerConfig, CircuitBreakerStats } from '../types/resilience';

/**
 * CircuitBreaker implements the circuit breaker pattern to prevent cascade failures
 * by temporarily stopping requests to failing services.
 *
 * Features:
 * - Three states: closed, open, half-open
 * - Configurable failure threshold and reset timeout
 * - Request history tracking within monitoring window
 * - Automatic state transitions based on success/failure patterns
 * - Comprehensive statistics and monitoring
 */
export class CircuitBreaker {
  /** Current circuit breaker state */
  private state: CircuitState = 'closed';

  /** Number of consecutive failures */
  private failures = 0;

  /** Number of consecutive successes */
  private successes = 0;

  /** Total requests processed */
  private totalRequests = 0;

  /** Timestamp of the last failure */
  private lastFailureTime = 0;

  /** Request history for monitoring period */
  private requestHistory: { timestamp: number; success: boolean }[] = [];

  /** Circuit breaker configuration */
  private readonly config: CircuitBreakerConfig;

  /**
   * Creates a new CircuitBreaker instance
   *
   * @param config - Circuit breaker configuration options
   */
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      threshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      minimumRequests: 10,
      ...config,
    };
  }

  /**
   * Executes an operation through the circuit breaker
   *
   * @param operation - The operation to execute
   * @returns Promise resolving to the operation result
   * @throws Error if circuit is open and not ready for retry
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Checks if the circuit should attempt to reset from open to half-open state
   *
   * @returns True if enough time has passed since last failure
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.resetTimeout;
  }

  /**
   * Handles successful operation execution
   * Updates success counters and potentially closes the circuit
   */
  private onSuccess(): void {
    this.successes++;
    this.totalRequests++;
    this.recordRequest(true);

    // If in half-open state and operation succeeded, close the circuit
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
    }
  }

  /**
   * Handles failed operation execution
   * Updates failure counters and potentially opens the circuit
   */
  private onFailure(): void {
    this.failures++;
    this.totalRequests++;
    this.lastFailureTime = Date.now();
    this.recordRequest(false);

    if (this.shouldOpenCircuit()) {
      this.state = 'open';
    }
  }

  /**
   * Determines if the circuit should be opened based on failure rate
   *
   * @returns True if circuit should be opened
   */
  private shouldOpenCircuit(): boolean {
    // Need minimum requests before circuit can open
    if (this.totalRequests < this.config.minimumRequests) {
      return false;
    }

    const recentFailures = this.getRecentFailures();
    return recentFailures >= this.config.threshold;
  }

  /**
   * Counts failures within the monitoring period
   *
   * @returns Number of recent failures
   */
  private getRecentFailures(): number {
    const cutoff = Date.now() - this.config.monitoringPeriod;
    return this.requestHistory.filter((req) => req.timestamp > cutoff && !req.success).length;
  }

  /**
   * Records a request in the history for monitoring
   *
   * @param success - Whether the request was successful
   */
  private recordRequest(success: boolean): void {
    const now = Date.now();
    this.requestHistory.push({ timestamp: now, success });

    // Keep only recent history within monitoring period
    const cutoff = now - this.config.monitoringPeriod;
    this.requestHistory = this.requestHistory.filter((req) => req.timestamp > cutoff);
  }

  /**
   * Gets comprehensive circuit breaker statistics
   *
   * @returns Current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.lastFailureTime + this.config.resetTimeout,
    };
  }

  /**
   * Resets the circuit breaker to initial state
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.lastFailureTime = 0;
    this.requestHistory = [];
  }

  /**
   * Forces the circuit to open state
   * Useful for maintenance or emergency situations
   */
  forceOpen(): void {
    this.state = 'open';
    this.lastFailureTime = Date.now();
  }

  /**
   * Forces the circuit to closed state
   * Resets failure count and allows requests through
   */
  forceClose(): void {
    this.state = 'closed';
    this.failures = 0;
  }
}

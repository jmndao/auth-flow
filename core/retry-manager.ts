import type { RetryConfig } from '../types/resilience';

/**
 * Retry attempt information
 */
interface RetryAttempt {
  /** Attempt number (1-based) */
  attempt: number;
  /** Delay before this attempt in milliseconds */
  delay: number;
  /** Error from previous attempt */
  error?: any;
  /** Timestamp of attempt */
  timestamp: number;
}

/**
 * Retry execution result
 */
interface RetryResult<T> {
  /** Final result if successful */
  result?: T;
  /** Final error if all attempts failed */
  error?: any;
  /** All retry attempts made */
  attempts: RetryAttempt[];
  /** Total time spent retrying */
  totalTime: number;
  /** Whether operation ultimately succeeded */
  success: boolean;
}

/**
 * RetryManager implements sophisticated retry strategies with configurable backoff algorithms.
 *
 * Features:
 * - Multiple retry strategies: fixed, exponential, exponential with jitter
 * - Configurable retry conditions based on error types
 * - Maximum delay caps to prevent excessive wait times
 * - Comprehensive retry statistics and attempt tracking
 * - Conditional retry logic based on error characteristics
 * - Circuit breaker integration support
 */
export class RetryManager {
  /** Retry configuration */
  private config: RetryConfig;

  /**
   * Creates a new RetryManager instance
   *
   * @param config - Retry configuration options
   */
  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      attempts: 3,
      delay: 1000,
      strategy: 'exponential',
      conditions: ['network', '5xx', 'timeout'],
      maxDelay: 30000, // 30 seconds
      jitterFactor: 0.1,
      ...config,
    };
  }

  /**
   * Executes an operation with retry logic
   *
   * @param operation - Function to execute with retries
   * @param customConfig - Optional custom retry configuration for this operation
   * @returns Promise resolving to retry result
   */
  async execute<T>(operation: () => Promise<T>, customConfig?: Partial<RetryConfig>): Promise<T> {
    const config = customConfig ? { ...this.config, ...customConfig } : this.config;
    const attempts: RetryAttempt[] = [];
    const startTime = Date.now();
    let lastError: any;

    for (let attemptNumber = 1; attemptNumber <= config.attempts; attemptNumber++) {
      const attemptStartTime = Date.now();

      try {
        const result = await operation();

        // Record successful attempt
        attempts.push({
          attempt: attemptNumber,
          delay: attemptNumber === 1 ? 0 : this.calculateDelay(attemptNumber - 1, config),
          timestamp: attemptStartTime,
        });

        return result;
      } catch (error) {
        lastError = error;

        const delay =
          attemptNumber < config.attempts ? this.calculateDelay(attemptNumber, config) : 0;

        attempts.push({
          attempt: attemptNumber,
          delay,
          error,
          timestamp: attemptStartTime,
        });

        // Check if we should retry this error
        if (attemptNumber < config.attempts && this.shouldRetry(error, config)) {
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    // All attempts failed
    const totalTime = Date.now() - startTime;
    const retryResult: RetryResult<T> = {
      error: lastError,
      attempts,
      totalTime,
      success: false,
    };

    // Enhance error with retry information
    if (lastError) {
      lastError.retryInfo = retryResult;
    }

    throw lastError;
  }

  /**
   * Calculates delay for a specific attempt based on strategy
   *
   * @param attemptNumber - Current attempt number (1-based)
   * @param config - Retry configuration
   * @returns Delay in milliseconds
   */
  private calculateDelay(attemptNumber: number, config: RetryConfig): number {
    let delay: number;

    switch (config.strategy) {
      case 'fixed':
        delay = config.delay;
        break;

      case 'exponential':
        delay = config.delay * Math.pow(2, attemptNumber - 1);
        break;

      case 'exponential-jitter': {
        const exponentialDelay = config.delay * Math.pow(2, attemptNumber - 1);
        const jitter = exponentialDelay * config.jitterFactor! * Math.random();
        delay = exponentialDelay + jitter;
        break;
      }

      default:
        delay = config.delay;
    }

    // Apply maximum delay cap
    return Math.min(delay, config.maxDelay!);
  }

  /**
   * Determines if an error should trigger a retry
   *
   * @param error - Error to evaluate
   * @param config - Retry configuration
   * @returns True if operation should be retried
   */
  private shouldRetry(error: any, config: RetryConfig): boolean {
    // Check each condition
    for (const condition of config.conditions) {
      if (this.matchesCondition(error, condition)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if an error matches a specific retry condition
   *
   * @param error - Error to check
   * @param condition - Condition to match against
   * @returns True if error matches condition
   */
  private matchesCondition(error: any, condition: string): boolean {
    switch (condition) {
      case 'network':
        return this.isNetworkError(error);

      case '5xx':
        return this.is5xxError(error);

      case 'timeout':
        return this.isTimeoutError(error);

      case 'circuit-open':
        return this.isCircuitOpenError(error);

      default:
        return false;
    }
  }

  /**
   * Checks if error is a network-related error
   *
   * @param error - Error to check
   * @returns True if network error
   */
  private isNetworkError(error: any): boolean {
    if (!error) return false;

    // Common network error indicators
    const networkCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'];
    const networkMessages = ['network error', 'connection refused', 'dns lookup failed'];

    return (
      networkCodes.includes(error.code) ||
      error.status === 0 ||
      networkMessages.some((msg) => error.message && error.message.toLowerCase().includes(msg))
    );
  }

  /**
   * Checks if error is a 5xx server error
   *
   * @param error - Error to check
   * @returns True if 5xx error
   */
  private is5xxError(error: any): boolean {
    return error.status >= 500 && error.status < 600;
  }

  /**
   * Checks if error is a timeout error
   *
   * @param error - Error to check
   * @returns True if timeout error
   */
  private isTimeoutError(error: any): boolean {
    return (
      error.code === 'ETIMEDOUT' ||
      error.code === 'TIMEOUT' ||
      (error.message && error.message.toLowerCase().includes('timeout'))
    );
  }

  /**
   * Checks if error is due to circuit breaker being open
   *
   * @param error - Error to check
   * @returns True if circuit open error
   */
  private isCircuitOpenError(error: any): boolean {
    return error.message && error.message.toLowerCase().includes('circuit breaker is open');
  }

  /**
   * Sleep utility for retry delays
   *
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Updates retry configuration
   *
   * @param updates - Configuration updates to apply
   */
  updateConfig(updates: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Gets current retry configuration
   *
   * @returns Current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Calculates total time for all retry attempts
   *
   * @param customConfig - Optional custom configuration
   * @returns Estimated total retry time in milliseconds
   */
  estimateTotalRetryTime(customConfig?: Partial<RetryConfig>): number {
    const config = customConfig ? { ...this.config, ...customConfig } : this.config;
    let totalTime = 0;

    for (let attempt = 1; attempt < config.attempts; attempt++) {
      totalTime += this.calculateDelay(attempt, config);
    }

    return totalTime;
  }

  /**
   * Creates a custom retry manager for specific scenarios
   *
   * @param scenario - Predefined scenario configuration
   * @returns New RetryManager instance
   */
  static createForScenario(scenario: 'network' | 'api' | 'critical' | 'fast'): RetryManager {
    const configs = {
      network: {
        attempts: 5,
        delay: 2000,
        strategy: 'exponential-jitter' as const,
        conditions: ['network', 'timeout'],
        maxDelay: 30000,
      },
      api: {
        attempts: 3,
        delay: 1000,
        strategy: 'exponential' as const,
        conditions: ['5xx', 'timeout'],
        maxDelay: 10000,
      },
      critical: {
        attempts: 7,
        delay: 500,
        strategy: 'exponential-jitter' as const,
        conditions: ['network', '5xx', 'timeout', 'circuit-open'],
        maxDelay: 60000,
      },
      fast: {
        attempts: 2,
        delay: 500,
        strategy: 'fixed' as const,
        conditions: ['5xx'],
        maxDelay: 1000,
      },
    };

    return new RetryManager(configs[scenario] as RetryConfig);
  }
}

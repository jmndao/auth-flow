/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Configuration for circuit breaker
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  threshold: number;
  /** Time to wait before attempting reset (ms) */
  resetTimeout: number;
  /** Time window for monitoring failures (ms) */
  monitoringPeriod: number;
  /** Minimum requests needed before circuit can open */
  minimumRequests: number;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  /** Current circuit state */
  state: CircuitState;
  /** Number of recent failures */
  failures: number;
  /** Number of recent successes */
  successes: number;
  /** Total requests processed */
  totalRequests: number;
  /** Timestamp of last failure */
  lastFailureTime: number;
  /** When the circuit will attempt to reset */
  nextRetryTime: number;
}

/**
 * Retry strategy configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  attempts: number;
  /** Base delay between retries (ms) */
  delay: number;
  /** Retry strategy type */
  strategy: 'fixed' | 'exponential' | 'exponential-jitter';
  /** Conditions that trigger a retry */
  conditions: Array<'network' | '5xx' | 'timeout' | 'circuit-open'>;
  /** Maximum delay cap for exponential strategies (ms) */
  maxDelay?: number;
  /** Jitter factor for exponential-jitter strategy (0-1) */
  jitterFactor?: number;
}

/**
 * Health check configuration
 */
export interface HealthConfig {
  /** Whether health monitoring is enabled */
  enabled: boolean;
  /** Health check endpoint */
  endpoint: string;
  /** How often to perform health checks (ms) */
  interval: number;
  /** Timeout for health check requests (ms) */
  timeout?: number;
  /** Callback for health status changes */
  onStatusChange?: (isHealthy: boolean) => void;
}

/**
 * Request deduplication tracking
 */
export interface PendingRequest {
  /** The pending promise */
  promise: Promise<any>;
  /** When the request was started */
  timestamp: number;
  /** Number of subscribers waiting for this request */
  subscribers: number;
}

/**
 * Deduplication statistics
 */
export interface DeduplicationStats {
  /** Number of currently pending requests */
  pendingRequests: number;
  /** Timestamp of oldest pending request */
  oldestRequest: number;
  /** Total number of subscribers across all pending requests */
  totalSubscribers: number;
}

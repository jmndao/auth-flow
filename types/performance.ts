/**
 * Individual request performance metrics
 */
export interface RequestMetrics {
  /** Request URL */
  url: string;
  /** HTTP method */
  method: string;
  /** HTTP status code */
  status: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Request timestamp */
  timestamp: number;
  /** Whether the request was successful (2xx status) */
  success: boolean;
  /** Whether the response came from cache */
  cacheHit?: boolean;
  /** Number of retry attempts made */
  retryCount?: number;
}

/**
 * Aggregated performance metrics over a time period
 */
export interface AggregatedMetrics {
  /** Total number of requests */
  totalRequests: number;
  /** Number of successful requests */
  successfulRequests: number;
  /** Number of failed requests */
  failedRequests: number;
  /** Average response time in milliseconds */
  averageResponseTime: number;
  /** 95th percentile response time */
  p95ResponseTime: number;
  /** 99th percentile response time */
  p99ResponseTime: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Error count by HTTP status code */
  errorsByStatus: Map<number, number>;
  /** Slowest endpoints with their average response times */
  slowestEndpoints: Array<{ url: string; avgTime: number; count: number }>;
}

/**
 * Configuration for performance monitoring
 */
export interface PerformanceConfig {
  /** Whether monitoring is enabled */
  enabled: boolean;
  /** Sample rate for collecting metrics (0-1) */
  sampleRate: number;
  /** Maximum number of samples to keep in memory */
  maxSamples: number;
  /** How often to aggregate and report metrics (ms) */
  aggregationInterval: number;
  /** Threshold for considering a request "slow" (ms) */
  slowThreshold: number;
  /** Callback for receiving aggregated metrics */
  onMetrics?: (metrics: AggregatedMetrics) => void;
}

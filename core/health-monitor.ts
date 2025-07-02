import type { HealthConfig } from '../types/resilience';

/**
 * Health check result interface
 */
interface HealthStatus {
  /** Whether the service is healthy */
  isHealthy: boolean;
  /** Timestamp of last successful check */
  lastHealthyTime: number;
  /** Timestamp of last check attempt */
  lastCheckTime: number;
  /** Response time of last check in milliseconds */
  responseTime: number;
  /** Error message if check failed */
  error?: string;
}

/**
 * HealthMonitor continuously monitors API health and reports status changes.
 *
 * Features:
 * - Periodic health checks with configurable intervals
 * - Health status tracking and history
 * - Automatic recovery detection
 * - Response time monitoring
 * - Health status change notifications
 * - Graceful degradation support
 */
export class HealthMonitor {
  /** Current health status */
  private healthStatus: HealthStatus;

  /** Health monitoring configuration */
  private config: HealthConfig;

  /** Timer for periodic health checks */
  private healthCheckTimer?: NodeJS.Timeout;

  /** HTTP client for health checks */
  private readonly httpClient: any;

  /**
   * Creates a new HealthMonitor instance
   *
   * @param config - Health monitoring configuration
   * @param httpClient - HTTP client for making health check requests
   */
  constructor(config: Partial<HealthConfig> = {}, httpClient?: any) {
    this.config = {
      enabled: true,
      endpoint: '/health',
      interval: 60000, // 1 minute
      timeout: 5000, // 5 seconds
      ...config,
    };

    this.httpClient = httpClient;

    // Initialize health status
    this.healthStatus = {
      isHealthy: true,
      lastHealthyTime: Date.now(),
      lastCheckTime: 0,
      responseTime: 0,
    };

    if (this.config.enabled) {
      this.start();
    }
  }

  /**
   * Starts health monitoring
   */
  start(): void {
    if (this.healthCheckTimer) {
      this.stop();
    }

    // Perform initial health check
    this.performHealthCheck();

    // Schedule periodic health checks
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.interval);
  }

  /**
   * Stops health monitoring
   */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Performs a single health check
   *
   * @returns Promise resolving to health status
   */
  async performHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // Use provided HTTP client or fetch
      const response = await this.makeHealthRequest();
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const wasHealthy = this.healthStatus.isHealthy;
      const isHealthy = response.status >= 200 && response.status < 300;

      this.healthStatus = {
        isHealthy,
        lastHealthyTime: isHealthy ? endTime : this.healthStatus.lastHealthyTime,
        lastCheckTime: endTime,
        responseTime,
      };

      // Notify if health status changed
      if (wasHealthy !== isHealthy && this.config.onStatusChange) {
        this.config.onStatusChange(isHealthy);
      }
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const wasHealthy = this.healthStatus.isHealthy;

      this.healthStatus = {
        isHealthy: false,
        lastHealthyTime: this.healthStatus.lastHealthyTime,
        lastCheckTime: endTime,
        responseTime,
        error: error instanceof Error ? error.message : 'Health check failed',
      };

      // Notify if became unhealthy
      if (wasHealthy && this.config.onStatusChange) {
        this.config.onStatusChange(false);
      }
    }

    return this.healthStatus;
  }

  /**
   * Makes the actual health check HTTP request
   *
   * @returns Promise resolving to HTTP response
   */
  private async makeHealthRequest(): Promise<{ status: number }> {
    if (this.httpClient) {
      // Use provided HTTP client (e.g., axios instance)
      const response = await this.httpClient.get(this.config.endpoint, {
        timeout: this.config.timeout,
      });
      return { status: response.status };
    } else {
      // Use fetch API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(this.config.endpoint, {
          signal: controller.signal,
          method: 'GET',
        });
        clearTimeout(timeoutId);
        return { status: response.status };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }
  }

  /**
   * Gets current health status
   *
   * @returns Current health status information
   */
  getStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Checks if the service is currently healthy
   *
   * @returns True if service is healthy
   */
  isHealthy(): boolean {
    return this.healthStatus.isHealthy;
  }

  /**
   * Gets time since last successful health check
   *
   * @returns Milliseconds since last healthy status
   */
  getTimeSinceHealthy(): number {
    return Date.now() - this.healthStatus.lastHealthyTime;
  }

  /**
   * Gets time since last health check attempt
   *
   * @returns Milliseconds since last check
   */
  getTimeSinceLastCheck(): number {
    return Date.now() - this.healthStatus.lastCheckTime;
  }

  /**
   * Forces an immediate health check
   *
   * @returns Promise resolving to health status
   */
  async checkNow(): Promise<HealthStatus> {
    return this.performHealthCheck();
  }

  /**
   * Updates health monitoring configuration
   *
   * @param updates - Configuration updates to apply
   */
  updateConfig(updates: Partial<HealthConfig>): void {
    this.config = { ...this.config, ...updates };

    // Restart monitoring if interval changed
    if (updates.interval !== undefined && this.healthCheckTimer) {
      this.start();
    }

    // Stop monitoring if disabled
    if (updates.enabled === false) {
      this.stop();
    }

    // Start monitoring if enabled
    if (updates.enabled === true && !this.healthCheckTimer) {
      this.start();
    }
  }

  /**
   * Gets monitoring configuration
   *
   * @returns Current configuration
   */
  getConfig(): HealthConfig {
    return { ...this.config };
  }

  /**
   * Destroys the health monitor and cleans up resources
   */
  destroy(): void {
    this.stop();
  }
}

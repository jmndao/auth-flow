import type { PendingRequest, DeduplicationStats } from '../types/resilience';

/**
 * RequestDeduplicator prevents duplicate requests by consolidating identical
 * concurrent requests into a single network call.
 *
 * Features:
 * - Automatic request deduplication based on method, URL, and data
 * - Subscriber tracking for shared requests
 * - Automatic cleanup of stale pending requests
 * - Statistics for monitoring deduplication effectiveness
 */
export class RequestDeduplicator {
  /**
   * Maps request keys to pending request information
   */
  private readonly pending = new Map<string, PendingRequest>();

  /** Maximum age for pending requests before cleanup */
  private readonly maxAge: number;

  /**
   * Creates a new RequestDeduplicator instance
   *
   * @param maxAge - Maximum age for pending requests in milliseconds
   */
  constructor(maxAge: number = 30000) {
    // 30 seconds
    this.maxAge = maxAge;

    // Cleanup old pending requests periodically
    setInterval(() => this.cleanup(), 10000);
  }

  /**
   * Generates a unique key for request deduplication
   *
   * @param method - HTTP method
   * @param url - Request URL
   * @param data - Request data (for non-GET requests)
   * @returns Unique request key
   */
  private generateKey(method: string, url: string, data?: any): string {
    let key = `${method}:${url}`;
    if (data && method !== 'GET') {
      key += `:${JSON.stringify(data)}`;
    }
    return key;
  }

  /**
   * Removes stale pending requests that exceed the maximum age
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, request] of this.pending) {
      if (now - request.timestamp > this.maxAge) {
        this.pending.delete(key);
      }
    }
  }

  /**
   * Executes a request with deduplication
   * If an identical request is already pending, returns the existing promise
   *
   * @param method - HTTP method
   * @param url - Request URL
   * @param operation - Function that performs the actual request
   * @param data - Request data for deduplication key
   * @returns Promise resolving to the request result
   */
  async execute<T>(
    method: string,
    url: string,
    operation: () => Promise<T>,
    data?: any
  ): Promise<T> {
    const key = this.generateKey(method, url, data);
    const existing = this.pending.get(key);

    // If identical request is already pending, join it
    if (existing) {
      existing.subscribers++;
      try {
        return await existing.promise;
      } finally {
        // Decrease subscriber count when done
        existing.subscribers--;
        if (existing.subscribers <= 0) {
          this.pending.delete(key);
        }
      }
    }

    // Create new request and track it
    const promise = operation().finally(() => {
      const pendingRequest = this.pending.get(key);
      if (pendingRequest && pendingRequest.subscribers <= 0) {
        this.pending.delete(key);
      }
    });

    this.pending.set(key, {
      promise,
      timestamp: Date.now(),
      subscribers: 1,
    });

    return promise;
  }

  /**
   * Cancels a specific pending request
   *
   * @param method - HTTP method
   * @param url - Request URL
   * @param data - Request data
   */
  cancel(method: string, url: string, data?: any): void {
    const key = this.generateKey(method, url, data);
    this.pending.delete(key);
  }

  /**
   * Cancels all pending requests
   */
  cancelAll(): void {
    this.pending.clear();
  }

  /**
   * Gets deduplication statistics
   *
   * @returns Current deduplication statistics
   */
  getStats(): DeduplicationStats {
    return {
      pendingRequests: this.pending.size,
      oldestRequest: Math.min(...Array.from(this.pending.values()).map((r) => r.timestamp)),
      totalSubscribers: Array.from(this.pending.values()).reduce(
        (sum, r) => sum + r.subscribers,
        0
      ),
    };
  }
}

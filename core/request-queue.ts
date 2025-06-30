import type { QueuedRequest, RequestConfig } from '../types';

export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    this.queue = [];
    this.isRefreshing = false;
    this.refreshPromise = null;
  }

  async addRequest(method: string, url: string, data?: any, config?: RequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        method,
        url,
        data,
        config,
        resolve,
        reject,
      });
    });
  }

  async processQueue(executor: (request: QueuedRequest) => Promise<any>): Promise<void> {
    const requests = [...this.queue];
    this.queue = [];

    const results = await Promise.allSettled(
      requests.map(async (request) => {
        try {
          const result = await executor(request);
          request.resolve(result);
          return result;
        } catch (error) {
          request.reject(error);
          throw error;
        }
      })
    );

    // Log any rejected requests for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Queued request failed:`, {
          request: requests[index],
          error: result.reason,
        });
      }
    });
  }

  async executeWithRefresh<T>(
    refreshFunction: () => Promise<void>,
    requestFunction: () => Promise<T>
  ): Promise<T> {
    // If already refreshing, wait for the current refresh to complete
    if (this.isRefreshing && this.refreshPromise) {
      await this.refreshPromise;
      return requestFunction();
    }

    // If not refreshing, start the refresh process
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshPromise = this.performRefresh(refreshFunction);
    }

    // Wait for refresh to complete, then execute the request
    await this.refreshPromise;
    return requestFunction();
  }

  private async performRefresh(refreshFunction: () => Promise<void>): Promise<void> {
    try {
      await refreshFunction();
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  isProcessing(): boolean {
    return this.isRefreshing;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    // Reject all pending requests
    this.queue.forEach((request) => {
      request.reject(new Error('Request queue cleared'));
    });

    this.queue = [];
  }

  // Helper method to wait for any ongoing refresh to complete
  async waitForRefresh(): Promise<void> {
    if (this.refreshPromise) {
      await this.refreshPromise;
    }
  }
}

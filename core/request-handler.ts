import type { RequestConfig, Response, AuthError } from '../types';

/**
 * HTTP request handling with authentication and retry logic
 * Manages request queuing during token refresh
 */
export class RequestHandler {
  private baseURL: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;
  private pendingRequests: Array<() => Promise<any>> = [];
  private isRefreshing = false;

  constructor(
    baseURL: string,
    options: {
      timeout?: number;
      retry?: { attempts?: number; delay?: number };
    } = {}
  ) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = options.timeout || 10000;
    this.retryAttempts = options.retry?.attempts || 3;
    this.retryDelay = options.retry?.delay || 1000;
  }

  /**
   * Make HTTP request with automatic retry
   */
  async request<T = any>(
    method: string,
    url: string,
    data?: any,
    config: RequestConfig = {}
  ): Promise<Response<T>> {
    const fullUrl = this.buildUrl(url);
    const requestConfig = this.buildRequestConfig(method, fullUrl, data, config);

    return this.executeWithRetry(() => this.executeRequest<T>(requestConfig));
  }

  /**
   * Queue request during token refresh
   */
  async queueRequest<T = any>(
    method: string,
    url: string,
    data?: any,
    config: RequestConfig = {}
  ): Promise<Response<T>> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push(async () => {
        try {
          const result = await this.request<T>(method, url, data, config);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Process all queued requests after token refresh
   */
  async processQueue(): Promise<void> {
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];

    await Promise.allSettled(requests.map((request) => request()));
  }

  /**
   * Set refreshing state and manage queue
   */
  setRefreshing(isRefreshing: boolean): void {
    this.isRefreshing = isRefreshing;

    if (!isRefreshing) {
      // Process queue when refresh completes
      this.processQueue();
    }
  }

  /**
   * Check if currently refreshing tokens
   */
  isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }

  private buildUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${this.baseURL}/${url.replace(/^\//, '')}`;
  }

  private buildRequestConfig(
    method: string,
    url: string,
    data: any,
    config: RequestConfig
  ): RequestInit & { url: string } {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    const body = data ? JSON.stringify(data) : null;

    return {
      url,
      method: method.toUpperCase(),
      headers,
      body,
      signal: AbortSignal.timeout(config.timeout || this.timeout),
    };
  }

  private async executeRequest<T>(config: RequestInit & { url: string }): Promise<Response<T>> {
    const response = await fetch(config.url, config);

    if (!response.ok) {
      throw this.createAuthError(response);
    }

    const data = await this.parseResponse<T>(response);

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: this.extractHeaders(response),
    };
  }

  private async parseResponse<T>(response: globalThis.Response): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return response.json();
    }

    return response.text() as T;
  }

  private extractHeaders(response: globalThis.Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  private createAuthError(response: globalThis.Response): AuthError {
    return {
      status: response.status,
      message: response.statusText || 'Request failed',
      code: `HTTP_${response.status}`,
    };
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry auth errors or client errors
        if (this.isAuthError(error) || this.isClientError(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.retryAttempts) {
          throw error;
        }

        // Wait before retry with exponential backoff
        await this.sleep(this.retryDelay * Math.pow(2, attempt - 1));
      }
    }

    throw lastError;
  }

  private isAuthError(error: any): boolean {
    return error.status === 401 || error.status === 403;
  }

  private isClientError(error: any): boolean {
    return error.status >= 400 && error.status < 500;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

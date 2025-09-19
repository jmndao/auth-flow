import { HttpResponse, RequestConfig, AuthError, NormalizedConfig } from './types';

/**
 * HTTP client for making requests
 */
export class HttpClient {
  private readonly config: NormalizedConfig;
  private requestQueue: Array<() => Promise<unknown>> = [];
  private isRefreshing = false;

  constructor(config: NormalizedConfig) {
    this.config = config;
  }

  /**
   * Make HTTP request
   */
  async request<T = unknown>(
    method: string,
    url: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<HttpResponse<T>> {
    const fullUrl = this.buildUrl(url);
    const requestConfig = this.buildRequestConfig(method, data, config);

    try {
      const response = await fetch(fullUrl, requestConfig);

      if (!response.ok) {
        throw this.createError(response);
      }

      const responseData = await this.parseResponse<T>(response);

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: this.extractHeaders(response),
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError(null, 'Request timeout', 408);
      }
      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>('GET', url, undefined, config);
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<HttpResponse<T>> {
    return this.request<T>('POST', url, data, config);
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', url, data, config);
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PATCH', url, data, config);
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', url, undefined, config);
  }

  /**
   * Queue request during token refresh
   */
  queueRequest<T>(
    method: string,
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<HttpResponse<T>> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
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
   * Set refreshing state
   */
  setRefreshing(refreshing: boolean): void {
    this.isRefreshing = refreshing;

    if (!refreshing && this.requestQueue.length > 0) {
      // Process queued requests
      const queue = [...this.requestQueue];
      this.requestQueue = [];

      queue.forEach((request) => {
        request().catch(() => {
          // Handle errors silently for queued requests
        });
      });
    }
  }

  /**
   * Check if currently refreshing
   */
  isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }

  private buildUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    const baseURL = this.config.baseURL.replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;

    return `${baseURL}${path}`;
  }

  private buildRequestConfig(
    method: string,
    data?: unknown,
    config: RequestConfig = {}
  ): RequestInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    const requestConfig: RequestInit = {
      method: method.toUpperCase(),
      headers,
      signal: AbortSignal.timeout(config.timeout || this.config.timeout),
    };

    if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      requestConfig.body = JSON.stringify(data);
    }

    return requestConfig;
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    return response.text() as unknown as T;
  }

  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  private createError(response: Response | null, message?: string, status?: number): AuthError {
    return {
      status: status || response?.status || 500,
      message: message || response?.statusText || 'Request failed',
      code: `HTTP_${status || response?.status || 500}`,
    };
  }
}

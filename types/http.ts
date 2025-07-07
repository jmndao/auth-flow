/**
 * HTTP request and response type definitions
 */

export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  [key: string]: any;
}

export interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

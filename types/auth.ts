export interface LoginCredentials {
  [key: string]: any;
}

export interface LoginResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface HttpMethod {
  get<T = any>(url: string, config?: RequestConfig): Promise<LoginResponse<T>>;
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<LoginResponse<T>>;
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<LoginResponse<T>>;
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<LoginResponse<T>>;
  delete<T = any>(url: string, config?: RequestConfig): Promise<LoginResponse<T>>;
  head<T = any>(url: string, config?: RequestConfig): Promise<LoginResponse<T>>;
  options<T = any>(url: string, config?: RequestConfig): Promise<LoginResponse<T>>;
}

export interface AuthMethods {
  login<TUser = any, TCredentials = LoginCredentials>(credentials: TCredentials): Promise<TUser>;
  logout(): Promise<void>;
  isAuthenticated(): boolean;
  getTokens(): Promise<TokenPair | null>;
  setTokens(tokens: TokenPair): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface QueuedRequest {
  method: string;
  url: string;
  data?: any;
  config?: RequestConfig;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

// Import needed types
import type { TokenPair, RequestConfig } from './config';

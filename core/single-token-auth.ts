import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type { LoginCredentials, LoginResponse, RequestConfig, AuthError } from '../types';

interface SingleTokenConfig {
  baseURL: string;
  token: { access: string };
  endpoints: {
    login: string;
    logout?: string;
  };
  sessionManagement?: {
    checkInterval?: number;
    renewBeforeExpiry?: number;
    persistCredentials?: boolean;
    onSessionExpired?: () => void;
  };
  timeout?: number;
  onTokenRefresh?: (token: string) => void;
  onAuthError?: (error: AuthError) => void;
  onLogout?: () => void;
}

export class SingleTokenAuthClient {
  private readonly config: SingleTokenConfig;
  private readonly axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private storedCredentials: any = null;
  private sessionCheckInterval?: NodeJS.Timeout;
  private isRenewing = false;

  constructor(config: SingleTokenConfig) {
    this.config = {
      timeout: 10000,
      sessionManagement: {
        checkInterval: 60000, // 1 minute
        renewBeforeExpiry: 300, // 5 minutes
        persistCredentials: false,
        ...config.sessionManagement,
      },
      ...config,
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
    });

    this.setupInterceptors();
    this.startSessionMonitoring();
  }

  private setupInterceptors(): void {
    // Add token to requests
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        if (this.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Handle token expiration
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;

          if (await this.renewToken()) {
            return this.axiosInstance.request(error.config);
          } else {
            this.handleSessionExpired();
          }
        }

        throw this.normalizeError(error);
      }
    );
  }

  async login<TUser = any, TCredentials = LoginCredentials>(
    credentials: TCredentials
  ): Promise<TUser> {
    try {
      const response = await axios.post(
        `${this.config.baseURL}/${this.config.endpoints.login}`,
        credentials,
        { timeout: this.config.timeout }
      );

      const token = response.data[this.config.token.access];
      if (!token) {
        throw new Error(`Token not found in response. Expected field: ${this.config.token.access}`);
      }

      this.accessToken = token;

      if (this.config.sessionManagement?.persistCredentials) {
        this.storedCredentials = credentials;
      }

      if (this.config.onTokenRefresh) {
        this.config.onTokenRefresh(token);
      }

      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.config.endpoints.logout) {
        try {
          await this.axiosInstance.post(this.config.endpoints.logout);
        } catch (error) {
          console.warn('Logout endpoint failed:', error);
        }
      }

      this.clearSession();

      if (this.config.onLogout) {
        this.config.onLogout();
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !this.isTokenExpired(this.accessToken);
  }

  getToken(): string | null {
    return this.accessToken;
  }

  setToken(token: string): void {
    this.accessToken = token;
  }

  clearToken(): void {
    this.clearSession();
  }

  // HTTP methods
  async get<T = any>(url: string, config?: RequestConfig): Promise<LoginResponse<T>> {
    return this.request<T>('get', url, undefined, config);
  }

  async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<LoginResponse<T>> {
    return this.request<T>('post', url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<LoginResponse<T>> {
    return this.request<T>('put', url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<LoginResponse<T>> {
    return this.request<T>('patch', url, data, config);
  }

  async delete<T = any>(url: string, config?: RequestConfig): Promise<LoginResponse<T>> {
    return this.request<T>('delete', url, undefined, config);
  }

  private async request<T = any>(
    method: string,
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<LoginResponse<T>> {
    const response: AxiosResponse<T> = await this.axiosInstance.request({
      method,
      url,
      data,
      ...config,
    });

    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
    };
  }

  private startSessionMonitoring(): void {
    if (!this.config.sessionManagement?.checkInterval) return;

    this.sessionCheckInterval = setInterval(() => {
      this.checkTokenExpiry();
    }, this.config.sessionManagement.checkInterval);
  }

  private async checkTokenExpiry(): Promise<void> {
    if (!this.accessToken || this.isRenewing) return;

    const timeUntilExpiry = this.getTimeUntilExpiry(this.accessToken);
    const renewBefore = (this.config.sessionManagement?.renewBeforeExpiry || 300) * 1000;

    if (timeUntilExpiry <= renewBefore) {
      await this.renewToken();
    }
  }

  private async renewToken(): Promise<boolean> {
    if (this.isRenewing || !this.storedCredentials) return false;

    this.isRenewing = true;

    try {
      await this.login(this.storedCredentials);
      return true;
    } catch (error) {
      console.error('Token renewal failed:', error);
      return false;
    } finally {
      this.isRenewing = false;
    }
  }

  private handleSessionExpired(): void {
    this.clearSession();

    if (this.config.sessionManagement?.onSessionExpired) {
      this.config.sessionManagement.onSessionExpired();
    }
  }

  private clearSession(): void {
    this.accessToken = null;
    this.storedCredentials = null;

    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = undefined;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;

      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false;

      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch {
      return true;
    }
  }

  private getTimeUntilExpiry(token: string): number {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return 0;

      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return Infinity;

      const now = Math.floor(Date.now() / 1000);
      return (payload.exp - now) * 1000;
    } catch {
      return 0;
    }
  }

  private normalizeError(error: any): AuthError {
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.message || error.response.statusText || 'Request failed',
        code: error.response.data?.code || error.code,
        originalError: error,
      };
    }

    if (error.request) {
      return {
        status: 0,
        message: 'Network error - unable to reach server',
        code: 'NETWORK_ERROR',
        originalError: error,
      };
    }

    return {
      status: error.status || 500,
      message: error.message || 'Unknown error occurred',
      code: error.code || 'UNKNOWN_ERROR',
      originalError: error,
    };
  }

  // Cleanup on destruction
  destroy(): void {
    this.clearSession();
  }
}

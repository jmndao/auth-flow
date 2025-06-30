import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type {
  AuthFlowConfig,
  TokenPair,
  LoginCredentials,
  LoginResponse,
  RefreshTokenResponse,
  AuthContext,
  HttpMethod,
  AuthMethods,
  RequestConfig,
} from '../types';
import { TokenManager } from './token-manager';
import { RequestQueue } from './request-queue';
import { ErrorHandler } from './error-handler';
import { validateConfig, validateLoginCredentials } from '../utils';

export class AuthClient implements HttpMethod, AuthMethods {
  private readonly config: AuthFlowConfig;
  private readonly tokenManager: TokenManager;
  private readonly requestQueue: RequestQueue;
  private readonly errorHandler: ErrorHandler;
  private readonly axiosInstance: AxiosInstance;
  private readonly context: AuthContext;

  constructor(config: AuthFlowConfig, context: AuthContext = {}) {
    validateConfig(config);

    this.config = {
      environment: 'auto',
      tokenSource: 'body',
      storage: 'auto',
      timeout: 10000,
      retry: { attempts: 3, delay: 1000 },
      ...config,
    };

    this.context = context;

    // Initialize core components
    this.tokenManager = new TokenManager(
      this.config.tokens,
      this.config.storage,
      this.context,
      this.config.environment
    );

    this.requestQueue = new RequestQueue();

    this.errorHandler = new ErrorHandler(
      this.config.onAuthError,
      this.config.retry?.attempts,
      this.config.retry?.delay
    );

    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth headers
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const accessToken = await this.tokenManager.getAccessToken();
        if (accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const authError = this.errorHandler.handleError(error);

        // Check if it's a token expiration error and we haven't already tried to refresh
        if (
          this.errorHandler.isTokenExpiredError(authError) &&
          !error.config._retry &&
          (await this.tokenManager.hasTokens())
        ) {
          error.config._retry = true;

          try {
            await this.requestQueue.executeWithRefresh(
              () => this.refreshTokens(),
              () => this.axiosInstance.request(error.config)
            );

            return this.axiosInstance.request(error.config);
          } catch (refreshError) {
            // If refresh fails, clear tokens and propagate error
            await this.clearTokens();
            throw this.errorHandler.handleError(refreshError);
          }
        }

        throw authError;
      }
    );
  }

  // Authentication Methods
  async login<TUser = any, TCredentials = LoginCredentials>(
    credentials: TCredentials
  ): Promise<TUser> {
    validateLoginCredentials(credentials);

    try {
      const response = await axios.post(this.getFullUrl(this.config.endpoints.login), credentials, {
        timeout: this.config.timeout,
        baseURL: this.config.baseURL,
      });

      const tokens = await this.extractTokens(response);
      await this.tokenManager.setTokens(tokens);

      // Call token refresh callback if provided
      if (this.config.onTokenRefresh) {
        this.config.onTokenRefresh(tokens);
      }

      // Return the user data from response
      return response.data;
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      // Call logout endpoint if configured
      if (this.config.endpoints.logout) {
        try {
          await this.axiosInstance.post(this.config.endpoints.logout);
        } catch (error) {
          // Log but don't throw - we still want to clear local tokens
          console.warn('Logout endpoint failed:', error);
        }
      }

      // Clear tokens
      await this.clearTokens();

      // Call logout callback if provided
      if (this.config.onLogout) {
        this.config.onLogout();
      }
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  // isAuthenticated(): boolean {
  //   // This is a synchronous check - for async check use hasValidTokens()
  //   return this.tokenManager.hasTokens() as any; // Note: hasTokens returns Promise, but we need sync here
  // }
  isAuthenticated(): boolean {
    // This is a synchronous check - for async check use hasValidTokens()
    // We'll do a basic synchronous check by trying to get tokens synchronously
    try {
      const storageAdapter = (this.tokenManager as any).storageAdapter;
      const accessToken = storageAdapter.get(this.config.tokens.access);
      const refreshToken = storageAdapter.get(this.config.tokens.refresh);

      // If storage is async, we can't determine synchronously, return false
      if (accessToken instanceof Promise || refreshToken instanceof Promise) {
        return false;
      }

      return Boolean(accessToken && refreshToken);
    } catch {
      return false;
    }
  }

  async hasValidTokens(): Promise<boolean> {
    return this.tokenManager.hasValidTokens();
  }

  async getTokens(): Promise<TokenPair | null> {
    return this.tokenManager.getTokens();
  }

  async setTokens(tokens: TokenPair): Promise<void> {
    await this.tokenManager.setTokens(tokens);
  }

  async clearTokens(): Promise<void> {
    await this.tokenManager.clearTokens();
    this.requestQueue.clearQueue();
  }

  // HTTP Methods
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

  async head<T = any>(url: string, config?: RequestConfig): Promise<LoginResponse<T>> {
    return this.request<T>('head', url, undefined, config);
  }

  async options<T = any>(url: string, config?: RequestConfig): Promise<LoginResponse<T>> {
    return this.request<T>('options', url, undefined, config);
  }

  private async request<T = any>(
    method: string,
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<LoginResponse<T>> {
    return this.errorHandler.executeWithRetry(async () => {
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
    });
  }

  private async refreshTokens(): Promise<void> {
    const refreshToken = await this.tokenManager.getRefreshToken();

    if (!refreshToken) {
      throw this.errorHandler.handleError(ErrorHandler.createRefreshTokenExpiredError());
    }

    try {
      const response = await axios.post(
        this.getFullUrl(this.config.endpoints.refresh),
        { refreshToken },
        {
          timeout: this.config.timeout,
          baseURL: this.config.baseURL,
        }
      );

      const refreshData: RefreshTokenResponse = response.data;

      const newTokens: TokenPair = {
        accessToken: refreshData.accessToken,
        refreshToken: refreshData.refreshToken || refreshToken, // Use new refresh token if provided
      };

      await this.tokenManager.setTokens(newTokens);

      // Call token refresh callback if provided
      if (this.config.onTokenRefresh) {
        this.config.onTokenRefresh(newTokens);
      }
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  private async extractTokens(response: AxiosResponse): Promise<TokenPair> {
    if (this.config.tokenSource === 'cookies') {
      return this.extractTokensFromCookies(response);
    } else {
      return this.extractTokensFromBody(response);
    }
  }

  private async extractTokensFromBody(response: AxiosResponse): Promise<TokenPair> {
    const data = response.data;
    const accessToken = data[this.config.tokens.access];
    const refreshToken = data[this.config.tokens.refresh];

    if (!accessToken || !refreshToken) {
      throw new Error(
        `Tokens not found in response body. Expected keys: ${this.config.tokens.access}, ${this.config.tokens.refresh}`
      );
    }

    return { accessToken, refreshToken };
  }

  private async extractTokensFromCookies(_response: AxiosResponse): Promise<TokenPair> {
    // For cookie extraction, tokens should be automatically stored by the cookie adapter
    // We need to read them from storage after the response
    await new Promise((resolve) => setTimeout(resolve, 0)); // Allow cookies to be set

    const tokens = await this.tokenManager.getTokens();
    if (!tokens) {
      throw new Error(
        `Tokens not found in cookies after login. Expected cookies: ${this.config.tokens.access}, ${this.config.tokens.refresh}`
      );
    }

    return tokens;
  }

  private getFullUrl(endpoint: string): string {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }

    if (this.config.baseURL) {
      return `${this.config.baseURL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    }

    return endpoint;
  }
}

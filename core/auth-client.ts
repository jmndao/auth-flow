import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type {
  AuthFlowConfig,
  ValidatedAuthFlowConfig,
  TokenPair,
  LoginCredentials,
  LoginResponse,
  AuthContext,
  HttpMethod,
  AuthMethods,
  RequestConfig,
} from '../types';
import { TokenManager } from './token-manager';
import { RequestQueue } from './request-queue';
import { ErrorHandler } from './error-handler';
import { CookieManager } from './cookie-manager';
import { validateConfig, validateLoginCredentials } from '../utils';

/**
 * Core authentication client that handles token management, automatic token refresh,
 * and provides HTTP methods with authentication headers
 */
export class AuthClient implements HttpMethod, AuthMethods {
  private readonly config: ValidatedAuthFlowConfig;
  private readonly tokenManager: TokenManager;
  private readonly requestQueue: RequestQueue;
  private readonly errorHandler: ErrorHandler;
  private readonly axiosInstance: AxiosInstance;
  private readonly context: AuthContext;
  private readonly cookieManager?: CookieManager;
  private refreshPromise: Promise<void> | null = null;
  private isRefreshing = false;

  constructor(config: AuthFlowConfig, context: AuthContext = {}) {
    validateConfig(config);

    // Validate required fields
    if (!config.endpoints?.login) {
      throw new Error('Login endpoint is required');
    }
    if (!config.tokens?.access || !config.tokens?.refresh) {
      throw new Error('Both access and refresh token field names are required');
    }

    this.config = {
      environment: 'auto',
      tokenSource: 'body',
      storage: 'auto',
      timeout: 10000,
      retry: { attempts: 3, delay: 1000 },
      ...config,
      endpoints: config.endpoints,
      tokens: config.tokens,
    } as ValidatedAuthFlowConfig;

    this.context = context;

    // Initialize cookie manager if using cookie-based token storage
    if (this.config.tokenSource === 'cookies') {
      this.cookieManager = new CookieManager(this.context, {
        ...(typeof this.config.storage === 'object' ? this.config.storage.options : {}),
      });
    }

    this.tokenManager = new TokenManager(
      this.config.tokens,
      this.config.storage,
      this.context,
      this.config.environment,
      this.cookieManager
    );

    this.requestQueue = new RequestQueue();
    this.errorHandler = new ErrorHandler(
      this.config.onAuthError,
      this.config.retry?.attempts,
      this.config.retry?.delay
    );

    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
    });

    this.setupInterceptors();
  }

  /**
   * Sets up request and response interceptors for automatic token handling
   */
  private setupInterceptors(): void {
    // Request interceptor: Add authorization header
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

    // Response interceptor: Handle 401 errors and refresh tokens
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry && !this.isRefreshing) {
          originalRequest._retry = true;

          try {
            const refreshToken = await this.tokenManager.getRefreshToken();

            if (!refreshToken || this.tokenManager.isTokenExpired(refreshToken)) {
              await this.clearTokens();
              throw error;
            }

            this.isRefreshing = true;

            this.refreshPromise ??= this.performTokenRefresh().finally(() => {
              this.refreshPromise = null;
              this.isRefreshing = false;
            });

            await this.refreshPromise;

            const newAccessToken = await this.tokenManager.getAccessToken();
            if (newAccessToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            }

            return this.axiosInstance.request(originalRequest);
          } catch {
            this.isRefreshing = false;
            await this.clearTokens();
            throw error;
          }
        }

        throw error;
      }
    );
  }

  /**
   * Performs token refresh using the refresh token
   */
  async performTokenRefresh(): Promise<void> {
    const currentRefreshToken = await this.tokenManager.getRefreshToken();

    if (!currentRefreshToken) {
      const error = new Error('No refresh token available');
      // Add Next.js middleware guidance for server environments
      if (typeof window === 'undefined') {
        error.message +=
          '. For Next.js server environments, consider using our middleware for proper token refresh. See: https://github.com/jmndao/auth-flow/blob/main/docs/middleware-setup.md';
      }
      throw error;
    }

    if (this.tokenManager.isTokenExpired(currentRefreshToken)) {
      const error = new Error('Refresh token is expired');
      // Add Next.js middleware guidance for server environments
      if (typeof window === 'undefined') {
        error.message +=
          '. For Next.js server environments, consider using our middleware for proper token refresh. See: https://github.com/jmndao/auth-flow/blob/main/docs/middleware-setup.md';
      }
      throw error;
    }

    try {
      const response = await axios.post(
        this.getFullUrl(this.config.endpoints.refresh),
        { refreshToken: currentRefreshToken },
        {
          timeout: this.config.timeout,
          baseURL: this.config.baseURL,
          withCredentials: true,
          headers: {
            Cookie: `${this.config.tokens.refresh}=${currentRefreshToken}`,
          },
        }
      );

      const { accessToken, refreshToken } = this.extractTokensFromRefreshResponse(
        response,
        currentRefreshToken
      );

      const newTokens: TokenPair = {
        accessToken,
        refreshToken,
      };

      await this.tokenManager.setTokens(newTokens);

      if (this.config.onTokenRefresh) {
        this.config.onTokenRefresh(newTokens);
      }
    } catch (error) {
      // Add Next.js middleware guidance when refresh fails in server environment
      if (typeof window === 'undefined') {
        const enhancedError = new Error(
          `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}. For Next.js server environments, consider using our middleware for proper token refresh. See: https://github.com/jmndao/auth-flow/blob/main/docs/middleware-setup.md`
        );
        throw enhancedError;
      }
      throw error;
    }
  }

  /**
   * Extracts tokens from refresh response, with fallback to current refresh token
   */
  private extractTokensFromRefreshResponse(
    response: AxiosResponse,
    currentRefreshToken: string
  ): TokenPair {
    const data = response.data;

    const accessToken =
      data[this.config.tokens.access] || data.accessToken || data.access_token || data.token;

    if (!accessToken) {
      throw new Error(
        `Access token not found in refresh response. Expected field: ${this.config.tokens.access}`
      );
    }

    const refreshToken =
      data[this.config.tokens.refresh] ||
      data.refreshToken ||
      data.refresh_token ||
      currentRefreshToken;

    return { accessToken, refreshToken };
  }

  /**
   * Authenticates user with provided credentials
   */
  async login<TUser = any, TCredentials = LoginCredentials>(
    credentials: TCredentials
  ): Promise<TUser> {
    validateLoginCredentials(credentials);

    const response = await axios.post(this.getFullUrl(this.config.endpoints.login), credentials, {
      timeout: this.config.timeout,
      baseURL: this.config.baseURL,
    });

    const tokens = await this.extractTokens(response);
    await this.tokenManager.setTokens(tokens);

    if (this.config.onTokenRefresh) {
      this.config.onTokenRefresh(tokens);
    }

    return response.data;
  }

  /**
   * Logs out user and clears stored tokens
   */
  async logout(): Promise<void> {
    if (this.config.endpoints.logout) {
      try {
        await this.axiosInstance.post(this.config.endpoints.logout);
      } catch {
        // Continue with token cleanup even if logout endpoint fails
      }
    }

    await this.clearTokens();

    if (this.config.onLogout) {
      this.config.onLogout();
    }
  }

  /**
   * Checks if user is authenticated (has tokens stored)
   */
  isAuthenticated(): boolean {
    return this.tokenManager.hasTokensSync();
  }

  /**
   * Checks if stored tokens are valid and not expired
   */
  async hasValidTokens(): Promise<boolean> {
    const accessToken = await this.tokenManager.getAccessToken();
    const refreshToken = await this.tokenManager.getRefreshToken();

    if (!refreshToken) {
      return false;
    }

    if (this.tokenManager.isTokenExpired(refreshToken)) {
      await this.clearTokens();
      return false;
    }

    if (!accessToken) {
      if (typeof window === 'undefined') {
        return false;
      }

      try {
        await this.performTokenRefresh();
        return true;
      } catch (error) {
        console.error('Error during token validation:', error);
        await this.clearTokens();
        return false;
      }
    }

    if (accessToken.includes('.') && this.tokenManager.isTokenExpired(accessToken)) {
      if (typeof window === 'undefined') {
        return false;
      }

      try {
        await this.performTokenRefresh();
        return true;
      } catch {
        console.error('Error during token validation');
        await this.clearTokens();
        return false;
      }
    }

    return true;
  }

  async getTokens(): Promise<TokenPair | null> {
    return this.tokenManager.getTokens();
  }

  async getAccessToken(): Promise<string | null> {
    return this.tokenManager.getAccessToken();
  }

  async getRefreshToken(): Promise<string | null> {
    return this.tokenManager.getRefreshToken();
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

  /**
   * Makes HTTP request with error handling and retry logic
   */
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

  /**
   * Extracts tokens from login response based on configured token source
   */
  private async extractTokens(response: AxiosResponse): Promise<TokenPair> {
    if (this.config.tokenSource === 'cookies') {
      return this.extractTokensFromCookies(response);
    } else {
      return this.extractTokensFromBody(response);
    }
  }

  /**
   * Extracts tokens from response body
   */
  private async extractTokensFromBody(response: AxiosResponse): Promise<TokenPair> {
    const data = response.data;
    const accessToken = data[this.config.tokens.access];
    const refreshToken = data[this.config.tokens.refresh];

    if (!accessToken || !refreshToken) {
      throw new Error(
        `Tokens not found in response. Expected: ${this.config.tokens.access}, ${this.config.tokens.refresh}`
      );
    }

    return { accessToken, refreshToken };
  }

  /**
   * Extracts tokens from cookies, with fallback to body
   */
  private async extractTokensFromCookies(response: AxiosResponse): Promise<TokenPair> {
    const bodyTokens = this.tryExtractFromBody(response);
    if (bodyTokens) {
      return bodyTokens;
    }

    // Wait for cookies to be set
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Retry getting tokens from cookies
    for (let attempt = 0; attempt < 3; attempt++) {
      const tokens = await this.tokenManager.getTokens();
      if (tokens?.accessToken && tokens?.refreshToken) {
        return tokens;
      }

      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    throw new Error(
      `Tokens not found in cookies after login. Expected: ${this.config.tokens.access}, ${this.config.tokens.refresh}`
    );
  }

  /**
   * Attempts to extract tokens from response body (fallback for cookie mode)
   */
  private tryExtractFromBody(response: AxiosResponse): TokenPair | null {
    try {
      const data = response.data;

      const accessToken =
        data[this.config.tokens.access] ||
        data.data?.[this.config.tokens.access] ||
        data.token ||
        data.accessToken;

      const refreshToken =
        data[this.config.tokens.refresh] ||
        data.data?.[this.config.tokens.refresh] ||
        data.refreshToken;

      if (accessToken && refreshToken) {
        return { accessToken, refreshToken };
      }
    } catch {
      // Ignore extraction errors from body
    }

    return null;
  }

  /**
   * Constructs full URL from endpoint
   */
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

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type {
  AuthFlowConfig,
  ValidatedAuthFlowConfig,
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
import { CookieManager } from './cookie-manager';
import { validateConfig, validateLoginCredentials } from '../utils';

export class AuthClient implements HttpMethod, AuthMethods {
  private readonly config: ValidatedAuthFlowConfig;
  private readonly tokenManager: TokenManager;
  private readonly requestQueue: RequestQueue;
  private readonly errorHandler: ErrorHandler;
  private readonly axiosInstance: AxiosInstance;
  private readonly context: AuthContext;
  private readonly cookieManager?: CookieManager;

  constructor(config: AuthFlowConfig, context: AuthContext = {}) {
    validateConfig(config);

    if (!config.endpoints) {
      throw new Error('Endpoints configuration is required');
    }
    if (!config.tokens) {
      throw new Error('Tokens configuration is required');
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

    // Use cookie manager for cookie tokenSource
    if (this.config.tokenSource === 'cookies') {
      this.cookieManager = new CookieManager(this.context, {
        ...(typeof this.config.storage === 'object' ? this.config.storage.options : {}),
        waitForCookies: 500,
        fallbackToBody: true,
        retryCount: 3,
        debugMode: false,
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

  private setupInterceptors(): void {
    // Add token to requests
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

    // Handle token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const authError = this.errorHandler.handleError(error);

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
            await this.clearTokens();
            throw this.errorHandler.handleError(refreshError);
          }
        }

        throw authError;
      }
    );
  }

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

      // Store tokens in cookie manager for fallback
      if (this.cookieManager) {
        this.cookieManager.setFallbackTokens(tokens);
      }

      if (this.config.onTokenRefresh) {
        this.config.onTokenRefresh(tokens);
      }

      return response.data;
    } catch (error) {
      throw this.errorHandler.handleError(error);
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

      await this.clearTokens();

      if (this.config.onLogout) {
        this.config.onLogout();
      }
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  isAuthenticated(): boolean {
    return this.tokenManager.hasTokensSync();
  }

  async hasValidTokens(): Promise<boolean> {
    return this.tokenManager.hasValidTokens();
  }

  async getTokens(): Promise<TokenPair | null> {
    return this.tokenManager.getTokens();
  }

  async setTokens(tokens: TokenPair): Promise<void> {
    await this.tokenManager.setTokens(tokens);

    // Store in cookie manager for fallback
    if (this.cookieManager) {
      this.cookieManager.setFallbackTokens(tokens);
    }
  }

  async clearTokens(): Promise<void> {
    await this.tokenManager.clearTokens();
    this.requestQueue.clearQueue();
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
        refreshToken: refreshData.refreshToken || refreshToken,
      };

      await this.tokenManager.setTokens(newTokens);

      // Update fallback tokens
      if (this.cookieManager) {
        this.cookieManager.setFallbackTokens(newTokens);
      }

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
        `Tokens not found in response. Expected: ${this.config.tokens.access}, ${this.config.tokens.refresh}`
      );
    }

    return { accessToken, refreshToken };
  }

  private async extractTokensFromCookies(response: AxiosResponse): Promise<TokenPair> {
    // First try to extract from response body as fallback
    const bodyTokens = this.tryExtractFromBody(response);
    if (bodyTokens) {
      // Set fallback tokens in cookie manager
      if (this.cookieManager) {
        this.cookieManager.setFallbackTokens(bodyTokens);
      }
      return bodyTokens;
    }

    // Get options safely
    const cookieOptions = this.cookieManager?.getOptions();
    const waitTime = cookieOptions?.waitForCookies || 100;
    const maxRetries = cookieOptions?.retryCount || 3;

    // Allow time for cookies to be set by browser
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const tokens = await this.tokenManager.getTokens();
        if (tokens && tokens.accessToken && tokens.refreshToken) {
          return tokens;
        }
      } catch (error) {
        lastError = error as Error;
      }

      // Wait longer on each retry
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, waitTime * (attempt + 1)));
      }
    }

    // Final attempt: check if cookie manager has fallback tokens
    if (this.cookieManager) {
      const fallbackTokens = this.cookieManager.getFallbackTokens();
      if (fallbackTokens) {
        return fallbackTokens;
      }
    }

    throw new Error(
      `Tokens not found in cookies after ${maxRetries} attempts. Expected: ${this.config.tokens.access}, ${this.config.tokens.refresh}. Last error: ${lastError?.message || 'Unknown'}`
    );
  }

  private tryExtractFromBody(response: AxiosResponse): TokenPair | null {
    try {
      const data = response.data;

      // Try different response structures
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

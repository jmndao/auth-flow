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
import { ErrorHandler } from './error-handler';
import { validateConfig, validateLoginCredentials } from '../utils';

export class AuthClient implements HttpMethod, AuthMethods {
  private readonly config: ValidatedAuthFlowConfig;
  private readonly tokenManager: TokenManager;
  private readonly errorHandler: ErrorHandler;
  private readonly axiosInstance: AxiosInstance;
  private readonly context: AuthContext;

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
    this.tokenManager = new TokenManager(
      this.config.tokens,
      this.config.storage,
      this.context,
      this.config.environment
    );

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
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        if (this.isAuthEndpoint(config.url)) {
          return config;
        }

        if (config.headers?.Authorization) {
          return config;
        }

        if (this.tokenManager.hasTokensSync()) {
          try {
            const accessToken = await this.tokenManager.getAccessToken();
            if (accessToken && config.headers) {
              config.headers.Authorization = `Bearer ${accessToken}`;
            }
          } catch {
            // Continue without auth header if token retrieval fails
          }
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const authError = this.errorHandler.handleError(error);

        if (
          this.errorHandler.isTokenExpiredError(authError) &&
          !error.config._retry &&
          !this.isAuthEndpoint(error.config?.url) &&
          (await this.tokenManager.hasTokens())
        ) {
          error.config._retry = true;

          try {
            await this.refreshTokens();
            return this.axiosInstance.request(error.config);
          } catch {
            await this.clearTokens();
            throw authError;
          }
        }

        throw authError;
      }
    );
  }

  /**
   * Check if URL is an authentication endpoint
   */
  private isAuthEndpoint(url?: string): boolean {
    if (!url) return false;

    const authEndpoints = [
      this.config.endpoints.login,
      this.config.endpoints.refresh,
      this.config.endpoints.logout,
    ];

    const cleanUrl = url.replace(this.config.baseURL || '', '');

    return authEndpoints.some((endpoint) => {
      if (!endpoint) return false;

      const normalizedEndpoint = endpoint.replace(/^\/+|\/+$/g, '');
      const normalizedUrl = cleanUrl.replace(/^\/+|\/+$/g, '');

      return normalizedUrl === normalizedEndpoint;
    });
  }

  /**
   * Authenticate user with credentials
   */
  async login<TUser = any, TCredentials = LoginCredentials>(
    credentials: TCredentials
  ): Promise<TUser> {
    validateLoginCredentials(credentials);

    try {
      await this.clearTokens();

      const response = await axios.post(this.getFullUrl(this.config.endpoints.login), credentials, {
        timeout: this.config.timeout,
        baseURL: this.config.baseURL,
        withCredentials: this.config.tokenSource === 'cookies',
      });

      await this.handleSetCookieHeaders(response);
      const tokens = await this.extractTokens(response);
      await this.tokenManager.setTokens(tokens);

      if (this.config.onTokenRefresh) {
        this.config.onTokenRefresh(tokens);
      }

      const verifyTokens = await this.tokenManager.getTokens();
      if (!verifyTokens) {
        throw new Error('Login succeeded but tokens are not accessible');
      }

      return response.data;
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  /**
   * Log out user and clear tokens
   */
  async logout(): Promise<void> {
    try {
      if (this.config.endpoints.logout) {
        try {
          await this.axiosInstance.post(this.config.endpoints.logout);
        } catch {
          // Continue with logout even if endpoint call fails
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
  }

  async clearTokens(): Promise<void> {
    await this.tokenManager.clearTokens();
  }

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
    try {
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
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshTokens(): Promise<void> {
    const refreshToken = await this.tokenManager.getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(
        this.getFullUrl(this.config.endpoints.refresh),
        { refreshToken },
        {
          timeout: this.config.timeout,
          baseURL: this.config.baseURL,
          withCredentials: this.config.tokenSource === 'cookies',
        }
      );

      const refreshData: RefreshTokenResponse = response.data;

      const newTokens: TokenPair = {
        accessToken: refreshData.accessToken,
        refreshToken: refreshData.refreshToken || refreshToken,
      };

      await this.tokenManager.setTokens(newTokens);

      if (this.config.onTokenRefresh) {
        this.config.onTokenRefresh(newTokens);
      }
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  /**
   * Extract tokens from login/refresh response
   */
  private async extractTokens(response: AxiosResponse): Promise<TokenPair> {
    if (this.config.tokenSource === 'cookies') {
      return this.extractTokensFromCookies(response);
    } else {
      return this.extractTokensFromBody(response);
    }
  }

  /**
   * Extract tokens from response body
   */
  private extractTokensFromBody(response: AxiosResponse): TokenPair {
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
    if (typeof window === 'undefined' && this.context.cookieSetter) {
      await this.handleSetCookieHeaders(response);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const tokens = await this.tokenManager.getTokens();
      if (tokens && tokens.accessToken && tokens.refreshToken) {
        return tokens;
      }
    } catch {
      // Continue to fallback
    }

    try {
      return this.extractTokensFromBody(response);
    } catch {
      throw new Error('Failed to extract tokens from cookies or response body');
    }
  }

  private async handleSetCookieHeaders(response: AxiosResponse): Promise<void> {
    if (typeof window !== 'undefined' || !this.context.cookieSetter) return;

    const setCookieHeaders = response.headers['set-cookie'];
    if (!setCookieHeaders) return;

    try {
      await this.proxySetCookieHeaders(setCookieHeaders);
    } catch {
      // Silently continue if cookie processing fails
    }
  }

  private async proxySetCookieHeaders(setCookieHeaders: string[]): Promise<void> {
    if (!this.context.cookieSetter) return;

    for (const cookieHeader of setCookieHeaders) {
      try {
        const parsed = this.parseSetCookieHeader(cookieHeader);
        if (parsed && this.context.cookieSetter) {
          await this.context.cookieSetter(parsed.name, parsed.value, parsed.options);
        }
      } catch {
        // Continue with next cookie if parsing fails
      }
    }
  }

  private parseSetCookieHeader(cookieHeader: string): {
    name: string;
    value: string;
    options: any;
  } | null {
    try {
      const parts = cookieHeader.split(';').map((part) => part.trim());
      const [nameValue] = parts;
      const [name, value] = nameValue.split('=');

      if (!name || !value) return null;

      const options: any = {};

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part.toLowerCase() === 'secure') {
          options.secure = true;
        } else if (part.toLowerCase() === 'httponly') {
          options.httpOnly = true;
        } else if (part.toLowerCase().startsWith('samesite=')) {
          options.sameSite = part.split('=')[1];
        } else if (part.toLowerCase().startsWith('max-age=')) {
          options.maxAge = parseInt(part.split('=')[1], 10);
        } else if (part.toLowerCase().startsWith('path=')) {
          options.path = part.split('=')[1];
        } else if (part.toLowerCase().startsWith('domain=')) {
          options.domain = part.split('=')[1];
        }
      }

      return {
        name: name.trim(),
        value: value.trim(),
        options,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get full URL by combining base URL with endpoint
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

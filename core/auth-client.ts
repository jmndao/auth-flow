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

    if (this.config.tokenSource === 'cookies') {
      this.cookieManager = new CookieManager(this.context, {
        ...(typeof this.config.storage === 'object' ? this.config.storage.options : {}),
        waitForCookies: 100,
        fallbackToBody: true,
        retryCount: 1,
        debugMode: this.config.debugMode || false,
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
   * Setup request and response interceptors for automatic token handling
   */
  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Don't add auth headers to authentication endpoints
        if (this.isAuthEndpoint(config.url)) {
          return config;
        }

        // Don't override existing authorization headers
        if (config.headers?.Authorization) {
          return config;
        }

        // Quick check if tokens exist before async call
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

        // Only attempt token refresh for non-auth endpoints
        if (
          this.errorHandler.isTokenExpiredError(authError) &&
          !error.config._retry &&
          !this.isAuthEndpoint(error.config?.url) &&
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

  /**
   * Check if URL is an authentication endpoint that shouldn't have auth headers
   */
  private isAuthEndpoint(url?: string): boolean {
    if (!url) return false;

    const authEndpoints = [
      this.config.endpoints.login,
      this.config.endpoints.refresh,
      this.config.endpoints.logout,
    ];

    // Remove base URL to get relative path
    const cleanUrl = url.replace(this.config.baseURL || '', '');

    return authEndpoints.some((endpoint) => {
      if (!endpoint) return false;

      // Check exact match first
      if (cleanUrl === endpoint) return true;

      // Normalize paths by removing leading/trailing slashes
      const normalizedEndpoint = endpoint.replace(/^\/+|\/+$/g, '');
      const normalizedUrl = cleanUrl.replace(/^\/+|\/+$/g, '');

      return normalizedUrl === normalizedEndpoint;
    });
  }

  async login<TUser = any, TCredentials = LoginCredentials>(
    credentials: TCredentials
  ): Promise<TUser> {
    validateLoginCredentials(credentials);

    try {
      await this.clearTokens();

      const response = await this.makeLoginRequest(credentials);

      await this.handleSetCookieHeaders(response);

      const tokens = await this.extractTokens(response);

      await this.tokenManager.setTokens(tokens);

      if (this.cookieManager) {
        this.cookieManager.setFallbackTokens(tokens);
        this.cookieManager.set(this.config.tokens.access, tokens.accessToken);
        this.cookieManager.set(this.config.tokens.refresh, tokens.refreshToken);
      }

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
   * Make the actual login request to the authentication endpoint
   */
  private async makeLoginRequest(credentials: any): Promise<AxiosResponse> {
    return await axios.post(this.getFullUrl(this.config.endpoints.login), credentials, {
      timeout: this.config.timeout,
      baseURL: this.config.baseURL,
      withCredentials: true,
    });
  }

  /**
   * Handle Set-Cookie headers from login response for server-side contexts
   */
  private async handleSetCookieHeaders(response: AxiosResponse): Promise<void> {
    if (!this.isNextJSServerContext()) return;

    const setCookieHeaders = response.headers['set-cookie'];
    if (!setCookieHeaders) return;

    try {
      await this.proxySetCookieHeaders(setCookieHeaders);
    } catch {
      // Continue silently if cookie proxying fails
    }
  }

  /**
   * Proxy Set-Cookie headers to the server response
   */
  private async proxySetCookieHeaders(setCookieHeaders: string[]): Promise<void> {
    if (!this.context.cookieSetter) return;

    for (const cookieHeader of setCookieHeaders) {
      try {
        const parsedCookie = this.parseSetCookieHeader(cookieHeader);
        if (parsedCookie) {
          this.context.cookieSetter(parsedCookie.name, parsedCookie.value, parsedCookie.options);

          if (this.cookieManager) {
            this.cookieManager.set(parsedCookie.name, parsedCookie.value);
          }
        }
      } catch {
        // Continue with next cookie if parsing fails
      }
    }
  }

  /**
   * Parse Set-Cookie header string into name, value, and options
   */
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
   * Check if running in Next.js server context
   */
  private isNextJSServerContext(): boolean {
    return typeof window === 'undefined' && !!this.context.cookies && !!this.context.cookieSetter;
  }

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

    if (this.cookieManager) {
      this.cookieManager.setFallbackTokens(tokens);
    }
  }

  async clearTokens(): Promise<void> {
    await this.tokenManager.clearTokens();

    if (this.cookieManager) {
      this.cookieManager.remove(this.config.tokens.access);
      this.cookieManager.remove(this.config.tokens.refresh);
      this.cookieManager.setFallbackTokens({ accessToken: '', refreshToken: '' });
    }

    this.requestQueue.clearQueue();
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

  /**
   * Generic request method with error handling and retries
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
   * Refresh access token using refresh token
   */
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

  /**
   * Extract tokens from login response based on token source configuration
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
   * Extract tokens from cookies with fallback to body
   */
  private async extractTokensFromCookies(response: AxiosResponse): Promise<TokenPair> {
    await this.handleResponseCookies(response);

    // Try extracting tokens from response body first (most reliable)
    const bodyTokens = this.tryExtractFromBody(response);
    if (bodyTokens && this.cookieManager) {
      // Set fallback tokens immediately for quick access
      this.cookieManager.setFallbackTokens(bodyTokens);
      this.cookieManager.set(this.config.tokens.access, bodyTokens.accessToken);
      this.cookieManager.set(this.config.tokens.refresh, bodyTokens.refreshToken);

      // Return body tokens immediately for server context
      if (this.isNextJSServerContext()) {
        return bodyTokens;
      }
    }

    const cookieOptions = this.cookieManager?.getOptions();
    const waitTime = Math.min(cookieOptions?.waitForCookies || 100, 100);
    const maxRetries = Math.min(cookieOptions?.retryCount || 1, 1);

    const allErrors: Error[] = [];

    // First attempt without waiting
    try {
      const tokens = await this.tokenManager.getTokens();
      if (tokens && tokens.accessToken && tokens.refreshToken) {
        return tokens;
      }
    } catch (error) {
      allErrors.push(error as Error);
    }

    // Wait before retries only if no body tokens available
    if (!bodyTokens) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    // Retry attempts with minimal delay
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const tokens = await this.tokenManager.getTokens();
        if (tokens && tokens.accessToken && tokens.refreshToken) {
          return tokens;
        }
      } catch (error) {
        allErrors.push(error as Error);
      }

      // Short wait before next attempt only if no body fallback available
      if (attempt < maxRetries - 1 && !bodyTokens) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    // Use body tokens as final fallback
    if (bodyTokens) {
      return bodyTokens;
    }

    // Create comprehensive error message
    const errorMessages = allErrors.map((e) => e.message).join('; ');
    const finalError = new Error(
      `Token extraction failed after ${maxRetries + 1} attempts. ` +
        `Expected: ${this.config.tokens.access}, ${this.config.tokens.refresh}. ` +
        `Errors: ${errorMessages}`
    );

    // Log only in debug mode after all attempts failed
    if (this.config.debugMode) {
      console.error('Cookie token extraction failed after all attempts:', finalError);
    }

    throw finalError;
  }

  /**
   * Handle response cookies for server-side contexts
   */
  private async handleResponseCookies(response: AxiosResponse): Promise<void> {
    if (!this.isNextJSServerContext()) return;

    const setCookieHeaders = response.headers['set-cookie'];
    if (!setCookieHeaders) return;

    for (const cookieHeader of setCookieHeaders) {
      const parsed = this.parseSetCookieHeader(cookieHeader);
      if (parsed && this.cookieManager) {
        this.cookieManager.set(parsed.name, parsed.value);

        if (this.context.cookieSetter) {
          this.context.cookieSetter(parsed.name, parsed.value, parsed.options);
        }
      }
    }
  }

  /**
   * Try to extract tokens from response body without throwing errors
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
      // Return null if extraction fails
    }

    return null;
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

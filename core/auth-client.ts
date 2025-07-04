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
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        try {
          const accessToken = await this.tokenManager.getAccessToken();
          if (accessToken && config.headers) {
            config.headers.Authorization = `Bearer ${accessToken}`;
          }
        } catch (error) {
          if (this.config.debugMode) {
            console.warn('Failed to get access token for request:', (error as Error).message);
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
      // Clear any existing tokens first
      await this.clearTokens();

      const response = await this.makeLoginRequest(credentials);

      // Handle Set-Cookie headers first (for Next.js context)
      await this.handleSetCookieHeaders(response);

      // Extract tokens from response
      const tokens = await this.extractTokens(response);

      // Set tokens in token manager
      await this.tokenManager.setTokens(tokens);

      // Store fallback tokens in cookie manager
      if (this.cookieManager) {
        this.cookieManager.setFallbackTokens(tokens);

        // Also set directly in cookie manager for immediate access
        this.cookieManager.set(this.config.tokens.access, tokens.accessToken);
        this.cookieManager.set(this.config.tokens.refresh, tokens.refreshToken);
      }

      // Call refresh callback only once
      if (this.config.onTokenRefresh) {
        this.config.onTokenRefresh(tokens);
      }

      // Verify tokens are accessible
      const verifyTokens = await this.tokenManager.getTokens();
      if (!verifyTokens) {
        throw new Error('Login succeeded but tokens are not accessible');
      }

      return response.data;
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  private async makeLoginRequest(credentials: any): Promise<AxiosResponse> {
    return await axios.post(this.getFullUrl(this.config.endpoints.login), credentials, {
      timeout: this.config.timeout,
      baseURL: this.config.baseURL,
      withCredentials: true,
    });
  }

  private async handleSetCookieHeaders(response: AxiosResponse): Promise<void> {
    if (!this.isNextJSServerContext()) return;

    const setCookieHeaders = response.headers['set-cookie'];
    if (!setCookieHeaders) return;

    try {
      await this.proxySetCookieHeaders(setCookieHeaders);

      if (this.config.debugMode) {
        console.log('Proxied Set-Cookie headers for Next.js context');
      }
    } catch (error) {
      if (this.config.debugMode) {
        console.warn('Failed to proxy Set-Cookie headers:', (error as Error).message);
      }
    }
  }

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
      } catch (error) {
        console.warn('Failed to proxy individual cookie:', (error as Error).message);
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
    } catch (error) {
      console.warn('Failed to parse Set-Cookie header:', (error as Error).message);
      return null;
    }
  }

  private isNextJSServerContext(): boolean {
    return typeof window === 'undefined' && !!this.context.cookies && !!this.context.cookieSetter;
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

    if (this.cookieManager) {
      this.cookieManager.setFallbackTokens(tokens);
    }
  }

  async clearTokens(): Promise<void> {
    await this.tokenManager.clearTokens();

    // Also clear from cookie manager
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
    // First, handle any Set-Cookie headers from the response
    await this.handleResponseCookies(response);

    // Try to extract from response body as immediate fallback
    const bodyTokens = this.tryExtractFromBody(response);
    if (bodyTokens && this.cookieManager) {
      this.cookieManager.setFallbackTokens(bodyTokens);

      // Immediately store in temporary store and cookie manager
      this.cookieManager.set(this.config.tokens.access, bodyTokens.accessToken);
      this.cookieManager.set(this.config.tokens.refresh, bodyTokens.refreshToken);

      // For Next.js server context, return the body tokens immediately
      if (this.isNextJSServerContext()) {
        return bodyTokens;
      }
    }

    const cookieOptions = this.cookieManager?.getOptions();
    const waitTime = cookieOptions?.waitForCookies || 500;
    const maxRetries = cookieOptions?.retryCount || 3;

    // Allow time for cookies to be set by browser
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    let lastError: Error | null = null;

    // Try to get tokens from cookie manager
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const tokens = await this.tokenManager.getTokens();
        if (tokens && tokens.accessToken && tokens.refreshToken) {
          return tokens;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`Cookie extraction attempt ${attempt + 1} failed:`, (error as Error).message);
      }

      // Wait longer on each retry
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, waitTime * (attempt + 1)));
      }
    }

    // Use body tokens as final fallback
    if (bodyTokens) {
      if (this.config.debugMode) {
        console.log('Using fallback tokens from response body');
      }
      return bodyTokens;
    }

    throw new Error(
      `Tokens not found in cookies after ${maxRetries} attempts. Expected: ${this.config.tokens.access}, ${this.config.tokens.refresh}. Last error: ${lastError?.message || 'Unknown'}`
    );
  }

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

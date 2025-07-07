import type {
  AuthConfig,
  NormalizedConfig,
  TokenPair,
  LoginCredentials,
  Response,
  AuthError,
} from '../types';
import { createStorageAdapter } from '../storage';
import { TokenManager } from './token-manager';
import { RequestHandler } from './request-handler';

/**
 * Main authentication client
 * Orchestrates token management, request handling, and authentication flow
 */
export class AuthClient {
  private readonly config: NormalizedConfig;
  private readonly tokenManager: TokenManager;
  private readonly requestHandler: RequestHandler;
  private refreshPromise: Promise<void> | null = null;

  constructor(config: AuthConfig) {
    this.config = this.normalizeConfig(config);

    const storage = createStorageAdapter(this.config.storage);
    this.tokenManager = new TokenManager(storage, this.config.tokens);
    this.requestHandler = new RequestHandler(this.config.baseURL, {
      timeout: this.config.timeout,
      retry: this.config.retry,
    });
  }

  /**
   * Authenticate user with credentials
   */
  async login<T = any>(credentials: LoginCredentials): Promise<T> {
    const response = await this.requestHandler.request<T>(
      'POST',
      this.config.endpoints.login,
      credentials
    );

    const tokens = this.extractTokens(response.data);
    await this.tokenManager.setTokens(tokens);

    if (this.config.onTokenRefresh) {
      this.config.onTokenRefresh(tokens);
    }

    return response.data;
  }

  /**
   * Log out user and clear tokens
   */
  async logout(): Promise<void> {
    if (this.config.endpoints.logout) {
      try {
        await this.authenticatedRequest('POST', this.config.endpoints.logout);
      } catch {
        // Continue with logout even if endpoint fails
      }
    }

    await this.tokenManager.clearTokens();

    if (this.config.onLogout) {
      this.config.onLogout();
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.tokenManager.hasTokens();
  }

  /**
   * Get stored tokens
   */
  async getTokens(): Promise<TokenPair | null> {
    return this.tokenManager.getTokens();
  }

  /**
   * Set tokens manually
   */
  async setTokens(tokens: TokenPair): Promise<void> {
    await this.tokenManager.setTokens(tokens);
  }

  /**
   * Clear stored tokens
   */
  async clearTokens(): Promise<void> {
    await this.tokenManager.clearTokens();
  }

  /**
   * HTTP GET with authentication
   */
  async get<T = any>(url: string, config?: any): Promise<Response<T>> {
    return this.authenticatedRequest<T>('GET', url, undefined, config);
  }

  /**
   * HTTP POST with authentication
   */
  async post<T = any>(url: string, data?: any, config?: any): Promise<Response<T>> {
    return this.authenticatedRequest<T>('POST', url, data, config);
  }

  /**
   * HTTP PUT with authentication
   */
  async put<T = any>(url: string, data?: any, config?: any): Promise<Response<T>> {
    return this.authenticatedRequest<T>('PUT', url, data, config);
  }

  /**
   * HTTP PATCH with authentication
   */
  async patch<T = any>(url: string, data?: any, config?: any): Promise<Response<T>> {
    return this.authenticatedRequest<T>('PATCH', url, data, config);
  }

  /**
   * HTTP DELETE with authentication
   */
  async delete<T = any>(url: string, config?: any): Promise<Response<T>> {
    return this.authenticatedRequest<T>('DELETE', url, undefined, config);
  }

  /**
   * Make authenticated request with automatic token refresh
   */
  private async authenticatedRequest<T>(
    method: string,
    url: string,
    data?: any,
    config: any = {}
  ): Promise<Response<T>> {
    const accessToken = await this.tokenManager.getAccessToken();
    if (accessToken) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${accessToken}`,
      };
    }

    try {
      return await this.requestHandler.request<T>(method, url, data, config);
    } catch (error: any) {
      if (error.status === 401 && !error.isRetry) {
        return this.handleAuthError<T>(method, url, data, config);
      }
      throw error;
    }
  }

  /**
   * Handle 401 errors with token refresh
   */
  private async handleAuthError<T>(
    method: string,
    url: string,
    data?: any,
    config: any = {}
  ): Promise<Response<T>> {
    if (this.requestHandler.isCurrentlyRefreshing()) {
      return this.requestHandler.queueRequest<T>(method, url, data, config);
    }

    this.refreshPromise ??= this.refreshTokens();

    try {
      await this.refreshPromise;

      const newAccessToken = await this.tokenManager.getAccessToken();
      if (newAccessToken) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${newAccessToken}`,
        };
        config.isRetry = true;
        return this.requestHandler.request<T>(method, url, data, config);
      }
    } catch (refreshError) {
      await this.tokenManager.clearTokens();
      if (this.config.onAuthError) {
        this.config.onAuthError(this.normalizeError(refreshError));
      }
      throw refreshError;
    } finally {
      this.refreshPromise = null;
    }

    throw new Error('Token refresh failed');
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshTokens(): Promise<void> {
    this.requestHandler.setRefreshing(true);

    try {
      const refreshToken = await this.tokenManager.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      if (this.tokenManager.isTokenExpired(refreshToken)) {
        throw new Error('Refresh token is expired');
      }

      const response = await this.requestHandler.request('POST', this.config.endpoints.refresh, {
        refreshToken,
      });

      const tokens = this.extractTokens(response.data);
      await this.tokenManager.setTokens(tokens);

      if (this.config.onTokenRefresh) {
        this.config.onTokenRefresh(tokens);
      }
    } finally {
      this.requestHandler.setRefreshing(false);
    }
  }

  /**
   * Extract tokens from API response
   */
  private extractTokens(data: any): TokenPair {
    const accessToken = data[this.config.tokens.access];
    const refreshToken = data[this.config.tokens.refresh];

    if (!accessToken || !refreshToken) {
      throw new Error(
        `Tokens not found in response. Expected fields: ${this.config.tokens.access}, ${this.config.tokens.refresh}`
      );
    }

    return { accessToken, refreshToken };
  }

  /**
   * Normalize error to AuthError format
   */
  private normalizeError(error: unknown): AuthError {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as AuthError;
    }

    return {
      status: 500,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      code: 'UNKNOWN_ERROR',
      originalError: error,
    };
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(config: AuthConfig): NormalizedConfig {
    return {
      baseURL: config.baseURL,
      endpoints: {
        login: config.endpoints?.login ?? '/auth/login',
        refresh: config.endpoints?.refresh ?? '/auth/refresh',
        logout: config.endpoints?.logout ?? '/auth/logout',
      },
      tokens: {
        access: config.tokens?.access ?? 'accessToken',
        refresh: config.tokens?.refresh ?? 'refreshToken',
      },
      storage: config.storage ?? 'auto',
      timeout: config.timeout ?? 10000,
      retry: {
        attempts: config.retry?.attempts ?? 3,
        delay: config.retry?.delay ?? 1000,
      },
      onTokenRefresh: config.onTokenRefresh,
      onAuthError: config.onAuthError,
      onLogout: config.onLogout,
    };
  }
}

import {
  NormalizedConfig,
  TokenPair,
  HttpResponse,
  RequestConfig,
  LoginCredentials,
} from './types';
import { TokenStore } from './token-store';
import { HttpClient } from './http-client';

/**
 * Manages authentication flow and token refresh
 */
export class AuthManager {
  private readonly config: NormalizedConfig;
  private readonly tokenStore: TokenStore;
  private readonly httpClient: HttpClient;
  private refreshPromise: Promise<void> | null = null;

  constructor(config: NormalizedConfig, tokenStore: TokenStore, httpClient: HttpClient) {
    this.config = config;
    this.tokenStore = tokenStore;
    this.httpClient = httpClient;
  }

  /**
   * Handle user login
   */
  async login<T = any>(credentials: LoginCredentials): Promise<T> {
    const response = await this.httpClient.post<T>(this.config.endpoints.login, credentials);

    const tokens = this.extractTokens(response.data);
    this.tokenStore.setTokens(tokens);

    return response.data;
  }

  /**
   * Handle user logout
   */
  async logout(): Promise<void> {
    try {
      await this.authenticatedRequest('POST', this.config.endpoints.logout);
    } catch {
      // Continue with logout even if endpoint fails
    }

    this.tokenStore.clearTokens();
  }

  /**
   * Make authenticated request with automatic token refresh
   */
  async authenticatedRequest<T>(
    method: string,
    url: string,
    data?: any,
    config: RequestConfig = {}
  ): Promise<HttpResponse<T>> {
    // Add auth header if we have a token
    const accessToken = this.tokenStore.getAccessToken();
    if (accessToken) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${accessToken}`,
      };
    }

    try {
      return await this.httpClient.request<T>(method, url, data, config);
    } catch (error: any) {
      // Handle 401 errors with token refresh
      if (error.status === 401 && !config.isRetry) {
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
    config: RequestConfig = {}
  ): Promise<HttpResponse<T>> {
    // If already refreshing, queue the request
    if (this.httpClient.isCurrentlyRefreshing()) {
      return this.httpClient.queueRequest<T>(method, url, data, config);
    }

    // Start refresh process
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshTokens();
    }

    try {
      await this.refreshPromise;

      // Retry request with new token (create new config to avoid mutation)
      const newAccessToken = this.tokenStore.getAccessToken();
      if (newAccessToken) {
        const retryConfig: RequestConfig = {
          ...config,
          headers: {
            ...config.headers,
            Authorization: `Bearer ${newAccessToken}`,
          },
          isRetry: true,
        };
        return this.httpClient.request<T>(method, url, data, retryConfig);
      }

      throw new Error('No access token after refresh');
    } catch (refreshError) {
      // Refresh failed, clear tokens and throw error
      this.tokenStore.clearTokens();
      throw refreshError;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshTokens(): Promise<void> {
    this.httpClient.setRefreshing(true);

    try {
      const refreshToken = this.tokenStore.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      if (this.tokenStore.isTokenExpired(refreshToken)) {
        throw new Error('Refresh token expired');
      }

      const response = await this.httpClient.post(this.config.endpoints.refresh, {
        refreshToken,
      });

      const tokens = this.extractTokens(response.data);
      this.tokenStore.setTokens(tokens);
    } finally {
      this.httpClient.setRefreshing(false);
    }
  }

  /**
   * Extract tokens from API response
   */
  private extractTokens(data: any): TokenPair {
    const accessToken = data[this.config.tokenFields.access];
    const refreshToken = data[this.config.tokenFields.refresh];

    if (!accessToken || !refreshToken) {
      throw new Error(
        `Tokens not found in response. Expected fields: ${this.config.tokenFields.access}, ${this.config.tokenFields.refresh}`
      );
    }

    return { accessToken, refreshToken };
  }
}

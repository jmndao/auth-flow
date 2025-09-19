import {
  AuthFlowConfig,
  NormalizedConfig,
  LoginCredentials,
  TokenPair,
  HttpResponse,
  RequestConfig,
  AuthValidator,
} from './types';
import { createStorage } from './storage';
import { TokenStore } from './token-store';
import { HttpClient } from './http-client';
import { AuthManager } from './auth-manager';

/**
 * Main Auth class focused on authentication concerns only
 */
export class Auth {
  private readonly config: NormalizedConfig;
  private readonly tokenStore: TokenStore;
  private readonly httpClient: HttpClient;
  private readonly authManager: AuthManager;

  constructor(config: AuthFlowConfig) {
    this.config = this.normalizeConfig(config);

    const storage = createStorage(this.config.storage);
    this.tokenStore = new TokenStore(storage);
    this.httpClient = new HttpClient(this.config);
    this.authManager = new AuthManager(this.config, this.tokenStore, this.httpClient);
  }

  /**
   * Login with credentials
   */
  async login<T = any>(credentials: LoginCredentials): Promise<T> {
    return this.authManager.login<T>(credentials);
  }

  /**
   * Logout and clear tokens
   */
  async logout(): Promise<void> {
    return this.authManager.logout();
  }

  /**
   * Check if user is authenticated
   * Supports both custom validation and parameter override
   */
  isAuthenticated(customValidator?: AuthValidator): boolean {
    const tokens = this.tokenStore.getTokens();

    // Use parameter validator if provided (highest priority)
    if (customValidator) {
      return customValidator(tokens);
    }

    // Use config validator if configured (medium priority)
    if (this.config.validateAuth) {
      return this.config.validateAuth(tokens);
    }

    // Default validation: check if tokens exist and are valid (fallback)
    return this.tokenStore.hasValidTokens();
  }

  /**
   * Get stored tokens
   */
  getTokens(): TokenPair | null {
    return this.tokenStore.getTokens();
  }

  /**
   * Manually set tokens
   */
  setTokens(tokens: TokenPair): void {
    this.tokenStore.setTokens(tokens);
  }

  /**
   * HTTP GET with authentication
   */
  async get<T = any>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
    return this.authManager.authenticatedRequest<T>('GET', url, undefined, config);
  }

  /**
   * HTTP POST with authentication
   */
  async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<HttpResponse<T>> {
    return this.authManager.authenticatedRequest<T>('POST', url, data, config);
  }

  /**
   * HTTP PUT with authentication
   */
  async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<HttpResponse<T>> {
    return this.authManager.authenticatedRequest<T>('PUT', url, data, config);
  }

  /**
   * HTTP PATCH with authentication
   */
  async patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<HttpResponse<T>> {
    return this.authManager.authenticatedRequest<T>('PATCH', url, data, config);
  }

  /**
   * HTTP DELETE with authentication
   */
  async delete<T = any>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
    return this.authManager.authenticatedRequest<T>('DELETE', url, undefined, config);
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(config: AuthFlowConfig): NormalizedConfig {
    return {
      baseURL: config.baseURL,
      endpoints: {
        login: config.endpoints?.login ?? '/auth/login',
        refresh: config.endpoints?.refresh ?? '/auth/refresh',
        logout: config.endpoints?.logout ?? '/auth/logout',
      },
      tokenFields: {
        access: config.tokenFields?.access ?? 'accessToken',
        refresh: config.tokenFields?.refresh ?? 'refreshToken',
      },
      storage: config.storage ?? 'localStorage',
      timeout: config.timeout ?? 10000,
      ...(config.validateAuth && { validateAuth: config.validateAuth }),
    };
  }
}

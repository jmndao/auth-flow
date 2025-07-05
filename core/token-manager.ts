import type {
  StorageAdapter,
  TokenPair,
  TokenConfig,
  StorageType,
  StorageConfig,
  AuthContext,
  Environment,
} from '../types';
import { LocalStorageAdapter, MemoryStorageAdapter } from '../adapters';
import { CookieManager } from './cookie-manager';
import { getOptimalStorageType, detectEnvironment, validateTokenPair } from '../utils';

/**
 * Manages token storage and retrieval across different storage adapters
 * Handles token validation, expiration checking, and storage abstraction
 */
export class TokenManager {
  private readonly storageAdapter: StorageAdapter;
  private readonly tokenConfig: TokenConfig;
  private readonly environment: Environment;

  constructor(
    tokenConfig: TokenConfig,
    storage: StorageType | StorageConfig = 'auto',
    context: AuthContext = {},
    environment: Environment = 'auto',
    cookieManager?: CookieManager
  ) {
    this.tokenConfig = tokenConfig;
    this.environment = environment === 'auto' ? detectEnvironment() : environment;

    if (cookieManager) {
      this.storageAdapter = cookieManager;
    } else {
      this.storageAdapter = this.createStorageAdapter(storage, context);
    }
  }

  /**
   * Creates appropriate storage adapter based on configuration
   */
  private createStorageAdapter(
    storage: StorageType | StorageConfig,
    context: AuthContext
  ): StorageAdapter {
    let storageType: StorageType;
    let storageOptions: any = {};

    if (typeof storage === 'string') {
      storageType = storage === 'auto' ? getOptimalStorageType(this.environment) : storage;
    } else {
      storageType = storage.type || getOptimalStorageType(this.environment);
      storageOptions = storage.options || {};
    }

    switch (storageType) {
      case 'localStorage':
        return new LocalStorageAdapter();
      case 'cookies':
        return new CookieManager(context, storageOptions);
      case 'memory':
        return new MemoryStorageAdapter();
      default:
        return new MemoryStorageAdapter();
    }
  }

  /**
   * Retrieves both access and refresh tokens
   */
  async getTokens(): Promise<TokenPair | null> {
    const accessToken = await this.getToken(this.tokenConfig.access);
    const refreshToken = await this.getToken(this.tokenConfig.refresh);

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  }

  /**
   * Stores both access and refresh tokens
   */
  async setTokens(tokens: TokenPair): Promise<void> {
    validateTokenPair(tokens);

    // Additional validation for non-empty strings
    if (
      !tokens.accessToken ||
      typeof tokens.accessToken !== 'string' ||
      tokens.accessToken.trim().length === 0
    ) {
      throw new Error('accessToken must be a non-empty string');
    }
    if (
      !tokens.refreshToken ||
      typeof tokens.refreshToken !== 'string' ||
      tokens.refreshToken.trim().length === 0
    ) {
      throw new Error('refreshToken must be a non-empty string');
    }

    await Promise.all([
      this.setToken(this.tokenConfig.access, tokens.accessToken),
      this.setToken(this.tokenConfig.refresh, tokens.refreshToken),
    ]);
  }

  /**
   * Retrieves access token only
   */
  async getAccessToken(): Promise<string | null> {
    return await this.getToken(this.tokenConfig.access);
  }

  /**
   * Retrieves refresh token only
   */
  async getRefreshToken(): Promise<string | null> {
    return await this.getToken(this.tokenConfig.refresh);
  }

  /**
   * Clears all stored tokens
   */
  async clearTokens(): Promise<void> {
    await Promise.all([
      this.removeToken(this.tokenConfig.access),
      this.removeToken(this.tokenConfig.refresh),
    ]);
  }

  /**
   * Checks if tokens exist in storage
   */
  async hasTokens(): Promise<boolean> {
    const tokens = await this.getTokens();
    return tokens !== null;
  }

  /**
   * Checks if stored tokens are valid (exist and not empty)
   */
  async hasValidTokens(): Promise<boolean> {
    const tokens = await this.getTokens();
    if (!tokens) return false;

    return Boolean(
      tokens.accessToken &&
        tokens.refreshToken &&
        typeof tokens.accessToken === 'string' &&
        typeof tokens.refreshToken === 'string' &&
        tokens.accessToken.trim().length > 0 &&
        tokens.refreshToken.trim().length > 0
    );
  }

  /**
   * Synchronous version of hasTokens for quick checks
   */
  hasTokensSync(): boolean {
    try {
      const accessToken = this.storageAdapter.get(this.tokenConfig.access);
      const refreshToken = this.storageAdapter.get(this.tokenConfig.refresh);

      // If storage returns promises, we can't determine sync
      if (accessToken instanceof Promise || refreshToken instanceof Promise) {
        return false;
      }

      return Boolean(
        accessToken &&
          refreshToken &&
          typeof accessToken === 'string' &&
          typeof refreshToken === 'string' &&
          accessToken.trim().length > 0 &&
          refreshToken.trim().length > 0
      );
    } catch {
      return false;
    }
  }

  /**
   * Gets a single token by key
   */
  private async getToken(key: string): Promise<string | null> {
    try {
      const result = this.storageAdapter.get(key);
      return result instanceof Promise ? await result : result;
    } catch {
      // Storage error - return null
      return null;
    }
  }

  /**
   * Sets a single token by key
   */
  private async setToken(key: string, value: string): Promise<void> {
    const result = this.storageAdapter.set(key, value);
    if (result instanceof Promise) {
      await result;
    }
  }

  /**
   * Removes a single token by key
   */
  private async removeToken(key: string): Promise<void> {
    const result = this.storageAdapter.remove(key);
    if (result instanceof Promise) {
      await result;
    }
  }

  /**
   * Checks if a JWT token is expired by examining its payload
   */
  isTokenExpired(token: string): boolean {
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

  /**
   * Checks if the stored access token is expired
   */
  async isAccessTokenExpired(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return true;
    return this.isTokenExpired(accessToken);
  }

  /**
   * Checks if the stored refresh token is expired
   */
  async isRefreshTokenExpired(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return true;
    return this.isTokenExpired(refreshToken);
  }
}

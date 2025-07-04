import type {
  StorageAdapter,
  TokenPair,
  TokenConfig,
  StorageType,
  StorageConfig,
  AuthContext,
  Environment,
} from '../types';
import { CookieManager, LocalStorageAdapter, MemoryStorageAdapter } from '../adapters';
import { detectEnvironment, validateTokenPair } from '../utils';

/**
 * Enhanced token manager that uses CookieManager for better cookie handling
 */
export class TokenManager {
  private readonly storageAdapter: StorageAdapter;
  private readonly tokenConfig: TokenConfig;
  private readonly environment: Environment;

  constructor(
    tokenConfig: TokenConfig,
    storage: StorageType | StorageConfig = 'auto',
    context: AuthContext = {},
    environment: Environment = 'auto'
  ) {
    this.tokenConfig = tokenConfig;
    this.environment = environment === 'auto' ? detectEnvironment() : environment;
    this.storageAdapter = this.createStorageAdapter(storage, context);
  }

  /**
   * Create appropriate storage adapter based on configuration
   */
  private createStorageAdapter(
    storage: StorageType | StorageConfig,
    context: AuthContext
  ): StorageAdapter {
    let storageType: StorageType;
    let storageOptions: any = {};

    if (typeof storage === 'string') {
      storageType = storage === 'auto' ? this.getOptimalStorageType() : storage;
    } else {
      storageType = storage.type || this.getOptimalStorageType();
      storageOptions = storage.options || {};
    }

    switch (storageType) {
      case 'localStorage':
        if (typeof window === 'undefined') {
          console.warn(
            'localStorage not available in server environment, falling back to memory storage'
          );
          return new MemoryStorageAdapter();
        }
        return new LocalStorageAdapter();

      case 'cookies':
        // Use CookieManager instead of CookieStorageAdapter for better reliability
        return new CookieManager(context, storageOptions);

      case 'memory':
        return new MemoryStorageAdapter();

      default:
        return new MemoryStorageAdapter();
    }
  }

  /**
   * Determine optimal storage type based on environment
   */
  private getOptimalStorageType(): StorageType {
    if (this.environment === 'server') {
      return 'cookies'; // Server-side should use cookies for persistence
    } else {
      return 'localStorage'; // Client-side can use localStorage
    }
  }

  /**
   * Get both access and refresh tokens
   */
  async getTokens(): Promise<TokenPair | null> {
    try {
      const accessToken = await this.getToken(this.tokenConfig.access);
      const refreshToken = await this.getToken(this.tokenConfig.refresh);

      if (!accessToken || !refreshToken) {
        return null;
      }

      return { accessToken, refreshToken };
    } catch (error) {
      console.error('Error retrieving tokens:', error);
      return null;
    }
  }

  /**
   * Set both access and refresh tokens
   */
  async setTokens(tokens: TokenPair): Promise<void> {
    try {
      validateTokenPair(tokens);

      // If using CookieManager, also set fallback tokens for immediate access
      if (this.storageAdapter instanceof CookieManager) {
        this.storageAdapter.setFallbackTokens(tokens);
      }

      await Promise.all([
        this.setToken(this.tokenConfig.access, tokens.accessToken),
        this.setToken(this.tokenConfig.refresh, tokens.refreshToken),
      ]);
    } catch (error) {
      console.error('Error setting tokens:', error);
      throw error;
    }
  }

  /**
   * Get access token only
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await this.getToken(this.tokenConfig.access);
    } catch (error) {
      console.error('Error retrieving access token:', error);
      return null;
    }
  }

  /**
   * Get refresh token only
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await this.getToken(this.tokenConfig.refresh);
    } catch (error) {
      console.error('Error retrieving refresh token:', error);
      return null;
    }
  }

  /**
   * Clear all tokens
   */
  async clearTokens(): Promise<void> {
    try {
      // Clear fallback tokens if using CookieManager
      if (this.storageAdapter instanceof CookieManager) {
        this.storageAdapter.clear();
      }

      await Promise.all([
        this.removeToken(this.tokenConfig.access),
        this.removeToken(this.tokenConfig.refresh),
      ]);
    } catch (error) {
      console.error('Error clearing tokens:', error);
      throw error;
    }
  }

  /**
   * Check if tokens exist
   */
  async hasTokens(): Promise<boolean> {
    const tokens = await this.getTokens();
    return tokens !== null;
  }

  /**
   * Check if valid tokens exist
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
   * Synchronous check for token existence (for interceptors)
   * Enhanced to work better with CookieManager's temporary store
   */
  hasTokensSync(): boolean {
    try {
      // For CookieManager, check temporary store first for immediate access
      if (this.storageAdapter instanceof CookieManager) {
        const fallbackTokens = this.storageAdapter.getFallbackTokens();
        if (fallbackTokens && fallbackTokens.accessToken && fallbackTokens.refreshToken) {
          return true;
        }
      }

      const accessToken = this.storageAdapter.get(this.tokenConfig.access);
      const refreshToken = this.storageAdapter.get(this.tokenConfig.refresh);

      // Handle async storage adapters
      if (accessToken instanceof Promise || refreshToken instanceof Promise) {
        return false; // Cannot determine synchronously
      }

      return Boolean(accessToken && refreshToken);
    } catch {
      return false;
    }
  }

  /**
   * Check if access token is expired (for JWT tokens)
   */
  async isAccessTokenExpired(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return true;

    return this.isTokenExpired(accessToken);
  }

  /**
   * JWT token expiration check
   */
  private isTokenExpired(token: string): boolean {
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
   * Get token from storage (handles async/sync adapters)
   */
  private async getToken(key: string): Promise<string | null> {
    const result = this.storageAdapter.get(key);
    return result instanceof Promise ? await result : result;
  }

  /**
   * Set token in storage (handles async/sync adapters)
   */
  private async setToken(key: string, value: string): Promise<void> {
    const result = this.storageAdapter.set(key, value);
    if (result instanceof Promise) {
      await result;
    }
  }

  /**
   * Remove token from storage (handles async/sync adapters)
   */
  private async removeToken(key: string): Promise<void> {
    const result = this.storageAdapter.remove(key);
    if (result instanceof Promise) {
      await result;
    }
  }
}

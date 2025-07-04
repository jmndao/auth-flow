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

interface TokenCache {
  accessToken?: string;
  refreshToken?: string;
  timestamp?: number;
}

export class TokenManager {
  private readonly storageAdapter: StorageAdapter;
  private readonly tokenConfig: TokenConfig;
  private readonly environment: Environment;
  private tokenCache: TokenCache = {};
  private readonly CACHE_TTL = 5000; // Cache tokens for 5 seconds

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

  async getTokens(): Promise<TokenPair | null> {
    // Check cache first for faster response
    if (this.isCacheValid() && this.tokenCache.accessToken && this.tokenCache.refreshToken) {
      return {
        accessToken: this.tokenCache.accessToken,
        refreshToken: this.tokenCache.refreshToken,
      };
    }

    try {
      const accessToken = await this.getTokenSilently(this.tokenConfig.access);
      const refreshToken = await this.getTokenSilently(this.tokenConfig.refresh);

      if (!accessToken || !refreshToken) {
        return null;
      }

      // Update cache with retrieved tokens
      this.updateTokenCache(accessToken, refreshToken);

      return { accessToken, refreshToken };
    } catch (error) {
      if (this.isDebugMode()) {
        console.error('Error getting tokens:', error);
      }
      return null;
    }
  }

  async setTokens(tokens: TokenPair): Promise<void> {
    try {
      validateTokenPair(tokens);

      // Update cache immediately for fast subsequent access
      this.updateTokenCache(tokens.accessToken, tokens.refreshToken);

      await Promise.all([
        this.setTokenSilently(this.tokenConfig.access, tokens.accessToken),
        this.setTokenSilently(this.tokenConfig.refresh, tokens.refreshToken),
      ]);
    } catch (error) {
      // Clear cache if setting fails
      this.clearTokenCache();

      if (this.isDebugMode()) {
        console.error('Failed to set tokens after all attempts:', error);
      }
      throw error;
    }
  }

  async getAccessToken(): Promise<string | null> {
    // Return cached token if available and valid
    if (this.isCacheValid() && this.tokenCache.accessToken) {
      return this.tokenCache.accessToken;
    }

    try {
      const token = await this.getTokenSilently(this.tokenConfig.access);

      // Update cache with new token
      if (token) {
        this.tokenCache.accessToken = token;
        this.tokenCache.timestamp = Date.now();
      }

      return token;
    } catch (error) {
      if (this.isDebugMode()) {
        console.error('Error getting access token:', error);
      }
      return null;
    }
  }

  async getRefreshToken(): Promise<string | null> {
    // Return cached token if available and valid
    if (this.isCacheValid() && this.tokenCache.refreshToken) {
      return this.tokenCache.refreshToken;
    }

    try {
      const token = await this.getTokenSilently(this.tokenConfig.refresh);

      // Update cache with new token
      if (token) {
        this.tokenCache.refreshToken = token;
        this.tokenCache.timestamp = Date.now();
      }

      return token;
    } catch (error) {
      if (this.isDebugMode()) {
        console.error('Error getting refresh token:', error);
      }
      return null;
    }
  }

  async clearTokens(): Promise<void> {
    // Clear cache immediately
    this.clearTokenCache();

    try {
      await Promise.all([
        this.removeTokenSilently(this.tokenConfig.access),
        this.removeTokenSilently(this.tokenConfig.refresh),
      ]);
    } catch (error) {
      if (this.isDebugMode()) {
        console.error('Failed to clear tokens after all attempts:', error);
      }
      throw error;
    }
  }

  async hasTokens(): Promise<boolean> {
    const tokens = await this.getTokens();
    return tokens !== null;
  }

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
   * Synchronous check for token existence
   * Used by interceptors to avoid async calls when possible
   */
  hasTokensSync(): boolean {
    // Check cache first for immediate response
    if (this.isCacheValid()) {
      return !!(this.tokenCache.accessToken && this.tokenCache.refreshToken);
    }

    // Check temporary store for cookie manager
    if (this.storageAdapter instanceof CookieManager) {
      const cookieManager = this.storageAdapter as any;
      if (cookieManager.temporaryStore) {
        const hasAccess =
          cookieManager.temporaryStore.has(this.tokenConfig.access) ||
          cookieManager.temporaryStore.has('token'); // Support both token names
        const hasRefresh = cookieManager.temporaryStore.has(this.tokenConfig.refresh);
        return hasAccess && hasRefresh;
      }
    }

    try {
      const accessToken = this.storageAdapter.get(this.tokenConfig.access);
      const refreshToken = this.storageAdapter.get(this.tokenConfig.refresh);

      // If storage is async, return cached result or false
      if (accessToken instanceof Promise || refreshToken instanceof Promise) {
        return !!(this.tokenCache.accessToken && this.tokenCache.refreshToken);
      }

      // Update cache with current values
      this.updateTokenCache(accessToken, refreshToken);

      return Boolean(accessToken && refreshToken);
    } catch {
      return false;
    }
  }

  // Token operations without logging intermediate failures
  private async getTokenSilently(key: string): Promise<string | null> {
    const result = this.storageAdapter.get(key);
    return result instanceof Promise ? await result : result;
  }

  private async setTokenSilently(key: string, value: string): Promise<void> {
    const result = this.storageAdapter.set(key, value);
    if (result instanceof Promise) {
      await result;
    }
  }

  private async removeTokenSilently(key: string): Promise<void> {
    const result = this.storageAdapter.remove(key);
    if (result instanceof Promise) {
      await result;
    }
  }

  // Cache management
  private isCacheValid(): boolean {
    if (!this.tokenCache.timestamp) return false;
    return Date.now() - this.tokenCache.timestamp < this.CACHE_TTL;
  }

  private updateTokenCache(accessToken: string | null, refreshToken: string | null): void {
    this.tokenCache = {
      accessToken: accessToken || undefined,
      refreshToken: refreshToken || undefined,
      timestamp: Date.now(),
    };
  }

  private clearTokenCache(): void {
    this.tokenCache = {};
  }

  // JWT token validation
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

  async isAccessTokenExpired(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return true;

    return this.isTokenExpired(accessToken);
  }

  // Debug mode detection
  private isDebugMode(): boolean {
    return (
      process.env.NODE_ENV !== 'production' ||
      (this.storageAdapter as any)?.options?.debugMode === true
    );
  }
}

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

    // Use provided cookie manager if available, otherwise create storage adapter
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
        console.warn(`Unsupported storage type: ${storageType}. Using memory storage.`);
        return new MemoryStorageAdapter();
    }
  }

  async getTokens(): Promise<TokenPair | null> {
    try {
      const accessToken = await this.getToken(this.tokenConfig.access);
      const refreshToken = await this.getToken(this.tokenConfig.refresh);

      if (!accessToken || !refreshToken) {
        return null;
      }

      return { accessToken, refreshToken };
    } catch (error) {
      console.error('Error getting tokens:', error);
      return null;
    }
  }

  async setTokens(tokens: TokenPair): Promise<void> {
    try {
      validateTokenPair(tokens);

      await Promise.all([
        this.setToken(this.tokenConfig.access, tokens.accessToken),
        this.setToken(this.tokenConfig.refresh, tokens.refreshToken),
      ]);
    } catch (error) {
      console.error('Error setting tokens:', error);
      throw error;
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      return await this.getToken(this.tokenConfig.access);
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      return await this.getToken(this.tokenConfig.refresh);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  async clearTokens(): Promise<void> {
    try {
      await Promise.all([
        this.removeToken(this.tokenConfig.access),
        this.removeToken(this.tokenConfig.refresh),
      ]);
    } catch (error) {
      console.error('Error clearing tokens:', error);
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

  // Synchronous token check for isAuthenticated()
  hasTokensSync(): boolean {
    try {
      const accessToken = this.storageAdapter.get(this.tokenConfig.access);
      const refreshToken = this.storageAdapter.get(this.tokenConfig.refresh);

      // If storage is async, we can't determine synchronously
      if (accessToken instanceof Promise || refreshToken instanceof Promise) {
        return false;
      }

      return Boolean(accessToken && refreshToken);
    } catch {
      return false;
    }
  }

  private async getToken(key: string): Promise<string | null> {
    const result = this.storageAdapter.get(key);
    return result instanceof Promise ? await result : result;
  }

  private async setToken(key: string, value: string): Promise<void> {
    const result = this.storageAdapter.set(key, value);
    if (result instanceof Promise) {
      await result;
    }
  }

  private async removeToken(key: string): Promise<void> {
    const result = this.storageAdapter.remove(key);
    if (result instanceof Promise) {
      await result;
    }
  }

  // JWT token expiration check
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
}

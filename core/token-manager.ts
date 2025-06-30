import type {
  StorageAdapter,
  TokenPair,
  TokenConfig,
  StorageType,
  StorageConfig,
  AuthContext,
  Environment,
} from '../types';
import { LocalStorageAdapter, CookieStorageAdapter, MemoryStorageAdapter } from '../adapters';
import { getOptimalStorageType, detectEnvironment, validateTokenPair } from '../utils';

export class TokenManager {
  private storageAdapter: StorageAdapter;
  private tokenConfig: TokenConfig;
  private environment: Environment;

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
        return new CookieStorageAdapter(
          { ...context, environment: this.environment === 'auto' ? undefined : this.environment },
          storageOptions
        );

      case 'memory':
        return new MemoryStorageAdapter();

      default:
        // Fallback to memory storage
        console.warn(`Unsupported storage type: ${storageType}. Falling back to memory storage.`);
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

      return {
        accessToken,
        refreshToken,
      };
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

  async setAccessToken(token: string): Promise<void> {
    try {
      await this.setToken(this.tokenConfig.access, token);
    } catch (error) {
      console.error('Error setting access token:', error);
      throw error;
    }
  }

  async setRefreshToken(token: string): Promise<void> {
    try {
      await this.setToken(this.tokenConfig.refresh, token);
    } catch (error) {
      console.error('Error setting refresh token:', error);
      throw error;
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

    // Basic validation - tokens exist and are non-empty strings
    return Boolean(
      tokens.accessToken &&
        tokens.refreshToken &&
        typeof tokens.accessToken === 'string' &&
        typeof tokens.refreshToken === 'string' &&
        tokens.accessToken.trim().length > 0 &&
        tokens.refreshToken.trim().length > 0
    );
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

  // Utility method to check if a token looks like it's expired (basic JWT check)
  isTokenExpired(token: string): boolean {
    try {
      // Basic JWT structure check
      const parts = token.split('.');
      if (parts.length !== 3) return true; // Non-JWT tokens are considered "expired"

      // Decode payload (second part)
      const payload = JSON.parse(atob(parts[1]));

      // Check if token has expiration time
      if (!payload.exp) return false;

      // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch {
      // If we can't decode the token, consider it expired for safety
      return true;
    }
  }

  async isAccessTokenExpired(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return true;

    return this.isTokenExpired(accessToken);
  }
}

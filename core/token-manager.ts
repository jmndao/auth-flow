import type { TokenPair, StorageAdapter } from '../types';

/**
 * Token lifecycle management
 * Handles token storage, validation, and expiration checking
 */
export class TokenManager {
  private readonly storage: StorageAdapter;
  private readonly accessTokenKey: string;
  private readonly refreshTokenKey: string;

  constructor(
    storage: StorageAdapter,
    tokenConfig: { access: string; refresh: string } = {
      access: 'accessToken',
      refresh: 'refreshToken',
    }
  ) {
    this.storage = storage;
    this.accessTokenKey = tokenConfig.access;
    this.refreshTokenKey = tokenConfig.refresh;
  }

  /**
   * Store token pair in storage
   */
  async setTokens(tokens: TokenPair): Promise<void> {
    if (!tokens.accessToken || !tokens.refreshToken) {
      throw new Error('Both access and refresh tokens are required');
    }

    await Promise.all([
      this.setItem(this.accessTokenKey, tokens.accessToken),
      this.setItem(this.refreshTokenKey, tokens.refreshToken),
    ]);
  }

  /**
   * Retrieve token pair from storage
   */
  async getTokens(): Promise<TokenPair | null> {
    const [accessToken, refreshToken] = await Promise.all([
      this.getItem(this.accessTokenKey),
      this.getItem(this.refreshTokenKey),
    ]);

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  }

  /**
   * Get only access token
   */
  async getAccessToken(): Promise<string | null> {
    return this.getItem(this.accessTokenKey);
  }

  /**
   * Get only refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    return this.getItem(this.refreshTokenKey);
  }

  /**
   * Clear all tokens from storage
   */
  async clearTokens(): Promise<void> {
    await Promise.all([
      this.removeItem(this.accessTokenKey),
      this.removeItem(this.refreshTokenKey),
    ]);
  }

  /**
   * Check if tokens exist (synchronous when possible)
   */
  hasTokens(): boolean {
    try {
      const accessToken = this.storage.get(this.accessTokenKey);
      const refreshToken = this.storage.get(this.refreshTokenKey);

      // Handle both sync and async storage
      if (accessToken instanceof Promise || refreshToken instanceof Promise) {
        return false; // Cannot determine synchronously
      }

      return Boolean(accessToken && refreshToken);
    } catch {
      return false;
    }
  }

  /**
   * Check if stored tokens are valid and not expired
   */
  async hasValidTokens(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    const refreshToken = await this.getRefreshToken();

    if (!refreshToken) {
      return false;
    }

    if (this.isTokenExpired(refreshToken)) {
      await this.clearTokens();
      return false;
    }

    if (!accessToken) {
      return false;
    }

    if (accessToken.includes('.') && this.isTokenExpired(accessToken)) {
      return false;
    }

    return true;
  }

  /**
   * Validate JWT token expiration
   */
  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;

      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false; // No expiration claim

      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch {
      return true; // Invalid token format
    }
  }

  /**
   * Check if access token is expired
   */
  async isAccessTokenExpired(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return true;
    return this.isTokenExpired(accessToken);
  }

  /**
   * Check if refresh token is expired
   */
  async isRefreshTokenExpired(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return true;
    return this.isTokenExpired(refreshToken);
  }

  /**
   * Helper method to handle both sync and async storage
   */
  private async getItem(key: string): Promise<string | null> {
    const result = this.storage.get(key);
    return result instanceof Promise ? await result : result;
  }

  /**
   * Helper method to handle both sync and async storage
   */
  private async setItem(key: string, value: string): Promise<void> {
    const result = this.storage.set(key, value);
    if (result instanceof Promise) {
      await result;
    }
  }

  /**
   * Helper method to handle both sync and async storage
   */
  private async removeItem(key: string): Promise<void> {
    const result = this.storage.remove(key);
    if (result instanceof Promise) {
      await result;
    }
  }
}

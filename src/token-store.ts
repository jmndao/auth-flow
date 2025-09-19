import { TokenPair, StorageAdapter } from './types';

/**
 * Token storage and validation
 */
export class TokenStore {
  private readonly storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /**
   * Store token pair
   */
  setTokens(tokens: TokenPair): void {
    this.storage.set('auth_access_token', tokens.accessToken);
    this.storage.set('auth_refresh_token', tokens.refreshToken);
  }

  /**
   * Get stored token pair
   */
  getTokens(): TokenPair | null {
    const accessToken = this.storage.get('auth_access_token');
    const refreshToken = this.storage.get('auth_refresh_token');

    if (!accessToken || !refreshToken) {
      return null;
    }

    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
    };
  }

  /**
   * Get only access token
   */
  getAccessToken(): string | null {
    return this.storage.get('auth_access_token');
  }

  /**
   * Get only refresh token
   */
  getRefreshToken(): string | null {
    return this.storage.get('auth_refresh_token');
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    this.storage.remove('auth_access_token');
    this.storage.remove('auth_refresh_token');
  }

  /**
   * Check if tokens exist
   */
  hasTokens(): boolean {
    const tokens = this.getTokens();
    return tokens !== null;
  }

  /**
   * Check if JWT token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true; // Not a valid JWT
      }

      const payload = JSON.parse(atob(parts[1]));

      // If no expiration claim, assume not expired
      if (!payload.exp) {
        return false;
      }

      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch {
      return true; // Invalid token format
    }
  }

  /**
   * Check if we have valid tokens
   */
  hasValidTokens(): boolean {
    const tokens = this.getTokens();
    if (!tokens) {
      return false;
    }

    // If refresh token is expired, tokens are invalid
    if (this.isTokenExpired(tokens.refreshToken)) {
      this.clearTokens();
      return false;
    }

    return true;
  }
}

import { TokenManager } from '../core/token-manager';
import { MemoryStorage } from '../storage/memory';

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    tokenManager = new TokenManager(storage, { access: 'accessToken', refresh: 'refreshToken' });
  });

  describe('token storage', () => {
    it('should store and retrieve tokens', async () => {
      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      await tokenManager.setTokens(tokens);
      const retrievedTokens = await tokenManager.getTokens();

      expect(retrievedTokens).toEqual(tokens);
    });

    it('should return null when no tokens exist', async () => {
      const tokens = await tokenManager.getTokens();
      expect(tokens).toBeNull();
    });

    it('should clear tokens', async () => {
      await tokenManager.setTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      await tokenManager.clearTokens();
      const tokens = await tokenManager.getTokens();

      expect(tokens).toBeNull();
    });
  });

  describe('token validation', () => {
    it('should validate non-expired JWT tokens', () => {
      // JWT with exp claim in the future
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = { exp: futureExp, sub: 'user123' };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;

      expect(tokenManager.isTokenExpired(token)).toBe(false);
    });

    it('should detect expired JWT tokens', () => {
      // JWT with exp claim in the past
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const payload = { exp: pastExp, sub: 'user123' };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;

      expect(tokenManager.isTokenExpired(token)).toBe(true);
    });

    it('should handle invalid token format', () => {
      expect(tokenManager.isTokenExpired('invalid-token')).toBe(true);
      expect(tokenManager.isTokenExpired('')).toBe(true);
    });

    it('should handle tokens without expiration', () => {
      const payload = { sub: 'user123' }; // No exp claim
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;

      expect(tokenManager.isTokenExpired(token)).toBe(false);
    });
  });

  describe('token existence checks', () => {
    it('should check if tokens exist synchronously', async () => {
      expect(tokenManager.hasTokens()).toBe(false);

      await tokenManager.setTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(tokenManager.hasTokens()).toBe(true);
    });

    it('should validate token existence and validity', async () => {
      expect(await tokenManager.hasValidTokens()).toBe(false);

      await tokenManager.setTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(await tokenManager.hasValidTokens()).toBe(true);
    });
  });

  describe('individual token access', () => {
    beforeEach(async () => {
      await tokenManager.setTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should get access token', async () => {
      const accessToken = await tokenManager.getAccessToken();
      expect(accessToken).toBe('access-token');
    });

    it('should get refresh token', async () => {
      const refreshToken = await tokenManager.getRefreshToken();
      expect(refreshToken).toBe('refresh-token');
    });

    it('should check access token expiration', async () => {
      const expired = await tokenManager.isAccessTokenExpired();
      expect(expired).toBe(true); // Non-JWT token is considered expired
    });

    it('should check refresh token expiration', async () => {
      const expired = await tokenManager.isRefreshTokenExpired();
      expect(expired).toBe(true); // Non-JWT token is considered expired
    });
  });
});

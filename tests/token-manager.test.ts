import { TokenManager } from '../core/token-manager';

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  beforeEach(() => {
    tokenManager = new TokenManager({ access: 'accessToken', refresh: 'refreshToken' }, 'memory');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Storage and Retrieval', () => {
    test('should set and get tokens', async () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      await tokenManager.setTokens(tokens);
      const retrievedTokens = await tokenManager.getTokens();

      expect(retrievedTokens).toEqual(tokens);
    });

    test('should return null when no tokens exist', async () => {
      const tokens = await tokenManager.getTokens();
      expect(tokens).toBeNull();
    });

    test('should clear tokens', async () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      await tokenManager.setTokens(tokens);
      await tokenManager.clearTokens();

      const retrievedTokens = await tokenManager.getTokens();
      expect(retrievedTokens).toBeNull();
    });

    test('should get individual access token', async () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      await tokenManager.setTokens(tokens);
      const accessToken = await tokenManager.getAccessToken();

      expect(accessToken).toBe('test-access-token');
    });

    test('should get individual refresh token', async () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      await tokenManager.setTokens(tokens);
      const refreshToken = await tokenManager.getRefreshToken();

      expect(refreshToken).toBe('test-refresh-token');
    });
  });

  describe('Token Validation', () => {
    test('should return false for hasValidTokens when no tokens exist', async () => {
      expect(await tokenManager.hasValidTokens()).toBe(false);
    });

    test('should return true for hasValidTokens when tokens exist', async () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      await tokenManager.setTokens(tokens);
      expect(await tokenManager.hasValidTokens()).toBe(true);
    });

    test('should return false for hasTokens when no tokens exist', async () => {
      expect(await tokenManager.hasTokens()).toBe(false);
    });

    test('should return true for hasTokens when tokens exist', async () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      await tokenManager.setTokens(tokens);
      expect(await tokenManager.hasTokens()).toBe(true);
    });
  });

  describe('JWT Token Expiration', () => {
    test('should detect expired JWT token', () => {
      // Create an expired JWT (exp in the past)
      const expiredJWT =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogtVhfEd2o';

      expect(tokenManager.isTokenExpired(expiredJWT)).toBe(true);
    });

    test('should detect non-expired JWT token', () => {
      // Create a non-expired JWT (exp in the future)
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = btoa(JSON.stringify({ exp: futureTimestamp }));
      const validJWT = `header.${payload}.signature`;

      expect(tokenManager.isTokenExpired(validJWT)).toBe(false);
    });

    test('should handle non-JWT tokens gracefully', () => {
      const nonJWT = 'not-a-jwt-token';

      // Non-JWT tokens should be considered "expired" (true) since they can't be validated
      expect(tokenManager.isTokenExpired(nonJWT)).toBe(true);
    });

    test('should handle malformed JWT tokens', () => {
      const malformedJWT = 'header.invalid-payload.signature';

      // Malformed JWT tokens should be considered "expired" (true) since they can't be validated
      expect(tokenManager.isTokenExpired(malformedJWT)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should throw error when setting invalid tokens', async () => {
      // Test with empty accessToken
      const invalidTokens1 = {
        accessToken: '',
        refreshToken: 'test-refresh-token',
      };

      await expect(tokenManager.setTokens(invalidTokens1)).rejects.toThrow(
        'accessToken must be a non-empty string'
      );

      // Test with empty refreshToken
      const invalidTokens2 = {
        accessToken: 'test-access-token',
        refreshToken: '',
      };

      await expect(tokenManager.setTokens(invalidTokens2)).rejects.toThrow(
        'refreshToken must be a non-empty string'
      );
    });

    test('should handle storage errors gracefully', async () => {
      // Mock storage adapter to throw error
      const mockAdapter = {
        get: jest.fn().mockRejectedValue(new Error('Storage error')),
        set: jest.fn().mockRejectedValue(new Error('Storage error')),
        remove: jest.fn().mockRejectedValue(new Error('Storage error')),
        clear: jest.fn().mockRejectedValue(new Error('Storage error')),
      };

      const errorTokenManager = new TokenManager(
        { access: 'accessToken', refresh: 'refreshToken' },
        'memory'
      );

      // Replace the storage adapter with our mock
      (errorTokenManager as any).storageAdapter = mockAdapter;

      // Should handle storage errors gracefully and return null
      const tokens = await errorTokenManager.getTokens();
      expect(tokens).toBeNull();
    });
  });
});

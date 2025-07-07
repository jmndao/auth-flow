import { AuthClient } from '../core/auth-client';
import type { AuthConfig } from '../types';

describe('AuthClient', () => {
  const mockConfig: AuthConfig = {
    baseURL: 'https://api.example.com',
    endpoints: {
      login: '/auth/login',
      refresh: '/auth/refresh',
      logout: '/auth/logout',
    },
    tokens: {
      access: 'accessToken',
      refresh: 'refreshToken',
    },
    storage: 'memory',
  };

  let authClient: AuthClient;

  beforeEach(() => {
    authClient = new AuthClient(mockConfig);
  });

  describe('login', () => {
    it('should login successfully and store tokens', async () => {
      const mockResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: { id: '1', email: 'test@example.com' },
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await authClient.login({ email: 'test@example.com', password: 'password' });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
        })
      );

      expect(result).toEqual(mockResponse);
      expect(authClient.isAuthenticated()).toBe(true);
    });

    it('should throw error when tokens are missing from response', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: '1' } }),
      });

      await expect(
        authClient.login({ email: 'test@example.com', password: 'password' })
      ).rejects.toThrow('Tokens not found in response');
    });
  });

  describe('logout', () => {
    it('should logout and clear tokens', async () => {
      // First login
      await authClient.setTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await authClient.logout();

      expect(authClient.isAuthenticated()).toBe(false);
      expect(await authClient.getTokens()).toBeNull();
    });
  });

  describe('authenticated requests', () => {
    beforeEach(async () => {
      await authClient.setTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should add authorization header to requests', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      await authClient.get('/user/profile');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/user/profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token',
          }),
        })
      );
    });

    it('should refresh tokens on 401 error', async () => {
      // First request fails with 401
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })
        // Token refresh succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              accessToken: 'new-access-token',
              refreshToken: 'new-refresh-token',
            }),
        })
        // Retry request succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: 'success' }),
        });

      const result = await authClient.get('/protected-route');

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.data).toEqual({ data: 'success' });
    });
  });

  describe('token management', () => {
    it('should get and set tokens', async () => {
      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      await authClient.setTokens(tokens);
      const retrievedTokens = await authClient.getTokens();

      expect(retrievedTokens).toEqual(tokens);
    });

    it('should clear tokens', async () => {
      await authClient.setTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      await authClient.clearTokens();
      const tokens = await authClient.getTokens();

      expect(tokens).toBeNull();
    });
  });
});

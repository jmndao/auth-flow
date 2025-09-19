import { createAuthFlow } from '../index';
import { AuthFlowConfig } from '../types';

describe('AuthFlow', () => {
  const config: AuthFlowConfig = {
    baseURL: 'https://api.example.com',
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a working localStorage mock with actual storage
    const mockStorage = window.localStorage as jest.Mocked<Storage>;
    const storage: Record<string, string> = {};

    mockStorage.getItem.mockImplementation((key: string) => {
      return storage[key] || null;
    });
    mockStorage.setItem.mockImplementation((key: string, value: string) => {
      storage[key] = value;
    });
    mockStorage.removeItem.mockImplementation((key: string) => {
      delete storage[key];
    });
  });

  describe('createAuthFlow', () => {
    it('should create Auth instance', () => {
      const auth = createAuthFlow(config);
      expect(auth).toBeDefined();
      expect(typeof auth.login).toBe('function');
      expect(typeof auth.logout).toBe('function');
      expect(typeof auth.isAuthenticated).toBe('function');
    });

    it('should apply default configuration', () => {
      const auth = createAuthFlow(config);
      expect(auth).toBeDefined();
    });
  });

  describe('authentication validation', () => {
    it('should use default validation when no custom validator', () => {
      const auth = createAuthFlow(config);
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('should use config-based validation', () => {
      const configValidator = jest.fn().mockReturnValue(true);
      const auth = createAuthFlow({
        ...config,
        validateAuth: configValidator,
      });

      auth.setTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = auth.isAuthenticated();

      expect(result).toBe(true);
      expect(configValidator).toHaveBeenCalledWith({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('authentication flow', () => {
    it('should login successfully and store tokens', async () => {
      const auth = createAuthFlow(config);
      const mockResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: { id: '1', email: 'test@example.com' },
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await auth.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should throw error when tokens missing from login response', async () => {
      const auth = createAuthFlow(config);

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ user: { id: '1' } }),
      });

      await expect(auth.login({ email: 'test@example.com', password: 'password' })).rejects.toThrow(
        'Tokens not found in response'
      );
    });
  });

  describe('authenticated requests', () => {
    it('should add authorization header to requests', async () => {
      const auth = createAuthFlow(config);

      auth.setTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: 'test' }),
      });

      await auth.get('/user/profile');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/user/profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token',
          }),
        })
      );
    });
  });
});

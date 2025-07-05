import { AuthClient } from '../core/auth-client';
import axios from 'axios';

// Mock axios
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    post: jest.fn(),
    get: jest.fn(),
    request: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthClient', () => {
  let authClient: AuthClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    // Mock standalone axios methods
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: {
        user: { id: 1, name: 'Test User' },
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
    });

    authClient = new AuthClient({
      endpoints: {
        login: '/auth/login',
        refresh: '/auth/refresh',
      },
      tokens: {
        access: 'accessToken',
        refresh: 'refreshToken',
      },
    });
  });

  describe('Configuration', () => {
    test('should create AuthClient with valid config', () => {
      expect(authClient).toBeInstanceOf(AuthClient);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: undefined,
        timeout: 10000,
      });
    });

    test('should create AuthClient with custom baseURL and timeout', () => {
      new AuthClient({
        endpoints: {
          login: '/auth/login',
          refresh: '/auth/refresh',
        },
        tokens: {
          access: 'accessToken',
          refresh: 'refreshToken',
        },
        baseURL: 'https://api.example.com',
        timeout: 5000,
      });

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
        timeout: 5000,
      });
    });

    test('should throw error with invalid config', () => {
      expect(() => {
        new AuthClient({} as any);
      }).toThrow('Login endpoint is required');
    });

    test('should throw error with missing tokens config', () => {
      expect(() => {
        new AuthClient({
          endpoints: {
            login: '/auth/login',
            refresh: '/auth/refresh',
          },
        } as any);
      }).toThrow('Both access and refresh token field names are required');
    });
  });

  describe('Authentication Methods', () => {
    test('should login successfully', async () => {
      const credentials = { username: 'test@example.com', password: 'password' };

      const result = await authClient.login(credentials);

      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/login', credentials, expect.any(Object));

      expect(result).toEqual({
        user: { id: 1, name: 'Test User' },
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });
    });

    test('should handle login errors', async () => {
      const credentials = { username: 'test@example.com', password: 'wrong' };

      mockedAxios.post = jest.fn().mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
      });

      await expect(authClient.login(credentials)).rejects.toMatchObject({
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
      });
    });

    test('should logout successfully', async () => {
      const authClientWithLogout = new AuthClient({
        endpoints: {
          login: '/auth/login',
          refresh: '/auth/refresh',
          logout: '/auth/logout',
        },
        tokens: {
          access: 'accessToken',
          refresh: 'refreshToken',
        },
      });

      mockAxiosInstance.post.mockResolvedValue({ data: 'ok' });

      await authClientWithLogout.logout();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/logout');
    });

    test('should handle logout errors gracefully', async () => {
      const authClientWithLogout = new AuthClient({
        endpoints: {
          login: '/auth/login',
          refresh: '/auth/refresh',
          logout: '/auth/logout',
        },
        tokens: {
          access: 'accessToken',
          refresh: 'refreshToken',
        },
      });

      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      // Should not throw, just log warning
      await expect(authClientWithLogout.logout()).resolves.toBeUndefined();
    });

    test('should check authentication status', () => {
      // This is a synchronous method, so it should return false initially
      expect(authClient.isAuthenticated()).toBe(false);
    });
  });

  describe('HTTP Methods', () => {
    beforeEach(() => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
      });
    });

    test('should make GET request', async () => {
      const response = await authClient.get('/api/data');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'get',
        url: '/api/data',
        data: undefined,
      });

      expect(response).toEqual({
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
      });
    });

    test('should make POST request', async () => {
      const postData = { name: 'test' };
      const response = await authClient.post('/api/data', postData);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'post',
        url: '/api/data',
        data: postData,
      });

      expect(response.data).toEqual({ message: 'success' });
    });

    test('should make PUT request', async () => {
      const putData = { name: 'updated' };
      await authClient.put('/api/data/1', putData);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'put',
        url: '/api/data/1',
        data: putData,
      });
    });

    test('should make DELETE request', async () => {
      await authClient.delete('/api/data/1');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'delete',
        url: '/api/data/1',
        data: undefined,
      });
    });
  });

  describe('Token Management', () => {
    test('should set and get tokens', async () => {
      const tokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      await authClient.setTokens(tokens);
      const retrievedTokens = await authClient.getTokens();

      expect(retrievedTokens).toEqual(tokens);
    });

    test('should clear tokens', async () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      await authClient.setTokens(tokens);
      await authClient.clearTokens();

      const retrievedTokens = await authClient.getTokens();
      expect(retrievedTokens).toBeNull();
    });

    test('should validate tokens', async () => {
      expect(await authClient.hasValidTokens()).toBe(false);

      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      await authClient.setTokens(tokens);
      expect(await authClient.hasValidTokens()).toBe(true);
    });
  });

  describe('Callbacks', () => {
    test('should call onTokenRefresh callback', async () => {
      const onTokenRefresh = jest.fn();

      const authClientWithCallback = new AuthClient({
        endpoints: {
          login: '/auth/login',
          refresh: '/auth/refresh',
        },
        tokens: {
          access: 'accessToken',
          refresh: 'refreshToken',
        },
        onTokenRefresh,
      });

      const credentials = { username: 'test@example.com', password: 'password' };
      await authClientWithCallback.login(credentials);

      expect(onTokenRefresh).toHaveBeenCalledWith({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });
    });

    test('should call onLogout callback', async () => {
      const onLogout = jest.fn();

      const authClientWithCallback = new AuthClient({
        endpoints: {
          login: '/auth/login',
          refresh: '/auth/refresh',
        },
        tokens: {
          access: 'accessToken',
          refresh: 'refreshToken',
        },
        onLogout,
      });

      await authClientWithCallback.logout();

      expect(onLogout).toHaveBeenCalled();
    });
  });
});

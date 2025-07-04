import { createAuthFlowV2 } from '../index-v2';
import { AuthFlowV2ClientImpl } from '../core/authflow-v2-client';
import axios from 'axios';

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

describe('AuthFlow v2.0', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: {
        user: { id: 1, name: 'Test User' },
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      },
      status: 200,
    });
  });

  describe('Factory Functions', () => {
    test('createAuthFlowV2 with string config', () => {
      const client = createAuthFlowV2('https://api.example.com');
      expect(client).toBeInstanceOf(AuthFlowV2ClientImpl);
    });

    test('createAuthFlowV2 with object config', () => {
      const client = createAuthFlowV2({
        baseURL: 'https://api.example.com',
        caching: { enabled: true },
        monitoring: { enabled: false }, // Disable to avoid circular refs
      });
      expect(client).toBeInstanceOf(AuthFlowV2ClientImpl);
    });
  });

  describe('AuthFlow v2.0 Client', () => {
    let client: any;

    beforeEach(() => {
      client = createAuthFlowV2({
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
        caching: { enabled: false }, // Disable features that might cause circular refs
        monitoring: { enabled: false },
        health: { enabled: false },
        security: {
          encryptTokens: false,
          csrf: { enabled: false },
          requestSigning: { enabled: false },
        },
      });
    });

    afterEach(() => {
      try {
        client.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    describe('Authentication Methods', () => {
      test('should login successfully', async () => {
        const credentials = { email: 'test@example.com', password: 'password' };
        const result = await client.login(credentials);

        expect(result).toEqual({
          user: { id: 1, name: 'Test User' },
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
        });
      });

      test('should logout successfully', async () => {
        await expect(client.logout()).resolves.toBeUndefined();
      });

      test('should check authentication status', () => {
        expect(client.isAuthenticated()).toBe(false);
      });

      test('should check valid tokens', async () => {
        const hasValidTokens = await client.hasValidTokens();
        expect(typeof hasValidTokens).toBe('boolean');
      });
    });

    describe('HTTP Methods', () => {
      beforeEach(() => {
        mockAxiosInstance.request.mockResolvedValue({
          data: { message: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { url: '/test', method: 'GET' },
        });
      });

      test('should make GET request', async () => {
        const response = await client.get('/api/data');
        expect(response).toEqual({ message: 'success' });
      });

      test('should make POST request', async () => {
        const data = { name: 'test' };
        const response = await client.post('/api/data', data);
        expect(response).toEqual({ message: 'success' });
      });

      test('should make PUT request', async () => {
        const data = { name: 'updated' };
        const response = await client.put('/api/data/1', data);
        expect(response).toEqual({ message: 'success' });
      });

      test('should make PATCH request', async () => {
        const data = { status: 'active' };
        const response = await client.patch('/api/data/1', data);
        expect(response).toEqual({ message: 'success' });
      });

      test('should make DELETE request', async () => {
        const response = await client.delete('/api/data/1');
        expect(response).toEqual({ message: 'success' });
      });
    });

    describe('Token Management', () => {
      test('should get tokens', async () => {
        const tokens = await client.getTokens();
        expect(tokens).toBeNull();
      });

      test('should set and clear tokens', async () => {
        const testTokens = {
          accessToken: 'test-access',
          refreshToken: 'test-refresh',
        };

        await client.setTokens(testTokens);
        const retrievedTokens = await client.getTokens();
        expect(retrievedTokens).toEqual(testTokens);

        await client.clearTokens();
        const clearedTokens = await client.getTokens();
        expect(clearedTokens).toBeNull();
      });
    });

    describe('V2 Features (when enabled)', () => {
      let featuredClient: any;

      beforeEach(() => {
        featuredClient = createAuthFlowV2({
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
          caching: { enabled: true },
          monitoring: { enabled: true },
          security: { encryptTokens: false },
        });
      });

      afterEach(() => {
        try {
          featuredClient.destroy();
        } catch (error) {
          // Ignore cleanup errors
        }
      });

      test('should get cache stats', () => {
        const stats = featuredClient.getCacheStats();
        expect(typeof stats).toBe('object');
        expect(stats).toHaveProperty('size');
      });

      test('should get performance metrics', () => {
        const metrics = featuredClient.getPerformanceMetrics();
        expect(typeof metrics).toBe('object');
      });

      test('should handle debug info', () => {
        const debug = featuredClient.getDebugInfo();
        expect(typeof debug).toBe('object');
        expect(debug).toHaveProperty('config');
        expect(debug).toHaveProperty('authState');
      });
    });

    describe('Error Handling', () => {
      test('should handle request errors', async () => {
        mockAxiosInstance.request.mockRejectedValue(new Error('Network error'));

        await expect(client.get('/test')).rejects.toThrow();
      });
    });
  });
});

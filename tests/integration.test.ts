import { AuthClient } from '../core/auth-client';
import { CookieManager } from '../core/cookie-manager';
import { TokenManager } from '../core/token-manager';
import {
  createMockTokens,
  createMockConfig,
  createMockLoginResponse,
  createMalformedCookieContext,
} from './setup';

// Get the real axios mock reference
const axios = require('axios');

describe('AuthFlow Integration Tests', () => {
  let originalWindow: any;

  beforeEach(() => {
    originalWindow = (global as any).window;

    // Complete reset of all mocks
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Reset axios mock implementations
    axios.post.mockReset();
    axios.create.mockReset();
  });

  afterEach(() => {
    (global as any).window = originalWindow;
  });

  describe('Complete Authentication Flow', () => {
    test('should complete full login flow with Next.js cookies', async () => {
      delete (global as any).window; // Server environment

      // Create Next.js cookies mock
      let serverCookies: Record<string, string> = {};
      const mockCookieStore = {
        get: (key: string) => {
          const value = serverCookies[key];
          return value ? { value, name: key } : undefined;
        },
        set: (key: string, value: string) => {
          serverCookies[key] = value;
        },
      };

      const mockCookies = jest.fn(() => mockCookieStore);

      const config = {
        ...createMockConfig(),
        baseURL: 'https://api.example.com',
        tokenSource: 'cookies' as const,
        storage: 'cookies' as const,
      };

      const context = { cookies: mockCookies };

      const tokens = createMockTokens();
      const loginResponse = createMockLoginResponse(tokens);

      // Setup axios mocks
      axios.post.mockResolvedValueOnce(loginResponse);

      const mockInstance = {
        request: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
        post: jest.fn().mockResolvedValue({ data: { success: true } }),
        interceptors: {
          request: { use: jest.fn(), eject: jest.fn() },
          response: { use: jest.fn(), eject: jest.fn() },
        },
      };
      axios.create.mockReturnValue(mockInstance);

      const authClient = new AuthClient(config, context);

      const credentials = { email: 'test@example.com', password: 'password' };

      // Perform login
      const user = await authClient.login(credentials);

      // Verify login was successful
      expect(user).toBeDefined();
      expect(user.user.email).toBe('test@example.com');

      // Verify tokens were stored
      expect(mockCookies).toHaveBeenCalled();
      expect(serverCookies.accessToken).toBe(tokens.accessToken);
      expect(serverCookies.refreshToken).toBe(tokens.refreshToken);

      // Verify authentication state
      expect(authClient.isAuthenticated()).toBe(true);

      const storedTokens = await authClient.getTokens();
      expect(storedTokens).toEqual(tokens);
    });

    test('should handle logout properly', async () => {
      delete (global as any).window; // Server environment

      let serverCookies: Record<string, string> = {
        accessToken: 'existing-access',
        refreshToken: 'existing-refresh',
      };

      const mockCookieStore = {
        get: (key: string) => {
          const value = serverCookies[key];
          return value ? { value, name: key } : undefined;
        },
        set: (key: string, value: string) => {
          if (value === '' || !value) {
            delete serverCookies[key];
          } else {
            serverCookies[key] = value;
          }
        },
        delete: (key: string) => {
          delete serverCookies[key];
        },
      };

      const mockCookies = jest.fn(() => mockCookieStore);

      const config = {
        ...createMockConfig(),
        baseURL: 'https://api.example.com',
        tokenSource: 'cookies' as const,
        storage: 'cookies' as const,
      };

      const mockInstance = {
        request: jest.fn(),
        post: jest.fn().mockResolvedValue({ data: { success: true } }),
        interceptors: {
          request: { use: jest.fn(), eject: jest.fn() },
          response: { use: jest.fn(), eject: jest.fn() },
        },
      };
      axios.create.mockReturnValue(mockInstance);

      const authClient = new AuthClient(config, { cookies: mockCookies });

      // Perform logout
      await authClient.logout();

      // Verify logout endpoint was called
      expect(mockInstance.post).toHaveBeenCalledWith('/auth/logout');

      // Verify tokens were cleared
      expect(authClient.isAuthenticated()).toBe(false);
      expect(Object.keys(serverCookies)).toHaveLength(0);
    });

    test('should handle token refresh flow', async () => {
      // COMPLETELY FRESH SETUP FOR TOKEN REFRESH TEST
      jest.clearAllMocks();
      jest.resetAllMocks();
      axios.post.mockReset();
      axios.create.mockReset();

      const config = {
        ...createMockConfig(),
        baseURL: 'https://api.example.com',
        storage: 'memory' as const,
      };

      const initialTokens = {
        accessToken: 'initial-access-token',
        refreshToken: 'initial-refresh-token',
      };

      const newTokens = {
        accessToken: 'refreshed-access-token',
        refreshToken: 'refreshed-refresh-token',
      };

      // THE REAL FIX: Properly simulate the interceptor chain
      let capturedResponseInterceptor: Function | null = null;
      let requestCallCount = 0;

      const mockAxiosInstance = {
        request: jest.fn(),
        post: jest.fn(),
        get: jest.fn(),
        put: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        head: jest.fn(),
        options: jest.fn(),
        interceptors: {
          request: {
            use: jest.fn(),
            eject: jest.fn(),
          },
          response: {
            use: jest.fn((successHandler, errorHandler) => {
              // Capture the response error interceptor
              capturedResponseInterceptor = errorHandler;
            }),
            eject: jest.fn(),
          },
        },
      };

      // Mock the request method to simulate real interceptor behavior
      mockAxiosInstance.request.mockImplementation(async (requestConfig) => {
        requestCallCount++;

        // First request fails with 401
        if (requestCallCount === 1) {
          const error = new Error('Unauthorized');
          (error as any).response = {
            status: 401,
            statusText: 'Unauthorized',
            data: { message: 'jwt expired' },
          };
          (error as any).config = { ...requestConfig, _retry: undefined };
          (error as any).isAxiosError = true;

          // Manually trigger the response interceptor (this is the key!)
          if (capturedResponseInterceptor) {
            return await capturedResponseInterceptor(error);
          } else {
            throw error;
          }
        } else {
          // Retry request succeeds
          return {
            data: { message: 'Success after refresh' },
            status: 200,
            statusText: 'OK',
          };
        }
      });

      // Setup axios.create to return our mock instance
      axios.create.mockReturnValue(mockAxiosInstance);

      // Mock the refresh token call to succeed
      axios.post.mockImplementation((url, data, config) => {
        if (url.includes('/auth/refresh')) {
          return Promise.resolve({
            data: {
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
            },
            status: 200,
            statusText: 'OK',
          });
        }
        return Promise.resolve({ data: {}, status: 200 });
      });

      // Create AuthClient and set initial tokens
      const authClient = new AuthClient(config);
      await authClient.setTokens(initialTokens);

      // Verify initial setup
      expect(authClient.isAuthenticated()).toBe(true);
      const storedTokens = await authClient.getTokens();
      expect(storedTokens).toEqual(initialTokens);

      // Make the request that should trigger refresh
      const result = await authClient.get('/protected-resource');

      // Verify everything worked
      expect(result.data.message).toBe('Success after refresh');

      // Verify refresh endpoint was called with correct data
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.example.com/auth/refresh',
        { refreshToken: initialTokens.refreshToken },
        expect.objectContaining({
          timeout: 10000,
          baseURL: 'https://api.example.com',
          withCredentials: false,
        })
      );

      // Verify new tokens were stored
      const updatedTokens = await authClient.getTokens();
      expect(updatedTokens?.accessToken).toBe(newTokens.accessToken);
      expect(updatedTokens?.refreshToken).toBe(newTokens.refreshToken);

      // Verify the request was made twice (initial failure + retry success)
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    });

    test('should work with Express.js middleware', async () => {
      delete (global as any).window; // Server environment

      const tokens = createMockTokens();
      const mockReq = {
        cookies: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      };

      const mockRes = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
      };

      const config = {
        ...createMockConfig(),
        baseURL: 'https://api.example.com',
        tokenSource: 'cookies' as const,
        storage: 'cookies' as const,
      };

      const mockInstance = {
        request: jest.fn(),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn(), eject: jest.fn() },
          response: { use: jest.fn(), eject: jest.fn() },
        },
      };
      axios.create.mockReturnValue(mockInstance);

      const authClient = new AuthClient(config, { req: mockReq, res: mockRes });

      // Verify tokens are accessible
      const storedTokens = await authClient.getTokens();
      expect(storedTokens).toEqual(tokens);

      // Verify authentication state
      expect(authClient.isAuthenticated()).toBe(true);

      // Test setting new tokens
      const newTokens = createMockTokens();
      await authClient.setTokens(newTokens);

      // Verify Express cookie method was called
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'accessToken',
        newTokens.accessToken,
        expect.any(Object)
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        newTokens.refreshToken,
        expect.any(Object)
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle storage adapter errors gracefully', async () => {
      // Suppress console.error for this test since we expect errors
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const tokenManager = new TokenManager(
        { access: 'accessToken', refresh: 'refreshToken' },
        'memory'
      );

      // Mock storage adapter to throw errors
      const mockAdapter = {
        get: jest.fn().mockRejectedValue(new Error('Storage failed')),
        set: jest.fn().mockRejectedValue(new Error('Storage failed')),
        remove: jest.fn().mockRejectedValue(new Error('Storage failed')),
        clear: jest.fn().mockRejectedValue(new Error('Storage failed')),
      };

      // Replace the storage adapter
      (tokenManager as any).storageAdapter = mockAdapter;

      // Verify graceful error handling for getTokens (should return null)
      const tokens = await tokenManager.getTokens();
      expect(tokens).toBeNull();

      const hasTokens = await tokenManager.hasTokens();
      expect(hasTokens).toBe(false);

      // setTokens should still throw since it's a critical operation
      await expect(
        tokenManager.setTokens({ accessToken: 'test', refreshToken: 'test' })
      ).rejects.toThrow('Storage failed');

      // Restore console
      consoleSpy.mockRestore();
    });

    test('should handle malformed cookie data', async () => {
      delete (global as any).window; // Server environment

      // Use the enhanced malformed cookie context from setup
      const context = createMalformedCookieContext();
      const cookieManager = new CookieManager(context, { debugMode: false });

      // This should work now with the improved cookie parsing
      const malformedValue = await cookieManager.get('malformed');
      expect(malformedValue).toBe('cookie');

      const validValue = await cookieManager.get('validToken');
      expect(validValue).toBe('valid-value');
    });

    test('should handle Next.js cookies function failures', async () => {
      delete (global as any).window; // Server environment

      const brokenCookies = jest.fn(() => {
        throw new Error('Cookies context unavailable');
      });

      const cookieManager = new CookieManager({ cookies: brokenCookies }, { debugMode: false });

      // Should not throw, should return null
      const result = await cookieManager.get('nonexistent');
      expect(result).toBeNull();

      // Should not throw when setting
      await expect(cookieManager.set('test', 'value')).resolves.not.toThrow();
    });

    test('should handle async Next.js cookies properly', async () => {
      delete (global as any).window; // Server environment

      let cookieStore: Record<string, string> = {
        testToken: 'async-test-value',
      };

      const mockCookieStore = {
        get: (key: string) => {
          const value = cookieStore[key];
          return value ? { value, name: key } : undefined;
        },
        set: (key: string, value: string) => {
          cookieStore[key] = value;
        },
      };

      // Mock async cookies function
      const asyncCookies = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1)); // Simulate async
        return mockCookieStore;
      });

      const cookieManager = new CookieManager({ cookies: asyncCookies }, { debugMode: false });

      const value = await cookieManager.get('testToken');
      expect(value).toBe('async-test-value');

      await cookieManager.set('newToken', 'new-async-value');
      expect(cookieStore.newToken).toBe('new-async-value');
    });

    test('should handle network errors during login', async () => {
      const config = {
        ...createMockConfig(),
        baseURL: 'https://api.example.com',
      };

      // Setup basic axios instance mock
      const mockInstance = {
        request: jest.fn(),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn(), eject: jest.fn() },
          response: { use: jest.fn(), eject: jest.fn() },
        },
      };
      axios.create.mockReturnValue(mockInstance);

      // Create network error
      const networkError = new Error('Network Error');
      (networkError as any).code = 'ECONNREFUSED';

      // Mock the direct axios.post call that login() uses
      axios.post.mockRejectedValueOnce(networkError);

      const authClient = new AuthClient(config);
      const credentials = { email: 'test@example.com', password: 'password' };

      // Test for the actual error structure that ErrorHandler returns
      try {
        await authClient.login(credentials);
        fail('Login should have failed');
      } catch (error: any) {
        // ErrorHandler transforms errors into objects with a message property
        expect(error).toHaveProperty('message', 'Network Error');
        expect(error).toHaveProperty('code', 'ECONNREFUSED');
      }

      // Should not be authenticated after failed login
      expect(authClient.isAuthenticated()).toBe(false);
    });

    test('should handle missing tokens in response', async () => {
      const config = {
        ...createMockConfig(),
        baseURL: 'https://api.example.com',
      };

      // Setup basic axios instance mock
      const mockInstance = {
        request: jest.fn(),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn(), eject: jest.fn() },
          response: { use: jest.fn(), eject: jest.fn() },
        },
      };
      axios.create.mockReturnValue(mockInstance);

      // Mock response without tokens
      const responseWithoutTokens = {
        data: { user: { email: 'test@example.com' } }, // No accessToken or refreshToken
        status: 200,
        headers: {},
      };

      axios.post.mockResolvedValueOnce(responseWithoutTokens);

      const authClient = new AuthClient(config);
      const credentials = { email: 'test@example.com', password: 'password' };

      // Test for the actual error structure that ErrorHandler returns
      try {
        await authClient.login(credentials);
        fail('Login should have failed');
      } catch (error: any) {
        // ErrorHandler transforms errors into objects with a message property
        expect(error).toHaveProperty('message');
        expect(error.message).toMatch(/Tokens not found in response/);
      }

      // Should not be authenticated
      expect(authClient.isAuthenticated()).toBe(false);
    });
  });
});

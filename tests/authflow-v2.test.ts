// tests/authflow-v2.test.ts

import { createAuthFlowV2, authFlowPresets, createProductionAuthFlow } from '../index-v2';
import { AuthFlowV2ClientImpl } from '../core/authflow-v2-client';
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
        monitoring: { enabled: true },
      });
      expect(client).toBeInstanceOf(AuthFlowV2ClientImpl);
    });

    test('createProductionAuthFlow', () => {
      const client = createProductionAuthFlow('https://api.example.com');
      expect(client).toBeInstanceOf(AuthFlowV2ClientImpl);
    });
  });

  describe('Configuration Presets', () => {
    test('should have all required presets', () => {
      expect(authFlowPresets).toHaveProperty('performance');
      expect(authFlowPresets).toHaveProperty('security');
      expect(authFlowPresets).toHaveProperty('resilient');
      expect(authFlowPresets).toHaveProperty('development');
      expect(authFlowPresets).toHaveProperty('production');
      expect(authFlowPresets).toHaveProperty('minimal');
    });

    test('performance preset configuration', () => {
      const preset = authFlowPresets.performance;
      expect(preset.caching?.enabled).toBe(true);
      expect(preset.monitoring?.enabled).toBe(true);
      expect(preset.retry?.attempts).toBe(2);
    });

    test('security preset configuration', () => {
      const preset = authFlowPresets.security;
      expect(preset.security?.encryptTokens).toBe(true);
      expect(preset.security?.csrf?.enabled).toBe(true);
      expect(preset.caching?.enabled).toBe(false);
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
        caching: { enabled: true },
        monitoring: { enabled: true },
        security: {
          encryptTokens: false, // Disable encryption for simpler testing
          csrf: { enabled: false },
          requestSigning: { enabled: false },
        },
      });
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

    describe('HTTP Methods with v2.0 Features', () => {
      beforeEach(() => {
        mockAxiosInstance.request.mockResolvedValue({
          data: { message: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { url: '/test', method: 'GET' },
        });
      });

      test('should make GET request with caching', async () => {
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

      test('should handle request with custom config', async () => {
        const config = {
          headers: { 'Custom-Header': 'value' },
          cache: { enabled: false },
        };

        const response = await client.get('/api/data', config);
        expect(response).toEqual({ message: 'success' });
      });
    });

    describe('Token Management', () => {
      test('should get tokens', async () => {
        const tokens = await client.getTokens();
        expect(tokens).toBeNull(); // No tokens set initially
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

    describe('Performance Monitoring', () => {
      test('should get performance metrics', () => {
        const metrics = client.getPerformanceMetrics();
        expect(metrics).toHaveProperty('totalRequests');
        expect(metrics).toHaveProperty('averageResponseTime');
        expect(metrics).toHaveProperty('successRate');
        expect(typeof metrics.totalRequests).toBe('number');
      });

      test('should clear performance metrics', () => {
        expect(() => client.clearPerformanceMetrics()).not.toThrow();
      });
    });

    describe('Cache Management', () => {
      test('should get cache stats', () => {
        const stats = client.getCacheStats();
        expect(stats).toHaveProperty('size');
        expect(stats).toHaveProperty('hitRate');
        expect(typeof stats.size).toBe('number');
        expect(typeof stats.hitRate).toBe('number');
      });

      test('should clear cache', () => {
        expect(() => client.clearCache()).not.toThrow();
      });

      test('should clear cache with pattern', () => {
        expect(() => client.clearCache('/api/*')).not.toThrow();
      });
    });

    describe('Health Monitoring', () => {
      test('should get health status', () => {
        const status = client.getHealthStatus();
        expect(status).toHaveProperty('isHealthy');
        expect(status).toHaveProperty('lastCheckTime');
        expect(typeof status.isHealthy).toBe('boolean');
      });

      test('should check health immediately', async () => {
        mockAxiosInstance.get.mockResolvedValue({ status: 200 });
        const health = await client.checkHealth();
        expect(health).toHaveProperty('isHealthy');
        expect(typeof health.isHealthy).toBe('boolean');
      });
    });

    describe('Circuit Breaker', () => {
      test('should get circuit breaker stats', () => {
        const stats = client.getCircuitBreakerStats();
        expect(stats).toHaveProperty('state');
        expect(stats).toHaveProperty('failures');
        expect(stats).toHaveProperty('successes');
        expect(typeof stats.state).toBe('string');
        expect(typeof stats.failures).toBe('number');
      });

      test('should reset circuit breaker', () => {
        expect(() => client.resetCircuitBreaker()).not.toThrow();
      });
    });

    describe('Security Features', () => {
      test('should validate token', () => {
        const token =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const result = client.validateToken(token);
        expect(result).toHaveProperty('isValid');
        expect(typeof result.isValid).toBe('boolean');
      });

      test('should handle token encryption/decryption when disabled', () => {
        const token = 'test-token';
        const encrypted = client.encryptToken(token);
        expect(encrypted).toBe(token); // Should return original when encryption disabled

        const decrypted = client.decryptToken(encrypted);
        expect(decrypted).toBe(token);
      });
    });

    describe('Multi-Provider Support', () => {
      test('should switch provider', async () => {
        await expect(client.switchProvider('secondary')).resolves.toBeUndefined();
      });

      test('should get active provider', () => {
        const provider = client.getActiveProvider();
        expect(typeof provider).toBe('string');
        expect(provider).toBe('primary'); // Default provider
      });
    });

    describe('Offline Support', () => {
      test('should enable/disable offline mode', () => {
        expect(client.isOffline()).toBe(false); // Initially offline mode is disabled

        client.enableOfflineMode();
        expect(client.isOffline()).toBe(true);

        client.disableOfflineMode();
        expect(client.isOffline()).toBe(false);
      });

      test('should sync offline data', async () => {
        await expect(client.syncOfflineData()).resolves.toBeUndefined();
      });
    });

    describe('Developer Tools', () => {
      test('should enable/disable debug mode', () => {
        expect(() => {
          client.enableDebugMode();
          client.disableDebugMode();
        }).not.toThrow();
      });

      test('should get debug info', () => {
        const debug = client.getDebugInfo();
        expect(debug).toHaveProperty('config');
        expect(debug).toHaveProperty('authState');
        expect(debug).toHaveProperty('performance');
        expect(debug).toHaveProperty('health');
        expect(debug).toHaveProperty('circuitBreaker');
        expect(debug).toHaveProperty('features');

        // Verify structure of debug info
        expect(debug.authState).toHaveProperty('isAuthenticated');
        expect(debug.features).toHaveProperty('caching');
        expect(debug.features).toHaveProperty('monitoring');
      });
    });

    describe('Resource Cleanup', () => {
      test('should destroy client properly', () => {
        expect(() => client.destroy()).not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle basic errors gracefully', async () => {
      const client = createAuthFlowV2({
        baseURL: 'https://api.example.com',
        endpoints: {
          login: '/auth/login',
          refresh: '/auth/refresh',
        },
        tokens: {
          access: 'accessToken',
          refresh: 'refreshToken',
        },
      });

      mockAxiosInstance.request.mockRejectedValue({
        response: { status: 404 },
        config: { url: '/test', method: 'GET' },
      });

      await expect(client.get('/test')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('Configuration Validation', () => {
    test('should handle minimal configuration', () => {
      const client = createAuthFlowV2('https://api.example.com');
      expect(client).toBeInstanceOf(AuthFlowV2ClientImpl);
    });

    test('should merge custom config with defaults', () => {
      const client = createAuthFlowV2({
        baseURL: 'https://api.example.com',
        caching: { defaultTTL: 60000 },
        monitoring: { sampleRate: 0.5 },
      });

      const debug = client.getDebugInfo();
      expect(debug.config.caching.defaultTTL).toBe(60000);
      expect(debug.config.monitoring.sampleRate).toBe(0.5);
    });

    test('should handle configuration with all features disabled', () => {
      const client = createAuthFlowV2({
        baseURL: 'https://api.example.com',
        caching: { enabled: false },
        monitoring: { enabled: false },
        security: {
          encryptTokens: false,
          csrf: { enabled: false },
          requestSigning: { enabled: false },
        },
        health: { enabled: false },
      });

      expect(client).toBeInstanceOf(AuthFlowV2ClientImpl);

      const debug = client.getDebugInfo();
      expect(debug.features.caching).toBe(false);
      expect(debug.features.monitoring).toBe(false);
    });
  });

  describe('Preset Integration', () => {
    test('should work with performance preset', () => {
      const client = createAuthFlowV2({
        baseURL: 'https://api.example.com',
        ...authFlowPresets.performance,
      });

      expect(client).toBeInstanceOf(AuthFlowV2ClientImpl);
      const debug = client.getDebugInfo();
      expect(debug.features.caching).toBe(true);
    });

    test('should work with minimal preset', () => {
      const client = createAuthFlowV2({
        baseURL: 'https://api.example.com',
        ...authFlowPresets.minimal,
      });

      expect(client).toBeInstanceOf(AuthFlowV2ClientImpl);
      const debug = client.getDebugInfo();
      expect(debug.features.caching).toBe(false);
    });
  });
});

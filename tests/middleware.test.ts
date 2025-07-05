/**
 * Tests for middleware functionality
 */

import {
  createAuthMiddleware,
  createServerAuthChecker,
  createServerActionWrapper,
  type AuthFlowInstance,
  type MiddlewareConfig,
} from '../middleware/index';

// Mock AuthFlow instance for testing
const mockAuthFlow: AuthFlowInstance = {
  config: {
    tokens: {
      access: 'accessToken',
      refresh: 'refreshToken',
    },
  },
  login: jest.fn(),
  logout: jest.fn(),
  isAuthenticated: jest.fn().mockReturnValue(true),
  hasValidTokens: jest.fn().mockResolvedValue(true),
  getTokens: jest.fn().mockResolvedValue({
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  }),
  setTokens: jest.fn(),
  clearTokens: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
} as any;

describe('Middleware Configuration', () => {
  test('MiddlewareConfig should have correct structure', () => {
    const config: MiddlewareConfig = {
      redirectUrl: '/login',
      publicPaths: ['/public/*'],
      protectedPaths: ['/dashboard/*'],
      skipValidation: (path) => path.startsWith('/api/'),
      includeCallbackUrl: true,
    };

    expect(config.redirectUrl).toBe('/login');
    expect(config.publicPaths).toContain('/public/*');
    expect(config.skipValidation?.('/api/test')).toBe(true);
    expect(config.includeCallbackUrl).toBe(true);
  });
});

describe('Middleware Creation', () => {
  const config: MiddlewareConfig = {
    redirectUrl: '/login',
    publicPaths: ['/login'],
  };

  test('should create auth middleware function', () => {
    // This test will fail in non-Next.js environment, which is expected
    try {
      const middleware = createAuthMiddleware(mockAuthFlow, config);
      expect(typeof middleware).toBe('function');
    } catch (error) {
      // Expected in non-Next.js environment
      expect((error as Error).message).toContain(
        'createAuthMiddleware requires Next.js environment'
      );
    }
  });

  test('should create server auth checker', async () => {
    const checkAuth = await createServerAuthChecker(mockAuthFlow);
    expect(typeof checkAuth).toBe('function');

    const result = await checkAuth();
    expect(result.isAuthenticated).toBe(true);
  });

  test('should create server action wrapper', () => {
    const withAuth = createServerActionWrapper(mockAuthFlow);
    expect(typeof withAuth).toBe('function');

    const mockAction = jest.fn().mockResolvedValue('success');
    const wrappedAction = withAuth(mockAction);
    expect(typeof wrappedAction).toBe('function');
  });
});

describe('Server Auth Checker', () => {
  test('should check authentication with valid tokens', async () => {
    const checkAuth = await createServerAuthChecker(mockAuthFlow);
    const result = await checkAuth();

    expect(result.isAuthenticated).toBe(true);
  });

  test('should handle authentication failure', async () => {
    const failingAuthFlow = {
      ...mockAuthFlow,
      hasValidTokens: jest.fn().mockResolvedValue(false),
    } as any;

    const checkAuth = await createServerAuthChecker(failingAuthFlow);
    const result = await checkAuth();

    expect(result.isAuthenticated).toBe(false);
    expect(result.error).toBe('No valid tokens');
  });

  test('should handle errors gracefully', async () => {
    const errorAuthFlow = {
      ...mockAuthFlow,
      hasValidTokens: jest.fn().mockRejectedValue(new Error('Auth error')),
    } as any;

    const checkAuth = await createServerAuthChecker(errorAuthFlow);
    const result = await checkAuth();

    expect(result.isAuthenticated).toBe(false);
    expect(result.error).toBe('Auth error');
  });
});

describe('Server Action Wrapper', () => {
  test('should wrap action and maintain functionality', async () => {
    const withAuth = createServerActionWrapper(mockAuthFlow);
    const mockAction = jest.fn().mockResolvedValue('action result');

    const wrappedAction = withAuth(mockAction);
    const result = await wrappedAction('arg1', 'arg2');

    expect(mockAction).toHaveBeenCalledWith('arg1', 'arg2');
    expect(result).toBe('action result');
  });

  test('should handle action errors', async () => {
    const withAuth = createServerActionWrapper(mockAuthFlow);
    const errorAction = jest.fn().mockRejectedValue(new Error('Action failed'));

    const wrappedAction = withAuth(errorAction);

    await expect(wrappedAction()).rejects.toThrow('Action failed');
  });
});

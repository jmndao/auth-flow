/**
 * Tests for middleware functionality and types
 */

import {
  validateJWTToken,
  extractTokenFromRequest,
  shouldProtectPath,
  createNextJSMiddleware,
  createExpressMiddleware,
  checkServerAuth,
  type TokenValidationResult,
  type MiddlewareConfig,
  type AuthCheckResult,
} from '../middleware/index';

describe('Middleware Types', () => {
  test('TokenValidationResult should have correct structure', () => {
    const result: TokenValidationResult = {
      isValid: true,
      token: 'test-token',
      payload: { userId: '123' },
      error: undefined,
    };

    expect(result.isValid).toBe(true);
    expect(result.token).toBe('test-token');
    expect(result.payload).toEqual({ userId: '123' });
  });

  test('MiddlewareConfig should have correct structure', () => {
    const config: MiddlewareConfig = {
      tokenName: 'accessToken',
      redirectUrl: '/login',
      publicPaths: ['/public/*'],
      protectedPaths: ['/dashboard/*'],
      skipValidation: (path) => path.startsWith('/api/'),
    };

    expect(config.tokenName).toBe('accessToken');
    expect(config.publicPaths).toContain('/public/*');
    expect(config.skipValidation?.('/api/test')).toBe(true);
  });

  test('AuthCheckResult should have correct structure', () => {
    const result: AuthCheckResult = {
      isAuthenticated: true,
      user: { id: '123', name: 'Test User' },
      error: undefined,
    };

    expect(result.isAuthenticated).toBe(true);
    expect(result.user?.id).toBe('123');
  });
});

describe('JWT Token Validation', () => {
  test('should validate a proper JWT token structure', () => {
    // Create a mock JWT token (header.payload.signature)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        userId: '123',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      })
    );
    const signature = 'mock-signature';
    const token = `${header}.${payload}.${signature}`;

    const result = validateJWTToken(token);

    expect(result.isValid).toBe(true);
    expect(result.token).toBe(token);
    expect(result.payload?.userId).toBe('123');
    expect(result.error).toBeUndefined();
  });

  test('should reject invalid token format', () => {
    const result = validateJWTToken('invalid-token');

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid token format');
  });

  test('should reject expired token', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        userId: '123',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      })
    );
    const signature = 'mock-signature';
    const token = `${header}.${payload}.${signature}`;

    const result = validateJWTToken(token);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Token expired');
    expect(result.payload?.userId).toBe('123'); // Payload should still be available
  });
});

describe('Token Extraction', () => {
  test('should extract token from Next.js request', () => {
    const mockRequest = {
      cookies: {
        get: (name: string) => (name === 'accessToken' ? { value: 'test-token' } : null),
      },
    };

    const token = extractTokenFromRequest(mockRequest, 'accessToken');
    expect(token).toBe('test-token');
  });

  test('should extract token from Express request', () => {
    const mockRequest = {
      cookies: {
        accessToken: 'test-token',
      },
    };

    const token = extractTokenFromRequest(mockRequest, 'accessToken');
    expect(token).toBe('test-token');
  });

  test('should extract token from cookie header', () => {
    const mockRequest = {
      headers: {
        cookie: 'accessToken=test-token; other=value',
      },
    };

    const token = extractTokenFromRequest(mockRequest, 'accessToken');
    expect(token).toBe('test-token');
  });

  test('should return null if token not found', () => {
    const mockRequest = {
      cookies: {},
      headers: {},
    };

    const token = extractTokenFromRequest(mockRequest, 'accessToken');
    expect(token).toBeNull();
  });
});

describe('Path Protection', () => {
  const config: Partial<MiddlewareConfig> = {
    publicPaths: ['/login', '/register', '/api/public/*'],
    protectedPaths: ['/dashboard/*', '/profile/*'],
    skipValidation: (path) => path.startsWith('/static/'),
  };

  test('should not protect public paths', () => {
    expect(shouldProtectPath('/login', config)).toBe(false);
    expect(shouldProtectPath('/register', config)).toBe(false);
    expect(shouldProtectPath('/api/public/data', config)).toBe(false);
  });

  test('should protect specified paths', () => {
    expect(shouldProtectPath('/dashboard/home', config)).toBe(true);
    expect(shouldProtectPath('/profile/settings', config)).toBe(true);
  });

  test('should skip validation for custom function', () => {
    expect(shouldProtectPath('/static/image.png', config)).toBe(false);
  });

  test('should protect unspecified paths when protectedPaths is defined', () => {
    expect(shouldProtectPath('/random-page', config)).toBe(false); // Not in protectedPaths
  });
});

describe('Middleware Creation', () => {
  const config: MiddlewareConfig = {
    tokenName: 'accessToken',
    redirectUrl: '/login',
    publicPaths: ['/login'],
  };

  test('should create Next.js middleware function', () => {
    const middleware = createNextJSMiddleware(config);
    expect(typeof middleware).toBe('function');
  });

  test('should create Express middleware function', () => {
    const middleware = createExpressMiddleware(config);
    expect(typeof middleware).toBe('function');
  });
});

describe('Server Auth Check', () => {
  test('should check authentication with valid token', async () => {
    const mockCookieStore = {
      get: (name: string) => {
        if (name === 'accessToken') {
          const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
          const payload = btoa(
            JSON.stringify({
              userId: '123',
              exp: Math.floor(Date.now() / 1000) + 3600,
            })
          );
          const signature = 'mock-signature';
          return { value: `${header}.${payload}.${signature}` };
        }
        return null;
      },
    };

    const result = await checkServerAuth(mockCookieStore, 'accessToken');

    expect(result.isAuthenticated).toBe(true);
    expect(result.user?.userId).toBe('123');
  });

  test('should fail authentication with no token', async () => {
    const mockCookieStore = {
      get: () => null,
    };

    const result = await checkServerAuth(mockCookieStore, 'accessToken');

    expect(result.isAuthenticated).toBe(false);
    expect(result.error).toBe('No token found');
  });
});

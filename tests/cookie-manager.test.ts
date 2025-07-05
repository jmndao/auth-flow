import { CookieManager } from '../core/cookie-manager';
import { TokenManager } from '../core/token-manager';

// Mock Next.js cookies function
const createMockNextJSCookies = (initialCookies: Record<string, string> = {}) => {
  let cookieStore = { ...initialCookies };

  const mockCookieStore = {
    get: jest.fn((key: string) => {
      const value = cookieStore[key];
      return value ? { value, name: key } : undefined;
    }),
    set: jest.fn((key: string, value: string, options?: any) => {
      cookieStore[key] = value;
    }),
    delete: jest.fn((key: string) => {
      delete cookieStore[key];
    }),
  };

  const syncCookies = jest.fn(() => mockCookieStore);
  const asyncCookies = jest.fn(async () => mockCookieStore);

  return { syncCookies, asyncCookies, mockCookieStore, cookieStore };
};

// Mock Express request/response
const createMockExpressContext = (initialCookies: Record<string, string> = {}) => {
  const mockReq = {
    cookies: { ...initialCookies },
    headers: {
      cookie: Object.entries(initialCookies)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('; '),
    },
  };

  const mockRes = {
    cookie: jest.fn((name: string, value: string, options?: any) => {
      mockReq.cookies[name] = value;
    }),
    clearCookie: jest.fn((name: string) => {
      delete mockReq.cookies[name];
    }),
    setHeader: jest.fn(),
    getHeader: jest.fn(() => []),
  };

  return { req: mockReq, res: mockRes };
};

describe('CookieManager Core Functionality', () => {
  let originalWindow: any;

  beforeEach(() => {
    originalWindow = (global as any).window;
    jest.clearAllMocks();
  });

  afterEach(() => {
    (global as any).window = originalWindow;
  });

  describe('Server-side Cookie Handling', () => {
    beforeEach(() => {
      // Mock server environment
      delete (global as any).window;
    });

    test('should handle sync Next.js cookies', async () => {
      const { syncCookies, mockCookieStore } = createMockNextJSCookies({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });

      const cookieManager = new CookieManager({ cookies: syncCookies }, { debugMode: false });

      const accessToken = await cookieManager.get('accessToken');
      const refreshToken = await cookieManager.get('refreshToken');

      expect(accessToken).toBe('test-access-token');
      expect(refreshToken).toBe('test-refresh-token');
      expect(mockCookieStore.get).toHaveBeenCalledWith('accessToken');
      expect(mockCookieStore.get).toHaveBeenCalledWith('refreshToken');
    });

    test('should handle async Next.js cookies', async () => {
      const { asyncCookies, mockCookieStore } = createMockNextJSCookies({
        accessToken: 'async-access-token',
      });

      const cookieManager = new CookieManager({ cookies: asyncCookies }, { debugMode: false });

      const accessToken = await cookieManager.get('accessToken');
      expect(accessToken).toBe('async-access-token');
      expect(asyncCookies).toHaveBeenCalled();
    });

    test('should set cookies using Next.js', async () => {
      const { syncCookies, mockCookieStore } = createMockNextJSCookies();

      const cookieManager = new CookieManager({ cookies: syncCookies }, { debugMode: false });

      await cookieManager.set('newToken', 'new-value');

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'newToken',
        'new-value',
        expect.objectContaining({
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 86400,
        })
      );
    });

    test('should handle Express cookies', async () => {
      const { req, res } = createMockExpressContext({
        accessToken: 'express-token',
      });

      const cookieManager = new CookieManager({ req, res });

      const token = await cookieManager.get('accessToken');
      expect(token).toBe('express-token');

      await cookieManager.set('newToken', 'express-value');
      expect(res.cookie).toHaveBeenCalled();
    });

    test('should parse cookie headers', async () => {
      const mockReq = {
        headers: {
          cookie: 'accessToken=header-token; refreshToken=header-refresh',
        },
      };

      const cookieManager = new CookieManager({ req: mockReq });

      const accessToken = await cookieManager.get('accessToken');
      const refreshToken = await cookieManager.get('refreshToken');

      expect(accessToken).toBe('header-token');
      expect(refreshToken).toBe('header-refresh');
    });
  });

  describe('Client-side Cookie Handling', () => {
    beforeEach(() => {
      // Mock client environment
      (global as any).window = {};
    });

    test('should handle client-side cookies with document.cookie', async () => {
      const cookieManager = new CookieManager(
        {},
        {
          secure: false, // For testing
          debugMode: false,
        }
      );

      await cookieManager.set('clientToken', 'client-value');
      const value = await cookieManager.get('clientToken');

      expect(value).toBe('client-value');
    });
  });

  describe('Fallback Token System', () => {
    test('should use fallback tokens when cookies unavailable', async () => {
      const cookieManager = new CookieManager(
        {},
        {
          fallbackToBody: true,
          debugMode: false,
        }
      );

      const fallbackTokens = {
        accessToken: 'fallback-access',
        refreshToken: 'fallback-refresh',
      };

      cookieManager.setFallbackTokens(fallbackTokens);

      const accessToken = await cookieManager.get('accessToken');
      const refreshToken = await cookieManager.get('refreshToken');

      expect(accessToken).toBe('fallback-access');
      expect(refreshToken).toBe('fallback-refresh');
    });

    test('should prefer cookies over fallback tokens', async () => {
      delete (global as any).window;

      const { syncCookies, mockCookieStore } = createMockNextJSCookies({
        accessToken: 'real-cookie-token',
      });

      const cookieManager = new CookieManager(
        { cookies: syncCookies },
        { fallbackToBody: true, debugMode: false }
      );

      // Set fallback tokens
      cookieManager.setFallbackTokens({
        accessToken: 'fallback-token',
        refreshToken: 'fallback-refresh',
      });

      // Clear temporary store to force cookie lookup
      await cookieManager.clear();
      cookieManager.setFallbackTokens({
        accessToken: 'fallback-token',
        refreshToken: 'fallback-refresh',
      });

      const accessToken = await cookieManager.get('accessToken');
      expect(accessToken).toBe('real-cookie-token');
    });
  });

  describe('Error Handling', () => {
    test('should handle broken Next.js cookies gracefully', async () => {
      delete (global as any).window;

      const brokenCookies = jest.fn(() => {
        throw new Error('Cookies failed');
      });

      const cookieManager = new CookieManager({ cookies: brokenCookies }, { debugMode: false });

      const result = await cookieManager.get('nonExistent');
      expect(result).toBeNull();
    });

    test('should handle async cookie errors', async () => {
      delete (global as any).window;

      const brokenAsyncCookies = jest.fn(async () => {
        throw new Error('Async cookies failed');
      });

      const cookieManager = new CookieManager(
        { cookies: brokenAsyncCookies },
        { debugMode: false }
      );

      const result = await cookieManager.get('nonExistent');
      expect(result).toBeNull();
    });
  });

  describe('Temporary Store Cache', () => {
    test('should cache tokens in temporary store', async () => {
      const cookieManager = new CookieManager({}, { debugMode: false });

      cookieManager.setFallbackTokens({
        accessToken: 'cached-access',
        refreshToken: 'cached-refresh',
      });

      // First access should come from temporary store
      const accessToken1 = await cookieManager.get('accessToken');
      const accessToken2 = await cookieManager.get('accessToken');

      expect(accessToken1).toBe('cached-access');
      expect(accessToken2).toBe('cached-access');
    });

    test('should clear temporary store', async () => {
      const cookieManager = new CookieManager({}, { debugMode: false });

      cookieManager.setFallbackTokens({
        accessToken: 'temp-token',
        refreshToken: 'temp-refresh',
      });

      let token = await cookieManager.get('accessToken');
      expect(token).toBe('temp-token');

      await cookieManager.clear();

      // After clear, fallback tokens should be gone
      token = await cookieManager.get('accessToken');
      expect(token).toBeNull();
    });
  });
});

describe('TokenManager with CookieManager Integration', () => {
  let originalWindow: any;

  beforeEach(() => {
    originalWindow = (global as any).window;
    jest.clearAllMocks();
  });

  afterEach(() => {
    (global as any).window = originalWindow;
  });

  test('should use CookieManager for server-side storage', async () => {
    delete (global as any).window;

    const { syncCookies, mockCookieStore } = createMockNextJSCookies();

    const tokenManager = new TokenManager(
      { access: 'accessToken', refresh: 'refreshToken' },
      'cookies',
      { cookies: syncCookies },
      'server'
    );

    const testTokens = {
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
    };

    await tokenManager.setTokens(testTokens);

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'accessToken',
      'test-access',
      expect.any(Object)
    );
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'refreshToken',
      'test-refresh',
      expect.any(Object)
    );
  });

  test('should handle hasTokensSync with fallback tokens', async () => {
    delete (global as any).window;

    const tokenManager = new TokenManager(
      { access: 'accessToken', refresh: 'refreshToken' },
      'cookies',
      {},
      'server'
    );

    // Initially should return false
    expect(tokenManager.hasTokensSync()).toBe(false);

    const testTokens = {
      accessToken: 'sync-access',
      refreshToken: 'sync-refresh',
    };

    await tokenManager.setTokens(testTokens);

    // Should return true due to fallback tokens in CookieManager
    expect(tokenManager.hasTokensSync()).toBe(true);
  });

  test('should retrieve tokens after setting them', async () => {
    delete (global as any).window;

    const { syncCookies } = createMockNextJSCookies();

    const tokenManager = new TokenManager(
      { access: 'accessToken', refresh: 'refreshToken' },
      'cookies',
      { cookies: syncCookies },
      'server'
    );

    const testTokens = {
      accessToken: 'retrieve-access',
      refreshToken: 'retrieve-refresh',
    };

    await tokenManager.setTokens(testTokens);
    const retrievedTokens = await tokenManager.getTokens();

    expect(retrievedTokens).toEqual(testTokens);
  });
});

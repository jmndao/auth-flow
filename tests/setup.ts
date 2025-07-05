import 'jest-environment-jsdom';

// Create a comprehensive axios mock that handles all scenarios
const createComprehensiveAxiosMock = () => {
  // Create mock instance that will be returned by axios.create()
  const mockAxiosInstance = {
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
        eject: jest.fn(),
      },
      response: {
        use: jest.fn(),
        eject: jest.fn(),
      },
    },
    defaults: {
      headers: {
        common: {},
        delete: {},
        get: {},
        head: {},
        patch: {},
        post: {},
        put: {},
      },
    },
  };

  // Create main axios mock
  const mockAxios = {
    // Direct axios methods (used by AuthClient.login, AuthClient.refreshTokens)
    request: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    head: jest.fn(),
    options: jest.fn(),

    // axios.create() method (used by AuthClient constructor)
    create: jest.fn(() => {
      // Return a new instance each time, but make sure it has the same mock functions
      return {
        ...mockAxiosInstance,
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
            eject: jest.fn(),
          },
          response: {
            use: jest.fn(),
            eject: jest.fn(),
          },
        },
      };
    }),

    // Default export (for CommonJS compatibility)
    default: {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      create: jest.fn(() => mockAxiosInstance),
    },

    // Additional axios properties
    isAxiosError: jest.fn(() => false),
    CancelToken: {
      source: jest.fn(() => ({
        token: {},
        cancel: jest.fn(),
      })),
    },
    Cancel: jest.fn(),
    isCancel: jest.fn(() => false),
    all: jest.fn(() => Promise.resolve([])),
    spread: jest.fn((callback) => callback),
  };

  return { mockAxios, mockAxiosInstance };
};

// Create the mock
const { mockAxios, mockAxiosInstance } = createComprehensiveAxiosMock();

// Mock axios at the module level
jest.mock('axios', () => mockAxios);

// Export the mock references for test access
export const getAxiosMock = () => mockAxios;
export const getAxiosInstanceMock = () => mockAxiosInstance;

// Environment mock functions
export const mockServerEnvironment = () => {
  delete (global as any).window;
  (global as any).process = { env: { NODE_ENV: 'test' } };
};

export const mockClientEnvironment = () => {
  (global as any).window = {
    location: { protocol: 'http:', host: 'localhost:3000' },
  };
};

// Mock token utilities
export const createMockTokens = () => ({
  accessToken: `mock-access-token-${Date.now()}`,
  refreshToken: `mock-refresh-token-${Date.now()}`,
});

export const createMockConfig = () => ({
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

export const createMockLoginResponse = (customTokens?: {
  accessToken: string;
  refreshToken: string;
}) => {
  const tokens = customTokens || createMockTokens();
  return {
    data: {
      user: { id: 1, name: 'Test User', email: 'test@example.com' },
      ...tokens,
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { url: '/auth/login', method: 'POST' },
  };
};

// JWT utilities
export const createMockJWT = (payload: any, expiresIn: number = 3600) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };
  const payloadStr = btoa(JSON.stringify(fullPayload));
  const signature = btoa('mock-signature');

  return `${header}.${payloadStr}.${signature}`;
};

export const createExpiredJWT = (payload: any) => {
  return createMockJWT(payload, -3600); // Expired 1 hour ago
};

export const createValidJWT = (payload: any) => {
  return createMockJWT(payload, 3600); // Valid for 1 hour
};

// Performance testing
export const measureAsyncOperation = async <T>(
  operation: () => Promise<T>,
  maxDuration: number = 1000
): Promise<{ result: T; duration: number; withinLimit: boolean }> => {
  const start = performance.now();
  const result = await operation();
  const end = performance.now();
  const duration = end - start;

  return {
    result,
    duration,
    withinLimit: duration <= maxDuration,
  };
};

// Console mocking
export const mockConsole = () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();

  return {
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    },
    getLogs: () => (console.log as jest.Mock).mock.calls,
    getWarnings: () => (console.warn as jest.Mock).mock.calls,
    getErrors: () => (console.error as jest.Mock).mock.calls,
  };
};

// Ensure window exists for browser-like environment
if (typeof window === 'undefined') {
  (global as any).window = {};
}

// Mock localStorage without breaking existing mocks
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    length: 0,
    key: jest.fn(),
    __storage: store,
  };
};

// Only set localStorage if it doesn't already exist
if (!global.localStorage) {
  Object.defineProperty(global, 'localStorage', {
    value: createLocalStorageMock(),
    writable: true,
  });
}

// Only set window.localStorage if window exists and doesn't have localStorage
if (typeof window !== 'undefined' && !window.localStorage) {
  Object.defineProperty(window, 'localStorage', {
    value: global.localStorage,
    writable: true,
  });
}

// Clean document.cookie setup - only if document exists
if (typeof document !== 'undefined') {
  // Only override if not already set properly
  const currentDescriptor = Object.getOwnPropertyDescriptor(document, 'cookie');
  if (!currentDescriptor || !currentDescriptor.set) {
    let cookieString = '';

    Object.defineProperty(document, 'cookie', {
      get: () => cookieString,
      set: (value: string) => {
        if (value.includes('=')) {
          const [name, val] = value.split('=');
          if (val && !value.includes('expires=Thu, 01 Jan 1970')) {
            const cookies = cookieString.split(';').filter((c) => c.trim());
            const existingIndex = cookies.findIndex((c) => c.trim().startsWith(name + '='));
            const newCookie = `${name}=${val.split(';')[0]}`;

            if (existingIndex >= 0) {
              cookies[existingIndex] = newCookie;
            } else {
              cookies.push(newCookie);
            }
            cookieString = cookies.join('; ');
          } else {
            cookieString = cookieString
              .split(';')
              .filter((c) => !c.trim().startsWith(name + '='))
              .join('; ');
          }
        }
      },
      configurable: true,
    });
  }
}

// Enhanced cookie mock for malformed data testing
export const createMalformedCookieContext = () => {
  const mockReq = {
    headers: {
      cookie: 'malformed=cookie; validToken=valid-value; broken=incomplete',
    },
    cookies: {
      malformed: 'cookie', // This should be accessible
      validToken: 'valid-value',
      broken: 'incomplete',
    },
  };

  return { req: mockReq };
};

// Test utilities - attach to global for use in tests
(global as any).createMockTokens = createMockTokens;
(global as any).createMockConfig = createMockConfig;
(global as any).createMalformedCookieContext = createMalformedCookieContext;

// Clean up after each test
afterEach(() => {
  // Clear all mocks but don't reset them to avoid overriding test-specific mocks
  jest.clearAllMocks();

  // Reset localStorage if it exists
  if (global.localStorage && typeof global.localStorage.clear === 'function') {
    global.localStorage.clear();
  }

  // Reset document.cookie if it exists
  if (typeof document !== 'undefined' && document.cookie !== undefined) {
    // Clear cookies by setting them to expire
    const cookies = document.cookie.split(';');
    cookies.forEach((cookie) => {
      const [name] = cookie.split('=');
      if (name.trim()) {
        document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
  }
});

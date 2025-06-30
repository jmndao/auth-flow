// Jest setup file for AuthFlow tests

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};

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
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock document.cookie for testing
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
  configurable: true,
});

// Global test utilities
(global as any).createMockTokens = () => ({
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
});

(global as any).createMockConfig = () => ({
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  localStorageMock.__storage = {};
  if (typeof document !== 'undefined') {
    document.cookie = '';
  }
});

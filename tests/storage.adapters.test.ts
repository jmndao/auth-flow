import { MemoryStorageAdapter, CookieStorageAdapter, LocalStorageAdapter } from '../adapters';

// Mock localStorage for testing
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  __storage: {} as Record<string, string>,
};

// Setup localStorage mock
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(global, 'window', {
  value: { localStorage: localStorageMock },
  writable: true,
});

describe('Storage Adapters', () => {
  describe('MemoryStorageAdapter', () => {
    let adapter: MemoryStorageAdapter;

    beforeEach(() => {
      adapter = new MemoryStorageAdapter();
    });

    test('should store and retrieve values', () => {
      adapter.set('testKey', 'testValue');
      expect(adapter.get('testKey')).toBe('testValue');
    });

    test('should return null for non-existent keys', () => {
      expect(adapter.get('nonExistentKey')).toBeNull();
    });

    test('should remove values', () => {
      adapter.set('testKey', 'testValue');
      adapter.remove('testKey');
      expect(adapter.get('testKey')).toBeNull();
    });

    test('should clear all values', () => {
      adapter.set('key1', 'value1');
      adapter.set('key2', 'value2');
      adapter.clear();
      expect(adapter.get('key1')).toBeNull();
      expect(adapter.get('key2')).toBeNull();
    });
  });

  describe('CookieStorageAdapter', () => {
    test('should handle cookie options', () => {
      const adapter = new CookieStorageAdapter(
        {},
        {
          secure: true,
          sameSite: 'strict',
          maxAge: 3600,
        }
      );

      expect(adapter).toBeInstanceOf(CookieStorageAdapter);
    });

    test('should handle server-side context', async () => {
      const mockReq = {
        cookies: {
          testKey: 'testValue',
        },
      };

      const mockRes = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
      };

      // Mock server environment
      delete (global as any).window;

      const serverAdapter = new CookieStorageAdapter(
        { req: mockReq, res: mockRes },
        { httpOnly: true }
      );

      const result = await serverAdapter.get('testKey');
      expect(result).toBe('testValue');

      await serverAdapter.set('newKey', 'newValue');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'newKey',
        'newValue',
        expect.objectContaining({
          httpOnly: true,
          secure: false, // NODE_ENV is not production in test
          sameSite: 'lax',
          path: '/',
        })
      );

      // Restore window
      Object.defineProperty(global, 'window', {
        value: { localStorage: localStorageMock },
        writable: true,
      });
    });
  });

  describe('LocalStorageAdapter', () => {
    let adapter: LocalStorageAdapter;

    beforeEach(() => {
      // Reset localStorage mock
      localStorageMock.__storage = {};
      localStorageMock.getItem.mockClear();
      localStorageMock.setItem.mockClear();
      localStorageMock.removeItem.mockClear();
      localStorageMock.clear.mockClear();

      // Setup default behavior
      localStorageMock.getItem.mockImplementation((key: string) => {
        return localStorageMock.__storage[key] || null;
      });

      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        localStorageMock.__storage[key] = value;
      });

      localStorageMock.removeItem.mockImplementation((key: string) => {
        delete localStorageMock.__storage[key];
      });

      localStorageMock.clear.mockImplementation(() => {
        localStorageMock.__storage = {};
      });

      adapter = new LocalStorageAdapter();
    });

    test('should store and retrieve values', () => {
      adapter.set('testKey', 'testValue');
      expect(adapter.get('testKey')).toBe('testValue');
    });

    test('should return null for non-existent keys', () => {
      expect(adapter.get('nonExistentKey')).toBeNull();
    });

    test('should remove values', () => {
      adapter.set('testKey', 'testValue');
      adapter.remove('testKey');
      expect(adapter.get('testKey')).toBeNull();
    });

    test('should clear all values', () => {
      adapter.set('key1', 'value1');
      adapter.set('key2', 'value2');
      adapter.clear();
      expect(adapter.get('key1')).toBeNull();
      expect(adapter.get('key2')).toBeNull();
    });

    test('should handle localStorage errors gracefully', () => {
      // Mock console.error to suppress error logs during test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(adapter.get('testKey')).toBeNull();
      expect(() => adapter.set('testKey', 'testValue')).not.toThrow();

      consoleSpy.mockRestore();
    });

    test('should throw error when localStorage is not available', () => {
      // Save original values
      const originalWindow = (global as any).window;
      const originalLocalStorage = (global as any).localStorage;

      // Remove window and localStorage completely
      delete (global as any).window;
      delete (global as any).localStorage;

      // Set window to undefined to ensure typeof window === 'undefined'
      (global as any).window = undefined;

      expect(() => new LocalStorageAdapter()).toThrow(
        'LocalStorage is not available in this environment'
      );

      // Restore original values
      (global as any).window = originalWindow;
      (global as any).localStorage = originalLocalStorage;
    });
  });
});
